import express from 'express';
import { config } from './config.js';
import { pool } from './db.js';
import { router } from './routes.js';
import { errorHandler } from './errors.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(router);
app.use((req, res) => res.status(404).json({
  ok: false,
  error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan', status: 404 }
}));
app.use(errorHandler);

const server = app.listen(config.port, config.host, () => {
  console.log(`Presentation service siap di http://${config.host}:${config.port}`);
});

function shutdown() {
  server.close(() => pool.end().finally(() => process.exit(0)));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
