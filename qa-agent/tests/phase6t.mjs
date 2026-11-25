import {
  adminHeaders, API_BASE, cookieHeader, participantLogin, PRESENTATION_BASE
} from './auth-helper.mjs';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pool, query } from '../../backend-agent/src/db.js';

const BACKEND = API_BASE;
const PRESENTATION = PRESENTATION_BASE;
const CMS_FILE = '/opt/virtual-office-bank-soal/frontend-agent/src/pages/TryoutManagement.jsx';
const TRYOUT_JS = '/opt/virtual-office-bank-soal/tryout-agent/app.js';
const TRYOUT_HTML = '/opt/virtual-office-bank-soal/tryout-agent/index.html';

const suffix = crypto.randomBytes(4).toString('hex');
const participantEmail = `qa_6t_${suffix}@qa.test`;
const participantPassword = crypto.randomBytes(18).toString('base64url');
const sheetIds = {};
let sheetJenjang = 'SD';
const sessionIds = [];
const eventIds = [];
const slugs = {};
let participantId;
let multiTryout;
let submitHeaders;
let cbtHeaders;
let submitQuestionIds = [];
let cbtQuestionId;

async function request(base, pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function createTryout(definition) {
  const token = crypto.randomBytes(4).toString('hex');
  const payload = { ...definition.payload };
  if (Array.isArray(payload.mapel_codes)) {
    payload.sessions = payload.mapel_codes.map((mapel_code, index) => ({
      name: `Sesi ${index + 1} ${mapel_code} ${token}`,
      mapel_code,
      sheet_ids: payload.sheet_ids ?? []
    }));
    delete payload.mapel_codes;
    delete payload.sheet_ids;
  }
  const result = await request(BACKEND, '/api/v1/tryouts', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      name: `QA 6t ${definition.key} ${token}`,
      slug: `qa-6t-${definition.key}-${token}`,
      jenjang: sheetJenjang,
      starts_at: '2026-11-25T08:00:00+07:00',
      ends_at: '2026-11-26T08:00:00+07:00',
      is_active: false,
      ...payload
    })
  });
  return result;
}

async function login(slug) {
  const response = await participantLogin(participantEmail, participantPassword, slug);
  assert.equal(response.status, 200, JSON.stringify(await response.json().catch(() => ({}))));
  return { Cookie: cookieHeader(response) };
}

before(async () => {
  for (const base of [BACKEND, PRESENTATION]) {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
  }

  const sheets = await query(
    `SELECT sh.id, m.code AS mapel_code, j.kode AS jenjang_kode
       FROM question_sheets sh
       JOIN mapels m ON m.id = sh.mapel_id
       JOIN jenjang j ON j.id = sh.jenjang_id
       WHERE sh.archived = false AND m.code = ANY($1::text[])
        AND EXISTS (
          SELECT 1 FROM question_sheet_questions qsq
          JOIN questions q ON q.id = qsq.question_id
          WHERE qsq.sheet_id = sh.id AND q.status = 'approved'
            AND q.question_type = 'multiple_choice'
        )
      ORDER BY sh.id DESC`,
    [['MTKA', 'IPAS']]);
  for (const row of sheets.rows) {
    if (!sheetIds[row.mapel_code]) sheetIds[row.mapel_code] = Number(row.id);
  }
  assert.ok(sheetIds.MTKA && sheetIds.IPAS, 'Fixture QA memerlukan satu lembar aktif MTKA dan IPAS');
  const mtkaSheet = sheets.rows.find((row) => row.mapel_code === 'MTKA');
  sheetJenjang = mtkaSheet.jenjang_kode;
  assert.ok(sheets.rows.every((row) => row.jenjang_kode === sheetJenjang));

  const createdParticipant = await request(BACKEND, '/api/v1/participants', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      nama: `QA 6t Peserta ${suffix}`,
      email: participantEmail,
      kelas: 12,
      sekolah: 'SMA Negeri 1 QA',
      password: participantPassword
    })
  });
  assert.equal(createdParticipant.status, 201, JSON.stringify(createdParticipant.body));
  participantId = createdParticipant.body.data.participant.id;

  const definitions = [
    {
      key: 'multi',
      payload: {
        mapel_codes: ['MTKA', 'IPAS'],
        sheet_ids: [sheetIds.MTKA, sheetIds.IPAS]
      }
    },
    {
      key: 'submit',
      payload: {
        mapel_codes: ['MTKA', 'IPAS'],
        sheet_ids: [sheetIds.MTKA, sheetIds.IPAS],
        participant_ids: [participantId]
      }
    },
    {
      key: 'cbt',
      payload: {
        mapel_codes: ['MTKA'],
        sheet_ids: [sheetIds.MTKA],
        participant_ids: [participantId],
        cbt_enabled: true,
        cbt_duration_minutes: 30,
        cbt_require_fullscreen: true,
        cbt_max_violations: 3
      }
    }
  ];
  for (const definition of definitions) {
    const result = await createTryout(definition);
    assert.equal(result.status, 201, JSON.stringify(result.body));
    const tryout = result.body.data.tryout;
    sessionIds.push(Number(tryout.sessions[0].id));
    eventIds.push(Number(tryout.id));
    slugs[definition.key] = tryout.sessions[0].slug;
    if (definition.key === 'multi') multiTryout = tryout;
  }

  submitHeaders = await login(slugs.submit);
  cbtHeaders = await login(slugs.cbt);

  const submitQuestions = await query(
    `SELECT tq.question_id
       FROM tryout_session_questions tq
       JOIN questions q ON q.id = tq.question_id
      WHERE tq.session_id = $1 AND q.question_type = 'multiple_choice'
      ORDER BY tq.position, tq.question_id`,
    [sessionIds[1]]
  );
  assert.ok(submitQuestions.rows.length >= 2);
  submitQuestionIds = submitQuestions.rows.slice(0, 2).map((row) => Number(row.question_id));

  const cbtQuestions = await query(
    `SELECT tq.question_id
       FROM tryout_session_questions tq
       JOIN questions q ON q.id = tq.question_id
      WHERE tq.session_id = $1 AND q.question_type = 'multiple_choice'
      ORDER BY tq.position, tq.question_id LIMIT 1`,
    [sessionIds[2]]
  );
  cbtQuestionId = Number(cbtQuestions.rows[0].question_id);
});

