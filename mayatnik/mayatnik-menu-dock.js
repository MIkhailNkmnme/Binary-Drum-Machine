/* Four menu strips: only discrete button-shaped landing places. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikMenuDock=api;})(globalThis,function(){
  'use strict';
  const WIDTH=120,HEIGHT=24,DX=126,DY=26;
  const overlap=(a,b)=>a.x<b.x+b.w+2&&a.x+a.w+2>b.x&&a.y<b.y+b.h+2&&a.y+a.h+2>b.y;
  function slots({left=8,right,topX,topY,bottomY,sideY}){
    const out=[];
    for(const [edge,y,x0] of [['top',topY,topX],['bottom',bottomY,left]])
      for(let i=0,x=x0;x+WIDTH<=right;i++,x=x0+i*DX)out.push({edge,index:i,x,y,w:WIDTH,h:HEIGHT});
    for(const [edge,x] of [['left',left],['right',right-WIDTH]])
      for(let i=0,y=sideY;y+HEIGHT+2<=bottomY;i++,y=sideY+i*DY)out.push({edge,index:i,x,y,w:WIDTH,h:HEIGHT});
    return out;
  }
  function nearest(list,x,y,preferred){let best=null,score=Infinity;for(const p of list){const d=Math.hypot(p.x+WIDTH/2-x,p.y+HEIGHT/2-y)+(preferred&&p.edge!==preferred?1e5:0);if(d<score){score=d;best=p;}}return best;}
  function read(value){const result={};if(!value||typeof value!=='object'||Array.isArray(value))return result;
    for(const [key,p] of Object.entries(value))if(p&&['top','bottom','left','right'].includes(p.edge)&&Number.isInteger(p.index)&&p.index>=0)result[key]={edge:p.edge,index:p.index};return result;}
  function mount({groups,idOf,header,tools,footer,rail,rightEdge,moveToTools,onLayout,excluded=[]}){
    const key='mayatnik-menu-dock-v509';let state={};try{state=read(JSON.parse(localStorage.getItem(key)||'{}'));}catch(_){}
    const heads=new Map(),placed=new Map();let drag=null,geometry='',ready=false,gridSignature='',gridNodes=[],activeSlot=null;
    const ns='http://www.w3.org/2000/svg',overlay=document.createElementNS(ns,'svg');overlay.id='mayMenuDockGrid';overlay.setAttribute('aria-hidden','true');
    Object.assign(overlay.style,{position:'fixed',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'2147483644',display:'none'});document.body.append(overlay);
    const save=()=>{try{localStorage.setItem(key,JSON.stringify(state));}catch(_){}};
    const bounds=()=>{const H=header.getBoundingClientRect(),T=tools.getBoundingClientRect(),F=footer.getBoundingClientRect(),R=rail.getBoundingClientRect();
      return {left:Math.max(4,R.left),right:rightEdge()-4,topX:T.left,topY:T.top,bottomY:F.top+(F.height-HEIGHT)/2,sideY:Math.ceil(H.bottom+8)};};
    const rect=el=>{const r=el.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height};};
    const obstacles=()=>excluded.filter(e=>e?.getClientRects().length).map(rect);
    const available=skip=>slots(bounds()).filter(s=>!obstacles().some(r=>overlap(s,r))&&![...placed].some(([g,p])=>g!==skip&&overlap(s,p)));
    const apply=(g,p)=>{const hd=heads.get(g),w=hd.offsetWidth||WIDTH;g.classList.add('may-docked');g.classList.toggle('may-dock-bottom',p.edge==='bottom');g.dataset.dockEdge=p.edge;
      g.classList.toggle('pt-bot',p.edge==='bottom');g.style.bottom='';g.style.setProperty('--may-dock-x',(p.x+(WIDTH-w)/2)+'px');g.style.setProperty('--may-dock-y',p.y+'px');placed.set(g,p);};
    const layout=()=>{if(innerWidth<=600){for(const g of heads.keys())g.classList.remove('may-docked','may-dock-bottom');placed.clear();geometry='';onLayout();return;}
      const B=bounds(),signature=JSON.stringify(B)+'|'+[...heads.values()].map(h=>h.getClientRects().length?h.offsetWidth:0).join(',');if(drag||ready&&signature===geometry)return;geometry=signature;
      const previous=new Map(placed);placed.clear();
      for(const [g,hd] of heads){if(!hd.getClientRects().length)continue;const saved=state[idOf(g)],r=rect(hd),prior=previous.get(g),side=saved?.edge||prior?.edge||(g.parentElement===rail?'left':g.classList.contains('pt-bot')?'bottom':'top');
        const free=available(g),p=free.find(p=>p.edge===saved?.edge&&p.index===saved.index)||nearest(free,prior?prior.x+WIDTH/2:r.x+r.w/2,prior?prior.y+HEIGHT/2:r.y+r.h/2,side);
        if(!p)continue;moveToTools(g);apply(g,p);if(!saved)state[idOf(g)]={edge:p.edge,index:p.index};}
      ready=true;save();onLayout();};
    const show=(free,chosen)=>{const signature=free.map(p=>[p.edge,p.index,p.x,p.y].join(':')).join('|');overlay.style.display='';
      if(signature!==gridSignature){gridSignature=signature;overlay.replaceChildren();gridNodes=[];activeSlot=null;
        for(const p of free){const path=document.createElementNS(ns,'path');path.setAttribute('d',`M${p.x+12} ${p.y}H${p.x+108}L${p.x+120} ${p.y+12}L${p.x+108} ${p.y+24}H${p.x+12}L${p.x} ${p.y+12}Z`);path.setAttribute('fill','none');path.setAttribute('stroke','#72839c');path.setAttribute('stroke-width','1');path.setAttribute('stroke-dasharray','3 3');overlay.append(path);gridNodes.push(path);}}
      const next=gridNodes[free.indexOf(chosen)]||null;if(next===activeSlot)return;
      if(activeSlot){activeSlot.setAttribute('fill','none');activeSlot.setAttribute('stroke','#72839c');activeSlot.setAttribute('stroke-width','1');}
      if(next){next.setAttribute('fill','#b48cff22');next.setAttribute('stroke','#e4d4ff');next.setAttribute('stroke-width','2');}activeSlot=next;};
    document.addEventListener('pointerdown',e=>{if(e.button!==0||innerWidth<=600)return;const hd=e.target.closest?.('.pt-l,.gz-head,#mayCorner'),g=[...heads].find(([,h])=>h===hd)?.[0];if(!g||e.target.closest('.pt-pin,.gz-pin'))return;
      e.stopImmediatePropagation();const r=rect(hd);drag={g,id:e.pointerId,x:e.clientX,y:e.clientY,ox:e.clientX-r.x,oy:e.clientY-r.y,w:r.w,on:false};},true);
    addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const d=drag;if(!d.on&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<6)return;
      e.preventDefault();if(!d.on)d.free=available(d.g);d.on=true;d.g.classList.add('may-dock-drag');const free=d.free,chosen=nearest(free,e.clientX-d.ox+d.w/2,e.clientY-d.oy+HEIGHT/2);d.chosen=chosen;
      const x=e.clientX-d.ox,y=e.clientY-d.oy,snapX=chosen?chosen.x+(WIDTH-d.w)/2:x,magnet=chosen&&Math.hypot(snapX-x,chosen.y-y)<32;
      d.g.style.setProperty('--may-dock-x',(magnet?snapX:x)+'px');d.g.style.setProperty('--may-dock-y',(magnet?chosen.y:y)+'px');show(free,chosen);}, {capture:true,passive:false});
    let swallow=false;addEventListener('click',e=>{if(swallow){e.preventDefault();e.stopImmediatePropagation();swallow=false;}},true);
    const end=(e,cancel=false)=>{if(!drag||e.pointerId!=null&&e.pointerId!==drag.id)return;const d=drag;drag=null;overlay.style.display='none';overlay.replaceChildren();gridSignature='';gridNodes=[];activeSlot=null;d.g.classList.remove('may-dock-drag');
      if(!d.on)return;swallow=e.type==='pointerup';setTimeout(()=>{swallow=false;},0);
      const p=!cancel&&d.chosen?d.chosen:placed.get(d.g);if(p){apply(d.g,p);if(!cancel){state[idOf(d.g)]={edge:p.edge,index:p.index};save();}}geometry='';layout();};
    addEventListener('pointerup',e=>end(e),true);addEventListener('pointercancel',e=>end(e,true),true);addEventListener('keydown',e=>{if(e.key==='Escape'&&drag){e.preventDefault();end(e,true);}},true);addEventListener('blur',e=>end(e,true));
    for(const g of groups()){const hd=g.querySelector(':scope > .pt-l,:scope > .gz-head')||(g.id==='mayCorner'?g:null);if(hd)heads.set(g,hd);}
    addEventListener('resize',layout);requestAnimationFrame(layout);
    return {refresh:layout};
  }
  return {WIDTH,HEIGHT,DX,DY,slots,nearest,overlap,read,mount};
});
