import express from 'express';
import { config } from './config.js';
import { router } from './routes.js';
import { publicAuthRouter } from './authRoutes.js';
import { databaseIsUp } from './db.js';
import { ApiError, asyncHandler, errorHandler } from './errors.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', asyncHandler(async (req, res) => {
    let up = false;
    try {
      up = await databaseIsUp();
    } catch {
      up = false;
    }
    res.status(up ? 200 : 503).json({
      ok: up,
      status: up ? 'ok' : 'degraded',
      services: [{
        name: 'database',
        state: up ? 'up' : 'down',
        detail: config.db.database
      }],
      meta: { ts: new Date().toISOString() }
    });
  }));

  app.use('/api/v1/auth', publicAuthRouter);
  app.use('/api/v1', router);

  app.use((req, res) => {
    const error = new ApiError('NOT_FOUND', 'Endpoint tidak ditemukan', 404);
    res.status(404).json({
      ok: false,
      error: { code: error.code, message: error.message, status: error.status }
    });
  });

  app.use(errorHandler);
  return app;
}
