(() => {
  const hosts = ['https://media.1001100.online', 'https://zerkalius-mayatnik-journal.zerkalius-1001100.workers.dev'];
  let preferred = hosts[0];
  class Refused extends Error {}

  async function request(path, options, timeout, first = preferred) {
    for (const host of [first, ...hosts.filter(other => other !== first)]) {
      const controller = new AbortController();
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
        if (error instanceof Refused) throw error;
      } finally { clearTimeout(timer); }
    }
    throw Error('Не удалось связаться с журналом по двум адресам.');
  }
  window.MayatnikJournal = {
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
