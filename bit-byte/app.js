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
    const AXIS_BITS = BIT_COUNT / 2;
    const SIZE = 2 ** AXIS_BITS;
    const NOUN = BIT_COUNT === 8 ? "байт" : "полубайт";
    const UNIT = NOUN[0].toUpperCase() + NOUN.slice(1);
    const STORAGE_KEY = `${config.storage}_v1`;
    const LAYOUT_KEY = `${config.storage}_layout_v1`;
    const CYCLIC_KEY = `${config.storage}_cyclic_v1`;
    const hex = (value, width = 1) => value.toString(16).toUpperCase().padStart(width, "0");
    const nibble = value => value.toString(2).padStart(AXIS_BITS, "0");
    const axisOrder = reverse => Array.from({ length: SIZE }, (_, index) => reverse ? SIZE - 1 - index : index);
    const bytes = Array.from({ length: SIZE * SIZE }, (_, value) => {
      const bits = Array.from(value.toString(2).padStart(BIT_COUNT, "0"));
      return {
        value,
        bits,
        row: value >> AXIS_BITS,
        column: value & (SIZE - 1),
        ones: bits.filter(bit => bit === "1").length,
      };
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
    const detailNames = [`${UNIT}ы`, "1", "0", "1−0"];
    const stateNames = ["Осталось", "Исключено"];
    const stateClasses = ["remaining", "removed"];

    field.setAttribute("aria-label", `Все ${bytes.length} ${NOUN}ов по ${BIT_COUNT} бит. Строки задают старшие ${AXIS_BITS} бита, столбцы — младшие ${AXIS_BITS} бита.`);
    host.querySelector(".field").setAttribute("aria-label", `Поле ${NOUN}ов`);
    byId("unit-description").textContent = `Строки — старшие ${AXIS_BITS} бита; столбцы — младшие ${AXIS_BITS} бита.`;
    byId("unit-legend").textContent = `Исключённый ${NOUN}.`;
    byId("list-label").textContent = `Список ${BIT_COUNT}-битных слов`;
    byId("list-hint").textContent = `Например, ${bytes[1].bits.join("")} ${bytes[bytes.length - 2].bits.join("")}`;
    byId("popcount-caption").textContent = `По числу единиц в ${NOUN}е`;
    byId("byte-windows-title").textContent = `${UNIT}ы в сквозной`;
    sequence.placeholder = `Все ${NOUN}ы исключены`;
    for (const [id, text] of [["restore", `Вернуть все ${NOUN}ы`], ["exclude", `Исключить ${NOUN}ы из списка`]]) {
      byId(id).title = text;
      byId(id).setAttribute("aria-label", text);
    }
    byId("flip-horizontal").title = `Развернуть столбцы: 0 → ${hex(SIZE - 1)} или ${hex(SIZE - 1)} → 0`;
    byId("flip-vertical").title = `Развернуть строки: 0 → ${hex(SIZE - 1)} или ${hex(SIZE - 1)} → 0`;
    byId("reset-layout").title = `Исходное расположение: обе оси от 0 к ${hex(SIZE - 1)}. Исключения сохраняются.`;

    let excluded = loadExcluded();
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
          const code = hex(byte.value, BIT_COUNT / 4);
          const bits = document.createElement("span");
          const meta = document.createElement("span");

          button.type = "button";
          button.className = "byte";
          button.tabIndex = byte.value === tabbable ? 0 : -1;
          button.dataset.value = byte.value;
          button.setAttribute("aria-label", `Исключение ${NOUN}а ${byte.bits.join("")}, десятичное ${byte.value}, 0x${code}`);

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
      item.title = `${scope === "row" ? "Старшие" : "Младшие"} ${AXIS_BITS} бита: ${nibble(value)}`;
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
      const pattern = new RegExp(`^[01]{${BIT_COUNT}}$`);
      const invalid = words.find(word => !pattern.test(word));
      if (words.length === 0 || invalid) {
        input.setAttribute("aria-invalid", "true");
        result.dataset.error = "";
        result.textContent = invalid
          ? `Нужны ровно ${BIT_COUNT} двоичных цифр. Проверьте «${invalid.slice(0, 24)}».`
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
    const totalRows = buildRows("totals", [`${UNIT}ы`, "Биты", "Единицы", "Нули", "1−0"], stateClasses);
    const axisRows = buildRows("rows", nibbleLabels, detailClasses);
    const axisColumns = buildRows("columns", nibbleLabels, detailClasses);
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
    byId("byte-windows-caption").textContent = `Количество по сдвигам 0–${BIT_COUNT - 1} бит`;

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
        announcement.textContent = `Осталось ${NOUN}ов: ${stats[0].total.bytes}. Исключено: ${stats[1].total.bytes}.`;
      }
    }

    function applyLayout() {
      const focused = host.contains(document.activeElement) ? document.activeElement?.closest("button.byte") : null;
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
      byId("reset-layout").disabled = !layout.horizontal && !layout.vertical;
      const direction = reverse => reverse ? `${hex(SIZE - 1)} → 0` : `0 → ${hex(SIZE - 1)}`;
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
      byId("sequence-count").textContent = `${UNIT}ов: ${words.length} · битов: ${text.length}`;
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
    { name: "byte", bits: 8, storage: "zerk_bit_byte" },
    { name: "nibble", bits: 4, storage: "zerk_bit_nibble" },
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
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") next = 1 - current;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    selectEditor(tabs[next].dataset.mode, true);
  });
  let active = "byte";
  try { if (localStorage.getItem(TAB_KEY) === "nibble") active = "nibble"; } catch { /* По умолчанию — байт. */ }
  selectEditor(active);
})();
