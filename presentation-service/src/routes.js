import crypto from 'node:crypto';
import { Router } from 'express';
import { pool, databaseIsUp } from './db.js';
import { ApiError, asyncHandler, parseId } from './errors.js';
import { requireTryoutSession } from './auth.js';
import { gradeAnswer, gradeStatements } from './grading.js';

export const router = Router();

const SUBMISSION_VERSION = 'v1';
const nowMeta = () => ({ ts: new Date().toISOString() });

function assignmentOwnerId(auth) {
  return auth.accountType === 'participant' ? auth.participantId : auth.userId;
}

async function assertTryoutAssignment(auth, questionId) {
  const userId = assignmentOwnerId(auth);
  const boundSessionId = auth.accountType === 'participant' ? auth.tryoutSessionId : null;
  if (auth.accountType === 'participant' && !boundSessionId) {
    throw new ApiError('FORBIDDEN', 'Sesi tidak terikat pada tryout tertentu', 403);
  }
  const { rows } = await pool.query(
    `SELECT
       EXISTS (SELECT 1 FROM tryout_session_participants p
               WHERE p.session_id = s.id) AS has_participants,
       EXISTS (SELECT 1 FROM tryout_session_participants p
               WHERE p.session_id = s.id AND p.participant_id = $1) AS is_participant,
       EXISTS (SELECT 1 FROM tryout_session_questions tq
               WHERE tq.session_id = s.id) AS has_questions,
       EXISTS (SELECT 1 FROM tryout_session_questions tq
               WHERE tq.session_id = s.id AND tq.question_id = $2) AS has_question
     FROM tryout_sessions s
     WHERE ($3::bigint IS NOT NULL AND s.id = $3)
        OR ($3::bigint IS NULL AND s.is_active)
     ORDER BY s.id DESC
     LIMIT 1`,
    [userId, questionId, boundSessionId]
  );
  const session = rows[0];
  if (!session) {
    if (boundSessionId) throw new ApiError('FORBIDDEN', 'Tryout yang terikat tidak ditemukan', 403);
    return;
  }
  if (session.has_participants && !session.is_participant) {
    throw new ApiError('FORBIDDEN', 'Akun tidak terdaftar sebagai peserta tryout aktif', 403);
  }
  if (session.has_questions && !session.has_question) {
    throw new ApiError('FORBIDDEN', 'Soal tidak termasuk daftar tryout aktif', 403);
  }
}

async function resolvePresentationSession(auth, client = pool) {
  const boundSessionId = auth.accountType === 'participant' ? auth.tryoutSessionId : null;
  if (auth.accountType === 'participant' && !boundSessionId) {
    throw new ApiError('FORBIDDEN', 'Sesi tidak terikat pada tryout tertentu', 403);
  }
  const { rows } = await client.query(
    `SELECT s.id, s.cbt_enabled, s.is_active,
            EXISTS (SELECT 1 FROM tryout_session_participants p
                    WHERE p.session_id = s.id) AS has_participants,
            EXISTS (SELECT 1 FROM tryout_session_participants p
                    WHERE p.session_id = s.id AND p.participant_id = $1) AS is_participant
       FROM tryout_sessions s
      WHERE ($2::bigint IS NOT NULL AND s.id = $2)
         OR ($2::bigint IS NULL AND s.is_active)
      ORDER BY s.id DESC
      LIMIT 1`,
    [assignmentOwnerId(auth), boundSessionId]
  );
  const session = rows[0];
  if (!session) {
    if (boundSessionId) throw new ApiError('FORBIDDEN', 'Tryout yang terikat tidak ditemukan', 403);
    throw new ApiError('FORBIDDEN', 'Tidak ada sesi tryout aktif', 403);
  }
  if (session.has_participants && !session.is_participant) {
    throw new ApiError('FORBIDDEN', 'Akun tidak terdaftar sebagai peserta tryout aktif', 403);
  }
  return session;
}

