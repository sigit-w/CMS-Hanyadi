import { adminHeaders, API_BASE, PRESENTATION_BASE } from './auth-helper.mjs';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { query, pool } from '../../backend-agent/src/db.js';

const ROOT = '/opt/virtual-office-bank-soal';
const TRYOUT_PAGE = `${ROOT}/frontend-agent/src/pages/TryoutManagement.jsx`;
const PROSPEKTUS_PAGE = `${ROOT}/frontend-agent/src/pages/ProspektusManagement.jsx`;
const APP = `${ROOT}/frontend-agent/src/App.jsx`;
const SISWA_PAGE = `${ROOT}/frontend-agent/src/pages/PesertaManagement.jsx`;
const DIST = `${ROOT}/frontend-agent/dist/assets`;
const OPENAPI = `${ROOT}/backend-agent/openapi/openapi.yaml`;
const DB_DOC = `${ROOT}/db/README.md`;
const ADR = `${ROOT}/pm-agent/decisions/ADR-008-peserta-tryout-dan-prospektus.md`;

const suffix = crypto.randomBytes(4).toString('hex');
const siswaEmail = `qa6p.siswa.${suffix}@example.com`;
const siswaNama = `QA 6P Siswa ${suffix}`;
const siswaPassword = `Siswa${suffix}A`;
const umumNama = `QA 6P Umum ${suffix}`;
const umumPin = String(crypto.randomInt(0, 1_000_000_000)).padStart(9, '0');
const draftNama = `QA 6P Draft ${suffix}`;
const draftPin = String(crypto.randomInt(0, 1_000_000_000)).padStart(9, '0');

let sheetId;
let mapelCode;
let siswaId;
let umumId;
let draftId;
let tryoutId;
let siswaBefore;

function jakartaInput(offsetHours = 0) {
  return new Date(Date.now() + (7 + offsetHours) * 60 * 60 * 1000).toISOString().slice(0, 16);
}

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

async function loadParticipant(id) {
  const { rows } = await query(
    `SELECT id, nama, jenis, is_active, prospek, prospek_at
     FROM tryout_participants WHERE id = $1`,
    [id]
  );
  return rows[0];
}

before(async () => {
  for (const base of [API_BASE, PRESENTATION_BASE]) {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
  }
  const sheets = await query(
    `SELECT sh.id, m.code AS mapel_code
     FROM question_sheets sh
     JOIN mapels m ON m.id = sh.mapel_id
     WHERE sh.archived = false
       AND EXISTS (
         SELECT 1 FROM question_sheet_questions qsq
         JOIN questions q ON q.id = qsq.question_id
         WHERE qsq.sheet_id = sh.id AND q.status <> 'archived'
       )
     ORDER BY sh.id DESC LIMIT 1`
  );
  assert.ok(sheets.rows[0], 'Harus ada lembar soal aktif berisi soal untuk fixture QA');
  sheetId = sheets.rows[0].id;
  mapelCode = sheets.rows[0].mapel_code;
});

after(async () => {
  if (tryoutId) {
    await query('DELETE FROM tryout_sessions WHERE id = $1', [tryoutId]);
  }
  const ids = [siswaId, umumId, draftId].filter(Boolean);
  if (ids.length) {
    await query('DELETE FROM auth_sessions WHERE participant_id = ANY($1::bigint[])', [ids]);
    await query('DELETE FROM tryout_participants WHERE id = ANY($1::bigint[])', [ids]);
  }
  await pool.end();
});

