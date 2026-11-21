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

function render(turn, reveal, delay) {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = Math.floor(y / unit) - 1;
    for (let x = 0; x < width; x++) {
      const col = Math.floor(x / unit);
      const fieldCol = col + left;
      const inside = row >= 0 && row < rows && fieldCol >= geometry.anchor - row - 1 && fieldCol <= geometry.anchor + row;
      let colour = backdrop;
      if (inside) {
        colour = palette[field.val[row * field.W + fieldCol]] || backdrop;
        const mx = col - maskLeft;
        const my = row - mask.y;
        if (mx >= 0 && mx < mask.width && my >= 0 && my < reveal) {
          const sx = turn ? mask.width - 1 - mx : mx;
          const sy = turn ? mask.height - 1 - my : my;
          if (maskPixels.readUInt32LE(4 * (sy * mask.width + sx))) colour = palette[2];
        }
      }
      pixels.set(colour, 4 * (y * width + x));
      pixels[4 * (y * width + x) + 3] = 255;
    }
  }
  gif.add(pixels, delay);
}

render(false, mask.height, 125);
for (let row = 4; row < mask.height; row += 2) render(true, row, 12);
render(true, mask.height, 145);

gif.finish().arrayBuffer().then(data => {
  writeFileSync(join(__dirname, 'xoroxorius-flip.gif'), Buffer.from(data));
}).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
