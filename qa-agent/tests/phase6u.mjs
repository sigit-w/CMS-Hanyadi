import {
  adminHeaders, API_BASE, cookieHeader, participantLogin, PRESENTATION_BASE
} from './auth-helper.mjs';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pool, query } from '../../backend-agent/src/db.js';
import ExcelJS from '../../backend-agent/node_modules/exceljs/excel.js';

const CMS_FILE = '/opt/virtual-office-bank-soal/frontend-agent/src/pages/TryoutManagement.jsx';
const REPORT_FILE = '/opt/virtual-office-bank-soal/frontend-agent/src/pages/TryoutReport.jsx';
const TRYOUT_JS = '/opt/virtual-office-bank-soal/tryout-agent/app.js';
const TRYOUT_HTML = '/opt/virtual-office-bank-soal/tryout-agent/index.html';
const PRESENTATION = PRESENTATION_BASE;

const suffix = crypto.randomBytes(4).toString('hex');
const password = crypto.randomBytes(18).toString('base64url');
const pin = String(crypto.randomInt(100000000, 1000000000));
const submitterEmail = `qa_6u_submit_${suffix}@qa.test`;
const idleEmail = `qa_6u_idle_${suffix}@qa.test`;
const convertedEmail = `qa_6u_converted_${suffix}@qa.test`;
const submitterName = `QA 6u Peserta ${suffix}`;
const idleName = `QA 6u Tanpa Submit ${suffix}`;
const umumName = `QA 6u Umum ${suffix}`;
const convertedName = `QA 6u Gabung ${suffix}`;
const school = `SMA Negeri 1 QA ${suffix}`;
const minutesFromNow = (minutes) => new Date(Date.now() + minutes * 60000).toISOString();

const schedule = {
  regular: { starts_at: minutesFromNow(-60), ends_at: minutesFromNow(1440) },
  cbt: { starts_at: minutesFromNow(-5), ends_at: minutesFromNow(10) },
  ended: { starts_at: minutesFromNow(-1440), ends_at: minutesFromNow(-120) }
};

const sheetIds = {};
let sheetJenjang = 'SD';
const questionIds = {};
const eventIds = [];
const participantIds = [];
const sessionIds = {};
let regular;
let cbtEvent;
let endedEvent;
let submitterId;
let idleId;
let umumId;
let convertedUmumId;
let convertedSiswaId;
let headers;

async function api(base, pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function createParticipant(email, nama, extra = {}) {
  const result = await api(API_BASE, '/api/v1/participants', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      nama, email, kelas: 12, sekolah: school, password, ...extra
    })
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  const id = Number(result.body.data.participant.id);
  participantIds.push(id);
  return id;
}

async function loginRaw(email, slug) {
  return participantLogin(email, password, slug);
}

async function login(email, slug) {
  const response = await loginRaw(email, slug);
  assert.equal(response.status, 200, JSON.stringify(await response.json().catch(() => ({}))));
  return { Cookie: cookieHeader(response) };
}

async function createTryout(key, payload) {
  const result = await api(API_BASE, '/api/v1/tryouts', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      name: `QA 6u ${key} ${suffix}`,
      slug: `qa-6u-${key}-${suffix}`,
      jenjang: sheetJenjang,
      ...payload
    })
  });
  if (result.status === 201) eventIds.push(Number(result.body.data.tryout.event_id));
  return result;
}

async function assignedQuestionIds(sessionId, questionType = null) {
  const rows = await query(
    `SELECT tq.question_id
       FROM tryout_session_questions tq
       JOIN questions q ON q.id = tq.question_id
      WHERE tq.session_id = $1 AND q.status = 'approved'
        AND ($2::text IS NULL OR q.question_type = $2)
      ORDER BY tq.position, tq.question_id`,
    [sessionId, questionType]
  );
  return rows.rows.map((row) => Number(row.question_id));
}

