'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const IDS=['mayRhZoomIn','bTemplatePanel','mayRhZoomOut','mayRhZen','mayRhRec','mayRhGif'];
const root=__dirname;
async function fixture(t,options={}){
 let chromium;try{chromium=require(process.env.PLAYWRIGHT_PATH||'C:/Users/Mhl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright').chromium;}catch(_){t.skip('Playwright unavailable');return;}
 const executablePath=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';if(!fs.existsSync(executablePath)){t.skip('Chrome unavailable');return;}
 const browser=await chromium.launch({executablePath,headless:true});t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width:1280,height:900},...options}),page=await context.newPage();
 await page.setContent('<!doctype html><html><body class="mayatnik-menu-ready"><div id="mayRhombs"><button id="mayRhZoomIn" class="may-rh may-rh-zoom">+</button><button id="mayRhZoomOut" class="may-rh may-rh-zoom">−</button><button id="mayRhZen" class="may-rh">◎\nДзен</button><button id="mayRhRec" class="may-rh">⏺\nВидео</button><button id="mayRhGif" class="may-rh">GIF</button></div><div id="mayTemplateLauncher"><button id="bTemplatePanel" class="pt-l" aria-expanded="false"><svg class="may-template-diamond" viewBox="0 0 24 48"><path d="M23.5 1V47L1 24Z"/></svg><svg class="may-template-puzzle"></svg></button></div><div id="mayMobileBar"></div><div id="mayatnikTemplatePanel" hidden></div></body></html>');
 for(const file of ['mayatnik-menu.css','mayatnik-template-panel.css','mayatnik-side-dock.css'])await page.addStyleTag({path:path.join(root,file)});
 await page.evaluate(ids=>{window.nativeNodes=ids.map(id=>document.getElementById(id));window.nativeParents=nativeNodes.map(n=>n.parentElement);window.clicks=[];for(const n of nativeNodes)n.addEventListener('click',()=>clicks.push(n.id));document.querySelector('#bTemplatePanel').onclick=()=>{const p=document.querySelector('#mayatnikTemplatePanel');p.hidden=!p.hidden;document.body.classList.toggle('may-template-panel-open',!p.hidden);};},IDS);
 await page.addScriptTag({path:path.join(root,'mayatnik-side-dock.js')});
 return page;
}
async function boxes(page){return page.evaluate(ids=>ids.map(id=>{const n=document.getElementById(id),r=n.getBoundingClientRect(),s=getComputedStyle(n);return {id,left:r.left,top:r.top,width:r.width,height:r.height,x:r.left+24,y:r.top+24,position:s.position};}),IDS);}
function separate(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y)>=50-0.1;}
function checkGeometry(items,height,selected=[null,null]){
 assert.equal(items.length,6);for(const item of items){assert.equal(item.width,48);assert.equal(item.height,48);assert.ok(item.left>=0);}
 for(let group=0;group<2;group++){
  const nodes=items.slice(group*3,group*3+3),base=height*(group?.75:.5);
  assert.ok(Math.abs(nodes[1].y-base)<.1);
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)assert.ok(separate(nodes[i],nodes[j]),nodes[i].id+' overlaps '+nodes[j].id);
  if(selected[group]!==null){for(let i=0;i<3;i++)assert.equal(Math.round(1280-nodes[i].left-48),i===selected[group]?2:-24);}
 }
}
test('native flex dock has staggered groups at 50/75%, hover/focus expands each command and never opens library',{timeout:60000},async t=>{
 const page=await fixture(t);if(!page)return;
 await page.mouse.move(600,100);const initial=await boxes(page);checkGeometry(initial,900);
 assert.deepEqual(initial.map(b=>b.position),['fixed','relative','fixed','relative','relative','relative']);
 assert.deepEqual(initial.map(b=>Math.round(1280-b.left-48)),[2,-24,2,2,-24,2]);
 assert.equal(await page.locator('#mayRhombs').evaluate(n=>getComputedStyle(n).display),'flex');
 assert.equal(await page.locator('.may-template-puzzle').evaluate(n=>getComputedStyle(n).zIndex),'1','native glyph paints above the added filled contour');
 for(let index=0;index<6;index++){
  await page.mouse.move(600,100);const base=(await boxes(page))[index];
  await page.mouse.move(Math.min(1278,base.left+12),base.y);const hovered=await boxes(page),selected=[null,null];selected[Math.floor(index/3)]=index%3;checkGeometry(hovered,900,selected);
  assert.equal(hovered[index].y,base.y);assert.equal(await page.locator('#mayatnikTemplatePanel').evaluate(n=>n.hidden),true);
  await page.mouse.move(600,100);await page.keyboard.press('Tab');await page.locator('#'+IDS[index]).focus();checkGeometry(await boxes(page),900,selected);
  await page.locator('#'+IDS[index]).blur();
 }
 assert.equal(await page.evaluate(()=>nativeNodes.every((n,i)=>n===document.getElementById(n.id)&&n.parentElement===nativeParents[i])),true);
 await page.setViewportSize({width:1280,height:480});await page.keyboard.press('Tab');await page.locator('#mayRhRec').focus();await page.mouse.move(1242,215);
 const compact=await boxes(page);for(let i=0;i<6;i++)for(let j=i+1;j<6;j++)assert.ok(separate(compact[i],compact[j]),'compact viewport overlap');
 await page.locator('#mayRhRec').blur();await page.setViewportSize({width:1280,height:900});
 await page.mouse.move(1276,450);await page.locator('#bTemplatePanel').click();assert.equal(await page.locator('#mayatnikTemplatePanel').evaluate(n=>n.hidden),false);
 assert.equal(await page.locator('#mayRhombs').evaluate(n=>getComputedStyle(n).zIndex),'6');assert.equal(await page.locator('#mayTemplateLauncher').evaluate(n=>getComputedStyle(n).zIndex),'2147483646');
});
test('three native mobile/desktop cycles preserve nodes, original library SVG and desktop geometry; destroy restores baseline',{timeout:60000},async t=>{
 const page=await fixture(t);if(!page)return;await page.mouse.move(600,100);
 const original=await page.locator('.may-template-diamond').evaluate(n=>n.outerHTML);
 for(let i=0;i<3;i++){
  await page.setViewportSize({width:360,height:640});
  await page.evaluate(()=>{document.body.classList.add('may-mobile-menu');const bar=document.querySelector('#mayMobileBar');bar.append(document.querySelector('#mayRhombs'),document.querySelector('#mayTemplateLauncher'));});
  assert.equal(await page.locator('.may-side-library-outline').evaluate(n=>getComputedStyle(n).display),'none');
  assert.equal(await page.locator('.may-template-diamond').evaluate(n=>n.outerHTML),original);
  for(const b of await boxes(page)){assert.equal(b.height,24);assert.equal(b.position,'relative');}
  await page.setViewportSize({width:1280,height:900});
  await page.evaluate(()=>{document.body.append(document.querySelector('#mayRhombs'),document.querySelector('#mayTemplateLauncher'));document.body.classList.remove('may-mobile-menu');});
  checkGeometry(await boxes(page),900);
  for(const b of await boxes(page)){const hit=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('button')?.id,{x:Math.min(1278,b.left+12),y:b.y});assert.equal(hit,b.id);}
 }
 assert.equal(await page.evaluate(()=>nativeNodes.every((n,i)=>n===document.getElementById(n.id)&&n.parentElement===nativeParents[i])),true);
 await page.evaluate(()=>maySideDock.destroy());assert.equal(await page.locator('.may-side-library-outline').count(),0);assert.equal(await page.locator('.may-template-diamond').evaluate(n=>n.outerHTML),original);assert.equal(await page.locator('body').evaluate(n=>n.classList.contains('may-side-dock-ready')),false);
});
test('touch first tap invokes native command without hover expansion or intercepted actions',{timeout:60000},async t=>{
 const page=await fixture(t,{hasTouch:true,isMobile:true});if(!page)return;
 for(let index=0;index<6;index++){
  const b=(await boxes(page))[index];await page.touchscreen.tap(Math.min(1278,b.left+12),b.y);
  assert.equal(await page.evaluate(()=>clicks.at(-1)),b.id);
  if(index===1)await page.evaluate(()=>document.querySelector('#mayatnikTemplatePanel').hidden=true);
 }
 assert.equal(await page.evaluate(()=>clicks.length),6);
});
