const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
let chromium;try{({chromium}=require('playwright-core'));}catch{}
const chrome=process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':null);
test('live cropped ordinary mirror/XOR paints displayed 0/1 immediately and follows manual frames',{skip:!chromium||!chrome||!fs.existsSync(chrome)},async()=>{
 const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:chrome,headless:true});const page=await browser.newPage({viewport:{width:1400,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('zerk_mayatnik',JSON.stringify({rows:32,linesOn:true,lineFamilies:{h:false,v:true,d:false},zl:[{k:'v',p:4,axisNo:1,m:2,op:'xor',paint:0,paintColour0:'#ff1234',paintColour1:'#12ff34'}],view:'bits',noband:2,fillArea:'sides'})));
  await page.goto(`http://127.0.0.1:${server.address().port}/mayatnik/Zerkalius-mayatnik.html?gpu=0`);await page.waitForFunction(()=>window.mayField?.()&&document.querySelector('[data-axis-id="v:1"] .may-manual-axis-paint0'));
  const before=await page.evaluate(()=>({original:Array.from(window.mayField().val),paint:JSON.stringify(window.mayPatternPaint.snapshot()),undo:document.getElementById('bUndo')?.disabled}));
  const baseline=await page.evaluate(async()=>Array.from(await window.mayPic()));
  async function toggle(bit){await page.locator(`[data-axis-id="v:1"] .may-manual-axis-paint${bit}`).click();await page.evaluate(()=>window.mayManualAxisPaint.whenIdle());}
  async function verify(bit){
   const actual=await page.evaluate(async()=>{const snapshot=window.mayVisibleSemantic.snapshot();return {bits:Array.from(snapshot.bits),width:snapshot.width,height:snapshot.height,scale:snapshot.scale,pixels:Array.from(await window.mayPic()),state:window.mayManualAxisPaint.get(),info:document.getElementById('fillInfo').textContent,original:Array.from(window.mayField().val),axis:window.mayAxisX(),canvas:document.getElementById('cv').getBoundingClientRect().toJSON()};});
   assert.equal(actual.state.failed,false,actual.info);assert.equal(actual.scale,1);assert.ok(actual.width<windowWidth(actual.original,actual.height),'default triangular view crops original field');
   // Independent four-neighbour flood through displayed semantic bits, seeded
   // by the vertical axis column. No mocked host projection or seed provider.
   const anchor=Math.round((actual.axis-actual.canvas.left)*actual.width/actual.canvas.width-.5),column=anchor+4,seen=new Set(),queue=[];
   const add=q=>{if(q>=0&&q<actual.bits.length&&!seen.has(q)&&actual.bits[q]===bit){seen.add(q);queue.push(q);}};
   for(let y=0;y<actual.height;y++){add(y*actual.width+column);add(y*actual.width+anchor-4);}
   for(let i=0;i<queue.length;i++){const q=queue[i],x=q%actual.width,y=Math.floor(q/actual.width);if(x)add(q-1);if(x+1<actual.width)add(q+1);if(y)add(q-actual.width);if(y+1<actual.height)add(q+actual.width);}
   assert.ok(seen.size>actual.height,'fill extends beyond the axis');const colour=bit===0?0xff3412ff:0xff34ff12;for(let q=0;q<actual.bits.length;q++)assert.equal(actual.pixels[q]===colour,seen.has(q),`displayed mask at ${q}, bit ${bit}`);
   return actual.original;
  }
  function windowWidth(original,height){return original.length/height;}
  await toggle(0);const original=await verify(0);assert.deepEqual(original,before.original);assert.deepEqual(await page.evaluate(()=>({paint:JSON.stringify(window.mayPatternPaint.snapshot()),undo:document.getElementById('bUndo')?.disabled})),{paint:before.paint,undo:before.undo});await toggle(0);assert.deepEqual(await page.evaluate(async()=>Array.from(await window.mayPic())),baseline);
  await toggle(1);assert.deepEqual(await verify(1),original);
  await page.evaluate(()=>{const frame=document.getElementById('frame');frame.value=String(+frame.value-1);frame.dispatchEvent(new Event('input',{bubbles:true}));});await page.evaluate(()=>window.mayManualAxisPaint.whenIdle());await verify(1);await toggle(1);assert.deepEqual(errors,[]);
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
});
