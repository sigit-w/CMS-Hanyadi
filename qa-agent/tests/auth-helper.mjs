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
  const { rows } = await runQuery(
    `SELECT id, slug FROM tryout_sessions
     WHERE is_active AND slug IS NOT NULL
     ORDER BY id DESC LIMIT 1`
  );
  if (!rows[0]) {
    await runQuery(
      `UPDATE tryout_sessions SET is_active = true
       WHERE id = (SELECT min(id) FROM tryout_sessions WHERE slug IS NOT NULL)
         AND NOT EXISTS (SELECT 1 FROM tryout_sessions WHERE is_active)`
    );
    const restored = await runQuery(
      `SELECT id, slug FROM tryout_sessions
       WHERE is_active AND slug IS NOT NULL
       ORDER BY id DESC LIMIT 1`
    );
    if (!restored.rows[0]) throw new Error('Tidak ada tryout aktif untuk fixture QA Fase 6s');
    return { id: restored.rows[0].id, slug: restored.rows[0].slug };
  }
  return { id: rows[0].id, slug: rows[0].slug };
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
