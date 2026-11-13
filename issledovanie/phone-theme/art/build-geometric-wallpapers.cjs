// Run with Node and Sharp: node issledovanie/phone-theme/art/build-geometric-wallpapers.cjs
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const Pend = require('../../../mayatnik/mayatnik-synthesis-pendulums.js');
const Anim = require('../../../mayatnik/mayatnik-animatrix-source.js');
const AnimCore = require('../../../mayatnik/mayatnik-animatrix-core.js');

const root = path.resolve(__dirname, '..');
const width = 1440;
const height = 3200;
const viewWidth = 720;
const viewHeight = 1600;
const categories = ['sierpinski', 'animatrix', 'pendulums', 'rhombi', 'rgb'];
const clamp = (value, lower, upper) => Math.min(upper, Math.max(lower, value));
const rounded = n => Math.round(n * 1000) / 1000;
const sha = data => createHash('sha256').update(Buffer.from(data)).digest('hex');
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + rgb(a).map((value, i) => Math.round(value + t * (rgb(b)[i] - value))
  .toString(16).padStart(2, '0')).join('');
const svgPath = (coords, close = false) => 'M' + coords.map(pair => pair.map(rounded).join(' ')).join('L') + (close ? 'Z' : '');
const line = (points, stroke, opacity = 1, strokeWidth = 1) =>
  '<path d="' + svgPath(points) + '" fill="none" stroke="' + stroke +
  '" stroke-width="' + strokeWidth + '" opacity="' + opacity + '"/>';
const shaData = (field, extra = {}) => ({
  width: field.width, height: field.height, sha256: sha(field.bits),
  encoding: 'row-major uint8, 255=absent, 0=zero, 1=one', ...extra,
});

function rule90(rows, seeds = [0], w = rows * 2 - 1) {
  const bits = new Uint8Array(w * rows);
  const anchor = (w - 1) / 2;
  for (const x of seeds) bits[x + anchor] ^= 1;
  for (let y = 1; y < rows; y++) {
    const previous = (y - 1) * w;
    for (let x = 0; x < w; x++) {
      const left = x === 0 ? 0 : bits[previous + x - 1];
      const right = x === w - 1 ? 0 : bits[previous + x + 1];
      bits[y * w + x] = left ^ right;
    }
  }
  return {width: w, height: rows, bits, source: {rule: 90, equation: 'left XOR right', seeds, anchor, boundary: 'zero'}};
}

function asBytes(values) {
  return Uint8Array.from(values, value => value < 0 ? 255 : value);
}

function pendulum(h, w, tick, options) {
  const field = Pend.create({width: w, height: h, options});
  for (let frame = 0; frame < tick; frame++) field.step();
  return {
    width: w, height: h, bits: asBytes(field.output),
    a: asBytes(field.a), b: asBytes(field.b), age: field.age,
    source: {module: 'mayatnik/mayatnik-synthesis-pendulums.js', tick, options: field.options,
      anchor: field.anchor, sha256A: sha(asBytes(field.a)), sha256B: sha(asBytes(field.b))},
  };
}

function animatrix(rows, kind, algorithm, frameNumber, overrides = {}) {
  const state = {...Anim.defaults(), rows, animatrixOn: true, animatrixTiming: 'rows',
    animatrixDirection: 'down', animatrixCycles: 4, animatrixAlgorithm: algorithm,
    animatrixSource: Anim.demo(rows, kind, algorithm), ...overrides};
  const engine = Anim.create(state);
  const before = AnimCore.snapshot(engine);
  Anim.advance(engine, frameNumber);
  assert.equal(engine.sourceFrame, frameNumber);
  const after = AnimCore.snapshot(engine);
  const bitsFor = snapshot => Uint8Array.from(snapshot.bits, (value, i) => snapshot.present[i] ? value : 255);
  return {
    width: after.width, height: after.height, bits: bitsFor(after), initial: bitsFor(before),
    source: {modules: ['mayatnik/mayatnik-animatrix-source.js', 'mayatnik/mayatnik-animatrix-core.js'],
      seed: {factory: 'MayatnikAnimatrixSource.demo', rows, type: kind, algorithm}, sourceFrame: frameNumber,
      cycleFrames: Anim.cycleFrames(state), sha256Seed: sha(bitsFor(before)),
      options: Object.fromEntries(Object.entries(state).filter(([key]) => key.startsWith('animatrix') && key !== 'animatrixSource'))},
  };
}