async function approvedQuestion(id, client = pool) {
  const { rows } = await client.query(
    `SELECT q.id, q.stem, q.image_url, q.question_type, q.difficulty,
            ak.answer_text, ak.explanation,
            (SELECT o.option_key FROM question_options o WHERE o.id = ak.correct_option_id) AS correct_option_key,
             (SELECT coalesce(jsonb_agg(o.option_key ORDER BY o.position) FILTER (WHERE o.is_correct), '[]'::jsonb)
              FROM question_options o WHERE o.question_id = q.id) AS correct_keys,
             (SELECT coalesce(jsonb_agg(jsonb_build_object(
                'id', s.id, 'position', s.position,
                'statement_text', s.statement_text,
                'is_correct', s.is_correct, 'explanation', s.explanation
              ) ORDER BY s.position), '[]'::jsonb)
              FROM question_statements s WHERE s.question_id = q.id) AS statements
      FROM questions q

     LEFT JOIN answer_keys ak ON ak.question_id = q.id
     WHERE q.id = $1 AND q.status = 'approved'`,
    [id]
  );
  if (!rows[0]) throw new ApiError('NOT_FOUND', 'Soal approved tidak ditemukan', 404);
  return rows[0];
}

async function questionOptions(id, seed = null, shuffle = false, client = pool) {
  const { rows } = await client.query(
    `SELECT option_key, content FROM question_options WHERE question_id = $1 ORDER BY position`,
    [id]
  );
  const ordered = shuffle && seed ? seededItems(rows, seed, `options:${id}`) : rows;
  return ordered.map((option, index) => ({
    key: option.option_key,
    label: String.fromCharCode(65 + index),
    content: option.content
  }));
}

function publicStatements(question, seed = null, shuffle = false) {
  if (question.question_type !== 'true_false') return [];
  const source = question.statements ?? [];
  const ordered = shuffle && seed ? seededItems(source, seed, `statements:${question.id}`) : source;
  return ordered.map((statement, index) => ({
    id: statement.id,
    position: shuffle && seed ? index + 1 : statement.position,
    text: statement.statement_text
  }));
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
  let state = hashSeed(`${seed}:${salt}`);
  const random = () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  for (let index = ordered.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [ordered[index], ordered[swap]] = [ordered[swap], ordered[index]];
  }
  return ordered;
}

function deadlineFrom(startedAt, durationMinutes) {
  return new Date(Date.parse(startedAt) + durationMinutes * 60000).toISOString();
}

function cbtSettings(session) {
  return {
    cbt_enabled: session.cbt_enabled,
    cbt_duration_minutes: session.cbt_duration_minutes,
    cbt_shuffle_questions: session.cbt_shuffle_questions,
    cbt_shuffle_options: session.cbt_shuffle_options,
    cbt_require_fullscreen: session.cbt_require_fullscreen,
    cbt_max_violations: session.cbt_max_violations
  };
}

async function loadCbtSession(auth) {
  if (auth.accountType !== 'participant') {
    throw new ApiError('FORBIDDEN', 'Mode CBT hanya untuk akun peserta', 403);
  }
  const { rows } = await pool.query(
    `SELECT s.id, s.name, s.slug, s.cbt_enabled, s.cbt_duration_minutes,
            s.cbt_shuffle_questions, s.cbt_shuffle_options,
            s.cbt_require_fullscreen, s.cbt_max_violations
       FROM tryout_sessions s
       JOIN tryout_session_participants p ON p.session_id = s.id
      WHERE s.id = $1 AND p.participant_id = $2`,
    [auth.tryoutSessionId, auth.participantId]
  );
  const session = rows[0];
  if (!session) throw new ApiError('FORBIDDEN', 'Peserta tidak terdaftar pada tryout ini', 403);
  if (!session.cbt_enabled) throw new ApiError('CONFLICT', 'Tryout ini tidak menggunakan mode CBT', 409);
  return session;
}

async function findAttempt(auth, sessionId) {
  const { rows } = await pool.query(
    `SELECT * FROM tryout_attempts WHERE session_id = $1 AND participant_id = $2`,
    [sessionId, auth.participantId]
  );
  return rows[0] ?? null;
}

async function assertAttemptOpen(attempt) {
  if (attempt.status !== 'in_progress') {
    throw new ApiError('CONFLICT', 'Attempt sudah ditutup', 409);
  }
  if (attempt.deadline_at && Date.now() > Date.parse(attempt.deadline_at)) {
    await pool.query(
      `UPDATE tryout_attempts SET status = 'expired', updated_at = now() WHERE id = $1`,
      [attempt.id]
    );
    attempt.status = 'expired';
    throw new ApiError('GONE', 'Waktu pengerjaan habis', 410);
  }
}

