/* Маятник v0.447 — scoped grozd adapter, КНОПКИ v12. Source controls stay intact. */
(() => {
  'use strict';
  const NS='http://www.w3.org/2000/svg';
  const svg=(cls)=>{const s=document.createElementNS(NS,'svg');s.classList.add(cls);s.setAttribute('aria-hidden','true');return s;};
  const shape=(s,tag,attrs)=>{const p=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))p.setAttribute(k,v);s.append(p);};
  const set=(e,k,v)=>{if(e.getAttribute(k)!==v)e.setAttribute(k,v);};
  const polygon='12,0 108,0 120,12 108,24 12,24 0,12';
  function outline(b){
    let s=b.querySelector(':scope > .may-standard-outline');
    if(!s){s=svg('may-standard-outline');shape(s,'polygon',{points:polygon});b.append(s);}
    const mini=b.classList.contains('may-standard-mini');set(s,'viewBox',mini?'0 0 34 24':'0 0 120 24');set(s.firstElementChild,'points',mini?'17,0 34,12 17,24 0,12':polygon);
  }
  function roof(b,mini){
    let s=b.querySelector(':scope > .may-standard-roof');if(!s){s=svg('may-standard-roof');b.append(s);}
    const w=mini?34:120,d=mini?'M1 12 L17 1 33 12':'M1 12 L12 1 H108 L119 12';
    set(s,'viewBox',`0 0 ${w} 24`);
    if(s.dataset.d!==d){s.dataset.d=d;s.replaceChildren();shape(s,'path',{d});}
  }
  function contour(host,cells,side){
    let s=host.querySelector(':scope > .may-standard-contours');if(!s){s=svg('may-standard-contours');host.prepend(s);}
    const base=host.getBoundingClientRect(),cols=new Map();
    for(const b of cells){const r=b.getBoundingClientRect();if(!r.width||!r.height)continue;const x=Math.round(r.left-base.left+host.scrollLeft),y=Math.round(r.top-base.top+host.scrollTop);if(!cols.has(x))cols.set(x,[]);cols.get(x).push({x,y,w:r.width,h:r.height});}
    const sig=JSON.stringify([...cols]);if(s.dataset.sig===sig)return;s.dataset.sig=sig;s.replaceChildren();
    for(const col of cols.values()){
      col.sort((a,b)=>a.y-b.y);
      for(const {x,y,w,h}of col){shape(s,'polygon',{points:`${x-1},${y+h/2} ${x+12},${y-1} ${x+w-12},${y-1} ${x+w+1},${y+h/2} ${x+w-12},${y+h+1} ${x+12},${y+h+1}`,fill:'#05070d'});if(col.some(c=>Math.abs(c.y-y-h-2)<1))shape(s,'rect',{x:x+12,y:y+h-1,width:w-24,height:4,fill:'#05070d'});}
      const first=col[0],last=col.at(-1);
      if(side)shape(s,'path',{class:'cap',d:`M${first.x} ${first.y} L${first.x+12} ${first.y-12} H${first.x+first.w-12} L${first.x+first.w} ${first.y}`});
      shape(s,'path',{class:'cap',d:`M${last.x} ${last.y+last.h} L${last.x+12} ${last.y+last.h+12} H${last.x+last.w-12} L${last.x+last.w} ${last.y+last.h}`});
    }
  }
  function parts(b){
    const halves=[...b.querySelectorAll(':scope > .gz-half')];if(halves.length!==2||b.id==='lg')return;
    b.classList.add('may-standard-pair');
    const exclusive=b.closest('[data-id="horr"]')&&(halves.every(h=>h.dataset.n)||halves.every(h=>h.dataset.v)||/Ход лево-право/.test(halves[0].title));
    const rev=!!exclusive&&halves[1].classList.contains('gz-on')&&!halves[0].classList.contains('gz-on');b.classList.toggle('may-standard-reverse',rev);
    halves.forEach((h,i)=>{let s=h.querySelector(':scope > .may-half-outline');if(!s){s=svg('may-half-outline');s.setAttribute('viewBox','0 0 64 24');h.append(s);}const p=i===0?(rev?'12,0 64,0 56,24 12,24 0,12':'12,0 56,0 64,24 12,24 0,12'):(rev?'8,0 52,0 64,12 52,24 0,24':'0,0 52,0 64,12 52,24 8,24');if(s.dataset.p!==p){s.dataset.p=p;s.replaceChildren();shape(s,'polygon',{points:p});}set(h,'aria-pressed',String(h.classList.contains('gz-on')));keyboard(h);});
    if(b.classList.contains('gz-wl')&&!halves[1].querySelector('.may-colour-swatch')){const dot=document.createElement('span');dot.className='may-colour-swatch';dot.setAttribute('aria-hidden','true');halves[1].append(dot);}
  }
  function keyboard(b){if(b.dataset.mayStandardKey||b.getAttribute('role')==='button'&&b.tabIndex>=0)return;b.dataset.mayStandardKey='1';b.tabIndex=0;set(b,'role','button');b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();b.click();}});}
  function refresh(){
    const ladders=[...document.querySelectorAll('.gz-ladder')];
    document.querySelectorAll('.may-options-owner').forEach(b=>{if(!ladders.some(l=>l.owner===b)){b.classList.remove('may-options-owner','may-standard-open');b.querySelector('.may-standard-roof')?.remove();}});
    document.querySelectorAll('#paintTools .gz-hx,#paintTools .pt-l,#mayatnikRail .gz-hx,#mayAbout,#mayHelp,#mayMenu,#mayRhZen,#mayRhRec,#mayRhGif,.gz-ladder .gz-hx').forEach(b=>{
      if(b.closest('.pt-btn')||b.closest('#mayBottomBar')&&!b.classList.contains('gz-head'))return;
      b.classList.add('may-standard');outline(b);parts(b);if(b.closest('.gz-ladder'))keyboard(b);
      const mini=b.matches('.gz-head')&&b.closest('.gz-mini')||b.matches('.pt-l')&&b.closest('.pt-mini')||b.id==='mayAbout'&&b.classList.contains('pt-mini');b.classList.toggle('may-standard-mini',!!mini);
    });
    for(const g of document.querySelectorAll('#paintTools > .pt-g,#paintTools > .gz-group,#mayatnikRail .gz-group')){
      const head=g.querySelector(':scope > .pt-l,:scope > .gz-head'),open=g.matches('.pt-open,.gz-open');if(!head)continue;
      if(g.classList.contains('pt-btn'))continue;
      head.classList.toggle('may-standard-open',open);if(open)roof(head,head.classList.contains('may-standard-mini'));else head.querySelector('.may-standard-roof')?.remove();
      const pin=head.querySelector('.pt-pin,.gz-pin');if(pin){keyboard(pin);set(pin,'aria-label','Закрепить группу');set(pin,'aria-pressed',String(g.matches('.pt-pinned,.gz-pinned')));}
      if(!head.dataset.mayMiniKeys){head.dataset.mayMiniKeys='1';let last=0;head.addEventListener('keydown',e=>{if(e.target===head&&(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10')){e.preventDefault();e.stopPropagation();last=performance.now();head.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,button:2}));}});head.addEventListener('contextmenu',e=>{if(e.button!==2&&performance.now()-last<500)e.stopImmediatePropagation();},true);}
      const host=g.querySelector(':scope > .pt-r,:scope > .may-rail-list')||g;
      if(open){
        if(host.classList.contains('pt-r')){const max=Math.max(24,g.classList.contains('pt-bot')?head.getBoundingClientRect().top-14:innerHeight-host.getBoundingClientRect().top-14);host.style.maxHeight=max+'px';const scroll=host.scrollHeight>max+1;host.style.overflowY=scroll?'auto':'visible';host.style.overflowX=scroll?'hidden':'visible';}
        if(host.classList.contains('may-rail-list'))host.style.overflowX=host.scrollWidth>host.clientWidth+1?'auto':'visible';
        const cells=[...host.querySelectorAll('.may-standard,.gz-control')].filter(b=>!b.matches('.pt-l,.gz-head')&&!b.parentElement.closest('.gz-hx,.gz-control')&&!b.closest('.gz-ladder'));contour(host,cells,!!g.closest('#mayatnikRail'));
      }else host.querySelector(':scope > .may-standard-contours')?.remove();
      g.inert=g.classList.contains('may-group-covered');
    }
    for(const list of ladders){list.classList.add('may-standard-list');if(list.owner){list.owner.classList.add('may-options-owner','may-standard-open');roof(list.owner,false);}contour(list,[...list.querySelectorAll(':scope > .gz-hx')],true);}
  }
  document.addEventListener('pointerdown',e=>{const b=e.target.closest('.may-standard-pair .gz-half');if(!b||e.button!==0)return;b.classList.add('may-standard-held');const stop=()=>{b.classList.remove('may-standard-held');removeEventListener('pointerup',stop);removeEventListener('pointercancel',stop);};addEventListener('pointerup',stop);addEventListener('pointercancel',stop);},true);
  addEventListener('resize',refresh);document.addEventListener('click',()=>requestAnimationFrame(refresh));setInterval(refresh,200);refresh();
})();
