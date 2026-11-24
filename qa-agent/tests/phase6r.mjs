import { adminHeaders, API_BASE } from './auth-helper.mjs';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { query, pool } from '../../backend-agent/src/db.js';

const ROOT = '/opt/virtual-office-bank-soal';
const DIST = `${ROOT}/frontend-agent/dist/assets`;
const OPENAPI = `${ROOT}/backend-agent/openapi/openapi.yaml`;
const DB_DOC = `${ROOT}/db/README.md`;
const ADR = `${ROOT}/pm-agent/decisions/ADR-010-siswa-prospektus-kredensial.md`;
const PROSPEKTUS_PAGE = `${ROOT}/frontend-agent/src/pages/ProspektusManagement.jsx`;
const SISWA_PAGE = `${ROOT}/frontend-agent/src/pages/PesertaManagement.jsx`;
const TRYOUT_PAGE = `${ROOT}/frontend-agent/src/pages/TryoutManagement.jsx`;

const suffix = crypto.randomBytes(4).toString('hex');
const umumNama = `QA 6R Umum ${suffix}`;
const umumPin = String(crypto.randomInt(0, 1_000_000_000)).padStart(9, '0');
const siswaNama = `QA 6R Siswa ${suffix}`;
const siswaEmail = `qa6r.siswa.${suffix}@example.com`;
const siswaPassword = `Siswa${suffix}A`;
const daftarEmail = `qa6r.daftar.${suffix}@example.com`;
const daftarPassword = `Daftar${suffix}B`;

let umumId;
let siswaId;
let daftarId;
let daftarSiswaId;

