import {
  activeTryoutContext, adminHeaders, API_BASE, attachQaParticipants,
  cookieHeader, participantLogin, PRESENTATION_BASE
} from './auth-helper.mjs';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { query, pool } from '../../backend-agent/src/db.js';

const ROOT = '/opt/virtual-office-bank-soal';
const DIST = `${ROOT}/frontend-agent/dist/assets`;
const OPENAPI = `${ROOT}/backend-agent/openapi/openapi.yaml`;
const DB_DOC = `${ROOT}/db/README.md`;
const API_DOC = `${ROOT}/backend-agent/README.md`;
const ADR = `${ROOT}/pm-agent/decisions/ADR-011-tryout-scoped-login-dan-pemisahan-siswa.md`;
const BACKLOG = `${ROOT}/pm-agent/tasks/phase6s-backlog.md`;
const STATUS_BOARD = `${ROOT}/pm-agent/progress/status-board.md`;
const QA_REPORT = `${ROOT}/qa-agent/reports/phase6s-report.md`;
const QA_GATE = `${ROOT}/qa-agent/reports/phase6s-release-gate.md`;
const TRYOUT_PAGE = `${ROOT}/frontend-agent/src/pages/TryoutManagement.jsx`;
const SISWA_PAGE = `${ROOT}/frontend-agent/src/pages/PesertaManagement.jsx`;
const PROSPEKTUS_PAGE = `${ROOT}/frontend-agent/src/pages/ProspektusManagement.jsx`;
const TRYOUT_AGENT = `${ROOT}/tryout-agent/app.js`;
const TRYOUT_HTML = `${ROOT}/tryout-agent/index.html`;

const suffix = crypto.randomBytes(4).toString('hex');
const siswaEmail = `qa6s.siswa.${suffix}@example.com`;
const siswaPassword = `Siswa${suffix}A`;
const outsiderEmail = `qa6s.outsider.${suffix}@example.com`;
const outsiderPassword = `Outsider${suffix}B`;
const umumNama = `QA 6S Umum ${suffix}`;
const umumPin = String(crypto.randomInt(0, 1_000_000_000)).padStart(9, '0');
const daftarEmail = `qa6s.daftar.${suffix}@example.com`;
const daftarPassword = `Daftar${suffix}C`;

let qaTryout;
let siswaId;
let outsiderId;
let umumId;
let convertedId;
let participantCookie;

async function api(pathname, options = {}) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...await adminHeaders(), ...(options.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function login(username, password, slug = qaTryout.slug) {
  const response = await participantLogin(username, password, slug);
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body, cookie: cookieHeader(response) };
}