async function sessionQuestions(sessionId, client = pool) {
  const { rows } = await client.query(
    `SELECT tq.question_id
       FROM tryout_session_questions tq
       JOIN questions q ON q.id = tq.question_id
      WHERE tq.session_id = $1 AND q.status = 'approved'
      ORDER BY tq.position, tq.question_id`,
    [sessionId]
  );
  return rows;
}

function validateDraft(question, payload) {
  if (question.question_type === 'true_false') {
    const answers = payload?.answers;
    if (!Array.isArray(answers)) {
      throw new ApiError('VALIDATION_ERROR', 'answers wajib berupa array pernyataan');
    }
    const statements = new Map((question.statements ?? []).map((item) => [String(item.id), item]));
    const seen = new Set();
    return answers.map((answer) => {
      const id = String(answer?.statement_id ?? answer?.id ?? '');
      const statement = statements.get(id);
      if (!statement || seen.has(id)) {
        throw new ApiError('VALIDATION_ERROR', 'Jawaban pernyataan tidak valid');
      }
      seen.add(id);
      const raw = answer.value;
      let value;
      if (typeof raw === 'boolean') value = raw;
      else if (typeof raw === 'string' && ['true', 'false'].includes(raw.toLowerCase())) {
        value = raw.toLowerCase() === 'true';
      } else {
        throw new ApiError('VALIDATION_ERROR', 'Nilai pernyataan harus Benar atau Salah');
      }
      return { statement_id: statement.id, value };
    });
  }
  const rawAnswer = payload?.answer;
  const answer = (Array.isArray(rawAnswer) ? rawAnswer : String(rawAnswer ?? '').split(','))
    .map((key) => String(key).trim().toUpperCase())
    .filter(Boolean);
  return { answer, answer_text: String(payload?.answer_text ?? '').trim() };
}

function gradeDraft(question, draft) {
  if (question.question_type === 'true_false') {
    const byId = new Map((question.statements ?? []).map((item) => [String(item.id), item]));
    const details = (draft ?? []).map((item) => ({
      statement_id: item.statement_id,
      value: item.value,
      is_correct: item.value === byId.get(String(item.statement_id))?.is_correct
    }));
    const correct = details.length === (question.statements ?? []).length
      && details.every((item) => item.is_correct);
    const explanations = details
      .filter((item) => !item.is_correct)
      .map((item) => byId.get(String(item.statement_id))?.explanation)
      .filter(Boolean);
    return {
      correct,
      answerValue: JSON.stringify(details.map((item) => ({ statement_id: item.statement_id, value: item.value }))),
      explanation: explanations.length ? explanations.join(' ') : question.explanation ?? null,
      statementGrades: details
    };
  }
  const answer = Array.isArray(draft?.answer) ? draft.answer : [];
  const answerText = String(draft?.answer_text ?? '').trim();
  return {
    correct: gradeAnswer(
      { correct_keys: question.correct_keys?.length ? question.correct_keys
          : (question.correct_option_key ? [question.correct_option_key] : []),
        answer_text: question.answer_text },
      { answer, answer_text: answerText }
    ),
    answerValue: answer.length ? answer.join(',') : answerText || null,
    explanation: question.explanation ?? null,
    statementGrades: null
  };
}

function gradeSubmissionPayload(question, payload) {
  if (question.question_type === 'true_false') {
    const graded = gradeStatements(question.statements ?? [], payload?.answers);
    if (!graded) throw new ApiError('VALIDATION_ERROR', 'Jawaban pernyataan tidak valid');
    const statementGrades = graded.details;
    const wrongExplanations = statementGrades
      .map((detail) => {
        const statement = (question.statements ?? []).find((item) => String(item.id) === String(detail.statement_id));
        return detail.is_correct ? null : statement?.explanation;
      })
      .filter(Boolean);
    return {
      correct: graded.correct,
      answerValue: JSON.stringify(statementGrades.map((detail) => ({
        statement_id: detail.statement_id,
        value: detail.value
      }))),
      explanation: wrongExplanations.length
        ? wrongExplanations.join(' ')
        : question.explanation ?? null,
      statementGrades
    };
  }
  const rawAnswer = payload?.answer;
  const answers = (Array.isArray(rawAnswer) ? rawAnswer : String(rawAnswer ?? '').split(','))
    .map((key) => String(key).trim().toUpperCase())
    .filter(Boolean);
  const answerText = String(payload?.answer_text ?? '').trim();
  const correctKeys = question.correct_keys?.length
    ? question.correct_keys
    : (question.correct_option_key ? [question.correct_option_key] : []);
  return {
    correct: gradeAnswer(
      { correct_keys: correctKeys, answer_text: question.answer_text },
      { answer: answers, answer_text: answerText }
    ),
    answerValue: answers.length ? answers.join(',') : answerText || null,
    explanation: question.explanation ?? null,
    statementGrades: null
  };
}