after(async () => {
  if (participantId) {
    await query('DELETE FROM auth_sessions WHERE participant_id = $1', [participantId]);
  }
  if (sessionIds.length) {
    await query(
      'DELETE FROM tryout_submissions WHERE participant_id = $1 OR session_id = ANY($2::bigint[])',
      [participantId, sessionIds]
    );
  }
  if (eventIds.length) {
    await query('DELETE FROM tryout_events WHERE id = ANY($1::bigint[])', [eventIds]);
  }
  if (participantId) {
    await query('DELETE FROM tryout_participants WHERE id = $1', [participantId]);
  }
  await pool.end();
});

test('Q6T-01 dua mapel dibuat sebagai dua sesi terpisah', async () => {
  const detail = await request(BACKEND, `/api/v1/tryouts/${multiTryout.id}`, {
    headers: await adminHeaders()
  });
  assert.equal(detail.status, 200, JSON.stringify(detail.body));
  const tryout = detail.body.data.tryout;
  assert.deepEqual(tryout.mapels.map((item) => item.code).sort(), ['IPAS', 'MTKA']);
  assert.equal(tryout.sessions.length, 2);
  assert.deepEqual([...new Set(tryout.sessions.map((session) => session.mapel_code))].sort(),
    ['IPAS', 'MTKA']);
  assert.equal(tryout.sheet_ids.length, 2);

  const rows = await query(
    `SELECT tsm.session_id, m.code
       FROM tryout_session_mapels tsm
       JOIN mapels m ON m.id = tsm.mapel_id
      WHERE tsm.session_id = ANY($1::bigint[])
      ORDER BY tsm.session_id, m.code`,
    [tryout.sessions.map((session) => Number(session.id))]
  );
  assert.equal(rows.rows.length, 2);
  assert.deepEqual(rows.rows.map((row) => row.code).sort(), ['IPAS', 'MTKA']);
});

test('Q6T-02 mapel ganda dan konflik mapel_code ditolak', async () => {
  const duplicate = await createTryout({
    name: 'duplikat',
    payload: {
      sessions: [
        { mapel_code: 'MTKA', sheet_ids: [sheetIds.MTKA] },
        { mapel_code: 'MTKA', sheet_ids: [sheetIds.MTKA] }
      ]
    }
  });
  assert.equal(duplicate.status, 400, JSON.stringify(duplicate.body));
  assert.match(duplicate.body.error.message, /mapel ganda/);

  const conflict = await createTryout({
    name: 'konflik',
    payload: {
      mapel_code: 'MTKA',
      sessions: [{ mapel_code: 'IPAS', sheet_ids: [sheetIds.IPAS] }]
    }
  });
  assert.equal(conflict.status, 400, JSON.stringify(conflict.body));
  assert.match(conflict.body.error.message, /mapel_code tidak didukung/);
});

