import { Router } from 'express';
import { query, withTransaction } from './db.js';
import { ApiError, asyncHandler } from './errors.js';
import { authorize } from './authMiddleware.js';
import { parseId, QUESTION_TYPES, requireMapelCode, requireText } from './validate.js';
import { QUESTION_SELECT } from './questions.js';

export const questionSheetRouter = Router();

const nowMeta = () => ({ ts: new Date().toISOString() });
const manageSheets = authorize('question_sheets.manage');
const CODE_PATTERN = /^[A-Z0-9-]{12}$/;

const SHEET_SELECT = `
  SELECT sh.id, sh.name, sh.code, sh.description, sh.duration_minutes, sh.mapel_id,
         m.code AS mapel_code, m.name AS mapel_name,
         sh.archived, sh.archived_at, sh.created_at, sh.updated_at,
         (SELECT count(*)::int FROM question_sheet_questions qsq WHERE qsq.sheet_id = sh.id) AS question_count
  FROM question_sheets sh
  JOIN mapels m ON m.id = sh.mapel_id
`;

function generateCode(mapelCode) {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const year = String(now.getUTCFullYear() % 100).padStart(2, '0');
  return `LS-${requireMapelCode(mapelCode)}-${month}${year}`;
}

async function resolveMapelByCode(client, value) {
  const code = String(value ?? '').trim();
  if (!code) throw new ApiError('VALIDATION_ERROR', 'Pilih mapel terlebih dahulu');
  const run = client?.query ? client.query.bind(client) : query;
  const { rows } = await run(
    `SELECT id, code, name FROM mapels
     WHERE is_active = true AND (code = $1 OR id::text = $1)`,
    [code]
  );
  if (!rows[0]) throw new ApiError('VALIDATION_ERROR', 'Mapel tidak ditemukan atau tidak aktif');
  return rows[0];
}

function requireCode(value) {
  if (typeof value !== 'string') {
    throw new ApiError('VALIDATION_ERROR', 'Kode lembar soal wajib berupa teks');
  }
  const code = value.trim().toUpperCase();
  if (!CODE_PATTERN.test(code)) {
    throw new ApiError('VALIDATION_ERROR', 'Kode lembar soal harus tepat 12 karakter A-Z, 0-9, atau tanda hubung');
  }
  return code;
}

function requireDuration(value) {
  const minutes = Number(value);
  if (!Number.isSafeInteger(minutes) || minutes < 1) {
    throw new ApiError('VALIDATION_ERROR', 'Waktu pengerjaan harus bilangan bulat positif dalam menit');
  }
  return minutes;
}

function optionalDescription(value) {
  if (value === undefined || value === null || value === '') return null;
  return requireText(value, 'keterangan', 1000);
}

function requireQuestionIds(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError('VALIDATION_ERROR', 'Pilih minimal satu soal');
  }
  const seen = new Set();
  return value.map((item, index) => {
    const id = parseId(item, `question_ids[${index}]`);
    if (seen.has(id)) {
      throw new ApiError('VALIDATION_ERROR', `Soal duplikat: ${id}`);
    }
    seen.add(id);
    return id;
  });
}

function validateCreate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError('VALIDATION_ERROR', 'Body harus berupa objek');
  }
  return {
    name: requireText(body.name, 'nama lembar soal', 128),
    mapelCode: requireMapelCode(body.mapel_code ?? body.mapel),
    code: body.code === undefined || body.code === null || body.code === ''
      ? null
      : requireCode(body.code),
    description: optionalDescription(body.description),
    durationMinutes: requireDuration(body.duration_minutes),
    questionIds: requireQuestionIds(body.question_ids)
  };
}

function validateUpdate(body, current) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError('VALIDATION_ERROR', 'Body harus berupa objek');
  }
  const changes = {};
  if (body.name !== undefined) changes.name = requireText(body.name, 'nama lembar soal', 128);
  if (body.mapel_code !== undefined || body.mapel !== undefined) {
    changes.mapelCode = requireMapelCode(body.mapel_code ?? body.mapel);
  }
  if (body.code !== undefined && body.code !== '') changes.code = requireCode(body.code);
  if (body.description !== undefined) changes.description = optionalDescription(body.description);
  if (body.duration_minutes !== undefined) changes.durationMinutes = requireDuration(body.duration_minutes);
  if (body.question_ids !== undefined) changes.questionIds = requireQuestionIds(body.question_ids);
  if (Object.keys(changes).length === 0) {
    throw new ApiError('VALIDATION_ERROR', 'Tidak ada field yang diubah');
  }
  return {
    name: changes.name ?? current.name,
    code: changes.code ?? current.code,
    description: changes.description !== undefined ? changes.description : current.description,
    durationMinutes: changes.durationMinutes ?? current.duration_minutes,
    questionIds: changes.questionIds ?? null
  };
}