async function writeSubmission(client, ownerId, isParticipant, sessionId, questionId, graded) {
  const submitted = await client.query(
    `INSERT INTO tryout_submissions (${isParticipant ? 'participant_id' : 'user_id'},
                                     question_id, session_id, version, answer, is_correct, explanation)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (${isParticipant ? 'participant_id' : 'user_id'}, question_id, version)
     ${isParticipant ? 'WHERE participant_id IS NOT NULL' : ''} DO UPDATE SET
       session_id = EXCLUDED.session_id,
       answer = EXCLUDED.answer,
       is_correct = EXCLUDED.is_correct,
       explanation = EXCLUDED.explanation,
       updated_at = now()
     RETURNING id, question_id, updated_at`,
    [ownerId, questionId, sessionId, SUBMISSION_VERSION, graded.answerValue, graded.correct, graded.explanation]
  );
  if (graded.statementGrades) {
    const submissionId = submitted.rows[0].id;
    await client.query('DELETE FROM submission_statement_answers WHERE submission_id = $1', [submissionId]);
    for (const detail of graded.statementGrades) {
      await client.query(
        `INSERT INTO submission_statement_answers (submission_id, statement_id, answer, is_correct)
         VALUES ($1, $2, $3, $4)`,
        [submissionId, detail.statement_id, detail.value, detail.is_correct]
      );
    }
  }
  return submitted.rows[0];
}

async function attemptPayload(attempt, session) {
  const rows = await sessionQuestions(session.id);
  let questionIds = rows.map((row) => Number(row.question_id));
  if (session.cbt_shuffle_questions) {
    questionIds = seededItems(questionIds, attempt.seed, 'questions');
  }
  const questions = await Promise.all(questionIds.map(async (questionId, index) => {
    const question = await approvedQuestion(questionId);
    return {
      position: index + 1,
      question_id: questionId,
      stem: question.stem,
      image_url: question.image_url,
      question_type: question.question_type,
      difficulty: question.difficulty,
      options: await questionOptions(questionId, attempt.seed, session.cbt_shuffle_options),
      statements: publicStatements(question, attempt.seed, session.cbt_shuffle_options)
    };
  }));
  const [drafts, flags] = await Promise.all([
    pool.query('SELECT question_id, answer FROM tryout_cbt_drafts WHERE attempt_id = $1', [attempt.id]),
    pool.query('SELECT question_id FROM tryout_cbt_flags WHERE attempt_id = $1 AND flagged = true', [attempt.id])
  ]);
  const answers = {};
  for (const draft of drafts.rows) answers[String(draft.question_id)] = draft.answer;
  return {
    attempt: {
      id: attempt.id,
      session_id: attempt.session_id,
      status: attempt.status,
      started_at: attempt.started_at,
      deadline_at: attempt.deadline_at,
      submitted_at: attempt.submitted_at,
      violation_count: attempt.violation_count,
      ...cbtSettings(session)
    },
    questions,
    answers,
    flags: flags.rows.map((flag) => String(flag.question_id))
  };
}

async function beginAttempt(auth) {
  const session = await loadCbtSession(auth);
  let attempt = await findAttempt(auth, session.id);
  if (!attempt) {
    const inserted = await pool.query(
      `INSERT INTO tryout_attempts (session_id, participant_id, seed, started_at, deadline_at)
       VALUES ($1, $2, $3, now(), $4)
       RETURNING *`,
      [session.id, auth.participantId, crypto.randomUUID(),
        deadlineFrom(new Date().toISOString(), session.cbt_duration_minutes)]
    );
    attempt = inserted.rows[0];
  } else if (attempt.status === 'in_progress') {
    await assertAttemptOpen(attempt);
  }
  return { attempt, session };
}

