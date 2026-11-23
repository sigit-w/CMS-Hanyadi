import express, { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { query, withTransaction } from './db.js';
import { config } from './config.js';
import { ApiError, asyncHandler } from './errors.js';
import { insertQuestion, QUESTION_SELECT } from './questions.js';
import { parseQuestions } from './importer.js';
import {
  validateQuestionCreate,
  validateQuestionUpdate,
  validateAnswerKey,
  parseId,
  QUESTION_TYPES,
  requireMapelCode,
  STATUSES
} from './validate.js';
import { authenticate, authorize } from './authMiddleware.js';
import { roleRouter } from './roleRoutes.js';
import { tryoutReportRouter } from './tryoutReportRoutes.js';
import { tryoutRouter } from './tryoutRoutes.js';
import { participantRouter } from './participantRoutes.js';
import { mapelRouter } from './mapelRoutes.js';
import { questionSheetRouter, attachQuestionSheets } from './questionSheetRoutes.js';

export const router = Router();

const IMAGE_MIME_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

router.use('/uploads', express.static(config.uploadDir, {
  dotfiles: 'deny',
  index: false,
  maxAge: '1d'
}));
router.use(authenticate);
router.use(roleRouter);
router.use(mapelRouter);
router.use(questionSheetRouter);
router.use(participantRouter);
router.use(tryoutReportRouter);
router.use(tryoutRouter);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 }
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!IMAGE_MIME_EXTENSIONS[file.mimetype]) {
      return callback(new ApiError('VALIDATION_ERROR', 'Gambar harus PNG, JPEG, WebP, atau GIF'));
    }
    callback(null, true);
  }
});

function parseQuestionBody(req) {
  const payload = req.body?.payload;
  if (payload === undefined) return req.body;
  if (typeof payload !== 'string') {
    throw new ApiError('VALIDATION_ERROR', 'Payload soal harus berupa JSON string');
  }
  try {
    return JSON.parse(payload);
  } catch {
    throw new ApiError('VALIDATION_ERROR', 'Payload soal tidak valid');
  }
}

async function storeQuestionImage(file) {
  const filename = `${Date.now()}-${crypto.randomUUID()}.${IMAGE_MIME_EXTENSIONS[file.mimetype]}`;
  await fs.mkdir(config.uploadDir, { recursive: true });
  await fs.writeFile(path.join(config.uploadDir, filename), file.buffer);
  return { filename, url: `/api/v1/uploads/${filename}` };
}

async function removeQuestionImage(image) {
  if (!image) return;
  await fs.unlink(path.join(config.uploadDir, image.filename)).catch(() => {});
}

async function removeQuestionImageByUrl(url) {
  if (!url) return;
  await fs.unlink(path.join(config.uploadDir, path.basename(url))).catch(() => {});
}

const nowMeta = () => ({ ts: new Date().toISOString() });

const TRYOUT_QUESTION_SELECT = `
  SELECT q.id, q.stem, q.image_url, q.question_type, q.difficulty,
         m.code AS mapel_code, m.name AS mapel_name
  FROM questions q
  JOIN mapels m ON m.id = q.mapel_id
`;

router.get('/tryout/questions', authorize('tryout.access'), asyncHandler(async (req, res) => {
  const mapel = req.query.mapel ? requireMapelCode(req.query.mapel) : null;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const where = `
    WHERE ($1::text IS NULL OR m.code = $1)
      AND q.status = 'approved'
      AND (
        NOT EXISTS (
          SELECT 1 FROM tryout_session_questions tq
          JOIN tryout_sessions ts ON ts.id = tq.session_id
          WHERE ts.is_active
        )
        OR EXISTS (
          SELECT 1 FROM tryout_session_questions tq
          JOIN tryout_sessions ts ON ts.id = tq.session_id
          WHERE ts.is_active AND tq.question_id = q.id
        )
      )
  `;
  const [list, total] = await Promise.all([
    query(`${TRYOUT_QUESTION_SELECT} ${where} ORDER BY q.id DESC LIMIT $2 OFFSET $3`, [mapel, limit, offset]),
    query(`SELECT count(*)::int AS total FROM questions q JOIN mapels m ON m.id = q.mapel_id ${where}`,
      [mapel])
  ]);
  res.json({
    ok: true,
    data: {
      questions: list.rows,
      pagination: { page, limit, total: total.rows[0].total }
    },
    meta: nowMeta()
  });
}));