function isDuplicate(error) {
  return error?.code === '23505';
}

async function loadSheet(client, id) {
  const run = client?.query ? client.query.bind(client) : query;
  const { rows } = await run(`${SHEET_SELECT} WHERE sh.id = $1`, [id]);
  return rows[0];
}

async function loadQuestionIds(client, sheetId) {
  const run = client?.query ? client.query.bind(client) : query;
  const { rows } = await run(
    'SELECT question_id FROM question_sheet_questions WHERE sheet_id = $1 ORDER BY position, question_id',
    [sheetId]
  );
  return rows.map((row) => row.question_id);
}

async function resolveMapel(client, questionIds) {
  const { rows } = await client.query(
    'SELECT id, mapel_id, status FROM questions WHERE id = ANY($1::bigint[])',
    [questionIds]
  );
  if (rows.length !== questionIds.length) {
    throw new ApiError('VALIDATION_ERROR', 'Satu atau lebih soal tidak ditemukan');
  }
  if (rows.some((row) => row.status === 'archived')) {
    throw new ApiError('VALIDATION_ERROR', 'Soal terarsip tidak boleh dimasukkan ke lembar soal');
  }
  const mapelIds = new Set(rows.map((row) => String(row.mapel_id)));
  if (mapelIds.size !== 1) {
    throw new ApiError('VALIDATION_ERROR', 'Semua soal dalam lembar soal harus berasal dari satu mapel');
  }
  return Number(rows[0].mapel_id);
}

async function replaceQuestions(client, sheetId, questionIds) {
  await client.query('DELETE FROM question_sheet_questions WHERE sheet_id = $1', [sheetId]);
  for (const [position, questionId] of questionIds.entries()) {
    await client.query(
      `INSERT INTO question_sheet_questions (sheet_id, question_id, position)
       VALUES ($1, $2, $3)`,
      [sheetId, questionId, position]
    );
  }
}

async function isSheetUsed() {
  return false;
}

export async function attachQuestionSheets(rows) {
  if (!rows.length) return rows;
  const ids = rows.map((row) => row.id);
  const { rows: flags } = await query(
    `SELECT qsq.question_id,
            jsonb_agg(jsonb_build_object('id', sh.id, 'code', sh.code, 'name', sh.name) ORDER BY sh.code) AS sheets
     FROM question_sheet_questions qsq
     JOIN question_sheets sh ON sh.id = qsq.sheet_id AND sh.archived = false
     WHERE qsq.question_id = ANY($1::bigint[])
     GROUP BY qsq.question_id`,
    [ids]
  );
  const byQuestion = new Map(flags.map((row) => [String(row.question_id), row.sheets]));
  return rows.map((row) => ({ ...row, sheets: byQuestion.get(String(row.id)) ?? [] }));
}

questionSheetRouter.get('/question-sheets/generate-code', manageSheets, asyncHandler(async (req, res) => {
  const mapel = await resolveMapelByCode(query, req.query.mapel ?? req.query.mapel_code ?? req.query.mapel_id);
  res.json({ ok: true, data: { code: generateCode(mapel.code) }, meta: nowMeta() });
}));