async function activeAttempt(auth) {
  const session = await loadCbtSession(auth);
  const attempt = await findAttempt(auth, session.id);
  if (!attempt) throw new ApiError('NOT_FOUND', 'Attempt CBT tidak ditemukan', 404);
  await assertAttemptOpen(attempt);
  return { attempt, session };
}

async function finalizeAttempt(attempt, session) {
  await assertAttemptOpen(attempt);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const freshResult = await client.query(
      'SELECT * FROM tryout_attempts WHERE id = $1 FOR UPDATE',
      [attempt.id]
    );
    const fresh = freshResult.rows[0];
    if (!fresh) throw new ApiError('NOT_FOUND', 'Attempt CBT tidak ditemukan', 404);
    if (fresh.status !== 'in_progress') {
      await client.query('COMMIT');
      return fresh;
    }
    if (fresh.deadline_at && Date.now() > Date.parse(fresh.deadline_at)) {
      await client.query(
        `UPDATE tryout_attempts SET status = 'expired', updated_at = now() WHERE id = $1`,
        [fresh.id]
      );
      await client.query('COMMIT');
      throw new ApiError('GONE', 'Waktu pengerjaan habis', 410);
    }
    const [draftRows, questionRows] = await Promise.all([
      client.query('SELECT question_id, answer FROM tryout_cbt_drafts WHERE attempt_id = $1', [fresh.id]),
      sessionQuestions(fresh.session_id, client)
    ]);
    const drafts = new Map(draftRows.rows.map((row) => [Number(row.question_id), row.answer]));
    for (const row of questionRows) {
      const questionId = Number(row.question_id);
      const question = await approvedQuestion(questionId, client);
      const draft = drafts.get(questionId)
        ?? (question.question_type === 'true_false' ? [] : { answer: [], answer_text: '' });
      await writeSubmission(client, fresh.participant_id, true, fresh.session_id, questionId, gradeDraft(question, draft));
    }
    const updated = await client.query(
      `UPDATE tryout_attempts
          SET status = 'submitted', submitted_at = now(), updated_at = now()
        WHERE id = $1 RETURNING *`,
      [fresh.id]
    );
    await client.query('COMMIT');
    return updated.rows[0];
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

router.get('/health', asyncHandler(async (req, res) => {
  const up = await databaseIsUp();
  res.status(up ? 200 : 503).json({
    ok: up,
    service: 'presentation',
    database: up ? 'up' : 'down',
    meta: nowMeta()
  });
}));

router.get('/api/v1/presentation/questions', requireTryoutSession(), asyncHandler(async (req, res) => {
  const session = await resolvePresentationSession(req.auth);
  const assigned = await sessionQuestions(session.id);
  const questions = await Promise.all(assigned.map(async (row) => {
    const questionId = Number(row.question_id);
    const question = await approvedQuestion(questionId);
    return {
      id: questionId,
      question_id: questionId,
      stem: question.stem,
      image_url: question.image_url,
      question_type: question.question_type,
      difficulty: question.difficulty,
      options: await questionOptions(questionId),
      statements: publicStatements(question)
    };
  }));
  res.json({ ok: true, data: { questions }, meta: nowMeta() });
}));

router.post('/api/v1/presentation/attempts/submit-all', requireTryoutSession(), asyncHandler(async (req, res) => {
  const rawAnswers = req.body?.answers;
  if (!Array.isArray(rawAnswers) || rawAnswers.length > 200) {
    throw new ApiError('VALIDATION_ERROR', 'answers wajib berupa array maksimal 200 entri');
  }
  const seen = new Set();
  const answers = rawAnswers.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new ApiError('VALIDATION_ERROR', 'Setiap jawaban wajib berupa objek');
    }
    const questionId = parseId(entry.question_id);
    if (seen.has(questionId)) {
      throw new ApiError('VALIDATION_ERROR', 'question_id tidak boleh duplikat');
    }
    seen.add(questionId);
    return { questionId, payload: entry };
  });

  const session = await resolvePresentationSession(req.auth);
  if (session.cbt_enabled) {
    throw new ApiError('CONFLICT', 'Submit-all tidak tersedia untuk sesi CBT; gunakan finalize attempt', 409);
  }

  const isParticipant = req.auth.accountType === 'participant';
  const ownerId = assignmentOwnerId(req.auth);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const { questionId, payload } of answers) {
      const assigned = await client.query(
        'SELECT 1 FROM tryout_session_questions WHERE session_id = $1 AND question_id = $2',
        [session.id, questionId]
      );
      if (!assigned.rowCount) {
        throw new ApiError('FORBIDDEN', 'Soal tidak termasuk daftar tryout aktif', 403);
      }
      const question = await approvedQuestion(questionId, client);
      await writeSubmission(
        client, ownerId, isParticipant, session.id, questionId,
        gradeSubmissionPayload(question, payload)
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    client.release();
  }

  res.json({
    ok: true,
    data: { submitted_count: answers.length, submitted_at: new Date().toISOString() },
    meta: nowMeta()
  });
}));