router.get('/questions', authorize('questions.read'), asyncHandler(async (req, res) => {
  const mapel = req.query.mapel ? requireMapelCode(req.query.mapel) : null;
  const status = req.query.status || null;
  const search = req.query.search || null;
  const questionType = req.query.question_type || null;
  if (status && !STATUSES.includes(status)) {
    throw new ApiError('VALIDATION_ERROR', `status tidak valid: ${status}`);
  }
  if (questionType && !QUESTION_TYPES.includes(questionType)) {
    throw new ApiError('VALIDATION_ERROR', `tipe soal tidak valid: ${questionType}`);
  }
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const where = `
    WHERE ($1::text IS NULL OR m.code = $1)
      AND ($2::text IS NOT NULL OR q.status <> 'archived')
      AND ($2::text IS NULL OR q.status = $2)
      AND ($3::text IS NULL OR q.stem ILIKE '%' || $3 || '%')
      AND ($4::text IS NULL OR q.question_type = $4)
  `;
  const [list, total] = await Promise.all([
    query(`${QUESTION_SELECT} ${where} ORDER BY q.id DESC LIMIT $5 OFFSET $6`,
      [mapel, status, search, questionType, limit, offset]),
    query(`SELECT count(*)::int AS total FROM questions q
           JOIN mapels m ON m.id = q.mapel_id ${where}`,
      [mapel, status, search, questionType])
  ]);
  const questions = await attachQuestionSheets(list.rows);

  res.json({
    ok: true,
    data: {
      questions,
      pagination: { page, limit, total: total.rows[0].total }
    },
    meta: nowMeta()
  });
}));

router.post('/questions', authorize('questions.write'), imageUpload.single('image'), asyncHandler(async (req, res) => {
  const data = validateQuestionCreate(parseQuestionBody(req), Boolean(req.file));
  const image = req.file ? await storeQuestionImage(req.file) : null;
  try {
    const question = await withTransaction(async (client) => {
      const source = await client.query(
        `INSERT INTO question_sources (type_id, label, metadata)
         SELECT id, 'Input Manual', '{}'::jsonb FROM source_types WHERE code = 'manual'
         RETURNING id`
      );
      return insertQuestion(client, data, source.rows[0].id, image?.url ?? null);
    });
    res.status(201).json({ ok: true, data: { question }, meta: nowMeta() });
  } catch (error) {
    await removeQuestionImage(image);
    throw error;
  }
}));

router.get('/questions/:id', authorize('questions.read'), asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { rows } = await query(`${QUESTION_SELECT} WHERE q.id = $1`, [id]);
  if (!rows[0]) throw new ApiError('NOT_FOUND', 'Soal tidak ditemukan', 404);
  const question = (await attachQuestionSheets(rows))[0];

  const [options, answerKey] = await Promise.all([
    query(`SELECT id, option_key, content, is_correct, position
           FROM question_options WHERE question_id = $1 ORDER BY position`, [id]),
    query(`SELECT id, correct_option_id, answer_text, explanation
           FROM answer_keys WHERE question_id = $1`, [id])
  ]);

  res.json({
    ok: true,
    data: {
      ...question,
      options: options.rows,
      answer_key: answerKey.rows[0] ?? null
    },
    meta: nowMeta()
  });
}));

