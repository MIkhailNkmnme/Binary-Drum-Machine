/* mayatnik-gpu.js — XOR-маятник на видеокарте (WebGPU). v1, 2026-10-23.
   Правило то же, что у ядра MAYATNIK (mayatnik-core.js): конус вершины a, клетка = старое ⊕ левый ⊕ правый родитель
   (родители уже пересчитаны), пустая клетка (−1) читается как 0 и после записи становится 0 / 1; в строке 1 вершина
   читается как 1, сама вершина остаётся прежней (пустая — 1). Пара вершин (conePair) — тот же проход по объединению отрезков.

   Хранение: два слоя бит по 32 клетки в слове — bits (значение) и has (клетка не пустая); строка — WW слов.
   Счёт «волной»: шаг t обрабатывает сразу все пары (конус k, строка r = t − 2k). На одном шаге разные конусы пишут разные
   строки (чётность r = чётность t) и читают строки другой чётности, поэтому гонок нет; конус k в строке r видит конус k − 1
   в этой строке (шаг t − 2) и свою строку r − 1 (шаг t − 1) — порядок тот же, что у ядра конус за конусом.
   Всего шагов 2K + H − 1 — по одному dispatch на шаг, всё поле считается без возврата данных на процессор. */
(function (root) {
  const WGSL = /* wgsl */`
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
  const BG = { empty: 0, '1': 1, '0': 2, chess: 3 };

  async function create(opts = {}) {
    if (!navigator.gpu) throw new Error('В этом браузере нет WebGPU');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('WebGPU: видеокарта не найдена');
    const L = adapter.limits;
    const device = await adapter.requestDevice({ requiredLimits: { maxStorageBufferBindingSize: L.maxStorageBufferBindingSize, maxBufferSize: L.maxBufferSize } });
    const module = device.createShaderModule({ code: WGSL });
    const layout = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }] });
    const pl = device.createPipelineLayout({ bindGroupLayouts: [layout] });
    const pipeStep = device.createComputePipeline({ layout: pl, compute: { module, entryPoint: 'step' } });
    const pipeInit = device.createComputePipeline({ layout: pl, compute: { module, entryPoint: 'init' } });
    const ALIGN = device.limits.minUniformBufferOffsetAlignment;
    const info = adapter.info || {};

    // Поле W × H; apexes — массив [a1, a2] на каждую вершину (одиночная: a2 = a1). Возвращает объект с read() / destroy().
    async function build({ W, H, anchor = 0, bg = 'empty', apexes }) {
      const WW = Math.ceil(W / 32) + 1, K = apexes.length, words = WW * H, bytes = words * 4;
      if (bytes > device.limits.maxStorageBufferBindingSize) throw new Error(`Поле ${W}×${H} не помещается в один буфер видеокарты (${(bytes / 2 ** 20) | 0} МБ)`);
      const T = K ? 2 * (K - 1) + H : 0;
      const pBuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(pBuf, 0, new Uint32Array([W, WW, H, K, anchor, BG[bg] ?? 0, 0, 0]));
      const tBuf = device.createBuffer({ size: Math.max(1, T) * ALIGN, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const tData = new Uint32Array(Math.max(1, T) * ALIGN / 4), tInfo = [];
      let span = 0; for (const [a1, a2] of apexes) span = Math.max(span, a2 - a1);
      for (let t = 0; t < T; t++) {
        const klo = Math.max(0, Math.ceil((t - H + 1) / 2)), khi = Math.min(K - 1, t >> 1), rmax = t - 2 * klo;
        tData[t * ALIGN / 4] = t; tData[t * ALIGN / 4 + 1] = klo;
        tInfo.push([klo, khi - klo + 1, Math.ceil((Math.min(W, span + 2 * rmax + 1) + 64) / 32 / 64)]);
      }
      device.queue.writeBuffer(tBuf, 0, tData);
      const bitsBuf = device.createBuffer({ size: bytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
      const hasBuf = device.createBuffer({ size: bytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
      const apBuf = device.createBuffer({ size: Math.max(8, K * 8), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(apBuf, 0, new Int32Array(apexes.flat().length ? apexes.flat() : [0, 0]));
      const bind = device.createBindGroup({ layout, entries: [
        { binding: 0, resource: { buffer: pBuf } }, { binding: 1, resource: { buffer: tBuf, size: 8 } },
        { binding: 2, resource: { buffer: bitsBuf } }, { binding: 3, resource: { buffer: hasBuf } }, { binding: 4, resource: { buffer: apBuf } }] });
      const t0 = performance.now();
      { const enc = device.createCommandEncoder(), pass = enc.beginComputePass(), groups = Math.ceil(words / 64);
        pass.setPipeline(pipeInit); pass.setBindGroup(0, bind, [0]); pass.dispatchWorkgroups(Math.min(groups, 65535), Math.ceil(groups / 65535)); pass.end(); device.queue.submit([enc.finish()]); }
      const CHUNK = 1024;   // шагов на одну отправку
      for (let t0c = 0; t0c < T; t0c += CHUNK) {
        const enc = device.createCommandEncoder(), pass = enc.beginComputePass(); pass.setPipeline(pipeStep);
        for (let t = t0c; t < Math.min(T, t0c + CHUNK); t++) { const [, n, gx] = tInfo[t]; pass.setBindGroup(0, bind, [t * ALIGN]); pass.dispatchWorkgroups(gx, n); }
        pass.end(); device.queue.submit([enc.finish()]);
      }
      await device.queue.onSubmittedWorkDone();
      const ms = performance.now() - t0;
      async function readWords(buf) {
        const rb = device.createBuffer({ size: bytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        const enc = device.createCommandEncoder(); enc.copyBufferToBuffer(buf, 0, rb, 0, bytes); device.queue.submit([enc.finish()]);
        await rb.mapAsync(GPUMapMode.READ); const out = new Uint32Array(rb.getMappedRange().slice(0)); rb.unmap(); rb.destroy(); return out;
      }
      return {
        W, H, WW, K, steps: T, ms,
        // Поле в формате ядра: Int8Array W*H, −1 пусто, 0, 1
        async read() {
          const b = await readWords(bitsBuf), h = await readWords(hasBuf), val = new Int8Array(W * H);
          for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { const q = r * WW + (c >> 5), m = 1 << (c & 31); val[r * W + c] = h[q] & m ? (b[q] & m ? 1 : 0) : -1; }
          return val;
        },
        destroy() { for (const x of [pBuf, tBuf, bitsBuf, hasBuf, apBuf]) x.destroy(); },
      };
    }
    return { device, adapter: { vendor: info.vendor || '', architecture: info.architecture || '', description: info.description || '' }, build };
  }

  // Вершины в том же порядке, что addOne страницы: обычный ход — anchor + offset(mode, k); пара — anchor ∓ (k + 1)
  function apexList(M, { mode = 'pend', pair = false, anchor, steps }) {
    const out = [];
    for (let k = 0; k < steps; k++) {
      if (pair) out.push([anchor - k - 1, anchor + k + 1]);
      else { const a = anchor + M.offset(mode, k); out.push([a, a]); }
    }
    return out;
  }
  const api = { create, apexList };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MayatnikGPU = api;
})(typeof window !== 'undefined' ? window : globalThis);