test('PR-01 migrasi dan kontrak Fase 6p terpasang', async () => {
  const columns = await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'tryout_participants'
       AND column_name IN ('prospek', 'prospek_at')`
  );
  const names = new Set(columns.rows.map((row) => row.column_name));
  assert.ok(names.has('prospek'));
  assert.ok(names.has('prospek_at'));

  const constraint = await query(
    `SELECT 1 FROM pg_constraint
     WHERE connamespace = 'public'::regnamespace
       AND conname = 'tryout_participants_prospek_check'`
  );
  assert.equal(constraint.rows.length, 1);

  const index = await query(
    `SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'idx_tryout_participants_prospek'`
  );
  assert.equal(index.rows.length, 1);

  const openapi = readFileSync(OPENAPI, 'utf8');
  for (const marker of [
    '/api/v1/prospektus',
    '/api/v1/tryouts/{id}/participants/{participantId}',
    '/api/v1/participants/{id}/prospek'
  ]) {
    assert.ok(openapi.includes(marker), `OpenAPI belum punya ${marker}`);
  }
  assert.ok(readFileSync(DB_DOC, 'utf8').includes('023_prospektus_peserta_umum.sql'));
  assert.ok(readFileSync(ADR, 'utf8').includes('ADR-008'));
});

test('PR-02 siswa tidak tampil default di daftar peserta tryout', () => {
  const source = readFileSync(TRYOUT_PAGE, 'utf8');
  assert.ok(!source.includes('Data siswa tidak ditampilkan sampai dipilih melalui A. Peserta Didik.'),
    'Helper text lama masih ada di TryoutManagement');
  assert.ok(source.includes('draftParticipantRows'));
  assert.ok(source.includes('openPesertaSiswa'));
  assert.ok(!source.includes('checked={selectedParticipants.includes(id)}'),
    'Checkbox lama pada daftar peserta masih ada');
});

test('PR-03 picker, detail baris, dan trash icon tersedia', () => {
  const source = readFileSync(TRYOUT_PAGE, 'utf8');
  for (const marker of [
    'A. Peserta Didik',
    'B. Peserta Umum',
    'ParticipantRows',
    'Trash2',
    'Detail Peserta Tryout',
    'Hapus ${participant.nama} dari tryout',
    'Kelola Peserta',
    'removeTryoutParticipant',
    'markParticipantProspek'
  ]) {
    assert.ok(source.includes(marker), `Marker ${marker} tidak ditemukan di TryoutManagement`);
  }
  const bundle = readFileSync(`${DIST}/${readdirSync(DIST).find((file) => file.endsWith('.js'))}`, 'utf8');
  for (const marker of ['Prospektus', '#/tryouts/prospektus', 'A. Peserta Didik', 'Kelola Peserta']) {
    assert.ok(bundle.includes(marker), `Marker ${marker} tidak ditemukan di bundle CMS`);
  }
});

test('PR-04 hapus Umum dari tryout tersimpan masuk prospektus', async () => {
  siswaId = (await createParticipant({
    nama: siswaNama,
    email: siswaEmail,
    kelas: 5,
    sekolah: 'SMA QA 6P',
    password: siswaPassword
  })).id;
  umumId = (await createParticipant({
    jenis: 'umum',
    nama: umumNama,
    sekolah: 'Sekolah QA 6P',
    pin: umumPin,
    wa_orang_tua: '081234567890'
  })).id;

  siswaBefore = await loadParticipant(siswaId);
  const created = await api('/api/v1/tryouts', {
    method: 'POST',
    body: JSON.stringify({
      name: `TO QA 6P ${suffix}`,
      start_at: jakartaInput(),
      end_at: jakartaInput(2),
      mapel_code: mapelCode,
      sheet_ids: [sheetId],
      participant_ids: [siswaId, umumId],
      is_active: false
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  tryoutId = created.body.data.tryout.id;

  const removed = await api(`/api/v1/tryouts/${tryoutId}/participants/${umumId}`, { method: 'DELETE' });
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  assert.equal(removed.body.data.prospek, true);
  assert.equal(removed.body.data.participant.prospek, true);
  assert.equal(removed.body.data.participant.is_active, false);

  const detail = await api(`/api/v1/tryouts/${tryoutId}`);
  assert.equal(detail.status, 200);
  assert.deepEqual(detail.body.data.tryout.participant_ids.map(String), [String(siswaId)]);

  const prospektus = await api('/api/v1/prospektus');
  assert.equal(prospektus.status, 200);
  const found = prospektus.body.data.prospektus.find((item) => item.id === umumId);
  assert.ok(found, 'Peserta Umum tidak muncul di prospektus');
  assert.equal(found.prospek, true);

  const denied = await login(umumNama, umumPin);
  assert.equal(denied.status, 401);
  const relation = await query(
    'SELECT 1 FROM tryout_session_participants WHERE session_id = $1 AND participant_id = $2',
    [tryoutId, umumId]
  );
  assert.equal(relation.rows.length, 0);
});

test('PR-05 hapus Siswa hanya melepas relasi tryout', async () => {
  const removed = await api(`/api/v1/tryouts/${tryoutId}/participants/${siswaId}`, { method: 'DELETE' });
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  assert.equal(removed.body.data.prospek, false);

  const afterRow = await loadParticipant(siswaId);
  assert.deepEqual(afterRow, siswaBefore);

  const prospektus = await api('/api/v1/prospektus');
  assert.equal(prospektus.body.data.prospektus.some((item) => item.id === siswaId), false);

  const accepted = await login(siswaEmail, siswaPassword);
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));

  const relation = await query(
    'SELECT 1 FROM tryout_session_participants WHERE session_id = $1 AND participant_id = $2',
    [tryoutId, siswaId]
  );
  assert.equal(relation.rows.length, 0);
});

test('PR-06 prospek draft Umum dan menu Prospektus benar', async () => {
  draftId = (await createParticipant({
    jenis: 'umum',
    nama: draftNama,
    sekolah: 'Sekolah Draft QA 6P',
    pin: draftPin,
    wa_orang_tua: '081234567891'
  })).id;

  const marked = await api(`/api/v1/participants/${draftId}/prospek`, { method: 'POST' });
  assert.equal(marked.status, 200, JSON.stringify(marked.body));
  assert.equal(marked.body.data.participant.prospek, true);

  const denied = await login(draftNama, draftPin);
  assert.equal(denied.status, 401);

  const rejected = await api(`/api/v1/participants/${siswaId}/prospek`, { method: 'POST' });
  assert.equal(rejected.status, 400);

  const app = readFileSync(APP, 'utf8');
  assert.ok(app.includes("path: '/tryouts/prospektus'"));
  assert.ok(app.includes("label: 'Prospektus'"));
  assert.ok(app.includes('ProspektusManagement'));

  const prospektusPage = readFileSync(PROSPEKTUS_PAGE, 'utf8');
  assert.ok(prospektusPage.includes('getProspektus'));
  assert.ok(prospektusPage.includes('Data Peserta Umum yang dikeluarkan dari tryout'));

  const siswaPage = readFileSync(SISWA_PAGE, 'utf8');
  assert.ok(siswaPage.includes('Kelola Siswa'));
  assert.ok(!siswaPage.includes('Kelola Siswa Tryout'));
});

test('PR-07 dokumentasi dan regresi siap', async () => {
  const backendReadme = readFileSync(`${ROOT}/backend-agent/README.md`, 'utf8');
  assert.ok(backendReadme.includes('Fase 6p (ADR-008)'));
  const pmReadme = readFileSync(`${ROOT}/pm-agent/README.md`, 'utf8');
  assert.ok(pmReadme.includes('ADR-008-peserta-tryout-dan-prospektus.md'));
  const status = readFileSync(`${ROOT}/pm-agent/progress/status-board.md`, 'utf8');
  assert.ok(status.includes('Fase 6p'));
});

test('PR-08 health produksi dan service aktif', async () => {
  for (const base of [API_BASE, PRESENTATION_BASE]) {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok ?? true, true);
  }
});
