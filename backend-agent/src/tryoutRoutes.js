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

function requireIds(value, field) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError('VALIDATION_ERROR', `${field} wajib berisi minimal satu ID`);
  }
  if (value.length > 200) {
    throw new ApiError('VALIDATION_ERROR', `${field} maksimal 200 ID`);
  }
  return [...new Set(value.map((item) => parseId(item, field)))];
}

async function loadTryout(client, id) {
  const run = client?.query ? client.query.bind(client) : query;
  const { rows } = await run(
    `SELECT s.id, s.name, s.session_date, s.is_active,
            m.id AS mapel_id, m.code AS mapel_code, m.name AS mapel_name,
            (SELECT coalesce(array_agg(tq.question_id ORDER BY tq.position, tq.question_id), '{}'::bigint[])
             FROM tryout_session_questions tq WHERE tq.session_id = s.id) AS question_ids,
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
    `SELECT s.id, s.name, s.session_date, s.is_active,
            m.id AS mapel_id, m.code AS mapel_code, m.name AS mapel_name,
            (SELECT count(*)::int FROM tryout_session_questions tq WHERE tq.session_id = s.id) AS question_count,
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

tryoutRouter.post('/tryouts', adminOnly, asyncHandler(async (req, res) => {
  const name = requireName(req.body?.name);
  const sessionDate = requireDate(req.body?.session_date);
  const mapelCode = requireMapelCode(req.body?.mapel_code ?? req.body?.mapel);
  const questionIds = requireIds(req.body?.question_ids, 'question_ids');
  const participantIds = requireIds(req.body?.participant_ids, 'participant_ids');
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

    const questions = await client.query(
      `SELECT id FROM questions
       WHERE id = ANY($1::bigint[]) AND mapel_id = $2 AND status <> 'archived'`,
      [questionIds, mapelId]
    );
    if (questions.rows.length !== questionIds.length) {
      throw new ApiError('VALIDATION_ERROR', 'Sebagian soal tidak ditemukan, diarsipkan, atau bukan mapel terpilih');
    }

    const participants = await client.query(
      `SELECT id FROM tryout_participants
       WHERE id = ANY($1::bigint[]) AND is_active = true`,
      [participantIds]
    );
    if (participants.rows.length !== participantIds.length) {
      throw new ApiError('VALIDATION_ERROR', 'Sebagian peserta tidak ditemukan atau tidak aktif');
    }

    if (activate) {
      await client.query('UPDATE tryout_sessions SET is_active = false WHERE is_active');
    }
    const inserted = await client.query(
      `INSERT INTO tryout_sessions (name, session_date, mapel_id, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [name, sessionDate, mapelId, activate]
    );
    const tryoutId = inserted.rows[0].id;

    await client.query(
      `INSERT INTO tryout_session_questions (session_id, question_id, position)
       SELECT $1, item, ordinal - 1
       FROM unnest($2::bigint[]) WITH ORDINALITY AS t(item, ordinal)`,
      [tryoutId, questionIds]
    );
    await client.query(
      `INSERT INTO tryout_session_participants (session_id, participant_id)
       SELECT $1, item FROM unnest($2::bigint[]) AS t(item)`,
      [tryoutId, participantIds]
    );

    return loadTryout(client, tryoutId);
  });

  res.status(201).json({ ok: true, data: { tryout }, meta: nowMeta() });
}));
