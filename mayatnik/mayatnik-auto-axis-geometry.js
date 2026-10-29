/* Collect the exact existing Canvas guide path without painting a bitmap.
 * Geometry, switches and path clipping remain owned by the guide renderer. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./mayatnik-line-measures.js'):root.MayatnikLineMeasures);if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikAutoAxisGeometry=api;})(globalThis,function(Measures){
  'use strict';
  function capture(draw,{clip}={}){
    const noop=()=>{},context={strokeStyle:'#b48cff',fillStyle:'#000',lineWidth:1,globalAlpha:1,
      beginPath:noop,moveTo:noop,lineTo:noop,rect:noop,clip:noop,stroke:noop,fill:noop,arc:noop,closePath:noop,
      save:noop,restore:noop,setLineDash:noop,strokeText:noop,fillText:noop,measureText:()=>({width:0})};
    return Measures.capture(context,G=>{
      if(clip){G.beginPath();G.rect(clip[0],clip[1],clip[2]-clip[0],clip[3]-clip[1]);G.clip();}
      draw(G,context);
    });
  }
  return {capture};
});
