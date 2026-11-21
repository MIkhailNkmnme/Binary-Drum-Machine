const PREFIX = 'from-mayatnik/';
const FILE = /^\d{13}-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.(png|gif|mp4|webm)$/;
const MIME = new Map([['png','image/png'], ['gif','image/gif'], ['mp4','video/mp4'], ['webm','video/webm']]);
const MAX_MEDIA = 64 * 1024 * 1024;
// Only assets already published in the journal may be read through the backup.
const ARCHIVE_KEYS = new Set([
  'image-journal-2026-11-21/axis-30-enamel.webp',
  'image-journal-2026-11-21/axis-42-etching.webp',
  'image-journal-2026-11-21/central-axis-templates.gif',
  'image-journal-2026-11-20/axis-checks.png',
  'image-journal-2026-11-20/axis-diagonal-preview.webp',
  'image-journal-2026-11-20/axis-diagonal.png',
  'image-journal-2026-11-20/axis-horizontal-preview.webp',
  'image-journal-2026-11-20/axis-horizontal.png',
  'image-journal-2026-11-20/axis-vertical-preview.webp',
  'image-journal-2026-11-20/axis-vertical.png',
  'image-journal-2026-11-20/code-wave-preview.webp',
  'image-journal-2026-11-20/code-wave.webp',
  'image-journal-2026-11-20/hub-xor-4k-preview.webp',
  'image-journal-2026-11-20/hub-xor-4k.png',
  'image-journal-2026-11-20/hub-xor-full.png',
  'image-journal-2026-11-20/mirror-lattice-preview.webp',
  'image-journal-2026-11-20/mirror-lattice.webp',
  'image-journal-2026-11-20/pendulum-0004-copper-preview.webp',
  'image-journal-2026-11-20/pendulum-0004-copper.png',
  'image-journal-2026-11-20/pendulum-0004-rgb-preview.webp',
  'image-journal-2026-11-20/pendulum-0004-rgb.png',
  'image-journal-2026-11-20/pendulum-0004-turquoise-preview.webp',
  'image-journal-2026-11-20/pendulum-0004-turquoise.png',
  'image-journal-2026-11-20/pendulum-0004-wolfram-90-preview.webp',
  'image-journal-2026-11-20/pendulum-0004-wolfram-90.png',
  'image-journal-2026-11-20/pendulum-0064-copper-preview.webp',
  'image-journal-2026-11-20/pendulum-0064-copper.png',
  'image-journal-2026-11-20/pendulum-0064-rgb-preview.webp',
  'image-journal-2026-11-20/pendulum-0064-rgb.png',
  'image-journal-2026-11-20/pendulum-0064-turquoise-preview.webp',
  'image-journal-2026-11-20/pendulum-0064-turquoise.png',
  'image-journal-2026-11-20/pendulum-0064-wolfram-90-preview.webp',
  'image-journal-2026-11-20/pendulum-0064-wolfram-90.png',
  'image-journal-2026-11-20/pendulum-0176-copper-preview.webp',
  'image-journal-2026-11-20/pendulum-0176-copper.png',
  'image-journal-2026-11-20/pendulum-0176-rgb-preview.webp',
  'image-journal-2026-11-20/pendulum-0176-rgb.png',
  'image-journal-2026-11-20/pendulum-0176-turquoise-preview.webp',
  'image-journal-2026-11-20/pendulum-0176-turquoise.png',
  'image-journal-2026-11-20/pendulum-0176-wolfram-90-preview.webp',
  'image-journal-2026-11-20/pendulum-0176-wolfram-90.png',
  'image-journal-2026-11-20/pendulum-0508-copper-preview.webp',
  'image-journal-2026-11-20/pendulum-0508-copper.png',
  'image-journal-2026-11-20/pendulum-0508-rgb-preview.webp',
  'image-journal-2026-11-20/pendulum-0508-rgb.png',
  'image-journal-2026-11-20/pendulum-0508-turquoise-preview.webp',
  'image-journal-2026-11-20/pendulum-0508-turquoise.png',
  'image-journal-2026-11-20/pendulum-0508-wolfram-90-preview.webp',
  'image-journal-2026-11-20/pendulum-0508-wolfram-90.png',
  'image-journal-2026-11-20/rhombus-mosaic-preview.webp',
  'image-journal-2026-11-20/rhombus-mosaic.webp',
]);


