import { adminHeaders, API_BASE, PRESENTATION_BASE } from './auth-helper.mjs';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { query, pool } from '../../backend-agent/src/db.js';

const suffix = crypto.randomBytes(4).toString('hex');
const mapelCode = `QD${suffix.slice(0, 2).toUpperCase()}`;
const searchMarker = `QA6J-${suffix}-PAGE`;
const questionIds = [];
let mapelId;
let sessionId;
let eventId;
let manualId;
let activeSessionIds = [];

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function presentation(path, options = {}) {
  const response = await fetch(`${PRESENTATION_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

function essay(stem, extra = {}) {
  return {
    stem,
    mapel: mapelCode,
    question_type: 'essay',
    difficulty: 'medium',
    answer_text: 'Jawaban uji QA',
    ...extra
  };
}

async function createQuestion(stem) {
  const response = await api('/api/v1/questions', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify(essay(stem))
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  questionIds.push(response.body.data.question.id);
  return response.body.data.question;
}

before(async () => {
  const mapel = await api('/api/v1/mapels', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({ code: mapelCode, name: `QA 6j ${suffix}` })
  });
  assert.equal(mapel.status, 201, JSON.stringify(mapel.body));
  mapelId = mapel.body.data.mapel.id;

  const eventName = `QA6J Event ${suffix}`;
  const event = await query(
    `INSERT INTO tryout_events (name, slug, starts_at, ends_at)
     VALUES ($1, $2, now() - interval '1 hour', now() + interval '2 hours')
     RETURNING id`,
    [eventName, `qa6j-event-${suffix}`]
  );
  eventId = Number(event.rows[0].id);

  const active = await query('SELECT id FROM tryout_sessions WHERE is_active');
  activeSessionIds = active.rows.map((row) => row.id);
  if (activeSessionIds.length) {
    await query('UPDATE tryout_sessions SET is_active = false WHERE is_active');
  }
});

after(async () => {
  if (sessionId) {
    await query('DELETE FROM tryout_submissions WHERE session_id = $1', [sessionId]);
    await query('DELETE FROM tryout_sessions WHERE id = $1', [sessionId]);
  }
  if (eventId) await query('DELETE FROM tryout_events WHERE id = $1', [eventId]);
  if (activeSessionIds.length) {
    await query('UPDATE tryout_sessions SET is_active = true WHERE id = ANY($1::bigint[])', [activeSessionIds]);
  }
  if (questionIds.length) {
    await query('DELETE FROM questions WHERE id = ANY($1::bigint[])', [questionIds]);
  }
  if (mapelId) {
    await api(`/api/v1/mapels/${mapelId}`, { method: 'DELETE', headers: await adminHeaders() });
  }
  await pool.end();
});

test('J-01 create soal manual langsung approved', async () => {
  const question = await createQuestion(`QA6J manual ${suffix}`);
  manualId = question.id;
  assert.equal(question.status, 'approved');
  const detail = await api(`/api/v1/questions/${manualId}`, { headers: await adminHeaders() });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.status, 'approved');
});

test('J-02 import soal langsung approved', async () => {
  const response = await api('/api/v1/import', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      source: { type: 'external_collection', label: `QA6J import ${suffix}`, external_ref: `6J-${suffix}` },
      questions: [essay(`QA6J impor 1 ${suffix}`), essay(`QA6J impor 2 ${suffix}`)]
    })
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.data.created, 2);
  questionIds.push(...response.body.data.question_ids);
  for (const id of response.body.data.question_ids) {
    const detail = await api(`/api/v1/questions/${id}`, { headers: await adminHeaders() });
    assert.equal(detail.body.data.status, 'approved');
  }
});

test('J-03 draft/review ditolak di update dan filter', async () => {
  for (const status of ['draft', 'review']) {
    const update = await api(`/api/v1/questions/${manualId}`, {
      method: 'PUT',
      headers: await adminHeaders(),
      body: JSON.stringify({ status })
    });
    assert.equal(update.status, 400, JSON.stringify(update.body));
    assert.equal(update.body.error.code, 'VALIDATION_ERROR');

    const filter = await api(`/api/v1/questions?status=${status}`, { headers: await adminHeaders() });
    assert.equal(filter.status, 400);
    assert.equal(filter.body.error.code, 'VALIDATION_ERROR');
  }
});

test('J-04 tidak ada field versi/readiness pada response yang diekspos', async () => {
  const list = await api('/api/v1/questions?limit=5', { headers: await adminHeaders() });
  assert.equal(list.status, 200);
  for (const item of list.body.data.questions) {
    for (const field of ['version', 'ready_version', 'readiness', 'ready_version_count', 'is_multi_version_ready']) {
      assert.equal(field in item, false, `field ${field} tidak boleh ada di daftar soal`);
    }
  }
  const detail = await api(`/api/v1/questions/${manualId}`, { headers: await adminHeaders() });
  assert.equal(detail.body.data.version, undefined);
  assert.equal(detail.body.data.readiness, undefined);
  const tryout = await api('/api/v1/tryout/questions?limit=5', { headers: await adminHeaders() });
  assert.equal(tryout.status, 200);
  assert.equal(tryout.body.data.questions[0].version, undefined);
  const rendered = await presentation(`/api/v1/presentation/questions/${manualId}`, { headers: await adminHeaders() });
  assert.equal(rendered.status, 200, JSON.stringify(rendered.body));
  assert.equal(rendered.body.data.version, undefined);
});

test('J-05 endpoint versi/readiness/varian lama mengembalikan 404', async () => {
  const paths = [
    ['backend', '/api/v1/presentation-versions'],
    ['backend', `/api/v1/questions/${manualId}/readiness`],
    ['presentation', `/api/v1/presentation/questions/${manualId}/variants`],
    ['presentation', `/api/v1/presentation/questions/${manualId}/v1`]
  ];
  for (const [target, path] of paths) {
    const response = target === 'backend'
      ? await api(path, { headers: await adminHeaders() })
      : await presentation(path, { headers: await adminHeaders() });
    assert.equal(response.status, 404, `${path} harus 404`);
    assert.equal(response.body.error.code, 'NOT_FOUND');
  }
});

test('J-06 tryout hanya menampilkan soal approved dan bukan archived', async () => {
  const active = await createQuestion(`QA6J tryout aktif ${suffix}`);
  const archived = await createQuestion(`QA6J tryout arsip ${suffix}`);
  const deleted = await api(`/api/v1/questions/${archived.id}`, {
    method: 'DELETE',
    headers: await adminHeaders()
  });
  assert.equal(deleted.body.data.question.status, 'archived');

  const list = await api(`/api/v1/tryout/questions?mapel=${mapelCode}&limit=100`, {
    headers: await adminHeaders()
  });
  assert.equal(list.status, 200, JSON.stringify(list.body));
  const ids = list.body.data.questions.map((item) => item.id);
  assert.ok(ids.includes(active.id));
  assert.ok(!ids.includes(archived.id));
  assert.ok(ids.every((id) => id !== archived.id));
});

test('J-07 pagination CMS page1/page2/limit20, total, filter, dan hapus item terakhir di page2', async () => {
  for (let i = 1; i <= 25; i += 1) {
    await createQuestion(`${searchMarker}-${String(i).padStart(2, '0')}`);
  }
  const filter = `mapel=${mapelCode}&search=${searchMarker}`;
  const page1 = await api(`/api/v1/questions?${filter}&page=1&limit=20`, { headers: await adminHeaders() });
  assert.equal(page1.status, 200, JSON.stringify(page1.body));
  assert.equal(page1.body.data.pagination.page, 1);
  assert.equal(page1.body.data.pagination.limit, 20);
  assert.equal(page1.body.data.pagination.total, 25);
  assert.equal(page1.body.data.questions.length, 20);

  const page2 = await api(`/api/v1/questions?${filter}&page=2&limit=20`, { headers: await adminHeaders() });
  assert.equal(page2.status, 200);
  assert.equal(page2.body.data.pagination.page, 2);
  assert.equal(page2.body.data.pagination.total, 25);
  assert.equal(page2.body.data.questions.length, 5);

  const lastId = page2.body.data.questions.at(-1).id;
  const deleted = await api(`/api/v1/questions/${lastId}`, {
    method: 'DELETE',
    headers: await adminHeaders()
  });
  assert.equal(deleted.status, 200);

  const page2After = await api(`/api/v1/questions?${filter}&page=2&limit=20`, { headers: await adminHeaders() });
  assert.equal(page2After.body.data.pagination.total, 24);
  assert.equal(page2After.body.data.questions.length, 4);
  assert.ok(!page2After.body.data.questions.some((item) => item.id === lastId));
  const page1After = await api(`/api/v1/questions?${filter}&page=1&limit=20`, { headers: await adminHeaders() });
  assert.equal(page1After.body.data.questions.length, 20);
});

test('J-08 stem tidak bold di bundle CMS dan CSS/JS tryout', () => {
  const dashboard = readFileSync('/opt/virtual-office-bank-soal/frontend-agent/src/pages/Dashboard.jsx', 'utf8');
  const stemLine = dashboard.split('\n').find((line) => line.includes('{question.stem}'));
  assert.ok(stemLine, 'baris stem CMS harus ada');
  assert.match(stemLine, /<p className="text-sm leading-snug line-clamp-2">/);
  assert.doesNotMatch(stemLine, /font-(medium|semibold|bold)/);

  const bundleName = readdirSync('/opt/virtual-office-bank-soal/frontend-agent/dist/assets')
    .find((file) => file.endsWith('.js'));
  const bundle = readFileSync(`/opt/virtual-office-bank-soal/frontend-agent/dist/assets/${bundleName}`, 'utf8');
  assert.match(bundle, /Halaman /);
  assert.doesNotMatch(bundle, /Siap versi/);

  const app = readFileSync('/opt/virtual-office-bank-soal/tryout-agent/app.js', 'utf8');
  const css = readFileSync('/opt/virtual-office-bank-soal/tryout-agent/styles.css', 'utf8');
  assert.doesNotMatch(app, /<strong>/);
  assert.match(app, /stem\.textContent =/);
  assert.match(css, /\.question-stem\s*\{[^}]*font-weight:\s*400/);
  assert.match(css, /\.question-body h3\s*\{[^}]*font-weight:\s*400/);
});

test('J-09 data draft/review termigrasi menjadi approved di DB scratch', async () => {
  const statuses = await query('SELECT status, count(*)::int AS total FROM public.questions GROUP BY status');
  const byStatus = Object.fromEntries(statuses.rows.map((row) => [row.status, Number(row.total)]));
  assert.equal(byStatus.draft ?? 0, 0);
  assert.equal(byStatus.review ?? 0, 0);
  assert.ok((byStatus.approved ?? 0) >= 19, '19 soal draft lama harus termigrasi');

  const column = await query(
    `SELECT column_default FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'status'`
  );
  assert.equal(column.rows[0].column_default, "'approved'::character varying");
  const constraint = await query(
    `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
     WHERE conrelid = 'public.questions'::regclass AND conname = 'questions_status_check'`
  );
  assert.match(constraint.rows[0].definition, /approved/);
  assert.match(constraint.rows[0].definition, /rejected/);
  assert.match(constraint.rows[0].definition, /archived/);
});

test('J-10 submission lama v1 terbaca dan submit baru menyimpan v1', async () => {
  const legacyQuestion = await createQuestion(`QA6J legacy v1 ${suffix}`);
  const newQuestion = await createQuestion(`QA6J submit baru ${suffix}`);
  const adminUsername = process.env.QA_ADMIN_USERNAME || 'admin';
  const admin = await query('SELECT id FROM contributors WHERE username = $1', [adminUsername]);
  assert.ok(admin.rows[0], 'admin QA harus ada');

  const created = await api('/api/v1/tryout-sessions', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      name: `Sesi QA6J ${suffix}`,
      session_date: new Date().toISOString().slice(0, 10),
      event_id: eventId,
      is_active: true
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  sessionId = created.body.data.session.id;

  await query(
    `INSERT INTO tryout_submissions
       (user_id, question_id, session_id, version, answer, is_correct, explanation)
     VALUES ($1, $2, $3, 'v1', 'B', true, 'legacy-qa')`,
    [admin.rows[0].id, legacyQuestion.id, sessionId]
  );

  const report = await api(`/api/v1/reports/tryout?session_id=${sessionId}`, { headers: await adminHeaders() });
  assert.equal(report.status, 200, JSON.stringify(report.body));
  const legacyRow = report.body.data.details.find((item) => item.question_id === legacyQuestion.id);
  assert.ok(legacyRow, 'submission lama harus terbaca di laporan');
  assert.equal(legacyRow.user_answer, 'B');
  assert.equal(legacyRow.is_correct, true);

  const submitted = await presentation(`/api/v1/presentation/questions/${newQuestion.id}/submit`, {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({ answer: 'B' })
  });
  assert.equal(submitted.status, 200, JSON.stringify(submitted.body));

  const stored = await query(
    `SELECT version, answer FROM tryout_submissions
     WHERE user_id = $1 AND question_id = ANY($2::bigint[]) ORDER BY question_id`,
    [admin.rows[0].id, [legacyQuestion.id, newQuestion.id]]
  );
  assert.equal(stored.rows.length, 2);
  assert.ok(stored.rows.every((row) => row.version === 'v1'));
});
