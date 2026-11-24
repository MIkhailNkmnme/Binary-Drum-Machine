(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MayatnikScaleAtlasPng = api;
})(globalThis, function () {
  'use strict';

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const crcTable = Uint32Array.from({length: 256}, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
    return value;
  });
  const encoder = new TextEncoder();

  function chunk(name, data) {
    const type = encoder.encode(name);
    let crc = 0xffffffff;
    for (const value of type) crc = (crc >>> 8) ^ crcTable[(crc ^ value) & 255];
    for (const value of data) crc = (crc >>> 8) ^ crcTable[(crc ^ value) & 255];
    const header = new Uint8Array(8), checksum = new Uint8Array(4);
    new DataView(header.buffer).setUint32(0, data.length);
    header.set(type, 4);
    new DataView(checksum.buffer).setUint32(0, crc ^ 0xffffffff);
    return [header, data, checksum];
  }

  function paintRow(block, offset, raster, from, width, left, step) {
    for (let col = 0, x = left; col < width; col++, x += step) {
      const index = raster[from + col];
      if (!index) continue;
      const byte = offset + (x >> 2);
      const shift = 6 - 2 * (x & 3);
      block[byte] = (block[byte] & ~(3 << shift)) | (index << shift);
    }
  }

  async function encode(width, height, palette, writeRow) {
    const stride = 1 + Math.ceil(width / 4);
    let y = 0;
    const source = new ReadableStream({
      async pull(controller) {
        const stop = Math.min(height, y + 64);
        const block = new Uint8Array((stop - y) * stride);
        for (let offset = 1; y < stop; y++, offset += stride) {
          writeRow(block, offset, y);
        }
        controller.enqueue(block);
        if (y === height) controller.close();
        else await new Promise(resolve => setTimeout(resolve, 0));
      }
    });

    const header = new Uint8Array(13);
    const sizes = new DataView(header.buffer);
    sizes.setUint32(0, width);
    sizes.setUint32(4, height);
    header.set([2, 3], 8);
    const colours = Uint8Array.from(palette.flatMap(colour => [colour & 255, (colour >>> 8) & 255, (colour >>> 16) & 255]));
    const chunks = [signature, ...chunk('IHDR', header), ...chunk('PLTE', colours), ...chunk('tRNS', new Uint8Array([0]))];
    const compressed = source.pipeThrough(new CompressionStream('deflate')).getReader();
    while (true) {
      const {value, done} = await compressed.read();
      if (done) break;
      chunks.push(...chunk('IDAT', value));
    }
    chunks.push(...chunk('IEND', new Uint8Array()));
    return new Blob(chunks, {type: 'image/png'});
  }

  function compose(items) {
    const {factor, sourceWidth, sourceHeight, palette} = items[0];
    const byRow = Array.from({length: factor}, () => []);
    for (const item of items) byRow[item.dy].push(item);
    return encode(sourceWidth, sourceHeight, palette, (block, offset, y) => {
      const phaseY = Math.floor(y / factor);
      for (const item of byRow[y % factor]) {
        if (phaseY >= item.validHeight) continue;
        paintRow(block, offset, item.raster, phaseY * item.width, item.validWidth, item.dx, factor);
      }
    });
  }

  function composeFree(items, {width, height, left, top}) {
    const placements = items.map(item => ({...item, x: item.x - left, y: item.y - top}));
    return encode(width, height, items[0].palette, (block, offset, y) => {
      for (const item of placements) {
        const tileY = y - item.y;
        if (tileY < 0 || tileY >= item.height) continue;
        paintRow(block, offset, item.raster, tileY * item.width, item.width, item.x, 1);
      }
    });
  }

  return {compose, composeFree};
});
