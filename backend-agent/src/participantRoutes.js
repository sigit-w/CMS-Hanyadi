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
  SELECT p.id, p.nama, p.jenis, p.email, p.kelas, p.sekolah,
         p.program_belajar_id, pb.name AS program_belajar_name, p.wa_orang_tua,
         p.is_active, p.prospek, p.prospek_at, p.created_at, p.updated_at,
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
    throw new ApiError('VALIDATION_ERROR', 'Nama wajib diisi maksimal 128 karakter');
  }
  return nama;
}

function requireJenis(value) {
  const jenis = typeof value === 'string' ? value.trim().toLowerCase() : 'siswa';
  if (!['siswa', 'umum'].includes(jenis)) {
    throw new ApiError('VALIDATION_ERROR', 'jenis harus siswa atau umum');
  }
  return jenis;
}

function requirePin(value) {
  const pin = typeof value === 'string' ? value.trim() : '';
  if (!/^\d{9}$/.test(pin)) {
    throw new ApiError('VALIDATION_ERROR', 'PIN harus tepat 9 digit angka');
  }
  return pin;
}

function parseProgramBelajarId(value) {
  if (value === undefined || value === null || value === '') return null;
  return parseId(value, 'program_belajar_id');
}

function parseWaOrangTua(value, required = false) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ApiError('VALIDATION_ERROR', 'Nomor WA orang tua wajib diisi');
    return null;
  }
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

async function findByNamaUmum(client, nama, excludeId = null) {
  const run = client?.query ? client.query.bind(client) : query;
  const { rows } = await run(
    `SELECT id FROM tryout_participants
     WHERE jenis = 'umum' AND lower(nama) = lower($1) AND ($2::bigint IS NULL OR id <> $2)`,
    [nama, excludeId]
  );
  return rows[0];
}

async function loadJenis(client, id) {
  const { rows } = await client.query('SELECT id, jenis FROM tryout_participants WHERE id = $1', [id]);
  return rows[0];
}

participantRouter.get('/participants', manageParticipants, asyncHandler(async (req, res) => {
  const prospekFilter = req.query.prospek;
  if (prospekFilter !== undefined && prospekFilter !== 'true' && prospekFilter !== 'false') {
    throw new ApiError('VALIDATION_ERROR', 'prospek harus bernilai true atau false');
  }
  const params = [];
  let where = '';
  if (prospekFilter !== undefined) {
    params.push(prospekFilter === 'true');
    where = 'WHERE p.prospek = $1';
  }
  const { rows } = await query(`${PARTICIPANT_SELECT} ${where} ORDER BY p.id DESC`, params);
  res.json({ ok: true, data: { participants: rows }, meta: nowMeta() });
}));

participantRouter.get('/prospektus', manageParticipants, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `${PARTICIPANT_SELECT}
     WHERE p.prospek = true
     ORDER BY p.prospek_at DESC NULLS LAST, p.id DESC`
  );
  res.json({ ok: true, data: { prospektus: rows }, meta: nowMeta() });
}));

