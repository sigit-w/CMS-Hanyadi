import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from '../../backend-agent/node_modules/exceljs/excel.js';

const ROOT = '/opt/virtual-office-bank-soal';

function read(relativePath) {
  return readFileSync(`${ROOT}/${relativePath}`, 'utf8');
}

function hasAll(source, markers, label) {
  for (const marker of markers) {
    assert.ok(source.includes(marker), `${label}: marker "${marker}" tidak ditemukan`);
  }
}

function headerTexts(source) {
  return [...source.matchAll(/<TableHead>(.*?)<\/TableHead>/g)].map((match) => match[1]);
}

test('Q6AA-01 form soal dan filter daftar soal memakai jenjang', () => {
  const form = read('frontend-agent/src/pages/QuestionInput.jsx');
  const dashboard = read('frontend-agent/src/pages/Dashboard.jsx');
  const api = read('frontend-agent/src/api.js');
  const routes = read('backend-agent/src/routes.js');
  const jenjangLabel = form.indexOf('<Label>Jenjang</Label>');
  const mapelLabel = form.indexOf('<Label>Mapel</Label>');

  assert.ok(jenjangLabel > -1, 'Label Jenjang form soal tidak ditemukan');
  assert.ok(mapelLabel > jenjangLabel, 'Jenjang harus mendahului Mapel pada form soal');
  hasAll(form, [
    "jenjang: '', mapel: ''",
    'Pilih jenjang terlebih dahulu',
    'jenjang: form.jenjang',
    'Daftar soal dengan filter jenjang',
    'kolom jenjang setelah mapel'
  ], 'form soal');
  hasAll(dashboard, [
    "const INITIAL_FILTERS = { jenjang: '', mapel: ''",
    'applyFilter({ jenjang: e.target.value })',
    'getQuestions({ ...nextFilters',
    'jenjangLabel(question)'
  ], 'daftar soal');
  hasAll(api, ['export const getJenjangs', 'export const getQuestions'], 'api frontend');
  hasAll(routes, [
    'const jenjang = req.query.jenjang ? requireJenjangCode(req.query.jenjang) : null;',
    'AND ($5::text IS NULL OR j.kode = $5)',
    'JOIN jenjang j ON j.id = q.jenjang_id'
  ], 'endpoint questions');
});

test('Q6AA-02 template CSV/XLSX memuat 19 header dengan jenjang setelah mapel', async () => {
  const csv = read('frontend-agent/public/templates/template-soal.csv');
  const lines = csv.trim().split(/\r?\n/);
  const headers = lines[0].replace(/^\uFEFF/, '').split(',');
  assert.equal(headers.length, 19);
  assert.equal(headers[0], 'stem');
  assert.equal(headers[1], 'mapel');
  assert.equal(headers[2], 'jenjang');
  assert.deepEqual(lines.slice(1, 5).map((line) => line.split(',')[2]), ['SD', 'SMP', 'SMA', 'SD']);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(`${ROOT}/frontend-agent/public/templates/template-soal.xlsx`);
  const sheet = workbook.worksheets[0];
  const excelHeaders = Array.from({ length: 19 }, (_, index) => sheet.getRow(1).getCell(index + 1).value);
  assert.deepEqual(excelHeaders, headers);
  assert.deepEqual([2, 3, 4, 5].map((row) => sheet.getRow(row).getCell(3).value), ['SD', 'SMP', 'SMA', 'SD']);

  const importer = read('backend-agent/src/importer.js');
  hasAll(importer, [
    "'stem', 'mapel', 'jenjang', 'type'",
    'jenjang harus tepat setelah mapel',
    'const missing = REQUIRED_HEADERS.filter((name) => !header.includes(name));'
  ], 'importer');
});

