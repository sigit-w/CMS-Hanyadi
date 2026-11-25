import { Router } from 'express';
import { query, withTransaction } from './db.js';
import { ApiError, asyncHandler } from './errors.js';
import { authorize } from './authMiddleware.js';
import { parseId } from './validate.js';
import { hashPassword } from './auth.js';
import { generateParticipantUsername, waDigits } from './identity.js';

export const participantRouter = Router();

const nowMeta = () => ({ ts: new Date().toISOString() });
const manageParticipants = authorize('tryouts.manage');

const PARTICIPANT_SELECT = `
  SELECT p.id, p.nama, p.jenis, p.email, p.kelas, p.sekolah,
         p.program_belajar_id, pb.name AS program_belajar_name, p.wa_orang_tua,
         p.jenjang_id, j.kode AS jenjang_kode, j.nama AS jenjang_nama, p.username,
         p.is_active, p.prospek, p.prospek_at, p.bergabung, p.bergabung_at,
         p.created_at, p.updated_at,
         (SELECT count(*)::int FROM tryout_submissions ts WHERE ts.participant_id = p.id) AS submission_count
  FROM tryout_participants p
  LEFT JOIN program_belajar pb ON pb.id = p.program_belajar_id
  LEFT JOIN jenjang j ON j.id = p.jenjang_id
`;

const SISWA_SELECT = `
  SELECT s.id, s.nama, s.email, s.kelas, s.sekolah,
         s.program_belajar_id, pb.name AS program_belajar_name, s.wa_orang_tua,
         s.jenjang_id, j.kode AS jenjang_kode, j.nama AS jenjang_nama, s.username,
         s.is_active, s.created_at, s.updated_at,
         (SELECT count(*)::int FROM tryout_submissions ts WHERE ts.participant_id = s.id) AS submission_count
  FROM siswa s
  LEFT JOIN program_belajar pb ON pb.id = s.program_belajar_id
  LEFT JOIN jenjang j ON j.id = s.jenjang_id
 `;

const PARTICIPANT_DETAIL_SELECT = `
  SELECT p.id, p.nama, p.jenis, p.email, p.kelas, p.sekolah,
         p.program_belajar_id, pb.name AS program_belajar_name, p.wa_orang_tua,
         p.jenjang_id, j.kode AS jenjang_kode, j.nama AS jenjang_nama, p.username,
         p.is_active, p.prospek, p.prospek_at, p.bergabung, p.bergabung_at,
         p.password_plain, p.pin_plain, p.created_at, p.updated_at,
         (SELECT count(*)::int FROM tryout_submissions ts WHERE ts.participant_id = p.id) AS submission_count
  FROM tryout_participants p
  LEFT JOIN program_belajar pb ON pb.id = p.program_belajar_id
  LEFT JOIN jenjang j ON j.id = p.jenjang_id
`;

function participantTable(jenis) {
  return jenis === 'umum' ? 'prospektus' : 'siswa';
}

function appendSearch(where, params, search) {
  if (search === undefined || search === null || !String(search).trim()) return where;
  params.push(`%${String(search).trim()}%`);
  where.push(`(p.nama ILIKE $${params.length}
              OR coalesce(p.email, '') ILIKE $${params.length}
              OR coalesce(p.username, '') ILIKE $${params.length}
              OR coalesce(p.jenjang_kode, '') ILIKE $${params.length}
              OR coalesce(p.jenjang_nama, '') ILIKE $${params.length}
              OR p.kelas::text ILIKE $${params.length}
              OR coalesce(p.sekolah, '') ILIKE $${params.length})`);
  return where;
}

async function loadParticipant(client, id) {
  const { rows } = await client.query(`${PARTICIPANT_SELECT} WHERE p.id = $1`, [id]);
  return rows[0];
}

