(() => {
  "use strict";
  const KEY = "zerk_bit_chessboards_v1";
  const MAX_BOARDS = 16, MAX_ID = 1000000;
  const MAX_POSITION = 512, MAX_SIZE = 128, MAX_FIELD = MAX_POSITION + MAX_SIZE;
  const OUTLINES = [
    "#ff6868", "#62dc81", "#65a6ff", "#ffd166", "#d98aff", "#55dbdf", "#ff9b60", "#d1e469",
    "#fc86bc", "#8a8fff", "#91a274", "#71c6a6", "#ffe4a1", "#df936f", "#f2b8e9", "#a6e4ff",
  ];
  const byId = id => document.getElementById("chess-" + id);
  const world = byId("world"), viewport = byId("viewport"), list = byId("list");
  const elements = new Map(), undo = [];
  const logicButtons = [...document.querySelectorAll("[data-chess-logic]")];
  const rgbButtons = [...document.querySelectorAll("[data-chess-rgb]")];
  const rgbScopeButtons = [...document.querySelectorAll("[data-chess-rgb-scope]")];
  const digitPaths = window.BitByteOperatorDigits;
  const canvasDigits = typeof Path2D === "function" && digitPaths
    ? [new Path2D(digitPaths["0"].path), new Path2D(digitPaths["1"].path)] : null;
  const logicCanvas = document.createElement("canvas");
  logicCanvas.className = "chess-logic";
  logicCanvas.hidden = true;
  logicCanvas.setAttribute("aria-hidden", "true");
  world.append(logicCanvas);
  const logicContext = logicCanvas.getContext("2d");
  let logicFrame = 0;
  let swatchKey = "";
  let drag = null, lastTap = null, pendingInput = null, saveFailed = false, scrollFrame = 0;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const integer = (value, fallback, min, max) => Number.isFinite(Number(value))
    ? clamp(Math.round(Number(value)), min, max) : fallback;
  const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || "") ? value : fallback;

  const defaultOutline = id => OUTLINES[(id - 1) % OUTLINES.length];
  const boardLabel = id => "Шахматка " + id;
  const area = board => board.cols * board.rows;
  // Порядок в сохранении разрешает совпадения площадей.
  const layers = () => state.boards.slice().sort((a, b) => area(b) - area(a));
  function freeId(ids, id) {
    while (ids.has(id)) id = id % MAX_ID + 1;
    return id;
  }
  function availableOutline(id, used) {
    const preferred = defaultOutline(id);
    return used.has(preferred) ? OUTLINES.find(outline => !used.has(outline)) ?? preferred : preferred;
  }

  function makeBoard(id, x = 2, y = 2) {
    return {
      id, x, y, cols: 16, rows: 16, phase: false, outline: defaultOutline(id),
      zero: "#000000", one: "#ffffff", zeroOpacity: 100, oneOpacity: 100, visible: true,
    };
  }
  function initialState() {
    const second = makeBoard(2, 10, 6);
    second.zeroOpacity = second.oneOpacity = 65;
    return { fieldCols: null, fieldRows: null, cell: 24, digits: false, logic: "layers", rgbScope: "one",
      selected: 2, selectedIds: [2], boards: [makeBoard(1), second] };
  }
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (!saved || !Array.isArray(saved.boards)) return initialState();
      const ids = new Set();
      const items = saved.boards.slice(0, MAX_BOARDS);
      const outlines = new Set(items.map(item => color(item?.outline, "").toLowerCase()).filter(Boolean));
      const boards = items.map((item, index) => {
        item = item && typeof item === "object" ? item : {};
        const id = freeId(ids, integer(item.id, index + 1, 1, MAX_ID));
        ids.add(id);
        const outline = color(item.outline, "") || availableOutline(id, outlines);
        outlines.add(outline.toLowerCase());
        return {
          id, ...(typeof item.name === "string" ? {name: item.name.slice(0, 40)} : {}),
          outline,
          x: integer(item.x, 2, 0, MAX_POSITION), y: integer(item.y, 2, 0, MAX_POSITION),
          cols: integer(item.cols, 16, 1, MAX_SIZE), rows: integer(item.rows, 16, 1, MAX_SIZE),
          phase: item.phase === true, visible: item.visible !== false,
          zero: color(item.zero, "#000000"), one: color(item.one, "#ffffff"),
          zeroOpacity: integer(item.zeroOpacity, 100, 0, 100),
          oneOpacity: integer(item.oneOpacity, 100, 0, 100),
        };
      });
      const active = ids.has(saved.selected) ? saved.selected : boards[0]?.id ?? null;
      const selectedIds = Array.isArray(saved.selectedIds)
        ? [...new Set(saved.selectedIds.filter(id => ids.has(id)))] : active === null ? [] : [active];
      return {
        fieldCols: saved.fieldCols == null ? null : integer(saved.fieldCols, null, 1, MAX_FIELD),
        fieldRows: saved.fieldRows == null ? null : integer(saved.fieldRows, null, 1, MAX_FIELD),
        cell: integer(saved.cell, 24, 1, 64), digits: saved.digits === true, boards,
        logic: logicButtons.some(button => button.dataset.chessLogic === saved.logic) ? saved.logic : "layers",
        rgbScope: saved.rgbScope === "all" ? "all" : "one",
        selected: selectedIds.includes(active) ? active : selectedIds.at(-1) ?? null,
        selectedIds,
      };
    } catch { return initialState(); }
  }
  let state = load();
  const snapshot = () => JSON.stringify(state);
  const selected = () => state.boards.find(board => board.id === state.selected);
  function setSelection(ids, active = ids.at(-1) ?? null) {
    state.selectedIds = ids;
    state.selected = active;
  }
  function save() {
    try {
      localStorage.setItem(KEY, snapshot());
      saveFailed = false;
    } catch { saveFailed = true; }
    byId("status").textContent = saveFailed ? "Не удалось сохранить в браузере. Изменения действуют до закрытия страницы." : "";
  }
  function remember(before) {
    if (before !== snapshot()) {
      undo.push(before);
      if (undo.length > 40) undo.shift();
      save();
    }
    byId("undo").disabled = undo.length === 0;
  }
  function finishInput() {
    if (pendingInput === null) return;
    const before = pendingInput;
    pendingInput = null;
    remember(before);
  }
  function mutate(fn) {
    if (drag) return;
    lastTap = null;
    finishInput();
    const before = snapshot();
    fn();
    remember(before);
    render();
  }
  function choose(id, toggle) {
    if (!toggle) setSelection([id]);
    else if (state.selectedIds.includes(id)) {
      const ids = state.selectedIds.filter(item => item !== id);
      setSelection(ids, state.selected === id ? ids.at(-1) ?? null : state.selected);
    } else setSelection([...state.selectedIds, id]);
  }
  function select(id, toggle = false) {
    if (drag) return;
    finishInput();
    choose(id, toggle);
    save();
    render();
  }
  function digitInk(hex) {
    const rgb = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
    return .299 * rgb[0] + .587 * rgb[1] + .114 * rgb[2] >= 135 ? "#000000" : "#ffffff";
  }

  function pattern(board) {
    const first = board.phase ? "one" : "zero", second = board.phase ? "zero" : "one";
    function tile(x, y, key) {
      const fill = board[key];
      const rect = '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + fill +
        '" fill-opacity="' + board[key + "Opacity"] / 100 + '"/>';
      if (!state.digits || !digitPaths) return rect;
      const digit = key === "zero" ? "0" : "1";
      return rect + '<path d="' + digitPaths[digit].path + '" transform="translate(' + x + ' ' + y +
        ')" fill="' + digitInk(fill) + '" shape-rendering="geometricPrecision"/>';
    }
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2" viewBox="0 0 2 2" shape-rendering="crispEdges">' +
      tile(0, 0, first) + tile(1, 0, second) + tile(0, 1, second) + tile(1, 1, first) + "</svg>";
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }

  function positionBoard(element, board) {
    Object.assign(element.style, {
      left: board.x * state.cell + "px", top: board.y * state.cell + "px",
      width: board.cols * state.cell + "px", height: board.rows * state.cell + "px",
    });
    element.style.setProperty("--board-color", board.outline);
  }
  function initializeField() {
    if (state.fieldCols !== null && state.fieldRows !== null) return false;
    if (viewport.closest("[hidden]") || !viewport.clientWidth || !viewport.clientHeight) return false;
    // Старые сохранения: прежняя видимая область и существующие видимые шахматки.
    const visible = state.boards.filter(board => board.visible);
    state.fieldCols ??= clamp(Math.max(Math.ceil(Math.max(800, viewport.clientWidth) / state.cell),
      ...visible.map(board => board.x + board.cols + 2)), 1, MAX_FIELD);
    state.fieldRows ??= clamp(Math.max(Math.ceil(Math.max(480, viewport.clientHeight) / state.cell),
      ...visible.map(board => board.y + board.rows + 2)), 1, MAX_FIELD);
    save();
    return true;
  }
  function growField(boards, growWidth = false) {
    for (const board of boards) {
      if (!board.visible) continue;
      const bottom = board.y + board.rows, right = board.x + board.cols;
      if (state.fieldRows !== null && bottom >= state.fieldRows) {
        state.fieldRows = Math.min(MAX_FIELD, bottom + 2);
      }
      if (growWidth && state.fieldCols !== null && right >= state.fieldCols) {
        state.fieldCols = Math.min(MAX_FIELD, right + 2);
      }
    }
  }
  function logicPaint(hex, opacity) {
    return {hex: hex.toLowerCase(), opacity: opacity / 100, ink: digitInk(hex),
      rgb: [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16))};
  }

  function paintLogic() {
    logicFrame = 0;
    const additive = state.logic === "add-rgb";
    const and = state.logic.startsWith("and"), byPalette = !additive && state.logic.endsWith("-rgb");
    const visible = layers().filter(board => board.visible).map(board => ({
      ...board, palette: board.zero.toLowerCase() + "/" + board.one.toLowerCase(),
    }));
    const paletteSizes = new Map();
    if (byPalette && and) {
      for (const {palette} of visible) {
        paletteSizes.set(palette, (paletteSizes.get(palette) ?? 0) + 1);
      }
    }
    const boards = visible.filter(board => board.x < state.fieldCols && board.y < state.fieldRows).map(board => ({
        ...board, right: board.x + board.cols, bottom: board.y + board.rows,
        paints: [logicPaint(board.zero, board.zeroOpacity), logicPaint(board.one, board.oneOpacity)],
      }));
    logicCanvas.hidden = !boards.length;
    if (!boards.length) return;

    const left = Math.min(...boards.map(board => board.x));
    const top = Math.min(...boards.map(board => board.y));
    const width = Math.min(state.fieldCols, Math.max(...boards.map(board => board.right))) - left;
    const height = Math.min(state.fieldRows, Math.max(...boards.map(board => board.bottom))) - top;
    const scale = state.digits
      ? Math.min(state.cell, 16, Math.floor(Math.sqrt(7_000_000 / (width * height)))) : 1;
    logicCanvas.width = width * scale;
    logicCanvas.height = height * scale;
    Object.assign(logicCanvas.style, {
      left: left * state.cell + "px", top: top * state.cell + "px",
      width: width * state.cell + "px", height: height * state.cell + "px",
    });
    const groups = new Map();
    const ctx = logicContext;

    function fill(paint, x, y) {
      ctx.fillStyle = paint.hex;
      ctx.globalAlpha = paint.opacity;
      ctx.fillRect(x, y, scale, scale);
    }

    for (let y = top; y < top + height; y++) {
      const row = boards.filter(board => y >= board.y && y < board.bottom);
      if (!row.length) continue;
      const py = (y - top) * scale;
      for (let x = left; x < left + width; x++) {
        let upper = null, ones = 0;
        let lightAlpha = 0, lightBit = 0;
        const light = additive ? [0, 0, 0] : null;
        for (const board of row) {
          if (x < board.x || x >= board.right) continue;
          upper = board;
          const bit = Number(board.phase) ^ ((x - board.x + y - board.y) & 1);
          ones += bit;
          if (additive) {
            const paint = board.paints[bit];
            // Свет складывается в premultiplied RGB; чёрная клетка не гасит соседний свет.
            if (paint.opacity > 0) {
              lightAlpha = Math.max(lightAlpha, paint.opacity);
              lightBit |= bit;
              for (let channel = 0; channel < 3; channel++) {
                light[channel] += paint.rgb[channel] * paint.opacity;
              }
            }
            continue;
          }
          if (!byPalette) continue;
          const {palette} = board;
          const paletteOnes = (groups.get(palette)?.ones ?? 0) + bit;
          // Верхняя шахматка палитры в этой клетке задаёт порядок и прозрачность.
          groups.delete(palette);
          groups.set(palette, {ones: paletteOnes, paint: board.paints[1]});
        }
        if (!upper) continue;

        const px = (x - left) * scale;
        let bit = and ? Number(ones === visible.length) : ones & 1;
        let paint = upper.paints[bit];
        if (additive) {
          if (lightAlpha === 0) continue;
          bit = lightBit;
          // Ограничиваем сумму 255, затем восстанавливаем цвет для canvas с общей alpha.
          const rgb = light.map(component => Math.round(clamp(Math.min(255, component) / lightAlpha, 0, 255)));
          const hex = "#" + rgb.map(component => component.toString(16).padStart(2, "0")).join("");
          paint = {hex, opacity: lightAlpha, ink: digitInk(hex)};
        }
        if (byPalette) {
          bit = 0;
          paint = upper.paints[0];
          for (const [palette, group] of groups) {
            const result = and ? group.ones === paletteSizes.get(palette) : group.ones % 2 !== 0;
            if (!result) continue;
            bit = 1;
            paint = group.paint;
            fill(paint, px, py);
          }
          groups.clear();
        }
        if (!byPalette || !bit) fill(paint, px, py);
        if (state.digits && canvasDigits && scale >= 4) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = paint.ink;
          ctx.save();
          ctx.translate(px, py);
          ctx.scale(scale, scale);
          ctx.fill(canvasDigits[bit]);
          ctx.restore();
        }
      }
    }
  }

  function renderLogic() {
    const enabled = !!logicContext && state.logic !== "layers" && state.fieldCols !== null && state.fieldRows !== null;
    world.toggleAttribute("data-logic", enabled);
    if (enabled) {
      if (!logicFrame) logicFrame = requestAnimationFrame(paintLogic);
    } else {
      if (logicFrame) cancelAnimationFrame(logicFrame);
      logicFrame = 0;
      logicCanvas.hidden = true;
    }
  }

  function renderScene() {
    initializeField();
    const ordered = layers();
    const ids = new Set(ordered.map(board => board.id));
    for (const [id, {element, outline}] of elements) {
      if (!ids.has(id)) { element.remove(); outline.remove(); elements.delete(id); }
    }
    let total = 0, visible = 0;
    for (const [index, board] of ordered.entries()) {
      if (!elements.has(board.id)) {
        const element = document.createElement("button");
        element.type = "button";
        element.className = "chess-board";
        element.dataset.boardId = String(board.id);
        const outline = document.createElement("div");
        outline.className = "chess-selection";
        outline.setAttribute("aria-hidden", "true");
        elements.set(board.id, {element, outline});
        world.append(element, outline);
      }
      const active = state.selected === board.id;
      const marked = state.selectedIds.includes(board.id);
      const {element, outline} = elements.get(board.id);
      element.hidden = !board.visible;
      element.tabIndex = active ? 0 : -1;
      element.setAttribute("aria-pressed", String(marked));
      element.setAttribute("aria-label", boardLabel(board.id) + ", " + board.cols + " на " + board.rows +
        " клеток, X " + board.x + ", Y " + board.y + ". Стрелки — перемещение.");
      positionBoard(element, board);
      element.style.backgroundSize = state.cell * 2 + "px " + state.cell * 2 + "px";
      element.style.zIndex = String(index + 1);
      outline.hidden = !board.visible || !marked;
      if (!outline.hidden) {
        positionBoard(outline, board);
        outline.style.zIndex = String(MAX_BOARDS + 2 + index);
        outline.toggleAttribute("data-primary", active);
      }
      const tile = [board.phase, board.zero, board.one, board.zeroOpacity, board.oneOpacity, state.digits].join(":");
      if (element.dataset.tile !== tile) {
        element.style.backgroundImage = pattern(board);
        element.dataset.tile = tile;
      }
      total += area(board);
      if (board.visible) {
        visible++;
      }
    }
    if (state.fieldCols !== null && state.fieldRows !== null) {
      // Размер внутренней области точен; внешняя рамка добавляет 2 px.
      viewport.style.width = state.fieldCols * state.cell + 2 + "px";
      viewport.style.height = state.fieldRows * state.cell + 2 + "px";
    }
    for (const [id, key] of [["field-cols", "fieldCols"], ["field-rows", "fieldRows"]]) {
      if (document.activeElement !== byId(id) || drag?.kind === "field") byId(id).value = state[key] ?? "";
    }
    world.style.setProperty("--chess-cell", state.cell + "px");
    renderLogic();
    renderLayers(ordered);
    byId("total").textContent = "Шахматок: " + state.boards.length + " · видимых: " + visible +
      " · поле: " + (state.fieldCols ?? "—") + " × " + (state.fieldRows ?? "—") + " клеток · клетка: " + state.cell + " × " + state.cell + " px · клеток по всем шахматкам: " + total +
      " (наложенные клетки считаются отдельно).";
    renderCounts();
    window.BitByteNumberControls?.sync();
  }
  function renderCounts() {
    const board = selected();
    if (!board) {
      byId("board-count").textContent = "";
      return;
    }
    const count = area(board);
    const zeroCount = board.phase ? Math.floor(count / 2) : Math.ceil(count / 2);
    byId("board-count").textContent = count + " клеток / битов · 0: " + zeroCount + " · 1: " + (count - zeroCount);
    byId("zero-percent").textContent = board.zeroOpacity + "%";
    byId("one-percent").textContent = board.oneOpacity + "%";
  }
  function layerNeighbor(ordered, index, delta) {
    const board = ordered[index], neighbor = ordered[index + delta];
    return board && neighbor && area(board) === area(neighbor) ? neighbor : null;
  }
  function renderLayers(ordered) {
    const index = ordered.indexOf(selected());
    byId("backward").disabled = !layerNeighbor(ordered, index, -1);
    byId("forward").disabled = !layerNeighbor(ordered, index, 1);
    const key = JSON.stringify([state.selected, state.selectedIds,
      ordered.map(board => [board.id, board.outline, board.visible])]);
    if (key === swatchKey) return;
    swatchKey = key;
    const focused = list.contains(document.activeElement) ? document.activeElement.dataset.boardId : null;
    list.replaceChildren(...ordered.map((board, layer) => {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "chess-swatch";
      swatch.dataset.boardId = String(board.id);
      swatch.style.setProperty("--board-color", board.outline);
      swatch.setAttribute("aria-pressed", String(state.selectedIds.includes(board.id)));
      swatch.toggleAttribute("data-hidden", !board.visible);
      const label = boardLabel(board.id) + ", слой " + (layer + 1) + (board.visible ? "" : ", скрыта");
      swatch.title = label;
      swatch.setAttribute("aria-label", label);
      return swatch;
    }));
    if (focused) list.querySelector('[data-board-id="' + focused + '"]')?.focus({preventScroll: true});
    const count = state.selectedIds.length;
    byId("selection-info").textContent = count > 1
      ? "Выделено: " + count + " · настройки: " + boardLabel(state.selected) : "";
  }
  function renderControls() {
    byId("cell").value = state.cell;
    byId("field-cols").value = state.fieldCols ?? "";
    byId("field-rows").value = state.fieldRows ?? "";
    byId("digits").setAttribute("aria-pressed", String(state.digits));
    byId("phase-all").disabled = !state.boards.length;
    byId("rgb-scope").dataset.scope = state.rgbScope;
    byId("rgb-scope").classList.toggle("gz-bs", state.rgbScope === "one");
    for (const button of rgbScopeButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.chessRgbScope === state.rgbScope));
    }
    for (const button of logicButtons) {
      button.disabled = !logicContext;
      button.setAttribute("aria-pressed", String(button.dataset.chessLogic === state.logic));
    }
    const board = selected();
    for (const button of rgbButtons) {
      button.disabled = !board || !logicContext;
      const hex = button.dataset.chessRgb;
      const active = !!board && board.one.toLowerCase() === hex &&
        (state.rgbScope !== "all" || board.zero.toLowerCase() === hex);
      button.setAttribute("aria-pressed", String(active));
    }
    byId("settings").disabled = !board;
    byId("remove").disabled = !state.selectedIds.length;
    const removeTitle = state.selectedIds.length > 1
      ? "Удалить все выделенные шахматки (" + state.selectedIds.length + "). Delete — то же действие."
      : "Удалить выбранную шахматку. Delete — то же действие.";
    byId("remove").title = removeTitle;
    byId("remove").setAttribute("aria-label", removeTitle);
    byId("add").disabled = state.boards.length >= MAX_BOARDS;
    const diagonal = byId("add-diagonal");
    diagonal.disabled = !diagonalAvailable(board);
    diagonal.title = diagonal.disabled
      ? "Выберите шахматку, для которой есть место и возможен размер +1×1. Максимум 16 шахматок."
      : "Новая шахматка от нижнего правого угла выбранной, на одну строку и столбец больше";
    byId("undo").disabled = !undo.length;
    for (const input of document.querySelectorAll(".chess-controls input")) input.disabled = drag?.kind === "field";
    if (!board) { window.BitByteNumberControls?.sync(); return; }
    for (const key of ["cols", "rows", "x", "y", "outline", "zero", "one"]) byId(key).value = board[key];
    byId("zero-opacity").value = board.zeroOpacity;
    byId("one-opacity").value = board.oneOpacity;
    byId("phase").setAttribute("aria-pressed", String(board.phase));
    byId("visibility").setAttribute("aria-pressed", String(board.visible));
    window.BitByteNumberControls?.sync();
  }
  function render() { renderScene(); renderControls(); }
  function bindInput(id, update) {
    const input = byId(id);
    input.addEventListener("input", () => {
      if (drag) return;
      if (input.type === "number" && (!input.value || !Number.isFinite(input.valueAsNumber))) return;
      if (pendingInput === null) pendingInput = snapshot();
      update(input.value);
      renderScene();
    });
    const commit = () => { finishInput(); renderControls(); };
    input.addEventListener("change", commit);
    input.addEventListener("blur", commit);
  }
  bindInput("field-cols", value => { state.fieldCols = integer(value, state.fieldCols, 1, MAX_FIELD); });
  bindInput("field-rows", value => { state.fieldRows = integer(value, state.fieldRows, 1, MAX_FIELD); });
  bindInput("cell", value => { state.cell = integer(value, state.cell, 1, 64); });
  for (const [key, min, max] of [["cols", 1, MAX_SIZE], ["rows", 1, MAX_SIZE], ["x", 0, MAX_POSITION], ["y", 0, MAX_POSITION]]) {
    bindInput(key, value => {
      const board = selected();
      if (!board) return;
      const previous = board[key];
      board[key] = integer(value, previous, min, max);
      if ((key === "y" || key === "rows") && board[key] > previous) growField([board]);
    });
  }
  for (const key of ["outline", "zero", "one"]) {
    bindInput(key, value => { if (selected()) selected()[key] = color(value, selected()[key]); });
  }
  for (const key of ["zero", "one"]) {
    bindInput(key + "-opacity", value => { if (selected()) selected()[key + "Opacity"] = integer(value, 100, 0, 100); });
  }
  list.addEventListener("click", event => {
    const swatch = event.target.closest(".chess-swatch");
    if (!swatch || drag) return;
    lastTap = null;
    select(Number(swatch.dataset.boardId), event.shiftKey || event.ctrlKey);
  });
  byId("digits").addEventListener("click", () => mutate(() => { state.digits = !state.digits; }));
  for (const button of rgbScopeButtons) {
    button.addEventListener("click", () => mutate(() => { state.rgbScope = button.dataset.chessRgbScope; }));
  }
  for (const button of rgbButtons) {
    button.addEventListener("click", () => mutate(() => {
      const board = selected();
      if (!board || !logicContext) return;
      board.one = button.dataset.chessRgb;
      if (state.rgbScope === "all") board.zero = board.one;
      state.logic = "add-rgb";
    }));
  }
  for (const button of logicButtons) {
    button.addEventListener("click", () => mutate(() => {
      const mode = button.dataset.chessLogic;
      state.logic = state.logic === mode ? "layers" : mode;
    }));
  }
  function diagonalAvailable(board) {
    return !!board && state.boards.length < MAX_BOARDS &&
      board.cols < MAX_SIZE && board.rows < MAX_SIZE &&
      board.x + board.cols <= MAX_POSITION && board.y + board.rows <= MAX_POSITION;
  }
  function addBoard(x, y, source) {
    const ids = new Set(state.boards.map(board => board.id));
    const id = freeId(ids, Math.max(0, ...ids) % MAX_ID + 1);
    const board = makeBoard(id, x, y);
    if (source) {
      board.cols = source.cols + 1;
      board.rows = source.rows + 1;
      for (const key of ["phase", "zero", "one", "zeroOpacity", "oneOpacity"]) board[key] = source[key];
    }
    const used = new Set(state.boards.map(item => item.outline.toLowerCase()));
    board.outline = availableOutline(id, used);
    state.boards.push(board);
    setSelection([id]);
    growField([board], !!source);
  }
  byId("add").addEventListener("click", () => {
    if (state.boards.length >= MAX_BOARDS) return;
    const position = 2 + state.boards.length * 2;
    mutate(() => addBoard(position, position));
  });
  byId("add-diagonal").addEventListener("click", () => {
    const source = selected();
    if (!diagonalAvailable(source)) return;
    mutate(() => addBoard(source.x + source.cols, source.y + source.rows, source));
  });
  function removeSelected() {
    if (!state.selectedIds.length) return;
    mutate(() => {
      const removed = new Set(state.selectedIds);
      state.boards = state.boards.filter(board => !removed.has(board.id));
      setSelection(state.boards.slice(-1).map(board => board.id));
    });
  }
  byId("remove").addEventListener("click", removeSelected);
  byId("undo").addEventListener("click", () => {
    if (drag) return;
    lastTap = null;
    finishInput();
    if (!undo.length) return;
    state = JSON.parse(undo.pop());
    save(); render();
  });
  byId("phase").addEventListener("click", () => mutate(() => { const board = selected(); if (board) board.phase = !board.phase; }));
  byId("phase-all").addEventListener("click", () => mutate(() => {
    for (const board of state.boards) board.phase = !board.phase;
  }));
  byId("visibility").addEventListener("click", () => mutate(() => { const board = selected(); if (board) board.visible = !board.visible; }));
  function reorder(delta) {
    mutate(() => {
      const ordered = layers(), board = selected();
      const neighbor = layerNeighbor(ordered, ordered.indexOf(board), delta);
      if (!neighbor) return;
      const index = state.boards.indexOf(board), target = state.boards.indexOf(neighbor);
      [state.boards[index], state.boards[target]] = [state.boards[target], state.boards[index]];
    });
  }
  byId("forward").addEventListener("click", () => reorder(1));
  byId("backward").addEventListener("click", () => reorder(-1));
  function hitTest(event) {
    const rect = world.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    const outside = event.pointerType === "touch" ? 10 : 5;
    const inside = [], borders = [];
    for (const board of layers()) {
      if (!board.visible) continue;
      const left = board.x * state.cell, top = board.y * state.cell;
      const width = board.cols * state.cell, height = board.rows * state.cell;
      const right = left + width, bottom = top + height;
      if (x >= left && x < right && y >= top && y < bottom) inside.push(board);
      if (x < left - outside || x > right + outside || y < top - outside || y > bottom + outside) continue;
      const nearX = Math.min(outside, width / 3), nearY = Math.min(outside, height / 3);
      const horizontal = x <= left + nearX ? -1 : x >= right - nearX ? 1 : 0;
      const vertical = y <= top + nearY ? -1 : y >= bottom - nearY ? 1 : 0;
      if (horizontal || vertical) borders.push({board, horizontal, vertical});
    }
    const top = inside.at(-1);
    // Сплошная обводка главной шахматки видна и доступна поверх заливок.
    const activeEdge = borders.find(hit => hit.board.id === state.selected);
    const topEdge = top ? borders.find(hit => hit.board === top) : borders.at(-1);
    return {top, edge: activeEdge ?? topEdge};
  }

  function resizeCursor(edge) {
    if (!edge) return "grab";
    const {horizontal, vertical} = edge;
    if (!horizontal) return "ns-resize";
    if (!vertical) return "ew-resize";
    return horizontal === vertical ? "nwse-resize" : "nesw-resize";
  }

  function resizeAxis(origin, length, delta, edge) {
    if (edge < 0) {
      const end = origin + length;
      const start = clamp(origin + delta, Math.max(0, end - MAX_SIZE), Math.min(MAX_POSITION, end - 1));
      return [start, end - start];
    }
    return [origin, edge ? clamp(length + delta, 1, MAX_SIZE) : length];
  }

  world.addEventListener("pointerdown", event => {
    if (event.button !== 0 || drag) return;
    finishInput();
    initializeField();
    const hit = hitTest(event);
    const modified = event.ctrlKey || event.shiftKey;
    const edge = modified ? null : hit.edge;
    const active = edge?.board ?? hit.top ?? hit.edge?.board;
    if (!active) {
      lastTap = null;
      viewport.focus({preventScroll: true});
      return;
    }
    elements.get(active.id).element.focus({preventScroll: true});
    const group = modified && state.selectedIds.includes(active.id)
      ? state.boards.filter(board => state.selectedIds.includes(board.id)) : [active];
    const origins = group.map(board => ({board, x: board.x, y: board.y, cols: board.cols, rows: board.rows, phase: board.phase}));
    drag = {
      kind: "boards", pointer: event.pointerId, before: snapshot(), edge, origins,
      activeId: active.id, tapId: hit.top?.id, modified, copy: event.ctrlKey, blocked: false,
      fieldRows: state.fieldRows,
      startX: event.clientX + window.scrollX, startY: event.clientY + window.scrollY,
      clientX: event.clientX, clientY: event.clientY, moved: false,
    };
    world.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  function startBoardDrag() {
    drag.moved = true;
    if (!drag.copy) {
      setSelection(drag.origins.map(origin => origin.board.id), drag.activeId);
      return;
    }
    if (state.boards.length + drag.origins.length > MAX_BOARDS) {
      drag.blocked = true;
      byId("status").textContent = "Для копий не хватает места. Максимум " + MAX_BOARDS + " шахматок.";
      return;
    }
    const ids = new Set(state.boards.map(board => board.id));
    let candidate = Math.max(0, ...ids) % MAX_ID + 1;
    let activeCopy;
    const copies = drag.origins.map(origin => {
      const id = freeId(ids, candidate);
      ids.add(id);
      candidate = id % MAX_ID + 1;
      if (origin.board.id === drag.activeId) activeCopy = id;
      return {...origin.board, id};
    });
    state.boards.push(...copies);
    drag.origins.forEach((origin, index) => { origin.board = copies[index]; });
    setSelection(copies.map(board => board.id), activeCopy);
  }
  function moveBoards() {
    const dx = drag.clientX + window.scrollX - drag.startX;
    const dy = drag.clientY + window.scrollY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < Math.min(4, state.cell)) return;
    if (!drag.moved) startBoardDrag();
    if (drag.blocked) return;
    const x = Math.round(dx / state.cell), y = Math.round(dy / state.cell);
    if (drag.edge) {
      const {board, cols, rows, phase, x: left, y: top} = drag.origins[0];
      [board.x, board.cols] = resizeAxis(left, cols, x, drag.edge.horizontal);
      [board.y, board.rows] = resizeAxis(top, rows, y, drag.edge.vertical);
      // При сдвиге угла сохраняем цвета в общих клетках старого и нового прямоугольника.
      board.phase = phase !== ((board.x - left + board.y - top) % 2 !== 0);
    } else {
      const xs = drag.origins.map(origin => origin.x), ys = drag.origins.map(origin => origin.y);
      // Ограничиваем всю группу одним сдвигом на ось, сохраняя расстояния у границы.
      const left = clamp(x, -Math.min(...xs), MAX_POSITION - Math.max(...xs));
      const top = clamp(y, -Math.min(...ys), MAX_POSITION - Math.max(...ys));
      for (const origin of drag.origins) {
        origin.board.x = origin.x + left;
        origin.board.y = origin.y + top;
      }
    }
    if (y > 0) growField(drag.origins.map(origin => origin.board));
    world.style.setProperty("--chess-cursor", drag.edge ? resizeCursor(drag.edge) : "grabbing");
    const board = selected();
    if (board) for (const key of ["x", "y", "cols", "rows"]) byId(key).value = board[key];
    renderScene();
  }
  function scrollDuringDrag() {
    if (scrollFrame || drag?.kind !== "boards" || !drag.moved || drag.blocked) return;
    if (drag.edge && drag.edge.vertical <= 0) return;
    const distance = window.innerHeight - drag.clientY;
    if (distance >= 44) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      if (drag?.kind !== "boards" || window.innerHeight - drag.clientY >= 44) return;
      const before = window.scrollY;
      window.scrollBy(0, clamp(Math.round((44 - (window.innerHeight - drag.clientY)) / 2), 4, 24));
      if (window.scrollY === before) return;
      moveBoards();
      scrollDuringDrag();
    });
  }
  world.addEventListener("pointermove", event => {
    if (drag?.kind === "field") return;
    if (!drag) {
      const edge = event.ctrlKey || event.shiftKey ? null : hitTest(event).edge;
      world.style.setProperty("--chess-cursor", resizeCursor(edge));
      return;
    }
    if (event.pointerId !== drag.pointer) return;
    drag.clientX = event.clientX;
    drag.clientY = event.clientY;
    moveBoards();
    scrollDuringDrag();
  });

  function finishDrag(event) {
    if (drag?.kind !== "boards" || (event.pointerId != null && event.pointerId !== drag.pointer)) return;
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
    if (event.type === "pointerup" && (event.clientX !== drag.clientX || event.clientY !== drag.clientY)) {
      drag.clientX = event.clientX;
      drag.clientY = event.clientY;
      moveBoards();
    }
    const finished = drag;
    drag = null;
    if (event.type !== "pointerup") {
      state = JSON.parse(finished.before);
      lastTap = null;
      if (finished.blocked) save();
    } else if (finished.moved) {
      lastTap = null;
      if (!finished.blocked) {
        const changed = finished.copy || finished.origins.some(({board, x, y, cols, rows}) =>
          board.x !== x || board.y !== y || board.cols !== cols || board.rows !== rows);
        if (changed || state.fieldRows !== finished.fieldRows) remember(finished.before);
        else save();
      }
    } else if (finished.modified || !finished.tapId) {
      choose(finished.activeId, finished.modified);
      lastTap = null;
      save();
    } else {
      const now = event.timeStamp;
      const same = lastTap?.id === finished.tapId && now - lastTap.time <= 450 &&
        Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) <= 10;
      if (same) {
        const board = state.boards.find(item => item.id === finished.tapId);
        setSelection([board.id]);
        board.phase = !board.phase;
        remember(finished.before);
        lastTap = null;
      } else {
        setSelection([finished.activeId]);
        save();
        lastTap = {id: finished.tapId, time: now, x: event.clientX, y: event.clientY};
      }
    }
    if (world.hasPointerCapture(finished.pointer)) world.releasePointerCapture(finished.pointer);
    world.style.removeProperty("--chess-cursor");
    render();
    if (event.type === "pointerup" && finished.copy && finished.moved && !finished.blocked) {
      elements.get(state.selected).element.focus({preventScroll: true});
    }
  }
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) world.addEventListener(type, finishDrag);
  world.addEventListener("click", event => {
    if (event.detail !== 0) return;
    const element = event.target.closest(".chess-board");
    if (!element) return;
    lastTap = null;
    select(Number(element.dataset.boardId), event.shiftKey || event.ctrlKey);
  });
  viewport.addEventListener("keydown", event => {
    const steps = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!steps[event.key] || event.altKey || event.ctrlKey || event.metaKey || drag) return;
    const board = selected();
    if (!board) return;
    event.preventDefault();
    const step = steps[event.key], amount = event.shiftKey ? 10 : 1;
    mutate(() => {
      board.x = clamp(board.x + step[0] * amount, 0, MAX_POSITION);
      board.y = clamp(board.y + step[1] * amount, 0, MAX_POSITION);
      if (step[1] > 0) growField([board]);
    });
  });
  viewport.addEventListener("pointerdown", event => {
    const handle = event.target.closest("[data-field-edge]");
    if (!handle || event.button !== 0 || drag || state.fieldCols === null || state.fieldRows === null) return;
    finishInput();
    lastTap = null;
    viewport.focus({preventScroll: true});
    drag = {kind: "field", pointer: event.pointerId, before: snapshot(), edge: handle.dataset.fieldEdge,
      startX: event.clientX + window.scrollX, startY: event.clientY + window.scrollY,
      cols: state.fieldCols, rows: state.fieldRows};
    viewport.setAttribute("data-field-resizing", "");
    viewport.setPointerCapture(event.pointerId);
    renderControls();
    event.preventDefault();
  });
  viewport.addEventListener("pointermove", event => {
    if (drag?.kind !== "field" || event.pointerId !== drag.pointer) return;
    if (drag.edge !== "bottom") state.fieldCols = clamp(drag.cols +
      Math.round((event.clientX + window.scrollX - drag.startX) / state.cell), 1, MAX_FIELD);
    if (drag.edge !== "right") state.fieldRows = clamp(drag.rows +
      Math.round((event.clientY + window.scrollY - drag.startY) / state.cell), 1, MAX_FIELD);
    renderScene();
    event.preventDefault();
  });
  function finishFieldResize(event) {
    if (drag?.kind !== "field" || (event.pointerId != null && event.pointerId !== drag.pointer)) return;
    const finished = drag;
    drag = null;
    if (event.type === "pointerup") remember(finished.before);
    else state = JSON.parse(finished.before);
    viewport.removeAttribute("data-field-resizing");
    if (viewport.hasPointerCapture(finished.pointer)) viewport.releasePointerCapture(finished.pointer);
    render();
  }
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) viewport.addEventListener(type, finishFieldResize);
  window.addEventListener("keydown", event => {
    if (event.key === "Delete") {
      const target = event.target;
      if (drag || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
          target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])") ||
          !target.closest("#boards-editor") || !state.selectedIds.length) return;
      event.preventDefault();
      removeSelected();
      viewport.focus({preventScroll: true});
      return;
    }
    if (event.key !== "Escape" || !drag) return;
    event.preventDefault();
    finishFieldResize(event);
    finishDrag(event);
  });
  window.addEventListener("blur", event => { finishFieldResize(event); finishDrag(event); });
  // Измеряем прежнюю область только при первом видимом открытии. После миграции
  // размер явный; наблюдатель больше ничего не перерисовывает и не зацикливается.
  new ResizeObserver(() => { if (initializeField()) render(); }).observe(viewport);
  window.addEventListener("pagehide", event => { finishFieldResize(event); finishDrag(event); finishInput(); save(); });
  render();
})();
