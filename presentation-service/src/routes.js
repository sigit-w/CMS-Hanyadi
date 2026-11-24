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

async function approvedQuestion(id) {
  const { rows } = await pool.query(
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

async function questionOptions(id) {
  const { rows } = await pool.query(
    `SELECT option_key, content FROM question_options WHERE question_id = $1 ORDER BY position`,
    [id]
  );
  return rows.map((option) => ({ key: option.option_key, content: option.content }));
}

function publicStatements(question) {
  if (question.question_type !== 'true_false') return [];
  return (question.statements ?? []).map((statement) => ({
    id: statement.id,
    position: statement.position,
    text: statement.statement_text
  }));
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

  let correct;
  let answerValue;
  let statementGrades = null;
  let explanation = question.explanation ?? null;
  if (question.question_type === 'true_false') {
    const graded = gradeStatements(question.statements ?? [], req.body?.answers);
    if (!graded) throw new ApiError('VALIDATION_ERROR', 'Jawaban pernyataan tidak valid');
    statementGrades = graded.details;
    correct = graded.correct;
    answerValue = JSON.stringify(statementGrades.map((detail) => ({
      statement_id: detail.statement_id,
      value: detail.value
    })));
    const wrongExplanations = statementGrades
      .map((detail) => {
        const statement = (question.statements ?? []).find((item) => String(item.id) === String(detail.statement_id));
        return detail.is_correct ? null : statement?.explanation;
      })
      .filter(Boolean);
    if (wrongExplanations.length) explanation = wrongExplanations.join(' ');
  } else {
    const rawAnswer = req.body?.answer;
    const answers = (Array.isArray(rawAnswer) ? rawAnswer : String(rawAnswer ?? '').split(','))
      .map((key) => String(key).trim().toUpperCase())
      .filter(Boolean);
    const text = String(req.body?.answer_text ?? '').trim();
    const correctKeys = question.correct_keys?.length
      ? question.correct_keys
      : (question.correct_option_key ? [question.correct_option_key] : []);
    correct = gradeAnswer(
      { correct_keys: correctKeys, answer_text: question.answer_text },
      { answer: answers, answer_text: text }
    );
    answerValue = answers.length ? answers.join(',') : text || null;
  }

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
