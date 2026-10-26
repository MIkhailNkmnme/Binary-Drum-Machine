/* Read-only hit selection for all Ochki paths; gestures never edit field data. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikOchkiSelection=api;})(globalThis,function(){
  'use strict';
  function pick(found,cell,half=null){const matchIndices=[],rows=new Set(),cells=new Set();found.forEach((hit,index)=>{if(half!=null&&hit.p!==half||!hit.cells?.includes(cell))return;matchIndices.push(index);if(Number.isInteger(hit.i))rows.add(hit.i);for(const q of hit.cells)cells.add(q);});return {matchIndices,rowIndices:[...rows].sort((a,b)=>a-b),cells:[...cells]};}
  function recoverRun({W,H,val,row,col,mode,pattern,min=2,allowed=()=>true}){
    const [dc,dr]=({row:[2,0],col:[0,2],diag:[1,1],antidiag:[-1,1]})[mode]||[1,1],alternate=pattern==='alternating';
    const valid=(r,c)=>r>=0&&r<H&&c>=0&&c<W&&val[r*W+c]>=0&&allowed(r,c),joins=(r,c,rr,cc)=>valid(rr,cc)&&(alternate?val[r*W+c]!==val[rr*W+cc]:val[r*W+c]===val[rr*W+cc]);
    if(!valid(row,col))return null;let r=row,c=col;while(joins(r,c,r-dr,c-dc)){r-=dr;c-=dc;}
    const first={r,c},cells=[r*W+c];while(joins(r,c,r+dr,c+dc)){r+=dr;c+=dc;cells.push(r*W+c);}if(cells.length<min)return null;
    return {...first,n:cells.length,cells,text:cells.map(q=>String(val[q])).join(''),dir:({row:0,col:2,diag:1,antidiag:-1})[mode]??1};
  }
  function mount({element,hit,enabled=()=>true,select,pan,threshold=5}){
    let tap=null;
    const stop=e=>{e.preventDefault();e.stopImmediatePropagation();};
    const down=e=>{if(e.button!==0)return;const result=hit(e.clientX,e.clientY);if(!result||!enabled(e))return;tap={id:e.pointerId,x:e.clientX,y:e.clientY,result,drag:false,left:element.scrollLeft,top:element.scrollTop};element.setPointerCapture(e.pointerId);stop(e);};
    const move=e=>{if(tap?.id!==e.pointerId)return;if(Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>=threshold)tap.drag=true;if(tap.drag){element.classList.add('drag');element.scrollLeft=tap.left+tap.x-e.clientX;element.scrollTop=tap.top+tap.y-e.clientY;pan?.();}stop(e);};
    const up=e=>{if(tap?.id!==e.pointerId)return;const t=tap;tap=null;if(element.hasPointerCapture(e.pointerId))element.releasePointerCapture(e.pointerId);element.classList.remove('drag');if(e.type==='pointerup'&&!t.drag&&Math.hypot(e.clientX-t.x,e.clientY-t.y)<threshold)select(t.result);stop(e);};
    element.addEventListener('pointerdown',down,true);element.addEventListener('pointermove',move,true);element.addEventListener('pointerup',up,true);element.addEventListener('pointercancel',up,true);
    return {cancel(){tap=null;element.classList.remove('drag');},destroy(){for(const [name,fn]of [['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up]])element.removeEventListener(name,fn,true);}};
  }
  return {pick,recoverRun,mount};
});
