import crypto from 'node:crypto';
import { Router } from 'express';
import { query, withTransaction } from './db.js';
import { ApiError, asyncHandler } from './errors.js';
import { parseId, requireJenjangCode, requireMapelCode, requireMapelCodes } from './validate.js';
import { authorize } from './authMiddleware.js';
import { generateTryoutSlug } from './auth.js';
import { resolveJenjangId } from './questions.js';
import {
  buildQuestionsZip,
  loadSessionExportData,
  zipResponse
} from './tryoutExport.js';

export const tryoutRouter = Router();

const nowMeta = () => ({ ts: new Date().toISOString() });
const adminOnly = authorize('tryouts.manage');
const keyExportOnly = authorize('tryout_questions.key_export');

function toBool(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function normalizeCbtSettings(body = {}) {
  const enabled = toBool(body.cbt_enabled);
  const rawDuration = body.cbt_duration_minutes;
  let duration = null;
  if (rawDuration !== undefined && rawDuration !== null && rawDuration !== '') {
    duration = Number(rawDuration);
    if (!Number.isInteger(duration) || duration < 1 || duration > 600) {
      throw new ApiError('VALIDATION_ERROR', 'cbt_duration_minutes harus antara 1 dan 600');
    }
  }
  if (enabled && duration === null) {
    throw new ApiError('VALIDATION_ERROR', 'Mode CBT aktif memerlukan cbt_duration_minutes');
  }
  const rawViolations = body.cbt_max_violations ?? 0;
  const maxViolations = Number(rawViolations);
  if (!Number.isInteger(maxViolations) || maxViolations < 0 || maxViolations > 100) {
    throw new ApiError('VALIDATION_ERROR', 'cbt_max_violations harus antara 0 dan 100');
  }
  return {
    enabled,
    duration,
    shuffleQuestions: toBool(body.cbt_shuffle_questions),
    shuffleOptions: toBool(body.cbt_shuffle_options),
    requireFullscreen: toBool(body.cbt_require_fullscreen),
    maxViolations
  };
}

function temporarySlug(prefix = 'tmp') {
  return `${prefix}-${crypto.randomBytes(12).toString('hex')}`;
}

function requireName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 128) {
    throw new ApiError('VALIDATION_ERROR', 'nama tryout wajib diisi maksimal 128 karakter');
  }
  return value.trim();
}

function requireDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new ApiError('VALIDATION_ERROR', 'session_date harus berformat YYYY-MM-DD');
  }
  return value;
}

