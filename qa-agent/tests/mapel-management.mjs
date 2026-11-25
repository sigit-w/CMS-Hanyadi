import { adminHeaders, API_BASE } from './auth-helper.mjs';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { query, pool } from '../../backend-agent/src/db.js';

const BASE = API_BASE;
const suffix = crypto.randomBytes(4).toString('hex');
const code = `QA${suffix.slice(0, 2).toUpperCase()}`;
const renamedCode = `QB${suffix.slice(2, 4).toUpperCase()}`;
const editorUsername = `qa_mapel_editor_${suffix}`;
const editorRoleCode = `qa_mapelrole_${suffix}`;
const password = crypto.randomBytes(18).toString('base64url');

let mapelId;
let testSourceId;
let editorHeaders;

async function request(pathname, options = {}) {
  const response = await fetch(`${BASE}${pathname}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body, headers: response.headers };
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

before(async () => {
  const response = await fetch(`${BASE}/health`);
  assert.equal(response.status, 200);
  const role = await request('/api/v1/roles', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({ code: editorRoleCode, name: 'QA Mapel Reader' })
  });
  assert.equal(role.status, 201, JSON.stringify(role.body));
  const granted = await request(`/api/v1/roles/${role.body.data.role.id}/permissions`, {
    method: 'PUT',
    headers: await adminHeaders(),
    body: JSON.stringify({ permissions: ['cms.access', 'questions.read'] })
  });
  assert.equal(granted.status, 200, JSON.stringify(granted.body));
  const created = await request('/api/v1/users', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      username: editorUsername,
      display_name: 'QA Mapel Editor',
      password,
      roles: [editorRoleCode]
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  editorHeaders = await login(editorUsername);
});

after(async () => {
  const codes = [code, renamedCode];
  const linked = await query(
    `SELECT q.id, q.source_id FROM questions q
     JOIN mapels m ON m.id = q.mapel_id WHERE m.code = ANY($1::text[])`,
    [codes]
  );
  const questionIds = linked.rows.map((row) => row.id);
  const sourceIds = linked.rows.map((row) => row.source_id).filter(Boolean);
  if (testSourceId) sourceIds.push(testSourceId);
  if (questionIds.length) {
    await query('DELETE FROM questions WHERE id = ANY($1::bigint[])', [questionIds]);
  }
  if (sourceIds.length) {
    await query('DELETE FROM question_sources WHERE id = ANY($1::bigint[])', [sourceIds]);
  }
  await query('DELETE FROM mapels WHERE code = ANY($1::text[])', [codes]);
  await query('DELETE FROM contributors WHERE username = $1', [editorUsername]);
  await query('DELETE FROM roles WHERE code = $1', [editorRoleCode]);
  await pool.end();
});

test('MP-01 admin dapat membuat dan melihat mapel baru', async () => {
  const created = await request('/api/v1/mapels', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({ code, name: 'QA Mapel', description: 'Mapel uji CRUD' })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  mapelId = created.body.data.mapel.id;
  assert.equal(created.body.data.mapel.code, code);
  assert.equal(created.body.data.mapel.is_active, true);

  const listed = await request('/api/v1/mapels?include_inactive=true', { headers: await adminHeaders() });
  assert.equal(listed.status, 200);
  assert.ok(listed.body.data.mapels.some((row) => row.id === mapelId && row.code === code));
});

test('MP-02 kode mapel duplikat ditolak', async () => {
  const response = await request('/api/v1/mapels', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({ code: code.toLowerCase(), name: 'QA Duplikat' })
  });
  assert.equal(response.status, 409, JSON.stringify(response.body));
});

test('MP-03 admin dapat mengubah kode, nama, deskripsi, dan status mapel', async () => {
  const response = await request(`/api/v1/mapels/${mapelId}`, {
    method: 'PUT',
    headers: await adminHeaders(),
    body: JSON.stringify({
      code: renamedCode,
      name: 'QA Mapel Diubah',
      description: 'Deskripsi baru',
      is_active: false
    })
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.data.mapel.code, renamedCode);
  assert.equal(response.body.data.mapel.name, 'QA Mapel Diubah');
  assert.equal(response.body.data.mapel.is_active, false);

  const active = await request('/api/v1/mapels', { headers: await adminHeaders() });
  assert.ok(!active.body.data.mapels.some((row) => row.id === mapelId));
});

test('MP-04 editor dapat membaca mapel aktif tetapi tidak dapat mengelolanya', async () => {
  const listed = await request('/api/v1/mapels', { headers: editorHeaders });
  assert.equal(listed.status, 200);

  const deniedCreate = await request('/api/v1/mapels', {
    method: 'POST',
    headers: editorHeaders,
    body: JSON.stringify({ code: `QC${suffix.slice(4, 6).toUpperCase()}`, name: 'Ditolak' })
  });
  assert.equal(deniedCreate.status, 403, JSON.stringify(deniedCreate.body));

  const deniedInactive = await request('/api/v1/mapels?include_inactive=true', { headers: editorHeaders });
  assert.equal(deniedInactive.status, 403, JSON.stringify(deniedInactive.body));
});

test('MP-05 mapel yang dipakai soal tidak dapat dihapus', async () => {
  await query('UPDATE mapels SET is_active = true WHERE id = $1', [mapelId]);
  const question = await request('/api/v1/questions', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      stem: `QA soal mapel ${suffix}`,
      jenjang: 'SD',
      mapel: renamedCode,
      question_type: 'essay',
      answer_text: 'Jawaban uji QA'
    })
  });
  assert.equal(question.status, 201, JSON.stringify(question.body));
  const source = await query(
    'SELECT DISTINCT source_id FROM questions WHERE mapel_id = $1 AND source_id IS NOT NULL',
    [mapelId]
  );
  testSourceId = source.rows[0]?.source_id ?? null;

  const denied = await request(`/api/v1/mapels/${mapelId}`, {
    method: 'DELETE',
    headers: await adminHeaders()
  });
  assert.equal(denied.status, 409, JSON.stringify(denied.body));
});

test('MP-06 mapel yang tidak dipakai dapat dihapus', async () => {
  const linked = await query('SELECT id FROM questions WHERE mapel_id = $1', [mapelId]);
  if (linked.rows.length) {
    await query('DELETE FROM questions WHERE mapel_id = $1', [mapelId]);
  }
  const deleted = await request(`/api/v1/mapels/${mapelId}`, {
    method: 'DELETE',
    headers: await adminHeaders()
  });
  assert.equal(deleted.status, 200, JSON.stringify(deleted.body));

  const listed = await request('/api/v1/mapels?include_inactive=true', { headers: await adminHeaders() });
  assert.ok(!listed.body.data.mapels.some((row) => row.id === mapelId));
});