test('Q6AA-03 generator dan picker lembar soal memakai jenjang', () => {
  const frontend = read('frontend-agent/src/pages/QuestionSheets.jsx');
  const api = read('frontend-agent/src/api.js');
  const routes = read('backend-agent/src/questionSheetRoutes.js');
  const pattern = /^LS-[A-Z0-9]{4}-(SD|SMP|SMA)-[0-9]{4}$/;

  assert.match('LS-MTKA-SD-1126', pattern);
  assert.match('LS-IPAS-SMA-1126', pattern);
  assert.doesNotMatch('LS-MTKA-1126', pattern);
  hasAll(frontend, [
    'id="sheet-jenjang"',
    'id="sheet-mapel"',
    'getQuestionSheetCode(mapelCode, jenjang)',
    'disabled={!form.jenjang || !form.mapel_code}',
    'jenjang: form.jenjang',
    'Soal yang dipilih harus berjenjang sama dengan lembar soal.',
    'LS-MTKA-SD-1126'
  ], 'form lembar soal');
  hasAll(api, ['export const getQuestionSheetCode = (mapel, jenjang)'], 'api frontend');
  hasAll(routes, [
    'const CODE_PATTERN = /^LS-([A-Z0-9]{4})-(SD|SMP|SMA)-([0-9]{4})$/;',
    'function generateCode(mapelCode, jenjangCode)',
    'now.getUTCMonth()',
    'now.getUTCFullYear()',
    'AND j.kode = $1',
    'Soal yang dipilih harus berjenjang sama dengan lembar soal'
  ], 'endpoint lembar soal');
});

test('Q6AA-04 urutan form Lembar Soal dan kolom Jenjang pada daftar', () => {
  const source = read('frontend-agent/src/pages/QuestionSheets.jsx');
  const markers = [
    'id="sheet-name"',
    'id="sheet-jenjang"',
    'id="sheet-mapel"',
    'id="sheet-code"',
    'id="sheet-duration"',
    'id="sheet-description"'
  ];
  const positions = markers.map((marker) => {
    const position = source.indexOf(marker);
    assert.ok(position > -1, `Marker form "${marker}" tidak ditemukan`);
    return position;
  });
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));

  const list = source.slice(source.indexOf('Daftar Lembar Soal'));
  assert.deepEqual(headerTexts(list), ['Nama', 'Jenjang', 'Kode', 'Mapel', 'Waktu', 'Soal', 'Status', 'Aksi']);
  assert.ok(list.includes('{jenjangLabel(sheet)}'), 'Baris daftar lembar tidak menampilkan jenjang');
  hasAll(read('backend-agent/src/questionSheetRoutes.js'), [
    'j.kode AS jenjang_kode, j.nama AS jenjang_nama',
    'const jenjang = req.query.jenjang ? requireJenjangCode(req.query.jenjang) : null;',
    'AND ($3::text IS NULL OR j.kode = $3)'
  ], 'filter daftar lembar');
});

test('Q6AA-05 alur Buat Tryout memakai jenjang dan slug otomatis', () => {
  const source = read('frontend-agent/src/pages/TryoutManagement.jsx');
  const form = source.slice(source.indexOf('Buat Tryout Baru'));
  const order = [
    'Nama Tryout',
    '<Label>Jenjang</Label>',
    'Slug Grup Tryout (otomatis, bukan URL peserta)',
    'Tanggal &amp; Jam Mulai'
  ].map((marker) => {
    const position = form.indexOf(marker);
    assert.ok(position > -1, `Marker form "${marker}" tidak ditemukan`);
    return position;
  });
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  hasAll(form, [
    'readOnly value={slugPreview(form.name)}',
    'Slug dibuat otomatis setelah nama diisi',
    'Slug dihasilkan backend saat tryout disimpan dan tidak dikirim manual.'
  ], 'form tryout');
  hasAll(source, ['jenjang: form.jenjang'], 'payload createTryout');
  assert.ok(!source.includes('slug: form.slug'), 'Slug tryout masih dikirim manual');

  const routes = read('backend-agent/src/tryoutRoutes.js');
  hasAll(routes, [
    'const jenjangCode = requireJenjangCode(body.jenjang ?? body.jenjang_kode);',
    'generateTryoutSlug(name, eventId)',
    'INSERT INTO tryout_events (name, slug, jenjang_id, starts_at, ends_at)',
    'j.kode AS jenjang_kode, j.nama AS jenjang_nama',
    'bukan jenjang terpilih'
  ], 'endpoint tryout');
  assert.ok(!routes.includes('normalizeTryoutSlug('), 'Slug induk masih dinormalisasi dari payload');
});

