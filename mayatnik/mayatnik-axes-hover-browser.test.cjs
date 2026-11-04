const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
let chromium;try{({chromium}=require('playwright-core'));}catch{}
const chrome=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
test('axes section follows its header without the legacy 12px inset on hover, focus and reopening',{skip:!chromium||!fs.existsSync(chrome)},async()=>{
 const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:chrome,headless:true});
 try{for(const [width,height,saved]of [[1400,950,false],[1100,780,false],[1400,950,true]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(saved=>{localStorage.setItem('zerk_mayatnik',JSON.stringify({rows:16,linesOn:false}));if(saved)localStorage.setItem('mayatnik-menu-dock-v509',JSON.stringify({'Оси':{edge:'top',index:8}}));},saved);
  if(process.env.MAY_AXES_BASELINE_CSS)await page.route('**/mayatnik-menu.css?*',route=>route.fulfill({contentType:'text/css',body:fs.readFileSync(process.env.MAY_AXES_BASELINE_CSS,'utf8')}));
  await page.goto(`http://127.0.0.1:${server.address().port}/mayatnik/Zerkalius-mayatnik.html?gpu=0`);await page.waitForFunction(()=>window.mayField?.());
  const head=page.getByRole('button',{name:'Оси',exact:true}),card=page.locator('[data-axes-section="map"] .may-axes-heading'),command=page.locator('[data-axes-section="map"] [data-n="triangleMapSource"]');
  await page.mouse.move(width/2,height/2);const collapsed=await head.boundingBox();
  const get=()=>page.evaluate(()=>{const row=document.querySelector('[data-axes-panel]'),g=row.parentElement,head=g.querySelector('.pt-l'),heading=row.querySelector('.may-axes-heading'),button=row.querySelector('[data-n="triangleMapSource"]');const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};return {head:box(head),card:box(heading),button:box(button),margin:getComputedStyle(heading.parentElement).marginLeft,open:g.classList.contains('pt-open'),edge:g.dataset.dockEdge,layout:localStorage.getItem('mayatnik-menu-dock-v509')};});
  await head.hover();await card.waitFor({state:'visible'});await page.waitForTimeout(450);const opened=await get();
  assert.equal(opened.card.x,opened.head.x,JSON.stringify({width,saved,opened}));assert.equal(opened.button.x,opened.head.x);assert.equal(opened.margin,'0px');assert.equal(opened.head.x,collapsed.x);assert.equal(opened.head.y,collapsed.y);
  await card.hover();await page.waitForTimeout(150);const hovered=await get();assert.deepEqual(hovered.card,opened.card);assert.deepEqual(hovered.head,opened.head);
  await command.focus();const focused=await get();assert.deepEqual(focused.card,opened.card);assert.deepEqual(focused.head,opened.head);assert.equal(focused.layout,opened.layout);
  await page.mouse.move(width/2,height/2);await head.evaluate(e=>e.click());await page.waitForFunction(()=>!document.querySelector('[data-axes-panel]').parentElement.classList.contains('pt-open'));const closed=await head.boundingBox();assert.deepEqual(closed,collapsed);
  await head.hover();await card.waitFor({state:'visible'});await page.waitForTimeout(450);const reopened=await get();assert.deepEqual(reopened.card,opened.card);assert.deepEqual(reopened.head,opened.head);assert.equal(reopened.layout,opened.layout);if(saved)assert.equal(reopened.edge,'top');assert.deepEqual(errors,[]);
  console.log(JSON.stringify({width,height,saved,collapsed,opened:{head:opened.head,card:opened.card},hovered:hovered.card,focused:focused.card,reopened:reopened.card}));await context.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
});
