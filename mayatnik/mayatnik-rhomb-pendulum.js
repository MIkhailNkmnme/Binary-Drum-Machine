(() => {
  "use strict";

  const root = document.getElementById("rhomb-pendulum");
  const byId = id => root.querySelector("#" + id);
  const canvas = byId("romb-field");
  const frameLabel = byId("romb-frame");
  const announcement = byId("romb-announcement");
  const context = canvas.getContext("2d");
  if (!context) {
    byId("romb-controls").disabled = true;
    frameLabel.textContent = "Браузер не смог создать холст для битового поля.";
    return;
  }

  const size = byId("romb-size");
  const width = byId("romb-width");
  const stepSize = byId("romb-step-size");
  const speed = byId("romb-speed");
  const speedValue = byId("romb-speed-value");
  const play = byId("romb-play");
  const playIcon = byId("romb-play-icon");
  const stepButton = byId("romb-step");
  const backButton = byId("romb-step-back");
  const frameSlider = byId("romb-frame-slider");
  const cycleNote = byId("romb-cycle-note");
  const combineMode = byId("romb-combine");
  const flipSecond = byId("romb-flip");
  const combinedView = byId("romb-combined-view");
  const combinedCanvas = byId("romb-combined");
  const combinedContext = combinedCanvas.getContext("2d");
  const edgeButtons = {
    wrap: byId("romb-wrap"),
    joinLeft: byId("romb-join-left"),
    joinRight: byId("romb-join-right"),
    stopAtContact: byId("romb-stop-contact"),
    reverseAtContact: byId("romb-reverse-contact"),
    markRepeats: byId("romb-mark-repeats")
  };
  const options = {wrap: false, joinLeft: false, joinRight: false, stopAtContact: false, reverseAtContact: false, markRepeats: false};
  const storageKey = "zerk_mayatnik_rhomb";
  const inline = root.hasAttribute("data-romb-inline");
  const maxFrame = MayatnikEdgeFlow.MAX_FRAME;
  const formatter = new Intl.NumberFormat("ru", {maximumFractionDigits: 2});
  const swatch = document.createElement("canvas").getContext("2d", {willReadFrequently: true});
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const view = {x: 0, y: 0, start: 0, end: 0, scale: null};
  let field, depth, frame, column, branches, routeWrap, drag;
  let routeChanges, reversalChanges, routeReverse, checkpoints, checkpointLimit, checkpointInterval, seekTarget;
  let cycle, normalSliderMax;
  let pixels, words, sampleColumn, samplePair, colorWords, colorKey;
  let combinedPixels, combinedWords;
  let frameRequest = 0;
  let playing = false;
  let pending = 0;
  let nextBatchAt = 0;
  let nextPaintAt = 0;
  let dirty = false;
  let delay = 115;

  function stepCount() {
    return clamp(Math.round(stepSize.valueAsNumber) || 1, 1, Number(stepSize.max));
  }

  function updateSpeed() {
    const position = Number(speed.value) / 50 - 1;
    delay = Math.round(115 * (position <= 0 ? 16 ** -position : (16 / 115) ** position));
    speedValue.textContent = formatter.format(delay) + " мс";
    speed.setAttribute("aria-valuetext", delay + " миллисекунд между шагами");
  }

  function restore(saved) {
    if (!saved) return;
    if (Array.from(size.options).some(option => Number(option.value) === saved.rows)) size.value = saved.rows;
    if (saved.factor === 2 || saved.factor === 4) width.value = saved.factor;
    if (Number.isSafeInteger(saved.step)) stepSize.value = clamp(saved.step, 1, Number(stepSize.max));
    if (Number.isSafeInteger(saved.speed)) speed.value = clamp(saved.speed, 0, 100);
    if (["off", "overlay", "xor", "and"].includes(saved.combination)) combineMode.value = saved.combination;
    if (typeof saved.flipSecond === "boolean") flipSecond.checked = saved.flipSecond;
    updateSpeed();
    for (const key of Object.keys(options)) if (typeof saved[key] === "boolean") options[key] = saved[key];
  }

  function save() {
    const settings = {
      rows: Number(size.value), factor: Number(width.value), step: stepCount(), speed: Number(speed.value),
      combination: combineMode.value, flipSecond: flipSecond.checked, ...options
    };
    if (inline) {
      window.openai?.setWidgetState?.({modelContent: settings})?.catch(() => {});
      return;
    }
    try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch { /* Optional preferences. */ }
  }

  function reset() {
    stop();
    const height = Number(size.value);
    const columns = Number(width.value) * height - 1;
    if (field?.W === columns && field.H === height) field.val.fill(-1);
    else field = MAYATNIK.field(columns, height, "empty");
    depth = height / 2;
    routeChanges = new Map([[0, options.wrap]]);
    reversalChanges = new Map([[0, options.reverseAtContact]]);
    checkpoints = new Map();
    checkpointLimit = Math.min(12, Math.floor(96 * 1024 * 1024 / field.val.length));
    checkpointInterval = Math.max(16, Math.floor(columns / (2 * Math.max(1, checkpointLimit))));
    normalSliderMax = Math.min(maxFrame, 2 * columns + 1);
    cycle = null;
    configureCycle();
    initializeMotion();
    fit();
    advanceFrame(false);
    syncTransport();
    syncEdgeButtons();
    announcePosition();
    redraw();
  }

  function initializeMotion() {
    const anchor = (field.W - 1) / 2;
    column = anchor;
    branches = [{column: anchor, direction: 1}, {column: anchor, direction: -1}];
    routeWrap = routeChanges.get(0);
    routeReverse = reversalChanges.get(0);
    frame = 0;
  }

  function currentWrap() {
    return routeChanges.get(frame) ?? routeWrap;
  }

  function changeRoute(wrap) {
    changeMotion(routeChanges, wrap);
  }

  function currentReverse() {
    return reversalChanges.get(frame) ?? routeReverse;
  }

  function changeMotion(changes, value) {
    // A new choice at a rewound frame replaces the route from that point on.
    for (const at of changes.keys()) if (at >= frame) changes.delete(at);
    changes.set(frame, value);
    for (const at of checkpoints.keys()) if (at > frame) checkpoints.delete(at);
    configureCycle();
  }

  function configureCycle() {
    // The first, centered pass is identical in both edge modes.
    const wrap = routeChanges.get(1) ?? routeChanges.get(0);
    const reverse = reversalChanges.get(1) ?? reversalChanges.get(0);
    if (reverse || [...reversalChanges].some(([at, value]) => at > 1 && value) ||
      [...routeChanges].some(([at, value]) => at > 1 && value !== wrap)) {
      cycle = null;
      return;
    }
    if (cycle?.wrap === wrap) return;
    const routePeriod = wrap ? 2 * field.W : 4 * (field.W - 1);
    // Both widths and edge modes were measured for the offered sizes 8–128.
    const period = field.H <= 128 ? routePeriod * field.H / 2 : 0;
    cycle = {wrap, start: field.W, routePeriod, period, lap: 0, reference: null};
  }

  function observeCycle() {
    if (!cycle || frame < cycle.start) return;
    const elapsed = frame - cycle.start;
    if (elapsed === 0 && !cycle.reference) {
      const bits = new Uint8Array(Math.ceil(field.val.length / 8));
      for (let i = 0; i < field.val.length; i++) {
        if (field.val[i] === 1) bits[i >> 3] |= 1 << (i & 7);
      }
      cycle.reference = {bits, column, branches: branches.map(branch => ({...branch}))};
      return;
    }
    const {reference, routePeriod} = cycle;
    if (!elapsed || !reference || elapsed % (cycle.period || routePeriod)) return;
    const geometryMatches = column === reference.column && branches.every((branch, i) =>
      branch.column === reference.branches[i].column && branch.direction === reference.branches[i].direction);
    const bitsMatch = geometryMatches && field.val.every((bit, i) => bit === ((reference.bits[i >> 3] >> (i & 7)) & 1));
    if (!bitsMatch) {
      cycle.period = 0;
      return;
    }
    cycle.period = elapsed;
    cycle.lap++;
    checkpoints.delete(frame);
    frame = cycle.start;
    if (seekTarget !== null) seekTarget = cycle.start + (seekTarget - cycle.start) % elapsed;
    announcePosition();
  }

  function syncEdgeButtons() {
    for (const [key, button] of Object.entries(edgeButtons)) {
      const pressed = String(optionEnabled(key));
      if (button.getAttribute("aria-pressed") !== pressed) button.setAttribute("aria-pressed", pressed);
    }
  }

  function optionEnabled(key) {
    if (key === "wrap") return currentWrap();
    if (key === "reverseAtContact") return currentReverse();
    return options[key];
  }

  function separation() {
    return Math.abs(branches[0].column - branches[1].column);
  }

  function advance(watchContact = false) {
    const {W, H, val} = field;
    const before = watchContact ? separation() : 0;
    routeWrap = currentWrap();
    const branch = branches[frame % 2];
    const previous = branch.column;
    if (frame) {
      const next = previous + branch.direction;
      branch.column = MayatnikEdgeFlow.mapColumn(next, W, !routeWrap);
      if (!routeWrap && branch.column !== next) branch.direction *= -1;
    }
    column = branch.column;
    MAYATNIK.cone(field, column, depth);

    // Duplicate the widest row in the same lattice, clipped at the field edges.
    let left = column - depth + 1;
    let right = Math.min(column + depth - 1, W - 1);
    for (let c = left < 0 ? left & 1 : left; c <= right; c += 2) {
      const i = depth * W + c;
      val[i] = (val[i] === 1) ^ (val[i - W] === 1);
    }

    // XOR prefixes reverse the growing rule. Missing cells to the left
    // contribute zero, including the left parent of column zero.
    for (let r = depth + 1; r < H; r++) {
      left++;
      right = Math.min(column + H - 1 - r, W - 1);
      let prefix = 0;
      const row = r * W;
      for (let c = left < 0 ? left & 1 : left; c <= right; c += 2) {
        const i = row + c;
        prefix ^= c > 0 && val[i - W - 1] === 1;
        val[i] = (val[i] === 1) ^ prefix;
      }
    }
    frame++;
    // The contours touch when their centers are a diamond's width apart.
    return watchContact && before === H - 2 && separation() === H - 1 && Math.abs(column - previous) === 1;
  }

  function advanceFrame(stopAtContact) {
    routeReverse = currentReverse();
    const contact = advance(stopAtContact || routeReverse);
    if (contact && routeReverse) {
      for (const branch of branches) branch.direction *= -1;
    }
    if (checkpointLimit && frame % checkpointInterval === 0 && !checkpoints.has(frame)) {
      if (checkpoints.size === checkpointLimit) checkpoints.delete(checkpoints.keys().next().value);
      checkpoints.set(frame, {bits: field.val.slice(), branches: branches.map(item => ({...item})), column, routeWrap, routeReverse});
    }
    observeCycle();
    return contact && stopAtContact;
  }

  function seek(target, lap = cycle && target >= cycle.start ? cycle.lap : 0) {
    stop();
    if (cycle) cycle.lap = lap;
    let start = frame <= target ? frame : 0;
    let checkpoint;
    for (const [at, saved] of checkpoints) {
      if (at > start && at <= target) {
        start = at;
        checkpoint = saved;
      }
    }
    if (checkpoint) {
      field.val.set(checkpoint.bits);
      branches = checkpoint.branches.map(item => ({...item}));
      column = checkpoint.column;
      routeWrap = checkpoint.routeWrap;
      routeReverse = checkpoint.routeReverse;
      frame = start;
    } else if (frame > target) {
      field.val.fill(-1);
      initializeMotion();
    }
    pending = target - frame;
    seekTarget = pending ? target : null;
    syncTransport();
    syncEdgeButtons();
    if (!pending) announcePosition();
    redraw();
  }

  function stepBack() {
    const position = seekTarget ?? frame;
    const completed = cycle?.period ? cycle.lap * cycle.period : 0;
    const target = Math.max(0, position + completed - stepCount());
    const lap = cycle?.period ? Math.max(0, Math.floor((target - cycle.start) / cycle.period)) : 0;
    seek(target - (cycle?.period || 0) * lap, lap);
  }

  function fitScale(rect) {
    return Math.min(rect.width / (view.end - view.start), rect.height / field.H);
  }

  function scaleFor(rect) {
    return view.scale === null ? fitScale(rect) : view.scale / (devicePixelRatio || 1);
  }

  function updateViewBounds() {
    const half = Math.floor(field.W / 2);
    view.start = options.joinLeft ? -half : 0;
    view.end = field.W + (options.joinRight ? half : 0);
    if (view.scale === null) view.x = (view.start + view.end) / 2;
  }

  function fit() {
    view.scale = null;
    updateViewBounds();
    view.y = field.H / 2;
  }

  function boundCenter(center, extent, visible) {
    const half = Math.min(extent, visible) / 2;
    return clamp(center, half, extent - half);
  }

  function matchingBlock(row, col, firstCenter, secondCenter) {
    const {W, H, val} = field;
    const top = row - (row & 1);
    const offset = col - firstCenter;
    const left = offset - (offset & 1);
    const radius = Math.min(top, H - 2 - top);
    const a = firstCenter + left;
    const b = secondCenter + left;
    if (left < -radius || left + 1 > radius || a < 0 || b < 0 || a + 1 >= W || b + 1 >= W) return false;
    const i = top * W + a;
    const j = top * W + b;
    return val[i] >= 0 && val[i] === val[j] &&
      val[i + 1] >= 0 && val[i + 1] === val[j + 1] &&
      val[i + W] >= 0 && val[i + W] === val[j + W] &&
      val[i + W + 1] >= 0 && val[i + W + 1] === val[j + W + 1];
  }

  function repeatTone(row, col) {
    const [first, second] = branches;
    if (first.column !== second.column &&
      (matchingBlock(row, col, first.column, second.column) || matchingBlock(row, col, second.column, first.column))) return 2;
    const half = Math.floor(field.W / 2);
    if (options.joinLeft && col >= field.W - half) return 4;
    if (options.joinRight && col < half) return 6;
    return 0;
  }

  function paint() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const {W, H, val} = field;
    const displayWidth = view.end - view.start;
    const cssScale = scaleFor(rect);
    view.x = view.start + boundCenter(view.x - view.start, displayWidth, rect.width / cssScale);
    view.y = boundCenter(view.y, H, rect.height / cssScale);
    canvas.classList.toggle("romb-zoomed", displayWidth * cssScale > rect.width + 0.5 || H * cssScale > rect.height + 0.5);

    const dpr = devicePixelRatio || 1;
    const ratio = view.scale === null ? Math.min(dpr, 1.5) : dpr;
    const w = Math.max(1, Math.round(rect.width * ratio));
    const h = Math.max(1, Math.round(rect.height * ratio));
    if (!pixels || canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      pixels = context.createImageData(w, h);
      words = new Uint32Array(pixels.data.buffer);
      sampleColumn = new Int32Array(w);
      samplePair = new Uint8Array(w);
    }
    const styles = getComputedStyle(root);
    const tones = ["zero", "one", "match-zero", "match-one", "left-zero", "left-one", "right-zero", "right-one"]
      .map(name => styles.getPropertyValue("--romb-" + name).trim());
    const key = tones.join("|");
    if (colorKey !== key) {
      swatch.clearRect(0, 0, tones.length, 1);
      tones.forEach((tone, i) => {
        swatch.fillStyle = tone;
        swatch.fillRect(i, 0, 1, 1);
      });
      colorWords = new Uint32Array(swatch.getImageData(0, 0, tones.length, 1).data.buffer);
      colorKey = key;
    }

    const scale = view.scale ?? cssScale * ratio;
    let x = w / 2 - view.x * scale;
    let y = h / 2 - view.y * scale;
    if (view.scale === 1) {
      x = Math.round(x);
      y = Math.round(y);
    }
    const firstX = Math.max(0, Math.ceil(x + view.start * scale - 0.5));
    const lastX = Math.min(w, Math.ceil(x + view.end * scale - 0.5));
    const firstY = Math.max(0, Math.ceil(y - 0.5));
    const lastY = Math.min(h, Math.ceil(y + H * scale - 0.5));
    for (let px = firstX; px < lastX; px++) {
      const displayed = clamp(Math.floor((px + 0.5 - x) / scale), view.start, view.end - 1);
      const col = displayed < 0 ? displayed + W : displayed >= W ? displayed - W : displayed;
      sampleColumn[px] = col;
      // Below 1:1, keep a staggered bit when its neighbor shares this pixel.
      samplePair[px] = col + 1 < W && displayed + 1 < view.end && (displayed + 1.5) * scale + x < px + 1;
    }
    words.fill(0);
    for (let py = firstY; py < lastY; py++) {
      const row = clamp(Math.floor((py + 0.5 - y) / scale), 0, H - 1);
      const sourceRow = row * W;
      const out = py * w;
      for (let px = firstX; px < lastX; px++) {
        let col = sampleColumn[px];
        let bit = val[sourceRow + col];
        if (bit < 0 && samplePair[px]) bit = val[sourceRow + ++col];
        if (bit >= 0) words[out + px] = colorWords[bit + (options.markRepeats ? repeatTone(row, col) : 0)];
      }
    }
    context.putImageData(pixels, 0, 0);
    context.lineWidth = ratio;
    context.strokeStyle = styles.getPropertyValue("--romb-border").trim();
    context.strokeRect(x + view.start * scale, y, displayWidth * scale, H * scale);
    context.beginPath();
    if (view.start < 0) {
      context.moveTo(x, y);
      context.lineTo(x, y + H * scale);
    }
    if (view.end > W) {
      context.moveTo(x + W * scale, y);
      context.lineTo(x + W * scale, y + H * scale);
    }
    context.stroke();
    if (frame) paintOutlines(x, y, scale, ratio, styles.getPropertyValue("--romb-outline").trim());
    paintCombined();

    const position = frame ? " · столбец " + formatter.format(column + 1) + " из " + formatter.format(W) : "";
    const target = seekTarget === null ? "" : " → " + formatter.format(seekTarget);
    const contact = (options.stopAtContact || currentReverse()) && separation() === H - 1 ? " · касание" : "";
    const zoom = view.scale === 1 ? "1:1" : formatter.format(cssScale * dpr * 100) + " %";
    const label = "Кадр " + formatter.format(frame) + target + position +
      " · " + formatter.format(H) + " строк · " + zoom + contact;
    if (frameLabel.textContent !== label) frameLabel.textContent = label;
    const period = cycle?.period;
    const end = period ? cycle.start + period - 1 : normalSliderMax;
    if (frame > normalSliderMax) {
      const span = 2 * W + 1;
      normalSliderMax = Math.min(maxFrame, Math.ceil(frame / span) * span);
    }
    const limit = String(period ? end : normalSliderMax);
    if (frameSlider.max !== limit) frameSlider.max = limit;
    const sliderValue = String(seekTarget ?? frame);
    if (frameSlider.value !== sliderValue) frameSlider.value = sliderValue;
    const cycleText = period
      ? "↻ Цикл " + formatter.format(cycle.lap + 1) + " · кадры " + formatter.format(cycle.start) + "–" +
        formatter.format(end) + " · " + formatter.format(end + 1) + " = " + formatter.format(cycle.start)
      : cycle ? "Проверка повтора от кадра " + formatter.format(cycle.start) : "";
    if (cycleNote.textContent !== cycleText) cycleNote.textContent = cycleText;
    cycleNote.hidden = !cycleText;
    syncEdgeButtons();
  }

  function paintCombined() {
    const mode = combineMode.value;
    combinedView.hidden = mode === "off" || !combinedContext;
    flipSecond.disabled = mode === "off";
    if (combinedView.hidden) return;
    const {H, W, val} = field;
    const height = Math.min(H, 384);
    const width = Math.max(1, Math.round(height * (H - 1) / H));
    if (!combinedPixels || combinedCanvas.width !== width || combinedCanvas.height !== height) {
      combinedCanvas.width = width;
      combinedCanvas.height = height;
      combinedPixels = combinedContext.createImageData(width, height);
      combinedWords = new Uint32Array(combinedPixels.data.buffer);
    }
    combinedWords.fill(0);
    const [first, second] = branches;
    const flip = flipSecond.checked ? -1 : 1;
    for (let py = 0; py < height; py++) {
      const row = Math.floor((py + 0.5) * H / height);
      const radius = Math.min(row, H - 1 - row);
      const source = row * W;
      for (let px = 0; px < width; px++) {
        const offset = Math.floor((px + 0.5) * (H - 1) / width) - (depth - 1);
        if (Math.abs(offset) > radius) continue;
        const a = first.column + offset;
        const b = second.column + flip * offset;
        const left = a >= 0 && a < W ? val[source + a] : -1;
        const right = b >= 0 && b < W ? val[source + b] : -1;
        if (left < 0 && right < 0) continue;
        const firstOn = left === 1;
        const secondOn = right === 1;
        const color = mode === "xor" ? Number(firstOn !== secondOn)
          : mode === "and" ? Number(firstOn && secondOn)
            : firstOn && !secondOn ? 5 : secondOn && !firstOn ? 7 : Number(firstOn && secondOn);
        combinedWords[py * width + px] = colorWords[color];
      }
    }
    combinedContext.putImageData(combinedPixels, 0, 0);
  }

  function paintOutlines(x, y, scale, ratio, color) {
    const {W, H} = field;
    const columns = (options.stopAtContact || options.markRepeats || currentReverse()) && separation()
      ? branches.map(branch => branch.column) : [column];
    const radius = (depth - 0.5) * scale;
    const middle = y + depth * scale;
    for (const offset of [-W, 0, W]) {
      const left = Math.max(view.start, offset);
      const right = Math.min(view.end, offset + W);
      if (right <= left) continue;
      context.save();
      context.beginPath();
      context.rect(x + left * scale, y, (right - left) * scale, H * scale);
      context.clip();
      context.strokeStyle = color;
      context.lineWidth = 1.25 * ratio;
      for (const col of columns) {
        const tip = x + (offset + col + 0.5) * scale;
        context.beginPath();
        context.moveTo(tip, y);
        context.lineTo(tip + radius, middle);
        context.lineTo(tip, y + H * scale);
        context.lineTo(tip - radius, middle);
        context.closePath();
        context.stroke();
      }
      context.restore();
    }
  }

  function schedule() {
    if (!frameRequest) frameRequest = requestAnimationFrame(tick);
  }

  function redraw() {
    dirty = true;
    schedule();
  }

  function announcePosition() {
    if (!announcement) return;
    const position = frame ? " · столбец " + formatter.format(column + 1) : "";
    const contact = (options.stopAtContact || currentReverse()) && separation() === field.H - 1 ? " · касание" : "";
    announcement.textContent = "Кадр " + formatter.format(frame) + position + contact;
  }

  function syncTransport() {
    const moving = playing || pending > 0;
    play.setAttribute("aria-pressed", String(moving));
    if (playIcon) playIcon.textContent = moving ? "⏸" : "▶";
    stepButton.disabled = frame === maxFrame;
    backButton.disabled = (seekTarget ?? frame) === 0;
    play.disabled = frame === maxFrame;
  }

  function stop() {
    playing = false;
    pending = 0;
    seekTarget = null;
    syncTransport();
  }

  function tick(now) {
    frameRequest = 0;
    if (playing && !pending && now >= nextBatchAt) pending = stepCount();
    if (pending) {
      const deadline = performance.now() + 10;
      const watchContact = options.stopAtContact && seekTarget === null;
      let contact;
      do {
        contact = advanceFrame(watchContact);
        pending--;
      } while (!contact && pending && frame < maxFrame && performance.now() < deadline);
      if (!pending) {
        seekTarget = null;
        nextBatchAt = now + delay;
      }
      if (contact || frame === maxFrame) {
        stop();
        announcePosition();
      } else if (!playing && !pending) {
        syncTransport();
        announcePosition();
      }
      if (!pending || now >= nextPaintAt) {
        dirty = true;
        nextPaintAt = now + 80;
      }
    }
    if (dirty) {
      dirty = false;
      paint();
    }
    if (playing || pending) schedule();
  }

  function zoomTo(physicalScale, px = 0, py = 0) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const old = scaleFor(rect);
    view.scale = clamp(physicalScale, 1, 16);
    const shift = 1 / old - 1 / scaleFor(rect);
    view.x += px * shift;
    view.y += py * shift;
    redraw();
  }

  function zoomBy(factor, px = 0, py = 0) {
    const current = scaleFor(canvas.getBoundingClientRect()) * (devicePixelRatio || 1);
    if (view.scale === null && current < 1 && factor <= 1) return;
    zoomTo(current * factor, px, py);
  }

  function fitView() {
    fit();
    redraw();
  }

  canvas.addEventListener("wheel", event => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
    const factor = Math.exp(-clamp(event.deltaY * unit, -240, 240) * 0.003);
    zoomBy(factor, event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2);
  }, {passive: false});
  canvas.addEventListener("keydown", event => {
    if (!["+", "=", "-", "−", "0", "1"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "0") fitView();
    else if (event.key === "1") zoomTo(1);
    else zoomBy(event.key === "+" || event.key === "=" ? 1.3 : 1 / 1.3);
  });
  canvas.addEventListener("pointerdown", event => {
    if (!canvas.classList.contains("romb-zoomed") || event.button !== 0 || drag) return;
    canvas.setPointerCapture(event.pointerId);
    drag = {id: event.pointerId, x: event.clientX, y: event.clientY};
  });
  canvas.addEventListener("pointermove", event => {
    if (drag?.id !== event.pointerId) return;
    const scale = scaleFor(canvas.getBoundingClientRect());
    view.x -= (event.clientX - drag.x) / scale;
    view.y -= (event.clientY - drag.y) / scale;
    drag.x = event.clientX;
    drag.y = event.clientY;
    redraw();
  });
  canvas.addEventListener("lostpointercapture", () => { drag = null; });
  root.querySelectorAll("[data-romb-zoom]").forEach(button => {
    button.addEventListener("click", () => zoomBy(Number(button.dataset.rombZoom)));
  });

  function togglePlay() {
    if (frame === maxFrame) return;
    if (playing || pending) {
      stop();
      announcePosition();
      redraw();
    } else {
      playing = true;
      nextBatchAt = 0;
      syncTransport();
      schedule();
    }
  }

  play.addEventListener("click", togglePlay);
  canvas.addEventListener("dblclick", event => {
    event.preventDefault();
    togglePlay();
  });
  stepButton.addEventListener("click", () => {
    stop();
    pending = stepCount();
    syncTransport();
    schedule();
  });
  backButton.addEventListener("click", stepBack);
  byId("romb-reset").addEventListener("click", reset);
  byId("romb-fit").addEventListener("click", fitView);
  byId("romb-exact").addEventListener("click", () => zoomTo(1));
  frameSlider.addEventListener("input", () => seek(Number(frameSlider.value)));
  for (const [key, button] of Object.entries(edgeButtons)) {
    button.addEventListener("click", () => {
      options[key] = !optionEnabled(key);
      if (key === "wrap") {
        if (seekTarget !== null) stop();
        changeRoute(options.wrap);
      }
      if (key === "reverseAtContact") {
        if (seekTarget !== null) stop();
        changeMotion(reversalChanges, options.reverseAtContact);
      }
      if (key === "joinLeft" || key === "joinRight") updateViewBounds();
      syncEdgeButtons();
      save();
      redraw();
    });
  }
  for (const select of [size, width]) select.addEventListener("change", () => { save(); reset(); });
  stepSize.addEventListener("change", () => { stepSize.value = stepCount(); save(); });
  speed.addEventListener("input", () => {
    updateSpeed();
    if (playing && !pending) nextBatchAt = performance.now() + delay;
  });
  speed.addEventListener("change", save);
  for (const control of [combineMode, flipSecond]) control.addEventListener("change", () => { save(); redraw(); });

  if (inline) {
    restore(window.openai?.widgetState?.modelContent);
    window.addEventListener("openai:set_globals", event => {
      const before = size.value + "|" + width.value;
      const previous = {...options};
      restore(event.detail?.globals?.widgetState?.modelContent);
      if (before !== size.value + "|" + width.value) reset();
      else {
        if (previous.wrap !== options.wrap) {
          if (seekTarget !== null) stop();
          changeRoute(options.wrap);
        }
        if (previous.reverseAtContact !== options.reverseAtContact) {
          if (seekTarget !== null) stop();
          changeMotion(reversalChanges, options.reverseAtContact);
        }
        if (previous.joinLeft !== options.joinLeft || previous.joinRight !== options.joinRight) updateViewBounds();
        redraw();
      }
    });
  } else {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      restore(saved ?? {rows: Number(localStorage.getItem("zerk_mayatnik_rhomb_depth")) * 2});
    } catch { /* Use default preferences. */ }
  }

  updateSpeed();
  reset();
  new ResizeObserver(redraw).observe(canvas);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redraw);
})();
