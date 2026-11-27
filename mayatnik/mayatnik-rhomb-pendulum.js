/* Ромбовый Маятник v0.041 */
(() => {
  "use strict";

  const root = document.getElementById("rhomb-pendulum");
  const byId = id => root.querySelector("#" + id);
  const canvas = byId("romb-field");
  const fieldBoard = byId("romb-board");
  const fieldStage = byId("romb-field-stage");
  const comparison = byId("romb-comparison");
  const phaseList = byId("romb-phase-list");
  const phasePage = byId("romb-phase-page");
  let phaseFactor = 0, phaseKey = "", phaseTiles = [], averageTile;
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
  const halves = {x: byId("romb-horizontal-halves"), y: byId("romb-vertical-halves")};
  const motionModes = ["off", "double", "inward", "sync", "pendulum"];
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
  const reducedZoomButton = byId("romb-reduced-zoom");
  const andButton = byId("romb-build-and");
  const coinSquareButton = byId("romb-coin-square");
  const patternPalette = byId("romb-pattern-palette");
  const patternArea = byId("romb-pattern-area");
  const patternColors = [byId("romb-pattern-zero"), byId("romb-pattern-one")];
  const recordButton = byId("romb-record");
  const recordLabel = byId("romb-record-label");
  const gifCycleButton = byId("romb-gif-cycle");
  const gifTrack = byId("romb-gif-track");
  const gifSliders = [byId("romb-gif-first"), byId("romb-gif-last")];
  const gifNumbers = [byId("romb-gif-first-value"), byId("romb-gif-last-value")];
  const combinedView = byId("romb-combined-view");
  const combinedCanvas = byId("romb-combined");
  const combinedContext = combinedCanvas.getContext("2d");
  const edgeButtons = {
    wrap: byId("romb-wrap"),
    joinLeft: byId("romb-join-left"),
    joinRight: byId("romb-join-right"),
    reverseAtContact: byId("romb-reverse-contact"),
    markRepeats: byId("romb-mark-repeats"),
    patternColors: byId("romb-pattern-colors"),
    counterStep: byId("romb-counter-step")
  };
  const options = {wrap: false, wrapY: false, joinLeft: false, joinRight: false, reverseAtContact: false,
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
  let allowReducedZoom = false;
  let gifFullCycle = false;
  let gifControlsDirty = true;
  const gifRange = [0, 64];
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
    for (const [key, select, name] of [["y", verticalMotion, "verticalMotion"], ["x", horizontalMotion, "horizontalMotion"]]) {
      if (!select) continue;
      const previous = saved[name] ?? (key === "x" ? (isVertical() ? "off" : saved.counterStep ? "outward" : "pendulum") : "off");
      const mode = previous === "outward" ? "sync" : previous;
      if (motionModes.includes(mode)) select.value = mode;
      if (halves[key]) {
        const legacy = previous === "off" ? saved.rememberedModes?.[key] : previous;
        halves[key].value = saved.halves?.[key] ?? (["outward", "inward"].includes(legacy) ? "apart" : "together");
      }
    }
    if (heightFactor) heightFactor.value = [2, 4].includes(saved.heightFactor) ? saved.heightFactor
      : isVertical() && [2, 4].includes(saved.factor) ? saved.factor : 2;
    if (jointRoute && Object.hasOwn(routeNames, saved.jointRoute)) jointRoute.value = saved.jointRoute;
    for (const key of ["x", "y"]) {
      const previous = saved.rememberedModes?.[key];
      const mode = previous === "outward" ? "sync" : previous;
      if (motionModes.includes(mode) && mode !== "off") {
        rememberedModes[key] = mode;
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
    allowReducedZoom = saved.allowReducedZoom === true;
    view.scale = limitPixelScale(view.scale, view);
    gifFullCycle = saved.gifFullCycle === true;
    gifControlsDirty = true;
    if (Array.isArray(saved.gifRange) && Number.isSafeInteger(saved.gifRange[0]) && Number.isSafeInteger(saved.gifRange[1])) {
      gifRange[0] = Math.max(0, saved.gifRange[0]);
      gifRange[1] = Math.max(gifRange[0], saved.gifRange[1]);
    }
  }

  function save() {
    if (hubFour) {
      try { localStorage.setItem(hubStepKey, String(stepCount())); } catch { /* Optional preferences. */ }
      return;
    }
    const settings = {
      rows: Number(size.value), factor: Number(width.value), step: stepCount(), speed: Number(speed.value),
      verticalMotion: verticalMotion.value, halves: {x: halves.x?.value, y: halves.y?.value},
      horizontalMotion: horizontalMode(), heightFactor: Number(heightFactor?.value || width.value),
      jointRoute: jointRoute?.value || "cw", rememberedModes: {...rememberedModes},
      combination: combineMode.value, flipSecond: flipSecond.checked,
      patternArea: patternArea?.value, patternPalette: patternColors.map(input => input.value),
      allowReducedZoom, gifFullCycle, gifRange: [...gifRange], ...options
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
    return hubFour ? "pendulum" : horizontalMotion?.value || (isVertical() ? "off" : options.counterStep ? "sync" : "pendulum");
  }

  function isHorizontal() {
    return horizontalMode() !== "off";
  }

  function isJoint() {
    return isHorizontal() && isVertical();
  }

  function splitAxis(key) {
    return !hubFour && (halves[key]?.value === "apart" || (key === "x" && !horizontalMotion && options.counterStep));
  }

  function pairedMotion() {
    const mode = isVertical() ? verticalMotion.value : horizontalMode();
    return !isJoint() && (["pendulum", "double", "inward"].includes(mode) ||
      (mode === "sync" && splitAxis(isVertical() ? "y" : "x")));
  }

  function motionKey() {
    return [size.value, width.value, heightFactor?.value, horizontalMode(), verticalMotion.value,
      splitAxis("x"), splitAxis("y"), jointRoute?.value].join("|");
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
    advanceFrame();
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

  function horizontalCycle(wrap, reverse) {
    const {W, H} = field;
    // Same fixed routes and starts as the published 160-variant calculation.
    const routePeriod = reverse ? 4 * (H - 1) : wrap ? 2 * W : 4 * (W - 1);
    const start = options.buildAnd
      ? reverse ? 2 * (H - 1) : wrap ? 2 * W : 2 * (W - 1)
      : reverse ? H : W;
    const knownPeriod = options.buildAnd ? routePeriod : routePeriod * H / 2;
    return {start, routePeriod, knownPeriod};
  }

  function configureCycle() {
    gifControlsDirty = true;
    reportedCycle = null;
    // The first, centered pass is identical in both edge modes.
    const wrap = routeChanges.get(1) ?? routeChanges.get(0);
    const reverse = reversalChanges.get(1) ?? reversalChanges.get(0);
    if (isVertical() || horizontalMode() !== "pendulum" || splitAxis("x") || [...reversalChanges].some(([at, value]) => at > 1 && value !== reverse) ||
        [...routeChanges].some(([at, value]) => at > 1 && value !== wrap)) {
      cycle = null;
      return;
    }
    const {start, routePeriod, knownPeriod} = horizontalCycle(wrap, reverse);
    reportedCycle = {start, returned: start + knownPeriod};
    if (options.buildAnd || reverse) {
      cycle = null;
      return;
    }
    if (cycle?.wrap === wrap) return;
    // Keep live wrap/rewind behaviour separate from the known reference.
    const period = field.H <= 128 ? knownPeriod : 0;
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
    reducedZoomButton?.setAttribute("aria-pressed", String(allowReducedZoom));
    andButton?.setAttribute("aria-pressed", String(options.buildAnd));
    coinSquareButton?.setAttribute("aria-pressed", String(options.coinSquare));
    const both = isJoint();
    for (const [key, select, id] of [["x", horizontalMotion, "romb-horizontal-enabled"], ["y", verticalMotion, "romb-vertical-enabled"]]) {
      if (!select) continue;
      const active = select.value !== "off";
      if (halves[key]) halves[key].disabled = !active;
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
    edgeButtons.reverseAtContact.disabled = !pairedMotion();
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
    const reference = section.querySelector("figure[data-rows]");
    const referenceHeight = Number(reference.dataset.rows);
    for (const figure of section.querySelectorAll("figure[data-rows]")) {
      const height = Number(figure.dataset.rows);
      const example = MAYATNIK.field(height - 1, height, "empty");
      const center = (example.W - 1) / 2;
      drawPass(example, height / 2, center, center, false, 0, 0);
      const target = figure.querySelector("canvas");
      const ctx = target.getContext("2d");
      if (!ctx) continue;
      const buttons = figure.querySelectorAll("button");
      let selected = figure.querySelector('[aria-pressed="true"]');

      function sizeOnScreen() {
        const ratio = devicePixelRatio || 1;
        target.style.width = target.width / ratio + "px";
        target.style.height = target.height / ratio + "px";
      }

      function render() {
        const match = selected.hasAttribute("data-match-height");
        const scale = match ? Math.max(1, Math.round(referenceHeight / height)) : Number(selected.dataset.scale);
        const block = Number(selected.dataset.block || 1);
        const rows = Math.round(height * scale), columns = Math.round(example.W * scale);
        target.width = columns * block;
        target.height = rows * block;
        sizeOnScreen();
        for (let y = 0; y < rows; y++) {
          const row = Math.floor((y + 0.5) / scale) * example.W;
          for (let x = 0; x < columns; x++) {
            const col = Math.floor((x + 0.5) / scale);
            let bit = example.val[row + col];
            if (bit < 0 && scale < 1 && col + 1 < example.W) bit = example.val[row + col + 1];
            if (bit >= 0) {
              ctx.fillStyle = colors[bit];
              ctx.fillRect(x * block, y * block, block, block);
            }
          }
        }
        for (const button of buttons) button.setAttribute("aria-pressed", String(button === selected));
        const cell = scale < 1 ? block : scale;
        const difference = target.height - referenceHeight;
        const comparison = difference === 0 ? " · высота как при 1:1" :
          " · на " + Math.abs(difference) + " пикс. " + (difference < 0 ? "ниже" : "выше");
        figure.querySelector("output").textContent = (scale < 1 ? rows : height) + " × " +
          cell + " = " + target.height + " пикс." + comparison;
      }

      for (const button of buttons) button.addEventListener("click", () => {
        selected = button;
        if (button.hasAttribute("data-match-height")) reference.querySelector('[data-scale="1"]').click();
        render();
      });
      window.addEventListener("resize", sizeOnScreen);
      render();
    }
  }

  function advancePass() {
    routeReverse = currentReverse();
    const watchContact = pairedMotion() && routeReverse;
    const contact = isJoint() ? advanceJoint() : advanceAxis(watchContact);
    if (contact) {
      for (const branch of branches) branch.direction *= -1;
    }
  }

  function advanceFrame() {
    patternMarks = null;
    advancePass();
    if (checkpointLimit && frame % checkpointInterval === 0 && !checkpoints.has(frame)) {
      if (checkpoints.size === checkpointLimit) checkpoints.delete(checkpoints.keys().next().value);
      checkpoints.set(frame, {bits: field.val.slice(), firstPaintedRow, endPaintedRow, branches: branches.map(item => ({...item})),
        jointPoints: jointPoints.map(point => ({...point})), spiral: {...spiral}, column, routeWrap, routeWrapY, routeReverse});
    }
    observeCycle();
  }

  function axisPoint(branch) {
    return isVertical() ? {center: (field.W - 1) / 2, top: branch.column} : {center: branch.column, top: 0};
  }

  function lowerPoint(upper) {
    const end = field.H - 2 * depth;
    return {
      center: isHorizontal() && splitAxis("x") ? field.W - 1 - upper.center : upper.center,
      top: isVertical() && splitAxis("y")
        ? MayatnikEdgeFlow.mapColumn(2 * Math.floor(end / 2) - upper.top, end + 1, !routeWrapY) : upper.top
    };
  }

  function passAt(upper, lower = lowerPoint(upper)) {
    buildPass(upper.center, lower.center, options.buildAnd, upper.top, lower.top);
  }

  // Both tips read the same pre-frame field. Save the rows touched by the
  // first pass, then combine its XOR or AND contribution with the second.
  function simultaneousPasses(first, second) {
    const lower = lowerPoint(first);
    if (first.center === second.center && first.top === second.top) {
      passAt(first, lower);
      return;
    }
    const {W, val} = field;
    const top = Math.min(first.top, lower.top + depth);
    const bottom = Math.max(first.top + depth, lower.top + 2 * depth);
    const saved = [];
    for (let row = top; row < bottom; row++) {
      const upperRow = row - first.top;
      const lowerRow = row - lower.top;
      let left = W, right = -1;
      if (upperRow >= 0 && upperRow < depth) {
        left = first.center - upperRow;
        right = first.center + upperRow;
      }
      if (lowerRow >= depth && lowerRow < 2 * depth) {
        const radius = 2 * depth - lowerRow - 1;
        left = Math.min(left, lower.center - radius);
        right = Math.max(right, lower.center + radius);
      }
      if (left > right) continue;
      const start = row * W + Math.max(0, left);
      saved.push({start, data: val.slice(start, row * W + Math.min(W, right + 1))});
    }
    passAt(first, lower);
    for (const {start, data} of saved) {
      for (let i = 0; i < data.length; i++) {
        const old = data[i], next = val[start + i];
        val[start + i] = old;
        if (next === old) data[i] = -1;
        else data[i] = old < 0 || options.buildAnd ? next : old ^ next;
      }
    }
    passAt(second);
    for (const {start, data} of saved) {
      for (let i = 0; i < data.length; i++) {
        if (data[i] >= 0) val[start + i] = MAYATNIK.accumulateBit(val[start + i], data[i], options.buildAnd);
      }
    }
  }

  function advanceAxis(watchContact) {
    const vertical = isVertical();
    const mode = vertical ? verticalMotion.value : horizontalMode();
    routeWrap = currentWrap();
    routeWrapY = currentWrapY();
    const wrap = vertical ? routeWrapY : routeWrap;
    const positions = vertical ? field.H - 2 * depth + 1 : field.W;
    const before = branches[0].column - branches[1].column;
    const split = splitAxis(vertical ? "y" : "x");
    const upper = mode === "pendulum" ? branches[frame % 2] : branches[1];
    const moved = mode !== "off" && moveBranch(upper, positions, wrap);
    const twoTracks = mode === "double" || mode === "inward" || (mode === "sync" && split);
    const otherMoved = twoTracks && moveBranch(branches[0], positions, wrap);
    if (!twoTracks && mode !== "pendulum") branches[0] = {...upper};
    const point = axisPoint(upper);
    column = point.center;
    if (mode === "double" || (mode === "inward" && !split)) simultaneousPasses(point, axisPoint(branches[0]));
    else if (twoTracks) passAt(point, axisPoint(branches[0]));
    else passAt(point);
    frame++;
    if (!watchContact || !moved || (twoTracks && !otherMoved)) return false;
    const after = branches[0].column - branches[1].column;
    if (vertical && twoTracks && split && mode !== "double")
      return before !== 0 && (after === 0 || Math.sign(after) !== Math.sign(before));
    const contact = 2 * depth - 1;
    return mode === "inward" ? Math.abs(before) > contact && Math.abs(after) <= contact
      : Math.abs(before) < contact && Math.abs(after) >= contact;
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
    passAt(point);
    frame++;
    return false;
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

  function findCheckpoint(target, start) {
    let checkpoint = null;
    for (const [at, saved] of checkpoints) {
      if (at > start && at <= target) {
        start = at;
        checkpoint = {at, saved};
      }
    }
    return checkpoint;
  }

  function restoreCheckpoint(at, checkpoint) {
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
    frame = at;
  }

  function seek(target, lap = cycle && target >= cycle.start ? cycle.lap : 0) {
    stop();
    patternMarks = null;
    if (cycle) cycle.lap = lap;
    const current = frame <= target ? frame : 0;
    const checkpoint = findCheckpoint(target, current);
    const start = checkpoint?.at ?? current;
    const retreat = hubFour && target < frame && frame - target < target - start;
    if (!retreat && checkpoint) {
      restoreCheckpoint(start, checkpoint.saved);
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

  function limitPixelScale(scale, camera) {
    return scale !== null && camera === view && !allowReducedZoom ? Math.max(1, scale) : scale;
  }

  function fittedPixelScale(rect, camera, bounds) {
    const dpr = devicePixelRatio || 1;
    const across = Math.round(rect.width * dpr) / (bounds.right - bounds.left);
    const available = camera === view && pageField() ? across
      : Math.min(across, Math.round(rect.height * dpr) / (bounds.bottom - bounds.top));
    if (available <= 0) return 1;
    const scale = available >= 1 ? Math.floor(available) : 1 / Math.ceil(1 / available);
    return limitPixelScale(scale, camera);
  }

  function fieldFitRect() {
    // In Zen, the comparison takes space from the canvas after the scale is chosen.
    return (zen ? fieldBoard : fieldStage).getBoundingClientRect();
  }

  function scaleFor(rect, camera = view, bounds = projectedBounds()) {
    const selected = camera.scale ?? fittedPixelScale(camera === view && phaseList ? fieldFitRect() : rect, camera, bounds);
    return (camera === view && phaseList ? Math.max(1, selected) : selected) / (devicePixelRatio || 1);
  }

  function scaleLabel(scale) {
    return scale >= 1 ? scale + "/1" : "1/" + Math.round(1 / scale);
  }

  function updateViewBounds() {
    const half = Math.floor(field.W / 2);
    const start = options.joinLeft ? -half : 0;
    const end = field.W + (options.joinRight ? half : 0);
    if (view.start !== start || view.end !== end) {
      patternPainter = null;
      patternMarks = null;
    }
    view.start = start;
    view.end = end;
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
    for (let i = 0; i < renderRhombs.length; i++) {
      const first = renderRhombs[i];
      for (let j = i + 1; j < renderRhombs.length; j++) {
        const second = renderRhombs[j];
        if (renderRhombs.length === 4 && first.half !== second.half) continue;
        if (first.center === second.center && first.top === second.top) continue;
        if (matchingPositionBlock(row, col, first, second) || matchingPositionBlock(row, col, second, first)) return 2;
      }
    }
    const half = Math.floor(field.W / 2);
    if (options.joinLeft && col >= field.W - half) return 4;
    if (options.joinRight && col < half) return 6;
    return 0;
  }

  function patternAt(marks, index) {
    return marks && (marks[index >> 3] & (1 << (index & 7)));
  }

  function createPatternPainter() {
    return window.MayatnikRhombPatternColors.create(field.W, field.H, view.start, view.end);
  }

  // Geometry of the two current source passes. Half modes keep the original
  // upper/lower pieces; joint routes retain the two most recent whole rhombs.
  function sourceRhombs(all = true) {
    const vertical = isVertical();
    const mode = vertical ? verticalMotion.value : horizontalMode();
    const split = (isHorizontal() && splitAxis("x")) || (vertical && splitAxis("y"));
    const active = frame ? (frame - 1) % 2 : 0;
    if (!isJoint() && split && (mode === "sync" || mode === "inward")) {
      return [{...axisPoint(branches[1]), half: "upper"}, {...axisPoint(branches[0]), half: "lower"}];
    }
    let points;
    if (isJoint()) points = all ? jointPoints : [jointPoints[active]];
    else if (mode === "double" || mode === "inward") points = branches.map(axisPoint);
    else if (mode === "pendulum") points = (all ? branches : [branches[active]]).map(axisPoint);
    else points = [axisPoint(branches[1])];
    return split ? points.flatMap(point => [{...point, half: "upper"}, {...lowerPoint(point), half: "lower"}]) : points;
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

  function paintSquareBits(x, y, scale, w, h, bounds, marks, output = words) {
    const {W, H, val} = field;
    const displayWidth = view.end - view.start;
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
        const bit = val[row * W + col];
        const patternIndex = row * displayWidth + displayed - view.start;
        if (bit >= 0) output[py * w + px] = colorWords[bit + bitTone(row, col, marks, patternIndex)];
      }
    }
  }

  function tileBuffer(tile, width, height, ratio) {
    if (!tile.image || tile.image.width !== width || tile.image.height !== height) {
      tile.canvas.width = width;
      tile.canvas.height = height;
      tile.image = tile.ctx.createImageData(width, height);
      tile.words = new Uint32Array(tile.image.data.buffer);
    }
    tile.canvas.style.width = width / ratio + "px";
    tile.canvas.style.height = height / ratio + "px";
  }

  function sampleTiles(factor, width, height, ratio) {
    if (phaseFactor !== factor) {
      phaseFactor = factor;
      phasePage.value = "1";
    }
    const total = factor * factor;
    const pages = Math.ceil(total / 64);
    const page = clamp(Math.round(phasePage.valueAsNumber) || 1, 1, pages);
    const key = factor + "/" + page;
    if (phaseKey !== key) {
      phasePage.max = String(pages);
      phasePage.value = String(page);
      byId("romb-phase-pages").hidden = pages === 1;
      byId("romb-phase-count").textContent = "· " + formatter.format(total);
      const fragment = document.createDocumentFragment();
      phaseTiles = [];
      for (let i = (page - 1) * 64; i < Math.min(page * 64, total); i++) {
        const dx = i % factor, dy = Math.floor(i / factor);
        const figure = document.createElement("figure");
        const label = document.createElement("figcaption");
        label.textContent = "(" + dx + ", " + dy + ")";
        const tile = document.createElement("canvas");
        figure.append(label, tile);
        fragment.append(figure);
        phaseTiles.push({dx, dy, canvas: tile, ctx: tile.getContext("2d")});
      }
      phaseList.replaceChildren(fragment);
      phaseKey = key;
    }
    if (!averageTile) {
      const tile = byId("romb-average");
      averageTile = {canvas: tile, ctx: tile.getContext("2d")};
    }
    tileBuffer(averageTile, width, height, ratio);
    for (const tile of phaseTiles) tileBuffer(tile, width, height, ratio);
  }

  function paintSamples(factor, x, y, bounds, ratio) {
    // Align blocks to the 1:1 raster. Panning clips edge blocks without changing their phase.
    const originX = x + Math.floor(bounds.left), originY = y + Math.floor(bounds.top);
    const left = Math.max(0, originX), top = Math.max(0, originY);
    const right = Math.min(pixels.width, x + Math.ceil(bounds.right));
    const bottom = Math.min(pixels.height, y + Math.ceil(bounds.bottom));
    const startX = originX + Math.floor((left - originX) / factor) * factor;
    const startY = originY + Math.floor((top - originY) / factor) * factor;
    const width = Math.max(1, Math.ceil((right - startX) / factor));
    const height = Math.max(1, Math.ceil((bottom - startY) / factor));
    sampleTiles(factor, width, height, ratio);
    const source = pixels.data, stride = pixels.width;
    const average = averageTile.image.data;
    for (let row = 0; row < height; row++) {
      const by = startY + row * factor, y0 = Math.max(top, by), y1 = Math.min(bottom, by + factor);
      for (let col = 0; col < width; col++) {
        const bx = startX + col * factor, x0 = Math.max(left, bx), x1 = Math.min(right, bx + factor);
        let red = 0, green = 0, blue = 0, alpha = 0;
        for (let sy = y0; sy < y1; sy++) {
          let at = (sy * stride + x0) * 4;
          for (let sx = x0; sx < x1; sx++, at += 4) {
            const a = source[at + 3];
            red += source[at] * a;
            green += source[at + 1] * a;
            blue += source[at + 2] * a;
            alpha += a;
          }
        }
        const at = 4 * (row * width + col);
        average[at] = alpha ? red / alpha : 0;
        average[at + 1] = alpha ? green / alpha : 0;
        average[at + 2] = alpha ? blue / alpha : 0;
        average[at + 3] = alpha / Math.max(1, (x1 - x0) * (y1 - y0));
      }
    }
    averageTile.ctx.putImageData(averageTile.image, 0, 0);
    for (const tile of phaseTiles) {
      for (let row = 0; row < height; row++) {
        const sy = startY + row * factor + tile.dy;
        for (let col = 0; col < width; col++) {
          const sx = startX + col * factor + tile.dx;
          tile.words[row * width + col] = sy >= top && sy < bottom && sx >= left && sx < right ? words[sy * stride + sx] : 0;
        }
      }
      tile.ctx.putImageData(tile.image, 0, 0);
    }
  }

  phasePage?.addEventListener("change", () => {
    phasePage.value = String(clamp(Math.round(phasePage.valueAsNumber) || 1, 1, Number(phasePage.max)));
    redraw();
  });

  function layoutFieldHeight(bounds) {
    const fullHeight = pageField();
    fieldBoard.classList.toggle("romb-full-height", fullHeight);
    if (fullHeight) {
      const scale = scaleFor(fieldStage.getBoundingClientRect(), view, bounds);
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
    const ratio = devicePixelRatio || 1;
    const selectedScale = view.scale ?? fittedPixelScale(phaseList ? fieldFitRect() : canvas.getBoundingClientRect(), view, bounds);
    const compare = !!comparison && selectedScale < 1;
    if (comparison) comparison.hidden = !compare;
    const fullHeight = layoutFieldHeight(bounds);
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const {W, H} = field;
    const displayWidth = view.end - view.start;
    renderRhombs = sourceRhombs();
    const viewWidth = bounds.right - bounds.left;
    const viewHeight = bounds.bottom - bounds.top;
    const scale = compare ? 1 : selectedScale;
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
    if (options.patternColors) {
      patternPainter ??= createPatternPainter();
      if (frame) {
        patternMarks ??= patternPainter.update(field.val, patternArea?.value);
        marks = patternMarks;
      }
    }
    words.fill(0);
    if (options.square) paintSquareBits(x, y, scale, w, h, bounds, marks);
    else paintFlatBits(x, y, scale, w, h, marks);
    if (compare) paintSamples(Math.round(1 / selectedScale), x, y, bounds, ratio);
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
    if (options.patternColors && patternPainter.centralAxis > view.start && patternPainter.centralAxis < view.end) {
      const axisX = x + patternPainter.centralAxis * scale;
      context.moveTo(axisX, y);
      context.lineTo(axisX, y + H * scale);
    }
    if (view.start < 0) {
      context.moveTo(x, y);
      context.lineTo(x, y + H * scale);
    }
    if (view.end > W) {
      context.moveTo(x + W * scale, y);
      context.lineTo(x + W * scale, y + H * scale);
    }
    context.stroke();
    if (frame) paintOutlines(x, y, scale, ratio, styles);
    context.restore();
    if (!zen) paintCombined();

    updateLabels(scale, compare ? selectedScale : null);
  }

  function paintFlatBits(x, y, scale, w, h, marks, output = words, columns = sampleColumn, pairs = samplePair) {
    const {W, H, val} = field;
    const displayWidth = view.end - view.start;
    const firstX = Math.max(0, Math.ceil(x + view.start * scale - 0.5));
    const lastX = Math.min(w, Math.ceil(x + view.end * scale - 0.5));
    const firstY = Math.max(0, Math.ceil(y - 0.5));
    const lastY = Math.min(h, Math.ceil(y + H * scale - 0.5));
    const searchPixel = marks && scale < 1;
    for (let px = firstX; px < lastX; px++) {
      const displayed = clamp(Math.floor((px + 0.5 - x) / scale), view.start, view.end - 1);
      const col = sourceColumn(displayed, W);
      columns[px] = displayed;
      // Below 1:1, keep a staggered bit when its neighbor shares this pixel.
      pairs[px] = col + 1 < W && displayed + 1 < view.end && (displayed + 1.5) * scale + x < px + 1;
      if (searchPixel) {
        sampleStart[px] = Math.max(view.start, Math.ceil((px - x) / scale - 0.5));
        sampleEnd[px] = Math.min(view.end, Math.ceil((px + 1 - x) / scale - 0.5));
      }
    }
    for (let py = firstY; py < lastY; py++) {
      const row = clamp(Math.floor((py + 0.5 - y) / scale), 0, H - 1);
      const sourceRow = row * W;
      const patternRow = row * displayWidth - view.start;
      const out = py * w;
      for (let px = firstX; px < lastX; px++) {
        let displayed = columns[px];
        let col = sourceColumn(displayed, W);
        let bit = val[sourceRow + col];
        if (bit < 0 && pairs[px]) {
          displayed++;
          bit = val[sourceRow + ++col];
        }
        // Keep a thin marked line visible when the field is fitted to the canvas.
        if (searchPixel && !patternAt(marks, patternRow + displayed)) {
          for (let candidate = sampleStart[px]; candidate < sampleEnd[px]; candidate++) {
            if (!patternAt(marks, patternRow + candidate)) continue;
            displayed = candidate;
            col = sourceColumn(displayed, W);
            bit = val[sourceRow + col];
            break;
          }
        }
        if (bit >= 0) output[out + px] = colorWords[bit + bitTone(row, col, marks, patternRow + displayed)];
      }
    }
  }

  function syncFrameSlider() {
    if (frame > normalSliderMax) {
      const span = 2 * (isVertical() ? field.H : field.W) + 1;
      const limit = Math.min(maxFrame, Math.ceil(frame / span) * span);
      if (limit !== normalSliderMax) {
        normalSliderMax = limit;
        gifControlsDirty = true;
      }
    }
    if (gifControlsDirty) syncGifControls();
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
    const vertical = isVertical();
    const points = sourceRhombs(false);
    const position = point => formatter.format(1 + (vertical ? point.top + (point.half === "lower" ? depth : 0) : point.center));
    if (points.length === 1) return (vertical ? " · вершина, строка " : " · столбец ") + position(points[0]);
    if (!points[0].half) return (vertical ? " · вершины, строки " : " · вершины, столбцы ") + points.map(position).join(", ");
    return " · верх " + points.filter(p => p.half === "upper").map(position).join(", ") +
      " · низ " + points.filter(p => p.half === "lower").map(position).join(", ");
  }

  function contactText() {
    if (!pairedMotion() || !currentReverse()) return "";
    const distance = separation();
    if (isVertical() && splitAxis("y") && ["sync", "inward"].includes(verticalMotion.value))
      return distance <= 1 ? " · касание" : "";
    if (distance === 2 * depth - 1) return " · касание";
    return distance === 2 * depth ? " · порог касания" : "";
  }

  function updateLabels(scale, comparisonScale) {
    const {W, H} = field;
    const vertical = isVertical();
    const position = positionText() + (frame && !vertical && !splitAxis("x") && !["double", "inward"].includes(horizontalMode()) ? " из " + formatter.format(W) : "");
    const dimensions = vertical ? " · поле " + formatter.format(W) + " × " + formatter.format(H) : " · " + formatter.format(H) + " строк";
    const target = seekTarget === null ? "" : " → " + formatter.format(seekTarget);
    const contact = contactText();
    const zoom = comparisonScale ? "поле 1/1 · внизу " + scaleLabel(comparisonScale) : scaleLabel(scale);
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
    paintCoinBits(combinedWords, width, height, originX, originY, scale, {left, top, right, bottom});
    combinedContext.putImageData(combinedPixels, 0, 0);
    if (coinFrameInfo) {
      const zoom = scaleLabel(scale);
      coinFrameInfo.textContent = "Кадр " + formatter.format(frame) + " · " + zoom + (options.coinSquare ? " · квадрат" : "");
    }
  }

  function paintCoinBits(output, width, height, originX, originY, scale, {left, top, right, bottom}) {
    const {W, val} = field;
    const H = 2 * depth;
    const mode = combineMode.value;
    const x0 = Math.max(0, Math.floor(originX + left * scale));
    const x1 = Math.min(width, Math.ceil(originX + right * scale));
    const y0 = Math.max(0, Math.floor(originY + top * scale));
    const y1 = Math.min(height, Math.ceil(originY + bottom * scale));
    const sources = sourceRhombs();
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
        const piece = sources.length === 4 && row >= depth ? 1 : 0;
        const first = sources[piece], second = sources.length === 4 ? sources[piece + 2] : sources[1] || first;
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
        output[py * width + px] = colorWords[color];
      }
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
        if (source.matches("input[type=range], input[type=number]") && copy.max !== source.max) copy.max = source.max;
        if (source.matches("input, select") && copy.value !== source.value) copy.value = source.value;
      } else if (source === gifTrack) {
        if (copy.style.cssText !== source.style.cssText) copy.style.cssText = source.style.cssText;
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

  // The exporter advances a private field in synchronous slices. The live run
  // is back in place before any browser event or animation tick can run.
  function runState() {
    return {field, frame, column, branches, jointPoints, spiral, routeWrap, routeWrapY, routeReverse,
      routeChanges, verticalRouteChanges, reversalChanges, firstPaintedRow, endPaintedRow, renderRhombs};
  }

  function useRun(state) {
    ({field, frame, column, branches, jointPoints, spiral, routeWrap, routeWrapY, routeReverse,
      routeChanges, verticalRouteChanges, reversalChanges, firstPaintedRow, endPaintedRow, renderRhombs} = state);
  }

  function withGifRun(job, action) {
    const live = runState();
    try {
      useRun(job.run);
      return action();
    } finally {
      job.run = runState();
      useRun(live);
    }
  }

  function gifSettings() {
    return JSON.stringify([motionKey(), options, combineMode.value, flipSecond.checked,
      patternArea?.value, patternColors.map(input => input.value)]);
  }

  function syncGifControls() {
    gifControlsDirty = false;
    const cycleEnd = reportedCycle ? reportedCycle.returned - 1 : 0;
    const inputLimit = Math.max(maxFrame, cycleEnd);
    gifRange[0] = clamp(gifRange[0], 0, inputLimit);
    gifRange[1] = clamp(gifRange[1], gifRange[0], inputLimit);
    const limit = Math.max(normalSliderMax, cycleEnd, gifRange[1], 1);
    const pressed = String(gifFullCycle);
    if (gifCycleButton.getAttribute("aria-pressed") !== pressed) gifCycleButton.setAttribute("aria-pressed", pressed);
    gifRange.forEach((value, index) => {
      const slider = gifSliders[index], number = gifNumbers[index];
      if (Number(slider.max) !== limit) slider.max = String(limit);
      if (Number(number.max) !== inputLimit) number.max = String(inputLimit);
      for (const input of [slider, number]) {
        if (input.valueAsNumber !== value) input.value = String(value);
        if (input.disabled !== gifFullCycle) input.disabled = gifFullCycle;
      }
    });
    for (const [index, property] of ["--gif-first", "--gif-last"].entries()) {
      const position = 100 * gifRange[index] / limit + "%";
      if (gifTrack.style.getPropertyValue(property) !== position) gifTrack.style.setProperty(property, position);
    }
  }

  function updateGifEndpoint(index, input) {
    const value = input.valueAsNumber;
    if (Number.isFinite(value)) {
      gifRange[index] = index === 0 ? clamp(Math.round(value), 0, gifRange[1])
        : clamp(Math.round(value), gifRange[0], Math.max(maxFrame, reportedCycle ? reportedCycle.returned - 1 : 0));
    }
    syncGifControls();
    syncMirrors();
  }

  function checkGifJob(job) {
    if (job.cancelled) throw Error("Сборка отменена.");
    if (gifSettings() !== job.settings) throw Error("Параметры поля изменились. Запустите сборку ещё раз.");
  }

  function gifProgress(job, message, immediate = false) {
    const now = performance.now();
    if (!immediate && now < job.nextUpdate) return;
    job.status.textContent = message + " · масштаб " + scaleLabel(job.scale);
    job.nextUpdate = now + 200;
  }

  async function advanceGif(job, target, reportPasses = true) {
    while (job.run.frame < target) {
      checkGifJob(job);
      withGifRun(job, () => {
        const until = performance.now() + 12;
        do { advancePass(); } while (frame < target && performance.now() < until);
      });
      if (job.run.frame < target) {
        if (reportPasses) gifProgress(job, "Расчёт прохода " + formatter.format(job.run.frame));
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }

  function routePhase() {
    if (!isJoint()) {
      const mode = isVertical() ? verticalMotion.value : horizontalMode();
      return mode === "pendulum" ? frame % 2 : 0;
    }
    const radius = Math.floor((frame - 1) / 4) + 1;
    const rows = field.H - 2 * depth + 1;
    const px = routeWrap ? field.W : Math.max(1, 2 * (field.W - 1));
    const py = routeWrapY ? rows : Math.max(1, 2 * (rows - 1));
    return [frame % 4, radius % px, radius % py].join("/");
  }

  async function findGifCycle(job) {
    if (!isVertical() && horizontalMode() === "pendulum" && !splitAxis("x")) {
      const {start, knownPeriod} = horizontalCycle(job.run.routeWrap, job.run.routeReverse);
      await advanceGif(job, start);
      return knownPeriod;
    }
    // Brent's algorithm keeps one reference field. On a match the current
    // state is already on the repeating orbit, ready to encode a whole lap.
    await advanceGif(job, 1);
    let distance = 0, windowSize = 1, reference;
    for (;;) {
      checkGifJob(job);
      const period = withGifRun(job, () => {
        const until = performance.now() + 12;
        do {
          if (!reference || distance === windowSize) {
            reference = {bits: field.val.slice(), phase: routePhase(), column,
              branches: branches.map(b => ({...b})), points: jointPoints.map(p => ({...p}))};
            if (distance) windowSize *= 2;
            distance = 0;
          }
          advancePass();
          distance++;
          if (column === reference.column && routePhase() === reference.phase &&
              branches.every((b, i) => b.column === reference.branches[i].column && b.direction === reference.branches[i].direction) &&
              jointPoints.every((p, i) => p.center === reference.points[i].center && p.top === reference.points[i].top) &&
              field.val.every((bit, i) => bit === reference.bits[i])) return distance;
        } while (performance.now() < until);
        return 0;
      });
      if (period) return period;
      gifProgress(job, "Поиск повтора · проход " + formatter.format(job.run.frame));
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  function gifPixels(job) {
    const {width, height, scale, bounds} = job;
    const output = new Uint32Array(width * height);
    const x = -Math.floor(bounds.left * scale), y = -Math.floor(bounds.top * scale);
    if (job.coin) {
      paintCoinBits(output, width, height, x, y, scale, bounds);
    } else {
      renderRhombs = sourceRhombs();
      const marks = job.painter?.update(field.val, patternArea?.value);
      if (options.square) paintSquareBits(x, y, scale, width, height, bounds, marks, output);
      else paintFlatBits(x, y, scale, width, height, marks, output, job.columns, job.pairs);
    }
    return new Uint8ClampedArray(output.buffer);
  }

  function prepareGifRun(job, first) {
    const live = runState();
    const wholeCycle = first === null;
    job.run = {...live, field: MAYATNIK.field(field.W, field.H, "empty"),
      routeChanges: new Map(wholeCycle ? [[0, currentWrap()]] : routeChanges),
      verticalRouteChanges: new Map(wholeCycle ? [[0, currentWrapY()]] : verticalRouteChanges),
      reversalChanges: new Map(wholeCycle ? [[0, currentReverse()]] : reversalChanges)};
    const useLive = !wholeCycle && live.frame <= first;
    const checkpoint = wholeCycle ? null : findCheckpoint(first, useLive ? live.frame : 0);
    withGifRun(job, () => {
      if (checkpoint) restoreCheckpoint(checkpoint.at, checkpoint.saved);
      else if (useLive) restoreCheckpoint(live.frame, {...live, bits: live.field.val});
      else initializeRun();
    });
  }

  async function toggleRecording(coin = false) {
    if (recording) {
      recording.cancelled = true;
      return;
    }
    const status = byId(coin ? "romb-coin-record-status" : "romb-record-status");
    status.hidden = false;
    const range = gifFullCycle ? null : [...gifRange];
    if (!range && isJoint() && jointRoute.value.startsWith("spiral")) {
      status.textContent = "У расширяющейся спирали нет полного цикла: длина витка растёт.";
      return;
    }
    const camera = coin ? coinView : view;
    const rect = (coin ? combinedCanvas : canvas).getBoundingClientRect();
    const bounds = coin ? coinBounds() : projectBox(view.start, view.end, field.H, options.square);
    const scale = Math.max(1, camera.scale ?? fittedPixelScale(rect, camera, coin ? bounds : projectedBounds()));
    const width = Math.ceil(bounds.right * scale) - Math.floor(bounds.left * scale);
    const height = Math.ceil(bounds.bottom * scale) - Math.floor(bounds.top * scale);
    if (width > 65535 || height > 65535) {
      status.textContent = "Для GIF сторона кадра должна быть до 65 535 пикселей. Уменьшите масштаб поля.";
      return;
    }
    const job = {coin, status, scale, width, height, bounds, nextUpdate: 0, settings: gifSettings()};
    const stride = stepCount(), duration = Math.max(1, Math.round(delay / 10));
    let writer, sink;
    try {
      recording = job;
      const preparation = range ? "Кадры " + range.map(value => formatter.format(value)).join("–") : "Подготовка цикла";
      status.textContent = preparation + " · масштаб " + scaleLabel(scale);
      recordLabel.textContent = "Отмена GIF";
      recordButton.setAttribute("aria-label", "Отменить сборку GIF");
      recordButton.setAttribute("aria-pressed", "true");
      syncMirrors();
      if (!colorWords) paint();
      prepareGifRun(job, range?.[0] ?? null);
      if (!coin && options.patternColors) job.painter = createPatternPainter();
      if (!coin && !options.square) {
        job.columns = new Int32Array(width);
        job.pairs = new Uint8Array(width);
      }
      const period = range ? null : await findGifCycle(job);
      const start = range?.[0] ?? job.run.frame;
      const end = range?.[1] ?? start + period - 1;
      const count = range ? Math.ceil((end - start) / stride) + 1 : Math.ceil(period / stride);
      const totalFrames = formatter.format(count);
      gifProgress(job, "Сборка GIF · 0 % · 0 из " + totalFrames, true);
      writer = await window.MayatnikGif.batch([{width, height}], {stream: true});
      sink = await window.MayatnikGif.squareSink([width]);
      for (let i = 0; i < count; i++) {
        checkGifJob(job);
        const target = Math.min(start + i * stride, end);
        await advanceGif(job, target, false);
        const pixels = withGifRun(job, () => gifPixels(job));
        const passes = Math.min(stride, end - target + (range ? 0 : 1)) || stride;
        const time = Math.max(1, Math.round(duration * passes / stride));
        const {blobs} = await writer.add([pixels], time);
        checkGifJob(job);
        await sink.append(blobs);
        const written = i + 1;
        const percent = Math.min(99, Math.floor(written * 100 / count));
        gifProgress(job, "Сборка GIF · " + percent + " % · " + formatter.format(written) + " из " + totalFrames);
      }
      gifProgress(job, "Подготовка файла GIF · 99 % · " + totalFrames + " из " + totalFrames, true);
      await sink.append(await writer.finish());
      const [file] = await sink.finish();
      checkGifJob(job);
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = (coin ? "romb-moneta-" : "romb-mayatnik-") + start + (range ? "-" + end : "-cycle-" + period) + ".gif";
      document.body.append(link);
      link.click();
      link.remove();
      const downloaded = sink;
      sink = null;
      setTimeout(() => { URL.revokeObjectURL(url); downloaded.dispose(); }, 60000);
      status.textContent = "GIF готов · 100 % · " + totalFrames + " кадров · " + scaleLabel(scale) + " · " + width + " × " + height;
    } catch (error) {
      status.textContent = job.cancelled ? "Сборка GIF отменена." : "GIF не собран · " + (error.message || String(error));
    } finally {
      writer?.cancel();
      recording = null;
      recordLabel.textContent = "Собрать GIF";
      recordButton.setAttribute("aria-label", "Собрать GIF");
      recordButton.setAttribute("aria-pressed", "false");
      syncMirrors();
      await sink?.dispose();
    }
  }

  function outlinePolygon({center, top, half}) {
    const tip = center + 0.5;
    const middle = top + depth;
    const radius = depth - 0.5;
    const left = [tip - radius, middle], right = [tip + radius, middle];
    const upper = [tip, top], lower = [tip, middle + depth];
    if (half === "upper") return [upper, right, left];
    if (half === "lower") return [right, lower, left];
    return [upper, right, lower, left];
  }

  function intersectOutlines(points, outline) {
    // The vertices follow the same winding. Clip against the inside of each edge.
    for (let i = 0; i < outline.length && points.length >= 3; i++) {
      const [ax, ay] = outline[i];
      const [bx, by] = outline[(i + 1) % outline.length];
      const side = ([x, y]) => (bx - ax) * (y - ay) - (by - ay) * (x - ax);
      const clipped = [];
      let previous = points.at(-1);
      let before = side(previous);
      for (const point of points) {
        const after = side(point);
        if ((before >= 0) !== (after >= 0)) {
          const t = before / (before - after);
          clipped.push([
            previous[0] + t * (point[0] - previous[0]),
            previous[1] + t * (point[1] - previous[1])
          ]);
        }
        if (after >= 0) clipped.push(point);
        previous = point;
        before = after;
      }
      points = clipped;
    }
    return points;
  }

  function traceOutline(points) {
    context.moveTo(...points[0]);
    for (let i = 1; i < points.length; i++) context.lineTo(...points[i]);
    context.closePath();
  }

  function paintOutlines(x, y, scale, ratio, styles) {
    const {W, H} = field;
    const centers = renderRhombs.map(({center}) => center);
    const middleColumn = (Math.min(...centers) + Math.max(...centers)) / 2;
    const leftStroke = styles.getPropertyValue("--romb-outline-left").trim();
    const rightStroke = styles.getPropertyValue("--romb-outline").trim();
    const outlines = sourceRhombs(options.markRepeats || currentReverse()).map(rhomb => ({
      points: outlinePolygon(rhomb),
      stroke: rhomb.center < middleColumn ? leftStroke : rightStroke
    }));
    const overlaps = [];
    for (let i = 0; i < outlines.length; i++) {
      for (let j = i + 1; j < outlines.length; j++) {
        const overlap = intersectOutlines(outlines[i].points, outlines[j].points);
        if (overlap.length >= 3) overlaps.push(overlap);
      }
    }
    const fill = styles.getPropertyValue("--romb-overlap").trim();
    for (const offset of [-W, 0, W]) {
      const left = Math.max(view.start, offset);
      const right = Math.min(view.end, offset + W);
      if (right <= left) continue;
      context.save();
      context.beginPath();
      context.rect(x + left * scale, y, (right - left) * scale, H * scale);
      context.clip();
      context.translate(x + offset * scale, y);
      context.scale(scale, scale);
      if (overlaps.length) {
        // Fill all intersections together to keep a uniform tint where several overlap.
        context.fillStyle = fill;
        context.beginPath();
        for (const overlap of overlaps) traceOutline(overlap);
        context.fill();
      }
      if (options.patternColors) context.globalAlpha = 0.35;
      context.lineWidth = 1.25 * ratio / scale;
      for (const {points, stroke} of outlines) {
        context.strokeStyle = stroke;
        context.beginPath();
        traceOutline(points);
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
      if (button.firstElementChild.textContent !== glyph) button.firstElementChild.textContent = glyph;
      if (button.getAttribute("aria-label") !== label) {
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
      const reversing = pending < 0;
      const boundary = reversing ? 0 : maxFrame;
      do {
        if (reversing) {
          retreatHubFrame();
          pending++;
        } else {
          advanceFrame();
          pending--;
        }
      } while (pending && frame !== boundary && performance.now() < deadline);
      if (!pending) {
        seekTarget = null;
        nextBatchAt = now + delay;
      }
      if (frame === boundary) {
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
      camera.scale = limitPixelScale(physicalScale, camera);
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
      const fitScale = fittedPixelScale(element === canvas && phaseList ? fieldFitRect() : element.getBoundingClientRect(), camera, box);
      const current = camera.scale ?? fitScale;
      if (factor === 1) return;
      // Adjacent steps: … 1/3, 1/2, 1/1, 2/1, 3/1 …
      const direction = factor > 1 ? 1 : -1;
      const level = current >= 1 ? current : 2 - Math.round(1 / current);
      const next = level + direction;
      const maxDivisor = Math.ceil(Math.max(box.right - box.left, box.bottom - box.top));
      const nextScale = next >= 1 ? Math.min(next, Math.max(16, fitScale)) : 1 / Math.min(2 - next, maxDivisor);
      const scale = limitPixelScale(nextScale, camera);
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
    fieldStage.append(grid);

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
      byId("romb-route-group"), byId("romb-counter-step"), byId("romb-reverse-contact"));
    place(display, byId("romb-join-left"), byId("romb-join-right"), byId("romb-mark-repeats"), andButton,
      byId("romb-pattern-colors"), patternPalette, squareButton?.closest(".commands"), byId("romb-gif-controls"));
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
        view.scale = limitPixelScale(view.scale, view);
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
  reducedZoomButton?.addEventListener("click", () => {
    allowReducedZoom = !allowReducedZoom;
    view.scale = limitPixelScale(view.scale, view);
    syncEdgeButtons();
    save();
    redraw();
  });
  squareButton?.addEventListener("click", () => toggleSquare());
  andButton?.addEventListener("click", toggleBuildAnd);
  recordButton?.addEventListener("click", () => toggleRecording());
  gifCycleButton.addEventListener("click", () => {
    gifFullCycle = !gifFullCycle;
    syncGifControls();
    syncMirrors();
    save();
  });
  gifSliders.forEach((slider, index) => {
    const number = gifNumbers[index];
    slider.addEventListener("input", () => updateGifEndpoint(index, slider));
    slider.addEventListener("change", save);
    number.addEventListener("change", () => {
      updateGifEndpoint(index, number);
      save();
    });
  });
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
  for (const select of [size, width, heightFactor, horizontalMotion, verticalMotion, jointRoute, halves.x, halves.y].filter(Boolean)) {
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
    save();
    redraw();
  });

  if (hubFour) {
    document.documentElement.classList.add("romb-hub-four");
    const transport = byId("romb-hub-transport");
    const resetButton = byId("romb-reset");
    resetButton.className = "gz-hx";
    byId("romb-hub-play-forward").before(resetButton);
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
