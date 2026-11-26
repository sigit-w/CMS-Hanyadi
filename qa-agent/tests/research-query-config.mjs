import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adminHeaders, API_BASE } from './auth-helper.mjs';
import { query } from '../../backend-agent/src/db.js';

const ROOT = '/opt/virtual-office-bank-soal';
let original;
let originalUsage;
let mapelCode;
const month = new Date().toISOString().slice(0, 7) + '-01';

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

before(async () => {
  const config = await query(
    `SELECT queries, mapel_code, jenjang_kode, max_questions, is_enabled,
            max_searches, max_results_per_query, max_output_tokens,
            max_runs_per_month, updated_by
     FROM research_query_config WHERE id = 1`
  );
  assert.ok(config.rows[0], 'research_query_config id=1 harus ada');
  original = config.rows[0];

  const usage = await query(
    `SELECT month, runs, searches, questions FROM research_agent_usage WHERE month = $1`, [month]
  );
  originalUsage = usage.rows[0] ?? null;

  const mapel = await query('SELECT code FROM mapels WHERE is_active = true ORDER BY id LIMIT 1');
  assert.ok(mapel.rows[0], 'harus ada mapel aktif');
  mapelCode = mapel.rows[0].code;
});

after(async () => {
  if (!original) return;
  await query(
    `UPDATE research_query_config
        SET queries = $1, mapel_code = $2, jenjang_kode = $3, max_questions = $4,
            is_enabled = $5, max_searches = $6, max_results_per_query = $7,
            max_output_tokens = $8, max_runs_per_month = $9,
            updated_by = $10, updated_at = now()
      WHERE id = 1`,
    [original.queries, original.mapel_code, original.jenjang_kode, original.max_questions,
      original.is_enabled, original.max_searches, original.max_results_per_query,
      original.max_output_tokens, original.max_runs_per_month, original.updated_by]
  );
  await query('DELETE FROM research_agent_usage WHERE month = $1', [month]);
  if (originalUsage) {
    await query(
      `INSERT INTO research_agent_usage (month, runs, searches, questions)
       VALUES ($1, $2, $3, $4)`,
      [originalUsage.month, originalUsage.runs, originalUsage.searches, originalUsage.questions]
    );
  }
});

test('QC-01 migrasi 036, kontrak, router, dan halaman CMS terpasang', () => {
  const migration = readFileSync(`${ROOT}/db/migrations/036_research_query_config.sql`, 'utf8');
  const openapi = readFileSync(`${ROOT}/backend-agent/openapi/openapi.yaml`, 'utf8');
  const backend = readFileSync(`${ROOT}/backend-agent/src/routes.js`, 'utf8');
  const app = readFileSync(`${ROOT}/frontend-agent/src/App.jsx`, 'utf8');
  assert.match(migration, /research_query_config_max_questions_check/);
  assert.match(migration, /research_queries\.manage/);
  assert.match(openapi, /\/api\/v1\/research-query-config:/);
  assert.match(openapi, /ResearchQueryConfigWrite:/);
  assert.match(backend, /researchQueryConfigRouter/);
  assert.match(app, /research_queries\.manage/);
  assert.match(app, /research-query-config/);
});

test('QC-02 admin bisa membaca konfigurasi aktif', async () => {
  const got = await api('/api/v1/research-query-config');
  assert.equal(got.status, 200, JSON.stringify(got.body));
  assert.ok(Array.isArray(got.body.data.config.queries));
  assert.equal(got.body.data.config.jenjang, original.jenjang_kode);
  assert.equal(got.body.data.config.max_questions, original.max_questions);
});