export function getFormat(file) { return FILE.exec(file || '')?.[1]; }
export function isPublicMediaKey(key) { return isUploadKey(key) || ARCHIVE_KEYS.has(key); }
export function isUploadKey(key) { return key.startsWith(PREFIX) && Boolean(getFormat(key.slice(PREFIX.length))); }
export function uploadFile(format) {
  if (!MIME.has(format)) return null;
  const rank = String(9999999999999 - Date.now()).padStart(13, '0');
  return rank + '-' + crypto.randomUUID() + '.' + format;
}
export function freshFile(file) {
  return getFormat(file) && Math.abs(9999999999999 - Number(file.slice(0,13)) - Date.now()) <= 15*60000;
}
export function mediaType(format) {
  return {kind: format === 'gif' ? 'gif' : format === 'png' ? 'image' : 'video', mime:MIME.get(format)};
}

function byteRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value);
  if (!match || (!match[1] && !match[2])) return null;
  const offset = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size-1, Number(match[2])) : size-1;
  if (!Number.isSafeInteger(offset) || offset >= size || end < offset) return null;
  return {offset, length:end-offset+1};
}

export async function serveMedia(request, bucket, key, reply) {
  if (!isPublicMediaKey(key)) return reply({}, 404);
  const rangeHeader = request.method === 'GET' && request.headers.get('Range');
  let item = request.method === 'HEAD' || rangeHeader ? await bucket.head(key) : await bucket.get(key);
  if (!item) return reply({}, 404);
  const type = isUploadKey(key) ? MIME.get(getFormat(key.slice(PREFIX.length)))
    : key.endsWith('.webp') ? 'image/webp' : MIME.get(key.split('.').pop());
  const headers = new Headers({'Content-Type':type,
    'Content-Length':String(item.size), 'Cache-Control':'public, max-age=31536000, immutable',
    'Accept-Ranges':'bytes', ETag:item.httpEtag, 'X-Content-Type-Options':'nosniff'});
  let status = 200;
  if (rangeHeader) {
    const ifRange = request.headers.get('If-Range');
    let range;
    if (!ifRange || ifRange === item.httpEtag) {
      range = byteRange(rangeHeader,item.size);
      if (!range) return reply({},416,{'Content-Range':'bytes */'+item.size});
      headers.set('Content-Range','bytes '+range.offset+'-'+(range.offset+range.length-1)+'/'+item.size);
      headers.set('Content-Length',String(range.length));
      status = 206;
    }
    item = await bucket.get(key,range ? {range} : undefined);
    if (!item) return reply({},404);
  }
  return new Response(item.body || null, {status,headers});
}