async function answerPayloads(sessionId) {
  const result = await query(
    `SELECT tq.question_id, q.question_type, s.id AS statement_id
       FROM tryout_session_questions tq
       JOIN questions q ON q.id = tq.question_id
       LEFT JOIN question_statements s ON s.question_id = q.id
      WHERE tq.session_id = $1 AND q.status = 'approved'
      ORDER BY tq.position, tq.question_id, s.position`,
    [sessionId]
  );
  const byQuestion = new Map();
  for (const row of result.rows) {
    const questionId = Number(row.question_id);
    if (!byQuestion.has(questionId)) {
      const payload = { question_id: questionId };
      if (row.question_type === 'true_false') payload.answers = [];
      else payload.answer = 'A';
      byQuestion.set(questionId, payload);
    }
    const payload = byQuestion.get(questionId);
    if (row.statement_id != null) {
      payload.answers.push({ statement_id: Number(row.statement_id), value: true });
    }
  }
  return [...byQuestion.values()];
}

function headerTexts(source) {
  const block = source.match(/<TableHeader>([\s\S]*?)<\/TableHeader>/)?.[0] ?? '';
  return [...block.matchAll(/<TableHead>(.*?)<\/TableHead>/g)].map((match) => match[1]);
}

before(async () => {
  for (const base of [API_BASE, PRESENTATION_BASE]) {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
  }

  const sheets = await query(
    `SELECT sh.id, m.code AS mapel_code, j.kode AS jenjang_kode
       FROM question_sheets sh
       JOIN mapels m ON m.id = sh.mapel_id
       JOIN jenjang j ON j.id = sh.jenjang_id
       WHERE sh.archived = false AND m.code = ANY($1::text[])
        AND EXISTS (
          SELECT 1 FROM question_sheet_questions qsq
          JOIN questions q ON q.id = qsq.question_id
          WHERE qsq.sheet_id = sh.id AND q.status = 'approved'
            AND q.question_type = 'multiple_choice'
        )
      ORDER BY sh.id DESC`,
    [['MTKA', 'IPAS']]
  );
  for (const row of sheets.rows) {
    if (!sheetIds[row.mapel_code]) sheetIds[row.mapel_code] = Number(row.id);
  }
  assert.ok(sheetIds.MTKA && sheetIds.IPAS, 'Fixture QA memerlukan lembar aktif MTKA dan IPAS');
  const mtkaSheet = sheets.rows.find((row) => row.mapel_code === 'MTKA');
  sheetJenjang = mtkaSheet.jenjang_kode;
  assert.ok(sheets.rows.every((row) => row.jenjang_kode === sheetJenjang));
  for (const code of ['MTKA', 'IPAS']) {
    const rows = await query(
      `SELECT q.id
         FROM question_sheet_questions qsq
         JOIN questions q ON q.id = qsq.question_id
        WHERE qsq.sheet_id = $1 AND q.status = 'approved'
        ORDER BY q.id`,
      [sheetIds[code]]
    );
    questionIds[code] = rows.rows.map((row) => Number(row.question_id));
    assert.ok(questionIds[code].length >= 2, `Lembar ${code} perlu minimal dua soal approved`);
  }

  submitterId = await createParticipant(submitterEmail, submitterName);
  idleId = await createParticipant(idleEmail, idleName);

  const umum = await api(API_BASE, '/api/v1/participants', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      nama: umumName, jenis: 'umum', sekolah: school, pin,
      wa_orang_tua: '+6281234567890'
    })
  });
  assert.equal(umum.status, 201, JSON.stringify(umum.body));
  umumId = Number(umum.body.data.participant.id);
  participantIds.push(umumId);

  const converted = await api(API_BASE, '/api/v1/participants', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      nama: convertedName, jenis: 'umum', sekolah: school, pin,
      wa_orang_tua: '+6281234567891'
    })
  });
  assert.equal(converted.status, 201, JSON.stringify(converted.body));
  convertedUmumId = Number(converted.body.data.participant.id);
  participantIds.push(convertedUmumId);
  const joined = await api(API_BASE, `/api/v1/prospektus/${convertedUmumId}/daftar`, {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      email: convertedEmail, kelas: 12, sekolah: school,
      wa_orang_tua: '+6281234567891', password
    })
  });
  assert.equal(joined.status, 201, JSON.stringify(joined.body));
  convertedSiswaId = Number(joined.body.data.participant.id);
  participantIds.push(convertedSiswaId);

  const regularCreated = await createTryout('regular', {
    ...schedule.regular,
    sessions: [
      { name: `Sesi MTKA ${suffix}`, mapel_code: 'MTKA', sheet_ids: [sheetIds.MTKA] },
      { name: `Sesi IPAS ${suffix}`, mapel_code: 'IPAS', sheet_ids: [sheetIds.IPAS] }
    ],
    participant_ids: [submitterId, idleId]
  });
  assert.equal(regularCreated.status, 201, JSON.stringify(regularCreated.body));
  regular = regularCreated.body.data.tryout;
  sessionIds.regular = regular.sessions.map((session) => Number(session.id));
  assert.equal(sessionIds.regular.length, 2);

  const cbtCreated = await createTryout('cbt', {
    ...schedule.cbt,
    sessions: [
      {
        name: `CBT panjang ${suffix}`, mapel_code: 'MTKA', sheet_ids: [sheetIds.MTKA],
        cbt_enabled: true, cbt_duration_minutes: 30, cbt_max_violations: 3
      },
      {
        name: `CBT pendek ${suffix}`, mapel_code: 'IPAS', sheet_ids: [sheetIds.IPAS],
        cbt_enabled: true, cbt_duration_minutes: 5, cbt_max_violations: 3
      }
    ],
    participant_ids: [submitterId]
  });
  assert.equal(cbtCreated.status, 201, JSON.stringify(cbtCreated.body));
  cbtEvent = cbtCreated.body.data.tryout;
  sessionIds.cbt = cbtEvent.sessions.map((session) => Number(session.id));

  const endedCreated = await createTryout('ended', {
    ...schedule.ended,
    sessions: [{ mapel_code: 'MTKA', sheet_ids: [sheetIds.MTKA] }],
    participant_ids: [submitterId]
  });
  assert.equal(endedCreated.status, 201, JSON.stringify(endedCreated.body));
  endedEvent = endedCreated.body.data.tryout;
  sessionIds.ended = Number(endedEvent.sessions[0].id);

  headers = await login(submitterEmail, regular.sessions[0].slug);
});