router.get('/api/v1/presentation/questions/:id', requireTryoutSession(), asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await assertTryoutAssignment(req.auth, id);
  const question = await approvedQuestion(id);
  const options = await questionOptions(id);

  res.json({
    ok: true,
    data: {
      question_id: id,
      stem: question.stem,
      image_url: question.image_url,
      question_type: question.question_type,
      difficulty: question.difficulty,
      options,
      statements: publicStatements(question),
      rendered_at: new Date().toISOString()
    },
    meta: nowMeta()
  });
}));

router.post('/api/v1/presentation/questions/:id/submit', requireTryoutSession(), asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await assertTryoutAssignment(req.auth, id);
  const question = await approvedQuestion(id);

  const graded = gradeSubmissionPayload(question, req.body);
  const { correct, answerValue, explanation, statementGrades } = graded;

  const isParticipant = req.auth.accountType === 'participant';
  let sessionId = isParticipant ? req.auth.tryoutSessionId : null;
  if (!sessionId) {
    const activeSession = await pool.query(
      'SELECT id FROM tryout_sessions WHERE is_active ORDER BY id DESC LIMIT 1'
    );
    sessionId = activeSession.rows[0]?.id ?? null;
  }

  const submitted = await pool.query(
    `INSERT INTO tryout_submissions (${isParticipant ? 'participant_id' : 'user_id'},
                                     question_id, session_id, version, answer, is_correct, explanation)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (${isParticipant ? 'participant_id' : 'user_id'}, question_id, version)
     ${isParticipant ? 'WHERE participant_id IS NOT NULL' : ''} DO UPDATE SET
       session_id = EXCLUDED.session_id,
       answer = EXCLUDED.answer,
       is_correct = EXCLUDED.is_correct,
       explanation = EXCLUDED.explanation,
       updated_at = now()
     RETURNING id, question_id, updated_at`,
    [assignmentOwnerId(req.auth), id, sessionId, SUBMISSION_VERSION, answerValue, correct, explanation]
  );

  if (statementGrades) {
    const submissionId = submitted.rows[0].id;
    await pool.query('DELETE FROM submission_statement_answers WHERE submission_id = $1', [submissionId]);
    for (const detail of statementGrades) {
      await pool.query(
        `INSERT INTO submission_statement_answers (submission_id, statement_id, answer, is_correct)
         VALUES ($1, $2, $3, $4)`,
        [submissionId, detail.statement_id, detail.value, detail.is_correct]
      );
    }
  }

  res.json({
    ok: true,
    data: {
      submission: {
        id: submitted.rows[0].id,
        question_id: submitted.rows[0].question_id,
        submitted_at: submitted.rows[0].updated_at
      },
      submitted_at: new Date().toISOString()
    },
    meta: nowMeta()
  });
}));

router.post('/api/v1/presentation/cbt/attempt/start', requireTryoutSession(), asyncHandler(async (req, res) => {
  const { attempt, session } = await beginAttempt(req.auth);
  res.json({ ok: true, data: await attemptPayload(attempt, session), meta: nowMeta() });
}));

router.get('/api/v1/presentation/cbt/attempt', requireTryoutSession(), asyncHandler(async (req, res) => {
  const { attempt, session } = await activeAttempt(req.auth);
  res.json({ ok: true, data: await attemptPayload(attempt, session), meta: nowMeta() });
}));

