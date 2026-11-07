/* СТЕНД-028. Direct integer coordinates: no allocation proportional to row number. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('ntCanvas'), ctx = canvas.getContext('2d');
  const input = $('ntLimit'), status = $('ntStatus'), error = $('ntError');
  const key = 'stend.number-triangle.row';
  let limit = 15n, top = 1n, offset = 0n, font = 14, drag = null;
  let width = 1, height = 420, rowHeight = 24, cellWidth = 30, count = 17;
  const value = (r, j) => {
    const k = r / 2n, odd = r % 2n;
    if (j < k) return 2n * (k - j);
    if (odd && j === k) return 1n;
    return 2n * (j - k - odd) + 3n;
  };
  function clamp() {
    const max = limit > BigInt(count) ? limit - BigInt(count) + 1n : 1n;
    top = top < 1n ? 1n : top > max ? max : top;
    const edge = limit - 1n;
    offset = offset < -edge ? -edge : offset > edge ? edge : offset;
  }
  function draw() {
    width = Math.max(1, canvas.getBoundingClientRect().width);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#04060a'; ctx.fillRect(0, 0, width, height);
    ctx.font = `${font}px Consolas, monospace`;
    rowHeight = Math.ceil(font * 1.7);
    count = Math.max(1, Math.floor((height - 16) / rowHeight));
    cellWidth = Math.ceil(ctx.measureText((limit + 1n).toString()).width + font);
    clamp();
    const half = cellWidth / 2, span = BigInt(Math.ceil(width / cellWidth) + 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let last = top;
    for (let line = 0; line < count; line++) {
      const r = top + BigInt(line);
      if (r > limit) break;
      last = r;
      let x = offset - span;
      // x and r-1 must have the same parity, including negative x.
      if ((x + r - 1n) % 2n !== 0n) x++;
      for (; x <= offset + span; x += 2n) {
        const j = (x + r - 1n) / 2n;
        if (j < 0n || j >= r) continue;
        const n = value(r, j);
        ctx.fillStyle = n === 1n ? '#ffffff' : n % 2n === 0n ? '#ffc343' : '#85cfff';
        ctx.fillText(n.toString(), width / 2 + Number(x - offset) * half, 12 + line * rowHeight);
      }
    }
    status.textContent = `Строки ${top}–${last} из ${limit} · шрифт ${font}px · чётные — золотые, нечётные — голубые, 1 — белая`;
  }
  function lastRows() { top = limit; draw(); }
  function rowText() {
    if (limit > 200n) {
      $('ntRow').textContent = `Строка ${limit}: целиком в текст выводятся строки до 200 чисел; большие строки смотрите в поле, перемещаясь к краям.`;
      return;
    }
    const cells = [];
    for (let j = 0n; j < limit; j++) cells.push(value(limit, j).toString());
    $('ntRow').textContent = `Строка ${limit}: ${cells.join('  ')}`;
  }
  function apply(text) {
    if (!/^[0-9]+$/.test(text.trim()) || BigInt(text.trim()) < 1n) {
      error.textContent = 'Введите целый номер от 1.';
      input.setAttribute('aria-invalid', 'true'); return;
    }
    limit = BigInt(text.trim()); input.value = limit.toString();
    error.textContent = ''; input.removeAttribute('aria-invalid'); offset = 0n;
    try { localStorage.setItem(key, input.value); } catch (_) {}
    rowText(); lastRows();
  }
  $('ntForm').addEventListener('submit', e => { e.preventDefault(); apply(input.value); });
  $('ntFirst').onclick = () => { top = 1n; offset = 0n; draw(); };
  $('ntLast').onclick = lastRows;
  $('ntLeft').onclick = () => { offset = -(limit - 1n); lastRows(); };
  $('ntRight').onclick = () => { offset = limit - 1n; lastRows(); };
  $('ntCenter').onclick = () => { offset = 0n; draw(); };
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    font = Math.min(40, Math.max(6, font + (e.deltaY < 0 ? 1 : e.deltaY > 0 ? -1 : 0)));
    draw();
  }, { passive: false });
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, top, offset };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    top = drag.top - BigInt(Math.round((e.clientY - drag.y) / rowHeight));
    offset = drag.offset - BigInt(Math.round((e.clientX - drag.x) / (cellWidth / 2)));
    draw();
  });
  const endDrag = e => { if (drag && drag.id === e.pointerId) drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);
  canvas.addEventListener('dblclick', () => { font = 14; offset = 0n; lastRows(); });
  new ResizeObserver(draw).observe(canvas);
  let saved = '15';
  try { saved = localStorage.getItem(key) || saved; } catch (_) {}
  apply(saved);
})();
