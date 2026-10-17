/* Zoom only the row viewport; use the normal font/layout path so cell hit-testing stays exact. */
(() => {
  const canvas=document.getElementById('screenCanvas'),rows=document.getElementById('rows');
  if(!canvas||!rows)return;
  // Browser scroll anchoring must not compete with our explicit zoom anchor.
  canvas.style.overflowAnchor='none';
  const horizonY=()=>{
    const chain=document.getElementById('chain'),line=document.getElementById('hsplitTop');
    return chain?chain.getBoundingClientRect().top+(parseFloat(line?.style.top)||0):rows.getBoundingClientRect().top;
  };
  let pending=0,frame=0,point=null;
  canvas.addEventListener('wheel',e=>{
    if(e.altKey||e.shiftKey||!e.deltaY||e.target.closest('button,input,select,textarea,[contenteditable],#alignGrp,#colHeader'))return;
    e.preventDefault();e.stopPropagation();
    // Wheel down enlarges, wheel up reduces (user-selected direction).
    pending-=Math.max(-240,Math.min(240,e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1)));
    point={x:e.clientX,y:e.clientY};
    if(frame)return;
    frame=requestAnimationFrame(()=>{
      frame=0;const old=+fs.value,rounded=Math.round(old*Math.exp(-pending*.0015));
      const next=Math.max(+fs.min,Math.min(+fs.max,rounded===old&&pending?old-Math.sign(pending):rounded));pending=0;
      if(next===old)return;
      // Keep the horizontal text position under the pointer, but pin vertical zoom to the horizon.
      const horizonBefore=horizonY(),scrollBefore=canvas.scrollTop;
      const lines=Array.from(rows.querySelectorAll('.ln[data-idx]'));
      const line=lines.find(el=>{const r=el.getBoundingClientRect();return point.y>=r.top&&point.y<r.bottom;});
      const span=line?.querySelector('.bits > span:first-child'),box=span?.getBoundingClientRect();
      const anchor=box&&box.width?{id:line.dataset.idx,x:(point.x-box.left)/box.width}:null;
      fs.value=String(next);applyFont();render();
      canvas.scrollTop=scrollBefore;
      const dy=horizonY()-horizonBefore;
      if(Math.abs(dy)>.01){
        const rowH=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--row-h'))||1;
        chainShiftRows-=dy/rowH;
        applyPatOffsets();render();
        canvas.scrollTop=scrollBefore;
      }
      if(anchor){
        const after=rows.querySelector(`.ln[data-idx="${anchor.id}"]`),ab=after?.querySelector('.bits > span:first-child')?.getBoundingClientRect();
        if(ab)canvas.scrollLeft+=ab.left+anchor.x*ab.width-point.x;
      }
      saveCacheSoon();window.ZZRowInk?.refresh();
    });
  },{passive:false});
})();
