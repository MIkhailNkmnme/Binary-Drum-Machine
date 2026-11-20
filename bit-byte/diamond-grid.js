(() => {
  "use strict";
  const grids = new Map(), outlines = new Map();
  const rise = Math.sqrt(3) / 2;
  const directions = [[1, -1], [2, 0], [1, 1], [-1, 1]];
  const neighbors = [[1, -1], [1, 0], [0, 1]];
  const rays = [[2, 0], [1, 1], [-1, 1], [-2, 0], [-1, -1], [1, -1]];
  const namespace = "http://www.w3.org/2000/svg";
  const gridLine = "#8399aa", epsilon = 1e-6;
  let drawingId = 0;
  const modulo = (value, divisor) => ((value % divisor) + divisor) % divisor;
  const vertexClass = (i, j) => modulo(i - j, 3);
  const pointText = point => point.map(value => Number(value.toFixed(9))).join(" ");
  const linePath = ({points}) => `M${pointText(points[0])}L${pointText(points[1])}`;
  const polygonPath = points => `M${points.map(pointText).join("L")}Z`;
  const svgElement = (name, attrs) => {
    const element = document.createElementNS(namespace, name);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    return element;
  };
  function cached(cache, key, create) {
    const previous = cache.get(key);
    if (previous) cache.delete(key);
    else if (cache.size >= 20) cache.delete(cache.keys().next().value);
    const value = previous ?? create();
    cache.set(key, value);
    return value;
  }

  // Один адрес (col,row) — один целый ромб. По вертикальной полосе идут
  // направления 1,2,0; соседние полосы сдвинуты на полшага. Все три ориентации
  // покрывают исходную мозаику без повторов, обрезки и прямоугольных ячеек.
  function address(col, row) {
    const phase = modulo(row, 3), direction = [1, 2, 0][phase];
    return {i: col, j: Math.floor(row / 3) - Math.floor(col / 2) + Number(phase === 2), direction};
  }
  function cellAddress(i, j, direction) {
    return {col: i, row: 3 * (j + Math.floor(i / 2)) + [-1, 0, 1][direction]};
  }
  function tileAt(col, row) {
    const {i, j, direction} = address(col, row);
    const [ux, uy] = directions[direction], [vx, vy] = directions[direction + 1];
    const x = 3 * i, y = i + 2 * j;
    const coords = [[x, y], [x + ux, y + uy], [x + ux + vx, y + uy + vy], [x + vx, y + vy]];
    const points = coords.map(([px, py]) => [2 + px / 2, 2 + py * rise]);
    const [di, dj] = neighbors[direction];
    const a = vertexClass(i, j), b = vertexClass(i + di, j + dj);
    // Шесть чередующихся лучей одного узла сохраняют общий центр.
    const bit = a === 0 ? direction % 2 : b === 0 ? (direction + 1) % 2 : null;
    const adjacent = direction === 0
      ? [[i, j - 1, 2], [i, j - 1, 1], [i + 1, j - 1, 2], [i, j, 1]]
      : direction === 1
        ? [[i, j, 0], [i + 1, j - 1, 2], [i, j + 1, 0], [i, j, 2]]
        : [[i, j, 1], [i, j + 1, 0], [i - 1, j + 1, 1], [i - 1, j + 1, 0]];
    return {col, row, bit, key: `${col},${row}`, points,
      center: [(points[0][0] + points[2][0]) / 2, (points[0][1] + points[2][1]) / 2],
      adjacent: adjacent.map(item => cellAddress(...item))};
  }
  function selection(cols, rows, {offsetX = 0, offsetY = 0, clipCols, clipRows} = {}) {
    const left = Math.max(0, offsetX), top = Math.max(0, offsetY);
    const right = Math.max(left, Math.min(offsetX + cols, clipCols ?? Infinity));
    const bottom = Math.max(top, Math.min(offsetY + rows, clipRows ?? Infinity));
    return {left, top, right, bottom};
  }
  const inSelection = (rect, col, row) => col >= rect.left && col < rect.right && row >= rect.top && row < rect.bottom;
  const rectKey = rect => [rect.left, rect.top, rect.right, rect.bottom].join("/");

  function stitch(boundary) {
    const outgoing = new Map();
    for (const edge of boundary) {
      const key = pointText(edge.points[0]);
      if (!outgoing.has(key)) outgoing.set(key, []);
      outgoing.get(key).push(edge);
    }
    const loops = [];
    for (const edge of boundary) {
      const list = outgoing.get(pointText(edge.points[0]));
      if (!list?.includes(edge)) continue;
      const points = [], start = pointText(edge.points[0]);
      let next = edge;
      while (next) {
        const key = pointText(next.points[0]), edges = outgoing.get(key);
        edges.splice(edges.indexOf(next), 1);
        points.push(next.points[0]);
        const end = pointText(next.points[1]);
        if (end === start) break;
        next = outgoing.get(end)?.at(-1);
      }
      if (points.length >= 3) loops.push(points);
    }
    return loops;
  }
  function outline(rect) {
    return cached(outlines, rectKey(rect), () => {
      if (rect.right === rect.left || rect.bottom === rect.top) {
        return {originX: 0, originY: 0, width: 0, height: 0, contour: "", boundary: [], loops: [], rect};
      }
      const candidates = new Map();
      const add = (col, row) => {
        if (inSelection(rect, col, row)) candidates.set(`${col},${row}`, tileAt(col, row));
      };
      // Соседний ромб отличается не более чем на один столбец и два ряда.
      // Только эти краевые полосы могут образовывать внешний контур.
      for (let row = rect.top; row < rect.bottom; row++) {
        add(rect.left, row); add(rect.right - 1, row);
      }
      for (let col = rect.left; col < rect.right; col++) {
        for (const row of [rect.top, rect.top + 1, rect.bottom - 2, rect.bottom - 1]) add(col, row);
      }
      let originX = Infinity, originY = Infinity, right = -Infinity, bottom = -Infinity;
      const boundary = [];
      for (const tile of candidates.values()) {
        for (const [x, y] of tile.points) {
          originX = Math.min(originX, x); originY = Math.min(originY, y);
          right = Math.max(right, x); bottom = Math.max(bottom, y);
        }
        for (const [index, adjacent] of tile.adjacent.entries()) {
          if (inSelection(rect, adjacent.col, adjacent.row)) continue;
          boundary.push({points: [tile.points[index], tile.points[(index + 1) % 4]],
            horizontal: adjacent.col < rect.left ? -1 : adjacent.col >= rect.right ? 1 : 0,
            vertical: adjacent.row < rect.top ? -1 : adjacent.row >= rect.bottom ? 1 : 0});
        }
      }
      for (const edge of boundary) edge.points = edge.points.map(([x, y]) => [x - originX, y - originY]);
      const loops = stitch(boundary);
      return {originX, originY, width: right - originX, height: bottom - originY,
        boundary, loops, contour: loops.map(polygonPath).join(""), rect};
    });
  }
  function metrics(cols, rows, options = {}) {
    return outline(selection(cols, rows, options));
  }
  function get(cols, rows, options = {}) {
    const rect = selection(cols, rows, options);
    return cached(grids, `${cols}/${rows}/${rectKey(rect)}`, () => {
      const geometry = outline(rect);
      const {originX, originY, height} = geometry;
      const tiles = [], filled = [[], []], edges = new Map(), buckets = new Map();
      for (let row = rect.top; row < rect.bottom; row++) {
        for (let col = rect.left; col < rect.right; col++) {
          const tile = tileAt(col, row);
          tile.points = tile.points.map(([x, y]) => [x - originX, y - originY]);
          tile.center = [tile.center[0] - originX, tile.center[1] - originY];
          tiles.push(tile);
          if (tile.bit !== null) filled[tile.bit].push(tile);
          for (let index = 0; index < 4; index++) {
            const points = [tile.points[index], tile.points[(index + 1) % 4]];
            const key = points.map(pointText).sort().join("/");
            if (!edges.has(key)) edges.set(key, {points});
          }
          const xs = tile.points.map(point => point[0]), ys = tile.points.map(point => point[1]);
          for (let y = Math.floor(Math.min(...ys)); y <= Math.floor(Math.max(...ys)); y++) {
            for (let x = Math.floor(Math.min(...xs)); x <= Math.floor(Math.max(...xs)); x++) {
              const key = `${x},${y}`;
              if (!buckets.has(key)) buckets.set(key, []);
              buckets.get(key).push(tile);
            }
          }
        }
      }
      const lines = [...edges.values()];
      return {...geometry, cols, rows, side: 1, field: true,
        offsetX: options.offsetX ?? 0, offsetY: options.offsetY ?? 0,
        tiles, filled, lines, buckets, bottom: height,
        mesh: lines.map(linePath).join(""),
        fillPaths: filled.map(group => group.map(tile => polygonPath(tile.points)).join(""))};
    });
  }
  function contains(grid, x, y) {
    if (x < -epsilon || x > grid.width + epsilon || y < -epsilon || y > grid.height + epsilon) return false;
    return grid.buckets.get(`${Math.floor(x)},${Math.floor(y)}`)?.some(({points}) =>
      points.every(([px, py], index) => {
        const [qx, qy] = points[(index + 1) % points.length];
        return (qx - px) * (y - py) - (qy - py) * (x - px) >= -epsilon;
      })) ?? false;
  }
  function edgeAt(grid, x, y, tolerance) {
    let nearest = Math.min(tolerance, 1 / 3) ** 2, result = null;
    for (const {points: [[px, py], [qx, qy]], horizontal, vertical} of grid.boundary) {
      const dx = qx - px, dy = qy - py;
      const t = Math.max(0, Math.min(1, ((x - px) * dx + (y - py) * dy) / (dx * dx + dy * dy)));
      const distance = (x - px - t * dx) ** 2 + (y - py - t * dy) ** 2;
      if (distance > nearest + epsilon) continue;
      if (result && Math.abs(distance - nearest) <= epsilon) {
        result.horizontal ||= horizontal;
        result.vertical ||= vertical;
      } else result = {horizontal, vertical};
      nearest = distance;
    }
    return result;
  }
  // Дельта в физических единицах стороны ромба → сдвиг целых адресов.
  // Чётность полосы и три неравномерных положения центра учитываются явно.
  function delta(dx, dy, startX = 0, startY = 0) {
    const center = tileAt(startX, startY).center;
    const targetX = center[0] + dx, targetY = center[1] + dy;
    const estimateX = Math.round((targetX - 2) / 1.5);
    let distance = Infinity, result = {x: 0, y: 0};
    for (let col = estimateX - 2; col <= estimateX + 2; col++) {
      const estimateY = Math.round(3 * (targetY - 2 - modulo(col, 2) * rise) / (2 * rise));
      for (let row = estimateY - 3; row <= estimateY + 3; row++) {
        const point = tileAt(col, row).center;
        const nextDistance = (point[0] - targetX) ** 2 + (point[1] - targetY) ** 2;
        if (nextDistance >= distance) continue;
        distance = nextDistance;
        result = {x: col - startX, y: row - startY};
      }
    }
    return result;
  }
  function drawing(grid) {
    return svgElement("svg", {viewBox: `0 0 ${grid.width || 1} ${grid.height || 1}`,
      "aria-hidden": "true", overflow: "visible"});
  }
  function svg(grid, paints, digits, {mesh = true} = {}) {
    const result = drawing(grid);
    if (!paints) {
      result.append(svgElement("path", {d: grid.contour}));
      return result;
    }
    for (const [index, paint] of paints.entries()) {
      result.append(svgElement("path", {d: grid.fillPaths[index], fill: paint.hex, "fill-opacity": paint.opacity}));
    }
    if (mesh) result.append(svgElement("path", {d: grid.mesh, fill: "none", stroke: gridLine,
      "stroke-opacity": .7, "stroke-width": .65, "vector-effect": "non-scaling-stroke"}));
    if (digits) for (const [index, paint] of paints.entries()) {
      const group = grid.filled[index];
      if (!group.length || paint.opacity === 0) continue;
      const labels = svgElement("text", {
        x: group.map(tile => tile.center[0]).join(" "), y: group.map(tile => tile.center[1]).join(" "),
        fill: paint.ink, "font-family": "monospace", "font-size": .52,
        "text-anchor": "middle", "dominant-baseline": "central",
      });
      labels.textContent = String(paint.bit).repeat(group.length);
      result.append(labels);
    }
    return result;
  }
  function trace(ctx, loops) {
    ctx.beginPath();
    for (const points of loops) {
      ctx.moveTo(...points[0]);
      for (const point of points.slice(1)) ctx.lineTo(...point);
      ctx.closePath();
    }
  }
  function paint(ctx, grid, paints, scale, digits, {mesh = true} = {}) {
    ctx.save();
    trace(ctx, grid.loops); ctx.clip();
    ctx.lineWidth = .65 / scale; ctx.strokeStyle = gridLine;
    ctx.font = ".52px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const [index, style] of paints.entries()) {
      ctx.globalAlpha = style.opacity; ctx.fillStyle = style.hex;
      trace(ctx, grid.filled[index].map(tile => tile.points)); ctx.fill();
    }
    if (mesh) {
      ctx.globalAlpha = .7; ctx.beginPath();
      for (const {points} of grid.lines) { ctx.moveTo(...points[0]); ctx.lineTo(...points[1]); }
      ctx.stroke();
    }
    if (digits) for (const [index, style] of paints.entries()) {
      if (style.opacity === 0) continue;
      ctx.globalAlpha = 1; ctx.fillStyle = style.ink;
      for (const {center} of grid.filled[index]) ctx.fillText(String(style.bit), ...center);
    }
    ctx.restore();
  }
  function visitMesh(width, height, originX, originY, visit) {
    const left = 2 - originX, top = 2 - originY;
    for (let i = Math.floor((-left - 1) / 1.5); i <= (width - left + 1) / 1.5; i++) {
      const x = left + i * 1.5;
      const minJ = Math.floor(((-top - rise) / rise - i) / 2);
      const maxJ = ((height - top + rise) / rise - i) / 2;
      for (let j = minJ; j <= maxJ; j++) {
        const y = top + (i + 2 * j) * rise;
        for (const [dx, dy] of rays) visit(x, y, x + dx / 2, y + dy * rise);
      }
    }
  }
  function meshSvg(cols, rows, options = {}) {
    const geometry = metrics(cols, rows, options), result = drawing(geometry);
    if (!geometry.width || !geometry.height) return result;
    const id = `bit-byte-diamond-mesh-${++drawingId}`;
    const pattern = svgElement("pattern", {id, patternUnits: "userSpaceOnUse", width: 3, height: 2 * rise,
      viewBox: `0 0 3 ${2 * rise}`, x: 2 - geometry.originX, y: 2 - geometry.originY});
    const paths = [];
    visitMesh(3, 2 * rise, 2, 2, (px, py, qx, qy) => paths.push(linePath({points: [[px, py], [qx, qy]]})));
    pattern.append(svgElement("path", {d: paths.join(""), fill: "none", stroke: gridLine,
      "stroke-opacity": .7, "stroke-width": .65, "vector-effect": "non-scaling-stroke"}));
    const defs = svgElement("defs", {}); defs.append(pattern);
    result.append(defs, svgElement("path", {d: geometry.contour, fill: `url(#${id})`}));
    return result;
  }
  // ctx уже масштабирован в единицы стороны и перенесён в bbox поля metrics.
  function paintMesh(ctx, cols, rows, scale, options = {}) {
    const geometry = metrics(cols, rows, options);
    if (!geometry.width || !geometry.height) return;
    ctx.save(); trace(ctx, geometry.loops); ctx.clip();
    ctx.lineWidth = .65 / scale; ctx.strokeStyle = gridLine; ctx.globalAlpha = .7;
    ctx.beginPath();
    visitMesh(geometry.width, geometry.height, geometry.originX, geometry.originY, (px, py, qx, qy) => {
      ctx.moveTo(px, py); ctx.lineTo(qx, qy);
    });
    ctx.stroke(); ctx.restore();
  }
  window.BitByteDiamondGrid = {get, metrics, delta, contains, edgeAt, svg, paint, meshSvg, paintMesh};
})();
