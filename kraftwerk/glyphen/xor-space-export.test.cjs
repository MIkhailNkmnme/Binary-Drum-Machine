const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os'),{execFileSync}=require('node:child_process');
const Export=require('./xor-space-export.js');
test('finite ranges are explicit and never silently truncated; full cycle duration is visible',()=>{
 const snapshot={codes:new Uint32Array(64512),rate:4};
 assert.deepEqual(Export.selectRange(snapshot,100,64),{start:99,count:64,rate:4,duration:16,total:64512});
 assert.equal(Export.formatDuration(Export.selectRange(snapshot,1,64512).duration),'4 ч 28 мин 48 с');
 assert.throws(()=>Export.selectRange(snapshot,64512,64),/не обрезается/);assert.throws(()=>Export.selectRange(snapshot,1,0),/Количество/);assert.throws(()=>Export.selectRange(snapshot,0,3),/Начальный/);
});
test('GIF quantization preserves exact small palettes and reduces shaded RGB rasters to <=256 colours',()=>{
 const small=Uint8ClampedArray.from([239,173,98,255,121,197,231,255,113,119,119,255]),original=small.slice();Export.quantize(small);assert.deepEqual(small,original);
 const pixels=new Uint8ClampedArray(4096*4);for(let i=0;i<4096;i++){pixels[i*4]=i%256;pixels[i*4+1]=Math.floor(i/16)%256;pixels[i*4+2]=(i*31)%256;pixels[i*4+3]=255;}const before=pixels.slice();Export.quantize(pixels);
 const colours=new Set();let error=0;for(let i=0;i<pixels.length;i+=4){colours.add(pixels[i]*65536+pixels[i+1]*256+pixels[i+2]);for(let j=0;j<3;j++)error+=Math.abs(pixels[i+j]-before[i+j]);assert.equal(pixels[i+3],255);}assert.ok(colours.size<=256);assert.ok(error/(4096*3)<12);
});
test('actual 3D GIF + WebM decode every chosen frame and all three projections; cancel restores controls',async()=>{
 const {chromium}=require('playwright-core'),root=path.resolve(__dirname,'../..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'xor-3d-export-'));
 const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu']});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/kraftwerk/glyphen/index.html');
  await page.evaluate(()=>{xorSpacePlayer.pause();});
  const exports=await page.evaluate(async()=>{
   const snapshot=await xorSpacePlayer.ensureSequence(),initial=JSON.stringify(xorSpaceView.getState()),start=39,count=3,prepared=XorAxesSequence.prepare(snapshot.source,snapshot.assignments),capture=xorSpaceView.createCapture({source:snapshot.source}),expected=[],parts=capture.parts,width=capture.width,height=capture.height;
   for(let i=0;i<count;i++)expected.push(capture.render(XorAxesSequence.assignmentsAt(prepared,snapshot.codes[start-1+i]),'Вариант '+(start+i)+' / '+snapshot.count).toDataURL().split(',')[1]);capture.destroy();
   const files=[];for(const kind of ['gif','video','fallback']){const Encoder=window.VideoEncoder;if(kind==='fallback')window.VideoEncoder=undefined;const result=await XorSpaceExport.run({kind:kind==='gif'?'gif':'video',snapshot,capture:xorSpaceView.createCapture({source:snapshot.source}),start,count,signal:new AbortController().signal});window.VideoEncoder=Encoder;const bytes=new Uint8Array(await result.blob.arrayBuffer());let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));files.push({kind,mode:result.mode,base64:btoa(text),extension:result.extension});}
   return {files,expected,parts,width,height,count,rate:snapshot.rate,unchanged:initial===JSON.stringify(xorSpaceView.getState()),hiddenRenderers:document.querySelectorAll('[aria-hidden=true] .xor-space').length};
  });
  assert.equal(exports.unchanged,true);assert.equal(exports.hiddenRenderers,0);assert.deepEqual(exports.parts.map(p=>p.name),['3D','XY','XZ','YZ']);assert.equal(exports.files[1].mode,'offline');assert.equal(exports.files[2].mode,'realtime');
  for(let i=0;i<exports.expected.length;i++)fs.writeFileSync(path.join(temp,'expected-'+i+'.png'),Buffer.from(exports.expected[i],'base64'));
  const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg',ffprobe=process.env.FFPROBE_PATH||'ffprobe';
  const expectedRaw=path.join(temp,'expected.rgba');execFileSync(ffmpeg,['-v','error','-i',path.join(temp,'expected-%d.png'),'-f','rawvideo','-pix_fmt','rgba',expectedRaw]);const expected=fs.readFileSync(expectedRaw),frameSize=exports.width*exports.height*4;
  assert.equal(expected.length,frameSize*exports.count);
  for(const file of exports.files){
   const target=path.join(temp,'actual-'+file.kind+'.'+file.extension),raw=path.join(temp,file.kind+'.rgba');fs.writeFileSync(target,Buffer.from(file.base64,'base64'));
   const probe=JSON.parse(execFileSync(ffprobe,['-v','error','-count_frames','-show_streams','-show_format','-of','json',target],{encoding:'utf8'}));
   assert.equal(probe.streams[0].width,exports.width);assert.equal(probe.streams[0].height,exports.height);assert.equal(Number(probe.streams[0].nb_read_frames),exports.count,file.kind+' frames');if(file.kind!=='fallback')assert.ok(Math.abs(Number(probe.format.duration)-exports.count/exports.rate)<.03,JSON.stringify(probe.format));
   execFileSync(ffmpeg,['-v','error','-i',target,'-fps_mode','passthrough','-f','rawvideo','-pix_fmt','rgba',raw]);const actual=fs.readFileSync(raw);assert.equal(actual.length,expected.length);
   const metrics=[];for(let frame=0;frame<exports.count;frame++)for(const part of exports.parts){let error=0,n=0,detail=0;for(let y=part.y;y<part.y+part.height;y++)for(let x=part.x;x<part.x+part.width;x++){const at=frame*frameSize+(y*exports.width+x)*4;for(let c=0;c<3;c++){error+=Math.abs(actual[at+c]-expected[at+c]);n++;}if(expected[at]>90||expected[at+1]>90||expected[at+2]>90)detail++;}assert.ok(detail>30,file.kind+' '+part.name+' must contain visible geometry');metrics.push({frame,part:part.name,meanError:error/n});assert.ok(error/n<(file.kind==='gif'?5:9),file.kind+JSON.stringify(metrics.at(-1)));}
   if(file.kind==='gif')for(let f=0;f<exports.count;f++){const colours=new Set();for(let at=f*frameSize;at<(f+1)*frameSize;at+=4)colours.add(actual.readUIntBE(at,3));assert.ok(colours.size<=256);}
   let changed=0;for(let i=0;i<frameSize;i+=4)if(Math.abs(actual[i]-actual[frameSize+i])+Math.abs(actual[i+1]-actual[frameSize+i+1])+Math.abs(actual[i+2]-actual[frameSize+i+2])>30)changed++;assert.ok(changed>100,file.kind+' exports moving configurations, not a repeated live frame');
  }
  await page.locator('[data-export-count]').fill('3');await page.locator('[data-export-start]').fill('39');const downloadEvent=page.waitForEvent('download');await page.locator('[data-export-gif]').click();const download=await downloadEvent;assert.equal(download.suggestedFilename(),'xor-3d-39-41.gif');await page.waitForFunction(()=>!document.querySelector('[data-export-gif]').disabled);assert.match(await page.locator('[data-export-status]').textContent(),/Готово: 3 кадров/);
  await page.locator('[data-export-all]').click();await page.waitForFunction(()=>!document.querySelector('[data-export-all]').disabled);assert.equal(await page.locator('[data-export-count]').inputValue(),'64512');assert.match(await page.locator('[data-export-estimate]').textContent(),/4 ч 28 мин 48 с/);
  await page.locator('[data-export-gif]').click();await page.locator('[data-export-cancel]').click();await page.waitForFunction(()=>!document.querySelector('[data-export-gif]').disabled);assert.match(await page.locator('[data-export-status]').textContent(),/отменён/);assert.equal(await page.locator('[data-export-download]').isVisible(),false);assert.equal(await page.locator('[aria-hidden=true] .xor-space').count(),0);
  await page.locator('[data-export-count]').fill('64513');await page.locator('[data-export-gif]').click();await page.waitForFunction(()=>!document.querySelector('[data-export-gif]').disabled);assert.match(await page.locator('[data-export-status]').textContent(),/не обрезается/);assert.equal(await page.locator('[aria-hidden=true] .xor-space').count(),0);
  await page.evaluate(()=>{xorSpacePlayer.invalidate();document.querySelector('[data-export-gif]').click();document.querySelector('[data-export-cancel]').click();});await page.waitForFunction(()=>!document.querySelector('[data-export-gif]').disabled);assert.equal(await page.evaluate(()=>xorSpacePlayer.getState().busy),false,'export cancellation stops its own enumeration worker');assert.match(await page.locator('[data-export-status]').textContent(),/отменён/);
  await page.locator('[data-centres]').uncheck();await page.locator('[data-export-gif]').click();await page.waitForFunction(()=>!document.querySelector('[data-export-gif]').disabled);assert.match(await page.locator('[data-export-status]').textContent(),/Нет допустимых/);assert.equal(await page.locator('[aria-hidden=true] .xor-space').count(),0);
  await page.setViewportSize({width:390,height:844});await page.locator('.xs-export').scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=390),true);for(const el of await page.locator('.xs-export button,.xs-export input').all()){const r=await el.boundingBox();assert.ok(r.x>=0&&r.x+r.width<=390);}
  assert.deepEqual(errors,[]);
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));if(!process.env.XOR_KEEP_EXPORTS)fs.rmSync(temp,{recursive:true,force:true});else console.log(temp);}
});