router.post('/api/v1/presentation/cbt/attempt/autosave', requireTryoutSession(), asyncHandler(async (req, res) => {
  const { attempt, session } = await activeAttempt(req.auth);
  const questionId = parseId(req.body?.question_id);
  const assigned = await sessionQuestions(session.id);
  if (!assigned.some((row) => Number(row.question_id) === questionId)) {
    throw new ApiError('FORBIDDEN', 'Soal tidak termasuk daftar tryout ini', 403);
  }
  const question = await approvedQuestion(questionId);
  const draft = validateDraft(question, req.body);
  await pool.query(
    `INSERT INTO tryout_cbt_drafts (attempt_id, question_id, answer, updated_at)
     VALUES ($1, $2, $3::jsonb, now())
     ON CONFLICT (attempt_id, question_id)
     DO UPDATE SET answer = EXCLUDED.answer, updated_at = now()`,
    [attempt.id, questionId, JSON.stringify(draft)]
  );
  res.json({
    ok: true,
    data: { question_id: questionId, saved_at: new Date().toISOString() },
    meta: nowMeta()
  });
}));

router.post('/api/v1/presentation/cbt/attempt/flag', requireTryoutSession(), asyncHandler(async (req, res) => {
  const { attempt, session } = await activeAttempt(req.auth);
  const questionId = parseId(req.body?.question_id);
  const assigned = await sessionQuestions(session.id);
  if (!assigned.some((row) => Number(row.question_id) === questionId)) {
    throw new ApiError('FORBIDDEN', 'Soal tidak termasuk daftar tryout ini', 403);
  }
  const flagged = req.body?.flagged === undefined ? true : Boolean(req.body.flagged);
  if (flagged) {
    await pool.query(
      `INSERT INTO tryout_cbt_flags (attempt_id, question_id, flagged, updated_at)
       VALUES ($1, $2, true, now())
       ON CONFLICT (attempt_id, question_id)
       DO UPDATE SET flagged = true, updated_at = now()`,
      [attempt.id, questionId]
    );
  } else {
    await pool.query(
      'DELETE FROM tryout_cbt_flags WHERE attempt_id = $1 AND question_id = $2',
      [attempt.id, questionId]
    );
  }
  res.json({ ok: true, data: { question_id: questionId, flagged }, meta: nowMeta() });
}));

router.post('/api/v1/presentation/cbt/attempt/violation', requireTryoutSession(), asyncHandler(async (req, res) => {
  const allowedTypes = new Set(['tab_hidden', 'window_blur', 'fullscreen_exit', 'paste']);
  const violationType = String(req.body?.violation_type ?? req.body?.type ?? '');
  if (!allowedTypes.has(violationType)) {
    throw new ApiError('VALIDATION_ERROR', 'Jenis pelanggaran tidak dikenal');
  }
  const { attempt, session } = await activeAttempt(req.auth);
  const detail = req.body?.detail && typeof req.body.detail === 'object' ? req.body.detail : {};
  await pool.query(
    `INSERT INTO tryout_cbt_violations (attempt_id, violation_type, detail)
     VALUES ($1, $2, $3::jsonb)`,
    [attempt.id, violationType, JSON.stringify(detail)]
  );
  const counted = await pool.query(
    `UPDATE tryout_attempts SET violation_count = violation_count + 1, updated_at = now()
      WHERE id = $1 RETURNING violation_count`,
    [attempt.id]
  );
  const violationCount = counted.rows[0].violation_count;
  let status = attempt.status;
  if (session.cbt_max_violations > 0 && violationCount > session.cbt_max_violations) {
    attempt.violation_count = violationCount;
    const finalized = await finalizeAttempt(attempt, session);
    status = finalized.status;
  }
  res.json({
    ok: true,
    data: {
      type: violationType,
      violation_count: violationCount,
      max_violations: session.cbt_max_violations,
      status,
      limit: session.cbt_max_violations
    },
    meta: nowMeta()
  });
}));

router.post('/api/v1/presentation/cbt/attempt/finalize', requireTryoutSession(), asyncHandler(async (req, res) => {
  const { attempt, session } = await activeAttempt(req.auth);
  const finalized = await finalizeAttempt(attempt, session);
  res.json({
    ok: true,
    data: { status: finalized.status, submitted_at: finalized.submitted_at },
    meta: nowMeta()
  });
}));

router.get('/api/v1/presentation/attempts/summary', requireTryoutSession(), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS attempted
     FROM tryout_submissions
     WHERE coalesce(participant_id, user_id) = $1`,
    [assignmentOwnerId(req.auth)]
  );
  res.json({
    ok: true,
    data: {
      attempted: rows[0].attempted
    },
    meta: nowMeta()
  });
}));
