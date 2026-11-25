(() => {
  const API = '/api/v1';
  const IMAGE_ONLY_STEM = '[Gambar soal]';
  const RESERVED_SLUGS = new Set([
    'api', 'assets', 'health', 'favicon.ico', 'robots.txt', 'login', 'admin', 'tryout'
  ]);
  const TRYOUT_SLUG = resolveTryoutSlug();
  const state = {
    sessions: [],
    activeSessionId: null,
    questions: [],
    page: 1,
    total: 0,
    activeId: null,
    answers: {},
    answerPayloads: {},
    answerMeta: {},
    activeDetail: null,
    cbtMode: false,
    attempt: null,
    flags: new Set(),
    locked: false,
    timerId: null,
    fullscreenArmed: false,
    pendingSaves: new Set(),
    lastFocusLossAt: 0,
    suppressFocusViolations: false
  };

  const elements = {
    listStatus: document.getElementById('listStatus'),
    sessionTabs: document.getElementById('sessionTabs'),
    completionPanel: document.getElementById('completionPanel'),
    completionMessage: document.getElementById('completionMessage'),
    nextSessionButton: document.getElementById('nextSessionButton'),
    exitSessionButton: document.getElementById('exitSessionButton'),
    questionList: document.getElementById('questionList'),
    loadMore: document.getElementById('loadMore'),
    questionBody: document.getElementById('questionBody'),
    nav: document.getElementById('nav'),
    toast: document.getElementById('toast'),
    loginGate: document.getElementById('loginGate'),
    loginForm: document.getElementById('loginForm'),
    loginUsername: document.getElementById('loginUsername'),
    loginPassword: document.getElementById('loginPassword'),
    loginError: document.getElementById('loginError'),
    tryoutSlugLabel: document.getElementById('tryoutSlugLabel'),
    loginButton: document.getElementById('loginButton'),
    appHeader: document.getElementById('appHeader'),
    appMain: document.getElementById('appMain'),
    userLabel: document.getElementById('userLabel'),
    logoutButton: document.getElementById('logoutButton'),
    timerDisplay: document.getElementById('timerDisplay'),
    cbtStatus: document.getElementById('cbtStatus'),
    finalizeButton: document.getElementById('finalizeButton'),
    fullscreenButton: document.getElementById('fullscreenButton')
  };

  function resolveTryoutSlug() {
    const first = window.location.pathname.split('/').filter(Boolean)[0] || '';
    if (!first || RESERVED_SLUGS.has(first.toLowerCase())) return null;
    const slug = first.toLowerCase();
    return /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(slug) ? slug : null;
  }

  class SessionError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }

  function toast(message, isError = false) {
    elements.toast.textContent = message;
    elements.toast.className = isError ? 'toast error' : 'toast ok';
    elements.toast.hidden = false;
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => { elements.toast.hidden = true; }, 3500);
  }

  function askConfirmation(message) {
    const previous = state.suppressFocusViolations;
    state.suppressFocusViolations = true;
    try {
      return window.confirm(message);
    } finally {
      state.suppressFocusViolations = previous;
    }
  }

  function renderFinalizeButton() {
    elements.finalizeButton.textContent = isCbt() ? 'Selesai & Kumpulkan' : 'Kirim Semua Jawaban';
    elements.finalizeButton.hidden = state.locked;
  }

  async function api(path, options = {}) {
    const response = await fetch(`${API}${path}`, { credentials: 'include', ...options });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) {
      throw new SessionError(body?.error?.message ?? `HTTP ${response.status}`, response.status);
    }
    if (!response.ok) {
      const error = new Error(body?.error?.message ?? `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return body.data;
  }

  function sessionMessage(error) {
    const message = String(error?.message ?? '');
    if (/tautan|sesi|link/i.test(message)) return message;
    return error.status === 403
      ? 'Akun Anda tidak memiliki akses tryout.'
      : 'Sesi berakhir. Silakan masuk kembali.';
  }

  function withSession(payload = {}) {
    const result = { ...payload };
    if (state.activeSessionId != null) result.session_id = state.activeSessionId;
    return result;
  }

  function sessionQuery(prefix) {
    return state.activeSessionId == null
      ? ''
      : `${prefix}session_id=${encodeURIComponent(state.activeSessionId)}`;
  }

  function activeSession() {
    return state.sessions.find((session) => Number(session.id) === Number(state.activeSessionId)) ?? null;
  }

  function nextSession() {
    return state.sessions.find((session) => !session.completed
      && Number(session.id) !== Number(state.activeSessionId)) ?? null;
  }

  function questionId(question) {
    return question?.question_id ?? question?.id;
  }

  function isCbt() {
    return state.cbtMode;
  }

  function showLogin(message = '') {
    elements.appHeader.hidden = true;
    elements.appMain.hidden = true;
    elements.loginGate.hidden = false;
    elements.loginError.hidden = !message;
    elements.loginError.textContent = message;
    elements.loginPassword.value = '';
    elements.completionPanel.hidden = true;
  }

  function showApp(session) {
    elements.loginGate.hidden = true;
    elements.appHeader.hidden = false;
    elements.appMain.hidden = false;
    const sessionSlug = session.tryout_session_slug ?? TRYOUT_SLUG;
    elements.userLabel.textContent = `${session.user.username}${sessionSlug ? ` · ${sessionSlug}` : ''}`;
  }

  async function checkSession() {
    try {
      const session = await api('/auth/me');
      const sessionSlug = session.tryout_session_slug;
      if (!sessionSlug || String(sessionSlug).toLowerCase() !== TRYOUT_SLUG) {
        showLogin('Tautan tryout lama tidak berlaku. Gunakan tautan sesi yang dibagikan administrator.');
        return false;
      }
      showApp(session);
      await loadSessions(session);
      return true;
    } catch (error) {
      if (error.status === 401) showLogin();
      else showLogin(error instanceof SessionError ? sessionMessage(error) : error.message);
      return false;
    }
  }

  function normalizeSessions(data) {
    const raw = Array.isArray(data) ? data : data?.sessions ?? [];
    return raw.filter((session) => session && session.id != null).map((session) => ({
      id: Number(session.id),
      name: session.name ?? `Sesi ${session.id}`,
      slug: session.slug ?? '',
      mapel_code: session.mapel_code ?? '',
      status: session.status ?? '',
      completed: Boolean(session.completed ?? session.is_completed)
    }));
  }

  function renderSessions() {
    elements.sessionTabs.replaceChildren();
    elements.sessionTabs.hidden = true;
  }

  async function loadSessions(authSession) {
    let sessions;
    try {
      sessions = normalizeSessions(await api('/presentation/sessions'));
    } catch (error) {
      if (error instanceof SessionError) {
        showLogin(sessionMessage(error));
        return false;
      }
      if (error.status === 404 && Number(authSession?.tryout_session_id) > 0) {
        sessions = [{
          id: Number(authSession.tryout_session_id),
          name: authSession.tryout_name ?? 'Sesi tryout',
          slug: authSession.tryout_session_slug ?? authSession.tryout_slug ?? '',
          mapel_code: '',
          status: '',
          completed: false
        }];
      } else {
        elements.listStatus.textContent = 'Gagal memuat daftar sesi.';
        toast(error.message, true);
        return false;
      }
    }
    state.sessions = sessions.filter((session) =>
      (session.slug && String(session.slug).toLowerCase() === TRYOUT_SLUG)
      || Number(session.id) === Number(authSession?.tryout_session_id)
    );
    renderSessions();
    if (!sessions.length) {
      elements.listStatus.textContent = 'Sesi dari tautan ini tidak tersedia untuk akun ini.';
      elements.questionBody.textContent = 'Belum ada sesi yang dapat dikerjakan.';
      elements.questionBody.className = 'question-body empty';
      return true;
    }
    const firstOpen = state.sessions.find((session) => !session.completed);
    if (!firstOpen) {
      elements.listStatus.textContent = 'Sesi ini sudah selesai.';
      elements.questionBody.textContent = 'Sesi ini sudah selesai. Silakan keluar.';
      elements.questionBody.className = 'question-body empty';
      elements.completionMessage.textContent = 'Sesi ini selesai. Silakan keluar.';
      elements.nextSessionButton.hidden = true;
      elements.nextSessionButton.disabled = true;
      elements.completionPanel.hidden = false;
      return true;
    }
    await activateSession(firstOpen.id);
    return true;
  }

  async function activateSession(id) {
    const session = state.sessions.find((item) => Number(item.id) === Number(id));
    if (!session || session.completed) return false;
    if (session.slug && String(session.slug).toLowerCase() !== TRYOUT_SLUG) return false;
    if (state.activeSessionId === session.id && !state.locked) return true;
    resetSessionState();
    state.activeSessionId = session.id;
    renderSessions();
    elements.listStatus.textContent = `Sesi ${session.name}: memuat soal…`;
    try {
      const cbtStarted = await startCbt();
      if (!cbtStarted) await loadQuestions(1);
      return true;
    } catch (error) {
      if (error instanceof SessionError) showLogin(sessionMessage(error));
      else {
        elements.listStatus.textContent = 'Gagal memuat soal sesi ini.';
        toast(error.message, true);
      }
      return false;
    }
  }

  function markSessionComplete() {
    const session = activeSession();
    if (session) session.completed = true;
    renderSessions();
    elements.nav.replaceChildren();
    elements.finalizeButton.hidden = true;
    elements.finalizeButton.disabled = false;
    elements.completionMessage.textContent = 'Sesi ini selesai. Silakan keluar.';
    elements.nextSessionButton.hidden = true;
    elements.nextSessionButton.disabled = true;
    elements.completionPanel.hidden = false;
  }

  async function continueNextSession() {
    return false;
  }

  async function handleLogin(event) {
    event.preventDefault();
    elements.loginButton.disabled = true;
    elements.loginError.hidden = true;
    try {
      await api('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: elements.loginUsername.value,
          password: elements.loginPassword.value,
          tryout_slug: TRYOUT_SLUG
        })
      });
      await checkSession();
    } catch (error) {
      const message = error instanceof SessionError
        ? error.message
        : 'Nama/email atau PIN/password salah.';
      showLogin(message);
    } finally {
      elements.loginButton.disabled = false;
    }
  }

  async function handleLogout() {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      resetExamState();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      showLogin();
    }
  }

  function resetSessionState() {
    window.clearTimeout(state.timerId);
    state.questions = [];
    state.page = 1;
    state.total = 0;
    state.activeId = null;
    state.answers = {};
    state.answerPayloads = {};
    state.answerMeta = {};
    state.activeDetail = null;
    state.cbtMode = false;
    state.attempt = null;
    state.flags = new Set();
    state.locked = false;
    state.fullscreenArmed = false;
    state.pendingSaves = new Set();
    state.lastFocusLossAt = 0;
    elements.timerDisplay.hidden = true;
    elements.finalizeButton.hidden = true;
    elements.finalizeButton.disabled = false;
    elements.fullscreenButton.hidden = true;
    elements.cbtStatus.hidden = true;
    elements.loadMore.hidden = true;
    elements.questionList.replaceChildren();
    elements.nav.replaceChildren();
    elements.questionBody.textContent = 'Pilih soal di sebelah kiri untuk mulai.';
    elements.questionBody.className = 'question-body empty';
    elements.completionPanel.hidden = true;
  }

  function resetExamState() {
    resetSessionState();
    state.sessions = [];
    state.activeSessionId = null;
    elements.sessionTabs.replaceChildren();
    elements.sessionTabs.hidden = true;
  }

  async function startCbt() {
    try {
      const payload = await api('/presentation/cbt/attempt/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withSession())
      });
      state.cbtMode = true;
      state.attempt = payload.attempt;
      state.questions = payload.questions;
      state.total = payload.questions.length;
      state.answers = payload.answers ?? {};
      state.answerPayloads = {};
      state.answerMeta = {};
      state.activeDetail = null;
      state.flags = new Set(payload.flags ?? []);
      state.locked = payload.attempt.status !== 'in_progress';
      elements.loadMore.hidden = true;
      elements.timerDisplay.hidden = false;
      elements.cbtStatus.hidden = false;
      renderFinalizeButton();
      elements.fullscreenButton.hidden = !payload.attempt.cbt_require_fullscreen || state.locked;
      renderList();
      updateTimer();
      installCbtGuards();
      if (state.questions.length) {
        await openQuestion(questionId(state.questions[0]));
      } else {
        elements.questionBody.className = 'question-body empty';
        elements.questionBody.textContent = 'Belum ada soal pada tryout ini.';
      }
      if (state.locked) lockCbt();
      return true;
    } catch (error) {
      if (error instanceof SessionError) throw error;
      if (/CBT/i.test(error.message)) return false;
      throw error;
    }
  }

  function renderList() {
    elements.questionList.replaceChildren();
    state.questions.forEach((question, idx) => {
      const id = questionId(question);
      const answer = state.answers[String(id)];
      const answered = Array.isArray(answer) ? answer.length > 0 : Boolean(answer);
      const flagged = state.flags.has(String(id));
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'question-button';
      if (id === state.activeId) button.classList.add('active');
      if (answered) button.classList.add('answered');
      if (flagged) button.classList.add('flagged');
      button.addEventListener('click', () => openQuestion(id));

      const title = document.createElement('span');
      title.className = 'question-stem';
      const stem = question.stem === IMAGE_ONLY_STEM ? 'Soal gambar' : question.stem;
      title.textContent = `${question.position ?? idx + 1}. ${stem}`;
      const meta = document.createElement('small');
      const details = [question.question_type, question.difficulty, answered ? 'Terjawab' : 'Belum dijawab'];
      if (flagged) details.push('Ragu-ragu');
      meta.textContent = details.filter(Boolean).join(' · ');
      button.append(title, meta);
      item.append(button);
      elements.questionList.append(item);
    });
    elements.listStatus.textContent = isCbt()
      ? `${state.questions.length} soal · ${state.flags.size} ditandai ragu-ragu`
      : state.questions.length
        ? `${state.questions.length} dari ${state.total} soal ditampilkan`
        : 'Belum ada soal yang tersedia.';
    elements.loadMore.hidden = isCbt() || state.questions.length >= state.total;
  }

  async function loadQuestions(page = 1, append = false) {
    elements.listStatus.textContent = 'Memuat daftar soal…';
    try {
      const data = await api(`/tryout/questions?page=${page}&limit=20${sessionQuery('&')}`);
      state.questions = append ? [...state.questions, ...data.questions] : data.questions;
      state.total = data.pagination.total;
      state.page = page;
      renderList();
      renderFinalizeButton();
    } catch (error) {
      if (error instanceof SessionError) {
        showLogin(sessionMessage(error));
        return;
      }
      elements.listStatus.textContent = 'Gagal memuat daftar soal.';
      toast(error.message, true);
    }
  }

  function renderNavigation(index) {
    elements.nav.replaceChildren();
    if (index > 0) {
      const previous = document.createElement('button');
      previous.type = 'button';
      previous.textContent = 'Sebelumnya';
      previous.addEventListener('click', () => openQuestion(questionId(state.questions[index - 1])));
      elements.nav.append(previous);
    }
    if (index < state.questions.length - 1) {
      const next = document.createElement('button');
      next.type = 'button';
      next.textContent = 'Berikutnya';
      next.addEventListener('click', () => openQuestion(questionId(state.questions[index + 1])));
      elements.nav.append(next);
    }
  }

  async function openQuestion(id) {
    state.activeId = id;
    state.activeDetail = null;
    renderList();
    elements.questionBody.className = 'question-body empty';
    elements.questionBody.textContent = 'Memuat soal…';
    elements.nav.replaceChildren();
    if (isCbt()) {
      const index = state.questions.findIndex((item) => questionId(item) === id);
      if (index < 0) return;
      renderQuestion(state.questions[index], index);
      renderNavigation(index);
      return;
    }
    try {
      const detail = await api(`/presentation/questions/${id}${sessionQuery('?')}`);
      const index = state.questions.findIndex((item) => questionId(item) === id);
      renderQuestion(detail, index);
      renderNavigation(index);
    } catch (error) {
      if (error instanceof SessionError) {
        showLogin(sessionMessage(error));
        return;
      }
      elements.questionBody.className = 'question-body empty';
      elements.questionBody.textContent = `Gagal memuat soal: ${error.message}`;
      toast(error.message, true);
    }
  }

  function collectPayload(form, detail, requireComplete = true) {
    const statements = Array.isArray(detail.statements) ? detail.statements : [];
    if (detail.question_type === 'true_false' && statements.length) {
      const statementAnswers = statements
        .map((statement) => ({
          statement_id: statement.id,
          value: String(form.elements[`statement-${statement.id}`]?.value ?? '')
        }))
        .filter((item) => item.value);
      if (requireComplete && statementAnswers.length !== statements.length) {
        toast('Pilih Benar atau Salah untuk setiap pernyataan.', true);
        return null;
      }
      return { payload: { answers: statementAnswers }, savedValue: statementAnswers };
    }
    const chosen = Array.from(form.elements.answer ?? []).filter((input) => input.checked).map((input) => input.value);
    const text = String(form.elements.answer_text?.value ?? '').trim();
    const isMultipleAnswer = detail.question_type === 'multiple_answer';
    const answer = chosen.length ? (isMultipleAnswer ? chosen : chosen[0]) : '';
    return {
      payload: { answer, answer_text: text || null },
      savedValue: answer || text
    };
  }

  async function saveDraft(id, payload, savedValue) {
    state.answers[String(id)] = savedValue;
    renderList();
    const request = api('/presentation/cbt/attempt/autosave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withSession({ question_id: id, ...payload }))
    }).catch((error) => {
      toast(error.message, true);
    }).finally(() => {
      state.pendingSaves.delete(request);
    });
    state.pendingSaves.add(request);
    return request;
  }

  function rememberLocalAnswer(id, detail, collected) {
    state.answers[String(id)] = collected.savedValue;
    state.answerPayloads[String(id)] = collected.payload;
    state.answerMeta[String(id)] = {
      question_type: detail.question_type,
      statement_count: Array.isArray(detail.statements) ? detail.statements.length : 0
    };
    renderList();
  }

  async function flushDrafts() {
    await Promise.all([...state.pendingSaves]);
  }

  async function toggleFlag(id, button) {
    if (state.locked) return;
    const flagged = !state.flags.has(String(id));
    try {
      await api('/presentation/cbt/attempt/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withSession({ question_id: id, flagged }))
      });
      if (flagged) state.flags.add(String(id));
      else state.flags.delete(String(id));
      button.textContent = flagged ? 'Hapus tanda ragu-ragu' : 'Tandai ragu-ragu';
      button.classList.toggle('flagged', flagged);
      renderList();
    } catch (error) {
      toast(error.message, true);
    }
  }

  function renderQuestion(detail, index) {
    const body = elements.questionBody;
    const id = questionId(detail);
    state.activeDetail = detail;
    body.className = 'question-body';
    body.replaceChildren();

    const label = document.createElement('p');
    label.className = 'muted';
    label.textContent = `${isCbt() ? `Soal ${detail.position ?? index + 1}` : `Soal #${id}`} · ${detail.difficulty ?? ''}`;
    if (detail.stem !== IMAGE_ONLY_STEM) {
      const stem = document.createElement('h3');
      stem.textContent = detail.stem;
      body.append(label, stem);
    } else {
      body.append(label);
    }

    if (detail.image_url) {
      const image = document.createElement('img');
      image.src = detail.image_url;
      image.alt = 'Gambar soal';
      image.className = 'question-image';
      body.append(image);
    }

    if (isCbt()) {
      const flagButton = document.createElement('button');
      flagButton.type = 'button';
      flagButton.className = 'small flag-button';
      const flagged = state.flags.has(String(id));
      flagButton.textContent = flagged ? 'Hapus tanda ragu-ragu' : 'Tandai ragu-ragu';
      flagButton.classList.toggle('flagged', flagged);
      flagButton.disabled = state.locked;
      flagButton.addEventListener('click', () => toggleFlag(id, flagButton));
      body.append(flagButton);
    }

    const form = document.createElement('form');
    form.className = 'answer-form';
    const options = Array.isArray(detail.options) ? detail.options : [];
    const statements = Array.isArray(detail.statements) ? detail.statements : [];
    const isTrueFalse = detail.question_type === 'true_false';
    const isMultipleAnswer = detail.question_type === 'multiple_answer';
    const savedAnswer = state.answers[String(id)];
    const savedKeys = Array.isArray(savedAnswer) && !savedAnswer.some((item) => item && typeof item === 'object')
      ? savedAnswer
      : String(savedAnswer ?? '').split(',').map((key) => key.trim()).filter(Boolean);
    const savedStatementValues = {};
    if (Array.isArray(savedAnswer)) {
      savedAnswer.forEach((item) => {
        if (item && typeof item === 'object' && item.statement_id != null) {
          savedStatementValues[item.statement_id] = String(item.value);
        }
      });
    }

    if (isTrueFalse && statements.length) {
      statements.forEach((statement, statementIndex) => {
        const group = document.createElement('fieldset');
        group.className = 'option statement-group';
        const legend = document.createElement('legend');
        legend.textContent = `${statement.position ?? statementIndex + 1}. ${statement.text ?? statement.statement_text ?? ''}`;
        group.append(legend);
        ['true', 'false'].forEach((value) => {
          const row = document.createElement('label');
          row.className = 'statement-option';
          const input = document.createElement('input');
          input.type = 'radio';
          input.name = `statement-${statement.id}`;
          input.value = value;
          input.checked = savedStatementValues[statement.id] === value;
          input.disabled = state.locked;
          const text = document.createElement('span');
          text.textContent = value === 'true' ? 'Benar' : 'Salah';
          row.append(input, text);
          group.append(row);
        });
        form.append(group);
      });
    } else if (options.length) {
      options.forEach((option) => {
        const row = document.createElement('label');
        row.className = 'option';
        const input = document.createElement('input');
        input.type = isMultipleAnswer ? 'checkbox' : 'radio';
        input.name = 'answer';
        input.value = option.key;
        input.checked = savedKeys.includes(option.key);
        input.disabled = state.locked;
        const text = document.createElement('span');
        text.textContent = `${option.label ?? option.key}. ${option.content}`;
        row.append(input, text);
        form.append(row);
      });
    } else {
      const field = document.createElement('textarea');
      field.name = 'answer_text';
      field.rows = 4;
      field.placeholder = 'Tuliskan jawaban Anda…';
      field.value = Array.isArray(savedAnswer) ? savedAnswer.join(',') : savedAnswer ?? '';
      field.disabled = state.locked;
      form.append(field);
    }

    form.addEventListener('submit', (event) => event.preventDefault());
    if (!state.locked) {
      form.addEventListener('change', () => {
        const collected = collectPayload(form, detail, false);
        if (!collected) return;
        if (isCbt()) saveDraft(id, collected.payload, collected.savedValue);
        else rememberLocalAnswer(id, detail, collected);
      });
      if (!isCbt()) {
        form.addEventListener('input', (event) => {
          if (event.target?.name !== 'answer_text') return;
          const collected = collectPayload(form, detail, false);
          if (collected) rememberLocalAnswer(id, detail, collected);
        });
      }
    }
    body.append(form);
  }

  function updateTimer() {
    if (!isCbt() || !state.attempt?.deadline_at) return;
    const remaining = Date.parse(state.attempt.deadline_at) - Date.now();
    if (remaining <= 0) {
      elements.timerDisplay.textContent = '00:00:00';
      if (!state.locked) {
        lockCbt();
        toast('Waktu pengerjaan habis. Jawaban dikunci.', true);
      }
      return;
    }
    const totalSeconds = Math.floor(remaining / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    elements.timerDisplay.textContent = `${hours}:${minutes}:${seconds}`;
    state.timerId = window.setTimeout(updateTimer, 1000);
  }

  function lockCbt() {
    state.locked = true;
    window.clearTimeout(state.timerId);
    elements.cbtStatus.textContent = state.attempt?.status ?? 'selesai';
    elements.finalizeButton.hidden = true;
    elements.fullscreenButton.hidden = true;
    document.querySelectorAll('.answer-form input, .answer-form textarea, .flag-button').forEach((element) => {
      element.disabled = true;
    });
  }

  async function finishCbt() {
    if (state.locked) return;
    if (!askConfirmation('Kumpulkan jawaban sekarang? Hasil hanya dapat dilihat oleh administrator.')) return;
    try {
      await flushDrafts();
      const result = await api('/presentation/cbt/attempt/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withSession())
      });
      state.attempt.status = result.status ?? 'submitted';
      lockCbt();
      toast('Jawaban terkirim. Hasil dapat dilihat administrator.');
      markSessionComplete();
    } catch (error) {
      if (error instanceof SessionError) {
        showLogin(sessionMessage(error));
        return;
      }
      toast(error.message, true);
    }
  }

  function captureActiveAnswer() {
    const detail = state.activeDetail;
    if (!detail || state.locked || String(questionId(detail)) !== String(state.activeId)) return;
    const form = elements.questionBody.querySelector('form.answer-form');
    if (!form) return;
    const collected = collectPayload(form, detail, false);
    if (collected) rememberLocalAnswer(state.activeId, detail, collected);
  }

  function collectAllAnswers() {
    return Object.keys(state.answers).flatMap((id) => {
      const payload = state.answerPayloads[id];
      if (!payload) return [];
      const meta = state.answerMeta[id];
      if (meta?.question_type === 'true_false'
        && (!Array.isArray(payload.answers) || payload.answers.length !== meta.statement_count)) return [];
      return [{ question_id: Number(id), ...payload }];
    });
  }

  function lockAnswers() {
    state.locked = true;
    elements.finalizeButton.hidden = true;
    document.querySelectorAll('.answer-form input, .answer-form textarea').forEach((element) => {
      element.disabled = true;
    });
  }

  async function submitAllAnswers() {
    if (state.locked || isCbt()) return;
    if (!askConfirmation('Kirim semua jawaban sekarang? Hasil hanya dapat dilihat oleh administrator.')) return;
    captureActiveAnswer();
    const answers = collectAllAnswers();
    elements.finalizeButton.disabled = true;
    try {
      await api('/presentation/attempts/submit-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withSession({ answers }))
      });
      lockAnswers();
      toast('Jawaban terkirim. Hasil dapat dilihat administrator.');
      markSessionComplete();
    } catch (error) {
      if (error instanceof SessionError) showLogin(sessionMessage(error));
      else toast(error.message, true);
    } finally {
      elements.finalizeButton.disabled = false;
    }
  }

  async function enterFullscreen() {
    try {
      await document.documentElement.requestFullscreen();
    } catch (error) {
      toast('Browser menolak mode fullscreen.', true);
    }
  }

  async function recordViolation(type, detail = {}) {
    if (!isCbt() || state.locked) return;
    if ((type === 'tab_hidden' || type === 'window_blur') && state.suppressFocusViolations) return;
    if (type === 'tab_hidden' || type === 'window_blur') {
      if (Date.now() - state.lastFocusLossAt < 750) return;
      state.lastFocusLossAt = Date.now();
    }
    const labels = {
      tab_hidden: 'pindah tab',
      window_blur: 'jendela kehilangan fokus',
      fullscreen_exit: 'keluar fullscreen',
      paste: 'tempel jawaban'
    };
    try {
      const result = await api('/presentation/cbt/attempt/violation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ violation_type: type, detail, session_id: state.activeSessionId })
      });
      const count = result.violation_count;
      const maxViolations = result.max_violations ?? result.limit ?? '∞';
      const notice = `Pelanggaran tercatat: ${labels[type] ?? type} (${count}/${maxViolations})`;
      if (result.status !== 'in_progress') {
        state.attempt.status = result.status;
        lockCbt();
        if (typeof markSessionComplete === 'function') markSessionComplete();
        toast(`${notice}. Attempt dikunci. Jawaban dikumpulkan otomatis.`, true);
      } else {
        toast(notice, true);
      }
      elements.cbtStatus.textContent = `pelanggaran ${count}/${maxViolations}`;
    } catch (error) {
      if (error instanceof SessionError) showLogin(sessionMessage(error));
    }
  }

  let guardsInstalled = false;
  function installCbtGuards() {
    if (guardsInstalled) return;
    guardsInstalled = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && isCbt() && !state.locked) recordViolation('tab_hidden', { hidden: true });
    });
    window.addEventListener('blur', () => {
      if (isCbt() && !state.locked) recordViolation('window_blur', {});
    });
    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) {
        state.fullscreenArmed = true;
        return;
      }
      if (state.fullscreenArmed && isCbt() && !state.locked) {
        state.fullscreenArmed = false;
        recordViolation('fullscreen_exit', {});
      }
    });
    document.addEventListener('paste', (event) => {
      if (isCbt() && !state.locked) {
        recordViolation('paste', { target: event.target?.tagName ?? null });
      }
    });
  }

  if (elements.tryoutSlugLabel) {
    elements.tryoutSlugLabel.textContent = TRYOUT_SLUG
      ? `Sesi: ${TRYOUT_SLUG}`
      : 'Tautan tryout tidak valid';
  }

  elements.nextSessionButton.hidden = true;
  elements.nextSessionButton.disabled = true;

  if (!TRYOUT_SLUG) {
    showLogin('Tautan tryout tidak valid. Gunakan URL sesi yang dibagikan administrator.');
    elements.loginForm.querySelector('button[type="submit"]').disabled = true;
    return;
  }

  elements.loadMore.addEventListener('click', () => loadQuestions(state.page + 1, true));
  elements.loginForm.addEventListener('submit', handleLogin);
  elements.logoutButton.addEventListener('click', handleLogout);
  elements.finalizeButton.addEventListener('click', () => {
    if (isCbt()) finishCbt();
    else submitAllAnswers();
  });
  elements.nextSessionButton.addEventListener('click', continueNextSession);
  elements.exitSessionButton.addEventListener('click', handleLogout);
  elements.fullscreenButton.addEventListener('click', enterFullscreen);

  const refreshOnVisible = () => {
    if (state.locked || isCbt() || document.hidden || !elements.loginGate.hidden) return;
    loadQuestions(1);
  };
  document.addEventListener('visibilitychange', refreshOnVisible);
  window.addEventListener('focus', refreshOnVisible);

  checkSession();
})();
