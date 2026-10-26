const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
test('real WebGPU anti contours match CPU cell strips, junctions, projection and bounded minification', {timeout:120000},async t=>{
 let chromium;try{chromium=require(process.env.PLAYWRIGHT_PATH||'C:/Users/Mhl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright').chromium;}catch(_){t.skip('Playwright runtime unavailable');return;}
 const chrome=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';if(!fs.existsSync(chrome)){t.skip('Chromium executable unavailable');return;}
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8">');});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{browser=await chromium.launch({executablePath:chrome,headless:true,args:['--enable-unsafe-webgpu']});const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);const available=await page.evaluate(async()=>!!await navigator.gpu?.requestAdapter());if(!available){t.skip('WebGPU adapter unavailable');return;}
  await page.addScriptTag({path:path.join(__dirname,'mayatnik-gpu.js')});await page.addScriptTag({path:path.join(__dirname,'mayatnik-bit-contours.js')});

  const result=await page.evaluate(async()=>{
   const api=await MayatnikGPU.create(),device=api.device,errors=[];device.addEventListener('uncapturederror',e=>errors.push(e.error.message));const format=navigator.gpu.getPreferredCanvasFormat(),bgra=format.startsWith('bgra');let compared=0,partial=0,cases=0;
   async function pixels(field,options,width,height){const texture=device.createTexture({size:[width,height],format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),stride=Math.ceil(width*4/256)*256,read=device.createBuffer({size:stride*height,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});field.render({getCurrentTexture:()=>texture},options);const encoder=device.createCommandEncoder();encoder.copyTextureToBuffer({texture},{buffer:read,bytesPerRow:stride},{width,height});device.queue.submit([encoder.finish()]);await read.mapAsync(GPUMapMode.READ);const bytes=new Uint8Array(read.getMappedRange()),out=[];for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*stride+x*4;out.push(bgra?[bytes[i+2],bytes[i+1],bytes[i],bytes[i+3]]:[...bytes.subarray(i,i+4)]);}read.unmap();read.destroy();texture.destroy();return out;}

   const colours=['#20d080','#a020e0'],packed=[0xff80d020,0xffe020a0];
   const patterns=[[[0,0],[1,1]],[[0,1],[1,0]],[[0,1],[0,1]],[[0,-1,1],[1,-2,0],[1,1,0]]];
   for(const rows of patterns){const width=rows[0].length,height=rows.length,val=Int8Array.from(rows.flat(),v=>v<0?-1:v),field=api.field({W:width,H:height,anchor:0,bg:'empty'});field.write(val);field.picture({VX:0,VW:width,VH:height,tint:0,T:Array(6).fill(0xff444444),bitC:[0xff444444,0xff444444],empty:0xff000000,contours:true});const source=await field.readPic();field.writePic(source,Int8Array.from(rows.flat()));
    for(const mode of ['same','double','directional'])for(const scale of [16,3,1,.75,.1])for(const pan of [0,.25])for(const ratio of [1,2]){
     const W=80*ratio,H=70*ratio,x=pan+4,y=pan+5,step=1/(scale*ratio),options={x0:-x/scale,y0:-y/scale,step,pixelRatio:ratio,contours:true,contourMode:mode,contourColours:packed};
     const actual=await pixels(field,options,W,H),base=await pixels(field,{...options,contours:false},W,H);
     const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);MayatnikBitContours.paint(ctx,{width,height,read:(c,r)=>rows[r][c],x,y,scale,screenWidth:W/ratio,screenHeight:H/ratio,mode,colours});const overlay=ctx.getImageData(0,0,W,H).data;
     const fractional=(length,offset)=>{const out=new Set(),unit=scale<1?1:scale,span=length*scale;for(let k=0;k<=Math.ceil(span/unit);k++){const edge=(offset+Math.min(k*unit,span))*ratio;if(Math.abs(edge-Math.round(edge))>1e-6)for(const delta of [-2*ratio,-ratio,0,ratio,2*ratio])out.add(Math.floor(edge+delta));}return out;};
     const fractionalX=fractional(width,x),fractionalY=fractional(height,y);
     // Canvas antialiases fractional cell edges; two translucent fills can
     // produce opaque mixed colours. Compare exact interiors, not that coverage.
     for(let i=0;i<actual.length;i++){if(fractionalX.has(i%W)||fractionalY.has(Math.floor(i/W))){partial++;continue;}const a=overlay[i*4+3],rgb=[overlay[i*4],overlay[i*4+1],overlay[i*4+2]];if(a!==0&&(a!==255||!packed.some(p=>String(rgb)===String([p&255,p>>>8&255,p>>>16&255])))){partial++;continue;}const expected=a===255?[...rgb,255]:base[i];if(String(actual[i])!==String(expected))throw Error(JSON.stringify({rows,mode,scale,pan,ratio,x:i%W,y:Math.floor(i/W),expected,actual:actual[i]}));compared++;}cases++;
    }
    const after=await field.read();if(String(after)!==String(val))throw Error('Source changed');field.destroy();
   }
   // The semantic neighbourhood follows visible row/column projection after collapsing.
   const field=api.field({W:3,H:3,anchor:0,bg:'empty'}),val=Int8Array.of(0,1,0,1,1,1,1,0,1);field.write(val);field.picture({VX:0,VW:3,VH:3,tint:0,T:Array(6).fill(0xff444444),bitC:[0xff444444,0xff444444],empty:0xff000000,contours:true});
   const cols=Int32Array.of(0,2),rs=Int32Array.of(0,2),options={x0:0,y0:0,step:1/16,pixelRatio:1,contours:true,contourMode:'double',contourColours:packed,contourProjection:{cols,rows:rs,x0:0,y0:0}};
   const actual=await pixels(field,options,32,32);for(const [x,y,bit]of [[15,8,0],[16,8,0],[8,15,0],[8,16,1],[15,15,0],[16,16,1]]){const p=packed[bit],expected=[p&255,p>>>8&255,p>>>16&255,255];if(String(actual[y*32+x])!==String(expected))throw Error('Projected junction mismatch');compared++;}field.destroy();
   await device.queue.onSubmittedWorkDone();return {cases,compared,partial,errors,adapter:api.adapter};
  });
  assert.deepEqual(result.errors,[]);assert.equal(result.cases,240);assert.ok(result.compared>1000000);t.diagnostic(JSON.stringify(result));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
