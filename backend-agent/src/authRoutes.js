import { Router } from 'express';
import { config } from './config.js';
import { query, withTransaction } from './db.js';
import { ApiError, asyncHandler } from './errors.js';
import {
  hashPassword, verifyPassword, signAccessToken, parseCookies,
  serializeCookie, newRefreshToken, hashToken, normalizeTryoutSlug,
  ACCOUNT_TYPE_PARTICIPANT, PARTICIPANT_ROLES, PARTICIPANT_PERMISSIONS
} from './auth.js';
import { authenticate } from './authMiddleware.js';

export const publicAuthRouter = Router();

const nowMeta = () => ({ ts: new Date().toISOString() });

async function rolesOf(userId) {
  const { rows } = await query(
    `SELECT r.code FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND r.is_active = true ORDER BY r.id`,
    [userId]
  );
  return rows.map((row) => row.code);
}

function setSessionCookies(res, accessToken, refreshToken) {
  res.append('Set-Cookie', serializeCookie('access_token', accessToken, {
    maxAge: config.auth.accessTtlSeconds
  }));
  res.append('Set-Cookie', serializeCookie('refresh_token', refreshToken, {
    maxAge: config.auth.refreshTtlDays * 24 * 60 * 60
  }));
}

function clearSessionCookies(res) {
  res.append('Set-Cookie', serializeCookie('access_token', '', { clear: true }));
  res.append('Set-Cookie', serializeCookie('refresh_token', '', { clear: true }));
}

async function sessionPayload(account, sessionId, tryoutSession = null) {
  if (account.type === ACCOUNT_TYPE_PARTICIPANT) {
    const participant = await query(
      `SELECT id, coalesce(username, email, nama) AS username, nama AS display_name,
              jenjang_kode, jenjang_nama
       FROM tryout_participants WHERE id = $1 AND is_active = true`,
      [account.id]
    );
    if (!participant.rows[0]) throw new ApiError('UNAUTHORIZED', 'Akun peserta tidak aktif', 401);
    if (!tryoutSession?.id || !tryoutSession?.slug || !tryoutSession?.eventId
      || !tryoutSession?.eventSlug) {
      throw new ApiError('UNAUTHORIZED', 'Sesi peserta tidak memiliki tryout yang terikat', 401);
    }
    return {
      user: {
        ...participant.rows[0],
        tryout_event_id: Number(tryoutSession.eventId),
        tryout_session_id: Number(tryoutSession.id),
        tryout_slug: tryoutSession.eventSlug,
        tryout_name: tryoutSession.eventName ?? tryoutSession.name ?? null,
        tryout_session_slug: tryoutSession.sessionSlug ?? tryoutSession.slug
      },
      roles: PARTICIPANT_ROLES,
      accessToken: signAccessToken({
        sub: account.id,
        sid: sessionId,
        roles: PARTICIPANT_ROLES,
        permissions: PARTICIPANT_PERMISSIONS,
        account_type: ACCOUNT_TYPE_PARTICIPANT,
        tryout_event_id: Number(tryoutSession.eventId),
        tryout_session_id: Number(tryoutSession.id),
        tryout_slug: tryoutSession.eventSlug,
        tryout_session_slug: tryoutSession.sessionSlug ?? tryoutSession.slug
      })
    };
  }

  const user = await query(
    'SELECT id, username, display_name FROM contributors WHERE id = $1 AND is_active = true',
    [account.id]
  );
  if (!user.rows[0]) throw new ApiError('UNAUTHORIZED', 'Akun tidak aktif', 401);
  const roles = await rolesOf(account.id);
  const permissions = await query(
    `SELECT DISTINCT p.code FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     JOIN role_permissions rp ON rp.role_id = r.id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE ur.user_id = $1 AND r.is_active = true`,
    [account.id]
  );
  return {
    user: user.rows[0],
    roles,
    accessToken: signAccessToken({
      sub: account.id,
      sid: sessionId,
      roles,
      permissions: permissions.rows.map((row) => row.code),
      account_type: 'user'
    })
  };
}

function accountTable(type, account) {
  if (type !== ACCOUNT_TYPE_PARTICIPANT) return 'contributors';
  return account?.table ?? 'siswa';
}

async function findLoginAccount(identity) {
  const umum = await query(
    `SELECT id, coalesce(username, nama) AS username, nama AS display_name,
            pin_hash AS password_hash, failed_login_count, locked_until
     FROM prospektus
     WHERE is_active = true AND jenis = 'umum'
       AND (lower(username) = lower($1) OR lower(nama) = lower($1))
     ORDER BY CASE WHEN lower(username) = lower($1) THEN 0 ELSE 1 END
     LIMIT 1`,
    [identity]
  );
  if (umum.rows[0]) {
    return { type: ACCOUNT_TYPE_PARTICIPANT, account: { ...umum.rows[0], table: 'prospektus' } };
  }
  const siswa = await query(
    `SELECT id, coalesce(username, email) AS username, nama AS display_name, password_hash,
            failed_login_count, locked_until
     FROM siswa
     WHERE is_active = true AND jenis = 'siswa'
       AND (lower(username) = lower($1) OR lower(email) = lower($1))
     ORDER BY CASE WHEN lower(username) = lower($1) THEN 0 ELSE 1 END
     LIMIT 1`,
    [identity]
  );
  if (siswa.rows[0]) {
    return { type: ACCOUNT_TYPE_PARTICIPANT, account: { ...siswa.rows[0], table: 'siswa' } };
  }
  const user = await query(
    `SELECT id, username, display_name, password_hash, failed_login_count, locked_until
     FROM contributors
     WHERE is_active = true AND (lower(username) = lower($1) OR lower(email) = lower($1))`,
    [identity]
  );
  if (user.rows[0]) return { type: 'user', account: user.rows[0] };
  return null;
}

