import {
  activeTryoutContext, adminHeaders, API_BASE, attachQaParticipants,
  cookieHeader, participantLogin, PRESENTATION_BASE
} from './auth-helper.mjs';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { query, pool } from '../../backend-agent/src/db.js';

const BACKEND = API_BASE;
const PRESENTATION = PRESENTATION_BASE;
const suffix = crypto.randomBytes(4).toString('hex');
const participantEmail = `qa_tr_participant_${suffix}@qa.test`;
const viewerUsername = `qa_tr_viewer_${suffix}`;
const password = crypto.randomBytes(18).toString('base64url');
const sessionDate = new Date().toISOString().slice(0, 10);

const usernames = [viewerUsername];
const questionIds = [];
const sessionIds = [];
let participantHeaders;
let viewerHeaders;
let sessionId;
let eventId;
let qaTryout;
let participantId;

async function request(base, pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body, headers: response.headers };
}

async function createUser(username, role) {
  const response = await request(BACKEND, '/api/v1/users', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      username,
      display_name: `QA ${role} ${suffix}`,
      password,
      roles: [role]
    })
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
}

async function login(username) {
  const response = await request(BACKEND, '/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const cookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')];
  return { Cookie: cookies.filter(Boolean).map((item) => item.split(';')[0]).join('; ') };
}

function mcPayload(stem) {
  return {
    stem,
    mapel: 'MTKA',
    question_type: 'multiple_choice',
    difficulty: 'easy',
    options: [
      { key: 'A', content: 'Salah', is_correct: false },
      { key: 'B', content: 'Benar', is_correct: true }
    ],
    correct_key: 'B',
    explanation: `Pembahasan ${stem}`
  };
}

async function createQuestion(stem) {
  const response = await request(BACKEND, '/api/v1/questions', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify(mcPayload(stem))
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const id = response.body.data.question.id;
  questionIds.push(id);
  assert.equal(response.body.data.question.status, 'approved');
  return id;
}

before(async () => {
  for (const base of [BACKEND, PRESENTATION]) {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
  }
  qaTryout = await activeTryoutContext(query);
  const participant = await request(BACKEND, '/api/v1/participants', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      nama: `QA peserta ${suffix}`,
      email: participantEmail,
      kelas: 12,
      sekolah: 'SMA Negeri 1 QA',
      password
    })
  });
  assert.equal(participant.status, 201, JSON.stringify(participant.body));
  participantId = participant.body.data.participant.id;
  await createUser(viewerUsername, 'viewer');
  viewerHeaders = await login(viewerUsername);
  await createQuestion(`QA sesi benar ${suffix}`);
  await createQuestion(`QA sesi salah ${suffix}`);

  const eventName = `QA TR Event ${suffix}`;
  const event = await query(
    `INSERT INTO tryout_events (name, slug, starts_at, ends_at)
     VALUES ($1, $2, now() - interval '1 hour', now() + interval '2 hours')
     RETURNING id`,
    [eventName, `qa-tr-event-${suffix}`]
  );
  eventId = Number(event.rows[0].id);

  const created = await request(BACKEND, '/api/v1/tryout-sessions', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      name: `Sesi QA ${suffix}`,
      session_date: sessionDate,
      event_id: eventId,
      is_active: true
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  sessionId = created.body.data.session.id;
  sessionIds.push(sessionId);
  await attachQaParticipants(query, sessionId, [participantId]);
  await query(
    `INSERT INTO tryout_session_questions (session_id, question_id, position)
     SELECT $1, item, ordinal - 1 FROM unnest($2::bigint[]) WITH ORDINALITY AS t(item, ordinal)`,
    [sessionId, questionIds]
  );
  const participantLoginResult = await participantLogin(
    participantEmail, password, created.body.data.session.slug
  );
  assert.equal(participantLoginResult.status, 200, JSON.stringify(created.body));
  participantHeaders = { Cookie: cookieHeader(participantLoginResult) };
});

after(async () => {
  if (questionIds.length) {
    const sources = await query(
      'SELECT DISTINCT source_id FROM questions WHERE id = ANY($1::bigint[]) AND source_id IS NOT NULL',
      [questionIds]
    );
    await query('DELETE FROM questions WHERE id = ANY($1::bigint[])', [questionIds]);
    const sourceIds = sources.rows.map((row) => row.source_id);
    if (sourceIds.length) {
      await query('DELETE FROM question_sources WHERE id = ANY($1::bigint[])', [sourceIds]);
    }
  }
  if (sessionIds.length) {
    await query('DELETE FROM auth_sessions WHERE tryout_session_id = ANY($1::bigint[])', [sessionIds]);
    await query('DELETE FROM tryout_sessions WHERE id = ANY($1::bigint[])', [sessionIds]);
  }
  if (eventId) await query('DELETE FROM tryout_events WHERE id = $1', [eventId]);
  await query(
    `UPDATE tryout_sessions SET is_active = true
     WHERE id = (SELECT min(id) FROM tryout_sessions)
       AND NOT EXISTS (SELECT 1 FROM tryout_sessions WHERE is_active)`
  );
  await query('DELETE FROM contributors WHERE username = ANY($1::text[])', [usernames]);
  await query('DELETE FROM tryout_participants WHERE email = $1', [participantEmail]);
  await pool.end();
});

