import { Router } from 'express';
import { query, withTransaction } from './db.js';
import { ApiError, asyncHandler } from './errors.js';
import { authorize } from './authMiddleware.js';
import { parseId } from './validate.js';
import { hashPassword } from './auth.js';

export const participantRouter = Router();

const nowMeta = () => ({ ts: new Date().toISOString() });
const manageParticipants = authorize('tryouts.manage');

const PARTICIPANT_SELECT = `
  SELECT p.id, p.nama, p.email, p.kelas, p.sekolah,
         p.program_belajar_id, pb.name AS program_belajar_name, p.wa_orang_tua,
         p.is_active, p.created_at, p.updated_at,
         (SELECT count(*)::int FROM tryout_submissions ts WHERE ts.participant_id = p.id) AS submission_count
  FROM tryout_participants p
  LEFT JOIN program_belajar pb ON pb.id = p.program_belajar_id
`;

async function loadParticipant(client, id) {
  const { rows } = await client.query(`${PARTICIPANT_SELECT} WHERE p.id = $1`, [id]);
  return rows[0];
}

function requireNama(value) {
  const nama = typeof value === 'string' ? value.trim() : '';
  if (!nama || nama.length > 128) {
    throw new ApiError('VALIDATION_ERROR', 'Nama siswa wajib diisi maksimal 128 karakter');
  }
  return nama;
}

function parseProgramBelajarId(value) {
  if (value === undefined || value === null || value === '') return null;
  return parseId(value, 'program_belajar_id');
}

function parseWaOrangTua(value) {
  if (value === undefined || value === null || value === '') return null;
  const wa = typeof value === 'string' ? value.trim() : String(value).trim();
  if (wa.length > 20 || !/^\+?[0-9][0-9 -]{6,18}$/.test(wa)) {
    throw new ApiError('VALIDATION_ERROR', 'Nomor WA orang tua tidak valid (maksimal 20 karakter)');
  }
  return wa;
}

async function ensureProgramBelajar(client, programBelajarId) {
  if (programBelajarId === null) return;
  const { rows } = await client.query('SELECT id FROM program_belajar WHERE id = $1', [programBelajarId]);
  if (!rows[0]) throw new ApiError('VALIDATION_ERROR', 'Program belajar tidak ditemukan');
}

function defaultParticipantPassword(nama) {
  const firstName = nama.trim().split(/\s+/)[0] || '';
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear() % 100).padStart(2, '0');
  return `${firstName}@${mm}${yy}`;
}

function requireKelas(value) {
  const kelas = value === '' || value === null || value === undefined ? NaN : Number(value);
  if (!Number.isInteger(kelas) || kelas < 1 || kelas > 100) {
    throw new ApiError('VALIDATION_ERROR', 'Kelas wajib berupa bilangan bulat 1–100');
  }
  return kelas;
}

function requireSekolah(value) {
  const sekolah = typeof value === 'string' ? value.trim() : '';
  if (!sekolah || sekolah.length > 255) {
    throw new ApiError('VALIDATION_ERROR', 'Sekolah wajib diisi maksimal 255 karakter');
  }
  return sekolah;
}

function requireEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
    throw new ApiError('VALIDATION_ERROR', 'Format email siswa tidak valid');
  }
  return email;
}

function requirePassword(value, confirm) {
  const password = typeof value === 'string' ? value : '';
  if (password.length < 6) throw new ApiError('VALIDATION_ERROR', 'Password minimal 6 karakter');
  if (confirm !== undefined && confirm !== password) {
    throw new ApiError('VALIDATION_ERROR', 'Konfirmasi password tidak cocok');
  }
  return password;
}

async function findByEmail(client, email, excludeId = null) {
  const run = client?.query ? client.query.bind(client) : query;
  const { rows } = await run(
    `SELECT id FROM tryout_participants
     WHERE lower(email) = $1 AND ($2::bigint IS NULL OR id <> $2)`,
    [email, excludeId]
  );
  return rows[0];
}

participantRouter.get('/participants', manageParticipants, asyncHandler(async (req, res) => {
  const { rows } = await query(`${PARTICIPANT_SELECT} ORDER BY p.id DESC`);
  res.json({ ok: true, data: { participants: rows }, meta: nowMeta() });
}));

