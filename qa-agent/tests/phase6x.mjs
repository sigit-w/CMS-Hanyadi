import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { adminHeaders, API_BASE, participantLogin, cookieHeader } from './auth-helper.mjs';
import { query, pool } from '../../backend-agent/src/db.js';

const KEY_PERMISSION = 'tryout_questions.key_export';
const suffix = crypto.randomBytes(6).toString('hex');
const roleCode = `qa6xrole_${suffix}`;
const exportUsername = `qa6x_${suffix}`;
const exportPassword = crypto.randomBytes(18).toString('base64url');
const bindQuestionStem = `QA6X soal BIND ${suffix}`;
const bindSheetCode = `QA${suffix.slice(0, 10).toUpperCase()}`;
const bindSheetName = `QA6X Lembar BIND ${suffix}`;
const participantWa = `0814${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
const participantUsernameSeed = suffix.slice(0, 8).toUpperCase();
const participantName = `QA6X Peserta ${suffix}`;
const participantPassword = crypto.randomBytes(18).toString('base64url');

let smaJenjangId;
let roleId;
let exportCookie;
let questionId;
let sheetId;
let participantId;
let participantUsername;
let tryoutId;
let originalSlug;
let sessionIds = [];
let originalName;

async function api(pathname, options = {}, headers = null, raw = false) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(headers ?? (await adminHeaders())),
      ...(options.headers ?? {})
    }
  });
  if (raw) return { status: response.status, body: null, response };
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body, response };
}

async function login(username, password) {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  assert.equal(response.status, 200, await response.text());
  return cookieHeader(response);
}

async function createQuestion() {
  const created = await api('/api/v1/questions', {
    method: 'POST',
    body: JSON.stringify({
      stem: bindQuestionStem,
      mapel: 'BIND',
      question_type: 'multiple_choice',
      options: [
        { key: 'A', content: 'Jawaban salah', is_correct: false },
        { key: 'B', content: 'Jawaban benar', is_correct: true }
      ],
      correct_key: 'B'
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  return Number(created.body.data.question.id);
}

async function createSheet(question) {
  const created = await api('/api/v1/question-sheets', {
    method: 'POST',
    body: JSON.stringify({
      name: bindSheetName,
      code: bindSheetCode,
      mapel_code: 'BIND',
      description: `Lembar uji ${participantUsernameSeed}`,
      duration_minutes: 30,
      question_ids: [question]
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  return Number(created.body.data.sheet.id);
}

function parseZip(buffer) {
  const entries = [];
  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    const size = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString('latin1');
    const dataStart = offset + 30 + nameLength + extraLength;
    assert.equal(method, 0, `metode kompresi ${name} bukan stored`);
    entries.push({ name, data: buffer.subarray(dataStart, dataStart + size) });
    offset = dataStart + size;
  }
  return entries;
}

function pdfText(data) {
  assert.equal(data.subarray(0, 8).toString('latin1'), '%PDF-1.4');
  return data.toString('latin1');
}

before(async () => {
  const health = await fetch(`${API_BASE}/health`);
  assert.equal(health.status, 200);

  const jenjang = await query("SELECT id FROM jenjang WHERE kode = 'SMA'");
  smaJenjangId = Number(jenjang.rows[0].id);
  assert.ok(smaJenjangId);

  questionId = await createQuestion();
  sheetId = await createSheet(questionId);

  const createdParticipant = await api('/api/v1/participants', {
    method: 'POST',
    body: JSON.stringify({
      jenis: 'siswa',
      nama: participantName,
      email: `qa6x-${suffix}@example.test`,
      kelas: 9,
      sekolah: 'SMA QA 6X',
      wa_orang_tua: participantWa,
      jenjang_id: smaJenjangId,
      password: participantPassword
    })
  });
  assert.equal(createdParticipant.status, 201, JSON.stringify(createdParticipant.body));
  participantId = Number(createdParticipant.body.data.participant.id);
  participantUsername = createdParticipant.body.data.participant.username;

  const createdRole = await api('/api/v1/roles', {
    method: 'POST',
    body: JSON.stringify({ code: roleCode, name: `QA 6X ${suffix}` })
  });
  assert.equal(createdRole.status, 201, JSON.stringify(createdRole.body));
  roleId = Number(createdRole.body.data.role.id);

  const permissions = await api(`/api/v1/roles/${roleId}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permissions: [KEY_PERMISSION] })
  });
  assert.equal(permissions.status, 200, JSON.stringify(permissions.body));
  assert.deepEqual(permissions.body.data.permissions, [KEY_PERMISSION]);

  const createdUser = await api('/api/v1/users', {
    method: 'POST',
    body: JSON.stringify({
      username: exportUsername,
      display_name: `QA Export ${suffix}`,
      password: exportPassword,
      roles: [roleCode]
    })
  });
  assert.equal(createdUser.status, 201, JSON.stringify(createdUser.body));
  exportCookie = await login(exportUsername, exportPassword);

  const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const endsAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
  originalName = `QA6X Tryout ${suffix}`;
  const created = await api('/api/v1/tryouts', {
    method: 'POST',
    body: JSON.stringify({
      name: originalName,
      starts_at: startsAt,
      ends_at: endsAt,
      participant_ids: [participantId],
      sessions: [
        { name: `QA6X MTKA ${suffix}`, mapel_code: 'MTKA', sheet_ids: [66] },
        { name: `QA6X IPAS ${suffix}`, mapel_code: 'IPAS', sheet_ids: [67] },
        { name: `QA6X BIND ${suffix}`, mapel_code: 'BIND', sheet_ids: [sheetId] }
      ]
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  tryoutId = Number(created.body.data.tryout.id);
  originalSlug = created.body.data.tryout.slug;
  sessionIds = created.body.data.tryout.sessions.map((session) => Number(session.id));
  assert.equal(sessionIds.length, 3);
});

after(async () => {
  if (tryoutId) await query('DELETE FROM tryout_events WHERE id = $1', [tryoutId]);
  if (participantId) {
    await query('DELETE FROM auth_sessions WHERE participant_id = $1', [participantId]);
    await query('DELETE FROM siswa WHERE id = $1', [participantId]);
  }
  if (sheetId) await query('DELETE FROM question_sheets WHERE id = $1', [sheetId]);
  if (questionId) await query('DELETE FROM questions WHERE id = $1', [questionId]);
  await query('DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM contributors WHERE username = $1)', [exportUsername]);
  await query('DELETE FROM contributors WHERE username = $1', [exportUsername]);
  if (roleId) await query('DELETE FROM roles WHERE id = $1', [roleId]);
  await pool.end();
});

test('Q6X-01 marker edit dan ekspor tersedia tanpa dependency PDF baru', () => {
  const page = readFileSync(new URL('../../frontend-agent/src/pages/TryoutManagement.jsx', import.meta.url), 'utf8');
  const apiSource = readFileSync(new URL('../../frontend-agent/src/api.js', import.meta.url), 'utf8');
  const routes = readFileSync(new URL('../../backend-agent/src/tryoutRoutes.js', import.meta.url), 'utf8');
  const exporter = readFileSync(new URL('../../backend-agent/src/tryoutExport.js', import.meta.url), 'utf8');
  const frontendPackage = JSON.parse(readFileSync(new URL('../../frontend-agent/package.json', import.meta.url), 'utf8'));
  const backendPackage = JSON.parse(readFileSync(new URL('../../backend-agent/package.json', import.meta.url), 'utf8'));

  for (const marker of ['Ubah Tryout', 'Unduh Soal', 'Unduh Soal + Kunci', 'updateTryout', 'downloadTryoutQuestions', 'downloadTryoutQuestionsWithKeys']) {
    assert.ok(page.includes(marker), `marker frontend tidak ada: ${marker}`);
  }
  assert.match(apiSource, /export const updateTryout/);
  assert.match(apiSource, /export const downloadTryoutQuestionsWithKeys/);
  assert.match(routes, /tryoutRouter\.patch\('\/tryouts\/:id'/);
  assert.match(routes, /tryoutRouter\.get\('\/tryouts\/:id\/questions\.zip'/);
  assert.match(routes, /tryoutRouter\.get\('\/tryouts\/:id\/questions-with-keys\.zip'/);
  assert.match(exporter, /Nama lembar soal:/);
  assert.match(exporter, /Kode lembar soal:/);
  assert.match(exporter, /Keterangan:/);
  assert.match(exporter, /Kunci jawaban:/);

  for (const dependency of ['pdf-lib', 'jspdf', 'pdfkit', 'adm-zip', 'jszip']) {
    assert.ok(!frontendPackage.dependencies?.[dependency]);
    assert.ok(!frontendPackage.devDependencies?.[dependency]);
    assert.ok(!backendPackage.dependencies?.[dependency]);
    assert.ok(!backendPackage.devDependencies?.[dependency]);
  }
});

test('Q6X-02 permission baru tidak otomatis diberikan', async () => {
  const permissions = await api('/api/v1/permissions');
  assert.equal(permissions.status, 200);
  assert.ok(permissions.body.data.permissions.some((item) => item.code === KEY_PERMISSION));

  const roles = await api('/api/v1/roles');
  assert.equal(roles.status, 200);
  for (const role of roles.body.data.roles.filter((item) => ['admin', 'editor', 'validator', 'viewer'].includes(item.code))) {
    assert.ok(!(role.permissions ?? []).includes(KEY_PERMISSION), `role ${role.code} tidak boleh memiliki ${KEY_PERMISSION}`);
  }

  const admin = await api('/api/v1/auth/me');
  assert.equal(admin.status, 200);
  assert.ok(!admin.body.data.permissions.includes(KEY_PERMISSION));

  const granted = await api('/api/v1/auth/me', {}, { Cookie: exportCookie });
  assert.equal(granted.status, 200);
  assert.ok(granted.body.data.permissions.includes(KEY_PERMISSION));
  assert.ok(!granted.body.data.permissions.includes('tryouts.manage'));
});

test('Q6X-03 PATCH tryout: autorisasi, validasi, dan JWT lama tetap valid', async () => {
  const login = await participantLogin(participantUsername, participantPassword, originalSlug);
  assert.equal(login.status, 200, await login.text());
  const participantCookie = cookieHeader(login);

  const unauthenticated = await api(`/api/v1/tryouts/${tryoutId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: 'Tanpa cookie', starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 3600000).toISOString() })
  }, {}, true);
  assert.equal(unauthenticated.status, 401);

  const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const endsAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
  const forbidden = await api(`/api/v1/tryouts/${tryoutId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: 'Ditolak', starts_at: startsAt, ends_at: endsAt })
  }, { Cookie: exportCookie });
  assert.equal(forbidden.status, 403);

  const invalidField = await api(`/api/v1/tryouts/${tryoutId}`, {
    method: 'PATCH',
    body: JSON.stringify({ slug: 'ubah-slug', name: 'Ditolak', starts_at: startsAt, ends_at: endsAt })
  });
  assert.equal(invalidField.status, 400);
  assert.equal(invalidField.body.error.code, 'VALIDATION_ERROR');

  const invalidSchedule = await api(`/api/v1/tryouts/${tryoutId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: 'Ditolak', starts_at: endsAt, ends_at: startsAt })
  });
  assert.equal(invalidSchedule.status, 400);
  assert.match(invalidSchedule.body.error.message, /ends_at/);

  const updatedName = `QA6X Diubah ${suffix}`;
  const updated = await api(`/api/v1/tryouts/${tryoutId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: updatedName, starts_at: startsAt, ends_at: endsAt })
  });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  const tryout = updated.body.data.tryout;
  assert.equal(tryout.name, updatedName);
  assert.equal(tryout.slug, originalSlug);
  assert.equal(tryout.ends_at, endsAt);
  assert.deepEqual(tryout.sessions.map((session) => Number(session.id)), sessionIds);
  assert.deepEqual(tryout.participant_ids, [participantId]);

  const detail = await api(`/api/v1/tryouts/${tryoutId}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.tryout.slug, originalSlug);
  assert.equal(detail.body.data.tryout.name, updatedName);

  const oldJwt = await api('/api/v1/auth/me', {}, { Cookie: participantCookie });
  assert.equal(oldJwt.status, 200, JSON.stringify(oldJwt.body));
  assert.equal(oldJwt.body.data.user.username, participantUsername);
  assert.equal(oldJwt.body.data.user.tryout_event_id, tryoutId);
});

test('Q6X-04 ekspor tiga sesi: soal tanpa kunci dan soal dengan kunci', async () => {
  const noCookie = await api(`/api/v1/tryouts/${tryoutId}/questions.zip`, {}, {}, true);
  assert.equal(noCookie.status, 401);

  const invalidId = await api('/api/v1/tryouts/tidak-angka/questions.zip');
  assert.equal(invalidId.status, 400);
  const missing = await api('/api/v1/tryouts/999999999/questions.zip');
  assert.equal(missing.status, 404);

  const adminPlain = await api(`/api/v1/tryouts/${tryoutId}/questions.zip`, {}, null, true);
  assert.equal(adminPlain.status, 200);
  assert.match(adminPlain.response.headers.get('content-type') ?? '', /application\/zip/);
  assert.match(adminPlain.response.headers.get('content-disposition') ?? '', new RegExp(`${originalSlug}-soal\\.zip`));

  const plainBuffer = Buffer.from(await adminPlain.response.arrayBuffer());
  const plainEntries = parseZip(plainBuffer);
  assert.equal(plainEntries.length, 3);
  assert.ok(plainEntries.every((entry) => entry.name.endsWith('-soal.pdf')));
  const plainTexts = plainEntries.map((entry) => pdfText(entry.data));
  for (const [index, text] of plainTexts.entries()) {
    for (const marker of ['Nama lembar soal:', 'Kode lembar soal:', 'Mapel:', 'Keterangan:']) {
      assert.ok(text.includes(marker), `PDF ${index + 1} tidak memuat ${marker}`);
    }
    assert.ok(!text.includes('Kunci jawaban:'), `PDF ${index + 1} membocorkan kunci`);
  }
  assert.ok(plainTexts.some((text) => text.includes('LS-MTKA-1126')));
  assert.ok(plainTexts.some((text) => text.includes('LS-IPAS-1126')));
  assert.ok(plainTexts.some((text) => text.includes(bindSheetCode)));
  assert.ok(plainTexts.some((text) => text.includes(bindSheetName)));

  const adminKeys = await api(`/api/v1/tryouts/${tryoutId}/questions-with-keys.zip`, {}, null, true);
  assert.equal(adminKeys.status, 403);

  const limitedPlain = await api(`/api/v1/tryouts/${tryoutId}/questions.zip`, {}, { Cookie: exportCookie }, true);
  assert.equal(limitedPlain.status, 403);

  const limitedKeys = await api(`/api/v1/tryouts/${tryoutId}/questions-with-keys.zip`, {}, { Cookie: exportCookie }, true);
  assert.equal(limitedKeys.status, 200);
  assert.match(limitedKeys.response.headers.get('content-disposition') ?? '', new RegExp(`${originalSlug}-soal-dan-kunci\\.zip`));

  const keyBuffer = Buffer.from(await limitedKeys.response.arrayBuffer());
  const keyEntries = parseZip(keyBuffer);
  assert.equal(keyEntries.length, 3);
  assert.ok(keyEntries.every((entry) => entry.name.endsWith('-soal-dan-kunci.pdf')));
  const keyTexts = keyEntries.map((entry) => pdfText(entry.data));
  for (const [index, text] of keyTexts.entries()) {
    assert.ok(text.includes('Kunci jawaban:'), `PDF kunci ${index + 1} tidak memuat kunci`);
    assert.ok(text.includes('Varian: Soal dan Kunci Jawaban'));
  }
  assert.ok(keyTexts.some((text) => text.includes(bindQuestionStem)));
});
