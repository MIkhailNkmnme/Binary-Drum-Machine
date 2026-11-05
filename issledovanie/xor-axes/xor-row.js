/* Pure row geometry and reflected motion. Coordinates stay fractional until rasterization. */
(function(root){
 'use strict';
 const mod=(n,d)=>((n%d)+d)%d;
 function geometry(side,row){return {width:row?side+30:side,height:side,cx:(side-1)/2,cy:(side-1)/2,side,row:!!row};}
 function reach(points){return Math.max(1,...points.flat().map(p=>Math.max(Math.abs(p[0]),Math.abs(p[1]))));}
 function slotX(geometry,slot){return slot*10+Math.floor(geometry.side/2);}
 function offsetAt(snapshot,id,slot,seconds){
  const g=snapshot.geometry,track=snapshot.tracks[id],margin=snapshot.margin;
  const lo=margin,hi=g.width-1-margin,span=Math.max(0,hi-lo),base=slotX(g,slot);
  const velocity=track.auto?track.speed*track.direction:0;
  const raw=base+track.x+velocity*Math.max(0,seconds);
  if(!span)return {x:lo,integerX:Math.round(lo),offset:lo-base,direction:track.direction};
  if(!track.auto){const x=Math.max(lo,Math.min(hi,raw));return {x,integerX:Math.round(x),offset:x-base,direction:track.direction};}
  const phase=mod(raw-lo,2*span),forward=phase<span;
  const x=lo+(forward?phase:2*span-phase);
  const direction=x<=lo?1:x>=hi?-1:(forward?1:-1)*track.direction;
  return {x,integerX:Math.round(x),offset:x-base,direction};
 }
 root.XorRow=Object.freeze({geometry,reach,slotX,offsetAt});
})(window);
