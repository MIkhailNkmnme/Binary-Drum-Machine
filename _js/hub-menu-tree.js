/* Layout only: one root on top, pinned buttons as a pyramid 1, 2, 3…, then each opened level a row of up to five.
   Hub v0.214: every row sits in one diamond lattice — next row half a diamond lower, shifted half a diamond, so edges touch
   and nothing leaves a gap. pyr = [dx, dy] in half-diamonds from the apex. */
(function(root){
  'use strict';
  function layout(tree,{promoted=[],open=[],hidden=[],rows=5,grow=false,lead=[]}={}){
    const first=new Set(lead);   // v0.226: включённые — первыми среди соседей
    const index=new Map(),lifted=new Set(promoted),opened=new Set(open),invisible=new Set(hidden);
    const visit=n=>{index.set(n.id,n);n.children?.forEach(visit);};visit(tree);
    const available=n=>!invisible.has(n.id)&&(!n.children||n.action||n.children.some(c=>!lifted.has(c.id)&&available(c)));
    const top=available(tree)?[tree]:[],lift=promoted.map(id=>index.get(id)).filter(n=>n&&n!==tree&&available(n));
    const cells=[];let r=0,lo=0,hi=0;
    const row=list=>{const n=list.length,shift=((n-1)&1)!==(r&1)?1:0;list.forEach((node,j)=>{const dx=2*j-(n-1)+shift;lo=Math.min(lo,dx);hi=Math.max(hi,dx);cells.push({id:node.id,head:cells.length===0,pyr:[dx,r]});});r++;};
    const apex=[...top,...lift];
    for(let i=0,k=1;i<apex.length;i+=k,k++)row(apex.slice(i,i+k));
    let level=apex;
    while(level.length){
      level=level.flatMap(n=>opened.has(n.id)?(n.children||[]).filter(c=>!lifted.has(c.id)&&available(c)).sort((a,b)=>first.has(b.id)-first.has(a.id)):[]);
      // grow: ряды треугольником — каждый следующий на ромб длиннее (2, 3, 4…), последний может быть неполным.
      if(grow)for(let i=0,k=r+1;i<level.length;i+=k,k++)row(level.slice(i,i+k));
      else for(let i=0;i<level.length;i+=rows)row(level.slice(i,i+rows));
    }
    return {cells,rows:r,span:[lo,hi]};
  }
  if(typeof module!=='undefined')module.exports={layout};else root.HubMenuTree={layout};
})(typeof window!=='undefined'?window:globalThis);
