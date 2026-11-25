import { adminHeaders, API_BASE } from './auth-helper.mjs';
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = API_BASE;
const UI_BASE = process.env.QA_UI_BASE || 'https://cms.hanyadi.web.id';

async function api(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: await adminHeaders({ 'Content-Type': 'application/json', ...(options.headers ?? {}) })
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

function mcPayload(stem = 'Soal uji otomatis 2 + 2 = ?') {
  return {
    stem,
    jenjang: 'SD',
    mapel: 'MTKA',
    question_type: 'multiple_choice',
    difficulty: 'easy',
    options: [
      { key: 'A', content: '3', is_correct: false },
      { key: 'B', content: '4', is_correct: true },
      { key: 'C', content: '5', is_correct: false }
    ],
    correct_key: 'B',
    explanation: 'Dua ditambah dua sama dengan empat'
  };
}

let createdId;
let essayId;

before(async () => {
  const response = await fetch(`${BASE}/health`);
  assert.equal(response.status, 200, 'API harus aktif sebelum pengujian');
});

test('S-01 health mengembalikan status database up', async () => {
  const { status, body } = await api('/health');
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.services[0].state, 'up');
});

test('S-02 mapel wajib lengkap', async () => {
  const { status, body } = await api('/api/v1/mapels');
  assert.equal(status, 200);
  assert.deepEqual(body.data.mapels.map((item) => item.code).sort(),
    ['BIND', 'IPAS', 'MTKA']);
});

