import {
  adminHeaders,
  API_BASE,
  cookieHeader,
  participantLogin,
  PRESENTATION_BASE
} from './auth-helper.mjs';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { query, pool } from '../../backend-agent/src/db.js';

const BACKEND = API_BASE;
const PRESENTATION = PRESENTATION_BASE;
const suffix = crypto.randomBytes(4).toString('hex');
const slug = `qa-cbt-${suffix}`;
const password = crypto.randomBytes(18).toString('base64url');
const participantEmails = [
  `qa_cbt_one_${suffix}@qa.test`,
  `qa_cbt_two_${suffix}@qa.test`
];
const participantIds = [];
const questionIds = [];
let sessionId;
let headersOne;
let headersTwo;
let state;
let chosenSeed;
let fixedQ1;

async function request(base, pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

function hashSeed(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededItems(items, seed, salt) {
  const ordered = [...items];
  let stateValue = hashSeed(`${seed}:${salt}`);
  const random = () => {
    stateValue += 0x6d2b79f5;
    let value = Math.imul(stateValue ^ (stateValue >>> 15), 1 | stateValue);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  for (let index = ordered.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [ordered[index], ordered[swap]] = [ordered[swap], ordered[index]];
  }
  return ordered;
}

function sameOrder(left, right) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

async function createParticipant(email, name) {
  const response = await request(BACKEND, '/api/v1/participants', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      nama: name,
      email,
      kelas: 12,
      sekolah: 'SMA Negeri 1 QA',
      password
    })
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body.data.participant.id;
}

async function createQuestion(payload) {
  const response = await request(BACKEND, '/api/v1/questions', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify(payload)
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const id = response.body.data.question.id;
  questionIds.push(id);
  return id;
}

async function startAttempt(headers) {
  const response = await request(PRESENTATION, '/api/v1/presentation/cbt/attempt/start', {
    method: 'POST',
    headers
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body.data;
}

async function autosave(headers, questionId, payload) {
  return request(PRESENTATION, '/api/v1/presentation/cbt/attempt/autosave', {
    method: 'POST',
    headers,
    body: JSON.stringify({ question_id: questionId, ...payload })
  });
}

before(async () => {
  for (const base of [BACKEND, PRESENTATION]) {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
  }

  participantIds.push(await createParticipant(participantEmails[0], `QA CBT utama ${suffix}`));
  participantIds.push(await createParticipant(participantEmails[1], `QA CBT kadaluarsa ${suffix}`));

  await createQuestion({
    stem: `QA CBT pilihan ganda ${suffix}`,
    mapel: 'MTKA',
    question_type: 'multiple_choice',
    difficulty: 'easy',
    options: [
      { key: 'A', content: 'Satu', is_correct: false },
      { key: 'B', content: 'Dua', is_correct: true },
      { key: 'C', content: 'Tiga', is_correct: false },
      { key: 'D', content: 'Empat', is_correct: false }
    ],
    correct_key: 'B'
  });
  await createQuestion({
    stem: `QA CBT multi jawaban ${suffix}`,
    mapel: 'MTKA',
    question_type: 'multiple_answer',
    difficulty: 'medium',
    options: [
      { key: 'A', content: 'Genap', is_correct: true },
      { key: 'B', content: 'Ganjil', is_correct: false },
      { key: 'C', content: 'Positif', is_correct: true }
    ],
    correct_keys: ['A', 'C']
  });
  await createQuestion({
    stem: `QA CBT pernyataan ${suffix}`,
    mapel: 'MTKA',
    question_type: 'true_false',
    difficulty: 'easy',
    statements: [
      { text: `Pernyataan benar ${suffix}`, is_correct: true },
      { text: `Pernyataan salah ${suffix}`, is_correct: false }
    ]
  });

  const created = await request(BACKEND, '/api/v1/tryouts', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      name: `QA CBT ${suffix}`,
      slug,
      mapel_code: 'MTKA',
      start_at: '2026-11-24T08:00:00+07:00',
      end_at: '2026-11-25T08:00:00+07:00',
      question_ids: questionIds,
      participant_ids: participantIds,
      is_active: false,
      cbt_enabled: true,
      cbt_duration_minutes: 30,
      cbt_shuffle_questions: true,
      cbt_shuffle_options: true,
      cbt_require_fullscreen: true,
      cbt_max_violations: 3
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  sessionId = created.body.data.tryout.id;

  const loginOne = await participantLogin(participantEmails[0], password, slug);
  assert.equal(loginOne.status, 200);
  headersOne = { Cookie: cookieHeader(loginOne) };
  const loginTwo = await participantLogin(participantEmails[1], password, slug);
  assert.equal(loginTwo.status, 200);
  headersTwo = { Cookie: cookieHeader(loginTwo) };

  await startAttempt(headersOne);
  const originalIds = questionIds.map(Number);
  const originalOptions = ['A', 'B', 'C', 'D'];
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const candidate = `qa-cbt-${suffix}-${attempt}`;
    const qOrder = seededItems(originalIds, candidate, 'questions');
    const optionOrder = seededItems(originalOptions, candidate, `options:${questionIds[0]}`);
    if (!sameOrder(qOrder, originalIds) && !sameOrder(optionOrder, originalOptions)) {
      chosenSeed = candidate;
      break;
    }
  }
  assert.ok(chosenSeed, 'Tidak ditemukan seed yang mengubah urutan soal dan opsi');
  await query('UPDATE tryout_attempts SET seed = $1 WHERE session_id = $2 AND participant_id = $3',
    [chosenSeed, sessionId, participantIds[0]]);
  state = await startAttempt(headersOne);
  fixedQ1 = state.questions.find((question) => Number(question.question_id) === Number(questionIds[0]));
});

after(async () => {
  if (sessionId) {
    await request(BACKEND, `/api/v1/tryouts/${sessionId}`, {
      method: 'DELETE',
      headers: await adminHeaders()
    });
  }
  if (participantIds.length) {
    await query('DELETE FROM tryout_submissions WHERE participant_id = ANY($1::bigint[])', [participantIds]);
    await query('DELETE FROM tryout_participants WHERE id = ANY($1::bigint[])', [participantIds]);
  }
  if (questionIds.length) await query('DELETE FROM questions WHERE id = ANY($1::bigint[])', [questionIds]);
  await pool.end();
});

test('CBT-01 pengaturan admin tersimpan dan state peserta tanpa skor', async () => {
  const detail = await request(BACKEND, `/api/v1/tryouts/${sessionId}`, { headers: await adminHeaders() });
  assert.equal(detail.status, 200, JSON.stringify(detail.body));
  const tryout = detail.body.data.tryout;
  assert.equal(tryout.cbt_enabled, true);
  assert.equal(tryout.cbt_duration_minutes, 30);
  assert.equal(tryout.cbt_shuffle_questions, true);
  assert.equal(tryout.cbt_shuffle_options, true);
  assert.equal(tryout.cbt_require_fullscreen, true);
  assert.equal(tryout.cbt_max_violations, 3);

  assert.equal(state.attempt.status, 'in_progress');
  assert.ok(state.attempt.deadline_at);
  assert.equal(state.questions.length, 3);
  const raw = JSON.stringify(state);
  for (const key of ['is_correct', 'correct', 'score', 'correct_key', 'correct_keys', 'explanation']) {
    assert.equal(raw.includes(`"${key}"`), false, `${key} tidak boleh dikirim ke peserta`);
  }
});

test('CBT-02 urutan soal dan opsi diacak deterministik dengan label tampilan', async () => {
  assert.notDeepEqual(state.questions.map((question) => Number(question.question_id)),
    questionIds.map(Number));
  const again = await startAttempt(headersOne);
  assert.deepEqual(again.questions.map((question) => question.question_id),
    state.questions.map((question) => question.question_id));

  assert.ok(fixedQ1);
  assert.deepEqual(fixedQ1.options.map((option) => option.label), ['A', 'B', 'C', 'D']);
  assert.notDeepEqual(fixedQ1.options.map((option) => option.key), ['A', 'B', 'C', 'D']);
  assert.ok(fixedQ1.options.find((option) => option.key === 'B'));
});

test('CBT-03 autosave, flag, dan violation log tersimpan tanpa feedback', async () => {
  const trueFalse = state.questions.find((question) => question.question_type === 'true_false');
  const partial = { answers: [{ statement_id: trueFalse.statements[0].id, value: 'true' }] };
  const saved = await autosave(headersOne, trueFalse.question_id, partial);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.data.score, undefined);

  const flagged = await request(PRESENTATION, '/api/v1/presentation/cbt/attempt/flag', {
    method: 'POST',
    headers: headersOne,
    body: JSON.stringify({ question_id: questionIds[1], flagged: true })
  });
  assert.equal(flagged.status, 200, JSON.stringify(flagged.body));
  assert.equal(flagged.body.data.flagged, true);

  for (const violationType of ['tab_hidden', 'window_blur']) {
    const violation = await request(PRESENTATION, '/api/v1/presentation/cbt/attempt/violation', {
      method: 'POST',
      headers: headersOne,
      body: JSON.stringify({ violation_type: violationType, detail: { source: 'qa' } })
    });
    assert.equal(violation.status, 200, JSON.stringify(violation.body));
    assert.equal(violation.body.data.status, 'in_progress');
  }

  const drafts = await query(
    `SELECT answer FROM tryout_cbt_drafts
      WHERE attempt_id = (SELECT id FROM tryout_attempts WHERE participant_id = $1) AND question_id = $2`,
    [participantIds[0], trueFalse.question_id]
  );
  assert.equal(drafts.rows.length, 1);
  assert.equal(drafts.rows[0].answer.length, 1);

  const flags = await query(
    `SELECT f.question_id
       FROM tryout_cbt_flags f
       JOIN tryout_attempts a ON a.id = f.attempt_id
      WHERE a.participant_id = $1 AND f.flagged = true`,
    [participantIds[0]]
  );
  assert.ok(flags.rows.some((row) => Number(row.question_id) === Number(questionIds[1])));

  const report = await request(BACKEND, `/api/v1/reports/tryout?session_id=${sessionId}`, {
    headers: await adminHeaders()
  });
  assert.equal(report.status, 200, JSON.stringify(report.body));
  assert.ok(report.body.data.attempts.some((row) => Number(row.participant_id) === Number(participantIds[0])),
    JSON.stringify(report.body.data.attempts));
  assert.ok(report.body.data.violations
    .filter((row) => Number(row.participant_id) === Number(participantIds[0])).length >= 2);
});

test('CBT-04 finalize mengubah draft menjadi submission benar dan mengunci attempt', async () => {
  const mc = state.questions.find((question) => Number(question.question_id) === Number(questionIds[0]));
  const correctKey = mc.options.find((option) => option.key === 'B');
  assert.ok(correctKey);
  const multiple = state.questions.find((question) => Number(question.question_id) === Number(questionIds[1]));
  const trueFalse = state.questions.find((question) => question.question_type === 'true_false');
  const statementRows = await query(
    'SELECT id, is_correct FROM question_statements WHERE question_id = $1 ORDER BY position',
    [questionIds[2]]
  );
  const statementAnswers = trueFalse.statements.map((statement) => {
    const source = statementRows.rows.find((row) => Number(row.id) === Number(statement.id));
    return { statement_id: statement.id, value: String(source.is_correct) };
  });

  assert.equal((await autosave(headersOne, mc.question_id, { answer: correctKey.key })).status, 200);
  assert.equal((await autosave(headersOne, multiple.question_id, { answer: ['A', 'C'] })).status, 200);
  assert.equal((await autosave(headersOne, trueFalse.question_id, { answers: statementAnswers })).status, 200);

  const finalized = await request(PRESENTATION, '/api/v1/presentation/cbt/attempt/finalize', {
    method: 'POST',
    headers: headersOne
  });
  assert.equal(finalized.status, 200, JSON.stringify(finalized.body));
  assert.equal(finalized.body.data.status, 'submitted');
  assert.equal(finalized.body.data.score, undefined);

  const submissions = await query(
    `SELECT question_id, is_correct FROM tryout_submissions
      WHERE participant_id = $1 AND session_id = $2 AND version = 'v1'`,
    [participantIds[0], sessionId]
  );
  assert.equal(submissions.rows.length, 3);
  assert.ok(submissions.rows.every((row) => row.is_correct));

  const afterSubmit = await autosave(headersOne, mc.question_id, { answer: 'A' });
  assert.equal(afterSubmit.status, 409, JSON.stringify(afterSubmit.body));
});

test('CBT-05 deadline terlewat menolak autosave dan finalize', async () => {
  await startAttempt(headersTwo);
  await query(
    `UPDATE tryout_attempts
        SET deadline_at = now() - interval '1 hour'
      WHERE session_id = $1 AND participant_id = $2`,
    [sessionId, participantIds[1]]
  );
  const first = state.questions[0];
  const denied = await autosave(headersTwo, first.question_id, { answer: 'A' });
  assert.equal(denied.status, 410, JSON.stringify(denied.body));
  const attempt = await query(
    'SELECT status FROM tryout_attempts WHERE session_id = $1 AND participant_id = $2',
    [sessionId, participantIds[1]]
  );
  assert.equal(attempt.rows[0].status, 'expired');
  const finalize = await request(PRESENTATION, '/api/v1/presentation/cbt/attempt/finalize', {
    method: 'POST',
    headers: headersTwo
  });
  assert.equal(finalize.status, 409, JSON.stringify(finalize.body));
});