function requireTimestamp(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError('VALIDATION_ERROR', `${field} wajib diisi`);
  }
  let raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(raw)) raw = raw.replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) raw = `${raw}:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) raw = `${raw}+07:00`;
  const milliseconds = Date.parse(raw);
  if (Number.isNaN(milliseconds)) {
    throw new ApiError('VALIDATION_ERROR', `${field} harus berupa tanggal dan jam yang valid`);
  }
  return new Date(milliseconds).toISOString();
}

function jakartaDate(iso) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(iso));
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function legacyRange(sessionDate) {
  return {
    startAt: new Date(`${sessionDate}T00:00:00+07:00`).toISOString(),
    endAt: new Date(`${sessionDate}T23:59:00+07:00`).toISOString()
  };
}

function requireIds(value, field) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError('VALIDATION_ERROR', `${field} wajib berisi minimal satu ID`);
  }
  if (value.length > 200) {
    throw new ApiError('VALIDATION_ERROR', `${field} maksimal 200 ID`);
  }
  return [...new Set(value.map((item) => parseId(item, field)))];
}

function optionalIds(value, field) {
  if (value === undefined || value === null || value === '') return [];
  if (!Array.isArray(value)) {
    throw new ApiError('VALIDATION_ERROR', `${field} harus berupa array ID`);
  }
  if (value.length > 200) {
    throw new ApiError('VALIDATION_ERROR', `${field} maksimal 200 ID`);
  }
  return [...new Set(value.map((item) => parseId(item, field)))];
}

function resolveMapelCodes(body) {
  const hasCodes = body?.mapel_codes !== undefined && body?.mapel_codes !== null;
  const hasLegacyCode = body?.mapel_code !== undefined && body?.mapel_code !== null;
  const hasLegacyAlias = body?.mapel !== undefined && body?.mapel !== null;
  const codes = hasCodes ? requireMapelCodes(body.mapel_codes) : null;

  let legacyCodes = null;
  if (hasLegacyCode && hasLegacyAlias) {
    const first = requireMapelCode(body.mapel_code);
    const second = requireMapelCode(body.mapel);
    if (first !== second) {
      throw new ApiError('VALIDATION_ERROR', 'mapel_code dan mapel_codes harus sama bila keduanya dikirim');
    }
    legacyCodes = [first];
  } else if (hasLegacyCode || hasLegacyAlias) {
    legacyCodes = requireMapelCodes([hasLegacyCode ? body.mapel_code : body.mapel]);
  }

  if (!codes && !legacyCodes) {
    throw new ApiError('VALIDATION_ERROR', 'mapel_codes wajib berisi minimal satu kode mapel');
  }
  if (codes && legacyCodes && codes.join('|') !== legacyCodes.join('|')) {
    throw new ApiError('VALIDATION_ERROR', 'mapel_code dan mapel_codes harus sama bila keduanya dikirim');
  }
  return codes ?? legacyCodes;
}

function normalizeSessionDefinitions(body, name) {
  if (!Array.isArray(body.sessions) || body.sessions.length === 0) {
    throw new ApiError('VALIDATION_ERROR', 'sessions wajib berisi minimal satu sesi');
  }
  if (body.sessions.length > 20) {
    throw new ApiError('VALIDATION_ERROR', 'sessions maksimal 20 sesi');
  }
  if (body.question_ids !== undefined || body.sheet_ids !== undefined
      || body.mapel_codes !== undefined || body.session_date !== undefined) {
    throw new ApiError('VALIDATION_ERROR', 'Gunakan sessions[]; format tryout legacy sudah tidak didukung');
  }
  const startsAt = requireTimestamp(body.starts_at, 'starts_at');
  const endsAt = requireTimestamp(body.ends_at, 'ends_at');
  const tryoutCbt = normalizeCbtSettings(body);
  if (Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new ApiError('VALIDATION_ERROR', 'end_at harus setelah start_at');
  }
  const definitions = body.sessions.map((session, index) => {
    if (!session || typeof session !== 'object' || Array.isArray(session)) {
      throw new ApiError('VALIDATION_ERROR', `sessions[${index}] harus berupa objek`);
    }
    if (session.mapel_codes !== undefined) {
      throw new ApiError('VALIDATION_ERROR', 'Setiap sesi harus memuat tepat satu mapel_code');
    }
    if (session.question_ids !== undefined && session.question_ids !== null) {
      throw new ApiError('VALIDATION_ERROR', `sessions[${index}].question_ids tidak didukung; gunakan sheet_ids`);
    }
    if (session.sheet_ids === undefined || session.sheet_ids === null) {
      throw new ApiError('VALIDATION_ERROR', `sessions[${index}].sheet_ids wajib diisi minimal satu lembar soal`);
    }
    const mapelCode = requireMapelCode(session.mapel_code);
    const sheetIds = requireIds(session.sheet_ids, `sessions[${index}].sheet_ids`);
    if (sheetIds.length === 0) {
      throw new ApiError('VALIDATION_ERROR', `sessions[${index}].sheet_ids wajib berisi minimal satu lembar soal`);
    }
    const rawStart = session.start_at === undefined ? null : requireTimestamp(session.start_at, `sessions[${index}].start_at`);
    const rawEnd = session.end_at === undefined ? null : requireTimestamp(session.end_at, `sessions[${index}].end_at`);
    return {
      name: session.name === undefined || session.name === null || session.name === ''
        ? `${name} - ${mapelCode}` : requireName(session.name),
      mapelCode,
      sheetIds,
      questionIds: [],
      hasSheets: true,
      distributeByMapel: false,
      startAt: rawStart,
      endAt: rawEnd,
      cbt: normalizeCbtSettings({
        cbt_enabled: session.cbt_enabled ?? tryoutCbt.enabled,
        cbt_duration_minutes: session.cbt_duration_minutes ?? tryoutCbt.duration,
        cbt_shuffle_questions: session.cbt_shuffle_questions ?? tryoutCbt.shuffleQuestions,
        cbt_shuffle_options: session.cbt_shuffle_options ?? tryoutCbt.shuffleOptions,
        cbt_require_fullscreen: session.cbt_require_fullscreen ?? tryoutCbt.requireFullscreen,
        cbt_max_violations: session.cbt_max_violations ?? tryoutCbt.maxViolations
      })
    };
  });
  return { isLegacy: false, startsAt, endsAt, definitions };
}


const SESSION_SELECT = `
  SELECT s.id, s.name, s.slug, s.event_id, s.session_date, s.start_at, s.end_at, s.is_active,
         s.cbt_enabled, s.cbt_duration_minutes, s.cbt_shuffle_questions,
         s.cbt_shuffle_options, s.cbt_require_fullscreen, s.cbt_max_violations,
         coalesce(jm.id, sm.id) AS mapel_id,
         coalesce(jm.code, sm.code) AS mapel_code,
         coalesce(jm.name, sm.name) AS mapel_name,
         (SELECT coalesce(jsonb_agg(jsonb_build_object(
                            'id', tm.id, 'code', tm.code, 'name', tm.name
                          ) ORDER BY tm.code), '[]'::jsonb)
          FROM tryout_session_mapels tsm
          JOIN mapels tm ON tm.id = tsm.mapel_id
          WHERE tsm.session_id = s.id) AS mapels,
         (SELECT coalesce(array_agg(tq.question_id ORDER BY tq.position, tq.question_id), '{}'::bigint[])
          FROM tryout_session_questions tq WHERE tq.session_id = s.id) AS question_ids,
         (SELECT coalesce(array_agg(tss.sheet_id ORDER BY tss.sheet_id), '{}'::bigint[])
          FROM tryout_session_sheets tss WHERE tss.session_id = s.id) AS sheet_ids,
         (SELECT coalesce(array_agg(tp.participant_id ORDER BY tp.participant_id), '{}'::bigint[])
          FROM tryout_session_participants tp WHERE tp.session_id = s.id) AS participant_ids,
         (SELECT count(*)::int FROM tryout_submissions ts WHERE ts.session_id = s.id) AS submission_count
  FROM tryout_sessions s
  LEFT JOIN tryout_session_mapels tsm ON tsm.session_id = s.id
  LEFT JOIN mapels jm ON jm.id = tsm.mapel_id
  LEFT JOIN mapels sm ON sm.id = s.mapel_id
