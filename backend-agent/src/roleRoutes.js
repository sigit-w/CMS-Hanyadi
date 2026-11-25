import { Router } from 'express';
import { query, withTransaction } from './db.js';
import { ApiError, asyncHandler } from './errors.js';
import { authorize } from './authMiddleware.js';
import { parseId } from './validate.js';
import { hashPassword } from './auth.js';

export const roleRouter = Router();

const nowMeta = () => ({ ts: new Date().toISOString() });

const adminOnly = authorize('roles.manage');
const managePassword = authorize('users.password.write');
const adminRequiredPermissions = ['roles.manage', 'reports.read', 'mapels.manage'];
const participantOnlyRole = 'peserta';
const removedRoleCodes = new Set(['editor', 'validator', 'viewer']);

function rejectParticipantRole(codes) {
  if (codes.includes(participantOnlyRole)) {
    throw new ApiError('VALIDATION_ERROR', 'Role peserta tidak tersedia; buat peserta lewat halaman CRUD Peserta');
  }
}

function rejectRemovedRole(codes) {
  const removed = codes.find((code) => removedRoleCodes.has(code));
  if (removed) throw new ApiError('VALIDATION_ERROR', `Role ${removed} sudah dihapus`);
}

roleRouter.get('/roles', adminOnly, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT r.id, r.code, r.name, r.description, r.is_active, r.is_system,
            (SELECT count(*) FROM user_roles ur WHERE ur.role_id = r.id)::int AS user_count,
            (SELECT array_agg(p.code ORDER BY p.code) FROM role_permissions rp
             JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = r.id) AS permissions
     FROM roles r ORDER BY r.id`
  );
  res.json({ ok: true, data: { roles: rows }, meta: nowMeta() });
}));

roleRouter.post('/roles', adminOnly, asyncHandler(async (req, res) => {
  const code = String(req.body?.code ?? '').trim().toLowerCase();
  const name = String(req.body?.name ?? '').trim();
  if (!/^[a-z][a-z0-9_]{2,31}$/.test(code)) {
    throw new ApiError('VALIDATION_ERROR', 'Kode role harus 3–32 huruf/angka/underscore');
  }
  if (!name) throw new ApiError('VALIDATION_ERROR', 'Nama role wajib diisi');
  rejectParticipantRole([code]);
  rejectRemovedRole([code]);

  const { rows } = await query(
    `INSERT INTO roles (code, name, description)
     VALUES ($1, $2, $3)
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
     RETURNING id, code, name, description, is_active`,
    [code, name, req.body?.description ?? null]
  );
  res.status(201).json({ ok: true, data: { role: rows[0] }, meta: nowMeta() });
}));

roleRouter.put('/roles/:id', adminOnly, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const name = String(req.body?.name ?? '').trim();
  if (!name) throw new ApiError('VALIDATION_ERROR', 'Nama role wajib diisi');
  const isActive = req.body?.is_active === undefined ? true : Boolean(req.body.is_active);
  if (isActive) {
    const existing = await query('SELECT code FROM roles WHERE id = $1', [id]);
    rejectParticipantRole(existing.rows.map((row) => row.code));
  }

  const { rows } = await query(
    `UPDATE roles SET name = $2, description = $3, is_active = $4
     WHERE id = $1 AND NOT (code = 'admin' AND $4 = false AND is_system = true)
     RETURNING id, code, name, description, is_active`,
    [id, name, req.body?.description ?? null, isActive]
  );
  if (!rows[0]) throw new ApiError('CONFLICT', 'Role admin sistem tidak boleh dinonaktifkan', 409);
  res.json({ ok: true, data: { role: rows[0] }, meta: nowMeta() });
}));

roleRouter.delete('/roles/:id', adminOnly, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { rows } = await query(
    `UPDATE roles SET is_active = false
     WHERE id = $1 AND is_system = false AND is_active = true
     RETURNING id, code, is_active`,
    [id]
  );
  if (!rows[0]) throw new ApiError('CONFLICT', 'Role sistem tidak bisa dihapus', 409);
  res.json({ ok: true, data: { role: rows[0] }, meta: nowMeta() });
}));

roleRouter.get('/permissions', adminOnly, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT id, code, description FROM permissions ORDER BY code');
  res.json({ ok: true, data: { permissions: rows }, meta: nowMeta() });
}));

roleRouter.put('/roles/:id/permissions', adminOnly, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const requested = req.body?.permissions;
  if (!Array.isArray(requested) || requested.some((code) => typeof code !== 'string')) {
    throw new ApiError('VALIDATION_ERROR', 'permissions harus berupa array kode permission');
  }
  const codes = [...new Set(requested.map((code) => code.trim()).filter(Boolean))].sort();

  const result = await withTransaction(async (client) => {
    const role = await client.query('SELECT id, code FROM roles WHERE id = $1', [id]);
    if (!role.rows[0]) throw new ApiError('NOT_FOUND', 'Role tidak ditemukan', 404);

    let permissions = [];
    if (codes.length) {
      permissions = await client.query(
        'SELECT id, code FROM permissions WHERE code = ANY($1::text[]) ORDER BY code',
        [codes]
      );
      if (permissions.rows.length !== codes.length) {
        throw new ApiError('VALIDATION_ERROR', 'Satu atau lebih kode permission tidak ditemukan');
      }
    }
    if (role.rows[0].code === 'admin') {
      const missing = adminRequiredPermissions.find((code) => !codes.includes(code));
      if (missing) {
        throw new ApiError('CONFLICT', `Role admin harus tetap memiliki ${missing}`, 409);
      }
    }

    await client.query('DELETE FROM role_permissions WHERE role_id = $1', [id]);
    for (const permission of permissions.rows) {
      await client.query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
        [id, permission.id]
      );
    }
    return { role: role.rows[0], permissions: permissions.rows.map((item) => item.code) };
  });

  res.json({
    ok: true,
    data: { role: result.role, permissions: result.permissions },
    meta: nowMeta()
  });
}));

roleRouter.post('/users', adminOnly, asyncHandler(async (req, res) => {
  const username = String(req.body?.username ?? '').trim().toLowerCase();
  const displayName = String(req.body?.display_name ?? '').trim();
  const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : null;
  const password = String(req.body?.password ?? '');
  const roleCodes = Array.isArray(req.body?.roles) ? req.body.roles : [];

  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
    throw new ApiError('VALIDATION_ERROR', 'Username harus 3–32 karakter huruf kecil, angka, titik, atau underscore');
  }
  if (!displayName) throw new ApiError('VALIDATION_ERROR', 'Nama tampilan wajib diisi');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError('VALIDATION_ERROR', 'Format email tidak valid');
  }
  if (password.length < 12) {
    throw new ApiError('VALIDATION_ERROR', 'Password minimal 12 karakter');
  }
  if (roleCodes.length === 0 || roleCodes.some((code) => typeof code !== 'string')) {
    throw new ApiError('VALIDATION_ERROR', 'Pilih minimal satu role untuk pengguna');
  }
  rejectParticipantRole(roleCodes);
  rejectRemovedRole(roleCodes);

  const passwordHash = await hashPassword(password);

  const result = await withTransaction(async (client) => {
    const roles = await client.query(
      `SELECT id, code FROM roles WHERE is_active = true AND code = ANY($1::text[]) ORDER BY id`,
      [roleCodes]
    );
    if (roles.rows.length !== new Set(roleCodes).size) {
      throw new ApiError('VALIDATION_ERROR', 'Satu atau lebih role tidak ditemukan atau tidak aktif');
    }
    const duplicate = await client.query(
      'SELECT id FROM contributors WHERE lower(username) = $1 OR lower(email) = $2',
      [username, email ?? '']
    );
    if (duplicate.rows[0]) throw new ApiError('CONFLICT', 'Username atau email sudah dipakai', 409);

    const user = await client.query(
      `INSERT INTO contributors (username, display_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, username, display_name, email`,
      [username, displayName, email, passwordHash, roles.rows[0].code]
    );
    const userId = user.rows[0].id;
    for (const role of roles.rows) {
      await client.query(
        'INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES ($1, $2, $3)',
        [userId, role.id, req.auth.user.id]
      );
    }
    return { user: user.rows[0], roles: roles.rows.map((role) => role.code) };
  });

  res.status(201).json({ ok: true, data: { user: result.user, roles: result.roles }, meta: nowMeta() });
}));

roleRouter.put('/users/:id/password', managePassword, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const password = String(req.body?.password ?? '');
  if (password.length < 12) {
    throw new ApiError('VALIDATION_ERROR', 'Password minimal 12 karakter');
  }
  if (req.body?.confirm_password !== undefined && req.body.confirm_password !== password) {
    throw new ApiError('VALIDATION_ERROR', 'Konfirmasi password tidak cocok');
  }
  const passwordHash = await hashPassword(password);
  const user = await withTransaction(async (client) => {
    const updated = await client.query(
      `UPDATE contributors
       SET password_hash = $2, failed_login_count = 0, locked_until = NULL
       WHERE id = $1 AND is_active = true
       RETURNING id, username, display_name`,
      [id, passwordHash]
    );
    if (!updated.rows[0]) throw new ApiError('NOT_FOUND', 'Pengguna tidak ditemukan atau tidak aktif', 404);
    await client.query(
      'UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [id]
    );
    return updated.rows[0];
  });
  res.json({
    ok: true,
    data: { user, password_changed: true, sessions_revoked: true },
    meta: nowMeta()
  });
}));

roleRouter.get('/users', adminOnly, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT c.id, c.username, c.display_name, c.email, c.is_active,
            COALESCE(array_agg(r.code ORDER BY r.code) FILTER (WHERE r.id IS NOT NULL), '{}') AS roles
     FROM contributors c
     LEFT JOIN user_roles ur ON ur.user_id = c.id AND ur.role_id IN (SELECT id FROM roles WHERE is_active = true)
     LEFT JOIN roles r ON r.id = ur.role_id
     GROUP BY c.id ORDER BY c.id`
  );
  res.json({ ok: true, data: { users: rows }, meta: nowMeta() });
}));

