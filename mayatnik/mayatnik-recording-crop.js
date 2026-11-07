/* One crop for the complete clip, retaining the original screen coordinates. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikRecordingCrop=api;})(globalThis,function(){
  'use strict';
  function bounds(rgba,width,height){
    let left=width,top=height,right=0,bottom=0;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){const q=(y*width+x)*4;if(rgba[q]||rgba[q+1]||rgba[q+2]){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}}
    return right>left&&bottom>top?{left,top,right,bottom}:null;
  }
  function union(a,b){return !b?a:!a?{...b}:{left:Math.min(a.left,b.left),top:Math.min(a.top,b.top),right:Math.max(a.right,b.right),bottom:Math.max(a.bottom,b.bottom)};}
  function evenBox(box,width,height){
    if(!box)return null;
    const left=Math.max(0,Math.floor(box.left/2)*2),top=Math.max(0,Math.floor(box.top/2)*2);
    const right=Math.min(width,Math.ceil(box.right/2)*2),bottom=Math.min(height,Math.ceil(box.bottom/2)*2);
    return {left,top,width:Math.max(2,right-left),height:Math.max(2,bottom-top)};
  }
  async function video(blob,box,{width,height,hasAudio=false,mimeType='',durationMs=0,onProgress=()=>{},signal}={}){
    const crop=evenBox(box,width,height);
    if(!crop||crop.left===0&&crop.top===0&&crop.width===width&&crop.height===height)return {blob,width,height,cropped:false};
    const el=document.createElement('video'),url=URL.createObjectURL(blob),canvas=document.createElement('canvas'),chunks=[];
    el.muted=true;el.playsInline=true;el.preload='auto';el.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:0;top:0';document.body.append(el);
    canvas.width=crop.width;canvas.height=crop.height;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
    let stream=null,sourceStream=null,recorder=null,callback=0,timer=0,settled=false,closeJob=null,rejectReady=null;
    const aborted=()=>{const error=Object.assign(Error('Обработка видео прервана'),{name:'AbortError'});rejectReady?.(error);closeJob?.(error);};
    if(signal?.aborted){el.remove();URL.revokeObjectURL(url);throw Object.assign(Error('Обработка видео прервана'),{name:'AbortError'});}
    signal?.addEventListener('abort',aborted,{once:true});
    try{
      await new Promise((resolve,reject)=>{rejectReady=reject;timer=setTimeout(()=>reject(Error('Не удалось вовремя открыть записанное видео')),30000);el.onloadeddata=()=>{rejectReady=null;resolve();};el.onerror=()=>reject(Error('Не удалось прочитать записанное видео'));el.src=url;el.load();});
      clearTimeout(timer);timer=0;
      if(signal?.aborted)throw Object.assign(Error('Обработка видео прервана'),{name:'AbortError'});
      const draw=()=>{ctx.drawImage(el,crop.left,crop.top,crop.width,crop.height,0,0,crop.width,crop.height);stream?.getVideoTracks()[0]?.requestFrame?.();};
      draw();stream=canvas.captureStream(30);
      if(hasAudio){
        const capture=el.captureStream||el.mozCaptureStream;if(!capture)throw Error('Браузер не умеет сохранить звук при обрезке');
        sourceStream=capture.call(el);const audio=sourceStream.getAudioTracks();if(!audio.length)throw Error('Звуковая дорожка недоступна для обрезки');
        for(const track of audio)stream.addTrack(track);
      }
      const candidates=[mimeType,...(hasAudio?['video/mp4;codecs=avc1,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm']:['video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm'])];
      const type=candidates.find(t=>t&&MediaRecorder.isTypeSupported(t))||'';
      recorder=new MediaRecorder(stream,{...(type?{mimeType:type}:{}),videoBitsPerSecond:12000000,audioBitsPerSecond:128000});
      const result=new Promise((resolve,reject)=>{
        closeJob=error=>{if(settled)return;settled=true;clearTimeout(timer);if(error){if(recorder.state!=='inactive')try{recorder.stop();}catch(_){}reject(error);return;}
          if(!chunks.some(part=>part.size)){reject(Error('Обрезка видео не вернула кадров'));return;}
          resolve(new Blob(chunks,{type:recorder.mimeType||type||blob.type}));
        };
        recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
        recorder.onerror=e=>closeJob?.(e.error||Error('Ошибка записи обрезанного видео'));
        recorder.onstop=()=>closeJob?.();
        el.onended=()=>{if(settled)return;try{draw();if(recorder.state!=='inactive')recorder.stop();}catch(error){closeJob?.(error);}};
        el.onerror=()=>closeJob?.(Error('Ошибка чтения записанного видео'));
      });
      const paint=()=>{
        if(settled||el.ended)return;
        try{draw();onProgress(el.currentTime,Number.isFinite(el.duration)?el.duration:durationMs/1000);callback=requestAnimationFrame(paint);}catch(error){closeJob?.(error);}
      };
      recorder.start(500);paint();el.play().catch(error=>closeJob?.(error));
      timer=setTimeout(()=>closeJob(Error('Обработка видео превысила время ожидания')),Math.max(30000,durationMs*2+15000));
      let cropped=await result;
      const fix=globalThis.__zerkRecorder?.fixVideo;if(fix)cropped=await fix(cropped,durationMs);
      return {blob:cropped,width:crop.width,height:crop.height,cropped:true};
    }finally{
      settled=true;rejectReady=null;closeJob=null;clearTimeout(timer);signal?.removeEventListener('abort',aborted);
      if(callback)cancelAnimationFrame(callback);
      el.onended=el.onerror=el.onloadeddata=null;if(recorder){recorder.onstop=recorder.onerror=recorder.ondataavailable=null;}
      el.pause();if(recorder&&recorder.state!=='inactive')try{recorder.stop();}catch(_){}
      stream?.getTracks().forEach(t=>t.stop());sourceStream?.getTracks().forEach(t=>t.stop());
      el.removeAttribute('src');el.load();el.remove();URL.revokeObjectURL(url);
    }
  }
  return {bounds,union,evenBox,video};
});
