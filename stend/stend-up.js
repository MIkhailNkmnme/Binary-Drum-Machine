/* СТЕНД-024: private Mayatnik source; translated display fragments never feed back into it. */
(function () {
 'use strict';
 window.StendUp = {create(A) {
  const W = 2 * A + 1, H = A + 1, block = 64;
  let reserve = 0, padding = 0, center = A, source = null, at = 0, image = null, stats = null;
  function extend(t) {
   const next = Math.max(block, Math.ceil(t / block) * block);
   if (source && next <= reserve) return;
   const initial = !source;
   const nextField = MAYATNIK.field(W + 2 * next, H, -1);
   if (source) {
    const shift = next - padding;
    for (let r = 0; r < H; r++) nextField.val.set(source.val.subarray(r * source.W, (r + 1) * source.W), r * nextField.W + shift);
   }
   source = nextField; reserve = next; padding = next; center = padding + A;
   if (initial) MAYATNIK.cone(source, center, H);
  }
  function resetSource(t) {
   reserve = Math.max(block, Math.ceil(t / block) * block); padding = reserve; center = padding + A;
   source = MAYATNIK.field(W + 2 * reserve, H, -1);
   MAYATNIK.cone(source, center, H); at = 0;
  }
  function draw(context, t) {
   extend(t);
   if (t < at) resetSource(t);
   while (at < t) { const next = at + 1; MAYATNIK.conePair(source, center - next, center + next, H); at = next; }
   const topReserve = Math.max(A, Math.ceil(t / A) * A), height = topReserve + H;
   const visible = new Int8Array(W * height).fill(-1);
   let transferred = 0, seamWrites = 0;
   for (let r = 0; r < H; r++) for (let c = 0; c < source.W; c++) {
    const value = source.val[r * source.W + c]; if (value < 0) continue;
    const x = c - center, distance = Math.abs(x);
    const q = distance > A ? Math.floor((distance - 1) / A) : 0;
    const destinationX = A + Math.sign(x) * (distance - q * A);
    const destinationY = topReserve + r - q * A;
    if (destinationX < 0 || destinationX >= W || destinationY < 0 || destinationY >= height) throw new Error('Перенесённая клетка вышла за подготовленное поле');
    const index = destinationY * W + destinationX;
    if (visible[index] >= 0) { visible[index] ^= value; seamWrites++; }
    else visible[index] = value;
    if (q) transferred++;
   }
   if (!image || image.width !== W || image.height !== height) image = context.createImageData(W, height);
   const pixels = new Uint32Array(image.data.buffer);
   const background = (255 << 24 | 10 << 16 | 6 << 8 | 4) >>> 0;
   const zero = (255 << 24) >>> 0, one = (255 << 24 | 92 << 16 | 196 << 8 | 255) >>> 0;
   let o = 0, z = 0, bg = 0;
   for (let i = 0; i < visible.length; i++) {
    const value = visible[i];
    if (value === 1) { pixels[i] = one; o++; }
    else if (value === 0) { pixels[i] = zero; z++; }
    else { pixels[i] = background; bg++; }
   }
   context.putImageData(image, 0, 0);
   stats = {o, z, bg, transferred, seamWrites};
   return {width: W, height, topReserve, reserve, stats};
  }
  return {A, W, H, draw, get stats() {return stats;}};
 }};
})();
