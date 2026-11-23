import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

dotenv.config({ path: path.join(root, '.env') });

const uploadDir = process.env.UPLOAD_DIR || path.join(root, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

export const config = {
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 8082),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'bank_soal_db',
    user: process.env.DB_USER || 'bank_soal_user',
    password: process.env.DB_PASSWORD,
    max: 5,
    connectionTimeoutMillis: 3000,
    options: '-c statement_timeout=5000'
  },
  uploadDir,
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB || 5) * 1024 * 1024,
  auth: {
    jwtSecret: process.env.AUTH_JWT_SECRET || '',
    cookieDomain: process.env.AUTH_COOKIE_DOMAIN || '.hanyadi.web.id',
    cookieSecure: (process.env.AUTH_COOKIE_SECURE || '1') !== '0',
    accessTtlSeconds: Number(process.env.AUTH_ACCESS_TTL_SECONDS || 900),
    refreshTtlDays: Number(process.env.AUTH_REFRESH_TTL_DAYS || 7),
    maxFailedLogin: Number(process.env.AUTH_MAX_FAILED_LOGIN || 5),
    lockMinutes: Number(process.env.AUTH_LOCK_MINUTES || 15)
  }
};
