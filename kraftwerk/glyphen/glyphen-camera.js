/* A viewBox camera: view gestures never resample or change the logical bits. */
(function(root){
 'use strict';
 function create(options){
  const svg=options.svg,touches=new Map(),limit=(n,a,b)=>Math.max(a,Math.min(b,n));
  let base={width:1,height:1},zoom=1,box={x:0,y:0,width:1,height:1},gesture=null,single=null;
  const touch=matchMedia('(any-pointer:coarse), (max-width:640px)').matches;
  function point(event){const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const matrix=svg.getScreenCTM();if(matrix)return p.matrixTransform(matrix.inverse());return {x:box.x,y:box.y};}
  function constrain(){
   box.width=base.width/zoom;box.height=base.height/zoom;
   box.x=limit(box.x,Math.min(0,base.width-box.width),Math.max(0,base.width-box.width));
   box.y=limit(box.y,Math.min(0,base.height-box.height),Math.max(0,base.height-box.height));
  }
  function refresh(){
   constrain();svg.setAttribute('viewBox',[box.x,box.y,box.width,box.height].join(' '));
   options.onView?.({zoom,cellPixels:svg.getBoundingClientRect().width/box.width,fit:Math.abs(zoom-1)<.00001&&Math.abs(box.x)<.00001&&Math.abs(box.y)<.00001});
  }
  function fit(){zoom=1;box.x=box.y=0;refresh();}
  function setBase(width,height){if(width===base.width&&height===base.height){refresh();return;}base={width,height};fit();}
  function zoomTo(next,clientX,clientY){
   const rect=svg.getBoundingClientRect(),cx=clientX??rect.left+rect.width/2,cy=clientY??rect.top+rect.height/2;
   const anchor=point({clientX:cx,clientY:cy});zoom=limit(next,.125,64);
   box.x=anchor.x-(cx-rect.left)/Math.max(1,rect.width)*base.width/zoom;
   box.y=anchor.y-(cy-rect.top)/Math.max(1,rect.height)*base.height/zoom;refresh();
  }
  function fake(start,event=start){return {pointerId:start.pointerId,pointerType:'touch',button:0,isPrimary:true,target:start.target,currentTarget:svg,clientX:event.clientX,clientY:event.clientY,preventDefault(){}};}
  const stop=event=>{event.preventDefault();event.stopImmediatePropagation();};
  function pair(){const [a,b]=[...touches.values()];return {distance:Math.max(1,Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)),x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2};}
  svg.addEventListener('pointerdown',event=>{
   if(event.pointerType!=='touch')return;
   const start={pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY,target:event.target};touches.set(event.pointerId,start);
   svg.setPointerCapture(event.pointerId);
   if(touches.size===1){single={start,page:options.isBackground(event),lastY:event.clientY,started:false,editing:options.isEditing(),moved:0};}
   else{
    options.cancelDrag();const p=pair();gesture={...p,zoom,anchor:point({clientX:p.x,clientY:p.y})};single=null;
   }
   stop(event);
  },{capture:true});
  svg.addEventListener('pointermove',event=>{
   if(event.pointerType!=='touch'||!touches.has(event.pointerId))return;
   const old=touches.get(event.pointerId);touches.set(event.pointerId,{...old,clientX:event.clientX,clientY:event.clientY});
   if(touches.size>=2&&gesture){
    const p=pair(),rect=svg.getBoundingClientRect();zoom=limit(gesture.zoom*p.distance/gesture.distance,.125,64);
    box.x=gesture.anchor.x-(p.x-rect.left)/Math.max(1,rect.width)*base.width/zoom;
    box.y=gesture.anchor.y-(p.y-rect.top)/Math.max(1,rect.height)*base.height/zoom;refresh();
   }else if(single){
    single.moved=Math.max(single.moved,Math.hypot(event.clientX-single.start.clientX,event.clientY-single.start.clientY));
    if(single.page){window.scrollBy(0,single.lastY-event.clientY);single.lastY=event.clientY;}
    else if(!single.editing&&single.moved>=4){if(!single.started){options.down(fake(single.start));single.started=true;}options.move(fake(single.start,event));}
   }
   stop(event);
  },{capture:true});
  function finish(event,cancelled=false){
   if(event.pointerType!=='touch'||!touches.has(event.pointerId))return;
   if(single){
    if(!cancelled&&!single.page&&!single.started&&single.moved<8){options.down(fake(single.start));single.started=true;}
    if(single.started){if(cancelled)options.cancelDrag();else options.up(fake(single.start,event));}
   }
   touches.delete(event.pointerId);single=null;
   // After a pinch, the remaining finger must not start moving a figure.
   if(!touches.size)gesture=null;else if(touches.size>=2){const p=pair();gesture={...p,zoom,anchor:point({clientX:p.x,clientY:p.y})};}
   stop(event);
  }
  svg.addEventListener('pointerup',event=>finish(event),{capture:true});
  svg.addEventListener('pointercancel',event=>finish(event,true),{capture:true});
  svg.addEventListener('wheel',event=>{if(!event.ctrlKey&&!event.metaKey)return;event.preventDefault();zoomTo(zoom*Math.exp(-event.deltaY*.005),event.clientX,event.clientY);},{passive:false});
  const resize=typeof ResizeObserver==='function'?new ResizeObserver(refresh):null;resize?.observe(svg);
  const current=options.geometry();base={width:current.width,height:current.height};fit();
  return {touch,point,fit,refresh,setBase,zoomBy:factor=>zoomTo(zoom*factor),setCellPixels:px=>zoomTo(px*base.width/Math.max(1,svg.getBoundingClientRect().width))};
 }
 root.XorFieldCameraModule={create};
})(window);
