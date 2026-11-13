// Generate from the repository root with Sharp installed (or set NODE_PATH).
// node issledovanie/phone-theme/art/build-wallpapers.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const E = require('../../../mayatnik/mayatnik-synthesis-pendulums.js');
const A = require('../../../mayatnik/mayatnik-synthesis-art.js');
const G = require('../../../mayatnik/synthesis-gallery.js');

const root = path.resolve(__dirname, '..');
const width = 1440;
const height = 3200;
const artwork = [
  {
    id: 'meridian', title: 'Северный меридиан', source: 'northern-current', projection: 'orbit',
    description: 'Два потока XOR замыкаются в кольцо вокруг тёмного центра.',
    color: ['#020612', '#16304e'], mono: ['#000000', '#101010', '#535353', '#b2b2b2', '#eeeeee'],
  },
  {
    id: 'fault', title: 'Киноварный разлом', source: 'red-canon', projection: 'fault',
    description: 'Две диагональные ленты из несовпадающих клеток расходятся вдоль разлома.',
    color: ['#110710', '#50203a'], mono: ['#000000', '#181818', '#555555', '#9d9d9d', '#ededed'],
  },
  {
    id: 'crystal', title: 'Ледяная линза', source: 'thin-ice', projection: 'lens',
    description: 'Совпадения AND образуют ступенчатую линзу с зеркальными гранями.',
    color: ['#010c18', '#11394c'], mono: ['#000000', '#101010', '#626262', '#a0a0a0', '#eeeeee'],
  },
  {
    id: 'eight-winds', title: 'Роза восьми ветров', source: 'eight-winds', projection: 'rosette',
    description: 'Восемь секторов раскрывают след Маятника, от свежих клеток до угасающих.',
    color: ['#09051a', '#301947'], mono: ['#070707', '#202020', '#555555', '#bbbbbb', '#f5f5f5'],
  },
  {
    id: 'two-rivers', title: 'Два русла', source: 'two-rivers', projection: 'banks',
    description: 'Объединение встречных полей ложится на светлый фон двумя волнистыми берегами.',
    color: ['#faf0d7', '#d9c39a'], mono: ['#f4f4f4', '#c7c7c7', '#292929', '#555555', '#0b0b0b'],
  },
  {
    id: 'shadow', title: 'Тень конуса', source: 'shadow-of-cone', projection: 'monolith',
    description: 'Вычитание конуса открывает ступенчатые прорези в двух гранях.',
    color: ['#140807', '#482517'], mono: ['#000000', '#151515', '#575757', '#a2a2a2', '#efefef'],
  },
];

const r = value => Math.round(value * 10) / 10;
const point = ([x,y]) => r(x) + ' ' + r(y);
const polygon = points => 'M' + points.map(point).join('L') + 'Z';
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
function mix(first, last, amount) {
  const end = rgb(last);
  return '#' + rgb(first).map((n, i) => Math.round(n + (end[i] - n) * amount)
    .toString(16).padStart(2, '0')).join('');
}
const orbit = (cx, cy, angle, rx, ry) => [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry];

const projections = {
  orbit: (u, v) => orbit(360, 965, (u - .25) * Math.PI * 2, 163 + v * 155, 260 + v * 235),
  fault: (u, v, face) => face === 0
    ? [735 - 825 * u - 66 * v + 88 * Math.sin(u * Math.PI), 405 + 1050 * u + 245 * v]
    : [540 - 715 * u + 68 * v + 68 * Math.sin(u * Math.PI), 725 + 870 * u + 170 * v],
  lens: (u, v, face) => {
    const y = 435 + u * 1020;
    const aperture = 315 * Math.pow(Math.sin(Math.PI * u), 1.06);
    return [360 + (face ? -1 : 1) * v * aperture, y + v * aperture * (face ? -.22 : .22)];
  },
  rosette: (u, v, face) => {
    const angle = (face + (u - .5) * .96 * (1 - .29 * v)) * Math.PI / 4 - Math.PI / 2;
    const radius = 47 + 280 * v;
    return orbit(360, 949, angle, radius, radius * 1.65);
  },
  banks: (u, v, face) => {
    const y = 452 + u * 1200;
    const center = 340 + 177 * Math.sin((u - .14) * Math.PI * 1.57) - 60 * u;
    const spread = (15 + 28 * Math.sin(u * Math.PI)) + v * (85 + 120 * Math.sin(u * Math.PI));
    return [center + (face ? 1 : -1) * spread, y + (face ? 1 : -1) * v * 52];
  },
  monolith: (u, v, face) => {
    const taper = Math.min(u * 6, (1 - u) * 6, 1);
    return [355 + (face ? 1 : -1) * (241 + 25 * Math.sin(u * Math.PI)) * v * taper,
      437 + 1045 * u + (face ? 92 : -110) * v * taper];
  },
};

