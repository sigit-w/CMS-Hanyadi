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
