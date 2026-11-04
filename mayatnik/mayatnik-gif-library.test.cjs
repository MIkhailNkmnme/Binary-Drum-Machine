'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{create}=require('./mayatnik-gif-library.js');
function storage(initial=[]){const data=new Map(initial);return {data,async read(key){return structuredClone(data.get(key));},async write(value,key){data.set(key,structuredClone(value));}};}
const gif=()=>new Blob(['GIF89a'],{type:'image/gif'});
test('GIF and preview persist with frozen metadata, one scales folder, and unrelated folders/items untouched',async()=>{
 const old={id:'old',name:'Old',folderId:'other',metadata:{},createdAt:1},cache=storage([['gif-library-v1',{version:1,folders:[{id:'other',name:'Другое'},{id:'existing-scales',name:'Масштабы'}],items:[old]}],['unrelated',{keep:1}]]),api=create(cache),input={blob:gif(),preview:new Blob(['png'],{type:'image/png'}),name:'Variant.gif',metadata:{delay:450,method:'canvas',presentation:'pixels'}};
 const pending=api.save(input);input.metadata.delay=999;const entry=await pending;await api.save({blob:gif(),name:'Second.gif'});
 assert.equal(entry.folderId,'existing-scales');assert.equal(entry.metadata.delay,450);assert.equal(api.folders().filter(e=>e.name==='Масштабы').length,1);assert.deepEqual(api.list()[0],old);assert.deepEqual(cache.data.get('unrelated'),{keep:1});
 const restored=create(cache);await restored.ready;const loaded=await restored.read(entry.id);assert.equal(await loaded.blob.text(),'GIF89a');assert.equal(await loaded.preview.text(),'png');assert.equal(loaded.metadata.presentation,'pixels');const copy=restored.list();copy[1].metadata.delay=2;assert.equal(restored.list()[1].metadata.delay,450);
});
test('concurrent saves retain every GIF and create the scales folder once',async()=>{
 const api=create(storage());const entries=await Promise.all(Array.from({length:8},(_,i)=>api.save({blob:gif(),name:i+'.gif'})));assert.equal(new Set(entries.map(e=>e.id)).size,8);assert.equal(api.list().length,8);assert.deepEqual(api.folders(),[{id:'gif-scales',name:'Масштабы'}]);
});
test('failed index write rejects without publishing a card, recovers on retry, and delete preserves other assets',async()=>{
 const cache=storage(),write=cache.write;let fail=true;cache.write=async(value,key)=>{if(key==='gif-library-v1'&&fail)throw Error('quota');return write(value,key);};const api=create(cache);await assert.rejects(api.save({blob:gif()}),/quota/);assert.deepEqual(api.list(),[]);assert.ok([...cache.data.values()].every(e=>e===null));
 fail=false;const a=await api.save({blob:gif(),name:'a'}),b=await api.save({blob:gif(),name:'b'});await api.remove(a.id);assert.deepEqual(api.list().map(e=>e.id),[b.id]);assert.equal(await (await api.read(b.id)).blob.text(),'GIF89a');await assert.rejects(api.read(a.id),/библиотеке/);
});
test('malformed library and non-GIF input reject instead of replacing saved data',async()=>{
 const cache=storage([['gif-library-v1',{version:19,items:[]}]]),api=create(cache);await assert.rejects(api.ready,/Повреждена/);await assert.rejects(api.save({blob:gif()}),/Повреждена/);assert.equal(cache.data.get('gif-library-v1').version,19);await assert.rejects(create(storage()).save({blob:new Blob(['png'],{type:'image/png'})}),/GIF/);
});
let JSDOM;try{({JSDOM}=require('jsdom'));}catch(_){({JSDOM}=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom'));}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('host save does not open the library; GIF subsection supports preview/download/delete and detached access',async()=>{
 const dom=new JSDOM('<button id="bTemplatePanel"></button><button id="bTemplateSave" disabled></button>',{url:'https://example.test/mayatnik/',runScripts:'outside-only'}),w=dom.window;w.structuredClone=structuredClone;w.requestAnimationFrame=()=>1;w.MayatnikPaintCache=storage();w.HTMLCanvasElement.prototype.getContext=()=>null;w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.confirm=()=>true;const views=[],downloads=[];w.MayatnikGifViewer={show:(blob,options)=>views.push(options)};w.HTMLAnchorElement.prototype.click=function(){downloads.push(this.download);};w.setTimeout=()=>1;
 try{for(const file of ['mayatnik-template-folders.js','mayatnik-gif-library.js','mayatnik-template-panel.js'])w.eval(fs.readFileSync(__dirname+'/'+file,'utf8'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));const entry=await w.mayatnikLibrarySaveGifScale({blob:gif(),preview:new Blob(['png'],{type:'image/png'}),name:'Chosen.gif',metadata:{delay:250}});assert.equal(w.MayatnikTemplatePanel.isOpen(),false);
  w.MayatnikTemplatePanel.openTab('gif');await tick();assert.equal(w.document.querySelector('[data-gif-folder] h3').textContent,'Масштабы');const card=w.document.querySelector('[data-gif-id="'+entry.id+'"]');assert.ok(card);assert.equal(card.querySelector('img').src,'blob:test');card.querySelector('.mtp-preview').click();await tick();assert.equal(views[0].name,'Chosen.gif');assert.equal(views[0].delay,250);card.querySelector('.mtp-card-actions button').click();await tick();assert.deepEqual(downloads,['Chosen.gif']);card.querySelector('.mtp-card-actions button:last-child').click();await tick();assert.equal(w.mayGifLibrary.list().length,0);
  w.MayatnikLibraryDetached=true;w.opener={MayatnikTemplatePanel:{getGifLibrary:()=>w.mayGifLibrary}};await w.mayatnikLibrarySaveGifScale({blob:gif(),name:'Detached.gif'});assert.equal(w.mayGifLibrary.list()[0].name,'Detached.gif');
 }finally{w.dispatchEvent(new w.Event('pagehide'));w.close();}
});
