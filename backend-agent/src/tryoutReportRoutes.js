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

const REPORT_DAYS = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
const REPORT_MONTHS = [
  'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
  'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
];

function reportDate(value, withDay = true) {
  if (!value) return '-';
  const source = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? `${value}T00:00:00+07:00`
    : value;
  const date = value instanceof Date ? value : new Date(source);
  if (Number.isNaN(date.getTime())) return '-';
  const jakarta = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const text = `${jakarta.getUTCDate()} ${REPORT_MONTHS[jakarta.getUTCMonth()]} ${jakarta.getUTCFullYear()}`;
  return withDay ? `${REPORT_DAYS[jakarta.getUTCDay()]}, ${text}` : text;
}

function reportSide() {
  return { style: 'thin', color: { argb: 'FF000000' } };
}

function reportBorder(sides = ['top', 'right', 'bottom', 'left']) {
  return Object.fromEntries(sides.map((side) => [side, reportSide()]));
}

function reportFont(name, size, bold = false) {
  return { name, size, bold, color: { argb: 'FF000000' } };
}

function reportFill() {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
}

function styleReportCell(cell, options = {}) {
  if (options.font) cell.font = options.font;
  if (options.fill) cell.fill = options.fill;
  if (options.border) cell.border = options.border;
  if (options.alignment) cell.alignment = options.alignment;
  if (options.numFmt) cell.numFmt = options.numFmt;
}

function styleReportRange(sheet, firstRow, firstColumn, lastRow, lastColumn, options) {
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      styleReportCell(sheet.getCell(row, column), options);
    }
  }
}