const sources = {
  sierpinski: [
    rule90(32),
    rule90(64),
    rule90(78, [-36, 0, 36], 225),
  ],
  animatrix: [
    animatrix(48, 'clean', 'copyRows', 47, {animatrixCopyRowsLayout: 'mirrorGaps'}),
    animatrix(64, 'example', 'two', 110),
    animatrix(64, 'clean', 'excelTrianglePend', 75, {animatrixExcelDepth: 64}),
  ],
  pendulums: [
    pendulum(64, 169, 49, {sourceA: 'pend', sourceB: 'pendR', depth: 64, transformB: 'mirrorY', shiftX: 19}),
    pendulum(64, 175, 62, {sourceA: 'left', sourceB: 'right', depth: 64, transformB: 'rotate180', shiftX: 20, operation: 'or'}),
    pendulum(64, 183, 59, {sourceA: 'pend', sourceB: 'pair', depth: 64, phaseB: 13, delayB: 5, transformB: 'mirrorY',
      shiftX: -34, operation: 'xor', history: 'trail', trailLength: 8}),
  ],
  rhombi: [rule90(32), rule90(48, [-6, 0, 6], 109), rule90(64)],
};

function fieldPaths(field, shape, paint) {
  const groups = new Map();
  for (let y = 0; y < field.height; y++) {
    for (let x = 0; x < field.width; x++) {
      const i = y * field.width + x;
      const fill = paint(i, x, y);
      if (!fill) continue;
      let mark;
      if (shape === 'triangle') {
        mark = svgPath([[x, y], [x - .98, y + .97], [x + .98, y + .97]], true);
      } else if (shape === 'diamond') {
        mark = svgPath([[x, y + .03], [x + .89, y + .5], [x, y + .97], [x - .89, y + .5]], true);
      } else if (shape === 'squares') {
        mark = 'M' + (x + .06) + ' ' + (y + .06) + 'h.88v.88h-.88Z';
      } else {
        mark = 'M' + x + ' ' + y + 'h1v1h-1Z';
      }
      if (!groups.has(fill)) groups.set(fill, []);
      groups.get(fill).push(mark);
    }
  }
  return [...groups].map(([fill, marks]) => '<path fill="' + fill + '" d="' + marks.join('') + '"/>').join('\n');
}

const rowStep = (y, n, levels = 4) => Math.min(levels - 1, Math.floor(y * levels / n));
const rowTint = (stops, y, n) => stops[rowStep(y, n, stops.length)];
const parts = (field, shape, colors, transforms, mode) => transforms.map((transform, face) => {
  const paint = (i, x, y) => {
    const value = field.bits[i];
    if (mode === 'animatrix') {
      const previous = field.initial[i];
      if (value === 1 && previous !== 1) return colors[face % colors.length][0];
      if (value === 1) return colors[face % colors.length][1];
      if (previous === 1) return colors[face % colors.length][2];
      if (value === 0) return colors[face % colors.length][3];
      return null;
    }
    if (value !== 1) return null;
    if (mode === 'pendulums') {
      if (field.age[i]) return colors[face % colors.length][4 + Number(field.age[i] > 3)];
      const a = field.a[i] === 1;
      const b = field.b[i] === 1;
      return colors[face % colors.length][a ? (b ? 2 : 0) : b ? 1 : 3];
    }
    return rowTint(colors[face % colors.length], y, field.height);
  };
  return '<g transform="' + transform + '">' + fieldPaths(field, shape, paint) + '</g>';
}).join('\n');

