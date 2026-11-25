import {
  activeTryoutContext, adminHeaders, API_BASE, attachQaParticipants,
  participantLogin, PRESENTATION_BASE
} from './auth-helper.mjs';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { query, pool } from '../../backend-agent/src/db.js';

const BACKEND = API_BASE;
const PRESENTATION = PRESENTATION_BASE;
const CMS_FILE = '/opt/virtual-office-bank-soal/frontend-agent/src/pages/TryoutManagement.jsx';
const TRYOUT_HTML = '/opt/virtual-office-bank-soal/tryout-agent/index.html';
const TRYOUT_JS = '/opt/virtual-office-bank-soal/tryout-agent/app.js';
const OPENAPI = '/opt/virtual-office-bank-soal/backend-agent/openapi/openapi.yaml';
const DB_DOC = '/opt/virtual-office-bank-soal/db/README.md';

const suffix = crypto.randomBytes(4).toString('hex');
const umumNama = `QA Umum ${suffix}`;
const umumPin = String(crypto.randomInt(0, 1_000_000_000)).padStart(9, '0');
const lockedNama = `QA Umum Lock ${suffix}`;
const lockedPin = String(crypto.randomInt(0, 1_000_000_000)).padStart(9, '0');

let sheetId;
let mapelCode;
let questionIds = [];
let umumId;
let lockedId;
let qaTryout;
const tryoutIds = [];

function cookies(response) {
  return response.headers.getSetCookie().map((item) => item.split(';')[0]).join('; ');
}

function jakartaInput(offsetHours = 0) {
  return new Date(Date.now() + (7 + offsetHours) * 60 * 60 * 1000).toISOString().slice(0, 16);
}

async function request(pathname, options = {}) {
  const response = await fetch(`${BACKEND}${pathname}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body, headers: response.headers };
}

async function login(username, password) {
  const response = await participantLogin(username, password, qaTryout.slug);
  return { status: response.status, body: await response.json().catch(() => ({})), headers: response.headers };
}

before(async () => {
  for (const base of [BACKEND, PRESENTATION]) {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
  }
  qaTryout = await activeTryoutContext(query);
  const sheets = await query(
    `SELECT sh.id, m.code AS mapel_code
     FROM question_sheets sh
     JOIN mapels m ON m.id = sh.mapel_id
     WHERE sh.archived = false
       AND EXISTS (
         SELECT 1 FROM question_sheet_questions qsq
         JOIN questions q ON q.id = qsq.question_id
         WHERE qsq.sheet_id = sh.id AND q.status <> 'archived'
       )
     ORDER BY sh.id DESC LIMIT 1`
  );
  assert.ok(sheets.rows[0], 'Harus ada lembar soal aktif berisi soal untuk fixture QA');
  sheetId = sheets.rows[0].id;
  mapelCode = sheets.rows[0].mapel_code;
  const questions = await query(
    `SELECT qsq.question_id
     FROM question_sheet_questions qsq
     JOIN questions q ON q.id = qsq.question_id
     WHERE qsq.sheet_id = $1 AND q.status <> 'archived'
     ORDER BY qsq.position, qsq.question_id`,
    [sheetId]
  );
  questionIds = questions.rows.map((row) => Number(row.question_id));
  assert.ok(questionIds.length > 0);
});

after(async () => {
  if (tryoutIds.length) {
    await query('DELETE FROM tryout_events WHERE id = ANY($1::bigint[])', [tryoutIds]);
  }
  await query(
    'DELETE FROM tryout_participants WHERE jenis = $1 AND lower(nama) = ANY($2::text[])',
    ['umum', [umumNama.toLowerCase(), lockedNama.toLowerCase(), `qa umum invalid ${suffix}`]]
  );
  await pool.end();
});

test('U-01 migrasi Fase 6o terpasang', async () => {
  const columns = await query(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public'
       AND ((table_name = 'tryout_participants' AND column_name IN ('jenis', 'pin_hash'))
         OR (table_name = 'tryout_sessions' AND column_name IN ('start_at', 'end_at')))`
  );
  const found = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
  for (const key of [
    'tryout_participants.jenis', 'tryout_participants.pin_hash',
    'tryout_sessions.start_at', 'tryout_sessions.end_at'
  ]) {
    assert.ok(found.has(key), `Kolom ${key} belum ada`);
  }
  const relation = await query(
    "SELECT to_regclass('public.tryout_session_sheets') IS NOT NULL AS exists"
  );
  assert.equal(relation.rows[0].exists, true);
  const nullable = await query(
    `SELECT is_nullable FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'tryout_participants'
       AND column_name = 'password_hash'`
  );
  assert.equal(nullable.rows[0].is_nullable, 'YES');
});

