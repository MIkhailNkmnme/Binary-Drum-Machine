'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'../..');
let server,browser,page;const errors=[];
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'};
function wav(seconds=1,rate=8000){
 const samples=rate*seconds,data=Buffer.alloc(samples*2);
 for(let i=0;i<samples;i++)data.writeInt16LE(Math.round(Math.sin(2*Math.PI*440*i/rate)*6000),i*2);
 const h=Buffer.alloc(44);
 h.write('RIFF',0);h.writeUInt32LE(36+data.length,4);h.write('WAVE',8);h.write('fmt ',12);
 h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(rate,24);
 h.writeUInt32LE(rate*2,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(data.length,40);
 return Buffer.concat([h,data]);
}
before(async()=>{
 server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(error,body)=>{
   if(error){res.writeHead(404);res.end();return;}
   res.setHeader('Content-Type',MIME[path.extname(file)]||'application/octet-stream');res.end(body);
  });
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 page=await browser.newPage({viewport:{width:1100,height:900}});
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/issledovanie/xor-axes/index.html');
 await page.evaluate(()=>document.fonts.ready);
});
after(async()=>{await browser?.close();await new Promise(resolve=>server.close(resolve));assert.deepEqual(errors,[]);});

test('recorded MP4 keeps the field colours, shadows and cell digits',async()=>{
 await page.evaluate(()=>{
  resetBoard();
  const set=(id,value)=>{const input=document.getElementById(id);input.value=value;input.dispatchEvent(new Event('input'));};
  set('colorFieldBg','#102030');set('colorBit','#e0e0e0');set('colorDigitOne','#ff00ff');set('colorDigitZero','#00ffff');
  state.digits=true;state.shadows=true;state.ghosts=false;state.grid=false;state.variant=1576;state.mode='xor';state.selected=null;state.radius=0;render();
 });
 await page.setInputFiles('#audioFile',{name:'tone.wav',mimeType:'audio/wav',buffer:wav(1)});
 await page.waitForFunction(()=>typeof audioDuration==='number'&&audioDuration>0,null,{timeout:20000});
 await page.locator('#makeVideo').click();
 await page.waitForFunction(()=>document.getElementById('videoStatus').textContent.startsWith('Готово')||document.getElementById('videoStatus').textContent.startsWith('Не удалось'),null,{timeout:120000});
 const status=await page.locator('#videoStatus').textContent();
 assert.match(status,/Готово/);
 const probe=await page.evaluate(async()=>{
  const video=document.createElement('video');video.muted=true;video.src=videoUrl;video.preload='auto';document.body.append(video);
  await new Promise((resolve,reject)=>{video.addEventListener('loadedmetadata',resolve,{once:true});video.addEventListener('error',()=>reject(new Error('video load')),{once:true});video.load();});
  const at=Math.min(.15,video.duration/2);
  video.currentTime=at;
  await new Promise((resolve,reject)=>{video.addEventListener('seeked',resolve,{once:true});setTimeout(()=>reject(new Error('seek timeout')),5000);});
  const size=video.videoWidth,canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext('2d');ctx.drawImage(video,0,0,size,size);
  const pixels=ctx.getImageData(0,0,size,size).data;
  const near=(r,g,b,tr,tg,tb,tol)=>Math.abs(r-tr)<=tol&&Math.abs(g-tg)<=tol&&Math.abs(b-tb)<=tol;
  let background=0,light=0,magenta=0,cyan=0;
  for(let i=0;i<pixels.length;i+=4){
   const r=pixels[i],g=pixels[i+1],b=pixels[i+2];
   if(near(r,g,b,16,32,48,22))background++;
   if(near(r,g,b,233,233,233,20))light++;
   if(near(r,g,b,255,0,255,45))magenta++;
   if(near(r,g,b,0,255,255,45))cyan++;
  }
  video.remove();
  return {size,duration:video.duration,background,light,magenta,cyan};
 });
 assert.equal(probe.size,928,'video holds the field at twice the raster size');
 assert(probe.background>1000,'field background colour');
 assert(probe.light>50,'light shadow in the encoded video');
 assert(probe.magenta>50,'digit 1 colour in the encoded video');
 assert(probe.cyan>50,'digit 0 colour in the encoded video');
});
