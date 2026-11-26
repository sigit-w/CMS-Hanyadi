import { Router } from 'express';
import { query } from './db.js';
import { ApiError, asyncHandler } from './errors.js';
import { authorize } from './authMiddleware.js';
import { requireJenjangCode, requireMapelCode } from './validate.js';

export const researchQueryConfigRouter = Router();

const nowMeta = () => ({ ts: new Date().toISOString() });
const canRead = authorize('research_queries.read');
const canManage = authorize('research_queries.manage');
const canAgent = authorize('research_submissions.create');
const MAX_QUERY_ITEMS = 10;
const MAX_QUERY_LENGTH = 300;
const MAX_TOTAL_LENGTH = 4000;

const currentMonth = () => `${new Date().toISOString().slice(0, 7)}-01`;

const CONFIG_SELECT = `
  SELECT id, queries, mapel_code, jenjang_kode, max_questions, is_enabled,
         max_searches, max_results_per_query, max_output_tokens,
         max_runs_per_month, updated_by, created_at, updated_at
  FROM research_query_config
  WHERE id = 1
`;
const CONFIG_RETURNING = `
  RETURNING id, queries, mapel_code, jenjang_kode, max_questions, is_enabled,
            max_searches, max_results_per_query, max_output_tokens,
            max_runs_per_month, updated_by, created_at, updated_at
`;

function shapeConfig(row) {
  return {
    queries: String(row.queries).split('|').map((item) => item.trim()).filter(Boolean),
    mapel: row.mapel_code,
    jenjang: row.jenjang_kode,
    max_questions: row.max_questions,
    is_enabled: row.is_enabled,
    max_searches: row.max_searches,
    max_results_per_query: row.max_results_per_query,
    max_output_tokens: row.max_output_tokens,
    max_runs_per_month: row.max_runs_per_month,
    updated_by: row.updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function normalizeQueries(value) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[|\n]/)
      : [];
  const items = raw
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
  if (!items.length) {
    throw new ApiError('VALIDATION_ERROR', 'queries wajib berisi minimal satu teks query');
  }
  if (items.length > MAX_QUERY_ITEMS) {
    throw new ApiError('VALIDATION_ERROR', `queries maksimal ${MAX_QUERY_ITEMS} item`);
  }
  for (const item of items) {
    if (item.length > MAX_QUERY_LENGTH) {
      throw new ApiError('VALIDATION_ERROR', `Tiap query maksimal ${MAX_QUERY_LENGTH} karakter`);
    }
  }
  const unique = [...new Set(items)];
  if (unique.join('|').length > MAX_TOTAL_LENGTH) {
    throw new ApiError('VALIDATION_ERROR', `Total queries maksimal ${MAX_TOTAL_LENGTH} karakter`);
  }
  return unique.join('|');
}

function normalizeMaxQuestions(value) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > 10) {
    throw new ApiError('VALIDATION_ERROR', 'max_questions harus bilangan bulat 1 sampai 10');
  }
  return count;
}

function normalizeInteger(value, field, min, max, fallback) {
  const raw = value === undefined || value === null || value === '' ? fallback : value;
  const number = Number(raw);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new ApiError('VALIDATION_ERROR', `${field} harus bilangan bulat ${min} sampai ${max}`);
  }
  return number;
}

function normalizeBoolean(value, field, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  throw new ApiError('VALIDATION_ERROR', `${field} harus berupa boolean`);
}

async function resolveActiveRefs(mapelCode, jenjangKode) {
  const mapel = requireMapelCode(mapelCode);
  const jenjang = requireJenjangCode(jenjangKode);
  const [mapelRows, jenjangRows] = await Promise.all([
    query('SELECT code FROM mapels WHERE code = $1 AND is_active = true', [mapel]),
    query('SELECT kode FROM jenjang WHERE kode = $1 AND is_active = true', [jenjang])
  ]);
  if (!mapelRows.rows[0]) {
    throw new ApiError('VALIDATION_ERROR', 'Mapel tidak ditemukan atau tidak aktif');
  }
  if (!jenjangRows.rows[0]) {
    throw new ApiError('VALIDATION_ERROR', 'Jenjang tidak ditemukan atau tidak aktif');
  }
  return { mapel, jenjang };
}

researchQueryConfigRouter.get('/research-query-config', canRead, asyncHandler(async (req, res) => {
  const { rows } = await query(CONFIG_SELECT);
  if (!rows[0]) {
    throw new ApiError('NOT_FOUND', 'Konfigurasi query research tidak ditemukan', 404);
  }
  res.json({ ok: true, data: { config: shapeConfig(rows[0]) }, meta: nowMeta() });
}));

