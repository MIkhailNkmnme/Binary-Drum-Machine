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
  let box, zoomRow, backB, fwdB, resetB, scaleV, pult, play, range, rateV, frame, free, tiltV = {};

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
    const zr = zoomRow = el('div', 'hpRow hpZoom');
    scaleV = el('output', 'hpB hpVal', '100%', 'Масштаб холста · колесо — шаг · двойной щелчок — весь рисунок в поле');
    scaleV.addEventListener('wheel', e => { e.preventDefault(); (e.deltaY < 0 ? old.plus() : old.minus())?.click(); sync(); }, { passive: false });
    scaleV.addEventListener('dblclick', () => { old.home()?.click(); sync(); });
    zr.append(btn('hpHome', '⌂', 'Вернуть рисунок и ось в центр: масштаб 100%, повороты 0°, остановить вращение', press(old.home)),
      btn('hpR', '+', 'Увеличить масштаб', press(old.plus)), scaleV, btn('hpL', '−', 'Уменьшить масштаб', press(old.minus)));   // v0.280: «масштаб оставь и переверни вертикально» — сверху вниз ⌂ + 100% −

    // 2. вращение — общий пульт пуска (zz-pult): ◀ ▶, ромб пуска на дорожке скорости, подпись
    pult = el('div', 'zz-pult hpSpin'); pult.dataset.play = '18'; pult.dataset.cap = '30'; pult.dataset.body = '30';   // «уменьши высоту до уровня кнопок» — пульт 30 px   // ромб пуска вдвое уже — ход до самых стрелок
    const back = backB = btn('zz-pult-back', '◀', 'Стоит — повернуть поле на −15°; крутится — медленнее', press(old.left));
    const fwd = fwdB = btn('zz-pult-fwd', '▶', 'Стоит — повернуть поле на +15°; крутится — быстрее', press(old.right));
    range = el('input', 'zz-pult-range'); range.type = 'range'; range.min = 0; range.max = 601; range.step = 1; range.setAttribute('aria-label', 'Скорость вращения');
    range.addEventListener('input', () => { const r = old.range(); if (!r) return; r.value = range.value; fire(r, 'input'); sync(); });
    play = btn('zz-pult-play', '▶', 'Вращение треугольника: пуск / пауза · тянуть вдоль — скорость · двойной щелчок — стоп и 0°', press(old.play));
    play.addEventListener('dblclick', e => { e.preventDefault(); range.value = 0; fire(range, 'input'); sync(); });
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
    const thLine = el('span', 'hpThLine');   // «при наведении на бегунок — вертикальный пунктир поверх, чуть выше»
    pult.append(back, range, play, rateV, fwd, thLine);
    range.addEventListener('dblclick', () => { range.value = 0; fire(range, 'input'); });   // v0.280: двойной щелчок по дорожке — скорость 0

    // 3. кадр и поворот битов: ▣ кадр · 0 ◂ 0° ▸ · 1 ◂ 0° ▸ · ↺ · 360°
    const br = el('div', 'hpRow hpBits');
    frame = btn('hpFrame', '▣ кадр', 'Точный шаг вращения на каждый кадр', press(old.frame));
    // «кадр — перемести во «Вращение»»: кнопка в рейке (hub-grozd.js), здесь не показывается; frame живёт для sync
    for (const b of ['0', '1']) {
      const control = el('span', 'hpTiltControl'); control.dataset.bit = b;
      control.setAttribute('role', 'group'); control.setAttribute('aria-label', 'Наклон битов ' + b);
      const l = btn('hpL', '◂', 'Наклон битов ' + b + ' — против часовой на 15° (Shift — на 1°), удержание — дальше', () => {}),
        r = btn('hpR', '▸', 'Наклон битов ' + b + ' — по часовой на 15° (Shift — на 1°), удержание — дальше', () => {});
      hold(l, e => tiltBy(b, e.shiftKey ? -1 : -15)); hold(r, e => tiltBy(b, e.shiftKey ? 1 : 15));
      tiltV[b] = el('output', 'hpB hpVal hpTilt', '0°', 'Наклон битов ' + b + ' · колесо — на 1° · двойной щелчок — 0°');
      tiltV[b].addEventListener('dblclick', () => { const x = old.tilt(b); if (x && +x.value !== 0) { x.value = 0; fire(x, 'input'); fire(x, 'change'); } sync(); });   // v0.280: двойной щелчок — 0°
      tiltV[b].addEventListener('wheel', e => { e.preventDefault(); tiltBy(b, e.deltaY < 0 ? 1 : -1); sync(); }, { passive: false });
      control.append(l, tiltV[b], r); br.append(control);
      if (b === '0') br.append(resetB = btn('hpReset', '360', 'Свободный поворот битов: включено — полный круг, выключено — стоп на ±60°', press(old.free)));   // «360 вращ. — перемести вместо ↺, её убери (дубль)»: сброс наклона — двойной щелчок по углу   // «её между ними формой X» — ↺ между наклонами 0 и 1, выемки под их острия
    }
    // «правой кнопкой по 360 — автоповорот битов со скоростью ползунка, ползунок справа»: оба наклона (0 и 1) крутятся по кругу,
    // свободный поворот включается сам; ползунок °/с — справа от наклонов, пока крутится; скорость помнится
    { const KEY = 'zerk_hub_bitspin'; let sv = {}; try { sv = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) {}
      let speed = Number.isFinite(sv.speed) ? sv.speed : 30, raf = 0, last = 0, acc = 0;
      const box = el('span', 'hpSpinBox'), rng = document.createElement('input'), out = el('span', 'hpSpinV');
      rng.type = 'range'; rng.min = '1'; rng.max = '180'; rng.step = '1'; rng.value = String(speed); rng.setAttribute('aria-label', 'Скорость автоповорота битов, °/с');
      box.title = 'Скорость автоповорота битов · правый щелчок по «360» — стоп'; box.append(rng, out);
      const show = () => { out.textContent = speed + '°/с'; };
      rng.addEventListener('input', () => { speed = +rng.value; show(); try { localStorage.setItem(KEY, JSON.stringify({ speed })); } catch (_) {} });
      for (const t of ['pointerdown', 'wheel', 'dblclick']) box.addEventListener(t, e => e.stopPropagation(), { passive: true });
      const wrap = v => { while (v > 180) v -= 360; while (v < -180) v += 360; return v; };
      const tick = t => { raf = requestAnimationFrame(tick); if (!last) { last = t; return; } acc += speed * Math.min(.5, (t - last) / 1000); last = t;
        const n = Math.trunc(acc); if (!n) return; acc -= n;
        for (const b of ['0', '1']) { const r = old.tilt(b); if (!r) continue; r.value = String(wrap(+r.value + n)); fire(r, 'input'); } };
      const run = on => { if (on === !!raf) return;
        if (on) { const f = old.free(); if (f && f.getAttribute('aria-pressed') !== 'true') f.click(); last = 0; acc = 0; raf = requestAnimationFrame(tick); }
        else { cancelAnimationFrame(raf); raf = 0; for (const b of ['0', '1']) { const r = old.tilt(b); if (r) fire(r, 'change'); } }
        box.classList.toggle('on', !!raf); resetB?.classList.toggle('hpSpin', !!raf); };
      show(); br.append(box);
      resetB?.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); run(!raf); });
      if (resetB) resetB.title += ' · правый щелчок — автоповорот битов (ползунок скорости справа)';
      window.HubBitSpin = { get on() { return !!raf; }, run, get speed() { return speed; } };
      let resumeSpin = false; addEventListener('hubmotionpause', e => { if (e.detail.paused) { resumeSpin = !!raf; run(false); } else { if (resumeSpin) run(true); resumeSpin = false; } }); }   // v0.377: общая пауза — и автоповорот битов
    free = btn('hpFree', '360°', 'Свободный поворот битов: включено — полный круг, выключено — стоп на ±60°', press(old.free));
    // 360° на пульте не показывается (кнопка «360°» осталась в рейке); free живёт для sync

    // v0.280: «пульт в самый низ в одну строку справа, слева от ползунка» — масштаб у креста столбиком, вращение и биты — строкой внизу справа
    const bot = el('div'); bot.id = 'hubPultBot'; bot.className = 'hpRow';
    for (const t of ['pointerdown', 'dblclick', 'contextmenu']) bot.addEventListener(t, e => e.stopPropagation());
    bot.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
    bot.append(pult, br);   // «пульт посередине, справа от него — вращение битов»
    box.append(zr); document.body.append(box, bot); document.body.classList.add('hubPultOn');
  }

  function rgba(hex, a) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return hex;
    const n = parseInt(m[1], 16); return 'rgba(' + (n >> 16) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  // v0.284: «дзен сюда вниз» — ромб «Дзен» под столбиком ⌂ + 100% −; в дзене столбик спрятан, ромб остаётся на месте
  function placeZen() {
    const z = document.getElementById('hubZenToggle'); if (!z) return;
    if (zoomRow?.getClientRects().length) {
      const r = zoomRow.getBoundingClientRect(), w = z.offsetWidth || 48;
      z.style.left = Math.round(r.left + r.width / 2 - w / 2) + 'px'; z.style.top = Math.round(r.bottom + 8) + 'px';
      z.style.right = 'auto'; z.style.bottom = 'auto';
    } else if (!document.body.classList.contains('hubZen')) for (const k of ['left', 'top', 'right', 'bottom']) z.style[k] = '';
    placeSaves(z);
  }
  // «сохр. и видео перенеси под дзен-кнопку и не убирай при дзене»: ромбы PNG и ⏺ под «Дзен» — жмут настоящие кнопки (они в дереве меню)
  let saves = null;
  function placeSaves(z) {
    if (!saves) {
      const mk = (id, text, src) => { const b = document.createElement('button'); b.type = 'button'; b.id = id; b.className = 'hubZenSave'; b.textContent = text;
        b.addEventListener('click', () => document.getElementById(src)?.click()); document.body.append(b); return b; };
      saves = [mk('hubZenPng', 'PNG', 'hubPNG'), mk('hubZenRec', '⏺'+String.fromCharCode(10)+'Видео', 'hubRec'), mk('hubZenSys', '🔊'+String.fromCharCode(10)+'ПК', 'hubRecSys')];   // v0.389: звук компьютера в видео
    }
    const [png, rec, sys] = saves, r = z.getBoundingClientRect(), w = r.width || 48, gap = 6, below = r.bottom + saves.length * (w + gap) <= innerHeight;
    saves.forEach((b, i) => { b.style.left = Math.round(r.left) + 'px'; b.style.top = Math.round(below ? r.bottom + gap + i * (w + gap) : r.top - (i + 1) * (w + gap)) + 'px'; });
    const o = document.getElementById('hubRec'), on = !!o?.classList.contains('on');
    rec.classList.toggle('on', on); if (o && rec.title !== o.title) { rec.title = o.title; rec.setAttribute('aria-label', 'Видео: старт / стоп'); }
    const so = document.getElementById('hubRecSys'); if (so) { sys.classList.toggle('on', so.getAttribute('aria-pressed') === 'true'); if (sys.title !== so.title) { sys.title = so.title; sys.setAttribute('aria-label', 'Звук ПК в видео: вкл / выкл'); } }
    const p = document.getElementById('hubPNG'); if (p && png.title !== p.title) { png.title = p.title; png.setAttribute('aria-label', p.getAttribute('aria-label') || 'PNG'); }
  }

  function sync() {
    if (!box) return;
    const s = old.scale(); if (s && scaleV.textContent !== s.textContent) scaleV.textContent = s.textContent;
    const r = old.range(); if (r && document.activeElement !== range && range.value !== r.value) range.value = r.value;
    const p = old.play(), on = p?.getAttribute('aria-pressed') === 'true' || document.body.classList.contains('hubAutoTurning');
    play.setAttribute('aria-pressed', String(on)); const pt = on ? '❚❚' : '▶'; if (play.textContent !== pt) play.textContent = pt;
    const bt = on ? '◀' : '↺', ft = on ? '▶' : '↻';   // «когда стрелки поворачивают весь холст — значок по часовой и против»
    if (backB.textContent !== bt) backB.textContent = bt; if (fwdB.textContent !== ft) fwdB.textContent = ft;
    const t = (old.angle()?.textContent || '').trim(), rt = (old.rate()?.textContent || '').trim();   // подпись — шаг за кадр; обороты за кадр — в подсказке
    if (rateV.textContent !== t) rateV.textContent = t;
    const tip = 'Шаг за кадр ' + t + (rt ? ' · ' + rt : '') + ' · щелчок — ввести обороты за кадр точно (дробь 1/2 или число)'; if (rateV.title !== tip && !rateV.dataset.hubTip) rateV.title = tip;
    window.ZerkPult?.sync(pult, (+range.value || 0) / 601);
    frame.setAttribute('aria-pressed', old.frame()?.getAttribute('aria-pressed') || 'false');
    free.setAttribute('aria-pressed', old.free()?.getAttribute('aria-pressed') || 'false');
    const colors = window.HubMirror?.colors();
    placeZen();
    const bot = document.getElementById('hubPultBot');
    if (bot && colors?.bit) {   // v0.284: «пульт тоже в цвет битов»
      const a0 = window.HubMirror?.state?.zeroAlpha ?? .18, z = colors.zero || colors.bit;
      bot.style.setProperty('--hp-b1', colors.bit); bot.style.setProperty('--hp-b0', z);
      bot.style.setProperty('--hp-b0f', rgba(z, a0)); bot.style.setProperty('--hp-b0a', rgba(z, Math.min(1, a0 + .25))); bot.style.setProperty('--hp-b0o', 'color-mix(in srgb,' + z + ' ' + Math.round(a0 * 100) + '%,#060606)');
    }
    let tilted = false;
    for (const b of ['0', '1']) {
      const x = old.tilt(b), v = (x ? x.value : 0) + '°'; if (x && +x.value !== 0) tilted = true; if (tiltV[b].textContent !== v) tiltV[b].textContent = v; tiltV[b].parentElement.classList.toggle('hpAt0', !x || +x.value === 0);   // «при 0° — убавить яркость»: без смещения деталь притушена
      const color = colors?.[b === '0' ? 'zero' : 'bit'];
      if (color) {   // v0.284: «углы в цвет соответствующих битов» — деталь как ромб бита: 0 — тёмная с цветными цифрами, 1 — цветная с тёмными; стрелки — своим фоном
        const c = tiltV[b].parentElement, a = b === '0' ? (window.HubMirror?.state?.zeroAlpha ?? .18) : 1;
        c.style.setProperty('--hp-c', color);
        c.style.setProperty('--hp-fill', rgba(color, a));
        c.style.setProperty('--hp-ink', b === '0' ? color : '#1c1c22');
        c.style.setProperty('--hp-arrow', b === '0' ? color : 'color-mix(in srgb,' + color + ' 40%,#000)');   // «не вижу» стрелок: стрелка — наоборот к детали, знак контрастом к своему фону
        c.style.setProperty('--hp-arrow-ink', b === '0' ? '#1c1c22' : color);
      }
    }
    resetB?.classList.toggle('hpTilted', old.free()?.getAttribute('aria-pressed') === 'true');   // 360 — светится, пока свободный поворот включён   // «цвет — когда повёрнуты от 0, а когда 0 — без фона»
  }

  function init() {
    if (!Z() || !old.play()) { setTimeout(init, 200); return; }
    build(); sync();
    setInterval(sync, 250);
    for (const ev of ['hubmirror', 'hubview', 'resize']) addEventListener(ev, () => requestAnimationFrame(sync));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