function plot(field, {x, y, w, h, flipX = false, flipY = false}) {
  const sx = rounded(w / field.width);
  const sy = rounded(h / field.height);
  return 'translate(' + [x + (flipX ? w : 0), y + (flipY ? h : 0)].join(' ') + ') scale(' +
    [flipX ? -sx : sx, flipY ? -sy : sy].join(' ') + ')';
}

const rect = (x,y,w,h,fill,opacity = 1) => '<rect x="' + x + '" y="' + y + '" width="' + w +
  '" height="' + h + '" fill="' + fill + '" opacity="' + opacity + '"/>';
const ring = (x,y,rx,ry,stroke,opacity = 1) => '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx +
  '" ry="' + ry + '" fill="none" stroke="' + stroke + '" opacity="' + opacity + '"/>';
const contour = (points, fill, stroke, opacity = 1) => '<path d="' + svgPath(points, true) +
  '" fill="' + fill + '" stroke="' + stroke + '" opacity="' + opacity + '"/>';
const axes = (x, y, w, h, col, n = 16) => {
  const marks = [line([[x, y], [x, y + h], [x + w, y + h]], col, .4)];
  for (let i = 0; i <= n; i++) {
    const yy = y + h * i / n;
    const xx = x + w * i / n;
    const size = i % 4 === 0 ? 12 : 6;
    marks.push(line([[x - size, yy], [x, yy]], col, .44));
    marks.push(line([[xx, y + h], [xx, y + h + size]], col, .44));
  }
  return marks.join('\n');
};