participantRouter.post('/participants', manageParticipants, asyncHandler(async (req, res) => {
  const jenis = requireJenis(req.body?.jenis);
  const nama = requireNama(req.body?.nama);
  const sekolah = requireSekolah(req.body?.sekolah);

  let email = null;
  let kelas = 0;
  let programBelajarId = null;
  let passwordHash = null;
  let pinHash = null;
  let waOrangTua;

  if (jenis === 'umum') {
    pinHash = await hashPassword(requirePin(req.body?.pin));
    waOrangTua = parseWaOrangTua(req.body?.wa_orang_tua, true);
  } else {
    email = requireEmail(req.body?.email);
    kelas = requireKelas(req.body?.kelas);
    programBelajarId = parseProgramBelajarId(req.body?.program_belajar_id);
    waOrangTua = parseWaOrangTua(req.body?.wa_orang_tua);
    const rawPassword = req.body?.password;
    const password = typeof rawPassword === 'string' && rawPassword.trim()
      ? rawPassword
      : defaultParticipantPassword(nama);
    passwordHash = await hashPassword(requirePassword(password));
  }

  const participant = await withTransaction(async (client) => {
    if (jenis === 'umum') {
      if (await findByNamaUmum(client, nama)) {
        throw new ApiError('CONFLICT', 'Nama Peserta Umum sudah digunakan', 409);
      }
    } else {
      if (await findByEmail(client, email)) {
        throw new ApiError('CONFLICT', 'Email siswa sudah digunakan', 409);
      }
      await ensureProgramBelajar(client, programBelajarId);
    }
    const { rows } = await client.query(
      `INSERT INTO tryout_participants
         (nama, jenis, email, kelas, sekolah, program_belajar_id, wa_orang_tua, password_hash, pin_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [nama, jenis, email, kelas, sekolah, programBelajarId, waOrangTua, passwordHash, pinHash]
    );
    return loadParticipant(client, rows[0].id);
  });

  res.status(201).json({ ok: true, data: { participant }, meta: nowMeta() });
}));

participantRouter.put('/participants/:id', manageParticipants, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const isActive = req.body?.is_active === undefined ? true : Boolean(req.body.is_active);

  const participant = await withTransaction(async (client) => {
    const current = await loadJenis(client, id);
    if (!current) throw new ApiError('NOT_FOUND', 'Peserta tidak ditemukan', 404);

    const nama = requireNama(req.body?.nama);
    const sekolah = requireSekolah(req.body?.sekolah);
    let rows;

    if (current.jenis === 'umum') {
      if (await findByNamaUmum(client, nama, id)) {
        throw new ApiError('CONFLICT', 'Nama Peserta Umum sudah digunakan', 409);
      }
      const waOrangTua = parseWaOrangTua(req.body?.wa_orang_tua, true);
      const updated = await client.query(
        `UPDATE tryout_participants
         SET nama = $2, sekolah = $3, wa_orang_tua = $4, is_active = $5
         WHERE id = $1 AND jenis = 'umum'
         RETURNING id`,
        [id, nama, sekolah, waOrangTua, isActive]
      );
      rows = updated.rows;
    } else {
      const email = requireEmail(req.body?.email);
      const kelas = requireKelas(req.body?.kelas);
      const programBelajarId = parseProgramBelajarId(req.body?.program_belajar_id);
      const waOrangTua = parseWaOrangTua(req.body?.wa_orang_tua);
      if (await findByEmail(client, email, id)) {
        throw new ApiError('CONFLICT', 'Email siswa sudah digunakan', 409);
      }
      await ensureProgramBelajar(client, programBelajarId);
      const updated = await client.query(
        `UPDATE tryout_participants
         SET nama = $2, email = $3, kelas = $4, sekolah = $5,
             program_belajar_id = $6, wa_orang_tua = $7, is_active = $8
         WHERE id = $1 AND jenis = 'siswa'
         RETURNING id`,
        [id, nama, email, kelas, sekolah, programBelajarId, waOrangTua, isActive]
      );
      rows = updated.rows;
    }

    if (!rows[0]) throw new ApiError('NOT_FOUND', 'Peserta tidak ditemukan', 404);
    if (!isActive) {
      await client.query(
        'UPDATE auth_sessions SET revoked_at = now() WHERE participant_id = $1 AND revoked_at IS NULL',
        [id]
      );
    }
    return loadParticipant(client, id);
  });

  res.json({ ok: true, data: { participant }, meta: nowMeta() });
}));

participantRouter.delete('/participants/:id', manageParticipants, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const participant = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE tryout_participants SET is_active = false
       WHERE id = $1
       RETURNING id, nama, jenis, email, kelas, sekolah, is_active`,
      [id]
    );
    if (!rows[0]) throw new ApiError('NOT_FOUND', 'Peserta tidak ditemukan', 404);
    await client.query(
      'UPDATE auth_sessions SET revoked_at = now() WHERE participant_id = $1 AND revoked_at IS NULL',
      [id]
    );
    return rows[0];
  });
  res.json({ ok: true, data: { participant, deleted: true }, meta: nowMeta() });
}));

participantRouter.post('/participants/:id/prospek', manageParticipants, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  const participant = await withTransaction(async (client) => {
    const current = await client.query(
      'SELECT id, jenis FROM tryout_participants WHERE id = $1',
      [id]
    );
    const row = current.rows[0];
    if (!row) throw new ApiError('NOT_FOUND', 'Peserta tidak ditemukan', 404);
    if (row.jenis !== 'umum') {
      throw new ApiError('VALIDATION_ERROR', 'Hanya Peserta Umum yang dapat menjadi prospek');
    }

    const updated = await client.query(
      `UPDATE tryout_participants
       SET is_active = false, prospek = true, prospek_at = now()
       WHERE id = $1
       RETURNING id, nama, jenis, is_active, prospek, prospek_at`,
      [id]
    );
    await client.query(
      `UPDATE auth_sessions SET revoked_at = now()
       WHERE participant_id = $1 AND revoked_at IS NULL`,
      [id]
    );
    return updated.rows[0];
  });

  res.json({ ok: true, data: { participant, prospek: true }, meta: nowMeta() });
}));

participantRouter.put('/participants/:id/password', manageParticipants, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const passwordHash = await hashPassword(requirePassword(req.body?.password, req.body?.confirm_password));

  const participant = await withTransaction(async (client) => {
    const current = await loadJenis(client, id);
    if (!current) throw new ApiError('NOT_FOUND', 'Peserta tidak ditemukan atau tidak aktif', 404);
    if (current.jenis === 'umum') {
      throw new ApiError('VALIDATION_ERROR', 'Peserta Umum memakai PIN; reset PIN belum tersedia');
    }
    const { rows } = await client.query(
      `UPDATE tryout_participants
       SET password_hash = $2, failed_login_count = 0, locked_until = NULL
       WHERE id = $1 AND is_active = true AND jenis = 'siswa'
       RETURNING id, nama, email, kelas, sekolah`,
      [id, passwordHash]
    );
    if (!rows[0]) throw new ApiError('NOT_FOUND', 'Peserta tidak ditemukan atau tidak aktif', 404);
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
