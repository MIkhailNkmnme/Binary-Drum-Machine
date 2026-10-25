/* Plain mouse drag moves the whole viewport; Shift/Ctrl retain tool gestures. */
window.setkaPanMount=(cv,cfg)=>{
 let gesture=null;
 const consume=e=>{e.preventDefault();e.stopImmediatePropagation();};
 cv.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.pointerType==='touch'||e.shiftKey||e.ctrlKey||e.metaKey||e.altKey)return;
  const v=cfg.view();gesture={id:e.pointerId,x:e.clientX,y:e.clientY,ox:v.ox,oy:v.oy,moved:false};
  cv.setPointerCapture(e.pointerId);
 },true);
 cv.addEventListener('pointermove',e=>{
  const d=gesture;if(!d||d.id!==e.pointerId)return;
  const dx=e.clientX-d.x,dy=e.clientY-d.y;if(!d.moved&&Math.abs(dx)+Math.abs(dy)<=3)return;
  consume(e);if(!d.moved){d.moved=true;cfg.cancelTools();}
  cv.style.cursor='grabbing';cfg.pan(d.ox+dx,d.oy+dy);
 },true);
 const end=(e,cancel=false)=>{
  const d=gesture;if(!d||e.pointerId!=null&&d.id!==e.pointerId)return;gesture=null;
  if(!d.moved)return;consume(e);cv.style.cursor='';
  if(cancel)cfg.pan(d.ox,d.oy);else cfg.save();
  try{cv.releasePointerCapture(d.id);}catch(_){}
 };
 cv.addEventListener('pointerup',e=>end(e),true);
 cv.addEventListener('pointercancel',e=>end(e,true),true);
 cv.addEventListener('lostpointercapture',e=>end(e,true),true);
 addEventListener('blur',e=>end(e,true));
};
