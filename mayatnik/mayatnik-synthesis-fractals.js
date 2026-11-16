/* Маятник · Синтез 0.010. Клеточные строки, Стрелка и Игра хаоса. */
(function (root) {
  'use strict';

  const directions = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
  const rules = { A: 'B-A-B', B: 'A+B+A', '+': '+', '-': '-' };
  const fifths = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F'];
  const chaosPointCount = 4096;

  function arrowhead(depth) {
    let word = 'A';
    for (let level = 0; level < depth; level++) {
      word = Array.from(word, command => rules[command]).join('');
    }
    let heading = depth % 2;
    let q = 0, r = 0;
    let minX = 0, minY = 0, maxX = 0, maxY = 0;
    const points = [[0, 0]];
    for (const command of word) {
      if (command === '+' || command === '-') {
        heading = (heading + (command === '+' ? 1 : 5)) % 6;
        continue;
      }
      const [dq, dr] = directions[heading];
      q += dq;
      r += dr;
      const x = q + r / 2, y = -r * Math.sqrt(3) / 2;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      points.push([x, y]);
    }
    return { kind: 'arrowhead', length: points.length - 1, points, minX, minY, spanX: maxX - minX, spanY: maxY - minY };
  }

  function rule90(depth) {
    const length = 2 ** depth;
    const center = length - 1;
    let state = new Uint8Array(center * 2 + 1);
    state[center] = 1;
    const rows = [];
    for (let t = 0; t < length; t++) {
      const active = [];
      const next = new Uint8Array(state.length);
      for (let x = 0; x < state.length; x++) {
        if (state[x]) active.push(x);
        next[x] = (state[x - 1] || 0) ^ (state[x + 1] || 0);
      }
      rows.push(active);
      state = next;
    }
    return { kind: 'rule90', length, width: state.length, rows };
  }

  function chaos({ vertices, jump, noRepeat, seed, batch }) {
    const corners = Array.from({ length: vertices }, (_, index) => {
      const angle = (index / vertices - .25 + (vertices === 4 ? .125 : 0)) * 2 * Math.PI;
      return { x: Math.cos(angle), y: Math.sin(angle), note: Math.round(index * 12 / vertices) };
    });
    let state = seed >>> 0;
    function randomIndex(size) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return Math.floor((state >>> 0) / 4294967296 * size);
    }
    let { x, y } = corners[0];
    let previous = -1;
    const points = [];
    for (let i = 0; i < chaosPointCount; i++) {
      const exclude = noRepeat && previous >= 0;
      let index = randomIndex(vertices - Number(exclude));
      if (exclude && index >= previous) index++;
      const corner = corners[index];
      x += (corner.x - x) * jump;
      y += (corner.y - y) * jump;
      points.push({ x, y, index });
      previous = index;
    }
    return { kind: 'chaos', length: chaosPointCount / batch, corners, points, batch };
  }

  function chaosNote(model, steps) {
    const latest = model.points[steps * model.batch - 1];
    if (!latest) return null;
    const corner = model.corners[latest.index];
    return { label: fifths[corner.note], midi: 60 + corner.note * 7 % 12, pan: corner.x * .6 };
  }

  function paintChaos(ctx, model, steps, width, height, colour) {
    const radius = Math.min(width, height) * .42;
    const px = x => width / 2 + radius * x;
    const py = y => height / 2 + radius * y;
    const count = steps * model.batch;
    ctx.fillStyle = colour;
    for (let i = 0; i < count; i++) {
      const point = model.points[i];
      ctx.fillRect(Math.floor(px(point.x)), Math.floor(py(point.y)), 1, 1);
    }
    const latest = model.points[count - 1];
    const dot = (point, size) => {
      ctx.beginPath();
      ctx.arc(px(point.x), py(point.y), size, 0, Math.PI * 2);
      ctx.fill();
    };
    model.corners.forEach((corner, i) => {
      ctx.fillStyle = i === latest?.index ? '#fff' : '#6b8797';
      dot(corner, Math.max(1, radius * (i === latest?.index ? .03 : .018)));
    });
    ctx.fillStyle = '#fff';
    dot(latest || model.corners[0], Math.max(1, radius * .015));
  }

  function paint(ctx, model, steps, width, height, colour) {
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, width, height);
    const count = Math.max(0, Math.min(model.length, steps));
    if (model.kind === 'chaos') {
      paintChaos(ctx, model, count, width, height, colour);
      return;
    }
    const w = width * .88, h = height * .88;
    if (model.kind === 'rule90') {
      const unit = Math.min(w / model.width, h / model.length);
      const left = (width - model.width * unit) / 2, top = (height - model.length * unit) / 2;
      const size = Math.max(1, unit * .82);
      ctx.fillStyle = colour;
      for (let y = 0; y < count; y++) {
        for (const x of model.rows[y]) {
          ctx.fillRect(left + x * unit, top + y * unit, size, size);
        }
      }
      return;
    }

    const { minX, minY, spanX, spanY } = model;
    const scale = Math.min(w / spanX, h / spanY);
    const left = (width - spanX * scale) / 2, top = (height - spanY * scale) / 2;
    const point = index => [
      left + (model.points[index][0] - minX) * scale,
      top + (model.points[index][1] - minY) * scale
    ];
    ctx.save();
    ctx.strokeStyle = ctx.fillStyle = colour;
    ctx.lineWidth = Math.max(1, Math.min(width, height) / 120);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (count > 0) {
      ctx.beginPath();
      ctx.moveTo(...point(0));
      for (let i = 1; i <= count; i++) ctx.lineTo(...point(i));
      ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(...point(count), ctx.lineWidth * 1.35, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }

  root.MayatnikSynthesisFractals = { arrowhead, rule90, chaos, chaosNote, paint };
})(window);
