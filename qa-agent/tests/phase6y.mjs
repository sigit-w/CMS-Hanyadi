import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  adminHeaders,
  API_BASE,
  PRESENTATION_BASE,
  participantLogin,
  cookieHeader
} from './auth-helper.mjs';
import { query, pool } from '../../backend-agent/src/db.js';

const suffix = crypto.randomBytes(6).toString('hex');
const bindSheetCodeSuffix = String(crypto.randomInt(0, 10000)).padStart(4, '0');
const mtkaSheetCodeSuffix = String((Number(bindSheetCodeSuffix) + crypto.randomInt(1, 10000)) % 10000).padStart(4, '0');
const participantName = `QA6Y Peserta ${suffix}`;
const participantEmail = `qa6y-${suffix}@example.test`;
const participantPassword = crypto.randomBytes(18).toString('base64url');
const participantWa = `0814${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
let eventSlug;

let smaJenjangId;
let participantId;
let participantUsername;
let tryoutId;
let sessionIds = [];
let sessionSlug;
let headers;
const questionIds = [];
const sheetIds = [];

async function api(pathname, options = {}, headersOverride = null) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(headersOverride ?? (await adminHeaders())),
      ...(options.headers ?? {})
    }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function createQuestion(mapel, stem) {
  const created = await api('/api/v1/questions', {
    method: 'POST',
    body: JSON.stringify({
      stem,
      jenjang: 'SD',
      mapel,
      question_type: 'multiple_choice',
      options: [
        { key: 'A', content: 'Salah', is_correct: false },
        { key: 'B', content: 'Benar', is_correct: true }
      ],
      correct_key: 'B'
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  return Number(created.body.data.question.id);
}

async function createSheet(mapel, code, question) {
  const created = await api('/api/v1/question-sheets', {
    method: 'POST',
    body: JSON.stringify({
      name: `QA6Y Lembar ${mapel} ${suffix}`,
      code: `LS-${mapel}-SD-${mapel === 'BIND' ? bindSheetCodeSuffix : mtkaSheetCodeSuffix}`,
      jenjang: 'SD',
      mapel_code: mapel,
      description: `Lembar uji ${code}`,
      duration_minutes: 30,
      question_ids: [question]
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  return Number(created.body.data.sheet.id);
}

before(async () => {
  const health = await fetch(`${API_BASE}/health`);
  assert.equal(health.status, 200);

  const jenjang = await query("SELECT id FROM jenjang WHERE kode = 'SMA'");
  smaJenjangId = Number(jenjang.rows[0].id);
  assert.ok(smaJenjangId);

  const bindQuestion = await createQuestion('BIND', `QA6Y BIND ${suffix}`);
  const mtkaQuestion = await createQuestion('MTKA', `QA6Y MTKA ${suffix}`);
  questionIds.push(bindQuestion, mtkaQuestion);
  sheetIds.push(await createSheet('BIND', 'BIND', bindQuestion));
  sheetIds.push(await createSheet('MTKA', 'MTKA', mtkaQuestion));

  const createdParticipant = await api('/api/v1/participants', {
    method: 'POST',
    body: JSON.stringify({
      jenis: 'siswa',
      nama: participantName,
      email: participantEmail,
      kelas: 9,
      sekolah: 'SMA QA 6Y',
      wa_orang_tua: participantWa,
      jenjang_id: smaJenjangId,
      password: participantPassword
    })
  });
  assert.equal(createdParticipant.status, 201, JSON.stringify(createdParticipant.body));
  participantId = Number(createdParticipant.body.data.participant.id);
  participantUsername = createdParticipant.body.data.participant.username;
});

after(async () => {
  if (tryoutId) await query('DELETE FROM tryout_events WHERE id = $1', [tryoutId]);
  if (participantId) {
    await query('DELETE FROM auth_sessions WHERE participant_id = $1', [participantId]);
    await query('DELETE FROM siswa WHERE id = $1', [participantId]);
  }
  for (const sheetId of sheetIds) await query('DELETE FROM question_sheets WHERE id = $1', [sheetId]);
  for (const questionId of questionIds) await query('DELETE FROM questions WHERE id = $1', [questionId]);
  await pool.end();
});

test('Q6Y-01 create tryout wajib sessions[] dan sheet_ids', async () => {
  const noSession = await api('/api/v1/tryouts', {
    method: 'POST',
    body: JSON.stringify({
      name: `QA6Y tanpa sesi ${suffix}`,
      slug: `qa6y-tanpa-${suffix}`,
      jenjang: 'SD',
      starts_at: '2026-11-25T08:00:00+07:00',
      ends_at: '2026-11-25T10:00:00+07:00'
    })
  });
  assert.equal(noSession.status, 400);
  assert.match(noSession.body.error.message, /sessions/i);

  const questionIdsPayload = await api('/api/v1/tryouts', {
    method: 'POST',
    body: JSON.stringify({
      name: `QA6Y question_ids ${suffix}`,
      jenjang: 'SD',
      starts_at: '2026-11-25T08:00:00+07:00',
      ends_at: '2026-11-25T10:00:00+07:00',
      sessions: [{ mapel_code: 'BIND', question_ids: [questionIds[0]] }]
    })
  });
  assert.equal(questionIdsPayload.status, 400);
  assert.match(questionIdsPayload.body.error.message, /question_ids/i);

  const emptySheet = await api('/api/v1/tryouts', {
    method: 'POST',
    body: JSON.stringify({
      name: `QA6Y sheet kosong ${suffix}`,
      jenjang: 'SD',
      starts_at: '2026-11-25T08:00:00+07:00',
      ends_at: '2026-11-25T10:00:00+07:00',
      sessions: [{ mapel_code: 'BIND', sheet_ids: [] }]
    })
  });
  assert.equal(emptySheet.status, 400);
  assert.match(emptySheet.body.error.message, /sheet_ids/i);
});

test('Q6Y-02 tryout dua sesi dibuat dengan URL sesi berbeda', async () => {
  const created = await api('/api/v1/tryouts', {
    method: 'POST',
    body: JSON.stringify({
      name: `QA6Y Tryout ${suffix}`,
      slug: eventSlug,
      jenjang: 'SD',
      starts_at: '2026-11-25T08:00:00+07:00',
      ends_at: '2026-11-26T08:00:00+07:00',
      participant_ids: [participantId],
      sessions: [
        { name: `Sesi BIND ${suffix}`, mapel_code: 'BIND', sheet_ids: [sheetIds[0]] },
        { name: `Sesi MTKA ${suffix}`, mapel_code: 'MTKA', sheet_ids: [sheetIds[1]] }
      ]
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const tryout = created.body.data.tryout;
  tryoutId = Number(tryout.id);
  eventSlug = tryout.slug;
  sessionIds = tryout.sessions.map((session) => Number(session.id));
  assert.equal(sessionIds.length, 2);
  assert.notEqual(tryout.sessions[0].slug, tryout.sessions[1].slug);
  assert.notEqual(tryout.sessions[0].slug, tryout.slug);
  sessionSlug = tryout.sessions[0].slug;
});

test('Q6Y-03 login slug sesi berhasil dan slug tryout ditolak jelas', async () => {
  const ok = await participantLogin(participantUsername, participantPassword, sessionSlug);
  assert.equal(ok.status, 200, await ok.clone().text());
  headers = { Cookie: cookieHeader(ok) };

  const me = await api('/api/v1/auth/me', {}, headers);
  assert.equal(me.status, 200);
  assert.equal(Number(me.body.data.tryout_session_id), sessionIds[0]);
  assert.equal(me.body.data.tryout_session_slug, sessionSlug);

  const legacy = await participantLogin(participantUsername, participantPassword, eventSlug);
  assert.equal(legacy.status, 401);
  const body = await legacy.json();
  assert.equal(body.error.code, 'TRYOUT_EVENT_SLUG');
  assert.match(body.error.message, /tautan tryout lama/i);
});

test('Q6Y-04 presentation hanya sesi target dan sesi lain ditolak', async () => {
  const list = await fetch(`${PRESENTATION_BASE}/api/v1/presentation/sessions`, { headers });
  assert.equal(list.status, 200);
  const body = await list.json();
  assert.equal(body.data.sessions.length, 1);
  assert.equal(Number(body.data.sessions[0].id), sessionIds[0]);

  const other = await fetch(
    `${PRESENTATION_BASE}/api/v1/presentation/questions?session_id=${sessionIds[1]}`,
    { headers }
  );
  assert.equal(other.status, 403);
  const error = await other.json();
  assert.match(error.error.message, /hanya membuka sesi yang dituju/i);
});

test('Q6Y-05 marker implementasi Fase 6y tersedia', () => {
  const page = readFileSync(new URL('../../frontend-agent/src/pages/TryoutManagement.jsx', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../../tryout-agent/app.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../../tryout-agent/index.html', import.meta.url), 'utf8');
  const auth = readFileSync(new URL('../../backend-agent/src/authRoutes.js', import.meta.url), 'utf8');
  const routes = readFileSync(new URL('../../backend-agent/src/tryoutRoutes.js', import.meta.url), 'utf8');
  const presentation = readFileSync(new URL('../../presentation-service/src/routes.js', import.meta.url), 'utf8');

  assert.ok(page.includes('URL Peserta per Sesi'));
  assert.ok(page.includes('tryoutSessionUrls('));
  assert.ok(app.includes('Tautan tryout lama tidak berlaku'));
  assert.ok(app.includes('nextSessionButton.hidden = true'));
  assert.match(html, /app\.js\?v=21/);
  assert.ok(auth.includes('TRYOUT_EVENT_SLUG'));
  assert.ok(routes.includes('question_ids tidak didukung'));
  assert.ok(presentation.includes('hanya membuka sesi yang dituju'));
});
