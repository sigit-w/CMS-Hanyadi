import { Router } from 'express';
import { query, withTransaction } from './db.js';
import { ApiError, asyncHandler } from './errors.js';
import { parseId } from './validate.js';
import { authorize } from './authMiddleware.js';

export const tryoutReportRouter = Router();

const nowMeta = () => ({ ts: new Date().toISOString() });

function requireSessionName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 128) {
    throw new ApiError('VALIDATION_ERROR', 'nama sesi wajib diisi maksimal 128 karakter');
  }
  return value.trim();
}

function requireSessionDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new ApiError('VALIDATION_ERROR', 'session_date harus berformat YYYY-MM-DD');
  }
  return value;
}

tryoutReportRouter.get('/tryout-sessions', authorize('tryout_reports.read'), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT s.id, s.name, s.session_date, s.is_active, count(ts.id)::int AS submission_count
     FROM tryout_sessions s
     LEFT JOIN tryout_submissions ts ON ts.session_id = s.id
     GROUP BY s.id
     ORDER BY s.session_date DESC, s.id DESC`
  );
  res.json({ ok: true, data: { sessions: rows }, meta: nowMeta() });
}));

tryoutReportRouter.post('/tryout-sessions', authorize('tryout_reports.read'), asyncHandler(async (req, res) => {
  const name = requireSessionName(req.body?.name);
  const sessionDate = requireSessionDate(req.body?.session_date);
  const activate = Boolean(req.body?.is_active);

  const session = await withTransaction(async (client) => {
    if (activate) {
      await client.query('UPDATE tryout_sessions SET is_active = false WHERE is_active');
    }
    const { rows } = await client.query(
      `INSERT INTO tryout_sessions (name, session_date, is_active)
       VALUES ($1, $2, $3)
       RETURNING id, name, session_date, is_active, created_at`,
      [name, sessionDate, activate]
    );
    return rows[0];
  });

  res.status(201).json({ ok: true, data: { session }, meta: nowMeta() });
}));

tryoutReportRouter.patch('/tryout-sessions/:id/activate', authorize('tryout_reports.read'), asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const session = await withTransaction(async (client) => {
    const found = await client.query('SELECT id FROM tryout_sessions WHERE id = $1', [id]);
    if (!found.rows[0]) throw new ApiError('NOT_FOUND', 'Sesi tryout tidak ditemukan', 404);
    await client.query('UPDATE tryout_sessions SET is_active = false WHERE is_active');
    const { rows } = await client.query(
      `UPDATE tryout_sessions SET is_active = true WHERE id = $1
       RETURNING id, name, session_date, is_active`,
      [id]
    );
    return rows[0];
  });
  res.json({ ok: true, data: { session }, meta: nowMeta() });
}));

tryoutReportRouter.get('/reports/tryout', authorize('tryout_reports.read'), asyncHandler(async (req, res) => {
  const sessionId = req.query.session_id ? parseId(req.query.session_id, 'session_id') : null;
  const sessionsQuery = `
    SELECT s.id, s.name, s.session_date, s.is_active, count(ts.id)::int AS submission_count
    FROM tryout_sessions s
    LEFT JOIN tryout_submissions ts ON ts.session_id = s.id
    GROUP BY s.id
    ORDER BY s.session_date DESC, s.id DESC
  `;
  const summaryQuery = `
    SELECT ts.session_id, s.name AS session_name, s.session_date,
           coalesce(tp.id, u.id) AS user_id,
           coalesce(tp.nama, nullif(u.display_name, ''), u.username) AS participant,
           tp.kelas, tp.sekolah,
            m.id AS mapel_id, m.name AS mapel,
           count(*)::int AS total,
           count(*) FILTER (WHERE ts.is_correct)::int AS correct,
           count(*) FILTER (WHERE NOT ts.is_correct)::int AS wrong,
           round(100.0 * count(*) FILTER (WHERE ts.is_correct) / nullif(count(*), 0), 1) AS score
    FROM tryout_submissions ts
    JOIN tryout_sessions s ON s.id = ts.session_id
    LEFT JOIN tryout_participants tp ON tp.id = ts.participant_id
    LEFT JOIN contributors u ON u.id = ts.user_id
    JOIN questions q ON q.id = ts.question_id
    JOIN mapels m ON m.id = q.mapel_id
    WHERE ($1::bigint IS NULL OR ts.session_id = $1)
    GROUP BY ts.session_id, s.id, s.name, s.session_date,
             tp.id, tp.nama, tp.kelas, tp.sekolah, u.id, u.display_name, u.username, m.id, m.name
     ORDER BY s.session_date DESC, s.id DESC, participant, m.name
  `;
  const detailsQuery = `
    SELECT ts.session_id, s.name AS session_name,
           coalesce(tp.id, u.id) AS user_id,
           coalesce(tp.nama, nullif(u.display_name, ''), u.username) AS participant,
           tp.kelas, tp.sekolah,
            m.name AS mapel, q.id AS question_id,
           q.stem AS question, q.image_url,
           ts.answer AS user_answer,
            coalesce(
              nullif((SELECT string_agg(o.option_key, ',' ORDER BY o.position)
                      FROM question_options o
                      WHERE o.question_id = q.id AND o.is_correct), ''),
              ak.answer_text
            ) AS correct_answer,
           coalesce(ts.explanation, ak.explanation) AS explanation,
           ts.is_correct, ts.updated_at AS graded_at
    FROM tryout_submissions ts
    JOIN tryout_sessions s ON s.id = ts.session_id
    LEFT JOIN tryout_participants tp ON tp.id = ts.participant_id
    LEFT JOIN contributors u ON u.id = ts.user_id
    JOIN questions q ON q.id = ts.question_id
    JOIN mapels m ON m.id = q.mapel_id
    LEFT JOIN answer_keys ak ON ak.question_id = q.id
    WHERE ($1::bigint IS NULL OR ts.session_id = $1)
    ORDER BY s.session_date DESC, s.id DESC, participant, m.name, q.id
    LIMIT 500
  `;

  const [sessions, summary, details] = await Promise.all([
    query(sessionsQuery),
    query(summaryQuery, [sessionId]),
    query(detailsQuery, [sessionId])
  ]);

  res.json({
    ok: true,
    data: { sessions: sessions.rows, summary: summary.rows, details: details.rows },
    meta: nowMeta()
  });
}));
