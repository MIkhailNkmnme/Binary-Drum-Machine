const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright-core');
const seam=`window.__stackTest={
 setup(zoom,locked=false){if(st.gifScaleStack)gifScaleToggleStack();if(!document.body.classList.contains('may-zen'))$('mayZen').click();st.edgeRhombOn=false;st.zoom=zoom;st.zLock=st.zLimit=st.ztop=st.zBot=st.zMid=locked;st.zsnap=false;zWant=0;layout();draw();return this.get();},
 toggle:gifScaleToggleStack, zoom:s=>zoomTo(s), button:dir=>$(dir>0?'zIn':'zOut').click(),
 rombo(angle){st.edgeRhombOn=true;st.romboMode='fixed';st.romboAngle=angle;st.romboAssembly=0;st.zLimit=false;layout();draw();},
 source(){const c=captureScaleGifFrame();let hash=2166136261;for(const byte of c.pixels)hash=Math.imul(hash^byte,16777619);let bitsHash=2166136261;for(const bit of c.bits)bitsHash=Math.imul(bitsHash^bit,16777619);return {width:c.width,height:c.height,hash,bitsHash};},
 get(){const top=st.edgeRhombOn?$('edgeBelowWrap'):cv,r=top.getBoundingClientRect(),w=wrap.getBoundingClientRect();return {scale:scale(),zoom:st.zoom,enabled:st.gifScaleStack,prefs:[st.zLock,st.zLimit,st.ztop,st.zBot,st.zMid],width:r.width,height:r.height,dispW:dispW(),dispH:dispH(),native:gifStackNativeScale(),zoomFactor:gifStackZoom,frame:k,scrollTop:wrap.scrollTop,wrap:{x:w.x,y:w.y,width:wrap.clientWidth,height:wrap.clientHeight},preview:gifScaleLive.inspect().preview};},
 point(lower=false){const el=lower?gifScaleLive.element.querySelectorAll('.may-scale-stack__level')[16]:cv;el.scrollIntoView({block:'center',inline:'center'});const r=el.getBoundingClientRect();return {x:r.left+r.width*.45,y:r.top+(lower?24:0)+(r.height-(lower?24:0))*.45};},
 cell(point,lower=false){const el=lower?gifScaleLive.element.querySelectorAll('.may-scale-stack__level')[16]:cv,r=el.getBoundingClientRect();return {x:(point.x-r.left)/scale(),y:(point.y-r.top-(lower?24:0))/scale()};}
};\n`;
function closeEnough(actual,expected,tolerance=.03){assert.ok(Math.abs(actual-expected)<=tolerance,JSON.stringify({actual,expected,tolerance}));}
test('GIF stack starts the original at 1:1 and all lower rasters at its screen size, then shares zoom, DPR 1/2',{timeout:120000},async()=>{
 const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{for(const dpr of [1,2]){
  const context=await browser.newContext({viewport:{width:1300,height:900},deviceScaleFactor:dpr,hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{if(!localStorage.getItem('stack-test-seeded')){localStorage.setItem('stack-test-seeded','1');localStorage.setItem('zerk_mayatnik',JSON.stringify({rows:256,linesOn:false,view:'bits',zsnap:false,ztop:false,zBot:false,zMid:false,zLimit:false,zLock:false,gifScaleStackStep:8}));}});
  await page.route('**/mayatnik/Zerkalius-mayatnik.html?*',route=>route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8').replace('  function hitTemplate(x,y){',seam+'  function hitTemplate(x,y){')}));
  const url=`http://127.0.0.1:${server.address().port}/mayatnik/Zerkalius-mayatnik.html?gpu=0`;
  await page.goto(url);await page.waitForFunction(()=>window.__stackTest&&window.mayField?.());
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const ready=async()=>{await page.waitForFunction(()=>window.__stackTest.get().preview.canvases>0&&!window.__stackTest.get().preview.pending&&!window.__stackTest.get().preview.busy);await settle();};
  const sizes=async()=>{const info=await page.evaluate(()=>({state:__stackTest.get(),lower:[...document.querySelectorAll('.may-scale-stack canvas')].map(c=>({width:c.width,height:c.height,w:c.getBoundingClientRect().width,h:c.getBoundingClientRect().height}))}));for(const c of info.lower){closeEnough(c.w,info.state.width);closeEnough(c.h,info.state.height);}assert.ok(info.lower.length);return info;};
  for(const initial of ['fit',.12,12])for(const locked of [false,true]){
   const before=await page.evaluate(({initial,locked})=>__stackTest.setup(initial,locked),{initial,locked});
   await page.evaluate(()=>__stackTest.toggle());await ready();const {state,lower}=await sizes();
   closeEnough(state.scale,1/dpr);closeEnough(state.width,state.dispW/dpr);closeEnough(state.height,state.dispH/dpr);closeEnough(lower[0].w,state.width);closeEnough(lower[0].h,state.height);assert.ok(lower[0].height<state.dispH);assert.deepEqual(state.prefs,before.prefs);
   await page.evaluate(()=>__stackTest.button(1));await ready();const enlarged=await sizes();assert.ok(enlarged.state.scale>state.scale);assert.deepEqual(enlarged.state.prefs,before.prefs);
   await page.evaluate(()=>__stackTest.toggle());const restored=await page.evaluate(()=>__stackTest.get());assert.equal(restored.zoom,before.zoom);assert.deepEqual(restored.prefs,before.prefs);
  }
  await page.evaluate(()=>{__stackTest.setup('fit',true);__stackTest.toggle();});await ready();
  const source=await page.evaluate(()=>__stackTest.source());
  for(const lower of [false,true])for(const delta of [-280,280,280]){
   const point=await page.evaluate(lower=>__stackTest.point(lower),lower);await settle();await page.mouse.move(point.x,point.y);
   const before=await page.evaluate(({point,lower})=>({state:__stackTest.get(),cell:__stackTest.cell(point,lower)}),{point,lower});
   await page.mouse.wheel(0,delta*dpr);await page.waitForFunction(s=>__stackTest.get().scale!==s,before.state.scale,{timeout:5000});await settle();
   const after=await page.evaluate(({point,lower})=>({state:__stackTest.get(),cell:__stackTest.cell(point,lower)}),{point,lower});
   assert.equal(after.state.scale>before.state.scale,delta<0);closeEnough(after.cell.x,before.cell.x,2/after.state.scale);if(lower||after.state.scrollTop>0)closeEnough(after.cell.y,before.cell.y,2/after.state.scale);await sizes();
  }
  assert.ok((await page.evaluate(()=>__stackTest.get())).scale<1/dpr);
  for(const dir of [1,-1]){const before=await page.evaluate(()=>__stackTest.get());await page.evaluate(dir=>__stackTest.button(dir),dir);await settle();const after=await sizes();assert.equal(after.state.scale>before.scale,dir>0);}
  assert.deepEqual(await page.evaluate(()=>__stackTest.source()),source);
  // The numeric step remains editable and does not enter field wheel navigation.
  const input=page.locator('.may-scale-stack__controls input');await input.fill('16');await input.press('Tab');await ready();assert.equal(await input.inputValue(),'16');
  const beforeInput=await page.evaluate(()=>__stackTest.get().scale);await input.dispatchEvent('wheel',{deltaY:-200,bubbles:true});closeEnough(await page.evaluate(()=>__stackTest.get().scale),beforeInput);
  // Actual touch events exercise the shared two-finger gesture capture path.
  await page.evaluate(()=>__stackTest.zoom(1/devicePixelRatio));const point=await page.evaluate(()=>__stackTest.point(false));await settle();
  const session=await context.newCDPSession(page),touches=distance=>[{x:point.x-distance/2,y:point.y,id:1},{x:point.x+distance/2,y:point.y,id:2}];
  const beforePinch=await page.evaluate(()=>__stackTest.get().scale);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches(80)});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touches(180)});await settle();
  const afterPinch=await page.evaluate(()=>__stackTest.get().scale);assert.ok(afterPinch>beforePinch);await sizes();
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touches(40)});await settle();assert.ok((await page.evaluate(()=>__stackTest.get().scale))<beforePinch);await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.evaluate(()=>{__stackTest.toggle();__stackTest.toggle();});await ready();closeEnough((await page.evaluate(()=>__stackTest.get())).scale,1/dpr);
  await page.evaluate(()=>__stackTest.button(1));await page.reload();await page.waitForFunction(()=>window.__stackTest&&window.mayField?.());await ready();closeEnough((await page.evaluate(()=>__stackTest.get())).scale,1/dpr);
  // Rotated Rombo uses its native exported lattice raster, independent of display zoom.
  await page.evaluate(()=>{__stackTest.toggle();__stackTest.setup('fit');__stackTest.rombo(45);__stackTest.toggle();});await ready();
  const rombo=await page.evaluate(()=>({state:__stackTest.get(),source:__stackTest.source()}));closeEnough(rombo.state.scale,Math.SQRT2/dpr);closeEnough(rombo.state.width,rombo.source.width/dpr,1/dpr);closeEnough(rombo.state.height,rombo.source.height/dpr,1/dpr);await sizes();
  await page.evaluate(()=>__stackTest.button(-1));await settle();const smaller=await sizes();assert.ok(smaller.state.scale<rombo.state.scale);const romboAfter=await page.evaluate(()=>__stackTest.source());assert.deepEqual([romboAfter.width,romboAfter.height,romboAfter.bitsHash],[rombo.source.width,rombo.source.height,rombo.source.bitsHash]);
  assert.deepEqual(errors,[]);await context.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
});
