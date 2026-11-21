(() => {
  const hosts = ['https://media.1001100.online', 'https://zerkalius-mayatnik-journal.zerkalius-1001100.workers.dev'];
  let preferred = hosts[0];
  class Refused extends Error {}
  const mediaTickets = new WeakMap();
  const mediaFormats = new Map([['video/mp4', 'mp4'], ['video/webm', 'webm'], ['image/gif', 'gif']]);
  const mediaLoads = new WeakMap();
  let preferredMedia = '';

  // API availability does not guarantee that the browser can read media on that host.
  function loadMedia(media, source) {
    mediaLoads.get(media)?.();
    delete media.dataset.mediaFailed;
    media.closest('a.image-link')?.querySelector('.journal-media-failure')?.remove();
    const url = new URL(source, location.href);
    const first = preferredMedia || preferred;
    const candidates = hosts.includes(url.origin)
      ? [first, ...hosts.filter(host => host !== first)].map(host => host + url.pathname + url.search)
      : [url.href];
    const ready = media.tagName === 'VIDEO' ? 'loadedmetadata' : 'load';
    let index = 0, timer, observer, finished = false, watching = false;
    function dispose() {
      finished = true;
      clearTimeout(timer);
      observer?.disconnect();
      media.removeEventListener(ready, loaded);
      media.removeEventListener('error', failed);
      if (mediaLoads.get(media) === dispose) mediaLoads.delete(media);
    }
    function loaded() {
      if (finished) return;
      const host = new URL(candidates[index]).origin;
      if (hosts.includes(host)) preferredMedia = host;
      clearTimeout(timer);
      observer?.disconnect();
      // Keep video error handling after metadata: playback can still fail later.
      if (media.tagName !== 'VIDEO') dispose();
    }
    function watch() {
      if (finished) return;
      watching = true;
      clearTimeout(timer);
      timer = setTimeout(failed, 12000);
    }
    function failed() {
      if (finished) return;
      if (!media.isConnected) { dispose(); return; }
      clearTimeout(timer);
      if (++index < candidates.length) {
        media.src = candidates[index];
        if (watching) watch();
      } else {
        dispose();
        const link = media.closest('a.image-link');
        if (link) {
          media.dataset.mediaFailed = '';
          const notice = document.createElement('span');
          notice.className = 'journal-media-failure';
          notice.textContent = 'Не удалось загрузить изображение или видео по двум адресам. Откройте карточку, чтобы повторить.';
          link.append(notice);
        }
        media.dispatchEvent(new Event('journal-media-error'));
      }
    }
    mediaLoads.set(media, dispose);
    media.addEventListener(ready, loaded);
    media.addEventListener('error', failed);
    // A lazy image has no network deadline until it approaches the viewport.
    if (media.loading === 'lazy' && typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          observer.disconnect();
          watch();
        }
      }, {rootMargin:'300px'});
      observer.observe(media);
    } else watch();
    if (media.src !== candidates[0]) media.src = candidates[0];
    else if (media.complete) {
      if (media.naturalWidth) loaded();
      else failed();
    }
    return dispose;
  }

  async function request(path, options, timeout, first = preferred, signal) {
    for (const host of [first, ...hosts.filter(other => other !== first)]) {
      const controller = new AbortController();
      if (signal?.aborted) throw new DOMException('Публикация остановлена.', 'AbortError');
      const abort = () => controller.abort();
      signal?.addEventListener('abort', abort, {once:true});
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(host + '/mayatnik-api/' + path, {
          ...options, signal:controller.signal, cache:'no-store', credentials:'omit'
        });
        const data = await response.json();
        if (!response.ok) {
          if (response.status >= 500) continue;
          const refusal = new Refused(data.error || 'Сервис журнала отклонил запрос (HTTP ' + response.status + ').');
          refusal.status = response.status;
          throw refusal;
        }
        preferred = host;
        return {data, host};
      } catch (error) {
        if (signal?.aborted) throw new DOMException('Публикация остановлена.', 'AbortError');
        if (error instanceof Refused) throw error;
      } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
    }
    throw Error('Не удалось связаться с журналом по двум адресам.');
  }
  window.MayatnikJournal = {
    loadMedia,
    cancelMedia(media) { mediaLoads.get(media)?.(); },
    async publish(frame, blob, scene) {
      const {data, host} = await request('ready', {}, 4500);
      if (!data.file) throw Error('Сервис журнала не выдал адрес для кадра.');
      // Both endpoints receive the same key if the first confirmation is lost.
      let body;
      if (scene) {
        body = new FormData();
        body.append('png', blob, 'frame.png');
        body.append('code', scene.code);
        body.append('summary', scene.summary || '');
      } else {
        body = await blob.arrayBuffer();
      }
      const result = await request('frames?' + new URLSearchParams({frame, file:data.file}),
        {method:'POST', body}, 30000, host);
      if (!result.data.url) throw Error('Журнал не подтвердил публикацию.');
      return result.data.url;
    },
    async publishMedia(blob, {width, height, duration = 0, scene}, signal) {
      const mime = blob.type.split(';')[0].trim().toLowerCase();
      const format = mediaFormats.get(mime);
      if (!format) throw Error('Журнал принимает GIF, MP4 и WebM.');
      if (!blob.size || blob.size > 64 * 1024 * 1024) throw Error('Для журнала нужен файл до 64 МиБ.');
      if (![width,height].every(n => Number.isSafeInteger(n) && n > 0) || !Number.isFinite(duration) || duration < 0) {
        throw Error('Не удалось определить размеры или длительность записи.');
      }
      let body = blob, prefix;
      if (scene != null) {
        if (typeof scene.code !== 'string' || scene.code.length > 400000 || !/^[01]\.[A-Za-z0-9_-]+$/.test(scene.code)) {
          throw Error('Некорректная ссылка на начало записи.');
        }
        prefix = new Blob([JSON.stringify({code:scene.code, summary:String(scene.summary || '').slice(0,1024)})]);
        body = new Blob([prefix,blob],{type:mime});
      }
      let ticket = mediaTickets.get(blob);
      if (!ticket || ticket.code !== scene?.code || Date.now() >= ticket.expires) {
        const {data,host} = await request('ready?' + new URLSearchParams({format}), {}, 4500, preferred, signal);
        if (!data.file?.endsWith('.' + format)) throw Error('Журнал не выдал адрес для этого формата.');
        ticket = {file:data.file,host,code:scene?.code,expires:Date.now()+14*60000};
        mediaTickets.set(blob,ticket);
      }
      const query = new URLSearchParams({file:ticket.file, width, height, duration, size:blob.size});
      if (prefix) query.set('sceneBytes',String(prefix.size));
      const result = await request('media?' + query, {method:'POST',headers:{'Content-Type':mime},body},
        9 * 60000, ticket.host, signal);
      if (!result.data.url) throw Error('Журнал не подтвердил публикацию.');
      return result.data.url;
    },
    async scene(digest) {
      const {data} = await request('scene?' + new URLSearchParams({id:digest}), {}, 10000);
      return data.code;
    },
    async editor(action, body = {}) {
      if (!/^[a-z-]+$/.test(action)) throw Error('Неизвестная команда редактора.');
      const {data} = await request('editor/' + action, {method:'POST', body:JSON.stringify(body)}, 10000);
      return data;
    },
    async withdrawn() {
      return (await request('editor/hidden', {}, 5500)).data.keys;
    },
    async list(cursor) {
      const query = cursor ? '?' + new URLSearchParams({cursor}) : '';
      return (await request('frames' + query, {}, 5500)).data;
    }
  };
})();