export function buildTryoutReportWorkbook({ titleName, jenjangTitle, reportDateValue, groups, participants }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Laporan Tryout');
  sheet.properties.defaultRowHeight = 15.75;

  const groupWidths = [
    [3.75, 2.88, 6.38],
    [3.38, 2.88, 6.13],
    [5, 3.63, 6.13]
  ];
  const widths = [5.63, 32.63, 9.5, 26.38, 11.38];
  groups.forEach((_, index) => widths.push(...(groupWidths[index] ?? [4, 3, 6.2])));
  widths.push(6.13, 9.25, 8.25);
  widths.forEach((value, index) => { sheet.getColumn(index + 1).width = value; });

  sheet.getRow(1).height = 34.4;
  const title = sheet.getCell(1, 1);
  title.value = `HASIL TRYOUT ${titleName} JENJANG ${jenjangTitle}`.trim();
  title.font = reportFont('Calibri', 24, true);
  title.alignment = { horizontal: 'left' };

  sheet.getRow(2).height = 26;
  const date = sheet.getCell(2, 1);
  date.value = reportDate(reportDateValue);
  date.font = reportFont('Calibri', 18, true);
  date.alignment = { horizontal: 'left' };

  const fixedHeaders = [
    { label: 'NO', alignment: 'center' },
    { label: 'NAMA SISWA', alignment: 'center' },
    { label: 'USER', alignment: 'center' },
    { label: 'ASAL SEKOLAH', alignment: 'left' },
    { label: 'WAKTU', alignment: 'left', waktu: true }
  ];
  fixedHeaders.forEach((header, index) => {
    const column = index + 1;
    const options = {
      font: reportFont(header.waktu ? 'Arial' : 'Calibri', header.waktu ? 11 : 11, true),
      fill: reportFill(),
      alignment: { horizontal: header.alignment, vertical: 'middle' }
    };
    styleReportCell(sheet.getCell(5, column), { ...options, border: reportBorder(['top', 'right', 'left']) });
    styleReportCell(sheet.getCell(6, column), { ...options, border: reportBorder(['right', 'left']) });
    sheet.mergeCells(5, column, 6, column);
    sheet.getCell(5, column).value = header.label;
  });

  let column = 6;
  for (const group of groups) {
    styleReportRange(sheet, 5, column, 5, column + 2, {
      font: reportFont('Calibri', 11, true),
      fill: reportFill(),
      border: reportBorder(),
      alignment: { horizontal: 'center', vertical: 'middle' }
    });
    sheet.mergeCells(5, column, 5, column + 2);
    sheet.getCell(5, column).value = group.name;
    ['B', 'S', 'NILAI'].forEach((label, offset) => {
      const cell = sheet.getCell(6, column + offset);
      cell.value = label;
      styleReportCell(cell, {
        font: reportFont('Calibri', 11, true),
        fill: reportFill(),
        border: reportBorder(),
        alignment: { horizontal: 'center', vertical: 'middle' }
      });
    });
    group.startColumn = column;
    group.scoreColumn = column + 2;
    column += 3;
  }

  [
    { label: 'TOTAL', alignment: 'center' },
    { label: 'RATA-RATA', alignment: 'center' },
    { label: 'RANKING', alignment: 'left' }
  ].forEach((header) => {
    const options = {
      font: reportFont('Calibri', 11, true),
      fill: reportFill(),
      alignment: { horizontal: header.alignment, vertical: 'middle' }
    };
    styleReportCell(sheet.getCell(5, column), { ...options, border: reportBorder(['top', 'right', 'left']) });
    styleReportCell(sheet.getCell(6, column), { ...options, border: reportBorder(['right', 'left']) });
    sheet.mergeCells(5, column, 6, column);
    sheet.getCell(5, column).value = header.label;
    column += 1;
  });

  const dataFont = () => reportFont('Arial', 10);
  const dataAlignment = (horizontal) => (horizontal ? { horizontal } : undefined);
  participants.forEach((entry, index) => {
    const row = sheet.getRow(7 + index);
    const put = (targetColumn, value, options = {}) => {
      const cell = row.getCell(targetColumn);
      cell.value = value;
      styleReportCell(cell, {
        font: dataFont(),
        border: reportBorder(),
        alignment: dataAlignment(options.alignment),
        numFmt: options.numFmt
      });
      return cell;
    };
    put(1, index + 1, { alignment: 'center' });
    put(2, entry.nama);
    put(3, entry.user, { alignment: 'center' });
    put(4, entry.sekolah, { alignment: 'left' });
    put(5, entry.waktu, { alignment: 'left', numFmt: 'h:mm:ss AM/PM' });
    for (const group of groups) {
      const aggregate = entry.mapels.get(group.key) ?? { correct: 0, wrong: 0, total: 0 };
      put(group.startColumn, aggregate.correct, { alignment: 'right' });
      put(group.startColumn + 1, aggregate.wrong, { alignment: 'right' });
      put(group.scoreColumn, entry.scores.get(group.key) ?? 0, {
        alignment: 'center',
        numFmt: '#,##0.00'
      });
    }
    put(5 + groups.length * 3 + 1, entry.total, { numFmt: '#,##0.00' });
    put(5 + groups.length * 3 + 2, entry.average, { alignment: 'center', numFmt: '#,##0.00' });
    put(5 + groups.length * 3 + 3, index + 1, { alignment: 'center' });
  });

  const notes = [
    'KETERANGAN :',
    '1. Nilai di atas adalah nilai MURNI HASIL TRYOUT',
    '2. B = Jumlah benar, S: jumlah salah',
    '3. Nilai diurutkan berdasar :',
    '- Jumlah nilai',
    ...groups.map((group) => `- Nilai ${group.name}`),
    '- Waktu'
  ];
  const notesStart = 7 + participants.length + 1;
  notes.forEach((text, index) => {
    const cell = sheet.getCell(notesStart + index, 2);
    cell.value = text;
    cell.font = reportFont('Calibri', 11);
  });

  for (const group of groups) {
    const label = group.name.startsWith('INDONESIA')
      ? 'INDO'
      : group.name.startsWith('MATEMATIKA') ? 'MAT' : group.name;
    styleReportRange(sheet, notesStart, group.startColumn, notesStart, group.scoreColumn, {
      font: reportFont('Arial', 10, true),
      fill: reportFill(),
      border: reportBorder(),
      alignment: { horizontal: 'center', vertical: 'middle' }
    });
    sheet.mergeCells(notesStart, group.startColumn, notesStart, group.scoreColumn);
    sheet.getCell(notesStart, group.startColumn).value = label;
  }

  ['MAKSIMAL', 'MINIMAL', 'RATA-RATA'].forEach((label, index) => {
    const row = notesStart + 1 + index;
    const labelCell = sheet.getCell(row, 5);
    labelCell.value = label;
    styleReportCell(labelCell, {
      font: reportFont('Arial', 10, true),
      fill: reportFill(),
      border: reportBorder(),
      alignment: { horizontal: 'center', vertical: 'middle' }
    });
    for (const group of groups) {
      const values = participants.map((entry) => entry.scores.get(group.key) ?? 0);
      let value = 0;
      if (values.length) {
        if (index === 0) value = Math.max(...values);
        else if (index === 1) value = Math.min(...values);
        else value = round2(values.reduce((sum, item) => sum + item, 0) / values.length);
      }
      styleReportRange(sheet, row, group.startColumn, row, group.scoreColumn, {
        font: dataFont(),
        border: reportBorder(),
        alignment: { horizontal: 'center', vertical: 'middle' }
      });
      sheet.mergeCells(row, group.startColumn, row, group.scoreColumn);
      const cell = sheet.getCell(row, group.startColumn);
      cell.value = value;
      cell.numFmt = '#,##0.00';
    }
  });

  const footerStart = 5 + groups.length + 2;
  const footerEnd = 5 + groups.length * 3 + 1;
  sheet.mergeCells(notesStart + 5, footerStart, notesStart + 5, footerEnd);
  const footer = sheet.getCell(notesStart + 5, footerStart);
  const footerDate = reportDate(reportDateValue, false)
    .toLowerCase()
    .replace(/\b([a-z])/g, (character) => character.toUpperCase());
  footer.value = footerDate;
  footer.font = reportFont('Calibri', 11);
  footer.alignment = { horizontal: 'center' };

  return workbook;
}

function userLabel(row) {
  if (row.username && String(row.username).trim()) return String(row.username).trim();
  if (row.email && String(row.email).trim()) return String(row.email).trim();
  if (row.jenis === 'umum' || row.prospek) return `UMUM-${row.id}`;
  return String(row.id);
}

