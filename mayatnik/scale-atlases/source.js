(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MayatnikScaleAtlasSource = api;
})(globalThis, function () {
  'use strict';

  const nativeColours = [0, 0xff8b0000, 0xff69e9ff];
  const LARGE_ROWS = 2048;
  const PAGE_BYTES = 16 * 1024 * 1024;

  function create(core, construction, recording, coneBits) {
    let current, saved;

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

      if (current?.settings.rows !== rows) {
        const settings = {rows, steps: rows, mode: 'pend', bg: 'empty'};
        const geometry = construction.geometry(settings);
        current = {number: 0, settings, geometry, field: core.field(geometry.W, rows, settings.bg, geometry.anchor)};
        if (rows >= LARGE_ROWS) current.cones = coneBits.create(geometry.W, rows);
      }
      if (current.number > number) {
        current.field.val.fill(-1);
        if (current.cones) current.cones = coneBits.create(current.geometry.W, rows);
        current.number = 0;
      }
      const {field, cones, geometry, settings} = current;
      if (cones && current.number < number) {
        while (current.number < number) {
          cones.step(geometry.anchor + core.offset(settings.mode, current.number++));
        }
        cones.read(field.val);
      } else {
        while (current.number < number) construction.step(field, geometry, settings, current.number++);
      }
      return {width: field.W, height: field.H, pixels: field.val, palette: nativeColours};
    }

    return {read};
  }

  function pageSize(source, factor, compact) {
    const pixels = Math.ceil(source.width / factor) * Math.ceil(source.height / factor);
    const bytes = pixels * (compact ? 1 : 4);
    return Math.max(1, Math.min(32, Math.floor(PAGE_BYTES / bytes)));
  }

  function sample(source, phase, sourceIndex, compact = false) {
    const {width, height, factor, validHeight, validWidth} = phase;
    const {pixels, palette} = source;
    const raster = compact ? new Uint8Array(width * height) : new Uint32Array(width * height);
    let occupied = 0;
    for (let y = 0; y < validHeight; y++) {
      let index = sourceIndex(phase, 0, y);
      const row = y * width;
      for (let x = 0; x < validWidth; x++, index += factor) {
        const pixel = pixels[index];
        const colour = compact ? pixel + 1 : palette ? palette[pixel + 1] : pixel;
        if (colour) {
          raster[row + x] = colour;
          occupied++;
        }
      }
    }
    return {...phase, occupied, raster, ...(compact ? {palette} : {})};
  }

  return {create, sample, pageSize, LARGE_ROWS};
});
