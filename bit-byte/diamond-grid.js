(() => {
  "use strict";
  const grids = new Map();
  const rise = Math.sqrt(3) / 2;
  const directions = [[1, -1], [2, 0], [1, 1], [-1, 1]];
  const neighbors = [[1, -1], [1, 0], [0, 1]];
  const namespace = "http://www.w3.org/2000/svg";
  const gridLine = "#8399aa";
  const epsilon = 1e-6;
  const rays = [[2, 0], [1, 1], [-1, 1], [-2, 0], [-1, -1], [1, -1]];
  let meshId = 0;
  const vertexClass = (i, j) => ((i - j) % 3 + 3) % 3;
  const pointText = point => point.map(value => Number(value.toFixed(9))).join(" ");
  const linePath = ({points}) => `M${pointText(points[0])}L${pointText(points[1])}`;
  const svgElement = (name, attrs) => {
    const element = document.createElementNS(namespace, name);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    return element;
  };

  function clipPolygon(points, cols, rows) {
    for (const [axis, bound, sign] of [[0, 0, 1], [0, cols, -1], [1, 0, 1], [1, rows, -1]]) {
      const clipped = [];
      for (let index = 0; index < points.length; index++) {
        const start = points[index], end = points[(index + 1) % points.length];
        const startInside = sign * (start[axis] - bound) >= 0;
        const endInside = sign * (end[axis] - bound) >= 0;
        if (startInside) clipped.push(start);
        if (startInside !== endInside) {
          const t = (bound - start[axis]) / (end[axis] - start[axis]);
          const point = start.map((value, coordinate) => value + t * (end[coordinate] - value));
          point[axis] = bound;
          clipped.push(point);
        }
      }
      points = clipped;
    }
    return points.filter((point, index) => {
      const next = points[(index + 1) % points.length];
      return Math.abs(point[0] - next[0]) + Math.abs(point[1] - next[1]) > epsilon;
    });
  }

  function createGrid(cols, rows, {field = false, offsetX = 0, offsetY = 0} = {}) {
    const side = field ? 1 : Math.min(1, cols / 4, rows / 4);
    const xStep = side / 2, yStep = side * rise;
    const left = field ? 2 - offsetX : Math.min(2, cols / 2);
    const top = field ? 2 - offsetY : Math.min(2, rows / 2);
    const bevel = !field && Math.min(cols, rows) >= 5;
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
          const original = coords.map(([px, py]) => [left + px * xStep, top + py * yStep]);
          if (!field && original.some(([px, py]) => px < -epsilon || py < -epsilon || px > cols + epsilon || py > rows + epsilon ||
            (bevel && Math.abs(2 * px / cols - 1) + Math.abs(py / rows - .5) > 1 + epsilon))) continue;
          const points = field ? clipPolygon(original, cols, rows) : original;
          if (points.length < 3) continue;

          // Все шесть ромбов выбранного узла имеют одну вершину. Тройки 0 и 1
          // чередуются по углу, их внешние вершины дают встречные треугольники.
          // Входящий ромб смотрит на 180° обратно, поэтому его бит противоположен.
          const b = vertexClass(i + di, j + dj);
          const bit = a === 0 ? direction % 2 : b === 0 ? (direction + 1) % 2 : null;
          const center = [(original[0][0] + original[2][0]) / 2, (original[0][1] + original[2][1]) / 2];
          const tile = {points, center, bit, key: `${i},${j},${direction}`};
          const xs = points.map(point => point[0]), ys = points.map(point => point[1]);
          const right = Math.max(...xs), base = Math.max(...ys);
          bottom = Math.max(bottom, base);
          tiles.push(tile);
          if (bit !== null) filled[bit].push(tile);

          for (let p = 0; p < points.length; p++) {
            const q = (p + 1) % points.length;
            const edge = [pointText(points[p]), pointText(points[q])].sort().join("/");
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
    const corners = [[0, 0], [cols, 0], [cols, rows], [0, rows]];
    const boundary = field ? corners.map((point, index) => ({points: [point, corners[(index + 1) % 4]]})) :
      lines.filter(line => !line.shared);
    const fillPaths = filled.map(group => group.map(({points}) => `M${points.map(pointText).join("L")}Z`).join(""));
    return {cols, rows, side, field, offsetX, offsetY, tiles, filled, lines, boundary, fillPaths, buckets,
      bottom: field ? rows : Math.ceil(bottom - epsilon),
      mesh: lines.map(linePath).join(""), contour: boundary.map(linePath).join("")};
  }

  function get(cols, rows, options = {}) {
    const key = `${cols}×${rows}:${!!options.field}:${options.field ? options.offsetX ?? 0 : 0}:${options.field ? options.offsetY ?? 0 : 0}`;
    const cached = grids.get(key);
    if (cached) grids.delete(key);
    else if (grids.size >= 20) grids.delete(grids.keys().next().value);
    const grid = cached ?? createGrid(cols, rows, options);
    grids.set(key, grid);
    return grid;
  }

  function contains(grid, x, y) {
    if (x < 0 || x >= grid.cols || y < 0 || y >= grid.rows) return false;
    if (grid.field) return true;
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

  function svg(grid, paints, digits, {mesh = true} = {}) {
    const drawing = svgElement("svg", {viewBox: `0 0 ${grid.cols} ${grid.rows}`, "aria-hidden": "true", overflow: "hidden"});
    if (!paints) {
      drawing.append(svgElement("path", {d: grid.contour}));
      return drawing;
    }
    for (const [index, paint] of paints.entries()) {
      drawing.append(svgElement("path", {d: grid.fillPaths[index], fill: paint.hex, "fill-opacity": paint.opacity}));
    }
    if (mesh) drawing.append(svgElement("path", {d: grid.mesh, fill: "none", stroke: gridLine,
      "stroke-opacity": .7, "stroke-width": .65, "vector-effect": "non-scaling-stroke"}));
    if (digits) for (const [index, paint] of paints.entries()) {
      const group = grid.filled[index].filter(({center: [x, y]}) => x >= 0 && x < grid.cols && y >= 0 && y < grid.rows);
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

  function paint(ctx, grid, paints, scale, digits, {mesh = true} = {}) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, grid.cols, grid.rows);
    ctx.clip();
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
    if (mesh) {
      ctx.globalAlpha = .7;
      ctx.beginPath();
      for (const {points} of grid.lines) {
        ctx.moveTo(...points[0]);
        ctx.lineTo(...points[1]);
      }
      ctx.stroke();
    }
    if (digits) for (const [index, style] of paints.entries()) {
      if (style.opacity === 0) continue;
      ctx.globalAlpha = 1;
      ctx.fillStyle = style.ink;
      for (const {center} of grid.filled[index]) {
        if (center[0] >= 0 && center[0] < grid.cols && center[1] >= 0 && center[1] < grid.rows)
          ctx.fillText(String(style.bit), ...center);
      }
    }
    ctx.restore();
  }

  // Шесть рёбер от каждого шестилучевого узла покрывают всю ромбическую сетку.
  // Фон не создаёт тайлы, корзины попадания или массивы заливок размером с поле.
  function visitMesh(cols, rows, offsetX, offsetY, visit) {
    const left = 2 - offsetX, top = 2 - offsetY;
    for (let i = Math.floor((-left - 1) / 1.5); i <= (cols - left + 1) / 1.5; i++) {
      const x = left + i * 1.5;
      const minJ = Math.floor(((-top - rise) / rise - i) / 2);
      const maxJ = ((rows - top + rise) / rise - i) / 2;
      for (let j = minJ; j <= maxJ; j++) {
        const y = top + (i + 2 * j) * rise;
        for (const [dx, dy] of rays) visit(x, y, x + dx / 2, y + dy * rise);
      }
    }
  }

  function meshSvg(cols, rows, {offsetX = 0, offsetY = 0} = {}) {
    const drawing = svgElement("svg", {viewBox: `0 0 ${cols} ${rows}`, "aria-hidden": "true", overflow: "hidden"});
    const id = `bit-byte-diamond-mesh-${++meshId}`;
    const pattern = svgElement("pattern", {id, patternUnits: "userSpaceOnUse", width: 3, height: 2 * rise,
      viewBox: `0 0 3 ${2 * rise}`, x: 2 - offsetX, y: 2 - offsetY});
    const paths = [];
    visitMesh(3, 2 * rise, 2, 2, (px, py, qx, qy) => paths.push(linePath({points: [[px, py], [qx, qy]]})));
    pattern.append(svgElement("path", {d: paths.join(""), fill: "none", stroke: gridLine,
      "stroke-opacity": .7, "stroke-width": .65, "vector-effect": "non-scaling-stroke"}));
    const defs = svgElement("defs", {});
    defs.append(pattern);
    drawing.append(defs, svgElement("rect", {width: cols, height: rows, fill: `url(#${id})`}));
    return drawing;
  }

  // Как paint: ctx уже переведён в единицы поля; scale задаёт толщину в пикселях.
  function paintMesh(ctx, cols, rows, scale, {offsetX = 0, offsetY = 0} = {}) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cols, rows);
    ctx.clip();
    ctx.lineWidth = .65 / scale;
    ctx.strokeStyle = gridLine;
    ctx.globalAlpha = .7;
    ctx.beginPath();
    visitMesh(cols, rows, offsetX, offsetY, (px, py, qx, qy) => {
      ctx.moveTo(px, py);
      ctx.lineTo(qx, qy);
    });
    ctx.stroke();
    ctx.restore();
  }

  window.BitByteDiamondGrid = {get, contains, edgeAt, svg, paint, meshSvg, paintMesh};
})();