async function createParticipant(payload) {
  const result = await api('/api/v1/participants', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body.data.participant;
}

before(async () => {
  for (const base of [API_BASE, PRESENTATION_BASE]) {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
  }
  qaTryout = await activeTryoutContext(query);
});

after(async () => {
  const ids = [siswaId, outsiderId, umumId, convertedId].filter(Boolean);
  if (ids.length) {
    await query('DELETE FROM auth_sessions WHERE participant_id = ANY($1::bigint[])', [ids]);
    await query('DELETE FROM tryout_participants WHERE id = ANY($1::bigint[])', [ids]);
  }
  await pool.end();
});

test('QS-01 migrasi 025 dan skema marker tryout terpasang', async () => {
  const columns = await query(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public'
       AND ((table_name = 'tryout_sessions' AND column_name = 'slug')
         OR (table_name = 'auth_sessions' AND column_name = 'tryout_session_id'))`
  );
  const found = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
  assert.ok(found.has('tryout_sessions.slug'));
  assert.ok(found.has('auth_sessions.tryout_session_id'));

  const constraints = await query(
    `SELECT conname FROM pg_constraint
     WHERE connamespace = 'public'::regnamespace
       AND conname IN ('auth_sessions_tryout_session_id_fkey',
                       'auth_sessions_participant_tryout_check')`
  );
  const names = new Set(constraints.rows.map((row) => row.conname));
  for (const name of [
    'auth_sessions_tryout_session_id_fkey',
    'auth_sessions_participant_tryout_check'
  ]) {
    assert.ok(names.has(name), `Constraint ${name} belum ada`);
  }
  const index = await query(
    `SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'uq_tryout_sessions_slug'`
  );
  assert.equal(index.rows.length, 1, 'Index uq_tryout_sessions_slug belum ada');
  assert.match(qaTryout.slug, /^[a-z0-9][a-z0-9-]{0,31}$/);
});

test('QS-02 login participant wajib marker dan keanggotaan tryout', async () => {
  siswaId = (await createParticipant({
    nama: `QA 6S Siswa ${suffix}`,
    email: siswaEmail,
    kelas: 9,
    sekolah: 'SMA QA 6S',
    password: siswaPassword
  })).id;
  outsiderId = (await createParticipant({
    nama: `QA 6S Outsider ${suffix}`,
    email: outsiderEmail,
    kelas: 9,
    sekolah: 'SMA QA 6S',
    password: outsiderPassword
  })).id;
  await attachQaParticipants(query, qaTryout.id, [siswaId]);

  const noSlug = await login(siswaEmail, siswaPassword, '');
  assert.equal(noSlug.status, 401, JSON.stringify(noSlug.body));
  assert.match(noSlug.body.error.message, /tautan tryout/i);

  const wrongSlug = await login(siswaEmail, siswaPassword, 'slug-yang-tidak-ada');
  assert.equal(wrongSlug.status, 401, JSON.stringify(wrongSlug.body));

  const outsider = await login(outsiderEmail, outsiderPassword);
  assert.equal(outsider.status, 401, JSON.stringify(outsider.body));
  assert.match(outsider.body.error.message, /tidak terdaftar/i);

  const accepted = await login(siswaEmail, siswaPassword);
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  participantCookie = accepted.cookie;
  assert.ok(participantCookie.includes('access_token='));

  const me = await api('/api/v1/auth/me', { headers: { Cookie: participantCookie } });
  assert.equal(me.status, 200, JSON.stringify(me.body));
  assert.equal(Number(me.body.data.tryout_session_id), Number(qaTryout.id));
  assert.equal(me.body.data.tryout_session_slug, qaTryout.slug);
});

test('QS-03 daftar siswa dan peserta tryout terpisah', async () => {
  umumId = (await createParticipant({
    jenis: 'umum',
    nama: umumNama,
    sekolah: 'Sekolah QA 6S',
    pin: umumPin,
    wa_orang_tua: '081234567890'
  })).id;
  await attachQaParticipants(query, qaTryout.id, [umumId]);

  const siswaList = await api('/api/v1/siswa');
  assert.equal(siswaList.status, 200, JSON.stringify(siswaList.body));
  const siswaIds = siswaList.body.data.siswa.map((row) => Number(row.id));
  assert.ok(siswaIds.includes(Number(siswaId)));
  assert.equal(siswaIds.includes(Number(umumId)), false);

  const tryoutParticipants = await api(`/api/v1/tryouts/${qaTryout.id}/participants`);
  assert.equal(tryoutParticipants.status, 200, JSON.stringify(tryoutParticipants.body));
  const attachedIds = tryoutParticipants.body.data.participants.map((row) => Number(row.id));
  assert.ok(attachedIds.includes(Number(siswaId)));
  assert.ok(attachedIds.includes(Number(umumId)));
  assert.equal(attachedIds.includes(Number(outsiderId)), false);
});

test('QS-04 peserta tryout tetap di prospektus sampai dikonversi eksplisit', async () => {
  const beforeConversion = await query(
    `SELECT EXISTS (SELECT 1 FROM prospektus WHERE id = $1) AS in_prospektus,
            EXISTS (SELECT 1 FROM siswa WHERE id = $1) AS in_siswa`,
    [umumId]
  );
  assert.equal(beforeConversion.rows[0].in_prospektus, true);
  assert.equal(beforeConversion.rows[0].in_siswa, false);

  const loginUmum = await login(umumNama, umumPin);
  assert.equal(loginUmum.status, 200, JSON.stringify(loginUmum.body));

  const converted = await api(`/api/v1/prospektus/${umumId}/daftar`, {
    method: 'POST',
    body: JSON.stringify({
      email: daftarEmail,
      kelas: 10,
      password: daftarPassword,
      wa_orang_tua: '081234567891'
    })
  });
  assert.equal(converted.status, 201, JSON.stringify(converted.body));
  convertedId = converted.body.data.participant.id;

  const joined = await query('SELECT bergabung FROM prospektus WHERE id = $1', [umumId]);
  assert.equal(joined.rows[0].bergabung, true);
  const newSiswa = await query('SELECT email FROM siswa WHERE id = $1', [convertedId]);
  assert.equal(newSiswa.rows[0].email, daftarEmail);

  await attachQaParticipants(query, qaTryout.id, [convertedId]);
  const loginConverted = await login(daftarEmail, daftarPassword);
  assert.equal(loginConverted.status, 200, JSON.stringify(loginConverted.body));
});

test('QS-05 presentation-service memakai tryout binding, bukan sesi aktif global', async () => {
  const list = await api('/api/v1/tryout/questions?limit=1', {
    headers: { Cookie: participantCookie }
  });
  assert.equal(list.status, 200, JSON.stringify(list.body));
  assert.ok(list.body.data.questions.length > 0);
  const questionId = list.body.data.questions[0].id;

  const question = await fetch(`${PRESENTATION_BASE}/api/v1/presentation/questions/${questionId}`, {
    headers: { Cookie: participantCookie }
  });
  assert.equal(question.status, 200, await question.text());

  const submitted = await fetch(`${PRESENTATION_BASE}/api/v1/presentation/questions/${questionId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: participantCookie },
    body: JSON.stringify({ answer: 'B', answer_text: null })
  });
  assert.equal(submitted.status, 200, await submitted.text());

  const stored = await query(
    `SELECT session_id FROM tryout_submissions
     WHERE participant_id = $1 AND question_id = $2 AND version = 'v1'`,
    [siswaId, questionId]
  );
  assert.equal(Number(stored.rows[0].session_id), Number(qaTryout.id));
});

