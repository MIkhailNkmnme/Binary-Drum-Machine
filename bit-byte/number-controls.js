/* Bit-Byte: symbol sliders; source inputs retain their handlers. */
(() => {
  "use strict";
  const controls = [];
  let syncing = false;
  const dispatch = (source, type) => source.dispatchEvent(new Event(type, {bubbles: true}));
  for (const [id, name, suffix = ""] of [
    ["cols", "Столбцы выбранной шахматки"], ["rows", "Строки выбранной шахматки"],
    ["x", "Положение X выбранной шахматки, клетки"], ["y", "Положение Y выбранной шахматки, клетки"],
    ["zero-opacity", "Непрозрачность бита 0", "%"], ["one-opacity", "Непрозрачность бита 1", "%"],
  ]) {
    const source = document.getElementById("chess-" + id);
    const oldLabel = source?.closest("label");
    if (!oldLabel) continue;
    const wrapper = document.createElement("div"), header = document.createElement("div");
    const caption = document.createElement("label");
    const host = document.createElement("span"), middle = document.createElement("span");
    wrapper.className = "bb-number-label";
    header.className = "bb-number-header";
    host.className = "bb-number-control";
    middle.className = "bb-number-track";
    host.title = name + ". Скобки меняют значение на один шаг; удержание повторяет. Двойной щелчок по числу или дорожке, либо Enter на ползунке — ввод числа.";
    const left = document.createElement("button"), right = document.createElement("button");
    for (const [button, direction, symbol] of [[left, "Уменьшить", "["], [right, "Увеличить", "]"]]) {
      button.type = "button";
      button.className = "bb-number-bracket";
      button.setAttribute("aria-label", direction + ": " + name);
      button.title = direction + ": " + name;
      button.textContent = symbol;
    }
    const range = document.createElement("input"), output = document.createElement("output");
    range.type = "range";
    range.id = source.id + "-range";
    range.setAttribute("aria-label", name);
    range.title = host.title;
    output.setAttribute("aria-hidden", "true");
    source.classList.add("bb-number-source");
    source.setAttribute("aria-label", name);
    source.title = name + ". Enter — применить, Escape — вернуть прежнее значение.";
    caption.htmlFor = range.id;
    caption.textContent = oldLabel.textContent.trim();
    caption.title = name;
    header.append(caption, output, source);
    middle.append(range);
    host.append(left, middle, right);
    wrapper.append(header, host);
    oldLabel.replaceWith(wrapper);
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
      wrapper.classList.remove("bb-number-editing");
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
      const text = source.value === "" ? "—" : source.value + suffix;
      if (output.textContent !== text) output.textContent = text;
      if (suffix) range.setAttribute("aria-valuetext", text);
      for (const node of [range, left, right]) if (node.disabled !== off) node.disabled = off;
      host.classList.toggle("bb-number-disabled", off);
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
      wrapper.classList.add("bb-number-editing");
      source.focus({preventScroll: true});
      source.select();
    }
    middle.addEventListener("dblclick", event => { event.preventDefault(); beginEdit(); });
    output.addEventListener("dblclick", event => { event.preventDefault(); beginEdit(); });
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
    controls.push({sync, finish() { stopHold(); closeEdit(); commit(); }});
    sync();
  }
  function syncAll() {
    if (syncing) return;
    syncing = true;
    try { for (const control of controls) control.sync(); }
    finally { syncing = false; }
  }
  window.BitByteNumberControls = {
    sync: syncAll,
    finish() { for (const control of controls) control.finish(); },
  };
  // Covers fieldset-disabled changes even when they come from outside the renderer.
  const panel = document.querySelector(".chess-controls");
  if (panel) new MutationObserver(syncAll).observe(panel, {subtree: true, attributes: true, attributeFilter: ["disabled", "min", "max", "step"]});
})();
