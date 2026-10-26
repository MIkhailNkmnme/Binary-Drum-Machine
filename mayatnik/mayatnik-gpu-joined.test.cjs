const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const Joined=require('./mayatnik-joined-romb.js');
test('GPU uniform contract keeps64bytes and joined branch precedes flat contours',()=>{
 const source=fs.readFileSync(__dirname+'/mayatnik-gpu.js','utf8');assert.match(source,/mapped:u32, joined:u32, joinedAnchor:f32, joinedReflection:f32/);assert.match(source,/i\[13\]=joined\?\(joined.rotate\?2:1\):0/);assert.match(source,/f\[14\]=joined\?\.anchor\|\|0;f\[15\]=joined\?\.reflection\|\|0/);assert.ok(source.indexOf('if(u.joined!=0u){return joinedPixel(pos.xy);}')<source.indexOf('if(u.contours!=0u&&contour(pos.xy))'));assert.match(source,/floor\(\(x\+y\)\*0.5\+0.5\)/);
});
test('real WebGPU joined pixels agree with the CPU geometry, source data survives and flat mode restores', {timeout:120000},async t=>{
 let chromium;try{chromium=require(process.env.PLAYWRIGHT_PATH||'C:/Users/Mhl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright').chromium;}catch(_){t.skip('Playwright runtime unavailable');return;}
 const chrome=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';if(!fs.existsSync(chrome)){t.skip('Chromium executable unavailable');return;}
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8">');});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{browser=await chromium.launch({executablePath:chrome,headless:true,args:['--enable-unsafe-webgpu']});const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);const available=await page.evaluate(async()=>!!await navigator.gpu?.requestAdapter());if(!available){t.skip('WebGPU adapter unavailable');return;}
  await page.addScriptTag({path:path.join(__dirname,'mayatnik-gpu.js')});await page.addScriptTag({path:path.join(__dirname,'mayatnik-joined-romb.js')});
  const result=await page.evaluate(async()=>{
   const api=await MayatnikGPU.create(),device=api.device,errors=[],reports=[];device.addEventListener('uncapturederror',event=>errors.push(event.error.message));const format=navigator.gpu.getPreferredCanvasFormat(),bgra=format.startsWith('bgra');let compared=0,maxDifference=0;
   const rgba=u=>[u&255,(u>>>8)&255,(u>>>16)&255,255];
   async function pixels(field,options,width,height){const texture=device.createTexture({size:[width,height],format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),stride=Math.ceil(width*4/256)*256,read=device.createBuffer({size:stride*height,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});field.render({getCurrentTexture:()=>texture},options);const encoder=device.createCommandEncoder();encoder.copyTextureToBuffer({texture},{buffer:read,bytesPerRow:stride},{width,height});device.queue.submit([encoder.finish()]);await read.mapAsync(GPUMapMode.READ);const bytes=new Uint8Array(read.getMappedRange()),out=[];for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*stride+x*4;out.push(bgra?[bytes[i+2],bytes[i+1],bytes[i],bytes[i+3]]:[...bytes.subarray(i,i+4)]);}read.unmap();read.destroy();texture.destroy();return out;}
   for(const width of [3,4,5,6])for(const height of [2,4]){
    const origin=2,fieldWidth=width+4,anchor=(width%2)+3,val=Int8Array.from({length:fieldWidth*height},(_,q)=>q%7===0?-1:(q*13+Math.floor(q/fieldWidth))%2),field=api.field({W:fieldWidth,H:height,anchor,bg:'empty'});field.write(val);field.picture({VX:origin,VW:width,VH:height,tint:0,T:[0xff403020,0xff403020,0xff403020,0xffd0c0b0,0xffd0c0b0,0xffd0c0b0],empty:0xff000000,passes:[]});
    const picture=await field.readPic();for(let r=0;r<height;r++)for(let c=0;c<width;c++){const q=r*fieldWidth+c+origin;if(val[q]>=0)picture[r*width+c]=(0xff000000|((r*41+c*23+91)%256)<<16|((r*29+c*47+31)%256)<<8|((r*17+c*53+13)%256))>>>0;}field.writePic(picture);
    for(const rotate of [false,true])for(const step of [.25,.5,1,2.5]){
     const geometry=MayatnikJoinedRomb.create({width,height,origin,anchor,fieldWidth,rotate}),x0=-.5,y0=-.5,outWidth=Math.ceil((geometry.width+1)/step),outHeight=Math.ceil((geometry.height+1)/step),actual=await pixels(field,{x0,y0,step,joined:{anchor:anchor-origin,reflection:geometry.reflection,rotate}},outWidth,outHeight);
     const sample=(x,y)=>{const hit=geometry.hit(x,y);return hit?rgba(picture[hit.r*width+hit.c-origin]).slice(0,3):[0,0,0];};
     for(let y=0;y<outHeight;y++)for(let x=0;x<outWidth;x++){
      const fx=x0+x*step,fy=y0+y*step;let expected;if(fx>=geometry.width||fy>=geometry.height||fx+step<=0||fy+step<=0)expected=[0,0,0,0];else if(step<=1)expected=[...sample(fx+step/2,fy+step/2),255];else{const left=Math.max(0,fx),top=Math.max(0,fy),right=Math.min(geometry.width,fx+step),bottom=Math.min(geometry.height,fy+step),nx=Math.max(1,Math.min(32,Math.ceil(right-left))),ny=Math.max(1,Math.min(32,Math.ceil(bottom-top))),sum=[0,0,0];for(let yy=0;yy<ny;yy++)for(let xx=0;xx<nx;xx++){const pixel=sample(left+(xx+.5)*(right-left)/nx,top+(yy+.5)*(bottom-top)/ny);for(let channel=0;channel<3;channel++)sum[channel]+=pixel[channel];}expected=[...sum.map(v=>Math.round(v/(nx*ny))),255];}
      const pixel=actual[y*outWidth+x];for(let channel=0;channel<4;channel++){const diff=Math.abs(pixel[channel]-expected[channel]);maxDifference=Math.max(maxDifference,diff);if(diff>(step<=1?0:1))throw Error(JSON.stringify({width,height,rotate,step,x,y,actual:pixel,expected}));}compared++;
     }
     reports.push({width,height,rotate,step,pixels:actual.length});
    }
    const flat=await pixels(field,{x0:origin,y0:0,step:1},width,height);for(let i=0;i<picture.length;i++)if(String(flat[i])!==String(rgba(picture[i])))throw Error('Flat mode did not restore');const after=await field.read();if(String(after)!==String(val))throw Error('Source field changed');const pictureAfter=await field.readPic();if(String(pictureAfter)!==String(picture))throw Error('Source picture changed');field.destroy();
   }
   await device.queue.onSubmittedWorkDone();return{adapter:api.adapter,format,compared,maxDifference,cases:reports.length,errors};
  });
  assert.deepEqual(result.errors,[]);assert.equal(result.cases,64);assert.ok(result.compared>10000);t.diagnostic(JSON.stringify(result));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
