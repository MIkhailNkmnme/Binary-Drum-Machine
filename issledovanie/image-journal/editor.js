(() => {
  const api = window.MayatnikJournal;
  const byId = id => document.getElementById(id);
  const access = byId('journal-access');
  const login = byId('journal-login');
  const form = byId('journal-login-form');
  const password = byId('journal-password');
  const message = byId('journal-login-status');
  const viewer = byId('image-viewer');
  const remove = byId('viewer-remove');
  const storageKey = 'journal-editor-session';
  let token = '';
  try { token = sessionStorage.getItem(storageKey) || ''; } catch {}
  let signedIn = false;
  function session(value) {
    token = value;
    signedIn = Boolean(value);
    try {
      if (value) sessionStorage.setItem(storageKey, value);
      else sessionStorage.removeItem(storageKey);
    } catch {}
    access.textContent = signedIn ? 'Выйти из редактора' : 'Вход редактора';
    remove.hidden = !(signedIn && viewer.dataset.key);
  }
  function forgetCard(key) {
    for (const card of document.querySelectorAll('[data-journal-key]')) {
      if (card.dataset.journalKey === key) card.remove();
    }
  }
  async function loadArchive() {
    const retry = byId('archive-retry');
    retry.hidden = true;
    try {
      const withdrawn = new Set(await api.withdrawn());
      for (const template of document.querySelectorAll('template[data-archive-key]')) {
        const card = template.content.firstElementChild;
        card.dataset.journalKey = template.dataset.archiveKey;
        if (withdrawn.has(card.dataset.journalKey)) template.remove();
        else template.replaceWith(card);
      }
    } catch { retry.hidden = false; }
  }
  byId('archive-retry').addEventListener('click', loadArchive);
  loadArchive();
  if (token) api.editor('check', {token}).then(() => session(token)).catch(error => {
    if (error.status === 401) session('');
  });
  access.addEventListener('click', async () => {
    if (signedIn) {
      access.disabled = true;
      try { await api.editor('logout', {token}); session(''); }
      catch (error) { if (error.status === 401) session(''); else alert(error.message); }
      finally { access.disabled = false; }
    } else {
      message.textContent = '';
      login.showModal();
      password.focus();
    }
  });
  byId('journal-login-cancel').addEventListener('click', () => login.close());
  login.addEventListener('close', () => form.reset());
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('[type=submit]');
    submit.disabled = true;
    try {
      const result = await api.editor('login', {password:password.value});
      session(result.token);
      login.close();
    } catch (error) { message.textContent = error.message; }
    finally { submit.disabled = false; }
  });
  document.addEventListener('journal-image-open', () => { remove.hidden = !(signedIn && viewer.dataset.key); });
  remove.addEventListener('click', async () => {
    const {key,label} = viewer.dataset;
    if (!signedIn || !key || !confirm('Удалить «' + label + '» из журнала?')) return;
    remove.disabled = true;
    try {
      await api.editor('remove', {key,token});
      forgetCard(key);
      if (viewer.dataset.key === key && viewer.open) viewer.close();
      if (!byId('mayatnik-frames').children.length && byId('mayatnik-more').hidden) {
        byId('mayatnik-feed-status').textContent = 'Пока нет опубликованных кадров.';
      }
    } catch (error) {
      if (error.status === 401) session('');
      alert(error.message);
    } finally { remove.disabled = false; }
  });
})();