async function loadTryoutForParticipant(client, rawSlug, participantId) {
  if (!rawSlug) {
    throw new ApiError('UNAUTHORIZED', 'Peserta wajib masuk melalui tautan tryout yang diberikan', 401);
  }
  let slug;
  try {
    slug = normalizeTryoutSlug(rawSlug);
  } catch {
    throw new ApiError('UNAUTHORIZED', 'Tautan tryout tidak valid', 401);
  }
  const run = client?.query ? client.query.bind(client) : query;
  const { rows } = await run(
    `SELECT e.id AS event_id, e.slug AS event_slug, e.name AS event_name,
            e.starts_at, e.ends_at,
            s.id, s.slug AS session_slug, s.name
     FROM tryout_events e
     JOIN tryout_sessions s ON s.event_id = e.id
     JOIN tryout_session_participants p ON p.session_id = s.id AND p.participant_id = $2
     WHERE e.slug = $1
        OR EXISTS (SELECT 1 FROM tryout_sessions legacy
                   WHERE legacy.slug = $1 AND legacy.event_id = e.id)
     ORDER BY (s.slug = $1) DESC, s.id ASC
     LIMIT 1`,
    [slug, participantId]
  );
  const tryout = rows[0];
  if (!tryout) {
    throw new ApiError('UNAUTHORIZED', 'Akun tidak terdaftar pada tryout ini', 401);
  }
  if (!tryout.ends_at || new Date(tryout.ends_at).getTime() <= Date.now()) {
    throw new ApiError('TRYOUT_ENDED', 'Batas akhir tryout sudah terlampaui', 401);
  }
  return {
    id: tryout.id,
    slug: tryout.event_slug,
    sessionSlug: tryout.session_slug,
    name: tryout.name,
    eventId: tryout.event_id,
    eventSlug: tryout.event_slug,
    eventName: tryout.event_name,
    startsAt: tryout.starts_at,
    endsAt: tryout.ends_at
  };
}

async function registerFailedLogin(type, account) {
  const updated = await query(
    `UPDATE ${accountTable(type, account)} SET
       failed_login_count = failed_login_count + 1,
       locked_until = CASE
         WHEN failed_login_count + 1 >= $2
         THEN now() + make_interval(mins => $3) ELSE locked_until END
     WHERE id = $1
     RETURNING failed_login_count`,
    [account.id, config.auth.maxFailedLogin, config.auth.lockMinutes]
  );
  const attempts = updated.rows[0].failed_login_count;
  throw new ApiError('UNAUTHORIZED',
    attempts >= config.auth.maxFailedLogin
      ? 'Akun dikunci sementara karena terlalu banyak percobaan'
      : 'Kredensial tidak valid', 401);
}

publicAuthRouter.post('/login', asyncHandler(async (req, res) => {
  const identity = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');
  const rawSlug = req.body?.tryout_slug ?? req.body?.slug;
  if (!identity || !password) {
    throw new ApiError('VALIDATION_ERROR', 'Username dan password wajib diisi');
  }

  const loginAccount = await findLoginAccount(identity);
  if (!loginAccount) throw new ApiError('UNAUTHORIZED', 'Kredensial tidak valid', 401);
  const { type, account } = loginAccount;
  const tryout = type === ACCOUNT_TYPE_PARTICIPANT
    ? await loadTryoutForParticipant(null, rawSlug, account.id)
    : null;

  if (account.locked_until && new Date(account.locked_until) > new Date()) {
    throw new ApiError('TOO_MANY_REQUESTS', 'Akun dikunci sementara, coba lagi nanti', 429);
  }

  const valid = await verifyPassword(password, account.password_hash);
  if (!valid) await registerFailedLogin(type, account);

  const result = await withTransaction(async (client) => {
    await client.query(
      `UPDATE ${accountTable(type, account)}
       SET failed_login_count = 0, locked_until = NULL, last_login_at = now()
       WHERE id = $1`,
      [account.id]
    );
    const refreshToken = newRefreshToken();
    const isParticipant = type === ACCOUNT_TYPE_PARTICIPANT;
    const session = await client.query(
      `INSERT INTO auth_sessions
          (user_id, participant_id, tryout_session_id, tryout_event_id,
           refresh_hash, expires_at, last_used_at)
        VALUES ($1, $2, $3, $4, $5, now() + make_interval(days => $6), now())
        RETURNING id`,
      [isParticipant ? null : account.id, isParticipant ? account.id : null,
        isParticipant ? tryout.id : null, isParticipant ? tryout.eventId : null,
        hashToken(refreshToken), config.auth.refreshTtlDays]
    );
    return { refreshToken, sessionId: session.rows[0].id };
  });

  const payload = await sessionPayload({ type, id: account.id }, result.sessionId, tryout);
  setSessionCookies(res, payload.accessToken, result.refreshToken);
  res.json({
    ok: true,
    data: { user: payload.user, roles: payload.roles },
    meta: nowMeta()
  });
}));

