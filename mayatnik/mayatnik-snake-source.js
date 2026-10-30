/* Exact current-path geometry. Raster ownership and source addresses are supplied
 * by the semantic search; colours are never decoded as bit values. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikSnakeSource=api;})(globalThis,function(){
 'use strict';
 function metadata(point,source=null,space='видимые клетки'){
  const known=source&&Number.isSafeInteger(source.q)&&source.q>=0&&Number.isInteger(source.r)&&Number.isInteger(source.c)?{q:source.q,r:source.r,c:source.c}:null;
  const display=point&&Number.isFinite(point.x)&&Number.isFinite(point.y)?{x:point.x,y:point.y,space}:null;
  return known||display?{source:known,display}:null;
 }
 function raster(indices,width,scale){
  const pixels=new Set(indices),edges=[];
  for(const q of pixels){const x=q%width,y=Math.floor(q/width);if(!pixels.has(q-width))edges.push([x,y,x+1,y]);if(x===width-1||!pixels.has(q+1))edges.push([x+1,y,x+1,y+1]);if(!pixels.has(q+width))edges.push([x+1,y+1,x,y+1]);if(x===0||!pixels.has(q-1))edges.push([x,y+1,x,y]);}
  return {contains(x,y){const X=Math.floor(x*scale),Y=Math.floor(y*scale);return X>=0&&X<width&&Y>=0&&pixels.has(Y*width+X);},trace(ctx,project){for(const [x,y,X,Y]of edges){const a=project(x/scale,y/scale),b=project(X/scale,Y/scale);ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}},size:pixels.size};
 }
 function cells(points,diamond){
  const radius=diamond?1:.5,edges=new Map(),vertices=p=>diamond?[[p.x,p.y-1],[p.x+1,p.y],[p.x,p.y+1],[p.x-1,p.y]]:[[p.x-.5,p.y-.5],[p.x+.5,p.y-.5],[p.x+.5,p.y+.5],[p.x-.5,p.y+.5]];
  for(const p of points){const v=vertices(p);for(let i=0;i<4;i++){const a=v[i],b=v[(i+1)%4],key=[a,b].sort((a,b)=>a[0]-b[0]||a[1]-b[1]).map(p=>p.join(',')).join('|');if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}}
  return {contains(x,y){return points.some(p=>diamond?Math.abs(x-p.x)+Math.abs(y-p.y)<=radius:Math.abs(x-p.x)<=radius&&Math.abs(y-p.y)<=radius);},trace(ctx,project){for(const [a,b]of edges.values()){const p=project(...a),q=project(...b);ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);}}};
 }
 function manual({graph,chosen,width,scale,sourceAt,fragment=false,originalStart}){
  const ids=Array.from(chosen),selected=new Set(ids);let indices;
  if(graph.pixelsFor)indices=graph.pixelsFor(ids);else{const out=[];for(let q=0;q<graph.rasterOwnerIds.length;q++)if(selected.has(graph.rasterOwnerIds[q]))out.push(q);indices=Uint32Array.from(out);}
  const first=graph.nodes[ids[0]],last=graph.nodes[ids.at(-1)],address=p=>metadata(p,!fragment&&p?sourceAt?.(p):null);
  return {indices,geometry:raster(indices,width,scale),point:first?{x:first.x,y:first.y}:null,originalStart:originalStart?.slice(),start:address(first),end:address(last)};
 }
 function projected(path,{project,unproject}){return {...path,start:project(path.point.x,path.point.y),hitTest(x,y){const p=unproject(x,y);return path.geometry.contains(p.x,p.y);},outline(ctx){path.geometry.trace(ctx,project);}};}
 function choose(api,hit,{manual=false,paths=[],advance=()=>{}}={}){const path=paths.find(p=>p.id===hit?.id);if(!path||api.get().key!==hit.frameKey)return false;const repeat=api.get().selected===hit.id;if(!api.choose(hit))return false;if(repeat&&manual&&path.originalStart)advance(...path.originalStart);return true;}
 function gesture({element,hit,enabled=()=>true,select,pan,threshold=5}){
  let tap=null;const stop=e=>{e.preventDefault();e.stopImmediatePropagation();},cancel=()=>{const t=tap;tap=null;if(t&&element.hasPointerCapture(t.id))element.releasePointerCapture(t.id);element.classList.remove('drag');};
  function down(e){if(tap){cancel();return;}if(e.pointerType==='touch'||e.button!==0||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||!enabled(e))return;const result=hit(e.clientX,e.clientY);if(!result)return;tap={id:e.pointerId,x:e.clientX,y:e.clientY,result,drag:false,left:element.scrollLeft,top:element.scrollTop};element.setPointerCapture(e.pointerId);stop(e);}
  function move(e){if(tap?.id!==e.pointerId)return;if(Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>=threshold)tap.drag=true;if(tap.drag){element.scrollLeft=tap.left+tap.x-e.clientX;element.scrollTop=tap.top+tap.y-e.clientY;element.classList.add('drag');pan?.();}stop(e);}
  function end(e){if(tap?.id!==e.pointerId)return;const t=tap;cancel();if(e.type==='pointerup'&&!t.drag&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey&&Math.hypot(e.clientX-t.x,e.clientY-t.y)<threshold){const current=hit(e.clientX,e.clientY);if(current?.id===t.result.id&&current.frameKey===t.result.frameKey)select(t.result);}stop(e);}
  for(const [type,fn]of [['pointerdown',down],['pointermove',move],['pointerup',end],['pointercancel',end],['lostpointercapture',end]])element.addEventListener(type,fn,true);
  return {cancel};
 }
 return {metadata,raster,cells,manual,projected,choose,gesture};
});