roleRouter.get('/users/:id/roles', adminOnly, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const user = await query('SELECT id, username, display_name FROM contributors WHERE id = $1', [id]);
  if (!user.rows[0]) throw new ApiError('NOT_FOUND', 'Pengguna tidak ditemukan', 404);
  const { rows } = await query(
    `SELECT r.id, r.code, r.name FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1 ORDER BY r.id`,
    [id]
  );
  res.json({ ok: true, data: { user: user.rows[0], roles: rows }, meta: nowMeta() });
}));

roleRouter.post('/users/:id/roles', adminOnly, asyncHandler(async (req, res) => {
  const userId = parseId(req.params.id);
  const roleCode = String(req.body?.code ?? '').trim().toLowerCase();
  const roleId = req.body?.role_id === undefined ? null : parseId(req.body.role_id, 'role_id');
  rejectParticipantRole([roleCode]);
  rejectRemovedRole([roleCode]);

  const result = await withTransaction(async (client) => {
    const user = await client.query('SELECT id FROM contributors WHERE id = $1 AND is_active = true', [userId]);
    if (!user.rows[0]) throw new ApiError('NOT_FOUND', 'Pengguna tidak ditemukan', 404);
    const role = await client.query(
      `SELECT id FROM roles WHERE is_active = true AND ($2::bigint IS NULL AND code = $1 OR id = $2)`,
      [roleCode || null, roleId]
    );
    if (!role.rows[0]) throw new ApiError('VALIDATION_ERROR', 'Role tidak ditemukan atau tidak aktif');
    await client.query(
      `INSERT INTO user_roles (user_id, role_id, assigned_by)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [userId, role.rows[0].id, req.auth.user.id]
    );
    return { userId, roleId: role.rows[0].id };
  });
  res.status(201).json({ ok: true, data: { assignment: result }, meta: nowMeta() });
}));

roleRouter.delete('/users/:id/roles/:roleId', adminOnly, asyncHandler(async (req, res) => {
  const userId = parseId(req.params.id);
  const roleId = parseId(req.params.roleId, 'role_id');

  await withTransaction(async (client) => {
    const role = await client.query('SELECT code FROM roles WHERE id = $1', [roleId]);
    if (!role.rows[0]) throw new ApiError('NOT_FOUND', 'Role tidak ditemukan', 404);
    if (role.rows[0].code === 'admin') {
      const admins = await client.query(
        `SELECT count(*)::int AS total FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         JOIN contributors c ON c.id = ur.user_id
         WHERE r.code = 'admin' AND c.is_active = true`
      );
      if (admins.rows[0].total <= 1) {
        throw new ApiError('CONFLICT', 'Tidak boleh mencabut role admin terakhir', 409);
      }
    }
    await client.query('DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2', [userId, roleId]);
  });
  res.json({
    ok: true,
    data: { user_id: userId, role_id: roleId, revoked: true },
    meta: nowMeta()
  });
}));