test('QS-06 marker UI Fase 6s tersedia di source dan bundle produksi', () => {
  const tryoutPage = readFileSync(TRYOUT_PAGE, 'utf8');
  for (const marker of [
    'TRYOUT_BASE_URL', 'tryoutUrl(', 'URL Peserta per Sesi', 'Salin', 'getSiswa',
    'getTryoutParticipants', 'A. Peserta Didik', 'Kelola Peserta'
  ]) {
    assert.ok(tryoutPage.includes(marker), `Marker ${marker} tidak ditemukan di TryoutManagement`);
  }
  const siswaPage = readFileSync(SISWA_PAGE, 'utf8');
  assert.ok(siswaPage.includes('getSiswa'), 'Kelola Siswa belum memakai getSiswa');
  assert.equal(siswaPage.includes('getParticipants'), false);
  const prospektusPage = readFileSync(PROSPEKTUS_PAGE, 'utf8');
  assert.ok(prospektusPage.includes('Daftarkan sebagai Siswa'));

  const agentJs = readFileSync(TRYOUT_AGENT, 'utf8');
  for (const marker of ['TRYOUT_SLUG', 'tryout_slug', 'resolveTryoutSlug', 'Tautan tryout tidak valid']) {
    assert.ok(agentJs.includes(marker), `Marker ${marker} tidak ditemukan di tryout-agent/app.js`);
  }
  assert.match(readFileSync(TRYOUT_HTML, 'utf8'), /app\.js\?v=\d+/);

  const assets = readdirSync(DIST).filter((file) => file.endsWith('.js'));
  const bundle = readFileSync(`${DIST}/${assets[0]}`, 'utf8');
  for (const marker of ['https://tryout.hanyadi.web.id', 'URL Peserta per Sesi', 'Salin']) {
    assert.ok(bundle.includes(marker), `Marker bundle ${marker} tidak ditemukan`);
  }
});

test('QS-07 kontrak, ADR, backlog, dan laporan Fase 6s lengkap', () => {
  const openapi = readFileSync(OPENAPI, 'utf8');
  for (const marker of [
    '/api/v1/siswa', '/api/v1/tryouts/{id}/participants', 'tryout_slug',
    'tryout_session_id'
  ]) {
    assert.ok(openapi.includes(marker), `OpenAPI belum punya ${marker}`);
  }
  const dbDoc = readFileSync(DB_DOC, 'utf8');
  assert.ok(dbDoc.includes('025_tryout_slug_login_scope.sql'));
  assert.ok(readFileSync(API_DOC, 'utf8').includes('ADR-011'));
  assert.ok(readFileSync(ADR, 'utf8').includes('ADR-011'));
  assert.ok(readFileSync(BACKLOG, 'utf8').includes('R8'));
  assert.ok(readFileSync(STATUS_BOARD, 'utf8').includes('Fase 6s'));
  assert.ok(readFileSync(QA_REPORT, 'utf8').includes('Fase 6s'));
  assert.ok(readFileSync(QA_GATE, 'utf8').includes('REL-21 GO'));
});