const works = [
  {
    id: 'sierpinski-solar', category: 'sierpinski', index: 0, title: 'Солнечный Серпинский',
    description: 'Единственная единица рождает 32 строки по правилу 90. Каждый бит — XOR двух верхних соседей, цвет меняется по высоте.',
    ground: '#16072a', halo: '#612233', palette: [['#fff68a','#ffe04c','#ffac25','#ff573d','#ed3976']],
    shape: 'triangle', placement: [{x: 65, y: 570, w: 590, h: 674}],
    ornament: () => {
      const loops = [300, 320, 337].map(r => ring(360, 947, r, r * 1.11, '#fca343', .23)).join('\n');
      return loops + contour([[360,547],[665,1267],[55,1267]], '#4f1536', '#faaa51', .63)
        + line([[92,1305],[628,1305]], '#ef713f', .55);
    },
  },
  {
    id: 'sierpinski-electric', category: 'sierpinski', index: 1, title: 'Электрический Серпинский',
    description: 'Один кадр правила 90 повторён дважды. Нижняя копия отражена относительно общей базы, оттенки обеих половин различаются.',
    ground: '#040d29', halo: '#213a70',
    palette: [['#f3ff88','#81f94d','#34f4c9','#23d8ff'], ['#ffffff','#a9a9ff','#6673ff','#3b53fa']],
    shape: 'diamond', placement: [{x: 50,y: 450,w: 620,h: 476},{x: 50,y: 930,w: 620,h: 476,flipY: true}],
    ornament: () => contour([[360,437],[680,928],[360,1421],[40,928]], '#081735', '#1b7eac', .84)
      + line([[35,928],[685,928]], '#59deff', .7),
  },
  {
    id: 'sierpinski-interference', category: 'sierpinski', index: 2, title: 'Серпинский в три голоса',
    description: 'Правило 90 одновременно развивает три единичных затравки. В местах встречи пары единиц взаимно гасятся по XOR.',
    ground: '#26071f', halo: '#823553', palette: [['#6cf8e8','#68eeff','#bb9bff','#ff6fcf','#ff9d95','#ffe787']],
    shape: 'squares', placement: [{x: -30,y: 512,w: 780,h: 825}],
    ornament: () => [520, 791, 1064, 1341].map(y => line([[0,y],[720,y]], '#c86b95', .34)).join('\n')
      + contour([[22,1383],[360,1452],[698,1383]], 'none', '#e66caa', .49),
  },
  {
    id: 'animatrix-gaps', category: 'animatrix', index: 0, title: 'Аниматрица · Пустоты',
    description: 'Режим «Пустоты ↓» отражает строки через межстрочные оси и складывает копии XOR в свободных клетках. Цвет отмечает разницу с исходником.',
    ground: '#071e1b', halo: '#15534e', palette: [['#54ffac','#f8e35e','#ff748c','#174a51']],
    shape: 'diamond', placement: [{x: 47,y: 535,w: 626,h: 732}],
    ornament: () => contour([[360,508],[689,1281],[31,1281]], '#0c282c', '#4caa9e', .9)
      + axes(42,550,636,738,'#86ded1'),
  },
  {
    id: 'animatrix-wave', category: 'animatrix', index: 1, title: 'Аниматрица · Два соседа',
    description: 'Исходник «Пример» проходит 110 шагов построчной волны «Клетки XOR». Цвета различают новые, сохранённые и погасшие единицы. Вторая панель зеркальна.',
    ground: '#13052f', halo: '#4e2866', palette: [['#ff9f2f','#fff376','#fd54b9','#411263'], ['#43eeff','#dafdff','#bb70ff','#211a60']],
    shape: 'squares', placement: [{x: 50,y: 454,w: 620,h: 466},{x: 50,y: 949,w: 620,h: 466,flipX: true,flipY: true}],
    ornament: () => rect(40,448,640,479,'#28113f',.78) + rect(40,943,640,479,'#18123e',.78)
      + line([[28,935],[692,935]], '#bd8fff', .58) + axes(40,454,640,961,'#8d6bb7',24),
  },
  {
    id: 'animatrix-excel', category: 'animatrix', index: 2, title: 'Аниматрица · Excel-маятник',
    description: 'Один бит в середине запускает режим Excel «Треугольник Маятник». В кадре 75 верхняя и нижняя части растут от движущейся вершины.',
    ground: '#070827', halo: '#313c8a', palette: [['#40b4ff','#fff9b3','#ff58ab','#2d214f']],
    shape: 'squares', placement: [{x: 53,y: 503,w: 614,h: 841}],
    ornament: () => axes(44,502,632,844,'#817ef3') + line([[27,922],[693,922]], '#e283ff', .48)
      + line([[360,440],[360,1400]], '#6b8eef', .43),
  },
  {
    id: 'pendulums-duet', category: 'pendulums', index: 0, title: 'Маятники · Зеркальный дуэт',
    description: 'Обычный и обратный маятники встречаются после вертикального отражения и сдвига B. XOR оставляет единицы, присутствующие только в одном поле.',
    ground: '#080c2b', halo: '#303a79', palette: [['#3cf6ff','#ffb02b','#fff68c','#b289ff','#7257e0','#412f9a']],
    shape: 'squares', placement: [{x: -5,y: 562,w: 730,h: 711}],
    ornament: () => contour([[24,541],[695,600],[695,1283],[24,1297]], '#0a1438', '#475aba', .78)
      + axes(25,542,670,755,'#70a9e6'),
  },
  {
    id: 'pendulums-counter', category: 'pendulums', index: 1, title: 'Маятники · Встречный ход',
    description: 'Левая и правая последовательности вершин встречаются после поворота B на 180°. OR сохраняет объединение, совпадения окрашены светлее.',
    ground: '#270a0b', halo: '#6f331e', palette: [['#fa7832','#ff5bb2','#ffe16d','#ffd59a','#98455e','#723e60']],
    shape: 'squares', placement: [{x: 39,y: 501,w: 642,h: 850}],
    ornament: () => contour([[30,485],[690,485],[690,1370],[30,1370]], '#2d151b', '#b36447', .8)
      + line([[30,930],[690,930]], '#fa9051', .57),
  },
  {
    id: 'pendulums-trail', category: 'pendulums', index: 2, title: 'Маятники · Восемь кадров следа',
    description: 'Обычный маятник сравнивается XOR с отражённой и задержанной последовательностью парных вершин. Яркость следа отмечает возраст клетки за восемь кадров.',
    ground: '#0a0928', halo: '#403173', palette: [['#96e4ff','#ff84fd','#fff2a8','#a5aaff','#915cf5','#542db1']],
    shape: 'squares', placement: [{x: 14,y: 518,w: 692,h: 842}],
    ornament: () => axes(16,521,688,839,'#9d75ef',20) + contour([[39,1356],[360,1424],[681,1356]], 'none', '#9c64de', .6),
  },
  {
    id: 'rhombi-aurora', category: 'rhombi', index: 0, title: 'Ромбы · Полярный свет',
    description: 'Четыре копии треугольника Серпинского образуют два ромба. Каждая пара зеркальна по горизонтальному стыку.',
    ground: '#081f24', halo: '#26587d', palette: [['#f7ff9d','#b2ff76','#62ffb4','#34e4d5'], ['#e6eaff','#9cbbff','#8375ff','#6135ed'],
      ['#81ffd4','#59ddf8','#57acff','#6183ff'], ['#fff49d','#ffd76a','#ff9967','#ff6985']],
    shape: 'triangle', placement: [{x: 65,y: 466,w: 590,h: 316},{x: 65,y: 782,w: 590,h: 316,flipY: true},
      {x: 155,y: 1000,w: 410,h: 224},{x: 155,y: 1224,w: 410,h: 224,flipY: true}],
    ornament: () => contour([[360,451],[666,781],[360,1111],[54,781]], '#0d313a', '#4a9bb4', .83)
      + contour([[360,987],[578,1224],[360,1461],[142,1224]], '#102843', '#6565b7', .83),
  },
  {
    id: 'rhombi-mosaic', category: 'rhombi', index: 1, title: 'Ромбы · Плитка XOR',
    description: 'Четыре треугольных поля с тремя затравками правила 90. Отражённые пары образуют два ромба с разной высотой и палитрой.',
    ground: '#220c23', halo: '#6e2854', palette: [['#f4ff77','#ffbf4c','#fda344','#ff587a'], ['#ffd09c','#ff75aa','#f54ec1','#b841eb'],
      ['#fff9ad','#a1ec82','#59ecc3','#36cbda'], ['#e2ebff','#baa5ff','#a785ff','#694eff']],
    shape: 'diamond', placement: [{x: -6,y: 540,w: 521,h: 336},{x: -6,y: 876,w: 521,h: 336,flipX: true,flipY: true},
      {x: 206,y: 760,w: 520,h: 327},{x: 206,y: 1087,w: 520,h: 327,flipX: true,flipY: true}],
    ornament: () => contour([[253,522],[513,875],[253,1228],[-7,875]], '#4b2041', '#be5886', .8)
      + contour([[467,746],[727,1088],[467,1430],[207,1088]], '#323451', '#9a77cc', .8),
  },
  {
    id: 'rhombi-axes', category: 'rhombi', index: 2, title: 'Ромбы · Две оси',
    description: 'Повороты и отражения четырёх копий правила 90 сводят их широкие основания к центру. Каждая грань имеет свою палитру.',
    ground: '#0e1334', halo: '#343a83', palette: [['#fff37c','#eaff6b','#a3ff71','#53e1ab'], ['#ffaabd','#fb83d8','#d26ff6','#9a66ff'],
      ['#adf2ff','#59e1ff','#5496ff','#6470ff'], ['#fff2bc','#ffd56a','#ffa050','#ff6c60']],
    shape: 'triangle',
    transforms: ['translate(122 485) scale(3.75 7.7)', 'translate(122 1469) scale(3.75 -7.7)',
      'translate(28 1267) rotate(-90) scale(4.6 5.15)', 'translate(692 687) rotate(90) scale(4.6 5.15)'],
    ornament: () => contour([[360,470],[708,978],[360,1484],[12,978]], '#171e4d', '#667bcc', .8)
      + line([[24,978],[696,978]], '#c8bdff', .35) + line([[360,497],[360,1460]], '#c8bdff', .35),
  },
];


