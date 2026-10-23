/* mayatnik-gpu.js — XOR-маятник на видеокарте (WebGPU). v2, 2026-10-23.
   Правило то же, что у ядра MAYATNIK (mayatnik-core.js): конус вершины a, клетка = старое ⊕ левый ⊕ правый родитель
   (родители уже пересчитаны), пустая клетка (−1) читается как 0 и после записи становится 0 / 1; в строке 1 вершина
   читается как 1, сама вершина остаётся прежней (пустая — 1). Пара вершин (conePair) — тот же проход по объединению отрезков.

   Хранение: два слоя бит по 32 клетки в слове — bits (значение) и has (клетка не пустая); строка — WW слов.
   Счёт «волной»: шаг t обрабатывает сразу все пары (конус k, строка r = t − 2k). На одном шаге разные конусы пишут разные
   строки (чётность r = чётность t) и читают строки другой чётности, поэтому гонок нет; конус k в строке r видит конус k − 1
   в этой строке (шаг t − 2) и свою строку r − 1 (шаг t − 1) — порядок тот же, что у ядра конус за конусом.
   На n вершин — 2(n − 1) + H шагов, по одному dispatch на шаг; поле остаётся на видеокарте, дочёт идёт от текущего состояния.
   v2 (Маятник v0.468): поле живёт отдельно (field), дочёт run(), картинка render() — среднее цветов клеток под пикселем экрана
   (тот же цвет, что у плоских видов страницы: биты или чётность перекрытий MAYATNIK.tint / tintPair), read() — поле в Int8 ядра.
   v3 (Маятник v0.475): picture() — картинка окна с зеркалами в буфере видеокарты, render() рисует её; readPic() — для сверки.
   v4 (Маятник v0.476): writePic() — картинка с краской, посчитанной страницей, обратно на видеокарту. */
