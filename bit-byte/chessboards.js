(() => {
  "use strict";
  const KEY = "zerk_bit_chessboards_v1";
  const MAX_BOARDS = 16;
  const MAX_POSITION = 512, MAX_SIZE = 128;
  const OUTLINES = [
    "#ff6868", "#62dc81", "#65a6ff", "#ffd166", "#d98aff", "#55dbdf", "#ff9b60", "#d1e469",
    "#fc86bc", "#8a8fff", "#91a274", "#71c6a6", "#ffe4a1", "#df936f", "#f2b8e9", "#a6e4ff",
  ];
  const byId = id => document.getElementById("chess-" + id);
  const world = byId("world"), viewport = byId("viewport"), list = byId("list");
  const elements = new Map(), undo = [];
  const selection = document.createElement("div");
  selection.className = "chess-selection";
  selection.setAttribute("aria-hidden", "true");
  world.append(selection);
  let drag = null, lastTap = null, pendingInput = null, saveFailed = false;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const integer = (value, fallback, min, max) => Number.isFinite(Number(value))
    ? clamp(Math.round(Number(value)), min, max) : fallback;
  const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || "") ? value : fallback;

  const defaultOutline = id => OUTLINES[(id - 1) % OUTLINES.length];
  const boardLabel = id => "Шахматка " + id;
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
    return { cell: 24, digits: false, selected: 2, boards: [makeBoard(1), second] };
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
        let id = integer(item.id, index + 1, 1, 1000000);
        while (ids.has(id)) id++;
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
      return {
        cell: integer(saved.cell, 24, 1, 64), digits: saved.digits === true, boards,
        selected: boards.some(board => board.id === saved.selected) ? saved.selected : boards[0]?.id ?? null,
      };
    } catch { return initialState(); }
  }
  let state = load();
  const snapshot = () => JSON.stringify(state);
  const selected = () => state.boards.find(board => board.id === state.selected);
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
  function select(id) {
    finishInput();
    state.selected = id;
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
      if (!state.digits) return rect;
      return rect + '<text x="' + (x + .5) + '" y="' + (y + .73) + '" fill="' + digitInk(fill) +
        '" text-anchor="middle" font-family="monospace" font-size=".65" font-weight="700">' +
        (key === "zero" ? "0" : "1") + '</text>';
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
  function renderScene() {
    const ids = new Set(state.boards.map(board => board.id));
    for (const [id, element] of elements) {
      if (!ids.has(id)) { element.remove(); elements.delete(id); }
    }
    let width = 0, height = 0, total = 0, visible = 0;
    for (const [index, board] of state.boards.entries()) {
      let element = elements.get(board.id);
      if (!element) {
        element = document.createElement("button");
        element.type = "button";
        element.className = "chess-board";
        element.dataset.boardId = String(board.id);
        elements.set(board.id, element);
        world.append(element);
      }
      const active = state.selected === board.id;
      element.hidden = !board.visible;
      element.tabIndex = active ? 0 : -1;
      element.setAttribute("aria-pressed", String(active));
      element.setAttribute("aria-label", boardLabel(board.id) + ", " + board.cols + " на " + board.rows +
        " клеток, X " + board.x + ", Y " + board.y + ". Стрелки — перемещение.");
      positionBoard(element, board);
      element.style.backgroundSize = state.cell * 2 + "px " + state.cell * 2 + "px";
      element.style.zIndex = String(index + 1);
      const tile = [board.phase, board.zero, board.one, board.zeroOpacity, board.oneOpacity, state.digits].join(":");
      if (element.dataset.tile !== tile) {
        element.style.backgroundImage = pattern(board);
        element.dataset.tile = tile;
      }
      total += board.cols * board.rows;
      if (board.visible) {
        visible++;
        width = Math.max(width, (board.x + board.cols + 2) * state.cell);
        height = Math.max(height, (board.y + board.rows + 2) * state.cell);
      }
    }
    const activeBoard = selected();
    selection.hidden = !activeBoard?.visible;
    if (activeBoard?.visible) positionBoard(selection, activeBoard);
    // Не сжимать область под указателем в процессе перетаскивания.
    if (drag) { width = Math.max(width, drag.worldWidth); height = Math.max(height, drag.worldHeight); }
    world.style.width = Math.max(viewport.clientWidth, 800, width) + "px";
    world.style.height = Math.max(viewport.clientHeight, 480, height) + "px";
    world.style.setProperty("--chess-cell", state.cell + "px");
    byId("total").textContent = "Шахматок: " + state.boards.length + " · видимых: " + visible +
      " · клетка: " + state.cell + " × " + state.cell + " px · клеток по всем шахматкам: " + total +
      " (наложенные клетки считаются отдельно).";
    renderCounts();
  }
  function renderCounts() {
    const board = selected();
    if (!board) {
      byId("board-count").textContent = "";
      return;
    }
    const count = board.cols * board.rows;
    const zeroCount = board.phase ? Math.floor(count / 2) : Math.ceil(count / 2);
    byId("board-count").textContent = count + " клеток / битов · 0: " + zeroCount + " · 1: " + (count - zeroCount);
    byId("zero-percent").textContent = board.zeroOpacity + "%";
    byId("one-percent").textContent = board.oneOpacity + "%";
  }
  function renderControls() {
    const focused = list.contains(document.activeElement) ? document.activeElement.dataset.boardId : null;
    list.replaceChildren(...state.boards.map((board, index) => {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "chess-swatch";
      swatch.dataset.boardId = String(board.id);
      swatch.style.setProperty("--board-color", board.outline);
      swatch.setAttribute("aria-pressed", String(board.id === state.selected));
      swatch.toggleAttribute("data-hidden", !board.visible);
      const label = boardLabel(board.id) + ", слой " + (index + 1) + (board.visible ? "" : ", скрыта");
      swatch.title = label;
      swatch.setAttribute("aria-label", label);
      return swatch;
    }));
    if (focused) list.querySelector('[data-board-id="' + focused + '"]')?.focus({preventScroll: true});
    byId("cell").value = state.cell;
    byId("digits").setAttribute("aria-pressed", String(state.digits));
    const board = selected();
    byId("settings").disabled = !board;
    byId("remove").disabled = !board;
    byId("add").disabled = state.boards.length >= MAX_BOARDS;
    byId("undo").disabled = !undo.length;
    if (!board) return;
    for (const key of ["cols", "rows", "x", "y", "outline", "zero", "one"]) byId(key).value = board[key];
    byId("zero-opacity").value = board.zeroOpacity;
    byId("one-opacity").value = board.oneOpacity;
    byId("phase").setAttribute("aria-pressed", String(board.phase));
    byId("visibility").setAttribute("aria-pressed", String(board.visible));
    const index = state.boards.indexOf(board);
    byId("backward").disabled = index === 0;
    byId("forward").disabled = index === state.boards.length - 1;
  }
  function render() { renderScene(); renderControls(); }
  function bindInput(id, update) {
    const input = byId(id);
    input.addEventListener("input", () => {
      if (input.type === "number" && (!input.value || !Number.isFinite(input.valueAsNumber))) return;
      if (pendingInput === null) pendingInput = snapshot();
      update(input.value);
      renderScene();
    });
    const commit = () => { finishInput(); renderControls(); };
    input.addEventListener("change", commit);
    input.addEventListener("blur", commit);
  }
  bindInput("cell", value => { state.cell = integer(value, state.cell, 1, 64); });
  for (const [key, min, max] of [["cols", 1, MAX_SIZE], ["rows", 1, MAX_SIZE], ["x", 0, MAX_POSITION], ["y", 0, MAX_POSITION]]) {
    bindInput(key, value => { const board = selected(); if (board) board[key] = integer(value, board[key], min, max); });
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
    select(Number(swatch.dataset.boardId));
  });
  byId("digits").addEventListener("click", () => mutate(() => { state.digits = !state.digits; }));
  byId("add").addEventListener("click", () => {
    if (state.boards.length >= MAX_BOARDS) return;
    mutate(() => {
      const id = Math.max(0, ...state.boards.map(board => board.id)) + 1;
      const board = makeBoard(id, 2 + state.boards.length * 2, 2 + state.boards.length * 2);
      const used = new Set(state.boards.map(item => item.outline.toLowerCase()));
      board.outline = availableOutline(id, used);
      state.boards.push(board);
      state.selected = id;
    });
  });
  byId("remove").addEventListener("click", () => mutate(() => {
    state.boards = state.boards.filter(board => board.id !== state.selected);
    state.selected = state.boards.at(-1)?.id ?? null;
  }));
  byId("undo").addEventListener("click", () => {
    if (drag) return;
    lastTap = null;
    finishInput();
    if (!undo.length) return;
    state = JSON.parse(undo.pop());
    save(); render();
  });
  byId("phase").addEventListener("click", () => mutate(() => { const board = selected(); if (board) board.phase = !board.phase; }));
  byId("visibility").addEventListener("click", () => mutate(() => { const board = selected(); if (board) board.visible = !board.visible; }));
  function reorder(delta) {
    mutate(() => {
      const index = state.boards.indexOf(selected()), target = index + delta;
      if (index < 0 || target < 0 || target >= state.boards.length) return;
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
    for (const board of state.boards) {
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
    // Цветная обводка рисуется поверх всех заливок, поэтому её край получает приоритет.
    const edge = borders.find(hit => hit.board.id === state.selected) ?? borders.at(-1);
    return {inside, edge};
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
    const {inside, edge} = hitTest(event);
    const top = inside.at(-1);
    const active = edge?.board ?? top;
    if (active) {
      select(active.id);
      elements.get(active.id).focus({preventScroll: true});
    } else {
      finishInput();
      viewport.focus({preventScroll: true});
    }
    const group = edge ? [edge.board] : inside.length ? inside : state.boards;
    const origins = group.map(board => ({board, x: board.x, y: board.y, cols: board.cols, rows: board.rows, phase: board.phase}));
    drag = {
      pointer: event.pointerId, before: snapshot(), edge, origins, tapId: top?.id,
      startX: event.clientX, startY: event.clientY,
      scrollX: viewport.scrollLeft, scrollY: viewport.scrollTop,
      worldWidth: world.offsetWidth, worldHeight: world.offsetHeight, moved: false,
    };
    world.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  world.addEventListener("pointermove", event => {
    if (!drag) {
      world.style.setProperty("--chess-cursor", resizeCursor(hitTest(event).edge));
      return;
    }
    if (event.pointerId !== drag.pointer || !drag.origins.length) return;
    const dx = event.clientX - drag.startX + viewport.scrollLeft - drag.scrollX;
    const dy = event.clientY - drag.startY + viewport.scrollTop - drag.scrollY;
    if (!drag.moved && Math.hypot(dx, dy) < Math.min(4, state.cell)) return;
    drag.moved = true;
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
    world.style.setProperty("--chess-cursor", drag.edge ? resizeCursor(drag.edge) : "grabbing");
    const board = selected();
    if (board) for (const key of ["x", "y", "cols", "rows"]) byId(key).value = board[key];
    renderScene();
  });

  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.pointer) return;
    const finished = drag;
    drag = null;
    if (event.type !== "pointerup") {
      state = JSON.parse(finished.before);
      lastTap = null;
    } else if (finished.moved || !finished.tapId) {
      lastTap = null;
      remember(finished.before);
    } else {
      const now = event.timeStamp;
      const same = lastTap?.id === finished.tapId && now - lastTap.time <= 450 &&
        Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) <= 10;
      if (same) {
        const board = state.boards.find(item => item.id === finished.tapId);
        state.selected = board.id;
        board.phase = !board.phase;
        remember(finished.before);
        lastTap = null;
      } else {
        lastTap = {id: finished.tapId, time: now, x: event.clientX, y: event.clientY};
      }
    }
    if (world.hasPointerCapture(finished.pointer)) world.releasePointerCapture(finished.pointer);
    world.style.removeProperty("--chess-cursor");
    render();
  }
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) world.addEventListener(type, finishDrag);
  world.addEventListener("click", event => {
    if (event.detail !== 0) return;
    const element = event.target.closest(".chess-board");
    if (element) select(Number(element.dataset.boardId));
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
    });
  });
  // Скрытая вкладка получает правильную область при открытии и смене ширины окна.
  new ResizeObserver(() => { if (!viewport.closest("[hidden]")) renderScene(); }).observe(viewport);
  window.addEventListener("pagehide", () => { finishInput(); save(); });
  render();
})();
