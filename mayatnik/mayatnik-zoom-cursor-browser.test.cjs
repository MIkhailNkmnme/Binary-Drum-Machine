const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
let chromium;try{({chromium}=require('playwright-core'));}catch{}
const chrome=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
test('wheel follows both cursor coordinates, shows inward arrows, and retains explicit vertical pins',{skip:!chromium||!fs.existsSync(chrome)},async()=>{
 const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:chrome,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1400,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('zerk_mayatnik',JSON.stringify({rows:256,linesOn:false,view:'bits',zsnap:false,ztop:false,zBot:false,zMid:false,zLimit:false,zLock:false})));
  const seam=`wrap.addEventListener('wheel',()=>queueMicrotask(()=>{window.__wheelCursorObserved={active:wrap.classList.contains('may-wheel-zoom'),cursor:getComputedStyle(cv).cursor};}));window.__wheelZoomTest={ready:()=>sessionReady,setup(pin){document.body.classList.add('may-zen');st.ztop=pin==='top';st.zBot=pin==='bottom';st.zMid=false;st.zLimit=false;st.zLock=false;st.zsnap=false;zWant=0;zoomTo(8,600,400,true);wrap.scrollLeft=600;wrap.scrollTop=600;if(st.ztop)zTopScroll();if(st.zBot)zBotScroll();},get(x,y){const r=cv.getBoundingClientRect(),w=wrap.getBoundingClientRect();return {scale:scale(),cellX:(x-r.left)/scale(),cellY:(y-r.top)/scale(),top:r.top-w.top,bottom:r.bottom-w.top-wrap.clientHeight,active:wrap.classList.contains('may-wheel-zoom'),cursor:getComputedStyle(cv).cursor,x:w.left+wrap.clientWidth*.45,y:w.top+wrap.clientHeight*.55};}};\n`;
  await page.route('**/mayatnik/Zerkalius-mayatnik.html?*',route=>route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8').replace('  function hitTemplate(x,y){',seam+'  function hitTemplate(x,y){')}));
  await page.goto(`http://127.0.0.1:${server.address().port}/mayatnik/Zerkalius-mayatnik.html?gpu=0`);await page.waitForFunction(()=>window.__wheelZoomTest?.ready()&&window.mayField?.());
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  for(const deltaY of [-160,160]){
   await page.evaluate(()=>window.__wheelZoomTest.setup('free'));await settle();const point=await page.evaluate(()=>window.__wheelZoomTest.get(0,0));
   await page.mouse.move(point.x,point.y);const before=await page.evaluate(p=>window.__wheelZoomTest.get(p.x,p.y),point);
   await page.mouse.wheel(0,deltaY);await page.waitForFunction(s=>window.__wheelZoomTest.get(0,0).scale!==s,before.scale);const after=await page.evaluate(p=>window.__wheelZoomTest.get(p.x,p.y),point);
   assert.ok(Math.abs(after.cellX-before.cellX)<.3,JSON.stringify({before,after}));assert.ok(Math.abs(after.cellY-before.cellY)<.3,JSON.stringify({before,after}));const cursor=await page.evaluate(()=>window.__wheelCursorObserved);assert.equal(cursor.active,true);assert.match(cursor.cursor,/data:image\/svg\+xml/);assert.match(decodeURIComponent(cursor.cursor),/M3 3L12 12/);
   await page.waitForFunction(()=>!window.__wheelZoomTest.get(0,0).active);assert.doesNotMatch((await page.evaluate(()=>window.__wheelZoomTest.get(0,0))).cursor,/data:image\/svg\+xml/);
  }
  for(const pin of ['top','bottom']){
   await page.evaluate(pin=>window.__wheelZoomTest.setup(pin),pin);await settle();const point=await page.evaluate(()=>window.__wheelZoomTest.get(0,0));await page.mouse.move(point.x,point.y);await page.mouse.wheel(0,-160);await page.waitForFunction(s=>window.__wheelZoomTest.get(0,0).scale!==s,point.scale);await settle();const after=await page.evaluate(()=>window.__wheelZoomTest.get(0,0));assert.ok(Math.abs(after[pin]-point[pin])<2,JSON.stringify({pin,point,after}));
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