function validHeader(format, bytes, size, width, height) {
  const text = String.fromCharCode(...bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (format === 'gif') {
    return bytes.length >= 13 && /^GIF(?:87|89)a/.test(text) &&
      view.getUint16(6,true) === width && view.getUint16(8,true) === height;
  }
  if (format === 'mp4') {
    if (bytes.length < 16 || text.slice(4,8) !== 'ftyp') return false;
    const boxSize = view.getUint32(0);
    if (boxSize < 16 || boxSize > size || boxSize % 4 !== 0) return false;
    return /^(?:iso[m2-9]|mp4[12]|avc1|dash|M4V )$/.test(text.slice(8,12));
  }
  if (bytes.length < 12 || view.getUint32(0) !== 0x1a45dfa3) return false;
  // The EBML DocType field in WebM carries the four ASCII bytes "webm".
  return bytes.some((b,i) => {
    if (b !== 0x42 || bytes[i+1] !== 0x82) return false;
    const first = bytes[i+2];
    if (!first) return false;
    const extra = Math.clz32(first)-24;
    let length = first ^ (0x80 >> extra);
    for (let j=0; j<extra; j++) length = length*256 + bytes[i+3+j];
    const start = i+3+extra;
    return length===4 && text.slice(start,start+4)==='webm';
  });
}

// Read only the bounded state prefix. Forward the remaining media with backpressure.
async function splitScene(body, byteLength) {
  const reader = body.getReader(), prefix = new Uint8Array(byteLength);
  let filled = 0, tail;
  while (filled < byteLength) {
    const {value,done} = await reader.read();
    if (done) { reader.releaseLock(); return null; }
    const take = Math.min(value.length,byteLength-filled);
    prefix.set(value.subarray(0,take),filled);
    filled += take;
    if (take < value.length) tail = value.subarray(take);
  }
  const stream = new ReadableStream({
    start(controller) { if (tail) controller.enqueue(tail); tail = null; },
    async pull(controller) {
      const {value,done} = await reader.read();
      if (done) { reader.releaseLock(); controller.close(); }
      else controller.enqueue(value);
    },
    cancel(reason) { return reader.cancel(reason); }
  });
  return {text:new TextDecoder().decode(prefix),stream};
}

export async function uploadMedia(request, env, url, reply, reserve, prepareScene) {
  if (request.method !== 'POST') return reply({},405);
  const file = url.searchParams.get('file'), format = getFormat(file);
  if (!freshFile(file) || format === 'png') return reply({error:'Срок отправки истёк или неверный формат файла.'},400);
  const mime = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (mime !== MIME.get(format)) return reply({error:'Для журнала нужен GIF, MP4 или WebM.'},415);
  const headerLength = request.headers.get('Content-Length'), declared = url.searchParams.get('size');
  const prefixSize = Number(url.searchParams.get('sceneBytes') || 0);
  if (!Number.isSafeInteger(prefixSize) || prefixSize < 0 || prefixSize > 416384)
    return reply({error:'Некорректный размер параметров записи.'},400);
  const size = headerLength == null ? Number(declared) : Number(headerLength) - prefixSize;
  if (!request.body || !Number.isSafeInteger(size) || size <= 0 || size > MAX_MEDIA)
    return reply({error:'Для журнала нужен файл до 64 МиБ.'},413);
  if (declared !== null && Number(declared) !== size) return reply({error:'Размер загрузки изменился.'},400);
  const width = Number(url.searchParams.get('width')), height = Number(url.searchParams.get('height'));
  const duration = Number(url.searchParams.get('duration'));
  if (![width,height].every(n=>Number.isInteger(n) && n>0 && n<=32768) || width*height>32*1024*1024 ||
      !Number.isFinite(duration) || duration<0 || duration>Number.MAX_SAFE_INTEGER || (format!=='gif' && duration===0))
    return reply({error:'Неверные размеры или длительность записи.'},400);
  const limited = await reserve(request,env);
  if (limited) return limited;

  let body = request.body, scene;
  if (prefixSize) {
    const prefix = await splitScene(body,prefixSize);
    if (!prefix) return reply({error:'Неполные параметры записи.'},400);
    body = prefix.stream;
    scene = await prepareScene(env.MEDIA,prefix.text);
    if (!scene) { await body.cancel(); return reply({error:'Некорректная ссылка на начало записи.'},400); }
  }

  const sample = new Uint8Array(Math.min(1024,size));
  let received = 0, last, invalid;
  function fail() {
    invalid = true;
    throw new Error('Недопустимый медиафайл.');
  }
  const validate = new TransformStream({
    transform(chunk, controller) {
      if (received < sample.length) {
        const count = Math.min(chunk.byteLength,sample.length-received);
        sample.set(chunk.subarray(0,count),received);
        if (received+count === sample.length && !validHeader(format,sample,size,width,height)) fail();
      }
      received += chunk.byteLength;
      if (received > size) fail();
      if (received === size) last = chunk;
      else controller.enqueue(chunk);
    },
    async flush(controller) {
      if (!last || received !== size || (format==='gif' && last[last.length-1]!==0x3b)) fail();
      if (scene) await scene.save();
      controller.enqueue(last);
    }
  });
  // R2 needs a known-length stream. Keep the last chunk until validation has completed.
  const stream = new FixedLengthStream(size);
  const cancel = new AbortController();
  const transfer = body.pipeThrough(validate).pipeTo(stream.writable,{signal:cancel.signal});
  const key = PREFIX + file;
  const writing = env.MEDIA.put(key,stream.readable,{
    onlyIf:new Headers({'If-None-Match':'*'}), httpMetadata:{contentType:mime},
    customMetadata:{width:String(width),height:String(height),duration:String(duration),...scene?.metadata}
  }).finally(()=>cancel.abort());
  const [copied,saved] = await Promise.allSettled([transfer,writing]);
  if (invalid) return reply({error:'Данные файла не соответствуют GIF, MP4 или WebM.'},400);
  if (saved.status === 'rejected') throw saved.reason;
  if (saved.value && copied.status === 'rejected' && copied.reason?.name !== 'AbortError') throw copied.reason;
  return reply({url:url.origin + '/' + key}, saved.value ? 201 : 200);
}
