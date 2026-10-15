/* «Проход столба»: столбец закраски «Столбы» ходит по полю. v2: галка «линия».
   v3: от центрального столбца в обе стороны сразу — до края, и снова из центра, по кругу («пусть теперь от центрального
   столбца идёт в обе стороны в конец и уходит, и снова с центра в обе»). Модель — только ход: t — расстояние от центра;
   что и как красить (столбцы −t и +t, затухание), решает страница через show(t). */
(() => {
  'use strict';
  // Ход по кругу: t = 0, 1, … span, затем снова 0. Назад — так же по кругу.
  function model({span, t: t0 = 0}) {
    span = Math.max(0, Math.round(span)); const period = span + 1;
    let t = Math.max(0, Math.min(span, Math.round(t0)));
    return { span, period,
      get t() { return t; },
      seek(value) { t = ((Math.round(value) % period) + period) % period; },
      step(d) { this.seek(t + d); } };
  }
  function mount({button, beforeStart, start, show, onClose}) {
    const panel = document.createElement('section'); panel.id = 'mayStolbPanel'; panel.hidden = true; panel.setAttribute('aria-label', 'Пульт прохода столба');
    panel.innerHTML = '<div class="may-fold-steps"><button type="button" data-stolb="back" title="Шаг назад">−1</button><output aria-live="off"></output><button type="button" data-stolb="next" title="Шаг вперёд">+1</button></div>'
      + '<div class="may-stolb-range"><label title="Докуда идут столбцы от центра, в столбцах">до ± <input type="number" min="0" data-stolb="span"></label><label title="Пунктир столбцов на поле и в записи"><input type="checkbox" data-stolb="line"> линия</label></div>'
      + '<input class="may-fold-frame" type="range" min="0" value="0" step="1" aria-label="Шаг прохода столба">'
      + '<div class="zz-pult"><input class="zz-pult-range" type="range" min="0" max="401" value="101" aria-label="Скорость прохода"><button type="button" class="zz-pult-back" title="Обратный ход">◀</button><button type="button" class="zz-pult-fwd" title="Прямой ход">▶</button><button type="button" class="zz-pult-play" aria-label="Автоплей прохода" title="Пуск / пауза. Для GIF: включи «Запись», затем пуск" aria-pressed="false">▶</button><output class="zz-pult-value"></output></div>';
    document.body.append(panel);
    const $p = s => panel.querySelector(s), pult = $p('.zz-pult'), play = $p('.zz-pult-play'), speed = $p('.zz-pult-range'), value = $p('.zz-pult-value'),
      timeline = $p('.may-fold-frame'), progress = $p('.may-fold-steps output'), spanIn = $p('[data-stolb="span"]'), lineIn = $p('[data-stolb="line"]');
    let state = null, running = false, dir = 1, rateStep = 201, timer = 0, last = 0, credit = 0;
    const rate = () => rateStep <= 0 ? 0 : .1 * 10 ** ((rateStep - 1) / 100);   // шагов в секунду: 201 → 10/с
    try { const n = Number(localStorage.getItem('mayatnik-stolb-rate')); if (localStorage.getItem('mayatnik-stolb-rate') !== null && n >= 0 && n <= 401) rateStep = n; } catch (_) {}
    function sync() {
      button.setAttribute('aria-pressed', String(!!state)); panel.hidden = !state; if (!state) return;
      timeline.max = state.span; timeline.value = state.t;
      progress.textContent = `Проход от центра · ±${state.t} из ${state.span}`;
      if (document.activeElement !== spanIn) spanIn.value = state.span;
      play.textContent = running ? 'Ⅱ' : '▶'; play.setAttribute('aria-pressed', String(running)); speed.value = rateStep;
      for (const [cls, d] of [['.zz-pult-back', -1], ['.zz-pult-fwd', 1]]) { const b = $p(cls); b.classList.toggle('on', dir === d); b.setAttribute('aria-pressed', String(dir === d)); }
      value.textContent = window.ZerkPult ? ZerkPult.label(rate()) : ''; value.title = `${Number(rate().toPrecision(3))} шагов/с · двойной щелчок — ×1`;
      window.ZerkPult?.sync(pult, rateStep / 401);
    }
    // show(t, шагов) — шагов: сколько ходов сделано этим вызовом (для затухания); 0 — только перерисовать
    const render = (moved = 0) => { if (state) show(state.t, moved, state.span); sync(); };
    function pause() { running = false; cancelAnimationFrame(timer); timer = 0; last = 0; credit = 0; sync(); }
    function close() { pause(); state = null; show(null, 0, 0); sync(); onClose?.(); }
    function open() { beforeStart(); const s = start(); if (!s) return; state = model(s); render(1); }
    function tick(now) { if (!running || !state) return; if (last) credit += Math.min(.25, (now - last) / 1000) * rate(); last = now;
      const n = Math.min(64, Math.floor(credit)); if (n) { credit -= n; state.step(dir * n); render(n); } timer = requestAnimationFrame(tick); }
    function togglePlay() { if (!state) return; if (running) { pause(); return; } running = true; last = 0; credit = 0; sync(); timer = requestAnimationFrame(tick); }
    function setRate(n) { rateStep = Math.max(0, Math.min(401, Math.round(n))); try { localStorage.setItem('mayatnik-stolb-rate', String(rateStep)); } catch (_) {} sync(); }
    function setSpan() { if (!state) return; const span = Math.round(Number(spanIn.value)); if (!Number.isFinite(span) || span < 0) return;
      state = model({span, t: Math.min(span, state.t)}); render(1); }
    button.addEventListener('click', () => { if (state) close(); else open(); });
    play.onclick = togglePlay; speed.oninput = () => setRate(Number(speed.value)); value.ondblclick = () => setRate(101);
    for (const [cls, d] of [['.zz-pult-back', -1], ['.zz-pult-fwd', 1]]) $p(cls).onclick = () => { dir = d; last = 0; credit = 0; sync(); };
    for (const [action, d] of [['back', -1], ['next', 1]]) $p(`[data-stolb="${action}"]`).onclick = () => { pause(); state.step(d); render(1); };
    timeline.oninput = () => { pause(); state.seek(Number(timeline.value)); render(1); };
    spanIn.addEventListener('change', setSpan);
    // v2: пунктир столбца — по выбору, по умолчанию выключен («как этот столб убрать?»: для GIF он мешает)
    try { lineIn.checked = localStorage.getItem('mayatnik-stolb-line') === '1'; } catch (_) {}
    lineIn.addEventListener('change', () => { try { localStorage.setItem('mayatnik-stolb-line', lineIn.checked ? '1' : '0'); } catch (_) {} render(0); });
    addEventListener('keydown', e => { if (!state || e.target.closest?.('input,select,button,textarea')) return;
      if (['Space', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation();
        if (e.code === 'Escape') close(); else if (e.code === 'Space') togglePlay(); else { pause(); state.step(e.code === 'ArrowRight' ? 1 : -1); render(1); } } }, true);
    return { get active() { return !!state; }, get line() { return lineIn.checked; }, close, render };
  }
  const api = { model, mount };
  if (typeof module === 'object' && module.exports) module.exports = api; else window.MayatnikStolb = api;
})();