after(async () => {
  try {
    if (participantIds.length) {
      await query('DELETE FROM tryout_submissions WHERE participant_id = ANY($1::bigint[])', [participantIds]);
      await query('DELETE FROM auth_sessions WHERE participant_id = ANY($1::bigint[])', [participantIds]);
    }
    if (eventIds.length) {
      await query('DELETE FROM tryout_events WHERE id = ANY($1::bigint[])', [eventIds]);
    }
    if (participantIds.length) {
      await query('DELETE FROM siswa WHERE id = ANY($1::bigint[])', [participantIds]);
      await query('DELETE FROM prospektus WHERE id = ANY($1::bigint[])', [participantIds]);
    }
  } finally {
    await pool.end();
  }
});

test('Q6U-01 induk memiliki banyak sesi dan setiap sesi tepat satu mapel', async () => {
  const detail = await api(API_BASE, `/api/v1/tryouts/${regular.event_id}`, {
    headers: await adminHeaders()
  });
  assert.equal(detail.status, 200, JSON.stringify(detail.body));
  const tryout = detail.body.data.tryout;
  assert.equal(tryout.sessions.length, 2);
  assert.deepEqual(tryout.sessions.map((session) => session.mapel_code).sort(), ['IPAS', 'MTKA']);

  const counts = await query(
    `SELECT tsm.session_id, count(*)::int AS total
       FROM tryout_session_mapels tsm
      WHERE tsm.session_id = ANY($1::bigint[])
      GROUP BY tsm.session_id`,
    [sessionIds.regular]
  );
  assert.equal(counts.rows.length, 2);
  assert.ok(counts.rows.every((row) => Number(row.total) === 1));

  const existing = await api(API_BASE, `/api/v1/tryouts/${sessionIds.regular[0]}/sessions`, {
    headers: await adminHeaders()
  });
  assert.equal(existing.status, 200, JSON.stringify(existing.body));
  assert.equal(existing.body.data.sessions.length, 2);

  const duplicate = await createTryout('duplicate', {
    ...schedule.regular,
    sessions: [
      { mapel_code: 'MTKA', sheet_ids: [sheetIds.MTKA] },
      { mapel_code: 'MTKA', sheet_ids: [sheetIds.MTKA] }
    ]
  });
  assert.equal(duplicate.status, 400, JSON.stringify(duplicate.body));
  assert.match(duplicate.body.error.message, /mapel yang berbeda/);

  const multi = await createTryout('multi', {
    ...schedule.regular,
    sessions: [{ mapel_codes: ['MTKA', 'IPAS'], sheet_ids: [sheetIds.MTKA, sheetIds.IPAS] }]
  });
  assert.equal(multi.status, 400, JSON.stringify(multi.body));
  assert.match(multi.body.error.message, /tepat satu mapel_code/);
});

