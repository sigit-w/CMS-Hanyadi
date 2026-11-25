import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const SOURCE = '/opt/virtual-office-bank-soal/frontend-agent/src/App.jsx';
const app = readFileSync(SOURCE, 'utf8');
const groupsSource = app.slice(app.indexOf('const NAV_GROUPS'), app.indexOf('const NAV_STANDALONE'));

function blockFor(key) {
  const start = groupsSource.indexOf(`key: '${key}'`);
  assert.notEqual(start, -1, `Grup ${key} tidak ditemukan`);
  const next = groupsSource.indexOf("key: '", start + 1);
  return next === -1 ? groupsSource.slice(start) : groupsSource.slice(start, next);
}

test('N-01 grup Manajemen Bimbel berisi Kelola Siswa lalu Kelola Program Belajar', () => {
  const block = blockFor('manajemen-bimbel');
  assert.ok(block.includes("label: 'Manajemen Bimbel'"));
  const siswa = block.indexOf("label: 'Kelola Siswa'");
  const program = block.indexOf("label: 'Kelola Program Belajar'");
  assert.notEqual(siswa, -1);
  assert.notEqual(program, -1);
  assert.ok(siswa < program, 'Urutan menu harus Kelola Siswa lalu Kelola Program Belajar');
  assert.ok(block.includes("hash: '#/bimbel/siswa'"));
  assert.ok(block.includes("hash: '#/bimbel/program-belajar'"));
});

test('N-02 rute lama tetap menjadi alias, bukan menu utama', () => {
  assert.ok(app.includes("'/tryouts/peserta': '/bimbel/siswa'"));
  assert.ok(app.includes("'/program-belajar': '/bimbel/program-belajar'"));
  assert.ok(app.includes("activePath === '/bimbel/siswa'"));
  assert.ok(app.includes("activePath === '/bimbel/program-belajar'"));
  assert.ok(!app.includes("activePath === '/tryouts/peserta'"));
  assert.ok(!app.includes("activePath === '/program-belajar'"));
});

test('N-03 item dipindah dari grup lama', () => {
  const tryout = blockFor('manajemen-tryout');
  assert.ok(tryout.includes("label: 'Manajemen Tryout'"));
  assert.ok(!tryout.includes('Kelola Siswa'));
  assert.ok(!tryout.includes("'/tryouts/peserta'"));

  const setting = blockFor('setting');
  assert.ok(setting.includes("label: 'Setting'"));
  assert.ok(!setting.includes('Kelola Program Belajar'));
  assert.ok(!setting.includes("hash: '#/program-belajar'"));
});

test('N-04 marker jenjang hadir pada form soal, lembar, tryout, dan program belajar', () => {
  const sources = [
    ['soal', '../../frontend-agent/src/pages/QuestionInput.jsx', 'Daftar soal dengan filter jenjang'],
    ['lembar soal', '../../frontend-agent/src/pages/QuestionSheets.jsx', 'id="sheet-jenjang"'],
    ['tryout', '../../frontend-agent/src/pages/TryoutManagement.jsx', 'Slug Grup Tryout (otomatis, bukan URL peserta)'],
    ['program belajar', '../../frontend-agent/src/pages/ProgramBelajarManagement.jsx', 'id="program-jenjang"']
  ];
  for (const [label, path, marker] of sources) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.ok(source.includes(marker), `Marker jenjang form ${label} tidak ditemukan`);
  }
});
