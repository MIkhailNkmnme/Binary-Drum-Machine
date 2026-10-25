/* Shared square/ring cell geometry. Positions use cell units; painting uses CSS pixels. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ZZGridShapes=api;})(globalThis,function(){
 'use strict';const TAU=2*Math.PI;
 const supported=g=>g?.cell==='square'||g?.cell==='ring';
 const floor=n=>{const k=Math.round(n);return Math.floor(Math.abs(n-k)<=32*Number.EPSILON*Math.max(1,Math.abs(n))?k:n);};
 const offset=(g,r)=>(g.hs?.[r]||0)/2;
 const valid=(rows,r,c)=>Number.isInteger(r)&&Number.isInteger(c)&&r>=0&&r<rows.length&&c>=0&&c<rows[r].length;
 const angleOf=(x,y)=>{let a=(Math.atan2(y,x)+Math.PI/2)%TAU;if(a<0)a+=TAU;return a;};
 const polar=(radius,angle)=>[radius*Math.cos(angle),radius*Math.sin(angle)];
 function center(r,c,g){
  const n=g.rows?.[r]?.length;if(!supported(g)||!n||!valid(g.rows,r,c))return null;
  return g.cell==='square'?[offset(g,r)+c+.5,r+.5]:polar(r+.5,-Math.PI/2+TAU*(c+.5)/n);
 }
 function polygon(r,c,g){
  const rows=g.rows||[];if(!supported(g)||!valid(rows,r,c)||!(g.tw>0))return [];
  let points;
  if(g.cell==='square'){const x=offset(g,r)+c;points=[[x,r],[x+1,r],[x+1,r+1],[x,r+1]];}
  else{
   const n=rows[r].length,a=-Math.PI/2+TAU*c/n,b=-Math.PI/2+TAU*(c+1)/n;
   // Shared circular boundaries use the same subdivision on both adjacent rings.
   const countFor=radius=>{const step=Math.min(Math.PI/12,2*Math.acos(Math.max(-1,1-.25/Math.max(1,radius*g.tw))));return Math.max(1,Math.min(256,Math.ceil((b-a)/step)));};
   const outer=countFor(r+1);points=[];for(let i=0;i<=outer;i++)points.push(polar(r+1,a+(b-a)*i/outer));
   if(r===0)points.push([0,0]);else{const inner=countFor(r);for(let i=inner;i>=0;i--)points.push(polar(r,a+(b-a)*i/inner));}
  }
  return points.map(([x,y])=>[(g.ox||0)+x*g.tw,(g.oy||0)+y*g.tw]);
 }
 function hit(rows,g,x,y,clamp=false){
  if(!supported(g)||!rows.length||!(g.tw>0)||!Number.isFinite(x)||!Number.isFinite(y))return null;
  const px=(x-(g.ox||0))/g.tw,py=(y-(g.oy||0))/g.tw;
  let r=floor(g.cell==='ring'?Math.hypot(px,py):py);
  if(clamp)r=Math.max(0,Math.min(rows.length-1,r));
  if(r<0||r>=rows.length||!rows[r].length)return null;
  let c=g.cell==='ring'?(px===0&&py===0?0:floor(angleOf(px,py)/TAU*rows[r].length)%rows[r].length):floor(px-offset(g,r));
  if(clamp)c=Math.max(0,Math.min(rows[r].length-1,c));
  return valid(rows,r,c)?[r,c]:null;
 }
 function snapVertex(rows,g,p){
  if(!supported(g)||!rows.length||!p?.every(Number.isFinite))return null;
  let best=null,distance=Infinity;
  const offer=q=>{const d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<distance){distance=d;best=q;}};
  if(g.cell==='square'){
   for(let r=0;r<rows.length;r++){
    if(!rows[r].length)continue;const x=offset(g,r),c=Math.max(0,Math.min(rows[r].length,Math.round(p[0]-x)));
    offer([x+c,r]);offer([x+c,r+1]);
   }
  }else{
   const a=angleOf(...p);
   for(let r=0;r<rows.length;r++){
    const n=rows[r].length;if(!n)continue;const c=Math.round(a/TAU*n),angle=-Math.PI/2+TAU*c/n;
    offer(polar(r,angle));offer(polar(r+1,angle));
   }
  }
  return best;
 }
 function neighbors(rows,g,r,c){
  if(!supported(g)||!valid(rows,r,c))return [];
  const result=[],seen=new Set(),add=(rr,cc)=>{if(!valid(rows,rr,cc)||(rr===r&&cc===c))return;const k=rr+','+cc;if(!seen.has(k)){seen.add(k);result.push([rr,cc]);}};
  const n=rows[r].length;
  if(g.cell==='ring'){
   add(r,(c+n-1)%n);add(r,(c+1)%n);
   for(const rr of [r-1,r+1]){const m=rows[rr]?.length;if(!m)continue;
    // Compare integer cross-products: touching at one angle is not an edge.
    for(let cc=Math.floor(c*m/n);cc<Math.ceil((c+1)*m/n);cc++)if(cc*n<(c+1)*m&&(cc+1)*n>c*m)add(rr,cc);
   }
  }else{
   add(r,c-1);add(r,c+1);const x=offset(g,r)+c;
   for(const rr of [r-1,r+1]){if(!rows[rr]?.length)continue;const o=offset(g,rr);
    for(let cc=Math.max(0,Math.floor(x-o));cc<Math.min(rows[rr].length,Math.ceil(x+1-o));cc++)if(o+cc<x+1&&o+cc+1>x)add(rr,cc);
   }
  }
  return result;
 }
 function bounds(rows,g){
  if(!rows.length)return {minX:0,minY:0,maxX:0,maxY:0};
  if(g.cell==='ring'){const radius=rows.length;return {minX:-radius,minY:-radius,maxX:radius,maxY:radius};}
  let left=Infinity,right=-Infinity;for(let r=0;r<rows.length;r++){if(!rows[r].length)continue;left=Math.min(left,offset(g,r));right=Math.max(right,offset(g,r)+rows[r].length);}
  return {minX:Number.isFinite(left)?left:0,minY:0,maxX:Number.isFinite(right)?right:0,maxY:rows.length};
 }
 return {supported,polygon,center,hit,snapVertex,bounds,neighbors};
});
