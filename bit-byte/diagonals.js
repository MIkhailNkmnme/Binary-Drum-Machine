(() => {
  "use strict";
  const table = document.getElementById("chess-diagonals-table");
  const body = document.getElementById("chess-diagonals-body");
  const modeNote = document.getElementById("chess-diagonals-mode");
  const countNote = document.getElementById("chess-diagonals-count");
  const modes = {
    "xor": "XOR все", "and": "AND все",
    "xor-rgb": "XOR RGB", "and-rgb": "AND RGB", "add-rgb": "RGB+",
  };
  let shape = "", cells = [];

  function render(bits, cols, rows, mode) {
    const lines = [];
    let zeros = 0, ones = 0, empty = 0;
    let first = -1, last = -1, width = 1;
    for (let diagonal = 0; diagonal < cols + rows - 1; diagonal++) {
      const values = [];
      const firstX = Math.max(0, diagonal - rows + 1);
      const lastX = Math.min(cols - 1, diagonal);
      for (let x = firstX; x <= lastX; x++) {
        const y = diagonal - x;
        const bit = bits[y * cols + x];
        if (bit === 0) { values.push("0"); zeros++; }
        else if (bit === 1) { values.push("1"); ones++; }
        else { values.push("·"); empty++; }
      }
      const text = values.join("").replace(/^·+|·+$/g, "");
      lines.push(text);
      if (text) {
        if (first < 0) first = diagonal;
        last = diagonal;
        width = Math.max(width, text.length);
      }
    }
    const nextShape = first + "/" + last;
    if (shape !== nextShape) {
      shape = nextShape;
      cells = [];
      const fragment = document.createDocumentFragment();
      for (let diagonal = first; first >= 0 && diagonal <= last; diagonal++) {
        const row = document.createElement("tr");
        row.setAttribute("aria-label", "Диагональ " + (diagonal + 1));
        const cell = document.createElement("td");
        row.append(cell);
        fragment.append(row);
        cells.push(cell);
      }
      body.replaceChildren(fragment);
    }
    table.style.setProperty("--diagonal-width", String(width));
    for (let index = 0; index < cells.length; index++) {
      const text = lines[first + index] || "\u00a0";
      if (cells[index].textContent !== text) cells[index].textContent = text;
    }
    modeNote.textContent = modes[mode]
      ? "Режим «" + modes[mode] + "»: итоговые биты текущего наложения."
      : "Обычные слои: бит верхней шахматки с ненулевой непрозрачностью клетки; цветовое смешение в биты не переводится.";
    countNote.textContent = "Поле: " + cols + " × " + rows + " · строк: " + cells.length +
      " · 0: " + zeros + " · 1: " + ones + " · пустых: " + empty;
  }

  window.BitByteDiagonals = {render};
})();
