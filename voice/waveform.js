/* Display the calculated text cycle from the same PCM buffer used for playback. */
(function(root){
  'use strict';
  root.VoiceWaveform=function({track,canvas,seek,head,time,onSeek}){
    let result=null,position=0,pointerId=null;
    const seconds=sample=>sample/result.sampleRate;
    function format(value){
      const hundredths=Math.floor(value*100);
      const minutes=Math.floor(hundredths/6000);
      const wholeSeconds=Math.floor(hundredths/100)%60;
      return minutes+':'+String(wholeSeconds).padStart(2,'0')+'.'+String(hundredths%100).padStart(2,'0');
    }
    function draw(){
      if(!result)return;
      const width=canvas.clientWidth,height=canvas.clientHeight;
      if(!width||!height)return;
      const density=Math.min(root.devicePixelRatio||1,2);
      canvas.width=Math.round(width*density);
      canvas.height=Math.round(height*density);
      const ctx=canvas.getContext('2d');
      if(!ctx)return;
      ctx.scale(density,density);
      const middle=height/2,color=getComputedStyle(canvas).getPropertyValue('--voice-focus').trim();
      ctx.fillStyle=color||'#6cdff0';
      ctx.globalAlpha=.28;
      ctx.fillRect(0,middle,width,1);
      ctx.globalAlpha=.88;
      const {samples}=result,columns=Math.min(width,samples.length);
      for(let column=0;column<columns;column++){
        const start=Math.floor(column*samples.length/columns),end=Math.floor((column+1)*samples.length/columns);
        let low=0,high=0;
        for(let i=start;i<end;i++){
          low=Math.min(low,samples[i]);
          high=Math.max(high,samples[i]);
        }
        const x=column*width/columns;
        ctx.fillRect(x,middle-high*middle,Math.ceil(width/columns),Math.max(1,(high-low)*middle));
      }
    }
    function showPosition(sample){
      const current=format(seconds(sample)),duration=format(seconds(result.samples.length));
      head.style.left=(sample/result.samples.length*100)+'%';
      const label=current+' / '+duration;
      if(time.textContent!==label)time.textContent=label;
      if(seek.getAttribute('aria-valuetext')!==label)seek.setAttribute('aria-valuetext',label);
    }
    function setPosition(sample){
      position=sample;
      if(!result||pointerId!==null)return;
      seek.value=String(seconds(sample)*1000);
      showPosition(sample);
    }
    function setResult(next){
      if(next===result)return;
      result=next;pointerId=null;
      track.hidden=!result;
      if(!result)return;
      seek.max=String(Math.ceil(seconds(result.samples.length)*1000));
      setPosition(0);
      draw();
    }
    function limitSample(sample){
      return Math.max(0,Math.min(result.samples.length-1,Math.round(sample)));
    }
    function pointerSample(event){
      const box=canvas.getBoundingClientRect();
      return limitSample((event.clientX-box.left)*result.samples.length/Math.max(1,box.width));
    }
    seek.addEventListener('pointerdown',event=>{
      if(!result||seek.disabled||event.button!==0||pointerId!==null)return;
      event.preventDefault();
      seek.focus({preventScroll:true});
      seek.setPointerCapture(event.pointerId);
      pointerId=event.pointerId;
      showPosition(pointerSample(event));
    });
    seek.addEventListener('pointermove',event=>{
      if(result&&event.pointerId===pointerId)showPosition(pointerSample(event));
    });
    seek.addEventListener('pointerup',event=>{
      if(!result||event.pointerId!==pointerId)return;
      pointerId=null;
      onSeek(pointerSample(event));
    });
    seek.addEventListener('lostpointercapture',event=>{
      if(event.pointerId!==pointerId)return;
      pointerId=null;
      setPosition(position);
    });
    seek.addEventListener('change',()=>{
      if(result)onSeek(limitSample(Number(seek.value)*result.sampleRate/1000));
    });
    if(root.ResizeObserver)new ResizeObserver(draw).observe(canvas);
    else root.addEventListener('resize',draw);
    return {setResult,setPosition,setEnabled:enabled=>{seek.disabled=!enabled;}};
  };
})(globalThis);
