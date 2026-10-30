/* Current-view erasure only. No field values, template objects or storage. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikTemplateTransient=api;})(globalThis,function(){
  'use strict';
  function create(){
    let owner=null,key=null,spans=[],ids=new Set(),changes=new WeakMap();
    function clear(){spans=[];ids.clear();changes=new WeakMap();}
    function sync(scope){if(!scope||scope.owner!==owner||scope.key!==key){clear();owner=scope?.owner??null;key=scope?.key??null;return true;}return false;}
    // History carries an opaque token only. Geometry lives in this instance's
    // private map and becomes unreachable as soon as the view scope changes.
    const snapshot=()=>({spans:spans.slice(),ids:[...ids]});
    function checkpoint(){const token={};changes.set(token,{before:snapshot(),after:null});return token;}
    function commit(token){const change=changes.get(token);if(!change)return 0;change.after=snapshot();return 128+32*(change.before.spans.length+change.after.spans.length)+16*(change.before.ids.length+change.after.ids.length);}
    function valid(token){return !!token&&!!changes.get(token)?.after;}
    function apply(token,redo){const change=changes.get(token);if(!change?.after)return false;const state=redo?change.after:change.before;spans=state.spans.slice();ids=new Set(state.ids);return true;}
    function hide(parts,itemIds){
      const prepared=[];
      for(const {mask,rect,clip}of parts){
        if(!mask||!rect||![rect.x,rect.y,rect.width,rect.height].every(Number.isFinite)||rect.width<=0||rect.height<=0)continue;
        const sx=rect.width/mask.width,sy=rect.height/mask.height;
        for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;){
          if(!mask.data[y*mask.width+x]){x++;continue;}const start=x;while(x<mask.width&&mask.data[y*mask.width+x])x++;
          let left=rect.x+start*sx,right=rect.x+x*sx,top=rect.y+y*sy,bottom=rect.y+(y+1)*sy;
          if(clip){left=Math.max(left,clip.x);right=Math.min(right,clip.x+clip.width);top=Math.max(top,clip.y);bottom=Math.min(bottom,clip.y+clip.height);}
          if(right>left&&bottom>top)prepared.push([left,top,right-left,bottom-top]);
        }
      }
      if(!prepared.length)return false;for(const span of prepared)spans.push(span);for(const id of itemIds)ids.add(id);return true;
    }
    function draw(ctx,{x=0,y=0,scale=1,background='#000',split=null,bottom=background}){
      ctx.save();ctx.globalAlpha=1;
      for(const [left,top,width,height]of spans){
        const end=top+height,mid=split===null?end:Math.max(top,Math.min(end,split));
        if(mid>top){ctx.fillStyle=background;ctx.fillRect(x+left*scale,y+top*scale,width*scale,(mid-top)*scale);}
        if(end>mid){ctx.fillStyle=bottom;ctx.fillRect(x+left*scale,y+mid*scale,width*scale,(end-mid)*scale);}
      }ctx.restore();
    }
    return {sync,clear,checkpoint,commit,valid,apply,hide,draw,has:id=>ids.has(id),contains:(x,y)=>spans.some(([a,b,w,h])=>x>=a&&x<a+w&&y>=b&&y<b+h),get active(){return spans.length>0;}};
  }
  return {create};
});