async function loadParticipantDetail(client, id) {
  const executor = client ?? { query };
  const { rows } = await executor.query(`${PARTICIPANT_DETAIL_SELECT} WHERE p.id = $1`, [id]);
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
  if (!/^\d{8,15}$/.test(pin)) {
    throw new ApiError('VALIDATION_ERROR', 'PIN harus berupa 8 sampai 15 digit angka nomor WA');
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

async function loadJenjangCode(client, jenjangId) {
  if (jenjangId === null || jenjangId === undefined) return null;
  const run = client?.query ? client.query.bind(client) : query;
  const { rows } = await run('SELECT id, kode FROM jenjang WHERE id = $1', [jenjangId]);
  if (!rows[0]) throw new ApiError('VALIDATION_ERROR', 'Jenjang tidak ditemukan');
  return rows[0].kode;
}

async function parseJenjangId(client, value) {
  if (value === undefined || value === null || value === '') return null;
  const id = parseId(value, 'jenjang_id');
  await loadJenjangCode(client, id);
  return id;
}

function credentialFromWa(value, field = 'wa_orang_tua') {
  try {
    return waDigits(value);
  } catch {
    throw new ApiError('VALIDATION_ERROR', `${field} harus berupa 8 sampai 15 digit angka`);
  }
}

function defaultParticipantPassword(nama, wa) {
  let digits = null;
  try {
    digits = credentialFromWa(wa);
  } catch {
    digits = null;
  }
  if (digits) return digits;
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
    `SELECT id FROM siswa
     WHERE lower(email) = $1 AND ($2::bigint IS NULL OR id <> $2)`,
    [email, excludeId]
  );
  return rows[0];
}

async function findByNamaUmum(client, nama, excludeId = null) {
  const run = client?.query ? client.query.bind(client) : query;
  const { rows } = await run(
    `SELECT id FROM prospektus
     WHERE jenis = 'umum' AND lower(nama) = lower($1) AND ($2::bigint IS NULL OR id <> $2)`,
    [nama, excludeId]
  );
  return rows[0];
}

async function loadJenis(client, id) {
  const { rows } = await client.query(
    `SELECT id, jenis, wa_orang_tua, jenjang_id, jenjang_kode, username
     FROM tryout_participants WHERE id = $1`,
    [id]
  );
  return rows[0];
}

participantRouter.get('/siswa', manageParticipants, asyncHandler(async (req, res) => {
  const params = [];
  const where = ["s.jenis = 'siswa'"];
  if (req.query.jenjang_id) {
    params.push(parseId(req.query.jenjang_id, 'jenjang_id'));
    where.push(`s.jenjang_id = $${params.length}`);
  }
  const search = req.query.search ?? req.query.q;
  if (search !== undefined && search !== null && String(search).trim()) {
    params.push(`%${String(search).trim()}%`);
    where.push(`(s.nama ILIKE $${params.length}
                OR coalesce(s.email, '') ILIKE $${params.length}
                OR s.kelas::text ILIKE $${params.length}
                OR coalesce(s.sekolah, '') ILIKE $${params.length})`);
  }
  const { rows } = await query(
    `${SISWA_SELECT} WHERE ${where.join(' AND ')} ORDER BY s.id DESC`,
    params
  );
  res.json({ ok: true, data: { siswa: rows }, meta: nowMeta() });
}));

participantRouter.get('/participants', manageParticipants, asyncHandler(async (req, res) => {
  const prospekFilter = req.query.prospek;
  if (prospekFilter !== undefined && prospekFilter !== 'true' && prospekFilter !== 'false') {
    throw new ApiError('VALIDATION_ERROR', 'prospek harus bernilai true atau false');
  }
  const params = [];
  const conditions = [];
  if (prospekFilter !== undefined) {
    params.push(prospekFilter === 'true');
    conditions.push(`p.prospek = $${params.length}`);
  }
  if (req.query.jenjang_id) {
    params.push(parseId(req.query.jenjang_id, 'jenjang_id'));
    conditions.push(`p.jenjang_id = $${params.length}`);
  }
  appendSearch(conditions, params, req.query.search ?? req.query.q);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query(`${PARTICIPANT_SELECT} ${where} ORDER BY p.id DESC`, params);
  res.json({ ok: true, data: { participants: rows }, meta: nowMeta() });
}));

participantRouter.get('/participants/:id/detail', manageParticipants, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const participant = await loadParticipantDetail(null, id);
  if (!participant) throw new ApiError('NOT_FOUND', 'Peserta tidak ditemukan', 404);
  res.json({ ok: true, data: { participant }, meta: nowMeta() });
}));