test('U-02 admin dapat membuat Peserta Umum dengan PIN 8 sampai 15 digit', async () => {
  const created = await request('/api/v1/participants', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      jenis: 'umum',
      nama: umumNama,
      sekolah: 'SMA Negeri QA Umum',
      pin: umumPin,
      wa_orang_tua: '081234567890'
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const participant = created.body.data.participant;
  umumId = participant.id;
  await attachQaParticipants(query, qaTryout.id, [umumId]);
  assert.equal(participant.jenis, 'umum');
  assert.equal(participant.email, null);
  assert.equal(participant.kelas, 0);
  assert.equal(participant.sekolah, 'SMA Negeri QA Umum');
  assert.equal(participant.wa_orang_tua, '081234567890');
  assert.ok(!('pin_hash' in participant));
  assert.ok(!('password_hash' in participant));

  const stored = await query('SELECT pin_hash FROM tryout_participants WHERE id = $1', [umumId]);
  assert.match(stored.rows[0].pin_hash, /^scrypt\$/);
});

test('U-03 PIN, WA, Nama, dan duplikat divalidasi', async () => {
  const headers = await adminHeaders();
  const base = {
    jenis: 'umum', nama: `QA Umum Invalid ${suffix}`, sekolah: 'SMA QA', wa_orang_tua: '081234567890'
  };
  const badPin = await request('/api/v1/participants', {
    method: 'POST', headers,
    body: JSON.stringify({ ...base, pin: '1234567' })
  });
  assert.equal(badPin.status, 400, JSON.stringify(badPin.body));

  const badWa = await request('/api/v1/participants', {
    method: 'POST', headers,
    body: JSON.stringify({ ...base, pin: umumPin, wa_orang_tua: '123' })
  });
  assert.equal(badWa.status, 400, JSON.stringify(badWa.body));

  const emptyNama = await request('/api/v1/participants', {
    method: 'POST', headers,
    body: JSON.stringify({ ...base, nama: '', pin: umumPin })
  });
  assert.equal(emptyNama.status, 400, JSON.stringify(emptyNama.body));

  const duplicate = await request('/api/v1/participants', {
    method: 'POST', headers,
    body: JSON.stringify({
      jenis: 'umum', nama: umumNama.toLowerCase(), sekolah: 'SMA QA',
      pin: umumPin, wa_orang_tua: '081234567890'
    })
  });
  assert.equal(duplicate.status, 409, JSON.stringify(duplicate.body));
});

test('U-04 Peserta Umum login dengan Nama + PIN', async () => {
  const logged = await login(umumNama, umumPin);
  assert.equal(logged.status, 200, JSON.stringify(logged.body));
  const participantHeaders = { Cookie: cookies(logged) };
  assert.deepEqual(logged.body.data.roles, ['peserta']);

  const me = await request('/api/v1/auth/me', { headers: participantHeaders });
  assert.equal(me.status, 200, JSON.stringify(me.body));
  assert.deepEqual(me.body.data.permissions, ['tryout.access', 'presentation.read']);
  assert.equal(me.body.data.user.username, umumNama);

  const questions = await request('/api/v1/tryout/questions?limit=1', { headers: participantHeaders });
  assert.equal(questions.status, 200, JSON.stringify(questions.body));
});

test('U-05 PIN salah 5 kali mengunci akun Umum', async () => {
  const created = await request('/api/v1/participants', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      jenis: 'umum', nama: lockedNama, sekolah: 'SMA QA Lock',
      pin: lockedPin, wa_orang_tua: '081234567891'
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
    lockedId = created.body.data.participant.id;
  await attachQaParticipants(query, qaTryout.id, [lockedId]);

  const wrongPin =
 String((Number(lockedPin) + 1) % 1_000_000_000).padStart(9, '0');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const failed = await login(lockedNama, wrongPin);
    assert.equal(failed.status, 401, JSON.stringify(failed.body));
    assert.doesNotMatch(failed.body.error.message, /Umum|Siswa|Umum/i);
  }
  const locked = await login(lockedNama, lockedPin);
  assert.equal(locked.status, 429, JSON.stringify(locked.body));
});

test('U-06 marker form Buat Tryout sesuai ADR-007', () => {
  const source = readFileSync(CMS_FILE, 'utf8');
  for (const marker of [
    'Nama Tryout', 'Tanggal &amp; Jam Mulai', 'Tanggal &amp; Jam Selesai',
    'Lembar Soal (', 'getQuestionSheets', 'sheet_ids', 'start_at', 'end_at',
    'Tambah Peserta Umum', 'A. Peserta Didik', 'B. Peserta Umum',
    "jenis: 'umum'", 'Nomor WA Orang Tua', 'wa_orang_tua', 'participant_ids: selectedParticipants.map(Number)'
  ]) {
    assert.ok(source.includes(marker), `Marker CMS "${marker}" tidak ditemukan`);
  }
  assert.ok(!source.includes('getQuestions'), 'Picker soal individual lama masih dipakai');
});

test('U-07 tryout tanpa peserta tetap tersimpan dari lembar soal', async () => {
  const startAt = jakartaInput(1);
  const endAt = jakartaInput(3);
  const created = await request('/api/v1/tryouts', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      name: `TO QA 6O Tanpa Peserta ${suffix}`,
      starts_at: startAt,
      ends_at: endAt,
      sessions: [{ mapel_code: mapelCode, sheet_ids: [sheetId] }],
      participant_ids: [],
      is_active: false
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const tryout = created.body.data.tryout;
  tryoutIds.push(tryout.id);
  assert.equal(tryout.participant_count, 0);
  assert.equal(tryout.participant_ids.length, 0);
  assert.deepEqual(tryout.sheet_ids.map(Number), [Number(sheetId)]);
  assert.equal(tryout.question_ids.length, questionIds.length);
  assert.ok(tryout.start_at);
  assert.ok(tryout.end_at);

  const sheets = await query(
    'SELECT count(*)::int AS total FROM tryout_session_sheets WHERE session_id = $1', [tryout.sessions[0].id]
  );
  assert.equal(sheets.rows[0].total, 1);
  const questions = await query(
    'SELECT count(*)::int AS total FROM tryout_session_questions WHERE session_id = $1', [tryout.sessions[0].id]
  );
  assert.equal(questions.rows[0].total, questionIds.length);
});

test('U-08 payload lama question_ids ditolak Fase 6y', async () => {
  const created = await request('/api/v1/tryouts', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      name: `TO QA 6O Legacy ${suffix}`,
      session_date: '2026-11-25',
      mapel_code: mapelCode,
      question_ids: questionIds.slice(0, 2),
      participant_ids: [umumId],
      is_active: false
    })
  });
  assert.equal(created.status, 400, JSON.stringify(created.body));
  assert.match(created.body.error.message, /sessions|question_ids/i);
});

