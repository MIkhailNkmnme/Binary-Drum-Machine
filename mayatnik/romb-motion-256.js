(() => {
  "use strict";

  const byId = id => document.getElementById(id);
  const board = byId("motion-board");
  const context = board.getContext("2d");
  const label = byId("motion-state");
  if (!context) {
    byId("motion-controls").disabled = true;
    byId("motion-frame").disabled = true;
    label.textContent = "Не удалось открыть холст Маятника.";
    return;
  }

  const height = 256;
  const depth = height / 2;
  const radius = depth - 1;
  const size = board.width;
  const left = radius;
  const right = size - 1 - radius;
  const bottom = size - height;
  const center = [(left + right) / 2, Math.floor(bottom / 2)];
  const [x, y] = center;
  const routes = {
    circle: {label: "→ ↑ ← ↓", vertices: [[left, bottom], [right, bottom], [right, 0], [left, 0]]},
    reverse: {label: "→ ↓ ← ↑", vertices: [[left, 0], [right, 0], [right, bottom], [left, bottom]]},
    horizontal: {label: "Крест → ← ↑ ↓", vertices: [center, [right, y], center, [left, y], center, [x, 0], center, [x, bottom]]},
    vertical: {label: "Крест ↑ ↓ → ←", vertices: [center, [x, 0], center, [x, bottom], center, [right, y], center, [left, y]]}
  };
  const colors = new Uint32Array(Uint8Array.of(12, 29, 43, 255, 28, 86, 111, 255, 221, 241, 235, 255).buffer);
  const outline = ["#ffca74", "#8fdcf4"];
  const values = new Int8Array(size * size);
  const raster = context.createImageData(size, size);
  const pixels = new Uint32Array(raster.data.buffer);
  const checkpoints = new Map();
  const every = 32;
  const controls = {
    frame: byId("motion-frame"), step: byId("motion-step"), speed: byId("motion-speed"),
    guide: byId("motion-guide"), delay: byId("motion-delay"), reset: byId("motion-reset"),
    previous: byId("motion-prev"), next: byId("motion-next"),
    back: byId("motion-play-back"), forward: byId("motion-play-forward"),
    routes: [...document.querySelectorAll("[data-motion]")]
  };
  const preferencesKey = "zerk_romb_motion_256";
  const fmt = new Intl.NumberFormat("ru");
  let path, end, frame, mode, guide;
  let playback = 0, lastDirection = 1, request = 0, lastTime = 0;

  function points(vertices) {
    const result = [];
    for (const [i, [ax, ay]] of vertices.entries()) {
      const [bx, by] = vertices[(i + 1) % vertices.length];
      const dx = Math.sign(bx - ax);
      const dy = Math.sign(by - ay);
      const length = Math.abs(bx - ax) + Math.abs(by - ay);
      for (let step = 0; step < length; step++) result.push([ax + dx * step, ay + dy * step]);
    }
    return result;
  }

  function branchAt(at, branch) {
    const moved = Math.max(0, Math.floor((at - 1 - branch) / 2));
    return path[(moved + branch * path.length / 2) % path.length];
  }

  function pass([column, top]) {
    // Share the rows with the field so each pass can read the preceding bits.
    const val = values.subarray(top * size, (top + height) * size);
    MAYATNIK.cone({W: size, H: height, val}, column, depth);
    let first = column - radius;
    let rightmost = column + radius;
    for (let col = first; col <= rightmost; col += 2) {
      const i = depth * size + col;
      val[i] = MAYATNIK.accumulateBit(val[i], Number(val[i - size] === 1));
    }
    for (let row = depth + 1; row < height; row++) {
      first++;
      rightmost--;
      let prefix = 0;
      for (let col = first; col <= rightmost; col += 2) {
        const i = row * size + col;
        prefix ^= Number(val[i - size - 1] === 1);
        val[i] = MAYATNIK.accumulateBit(val[i], prefix);
      }
    }
  }

  function paint() {
    for (let i = 0; i < pixels.length; i++) pixels[i] = colors[values[i] + 1];
    context.putImageData(raster, 0, 0);
    if (!guide) return;

    context.save();
    context.lineWidth = 1;
    context.setLineDash([4, 5]);
    context.strokeStyle = "#ffffff64";
    context.beginPath();
    for (const [i, [column, top]] of routes[mode].vertices.entries()) {
      if (i) context.lineTo(column + .5, top + depth);
      else context.moveTo(column + .5, top + depth);
    }
    context.closePath();
    context.stroke();
    context.setLineDash([]);

    for (const branch of [0, 1]) {
      const [column, top] = branchAt(frame, branch);
      context.strokeStyle = outline[branch];
      context.globalAlpha = frame && ((frame - 1) & 1) === branch ? 1 : .55;
      context.beginPath();
      context.moveTo(column + .5, top + .5);
      context.lineTo(column + radius + .5, top + depth);
      context.lineTo(column + .5, top + height - .5);
      context.lineTo(column - radius + .5, top + depth);
      context.closePath();
      context.stroke();
    }
    context.restore();
  }

  function sync() {
    controls.frame.value = frame;
    const position = frame ? branchAt(frame, (frame - 1) & 1) : null;
    label.textContent = "Кадр " + fmt.format(frame) + " / " + fmt.format(end) + " · " + routes[mode].label +
      (position ? " · вершина, строка " + (position[1] + 1) + ", столбец " + (position[0] + 1) : "");
    controls.previous.disabled = controls.back.disabled = frame === 0;
    controls.next.disabled = controls.forward.disabled = frame === end;
    controls.back.setAttribute("aria-pressed", String(playback === -1));
    controls.forward.setAttribute("aria-pressed", String(playback === 1));
    controls.guide.setAttribute("aria-pressed", String(guide));
  }

  function goTo(target) {
    target = Math.max(0, Math.min(end, target));
    const saved = Math.floor(target / every) * every;
    if (target < frame || (saved > frame && checkpoints.has(saved))) {
      values.set(checkpoints.get(saved));
      frame = saved;
    }
    while (frame < target) {
      frame++;
      pass(branchAt(frame, (frame - 1) & 1));
      if (frame % every === 0 && !checkpoints.has(frame)) checkpoints.set(frame, values.slice());
    }
    paint();
    sync();
  }

  function stop() {
    playback = 0;
    cancelAnimationFrame(request);
    sync();
  }

  function stepCount() {
    return Math.max(1, Math.min(end, Math.round(controls.step.valueAsNumber) || 1));
  }

  function tick(time) {
    if (!playback) return;
    if (time - lastTime >= Number(controls.speed.value)) {
      lastTime = time;
      goTo(frame + playback * stepCount());
      if ((playback < 0 && frame === 0) || (playback > 0 && frame === end)) {
        stop();
        return;
      }
    }
    request = requestAnimationFrame(tick);
  }

  function play(direction) {
    if (playback === direction) {
      stop();
      return;
    }
    if ((direction < 0 && !frame) || (direction > 0 && frame === end)) return;
    cancelAnimationFrame(request);
    lastDirection = playback = direction;
    lastTime = -Infinity;
    request = requestAnimationFrame(tick);
    sync();
  }

  function reset(route, initialFrame) {
    cancelAnimationFrame(request);
    playback = 0;
    mode = route;
    path = points(routes[mode].vertices);
    end = 2 * path.length;
    controls.frame.max = controls.step.max = end;
    frame = 0;
    values.fill(-1);
    checkpoints.clear();
    checkpoints.set(0, values.slice());
    for (const button of controls.routes) button.setAttribute("aria-pressed", String(button.dataset.motion === mode));
    goTo(initialFrame);
  }

  function save() {
    try {
      localStorage.setItem(preferencesKey, JSON.stringify({mode, guide, speed: controls.speed.value, step: stepCount()}));
    } catch { /* Preference storage is optional. */ }
  }

  function togglePlayback() {
    if (playback) {
      stop();
      return;
    }
    play(frame === 0 ? 1 : frame === end ? -1 : lastDirection);
  }

  for (const button of controls.routes) button.addEventListener("click", () => {
    if (button.dataset.motion === mode) return;
    reset(button.dataset.motion, 1);
    save();
  });
  controls.guide.addEventListener("click", () => {
    guide = !guide;
    paint();
    sync();
    save();
  });
  controls.reset.addEventListener("click", () => reset(mode, 0));
  controls.back.addEventListener("click", () => play(-1));
  controls.forward.addEventListener("click", () => play(1));
  function step(direction) {
    stop();
    goTo(frame + direction * stepCount());
  }
  controls.previous.addEventListener("click", () => step(-1));
  controls.next.addEventListener("click", () => step(1));
  controls.step.addEventListener("change", () => {
    controls.step.value = stepCount();
    save();
  });
  controls.speed.addEventListener("input", () => {
    controls.delay.textContent = "Интервал · " + controls.speed.value + " мс";
    save();
  });
  controls.frame.addEventListener("input", () => {
    const target = controls.frame.valueAsNumber;
    stop();
    goTo(target);
  });
  board.addEventListener("dblclick", togglePlayback);
  board.addEventListener("keydown", event => {
    switch (event.key) {
      case " ": togglePlayback(); break;
      case "ArrowLeft": step(-1); break;
      case "ArrowRight": step(1); break;
      default: return;
    }
    event.preventDefault();
  });

  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(preferencesKey)) || {}; } catch { /* Use defaults. */ }
  guide = stored.guide !== false;
  if (Number(stored.speed) >= 20 && Number(stored.speed) <= 600) controls.speed.value = stored.speed;
  if (Number.isInteger(stored.step) && stored.step > 0) controls.step.value = stored.step;
  controls.delay.textContent = "Интервал · " + controls.speed.value + " мс";
  reset(Object.hasOwn(routes, stored.mode) ? stored.mode : "circle", 1);
  controls.step.value = stepCount();
})();
