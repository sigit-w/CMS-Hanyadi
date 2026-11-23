import { Router } from 'express';
import { pool, databaseIsUp } from './db.js';
import { ApiError, asyncHandler, parseId } from './errors.js';
import { requireTryoutSession } from './auth.js';
import { gradeAnswer } from './grading.js';

export const router = Router();

const SUBMISSION_VERSION = 'v1';
const nowMeta = () => ({ ts: new Date().toISOString() });

function assignmentOwnerId(auth) {
  return auth.accountType === 'participant' ? auth.participantId : auth.userId;
}

async function assertTryoutAssignment(userId, questionId) {
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
     WHERE s.is_active
     ORDER BY s.id DESC
     LIMIT 1`,
    [userId, questionId]
  );
  const session = rows[0];
  if (!session) return;
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
             FROM question_options o WHERE o.question_id = q.id) AS correct_keys
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
  await assertTryoutAssignment(assignmentOwnerId(req.auth), id);
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
      rendered_at: new Date().toISOString()
    },
    meta: nowMeta()
  });
}));

router.post('/api/v1/presentation/questions/:id/submit', requireTryoutSession(), asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await assertTryoutAssignment(assignmentOwnerId(req.auth), id);
  const question = await approvedQuestion(id);

  const rawAnswer = req.body?.answer;
  const answers = (Array.isArray(rawAnswer) ? rawAnswer : String(rawAnswer ?? '').split(','))
    .map((key) => String(key).trim().toUpperCase())
    .filter(Boolean);
  const text = String(req.body?.answer_text ?? '').trim();
  const correctKeys = question.correct_keys?.length
    ? question.correct_keys
    : (question.correct_option_key ? [question.correct_option_key] : []);
  const correct = gradeAnswer(
    { correct_keys: correctKeys, answer_text: question.answer_text },
    { answer: answers, answer_text: text }
  );
  const answerValue = answers.length ? answers.join(',') : text || null;

  const activeSession = await pool.query(
    'SELECT id FROM tryout_sessions WHERE is_active ORDER BY id DESC LIMIT 1'
  );
  const sessionId = activeSession.rows[0]?.id ?? null;

  const isParticipant = req.auth.accountType === 'participant';
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
    [assignmentOwnerId(req.auth), id, sessionId, SUBMISSION_VERSION, answerValue, correct,
      question.explanation ?? null]
  );

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