`;

function numbers(values) {
  return (values ?? []).map((value) => Number(value));
}

async function loadEvent(client, eventId, responseId) {
  const run = client?.query ? client.query.bind(client) : query;
  const eventResult = await run(
    `SELECT e.id, e.name, e.slug, e.starts_at, e.ends_at,
            j.kode AS jenjang_kode, j.nama AS jenjang_nama,
            public.tryout_event_status(e.id) AS status, e.created_at, e.updated_at
     FROM tryout_events e
     LEFT JOIN jenjang j ON j.id = e.jenjang_id
     WHERE e.id = $1`,
    [eventId]
  );
  const event = eventResult.rows[0];
  if (!event) return null;
  const sessionResult = await run(
    `${SESSION_SELECT} WHERE s.event_id = $1 ORDER BY s.id`,
    [eventId]
  );
  const sessions = sessionResult.rows.map((row) => ({
    ...row,
    id: Number(row.id),
    event_id: Number(row.event_id),
    mapel_id: row.mapel_id === null ? null : Number(row.mapel_id),
    question_ids: numbers(row.question_ids),
    sheet_ids: numbers(row.sheet_ids),
    participant_ids: numbers(row.participant_ids),
    status: event.status
  }));
  const first = sessions[0] ?? null;
  const mapels = [];
  const seenMapels = new Set();
  for (const session of sessions) {
    for (const mapel of session.mapels ?? []) {
      if (!seenMapels.has(Number(mapel.id))) {
        seenMapels.add(Number(mapel.id));
        mapels.push({ id: Number(mapel.id), code: mapel.code, name: mapel.name });
      }
    }
  }
  mapels.sort((a, b) => a.code.localeCompare(b.code));
  const firstMapel = mapels[0] ?? null;
  const participantIds = [...new Set(sessions.flatMap((session) => session.participant_ids))];
  return {
    id: responseId ?? Number(event.id),
    event_id: Number(event.id),
    tryout_event_id: Number(event.id),
    parent_id: Number(event.id),
    name: event.name,
    slug: event.slug,
    jenjang_kode: event.jenjang_kode,
    jenjang_nama: event.jenjang_nama,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    status: event.status,
    created_at: event.created_at,
    updated_at: event.updated_at,
    session_id: first?.id ?? null,
    session_slug: first?.slug ?? null,
    session_date: first?.session_date ?? null,
    start_at: event.starts_at,
    end_at: event.ends_at,
    is_active: first?.is_active ?? false,
    mapel_id: first?.mapel_id ?? firstMapel?.id ?? null,
    mapel_code: first?.mapel_code ?? firstMapel?.code ?? null,
    mapel_name: first?.mapel_name ?? firstMapel?.name ?? null,
    mapels,
    question_ids: [...new Set(sessions.flatMap((session) => session.question_ids))],
    sheet_ids: [...new Set(sessions.flatMap((session) => session.sheet_ids))],
    participant_ids: participantIds,
    question_count: sessions.reduce((total, session) => total + session.question_ids.length, 0),
    sheet_count: sessions.reduce((total, session) => total + session.sheet_ids.length, 0),
    participant_count: participantIds.length,
    submission_count: sessions.reduce((total, session) => total + Number(session.submission_count ?? 0), 0),
    cbt_enabled: first?.cbt_enabled ?? false,
    cbt_duration_minutes: first?.cbt_duration_minutes ?? null,
    cbt_shuffle_questions: first?.cbt_shuffle_questions ?? false,
    cbt_shuffle_options: first?.cbt_shuffle_options ?? false,
    cbt_require_fullscreen: first?.cbt_require_fullscreen ?? false,
    cbt_max_violations: first?.cbt_max_violations ?? 0,
    sessions
  };
}

async function eventIdFor(run, id) {
  const { rows } = await run(
    `SELECT id FROM tryout_events WHERE id = $1
     UNION
     SELECT event_id AS id FROM tryout_sessions WHERE id = $1
     LIMIT 1`,
    [id]
  );
  return rows[0] ? Number(rows[0].id) : null;
}

async function sessionIdsFor(run, id) {
  const eventId = await eventIdFor(run, id);
  if (eventId === null) return [];
  const { rows } = await run('SELECT id FROM tryout_sessions WHERE event_id = $1 ORDER BY id', [eventId]);
  const ids = rows.map((row) => Number(row.id));
  return ids.includes(id) && eventId !== id ? [id] : ids;
}

async function exportTryoutQuestions(id, includeKeys) {
  const eventId = await eventIdFor(query, id);
  if (eventId === null) throw new ApiError('NOT_FOUND', 'Tryout tidak ditemukan', 404);
  const event = await loadEvent(null, eventId, id);
  const sessionIds = event.sessions.map((session) => Number(session.id));
  if (sessionIds.length === 0) {
    throw new ApiError('NOT_FOUND', 'Tryout tidak memiliki sesi untuk diekspor', 404);
  }
  const sessionData = await loadSessionExportData(query, sessionIds);
  const buffer = buildQuestionsZip({
    event: {
      name: event.name,
      slug: event.slug,
      starts_at: event.starts_at,
      ends_at: event.ends_at
    },
    sessionData,
    includeKeys
  });
  return { event, buffer };
}

async function resolveParticipantIds(client, rawIds) {
  const ids = optionalIds(rawIds, 'participant_ids');
  const resolved = [];
  for (const id of ids) {
    const siswa = await client.query(
      'SELECT id FROM siswa WHERE id = $1 AND is_active = true AND jenis = $2',
      [id, 'siswa']
    );
    if (siswa.rows[0]) {
      resolved.push(Number(siswa.rows[0].id));
      continue;
    }
    const prospectResult = await client.query(
      'SELECT id, nama, email, is_active, bergabung, bergabung_at FROM prospektus WHERE id = $1',
      [id]
    );
    const prospect = prospectResult.rows[0];
    if (!prospect) {
      throw new ApiError('VALIDATION_ERROR', 'Sebagian peserta tidak ditemukan');
    }
    if (!prospect.is_active) {
      throw new ApiError('VALIDATION_ERROR', 'Sebagian peserta tidak aktif');
    }
    let targetId = id;
    if (prospect.bergabung) {
      const converted = await client.query(
        `SELECT id FROM siswa
         WHERE is_active = true AND jenis = $1 AND (
             ($2::text IS NOT NULL AND lower(email) = lower($2))
             OR (nama = $3 AND $4::timestamptz IS NOT NULL
                 AND created_at BETWEEN $4 - interval '5 minutes' AND $4 + interval '5 minutes')
         )
         ORDER BY CASE WHEN $2::text IS NOT NULL AND lower(email) = lower($2) THEN 0 ELSE 1 END, id DESC
         LIMIT 1`,
        ['siswa', prospect.email, prospect.nama, prospect.bergabung_at]
      );
      if (converted.rows[0]) targetId = Number(converted.rows[0].id);
    }
    resolved.push(targetId);
  }
  return [...new Set(resolved)];
}

tryoutRouter.get('/tryouts', adminOnly, asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT id FROM tryout_events ORDER BY starts_at DESC, id DESC'
  );
  const tryouts = [];
  for (const row of rows) {
    const event = await loadEvent(null, Number(row.id));
    if (!event) continue;
    tryouts.push({
      ...event,
      id: event.sessions.length === 1 ? event.sessions[0].id : event.event_id
    });
  }
  res.json({ ok: true, data: { tryouts }, meta: nowMeta() });
}));

tryoutRouter.get('/tryouts/:id', adminOnly, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const eventId = await eventIdFor(query, id);
  if (eventId === null) throw new ApiError('NOT_FOUND', 'Tryout tidak ditemukan', 404);
  const tryout = await loadEvent(null, eventId, id);
  res.json({ ok: true, data: { tryout }, meta: nowMeta() });
}));

tryoutRouter.get('/tryouts/:id/sessions', adminOnly, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const eventId = await eventIdFor(query, id);
  if (eventId === null) throw new ApiError('NOT_FOUND', 'Tryout tidak ditemukan', 404);
  const event = await loadEvent(null, eventId, id);
  res.json({
    ok: true,
    data: { tryout_event_id: event.event_id, sessions: event.sessions },
    meta: nowMeta()
  });
}));

tryoutRouter.patch('/tryouts/:id', adminOnly, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const body = req.body ?? {};
  const allowed = new Set(['name', 'starts_at', 'ends_at']);
  const disallowed = Object.keys(body).filter((key) => !allowed.has(key));
  if (disallowed.length > 0) {
    throw new ApiError(
      'VALIDATION_ERROR',
      `Hanya nama dan jadwal yang dapat diubah; field tidak didukung: ${disallowed.join(', ')}`
    );
  }
  const name = requireName(body.name);
  const startsAt = requireTimestamp(body.starts_at, 'starts_at');
  const endsAt = requireTimestamp(body.ends_at, 'ends_at');
  if (Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new ApiError('VALIDATION_ERROR', 'ends_at harus setelah starts_at');
  }
  const tryout = await withTransaction(async (client) => {
    const found = await client.query('SELECT id FROM tryout_events WHERE id = $1', [id]);
    if (!found.rows[0]) throw new ApiError('NOT_FOUND', 'Tryout tidak ditemukan', 404);
    await client.query(
      `UPDATE tryout_events
          SET name = $2, starts_at = $3, ends_at = $4, updated_at = now()
        WHERE id = $1`,
      [id, name, startsAt, endsAt]
    );
    return loadEvent(client, id, id);
  });
  res.json({ ok: true, data: { tryout }, meta: nowMeta() });
}));

tryoutRouter.get('/tryouts/:id/questions.zip', adminOnly, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { event, buffer } = await exportTryoutQuestions(id, false);
  return zipResponse(res, buffer, event, false);
}));

tryoutRouter.get('/tryouts/:id/questions-with-keys.zip', keyExportOnly, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { event, buffer } = await exportTryoutQuestions(id, true);
  return zipResponse(res, buffer, event, true);
}));

tryoutRouter.patch('/tryouts/:id/cbt', adminOnly, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const settings = normalizeCbtSettings(req.body);
  const result = await withTransaction(async (client) => {
    const sessionIds = await sessionIdsFor(client.query.bind(client), id);
    if (sessionIds.length === 0) throw new ApiError('NOT_FOUND', 'Tryout tidak ditemukan', 404);
    for (const sessionId of sessionIds) {
      await client.query(
        `UPDATE tryout_sessions
            SET cbt_enabled = $2, cbt_duration_minutes = $3, cbt_shuffle_questions = $4,
                cbt_shuffle_options = $5, cbt_require_fullscreen = $6, cbt_max_violations = $7
          WHERE id = $1`,
        [sessionId, settings.enabled, settings.duration, settings.shuffleQuestions,
          settings.shuffleOptions, settings.requireFullscreen, settings.maxViolations]
      );
    }
    const eventId = await eventIdFor(client.query.bind(client), id);
    return loadEvent(client, eventId, id);
  });
  res.json({ ok: true, data: { tryout: result }, meta: nowMeta() });
}));

tryoutRouter.get('/tryouts/:id/participants', adminOnly, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const sessionIds = await sessionIdsFor(query, id);
  if (sessionIds.length === 0) throw new ApiError('NOT_FOUND', 'Tryout tidak ditemukan', 404);
  const { rows } = await query(
    `SELECT DISTINCT p.id, p.nama, p.jenis, p.email, p.kelas, p.sekolah, p.username,
             p.password_plain, p.pin_plain, p.is_active, p.created_at, p.updated_at,
            (SELECT count(*)::int FROM tryout_submissions ts
             WHERE ts.participant_id = p.id AND ts.session_id = ANY($1::bigint[])) AS submission_count
     FROM tryout_session_participants sp
     JOIN tryout_participants p ON p.id = sp.participant_id
     WHERE sp.session_id = ANY($1::bigint[])
     ORDER BY p.id DESC`,
    [sessionIds]
  );
  res.json({ ok: true, data: { tryout_id: id, participants: rows }, meta: nowMeta() });
}));

tryoutRouter.delete('/tryouts/:id', adminOnly, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const removed = await withTransaction(async (client) => {
    const run = client.query.bind(client);
    const eventId = await eventIdFor(run, id);
    if (eventId === null) throw new ApiError('NOT_FOUND', 'Tryout tidak ditemukan', 404);
    const sessionIds = await sessionIdsFor(run, id);
    for (const sessionId of sessionIds) {
      await client.query('DELETE FROM auth_sessions WHERE tryout_session_id = $1', [sessionId]);
    }
    if (eventId === id || sessionIds.length === 0) {
      await client.query('DELETE FROM tryout_events WHERE id = $1', [eventId]);
    } else {
      await client.query('DELETE FROM tryout_sessions WHERE id = $1', [id]);
      const remaining = await client.query(
        'SELECT 1 FROM tryout_sessions WHERE event_id = $1 LIMIT 1',
        [eventId]
      );
      if (!remaining.rows[0]) await client.query('DELETE FROM tryout_events WHERE id = $1', [eventId]);
    }
    return { tryout_id: id, deleted: true, session_ids: sessionIds };
  });
  res.json({ ok: true, data: removed, meta: nowMeta() });
}));

tryoutRouter.delete('/tryouts/:id/participants/:participantId', adminOnly, asyncHandler(async (req, res) => {
  const tryoutId = parseId(req.params.id);
  const participantId = parseId(req.params.participantId, 'participant_id');

  const result = await withTransaction(async (client) => {
    const run = client.query.bind(client);
    const sessionIds = await sessionIdsFor(run, tryoutId);
    if (sessionIds.length === 0) throw new ApiError('NOT_FOUND', 'Tryout tidak ditemukan', 404);

    const foundParticipant = await client.query(
      `SELECT id, nama, jenis FROM tryout_participants WHERE id = $1`,
      [participantId]
    );
    const participant = foundParticipant.rows[0];
    if (!participant) throw new ApiError('NOT_FOUND', 'Peserta tidak ditemukan', 404);

    const removed = await client.query(
      `DELETE FROM tryout_session_participants
       WHERE session_id = ANY($1::bigint[]) AND participant_id = $2`,
      [sessionIds, participantId]
    );
    if (removed.rowCount === 0) {
      throw new ApiError('NOT_FOUND', 'Peserta tidak terlampir pada tryout ini', 404);
    }

    let prospek = false;
    if (participant.jenis === 'umum') {
      await client.query(
        `UPDATE prospektus
         SET is_active = false, prospek = true, prospek_at = now()
         WHERE id = $1`,
        [participantId]
      );
      await client.query(
        `UPDATE auth_sessions SET revoked_at = now()
         WHERE participant_id = $1 AND revoked_at IS NULL`,
        [participantId]
      );
      prospek = true;
    }

    const updated = await client.query(
      `SELECT id, nama, jenis, is_active, prospek, prospek_at
       FROM tryout_participants WHERE id = $1`,
      [participantId]
    );
    return { participant: updated.rows[0], prospek, removed: true };
  });

  res.json({ ok: true, data: result, meta: nowMeta() });
}));

tryoutRouter.post('/tryouts/:id/participants', adminOnly, asyncHandler(async (req, res) => {
  const tryoutId = parseId(req.params.id);
  const participantIds = await withTransaction(async (client) =>
    resolveParticipantIds(client, req.body?.participant_ids)
  );

  const result = await withTransaction(async (client) => {
    const run = client.query.bind(client);
    const sessionIds = await sessionIdsFor(run, tryoutId);
    if (sessionIds.length === 0) throw new ApiError('NOT_FOUND', 'Tryout tidak ditemukan', 404);
    const inserted = [];
    for (const sessionId of sessionIds) {
      const rows = await client.query(
        `INSERT INTO tryout_session_participants (session_id, participant_id)
         SELECT $1, item FROM unnest($2::bigint[]) AS t(item)
         ON CONFLICT (session_id, participant_id) DO NOTHING
         RETURNING participant_id`,
        [sessionId, participantIds]
      );
      inserted.push(...rows.rows.map((row) => Number(row.participant_id)));
    }
    const eventId = await eventIdFor(run, tryoutId);
    const tryout = await loadEvent(client, eventId, tryoutId);
    return {
      tryout,
      added_ids: [...new Set(inserted)],
      participant_ids: tryout.participant_ids
    };
  });

  res.json({ ok: true, data: result, meta: nowMeta() });
}));

tryoutRouter.post('/tryouts', adminOnly, asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const name = requireName(body.name);
  const jenjangCode = requireJenjangCode(body.jenjang ?? body.jenjang_kode);
  const schedule = normalizeSessionDefinitions(body, name);
  const participantIds = optionalIds(body.participant_ids, 'participant_ids');
  const activate = Boolean(body.is_active);

  const tryout = await withTransaction(async (client) => {
    const run = client.query.bind(client);
    const jenjangId = await resolveJenjangId(client, jenjangCode);
    const codes = schedule.definitions.map((definition) => definition.mapelCode);
    if (new Set(codes).size !== codes.length) {
      throw new ApiError('VALIDATION_ERROR', 'Setiap sesi harus memakai mapel yang berbeda');
    }
    const mapelResult = await client.query(
      'SELECT id, code FROM mapels WHERE code = ANY($1::text[]) AND is_active = true',
      [codes]
    );
    if (mapelResult.rows.length !== codes.length) {
      throw new ApiError('VALIDATION_ERROR', 'Mapel tidak ditemukan atau tidak aktif');
    }
    const mapelByCode = new Map(mapelResult.rows.map((row) => [row.code, Number(row.id)]));
    const allowedMapelIds = new Set(mapelByCode.values());
    const resolved = [];
    for (const definition of schedule.definitions) {
      const mapelId = mapelByCode.get(definition.mapelCode);
      let sheetIds = definition.sheetIds;
      let questionIds = definition.questionIds;
      if (definition.distributeByMapel) {
        if (definition.hasSheets) {
          const sheetRows = await client.query(
            'SELECT id, mapel_id, jenjang_id, archived FROM question_sheets WHERE id = ANY($1::bigint[])',
            [sheetIds]
          );
          if (sheetRows.rows.length !== sheetIds.length
            || sheetRows.rows.some((row) => row.archived || !allowedMapelIds.has(Number(row.mapel_id))
              || Number(row.jenjang_id) !== Number(jenjangId))) {
            throw new ApiError(
              'VALIDATION_ERROR',
              'Sebagian lembar soal tidak ditemukan, diarsipkan, bukan mapel, atau bukan jenjang terpilih'
            );
          }
          sheetIds = sheetRows.rows
            .filter((row) => Number(row.mapel_id) === mapelId)
            .map((row) => Number(row.id));
        } else {
          const questionRows = await client.query(
            'SELECT id, mapel_id, jenjang_id, status FROM questions WHERE id = ANY($1::bigint[])',
            [questionIds]
          );
          if (questionRows.rows.length !== questionIds.length
            || questionRows.rows.some((row) => row.status !== 'approved'
              || !allowedMapelIds.has(Number(row.mapel_id))
              || Number(row.jenjang_id) !== Number(jenjangId))) {
            throw new ApiError(
              'VALIDATION_ERROR',
              'Sebagian soal tidak ditemukan, tidak approved, bukan mapel atau jenjang terpilih'
            );
          }
          questionIds = questionRows.rows
            .filter((row) => Number(row.mapel_id) === mapelId)
            .map((row) => Number(row.id));
        }
      }
      if (definition.hasSheets) {
        const sheets = await client.query(
          `SELECT sh.id FROM question_sheets sh
           WHERE sh.id = ANY($1::bigint[]) AND sh.archived = false AND sh.mapel_id = $2
             AND sh.jenjang_id = $3`,
          [sheetIds, mapelId, jenjangId]
        );
        if (sheets.rows.length !== sheetIds.length) {
          throw new ApiError(
            'VALIDATION_ERROR',
            'Sebagian lembar soal tidak ditemukan, diarsipkan, bukan mapel, atau bukan jenjang sesi ini'
          );
        }
        const expanded = await client.query(
          `SELECT DISTINCT qsq.question_id
           FROM question_sheet_questions qsq
           JOIN questions q ON q.id = qsq.question_id
           WHERE qsq.sheet_id = ANY($1::bigint[]) AND q.status <> 'archived'
             AND q.jenjang_id = $2
           ORDER BY qsq.question_id`,
          [sheetIds, jenjangId]
        );
        questionIds = expanded.rows.map((row) => Number(row.question_id));
        if (questionIds.length === 0 && sheetIds.length > 0) {
          throw new ApiError('VALIDATION_ERROR', 'Lembar soal terpilih tidak memiliki soal aktif');
        }
      } else {
        const questions = await client.query(
          `SELECT id FROM questions
           WHERE id = ANY($1::bigint[]) AND status = 'approved' AND mapel_id = $2
             AND jenjang_id = $3`,
          [questionIds, mapelId, jenjangId]
        );
        if (questions.rows.length !== questionIds.length) {
          throw new ApiError(
            'VALIDATION_ERROR',
            'Sebagian soal tidak ditemukan, tidak approved, bukan mapel, atau bukan jenjang sesi ini'
          );
        }
      }
      resolved.push({ ...definition, sheetIds, mapelId, questionIds });
    }

    const participants = await resolveParticipantIds(client, participantIds);
    if (activate) {
      await client.query('UPDATE tryout_sessions SET is_active = false WHERE is_active');
    }

    const insertedEvent = await client.query(
      `INSERT INTO tryout_events (name, slug, jenjang_id, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name, temporarySlug('event'), jenjangId, schedule.startsAt, schedule.endsAt]
    );
    const eventId = Number(insertedEvent.rows[0].id);
    const eventSlug = generateTryoutSlug(name, eventId);
    const slugTaken = await client.query(
      'SELECT id FROM tryout_events WHERE slug = $1 AND id <> $2',
      [eventSlug, eventId]
    );
    if (slugTaken.rows[0]) {
      throw new ApiError('VALIDATION_ERROR', 'slug tryout sudah digunakan');
    }
    await client.query('UPDATE tryout_events SET slug = $2 WHERE id = $1', [eventId, eventSlug]);

    const sessionIds = [];
    for (let index = 0; index < resolved.length; index += 1) {
      const definition = resolved[index];
      const startAt = definition.startAt ?? schedule.startsAt;
      const endAt = definition.endAt ?? schedule.endsAt;
      if (Date.parse(endAt) <= Date.parse(startAt)) {
        throw new ApiError('VALIDATION_ERROR', 'end_at harus setelah start_at');
      }
      if (Date.parse(startAt) < Date.parse(schedule.startsAt)
        || Date.parse(endAt) > Date.parse(schedule.endsAt)) {
        throw new ApiError('VALIDATION_ERROR', 'Jadwal sesi harus berada dalam rentang tryout');
      }
      const insertedSession = await client.query(
        `INSERT INTO tryout_sessions
           (name, slug, session_date, start_at, end_at, mapel_id, is_active,
            cbt_enabled, cbt_duration_minutes, cbt_shuffle_questions,
            cbt_shuffle_options, cbt_require_fullscreen, cbt_max_violations, event_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id`,
        [definition.name, temporarySlug(), jakartaDate(startAt), startAt, endAt,
          definition.mapelId, activate && index === 0,
          definition.cbt.enabled, definition.cbt.duration,
          definition.cbt.shuffleQuestions, definition.cbt.shuffleOptions,
          definition.cbt.requireFullscreen, definition.cbt.maxViolations, eventId]
      );
      const sessionId = Number(insertedSession.rows[0].id);
      const sessionSlug = generateTryoutSlug(definition.name, sessionId);
      const sessionSlugTaken = await client.query(
        'SELECT id FROM tryout_sessions WHERE slug = $1 AND id <> $2',
        [sessionSlug, sessionId]
      );
      if (sessionSlugTaken.rows[0]) {
        throw new ApiError('VALIDATION_ERROR', 'slug sesi sudah digunakan');
      }
      await client.query('UPDATE tryout_sessions SET slug = $2 WHERE id = $1', [sessionId, sessionSlug]);

      await client.query(
        `INSERT INTO tryout_session_mapels (session_id, mapel_id)
         VALUES ($1, $2) ON CONFLICT (session_id, mapel_id) DO NOTHING`,
        [sessionId, definition.mapelId]
      );
      if (definition.hasSheets) {
        await client.query(
          `INSERT INTO tryout_session_sheets (session_id, sheet_id)
           SELECT $1, item FROM unnest($2::bigint[]) AS t(item)`,
          [sessionId, definition.sheetIds]
        );
      }
      await client.query(
        `INSERT INTO tryout_session_questions (session_id, question_id, position)
         SELECT $1, item, ordinal - 1
         FROM unnest($2::bigint[]) WITH ORDINALITY AS t(item, ordinal)`,
        [sessionId, definition.questionIds]
      );
      if (participants.length > 0) {
        await client.query(
          `INSERT INTO tryout_session_participants (session_id, participant_id)
           SELECT $1, item FROM unnest($2::bigint[]) AS t(item)`,
          [sessionId, participants]
        );
      }
      sessionIds.push(sessionId);
    }

    return loadEvent(client, eventId, schedule.isLegacy ? sessionIds[0] : eventId);
  });

  res.status(201).json({ ok: true, data: { tryout }, meta: nowMeta() });
}));