const rgbGrid = {width: 152, height: 208, x: 56, y: 502, scale: 4};
const rgbColors = ['#000000','#ff0000','#00ff00','#ffff00','#0000ff','#ff00ff','#00ffff','#ffffff'];
const triangleRGB = rule90(48);
const sweepRGB = rule90(48, [-10, 0, 10], 121);
const pendRGB = pendulum(48, 135, 39, {sourceA:'pend', sourceB:'pendR', depth: 32, phaseB: 11, shiftX: 3});
const animRGB = sources.animatrix[0];
const colorWork = [
  {
    id: 'rgb-prism', category: 'rgb', title: 'RGB · Призма Серпинского',
    description: 'Три копии правила 90 разнесены по горизонтали и высоте. Красный, зелёный и синий складываются до жёлтого, пурпурного, голубого и белого.',
    ground: '#0b0823', halo: '#302353',
    layers: [
      {field: triangleRGB, poses: [{x: 11,y: 20},{x: 11,y: 98,flipY: true}]},
      {field: triangleRGB, poses: [{x: 27,y: 28},{x: 27,y: 106,flipY: true}]},
      {field: triangleRGB, poses: [{x: 45,y: 20},{x: 45,y: 98,flipY: true}]},
    ],
    ornament: () => contour([[359,469],[685,837],[359,1326],[35,837]], '#120c2a', '#8f63bf', .69)
      + ring(360,846,307,414,'#67429d',.35),
  },
  {
    id: 'rgb-stereo', category: 'rgb', title: 'RGB · Три встречных поля',
    description: 'Каждый канал берёт своё поле. Красный — два маятника XOR, зелёный — отражённые «Пустоты» Аниматрицы, синий — Серпинский с тремя затравками.',
    ground: '#051b2a', halo: '#164861',
    layers: [
      {field: pendRGB, poses: [{x: 0,y: 34},{x: 9,y: 84,flipX: true,flipY: true},{x: 0,y: 125}]},
      {field: animRGB, poses: [{x: 29,y: 19,flipY: true},{x: 30,y: 67},{x: 27,y: 132,flipY: true}]},
      {field: sweepRGB, poses: [{x: 12,y: 23},{x: 12,y: 72,flipY: true},{x: 12,y: 116}]},
    ],
    ornament: () => rect(36,484,648,811,'#072532',.65) + axes(45,484,630,813,'#67bdc2',32),
  },
  {
    id: 'rgb-triad', category: 'rgb', title: 'RGB · Три оси',
    description: 'Три направления одной двоичной маски. Красный канал остаётся вертикальным, зелёный и синий поворачиваются на четверть оборота в разные стороны.',
    ground: '#240713', halo: '#592341',
    layers: [
      {field: sweepRGB, poses: [{x: 12,y: 17},{x: 12,y: 77,flipY: true},{x: 12,y: 137}]},
      {field: sweepRGB, poses: [{x: 34,y: 40,turn: 1},{x: 88,y: 61,turn: 1}]},
      {field: sweepRGB, poses: [{x: 14,y: 61,turn: -1},{x: 66,y: 34,turn: -1}]},
    ],
    ornament: () => ring(360,891,320,451,'#a94472',.62) + ring(360,891,310,437,'#814066',.62)
      + line([[21,891],[699,891]],'#9e4b83',.4) + line([[360,431],[360,1352]],'#9e4b83',.4),
  },
];
works.push(...colorWork);

