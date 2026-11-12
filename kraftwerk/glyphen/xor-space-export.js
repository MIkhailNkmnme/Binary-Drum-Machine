/* Finite, frozen 3D exports: the scene and all three projections in each frame. */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root){root.XorSpaceExport=api;root.mountXorSpaceExport=api.mount;}
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const abortError=()=>Object.assign(new Error('Экспорт отменён.'),{name:'AbortError'});
 const check=signal=>{if(signal?.aborted)throw abortError();};
 function delay(ms,signal){return new Promise((resolve,reject)=>{
  check(signal);const done=()=>{signal?.removeEventListener('abort',stop);resolve();},timer=setTimeout(done,ms);
  function stop(){clearTimeout(timer);signal.removeEventListener('abort',stop);reject(abortError());}signal?.addEventListener('abort',stop,{once:true});
 });}
 function formatDuration(seconds){const n=Math.round(seconds*100)/100,h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=Math.round((n%60)*100)/100;return (h?h+' ч ':'')+(m?m+' мин ':'')+s+' с';}
 function selectRange(snapshot,start,count){
  const total=snapshot.codes?.length||0;
  if(!total)throw Error('Нет допустимых вариантов для экспорта.');
  if(!Number.isInteger(start)||start<1||start>total)throw Error('Начальный вариант должен быть от 1 до '+total+'.');
  if(!Number.isInteger(count)||count<1||count>total-start+1)throw Error('Количество кадров должно быть от 1 до '+(total-start+1)+'. Диапазон не обрезается автоматически.');
  const rate=Math.max(1,Math.min(25,Number(snapshot.rate)||4));
  return {start:start-1,count,rate,duration:count/rate,total};
 }
 // Adaptive, weighted median cut. Existing <=256-colour rasters stay exact.
 // Only this export copy is changed; never the live source canvas or its palette.
 function quantize(rgba){
  const exact=new Set();for(let i=0;i<rgba.length&&exact.size<=256;i+=4)exact.add(rgba[i]*65536+rgba[i+1]*256+rgba[i+2]);
  if(exact.size<=256)return rgba;
  const histogram=new Map();
  for(let i=0;i<rgba.length;i+=4){const r=rgba[i],g=rgba[i+1],b=rgba[i+2],key=(r>>3)*1024+(g>>3)*32+(b>>3);let bin=histogram.get(key);if(!bin)histogram.set(key,bin={key,n:0,sum:[0,0,0]});bin.n++;bin.sum[0]+=r;bin.sum[1]+=g;bin.sum[2]+=b;}
  const colours=[...histogram.values()].map(b=>({...b,rgb:b.sum.map(v=>v/b.n)}));
  function box(items){const lo=[255,255,255],hi=[0,0,0];let weight=0;for(const c of items){weight+=c.n;for(let a=0;a<3;a++){lo[a]=Math.min(lo[a],c.rgb[a]);hi[a]=Math.max(hi[a],c.rgb[a]);}}const ranges=hi.map((v,a)=>v-lo[a]),axis=ranges.indexOf(Math.max(...ranges));return {items,weight,axis,score:items.length>1?ranges[axis]*Math.sqrt(weight):0};}
  const boxes=[box(colours)];
  while(boxes.length<256){let pick=0;for(let i=1;i<boxes.length;i++)if(boxes[i].score>boxes[pick].score)pick=i;const target=boxes[pick];if(!target.score)break;target.items.sort((a,b)=>a.rgb[target.axis]-b.rgb[target.axis]);let weight=0,split=1;for(;split<target.items.length;split++){weight+=target.items[split-1].n;if(weight>=target.weight/2)break;}split=Math.min(split,target.items.length-1);boxes.splice(pick,1,box(target.items.slice(0,split)),box(target.items.slice(split)));}
  const lookup=new Map();for(const bucket of boxes){const sum=[0,0,0];for(const c of bucket.items)for(let a=0;a<3;a++)sum[a]+=c.sum[a];const rgb=sum.map(v=>Math.round(v/bucket.weight));for(const c of bucket.items)lookup.set(c.key,rgb);}
  for(let i=0;i<rgba.length;i+=4){const rgb=lookup.get((rgba[i]>>3)*1024+(rgba[i+1]>>3)*32+(rgba[i+2]>>3));rgba[i]=rgb[0];rgba[i+1]=rgb[1];rgba[i+2]=rgb[2];}
  return rgba;
 }
 const bytes=(...arrays)=>{const out=new Uint8Array(arrays.reduce((n,a)=>n+a.length,0));let offset=0;for(const a of arrays){out.set(a,offset);offset+=a.length;}return out;};
 function uint(value){let n=BigInt(value),out=[];do{out.unshift(Number(n&255n));n>>=8n;}while(n);return Uint8Array.from(out);}
 function size(value){let n=BigInt(value),length=1;while(n>=(1n<<BigInt(length*7))-1n)length++;const result=new Uint8Array(length);for(let i=length-1;i>=0;i--){result[i]=Number(n&255n);n>>=8n;}result[0]|=1<<(8-length);return result;}
 const element=(id,data)=>bytes(uint(id),size(data.length),data),number=(id,n)=>element(id,uint(n)),string=(id,s)=>element(id,new TextEncoder().encode(s));
 function float64(value){const out=new Uint8Array(8);new DataView(out.buffer).setFloat64(0,value);return out;}
 // VP9 WebM: one timestamped cluster per encoded frame, finite Segment duration.
 // Encoded chunks are retained; uncompressed frames never accumulate.
 function webmMuxer(width,height,rate,count){
  const header=element(0x1a45dfa3,bytes(number(0x4286,1),number(0x42f7,1),number(0x42f2,4),number(0x42f3,8),string(0x4282,'webm'),number(0x4287,4),number(0x4285,2)));
  const info=element(0x1549a966,bytes(number(0x2ad7b1,1000000),string(0x4d80,'XOR 3D'),string(0x5741,'XOR 3D'),element(0x4489,float64(count*1000/rate))));
  const parts=[];let frameCount=0,colourSpace=null;
  return {add(chunk,metadata){if(metadata?.decoderConfig?.colorSpace)colourSpace=metadata.decoderConfig.colorSpace;const payload=new Uint8Array(chunk.byteLength);chunk.copyTo(payload);const block=element(0xa3,bytes(Uint8Array.of(0x81,0,0,chunk.type==='key'?0x80:0),payload));parts.push(element(0x1f43b675,bytes(number(0xe7,Math.round(chunk.timestamp/1000)),block)));frameCount++;},finish(){
   if(frameCount!==count)throw Error('Кодировщик вернул '+frameCount+' кадров вместо '+count+'.');
   // Software and GPU canvases may produce different YUV ranges. Preserve the
   // encoder's colour description; assuming limited range crushes dark colours.
   const matrix={rgb:0,bt709:1,bt470bg:5,smpte170m:6},transfer={bt709:1,smpte170m:6,'iec61966-2-1':13},primaries={bt709:1,bt470bg:5,smpte170m:6},colour=[];
   if(colourSpace){if(matrix[colourSpace.matrix]!==undefined)colour.push(number(0x55b1,matrix[colourSpace.matrix]));if(typeof colourSpace.fullRange==='boolean')colour.push(number(0x55b9,colourSpace.fullRange?2:1));if(transfer[colourSpace.transfer]!==undefined)colour.push(number(0x55ba,transfer[colourSpace.transfer]));if(primaries[colourSpace.primaries]!==undefined)colour.push(number(0x55bb,primaries[colourSpace.primaries]));}
   const video=bytes(number(0xb0,width),number(0xba,height),...(colour.length?[element(0x55b0,bytes(...colour))]:[]));
   const track=element(0x1654ae6b,element(0xae,bytes(number(0xd7,1),number(0x73c5,1),number(0x83,1),number(0x9c,0),string(0x86,'V_VP9'),number(0x23e383,Math.round(1e9/rate)),element(0xe0,video))));
   const length=info.length+track.length+parts.reduce((n,p)=>n+p.length,0);return new Blob([header,uint(0x18538067),size(length),info,track,...parts],{type:'video/webm'});
  }};
 }
 async function gifWriter(width,height,signal){
  if(!root.MayatnikGif?.encoder)throw Error('Кодировщик GIF не загружен.');
  const source='const encoder=('+root.MayatnikGif.encoder.toString()+');const quantize=('+quantize.toString()+');let gif;onmessage=e=>{try{const m=e.data;if(m.type==="start")gif=encoder(m.width,m.height);else if(m.type==="frame")gif.add(quantize(m.pixels),m.delay);postMessage(m.type==="finish"?{blob:gif.finish()}:{ready:true});}catch(e){postMessage({error:e.message});}};';
  const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'})),worker=new Worker(url);URL.revokeObjectURL(url);let pending=null;
  const stop=()=>{worker.terminate();if(pending){pending.reject(abortError());pending=null;}};signal?.addEventListener('abort',stop,{once:true});
  worker.onmessage=e=>{if(!pending)return;const p=pending;pending=null;e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data);};
  worker.onerror=e=>{if(pending){pending.reject(Error(e.message||'Ошибка кодировщика GIF.'));pending=null;}};
  const send=(message,transfer=[])=>new Promise((resolve,reject)=>{check(signal);pending={resolve,reject};worker.postMessage(message,transfer);});
  try{await send({type:'start',width,height});}catch(error){stop();signal?.removeEventListener('abort',stop);throw error;}
  return {async add(canvas,index,rate){const pixels=canvas.getContext('2d').getImageData(0,0,width,height).data;await send({type:'frame',pixels,delay:Math.round((index+1)*100/rate)-Math.round(index*100/rate)},[pixels.buffer]);},async finish(){return (await send({type:'finish'})).blob;},close(){stop();signal?.removeEventListener('abort',stop);}};
 }
 async function offlineVideoWriter(width,height,range,signal){
  if(!root.VideoEncoder||!root.VideoFrame)return null;
  // VP9 signals full/limited YUV range in the bitstream as well as the WebM
  // container. VP8 decoders can ignore the container range for software canvases.
  const config={codec:'vp09.00.10.08',width,height,bitrate:Math.max(1000000,Math.min(16000000,width*height*range.rate*.5)),framerate:range.rate};
  let supported;try{supported=await VideoEncoder.isConfigSupported(config);}catch(_){return null;}if(!supported.supported)return null;
  check(signal);const mux=webmMuxer(width,height,range.rate,range.count);let error=null;
  const encoder=new VideoEncoder({output:(chunk,metadata)=>{if(!error)try{mux.add(chunk,metadata);}catch(e){error=e;}},error:e=>{error=e;}});
  try{encoder.configure(config);}catch(e){encoder.close();throw e;}const close=()=>{if(encoder.state!=='closed')encoder.close();};signal?.addEventListener('abort',close,{once:true});
  return {mode:'offline',extension:'webm',async add(canvas,index){check(signal);if(error)throw error;const frame=new VideoFrame(canvas,{timestamp:Math.round(index*1e6/range.rate),duration:Math.round((index+1)*1e6/range.rate)-Math.round(index*1e6/range.rate)});try{encoder.encode(frame,{keyFrame:index%Math.max(1,Math.round(range.rate*2))===0});}finally{frame.close();}if(encoder.encodeQueueSize>4)await encoder.flush();if(error)throw error;},async finish(){check(signal);await encoder.flush();if(error)throw error;return mux.finish();},close(){signal?.removeEventListener('abort',close);close();}};
 }
 function realtimeVideoWriter(width,height,range,signal){
  if(!root.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)throw Error('В этом браузере экспорт видео недоступен. GIF остаётся доступен.');
  const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/mp4'].find(type=>MediaRecorder.isTypeSupported(type));if(!mime)throw Error('Браузер не поддерживает запись WebM или MP4.');
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d'),stream=canvas.captureStream(0),chunks=[];
  const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6000000});let failed=null,started=false;
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onerror=e=>{failed=e.error||Error('Ошибка записи видео.');};
  return {mode:'realtime',extension:mime.includes('mp4')?'mp4':'webm',async add(frame){check(signal);if(document.hidden)throw Error('Запись видео в реальном времени прервана: вкладка скрыта. Оставьте вкладку видимой и повторите экспорт.');if(failed)throw failed;const firstFrame=!started;if(!started){await new Promise((resolve,reject)=>{recorder.onstart=resolve;recorder.onerror=e=>{failed=e.error||Error('Ошибка записи видео.');reject(failed);};ctx.drawImage(frame,0,0);recorder.start(1000);stream.getVideoTracks()[0]?.requestFrame?.();});started=true;}if(!firstFrame){ctx.drawImage(frame,0,0);stream.getVideoTracks()[0]?.requestFrame?.();}await delay(1000/range.rate,signal);if(failed)throw failed;},async finish(){check(signal);return new Promise((resolve,reject)=>{recorder.onstop=()=>{const blob=new Blob(chunks,{type:mime.split(';')[0]});failed?reject(failed):blob.size?resolve(blob):reject(Error('Браузер не записал кадры видео. Повторите экспорт в видимой вкладке.'));};recorder.stop();});},close(){if(recorder.state!=='inactive')recorder.stop();stream.getTracks().forEach(track=>track.stop());canvas.width=canvas.height=1;}};
 }
 async function run({kind,snapshot,capture,start,count,orbit=false,signal,onProgress=()=>{},onMode=()=>{}}){
  let writer=null;
  try{
   check(signal);const range=selectRange(snapshot,start,count),prepared=root.XorAxesSequence.prepare(snapshot.source,snapshot.assignments);
   if(kind==='gif'){writer=await gifWriter(capture.width,capture.height,signal);onMode('gif');}
   else{writer=await offlineVideoWriter(capture.width,capture.height,range,signal);if(!writer)writer=realtimeVideoWriter(capture.width,capture.height,range,signal);onMode(writer.mode);}
   const orbitFrames=kind==='gif'?range.count:Math.max(1,range.count-1);
   for(let i=0;i<range.count;i++){
    check(signal);const position=range.start+i,assignments=root.XorAxesSequence.assignmentsAt(prepared,snapshot.codes[position]);
    const canvas=capture.render(assignments,'Вариант '+(position+1)+' / '+range.total,orbit?i/orbitFrames:0);
    await writer.add(canvas,i,range.rate);onProgress(i+1,range.count);await delay(0,signal);
   }
   check(signal);const blob=await writer.finish();check(signal);
   return {blob,extension:kind==='gif'?'gif':writer.extension,mode:kind==='gif'?'gif':writer.mode,range,width:capture.width,height:capture.height};
  }finally{writer?.close();capture.destroy();}
 }
 function mount(container,view,player){
  const panel=document.createElement('section');panel.className='xs-export';panel.setAttribute('aria-label','Экспорт анимации 3D');
  panel.innerHTML='<h3>Экспорт 3D + XY / XZ / YZ</h3><div class="xs-export-range"><label>С варианта <input data-export-start type="number" min="1" step="1" value="1"></label><label>Кадров <input data-export-count type="number" min="1" step="1" value="64"></label><button type="button" class="gz-hx" data-export-current title="Начать с текущего варианта" aria-label="Начать с текущего варианта">> Текущий</button><button type="button" class="gz-hx" data-export-all title="Весь цикл: все допустимые варианты от первого до последнего" aria-label="Весь цикл">Цикл</button></div><output data-export-estimate></output><div class="xs-export-actions"><button type="button" class="gz-hx" data-export-gif title="Скачать GIF с текущим видом 3D и тремя проекциями">GIF 3D</button><button type="button" class="gz-hx" data-export-video title="Скачать видео с текущим видом 3D и тремя проекциями">MP4 3D</button><button type="button" class="gz-hx" data-export-orbit aria-pressed="false" title="Один оборот камеры вокруг центра за выбранный диапазон GIF или видео">Облёт</button><button type="button" class="gz-hx" data-export-cancel title="Отменить экспорт" aria-label="Отменить экспорт" disabled>X</button><a data-export-download hidden>Скачать</a></div><progress data-export-progress max="1" value="0" hidden></progress><p data-export-status role="status">Камера, цвета и серые центры - как на экране. GIF: до 256 цветов; полноцветное видео без звука.</p>';
  const host=container.querySelector('.xor-space'),anchor=host.querySelector('.xs-sequence')||host.querySelector('.xs-controls');anchor.after(panel);
  const find=s=>panel.querySelector(s),startInput=find('[data-export-start]'),countInput=find('[data-export-count]'),estimate=find('[data-export-estimate]'),status=find('[data-export-status]'),progress=find('[data-export-progress]'),cancelButton=find('[data-export-cancel]'),download=find('[data-export-download]');
  const orbitButton=find('[data-export-orbit]'),orbitKey='zerk_xor_space_export_orbit';
  try{orbitButton.setAttribute('aria-pressed',String(localStorage.getItem(orbitKey)==='true'));}catch(_){}
  orbitButton.addEventListener('click',()=>{
   const on=String(orbitButton.getAttribute('aria-pressed')!=='true');
   orbitButton.setAttribute('aria-pressed',on);
   try{localStorage.setItem(orbitKey,on);}catch(_){}
  });
  let controller=null,destroyed=false,downloadURL=null,rangeTouched=false,lastResult=null,exportMode='',dimensions=null;
  function refresh(){if(controller||destroyed)return;const state=player.getState(),rate=Number(player.getExportSnapshot().rate)||4;if(!rangeTouched){startInput.value=String(state.index+1);countInput.value=String(state.count?Math.min(64,state.count-state.index):64);}startInput.max=String(state.count||331776);countInput.max=String(state.count||331776);const n=Number(countInput.value);estimate.textContent=n+' кадров / '+formatDuration(n/rate)+' / '+rate+' вариантов/с'+(state.count?' / всего '+state.count:' / число допустимых вариантов ещё не рассчитано')+(dimensions?' / '+dimensions.width+' x '+dimensions.height+' px / исходные кадры '+Math.ceil(dimensions.width*dimensions.height*4*n/1048576)+' МиБ; размер файла зависит от сжатия':'');}
  function controls(busy){for(const input of panel.querySelectorAll('input,button'))input.disabled=busy;cancelButton.disabled=!busy;progress.hidden=!busy;}
  function revoke(){if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL=null;download.hidden=true;download.removeAttribute('href');}
  async function prepare(signal){const snapshot=player.getExportSnapshot();if(snapshot.codes?.length)return snapshot;status.textContent='Расчёт допустимых вариантов для текущих фигур...';const ownsCalculation=!player.getState().busy,stop=()=>{if(ownsCalculation)player.cancelSequence();};signal.addEventListener('abort',stop,{once:true});try{await player.ensureSequence();check(signal);return player.getExportSnapshot();}finally{signal.removeEventListener('abort',stop);}}
  async function start(kind){
   if(controller||destroyed)return null;player.pause();controller=new AbortController();const signal=controller.signal;controls(true);progress.value=0;lastResult=null;revoke();
   try{
    const snapshot=await prepare(signal);check(signal);if(!rangeTouched){startInput.value=String(snapshot.index+1);countInput.value=String(Math.min(64,snapshot.count-snapshot.index));}
    const first=Number(startInput.value),count=Number(countInput.value),range=selectRange(snapshot,first,count),capture=view.createCapture({source:snapshot.source});
    dimensions={width:capture.width,height:capture.height};estimate.textContent=count+' кадров / '+formatDuration(range.duration)+' / '+capture.width+' x '+capture.height+' px / исходные кадры '+Math.ceil(capture.width*capture.height*4*count/1048576)+' МиБ (кодируются по одному; размер файла зависит от сжатия)';
    lastResult=await run({kind,snapshot,capture,start:first,count,orbit:orbitButton.getAttribute('aria-pressed')==='true',signal,onMode(mode){exportMode=mode;status.textContent=mode==='realtime'?'Видео записывается в реальном времени, примерно '+formatDuration(range.duration)+'. Оставьте вкладку видимой; при медленной отрисовке длительность может увеличиться.':'Покадровое сохранение: '+(kind==='gif'?'GIF':'WebM')+'. Длительность в файле '+formatDuration(range.duration)+'.';},onProgress(done,total){progress.max=total;progress.value=done;status.textContent=(exportMode==='realtime'?'Запись в реальном времени':'Покадровое сохранение')+': '+done+' / '+total+' / '+Math.round(done/total*100)+'%';}});
    check(signal);downloadURL=URL.createObjectURL(lastResult.blob);download.href=downloadURL;download.download='xor-3d-'+first+'-'+(first+count-1)+'.'+lastResult.extension;download.textContent='Скачать '+lastResult.extension.toUpperCase();download.hidden=false;download.click();status.textContent='Готово: '+count+' кадров / '+(lastResult.blob.size/1048576).toFixed(2)+' МиБ. '+(lastResult.mode==='realtime'?'Видео записано в реальном времени.':'Длительность '+formatDuration(range.duration)+'.');return lastResult;
   }catch(error){if(!destroyed)status.textContent=error.name==='AbortError'?'Экспорт отменён.':error.message;return null;}finally{controller=null;if(!destroyed)controls(false);}
  }
  function cancel(){controller?.abort();}
  find('[data-export-gif]').addEventListener('click',()=>start('gif'));find('[data-export-video]').addEventListener('click',()=>start('video'));cancelButton.addEventListener('click',cancel);
  for(const input of [startInput,countInput])input.addEventListener('input',()=>{rangeTouched=true;refresh();});
  find('[data-export-current]').addEventListener('click',()=>{rangeTouched=false;refresh();});
  find('[data-export-all]').addEventListener('click',async()=>{
   if(controller)return;controller=new AbortController();controls(true);const signal=controller.signal;
   try{const snapshot=await prepare(signal);check(signal);if(!snapshot.count)throw Error('Нет допустимых вариантов для экспорта.');rangeTouched=true;startInput.value='1';countInput.value=String(snapshot.count);const capture=view.createCapture({source:snapshot.source});dimensions={width:capture.width,height:capture.height};capture.destroy();status.textContent='Выбран весь цикл. Кадры кодируются по одному. Проверьте длительность и объём, затем нажмите GIF 3D или Видео 3D.';}catch(error){status.textContent=error.name==='AbortError'?'Выбор отменён.':error.message;}finally{controller=null;if(!destroyed){controls(false);refresh();}}
  });
  const timer=setInterval(refresh,1000);refresh();
  return {start,cancel,getState:()=>({busy:!!controller,result:lastResult}),destroy(){destroyed=true;cancel();clearInterval(timer);revoke();panel.remove();}};
 }
 return {quantize,selectRange,formatDuration,webmMuxer,run,mount};
});

