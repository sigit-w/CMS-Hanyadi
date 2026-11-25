import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import {
  activeTryoutContext,
  adminHeaders,
  API_BASE,
  attachQaParticipants,
  cookieHeader
} from './auth-helper.mjs';
import { query, pool } from '../../backend-agent/src/db.js';

const ROOT = '/opt/virtual-office-bank-soal';
const DIST = `${ROOT}/frontend-agent/dist/assets`;
const TEMPLATE_CSV = `${ROOT}/frontend-agent/public/templates/template-soal.csv`;
const TEMPLATE_XLSX = `${ROOT}/frontend-agent/public/templates/template-soal.xlsx`;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const suffix = crypto.randomBytes(6).toString('hex');
const activeSheetSuffix = String(crypto.randomInt(0, 10000)).padStart(4, '0');
const archivedSheetSuffix = String((Number(activeSheetSuffix) + crypto.randomInt(1, 10000)) % 10000).padStart(4, '0');
const siswaName = `QA6Z Siswa ${suffix}`;
const siswaEmail = `qa6z.siswa.${suffix}@example.test`;
const siswaPassword = `Siswa${suffix}A`;
const umumName = `QA6Z Umum ${suffix}`;
const umumPin = String(crypto.randomInt(0, 1_000_000_000)).padStart(9, '0');
const umumWa = `0814${String(crypto.randomInt(0, 100_000_000)).padStart(8, '0')}`;
const viewerUsername = `qa6z_viewer_${suffix}`;
const viewerRoleCode = `qa6zviewer_${suffix}`;
const viewerPassword = crypto.randomBytes(18).toString('base64url');

let smaJenjangId;
let tryoutContext;
let tryoutEventId;
let siswaId;
let siswaUsername;
let umumId;
let umumUsername;
let viewerHeaders;
const questionIds = [];
const sourceIds = [];
const sheetIds = [];