test('Q6U-02 picker peserta umum memuat prospektus, pencarian, dan tanpa duplikat hasil konversi', async () => {
  const byName = await api(API_BASE, `/api/v1/prospektus?search=${encodeURIComponent(umumName)}`, {
    headers: await adminHeaders()
  });
  assert.equal(byName.status, 200, JSON.stringify(byName.body));
  assert.ok(byName.body.data.prospektus.some((item) => Number(item.id) === umumId));

  const bySchool = await api(API_BASE, `/api/v1/prospektus?search=${encodeURIComponent(school)}`, {
    headers: await adminHeaders()
  });
  assert.equal(bySchool.status, 200);
  assert.ok(bySchool.body.data.prospektus.some((item) => Number(item.id) === umumId));

  for (const term of [submitterName, submitterEmail, '12', school]) {
    const found = await api(API_BASE, `/api/v1/siswa?search=${encodeURIComponent(term)}`, {
      headers: await adminHeaders()
    });
    assert.equal(found.status, 200, JSON.stringify(found.body));
    assert.ok(found.body.data.siswa.some((item) => Number(item.id) === submitterId), term);
  }

  const attached = await api(API_BASE, `/api/v1/tryouts/${regular.event_id}/participants`, {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({ participant_ids: [umumId] })
  });
  assert.equal(attached.status, 200, JSON.stringify(attached.body));
  assert.ok(attached.body.data.added_ids.map(Number).includes(umumId));

  const deduped = await api(API_BASE, `/api/v1/tryouts/${regular.event_id}/participants`, {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({ participant_ids: [convertedUmumId, convertedSiswaId] })
  });
  assert.equal(deduped.status, 200, JSON.stringify(deduped.body));
  const attachedIds = deduped.body.data.participant_ids.map(Number);
  assert.equal(attachedIds.filter((id) => id === convertedSiswaId).length, 1);
  assert.equal(attachedIds.filter((id) => id === convertedUmumId).length, 0);
});

test('Q6U-03 status turunan berlangsung dan selesai tanpa mengubah is_active', async () => {
  const list = await api(API_BASE, '/api/v1/tryouts', { headers: await adminHeaders() });
  assert.equal(list.status, 200);
  const listed = list.body.data.tryouts.find((item) => Number(item.event_id) === Number(regular.event_id));
  assert.ok(listed, JSON.stringify(list.body.data.tryouts.map((item) => item.event_id)));
  assert.equal(listed.status, 'berlangsung');

  const activeDetail = await api(API_BASE, `/api/v1/tryouts/${sessionIds.regular[0]}`, {
    headers: await adminHeaders()
  });
  assert.equal(activeDetail.status, 200);
  assert.equal(activeDetail.body.data.tryout.status, 'berlangsung');
  assert.equal(activeDetail.body.data.tryout.is_active, regular.is_active);

  const endedDetail = await api(API_BASE, `/api/v1/tryouts/${sessionIds.ended}`, {
    headers: await adminHeaders()
  });
  assert.equal(endedDetail.status, 200, JSON.stringify(endedDetail.body));
  assert.equal(endedDetail.body.data.tryout.status, 'selesai');
  assert.equal(endedDetail.body.data.tryout.is_active, endedEvent.is_active);
});

