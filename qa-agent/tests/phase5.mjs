import { adminHeaders, API_BASE, PRESENTATION_BASE } from './auth-helper.mjs';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { query, pool } from '../../backend-agent/src/db.js';

const MAIN = API_BASE;
const PRESENTATION = PRESENTATION_BASE;
const DIST = '/opt/virtual-office-bank-soal/frontend-agent/dist/assets';

async function call(base, path, options = {}) {
  const headers = await adminHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

let questionId;
let archivedId;
let activeSessionIds = [];

before(async () => {
  for (const base of [MAIN, PRESENTATION]) {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200, `${base} harus aktif`);
  }
  const active = await query('SELECT id FROM tryout_sessions WHERE is_active');
  activeSessionIds = active.rows.map((row) => row.id);
  if (activeSessionIds.length) {
    await query('UPDATE tryout_sessions SET is_active = false WHERE is_active');
  }
});

after(async () => {
  if (activeSessionIds.length) {
    await query('UPDATE tryout_sessions SET is_active = true WHERE id = ANY($1::bigint[])', [activeSessionIds]);
  }
  await pool.end();
});

test('P5-01 health presentation-service aktif', async () => {
  const { status, body } = await call(PRESENTATION, '/health');
  assert.equal(status, 200);
  assert.equal(body.service, 'presentation');
  assert.equal(body.database, 'up');
});

test('P5-02 soal baru tersimpan sebagai approved', async () => {
  const { status, body } = await call(MAIN, '/api/v1/questions', {
    method: 'POST',
    body: JSON.stringify({
      stem: 'Soal inti Fase 6j',
      mapel: 'IPAS',
      question_type: 'essay',
      answer_text: 'Jawaban inti'
    })
  });
  assert.equal(status, 201, JSON.stringify(body));
  assert.equal(body.data.question.status, 'approved');
  questionId = body.data.question.id;
});

test('P5-03 detail soal tidak mengirim field versi/readiness', async () => {
  const { status, body } = await call(MAIN, `/api/v1/questions/${questionId}`);
  assert.equal(status, 200);
  assert.equal(body.data.stem, 'Soal inti Fase 6j');
  for (const field of ['version', 'ready_version', 'readiness', 'ready_version_count', 'is_multi_version_ready', 'variants']) {
    assert.equal(field in body.data, false, `field ${field} tidak boleh tampil`);
  }
});

test('P5-04 presentation service membaca stem dari tabel inti', async () => {
  const { status, body } = await call(PRESENTATION, `/api/v1/presentation/questions/${questionId}`);
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.data.stem, 'Soal inti Fase 6j');
  assert.equal(body.data.version, undefined);
  assert.ok(body.data.rendered_at);
  const raw = JSON.stringify(body);
  assert.ok(!raw.includes('Jawaban inti'));
  assert.ok(!raw.includes('correct_key'));
});

