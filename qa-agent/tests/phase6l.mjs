import { adminHeaders, API_BASE } from './auth-helper.mjs';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { query, pool } from '../../backend-agent/src/db.js';

const BASE = API_BASE;
const suffix = crypto.randomBytes(4).toString('hex');
const prefix = suffix.slice(0, 6).toUpperCase();
const mapelCode = `QA${suffix.slice(0, 2).toUpperCase()}`;
const otherMapelCode = `QB${suffix.slice(2, 4).toUpperCase()}`;
const inggrisMapelCode = `QC${suffix.slice(4, 6).toUpperCase()}`;
const roleCode = `qa6lrole_${suffix}`;
const username = `qa6l_${suffix}`;
const otherUsername = `qa6lx_${suffix}`;
const password = crypto.randomBytes(18).toString('base64url');
const codes = [`QA${prefix}A001`, `QA${prefix}B001`, `QA${prefix}C150`];

let mapelId;
let otherMapelId;
let inggrisMapelId;
let questionIds = [];
let roleId;
let limitedHeaders;
let sheetId;
let generatedSheetCode;

async function api(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function authorHeaders(user, pass) {
  const response = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass })
  });
  assert.equal(response.status, 200, JSON.stringify(await response.text()));
  const cookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')];
  return { Cookie: cookies.filter(Boolean).map((item) => item.split(';')[0]).join('; ') };
}

async function createQuestion(stem, mapel) {
  const response = await api('/api/v1/questions', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({ stem, mapel, question_type: 'essay', answer_text: 'Jawaban uji QA' })
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body.data.question.id;
}

async function createMapel(code, name) {
  const response = await api('/api/v1/mapels', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({ code, name })
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body.data.mapel.id;
}

before(async () => {
  const health = await fetch(`${BASE}/health`);
  assert.equal(health.status, 200);
  mapelId = await createMapel(mapelCode, `QA 6l ${suffix}`);
  otherMapelId = await createMapel(otherMapelCode, `QA 6l lain ${suffix}`);
  inggrisMapelId = await createMapel(inggrisMapelCode, `Bahasa Inggris QA ${suffix}`);
  questionIds = [
    await createQuestion(`QA6L soal satu ${suffix}`, mapelCode),
    await createQuestion(`QA6L soal dua ${suffix}`, mapelCode),
    await createQuestion(`QA6L soal mapel lain ${suffix}`, otherMapelCode)
  ];

  const role = await api('/api/v1/roles', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({ code: roleCode, name: `QA Lembar ${suffix}` })
  });
  assert.equal(role.status, 201, JSON.stringify(role.body));
  roleId = role.body.data.role.id;

  const permissions = await api(`/api/v1/roles/${roleId}/permissions`, {
    method: 'PUT',
    headers: await adminHeaders(),
    body: JSON.stringify({ permissions: ['question_sheets.manage'] })
  });
  assert.equal(permissions.status, 200, JSON.stringify(permissions.body));

  for (const user of [username, otherUsername]) {
    const created = await api('/api/v1/users', {
      method: 'POST',
      headers: await adminHeaders(),
      body: JSON.stringify({
        username: user,
        display_name: `QA Lembar ${suffix}`,
        password,
        roles: [roleCode]
      })
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
  }
  limitedHeaders = await authorHeaders(username, password);
});

after(async () => {
  const cleanupCodes = [...codes, generatedSheetCode].filter(Boolean);
  await query('DELETE FROM question_sheets WHERE code = ANY($1::text[])', [cleanupCodes]);
  if (questionIds.length) {
    await query('DELETE FROM questions WHERE id = ANY($1::bigint[])', [questionIds]);
  }
  if (mapelId) await query('DELETE FROM mapels WHERE id = $1', [mapelId]);
  if (otherMapelId) await query('DELETE FROM mapels WHERE id = $1', [otherMapelId]);
  if (inggrisMapelId) await query('DELETE FROM mapels WHERE id = $1', [inggrisMapelId]);
  await query('DELETE FROM contributors WHERE username IN ($1, $2)', [username, otherUsername]);
  if (roleId) await query('DELETE FROM roles WHERE id = $1', [roleId]);
  await pool.end();
});

test('L-01 permission dan generator kode per mapel tersedia', async () => {
  const permissions = await api('/api/v1/permissions', { headers: await adminHeaders() });
  assert.equal(permissions.status, 200);
  assert.ok(permissions.body.data.permissions.some((item) => item.code === 'question_sheets.manage'));

  const cases = [
    ['MTKA', 'MTKA'],
    ['IPAS', 'IPAS'],
    ['BIND', 'BIND'],
    [inggrisMapelCode, inggrisMapelCode],
    [mapelCode, mapelCode]
  ];
  for (const [mapel, prefix] of cases) {
    const generated = await api(`/api/v1/question-sheets/generate-code?mapel=${encodeURIComponent(mapel)}`, {
      headers: await adminHeaders()
    });
    assert.equal(generated.status, 200, JSON.stringify(generated.body));
    assert.match(generated.body.data.code, new RegExp(`^LS-${prefix}-\\d{4}$`));
    assert.equal(generated.body.data.code.length, 12);
  }

  const missing = await api('/api/v1/question-sheets/generate-code', { headers: await adminHeaders() });
  assert.equal(missing.status, 400, JSON.stringify(missing.body));
});

test('L-02 create lembar soal dengan waktu angka bebas', async () => {
  const response = await api('/api/v1/question-sheets', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      name: `QA Lembar ${suffix}`,
      mapel_code: mapelCode,
      code: codes[0],
      description: 'Lembar uji QA',
      duration_minutes: 45,
      question_ids: questionIds.slice(0, 2)
    })
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  sheetId = response.body.data.sheet.id;
  assert.equal(response.body.data.sheet.code, codes[0]);
  assert.equal(response.body.data.sheet.duration_minutes, 45);
  assert.equal(response.body.data.sheet.mapel_code, mapelCode);
  assert.equal(response.body.data.sheet.question_count, 2);

  const generated = await api('/api/v1/question-sheets', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      name: `QA Lembar generated ${suffix}`,
      mapel_code: mapelCode,
      duration_minutes: 20,
      question_ids: [questionIds[0]]
    })
  });
  assert.equal(generated.status, 201, JSON.stringify(generated.body));
  generatedSheetCode = generated.body.data.sheet.code;
  assert.match(generatedSheetCode, new RegExp(`^LS-${mapelCode}-\\d{4}$`));
  assert.equal(generatedSheetCode.length, 12);
});

