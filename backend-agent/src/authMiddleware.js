import { query } from './db.js';
import { ApiError, asyncHandler } from './errors.js';
import {
  parseCookies, verifyAccessToken,
  ACCOUNT_TYPE_PARTICIPANT, PARTICIPANT_ROLES, PARTICIPANT_PERMISSIONS
} from './auth.js';

async function loadAuth(req) {
  const cookies = parseCookies(req.get('cookie'));
  const payload = verifyAccessToken(cookies.access_token);
  if (!payload?.sub || !payload?.sid) return null;

  const session = await query(
    `SELECT s.id, s.user_id, s.participant_id,
            c.username, c.display_name,
            tp.email AS participant_email, tp.nama AS participant_nama
     FROM auth_sessions s
     LEFT JOIN contributors c ON c.id = s.user_id
     LEFT JOIN tryout_participants tp ON tp.id = s.participant_id
     WHERE s.id = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
    [payload.sid]
  );
  const found = session.rows[0];
  if (!found) return null;

  if (payload.account_type === ACCOUNT_TYPE_PARTICIPANT || found.participant_id) {
    if (!found.participant_id || Number(payload.sub) !== Number(found.participant_id)
      || !found.participant_email) return null;
    return {
      sessionId: found.id,
      user: {
        id: found.participant_id,
        username: found.participant_email,
        display_name: found.participant_nama
      },
      roles: PARTICIPANT_ROLES,
      permissions: PARTICIPANT_PERMISSIONS
    };
  }

  if (!found.user_id || Number(payload.sub) !== Number(found.user_id) || !found.username) return null;

  const [roles, permissions] = await Promise.all([
    query(
      `SELECT r.code FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1 AND r.is_active = true ORDER BY r.id`,
      [payload.sub]
    ),
    query(
      `SELECT DISTINCT p.code FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       JOIN role_permissions rp ON rp.role_id = r.id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE ur.user_id = $1 AND r.is_active = true`,
      [payload.sub]
    )
  ]);

  return {
    sessionId: found.id,
    user: {
      id: found.user_id,
      username: found.username,
      display_name: found.display_name
    },
    roles: roles.rows.map((row) => row.code),
    permissions: permissions.rows.map((row) => row.code)
  };
}

export const authenticate = asyncHandler(async (req, res, next) => {
  const auth = await loadAuth(req);
  if (!auth) throw new ApiError('UNAUTHORIZED', 'Sesi tidak valid atau sudah berakhir', 401);
  req.auth = auth;
  next();
});

export const authorize = (permission) => (req, res, next) => {
  if (!req.auth?.permissions.includes(permission)) {
    throw new ApiError('FORBIDDEN', `Akses ditolak: memerlukan permission ${permission}`, 403);
  }
  next();
};

export const authorizeAny = (...permissions) => (req, res, next) => {
  if (!req.auth || !permissions.some((permission) => req.auth.permissions.includes(permission))) {
    throw new ApiError('FORBIDDEN', 'Akses ditolak untuk role ini', 403);
  }
  next();
};

export { loadAuth };