test('TR-01 permission tryout_reports.read mengatur akses laporan dan aktivasi sesi', async () => {
  const permissions = await request(BACKEND, '/api/v1/permissions', {
    headers: await adminHeaders()
  });
  assert.equal(permissions.status, 200);
  assert.ok(permissions.body.data.permissions.some((item) => item.code === 'tryout_reports.read'));

  const denied = await request(BACKEND, '/api/v1/reports/tryout', { headers: viewerHeaders });
  assert.equal(denied.status, 403, JSON.stringify(denied.body));

  const created = await request(BACKEND, '/api/v1/tryout-sessions', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      name: `Sesi QA cadangan ${suffix}`,
      session_date: sessionDate,
      event_id: eventId,
      is_active: false
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const temporaryId = created.body.data.session.id;
  sessionIds.push(temporaryId);

  const activated = await request(BACKEND, `/api/v1/tryout-sessions/${temporaryId}/activate`, {
    method: 'PATCH',
    headers: await adminHeaders()
  });
  assert.equal(activated.status, 200, JSON.stringify(activated.body));
  assert.equal(activated.body.data.session.is_active, true);

  const restored = await request(BACKEND, `/api/v1/tryout-sessions/${sessionId}/activate`, {
    method: 'PATCH',
    headers: await adminHeaders()
  });
  assert.equal(restored.status, 200, JSON.stringify(restored.body));
});

test('TR-02 submission tersimpan pada sesi aktif tanpa feedback ke peserta', async () => {
  const correctSubmit = await request(
    PRESENTATION,
    `/api/v1/presentation/questions/${questionIds[0]}/submit`,
    {
      method: 'POST',
      headers: participantHeaders,
      body: JSON.stringify({ answer: 'B' })
    }
  );
  assert.equal(correctSubmit.status, 200, JSON.stringify(correctSubmit.body));
  assert.equal(correctSubmit.body.data.correct, undefined);
  assert.equal(correctSubmit.body.data.explanation, undefined);
  assert.equal(correctSubmit.body.data.submission.is_correct, undefined);

  const wrongSubmit = await request(
    PRESENTATION,
    `/api/v1/presentation/questions/${questionIds[1]}/submit`,
    {
      method: 'POST',
      headers: participantHeaders,
        body: JSON.stringify({ answer: 'A' })
    }
  );
  assert.equal(wrongSubmit.status, 200, JSON.stringify(wrongSubmit.body));
  assert.equal(wrongSubmit.body.data.correct, undefined);

  const stored = await query(
    'SELECT question_id, session_id, is_correct FROM tryout_submissions WHERE question_id = ANY($1::bigint[]) ORDER BY question_id',
    [questionIds]
  );
  assert.equal(stored.rows.length, 2);
  assert.ok(stored.rows.every((row) => Number(row.session_id) === Number(sessionId)));
  assert.deepEqual(stored.rows.map((row) => row.is_correct), [true, false]);
});

test('TR-03 laporan mengelompokkan benar, salah, dan skor per sesi peserta mapel', async () => {
  const response = await request(BACKEND, `/api/v1/reports/tryout?session_id=${sessionId}`, {
    headers: await adminHeaders()
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const sessionCodes = response.body.data.sessions.map((item) => Number(item.id));
  assert.ok(sessionCodes.includes(Number(sessionId)), JSON.stringify(response.body.data.sessions));
  const row = response.body.data.summary.find((item) => Number(item.session_id) === Number(sessionId));
  assert.ok(row, JSON.stringify(response.body.data.summary));
  assert.equal(row.participant, `QA peserta ${suffix}`);
  assert.equal(row.kelas, 12);
  assert.equal(row.sekolah, 'SMA Negeri 1 QA');
  assert.equal(row.mapel, 'Matematika');
  assert.equal(row.correct, 1);
  assert.equal(row.wrong, 1);
  assert.equal(Number(row.score), 50);
});

test('TR-04 detail laporan menampilkan jawaban peserta dibandingkan kunci', async () => {
  const response = await request(BACKEND, `/api/v1/reports/tryout?session_id=${sessionId}`, {
    headers: await adminHeaders()
  });
  assert.equal(response.status, 200);
  const details = response.body.data.details;
  assert.equal(details.length, 2);
  const correctRow = details.find((item) => item.question_id === questionIds[0]);
  const wrongRow = details.find((item) => item.question_id === questionIds[1]);
  assert.equal(correctRow.user_answer, 'B');
  assert.equal(correctRow.correct_answer, 'B');
  assert.equal(correctRow.is_correct, true);
  assert.equal(wrongRow.user_answer, 'A');
  assert.equal(wrongRow.correct_answer, 'B');
  assert.equal(wrongRow.is_correct, false);
});

test('TR-05 endpoint tryouts membuat TO beserta soal dan peserta dengan RBAC', async () => {
  const denied = await request(BACKEND, '/api/v1/tryouts', { headers: viewerHeaders });
  assert.equal(denied.status, 403, JSON.stringify(denied.body));

  const users = await query('SELECT id FROM tryout_participants WHERE email = $1', [participantEmail]);
  const participantId = users.rows[0].id;

  const created = await request(BACKEND, '/api/v1/tryouts', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      name: `TO QA ${suffix}`,
      session_date: sessionDate,
      mapel_code: 'MTKA',
      question_ids: questionIds,
      participant_ids: [participantId],
      is_active: false
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const tryout = created.body.data.tryout;
  sessionIds.push(tryout.id);
  assert.equal(tryout.mapel_code, 'MTKA');
  assert.equal(tryout.question_ids.length, 2);
  assert.ok(tryout.participant_ids.some((id) => Number(id) === Number(participantId)));

  const detail = await request(BACKEND, `/api/v1/tryouts/${tryout.id}`, {
    headers: await adminHeaders()
  });
  assert.equal(detail.status, 200, JSON.stringify(detail.body));
  assert.equal(detail.body.data.tryout.question_ids.length, 2);

  const listing = await request(BACKEND, '/api/v1/tryouts', { headers: await adminHeaders() });
  assert.equal(listing.status, 200);
  assert.ok(listing.body.data.tryouts.some((item) => Number(item.id) === Number(tryout.id)));
  const listed = listing.body.data.tryouts.find((item) => Number(item.id) === Number(tryout.id));
  assert.equal(listed.question_count, 2);
  assert.equal(listed.participant_count, 1);

  const wrongMapel = await request(BACKEND, '/api/v1/tryouts', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      name: `TO QA salah mapel ${suffix}`,
      session_date: sessionDate,
      mapel_code: 'IPAS',
      question_ids: questionIds,
      participant_ids: [participantId]
    })
  });
  assert.equal(wrongMapel.status, 400, JSON.stringify(wrongMapel.body));

  const wrongParticipant = await request(BACKEND, '/api/v1/tryouts', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      name: `TO QA peserta invalid ${suffix}`,
      session_date: sessionDate,
      mapel_code: 'MTKA',
      question_ids: questionIds,
      participant_ids: [99999999]
    })
  });
  assert.equal(wrongParticipant.status, 400, JSON.stringify(wrongParticipant.body));
});