questionSheetRouter.get('/question-sheets/question-picker', manageSheets, asyncHandler(async (req, res) => {
  const mapel = req.query.mapel ? requireMapelCode(req.query.mapel) : null;
  const search = req.query.search || null;
  const questionType = req.query.question_type || null;
  if (questionType && !QUESTION_TYPES.includes(questionType)) {
    throw new ApiError('VALIDATION_ERROR', `tipe soal tidak valid: ${questionType}`);
  }
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const where = `
    WHERE q.status = 'approved'
      AND ($1::text IS NULL OR m.code = $1)
      AND ($2::text IS NULL OR q.stem ILIKE '%' || $2 || '%')
      AND ($3::text IS NULL OR q.question_type = $3)
  `;
  const [list, total] = await Promise.all([
    query(`${QUESTION_SELECT} ${where} ORDER BY q.id DESC LIMIT $4 OFFSET $5`, [mapel, search, questionType, limit, offset]),
    query(`SELECT count(*)::int AS total FROM questions q JOIN mapels m ON m.id = q.mapel_id ${where}`,
      [mapel, search, questionType])
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

questionSheetRouter.get('/question-sheets', manageSheets, asyncHandler(async (req, res) => {
  const status = req.query.status || 'active';
  if (!['active', 'archived'].includes(status)) {
    throw new ApiError('VALIDATION_ERROR', `status tidak valid: ${status}`);
  }
  const mapel = req.query.mapel ? requireMapelCode(req.query.mapel) : null;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const where = `
    WHERE sh.archived = $1
      AND ($2::text IS NULL OR m.code = $2)
  `;
  const params = [status === 'archived', mapel];
  const [list, total] = await Promise.all([
    query(`${SHEET_SELECT} ${where} ORDER BY sh.id DESC LIMIT $3 OFFSET $4`, [...params, limit, offset]),
    query(`SELECT count(*)::int AS total FROM question_sheets sh JOIN mapels m ON m.id = sh.mapel_id ${where}`,
      params)
  ]);
  res.json({
    ok: true,
    data: {
      sheets: list.rows,
      pagination: { page, limit, total: total.rows[0].total }
    },
    meta: nowMeta()
  });
}));

questionSheetRouter.get('/question-sheets/:id', manageSheets, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const sheet = await loadSheet(query, id);
  if (!sheet) throw new ApiError('NOT_FOUND', 'Lembar soal tidak ditemukan', 404);
  res.json({
    ok: true,
    data: { sheet: { ...sheet, question_ids: await loadQuestionIds(query, id) } },
    meta: nowMeta()
  });
}));

questionSheetRouter.post('/question-sheets', manageSheets, asyncHandler(async (req, res) => {
  const data = validateCreate(req.body);
  const sheet = await withTransaction(async (client) => {
    const selectedMapel = await resolveMapelByCode(client, data.mapelCode);
    const mapelIdFromQuestions = await resolveMapel(client, data.questionIds);
    if (Number(selectedMapel.id) !== mapelIdFromQuestions) {
      throw new ApiError('VALIDATION_ERROR', 'Mapel lembar soal tidak cocok dengan mapel soal yang dipilih');
    }
    const code = data.code ?? generateCode(selectedMapel.code, selectedMapel.name);
    const duplicate = await client.query('SELECT id FROM question_sheets WHERE code = $1', [code]);
    if (duplicate.rows[0]) throw new ApiError('CONFLICT', 'Kode lembar soal sudah digunakan', 409);
    try {
      const created = await client.query(
        `INSERT INTO question_sheets (name, code, description, duration_minutes, mapel_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [data.name, code, data.description, data.durationMinutes, mapelIdFromQuestions, req.auth.user.id]
      );
      const sheetId = created.rows[0].id;
      await replaceQuestions(client, sheetId, data.questionIds);
      return loadSheet(client, sheetId);
    } catch (error) {
      if (isDuplicate(error)) throw new ApiError('CONFLICT', 'Kode lembar soal sudah digunakan', 409);
      throw error;
    }
  });
  res.status(201).json({ ok: true, data: { sheet }, meta: nowMeta() });
}));

questionSheetRouter.put('/question-sheets/:id', manageSheets, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const sheet = await withTransaction(async (client) => {
    const current = await loadSheet(client, id);
    if (!current) throw new ApiError('NOT_FOUND', 'Lembar soal tidak ditemukan', 404);
    const changes = validateUpdate(req.body, current);
    if (changes.code !== current.code && await isSheetUsed(client, id)) {
      throw new ApiError('CONFLICT', 'Kode lembar soal sudah dipakai tryout dan tidak bisa diubah', 409);
    }
    const mapelIdFromQuestions = changes.questionIds
      ? await resolveMapel(client, changes.questionIds)
      : current.mapel_id;
    let mapelId = mapelIdFromQuestions;
    if (changes.mapelCode) {
      const selectedMapel = await resolveMapelByCode(client, changes.mapelCode);
      if (Number(selectedMapel.id) !== mapelIdFromQuestions) {
        throw new ApiError('VALIDATION_ERROR', 'Mapel lembar soal tidak cocok dengan mapel soal yang dipilih');
      }
      mapelId = Number(selectedMapel.id);
    }
    try {
      await client.query(
        `UPDATE question_sheets
         SET name = $2, code = $3, description = $4, duration_minutes = $5, mapel_id = $6
         WHERE id = $1`,
        [id, changes.name, changes.code, changes.description, changes.durationMinutes, mapelId]
      );
      if (changes.questionIds) {
        await replaceQuestions(client, id, changes.questionIds);
      }
    } catch (error) {
      if (isDuplicate(error)) throw new ApiError('CONFLICT', 'Kode lembar soal sudah digunakan', 409);
      throw error;
    }
    return loadSheet(client, id);
  });
  res.json({
    ok: true,
    data: { sheet: { ...sheet, question_ids: await loadQuestionIds(query, id) } },
    meta: nowMeta()
  });
}));

questionSheetRouter.delete('/question-sheets/:id', manageSheets, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const sheet = await withTransaction(async (client) => {
    const current = await loadSheet(client, id);
    if (!current) throw new ApiError('NOT_FOUND', 'Lembar soal tidak ditemukan', 404);
    if (!current.archived) {
      await client.query(
        'UPDATE question_sheets SET archived = true, archived_at = now() WHERE id = $1',
        [id]
      );
    }
    return loadSheet(client, id);
  });
  res.json({ ok: true, data: { sheet }, meta: nowMeta() });
}));
