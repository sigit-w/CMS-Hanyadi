(() => {
  const API = '/api/v1';
  const IMAGE_ONLY_STEM = '[Gambar soal]';
  const RESERVED_SLUGS = new Set([
    'api', 'assets', 'health', 'favicon.ico', 'robots.txt', 'login', 'admin', 'tryout'
  ]);
  const TRYOUT_SLUG = resolveTryoutSlug();
  const state = {
    questions: [],
    page: 1,
    total: 0,
    activeId: null,
    answers: {},
    submitted: {}
  };

  const elements = {
    listStatus: document.getElementById('listStatus'),
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
    logoutButton: document.getElementById('logoutButton')
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

  async function api(path, options = {}) {
    const response = await fetch(`${API}${path}`, { credentials: 'include', ...options });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) {
      throw new SessionError(body?.error?.message ?? `HTTP ${response.status}`, response.status);
    }
    if (!response.ok) throw new Error(body?.error?.message ?? `HTTP ${response.status}`);
    return body.data;
  }

  function sessionMessage(error) {
    return error.status === 403
      ? 'Akun Anda tidak memiliki akses tryout.'
      : 'Sesi berakhir. Silakan masuk kembali.';
  }

  function showLogin(message = '') {
    elements.appHeader.hidden = true;
    elements.appMain.hidden = true;
    elements.loginGate.hidden = false;
    elements.loginError.hidden = !message;
    elements.loginError.textContent = message;
    elements.loginPassword.value = '';
  }

  function showApp(session) {
    elements.loginGate.hidden = true;
    elements.appHeader.hidden = false;
    elements.appMain.hidden = false;
    elements.userLabel.textContent = `${session.user.username}${session.tryout_slug ? ` · ${session.tryout_slug}` : ''}`;
  }

  async function checkSession() {
    try {
      const session = await api('/auth/me');
      showApp(session);
      await loadQuestions(1);
      return true;
    } catch (error) {
      showLogin(error instanceof SessionError ? sessionMessage(error) : error.message);
      return false;
    }
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
      state.questions = [];
      state.answers = {};
      state.submitted = {};
      elements.questionList.replaceChildren();
      elements.questionBody.textContent = 'Pilih soal di sebelah kiri untuk mulai.'; elements.questionBody.className = 'question-body empty';
      showLogin();
    }
  }

  function renderList() {
    elements.questionList.replaceChildren();
    state.questions.forEach((question, idx) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = question.id === state.activeId ? 'question-button active' : 'question-button';
      button.addEventListener('click', () => openQuestion(question.id));

      const title = document.createElement('span');
      title.className = 'question-stem';
      const stem = question.stem === IMAGE_ONLY_STEM ? 'Soal gambar' : question.stem;
      title.textContent = `${idx + 1}. ${stem}`;
      const meta = document.createElement('small');
      meta.textContent = `${question.mapel_name ?? question.mapel_code} · ${question.question_type} · ${question.difficulty}`;
      button.append(title, meta);
      item.append(button);
      elements.questionList.append(item);
    });
    elements.listStatus.textContent = state.questions.length
      ? `${state.questions.length} dari ${state.total} soal ditampilkan`
      : 'Belum ada soal yang tersedia.';
    elements.loadMore.hidden = state.questions.length >= state.total;
  }

  async function loadQuestions(page = 1, append = false) {
    elements.listStatus.textContent = 'Memuat daftar soal…';
    try {
      const data = await api(`/tryout/questions?page=${page}&limit=20`);
      state.questions = append ? [...state.questions, ...data.questions] : data.questions;
      state.total = data.pagination.total;
      state.page = page;
      renderList();
    } catch (error) {
      if (error instanceof SessionError) {
        showLogin(sessionMessage(error));
        return;
      }
      elements.listStatus.textContent = 'Gagal memuat daftar soal.';
      toast(error.message, true);
    }
  }

  function renderSavedNote() {
    const note = document.createElement('p');
    note.className = 'muted result';
    note.textContent = 'Jawaban tersimpan.';
    return note;
  }

  function renderNavigation(index) {
    elements.nav.replaceChildren();
    if (index > 0) {
      const previous = document.createElement('button');
      previous.type = 'button';
      previous.textContent = 'Sebelumnya';
      previous.addEventListener('click', () => openQuestion(state.questions[index - 1].id));
      elements.nav.append(previous);
    }
    if (index < state.questions.length - 1) {
      const next = document.createElement('button');
      next.type = 'button';
      next.textContent = 'Berikutnya';
      next.addEventListener('click', () => openQuestion(state.questions[index + 1].id));
      elements.nav.append(next);
    }
  }

  async function openQuestion(id) {
    state.activeId = id;
    renderList();
    elements.questionBody.className = 'question-body empty'; elements.questionBody.textContent = 'Memuat soal…';
    elements.nav.replaceChildren();
    try {
      const detail = await api(`/presentation/questions/${id}`);
      const index = state.questions.findIndex((item) => item.id === id);
      renderQuestion(detail);
      renderNavigation(index);
    } catch (error) {
      if (error instanceof SessionError) {
        showLogin(sessionMessage(error));
        return;
      }
      elements.questionBody.className = 'question-body empty'; elements.questionBody.textContent = `Gagal memuat soal: ${error.message}`;
      toast(error.message, true);
    }
  }

  function renderQuestion(detail) {
    const body = elements.questionBody;
    body.className = 'question-body';
    body.replaceChildren();

    const label = document.createElement('p');
    label.className = 'muted';
    label.textContent = `Soal #${detail.question_id} · ${detail.difficulty}`;
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

    const form = document.createElement('form');
    form.className = 'answer-form';
    const options = Array.isArray(detail.options) ? detail.options : [];
    const statements = Array.isArray(detail.statements) ? detail.statements : [];
    const isTrueFalse = detail.question_type === 'true_false';
    const isMultipleAnswer = detail.question_type === 'multiple_answer';
    const savedAnswer = state.answers[detail.question_id];
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
      statements.forEach((statement, index) => {
        const group = document.createElement('fieldset');
        group.className = 'option statement-group';
        const legend = document.createElement('legend');
        legend.textContent = `${index + 1}. ${statement.text ?? statement.statement_text ?? ''}`;
        group.append(legend);
        ['true', 'false'].forEach((value) => {
          const row = document.createElement('label');
          row.className = 'statement-option';
          const input = document.createElement('input');
          input.type = 'radio';
          input.name = `statement-${statement.id}`;
          input.value = value;
          input.checked = savedStatementValues[statement.id] === value;
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
        const text = document.createElement('span');
        text.textContent = `${option.key}. ${option.content}`;
        row.append(input, text);
        form.append(row);
      });
    } else {
      const field = document.createElement('textarea');
      field.name = 'answer_text';
      field.rows = 4;
      field.placeholder = 'Tuliskan jawaban Anda…';
      field.value = Array.isArray(savedAnswer) ? savedAnswer.join(',') : savedAnswer ?? '';
      form.append(field);
    }

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = 'Kirim Jawaban';
    form.append(submit);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      let payload;
      let savedValue;
      if (isTrueFalse && statements.length) {
        const statementAnswers = statements.map((statement) => ({
          statement_id: statement.id,
          value: String(data.get(`statement-${statement.id}`) ?? '')
        }));
        if (statementAnswers.some((item) => !item.value)) {
          toast('Pilih Benar atau Salah untuk setiap pernyataan.', true);
          return;
        }
        savedValue = statementAnswers;
        payload = { answers: statementAnswers };
      } else {
        const chosen = data.getAll('answer').map(String).filter(Boolean);
        const text = String(data.get('answer_text') ?? '').trim();
        const answer = chosen.length ? (isMultipleAnswer ? chosen : chosen[0]) : null;
        savedValue = answer || text;
        payload = { answer, answer_text: text || null };
      }
      state.answers[detail.question_id] = savedValue;
      submit.disabled = true;
      try {
        await api(`/presentation/questions/${detail.question_id}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        state.submitted[detail.question_id] = true;
        form.querySelector('.result')?.remove();
        form.append(renderSavedNote());
        toast('Jawaban tersimpan.');
      } catch (error) {
        if (error instanceof SessionError) {
          showLogin(sessionMessage(error));
          return;
        }
        toast(error.message, true);
      } finally {
        submit.disabled = false;
      }
    });

    if (state.submitted[detail.question_id]) {
      form.append(renderSavedNote());
    }
    body.append(form);
  }

  if (elements.tryoutSlugLabel) {
    elements.tryoutSlugLabel.textContent = TRYOUT_SLUG
      ? `Tryout: ${TRYOUT_SLUG}`
      : 'Tautan tryout tidak valid';
  }

  if (!TRYOUT_SLUG) {
    showLogin('Tautan tryout tidak valid. Gunakan URL yang dibagikan administrator.');
    elements.loginForm.querySelector('button[type="submit"]').disabled = true;
    return;
  }

  elements.loadMore.addEventListener('click', () => loadQuestions(state.page + 1, true));
  elements.loginForm.addEventListener('submit', handleLogin);
  elements.logoutButton.addEventListener('click', handleLogout);

  const refreshOnVisible = () => {
    if (document.hidden || !elements.loginGate.hidden) return;
    loadQuestions(1);
  };
  document.addEventListener('visibilitychange', refreshOnVisible);
  window.addEventListener('focus', refreshOnVisible);

  checkSession();
})();
