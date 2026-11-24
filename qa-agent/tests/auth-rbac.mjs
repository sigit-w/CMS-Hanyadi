import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { adminHeaders, adminCookie, API_BASE } from './auth-helper.mjs';
import { query, pool } from '../../backend-agent/src/db.js';

const BASE = API_BASE;
const suffix = crypto.randomBytes(4).toString('hex');
const viewerUsername = `qa_viewer_${suffix}`;
const viewerPassword = crypto.randomBytes(18).toString('base64url');
const adminUsername = process.env.QA_ADMIN_USERNAME || 'admin';
const roleCode = `qa_role_${suffix}`;
const permRoleCode = `qa_perm_${suffix}`;
const pwdRoleCode = `qa_pwdrole_${suffix}`;
const pwdUsername = `qa_pwd_${suffix}`;
const pwdPassword = crypto.randomBytes(18).toString('base64url');
const reportUsername = `qa_report_${suffix}`;
const reportPassword = crypto.randomBytes(18).toString('base64url');
let pwdCookie;
let viewerCookie;
let roleId;

async function call(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body, headers: response.headers };
}

async function login(username, password) {
  return call('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

before(async () => {
  await adminHeaders();
});

after(async () => {
  await query('DELETE FROM contributors WHERE username IN ($1, $2, $3)', [viewerUsername, pwdUsername, reportUsername]);
  await query('DELETE FROM roles WHERE code IN ($1, $2, $3)', [roleCode, permRoleCode, pwdRoleCode]);
  await pool.end();
});

test('A-01 endpoint CMS tanpa cookie ditolak 401', async () => {
  const { status, body } = await call('/api/v1/mapels');
  assert.equal(status, 401);
  assert.equal(body.error.code, 'UNAUTHORIZED');
});

test('A-02 password salah ditolak 401', async () => {
  const { status } = await login(adminUsername, 'password-salah');
  assert.equal(status, 401);
});

test('A-03 login sukses menghasilkan cookie aman', async () => {
  const { status, headers, body } = await login(adminUsername, process.env.QA_ADMIN_PASSWORD);
  assert.equal(status, 200);
  assert.deepEqual(body.data.roles, ['admin']);
  const cookies = headers.getSetCookie();
  assert.equal(cookies.length, 2);
  for (const cookie of cookies) {
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /Secure/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.match(cookie, /Domain=\.hanyadi\.web\.id/i);
  }
});

test('A-04 /auth/me mengembalikan user, role, dan permission', async () => {
  const { status, body } = await call('/api/v1/auth/me', { headers: await adminHeaders() });
  assert.equal(status, 200);
  assert.equal(body.data.user.username, adminUsername);
  assert.ok(body.data.permissions.includes('roles.manage'));
});

test('A-05 refresh berotasi dan token lama ditolak', async () => {
  const first = await login(adminUsername, process.env.QA_ADMIN_PASSWORD);
  const firstCookie = first.headers.getSetCookie().map((item) => item.split(';')[0]).join('; ');
  const refreshed = await call('/api/v1/auth/refresh', {
    method: 'POST', headers: { Cookie: firstCookie }
  });
  assert.equal(refreshed.status, 200);
  const reuse = await call('/api/v1/auth/refresh', {
    method: 'POST', headers: { Cookie: firstCookie }
  });
  assert.equal(reuse.status, 401);
});

test('A-06 logout mencabut sesi', async () => {
  const session = await login(adminUsername, process.env.QA_ADMIN_PASSWORD);
  const cookie = session.headers.getSetCookie().map((item) => item.split(';')[0]).join('; ');
  const logout = await call('/api/v1/auth/logout', { method: 'POST', headers: { Cookie: cookie } });
  assert.equal(logout.status, 200);
  const me = await call('/api/v1/auth/me', { headers: { Cookie: cookie } });
  assert.equal(me.status, 401);
});

test('A-07 admin membuat, melihat, dan menonaktifkan role', async () => {
  const created = await call('/api/v1/roles', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({ code: roleCode, name: 'Role QA Uji' })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  roleId = created.body.data.role.id;
  const list = await call('/api/v1/roles', { headers: await adminHeaders() });
  assert.ok(list.body.data.roles.some((role) => role.code === roleCode));
  const removed = await call(`/api/v1/roles/${roleId}`, {
    method: 'DELETE', headers: await adminHeaders()
  });
  assert.equal(removed.status, 200);
});

test('A-08 guard admin terakhir menolak pencabutan', async (t) => {
  const admins = await query(
    `SELECT c.id FROM contributors c
     JOIN user_roles ur ON ur.user_id = c.id
     JOIN roles r ON r.id = ur.role_id
     WHERE r.code = 'admin' AND c.is_active = true`
  );
  if (admins.rows.length !== 1) {
    t.skip(`guard hanya dapat diuji dengan tepat satu admin aktif; ditemukan ${admins.rows.length}`);
    return;
  }
  const roles = await query("SELECT id FROM roles WHERE code = 'admin'");
  const adminRoleId = roles.rows[0].id;
  const removed = await call(`/api/v1/users/${admins.rows[0].id}/roles/${adminRoleId}`, {
    method: 'DELETE', headers: await adminHeaders()
  });
  assert.equal(removed.status, 409, JSON.stringify(removed.body));
});

test('A-09 viewer bisa baca soal tetapi tidak bisa menulis', async () => {
  const created = await call('/api/v1/users', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      username: viewerUsername,
      display_name: 'QA Viewer',
      password: viewerPassword,
      roles: ['viewer']
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.deepEqual(created.body.data.roles, ['viewer']);

  const logged = await login(viewerUsername, viewerPassword);
  assert.equal(logged.status, 200, JSON.stringify(logged.body));
  viewerCookie = logged.headers.getSetCookie().map((item) => item.split(';')[0]).join('; ');

  const read = await call('/api/v1/questions?limit=1', { headers: { Cookie: viewerCookie } });
  assert.equal(read.status, 200);
  const write = await call('/api/v1/questions', {
    method: 'POST',
    headers: { Cookie: viewerCookie },
    body: JSON.stringify({ stem: 'Tidak boleh', mapel: 'MTKA', answer_text: 'x' })
  });
  assert.equal(write.status, 403);
  const escalate = await call('/api/v1/roles', {
    method: 'POST',
    headers: { Cookie: viewerCookie },
    body: JSON.stringify({ code: 'eskalasi', name: 'Tidak boleh' })
  });
  assert.equal(escalate.status, 403);
});

test('A-11 create user memvalidasi password dan duplikat', async () => {
  const weak = await call('/api/v1/users', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      username: `qa_weak_${suffix}`, display_name: 'QA Lemah', password: 'pendek', roles: ['viewer']
    })
  });
  assert.equal(weak.status, 400);
  const duplicate = await call('/api/v1/users', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      username: viewerUsername, display_name: 'QA Duplikat',
      password: viewerPassword, roles: ['viewer']
    })
  });
  assert.equal(duplicate.status, 409);
  const invalidRole = await call('/api/v1/users', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      username: `qa_role_ngaco_${suffix}`, display_name: 'QA Role',
      password: viewerPassword, roles: ['role_tidak_ada']
    })
  });
  assert.equal(invalidRole.status, 400);
});