function optionalJenjangId(value) {
  return value === undefined || value === null || value === '' ? null : parseId(value, 'jenjang_id');
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
  const jenjangId = optionalJenjangId(req.query.jenjang_id);
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
     WHERE ($1::text IS NULL OR coalesce(e.name, s.name) ILIKE ('%' || $1 || '%'))
       AND ($3::bigint IS NULL OR EXISTS (
         SELECT 1 FROM tryout_session_participants sp
         JOIN tryout_participants p ON p.id = sp.participant_id
         WHERE sp.session_id = s.id AND p.jenjang_id = $3
       ))
     ORDER BY e.name, s.id
     LIMIT $2`,
    [search, limit, jenjangId]
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
  const jenjangId = optionalJenjangId(req.query.jenjang_id);

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
        AND ($3::bigint IS NULL OR EXISTS (
          SELECT 1 FROM tryout_session_participants sp
          JOIN tryout_participants p ON p.id = sp.participant_id
          WHERE sp.session_id = s.id AND p.jenjang_id = $3
        ))
      ORDER BY e.name, s.id`,
     [sessionId, tryoutName, jenjangId]
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
  const eventNames = [];
  for (const session of sessions) {
    const name = String(session.event_name || session.session_name || '').trim();
    if (!name || eventNames.includes(name)) continue;
    eventNames.push(name);
  }
  const titleName = eventNames.map((name) => name.toUpperCase()).join(' / ');
  const entries = new Map();
  const jenjangLabels = [];

  if (sessionIds.length) {
    const { rows: roster } = await query(
      `SELECT sp.session_id, p.id AS participant_id, p.nama, p.jenis, p.prospek,
              p.email, p.sekolah, p.username, p.jenjang_kode, p.jenjang_nama
       FROM tryout_session_participants sp
       JOIN tryout_participants p ON p.id = sp.participant_id
       WHERE sp.session_id = ANY($1::bigint[])
         AND ($2::bigint IS NULL OR p.jenjang_id = $2)
       ORDER BY sp.session_id, p.id`,
      [sessionIds, jenjangId]
    );

    for (const row of roster) {
      const jenjang = String(row.jenjang_nama || row.jenjang_kode || '').trim();
      if (jenjang && !jenjangLabels.includes(jenjang)) jenjangLabels.push(jenjang);
      const id = Number(row.participant_id);
      if (!entries.has(id)) {
        entries.set(id, {
          id,
          nama: row.nama ?? '',
          user: userLabel({ ...row, id }),
          sekolah: row.sekolah ?? '',
          waktu: null,
          jenjang: row.jenjang_kode || row.jenjang_nama || '-',
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
        `SELECT participant_id, max(submitted_at) AS submitted_at
         FROM tryout_attempts
         WHERE submitted_at IS NOT NULL
           AND session_id = ANY($1::bigint[])
           AND participant_id = ANY($2::bigint[])
         GROUP BY participant_id`,
        [sessionIds, participantIds]
      );
      for (const row of attempts) {
        const entry = entries.get(Number(row.participant_id));
        if (entry) entry.waktu = row.submitted_at ? new Date(row.submitted_at) : null;
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
    if (a.waktu !== b.waktu) {
      if (!a.waktu) return 1;
      if (!b.waktu) return -1;
      return new Date(a.waktu) - new Date(b.waktu);
    }
    return String(a.nama).localeCompare(String(b.nama), 'id-ID');
  });

  const jenjangTitle = jenjangLabels.length
    ? jenjangLabels.map((label) => label.toUpperCase()).join(' / ')
    : '-';
  const reportDateValue = first?.session_date || first?.event_starts_at || null;
  const workbook = buildTryoutReportWorkbook({
    titleName,
    jenjangTitle,
    reportDateValue,
    groups,
    participants
  });

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
  const jenjangId = optionalJenjangId(req.query.jenjang_id);
  const sessionsQuery = `
    SELECT s.id, s.name, s.session_date, s.is_active, count(ts.id)::int AS submission_count
    FROM tryout_sessions s
    LEFT JOIN tryout_submissions ts ON ts.session_id = s.id
    GROUP BY s.id
    HAVING ($1::bigint IS NULL OR EXISTS (
      SELECT 1 FROM tryout_session_participants sp
      JOIN tryout_participants p ON p.id = sp.participant_id
      WHERE sp.session_id = s.id AND p.jenjang_id = $1
    ))
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
      AND ($2::bigint IS NULL OR tp.jenjang_id = $2)
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
      AND ($2::bigint IS NULL OR tp.jenjang_id = $2)
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
      AND ($2::bigint IS NULL OR tp.jenjang_id = $2)
    ORDER BY v.created_at DESC, v.id DESC
    LIMIT 500
  `;

  const [sessions, summary, details, attempts, violations] = await Promise.all([
    query(sessionsQuery, [jenjangId]),
    query(summaryQuery, [sessionId, jenjangId]),
    query(detailsQuery, [sessionId, jenjangId]),
    query(attemptsQuery, [sessionId]),
    query(violationsQuery, [sessionId, jenjangId])
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
