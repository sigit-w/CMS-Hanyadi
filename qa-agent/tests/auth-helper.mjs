export const API_BASE = process.env.QA_API_BASE || 'http://127.0.0.1:8082';
export const PRESENTATION_BASE = process.env.QA_PRESENTATION_BASE || 'http://127.0.0.1:8083';

const BASE = API_BASE;

let cachedCookie = null;

export async function adminHeaders(extra = {}) {
  if (!cachedCookie) {
    const username = process.env.QA_ADMIN_USERNAME || 'admin';
    const password = process.env.QA_ADMIN_PASSWORD;
    if (!password) throw new Error('QA_ADMIN_PASSWORD wajib diset untuk menjalankan test Fase 6');
    const response = await fetch(`${BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!response.ok) throw new Error(`Login QA gagal: ${response.status}`);
    const cookies = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie')];
    cachedCookie = cookies.filter(Boolean).map((item) => item.split(';')[0]).join('; ');
  }
  return { Cookie: cachedCookie, ...extra };
}

export async function adminCookie() {
  return (await adminHeaders()).Cookie;
}

export async function activeTryoutContext(runQuery) {
  const activeWithQuestions = `
    SELECT id, slug FROM tryout_sessions
    WHERE is_active AND slug IS NOT NULL
      AND EXISTS (SELECT 1 FROM tryout_session_questions q WHERE q.session_id = tryout_sessions.id)
    ORDER BY id DESC LIMIT 1`;
  const refreshWindow = async (id) => {
    await runQuery(
      `UPDATE tryout_events
       SET starts_at = now() - interval '1 hour', ends_at = now() + interval '2 hours'
       WHERE id = (SELECT event_id FROM tryout_sessions WHERE id = $1)`,
      [id]
    );
    await runQuery(
      `UPDATE tryout_sessions
       SET start_at = now() - interval '1 hour', end_at = now() + interval '2 hours',
           session_date = (now() AT TIME ZONE 'Asia/Jakarta')::date
       WHERE id = $1`,
      [id]
    );
  };
  const { rows } = await runQuery(activeWithQuestions);
  if (rows[0]) {
    await refreshWindow(rows[0].id);
    return { id: rows[0].id, slug: rows[0].slug };
  }
  const { rows: candidates } = await runQuery(
    `SELECT s.id, s.slug FROM tryout_sessions s
     WHERE s.slug IS NOT NULL
       AND EXISTS (SELECT 1 FROM tryout_session_questions q WHERE q.session_id = s.id)
     ORDER BY s.id DESC LIMIT 1`
  );
  if (!candidates[0]) throw new Error('Tidak ada tryout aktif untuk fixture QA Fase 6s');
  await refreshWindow(candidates[0].id);
  await runQuery('UPDATE tryout_sessions SET is_active = false WHERE is_active');
  await runQuery('UPDATE tryout_sessions SET is_active = true WHERE id = $1', [candidates[0].id]);
  const restored = await runQuery(activeWithQuestions);
  if (!restored.rows[0]) throw new Error('Tidak ada tryout aktif untuk fixture QA Fase 6s');
  return { id: restored.rows[0].id, slug: restored.rows[0].slug };
}

export async function attachQaParticipants(runQuery, tryoutId, participantIds) {
  const ids = participantIds.filter(Boolean).map(Number);
  if (!ids.length) return;
  await runQuery(
    `INSERT INTO tryout_session_participants (session_id, participant_id)
     SELECT $1, item FROM unnest($2::bigint[]) AS t(item)
     ON CONFLICT (session_id, participant_id) DO NOTHING`,
    [tryoutId, ids]
  );
}

export async function participantLogin(username, password, tryoutSlug) {
  return fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, tryout_slug: tryoutSlug })
  });
}

export function cookieHeader(response) {
  const cookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')];
  return cookies.filter(Boolean).map((item) => item.split(';')[0]).join('; ');
}
