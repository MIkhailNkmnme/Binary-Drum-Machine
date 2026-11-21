// Run with Node to rebuild the journal emblem from the linked Mayatnik scene.
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { inflateRawSync } = require('node:zlib');
const Core = require('../../mayatnik/mayatnik-core.js');
const Construction = require('../../mayatnik/mayatnik-construction.js');
const { encoder } = require('../../mayatnik/mayatnik-gif.js');

const page = readFileSync(join(__dirname, 'index.html'), 'utf8');
const source = /class="intro-motif" href="[^"]*#s=1\.([A-Za-z0-9_-]+)"/.exec(page);
if (!source) throw Error('Нет ссылки на сцену знака XORoXORиус.');
const scene = JSON.parse(inflateRawSync(Buffer.from(source[1], 'base64url')));
const { state } = scene;
const [template] = JSON.parse(scene.templateScene).templates;
const { mask, axis } = template.parts[0];
const geometry = Construction.geometry(state);
const field = Core.field(geometry.W, state.rows, state.bg, geometry.anchor);
Construction.initial(field, geometry, state);
for (let step = 0; step < scene.k; step++) Construction.step(field, geometry, state, step);

// The scene's screenshot shows its three colours at 75% over black.
function shade(hex) {
  return [1, 3, 5].map(offset => Math.floor(parseInt(hex.slice(offset, offset + 2), 16) * 0.75));
}
const palette = [shade(state.bitZeroColour), shade(state.bitOneColour), shade(template.hex)];
const backdrop = [16, 19, 23];
const rows = 26;
const cols = 2 * rows + 2;
const unit = 6;
const width = cols * unit;
const height = (rows + 2) * unit;
const left = geometry.anchor - rows - 1;
const maskLeft = geometry.anchor + mask.x - axis - left;
const maskPixels = Buffer.from(mask.data.data, 'base64url');
const gif = encoder(width, height);

// The triangular field stays fixed. Only the complete red mask rotates.
const fieldBits = new Int8Array(cols * rows).fill(-1);
for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    const fieldCol = left + col;
    if (fieldCol >= geometry.anchor - row - 1 && fieldCol <= geometry.anchor + row) {
      fieldBits[row * cols + col] = field.val[row * field.W + fieldCol];
    }
  }
}

const pivotX = maskLeft + mask.width / 2;
const pivotY = mask.y + mask.height / 2;
const trail = new Uint8Array(cols * rows);
const turns = 48;

function rotatedMask(angle) {
  const cells = new Uint8Array(cols * rows);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const dx = col + 0.5 - pivotX;
      const dy = row + 0.5 - pivotY;
      const sx = Math.floor(dx * cos + dy * sin + mask.width / 2);
      const sy = Math.floor(-dx * sin + dy * cos + mask.height / 2);
      if (sx >= 0 && sx < mask.width && sy >= 0 && sy < mask.height) {
        cells[row * cols + col] = Number(maskPixels.readUInt32LE(4 * (sy * mask.width + sx)) !== 0);
      }
    }
  }
  return cells;
}

function render(cells, delay) {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = Math.floor(y / unit) - 1;
    for (let x = 0; x < width; x++) {
      const cell = row * cols + Math.floor(x / unit);
      const bit = trail[cell] ? 1 : fieldBits[cell];
      const colour = cells[cell] ? palette[2] : palette[bit] || backdrop;
      const pixel = 4 * (y * width + x);
      pixels.set(colour, pixel);
      pixels[pixel + 3] = 255;
    }
  }
  gif.add(pixels, delay);
}

const original = rotatedMask(0);
let previous = original;
render(original, 35);
for (let frame = 1; frame <= turns; frame++) {
  const cells = frame === turns ? original : rotatedMask(frame * 2 * Math.PI / turns);
  for (let cell = 0; cell < cells.length; cell++) {
    // A vacated blue zero becomes its yellow anti-bit. Yellow ones stay yellow.
    if (previous[cell] && !cells[cell] && fieldBits[cell] === 0) trail[cell] = 1;
  }
  render(cells, frame === turns ? 62 : 5);
  previous = cells;
}

gif.finish().arrayBuffer().then(data => {
  writeFileSync(join(__dirname, 'xoroxorius-flip.gif'), Buffer.from(data));
}).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
