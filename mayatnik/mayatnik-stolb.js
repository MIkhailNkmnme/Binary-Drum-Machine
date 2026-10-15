/* «Проход столба»: столбец закраски «Столбы» ходит от «от» до «до» и обратно, по кругу. v1.
   Модель — только ход (столбцы от якоря); что и как красить, решает страница через show(столбец). */
(() => {
  'use strict';
  // Ход туда-обратно: шаг t ∈ [0, period), столбец растёт до hi, затем убывает до lo. Концы не повторяются.
  function model({lo, hi, col}) {
    if (hi < lo) { const t = lo; lo = hi; hi = t; }
    const n = hi - lo + 1, period = n > 1 ? 2 * (n - 1) : 1;
    const colAt = t => { t = ((t % period) + period) % period; return t < n ? lo + t : lo + period - t; };
    let t = Math.max(0, Math.min(n - 1, Math.round(col) - lo));
    return { lo, hi, period,
      get t() { return t; }, get col() { return colAt(t); },
      get dir() { return ((t % period) + period) % period < n - 1 || n === 1 ? 1 : -1; },   // куда идёт столбец: → или ←
      seek(value) { t = ((Math.round(value) % period) + period) % period; },
      step(d) { this.seek(t + d); } };
  }
  function mount({button, beforeStart, start, show, onClose}) {
    const panel = document.createElement('section'); panel.id = 'mayStolbPanel'; panel.hidden = true; panel.setAttribute('aria-label', 'Пульт прохода столба');
    panel.innerHTML = '<div class="may-fold-steps"><button type="button" data-stolb="back" title="Столбец назад по ходу">−1</button><output aria-live="off"></output><button type="button" data-stolb="next" title="Столбец вперёд по ходу">+1</button></div>'
      + '<div class="may-stolb-range"><label title="Левый край хода, столбец от якоря">от <input type="number" data-stolb="lo"></label><label title="Правый край хода, столбец от якоря">до <input type="number" data-stolb="hi"></label></div>'
      + '<input class="may-fold-frame" type="range" min="0" value="0" step="1" aria-label="Шаг прохода столба">'
      + '<div class="zz-pult"><input class="zz-pult-range" type="range" min="0" max="401" value="101" aria-label="Скорость прохода"><button type="button" class="zz-pult-back" title="Обратный ход">◀</button><button type="button" class="zz-pult-fwd" title="Прямой ход">▶</button><button type="button" class="zz-pult-play" aria-label="Автоплей прохода" title="Пуск / пауза. Для GIF: включи «Запись», затем пуск" aria-pressed="false">▶</button><output class="zz-pult-value"></output></div>';
    document.body.append(panel);
    const $p = s => panel.querySelector(s), pult = $p('.zz-pult'), play = $p('.zz-pult-play'), speed = $p('.zz-pult-range'), value = $p('.zz-pult-value'),
      timeline = $p('.may-fold-frame'), progress = $p('.may-fold-steps output'), loIn = $p('[data-stolb="lo"]'), hiIn = $p('[data-stolb="hi"]');
    let state = null, running = false, dir = 1, rateStep = 201, timer = 0, last = 0, credit = 0;
    const rate = () => rateStep <= 0 ? 0 : .1 * 10 ** ((rateStep - 1) / 100);   // столбцов в секунду: 201 → 10/с
    try { const n = Number(localStorage.getItem('mayatnik-stolb-rate')); if (localStorage.getItem('mayatnik-stolb-rate') !== null && n >= 0 && n <= 401) rateStep = n; } catch (_) {}
    function sync() {
      button.setAttribute('aria-pressed', String(!!state)); panel.hidden = !state; if (!state) return;
      timeline.max = state.period - 1; timeline.value = state.t;
      progress.textContent = `Проход столба · столбец ${state.col} · ${state.dir > 0 ? '→' : '←'} · ${state.lo}…${state.hi}`;
      if (document.activeElement !== loIn) loIn.value = state.lo; if (document.activeElement !== hiIn) hiIn.value = state.hi;
      play.textContent = running ? 'Ⅱ' : '▶'; play.setAttribute('aria-pressed', String(running)); speed.value = rateStep;
      for (const [cls, d] of [['.zz-pult-back', -1], ['.zz-pult-fwd', 1]]) { const b = $p(cls); b.classList.toggle('on', dir === d); b.setAttribute('aria-pressed', String(dir === d)); }
      value.textContent = window.ZerkPult ? ZerkPult.label(rate()) : ''; value.title = `${Number(rate().toPrecision(3))} столбцов/с · двойной щелчок — ×1`;
      window.ZerkPult?.sync(pult, rateStep / 401);
    }
    const render = () => { if (state) show(state.col); sync(); };
    function pause() { running = false; cancelAnimationFrame(timer); timer = 0; last = 0; credit = 0; sync(); }
    function close() { pause(); state = null; show(null); sync(); onClose?.(); }
    function open() { beforeStart(); const s = start(); if (!s) return; state = model(s); render(); }
    function tick(now) { if (!running || !state) return; if (last) credit += Math.min(.25, (now - last) / 1000) * rate(); last = now;
      const n = Math.min(64, Math.floor(credit)); if (n) { credit -= n; state.step(dir * n); render(); } timer = requestAnimationFrame(tick); }
    function togglePlay() { if (!state) return; if (running) { pause(); return; } running = true; last = 0; credit = 0; sync(); timer = requestAnimationFrame(tick); }
    function setRate(n) { rateStep = Math.max(0, Math.min(401, Math.round(n))); try { localStorage.setItem('mayatnik-stolb-rate', String(rateStep)); } catch (_) {} sync(); }
    function setRange() { if (!state) return; const lo = Math.round(Number(loIn.value)), hi = Math.round(Number(hiIn.value)); if (!Number.isFinite(lo) || !Number.isFinite(hi)) return;
      state = model({lo, hi, col: Math.max(Math.min(lo, hi), Math.min(Math.max(lo, hi), state.col))}); render(); }
    button.addEventListener('click', () => { if (state) close(); else open(); });
    play.onclick = togglePlay; speed.oninput = () => setRate(Number(speed.value)); value.ondblclick = () => setRate(101);
    for (const [cls, d] of [['.zz-pult-back', -1], ['.zz-pult-fwd', 1]]) $p(cls).onclick = () => { dir = d; last = 0; credit = 0; sync(); };
    for (const [action, d] of [['back', -1], ['next', 1]]) $p(`[data-stolb="${action}"]`).onclick = () => { pause(); state.step(d); render(); };
    timeline.oninput = () => { pause(); state.seek(Number(timeline.value)); render(); };
    for (const inp of [loIn, hiIn]) inp.addEventListener('change', setRange);
    addEventListener('keydown', e => { if (!state || e.target.closest?.('input,select,button,textarea')) return;
      if (['Space', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation();
        if (e.code === 'Escape') close(); else if (e.code === 'Space') togglePlay(); else { pause(); state.step(e.code === 'ArrowRight' ? 1 : -1); render(); } } }, true);
    return { get active() { return !!state; }, close, render };
  }
  const api = { model, mount };
  if (typeof module === 'object' && module.exports) module.exports = api; else window.MayatnikStolb = api;
})();