async function api(pathname, options = {}, headersOverride = null) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(headersOverride ?? (await adminHeaders())),
      ...(options.headers ?? {})
    }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function importFile(filename, content, mimeType, fields = {}) {
  const form = new FormData();
  form.append('file', new Blob([content], { type: mimeType }), filename);
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  const response = await fetch(`${API_BASE}/api/v1/import`, {
    method: 'POST',
    headers: await adminHeaders(),
    body: form
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function cmsHeaders(username, password) {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  assert.equal(response.status, 200, await response.text());
  return { Cookie: cookieHeader(response) };
}

async function createQuestion(stem) {
  const created = await api('/api/v1/questions', {
    method: 'POST',
    body: JSON.stringify({
      stem,
      jenjang: 'SD',
      mapel: 'MTKA',
      question_type: 'essay',
      difficulty: 'easy',
      answer_text: 'Jawaban uji QA'
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  questionIds.push(Number(created.body.data.question.id));
  return Number(created.body.data.question.id);
}

async function createSheet(code, question) {
  const created = await api('/api/v1/question-sheets', {
    method: 'POST',
    body: JSON.stringify({
      name: `QA6Z Lembar ${code} ${suffix}`,
      code,
      jenjang: 'SD',
      mapel_code: 'MTKA',
      description: `Lembar uji Fase 6z ${code}`,
      duration_minutes: 30,
      question_ids: [question]
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = Number(created.body.data.sheet.id);
  sheetIds.push(id);
  return id;
}

before(async () => {
  const health = await fetch(`${API_BASE}/health`);
  assert.equal(health.status, 200);

  const jenjang = await query("SELECT id FROM jenjang WHERE kode = 'SMA'");
  smaJenjangId = Number(jenjang.rows[0].id);
  assert.ok(smaJenjangId);

  tryoutContext = await activeTryoutContext(query);
  const event = await query('SELECT event_id FROM tryout_sessions WHERE id = $1', [tryoutContext.id]);
  tryoutEventId = Number(event.rows[0].event_id);
  assert.ok(tryoutEventId);

  const siswa = await api('/api/v1/participants', {
    method: 'POST',
    body: JSON.stringify({
      nama: siswaName,
      email: siswaEmail,
      kelas: 9,
      sekolah: 'SMA QA 6Z',
      wa_orang_tua: '081234567890',
      jenjang_id: smaJenjangId,
      password: siswaPassword
    })
  });
  assert.equal(siswa.status, 201, JSON.stringify(siswa.body));
  siswaId = Number(siswa.body.data.participant.id);
  siswaUsername = siswa.body.data.participant.username;

  const umum = await api('/api/v1/participants', {
    method: 'POST',
    body: JSON.stringify({
      jenis: 'umum',
      nama: umumName,
      sekolah: 'Sekolah QA 6Z',
      wa_orang_tua: umumWa,
      jenjang_id: smaJenjangId,
      pin: umumPin
    })
  });
  assert.equal(umum.status, 201, JSON.stringify(umum.body));
  umumId = Number(umum.body.data.participant.id);
  umumUsername = umum.body.data.participant.username;

  await attachQaParticipants(query, tryoutContext.id, [siswaId, umumId]);

  const role = await api('/api/v1/roles', {
    method: 'POST',
    body: JSON.stringify({ code: viewerRoleCode, name: `QA 6Z Viewer ${suffix}` })
  });
  assert.equal(role.status, 201, JSON.stringify(role.body));
  const permissions = await api(`/api/v1/roles/${role.body.data.role.id}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permissions: ['cms.access'] })
  });
  assert.equal(permissions.status, 200, JSON.stringify(permissions.body));
  const user = await api('/api/v1/users', {
    method: 'POST',
    body: JSON.stringify({
      username: viewerUsername,
      display_name: `QA 6Z Viewer ${suffix}`,
      password: viewerPassword,
      roles: [viewerRoleCode]
    })
  });
  assert.equal(user.status, 201, JSON.stringify(user.body));
  viewerHeaders = await cmsHeaders(viewerUsername, viewerPassword);
});

after(async () => {
  const participantIds = [siswaId, umumId].filter(Boolean);
  if (tryoutContext && participantIds.length) {
    await query(
      'DELETE FROM tryout_session_participants WHERE session_id = $1 AND participant_id = ANY($2::bigint[])',
      [tryoutContext.id, participantIds]
    );
  }
  if (participantIds.length) {
    await query('DELETE FROM auth_sessions WHERE participant_id = ANY($1::bigint[])', [participantIds]);
    await query('DELETE FROM tryout_participants WHERE id = ANY($1::bigint[])', [participantIds]);
  }
  await query('DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM contributors WHERE username = $1)', [viewerUsername]);
  await query('DELETE FROM contributors WHERE username = $1', [viewerUsername]);
  await query('DELETE FROM roles WHERE code = $1', [viewerRoleCode]);

  for (const sheetId of sheetIds) await query('DELETE FROM question_sheets WHERE id = $1', [sheetId]);
  if (questionIds.length) {
    const linked = await query(
      'SELECT DISTINCT source_id FROM questions WHERE id = ANY($1::bigint[]) AND source_id IS NOT NULL',
      [questionIds]
    );
    await query('DELETE FROM questions WHERE id = ANY($1::bigint[])', [questionIds]);
    const staleSources = [...new Set([
      ...sourceIds,
      ...linked.rows.map((row) => Number(row.source_id))
    ])];
    if (staleSources.length) {
      await query('DELETE FROM question_sources WHERE id = ANY($1::bigint[])', [staleSources]);
    }
  }
  await pool.end();
});

test('Q6Z-01 usage_count menghitung lembar aktif dan mengecualikan lembar terarsip', async () => {
  const question = await createQuestion(`QA6Z usage ${suffix}`);
  const activeSheetCode = `LS-MTKA-SD-${activeSheetSuffix}`;
  const archivedSheetCode = `LS-MTKA-SD-${archivedSheetSuffix}`;
  const activeSheet = await createSheet(activeSheetCode, question);
  const archivedSheet = await createSheet(archivedSheetCode, question);

  const beforeArchive = await api(`/api/v1/questions/${question}`, { headers: await adminHeaders() });
  assert.equal(beforeArchive.status, 200, JSON.stringify(beforeArchive.body));
  assert.equal(typeof beforeArchive.body.data.usage_count, 'number');
  assert.equal(beforeArchive.body.data.usage_count, 2);
  assert.equal(beforeArchive.body.data.sheets.length, 2);

  const archived = await api(`/api/v1/question-sheets/${archivedSheet}`, { method: 'DELETE' });
  assert.equal(archived.status, 200, JSON.stringify(archived.body));
  assert.equal(archived.body.data.sheet.archived, true);

  const detail = await api(`/api/v1/questions/${question}`, { headers: await adminHeaders() });
  assert.equal(detail.status, 200, JSON.stringify(detail.body));
  assert.equal(typeof detail.body.data.usage_count, 'number');
  assert.equal(detail.body.data.usage_count, 1);
  assert.equal(detail.body.data.sheets.length, 1);
  assert.equal(Number(detail.body.data.sheets[0].id), activeSheet);
  assert.equal(detail.body.data.sheets[0].code, activeSheetCode);

  const list = await api(`/api/v1/questions?search=${encodeURIComponent(`QA6Z usage ${suffix}`)}&limit=100`);
  assert.equal(list.status, 200, JSON.stringify(list.body));
  const row = list.body.data.questions.find((item) => Number(item.id) === question);
  assert.ok(row, 'soal harus tampil di daftar');
  assert.equal(row.usage_count, 1);
  assert.equal(row.sheets.length, 1);

  const stored = await query(
    `SELECT count(*)::int AS total FROM question_sheet_questions qsq
     JOIN question_sheets sh ON sh.id = qsq.sheet_id
     WHERE qsq.question_id = $1`,
    [question]
  );
  assert.equal(stored.rows[0].total, 2, 'relasi lembar arsip tetap tersimpan di DB');
});

test('Q6Z-02 template CSV bawaan berhasil diimpor', async () => {
  const csv = readFileSync(TEMPLATE_CSV);
  const result = await importFile('template-soal.csv', new Uint8Array(csv), 'text/csv');
  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.data.created, 4);
  assert.ok(result.body.data.source_id);
  sourceIds.push(Number(result.body.data.source_id));
  questionIds.push(...result.body.data.question_ids.map(Number));

  const types = [];
  for (const id of result.body.data.question_ids) {
    const detail = await api(`/api/v1/questions/${id}`);
    assert.equal(detail.status, 200, JSON.stringify(detail.body));
    assert.equal(detail.body.data.status, 'approved');
    types.push(detail.body.data.question_type);
  }
  assert.deepEqual(types.sort(), ['multiple_answer', 'multiple_choice', 'short_answer', 'true_false']);
});

test('Q6Z-03 template XLSX bawaan berhasil diimpor', async () => {
  const xlsx = readFileSync(TEMPLATE_XLSX);
  const result = await importFile('template-soal.xlsx', new Uint8Array(xlsx), XLSX_MIME);
  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.data.created, 4);
  assert.ok(result.body.data.source_id);
  sourceIds.push(Number(result.body.data.source_id));
  questionIds.push(...result.body.data.question_ids.map(Number));

  const types = [];
  for (const id of result.body.data.question_ids) {
    const detail = await api(`/api/v1/questions/${id}`);
    assert.equal(detail.status, 200, JSON.stringify(detail.body));
    assert.equal(detail.body.data.status, 'approved');
    types.push(detail.body.data.question_type);
  }
  assert.deepEqual(types.sort(), ['multiple_answer', 'multiple_choice', 'short_answer', 'true_false']);
});

test('Q6Z-04 payload content dan questions[] ditolak VALIDATION_ERROR', async () => {
  const content = await api('/api/v1/import', {
    method: 'POST',
    body: JSON.stringify({ content: 'stem,mapel,jenjang\nSoal,MTKA,SD' })
  });
  assert.equal(content.status, 400, JSON.stringify(content.body));
  assert.equal(content.body.error.code, 'VALIDATION_ERROR');

  const questions = await api('/api/v1/import', {
    method: 'POST',
    body: JSON.stringify({
      source: { type: 'external_collection', label: `QA6Z payload ${suffix}`, external_ref: `6Z-${suffix}` },
      questions: [{ stem: `QA6Z payload ${suffix}`, jenjang: 'SD', mapel: 'MTKA', question_type: 'essay', answer_text: 'x' }]
    })
  });
  assert.equal(questions.status, 400, JSON.stringify(questions.body));
  assert.equal(questions.body.error.code, 'VALIDATION_ERROR');

  const metadata = await api('/api/v1/import', {
    method: 'POST',
    body: JSON.stringify({ format: 'csv', filename: 'soal.csv', mime_type: 'text/csv' })
  });
  assert.equal(metadata.status, 400, JSON.stringify(metadata.body));
  assert.equal(metadata.body.error.code, 'VALIDATION_ERROR');
});

test('Q6Z-05 ekstensi dan format selain CSV/XLSX ditolak VALIDATION_ERROR', async () => {
  const cases = [
    ['soal.json', '{"stem":"x"}', 'application/json'],
    ['soal.txt', 'stem,mapel,jenjang\nSoal,MTKA,SD', 'text/plain'],
    ['soal.bin', '\u0000\u0001data', 'application/octet-stream'],
    ['soal.xml', '<soal/>', 'application/xml']
  ];
  for (const [filename, content, mimeType] of cases) {
    const result = await importFile(filename, content, mimeType);
    assert.equal(result.status, 400, `${filename} harus ditolak: ${JSON.stringify(result.body)}`);
    assert.equal(result.body.error.code, 'VALIDATION_ERROR');
  }
});

test('Q6Z-06 daftar kredensial berpermission menyertakan username dan plaintext', async () => {
  const listCases = [
    ['/api/v1/siswa', 'siswa', siswaId, 'password_plain', siswaPassword],
    ['/api/v1/participants', 'participants', siswaId, 'password_plain', siswaPassword],
    ['/api/v1/prospektus', 'prospektus', umumId, 'pin_plain', umumPin],
    [`/api/v1/tryouts/${tryoutEventId}/participants`, 'participants', umumId, 'pin_plain', umumPin]
  ];
  for (const [path, key, id, secretField, secret] of listCases) {
    const result = await api(path);
    assert.equal(result.status, 200, `${path}: ${JSON.stringify(result.body)}`);
    const row = result.body.data[key].find((item) => Number(item.id) === id);
    assert.ok(row, `${path} harus memuat fixture QA6Z`);
    assert.ok(row.username, `${path} harus memuat username`);
    assert.equal(row[secretField], secret, `${path} harus memuat ${secretField}`);
    assert.equal(Object.hasOwn(row, 'password_hash'), false, `${path} membocorkan password_hash`);
    assert.equal(Object.hasOwn(row, 'pin_hash'), false, `${path} membocorkan pin_hash`);

    const denied = await api(path, {}, viewerHeaders);
    assert.equal(denied.status, 403, `${path} harus menolak viewer: ${JSON.stringify(denied.body)}`);
    const raw = JSON.stringify(denied.body);
    assert.ok(!raw.includes(siswaPassword), `${path} membocorkan password ke viewer`);
    assert.ok(!raw.includes(umumPin), `${path} membocorkan PIN ke viewer`);
  }
  assert.ok(siswaUsername, 'username siswa harus tersedia');
  assert.ok(umumUsername, 'username peserta umum harus tersedia');

  const siswaDetail = await api(`/api/v1/participants/${siswaId}/detail`);
  assert.equal(siswaDetail.status, 200, JSON.stringify(siswaDetail.body));
  assert.equal(siswaDetail.body.data.participant.username, siswaUsername);
  assert.equal(siswaDetail.body.data.participant.password_plain, siswaPassword);

  const umumDetail = await api(`/api/v1/prospektus/${umumId}`);
  assert.equal(umumDetail.status, 200, JSON.stringify(umumDetail.body));
  assert.equal(umumDetail.body.data.prospektus.username, umumUsername);
  assert.equal(umumDetail.body.data.prospektus.pin_plain, umumPin);

  const copySource = readFileSync(`${ROOT}/frontend-agent/src/components/CredentialCopy.jsx`, 'utf8');
  assert.ok(copySource.includes('CredentialCopy'));
  assert.ok(copySource.includes('Salin kredensial'));
  assert.ok(copySource.includes('Nama: ${name'));
  assert.ok(copySource.includes('username: ${username'));
  for (const path of [
    `${ROOT}/frontend-agent/src/pages/PesertaManagement.jsx`,
    `${ROOT}/frontend-agent/src/pages/ProspektusManagement.jsx`,
    `${ROOT}/frontend-agent/src/pages/TryoutManagement.jsx`,
    `${ROOT}/frontend-agent/src/pages/TryoutParticipantsPage.jsx`
  ]) {
    const source = readFileSync(path, 'utf8');
    assert.ok(source.includes('CredentialCopy'), `CredentialCopy tidak dipakai di ${path}`);
    assert.ok(source.includes('name={'), `Nama peserta tidak diteruskan ke CredentialCopy di ${path}`);
  }
});

test('Q6Z-07 label dan rute Peserta Umum menggantikan Peserta Tryout', () => {
  const app = readFileSync(`${ROOT}/frontend-agent/src/App.jsx`, 'utf8');
  assert.ok(app.includes("path: '/tryouts/peserta-umum'"));
  assert.ok(app.includes("hash: '#/tryouts/peserta-umum'"));
  assert.ok(app.includes("label: 'Peserta Umum'"));
  assert.ok(app.includes("'/tryouts/prospektus': '/tryouts/peserta-umum'"));
  assert.ok(app.includes('HASH_REDIRECT_ALIASES'));
  assert.ok(app.includes('participantsMatch'));
  assert.ok(app.includes('TryoutParticipantsPage'));
  assert.ok(!app.includes("label: 'Peserta Tryout'"));

  const prospektusPage = readFileSync(`${ROOT}/frontend-agent/src/pages/ProspektusManagement.jsx`, 'utf8');
  assert.ok(prospektusPage.includes('Peserta Umum'));
  const tryoutPage = readFileSync(`${ROOT}/frontend-agent/src/pages/TryoutManagement.jsx`, 'utf8');
  assert.ok(tryoutPage.includes('Peserta Umum'));
  assert.ok(tryoutPage.includes('Kelola Peserta'));
  assert.ok(!tryoutPage.includes('Detail Peserta Tryout'));
  const participantsPage = readFileSync(`${ROOT}/frontend-agent/src/pages/TryoutParticipantsPage.jsx`, 'utf8');
  assert.ok(participantsPage.includes('Kelola Peserta'));
  assert.ok(participantsPage.includes('Daftar Peserta'));
  assert.ok(participantsPage.includes('Tambah Peserta ke Tryout Ini'));
  assert.ok(participantsPage.includes('A. Peserta Didik'));
  assert.ok(participantsPage.includes('B. Peserta Umum'));

  const bundleName = readdirSync(DIST).find((file) => file.endsWith('.js'));
  assert.ok(bundleName, 'bundle frontend harus tersedia');
  const bundle = readFileSync(`${DIST}/${bundleName}`, 'utf8');
  assert.ok(bundle.includes('Peserta Umum'));
  assert.ok(bundle.includes('Tambah Peserta ke Tryout Ini'));
  assert.ok(!bundle.includes('Peserta Tryout'));

  const adr = readFileSync(
    `${ROOT}/pm-agent/decisions/ADR-022-daftar-soal-impor-csv-xlsx-dan-peserta-umum.md`, 'utf8'
  );
  assert.ok(adr.includes('Peserta Umum'));
  assert.ok(adr.includes('alias'));
  const backlog = readFileSync(`${ROOT}/pm-agent/tasks/phase6z-backlog.md`, 'utf8');
  assert.ok(backlog.includes('Peserta Umum'));
  const architecture = readFileSync(`${ROOT}/docs/architecture.md`, 'utf8');
  assert.ok(architecture.includes('Peserta Umum'));
  assert.ok(!architecture.includes('Peserta Tryout'));
});
