import { Router } from 'express';
import { query, withTransaction } from './db.js';
import { ApiError, asyncHandler } from './errors.js';
import { authorize, authorizeAny } from './authMiddleware.js';
import { parseId, requireMapelCode, requireText } from './validate.js';

export const mapelRouter = Router();

const nowMeta = () => ({ ts: new Date().toISOString() });
const manageMapels = authorize('mapels.manage');
const readMapels = authorizeAny('questions.read', 'mapels.manage');

const MAPEL_SELECT = `
  SELECT m.id, m.code, m.name, m.description, m.is_active, m.created_at,
         (SELECT count(*)::int FROM questions q WHERE q.mapel_id = m.id AND q.status <> 'archived') AS question_count,
         (SELECT count(*)::int FROM tryout_sessions s WHERE s.mapel_id = m.id) AS tryout_count
  FROM mapels m
`;

function requireDescription(value) {
  if (value === undefined || value === null || value === '') return null;
  return requireText(value, 'description', 1000);
}

function requireIsActive(value, fallback = true) {
  if (value === undefined) return fallback;
  return Boolean(value);
}

function isDuplicate(error) {
  return error?.code === '23505';
}

async function loadMapel(client, id) {
  const run = client?.query ? client.query.bind(client) : query;
  const { rows } = await run(`${MAPEL_SELECT} WHERE m.id = $1`, [id]);
  return rows[0];
}

mapelRouter.get('/mapels', readMapels, asyncHandler(async (req, res) => {
  const includeInactive = req.query.include_inactive === 'true' || req.query.include_inactive === '1';
  if (includeInactive && !req.auth.permissions.includes('mapels.manage')) {
    throw new ApiError('FORBIDDEN', 'Akses ditolak: memerlukan permission mapels.manage', 403);
  }
  const { rows } = await query(
    `${MAPEL_SELECT} ${includeInactive ? '' : 'WHERE m.is_active = true'} ORDER BY m.id`
  );
  res.json({ ok: true, data: { mapels: rows }, meta: nowMeta() });
}));

mapelRouter.post('/mapels', manageMapels, asyncHandler(async (req, res) => {
  const code = requireMapelCode(req.body?.code);
  const name = requireText(req.body?.name, 'nama mapel', 64);
  const description = requireDescription(req.body?.description);
  const isActive = requireIsActive(req.body?.is_active);

  const mapel = await withTransaction(async (client) => {
    const duplicate = await client.query('SELECT id FROM mapels WHERE code = $1', [code]);
    if (duplicate.rows[0]) throw new ApiError('CONFLICT', 'Kode mapel sudah digunakan', 409);
    try {
      const { rows } = await client.query(
        `INSERT INTO mapels (code, name, description, is_active)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [code, name, description, isActive]
      );
      return loadMapel(client, rows[0].id);
    } catch (error) {
      if (isDuplicate(error)) throw new ApiError('CONFLICT', 'Kode mapel sudah digunakan', 409);
      throw error;
    }
  });

  res.status(201).json({ ok: true, data: { mapel }, meta: nowMeta() });
}));

mapelRouter.put('/mapels/:id', manageMapels, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const code = requireMapelCode(req.body?.code);
  const name = requireText(req.body?.name, 'nama mapel', 64);
  const description = requireDescription(req.body?.description);
  const isActive = requireIsActive(req.body?.is_active);

  const mapel = await withTransaction(async (client) => {
    const found = await client.query('SELECT id FROM mapels WHERE id = $1', [id]);
    if (!found.rows[0]) throw new ApiError('NOT_FOUND', 'Mapel tidak ditemukan', 404);
    const duplicate = await client.query('SELECT id FROM mapels WHERE code = $1 AND id <> $2', [code, id]);
    if (duplicate.rows[0]) throw new ApiError('CONFLICT', 'Kode mapel sudah digunakan', 409);
    try {
      await client.query(
        `UPDATE mapels SET code = $2, name = $3, description = $4, is_active = $5 WHERE id = $1`,
        [id, code, name, description, isActive]
      );
      return loadMapel(client, id);
    } catch (error) {
      if (isDuplicate(error)) throw new ApiError('CONFLICT', 'Kode mapel sudah digunakan', 409);
      throw error;
    }
  });

  res.json({ ok: true, data: { mapel }, meta: nowMeta() });
}));

mapelRouter.delete('/mapels/:id', manageMapels, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const mapel = await withTransaction(async (client) => {
    const found = await loadMapel(client, id);
    if (!found) throw new ApiError('NOT_FOUND', 'Mapel tidak ditemukan', 404);
    if (found.question_count > 0 || found.tryout_count > 0) {
      throw new ApiError('CONFLICT', 'Mapel masih dipakai soal atau tryout; pindahkan atau hapus data terkait terlebih dahulu', 409);
    }
    await client.query('DELETE FROM mapels WHERE id = $1', [id]);
    return found;
  });
  res.json({ ok: true, data: { mapel, deleted: true }, meta: nowMeta() });
}));