test('A-12 daftar permission hanya untuk admin', async () => {
  const admin = await call('/api/v1/permissions', { headers: await adminHeaders() });
  assert.equal(admin.status, 200);
  assert.deepEqual(admin.body.data.permissions.map((item) => item.code).sort(), [
    'cms.access', 'mapels.manage', 'presentation.read', 'program_belajar.manage', 'question_sheets.manage', 'questions.read',
    'questions.review', 'questions.write', 'readiness.write', 'reports.read', 'roles.manage',
    'tryout.access', 'tryout_reports.read', 'tryouts.manage', 'users.read', 'users.password.write'
  ].sort());
  const viewer = await call('/api/v1/permissions', { headers: { Cookie: viewerCookie } });
  assert.equal(viewer.status, 403);
});

test('A-13 admin mengatur permission role lewat checkbox payload', async () => {
  const created = await call('/api/v1/roles', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({ code: permRoleCode, name: 'Role QA Permission' })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const roleId = created.body.data.role.id;

  const saved = await call(`/api/v1/roles/${roleId}/permissions`, {
    method: 'PUT',
    headers: await adminHeaders(),
    body: JSON.stringify({ permissions: ['questions.read', 'presentation.read'] })
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.deepEqual(saved.body.data.permissions, ['presentation.read', 'questions.read']);

  const roles = await call('/api/v1/roles', { headers: await adminHeaders() });
  const fresh = roles.body.data.roles.find((role) => role.id === roleId);
  assert.deepEqual(fresh.permissions, ['presentation.read', 'questions.read']);

  const invalid = await call(`/api/v1/roles/${roleId}/permissions`, {
    method: 'PUT',
    headers: await adminHeaders(),
    body: JSON.stringify({ permissions: ['permission_palsu'] })
  });
  assert.equal(invalid.status, 400);

  const adminRole = roles.body.data.roles.find((role) => role.code === 'admin');
  const lockout = await call(`/api/v1/roles/${adminRole.id}/permissions`, {
    method: 'PUT',
    headers: await adminHeaders(),
    body: JSON.stringify({ permissions: ['cms.access', 'questions.read'] })
  });
  assert.equal(lockout.status, 409);

  const forbidden = await call(`/api/v1/roles/${roleId}/permissions`, {
    method: 'PUT',
    headers: { Cookie: viewerCookie },
    body: JSON.stringify({ permissions: ['questions.read'] })
  });
  assert.equal(forbidden.status, 403);
});

test('A-10 admin bisa memberi dan mencabut role pengguna', async () => {
  const roles = await call('/api/v1/roles', { headers: await adminHeaders() });
  const editorRole = roles.body.data.roles.find((role) => role.code === 'editor');
  const user = await query('SELECT id FROM contributors WHERE username = $1', [viewerUsername]);
  const userId = user.rows[0].id;
  const assigned = await call(`/api/v1/users/${userId}/roles`, {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({ code: 'editor' })
  });
  assert.equal(assigned.status, 201);
  const read = await call(`/api/v1/users/${userId}/roles`, { headers: await adminHeaders() });
  assert.ok(read.body.data.roles.some((role) => role.id === editorRole.id));
  const revoked = await call(`/api/v1/users/${userId}/roles/${editorRole.id}`, {
    method: 'DELETE', headers: await adminHeaders()
  });
  assert.equal(revoked.status, 200);
});

test('A-14 admin mengubah password pengguna dan mencabut sesi lama', async () => {
  const user = await query('SELECT id FROM contributors WHERE username = $1', [viewerUsername]);
  const userId = user.rows[0].id;
  const newPassword = crypto.randomBytes(18).toString('base64url');

  const mismatch = await call(`/api/v1/users/${userId}/password`, {
    method: 'PUT',
    headers: await adminHeaders(),
    body: JSON.stringify({ password: newPassword, confirm_password: 'tidak_sama' })
  });
  assert.equal(mismatch.status, 400);

  const weak = await call(`/api/v1/users/${userId}/password`, {
    method: 'PUT',
    headers: await adminHeaders(),
    body: JSON.stringify({ password: 'pendek', confirm_password: 'pendek' })
  });
  assert.equal(weak.status, 400);

  const changed = await call(`/api/v1/users/${userId}/password`, {
    method: 'PUT',
    headers: await adminHeaders(),
    body: JSON.stringify({ password: newPassword, confirm_password: newPassword })
  });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.equal(changed.body.data.password_changed, true);
  assert.equal(changed.body.data.sessions_revoked, true);

  const oldLogin = await login(viewerUsername, viewerPassword);
  assert.equal(oldLogin.status, 401);
  const newLogin = await login(viewerUsername, newPassword);
  assert.equal(newLogin.status, 200);

  const staleRefresh = await call('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { Cookie: viewerCookie }
  });
  assert.equal(staleRefresh.status, 401);

  const forbidden = await call(`/api/v1/users/${userId}/password`, {
    method: 'PUT',
    headers: { Cookie: viewerCookie },
    body: JSON.stringify({ password: newPassword, confirm_password: newPassword })
  });
  assert.equal(forbidden.status, 401);
});

test('A-15 cookie admin masih berlaku setelah rangkaian uji', async () => {
  const { status } = await call('/api/v1/mapels', { headers: await adminHeaders() });
  assert.equal(status, 200);
  assert.ok((await adminCookie()).includes('access_token='));
});

test('A-16 permission users.password.write mengontrol fitur ubah password', async () => {
  const createdRole = await call('/api/v1/roles', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({ code: pwdRoleCode, name: 'Role QA Password' })
  });
  assert.equal(createdRole.status, 201, JSON.stringify(createdRole.body));
  const roleId = createdRole.body.data.role.id;

  const createdUser = await call('/api/v1/users', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      username: pwdUsername,
      display_name: 'QA Password',
      password: pwdPassword,
      roles: [pwdRoleCode]
    })
  });
  assert.equal(createdUser.status, 201, JSON.stringify(createdUser.body));
  const userId = createdUser.body.data.user.id;

  const logged = await login(pwdUsername, pwdPassword);
  assert.equal(logged.status, 200);
  pwdCookie = logged.headers.getSetCookie().map((item) => item.split(';')[0]).join('; ');

  const nextPassword = crypto.randomBytes(18).toString('base64url');
  const denied = await call(`/api/v1/users/${userId}/password`, {
    method: 'PUT',
    headers: { Cookie: pwdCookie },
    body: JSON.stringify({ password: nextPassword, confirm_password: nextPassword })
  });
  assert.equal(denied.status, 403);

  const granted = await call(`/api/v1/roles/${roleId}/permissions`, {
    method: 'PUT',
    headers: await adminHeaders(),
    body: JSON.stringify({ permissions: ['cms.access', 'users.password.write'] })
  });
  assert.equal(granted.status, 200);

  const allowed = await call(`/api/v1/users/${userId}/password`, {
    method: 'PUT',
    headers: { Cookie: pwdCookie },
    body: JSON.stringify({ password: nextPassword, confirm_password: nextPassword })
  });
  assert.equal(allowed.status, 200, JSON.stringify(allowed.body));

  const relogin = await login(pwdUsername, nextPassword);
  assert.equal(relogin.status, 200);
});