async function api(pathname, options = {}) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...await adminHeaders(), ...(options.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function login(username, password) {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

async function createParticipant(payload) {
  const result = await api('/api/v1/participants', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body.data.participant;
}

before(async () => {
  const response = await fetch(`${API_BASE}/health`);
  assert.equal(response.status, 200);
});

after(async () => {
  const ids = [umumId, siswaId, daftarId, daftarSiswaId].filter(Boolean);
  if (ids.length) {
    await query('DELETE FROM tryout_participants WHERE id = ANY($1::bigint[])', [ids]);
  }
  await pool.end();
});

test('PS-01 Peserta Umum dari form tryout tersimpan di prospektus dan tetap login', async () => {
  const participant = await createParticipant({
    jenis: 'umum',
    nama: umumNama,
    sekolah: 'Sekolah QA 6R',
    pin: umumPin,
    wa_orang_tua: '081234567890'
  });
  umumId = participant.id;

  const inProspektus = await query('SELECT pin_plain, bergabung FROM prospektus WHERE id = $1', [umumId]);
  assert.equal(inProspektus.rows.length, 1);
  assert.equal(inProspektus.rows[0].pin_plain, umumPin);
  assert.equal(inProspektus.rows[0].bergabung, false);

  const inSiswa = await query('SELECT id FROM siswa WHERE id = $1', [umumId]);
  assert.equal(inSiswa.rows.length, 0);

  const detail = await api(`/api/v1/participants/${umumId}/detail`);
  assert.equal(detail.status, 200, JSON.stringify(detail.body));
  assert.equal(detail.body.data.participant.pin_plain, umumPin);

  const accepted = await login(umumNama, umumPin);
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
});

test('PS-02 detail siswa menampilkan password dan list tidak membocorkan kredensial', async () => {
  const participant = await createParticipant({
    nama: siswaNama,
    email: siswaEmail,
    kelas: 7,
    sekolah: 'SMA QA 6R',
    password: siswaPassword,
    wa_orang_tua: '081234567891'
  });
  siswaId = participant.id;

  const inSiswa = await query('SELECT password_plain FROM siswa WHERE id = $1', [siswaId]);
  assert.equal(inSiswa.rows[0].password_plain, siswaPassword);

  const detail = await api(`/api/v1/participants/${siswaId}/detail`);
  assert.equal(detail.status, 200, JSON.stringify(detail.body));
  assert.equal(detail.body.data.participant.password_plain, siswaPassword);

  const list = await api('/api/v1/participants');
  const row = list.body.data.participants.find((item) => item.id === siswaId);
  assert.ok(row);
  for (const field of ['password_plain', 'pin_plain', 'password_hash', 'pin_hash']) {
    assert.equal(Object.hasOwn(row, field), false, `${field} bocor di list participants`);
  }
});

test('PS-03 prospektus didaftarkan sebagai siswa dan ditandai bergabung', async () => {
  const participant = await createParticipant({
    jenis: 'umum',
    nama: `QA 6R Daftar ${suffix}`,
    sekolah: 'Sekolah QA 6R Daftar',
    pin: umumPin,
    wa_orang_tua: '081234567892'
  });
  daftarId = participant.id;

  const daftar = await api(`/api/v1/prospektus/${daftarId}/daftar`, {
    method: 'POST',
    body: JSON.stringify({
      email: daftarEmail,
      kelas: 8,
      password: daftarPassword,
      wa_orang_tua: '081234567893'
    })
  });
  assert.equal(daftar.status, 201, JSON.stringify(daftar.body));
  daftarSiswaId = daftar.body.data.participant.id;

  const siswaRow = await query(
    'SELECT id, email, kelas, password_plain FROM siswa WHERE email = $1',
    [daftarEmail]
  );
  assert.equal(siswaRow.rows.length, 1);
  assert.equal(siswaRow.rows[0].kelas, 8);
  assert.equal(siswaRow.rows[0].password_plain, daftarPassword);

  const prospekRow = await query('SELECT bergabung, bergabung_at FROM prospektus WHERE id = $1', [participant.id]);
  assert.equal(prospekRow.rows[0].bergabung, true);
  assert.ok(prospekRow.rows[0].bergabung_at);

  const accepted = await login(daftarEmail, daftarPassword);
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));

  const again = await api(`/api/v1/prospektus/${participant.id}/daftar`, {
    method: 'POST',
    body: JSON.stringify({ email: `lain.${suffix}@example.com`, kelas: 9 })
  });
  assert.equal(again.status, 409);
});

test('PS-04 password user CMS tetap hash dan tidak ditampilkan', async () => {
  const users = await api('/api/v1/users');
  assert.equal(users.status, 200);
  const raw = JSON.stringify(users.body);
  assert.ok(!raw.includes('password_hash'));
  assert.ok(!raw.includes('password_plain'));

  const columns = await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'contributors'
       AND column_name LIKE '%plain%'`
  );
  assert.equal(columns.rows.length, 0);

  const hashes = await query(
    "SELECT password_hash FROM contributors WHERE password_hash IS NOT NULL LIMIT 1"
  );
  assert.ok(hashes.rows.length === 0 || hashes.rows[0].password_hash.startsWith('scrypt$'));
});

test('PS-05 trigger integritas menolak participant_id tidak ditemukan', async () => {
  const bogus = 987654321;
  await assert.rejects(
    query(
      `INSERT INTO auth_sessions (participant_id, refresh_hash, expires_at, last_used_at)
       VALUES ($1, $2, now() + interval '1 day', now())`,
      [bogus, `qa6r-${suffix}`]
    ),
    /participant_id/
  );
  const found = await query('SELECT id FROM auth_sessions WHERE participant_id = $1', [bogus]);
  assert.equal(found.rows.length, 0);
});

test('PS-06 marker UI kredensial dan pendaftaran tersedia di bundle', () => {
  const bundle = readFileSync(`${DIST}/${readdirSync(DIST).find((file) => file.endsWith('.js'))}`, 'utf8');
  for (const marker of ['Daftarkan sebagai Siswa', 'Bergabung', 'Password / PIN', '#/tryouts/prospektus']) {
    assert.ok(bundle.includes(marker), `Marker bundle ${marker} tidak ditemukan`);
  }
  for (const [path, marker] of [
    [PROSPEKTUS_PAGE, 'getProspektusDetail'],
    [SISWA_PAGE, 'getParticipantDetail'],
    [TRYOUT_PAGE, 'openParticipantDetail']
  ]) {
    assert.ok(readFileSync(path, 'utf8').includes(marker), `Marker ${marker} tidak ditemukan di ${path}`);
  }
});

test('PS-07 kontrak dan dokumentasi Fase 6r lengkap', () => {
  const openapi = readFileSync(OPENAPI, 'utf8');
  for (const marker of [
    '/api/v1/participants/{id}/detail',
    '/api/v1/prospektus/{id}',
    '/api/v1/prospektus/{id}/daftar'
  ]) {
    assert.ok(openapi.includes(marker), `OpenAPI belum punya ${marker}`);
  }
  assert.ok(readFileSync(DB_DOC, 'utf8').includes('024_siswa_prospektus_kredensial.sql'));
  assert.ok(readFileSync(ADR, 'utf8').includes('ADR-010'));
});