publicAuthRouter.post('/refresh', asyncHandler(async (req, res) => {
  const cookies = parseCookies(req.get('cookie'));
  const refreshToken = cookies.refresh_token;
  if (!refreshToken) throw new ApiError('UNAUTHORIZED', 'Refresh token tidak ditemukan', 401);

  const result = await withTransaction(async (client) => {
    const found = await client.query(
        `SELECT s.id, s.user_id, s.participant_id, s.tryout_session_id,
              coalesce(s.tryout_event_id, ts.event_id) AS tryout_event_id,
              tp.jenis AS participant_jenis,
              e.slug AS tryout_slug, e.name AS tryout_name,
              ts.slug AS tryout_session_slug, ts.name AS tryout_session_name
         FROM auth_sessions s
         LEFT JOIN contributors c ON c.id = s.user_id
         LEFT JOIN tryout_participants tp ON tp.id = s.participant_id
         LEFT JOIN tryout_sessions ts ON ts.id = s.tryout_session_id
         LEFT JOIN tryout_events e ON e.id = coalesce(s.tryout_event_id, ts.event_id)
       WHERE s.refresh_hash = $1 AND s.revoked_at IS NULL
         AND s.expires_at > now()
         AND (s.user_id IS NULL OR c.is_active = true)
         AND (s.participant_id IS NULL OR (
           tp.is_active = true
           AND s.tryout_session_id IS NOT NULL
           AND e.id IS NOT NULL
           AND now() <= e.ends_at
           AND EXISTS (
             SELECT 1 FROM tryout_session_participants p
             WHERE p.session_id = s.tryout_session_id AND p.participant_id = s.participant_id
           )
         ))`,
      [hashToken(refreshToken)]
    );
    const session = found.rows[0];
    if (!session) throw new ApiError('UNAUTHORIZED', 'Sesi tidak valid atau sudah berakhir', 401);

    const nextRefresh = newRefreshToken();
    await client.query(
      `UPDATE auth_sessions SET refresh_hash = $2, last_used_at = now()
       WHERE id = $1 AND revoked_at IS NULL`,
      [session.id, hashToken(nextRefresh)]
    );
    const isParticipant = Boolean(session.participant_id);
    return {
      account: {
        type: isParticipant ? ACCOUNT_TYPE_PARTICIPANT : 'user',
        id: isParticipant ? session.participant_id : session.user_id,
        table: isParticipant
          ? (session.participant_jenis === 'umum' ? 'prospektus' : 'siswa')
          : null
      },
      tryoutSession: isParticipant ? {
        id: session.tryout_session_id,
        slug: session.tryout_slug,
        sessionSlug: session.tryout_session_slug,
        name: session.tryout_session_name,
        eventId: session.tryout_event_id,
        eventSlug: session.tryout_slug,
        eventName: session.tryout_name
      } : null,
      sessionId: session.id,
      refreshToken: nextRefresh
    };
  });

  const payload = await sessionPayload(result.account, result.sessionId, result.tryoutSession);
  setSessionCookies(res, payload.accessToken, result.refreshToken);
  res.json({
    ok: true,
    data: { user: payload.user, roles: payload.roles },
    meta: nowMeta()
  });
}));

publicAuthRouter.post('/logout', asyncHandler(async (req, res) => {
  const cookies = parseCookies(req.get('cookie'));
  if (cookies.refresh_token) {
    await query(
      'UPDATE auth_sessions SET revoked_at = now() WHERE refresh_hash = $1 AND revoked_at IS NULL',
      [hashToken(cookies.refresh_token)]
    );
  }
  clearSessionCookies(res);
  res.json({ ok: true, data: { logged_out: true }, meta: nowMeta() });
}));

publicAuthRouter.get('/me', authenticate, asyncHandler(async (req, res) => {
  res.json({
    ok: true,
    data: {
      user: req.auth.user,
      roles: req.auth.roles,
      permissions: req.auth.permissions,
      tryout_event_id: req.auth.tryoutEventId ?? null,
      tryout_session_id: req.auth.tryoutSessionId ?? null,
      tryout_slug: req.auth.tryoutSlug ?? null,
      tryout_name: req.auth.tryoutName ?? null,
      tryout_session_slug: req.auth.tryoutSessionSlug ?? null
    },
    meta: nowMeta()
  });
}));

export { hashPassword };
