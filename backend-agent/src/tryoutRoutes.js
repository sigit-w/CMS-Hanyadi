import { Router } from 'express';
import { query, withTransaction } from './db.js';
import { ApiError, asyncHandler } from './errors.js';
import { parseId, requireMapelCode } from './validate.js';
import { authorize } from './authMiddleware.js';

export const tryoutRouter = Router();

const nowMeta = () => ({ ts: new Date().toISOString() });
const adminOnly = authorize('tryouts.manage');

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

async function loadTryout(client, id) {
  const run = client?.query ? client.query.bind(client) : query;
  const { rows } = await run(
    `SELECT s.id, s.name, s.session_date, s.start_at, s.end_at, s.is_active,
            m.id AS mapel_id, m.code AS mapel_code, m.name AS mapel_name,
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
    `SELECT s.id, s.name, s.session_date, s.start_at, s.end_at, s.is_active,
            m.id AS mapel_id, m.code AS mapel_code, m.name AS mapel_name,
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

tryoutRouter.delete('/tryouts/:id', adminOnly, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await withTransaction(async (client) => {
    const found = await client.query('SELECT id FROM tryout_sessions WHERE id = $1', [id]);
    if (!found.rows[0]) throw new ApiError('NOT_FOUND', 'Tryout tidak ditemukan', 404);
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
  const mapelCode = requireMapelCode(req.body?.mapel_code ?? req.body?.mapel);
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

  const tryout = await withTransaction(async (client) => {
    const mapel = await client.query(
      'SELECT id FROM mapels WHERE code = $1 AND is_active = true',
      [mapelCode]
    );
    if (!mapel.rows[0]) {
      throw new ApiError('VALIDATION_ERROR', 'Mapel tidak ditemukan atau tidak aktif');
    }
    const mapelId = mapel.rows[0].id;

    let resolvedQuestionIds = questionIds;
    if (hasSheets) {
      const sheets = await client.query(
        `SELECT sh.id FROM question_sheets sh
         JOIN mapels m ON m.id = sh.mapel_id
         WHERE sh.id = ANY($1::bigint[]) AND sh.archived = false AND m.code = $2`,
        [sheetIds, mapelCode]
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
         WHERE id = ANY($1::bigint[]) AND mapel_id = $2 AND status <> 'archived'`,
        [questionIds, mapelId]
      );
      if (questions.rows.length !== questionIds.length) {
        throw new ApiError('VALIDATION_ERROR', 'Sebagian soal tidak ditemukan, diarsipkan, atau bukan mapel terpilih');
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
      `INSERT INTO tryout_sessions (name, session_date, start_at, end_at, mapel_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [name, sessionDate, startAt, endAt, mapelId, activate]
    );
    const tryoutId = inserted.rows[0].id;

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
