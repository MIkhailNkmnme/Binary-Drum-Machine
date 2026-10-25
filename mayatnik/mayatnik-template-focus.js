/* View-only template focus: one occurrence, unchanged zoom and unchanged field data. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikTemplateFocus=api;})(globalThis,function(){
  'use strict';
  function choose(instances,preferred){const visible=(instances||[]).filter(item=>item&&item.visible!==false);return visible.find(item=>item.id===preferred)||visible[0]||null;}
  function union(rects){const valid=(rects||[]).filter(r=>r&&[r.x,r.y,r.width,r.height].every(Number.isFinite)&&r.width>0&&r.height>0);if(!valid.length)return null;
    const x=Math.min(...valid.map(r=>r.x)),y=Math.min(...valid.map(r=>r.y)),right=Math.max(...valid.map(r=>r.x+r.width)),bottom=Math.max(...valid.map(r=>r.y+r.height));return {x,y,width:right-x,height:bottom-y};}
  function viewport(rect,panel){const left=rect.left,top=rect.top,right=Math.min(rect.right,panel?.left??rect.right),bottom=rect.bottom;return {left,top,right,bottom,width:Math.max(0,right-left),height:Math.max(0,bottom-top)};}
  function panDelta(target,available){if(!target||available.width<=0||available.height<=0)return null;
    return {x:target.x+target.width/2-(available.left+available.width/2),y:target.y+target.height/2-(available.top+available.height/2)};}
  function scrollPlan(target,canvas,available,padding={left:0,right:0,top:0,bottom:0},current={}){
    if(!target||available.width<=0||available.height<=0)return null;
    const x=target.x+target.width/2,y=target.y+target.height/2,halfX=available.width/2,halfY=available.height/2;
    const left=Math.max(0,halfX-x-(padding.left||0)),right=Math.max(0,halfX-(canvas.width-x)-(padding.right||0));
    const top=Math.max(0,halfY-y-(padding.top||0)),bottom=Math.max(0,halfY-(canvas.height-y)-(padding.bottom||0));
    // Do not push the first row down just to centre a template near the top.
    // Remove an earlier focus spacer as well, preserving actual vertical scroll.
    if(top>0){const scrollTop=Math.max(0,(current.scrollTop||0)-(current.margins?.top||0)),keepBottom=Math.max(0,current.margins?.bottom||0,scrollTop+available.height-canvas.height-(padding.top||0)-(padding.bottom||0));
      return {margins:{left,right,top:0,bottom:keepBottom},scrollLeft:(padding.left||0)+left+x-halfX,scrollTop,horizontalOnly:true};}
    return {margins:{left,right,top,bottom},scrollLeft:(padding.left||0)+left+x-halfX,scrollTop:(padding.top||0)+top+y-halfY};
  }
  return {choose,union,viewport,panDelta,scrollPlan};
});
