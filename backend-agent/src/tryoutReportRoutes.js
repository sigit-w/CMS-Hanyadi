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
const idDateFormatter = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
});

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function optionalText(value, field) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new ApiError('VALIDATION_ERROR', `${field} harus berupa string`);
  }
  const text = value.trim();
  if (!text) return null;
  if (text.length > 128) {
    throw new ApiError('VALIDATION_ERROR', `${field} maksimal 128 karakter`);
  }
  return escapeLike(text);
}

function parseLimit(value) {
  if (value === undefined || value === null || value === '') return 100;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new ApiError('VALIDATION_ERROR', 'limit harus bilangan bulat positif');
  }
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
    throw new ApiError('VALIDATION_ERROR', 'limit maksimal 200');
  }
  return limit;
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatEventDate(value) {
  const parsed = value ? new Date(value) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return idDateFormatter.format(date);
}

function userLabel(row) {
  if (row.email && String(row.email).trim()) return String(row.email).trim();
  if (row.jenis === 'umum' || row.prospek) return `UMUM-${row.id}`;
  return String(row.id);
}

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
  const search = optionalText(req.query.search, 'search');
  const limit = parseLimit(req.query.limit);
  const { rows } = await query(
    `SELECT DISTINCT s.id, s.name, s.slug, s.session_date, s.is_active,
            coalesce(sc.submission_count, 0)::int AS submission_count,
            e.id AS event_id, e.name AS event_name,
            m.code AS mapel_code, m.name AS mapel_name
     FROM tryout_sessions s
     LEFT JOIN tryout_events e ON e.id = s.event_id
     LEFT JOIN tryout_session_mapels tsm ON tsm.session_id = s.id
     LEFT JOIN mapels m ON m.id = coalesce(tsm.mapel_id, s.mapel_id)
     LEFT JOIN (
       SELECT session_id, count(*)::int AS submission_count
       FROM tryout_submissions
       GROUP BY session_id
     ) sc ON sc.session_id = s.id
     WHERE ($1::text IS NULL OR e.name ILIKE ('%' || $1 || '%')
       OR s.name ILIKE ('%' || $1 || '%')
       OR m.name ILIKE ('%' || $1 || '%')
       OR m.code ILIKE ('%' || $1 || '%'))
     ORDER BY e.name, s.id
     LIMIT $2`,
    [search, limit]
  );
  res.json({ ok: true, data: { sessions: rows }, meta: nowMeta() });
}));