researchQueryConfigRouter.put('/research-query-config', canManage, asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const queries = normalizeQueries(body.queries);
  const maxQuestions = normalizeMaxQuestions(
    body.max_questions === undefined ? 3 : body.max_questions
  );
  const isEnabled = normalizeBoolean(body.is_enabled, 'is_enabled', true);
  const maxSearches = normalizeInteger(
    body.max_searches, 'max_searches', 1, 5,
    Math.min(2, Math.max(1, String(queries).split('|').length))
  );
  const maxResults = normalizeInteger(body.max_results_per_query, 'max_results_per_query', 1, 10, 3);
  const maxTokens = normalizeInteger(body.max_output_tokens, 'max_output_tokens', 300, 4000, 1200);
  const maxRuns = normalizeInteger(body.max_runs_per_month, 'max_runs_per_month', 1, 100, 25);
  const refs = await resolveActiveRefs(body.mapel, body.jenjang);

  const { rows } = await query(
    `INSERT INTO research_query_config
       (id, queries, mapel_code, jenjang_kode, max_questions, is_enabled,
        max_searches, max_results_per_query, max_output_tokens,
        max_runs_per_month, updated_by)
     VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (id) DO UPDATE SET
       queries = EXCLUDED.queries,
       mapel_code = EXCLUDED.mapel_code,
       jenjang_kode = EXCLUDED.jenjang_kode,
       max_questions = EXCLUDED.max_questions,
       is_enabled = EXCLUDED.is_enabled,
       max_searches = EXCLUDED.max_searches,
       max_results_per_query = EXCLUDED.max_results_per_query,
       max_output_tokens = EXCLUDED.max_output_tokens,
       max_runs_per_month = EXCLUDED.max_runs_per_month,
        updated_by = EXCLUDED.updated_by,
        updated_at = now()
      ${CONFIG_RETURNING}`,
     [queries, refs.mapel, refs.jenjang, maxQuestions, isEnabled,
       maxSearches, maxResults, maxTokens, maxRuns, req.auth.user.id]
   );

  res.json({ ok: true, data: { config: shapeConfig(rows[0]) }, meta: nowMeta() });
}));

researchQueryConfigRouter.get('/research-agent-usage', canManage, asyncHandler(async (req, res) => {
  const month = currentMonth();
  const [configRows, usageRows] = await Promise.all([
    query('SELECT max_runs_per_month FROM research_query_config WHERE id = 1'),
    query('SELECT month, runs, searches, questions, updated_at FROM research_agent_usage WHERE month = $1', [month])
  ]);
  const limit = configRows.rows[0]?.max_runs_per_month ?? 0;
  const usage = usageRows.rows[0] ?? { month, runs: 0, searches: 0, questions: 0, updated_at: null };
  res.json({
    ok: true,
    data: { usage, limit, remaining: Math.max(0, limit - usage.runs) },
    meta: nowMeta()
  });
}));

researchQueryConfigRouter.post('/research-agent-usage/start', canAgent, asyncHandler(async (req, res) => {
  const month = currentMonth();
  const { rows } = await query(CONFIG_SELECT);
  const config = rows[0];
  if (!config) {
    throw new ApiError('NOT_FOUND', 'Konfigurasi query research tidak ditemukan', 404);
  }
  if (!config.is_enabled) {
    res.json({
      ok: true,
      data: { allowed: false, reason: 'disabled', remaining: 0, config: shapeConfig(config) },
      meta: nowMeta()
    });
    return;
  }

  const reserved = await query(
    `INSERT INTO research_agent_usage (month, runs) VALUES ($1, 1)
     ON CONFLICT (month) DO UPDATE
       SET runs = research_agent_usage.runs + 1, updated_at = now()
     WHERE research_agent_usage.runs < $2
     RETURNING runs`,
    [month, config.max_runs_per_month]
  );
  const runs = reserved.rows[0]?.runs ?? config.max_runs_per_month;
  const allowed = reserved.rows.length > 0;

  res.json({
    ok: true,
    data: {
      allowed,
      reason: allowed ? null : 'monthly_cap',
      remaining: Math.max(0, config.max_runs_per_month - runs),
      config: shapeConfig(config)
    },
    meta: nowMeta()
  });
}));

researchQueryConfigRouter.post('/research-agent-usage/finish', canAgent, asyncHandler(async (req, res) => {
  const month = currentMonth();
  const body = req.body ?? {};
  const searches = normalizeInteger(body.searches, 'searches', 0, 100, 0);
  const questions = normalizeInteger(body.questions, 'questions', 0, 100, 0);

  const { rows } = await query(
    `INSERT INTO research_agent_usage (month, searches, questions)
     VALUES ($1, $2, $3)
     ON CONFLICT (month) DO UPDATE SET
       searches = research_agent_usage.searches + EXCLUDED.searches,
       questions = research_agent_usage.questions + EXCLUDED.questions,
       updated_at = now()
     RETURNING month, runs, searches, questions, updated_at`,
    [month, searches, questions]
  );

  res.json({ ok: true, data: { usage: rows[0] }, meta: nowMeta() });
}));
