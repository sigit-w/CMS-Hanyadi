import { adminHeaders, API_BASE, PRESENTATION_BASE } from './auth-helper.mjs';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { query, pool } from '../../backend-agent/src/db.js';
import { config } from '../../backend-agent/src/config.js';

const MAIN = API_BASE;
const PRESENTATION = PRESENTATION_BASE;

const suffix = crypto.randomBytes(4).toString('hex');
const email = `qa_upload_${suffix}@qa.test`;
const password = crypto.randomBytes(18).toString('base64url');
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF+7V9JAAAAAElFTkSuQmCC',
  'base64'
);

let participantHeaders;
let activeSessionIds = [];
let imageQuestionId;
let textQuestionId;
let imageFilename;
const questionIds = [];

function mcPayload(stem) {
  return {
    stem,
    mapel: 'MTKA',
    question_type: 'multiple_choice',
    difficulty: 'easy',
    options: [
      { key: 'A', content: 'Salah', is_correct: false },
      { key: 'B', content: 'Benar', is_correct: true }
    ],
    correct_key: 'B',
    explanation: `Pembahasan ${stem}`
  };
}

async function request(base, pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, {
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

  const active = await query('SELECT id FROM tryout_sessions WHERE is_active');
  activeSessionIds = active.rows.map((row) => row.id);
  if (activeSessionIds.length) {
    await query('UPDATE tryout_sessions SET is_active = false WHERE is_active');
  }

  const created = await request(MAIN, '/api/v1/participants', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      nama: 'QA Upload Tryout',
      email,
      kelas: 12,
      sekolah: 'SMA Negeri 1 QA',
      password
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));

  const logged = await request(MAIN, '/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: email, password })
  });
  assert.equal(logged.status, 200, JSON.stringify(logged.body));
  const cookies = logged.headers.getSetCookie().map((item) => item.split(';')[0]).join('; ');
  participantHeaders = { Cookie: cookies };
});

after(async () => {
  if (activeSessionIds.length) {
    await query('UPDATE tryout_sessions SET is_active = true WHERE id = ANY($1::bigint[])', [activeSessionIds]);
  }
  if (questionIds.length) {
    const sources = await query(
      'SELECT DISTINCT source_id FROM questions WHERE id = ANY($1::bigint[]) AND source_id IS NOT NULL',
      [questionIds]
    );
    await query('DELETE FROM questions WHERE id = ANY($1::bigint[])', [questionIds]);
    const sourceIds = sources.rows.map((row) => row.source_id);
    if (sourceIds.length) {
      await query('DELETE FROM question_sources WHERE id = ANY($1::bigint[])', [sourceIds]);
    }
  }
  await query('DELETE FROM tryout_participants WHERE email = $1', [email]);
  if (imageFilename) {
    await fs.unlink(path.join(config.uploadDir, imageFilename)).catch(() => {});
  }
  await pool.end();
});

test('U-01 input soal menerima upload gambar dan gambar tersaji', async () => {
  const form = new FormData();
  form.append('payload', JSON.stringify(mcPayload(`QA upload gambar ${suffix}`)));
  form.append('image', new Blob([png], { type: 'image/png' }), 'soal-qa.png');
  const response = await fetch(`${MAIN}/api/v1/questions`, {
    method: 'POST',
    headers: await adminHeaders(),
    body: form
  });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.status, 201, JSON.stringify(body));
  assert.match(body.data.question.image_url, /^\/api\/v1\/uploads\/[\w-]+\.png$/);
  assert.equal(body.data.question.status, 'approved');
  imageQuestionId = body.data.question.id;
  imageFilename = body.data.question.image_url.split('/').pop();
  questionIds.push(imageQuestionId);

  const image = await fetch(`${MAIN}${body.data.question.image_url}`);
  assert.equal(image.status, 200);
  assert.match(image.headers.get('content-type') ?? '', /image\/png/);
});

test('U-02 file non-gambar ditolak saat input soal', async () => {
  const form = new FormData();
  form.append('payload', JSON.stringify(mcPayload(`QA upload invalid ${suffix}`)));
  form.append('image', new Blob(['bukan gambar'], { type: 'text/plain' }), 'soal-qa.txt');
  const response = await fetch(`${MAIN}/api/v1/questions`, {
    method: 'POST',
    headers: await adminHeaders(),
    body: form
  });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.status, 400, JSON.stringify(body));
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('U-03 soal tanpa gambar dibuat untuk pengujian penilaian server', async () => {
  const created = await request(MAIN, '/api/v1/questions', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify(mcPayload(`QA grading server ${suffix}`))
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  textQuestionId = created.body.data.question.id;
  questionIds.push(textQuestionId);
  assert.equal(created.body.data.question.status, 'approved');
});

test('U-04 detail tryout tidak mengirim kunci jawaban', async () => {
  const { status, body } = await request(
    PRESENTATION,
    `/api/v1/presentation/questions/${imageQuestionId}`,
    { headers: participantHeaders }
  );
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.data.image_url, `/api/v1/uploads/${imageFilename}`);
  assert.equal(body.data.answer, undefined);
  const raw = JSON.stringify(body);
  assert.ok(!raw.includes('correct_key'));
  assert.ok(!raw.includes('answer_text'));
  assert.ok(!raw.includes('Pembahasan QA upload gambar'));
  assert.equal(body.data.options[0].is_correct, undefined);
});

test('U-05 endpoint varian lama tidak tersedia', async () => {
  const { status, body } = await request(
    PRESENTATION,
    `/api/v1/presentation/questions/${imageQuestionId}/variants`,
    { headers: participantHeaders }
  );
  assert.equal(status, 404, JSON.stringify(body));
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('U-06 penilaian jawaban benar dilakukan server', async () => {
  const { status, body } = await request(
    PRESENTATION,
    `/api/v1/presentation/questions/${imageQuestionId}/submit`,
    {
      method: 'POST',
      headers: participantHeaders,
      body: JSON.stringify({ answer: 'B' })
    }
  );
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.data.correct, undefined);
  assert.equal(body.data.explanation, undefined);
  assert.equal(body.data.submission.is_correct, undefined);
  assert.equal(body.data.submission.answer, undefined);
  const raw = JSON.stringify(body);
  assert.ok(!raw.includes('correct_key'));
  assert.ok(!raw.includes('Pembahasan QA upload gambar'));
});

test('U-07 penilaian jawaban salah dilakukan server', async () => {
  const { status, body } = await request(
    PRESENTATION,
    `/api/v1/presentation/questions/${textQuestionId}/submit`,
    {
      method: 'POST',
      headers: participantHeaders,
      body: JSON.stringify({ answer: 'A' })
    }
  );
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.data.correct, undefined);
  assert.equal(body.data.explanation, undefined);
  assert.equal(body.data.submission.is_correct, undefined);
  assert.equal(body.data.submission.answer, undefined);
});

test('U-08 ringkasan peserta hanya berisi jumlah jawaban terkirim', async () => {
  const { status, body } = await request(
    PRESENTATION,
    '/api/v1/presentation/attempts/summary',
    { headers: participantHeaders }
  );
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.data.attempted, 2);
  assert.equal(body.data.correct, undefined);
  assert.equal(body.data.score, undefined);
});

test('U-09 submit tryout ditolak tanpa sesi', async () => {
  const response = await fetch(
    `${PRESENTATION}/api/v1/presentation/questions/${imageQuestionId}/submit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'B' })
    }
  );
  assert.equal(response.status, 401);
});
