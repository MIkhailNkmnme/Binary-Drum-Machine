/* Значки ромбов в гроздях кнопок и подпись при наведении. v4.
   Подключается Синхрофазотроном, Синхроромбом и Зазеркалиусом (окно Зеркалиус).
   Трогает только кнопки-ромбы гроздей: .sfz-grape-item, кольца #ringTbl и .zerk-grape .zerk-diamond.
   Верхние и нижние полосы, левая панель и пульты страниц не меняются.
   - В ромбе со словесной подписью вместо текста рисуется значок (::after с маской, текст кнопки
     не трогаем: страницы переписывают textContent каждый кадр). Числа и значения остаются текстом.
   - При наведении поверх кнопки встаёт непрозрачный ромб вдвое шире с подписью; не влезает —
     подпись бежит строкой. Сама кнопка, раскладка и сохранённые координаты не меняются. */
(() => {
  const ITEMS = '.sfz-grape-item,#ringTbl button,.zerk-grape .zerk-diamond';
  const paths={play:'M9 6l9 6-9 6z',pause:'M9 6v12M15 6v12',back:'M16 6l-8 6 8 6M7 6v12',forward:'M8 6l8 6-8 6M17 6v12',plus:'M12 5v14M5 12h14',minus:'M5 12h14',reset:'M18 8a7 7 0 10.5 7M18 4v5h-5',save:'M6 5h12v14H6zM9 5v5h6V5M9 15h6v4',load:'M5 8h6l2 3h7l-3 8H5zM12 3v9M9 9l3 3 3-3',eye:'M3 12q9-12 18 0-9 12-18 0M15 12a3 3 0 11-6 0 3 3 0 016 0',axes:'M12 3v18M3 12h18M9 6l3-3 3 3M18 9l3 3-3 3',magnet:'M6 5v9a6 6 0 0012 0V5M6 9h3M15 9h3',cube:'M12 3l8 4v10l-8 4-8-4V7zM4 7l8 5 8-5M12 12v9',ball:'M20 12a8 8 0 11-16 0 8 8 0 0116 0M7 8l3-2',ring:'M20 12a8 8 0 11-16 0 8 8 0 0116 0M16 12a4 4 0 11-8 0 4 4 0 018 0',slit:'M4 5h16M4 12h6M14 12h6M4 19h16M12 8v8',sun:'M16 12a4 4 0 11-8 0 4 4 0 018 0M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',moon:'M15 3a9 9 0 100 18A10 10 0 0115 3',sound:'M5 9h4l5-4v14l-5-4H5zM17 8q5 4 0 8',field:'M4 4h16v16H4zM4 9h16M4 14h16M9 4v16M14 4v16',colour:'M12 3c12 0 12 14 6 14h-4l-2 4C0 21 0 3 12 3M7 8h.1M12 6h.1M17 8h.1M6 13h.1',lock:'M7 10V7a5 5 0 0110 0v3M5 10h14v11H5zM12 14v3',link:'M10 8l3-3a4 4 0 016 6l-3 3M14 16l-3 3a4 4 0 01-6-6l3-3M8 16l8-8',select:'M5 4l14 7-7 2-2 7z',record:'M18 12a6 6 0 11-12 0 6 6 0 0112 0',help:'M8 8a4 4 0 118 0c0 3-4 3-4 6M12 18v1',balance:'M12 4v16M5 8h14M6 8l-4 7h8zM18 8l-4 7h8zM8 20h8',mirror:'M12 3v18M4 7l5 5-5 5zM20 7l-5 5 5 5z',line:'M4 12h13M13 8l4 4-4 4M20 5v14',curve:'M4 12c3-7 6-7 8 0s5 7 8 0',copy:'M8 8h11v11H8zM5 16V5h11',image:'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.1',ringT:'M20 12a8 8 0 11-16 0 8 8 0 0116 0',ringN:'M12 4v5M20 12h-5M12 20v-5M4 12h5M14 12a2 2 0 11-4 0 2 2 0 014 0',ringCut:'M9 4a8 8 0 106 0M12 8v8M9 12h6',ringDouble:'M21 12a9 9 0 11-18 0 9 9 0 0118 0M17 12a5 5 0 11-10 0 5 5 0 0110 0',ringBetween:'M5 5l5 5M14 14l5 5M5 19l5-5M14 10l5-5M15 12a3 3 0 11-6 0 3 3 0 016 0',ringSym:'M12 3v18M9 5a7 7 0 000 14M15 5a7 7 0 010 14M6 12h12',
    // v3, «все значки кнопок везде различались»: запасные значки, когда в грозди значок семейства уже занят
    tri:'M12 4l8 15H4z',square:'M6 6h12v12H6z',hex:'M12 3l8 4.5v9L12 21l-8-4.5v-9z',star:'M12 3l2.6 6 6.4.5-4.9 4.2 1.5 6.3L12 16.6 6.4 20l1.5-6.3L3 9.5l6.4-.5z',cross:'M6 6l12 12M18 6L6 18',dots:'M6 12h1M11.5 12h1M17 12h1',wave:'M3 12q3-6 6 0t6 0 6 0',zigzag:'M3 15l4-6 4 6 4-6 4 6',spiral:'M12 12a2 2 0 012 2 4 4 0 01-4 4 6 6 0 01-6-6 8 8 0 018-8',swap:'M4 9h14l-3-3M20 15H6l3 3',target:'M12 3v4M12 17v4M3 12h4M17 12h4M15 12a3 3 0 11-6 0 3 3 0 016 0',nest:'M12 4l8 8-8 8-8-8zM12 9l3 3-3 3-3-3z',bars:'M6 18V10M12 18V6M18 18v-5',half:'M20 12a8 8 0 11-16 0 8 8 0 0116 0M12 4v16',sector:'M12 12V4M12 12h8M20 12a8 8 0 11-8-8',hourglass:'M7 4h10L7 20h10z',flag:'M6 21V4h11l-2 4 2 4H6',key:'M8 15a3 3 0 110-6 3 3 0 010 6M11 12h9M17 12v3M20 12v2',bolt:'M13 3L5 14h6l-1 7 8-11h-6z',drop:'M12 3c4 6 6 9 6 12a6 6 0 01-12 0c0-3 2-6 6-12',pin:'M12 21s-6-6-6-11a6 6 0 0112 0c0 5-6 11-6 11M14 10a2 2 0 11-4 0 2 2 0 014 0',corners:'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',steps:'M4 20v-5h5v-5h5V5h6',arc:'M4 18a8 8 0 0116 0M12 18v-6',grid4:'M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z',plusRing:'M20 12a8 8 0 11-16 0 8 8 0 0116 0M12 8v8M8 12h8',tilde:'M4 10q4-4 8 0t8 0M4 16q4-4 8 0t8 0',fork:'M12 21v-8M12 13L6 5M12 13l6-8',loop:'M7 16a4 4 0 010-8h10a4 4 0 010 8H7'};
  // Заголовки и ручки гроздей — не кнопки действий; у ромба с половинками ◂ ▸ (.zerk-split) половинки сами кнопки. Их не трогаем.
  const SKIP='.zerk-split,.sfz-fold-head,.ring-move,.grape-move,.smh,.pminbtn,.gfold,.sfz-book-cover,.sfz-book-direction,.gzen,.gon,.gx';
  const itemOf=t=>{const el=t?.closest?.(ITEMS);return el&&!el.matches(SKIP)?el:null;};
  const hash=s=>{let n=2166136261;for(const c of s)n=Math.imul(n^c.codePointAt(0),16777619);return n>>>0;};
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
  const words=s=>norm(s).replace(/^[^\p{L}\p{N}]+/u,'');
  // Число, градусы, счётчик — значение, а не действие: остаётся текстом. Число со словом («1 · авто», «0 изнутри», «01 биты») — уже подпись: значок
  // (v3, «нигде не надо текста в свёрнутых ромбах»).
  const isValue=el=>{const t=words(el.textContent);return !t||/^[-+−]?\d/.test(t)&&!/\p{L}{2}|\d\p{L}/u.test(t);};
  const grapeOf=el=>el.closest('#ringTbl,.sfz-grape,.zerk-grape,.cgrp,.sol-plate');
  const keyOf=el=>el.id||((el.closest('.lseg')?.dataset.seg||grapeOf(el)?.dataset.g||grapeOf(el)?.id||'grape')+':'+(el.dataset.v??el.dataset.k??words(el.textContent)));
  function labelOf(el){const tip=norm(el.getAttribute('title')||el.dataset.zzTip||el.getAttribute('aria-label')||'').replace(/^[^\p{L}\p{N}]+/u,'').split(/\n| — |\. |;/)[0];return tip||words(el.textContent)||'Действие';}
  const KINDS=[
    [/stepb|назад/,'back'],
    [/stepf|вперёд/,'forward'],
    [/уменьш|minus/,'minus'],
    [/увелич|plus/,'plus'],
    [/пуск|запус|продолж|play/,'play'],
    [/пауза|pause/,'pause'],
    [/сброс|старт|снять|reset|clear/,'reset'],
    [/png|картин|снимок/,'image'],
    [/копи/,'copy'],
    [/сохран|запомн|save/,'save'],
    [/загруз|файл|load/,'load'],
    [/гамм|цвет|color|pal/,'colour'],
    [/магнит|mag/,'magnet'],
    [/оси|ось|axes|axis/,'axes'],
    [/кривая|кривой|цикл/,'curve'],
    [/прям|линия|line/,'line'],
    [/3d|тор|куб|гран|cube/,'cube'],
    [/шар|ball/,'ball'],
    [/щел|вырез|slit|cut/,'slit'],
    [/солн|луч|sun|light/,'sun'],
    [/лун|moon/,'moon'],
    [/звук|sound/,'sound'],
    [/замок|запер|lock/,'lock'],
    [/цеп|link/,'link'],
    [/запис|видео|rec/,'record'],
    [/баланс|balance/,'balance'],
    [/зеркал|сим|mirror/,'mirror'],
    [/подсказ|help/,'help'],
    [/строк|поле|сетка|field|grid/,'field'],
    [/вид|показ|hide/,'eye'],
    [/выдел|select/,'select']];
  // Составные запасные: рамка × знак внутри — чтобы значков хватило на все кнопки страницы (их больше сотни)
  const FRAMES={o:'M21 12a9 9 0 11-18 0 9 9 0 0118 0',q:'M3.5 3.5h17v17h-17z',d:'M12 1.5L22.5 12 12 22.5 1.5 12z',h:'M12 2l9 5v10l-9 5-9-5V7z',s:'M6 3h12l3 9-3 9H6l-3-9z'};
  const MARKS={a:'M11 12h2',b:'M12 9v6M9 12h6',c:'M9.5 9.5l5 5M14.5 9.5l-5 5',e:'M8 12h8',f:'M12 8v8',g:'M14.5 12a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0',i:'M10 10h4v4h-4z',j:'M12 9l3 5H9z',k:'M10 9v6M14 9v6',l:'M12 15V9M9.5 11.5L12 9l2.5 2.5',m:'M12 9v6M9.5 12.5L12 15l2.5-2.5',n:'M9 15l6-6'};
  for(const [f,fp] of Object.entries(FRAMES))for(const [m,mp] of Object.entries(MARKS))paths['x'+f+m]=fp+mp;
  const SPARE=['tri','square','hex','star','cross','dots','wave','zigzag','spiral','swap','target','nest','bars','half','sector','hourglass','flag','key','bolt','drop','pin','corners','steps','arc','grid4','plusRing','tilde','fork','loop',...Object.keys(paths).filter(k=>k[0]==='x'&&k.length===3)];
  // Значки по смыслу, лучший первым; ringTbl — свои значки режимов
  function kindsOf(key,text){
    const mode=key.match(/(?:ringTbl|bConeSlits):(all|one|cut2|cutA|cutS|cut)(?:\s|$)/)?.[1];if(mode)return [({all:'ringT',one:'ringN',cut:'ringCut',cut2:'ringDouble',cutA:'ringBetween',cutS:'ringSym'})[mode]];
    const s=(key+' '+text).toLowerCase();
    return [...new Set(KINDS.filter(([r])=>r.test(s)).map(([,k])=>k).concat('ring'))];
  }
  // Значок: только знак семейства действия, без меток по кругу (они выглядели рябью).
  function iconUrl(key,kind){
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[kind]}"/></svg>`;
    return 'url("data:image/svg+xml,'+encodeURIComponent(svg)+'")';
  }
  // «Сейчас не действует: …» в подсказке — не про саму кнопку: значок берём по тексту и aria-label
  const kindLabel=el=>{const t=labelOf(el);return /^сейчас не действует/i.test(t)?norm(el.getAttribute('aria-label')||el.dataset.zzLabel||''):t;};
  function decorate(el,used=new Set(),page=new Map()){
    if(el.matches(SKIP)||el.matches('select,input,textarea,.sfz-grape-editor')||isValue(el)||el.querySelector('input[type=range],input[type=text],input[type=number],select,textarea')){if(el.classList.contains('mi-btn'))el.classList.remove('mi-btn');return;}
    const key=keyOf(el),label=kindLabel(el)||key,want=kindsOf(key,words(el.textContent)+' '+label),sense=label.toLowerCase().replace(/[\d①-⑳]+/g,'#').replace(/\s+/g,' ').trim(),free=k=>!used.has(k)&&!page.has(k),kind=page.get('='+sense)||want.find(free)||SPARE.find(free)||want.find(k=>!used.has(k))||SPARE.find(k=>!used.has(k))||want[0],sig=kind;used.add(kind);if(!page.has(kind))page.set(kind,sense);page.set('='+sense,kind);
    if(el.dataset.miSig!==sig){el.dataset.miSig=sig;el.style.setProperty('--mi-icon',iconUrl(key,kind));}
    if(!el.classList.contains('mi-btn'))el.classList.add('mi-btn');
  }
  // В одной грозди значки не повторяются: занятый значок уходит следующему по смыслу, затем запасному
  const sync=()=>{const used=new Map(),page=new Map();   // page: значок → смысл и смысл → значок. Смысл — подпись без номеров («цвет зеркала 1» = «цвет зеркала 3»): один смысл — один значок, разные — разные (v4)
    document.querySelectorAll(ITEMS).forEach(el=>{const g=grapeOf(el)||document.body;if(!used.has(g))used.set(g,new Set());decorate(el,used.get(g),page);});};

  /* ---------- Подпись при наведении ---------- */
  const rgba=s=>{const n=String(s).match(/[\d.]+/g)?.map(Number);if(!n||n.length<3)return [0,0,0,0];return s.startsWith('color(')?n.slice(0,3).map(v=>v*255).concat(n[3]??1):n.slice(0,3).concat(n[3]??1);};
  const over=(c,bg)=>c.slice(0,3).map((v,i)=>Math.round(v*c[3]+bg[i]*(1-c[3])));
  const lum=c=>c.slice(0,3).map(v=>(v/=255)<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const css=c=>`rgb(${c.join(',')})`;
  let pop=null,box=null,run=null,cur=null,pressed=false,raf=0;
  function build(){
    pop=document.createElement('div');pop.className='mi-pop';pop.setAttribute('aria-hidden','true');
    const fill=document.createElement('div');fill.className='mi-pop-fill';
    box=document.createElement('div');box.className='mi-pop-box';run=document.createElement('span');run.className='mi-pop-run';
    box.append(run);fill.append(box);pop.append(fill);document.body.append(pop);
  }
  function colours(el){
    const page=rgba(getComputedStyle(document.body).backgroundColor);const bg=page[3]?page:rgba(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()||'rgb(11,13,18)');
    const cs=getComputedStyle(el),be=getComputedStyle(el,'::before'),own=rgba(cs.backgroundColor),pre=rgba(be.backgroundColor),masked=be.maskImage&&be.maskImage!=='none';
    let edge,fill;
    if(masked||!pre[3]){edge=over(masked&&pre[3]?pre:own[3]?own:rgba(cs.color),bg);fill=over(own[3]?own:[0,0,0,0],bg);}
    else{edge=over(own[3]?own:pre,bg);fill=over(pre,bg);}
    // У Зеркалиуса фон ромба почти прозрачный: под подписью делаем его плотнее, но тем же цветом.
    if(lum(fill)<.02&&masked)fill=fill.map((v,i)=>Math.round(v*.7+edge[i]*.3));
    const ink=(Math.max(lum(fill),lum([238,241,246]))+.05)/(Math.min(lum(fill),lum([238,241,246]))+.05)>=(Math.max(lum(fill),lum(bg))+.05)/(Math.min(lum(fill),lum(bg))+.05)?'#eef1f6':css(bg);
    return {edge:css(edge),fill:css(fill),ink};
  }
  function place(){
    raf=0;if(!cur)return;if(!cur.isConnected||!cur.getClientRects().length){hide();return;}
    const r=cur.getBoundingClientRect(),w=r.width*2;let x=r.left-r.width/2;x=Math.max(0,Math.min(innerWidth-w,x));
    pop.style.left=x+'px';pop.style.top=r.top+'px';pop.style.width=w+'px';pop.style.height=r.height+'px';
    raf=requestAnimationFrame(place);
  }
  function show(el){
    if(pressed||!el||cur===el)return;hide();if(!pop)build();cur=el;
    const c=colours(el);pop.style.setProperty('--mi-edge',c.edge);pop.style.setProperty('--mi-fill',c.fill);pop.style.setProperty('--mi-ink',c.ink);
    run.textContent=labelOf(el);run.classList.remove('mi-run');pop.hidden=false;place();
    // Подпись шире видимой середины ромба — бегущая строка: от начала до конца и обратно, с остановками на краях.
    const room=box.clientWidth,need=run.scrollWidth;
    if(need>room+1){run.style.setProperty('--mi-to',(room-need)+'px');run.style.setProperty('--mi-time',(.8+(need-room)/75).toFixed(2)+'s');run.classList.add('mi-run');}
  }
  function hide(){if(!cur)return;cur=null;if(raf)cancelAnimationFrame(raf);raf=0;if(pop)pop.hidden=true;}

  function boot(){
    sync();
    let t=0;new MutationObserver(()=>{if(!t)t=requestAnimationFrame(()=>{t=0;sync();});}).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','class']});
    document.addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const el=itemOf(e.target);if(el)show(el);},true);
    document.addEventListener('pointerout',e=>{if(cur&&!cur.contains(e.relatedTarget))hide();},true);
    document.addEventListener('pointerdown',()=>{pressed=true;hide();},true);
    document.addEventListener('pointerup',e=>{pressed=false;if(e.pointerType!=='touch'){const el=itemOf(e.target);if(el)requestAnimationFrame(()=>show(el));}},true);
    document.addEventListener('pointercancel',()=>{pressed=false;hide();},true);
    document.addEventListener('focusin',e=>{if(e.target.matches?.(':focus-visible')&&itemOf(e.target)===e.target)show(e.target);},true);
    document.addEventListener('focusout',hide,true);addEventListener('blur',()=>{pressed=false;hide();});
    addEventListener('wheel',hide,{passive:true,capture:true});
  }
  window.ZerkMenuIcons={version:1,sync,labelOf};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
