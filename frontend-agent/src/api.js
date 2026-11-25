const BASE = '/api/v1';

export class ApiRequestError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let refreshing = null;

async function rawRequest(path, options = {}) {
  const headers = options.body instanceof FormData
    ? { ...(options.headers ?? {}) }
    : { 'Content-Type': 'application/json', ...(options.headers ?? {}) };
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiRequestError(
      body?.error?.message ?? `HTTP ${response.status}`,
      response.status,
      body?.error?.code
    );
  }
  return body.data;
}

async function request(path, options = {}) {
  try {
    return await rawRequest(path, options);
  } catch (error) {
    if (error.status !== 401 || path.startsWith('/auth/') || path.startsWith('/login')) throw error;
    if (!refreshing) {
      refreshing = rawRequest('/auth/refresh', { method: 'POST' })
        .finally(() => { refreshing = null; });
    }
    try {
      await refreshing;
    } catch {
      throw error;
    }
    return rawRequest(path, options);
  }
}

async function blobRequest(path) {
  const fetchBlob = async () => {
    const response = await fetch(`${BASE}${path}`, { credentials: 'include' });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new ApiRequestError(
        body?.error?.message ?? `HTTP ${response.status}`,
        response.status,
        body?.error?.code
      );
    }
    return response.blob();
  };
  try {
    return await fetchBlob();
  } catch (error) {
    if (error.status !== 401) throw error;
    if (!refreshing) {
      refreshing = rawRequest('/auth/refresh', { method: 'POST' })
        .finally(() => { refreshing = null; });
    }
    try {
      await refreshing;
    } catch {
      throw error;
    }
    return fetchBlob();
  }
}

function withQuery(path, params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }
  const search = query.toString();
  return `${path}${search ? `?${search}` : ''}`;
}

