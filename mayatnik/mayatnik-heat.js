/* Heat is disposable display state observed once per forward frame: +/-1, 0..5.
 * Wall-clock time and repeated presentation renders do not change the level. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikHeat=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const pack=rgb=>(0xff000000|rgb[2]<<16|rgb[1]<<8|rgb[0])>>>0;
  const cold=[[100,155,220],[235,247,255]].map(pack);
  const hot=[[255,211,91],[255,155,80],[255,90,79],[255,41,176],[255,255,255]].map(pack);
  // The first period, starting at the user-visible frame #1, selects ones.
  function selectedBit(mode,period,frame){
    if(mode==='one')return 1;
    if(mode==='zero')return 0;
    if(mode!=='alternate')return null;
    const n=Number(period),p=Number.isFinite(n)?Math.max(1,Math.min(64,Math.trunc(n))):1;
    const f=Number(frame),index=Number.isFinite(f)?Math.max(1,Math.trunc(f)):1;
    return Math.floor((index-1)/p)%2===0?1:0;
  }
  function appliesTo(bit,mode,period,frame){
    if(bit!==0&&bit!==1)return false;
    const selected=selectedBit(mode,period,frame);
    return selected===null||bit===selected;
  }
  function create(){
    let previous=null,owner=null,context=null,frame=-1,levels=null,warmCount=0;
    function reset(){previous=null;owner=null;context=null;frame=-1;levels=null;warmCount=0;}
    function observe({values,field,frame:nextFrame,context:nextContext,holdZero=false}){
      // Intermediate changes cannot be reconstructed across a skipped frame.
      if(!previous||owner!==field||context!==nextContext||previous.length!==values.length||nextFrame<frame||nextFrame>frame+1){
        previous=values.slice();owner=field;context=nextContext;frame=nextFrame;
        levels=new Uint8Array(values.length);warmCount=0;return;
      }
      if(nextFrame!==frame){
        warmCount=0;
        for(let q=0;q<values.length;q++){
          const bit=values[q],before=previous[q];
          // Newly occupied cells have no preceding bit to compare against.
          if(bit<0||before<0)levels[q]=0;
          else if(!holdZero||bit===1)levels[q]=Math.max(0,Math.min(5,levels[q]+(bit!==before?1:-1)));
          if(levels[q])warmCount++;
        }
        frame=nextFrame;
      }
      // Same-frame paint becomes the baseline without warming or cooling.
      previous.set(values);
    }
    function level(q){return levels?.[q]||0;}
    function colour(q,bit){
      if(bit<0)return null;
      const heat=level(q);
      return heat?hot[heat-1]:cold[bit?1:0];
    }
    return {reset,observe,colour,level,hasWarm:()=>warmCount>0};
  }
  return {create,cold,selectedBit,appliesTo};
});
