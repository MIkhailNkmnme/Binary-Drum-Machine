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
          throw new Refused(data.error || 'Сервис журнала отклонил запрос (HTTP ' + response.status + ').');
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
    async publish(frame, blob) {
      const {data, host} = await request('ready', {}, 4500);
      if (!data.file) throw Error('Сервис журнала не выдал адрес для кадра.');
      // Both attempts use the same file name. An ArrayBuffer needs no CORS preflight.
      const result = await request('frames?' + new URLSearchParams({frame, file:data.file}),
        {method:'POST', body:await blob.arrayBuffer()}, 30000, host);
      if (!result.data.url) throw Error('Журнал не подтвердил публикацию.');
      return result.data.url;
    },
    async list(cursor) {
      const query = cursor ? '?' + new URLSearchParams({cursor}) : '';
      return (await request('frames' + query, {}, 5500)).data;
    }
  };
})();
