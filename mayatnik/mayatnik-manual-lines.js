/* Screen geometry shared by manual-axis controls and pointer picking.
   Field positions stay in cells; every public rectangle/segment is in CSS px. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikManualLines=api;})(globalThis,function(){
 'use strict';
 const EPS=1e-8,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const validRect=r=>r&&[r.left,r.top,r.right,r.bottom].every(Number.isFinite)&&r.right>=r.left&&r.bottom>=r.top;
 const validSegment=s=>Array.isArray(s)&&s.length===4&&s.every(Number.isFinite);
 function clip(segment,rect){
  if(!validSegment(segment)||!validRect(rect))return null;
  const [x,y,x2,y2]=segment,dx=x2-x,dy=y2-y;let lo=0,hi=1;
  for(const [p,q]of [[-dx,x-rect.left],[dx,rect.right-x],[-dy,y-rect.top],[dy,rect.bottom-y]]){
   if(Math.abs(p)<EPS){if(q<0)return null;continue;}
   const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;
  }
  return [x+lo*dx,y+lo*dy,x+hi*dx,y+hi*dy];
 }
 function segment(axis,g,viewport){
  if(!axis||axis.visible===false||!['h','v','d','e'].includes(axis.kind)||!Number.isFinite(axis.p)||
   !g||![g.left,g.top,g.scale,g.anchor,g.width,g.height].every(Number.isFinite)||g.scale<=0)return null;
  const {left:x,top:y,scale:s,anchor:a,width:w,height:h}=g,p=axis.p;let line;
  if(axis.kind==='h')line=[x,y+p*s,x+w*s,y+p*s];
  else if(axis.kind==='v')line=[x+(a+.5+p)*s,y,x+(a+.5+p)*s,y+h*s];
  else{const sign=axis.kind==='d'?1:-1,start=a+.5+p-sign*.5;line=[x+start*s,y,x+(start+sign*h)*s,y+h*s];}
  return viewport?clip(line,viewport):line;
 }
 function nearestPoint(segment,x,y){
  const [ax,ay,bx,by]=segment,dx=bx-ax,dy=by-ay,n=dx*dx+dy*dy,t=n?clamp(((x-ax)*dx+(y-ay)*dy)/n,0,1):0;
  const px=ax+t*dx,py=ay+t*dy;return {x:px,y:py,t,distance:Math.hypot(x-px,y-py)};
 }
 // Reverse traversal matches painted stacking order. A preferred axis only
 // wins an exact geometric tie, never a visibly nearer neighbouring axis.
 function hit(axes,x,y,{radius=6,preferredId=null}={}){
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(radius)||radius<0)return null;
  let best=null;
  for(let i=axes.length-1;i>=0;i--){const axis=axes[i];if(axis.visible===false||!validSegment(axis.segment))continue;
   const point=nearestPoint(axis.segment,x,y);if(point.distance>radius)continue;
   if(!best||point.distance<best.distance-EPS||Math.abs(point.distance-best.distance)<EPS&&axis.id===preferredId&&best.id!==preferredId)
    best={id:axis.id,kind:axis.kind,...point};
  }
  return best;
 }
 // The target is relative to the visible viewport, never to the first bit.
 // The safe rectangle accounts for the actual control dimensions. A tiny
 // corner segment may not fit a whole panel on the line: return its attachment
 // point separately, so the host can retain an explicit visible association.
 function controlAnchor(line,viewport,size,kind,fraction=.4){
  const visible=clip(line,viewport);if(!visible||!size||![size.width,size.height].every(Number.isFinite)||size.width<0||size.height<0)return null;
  const margin=Number.isFinite(size.margin)?Math.max(0,size.margin):2;
  const hx=size.width/2+margin,hy=size.height/2+margin;
  const safe={left:viewport.left+hx,right:viewport.right-hx,top:viewport.top+hy,bottom:viewport.bottom-hy};
  const fitted=clip(visible,safe),s=fitted||visible,t=clamp(Number.isFinite(fraction)?fraction:.4,0,1),horizontal=kind==='h';
  const target=horizontal?viewport.left+(viewport.right-viewport.left)*t:viewport.top+(viewport.bottom-viewport.top)*t;
  const start=horizontal?s[0]:s[1],end=horizontal?s[2]:s[3],u=Math.abs(end-start)>EPS?clamp((target-start)/(end-start),0,1):.5;
  const onLineX=s[0]+(s[2]-s[0])*u,onLineY=s[1]+(s[3]-s[1])*u;
  const x=safe.left<=safe.right?clamp(onLineX,safe.left,safe.right):(viewport.left+viewport.right)/2;
  const y=safe.top<=safe.bottom?clamp(onLineY,safe.top,safe.bottom):(viewport.top+viewport.bottom)/2;
  return {x,y,onLineX,onLineY,detached:Math.hypot(x-onLineX,y-onLineY)>EPS};
 }
 function dragPosition(kind,position,dx,dy,scale,rows=Infinity){
  if(![position,dx,dy,scale].every(Number.isFinite)||scale<=0)return position;
  const delta=kind==='h'?dy:kind==='v'?dx:kind==='d'?dx-dy:kind==='e'?dx+dy:0;
  const next=Math.round((position+delta/scale)*2)/2;
  return kind==='h'?clamp(next,0,Math.max(0,rows)):next;
 }
 const SELECTED_COLOUR='#ffe14d';
 function keyPosition(kind,position,key,shift=false,rows=Infinity){
  const directions={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]},direction=directions[key];
  if(!direction||!Number.isFinite(position)||!['h','v','d','e'].includes(kind))return null;
  const [x,y]=direction,delta=kind==='h'?y:kind==='v'?x:kind==='d'?x-y:x+y;if(!delta)return null;
  const next=position+delta*(shift?1:.5);
  return kind==='h'&&(next<0||next>rows)?position:next;
 }
 // Resolve colliding panels by moving along their own visible line. The field
 // position is never changed. Exact free intervals avoid zoom-dependent jitter.
 function controlLayout(items,viewport,gap=2){
  const placed=[];
  for(const item of items){
   const a=controlAnchor(item.segment,viewport,item.size,item.kind,item.fraction),size=item.size;if(!a){placed.push({id:item.id,hidden:true});continue;}
   const margin=Number.isFinite(size.margin)?Math.max(0,size.margin):2,hx=size.width/2,hy=size.height/2;
   const safe={left:viewport.left+hx+margin,right:viewport.right-hx-margin,top:viewport.top+hy+margin,bottom:viewport.bottom-hy-margin};
   const line=clip(item.segment,safe)||clip(item.segment.map((v,i)=>v+(i%2?a.y-a.onLineY:a.x-a.onLineX)),safe);
   let result=a,overlap=false;
   if(line){
    const desired=nearestPoint(line,a.x,a.y).t;let free=[[0,1]];
    for(const old of placed){if(old.hidden)continue;
     const blocked=clip(line,{left:old.rect.left-hx-gap,right:old.rect.right+hx+gap,top:old.rect.top-hy-gap,bottom:old.rect.bottom+hy+gap});if(!blocked)continue;
     const t1=nearestPoint(line,blocked[0],blocked[1]).t,t2=nearestPoint(line,blocked[2],blocked[3]).t,lo=Math.min(t1,t2),hi=Math.max(t1,t2);
     free=free.flatMap(([from,to])=>hi<from||lo>to?[[from,to]]:[...(lo>from?[[from,Math.max(from,lo-EPS)]]:[]),...(hi<to?[[Math.min(to,hi+EPS),to]]:[])]);
    }
    if(free.length){let t=clamp(desired,...free[0]);for(const range of free){const candidate=clamp(desired,...range);if(Math.abs(candidate-desired)<Math.abs(t-desired)-EPS)t=candidate;}
     const x=line[0]+(line[2]-line[0])*t,y=line[1]+(line[3]-line[1])*t,attach=nearestPoint(item.segment,x,y);result={x,y,onLineX:attach.x,onLineY:attach.y,detached:attach.distance>EPS};
    }else overlap=true;
   }
   const collides=(x,y)=>placed.some(old=>!old.hidden&&x+hx+gap>old.rect.left+EPS&&x-hx-gap<old.rect.right-EPS&&y+hy+gap>old.rect.top+EPS&&y-hy-gap<old.rect.bottom-EPS);
   if((overlap||collides(result.x,result.y))&&safe.left<=safe.right&&safe.top<=safe.bottom){
    // Narrow screens cannot fit two coincident horizontal panels on one line.
    // Keep both controls reachable and expose their attachment with a leader.
    const xs=[a.x,safe.left,safe.right],ys=[a.y,safe.top,safe.bottom];
    for(const old of placed)if(!old.hidden){xs.push(old.rect.left-hx-gap,old.rect.right+hx+gap);ys.push(old.rect.top-hy-gap,old.rect.bottom+hy+gap);}
    let best=null;
    for(const x of xs)for(const y of ys){if(x<safe.left||x>safe.right||y<safe.top||y>safe.bottom||collides(x,y))continue;const distance=(x-a.x)**2+(y-a.y)**2;if(!best||distance<best.distance)best={x,y,distance};}
    overlap=!best;
    if(best){const attach=nearestPoint(item.segment,best.x,best.y);result={x:best.x,y:best.y,onLineX:attach.x,onLineY:attach.y,detached:attach.distance>EPS};}
   }
   placed.push({id:item.id,...result,overlap,rect:{left:result.x-hx,right:result.x+hx,top:result.y-hy,bottom:result.y+hy}});
  }
  return placed;
 }
 const signed=n=>((n>0?'+':'')+String(n).replace('.5','½')).replace(/^([+-]?)0½$/,'$1½');
 function positionLabel(kind,p,anchor=0,rows=Infinity){
  if(!Number.isFinite(p))return '';
  if(kind==='h')return p%1?'строка '+(Math.floor(p)+1):p===0?'перед 1':p===rows?'после '+rows:'между '+p+'/'+(p+1);
  if(kind==='v'){const c=anchor+p;return (c%1?'между '+(Math.floor(c)+1)+'/'+(Math.floor(c)+2):'столбец '+(c+1))+' · '+signed(p);}
  return (kind==='d'?'╲':'╱')+' · Δ'+signed(p);
 }
 function label(axis,anchor=0,rows=Infinity){return ({h:'Г',v:'В',d:'Д',e:'Д'}[axis.kind]||'')+axis.number+' · '+positionLabel(axis.kind,axis.p,anchor,rows);}
 function mirrorButtons(kind,p){
  const defs={h:[['↓','вниз'],['↑','вверх']],v:[['→','вправо'],['←','влево']],d:[['↙','вниз-влево'],['↗','вверх-вправо']],e:[['↖','вверх-влево'],['↘','вниз-вправо']]};
  return (defs[kind]||[]).map(([symbol,direction],i)=>({mode:i+1,symbol,direction,disabled:(kind==='d'||kind==='e')&&p%1!==0}));
 }
 const toggleMirror=(current,requested)=>requested===1||requested===2?current===requested?0:requested:current;
 // Paint switches are independent: bit 1 uses flag 1, bit 0 uses flag 2.
 const paintMask=value=>Number.isInteger(value)&&value>=0&&value<=3?value:0;
 const togglePaint=(current,bit)=>bit===0||bit===1?paintMask(current)^(bit===1?1:2):paintMask(current);
 const mirrorOperation=value=>value==='xor'||value==='and'?value:'';
 const toggleOperation=(current,requested)=>requested==='xor'||requested==='and'?mirrorOperation(current)===requested?'':requested:mirrorOperation(current);
 // A line through cell centres selects one row/column/diagonal. Half-cell
 // positions select both neighbours symmetrically; field edges clip one side.
 // Iterate only the line length, never the whole field for each manual axis.
 function paintCells(axis,{width,height,anchor=0},visit){
  if(!axis||axis.visible===false||!['h','v','d','e'].includes(axis.kind)||!Number.isFinite(axis.p)||
   !Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0||!Number.isFinite(anchor))return;
  const add=(c,r)=>{if(c>=0&&c<width&&r>=0&&r<height)visit(c,r);};
  const neighbours=(position,put)=>{const lo=Math.floor(position),hi=Math.ceil(position);put(lo);if(hi!==lo)put(hi);};
  if(axis.kind==='h')neighbours(axis.p-.5,r=>{for(let c=0;c<width;c++)add(c,r);});
  else if(axis.kind==='v')neighbours(anchor+axis.p,c=>{for(let r=0;r<height;r++)add(c,r);});
  else {const sign=axis.kind==='d'?1:-1;for(let r=0;r<height;r++)neighbours(anchor+axis.p+sign*r,c=>add(c,r));}
 }
 function paint(px,{axes,width,height,anchor=0,bitAt,colour,blocked}){
  if(!px||px.length!==width*height||typeof bitAt!=='function'||!Number.isInteger(colour))return 0;
  const cells=new Map();
  for(const axis of axes||[]){const mask=paintMask(axis.paint);if(!mask)continue;
   paintCells(axis,{width,height,anchor},(c,r)=>{const q=r*width+c;cells.set(q,(cells.get(q)||0)|mask);});}
  let count=0;
  // Determine every bit before changing pixels: intersecting axes must never
  // classify another axis's paint colour as an original zero or one.
  const selected=[];
  for(const [q,mask]of cells){if(blocked?.(q))continue;const bit=bitAt(q%width,Math.floor(q/width),q);if(bit===1&&(mask&1)||bit===0&&(mask&2))selected.push(q);}
  for(const q of selected){px[q]=colour;count++;}return count;
 }
 // Projected/rhombus rendering supplies the current visible cell centre for
 // each raster pixel. Mirrored cells use their reflected centre; all pixels of
 // that cell share the selection, so painting never becomes a stripe overlay.
 function paintRaster(px,{width,height,axes,anchor=0,cellAt,bits,colour}){
  const active=(axes||[]).filter(a=>a.visible!==false&&paintMask(a.paint)&&Number.isFinite(a.p));
  if(!active.length||!px||px.length!==width*height||!bits||bits.length!==px.length||typeof cellAt!=='function')return 0;
  let lastX=NaN,lastY=NaN,mask=0,count=0;
  for(let q=0;q<px.length;q++){
   const bit=bits[q];if(bit!==0&&bit!==1)continue;
   const point=cellAt(q%width,Math.floor(q/width),q);if(!point)continue;
   if(point.x!==lastX||point.y!==lastY){lastX=point.x;lastY=point.y;mask=0;
    for(const a of active){const x=point.x-anchor-.5,y=point.y-.5,distance=a.kind==='h'?point.y-a.p:a.kind==='v'?x-a.p:a.kind==='d'?x-y-a.p:a.kind==='e'?x+y-a.p:Infinity;
     if(Math.abs(distance)<=.5+EPS)mask|=paintMask(a.paint);}
   }
   if(mask&(bit===1?1:2)){px[q]=colour;count++;}
  }
  return count;
 }
 // GPU picture-pass protocol: kind 6, colour, reserved, count, reserved*4;
 // then up to 14 [axis kind, doubled cell position, paint flags, reserved].
 function paintPasses(axes,colour){
  const active=(axes||[]).filter(a=>a.visible!==false&&paintMask(a.paint)&&['h','v','d','e'].includes(a.kind)&&Number.isFinite(a.p)),passes=[];
  for(let start=0;start<active.length;start+=14){const chunk=active.slice(start,start+14),pass=new Int32Array(64);pass[0]=6;pass[1]=colour|0;pass[3]=chunk.length;
   chunk.forEach((a,i)=>pass.set([{h:1,v:2,d:3,e:4}[a.kind],Math.round(a.p*2),paintMask(a.paint),0],8+i*4));passes.push(pass);}
  return passes;
 }
 return {clip,segment,hit,controlAnchor,controlLayout,dragPosition,keyPosition,SELECTED_COLOUR,positionLabel,label,mirrorButtons,toggleMirror,paintMask,togglePaint,mirrorOperation,toggleOperation,paintCells,paint,paintRaster,paintPasses};
});
