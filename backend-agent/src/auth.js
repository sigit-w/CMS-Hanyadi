import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { config } from './config.js';

const scrypt = promisify(crypto.scrypt);
const SCRYPT_KEYLEN = 32;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };

export const ACCOUNT_TYPE_PARTICIPANT = 'participant';
export const PARTICIPANT_ROLES = ['peserta'];
export const PARTICIPANT_PERMISSIONS = ['tryout.access', 'presentation.read'];
export const TRYOUT_SLUG_RESERVED = new Set([
  'api', 'assets', 'health', 'favicon-ico', 'favicon.ico', 'robots-txt', 'robots.txt',
  'login', 'admin', 'tryout'
]);

export function normalizeTryoutSlug(value, field = 'tryout_slug') {
  if (typeof value !== 'string') {
    throw new Error(`${field} harus berupa teks`);
  }
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug || slug.length > 32 || TRYOUT_SLUG_RESERVED.has(slug)
      || !/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(slug)) {
    throw new Error(`${field} tidak valid`);
  }
  return slug;
}

export function generateTryoutSlug(name, id) {
  const base = String(name ?? '')
    .trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    || 'tryout';
  const suffix = `-${id}`;
  return `${base.slice(0, 32 - suffix.length)}${suffix}`;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  return scrypt(password, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS).then((derived) =>
    `scrypt$16384$8$1$${salt.toString('hex')}$${derived.toString('hex')}`
  );
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  try {
    const salt = Buffer.from(parts[4], 'hex');
    const expected = Buffer.from(parts[5], 'hex');
    if (salt.length !== 16 || expected.length !== SCRYPT_KEYLEN) return false;
    const derived = await scrypt(password, salt, expected.length, SCRYPT_OPTIONS);
    return crypto.timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

export function signAccessToken(payload) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iss: 'bank-soal',
    iat: now,
    exp: now + config.auth.accessTtlSeconds
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', config.auth.jwtSecret)
    .update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyAccessToken(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const expected = crypto.createHmac('sha256', config.auth.jwtSecret)
    .update(`${parts[0]}.${parts[1]}`).digest();
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
  if (typeof payload.iat !== 'number' || payload.iat > now + 60) return null;
  return payload;
}

export function parseCookies(header) {
  const result = {};
  if (typeof header !== 'string') return result;
  for (const entry of header.split(';')) {
    const index = entry.indexOf('=');
    if (index < 0) continue;
    const key = entry.slice(0, index).trim();
    const value = entry.slice(index + 1).trim();
    try {
      result[key] = decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  }
  return result;
}

export function serializeCookie(name, value, { maxAge, clear = false } = {}) {
  const attributes = [`${name}=${encodeURIComponent(value)}`, 'Path=/'];
  if (config.auth.cookieDomain) attributes.push(`Domain=${config.auth.cookieDomain}`);
  if (config.auth.cookieSecure) attributes.push('Secure');
  attributes.push('HttpOnly', 'SameSite=Lax', `Max-Age=${clear ? 0 : maxAge}`);
  return attributes.join('; ');
}

export const newRefreshToken = () => crypto.randomBytes(32).toString('base64url');
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
