/* Joined rhombus lattices: p0 above, p1 reflected below their common base.
 * Coordinates name cell centres at (x + .5, y + .5). Source data is never edited.
 * Both halves occupy one display parity, so neighbours across the join remain
 * (x - 1, y + 1) and (x + 1, y + 1), just as elsewhere in the diamond grid. */
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikJoinedRomb=api;
})(globalThis,function(){
  'use strict';
  function create({width,height,origin=0,anchor=0,fieldWidth=width,rotate=false}){
    if(![width,height,origin,anchor,fieldWidth].every(Number.isSafeInteger)||width<1||height<1||origin<0||fieldWidth<origin+width)
      throw new RangeError('Invalid joined rhombus source geometry');
    const reflection=2*Math.ceil((width-1)/2),displayWidth=rotate?Math.max(width,reflection+1):width,displayHeight=2*height,displayAnchor=anchor-origin;
    if(!Number.isSafeInteger(fieldWidth*height)||!Number.isSafeInteger(displayWidth*displayHeight))throw new RangeError('Joined rhombus geometry is too large');
    const config=Object.freeze({width,height,origin,anchor,fieldWidth,rotate:!!rotate});
    // Canvas-compatible transforms of continuous source-window coordinates.
    // They also transform axes, clips and cell polygons without separate rules.
    const parts=Object.freeze([
      Object.freeze({p:0,matrix:Object.freeze([1,0,0,1,0,0])}),
      Object.freeze({p:1,matrix:Object.freeze([rotate?-1:1,0,0,-1,rotate?reflection+1:0,displayHeight])})
    ]);
    function point(x,y,p){
      if(!Number.isFinite(x)||!Number.isFinite(y)||(p!==0&&p!==1))return null;
      const m=parts[p].matrix;return {x:m[0]*x+m[4],y:m[3]*y+m[5]};
    }
    function footprint(p){
      if(p!==0&&p!==1)return [];
      const edges=[],seen=new Set(),inside=(c,r)=>c>=0&&c<width&&r>=0&&r<height;
      function boundaryCell(c,r){
        if(!inside(c,r)||((c+origin-anchor-r)&1)!==p)return;
        const key=r*width+c;if(seen.has(key))return;seen.add(key);
        const v=[[c+.5,r-.5],[c+1.5,r+.5],[c+.5,r+1.5],[c-.5,r+.5]],n=[[1,-1],[1,1],[-1,1],[-1,-1]];
        for(let i=0;i<4;i++)if(!inside(c+n[i][0],r+n[i][1]))edges.push([v[i],v[(i+1)%4]]);
      }
      for(let c=0;c<width;c++){boundaryCell(c,0);boundaryCell(c,height-1);}
      for(let r=0;r<height;r++){boundaryCell(0,r);boundaryCell(width-1,r);}
      const starts=new Map();edges.forEach((e,i)=>{const k=e[0].join(',');if(!starts.has(k))starts.set(k,[]);starts.get(k).push(i);});
      const used=new Set(),loops=[];
      for(let i=0;i<edges.length;i++)if(!used.has(i)){
        const loop=[edges[i][0]],start=edges[i][0].join(',');let next=i;
        while(next!==undefined&&!used.has(next)){used.add(next);const end=edges[next][1];loop.push(end);if(end.join(',')===start)break;next=starts.get(end.join(','))?.find(j=>!used.has(j));}
        loops.push(loop);
      }
      return loops;
    }
    function forward(c,r){
      if(!Number.isInteger(c)||!Number.isInteger(r)||c<origin||c>=origin+width||r<0||r>=height)return null;
      const p=(c-anchor-r)&1,x=p&&rotate?reflection-(c-origin):c-origin,y=p?displayHeight-1-r:r;
      return {x,y,c,r,p,q:r*fieldWidth+c,displayQ:y*displayWidth+x};
    }
    function inverse(x,y){
      if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=displayWidth||y<0||y>=displayHeight||((x-displayAnchor-y)&1))return null;
      const p=y>=height?1:0,c=origin+(p&&rotate?reflection-x:x),r=p?displayHeight-1-y:y;
      if(c<origin||c>=origin+width)return null;
      return {x,y,c,r,p,q:r*fieldWidth+c,displayQ:y*displayWidth+x};
    }
    function hit(fx,fy){
      if(!Number.isFinite(fx)||!Number.isFinite(fy)||fx<0||fy<0||fx>=displayWidth||fy>=displayHeight)return null;
      // The nearest diamond centre is found in the common display lattice,
      // before selecting its source half. This also handles points on the join.
      const x=fx-.5-displayAnchor,y=fy-.5,i=Math.round((x+y)/2),j=Math.round((x-y)/2);
      return inverse(i+j+displayAnchor,i-j);
    }
    function fromSource(q){return Number.isSafeInteger(q)&&q>=0?forward(q%fieldWidth,Math.floor(q/fieldWidth)):null;}
    function fromDisplay(q){return Number.isSafeInteger(q)&&q>=0?inverse(q%displayWidth,Math.floor(q/displayWidth)):null;}
    function snapshot({val,allowed}){
      if(!val||val.length<fieldWidth*height)throw new RangeError('Joined rhombus source field is incomplete');
      const values=new Int8Array(displayWidth*displayHeight);values.fill(-1);
      for(let r=0;r<height;r++)for(let c=origin;c<origin+width;c++){
        const q=r*fieldWidth+c,p=(c-anchor-r)&1,v=val[q];
        if(v!==-1&&v!==0&&v!==1)throw new RangeError('Invalid joined rhombus bit');
        if(v>=0&&(!allowed||allowed(r,c,p,q))){const x=p&&rotate?reflection-(c-origin):c-origin,y=p?displayHeight-1-r:r;values[y*displayWidth+x]=v;}
      }
      // Mapping is compact and serializable. create(snapshot.mapping).fromDisplay
      // maps worker hits back to {q,p}; no full-size Int32 qMap is necessary.
      return {width:displayWidth,height:displayHeight,anchor:displayAnchor,val:values,parities:[0],halves:1,mapping:config};
    }
    return Object.freeze({width:displayWidth,height:displayHeight,anchor:displayAnchor,sourceWidth:width,sourceHeight:height,
      reflection,config,parts,point,footprint,forward,inverse,hit,fromSource,fromDisplay,snapshot});
  }
  return {create};
});
