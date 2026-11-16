(() => {
  "use strict";
  window.zerkHubStill = true;

  const SIZE = 16;
  const BIT_COUNT = 8;
  const STORAGE_KEY = "zerk_bit_byte_v1";
  const hex = (value, width = 1) => value.toString(16).toUpperCase().padStart(width, "0");
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
  const detailNames = ["Байты", "1", "0", "1−0"];
  const stateNames = ["Осталось", "Исключено"];
  const stateClasses = ["remaining", "removed"];

  let excluded = loadExcluded();
  let previous = null;
  let tabbable = 0;
  const buttons = buildField();

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
      heading(header, hex(column), "col");
    }

    const body = field.createTBody();
    const cells = [];
    for (let rowIndex = 0; rowIndex < SIZE; rowIndex += 1) {
      const row = body.insertRow();
      heading(row, hex(rowIndex), "row");
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

  function shiftedValue(value, key) {
    const { row, column } = bytes[value];
    switch (key) {
      case "ArrowLeft": return row * SIZE + Math.max(0, column - 1);
      case "ArrowRight": return row * SIZE + Math.min(SIZE - 1, column + 1);
      case "ArrowUp": return Math.max(0, row - 1) * SIZE + column;
      case "ArrowDown": return Math.min(SIZE - 1, row + 1) * SIZE + column;
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

  const nibbleLabels = Array.from({ length: SIZE }, (_, index) => hex(index));
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
    if (announce) {
      announcement.textContent = `Осталось байтов: ${stats[0].total.bytes}. Исключено: ${stats[1].total.bytes}.`;
    }
  }

  render();
})();