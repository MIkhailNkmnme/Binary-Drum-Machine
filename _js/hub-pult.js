/* Hub v0.278: пульт у креста — «предложи норм пульт» → набросок (масштаб одной строкой, вращение общим пультом пуска zz-pult)
   и «в пульт добавить кнопки поворота бит». Пульт не считает сам: каждая его кнопка жмёт прежнюю кнопку #hubZoom
   (hub-view.js) или двигает прежний ползунок наклона битов (hub-mirror.js); прежние кнопки на компьютере спрятаны (hub-pult.css). */
(() => {
  'use strict';
  const Z = () => document.getElementById('hubZoom');
  const q = s => Z()?.querySelector(s);
  const old = {
    home: () => [...(Z()?.children || [])].find(b => b.tagName === 'BUTTON' && b.textContent.trim() === '⌂'),
    plus: () => q('.hub-zoom-plus'), minus: () => q('.hub-zoom-minus'), scale: () => q(':scope > output'),
    frame: () => q('.hub-frame-lock'), left: () => q('.hub-turn-left'), right: () => q('.hub-turn-right'),
    play: () => q('.hub-auto-turn'), range: () => q('.hubAutoTrack input[type=range]'), rate: () => q('.hubAutoExact summary output'),
    exact: () => q('.hubAutoExact input[type=text]'), angle: () => q('.hubAutoAngle'),
    tilt: b => document.querySelector('input[aria-label="Наклон ромбов ' + b + '"]'),
    tiltReset: () => document.querySelector('#hubFieldTools button[aria-label="Сброс наклона битов"]'),
    free: () => document.getElementById('hubBitFreeRotation')
  };
  const el = (tag, cls, text, tip) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (tip) e.title = tip; return e; };
  const btn = (cls, text, tip, fn) => { const b = el('button', 'hpB ' + cls, text, tip); b.type = 'button'; b.addEventListener('click', e => { e.stopPropagation(); fn(e); sync(); }); return b; };
  const press = f => () => f()?.click();
  const fire = (e, t) => e && e.dispatchEvent(new Event(t, { bubbles: true }));
  let box, scaleV, pult, play, range, rateV, frame, free, tiltV = {};

  // наклон битов: ◂ ▸ — на 15° (Shift — на 1°), удержание повторяет
  function tiltBy(b, d) {
    const r = old.tilt(b); if (!r) return;
    const v = Math.max(+r.min, Math.min(+r.max, +r.value + d)); if (v === +r.value) return;
    r.value = v; fire(r, 'input'); fire(r, 'change');
  }
  function hold(b, f) {
    let t = 0; const stop = () => { clearTimeout(t); t = 0; };
    b.addEventListener('pointerdown', e => { if (e.button) return; e.preventDefault(); e.stopPropagation(); f(e); sync(); const rep = d => { t = setTimeout(() => { f(e); sync(); rep(70); }, d); }; rep(400); });
    for (const k of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(k, stop);
  }

  function build() {
    box = el('div'); box.id = 'hubPult'; box.setAttribute('role', 'toolbar'); box.setAttribute('aria-label', 'Пульт: масштаб, вращение, поворот битов');
    for (const t of ['pointerdown', 'dblclick', 'contextmenu']) box.addEventListener(t, e => e.stopPropagation());
    box.addEventListener('wheel', e => e.stopPropagation(), { passive: true });

    // 1. масштаб одной строкой: ⌂ · − 66% +
    const zr = el('div', 'hpRow hpZoom');
    scaleV = el('output', 'hpB hpVal', '100%', 'Масштаб холста · колесо — шаг · двойной щелчок — весь рисунок в поле');
    scaleV.addEventListener('wheel', e => { e.preventDefault(); (e.deltaY < 0 ? old.plus() : old.minus())?.click(); sync(); }, { passive: false });
    scaleV.addEventListener('dblclick', () => { old.home()?.click(); sync(); });
    zr.append(btn('hpHome', '⌂', 'Вернуть рисунок и ось в центр: масштаб 100%, повороты 0°, остановить вращение', press(old.home)),
      btn('hpL', '−', 'Уменьшить масштаб', press(old.minus)), scaleV, btn('hpR', '+', 'Увеличить масштаб', press(old.plus)));

    // 2. вращение — общий пульт пуска (zz-pult): ◀ ▶, ромб пуска на дорожке скорости, подпись
    pult = el('div', 'zz-pult hpSpin');
    const back = btn('zz-pult-back', '◀', 'Стоит — повернуть поле на −15°; крутится — медленнее', press(old.left));
    const fwd = btn('zz-pult-fwd', '▶', 'Стоит — повернуть поле на +15°; крутится — быстрее', press(old.right));
    range = el('input', 'zz-pult-range'); range.type = 'range'; range.min = 0; range.max = 601; range.step = 1; range.setAttribute('aria-label', 'Скорость вращения');
    range.addEventListener('input', () => { const r = old.range(); if (!r) return; r.value = range.value; fire(r, 'input'); sync(); });
    play = btn('zz-pult-play', '▶', 'Вращение треугольника: пуск / пауза · тянуть вдоль — скорость', press(old.play));
    // ромб тянется как ползунок (щелчок без сдвига — пуск / пауза)
    play.addEventListener('pointerdown', e => {
      if (e.button) return; e.preventDefault(); const x0 = e.clientX, v0 = +range.value, w = window.ZerkPult?.trackWidth(pult) || 200; let moved = false;
      play.setPointerCapture(e.pointerId);
      const mv = ev => { if (Math.abs(ev.clientX - x0) > 3) moved = true; if (!moved) return; range.value = Math.max(0, Math.min(601, Math.round(v0 + (ev.clientX - x0) / w * 601))); fire(range, 'input'); };
      const up = () => { play.removeEventListener('pointermove', mv); play.removeEventListener('pointerup', up); play.removeEventListener('pointercancel', up); if (moved) play.addEventListener('click', e2 => e2.stopImmediatePropagation(), { capture: true, once: true }); };
      play.addEventListener('pointermove', mv); play.addEventListener('pointerup', up); play.addEventListener('pointercancel', up);
    });
    rateV = el('span', 'zz-pult-value hpRate', '', 'Шаг за кадр и обороты за кадр · щелчок — ввести точно (дробь 1/2 или число)');
    rateV.addEventListener('click', e => { e.stopPropagation(); const x = old.exact(); if (!x) return; const v = prompt('Обороты за кадр: дробь 1/2 или число 0.5', x.value); if (v == null) return; x.value = v; fire(x, 'input'); fire(x, 'change'); sync(); });
    pult.append(back, range, play, rateV, fwd);

    // 3. кадр и поворот битов: ▣ кадр · 0 ◂ 0° ▸ · 1 ◂ 0° ▸ · ↺ · 360°
    const br = el('div', 'hpRow hpBits');
    frame = btn('hpFrame', '▣ кадр', 'Точный шаг вращения на каждый кадр', press(old.frame));
    br.append(frame);
    for (const b of ['0', '1']) {
      const l = btn('hpL', '◂', 'Наклон битов ' + b + ' — против часовой на 15° (Shift — на 1°), удержание — дальше', () => {}),
        r = btn('hpR', '▸', 'Наклон битов ' + b + ' — по часовой на 15° (Shift — на 1°), удержание — дальше', () => {});
      hold(l, e => tiltBy(b, e.shiftKey ? -1 : -15)); hold(r, e => tiltBy(b, e.shiftKey ? 1 : 15));
      tiltV[b] = el('output', 'hpB hpVal hpTilt', b + ' · 0°', 'Наклон битов ' + b + ' · колесо — на 1°');
      tiltV[b].addEventListener('wheel', e => { e.preventDefault(); tiltBy(b, e.deltaY < 0 ? 1 : -1); sync(); }, { passive: false });
      br.append(l, tiltV[b], r);
    }
    br.append(btn('hpReset', '↺', 'Сброс наклона битов', press(old.tiltReset)));
    free = btn('hpFree', '360°', 'Свободный поворот битов: включено — полный круг, выключено — стоп на ±60°', press(old.free));
    br.append(free);

    box.append(zr, pult, br); document.body.append(box); document.body.classList.add('hubPultOn');
  }

  function sync() {
    if (!box) return;
    const s = old.scale(); if (s && scaleV.textContent !== s.textContent) scaleV.textContent = s.textContent;
    const r = old.range(); if (r && document.activeElement !== range && range.value !== r.value) range.value = r.value;
    const p = old.play(), on = p?.getAttribute('aria-pressed') === 'true' || document.body.classList.contains('hubAutoTurning');
    play.setAttribute('aria-pressed', String(on)); const pt = on ? '❚❚' : '▶'; if (play.textContent !== pt) play.textContent = pt;
    const t = (old.angle()?.textContent || '').trim(), rt = (old.rate()?.textContent || '').trim();   // подпись — шаг за кадр; обороты за кадр — в подсказке
    if (rateV.textContent !== t) rateV.textContent = t;
    const tip = 'Шаг за кадр ' + t + (rt ? ' · ' + rt : '') + ' · щелчок — ввести обороты за кадр точно (дробь 1/2 или число)'; if (rateV.title !== tip && !rateV.dataset.hubTip) rateV.title = tip;
    window.ZerkPult?.sync(pult, (+range.value || 0) / 601);
    frame.setAttribute('aria-pressed', old.frame()?.getAttribute('aria-pressed') || 'false');
    free.setAttribute('aria-pressed', old.free()?.getAttribute('aria-pressed') || 'false');
    for (const b of ['0', '1']) { const x = old.tilt(b), v = b + ' · ' + (x ? x.value : 0) + '°'; if (tiltV[b].textContent !== v) tiltV[b].textContent = v; }
  }

  function init() {
    if (!Z() || !old.play()) { setTimeout(init, 200); return; }
    build(); sync();
    setInterval(sync, 250);
    for (const ev of ['hubmirror', 'hubview', 'resize']) addEventListener(ev, () => requestAnimationFrame(sync));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
