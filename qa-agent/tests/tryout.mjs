import {
  activeTryoutContext, adminHeaders, API_BASE, attachQaParticipants,
  cookieHeader, participantLogin, PRESENTATION_BASE
} from './auth-helper.mjs';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { query, pool } from '../../backend-agent/src/db.js';

const DIR = '/opt/virtual-office-bank-soal/tryout-agent';
const MAIN = API_BASE;
const PRESENTATION = PRESENTATION_BASE;

const suffix = crypto.randomBytes(4).toString('hex');
const pesertaEmail = `qa_peserta_${suffix}@qa.test`;
const pesertaPassword = crypto.randomBytes(18).toString('base64url');
let pesertaHeaders;
let questionId;

async function request(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body, headers: response.headers };
}

before(async () => {
  for (const base of [MAIN, PRESENTATION]) {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
  }
  const created = await request(MAIN, '/api/v1/participants', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      nama: 'QA Peserta Tryout',
      email: pesertaEmail,
      kelas: 12,
      sekolah: 'SMA Negeri 1 QA',
      password: pesertaPassword
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const qaTryout = await activeTryoutContext(query);
  await attachQaParticipants(query, qaTryout.id, [created.body.data.participant.id]);
  const logged = await participantLogin(pesertaEmail, pesertaPassword, qaTryout.slug);
  assert.equal(logged.status, 200, JSON.stringify(await logged.json().catch(() => ({}))));
  pesertaHeaders = { Cookie: cookieHeader(logged) };
});

after(async () => {
  await query('DELETE FROM tryout_participants WHERE email = $1', [pesertaEmail]);
  await pool.end();
});

test('T-01 halaman peserta memuat elemen utama', () => {
  const html = readFileSync(`${DIR}/index.html`, 'utf8');
  assert.match(html, /Tryout Bank Soal/);
  assert.doesNotMatch(html, /id="version"/);
  assert.match(html, /id="questionList"/);
  assert.match(html, /id="questionBody"/);
  assert.match(html, /styles\.css\?v=\d+/);
  assert.match(html, /app\.js\?v=\d+/);
});

test('T-02 logika peserta memuat alur jawaban tanpa feedback skor', () => {
  const js = readFileSync(`${DIR}/app.js`, 'utf8');
  const css = readFileSync(`${DIR}/styles.css`, 'utf8');
  assert.match(js, /\/tryout\/questions/);
  assert.match(js, /presentation\/questions/);
  assert.match(js, /\/submit/);
  assert.match(js, /IMAGE_ONLY_STEM/);
  assert.match(js, /Kirim Jawaban/);
  assert.doesNotMatch(js, /attempts\/summary/);
  assert.doesNotMatch(js, /score/);
  assert.doesNotMatch(js, /benar/);
  assert.doesNotMatch(js, /correct_key/);
  assert.doesNotMatch(js, /Kunci:/);
  assert.doesNotMatch(js, /<strong>/);
  assert.match(css, /\.question-stem\s*\{[^}]*font-weight:\s*400/);
  assert.match(css, /\.question-body h3\s*\{[^}]*font-weight:\s*400/);
});

test('T-06 halaman tryout memiliki gate login', () => {
  const html = readFileSync(`${DIR}/index.html`, 'utf8');
  assert.match(html, /id="loginGate"/);
  assert.match(html, /id="loginForm"/);
  assert.match(html, /id="appMain"[^>]*hidden/);
  const js = readFileSync(`${DIR}/app.js`, 'utf8');
  assert.match(js, /checkSession/);
  assert.match(js, /credentials: 'include'/);
});

test('T-07 data tryout ditolak tanpa sesi login', async () => {
  const response = await fetch(`${PRESENTATION}/api/v1/presentation/questions/1`);
  assert.equal(response.status, 401);
  const list = await fetch(`${MAIN}/api/v1/tryout/questions?limit=1`);
  assert.equal(list.status, 401);
});

test('T-03 daftar soal approved tersedia untuk akun peserta', async () => {
  const { status, body } = await request(MAIN, '/api/v1/tryout/questions?limit=5', {
    headers: pesertaHeaders
  });
  assert.equal(status, 200, JSON.stringify(body));
  assert.ok(body.data.questions.length > 0);
  assert.ok(!('answer_text' in body.data.questions[0]));
  assert.ok(!('version' in body.data.questions[0]));
  assert.ok(!('readiness' in body.data.questions[0]));
  assert.ok(body.data.pagination.total > 0);
  questionId = body.data.questions[0].id;
});

test('T-08 peserta tetap tidak bisa mengakses endpoint CMS soal', async () => {
  const { status } = await request(MAIN, '/api/v1/questions?limit=1', {
    headers: pesertaHeaders
  });
  assert.equal(status, 403);
});

test('T-04 soal peserta dapat diambil dari presentation-service', async () => {
  const { status, body } = await request(
    PRESENTATION,
    `/api/v1/presentation/questions/${questionId}`,
    { headers: pesertaHeaders }
  );
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.data.version, undefined);
  assert.ok(body.data.stem);
});

test('T-05 semua soal approved dapat ditampilkan ke peserta', async () => {
  const list = await request(MAIN, '/api/v1/tryout/questions?limit=100', {
    headers: pesertaHeaders
  });
  assert.equal(list.status, 200);
  const ids = list.body.data.questions.map((item) => item.id);
  assert.ok(ids.length > 0);
  const failures = [];
  for (const id of ids) {
    const response = await request(
      PRESENTATION,
      `/api/v1/presentation/questions/${id}`,
      { headers: pesertaHeaders }
    );
    if (response.status !== 200) failures.push({ id, status: response.status });
  }
  assert.deepEqual(failures, []);
});
