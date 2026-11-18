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
    const nextShape = cols + "/" + rows;
    if (shape !== nextShape) {
      shape = nextShape;
      cells = [];
      const fragment = document.createDocumentFragment();
      for (let diagonal = 0; diagonal < cols + rows - 1; diagonal++) {
        const row = document.createElement("tr");
        row.setAttribute("aria-label", "Диагональ " + (diagonal + 1));
        const cell = document.createElement("td");
        row.append(cell);
        fragment.append(row);
        cells.push(cell);
      }
      body.replaceChildren(fragment);
      table.style.setProperty("--diagonal-width", String(Math.min(cols, rows)));
    }

    let zeros = 0, ones = 0, empty = 0;
    for (let diagonal = 0; diagonal < cells.length; diagonal++) {
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
      const text = values.join(" ");
      if (cells[diagonal].textContent !== text) cells[diagonal].textContent = text;
    }
    modeNote.textContent = modes[mode]
      ? "Режим «" + modes[mode] + "»: итоговые биты текущего наложения."
      : "Обычные слои: бит верхней шахматки с ненулевой непрозрачностью клетки; цветовое смешение в биты не переводится.";
    countNote.textContent = "Поле: " + cols + " × " + rows + " · диагоналей: " + cells.length +
      " · 0: " + zeros + " · 1: " + ones + " · пустых: " + empty;
  }

  window.BitByteDiagonals = {render};
})();