test('P5-05 soal archived ditolak presentation service', async () => {
  const created = await call(MAIN, '/api/v1/questions', {
    method: 'POST',
    body: JSON.stringify({
      stem: 'Soal arsip Fase 6j',
      mapel: 'IPAS',
      question_type: 'essay',
      answer_text: 'Jawaban arsip'
    })
  });
  assert.equal(created.status, 201);
  archivedId = created.body.data.question.id;
  const archived = await call(MAIN, `/api/v1/questions/${archivedId}`, { method: 'DELETE' });
  assert.equal(archived.status, 200);
  const response = await call(PRESENTATION, `/api/v1/presentation/questions/${archivedId}`);
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('P5-06 perubahan stem di tabel inti langsung tampil di presentation', async () => {
  const updated = await call(MAIN, `/api/v1/questions/${questionId}`, {
    method: 'PUT',
    body: JSON.stringify({ stem: 'Soal inti Fase 6j (edit)' })
  });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  const presentation = await call(PRESENTATION, `/api/v1/presentation/questions/${questionId}`);
  assert.equal(presentation.status, 200);
  assert.equal(presentation.body.data.stem, 'Soal inti Fase 6j (edit)');
});

test('P5-07 endpoint varian lama tidak tersedia', async () => {
  const response = await call(PRESENTATION, `/api/v1/presentation/questions/${questionId}/variants`);
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('P5-08 parameter versi/ready_version diabaikan dan tidak diekspos', async () => {
  const list = await call(MAIN, '/api/v1/questions?ready_version=v9&version=v2&limit=5');
  assert.equal(list.status, 200, JSON.stringify(list.body));
  assert.equal(list.body.data.version, undefined);
  assert.equal(list.body.data.ready_version, undefined);
  assert.ok(list.body.data.questions.every((item) => item.version === undefined));
  const presentation = await call(PRESENTATION, `/api/v1/presentation/questions/${questionId}?version=v9`);
  assert.equal(presentation.status, 200);
  assert.equal(presentation.body.data.version, undefined);
});

test('P5-09 filter status draft/review ditolak 400', async () => {
  for (const status of ['draft', 'review']) {
    const response = await call(MAIN, `/api/v1/questions?status=${status}`);
    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  }
});

test('P5-10 id soal presentation bukan angka ditolak 400', async () => {
  const response = await call(PRESENTATION, '/api/v1/presentation/questions/abc');
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('P5-11 aset CMS memakai pagination, bukan virtual scroll/versi', () => {
  const js = readdirSync(DIST).find((file) => file.endsWith('.js'));
  const bundle = readFileSync(`${DIST}/${js}`, 'utf8');
  assert.match(bundle, /Halaman /);
  assert.match(bundle, /Prev/);
  assert.match(bundle, /Next/);
  assert.doesNotMatch(bundle, /Siap versi/);
  assert.doesNotMatch(bundle, /max-h-\[520px\]/);
});

test('P5-12 penulisan varian lama tidak tersedia', async () => {
  const response = await fetch(
    `${PRESENTATION}/api/v1/presentation/questions/${questionId}/v1`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stem: 'Tidak berhak' })
    }
  );
  const body = await response.json().catch(() => ({}));
  assert.equal(response.status, 404);
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('P5-14 halaman/menu CMS tetap terpisah', () => {
  const js = readdirSync(DIST).find((file) => file.endsWith('.js'));
  const bundle = readFileSync(`${DIST}/${js}`, 'utf8');
  for (const marker of [
    'Buat Soal',
    'Buat User',
    'Kelola Siswa',
    'Manajemen Soal',
    'Daftar Soal',
    'Setting',
    'Kelola Role',
    'Laporan Sistem',
    'Manajemen Tryout',
    'Manajemen Bimbel',
    'Buat/Daftar Tryout',
    'Prospektus',
    'Laporan Tryout',
    '#/questions',
    '#/users/new',
    '#/roles',
    '#/reports/system',
    '#/tryouts',
    '#/tryouts/prospektus',
    '#/bimbel/siswa',
    '#/bimbel/program-belajar',
    '#/reports/tryout',
    'Simpan Hak Akses',
    'Simpan Tryout',
    'Nama Tryout',
    'Tanggal & Jam Mulai',
    'Lembar Soal (',
    'Tambah Peserta Tryout',
    'A. Peserta Didik',
    'Kelola Peserta',
    'Detail Peserta Tryout',
    'Peserta Umum',
    'Nomor WA Orang Tua',
    'Unduh Soal + Kunci',
    'Ubah Tryout',
    'Pilih semua',
    'Ubah Password'
  ]) {
    assert.ok(bundle.includes(marker), `Marker "${marker}" tidak ditemukan di bundle CMS`);
  }
  assert.ok(!bundle.includes('Perbandingan Jawaban'),
    'Section perbandingan jawaban tidak boleh tampil di laporan tryout');
  assert.ok(!bundle.includes('Kelola Siswa Tryout'),
    'Label lama Kelola Siswa Tryout tidak boleh tampil lagi');

  const apiSource = readFileSync('/opt/virtual-office-bank-soal/frontend-agent/src/api.js', 'utf8');
  for (const helper of [
    "export const getSiswa = (params) => request(withQuery('/siswa', params));",
    "export const getParticipants = (params) => request(withQuery('/participants', params));",
    "export const getProspektus = (params) => request(withQuery('/prospektus', params));"
  ]) {
    assert.ok(apiSource.includes(helper), `Helper API tidak memakai withQuery: ${helper}`);
  }
  assert.ok(apiSource.includes('Object.entries(params ?? {})'),
    'withQuery harus aman saat dipanggil tanpa parameter');

  const comboboxSource = readFileSync('/opt/virtual-office-bank-soal/frontend-agent/src/components/ui/combobox.jsx', 'utf8');
  assert.ok(comboboxSource.includes('setOpen(false)'), 'Combobox harus menutup opsi setelah dipilih');
  assert.ok(comboboxSource.includes('onClick={() => setOpen(true)}'), 'Combobox harus bisa dibuka ulang setelah dipilih');
  assert.ok(comboboxSource.includes('activeQuery'), 'Combobox harus menampilkan semua opsi saat dibuka ulang');
  assert.ok(comboboxSource.includes('onChange(event.target.value)'), 'Combobox harus meneruskan teks yang diketik');
});

test('P5-13 soal baru langsung tampil tanpa pengaktifan readiness', async () => {
  const created = await call(MAIN, '/api/v1/questions', {
    method: 'POST',
    body: JSON.stringify({
      stem: 'Soal auto publish Fase 6j',
      mapel: 'MTKA',
      question_type: 'essay',
      answer_text: 'Jawaban uji'
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const presentation = await call(PRESENTATION, `/api/v1/presentation/questions/${created.body.data.question.id}`);
  assert.equal(presentation.status, 200, JSON.stringify(presentation.body));
  assert.equal(presentation.body.data.stem, 'Soal auto publish Fase 6j');
});
