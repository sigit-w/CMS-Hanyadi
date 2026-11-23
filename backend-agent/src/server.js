import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';

if (!config.auth.jwtSecret || config.auth.jwtSecret.length < 32) {
  throw new Error('AUTH_JWT_SECRET wajib diset minimal 32 karakter');
}

const app = createApp();

const server = app.listen(config.port, config.host, () => {
  console.log(`Bank Soal API siap di http://${config.host}:${config.port}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