test('TR-06 daftar soal dan submit mengikuti soal/peserta TO aktif', async () => {
  const startsAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const endsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const created = await request(BACKEND, '/api/v1/tryouts', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      name: `TO aktif QA ${suffix}`,
      session_date: sessionDate,
      start_at: startsAt,
      end_at: endsAt,
      mapel_code: 'MTKA',
      question_ids: [questionIds[0]],
      participant_ids: [participantId],
      is_active: true
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const activeTryout = created.body.data.tryout;
  sessionIds.push(activeTryout.id);

  const boundLogin = await participantLogin(
    participantEmail, password, activeTryout.slug
  );
  assert.equal(boundLogin.status, 200, await boundLogin.clone().text());
  const boundHeaders = { Cookie: cookieHeader(boundLogin) };

  const list = await request(BACKEND, '/api/v1/tryout/questions?limit=100', {
    headers: boundHeaders
  });
  assert.equal(list.status, 200, JSON.stringify(list.body));
  assert.ok(list.body.data, JSON.stringify(list.body));
  const ids = list.body.data.questions.map((item) => String(item.id));
  assert.ok(ids.includes(String(questionIds[0])));
  assert.ok(!ids.includes(String(questionIds[1])));

  const blockedQuestion = await request(
    PRESENTATION,
    `/api/v1/presentation/questions/${questionIds[1]}/submit`,
    {
      method: 'POST',
      headers: boundHeaders,
      body: JSON.stringify({ answer: 'B' })
    }
  );
  assert.equal(blockedQuestion.status, 403, JSON.stringify(blockedQuestion.body));

  const blockedUser = await request(
    PRESENTATION,
    `/api/v1/presentation/questions/${questionIds[0]}/submit`,
    {
      method: 'POST',
      headers: viewerHeaders,
      body: JSON.stringify({ answer: 'B' })
    }
  );
  assert.equal(blockedUser.status, 403, JSON.stringify(blockedUser.body));

  const allowed = await request(
    PRESENTATION,
    `/api/v1/presentation/questions/${questionIds[0]}/submit`,
    {
      method: 'POST',
      headers: boundHeaders,
      body: JSON.stringify({ answer: 'B' })
    }
  );
  assert.equal(allowed.status, 200, JSON.stringify(allowed.body));
});
