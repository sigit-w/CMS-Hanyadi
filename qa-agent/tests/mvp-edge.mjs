import { adminHeaders, API_BASE } from './auth-helper.mjs';
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = API_BASE;

async function api(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: await adminHeaders({ 'Content-Type': 'application/json', ...(options.headers ?? {}) })
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function importFile(filename, content, mimeType, fields = {}) {
  const form = new FormData();
  form.append('file', new Blob([content], { type: mimeType }), filename);
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  const response = await fetch(`${BASE}/api/v1/import`, {
    method: 'POST',
    headers: await adminHeaders(),
    body: form
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

function essay(mapel, stem) {
  return { stem, jenjang: 'SD', mapel, question_type: 'essay', answer_text: 'Jawaban uji QA' };
}

before(async () => {
  const response = await fetch(`${BASE}/health`);
  assert.equal(response.status, 200, 'API harus aktif sebelum pengujian edge');
});

test('S-20 body create kosong ditolak 400', async () => {
  const { status, body } = await api('/api/v1/questions', { method: 'POST', body: '{}' });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('S-21 stem whitespace ditolak 400', async () => {
  const { status, body } = await api('/api/v1/questions', {
    method: 'POST', body: JSON.stringify(essay('MTKA', '   '))
  });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('S-22 import konten kosong ditolak 400', async () => {
  const { status, body } = await api('/api/v1/import', {
    method: 'POST', body: JSON.stringify({ content: '' })
  });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('S-23 format upload tidak didukung ditolak 400', async () => {
  const { status, body } = await api('/api/v1/import', {
    method: 'POST', body: JSON.stringify({ format: 'xml', content: '<soal/>' })
  });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('S-24 payload JSON pada import ditolak 400', async () => {
  const { status, body } = await api('/api/v1/import', {
    method: 'POST', body: JSON.stringify({ format: 'json', content: '{rusak' })
  });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('S-25 CSV hanya header ditolak 400', async () => {
  const { status, body } = await importFile('header-saja.csv', 'stem,mapel\n', 'text/csv');
  assert.equal(status, 400, JSON.stringify(body));
  assert.equal(body.error.code, 'INVALID_IMPORT');
});

test('S-26 file biner acak tidak menyebabkan 500', async () => {
  const { status, body } = await importFile('data.bin', '\u0000\u0001bukan soal', 'application/octet-stream');
  assert.equal(status, 400);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('S-27 body JSON malformed ditolak 400 INVALID_JSON', async () => {
  const response = await fetch(`${BASE}/api/v1/questions`, {
    method: 'POST',
    headers: await adminHeaders({ 'Content-Type': 'application/json' }),
    body: '{"stem":'
  });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'INVALID_JSON');
  assert.equal(body.ok, false);
});

test('S-28 GET id soal bukan angka ditolak 400', async () => {
  const { status, body } = await api('/api/v1/questions/abc');
  assert.equal(status, 400);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('S-29 PUT answer-key id bukan angka ditolak 400', async () => {
  const { status, body } = await api('/api/v1/questions/abc/answer-key', {
    method: 'PUT', body: JSON.stringify({ answer_text: 'x' })
  });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('S-30 endpoint readiness lama tidak tersedia', async () => {
  const { status, body } = await api('/api/v1/questions/abc/readiness', {
    method: 'PATCH', body: JSON.stringify({ version: 'v1', is_ready: true })
  });
  assert.equal(status, 404);
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('S-31 filter tiga mapel wajib konsisten', async () => {
  for (const mapel of ['MTKA', 'BIND', 'IPAS']) {
    const created = await api('/api/v1/questions', {
      method: 'POST', body: JSON.stringify(essay(mapel, `QA mapel ${mapel}`))
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const { body } = await api(`/api/v1/questions?mapel=${mapel}&limit=100`);
    assert.ok(body.data.questions.length > 0);
    assert.ok(body.data.questions.every((item) => item.mapel_code === mapel));
  }
});

test('S-32 sumber impor CSV tercatat di PostgreSQL', async () => {
  const label = `QA-EDGE-${Date.now()}`;
  const csv = [
    'stem,mapel,jenjang,type,difficulty,option_a,option_b,option_c,option_d,correct_key,correct_keys,answer_text,explanation,statement_1,statement_1_correct,statement_1_explanation,statement_2,statement_2_correct,statement_2_explanation',
    `"Soal sumber edge QA",IPAS,SD,essay,,,,,,,,Jawaban uji QA,,,,,,,`
  ].join('\n');
  const imported = await importFile('sumber-edge.csv', csv, 'text/csv', {
    label,
    external_ref: 'EDGE-01'
  });
  assert.equal(imported.status, 201, JSON.stringify(imported.body));
  assert.equal(imported.body.data.created, 1);
  const { body } = await api('/api/v1/sources');
  const source = body.data.sources.find((item) => item.label === label);
  assert.ok(source, 'sumber harus tercatat');
  assert.equal(source.type, 'file_upload');
  assert.equal(source.original_filename, 'sumber-edge.csv');
  assert.equal(Number(source.question_count), 1);
});

test('S-33 update status dan arsip soal', async () => {
  const created = await api('/api/v1/questions', {
    method: 'POST', body: JSON.stringify(essay('MTKA', 'QA update dan arsip'))
  });
  assert.equal(created.status, 201);
  const id = created.body.data.question.id;
  const updated = await api(`/api/v1/questions/${id}`, {
    method: 'PUT', body: JSON.stringify({ jenjang: 'SD', status: 'approved' })
  });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  const archived = await api(`/api/v1/questions/${id}`, { method: 'DELETE' });
  assert.equal(archived.status, 200);
  assert.equal(archived.body.data.question.status, 'archived');
  const detail = await api(`/api/v1/questions/${id}`);
  assert.equal(detail.body.data.status, 'archived');
});

test('S-34 correct_key tidak ada di opsi ditolak 400', async () => {
  const created = await api('/api/v1/questions', {
    method: 'POST',
    body: JSON.stringify({
      stem: 'QA kunci di luar opsi',
      jenjang: 'SD',
      mapel: 'MTKA',
      question_type: 'multiple_choice',
      options: [
        { key: 'A', content: 'Satu', is_correct: true },
        { key: 'B', content: 'Dua', is_correct: false }
      ]
    })
  });
  assert.equal(created.status, 201);
  const id = created.body.data.question.id;
  const { status, body } = await api(`/api/v1/questions/${id}/answer-key`, {
    method: 'PUT', body: JSON.stringify({ correct_key: 'Z' })
  });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});