test('Q6U-04 form bersesi tanpa opsi aktif dan tabel tanpa kolom Lembar', () => {
  const cms = readFileSync(CMS_FILE, 'utf8');
  assert.match(cms, /sessions/);
  assert.match(cms, /mapel_code/);
  assert.doesNotMatch(cms, /mapel_codes/);
  assert.doesNotMatch(cms, /jadikan sesi aktif/i);
  assert.match(cms, /Lembar Soal/);

  const table = cms.slice(cms.indexOf('Daftar Tryout'));
  assert.doesNotMatch(table, /Lembar/);
  assert.doesNotMatch(table, /Submission/);
});

test('Q6U-05 deadline CBT memakai minimum durasi sesi dan batas induk', async () => {
  const cbtHeaders = await login(submitterEmail, cbtEvent.sessions[0].slug);
  const started = await api(PRESENTATION, '/api/v1/presentation/cbt/attempt/start', {
    method: 'POST',
    headers: cbtHeaders,
    body: JSON.stringify({ session_id: sessionIds.cbt[0] })
  });
  assert.equal(started.status, 200, JSON.stringify(started.body));
  const longSession = started.body.data;

  const otherSession = await api(PRESENTATION, '/api/v1/presentation/cbt/attempt/start', {
    method: 'POST',
    headers: cbtHeaders,
    body: JSON.stringify({ session_id: sessionIds.cbt[1] })
  });
  assert.equal(otherSession.status, 403, JSON.stringify(otherSession.body));
  assert.equal(longSession.attempt.cbt_duration_minutes, 30);

  const eventEnd = Date.parse(cbtEvent.ends_at);
  const longDeadline = Date.parse(longSession.attempt.effective_deadline_at);
  assert.ok(Math.abs(longDeadline - eventEnd) < 5000, 'deadline sesi panjang dipotong ends_at induk');
  assert.ok(longSession.attempt.deadline_at);

  const violation = await api(PRESENTATION, '/api/v1/presentation/cbt/attempt/violation', {
    method: 'POST',
    headers: cbtHeaders,
    body: JSON.stringify({
      session_id: sessionIds.cbt[0],
      violation_type: 'fullscreen_exit',
      detail: { source: 'qa-6u', session_id: sessionIds.cbt[0] }
    })
  });
  assert.equal(violation.status, 200, JSON.stringify(violation.body));
  assert.equal(violation.body.data.max_violations, 3);
});

test('Q6U-06 daftar tryout tidak memiliki kolom Submission pengganti', async () => {
  const cms = readFileSync(CMS_FILE, 'utf8');
  const table = cms.slice(cms.indexOf('Daftar Tryout'));
  assert.deepEqual(headerTexts(table), [
    'Nama', 'URL Peserta per Sesi', 'Mulai', 'Selesai', 'Mapel', 'Jenjang', 'Peserta', 'Mode', 'Status', 'Aksi'
  ]);
  assert.doesNotMatch(table, /Submission/i);

  const detail = await api(API_BASE, `/api/v1/tryouts/${sessionIds.regular[0]}`, {
    headers: await adminHeaders()
  });
  assert.equal(detail.status, 200);
  assert.ok('submission_count' in detail.body.data.tryout);
});

