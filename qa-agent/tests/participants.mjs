import { adminHeaders, API_BASE, PRESENTATION_BASE } from './auth-helper.mjs';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { query, pool } from '../../backend-agent/src/db.js';

const BACKEND = API_BASE;
const suffix = crypto.randomBytes(4).toString('hex');
const email = `qa_participants_${suffix}@qa.test`;
const renamedEmail = `qa_participants_renamed_${suffix}@qa.test`;
const defaultEmail = `qa_participants_default_${suffix}@qa.test`;
const password = crypto.randomBytes(18).toString('base64url');
const nextPassword = crypto.randomBytes(18).toString('base64url');
const kelas = 12;
const sekolah = 'SMA Negeri 1 QA';
const updatedKelas = 13;
const updatedSekolah = 'SMA Negeri 2 QA';

let participantId;
let participantCookie;

async function request(pathname, options = {}) {
  const response = await fetch(`${BACKEND}${pathname}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body, headers: response.headers };
}

function cookies(response) {
  return response.headers.getSetCookie().map((item) => item.split(';')[0]).join('; ');
}

async function login(username, secret) {
  return request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password: secret })
  });
}

before(async () => {
  for (const base of [BACKEND, PRESENTATION_BASE]) {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
  }
});

after(async () => {
  await query('DELETE FROM tryout_participants WHERE email = ANY($1::text[])', [[email, renamedEmail, defaultEmail]]);
  await pool.end();
});

test('P-01 admin dapat membuat dan melihat peserta tryout', async () => {
  const headers = await adminHeaders();
  const created = await request('/api/v1/participants', {
    method: 'POST',
    headers,
    body: JSON.stringify({ nama: 'QA Peserta CRUD', email, kelas, sekolah, password })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  participantId = created.body.data.participant.id;
  assert.ok(participantId > 0);
  assert.equal(created.body.data.participant.email, email);
  assert.equal(created.body.data.participant.kelas, kelas);
  assert.equal(created.body.data.participant.sekolah, sekolah);
  assert.equal(created.body.data.participant.is_active, true);
  assert.ok(!('password_hash' in created.body.data.participant));

  const listed = await request('/api/v1/participants', { headers });
  assert.equal(listed.status, 200);
  assert.ok(listed.body.data.participants.some((row) => (
    row.id === participantId && row.kelas === kelas && row.sekolah === sekolah
  )));
});

test('P-02 peserta dapat login dengan email dan menerima permission presentation', async () => {
  const logged = await login(email, password);
  assert.equal(logged.status, 200, JSON.stringify(logged.body));
  participantCookie = { Cookie: cookies(logged) };
  assert.deepEqual(logged.body.data.roles, ['peserta']);

  const me = await request('/api/v1/auth/me', { headers: participantCookie });
  assert.equal(me.status, 200);
  assert.deepEqual(me.body.data.permissions, ['tryout.access', 'presentation.read']);

  const denied = await request('/api/v1/questions?limit=1', { headers: participantCookie });
  assert.equal(denied.status, 403);
});

test('P-03 admin dapat mengubah data peserta', async () => {
  const updated = await request(`/api/v1/participants/${participantId}`, {
    method: 'PUT',
    headers: await adminHeaders(),
    body: JSON.stringify({
      nama: 'QA Peserta Diubah',
      email: renamedEmail,
      kelas: updatedKelas,
      sekolah: updatedSekolah,
      is_active: true
    })
  });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.equal(updated.body.data.participant.nama, 'QA Peserta Diubah');
  assert.equal(updated.body.data.participant.email, renamedEmail);
  assert.equal(updated.body.data.participant.kelas, updatedKelas);
  assert.equal(updated.body.data.participant.sekolah, updatedSekolah);

  const logged = await login(renamedEmail, password);
  assert.equal(logged.status, 200, JSON.stringify(logged.body));
  participantCookie = { Cookie: cookies(logged) };
});

test('P-04 email duplikat ditolak', async () => {
  const conflict = await request('/api/v1/participants', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({ nama: 'Duplikat', email: renamedEmail.toUpperCase(), kelas, sekolah, password })
  });
  assert.equal(conflict.status, 409, JSON.stringify(conflict.body));
});

test('P-05 validasi password, kelas, sekolah, dan konfirmasi', async () => {
  const headers = await adminHeaders();
  const short = await request('/api/v1/participants', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      nama: 'Pendek', email: `pendek_${suffix}@qa.test`, kelas, sekolah, password: 'satu'
    })
  });
  assert.equal(short.status, 400);

  const badKelas = await request('/api/v1/participants', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      nama: 'Kelas Salah', email: `kelas_${suffix}@qa.test`, kelas: '12.5', sekolah, password
    })
  });
  assert.equal(badKelas.status, 400, JSON.stringify(badKelas.body));

  const badSekolah = await request('/api/v1/participants', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      nama: 'Sekolah Kosong', email: `sekolah_${suffix}@qa.test`, kelas, sekolah: '   ', password
    })
  });
  assert.equal(badSekolah.status, 400, JSON.stringify(badSekolah.body));

  const mismatch = await request(`/api/v1/participants/${participantId}/password`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ password: nextPassword, confirm_password: 'tidak-sama-123' })
  });
  assert.equal(mismatch.status, 400);
});

test('P-06 reset password admin mencabut sesi lama', async () => {
  const reset = await request(`/api/v1/participants/${participantId}/password`, {
    method: 'PUT',
    headers: await adminHeaders(),
    body: JSON.stringify({ password: nextPassword, confirm_password: nextPassword })
  });
  assert.equal(reset.status, 200, JSON.stringify(reset.body));
  assert.equal(reset.body.data.sessions_revoked, true);

  const stale = await request('/api/v1/auth/me', { headers: participantCookie });
  assert.equal(stale.status, 401);

  const relogin = await login(renamedEmail, nextPassword);
  assert.equal(relogin.status, 200, JSON.stringify(relogin.body));
});

test('P-07 role peserta tidak tersedia di pengelolaan user', async () => {
  const rejected = await request('/api/v1/users', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      username: `qa_bad_peserta_${suffix}`,
      display_name: 'Tidak boleh',
      password,
      roles: ['peserta']
    })
  });
  assert.equal(rejected.status, 400, JSON.stringify(rejected.body));
  assert.match(rejected.body.error?.message ?? rejected.body.message ?? '', /Role peserta tidak tersedia/);

  const roles = await request('/api/v1/roles', { headers: await adminHeaders() });
  const peserta = roles.body.data.roles.find((role) => role.code === 'peserta');
  assert.ok(peserta);
  assert.equal(peserta.is_active, false);
});

test('P-08 menonaktifkan peserta menggagalkan login', async () => {
  const removed = await request(`/api/v1/participants/${participantId}`, {
    method: 'DELETE',
    headers: await adminHeaders()
  });
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  assert.equal(removed.body.data.deleted, true);

  const denied = await login(renamedEmail, nextPassword);
  assert.equal(denied.status, 401);

  const relogin = await login(renamedEmail, nextPassword);
  assert.equal(relogin.status, 401);
});

test('P-09 password default nama depan@mmyy dipakai saat password kosong', async () => {
  const created = await request('/api/v1/participants', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({ nama: 'Budi Default', email: defaultEmail, kelas, sekolah })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));

  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear() % 100).padStart(2, '0');
  const logged = await login(defaultEmail, `Budi@${mm}${yy}`);
  assert.equal(logged.status, 200, JSON.stringify(logged.body));
});
