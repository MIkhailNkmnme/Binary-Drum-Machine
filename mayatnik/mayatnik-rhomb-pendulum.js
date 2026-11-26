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
  const stepMinus = byId("romb-step-minus");
  const stepPlus = byId("romb-step-plus");
  const speed = byId("romb-speed");
  const speedValue = byId("romb-speed-value");
  const play = byId("romb-play");
  const playIcon = byId("romb-play-icon");
  const stepButton = byId("romb-step");
  const backButton = byId("romb-step-back");
  const frameSlider = byId("romb-frame-slider");
  const frameControl = byId("romb-frame-control");
  const frameControls = [frameControl];
  const cycleNote = byId("romb-cycle-note");
  const combineMode = byId("romb-combine");
  const flipSecond = byId("romb-flip");
  const squareButton = byId("romb-square");
  const andButton = byId("romb-build-and");
  const coinSquareButton = byId("romb-coin-square");
  const patternPalette = byId("romb-pattern-palette");
  const patternColors = [byId("romb-pattern-zero"), byId("romb-pattern-one")];
  const recordButton = byId("romb-record");
  const recordLabel = byId("romb-record-label");
  const combinedView = byId("romb-combined-view");
  const combinedCanvas = byId("romb-combined");
  const combinedContext = combinedCanvas.getContext("2d");
  const edgeButtons = {
    wrap: byId("romb-wrap"),
    joinLeft: byId("romb-join-left"),
    joinRight: byId("romb-join-right"),
    stopAtContact: byId("romb-stop-contact"),
    reverseAtContact: byId("romb-reverse-contact"),
    markRepeats: byId("romb-mark-repeats"),
    patternColors: byId("romb-pattern-colors"),
    counterStep: byId("romb-counter-step")
  };
  const options = {wrap: false, joinLeft: false, joinRight: false, stopAtContact: false, reverseAtContact: false,
    markRepeats: false, patternColors: false, counterStep: false, square: false, coinSquare: false, buildAnd: false};
  const storageKey = "zerk_mayatnik_rhomb";
  const inline = root.hasAttribute("data-romb-inline");
  const hubFour = !inline && new URLSearchParams(location.search).get("hub") === "four";
  const hubStepKey = "zerk_hub_four_step";
  const hubPlayButtons = hubFour ? [[-1, byId("romb-hub-play-back")], [1, byId("romb-hub-play-forward")]] : [];
  let hubRenderer, hubActive = false, hubAxes = false, hubVertical = false;
  const maxFrame = MayatnikEdgeFlow.MAX_FRAME;
  const formatter = new Intl.NumberFormat("ru", {maximumFractionDigits: 2});
  const swatch = document.createElement("canvas").getContext("2d", {willReadFrequently: true});
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const view = {x: 0, y: 0, start: 0, end: 0, scale: null};
  const coinView = {x: 0, y: 0, scale: null};
  const mirrors = [];
  let coinFrameInfo, recording;
  let field, depth, frame, column, branches, routeWrap;
  let routeChanges, reversalChanges, routeReverse, checkpoints, checkpointLimit, checkpointInterval, seekTarget;
  let cycle, reportedCycle, normalSliderMax, cycleMarkKey;
  let pixels, words, sampleColumn, samplePair, sampleStart, sampleEnd, colorWords, colorKey;
  let patternPainter, patternMarks;
  let combinedPixels, combinedWords;
  let frameRequest = 0;
  let playing = false;
  let playDirection = 1;
  let pending = 0;
  let nextBatchAt = 0;
  let nextPaintAt = 0;
  let dirty = false;
  let zen = false;
  let delay = 115;

  function stepCount() {
    return clamp(Math.round(stepSize.valueAsNumber) || 1, 1, Number(stepSize.max));
  }

  function syncStepSize() {
    const count = stepCount();
    stepMinus.disabled = count === 1;
    stepPlus.disabled = count === Number(stepSize.max);
  }

  function nudgeStepSize(direction) {
    stepSize.value = clamp(stepCount() + direction, 1, Number(stepSize.max));
    stepSize.dispatchEvent(new Event("change", {bubbles: true}));
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
    if (Array.isArray(saved.patternPalette)) {
      patternColors.forEach((input, bit) => {
        const tone = saved.patternPalette[bit];
        if (typeof tone === "string" && /^#[0-9a-f]{6}$/i.test(tone)) input.value = tone;
      });
    }
    updateSpeed();
    for (const key of Object.keys(options)) if (typeof saved[key] === "boolean") options[key] = saved[key];
  }

  function save() {
    if (hubFour) {
      try { localStorage.setItem(hubStepKey, String(stepCount())); } catch { /* Optional preferences. */ }
      return;
    }
    const settings = {
      rows: Number(size.value), factor: Number(width.value), step: stepCount(), speed: Number(speed.value),
      combination: combineMode.value, flipSecond: flipSecond.checked,
      patternPalette: patternColors.map(input => input.value), ...options
    };
    if (inline) {
      window.openai?.setWidgetState?.({modelContent: settings})?.catch(() => {});
      return;
    }
    try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch { /* Optional preferences. */ }
  }

  function reset() {
    stop();
    patternMarks = null;
    const height = Number(size.value);
    const columns = Number(width.value) * height - 1;
    if (field?.W === columns && field.H === height) field.val.fill(-1);
    else {
      field = MAYATNIK.field(columns, height, "empty");
      patternPainter = null;
    }
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
    fitCoin();
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
    reportedCycle = null;
    // The first, centered pass is identical in both edge modes.
    const wrap = routeChanges.get(1) ?? routeChanges.get(0);
    const reverse = reversalChanges.get(1) ?? reversalChanges.get(0);
    if (options.counterStep || [...reversalChanges].some(([at, value]) => at > 1 && value !== reverse) ||
        [...routeChanges].some(([at, value]) => at > 1 && value !== wrap)) {
      cycle = null;
      return;
    }
    const {W, H} = field;
    // Same fixed routes and starts as the published 160-variant calculation.
    const routePeriod = reverse ? 4 * (H - 1) : wrap ? 2 * W : 4 * (W - 1);
    const start = options.buildAnd
      ? reverse ? 2 * (H - 1) : wrap ? 2 * W : 2 * (W - 1)
      : reverse ? H : W;
    const knownPeriod = options.buildAnd ? routePeriod : routePeriod * H / 2;
    reportedCycle = {start, returned: start + knownPeriod};
    if (options.buildAnd || reverse) {
      cycle = null;
      return;
    }
    if (cycle?.wrap === wrap) return;
    // Keep live wrap/rewind behaviour separate from the known reference.
    const period = H <= 128 ? knownPeriod : 0;
    cycle = {wrap, start, routePeriod, period, lap: 0, reference: null};
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
    patternPalette.hidden = !options.patternColors;
    squareButton?.setAttribute("aria-pressed", String(options.square));
    andButton?.setAttribute("aria-pressed", String(options.buildAnd));
    coinSquareButton?.setAttribute("aria-pressed", String(options.coinSquare));
  }

  function optionEnabled(key) {
    if (key === "wrap") return currentWrap();
    if (key === "reverseAtContact") return currentReverse();
    return options[key];
  }

  function separation() {
    return Math.abs(branches[0].column - branches[1].column);
  }

  function moveBranch(branch, W) {
    if (!frame) return false;
    const previous = branch.column;
    const next = previous + branch.direction;
    branch.column = MayatnikEdgeFlow.mapColumn(next, W, !routeWrap);
    if (!routeWrap && branch.column !== next) branch.direction *= -1;
    return Math.abs(branch.column - previous) === 1;
  }

  function advance(watchContact = false, and = false, counterStep = false) {
    const {W, H, val} = field;
    const before = watchContact ? separation() : 0;
    routeWrap = currentWrap();
    const upper = counterStep ? branches[1] : branches[frame % 2];
    const lower = counterStep ? branches[0] : upper;
    const upperMoved = moveBranch(upper, W);
    const lowerMoved = lower === upper ? upperMoved : moveBranch(lower, W);
    column = upper.column;
    MAYATNIK.cone(field, column, depth, null, undefined, null, undefined, and);

    // Move the widest row from the upper lattice to the lower one's axis.
    const lowerColumn = lower.column;
    const shift = column - lowerColumn;
    let left = lowerColumn - depth + 1;
    let right = Math.min(lowerColumn + depth - 1, W - 1);
    for (let c = left < 0 ? left & 1 : left; c <= right; c += 2) {
      const i = depth * W + c;
      const source = c + shift;
      const bit = Number(source >= 0 && source < W && val[i - W + shift] === 1);
      val[i] = MAYATNIK.accumulateBit(val[i], bit, and);
    }

    // XOR prefixes reverse the growing rule. Missing cells to the left
    // contribute zero, including the left parent of column zero.
    for (let r = depth + 1; r < H; r++) {
      left++;
      right = Math.min(lowerColumn + H - 1 - r, W - 1);
      let prefix = 0;
      const row = r * W;
      for (let c = left < 0 ? left & 1 : left; c <= right; c += 2) {
        const i = row + c;
        prefix ^= c > 0 && val[i - W - 1] === 1;
        val[i] = MAYATNIK.accumulateBit(val[i], prefix, and);
      }
    }
    frame++;
    // Two moving halves can cross the contact threshold between frames.
    return watchContact && upperMoved && lowerMoved && before < H - 1 && separation() >= H - 1;
  }

  function advanceFrame(stopAtContact) {
    patternMarks = null;
    routeReverse = currentReverse();
    const contact = advance(stopAtContact || routeReverse, options.buildAnd, options.counterStep);
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

  function retreatHubFrame() {
    const {W, H, val} = field;
    const target = frame - 1;
    if (target === 0) {
      val.fill(-1);
      initializeMotion();
      return;
    }

    // The Hub keeps the XOR wrap route fixed. Its first W apices fill a
    // contiguous interval, so the earlier unfilled cells can be recovered.
    const apex = column;
    const anchor = (W - 1) / 2;
    const full = target >= W;
    const leftmost = anchor - Math.floor(target / 2);
    const rightmost = anchor + Math.floor((target - 1) / 2);
    const firstOfParity = leftmost + ((apex - leftmost) & 1);
    const lastOfParity = rightmost - ((rightmost - apex) & 1);

    // Undo bottom-up to read the same updated parents as the forward pass.
    for (let r = H - 1; r >= 1; r--) {
      const radius = Math.min(r, H - 1 - r);
      const left = apex - radius;
      const right = Math.min(apex + radius, W - 1);
      const row = r * W;
      let prefix = 0;
      for (let c = left < 0 ? left & 1 : left; c <= right; c += 2) {
        const upper = row - W + c;
        const upperLeft = c > 0 && val[upper - 1] === 1;
        let contribution;
        if (r < depth) contribution = upperLeft ^ (c + 1 < W && val[upper + 1] === 1);
        else if (r === depth) contribution = Number(val[upper] === 1);
        else contribution = prefix ^= upperLeft;
        const wasFilled = full || (firstOfParity <= lastOfParity && c >= firstOfParity - radius && c <= lastOfParity + radius);
        val[row + c] = wasFilled ? val[row + c] ^ contribution : -1;
      }
    }
    if (!full) val[apex] = -1;
    const branch = branches[target % 2];
    branch.column = MayatnikEdgeFlow.mapColumn(apex - branch.direction, W, false);
    frame = target;
    column = branches[(target - 1) % 2].column;
  }

  function seek(target, lap = cycle && target >= cycle.start ? cycle.lap : 0) {
    stop();
    patternMarks = null;
    if (cycle) cycle.lap = lap;
    let start = frame <= target ? frame : 0;
    let checkpoint;
    for (const [at, saved] of checkpoints) {
      if (at > start && at <= target) {
        start = at;
        checkpoint = saved;
      }
    }
    const retreat = hubFour && target < frame && frame - target < target - start;
    if (!retreat && checkpoint) {
      field.val.set(checkpoint.bits);
      branches = checkpoint.branches.map(item => ({...item}));
      column = checkpoint.column;
      routeWrap = checkpoint.routeWrap;
      routeReverse = checkpoint.routeReverse;
      frame = start;
    } else if (!retreat && frame > target) {
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

  function toggleBuildAnd() {
    const target = seekTarget ?? frame;
    options.buildAnd = !options.buildAnd;
    field.val.fill(-1);
    checkpoints.clear();
    initializeMotion();
    configureCycle();
    save();
    seek(target, 0);
  }

  function projectBox(start, end, height, square) {
    if (!square) return {left: start, top: 0, right: end, bottom: height};
    const s = Math.SQRT1_2;
    return {left: start * s, top: -end * s, right: (end + height) * s, bottom: (height - start) * s};
  }

  function projectedBounds() {
    return projectBox(view.start, view.end, field.H, options.square);
  }

  function coinBounds() {
    return projectBox(0, field.H - 1, field.H, options.coinSquare);
  }

  function scaleFor(rect, camera = view, bounds = projectedBounds()) {
    if (camera.scale !== null) return camera.scale / (devicePixelRatio || 1);
    return Math.min(rect.width / (bounds.right - bounds.left), rect.height / (bounds.bottom - bounds.top));
  }

  function updateViewBounds() {
    const half = Math.floor(field.W / 2);
    view.start = options.joinLeft ? -half : 0;
    view.end = field.W + (options.joinRight ? half : 0);
    if (view.scale === null) {
      const {left, top, right, bottom} = projectedBounds();
      view.x = (left + right) / 2;
      view.y = (top + bottom) / 2;
    }
  }

  function fit() {
    view.scale = null;
    updateViewBounds();
  }

  function fitCoin() {
    const {left, top, right, bottom} = coinBounds();
    coinView.scale = null;
    coinView.x = (left + right) / 2;
    coinView.y = (top + bottom) / 2;
  }

  function toggleSquare(coin = false) {
    const camera = coin ? coinView : view;
    const key = coin ? "coinSquare" : "square";
    const {x, y} = camera;
    const s = Math.SQRT1_2;
    options[key] = !options[key];
    if (options[key]) {
      camera.x = (x + y) * s;
      camera.y = (y - x) * s;
    } else {
      camera.x = (x - y) * s;
      camera.y = (x + y) * s;
    }
    if (coin) {
      if (camera.scale === null) fitCoin();
    } else updateViewBounds();
    syncEdgeButtons();
    save();
    redraw();
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

  function patternAt(marks, index) {
    return marks && (marks[index >> 3] & (1 << (index & 7)));
  }

  function bitTone(row, col, marks, index) {
    if (patternAt(marks, index)) return 8;
    return options.markRepeats ? repeatTone(row, col) : 0;
  }

  function sourceColumn(displayed, width) {
    return displayed < 0 ? displayed + width : displayed >= width ? displayed - width : displayed;
  }

  function paintSquareBits(x, y, scale, w, h, bounds, marks) {
    const {W, H, val} = field;
    const left = Math.max(0, Math.floor(x + bounds.left * scale));
    const right = Math.min(w, Math.ceil(x + bounds.right * scale));
    const top = Math.max(0, Math.floor(y + bounds.top * scale));
    const bottom = Math.min(h, Math.ceil(y + bounds.bottom * scale));
    const step = Math.SQRT1_2 / scale;
    for (let py = top; py < bottom; py++) {
      const v = (py + .5 - y) * step;
      for (let px = left; px < right; px++) {
        const u = (px + .5 - x) * step;
        const row = Math.floor(u + v);
        const displayed = Math.floor(u - v);
        if (row < 0 || row >= H || displayed < view.start || displayed >= view.end) continue;
        const col = sourceColumn(displayed, W);
        const index = row * W + col;
        const bit = val[index];
        if (bit >= 0) words[py * w + px] = colorWords[bit + bitTone(row, col, marks, index)];
      }
    }
  }

  function paint() {
    if (hubFour) {
      hubRenderer?.render(field, branches[1].column, branches[0].column, hubAxes && frame > 0, hubVertical);
      const target = seekTarget === null ? "" : " → " + formatter.format(seekTarget);
      frameLabel.textContent = "2047 × 1024 · 2N−1 · " + (hubVertical ? "вверх-вниз · " : "") + "кадр " + formatter.format(frame) + target;
      syncFrameSlider();
      syncTransport();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const {W, H} = field;
    const displayWidth = view.end - view.start;
    const bounds = projectedBounds();
    const viewWidth = bounds.right - bounds.left;
    const viewHeight = bounds.bottom - bounds.top;
    const cssScale = scaleFor(rect);
    view.x = bounds.left + boundCenter(view.x - bounds.left, viewWidth, rect.width / cssScale);
    view.y = bounds.top + boundCenter(view.y - bounds.top, viewHeight, rect.height / cssScale);
    canvas.classList.toggle("romb-zoomed", viewWidth * cssScale > rect.width + 0.5 || viewHeight * cssScale > rect.height + 0.5);

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
      sampleStart = new Int32Array(w);
      sampleEnd = new Int32Array(w);
    }
    const styles = getComputedStyle(root);
    const tones = ["zero", "one", "match-zero", "match-one", "left-zero", "left-one", "right-zero", "right-one"]
      .map(name => styles.getPropertyValue("--romb-" + name).trim());
    tones.push(...patternColors.map(input => input.value));
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
    let marks;
    if (options.patternColors && frame) {
      patternPainter ??= window.MayatnikRhombPatternColors.create(W, H);
      patternMarks ??= patternPainter.update(field.val, branches.map(branch => branch.column), options.counterStep);
      marks = patternMarks;
    }
    words.fill(0);
    if (options.square) paintSquareBits(x, y, scale, w, h, bounds, marks);
    else paintFlatBits(x, y, scale, w, h, marks);
    context.putImageData(pixels, 0, 0);
    context.save();
    if (options.square) {
      context.translate(x, y);
      context.rotate(-Math.PI / 4);
      context.translate(-x, -y);
    }
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
    context.restore();
    if (!zen || recording?.coin) paintCombined();

    updateLabels(cssScale, dpr);
  }

  function paintFlatBits(x, y, scale, w, h, marks) {
    const {W, H, val} = field;
    const firstX = Math.max(0, Math.ceil(x + view.start * scale - 0.5));
    const lastX = Math.min(w, Math.ceil(x + view.end * scale - 0.5));
    const firstY = Math.max(0, Math.ceil(y - 0.5));
    const lastY = Math.min(h, Math.ceil(y + H * scale - 0.5));
    const searchPixel = marks && scale < 1;
    for (let px = firstX; px < lastX; px++) {
      const displayed = clamp(Math.floor((px + 0.5 - x) / scale), view.start, view.end - 1);
      const col = sourceColumn(displayed, W);
      sampleColumn[px] = col;
      // Below 1:1, keep a staggered bit when its neighbor shares this pixel.
      samplePair[px] = col + 1 < W && displayed + 1 < view.end && (displayed + 1.5) * scale + x < px + 1;
      if (searchPixel) {
        sampleStart[px] = Math.max(view.start, Math.ceil((px - x) / scale - 0.5));
        sampleEnd[px] = Math.min(view.end, Math.ceil((px + 1 - x) / scale - 0.5));
      }
    }
    for (let py = firstY; py < lastY; py++) {
      const row = clamp(Math.floor((py + 0.5 - y) / scale), 0, H - 1);
      const sourceRow = row * W;
      const out = py * w;
      for (let px = firstX; px < lastX; px++) {
        let col = sampleColumn[px];
        let bit = val[sourceRow + col];
        if (bit < 0 && samplePair[px]) bit = val[sourceRow + ++col];
        // Keep a thin marked line visible when the field is fitted to the canvas.
        if (searchPixel && !patternAt(marks, sourceRow + col)) {
          for (let displayed = sampleStart[px]; displayed < sampleEnd[px]; displayed++) {
            const candidate = sourceColumn(displayed, W);
            if (!patternAt(marks, sourceRow + candidate)) continue;
            col = candidate;
            bit = val[sourceRow + col];
            break;
          }
        }
        if (bit >= 0) words[out + px] = colorWords[bit + bitTone(row, col, marks, sourceRow + col)];
      }
    }
  }

  function syncFrameSlider() {
    if (frame > normalSliderMax) {
      const span = 2 * field.W + 1;
      normalSliderMax = Math.min(maxFrame, Math.ceil(frame / span) * span);
    }
    const expectedEnd = reportedCycle?.returned ?? 0;
    const end = cycle?.period ? cycle.start + cycle.period - 1
      : Math.max(normalSliderMax, expectedEnd <= maxFrame ? expectedEnd : 0);
    const limit = String(end);
    if (frameSlider.max !== limit) frameSlider.max = limit;
    const sliderValue = String(seekTarget ?? frame);
    if (frameSlider.value !== sliderValue) frameSlider.value = sliderValue;
    syncCycleMarks(end);
    return end;
  }

  function syncCycleMarks(limit) {
    const key = reportedCycle ? [reportedCycle.start, reportedCycle.returned, limit, !!cycle?.period].join("|") : "";
    if (cycleMarkKey === key) return;
    cycleMarkKey = key;
    for (const control of frameControls) {
      const risks = control.querySelector(".romb-cycle-risks");
      const values = control.querySelector(".romb-cycle-values");
      risks.hidden = values.hidden = !reportedCycle;
      if (!reportedCycle) continue;
      const {start, returned} = reportedCycle;
      const outside = returned > limit + Number(!!cycle?.period);
      const first = values.querySelector(".romb-cycle-start");
      const last = values.querySelector(".romb-cycle-return");
      risks.style.setProperty("--romb-cycle-start", Math.min(100, 100 * start / limit) + "%");
      risks.style.setProperty("--romb-cycle-return", Math.min(100, 100 * returned / limit) + "%");
      risks.classList.toggle("romb-cycle-outside", outside);
      first.textContent = "Начало " + formatter.format(start);
      last.textContent = "Возврат " + formatter.format(returned) + (outside ? " →" : "");
      const distance = outside ? returned > maxFrame ? "За пределом перемотки. " : "За видимой частью шкалы. " : "";
      last.title = distance + "Период " + formatter.format(returned - start) + " ходов.";
    }
  }

  function positionText() {
    if (!frame) return "";
    if (options.counterStep) {
      return " · верх " + formatter.format(branches[1].column + 1) + " · низ " + formatter.format(branches[0].column + 1);
    }
    return " · столбец " + formatter.format(column + 1);
  }

  function contactText() {
    if (!options.stopAtContact && !currentReverse()) return "";
    const distance = separation();
    if (distance === field.H - 1) return " · касание";
    return options.counterStep && distance === field.H ? " · порог касания" : "";
  }

  function updateLabels(cssScale, dpr) {
    const {W, H} = field;
    const position = positionText() + (frame && !options.counterStep ? " из " + formatter.format(W) : "");
    const target = seekTarget === null ? "" : " → " + formatter.format(seekTarget);
    const contact = contactText();
    const zoom = view.scale === 1 ? "1:1" : formatter.format(cssScale * dpr * 100) + " %";
    const label = "Кадр " + formatter.format(frame) + target + position +
      " · " + formatter.format(H) + " строк · " + zoom + contact + (options.square ? " · квадрат" : "") +
      (options.buildAnd ? " · AND" : "");
    if (frameLabel.textContent !== label) frameLabel.textContent = label;
    const period = cycle?.period;
    const end = syncFrameSlider();
    const cycleText = period
      ? "↻ Цикл " + formatter.format(cycle.lap + 1) + " · кадры " + formatter.format(cycle.start) + "–" +
        formatter.format(end) + " · " + formatter.format(end + 1) + " = " + formatter.format(cycle.start)
      : cycle ? "Проверка повтора от кадра " + formatter.format(cycle.start) : "";
    if (cycleNote.textContent !== cycleText) cycleNote.textContent = cycleText;
    cycleNote.hidden = !cycleText;
    syncEdgeButtons();
    syncMirrors();
  }

  function paintCombined() {
    const mode = combineMode.value;
    combinedView.hidden = mode === "off" || !combinedContext;
    flipSecond.disabled = mode === "off";
    if (combinedView.hidden) return;
    const {H, W, val} = field;
    const {left, top, right, bottom} = coinBounds();
    const rect = combinedCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const cssScale = scaleFor(rect, coinView, {left, top, right, bottom});
    coinView.x = left + boundCenter(coinView.x - left, right - left, rect.width / cssScale);
    coinView.y = top + boundCenter(coinView.y - top, bottom - top, rect.height / cssScale);
    combinedCanvas.classList.toggle("romb-zoomed",
      (right - left) * cssScale > rect.width + .5 || (bottom - top) * cssScale > rect.height + .5);
    const dpr = devicePixelRatio || 1;
    const ratio = coinView.scale === null ? Math.min(dpr, 1.5) : dpr;
    const width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio));
    if (!combinedPixels || combinedCanvas.width !== width || combinedCanvas.height !== height) {
      combinedCanvas.width = width;
      combinedCanvas.height = height;
      combinedPixels = combinedContext.createImageData(width, height);
      combinedWords = new Uint32Array(combinedPixels.data.buffer);
    }
    combinedWords.fill(0);
    const scale = coinView.scale ?? cssScale * ratio;
    const originX = width / 2 - coinView.x * scale, originY = height / 2 - coinView.y * scale;
    const x0 = Math.max(0, Math.floor(originX + left * scale));
    const x1 = Math.min(width, Math.ceil(originX + right * scale));
    const y0 = Math.max(0, Math.floor(originY + top * scale));
    const y1 = Math.min(height, Math.ceil(originY + bottom * scale));
    const [first, second] = branches;
    const flip = flipSecond.checked ? -1 : 1;
    const s = Math.SQRT1_2;
    for (let py = y0; py < y1; py++) {
      const v = (py + .5 - originY) / scale;
      for (let px = x0; px < x1; px++) {
        const u = (px + .5 - originX) / scale;
        const row = Math.floor(options.coinSquare ? (u + v) * s : v);
        const col = Math.floor(options.coinSquare ? (u - v) * s : u);
        if (row < 0 || row >= H || col < 0 || col >= H - 1) continue;
        const offset = col - (depth - 1);
        if (Math.abs(offset) > Math.min(row, H - 1 - row)) continue;
        const source = row * W;
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
    if (coinFrameInfo) {
      const zoom = coinView.scale === 1 ? "1:1" : formatter.format(cssScale * dpr * 100) + " %";
      coinFrameInfo.textContent = "Кадр " + formatter.format(frame) + " · " + zoom + (options.coinSquare ? " · квадрат" : "");
    }
  }

  function syncMirrors() {
    for (const [source, copy] of mirrors) {
      if (source.matches("button, input, select")) {
        copy.disabled = source.disabled;
        const pressed = source.getAttribute("aria-pressed");
        if (pressed !== null && copy.getAttribute("aria-pressed") !== pressed) copy.setAttribute("aria-pressed", pressed);
        if (copy.title !== source.title) copy.title = source.title;
        const label = source.getAttribute("aria-label");
        if (label !== null && copy.getAttribute("aria-label") !== label) copy.setAttribute("aria-label", label);
        if (source.matches("input[type=range]")) copy.max = source.max;
        if (source.matches("input, select") && copy.value !== source.value) copy.value = source.value;
      } else {
        copy.hidden = source.hidden;
        if (copy.textContent !== source.textContent) copy.textContent = source.textContent;
      }
    }
  }

  function mountCoinControls() {
    const holder = byId("romb-coin-controls");
    if (!holder) return;
    const controls = byId("romb-controls").cloneNode(true);
    controls.querySelector("#romb-zen")?.remove();
    controls.querySelector("#romb-step-label").htmlFor = "romb-step-size-coin";
    controls.querySelector("#romb-pattern-colors").setAttribute("aria-controls", "romb-pattern-palette-coin");
    controls.id = "romb-coin-toolbar";
    controls.setAttribute("aria-label", "Общие команды Маятника в Ромбе-монете");
    const timeline = frameControl.cloneNode(true);
    timeline.id += "-coin";
    frameControls.push(timeline);
    const range = timeline.querySelector("input");
    const repeat = cycleNote.cloneNode(true);
    for (const copy of [...controls.querySelectorAll("[id]"), range, repeat]) {
      const source = byId(copy.id);
      copy.id += "-coin";
      if (source.matches("button")) copy.addEventListener("click", () => {
        if (source === recordButton) toggleRecording(true);
        else source.click();
      });
      if (source.matches("input, select")) for (const type of ["input", "change"]) {
        copy.addEventListener(type, () => {
          source.value = copy.value;
          source.dispatchEvent(new Event(type, {bubbles: true}));
        });
      }
      mirrors.push([source, copy]);
    }
    holder.append(controls);
    coinFrameInfo = document.createElement("p");
    coinFrameInfo.className = "progress";
    byId("romb-coin-frames").append(coinFrameInfo, timeline, repeat);
    const viewport = bindViewport(combinedCanvas, coinView, coinBounds, fitCoin);
    byId("romb-coin-exact").addEventListener("click", () => viewport.zoomTo(1));
    byId("romb-coin-fit").addEventListener("click", viewport.fitView);
    coinSquareButton.addEventListener("click", () => toggleSquare(true));
    combinedCanvas.addEventListener("dblclick", togglePlay);
  }

  function syncRecording() {
    recordButton.setAttribute("aria-pressed", String(!!recording));
    recordButton.disabled = recording?.finishing === true;
    const action = recording ? "Сохранить GIF" : "Собрать GIF";
    recordButton.setAttribute("aria-label", action);
    recordButton.title = recording ? "Завершить запись и скачать GIF" : "Начать запись видимого поля в GIF. Второе нажатие сохраняет файл.";
    recordLabel.textContent = action;
    syncMirrors();
  }

  function stopRecording() {
    if (!recording || recording.finishing) return;
    recording.finishing = true;
    recording.status.textContent = "Сборка GIF…";
    recording.recorder.stop();
    if (recording.startedPlayback && playing) stop();
    syncRecording();
  }

  function toggleRecording(coin = false) {
    if (recording) return stopRecording();
    const status = byId(coin ? "romb-coin-record-status" : "romb-record-status");
    status.hidden = false;
    const snapshot = () => coin ? combinedPixels : pixels;
    if (!snapshot()) paint();
    if (!snapshot()) {
      status.textContent = "Откройте битовое полотно перед записью.";
      return;
    }
    const copy = document.createElement("canvas");
    const drawing = copy.getContext("2d");
    const session = {coin, status, startedPlayback: !playing && !pending, start: frame};
    function finish(message) {
      if (recording !== session) return;
      if (session.startedPlayback && playing) stop();
      recording = null;
      status.textContent = message;
      syncRecording();
    }
    try {
      recording = session;
      const {width, height} = snapshot();
      session.recorder = window.MayatnikGif.record({width, height,
        capture: () => {
          const image = snapshot();
          if (copy.width !== image.width || copy.height !== image.height) {
            copy.width = image.width;
            copy.height = image.height;
          }
          drawing.putImageData(image, 0, 0);
          return copy;
        },
        onDone(blob, info) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = (coin ? "romb-moneta-" : "romb-mayatnik-") + session.start + ".gif";
          document.body.append(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          finish("GIF сохранён · " + formatter.format(info.frames) + " кадров.");
        },
        onError(error) { finish("GIF не собран · " + (error.message || String(error))); }
      });
      status.textContent = "Запись GIF · кадр " + formatter.format(frame);
      if (session.startedPlayback) togglePlay();
      syncRecording();
    } catch (error) {
      finish("GIF не собран · " + (error.message || String(error)));
    }
  }

  function paintOutlines(x, y, scale, ratio, color) {
    const {W, H} = field;
    const columns = options.counterStep ? [branches[1].column, branches[0].column]
      : (options.stopAtContact || options.markRepeats || options.patternColors || currentReverse()) && separation()
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
      if (options.patternColors) context.globalAlpha = 0.35;
      context.lineWidth = 1.25 * ratio;
      for (const [side, col] of columns.entries()) {
        const tip = x + (offset + col + 0.5) * scale;
        context.beginPath();
        if (options.counterStep) {
          context.moveTo(tip - radius, middle);
          context.lineTo(tip, side === 0 ? y : y + H * scale);
          context.lineTo(tip + radius, middle);
        } else {
          context.moveTo(tip, y);
          context.lineTo(tip + radius, middle);
          context.lineTo(tip, y + H * scale);
          context.lineTo(tip - radius, middle);
        }
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
    announcement.textContent = "Кадр " + formatter.format(frame) + positionText() + contactText();
  }

  function syncTransport() {
    syncStepSize();
    const moving = playing || pending !== 0;
    play.setAttribute("aria-pressed", String(moving));
    if (playIcon) playIcon.textContent = moving ? "⏸" : "▶";
    stepButton.disabled = (hubFour ? seekTarget ?? frame : frame) === maxFrame;
    backButton.disabled = (seekTarget ?? frame) === 0;
    play.disabled = frame === maxFrame;
    for (const [direction, button] of hubPlayButtons) {
      const active = playing && playDirection === direction;
      const glyph = active ? "Ⅱ" : direction < 0 ? "◀" : "▶";
      const label = active ? "Пауза" : direction < 0 ? "Воспроизводить кадры назад" : "Воспроизводить кадры вперёд";
      button.disabled = !active && frame === (direction < 0 ? 0 : maxFrame);
      if (button.textContent !== glyph) button.textContent = glyph;
      if (button.getAttribute("aria-label") !== label) {
        button.title = label;
        button.setAttribute("aria-label", label);
        button.setAttribute("aria-pressed", String(active));
      }
    }
    syncMirrors();
  }

  function stop() {
    playing = false;
    pending = 0;
    seekTarget = null;
    syncTransport();
  }

  function tick(now) {
    frameRequest = 0;
    if (playing && !pending && now >= nextBatchAt) pending = playDirection < 0 ? -Math.min(frame, stepCount()) : stepCount();
    if (pending) {
      const deadline = performance.now() + 10;
      const watchContact = options.stopAtContact && seekTarget === null;
      const reversing = pending < 0;
      const boundary = reversing ? 0 : maxFrame;
      let contact = false;
      do {
        if (reversing) {
          retreatHubFrame();
          pending++;
        } else {
          contact = advanceFrame(watchContact);
          pending--;
        }
      } while (!contact && pending && frame !== boundary && performance.now() < deadline);
      if (!pending) {
        seekTarget = null;
        nextBatchAt = now + delay;
      }
      if (contact || frame === boundary) {
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
    if (dirty && !(hubFour && playing && pending)) {
      dirty = false;
      paint();
    }
    if (playing || pending) schedule();
  }

  function bindViewport(element, camera, bounds, fitCamera) {
    let drag;
    function zoomTo(physicalScale, px = 0, py = 0) {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const box = bounds();
      const old = scaleFor(rect, camera, box);
      camera.scale = clamp(physicalScale, 1, 16);
      const shift = 1 / old - 1 / scaleFor(rect, camera, box);
      camera.x += px * shift;
      camera.y += py * shift;
      redraw();
    }

    function zoomBy(factor, px = 0, py = 0) {
      const current = scaleFor(element.getBoundingClientRect(), camera, bounds()) * (devicePixelRatio || 1);
      if (camera.scale === null && current < 1 && factor <= 1) return;
      zoomTo(current * factor, px, py);
    }

    function fitView() {
      fitCamera();
      redraw();
    }

    element.addEventListener("wheel", event => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
      const factor = Math.exp(-clamp(event.deltaY * unit, -240, 240) * 0.003);
      zoomBy(factor, event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2);
    }, {passive: false});
    element.addEventListener("keydown", event => {
      if (!["+", "=", "-", "−", "0", "1"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "0") fitView();
      else if (event.key === "1") zoomTo(1);
      else zoomBy(event.key === "+" || event.key === "=" ? 1.3 : 1 / 1.3);
    });
    element.addEventListener("pointerdown", event => {
      if (!element.classList.contains("romb-zoomed") || event.button !== 0 || drag) return;
      element.setPointerCapture(event.pointerId);
      drag = {id: event.pointerId, x: event.clientX, y: event.clientY};
    });
    element.addEventListener("pointermove", event => {
      if (drag?.id !== event.pointerId) return;
      const scale = scaleFor(element.getBoundingClientRect(), camera, bounds());
      camera.x -= (event.clientX - drag.x) / scale;
      camera.y -= (event.clientY - drag.y) / scale;
      drag.x = event.clientX;
      drag.y = event.clientY;
      redraw();
    });
    element.addEventListener("lostpointercapture", () => { drag = null; });
    return {zoomTo, zoomBy, fitView};
  }

  function mountZen() {
    const board = byId("romb-board");
    const enter = byId("romb-zen");
    const exit = byId("romb-zen-exit");
    let previousView, nativeZen = false;

    function exitFullscreen() {
      if (document.fullscreenElement === board) document.exitFullscreen().catch(() => {});
    }

    function setZen(active) {
      if (active === zen) return;
      zen = active;
      root.classList.toggle("romb-zen", active);
      document.documentElement.classList.toggle("romb-zen-open", active);
      enter.setAttribute("aria-pressed", String(active));
      exit.hidden = !active;
      if (active) {
        previousView = {x: view.x, y: view.y, scale: view.scale};
        fit();
        canvas.focus({preventScroll: true});
        board.requestFullscreen?.()?.catch(() => {});
      } else {
        nativeZen = false;
        Object.assign(view, previousView);
        exitFullscreen();
        enter.focus({preventScroll: true});
      }
      redraw();
    }

    enter.addEventListener("click", () => setZen(true));
    exit.addEventListener("click", () => setZen(false));
    document.addEventListener("fullscreenchange", () => {
      if (document.fullscreenElement === board) {
        if (zen) nativeZen = true;
        else exitFullscreen();
      } else if (nativeZen) {
        nativeZen = false;
        setZen(false);
      }
    });
    document.addEventListener("keydown", event => {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
      if (zen && event.key === "Escape") {
        event.preventDefault();
        setZen(false);
      } else if ((event.code === "KeyQ" || event.key.toLowerCase() === "q") &&
          !event.target.closest?.("input, select, textarea, [contenteditable=true]")) {
        event.preventDefault();
        setZen(!zen);
      }
    });
  }

  const {zoomTo, zoomBy, fitView} = bindViewport(canvas, view, projectedBounds, fit);

  root.querySelectorAll("[data-romb-zoom]").forEach(button => {
    button.addEventListener("click", () => zoomBy(Number(button.dataset.rombZoom)));
  });

  function beginPlayback(direction) {
    playDirection = direction;
    playing = true;
    nextBatchAt = 0;
    syncTransport();
    schedule();
  }

  function toggleHubPlayback(direction) {
    if (playing && playDirection === direction) {
      stop();
      announcePosition();
      redraw();
    } else if (frame !== (direction < 0 ? 0 : maxFrame)) {
      stop();
      beginPlayback(direction);
    }
  }

  function togglePlay() {
    if (hubFour) return toggleHubPlayback(playDirection);
    if (frame === maxFrame) return;
    if (playing || pending) {
      stop();
      announcePosition();
      redraw();
    } else {
      beginPlayback(1);
    }
  }

  play.addEventListener("click", togglePlay);
  canvas.addEventListener("dblclick", event => {
    event.preventDefault();
    togglePlay();
  });
  stepButton.addEventListener("click", () => {
    if (hubFour) {
      seek(Math.min(maxFrame, (seekTarget ?? frame) + stepCount()));
      return;
    }
    stop();
    pending = stepCount();
    syncTransport();
    schedule();
  });
  backButton.addEventListener("click", stepBack);
  byId("romb-reset").addEventListener("click", reset);
  byId("romb-fit").addEventListener("click", fitView);
  byId("romb-exact").addEventListener("click", () => zoomTo(1));
  squareButton?.addEventListener("click", () => toggleSquare());
  andButton?.addEventListener("click", toggleBuildAnd);
  recordButton?.addEventListener("click", () => toggleRecording());
  frameSlider.addEventListener("input", () => seek(Number(frameSlider.value)));
  for (const [key, button] of Object.entries(edgeButtons)) {
    button.addEventListener("click", () => {
      options[key] = !optionEnabled(key);
      if (key === "counterStep") {
        save();
        reset();
        return;
      }
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
  for (const input of patternColors) {
    input.addEventListener("input", redraw);
    input.addEventListener("change", save);
  }
  for (const select of [size, width]) select.addEventListener("change", () => { save(); reset(); });
  stepMinus.addEventListener("click", () => nudgeStepSize(-1));
  stepPlus.addEventListener("click", () => nudgeStepSize(1));
  stepSize.addEventListener("input", () => {
    syncStepSize();
    syncMirrors();
  });
  stepSize.addEventListener("change", () => {
    stepSize.value = stepCount();
    syncStepSize();
    syncMirrors();
    save();
  });
  speed.addEventListener("input", () => {
    updateSpeed();
    if (playing && !pending) nextBatchAt = performance.now() + delay;
  });
  speed.addEventListener("change", save);
  for (const control of [combineMode, flipSecond]) control.addEventListener("change", () => {
    if (combineMode.value === "off" && recording?.coin) stopRecording();
    save();
    redraw();
  });

  if (hubFour) {
    document.documentElement.classList.add("romb-hub-four");
    const transport = byId("romb-hub-transport");
    const actions = byId("romb-hub-actions");
    actions.prepend(backButton.parentElement);
    actions.append(stepSize.closest(".romb-setting"));
    transport.append(frameControl, frameLabel);
    transport.hidden = false;
    byId("romb-step-label").textContent = "Кадров за шаг";
    for (const [direction, button] of hubPlayButtons) {
      button.addEventListener("click", () => toggleHubPlayback(direction));
    }
    frameSlider.setAttribute("aria-describedby", "romb-frame");
    size.value = "1024";
    width.value = "2";
    try { stepSize.value = localStorage.getItem(hubStepKey) ?? "1"; } catch { /* Optional preferences. */ }
    stepSize.value = stepCount();
    options.wrap = true;
    combinedView.hidden = false;
    hubRenderer = window.MayatnikRhombFour.create(combinedCanvas, byId("romb-vertical"), 2047, 1024);
    combinedCanvas.addEventListener("dblclick", togglePlay);
    window.addEventListener("message", event => {
      if (event.source !== window.parent || event.origin !== location.origin || event.data?.type !== "zerk-hub-four") return;
      const active = event.data.active === true;
      hubAxes = event.data.axes === true;
      hubVertical = event.data.vertical === true;
      if (active !== hubActive) {
        hubActive = active;
        if (!active) stop();
        else if (!playing) togglePlay();
      }
      redraw();
    });
    window.addEventListener("keydown", event => {
      if (event.key === "Escape") window.parent.postMessage({type: "zerk-hub-four-close"}, location.origin === "null" ? "*" : location.origin);
    });
  } else if (inline) {
    restore(window.openai?.widgetState?.modelContent);
    window.addEventListener("openai:set_globals", event => {
      const before = size.value + "|" + width.value;
      const previous = {...options};
      restore(event.detail?.globals?.widgetState?.modelContent);
      if (before !== size.value + "|" + width.value || previous.counterStep !== options.counterStep) reset();
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
        syncEdgeButtons();
        redraw();
      }
    });
  } else {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      restore(saved ?? {rows: Number(localStorage.getItem("zerk_mayatnik_rhomb_depth")) * 2});
    } catch { /* Use default preferences. */ }
  }

  if (!hubFour) {
    mountCoinControls();
    mountZen();
  }
  updateSpeed();
  reset();
  if (hubFour && window.parent === window) togglePlay();
  const observer = new ResizeObserver(redraw);
  observer.observe(canvas);
  if (!hubFour && coinSquareButton) observer.observe(combinedCanvas);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redraw);
})();
