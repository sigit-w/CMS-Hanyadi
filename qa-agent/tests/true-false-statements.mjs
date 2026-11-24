import {
  activeTryoutContext, adminHeaders, API_BASE, attachQaParticipants,
  cookieHeader, participantLogin, PRESENTATION_BASE
} from './auth-helper.mjs';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { query, pool } from '../../backend-agent/src/db.js';

const BACKEND = API_BASE;
const PRESENTATION = PRESENTATION_BASE;
const suffix = crypto.randomBytes(4).toString('hex');
const participantEmail = `qa_tf_participant_${suffix}@qa.test`;
const password = crypto.randomBytes(18).toString('base64url');
const sessionDate = new Date().toISOString().slice(0, 10);
const questionIds = [];
let participantId;
let sessionId;
let participantHeaders;

const firstStatements = [
  { text: `Hewan tersebut termasuk mamalia ${suffix}`, is_correct: true, explanation: 'Bernapas dengan paru-paru' },
  { text: `Hewan tersebut bertelur ${suffix}`, is_correct: false, explanation: 'Mamalia umumnya melahirkan' }
];
const secondStatements = [
  { text: `Air mendidih pada 100 derajat Celsius ${suffix}`, is_correct: true },
  { text: `Air membeku pada 10 derajat Celsius ${suffix}`, is_correct: false }
];

async function request(base, pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

function payload(stem, statements) {
  return {
    stem,
    mapel: 'MTKA',
    question_type: 'true_false',
    difficulty: 'easy',
    statements
  };
}

async function createQuestion(stem, statements) {
  const response = await request(BACKEND, '/api/v1/questions', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify(payload(stem, statements))
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const id = response.body.data.question.id;
  questionIds.push(id);
  return id;
}

async function statementAnswers(questionId, values) {
  const response = await request(
    PRESENTATION,
    `/api/v1/presentation/questions/${questionId}`,
    { headers: participantHeaders }
  );
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const statements = response.body.data.statements;
  assert.equal(statements.length, values.length);
  return statements.map((statement, index) => ({
    statement_id: statement.id,
    value: String(values[index])
  }));
}

before(async () => {
  for (const base of [BACKEND, PRESENTATION]) {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
  }
  const active = await activeTryoutContext(query);
  sessionId = active.id;

  const created = await request(BACKEND, '/api/v1/participants', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      nama: `QA peserta true-false ${suffix}`,
      email: participantEmail,
      kelas: 12,
      sekolah: 'SMA Negeri 1 QA',
      password
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  participantId = created.body.data.participant.id;
  await attachQaParticipants(query, sessionId, [participantId]);

  const firstId = await createQuestion(`QA true-false benar ${suffix}`, firstStatements);
  const secondId = await createQuestion(`QA true-false salah ${suffix}`, secondStatements);
  await query(
    `INSERT INTO tryout_session_questions (session_id, question_id, position)
     SELECT $1, item, 900 + ordinal - 1
     FROM unnest($2::bigint[]) WITH ORDINALITY AS t(item, ordinal)`,
    [sessionId, questionIds]
  );

  const login = await participantLogin(participantEmail, password, active.slug);
  assert.equal(login.status, 200);
  participantHeaders = { Cookie: cookieHeader(login) };
  assert.ok(questionIds.includes(firstId) && questionIds.includes(secondId));
});

after(async () => {
  if (questionIds.length) {
    await query(
      'DELETE FROM tryout_session_questions WHERE session_id = $1 AND question_id = ANY($2::bigint[])',
      [sessionId, questionIds]
    );
  }
  if (participantId) {
    await query('DELETE FROM tryout_submissions WHERE participant_id = $1', [participantId]);
    await query('DELETE FROM tryout_session_participants WHERE session_id = $1 AND participant_id = $2', [sessionId, participantId]);
    await query('DELETE FROM tryout_participants WHERE id = $1', [participantId]);
  }
  if (questionIds.length) {
    await query('DELETE FROM questions WHERE id = ANY($1::bigint[])', [questionIds]);
  }
  await pool.end();
});

test('TF-01 soal true_false tersimpan dengan pernyataan dan kunci per butir', async () => {
  const response = await request(BACKEND, `/api/v1/questions/${questionIds[0]}`, {
    headers: await adminHeaders()
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const question = response.body.data;
  assert.equal(question.question_type, 'true_false');
  assert.equal(Number(question.statement_count), 2);
  assert.equal(Number(question.correct_statement_count), 1);
  assert.equal(question.statements.length, 2);
  assert.deepEqual(question.statements.map((item) => item.is_correct), [true, false]);

  const stored = await query(
    `SELECT position, statement_text, is_correct FROM question_statements
     WHERE question_id = $1 ORDER BY position`,
    [questionIds[0]]
  );
  assert.equal(stored.rows.length, 2);
  assert.deepEqual(stored.rows.map((row) => row.is_correct), [true, false]);
});

test('TF-02 validasi menolak jumlah, kunci, dan field yang tidak sesuai', async () => {
  const tooMany = await request(BACKEND, '/api/v1/questions', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify(payload(
      `QA tf banyak ${suffix}`,
      Array.from({ length: 6 }, (_, index) => ({ text: `Pernyataan ${index + 1}`, is_correct: index === 0 }))
    ))
  });
  assert.equal(tooMany.status, 400, JSON.stringify(tooMany.body));

  const noCorrect = await request(BACKEND, '/api/v1/questions', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify(payload(`QA tf tanpa benar ${suffix}`, [
      { text: 'Satu', is_correct: false }
    ]))
  });
  assert.equal(noCorrect.status, 400, JSON.stringify(noCorrect.body));

  const wrongField = await request(BACKEND, '/api/v1/questions', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      ...payload(`QA tf field salah ${suffix}`, firstStatements),
      correct_key: 'A'
    })
  });
  assert.equal(wrongField.status, 400, JSON.stringify(wrongField.body));

  const answerKey = await request(BACKEND, `/api/v1/questions/${questionIds[0]}/answer-key`, {
    method: 'PUT',
    headers: await adminHeaders(),
    body: JSON.stringify({ correct_keys: ['A'] })
  });
  assert.equal(answerKey.status, 400, JSON.stringify(answerKey.body));
});