router.put('/questions/:id', authorize('questions.write'), imageUpload.single('image'), asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const currentResult = await query('SELECT question_type, image_url, mapel_id FROM questions WHERE id = $1', [id]);
  if (!currentResult.rows[0]) throw new ApiError('NOT_FOUND', 'Soal tidak ditemukan', 404);
  const current = currentResult.rows[0];
  const changes = validateQuestionUpdate(parseQuestionBody(req), current.question_type);
  const image = req.file ? await storeQuestionImage(req.file) : null;

  try {
    const question = await withTransaction(async (client) => {
      let mapelId = null;
      if (changes.mapel) {
        const mapel = await client.query(
          'SELECT id FROM mapels WHERE code = $1 AND is_active = true', [changes.mapel]
        );
        if (!mapel.rows[0]) throw new ApiError('VALIDATION_ERROR', 'Mapel tidak ditemukan atau tidak aktif');
        mapelId = mapel.rows[0].id;
      }

      await client.query(
        `UPDATE questions SET
           mapel_id = COALESCE($2::bigint, mapel_id),
           stem = COALESCE($3, stem),
           question_type = COALESCE($4, question_type),
           difficulty = COALESCE($5, difficulty),
           status = COALESCE($6, status),
           image_url = COALESCE($7, image_url)
         WHERE id = $1`,
        [id, mapelId, changes.stem ?? null, changes.question_type ?? null,
          changes.difficulty ?? null, changes.status ?? null, image?.url ?? null]
      );

      if (mapelId !== null && Number(mapelId) !== Number(current.mapel_id)) {
        const previousSessions = await client.query(
          `SELECT s.id, s.mapel_id
           FROM tryout_sessions s
           JOIN tryout_session_questions tq ON tq.session_id = s.id
           WHERE s.is_active AND tq.question_id = $1`,
          [id]
        );
        for (const session of previousSessions.rows) {
          if (Number(session.mapel_id) !== Number(mapelId)) {
            await client.query(
              'DELETE FROM tryout_session_questions WHERE session_id = $1 AND question_id = $2',
              [session.id, id]
            );
          }
        }
        const targetSession = await client.query(
          `SELECT id FROM tryout_sessions
           WHERE is_active AND mapel_id = $1
           ORDER BY id DESC LIMIT 1`,
          [mapelId]
        );
        if (targetSession.rows[0]) {
          const sessionId = targetSession.rows[0].id;
          const membership = await client.query(
            'SELECT 1 FROM tryout_session_questions WHERE session_id = $1 AND question_id = $2',
            [sessionId, id]
          );
          if (!membership.rows[0]) {
            await client.query(
              `INSERT INTO tryout_session_questions (session_id, question_id, position)
               SELECT $1, $2, coalesce(max(position) + 1, 0)
               FROM tryout_session_questions WHERE session_id = $1`,
              [sessionId, id]
            );
          }
        }
      }

      if (changes.options !== undefined || changes.correct_keys !== undefined
        || changes.answer_text !== undefined || changes.explanation !== undefined) {
        const previousKey = await client.query(
          'SELECT correct_option_id, answer_text, explanation FROM answer_keys WHERE question_id = $1', [id]
        );

        if (changes.options !== undefined) {
          await client.query('DELETE FROM answer_keys WHERE question_id = $1', [id]);
          await client.query('DELETE FROM question_options WHERE question_id = $1', [id]);
          for (const option of changes.options) {
            await client.query(
              `INSERT INTO question_options (question_id, option_key, content, is_correct, position)
               VALUES ($1, $2, $3, $4, $5)`,
              [id, option.key, option.content, option.is_correct, option.position]
            );
          }
        }

        let correctOptionId = changes.correct_keys !== undefined
          ? null
          : previousKey.rows[0]?.correct_option_id ?? null;
        if (changes.correct_keys !== undefined) {
          const keys = changes.correct_keys;
          if (keys.length) {
            const optionsResult = await client.query(
              `SELECT id, option_key FROM question_options
               WHERE question_id = $1 AND option_key = ANY($2::text[])`,
              [id, keys]
            );
            const foundKeys = optionsResult.rows.map((option) => option.option_key);
            for (const key of keys) {
              if (!foundKeys.includes(key)) {
                throw new ApiError('VALIDATION_ERROR', `Opsi jawaban ${key} tidak ditemukan`);
              }
            }
            correctOptionId = optionsResult.rows.find((option) => option.option_key === keys[0])?.id ?? null;
          }
          await client.query(
            'UPDATE question_options SET is_correct = option_key = ANY($2::text[]) WHERE question_id = $1',
            [id, keys]
          );
        }

        const answerText = changes.answer_text !== undefined
          ? changes.answer_text
          : previousKey.rows[0]?.answer_text ?? null;
        const explanation = changes.explanation !== undefined
          ? changes.explanation
          : previousKey.rows[0]?.explanation ?? null;
        await client.query(
          `INSERT INTO answer_keys (question_id, correct_option_id, answer_text, explanation)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (question_id) DO UPDATE SET
             correct_option_id = EXCLUDED.correct_option_id,
             answer_text = EXCLUDED.answer_text,
             explanation = EXCLUDED.explanation,
             updated_at = now()`,
          [id, correctOptionId, answerText, explanation]
        );
      }

      const fresh = await client.query(`${QUESTION_SELECT} WHERE q.id = $1`, [id]);
      if (!fresh.rows[0]) throw new ApiError('NOT_FOUND', 'Soal tidak ditemukan', 404);
      return fresh.rows[0];
    });

    if (image && current.image_url && current.image_url !== image.url) {
      await removeQuestionImageByUrl(current.image_url);
    }
    res.json({ ok: true, data: { question }, meta: nowMeta() });
  } catch (error) {
    if (image) await removeQuestionImage(image);
    throw error;
  }
}));

router.delete('/questions/:id', authorize('questions.write'), asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { rows } = await query(
    `UPDATE questions SET status = 'archived' WHERE id = $1 RETURNING id, status`, [id]
  );
  if (!rows[0]) throw new ApiError('NOT_FOUND', 'Soal tidak ditemukan', 404);
  res.json({ ok: true, data: { question: rows[0] }, meta: nowMeta() });
}));