test('A-17 permission reports.read default hanya admin dan tidak bisa dicabut dari admin', async () => {
  const adminMe = await call('/api/v1/auth/me', { headers: await adminHeaders() });
  assert.ok(adminMe.body.data.permissions.includes('reports.read'));

  const roles = await call('/api/v1/roles', { headers: await adminHeaders() });
  const adminRole = roles.body.data.roles.find((role) => role.code === 'admin');
  assert.ok(adminRole.permissions.includes('reports.read'));
  for (const code of ['editor', 'validator', 'viewer', 'peserta']) {
    const role = roles.body.data.roles.find((item) => item.code === code);
    assert.ok(!(role.permissions ?? []).includes('reports.read'), `${code} tidak boleh memiliki reports.read`);
  }

  const stripped = await call(`/api/v1/roles/${adminRole.id}/permissions`, {
    method: 'PUT',
    headers: await adminHeaders(),
    body: JSON.stringify({ permissions: adminRole.permissions.filter((code) => code !== 'reports.read') })
  });
  assert.equal(stripped.status, 409);

  const created = await call('/api/v1/users', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      username: reportUsername,
      display_name: 'QA Report',
      password: reportPassword,
      roles: ['viewer']
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));

  const logged = await login(reportUsername, reportPassword);
  assert.equal(logged.status, 200);
  const cookie = logged.headers.getSetCookie().map((item) => item.split(';')[0]).join('; ');
  const me = await call('/api/v1/auth/me', { headers: { Cookie: cookie } });
  assert.equal(me.status, 200);
  assert.ok(!me.body.data.permissions.includes('reports.read'));
});
