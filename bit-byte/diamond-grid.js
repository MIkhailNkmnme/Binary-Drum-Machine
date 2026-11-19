(() => {
  "use strict";
  const grids = new Map();
  const rise = Math.sqrt(3) / 2;
  const directions = [[1, -1], [2, 0], [1, 1], [-1, 1]];
  const neighbors = [[1, -1], [1, 0], [0, 1]];
  const namespace = "http://www.w3.org/2000/svg";
  const gridLine = "#8399aa";
  const epsilon = 1e-6;
  const vertexClass = (i, j) => ((i - j) % 3 + 3) % 3;
  const svgElement = (name, attrs) => {
    const element = document.createElementNS(namespace, name);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    return element;
  };

  function createGrid(cols, rows) {
    const side = Math.min(1, cols / 4, rows / 4);
    const xStep = side / 2, yStep = side * rise;
    const left = Math.min(2, cols / 2), top = Math.min(2, rows / 2);
    const bevel = Math.min(cols, rows) >= 5;
    const tiles = [], filled = [[], []], edges = new Map(), buckets = [];
    let bottom = 0;

    for (let i = Math.floor(-left / (3 * xStep)) - 1; i <= (cols - left) / (3 * xStep) + 1; i++) {
      const minJ = Math.floor((-top / yStep - i) / 2) - 1;
      const maxJ = ((rows - top) / yStep - i) / 2 + 1;
      for (let j = minJ; j <= maxJ; j++) {
        const a = vertexClass(i, j);
        for (const [direction, [di, dj]] of neighbors.entries()) {
          const [ux, uy] = directions[direction], [vx, vy] = directions[direction + 1];
          const x = 3 * i, y = i + 2 * j;
          const coords = [[x, y], [x + ux, y + uy], [x + ux + vx, y + uy + vy], [x + vx, y + vy]];
          const points = coords.map(([px, py]) => [left + px * xStep, top + py * yStep]);
          if (points.some(([px, py]) => px < -epsilon || py < -epsilon || px > cols + epsilon || py > rows + epsilon ||
            (bevel && Math.abs(2 * px / cols - 1) + Math.abs(py / rows - .5) > 1 + epsilon))) continue;

          // Каждый ромб соединяет два шестилучевых узла. Между классами 0 и 1
          // идут три чередующихся луча; третий класс оставляет ромбы пустыми.
          const b = vertexClass(i + di, j + dj);
          const bit = a + b === 1 ? (a === 0 ? i + j : i + di + j + dj) & 1 : null;
          const center = [(points[0][0] + points[2][0]) / 2, (points[0][1] + points[2][1]) / 2];
          const tile = {points, center};
          const xs = points.map(point => point[0]), ys = points.map(point => point[1]);
          const right = Math.max(...xs), base = Math.max(...ys);
          bottom = Math.max(bottom, base);
          tiles.push(tile);
          if (bit !== null) filled[bit].push(tile);

          for (let p = 0; p < 4; p++) {
            const q = (p + 1) % 4;
            const edge = [coords[p].join(","), coords[q].join(",")].sort().join("/");
            if (edges.has(edge)) edges.get(edge).shared = true;
            else edges.set(edge, {points: [points[p], points[q]], shared: false});
          }
          for (let row = Math.max(0, Math.floor(Math.min(...ys))); row < Math.min(rows, Math.ceil(base)); row++) {
            for (let col = Math.max(0, Math.floor(Math.min(...xs))); col < Math.min(cols, Math.ceil(right)); col++) {
              (buckets[row * cols + col] ??= []).push(tile);
            }
          }
        }
      }
    }
    const lines = [...edges.values()];
    const boundary = lines.filter(line => !line.shared);
    const pointText = point => point.map(value => Number(value.toFixed(5))).join(" ");
    const linePath = ({points}) => `M${pointText(points[0])}L${pointText(points[1])}`;
    const fillPaths = filled.map(group => group.map(({points}) => `M${points.map(pointText).join("L")}Z`).join(""));
    return {cols, rows, side, tiles, filled, lines, boundary, fillPaths, buckets, bottom: Math.ceil(bottom - epsilon),
      mesh: lines.map(linePath).join(""), contour: boundary.map(linePath).join("")};
  }

  function get(cols, rows) {
    const key = `${cols}×${rows}`;
    const cached = grids.get(key);
    if (cached) grids.delete(key);
    else if (grids.size >= 20) grids.delete(grids.keys().next().value);
    const grid = cached ?? createGrid(cols, rows);
    grids.set(key, grid);
    return grid;
  }

  function contains(grid, x, y) {
    if (x < 0 || x >= grid.cols || y < 0 || y >= grid.rows) return false;
    return grid.buckets[Math.floor(y) * grid.cols + Math.floor(x)]?.some(({points}) =>
      points.every(([px, py], index) => {
        const [qx, qy] = points[(index + 1) % points.length];
        return (qx - px) * (y - py) - (qy - py) * (x - px) >= -epsilon;
      })) ?? false;
  }

  function edgeAt(grid, x, y, tolerance) {
    const limit = Math.min(tolerance, grid.side / 3) ** 2;
    const near = grid.boundary.some(({points: [[px, py], [qx, qy]]}) => {
      const dx = qx - px, dy = qy - py;
      const t = Math.max(0, Math.min(1, ((x - px) * dx + (y - py) * dy) / (dx * dx + dy * dy)));
      return (x - px - t * dx) ** 2 + (y - py - t * dy) ** 2 <= limit;
    });
    if (!near) return null;
    const horizontal = x / grid.cols - .5, vertical = y / grid.rows - .5;
    return {
      horizontal: Math.abs(horizontal) >= Math.abs(vertical) / 2 ? Math.sign(horizontal) : 0,
      vertical: Math.abs(vertical) >= Math.abs(horizontal) / 2 ? Math.sign(vertical) : 0,
    };
  }

  function svg(grid, paints, digits) {
    const drawing = svgElement("svg", {viewBox: `0 0 ${grid.cols} ${grid.rows}`, "aria-hidden": "true"});
    if (!paints) {
      drawing.append(svgElement("path", {d: grid.contour}));
      return drawing;
    }
    for (const [index, paint] of paints.entries()) {
      drawing.append(svgElement("path", {d: grid.fillPaths[index], fill: paint.hex, "fill-opacity": paint.opacity}));
    }
    drawing.append(svgElement("path", {d: grid.mesh, fill: "none", stroke: gridLine,
      "stroke-opacity": .7, "stroke-width": .65, "vector-effect": "non-scaling-stroke"}));
    if (digits) for (const [index, paint] of paints.entries()) {
      const group = grid.filled[index];
      if (!group.length || paint.opacity === 0) continue;
      const labels = svgElement("text", {
        x: group.map(tile => tile.center[0]).join(" "), y: group.map(tile => tile.center[1]).join(" "),
        fill: paint.ink, "font-family": "monospace", "font-size": grid.side * .52,
        "text-anchor": "middle", "dominant-baseline": "central",
      });
      labels.textContent = String(paint.bit).repeat(group.length);
      drawing.append(labels);
    }
    return drawing;
  }

  function paint(ctx, grid, paints, scale, digits) {
    ctx.save();
    ctx.lineWidth = .65 / scale;
    ctx.strokeStyle = gridLine;
    ctx.font = `${grid.side * .52}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const [index, style] of paints.entries()) {
      ctx.globalAlpha = style.opacity;
      ctx.fillStyle = style.hex;
      ctx.beginPath();
      for (const {points} of grid.filled[index]) {
        ctx.moveTo(...points[0]);
        for (const point of points.slice(1)) ctx.lineTo(...point);
        ctx.closePath();
      }
      ctx.fill();
    }
    ctx.globalAlpha = .7;
    ctx.beginPath();
    for (const {points} of grid.lines) {
      ctx.moveTo(...points[0]);
      ctx.lineTo(...points[1]);
    }
    ctx.stroke();
    if (digits) for (const [index, style] of paints.entries()) {
      if (style.opacity === 0) continue;
      ctx.globalAlpha = 1;
      ctx.fillStyle = style.ink;
      for (const {center} of grid.filled[index]) ctx.fillText(String(style.bit), ...center);
    }
    ctx.restore();
  }

  window.BitByteDiamondGrid = {get, contains, edgeAt, svg, paint};
})();
