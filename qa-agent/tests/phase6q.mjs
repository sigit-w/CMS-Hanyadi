import { adminHeaders, API_BASE, PRESENTATION_BASE } from './auth-helper.mjs';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { query, pool } from '../../backend-agent/src/db.js';

const ROOT = '/opt/virtual-office-bank-soal';
const TRYOUT_PAGE = `${ROOT}/frontend-agent/src/pages/TryoutManagement.jsx`;
const PARTICIPANTS_PAGE = `${ROOT}/frontend-agent/src/pages/TryoutParticipantsPage.jsx`;
const APP_FILE = `${ROOT}/frontend-agent/src/App.jsx`;
const API_FILE = `${ROOT}/frontend-agent/src/api.js`;
const DIST = `${ROOT}/frontend-agent/dist/assets`;
const OPENAPI = `${ROOT}/backend-agent/openapi/openapi.yaml`;
const BACKEND_DOC = `${ROOT}/backend-agent/README.md`;
const ADR = `${ROOT}/pm-agent/decisions/ADR-009-kelola-peserta-tryout.md`;
const HELPER_TEXT = 'Data siswa tidak ditampilkan sampai dipilih melalui A. Peserta Didik.';

const suffix = crypto.randomBytes(4).toString('hex');
const siswaEmail = `qa6q.siswa.${suffix}@example.com`;
const siswaNama = `QA 6Q Siswa ${suffix}`;
const umumNama = `QA 6Q Umum ${suffix}`;
const umumPin = String(crypto.randomInt(0, 1_000_000_000)).padStart(9, '0');
const prospekNama = `QA 6Q Prospek ${suffix}`;
const prospekPin = String(crypto.randomInt(0, 1_000_000_000)).padStart(9, '0');

let sheetId;
let mapelCode;
let sheetJenjang;
let siswaId;
let umumId;
let prospekId;
let tryoutId;
let tryoutSessionId;

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

async function createParticipant(payload) {
  const result = await api('/api/v1/participants', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body.data.participant;
}

async function attach(participantIds, targetTryoutId = tryoutId) {
  return api(`/api/v1/tryouts/${targetTryoutId}/participants`, {
    method: 'POST',
    body: JSON.stringify({ participant_ids: participantIds })
  });
}

async function loadParticipant(id) {
  const { rows } = await query(
    `SELECT id, jenis, is_active, prospek FROM tryout_participants WHERE id = $1`,
    [id]
  );
  return rows[0];
}

after(async () => {
  if (tryoutSessionId) {
    await query('DELETE FROM auth_sessions WHERE tryout_session_id = $1', [tryoutSessionId]);
  }
  if (tryoutId) await query('DELETE FROM tryout_events WHERE id = $1', [tryoutId]);
  const ids = [siswaId, umumId, prospekId].filter(Boolean);
  if (ids.length) {
    await query('DELETE FROM auth_sessions WHERE participant_id = ANY($1::bigint[])', [ids]);
    await query('DELETE FROM tryout_participants WHERE id = ANY($1::bigint[])', [ids]);
  }
  await pool.end();
});

test('QP-01 kontrak ADR-009 dan endpoint attach terpasang', async () => {
  const sheets = await query(
    `SELECT sh.id, m.code AS mapel_code, j.kode AS jenjang_kode
     FROM question_sheets sh
     JOIN mapels m ON m.id = sh.mapel_id
     JOIN jenjang j ON j.id = sh.jenjang_id
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
  sheetJenjang = sheets.rows[0].jenjang_kode;

  const openapi = readFileSync(OPENAPI, 'utf8');
  for (const marker of ['/api/v1/tryouts/{id}/participants:', 'participant_ids', 'added_ids']) {
    assert.ok(openapi.includes(marker), `OpenAPI belum punya ${marker}`);
  }
  assert.ok(readFileSync(BACKEND_DOC, 'utf8').includes('Fase 6q (ADR-009)'));
  assert.ok(readFileSync(ADR, 'utf8').includes('ADR-009'));
});

test('QP-02 helper text hilang dan Kelola Peserta membuka halaman per tryout', () => {
  const source = readFileSync(TRYOUT_PAGE, 'utf8');
  const participantsPage = readFileSync(PARTICIPANTS_PAGE, 'utf8');
  const app = readFileSync(APP_FILE, 'utf8');
  const apiSource = readFileSync(API_FILE, 'utf8');
  assert.ok(!source.includes(HELPER_TEXT), 'Helper text larangan masih ada di TryoutManagement');
  for (const marker of [
    'Kelola Peserta',
    'window.location.hash = `#/tryouts/${tryout.id}/peserta`'
  ]) {
    assert.ok(source.includes(marker), `Marker ${marker} tidak ditemukan di TryoutManagement`);
  }
  for (const marker of [
    'participantsMatch',
    'TryoutParticipantsPage',
    'tryoutId={participantsMatch[1]}'
  ]) {
    assert.ok(app.includes(marker), `Marker ${marker} tidak ditemukan di App.jsx`);
  }
  for (const marker of [
    'A. Peserta Didik',
    'B. Peserta Umum',
    'getTryoutParticipants(tryoutId)',
    'isAlreadySelected',
    'addTryoutParticipants(tryoutId, [row.id])',
    'removeTryoutParticipant(tryoutId, row.id)',
    'Hapus ${row.nama} dari tryout'
  ]) {
    assert.ok(participantsPage.includes(marker), `Marker ${marker} tidak ditemukan di TryoutParticipantsPage`);
  }
  assert.ok(!source.includes('participantTarget'), 'Alur popup manage masih ada di TryoutManagement');
  assert.ok(apiSource.includes('export const addTryoutParticipants'));
  assert.ok(apiSource.includes('/tryouts/${tryoutId}/participants'));
});

