import crypto from 'node:crypto';
import { Router } from 'express';
import { query, withTransaction } from './db.js';
import { ApiError, asyncHandler } from './errors.js';
import { parseId, requireMapelCode, requireMapelCodes } from './validate.js';
import { authorize } from './authMiddleware.js';
import { normalizeTryoutSlug, generateTryoutSlug } from './auth.js';

export const tryoutRouter = Router();

const nowMeta = () => ({ ts: new Date().toISOString() });
const adminOnly = authorize('tryouts.manage');

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

function temporarySlug() {
  return `tmp-${crypto.randomBytes(12).toString('hex')}`;
}

function requireName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 128) {
    throw new ApiError('VALIDATION_ERROR', 'nama tryout wajib diisi maksimal 128 karakter');
  }
  return value.trim();
}

function optionalSlug(value) {
  if (value === undefined || value === null || value === '') return null;
  try {
    return normalizeTryoutSlug(value, 'slug');
  } catch {
    throw new ApiError('VALIDATION_ERROR', 'slug tidak valid atau termasuk kata yang dicadangkan');
  }
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

const tryoutMapelsJson = `(SELECT coalesce(jsonb_agg(jsonb_build_object(
                                'id', jm.id, 'code', jm.code, 'name', jm.name
                              ) ORDER BY jm.code), '[]'::jsonb)
                            FROM tryout_session_mapels tsm
                            JOIN mapels jm ON jm.id = tsm.mapel_id
                            WHERE tsm.session_id = s.id) AS mapels`;

async function loadTryout(client, id) {
  const run = client?.query ? client.query.bind(client) : query;
  const { rows } = await run(
    `SELECT s.id, s.name, s.slug, s.session_date, s.start_at, s.end_at, s.is_active,
             s.cbt_enabled, s.cbt_duration_minutes, s.cbt_shuffle_questions,
             s.cbt_shuffle_options, s.cbt_require_fullscreen, s.cbt_max_violations,
             m.id AS mapel_id, m.code AS mapel_code, m.name AS mapel_name,
             ${tryoutMapelsJson},
             (SELECT coalesce(array_agg(tq.question_id ORDER BY tq.position, tq.question_id), '{}'::bigint[])
             FROM tryout_session_questions tq WHERE tq.session_id = s.id) AS question_ids,
            (SELECT coalesce(array_agg(tss.sheet_id ORDER BY tss.sheet_id), '{}'::bigint[])
             FROM tryout_session_sheets tss WHERE tss.session_id = s.id) AS sheet_ids,
            (SELECT coalesce(array_agg(tp.participant_id ORDER BY tp.participant_id), '{}'::bigint[])
             FROM tryout_session_participants tp WHERE tp.session_id = s.id) AS participant_ids,
            (SELECT count(*)::int FROM tryout_submissions ts WHERE ts.session_id = s.id) AS submission_count
     FROM tryout_sessions s
     LEFT JOIN mapels m ON m.id = s.mapel_id
     WHERE s.id = $1`,
    [id]
  );
  return rows[0];
}

tryoutRouter.get('/tryouts', adminOnly, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT s.id, s.name, s.slug, s.session_date, s.start_at, s.end_at, s.is_active,
             s.cbt_enabled, s.cbt_duration_minutes, s.cbt_shuffle_questions,
             s.cbt_shuffle_options, s.cbt_require_fullscreen, s.cbt_max_violations,
             m.id AS mapel_id, m.code AS mapel_code, m.name AS mapel_name,
             ${tryoutMapelsJson},
             (SELECT count(*)::int FROM tryout_session_questions tq WHERE tq.session_id = s.id) AS question_count,
            (SELECT count(*)::int FROM tryout_session_sheets tss WHERE tss.session_id = s.id) AS sheet_count,
            (SELECT count(*)::int FROM tryout_session_participants tp WHERE tp.session_id = s.id) AS participant_count,
            (SELECT count(*)::int FROM tryout_submissions ts WHERE ts.session_id = s.id) AS submission_count
     FROM tryout_sessions s
     LEFT JOIN mapels m ON m.id = s.mapel_id
      GROUP BY s.id, m.id
     ORDER BY s.is_active DESC, s.session_date DESC, s.id DESC`
  );
  res.json({ ok: true, data: { tryouts: rows }, meta: nowMeta() });
}));

tryoutRouter.get('/tryouts/:id', adminOnly, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const tryout = await loadTryout(null, id);
  if (!tryout) throw new ApiError('NOT_FOUND', 'Tryout tidak ditemukan', 404);
  res.json({ ok: true, data: { tryout }, meta: nowMeta() });
}));

tryoutRouter.patch('/tryouts/:id/cbt', adminOnly, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const settings = normalizeCbtSettings(req.body);
  const existing = await query('SELECT id FROM tryout_sessions WHERE id = $1', [id]);
  if (!existing.rows[0]) throw new ApiError('NOT_FOUND', 'Tryout tidak ditemukan', 404);
  await query(
    `UPDATE tryout_sessions
        SET cbt_enabled = $2, cbt_duration_minutes = $3, cbt_shuffle_questions = $4,
            cbt_shuffle_options = $5, cbt_require_fullscreen = $6, cbt_max_violations = $7
      WHERE id = $1`,
    [id, settings.enabled, settings.duration, settings.shuffleQuestions,
      settings.shuffleOptions, settings.requireFullscreen, settings.maxViolations]
  );
  const tryout = await loadTryout(null, id);
  res.json({ ok: true, data: { tryout }, meta: nowMeta() });
}));

tryoutRouter.get('/tryouts/:id/participants', adminOnly, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const found = await query('SELECT id FROM tryout_sessions WHERE id = $1', [id]);
  if (!found.rows[0]) throw new ApiError('NOT_FOUND', 'Tryout tidak ditemukan', 404);
  const { rows } = await query(
    `SELECT p.id, p.nama, p.jenis, p.email, p.kelas, p.sekolah, p.is_active,
            p.created_at, p.updated_at,
            (SELECT count(*)::int FROM tryout_submissions ts
             WHERE ts.participant_id = p.id AND ts.session_id = $1) AS submission_count
     FROM tryout_session_participants sp
     JOIN tryout_participants p ON p.id = sp.participant_id
     WHERE sp.session_id = $1
     ORDER BY p.id DESC`,
    [id]
  );
  res.json({ ok: true, data: { tryout_id: id, participants: rows }, meta: nowMeta() });
}));

tryoutRouter.delete('/tryouts/:id', adminOnly, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await withTransaction(async (client) => {
    const found = await client.query('SELECT id FROM tryout_sessions WHERE id = $1', [id]);
    if (!found.rows[0]) throw new ApiError('NOT_FOUND', 'Tryout tidak ditemukan', 404);
    await client.query('DELETE FROM auth_sessions WHERE tryout_session_id = $1', [id]);
    await client.query('DELETE FROM tryout_sessions WHERE id = $1', [id]);
  });
  res.json({ ok: true, data: { tryout_id: id, deleted: true }, meta: nowMeta() });
}));

tryoutRouter.delete('/tryouts/:id/participants/:participantId', adminOnly, asyncHandler(async (req, res) => {
  const tryoutId = parseId(req.params.id);
  const participantId = parseId(req.params.participantId, 'participant_id');

  const result = await withTransaction(async (client) => {
    const foundTryout = await client.query('SELECT id FROM tryout_sessions WHERE id = $1', [tryoutId]);
    if (!foundTryout.rows[0]) throw new ApiError('NOT_FOUND', 'Tryout tidak ditemukan', 404);

    const foundParticipant = await client.query(
      `SELECT id, nama, jenis FROM tryout_participants WHERE id = $1`,
      [participantId]
    );
    const participant = foundParticipant.rows[0];
    if (!participant) throw new ApiError('NOT_FOUND', 'Peserta tidak ditemukan', 404);

    const removed = await client.query(
      `DELETE FROM tryout_session_participants
       WHERE session_id = $1 AND participant_id = $2`,
      [tryoutId, participantId]
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
  const participantIds = requireIds(req.body?.participant_ids, 'participant_ids');

  const result = await withTransaction(async (client) => {
    const foundTryout = await client.query('SELECT id FROM tryout_sessions WHERE id = $1', [tryoutId]);
    if (!foundTryout.rows[0]) throw new ApiError('NOT_FOUND', 'Tryout tidak ditemukan', 404);

    const participants = await client.query(
      `SELECT id FROM tryout_participants
       WHERE id = ANY($1::bigint[]) AND is_active = true AND prospek = false`,
      [participantIds]
    );
    if (participants.rows.length !== participantIds.length) {
      throw new ApiError('VALIDATION_ERROR', 'Sebagian peserta tidak ditemukan, tidak aktif, atau berstatus prospek');
    }

    const inserted = await client.query(
      `INSERT INTO tryout_session_participants (session_id, participant_id)
       SELECT $1, item FROM unnest($2::bigint[]) AS t(item)
       ON CONFLICT (session_id, participant_id) DO NOTHING
       RETURNING participant_id`,
      [tryoutId, participantIds]
    );
    const tryout = await loadTryout(client, tryoutId);
    return {
      tryout,
      added_ids: inserted.rows.map((row) => Number(row.participant_id)),
      participant_ids: tryout.participant_ids.map(Number)
    };
  });

  res.json({ ok: true, data: result, meta: nowMeta() });
}));

tryoutRouter.post('/tryouts', adminOnly, asyncHandler(async (req, res) => {
  const name = requireName(req.body?.name);
  const requestedSlug = optionalSlug(req.body?.slug);
  const mapelCodes = resolveMapelCodes(req.body);
  const hasSchedule = req.body?.start_at !== undefined || req.body?.end_at !== undefined;

  let sessionDate;
  let startAt;
  let endAt;
  if (hasSchedule) {
    startAt = requireTimestamp(req.body?.start_at, 'start_at');
    endAt = requireTimestamp(req.body?.end_at, 'end_at');
    if (Date.parse(endAt) <= Date.parse(startAt)) {
      throw new ApiError('VALIDATION_ERROR', 'end_at harus setelah start_at');
    }
    sessionDate = jakartaDate(startAt);
  } else {
    sessionDate = requireDate(req.body?.session_date);
    const range = legacyRange(sessionDate);
    startAt = range.startAt;
    endAt = range.endAt;
  }

  const hasSheets = req.body?.sheet_ids !== undefined && req.body?.sheet_ids !== null;
  const sheetIds = hasSheets ? requireIds(req.body.sheet_ids, 'sheet_ids') : [];
  const questionIds = hasSheets ? [] : requireIds(req.body?.question_ids, 'question_ids');
  const participantIds = optionalIds(req.body?.participant_ids, 'participant_ids');
  const activate = Boolean(req.body?.is_active);
  const cbt = normalizeCbtSettings(req.body);

  const tryout = await withTransaction(async (client) => {
    const mapels = await client.query(
      `SELECT id, code FROM mapels
       WHERE code = ANY($1::text[]) AND is_active = true`,
      [mapelCodes]
    );
    if (mapels.rows.length !== mapelCodes.length) {
      throw new ApiError('VALIDATION_ERROR', 'Mapel tidak ditemukan atau tidak aktif');
    }
    const mapelByIdCode = new Map(mapels.rows.map((row) => [row.code, Number(row.id)]));
    const mapelIds = mapelCodes.map((code) => mapelByIdCode.get(code));
    const mapelId = mapelIds[0];

    let resolvedQuestionIds = questionIds;
    if (hasSheets) {
      const sheets = await client.query(
        `SELECT sh.id FROM question_sheets sh
         WHERE sh.id = ANY($1::bigint[]) AND sh.archived = false
           AND sh.mapel_id = ANY($2::bigint[])`,
        [sheetIds, mapelIds]
      );
      if (sheets.rows.length !== sheetIds.length) {
        throw new ApiError('VALIDATION_ERROR', 'Sebagian lembar soal tidak ditemukan, diarsipkan, atau bukan mapel terpilih');
      }
      const expanded = await client.query(
        `SELECT DISTINCT qsq.question_id
         FROM question_sheet_questions qsq
         JOIN questions q ON q.id = qsq.question_id
         WHERE qsq.sheet_id = ANY($1::bigint[]) AND q.status <> 'archived'
         ORDER BY qsq.question_id`,
        [sheetIds]
      );
      resolvedQuestionIds = expanded.rows.map((row) => Number(row.question_id));
      if (resolvedQuestionIds.length === 0) {
        throw new ApiError('VALIDATION_ERROR', 'Lembar soal terpilih tidak memiliki soal aktif');
      }
    } else {
      const questions = await client.query(
        `SELECT id FROM questions
         WHERE id = ANY($1::bigint[]) AND status = 'approved'
           AND mapel_id = ANY($2::bigint[])`,
        [questionIds, mapelIds]
      );
      if (questions.rows.length !== questionIds.length) {
        throw new ApiError('VALIDATION_ERROR', 'Sebagian soal tidak ditemukan, tidak approved, atau bukan mapel terpilih');
      }
    }

    if (participantIds.length > 0) {
      const participants = await client.query(
        `SELECT id FROM tryout_participants
         WHERE id = ANY($1::bigint[]) AND is_active = true`,
        [participantIds]
      );
      if (participants.rows.length !== participantIds.length) {
        throw new ApiError('VALIDATION_ERROR', 'Sebagian peserta tidak ditemukan atau tidak aktif');
      }
    }

    if (activate) {
      await client.query('UPDATE tryout_sessions SET is_active = false WHERE is_active');
    }
    const inserted = await client.query(
      `INSERT INTO tryout_sessions
         (name, slug, session_date, start_at, end_at, mapel_id, is_active,
          cbt_enabled, cbt_duration_minutes, cbt_shuffle_questions,
          cbt_shuffle_options, cbt_require_fullscreen, cbt_max_violations)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [name, temporarySlug(), sessionDate, startAt, endAt, mapelId, activate,
        cbt.enabled, cbt.duration, cbt.shuffleQuestions, cbt.shuffleOptions,
        cbt.requireFullscreen, cbt.maxViolations]
    );
    const tryoutId = inserted.rows[0].id;
    const resolvedSlug = requestedSlug ?? generateTryoutSlug(name, tryoutId);
    const slugTaken = await client.query(
      'SELECT id FROM tryout_sessions WHERE slug = $1 AND id <> $2',
      [resolvedSlug, tryoutId]
    );
    if (slugTaken.rows[0]) {
      throw new ApiError('VALIDATION_ERROR', 'slug tryout sudah digunakan');
    }
    await client.query('UPDATE tryout_sessions SET slug = $2 WHERE id = $1', [tryoutId, resolvedSlug]);
    await client.query(
      `INSERT INTO tryout_session_mapels (session_id, mapel_id)
       SELECT $1, item FROM unnest($2::bigint[]) AS t(item)
       ON CONFLICT (session_id, mapel_id) DO NOTHING`,
      [tryoutId, mapelIds]
    );

    if (hasSheets) {
      await client.query(
        `INSERT INTO tryout_session_sheets (session_id, sheet_id)
         SELECT $1, item FROM unnest($2::bigint[]) AS t(item)`,
        [tryoutId, sheetIds]
      );
    }
    await client.query(
      `INSERT INTO tryout_session_questions (session_id, question_id, position)
       SELECT $1, item, ordinal - 1
       FROM unnest($2::bigint[]) WITH ORDINALITY AS t(item, ordinal)`,
      [tryoutId, resolvedQuestionIds]
    );
    if (participantIds.length > 0) {
      await client.query(
        `INSERT INTO tryout_session_participants (session_id, participant_id)
         SELECT $1, item FROM unnest($2::bigint[]) AS t(item)`,
        [tryoutId, participantIds]
      );
    }

    return loadTryout(client, tryoutId);
  });

  res.status(201).json({ ok: true, data: { tryout }, meta: nowMeta() });
}));
