import { adminHeaders, API_BASE, PRESENTATION_BASE } from './auth-helper.mjs';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import ExcelJS from '../../backend-agent/node_modules/exceljs/excel.js';
import { query } from '../../backend-agent/src/db.js';

const REPORT_FILE = '/opt/virtual-office-bank-soal/frontend-agent/src/pages/TryoutReport.jsx';
const createdSessionIds = [];
const FORBIDDEN_MARKERS = [
  'Buat Sesi Tryout',
  'Sesi Tersedia',
  'Jadikan sesi aktif',
  'Aktifkan',
  'createTryoutSession',
  'activateTryoutSession'
];
const REQUIRED_MARKERS = [
  'Filter Laporan Tryout',
  'Cari tryout, sesi, atau mapel',
  'Semua sesi',
  'Cari/Filter',
  'Nama tryout',
  'Unduh Excel'
];

async function api(pathname, options = {}) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...options,
    headers: { ...(await adminHeaders()), 'Content-Type': 'application/json', ...(options.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body, response };
}

function cellText(cell) {
  const value = cell?.value;
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => String(part.text ?? '')).join('');
    }
    if (value.text !== undefined) return String(value.text);
  }
  return value == null ? '' : String(value);
}

function rowTexts(row) {
  return Array.from({ length: row.cellCount }, (_, index) => cellText(row.getCell(index + 1)));
}

function allText(sheet) {
  const texts = [];
  sheet.eachRow((row) => row.eachCell({ includeEmpty: false }, (cell) => {
    texts.push(cellText(cell));
  }));
  return texts;
}

function groupHeaders(sheet) {
  const headers = [];
  for (let column = 1; column <= sheet.columnCount; column += 1) {
    if (cellText(sheet.getCell(7, column)) === 'B') headers.push(cellText(sheet.getCell(6, column)));
  }
  return headers;
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function near(actual, expected, label) {
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) < 0.02,
    `${label}: ${actual} != ${expected}`
  );
}

async function exportXlsx(query) {
  const response = await fetch(`${API_BASE}/api/v1/reports/tryout/export.xlsx${query}`, {
    headers: await adminHeaders()
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /spreadsheetml/);
  assert.match(
    response.headers.get('content-disposition') ?? '',
    /^attachment;\s*filename="laporan-tryout-[^"]+\.xlsx"$/
  );
  const buffer = Buffer.from(await response.arrayBuffer());
  assert.equal(buffer.subarray(0, 2).toString(), 'PK');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  assert.ok(sheet);
  return { response, sheet };
}

function findRow(sheet, predicate) {
  let found = null;
  sheet.eachRow((row) => {
    if (!found && predicate(row)) found = row;
  });
  return found;
}

async function tkaSessions() {
  const result = await api('/api/v1/tryout-sessions?search=TKA');
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body.data.sessions.filter((session) => String(session.event_id) === '48');
}

before(async () => {
  for (const base of [API_BASE, PRESENTATION_BASE]) {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
  }
});

after(async () => {
  if (createdSessionIds.length) {
    await query('DELETE FROM tryout_sessions WHERE id = ANY($1::bigint[])', [createdSessionIds]);
  }
});

