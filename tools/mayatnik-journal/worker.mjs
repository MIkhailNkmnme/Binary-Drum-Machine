import { DurableObject } from 'cloudflare:workers';

const ORIGIN = 'https://1001100.online';
const FILE = /^\d{13}-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.png$/;
function newFile() {
  const rank = String(9999999999999 - Date.now()).padStart(13, '0');
  return rank + '-' + crypto.randomUUID() + '.png';
}
const PREFIX = 'from-mayatnik/';
const MAX_BYTES = 8 * 1024 * 1024;
const WINDOW = 60000;

export class UploadWindow extends DurableObject {
  async reserve() {
    return this.ctx.storage.transaction(async tx => {
      const now = Date.now();
      const recent = (await tx.get('times') || []).filter(t => t > now - WINDOW);
      if (recent.length >= 10) return Math.ceil((recent[0] + WINDOW - now) / 1000);
      recent.push(now);
      await tx.put('times', recent);
      await tx.setAlarm(now + WINDOW);
      return 0;
    });
  }
  async alarm() {
    await this.ctx.storage.transaction(async tx => {
      const times = await tx.get('times');
      if (times && times.at(-1) + WINDOW <= Date.now()) await tx.delete('times');
    });
  }
}

function reply(body, status = 200, extra = {}) {
  return Response.json(body, {status, headers: {
    'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Expose-Headers': 'Retry-After',
    'Cache-Control': 'no-store', ...extra
  }});
}

// Accept the non-interlaced, eight-bit RGB/RGBA format emitted by canvas.
// Drop ancillary data and verify the compressed raster before making it public.
const crcTable = Uint32Array.from({length:256}, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function readPng(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data.length < 45 || view.getUint32(0) !== 0x89504e47 || view.getUint32(4) !== 0x0d0a1a0a) return null;
  const parts = [data.subarray(0, 8)], compressed = [];
  let width, height, stride, ended = false;
  for (let i = 8, count = 0; i < data.length; ) {
    if (i + 12 > data.length || ++count > 8192) return null;
    const size = view.getUint32(i), end = i + size + 12;
    if (end > data.length || crc32(data.subarray(i+4,end-4)) !== view.getUint32(end-4)) return null;
    const tag = String.fromCharCode(...data.subarray(i + 4, i + 8));
    if (i === 8 && tag !== 'IHDR') return null;
    if (tag === 'IHDR') {
      if (i !== 8 || size !== 13) return null;
      width = view.getUint32(i+8); height = view.getUint32(i+12);
      const colour = data[i+17];
      if (!width || !height || width > 32768 || height > 32768 || width*height > 32*1024*1024 ||
          data[i+16] !== 8 || ![2,6].includes(colour) || data[i+18] || data[i+19] || data[i+20]) return null;
      stride = 1 + width * (colour === 6 ? 4 : 3);
    } else if (tag === 'IDAT') {
      compressed.push(data.subarray(i+8, end-4));
    } else if (tag === 'IEND') {
      if (size || end !== data.length || !compressed.length) return null;
      ended = true;
    } else if (['sRGB','gAMA','cHRM','pHYs'].includes(tag)) {
      // Retain the colour space and resolution of a canvas PNG.
    } else if (data[i+4] & 32) { i = end; continue; }
    else return null;
    parts.push(data.subarray(i, end)); i = end;
  }
  if (!ended) return null;
  let length = 0;
  try {
    const stream = new Blob(compressed).stream().pipeThrough(new DecompressionStream('deflate'));
    for await (const chunk of stream) {
      if (length + chunk.length > height * stride) return null;
      for (let j = (stride - length % stride) % stride; j < chunk.length; j += stride) if (chunk[j] > 4) return null;
      length += chunk.length;
    }
  } catch { return null; }
  return length === height * stride ? {width, height, blob: new Blob(parts, {type:'image/png'})} : null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/mayatnik-api/ready') return reply({file:newFile()});
    if (['GET','HEAD'].includes(request.method) && url.pathname.startsWith('/' + PREFIX)) {
      const key = url.pathname.slice(1);
      if (!FILE.test(key.slice(PREFIX.length))) return reply({}, 404);
      const object = request.method === 'GET' ? await env.MEDIA.get(key) : await env.MEDIA.head(key);
      if (!object) return reply({}, 404);
      return new Response(object.body || null, {headers:{'Content-Type':'image/png',
        'Content-Length':String(object.size), 'Cache-Control':'public, max-age=31536000, immutable',
        'ETag':object.httpEtag, 'X-Content-Type-Options':'nosniff'}});
    }
    if (url.pathname !== '/mayatnik-api/frames') return reply({}, 404);
    if (request.method === 'OPTIONS') return reply({}, 200, {'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});
    try {
      if (request.method === 'GET') {
        const page = await env.MEDIA.list({prefix:PREFIX, limit:24, cursor:url.searchParams.get('cursor') || undefined, include:['customMetadata']});
        const frames = page.objects.map(obj => ({url:url.origin + '/' + obj.key, frame:Number(obj.customMetadata.frame),
          width:Number(obj.customMetadata.width), height:Number(obj.customMetadata.height), created:obj.uploaded.toISOString()}));
        return reply({frames, cursor:page.truncated ? page.cursor : null});
      }
      if (request.method !== 'POST') return reply({}, 405);
      if (request.headers.get('Origin') !== ORIGIN) return reply({error:'Откройте Маятник на 1001100.online.'}, 403);
      const type = request.headers.get('Content-Type');
      if (type && type !== 'image/png') return reply({error:'Нужен PNG.'}, 415);
      const frame = url.searchParams.get('frame');
      if (!/^\d{1,10}$/.test(frame ?? '')) return reply({error:'Некорректный номер кадра.'}, 400);
      const file = url.searchParams.get('file') ?? newFile();
      if (!FILE.test(file) || Math.abs(9999999999999 - Number(file.slice(0,13)) - Date.now()) > 15*60000)
        return reply({error:'Срок отправки истёк. Нажмите кнопку ещё раз.'}, 400);
      const key = PREFIX + file;
      const length = Number(request.headers.get('Content-Length'));
      if (!request.body || length > MAX_BYTES) return reply({error:'Для журнала нужен PNG до 8 МиБ.'}, 413);
      const ip = request.headers.get('CF-Connecting-IP');
      if (!ip) return reply({error:'Не удалось определить адрес для ограничения частоты.'}, 503);
      const limiter = env.LIMITS.get(env.LIMITS.idFromName(ip));
      const retry = await limiter.reserve();
      if (retry) return reply({error:'Лимит 10 загрузок в минуту. Повторите через ' + retry + ' с.'}, 429, {'Retry-After':String(retry)});
      const chunks = [];
      let received = 0;
      for await (const chunk of request.body) {
        received += chunk.length;
        if (received > MAX_BYTES) return reply({error:'Для журнала нужен PNG до 8 МиБ.'}, 413);
        chunks.push(chunk);
      }
      const png = await readPng(new Uint8Array(await new Blob(chunks).arrayBuffer()));
      if (!png) return reply({error:'Нужен корректный PNG из Маятника до 32 Мпикс.'}, 400);
      // Lexicographic R2 listing returns the most recent images first.
      const saved = await env.MEDIA.put(key, png.blob, {onlyIf:new Headers({'If-None-Match':'*'}), httpMetadata:{contentType:'image/png'}, customMetadata:{
        frame, width:String(png.width), height:String(png.height)
      }});
      return reply({url:url.origin + '/' + key}, saved ? 201 : 200);
    } catch {
      return reply({error:'Сервис журнала временно недоступен.'}, 503);
    }
  }
};
