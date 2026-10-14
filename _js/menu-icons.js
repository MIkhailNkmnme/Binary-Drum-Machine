/* Значки ромбов в гроздях кнопок и подпись при наведении. v2.
   Подключается Синхрофазотроном, Синхроромбом и Зазеркалиусом (окно Зеркалиус).
   Трогает только кнопки-ромбы гроздей: .sfz-grape-item, кольца #ringTbl и .zerk-grape .zerk-diamond.
   Верхние и нижние полосы, левая панель и пульты страниц не меняются.
   - В ромбе со словесной подписью вместо текста рисуется значок (::after с маской, текст кнопки
     не трогаем: страницы переписывают textContent каждый кадр). Числа и значения остаются текстом.
   - При наведении поверх кнопки встаёт непрозрачный ромб вдвое шире с подписью; не влезает —
     подпись бежит строкой. Сама кнопка, раскладка и сохранённые координаты не меняются. */
(() => {
  const ITEMS = '.sfz-grape-item,#ringTbl button,.zerk-grape .zerk-diamond';
  const paths={play:'M9 6l9 6-9 6z',pause:'M9 6v12M15 6v12',back:'M16 6l-8 6 8 6M7 6v12',forward:'M8 6l8 6-8 6M17 6v12',plus:'M12 5v14M5 12h14',minus:'M5 12h14',reset:'M18 8a7 7 0 10.5 7M18 4v5h-5',save:'M6 5h12v14H6zM9 5v5h6V5M9 15h6v4',load:'M5 8h6l2 3h7l-3 8H5zM12 3v9M9 9l3 3 3-3',eye:'M3 12q9-12 18 0-9 12-18 0M15 12a3 3 0 11-6 0 3 3 0 016 0',axes:'M12 3v18M3 12h18M9 6l3-3 3 3M18 9l3 3-3 3',magnet:'M6 5v9a6 6 0 0012 0V5M6 9h3M15 9h3',cube:'M12 3l8 4v10l-8 4-8-4V7zM4 7l8 5 8-5M12 12v9',ball:'M20 12a8 8 0 11-16 0 8 8 0 0116 0M7 8l3-2',ring:'M20 12a8 8 0 11-16 0 8 8 0 0116 0M16 12a4 4 0 11-8 0 4 4 0 018 0',slit:'M4 5h16M4 12h6M14 12h6M4 19h16M12 8v8',sun:'M16 12a4 4 0 11-8 0 4 4 0 018 0M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',moon:'M15 3a9 9 0 100 18A10 10 0 0115 3',sound:'M5 9h4l5-4v14l-5-4H5zM17 8q5 4 0 8',field:'M4 4h16v16H4zM4 9h16M4 14h16M9 4v16M14 4v16',colour:'M12 3c12 0 12 14 6 14h-4l-2 4C0 21 0 3 12 3M7 8h.1M12 6h.1M17 8h.1M6 13h.1',lock:'M7 10V7a5 5 0 0110 0v3M5 10h14v11H5zM12 14v3',link:'M10 8l3-3a4 4 0 016 6l-3 3M14 16l-3 3a4 4 0 01-6-6l3-3M8 16l8-8',select:'M5 4l14 7-7 2-2 7z',record:'M18 12a6 6 0 11-12 0 6 6 0 0112 0',help:'M8 8a4 4 0 118 0c0 3-4 3-4 6M12 18v1',balance:'M12 4v16M5 8h14M6 8l-4 7h8zM18 8l-4 7h8zM8 20h8',mirror:'M12 3v18M4 7l5 5-5 5zM20 7l-5 5 5 5z',line:'M4 12h13M13 8l4 4-4 4M20 5v14',curve:'M4 12c3-7 6-7 8 0s5 7 8 0',copy:'M8 8h11v11H8zM5 16V5h11',image:'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.1',ringT:'M20 12a8 8 0 11-16 0 8 8 0 0116 0',ringN:'M12 4v5M20 12h-5M12 20v-5M4 12h5M14 12a2 2 0 11-4 0 2 2 0 014 0',ringCut:'M9 4a8 8 0 106 0M12 8v8M9 12h6',ringDouble:'M21 12a9 9 0 11-18 0 9 9 0 0118 0M17 12a5 5 0 11-10 0 5 5 0 0110 0',ringBetween:'M5 5l5 5M14 14l5 5M5 19l5-5M14 10l5-5M15 12a3 3 0 11-6 0 3 3 0 016 0',ringSym:'M12 3v18M9 5a7 7 0 000 14M15 5a7 7 0 010 14M6 12h12'};
  // Заголовки и ручки гроздей — не кнопки действий; у ромба с половинками ◂ ▸ (.zerk-split) половинки сами кнопки. Их не трогаем.
  const SKIP='.zerk-split,.sfz-fold-head,.ring-move,.grape-move,.smh,.pminbtn,.gfold,.sfz-book-cover,.sfz-book-direction,.gzen,.gon,.gx';
  const itemOf=t=>{const el=t?.closest?.(ITEMS);return el&&!el.matches(SKIP)?el:null;};
  const hash=s=>{let n=2166136261;for(const c of s)n=Math.imul(n^c.codePointAt(0),16777619);return n>>>0;};
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
  const words=s=>norm(s).replace(/^[^\p{L}\p{N}]+/u,'');
  // Число, градусы, счётчик — значение, а не действие: остаётся текстом.
  const isValue=el=>{const t=words(el.textContent);return !t||/^[-+−]?\d/.test(t);};
  const grapeOf=el=>el.closest('#ringTbl,.sfz-grape,.zerk-grape,.cgrp,.sol-plate');
  const keyOf=el=>el.id||((el.closest('.lseg')?.dataset.seg||grapeOf(el)?.dataset.g||grapeOf(el)?.id||'grape')+':'+(el.dataset.v??el.dataset.k??words(el.textContent)));
  function labelOf(el){const tip=norm(el.getAttribute('title')||el.dataset.zzTip||el.getAttribute('aria-label')||'').replace(/^[^\p{L}\p{N}]+/u,'').split(/\n| — |\. |;/)[0];return tip||words(el.textContent)||'Действие';}
  function kindOf(key,text){
    const mode=key.match(/(?:ringTbl|bConeSlits):(all|one|cut2|cutA|cutS|cut)(?:\s|$)/)?.[1];if(mode)return({all:'ringT',one:'ringN',cut:'ringCut',cut2:'ringDouble',cutA:'ringBetween',cutS:'ringSym'})[mode];
    const s=(key+' '+text).toLowerCase();
    return /stepb|назад/.test(s)?'back':/stepf|вперёд/.test(s)?'forward':/уменьш|minus/.test(s)?'minus':/увелич|plus/.test(s)?'plus':/пуск|запус|продолж|play/.test(s)?'play':/пауза|pause/.test(s)?'pause':/сброс|старт|снять|reset|clear/.test(s)?'reset':/png|картин|снимок/.test(s)?'image':/копи/.test(s)?'copy':/сохран|запомн|save/.test(s)?'save':/загруз|файл|load/.test(s)?'load':/гамм|цвет|color|pal/.test(s)?'colour':/магнит|mag/.test(s)?'magnet':/оси|ось|axes|axis/.test(s)?'axes':/кривая|кривой|цикл/.test(s)?'curve':/прям|линия|line/.test(s)?'line':/3d|тор|куб|гран|cube/.test(s)?'cube':/шар|ball/.test(s)?'ball':/щел|вырез|slit|cut/.test(s)?'slit':/солн|луч|sun|light/.test(s)?'sun':/лун|moon/.test(s)?'moon':/звук|sound/.test(s)?'sound':/замок|запер|lock/.test(s)?'lock':/цеп|link/.test(s)?'link':/запис|видео|rec/.test(s)?'record':/баланс|balance/.test(s)?'balance':/зеркал|сим|mirror/.test(s)?'mirror':/подсказ|help/.test(s)?'help':/строк|поле|сетка|field|grid/.test(s)?'field':/вид|показ|hide/.test(s)?'eye':/выдел|select/.test(s)?'select':'ring';
  }
  // Значок: только знак семейства действия, без меток по кругу (они выглядели рябью).
  function iconUrl(key,kind){
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[kind]}"/></svg>`;
    return 'url("data:image/svg+xml,'+encodeURIComponent(svg)+'")';
  }
  function decorate(el){
    if(el.matches(SKIP)||isValue(el)||el.querySelector('input[type=range],input[type=text],input[type=number],select,textarea')){if(el.classList.contains('mi-btn'))el.classList.remove('mi-btn');return;}
    const label=labelOf(el),key=keyOf(el),kind=kindOf(key,words(el.textContent)+' '+label),sig=kind;
    if(el.dataset.miSig!==sig){el.dataset.miSig=sig;el.style.setProperty('--mi-icon',iconUrl(key,kind));}
    if(!el.classList.contains('mi-btn'))el.classList.add('mi-btn');
  }
  const sync=()=>document.querySelectorAll(ITEMS).forEach(decorate);

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
