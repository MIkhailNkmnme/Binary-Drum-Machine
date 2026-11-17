/* Bit-Byte: shared 24 + 72 + 24 numeric controls; source inputs retain their handlers. */
(() => {
  "use strict";
  const controls = [];
  let syncing = false;
  const dispatch = (source, type) => source.dispatchEvent(new Event(type, {bubbles: true}));
  for (const [id, name] of [["cols", "Столбцы выбранной шахматки"], ["rows", "Строки выбранной шахматки"],
    ["x", "Положение X выбранной шахматки, клетки"], ["y", "Положение Y выбранной шахматки, клетки"]]) {
    const source = document.getElementById("chess-" + id);
    if (!source || !window.ZerkControlFrame) continue;
    const host = document.createElement("span"), middle = document.createElement("span");
    host.className = "bb-number-control";
    host.title = name + ". Стрелки — один шаг; удержание повторяет. Двойной щелчок по числу или дорожке, либо Enter на ползунке — ввод числа.";
    const left = document.createElement("button"), right = document.createElement("button");
    for (const [button, direction] of [[left, "Уменьшить"], [right, "Увеличить"]]) {
      button.type = "button";
      button.setAttribute("aria-label", direction + ": " + name);
      button.title = direction + ": " + name;
      const arrow = document.createElement("span");
      arrow.className = "bb-number-arrow";
      arrow.setAttribute("aria-hidden", "true");
      button.append(arrow);
    }
    const range = document.createElement("input"), output = document.createElement("output");
    range.type = "range";
    range.id = source.id + "-range";
    range.setAttribute("aria-label", name);
    range.title = host.title;
    output.setAttribute("aria-hidden", "true");
    const oldLabel = source.closest("label");
    if (oldLabel) {
      const wrapper = document.createElement("div"), caption = document.createElement("label");
      wrapper.className = "bb-number-label";
      caption.htmlFor = range.id;
      caption.textContent = oldLabel.textContent.trim();
      oldLabel.replaceWith(wrapper);
      wrapper.append(caption, source);
    }
    source.before(host);
    source.classList.add("bb-number-source");
    source.setAttribute("aria-label", name);
    source.title = name + ". Enter — применить, Escape — вернуть прежнее значение.";
    middle.append(range, output, source);
    host.append(left, middle, right);
    const frame = window.ZerkControlFrame.attach(host, left, middle, right, {input: range, output, valueInThumb: true});
    let dirty = false, hold = null, editing = false, editStart = "";
    const disabled = () => source.matches(":disabled");
    const boardId = () => document.querySelector('#chess-list [aria-pressed="true"]')?.dataset.boardId;
    const bounds = () => ({min: Number(source.min), max: Number(source.max), step: Number(source.step) || 1});
    function write(value) {
      if (disabled()) return false;
      const {min, max} = bounds();
      const next = String(Math.max(min, Math.min(max, Math.round(Number(value)))));
      if (!Number.isFinite(Number(next)) || next === source.value) return false;
      source.value = next;
      if (hold) hold.value = next;
      dirty = true;
      dispatch(source, "input");
      sync();
      return true;
    }
    function commit() {
      if (!dirty) return;
      dirty = false;
      dispatch(source, "change");
      sync();
    }
    function stopHold() {
      if (!hold) return;
      const finished = hold;
      hold = null;
      clearTimeout(finished.timer);
      finished.button.classList.remove("zcf-held");
      if (finished.button.hasPointerCapture(finished.pointer)) finished.button.releasePointerCapture(finished.pointer);
      commit();
    }
    function closeEdit(restore = false) {
      if (!editing) return;
      if (restore && !disabled()) {
        source.value = editStart;
        dispatch(source, "input");
      }
      editing = false;
      host.classList.remove("bb-number-editing");
      // The original input owns the typing history; its change/blur handlers finish it.
      dispatch(source, "change");
      sync();
    }
    function sync() {
      const off = disabled();
      if (hold && (source.value !== hold.value || boardId() !== hold.board)) stopHold();
      if (off) { stopHold(); if (editing) closeEdit(); }
      for (const key of ["min", "max", "step"]) {
        const value = source[key] || (key === "step" ? "1" : "");
        if (range[key] !== value) range[key] = value;
      }
      if (source.value !== "") range.value = source.value;
      if (output.textContent !== source.value) output.textContent = source.value;
      for (const node of [range, left, right]) if (node.disabled !== off) node.disabled = off;
      host.classList.toggle("bb-number-disabled", off);
      frame.sync();
    }
    for (const [button, delta] of [[left, -1], [right, 1]]) {
      const step = () => write(Number(source.value) + delta * bounds().step);
      button.addEventListener("pointerdown", event => {
        if (event.button !== 0 || disabled() || hold) return;
        event.preventDefault();
        closeEdit();
        button.focus({preventScroll: true});
        button.setPointerCapture(event.pointerId);
        hold = {button, pointer: event.pointerId, timer: null, value: source.value, board: boardId()};
        if (!step()) stopHold();
        const repeat = () => {
          if (!hold || hold.button !== button) return;
          if (!step()) { stopHold(); return; }
          if (hold?.button === button) hold.timer = setTimeout(repeat, 65);
        };
        if (hold) hold.timer = setTimeout(repeat, 360);
      });
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) button.addEventListener(type, event => {
        if (hold?.pointer === event.pointerId) stopHold();
      });
      button.addEventListener("click", event => {
        if (event.detail !== 0 || disabled()) return;
        closeEdit();
        step();
        commit();
      });
    }
    range.addEventListener("input", () => write(range.value));
    range.addEventListener("change", commit);
    for (const type of ["pointerup", "pointercancel", "lostpointercapture", "blur"]) range.addEventListener(type, commit);
    function beginEdit() {
      if (disabled() || editing) return;
      stopHold();
      commit();
      editStart = source.value;
      editing = true;
      host.classList.add("bb-number-editing");
      source.focus({preventScroll: true});
      source.select();
    }
    middle.addEventListener("dblclick", event => { event.preventDefault(); beginEdit(); });
    range.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      beginEdit();
    });
    source.addEventListener("keydown", event => {
      if (!editing || !["Enter", "Escape"].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      closeEdit(event.key === "Escape");
      range.focus({preventScroll: true});
    });
    source.addEventListener("blur", () => closeEdit());
    source.addEventListener("input", sync);
    source.addEventListener("change", sync);
    window.addEventListener("blur", () => { stopHold(); commit(); });
    window.addEventListener("pagehide", () => { stopHold(); commit(); });
    controls.push({sync, stopHold});
    sync();
  }
  function syncAll() {
    if (syncing) return;
    syncing = true;
    try { for (const control of controls) control.sync(); }
    finally { syncing = false; }
  }
  window.BitByteNumberControls = {sync: syncAll};
  document.fonts?.ready.then(syncAll);
  // Covers fieldset-disabled changes even when they come from outside the renderer.
  const panel = document.querySelector(".chess-controls");
  if (panel) new MutationObserver(syncAll).observe(panel, {subtree: true, attributes: true, attributeFilter: ["disabled", "min", "max", "step"]});
})();