function overlay(work) {
  const {width: columns, height: rows} = rgbGrid;
  const masks = work.layers.map(({field, poses}) => {
    const mask = new Uint8Array(columns * rows);
    for (const pose of poses) {
      for (let y = 0; y < field.height; y++) {
        for (let x = 0; x < field.width; x++) {
          if (field.bits[y * field.width + x] !== 1) continue;
          const sx = pose.flipX ? field.width - 1 - x : x;
          const sy = pose.flipY ? field.height - 1 - y : y;
          const tx = pose.x + (pose.turn === 1 ? field.height - 1 - sy : pose.turn === -1 ? sy : sx);
          const ty = pose.y + (pose.turn === 1 ? sx : pose.turn === -1 ? field.width - 1 - sx : sy);
          if (tx >= 0 && tx < columns && ty >= 0 && ty < rows) mask[ty * columns + tx] = 1;
        }
      }
    }
    return mask;
  });
  const bits = Uint8Array.from(masks[0], (red, i) => red + 2 * masks[1][i] + 4 * masks[2][i]);
  const counts = Array(8).fill(0);
  for (const value of bits) counts[value]++;
  assert(counts.every(n => n > 0), work.id + ' does not show every RGB combination: ' + counts.join(','));
  const geometry = {bits, width: columns, height: rows};
  const scene = '<g transform="translate(' + rgbGrid.x + ' ' + rgbGrid.y + ') scale(' + rgbGrid.scale + ')">' +
    fieldPaths(geometry, 'solid', i => bits[i] ? rgbColors[bits[i]] : null) + '</g>';
  const recipe = {grid: rgbGrid, equation: '[255R,255G,255B]', masksCombinedBy: 'OR within each channel',
    additiveRgb: rgbColors, counts, sha256: sha(bits), encoding: 'row-major uint8 channel flags R=1, G=2, B=4',
    layers: work.layers.map(({field, poses}, i) => ({channel: 'RGB'[i], source: field.source, field: shaData(field),
      poses, maskSha256: sha(masks[i])}))};
  return {scene, recipe, geometry, masks};
}

