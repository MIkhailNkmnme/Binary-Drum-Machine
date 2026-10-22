/* Редакторам Зеркалиуса v0.001: читать исходные документы, не хранить вторую копию состояния. */
(() => {
  'use strict';
  const repo = 'https://github.com/MIkhailNkmnme/Binary-Drum-Machine';
  const files = {
    tasks: ['ЗАДАЧИ.md', 'Задачи'], coordinator: ['КООРДИНАТОР.md', 'Правила координатора'],
    handoff: ['ПРОДОЛЖИТЬ.md', 'Продолжить работу'], decisions: ['РЕШЕНИЯ.md', 'Решения'],
    journal: ['ЖУРНАЛ.md', 'Журнал'], rules: ['AGENTS.md', 'Правила проекта'], buttons: ['КНОПКИ.md', 'Правила кнопок']
  };
  const state = { docs: new Map(), errors: new Map(), filter: 'active', loading: false };
  const view = document.getElementById('view');
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const docURL = file => location.protocol === 'file:'
    ? new URL(`https://raw.githubusercontent.com/MIkhailNkmnme/Binary-Drum-Machine/main/${encodeURIComponent(file)}`)
    : new URL(`../${encodeURIComponent(file)}`, location.href);
  function safeURL(value, base) {
    try { const url = new URL(value, base); return ['https:', 'http:', 'file:'].includes(url.protocol) ? escape(url.href) : '#'; }
    catch { return '#'; }
  }
  function inline(text, base) {
    const token = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]*)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*/g;
    let html = '', at = 0, match;
    while ((match = token.exec(text))) {
      html += escape(text.slice(at, match.index));
      if (match[1] !== undefined) html += `<img loading="lazy" src="${safeURL(match[2], base)}" alt="${escape(match[1])}">`;
      else if (match[3] !== undefined) html += `<a href="${safeURL(match[4], base)}">${escape(match[3])}</a>`;
      else if (match[5] !== undefined) html += `<code>${escape(match[5])}</code>`;
      else html += `<strong>${escape(match[6])}</strong>`;
      at = token.lastIndex;
    }
    return html + escape(text.slice(at));
  }
  function cells(line) {
    const text = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    const out = []; let code = false, part = '';
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\\' && text[i + 1] === '|') { part += '|'; i++; continue; }
      if (text[i] === '`') code = !code;
      if (text[i] === '|' && !code) { out.push(part.trim()); part = ''; } else part += text[i];
    }
    out.push(part.trim()); return out;
  }
  function markdown(source, base) {
    const lines = source.replace(/\r/g, '').split('\n');
    let html = '', i = 0;
    const listItem = line => line.match(/^(\s*)([-*]|\d+[.)])\s+(.*)$/);
    const blockStart = n => /^(#{1,6}\s|```|\s*>|\s*\||\s*[-*]\s|\s*\d+[.)]\s)/.test(lines[n] || '');
    function list(indent) {
      const first = listItem(lines[i]), ordered = /^\d/.test(first[2]), tag = ordered ? 'ol' : 'ul';
      let result = `<${tag}>`;
      while (i < lines.length) {
        const item = listItem(lines[i]);
        if (!item || item[1].length !== indent || /^\d/.test(item[2]) !== ordered) break;
        const check = item[3].match(/^\[([ xX])\]\s+(.*)$/);
        result += '<li>' + (check ? `<span class="check ${check[1].toLowerCase() === 'x' ? 'done' : ''}" aria-label="${check[1].toLowerCase() === 'x' ? 'выполнено' : 'не выполнено'}">${check[1].toLowerCase() === 'x' ? '☑' : '☐'}</span>${inline(check[2], base)}` : inline(item[3], base));
        i++;
        while (i < lines.length && listItem(lines[i]) && listItem(lines[i])[1].length > indent) result += list(listItem(lines[i])[1].length);
        result += '</li>';
      }
      return result + `</${tag}>`;
    }
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      if (/^```/.test(line)) {
        const code = []; i++; while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
        i++; html += `<pre><code>${escape(code.join('\n'))}</code></pre>`; continue;
      }
      const heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) { const level = heading[1].length; html += `<h${level}>${inline(heading[2], base)}</h${level}>`; i++; continue; }
      if (/^\s*\|/.test(line)) {
        const rows = []; while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
        const head = rows.shift();
        if (rows[0] && rows[0].every(cell => /^:?-+:?$/.test(cell))) rows.shift();
        html += `<div class="table-scroll"><table><thead><tr>${head.map(cell => `<th scope="col">${inline(cell, base)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${inline(cell, base)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; continue;
      }
      if (listItem(line)) { html += list(listItem(line)[1].length); continue; }
      if (/^\s*>/.test(line)) { html += `<blockquote>${inline(line.replace(/^\s*>\s?/, ''), base)}</blockquote>`; i++; continue; }
      if (/^\s*---+\s*$/.test(line)) { html += '<hr>'; i++; continue; }
      const paragraph = [line]; i++;
      while (i < lines.length && lines[i].trim() && !blockStart(i)) paragraph.push(lines[i++]);
      html += `<p>${inline(paragraph.join(' '), base)}</p>`;
    }
    return html;
  }
  function tasksFrom(source) {
    const lines = source.replace(/\r/g, '').split('\n');
    const start = lines.findIndex(line => /^\|\s*ID\s*\|/.test(line));
    if (start < 0) throw new Error('В документе не найдена сводная таблица задач.');
    const tasks = [];
    for (let i = start + 2; i < lines.length && /^\s*\|/.test(lines[i]); i++) {
      const row = cells(lines[i]); if (row.length < 8) continue;
      const [id, title, priority, status, stage, progress, owner, next] = row;
      const percent = progress.match(/(\d+(?:[.,]\d+)?)\s*%/);
      const numeric = percent ? Number(percent[1].replace(',', '.')) : null;
      const index = lines.findIndex(line => line.startsWith(`## ${id} `));
      let end = index + 1; while (end < lines.length && !/^##\s/.test(lines[end])) end++;
      tasks.push({id, title, priority, status, stage, progress, owner, next, percent:numeric === null ? null : Math.min(100, Math.max(0, numeric)), detail:index < 0 ? '' : lines.slice(index, end).join('\n')});
    }
    return tasks;
  }
  function classify(status) {
    if (/готово|отменено/.test(status)) return 'done';
    if (/сверки|отложено/.test(status)) return 'review';
    return 'active';
  }
  function renderTasks() {
    const source = state.docs.get('tasks');
    if (!source) return renderError('tasks');
    let tasks; try { tasks = tasksFrom(source); } catch (error) { view.innerHTML = `<p class="error">${escape(error.message)}</p>`; return; }
    const counts = {active:0, done:0, review:0}; tasks.forEach(task => counts[classify(task.status)]++);
    const shown = tasks.filter(task => state.filter === 'all' || classify(task.status) === state.filter);
    const updated = source.match(/^Обновлено:\s*(.+)$/m);
    view.innerHTML = `<div class="metrics"><div class="metric"><strong>${counts.active}</strong><span>активных задач</span></div><div class="metric"><strong>${counts.done}</strong><span>завершённых</span></div><div class="metric"><strong>${counts.review}</strong><span>требуют сверки / отложены</span></div></div>
      <div class="section-heading"><h2>Текущие задачи</h2><div class="filters gz-rail">${[['active','В работе'],['all','Все задачи'],['done','Готово']].map(([id,label]) => `<button type="button" class="gz-hx" data-filter="${id}" aria-pressed="${state.filter === id}"><span>${label}</span></button>`).join('')}</div></div>
      <p class="doc-updated">${updated ? escape(updated[0]) : 'Дата состояния не указана.'} <a href="${repo}/blob/main/${encodeURIComponent(files.tasks[0])}">Источник ↗</a></p>
      <div class="task-list">${shown.length ? shown.map(task => `<article class="task-card"><div class="task-top"><span class="task-id">${escape(task.id)} / ${escape(task.priority)}</span><span class="status ${classify(task.status)}">${escape(task.status)}</span></div><h3>${escape(task.title)}</h3><div class="task-meta"><span>Этап: <strong>${escape(task.stage)}</strong></span><span>Исполнитель: <strong>${inline(task.owner, docURL(files.tasks[0]))}</strong></span></div><div class="progress-row">${task.percent === null ? '<span class="explain">Прогресс пока не оценён</span>' : `<progress max="100" value="${task.percent}" aria-label="${escape(task.id)}: выполнено ${task.percent}%"></progress>`}<span class="progress-value">${escape(task.progress)}</span></div><p class="next"><strong>Дальше:</strong> ${inline(task.next, docURL(files.tasks[0]))}</p>${task.detail ? `<details><summary>Критерии и результат</summary><div class="markdown">${markdown(task.detail, docURL(files.tasks[0]))}</div></details>` : ''}</article>`).join('') : '<p class="empty">В этой категории сейчас нет задач. Все зарегистрированные задачи доступны через «Все задачи».</p>'}</div>
      <div class="section-heading"><h2>Кто выполняет работу</h2><a href="#coordinator">Все правила ↗</a></div><div class="models"><div class="model"><small>ПРОСТЫЕ ПОРУЧЕНИЯ</small><p>Luna <span>/ low</span></p><span>Узкие понятные изменения</span></div><div class="model"><small>РЕАЛИЗАЦИЯ</small><p>Sol <span>/ medium</span></p><span>Интерфейс и обычные задачи</span></div><div class="model"><small>КООРДИНАЦИЯ И СЛОЖНОЕ</small><p>Astra <span>/ high</span></p><span>Решения и сложная проверка</span></div></div><p class="explain">Координатор сам выбирает сложность по согласованным правилам. Назначенная и фактическая модель фиксируются в карточке задачи.</p>`;
  }
  function renderError(key) {
    const file = files[key][0];
    view.innerHTML = `<div class="error"><h2>Документ не загрузился</h2><p>Проверьте подключение и нажмите «Обновить». Состояние не заменено пустыми задачами.</p><p><a href="${repo}/blob/main/${encodeURIComponent(file)}">Открыть документ на GitHub ↗</a></p></div>`;
  }
  function render() {
    const key = Object.hasOwn(files, location.hash.slice(1)) ? location.hash.slice(1) : 'tasks';
    document.querySelectorAll('[data-view]').forEach(link => { if (link.dataset.view === key) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current'); });
    if (!state.docs.has(key)) {
      if (state.loading) view.innerHTML = '<p class="empty">Загружаем документ…</p>'; else renderError(key);
      return;
    }
    if (key === 'tasks') renderTasks();
    else view.innerHTML = `<div class="document-top"><h2>${escape(files[key][1])}</h2><div class="document-links"><a href="${repo}/blob/main/${encodeURIComponent(files[key][0])}">Источник ↗</a><a href="${repo}/edit/main/${encodeURIComponent(files[key][0])}">Редактировать на GitHub ↗</a></div></div><article class="markdown">${markdown(state.docs.get(key), docURL(files[key][0]))}</article>`;
  }
  async function load() {
    if (state.loading) return; state.loading = true;
    const refresh = document.getElementById('refresh'), label = document.getElementById('load-state');
    refresh.disabled = true; label.textContent = 'Загружаем документы…';
    await Promise.all(Object.entries(files).map(async ([key,[file]]) => {
      try {
        const response = await fetch(docURL(file), {cache:'no-store'});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const content = await response.text(); if (!/^#\s/m.test(content)) throw new Error('Вместо документа получен другой файл.');
        state.docs.set(key,content); state.errors.delete(key);
      } catch (error) { state.errors.set(key,error.message); }
    }));
    state.loading = false; refresh.disabled = false;
    label.textContent = state.errors.size ? `Не обновлено документов: ${state.errors.size}. Последние загруженные данные сохранены.` : `Загружено: ${new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'}).format(new Date())} МСК`;
    render();
  }
  view.addEventListener('click', event => { const button = event.target.closest('[data-filter]'); if (button) { state.filter = button.dataset.filter; renderTasks(); } });
  document.getElementById('refresh').addEventListener('click',load);
  document.getElementById('copy-prompt').addEventListener('click',async () => {
    const prompt = `Продолжи как координатор Zerkulis / Binary-Drum-Machine. Открой ${repo}/blob/main/ПРОДОЛЖИТЬ.md и прочитай связанные AGENTS.md, КООРДИНАТОР.md, ЗАДАЧИ.md, РЕШЕНИЯ.md и последние записи ЖУРНАЛ.md. Проверь актуальность проекта и задач. Сам выбирай сложность и назначай модели по согласованным правилам. Продолжи актуальное поручение; старые отложенные работы без нового поручения не возобновляй.`;
    const result = document.getElementById('copy-result'); result.hidden = false;
    try { await navigator.clipboard.writeText(prompt); result.textContent = 'Инструкция скопирована. Вставьте её в новый чат.'; }
    catch { result.textContent = `Скопируйте инструкцию вручную:\n\n${prompt}`; }
  });
  window.addEventListener('hashchange',render);
  load(); render();
})();