tryoutReportRouter.post('/tryout-sessions', authorize('tryout_reports.read'), asyncHandler(async (req, res) => {
  const name = requireSessionName(req.body?.name);
  const sessionDate = requireSessionDate(req.body?.session_date);
  const eventId = parseId(req.body?.event_id ?? req.body?.eventId, 'event_id');
  const activate = Boolean(req.body?.is_active);

  const range = legacyRange(sessionDate);
  const session = await withTransaction(async (client) => {
    const event = await client.query('SELECT id FROM tryout_events WHERE id = $1', [eventId]);
    if (!event.rows[0]) throw new ApiError('NOT_FOUND', 'Tryout induk tidak ditemukan', 404);
    if (activate) {
      await client.query('UPDATE tryout_sessions SET is_active = false WHERE is_active');
    }
    const inserted = await client.query(
      `INSERT INTO tryout_sessions (name, slug, session_date, start_at, end_at, is_active, event_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, slug, session_date, start_at, end_at, is_active, event_id, created_at`,
      [name, `tmp-${crypto.randomBytes(12).toString('hex')}`, sessionDate, range.startAt, range.endAt, activate, eventId]
    );
    const session = inserted.rows[0];
    const slug = generateTryoutSlug(name, session.id);
    const updated = await client.query(
      `UPDATE tryout_sessions SET slug = $2 WHERE id = $1
       RETURNING id, name, slug, session_date, start_at, end_at, is_active, event_id, created_at`,
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
  const tryoutName = optionalText(req.query.tryout_name, 'tryout_name');

  const { rows: sessions } = await query(
    `SELECT s.id AS session_id, s.name AS session_name, s.slug AS session_slug, s.session_date,
            e.id AS event_id, e.name AS event_name, e.slug AS event_slug, e.starts_at AS event_starts_at,
            m.id AS mapel_id, m.code AS mapel_code, m.name AS mapel_name
     FROM tryout_sessions s
     LEFT JOIN tryout_events e ON e.id = s.event_id
     LEFT JOIN tryout_session_mapels tsm ON tsm.session_id = s.id
     LEFT JOIN mapels m ON m.id = coalesce(tsm.mapel_id, s.mapel_id)
     WHERE ($1::bigint IS NULL OR s.id = $1)
       AND ($2::text IS NULL OR coalesce(e.name, s.name) ILIKE ('%' || $2 || '%'))
     ORDER BY e.name, s.id`,
    [sessionId, tryoutName]
  );

  const sessionIds = [...new Set(sessions.map((row) => Number(row.session_id)))];
  const groups = [];
  const sessionGroupKeys = new Map();
  for (const session of sessions) {
    const id = Number(session.session_id);
    const key = session.mapel_id === null || session.mapel_id === undefined
      ? 'none'
      : String(session.mapel_id);
    if (!sessionGroupKeys.has(id)) sessionGroupKeys.set(id, []);
    const keys = sessionGroupKeys.get(id);
    if (!keys.includes(key)) {
      keys.push(key);
      groups.push({
        key,
        name: String(session.mapel_name || session.mapel_code || '-').toUpperCase(),
        code: session.mapel_code ?? '-'
      });
    }
  }

  const first = sessions[0] ?? null;
  const dateText = formatEventDate(first?.event_starts_at || first?.session_date);
  const eventNames = [];
  for (const session of sessions) {
    const name = String(session.event_name || session.session_name || '').trim();
    if (!name || eventNames.includes(name)) continue;
    eventNames.push(name);
  }
  const titleName = eventNames.map((name) => name.toUpperCase()).join(' / ');
  const entries = new Map();

  if (sessionIds.length) {
    const { rows: roster } = await query(
      `SELECT sp.session_id, p.id AS participant_id, p.nama, p.jenis, p.prospek, p.email, p.sekolah
       FROM tryout_session_participants sp
       JOIN tryout_participants p ON p.id = sp.participant_id
       WHERE sp.session_id = ANY($1::bigint[])
       ORDER BY sp.session_id, p.id`,
      [sessionIds]
    );

    for (const row of roster) {
      const id = Number(row.participant_id);
      if (!entries.has(id)) {
        entries.set(id, {
          id,
          nama: row.nama ?? '',
          user: userLabel({ ...row, id }),
          sekolah: row.sekolah ?? '',
          waktu: 0,
          mapels: new Map(),
          scores: new Map(),
          total: 0,
          average: 0
        });
      }
      const entry = entries.get(id);
      for (const key of sessionGroupKeys.get(Number(row.session_id)) ?? []) {
        if (!entry.mapels.has(key)) entry.mapels.set(key, { correct: 0, wrong: 0, total: 0 });
      }
    }

    const participantIds = [...entries.keys()];
    if (participantIds.length) {
      const { rows: stats } = await query(
        `SELECT ts.participant_id, q.mapel_id,
                count(*)::int AS total,
                count(*) FILTER (WHERE ts.is_correct)::int AS correct,
                count(*) FILTER (WHERE NOT ts.is_correct)::int AS wrong
         FROM tryout_submissions ts
         JOIN questions q ON q.id = ts.question_id
         WHERE ts.session_id = ANY($1::bigint[])
           AND ts.participant_id = ANY($2::bigint[])
         GROUP BY ts.participant_id, q.mapel_id`,
        [sessionIds, participantIds]
      );
      for (const row of stats) {
        const entry = entries.get(Number(row.participant_id));
        const key = row.mapel_id === null || row.mapel_id === undefined
          ? 'none'
          : String(row.mapel_id);
        const aggregate = entry?.mapels.get(key);
        if (!aggregate) continue;
        aggregate.correct += Number(row.correct ?? 0);
        aggregate.wrong += Number(row.wrong ?? 0);
        aggregate.total += Number(row.total ?? 0);
      }

      const { rows: attempts } = await query(
        `SELECT participant_id,
                coalesce(sum(extract(epoch FROM (submitted_at - started_at)) / 86400.0), 0) AS days
         FROM tryout_attempts
         WHERE submitted_at IS NOT NULL
           AND session_id = ANY($1::bigint[])
           AND participant_id = ANY($2::bigint[])
         GROUP BY participant_id`,
        [sessionIds, participantIds]
      );
      for (const row of attempts) {
        const entry = entries.get(Number(row.participant_id));
        if (entry) entry.waktu += Number(row.days ?? 0);
      }
    }
  }

  for (const entry of entries.values()) {
    for (const group of groups) {
      const aggregate = entry.mapels.get(group.key) ?? { correct: 0, wrong: 0, total: 0 };
      entry.scores.set(
        group.key,
        aggregate.total > 0 ? round2((100 * aggregate.correct) / aggregate.total) : 0
      );
    }
    entry.total = round2([...entry.scores.values()].reduce((sum, score) => sum + score, 0));
    entry.average = groups.length ? round2(entry.total / groups.length) : 0;
  }

  const participants = [...entries.values()].sort((a, b) => {
    if (a.total !== b.total) return b.total - a.total;
    for (const group of groups) {
      const left = a.scores.get(group.key) ?? 0;
      const right = b.scores.get(group.key) ?? 0;
      if (left !== right) return right - left;
    }
    if (a.waktu !== b.waktu) return a.waktu - b.waktu;
    return String(a.nama).localeCompare(String(b.nama), 'id-ID');
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Laporan Tryout');
  const width = [8, 32, 28, 28, 14];
  for (let index = 0; index < groups.length; index += 1) width.push(8, 8, 12);
  width.push(12, 12, 10);
  width.forEach((value, index) => { sheet.getColumn(index + 1).width = value; });

  sheet.getCell(1, 1).value = `HASIL TRYOUT ${titleName}`.trim();
  sheet.getCell(1, 1).font = { bold: true, size: 14 };
  sheet.getCell(2, 1).value = 'NEW PRIMAGAMA YOGYAKARTA';
  sheet.getCell(2, 1).font = { bold: true };
  sheet.getCell(3, 1).value = dateText.toUpperCase();
  sheet.getCell(3, 1).font = { bold: true };

  const fixedHeaders = ['NO', 'NAMA SISWA', 'USER', 'ASAL SEKOLAH', 'WAKTU'];
  fixedHeaders.forEach((label, index) => {
    const column = index + 1;
    sheet.mergeCells(6, column, 7, column);
    const cell = sheet.getCell(6, column);
    cell.value = label;
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  let column = 6;
  for (const group of groups) {
    sheet.mergeCells(6, column, 6, column + 2);
    const header = sheet.getCell(6, column);
    header.value = group.name;
    header.font = { bold: true };
    header.alignment = { vertical: 'middle', horizontal: 'center' };
    ['B', 'S', 'NILAI'].forEach((label, offset) => {
      const cell = sheet.getCell(7, column + offset);
      cell.value = label;
      cell.font = { bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    group.startColumn = column;
    group.scoreColumn = column + 2;
    column += 3;
  }
  for (const label of ['TOTAL', 'RATA-RATA', 'RANKING']) {
    sheet.mergeCells(6, column, 7, column);
    const cell = sheet.getCell(6, column);
    cell.value = label;
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    column += 1;
  }

  participants.forEach((entry, index) => {
    const row = sheet.getRow(8 + index);
    row.getCell(1).value = index + 1;
    row.getCell(2).value = entry.nama;
    row.getCell(3).value = entry.user;
    row.getCell(4).value = entry.sekolah;
    const waktu = row.getCell(5);
    waktu.value = Number(entry.waktu.toFixed(6));
    waktu.numFmt = '0.000000';
    for (const group of groups) {
      const aggregate = entry.mapels.get(group.key) ?? { correct: 0, wrong: 0, total: 0 };
      row.getCell(group.startColumn).value = aggregate.correct;
      row.getCell(group.startColumn + 1).value = aggregate.wrong;
      const score = row.getCell(group.scoreColumn);
      score.value = entry.scores.get(group.key) ?? 0;
      score.numFmt = '0.00';
    }
    const total = row.getCell(5 + groups.length * 3 + 1);
    total.value = entry.total;
    total.numFmt = '0.00';
    const average = row.getCell(5 + groups.length * 3 + 2);
    average.value = entry.average;
    average.numFmt = '0.00';
    row.getCell(5 + groups.length * 3 + 3).value = index + 1;
  });

  const notes = [
    'KETERANGAN :',
    '1. Nilai di atas adalah nilai MURNI HASIL TRYOUT',
    '2. B = Jumlah benar, S = jumlah salah',
    '3. Nilai diurutkan berdasar :',
    '- Jumlah nilai',
    ...groups.map((group) => `- Nilai ${group.name}`),
    '- Waktu'
  ];
  const notesStart = 8 + participants.length + 1;
  notes.forEach((text, index) => { sheet.getCell(notesStart + index, 1).value = text; });

  ['MAKSIMAL', 'MINIMAL', 'RATA-RATA'].forEach((label, index) => {
    const labelCell = sheet.getCell(notesStart + index, 2);
    labelCell.value = label;
    labelCell.font = { bold: true };
    for (const group of groups) {
      const values = participants.map((entry) => entry.scores.get(group.key) ?? 0);
      let value = 0;
      if (values.length) {
        if (index === 0) value = Math.max(...values);
        else if (index === 1) value = Math.min(...values);
        else value = round2(values.reduce((sum, item) => sum + item, 0) / values.length);
      }
      const cell = sheet.getCell(notesStart + index, group.scoreColumn);
      cell.value = value;
      cell.numFmt = '0.00';
    }
  });

  const signatureColumn = Math.max(1, Math.floor((5 + groups.length * 3 + 3) / 2) + 1);
  const signatureEnd = Math.min(5 + groups.length * 3 + 3, signatureColumn + 2);
  const signatureRow = notesStart + notes.length;
  sheet.mergeCells(signatureRow, signatureColumn, signatureRow, signatureEnd);
  sheet.mergeCells(signatureRow + 1, signatureColumn, signatureRow + 1, signatureEnd);
  const signatureDate = sheet.getCell(signatureRow, signatureColumn);
  signatureDate.value = `Yogyakarta, ${dateText}`;
  signatureDate.alignment = { horizontal: 'center' };
  const signatureName = sheet.getCell(signatureRow + 1, signatureColumn);
  signatureName.value = 'New Primagama Yogyakarta';
  signatureName.font = { bold: true };
  signatureName.alignment = { horizontal: 'center' };

  const eventSlugs = [];
  for (const session of sessions) {
    const slug = slugify(session.event_slug || session.event_name
      || session.session_slug || session.session_name);
    if (slug && !eventSlugs.includes(slug)) eventSlugs.push(slug);
  }
  const sessionSlug = slugify(first?.session_slug || first?.session_name);
  let fileName = 'laporan-tryout-semua.xlsx';
  if ((sessionId || tryoutName) && eventSlugs.length) {
    const suffix = sessionId && sessionSlug ? sessionSlug : 'semua-sesi';
    fileName = `laporan-tryout-${eventSlugs.join('-')}-${suffix}`
      .slice(0, 140)
      .replace(/-+$/, '') + '.xlsx';
  }

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
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
