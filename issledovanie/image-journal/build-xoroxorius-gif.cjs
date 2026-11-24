// Run with Node to rebuild the GIF and its pausable frame strip from the linked scene.
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { inflateRawSync } = require('node:zlib');
const Core = require('../../mayatnik/mayatnik-core.js');
const Construction = require('../../mayatnik/mayatnik-construction.js');
const { encoder } = require('../../mayatnik/mayatnik-gif.js');

const page = readFileSync(join(__dirname, 'index.html'), 'utf8');
const source = /class="intro-motif-link" href="[^"]*#s=1\.([A-Za-z0-9_-]+)"/.exec(page);
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

const maskSize = mask.width * mask.height;
const poseDelay = 85;
const edgeDelay = 18;

function render(turned, showFigure) {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = Math.floor(y / unit) - 1;
    for (let x = 0; x < width; x++) {
      const col = Math.floor(x / unit);
      const bit = fieldBits[row * cols + col];
      let colour = palette[bit] || backdrop;
      const mx = col - maskLeft;
      const my = row - mask.y;
      if (mx >= 0 && mx < mask.width && my >= 0 && my < mask.height) {
        const cell = my * mask.width + mx;
        const reflected = maskSize - 1 - cell;
        const onFace = maskPixels.readUInt32LE(4 * (turned ? reflected : cell));
        const onOtherFace = maskPixels.readUInt32LE(4 * (turned ? cell : reflected));
        // Keep both footprints yellow throughout the loop, beneath the current red face.
        if (onFace || onOtherFace) colour = palette[showFigure && onFace ? 2 : 1];
      }
      const pixel = 4 * (y * width + x);
      pixels.set(colour, pixel);
      pixels[pixel + 3] = 255;
    }
  }
  return pixels;
}

const poses = [render(false, true), render(false, false), render(true, true)];
gif.add(poses[0], poseDelay);
gif.add(poses[1], edgeDelay);
gif.add(poses[2], poseDelay);
gif.add(poses[1], edgeDelay);

const strip = encoder(width, height * poses.length);
strip.add(Buffer.concat(poses), 1);
Promise.all([
  ['xoroxorius-flip.gif', gif.finish()],
  ['xoroxorius-frames.gif', strip.frame()]
].map(async ([file, blob]) => {
  writeFileSync(join(__dirname, file), Buffer.from(await blob.arrayBuffer()));
})).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
