import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { adminHeaders, API_BASE } from './auth-helper.mjs';
import { query } from '../../backend-agent/src/db.js';

const ROOT = '/opt/virtual-office-bank-soal';
const suffix = crypto.randomBytes(6).toString('hex');
const approveStem = `QA6AB riset approve ${suffix}`;
const rejectStem = `QA6AB riset reject ${suffix}`;
const approveRef = `qa6ab-approve-${suffix}`;
const rejectRef = `qa6ab-reject-${suffix}`;
let mapelCode;
let approveId;
let rejectId;
let questionId;

async function api(pathname, options = {}) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(await adminHeaders()),
      ...(options.headers ?? {})
    }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

function draft(stem, externalRef) {
  return {
    stem,
    jenjang: 'SD',
    mapel: mapelCode,
    question_type: 'multiple_choice',
    difficulty: 'medium',
    options: [
      { key: 'A', content: 'Jakarta', is_correct: true },
      { key: 'B', content: 'Bandung' }
    ],
    correct_keys: ['A'],
    explanation: 'Ibukota Indonesia adalah Jakarta.',
    external_ref: externalRef,
    source_url: 'https://example.test/qa6ab',
    metadata: { run_id: `qa6ab-${suffix}`, model: 'qa' }
  };
}

before(async () => {
  const { rows } = await query('SELECT code FROM mapels WHERE is_active = true ORDER BY id LIMIT 1');
  assert.ok(rows[0], 'harus ada mapel aktif');
  mapelCode = rows[0].code;
});

after(async () => {
  if (questionId) {
    await query("UPDATE questions SET status = 'archived' WHERE id = $1", [questionId]);
  }
  const ids = [approveId, rejectId].filter(Boolean);
  if (ids.length) {
    await query('DELETE FROM research_submissions WHERE id = ANY($1::bigint[])', [ids]);
  }
});

test('R-01 migrasi 035 dan kontrak research-submissions terpasang', () => {
  const migration = readFileSync(`${ROOT}/db/migrations/035_research_submission_review.sql`, 'utf8');
  const openapi = readFileSync(`${ROOT}/backend-agent/openapi/openapi.yaml`, 'utf8');
  const backend = readFileSync(`${ROOT}/backend-agent/src/routes.js`, 'utf8');
  assert.match(migration, /research_submissions_status_check/);
  assert.match(openapi, /\/api\/v1\/research-submissions\/\{id\}\/approve:/);
  assert.match(openapi, /ResearchSubmissionCreate:/);
  assert.match(backend, /researchSubmissionRouter/);
});

test('R-02 permission agent hanya create dan tidak bisa publish langsung', async () => {
  const { rows } = await query(
    `SELECT p.code FROM roles r
     JOIN role_permissions rp ON rp.role_id = r.id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE r.code = 'research_agent' ORDER BY p.code`
  );
  assert.deepEqual(rows.map((row) => row.code), ['research_queries.read', 'research_submissions.create']);
});

test('R-03 draft need_review tidak membuat soal dan external_ref duplikat ditolak', async () => {
  const created = await api('/api/v1/research-submissions', {
    method: 'POST',
    body: JSON.stringify(draft(approveStem, approveRef))
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  approveId = created.body.data.submission.id;
  assert.equal(created.body.data.submission.status, 'need_review');
  assert.equal(created.body.data.submission.question_id, null);

  const found = await query('SELECT id FROM questions WHERE stem = $1', [approveStem]);
  assert.equal(found.rows.length, 0);

  const duplicate = await api('/api/v1/research-submissions', {
    method: 'POST',
    body: JSON.stringify(draft(approveStem, approveRef))
  });
  assert.equal(duplicate.status, 409, JSON.stringify(duplicate.body));
});

test('R-04 approve mempromosikan draft menjadi soal approved secara atomik', async () => {
  const approved = await api(`/api/v1/research-submissions/${approveId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ decision_note: 'QA setuju' })
  });
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  questionId = approved.body.data.question.id;
  assert.equal(approved.body.data.question.status, 'approved');
  assert.equal(approved.body.data.submission.status, 'approved');
  assert.equal(approved.body.data.submission.question_id, questionId);
  assert.equal(approved.body.data.submission.decision_note, 'QA setuju');

  const detail = await api(`/api/v1/questions/${questionId}`);
  assert.equal(detail.status, 200, JSON.stringify(detail.body));
  assert.equal(detail.body.data.has_answer_key, true);
  assert.equal(Number(detail.body.data.option_count), 2);

  const second = await api(`/api/v1/research-submissions/${approveId}/approve`, { method: 'POST' });
  assert.equal(second.status, 409, JSON.stringify(second.body));
});

test('R-05 reject tidak membuat soal dan menyimpan catatan', async () => {
  const created = await api('/api/v1/research-submissions', {
    method: 'POST',
    body: JSON.stringify(draft(rejectStem, rejectRef))
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  rejectId = created.body.data.submission.id;

  const rejected = await api(`/api/v1/research-submissions/${rejectId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ decision_note: 'Tidak relevan' })
  });
  assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
  assert.equal(rejected.body.data.submission.status, 'rejected');
  assert.equal(rejected.body.data.submission.question_id, null);
  assert.equal(rejected.body.data.submission.decision_note, 'Tidak relevan');

  const found = await query('SELECT id FROM questions WHERE stem = $1', [rejectStem]);
  assert.equal(found.rows.length, 0);
});
