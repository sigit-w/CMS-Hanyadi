import crypto from 'node:crypto';
import { pool } from './db.js';

const secret = process.env.AUTH_JWT_SECRET || '';

function unauthorized(res, message = 'Login diperlukan untuk mengakses tryout') {
  return res.status(401).json({
    ok: false,
    error: { code: 'UNAUTHORIZED', message, status: 401 }
  });
}

function gone(res, message = 'Batas akhir tryout telah terlampaui') {
  return res.status(410).json({
    ok: false,
    error: { code: 'GONE', message, status: 410 }
  });
}

export function parseCookies(header) {
  const result = {};
  if (typeof header !== 'string') return result;
  for (const entry of header.split(';')) {
    const index = entry.indexOf('=');
    if (index < 0) continue;
    try {
      result[entry.slice(0, index).trim()] = decodeURIComponent(entry.slice(index + 1).trim());
    } catch {
      result[entry.slice(0, index).trim()] = entry.slice(index + 1).trim();
    }
  }
  return result;
}

export function verifyAccessToken(token) {
  if (!secret || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const expected = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
  const actual = Buffer.from(parts[2], 'base64url');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== 'bank-soal' || typeof payload.exp !== 'number' || payload.exp <= now) return null;
  return payload;
}

export function requireTryoutSession(permission = 'presentation.read') {
  return async (req, res, next) => {
    try {
      const token = parseCookies(req.get('cookie')).access_token;
      const payload = verifyAccessToken(token);
      if (!payload?.sub) return unauthorized(res);
      if (!Array.isArray(payload.permissions) || !payload.permissions.includes(permission)) {
        return res.status(403).json({
          ok: false,
          error: { code: 'FORBIDDEN', message: 'Role tidak memiliki akses tryout', status: 403 }
        });
      }
      const isParticipant = payload.account_type === 'participant';
      let tryoutEventId = null;
      if (isParticipant) {
        if (!payload.tryout_session_id || !payload.tryout_slug) {
          return unauthorized(res, 'Sesi tryout tidak valid. Masuk melalui tautan tryout.');
        }
        const sessionId = Number(payload.tryout_session_id);
        if (!Number.isSafeInteger(sessionId) || sessionId < 1) return unauthorized(res);
        const claimedEventId = payload.tryout_event_id === undefined
          ? null : Number(payload.tryout_event_id);
        if (claimedEventId !== null && (!Number.isSafeInteger(claimedEventId) || claimedEventId < 1)) {
          return unauthorized(res);
        }
        const { rows } = await pool.query(
          `SELECT s.event_id, e.ends_at
           FROM tryout_sessions s
           JOIN tryout_events e ON e.id = s.event_id
           WHERE s.id = $1`,
          [sessionId]
        );
        const event = rows[0];
        if (!event || (claimedEventId !== null && Number(event.event_id) !== claimedEventId)) {
          return unauthorized(res);
        }
        if (!event.ends_at || Date.now() > Date.parse(event.ends_at)) {
          return gone(res);
        }
        tryoutEventId = Number(event.event_id);
      }
      req.auth = {
        userId: isParticipant ? null : payload.sub,
        participantId: isParticipant ? payload.sub : null,
        accountType: isParticipant ? 'participant' : 'user',
        roles: payload.roles ?? [],
        tryoutEventId,
        tryoutSessionId: isParticipant ? Number(payload.tryout_session_id) : null,
        tryoutSlug: isParticipant ? payload.tryout_slug : null
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}
