/* Zoom only the row viewport; use the normal font/layout path so cell hit-testing stays exact. */
(() => {
  const canvas=document.getElementById('screenCanvas'),rows=document.getElementById('rows');
  if(!canvas||!rows)return;
  let pending=0,frame=0,point=null;
  canvas.addEventListener('wheel',e=>{
    if(e.altKey||e.shiftKey||!e.deltaY||e.target.closest('button,input,select,textarea,[contenteditable],#alignGrp,#colHeader'))return;
    e.preventDefault();e.stopPropagation();
    pending+=Math.max(-240,Math.min(240,e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1)));
    point={x:e.clientX,y:e.clientY};
    if(frame)return;
    frame=requestAnimationFrame(()=>{
      frame=0;const old=+fs.value,rounded=Math.round(old*Math.exp(-pending*.0015));
      const next=Math.max(+fs.min,Math.min(+fs.max,rounded===old&&pending?old-Math.sign(pending):rounded));pending=0;
      if(next===old)return;
      // Preserve the text position beneath the pointer, including padding used by centred rows.
      const lines=Array.from(rows.querySelectorAll('.ln[data-idx]'));
      const line=lines.find(el=>{const r=el.getBoundingClientRect();return point.y>=r.top&&point.y<r.bottom;});
      const span=line?.querySelector('.bits > span:first-child'),box=span?.getBoundingClientRect(),lr=line?.getBoundingClientRect();
      const anchor=box&&box.width&&lr.height?{id:line.dataset.idx,x:(point.x-box.left)/box.width,y:(point.y-lr.top)/lr.height}:null;
      fs.value=String(next);applyFont();render();
      if(anchor){
        const after=rows.querySelector(`.ln[data-idx="${anchor.id}"]`),ab=after?.querySelector('.bits > span:first-child')?.getBoundingClientRect(),ar=after?.getBoundingClientRect();
        if(ab&&ar){canvas.scrollLeft+=ab.left+anchor.x*ab.width-point.x;canvas.scrollTop+=ar.top+anchor.y*ar.height-point.y;}
      }
      saveCacheSoon();window.ZZRowInk?.refresh();
    });
  },{passive:false});
})();
