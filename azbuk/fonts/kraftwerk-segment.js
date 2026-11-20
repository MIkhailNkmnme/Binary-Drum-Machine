// АЗБ-068. Own segment geometry inspired by the supplied MUSIC NON STOP frames.
// No external font outlines. The unshown alphabet is an author extension.
(() => {
  const WIDTH = 32, HEIGHT = 48, SLANT = 0.16;
  // Named display strokes, including the short central stroke visible in M.
  // Separate pointed ends leave black joints instead of merging into a contour.
  const lines = {
    a: [5, 4, 23, 4], b: [24, 6, 24, 22], c: [24, 26, 24, 42],
    d: [5, 44, 23, 44], e: [4, 26, 4, 42], f: [4, 6, 4, 22],
    g: [5, 24, 23, 24], h: [14, 6, 14, 22], i: [14, 26, 14, 42],
    j: [6, 6, 22, 22], k: [22, 6, 16, 22],
    l: [12, 26, 6, 42], m: [16, 26, 22, 42],
    n: [14, 8, 14, 18],
    r: [12, 22, 6, 6], s: [16, 26, 22, 42],
    u: [6, 22, 12, 6], v: [16, 6, 22, 22]
  };
  const layout = {
    A: 'abcefg', B: 'abcdghi', C: 'adef', D: 'abcdhi', E: 'adefg',
    F: 'aefg', G: 'acdefg', H: 'bcefg', I: 'hi', J: 'bcde',
    K: 'efkm', L: 'def', M: 'abcefn', N: 'bcefj', O: 'abcdef',
    P: 'abefg', Q: 'abcdefm', R: 'abefgm', S: 'acdfg', T: 'ahi',
    U: 'bcdef', V: 'frl', W: 'bcdefi', X: 'rklm', Y: 'rki', Z: 'akld',
    '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg',
    '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg',
    А: 'abcefg', Б: 'acdefg', В: 'abcdghi', Г: 'aef', Д: '',
    Е: 'adefg', Ё: 'adefg', Ж: 'hirklm', З: 'abcdg', И: 'bcefkl',
    Й: 'bcefkl', К: 'efkm', Л: '', М: 'abcefn', Н: 'bcefg',
    О: 'abcdef', П: 'abcef', Р: 'abefg', С: 'adef', Т: 'ahi',
    У: 'rkl', Ф: 'abfghi', Х: 'rklm', Ц: 'bcdef', Ч: 'bcfg',
    Ш: 'bcdefhi', Щ: 'bcdefhi', Ъ: 'acdeg', Ы: 'cdefg', Ь: 'cdefg',
    Э: 'abcdg', Ю: 'abcdefhi', Я: 'abcfgl'
  };
  const polygons = {};
  function slant(point) { return [point[0] + (44 - point[1]) * SLANT, point[1]]; }
  // Hexagonal stroke: pointed cap, two parallel long edges, pointed cap.
  function stroke(x1, y1, x2, y2, thickness = 3.2) {
    const length = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / length, uy = (y2 - y1) / length;
    const nx = -uy * thickness / 2, ny = ux * thickness / 2;
    const cap = Math.min(1.8, length / 3);
    return [
      [x1, y1], [x1 + ux * cap + nx, y1 + uy * cap + ny],
      [x2 - ux * cap + nx, y2 - uy * cap + ny], [x2, y2],
      [x2 - ux * cap - nx, y2 - uy * cap - ny],
      [x1 + ux * cap - nx, y1 + uy * cap - ny]
    ].map(slant);
  }
  function add(ch, ...coords) { polygons[ch].push(stroke(...coords)); }
  for (const [ch, names] of Object.entries(layout)) {
    polygons[ch] = [...names].map(name => stroke(...lines[name]));
  }
  for (const ch of ['K', 'К']) {
    polygons[ch] = [stroke(...lines.e), stroke(...lines.f),
      stroke(6, 22, 22, 6), stroke(6, 26, 22, 42)];
  }
  // Remaining Cyrillic forms use this same stroke thickness and pointed caps.
  add('Л', 4, 42, 12, 5); add('Л', 13, 4, 23, 4); add('Л', 24, 6, 24, 42);
  polygons['Д'] = polygons['Л'].map(p => p.map(v => v.slice()));
  add('Д', 3, 44, 25, 44);
  for (const ch of ['Д', 'Ц', 'Щ']) {
    if (ch === 'Д') add(ch, 4, 45, 4, 50);
    add(ch, 24, 45, 24, 50);
  }
  add('Ё', 8, 0.5, 8, 1.8, 2.5); add('Ё', 20, 0.5, 20, 1.8, 2.5);
  add('Й', 9, 0.5, 19, 0.5, 2);
  // A narrow left stem distinguishes Ю from a plain display O.
  polygons['Ю'] = [];
  for (const [x1, y1, x2, y2] of [
    [3, 6, 3, 22], [3, 26, 3, 42], [4, 24, 10, 24],
    [12, 4, 23, 4], [11, 6, 11, 22], [11, 26, 11, 42],
    [24, 6, 24, 22], [24, 26, 24, 42], [12, 44, 23, 44]
  ]) add('Ю', x1, y1, x2, y2);
  polygons['Ы'] = [];
  for (const coords of [[4, 6, 4, 22], [4, 26, 4, 42], [5, 24, 14, 24],
    [15, 26, 15, 42], [5, 44, 14, 44], [24, 6, 24, 22], [24, 26, 24, 42]]) add('Ы', ...coords);
  // Latin V has two continuous inward legs, keeping U and V distinct.
  polygons.V = [stroke(4, 5, 13, 43), stroke(24, 5, 15, 43)];
  // Printable punctuation is drawn rather than falling back to another font.
  const marks = {
    '.': [[14, 41, 14, 44]], ',': [[15, 40, 12, 46]],
    ':': [[14, 14, 14, 17], [14, 35, 14, 38]],
    ';': [[14, 14, 14, 17], [15, 37, 12, 44]],
    '!': [[14, 5, 14, 32], [14, 40, 14, 44]],
    '?': [[7, 5, 22, 5], [24, 7, 24, 20], [22, 22, 14, 26], [14, 27, 14, 33], [14, 41, 14, 44]],
    '-': [[6, 24, 22, 24]], '+': [[6, 24, 22, 24], [14, 15, 14, 33]],
    '=': [[6, 19, 22, 19], [6, 29, 22, 29]],
    '/': [[24, 5, 4, 43]], '\\': [[4, 5, 24, 43]],
    '%': [[24, 5, 4, 43], [7, 7, 7, 13], [21, 35, 21, 41]],
    '(': [[19, 5, 10, 15], [10, 16, 10, 32], [10, 33, 19, 43]],
    ')': [[9, 5, 18, 15], [18, 16, 18, 32], [18, 33, 9, 43]],
    '[': [[10, 5, 21, 5], [9, 7, 9, 41], [10, 43, 21, 43]],
    ']': [[7, 5, 18, 5], [19, 7, 19, 41], [7, 43, 18, 43]],
    '{': [[18, 5, 12, 9], [12, 10, 12, 20], [12, 20, 7, 24], [7, 24, 12, 28], [12, 28, 12, 38], [12, 39, 18, 43]],
    '}': [[10, 5, 16, 9], [16, 10, 16, 20], [16, 20, 21, 24], [21, 24, 16, 28], [16, 28, 16, 38], [16, 39, 10, 43]],
    '<': [[21, 10, 7, 24], [7, 24, 21, 38]],
    '>': [[7, 10, 21, 24], [21, 24, 7, 38]],
    '«': [[13, 12, 5, 24], [5, 24, 13, 36], [23, 12, 15, 24], [15, 24, 23, 36]],
    '»': [[5, 12, 13, 24], [13, 24, 5, 36], [15, 12, 23, 24], [23, 24, 15, 36]],
    '"': [[10, 5, 10, 15], [19, 5, 19, 15]], "'": [[14, 5, 14, 15]],
    '#': [[10, 9, 8, 39], [20, 9, 18, 39], [5, 19, 24, 19], [4, 29, 23, 29]],
    '*': [[14, 11, 14, 37], [5, 17, 23, 31], [5, 31, 23, 17]],
    '_': [[4, 44, 24, 44]], '|': [[14, 5, 14, 43]],
    '~': [[4, 25, 10, 20], [10, 20, 18, 28], [18, 28, 24, 23]],
    '^': [[5, 18, 14, 6], [14, 6, 23, 18]],
    '&': [[22, 43, 7, 14], [7, 14, 12, 5], [12, 5, 20, 10], [20, 10, 5, 34], [5, 34, 9, 43], [9, 43, 22, 29]],
    '@': [[6, 5, 22, 5], [24, 7, 24, 32], [24, 32, 17, 32], [17, 32, 17, 16], [17, 16, 10, 16], [10, 16, 10, 32], [10, 32, 15, 32], [4, 7, 4, 41], [6, 43, 23, 43]]
  };
  for (const [ch, segments] of Object.entries(marks)) polygons[ch] = segments.map(v => stroke(...v));
  polygons['$'] = [...polygons.S, stroke(14, 1, 14, 47, 2)];
  polygons['№'] = [stroke(3, 6, 3, 42), stroke(5, 6, 16, 42), stroke(18, 6, 18, 42),
    stroke(22, 7, 26, 7, 2), stroke(22, 8, 22, 17, 2), stroke(26, 8, 26, 17, 2), stroke(22, 18, 26, 18, 2), stroke(21, 24, 27, 24, 2)];
  polygons[' '] = [];
  // Lowercase is a deliberate small-cap adaptation, not an inferred original.
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ') {
    polygons[ch.toLowerCase()] = polygons[ch];
  }
  function inside(x, y, polygon) {
    let hit = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  }
  const masks = {}, descend = {}, rasterParts = new Map();
  function rasterPart(polygon) {
    const key = JSON.stringify(polygon);
    if (!rasterParts.has(key)) {
      rasterParts.set(key, Array.from({length: HEIGHT + 4}, (_, y) =>
        Array.from({length: WIDTH}, (_, x) => inside(x + 0.5, y + 0.5, polygon))));
    }
    return rasterParts.get(key);
  }
  for (const [ch, parts] of Object.entries(polygons)) {
    const tail = 'ДЦЩдцщ'.includes(ch) ? 4 : 0;
    if (tail) descend[ch] = tail;
    const rasters = parts.map(rasterPart);
    masks[ch] = Array.from({length: HEIGHT + tail}, (_, y) =>
      Array.from({length: WIDTH}, (_, x) => rasters.some(p => p[y][x]) ? '1' : '0').join(''));
  }
  const font = {
    id: 'kraftwerk-segment', label: 'Kraftwerk · Сегмент', box: WIDTH, cellAspect: 1,
    masks, descend,
    source: 'Own procedural beveled segments; MUSIC NON STOP visual reference',
    description: 'Сегментное начертание по кадрам MUSIC NON STOP: собственная геометрия, латиница, цифры, знаки и авторская кириллица. Строчные повторяют прописные. Не установленный оригинальный шрифт. Для вида как на кадре выберите квадратную сетку. Клетки можно править; изменения сохраняются отдельно.'
  };
  (window.AzbukImportedFonts ||= []).push(font);
  // Source-only reference generator. Uses the same polygons as the editable masks.
  window.AzbukKraftwerkSegment = {
    polygons,
    referenceSVG() {
      const samples = ['MUSIC NON STOP', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', '0123456789'];
      const scale = 2, pitch = 36, margin = 20, line = 65;
      const width = margin * 2 + 33 * pitch * scale, height = margin * 2 + samples.length * line * scale;
      const groups = samples.map((text, row) => [...text].map((ch, col) =>
        '<g transform="translate(' + (margin + col * pitch * scale) + ' ' + (margin + row * line * scale) + ') scale(' + scale + ')">' +
        polygons[ch].map(p => '<polygon points="' + p.map(v => v.join(',')).join(' ') + '"/>').join('') + '</g>').join('')).join('');
      return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '"><title>Kraftwerk · Сегмент — собственная геометрия по кадру, авторское дополнение алфавита</title><rect width="100%" height="100%" fill="black"/><g fill="white">' + groups + '</g></svg>';
    }
  };
})();
