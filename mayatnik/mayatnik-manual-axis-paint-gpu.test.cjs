const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
test('real WebGPU manual-axis paint follows every frame and matches CPU geometry after mirrors using semantic bits', {timeout:120000},async t=>{
 let chromium;try{chromium=require(process.env.PLAYWRIGHT_PATH||'C:/Users/Mhl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright').chromium;}catch(_){t.skip('Playwright runtime unavailable');return;}
 const chrome=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';if(!fs.existsSync(chrome)){t.skip('Chromium executable unavailable');return;}
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8">');});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{browser=await chromium.launch({executablePath:chrome,headless:true,args:['--enable-unsafe-webgpu']});const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
  if(!await page.evaluate(async()=>!!await navigator.gpu?.requestAdapter())){t.skip('WebGPU adapter unavailable');return;}
  await page.addScriptTag({path:path.join(__dirname,'mayatnik-gpu.js')});await page.addScriptTag({path:path.join(__dirname,'mayatnik-manual-lines.js')});
  const result=await page.evaluate(async()=>{
   const api=await MayatnikGPU.create(),device=api.device,errors=[];device.addEventListener('uncapturederror',e=>errors.push(e.error.message));let cases=0,compared=0;
   const W=19,H=13,VX=3,VW=13,anchor=9,colour=0xff20aa33,field=api.field({W,H,anchor,bg:'empty'}),mirrors=[Int32Array.from([3,1,0,5]),Int32Array.from([4,2,12]),Int32Array.from([5,1,1,-2,6])];
   const base={VX,VW,VH:H,tint:0,T:Array(6).fill(0xff606060),empty:0xff000000,bitC:[0xff606060,0xff606060],contours:true};
   for(let frame=0;frame<4;frame++){
    const source=Int8Array.from({length:W*H},(_,q)=>(q*11+Math.floor(q/W)*7+frame*5)%3-1);field.write(source);
    const groups=[];for(const kind of ['h','v','d','e'])for(const p of [-1,0,.5,3,3.5,12,13])for(const paint of [1,2,3])groups.push([{kind,p,paint}]);
    groups.push(Array.from({length:31},(_,i)=>({kind:['h','v','d','e'][i%4],p:(i-16)/2,paint:i%3+1})),[{kind:'h',p:3,paint:3,visible:false}],[]);
    for(const axes of groups){
     field.picture({...base,passes:mirrors});const before=await field.readPic(),expected=before.slice(),semantic=before.contourBits.slice();
     MayatnikManualLines.paint(expected,{axes,width:VW,height:H,anchor:anchor-VX,colour,bitAt:(c,r,q)=>semantic[q]});
     field.picture({...base,passes:[...mirrors,...MayatnikManualLines.paintPasses(axes,colour)]});const actual=await field.readPic();
     for(let q=0;q<expected.length;q++){if(expected[q]!==actual[q]||semantic[q]!==actual.contourBits[q])throw Error(JSON.stringify({frame,axes,q,expected:expected[q],actual:actual[q],bit:semantic[q],afterBit:actual.contourBits[q]}));compared++;}cases++;
    }
    // Parity-hidden cells remain empty even when an axis crosses the whole row.
    const parity={cellsEven:false,cellsOdd:true,rowsEven:true,rowsOdd:false},axes=[{kind:'h',p:4,paint:3}];
    field.picture({...base,parity,passes:mirrors});const before=await field.readPic(),expected=before.slice();MayatnikManualLines.paint(expected,{axes,width:VW,height:H,anchor:anchor-VX,colour,bitAt:(c,r,q)=>before.contourBits[q]});
    field.picture({...base,parity,passes:[...mirrors,...MayatnikManualLines.paintPasses(axes,colour)]});const actual=await field.readPic();for(let q=0;q<expected.length;q++){if(expected[q]!==actual[q])throw Error('Parity '+q);compared++;}cases++;
    if(String(await field.read())!==String(source))throw Error('Source field changed');
   }
   field.destroy();await device.queue.onSubmittedWorkDone();return {cases,compared,errors,adapter:api.adapter};
  });
  assert.deepEqual(result.errors,[]);assert.equal(result.cases,352);assert.ok(result.compared>59000);t.diagnostic(JSON.stringify(result));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