test('L-03 validasi kode, waktu, dan mapel ditolak', async () => {
  const base = { name: 'QA Invalid', mapel_code: mapelCode, duration_minutes: 30, question_ids: [questionIds[0]] };
  const shortCode = await api('/api/v1/question-sheets', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({ ...base, code: 'SHORT-CODE' })
  });
  assert.equal(shortCode.status, 400, JSON.stringify(shortCode.body));

  const zeroDuration = await api('/api/v1/question-sheets', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({ ...base, code: codes[1], duration_minutes: 0 })
  });
  assert.equal(zeroDuration.status, 400, JSON.stringify(zeroDuration.body));

  const mixedMapel = await api('/api/v1/question-sheets', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({ ...base, code: codes[1], question_ids: [questionIds[0], questionIds[2]] })
  });
  assert.equal(mixedMapel.status, 400, JSON.stringify(mixedMapel.body));

  const empty = await api('/api/v1/question-sheets', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({ ...base, code: codes[1], question_ids: [] })
  });
  assert.equal(empty.status, 400, JSON.stringify(empty.body));

  const duplicate = await api('/api/v1/question-sheets', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({ ...base, code: codes[0] })
  });
  assert.equal(duplicate.status, 409, JSON.stringify(duplicate.body));
});

test('L-04 flag kode tampil di daftar dan detail soal', async () => {
  const list = await api('/api/v1/questions?limit=10&search=' + encodeURIComponent(suffix), {
    headers: await adminHeaders()
  });
  assert.equal(list.status, 200, JSON.stringify(list.body));
  const first = list.body.data.questions.find((item) => item.id === questionIds[0]);
  const other = list.body.data.questions.find((item) => item.id === questionIds[2]);
  assert.ok(first.sheets.some((sheet) => sheet.code === codes[0]));
  assert.ok(!other.sheets.some((sheet) => sheet.code === codes[0]));

  const detail = await api(`/api/v1/questions/${questionIds[0]}`, { headers: await adminHeaders() });
  assert.equal(detail.status, 200);
  assert.ok(detail.body.data.sheets.some((sheet) => sheet.code === codes[0]));
});

