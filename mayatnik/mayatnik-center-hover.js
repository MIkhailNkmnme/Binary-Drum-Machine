/* Screen-space highlight of the meeting point and its incident axes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikCenterHover=api;})(globalThis,function(){
  'use strict';
  const RADIUS=50, HIT=8;
  function nearest(points,x,y){let best=null,d=HIT;for(const p of points){const q=Math.hypot(p[0]-x,p[1]-y);if(q<=d){d=q;best=p;}}return best;}
  function incident(lines,center,radius=RADIUS){
    const out=[];
    for(const l of lines){const dx=l.b[0]-l.a[0],dy=l.b[1]-l.a[1],len=Math.hypot(dx,dy);if(!len)continue;
      const ux=dx/len,uy=dy/len,px=center[0]-l.a[0],py=center[1]-l.a[1],t=px*ux+py*uy,off=px*uy-py*ux;
      if(Math.abs(off)>.75||t<-.75||t>len+.75)continue;
      const reach=Math.sqrt(Math.max(0,radius*radius-off*off)),lo=Math.max(0,t-reach),hi=Math.min(len,t+reach);
      if(hi>lo)out.push({a:[l.a[0]+ux*lo,l.a[1]+uy*lo],b:[l.a[0]+ux*hi,l.a[1]+uy*hi],normal:[-uy,ux]});
    }return out;
  }
  function mount(host){
    const ns='http://www.w3.org/2000/svg',make=n=>document.createElementNS(ns,n),root=document.createElement('div'),svg=make('svg'),defs=make('defs'),clip=make('clipPath'),circle=make('circle'),group=make('g'),path=make('path'),dot=make('circle');
    root.id='mayCenterHover';root.setAttribute('aria-hidden','true');Object.assign(root.style,{position:'fixed',pointerEvents:'none',overflow:'hidden',zIndex:'5',display:'none'});
    clip.id='mayCenterHoverClip';circle.setAttribute('r',RADIUS);clip.append(circle);defs.append(clip);group.setAttribute('clip-path','url(#mayCenterHoverClip)');
    path.setAttribute('fill','none');path.setAttribute('stroke','#d8c2ff');path.setAttribute('stroke-width','1');dot.setAttribute('r','4');dot.setAttribute('fill','#fff');dot.setAttribute('stroke','#b48cff');dot.setAttribute('stroke-width','2');
    group.append(path,dot);svg.append(defs,group);root.append(svg);document.body.append(root);
    let data=null,pointer=null,raf=0;
    const paint=()=>{raf=0;const p=data&&pointer?nearest(data.centers,pointer[0]-data.left,pointer[1]-data.top):null;
      root.style.display=p?'':'none';if(!p)return;
      Object.assign(root.style,{left:data.left+'px',top:data.top+'px',width:data.width+'px',height:data.height+'px'});svg.setAttribute('width',data.width);svg.setAttribute('height',data.height);
      for(const c of [circle,dot]){c.setAttribute('cx',p[0]);c.setAttribute('cy',p[1]);}
      const d=[];for(const l of incident(data.lines,p))for(const side of [-2,2]){const n=l.normal.map(v=>v*side);d.push(`M${l.a[0]+n[0]},${l.a[1]+n[1]}L${l.b[0]+n[0]},${l.b[1]+n[1]}`);}path.setAttribute('d',d.join(''));
    };
    const queue=()=>{if(!raf)raf=requestAnimationFrame(paint);};
    host.addEventListener('pointermove',e=>{pointer=e.pointerType==='touch'?null:[e.clientX,e.clientY];queue();},{passive:true,capture:true});
    host.addEventListener('pointerleave',()=>{pointer=null;queue();});host.addEventListener('pointercancel',()=>{pointer=null;queue();});
    addEventListener('blur',()=>{pointer=null;queue();});
    return {update(value){data=value;queue();}};
  }
  return {RADIUS,HIT,nearest,incident,mount};
});
