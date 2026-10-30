/* Joined rhombus lattices: p0 above, p1 reflected below their common base.
 * Coordinates name cell centres at (x + .5, y + .5). Source data is never edited.
 * Both halves occupy one display parity, so neighbours across the join remain
 * (x - 1, y + 1) and (x + 1, y + 1), just as elsewhere in the diamond grid. */
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikJoinedRomb=api;
})(globalThis,function(){
  'use strict';
  function create({width,height,origin=0,anchor=0,fieldWidth=width,rotate=false,rotateParity=1,wholeSource=false,topology='square',lattice=-1,gap=0,panelCopies=false}){
    if(![width,height,origin,anchor,fieldWidth].every(Number.isSafeInteger)||width<1||height<1||origin<0||fieldWidth<origin+width)
      throw new RangeError('Invalid joined rhombus source geometry');
    if(wholeSource)return whole({width,height,origin,anchor,fieldWidth,topology,lattice,gap,panelCopies});
    const reflection=2*Math.ceil((width-1)/2),displayWidth=rotate?Math.max(width,reflection+1):width,displayHeight=2*height,displayAnchor=anchor-origin+(rotateParity===0?1:0);
    if(!Number.isSafeInteger(fieldWidth*height)||!Number.isSafeInteger(displayWidth*displayHeight))throw new RangeError('Joined rhombus geometry is too large');
    const config=Object.freeze({width,height,origin,anchor,fieldWidth,rotate:!!rotate,...(rotateParity===0?{rotateParity:0}:{})});
    // Canvas-compatible transforms of continuous source-window coordinates.
    // They also transform axes, clips and cell polygons without separate rules.
    const parts=Object.freeze([
      ...[0,1].map(p=>Object.freeze({p,matrix:Object.freeze(p===rotateParity?[rotate?-1:1,0,0,-1,rotate?reflection+1:0,displayHeight]:[1,0,0,1,0,0])}))
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
      const p=(c-anchor-r)&1,x=p===rotateParity&&rotate?reflection-(c-origin):c-origin,y=p===rotateParity?displayHeight-1-r:r;
      return {x,y,c,r,p,q:r*fieldWidth+c,displayQ:y*displayWidth+x};
    }
    function inverse(x,y){
      if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=displayWidth||y<0||y>=displayHeight||((x-displayAnchor-y)&1))return null;
      const lower=y>=height,p=lower?rotateParity:1-rotateParity,c=origin+(lower&&rotate?reflection-x:x),r=lower?displayHeight-1-y:y;
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
        if(v>=0&&(!allowed||allowed(r,c,p,q))){const x=p===rotateParity&&rotate?reflection-(c-origin):c-origin,y=p===rotateParity?displayHeight-1-r:r;values[y*displayWidth+x]=v;}
      }
      // Mapping is compact and serializable. create(snapshot.mapping).fromDisplay
      // maps worker hits back to {q,p}; no full-size Int32 qMap is necessary.
      return {width:displayWidth,height:displayHeight,anchor:displayAnchor,val:values,parities:[0],halves:1,mapping:config};
    }
    return Object.freeze({width:displayWidth,height:displayHeight,anchor:displayAnchor,sourceWidth:width,sourceHeight:height,
      reflection,config,parts,point,footprint,forward,inverse,hit,fromSource,fromDisplay,snapshot});
  }
  // A custom bitmap is not a pair of complementary lattices. Each cell has
  // two display addresses: the selected complete view and its complete 180° copy.
  function whole({width,height,origin,anchor,fieldWidth,topology,lattice,gap,panelCopies}){
    const diamond=topology==='diamond';lattice=diamond?(lattice===0||lattice===1?lattice:2):-1;gap=diamond&&lattice===2?Math.max(0,Math.floor(gap)):0;
    const localCopies=diamond&&lattice===2&&!!panelCopies,displayWidth=lattice===2?2*width+gap:width,displayHeight=2*height,displayAnchor=anchor-origin,reflection=displayWidth-1;
    if(!Number.isSafeInteger(gap)||!Number.isSafeInteger(fieldWidth*height)||!Number.isSafeInteger(displayWidth*displayHeight))throw new RangeError('Joined bitmap geometry is too large');
    const config=Object.freeze({width,height,origin,anchor,fieldWidth,rotate:true,wholeSource:true,...(diamond?{topology:'diamond',lattice,gap,...(localCopies?{panelCopies:true}:{})}:{})});
    const sourceParities=diamond?(lattice===2?[0,1]:[lattice]):[-1],parts=Object.freeze([0,1].flatMap(copy=>sourceParities.map(sourceParity=>{
      const offset=lattice===2&&sourceParity===1?width+gap:0,p=diamond?copy*2+sourceParity:copy;
      return Object.freeze({p,copy,sourceParity,offset,matrix:Object.freeze(copy?[-1,0,0,-1,localCopies?offset+width:displayWidth-offset,displayHeight]:[1,0,0,1,offset,0])});
    }))),byPart=new Map(parts.map(part=>[part.p,part]));
    function point(x,y,p=parts[0].p){if(!Number.isFinite(x)||!Number.isFinite(y))return null;const part=byPart.get(p);if(!part)return null;const m=part.matrix;return {x:m[0]*x+m[4],y:m[3]*y+m[5]};}
    // Each copy has the same rectangular crop as its source panel.
    function footprint(p){return byPart.has(p)?[[[0,0],[width,0],[width,height],[0,height],[0,0]]]:[];}
    function partAt(fx,fy){if(fx<0||fy<0||fx>=displayWidth||fy>=displayHeight)return null;const copy=fy>=height?1:0,tx=copy&&!localCopies?displayWidth-fx:fx,panel=lattice===2?(tx<width?0:tx>=width+gap?1:-1):lattice;if(diamond&&panel<0)return null;return byPart.get(diamond?copy*2+panel:copy)||null;}
    function forward(c,r,copy=0){
      if(!Number.isInteger(c)||!Number.isInteger(r)||c<origin||c>=origin+width||r<0||r>=height||(copy!==0&&copy!==1))return null;
      const sourceParity=(c-anchor-r)&1;if(diamond&&lattice!==2&&lattice!==sourceParity)return null;
      const offset=lattice===2&&sourceParity===1?width+gap:0,tx=c-origin+offset,x=copy?(localCopies?offset+width-1-(c-origin):displayWidth-1-tx):tx,y=copy?displayHeight-1-r:r;
      return {x,y,c,r,p:diamond?copy*2+sourceParity:copy,copy,sourceParity,q:r*fieldWidth+c,displayQ:y*displayWidth+x};
    }
    function inverse(x,y){
      if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=displayWidth||y<0||y>=displayHeight)return null;
      const copy=y>=height?1:0,tx=copy&&!localCopies?displayWidth-1-x:x,r=copy?displayHeight-1-y:y,offset=lattice===2&&tx>=width+gap?width+gap:0,c=origin+(copy&&localCopies?width-1-(tx-offset):tx-offset);
      if(tx>=width&&tx<width+gap)return null;const cell=forward(c,r,copy);return cell&&cell.x===x?cell:null;
    }
    // Numeric address avoids allocating a cell object for every raster pixel.
    function hitIndex(fx,fy){
      if(!Number.isFinite(fx)||!Number.isFinite(fy)||fx<0||fy<0||fx>=displayWidth||fy>=displayHeight)return -1;
      const copy=fy>=height?1:0,tx=copy&&!localCopies?displayWidth-fx:fx,ty=copy?displayHeight-fy:fy;
      if(!diamond){const x=Math.floor(fx),y=Math.floor(fy);return y*displayWidth+x;}
      const panel=lattice===2?(tx<width?0:tx>=width+gap?1:-1):lattice;if(panel<0)return -1;
      const offset=lattice===2&&panel===1?width+gap:0,x=(copy&&localCopies?width-(tx-offset):tx-offset)-.5-displayAnchor-panel,y=ty-.5,i=Math.round((x+y)/2),j=Math.round((x-y)/2),c=i+j+displayAnchor+panel,r=i-j;
      if(c<0||c>=width||r<0||r>=height)return -1;
      const dx=copy?(localCopies?offset+width-1-c:displayWidth-1-(c+offset)):c+offset,dy=copy?displayHeight-1-r:r;return dy*displayWidth+dx;
    }
    function hit(x,y){const q=hitIndex(x,y);return q<0?null:fromDisplay(q);}
    function fromSource(q,copy=0){return Number.isSafeInteger(q)&&q>=0?forward(q%fieldWidth,Math.floor(q/fieldWidth),copy):null;}
    function fromSourceAll(q){const first=fromSource(q);return first?[first,fromSource(q,1)]:[];}
    function fromDisplay(q){return Number.isSafeInteger(q)&&q>=0?inverse(q%displayWidth,Math.floor(q/displayWidth)):null;}
    function snapshot({val,allowed}){
      if(!val||val.length<fieldWidth*height)throw new RangeError('Joined bitmap source field is incomplete');const values=new Int8Array(displayWidth*displayHeight).fill(-1);
      for(let r=0;r<height;r++)for(let c=origin;c<origin+width;c++){const q=r*fieldWidth+c,v=val[q];if(v!==-1&&v!==0&&v!==1)throw new RangeError('Invalid joined bitmap bit');if(v<0||allowed&&!allowed(r,c,(c-anchor-r)&1,q))continue;for(const cell of fromSourceAll(q))values[cell.displayQ]=v;}
      return {width:displayWidth,height:displayHeight,anchor:displayAnchor,val:values,parities:[0,1],halves:1,topology:diamond?'diamond':'square',wholeSource:true,mapping:config};
    }
    return Object.freeze({width:displayWidth,height:displayHeight,anchor:displayAnchor,sourceWidth:width,sourceHeight:height,reflection,config,parts,point,footprint,partAt,forward,inverse,hit,hitIndex,fromSource,fromSourceAll,fromDisplay,snapshot});
  }
  // Muted blue / warm charcoal; packed RGBA, shared by CPU, GPU and viewport.
  const backgrounds=Object.freeze([0xff211a15,0xff181a22]);
  function paintContours(ctx,{geometry,read,x=0,y=0,scale,screenWidth,screenHeight,mode='single',colour='#ffe969',colours=['#ffffff','#000000']}){
    if(!(scale>0))return 0;
    const square=geometry.config.wholeSource&&geometry.config.topology!=='diamond',step=Math.max(1,Math.ceil(1/scale)),left=Math.max(0,Math.floor(-x/scale)-2),right=Math.min(geometry.width,Math.ceil((screenWidth-x)/scale)+2),top=Math.max(0,Math.floor(-y/scale)-2),bottom=Math.min(geometry.height,Math.ceil((screenHeight-y)/scale)+2);
    let count=0;ctx.save();ctx.beginPath();ctx.rect(0,0,screenWidth,screenHeight);ctx.clip();ctx.lineWidth=1;
    for(let r=top;r<bottom;r+=step)for(let col=left;col<right;col+=step){const c=step>1&&!geometry.config.wholeSource?col+((col-geometry.anchor-r)&1):col;const cell=geometry.inverse(c,r);if(!cell)continue;const a=read(c,r);if(a<0)continue;
      ctx.save();if(geometry.config.wholeSource){const m=geometry.parts.find(part=>part.p===cell.p).matrix;ctx.beginPath();ctx.rect(x+Math.min(m[4],m[0]*geometry.sourceWidth+m[4])*scale,y+Math.min(m[5],m[3]*geometry.sourceHeight+m[5])*scale,geometry.sourceWidth*scale,geometry.sourceHeight*scale);ctx.clip();}if(mode!=='single'){ctx.beginPath();if(square)ctx.rect(x+c*scale,y+r*scale,scale,scale);else{ctx.moveTo(x+(c+.5)*scale,y+(r-.5)*scale);ctx.lineTo(x+(c+1.5)*scale,y+(r+.5)*scale);ctx.lineTo(x+(c+.5)*scale,y+(r+1.5)*scale);ctx.lineTo(x+(c-.5)*scale,y+(r+.5)*scale);ctx.closePath();}ctx.clip();ctx.lineWidth=2;}
      const edges=square?[[-1,0,[-.5,.5],[-.5,-.5]],[0,-1,[-.5,-.5],[.5,-.5]],[1,0,[.5,-.5],[.5,.5]],[0,1,[.5,.5],[-.5,.5]]]:[[-1,-1,[-1,0],[0,-1]],[1,-1,[0,-1],[1,0]],[1,1,[1,0],[0,1]],[-1,1,[0,1],[-1,0]]];
      for(const [dc,dr,p,q]of edges){const b=read(c+dc,r+dr),on=mode==='single'?a!==b:mode==='same'?b===a||b<0:true;if(!on)continue;
        ctx.strokeStyle=mode==='single'?colour:colours[mode==='directional'?((square?dc===0:dc===dr)?1:0):a];ctx.beginPath();ctx.moveTo(x+(c+.5+p[0])*scale,y+(r+.5+p[1])*scale);ctx.lineTo(x+(c+.5+q[0])*scale,y+(r+.5+q[1])*scale);ctx.stroke();count++;
      }
      ctx.restore();
    }ctx.restore();return count;
  }
  return {create,backgrounds,paintContours};
});