test('Q6U-07 baris laporan memakai tujuh kolom sesuai urutan pemilik', async () => {
  const sessionId = sessionIds.regular[0];
  const answers = await answerPayloads(sessionId);
  assert.ok(answers.length > 0);
  const submitted = await api(PRESENTATION, '/api/v1/presentation/attempts/submit-all', {
    method: 'POST',
    headers,
    body: JSON.stringify({ session_id: sessionId, answers })
  });
  assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
  assert.equal(submitted.body.data.submitted_count, answers.length);

  const report = await api(API_BASE, `/api/v1/reports/tryout?session_id=${sessionId}`, {
    headers: await adminHeaders()
  });
  assert.equal(report.status, 200, JSON.stringify(report.body));
  const row = report.body.data.summary.find((item) => Number(item.user_id) === Number(submitterId));
  assert.ok(row, JSON.stringify(report.body.data.summary));
  assert.equal(Number(row.total), answers.length);
  assert.equal(Number(row.score), Math.round((1000 * Number(row.correct)) / Number(row.total)) / 10);

  const source = readFileSync(REPORT_FILE, 'utf8');
  const blocks = [...source.matchAll(/<TableHeader>([\s\S]*?)<\/TableHeader>/g)].map((match) => match[0]);
  const summaryBlock = blocks.find((block) => block.includes('<TableHead>Nilai</TableHead>'));
  assert.ok(summaryBlock, 'Header tabel ringkasan tidak ditemukan');
  assert.deepEqual([...summaryBlock.matchAll(/<TableHead>(.*?)<\/TableHead>/g)].map((match) => match[1]), [
    'Nama', 'Sekolah', 'Mapel', 'Jumlah Soal', 'Benar', 'Salah', 'Nilai'
  ]);
  assert.match(source, /\{row\.total \?\? 0\}/);
  assert.match(source, /\{Number\(row\.score \?\? 0\)\.toFixed\(1\)\}/);
});

test('Q6U-08 ekspor XLSX terbaca dan memuat peserta tanpa submission tanpa kunci jawaban', async () => {
  const response = await fetch(
    `${API_BASE}/api/v1/reports/tryout/export.xlsx?session_id=${sessionIds.regular[0]}`,
    { headers: await adminHeaders() }
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /spreadsheetml/);
  assert.match(response.headers.get('content-disposition') ?? '', /attachment; filename="?laporan-tryout-.*\.xlsx"?/);
  const buffer = Buffer.from(await response.arrayBuffer());
  assert.equal(buffer.subarray(0, 2).toString(), 'PK');
  assert.ok(buffer.length > 1000);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  assert.ok(sheet);
  const values = [];
  sheet.eachRow((row) => row.eachCell({ includeEmpty: false }, (cell) => {
    values.push(typeof cell.value === 'string' ? cell.value : String(cell.value ?? ''));
  }));
  const content = values.join(' | ');
  assert.match(content, /HASIL TRYOUT/);
  assert.match(content, /NAMA SISWA/);
  assert.ok(content.includes(submitterName), JSON.stringify(values));
  assert.ok(content.includes(idleName), JSON.stringify(values));
  assert.doesNotMatch(content, /kunci jawaban|pembahasan|correct_key|jawaban/i);
});