test('Q6AA-06 daftar tryout menampilkan Jenjang dan tanpa Atur CBT', () => {
  const source = read('frontend-agent/src/pages/TryoutManagement.jsx');
  const list = source.slice(source.indexOf('Daftar Tryout'));
  assert.deepEqual(headerTexts(list), [
    'Nama', 'URL Peserta per Sesi', 'Mulai', 'Selesai', 'Mapel', 'Jenjang', 'Peserta', 'Mode', 'Status', 'Aksi'
  ]);
  assert.ok(list.includes('{jenjangLabel(tryout)}'), 'Baris daftar tryout tidak menampilkan jenjang');
  assert.ok(list.includes('aria-label="Salin semua URL sesi"'), 'Tombol salin URL sesi tidak ditemukan');
  assert.ok(!source.includes('Atur CBT'), 'Tombol Atur CBT masih ada di manajemen tryout');
  hasAll(source, [
    'aria-label="Filter jenjang tryout"',
    'Semua jenjang',
    'tryout.jenjang_kode === jenjangFilter'
  ], 'filter jenjang daftar tryout');
  hasAll(read('frontend-agent/src/pages/TryoutParticipantsPage.jsx'), [
    'aria-label="Filter jenjang peserta"',
    'className="w-full sm:w-36"',
    'sm:ml-auto'
  ], 'filter jenjang daftar peserta');
  hasAll(read('frontend-agent/src/pages/ProspektusManagement.jsx'), [
    'aria-label="Filter jenjang peserta umum"',
    'className="w-full sm:w-36"',
    'sm:ml-auto'
  ], 'filter jenjang peserta umum');
});

test('Q6AA-07 program belajar memakai jenjang pada form, tabel, dan API', () => {
  const source = read('frontend-agent/src/pages/ProgramBelajarManagement.jsx');
  hasAll(source, [
    'id="program-jenjang"',
    'Pilih jenjang terlebih dahulu',
    'jenjang: form.jenjang',
    '<TableHead>Jenjang</TableHead>',
    'program.jenjang_kode'
  ], 'program belajar');
  hasAll(read('backend-agent/src/programBelajarRoutes.js'), [
    'requireJenjangCode',
    'j.kode AS jenjang_kode',
    'JOIN jenjang j ON j.id = p.jenjang_id',
    'jenjang_id'
  ], 'endpoint program belajar');
  hasAll(read('frontend-agent/src/api.js'), [
    'export const getProgramsBelajar',
    'export const createProgramBelajar'
  ], 'api program belajar');
});

test('Q6AA-08 marker regresi peserta TRY-23 tetap utuh', () => {
  const loginHtml = read('tryout-agent/index.html');
  const tryoutApp = read('tryout-agent/app.js');
  const presentation = read('presentation-service/src/routes.js');
  const packageJson = JSON.parse(read('backend-agent/package.json'));
  const testScript = packageJson.scripts.test;

  hasAll(loginHtml, ['Username peserta', 'Password atau PIN'], 'login peserta');
  hasAll(tryoutApp, [
    'username: elements.loginUsername.value',
    'tryout_slug: TRYOUT_SLUG',
    '/presentation/attempts/submit-all'
  ], 'tryout-agent');
  hasAll(presentation, [
    "router.get('/api/v1/presentation/questions'",
    'statements: publicStatements(question)',
    "router.post('/api/v1/presentation/attempts/submit-all'"
  ], 'presentation-service');

  assert.ok(testScript.includes('../qa-agent/tests/phase6aa.mjs'), 'phase6aa belum terdaftar di script test');
  assert.ok(testScript.includes('../qa-agent/tests/mvp-smoke.mjs'), 'baseline regression hilang');
  const testFiles = testScript.match(/\.\.\/qa-agent\/tests\/[a-z0-9-]+\.mjs/g) ?? [];
  assert.ok(testFiles.length >= 27, `Jumlah test regression hanya ${testFiles.length}`);
});
