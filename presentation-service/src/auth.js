import crypto from 'node:crypto';

const secret = process.env.AUTH_JWT_SECRET || '';

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
  return (req, res, next) => {
    const token = parseCookies(req.get('cookie')).access_token;
    const payload = verifyAccessToken(token);
    if (!payload?.sub) {
      return res.status(401).json({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Login diperlukan untuk mengakses tryout', status: 401 }
      });
    }
    if (!Array.isArray(payload.permissions) || !payload.permissions.includes(permission)) {
      return res.status(403).json({
        ok: false,
        error: { code: 'FORBIDDEN', message: 'Role tidak memiliki akses tryout', status: 403 }
      });
    }
    const isParticipant = payload.account_type === 'participant';
    req.auth = {
      userId: isParticipant ? null : payload.sub,
      participantId: isParticipant ? payload.sub : null,
      accountType: isParticipant ? 'participant' : 'user',
      roles: payload.roles ?? []
    };
    next();
  };
}
