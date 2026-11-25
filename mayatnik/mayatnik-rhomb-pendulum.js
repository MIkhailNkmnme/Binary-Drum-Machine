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
  const play = byId("romb-play");
  const playIcon = byId("romb-play-icon");
  const stepButton = byId("romb-step");
  const storageKey = "zerk_mayatnik_rhomb";
  const inline = root.hasAttribute("data-romb-inline");
  const maxFrame = MayatnikEdgeFlow.MAX_FRAME;
  const formatter = new Intl.NumberFormat("ru", {maximumFractionDigits: 2});
  const swatch = document.createElement("canvas").getContext("2d", {willReadFrequently: true});
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const view = {x: 0, y: 0, zoom: 1};
  let field, depth, anchor, frame, column, drag;
  let pixels, words, sampleColumn, colorWords, colorKey;
  let frameRequest = 0;
  let playing = false;
  let pending = 0;
  let nextBatchAt = 0;
  let nextPaintAt = 0;
  let dirty = false;

  function stepCount() {
    return clamp(Math.round(stepSize.valueAsNumber) || 1, 1, Number(stepSize.max));
  }

  function restore(saved) {
    if (!saved) return;
    if (Array.from(size.options).some(option => Number(option.value) === saved.rows)) size.value = saved.rows;
    if (saved.factor === 2 || saved.factor === 4) width.value = saved.factor;
    if (Number.isSafeInteger(saved.step)) stepSize.value = clamp(saved.step, 1, Number(stepSize.max));
  }

  function save() {
    const settings = {rows: Number(size.value), factor: Number(width.value), step: stepCount()};
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
    anchor = (columns - 1) / 2;
    frame = 0;
    fit();
    advance();
    syncTransport();
    announcePosition();
    redraw();
  }

  function advance() {
    const {W, H, val} = field;
    column = MayatnikEdgeFlow.mapColumn(anchor + MAYATNIK.offset("pend", frame), W, true);
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
  }

  function fitScale(rect) {
    return Math.min(rect.width / field.W, rect.height / field.H);
  }

  function fit() {
    view.zoom = 1;
    view.x = field.W / 2;
    view.y = field.H / 2;
  }

  function boundCenter(center, extent, visible) {
    const half = Math.min(extent, visible) / 2;
    return clamp(center, half, extent - half);
  }

  function paint() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const {W, H, val} = field;
    const cssScale = fitScale(rect) * view.zoom;
    view.x = boundCenter(view.x, W, rect.width / cssScale);
    view.y = boundCenter(view.y, H, rect.height / cssScale);
    canvas.classList.toggle("romb-zoomed", view.zoom > 1);

    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(rect.width * ratio));
    const h = Math.max(1, Math.round(rect.height * ratio));
    if (!pixels || canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      pixels = context.createImageData(w, h);
      words = new Uint32Array(pixels.data.buffer);
      sampleColumn = new Int32Array(w);
    }
    const styles = getComputedStyle(root);
    const zero = styles.getPropertyValue("--romb-zero").trim();
    const one = styles.getPropertyValue("--romb-one").trim();
    const key = zero + "|" + one;
    if (colorKey !== key) {
      swatch.clearRect(0, 0, 2, 1);
      swatch.fillStyle = zero;
      swatch.fillRect(0, 0, 1, 1);
      swatch.fillStyle = one;
      swatch.fillRect(1, 0, 1, 1);
      colorWords = new Uint32Array(swatch.getImageData(0, 0, 2, 1).data.buffer);
      colorKey = key;
    }

    const scale = cssScale * ratio;
    const x = w / 2 - view.x * scale;
    const y = h / 2 - view.y * scale;
    const firstX = Math.max(0, Math.ceil(x - 0.5));
    const lastX = Math.min(w, Math.ceil(x + W * scale - 0.5));
    const firstY = Math.max(0, Math.ceil(y - 0.5));
    const lastY = Math.min(h, Math.ceil(y + H * scale - 0.5));
    for (let px = firstX; px < lastX; px++) sampleColumn[px] = clamp(Math.floor((px + 0.5 - x) / scale), 0, W - 1);
    words.fill(0);
    for (let py = firstY; py < lastY; py++) {
      const sourceRow = clamp(Math.floor((py + 0.5 - y) / scale), 0, H - 1) * W;
      const out = py * w;
      for (let px = firstX; px < lastX; px++) {
        const col = sampleColumn[px];
        let bit = val[sourceRow + col];
        // Below 1:1, preserve the staggered lattice when both columns
        // land in the same display pixel.
        if (bit < 0 && col + 1 < W && (col + 1.5) * scale + x < px + 1) bit = val[sourceRow + col + 1];
        if (bit >= 0) words[out + px] = colorWords[bit];
      }
    }
    context.putImageData(pixels, 0, 0);
    context.lineWidth = ratio;
    context.strokeStyle = styles.getPropertyValue("--romb-border").trim();
    context.strokeRect(x, y, W * scale, H * scale);

    context.save();
    context.beginPath();
    context.rect(x, y, W * scale, H * scale);
    context.clip();
    const tip = x + (column + 0.5) * scale;
    const radius = (depth - 0.5) * scale;
    const middle = y + depth * scale;
    context.beginPath();
    context.moveTo(tip, y);
    context.lineTo(tip + radius, middle);
    context.lineTo(tip, y + H * scale);
    context.lineTo(tip - radius, middle);
    context.closePath();
    context.strokeStyle = styles.getPropertyValue("--romb-outline").trim();
    context.lineWidth = 1.25 * ratio;
    context.stroke();
    context.restore();

    const label = "Кадр " + formatter.format(frame) + " · столбец " + formatter.format(column + 1) +
      " из " + formatter.format(W) + " · " + formatter.format(H) + " строк · " +
      formatter.format(cssScale * 100) + " %";
    if (frameLabel.textContent !== label) frameLabel.textContent = label;
  }

  function schedule() {
    if (!frameRequest) frameRequest = requestAnimationFrame(tick);
  }

  function redraw() {
    dirty = true;
    schedule();
  }

  function announcePosition() {
    if (announcement) announcement.textContent = "Кадр " + formatter.format(frame) + " · столбец " + formatter.format(column + 1);
  }

  function syncTransport() {
    const moving = playing || pending > 0;
    play.setAttribute("aria-pressed", String(moving));
    if (playIcon) playIcon.textContent = moving ? "⏸" : "▶";
    stepButton.disabled = frame === maxFrame;
    play.disabled = frame === maxFrame;
  }

  function stop() {
    playing = false;
    pending = 0;
    syncTransport();
  }

  function tick(now) {
    frameRequest = 0;
    if (playing && !pending && now >= nextBatchAt) pending = stepCount();
    if (pending) {
      const deadline = performance.now() + 10;
      do {
        advance();
        pending--;
      } while (pending && frame < maxFrame && performance.now() < deadline);
      if (!pending) nextBatchAt = now + 115;
      if (frame === maxFrame) {
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

  function zoomBy(factor, px = 0, py = 0) {
    const rect = canvas.getBoundingClientRect();
    const scale = fitScale(rect);
    if (!scale) return;
    const old = view.zoom;
    view.zoom = clamp(old * factor, 1, Math.max(1, 16 / scale));
    const shift = (1 / old - 1 / view.zoom) / scale;
    view.x += px * shift;
    view.y += py * shift;
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
    if (!["+", "=", "-", "−", "0"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "0") { fit(); redraw(); }
    else zoomBy(event.key === "+" || event.key === "=" ? 1.3 : 1 / 1.3);
  });
  canvas.addEventListener("pointerdown", event => {
    if (view.zoom === 1 || event.button !== 0 || drag) return;
    canvas.setPointerCapture(event.pointerId);
    drag = {id: event.pointerId, x: event.clientX, y: event.clientY};
  });
  canvas.addEventListener("pointermove", event => {
    if (drag?.id !== event.pointerId) return;
    const scale = fitScale(canvas.getBoundingClientRect()) * view.zoom;
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

  play.addEventListener("click", () => {
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
  });
  stepButton.addEventListener("click", () => {
    stop();
    pending = stepCount();
    syncTransport();
    schedule();
  });
  byId("romb-reset").addEventListener("click", reset);
  for (const select of [size, width]) select.addEventListener("change", () => { save(); reset(); });
  stepSize.addEventListener("change", () => { stepSize.value = stepCount(); save(); });

  if (inline) {
    restore(window.openai?.widgetState?.modelContent);
    window.addEventListener("openai:set_globals", event => {
      const before = size.value + "|" + width.value;
      restore(event.detail?.globals?.widgetState?.modelContent);
      if (before !== size.value + "|" + width.value) reset();
      else redraw();
    });
  } else {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      restore(saved ?? {rows: Number(localStorage.getItem("zerk_mayatnik_rhomb_depth")) * 2});
    } catch { /* Use default preferences. */ }
  }

  reset();
  new ResizeObserver(redraw).observe(canvas);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redraw);
})();
