/* Ромбовый Маятник v0.027 */
(() => {
  "use strict";

  const root = document.getElementById("rhomb-pendulum");
  const byId = id => root.querySelector("#" + id);
  const canvas = byId("romb-field");
  const fieldBoard = byId("romb-board");
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
  const heightFactor = byId("romb-height");
  const horizontalMotion = byId("romb-horizontal-motion");
  const verticalMotion = byId("romb-vertical-motion");
  const jointRoute = byId("romb-route");
  const verticalWrapButton = byId("romb-wrap-y");
  const motionModes = ["off", "outward", "inward", "sync", "pendulum"];
  const routeNames = {cw: "по часовой", ccw: "против часовой", cross: "крестом",
    "spiral-cw": "спираль по часовой", "spiral-ccw": "спираль против часовой"};
  const rememberedModes = {x: "pendulum", y: "pendulum"};
  const stepSize = byId("romb-step-size");
  const stepMinus = byId("romb-step-minus");
  const stepPlus = byId("romb-step-plus");
  const speed = byId("romb-speed");
  const speedValue = byId("romb-speed-value");
  const play = byId("romb-play");
  const playIcon = byId("romb-play-icon");
  const playLabel = byId("romb-play-label");
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
  const patternArea = byId("romb-pattern-area");
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
  const options = {wrap: false, wrapY: false, joinLeft: false, joinRight: false, stopAtContact: false, reverseAtContact: false,
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
  let routeWrapY, verticalRouteChanges, jointPoints, spiral;
  let routeChanges, reversalChanges, routeReverse, checkpoints, checkpointLimit, checkpointInterval, seekTarget;
  let cycle, reportedCycle, normalSliderMax, cycleMarkKey;
  let pixels, words, sampleColumn, samplePair, sampleStart, sampleEnd, colorWords, colorKey;
  let patternPainter, patternMarks;
  let firstPaintedRow, endPaintedRow;
  let renderRhombs = [];
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

  function syncStepArrows() {
    const count = stepCount();
    stepMinus.disabled = count <= Number(stepSize.min);
    stepPlus.disabled = count >= Number(stepSize.max);
  }

  function updateSpeed() {
    const speedStep = speed.valueAsNumber;
    const position = speedStep / 50 - 1;
    // Keep existing slider settings; the extra 16 positions count down to zero.
    delay = speedStep > 100 ? 16 - (speedStep - 100)
      : Math.round(115 * (position <= 0 ? 16 ** -position : (16 / 115) ** position));
    speedValue.textContent = formatter.format(delay) + " мс";
    speed.setAttribute("aria-valuetext", delay + " миллисекунд между шагами");
  }

  function restore(saved) {
    if (!saved) return;
    if (Array.from(size.options).some(option => Number(option.value) === saved.rows)) size.value = saved.rows;
    if (saved.factor === 2 || saved.factor === 4) width.value = saved.factor;
    if (motionModes.includes(saved.verticalMotion)) verticalMotion.value = saved.verticalMotion;
    if (horizontalMotion) {
      horizontalMotion.value = motionModes.includes(saved.horizontalMotion) ? saved.horizontalMotion
        : isVertical() ? "off" : saved.counterStep ? "outward" : "pendulum";
    }
    if (heightFactor) heightFactor.value = [2, 4].includes(saved.heightFactor) ? saved.heightFactor
      : isVertical() && [2, 4].includes(saved.factor) ? saved.factor : 2;
    if (jointRoute && Object.hasOwn(routeNames, saved.jointRoute)) jointRoute.value = saved.jointRoute;
    for (const key of ["x", "y"]) {
      if (motionModes.includes(saved.rememberedModes?.[key]) && saved.rememberedModes[key] !== "off") {
        rememberedModes[key] = saved.rememberedModes[key];
      }
    }
    if (Number.isSafeInteger(saved.step)) stepSize.value = clamp(saved.step, 1, Number(stepSize.max));
    if (Number.isSafeInteger(saved.speed)) speed.value = clamp(saved.speed, 0, Number(speed.max));
    if (["off", "overlay", "xor", "and"].includes(saved.combination)) combineMode.value = saved.combination;
    if (typeof saved.flipSecond === "boolean") flipSecond.checked = saved.flipSecond;
    if (patternArea && Array.from(patternArea.options).some(option => option.value === saved.patternArea)) {
      patternArea.value = saved.patternArea;
      patternMarks = null;
    }
    if (Array.isArray(saved.patternPalette)) {
      patternColors.forEach((input, bit) => {
        const tone = saved.patternPalette[bit];
        if (typeof tone === "string" && /^#[0-9a-f]{6}$/i.test(tone)) input.value = tone;
      });
    }
    updateSpeed();
    for (const key of Object.keys(options)) if (typeof saved[key] === "boolean") options[key] = saved[key];
    if (typeof saved.wrapY !== "boolean") options.wrapY = !!saved.wrap;
  }

  function save() {
    if (hubFour) {
      try { localStorage.setItem(hubStepKey, String(stepCount())); } catch { /* Optional preferences. */ }
      return;
    }
    const settings = {
      rows: Number(size.value), factor: Number(width.value), step: stepCount(), speed: Number(speed.value),
      verticalMotion: verticalMotion.value,
      horizontalMotion: horizontalMode(), heightFactor: Number(heightFactor?.value || width.value),
      jointRoute: jointRoute?.value || "cw", rememberedModes: {...rememberedModes},
      combination: combineMode.value, flipSecond: flipSecond.checked,
      patternArea: patternArea?.value, patternPalette: patternColors.map(input => input.value), ...options
    };
    if (inline) {
      window.openai?.setWidgetState?.({modelContent: settings})?.catch(() => {});
      return;
    }
    try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch { /* Optional preferences. */ }
  }

  function isVertical() {
    return !hubFour && verticalMotion.value !== "off";
  }

  function horizontalMode() {
    return hubFour ? "pendulum" : horizontalMotion?.value || (isVertical() ? "off" : options.counterStep ? "outward" : "pendulum");
  }

  function isHorizontal() {
    return horizontalMode() !== "off";
  }

  function isJoint() {
    return isHorizontal() && isVertical();
  }

  function pairedMotion() {
    const mode = isVertical() ? verticalMotion.value : horizontalMode();
    return !isJoint() && ["pendulum", "outward", "inward"].includes(mode);
  }

  function motionKey() {
    return [size.value, width.value, heightFactor?.value, horizontalMode(), verticalMotion.value, jointRoute?.value].join("|");
  }

  function reset() {
    stop();
    patternMarks = null;
    const rows = Number(size.value);
    const length = Number(width.value) * rows - 1;
    const height = isVertical() ? Number(heightFactor?.value || width.value) * rows - 1 : rows;
    const columns = isHorizontal() ? length : rows - 1;
    if (field?.W === columns && field.H === height) field.val.fill(-1);
    else {
      field = MAYATNIK.field(columns, height, "empty");
      patternPainter = null;
    }
    depth = rows / 2;
    routeChanges = new Map([[0, options.wrap]]);
    verticalRouteChanges = new Map([[0, options.wrapY]]);
    reversalChanges = new Map([[0, options.reverseAtContact]]);
    checkpoints = new Map();
    checkpointLimit = Math.min(12, Math.floor(96 * 1024 * 1024 / field.val.length));
    checkpointInterval = Math.max(16, Math.floor(columns / (2 * Math.max(1, checkpointLimit))));
    normalSliderMax = Math.min(maxFrame, (isJoint() ? 4 : 2) * Math.max(columns, height) + 1);
    cycle = null;
    configureCycle();
    initializeRun();
    fit();
    fitCoin();
    advanceFrame(false);
    syncTransport();
    syncEdgeButtons();
    announcePosition();
    redraw();
  }

  function initializeRun() {
    firstPaintedRow = field.H;
    endPaintedRow = 0;
    initializeMotion();
    const centerX = (field.W - 1) / 2;
    const centerY = Math.floor((field.H - 2 * depth) / 2);
    jointPoints = [{center: centerX, top: centerY}, {center: centerX, top: centerY}];
    spiral = {x: 0, y: 0, leg: 0, walked: 0, length: 1};
    routeWrapY = verticalRouteChanges.get(0);
    if (isJoint()) return;
    if (horizontalMode() === "inward") {
      branches[1] = {column: 0, direction: 1};
      branches[0] = {column: field.W - 1, direction: -1};
    }
    if (!isVertical()) return;
    const end = field.H - 2 * depth;
    const center = Math.floor(end / 2);
    if (verticalMotion.value === "inward") {
      branches[1] = {column: 0, direction: 1};
      branches[0] = {column: end, direction: -1};
    } else {
      branches[0].column = branches[1].column = center;
    }
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

  function currentWrapY() {
    return verticalRouteChanges.get(frame) ?? routeWrapY;
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
    if (isVertical() || horizontalMode() !== "pendulum" || [...reversalChanges].some(([at, value]) => at > 1 && value !== reverse) ||
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
    edgeButtons.counterStep.disabled = isVertical();
    const lengthLabel = !horizontalMotion && isVertical() ? "Высота поля" : "Ширина поля";
    const label = byId("romb-width-label");
    if (label.textContent !== lengthLabel) label.textContent = lengthLabel;
    squareButton?.setAttribute("aria-pressed", String(options.square));
    andButton?.setAttribute("aria-pressed", String(options.buildAnd));
    coinSquareButton?.setAttribute("aria-pressed", String(options.coinSquare));
    const both = isJoint();
    for (const [key, select, id] of [["x", horizontalMotion, "romb-horizontal-enabled"], ["y", verticalMotion, "romb-vertical-enabled"]]) {
      if (!select) continue;
      const active = select.value !== "off";
      if (active) rememberedModes[key] = select.value;
      byId(id)?.setAttribute("aria-pressed", String(active));
      select.disabled = both;
      select.title = both ? "При двух включённых осях движение задаёт общий маршрут. Этот одноосевой вариант сохранён."
        : key === "x" ? "Горизонтальный ход половин или целого ромба" : "Вертикальный ход половин или целого ромба";
    }
    if (byId("romb-route-group")) byId("romb-route-group").hidden = !both;
    verticalWrapButton?.setAttribute("aria-pressed", String(currentWrapY()));
    if (verticalWrapButton) verticalWrapButton.disabled = !isVertical();
    edgeButtons.wrap.disabled = !isHorizontal();
    edgeButtons.stopAtContact.disabled = edgeButtons.reverseAtContact.disabled = !pairedMotion();
    syncMirrors();
  }

  function optionEnabled(key) {
    if (key === "wrap") return currentWrap();
    if (key === "reverseAtContact") return currentReverse();
    return options[key];
  }

  function separation() {
    return Math.abs(branches[0].column - branches[1].column);
  }

  function moveBranch(branch, W, wrap = routeWrap) {
    if (!frame) return false;
    const previous = branch.column;
    const next = previous + branch.direction;
    branch.column = MayatnikEdgeFlow.mapColumn(next, W, !wrap);
    if (!wrap && branch.column !== next) branch.direction *= -1;
    return Math.abs(branch.column - previous) === 1;
  }

  function advance(watchContact = false, and = false, counterStep = false) {
    const {W, H} = field;
    const before = watchContact ? separation() : 0;
    routeWrap = currentWrap();
    const upper = counterStep ? branches[1] : branches[frame % 2];
    const lower = counterStep ? branches[0] : upper;
    const upperMoved = moveBranch(upper, W);
    const lowerMoved = lower === upper ? upperMoved : moveBranch(lower, W);
    column = upper.column;
    buildPass(column, lower.column, and);
    frame++;
    // Two moving halves can cross the contact threshold between frames.
    return watchContact && upperMoved && lowerMoved && before < H - 1 && separation() >= H - 1;
  }

  function buildPass(upperColumn, lowerColumn, and, upperTop = 0, lowerTop = 0) {
    firstPaintedRow = Math.min(firstPaintedRow, upperTop, lowerTop + depth);
    endPaintedRow = Math.max(endPaintedRow, upperTop + depth, lowerTop + 2 * depth);
    drawPass(field, depth, upperColumn, lowerColumn, and, upperTop, lowerTop);
  }

  function drawPass(field, depth, upperColumn, lowerColumn, and, upperTop, lowerTop) {
    const {W, H, val} = field;
    const rows = 2 * depth;
    const upperField = H === rows ? field : {W, H: depth, val: val.subarray(upperTop * W, (upperTop + depth) * W)};
    MAYATNIK.cone(upperField, upperColumn, depth, null, undefined, null, undefined, and);

    // Move the widest row from the upper lattice to the lower one's axis.
    const shift = upperColumn - lowerColumn;
    const topRow = (upperTop + depth - 1) * W;
    const lowerRow = (lowerTop + depth) * W;
    let left = lowerColumn - depth + 1;
    let right = Math.min(lowerColumn + depth - 1, W - 1);
    for (let c = left < 0 ? left & 1 : left; c <= right; c += 2) {
      const i = lowerRow + c;
      const source = c + shift;
      const bit = Number(source >= 0 && source < W && val[topRow + source] === 1);
      val[i] = MAYATNIK.accumulateBit(val[i], bit, and);
    }

    // XOR prefixes reverse the growing rule. Missing cells to the left
    // contribute zero, including the left parent of column zero.
    for (let r = depth + 1; r < rows; r++) {
      left++;
      right = Math.min(lowerColumn + rows - 1 - r, W - 1);
      let prefix = 0;
      const row = (lowerTop + r) * W;
      for (let c = left < 0 ? left & 1 : left; c <= right; c += 2) {
        const i = row + c;
        prefix ^= c > 0 && val[i - W - 1] === 1;
        val[i] = MAYATNIK.accumulateBit(val[i], prefix, and);
      }
    }
  }

  function mountScaleExample() {
    const section = byId("scale-example");
    if (!section) return;
    const styles = getComputedStyle(root);
    const colors = ["--romb-zero", "--romb-one"].map(name => styles.getPropertyValue(name).trim());
    for (const figure of section.querySelectorAll("figure[data-rows]")) {
      const height = Number(figure.dataset.rows);
      const example = MAYATNIK.field(height - 1, height, "empty");
      const center = (example.W - 1) / 2;
      drawPass(example, height / 2, center, center, false, 0, 0);
      const target = figure.querySelector("canvas");
      const ctx = target.getContext("2d");
      if (!ctx) continue;
      const buttons = figure.querySelectorAll("button[data-scale]");
      let scale = Number(figure.querySelector('[aria-pressed="true"]').dataset.scale);

      function sizeOnScreen() {
        const ratio = devicePixelRatio || 1;
        target.style.width = target.width / ratio + "px";
        target.style.height = target.height / ratio + "px";
      }

      function render() {
        target.width = Math.round(example.W * scale);
        target.height = Math.round(example.H * scale);
        sizeOnScreen();
        for (let y = 0; y < target.height; y++) {
          const row = Math.floor((y + 0.5) / scale) * example.W;
          for (let x = 0; x < target.width; x++) {
            const col = Math.floor((x + 0.5) / scale);
            let bit = example.val[row + col];
            if (bit < 0 && scale < 1 && col + 1 < example.W) bit = example.val[row + col + 1];
            if (bit >= 0) {
              ctx.fillStyle = colors[bit];
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
        for (const button of buttons) button.setAttribute("aria-pressed", String(Number(button.dataset.scale) === scale));
        figure.querySelector("output").textContent = example.H + " строк → " + target.height + " пикселей по высоте";
      }

      for (const button of buttons) button.addEventListener("click", () => {
        scale = Number(button.dataset.scale);
        render();
      });
      window.addEventListener("resize", sizeOnScreen);
      render();
    }
  }

  function advanceFrame(stopAtContact) {
    patternMarks = null;
    routeReverse = currentReverse();
    const watchContact = pairedMotion() && (stopAtContact || routeReverse);
    const contact = isJoint() ? advanceJoint()
      : isVertical() ? advanceVertical(watchContact) : advanceHorizontal(watchContact);
    if (contact && routeReverse) {
      for (const branch of branches) branch.direction *= -1;
    }
    if (checkpointLimit && frame % checkpointInterval === 0 && !checkpoints.has(frame)) {
      if (checkpoints.size === checkpointLimit) checkpoints.delete(checkpoints.keys().next().value);
      checkpoints.set(frame, {bits: field.val.slice(), firstPaintedRow, endPaintedRow, branches: branches.map(item => ({...item})),
        jointPoints: jointPoints.map(point => ({...point})), spiral: {...spiral}, column, routeWrap, routeWrapY, routeReverse});
    }
    observeCycle();
    return contact && stopAtContact;
  }

  function advanceHorizontal(watchContact) {
    const mode = horizontalMode();
    if (mode === "pendulum") return advance(watchContact, options.buildAnd, false);
    if (mode === "outward" || mode === "inward") {
      const before = separation();
      const touched = advance(watchContact, options.buildAnd, true);
      return mode === "inward" ? watchContact && before > 2 * depth - 1 && separation() <= 2 * depth - 1 : touched;
    }
    routeWrap = currentWrap();
    const branch = branches[1];
    if (mode === "sync") moveBranch(branch, field.W);
    branches[0] = {...branch};
    column = branch.column;
    buildPass(column, column, options.buildAnd);
    frame++;
    return false;
  }

  function advanceJoint() {
    routeWrap = currentWrap();
    routeWrapY = currentWrapY();
    const mode = jointRoute?.value || "cw";
    let dx = 0, dy = 0;
    if (frame && mode.startsWith("spiral")) {
      const directions = mode === "spiral-ccw" ? [[0, -1], [-1, 0], [0, 1], [1, 0]]
        : [[0, -1], [1, 0], [0, 1], [-1, 0]];
      const [x, y] = directions[spiral.leg % 4];
      spiral.x += x;
      spiral.y += y;
      if (++spiral.walked === spiral.length) {
        spiral.walked = 0;
        spiral.leg++;
        if (spiral.leg % 2 === 0) spiral.length++;
      }
      dx = spiral.x;
      dy = spiral.y;
    } else if (frame) {
      const directions = mode === "cross" ? [[-1, 0], [1, 0], [0, -1], [0, 1]]
        : mode === "ccw" ? [[0, -1], [-1, 0], [0, 1], [1, 0]]
          : [[0, -1], [1, 0], [0, 1], [-1, 0]];
      const radius = Math.floor((frame - 1) / 4) + 1;
      const [x, y] = directions[(frame - 1) % 4];
      dx = x * radius;
      dy = y * radius;
    }
    const point = {
      center: MayatnikEdgeFlow.mapColumn((field.W - 1) / 2 + dx, field.W, !routeWrap),
      top: MayatnikEdgeFlow.mapColumn(Math.floor((field.H - 2 * depth) / 2) + dy, field.H - 2 * depth + 1, !routeWrapY)
    };
    jointPoints[frame % 2] = point;
    column = point.center;
    buildPass(column, column, options.buildAnd, point.top, point.top);
    frame++;
    return false;
  }

  function advanceVertical(watchContact) {
    const [lower, upper] = branches;
    const before = lower.column - upper.column;
    const positions = field.H - 2 * depth + 1;
    routeWrapY = currentWrapY();
    if (verticalMotion.value === "pendulum") {
      // Alternate two independent vertical branches, exactly as in advance().
      // Screen rows increase downward: center, up 1, down 1, up 2, down 2.
      const branch = branches[frame % 2];
      const moved = moveBranch(branch, positions, routeWrapY);
      buildPass(column, column, options.buildAnd, branch.column, branch.column);
      frame++;
      const contactDistance = 2 * depth - 1;
      return watchContact && moved && Math.abs(before) < contactDistance && separation() === contactDistance;
    }
    const upperMoved = moveBranch(upper, positions, routeWrapY);
    const synchronous = verticalMotion.value === "sync";
    if (synchronous) {
      lower.column = upper.column;
      lower.direction = upper.direction;
    }
    const lowerMoved = !synchronous && moveBranch(lower, positions, routeWrapY);
    buildPass(column, column, options.buildAnd, upper.column, lower.column);
    frame++;
    const after = lower.column - upper.column;
    return watchContact && upperMoved && lowerMoved && before !== 0 && (after === 0 || Math.sign(after) !== Math.sign(before));
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
      firstPaintedRow = checkpoint.firstPaintedRow;
      endPaintedRow = checkpoint.endPaintedRow;
      branches = checkpoint.branches.map(item => ({...item}));
      column = checkpoint.column;
      routeWrap = checkpoint.routeWrap;
      routeWrapY = checkpoint.routeWrapY;
      jointPoints = checkpoint.jointPoints.map(point => ({...point}));
      spiral = {...checkpoint.spiral};
      routeReverse = checkpoint.routeReverse;
      frame = start;
    } else if (!retreat && frame > target) {
      field.val.fill(-1);
      initializeRun();
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
    initializeRun();
    configureCycle();
    save();
    seek(target, 0);
  }

  function projectBox(start, end, bottom, square, top = 0) {
    if (!square) return {left: start, top, right: end, bottom};
    const s = Math.SQRT1_2;
    return {left: (start + top) * s, top: (top - end) * s, right: (end + bottom) * s, bottom: (bottom - start) * s};
  }

  function pageField() {
    return !zen && !hubFour && !inline;
  }

  function projectedBounds() {
    if (!pageField()) return projectBox(view.start, view.end, field.H, options.square);
    if (endPaintedRow > firstPaintedRow) return projectBox(view.start, view.end, endPaintedRow, options.square, firstPaintedRow);
    const top = Math.floor((field.H - 2 * depth) / 2);
    return projectBox(view.start, view.end, top + 2 * depth, options.square, top);
  }

  function coinBounds() {
    return projectBox(0, 2 * depth - 1, 2 * depth, options.coinSquare);
  }

  function fittedPixelScale(rect, camera, bounds) {
    const dpr = devicePixelRatio || 1;
    const across = Math.round(rect.width * dpr) / (bounds.right - bounds.left);
    const available = camera === view && pageField() ? across
      : Math.min(across, Math.round(rect.height * dpr) / (bounds.bottom - bounds.top));
    if (available <= 0) return 1;
    return available >= 1 ? Math.floor(available) : 1 / Math.ceil(1 / available);
  }

  function scaleFor(rect, camera = view, bounds = projectedBounds()) {
    return (camera.scale ?? fittedPixelScale(rect, camera, bounds)) / (devicePixelRatio || 1);
  }

  function scaleLabel(scale) {
    return scale >= 1 ? scale + "/1" : "1/" + Math.round(1 / scale);
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
    const {W, H} = field;
    const top = row - (row & 1);
    const offset = col - firstCenter;
    const left = offset - (offset & 1);
    const radius = Math.min(top, H - 2 - top);
    const a = firstCenter + left;
    const b = secondCenter + left;
    if (left < -radius || left + 1 > radius || a < 0 || b < 0 || a + 1 >= W || b + 1 >= W) return false;
    return equalBlock(top * W + a, top * W + b);
  }

  function matchingVerticalBlock(row, col, firstTop, secondTop) {
    const {W} = field;
    const localRow = row - firstTop;
    const top = localRow - (localRow & 1);
    const radius = Math.min(top, 2 * depth - 2 - top);
    const center = depth - 1;
    const offset = col - center;
    const left = offset - (offset & 1);
    const x = center + left;
    if (left < -radius || left + 1 > radius || x < 0 || x + 1 >= W) return false;
    return equalBlock((firstTop + top) * W + x, (secondTop + top) * W + x);
  }

  function equalBlock(i, j) {
    const {W, val} = field;
    return val[i] >= 0 && val[i] === val[j] &&
      val[i + 1] >= 0 && val[i + 1] === val[j + 1] &&
      val[i + W] >= 0 && val[i + W] === val[j + W] &&
      val[i + W + 1] >= 0 && val[i + W + 1] === val[j + W + 1];
  }

  function repeatTone(row, col) {
    const [first, second = first] = renderRhombs;
    if ((first.center !== second.center || first.top !== second.top) &&
      (matchingPositionBlock(row, col, first, second) || matchingPositionBlock(row, col, second, first))) return 2;
    const half = Math.floor(field.W / 2);
    if (options.joinLeft && col >= field.W - half) return 4;
    if (options.joinRight && col < half) return 6;
    return 0;
  }

  function patternAt(marks, index) {
    return marks && (marks[index >> 3] & (1 << (index & 7)));
  }

  // Geometry of the two current source passes. Half modes keep the original
  // upper/lower pieces; joint routes retain the two most recent whole rhombs.
  function sourceRhombs(all = true) {
    if (isJoint()) return all ? jointPoints : [jointPoints[frame ? (frame - 1) % 2 : 0]];
    const vertical = isVertical();
    const mode = vertical ? verticalMotion.value : horizontalMode();
    const point = branch => vertical ? {center: (field.W - 1) / 2, top: branch.column}
      : {center: branch.column, top: 0};
    if (mode === "outward" || mode === "inward") {
      return [{...point(branches[1]), half: "upper"}, {...point(branches[0]), half: "lower"}];
    }
    const selected = mode === "sync" || mode === "off" ? [branches[1]]
      : all ? branches : [branches[frame ? (frame - 1) % 2 : 0]];
    return selected.map(point);
  }

  function matchingPositionBlock(row, col, first, second) {
    const {W, H} = field;
    const localRow = row - first.top;
    const top = localRow - (localRow & 1);
    if (top < 0 || top + 1 >= 2 * depth) return false;
    const radius = Math.min(top, 2 * depth - 2 - top);
    const offset = col - first.center;
    const left = offset - (offset & 1);
    const a = first.center + left, b = second.center + left;
    const ya = first.top + top, yb = second.top + top;
    if (left < -radius || left + 1 > radius || a < 0 || b < 0 || a + 1 >= W || b + 1 >= W ||
        ya < 0 || yb < 0 || ya + 1 >= H || yb + 1 >= H) return false;
    return equalBlock(ya * W + a, yb * W + b);
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

  function layoutFieldHeight(bounds) {
    const fullHeight = pageField();
    fieldBoard.classList.toggle("romb-full-height", fullHeight);
    if (fullHeight) {
      const scale = scaleFor(fieldBoard.getBoundingClientRect(), view, bounds);
      const height = Math.max(1, Math.ceil((bounds.bottom - bounds.top) * scale)) + "px";
      if (fieldBoard.style.getPropertyValue("--field-height") !== height) fieldBoard.style.setProperty("--field-height", height);
    }
    return fullHeight;
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
    const bounds = projectedBounds();
    const fullHeight = layoutFieldHeight(bounds);
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const {W, H} = field;
    const displayWidth = view.end - view.start;
    renderRhombs = sourceRhombs();
    const viewWidth = bounds.right - bounds.left;
    const viewHeight = bounds.bottom - bounds.top;
    const ratio = devicePixelRatio || 1;
    const scale = view.scale ?? fittedPixelScale(rect, view, bounds);
    const cssScale = scale / ratio;
    view.x = bounds.left + boundCenter(view.x - bounds.left, viewWidth, rect.width / cssScale);
    view.y = fullHeight
      ? bounds.top + (rect.top - fieldBoard.getBoundingClientRect().top + rect.height / 2) / cssScale
      : bounds.top + boundCenter(view.y - bounds.top, viewHeight, rect.height / cssScale);
    canvas.classList.toggle("romb-zoomed", viewWidth * cssScale > rect.width + 0.5 ||
      viewHeight * cssScale > (fullHeight ? Math.min(innerHeight, rect.height) : rect.height) + 0.5);

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

    const x = Math.round(w / 2 - view.x * scale);
    const y = Math.round(h / 2 - view.y * scale);
    let marks;
    if (options.patternColors && frame) {
      patternPainter ??= window.MayatnikRhombPatternColors.create(W, H);
      patternMarks ??= patternPainter.update(field.val, patternArea?.value);
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

    updateLabels(scale);
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
      const span = 2 * (isVertical() ? field.H : field.W) + 1;
      normalSliderMax = Math.min(maxFrame, Math.ceil(frame / span) * span);
    }
    const expectedEnd = reportedCycle?.returned ?? 0;
    const end = cycle?.period ? cycle.start + cycle.period - 1
      : Math.max(normalSliderMax, expectedEnd <= maxFrame ? expectedEnd : 0);
    const limit = String(end);
    if (frameSlider.max !== limit) frameSlider.max = limit;
    const sliderValue = String(seekTarget ?? frame);
    if (frameSlider.value !== sliderValue) frameSlider.value = sliderValue;
    if (reportedCycle) {
      const progress = (frameSlider.valueAsNumber / end * 100) + "%";
      if (root.style.getPropertyValue("--frame-progress") !== progress) root.style.setProperty("--frame-progress", progress);
    }
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
      last.textContent = "Повтор " + formatter.format(returned) + (outside ? " →" : "");
      const distance = outside ? returned > maxFrame ? "За пределом перемотки. " : "За видимой частью шкалы. " : "";
      last.title = distance + "Период " + formatter.format(returned - start) + " ходов.";
    }
  }

  function positionText() {
    if (!frame) return "";
    if (isJoint()) {
      const point = jointPoints[(frame - 1) % 2];
      return " · " + routeNames[jointRoute?.value || "cw"] + " · вершина: столбец " +
        formatter.format(point.center + 1) + ", строка " + formatter.format(point.top + 1);
    }
    if (isVertical()) {
      if (verticalMotion.value === "pendulum") {
        return " · вершина, строка " + formatter.format(branches[(frame - 1) % 2].column + 1);
      }
      const upper = formatter.format(branches[1].column + 1);
      const lower = formatter.format(branches[0].column + depth + 1);
      return verticalMotion.value === "sync" ? " · вершина, строка " + upper : " · строки · верх " + upper + " · низ " + lower;
    }
    if (["outward", "inward"].includes(horizontalMode())) {
      return " · верх " + formatter.format(branches[1].column + 1) + " · низ " + formatter.format(branches[0].column + 1);
    }
    return " · столбец " + formatter.format(column + 1);
  }

  function contactText() {
    if (!pairedMotion() || (!options.stopAtContact && !currentReverse())) return "";
    const distance = separation();
    if (isVertical() && verticalMotion.value === "pendulum") return distance === 2 * depth - 1 ? " · касание" : "";
    if (isVertical()) return verticalMotion.value !== "sync" && distance <= 1 ? " · касание" : "";
    if (distance === field.H - 1) return " · касание";
    return ["outward", "inward"].includes(horizontalMode()) && distance === field.H ? " · порог касания" : "";
  }

  function updateLabels(scale) {
    const {W, H} = field;
    const vertical = isVertical();
    const position = positionText() + (frame && !["outward", "inward"].includes(horizontalMode()) && !vertical ? " из " + formatter.format(W) : "");
    const dimensions = vertical ? " · поле " + formatter.format(W) + " × " + formatter.format(H) : " · " + formatter.format(H) + " строк";
    const target = seekTarget === null ? "" : " → " + formatter.format(seekTarget);
    const contact = contactText();
    const zoom = scaleLabel(scale);
    const label = "Кадр " + formatter.format(frame) + target + position +
      dimensions + " · " + zoom + contact + (options.square ? " · квадрат" : "") +
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
    const {W, val} = field;
    const H = 2 * depth;
    const {left, top, right, bottom} = coinBounds();
    const rect = combinedCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = devicePixelRatio || 1;
    const scale = coinView.scale ?? fittedPixelScale(rect, coinView, {left, top, right, bottom});
    const cssScale = scale / ratio;
    coinView.x = left + boundCenter(coinView.x - left, right - left, rect.width / cssScale);
    coinView.y = top + boundCenter(coinView.y - top, bottom - top, rect.height / cssScale);
    combinedCanvas.classList.toggle("romb-zoomed",
      (right - left) * cssScale > rect.width + .5 || (bottom - top) * cssScale > rect.height + .5);
    const width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio));
    if (!combinedPixels || combinedCanvas.width !== width || combinedCanvas.height !== height) {
      combinedCanvas.width = width;
      combinedCanvas.height = height;
      combinedPixels = combinedContext.createImageData(width, height);
      combinedWords = new Uint32Array(combinedPixels.data.buffer);
    }
    combinedWords.fill(0);
    const originX = Math.round(width / 2 - coinView.x * scale);
    const originY = Math.round(height / 2 - coinView.y * scale);
    const x0 = Math.max(0, Math.floor(originX + left * scale));
    const x1 = Math.min(width, Math.ceil(originX + right * scale));
    const y0 = Math.max(0, Math.floor(originY + top * scale));
    const y1 = Math.min(height, Math.ceil(originY + bottom * scale));
    const [first, second = first] = sourceRhombs();
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
        const a = first.center + offset;
        const b = second.center + flip * offset;
        const rowA = row + first.top;
        const rowB = row + second.top;
        const left = a >= 0 && a < W && rowA >= 0 && rowA < field.H ? val[rowA * W + a] : -1;
        const right = b >= 0 && b < W && rowB >= 0 && rowB < field.H ? val[rowB * W + b] : -1;
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
      const zoom = scaleLabel(scale);
      coinFrameInfo.textContent = "Кадр " + formatter.format(frame) + " · " + zoom + (options.coinSquare ? " · квадрат" : "");
    }
  }

  function syncMirrors() {
    for (const [source, copy] of mirrors) {
      copy.hidden = source.hidden;
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
        if (!source.querySelector("button, input, select") && copy.textContent !== source.textContent) copy.textContent = source.textContent;
      }
    }
  }

  function mountCoinControls() {
    const holder = byId("romb-coin-controls");
    if (!holder) return;
    const controls = byId("romb-controls").cloneNode(true);
    (controls.querySelector("#romb-zen-pair") || controls.querySelector("#romb-zen"))?.remove();
    controls.querySelector("#romb-pattern-colors").setAttribute("aria-controls", "romb-pattern-palette-coin");
    controls.querySelector("#romb-route")?.setAttribute("aria-describedby", "romb-route-help-coin");
    controls.id = "romb-coin-toolbar";
    controls.setAttribute("aria-label", "Общие команды Маятника в Ромбе-монете");
    const timeline = frameControl.cloneNode(true);
    timeline.id += "-coin";
    frameControls.push(timeline);
    const repeat = cycleNote.cloneNode(true);
    for (const copy of [...controls.querySelectorAll("[id]"), ...timeline.querySelectorAll("[id]"), repeat]) {
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

  function activeOutlines() {
    return sourceRhombs(options.stopAtContact || options.markRepeats || currentReverse());
  }

  function paintOutlines(x, y, scale, ratio, color) {
    const {W, H} = field;
    const radius = (depth - 0.5) * scale;
    const outlines = activeOutlines();
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
      for (const {center, top, half} of outlines) {
        const tip = x + (offset + center + 0.5) * scale;
        const from = y + top * scale;
        const middle = from + depth * scale;
        const to = from + 2 * depth * scale;
        context.beginPath();
        if (half) {
          context.moveTo(tip - radius, middle);
          context.lineTo(tip, half === "upper" ? from : to);
          context.lineTo(tip + radius, middle);
        } else {
          context.moveTo(tip, from);
          context.lineTo(tip + radius, middle);
          context.lineTo(tip, to);
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
    syncStepArrows();
    const moving = playing || pending !== 0;
    play.setAttribute("aria-pressed", String(moving));
    if (playIcon) playIcon.textContent = moving ? "⏸" : "▶";
    if (playLabel) playLabel.textContent = moving ? "Пауза" : "Пуск";
    const noMotion = !isHorizontal() && !isVertical();
    stepButton.disabled = noMotion || (hubFour ? seekTarget ?? frame : frame) === maxFrame;
    backButton.disabled = (seekTarget ?? frame) === 0;
    play.disabled = noMotion || (!moving && frame === (hubFour && playDirection < 0 ? 0 : maxFrame));
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
    function zoomTo(physicalScale, px = 0, py = 0, anchorPointer = false) {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const box = bounds();
      const old = scaleFor(rect, camera, box);
      const pointerRow = camera.y + py / old;
      camera.scale = physicalScale;
      const shift = 1 / old - 1 / scaleFor(rect, camera, box);
      camera.x += px * shift;
      camera.y += py * shift;
      if (anchorPointer && element === canvas && layoutFieldHeight(box)) {
        const projectedY = fieldBoard.getBoundingClientRect().top + (pointerRow - box.top) * scaleFor(rect, camera, box);
        window.scrollBy(0, projectedY - (rect.top + rect.height / 2 + py));
      }
      redraw();
    }

    function zoomBy(factor, px = 0, py = 0, anchorPointer = false) {
      const box = bounds();
      const fitScale = fittedPixelScale(element.getBoundingClientRect(), camera, box);
      const current = camera.scale ?? fitScale;
      if (factor === 1) return;
      // Adjacent steps: … 1/3, 1/2, 1/1, 2/1, 3/1 …
      const direction = factor > 1 ? 1 : -1;
      const level = current >= 1 ? current : 2 - Math.round(1 / current);
      const next = level + direction;
      const maxDivisor = Math.ceil(Math.max(box.right - box.left, box.bottom - box.top));
      const scale = next >= 1 ? Math.min(next, Math.max(16, fitScale)) : 1 / Math.min(2 - next, maxDivisor);
      if (scale !== current) zoomTo(scale, px, py, anchorPointer);
    }

    function fitView() {
      fitCamera();
      redraw();
    }

    let wheelDistance = 0;
    element.addEventListener("wheel", event => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
      const delta = event.deltaY * unit;
      if (Math.sign(wheelDistance) !== Math.sign(delta)) wheelDistance = 0;
      wheelDistance += delta;
      if (Math.abs(wheelDistance) < 24 && event.deltaMode === 0) return;
      const factor = wheelDistance < 0 ? 2 : wheelDistance > 0 ? 0.5 : 1;
      wheelDistance = 0;
      zoomBy(factor, event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2, true);
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
      if (element === canvas && fieldBoard.classList.contains("romb-full-height")) window.scrollBy(0, drag.y - event.clientY);
      else camera.y -= (event.clientY - drag.y) / scale;
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
    const withControls = byId("romb-zen-controls");
    const exit = byId("romb-zen-exit");
    const grid = document.createElement("div");
    grid.className = "romb-zen-grid";
    grid.hidden = true;
    board.append(grid);

    function panel(name, title) {
      const section = document.createElement(title ? "details" : "div");
      section.className = "romb-zen-" + name;
      grid.append(section);
      if (!title) return section;
      section.classList.add("romb-zen-side");
      section.open = !window.matchMedia("(max-width: 640px)").matches;
      const heading = document.createElement("summary");
      heading.textContent = title;
      const body = document.createElement("div");
      section.append(heading, body);
      return body;
    }

    const top = panel("top");
    const motion = panel("motion", "Движение");
    const display = panel("display", "Рисунок и вид");
    const playback = panel("play");
    const timeline = panel("timeline");
    const placements = [];
    function place(holder, ...elements) {
      for (const element of elements) {
        if (!element) continue;
        const marker = document.createComment("romb-zen-home");
        element.before(marker);
        placements.push({element, holder, marker});
      }
    }

    place(top, frameLabel, size.closest(".romb-setting"),
      speed.closest(".romb-setting"), byId("romb-zen-pair") || enter, exit, byId("romb-record-status"), cycleNote);
    place(motion, horizontalMotion?.closest(".romb-motion-group"), verticalMotion?.closest(".romb-motion-group"),
      byId("romb-route-group"), byId("romb-counter-step"), byId("romb-stop-contact"), byId("romb-reverse-contact"));
    place(display, byId("romb-join-left"), byId("romb-join-right"), byId("romb-mark-repeats"), andButton,
      byId("romb-pattern-colors"), patternPalette, squareButton?.closest(".commands"), recordButton);
    place(playback, play.closest(".romb-run-steps"));
    place(timeline, frameControl);
    let previousView, previousFocus, nativeZen = false, mode = 0;

    function exitFullscreen() {
      if (document.fullscreenElement === board) document.exitFullscreen().catch(() => {});
    }

    // 0: normal page; 1: fullscreen field with controls; 2: field alone.
    function setZen(next) {
      if (next === mode) return;
      const wasActive = mode !== 0;
      const active = next !== 0;
      mode = next;
      zen = active;
      root.classList.toggle("romb-zen", active);
      root.classList.toggle("romb-zen-controls", next === 1);
      document.documentElement.classList.toggle("romb-zen-open", active);
      enter.setAttribute("aria-pressed", String(next === 2));
      withControls?.setAttribute("aria-pressed", String(next === 1));
      grid.hidden = next !== 1;
      exit.hidden = next !== 1;
      if (active && !wasActive) {
        previousView = {x: view.x, y: view.y, scale: view.scale};
        previousFocus = document.activeElement;
        placements.forEach(({element, holder}) => holder.append(element));
        fit();
        canvas.focus({preventScroll: true});
        board.requestFullscreen?.()?.catch(() => {});
      } else if (!active) {
        nativeZen = false;
        placements.forEach(({element, marker}) => marker.after(element));
        Object.assign(view, previousView);
        exitFullscreen();
        const target = previousFocus?.isConnected && previousFocus !== document.body ? previousFocus : enter;
        target.focus({preventScroll: true});
      } else {
        // Focus must not remain inside the controls when they become hidden.
        canvas.focus({preventScroll: true});
      }
      redraw();
    }

    enter.addEventListener("click", () => setZen(mode === 2 ? 0 : 2));
    withControls?.addEventListener("click", () => setZen(mode === 1 ? 0 : 1));
    exit.addEventListener("click", () => setZen(0));
    // Cancel native middle-button autoscroll on press; switch once on release.
    root.addEventListener("mousedown", event => {
      if (event.button === 1) event.preventDefault();
    });
    root.addEventListener("auxclick", event => {
      if (event.button !== 1) return;
      event.preventDefault();
      setZen((mode + 1) % 3);
    });
    document.addEventListener("fullscreenchange", () => {
      if (document.fullscreenElement === board) {
        if (zen) nativeZen = true;
        else exitFullscreen();
      } else if (nativeZen) {
        nativeZen = false;
        setZen(0);
      }
    });
    document.addEventListener("keydown", event => {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
      if (zen && event.key === "Escape") {
        event.preventDefault();
        setZen(0);
      } else if ((event.code === "KeyQ" || event.key.toLowerCase() === "q") &&
          !event.target.closest?.("input, select, textarea, [contenteditable=true]")) {
        event.preventDefault();
        setZen(zen ? 0 : 2);
      }
    });
  }

  const {zoomTo, zoomBy, fitView} = bindViewport(canvas, view, projectedBounds, fit);
  window.addEventListener("scroll", () => {
    if (fieldBoard.classList.contains("romb-full-height")) redraw();
  }, {passive: true});

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
    if (!isHorizontal() && !isVertical()) return;
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
  patternArea?.addEventListener("change", () => {
    patternMarks = null;
    syncMirrors();
    save();
    redraw();
  });
  for (const input of patternColors) {
    input.addEventListener("input", redraw);
    input.addEventListener("change", save);
  }
  for (const select of [size, width, heightFactor, horizontalMotion, verticalMotion, jointRoute].filter(Boolean)) {
    select.addEventListener("change", () => {
      if (horizontalMotion?.value !== "off") rememberedModes.x = horizontalMode();
      if (verticalMotion.value !== "off") rememberedModes.y = verticalMotion.value;
      save();
      reset();
    });
  }
  for (const [key, select, id] of [["x", horizontalMotion, "romb-horizontal-enabled"], ["y", verticalMotion, "romb-vertical-enabled"]]) {
    byId(id)?.addEventListener("click", () => {
      if (select.value === "off") select.value = rememberedModes[key];
      else {
        rememberedModes[key] = select.value;
        select.value = "off";
      }
      save();
      reset();
    });
  }
  verticalWrapButton?.addEventListener("click", () => {
    options.wrapY = !currentWrapY();
    if (seekTarget !== null) stop();
    changeMotion(verticalRouteChanges, options.wrapY);
    syncEdgeButtons();
    save();
    redraw();
  });
  for (const [button, delta] of [[stepMinus, -1], [stepPlus, 1]]) {
    button.addEventListener("click", () => {
      stepSize.value = stepCount() + delta;
      stepSize.dispatchEvent(new Event("change", {bubbles: true}));
    });
  }
  stepSize.addEventListener("input", () => {
    syncStepArrows();
    syncMirrors();
  });
  stepSize.addEventListener("change", () => {
    stepSize.value = stepCount();
    syncStepArrows();
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
    transport.prepend(frameControl);
    transport.append(frameLabel);
    transport.hidden = false;
    stepSize.setAttribute("aria-label", "Кадров за шаг");
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
      const before = motionKey();
      const previous = {...options};
      restore(event.detail?.globals?.widgetState?.modelContent);
      if (before !== motionKey() ||
          previous.counterStep !== options.counterStep || previous.buildAnd !== options.buildAnd) reset();
      else {
        if (previous.wrap !== options.wrap) {
          if (seekTarget !== null) stop();
          changeRoute(options.wrap);
        }
        if (previous.wrapY !== options.wrapY) {
          if (seekTarget !== null) stop();
          changeMotion(verticalRouteChanges, options.wrapY);
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
    mountScaleExample();
  }
  updateSpeed();
  reset();
  if (hubFour && window.parent === window) togglePlay();
  const observer = new ResizeObserver(redraw);
  observer.observe(canvas);
  if (!hubFour && coinSquareButton) observer.observe(combinedCanvas);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redraw);
})();