function fieldScene(work) {
  const field = sources[work.category][work.index];
  const transforms = work.transforms || work.placement.map(pose => plot(field, pose));
  const scene = parts(field, work.shape, work.palette, transforms, work.category);
  const recipe = {...field.source, field: shaData(field),
    renderer: 'art/build-geometric-wallpapers.cjs', cellShape: work.shape, palette: work.palette,
    placement: work.placement, transforms};
  if (work.category === 'sierpinski' || work.category === 'rhombi') {
    const {seeds, anchor} = field.source;
    // Independent parity oracle: XOR of the corresponding binomial coefficients.
    for (let y = 0; y < field.height; y++) for (let x = 0; x < field.width; x++) {
      const expected = seeds.reduce((bit, seed) => {
        const k = (x - anchor - seed + y) / 2;
        return bit ^ Number(Number.isInteger(k) && k >= 0 && k <= y && (k & (y - k)) === 0);
      }, 0);
      assert.equal(field.bits[y * field.width + x], expected);
    }
    recipe.binomialParityCheck = true;
  }
  return {scene, recipe};
}

function vector(work, scene, recipe) {
  const ground = work.ground;
  const outer = mix(ground, work.halo, .17);
  const metadata = JSON.stringify(recipe).replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 720 1600">',
    '<metadata>' + metadata + '</metadata>',
    '<defs><radialGradient id="ambient" cx=".5" cy=".61" r=".64">',
    '<stop stop-color="' + work.halo + '"/><stop offset=".63" stop-color="' + outer + '"/>',
    '<stop offset="1" stop-color="' + ground + '"/></radialGradient></defs>',
    rect(0,0,viewWidth,viewHeight,'url(#ambient)'),
    '<g id="guides">' + work.ornament() + '</g>',
    '<g id="cells">' + scene + '</g>',
    '</svg>\n',
  ].join('\n');
}

function readPixel(data, x, y) {
  const i = (y * width + x) * 3;
  return [data[i], data[i + 1], data[i + 2]];
}

