(() => {
  "use strict";
  window.zerkHubStill = true;

  function createEditor(host, config) {
    host.append(document.getElementById("editor-template").content.cloneNode(true));
    const localIds = new Set();
    for (const element of host.querySelectorAll("[id]")) {
      const id = element.id;
      localIds.add(id);
      element.dataset.key = id;
      element.id = `${config.name}-${id}`;
    }
    for (const element of host.querySelectorAll("[for], [aria-describedby], [aria-labelledby], [aria-controls]")) {
      for (const attribute of ["for", "aria-describedby", "aria-labelledby", "aria-controls"]) {
        const value = element.getAttribute(attribute);
        if (value) element.setAttribute(attribute, value.split(/\s+/).map(id => localIds.has(id) ? `${config.name}-${id}` : id).join(" "));
      }
    }
    const BIT_COUNT = config.bits;
    const CHECKERBOARD = config.layout === "checkerboard";
    // Для таблицы слов обе оси получают ровно половину разрядов, без округления.
    // Однобитная шахматка — отдельная схема цвета, а не разбиение слова.
    if ((!CHECKERBOARD && BIT_COUNT % 2 !== 0) || (CHECKERBOARD && BIT_COUNT !== 1)) {
      throw new Error("Равное разбиение слова требует чётного числа битов.");
    }
    const ROW_BITS = CHECKERBOARD ? 1 : BIT_COUNT / 2;
    const COLUMN_BITS = ROW_BITS;
    const ROW_COUNT = 2 ** ROW_BITS;
    const COLUMN_COUNT = 2 ** COLUMN_BITS;
    const NOUN = config.noun;
    const UNIT = NOUN[0].toUpperCase() + NOUN.slice(1);
    const STORAGE_KEY = `${config.storage}_v1`;
    const RIGHT_KEY = `${config.storage}_right_v1`;
    const LAYOUT_KEY = `${config.storage}_layout_v1`;
    const CYCLIC_KEY = `${config.storage}_cyclic_v1`;
    const hex = (value, width = 1) => value.toString(16).toUpperCase().padStart(width, "0");
    const axisBits = (value, width) => width ? value.toString(2).padStart(width, "0") : "—";
    const axisOrder = (reverse, size) => Array.from({ length: size }, (_, index) => reverse ? size - 1 - index : index);
    const bytes = Array.from({ length: 2 ** BIT_COUNT }, (_, value) => {
      const bits = Array.from(value.toString(2).padStart(BIT_COUNT, "0"));
      return {
        value,
        bits,
        row: value >> COLUMN_BITS,
        column: value & (COLUMN_COUNT - 1),
        ones: bits.filter(bit => bit === "1").length,
      };
    });
    const positions = Array.from({ length: ROW_COUNT * COLUMN_COUNT }, (_, index) => {
      const row = Math.floor(index / COLUMN_COUNT), column = index % COLUMN_COUNT;
      return { index, row, column, value: CHECKERBOARD ? row ^ column : index };
    });

    const byId = id => host.querySelector(`[data-key="${id}"]`);
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
    const cyclicControl = byId("cyclic-sequence");
    const valueLabel = CHECKERBOARD ? "Различные значения" : `${UNIT}ы`;
    const detailNames = [valueLabel, "1", "0", "1−0"];
    const stateNames = ["Осталось", "Исключено"];
    const stateClasses = ["remaining", "removed"];

    const axisDescription = CHECKERBOARD
      ? "Шахматка 2×2: цвет клетки — XOR координат. 0 — чёрный, 1 — белый. Два значения повторены по два раза."
      : ROW_BITS === 1
        ? "Строки — старший бит; столбцы — младший бит."
        : `Строки — старшие ${ROW_BITS} бита; столбцы — младшие ${COLUMN_BITS} бита.`;
    field.setAttribute("aria-label", `Поле: ${ROW_COUNT} на ${COLUMN_COUNT}. Значений: ${bytes.length}. ${axisDescription}`);
    host.querySelector(".field").setAttribute("aria-label", `Поле ${NOUN}ов`);
    byId("unit-description").textContent = axisDescription;
    byId("unit-legend").textContent = `Исключённый ${NOUN}.`;
    byId("list-label").textContent = `Список ${BIT_COUNT}-битных слов`;
    byId("list-hint").textContent = `Например, ${bytes[1].bits.join("")} ${bytes[bytes.length - 2].bits.join("")}`;
    byId("popcount-caption").textContent = `По числу единиц в ${NOUN}е`;
    byId("byte-windows-title").textContent = `${UNIT}ы в сквозной`;
    sequence.placeholder = `Все ${NOUN}ы исключены`;
    if (CHECKERBOARD) {
      byId("unit-legend").textContent = "Одинаковые значения исключаются вместе. В расчётах каждое состояние учитывается один раз.";
      byId("sequence-label").textContent = "Сквозная состояний";
      byId("summary-heading").textContent = "Итоги по различным значениям";
      byId("rows").closest(".panel").hidden = true;
      byId("columns").closest(".panel").hidden = true;
      byId("field-count").hidden = false;
      byId("field-rule").hidden = false;
    }
    for (const [id, text] of [["restore", `Вернуть все ${NOUN}ы`], ["exclude", `Исключить ${NOUN}ы из списка`]]) {
      byId(id).title = text;
      byId(id).setAttribute("aria-label", text);
    }
    byId("flip-horizontal").title = `Развернуть столбцы: 0 → ${hex(COLUMN_COUNT - 1)} или ${hex(COLUMN_COUNT - 1)} → 0`;
    byId("flip-vertical").title = `Развернуть строки: 0 → ${hex(ROW_COUNT - 1)} или ${hex(ROW_COUNT - 1)} → 0`;
    byId("reset-layout").title = "Исходное расположение: обе оси по возрастанию. Исключения сохраняются.";

    let excluded = loadExcluded();
    let rightExcluded = loadRightExcluded();
    let layout = loadLayout();
    let cyclic = loadCyclic();
    let previous = null;
    let tabbable = 0;
    const buttons = buildField();
    const fieldRows = Array.from(field.tBodies[0].rows);
    const columnHeaders = Array.from(field.tHead.rows[0].cells).slice(1);

    function loadCyclic() {
      try {
        const stored = JSON.parse(localStorage.getItem(CYCLIC_KEY));
        return typeof stored === "boolean" ? stored : true;
      } catch {
        return true;
      }
    }

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

    function loadRightExcluded() {
      try {
        const saved = JSON.parse(localStorage.getItem(RIGHT_KEY));
        // Metadata belongs to this exact exclusion snapshot. Legacy selections
        // and interrupted writes retain the original left-click diagonal.
        if (!Array.isArray(saved?.excluded) || !Array.isArray(saved.right) ||
          saved.excluded.length !== excluded.size || new Set(saved.excluded).size !== excluded.size ||
          !saved.excluded.every(value => excluded.has(value))) return new Set();
        return new Set(saved.right.filter(value => Number.isInteger(value) && excluded.has(value)));
      } catch { return new Set(); }
    }

    function saveExcluded() {
      try {
        const values = [...excluded].sort((a, b) => a - b);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
        localStorage.setItem(RIGHT_KEY, JSON.stringify({excluded: values, right: [...rightExcluded].sort((a, b) => a - b)}));
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
      heading(header, CHECKERBOARD ? "⊕" : "×", "col").title = CHECKERBOARD ? "Цвет клетки = строка XOR столбец" : "Строка × столбец";
      for (let column = 0; column < COLUMN_COUNT; column += 1) {
        axisHeading(header, column, "col");
      }

      const body = field.createTBody();
      const cells = [];
      for (let rowIndex = 0; rowIndex < ROW_COUNT; rowIndex += 1) {
        const row = body.insertRow();
        axisHeading(row, rowIndex, "row");
        for (let column = 0; column < COLUMN_COUNT; column += 1) {
          const position = positions[rowIndex * COLUMN_COUNT + column];
          const byte = bytes[position.value];
          const button = document.createElement("button");
          const code = hex(byte.value, Math.ceil(BIT_COUNT / 4));
          const bits = document.createElement("span");
          const meta = document.createElement("span");

          button.type = "button";
          button.className = "byte";
          button.tabIndex = position.index === tabbable ? 0 : -1;
          button.dataset.index = position.index;
          button.dataset.value = byte.value;
          button.setAttribute("aria-label", CHECKERBOARD
            ? `Строка ${rowIndex}, столбец ${column}: ${byte.value}. Исключить или вернуть обе клетки со значением ${byte.value}`
            : `Исключение ${NOUN}а ${byte.bits.join("")}, десятичное ${byte.value}, 0x${code}`);

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
      const width = scope === "row" ? ROW_BITS : COLUMN_BITS;
      const code = document.createElement("span");
      const bits = document.createElement("span");
      code.className = "axis-hex";
      code.textContent = hex(value);
      bits.className = "axis-bits";
      bits.textContent = `(${axisBits(value, width)})`;
      item.title = CHECKERBOARD ? `Координата ${scope === "row" ? "строки" : "столбца"}: ${value}` : `${scope === "row" ? "Старшая" : "Младшая"} часть слова: ${axisBits(value, width)}`;
      item.append(code, bits);
    }

    function shiftedPosition(index, key) {
      const { row, column } = positions[index];
      const horizontal = layout.horizontal ? -1 : 1;
      const vertical = layout.vertical ? -1 : 1;
      const clamp = (index, size) => Math.min(size - 1, Math.max(0, index));
      switch (key) {
        case "ArrowLeft": return row * COLUMN_COUNT + clamp(column - horizontal, COLUMN_COUNT);
        case "ArrowRight": return row * COLUMN_COUNT + clamp(column + horizontal, COLUMN_COUNT);
        case "ArrowUp": return clamp(row - vertical, ROW_COUNT) * COLUMN_COUNT + column;
        case "ArrowDown": return clamp(row + vertical, ROW_COUNT) * COLUMN_COUNT + column;
        default: return null;
      }
    }

    function setTabbable(index) {
      buttons[tabbable].tabIndex = -1;
      buttons[index].tabIndex = 0;
      tabbable = index;
    }

    field.addEventListener("focusin", event => {
      const button = event.target.closest("button.byte");
      if (button) setTabbable(Number(button.dataset.index));
    });

    field.addEventListener("keydown", event => {
      const button = event.target.closest("button.byte");
      if (!button) return;
      const index = shiftedPosition(Number(button.dataset.index), event.key);
      if (index === null) return;
      event.preventDefault();
      buttons[index].focus();
    });

    function toggleWord(button, rightClick = false) {
      const value = Number(button.dataset.value);
      const next = new Set(excluded), nextRight = new Set(rightExcluded);
      if (next.has(value) && nextRight.has(value) === rightClick) {
        next.delete(value);
        nextRight.delete(value);
      } else {
        next.add(value);
        if (rightClick) nextRight.add(value);
        else nextRight.delete(value);
      }
      setTabbable(Number(button.dataset.index));
      commit(next, nextRight);
    }

    field.addEventListener("click", event => {
      const button = event.target.closest("button.byte");
      if (button) toggleWord(button);
    });
    field.addEventListener("contextmenu", event => {
      const button = event.target.closest("button.byte");
      // Keep the keyboard context-menu command unchanged; this gesture is right-click.
      if (!button || event.button !== 2) return;
      event.preventDefault();
      toggleWord(button, true);
    });

    function commit(next, directions = rightExcluded) {
      previous = {excluded, rightExcluded};
      excluded = next;
      // Directions are only metadata for the canonical exclusion set.
      rightExcluded = new Set([...directions].filter(value => excluded.has(value)));
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
      ({excluded, rightExcluded} = previous);
      previous = null;
      saveExcluded();
      render(true);
      byId("invert").focus();
    });

    form.addEventListener("submit", event => {
      event.preventDefault();
      const words = input.value.split(/[\s,;]+/).filter(Boolean);
      const pattern = new RegExp(`^[01]{${BIT_COUNT}}$`);
      const invalid = words.find(word => !pattern.test(word));
      if (words.length === 0 || invalid) {
        input.setAttribute("aria-invalid", "true");
        result.dataset.error = "";
        result.textContent = invalid
          ? `Введите ровно ${BIT_COUNT} ${BIT_COUNT === 1 ? "двоичную цифру" : BIT_COUNT === 8 ? "двоичных цифр" : "двоичные цифры"}. Проверьте «${invalid.slice(0, 24)}».`
          : `Введите хотя бы один ${NOUN}.`;
        input.focus();
        return;
      }

      const next = new Set(excluded);
      for (const word of words) next.add(Number.parseInt(word, 2));
      const added = next.size - excluded.size;
      if (added) commit(next);
      result.textContent = added ? `Исключено ${NOUN}ов из списка: ${added}.` : `Эти ${NOUN}ы уже исключены.`;
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
        rows: Array.from({ length: ROW_COUNT }, count),
        columns: Array.from({ length: COLUMN_COUNT }, count),
        popcounts: Array(BIT_COUNT + 1).fill(0),
        positions: Array(BIT_COUNT).fill(0),
      };
    }

    function collectStats() {
      const stats = [initStats(), initStats()];
      for (const byte of bytes) {
        const group = stats[Number(excluded.has(byte.value))];
        const buckets = CHECKERBOARD ? [group.total] : [group.total, group.rows[byte.row], group.columns[byte.column]];
        for (const bucket of buckets) {
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

    const axisLabels = (size, width) => Array.from({ length: size }, (_, index) => width ? `${hex(index)} (${axisBits(index, width)})` : "—");
    const detailClasses = stateClasses.flatMap(stateClass => detailNames.map(() => stateClass));
    const totalRows = buildRows("totals", [valueLabel, "Биты", "Единицы", "Нули", "1−0"], stateClasses);
    const axisRows = buildRows("rows", axisLabels(ROW_COUNT, ROW_BITS), detailClasses);
    const axisColumns = buildRows("columns", axisLabels(COLUMN_COUNT, COLUMN_BITS), detailClasses);
    const popcountRows = buildRows("popcounts", Array.from({ length: BIT_COUNT + 1 }, (_, index) => index), stateClasses);
    const positionRows = buildRows("positions",
      Array.from({ length: BIT_COUNT }, (_, index) => `b${BIT_COUNT - 1 - index}`),
      stateClasses.flatMap(stateClass => [stateClass, stateClass]));

    const windowHeader = byId("byte-windows-head").insertRow();
    heading(windowHeader, UNIT, "col");
    for (let shift = 0; shift < BIT_COUNT; shift += 1) {
      heading(windowHeader, shift, "col").title = `Сдвиг ${shift} бит от начала; шаг ${BIT_COUNT} бит`;
    }
    heading(windowHeader, "Всего", "col");
    const windowClasses = Array(BIT_COUNT + 1).fill("window-count");
    const occurrenceRows = buildRows("byte-occurrences", bytes.map(byte => byte.bits.join("")), windowClasses);
    const windowTotalRows = buildRows("byte-window-totals", ["Всего окон"], windowClasses);
    byId("byte-windows-caption").textContent = BIT_COUNT === 1 ? "Количество · сдвиг 0" : `Количество по сдвигам 0–${BIT_COUNT - 1} бит`;

    function render(announce = false) {
      clearListResult();
      for (const button of buttons) {
        const value = Number(button.dataset.value);
        const pressed = String(excluded.has(value));
        button.toggleAttribute("data-right-excluded", excluded.has(value) && rightExcluded.has(value));
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
      if (CHECKERBOARD) {
        const zeroCells = excluded.has(0) ? 0 : 2, oneCells = excluded.has(1) ? 0 : 2;
        byId("field-count").textContent = `Активных клеток: ${zeroCells + oneCells} из 4 · чёрных 0: ${zeroCells} · белых 1: ${oneCells}. Различных значений: ${stats[0].total.bytes}.`;
      }

      restore.disabled = excluded.size === 0;
      undo.disabled = previous === null;
      updateSequence();
      if (announce) {
        announcement.textContent = `Осталось ${NOUN}ов: ${stats[0].total.bytes}. Исключено: ${stats[1].total.bytes}.`;
      }
    }

    function applyLayout() {
      const focused = host.contains(document.activeElement) ? document.activeElement?.closest("button.byte") : null;
      const columns = axisOrder(layout.horizontal, COLUMN_COUNT);
      const rows = axisOrder(layout.vertical, ROW_COUNT);
      field.tHead.rows[0].append(...columns.map(index => columnHeaders[index]));
      for (const rowIndex of rows) {
        const row = fieldRows[rowIndex];
        row.append(...columns.map(column => buttons[rowIndex * COLUMN_COUNT + column].parentElement));
        field.tBodies[0].append(row);
      }
      byId("rows").append(...rows.map(index => axisRows[index][0].parentElement));
      byId("columns").append(...columns.map(index => axisColumns[index][0].parentElement));
      byId("flip-horizontal").setAttribute("aria-pressed", String(layout.horizontal));
      byId("flip-vertical").setAttribute("aria-pressed", String(layout.vertical));
      byId("reset-layout").disabled = !layout.horizontal && !layout.vertical;
      const direction = (reverse, size) => reverse ? `${hex(size - 1)} → 0` : `0 → ${hex(size - 1)}`;
      byId("layout-status").textContent = `Столбцы слева направо: ${direction(layout.horizontal, COLUMN_COUNT)}.\nСтроки сверху вниз: ${direction(layout.vertical, ROW_COUNT)}.`;
      updateSequence();
      if (focused) focused.focus({ preventScroll: true });
    }

    function updateSequence() {
      const words = [];
      const seen = new Set();
      for (const row of axisOrder(layout.vertical, ROW_COUNT)) {
        for (const column of axisOrder(layout.horizontal, COLUMN_COUNT)) {
          const value = positions[row * COLUMN_COUNT + column].value;
          if (excluded.has(value) || seen.has(value)) continue;
          seen.add(value);
          words.push(bytes[value].bits.join(""));
        }
      }
      const text = words.join("");
      if (sequence.value !== text) {
        sequence.value = text;
        copyResult.textContent = "";
      }
      byId("sequence-count").textContent = CHECKERBOARD ? `Различных состояний: ${words.length} · битов: ${text.length}` : `${UNIT}ов: ${words.length} · битов: ${text.length}`;
      copySequence.disabled = !text;
      renderSequenceStats(text);
    }

    function countSequence(text, wrap) {
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
      if (wrap && runs.length > 1 && runs[0].bit === runs[runs.length - 1].bit) {
        runs[0].length += runs.pop().length;
      }
      for (const run of runs) {
        const histogram = stats.runs[run.bit];
        histogram[run.length] = (histogram[run.length] || 0) + 1;
        stats.runTotals[run.bit] += 1;
        stats.bitTotals[run.bit] += run.length;
        stats.longest = Math.max(stats.longest, run.length);
      }
      // Стык последнего и первого битов включается только в кольцевом режиме.
      const edgeCount = wrap ? text.length : text.length - 1;
      for (let index = 0; index < edgeCount; index += 1) {
        const next = text[(index + 1) % text.length];
        if (text[index] !== next) stats.transitions[text[index] + next] += 1;
      }
      return stats;
    }

    function renderSequenceStats(text) {
      const stats = countSequence(text, cyclic);
      cyclicControl.setAttribute("aria-pressed", String(cyclic));
      const mode = cyclic ? "кольцо" : "строка";
      byId("run-caption").textContent = `Серии подряд · ${mode}`;
      byId("transition-caption").textContent = `Переходы · ${mode}`;
      byId("sequence-hint").textContent = cyclic
        ? "Слева направо, сверху вниз; без добавления битов. Для расчётов строка замкнута в кольцо: последний бит → первый."
        : "Слева направо, сверху вниз; без добавления битов. Линейный расчёт: конец и начало не соединяются.";
      if (CHECKERBOARD) byId("sequence-hint").textContent += " Каждое оставшееся состояние 0/1 берётся один раз, по первому появлению в шахматке.";
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
        ? "Нет оставшихся битов: серий и переходов нет."
        : stats.runTotals[0] === 0 || stats.runTotals[1] === 0
          ? `${cyclic ? "Кольцо" : "Строка"} из одних ${text[0]}: одна серия длины ${text.length}, переходов нет.`
          : !cyclic
            ? "Конец и начало не соединяются: крайние серии раздельные, переход через стык не считается."
            : text[0] === text[text.length - 1]
              ? `Стык ${text[0]} → ${text[0]}: крайние серии объединены в одну.`
              : `Стык ${text[text.length - 1]} → ${text[0]}: этот переход включён в таблицу.`;
      renderByteWindows(text);
    }

    function renderByteWindows(text) {
      const counts = Array.from({ length: bytes.length }, () => Array(BIT_COUNT).fill(0));
      const wordTotals = Array(bytes.length).fill(0);
      const shiftTotals = Array(BIT_COUNT).fill(0);
      const windowCount = text.length < BIT_COUNT ? 0 : cyclic ? text.length : text.length - BIT_COUNT + 1;
      // Каждая позиция старта учитывается один раз; остаток задаёт столбец сдвига.
      // В линейном режиме граница цикла оставляет только полные окна.
      for (let start = 0; start < windowCount; start += 1) {
        let value = 0;
        for (let offset = 0; offset < BIT_COUNT; offset += 1) {
          value = (value << 1) | Number(text[(start + offset) % text.length]);
        }
        const shift = start % BIT_COUNT;
        counts[value][shift] += 1;
        wordTotals[value] += 1;
        shiftTotals[shift] += 1;
      }
      updateRows(occurrenceRows, value => [...counts[value], wordTotals[value]]);
      occurrenceRows.forEach((cells, value) => cells[0].parentElement.classList.toggle("no-occurrences", wordTotals[value] === 0));
      updateRows(windowTotalRows, () => [...shiftTotals, windowCount]);
      byId("byte-windows-count").textContent = `Окон по ${BIT_COUNT} бит: ${windowCount} · ${cyclic ? "кольцо" : "строка"}`;
      byId("byte-windows-hint").textContent = `Сдвиг — от начала сквозной; шаг внутри столбца ${BIT_COUNT} бит. «Всего» — окна с шагом 1 бит. ${cyclic ? "Окна через стык учитываются." : "Только полные окна внутри строки; без добавления нулей."}`;
    }

    cyclicControl.addEventListener("click", () => {
      cyclic = !cyclic;
      try {
        localStorage.setItem(CYCLIC_KEY, JSON.stringify(cyclic));
      } catch {
        // Переключатель работает и без сохранения в браузере.
      }
      renderSequenceStats(sequence.value);
    });

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

    for (const [id, horizontal, vertical] of [["flip-horizontal", true, false], ["flip-vertical", false, true]]) {
      const control = byId(id);
      control.addEventListener("click", event => {
        flip(horizontal, vertical);
        if (event.detail > 0 && control.getAttribute("aria-pressed") === "false") control.dataset.pointerOff = "";
      });
      control.addEventListener("pointerleave", () => { delete control.dataset.pointerOff; });
    }
    byId("reset-layout").addEventListener("click", () => {
      layout = { horizontal: false, vertical: false };
      saveLayout();
      applyLayout();
      byId("flip-horizontal").focus();
    });

    render();
    applyLayout();
  }

  const editors = [
    { name: "byte", bits: 8, noun: "байт", storage: "zerk_bit_byte" },
    { name: "nibble", bits: 4, noun: "полубайт", storage: "zerk_bit_nibble" },
    { name: "dibit", bits: 2, noun: "четвертьбайт", storage: "zerk_bit_dibit" },
    { name: "bit", bits: 1, noun: "бит", storage: "zerk_bit_bit", layout: "checkerboard" },
  ];
  for (const config of editors) createEditor(document.getElementById(`${config.name}-editor`), config);

  const tabs = Array.from(document.querySelectorAll(".editor-tabs [role=tab]"));
  const TAB_KEY = "zerk_bit_byte_active_tab_v1";
  function selectEditor(name, focus = false) {
    for (const tab of tabs) {
      const selected = tab.dataset.mode === name;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      document.getElementById(tab.getAttribute("aria-controls")).hidden = !selected;
      if (selected && focus) tab.focus();
    }
    try { localStorage.setItem(TAB_KEY, name); } catch { /* Вкладки работают без хранилища. */ }
  }
  for (const tab of tabs) tab.addEventListener("click", () => selectEditor(tab.dataset.mode));
  document.querySelector(".editor-tabs").addEventListener("keydown", event => {
    const current = tabs.indexOf(event.target.closest("[role=tab]"));
    if (current < 0) return;
    let next = current;
    if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (current + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    selectEditor(tabs[next].dataset.mode, true);
  });
  let active = "byte";
  try {
    const stored = localStorage.getItem(TAB_KEY);
    if (tabs.some(tab => tab.dataset.mode === stored)) active = stored;
  } catch { /* По умолчанию — байт. */ }
  selectEditor(active);
})();
