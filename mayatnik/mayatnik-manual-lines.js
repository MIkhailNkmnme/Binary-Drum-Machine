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
 return {clip,segment,hit,controlAnchor,controlLayout,dragPosition,positionLabel,label,mirrorButtons,toggleMirror};
});
