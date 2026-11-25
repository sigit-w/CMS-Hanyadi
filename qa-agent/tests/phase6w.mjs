import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import ExcelJS from '../../backend-agent/node_modules/exceljs/excel.js';
import { adminHeaders, API_BASE, PRESENTATION_BASE, activeTryoutContext, attachQaParticipants, participantLogin, cookieHeader } from './auth-helper.mjs';
import { query, pool } from '../../backend-agent/src/db.js';
import { generateParticipantUsername, waDigits, formatJakartaDateTime } from '../../backend-agent/src/identity.js';

const suffix = crypto.randomBytes(6).toString('hex');
const jenjangCode = `QA${suffix.slice(0, 6).toUpperCase()}`;
const siswaWa = `0812${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
const umumWa = `0813${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
const siswaEmail = `qa6w-siswa-${suffix}@example.test`;
const siswaNama = `QA6W Siswa ${suffix}`;
const umumNama = `QA6W Umum ${suffix}`;
const submittedAt = '2026-11-24T10:30:45Z';

let jenjangId;
let sdJenjangId;
let smaJenjangId;
let siswaId;
let umumId;
let siswaUsername;
let umumUsername;
let siswaPassword;
let umumPin;
let tryoutId;
let sessionId;
let questionId;
const participantIds = [];

async function api(pathname, options = {}) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(await adminHeaders()), ...(options.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body, response };
}

function cellText(cell) {
  const value = cell?.value;
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (Array.isArray(value.richText)) return value.richText.map((part) => String(part.text ?? '')).join('');
    if (value.text !== undefined) return String(value.text);
  }
  return value == null ? '' : String(value);
}

function findRow(sheet, predicate) {
  let found = null;
  sheet.eachRow((row) => {
    if (!found && predicate(row)) found = row;
  });
  return found;
}

function allText(sheet) {
  const texts = [];
  sheet.eachRow((row) => row.eachCell({ includeEmpty: false }, (cell) => {
    texts.push(cellText(cell));
  }));
  return texts;
}

