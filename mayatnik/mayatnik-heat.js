/* Heat is disposable display state. Only forward model frames can warm it;
 * cooling uses elapsed time, including while transport is paused or hidden. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikHeat=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const pack=rgb=>(0xff000000|rgb[2]<<16|rgb[1]<<8|rgb[0])>>>0;
  const COLD=[[100,155,220],[235,247,255]],HOT=[[255,211,91],[255,155,80],[255,90,79],[255,41,176],[255,255,255]];
  const cold=COLD.map(pack);
  // All cells changed in one model step share its age. A small colour table
  // avoids millions of per-channel interpolations on large native fields.
  const shades=COLD.map(c=>HOT.map(h=>Uint32Array.from({length:257},(_,level)=>
    pack(c.map((v,ch)=>Math.round(v+(h[ch]-v)*level/256))))));
  function create({now=()=>performance.now(),coolMs=2000}={}){
    let previous=null,owner=null,context=null,frame=-1,changedAt=null,run=null,warmUntil=0;
    function reset(){previous=null;owner=null;context=null;frame=-1;changedAt=null;run=null;warmUntil=0;}
    function observe({values,field,frame:nextFrame,context:nextContext},time=now()){
      if(!previous||owner!==field||context!==nextContext||previous.length!==values.length||nextFrame<frame||nextFrame-frame>64){
        previous=values.slice();owner=field;context=nextContext;frame=nextFrame;
        changedAt=new Float64Array(values.length);run=new Uint8Array(values.length);warmUntil=0;return;
      }
      if(nextFrame!==frame){
        for(let q=0;q<values.length;q++){
          if(values[q]>=0&&values[q]!==previous[q]){
            run[q]=changedAt[q]&&time-(changedAt[q]-1)<coolMs?Math.min(255,run[q]+1):1;
            changedAt[q]=time+1;warmUntil=time+coolMs;
          }
        }
        frame=nextFrame;
      }
      // Paint, parity redraws and repeated renders are a new baseline, never heat.
      previous.set(values);
    }
    function colour(q,bit,time=now()){
      if(bit<0)return null;
      const t=changedAt?.[q],a=t?Math.max(0,1-(time-(t-1))/coolMs):0;
      if(!a)return cold[bit?1:0];
      return shades[bit?1:0][Math.min(5,run[q])-1][Math.round(a*256)];
    }
    return {reset,observe,colour,hasWarm:(time=now())=>time<warmUntil};
  }
  function createScheduler({setTimer=setTimeout,clearTimer=clearTimeout,redraw,isEnabled,isVisible,hasWarm,fps=12}){
    let timer=null,disposed=false;
    const active=()=>!disposed&&isEnabled()&&isVisible();
    function cancel(){if(timer!==null){clearTimer(timer);timer=null;}}
    function request(){
      if(!active()||!hasWarm()){cancel();return;}
      if(timer!==null)return;
      timer=setTimer(()=>{
        timer=null;if(!active())return;
        const wasWarm=hasWarm();redraw();
        // A large raster can cross the deadline while drawing. Finish with an
        // exact cold raster, rather than leaving its last near-cold tint idle.
        if(active()&&wasWarm&&!hasWarm())redraw();
        request();
      },1000/fps);
    }
    function visibility(){cancel();if(active()){redraw();request();}}
    return {request,cancel,visibility,dispose(){disposed=true;cancel();}};
  }
  return {create,createScheduler,cold};
});
