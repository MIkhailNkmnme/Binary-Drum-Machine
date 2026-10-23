/* Hub v0.417 — button-standard adapter; source controls and grozd storage stay intact. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg', MINI_KEY = 'zerk_hub_mini_headers';
  let minis = {}; try { minis = JSON.parse(localStorage.getItem(MINI_KEY)) || {}; } catch (_) {}
  const icons = { sound:'♪', bits:'01', symmetry:'⋈', axis:'✣', space:'◇', motion:'⟳', flow:'≋', file:'▧', locks:'⌑' };
  const svg = cls => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('aria-hidden', 'true'); s.classList.add(cls); return s; };
  const shape = (s, tag, attrs) => { const p = document.createElementNS(NS, tag); for (const [k,v] of Object.entries(attrs)) p.setAttribute(k,v); s.append(p); return p; };
  const roof = (b, mini) => {
    let s = b.querySelector(':scope > .hub-roof');
    if (!s) { s = svg('hub-roof'); b.append(s); }
    const w = mini ? 34 : 120, d = `M1 12 L${mini ? 17 : 12} 1 ${mini ? '' : '108 1'} ${w-1} 12`;
    if (s.dataset.d !== d) { s.dataset.d = d; s.replaceChildren(); shape(s,'path',{d}); }
  };
  const contours = (host, cells, caps) => {
    let s = host.querySelector(':scope > .hub-contours');
    if (!s) { s = svg('hub-contours'); if(host.classList.contains('gz-ladder'))host.append(s);else host.prepend(s); }
    const signature = JSON.stringify([cells,caps]); if (s.dataset.signature === signature) return;
    s.dataset.signature = signature; s.replaceChildren();
    for (const {x,y,w=120} of cells) {
      shape(s,'polygon',{points:`${x-1},${y+12} ${x+12},${y-1} ${x+w-12},${y-1} ${x+w+1},${y+12} ${x+w-12},${y+25} ${x+12},${y+25}`,fill:'#05070d'});
      // Fill only the centre between neighbours; the outer silhouette remains toothed.
      if (cells.some(c => c.x === x && c.y === y+26)) shape(s,'rect',{x:x+12,y:y+23,width:w-24,height:4,fill:'#05070d'});
    }
    for (const {x,y,top} of caps) shape(s,'path',{class:'cap',d:top ? `M${x} ${y+12} L${x+12} ${y} H${x+108} L${x+120} ${y+12}` : `M${x} ${y+12} L${x+12} ${y+24} H${x+108} L${x+120} ${y+12}`});
  };
  const overlap = (a,b) => a.left < b.right-1 && a.right > b.left+1 && a.top < b.bottom-1 && a.bottom > b.top+1;
  const setStyle = (e,k,v) => { if (e.style.getPropertyValue(k) !== v) e.style.setProperty(k,v); };
  let frontGroup = null;
  const allBoxes = () => [...document.querySelectorAll('#hubRail .gz-group')];
  function updateOcclusion() {
    const groups = allBoxes();
    groups.forEach(g => { g.classList.remove('hub-occluded'); g.inert = false; });
    const active = groups.filter(g => g.classList.contains('gz-open')).sort((a,b)=>(b.dataset.id===frontGroup)-(a.dataset.id===frontGroup));
    const ladder = document.querySelector('.hub-standard-list');
    const bounds=g=>[...g.querySelectorAll('.gz-hx,.hub-contours .cap')].filter(b=>b.getClientRects().length).map(b=>{const r=b.getBoundingClientRect();return{left:r.left-1,right:r.right+1,top:r.top-1,bottom:r.bottom+1};});
    for (const g of groups) {
      const targets=bounds(g), rank=active.indexOf(g);
      const foreign = active.some((a,i) => a !== g && (rank<0||i<rank) && !a.classList.contains('hub-occluded') && bounds(a).some(b=>targets.some(t=>overlap(t,b))));
      const hidden = foreign || (ladder && ladder.owner?.closest('.gz-group') !== g && targets.some(t=>overlap(t,ladder.getBoundingClientRect())));
      g.classList.toggle('hub-occluded',!!hidden); g.inert = !!hidden;
    }
  }
  function setupList(b) {
    const o = b.gzList; if (!o || b.dataset.hubList) return; b.dataset.hubList = '1';
    const c = document.createElement('span'); c.className='hub-inner-chevron'; b.append(c);
    o.placement='right';
    o.placed = list => {
      list.classList.add('hub-standard-list'); b.classList.add('hub-list-owner'); roof(b,false);
      const options = [...list.children].filter(x => x.classList.contains('gz-hx'));
      const r = b.getBoundingClientRect(), rows = Math.min(innerWidth<=1100?Infinity:7,options.length,Math.max(1,Math.floor((innerHeight-30)/26))), cols = Math.ceil(options.length/rows), width=cols*122-2;
      const right = r.right+2, left=r.left-width-2;
      const rightSpace=innerWidth-right-3,leftSpace=r.left-5;
      const full=right+width<=innerWidth-3||left>=3;
      const useRight=rightSpace>=leftSpace;
      const visibleWidth=full?width:Math.min(width,Math.max(120,Math.floor(Math.max(rightSpace,leftSpace)/122)*122-2));
      let x = right+width <= innerWidth-3 ? right : left >= 3 ? left : useRight?right:r.left-visibleWidth-2;
      const y=Math.max(14,Math.min(r.top,innerHeight-rows*26-14));
      Object.assign(list.style,{display:'grid',gridAutoFlow:'column',gridTemplateRows:`repeat(${rows},24px)`,gridAutoColumns:'120px',width:visibleWidth+'px',left:x+'px',top:y+'px',maxWidth:'none',maxHeight:'none'});
      list.style.setProperty('overflow-x',full?'visible':'auto','important');
      const cells=options.map((_,i)=>({x:Math.floor(i/rows)*122,y:i%rows*26})), caps=[];
      for(let col=0;col<cols;col++){ const last=Math.min(rows,options.length-col*rows)-1; caps.push({x:col*122,y:-12,top:true},{x:col*122,y:last*26+12}); }
      contours(list,cells,caps);
      const g=b.closest('.gz-group'); g?.querySelectorAll('.gz-hx').forEach(x=>x.classList.toggle('hub-dim',x!==b));
      options.forEach(x => { x.tabIndex=0; x.setAttribute('role','button'); if(!x.dataset.hubKeyboard){x.dataset.hubKeyboard='1'; x.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();x.click();}});} });
      updateOcclusion();
    };
    o.closed = () => { b.classList.remove('hub-list-owner'); b.querySelector('.hub-roof')?.remove(); document.querySelectorAll('#hubRail .hub-dim').forEach(x=>x.classList.remove('hub-dim')); queueMicrotask(updateOcclusion); };
  }
  function setupParts(box) {
    for(const b of box.querySelectorAll('.gz-hx:not(.gz-head)')) {
      setupList(b);
      const halves=[...b.querySelectorAll(':scope > .gz-half')];
      if(halves.length===2 && b.classList.contains('gz-split')) {
        // Only explicitly mutually exclusive product modes get a changing seam.
        const exclusive=/Или — или:|Закрепить центр в центре оси/.test(b.title||b.dataset.hubTip||'');
        const reverse=exclusive && halves[1].classList.contains('gz-on') && !halves[0].classList.contains('gz-on');
        b.classList.toggle('hub-reverse',reverse);
        halves.forEach((h,i)=>{
          h.setAttribute('role','button'); h.tabIndex=0; h.setAttribute('aria-pressed',String(h.classList.contains('gz-on')));
          if(!h.dataset.hubKeyboard){h.dataset.hubKeyboard='1'; h.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();h.click();}});}
          let s=h.querySelector('.hub-half-outline');if(!s){s=svg('hub-half-outline');h.append(s);}
          const points=b.classList.contains('gz-one') && i===0 ? '12,0 108,0 120,12 108,24 12,24 0,12' : i===0 ? (reverse?'12,0 64,0 56,24 12,24 0,12':'12,0 56,0 64,24 12,24 0,12') : (reverse?'8,0 52,0 64,12 52,24 0,24':'0,0 52,0 64,12 52,24 8,24');
          if(s.dataset.points!==points){s.dataset.points=points;s.replaceChildren();shape(s,'polygon',{points});}
        });
      }
      for(const a of b.querySelectorAll('.gz-a:not(.gz-a2),.gz-vh,.gz-vt')) {
        if(a.dataset.hubKeyboard)continue; a.dataset.hubKeyboard='1';a.tabIndex=0;a.setAttribute('role','button'); a.setAttribute('aria-label',a.classList.contains('gz-a') ? ((a.nextElementSibling?.classList.contains('gz-mid')?'Уменьшить':'Увеличить')+' · '+b.title) : a.textContent);
        a.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();a.click();}});
        if(a.classList.contains('gz-a')) {
          const s=svg('hub-arrow-outline');s.setAttribute('viewBox','0 0 18 24');
          shape(s,'path',{d:a.nextElementSibling?.classList.contains('gz-mid')?'M17 1 H12 L1 12 L12 23 H17 L7 12 Z':'M1 1 H6 L17 12 L6 23 H1 L11 12 Z'});a.append(s);
          a.addEventListener('pointerdown',e=>{if(e.button!==0)return;let timer=setTimeout(()=>{a.click();timer=setInterval(()=>a.click(),90);},350);const stop=()=>{clearTimeout(timer);clearInterval(timer);removeEventListener('pointerup',stop);removeEventListener('pointercancel',stop);};addEventListener('pointerup',stop);addEventListener('pointercancel',stop);});
        }
      }
    }
  }
  function layout(root) {
    for(const box of root.querySelectorAll(':scope > .gz-group')) {
      if(box.classList.contains('gz-drag'))continue;
      const head=box.querySelector(':scope > .gz-head'), open=box.classList.contains('gz-open'), mini=!!minis[box.dataset.id];
      head.classList.toggle('hub-mini',mini); head.setAttribute('aria-expanded',String(open));
      const pin=head.querySelector('.gz-pin');pin?.setAttribute('aria-pressed',String(box.classList.contains('gz-pinned')));
      if(!head.dataset.hubReady){
        head.dataset.hubReady='1'; const ic=document.createElement('span');ic.className='gz-ic';ic.textContent=icons[box.dataset.id]||'◇';head.prepend(ic);
        head.title=(head.title||head.querySelector('.gz-nm').textContent)+' · Правая кнопка — компактный заголовок';
        let keyMenuAt=0;
        const toggleMini=()=>{minis[box.dataset.id]=!minis[box.dataset.id];try{localStorage.setItem(MINI_KEY,JSON.stringify(minis));}catch(_){}layout(root);};
        head.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();if(e.button===2||performance.now()-keyMenuAt>500)toggleMini();});
        head.addEventListener('keydown',e=>{if(e.target===head&&(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10'))){e.preventDefault();e.stopPropagation();keyMenuAt=performance.now();toggleMini();}});
        pin.tabIndex=0;pin.setAttribute('role','button');pin.setAttribute('aria-label','Закрепить группу');pin.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();pin.click();}});
      }
      const items=[...box.querySelectorAll('.gz-hx:not(.gz-head)')];
      const top=!!box.closest('.hubStrip'), mobile=innerWidth<=1100, vertical=top||mobile;
      const r=head.getBoundingClientRect(), rows=vertical?items.length:Math.min(7,Math.max(1,Math.floor((innerHeight-r.top-16)/26)));
      const cells=[{x:0,y:0,w:mini?34:120}],caps=[];
      items.forEach((b,i)=>{
        const x=vertical?0:122+Math.floor(i/rows)*122, y=vertical?(i+1)*26:i%rows*26;
        setStyle(b,'--hub-x',x+'px');setStyle(b,'--hub-y',y+'px');
        const section=b.closest('.gz-sec');if(section)setStyle(b,'--c',section.style.getPropertyValue('--c'));
        if(open)cells.push({x,y});
      });
      const height=vertical && open ? (items.length+1)*26-2 :24;setStyle(box,'--hub-height',height+'px');
      if(top)setStyle(box,'height',height+'px');
      box.classList.add('gz-onecol');
      if(open){
        head.classList.add('hub-list-owner');roof(head,mini);
        if(vertical && items.length)caps.push({x:0,y:items.length*26+12});
        else for(let col=0;col<Math.ceil(items.length/rows);col++)caps.push({x:122+col*122,y:-12,top:true},{x:122+col*122,y:(Math.min(rows,items.length-col*rows)-1)*26+12});
      }else{head.classList.remove('hub-list-owner');head.querySelector('.hub-roof')?.remove();}
      contours(box,cells,caps);setupParts(box);
    }
    updateOcclusion();
  }
  const original=window.ZerkGrozd.rail;
  window.ZerkGrozd.rail=function(host,cfg){
    const api=original.call(this,host,cfg);if(!['hub','hubtop'].includes(cfg.key))return api;
    const refresh=api.refresh;api.refresh=()=>{refresh();layout(api.el);};
    const open=api.open,close=api.close;api.open=id=>{open(id);layout(api.el);};api.close=()=>{close();layout(api.el);};
    api.el.addEventListener('click',e=>{frontGroup=e.target.closest('.gz-group')?.dataset.id||frontGroup;queueMicrotask(()=>layout(api.el));});
    layout(api.el);return api;
  };
  document.addEventListener('pointerdown',e=>{const h=e.target.closest('#hubRail .gz-half');if(!h||e.button!==0)return;h.classList.add('hub-held');const end=()=>{h.classList.remove('hub-held');removeEventListener('pointerup',end);removeEventListener('pointercancel',end);};addEventListener('pointerup',end);addEventListener('pointercancel',end);},true);
  const navigation=()=>document.querySelectorAll('.hub a.menu-btn.hubPg').forEach(a=>{if(a.querySelector('.hub-navigation-outline'))return;const s=svg('hub-navigation-outline');s.setAttribute('viewBox','0 0 120 24');shape(s,'polygon',{points:'12,0 108,0 120,12 108,24 12,24 0,12'});a.append(s);});
  function edgeCommands(){
    const commands=['hubZenToggle','hubZenPng','hubZenRec','hubZenSys'].map(id=>document.getElementById(id));
    if(commands.some(x=>!x))return;
    const blockHeight=198,x=innerWidth-56;
    const obstacles=['#hubPult .hpZoom','#hubPultBot','#hubMobSwitch'].map(q=>document.querySelector(q)).filter(e=>e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height&&r.right>x&&r.left<innerWidth-8);
    const zoom=document.querySelector('#hubPult .hpZoom')?.getBoundingClientRect();
    let y=Math.max(8,Math.min(innerHeight-blockHeight-8,zoom?.height?zoom.bottom+2:innerHeight-blockHeight-8));
    // Four compact diamonds, kept clear of zoom and the transport.
    for(let i=0;i<obstacles.length+1;i++){
      const hit=obstacles.find(r=>y<r.bottom+2&&y+blockHeight>r.top-2);
      if(!hit)break;
      y=Math.max(8,hit.top-blockHeight-2);
    }
    commands.forEach((b,i)=>{
      setStyle(b,'--hub-command-y',(Math.round(y)+i*50)+'px');
      if(i>1)b.setAttribute('aria-pressed',String(b.classList.contains('on')));
      if(!b.querySelector('.hub-command-icon')){
        const ic=svg('hub-command-icon');ic.setAttribute('viewBox','0 0 24 24');
        shape(ic,'path',{d:['M3 12q9-12 18 0-9 12-18 0M15 12a3 3 0 11-6 0 3 3 0 016 0','M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.1','M18 12a6 6 0 11-12 0 6 6 0 0112 0','M5 9h4l5-4v14l-5-4H5zM17 8q5 4 0 8'][i]});b.prepend(ic);
      }
      if(!b.querySelector(':scope > .hub-command-outline')){const s=svg('hub-command-outline');s.setAttribute('viewBox','0 0 48 48');shape(s,'polygon',{points:'24,0 48,24 24,48 0,24'});b.append(s);}
    });
  }
  addEventListener('resize',edgeCommands);
  document.addEventListener('click',()=>requestAnimationFrame(edgeCommands),true);
  setInterval(edgeCommands,500);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',navigation);else navigation();
})();