async function createParticipant(payload) {
  const result = await api('/api/v1/participants', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  const participant = result.body.data.participant;
  participantIds.push(Number(participant.id));
  return participant;
}

async function me(cookie) {
  return api('/api/v1/auth/me', { headers: { Cookie: cookie } });
}

before(async () => {
  for (const base of [API_BASE, PRESENTATION_BASE]) {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
  }

  const seeds = await query("SELECT id, kode FROM jenjang WHERE kode = ANY($1::text[]) ORDER BY kode", [['SD', 'SMA']]);
  const byCode = new Map(seeds.rows.map((row) => [row.kode, Number(row.id)]));
  sdJenjangId = byCode.get('SD');
  smaJenjangId = byCode.get('SMA');
  assert.ok(sdJenjangId && smaJenjangId);

  const createdJenjang = await api('/api/v1/jenjangs', {
    method: 'POST',
    body: JSON.stringify({ kode: jenjangCode, nama: `QA6W ${suffix}`, deskripsi: 'Jenjang uji QA' })
  });
  assert.equal(createdJenjang.status, 201, JSON.stringify(createdJenjang.body));
  jenjangId = Number(createdJenjang.body.data.jenjang.id);

  const siswa = await createParticipant({
    jenis: 'siswa',
    nama: siswaNama,
    email: siswaEmail,
    kelas: 9,
    sekolah: 'SMA QA 6W',
    wa_orang_tua: siswaWa,
    jenjang_id: jenjangId
  });
  siswaId = Number(siswa.id);
  siswaUsername = siswa.username;
  siswaPassword = waDigits(siswaWa);
  assert.match(siswaUsername, new RegExp(`^${jenjangCode}\\d{8}$`));

  const umum = await createParticipant({
    jenis: 'umum',
    nama: umumNama,
    sekolah: 'SMA QA 6W',
    wa_orang_tua: umumWa,
    jenjang_id: smaJenjangId
  });
  umumId = Number(umum.id);
  umumUsername = umum.username;
  umumPin = waDigits(umumWa);
  assert.match(umumUsername, /^SMA\d{8}$/);

  const active = await activeTryoutContext(query);
  await attachQaParticipants(query, active.id, [siswaId, umumId]);

  const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const endsAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
  const createdTryout = await api('/api/v1/tryouts', {
    method: 'POST',
    body: JSON.stringify({
      name: `QA6W Tryout ${suffix}`,
      starts_at: startsAt,
      ends_at: endsAt,
      participant_ids: [siswaId, umumId],
      sessions: [
        { name: `QA6W MTKA ${suffix}`, mapel_code: 'MTKA', sheet_ids: [66] },
        { name: `QA6W IPAS ${suffix}`, mapel_code: 'IPAS', sheet_ids: [67] }
      ]
    })
  });
  assert.equal(createdTryout.status, 201, JSON.stringify(createdTryout.body));
  tryoutId = Number(createdTryout.body.data.tryout.id);
  sessionId = Number(createdTryout.body.data.tryout.sessions[0].id);

  const question = await query(
    'SELECT question_id FROM question_sheet_questions WHERE sheet_id = $1 ORDER BY question_id LIMIT 1',
    [66]
  );
  assert.ok(question.rows[0]);
  questionId = Number(question.rows[0].question_id);
});

after(async () => {
  if (tryoutId) {
    await query('DELETE FROM tryout_events WHERE id = $1', [tryoutId]);
  }
  if (participantIds.length) {
    await query('DELETE FROM auth_sessions WHERE participant_id = ANY($1::bigint[])', [participantIds]);
    await query('DELETE FROM tryout_session_participants WHERE participant_id = ANY($1::bigint[])', [participantIds]);
    await query('DELETE FROM tryout_submissions WHERE participant_id = ANY($1::bigint[])', [participantIds]);
    await query('DELETE FROM siswa WHERE id = ANY($1::bigint[])', [participantIds]);
    await query('DELETE FROM prospektus WHERE id = ANY($1::bigint[])', [participantIds]);
  }
  if (jenjangId) await query('DELETE FROM jenjang WHERE id = $1', [jenjangId]);
  await pool.end();
});

test('Q6W-01 marker frontend dan generator username sesuai ADR-019', () => {
  const app = readFileSync(new URL('../../frontend-agent/src/App.jsx', import.meta.url), 'utf8');
  const mapelPage = readFileSync(new URL('../../frontend-agent/src/pages/MapelManagement.jsx', import.meta.url), 'utf8');
  const siswaPage = readFileSync(new URL('../../frontend-agent/src/pages/PesertaManagement.jsx', import.meta.url), 'utf8');
  const prospektusPage = readFileSync(new URL('../../frontend-agent/src/pages/ProspektusManagement.jsx', import.meta.url), 'utf8');
  const reportPage = readFileSync(new URL('../../frontend-agent/src/pages/TryoutReport.jsx', import.meta.url), 'utf8');
  const tryoutHtml = readFileSync(new URL('../../tryout-agent/index.html', import.meta.url), 'utf8');
  const tryoutApp = readFileSync(new URL('../../tryout-agent/app.js', import.meta.url), 'utf8');

  assert.match(app, /Kelola Mapel & Jenjang/);
  assert.doesNotMatch(app, /Kelola Mapel &amp; Jenjang/);
  assert.match(mapelPage, /Jenjang Pendidikan/);
  assert.match(mapelPage, /createJenjang/);
  assert.match(siswaPage, /Username/);
  assert.match(siswaPage, /jenjang_kode/);
  assert.match(prospektusPage, /Username/);
  assert.match(prospektusPage, /jenjang_kode/);
  assert.match(reportPage, /Cari tryout/);
  assert.match(reportPage, /Semua sesi/);
  assert.match(tryoutHtml, /Username peserta/);
  assert.match(tryoutHtml, /Contoh: SD00151234/);
  assert.match(tryoutApp, /username: elements\.loginUsername\.value/);

  assert.equal(generateParticipantUsername('SD', '081234561234', new Date('2026-01-01T08:00:00Z')), 'SD00151234');
  assert.equal(waDigits('0812-3456-1234'), '081234561234');
  assert.equal(formatJakartaDateTime('2026-11-24T10:30:45Z'), '2026-11-24 17:30:45');
});

test('Q6W-02 schema dan seed jenjang tersedia', async () => {
  const columns = await query(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE (table_name IN ('siswa', 'prospektus') AND column_name IN ('jenjang_id', 'username'))
        OR (table_name = 'tryout_submissions' AND column_name = 'participant_id')`
  );
  const found = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
  for (const key of ['siswa.jenjang_id', 'siswa.username', 'prospektus.jenjang_id', 'prospektus.username', 'tryout_submissions.participant_id']) {
    assert.ok(found.has(key), `kolom ${key} tidak ada`);
  }
  const seeds = await query('SELECT kode FROM jenjang WHERE kode = ANY($1::text[]) ORDER BY kode', [['SD', 'SMP', 'SMA']]);
  assert.deepEqual(seeds.rows.map((row) => row.kode), ['SD', 'SMA', 'SMP']);
});

test('Q6W-03 CRUD jenjang melalui API', async () => {
  const list = await api('/api/v1/jenjangs?include_inactive=true');
  assert.equal(list.status, 200);
  assert.ok(list.body.data.jenjangs.some((item) => Number(item.id) === jenjangId));

  const duplicate = await api('/api/v1/jenjangs', {
    method: 'POST',
    body: JSON.stringify({ kode: jenjangCode, nama: 'Duplikat' })
  });
  assert.equal(duplicate.status, 409);

  const invalid = await api('/api/v1/jenjangs', {
    method: 'POST',
    body: JSON.stringify({ kode: 'JENJANGPANJANG', nama: 'Invalid' })
  });
  assert.equal(invalid.status, 400);

  const updated = await api(`/api/v1/jenjangs/${jenjangId}`, {
    method: 'PUT',
    body: JSON.stringify({ kode: jenjangCode, nama: `QA6W ${suffix} update`, deskripsi: 'Jenjang uji QA ubah' })
  });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.match(updated.body.data.jenjang.nama, /update/);
});

test('Q6W-04 kredensial WA, username, dan login fallback', async () => {
  const siswaDetail = await api(`/api/v1/participants/${siswaId}/detail`);
  assert.equal(siswaDetail.status, 200);
  assert.equal(siswaDetail.body.data.participant.password_plain, siswaPassword);
  assert.equal(
    siswaUsername,
    generateParticipantUsername(jenjangCode, siswaWa, new Date(siswaDetail.body.data.participant.created_at))
  );

  const umumDetail = await api(`/api/v1/prospektus/${umumId}`);
  assert.equal(umumDetail.status, 200);
  assert.equal(umumDetail.body.data.prospektus.pin_plain, umumPin);
  assert.equal(
    umumUsername,
    generateParticipantUsername('SMA', umumWa, new Date(umumDetail.body.data.prospektus.created_at))
  );

  const active = await activeTryoutContext(query);
  for (const [identity, password, expectedUsername, jenjang] of [
    [siswaUsername, siswaPassword, siswaUsername, jenjangCode],
    [siswaEmail, siswaPassword, siswaUsername, jenjangCode],
    [umumUsername, umumPin, umumUsername, 'SMA'],
    [umumNama, umumPin, umumUsername, 'SMA']
  ]) {
    const login = await participantLogin(identity, password, active.slug);
    assert.equal(login.status, 200, `${identity}: ${await login.text()}`);
    const profile = await me(cookieHeader(login));
    assert.equal(profile.status, 200, JSON.stringify(profile.body));
    assert.equal(profile.body.data.user.username, expectedUsername);
    assert.ok(expectedUsername.startsWith(jenjang));
  }

  const siswaFilter = await api(`/api/v1/siswa?jenjang_id=${jenjangId}`);
  assert.equal(siswaFilter.status, 200);
  assert.ok(siswaFilter.body.data.siswa.some((item) => Number(item.id) === siswaId));
  const umumFilter = await api(`/api/v1/prospektus?jenjang_id=${smaJenjangId}`);
  assert.equal(umumFilter.status, 200);
  assert.ok(umumFilter.body.data.prospektus.some((item) => Number(item.id) === umumId));
});

test('Q6W-05 filter jenjang dan WAKTU pada XLSX laporan', async () => {
  await query(
    `INSERT INTO tryout_attempts (session_id, participant_id, seed, started_at, deadline_at, submitted_at, status)
     VALUES ($1, $2, 'qa6w', '2026-11-24T09:00:00Z', '2026-11-24T12:00:00Z', $3, 'submitted')
     ON CONFLICT (session_id, participant_id) DO NOTHING`,
    [sessionId, siswaId, submittedAt]
  );
  await query(
    `INSERT INTO tryout_submissions (participant_id, question_id, version, answer, is_correct, session_id)
     VALUES ($1, $2, 'A', 'A', true, $3)`,
    [siswaId, questionId, sessionId]
  );
  await query(
    `INSERT INTO tryout_submissions (participant_id, question_id, version, answer, is_correct, session_id)
     VALUES ($1, $2, 'A', 'B', false, $3)`,
    [umumId, questionId, sessionId]
  );

  const sessions = await api(`/api/v1/tryout-sessions?jenjang_id=${jenjangId}`);
  assert.equal(sessions.status, 200);
  assert.ok(sessions.body.data.sessions.some((item) => Number(item.id) === sessionId));
  const otherSessions = await api(`/api/v1/tryout-sessions?jenjang_id=${smaJenjangId}`);
  assert.equal(otherSessions.status, 200);
  assert.ok(otherSessions.body.data.sessions.some((item) => Number(item.id) === sessionId));

  const report = await api(`/api/v1/reports/tryout?session_id=${sessionId}&jenjang_id=${jenjangId}`);
  assert.equal(report.status, 200);
  assert.ok(report.body.data.sessions.some((item) => Number(item.id) === sessionId));
  assert.ok(report.body.data.summary.some((item) => Number(item.user_id) === siswaId));
  assert.ok(!report.body.data.summary.some((item) => Number(item.user_id) === umumId));

  const response = await fetch(
    `${API_BASE}/api/v1/reports/tryout/export.xlsx?session_id=${sessionId}&jenjang_id=${jenjangId}`,
    { headers: await adminHeaders() }
  );
  assert.equal(response.status, 200);
  const buffer = Buffer.from(await response.arrayBuffer());
  assert.equal(buffer.subarray(0, 2).toString(), 'PK');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  assert.ok(sheet);

  const row = findRow(sheet, (candidate) => cellText(candidate.getCell(3)) === siswaUsername);
  assert.ok(row, `baris ${siswaUsername} tidak ditemukan`);
  assert.equal(cellText(row.getCell(5)), formatJakartaDateTime(submittedAt));
  assert.ok(!findRow(sheet, (candidate) => cellText(candidate.getCell(3)) === umumUsername));

  const texts = allText(sheet).join('\n');
  for (const marker of ['New Primagama Yogyakarta', 'Yogyakarta, Selasa, 24 November 2026', 'Waktu pengerjaan']) {
    assert.ok(!texts.includes(marker), `marker identitas lama masih ada: ${marker}`);
  }
  assert.ok(!texts.includes('Kunci jawaban:'));
});