function validate(work, rendered, composition) {
  assert.deepEqual([rendered.info.width, rendered.info.height, rendered.info.channels], [width, height, 3]);
  const report = {width, height, thumbWidth: 360, thumbHeight: 800};
  if (composition.masks) {
    const {x, y, scale, width: columns, height: rows} = rgbGrid;
    let verified = 0;
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
      const offset = j * columns + i;
      const channels = composition.masks.map(mask => mask[offset] * 255);
      if (!channels.some(Boolean)) continue;
      const actual = readPixel(rendered.data, 2 * (x + (i + .5) * scale), 2 * (y + (j + .5) * scale));
      assert.deepEqual(actual, channels, work.id + ' RGB cell ' + i + ',' + j);
      verified++;
    }
    report.rgbCellCentersMatched = verified;
    report.rgbCombinations = composition.recipe.counts;
  }
  let topQuarterMaxLuma = 0;
  for (let i = 0; i < 800 * width * 3; i += 3) {
    const data = rendered.data;
    const luma = (2126 * data[i] + 7152 * data[i + 1] + 722 * data[i + 2]) / 10_000;
    topQuarterMaxLuma = Math.max(topQuarterMaxLuma, luma);
  }
  assert(topQuarterMaxLuma < 48, work.id + ' has bright detail over the clock area');
  report.topQuarterMaxLuma = rounded(topQuarterMaxLuma);
  return report;
}

async function main() {
  const wallpapers = [];
  const entries = [];
  const tiles = [];
  const options = {compressionLevel: 9, adaptiveFiltering: true};
  assert.deepEqual(categories.map(category => works.filter(work => work.category === category).length), [3,3,3,3,3]);
  for (const [i, work] of works.entries()) {
    const id = 'geometric-' + work.id;
    const composition = work.category === 'rgb' ? overlay(work) : fieldScene(work);
    const {scene, recipe} = composition;
    recipe.background = {ground: work.ground, halo: work.halo};
    recipe.interaction = work.description;
    const src = 'wallpapers/' + id + '.png';
    const thumb = 'wallpapers/' + id + '-thumb.png';
    const svg = 'art/' + id + '.svg';
    const full = path.join(root, src);
    const thumbnail = path.join(root, thumb);
    const markup = vector(work, scene, recipe);
    fs.writeFileSync(path.join(root, svg), markup);
    await sharp(Buffer.from(markup)).removeAlpha().png(options).toFile(full);
    await sharp(full).resize(360, 800).png(options).toFile(thumbnail);
    const size = await sharp(thumbnail).metadata();
    assert.deepEqual([size.width, size.height], [360, 800]);
    const report = validate(work, await sharp(full).raw().toBuffer({resolveWithObject: true}), composition);
    entries.push({id, category: work.category, ...report,
      pngSha256: sha(fs.readFileSync(full)), thumbSha256: sha(fs.readFileSync(thumbnail)), svgSha256: sha(markup)});
    wallpapers.push({id, title: work.title, variant: 'color', category: work.category, description: work.description,
      src, thumb, svg, width, height, recipe});
    const tile = await sharp(thumbnail).resize(115, 256).png().toBuffer();
    tiles.push({input: tile, left: 9 + Math.floor(i / 3) * 125, top: 9 + (i % 3) * 266});
    console.log(id + ' · ' + fs.statSync(full).size + ' bytes');
  }
  assert.equal(new Set(wallpapers.map(work => work.id)).size, 15);
  fs.writeFileSync(path.join(root,'wallpapers-geometric.json'), JSON.stringify({wallpapers},null,2) + '\n');
  fs.writeFileSync(path.join(__dirname,'geometric-checks.json'), JSON.stringify({count: 15, entries},null,2) + '\n');
  await sharp({create: {width: 633, height: 806, channels: 3, background: '#181a25'}})
    .composite(tiles).jpeg({quality: 94}).toFile(path.join(__dirname,'geometric-contact-sheet.jpg'));
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

