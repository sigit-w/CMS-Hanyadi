import crypto from 'node:crypto';
import { Router } from 'express';
import ExcelJS from 'exceljs';
import { query, withTransaction } from './db.js';
import { ApiError, asyncHandler } from './errors.js';
import { parseId } from './validate.js';
import { authorize } from './authMiddleware.js';
import { generateTryoutSlug } from './auth.js';

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

function legacyRange(sessionDate) {
  return {
    startAt: new Date(`${sessionDate}T00:00:00+07:00`).toISOString(),
    endAt: new Date(`${sessionDate}T23:59:00+07:00`).toISOString()
  };
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

  const range = legacyRange(sessionDate);
  const session = await withTransaction(async (client) => {
    if (activate) {
      await client.query('UPDATE tryout_sessions SET is_active = false WHERE is_active');
    }
    const inserted = await client.query(
      `INSERT INTO tryout_sessions (name, slug, session_date, start_at, end_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, slug, session_date, start_at, end_at, is_active, created_at`,
      [name, `tmp-${crypto.randomBytes(12).toString('hex')}`, sessionDate, range.startAt, range.endAt, activate]
    );
    const session = inserted.rows[0];
    const slug = generateTryoutSlug(name, session.id);
    const updated = await client.query(
      `UPDATE tryout_sessions SET slug = $2 WHERE id = $1
       RETURNING id, name, slug, session_date, start_at, end_at, is_active, created_at`,
      [session.id, slug]
    );
    return updated.rows[0];
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

tryoutReportRouter.get('/reports/tryout/export.xlsx', authorize('tryout_reports.read'), asyncHandler(async (req, res) => {
  const sessionId = req.query.session_id ? parseId(req.query.session_id, 'session_id') : null;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Laporan Tryout');
  sheet.columns = [
    { header: 'Jenis', key: 'jenis', width: 14 },
    { header: 'Nama', key: 'nama', width: 32 },
    { header: 'Sekolah', key: 'sekolah', width: 28 },
    { header: 'Kelas', key: 'kelas', width: 10 },
    { header: 'Mapel', key: 'mapel', width: 24 },
    { header: 'Jumlah Soal', key: 'jumlah_soal', width: 14 },
    { header: 'Benar', key: 'benar', width: 10 },
    { header: 'Salah', key: 'salah', width: 10 },
    { header: 'Nilai', key: 'nilai', width: 12 },
    { header: 'Status', key: 'status', width: 16 }
  ];
  sheet.getRow(1).font = { bold: true };

  const pageSize = 500;
  let offset = 0;
  while (true) {
    const roster = await query(
      `SELECT s.id AS session_id, s.name AS session_name,
              p.id AS participant_id, p.nama, p.jenis, p.sekolah, p.kelas,
              m.id AS mapel_id, m.code AS mapel_code, m.name AS mapel_name
       FROM tryout_sessions s
       JOIN tryout_session_participants sp ON sp.session_id = s.id
       JOIN tryout_participants p ON p.id = sp.participant_id
       LEFT JOIN tryout_session_mapels tsm ON tsm.session_id = s.id
       LEFT JOIN mapels m ON m.id = coalesce(tsm.mapel_id, s.mapel_id)
       WHERE ($1::bigint IS NULL OR s.id = $1)
       ORDER BY s.id, p.id
       LIMIT $2 OFFSET $3`,
      [sessionId, pageSize, offset]
    );
    if (roster.rows.length === 0) break;

    const participantIds = [...new Set(roster.rows.map((row) => Number(row.participant_id)))];
    const stats = await query(
      `SELECT ts.session_id, ts.participant_id, q.mapel_id,
              count(*)::int AS total,
              count(*) FILTER (WHERE ts.is_correct)::int AS correct,
              count(*) FILTER (WHERE NOT ts.is_correct)::int AS wrong,
              round(100.0 * count(*) FILTER (WHERE ts.is_correct)
                    / nullif(count(*), 0), 1) AS score
       FROM tryout_submissions ts
       JOIN questions q ON q.id = ts.question_id
       WHERE ($1::bigint IS NULL OR ts.session_id = $1)
         AND ts.participant_id = ANY($2::bigint[])
       GROUP BY ts.session_id, ts.participant_id, q.mapel_id`,
      [sessionId, participantIds]
    );
    const statsByKey = new Map(stats.rows.map((row) => [
      `${row.session_id}:${row.participant_id}:${row.mapel_id}`, row
    ]));

    for (const row of roster.rows) {
      const key = `${row.session_id}:${row.participant_id}:${row.mapel_id}`;
      const summary = statsByKey.get(key);
      const total = Number(summary?.total ?? 0);
      sheet.addRow({
        jenis: row.jenis === 'umum' ? 'prospektus' : 'siswa',
        nama: row.nama,
        sekolah: row.sekolah,
        kelas: Number(row.kelas ?? 0),
        mapel: row.mapel_name ?? row.mapel_code ?? '-',
        jumlah_soal: total,
        benar: Number(summary?.correct ?? 0),
        salah: Number(summary?.wrong ?? 0),
        nilai: summary?.score === null || summary?.score === undefined ? 0 : Number(summary.score),
        status: total > 0 ? 'Sudah Submit' : 'Belum Submit'
      });
    }

    if (roster.rows.length < pageSize) break;
    offset += pageSize;
  }

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="laporan-tryout-${sessionId ?? 'semua'}.xlsx"`
  );
  await workbook.xlsx.write(res);
  res.end();
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
               nullif((SELECT string_agg(s.statement_text, '; ' ORDER BY s.position)
                       FROM question_statements s
                       WHERE s.question_id = q.id AND s.is_correct), ''),
               ak.answer_text
             ) AS correct_answer,
            coalesce(
              (SELECT jsonb_agg(jsonb_build_object(
                 'statement_id', ssa.statement_id,
                 'statement', s.statement_text,
                 'position', s.position,
                 'user_answer', ssa.answer,
                 'correct_answer', s.is_correct,
                 'is_correct', ssa.is_correct
               ) ORDER BY s.position)
               FROM submission_statement_answers ssa
               JOIN question_statements s ON s.id = ssa.statement_id
               WHERE ssa.submission_id = ts.id),
              '[]'::jsonb
            ) AS statement_details,
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

  const attemptsQuery = `
    SELECT * FROM v_cbt_attempt_report
    WHERE ($1::bigint IS NULL OR session_id = $1)
    ORDER BY session_id DESC, participant, attempt_id
  `;
  const violationsQuery = `
    SELECT v.id, v.attempt_id, v.violation_type, v.detail, v.created_at,
           a.session_id, a.participant_id,
           tp.nama AS participant
    FROM tryout_cbt_violations v
    JOIN tryout_attempts a ON a.id = v.attempt_id
    LEFT JOIN tryout_participants tp ON tp.id = a.participant_id
    WHERE ($1::bigint IS NULL OR a.session_id = $1)
    ORDER BY v.created_at DESC, v.id DESC
    LIMIT 500
  `;

  const [sessions, summary, details, attempts, violations] = await Promise.all([
    query(sessionsQuery),
    query(summaryQuery, [sessionId]),
    query(detailsQuery, [sessionId]),
    query(attemptsQuery, [sessionId]),
    query(violationsQuery, [sessionId])
  ]);

  res.json({
    ok: true,
    data: {
      sessions: sessions.rows,
      summary: summary.rows,
      details: details.rows,
      attempts: attempts.rows,
      violations: violations.rows
    },
    meta: nowMeta()
  });
}));
