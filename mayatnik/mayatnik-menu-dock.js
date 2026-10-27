/* Four menu strips: only discrete button-shaped landing places. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikMenuDock=api;})(globalThis,function(){
  'use strict';
  const WIDTH=120,HEIGHT=24,DX=126,DY=26;
  const wheelRegions=[];
  const wheelMenu='#paintTools,#mayatnikRail,#mayatnikRailR,#mayBottomBar,#mayCorner,.may-menu-side-scroll,.may-rail-list,.gz-ladder,.may-hp-pop';
  const wheelGeometry=['#paintTools','#mayatnikRail','#mayatnikRailR','#mayBottomBar'].flatMap(root=>['.may-closed-back','.may-standard-contours polygon','.pt-g','.gz-group'].map(part=>root+' '+part)).concat('#mayBottomBar > *','.may-rail-list','.gz-ladder','.may-hp-pop').join(',');
  const fieldTarget=target=>target===document.body||target===document.documentElement||!!target?.closest?.('#wrap');
  function ownsWheel(e){
    if(e.target?.closest?.(wheelMenu))return true;
    if(!fieldTarget(e.target)||!Number.isFinite(e.clientX)||!Number.isFinite(e.clientY))return false;
    if(wheelRegions.some(hit=>hit(e)))return true;
    // Backings deliberately pass pointer hits through to the field. Their
    // visible geometry still belongs to the menu, including the 2px seams.
    for(const node of document.querySelectorAll?.(wheelGeometry)||[]){
      const r=node.getBoundingClientRect();if(!r.width||!r.height)continue;
      let left=r.left-3,right=r.right+3,top=r.top-1,bottom=r.bottom+1,visible=true,fixed=false;
      if(e.clientX<left||e.clientX>right||e.clientY<top||e.clientY>bottom)continue;
      for(let p=node;p&&p!==document.body;p=p.parentElement){
        const style=getComputedStyle(p);if(style.visibility==='hidden'||style.display==='none'){visible=false;break;}
        if(!fixed&&/auto|scroll|hidden|clip/.test(style.overflowY)){const b=p.getBoundingClientRect();top=Math.max(top,b.top);bottom=Math.min(bottom,b.bottom);}
        if(p.classList.contains('may-dock-side')){const b=p.getBoundingClientRect();top=Math.max(top,b.top+(parseFloat(style.getPropertyValue('--may-side-clip-top'))||0));bottom=Math.min(bottom,b.bottom-(parseFloat(style.getPropertyValue('--may-side-clip-bottom'))||0));}
        // Fixed popups escape the toolbar's own scrolling/overflow box.
        if(style.position==='fixed')fixed=true;
      }
      if(visible&&e.clientX>=left&&e.clientX<=right&&e.clientY>=top&&e.clientY<=bottom)return true;
    }
    return false;
  }
  function guardWheel(e){
    if(!ownsWheel(e))return false;
    // A DOM menu can live inside wrap too. Returning from its zoom handler
    // alone would still let the browser scroll wrap by default.
    for(let node=e.target;node&&node!==document.body&&node.id!=='wrap';node=node.parentElement){
      const style=getComputedStyle(node);
      if(node.scrollHeight>node.clientHeight+1&&/auto|scroll/.test(style.overflowY)||node.scrollWidth>node.clientWidth+1&&/auto|scroll/.test(style.overflowX))return true;
    }
    e.preventDefault();return true;
  }
  const overlap=(a,b)=>a.x<b.x+b.w+2&&a.x+a.w+2>b.x&&a.y<b.y+b.h+2&&a.y+a.h+2>b.y;
  function slots({left=8,right,topX,topY,bottomY,sideY,sideBottom=bottomY+HEIGHT}){
    const out=[];
    // The side columns own both lower corners, including their backdrops.
    for(const [edge,y,x0,end] of [['top',topY,topX,right],['bottom',bottomY,left+DX,right-DX]])
      for(let i=0,x=x0;x+WIDTH<=end;i++,x=x0+i*DX)out.push({edge,index:i,x,y,w:WIDTH,h:HEIGHT});
    for(const [edge,x] of [['left',left],['right',right-WIDTH]])
      for(let i=0,y=sideY;y+HEIGHT+2<=sideBottom;i++,y=sideY+i*DY)out.push({edge,index:i,x,y,w:WIDTH,h:HEIGHT});
    return out;
  }
  function nearest(list,x,y,preferred){let best=null,score=Infinity;for(const p of list){const d=Math.hypot(p.x+WIDTH/2-x,p.y+HEIGHT/2-y)+(preferred&&p.edge!==preferred?1e5:0);if(d<score){score=d;best=p;}}return best;}
  function read(value){const result={};if(!value||typeof value!=='object'||Array.isArray(value))return result;
    for(const [key,p] of Object.entries(value))if(p&&['top','bottom','left','right'].includes(p.edge)&&Number.isInteger(p.index)&&p.index>=0)result[key]={edge:p.edge,index:p.index};return result;}
  function stackPositions(items,start,end,scroll=0){
    let cursor=start,last=start;const rows=[...items].sort((a,b)=>a.index-b.index).map(item=>{const height=Math.max(HEIGHT,item.height),top=Math.max(item.y,cursor);cursor=top+Math.ceil((height+2)/DY)*DY;last=top+height+2;return {...item,top,height};});
    const maxScroll=Math.max(0,last-end),offset=Math.max(0,Math.min(maxScroll,scroll));
    return {rows:rows.map(row=>({...row,screenY:row.top-offset})),height:last-start,maxScroll,offset};
  }
  function mount({groups,idOf,header,tools,footer,rail,rightEdge,leftEdge,moveToTools,onLayout,excluded=[],storageKey,defaultEdge,stackSides=true}){
    const key=typeof storageKey==='string'&&storageKey.trim()?storageKey:'mayatnik-menu-dock-v509',initialEdge=['top','bottom','left','right'].includes(defaultEdge)?defaultEdge:null,useSideStack=stackSides!==false;
    let state={};try{state=read(JSON.parse(localStorage.getItem(key)||'{}'));}catch(_){}
    const heads=new Map(),placed=new Map();let drag=null,geometry='',ready=false,gridSignature='',gridNodes=[],activeSlot=null;
    const ns='http://www.w3.org/2000/svg',overlay=document.createElementNS(ns,'svg');overlay.id='mayMenuDockGrid';overlay.setAttribute('aria-hidden','true');
    Object.assign(overlay.style,{position:'fixed',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'2147483644',display:'none'});document.body.append(overlay);
    const save=()=>{try{localStorage.setItem(key,JSON.stringify(state));}catch(_){}};
    const bounds=()=>{const H=header.getBoundingClientRect(),T=tools.getBoundingClientRect(),F=footer.getBoundingClientRect(),R=rail.getBoundingClientRect(),customLeft=typeof leftEdge==='function'?leftEdge():null;
      return {left:Math.max(4,Number.isFinite(customLeft)?customLeft:R.left),right:rightEdge()-4,topX:T.left,topY:T.top,bottomY:F.top+(F.height-HEIGHT)/2,sideY:Math.ceil(H.bottom+8),sideBottom:(typeof innerHeight==='number'&&Number.isFinite(innerHeight)?innerHeight:F.bottom)-4};};
    const rect=el=>{const r=el.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height};};
    const obstacles=()=>excluded.filter(e=>e?.getClientRects().length).map(rect);
    const available=skip=>slots(bounds()).filter(s=>!obstacles().some(r=>overlap(s,r))&&![...placed].some(([g,p])=>g!==skip&&overlap(s,p)));
    const apply=(g,p)=>{const hd=heads.get(g),w=hd.offsetWidth||WIDTH;g.classList.add('may-docked');g.classList.toggle('may-dock-bottom',p.edge==='bottom');g.classList.toggle('may-dock-side',p.edge==='left'||p.edge==='right');g.dataset.dockEdge=p.edge;
      g.classList.toggle('pt-bot',p.edge==='bottom');g.style.bottom='';g.style.setProperty('--may-dock-x',(p.x+(WIDTH-w)/2)+'px');g.style.setProperty('--may-dock-y',p.y+'px');placed.set(g,p);};
    const sides={};let stackFrame=0;
    const queueStack=()=>{if(useSideStack&&!stackFrame)stackFrame=requestAnimationFrame(()=>{stackFrame=0;layoutSides();});};
    for(const edge of useSideStack?['left','right']:[]){
      const bar=document.createElement('div'),space=document.createElement('div');bar.className='may-menu-side-scroll';bar.dataset.edge=edge;bar.tabIndex=0;bar.setAttribute('role','region');bar.setAttribute('aria-label',edge==='left'?'Прокрутка левой колонки меню':'Прокрутка правой колонки меню');bar.append(space);document.body.append(bar);bar.addEventListener('scroll',queueStack);sides[edge]={bar,space,max:0,signature:''};
    }
    const setStyle=(node,key,value)=>{if(node.style[key]!==value)node.style[key]=value;};
    const setVar=(node,key,value)=>{if(node.style.getPropertyValue(key)!==value)node.style.setProperty(key,value);};
    function layoutSides(){
      if(!useSideStack||drag)return;
      if(innerWidth<=600){for(const side of Object.values(sides)){side.bar.style.display='none';side.signature='';}return;}
      const B=bounds(),end=B.sideBottom;
      for(const edge of ['left','right']){
        const side=sides[edge],items=[...placed].filter(([g,p])=>p.edge===edge&&heads.get(g).getClientRects().length).map(([g,p])=>({g,index:p.index,y:p.y,height:g.getBoundingClientRect().height}));
        const start=items.length?Math.max(B.sideY,Math.min(...items.map(item=>item.y))):B.sideY,height=Math.max(1,end-start);
        side.start=start;side.end=end;side.left=(edge==='left'?B.left:B.right-WIDTH)-2;side.right=side.left+WIDTH+4;side.groups=items.map(item=>item.g);
        const stack=stackPositions(items,start,end,side.bar.scrollTop||0),signature=JSON.stringify([start,end,B.left,B.right,stack.offset,stack.rows.map(r=>[idOf(r.g),r.top,r.height])]);
        side.max=stack.maxScroll;side.hitEnd=Math.min(end,start+stack.height);if(signature===side.signature)continue;side.signature=signature;
        setStyle(side.bar,'display',stack.maxScroll?'block':'none');setStyle(side.bar,'top',start+'px');setStyle(side.bar,'height',height+'px');setStyle(side.bar,'left',(edge==='left'?B.left+WIDTH+2:B.right-WIDTH-16)+'px');setStyle(side.space,'height',Math.max(height,stack.height)+'px');
        if(side.bar.scrollTop!==stack.offset)side.bar.scrollTop=stack.offset;
        for(const row of stack.rows){setVar(row.g,'--may-dock-y',row.screenY+'px');setVar(row.g,'--may-side-clip-top',Math.max(0,start-row.screenY)+'px');setVar(row.g,'--may-side-clip-bottom',Math.max(0,row.screenY+row.height-end)+'px');}
      }
    }
    const sideOf=target=>{const g=target?.closest?.('.may-dock-side');if(g&&placed.has(g))return sides[placed.get(g).edge];const bar=target?.closest?.('.may-menu-side-scroll');return bar&&sides[bar.dataset.edge]?.bar===bar?sides[bar.dataset.edge]:null;};
    const gapSide=e=>innerWidth<=600||document.body.classList.contains('may-zen')?null:Object.values(sides).find(s=>s.groups?.some(g=>heads.get(g).getClientRects().length)&&e.clientX>=s.left&&e.clientX<=s.right&&e.clientY>=s.start&&e.clientY<=s.hitEnd);
    wheelRegions.push(e=>!!gapSide(e));
    const wheelControls='input,textarea,select,[contenteditable],[role="slider"],.gz-control,.gz-val,.gz-vpair,.gz-sl,.gz-sl2,.may-slide,.gz-ladder,.may-hp-pop,[role="listbox"],[data-n="fontCycle"],[data-n="sizeCtl"],[data-n="viewCycle"]';
    function scrollSide(e,side,fieldGap=false){
      if(innerWidth<=600||drag||e.ctrlKey||e.defaultPrevented||!side?.max)return;
      const control=e.target.closest?.(wheelControls);if(control?.matches?.(wheelControls))return;
      // Nested native lists own their wheel, including when they reach an end.
      for(let node=e.target;node&&node!==document.body;node=node.parentElement){
        if(node===side.bar||fieldGap&&node.id==='wrap')break;
        if(node.scrollHeight>node.clientHeight+1&&/auto|scroll/.test(getComputedStyle(node).overflowY))return;
        if(node.matches?.('.may-dock-side'))break;
      }
      const delta=e.deltaY*(e.deltaMode===1?DY:e.deltaMode===2?parseFloat(side.bar.style.height):1);if(!Number.isFinite(delta)||!delta)return;
      const current=side.bar.scrollTop;
      // Crossing an edge first lands there. Only a subsequent outward wheel
      // wraps, so a large delta in the middle cannot jump past unseen groups.
      side.bar.scrollTop=delta>0&&current>=side.max-.5?0:delta<0&&current<=.5?side.max:Math.max(0,Math.min(side.max,current+delta));
      e.preventDefault();e.stopImmediatePropagation();queueStack();
    }
    // Gaps hit the canvas under the menu. Route those coordinates before its
    // wheel handler zooms the field; actual menu controls keep their own events.
    document.addEventListener('wheel',e=>{
      if(!useSideStack||drag||e.defaultPrevented||sideOf(e.target)||e.target?.closest?.(wheelMenu))return;
      const target=e.target;
      if(!fieldTarget(target))return;
      const side=gapSide(e);
      if(side)scrollSide(e,side,true);
      // Only hits which fell through decorative menu geometry are consumed
      // here. DOM controls reach their own wheel handlers unchanged.
      if(!e.defaultPrevented&&ownsWheel(e)){e.preventDefault();e.stopImmediatePropagation();}
    },{capture:true,passive:false});
    document.addEventListener('wheel',e=>scrollSide(e,sideOf(e.target)),{passive:false});
    document.addEventListener('focusin',e=>{const side=sideOf(e.target);if(!side?.max)return;const r=e.target.getBoundingClientRect(),delta=r.top<side.start?r.top-side.start:r.bottom>side.end?r.bottom-side.end:0;if(delta){side.bar.scrollTop=Math.max(0,Math.min(side.max,side.bar.scrollTop+delta));queueStack();}});
    const layout=()=>{if(innerWidth<=600){for(const g of heads.keys())g.classList.remove('may-docked','may-dock-bottom','may-dock-side');placed.clear();geometry='';onLayout();layoutSides();return;}
      // The frame controls follow the field axis without resizing the header.
      // Their new position must free/reoccupy slots just like a viewport resize.
      const B=bounds(),signature=JSON.stringify([B,obstacles()])+'|'+[...heads.values()].map(h=>h.getClientRects().length?h.offsetWidth:0).join(',');if(drag)return;if(ready&&signature===geometry){layoutSides();return;}geometry=signature;
      const previous=new Map(placed);placed.clear();
      for(const [g,hd] of heads){if(!hd.getClientRects().length)continue;const saved=state[idOf(g)],r=rect(hd),prior=previous.get(g),side=saved?.edge||prior?.edge||initialEdge||(g.parentElement===rail?'left':g.classList.contains('pt-bot')?'bottom':'top');
        const free=available(g),bottomFallback=saved?.edge==='bottom'?free.filter(p=>p.edge==='bottom').sort((a,b)=>Math.abs(a.index-saved.index)-Math.abs(b.index-saved.index))[0]:null,
          p=free.find(p=>p.edge===saved?.edge&&p.index===saved.index)||bottomFallback||nearest(free,prior?prior.x+WIDTH/2:r.x+r.w/2,prior?prior.y+HEIGHT/2:r.y+r.h/2,side);
        if(!p)continue;moveToTools(g);apply(g,p);if(!saved)state[idOf(g)]={edge:p.edge,index:p.index};}
      ready=true;save();onLayout();for(const side of Object.values(sides))side.signature='';layoutSides();};
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
    for(const g of groups()){const hd=g.querySelector(':scope > .pt-l,:scope > .gz-head')||(g.id==='mayCorner'?g:null);if(hd){heads.set(g,hd);g.classList.toggle('may-menu-side-stack',useSideStack);}}
    if(useSideStack&&typeof ResizeObserver==='function'){const observer=new ResizeObserver(queueStack);for(const g of heads.keys())observer.observe(g);}
    addEventListener('resize',layout);requestAnimationFrame(layout);
    return {refresh:layout};
  }
  return {WIDTH,HEIGHT,DX,DY,slots,nearest,overlap,read,stackPositions,mount,ownsWheel,guardWheel};
});
