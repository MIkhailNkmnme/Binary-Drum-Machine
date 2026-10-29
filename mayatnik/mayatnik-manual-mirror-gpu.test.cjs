const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
test('real WebGPU manual copy/XOR/AND override global operations and upward writes preserve original visibility',{timeout:120000},async t=>{
 let chromium;try{chromium=require(process.env.PLAYWRIGHT_PATH||'C:/Users/Mhl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright').chromium;}catch(_){t.skip('Playwright unavailable');return;}
 const chrome=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';if(!fs.existsSync(chrome)){t.skip('Chrome unavailable');return;}
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch({executablePath:chrome,headless:true,args:['--enable-unsafe-webgpu','--explicitly-allowed-ports='+server.address().port]});const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
  if(!await page.evaluate(async()=>!!await navigator.gpu?.requestAdapter())){t.skip('WebGPU unavailable');return;}
  await page.addScriptTag({path:path.join(__dirname,'mayatnik-gpu.js')});
  const result=await page.evaluate(async()=>{
   const api=await MayatnikGPU.create(),errors=[];api.device.addEventListener('uncapturederror',e=>errors.push(e.error.message));const W=11,H=9,A=5,empty=0xff000000,field=api.field({W,H,anchor:A,bg:'empty'});let cases=0,compared=0;
   for(const sameColours of [false,true])for(const filled of [false,true])for(const cropped of [false,true]){
    const black=sameColours?0xff606060:0xff75645b,white=sameColours?0xff606060:0xfff5ede8;
    const original=Int8Array.from({length:W*H},(_,q)=>!filled&&Math.abs(q%W-A)>Math.floor(q/W)?-1:((q*7)^(q>>2))&1);field.write(original);
    const zl=Int32Array.from([...Array.from({length:H},()=>2),...Array.from({length:H},()=>W-3)]),parity=cropped?{cellsEven:true,cellsOdd:false,rowsEven:true,rowsOdd:true}:undefined;
    const base={VX:0,VW:W,VH:H,tint:0,T:[black,black,black,white,white,white],empty,bitC:[black,white],contours:true,parity,zl:cropped?zl:null};
    field.picture({...base,passes:[]});const before=await field.readPic(),initial=before.contourBits;
    for(const k of ['h','v','d','e'])for(const m of [1,2])for(const globalOp of [0,1,2])for(const op of [0,1,2])for(const explicit of [false,true]){
      if(sameColours&&!explicit)continue;
      const p=k==='h'?3.5:k==='v'?.5:0,Q=new Int32Array(64);if(k==='h')Q.set([3,m,1,3]);else if(k==='v')Q.set([4,m,2*(A+p)]);else Q.set([5,m,k==='d'?1:0,p,A]);Q[6]=explicit?1:0;Q[7]=op;
      const expected=before.slice(),bits=initial.slice(),L=k==='h'?[0,1,-p]:k==='v'?[1,0,-A-.5-p]:k==='d'?[1,-1,-A-p]:[1,1,-A-1-p],operation=explicit?op:globalOp;
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        const q=y*W+x;if(cropped&&(x+y)%2)continue;const cx=x+.5,cy=y+.5,sd=L[0]*cx+L[1]*cy+L[2],positive=k==='h'||k==='v'?m===1:m!==1;
        if(!sd||(positive?sd<0:sd>0)||explicit&&k==='h'&&m===2&&initial[q]<0)continue;
        const t=2*sd/(L[0]*L[0]+L[1]*L[1]),sx=Math.floor(cx-L[0]*t),sy=Math.floor(cy-L[1]*t);if(sx<0||sx>=W||sy<0||sy>=H)continue;const sq=sy*W+sx;
        if(operation){if(initial[sq]<0||initial[q]<0)continue;bits[q]=operation===1?initial[sq]^initial[q]:initial[sq]&initial[q];expected[q]=bits[q]?white:black;}
        else{expected[q]=before[sq];bits[q]=initial[sq];}
      }
      field.picture({...base,mirOp:globalOp,passes:[Q]});const actual=await field.readPic();for(let q=0;q<expected.length;q++){if(actual[q]!==expected[q]||actual.contourBits[q]!==bits[q])throw Error(JSON.stringify({sameColours,filled,cropped,k,m,globalOp,op,explicit,q,actual:actual[q],expected:expected[q],bit:actual.contourBits[q],expectedBit:bits[q]}));compared++;}cases++;
    }
    if(String(await field.read())!==String(original))throw Error('Raw field mutated');
   }
   field.destroy();await api.device.queue.onSubmittedWorkDone();return {cases,compared,errors,adapter:api.adapter};
  });assert.deepEqual(result.errors,[]);assert.equal(result.cases,864);assert.equal(result.compared,85536);t.diagnostic(JSON.stringify(result));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
