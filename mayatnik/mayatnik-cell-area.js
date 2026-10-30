/* Logical cell connectivity, independent of raster scale and antialiasing. */
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikCellArea=api;
})(globalThis,function(){
  'use strict';
  const squareSides=[[-1,0],[1,0],[0,-1],[0,1]],squareCorners=[[-1,-1],[-1,1],[1,-1],[1,1]],diamondCorners=[[-2,0],[2,0],[0,-2],[0,2]];
  // The established sides/corners modes group visible colour, including equal
  // colours on different bits. Corner-only/chess modes also require equal bits.
  function matches(mode,bit,colour,value){
    if(!value||value.bit<0)return false;
    if(mode==='bit')return value.bit===bit;
    return value.colour===colour&&(!['diagonal','chess0'].includes(mode)||value.bit===bit);
  }
  function select({seed,mode,bit,match,move,topology,key=cell=>cell.p+':'+cell.c+':'+cell.r,point=cell=>[cell.c,cell.r],limit,flood}){
    if(!seed)return [];
    const square=topology==='square'||seed.p<0,sides=square?squareSides:squareCorners,corners=square?squareCorners:diamondCorners;
    const chain=cell=>corners.some(([dc,dr])=>{const next=move(cell,dc,dr);return !!next&&match(next);});
    const neighbours=(cell,visit)=>{
      if(mode==='bit')return;
      const steps=mode==='sides'?sides:mode==='corners'?[...sides,...corners]:corners;
      for(const [dc,dr]of steps){const next=move(cell,dc,dr);if(next)visit(next);}
      if(mode==='chess0'&&bit===0&&chain(cell))for(const [dc,dr]of sides){const next=move(cell,dc,dr);if(next&&match(next)&&chain(next))visit(next);}
    };
    if(flood)return flood({seed,key,match,point,limit,neighbours});
    const seen=new Set([key(seed)]),queue=[seed],cells=[];
    for(let i=0;i<queue.length;i++){const cell=queue[i];if(!match(cell))continue;cells.push(cell);neighbours(cell,next=>{const k=key(next);if(!seen.has(k)){seen.add(k);queue.push(next);}});}
    return cells;
  }
  return {matches,select};
});
