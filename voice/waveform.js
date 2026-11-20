/* Display and select intervals of the calculated text PCM. */
(function(root){
  'use strict';
  root.VoiceWaveform=function({track,canvas,seek,head,highlight,time,zoom,full,clear,onSeek,onRange}){
    let result=null,view=null,range=null,position=0,drag=null,keySelection=null,enabled=false;
    const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
    const seconds=sample=>sample/result.sampleRate;
    function format(sample){
      const hundredths=Math.floor(seconds(sample)*100);
      const minutes=Math.floor(hundredths/6000),wholeSeconds=Math.floor(hundredths/100)%60;
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
      const {samples}=result,span=view.end-view.start,columns=Math.min(width,span);
      for(let column=0;column<columns;column++){
        const start=view.start+Math.floor(column*span/columns),end=view.start+Math.floor((column+1)*span/columns);
        let low=0,high=0;
        for(let i=start;i<end;i++){
          low=Math.min(low,samples[i]);
          high=Math.max(high,samples[i]);
        }
        ctx.fillRect(column*width/columns,middle-high*middle,Math.ceil(width/columns),Math.max(1,(high-low)*middle));
      }
    }
    function percent(sample){return (sample-view.start)/(view.end-view.start)*100;}
    function paintPosition(){
      if(!result)return;
      const selection=drag?.range??range;
      const start=selection?Math.max(selection.start,view.start):0,end=selection?Math.min(selection.end,view.end):0;
      highlight.hidden=end<=start;
      if(!highlight.hidden){
        highlight.style.left=percent(start)+'%';
        highlight.style.width=(percent(end)-percent(start))+'%';
      }
      head.hidden=position<view.start||position>=view.end;
      if(!head.hidden)head.style.left=percent(position)+'%';
      const playback=format(position)+' / '+format(result.samples.length);
      const label=selection?playback+' · '+format(selection.start)+'–'+format(selection.end):playback;
      if(time.textContent!==label)time.textContent=label;
      if(seek.getAttribute('aria-valuetext')!==label)seek.setAttribute('aria-valuetext',label);
    }
    function syncControls(){
      seek.disabled=!result||!enabled;
      zoom.disabled=seek.disabled||!range||(range.start===view.start&&range.end===view.end);
      full.disabled=seek.disabled||(view.start===0&&view.end===result.samples.length);
      clear.disabled=seek.disabled||!range;
    }
    function setPosition(sample){
      position=sample;
      if(!result)return;
      seek.value=String(clamp(sample,view.start,view.end-1));
      paintPosition();
    }
    function setView(next){
      view=next;
      seek.min=String(view.start);
      seek.max=String(view.end-1);
      setPosition(position);
      syncControls();
      draw();
    }
    function setResult(next){
      if(next===result)return;
      result=next;range=null;drag=null;keySelection=null;position=0;
      track.hidden=!result;
      if(result){
        seek.step=String(Math.max(1,Math.min(Math.round(result.sampleRate*.01),result.samples.length-1)));
        setView({start:0,end:result.samples.length});
      }else syncControls();
    }
    function clearRange(){
      range=null;keySelection=null;
      paintPosition();
      syncControls();
    }
    function commitRange(next){
      range=next;
      paintPosition();
      syncControls();
      onRange(range);
    }
    function interval(a,b){
      const start=Math.min(a,b),end=Math.max(a,b);
      return end-start>=2?{start,end}:null;
    }
    function pointerSample(event){
      const box=canvas.getBoundingClientRect();
      return view.start+Math.round(clamp((event.clientX-box.left)/Math.max(1,box.width),0,1)*(view.end-view.start));
    }
    seek.addEventListener('pointerdown',event=>{
      if(seek.disabled||event.button!==0||drag)return;
      event.preventDefault();
      seek.focus({preventScroll:true});
      seek.setPointerCapture(event.pointerId);
      keySelection=null;
      drag={id:event.pointerId,x:event.clientX,start:pointerSample(event),range:null};
    });
    seek.addEventListener('pointermove',event=>{
      if(!drag||event.pointerId!==drag.id)return;
      drag.range=Math.abs(event.clientX-drag.x)>=4?interval(drag.start,pointerSample(event)):null;
      paintPosition();
    });
    seek.addEventListener('pointerup',event=>{
      if(!drag||event.pointerId!==drag.id)return;
      const point=pointerSample(event),next=Math.abs(event.clientX-drag.x)>=4?interval(drag.start,point):null;
      drag=null;
      if(next)commitRange(next);
      else{
        paintPosition();
        onSeek(Math.min(point,view.end-1));
      }
    });
    seek.addEventListener('lostpointercapture',event=>{
      if(!drag||event.pointerId!==drag.id)return;
      drag=null;
      paintPosition();
    });
    seek.addEventListener('change',()=>{
      if(seek.disabled)return;
      keySelection=null;
      onSeek(clamp(Number(seek.value),view.start,view.end-1));
    });
    seek.addEventListener('keydown',event=>{
      if(seek.disabled)return;
      if(event.key==='Escape'&&range){event.preventDefault();clearRange();onRange(null);return;}
      if(!event.shiftKey||!['ArrowLeft','ArrowRight'].includes(event.key))return;
      event.preventDefault();
      const current=clamp(position,view.start,view.end-1);
      keySelection??={anchor:current,end:current};
      const direction=event.key==='ArrowLeft'?-1:1;
      keySelection.end=clamp(keySelection.end+direction*Number(seek.step),view.start,view.end);
      commitRange(interval(keySelection.anchor,keySelection.end));
    });
    zoom.addEventListener('click',()=>{if(range){keySelection=null;setView({...range});}});
    full.addEventListener('click',()=>{if(result){keySelection=null;setView({start:0,end:result.samples.length});}});
    clear.addEventListener('click',()=>{clearRange();onRange(null);});
    if(root.ResizeObserver)new ResizeObserver(draw).observe(canvas);
    else root.addEventListener('resize',draw);
    return {setResult,setPosition,clearRange,getRange:()=>range,setEnabled:value=>{
      enabled=value;
      if(!enabled)drag=null;
      syncControls();
    }};
  };
})(globalThis);