test('U-09 aturan login halaman tryout diperbarui', () => {
  const html = readFileSync(TRYOUT_HTML, 'utf8');
  const js = readFileSync(TRYOUT_JS, 'utf8');
  assert.match(html, /Username peserta/);
  assert.match(html, /Password atau PIN/);
  assert.match(html, /styles\.css\?v=14/);
  assert.match(html, /app\.js\?v=20/);
  assert.doesNotMatch(html, /type="email"/);
  assert.match(js, /Nama\/email atau PIN\/password salah/);
  assert.match(js, /username: elements\.loginUsername\.value/);
  assert.match(js, /password: elements\.loginPassword\.value/);
});

test('U-10 dokumentasi OpenAPI dan DB diperbarui', () => {
  const openapi = readFileSync(OPENAPI, 'utf8');
  const dbDoc = readFileSync(DB_DOC, 'utf8');
  for (const marker of ['8–15 digit', 'start_at', 'end_at', 'sheet_ids', 'participant_ids']) {
    assert.ok(openapi.includes(marker), `OpenAPI tidak menyebut ${marker}`);
  }
  for (const marker of [
    '020_peserta_umum.sql', '021_tryout_jadwal_lembar.sql',
    '022_participant_password_nullable.sql', 'Peserta Umum'
  ]) {
    assert.ok(dbDoc.includes(marker), `DB README tidak menyebut ${marker}`);
  }
});
