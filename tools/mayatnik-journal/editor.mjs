import { DurableObject } from 'cloudflare:workers';

import { isUploadKey } from './media.mjs';

const ARCHIVE = /^image-journal-\d{4}-\d{2}-\d{2}\/[a-z0-9-]+\.(?:png|webp|gif)$/;
const tokenPattern = /^[a-f0-9]{64}$/;
const ttl = 4 * 60 * 60 * 1000;
const reply = (value, status = 200, headers = {}) => Response.json(value, {status, headers});
async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}

export class JournalEditor extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, expires INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS withdrawn (key TEXT PRIMARY KEY)');
  }
  start(id) {
    const now = Date.now();
    this.sql.exec('DELETE FROM sessions WHERE expires <= ?', now);
    this.sql.exec('INSERT INTO sessions VALUES (?, ?)', id, now + ttl);
  }
  valid(id) {
    return this.sql.exec('SELECT 1 FROM sessions WHERE id = ? AND expires > ?', id, Date.now()).toArray().length === 1;
  }
  end(id) { this.sql.exec('DELETE FROM sessions WHERE id = ?', id); }
  hide(key) { this.sql.exec('INSERT OR IGNORE INTO withdrawn VALUES (?)', key); }
  hidden() { return this.sql.exec('SELECT key FROM withdrawn').toArray().map(row => row.key); }
}

export async function editorRoute(request, env, url) {
  const editor = env.EDITOR.get(env.EDITOR.idFromName('journal'));
  const action = url.pathname.slice('/mayatnik-api/editor/'.length);
  if (action === 'hidden' && request.method === 'GET') return reply({keys:await editor.hidden()});
  if (request.method !== 'POST') return reply({}, 405);
  if (request.headers.get('Origin') !== 'https://1001100.online') return reply({}, 403);
  let body;
  try {
    const reader = request.body.getReader();
    const chunks = [];
    let length = 0;
    for (;;) {
      const {value,done} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 2048) { await reader.cancel(); return reply({}, 413); }
      chunks.push(value);
    }
    body = JSON.parse(await new Blob(chunks).text());
    if (!body || typeof body !== 'object') return reply({}, 400);
  } catch { return reply({}, 400); }
  if (action === 'login') {
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip || !tokenPattern.test(env.JOURNAL_EDITOR_PASSWORD_HASH || '')) return reply({error:'Вход временно недоступен.'}, 503);
    const delay = await env.LIMITS.get(env.LIMITS.idFromName('editor:' + ip)).reserve();
    if (delay) return reply({error:'Повторите вход через ' + delay + ' с.'}, 429, {'Retry-After':String(delay)});
    const actual = await digest(typeof body.password === 'string' ? body.password : '');
    let difference = 0;
    for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ env.JOURNAL_EDITOR_PASSWORD_HASH.charCodeAt(i);
    if (difference) return reply({error:'Проверьте пароль редактора.'}, 401);
    const token = (crypto.randomUUID() + crypto.randomUUID()).replaceAll('-', '');
    await editor.start(await digest(token));
    return reply({token});
  }
  if (!tokenPattern.test(body.token || '')) return reply({error:'Войдите как редактор.'}, 401);
  const id = await digest(body.token);
  if (!await editor.valid(id)) return reply({error:'Сеанс завершён. Войдите снова.'}, 401);
  if (action === 'check') return reply({ok:true});
  if (action === 'logout') { await editor.end(id); return reply({ok:true}); }
  if (!['remove','unlist'].includes(action)) return reply({}, 404);
  const key = body.key;
  if (typeof key !== 'string' || !(isUploadKey(key) || ARCHIVE.test(key))) return reply({error:'Неизвестная картинка.'}, 400);
  await editor.hide(key);
  if (action === 'remove' && isUploadKey(key)) await env.MEDIA.delete(key);
  return reply({ok:true});
}