function colors(work, source, variant) {
  if (variant === 'mono') {
    const [ground, halo, a, b, both] = work.mono;
    return { ground, halo, a, b, both, echo: mix(ground, a, .72) };
  }
  const [ground, halo] = work.color;
  const {a, b, both, echo} = A.palettes.find(palette => palette.id === source.palette);
  return { ground, halo, a, b, both, echo };
}

function composition(work, frame, palette) {
  const project = projections[work.projection];
  const groups = new Map();
  const faces = work.projection === 'rosette' ? 8 : work.projection === 'orbit' ? 1 : 2;
  const w = frame.width;
  const h = frame.height;
  const uniqueFaces = work.projection === 'rosette' ? 2 : faces;
  let xmin = w;
  let xmax = 0;
  for (let i = 0; i < frame.output.length; i++) {
    if (frame.output[i] !== 1) continue;
    xmin = Math.min(xmin, i % w);
    xmax = Math.max(xmax, i % w);
  }
  for (let face = 0; face < uniqueFaces; face++) {
    for (let y = 0; y < h; y++) {
      for (let x = xmin; x <= xmax; x++) {
        const i = y * w + x;
        if (frame.output[i] !== 1) continue;
        const v = y / h;
        const u = (x - xmin) / (xmax - xmin + 1);
        const a = frame.a[i] === 1;
        const b = frame.b[i] === 1;
        const layer = frame.age[i] ? 'echo' : a ? (b ? 'both' : 'a') : b ? 'b' : 'echo';
        const slot = face % 2 && layer === 'a' ? 'b' : face % 2 && layer === 'b' ? 'a' : layer;
        const lit = .5 + .5 * Math.cos((v * .83 + u * .37 + face * .15) * Math.PI * 2);
        const strength = .24 + .65 * lit + (frame.changed[i] === 1 ? .08 : 0);
        const fill = mix(palette.ground, palette[slot], Math.round(strength * 7) / 7);
        const key = face + ':' + fill;
        const du = (work.projection === 'rosette' ? .97 : .93) / (xmax - xmin + 1);
        const dv = .91 / h;
        const corners = [project(u, v, face), project(u + du, v, face),
          project(u + du, v + dv, face), project(u, v + dv, face)];
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(polygon(corners));
      }
    }
  }
  return {groups, project, faces, xmin, xmax};
}

function outlines(work, art, palette) {
  const paths = [];
  const line = (coords, stroke, thickness) =>
    '<path d="M' + coords.map(point).join('L') + '" fill="none" stroke="' + stroke +
    '" stroke-width="' + thickness + '"/>';
  const guide = mix(palette.ground, palette.a, .24);
  const bright = mix(palette.ground, palette.b, .39);
  for (let face = 0; face < art.faces; face++) {
    for (const v of [0, 1]) {
      const coords = Array.from({length: 181}, (_, i) => art.project(i / 180, v, face));
      paths.push(line(coords, v ? guide : bright, v ? .7 : 1));
    }
  }
  if (work.projection === 'orbit') {
    for (const [rx, ry] of [[152, 241], [148, 235], [330, 511], [336, 521]]) {
      paths.push('<ellipse cx="360" cy="965" rx="' + rx + '" ry="' + ry + '" fill="none" stroke="' + guide + '" stroke-width=".7"/>');
    }
    for (let i = 0; i < 72; i++) {
      const angle = i * Math.PI / 36;
      const length = i % 6 === 0 ? 9 : 4;
      paths.push(line([orbit(360, 965, angle, 343, 535), orbit(360, 965, angle, 343 + length, 535 + length)], guide, 1));
    }
  }
  return paths.join('\n');
}

