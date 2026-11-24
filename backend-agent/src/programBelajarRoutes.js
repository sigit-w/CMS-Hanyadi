import { Router } from 'express';
import { query, withTransaction } from './db.js';
import { ApiError, asyncHandler } from './errors.js';
import { authorize } from './authMiddleware.js';
import { parseId, requireText } from './validate.js';

export const programBelajarRouter = Router();

const nowMeta = () => ({ ts: new Date().toISOString() });
const managePrograms = authorize('program_belajar.manage');
const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_SCHEDULES = 30;

const PROGRAM_SELECT = `
  SELECT p.id, p.name, p.kelas, p.description, p.biaya, p.created_at, p.updated_at,
         COALESCE(
           (SELECT jsonb_agg(jsonb_build_object(
              'id', s.id,
              'day', s.day,
              'start_time', to_char(s.start_time, 'HH24:MI'),
              'end_time', to_char(s.end_time, 'HH24:MI'),
              'position', s.position
            ) ORDER BY s.position, s.id)
            FROM program_belajar_schedules s WHERE s.program_id = p.id),
           '[]'::jsonb
         ) AS schedules
  FROM program_belajar p
`;

function optionalDescription(value) {
  if (value === undefined || value === null || value === '') return null;
  return requireText(value, 'deskripsi program', 1000);
}

function requireKelas(value) {
  const kelas = Number(value);
  if (!Number.isInteger(kelas) || kelas < 1 || kelas > 12) {
    throw new ApiError('VALIDATION_ERROR', 'Kelas harus angka bulat antara 1 sampai 12');
  }
  return kelas;
}

function requireBiaya(value) {
  const biaya = Number(value);
  if (!Number.isFinite(biaya) || biaya < 0 || biaya > 999999999999.99) {
    throw new ApiError('VALIDATION_ERROR', 'Biaya harus angka nonnegative');
  }
  return Math.round((biaya + Number.EPSILON) * 100) / 100;
}

function requireDay(value) {
  const day = typeof value === 'string' ? value.trim() : '';
  if (!DAYS.includes(day)) {
    throw new ApiError('VALIDATION_ERROR', 'Hari jadwal tidak valid');
  }
  return day;
}

function requireTime(value, field) {
  if (typeof value !== 'string' || !TIME_PATTERN.test(value.trim())) {
    throw new ApiError('VALIDATION_ERROR', `${field} harus berformat HH:MM (24 jam)`);
  }
  return value.trim();
}

function requireSchedules(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError('VALIDATION_ERROR', 'Tambahkan minimal satu jadwal');
  }
  if (value.length > MAX_SCHEDULES) {
    throw new ApiError('VALIDATION_ERROR', `Jadwal maksimal ${MAX_SCHEDULES} baris`);
  }
  const seen = new Set();
  return value.map((item, index) => {
    const day = requireDay(item?.day);
    const startTime = requireTime(item?.start_time, `Jam mulai jadwal ${index + 1}`);
    const endTime = requireTime(item?.end_time, `Jam selesai jadwal ${index + 1}`);
    if (endTime <= startTime) {
      throw new ApiError('VALIDATION_ERROR', `Jam selesai jadwal ${index + 1} harus setelah jam mulai`);
    }
    const key = `${day}|${startTime}|${endTime}`;
    if (seen.has(key)) {
      throw new ApiError('VALIDATION_ERROR', `Jadwal duplikat: ${day} ${startTime}-${endTime}`);
    }
    seen.add(key);
    return { day, startTime, endTime, position: index };
  });
}

function validatePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError('VALIDATION_ERROR', 'Body harus berupa objek');
  }
  return {
    name: requireText(body.name, 'nama program', 128),
    kelas: requireKelas(body.kelas),
    description: optionalDescription(body.description),
    biaya: requireBiaya(body.biaya ?? 0),
    schedules: requireSchedules(body.schedules)
  };
}

async function loadProgram(client, id) {
  const run = client?.query ? client.query.bind(client) : query;
  const { rows } = await run(`${PROGRAM_SELECT} WHERE p.id = $1`, [id]);
  return rows[0];
}

async function replaceSchedules(client, programId, schedules) {
  await client.query('DELETE FROM program_belajar_schedules WHERE program_id = $1', [programId]);
  for (const schedule of schedules) {
    await client.query(
      `INSERT INTO program_belajar_schedules (program_id, day, start_time, end_time, position)
       VALUES ($1, $2, $3, $4, $5)`,
      [programId, schedule.day, schedule.startTime, schedule.endTime, schedule.position]
    );
  }
}

programBelajarRouter.get('/program-belajar', managePrograms, asyncHandler(async (req, res) => {
  const { rows } = await query(`${PROGRAM_SELECT} ORDER BY p.id DESC`);
  res.json({ ok: true, data: { programs: rows }, meta: nowMeta() });
}));

programBelajarRouter.get('/program-belajar/:id', managePrograms, asyncHandler(async (req, res) => {
  const program = await loadProgram(null, parseId(req.params.id));
  if (!program) throw new ApiError('NOT_FOUND', 'Program belajar tidak ditemukan', 404);
  res.json({ ok: true, data: { program }, meta: nowMeta() });
}));

programBelajarRouter.post('/program-belajar', managePrograms, asyncHandler(async (req, res) => {
  const payload = validatePayload(req.body);
  const program = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO program_belajar (name, kelas, description, biaya)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [payload.name, payload.kelas, payload.description, payload.biaya]
    );
    await replaceSchedules(client, rows[0].id, payload.schedules);
    return loadProgram(client, rows[0].id);
  });
  res.status(201).json({ ok: true, data: { program }, meta: nowMeta() });
}));

programBelajarRouter.put('/program-belajar/:id', managePrograms, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const payload = validatePayload(req.body);
  const program = await withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE program_belajar SET name = $2, kelas = $3, description = $4, biaya = $5 WHERE id = $1`,
      [id, payload.name, payload.kelas, payload.description, payload.biaya]
    );
    if (result.rowCount === 0) throw new ApiError('NOT_FOUND', 'Program belajar tidak ditemukan', 404);
    await replaceSchedules(client, id, payload.schedules);
    return loadProgram(client, id);
  });
  res.json({ ok: true, data: { program }, meta: nowMeta() });
}));

programBelajarRouter.delete('/program-belajar/:id', managePrograms, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const program = await withTransaction(async (client) => {
    const found = await loadProgram(client, id);
    if (!found) throw new ApiError('NOT_FOUND', 'Program belajar tidak ditemukan', 404);
    await client.query('DELETE FROM program_belajar WHERE id = $1', [id]);
    return found;
  });
  res.json({ ok: true, data: { program, deleted: true }, meta: nowMeta() });
}));