test('TF-03 peserta tidak melihat kunci dan penilaian all-correct tersimpan per butir', async () => {
  const answers = await statementAnswers(questionIds[0], [true, false]);
  const detail = await request(
    PRESENTATION,
    `/api/v1/presentation/questions/${questionIds[0]}`,
    { headers: participantHeaders }
  );
  assert.equal(detail.status, 200, JSON.stringify(detail.body));
  detail.body.data.statements.forEach((statement) => {
    assert.equal(statement.is_correct, undefined);
    assert.equal(statement.correct, undefined);
    assert.equal(statement.statement_text, undefined);
    assert.ok(statement.text);
  });

  const submit = await request(
    PRESENTATION,
    `/api/v1/presentation/questions/${questionIds[0]}/submit`,
    {
      method: 'POST',
      headers: participantHeaders,
      body: JSON.stringify({ answers })
    }
  );
  assert.equal(submit.status, 200, JSON.stringify(submit.body));
  assert.equal(submit.body.data.correct, undefined);
  assert.equal(submit.body.data.explanation, undefined);

  const submission = await query(
    `SELECT ts.is_correct,
            jsonb_agg(jsonb_build_object('answer', ssa.answer, 'is_correct', ssa.is_correct)
                      ORDER BY s.position) AS details
     FROM tryout_submissions ts
     JOIN submission_statement_answers ssa ON ssa.submission_id = ts.id
     JOIN question_statements s ON s.id = ssa.statement_id
     WHERE ts.participant_id = $1 AND ts.question_id = $2
     GROUP BY ts.id`,
    [participantId, questionIds[0]]
  );
  assert.equal(submission.rows.length, 1);
  assert.equal(submission.rows[0].is_correct, true);
  assert.deepEqual(submission.rows[0].details, [
    { answer: true, is_correct: true },
    { answer: false, is_correct: true }
  ]);

  const report = await request(BACKEND, `/api/v1/reports/tryout?session_id=${sessionId}`, {
    headers: await adminHeaders()
  });
  assert.equal(report.status, 200, JSON.stringify(report.body));
  const row = report.body.data.details.find((item) => String(item.question_id) === String(questionIds[0]));
  assert.ok(row, JSON.stringify(report.body.data.details));
  assert.equal(row.is_correct, true);
  assert.equal(row.statement_details.length, 2);
  assert.ok(row.statement_details.every((item) => item.is_correct === true));
  assert.ok(row.correct_answer.includes(firstStatements[0].text));
  assert.equal(row.statement_details.length, 2);
});

test('TF-04 satu pernyataan salah membuat soal salah dan laporan per butir tetap jelas', async () => {
  const answers = await statementAnswers(questionIds[1], [true, true]);
  const submit = await request(
    PRESENTATION,
    `/api/v1/presentation/questions/${questionIds[1]}/submit`,
    {
      method: 'POST',
      headers: participantHeaders,
      body: JSON.stringify({ answers })
    }
  );
  assert.equal(submit.status, 200, JSON.stringify(submit.body));

  const report = await request(BACKEND, `/api/v1/reports/tryout?session_id=${sessionId}`, {
    headers: await adminHeaders()
  });
  assert.equal(report.status, 200, JSON.stringify(report.body));
  const row = report.body.data.details.find((item) => String(item.question_id) === String(questionIds[1]));
  assert.ok(row, JSON.stringify(report.body.data.details));
  assert.equal(row.is_correct, false);
  assert.deepEqual(row.statement_details.map((item) => item.is_correct), [true, false]);
  assert.equal(row.statement_details[1].user_answer, true);
  assert.equal(row.statement_details[1].correct_answer, false);
});

test('TF-05 pernyataan soal true_false existing dapat diperbarui', async () => {
  const statements = [
    { text: `Pernyataan revisi satu ${suffix}`, is_correct: true },
    { text: `Pernyataan revisi dua ${suffix}`, is_correct: true },
    { text: `Pernyataan revisi tiga ${suffix}`, is_correct: false }
  ];
  const updated = await request(BACKEND, `/api/v1/questions/${questionIds[0]}`, {
    method: 'PUT',
    headers: await adminHeaders(),
    body: JSON.stringify({ statements })
  });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));

  const stored = await query(
    'SELECT position, statement_text, is_correct FROM question_statements WHERE question_id = $1 ORDER BY position',
    [questionIds[0]]
  );
  assert.equal(stored.rows.length, 3);
  assert.deepEqual(stored.rows.map((row) => row.is_correct), [true, true, false]);
});