test('Q6U-09 log pelanggaran tersembunyi default dan dibuka lewat Lihat detail', async () => {
  const source = readFileSync(REPORT_FILE, 'utf8');
  const state = source.match(/const \[openViolations[^\n]*/)?.[0];
  assert.ok(state);
  assert.match(state, /useState\(\{\}\)/);
  assert.match(source, /openViolations\[session\.id\]\s*\?\s*'Tutup detail'\s*:\s*'Lihat detail'/);
  assert.match(source, /\{openViolations\[session\.id\]\s*&&\s*\(/);
  assert.match(source, /JSON\.stringify\(row\.detail \?\? \{\}\)/);

  const report = await api(API_BASE, `/api/v1/reports/tryout?session_id=${sessionIds.cbt[0]}`, {
    headers: await adminHeaders()
  });
  assert.equal(report.status, 200, JSON.stringify(report.body));
  assert.ok(Array.isArray(report.body.data.violations));
  assert.ok(report.body.data.violations.some((row) => row.detail?.source === 'qa-6u'));
});

test('Q6U-10 soal non-CBT dan CBT terikat session_id yang diminta', async () => {
  const js = readFileSync(TRYOUT_JS, 'utf8');
  assert.match(js, /\/tryout\/questions\?page=\$\{page\}&limit=20\$\{sessionQuery\('&'\)\}/);
  assert.match(js, /\/presentation\/sessions/);
  assert.match(js, /session_id=/);

  for (const index of [0, 1]) {
    const sessionId = sessionIds.regular[index];
    const otherId = sessionIds.regular[1 - index];
    const expected = await assignedQuestionIds(sessionId);
    const foreign = await assignedQuestionIds(otherId);
    assert.ok(expected.length > 0 && foreign.length > 0);

    const nonCbt = await api(
      API_BASE,
      `/api/v1/tryout/questions?page=1&limit=20&session_id=${sessionId}`,
      { headers }
    );
    assert.equal(nonCbt.status, 200, JSON.stringify(nonCbt.body));
    const nonCbtIds = nonCbt.body.data.questions.map((item) => Number(item.id));
    assert.deepEqual(nonCbtIds.slice().sort((a, b) => a - b), expected.slice().sort((a, b) => a - b));
    assert.equal(nonCbt.body.data.pagination.total, expected.length);
    assert.equal(nonCbtIds.filter((id) => foreign.includes(id)).length, 0);

    const cbt = await api(PRESENTATION, `/api/v1/presentation/questions?session_id=${sessionId}`, {
      headers
    });
    assert.equal(cbt.status, 200, JSON.stringify(cbt.body));
    const cbtIds = cbt.body.data.questions.map((item) => Number(item.question_id));
    assert.deepEqual(cbtIds.slice().sort((a, b) => a - b), expected.slice().sort((a, b) => a - b));

    const blocked = await api(
      PRESENTATION,
      `/api/v1/presentation/questions/${foreign[0]}?session_id=${sessionId}`,
      { headers }
    );
    assert.equal(blocked.status, 403, JSON.stringify(blocked.body));
  }
});

test('Q6U-11 sesi target dan login ulang sebelum ends_at, gate menolak sesi baru setelahnya', async () => {
  const html = readFileSync(TRYOUT_HTML, 'utf8');
  const js = readFileSync(TRYOUT_JS, 'utf8');
  assert.match(html, /id="nextSessionButton"/);
  assert.match(html, /id="exitSessionButton"/);
  assert.match(html, /app\.js\?v=21/);
  assert.match(html, /Lanjut sesi berikutnya/);
  assert.match(js, /continueNextSession/);

  const sessions = await api(PRESENTATION, '/api/v1/presentation/sessions', { headers });
  assert.equal(sessions.status, 200, JSON.stringify(sessions.body));
  assert.equal(sessions.body.data.sessions.length, 1);
  const first = sessions.body.data.sessions[0];
  assert.equal(Number(first.id), sessionIds.regular[0]);
  assert.equal(first.completed, true);

  const relogin = await login(submitterEmail, regular.sessions[0].slug);
  const again = await api(PRESENTATION, '/api/v1/presentation/sessions', { headers: relogin });
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.equal(again.body.data.sessions.length, 1);
  const nextQuestions = await api(
    PRESENTATION,
    `/api/v1/presentation/questions?session_id=${sessionIds.regular[1]}`,
    { headers: relogin }
  );
  assert.equal(nextQuestions.status, 403, JSON.stringify(nextQuestions.body));

  await query('UPDATE tryout_events SET ends_at = now() - interval \'1 minute\' WHERE id = $1', [regular.event_id]);
  const deniedLogin = await loginRaw(submitterEmail, regular.sessions[0].slug);
  const deniedBody = await deniedLogin.json().catch(() => ({}));
  const deniedSession = await api(
    PRESENTATION,
    `/api/v1/presentation/questions?session_id=${sessionIds.regular[0]}`,
    { headers: relogin }
  );

  const failures = [];
  if (deniedLogin.status !== 401) failures.push(`login status ${deniedLogin.status}`);
  if (!/batas akhir|terlampaui|berakhir|selesai/i.test(deniedBody?.error?.message ?? '')) {
    failures.push(`pesan login tidak jelas: ${deniedBody?.error?.message ?? '-'}`);
  }
  if (deniedSession.status !== 410) failures.push(`sesi baru status ${deniedSession.status}`);
  if (!/batas akhir|terlampaui|berakhir|selesai/i.test(deniedSession.body?.error?.message ?? '')) {
    failures.push(`pesan sesi tidak jelas: ${deniedSession.body?.error?.message ?? '-'}`);
  }
  assert.deepEqual(failures, []);
});
