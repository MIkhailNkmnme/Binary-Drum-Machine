(() => {
  "use strict";
  window.zerkHubStill = true;

  const SIZE = 16;
  const BIT_COUNT = 8;
  const STORAGE_KEY = "zerk_bit_byte_v1";
  const LAYOUT_KEY = "zerk_bit_byte_layout_v1";
  const hex = (value, width = 1) => value.toString(16).toUpperCase().padStart(width, "0");
  const nibble = value => value.toString(2).padStart(4, "0");
  const axisOrder = reverse => Array.from({ length: SIZE }, (_, index) => reverse ? SIZE - 1 - index : index);
  const bytes = Array.from({ length: SIZE * SIZE }, (_, value) => {
    const bits = Array.from(value.toString(2).padStart(BIT_COUNT, "0"));
    return {
      value,
      bits,
      row: value >> 4,
      column: value & 15,
      ones: bits.filter(bit => bit === "1").length,
    };
  });

  const byId = id => document.getElementById(id);
  const field = byId("byte-field");
  const restore = byId("restore");
  const undo = byId("undo");
  const form = byId("exclude-form");
  const input = byId("exclude-list");
  const result = byId("list-result");
  const announcement = byId("announcement");
  const sequence = byId("remaining-sequence");
  const copySequence = byId("copy-sequence");
  const copyResult = byId("copy-result");
  const detailNames = ["Байты", "1", "0", "1−0"];
  const stateNames = ["Осталось", "Исключено"];
  const stateClasses = ["remaining", "removed"];

  let excluded = loadExcluded();
  let layout = loadLayout();
  let previous = null;
  let tabbable = 0;
  const buttons = buildField();
  const fieldRows = Array.from(field.tBodies[0].rows);
  const columnHeaders = Array.from(field.tHead.rows[0].cells).slice(1);

  function loadLayout() {
    try {
      const stored = JSON.parse(localStorage.getItem(LAYOUT_KEY));
      return { horizontal: stored?.horizontal === true, vertical: stored?.vertical === true };
    } catch {
      return { horizontal: false, vertical: false };
    }
  }

  function saveLayout() {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    } catch {
      // Расположение остаётся доступно в открытой странице.
    }
  }

  function loadExcluded() {
    try {
      const values = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(values)) {
        return new Set(values.filter(value => Number.isInteger(value) && value >= 0 && value < bytes.length));
      }
    } catch {
      // Ручной выбор остаётся доступен при недоступном или повреждённом хранилище.
    }
    return new Set();
  }

  function saveExcluded() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...excluded].sort((a, b) => a - b)));
    } catch {
      // Продолжаем работу со значениями открытой страницы.
    }
  }

  function cell(row, tag, label) {
    const item = document.createElement(tag);
    item.textContent = label;
    row.append(item);
    return item;
  }

  function heading(row, label, scope) {
    const item = cell(row, "th", label);
    item.scope = scope;
    return item;
  }

  function buildField() {
    const header = field.createTHead().insertRow();
    heading(header, "×", "col").title = "Строка × столбец";
    for (let column = 0; column < SIZE; column += 1) {
      axisHeading(header, column, "col");
    }

    const body = field.createTBody();
    const cells = [];
    for (let rowIndex = 0; rowIndex < SIZE; rowIndex += 1) {
      const row = body.insertRow();
      axisHeading(row, rowIndex, "row");
      for (let column = 0; column < SIZE; column += 1) {
        const byte = bytes[rowIndex * SIZE + column];
        const button = document.createElement("button");
        const code = hex(byte.value, 2);
        const bits = document.createElement("span");
        const meta = document.createElement("span");

        button.type = "button";
        button.className = "byte";
        button.tabIndex = byte.value === tabbable ? 0 : -1;
        button.dataset.value = byte.value;
        button.setAttribute("aria-label", `Исключение байта ${byte.bits.join("")}, десятичное ${byte.value}, 0x${code}`);

        bits.className = "bits";
        for (const bit of byte.bits) {
          const digit = document.createElement("span");
          if (bit === "1") digit.className = "bit-one";
          digit.textContent = bit;
          bits.append(digit);
        }
        meta.className = "byte-code";
        meta.textContent = `${byte.value} · ${code}`;
        button.append(bits, meta);
        row.insertCell().append(button);
        cells.push(button);
      }
    }
    return cells;
  }

  function axisHeading(row, value, scope) {
    const item = heading(row, "", scope);
    const code = document.createElement("span");
    const bits = document.createElement("span");
    code.className = "axis-hex";
    code.textContent = hex(value);
    bits.className = "axis-bits";
    bits.textContent = `(${nibble(value)})`;
    item.title = `${scope === "row" ? "Старшие" : "Младшие"} четыре бита: ${nibble(value)}`;
    item.append(code, bits);
  }

  function shiftedValue(value, key) {
    const { row, column } = bytes[value];
    const horizontal = layout.horizontal ? -1 : 1;
    const vertical = layout.vertical ? -1 : 1;
    const clamp = index => Math.min(SIZE - 1, Math.max(0, index));
    switch (key) {
      case "ArrowLeft": return row * SIZE + clamp(column - horizontal);
      case "ArrowRight": return row * SIZE + clamp(column + horizontal);
      case "ArrowUp": return clamp(row - vertical) * SIZE + column;
      case "ArrowDown": return clamp(row + vertical) * SIZE + column;
      default: return null;
    }
  }

  function setTabbable(value) {
    buttons[tabbable].tabIndex = -1;
    buttons[value].tabIndex = 0;
    tabbable = value;
  }

  field.addEventListener("focusin", event => {
    const button = event.target.closest("button.byte");
    if (button) setTabbable(Number(button.dataset.value));
  });

  field.addEventListener("keydown", event => {
    const button = event.target.closest("button.byte");
    if (!button) return;
    const value = shiftedValue(Number(button.dataset.value), event.key);
    if (value === null) return;
    event.preventDefault();
    buttons[value].focus();
  });

  field.addEventListener("click", event => {
    const button = event.target.closest("button.byte");
    if (!button) return;
    const value = Number(button.dataset.value);
    const next = new Set(excluded);
    if (!next.delete(value)) next.add(value);
    setTabbable(value);
    commit(next);
  });

  function commit(next) {
    previous = excluded;
    excluded = next;
    saveExcluded();
    render(true);
  }

  restore.addEventListener("click", () => {
    commit(new Set());
    // Сброс выключает саму кнопку, поэтому переводим фокус на доступную команду.
    undo.focus();
  });

  byId("invert").addEventListener("click", () => {
    commit(new Set(bytes.map(byte => byte.value).filter(value => !excluded.has(value))));
  });

  undo.addEventListener("click", () => {
    if (!previous) return;
    excluded = previous;
    previous = null;
    saveExcluded();
    render(true);
    byId("invert").focus();
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    const words = input.value.split(/[\s,;]+/).filter(Boolean);
    const invalid = words.find(word => !/^[01]{8}$/.test(word));
    if (words.length === 0 || invalid) {
      input.setAttribute("aria-invalid", "true");
      result.dataset.error = "";
      result.textContent = invalid
        ? `Нужны ровно 8 двоичных цифр. Проверьте «${invalid.slice(0, 24)}».`
        : "Введите хотя бы один байт.";
      input.focus();
      return;
    }

    const next = new Set(excluded);
    for (const word of words) next.add(Number.parseInt(word, 2));
    const added = next.size - excluded.size;
    if (added) commit(next);
    result.textContent = added ? `Исключено байтов из списка: ${added}.` : "Эти байты уже исключены.";
  });

  input.addEventListener("input", clearListResult);

  function clearListResult() {
    input.removeAttribute("aria-invalid");
    delete result.dataset.error;
    result.textContent = "";
  }

  function count() {
    return { bytes: 0, ones: 0 };
  }

  function initStats() {
    return {
      total: count(),
      rows: Array.from({ length: SIZE }, count),
      columns: Array.from({ length: SIZE }, count),
      popcounts: Array(BIT_COUNT + 1).fill(0),
      positions: Array(BIT_COUNT).fill(0),
    };
  }

  function collectStats() {
    const stats = [initStats(), initStats()];
    for (const byte of bytes) {
      const group = stats[Number(excluded.has(byte.value))];
      for (const bucket of [group.total, group.rows[byte.row], group.columns[byte.column]]) {
        bucket.bytes += 1;
        bucket.ones += byte.ones;
      }
      group.popcounts[byte.ones] += 1;
      byte.bits.forEach((bit, index) => {
        group.positions[index] += Number(bit);
      });
    }
    return stats;
  }

  function pairHeader(bodyId, label, metrics) {
    const head = byId(bodyId).parentElement.tHead;
    const groups = head.insertRow();
    const fixed = heading(groups, label, "col");
    fixed.rowSpan = 2;
    stateNames.forEach((name, index) => {
      const group = heading(groups, name, "col");
      group.colSpan = metrics.length;
      group.className = stateClasses[index];
    });
    const names = head.insertRow();
    for (const stateClass of stateClasses) {
      for (const metric of metrics) heading(names, metric, "col").className = stateClass;
    }
  }

  function buildRows(bodyId, labels, classes) {
    const body = byId(bodyId);
    return labels.map(label => {
      const row = body.insertRow();
      heading(row, label, "row");
      return classes.map(className => {
        const item = cell(row, "td", "");
        item.className = className;
        return item;
      });
    });
  }

  function updateRows(rows, getValues) {
    rows.forEach((row, index) => {
      const values = getValues(index);
      row.forEach((item, column) => {
        const value = String(values[column]);
        if (item.textContent !== value) item.textContent = value;
      });
    });
  }

  function totals({ bytes: byteCount, ones }) {
    const bitCount = byteCount * BIT_COUNT;
    const zeros = bitCount - ones;
    const difference = ones - zeros;
    return [byteCount, bitCount, ones, zeros, difference > 0 ? `+${difference}` : difference];
  }

  function axisValues(stats, axis, index) {
    return stats.flatMap(group => {
      const [byteCount, , ones, zeros, difference] = totals(group[axis][index]);
      return [byteCount, ones, zeros, difference];
    });
  }

  pairHeader("rows", "Старш.", detailNames);
  pairHeader("columns", "Младш.", detailNames);
  pairHeader("positions", "Разряд", ["1", "0"]);

  const nibbleLabels = Array.from({ length: SIZE }, (_, index) => `${hex(index)} (${nibble(index)})`);
  const detailClasses = stateClasses.flatMap(stateClass => detailNames.map(() => stateClass));
  const totalRows = buildRows("totals", ["Байты", "Биты", "Единицы", "Нули", "1−0"], stateClasses);
  const axisRows = buildRows("rows", nibbleLabels, detailClasses);
  const axisColumns = buildRows("columns", nibbleLabels, detailClasses);
  const popcountRows = buildRows("popcounts", Array.from({ length: BIT_COUNT + 1 }, (_, index) => index), stateClasses);
  const positionRows = buildRows("positions",
    Array.from({ length: BIT_COUNT }, (_, index) => `b${BIT_COUNT - 1 - index}`),
    stateClasses.flatMap(stateClass => [stateClass, stateClass]));

  function render(announce = false) {
    clearListResult();
    for (const [value, button] of buttons.entries()) {
      const pressed = String(excluded.has(value));
      if (button.getAttribute("aria-pressed") !== pressed) button.setAttribute("aria-pressed", pressed);
    }

    const stats = collectStats();
    const summary = stats.map(group => totals(group.total));
    updateRows(totalRows, index => summary.map(group => group[index]));
    updateRows(axisRows, index => axisValues(stats, "rows", index));
    updateRows(axisColumns, index => axisValues(stats, "columns", index));
    updateRows(popcountRows, index => stats.map(group => group.popcounts[index]));
    updateRows(positionRows, index => stats.flatMap(group => [
      group.positions[index],
      group.total.bytes - group.positions[index],
    ]));

    restore.disabled = excluded.size === 0;
    undo.disabled = previous === null;
    updateSequence();
    if (announce) {
      announcement.textContent = `Осталось байтов: ${stats[0].total.bytes}. Исключено: ${stats[1].total.bytes}.`;
    }
  }

  function applyLayout() {
    const focused = document.activeElement?.closest("button.byte");
    const columns = axisOrder(layout.horizontal);
    const rows = axisOrder(layout.vertical);
    field.tHead.rows[0].append(...columns.map(index => columnHeaders[index]));
    for (const rowIndex of rows) {
      const row = fieldRows[rowIndex];
      row.append(...columns.map(column => buttons[rowIndex * SIZE + column].parentElement));
      field.tBodies[0].append(row);
    }
    byId("rows").append(...rows.map(index => axisRows[index][0].parentElement));
    byId("columns").append(...columns.map(index => axisColumns[index][0].parentElement));
    byId("flip-horizontal").setAttribute("aria-pressed", String(layout.horizontal));
    byId("flip-vertical").setAttribute("aria-pressed", String(layout.vertical));
    byId("flip-both").setAttribute("aria-pressed", String(layout.horizontal && layout.vertical));
    byId("reset-layout").disabled = !layout.horizontal && !layout.vertical;
    const direction = reverse => reverse ? "F → 0" : "0 → F";
    byId("layout-status").textContent = `Столбцы слева направо: ${direction(layout.horizontal)}.\nСтроки сверху вниз: ${direction(layout.vertical)}.`;
    updateSequence();
    if (focused) focused.focus({ preventScroll: true });
  }

  function updateSequence() {
    const words = [];
    for (const row of axisOrder(layout.vertical)) {
      for (const column of axisOrder(layout.horizontal)) {
        const value = row * SIZE + column;
        if (!excluded.has(value)) words.push(bytes[value].bits.join(""));
      }
    }
    const text = words.join("");
    if (sequence.value !== text) {
      sequence.value = text;
      copyResult.textContent = "";
    }
    byId("sequence-count").textContent = `Байтов: ${words.length} · битов: ${text.length}`;
    copySequence.disabled = !text;
    renderRingStats(text);
  }

  function countRing(text) {
    const stats = {
      runs: [[], []],
      runTotals: [0, 0],
      bitTotals: [0, 0],
      longest: 0,
      transitions: { "10": 0, "01": 0 },
    };
    if (!text.length) return stats;

    const runs = [];
    let bit = Number(text[0]);
    let length = 1;
    for (let index = 1; index < text.length; index += 1) {
      const next = Number(text[index]);
      if (next === bit) {
        length += 1;
      } else {
        runs.push({ bit, length });
        bit = next;
        length = 1;
      }
    }
    runs.push({ bit, length });

    // Один обход кольца: одинаковые краевые серии объединяются ровно один раз.
    // Однородное кольцо уже является одной серией полной длины.
    if (runs.length > 1 && runs[0].bit === runs[runs.length - 1].bit) {
      runs[0].length += runs.pop().length;
    }
    for (const run of runs) {
      const histogram = stats.runs[run.bit];
      histogram[run.length] = (histogram[run.length] || 0) + 1;
      stats.runTotals[run.bit] += 1;
      stats.bitTotals[run.bit] += run.length;
      stats.longest = Math.max(stats.longest, run.length);
    }
    // Каждое соседство считается один раз, включая последнее → первое.
    for (let index = 0; index < text.length; index += 1) {
      const next = text[(index + 1) % text.length];
      if (text[index] !== next) stats.transitions[text[index] + next] += 1;
    }
    return stats;
  }

  function renderRingStats(text) {
    const stats = countRing(text);
    const fragment = document.createDocumentFragment();
    for (let length = 1; length <= stats.longest; length += 1) {
      const row = document.createElement("tr");
      heading(row, length, "row");
      cell(row, "td", stats.runs[1][length] || 0);
      cell(row, "td", stats.runs[0][length] || 0);
      fragment.append(row);
    }
    if (!text.length) {
      const row = document.createElement("tr");
      cell(row, "td", "Нет оставшихся битов").colSpan = 3;
      fragment.append(row);
    }
    byId("ring-runs").replaceChildren(fragment);
    byId("run-total-ones").textContent = stats.runTotals[1];
    byId("run-total-zeros").textContent = stats.runTotals[0];
    byId("run-bits-ones").textContent = stats.bitTotals[1];
    byId("run-bits-zeros").textContent = stats.bitTotals[0];
    byId("transition-10").textContent = stats.transitions["10"];
    byId("transition-01").textContent = stats.transitions["01"];
    byId("transition-total").textContent = stats.transitions["10"] + stats.transitions["01"];
    byId("ring-boundary").textContent = !text.length
      ? "Пустое кольцо: серий и переходов нет."
      : stats.runTotals[0] === 0 || stats.runTotals[1] === 0
        ? `Кольцо из одних ${text[0]}: одна серия длины ${text.length}, переходов нет.`
        : text[0] === text[text.length - 1]
          ? `Стык ${text[0]} → ${text[0]}: крайние серии объединены в одну.`
          : `Стык ${text[text.length - 1]} → ${text[0]}: этот переход включён в таблицу.`;
  }

  copySequence.addEventListener("click", async () => {
    const text = sequence.value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (sequence.value === text) copyResult.textContent = `Скопировано битов: ${text.length}.`;
    } catch {
      sequence.focus();
      sequence.select();
      copyResult.textContent = "Текст выделен. Нажмите Ctrl+C, чтобы скопировать.";
    }
  });

  function flip(horizontal, vertical) {
    if (horizontal) layout.horizontal = !layout.horizontal;
    if (vertical) layout.vertical = !layout.vertical;
    saveLayout();
    applyLayout();
  }

  byId("flip-horizontal").addEventListener("click", () => flip(true, false));
  byId("flip-vertical").addEventListener("click", () => flip(false, true));
  byId("flip-both").addEventListener("click", () => flip(true, true));
  byId("reset-layout").addEventListener("click", () => {
    layout = { horizontal: false, vertical: false };
    saveLayout();
    applyLayout();
    byId("flip-horizontal").focus();
  });

  render();
  applyLayout();
})();
