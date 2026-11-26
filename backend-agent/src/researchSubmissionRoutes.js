import { Router } from 'express';
import { query, withTransaction } from './db.js';
import { ApiError, asyncHandler } from './errors.js';
import { authorize } from './authMiddleware.js';
import { parseId, requireJenjangCode, requireMapelCode, validateQuestionCreate } from './validate.js';
import { insertQuestion } from './questions.js';

export const researchSubmissionRouter = Router();

const nowMeta = () => ({ ts: new Date().toISOString() });
const canReview = authorize('questions.review');
const canCreate = authorize('research_submissions.create');
const RESEARCH_STATUSES = ['need_review', 'approved', 'rejected'];

const SUBMISSION_SELECT = `
  SELECT rs.id, rs.status, rs.source_system, rs.external_ref, rs.source_url, rs.stem,
         rs.question_type, rs.payload, rs.metadata, rs.question_id, rs.decision_note,
         rs.created_by, rs.reviewed_by, rs.reviewed_at, rs.created_at, rs.updated_at,
         m.code AS mapel_code, m.name AS mapel_name,
         j.kode AS jenjang_kode, j.nama AS jenjang_nama
  FROM research_submissions rs
  JOIN mapels m ON m.id = rs.mapel_id
  JOIN jenjang j ON j.id = rs.jenjang_id
`;

function optionalText(value, field, max) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new ApiError('VALIDATION_ERROR', `${field} harus berupa teks`);
  }
  const text = value.trim();
  if (text.length > max) {
    throw new ApiError('VALIDATION_ERROR', `${field} terlalu panjang (maksimal ${max} karakter)`);
  }
  return text || null;
}

function optionalObject(value, field) {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError('VALIDATION_ERROR', `${field} harus berupa objek`);
  }
  return value;
}

async function resolveRefs(client, data) {
  const run = client?.query ? client.query.bind(client) : query;
  const [mapel, jenjang] = await Promise.all([
    run('SELECT id FROM mapels WHERE code = $1 AND is_active = true', [data.mapel]),
    run('SELECT id FROM jenjang WHERE kode = $1 AND is_active = true', [data.jenjang])
  ]);
  if (!mapel.rows[0]) {
    throw new ApiError('VALIDATION_ERROR', 'Mapel tidak ditemukan atau tidak aktif');
  }
  if (!jenjang.rows[0]) {
    throw new ApiError('VALIDATION_ERROR', 'Jenjang tidak ditemukan atau tidak aktif');
  }
  return { mapelId: mapel.rows[0].id, jenjangId: jenjang.rows[0].id };
}

async function getSubmission(id, client = null) {
  const run = client?.query ? client.query.bind(client) : query;
  const { rows } = await run(`${SUBMISSION_SELECT} WHERE rs.id = $1`, [id]);
  return rows[0] ?? null;
}

function requirePending(submission) {
  if (!submission) {
    throw new ApiError('NOT_FOUND', 'Draft tidak ditemukan', 404);
  }
  if (submission.status !== 'need_review') {
    throw new ApiError('CONFLICT', `Draft sudah diproses (${submission.status})`, 409);
  }
}

researchSubmissionRouter.get('/research-submissions', canReview, asyncHandler(async (req, res) => {
  const status = req.query.status || 'need_review';
  if (!RESEARCH_STATUSES.includes(status)) {
    throw new ApiError('VALIDATION_ERROR', `status tidak valid: ${status}`);
  }
  const mapel = req.query.mapel ? requireMapelCode(req.query.mapel) : null;
  const jenjang = req.query.jenjang ? requireJenjangCode(req.query.jenjang) : null;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const where = `
    WHERE ($1::text IS NULL OR rs.status = $1)
      AND ($2::text IS NULL OR m.code = $2)
      AND ($3::text IS NULL OR j.kode = $3)
  `;
  const params = [status, mapel, jenjang];
  const [list, total] = await Promise.all([
    query(`${SUBMISSION_SELECT} ${where} ORDER BY rs.id DESC LIMIT $4 OFFSET $5`,
      [...params, limit, offset]),
    query(`SELECT count(*)::int AS total FROM research_submissions rs
           JOIN mapels m ON m.id = rs.mapel_id
           JOIN jenjang j ON j.id = rs.jenjang_id ${where}`, params)
  ]);

  res.json({
    ok: true,
    data: {
      submissions: list.rows,
      pagination: { page, limit, total: total.rows[0].total }
    },
    meta: nowMeta()
  });
}));

researchSubmissionRouter.post('/research-submissions', canCreate, asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const data = validateQuestionCreate(body);
  const externalRef = optionalText(body.external_ref, 'external_ref', 255);
  const sourceUrl = optionalText(body.source_url, 'source_url', 2000);
  const metadata = optionalObject(body.metadata, 'metadata');
  const refs = await resolveRefs(null, data);

  let id;
  try {
    const inserted = await query(
      `INSERT INTO research_submissions
         (source_system, external_ref, source_url, stem, mapel_id, jenjang_id,
          question_type, payload, metadata, created_by)
       VALUES ('n8n', $1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [externalRef, sourceUrl, data.stem, refs.mapelId, refs.jenjangId,
        data.question_type, JSON.stringify(data), JSON.stringify(metadata), req.auth.user.id]
    );
    id = inserted.rows[0].id;
  } catch (error) {
    if (error.code === '23505') {
      throw new ApiError('CONFLICT', 'Draft dengan external_ref ini sudah ada', 409);
    }
    throw error;
  }

  res.status(201).json({
    ok: true,
    data: { submission: await getSubmission(id) },
    meta: nowMeta()
  });
}));

researchSubmissionRouter.get('/research-submissions/:id', canReview, asyncHandler(async (req, res) => {
  const submission = await getSubmission(parseId(req.params.id));
  if (!submission) {
    throw new ApiError('NOT_FOUND', 'Draft tidak ditemukan', 404);
  }
  res.json({ ok: true, data: { submission }, meta: nowMeta() });
}));

researchSubmissionRouter.post('/research-submissions/:id/approve', canReview, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const note = optionalText(req.body?.decision_note, 'decision_note', 2000);

  const result = await withTransaction(async (client) => {
    const locked = await client.query(
      `${SUBMISSION_SELECT} WHERE rs.id = $1 FOR UPDATE OF rs`, [id]
    );
    requirePending(locked.rows[0]);
    const data = validateQuestionCreate(locked.rows[0].payload);
    const question = await insertQuestion(client, data);
    await client.query(
      `UPDATE research_submissions
          SET status = 'approved', question_id = $2, reviewed_by = $3,
              reviewed_at = now(), decision_note = $4
        WHERE id = $1`,
      [id, question.id, req.auth.user.id, note]
    );
    return { submission: await getSubmission(id, client), question };
  });

  res.json({ ok: true, data: result, meta: nowMeta() });
}));

researchSubmissionRouter.post('/research-submissions/:id/reject', canReview, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const note = optionalText(req.body?.decision_note, 'decision_note', 2000);

  const submission = await withTransaction(async (client) => {
    const locked = await client.query(
      `${SUBMISSION_SELECT} WHERE rs.id = $1 FOR UPDATE OF rs`, [id]
    );
    requirePending(locked.rows[0]);
    await client.query(
      `UPDATE research_submissions
          SET status = 'rejected', reviewed_by = $2,
              reviewed_at = now(), decision_note = $3
        WHERE id = $1`,
      [id, req.auth.user.id, note]
    );
    return getSubmission(id, client);
  });

  res.json({ ok: true, data: { submission }, meta: nowMeta() });
}));
