import { adminHeaders, API_BASE } from './auth-helper.mjs';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { query, pool } from '../../backend-agent/src/db.js';
import { config } from '../../backend-agent/src/config.js';

const BASE = API_BASE;
const suffix = crypto.randomBytes(4).toString('hex');
const editorUsername = `qa_qm_editor_${suffix}`;
const viewerUsername = `qa_qm_viewer_${suffix}`;
const password = crypto.randomBytes(18).toString('base64url');
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF+7V9JAAAAAElFTkSuQmCC',
  'base64'
);

const usernames = [editorUsername, viewerUsername];
const questionIds = [];
let editorHeaders;
let viewerHeaders;
let imageFilename;

async function request(pathname, options = {}) {
  const headers = options.headers ?? {};
  const isForm = options.body instanceof FormData;
  const response = await fetch(`${BASE}${pathname}`, {
    ...options,
    headers: isForm ? headers : { 'Content-Type': 'application/json', ...headers }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body, headers: response.headers };
}

async function createUser(username, roles) {
  const response = await request('/api/v1/users', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      username,
      display_name: `QA ${roles[0]}`,
      password,
      roles
    })
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
}

async function login(username) {
  const response = await request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const cookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')];
  return { Cookie: cookies.filter(Boolean).map((item) => item.split(';')[0]).join('; ') };
}

function essay(stem) {
  return {
    stem,
    mapel: 'MTKA',
    question_type: 'essay',
    difficulty: 'easy',
    answer_text: 'Jawaban uji QA'
  };
}

before(async () => {
  const response = await fetch(`${BASE}/health`);
  assert.equal(response.status, 200);
  await createUser(editorUsername, ['editor']);
  await createUser(viewerUsername, ['viewer']);
  editorHeaders = await login(editorUsername);
  viewerHeaders = await login(viewerUsername);
});

after(async () => {
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
  await query('DELETE FROM contributors WHERE username = ANY($1::text[])', [usernames]);
  if (imageFilename) {
    await fs.unlink(path.join(config.uploadDir, imageFilename)).catch(() => {});
  }
  await pool.end();
});

test('M-01 editor dapat menghapus soal dan soal archived tersembunyi dari daftar aktif', async () => {
  const created = await request('/api/v1/questions', {
    method: 'POST',
    headers: editorHeaders,
    body: JSON.stringify(essay(`QA hapus editor ${suffix}`))
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.data.question.id;
  questionIds.push(id);

  const deleted = await request(`/api/v1/questions/${id}`, {
    method: 'DELETE',
    headers: editorHeaders
  });
  assert.equal(deleted.status, 200, JSON.stringify(deleted.body));
  assert.equal(deleted.body.data.question.status, 'archived');

  const active = await request('/api/v1/questions?limit=100', { headers: editorHeaders });
  assert.equal(active.status, 200);
  assert.ok(!active.body.data.questions.some((question) => question.id === id));

  const archived = await request('/api/v1/questions?status=archived&limit=100', { headers: editorHeaders });
  assert.equal(archived.status, 200);
  assert.ok(archived.body.data.questions.some((question) => question.id === id));
});

test('M-02 viewer tidak dapat menghapus soal', async () => {
  const created = await request('/api/v1/questions', {
    method: 'POST',
    headers: editorHeaders,
    body: JSON.stringify(essay(`QA hapus ditolak ${suffix}`))
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.data.question.id;
  questionIds.push(id);

  const denied = await request(`/api/v1/questions/${id}`, {
    method: 'DELETE',
    headers: viewerHeaders
  });
  assert.equal(denied.status, 403, JSON.stringify(denied.body));

  const detail = await request(`/api/v1/questions/${id}`, { headers: editorHeaders });
  assert.notEqual(detail.body.data.status, 'archived');
});

test('M-03 pertanyaan berupa gambar tanpa teks diterima', async () => {
  const form = new FormData();
  form.append('payload', JSON.stringify({ ...essay('   '), explanation: 'Soal berbasis gambar' }));
  form.append('image', new Blob([png], { type: 'image/png' }), 'pertanyaan-qa.png');
  const response = await fetch(`${BASE}/api/v1/questions`, {
    method: 'POST',
    headers: editorHeaders,
    body: form
  });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.status, 201, JSON.stringify(body));
  assert.equal(body.data.question.stem, '[Gambar soal]');
  assert.match(body.data.question.image_url, /^\/api\/v1\/uploads\/[\w-]+\.png$/);
  questionIds.push(body.data.question.id);
  imageFilename = body.data.question.image_url.split('/').pop();

  const detail = await request(`/api/v1/questions/${body.data.question.id}`, { headers: editorHeaders });
  assert.equal(detail.status, 200, JSON.stringify(detail.body));
  assert.equal(detail.body.data.image_url, body.data.question.image_url);
});
