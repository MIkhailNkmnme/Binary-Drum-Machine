/* Hub v0.103: передвижное зеркало, наклон битов и отдельный световой след; исходные биты и звук не меняются. */
(() => {
  'use strict';
  const state = { on: true, angle: Math.PI / 2, x: .5, y: .5, zero: 0, one: 0, trace: false }, clamp = v => Math.max(.01, Math.min(.99, v));
  try {
    const saved = JSON.parse(localStorage.getItem('zerk_hub_mirror') || 'null');
    if (saved) {
      state.on = saved.on !== false;
      state.trace = saved.trace === true;
      state.angle = typeof saved.angle === 'number' && Number.isFinite(saved.angle) ? saved.angle % Math.PI : saved.axis === 'h' ? 0 : Math.PI / 2;
      for (const k of ['x', 'y']) if (typeof saved[k] === 'number' && Number.isFinite(saved[k])) state[k] = clamp(saved[k]);
      for (const k of ['zero', 'one']) if (typeof saved[k] === 'number' && Number.isFinite(saved[k])) state[k] = Math.max(-60, Math.min(60, saved[k]));
    }
  } catch (_) {}
  let frame = null, root = null, line = null, handle = null, turn = null, drag = null, revision = 0, enabled = null;
  const buffers = new WeakMap();
  const save = () => { try { localStorage.setItem('zerk_hub_mirror', JSON.stringify(state)); } catch (_) {} };
  const center = () => [frame.left + frame.width * state.x, frame.height * state.y];
  const update = () => {
    if (!root || !frame) return;
    const length = Math.hypot(frame.width, frame.height) * 2 + 40, mobile = matchMedia('(max-width: 1100px)').matches;
    root.classList.toggle('off', !state.on);
    if (enabled) enabled.checked = state.on;
    Object.assign(root.style, { position: mobile ? 'absolute' : 'fixed', left: frame.left + 'px', top: '0px', width: frame.width + 'px', height: frame.height + 'px' });
    Object.assign(line.style, { left: (frame.width * state.x - length / 2) + 'px', top: (frame.height * state.y - 10) + 'px', width: length + 'px', transform: 'rotate(' + state.angle + 'rad)' });
    handle.style.transform = 'translateX(-50%) rotate(' + (-state.angle) + 'rad)';
    turn.style.left = (length / 2 + Math.min(frame.width, frame.height) * .22) + 'px';
    handle.textContent = state.on ? '◇' : '×';
    handle.title = 'Зеркало: тяни ромб или линию; маленькая ручка — наклон; щелчок по ромбу — поворот на 15°; правый щелчок — вкл / выкл';
    handle.setAttribute('aria-label', 'Зеркало ' + (state.on ? 'включено' : 'выключено') + ', наклон ' + Math.round(state.angle * 180 / Math.PI) + ' градусов');
    turn.title = 'Повернуть зеркало: тяни ручку или крути колесо';
  };
  const changed = () => { revision++; update(); window.dispatchEvent(new Event('hubmirror')); };
  const rotate = delta => { state.angle = (state.angle + delta + Math.PI) % Math.PI; changed(); save(); };
  function init() {
    root = document.createElement('div'); root.id = 'hubMirror';
    line = document.createElement('div'); line.className = 'hubMirrorLine';
    handle = document.createElement('button'); handle.type = 'button'; handle.className = 'hubMirrorHandle';
    turn = document.createElement('button'); turn.type = 'button'; turn.className = 'hubMirrorTurn'; turn.setAttribute('aria-label', 'Повернуть зеркало');
    line.append(handle, turn); root.append(line); document.body.append(root);
    const settings = document.createElement('div'); settings.className = 'hubMirrorSettings';
    settings.addEventListener('click', e => e.stopPropagation());
    const toggle = document.createElement('label');
    enabled = document.createElement('input'); enabled.type = 'checkbox'; enabled.checked = state.on;
    toggle.append(enabled, document.createTextNode(' ◇ Зеркало')); settings.append(toggle);
    enabled.addEventListener('change', () => { state.on = enabled.checked; changed(); save(); });
    const traceLabel = document.createElement('label'), trace = document.createElement('input');
    trace.type = 'checkbox'; trace.checked = state.trace;
    traceLabel.append(trace, document.createTextNode(' ↓ След единиц')); settings.append(traceLabel);
    traceLabel.title = 'Две световые дорожки вниз через 0 и 1; исходные биты не меняются';
    trace.addEventListener('change', () => { state.trace = trace.checked; changed(); save(); });
    for (const [key, bit] of [['zero', '0'], ['one', '1']]) {
      const label = document.createElement('label'), range = document.createElement('input'), value = document.createElement('output');
      range.type = 'range'; range.min = '-60'; range.max = '60'; range.step = '1'; range.value = state[key];
      range.setAttribute('aria-label', 'Наклон ромбов ' + bit); value.textContent = state[key] + '°';
      label.append(document.createTextNode('Наклон ' + bit), range, value); settings.append(label);
      range.addEventListener('input', () => { state[key] = Number(range.value); value.textContent = state[key] + '°'; changed(); });
      range.addEventListener('change', save);
    }
    const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = '0° — сброс наклона битов'; settings.append(reset);
    reset.addEventListener('click', () => {
      state.zero = 0; state.one = 0; settings.querySelectorAll('input[type=range]').forEach(el => { el.value = '0'; });
      settings.querySelectorAll('output').forEach(el => { el.textContent = '0°'; }); changed(); save();
    });
    document.querySelector('.hub .mainrow')?.after(settings);
    root.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !frame) return;
      e.preventDefault(); e.stopPropagation();
      const r = root.getBoundingClientRect();
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, px: state.x, py: state.y, angle: state.angle,
        cx: r.left + frame.width * state.x, cy: r.top + frame.height * state.y,
        moved: false, handle: e.target === handle, turn: e.target === turn };
      drag.startAngle = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx);
      root.setPointerCapture(e.pointerId);
    });
    root.addEventListener('pointermove', e => {
      if (!drag || drag.id !== e.pointerId) return;
      e.preventDefault(); e.stopPropagation();
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 3) return;
      drag.moved = true;
      if (drag.turn) {
        if (Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) < 12) return;
        state.angle = ((drag.angle + Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx) - drag.startAngle) % Math.PI + Math.PI) % Math.PI;
      } else { state.x = clamp(drag.px + dx / frame.width); state.y = clamp(drag.py + dy / frame.height); }
      changed();
    });
    const finish = e => {
      if (!drag || drag.id !== e.pointerId) return;
      const done = drag; drag = null;
      if (root.hasPointerCapture(e.pointerId)) root.releasePointerCapture(e.pointerId);
      if (e.type === 'pointerup' && !done.moved && (done.handle || done.turn)) rotate(Math.PI / 12); else save();
    };
    root.addEventListener('pointerup', finish); root.addEventListener('pointercancel', finish);
    root.addEventListener('lostpointercapture', () => { if (drag) { drag = null; save(); } });
    root.addEventListener('click', e => { e.stopPropagation(); if (e.detail === 0 && (e.target === handle || e.target === turn)) rotate(Math.PI / 12); });
    root.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); state.on = !state.on; changed(); save(); });
    turn.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); rotate(Math.sign(e.deltaY) * Math.PI / 36); }, { passive: false });
    root.addEventListener('keydown', e => {
      if (!frame) return;
      const delta = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] })[e.key];
      if (!delta) return;
      e.preventDefault(); e.stopPropagation(); const step = e.shiftKey ? 20 : 4;
      state.x = clamp(state.x + delta[0] * step / frame.width); state.y = clamp(state.y + delta[1] * step / frame.height);
      changed(); save();
    });
    update();
  }
  window.HubMirror = {
    state, get revision() { return revision; },
    bitAngle(bit) { return (bit === '0' ? state.zero : state.one) * Math.PI / 180; },
    place(left, width, height) { frame = { left, width, height }; update(); },
    point(x, y) {
      if (!frame || !state.on) return null;
      const [cx, cy] = center(), nx = -Math.sin(state.angle), ny = Math.cos(state.angle), distance = (x - cx) * nx + (y - cy) * ny;
      return [x - 2 * distance * nx, y - 2 * distance * ny];
    },
    contains(x, y, w, h) { return frame && x - w / 2 >= frame.left && x + w / 2 <= frame.left + frame.width && y - h / 2 >= 0 && y + h / 2 <= frame.height; },
    reflect(canvas) {
      if (!frame || !state.on || !canvas.width || !canvas.height) return;
      let source = buffers.get(canvas);
      if (!source) { source = document.createElement('canvas'); buffers.set(canvas, source); }
      if (source.width !== canvas.width || source.height !== canvas.height) { source.width = canvas.width; source.height = canvas.height; }
      const copy = source.getContext('2d'); copy.clearRect(0, 0, source.width, source.height); copy.drawImage(canvas, 0, 0);
      const g = canvas.getContext('2d'), sx = canvas.width / (frame.left + frame.width), sy = canvas.height / frame.height;
      const [cx, cy] = center(), a = Math.cos(2 * state.angle), b = Math.sin(2 * state.angle);
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.shadowBlur = 0;
      g.beginPath(); g.rect(frame.left * sx, 0, frame.width * sx, canvas.height); g.clip();
      g.setTransform(a, b * sy / sx, b * sx / sy, -a, (cx - a * cx - b * cy) * sx, (cy - b * cx + a * cy) * sy);
      g.drawImage(source, 0, 0); g.restore();
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