test('L-05 ubah kode menyebabkan flag soal ikut berubah', async () => {
  const response = await api(`/api/v1/question-sheets/${sheetId}`, {
    method: 'PUT',
    headers: await adminHeaders(),
    body: JSON.stringify({
      code: codes[1],
      name: `QA Lembar ubah ${suffix}`,
      mapel_code: mapelCode,
      description: null,
      duration_minutes: 150,
      question_ids: questionIds.slice(0, 2)
    })
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.data.sheet.code, codes[1]);
  assert.equal(response.body.data.sheet.duration_minutes, 150);

  const detail = await api(`/api/v1/questions/${questionIds[0]}`, { headers: await adminHeaders() });
  assert.ok(detail.body.data.sheets.some((sheet) => sheet.code === codes[1]));
  assert.ok(!detail.body.data.sheets.some((sheet) => sheet.code === codes[0]));
});

test('L-06 role dengan permission lembar soal bisa picker tanpa questions.read', async () => {
  const picker = await api(`/api/v1/question-sheets/question-picker?mapel=${mapelCode}&limit=5`, { headers: limitedHeaders });
  assert.equal(picker.status, 200, JSON.stringify(picker.body));
  assert.ok(picker.body.data.questions.length > 0);
  assert.ok(picker.body.data.questions.every((item) => item.mapel_code === mapelCode));

  const sheets = await api('/api/v1/question-sheets', { headers: limitedHeaders });
  assert.equal(sheets.status, 200, JSON.stringify(sheets.body));

  const questions = await api('/api/v1/questions?limit=5', { headers: limitedHeaders });
  assert.equal(questions.status, 403, JSON.stringify(questions.body));
});

test('L-06a picker lembar soal mendukung filter tipe soal', async () => {
  const matching = await api(`/api/v1/question-sheets/question-picker?mapel=${mapelCode}&question_type=essay&limit=50`, {
    headers: await adminHeaders()
  });
  assert.equal(matching.status, 200, JSON.stringify(matching.body));
  assert.ok(matching.body.data.questions.some((item) => item.id === questionIds[0]));
  assert.ok(matching.body.data.questions.every((item) => item.question_type === 'essay'));

  const mismatched = await api(`/api/v1/question-sheets/question-picker?mapel=${mapelCode}&question_type=multiple_choice&limit=50`, {
    headers: await adminHeaders()
  });
  assert.equal(mismatched.status, 200, JSON.stringify(mismatched.body));
  assert.ok(!mismatched.body.data.questions.some((item) => item.id === questionIds[0]));

  const invalid = await api(`/api/v1/question-sheets/question-picker?mapel=${mapelCode}&question_type=invalid_type`, {
    headers: await adminHeaders()
  });
  assert.equal(invalid.status, 400, JSON.stringify(invalid.body));
  assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');
});

test('L-07 hapus lembar melakukan soft delete dan relasi tetap ada', async () => {
  const deleted = await api(`/api/v1/question-sheets/${sheetId}`, {
    method: 'DELETE',
    headers: await adminHeaders()
  });
  assert.equal(deleted.status, 200, JSON.stringify(deleted.body));
  assert.equal(deleted.body.data.sheet.archived, true);
  assert.ok(deleted.body.data.sheet.archived_at);

  const active = await api('/api/v1/question-sheets', { headers: await adminHeaders() });
  assert.ok(!active.body.data.sheets.some((sheet) => sheet.id === sheetId));

  const archived = await api('/api/v1/question-sheets?status=archived', { headers: await adminHeaders() });
  assert.ok(archived.body.data.sheets.some((sheet) => sheet.id === sheetId));

  const persisted = await query('SELECT count(*)::int AS total FROM question_sheet_questions WHERE sheet_id = $1', [sheetId]);
  assert.ok(persisted.rows[0].total > 0);

  const detail = await api(`/api/v1/questions/${questionIds[0]}`, { headers: await adminHeaders() });
  assert.ok(!detail.body.data.sheets.some((sheet) => sheet.code === codes[1]));
});

test('L-08 daftar soal tidak menampilkan error pada pagination besar', async () => {
  const response = await api('/api/v1/questions?page=1&limit=100', { headers: await adminHeaders() });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.ok(Array.isArray(response.body.data.questions));
  for (const item of response.body.data.questions) {
    assert.ok(Array.isArray(item.sheets));
  }
});
