/* Маятник v0.495 — scoped grozd adapter, ромбы обычных кнопок с сохранением обеих частей. Source controls stay intact. */
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
    const mini=b.classList.contains('may-standard-mini')||b.classList.contains('may-control-mini');set(s,'viewBox',mini?'0 0 34 24':'0 0 120 24');set(s.firstElementChild,'points',mini?'17,0 34,12 17,24 0,12':polygon);
  }
  function roof(b,mini,up=false){
    let s=b.querySelector(':scope > .may-standard-roof');if(!s){s=svg('may-standard-roof');b.append(s);}
    const w=mini?34:120,d=up?(mini?'M1 12 L17 23 33 12':'M1 12 L12 23 H108 L119 12'):(mini?'M1 12 L17 1 33 12':'M1 12 L12 1 H108 L119 12');
    set(s,'viewBox',`0 0 ${w} 24`);
    if(s.dataset.d!==d){s.dataset.d=d;s.replaceChildren();shape(s,'path',{d});}
  }
  let gradN=0;
  // v0.449: одна подложка на столбец — радиальный градиент #32393f → #000, зубцы по бокам (острие +2 px, впадина 6 px внутрь), верхняя и нижняя скобки в этом же слое
  function contour(host,cells,side,headEl,upward=false){
    let s=host.querySelector(':scope > .may-standard-contours');if(!s){s=svg('may-standard-contours');
      // grozd synchronizes option states by child index. Decoration must follow every option.
      if(host.classList.contains('gz-ladder'))host.append(s);else host.prepend(s);
    }
    const base=host.getBoundingClientRect(),cols=new Map();
    const add=(b,head)=>{const r=b.getBoundingClientRect();if(!r.width||!r.height)return false;const x=Math.round(r.left-base.left+host.scrollLeft),y=Math.round(r.top-base.top+host.scrollTop);let k=[...cols.keys()].find(c=>Math.abs(c-x)<30);if(k===undefined){if(head)return false;k=x;cols.set(k,[]);}cols.get(k).push({x,y,w:r.width,h:r.height,head:!!head});return true;};
    for(const b of cells)add(b,false);
    let hin=false;
    if(headEl&&!headEl.classList.contains('may-standard-mini')&&getComputedStyle(host).overflowY==='visible'){
      const hr=headEl.getBoundingClientRect(),hy=Math.round(hr.top-base.top+host.scrollTop),hx=Math.round(hr.left-base.left+host.scrollLeft);
      const k=[...cols.keys()].find(c=>Math.abs(c-hx)<30);
      if(k!==undefined&&hr.width){const col=cols.get(k),above=hy+hr.height<=Math.min(...col.map(c=>c.y))+1,below=hy>=Math.max(...col.map(c=>c.y+c.h))-1;if(above||below)hin=add(headEl,true);}
    }
    const sig=JSON.stringify([...cols,hin,!!upward,!!side]);if(s.dataset.sig===sig)return hin;s.dataset.sig=sig;s.replaceChildren();
    const f=n=>n.toFixed(2);let out='';
    for(const col of cols.values()){
      col.sort((a,b)=>a.y-b.y);
      // v0.448: ширина и x — по обычной кнопке столбца, чтобы список или поле внизу их не сдвигали
      const mode=k=>{const m=new Map();let best=col[0][k],n=0;for(const c of col){const v=Math.round(c[k]),q=(m.get(v)||0)+1;m.set(v,q);if(q>n){n=q;best=v;}}return best;},x=mode('x'),w=mode('w'),xr=x+w,y0=col[0].y,yb=Math.max(...col.map(c=>c.y+c.h)),R=[],L=[],head=!!col[0].head,up=!!col[col.length-1].head&&!head;
      if(up||upward){R.push([xr-12.4,y0-12],[xr-1,y0-1]);L.push([x+12.4,y0-12],[x+1,y0-1]);}
      else if(head||(side&&headEl)){R.push([xr-12,y0]);L.push([x+12,y0]);}   // v0.457: у группы, чей заголовок не над столбцом, верхняя скобка прилегает к первой кнопке
      else if(side){R.push([xr-12.4,y0-12],[xr-1,y0-1]);L.push([x+12.4,y0-12],[x+1,y0-1]);}
      else{R.push([xr-12.4,y0+1]);L.push([x+12.4,y0+1]);}
      col.forEach((c,i)=>{const ym=c.y+c.h/2;R.push([xr+2,ym]);L.push([x-2,ym]);if(i<col.length-1){const gm=(c.y+c.h+col[i+1].y)/2;R.push([xr+2-6,gm]);L.push([x-2+6,gm]);}});
      if(up){R.push([xr-12,yb]);L.push([x+12,yb]);}else if(upward){R.push([xr-12.4,yb-1]);L.push([x+12.4,yb-1]);}else{R.push([xr-1,yb+1],[xr-12.4,yb+12]);L.push([x+1,yb+1],[x+12.4,yb+12]);}
      const id='may-back-'+(++gradN),pts=R.concat(L.reverse()).map(q=>f(q[0])+','+f(q[1])).join(' ');
      out+=`<defs><radialGradient id="${id}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#0e1116"/><stop offset="1" stop-color="#0e1116"/></radialGradient></defs><polygon points="${pts}" fill="url(#${id})"/>`;
      if(up||upward)out+=`<path class="cap" d="M${x} ${y0} L${x+12} ${y0-12} H${xr-12} L${xr} ${y0}"/>`;
      else if(head||(side&&headEl))out+=`<path class="cap" d="M${x} ${f(y0+12)} L${x+12} ${y0} H${xr-12} L${xr} ${f(y0+12)}"/>`;
      else if(side)out+=`<path class="cap" d="M${x} ${y0} L${x+12} ${y0-12} H${xr-12} L${xr} ${y0}"/>`;
      if(up)out+=`<path class="cap" d="M${x} ${yb-12} L${x+12} ${yb} H${xr-12} L${xr} ${yb-12}"/>`;
      else if(!upward)out+=`<path class="cap" d="M${x} ${yb} L${x+12} ${yb+12} H${xr-12} L${xr} ${yb}"/>`;
    }
    s.innerHTML=out;return hin;
  }
  // v0.449: подложка закрытой группы — тот же градиент и зубцы вокруг шапки
  function closedBack(g,head){
    let s=g.querySelector(':scope > .may-closed-back');const r=head.getBoundingClientRect();
    if(!r.width||!r.height){s?.remove();return;}
    const op=head.offsetParent||g,b=op.getBoundingClientRect(),x=Math.round(r.left-b.left-op.clientLeft+op.scrollLeft),y=Math.round(r.top-b.top-op.clientTop+op.scrollTop),w=Math.round(r.width),h=Math.round(r.height);
    const sig=[x,y,w,h].join();if(s&&s.dataset.sig===sig)return;
    if(!s){s=svg('may-closed-back');g.prepend(s);g.classList.add('may-back-host');}
    s.dataset.sig=sig;const mini=head.classList.contains('may-standard-mini'),m=h/2;
    const pts=mini?[[x+w/2,y-1],[x+w+2,y+m],[x+w/2,y+h+1],[x-2,y+m]]:[[x+12,y-1],[x+w-12,y-1],[x+w+2,y+m],[x+w-12,y+h+1],[x+12,y+h+1],[x-2,y+m]];
    const id='may-back-'+(++gradN);
    s.innerHTML=`<defs><radialGradient id="${id}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#0e1116"/><stop offset="1" stop-color="#0e1116"/></radialGradient></defs><polygon points="${pts.map(q=>q.join(',')).join(' ')}" fill="url(#${id})"/>`;
  }
  function parts(b){
    const halves=[...b.querySelectorAll(':scope > .gz-half')];
    if(b.classList.contains('may-segments')){b.style.setProperty('--may-parts',halves.length);halves.forEach((h,i)=>{let s=h.querySelector(':scope > .may-half-outline');if(!s){s=svg('may-half-outline');s.setAttribute('viewBox','0 0 100 24');s.setAttribute('preserveAspectRatio','none');shape(s,'polygon',{points:i===0?'12,1 99,1 99,23 12,23 1,12':i===halves.length-1?'1,1 88,1 99,12 88,23 1,23':'1,1 99,1 99,23 1,23'});h.append(s);}set(h,'aria-pressed',String(h.classList.contains('gz-on')));keyboard(h);});return;}
    if(halves.length!==2||b.id==='lg')return;
    b.classList.add('may-standard-pair');
    const exclusive=b.closest('[data-id="horr"]')&&(halves.every(h=>h.dataset.n)||halves.every(h=>h.dataset.v)||/Ход лево-право/.test(halves[0].title));
    const rev=!!exclusive&&halves[1].classList.contains('gz-on')&&!halves[0].classList.contains('gz-on');b.classList.toggle('may-standard-reverse',rev);
    halves.forEach((h,i)=>{let s=h.querySelector(':scope > .may-half-outline');if(!s){s=svg('may-half-outline');s.setAttribute('viewBox','0 0 64 24');h.append(s);}const p=i===0?(rev?'12,0 64,0 56,24 12,24 0,12':'12,0 56,0 64,24 12,24 0,12'):(rev?'8,0 52,0 64,12 52,24 0,24':'0,0 52,0 64,12 52,24 8,24');if(s.dataset.p!==p){s.dataset.p=p;s.replaceChildren();shape(s,'polygon',{points:p});}set(h,'aria-pressed',String(h.classList.contains('gz-on')));keyboard(h);});
    if(b.classList.contains('gz-wl')&&!halves[1].querySelector('.may-colour-swatch')){const dot=document.createElement('span');dot.className='may-colour-swatch';dot.setAttribute('aria-hidden','true');halves[1].append(dot);}
  }
  function keyboard(b){if(b.dataset.mayStandardKey||b.getAttribute('role')==='button'&&b.tabIndex>=0)return;b.dataset.mayStandardKey='1';b.tabIndex=0;set(b,'role','button');b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();b.click();}});}
  // v0.456: «цвет значков в цвет группы» — картинка значка становится маской, цвет даёт --c группы (раньше фильтр делал её белой)
  function tintIcons(){
    for(const i of document.querySelectorAll('#paintTools .pt-b > i, #mayatnikRail .pt-b > i, #mayatnikRailR .pt-b > i, .gz-hx > i.gz-ic')){
      const bg=i.style.backgroundImage; if(!bg||bg==='none'||!bg.startsWith('url')||i.dataset.mayTint===bg)continue;
      i.dataset.mayTint=bg; i.style.webkitMaskImage=bg; i.style.maskImage=bg; i.style.backgroundImage='none'; i.classList.add('may-tint');
    }
  }
  const controlSelector='button,.gz-hx,[role="button"]', MINI_KEY='mayatnik-control-mini-v464';
  let controlMinis=new Set();try{const a=JSON.parse(localStorage.getItem(MINI_KEY)||'[]');if(Array.isArray(a))controlMinis=new Set(a.filter(k=>typeof k==='string'));}catch(_){}
  function controlTarget(el){
    if(el?.closest?.('[data-no-mini]'))return null;
    let b=el?.closest?.(controlSelector);if(!b)return null;
    const pair=b.closest('.gz-pair');if(pair)b=pair;
    if(b.matches('.pt-l,.gz-head,#mayAbout,.gz-pin,.pt-pin,.gz-a,.gz-a2,.may-bb-play,.may-bb-rs,.gz-sl,.gz-sl2,.zz-pult,.may-slide,.gz-control')||b.closest('.bar,.gz-tip,[role="tooltip"],.pt-btn')||b.matches('input,select,textarea')||b.closest('.gz-control')&&!b.matches('button,.gz-hx'))return null;
    return b;
  }
  function controlKey(b){
    if(b.id)return 'id:'+b.id;
    const group=b.closest('[data-id],.pt-g,.gz-ladder'),owner=group?.dataset.id||group?.dataset.k||group?.querySelector(':scope > .pt-l')?.title||group?.id||'';
    if(b.matches('.template-entry')&&b.closest('#templateLibraryChoices'))return 'group:'+owner+':parent:templateLibraryChoices:slot:'+[...document.querySelectorAll('#templateLibraryChoices .template-entry')].indexOf(b);
    const token=b.dataset.n||b.dataset.k||b.dataset.v;
    if(token)return 'group:'+owner+':data:'+token;
    const parent=b.parentElement;if(!parent)return null;
    const peers=[...parent.children].filter(e=>e.matches(controlSelector));
    return 'group:'+owner+':parent:'+(parent.id||parent.className)+':slot:'+peers.indexOf(b);
  }
  function miniGlyph(b){
    const hasIcon=[...b.querySelectorAll(':scope > i,:scope > .gz-ic')].some(i=>{
      const c=getComputedStyle(i),image=v=>!!v&&v!=='none';
      return !!i.textContent.trim()||image(c.backgroundImage)||image(c.maskImage)||image(c.webkitMaskImage)||!!i.querySelector('svg,img');
    });
    b.classList.toggle('may-mini-has-icon',hasIcon);
    let g=b.querySelector(':scope > .may-mini-glyph');if(!g){g=document.createElement('span');g.className='may-mini-glyph';g.setAttribute('aria-hidden','true');b.append(g);}
    const text=[...b.childNodes].filter(n=>n!==g&&!n.matches?.('svg')).map(n=>n.textContent||'').join('').trim();
    const glyph=(text.match(/[←→↶↷+−−×÷=?!⏺◎▶◀▲▼\d]/u)||[])[0]||[...(b.getAttribute('aria-label')||b.title||text||'◆')][0];
    if(g.textContent!==glyph)g.textContent=glyph;
  }
  function compactControl(b,on){
    const was=b.classList.contains('may-control-mini');
    if(on&&!was&&!b.classList.contains('may-standard'))b.dataset.mayControlStandard='1';
    b.classList.toggle('may-control-mini',on);
    if(!on){if(was){b.querySelectorAll('.may-mini-half-outline').forEach(s=>s.remove());if(b.dataset.mayControlStandard){b.classList.remove('may-standard');b.querySelector(':scope > .may-standard-outline')?.remove();delete b.dataset.mayControlStandard;}}return;}
    if(!b.title)b.title=b.getAttribute('aria-label')||b.textContent.trim();
    b.classList.add('may-standard');outline(b);
    const halves=[...b.querySelectorAll(':scope > .gz-half,:scope > .palette-half')];
    if(halves.length===2){b.classList.add('may-control-pair');halves.forEach((h,i)=>{miniGlyph(h);let s=h.querySelector(':scope > .may-mini-half-outline');if(!s){s=svg('may-mini-half-outline');s.setAttribute('viewBox','0 0 17 24');shape(s,'polygon',{points:i?'0,0 17,12 0,24':'17,0 17,24 0,12'});h.append(s);}});}else miniGlyph(b);
  }
  function syncControlMinis(){
    for(const el of document.querySelectorAll(':is('+controlSelector+'):not([data-no-mini], [data-no-mini] *)')){const b=controlTarget(el);if(!b||b!==el)continue;const k=controlKey(b);if(k)compactControl(b,controlMinis.has(k));}
  }
  document.addEventListener('contextmenu',e=>{const b=controlTarget(e.target);if(!b||!b.getClientRects().length)return;const k=controlKey(b);if(!k)return;e.preventDefault();e.stopImmediatePropagation();if(controlMinis.has(k))controlMinis.delete(k);else controlMinis.add(k);try{localStorage.setItem(MINI_KEY,JSON.stringify([...controlMinis]));}catch(_){}compactControl(b,controlMinis.has(k));refresh();dispatchEvent(new Event('resize'));},true);
  function libraryRows(){
    // v0.485: имя и четыре действия не помещаются в одну кнопку 120 px. Сохраняем сами кнопки и их onclick в двух парных строках.
    for(const card of document.querySelectorAll('#templateLibraryChoices > .template-entry')){
      const actions=card.querySelector(':scope > .template-entry-actions');if(!actions)continue;
      const record=document.createElement('div');record.className='template-record';card.before(record);record.append(card,actions);
      const buttons=[...actions.children],names=['Сохранить','Скачать','Цвет','Удалить'];
      buttons.forEach((b,i)=>{
        if(i%2===0){const pair=document.createElement('div');pair.className='gz-hx gz-pair gz-split template-actions-pair';pair.dataset.n='template-actions:'+card.querySelector('.gz-nm')?.textContent+':'+i/2;actions.append(pair);}
        b.classList.add('gz-half',i%2?'gz-h1':'gz-h0');
        const name=document.createElement('span');name.className='gz-nm';name.textContent=names[i]||b.title;b.append(name);actions.lastElementChild.append(b);
      });
    }
  }
  function refresh(){
    standardObserver?.disconnect();
    libraryRows();
    tintIcons();
    const ladders=[...document.querySelectorAll('.gz-ladder')];
    document.querySelectorAll('.may-options-owner').forEach(b=>{if(!ladders.some(l=>l.owner===b)){b.classList.remove('may-options-owner','may-standard-open');b.querySelector('.may-standard-roof')?.remove();}});
    document.querySelectorAll('#paintTools .gz-hx,#paintTools .pt-l,#mayatnikRail .gz-hx,#mayAbout,#mayHelp,#mayMenu,.gz-ladder .gz-hx,#mayatnikTemplatePanel .pt-r .gz-hx').forEach(b=>{
      if(b.closest('#mayInfoDiamond,.pt-btn')||b.closest('#mayBottomBar')&&!b.classList.contains('gz-head'))return;
      if(b.querySelector('#templateLibraryChoices'))return;   // v0.471: список шаблонов — не кнопка; кнопки — его записи (иначе список сжимался в одну строку 24 px и вылезал вверх)
      if(!b.classList.contains('may-standard'))b.classList.add('may-standard');outline(b);parts(b);if(b.closest('.gz-ladder')){keyboard(b);set(b,'aria-pressed',String(b.classList.contains('gz-on')));}
      const mini=b.matches('.gz-head')&&b.closest('.gz-mini')||b.matches('.pt-l')&&b.closest('.pt-mini')||b.id==='mayAbout'&&b.classList.contains('pt-mini');b.classList.toggle('may-standard-mini',!!mini);
    });
    syncControlMinis();
    for(const g of document.querySelectorAll('#paintTools > .pt-g,#paintTools > .gz-group,#mayatnikRail .gz-group')){
      const head=g.querySelector(':scope > .pt-l,:scope > .gz-head'),open=g.matches('.pt-open,.gz-open');if(!head)continue;
      if(g.classList.contains('pt-btn'))continue;
      head.classList.toggle('may-standard-open',open);if(!open)head.querySelector('.may-standard-roof')?.remove();
      const pin=head.querySelector('.pt-pin,.gz-pin');if(pin){keyboard(pin);set(pin,'aria-label','Закрепить группу');set(pin,'aria-pressed',String(g.matches('.pt-pinned,.gz-pinned')));}
      if(!head.dataset.mayMiniKeys){head.dataset.mayMiniKeys='1';let last=0;head.addEventListener('keydown',e=>{if(e.target===head&&(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10')){e.preventDefault();e.stopPropagation();last=performance.now();head.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,button:2}));}});head.addEventListener('contextmenu',e=>{if(e.button!==2&&performance.now()-last<500)e.stopImmediatePropagation();},true);}
      const host=g.querySelector(':scope > .pt-r,:scope > .may-rail-list')||g;
      if(open){
        if(host.classList.contains('pt-r')){const up=g.classList.contains('pt-bot'),max=Math.max(24,up?head.getBoundingClientRect().top-14:innerHeight-host.getBoundingClientRect().top-14);host.style.removeProperty('padding-top');host.style.removeProperty('padding-bottom');host.style.maxHeight=max+'px';const scroll=host.scrollHeight>max+1;host.style.overflowY=scroll?'auto':'visible';host.style.overflowX=scroll?'hidden':'visible';if(scroll)host.style.setProperty(up?'padding-top':'padding-bottom','14px','important');}
        // may-rail-list сохраняет обе оси overflow из syncRailFlyouts: hidden по X обрезал нижнюю скобку и при visible по Y.
        const cells=[...host.querySelectorAll('.may-standard,.gz-control')].filter(b=>{
          if(b.querySelector('#templateLibraryChoices'))return false;
          if(b.closest('#templateLibraryChoices'))return b.matches('.template-entry,.template-actions-pair');
          return !b.matches('.pt-l,.gz-head')&&!b.parentElement.closest('.gz-hx,.gz-control')&&!b.closest('.gz-ladder');
        });const hin=contour(host,cells,!!g.closest('#mayatnikRail'),head,g.classList.contains('pt-bot'));head.classList.toggle('may-head-in',hin);if(hin)head.querySelector('.may-standard-roof')?.remove();else roof(head,head.classList.contains('may-standard-mini'),g.classList.contains('pt-bot'));
        g.querySelector(':scope > .may-closed-back')?.remove();
      }else{host.querySelector(':scope > .may-standard-contours')?.remove();head.classList.remove('may-head-in');closedBack(g,head);}
      if(g.inert&&!g.querySelector('.may-el-covered'))g.inert=false;   // v0.452: группа целиком больше не гасится, гасятся элементы (may-el-covered)
    }
    for(const list of ladders){list.classList.add('may-standard-list');if(list.owner){list.owner.classList.add('may-options-owner','may-standard-open');roof(list.owner,list.owner.classList.contains('may-control-mini'));}contour(list,[...list.querySelectorAll(':scope > .gz-hx')],true);}
    standardObserver?.observe(document.body,{subtree:true,childList:true,attributes:true,attributeOldValue:true,attributeFilter:['class','disabled','aria-pressed','style']});
  }
  document.addEventListener('pointerdown',e=>{const b=e.target.closest('.may-standard-pair .gz-half');if(!b||e.button!==0)return;b.classList.add('may-standard-held');const stop=()=>{b.classList.remove('may-standard-held');removeEventListener('pointerup',stop);removeEventListener('pointercancel',stop);};addEventListener('pointerup',stop);addEventListener('pointercancel',stop);},true);
  // v0.451 (В11, КНП-018): кнопка или половина, выключенная щелчком мыши, не показывает рамку наведения, пока указатель не уйдёт (кнопки пересоздаются — узнаём по подписи)
  {
    let quiet=null;const SEL='.may-standard,.gz-half';
    const isOn=b=>b.matches('.on,.gz-on,[aria-pressed=true]');
    const id=b=>b.getAttribute('aria-label')||b.textContent.trim();
    const hov=t=>t?.closest?.(SEL);
    const was=new WeakMap();
    document.addEventListener('pointerdown',e=>{const b=hov(e.target);if(b&&e.button===0)was.set(b,isOn(b));},true);
    document.addEventListener('click',e=>{
      const b=hov(e.target);if(!b||!e.detail)return;const key=id(b),wasOn=was.get(b);
      requestAnimationFrame(()=>{const now=[...document.querySelectorAll(SEL)].find(x=>id(x)===key&&x.matches(':hover'))||b;
        if(wasOn&&!isOn(now)){quiet=key;document.body.classList.add('may-quiet-hover');}});
    });
    document.addEventListener('pointermove',e=>{if(!quiet)return;const b=hov(e.target);if(!b||id(b)!==quiet){quiet=null;document.body.classList.remove('may-quiet-hover');}});
  }
  window.mayButtonStandardRefresh=refresh;
  let refreshFrame=0;
  const requestRefresh=()=>{if(!refreshFrame)refreshFrame=requestAnimationFrame(()=>{refreshFrame=0;refresh();});};
  addEventListener('resize',requestRefresh);document.addEventListener('click',requestRefresh);document.addEventListener('change',requestRefresh);
  // Decorative SVG updates do not trigger another pass. Stable menu polling also stays a no-op.
  var standardObserver=new MutationObserver(records=>{if(records.some(r=>{
    const t=r.target.nodeType===3?r.target.parentElement:r.target;
    if(!t||t.closest?.('svg,[data-no-mini]')||!t.closest?.('#paintTools,#mayatnikRail,.gz-ladder,#mayatnikTemplatePanel'))return false;
    if(r.type==='attributes')return r.oldValue!==t.getAttribute(r.attributeName);
    return [...r.addedNodes,...r.removedNodes].some(n=>n.nodeType!==1||n.namespaceURI!==NS);
  }))requestRefresh();});
  refresh();
})();