test('S-03 endpoint versi lama tidak tersedia', async () => {
  const { status, body } = await api('/api/v1/presentation-versions');
  assert.equal(status, 404);
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('S-04 buat soal pilihan ganda', async () => {
  const { status, body } = await api('/api/v1/questions', {
    method: 'POST',
    body: JSON.stringify(mcPayload())
  });
  assert.equal(status, 201, JSON.stringify(body));
  assert.ok(body.data.question.id);
  assert.equal(body.data.question.status, 'approved');
  assert.equal(body.data.question.version, undefined);
  assert.equal(body.data.question.readiness, undefined);
  createdId = body.data.question.id;
});

test('S-05 detail soal memuat opsi dan kunci', async () => {
  const { status, body } = await api(`/api/v1/questions/${createdId}`);
  assert.equal(status, 200);
  assert.equal(body.data.options.length, 3);
  assert.equal(body.data.answer_key.correct_option_id, body.data.options[1].id);
});

test('S-06 upsert kunci sinkron dengan opsi benar', async () => {
  const { status, body } = await api(`/api/v1/questions/${createdId}/answer-key`, {
    method: 'PUT',
    body: JSON.stringify({ correct_key: 'C', explanation: 'Kunci diubah ke C' })
  });
  assert.equal(status, 200, JSON.stringify(body));
  const detail = await api(`/api/v1/questions/${createdId}`);
  const correct = detail.body.data.options.filter((option) => option.is_correct);
  assert.equal(correct.length, 1);
  assert.equal(correct[0].option_key, 'C');
});

test('S-07 upsert kunci esai tanpa opsi', async () => {
  const created = await api('/api/v1/questions', {
    method: 'POST',
    body: JSON.stringify({
      stem: 'Jelaskan fotosintesis',
      jenjang: 'SD',
      mapel: 'IPAS',
      question_type: 'essay',
      answer_text: 'Proses pembuatan makanan oleh tumbuhan'
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.data.question.id;
  essayId = id;
  const { status, body } = await api(`/api/v1/questions/${id}/answer-key`, {
    method: 'PUT',
    body: JSON.stringify({ answer_text: 'Menghasilkan glukosa dan oksigen', explanation: 'Dengan cahaya' })
  });
  assert.equal(status, 200, JSON.stringify(body));
});

test('S-08 detail soal tidak mengandung field versi/readiness', async () => {
  const { status, body } = await api(`/api/v1/questions/${createdId}`);
  assert.equal(status, 200);
  assert.equal(body.data.status, 'approved');
  for (const field of ['version', 'ready_version', 'readiness', 'ready_version_count', 'is_multi_version_ready', 'variants']) {
    assert.equal(field in body.data, false, `field ${field} tidak boleh tampil`);
  }
});

test('S-09 filter mapel berfungsi', async () => {
  const { body } = await api('/api/v1/questions?mapel=IPAS&limit=100');
  assert.ok(body.data.questions.length > 0);
  assert.ok(body.data.questions.every((item) => item.mapel_code === 'IPAS'));
});

test('S-09a filter tipe soal berfungsi dan bisa digabung dengan mapel', async () => {
  const all = await api('/api/v1/questions?question_type=essay&limit=100');
  assert.equal(all.status, 200, JSON.stringify(all.body));
  assert.ok(all.body.data.questions.length > 0);
  assert.ok(all.body.data.questions.every((item) => item.question_type === 'essay'));

  const combined = await api('/api/v1/questions?mapel=IPAS&question_type=essay&limit=100');
  assert.equal(combined.status, 200, JSON.stringify(combined.body));
  assert.ok(combined.body.data.questions.some((item) => item.id === essayId));
  assert.ok(combined.body.data.questions.every((item) => item.mapel_code === 'IPAS' && item.question_type === 'essay'));
});

test('S-09b tipe soal filter tidak valid ditolak', async () => {
  const { status, body } = await api('/api/v1/questions?question_type=invalid_type');
  assert.equal(status, 400);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('S-10 impor payload JSON ditolak 400 VALIDATION_ERROR', async () => {
  const { status, body } = await api('/api/v1/import', {
    method: 'POST',
    body: JSON.stringify({
      source: { type: 'external_collection', label: 'Bank Soal Eksternal', external_ref: 'REF-JSON-01' },
      questions: [
        mcPayload('Soal impor JSON nomor 1'),
        mcPayload('Soal impor JSON nomor 2')
      ]
    })
  });
  assert.equal(status, 400, JSON.stringify(body));
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('S-11 impor CSV dari file', async () => {
  const csv = [
    'stem,mapel,jenjang,type,difficulty,option_a,option_b,option_c,option_d,correct_key,correct_keys,answer_text,explanation,statement_1,statement_1_correct,statement_1_explanation,statement_2,statement_2_correct,statement_2_explanation',
    'Soal impor CSV,MTKA,SD,multiple_choice,easy,1,2,3,4,B,,,Benar 2,,,,,,',
    'Soal IPAS CSV,IPAS,SD,multiple_choice,medium,Air,Api,Tanah,Angin,A,,,Penguji,,,,,,'
  ].join('\n');
  const form = new FormData();
  form.append('file', new Blob([csv], { type: 'text/csv' }), 'soal.csv');
  form.append('type', 'file_upload');
  const response = await fetch(`${BASE}/api/v1/import`, { method: 'POST', headers: await adminHeaders(), body: form });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.status, 201, JSON.stringify(body));
  assert.equal(body.data.created, 2);
  for (const id of body.data.question_ids) {
    const detail = await api(`/api/v1/questions/${id}`);
    assert.equal(detail.body.data.status, 'approved');
  }
});

test('S-12 impor TXT ditolak 400 VALIDATION_ERROR', async () => {
  const txt = [
    'Mapel: BIND',
    'Soal: Sinonim kata "cepat" adalah?',
    'A. Lambat',
    'B. Tergesa',
    'C. Tenang',
    'Jawaban: B',
    '',
    'Mapel: IPAS',
    'Soal: Planet terbesar di tata surya?',
    'A. Bumi',
    'B. Jupiter',
    'Jawaban_penjelasan: Jupiter',
    'Jawaban: B'
  ].join('\n');
  const form = new FormData();
  form.append('file', new Blob([txt], { type: 'text/plain' }), 'soal.txt');
  const response = await fetch(`${BASE}/api/v1/import`, { method: 'POST', headers: await adminHeaders(), body: form });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.status, 400, JSON.stringify(body));
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('S-13 mapel invalid ditolak', async () => {
  const payload = mcPayload();
  payload.mapel = 'sejarah';
  const { status, body } = await api('/api/v1/questions', {
    method: 'POST', body: JSON.stringify(payload)
  });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('S-14 pilihan ganda tanpa opsi benar ditolak', async () => {
  const payload = mcPayload();
  payload.options = payload.options.map((option) => ({ ...option, is_correct: false }));
  delete payload.correct_key;
  const { status, body } = await api('/api/v1/questions', {
    method: 'POST', body: JSON.stringify(payload)
  });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('S-15 file lebih dari 5MB ditolak', async () => {
  const form = new FormData();
  form.append('file', new Blob(['x'.repeat(6 * 1024 * 1024)], { type: 'text/csv' }), 'besar.csv');
  const response = await fetch(`${BASE}/api/v1/import`, { method: 'POST', headers: await adminHeaders(), body: form });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.status, 413, JSON.stringify(body));
  assert.equal(body.error.code, 'FILE_TOO_LARGE');
});

test('S-16 endpoint tidak ada mengembalikan 404', async () => {
  const { status, body } = await api('/api/v1/tidak-ada');
  assert.equal(status, 404);
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('S-17 static UI tersaji', async () => {
  const response = await fetch(`${UI_BASE}/`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /id="root"/);
  assert.match(html, /assets\/index-.*\.js/);
});

test('S-18 data benar-benar tersimpan di PostgreSQL', async () => {
  const { body } = await api('/api/v1/questions?mapel=MTKA&limit=100');
  assert.ok(body.data.pagination.total >= 4);
});

test('S-19 kunci jawaban teks pada soal pilihan', async () => {
  const created = await api('/api/v1/questions', {
    method: 'POST',
    body: JSON.stringify(mcPayload('Soal uji kunci teks tanpa correct_key'))
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.data.question.id;
  const { status, body } = await api(`/api/v1/questions/${id}/answer-key`, {
    method: 'PUT',
    body: JSON.stringify({ answer_text: 'Jawaban berupa teks', explanation: 'Tanpa opsi benar' })
  });
  assert.equal(status, 200, JSON.stringify(body));
});