test('QP-03 lampir siswa existing ke tryout tersimpan secara idempoten', async () => {
  siswaId = (await createParticipant({
    nama: siswaNama,
    email: siswaEmail,
    kelas: 6,
    sekolah: 'SMA QA 6Q',
    password: `Siswa${suffix}A`
  })).id;

  const created = await api('/api/v1/tryouts', {
    method: 'POST',
    body: JSON.stringify({
      name: `TO QA 6Q ${suffix}`,
      jenjang: sheetJenjang,
      starts_at: jakartaInput(),
      ends_at: jakartaInput(2),
      sessions: [{ mapel_code: mapelCode, sheet_ids: [sheetId] }],
      participant_ids: [],
      is_active: false
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  tryoutId = created.body.data.tryout.id;
  tryoutSessionId = created.body.data.tryout.sessions[0].id;

  const participantIds = [...new Set([
    ...created.body.data.tryout.participant_ids.map(String),
    String(siswaId)
  ])].sort((left, right) => Number(left) - Number(right));

  const attached = await attach([siswaId]);
  assert.equal(attached.status, 200, JSON.stringify(attached.body));
  assert.deepEqual(attached.body.data.added_ids.map(String), [String(siswaId)]);
  assert.deepEqual(attached.body.data.participant_ids.map(String), participantIds);

  const repeated = await attach([siswaId]);
  assert.equal(repeated.status, 200, JSON.stringify(repeated.body));
  assert.deepEqual(repeated.body.data.added_ids, []);
  assert.deepEqual(repeated.body.data.participant_ids.map(String), participantIds);

  const empty = await attach([]);
  assert.equal(empty.status, 200, JSON.stringify(empty.body));
  assert.deepEqual(empty.body.data.added_ids, []);
  assert.deepEqual(empty.body.data.participant_ids.map(String), participantIds);
  const missing = await attach([999999999]);
  assert.equal(missing.status, 400);
  const missingTryout = await attach([siswaId], 999999999);
  assert.equal(missingTryout.status, 404);
});

test('QP-04 peserta Umum dari popup Kelola langsung terlampir dan bisa dikeluarkan', async () => {
  umumId = (await createParticipant({
    jenis: 'umum',
    nama: umumNama,
    sekolah: 'Sekolah QA 6Q',
    pin: umumPin,
    wa_orang_tua: '081234567891'
  })).id;

  const attached = await attach([umumId]);
  assert.equal(attached.status, 200, JSON.stringify(attached.body));
  assert.deepEqual(attached.body.data.added_ids.map(String), [String(umumId)]);

  const detail = await api(`/api/v1/tryouts/${tryoutId}`);
  assert.equal(detail.status, 200);
  const ids = detail.body.data.tryout.participant_ids.map(String);
  assert.ok(ids.includes(String(siswaId)));
  assert.ok(ids.includes(String(umumId)));

  const active = await loadParticipant(umumId);
  assert.equal(active.is_active, true);
  assert.equal(active.prospek, false);

  const removed = await api(`/api/v1/tryouts/${tryoutId}/participants/${umumId}`, { method: 'DELETE' });
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  const after = await loadParticipant(umumId);
  assert.equal(after.is_active, false);
  assert.equal(after.prospek, true);
});

test('QP-05 peserta prospek ditolak dan bundle produksi bersih', async () => {
  prospekId = (await createParticipant({
    jenis: 'umum',
    nama: prospekNama,
    sekolah: 'Sekolah Prospek QA 6Q',
    pin: prospekPin,
    wa_orang_tua: '081234567892'
  })).id;
  const marked = await api(`/api/v1/participants/${prospekId}/prospek`, { method: 'POST' });
  assert.equal(marked.status, 200, JSON.stringify(marked.body));
  const rejected = await attach([prospekId]);
  assert.equal(rejected.status, 400);

  for (const base of [API_BASE, PRESENTATION_BASE]) {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
  }

  const files = readdirSync(DIST);
  const js = readFileSync(`${DIST}/${files.find((file) => file.endsWith('.js'))}`, 'utf8');
  for (const marker of ['Kelola Peserta', 'Tambah Peserta ke Tryout Ini', 'A. Peserta Didik', 'B. Peserta Umum', 'Pilih siswa dari data Kelola Siswa']) {
    assert.ok(js.includes(marker), `Marker bundle ${marker} tidak ditemukan`);
  }
  assert.ok(!js.includes(HELPER_TEXT), 'Helper text lama masih ada di bundle produksi');
});
