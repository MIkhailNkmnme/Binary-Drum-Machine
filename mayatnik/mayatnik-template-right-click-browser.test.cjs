const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
let chromium;try{({chromium}=require('playwright-core'));}catch{}
const chrome=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const file=__dirname+'/Zerkalius-mayatnik.html';
test('one right click deselects any picked template, preserves the active peer and all masks/paint',{skip:!chromium||!fs.existsSync(chrome)},async()=>{
 const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:chrome,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1400,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('zerk_mayatnik',JSON.stringify({rows:16,linesOn:false,view:'bits'})));
  const seam=`window.__templateTapTest={gesture(){return templateDragging?{mode:templateDragging.mode,unpickOnTap:templateDragging.unpickOnTap,duplicate:!!templateDragging.duplicate,mirrorEdge:templateDragging.mirrorEdge}:null;},cancel(){finishTemplateDrag('pointercancel');},pick(x,y){templatePickMode='add';return takeColourAt(x,y);},state(){return {active:colourTemplate?.id||null,picked:[...templatePickedIds],items:templateItems.map(t=>({id:t.id,parts:t.parts.map(p=>({data:Array.from(p.mask.data),bits:p.bitsData?Array.from(p.bitsData):null}))})),library:JSON.stringify(templateLibrary),paint:JSON.stringify({fillMask:fillMask?Array.from(fillMask):null,paintBits:paintBits?Array.from(paintBits):null}),field:Array.from(f.val)};},resetContext(){templateContextSkip=false;},point(id){const t=templateItems.find(t=>t.id===id),p=t.parts[0],q=p.mask.data.findIndex(v=>v),box=templateRect(p,false,t),r=cv.getBoundingClientRect();return {x:r.left+(box.x+(q%p.mask.width+.23)*box.width/p.mask.width)/img.width*r.width,y:r.top+(box.y+(Math.floor(q/p.mask.width)+.23)*box.height/p.mask.height)/img.height*r.height};}};\n`;
  await page.route('**/mayatnik/Zerkalius-mayatnik.html?*',route=>route.fulfill({contentType:'text/html',body:fs.readFileSync(file,'utf8').replace('  function hitTemplate(x,y){',seam+'  function hitTemplate(x,y){')}));
  await page.goto(`http://127.0.0.1:${server.address().port}`+'/mayatnik/Zerkalius-mayatnik.html?gpu=0');
  await page.waitForFunction(()=>window.__templateTapTest&&window.mayField?.()).catch(async e=>{console.log({errors,url:page.url(),title:await page.title(),text:(await page.locator('body').innerText()).slice(0,200)});throw e;});
  // Capture two disconnected field regions with the production picker.
  const initial=await page.evaluate(()=>{
   const T=window.__templateTapTest,s=window.mayVisibleSemantic.snapshot(),r=document.getElementById('cv').getBoundingClientRect();
   for(let y=2;y<s.height-1;y++)for(let x=0;x<s.width;x++)if(s.bits[y*s.width+x]>=0){T.pick(r.left+(x+.5)/s.width*r.width,r.top+(y+.5)/s.height*r.height);if(T.state().picked.length>=2)return T.state();}
   throw Error('could not capture two disconnected regions');
  });
  assert.equal(initial.picked.length,2);const [first,second]=initial.picked;assert.equal(initial.active,second);
  const stable=s=>({items:s.items,library:s.library,paint:s.paint,field:s.field});
  async function right(id,mods=[]){const p=await page.evaluate(id=>window.__templateTapTest.point(id),id);for(const key of mods)await page.keyboard.down(key);await page.mouse.click(p.x,p.y,{button:'right'});for(const key of mods)await page.keyboard.up(key);return page.evaluate(()=>window.__templateTapTest.state());}
  // Ctrl retains copy intent; Alt retains edge mirror intent. Cancel each
  // gesture before release so this selection regression never edits a mask.
  for(const modifier of ['Control','Alt']){
   const p=await page.evaluate(id=>window.__templateTapTest.point(id),first);await page.keyboard.down(modifier);await page.mouse.move(p.x,p.y);await page.mouse.down({button:'right'});
   const gesture=await page.evaluate(()=>window.__templateTapTest.gesture());assert.ok(gesture);assert.ok(!gesture.unpickOnTap);if(modifier==='Control'){assert.equal(gesture.duplicate,true);assert.equal(gesture.mode,'pickOnly');}else{assert.equal(gesture.mode,'edgeCopy');assert.ok(gesture.mirrorEdge);}
   await page.evaluate(()=>window.__templateTapTest.cancel());await page.mouse.up({button:'right'});await page.keyboard.up(modifier);
   const s=await page.evaluate(()=>window.__templateTapTest.state());assert.equal(s.picked.length,2);assert.deepEqual(stable(s),stable(initial));
  }
  await page.evaluate(id=>{const T=window.__templateTapTest,p=T.point(id);T.pick(p.x,p.y);},second);
  let state=await right(first);assert.deepEqual(state.picked,[second]);assert.equal(state.active,second);assert.deepEqual(stable(state),stable(initial));
  // An unpicked body is selected again; the second right click removes it.
  state=await right(first);assert.equal(state.picked.includes(first),true);state=await right(first);assert.deepEqual(state.picked,[second]);assert.deepEqual(stable(state),stable(initial));
  // Keyboard/contextmenu-only fallback follows the same membership rule.
  await page.evaluate(id=>{window.__templateTapTest.resetContext();const p=window.__templateTapTest.point(id);document.getElementById('wrap').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2,clientX:p.x,clientY:p.y}));},second);state=await page.evaluate(()=>window.__templateTapTest.state());assert.deepEqual(state.picked,[]);
  state=await right(second);assert.deepEqual(state.picked,[second]);
  // Movement beyond the tap threshold cancels removal.
  let p=await page.evaluate(id=>window.__templateTapTest.point(id),second);await page.mouse.move(p.x,p.y);await page.mouse.down({button:'right'});await page.mouse.move(p.x+8,p.y+8);await page.mouse.up({button:'right'});state=await page.evaluate(()=>window.__templateTapTest.state());assert.deepEqual(state.picked,[second]);
  state=await right(second);assert.deepEqual(state.picked,[]);assert.equal(state.active,null);assert.deepEqual(stable(state),stable(initial));assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
