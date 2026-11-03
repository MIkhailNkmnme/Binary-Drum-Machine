'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
test('Music settings side window has compact coloured groups at 640/332px, live controls and independent GIF geometry',{timeout:60000},async t=>{
 let chromium;try{chromium=require(process.env.PLAYWRIGHT_PATH||'C:/Users/Mhl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright').chromium;}catch(_){t.skip('Playwright runtime unavailable');return;}
 const executablePath=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';if(!fs.existsSync(executablePath)){t.skip('Chromium unavailable');return;}
 const server=http.createServer((req,res)=>res.end('<!doctype html><html><head><meta charset="utf-8"></head><body><button id="bTemplatePanel">Library</button><button id="bTemplateSave" disabled></button><div id="rail"></div></body></html>'));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({executablePath,headless:true});const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
  for(const file of ['../_js/grozd.css','mayatnik-xorrom-controls.css','mayatnik-template-panel.css','mayatnik-button-standard.css','../_js/control-frame.css','mayatnik-music-panel.css'])await page.addStyleTag({path:path.join(__dirname,file)});
  await page.evaluate(()=>{window.MayatnikXorromBank=[];});
  for(const file of ['../_js/control-frame.js','mayatnik-template-folders.js','mayatnik-template-panel.js','mayatnik-xorrom-controls.js','mayatnik-music-panel.js'])await page.addScriptTag({path:path.join(__dirname,file)});
  await page.evaluate(()=>{
   const host=document.createElement('div');host.className='mtp-live-controls';
   let listener;const settings={backing:'chord'},tracks=[{id:1,name:'Main',color:'#c29bff',muted:false}];
   const api={getSettings:()=>settings,getState:()=>({state:'stopped'}),getRack:()=>({selected:1,tracks}),getTrackList:()=>({selected:1,tracks}),anyActive:()=>false,subscribe:fn=>(listener=fn,()=>{}),setSettings(patch){Object.assign(settings,patch);listener();},setAxis(){},getAxis:()=>null,getAxisName:()=>'',getSize:()=>({width:8,height:8}),getAxes:()=>[],addTemplates(){},getTemplate:()=>null};
   window.testControls=MayatnikXorromControls.mount(host,{api});
   const rail=document.getElementById('rail');rail.append(...host.querySelectorAll(':scope > button'));
   MayatnikMusicPanel.registerControls(host);MayatnikMusicPanel.open(document.getElementById('bTemplatePanel'));
   const gif=document.createElement('div');gif.className='mtp-live-controls mtp-gif-controls';gif.innerHTML='<button class="gz-hx may-xorrom-control">GIF</button>';MayatnikTemplatePanel.registerControls('gif',gif);
  });
  for(const width of [640,332]){
   await page.setViewportSize({width,height:900});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
   const result=await page.evaluate(()=>{
    const pane=document.getElementById('mayMusicSettingsPane'),groups=[...pane.querySelectorAll('[data-xorrom-group]')],controls=[...pane.querySelectorAll('.may-xorrom-control')];
    return {groups:groups.map(g=>({id:g.dataset.xorromGroup,colour:getComputedStyle(g).borderTopColor,width:g.getBoundingClientRect().width,right:g.getBoundingClientRect().right,controlColours:[...g.querySelectorAll('.may-xorrom-control')].map(b=>getComputedStyle(b).getPropertyValue('--c').trim())})),heights:controls.map(c=>c.getBoundingClientRect().height),buttonHeights:[...pane.querySelectorAll('button')].map(c=>c.getBoundingClientRect().height),parts:[...pane.querySelectorAll('.zcf-side,.zcf-middle,.zcf-outline')].map(c=>c.getBoundingClientRect().height),off:pane.querySelector('[data-xorrom-group=tracks] .may-xorrom-grid').firstElementChild.dataset.xorrom,rail:getComputedStyle(document.querySelector('#rail [data-xorrom=start]')).height};
   });
   assert.equal(result.groups.length,6);assert.equal(new Set(result.groups.map(g=>g.colour)).size,6);assert.ok(result.heights.every(h=>h===20),JSON.stringify(result));assert.ok(result.buttonHeights.every(h=>h===20));assert.ok(result.parts.every(h=>h===20),JSON.stringify(result.parts));assert.equal(result.off,'tracksStop');assert.equal(result.rail,'24px');
   for(const g of result.groups){assert.ok(g.right<=width+1);assert.equal(new Set(g.controlColours).size,1);}
   const target=page.locator('#mayMusicSettingsPane [data-xorrom=bpm]'),before=await target.boundingBox();await target.hover();assert.deepEqual(await target.boundingBox(),before);
   const bg=await target.evaluate(c=>getComputedStyle(c.querySelector('.zcf-middle')).backgroundColor);await page.mouse.down();assert.deepEqual(await target.boundingBox(),before);assert.equal(await target.evaluate(c=>getComputedStyle(c.querySelector('.zcf-middle')).backgroundColor),bg);await page.mouse.up();
  }
  const identity=await page.evaluate(()=>{
   const input=document.querySelector('#mayMusicSettingsPane [data-xorrom=bpm] input');input.value='133.5';input.dispatchEvent(new Event('change'));window.originalBpm=input;
   MayatnikTemplatePanel.openTab('gif');return {musicOpen:MayatnikMusicPanel.isOpen(),libraryOpen:MayatnikTemplatePanel.isOpen()};
  });assert.deepEqual(identity,{musicOpen:false,libraryOpen:true});assert.equal(await page.locator('#mayGifSettingsPane .may-xorrom-control').evaluate(c=>getComputedStyle(c).height),'24px');
  const reopened=await page.evaluate(()=>{MayatnikMusicPanel.open(document.getElementById('bTemplatePanel'));const input=document.querySelector('#mayMusicSettingsPane [data-xorrom=bpm] input');return {same:input===originalBpm,value:input.value,libraryOpen:MayatnikTemplatePanel.isOpen()};});assert.deepEqual(reopened,{same:true,value:'133.5',libraryOpen:false});
  await page.setViewportSize({width:1000,height:900});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));const separator=page.locator('.may-music-resize');await separator.focus();await page.keyboard.press('End');assert.equal(await page.locator('#mayMusicSettingsPanel').evaluate(c=>c.getBoundingClientRect().width),942);await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#mayMusicSettingsPanel').evaluate(c=>c.getBoundingClientRect().width),932);await page.keyboard.press('Home');assert.equal(await page.locator('#mayMusicSettingsPanel').evaluate(c=>c.getBoundingClientRect().width),332);await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>MayatnikMusicPanel.isOpen()),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'bTemplatePanel');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
