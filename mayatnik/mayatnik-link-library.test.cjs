'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const LL = require('./mayatnik-link-library.js');

function memory(){
  const map=new Map();
  return {map,read:async key=>map.has(key)?structuredClone(map.get(key)):undefined,write:async(value,key)=>{if(value==null)map.delete(key);else map.set(key,structuredClone(value));}};
}
const LINK='https://1001100.online/mayatnik/Zerkalius-mayatnik.html#s=1.AbCd-_12';
function host(store){
  const calls={copy:[],restore:[],download:[]};
  return {
    storage:store,calls,
    capture:async()=>({link:LINK,summary:'128 строк · кадр 107 из 512 · Перескок · Биты',name:'Ссылка 128 строк · кадр 107 · Перескок'}),
    restore:async link=>{calls.restore.push(link);},
    copy:async link=>{calls.copy.push(link);return true;},
    download:async(blob,name)=>{calls.download.push([name,await blob.text()]);}
  };
}

test('сохранение ссылки копирует её и кладёт в библиотеку', async () => {
  const store=memory(),api=LL.create(host(store));
  await api.ready;
  const id=await api.save();
  const item=api.list()[0];
  assert.equal(item.id,id);
  assert.equal(item.link,LINK);
  assert.equal(item.name,'Ссылка 128 строк · кадр 107 · Перескок');
  assert.match(item.summary,/Перескок/);
  assert.match(item.thumbnail,/^data:image\/svg\+xml/);
  assert.deepEqual(store.map.get(LL.KEY).items[0].link, LINK);
});

test('библиотека переживает перезагрузку и открывает ссылку', async () => {
  const store=memory(),first=host(store),api=LL.create(first);
  await api.ready;const id=await api.save('Моя ссылка');await api.idle();
  const second=host(store),again=LL.create(second);
  await again.ready;
  assert.equal(again.list().length,1);
  assert.equal(again.list()[0].name,'Моя ссылка');
  await again.open(id);
  assert.deepEqual(second.calls.restore,[LINK]);
});

test('копирование, переименование и удаление ссылки', async () => {
  const store=memory(),h=host(store),api=LL.create(h);
  await api.ready;const id=await api.save('Ссылка 1');
  assert.equal(await api.copy(id),true);
  assert.equal(h.calls.copy.length,2,'одна копия при сохранении, одна по кнопке');
  await api.rename(id,'Ссылка 2');
  assert.equal(api.list()[0].name,'Ссылка 2');
  await api.download(id);
  assert.equal(h.calls.download[0][0],'Ссылка 2');
  assert.equal(h.calls.download[0][1].trim(),LINK);
  await api.remove(id);
  assert.equal(api.list().length,0);
});

test('сбой буфера обмена не отменяет сохранение', async () => {
  const store=memory(),h=host(store);h.copy=async()=>{throw Error('буфер закрыт');};
  const api=LL.create(h);await api.ready;
  const id=await api.save('Без буфера');
  assert.equal(api.list().length,1);
  assert.equal(api.getState().selectedId,id);
  assert.match(api.getState().message,/сохранена/);
});

test('битая библиотека не тихо теряется', async () => {
  const store=memory();
  store.map.set(LL.KEY,{version:1,items:[{id:'x',name:'Ссылка',createdAt:1,link:'https://example.com/no-code'}]});
  const api=LL.create(host(store));
  await assert.rejects(api.ready,/повреждена/);
  store.map.set(LL.KEY,{version:2,items:[]});
  await assert.rejects(LL.create(host(store)).ready,/формат/);
});

test('экспорт ссылки — текстовый файл', async () => {
  const api=LL.create(host(memory()));await api.ready;
  const id=await api.save('Экспорт');
  const item=await api.exportItem(id);
  assert.equal(item.files[0].extension,'.txt');
  assert.equal((await item.files[0].blob.text()).trim(),LINK);
});