function cells(work, art) {
  const faces = [[], []];
  for (const [key, paths] of art.groups) {
    const [face, fill] = key.split(':');
    faces[face].push('<path fill="' + fill + '" d="' + paths.join('') + '"/>');
  }
  if (work.projection !== 'rosette') return {definitions: '', scene: faces.flat().join('\n')};

  // Draw two source sectors once. Reuse them after rotation in elliptical coordinates.
  const definitions = faces.map((paths, face) => '<g id="sector-' + face + '">' + paths.join('\n') + '</g>').join('\n');
  const scene = Array.from({length: art.faces}, (_, face) =>
    '<use href="#sector-' + face % 2 + '" transform="translate(360 949) scale(1 1.65) rotate(' +
    (face - face % 2) * 45 + ') scale(1 .606060606) translate(-360 -949)"/>').join('\n');
  return {definitions, scene};
}

function vector(work, frame, palette, recipe) {
  const art = composition(work, frame, palette);
  const outer = mix(palette.ground, palette.halo, .16);
  const {definitions, scene} = cells(work, art);
  recipe.sourceColumns = [art.xmin, art.xmax];
  const meta = JSON.stringify(recipe).replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 720 1600">',
    '<metadata>' + meta + '</metadata>',
    '<defs><radialGradient id="halo" cx="50%" cy="59%" rx="60%" r="66%">',
    '<stop stop-color="' + palette.halo + '"/><stop offset=".73" stop-color="' + outer + '"/>',
    '<stop offset="1" stop-color="' + palette.ground + '"/></radialGradient>',
    '<linearGradient id="clock" x2="0" y2="1" gradientUnits="objectBoundingBox">',
    '<stop offset=".12" stop-color="' + palette.ground + '"/>',
    '<stop offset=".96" stop-color="' + palette.ground + '" stop-opacity="0"/></linearGradient>' + definitions + '</defs>',
    '<rect width="720" height="1600" fill="url(#halo)"/>',
    '<rect width="720" height="440" fill="url(#clock)"/>',
    '<g id="guides">' + outlines(work, art, palette) + '</g>',
    '<g id="pendulum-bits">' + scene + '</g>',
    '</svg>\n',
  ].join('\n');
}

async function main() {
  const wallpapers = [];
  const previews = [];
  const options = {compressionLevel: 9, adaptiveFiltering: true};
  for (const work of artwork) {
    const source = G.works.find(entry => entry.id === work.source);
    const frame = G.engineFor(E, source);
    for (const variant of ['color', 'mono']) {
      const id = work.id + '-' + variant;
      const palette = colors(work, source, variant);
      const recipe = {
        atlas: source.id, recipe: source.recipe, tick: frame.tick, projection: work.projection,
        width: frame.width, height: frame.height, anchor: frame.anchor, options: frame.options,
        palette, renderer: 'art/build-wallpapers.cjs',
      };
      const svg = 'art/' + id + '.svg';
      const src = 'wallpapers/' + id + '.png';
      const thumb = 'wallpapers/' + id + '-thumb.png';
      const image = vector(work, frame, palette, recipe);
      fs.writeFileSync(path.join(root, svg), image);
      const full = path.join(root, src);
      await sharp(Buffer.from(image)).removeAlpha().png(options).toFile(full);
      await sharp(full).resize(360, 800).png(options).toFile(path.join(root, thumb));

      const rendered = await sharp(full).raw().toBuffer({resolveWithObject: true});
      assert.deepEqual([rendered.info.width, rendered.info.height, rendered.info.channels], [width, height, 3]);
      const mini = await sharp(path.join(root, thumb)).metadata();
      assert.deepEqual([mini.width, mini.height], [360, 800]);
      if (variant === 'mono') {
        const data = rendered.data;
        assert(data.every((value, i) => i % 3 === 0 || value === data[i - i % 3]), id + ' has tinted pixels');
      }
      const tile = await sharp(path.join(root, thumb)).resize(160, 356).png().toBuffer();
      previews.push({input: tile, left: 12 + (wallpapers.length >> 1) * 170, top: variant === 'mono' ? 382 : 12});
      wallpapers.push({id, title: work.title, variant, description: work.description, src, thumb, svg, width, height, recipe});
      console.log(id + ': ' + fs.statSync(full).size + ' bytes');
    }
  }
  fs.writeFileSync(path.join(root, 'wallpapers.json'), JSON.stringify({wallpapers}, null, 2) + '\n');
  await sharp({create: {width: 1034, height: 750, channels: 3, background: '#18191d'}})
    .composite(previews).jpeg({quality: 93}).toFile(path.join(__dirname, 'contact-sheet.jpg'));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

