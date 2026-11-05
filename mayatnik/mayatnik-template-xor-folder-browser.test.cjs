const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {create,KEY}=require('./mayatnik-template-folders.js');
const ids=[...Array.from({length:4},(_,i)=>'xor-axes:figure:'+(i+1)),...Array.from({length:24},(_,i)=>'xor-axes:cross:'+String(i+1).padStart(2,'0'))];
test('XOR migration seeds once and preserves unrelated folders, references and deleted folder on reload',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 let model=create(storage);assert.equal(model.seedGroup('folder:xor-axes','Оси XOR',[]),false);assert.equal(model.snapshot().seededGroups,undefined);const custom=model.addFolder('Мои');model.reconcile(['saved:1']);model.move('template','saved:1',custom);
 model.seedGroup('folder:xor-axes','Оси XOR',ids);model.reconcile([...ids,'saved:1']);assert.equal(model.children('folder:xor-axes').length,28);
 model.rename('folder:xor-axes','Переименовано');model.move('template',ids[0],custom);model=create(storage);model.seedGroup('folder:xor-axes','Оси XOR',ids);
 assert.equal(model.children(custom).length,2);assert.equal(model.snapshot().nodes.find(n=>n.id==='folder:xor-axes').name,'Переименовано');
 model.removeFolder('folder:xor-axes');model=create(storage);model.seedGroup('folder:xor-axes','Оси XOR',ids);model.reconcile([...ids,'saved:1']);
 assert.equal(model.snapshot().nodes.some(n=>n.id==='folder:xor-axes'),false);assert.equal(model.children('').filter(n=>n.kind==='template').length,27);assert.ok(JSON.parse(values.get(KEY)).seededGroups.includes('folder:xor-axes'));
});
let chromium;try{({chromium}=require('playwright-core'));}catch{}
const chrome=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
test('Chromium: 28 XOR cards survive F5; frame search captures descendants and keeps its scope while browsing',{skip:!chromium||!fs.existsSync(chrome)},async()=>{
 const fixture=`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="mayatnik-template-panel.css"><body><script src="mayatnik-template-folders.js"></script><script>
 const ids=${JSON.stringify(ids)}, entries=ids.map((id,i)=>({id,name:'XOR '+i,parts:[{width:1,height:1,data:new Uint32Array([0xff000000])}]}));
 window.MayatnikXorAxesTemplates={entries:()=>entries};
 window.mayTemplateLibrary={allIds:()=>ids,list:()=>entries,getState:()=>({}),subscribe:()=>()=>{},refresh:()=>{}};
 let state={on:false},listeners=new Set();window.searchCalls=[];window.updateSearch=value=>{state={...state,...value};listeners.forEach(fn=>fn(state))};
 window.mayTemplateFrameSearch={snapshot:()=>structuredClone(state),subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},async enable(ids,{name}){searchCalls.push({ids,name});updateSearch({on:true,busy:false,frame:7,count:12,name,entryIds:ids,entries:ids.map((id,i)=>({id,count:i===0?12:0}))})},off(){updateSearch({on:false})}};
 </script><script src="mayatnik-template-panel.js"></script>`;
 const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.split('/').pop();if(name==='fixture.html'){res.setHeader('Content-Type','text/html');res.end(fixture);return;}const file=path.join(__dirname,name);fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',name.endsWith('.css')?'text/css':'application/javascript');res.end(data);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:chrome,headless:true});
 try{const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/fixture.html');
  const open=async()=>{await page.evaluate(()=>MayatnikTemplatePanel.setOpen(true));await page.getByTitle('Открыть папку Оси XOR',{exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('[data-template-id]').length===28);};
  await open();await page.reload();await open();
  assert.equal(await page.locator('[data-template-id]').first().locator('.mtp-preview').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(232, 237, 245)');
  const size=await page.locator('[data-template-frame-search]').boundingBox();assert.equal(size.width,120);assert.equal(size.height,24);
  await page.locator('[data-template-frame-search]').click();let calls=await page.evaluate(()=>searchCalls);assert.deepEqual(calls[0],{ids,name:'Оси XOR'});await page.locator('.mtp-frame-search-status').filter({hasText:'Кадр 7'}).waitFor();
  assert.equal(await page.locator('[data-template-frame-count]:visible').count(),28);assert.equal(await page.locator('[data-template-id="'+ids[0]+'"] [data-template-frame-count]').textContent(),'Кадр 7 · найдено 12');assert.equal(await page.locator('[data-template-id="'+ids[1]+'"] [data-template-frame-count]').textContent(),'Кадр 7 · найдено 0');
  await page.evaluate(()=>updateSearch({busy:true,frame:8}));assert.equal(await page.locator('[data-template-id="'+ids[0]+'"] [data-template-frame-count]').textContent(),'Кадр 8 · Поиск…');assert.equal(await page.locator('[data-template-frame-count]').filter({hasText:'найдено'}).count(),0);
  await page.evaluate(()=>updateSearch({busy:false,count:2,entries:ids.map((id,i)=>({id,count:i===1?2:0}))}));assert.equal(await page.locator('[data-template-id="'+ids[1]+'"] [data-template-frame-count]').textContent(),'Кадр 8 · найдено 2');
  await page.locator('.mtp-header-crumb').filter({hasText:'Шаблоны'}).click();assert.equal((await page.evaluate(()=>searchCalls)).length,1);assert.equal(await page.locator('[data-template-frame-search]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-template-frame-search]').click();
  await page.evaluate(()=>{const s=MayatnikTemplatePanel.getFolderStore(),p=s.addFolder('Родитель'),c=s.addFolder('Вложенная',p);s.move('template',ids[0],p);s.move('template',ids[1],c);window.parentId=p;});
  await page.getByTitle('Открыть папку Родитель',{exact:true}).click();await page.locator('[data-template-frame-search]').click();calls=await page.evaluate(()=>searchCalls);assert.deepEqual(calls[1],{ids:ids.slice(0,2),name:'Родитель'});
  await page.evaluate(()=>{const s=MayatnikTemplatePanel.getFolderStore();s.rename('folder:xor-axes','Мои XOR');});await page.reload();await page.evaluate(()=>MayatnikTemplatePanel.setOpen(true));await page.getByTitle('Открыть папку Мои XOR',{exact:true}).waitFor();
  await page.evaluate(()=>MayatnikTemplatePanel.getFolderStore().removeFolder('folder:xor-axes'));await page.reload();await page.evaluate(()=>MayatnikTemplatePanel.setOpen(true));assert.equal(await page.getByTitle('Открыть папку Оси XOR',{exact:true}).count(),0);assert.equal(await page.getByTitle('Открыть папку Мои XOR',{exact:true}).count(),0);assert.equal(await page.locator('[data-template-id]').count(),26);assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