participantRouter.get('/prospektus', manageParticipants, asyncHandler(async (req, res) => {
  const params = [];
  const conditions = ["p.jenis = 'umum'"];
  if (req.query.jenjang_id) {
    params.push(parseId(req.query.jenjang_id, 'jenjang_id'));
    conditions.push(`p.jenjang_id = $${params.length}`);
  }
  appendSearch(conditions, params, req.query.search ?? req.query.q);
  const { rows } = await query(
    `${PARTICIPANT_SELECT}
     WHERE ${conditions.join(' AND ')}
     ORDER BY p.bergabung, p.prospek_at DESC NULLS LAST, p.id DESC`,
    params
  );
  res.json({ ok: true, data: { prospektus: rows }, meta: nowMeta() });
}));

participantRouter.get('/prospektus/:id', manageParticipants, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const prospektus = await loadParticipantDetail(null, id);
  if (!prospektus || prospektus.jenis !== 'umum') {
    throw new ApiError('NOT_FOUND', 'Prospektus tidak ditemukan', 404);
  }
  res.json({ ok: true, data: { prospektus }, meta: nowMeta() });
}));

participantRouter.post('/prospektus/:id/daftar', manageParticipants, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const email = requireEmail(req.body?.email);
  const kelas = requireKelas(req.body?.kelas);
  const programBelajarId = parseProgramBelajarId(req.body?.program_belajar_id);
  const waOrangTua = parseWaOrangTua(req.body?.wa_orang_tua);
  const rawPassword = req.body?.password;

  const result = await withTransaction(async (client) => {
    const current = await client.query(
      `SELECT id, nama, sekolah, wa_orang_tua, jenjang_id, username, bergabung
       FROM prospektus WHERE id = $1 AND jenis = $2`,
      [id, 'umum']
    );
    const prospect = current.rows[0];
    if (!prospect) throw new ApiError('NOT_FOUND', 'Prospektus tidak ditemukan', 404);
    if (prospect.bergabung) {
      throw new ApiError('CONFLICT', 'Prospektus ini sudah didaftarkan sebagai siswa', 409);
    }
    if (await findByEmail(client, email)) {
      throw new ApiError('CONFLICT', 'Email siswa sudah digunakan', 409);
    }
    await ensureProgramBelajar(client, programBelajarId);
    const effectiveWa = waOrangTua || prospect.wa_orang_tua;
    const jenjangId = await parseJenjangId(client, req.body?.jenjang_id ?? prospect.jenjang_id);
    const kodeJenjang = await loadJenjangCode(client, jenjangId);
    const username = generateParticipantUsername(kodeJenjang, effectiveWa) || prospect.username;
    const password = typeof rawPassword === 'string' && rawPassword.trim()
      ? requirePassword(rawPassword, req.body?.confirm_password)
      : defaultParticipantPassword(prospect.nama, effectiveWa);
    const passwordHash = await hashPassword(password);
    const inserted = await client.query(
      `INSERT INTO siswa
         (nama, jenis, email, password_hash, password_plain, kelas, sekolah,
          program_belajar_id, wa_orang_tua, jenjang_id, username)
       VALUES ($1, 'siswa', $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [prospect.nama, email, passwordHash, password, kelas,
        req.body?.sekolah || prospect.sekolah, programBelajarId,
        effectiveWa, jenjangId, username]
    );
    await client.query(
      `UPDATE prospektus SET bergabung = true, bergabung_at = now()
       WHERE id = $1 AND bergabung = false`,
      [id]
    );
    return loadParticipant(client, inserted.rows[0].id);
  });

  res.status(201).json({ ok: true, data: { participant: result, prospektus_id: id }, meta: nowMeta() });
}));

participantRouter.post('/participants', manageParticipants, asyncHandler(async (req, res) => {
  const jenis = requireJenis(req.body?.jenis);
  const nama = requireNama(req.body?.nama);
  const sekolah = requireSekolah(req.body?.sekolah);
  const jenjangId = await parseJenjangId(null, req.body?.jenjang_id);
  const kodeJenjang = await loadJenjangCode(null, jenjangId);

  let username = null;
  let email = null;
  let kelas = 0;
  let programBelajarId = null;
  let passwordHash = null;
  let passwordPlain = null;
  let pinHash = null;
  let pinPlain = null;
  let waOrangTua;

  if (jenis === 'umum') {
    waOrangTua = parseWaOrangTua(req.body?.wa_orang_tua, true);
    const pin = req.body?.pin ? requirePin(req.body.pin) : credentialFromWa(waOrangTua);
    if (!pin) throw new ApiError('VALIDATION_ERROR', 'PIN wajib diisi');
    pinHash = await hashPassword(pin);
    pinPlain = pin;
  } else {
    email = requireEmail(req.body?.email);
    kelas = requireKelas(req.body?.kelas);
    programBelajarId = parseProgramBelajarId(req.body?.program_belajar_id);
    waOrangTua = parseWaOrangTua(req.body?.wa_orang_tua);
    const rawPassword = req.body?.password;
    const password = typeof rawPassword === 'string' && rawPassword.trim()
      ? rawPassword
      : defaultParticipantPassword(nama, waOrangTua);
    passwordHash = await hashPassword(requirePassword(password));
    passwordPlain = password;
  }
  username = generateParticipantUsername(kodeJenjang, waOrangTua);

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
      `INSERT INTO ${participantTable(jenis)}
         (nama, jenis, email, kelas, sekolah, program_belajar_id, wa_orang_tua,
          jenjang_id, username, password_hash, password_plain, pin_hash, pin_plain)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [nama, jenis, email, kelas, sekolah, programBelajarId, waOrangTua,
        jenjangId, username, passwordHash, passwordPlain, pinHash, pinPlain]
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
    const jenjangId = await parseJenjangId(client, req.body?.jenjang_id ?? current.jenjang_id);
    const kodeJenjang = await loadJenjangCode(client, jenjangId);
    let rows;

    if (current.jenis === 'umum') {
      if (await findByNamaUmum(client, nama, id)) {
        throw new ApiError('CONFLICT', 'Nama Peserta Umum sudah digunakan', 409);
      }
      const waOrangTua = parseWaOrangTua(req.body?.wa_orang_tua ?? current.wa_orang_tua, true);
      const username = generateParticipantUsername(kodeJenjang, waOrangTua) || current.username;
      const updated = await client.query(
        `UPDATE ${participantTable(current.jenis)}
         SET nama = $2, sekolah = $3, wa_orang_tua = $4, is_active = $5,
             jenjang_id = $6, username = $7
         WHERE id = $1 AND jenis = 'umum'
         RETURNING id`,
        [id, nama, sekolah, waOrangTua, isActive, jenjangId, username]
      );
      rows = updated.rows;
    } else {
      const email = requireEmail(req.body?.email);
      const kelas = requireKelas(req.body?.kelas);
      const programBelajarId = parseProgramBelajarId(req.body?.program_belajar_id);
      const waOrangTua = parseWaOrangTua(req.body?.wa_orang_tua ?? current.wa_orang_tua);
      if (await findByEmail(client, email, id)) {
        throw new ApiError('CONFLICT', 'Email siswa sudah digunakan', 409);
      }
      await ensureProgramBelajar(client, programBelajarId);
      const username = generateParticipantUsername(kodeJenjang, waOrangTua) || current.username;
      const updated = await client.query(
        `UPDATE ${participantTable(current.jenis)}
         SET nama = $2, email = $3, kelas = $4, sekolah = $5,
             program_belajar_id = $6, wa_orang_tua = $7, is_active = $8,
             jenjang_id = $9, username = $10
         WHERE id = $1 AND jenis = 'siswa'
         RETURNING id`,
        [id, nama, email, kelas, sekolah, programBelajarId, waOrangTua, isActive, jenjangId, username]
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
    const current = await loadJenis(client, id);
    if (!current) throw new ApiError('NOT_FOUND', 'Peserta tidak ditemukan', 404);
    const { rows } = await client.query(
      `UPDATE ${participantTable(current.jenis)} SET is_active = false
       WHERE id = $1
       RETURNING id, nama, jenis, email, kelas, sekolah, is_active`,
      [id]
    );
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
      `UPDATE prospektus
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
      `UPDATE siswa
       SET password_hash = $2, password_plain = $3,
           failed_login_count = 0, locked_until = NULL
       WHERE id = $1 AND is_active = true AND jenis = 'siswa'
       RETURNING id, nama, email, kelas, sekolah`,
      [id, passwordHash, req.body?.password]
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
