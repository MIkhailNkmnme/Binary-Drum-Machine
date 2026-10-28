/* Hub v0.471. Exact -1/0/1 fields packed in occupied/value bit planes.
   Rows have independent word padding: a shift never wraps into another row.
   No frame is skipped; each sweep consumes the just-updated preceding row. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HubXorKernel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function create(W, H) {
    const stride = Math.ceil(W / 32), tail = W % 32 ? 0xffffffff >>> (32 - W % 32) : 0xffffffff;
    return { W, H, stride, tail, bits: new Uint32Array(stride * H), valid: new Uint32Array(stride * H) };
  }
  function reset(f) { f.bits.fill(0); f.valid.fill(0); }
  function apex(f, c) {
    const i = c >>> 5, bit = 1 << (c & 31);
    f.bits[i] |= bit; f.valid[i] |= bit;
  }
  function copy(target, source) { target.bits.set(source.bits); target.valid.set(source.valid); }
  function sweep(f, from, to) {
    const { bits, valid, stride, tail } = f;
    for (let r = from; r < to; r++) {
      const base = r * stride, up = base - stride;
      for (let w = 0; w < stride; w++) {
        const p = bits[up + w], v = valid[up + w];
        const l = w ? bits[up + w - 1] >>> 31 : 0, lv = w ? valid[up + w - 1] >>> 31 : 0;
        const rr = w + 1 < stride ? bits[up + w + 1] << 31 : 0, rv = w + 1 < stride ? valid[up + w + 1] << 31 : 0;
        bits[base + w] ^= (p << 1 | l) ^ (p >>> 1 | rr);
        valid[base + w] |= (v << 1 | lv) | (v >>> 1 | rv);
      }
      bits[base + stride - 1] &= tail;
      valid[base + stride - 1] &= tail;
    }
  }
  function cone(f, a) {
    const { W, H, stride, bits, valid } = f;
    if (a < 0 || a >= W) return;
    const ai = a >>> 5, ab = 1 << (a & 31), restoreZero = (valid[ai] & ab) && !(bits[ai] & ab);
    apex(f, a);
    for (let r = 1; r < H; r++) {
      const lo = Math.max(0, a - r), hi = Math.min(W - 1, a + r);
      const first = lo >>> 5, last = hi >>> 5, base = r * stride, up = base - stride;
      const parity = (a + r) & 1 ? 0xaaaaaaaa : 0x55555555;
      for (let w = first; w <= last; w++) {
        let mask = parity;
        if (w === first) mask &= 0xffffffff << (lo & 31);
        if (w === last) mask &= 0xffffffff >>> (31 - (hi & 31));
        const p = bits[up + w];
        const l = w ? bits[up + w - 1] >>> 31 : 0;
        const rr = w + 1 < stride ? bits[up + w + 1] << 31 : 0;
        bits[base + w] ^= ((p << 1 | l) ^ (p >>> 1 | rr)) & mask;
        valid[base + w] |= mask;
      }
      if (r === 1 && restoreZero) bits[ai] &= ~ab;
    }
  }
  function unpack(f, out) {
    const { W, H, stride, bits, valid } = f;
    for (let r = 0; r < H; r++) {
      let i = r * W;
      for (let w = 0; w < stride; w++) {
        let b = bits[r * stride + w], v = valid[r * stride + w];
        const n = Math.min(32, W - w * 32);
        for (let j = 0; j < n; j++, i++, b >>>= 1, v >>>= 1) out[i] = v & 1 ? b & 1 : -1;
      }
    }
    return out;
  }
  const paintTables = new Map();
  function paint(f, pixels, colour) {
    colour |= 0;
    let table = paintTables.get(colour);
    if (!table) {
      table = new Int32Array(256 * 8);
      for (let byte = 0; byte < 256; byte++) for (let bit = 0; bit < 8; bit++) table[byte * 8 + bit] = byte & 1 << bit ? colour : 0;
      if (paintTables.size === 16) paintTables.clear();
      paintTables.set(colour, table);
    }
    const { W, H, stride, bits } = f, full = W - W % 8;
    for (let r = 0; r < H; r++) {
      const base = r * stride;
      let i = r * W, c = 0;
      for (; c < full; c += 8, i += 8) {
        const t = ((bits[base + (c >>> 5)] >>> (c & 31)) & 255) << 3;
        pixels[i] = table[t]; pixels[i + 1] = table[t + 1];
        pixels[i + 2] = table[t + 2]; pixels[i + 3] = table[t + 3];
        pixels[i + 4] = table[t + 4]; pixels[i + 5] = table[t + 5];
        pixels[i + 6] = table[t + 6]; pixels[i + 7] = table[t + 7];
      }
      for (; c < W; c++, i++) pixels[i] = bits[base + (c >>> 5)] & 1 << (c & 31) ? colour : 0;
    }
  }
  function reverse32(v) {
    v = (v >>> 1 & 0x55555555) | (v & 0x55555555) << 1;
    v = (v >>> 2 & 0x33333333) | (v & 0x33333333) << 2;
    v = (v >>> 4 & 0x0f0f0f0f) | (v & 0x0f0f0f0f) << 4;
    v = (v >>> 8 & 0x00ff00ff) | (v & 0x00ff00ff) << 8;
    return (v >>> 16 | v << 16) >>> 0;
  }
  // Word in displayed coordinates, including a non-word-aligned mirror edge.
  function word(f, r, w, mirror) {
    const base = r * f.stride;
    if (!mirror) return f.bits[base + w];
    const end = f.W - 1 - w * 32, source = end >>> 5, shift = end & 31;
    let v = f.bits[base + source] << (31 - shift);
    if (shift < 31 && source > 0) v |= f.bits[base + source - 1] >>> (shift + 1);
    return reverse32(v);
  }
  function blend(fields, pixels, and, mirror, colours, common) {
    const f = fields[0].data, { W, H, stride } = f;
    // Each bit pattern selects exactly the old first-contributing-field colour.
    const lut = new Uint32Array(8);
    for (let mask = 1; mask < 1 << fields.length; mask++) {
      let count = 0, first = -1;
      for (let k = 0; k < fields.length; k++) if (mask & 1 << k) { count++; if (first < 0) first = k; }
      if (and ? count === fields.length : count % 2) lut[mask] = and ? common : colours[first];
    }
    for (let r = 0; r < H; r++) {
      let i = r * W;
      for (let w = 0; w < stride; w++) {
        let a = word(fields[0].data, r, w, mirror && fields[0].mirror);
        let b = fields[1] ? word(fields[1].data, r, w, mirror && fields[1].mirror) : 0;
        let c = fields[2] ? word(fields[2].data, r, w, mirror && fields[2].mirror) : 0;
        const end = i + Math.min(32, W - w * 32);
        if (!(a | b | c)) pixels.fill(0, i, end);
        else for (; i < end; i++, a >>>= 1, b >>>= 1, c >>>= 1) pixels[i] = lut[(a & 1) | (b & 1) << 1 | (c & 1) << 2];
        i = end;
      }
    }
  }
  return { create, reset, apex, copy, sweep, cone, unpack, paint, blend };
});