router.put('/questions/:id/answer-key', authorize('questions.review'), asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const data = validateAnswerKey(req.body);

  const answerKey = await withTransaction(async (client) => {
    const found = await client.query(
      'SELECT id, question_type FROM questions WHERE id = $1', [id]
    );
    if (!found.rows[0]) throw new ApiError('NOT_FOUND', 'Soal tidak ditemukan', 404);
    const questionType = found.rows[0].question_type;
    if (data.correct_keys.length) {
      if ((questionType === 'multiple_choice' || questionType === 'true_false') && data.correct_keys.length !== 1) {
        throw new ApiError('VALIDATION_ERROR', 'Harus tepat satu opsi yang benar');
      }
    }

    const options = await client.query(
      `SELECT id, option_key FROM question_options
       WHERE question_id = $1 AND option_key = ANY($2::text[])`,
      [id, data.correct_keys]
    );
    const foundKeys = options.rows.map((option) => option.option_key);
    for (const key of data.correct_keys) {
      if (!foundKeys.includes(key)) {
        throw new ApiError('VALIDATION_ERROR', `Opsi jawaban ${key} tidak ditemukan`);
      }
    }
    const correctOptionId = options.rows.find((option) => option.option_key === data.correct_key)?.id ?? null;

    await client.query(
      'UPDATE question_options SET is_correct = option_key = ANY($2::text[]) WHERE question_id = $1',
      [id, data.correct_keys]
    );

    const { rows } = await client.query(
      `INSERT INTO answer_keys (question_id, correct_option_id, answer_text, explanation)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (question_id) DO UPDATE SET
         correct_option_id = EXCLUDED.correct_option_id,
         answer_text = EXCLUDED.answer_text,
         explanation = EXCLUDED.explanation,
         updated_at = now()
       RETURNING id, question_id, correct_option_id, answer_text, explanation`,
      [id, correctOptionId, data.answer_text, data.explanation]
    );
    return { ...rows[0], correct_keys: data.correct_keys };
  });

  res.json({ ok: true, data: { answer_key: answerKey }, meta: nowMeta() });
}));


router.get('/sources', authorize('questions.read'), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT qs.id, st.code AS type, qs.label, qs.original_filename, qs.mime_type,
            qs.external_ref, qs.collected_at, qs.created_at,
            (SELECT count(*) FROM questions q WHERE q.source_id = qs.id) AS question_count
     FROM question_sources qs
     JOIN source_types st ON st.id = qs.type_id
     ORDER BY qs.id DESC LIMIT 100`
  );
  res.json({ ok: true, data: { sources: rows }, meta: nowMeta() });
}));

router.post('/import', authorize('questions.write'), upload.single('file'), asyncHandler(async (req, res) => {
  const sourceInput = req.body?.source ?? {
    type: req.body?.type,
    label: req.body?.label,
    external_ref: req.body?.external_ref,
    collected_from: req.body?.collected_from,
    metadata: req.body?.metadata
  };
  let content = req.file ? req.file.buffer.toString('utf8') : req.body?.content;
  const hasQuestionArray = Array.isArray(req.body?.questions);
  if (!content && hasQuestionArray) {
    content = JSON.stringify({ questions: req.body.questions });
  }
  const filename = req.file?.originalname ?? req.body?.filename ?? '';
  const mimeType = req.file?.mimetype ?? req.body?.mime_type ?? '';

  if (!content) throw new ApiError('VALIDATION_ERROR', 'File atau konten import wajib diisi');

  const format = req.body?.format ?? (hasQuestionArray ? 'json' : undefined);
  const questions = parseQuestions(format, content, filename);
  const sourceType = req.file ? 'file_upload' : (sourceInput.type ?? 'external_collection');
  if (!['manual', 'file_upload', 'external_collection'].includes(sourceType)) {
    throw new ApiError('VALIDATION_ERROR', 'Jenis sumber tidak valid');
  }

  const result = await withTransaction(async (client) => {
    const source = await client.query(
      `INSERT INTO question_sources
         (type_id, label, original_filename, mime_type, external_ref, collected_from, collected_at, metadata)
       VALUES ((SELECT id FROM source_types WHERE code = $1), $2, $3, $4, $5, $6,
               CASE WHEN $1 = 'external_collection' THEN now() ELSE NULL END, $7::jsonb)
       RETURNING id`,
      [sourceType,
        sourceInput.label ?? (req.file ? filename : 'Pengumpulan Eksternal'),
        filename || null,
        mimeType || null,
        sourceInput.external_ref ?? null,
        sourceInput.collected_from ?? null,
        JSON.stringify(sourceInput.metadata ?? {})]
    );

    const sourceId = source.rows[0].id;
    const ids = [];
    for (const question of questions) {
      const inserted = await insertQuestion(client, question, sourceId);
      ids.push(inserted.id);
    }
    return { sourceId, ids };
  });

  res.status(201).json({
    ok: true,
    data: { source_id: result.sourceId, created: result.ids.length, question_ids: result.ids },
    meta: nowMeta()
  });
}));