participantRouter.post('/participants', manageParticipants, asyncHandler(async (req, res) => {
  const nama = requireNama(req.body?.nama);
  const email = requireEmail(req.body?.email);
  const kelas = requireKelas(req.body?.kelas);
  const sekolah = requireSekolah(req.body?.sekolah);
  const programBelajarId = parseProgramBelajarId(req.body?.program_belajar_id);
  const waOrangTua = parseWaOrangTua(req.body?.wa_orang_tua);
  const rawPassword = req.body?.password;
  const password = typeof rawPassword === 'string' && rawPassword.trim()
    ? rawPassword
    : defaultParticipantPassword(nama);
  const passwordHash = await hashPassword(requirePassword(password));

  const participant = await withTransaction(async (client) => {
    if (await findByEmail(client, email)) {
      throw new ApiError('CONFLICT', 'Email siswa sudah digunakan', 409);
    }
    await ensureProgramBelajar(client, programBelajarId);
    const { rows } = await client.query(
      `INSERT INTO tryout_participants
         (nama, email, kelas, sekolah, program_belajar_id, wa_orang_tua, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [nama, email, kelas, sekolah, programBelajarId, waOrangTua, passwordHash]
    );
    return loadParticipant(client, rows[0].id);
  });

  res.status(201).json({ ok: true, data: { participant }, meta: nowMeta() });
}));

participantRouter.put('/participants/:id', manageParticipants, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const nama = requireNama(req.body?.nama);
  const email = requireEmail(req.body?.email);
  const kelas = requireKelas(req.body?.kelas);
  const sekolah = requireSekolah(req.body?.sekolah);
  const programBelajarId = parseProgramBelajarId(req.body?.program_belajar_id);
  const waOrangTua = parseWaOrangTua(req.body?.wa_orang_tua);
  const isActive = req.body?.is_active === undefined ? true : Boolean(req.body.is_active);

  const participant = await withTransaction(async (client) => {
    if (await findByEmail(client, email, id)) {
      throw new ApiError('CONFLICT', 'Email siswa sudah digunakan', 409);
    }
    await ensureProgramBelajar(client, programBelajarId);
    const { rows } = await client.query(
      `UPDATE tryout_participants
       SET nama = $2, email = $3, kelas = $4, sekolah = $5,
           program_belajar_id = $6, wa_orang_tua = $7, is_active = $8
       WHERE id = $1
       RETURNING id`,
      [id, nama, email, kelas, sekolah, programBelajarId, waOrangTua, isActive]
    );
    if (!rows[0]) throw new ApiError('NOT_FOUND', 'Siswa tidak ditemukan', 404);
    if (!isActive) {
      await client.query(
        'UPDATE auth_sessions SET revoked_at = now() WHERE participant_id = $1 AND revoked_at IS NULL',
        [id]
      );
    }
    return loadParticipant(client, rows[0].id);
  });

  res.json({ ok: true, data: { participant }, meta: nowMeta() });
}));

participantRouter.delete('/participants/:id', manageParticipants, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const participant = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE tryout_participants SET is_active = false
       WHERE id = $1
       RETURNING id, nama, email, kelas, sekolah, is_active`,
      [id]
    );
    if (!rows[0]) throw new ApiError('NOT_FOUND', 'Siswa tidak ditemukan', 404);
    await client.query(
      'UPDATE auth_sessions SET revoked_at = now() WHERE participant_id = $1 AND revoked_at IS NULL',
      [id]
    );
    return rows[0];
  });
  res.json({ ok: true, data: { participant, deleted: true }, meta: nowMeta() });
}));

participantRouter.put('/participants/:id/password', manageParticipants, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const passwordHash = await hashPassword(requirePassword(req.body?.password, req.body?.confirm_password));

  const participant = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE tryout_participants
       SET password_hash = $2, failed_login_count = 0, locked_until = NULL
       WHERE id = $1 AND is_active = true
       RETURNING id, nama, email, kelas, sekolah`,
      [id, passwordHash]
    );
    if (!rows[0]) throw new ApiError('NOT_FOUND', 'Siswa tidak ditemukan atau tidak aktif', 404);
    await client.query(
      'UPDATE auth_sessions SET revoked_at = now() WHERE participant_id = $1 AND revoked_at IS NULL',
      [id]
    );
    return rows[0];
  });

  res.json({
    ok: true,
    data: { participant, password_changed: true, sessions_revoked: true },
    meta: nowMeta()
  });
}));