(function (root) {
  const STEP_WGSL = /* wgsl */`
struct P { W: u32, WW: u32, H: u32, K: u32, anchor: u32, bg: u32, _a: u32, _b: u32 }
struct T { t: u32, klo: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<uniform> tt: T;
@group(0) @binding(2) var<storage, read_write> bits: array<u32>;
@group(0) @binding(3) var<storage, read_write> has: array<u32>;
@group(0) @binding(4) var<storage, read> apex: array<vec2<i32>>;

fn rangeMask(j: i32, lo: i32, hi: i32) -> u32 {
  let b0 = max(lo - j * 32, 0); let b1 = min(hi - j * 32, 31);
  if (b0 > b1) { return 0u; }
  let n = u32(b1 - b0 + 1);
  return select((1u << n) - 1u, 0xffffffffu, n == 32u) << u32(b0);
}
fn up(row: i32, j: i32) -> u32 { if (j < 0 || j >= i32(p.WW)) { return 0u; } return bits[u32(row) * p.WW + u32(j)]; }
fn apexBit(j: i32, a: i32) -> u32 { if ((a >> 5) == j) { return 1u << u32(a & 31); } return 0u; }

@compute @workgroup_size(64)
fn step(@builtin(global_invocation_id) g: vec3<u32>) {
  let k = tt.klo + g.y; if (k >= p.K) { return; }
  let r = i32(tt.t) - 2 * i32(k); if (r < 0 || r >= i32(p.H)) { return; }
  let ap = apex[k]; let a1 = ap.x; let a2 = ap.y; let W = i32(p.W);
  let lo = max(a1 - r, 0); let hi = min(a2 + r, W - 1);
  if (lo > hi) { return; }
  let j = (lo >> 5) + i32(g.x);
  if (j * 32 > hi) { return; }
  let idx = u32(r) * p.WW + u32(j);
  if (r == 0) {   // строка вершин: пустая вершина становится 1
    let m = apexBit(j, a1) | apexBit(j, a2);
    if (m == 0u) { return; }
    bits[idx] = bits[idx] | (m & ~has[idx]); has[idx] = has[idx] | m;
    return;
  }
  var M: u32;
  if (a2 - r <= a1 + r + 2) { M = rangeMask(j, a1 - r, min(a2 + r, W - 1)); }   // один отрезок (одна вершина или конусы пары сошлись)
  else { M = rangeMask(j, a1 - r, min(a1 + r, W - 1)) | rangeMask(j, a2 - r, min(a2 + r, W - 1)); }
  M = M & select(0xAAAAAAAAu, 0x55555555u, ((a1 + r) & 1) == 0);   // клетки через одну
  if (M == 0u) { return; }
  var U0 = up(r - 1, j); var Um = up(r - 1, j - 1); var Up = up(r - 1, j + 1);
  if (r == 1) {   // в строке 1 вершина читается как 1
    U0 = U0 | apexBit(j, a1) | apexBit(j, a2); Um = Um | apexBit(j - 1, a1) | apexBit(j - 1, a2); Up = Up | apexBit(j + 1, a1) | apexBit(j + 1, a2);
  }
  let L = (U0 << 1u) | (Um >> 31u); let R = (U0 >> 1u) | (Up << 31u);
  bits[idx] = bits[idx] ^ ((L ^ R) & M);
  has[idx] = has[idx] | M;
}

@compute @workgroup_size(64)
fn init(@builtin(global_invocation_id) g: vec3<u32>) {
  let idx = g.x + g.y * 65535u * 64u; if (idx >= p.WW * p.H) { return; }
  let r = idx / p.WW; let j = i32(idx % p.WW);
  let valid = rangeMask(j, 0, i32(p.W) - 1);
  var h = 0u; var b = 0u;
  if (p.bg == 1u) { h = valid; b = valid; }
  else if (p.bg == 2u) { h = valid; }
  else if (p.bg == 3u) { h = valid; b = valid & select(0xAAAAAAAAu, 0x55555555u, ((p.anchor + r) & 1u) == 0u); }
  bits[idx] = b; has[idx] = h;
}`;

  // Поле → байты ядра (−1 = 0xFF, 0, 1), по 4 клетки в слове
  const UNPACK_WGSL = /* wgsl */`
struct P { W: u32, WW: u32, H: u32, K: u32, anchor: u32, bg: u32, _a: u32, _b: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> bits: array<u32>;
@group(0) @binding(2) var<storage, read> has: array<u32>;
@group(0) @binding(3) var<storage, read_write> outw: array<u32>;
@compute @workgroup_size(64)
fn unpack(@builtin(global_invocation_id) g: vec3<u32>) {
  let n = p.W * p.H; let w = g.x + g.y * 65535u * 64u; if (w * 4u >= n) { return; }
  var o = 0u;
  for (var b = 0u; b < 4u; b++) {
    let i = w * 4u + b; if (i >= n) { break; }
    let r = i / p.W; let c = i % p.W; let q = r * p.WW + (c >> 5u); let m = 1u << (c & 31u);
    var v = 0xFFu; if ((has[q] & m) != 0u) { v = select(0u, 1u, (bits[q] & m) != 0u); }
    o = o | (v << (8u * b));
  }
  outw[w] = o;
}`;

  // v3 (Маятник v0.475): картинка окна — буфер pic (u32 RGBA на клетку окна VW × VH, как img у страницы): base — биты / цвета перекрытий
  // («без полос» — по краям зоны ZL / ZR и сторонам треугольника со страницы), затем проходы зеркал в порядке draw. Каждый проход читает
  // снимок pic2 (копия до прохода) и пишет в pic «на сбор»: клетка сама находит свой источник; из нескольких центров пишет последний, как
  // у страницы. Правила — как у fixMirrorApply, fixLowApply, ztMirApply, zlMirApply и mirPut (цвет mirCol, XOR / AND mirOp).
  // P — общие числа (см. picture()), Q — запись прохода: [вид, m, флаги, n, …] и центры по 4 числа с 8-го; полуцелые — удвоенными.
  const PIC_WGSL = /* wgsl */`
@group(0) @binding(0) var<storage, read> P: array<i32>;
@group(0) @binding(1) var<storage, read> Q: array<i32>;
@group(0) @binding(2) var<storage, read> bits: array<u32>;
@group(0) @binding(3) var<storage, read> has: array<u32>;
@group(0) @binding(4) var<storage, read> Z: array<i32>;
@group(0) @binding(5) var<storage, read_write> pic: array<u32>;
@group(0) @binding(6) var<storage, read> pic2: array<u32>;
fn pm2(x: i32) -> i32 { return ((x % 2) + 2) % 2; }
fn jr(x: f32) -> i32 { return i32(floor(x + 0.5)); }
fn raw(r: i32, fc: i32) -> i32 {
  if (r < 0 || r >= P[3] || fc < 0 || fc >= P[23]) { return -1; }
  let q = u32(r) * u32(P[0]) + u32(fc >> 5); let m = 1u << u32(fc & 31);
  if ((has[q] & m) == 0u) { return -1; } return select(0, 1, (bits[q] & m) != 0u);
}
fn outZone(r: i32, fc: i32) -> bool { let zl = P[11]; return zl > r && (fc < Z[r] || fc > Z[zl + r]); }
fn triFill(r: i32, fc: i32) -> bool {
  if (!outZone(r, fc) || raw(r, fc) < 0) { return false; }
  let p = pm2(fc - P[9] - r); let sL = select(P[12], P[14], p == 1); let sR = select(P[13], P[15], p == 1);
  return fc >= sL - r && fc <= sR + r;
}
fn shown(r: i32, c: i32) -> i32 {
  let fc = c + P[1];
  if (outZone(r, fc) && !(P[10] == 2 && triFill(r, fc))) { return -1; }
  return raw(r, fc);
}
fn cnt(lo0: i32, hi0: i32, p: i32) -> i32 {
  let lo = max(lo0, 1); let hi = min(hi0, P[7]); if (lo > hi) { return 0; }
  let first = lo + pm2(p - lo); if (first > hi) { return 0; } return ((hi - first) >> 1) + 1;
}
fn tintOf(r: i32, c: i32, v: i32) -> i32 {
  if (r == 0) { return 0; }
  var n = 0;
  if (P[4] == 1) {
    let a0 = max(P[5], c - r); let a1 = min(P[6], c + r);
    if (a0 <= a1) { let first = a0 + pm2(c + r - a0); if (first <= a1) { n = ((a1 - first) >> 1) + 1; } }
  } else {
    let p = pm2(c + r); let ac = abs(c);
    if (ac <= r && p == 0) { n = 1; }
    n = n + cnt(-c - r, -c + r, p) + cnt(c - r, c + r, p);
    if (ac <= r) { n = n - cnt(ac - r, r - ac, p); }
  }
  if (P[8] != 0) { n = n + 1; }
  if ((n & 1) == 1) { return 0; }
  return select(2, 1, v == 1);
}
@compute @workgroup_size(64)
fn base(@builtin(global_invocation_id) g: vec3<u32>) {
  let VW = P[2]; let i = i32(g.x + g.y * 65535u * 64u); if (i >= VW * P[3]) { return; }
  let y = i / VW; let c = i % VW; let v = shown(y, c);
  if (v < 0) { pic[i] = u32(P[22]); return; }
  var t = 0; if (P[4] != 0) { t = tintOf(y, c + P[1] - P[9], v); }
  pic[i] = u32(P[16 + v * 3 + t]);
}
fn fam(u: u32) -> i32 {
  let r = i32(u & 255u); let gr = i32((u >> 8u) & 255u); let b = i32((u >> 16u) & 255u);
  if ((r | gr | b) == 0) { return 0; }
  let mx = max(r, max(gr, b)); let mn = min(r, min(gr, b));
  if (mx - mn < 45) { return select(2, 1, r + gr + b >= 450); }
  if (r >= 150 && gr >= 150 && b < gr - 60) { return 3; }
  if (b == mx && b - r > 40) { return 4; }
  if (r == mx && r - gr > 60 && r - b > 40) { return 5; }
  return 0;
}
fn pxBit(u: u32) -> i32 { let k = fam(u); if (k == 1 || k == 4) { return 1; } if (k == 2 || k == 5) { return 0; } return -1; }
fn put(o: i32, v: u32) -> bool {
  let mc = P[24]; if (mc != 0 && fam(v) != mc) { return false; }
  let op = P[25];
  if (op != 0) { let s = pxBit(v); let t = pxBit(pic2[o]); if (s < 0 || t < 0) { return false; } pic[o] = u32(P[26 + select(s & t, s ^ t, op == 1)]); return true; }
  pic[o] = v | 0xff000000u; return true;
}
fn fixAt(Y: i32, C: i32, o: i32) {
  let m = Q[1]; let wide = (Q[2] & 1) != 0; let rot = (Q[2] & 2) != 0; let down = (Q[2] & 4) != 0; let VW = P[2]; let VH = P[3];
  for (var i = Q[3] - 1; i >= 0; i--) {
    let x02 = Q[8 + 4 * i]; let y2 = Q[9 + 4 * i]; let x2 = Q[10 + 4 * i]; let x = f32(x2) * 0.5;   // y точки встречи бывает полуцелым — всё удвоенным
    var r = Y; if (down) { r = y2 - Y; }
    if (r < 0 || 2 * r >= y2) { continue; }
    let sr = y2 - r; if (sr >= VH) { continue; }
    let d = f32(y2) * 0.5 - f32(r);
    var cA = 0; var cB = VW - 1; if (!wide) { cA = max(0, i32(ceil(x - d))); cB = min(VW - 1, i32(floor(x + d))); }
    if (C < cA || C > cB) { continue; }
    var sc = C; if (rot) { sc = x2 - C; }
    if (sc < 0 || sc >= VW) { continue; }
    let fr = select(sr, r, down);
    let v = pic2[fr * VW + sc];
    let fx = floor(x); let fr0 = select(0.0, 1.0, pm2(x02) != 0);
    var xc = x; if (m == 6 || m == 7) { xc = fx + select(fr0, 1.0 - fr0, m == 7); }
    let xcL = fx + fr0; let xcR = fx + (1.0 - fr0);
    if (m == 8) { xc = select(xcR, xcL, f32(C) < x); } else if (m == 9) { xc = select(xcL, xcR, f32(C) < x); }
    let mc = P[24]; if (mc != 0 && fam(v) != mc) { continue; }
    if (m == 4 || m == 5) { let a = shown(Y, C); let b = shown(fr, sc); if (a < 0 || b < 0) { continue; } pic[o] = u32(P[26 + select(a & b, a ^ b, m == 4)]); return; }
    if (m > 1 && pm2(Y + sc - i32(floor(xc))) != select(0, 1, m == 3)) { continue; }
    if (put(o, v)) { return; }
  }
}
fn lowSrc(r: i32, c: i32, Yf: f32, Xf: f32, m: i32) -> vec2<i32> {
  let VW = P[2]; let VH = P[3];
  if (r < i32(floor(Yf)) + 1 || r >= VH) { return vec2<i32>(-1, -1); }
  let d = f32(r) - Yf;
  if (c < max(0, i32(ceil(Xf - d))) || c > min(VW - 1, i32(floor(Xf + d)))) { return vec2<i32>(-1, -1); }
  let fc = f32(c); if (fc == Xf) { return vec2<i32>(-1, -1); }
  let L = fc < Xf; if ((L && (m & 1) == 0) || (!L && (m & 2) == 0)) { return vec2<i32>(-1, -1); }
  var sr: i32; var sc: i32;
  if (L) { sr = jr(Yf + Xf - fc); sc = jr(Xf + Yf - f32(r)); } else { sr = jr(Yf + fc - Xf); sc = jr(Xf + f32(r) - Yf); }
  if (sr < 0 || sr >= VH || sc < 0 || sc >= VW) { return vec2<i32>(-1, -1); }
  return vec2<i32>(sr, sc);
}
fn lowAt(Y: i32, C: i32, o: i32) {
  let m = Q[1]; let outw = Q[2] != 0; let VW = P[2];
  for (var i = Q[3] - 1; i >= 0; i--) {
    let Yf = f32(Q[8 + 4 * i]) * 0.5; let Xf = f32(Q[9 + 4 * i]) * 0.5;
    if (!outw) { let s = lowSrc(Y, C, Yf, Xf, m); if (s.x < 0) { continue; } if (put(o, pic2[s.x * VW + s.y])) { return; } continue; }
    for (var side = 0; side < 2; side++) {
      var c0: i32; var r0: i32;
      if (side == 0) { c0 = jr(Xf + Yf - f32(Y)); r0 = jr(Xf + Yf - f32(C)); } else { c0 = jr(f32(Y) - Yf + Xf); r0 = jr(f32(C) - Xf + Yf); }
      for (var dr = -1; dr <= 1; dr++) { for (var dc = -1; dc <= 1; dc++) {
        let s = lowSrc(r0 + dr, c0 + dc, Yf, Xf, m);
        if (s.x == Y && s.y == C) { if (put(o, pic2[(r0 + dr) * VW + c0 + dc])) { return; } }
      } }
    }
  }
}
@compute @workgroup_size(64)
fn mir(@builtin(global_invocation_id) g: vec3<u32>) {
  let VW = P[2]; let VH = P[3]; let o = i32(g.x + g.y * 65535u * 64u); if (o >= VW * VH) { return; }
  let Y = o / VW; let C = o % VW; let kind = Q[0]; let m = Q[1];
  if (kind == 1) { fixAt(Y, C, o); return; }
  if (kind == 2) { lowAt(Y, C, o); return; }
  if (kind == 3) {
    let L = Q[3]; let mid = Q[2] != 0; var src = -1;
    if (m == 1) { let k = select(Y - L, Y - L - 1, mid); if (k >= 0 && L - 1 - k >= 0) { src = L - 1 - k; } }
    else { let k = L - 1 - Y; if (k >= 0) { let b = select(L + k, L + 1 + k, mid); if (b < VH) { src = b; } } }
    if (src >= 0) { put(o, pic2[src * VW + C]); }
    return;
  }
  if (kind == 4) {
    let t2 = Q[2]; let c2 = t2 - C; if (c2 == C || c2 < 0 || c2 >= VW) { return; }
    let right = 2 * C > t2; if ((m == 1 && !right) || (m != 1 && right)) { return; }
    put(o, pic2[Y * VW + c2]); return;
  }
  if (kind == 5) {
    let kd = Q[2] == 1; let p = Q[3]; let aw = Q[4]; let u = C - aw;
    let sd = select(u + Y - p, u - Y - p, kd); if (sd == 0 || (m == 1 && sd > 0) || (m != 1 && sd < 0)) { return; }
    let su = select(p - Y, Y + p, kd); let sy = select(p - u, u - p, kd); let sc = su + aw;
    if (sy < 0 || sy >= VH || sc < 0 || sc >= VW) { return; }
    put(o, pic2[sy * VW + sc]); return;
  }
}`;

  // Картинка на экран: пиксель холста — среднее цветов клеток окна под ним (до 32 × 32 выборок), при увеличении — клетка под серединой
  const RENDER_WGSL = /* wgsl */`
struct R { x0: f32, y0: f32, step: f32, _a: u32, VX: i32, VW: i32, VH: i32, _b: u32 }
@group(0) @binding(0) var<uniform> u: R;
@group(0) @binding(1) var<storage, read> pic: array<u32>;
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4<f32> {
  let x = f32((i << 1u) & 2u) * 2.0 - 1.0; let y = f32(i & 2u) * 2.0 - 1.0; return vec4<f32>(x, y, 0.0, 1.0);
}
fn cell(r: i32, c: i32) -> vec3<f32> { let p = pic[r * u.VW + c - u.VX]; return vec3<f32>(f32(p & 255u), f32((p >> 8u) & 255u), f32((p >> 16u) & 255u)) / 255.0; }
@fragment fn fs(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let fx = u.x0 + floor(pos.x) * u.step; let fy = u.y0 + floor(pos.y) * u.step;
  var c0: i32; var c1: i32; var r0: i32; var r1: i32;
  if (u.step < 1.0) { c0 = i32(floor(fx + u.step * 0.5)); c1 = c0 + 1; r0 = i32(floor(fy + u.step * 0.5)); r1 = r0 + 1; }
  else { c0 = i32(floor(fx)); c1 = max(c0 + 1, i32(ceil(fx + u.step))); r0 = i32(floor(fy)); r1 = max(r0 + 1, i32(ceil(fy + u.step))); }
  c0 = max(c0, u.VX); c1 = min(c1, u.VX + u.VW); r0 = max(r0, 0); r1 = min(r1, u.VH);
  if (c0 >= c1 || r0 >= r1) { return vec4<f32>(0.0); }
  let sc = max(1, (c1 - c0 + 31) / 32); let sr = max(1, (r1 - r0 + 31) / 32);
  var acc = vec3<f32>(0.0); var n = 0.0;
  for (var r = r0; r < r1; r += sr) { for (var c = c0; c < c1; c += sc) { acc += cell(r, c); n += 1.0; } }
  return vec4<f32>(acc / n, 1.0);
}`;

  const BG = { empty: 0, '1': 1, '0': 2, chess: 3 };

  async function create() {
    if (!navigator.gpu) throw new Error('В этом браузере нет WebGPU');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('WebGPU: видеокарта не найдена');
    const L = adapter.limits;
    const device = await adapter.requestDevice({ requiredLimits: { maxStorageBufferBindingSize: L.maxStorageBufferBindingSize, maxBufferSize: L.maxBufferSize } });
    const stepModule = device.createShaderModule({ code: STEP_WGSL });
    const layout = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }] });
    const pl = device.createPipelineLayout({ bindGroupLayouts: [layout] });
    const pipeStep = device.createComputePipeline({ layout: pl, compute: { module: stepModule, entryPoint: 'step' } });
    const pipeInit = device.createComputePipeline({ layout: pl, compute: { module: stepModule, entryPoint: 'init' } });
    const pipeUnpack = device.createComputePipeline({ layout: 'auto', compute: { module: device.createShaderModule({ code: UNPACK_WGSL }), entryPoint: 'unpack' } });
    const format = navigator.gpu.getPreferredCanvasFormat(), renderModule = device.createShaderModule({ code: RENDER_WGSL });
    const pipeRender = device.createRenderPipeline({ layout: 'auto', vertex: { module: renderModule, entryPoint: 'vs' },
      fragment: { module: renderModule, entryPoint: 'fs', targets: [{ format }] }, primitive: { topology: 'triangle-list' } });
    const picModule = device.createShaderModule({ code: PIC_WGSL });
    const picLayout = device.createBindGroupLayout({ entries: [0, 1, 2, 3, 4, 5, 6].map(b => ({ binding: b, visibility: GPUShaderStage.COMPUTE,
      buffer: { type: b === 5 ? 'storage' : 'read-only-storage', hasDynamicOffset: b === 1 } })) });
    const picPl = device.createPipelineLayout({ bindGroupLayouts: [picLayout] });
    const pipeBase = device.createComputePipeline({ layout: picPl, compute: { module: picModule, entryPoint: 'base' } });
    const pipeMir = device.createComputePipeline({ layout: picPl, compute: { module: picModule, entryPoint: 'mir' } });
    const ALIGN = device.limits.minUniformBufferOffsetAlignment, SALIGN = device.limits.minStorageBufferOffsetAlignment;
    const info = adapter.info || {};
    const grid = n => [Math.min(n, 65535), Math.ceil(n / 65535)];

    // Поле W × H на видеокарте, сразу с фоном bg
    function field({ W, H, anchor = 0, bg = 'empty' }) {
      const WW = Math.ceil(W / 32) + 1, words = WW * H, bytes = words * 4;
      if (bytes > device.limits.maxStorageBufferBindingSize) throw new Error(`Поле ${W}×${H} не помещается в один буфер видеокарты (${(bytes / 2 ** 20) | 0} МБ)`);
      const pBuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const bitsBuf = device.createBuffer({ size: bytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
      const hasBuf = device.createBuffer({ size: bytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
      const uBuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const PBuf = device.createBuffer({ size: 32 * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      let tBuf = null, apBuf = null, bind = null, tCap = 0, apCap = 0, renderBind = null, dead = false;
      let pic = null, pic2 = null, picN = 0, zBuf = null, zCap = 0, qBuf = null, qCap = 0, picBind = null, win = null;
      const Q_INTS = 64;   // запись прохода: 8 чисел + до 14 центров по 4
      const setP = K => device.queue.writeBuffer(pBuf, 0, new Uint32Array([W, WW, H, K, anchor, BG[bg] ?? 0, 0, 0]));
      const bindFor = () => device.createBindGroup({ layout, entries: [
        { binding: 0, resource: { buffer: pBuf } }, { binding: 1, resource: { buffer: tBuf, size: 8 } },
        { binding: 2, resource: { buffer: bitsBuf } }, { binding: 3, resource: { buffer: hasBuf } }, { binding: 4, resource: { buffer: apBuf } }] });
      const ensure = (T, K) => {
        if (T > tCap || !tBuf) { tBuf?.destroy(); tCap = Math.max(T, 64, tCap * 2); tBuf = device.createBuffer({ size: tCap * ALIGN, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }); bind = null; }
        if (K > apCap || !apBuf) { apBuf?.destroy(); apCap = Math.max(K, 64, apCap * 2); apBuf = device.createBuffer({ size: apCap * 8, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }); bind = null; }
        if (!bind) bind = bindFor();
      };
      function reset() {
        setP(0); ensure(1, 1);
        const enc = device.createCommandEncoder(), pass = enc.beginComputePass(), [gx, gy] = grid(Math.ceil(words / 64));
        pass.setPipeline(pipeInit); pass.setBindGroup(0, bind, [0]); pass.dispatchWorkgroups(gx, gy); pass.end(); device.queue.submit([enc.finish()]);
      }
      // Поставить вершины apexes ([a1, a2] на вершину, одиночная — a2 = a1) по порядку поверх текущего поля
      function run(apexes) {
        const K = apexes.length; if (!K || dead) return 0;
        const T = 2 * (K - 1) + H; ensure(T, K); setP(K);
        const tData = new Uint32Array(T * ALIGN / 4), tInfo = new Array(T);
        let span = 0; for (const [a1, a2] of apexes) span = Math.max(span, a2 - a1);
        for (let t = 0; t < T; t++) {
          const klo = Math.max(0, Math.ceil((t - H + 1) / 2)), khi = Math.min(K - 1, t >> 1), rmax = t - 2 * klo;
          tData[t * ALIGN / 4] = t; tData[t * ALIGN / 4 + 1] = klo;
          tInfo[t] = [khi - klo + 1, Math.ceil((Math.min(W, span + 2 * rmax + 1) + 64) / 32 / 64)];
        }
        device.queue.writeBuffer(tBuf, 0, tData); device.queue.writeBuffer(apBuf, 0, new Int32Array(apexes.flat()));
        const CHUNK = 2048;   // шагов на одну отправку
        for (let c = 0; c < T; c += CHUNK) {
          const enc = device.createCommandEncoder(), pass = enc.beginComputePass(); pass.setPipeline(pipeStep);
          for (let t = c; t < Math.min(T, c + CHUNK); t++) { const [n, gx] = tInfo[t]; pass.setBindGroup(0, bind, [t * ALIGN]); pass.dispatchWorkgroups(gx, n); }
          pass.end(); device.queue.submit([enc.finish()]);
        }
        return T;
      }
      // Поле ядра (Int8: −1, 0, 1) → видеокарта
      function write(val) {
        const b = new Uint32Array(words), h = new Uint32Array(words);
        for (let r = 0; r < H; r++) { const row = r * W, wr = r * WW; for (let c = 0; c < W; c++) { const v = val[row + c]; if (v < 0) continue; const q = wr + (c >> 5), m = 1 << (c & 31); h[q] |= m; if (v) b[q] |= m; } }
        device.queue.writeBuffer(bitsBuf, 0, b); device.queue.writeBuffer(hasBuf, 0, h);
      }
      // Видеокарта → поле ядра; into — Int8Array W*H (по умолчанию новый)
      async function read(into) {
        const n = W * H, outBytes = Math.ceil(n / 4) * 4, out = device.createBuffer({ size: outBytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
        const rb = device.createBuffer({ size: outBytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        const bg0 = device.createBindGroup({ layout: pipeUnpack.getBindGroupLayout(0), entries: [
          { binding: 0, resource: { buffer: pBuf } }, { binding: 1, resource: { buffer: bitsBuf } }, { binding: 2, resource: { buffer: hasBuf } }, { binding: 3, resource: { buffer: out } }] });
        const enc = device.createCommandEncoder(), pass = enc.beginComputePass(), [gx, gy] = grid(Math.ceil(outBytes / 4 / 64));
        pass.setPipeline(pipeUnpack); pass.setBindGroup(0, bg0); pass.dispatchWorkgroups(gx, gy); pass.end();
        enc.copyBufferToBuffer(out, 0, rb, 0, outBytes); device.queue.submit([enc.finish()]);
        await rb.mapAsync(GPUMapMode.READ);
        const val = into || new Int8Array(n); val.set(new Int8Array(rb.getMappedRange(), 0, n)); rb.unmap(); rb.destroy(); out.destroy();
        return val;
      }
      // Картинка окна (буфер pic, как img страницы): o = { VX, VW, VH — окно; tint: 0 — нет, 1 — по размаху lo…hi, 2 — пара (k); filled;
      // T — 6 цветов u32 (как rgba страницы), empty; zl — Int32Array ZL, затем ZR (или null); nb2 — «до треугольника», sides — [L0, R0, L1, R1];
      // mirCol (0 — все, 1 w, 2 k, 3 y, 4 b, 5 r), mirOp (0, 1 xor, 2 and), bitC — [0, 1] u32; passes — массивы чисел прохода (Q) по порядку }
      function picture(o) {
        if (dead) return false;
        const n = o.VW * o.VH, bytesN = Math.max(16, n * 4);
        if (bytesN > device.limits.maxStorageBufferBindingSize) return false;
        if (n !== picN || !pic) { pic?.destroy(); pic2?.destroy(); picN = n;
          pic = device.createBuffer({ size: bytesN, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
          pic2 = device.createBuffer({ size: bytesN, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }); picBind = renderBind = null; }
        const zl = o.zl && o.zl.length ? o.zl : null, zN = zl ? zl.length : 1;
        if (!zBuf || zN > zCap) { zBuf?.destroy(); zCap = Math.max(zN, 64); zBuf = device.createBuffer({ size: zCap * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }); picBind = null; }
        const passes = o.passes || [], qN = Math.max(1, passes.length), slot = Math.max(SALIGN, Q_INTS * 4);
        if (!qBuf || qN > qCap) { qBuf?.destroy(); qCap = Math.max(qN, 8); qBuf = device.createBuffer({ size: qCap * slot, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }); picBind = null; }
        const P = new Int32Array(32), sd = o.sides || [1e9, -1e9, 1e9, -1e9];
        P[0] = WW; P[1] = o.VX; P[2] = o.VW; P[3] = o.VH; P[4] = o.tint | 0; P[5] = o.lo | 0; P[6] = o.hi | 0; P[7] = o.k | 0; P[8] = o.filled ? 1 : 0; P[9] = anchor;
        P[10] = o.nb2 ? 2 : 0; P[11] = zl ? zl.length / 2 : 0; for (let i = 0; i < 4; i++) P[12 + i] = Number.isFinite(sd[i]) ? sd[i] : (i % 2 ? -1e9 : 1e9);
        for (let i = 0; i < 6; i++) P[16 + i] = o.T[i] | 0; P[22] = o.empty | 0; P[23] = W; P[24] = o.mirCol | 0; P[25] = o.mirOp | 0; P[26] = (o.bitC || [0, 0])[0] | 0; P[27] = (o.bitC || [0, 0])[1] | 0;
        device.queue.writeBuffer(PBuf, 0, P); if (zl) device.queue.writeBuffer(zBuf, 0, zl);
        if (passes.length) { const q = new Int32Array(qN * slot / 4); passes.forEach((r, i) => q.set(r.slice(0, Q_INTS), i * slot / 4)); device.queue.writeBuffer(qBuf, 0, q); }
        if (!picBind) picBind = device.createBindGroup({ layout: picLayout, entries: [
          { binding: 0, resource: { buffer: PBuf } }, { binding: 1, resource: { buffer: qBuf, size: Q_INTS * 4 } }, { binding: 2, resource: { buffer: bitsBuf } },
          { binding: 3, resource: { buffer: hasBuf } }, { binding: 4, resource: { buffer: zBuf } }, { binding: 5, resource: { buffer: pic } }, { binding: 6, resource: { buffer: pic2 } }] });
        const enc = device.createCommandEncoder(), [gx, gy] = grid(Math.ceil(n / 64));
        let pass = enc.beginComputePass(); pass.setPipeline(pipeBase); pass.setBindGroup(0, picBind, [0]); pass.dispatchWorkgroups(gx, gy); pass.end();
        passes.forEach((r, i) => { enc.copyBufferToBuffer(pic, 0, pic2, 0, n * 4);
          pass = enc.beginComputePass(); pass.setPipeline(pipeMir); pass.setBindGroup(0, picBind, [i * slot]); pass.dispatchWorkgroups(gx, gy); pass.end(); });
        device.queue.submit([enc.finish()]); win = { VX: o.VX, VW: o.VW, VH: o.VH };
        return true;
      }
      // Готовая картинка окна (с краской, посчитанной страницей) → видеокарта; размер — как у последней picture()
      function writePic(px) { if (dead || !pic || px.length !== picN) return false; device.queue.writeBuffer(pic, 0, px); return true; }
      // Картинка окна → Uint32Array (проверка против img страницы)
      async function readPic() {
        if (!pic || !picN) return null;
        const rb = device.createBuffer({ size: picN * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }), enc = device.createCommandEncoder();
        enc.copyBufferToBuffer(pic, 0, rb, 0, picN * 4); device.queue.submit([enc.finish()]);
        await rb.mapAsync(GPUMapMode.READ); const out = new Uint32Array(rb.getMappedRange().slice(0)); rb.unmap(); rb.destroy(); return out;
      }
      // На холст (GPUCanvasContext, уже configure) — последняя picture(): o = { x0, y0, step — клеток окна на пиксель холста }
      function render(context, o) {
        if (dead || !pic || !win) return;
        const ub = new ArrayBuffer(32), f = new Float32Array(ub), i = new Int32Array(ub);
        f[0] = o.x0; f[1] = o.y0; f[2] = o.step; i[4] = win.VX; i[5] = win.VW; i[6] = win.VH;
        device.queue.writeBuffer(uBuf, 0, ub);
        if (!renderBind) renderBind = device.createBindGroup({ layout: pipeRender.getBindGroupLayout(0), entries: [
          { binding: 0, resource: { buffer: uBuf } }, { binding: 1, resource: { buffer: pic } }] });
        const enc = device.createCommandEncoder(), pass = enc.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: 'clear', clearValue: { r: 0, g: 0, b: 0, a: 0 }, storeOp: 'store' }] });
        pass.setPipeline(pipeRender); pass.setBindGroup(0, renderBind); pass.draw(3); pass.end(); device.queue.submit([enc.finish()]);
      }
      reset();
      return { W, H, WW, anchor, reset, run, write, read, picture, readPic, writePic, render, done: () => device.queue.onSubmittedWorkDone(),
        destroy() { dead = true; for (const x of [pBuf, bitsBuf, hasBuf, uBuf, PBuf, tBuf, apBuf, pic, pic2, zBuf, qBuf]) x?.destroy(); } };
    }
    // Холст для render(): context, настроенный на эту видеокарту
    function attach(canvas) { const ctx = canvas.getContext('webgpu'); ctx.configure({ device, format, alphaMode: 'premultiplied' }); return ctx; }

    // Всё поле с нуля (страница проверки): поле + вершины, время счёта
    async function build({ W, H, anchor = 0, bg = 'empty', apexes }) {
      const fl = field({ W, H, anchor, bg }); await fl.done();
      const t0 = performance.now(), steps = fl.run(apexes); await fl.done();
      return { W, H, WW: fl.WW, K: apexes.length, steps, ms: performance.now() - t0, read: () => fl.read(), destroy: fl.destroy, field: fl };
    }
    return { device, adapter: { vendor: info.vendor || '', architecture: info.architecture || '', description: info.description || '' }, field, attach, build };
  }

  // Вершины в том же порядке, что addOne страницы: обычный ход — anchor + offset(mode, k); пара — anchor ∓ (k + 1)
  function apexList(M, { mode = 'pend', pair = false, anchor, steps, from = 0 }) {
    const out = [];
    for (let k = from; k < steps; k++) {
      if (pair) out.push([anchor - k - 1, anchor + k + 1]);
      else { const a = anchor + M.offset(mode, k); out.push([a, a]); }
    }
    return out;
  }
  const api = { create, apexList };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MayatnikGPU = api;
})(typeof window !== 'undefined' ? window : globalThis);
