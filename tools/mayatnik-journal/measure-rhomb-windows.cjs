'use strict';

const {makeModel} = require('./search-rhomb-routes.cjs');
const {patterns, steps} = require('./search-rhomb-sequences.cjs');

const length = 10;
const target = patterns[length - 5];
const possible = 2 ** length;

function measure(config, last) {
  const model = makeModel();
  const seen = new Uint8Array(possible);
  let windows = 0, targetHits = 0, first = null;
  const targetValue = parseInt(target, 2);
  model.start(config);
  for (let frame = 1; frame <= last; frame++) {
    const {width, height, values} = model.snapshot();
    const inside = (x, y) => x >= 0 && x < width && y >= 0 && y < height;
    for (const [dx, dy] of steps) for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
      if (inside(col - dx, row - dy)) continue;
      let value = 0, filled = 0;
      for (let x = col, y = row; inside(x, y); x += dx, y += dy) {
        const bit = values[y * width + x];
        if (bit < 0) {
          value = filled = 0;
          continue;
        }
        value = ((value << 1) | bit) & (possible - 1);
        if (++filled < length) continue;
        windows++;
        seen[value] = 1;
        if (value === targetValue) {
          targetHits++;
          first ??= frame;
        }
      }
    }
    if (frame < last) model.advance();
  }
  const distinct = seen.reduce((sum, hit) => sum + hit, 0);
  return {config, last, target, possible, windows, distinct, targetHits, first};
}

const template = {n: 32, width: 2, height: 2, x: 'pendulum', y: 'pendulum',
  halfX: 'together', halfY: 'together', route: 'cw', edge: 'bounce'};
const results = [];
for (const rule of ['XOR', 'AND']) results.push(measure({...template, rule}, 256));
console.log(JSON.stringify(results));