test('Q6T-03 lembar dari mapel yang tidak dipilih ditolak', async () => {
  const result = await createTryout({
    name: 'lembar asing',
    payload: {
      sessions: [{ mapel_code: 'MTKA', sheet_ids: [sheetIds.MTKA, sheetIds.IPAS] }]
    }
  });
  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.match(result.body.error.message, /Sebagian lembar soal tidak ditemukan, diarsipkan, atau bukan mapel sesi ini/);
});

test('Q6T-04 submit-all non-CBT mengirim semua jawaban tanpa feedback', async () => {
  const answers = submitQuestionIds.map((questionId) => ({ question_id: questionId, answer: 'A' }));
  const submitted = await request(PRESENTATION, '/api/v1/presentation/attempts/submit-all', {
    method: 'POST',
    headers: submitHeaders,
    body: JSON.stringify({ answers })
  });
  assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
  assert.equal(submitted.body.data.submitted_count, 2);
  const raw = JSON.stringify(submitted.body);
  for (const key of ['score', 'is_correct', 'correct_key', 'correct_keys', 'answer_text', 'kunci']) {
    assert.equal(raw.includes(`"${key}"`), false, `${key} tidak boleh dikirim ke peserta`);
  }

  const submissions = await query(
    `SELECT question_id, version FROM tryout_submissions
      WHERE participant_id = $1 AND session_id = $2`,
    [participantId, sessionIds[1]]
  );
  assert.equal(submissions.rows.length, 2);
  assert.ok(submissions.rows.every((row) => row.version === 'v1'));

  const duplicate = await request(PRESENTATION, '/api/v1/presentation/attempts/submit-all', {
    method: 'POST',
    headers: submitHeaders,
    body: JSON.stringify({
      answers: [
        { question_id: submitQuestionIds[0], answer: 'A' },
        { question_id: submitQuestionIds[0], answer: 'B' }
      ]
    })
  });
  assert.equal(duplicate.status, 400, JSON.stringify(duplicate.body));

  const cbt = await request(PRESENTATION, '/api/v1/presentation/attempts/submit-all', {
    method: 'POST',
    headers: cbtHeaders,
    body: JSON.stringify({ answers: [{ question_id: cbtQuestionId, answer: 'A' }] })
  });
  assert.equal(cbt.status, 409, JSON.stringify(cbt.body));
});

test('Q6T-05 respon violation memuat info pelanggaran tanpa mengubah kuota', async () => {
  const started = await request(PRESENTATION, '/api/v1/presentation/cbt/attempt/start', {
    method: 'POST',
    headers: cbtHeaders
  });
  assert.equal(started.status, 200, JSON.stringify(started.body));

  const violation = await request(PRESENTATION, '/api/v1/presentation/cbt/attempt/violation', {
    method: 'POST',
    headers: cbtHeaders,
    body: JSON.stringify({ violation_type: 'fullscreen_exit', detail: { source: 'qa-6t' } })
  });
  assert.equal(violation.status, 200, JSON.stringify(violation.body));
  assert.equal(violation.body.data.type, 'fullscreen_exit');
  assert.equal(violation.body.data.violation_count, 1);
  assert.equal(violation.body.data.max_violations, 3);
  assert.equal(violation.body.data.limit, 3);
  assert.equal(violation.body.data.status, 'in_progress');

  const quota = await query(
    'SELECT id, cbt_max_violations FROM tryout_sessions WHERE id = ANY($1::bigint[])',
    [[sessionIds[2], 271]]
  );
  assert.equal(quota.rows.length, 2);
  assert.ok(quota.rows.every((row) => Number(row.cbt_max_violations) === 3));
});

test('Q6T-06 marker frontend bersesi, toast, dan asset terbaru', () => {
  const cms = readFileSync(CMS_FILE, 'utf8');
  assert.match(cms, /sessions/);
  assert.match(cms, /mapel_code/);
  assert.doesNotMatch(cms, /mapel_codes/);
  assert.doesNotMatch(cms, /jadikan sesi aktif/i);
  assert.doesNotMatch(cms, /jenis\s*===\s*['"]siswa['"]/);

  const table = cms.slice(cms.indexOf('Daftar Tryout'));
  assert.doesNotMatch(table, /Lembar/);
  assert.doesNotMatch(table, /Submission/);

  const js = readFileSync(TRYOUT_JS, 'utf8');
  assert.doesNotMatch(js, /presentation\/questions\/\$\{[^}]+\}\/submit/);
  assert.doesNotMatch(js, /presentation\/questions\/[^\s'"`]+\/submit/);
  assert.match(js, /Pelanggaran tercatat:/);

  const html = readFileSync(TRYOUT_HTML, 'utf8');
  assert.match(html, /app\.js\?v=21/);
});