export const login = (username, password) =>
  rawRequest('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
export const logout = () => rawRequest('/auth/logout', { method: 'POST' });
export const getMe = () => request('/auth/me');
export const getMapels = (params) => {
  const query = new URLSearchParams(params).toString();
  return request(`/mapels${query ? `?${query}` : ''}`);
};
export const createMapel = (payload) =>
  request('/mapels', { method: 'POST', body: JSON.stringify(payload) });
export const updateMapel = (id, payload) =>
  request(`/mapels/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteMapel = (id) => request(`/mapels/${id}`, { method: 'DELETE' });
export const getJenjangs = (params) => request(withQuery('/jenjangs', params ?? {}));
export const createJenjang = (payload) =>
  request('/jenjangs', { method: 'POST', body: JSON.stringify(payload) });
export const updateJenjang = (id, payload) =>
  request(`/jenjangs/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteJenjang = (id) => request(`/jenjangs/${id}`, { method: 'DELETE' });
export const getProgramsBelajar = () => request('/program-belajar');
export const getProgramBelajar = (id) => request(`/program-belajar/${id}`);
export const createProgramBelajar = (payload) =>
  request('/program-belajar', { method: 'POST', body: JSON.stringify(payload) });
export const updateProgramBelajar = (id, payload) =>
  request(`/program-belajar/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteProgramBelajar = (id) => request(`/program-belajar/${id}`, { method: 'DELETE' });
export const getQuestions = (params) => {
  const query = new URLSearchParams(params).toString();
  return request(`/questions${query ? `?${query}` : ''}`);
};
export const getQuestion = (id) => request(`/questions/${id}`);
export function createQuestion(payload, imageFile = null) {
  if (!imageFile) {
    return request('/questions', { method: 'POST', body: JSON.stringify(payload) });
  }
  const form = new FormData();
  form.append('payload', JSON.stringify(payload));
  form.append('image', imageFile);
  return request('/questions', { method: 'POST', body: form });
}
export function updateQuestion(id, payload, imageFile = null) {
  if (!imageFile) {
    return request(`/questions/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  }
  const form = new FormData();
  form.append('payload', JSON.stringify(payload));
  form.append('image', imageFile);
  return request(`/questions/${id}`, { method: 'PUT', body: form });
}
export const deleteQuestion = (id) =>
  request(`/questions/${id}`, { method: 'DELETE' });
export const getQuestionSheets = (params) => {
  const query = new URLSearchParams(params).toString();
  return request(`/question-sheets${query ? `?${query}` : ''}`);
};
export const getQuestionSheet = (id) => request(`/question-sheets/${id}`);
export const getQuestionSheetCode = (mapel, jenjang) =>
  request(withQuery('/question-sheets/generate-code', { mapel, jenjang }));
export const getQuestionSheetPicker = (params) => {
  const query = new URLSearchParams(params).toString();
  return request(`/question-sheets/question-picker${query ? `?${query}` : ''}`);
};
export const createQuestionSheet = (payload) =>
  request('/question-sheets', { method: 'POST', body: JSON.stringify(payload) });
export const updateQuestionSheet = (id, payload) =>
  request(`/question-sheets/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteQuestionSheet = (id) => request(`/question-sheets/${id}`, { method: 'DELETE' });
export const getSiswa = (params) => request(withQuery('/siswa', params));
export const getParticipants = (params) => request(withQuery('/participants', params));
export const getParticipantDetail = (id) => request(`/participants/${id}/detail`);
export const createParticipant = (payload) =>
  request('/participants', { method: 'POST', body: JSON.stringify(payload) });
export const updateParticipant = (id, payload) =>
  request(`/participants/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteParticipant = (id) => request(`/participants/${id}`, { method: 'DELETE' });
export const markParticipantProspek = (id) =>
  request(`/participants/${id}/prospek`, { method: 'POST' });
export const getProspektus = (params) => request(withQuery('/prospektus', params));
export const getProspektusDetail = (id) => request(`/prospektus/${id}`);
export const registerProspektus = (id, payload) =>
  request(`/prospektus/${id}/daftar`, { method: 'POST', body: JSON.stringify(payload) });
export const updateParticipantPassword = (id, password, confirmPassword) =>
  request(`/participants/${id}/password`, {
    method: 'PUT',
    body: JSON.stringify({ password, confirm_password: confirmPassword })
  });
export const getTryouts = () => request('/tryouts');
export const getTryout = (id) => request(`/tryouts/${id}`);
export const createTryout = (payload) =>
  request('/tryouts', { method: 'POST', body: JSON.stringify(payload) });
export const updateTryout = (id, payload) =>
  request(`/tryouts/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
export const updateTryoutCbt = (id, payload) =>
  request(`/tryouts/${id}/cbt`, { method: 'PATCH', body: JSON.stringify(payload) });
export const deleteTryout = (id) => request(`/tryouts/${id}`, { method: 'DELETE' });
export const getTryoutParticipants = (tryoutId) => request(`/tryouts/${tryoutId}/participants`);
export const addTryoutParticipants = (tryoutId, participantIds) =>
  request(`/tryouts/${tryoutId}/participants`, {
    method: 'POST',
    body: JSON.stringify({ participant_ids: participantIds })
  });
export const removeTryoutParticipant = (tryoutId, participantId) =>
  request(`/tryouts/${tryoutId}/participants/${participantId}`, { method: 'DELETE' });
export const getTryoutSessions = (params = {}) => {
  const query = new URLSearchParams();
  if (params.search !== undefined && params.search !== null) query.set('search', String(params.search));
  if (params.limit !== undefined && params.limit !== null) query.set('limit', String(params.limit));
  if (params.jenjang_id !== undefined && params.jenjang_id !== null && params.jenjang_id !== '') {
    query.set('jenjang_id', String(params.jenjang_id));
  }
  const search = query.toString();
  return request(`/tryout-sessions${search ? `?${search}` : ''}`);
};
export const getTryoutEventSessions = (tryoutId) => request(`/tryouts/${tryoutId}/sessions`);
export const createTryoutSession = (payload) =>
  request('/tryout-sessions', { method: 'POST', body: JSON.stringify(payload) });
export const activateTryoutSession = (id) =>
  request(`/tryout-sessions/${id}/activate`, { method: 'PATCH' });
export const getTryoutReport = (sessionId, jenjangId) =>
  request(withQuery('/reports/tryout', { session_id: sessionId, jenjang_id: jenjangId }));
export const downloadTryoutReportExcel = (sessionId, tryoutName, jenjangId) =>
  blobRequest(withQuery('/reports/tryout/export.xlsx', {
    session_id: sessionId,
    tryout_name: tryoutName,
    jenjang_id: jenjangId
  }));
export const downloadTryoutQuestions = (tryoutId) =>
  blobRequest(`/tryouts/${tryoutId}/questions.zip`);
export const downloadTryoutQuestionsWithKeys = (tryoutId) =>
  blobRequest(`/tryouts/${tryoutId}/questions-with-keys.zip`);
export const getRoles = () => request('/roles');
export const getPermissions = () => request('/permissions');
export const updateRolePermissions = (id, permissions) =>
  request(`/roles/${id}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permissions })
  });
export const createRole = (payload) =>
  request('/roles', { method: 'POST', body: JSON.stringify(payload) });
export const deactivateRole = (id) => request(`/roles/${id}`, { method: 'DELETE' });
export const getUsers = () => request('/users');
export const createUser = (payload) =>
  request('/users', { method: 'POST', body: JSON.stringify(payload) });
export const updateUserPassword = (id, password, confirmPassword) =>
  request(`/users/${id}/password`, {
    method: 'PUT',
    body: JSON.stringify({ password, confirm_password: confirmPassword })
  });
export const getUserRoles = (id) => request(`/users/${id}/roles`);
export const assignRole = (id, code) =>
  request(`/users/${id}/roles`, { method: 'POST', body: JSON.stringify({ code }) });
export const revokeRole = (id, roleId) =>
  request(`/users/${id}/roles/${roleId}`, { method: 'DELETE' });

export async function importFile(file, type) {
  const form = new FormData();
  form.append('file', file);
  form.append('type', type);
  form.append('label', file.name);
  const response = await fetch(`${BASE}/import`, {
    method: 'POST',
    credentials: 'include',
    body: form
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiRequestError(body?.error?.message ?? `HTTP ${response.status}`, response.status, body?.error?.code);
  }
  return body.data;
}
