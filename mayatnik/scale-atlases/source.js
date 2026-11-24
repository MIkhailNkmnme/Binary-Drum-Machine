(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MayatnikScaleAtlasSource = api;
})(globalThis, function () {
  'use strict';

  const nativeColours = [0, 0xff8b0000, 0xff69e9ff];

  function create(core, construction, recording) {
    const histories = new Map();
    let saved;

    function read(rows, number) {
      if (rows === 512) {
        if (saved?.number === number) return saved;
        const {size: [width, height], bank} = recording();
        const label = String(number).padStart(3, '0');
        const part = bank.shape('axis-512:frame:' + label)?.parts[0];
        if (!part) throw new Error(`Кадр ${number} отсутствует в записи 512`);
        const pixels = new Uint32Array(width * height);
        const x = Math.round(part.center + (width - part.width) / 2);
        const data = part.data;
        for (let row = 0; row < part.height; row++) {
          const offset = (row + part.y) * width + x;
          for (let col = 0; col < part.width; col++) pixels[offset + col] = data[row * part.width + col];
        }
        saved = {number, width, height, pixels};
        return saved;
      }

      let current = histories.get(rows);
      if (!current || current.number > number) {
        const settings = {rows, steps: rows, mode: 'pend', bg: 'empty'};
        const geometry = construction.geometry(settings);
        current = {number: 0, settings, geometry, field: core.field(geometry.W, rows, settings.bg, geometry.anchor)};
        histories.set(rows, current);
      }
      while (current.number < number) {
        construction.step(current.field, current.geometry, current.settings, current.number);
        current.number++;
      }
      return {width: current.field.W, height: current.field.H, pixels: current.field.val, palette: nativeColours};
    }

    return {read};
  }

  function sample(source, phase, sourceIndex) {
    const {width, height} = phase;
    const {pixels, palette} = source;
    const raster = new Uint32Array(width * height);
    let occupied = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = sourceIndex(phase, x, y);
        if (index < 0) continue;
        const colour = palette ? palette[pixels[index] + 1] : pixels[index];
        if (colour) {
          raster[y * width + x] = colour;
          occupied++;
        }
      }
    }
    return {...phase, occupied, raster};
  }

  return {create, sample};
});
