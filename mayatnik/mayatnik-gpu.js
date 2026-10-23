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
   (тот же цвет, что у плоских видов страницы: биты или чётность перекрытий MAYATNIK.tint / tintPair), read() — поле в Int8 ядра. */
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

  // Картинка: пиксель экрана — среднее цветов клеток под ним (до 32 × 32 выборок), при увеличении — клетка под серединой пикселя
  const RENDER_WGSL = /* wgsl */`
struct R { x0: f32, y0: f32, step: f32, WW: u32, VX: i32, VW: i32, VH: i32, tint: u32,
           lo: i32, hi: i32, k: i32, filled: u32, anchor: i32, _a: u32, _b: u32, _c: u32, col: array<vec4<f32>, 7> }
@group(0) @binding(0) var<uniform> u: R;
@group(0) @binding(1) var<storage, read> bits: array<u32>;
@group(0) @binding(2) var<storage, read> has: array<u32>;
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4<f32> {
  let x = f32((i << 1u) & 2u) * 2.0 - 1.0; let y = f32(i & 2u) * 2.0 - 1.0; return vec4<f32>(x, y, 0.0, 1.0);
}
fn pm2(x: i32) -> i32 { return ((x % 2) + 2) % 2; }
fn cnt(lo0: i32, hi0: i32, p: i32) -> i32 {   // число m в [lo, hi] ∩ [1, k] той же чётности, что p (MAYATNIK.tintPair)
  let lo = max(lo0, 1); let hi = min(hi0, u.k); if (lo > hi) { return 0; }
  let first = lo + pm2(p - lo); if (first > hi) { return 0; } return ((hi - first) >> 1) + 1;
}
fn tintOf(r: i32, c: i32, v: i32) -> i32 {   // c — от якоря; 0 — чёрный, 1 — синий, 2 — красный
  if (r == 0) { return 0; }
  var n = 0;
  if (u.tint == 1u) {
    let a0 = max(u.lo, c - r); let a1 = min(u.hi, c + r);
    if (a0 <= a1) { let first = a0 + pm2(c + r - a0); if (first <= a1) { n = ((a1 - first) >> 1) + 1; } }
  } else {
    let p = pm2(c + r); let ac = abs(c);
    if (ac <= r && p == 0) { n = 1; }
    n = n + cnt(-c - r, -c + r, p) + cnt(c - r, c + r, p);
    if (ac <= r) { n = n - cnt(ac - r, r - ac, p); }
  }
  if (u.filled != 0u) { n = n + 1; }
  if ((n & 1) == 1) { return 0; }
  return select(2, 1, v == 1);
}
fn cell(r: i32, c: i32) -> vec3<f32> {
  let q = u32(r) * u.WW + u32(c >> 5); let m = 1u << u32(c & 31);
  if ((has[q] & m) == 0u) { return u.col[6].rgb; }
  let v = select(0, 1, (bits[q] & m) != 0u);
  var t = 0; if (u.tint != 0u) { t = tintOf(r, c - u.anchor, v); }
  return u.col[v * 3 + t].rgb;
}
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
    const ALIGN = device.limits.minUniformBufferOffsetAlignment;
    const info = adapter.info || {};
    const grid = n => [Math.min(n, 65535), Math.ceil(n / 65535)];

    // Поле W × H на видеокарте, сразу с фоном bg
    function field({ W, H, anchor = 0, bg = 'empty' }) {
      const WW = Math.ceil(W / 32) + 1, words = WW * H, bytes = words * 4;
      if (bytes > device.limits.maxStorageBufferBindingSize) throw new Error(`Поле ${W}×${H} не помещается в один буфер видеокарты (${(bytes / 2 ** 20) | 0} МБ)`);
      const pBuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const bitsBuf = device.createBuffer({ size: bytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
      const hasBuf = device.createBuffer({ size: bytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
      const uBuf = device.createBuffer({ size: 176, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      let tBuf = null, apBuf = null, bind = null, tCap = 0, apCap = 0, renderBind = null, dead = false;
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
      // Картинка в context (GPUCanvasContext, уже configure): o = { x0, y0, step — клеток на пиксель холста; VX, VW, VH — окно;
      // tint: 0 — нет, 1 — по размаху lo…hi, 2 — пара (k); filled; anchor; colours — 7 цветов [r, g, b] 0…255: T[0…5], пустота }
      function render(context, o) {
        if (dead) return;
        const ub = new ArrayBuffer(176), f = new Float32Array(ub), i = new Int32Array(ub), w = new Uint32Array(ub);
        f[0] = o.x0; f[1] = o.y0; f[2] = o.step; w[3] = WW; i[4] = o.VX; i[5] = o.VW; i[6] = o.VH; w[7] = o.tint | 0;
        i[8] = o.lo | 0; i[9] = o.hi | 0; i[10] = o.k | 0; w[11] = o.filled ? 1 : 0; i[12] = o.anchor ?? anchor;
        o.colours.forEach((c, n) => { f[16 + n * 4] = c[0] / 255; f[17 + n * 4] = c[1] / 255; f[18 + n * 4] = c[2] / 255; f[19 + n * 4] = 1; });
        device.queue.writeBuffer(uBuf, 0, ub);
        if (!renderBind) renderBind = device.createBindGroup({ layout: pipeRender.getBindGroupLayout(0), entries: [
          { binding: 0, resource: { buffer: uBuf } }, { binding: 1, resource: { buffer: bitsBuf } }, { binding: 2, resource: { buffer: hasBuf } }] });
        const enc = device.createCommandEncoder(), pass = enc.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: 'clear', clearValue: { r: 0, g: 0, b: 0, a: 0 }, storeOp: 'store' }] });
        pass.setPipeline(pipeRender); pass.setBindGroup(0, renderBind); pass.draw(3); pass.end(); device.queue.submit([enc.finish()]);
      }
      reset();
      return { W, H, WW, anchor, reset, run, write, read, render, done: () => device.queue.onSubmittedWorkDone(),
        destroy() { dead = true; for (const x of [pBuf, bitsBuf, hasBuf, uBuf, tBuf, apBuf]) x?.destroy(); } };
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