test('QC-03 PUT menormalkan pipe/baris baru, dedupe, dan menyimpan singleton', async () => {
  const payload = {
    queries: 'QA query satu|QA query dua\nQA query dua',
    mapel: mapelCode,
    jenjang: 'SD',
    max_questions: 5,
    is_enabled: true,
    max_searches: 2,
    max_results_per_query: 3,
    max_output_tokens: 1200,
    max_runs_per_month: 25
  };
  const saved = await api('/api/v1/research-query-config', {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.deepEqual(saved.body.data.config.queries, ['QA query satu', 'QA query dua']);
  assert.equal(saved.body.data.config.mapel, mapelCode);
  assert.equal(saved.body.data.config.jenjang, 'SD');
  assert.equal(saved.body.data.config.max_questions, 5);
  assert.equal(saved.body.data.config.is_enabled, true);
  assert.equal(saved.body.data.config.max_searches, 2);
  assert.equal(saved.body.data.config.max_results_per_query, 3);
  assert.equal(saved.body.data.config.max_output_tokens, 1200);
  assert.equal(saved.body.data.config.max_runs_per_month, 25);

  const { rows } = await query(
    `SELECT queries, max_questions, is_enabled, max_searches, max_results_per_query,
            max_output_tokens, max_runs_per_month
     FROM research_query_config WHERE id = 1`
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].queries, 'QA query satu|QA query dua');
  assert.equal(rows[0].max_questions, 5);
  assert.equal(rows[0].is_enabled, true);
  assert.equal(rows[0].max_searches, 2);
});

test('QC-04 validasi menolak query kosong, mapel/jenjang invalid, dan max di luar 1–10', async () => {
  const base = { queries: ['QA'], mapel: mapelCode, jenjang: 'SD', max_questions: 3 };
  const cases = [
    { ...base, queries: [] },
    { ...base, queries: Array.from({ length: 11 }, (_, i) => `QA ${i}`) },
    { ...base, mapel: 'XXXX' },
    { ...base, jenjang: 'SDX' },
    { ...base, max_questions: 11 },
    { ...base, max_searches: 6 },
    { ...base, max_results_per_query: 11 },
    { ...base, max_output_tokens: 299 },
    { ...base, max_runs_per_month: 101 }
  ];
  for (const payload of cases) {
    const result = await api('/api/v1/research-query-config', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    assert.equal(result.status, 400, JSON.stringify(result.body));
  }
});

test('QC-05 RBAC: research_agent hanya read, admin read + manage', async () => {
  const { rows } = await query(
    `SELECT r.code AS role, p.code AS permission
     FROM roles r
     JOIN role_permissions rp ON rp.role_id = r.id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE p.code LIKE 'research_queries.%' AND r.code IN ('admin', 'research_agent')
     ORDER BY r.code, p.code`
  );
  assert.deepEqual(rows.map((row) => `${row.role}:${row.permission}`), [
    'admin:research_queries.manage',
    'admin:research_queries.read',
    'research_agent:research_queries.read'
  ]);
});

test('QC-06 admin bisa mematikan agent tanpa menghapus konfigurasi', async () => {
  const disabled = await api('/api/v1/research-query-config', {
    method: 'PUT',
    body: JSON.stringify({
      queries: [String(original.queries).split('|')[0]],
      mapel: original.mapel_code,
      jenjang: original.jenjang_kode,
      max_questions: original.max_questions,
      is_enabled: false,
      max_searches: original.max_searches,
      max_results_per_query: original.max_results_per_query,
      max_output_tokens: original.max_output_tokens,
      max_runs_per_month: original.max_runs_per_month
    })
  });
  assert.equal(disabled.status, 200, JSON.stringify(disabled.body));
  assert.equal(disabled.body.data.config.is_enabled, false);

  const started = await api('/api/v1/research-agent-usage/start', {
    method: 'POST', body: JSON.stringify({})
  });
  assert.equal(started.status, 200, JSON.stringify(started.body));
  assert.equal(started.body.data.allowed, false);
  assert.equal(started.body.data.reason, 'disabled');
});

test('QC-07 kuota bulanan menahan siklus berikutnya dan finish mencatat pemakaian', async () => {
  const current = await api('/api/v1/research-agent-usage');
  assert.equal(current.status, 200, JSON.stringify(current.body));
  const runsBefore = current.body.data.usage.runs;

  const enabled = await api('/api/v1/research-query-config', {
    method: 'PUT',
    body: JSON.stringify({
      queries: [String(original.queries).split('|')[0]],
      mapel: original.mapel_code,
      jenjang: original.jenjang_kode,
      max_questions: original.max_questions,
      is_enabled: true,
      max_searches: original.max_searches,
      max_results_per_query: original.max_results_per_query,
      max_output_tokens: original.max_output_tokens,
      max_runs_per_month: runsBefore + 1
    })
  });
  assert.equal(enabled.status, 200, JSON.stringify(enabled.body));

  const first = await api('/api/v1/research-agent-usage/start', {
    method: 'POST', body: JSON.stringify({})
  });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.data.allowed, true, JSON.stringify(first.body));

  const second = await api('/api/v1/research-agent-usage/start', {
    method: 'POST', body: JSON.stringify({})
  });
  assert.equal(second.status, 200, JSON.stringify(second.body));
  assert.equal(second.body.data.allowed, false);
  assert.equal(second.body.data.reason, 'monthly_cap');

  const finished = await api('/api/v1/research-agent-usage/finish', {
    method: 'POST', body: JSON.stringify({ searches: 2, questions: 3 })
  });
  assert.equal(finished.status, 200, JSON.stringify(finished.body));
  assert.ok(Number(finished.body.data.usage.searches) >= 2);
});
