(() => {
  "use strict";
  const KEY = "zerk_bit_chessboards_v1";
  const MAX_BOARDS = 16;
  const byId = id => document.getElementById("chess-" + id);
  const world = byId("world"), viewport = byId("viewport"), list = byId("list");
  const elements = new Map(), undo = [];
  let drag = null, pendingInput = null, saveFailed = false;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const integer = (value, fallback, min, max) => Number.isFinite(Number(value))
    ? clamp(Math.round(Number(value)), min, max) : fallback;
  const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || "") ? value : fallback;

  function makeBoard(id, x = 2, y = 2) {
    return {
      id, name: "Шахматка " + id, x, y, cols: 16, rows: 16, phase: false,
      zero: "#000000", one: "#ffffff", zeroOpacity: 100, oneOpacity: 100, visible: true,
    };
  }
  function initialState() {
    const second = makeBoard(2, 10, 6);
    second.zeroOpacity = second.oneOpacity = 65;
    return { cell: 24, selected: 2, boards: [makeBoard(1), second] };
  }
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (!saved || !Array.isArray(saved.boards)) return initialState();
      const ids = new Set();
      const boards = saved.boards.slice(0, MAX_BOARDS).map((item, index) => {
        item = item && typeof item === "object" ? item : {};
        let id = integer(item.id, index + 1, 1, 1000000);
        while (ids.has(id)) id++;
        ids.add(id);
        return {
          id, name: String(item.name || "Шахматка " + id).slice(0, 40),
          x: integer(item.x, 2, 0, 512), y: integer(item.y, 2, 0, 512),
          cols: integer(item.cols, 16, 1, 128), rows: integer(item.rows, 16, 1, 128),
          phase: item.phase === true, visible: item.visible !== false,
          zero: color(item.zero, "#000000"), one: color(item.one, "#ffffff"),
          zeroOpacity: integer(item.zeroOpacity, 100, 0, 100),
          oneOpacity: integer(item.oneOpacity, 100, 0, 100),
        };
      });
      return {
        cell: integer(saved.cell, 24, 1, 64), boards,
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
  function pattern(board) {
    const first = board.phase ? "one" : "zero", second = board.phase ? "zero" : "one";
    const rect = (x, y, key) => '<rect x="' + x + '" y="' + y +
      '" width="1" height="1" fill="' + board[key] +
      '" fill-opacity="' + board[key + "Opacity"] / 100 + '"/>';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2" viewBox="0 0 2 2" shape-rendering="crispEdges">' +
      rect(0, 0, first) + rect(1, 0, second) + rect(0, 1, second) + rect(1, 1, first) + "</svg>";
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
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
        const tag = document.createElement("span");
        tag.className = "chess-board-tag";
        element.append(tag);
        elements.set(board.id, element);
        world.append(element);
      }
      const active = state.selected === board.id;
      element.hidden = !board.visible;
      element.tabIndex = active ? 0 : -1;
      element.setAttribute("aria-pressed", String(active));
      element.setAttribute("aria-label", board.name + ", " + board.cols + " на " + board.rows +
        " клеток, X " + board.x + ", Y " + board.y + ". Стрелки — перемещение.");
      element.firstElementChild.textContent = board.name;
      Object.assign(element.style, {
        left: board.x * state.cell + "px", top: board.y * state.cell + "px",
        width: board.cols * state.cell + "px", height: board.rows * state.cell + "px",
        backgroundImage: pattern(board), backgroundSize: state.cell * 2 + "px " + state.cell * 2 + "px",
        zIndex: String(index + 1),
      });
      total += board.cols * board.rows;
      if (board.visible) {
        visible++;
        width = Math.max(width, (board.x + board.cols + 2) * state.cell);
        height = Math.max(height, (board.y + board.rows + 2) * state.cell);
      }
    }
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
    list.replaceChildren(...state.boards.map((board, index) => {
      const option = document.createElement("option");
      option.value = board.id;
      option.textContent = board.name + " · слой " + (index + 1) + (board.visible ? "" : " · скрыта");
      return option;
    }));
    list.disabled = !state.boards.length;
    list.value = String(state.selected ?? "");
    byId("cell").value = state.cell;
    const board = selected();
    byId("settings").disabled = !board;
    byId("remove").disabled = !board;
    byId("add").disabled = state.boards.length >= MAX_BOARDS;
    byId("undo").disabled = !undo.length;
    if (!board) return;
    for (const key of ["name", "cols", "rows", "x", "y", "zero", "one"]) byId(key).value = board[key];
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
  for (const [key, min, max] of [["cols", 1, 128], ["rows", 1, 128], ["x", 0, 512], ["y", 0, 512]]) {
    bindInput(key, value => { const board = selected(); if (board) board[key] = integer(value, board[key], min, max); });
  }
  bindInput("name", value => { if (selected()) selected().name = value.slice(0, 40) || "Шахматка"; });
  for (const key of ["zero", "one"]) {
    bindInput(key, value => { if (selected()) selected()[key] = color(value, selected()[key]); });
    bindInput(key + "-opacity", value => { if (selected()) selected()[key + "Opacity"] = integer(value, 100, 0, 100); });
  }
  list.addEventListener("change", () => select(Number(list.value)));
  byId("add").addEventListener("click", () => {
    if (state.boards.length >= MAX_BOARDS) return;
    mutate(() => {
      const id = Math.max(0, ...state.boards.map(board => board.id)) + 1;
      const board = makeBoard(id, 2 + state.boards.length * 2, 2 + state.boards.length * 2);
      state.boards.push(board);
      state.selected = id;
    });
  });
  byId("remove").addEventListener("click", () => mutate(() => {
    state.boards = state.boards.filter(board => board.id !== state.selected);
    state.selected = state.boards.at(-1)?.id ?? null;
  }));
  byId("undo").addEventListener("click", () => {
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
  world.addEventListener("pointerdown", event => {
    if (event.button !== 0 || drag) return;
    const element = event.target.closest(".chess-board");
    if (!element) return;
    select(Number(element.dataset.boardId));
    const board = selected();
    element.focus({ preventScroll: true });
    drag = {
      pointer: event.pointerId, element, id: board.id, before: snapshot(),
      x: board.x, y: board.y, startX: event.clientX, startY: event.clientY,
      scrollX: viewport.scrollLeft, scrollY: viewport.scrollTop,
      worldWidth: world.offsetWidth, worldHeight: world.offsetHeight,
    };
    element.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  world.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const board = state.boards.find(item => item.id === drag.id);
    if (!board) return;
    board.x = clamp(drag.x + Math.round((event.clientX - drag.startX + viewport.scrollLeft - drag.scrollX) / state.cell), 0, 512);
    board.y = clamp(drag.y + Math.round((event.clientY - drag.startY + viewport.scrollTop - drag.scrollY) / state.cell), 0, 512);
    byId("x").value = board.x; byId("y").value = board.y;
    renderScene();
  });
  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.pointer) return;
    const finished = drag;
    drag = null;
    if (event.type === "pointercancel") state = JSON.parse(finished.before);
    else remember(finished.before);
    if (finished.element.hasPointerCapture(finished.pointer)) finished.element.releasePointerCapture(finished.pointer);
    render();
  }
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) world.addEventListener(type, finishDrag);
  world.addEventListener("click", event => {
    const element = event.target.closest(".chess-board");
    if (element && state.selected !== Number(element.dataset.boardId)) select(Number(element.dataset.boardId));
  });
  viewport.addEventListener("keydown", event => {
    const steps = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!steps[event.key] || event.altKey || event.ctrlKey || event.metaKey || drag) return;
    const board = selected();
    if (!board) return;
    event.preventDefault();
    const step = steps[event.key], amount = event.shiftKey ? 10 : 1;
    mutate(() => {
      board.x = clamp(board.x + step[0] * amount, 0, 512);
      board.y = clamp(board.y + step[1] * amount, 0, 512);
    });
  });
  // Скрытая вкладка получает правильную область при открытии и смене ширины окна.
  new ResizeObserver(() => { if (!viewport.closest("[hidden]")) renderScene(); }).observe(viewport);
  window.addEventListener("pagehide", () => { finishInput(); save(); });
  render();
})();