test('Q6V-01 marker laporan bersih dan endpoint legacy tetap merespons', async () => {
  const source = readFileSync(REPORT_FILE, 'utf8');
  for (const marker of FORBIDDEN_MARKERS) {
    assert.ok(!source.toLowerCase().includes(marker.toLowerCase()), `marker lama masih ada: ${marker}`);
  }
  for (const marker of REQUIRED_MARKERS) {
    assert.ok(source.includes(marker), `marker baru tidak ada: ${marker}`);
  }
  assert.doesNotMatch(source, /const \[(form|saving|notice),/);

  const created = await api('/api/v1/tryout-sessions', {
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.equal(created.status, 400, JSON.stringify(created.body));
  assert.equal(created.body.error.code, 'VALIDATION_ERROR');

  const legacyName = `QA6V Legacy ${crypto.randomBytes(6).toString('hex')}`;
  const legacy = await api('/api/v1/tryout-sessions', {
    method: 'POST',
    body: JSON.stringify({
      name: legacyName,
      session_date: '2026-11-26',
      event_id: 1,
      is_active: false
    })
  });
  assert.equal(legacy.status, 201, JSON.stringify(legacy.body));
  const legacyId = legacy.body.data.session.id;
  createdSessionIds.push(legacyId);
  assert.equal(Number(legacy.body.data.session.event_id), 1, JSON.stringify(legacy.body.data.session));

  const storedLegacy = await query('SELECT event_id FROM tryout_sessions WHERE id = $1', [legacyId]);
  assert.equal(storedLegacy.rows.length, 1, `sesi legacy ${legacyId} tidak tersimpan`);
  assert.equal(Number(storedLegacy.rows[0].event_id), 1);

  const activated = await api('/api/v1/tryout-sessions/999999999/activate', {
    method: 'PATCH',
    body: JSON.stringify({})
  });
  assert.equal(activated.status, 404, JSON.stringify(activated.body));
  assert.equal(activated.body.error.code, 'NOT_FOUND');
});

test('Q6V-02 pencarian sesi server-side, wildcard, batas limit, dan marker filter', async () => {
  const sessions = await tkaSessions();
  assert.deepEqual(sessions.map((session) => String(session.id)).sort(), ['375', '376']);
  for (const session of sessions) {
    assert.equal(session.event_name, 'TKA Nov');
    for (const field of ['event_id', 'event_name', 'mapel_code', 'mapel_name']) {
      assert.ok(field in session, `field ${field} tidak ada pada sesi ${session.id}`);
    }
  }

  for (const search of ['%25', '_', '%5C']) {
    const wildcard = await api(`/api/v1/tryout-sessions?search=${search}`);
    assert.equal(wildcard.status, 200, JSON.stringify(wildcard.body));
    assert.deepEqual(wildcard.body.data.sessions, [], `wildcard ${search} tidak di-escape`);
  }

  const tooLarge = await api('/api/v1/tryout-sessions?limit=201');
  assert.equal(tooLarge.status, 400, JSON.stringify(tooLarge.body));
  assert.equal(tooLarge.body.error.code, 'VALIDATION_ERROR');

  const source = readFileSync(REPORT_FILE, 'utf8');
  assert.match(source, /setTimeout\(\(\) => setDebouncedSearch\(search\), \d+\)/);
  assert.match(source, /clearTimeout\(timer\)/);
  assert.match(source, /getTryoutSessions\(\{ search: debouncedSearch \}\)/);
  assert.match(source, /const \[selectedSessionId, setSelectedSessionId\]/);
  assert.match(source, /const \[appliedSessionId, setAppliedSessionId\]/);
  assert.match(source, /setAppliedSessionId\(selectedSessionId\)/);
  assert.match(source, /value=\{selectedSessionId\}/);
  assert.match(source, /getTryoutReport\(appliedSessionId \|\| null\)/);
  assert.match(source, /}, \[appliedSessionId\]\);/);
  assert.doesNotMatch(source, /getTryoutReport\(selectedSessionId/);
  assert.match(source, /downloadTryoutReportExcel\(appliedSessionId \|\| null, name\)/);
  assert.match(source, /session\.event_name, session\.name, session\.mapel_name/);
});

test('Q6V-03 filter tryout_name, AND dengan session_id, dan ekspor semua', async () => {
  const { response, sheet } = await exportXlsx('?tryout_name=TKA');
  assert.match(response.headers.get('content-disposition') ?? '', /filename="laporan-tryout-[^"]*tka[^"]*\.xlsx"/i);
  const texts = allText(sheet).join(' | ');
  assert.match(texts, /HASIL TRYOUT TKA NOV/);
  for (const name of ['Arashela Yevana', 'Ashel']) {
    assert.ok(texts.includes(name), `${name} tidak ada pada ekspor TKA`);
  }
  assert.deepEqual(groupHeaders(sheet), ['MATEMATIKA', 'IPAS']);

  const scoped = await exportXlsx('?session_id=376&tryout_name=TKA');
  assert.equal(scoped.response.status, 200);
  assert.deepEqual(groupHeaders(scoped.sheet), ['IPAS']);

  const combined = await exportXlsx('?session_id=375&tryout_name=IPAS');
  const combinedTexts = allText(combined.sheet).join(' | ');
  for (const name of ['Arashela Yevana', 'Ashel']) {
    assert.ok(!combinedTexts.includes(name), `${name} masih ada walaupun AND filter tidak cocok`);
  }
  const combinedNotes = findRow(combined.sheet, (row) => cellText(row.getCell(1)) === 'KETERANGAN :');
  assert.ok(combinedNotes);
  assert.equal(combinedNotes.number, 9);

  const all = await exportXlsx('?tryout_name=');
  assert.match(all.response.headers.get('content-disposition') ?? '', /filename="laporan-tryout-semua\.xlsx"/);
  const allTexts = allText(all.sheet).join(' | ');
  for (const name of ['Arashela Yevana', 'Ashel']) {
    assert.ok(allTexts.includes(name), `${name} tidak ada pada ekspor semua`);
  }
});

test('Q6V-04 struktur XLSX dua level, grup mapel, statistik, dan tanpa kunci', async () => {
  const sessions = await tkaSessions();
  const expectedGroups = [...new Set(sessions.map((session) => String(session.mapel_name).toUpperCase()))];
  const { sheet } = await exportXlsx('?tryout_name=TKA');

  assert.match(cellText(sheet.getCell(1, 1)), /^HASIL TRYOUT .*TKA/);
  assert.equal(cellText(sheet.getCell(2, 1)), 'NEW PRIMAGAMA YOGYAKARTA');
  assert.match(cellText(sheet.getCell(3, 1)), /^\S+, \d{1,2} \p{L}+ \d{4}$/u);

  const fixedHeaders = ['NO', 'NAMA SISWA', 'USER', 'ASAL SEKOLAH', 'WAKTU'];
  const merges = new Set(sheet.model.merges);
  fixedHeaders.forEach((label, index) => {
    const column = index + 1;
    assert.equal(cellText(sheet.getCell(6, column)), label);
    assert.equal(cellText(sheet.getCell(7, column)), label);
    assert.ok(merges.has(`${String.fromCharCode(64 + column)}6:${String.fromCharCode(64 + column)}7`));
  });

  const groupColumns = [];
  for (let column = 6; column <= sheet.columnCount; column += 1) {
    if (cellText(sheet.getCell(7, column)) === 'B') groupColumns.push(column);
  }
  assert.deepEqual(groupColumns.map((column) => cellText(sheet.getCell(6, column))), expectedGroups);
  const scoreColumns = [];
  groupColumns.forEach((start) => {
    assert.deepEqual(
      [0, 1, 2].map((offset) => cellText(sheet.getCell(7, start + offset))),
      ['B', 'S', 'NILAI']
    );
    assert.ok(merges.has(`${sheet.getColumn(start).letter}6:${sheet.getColumn(start + 2).letter}6`));
    scoreColumns.push(start + 2);
  });

  const totalColumn = 6 + groupColumns.length * 3;
  const averageColumn = totalColumn + 1;
  const rankingColumn = totalColumn + 2;
  assert.equal(cellText(sheet.getCell(6, totalColumn)), 'TOTAL');
  assert.equal(cellText(sheet.getCell(6, averageColumn)), 'RATA-RATA');
  assert.equal(cellText(sheet.getCell(6, rankingColumn)), 'RANKING');
  for (const column of [totalColumn, averageColumn, rankingColumn]) {
    const letter = sheet.getColumn(column).letter;
    assert.ok(merges.has(`${letter}6:${letter}7`));
  }

  const notesRow = findRow(sheet, (row) => cellText(row.getCell(1)) === 'KETERANGAN :');
  assert.ok(notesRow);
  assert.ok(notesRow.number > 8);
  const report = await api('/api/v1/reports/tryout');
  assert.equal(report.status, 200, JSON.stringify(report.body));
  const expectedNames = [...new Set(
    report.body.data.summary
      .filter((row) => sessions.some((session) => String(session.id) === String(row.session_id)))
      .map((row) => String(row.participant))
  )].sort();

  const dataRows = [];
  for (let number = 8; number < notesRow.number; number += 1) {
    const row = sheet.getRow(number);
    if (cellText(row.getCell(1)) || cellText(row.getCell(2))) dataRows.push(row);
  }
  assert.deepEqual(dataRows.map((row) => cellText(row.getCell(2))).sort(), expectedNames);
  const totals = [];
  const scoreValues = groupColumns.map(() => []);
  dataRows.forEach((row, index) => {
    assert.equal(Number(row.getCell(1).value), index + 1);
    assert.equal(cellText(row.getCell(4)), 'SD KW');
    assert.ok(Number.isFinite(Number(row.getCell(5).value)));
    let total = 0;
    groupColumns.forEach((start, groupIndex) => {
      const correct = Number(row.getCell(start).value);
      const wrong = Number(row.getCell(start + 1).value);
      const score = Number(row.getCell(start + 2).value);
      assert.ok(Number.isFinite(correct) && Number.isFinite(wrong) && Number.isFinite(score));
      if (correct + wrong > 0) near(score, round2((100 * correct) / (correct + wrong)), 'nilai mapel');
      total += score;
      scoreValues[groupIndex].push(score);
    });
    near(Number(row.getCell(totalColumn).value), round2(total), 'total');
    near(Number(row.getCell(averageColumn).value), round2(total / groupColumns.length), 'rata-rata');
    assert.equal(Number(row.getCell(rankingColumn).value), index + 1);
    totals.push(Number(row.getCell(totalColumn).value));
  });
  assert.deepEqual(totals, [...totals].sort((left, right) => right - left));

  const noteTexts = [];
  for (let number = notesRow.number; number <= notesRow.number + 7; number += 1) {
    noteTexts.push(cellText(sheet.getRow(number).getCell(1)));
  }
  assert.match(noteTexts.join(' | '), /Nilai di atas adalah nilai MURNI HASIL TRYOUT/);
  assert.match(noteTexts.join(' | '), /B = Jumlah benar, S = jumlah salah/);
  assert.match(noteTexts.join(' | '), /Nilai diurutkan berdasar/);
  assert.ok(noteTexts.includes('- Jumlah nilai'));
  assert.ok(noteTexts.includes('- Waktu'));
  for (const name of expectedGroups) assert.ok(noteTexts.includes(`- Nilai ${name}`), `catatan nilai ${name} tidak ada`);

  ['MAKSIMAL', 'MINIMAL', 'RATA-RATA'].forEach((label, statIndex) => {
    const row = sheet.getRow(notesRow.number + statIndex);
    assert.equal(cellText(row.getCell(2)), label);
    scoreColumns.forEach((column, groupIndex) => {
      const values = scoreValues[groupIndex];
      const expected = statIndex === 0
        ? Math.max(...values)
        : statIndex === 1
          ? Math.min(...values)
          : round2(values.reduce((sum, value) => sum + value, 0) / values.length);
      near(Number(row.getCell(column).value), expected, `statistik ${label}`);
    });
  });

  const texts = allText(sheet);
  assert.ok(texts.some((text) => text.startsWith('Yogyakarta, ')));
  assert.ok(texts.includes('New Primagama Yogyakarta'));
  assert.ok(!texts.some((text) => /kunci|pembahasan|jawaban/i.test(text)), 'XLSX memuat kunci atau pembahasan');
});
