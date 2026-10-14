/* Shared grape menus, docking, menu bars and tempo control. v1. */
let sfzWeaveFrame=0, sfzWeaveLast="", sfzGrapeEdgeReady=false;
function sharedMenuTextWidth(button,range){return range.getBoundingClientRect().width/(button.classList.contains('shared-menu-hover')?2:1);}

// Each action has one icon identity across every page; page-specific handlers stay on their controls.
(() => {
  const roots='.cgrp,.sol-plate,.zerk-grape,#ringTbl,#coneViewTools,#coneBalanceTools,#coneAlignTools,#coneMagAxisTools,#c3Modes,#coneTransportTempo,#sfzSettingsMenus,#coneRecBar,#top';
  const controls='#top button,#coneRecBar button,#w-cone button,#w-cone [role=button],#w-cone label:has(input[type=checkbox],input[type=radio]),#paneGrp button,#paneGrp label:has(input[type=checkbox],input[type=radio]),#rowsPane button,#rowInputBar button,#sfzSettingsDock button,#sfzSettingsMenus summary,.zerk-grape button,.zerk-grape label:has(input[type=checkbox],input[type=radio]),#zerkZoom button,#zerkMotion button,#zerkMotion label:has(input[type=checkbox])';
  const palette={вид:'#38bdf8','3d':'#a78bfa',кольца:'#2dd4bf',кручение:'#fbbf24',грани:'#fb923c',шарики:'#f87171',аниматрица:'#c084fc',звук:'#4ade80',лазер:'#f472b6','☀ · ☾':'#fde047','строка 1':'#d6a275',щели:'#818cf8','за чертой':'#a3e635',алгоритм:'#60a5fa','алг. · подск.':'#94a3b8',дзен:'#34d399',ромб:'#22d3ee',ringTbl:'#14b8a6',coneViewTools:'#0ea5e9',coneBalanceTools:'#f59e0b',coneAlignTools:'#84cc16',coneMagAxisTools:'#f43f5e',c3Modes:'#e879f9',coneTransportTempo:'#8b5cf6',sfzSettingsMenus:'#facc15',coneRecBar:'#ef4444',top:'#64748b',zerkRowsG:'#bef264',zerkViewG:'#93c5fd',zerkMirrorG1:'#5eead4',zerkMirrorG2:'#fcd34d',zerkMirrorG3:'#fda4af'};
  const paths={play:'M9 6l9 6-9 6z',pause:'M9 6v12M15 6v12',back:'M16 6l-8 6 8 6M7 6v12',forward:'M8 6l8 6-8 6M17 6v12',plus:'M12 5v14M5 12h14',minus:'M5 12h14',reset:'M18 8a7 7 0 10.5 7M18 4v5h-5',save:'M6 5h12v14H6zM9 5v5h6V5M9 15h6v4',load:'M5 8h6l2 3h7l-3 8H5zM12 3v9M9 9l3 3 3-3',eye:'M3 12q9-12 18 0-9 12-18 0M15 12a3 3 0 11-6 0 3 3 0 016 0',axes:'M12 3v18M3 12h18M9 6l3-3 3 3M18 9l3 3-3 3',magnet:'M6 5v9a6 6 0 0012 0V5M6 9h3M15 9h3',cube:'M12 3l8 4v10l-8 4-8-4V7zM4 7l8 5 8-5M12 12v9',ball:'M20 12a8 8 0 11-16 0 8 8 0 0116 0M7 8l3-2',ring:'M20 12a8 8 0 11-16 0 8 8 0 0116 0M16 12a4 4 0 11-8 0 4 4 0 018 0',slit:'M4 5h16M4 12h6M14 12h6M4 19h16M12 8v8',sun:'M16 12a4 4 0 11-8 0 4 4 0 018 0M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',moon:'M15 3a9 9 0 100 18A10 10 0 0115 3',sound:'M5 9h4l5-4v14l-5-4H5zM17 8q5 4 0 8',field:'M4 4h16v16H4zM4 9h16M4 14h16M9 4v16M14 4v16',colour:'M12 3c12 0 12 14 6 14h-4l-2 4C0 21 0 3 12 3M7 8h.1M12 6h.1M17 8h.1M6 13h.1',lock:'M7 10V7a5 5 0 0110 0v3M5 10h14v11H5zM12 14v3',link:'M10 8l3-3a4 4 0 016 6l-3 3M14 16l-3 3a4 4 0 01-6-6l3-3M8 16l8-8',select:'M5 4l14 7-7 2-2 7z',record:'M18 12a6 6 0 11-12 0 6 6 0 0112 0',help:'M8 8a4 4 0 118 0c0 3-4 3-4 6M12 18v1',balance:'M12 4v16M5 8h14M6 8l-4 7h8zM18 8l-4 7h8zM8 20h8',mirror:'M12 3v18M4 7l5 5-5 5zM20 7l-5 5 5 5z'};
  Object.assign(paths,{ringT:'M20 12a8 8 0 11-16 0 8 8 0 0116 0',ringN:'M12 4v5M20 12h-5M12 20v-5M4 12h5M14 12a2 2 0 11-4 0 2 2 0 014 0',ringCut:'M9 4a8 8 0 106 0M12 8v8M9 12h6',ringDouble:'M21 12a9 9 0 11-18 0 9 9 0 0118 0M17 12a5 5 0 11-10 0 5 5 0 0110 0',ringBetween:'M5 5l5 5M14 14l5 5M5 19l5-5M14 10l5-5M15 12a3 3 0 11-6 0 3 3 0 016 0',ringSym:'M12 3v18M9 5a7 7 0 000 14M15 5a7 7 0 010 14M6 12h12'});
  const hash=s=>{let n=2166136261;for(const c of s)n=Math.imul(n^c.codePointAt(0),16777619);return n>>>0;};
  const normalize=s=>String(s||'').replace(/\s+/g,' ').trim();
  const textOf=el=>normalize(el.textContent);
  const groupKey=el=>{const group=el.closest(roots);return group?.dataset.g||group?.id||'page-controls';};
  const keyOf=el=>el.id||((el.closest('.lseg')?.dataset.seg||el.closest('.zerk-range-wrap')?.querySelector('input')?.id||groupKey(el))+':'+(el.dataset.v??el.dataset.k??(el.getAttribute('aria-label')||el.title||textOf(el))));
  function kindOf(key,text,on){const mode=key.match(/(?:ringTbl|bConeSlits):(all|one|cut2|cutA|cutS|cut)(?:\s|$)/)?.[1];if(mode)return({all:'ringT',one:'ringN',cut:'ringCut',cut2:'ringDouble',cutA:'ringBetween',cutS:'ringSym'})[mode];const s=(key+' '+text).toLowerCase();return /stepb|ringl|spinl|назад/.test(s)?'back':/stepf|ringr|spinr|вперёд/.test(s)?'forward':/zoomout|уменьш|minus/.test(s)?'minus':/zoomin|увелич|plus/.test(s)?'plus':/auto|play|пуск|запус|запуст|продолж/.test(s)?(on?'pause':'play'):/pause|пауза/.test(s)?'pause':/reset|clear|сброс|старт|снять/.test(s)?'reset':/save|сохран|запомн/.test(s)?'save':/load|загруз|файл/.test(s)?'load':/pal|гамм|color|цвет/.test(s)?'colour':/магнит|mag/.test(s)?'magnet':/axes|axis|ось|оси/.test(s)?'axes':/3d|тор|cube|гран/.test(s)?'cube':/ball|шар/.test(s)?'ball':/slit|cut|щел|вырез/.test(s)?'slit':/sun|солн|луч|light/.test(s)?'sun':/moon|лун/.test(s)?'moon':/sound|звук/.test(s)?'sound':/lock|замок|запер/.test(s)?'lock':/link|цеп/.test(s)?'link':/rec|запис|видео/.test(s)?'record':/balance|баланс/.test(s)?'balance':/mirror|зеркал/.test(s)?'mirror':/help|подсказ/.test(s)?'help':/field|строк|сетка|grid/.test(s)?'field':/вид|показ|hide/.test(s)?'eye':/выдел|select/.test(s)?'select':'ring';}
  function icon(key,kind='ring'){
    // The perimeter encodes the action key, so two controls in one family still have different marks.
    const n=hash(key),bits=[];for(let i=0;i<32;i++)if((n>>>i)&1){const a=i*Math.PI/16,x=Math.cos(a),y=Math.sin(a);bits.push(`M${(12+9.6*x).toFixed(2)} ${(12+9.6*y).toFixed(2)}l${(1.8*x).toFixed(2)} ${(1.8*y).toFixed(2)}`);}
    return '<svg class="shared-menu-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path class="menu-action-mark" stroke-width=".8" d="'+bits.join(' ')+'"/><path stroke-width="1.9" d="'+paths[kind]+'"/></svg>';
  }
  function labelOf(el){const labels={coneTempoToggle:'Пуск / пауза',bC3StepB:'Шаг назад',bC3StepF:'Шаг вперёд',bC3Reset:'Сброс положения',bConeStartBack:'К старту',bC3ZoomOut:'Уменьшить масштаб',bC3ZoomIn:'Увеличить масштаб',bUndo:'Отменить',bRedo:'Повторить'};if(labels[el.id])return labels[el.id];const raw=textOf(el),caption=el.dataset.zzTip||el.title||el.getAttribute('aria-label')||raw;const s=normalize(caption).replace(/^[^\p{L}\p{N}]+/u,'').split(/\n| — |\. |;/)[0];return s.slice(0,48)||(/^[◂◀−-]+$/.test(raw)?'Уменьшить':/^[▸▶+]+$/.test(raw)?'Увеличить':'Действие');}
  function rgba(s){if(/^#[\da-f]{6}$/i.test(s))return [1,3,5].map(i=>parseInt(s.slice(i,i+2),16)/255).concat(1);const n=s.match(/[\d.]+/g)?.map(Number);if(!n||n.length<3)return [0,0,0,0];return s.startsWith('color(')?n.slice(0,3).concat(n[3]??1):n.slice(0,3).map(v=>v/255).concat(n[3]??1);}
  const luminance=c=>c.slice(0,3).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((v,n,i)=>v+n*[.2126,.7152,.0722][i],0);
  let theme={bg:[.09,.1,.15,1],fg:[.93,.95,.97,1],key:''};
  function tone(el){const flag=el.className+'|'+el.matches(':has(input:checked)')+'|'+!!el.disabled+'|'+theme.key+'|'+(el.closest(roots)?.dataset.menuColour||'');if(el._menuTone===flag)return;el._menuTone=flag;const before=getComputedStyle(el,'::before');let c=before.maskImage==='none'?rgba(before.backgroundColor):[0,0,0,0];if(!c[3])c=rgba(getComputedStyle(el).backgroundColor);const bg=luminance(c.map((v,i)=>i<3?v*c[3]+theme.bg[i]*(1-c[3]):1)),fg=luminance(theme.fg),dark=luminance(theme.bg);const contrast=l=>(Math.max(bg,l)+.05)/(Math.min(bg,l)+.05);el.style.setProperty('--menu-ink',contrast(fg)>=contrast(dark)?'var(--txt,#eef1f6)':'var(--bg,#171b26)');}
  function decorate(el){
    if(!el?.matches('button,summary,[role=button],label:has(input[type=checkbox],input[type=radio])')||el.matches('.sfz-fold-head,.ring-move,.grape-move,.smh,.pminbtn,.gfold,.sfz-book-cover,.sfz-book-direction,.gzen,.gon,.gx')||el.closest('.zerk-grape .smh')||el.querySelector('input[type=range],input[type=text],input[type=number],input[type=color],select,textarea'))return;
    const key=keyOf(el),label=labelOf(el),kind=kindOf(key+' '+el.className,label,el.classList.contains('on')||el.getAttribute('aria-pressed')==='true');
    if(el.dataset.menuKey!==key)el.dataset.menuKey=key;if(el.dataset.menuLabel!==label)el.dataset.menuLabel=label;
    if(!el.getAttribute('aria-label'))el.setAttribute('aria-label',el.title||label);
    if(!el.classList.contains('shared-menu-button'))el.classList.add('shared-menu-button');
    let svg=el.querySelector(':scope > .shared-menu-icon');const signature=key+'|'+kind;
    if(!svg||svg.dataset.signature!==signature){if(svg)svg.remove();el.insertAdjacentHTML('beforeend',icon(key,kind));svg=el.querySelector(':scope > .shared-menu-icon');svg.dataset.signature=signature;}
    tone(el);
  }
  function colourGroups(){const seen=new Map();for(const group of document.querySelectorAll(roots)){const key=group.dataset.g||group.id;if(!key)continue;let colour=palette[key]||palette[group.id]||`hsl(${hash(key)%360} 72% 68%)`;while(seen.has(colour)&&seen.get(colour)!==key)colour=`hsl(${(hash(key)+seen.size*137)%360} 72% 68%)`;seen.set(colour,key);if(group.style.getPropertyValue('--gc')!==colour)group.style.setProperty('--gc',colour,'important');if(group.dataset.menuColour!==colour)group.dataset.menuColour=colour;group.style.setProperty('--menu-group-colour',colour);for(const head of group.querySelectorAll(':scope > .cgb > .sfz-fold-head,:scope > .ring-handles > .ring-move,:scope > .smh')){const bg=`color-mix(in srgb, ${colour} 34%, var(--bg))`;if(head.style.getPropertyValue('background')!==bg)head.style.setProperty('background',bg,'important');}}}
  let hovered=null,pressed=false;
  function hide(){if(!hovered)return;const {el,transform,z,origin}=hovered;el.classList.remove('shared-menu-hover');for(const [property,value] of [['transform',transform],['z-index',z],['transform-origin',origin]]){if(value)el.style.setProperty(property,value[0],value[1]);else el.style.removeProperty(property);}hovered=null;}
  const oldStyle=(el,k)=>el.style.getPropertyValue(k)?[el.style.getPropertyValue(k),el.style.getPropertyPriority(k)]:null;
  function show(el){if(pressed||hovered?.el===el||!el?.classList.contains('shared-menu-button'))return;hide();const r=el.getBoundingClientRect(),base=getComputedStyle(el).transform;hovered={el,transform:oldStyle(el,'transform'),z:oldStyle(el,'z-index'),origin:oldStyle(el,'transform-origin')};el.style.setProperty('transform-origin',r.left<r.width/2?'left center':r.right+r.width/2>innerWidth?'right center':'center','important');el.style.setProperty('transform',(base==='none'?'':base+' ')+'scaleX(2)','important');el.style.setProperty('z-index','2147483647','important');el.classList.add('shared-menu-hover');}
  let pending=false;
  function sync(){pending=false;const style=getComputedStyle(document.documentElement),bg=style.getPropertyValue('--bg').trim(),fg=style.getPropertyValue('--txt').trim();theme={bg:rgba(bg),fg:rgba(fg),key:bg+'|'+fg};colourGroups();document.querySelectorAll(controls).forEach(decorate);}
  function schedule(){if(!pending){pending=true;requestAnimationFrame(sync);}}
  function boot(){
    // Generated segment buttons are created by page initialization; normalize them once it finishes.
    requestAnimationFrame(()=>{document.querySelectorAll('.sfz-grape').forEach(g=>sfzGrapeSync(g));sync();});
    new MutationObserver(records=>{if(records.some(r=>{if(r.type==='attributes'&&r.oldValue===r.target.getAttribute(r.attributeName))return false;return r.target.closest?.('.shared-menu-button')||r.type==='attributes'&&(r.target.matches?.(roots)||r.target===document.body||r.target===document.documentElement)||[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.(roots)||n.querySelector?.('button')));}))schedule();}).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeOldValue:true,attributeFilter:['class','hidden','disabled','aria-pressed']});
    document.addEventListener('pointerover',e=>{if(e.pointerType!=='touch')show(e.target.closest('.shared-menu-button'));},true);
    document.addEventListener('pointerout',e=>{if(hovered&&!hovered.el.contains(e.relatedTarget))hide();},true);
    document.addEventListener('pointerdown',e=>{if(e.isTrusted){pressed=true;hide();}},true);
    document.addEventListener('pointerup',e=>{pressed=false;if(e.pointerType!=='touch')queueMicrotask(()=>{const el=e.target.closest('.shared-menu-button'),group=el?.closest('.cgrp,.sol-plate');if(el?.isConnected&&performance.now()>=(group?._solDragUntil||0)&&el.getClientRects().length)show(el);});},true);
    document.addEventListener('pointercancel',()=>{pressed=false;hide();},true);
    document.addEventListener('focusin',e=>{if(e.target.matches?.(':focus-visible'))show(e.target);},true);
    document.addEventListener('focusout',hide,true);addEventListener('blur',()=>{pressed=false;hide();});
  }
  const setCaption=(el,value)=>{value=String(value);if(el.textContent!==value){el.textContent=value;decorate(el);}};
  window.ZerkMenus={version:1,decorate,sync,icon,groupPalette:palette,keyOf,setCaption};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

function coneArtBlocksButton(e){
  const button = e.target && e.target.closest && e.target.closest("button"), layer = document.getElementById("coneTopArt");
  if (!button || !button.closest("#w-cone") || button.classList.contains("shared-menu-button") || button.closest(".sfz-grape,#coneRecBar,#coneViewTools,#coneBalanceTools,#coneAlignTools,#coneMagAxisTools,#ringTbl,#c3Modes,#coneTapeBox,#coneTransportStart,#coneTransportTempo") || button.id === "bC3Axes" || button.id === "bC3Reset" || button.classList.contains("c3zoom") || !layer || layer.hidden) return;
  const r = layer.getBoundingClientRect(); if (!r.width || !r.height || e.clientX < r.left || e.clientX >= r.right || e.clientY < r.top || e.clientY >= r.bottom) return;
  const x = Math.max(0, Math.min(layer.width - 1, Math.floor((e.clientX - r.left) * layer.width / r.width))), y = Math.max(0, Math.min(layer.height - 1, Math.floor((e.clientY - r.top) * layer.height / r.height)));
  try { if (layer.getContext("2d").getImageData(x, y, 1, 1).data[3] < 24) return; }
  catch (err) { return; }
  e.preventDefault(); e.stopImmediatePropagation();
}

function cgrpInit(){
  const tl = document.querySelector("#w-cone .wbody > .tools"); if (!tl) return;
  if(typeof cutGroupBuild === "function")cutGroupBuild();   // v0.039
  sunPanelMergeLayout();
  if (!Z.cgrpPos || typeof Z.cgrpPos !== "object") Z.cgrpPos = {};
  if (!Z.cgrpEdge || typeof Z.cgrpEdge !== "object") Z.cgrpEdge = {};
  if (!Z.cgrpMin || typeof Z.cgrpMin !== "object") Z.cgrpMin = {};   // v0.204: свёрнутые до заголовка
  if (!Z.cgrpSize || typeof Z.cgrpSize !== "object") Z.cgrpSize = {};   // v0.315: размер, заданный уголком { имя: { w, h } }
  /* v0.348, «наборы кнопок — кроме тех, что только для конуса (кручение, кольца), — если переместить целиком на поле строк, то дать туда
     попасть, если частью — то так же, как сейчас»: группа, отпущенная ЦЕЛИКОМ над полем строк, встаёт поверх поля (.cfld, position: fixed)
     и ездит вместе с ним (ширина поля, панель, окно). Место — Z.cgrpFld { имя: { x, y } } от угла поля. Частью — как прежде: над холстом,
     прижатая к окну конуса. Назад — вытащить с поля или правый щелчок по заголовку. Кольца и Кручение на поле не встают. Поле спрятано,
     дзен или страница одного конуса — группа на полосе конуса, место на поле помнится */
  if (!Z.cgrpFld || typeof Z.cgrpFld !== "object") Z.cgrpFld = {};
  // v0.954: на поле строк встают все группы, и «Кольца» с «Кручением»; площадки — solZoneRect / solZoneOf (и левая панель)
  // v0.315: размер группы — уголком; у свёрнутой (cmin) — свой, до заголовка
  /* v0.332, по снимку группы «Вид», сжатой уголком до одной подписи, — «кнопки, если не помещаются в группе, — не давать размера»: группа
     не уже самой широкой кнопки и не ниже, чем нужно её кнопкам при этой ширине. Сохранённый размер не переписывается — меньший просто
     показывается нужным, а запоминается то, что видно, когда уголок отпустили. */
  const sizeApply = (g) => {
    if (sfzColumnGroup(g)) { sfzColumnSize(g); tzcOff(g); tzgFrame(g); return; }
    if (document.body.classList.contains("sol-mobile")) { tzcOff(g); return; }
    { const s0 = Z.cgrpSize[g.dataset.g]; if (s0 && s0.w > Math.max(screen.availWidth || 0, window.innerWidth, 800)) { delete Z.cgrpSize[g.dataset.g]; save(); } }   // v0.505: шире экрана — сбой (см. ручку), размер снят
    const s = !g.classList.contains("cmin") && Z.cgrpSize[g.dataset.g]; g.classList.toggle("csz", !!s);
    if (!s) { g.style.width = g.style.height = ""; if (typeof tzcApply === "function") tzcApply(g); return; }
    g.style.width = Math.max(tzSzW(g, s.w), tzMinW(g)) + "px"; g.style.height = "";   // v0.334: высота — всегда по кнопкам; v0.480 — и не уже самого широкого блока
    if (typeof tzcApply === "function") tzcApply(g);   // v0.453: группа-конструктор переносит ряды рисунка под новую ширину
    if (typeof tzgFrame === "function") tzgFrame(g);   // v0.482: рамка — сразу под новый размер (иначе угол с ручкой-ромбом на миг вне рамки и не хватается)
    const b = g.querySelector(":scope > .cgb"); if (!b) return;
    if (b.scrollWidth > b.clientWidth + 1) g.style.width = (tzSzW(g, s.w) + b.scrollWidth - b.clientWidth) + "px";   // не уже самой широкой кнопки
    /* v0.334, «не давать размера больше, если пустые области появляются»: ширина прижимается к правому краю самого длинного ряда кнопок —
       справа пустого места нет, и шире, чем все кнопки в один ряд, группа не становится */
    const br = b.getBoundingClientRect(); let right = br.left;
    for (const c of b.children) { if (c.classList.contains("cgnl")) continue; const r = c.getBoundingClientRect(); if (r.width) right = Math.max(right, r.right); }   // v0.825: перенос строки (во всю ширину) — не кнопка: с ним ширина росла сама
    const extra = Math.floor(br.right - right - 1); if (right > br.left && extra > 0) g.style.width = (parseFloat(g.style.width) - extra) + "px";
  };
  const NOGRAB = "button, [role=button], input, select, textarea, label, a, canvas, .gzen, .cgsz";   // v0.1016: строки выбора вида колец — кнопки, их щелчок не захватывает перенос группы
  const wb = tl.parentElement;
  const groups = [...tl.querySelectorAll(":scope > .cgrp")];
  wb.closest(".win")._solFoldLayout = changed => {
    const local = changed.filter(g => groups.includes(g)); if (!local.length) return;
    cgbSnap(false); local.forEach(sizeApply); cgrpCols(); local.forEach(place);
  };
  const panels = () => [...groups, ...Object.keys(SOL_PLATES).map(id => document.getElementById(id)).filter(Boolean)];
  // v0.046: щелчок по кнопке и фокус поднимают всю панель, включая таблицы.
  let panelOrder = panels();
  const frontPanel = el => {
    panelOrder = panelOrder.filter(p => p.isConnected && p !== el);
    if (el) panelOrder.push(el);
    panelOrder.forEach((p,i)=>{if(sfzColumnGroup(p)||p.id==="ringTbl")p.style.removeProperty("z-index");else p.style.setProperty("z-index",String(2147483501+i),"important");});
    panelOrder.forEach(p=>p.classList.toggle("sfz-panel-front",p===el && sfzColumnGroup(p)));
  };
  frontPanel(groups.find(g=>!Z.cgrpMin?.[g.dataset.g] && g.getClientRects().length) || null);
  const activatePanel = e => {
    const panel = e.target.closest && e.target.closest(".cgrp, .sol-plate");
    if (panel && panel.closest("#w-cone, #paneGrp")) frontPanel(panel);
  };
  document.addEventListener("pointerdown", activatePanel, true);
  document.addEventListener("mouseover", e => { if (e.target.closest(".sfz-grape-item,.sfz-grape > .glab,.sfz-fold-head")) activatePanel(e); }, true);
  document.addEventListener("focusin", activatePanel, true);
  const onCanvas = g => SOL_PLATES[g.id] ? g.parentElement === wb : g.parentElement === tl;
  const zrec = g => SOL_PLATES[g.id] ? Z[SOL_PLATES[g.id].fld] : Z.cgrpFld[g.dataset.g];   // v0.954: место на площадке (поле строк, левая панель)
  window.zzAxisPanels = () => panels().filter(onCanvas);
  const nodePin = g => SOL_PLATES[g.id] ? Z[SOL_PLATES[g.id].pin] : Z.cgrpPin && Z.cgrpPin[g.dataset.g];
  const nodeUnpin = g => { if (Z.cgrpTop) delete Z.cgrpTop[g.dataset.g]; if (Z.cgrpEdge) delete Z.cgrpEdge[g.dataset.g]; if (SOL_PLATES[g.id]) delete Z[SOL_PLATES[g.id].pin]; else if (Z.cgrpPin) delete Z.cgrpPin[g.dataset.g]; };
  const nodePlace = g => { if (SOL_PLATES[g.id]) platePlace(g); else place(g); };
  const nodeSetPos = (g, x, y) => {
    const c = SOL_PLATES[g.id];
    const f = zrec(g), fr = f && solZoneRect(f.z); if (fr) { f.x = x - fr.left; f.y = y - fr.top; return; }   // v0.954: на площадке — от её угла
    if (c) { const hr = wb.getBoundingClientRect(); Z[c.xy] = [x - hr.left + wb.scrollLeft, y - hr.top + wb.scrollTop]; }
    else {
      const tr=tl.getBoundingClientRect(), key=g.dataset.g;
      Z.cgrpPos[key]={x:x-tr.left,y:y-tr.top};
      if(Z.sfzBookUp?.[key]){Z.sfzBookBottom ||= {};Z.sfzBookBottom[key]={x:x-tr.left,y:y-tr.top+g.offsetHeight};}
    }
  };
  /* v0.238, по снимку групп «Аниматрица», «Лазер», «Кручение» — «все кнопки разъехались — компактными, и размер стандартизируй»: кнопки
     группы — в своём блоке .cgb рядом с подписью (подпись — хват во всю высоту, как было), блок переносится компактно; размеры — в CSS. */
  groups.forEach((g) => {
    if (g.querySelector(":scope > .cgb")) return;
    const b = document.createElement("div"); b.className = "cgb";
    [...g.childNodes].forEach((c) => { if (!(c.nodeType === 1 && c.classList.contains("glab"))) b.appendChild(c); });
    g.appendChild(b);
  });
  /* v0.760, «подсказки не на всех кнопках — они там просто одинаковые для всей группы Лазер… и другие»: подсказка группы висела на всей группе и всплывала
     везде, где мышь не над кнопкой, — в просветах и на срезанных краях шестигранников (там мышь уже «в группе»). Теперь она — только на заголовке группы:
     над кнопкой — подсказка кнопки, над заголовком — что это за группа, в просветах — ничего */
  groups.forEach((g) => { const lab = g.querySelector(":scope > .glab"); if (!g.title) return; if (lab) lab.title = g.title + (lab.title ? "\n\n" + lab.title : ""); g.removeAttribute("title"); });
  // v0.320: значок ползунка (текст перед ним в метке: ↕ ▬ ♩ 🔊 щель) — в свой span.sli, чтобы встать столбцом одной ширины
  groups.forEach((g) => g.querySelectorAll("label").forEach((l) => {
    if (!l.querySelector("input[type=range]")) return;
    const f = l.firstChild; if (!f || f.nodeType !== 3 || !f.textContent.trim()) return;
    const sp = document.createElement("span"); sp.className = "sli"; sp.textContent = f.textContent.trim(); l.replaceChild(sp, f);
  }));
  /* v0.327, по снимку «256 стр. · сид 1» — «текст убрать в поля»: подпись у числового / текстового поля группы — внутри самого поля:
     что стояло перед полем (сид, от, ↔, ⌖×) — слева в нём (.fpre), что после (стр., °) — справа (.fpost); поле отступает под них */
  groups.forEach((g) => g.querySelectorAll("label").forEach((l) => {
    const inp = l.querySelector("input[type=number], input[type=text]"); if (!inp || l.querySelector("input[type=range], input[type=checkbox]")) return;
    const pre = [], post = []; let after = false;
    [...l.childNodes].forEach((n) => { if (n === inp) after = true; else if (n.nodeType === 3 && n.textContent.trim()) (after ? post : pre).push(n); });
    if (!pre.length && !post.length) return;
    const mk = (nodes, cls) => { if (!nodes.length) return 0; const t = nodes.map(n => n.textContent.trim()).join(" "); nodes.forEach(n => n.remove()); const sp = document.createElement("span"); sp.className = cls; sp.textContent = t; l.appendChild(sp); return [...t].length; };
    const a = mk(pre, "fpre"), b = mk(post, "fpost"); l.classList.add("fin");
    if (a) inp.style.paddingLeft = `calc(${a}ch + 6px + var(--t, 0px))`;   // v0.568: и мимо скоса края (--t у .tz)
    if (b) inp.style.paddingRight = `calc(${b}ch + 6px + var(--t, 0px))`;
  }));
  /* v0.366: магнит — край тащимой группы ближе SNAP px к краю окна конуса, поля строк или другой группы (любой стороной: вплотную или вровень) —
     встаёт ровно на него; по горизонтали и вертикали — отдельно, ближайший край. Координаты — экранные */
  const SNAP = 10;
  /* v0.502, по снимку «Вида» и «Аниматрицы» рядом — «примагничивать к левой группе, размагничивать при перемещении правой»: группа, поднесённая
     к соседней сбоку (ближе SNAP), входит в неё зубцами — выемки левого края на острия правого края соседки (заходит на t), ряд в ряд (шаг 24 px).
     Отпустил так — правая прицеплена к левой (Z.cgrpLink { правая: { to: левая, dy } }): левую двигают, растягивают, перестраивают — правая едет
     следом (linkSync); правую потянул — отцепилась. «И верхняя — нижняя так же, верхняя главная»: поднесённая под группу (или над ней) встаёт рамка
     на рамку (заходит на 1 px), левые края вровень, если близко; нижняя прицеплена к верхней ({ to, v: 1, dx }) */
  if (!Z.cgrpLink || typeof Z.cgrpLink !== "object") Z.cgrpLink = {};
  const gByKey = k => panels().find(o => o.dataset.g === k);
  Z.cgrpLink = Object.fromEntries(Object.entries(Z.cgrpLink).filter(([,L])=>L && L.book)); // v0.054: только вертикальные цепочки ромбокниг.
  const linkCycle = (right, left) => solLinkCycle(Z.cgrpLink, right, left);
  const meshSnap = (g, x, y, w, h) => {
    const t = TZC_H / (2 * Math.sqrt(3)), P = TZC_H; let best = null;
    panels().forEach(o => {
      if (o === g || !onCanvas(o) || !o.getClientRects().length || o.classList.contains("cfld") || !(o.classList.contains("tzg") || o.classList.contains("pzg"))) return;
      const q = o.getBoundingClientRect(); if (q.width < 4 || y >= q.bottom - P / 2 || y + h <= q.top + P / 2) return;
      const yy = q.top + Math.round((y - q.top) / P) * P;
      for (const [side, xx] of [["r", q.right - t], ["l", q.left - w + t]]) {
        const d = Math.abs(x - xx); if (d >= SNAP + t || (best && d >= best.d)) continue;   // зона — и на глубину зубца (иначе брал простой магнит край в край)
        if (side === "r" ? linkCycle(g.dataset.g, o.dataset.g) : linkCycle(o.dataset.g, g.dataset.g)) continue;
        best = { d, x: xx, y: yy, o, side };
      }
    });
    panels().forEach(o => {   // сверху вниз: рамка на рамку
      if (o === g || !onCanvas(o) || !o.getClientRects().length || o.classList.contains("cfld") || !(o.classList.contains("tzg") || o.classList.contains("pzg"))) return;
      const q = o.getBoundingClientRect(); if (q.width < 4 || x >= q.right - P / 2 || x + w <= q.left + P / 2) return;
      const xx = Math.abs(x - q.left) < SNAP ? q.left : x;
      const grid = solPanelFolded(g) && solPanelFolded(o);
      for (const [side, yy] of [["b", grid ? q.top + solPanelRowStep(o) : q.bottom - 1], ["t", grid ? q.top - solPanelRowStep(g, h) : q.top - h + 1]]) {
        const d = Math.abs(y - yy); if (d >= SNAP || (best && d >= best.d)) continue;
        if (side === "b" ? linkCycle(g.dataset.g, o.dataset.g) : linkCycle(o.dataset.g, g.dataset.g)) continue;
        best = { d, x: xx, y: yy, o, side };
      }
    });
    /* v0.825, по снимку «За чертой» у края поля строк — «магнит к зубцам», «правая колонка строки, левая»: зубцы левого меню (#paneZigOv) и поля строк
       (#fieldZigOv) — такая же цель, как группа-соседка. Острия вправо (меню, поле слева): левый край группы — у основания зубцов, выемки на острия, ряд в
       ряд с их сеткой. Острия влево (поле справа): правый край группы — у основания, её острия — в выемки (полряда сдвиг). Привязка к выбранному зубцу сохраняется */
    for (const id of ["paneZigOv", "fieldZigOv"]) {
      const ov = document.getElementById(id); if (!ov || ov.style.display === "none" || !ov.getClientRects().length) continue;
      const q = ov.getBoundingClientRect(); if (q.height < P || y >= q.bottom || y + h <= q.top) continue;
      const off = parseFloat(String(ov.style.backgroundPosition || "0 0").split(" ")[1]) || 0, left = id === "fieldZigOv" && document.body.classList.contains("field-right");
      const y0 = q.top + off - (left ? P / 2 : 0), xx = left ? q.right - w : q.left, yy = y0 + Math.round((y - y0) / P) * P;
      const d = Math.abs(x - xx); if (d >= SNAP + t || (best && d >= best.d)) continue;
      best = { d, x: xx, y: yy, o: ov, side: "z", row: Math.round((yy - y0) / P) };
    }
    return best;
  };
  const linkSync = () => {
    // Мобильные группы идут в потоке и не меняют сохранённые координаты настольной раскладки.
    if (document.body.classList.contains("sol-mobile")) return;
    // Шапки стоят с постоянным шагом; стопка у нижнего края растёт вверх.
    Z.cgrpLink=Object.fromEntries(Object.entries(Z.cgrpLink).filter(([,L])=>L && L.book));
    const done=new Set(), active=new Set(), rising=new Map();
    const follow=g=>{
      if(done.has(g)||active.has(g))return; active.add(g);
      const L=Z.cgrpLink[g.dataset.g], parent=L&&gByKey(L.to);
      if(parent && !Z.cgrpTop?.[g.dataset.g] && onCanvas(g) && onCanvas(parent) && !g.classList.contains("cdrag") && !g.classList.contains("pdrag") && g.getClientRects().length && parent.getClientRects().length){
        follow(parent); const r=parent.getBoundingClientRect(), wr=wb.getBoundingClientRect();
        // v0.071: незакреплённая стопка растёт к середине поля — та, что стоит выше середины, идёт вниз (иначе уезжала за верхний край).
        const pin=Z.cgrpTop?.[parent.dataset.g],up=rising.get(parent) ?? (pin ? pin.side === "bottom" : r.top+r.bottom > wr.top+wr.bottom);
        rising.set(g,up);
        // v0.072: без шапок гроздь встаёт за краем предыдущей (с зазором 6 px), а не на шаг шапки.
        let x=r.left+(L.dx||0),y=parent.classList.contains("sfz-grape")?(up?r.top-g.offsetHeight-6:r.bottom+6):r.top+(up?-1:1)*solPanelRowStep(parent);
        nodeSetPos(g,x,y);
        if(!SOL_PLATES[g.id]){g.classList.add("cfloat");floatPlace(g,x,y);if(g.classList.contains("cmin"))place(g);}else nodePlace(g);
      }
      active.delete(g);done.add(g);
    };
    panels().forEach(follow);
    if (document.body.classList.contains("sol-mobile")) return;
    for (const g of panels()) if ((typeof nodePin(g) === "number" || (Z.cgrpTop && Z.cgrpTop[g.dataset.g]) || (Z.cgrpEdge && Z.cgrpEdge[g.dataset.g])) && onCanvas(g) && !g.classList.contains("cdrag") && !g.classList.contains("pdrag") && g.getClientRects().length) nodePlace(g);
    if (window.zzPanelOrganizeSync) window.zzPanelOrganizeSync();

    sfzWeaveKick();
  };
  setInterval(() => { if (!document.hidden && !ZZ_BG) linkSync(); }, 300);
  /* v0.758, «как-то так объедини» (снимок: «Алгоритм» сверху во всю ширину, под ним столбцами Лазер · Солнце · За чертой · Строка 1 · Щели): один раз (Z.lasPack)
     группы лазера, ещё стоящие в общем ряду, собираются в такой блок поверх холста — под остальными группами; столбцы — самой узкой ширины, «Алгоритм» —
     во всю ширину столбцов, сцепки: Лазер под «Алгоритмом», каждый следующий столбец справа от предыдущего. Если хоть одна группа лазера уже стоит
     поверх холста, спрятана или на левой панели — раскладку пользователя не трогает */
  setTimeout(() => {
    if (Z.lasPack || ZZ_BG) return;
    const F = ["алгоритм", "лазер", "солнце", "за чертой", "строка 1", "щели"].map(gByKey); if (F.some(x => !x)) return;
    Z.lasPack = 1;
    if (F.some(x => x.parentElement !== tl || x.classList.contains("cfloat") || Z.cgrpOff[x.dataset.g] || x.classList.contains("cmin") || !x.getClientRects().length)) { save(); return; }
    const t = TZC_H / (2 * Math.sqrt(3)), tr0 = tl.getBoundingClientRect(), br = wb.getBoundingClientRect(), A = br.width - 2;
    const cols = F.slice(1); cols.forEach(x => { if (!Z.cgrpSize[x.dataset.g]) Z.cgrpSize[x.dataset.g] = { w: 1, h: 24 }; sizeApply(x); });
    /* столбцы не влезают в ширину окна — переносятся следующим рядом (под самым высоким столбцом ряда выше), блок — целиком в окне */
    const ws = cols.map(x => x.offsetWidth), hs = cols.map(x => x.offsetHeight), rows = [[]]; let cur = 0;
    cols.forEach((x, i) => { const r = rows[rows.length - 1], add = r.length ? ws[i] - t : ws[i]; if (r.length && cur + add > A) { rows.push([i]); cur = ws[i]; } else { r.push(i); cur += add; } });
    const off = {}; rows.forEach(r => { let o = 0; r.forEach((i, j) => { off[i] = o; o += ws[i] - t; }); });
    const Wa = Math.max(...rows.map(r => r.reduce((q, i, j) => q + ws[i] - (j ? t : 0), 0)));
    if (!Z.cgrpSize["алгоритм"]) Z.cgrpSize["алгоритм"] = { w: Math.round(Wa), h: 24 }; sizeApply(F[0]);
    const x0 = Math.max(br.left - tr0.left, Math.min(F[0].getBoundingClientRect().left - tr0.left, br.right - tr0.left - F[0].offsetWidth));
    Z.cgrpPos["алгоритм"] = { x: x0, y: 0 };
    rows.forEach((r, k) => r.forEach((i, j) => {
      const key = cols[i].dataset.g;
      if (j) Z.cgrpLink[key] = { to: cols[r[j - 1]].dataset.g, dy: 0 };
      else if (!k) Z.cgrpLink[key] = { to: "алгоритм", v: 1, dx: 0 };
      else { const up = rows[k - 1].reduce((m, q) => hs[q] > hs[m] ? q : m, rows[k - 1][0]); Z.cgrpLink[key] = { to: cols[up].dataset.g, v: 1, dx: Math.round(-off[up]) }; }
    }));
    place(F[0]); linkSync();
    const tr = tl.getBoundingClientRect(); let y0 = 0;
    groups.forEach(o => { if (!F.includes(o) && o.parentElement === tl && !o.classList.contains("cfloat") && o.getClientRects().length) y0 = Math.max(y0, o.getBoundingClientRect().bottom - tr.top); });
    Z.cgrpPos["алгоритм"] = { x: x0, y: y0 }; place(F[0]); linkSync();
    delete Z.cgrpLink["лазер"]; save();   // v0.764: «Алгоритм» — отдельно: «Лазер» стоит под ним, но не прицеплен
  }, 700);
  /* v0.761, по снимку «За чертой · Солнце · Строка 1» — «как-то неровно между этими»: одна пара была сцеплена зубцами (остриё в выемку), другая — просто
     приставлена край к краю, со щелью. Группы лазера, что стоят бок о бок (правая — в пределах двух шагов t от зубцов левой, ряды перекрываются), сами
     сцепляются: правая прицепляется к левой ряд в ряд (dy — целыми рядами по 24 px), linkSync ставит её остриём в выемку. Уже прицепленную к чему-то не
     трогает. Пересчёт — после отпускания группы лазера и один раз при загрузке */
  const lasMesh = () => {}; // v0.046: автоматическое сцепление соседних лазерных панелей снято.
  const snapXY = (g, x, y, w, h) => {   // v0.400: через zSnapTo — и с подсветкой того, к чему прилипла
    g._mesh = null; // v0.046: соседние панели больше не притягивают.
    const T = [], add = (el, ov) => { if (!el || !el.getClientRects().length) return; const q = el.getBoundingClientRect(); if (q.width > 4 && q.height > 4) T.push([el, q, ov || 0]); };
    /* v0.478, «магнитить только там, но без щелей — обводка на обводку ложить»: группа к группе встык заходит на 1 px — их рамки ложатся одна на другую */
    add(wb); add($("field")); add($("rowsPane"));
    const bodyTarget = T.find(([el]) => el === wb);
    if (bodyTarget) { const q = bodyTarget[1], top = solPanelTop(wb, x, w); bodyTarget[1] = { left: q.left, right: q.right, top, bottom: q.bottom }; }
    const [sx, sy, hit] = zSnapTo(x, y, w, h, T, SNAP); zSnapGlow(hit); return [sx, sy];
  };
  window.zzGroupPinSync = () => linkSync();   // v0.929: единая верёвка для групп и таблиц
  const attachMesh = () => {}; // v0.046: отпускание рядом с другой панелью не связывает их.
  window.zzPlateSnap = (el, x, y, w, h) => snapXY(el, x, y, w, h);
  window.zzPanelLinkSync = linkSync;
  window.zzPanelDragStart = (el, solo) => { frontPanel(el); delete Z.cgrpLink[el.dataset.g]; nodeUnpin(el); if (solo) for (const [key, L] of Object.entries(Z.cgrpLink)) if (L && L.to === el.dataset.g) delete Z.cgrpLink[key]; };
  window.zzPanelDragEnd = el => { const m = el._mesh; el._mesh = null; if (typeof nodePin(el) !== "number") attachMesh(el, m); linkSync(); if (!Z.cgrpLink[el.dataset.g]) grpFix(el); };
  const wbTop = (x, width) => solPanelTop(wb, x, width);
  const floatPlace = (g, x, y) => {
    const tr = tl.getBoundingClientRect(), above = y < wb.getBoundingClientRect().top - 0.5;
    g.classList.toggle("cg-abovebody", above);
    g.style.left = (above ? x : x - tr.left).toFixed(2) + "px";
    g.style.top = (above ? y : y - tr.top).toFixed(2) + "px";
  };
  const placeGroup = (g) => {
    if (document.body.classList.contains("sol-mobile")) return;
    if (g.classList.contains("cdrag") || g.classList.contains("pdrag")) return;
    const topPin = Z.cgrpTop && Z.cgrpTop[g.dataset.g];
    if (topPin && !g.classList.contains("cdrag") && !g.classList.contains("pdrag")) {
      const wr = $("w-cone").getBoundingClientRect(), top = $("top").getBoundingClientRect();
      const lower = topPin.side === "bottom";
      if (!topPin.menuAnchor) {
        const shift = Number(Z.sfzRope?.x) || 0;
        if (!lower && !topPin.locked) topPin.x += shift / Math.max(1,wr.width-g.offsetWidth);
        topPin.menuAnchor = true;
      }
      const axis=coneAxisScr(),oldX=wr.left+Math.max(0,wr.width-g.offsetWidth)*topPin.x;
      if(axis&&!Number.isFinite(topPin.axisDx))topPin.axisDx=(oldX+g.offsetWidth/2-axis.x)/Math.max(.00001,coneZoom);
      const x=Number.isInteger(topPin.mesh)?sfzMenuGridOrigin()+topPin.mesh*30-g.offsetWidth/2:axis?axis.x+topPin.axisDx*coneZoom-g.offsetWidth/2:oldX;
      g.classList.add("cfloat", "cg-abovebody"); g.classList.remove("cfld", "axpin");
      const y = lower ? wb.getBoundingClientRect().bottom-g.offsetHeight : top.bottom;
      g.style.left = Math.round(x) + "px"; g.style.top = Math.round(y) + "px"; return;
    }
    const f = g.parentElement === tl && Z.cgrpFld[g.dataset.g], fr = f && solZoneRect(f.z);   // v0.348: на поле строк; v0.954: и на левой панели
    if (fr) g.classList.remove("cg-abovebody");
    g.classList.toggle("cfld", !!fr);
    if (fr && f.z === "head" && window.zzHeaderPlace) { g.classList.add("cfloat"); window.zzHeaderPlace(g); return; }
    if (fr) {
      g.classList.add("cfloat"); const gw = g.offsetWidth, gh = g.offsetHeight;
      const x = Math.max(0, Math.min(f.x, fr.width - gw)), y = Math.max(0, Math.min(f.y, fr.height - gh));
      g.style.left = Math.round(fr.left + x) + "px"; g.style.top = Math.round(fr.top + y) + "px"; return;
    }
    /* v0.911, «да, всё так сделай» (прищепка v0.910 — и группам кнопок): группа, прищеплённая к горизонтали через центр конуса (Z.cgrpPin[имя] — сдвиг от
       центра при масштабе 1), стоит верхним краем на оси, по горизонтали — центр + сдвиг × масштаб; в окно не загоняется — может уехать за край */
    { const pin = Z.cgrpPin && Z.cgrpPin[g.dataset.g], A = typeof pin === "number" && g.parentElement === tl ? coneAxisScr() : null;
      if (g.classList.contains("axpin") !== !!A) g.classList.toggle("axpin", !!A);
      if (A) { g.classList.remove("cg-abovebody"); const tr0 = tl.getBoundingClientRect(), px = solAxisPanelX(g, pin, A) - tr0.left, py = A.y - tr0.top - solPanelAxisOffset(g); Z.cgrpPos[g.dataset.g] = { x: px, y: py };
        g.classList.add("cfloat"); const l = px.toFixed(2) + "px", t = Math.round(py) + "px"; if (g.style.left !== l) g.style.left = l; if (g.style.top !== t) g.style.top = t; return; } }
    if (g.parentElement === tl && Z.cgrpEdge && Z.cgrpEdge[g.dataset.g]) {
      const tr0 = tl.getBoundingClientRect(), br0 = wb.getBoundingClientRect();
      const edge = solEdgePosition(g, Z.cgrpEdge[g.dataset.g], wbTop, br0.bottom - g.offsetHeight);
      if (edge) {
        const p0 = { x: edge.x - tr0.left, y: edge.y - tr0.top }; Z.cgrpPos[g.dataset.g] = p0;
        g.classList.add("cfloat"); floatPlace(g, edge.x, edge.y); return;
      }
    }
    const key=g.dataset.g, bottom=Z.sfzBookUp?.[key] && Z.sfzBookBottom?.[key];
    if(bottom && !g.classList.contains("cdrag")){
      const tr=tl.getBoundingClientRect(), y=bottom.y-g.offsetHeight;
      Z.cgrpPos[key]={x:bottom.x,y};g.classList.add("cfloat");floatPlace(g,tr.left+bottom.x,tr.top+y);return;
    }
    const p = Z.cgrpPos[g.dataset.g]; g.classList.toggle("cfloat", !!p);
    if (!p) { g.classList.remove("cg-abovebody"); g.style.left = g.style.top = ""; return; }
    const tr = tl.getBoundingClientRect(), br = wb.getBoundingClientRect(), gw = g.offsetWidth, gh = g.offsetHeight;
    /* v0.215, «пусть вкладки уезжают за поле строк, но не заголовком»: вправо группа может уйти за край окна (под поле строк), а край держит
       только её заголовок — он всегда виден, за него и вытаскивают обратно. Влево заголовок первым, поэтому там — как было. */
    /* v0.366, по снимку «Кольца», ушедших под поле строк, — «группы не скрывать теперь, а примагничивать к границам, всем, по всему периметру»:
       группа — всегда целиком внутри окна конуса (v0.215 «уезжают под поле строк» снято); притягивается к краям при перетаскивании (snapXY) */
    /* v0.536, по снимку свёрнутого «Звука», ушедшего под заголовок окна, — «скрылась за заголовком полоской и никак не вытащить»: верхняя граница —
       низ заголовка окна (wb — само окно, его верх — это верх заголовка) */
    const x = Math.max(br.left - tr.left, Math.min(p.x, br.right - tr.left - gw));
    const hb = wbTop(tr.left + x, gw);
    const head=g.querySelector(".sfz-fold-head") || g.querySelector(":scope > .glab"), headRect=head?.getBoundingClientRect();
    const headOffset=sfzColumnGroup(g)&&headRect?.height?headRect.top-g.getBoundingClientRect().top:0,keepHeight=sfzColumnGroup(g)?(headRect?.height||48):gh;
    let y = Math.max(hb-tr.top-headOffset,Math.min(p.y,br.bottom-tr.top-headOffset-keepHeight));
    /* v0.656, «…чтобы зубцами синхронизировалась группа»: по вертикали группа встаёт на ряды сетки — шагом 24 px от низа полосы вкладок (ряды зубцов
       левой панели выровнены по вкладкам, v0.636); прижатая к меню — ровно под ним */
    if (!sfzColumnGroup(g) && !Z.cgrpLink[g.dataset.g]) { const k = Math.round((tr.top + y - hb) / TZC_H); let y2 = hb - tr.top + k * TZC_H; if (y2 + gh > br.bottom - tr.top + 0.5) y2 -= TZC_H; if (y2 >= hb - tr.top - 0.5) y = y2; }
    floatPlace(g, tr.left + x, tr.top + y);
  };
  // Check the visible folded title after every placement, including bottom and axis anchors.
  let foldRecoverySave = false;
  const place = g => {
    placeGroup(g);
    if(document.body.classList.contains("sol-mobile") || !g.matches(".sfz-grape.cmin.cfloat") || g.matches(".coff,.cdrag,.pdrag") || Z.cgrpFld?.[g.dataset.g]?.z === "head")return;
    const head=g.querySelector(".sfz-fold-head"), r=head?.getBoundingClientRect();if(!r?.width || !r.height)return;
    const key=g.dataset.g, f=Z.cgrpFld?.[key], area=f&&solZoneRect(f.z)||wb.getBoundingClientRect();
    const left=Math.max(0,area.left), right=Math.min(innerWidth,area.right??area.left+area.width), top=Math.max($("top").getBoundingClientRect().bottom,area.top);
    let bottom=Math.min(innerHeight,area.bottom??area.top+area.height);
    for(const id of ["coneTransportTempo","sfzBottomGrid","solHeaderDock"]){const bar=$(id),b=bar?.getBoundingClientRect();if(b?.width&&b.height&&r.left<b.right&&r.right>b.left&&b.top>=top+r.height)bottom=Math.min(bottom,b.top);}
    if(right-left<r.width || bottom-top<r.height)return;
    let x=Math.max(left,Math.min(right-r.width,r.left)),y=Math.max(top,Math.min(bottom-r.height,r.top));
    const outside=Math.abs(x-r.left)>=.5||Math.abs(y-r.top)>=.5;
    if(outside){
      const occupied=[...document.querySelectorAll('.sfz-fold-head')].filter(h=>h!==head).map(h=>h.getBoundingClientRect()).filter(q=>q.width&&q.height);
      const free=(a,b)=>occupied.every(q=>a+r.width<=q.left+1||a>=q.right-1||b+r.height<=q.top+1||b>=q.bottom-1);
      if(!free(x,y)){const candidates=[];for(let i=-10;i<=10;i++)for(let j=-10;j<=10;j++){const a=x+i*(r.width+6),b=y+j*(r.height+6);if(a>=left&&a+r.width<=right&&b>=top&&b+r.height<=bottom&&free(a,b))candidates.push({a,b,d:i*i*(r.width+6)**2+j*j*(r.height+6)**2});}candidates.sort((a,b)=>a.d-b.d);if(candidates.length){x=candidates[0].a;y=candidates[0].b;}}
    }
    const dx=x-r.left,dy=y-r.top;
    if(Math.abs(dx)<.5 && Math.abs(dy)<.5)return;
    const gr=g.getBoundingClientRect();
    nodeUnpin(g);delete Z.cgrpLink[key];delete Z.cgrpEdge[key];
    nodeSetPos(g,gr.left+dx,gr.top+dy);
    if(f){g.style.left=(parseFloat(g.style.left)+dx)+"px";g.style.top=(parseFloat(g.style.top)+dy)+"px";}
    else floatPlace(g,gr.left+dx,gr.top+dy);
    if(!foldRecoverySave){foldRecoverySave=true;queueMicrotask(()=>{foldRecoverySave=false;save();});}
  };
  /* v0.558, по снимку «Аниматрицы» поверх «Вида» — «не давай на друг друга ложить группы»: плавающая группа (поверх холста или на поле строк), налезшая на
     другую больше чем на зубец (9 px — встык и зубцы в зубцы по-прежнему можно), сдвигается на ближайшее место вплотную к ней (справа, слева, снизу или сверху —
     куда короче и что в пределах окна). Когда отпустили группу — двигается она; само (раз в 0,3 с: группа выросла, окно сузилось) — верхняя из двух.
     Прицепленные 🧲 сами не двигаются — двигают другую */
  const grpFix = () => sfzWeaveKick();
  groups.forEach((g) => {
    const lab = g.querySelector(".glab"); if (!lab) return;
    g.dataset.g = lab.textContent.trim().toLowerCase();
    const shortName = { "солнце": "Солн.", "строка 1": "Стр. 1", "за чертой": "За черт.", "алгоритм": "Алг.", "кручение": "Круч.", "аниматрица": "Аним." }[g.dataset.g];
    if (shortName && lab.firstChild && lab.firstChild.nodeType === 3) lab.firstChild.textContent = shortName;
    /* v0.256, «в режиме дзен показывать все кнопки и группы вкладок, которые отмечу (надо у них кнопку сделать)»: 🧘 в заголовке группы —
       отметить; отмеченные группы видны и в дзене (поверх конуса, где стоят; с левой панели — на время дзена у верхнего края). Z.cgrpZen. */
    if (!Z.cgrpZen || typeof Z.cgrpZen !== "object") Z.cgrpZen = {};
    if (!Z.zenGrpInit) { Z.cgrpZen["дзен"] = true; Z.zenGrpInit = 1; }   // v0.281: группа «Дзен» — видна в дзене с первого раза (дальше — как отметишь 🧘)
    const zb = document.createElement("span"); zb.className = "gzen"; lab.appendChild(zb);
    /* v0.752, по снимку заголовка группы — «убери редактирование кнопок»: значка △ (конструктор группы, v0.452) в заголовках больше нет; уже сделанные
       рисунки групп остаются как есть */
    if (false) { const tb = document.createElement("span"); tb.className = "gtri"; tb.textContent = "△"; lab.appendChild(tb);   // v0.452: конструктор группы в «△ Сетке»
      tb.title = "△ Конструктор: группа — в окне «△ Сетка» треугольниками; крась и стирай — кнопки встают по рисунку";
      tb.addEventListener("pointerdown", (e) => { e.stopPropagation(); e.preventDefault(); if (e.button !== 0) return; tzcOpen(g); });
      tb.addEventListener("dblclick", (e) => e.stopPropagation()); }
    /* v0.495, «у каждой группы независимый цвет фона нажатой кнопки свой пусть»: фон нажатых — цветом самой группы (--gon, по умолчанию — цвет
       заголовка); ◆ в заголовке (закрашен тем фоном) — выбрать свой, правый щелчок — снова цвет группы. Z.cgrpOnC { имя: "#rrggbb" } */
    if (!Z.cgrpOnC || typeof Z.cgrpOnC !== "object") Z.cgrpOnC = {};
    { const ob = document.createElement("span"); ob.className = "gon"; ob.textContent = "◆"; lab.appendChild(ob);
      const onUi = () => { const c = Z.cgrpOnC[g.dataset.g]; if (c) g.style.setProperty("--gon", c); else g.style.removeProperty("--gon");
        ob.title = "◆ Цвет нажатых кнопок группы" + (c ? " — свой (правый щелчок — снова цвет группы)" : " — цвет группы; щелчок — выбрать свой"); };
      onUi();
      ob.addEventListener("pointerdown", (e) => { e.stopPropagation(); e.preventDefault(); if (e.button !== 0) return;
        const inp = document.createElement("input"); inp.type = "color"; inp.style.cssText = "position:fixed;left:" + e.clientX + "px;top:" + e.clientY + "px;width:0;height:0;opacity:0;border:0;padding:0";
        const rgb = (getComputedStyle(lab).color.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number), hex = (a) => "#" + a.map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
        inp.value = Z.cgrpOnC[g.dataset.g] || (rgb.length === 3 ? hex(rgb) : "#888888");
        inp.addEventListener("input", () => { Z.cgrpOnC[g.dataset.g] = inp.value; onUi(); save(); });
        inp.addEventListener("change", () => { Z.cgrpOnC[g.dataset.g] = inp.value; onUi(); save(); inp.remove(); });
        inp.addEventListener("blur", () => setTimeout(() => inp.remove(), 0));
        document.body.appendChild(inp); inp.click(); });
      ob.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); if (!Z.cgrpOnC[g.dataset.g]) return; delete Z.cgrpOnC[g.dataset.g]; onUi(); save(); say("◆ Нажатые кнопки группы — снова её цветом."); });
      ob.addEventListener("dblclick", (e) => e.stopPropagation()); }
    // v0.367: закрытая группа (Z.cgrpOff) не видна; у «Гаммы» — ✕ закрыть (открыть — «🎨» в шапке)
    if (!Z.cgrpOff || typeof Z.cgrpOff !== "object") Z.cgrpOff = {};
    g.classList.toggle("coff", !!Z.cgrpOff[g.dataset.g]);
    if (g.dataset.g === "гамма") {
      const x = document.createElement("span"); x.className = "gx"; x.textContent = "✕"; x.title = "Закрыть группу «Гамма» (открыть — «🎨» в шапке)"; lab.appendChild(x);
      x.addEventListener("pointerdown", (e) => { e.stopPropagation(); e.preventDefault(); if (e.button !== 0) return; window.cgrpHide("гамма"); });
      x.addEventListener("dblclick", (e) => e.stopPropagation());
    }
    const zUi = () => { const on = !!Z.cgrpZen[g.dataset.g]; g.classList.toggle("zenon", on); zb.textContent = "🧘"; zb.title = on ? "🧘 Видна в дзене — щелчок: не показывать" : "🧘 Показывать эту группу и в дзене"; };
    zUi();
    zb.addEventListener("pointerdown", (e) => { e.stopPropagation(); e.preventDefault(); if (e.button !== 0) return; const k = g.dataset.g; if (Z.cgrpZen[k]) delete Z.cgrpZen[k]; else Z.cgrpZen[k] = true; zUi(); save();
      say(Z.cgrpZen[k] ? `🧘 Группа «${k}» — видна и в дзене.` : `🧘 Группа «${k}» в дзене не видна.`); });
    zb.addEventListener("dblclick", (e) => e.stopPropagation());
    const fold = document.createElement("button"); fold.type = "button"; fold.className = "gfold"; lab.appendChild(fold);
    const foldUi = () => solFoldButton(fold, !!Z.cgrpMin[g.dataset.g], solPanelName(g));
    const foldToggle = (on = !Z.cgrpMin[g.dataset.g], defer = false) => {
      const key = g.dataset.g,foldHead=g.querySelector(".sfz-fold-head"),anchor=foldHead?._edge||lab,head=(foldHead||lab).getBoundingClientRect(),free=sfzColumnGroup(g)&&g.parentElement===tl&&!Z.cgrpTop?.[key]&&typeof Z.cgrpPin?.[key]!=="number"&&!Z.cgrpEdge?.[key]&&!Z.cgrpLink?.[key];
      if (on) Z.cgrpMin[key] = true; else delete Z.cgrpMin[key];
      g.classList.toggle("cmin", on); g.style.minHeight = ""; foldUi();
      if (defer) return;
      sizeApply(g); cgrpCols();
      if(free&&head.width){const now=(g.querySelector(".sfz-fold-head")||anchor).getBoundingClientRect(),r=g.getBoundingClientRect();nodeSetPos(g,r.left+head.left-now.left,r.top+head.top-now.top);}
      place(g); linkSync(); save();
    };
    g._solFold = foldToggle;
    g._sfzTopToggle = () => {
      const key=g.dataset.g, r=g.getBoundingClientRect(), pinned=!!Z.cgrpTop?.[key];
      nodeUnpin(g); delete Z.cgrpLink[key]; delete Z.cgrpFld[key];
      if(g.parentElement!==tl)undock(g);
      nodeSetPos(g,r.left,r.top);
      if(!pinned){const wr=$("w-cone").getBoundingClientRect(), side=Z.sfzBookUp?.[key]?"top":"bottom";Z.cgrpTop ||= {};Z.cgrpTop[key]=sfzMenuPin(g,r.left,side);}
      place(g); sfzGrapeSync(g); linkSync(); save();
    };
    g._sfzPinLock = () => {
      const pin=Z.cgrpTop?.[g.dataset.g]; if(!pin)return;
      const r=g.getBoundingClientRect(), wr=$("w-cone").getBoundingClientRect(), top=$("top").getBoundingClientRect();
      if(pin.locked){pin.x=(r.left-wr.left)/Math.max(1,wr.width-g.offsetWidth);delete pin.locked;delete pin.holdX;delete pin.holdY;}
      else{pin.locked=true;pin.holdX=r.left-wr.left;pin.holdY=r.top-top.bottom;}
      place(g);sfzGrapeSync(g);linkSync();save();
    };
    g._sfzBookTurn = (topDock=false) => {
      const key=g.dataset.g, r=g.getBoundingClientRect(), oldPin=Z.cgrpTop?.[key];
      nodeUnpin(g);delete Z.cgrpLink[key];delete Z.cgrpFld[key];
      if(g.parentElement!==tl)undock(g);
      Z.sfzBookUp ||= {}; Z.sfzBookBottom ||= {};
      if(Z.sfzBookUp[key]){delete Z.sfzBookUp[key];delete Z.sfzBookBottom[key];}
      else{Z.sfzBookUp[key]=true;const tr=tl.getBoundingClientRect();Z.sfzBookBottom[key]={x:r.left-tr.left,y:r.bottom-tr.top};}
      if(topDock){Z.cgrpTop ||= {};const wr=$("w-cone").getBoundingClientRect();Z.cgrpTop[key]=sfzMenuPin(g,r.left,Z.sfzBookUp[key]?"top":"bottom");}
      else if(oldPin){Z.cgrpTop ||= {};Z.cgrpTop[key]={...oldPin,side:Z.sfzBookUp[key]?"top":"bottom"};}
      else if(!Z.sfzBookUp[key])nodeSetPos(g,r.left,r.top);
      sfzGrapeSync(g);place(g);linkSync();save();
    };
    g._sfzBottomPlace = () => {
      const key=g.dataset.g;
      if(!g._sfzFolding && Z.sfzBookUp?.[key] && g.parentElement===tl && !Z.cgrpFld[key] && !Z.cgrpLink[key] && !g.classList.contains("cdrag"))place(g);
    };
    // v0.068: одиночный и двойной щелчок складывают на месте; переворот — при переносе к полосе. Старый dockToggle оставлен для команд других пультов.
    const dockToggle = () => {
      const key = g.dataset.g, current = Z.cgrpFld[key];
      Z.cgrpMinPos ||= {};
      if (current?.z === "head") {
        const old = Z.cgrpMinPos[key]; delete Z.cgrpMinPos[key];
        delete Z.cgrpFld[key]; delete Z.cgrpPos[key]; nodeUnpin(g);
        if (old?.fld && old.fld.z !== "head") Z.cgrpFld[key] = { ...old.fld };
        else if (old?.pos) Z.cgrpPos[key] = { ...old.pos };
        if (old?.edge) { Z.cgrpEdge ||= {}; Z.cgrpEdge[key] = { ...old.edge }; }
        if (typeof old?.pin === "number") { Z.cgrpPin ||= {}; Z.cgrpPin[key] = old.pin; }
        if (old?.link && !solLinkCycle(Z.cgrpLink, key, old.link.to)) Z.cgrpLink[key] = { ...old.link };
        foldToggle(false, true);
      } else {
        Z.cgrpMinPos[key] = {
          pos: Z.cgrpPos[key] ? { ...Z.cgrpPos[key] } : null,
          fld: current ? { ...current } : null,
          edge: Z.cgrpEdge?.[key] ? { ...Z.cgrpEdge[key] } : null,
          pin: Z.cgrpPin?.[key], link: Z.cgrpLink[key] ? { ...Z.cgrpLink[key] } : null
        };
        nodeUnpin(g); delete Z.cgrpLink[key]; delete Z.cgrpPos[key];
        Z.cgrpFld[key] = { z: "head", x: 0, y: 0 }; foldToggle(true, true);
        const room = solHeaderRoom(key); Z.solHeaderOrder ||= [];
        Z.solHeaderOrder = Z.solHeaderOrder.filter(k => k !== key); Z.solHeaderLeft = room < 128;
        if (Z.solHeaderLeft) Z.solHeaderOrder.unshift(key); else Z.solHeaderOrder.push(key);
      }
      cgbSnap(); sizeApply(g); cgrpCols(); place(g); linkSync(); save();
    };
    g._solDockToggle = dockToggle;
    fold.onclick = e => { e.stopPropagation(); if (e.detail < 2) foldToggle(); };
    fold.addEventListener("dblclick", e => { e.preventDefault(); e.stopPropagation(); }); foldUi();   // v0.952: двойной — как одиночный, первый щелчок уже переключил
    g.addEventListener("click", e => {
      // v0.958: группа при нажатии забирает указатель (setPointerCapture) — щелчок приходит на саму группу; где нажали, помнит g._downLab
      if (!(g._downLab || e.target.closest(".glab")) || e.target.closest("button, input, select, textarea, label, .gzen, .gon, .gx, .cgsz") || e.detail > 1 || performance.now() < (g._solDragUntil || 0)) return;
      e.stopPropagation(); if(e.altKey){g._sfzBookTurn?.();return;} foldToggle();
    });
    lab.title = (lab.title ? lab.title + "\n\n" : "") + "Тяни за заголовок или пустое место — перенести. Магнит к краям, полю строк, левой панели и другим панелям; бока сцепляются зубцами, верх и низ — рамка на рамку. Правая едет за левой, нижняя за верхней; потяни ведомую — отцепить. Верхний край у горизонтальной оси — прищепка к конусу и его масштабу; панели раздвигаются от центра без наложения, могут уходить за экран. Один щелчок по заголовку — свернуть / развернуть на месте; двойной — то же действие один раз, на месте. При перетаскивании в верхнюю полосу — раскрывать вниз, в нижнюю — вверх, сразу при входе; Alt + щелчок — перевернуть вручную. «− / +» — свернуть до заголовка / развернуть на месте. Правый щелчок по заголовку — снять сцепку и прищепку, вернуть на полосу. Колесо — масштаб конуса" + "; над полем строк — прокрутка строк; группа целиком над полем строк или левой панелью — остаётся на них" + (g.classList.contains("cg-lx") && g.dataset.g !== "алгоритм" ? ". Shift + тянуть — блок групп лазера; Alt + тянуть — одна группа, соседи остаются" : "");
    g.classList.toggle("cmin", !!Z.cgrpMin[g.dataset.g]);
    g.style.minHeight = Z.cgrpMin[g.dataset.g] > 0 ? Z.cgrpMin[g.dataset.g] + "px" : "";   // v0.207: свёрнутая — прежней высоты
    { const sz = document.createElement("span"); sz.className = "cgsz"; sz.title = "Тяни ромб — ширина группы и перенос кнопок; высота подстраивается под содержимое. Кнопки не обрезаются. Двойной щелчок — автоматический размер"; g.appendChild(sz);
      sz.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation(); try { sz.setPointerCapture(e.pointerId); } catch (err) { /* уже отпущен */ }
        const r = g.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY; let moved = false;
        const mv = (ev) => { moved = true; Z.cgrpSize[g.dataset.g] = { w: Math.max(60, Math.round(r.width + ev.clientX - x0)), h: Math.max(24, Math.round(r.height + ev.clientY - y0)) }; sizeApply(g); };
        const up = () => { sz.removeEventListener("pointermove", mv); sz.removeEventListener("pointerup", up); sz.removeEventListener("pointercancel", up);
          if (moved) { const q = Z.cgrpSize[g.dataset.g]; Z.cgrpSize[g.dataset.g] = { w: Math.min(q ? q.w : 1e9, g.offsetWidth), h: g.offsetHeight }; place(g); save(); } };   // v0.332: помнится то, что видно
          /* v0.505, по снимку «Вида» в одну строку — «ширина съехала» (в настройках — 3922 px): запоминалась видимая ширина, а группа конструктора бывает шире
             заданной (перенос рисунка) — каждое касание ромба прибавляло. Теперь — не больше того, что задано ручкой */
        sz.addEventListener("pointermove", mv); sz.addEventListener("pointerup", up); sz.addEventListener("pointercancel", up);
      });
      sz.addEventListener("dblclick", (e) => { e.preventDefault(); e.stopPropagation(); if (!Z.cgrpSize[g.dataset.g]) return; delete Z.cgrpSize[g.dataset.g]; sizeApply(g); place(g); save(); });
    }
    sizeApply(g);
    /* v0.354, «прокрутка на группе кнопок — в Конусе например — так же, как на поле конуса, а не скролл панелей надо»: колесо над группой
       конуса (на полосе и поверх холста) — то же, что над холстом: масштаб конуса вокруг курсора; над группой на поле строк — листает
       строки. Стол с окнами при этом не едет. Группы на левой панели — как прежде (листают панель), число или список в фокусе — меняют
       своё значение, Ctrl + колесо — масштаб страницы */
    g.addEventListener("wheel", e => { if (g.parentElement === tl) solPanelWheel(g, e); }, { passive: false });
    // v0.061: any button is a grab surface; a stationary press still reaches its action.
    let replayButtonDown = false, cancelButtonGrab = null, deferredMouseDown = null;
    g.addEventListener("mousedown", e => {
      if (replayButtonDown || !cancelButtonGrab || e.button !== 0) return;
      deferredMouseDown = e; e.preventDefault(); e.stopImmediatePropagation();
    }, true);
    g.addEventListener("click", e => {
      if (performance.now() >= (g._solDragUntil || 0)) return;
      e.preventDefault(); e.stopImmediatePropagation();
    }, true);
    g.addEventListener("pointerdown", e => {
      const button = e.target.closest && e.target.closest('button,[role=button],label:has(input[type=checkbox],input[type=radio])');
      if (replayButtonDown || e.button !== 0 || !button || button.closest(".cgrp") !== g || button.disabled || button.querySelector("input:disabled") || document.body.classList.contains("cedit")) return;
      if (cancelButtonGrab) cancelButtonGrab();
      const focus = button.matches("label") ? button.querySelector("input") : button;
      if (focus) focus.focus({preventScroll:true});
      // Defer pointerdown actions too (steppers, hide/zen), so pulling cannot activate them.
      e.stopImmediatePropagation();
      const target = e.target, id = e.pointerId, x = e.clientX, y = e.clientY;
      const clean = () => {
        document.removeEventListener("pointermove", move, true);
        document.removeEventListener("pointerup", finish, true);
        document.removeEventListener("pointercancel", finish, true);
        window.removeEventListener("blur", clean); cancelButtonGrab = null; deferredMouseDown = null;
      };
      const move = ev => {
        if (ev.pointerId !== id || Math.hypot(ev.clientX-x, ev.clientY-y) < 6) return;
        clean();
        const drag = startGroupDrag({target:g,button:0,pointerId:id,clientX:x,clientY:y,shiftKey:e.shiftKey,altKey:e.altKey,preventDefault(){}});
        if (drag) { ev.preventDefault(); ev.stopImmediatePropagation(); drag(ev); }
      };
      const finish = ev => {
        if (ev.pointerId !== id) return;
        const mouseDown = deferredMouseDown; clean();
        if (ev.type !== "pointerup" || !target.isConnected) return;
        replayButtonDown = true;
        try {
          target.dispatchEvent(new PointerEvent("pointerdown", {
            bubbles:true,cancelable:true,pointerId:id,pointerType:e.pointerType,isPrimary:e.isPrimary,
            button:0,buttons:1,clientX:x,clientY:y,shiftKey:e.shiftKey,altKey:e.altKey,ctrlKey:e.ctrlKey,metaKey:e.metaKey
          }));
          if (mouseDown) target.dispatchEvent(new MouseEvent("mousedown", {
            bubbles:true,cancelable:true,button:0,buttons:1,clientX:x,clientY:y,
            shiftKey:e.shiftKey,altKey:e.altKey,ctrlKey:e.ctrlKey,metaKey:e.metaKey
          }));
        } finally { replayButtonDown = false; }
      };
      cancelButtonGrab = clean;
      document.addEventListener("pointermove", move, {capture:true,passive:false});
      document.addEventListener("pointerup", finish, true);
      document.addEventListener("pointercancel", finish, true);
      window.addEventListener("blur", clean);
    }, true);
    const startGroupDrag = (e) => {   // v0.315: прежде — только за подпись (lab), теперь за любое пустое место группы
      g._downLab = !!e.target.closest(".glab");   // v0.958: нажали на заголовок — щелчок и двойной щелчок о нём (после захвата указателя их цель — группа)
      if (e.button !== 0 || e.target.closest(NOGRAB)) return;
      e.preventDefault(); try { g.setPointerCapture(e.pointerId); } catch (err) { /* уже отпущен */ }
      /* v0.252: пока тащат — группа висит над всей страницей (.cdrag, position: fixed), отпустил — решается, куда: над левой панелью —
         встаёт туда (в ряд с другими, перед той, над которой отпустил), иначе — висит поверх холста, как прежде (Z.cgrpPos). */
      const r = g.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY, dx = x0 - r.left; let dy = y0 - r.top, moved = false, lx = x0, ly = y0;
      const grab=e.target.closest(".glab,button,label,select,textarea,input")||g;
      frontPanel(g); g._floor = false; g._ceil = false;
      /* v0.758, по снимку шести групп лазера, составленных вместе, — «как-то так объедини, не размагничивай их»: группа лазера (.cg-lx), что стоит поверх холста,
         тянется вместе со всеми группами лазера, которые с ней соприкасаются (и с их соседями — по цепочке): блок едет целиком, сцепки внутри него не рвутся,
         к чужим группам блок не цепляется и на левую панель / поле строк не встаёт. Одиночная группа лазера — как прочие */
      let mates = [];
      /* v0.760, «прилипли друг к другу, не оторвать»: блоком едет, только если тянуть верхнюю группу блока (ту, что сама ни к какой группе лазера не
         прицеплена); прицепленную тянешь — отрывается, как прежде (её прицепленные — следом); с Alt любая группа тянется одна */
      /* v0.764, «алгоритм не могу отцепить»: «Алгоритм» — табло, в блок не входит: тянешь его — едет один (прицепленные к нему остаются), блок без него */
      /* v0.765, «пусть всё можно отцеплять»: тянешь любую группу — отцепляется (её прицепленные — следом, как до v0.758); весь блок лазера — с Shift,
         с Alt — совсем одна (прицепленные к ней остаются на месте). «Алгоритм» в блок не входит */
      const solo = e.altKey || g.dataset.g === "алгоритм";
      if (e.shiftKey && !solo && g.classList.contains("cg-lx") && g.classList.contains("cfloat") && !g.classList.contains("cfld") && g.parentElement === tl) {
        const fl = groups.filter(o => o !== g && !Z.cgrpTop?.[o.dataset.g] && o.classList.contains("cg-lx") && o.dataset.g !== "алгоритм" && o.parentElement === tl && o.classList.contains("cfloat") && !o.classList.contains("cfld") && o.getClientRects().length);
        /* v0.759: соседи — сцепленные (Z.cgrpLink) или почти касаются: по вертикали — до полуряда (группы стоят по сетке рядов 24 px, и под сцепленной сверху
           бывает зазор в несколько px — с допуском 3 px блок рвался: «Алгоритм» уезжал один, остальные догоняли сцепками и упирались в край окна) */
        const T = TZC_H / Math.sqrt(3) + 3, V = TZC_H / 2 + 1, lk = (a, b) => { const L = Z.cgrpLink[a.dataset.g]; return !!L && L.to === b.dataset.g; };
        const near = (a, b) => { if (lk(a, b) || lk(b, a)) return true; const A = a.getBoundingClientRect(), B = b.getBoundingClientRect(); return A.left <= B.right + T && B.left <= A.right + T && A.top <= B.bottom + V && B.top <= A.bottom + V; };
        const seen = new Set([g]), q = [g];
        while (q.length) { const a = q.shift(); for (const o of fl) if (!seen.has(o) && near(a, o)) { seen.add(o); q.push(o); } }
        mates = [...seen].filter(o => o !== g).map(o => { const b = o.getBoundingClientRect(); return { o, dx: b.left - r.left, dy: b.top - r.top, w: b.width }; });
        mates.forEach(m => frontPanel(m.o)); frontPanel(g);
      }
      const mv = (ev) => {
        if (!moved && Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 4) return;
        g._solDragUntil = performance.now() + 400;
        if (!moved) { moved = true; g.style.width = r.width + "px"; g.classList.add("cdrag"); document.body.classList.add("cgdrag");
          nodeUnpin(g); mates.forEach(m => nodeUnpin(m.o));
          const L = Z.cgrpLink[g.dataset.g]; if (!(L && mates.some(m => m.o.dataset.g === L.to))) delete Z.cgrpLink[g.dataset.g];   // v0.502: потянул правую — отцепилась; v0.758: но не внутри блока лазера
          mates.forEach(m => { m.o.style.width = m.w + "px"; m.o.classList.add("cdrag"); });
          if (solo && g.classList.contains("cg-lx")) for (const [k, L] of Object.entries(Z.cgrpLink)) if (L && L.to === g.dataset.g) delete Z.cgrpLink[k]; }   // v0.760: Alt — совсем одна, прицепленные к ней остаются на месте
        lx = ev.clientX; ly = ev.clientY;
        // v0.068: переворот уже при удерживаемом указателе в полосе; хват остаётся под ним.
        const topStrip=$("top").getBoundingClientRect(),bottomStrip=$("sfzBottomGrid")?.getBoundingClientRect();
        const inside=b=>b&&lx>=b.left&&lx<=b.right&&ly>=b.top&&ly<=b.bottom;
        const strip=mates.length?null:inside(topStrip)?"top":inside(bottomStrip)?"bottom":null;
        if(strip){
          const key=g.dataset.g,wantUp=strip==="top";
          if(!!Z.sfzBookUp?.[key]!==wantUp){
            const before=grab.getBoundingClientRect().top-g.getBoundingClientRect().top;
            Z.sfzBookUp ||= {};if(wantUp)Z.sfzBookUp[key]=true;else delete Z.sfzBookUp[key];
            if(Z.sfzBookBottom)delete Z.sfzBookBottom[key];
            sfzGrapeSync(g);dy+=grab.getBoundingClientRect().top-g.getBoundingClientRect().top-before;
          }
        }
        { let [sx, sy] = mates.length ? [lx - dx, ly - dy] : snapXY(g, lx - dx, ly - dy, r.width, g.offsetHeight); g._pin = null;   // v0.366: магнит (у блока лазера — нет)
          const body = wb.getBoundingClientRect(), floor = body.bottom, ceiling = $("top").getBoundingClientRect().bottom;
          g._ceil = !mates.length && (strip==="top" || !strip && Math.abs(ly-dy-ceiling) <= 16);
          g._floor = !mates.length && sfzColumnGroup(g) && (strip==="bottom" || !strip && sx >= body.left - 1 && sx + r.width <= body.right + 1 && Math.abs(sy + g.offsetHeight - floor) <= 16);
          if (g._ceil) { sy = ceiling; g._floor = false; g._mesh = null; }
          else if (g._floor) sy = floor - g.offsetHeight;
          if(g._ceil || g._floor){sx=sfzStripFreeLeft(g,sx,g._ceil?"top":"bottom",sy,sy+g.offsetHeight);zSnapGlow([g._ceil?$("top"):$("sfzBottomGrid")]);}
          if (!mates.length && !strip) { const A=coneAxisScr();
            const edges=["head",...(g.querySelector(":scope > .sfz-book-cover")?["foot"]:[])].map(edge=>({edge,offset:solPanelAxisOffset(g,edge)})).sort((a,b)=>Math.abs(ly-dy+a.offset-(A?.y||0))-Math.abs(ly-dy+b.offset-(A?.y||0)));
            const {edge,offset}=edges[0],distance=A?Math.abs(ly-dy+offset-A.y):Infinity,edgeDistance=Math.min(g._ceil?Math.abs(ly-dy-ceiling):Infinity,g._floor?Math.abs(ly-dy+g.offsetHeight-floor):Infinity);if(A&&distance<=12&&distance<=edgeDistance){sy=A.y-offset;g._ceil=false;g._floor=false;g._mesh=null;g._pin=(sx-A.x)/(coneZoom||1);g._sfzAxisEdge=edge;}
          }   // v0.911: прищепка к оси
          g.style.left = sx.toFixed(2) + "px"; g.style.top = sy.toFixed(2) + "px";
          mates.forEach(m => { m.o.style.left = (sx + m.dx).toFixed(2) + "px"; m.o.style.top = (Math.round(sy) + m.dy).toFixed(2) + "px"; }); }
        linkSync();   // v0.502: прицепленные справа — следом
        solZoneGlow(mates.length ? null : solZoneOf(g.getBoundingClientRect(), [lx, ly]));
      };
      const up = () => {
        g.removeEventListener("pointermove", mv); g.removeEventListener("pointerup", up); g.removeEventListener("pointercancel", up);
        if (!moved) return;
        g._solDragUntil = performance.now() + 400;
        const gr = g.getBoundingClientRect(), zone = mates.length ? null : solZoneOf(gr, [lx, ly]); solZoneGlow(null);
        g.classList.remove("cdrag"); document.body.classList.remove("cgdrag"); sizeApply(g); const P = $("rowsPane"); if (P) P.classList.remove("cgover"); zSnapGlow([]);   // v0.400
        if (Z.cgrpPin) { delete Z.cgrpPin[g.dataset.g]; mates.forEach(m => delete Z.cgrpPin[m.o.dataset.g]); }   // v0.911: перенесли — прищепка снята (ниже ставится заново, если отпустили на оси)
        if (mates.length) {   // v0.758: блок лазера — встаёт там, куда отпустили, весь разом
          /* v0.759, «у меня строки справа, прилипают к правому краю, не даёт двигать группы»: места замерялись уже после снятия .cdrag — группа из «на весу»
             (fixed, от края экрана) становилась absolute с теми же left / top, но от края окна, и прыгала вбок на отступ окна; каждое перетаскивание уносило
             блок дальше, пока край окна не прижимал группы по одной (наезжали друг на друга). Теперь замер — пока на весу (у тащимой — gr, снят до этого),
             и в окно загоняется весь блок разом, общим сдвигом, а не каждая группа сама по себе */
          const tr = tl.getBoundingClientRect(), all = [g, ...mates.map(m => m.o)], at = all.map((x, i) => i ? x.getBoundingClientRect() : gr);
          mates.forEach(m => { m.o.classList.remove("cdrag"); sizeApply(m.o); });
          g._mesh = null;
          const L = Math.min(...at.map(q => q.left)), R = Math.max(...at.map(q => q.right)), T = Math.min(...at.map(q => q.top)), B = Math.max(...at.map(q => q.bottom));
          const wr = wb.getBoundingClientRect(), wt = wbTop(L, R - L);
          const sx = R - L > wr.width ? wr.left - L : Math.max(wr.left - L, Math.min(0, wr.right - R)), sy = B - T > wr.bottom - wt ? wt - T : Math.max(wt - T, Math.min(0, wr.bottom - B));
          all.forEach((x, i) => { delete Z.cgrpFld[x.dataset.g]; Z.cgrpPos[x.dataset.g] = { x: at[i].left + sx - tr.left, y: at[i].top + sy - tr.top }; place(x); });
          linkSync(); lasMesh(); save(); return;
        }
        if (!g._ceil && !g._floor && paneHit(lx, ly)) { delete Z.cgrpFld[g.dataset.g]; dock(g, lx, ly); save(); return; }
        if (g.parentElement !== tl) undock(g);
        if (g._floor || g._ceil || zone === "head") {
          const key=g.dataset.g, wr=$("w-cone").getBoundingClientRect();
          delete Z.cgrpFld[key];delete Z.cgrpLink[key];nodeSetPos(g,gr.left,gr.top);
          const side=g._floor?"bottom":"top";
          Z.sfzBookUp ||= {};if(side==="top")Z.sfzBookUp[key]=true;else delete Z.sfzBookUp[key];
          Z.cgrpTop ||= {};Z.cgrpTop[key]=sfzMenuPin(g,gr.left,side);
          sfzGrapeSync(g);place(g);linkSync();save();return;
        }
        if (zone) {
          Z.cgrpFld[g.dataset.g] = solZoneRec(zone, gr, solZoneRect(zone)); delete Z.cgrpPos[g.dataset.g];
          place(g); if (zone === "head" && window.zzHeaderPlace) window.zzHeaderPlace(g); grpFix(g); save(); return;
        }
        delete Z.cgrpFld[g.dataset.g];
        nodeSetPos(g,gr.left,gr.top);
        if (typeof g._pin === "number") { if (!Z.cgrpPin || typeof Z.cgrpPin !== "object") Z.cgrpPin = {}; Z.cgrpPin[g.dataset.g] = g._pin; Z.sfzBookAxisEdge ||= {};Z.sfzBookAxisEdge[g.dataset.g]=g._sfzAxisEdge||"head";g._mesh = null; delete Z.cgrpLink[g.dataset.g];   // v0.911: отпустили на оси — прищеплена
          say(`📌 «${g.dataset.g}» прищеплена к оси — при масштабе уезжает влево-вправо, за конусом едет; оторви от оси — снова свободная.`); }
        g._pin = null; place(g);
        { const m = g._mesh; g._mesh = null; attachMesh(g, m); linkSync(); }
        if (!Z.cgrpLink[g.dataset.g]) grpFix(g);   // v0.558: отпустил поверх другой — на ближайшее место рядом
        if (g.classList.contains("cg-lx")) lasMesh();   // v0.761: группы лазера бок о бок — зубцами
        save();
      };
      g.addEventListener("pointermove", mv); g.addEventListener("pointerup", up); g.addEventListener("pointercancel", up);
      return mv;
    };
    g.addEventListener("pointerdown", startGroupDrag);
    g._sfzStartGroupDrag = startGroupDrag;
    /* v0.072, «группы убери у всех шляпки и ножки; перемещать кнопки внутри группы правой кнопкой мыши, примагничивая к любой грани свободных; верхняя или
       нижняя одна или 2, которые самые, могут притягивать всю группу вниз или вверх в свободные места в полосках; синхронизируй их» (выбор: левой — вся группа
       за любую, правой — внутри; сворачивание — двойной щелчок по крайней (v0.073 — правый щелчок по крайней, v0.074 — по любой; правая протяжка снята); верх и низ зеркально). Правая протяжка ромба: он встаёт к свободной грани соседа
       (или на своё прежнее место); крайний ромб (верхний ряд вверх, нижний вниз) и свёрнутая гроздь тянут всю группу — в полосе она встаёт на свободное место.
       Места — Z.sfzGrapePos[группа] в виде «вниз»; в верхней полосе та же раскладка отражена. */
    if (sfzColumnGroup(g)) {
      const rItems = box => [...box.querySelectorAll(".sfz-grape-item")].filter(el => !el.classList.contains("sfz-grape-range") && !el.classList.contains("sfz-grape-hidden") && el.getClientRects().length);
      const freeGroup = () => { const key = g.dataset.g; return g.parentElement === tl && !Z.cgrpTop?.[key] && typeof Z.cgrpPin?.[key] !== "number" && !Z.cgrpEdge?.[key] && !Z.cgrpLink?.[key]; };
      /* v0.074, «не могу открепить от низа, пусть откреп только левой протяжкой по любой кнопке группы, а правая только по щелчку в любой кнопки группы
         сворачивает верх или низ группы»: правая протяжка больше ничего не двигает — ни ромб внутри, ни группу; переносит и открепляет только левая протяжка
         за любую кнопку (и затемнённую — см. lasDeps). Правый щелчок без протяжки по любой кнопке грозди, кроме бегунка, сворачивает её к ближнему краю:
         щелчок в верхней половине — остаются два верхних ромба, в нижней — два нижних; по свёрнутой — раскрывает. Места, расставленные правой протяжкой
         в v0.072–v0.073, остаются (Z.sfzGrapePos), новых она не ставит. */
      g.addEventListener("pointerdown", e => {
        if (e.button !== 2 || document.body.classList.contains("cedit")) return;
        const item = e.target.closest && e.target.closest(".sfz-grape-item"), box = g.querySelector(":scope > .cgb");
        if (!item || !box || item.closest(".cgrp") !== g || item.classList.contains("sfz-grape-range")) return;
        if (item.closest(".ldim") || item.querySelector(".ldim")) e.stopPropagation();   // затемнённая: правое нажатие — только сворачивание
        const id = e.pointerId, x0 = e.clientX, y0 = e.clientY, foldHit = g.classList.contains("cmin") || rItems(box).length > 2;
        let moved = false; g._sfzFoldHit = foldHit;
        const clean = () => { document.removeEventListener("pointermove", move, true); document.removeEventListener("pointerup", finish, true); document.removeEventListener("pointercancel", finish, true); };
        const move = ev => { if (ev.pointerId === id && Math.hypot(ev.clientX - x0, ev.clientY - y0) >= 6) moved = true; };
        const finish = ev => {
          if (ev.pointerId !== id) return;
          clean(); g._sfzRDragUntil = moved || foldHit ? performance.now() + 400 : 0;
          if (!moved && foldHit && ev.type === "pointerup") foldFlip(item);
        };
        document.addEventListener("pointermove", move, true);
        document.addEventListener("pointerup", finish, true);
        document.addEventListener("pointercancel", finish, true);
      }, true);
      // Правый щелчок по кнопке грозди — сворачивание: её второе действие и меню браузера не срабатывают (в Windows contextmenu приходит после отпускания, в других — при нажатии).
      g.addEventListener("contextmenu", e => { if (g._sfzFoldHit || performance.now() < (g._sfzRDragUntil || 0)) { g._sfzFoldHit = false; e.preventDefault(); e.stopPropagation(); } }, true);
      /* v0.073: свёрнутая гроздь — не меньше двух ромбов (крайний и ближайший к нему сосед по диагонали, sfzFoldPair); гроздь из двух не сворачивается.
         v0.074: край выбирает половина, где щёлкнули; крайний ромб остаётся на том же месте экрана, при раскрытии — щёлкнутый. */
      function foldFlip(item) {
        const box = g.querySelector(":scope > .cgb"); if (!box || document.body.classList.contains("cedit")) return;
        const key = g.dataset.g, on = !g.classList.contains("cmin"), gr = g.getBoundingClientRect(), wasFree = freeGroup();
        let anchor = item;
        Z.sfzFoldKeep ||= {};
        if (on) {
          const vis = rItems(box); if (vis.length <= 2) return;
          const px = (el, k) => parseFloat(el.style.getPropertyValue(k)) || 0, top = el => px(el, "--grape-y"), bottom = el => top(el) + (px(el, "--grape-h") || 48);
          const upper = top(item) + bottom(item) <= Math.min(...vis.map(top)) + Math.max(...vis.map(bottom));
          anchor = vis.slice().sort((a, b) => (upper ? top(a) - top(b) : bottom(b) - bottom(a)) || px(a, "--grape-x") - px(b, "--grape-x"))[0];
          Z.cgrpMin[key] = true; Z.sfzFoldKeep[key] = sfzFoldPair(vis, [sfzGrapeKey(anchor)]).map(sfzGrapeKey);
        } else delete Z.cgrpMin[key];
        const before = (g.querySelector(".sfz-fold-head")||anchor).getBoundingClientRect();
        g._sfzFolding = true;
        try { g.classList.toggle("cmin", on); g.style.minHeight = ""; sfzGrapeSync(g); }
        finally { g._sfzFolding = false; }
        if (wasFree) { const now = (g.querySelector(".sfz-fold-head")||anchor).getBoundingClientRect(); nodeSetPos(g, gr.left + before.left - now.left, gr.top + before.top - now.top); }
        place(g); linkSync(); save();
      }
      g._sfzFoldFlip = foldFlip;   // v0.081: стрелка свёрнутой грозди разворачивает её тем же путём
    }
    // v0.068: первый щелчок уже переключил; второй и dblclick ничего не сдвигают.
    g.addEventListener("dblclick", (e) => {
      if (!(g._downLab || e.target.closest(".glab")) || e.target.closest("button, input, select, textarea, label, .gzen, .gon, .gx, .cgsz") || performance.now() < (g._solDragUntil || 0)) return;
      e.preventDefault(); e.stopPropagation();
    });
    lab.addEventListener("contextmenu", (e) => {
      if (e.target.closest("button, .gzen, .gon, .gx")) return;
      e.preventDefault(); e.stopPropagation(); const key = g.dataset.g;
      delete Z.cgrpLink[key]; nodeUnpin(g); delete Z.cgrpFld[key]; delete Z.cgrpPos[key]; if (Z.cgrpMinPos) delete Z.cgrpMinPos[key];
      if (["звук", "кручение", "аниматрица", "алгоритм"].includes(key)) { Z.cgrpFld[key] = { z: "head", x: 0, y: 0 }; Z.cgrpMin[key] = true; g.classList.add("cmin"); sizeApply(g); }
      if (g.parentElement !== tl) undock(g); place(g); linkSync(); save();
    });
    place(g);
  });
  /* v0.252, «а сами панели вкладок — переносить на левую панель, чтоб там по 2–3 в ряду вставали» (группы конуса): группу тянут за
     заголовок на левую панель — она встаёт внизу панели в ряд с другими (сколько влезет в ширину — 2–3), перед той, над которой
     отпустили. Её край тянется мышью (двойной щелчок по краю — снова 250); v0.255: сама панель не расширяется, заголовок группы — сверху.
     Назад — вытащить за заголовок на холст или правый щелчок по заголовку (на полосу). Порядок — Z.cgrpDock, ширина — Z.paneW. */
  if (!Array.isArray(Z.cgrpDock)) Z.cgrpDock = [];
  const box = $("paneGrp"), head = $("paneGrpHead");
  // v0.400: магнит левой панели — ловит и в 40 px правее её края (как полоса магнита у Октаэдра)
  /* v0.571, по снимку «Группы конуса» на левой панели — «группы конуса не надо в левую панель, чтоб попадали»: панель группы больше не ловит
     (paneHit — всегда ложь, магнит и подсветка выключены); те, что уже стояли на панели, при загрузке возвращаются на полосу конуса,
     прежний список — в Z.cgrpDockOld (на случай «верни») */
  const PANE_DOCK = false;
  const paneHit = (x, y) => { if (!PANE_DOCK) return false; const P = $("rowsPane"); if (!P || !box || document.body.classList.contains("pane-icons")) return false; const q = P.getBoundingClientRect(); return x >= q.left && x <= q.right + 40 && y >= q.top && y <= q.bottom; };
  const dockSync = () => {
    Z.cgrpDock = box ? [...box.children].map(c => c.dataset.g) : [];
    if (head) head.style.display = Z.cgrpDock.length ? "" : "none";
    paneWApply(true);
  };
  const dock = (g, x, y) => {
    if (!box) return;
    delete Z.cgrpPos[g.dataset.g]; g.classList.remove("cfloat"); g.style.left = g.style.top = "";
    let before = null;
    for (const c of box.children) { if (c === g) continue; const q = c.getBoundingClientRect(); if (y < q.top || (y <= q.bottom && x < q.left + q.width / 2)) { before = c; break; } }
    box.insertBefore(g, before); dockSync();
  };
  const undock = (g) => {   // обратно на полосу — на своё место среди остальных
    const i = groups.indexOf(g), next = groups.slice(i + 1).find(c => c.parentElement === tl) || null;
    tl.insertBefore(g, next); dockSync();
  };
  const paneWApply = (auto) => {
    const R = document.documentElement.style;
    // v0.255, «ширину самого поля не менять, левого»: панель сама больше не расширяется — только если край тянули рукой
    if (auto && !Z.paneWUser) delete Z.paneW;
    /* v0.516, по снимку узкой левой панели — «помести текст в минимальную ширину и сделай её по умолчанию»: ширина панели — не меньше той, в которую
       входит самый длинный заголовок раздела (lpMinW); она же — по умолчанию (прежде 250 px) */
    const mw = lpMinW();
    if (Z.paneW && mw && Z.paneW < mw) { delete Z.paneW; delete Z.paneWUser; }   // v0.517: уже заголовков — значит «по умолчанию» (по заголовкам), не своя
    if (Z.paneW) R.setProperty("--paneW", Z.paneW + "px"); else if (mw) R.setProperty("--paneW", mw + "px"); else R.removeProperty("--paneW");
  };
  window.paneWApply = paneWApply;
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { paneWApply(false); if (typeof lpKick === "function") lpKick(); });
  if (box) {
    if (PANE_DOCK) for (const k of Z.cgrpDock) { const g = groups.find(c => c.dataset.g === k); if (g) box.appendChild(g); }
    else if (Z.cgrpDock.length) { Z.cgrpDockOld = Z.cgrpDock.slice(); [...box.children].forEach(g => undock(g)); }   // v0.571: с панели — на полосу
    dockSync();
    const edge = $("paneEdge");
    if (edge) {
      edge.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return; e.preventDefault(); try { edge.setPointerCapture(e.pointerId); } catch (err) {}
        const P = $("rowsPane"), w0 = P.getBoundingClientRect().width, x0 = e.clientX; document.body.classList.add("wdrag"); wShield(true);
        // v0.271: как у ширины поля — пока тянут, за мышью тонкая черта, ширина панели встаёт, когда отпустили (живая перекладка тормозила)
        const pr = P.getBoundingClientRect(); let lx = x0, raf = 0, done = false; const g = document.createElement("div"); g.id = "wGhost"; document.body.appendChild(g);
        const wAt = () => Math.round(Math.max(lpMinW() || 180, Math.min(innerWidth * 0.7, w0 + lx - x0)));   // v0.516: не уже заголовков
        const draw = () => { raf = 0; g.style.cssText = `left:${Math.round(pr.left + wAt()) - 1}px;top:${Math.round(pr.top)}px;height:${Math.round(pr.height)}px`; };
        draw();
        const mv = (ev) => { if (!(ev.buttons & 1)) { up(); return; } lx = ev.clientX; if (!raf) raf = requestAnimationFrame(draw); };
        const up = () => {
          if (done) return; done = true;
          edge.removeEventListener("pointermove", mv); edge.removeEventListener("pointerup", up); edge.removeEventListener("pointercancel", up); removeEventListener("pointerup", up, true); removeEventListener("blur", up);
          if (raf) cancelAnimationFrame(raf); g.remove(); wShield(false);
          if (wAt() !== Math.round(w0)) { Z.paneW = wAt(); Z.paneWUser = true; paneWApply(false); }
          document.body.classList.remove("wdrag"); save(); requestAnimationFrame(() => { if (typeof packWins === "function") packWins(); renderAll(); });
        };
        edge.addEventListener("pointermove", mv); edge.addEventListener("pointerup", up); edge.addEventListener("pointercancel", up); addEventListener("pointerup", up, true); addEventListener("blur", up);
      });
      edge.addEventListener("dblclick", () => { delete Z.paneWUser; paneWApply(true); save(); renderAll(); });
    }
  }
  // v0.256: дзен — отмеченные 🧘 группы с левой панели (её в дзене нет) на это время переезжают на полосу конуса, потом обратно
  window.cgrpZenMove = (on) => {
    if (on) { if (box) [...box.children].forEach(g => { if (g.classList.contains("zenon")) { g.classList.add("zentmp"); tl.appendChild(g); } }); return; }
    const back = groups.filter(g => g.classList.contains("zentmp"));
    back.forEach(g => { g.classList.remove("zentmp"); delete Z.cgrpPos[g.dataset.g]; if (box) box.appendChild(g); place(g); });
    if (box && back.length) { for (const k of Z.cgrpDock) { const g = groups.find(c => c.dataset.g === k); if (g && g.parentElement === box) box.appendChild(g); } }
  };
  // v0.258: у каждой кнопки группы — её «дом» (куда вернуть); перенесённые между группами — на свои места
  groups.forEach(g => { const b = g.querySelector(":scope > .cgb"); if (b) b.querySelectorAll("button, label, select, input, .cunit").forEach(el => { if (!el.dataset.home) el.dataset.home = g.dataset.g; }); });
  /* v0.757: «Лазер» разобран на шесть групп — записи «кнопка переставлена в группу „лазер“» (Z.cgrpMove, Z.btnMove) вернули бы кнопки, уехавшие в новые группы,
     обратно; один раз такие записи снимаются, прежние — копией рядом (Z.cgrpMove_pered_razborom, Z.btnMove_pered_razborom). Переносы в другие группы — как были */
  if (!Z.lasSplit) { Z.lasSplit = 1; const NEW = new Set(["солнце", "строка 1", "щели", "за чертой", "алгоритм"]);
    for (const [st, f] of [["cgrpMove", "g"], ["btnMove", "p"]]) { const M = Z[st]; if (!M || typeof M !== "object") continue; let bak = null;
      for (const [k, m] of Object.entries(M)) { if (!m || m[f] !== "лазер") continue; const el = cgrpMoveEl(cgrpRefEl(k)); if (!el || !NEW.has(el.dataset.home)) continue;
        if (!bak) bak = JSON.parse(JSON.stringify(M)); delete M[k]; }
      if (bak) Z[st + "_pered_razborom"] = bak; } }
  /* v0.766: 3D-кнопки вынесены из «Вида» в свою группу «3D» — так же один раз снимаются записи «переставлена внутри Вида» у тех, что уехали в «3D»
     (копия — Z.cgrpMove_pered_3d, Z.btnMove_pered_3d) */
  if (!Z.split3d) { Z.split3d = 1;
    for (const [st, f] of [["cgrpMove", "g"], ["btnMove", "p"]]) { const M = Z[st]; if (!M || typeof M !== "object") continue; let bak = null;
      for (const [k, m] of Object.entries(M)) { if (!m || m[f] !== "вид") continue; const el = cgrpMoveEl(cgrpRefEl(k)); if (!el || el.dataset.home !== "3d") continue;
        if (!bak) bak = JSON.parse(JSON.stringify(M)); delete M[k]; }
      if (bak) Z[st + "_pered_3d"] = bak; } }
  // v0.281: и исходный сосед справа (ссылкой, "" — последней): перенос в конец своей же группы теперь запоминается (прежде забывался)
  groups.forEach(g => { const b = g.querySelector(":scope > .cgb"); if (b) [...b.children].forEach(el => { const n = el.nextElementSibling, c = n && (n.tagName === "LABEL" ? n.querySelector("input") : n); el.dataset.home0 = c ? btnKey(c) : ""; }); });
  if (Z.cgrpMove && typeof Z.cgrpMove === "object") for (const [k, m] of Object.entries(Z.cgrpMove)) {
    const el = cgrpMoveEl(cgrpRefEl(k)), g = groups.find(c => c.dataset.g === m.g), cgb = g && g.querySelector(":scope > .cgb");
    if (!el || !cgb || el.contains(g)) continue;
    const bf = cgrpMoveEl(cgrpRefEl(m.before)); cgb.insertBefore(el, bf && bf.parentElement === cgb ? bf : null);
  }
  addEventListener("resize", () => groups.forEach(place));
  /* v0.367: снаружи (кнопка «🎨» в шапке) — открыть группу: снять «закрыта» и «свёрнута», мигнуть рамкой; если её всё равно не видно
     (окно конуса закрыто или свёрнуто) — поставить на левую панель. Закрыть — спрятать. Открыта ли и видна — cgrpShown */
  window.cgrpShown = (k) => { const g = groups.find(c => c.dataset.g === k); return !!g && !Z.cgrpOff[k] && !g.classList.contains("cmin") && g.getClientRects().length > 0; };
  window.cgrpHide = (k) => { const g = groups.find(c => c.dataset.g === k); if (!g) return; Z.cgrpOff[k] = true; g.classList.add("coff"); save(); if (window.palUi) palUi(); cgTabsUi(); };
  window.cgrpShow = (k, bringIntoView = false) => {
    const g = groups.find(c => c.dataset.g === k); if (!g) return;
    delete Z.cgrpOff[k]; g.classList.remove("coff");
    if (Z.cgrpMin[k]) { delete Z.cgrpMin[k]; g.classList.remove("cmin"); g.style.minHeight = ""; }
    cgbSnap(); sizeApply(g); place(g); linkSync();
    if (bringIntoView && !document.body.classList.contains("sol-mobile") && g.parentElement === tl) {
      const r = g.getBoundingClientRect(), br = wb.getBoundingClientRect(), tempo = $("coneTransportTempo");
      const left = Math.max(0, br.left), right = Math.min(innerWidth, br.right), top = Math.max(0, wbTop(r.left, r.width));
      const bottom = Math.min(innerHeight, br.bottom, tempo?.getClientRects().length ? tempo.getBoundingClientRect().top - 6 : innerHeight);
      const x = Math.max(left, Math.min(r.left, right - r.width)), y = Math.max(top, Math.min(r.top, bottom - r.height));
      if (Math.abs(x - r.left) > .5 || Math.abs(y - r.top) > .5) {
        nodeUnpin(g); delete Z.cgrpFld[k]; delete Z.cgrpLink[k]; delete Z.sfzBookBottom?.[k];
        nodeSetPos(g, x, y); place(g); linkSync();
      }
    }
    if (PANE_DOCK && !g.getClientRects().length && g.parentElement === tl && box && !document.body.classList.contains("pane-icons")) {   /* v0.579: на левую панель — больше нет */ delete Z.cgrpPos[k]; delete Z.cgrpFld[k]; g.classList.remove("cfloat", "cfld"); g.style.left = g.style.top = ""; box.appendChild(g); dockSync(); }
    frontPanel(g); g.classList.remove("cflash"); void g.offsetWidth; g.classList.add("cflash"); setTimeout(() => g.classList.remove("cflash"), 1600);
    try { g.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (err) { /* нет места */ }
    save(); if (window.palUi) palUi(); cgTabsUi();
  };
  // v0.925: в верхней полосе только действия; группы открываются собственными заголовками слева.
  const cgTabs = document.createElement("div"); cgTabs.id = "cgTabs";
  const solHead = $("w-cone").querySelector(":scope > .whead");
  if (solHead) { solHead.classList.add("sol-header"); solHead.insertBefore(cgTabs, solHead.querySelector("button")); }
  else wb.insertBefore(cgTabs, tl);
  /* v0.842, по снимку шапки окна — «кнопка «Лазер» — подвинь правее, наложилась на что-то, заголовок похоже»: шапка окна конуса лежит поверх тела
     (position: absolute), а полоса вкладок — над ней по слою и закрывала «◯ Solarius». Первой в полосе — пустая вставка шириной до конца заголовка */
  { const sp = document.createElement("span"); sp.className = "cgtsp"; cgTabs.insertBefore(sp, cgTabs.firstChild);
    const hd = $("w-cone").querySelector(".whead");
    const fit = () => { const wt = hd && hd.querySelector(".wt"); let w = 0;
      if (cgTabs.parentElement !== hd && wt && hd.getClientRects().length && hd.offsetWidth && getComputedStyle(hd).position === "absolute") {
        const r = document.createRange(); r.selectNodeContents(wt); const tr = r.getBoundingClientRect(); if (tr.width) w = Math.max(0, Math.ceil(tr.right - cgTabs.getBoundingClientRect().left + 10)); }
      const ws = w + "px"; if (sp.style.width !== ws) sp.style.width = ws; };
    fit(); if (window.ResizeObserver && hd) new ResizeObserver(fit).observe(hd); addEventListener("resize", fit); setTimeout(fit, 600); }
  { const hU = () => wb.style.setProperty("--cgTabsH", (solHead && solHead.getClientRects().length ? solHead.offsetHeight : cgTabs.offsetHeight) + "px"); hU(); if (window.ResizeObserver) new ResizeObserver(hU).observe(solHead || cgTabs); }
  /* v0.587, по снимку «📝 Текст» в шапке — «эту в конус-кнопки перемести»: кнопка текста конуса и лога лазера — последней вкладкой в полосе групп
     (тот же элемент, обработчики при нём; горит, пока открыта полоса текста) */
  { const tb = $("bConeTxt"); if (tb) { tb.style.setProperty("--tc", "#e2c06b"); cgTabs.appendChild(tb); } }
  function cgTabsUi(){ groups.forEach(g => {
    const bt = g.querySelector(".gfold"); if (bt) solFoldButton(bt, !!Z.cgrpMin[g.dataset.g], solPanelName(g));
  }); }
  window.cgTabsUi = cgTabsUi;
  { const mo = new MutationObserver(() => cgTabsUi()); groups.forEach(g => mo.observe(g, { attributes: true, attributeFilter: ["class"] })); }
  cgTabsUi();
  { // v0.348: поле строк меняет место и размер (ширина поля, панель, спрятать, дзен) — группы на нём едут следом
    const re = () => panels().forEach(g => { if (zrec(g) && !g.classList.contains("cdrag") && !g.classList.contains("pdrag")) nodePlace(g); });   // тащимую — не трогать; v0.954: и плашки, и левая панель
    if (window.ResizeObserver) { const ro = new ResizeObserver(re); for (const id of ["field", "rowsPane"]) { const A = $(id); if (A) ro.observe(A); } }
    new MutationObserver(re).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }
  cgrpCols();
  cgbIcons();   // v0.317: подписи кнопок меняются (▶ / ⏸, «только значки») — пересчёт, кто значок
  /* v0.827, «подтормаживает на каждом обороте кручения»: во время кручения внутри групп каждый кадр меняется только текст-показ — число у ползунка (.rv, .sli)
     и строка «вариантов цикла… сейчас N» (#coneVarN). Наблюдатель на каждую такую смену пересобирал все группы (cgbSnap + triTag, 100–200 мс) — кадр вставал.
     Такие правки раскладку кнопок не меняют — их наблюдатель теперь пропускает */
  const cgbTextOnly = (ms) => ms.every(m => {
    if (m.type === "childList" && [...m.addedNodes, ...m.removedNodes].every(n => n.nodeType === 3) && [...m.addedNodes].map(n => n.textContent).join("") === [...m.removedNodes].map(n => n.textContent).join("")) return true;
    const x = m.target.nodeType === 1 ? m.target : m.target.parentElement; return !!(x && x.closest && x.closest(".rv, .sli, #coneVarN, #lasAlgo, .gfold"));
  });
  { let t = 0; const mo = new MutationObserver((ms) => { if (cgbTextOnly(ms)) return; if (!t) t = requestAnimationFrame(() => { t = 0; cgbIcons(); cgbSnap(); }); });   // v0.335: и ширины 1 / 2 / 4
    groups.forEach(g => mo.observe(g, { childList: true, characterData: true, subtree: true })); }
  cgbSnap();
  // v0.063: после раскрытия и смены размеров шапка остаётся в поле, нижняя прищепка — у пола.
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(entries => { entries.forEach(({ target: g }) => place(g)); linkSync(); });
    groups.filter(sfzColumnGroup).forEach(g => ro.observe(g));
  }
  solPanelOrganizeInit({ tl, wb, groups, panels, sizeApply, place, nodePlace, nodeSetPos, nodeUnpin, linkSync, gByKey, wbTop, cgTabs, cgTabsUi });

  // v0.963: родные заголовки групп в шапке, в отдельной области после названия и кнопок.
  if (solHead) {
    const dock = document.createElement("div"); dock.id = "solHeaderDock"; document.body.appendChild(dock);
    dock.setAttribute("aria-label", "Группы в нижней полосе");
    const slots = new Map(); let busy = false, raf = 0;
    const sync = () => {
      if (busy) return; busy = true;
      try {
        const members = panels().filter(g => zrec(g)?.z === "head" && !g.hidden && !g.classList.contains("coff"));
        dock.classList.toggle("leftdock", !!Z.solHeaderLeft && members.length > 0);
        const keys = new Set(members.map(g => g.dataset.g));
        for (const [key, slot] of slots) if (!keys.has(key)) { slot.remove(); slots.delete(key); }
        Z.solHeaderOrder ||= [];
        members.forEach(g => { if (!Z.solHeaderOrder.includes(g.dataset.g)) Z.solHeaderOrder.push(g.dataset.g); });
        members.sort((a, b) => Z.solHeaderOrder.indexOf(a.dataset.g) - Z.solHeaderOrder.indexOf(b.dataset.g));
        members.forEach(g => {
          const key = g.dataset.g; let slot = slots.get(key);
          if (!slot) {
            slot = document.createElement("span"); slot.className = "sol-header-slot"; slot.dataset.g = key; slots.set(key, slot); dock.appendChild(slot);
            const button = document.createElement("button"); button.type = "button"; button.textContent = solPanelName(g) + " −"; slot.appendChild(button);
            button.title = solPanelName(g) + ": щелчок — свернуть / развернуть здесь; двойной щелчок — вернуть раскрытой на прежнее место";
            button.style.color = getComputedStyle(g.querySelector(".glab, .smh, .rth") || g).color;
            button.onclick = e => { e.stopPropagation(); if (e.detail < 2) solMenuClick(g, () => g._solFold ? g._solFold() : plateFoldToggle(g)); };
            button.ondblclick = e => { e.preventDefault(); e.stopPropagation(); clearTimeout(g._solClickTimer); g._solClickTimer = 0; if (g._solDockToggle) g._solDockToggle(); else solPlateDockToggle(g); };
          }
          const button = slot.firstElementChild, folded = solPanelFolded(g);
          if (button.hidden !== folded) button.hidden = folded;
          const width = Math.max(128, g.offsetWidth);
          if (slot.style.width !== width + "px") slot.style.width = width + "px";
          if (dock.children[members.indexOf(g)] !== slot) dock.insertBefore(slot, dock.children[members.indexOf(g)] || null);
        });
      } finally { busy = false; }
    };
    window.zzHeaderPlace = g => {
      sync(); const slot = slots.get(g.dataset.g), fr = solZoneRect("head"); if (!slot || !fr) return;
      const r = slot.getBoundingClientRect(), folded = solPanelFolded(g);
      const x = folded ? r.left : Math.max(fr.left, Math.min(r.left, innerWidth - g.offsetWidth - 4));
      const y = folded && sfzColumnGroup(g) ? Math.min(r.top, wb.getBoundingClientRect().bottom - g.offsetHeight) : folded ? r.top : Math.max(4, fr.top - g.offsetHeight);
      g.style.left = Math.round(x) + "px"; g.style.top = Math.round(y) + "px";
      g.style.zIndex = "650";
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; sync(); panels().filter(g => zrec(g)?.z === "head" && !g.classList.contains("cdrag") && !g.classList.contains("pdrag")).forEach(nodePlace); }); };
    if (window.ResizeObserver) new ResizeObserver(kick).observe(solHead);
    const mo = new MutationObserver(kick); panels().forEach(g => mo.observe(g, { attributes: true, attributeFilter: ["class", "hidden"] }));
    addEventListener("resize", kick);
    const migrate = () => { if (!Z.solHeaderV) {
      Z.solHeaderV = 1; Z.solHeaderOrder = ["звук", "кручение", "аниматрица", "алгоритм"];
      Z.solHeaderOrder.forEach(key => { const g = groups.find(g => g.dataset.g === key); if (!g) return;
        nodeUnpin(g); delete Z.cgrpLink[key]; delete Z.cgrpPos[key]; delete Z.cgrpOff[key]; if (Z.cgrpMinPos) delete Z.cgrpMinPos[key];
        for (const [other, link] of Object.entries(Z.cgrpLink)) if (link?.to === key) delete Z.cgrpLink[other];
        Z.cgrpFld[key] = { z: "head", x: 0, y: 0 }; Z.cgrpMin[key] = true;
        g.classList.remove("coff"); g.classList.add("cmin"); sizeApply(g);
      });
      save();
    } kick(); };
    if ((Z.solPanelArrangeV | 0) < 2) {
      const ready = document.fonts && document.fonts.ready || Promise.resolve();
      ready.then(() => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(migrate))));
    } else migrate();
    kick();
  }
}

function c3RstPlace(){   // v0.811: ⌖✕ сброс — на вертикали через центр конуса, у нижнего края холста, поверх всего
  const b = document.getElementById("bC3Reset"), cv = document.getElementById("coneCv"); if (!b || !cv || b.parentElement === document.getElementById("cone3Pad")) return;
  // v0.1013: абсолютные кнопки привязаны к offsetParent; статическое тело окна давало лишний отступ снизу.
  const host = b.parentElement, anchor = b.offsetParent || host, hr = anchor.getBoundingClientRect(), cr = cv.getBoundingClientRect(); if (!cr.width || !hr.width) return;
  const scrollLeft = anchor.scrollLeft - anchor.clientLeft, scrollTop = anchor.scrollTop - anchor.clientTop;
  // v0.042: пуск — ромб темпа, шаги — на его краях; в нижнем ряду остаются старт и сброс.
  // v0.047: центр нижнего пульта привязан к оси, как верхние балансы.
  const vr = host.getBoundingClientRect(), viewLeft = Math.max(0, vr.left), viewRight = Math.min(document.documentElement.clientWidth, vr.right);
  const phone=document.body.classList.contains("sol-mobile");
  const bottom = Math.min(phone?cr.bottom:vr.bottom, innerHeight) - hr.top + scrollTop;
  const left = viewLeft - hr.left + scrollLeft + 4, edge = viewRight - hr.left + scrollLeft - 4, gap = 2;
  const axis = coneAxisScr(), centre = axis ? axis.x - hr.left + scrollLeft : cr.left - hr.left + scrollLeft + (coneGeom && coneGeom.dpr ? coneGeom.cx / coneGeom.dpr : cr.width / 2);
  const ms = $("c3Modes");
  const put = (e, X, Y) => {
    const parent = e.offsetParent || host, r = parent.getBoundingClientRect();
    const l = (X + hr.left - scrollLeft - r.left - parent.clientLeft + parent.scrollLeft).toFixed(1) + "px";
    const t = (Y + hr.top - scrollTop - r.top - parent.clientTop + parent.scrollTop).toFixed(1) + "px";
    if (e.style.left !== l) e.style.left = l; if (e.style.top !== t) e.style.top = t;
  };
  const startButton = $("bConeStartBack"), speed = $("coneAutoSp"), speedLabel = speed && speed.closest("label");
  for (const [id, control] of [["coneTransportStart", startButton], ["coneTransportTempo", speedLabel]]) {
    if (!control) continue;
    let box = $(id); if (!box) { box = document.createElement("div"); box.id = id; box.className = "tools"; host.appendChild(box); }
    box.classList.remove("lpw");   // v0.023: не в цепочку треугольников lpTools — у пульта своя форма
    if (control.parentElement !== box) box.appendChild(control);
    control.classList.remove("sfz-grape-item","sfz-grape-range","sfz-grape-editor","sfz-grape-large","sfz-grape-symbol");
    for(const key of ["grapeCaption","grapeFull"])delete control.dataset[key];
    control.querySelectorAll(":scope > .sfz-grape-icon").forEach(e=>e.remove());
    for(const key of ["--grape-x","--grape-y","--grape-w","--grape-h"])control.style.removeProperty(key);
    if (control.classList.contains("tz")) triOff(control);   // v0.023: без сцепки групп — она ставила ширину с !important (темп сжимался до 138 px, ползунок — до нуля)
  }
  const startBox = $("coneTransportStart"), tempoBox = $("coneTransportTempo");
  tempoTrackSync();
  const size = (e) => e && e.parentElement === host ? e.offsetWidth : 0;
  const ws = Math.max(size(startBox), startButton ? startButton.offsetWidth : 0), wr = b.offsetWidth || 60, rh = Math.max(b.offsetHeight || 30, startBox ? startBox.offsetHeight : 0);
  const mw = ms && ms.parentElement === host ? ms.offsetWidth : 0, modeGap = mw ? gap : 0;
  const modesBelow = ws + gap + wr + modeGap + mw > edge - left;
  const rowWidth = ws + gap + wr + (modesBelow ? 0 : modeGap + mw);
  // v0.066: третья из пяти кнопок режима строго на оси; сброс слева, старт справа, зазоры одинаковы.
  const modeLeft = centre - mw / 2, rowLeft = modesBelow ? centre - (wr + gap + ws) / 2 : modeLeft - modeGap - wr, x = rowLeft, startLeft = modesBelow ? x + wr + gap : modeLeft + mw + modeGap, rowRight = rowLeft + rowWidth;
  const lift = modesBelow ? ms.offsetHeight + gap : 0;
  const y = bottom - rh - lift, base = bottom - lift, on = (e) => base - (e.offsetHeight || rh);   // v0.024: кнопки разной высоты (▶ крупнее) — на одном нижнем крае
  if (startBox && ws) put(startBox, startLeft, on(startBox));
  put(b, x, on(b));
  if (tempoBox) {
    const tw = Math.max(0, Math.min(480, edge - left));   // Ползунок и весь ряд кнопок — по центру окна.
    tempoBox.style.width = tw.toFixed(1) + "px";
    put(tempoBox, centre - tw / 2, Math.max(cr.top - hr.top + scrollTop + 2, y - gap - (tempoBox.offsetHeight || 36)));
    tempoTrackSync();
  }
  { const cb=$("bSfzClean"), zoom=$("bC3ZoomOut");
    if(cb && cb.parentElement===host && zoom){const zr=zoom.getBoundingClientRect();put(cb,zr.left-hr.left+scrollLeft+(zr.width-cb.offsetWidth)/2,zr.top-hr.top+scrollTop-cb.offsetHeight-6);}
  }   // ◐ «только управление» — над парой масштаба − / +.
  // Режимы — у самого нижнего края справа от пульта; на узком холсте пульт стоит над ними.
  if (mw) put(ms, modesBelow ? centre - mw / 2 : modeLeft, modesBelow ? bottom - ms.offsetHeight : on(ms));
  const caption = document.getElementById("coneVarN");
  if (caption && caption.parentElement === host) {
    // v0.050: короткая подпись у видимого левого края, под горизонтальной осью.
    const X = left + 4, available = Math.max(0, edge - X);
    const axisY = axis ? axis.y : cr.top + (coneGeom && coneGeom.dpr ? coneGeom.cy / coneGeom.dpr : cr.height / 2);
    caption.style.maxWidth = available.toFixed(1) + "px";
    put(caption, X, axisY - hr.top + scrollTop + 6);
  }
}

function tempoContourSync(label, tx){
  const back=$("bC3StepB"), forward=$("bC3StepF"); if(!back || !forward)return;
  let svg=label.querySelector(":scope > .tempoHourglass");
  if(!svg){
    const ns="http://www.w3.org/2000/svg";
    svg=document.createElementNS(ns,"svg"); svg.classList.add("tempoHourglass");
    svg.setAttribute("aria-hidden","true"); svg.setAttribute("focusable","false");
    svg.appendChild(document.createElementNS(ns,"path")); label.appendChild(svg);
  }
  const width=label.offsetWidth, height=label.offsetHeight;
  const viewBox=`0 0 ${width} ${height}`;
  if(svg.getAttribute("viewBox")!==viewBox)svg.setAttribute("viewBox",viewBox);
  const left=back.offsetLeft+back.offsetWidth, right=forward.offsetLeft;
  const top=back.offsetTop+.5, bottom=back.offsetTop+back.offsetHeight-.5, mid=height/2;
  const d=`M${left} ${top}L${tx} ${mid}L${left} ${bottom}Z M${right} ${top}L${tx} ${mid}L${right} ${bottom}Z`;
  const path=svg.firstElementChild; if(path.getAttribute("d")!==d)path.setAttribute("d",d);
}

function tempoTrackSync(){
  const r = $("coneAutoSp"), L = r && r.closest("#coneTransportTempo > label"); if (!L || !L.offsetWidth) return;
  tempoControlsSetup(r, L);
  if (!r._tempoBound) { r._tempoBound = true; r.addEventListener("input", tempoTrackSync); }
  const lw = L.offsetWidth;
  // The play diamond follows the actual range position, including keyboard/track changes.
  const rr=r.getBoundingClientRect(), lr=L.getBoundingClientRect(), f=(+r.value-(+r.min||0))/Math.max(1,(+r.max||100)-(+r.min||0));
  const thumbWidth=$("coneTempoToggle")?.offsetWidth || 48;
  const tx=rr.left-lr.left+thumbWidth/2+f*Math.max(1,rr.width-thumbWidth);
  const set = (k, v) => { if (L.style.getPropertyValue(k) !== v) L.style.setProperty(k, v); };
  set("--tx", tx.toFixed(1) + "px"); set("--ta", (tx - 3).toFixed(1) + "px");
  tempoContourSync(L, tx);
  const value = $("coneAutoSpV");
  if (value) { const vw = value.offsetWidth, right = tx + 78, vx = right + vw <= lw - 10 ? right : tx - 78 - vw;
    set("--vx", Math.max(30, Math.min(lw - 30 - vw, vx)).toFixed(1) + "px"); }
  const thumb = $("coneTempoToggle"), on = !!($("bConeAuto") && $("bConeAuto").classList.contains("on"));
  L.classList.toggle("playing", on);
  if (thumb) {
    thumb.classList.toggle("on", on); thumb.setAttribute("aria-pressed", String(on));
    let glyph = thumb.querySelector(".tempoPlayGlyph");
    if (!glyph) { glyph = document.createElement("span"); glyph.className = "tempoPlayGlyph"; thumb.replaceChildren(glyph); }
    const text = on ? "⏸" : "▶"; if (glyph.textContent !== text) glyph.textContent = text;
  }
}

function tempoControlsSetup(r, L){
  const wrap = r.closest(".zerk-range-wrap"); if (!wrap) return;
  wrap.querySelectorAll(".zerk-arrow").forEach(b => b.remove());
  for (const id of ["bC3StepB", "bC3StepF"]) { const b = $(id); if (b && b.parentElement !== wrap) wrap.appendChild(b); }
  const value = $("coneAutoSpV"); if (value && value.parentElement !== L) L.appendChild(value);
  if ($("coneTempoToggle")) return;
  const thumb = document.createElement("button"); thumb.id = "coneTempoToggle"; thumb.type = "button";
  thumb.title = "Щелчок — пуск / пауза. Перетаскивание ромба — темп."; thumb.setAttribute("aria-label", "Пуск / пауза; перетаскивание меняет темп");
  L.appendChild(thumb);
  let drag = null;
  thumb.addEventListener("pointerdown", e => {
    if (e.button !== 0 || drag) return; e.preventDefault(); e.stopPropagation();
    drag = { id:e.pointerId, x:e.clientX, y:e.clientY, value:+r.value, width:Math.max(1,r.getBoundingClientRect().width - thumb.offsetWidth), moved:false };
    thumb.setPointerCapture(e.pointerId);
  });
  thumb.addEventListener("pointermove", e => {
    if (!drag || drag.id !== e.pointerId) return; e.preventDefault(); e.stopPropagation();
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
    drag.moved = true;
    const mn = +r.min || 0, mx = +r.max || 100, step = +r.step || 1;
    r.value = String(Math.max(mn,Math.min(mx,mn + Math.round((drag.value + (e.clientX-drag.x)*(mx-mn)/drag.width - mn)/step)*step)));
    r.dispatchEvent(new Event("input", {bubbles:true}));
  });
  const finish = (e, cancel) => {
    if (!drag || drag.id !== e.pointerId) return; e.preventDefault(); e.stopPropagation();
    const moved = drag.moved; drag = null;
    if (thumb.hasPointerCapture(e.pointerId)) thumb.releasePointerCapture(e.pointerId);
    if (moved) r.dispatchEvent(new Event("change", {bubbles:true}));
    else if (!cancel) $("bConeAuto").click();
  };
  thumb.addEventListener("pointerup", e => finish(e,false));
  thumb.addEventListener("pointercancel", e => finish(e,true));
  thumb.addEventListener("lostpointercapture", () => { if (drag && drag.moved) r.dispatchEvent(new Event("change", {bubbles:true})); drag = null; });
  thumb.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); if (e.detail === 0) $("bConeAuto").click(); });
}

function lpWin(col, vis){
  const t = TZC_H / (2 * Math.sqrt(3)), sd = 2 * t;
  document.querySelectorAll(".win > .whead").forEach(h => {
    h.classList.add("lpt");
    if (!h._lpObs && lpTag._mo) { h._lpObs = 1; lpTag._mo.observe(h, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden", "style"] }); lpTag._mo.observe(h.parentElement, { attributes: true, attributeFilter: ["class"] }); }
    if (!vis(h)) return;
    const runs = []; let run = [];
    [...h.children].forEach(el => { if (el.tagName === "BUTTON") { if (vis(el)) run.push(el); } else if (vis(el) && run.length) { runs.push(run); run = []; } });
    if (run.length) runs.push(run);
    runs.forEach(r => r.forEach((b, i) => {
      const colorKey = [...b.classList].filter(c => c !== "tz").join(" ") + "|" + h.parentElement.className + "|" + document.documentElement.className + "|" + document.documentElement.style.cssText + "|" + Z.theme + "|" + Z.noLn;
      if (b._lpColorKey !== colorKey) { b.classList.remove("tz"); b._lpBorderColor = getComputedStyle(b).borderTopColor; b.classList.add("tz"); b._lpColorKey = colorKey; }
      const bc = b._lpBorderColor;
      const rg = document.createRange(); rg.selectNodeContents(b); const tw = sharedMenuTextWidth(b,rg);
      b._gcol = tzLnBg() || bc || col; b._tzar = ""; b._tzfix = true;
      b._tzL = i === 0 ? TZ_TIP : TZ_NOTCH; b._tzR = TZ_TIP; b._tzm = i === 0 ? 0 : 1;
      b._tzn = b._tzn0 = Math.max(2, Math.ceil((tw + 8) / sd));
      tzGeo(b);
    }));
  });
}

function lpTools(col, vis){
  const t = TZC_H / (2 * Math.sqrt(3)), sd = 2 * t;
  document.querySelectorAll(".win .tools.lpw").forEach(bar => {
    if (!bar._lpObs && lpTag._mo) { bar._lpObs = 1; lpTag._mo.observe(bar, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] }); if (lpRO) lpRO.observe(bar); }
    if (!vis(bar)) return;
    const flat = (els) => els.flatMap(el => el.tagName === "SPAN" && !el.classList.contains("zerk-range-wrap") && getComputedStyle(el).display === "contents" ? flat([...el.children]) : [el]);   // v0.798: растворённая обёртка (display: contents) — её кнопки в общей цепочке
    const its = flat([...bar.children]).filter(el => vis(el) && (el.tagName === "BUTTON" || el.tagName === "SELECT" || el.tagName === "LABEL"));
    its.forEach((b, i) => {
      b.classList.remove("tz"); const bc = getComputedStyle(b).borderTopColor; b.classList.add("tz");
      let tw = 0;
      /* v0.799, по снимку «👓 возраст» — «не меняй ширину кнопок»: кнопка, чья надпись меняется по кругу (data-labels — все надписи через «|»), и список —
         шириной по самой длинной надписи, а не по нынешней: переключение не двигает соседей */
      const mt = (txt) => { const c = lpTools._c || (lpTools._c = document.createElement("canvas").getContext("2d")); c.font = getComputedStyle(b).font; return c.measureText(txt).width; };
      if (b.tagName === "SELECT") { tw = Math.max(0, ...[...b.options].map(o => [...o.text].length * 7 + 14)); }
      else if (b.dataset && b.dataset.labels) { tw = Math.max(...b.dataset.labels.split("|").map(mt)); }
      else if (b.tagName === "LABEL" && b.querySelector("input[type=range]")) { const txt = [...b.childNodes].filter(n => n.nodeType === 3 || (n.nodeType === 1 && n.tagName === "SPAN" && !n.classList.contains("zerk-range-wrap"))).map(n => n.textContent).join("").trim(); tw = [...txt].length * 7 + 120; }
      else if (b.tagName === "LABEL" && b.querySelector("input[type=color]")) { tw = [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join("").length * 7.5 + 32; }   // v0.798: подпись + образец цвета 22 px
      else { const rg = document.createRange(); rg.selectNodeContents(b); tw = sharedMenuTextWidth(b,rg); if (b.tagName === "LABEL") tw -= 16; }
      b._gcol0 = tzLnBg() || (b.tagName === "BUTTON" ? bc : "") || col; b._gcol = (b.dataset && b.dataset.gcol) || b._gcol0; b._tzar = ""; b._tzfix = true;   // v0.791: data-gcol — свой цвет обводки (▲▼ по режиму)
      b._tzL = i === 0 ? TZ_TIP : TZ_NOTCH; b._tzR = TZ_TIP; b._tzm = i === 0 ? 0 : 1;
      b._tzn = b._tzn0 = Math.max([...b.textContent.trim()].length <= 2 ? 2 : 3, Math.ceil((tw + 10) / sd));
      tzGeo(b);
    });
    its.forEach((b, i) => { if (i && b._tzm && Math.abs(b.offsetTop - its[i - 1].offsetTop) > 4) { b._tzm = 0; b._tzL = TZ_TIP; tzGeo(b); } });
  });
}

function solPanelAxisOffset(el,edge=Z.sfzBookAxisEdge?.[el.dataset.g]||"head"){
  const head=edge==="foot"?el.querySelector(":scope > .sfz-book-cover"):el.querySelector(":scope > .glab, :scope > .smh, :scope > .rth");
  if (!head || !head.getClientRects().length) return 0;
  const r=head.getBoundingClientRect(); return r.top+r.height/2-el.getBoundingClientRect().top;
}

function sfzMenuGridOrigin(){
  // v0.068: общий центр меню — центр экрана, как у возвращённой оси.
  return innerWidth/2-300;
}

function sfzMenuGridLeft(g,left){
  const origin=sfzMenuGridOrigin(),half=g.offsetWidth/2;
  return origin+Math.round((left+half-origin)/30)*30-half;
}

function sfzStripFreeLeft(g,left,side,top,bottom){
  const w=g.offsetWidth,busy=[],add=r=>{if(r.width&&r.bottom>top&&r.top<bottom)busy.push([r.left,r.right]);};
  for(const o of document.querySelectorAll(".sfz-grape"))if(o!==g&&!o.classList.contains("cdrag")&&o.getClientRects().length&&Z.cgrpTop?.[o.dataset.g]?.side===side)add(o.getBoundingClientRect());
  if(side==="bottom")for(const id of ["bC3Reset","c3Modes","coneTransportStart"]){const e=$(id);if(e&&e.getClientRects().length)add(e.getBoundingClientRect());}
  const origin=sfzMenuGridOrigin(),k0=Math.round((left+w/2-origin)/30);
  for(let d=0;d<120;d++)for(const k of d?[k0+d,k0-d]:[k0]){const L=origin+k*30-w/2;if(L<0||L+w>innerWidth)continue;if(busy.every(([a,b])=>L+w<=a+.5||L>=b-.5))return L;}
  return origin+k0*30-w/2;
}

function sfzMenuPin(g,left,side){
  const wr=$("w-cone").getBoundingClientRect(),axis=coneAxisScr();
  const mesh=Math.round((left+g.offsetWidth/2-sfzMenuGridOrigin())/30);
  left=sfzMenuGridOrigin()+mesh*30-g.offsetWidth/2;
  return {x:(left-wr.left)/Math.max(1,wr.width-g.offsetWidth),side,mesh,menuAnchor:true,...(axis?{axisDx:(left+g.offsetWidth/2-axis.x)/Math.max(.00001,coneZoom)}:{})};
}

function sfzMenuGridSync(rect){
  let grid=$("sfzBottomGrid");
  if(!grid){grid=document.createElement("div");grid.id="sfzBottomGrid";grid.setAttribute("aria-hidden","true");document.body.appendChild(grid);}
  grid.style.left=rect.left+"px";grid.style.top=(rect.bottom-30)+"px";grid.style.width=rect.width+"px";
  grid.style.backgroundPosition=(sfzMenuGridOrigin()-rect.left)+"px 0";
}

function sfzColumnGroup(g){ return !!(g && g.closest("#w-cone .tools,#paneGrp")); }

function sfzColumnSize(g){
  const collapsed = g.classList.contains("cmin"), size = !collapsed && Z.cgrpSize && Z.cgrpSize[g.dataset.g];
  g.classList.toggle("csz", !!size);
  if (g.style.height) g.style.height = ""; if (g.style.minWidth) g.style.minWidth = "";
  if (g.style.flexShrink !== "0") g.style.flexShrink = "0";
  if (g.style.width) g.style.width = "";
  if (!g.classList.contains("sfz-grape")) g.classList.add("sfz-grape");
  sfzGrapeSync(g);
}

function sfzGrapeStyle(el, key, value){
  if(el.style.getPropertyValue(key)===value)return;el.style.setProperty(key,value);
  if(/^--grape-[xywh]$/.test(key))window.zzSfzWeaveRevision=(window.zzSfzWeaveRevision||0)+1;
}

function sfzGrapeKey(el){ return el.id || el.querySelector("[id]")?.id || "t:" + el.textContent.trim().replace(/\s+/g, " ").slice(0, 40); }

function sfzFoldPair(vis, want){
  const px=(el,k)=>parseFloat(el.style.getPropertyValue(k))||0, mid=el=>[px(el,"--grape-x")+(px(el,"--grape-w")||48)/2,px(el,"--grape-y")+(px(el,"--grape-h")||48)/2];
  const first=vis.find(el=>sfzGrapeKey(el)===want[0])||vis.slice().sort((a,b)=>px(a,"--grape-y")-px(b,"--grape-y")||px(a,"--grape-x")-px(b,"--grape-x"))[0];
  if(!first)return [];
  const [fx,fy]=mid(first), rest=vis.filter(el=>el!==first), d=el=>{const [x,y]=mid(el);return Math.hypot(x-fx,y-fy);};
  const second=rest.find(el=>sfzGrapeKey(el)===want[1])||rest.sort((a,b)=>d(a)-d(b))[0];
  return second?[first,second]:[first];
}

function sfzGrapeIcon(el, name){
  if (!el.matches("button,label") || el.querySelector('input:not([type="checkbox"]),select,textarea')) return;
  const text = el.textContent.trim();
  if (!el.title && !el.dataset.zzTip) el.title = text;
  if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", el.title || el.dataset.zzTip || text);
  let icon = el.querySelector(":scope > .sfz-grape-icon");
  // v0.058: стрелки и одиночные символы уже служат значком; текстовые действия — с SVG.
  if (!/[\p{L}]/u.test(text) || /^(?:\d|[01]\s)/u.test(text)) { if (icon) icon.remove(); return; }
  if (!icon) { icon = document.createElement("span"); icon.className = "sfz-grape-icon"; icon.setAttribute("aria-hidden", "true"); el.prepend(icon); }
  const key = (el.id + " " + text).toLowerCase();
  let kind = /пуск|запуск|продолж|play|auto/.test(key) ? "play" : /пауза|pause|stop/.test(key) ? "pause" : /магнит|mag/.test(key) ? "magnet" : /ось|оси|axis|axes/.test(key) ? "axes" : /луч|свет|sun|light|glow/.test(key) ? "light" : /бит|bit|01/.test(key) ? "bit" : /крут|turn|spin|rotate|верт/.test(key) ? "turn" : /щел|slit|cut/.test(key) ? "slit" : /3d|тор|cube/.test(key) ? "cube" : /шар|ball/.test(key) ? "ball" : "ring";
  if (kind === "ring") kind = /3d/.test(name) ? "cube" : /шар/.test(name) ? "ball" : /грани/.test(name) ? "cube" : /щел/.test(name) ? "slit" : /круч/.test(name) ? "turn" : "ring";
  if (icon.dataset.kind === kind) return; icon.dataset.kind = kind;
  const paths = { play:'<path d="M8 5l11 7-11 7z"/>', pause:'<path d="M8 5v14M16 5v14"/>', magnet:'<path d="M5 5v9a7 7 0 0014 0V5M5 9h4M15 9h4"/>', axes:'<path d="M12 2v20M2 12h20M9 5l3-3 3 3M19 9l3 3-3 3"/>', light:'<circle cx="12" cy="12" r="4"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M20 4l-2 2M6 18l-2 2"/>', bit:'<circle cx="7" cy="12" r="4"/><path d="M17 8v8M15 9l2-1"/>', turn:'<path d="M19 8a8 8 0 10.5 7M19 3v6h-6"/>', slit:'<path d="M3 5h18M3 12h7M14 12h7M3 19h18M12 8v8"/>', cube:'<path d="M12 2l9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10"/>', ball:'<circle cx="12" cy="12" r="8"/><path d="M7 7l2-1"/>', ring:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>' };
  icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + paths[kind] + '</svg>';
}

function sfzGrapeCaption(item){
  if (!item.matches("button,label,.sfz-grape-note") || item.querySelector('input:not([type="checkbox"]),select,textarea')) return;
  const full = item.textContent.trim().replace(/\s+/g," "); if (!full) return;
  const names = {"через центр":"центр","центр: насквозь":"сквозь","↦ насквозной":"сквозь","∞ по дугам":"дуги","▶ продолжить":"далее","↩ к старту":"старт","↻ по часовой":"вперёд","↻ против":"назад","⊘ закрыто":"закрыт","Σ расчёт":"расчёт","● = часть":"часть","Л / П грани":"Л / П","Л→П 1 · П→Л 0":"Л→П 1\nП→Л 0","1 за чертой":"1 за\nчертой","1 в кольце":"1 в\nкольце","½ бита внешнего":"½ бита","⟳ поток по кругу":"поток","из середины бита":"из\nсеред.","ПоглотБит":"поглот.","0 изнутри":"0\nизнутри","⏸ одновременно":"одновр.","удар: застрять":"застрять","удар: отскок":"отскок","⛓ цепочка":"цепь","◇ через 1":"через 1","↺ снять ↻":"снять ↻","⌖ меж битами":"меж","середина":"серед.","◎ точки":"точки","▶ запуск":"запуск"};
  let brief = names[full] || full;
  if (item.id === "bConeBallSpeed") brief = ["1 · авто", "2 · К1", "3 · ½К1"][parseInt(full, 10) - 1] || full;
  if (brief === "застрять") brief = "застр.";
  brief = brief.replace(/^◉ закрыто (\d+)$/, "закр. $1");
  if (item.querySelector(":scope > .sfz-grape-icon")) brief = brief.replace(/^[^\p{L}\p{N}]+/u, "").trim();
  if (brief.length > 12) brief = brief.split(/\s+/).map(w => w.length > 7 ? w.slice(0,6)+"." : w).slice(0,2).join(" ");
  if (item.dataset.grapeCaption !== brief) item.dataset.grapeCaption = brief;
  item.classList.toggle("sfz-grape-symbol", [...brief].length <= 3 && !/[\p{L}]/u.test(brief));
  if (item.dataset.grapeFull !== full) item.dataset.grapeFull = full;
  if (!item.title && !item.dataset.zzTip) item.title = full;
}

function sfzRhombsMeet(a,b){
  if(a.left+a.width<=b.left+.5||b.left+b.width<=a.left+.5||a.top+a.height<=b.top+.5||b.top+b.height<=a.top+.5)return false;
  const points=r=>[[r.left+r.width/2,r.top],[r.left+r.width,r.top+r.height/2],[r.left+r.width/2,r.top+r.height],[r.left,r.top+r.height/2]], A=points(a),B=points(b);
  for(const poly of [A,B])for(let i=0;i<4;i++){
    const u=poly[i],v=poly[(i+1)%4],nx=-(v[1]-u[1]),ny=v[0]-u[0],pa=A.map(p=>p[0]*nx+p[1]*ny),pb=B.map(p=>p[0]*nx+p[1]*ny);
    if(Math.max(...pa)<=Math.min(...pb)+.5||Math.max(...pb)<=Math.min(...pa)+.5)return false;
  }
  return true;
}

function sfzWeaveEntries(){
  const entries=[];
  for(const root of document.querySelectorAll(".sfz-grape,#coneViewTools,#ringTbl")){
    if(root.hidden||root.matches(".cmin,.coff,.cdrag,.pdrag")||!root.getClientRects().length)continue;
    const items=[];
    for(const el of root.querySelectorAll(".sfz-grape-item,button[data-v],.ring-fill-column > button")){
      if(el.hidden||!el.getClientRects().length||getComputedStyle(el).display==="none")continue;
      const parent=el.offsetParent;if(!parent)continue;const pr=parent.getBoundingClientRect();
      items.push({el,rect:{left:pr.left+parent.clientLeft+el.offsetLeft,top:pr.top+parent.clientTop+el.offsetTop,width:el.offsetWidth,height:el.offsetHeight}});
    }
    if(!items.length)continue;
    let stack=root.closest(".win")||document.body;
    for(let n=root;n&&n!==stack;n=n.parentElement){const c=getComputedStyle(n);if(c.position==="fixed"||c.position==="sticky"||c.transform!=="none"||c.filter!=="none"||+c.opacity<1||c.isolation==="isolate"||c.clipPath!=="none"||(c.zIndex!=="auto"&&c.position!=="static")){stack=n;break;}}
    entries.push({root,items,stack});
  }
  return entries;
}

function sfzWeaveKick(){if(!sfzWeaveFrame)sfzWeaveFrame=requestAnimationFrame(sfzWeaveSync);}

function sfzWeaveSync(){
  sfzWeaveFrame=0;if(document.body.classList.contains("cgdrag"))return;
  const roots=[...document.querySelectorAll(".sfz-grape,#coneViewTools,#ringTbl")];
  if(roots.some(root=>root._sfzDragging||root.matches(".cdrag,.pdrag")))return;
  const signature=(window.zzSfzWeaveRevision||0)+"|"+roots.map(root=>{const r=root.getBoundingClientRect();return [root.id,root.dataset.g,root.className,root.hidden,r.left,r.top,r.width,r.height].join(":");}).join("|");
  if(signature===sfzWeaveLast)return;sfzWeaveLast=signature;
  const entries=sfzWeaveEntries(), edges=entries.map(()=>new Set()), layers=new Map();
  for(const e of entries)e.items.forEach((a,i)=>layers.set(a.el,2147483501+i%2));
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++)if(entries[i].items.some(a=>entries[j].items.some(b=>sfzRhombsMeet(a.rect,b.rect)))){edges[i].add(j);edges[j].add(i);}
  const seen=new Set();
  for(let i=0;i<entries.length;i++){
    if(seen.has(i)||!edges[i].size)continue;const component=[],queue=[i];seen.add(i);
    while(queue.length){const k=queue.shift();component.push(k);for(const n of edges[k])if(!seen.has(n)){seen.add(n);queue.push(n);}}
    if(component.length===2&&entries[component[0]].stack===entries[component[1]].stack){
      const A=entries[component[0]],B=entries[component[1]];
      B.items.forEach(b=>layers.set(b.el,2147483520));
      const crossings=A.items.filter(a=>B.items.some(b=>sfzRhombsMeet(a.rect,b.rect))).sort((a,b)=>a.rect.top+a.rect.height/2-b.rect.top-b.rect.height/2||a.rect.left-b.rect.left);
      crossings.forEach((a,k)=>layers.set(a.el,k%2?2147483501:2147483540));
    }
    // v0.058: пересечения меняют только слои. Сохранённые места и сцепки не раздвигаем сами.
  }
  for(const [el,layer] of layers)sfzGrapeStyle(el,"--grape-layer",String(layer));
}

function sfzGrapeLayout(box, items, name, up=false){
  const slots=[];
  const cell = 48, step = 26; let y = 0, side = 0, width = 74, bottom = 0;
  const verticalRanges=[];
  const isEditor = item => item.matches("select,input:not([type=checkbox]),textarea") || !!item.querySelector('input:not([type="checkbox"]),select,textarea');
  const axis = items.length && isEditor(items[0]) ? (items[0].querySelector('input[type="range"]') ? 48 : 60) : 24;
  const straight = name === "строка 1", columns = name === "грани" ? 3 : 2;
  const sliderNames = {cone3H:"Высота",cone3Bw:"Толщина",coneSlit:"Щель",row1Slit:"Щель 1",sndSp:"Темп",sndVol:"Громкость",triS:"Масштаб"};

  for (const item of items) {
    if (!item.classList.contains("sfz-grape-item")) { if (item.classList.contains("tz")) triOff(item); tzcClean(item); item.classList.add("sfz-grape-item"); }
    const editor = isEditor(item), large = editor;
    item.classList.toggle("sfz-grape-editor",editor); item.classList.toggle("sfz-grape-large",large);
    const range = item.querySelector('input[type="range"]'), caption = item.querySelector(":scope > .sli");
    item.classList.toggle("sfz-grape-range",!!range);
    if (range && caption && sliderNames[range.id] && caption.textContent !== sliderNames[range.id]) caption.textContent = sliderNames[range.id];
    if (range && !range.hasAttribute("aria-label")) range.setAttribute("aria-label",sliderNames[range.id] || caption?.textContent || item.title);
    if(range){
      if(!range._sfzCompactTip){
        range._sfzCompactTip=true;
        const name=sliderNames[range.id]||range.getAttribute("aria-label")||"Значение", help=item.dataset.zzTip||item.title||"";
        range._sfzTipSync=()=>{
          const text=name+": "+range.value+(["coneSlit","row1Slit"].includes(range.id)?"°":"")+(help?". "+help:"");
          if(item.dataset.zzTip!==text)item.dataset.zzTip=text;
          if(Z.tipsOn!==false&&item.title!==text)item.title=text;
          if(Z.tipsOn!==false&&range.title!==text)range.title=text;
          const frac=(+range.value-(+range.min||0))/Math.max(.000001,(+range.max||100)-(+range.min||0));
          const height=parseFloat(item.style.getPropertyValue("--grape-h"))||180;
          item.dataset.rangeValue=item.querySelector(":scope > .rv")?.textContent.trim() || range.value;
          sfzGrapeStyle(item,"--grape-value-y",(36+(1-frac)*Math.max(1,height-72)).toFixed(1)+"px");
        };
        range.addEventListener("input",range._sfzTipSync);
      }
      range._sfzTipSync();
    }
    if(range){verticalRanges.push(item);continue;}
    // v0.059: редакторы занимают отдельную широкую строку, без пустого ромба и наложения на кнопки.
    if (editor) { y = Math.max(y,bottom + (bottom ? 8 : 0)); side = 0; }
    const dropdown=item.matches("select")||!!item.querySelector("select");
    const w = editor ? (range ? 96 : dropdown ? 100 : 120) : cell, h = editor ? (range ? 34 : dropdown ? 26 : item.matches("textarea") || item.querySelector("textarea") ? 72 : 36) : cell;
    const x = editor ? axis - w / 2 : axis - 24 + side * step, top = y + (editor ? 0 : (side % 2) * cell / 2);

    if(item!==box._sfzRDrag)sfzGrapeStyle(item,"--grape-x",x+"px"); slots.push({item,top,h,x,w}); sfzGrapeStyle(item,"--grape-w",w+"px"); sfzGrapeStyle(item,"--grape-h",h+"px");
    width=Math.max(width,x+w); bottom=Math.max(bottom,top+h);
    sfzGrapeIcon(item,name||""); sfzGrapeCaption(item);
    if (editor) { y=top+h+8; side=0; } else if (straight) { y+=cell; side=0; } else { side=(side+1)%columns; if(!side)y+=cell; }
  }
  // v0.072: места, расставленные правой протяжкой, — поверх раскладки; хранятся в виде «вниз», при перевороте отражаются (верх и низ зеркально).
  const custom=Z.sfzGrapePos?.[name];
  if(custom&&slots.length){
    for(const s of slots){const p=custom[sfzGrapeKey(s.item)];if(p){s.x=p.x;s.top=p.y;}}
    const mx=Math.min(...slots.map(s=>s.x))-(verticalRanges.length?24:0),my=Math.min(...slots.map(s=>s.top));
    width=74;bottom=0;
    for(const s of slots){s.x-=mx;s.top-=my;width=Math.max(width,s.x+s.w);bottom=Math.max(bottom,s.top+s.h);if(s.item!==box._sfzRDrag)sfzGrapeStyle(s.item,"--grape-x",s.x+"px");}
  }
  const coreMin=slots.length?Math.min(...slots.map(s=>s.x)):0, coreMax=slots.length?Math.max(...slots.map(s=>s.x+s.w)):48;
  if(verticalRanges.length){
    const height=Math.max(96,Math.min(140,((bottom||240)-8*(verticalRanges.length-1))/verticalRanges.length));
    verticalRanges.forEach((item,i)=>{
      const x=coreMin-24;
      sfzGrapeStyle(item,"--grape-x",x+"px");
      sfzGrapeStyle(item,"--grape-y",(i*(height+8))+"px");sfzGrapeStyle(item,"--grape-w","24px");sfzGrapeStyle(item,"--grape-h",height+"px");
      sfzGrapeIcon(item,name||"");sfzGrapeCaption(item);item.querySelector('input[type="range"]')?._sfzTipSync?.();
    });
    bottom=Math.max(bottom,verticalRanges.length*height+8*(verticalRanges.length-1));
  }
  for(const {item,top,h} of slots)if(item!==box._sfzRDrag)sfzGrapeStyle(item,"--grape-y",(up?bottom-top-h:top)+"px");
  box.querySelectorAll(":scope > .sfz-grape-grip").forEach(grip=>grip.remove());
  sfzGrapeStyle(box,"--sfz-grape-width",width+"px"); sfzGrapeStyle(box,"--sfz-grape-height",bottom+"px");
  sfzWeaveKick();
  return {width,height:bottom,coreCenter:(coreMin-(verticalRanges.length?24:0)+coreMax)/2};
}

function sfzGrapeEdgeTarget(x,y){
  let best=null;
  for(const g of document.querySelectorAll(".sfz-grape")){
    if(!g._sfzStartGroupDrag||g.hidden||g.matches(".coff,.cdrag")||!g.getClientRects().length)continue;
    for(const item of g.querySelectorAll(".sfz-grape-item,.sfz-fold-head")){
      if(!item.getClientRects().length)continue;
      const r=item.getBoundingClientRect();
      if(x<r.left-4||x>r.right+4||y<r.top-4||y>r.bottom+4)continue;
      const style=getComputedStyle(item);if(style.display==="none"||style.visibility==="hidden")continue;
      const clip=style.clipPath,coord=(s,size)=>parseFloat(s)*(s.endsWith("%")?size/100:1);
      const points=clip.startsWith("polygon(")?clip.slice(8,-1).split(",").map(p=>{const a=p.trim().split(/\s+/);return [r.left+coord(a[0],r.width),r.top+coord(a[1],r.height)];}):[[r.left,r.top],[r.right,r.top],[r.right,r.bottom],[r.left,r.bottom]];
      let inside=false,distance=Infinity;
      for(let i=0,j=points.length-1;i<points.length;j=i++){
        const [ax,ay]=points[j],[bx,by]=points[i],dx=bx-ax,dy=by-ay;
        if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
        const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));
        distance=Math.min(distance,Math.hypot(x-ax-t*dx,y-ay-t*dy));
      }
      if(!inside&&distance<=4&&(!best||distance<best.distance))best={g,distance};
    }
  }
  return best?.g;
}

function sfzGrapeName(g){
  const lab=g.querySelector(":scope > .glab"),own=lab?[...lab.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join("").trim():"";
  const k=own&&!own.includes(".")?own:(g.getAttribute("aria-label")||g.dataset.g||own);
  return k.charAt(0).toUpperCase()+k.slice(1);
}

function sfzGrapeEdgeInit(){
  if(sfzGrapeEdgeReady)return;sfzGrapeEdgeReady=true;
  document.addEventListener("pointerdown",e=>{
    if(e.button!==0||document.body.classList.contains("cedit")||e.target.closest("button,[role=button],input,select,textarea,label,a,.sfz-grape-item,.sfz-fold-arrow,.cgsz"))return;
    const g=sfzGrapeEdgeTarget(e.clientX,e.clientY);if(!g)return;
    e.preventDefault();e.stopImmediatePropagation();
    g._sfzStartGroupDrag({target:g,button:e.button,pointerId:e.pointerId,clientX:e.clientX,clientY:e.clientY,shiftKey:e.shiftKey,altKey:e.altKey,preventDefault(){}});
  },{capture:true,passive:false});
}

function sfzGrapeSync(g){
  sfzGrapeEdgeInit();
  // v0.070: внизу заголовок над кнопками, наверху треугольная крышка над ними.
  const pin=Z.cgrpTop?.[g.dataset.g],legacyBottom=Z.cgrpFld?.[g.dataset.g]?.z==="head";
  if(pin||legacyBottom){Z.sfzBookUp ||= {};if(pin?pin.side==="bottom":legacyBottom)delete Z.sfzBookUp[g.dataset.g];else Z.sfzBookUp[g.dataset.g]=true;}
  const up=!!Z.sfzBookUp?.[g.dataset.g];g.classList.toggle("sfz-book-up",up);
  const box = g.querySelector(":scope > .cgb"); if (!box) return;
  const items = [];
  const collect = node => {
    const hidden = node.hidden || node.style.display === "none";
    node.classList.toggle("sfz-grape-hidden",hidden);
    if (hidden || getComputedStyle(node).display === "none" || node.matches(".tzco,.cgnl,.cgsz,.sfz-grape-icon,.sfz-grape-grip,.sfz-fold-arrow,.sfz-fold-head,#coneBallStatus")) return;
    if (node.matches("button,label,select,textarea,input:not([type=hidden])")) { items.push(node); return; }
    if (node.matches(".glab2") && !node.querySelector("button,label,select,input")) { const empty=!node.textContent.trim(); node.classList.toggle("sfz-grape-empty",empty); if (!empty) { if (!node.classList.contains("sfz-grape-note")) node.classList.add("sfz-grape-note"); items.push(node); } return; }
    if (!node.classList.contains("sfz-grape-wrap")) node.classList.add("sfz-grape-wrap");
    for (const child of node.children) collect(child);
  };
  for (const child of box.children) collect(child);
  // v0.058: скрытый режимом элемент оставляет своё место; новые элементы занимают следующий свободный слот.
  // До конца загрузки списки ещё заменяются кнопками — эту временную разметку не запоминаем.
  const settled = document.readyState === "complete";
  const stable = (settled && box._sfzGrapeSlots || items).filter(item => box.contains(item));
  for (const item of items) if (!stable.includes(item)) stable.push(item);
  if (settled) box._sfzGrapeSlots = stable;
  const layout = sfzGrapeLayout(box, stable, g.dataset.g, up);
  sfzGrapeStyle(g,"--sfz-grape-width","120px");
  sfzGrapeStyle(g,"--sfz-book-body-width",layout.width+"px");
  sfzGrapeStyle(g,"--sfz-book-core-center",layout.coreCenter+"px");
  // v0.072: шапки и крышки нет; v0.073: свёрнутая гроздь — крайний ромб и его ближайший сосед, как стояли в грозди; остальные спрятаны на своих местах.
  let keep=[];
  if(g.classList.contains("cmin")){
    const px=(el,k)=>parseFloat(el.style.getPropertyValue(k))||0;
    const vis=stable.filter(el=>el.classList.contains("sfz-grape-item")&&!el.classList.contains("sfz-grape-hidden")&&!el.classList.contains("sfz-grape-range"));
    keep=sfzFoldPair(vis,[].concat(Z.sfzFoldKeep?.[g.dataset.g]||[]));
    if(keep.length){
      const x0=Math.min(...keep.map(el=>px(el,"--grape-x"))),y0=Math.min(...keep.map(el=>px(el,"--grape-y")));
      for(const el of keep){sfzGrapeStyle(el,"--fold-x",(px(el,"--grape-x")-x0)+"px");sfzGrapeStyle(el,"--fold-y",(px(el,"--grape-y")-y0)+"px");}
      sfzGrapeStyle(g,"--sfz-fold-w",Math.max(...keep.map(el=>px(el,"--grape-x")+(px(el,"--grape-w")||48)))-x0+"px");
      sfzGrapeStyle(g,"--sfz-fold-h",Math.max(...keep.map(el=>px(el,"--grape-y")+(px(el,"--grape-h")||48)))-y0+"px");
      /* v0.080, «у свёрнутой группы сделай стрелку через отступ 2 граней вниз или вверх — куда откроются кнопки, когда развернуть»: треугольник
         4t × 2t (t — грань стандарта треугольников) остриём туда, где лежат спрятанные ромбы, в 2t от крайнего ромба пары */
      const rest=vis.filter(el=>!keep.includes(el));
      if(rest.length){
        const t=TZC_H/(2*Math.sqrt(3)),h=el=>px(el,"--grape-h")||48,w=el=>px(el,"--grape-w")||48,mid=el=>px(el,"--grape-y")+h(el)/2;
        const kTop=Math.min(...keep.map(el=>px(el,"--grape-y"))),kBot=Math.max(...keep.map(el=>px(el,"--grape-y")+h(el)));
        const down=rest.reduce((s,el)=>s+mid(el),0)/rest.length>=(kTop+kBot)/2;
        const edge=keep.slice().sort((a,b)=>down?(px(b,"--grape-y")+h(b))-(px(a,"--grape-y")+h(a)):px(a,"--grape-y")-px(b,"--grape-y"))[0];
        let arrow=box.querySelector(":scope > .sfz-fold-arrow");
        if(!arrow){arrow=document.createElement("span");arrow.className="sfz-fold-arrow";arrow.title="Щелчок — развернуть группу; тянуть — переместить";box.appendChild(arrow);
          /* v0.081, «пусть нажимает — открывает, и перемещает»: протяжка левой кнопкой — как за любой ромб грозди (startGroupDrag), щелчок без сдвига — развернуть */
          arrow.addEventListener("pointerdown",e=>{if(e.button!==0)return;const x0=e.clientX,y0=e.clientY,id=e.pointerId;
            const up=ev=>{if(ev.pointerId!==id)return;document.removeEventListener("pointerup",up,true);
              if(Math.hypot(ev.clientX-x0,ev.clientY-y0)<4)setTimeout(()=>{if(g.classList.contains("cmin")&&g._sfzFoldFlip&&arrow._edge&&arrow._edge.isConnected)g._sfzFoldFlip(arrow._edge);},0);};
            document.addEventListener("pointerup",up,true);});}
        arrow._edge=edge;
        arrow.dataset.dir=down?"down":"up";
        sfzGrapeStyle(arrow,"--fa-x",(px(edge,"--grape-x")-x0+w(edge)/2-2*t).toFixed(2)+"px");
        sfzGrapeStyle(arrow,"--fa-y",(down?kBot-y0+2*t:kTop-y0-4*t).toFixed(2)+"px");
        sfzGrapeStyle(arrow,"--fa-t",t.toFixed(3)+"px");
      }
    }
  }
  /* Синхрофазотрон v0.093, «группы кнопок — сделай заголовок при свёрнутой группе: один ромб-заголовок, побольше для текста, удлинить в 2 раза»: свёрнутая
     гроздь — один ромб 96 × 48 с названием группы. Пара крайних ромбов остаётся невидимым якорем под ним (раскрытие держит её на месте, как прежде).
     Щелчок — развернуть, протяжка — перенести группу, правый щелчок — тоже развернуть; стрелка «куда откроются кнопки» — у заголовка. */
  if(keep.length&&g.classList.contains("cmin")){
    let head=box.querySelector(":scope > .sfz-fold-head");
    if(!head){head=document.createElement("span");head.className="sfz-fold-head";head.setAttribute("role","button");box.appendChild(head);
      const open=()=>{if(g.classList.contains("cmin")&&g._sfzFoldFlip&&head._edge&&head._edge.isConnected)g._sfzFoldFlip(head._edge);};
      // [role=button] гроздь сама откладывает нажатие: протяжка — перенос группы, щелчок без сдвига доходит обычным click (после переноса он гасится)
      head.addEventListener("click",e=>{e.stopPropagation();setTimeout(open,0);});
      head.addEventListener("contextmenu",e=>{e.preventDefault();e.stopPropagation();open();});}
    const name=sfzGrapeName(g);if(head.textContent!==name)head.textContent=name;
    const tip="«"+name+"» свёрнута: щелчок — развернуть; тянуть — переместить группу";if(head.title!==tip)head.title=tip;head.setAttribute("aria-label",tip);
    head._edge=keep[0];g.classList.add("sfz-fold-headed");
    sfzGrapeStyle(g,"--sfz-fold-w","96px");sfzGrapeStyle(g,"--sfz-fold-h","48px");
    const arrow=box.querySelector(":scope > .sfz-fold-arrow");
    if(arrow){const t=TZC_H/(2*Math.sqrt(3)),down=arrow.dataset.dir==="down";sfzGrapeStyle(arrow,"--fa-x",(48-2*t).toFixed(2)+"px");sfzGrapeStyle(arrow,"--fa-y",(down?48+2*t:-4*t).toFixed(2)+"px");}
  }else{g.classList.remove("sfz-fold-headed");const h=box.querySelector(":scope > .sfz-fold-head");if(h)h.remove();}
  if(!keep.length||!g.classList.contains("cmin")){const a=box.querySelector(":scope > .sfz-fold-arrow");if(a)a.remove();}
  for(const el of stable)if(el.classList.contains("sfz-fold-keep")!==keep.includes(el))el.classList.toggle("sfz-fold-keep",keep.includes(el));
  let cover=g.querySelector(":scope > .sfz-book-cover");
  if(!cover){cover=document.createElement("button");cover.type="button";cover.className="sfz-book-cover";cover.textContent="▴";cover.title="Закрыть ромбокнигу: сжать гроздь между крышками";cover.setAttribute("aria-label","Свернуть группу "+g.dataset.g);cover.addEventListener("pointerdown",e=>e.stopPropagation());cover.onclick=e=>{e.stopPropagation();if(g._solFold)g._solFold(true);};g.appendChild(cover);}
  const mark=up?"▾":"▴";if(cover.textContent!==mark)cover.textContent=mark;
  const lab = g.querySelector(":scope > .glab");
  if (lab) {
    let turn=lab.querySelector(":scope > .sfz-book-direction");
    if(!turn){turn=document.createElement("button");turn.type="button";turn.className="sfz-book-direction";turn.addEventListener("pointerdown",e=>e.stopPropagation());turn.addEventListener("dblclick",e=>e.stopPropagation());turn.onclick=e=>{e.stopPropagation();g._sfzBookTurn?.();};lab.appendChild(turn);}
    const turnText=up?"↑":"↓", turnTitle=up?"Тарелка снизу: сворачивать вниз. Вернуть тарелку наверх":"Поставить тарелку снизу: раскрывать вверх, сворачивать вниз";
    if(turn.textContent!==turnText)turn.textContent=turnText;
    if(turn.title!==turnTitle)turn.title=turnTitle;
    if(turn.getAttribute("aria-label")!==turnTitle)turn.setAttribute("aria-label",turnTitle);
    if(turn.getAttribute("aria-pressed")!==String(up))turn.setAttribute("aria-pressed",String(up));
    if (lab.dataset.grapeName !== g.dataset.g) lab.dataset.grapeName = g.dataset.g;
    const title = "Ромбокнига «" + g.dataset.g + "». Тяни заголовок или любую кнопку — переместить; короткое нажатие на кнопку — её действие; одиночное или двойное нажатие на шапку — раскрыть или сжать на месте. В нижней полосе заголовок над кнопками, треугольная крышка снизу; в верхней полосе крышка сверху, заголовок под кнопками. Переворот — ещё до отпускания. Alt + нажатие — перевернуть вручную.";
    if (!lab._grapeTip) { lab._grapeTip = true; lab.title = title; lab.dataset.zzTip = title; }
    const fold = lab.querySelector(".gfold"), label = (g.classList.contains("cmin")?"Раскрыть гроздь "+(up?"вверх":"вниз"):"Свернуть гроздь "+(up?"вниз":"вверх"))+" «"+g.dataset.g+"»";
    if (fold && fold.getAttribute("aria-label") !== label) fold.setAttribute("aria-label", label);
  }
  const height=g.offsetHeight;
  if(g._sfzBookHeight!==height){g._sfzBookHeight=height;if(up)g._sfzBottomPlace?.();}
}


function lpTop(col, vis){
  const top = document.getElementById("top"); if (!top) return;
  top.classList.add("lpt");
  if (!top._lpObs && lpTag._mo) { top._lpObs = 1; lpTag._mo.observe(top, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden", "style"] }); }
  const t = TZC_H / (2 * Math.sqrt(3)), sd = 2 * t, runs = []; let run = [];
  const end = () => { if (run.length) runs.push(run); run = []; };
  const walk = (el) => {
    if (el.id === "pinBar") { [...el.children].forEach(walk); return; }
    if (el.id === "undoBox") { end(); [...el.children].forEach(walk); end(); return; }   // v0.611: ↩ ↪ посередине — своя сцепка
    if (el.tagName === "BUTTON") { if (vis(el)) run.push(el); return; }
    if (vis(el) || el.classList.contains("sp")) end();
  };
  [...top.children].forEach(walk); end();
  const shape = () => runs.forEach(r => r.forEach((b, i) => {
    b.classList.remove("tz"); const bc = getComputedStyle(b).borderTopColor; b.classList.add("tz");
    const rg = document.createRange(); rg.selectNodeContents(b); const tw = sharedMenuTextWidth(b,rg);
    const selectedWindow = !!(b.closest("#pinBar") && b.classList.contains("on"));
    const prevSelected = !!(i && r[i - 1].closest("#pinBar") && r[i - 1].classList.contains("on"));
    b._gcol = tzLnBg() || bc || col; b._tzar = ""; b._tzfix = true; b._tzm = 0;
    /* v0.529, по снимку «📌 ✦ Развёртка» — «дальше кнопки вогнутые (внутрь) и прижми кнопки, и так везде, чтоб не было пустот»: цепочка — остриё
       в выемку: у каждой кнопки справа остриё, у следующей слева выемка, и она заходит на соседку на t (прежде — выемка к выемке, ромбик фона между) */
    b._tzL = i === 0 ? TZ_TIP : TZ_NOTCH; b._tzR = TZ_TIP; b._tzm = i === 0 ? 0 : 1;
    /* v0.527, «вправо стрелка — надо форму кнопки так же стрелкой вправо»: data-tzl / data-tzr — свой край кнопки (t — остриё, n — выемка);
       такая кнопка стоит отдельно от соседних: ↩ — стрелка влево (остриё слева, выемка справа), ↪ — вправо */
    if (b.dataset.tzl) b._tzL = b.dataset.tzl === "n" ? TZ_NOTCH : TZ_TIP;
    if (b.dataset.tzr) b._tzR = b.dataset.tzr === "n" ? TZ_NOTCH : TZ_TIP;
    const windowTab = !!b.closest("#pinBar"), normalEdges = b._tzL[1] + b._tzR[1];
    // Выбранная вкладка углубляет стыки с обеих сторон; соседняя справа входит остриём в её выемку.
    if (selectedWindow) { b._tzL = [0, 2, 0]; b._tzR = [0, 2, 0]; b._tzm = i ? 2 : 0; b.style.zIndex = "5"; }
    else if (prevSelected) { b._tzL = TZ_TIP; b._tzm = 2; b.style.removeProperty("z-index"); }
    else b.style.removeProperty("z-index");
    /* v0.530, «↩ ↪ — обе шире и одинаковой ширины, между ними пропуск-ромб, стрелка влево и вправо»: заходит на соседку, только если у той справа
       остриё (выемка к выемке — стоят встык уголками, между ними ромб фона) */
    if (i && ((b._tzL !== TZ_NOTCH && !selectedWindow && !prevSelected) || (r[i - 1]._tzR !== TZ_TIP && !prevSelected)) && !(b.dataset.tzin && b._tzL === TZ_TIP && r[i - 1]._tzR === TZ_NOTCH)) b._tzm = 0;   // соседка справа входит остриём в глубокую выемку выбранной вкладки
    b._tzn = b._tzn0 = Math.max([...b.textContent.trim()].length <= 2 ? 2 : 3, Math.ceil((tw + lpTop.pad) / sd)) + (+b.dataset.tzw || 0);   // v0.524, «либо текст сократи, либо кнопки увеличь — не помещается»: надпись + поля; выемки на стыках (их ширина сверх n) — сверху, они съедают место у надписи
    // v0.1011: выемки выбранной вкладки меняют контур, но сохраняют ширину и шаг соседей.
    if (windowTab) { b._tzn += (i ? 1.5 : 2) + (normalEdges - b._tzL[1] - b._tzR[1]) / 2; b._tzn0 = b._tzn; b._tzm = i ? 1 : 0; }
    tzGeo(b);   // v0.526, «стрелки пошире на 1 ромб»: data-tzw — сколько ромбов прибавить к ширине по надписи
  }));
  /* v0.524: кнопки шире — на узком окне шапка может не влезть в строку: тогда шрифт её кнопок мельче (не меньше 10 px), пока не войдёт */
  if (!(window.matchMedia && matchMedia("(max-width:760px)").matches)) {
    let fs = 12; lpTop.pad = 14; top.style.setProperty("--tbfs", fs + "px"); shape();
    for (let k = 0; k < 4 && top.scrollWidth > top.clientWidth + 1 && fs > 10; k++) { fs = Math.max(10, Math.floor(fs * top.clientWidth / top.scrollWidth * 10) / 10); top.style.setProperty("--tbfs", fs + "px"); shape(); }
    if (top.scrollWidth > top.clientWidth + 1) { lpTop.pad = 2; shape(); }   // и так тесно — поля у надписей уже (надпись заходит в острия)
  } else { lpTop.pad = 14; shape(); }
  /* v0.529: перенеслась на новую строку (узкое окно) — начинает её остриём и не заходит на кнопку строкой выше */
  runs.forEach(r => r.forEach((b, i) => { if (i && b._tzm && Math.abs(b.offsetTop - r[i - 1].offsetTop) > 4) { b._tzm = 0; b._tzL = TZ_TIP; tzGeo(b); } }));
  // v0.1011: более широкие постоянные вкладки не должны заходить под ↩ ↪ в центре шапки.
  lpWin(col, vis);
}


function sharedMirrorGrape(id,title,color,home,context){
  const {stage,headerDock,footerDock,button,plateSetup,groups,clamp}=context;
    const el=document.createElement('aside');el.id=id;el.className='zerk-grape sol-plate';el.style.setProperty('--mirror-color',color);
    const hd=document.createElement('div');hd.className='smh zerk-grape-head';const caption=document.createElement('span');caption.textContent=title;hd.append(caption);
    const fold=button('−','Свернуть / раскрыть '+title,()=>{},hd);fold.className='pminbtn';el.append(hd);
    const content=document.createElement('div');content.className='zerk-grape-body';el.append(content);stage.append(el);
    el._zerkDock=(pinned,x,edge)=>{if(edge)Z[id+'HeadEdge']=edge;const dock=Z[id+'HeadEdge']==='bottom'?footerDock:headerDock;if(pinned){if(Number.isFinite(x)){Z[id+'HeadX']=x;Z[id+'HeadWidth']=dock.clientWidth;}else if(!Number.isFinite(Z[id+'HeadX']))Z[id+'HeadX']=Math.max(0,...[...dock.children].filter(n=>n!==el).map(n=>n.offsetLeft+n.offsetWidth));if(!Number.isFinite(Z[id+'HeadWidth']))Z[id+'HeadWidth']=dock.clientWidth;}Z[id+'Head']=pinned;el.classList.toggle('zerk-docked',pinned);(pinned?dock:stage).append(el);SOL_PLATES[id].place(el);};
    const place=node=>{if(Z[id+'Head']){const dock=Z[id+'HeadEdge']==='bottom'?footerDock:headerDock;const available=Math.max(0,dock.clientWidth-node.offsetWidth),savedWidth=Z[id+'HeadWidth']||dock.clientWidth,offset=Z[id+'HeadX']||0,x=dock.clientWidth<savedWidth?offset*available/Math.max(1,savedWidth-node.offsetWidth):offset;node.style.left=clamp(x,0,available)+'px';node.style.top='0px';return;}const xy=Z[id+'XY']||(typeof home==='function'?home():home);node.style.left=clamp(xy[0],0,Math.max(0,stage.clientWidth-node.offsetWidth))+'px';node.style.top=clamp(xy[1],0,Math.max(0,stage.clientHeight-node.offsetHeight))+'px';};
    SOL_PLATES[id]={name:title,min:id+'Min',xy:id+'XY',col:color,place,init:plateSetup};plateInit(el);groups.push(el);
    hd.addEventListener('click',e=>{if(e.target.closest('button,input,select,textarea,label')||performance.now()<(el._solDragUntil||0))return;(el._zerkHeaderAction||(()=>plateFoldToggle(el)))();});
    hd.tabIndex=0;hd.setAttribute('role','button');hd.setAttribute('aria-label','Раскрыть / свернуть '+title);hd.onkeydown=e=>{if(e.target===hd&&(e.key==='Enter'||e.key===' ')){e.preventDefault();plateFoldToggle(el);}};
    el._zerkDock(!!Z[id+'Head']);
    return content;
  }

function sharedMirrorDiamond(node,caption,parent){node.classList.add('zerk-diamond');if(node.tagName==='BUTTON')node.textContent=caption;const i=[...parent.children].filter(n=>n!==node).length;node.style.left=(i%2?24:0)+'px';node.style.top=(i*24)+'px';parent.append(node);parent.style.setProperty('--grape-height',(i*24+48)+'px');return node;}
window.ZerkMenus.createGrape=sharedMirrorGrape;
window.ZerkMenus.diamond=sharedMirrorDiamond;


const RINGTBL = [
  { v: "all", t: "T" },
  { v: "one", t: "N" },
  { v: "cut", t: "2T−1" },
  { v: "cut2", t: "2T" },
  { v: "cutA", t: "меж" },
  { v: "cutS", t: "сим" }
];
function ringTblOpen(){ return !Z.coneRingModesHidden; }

function ringTblBuild(host){
  const el = document.createElement("div"); el.id = "ringTbl"; el.className = "ring-mode-list";
  RINGTBL.forEach(r => {
    const tip = (LAS_SEG.find(s => s.id === "bConeSlits") || { t: [], v: [] });
    const b = document.createElement("button"); b.type = "button"; b.dataset.v = r.v;
    b.title = (tip.t[tip.v.indexOf(r.v)] || r.t) + "\n\nТяни любую кнопку — переместить весь столбец. Правый щелчок — вернуть столбец на место.";
    b.setAttribute("aria-label", "Вид колец: " + r.t); b.setAttribute("aria-pressed", "false");
    b.textContent = r.t; el.appendChild(b);
  });
  host.appendChild(el);
  const handles = document.createElement("div"); handles.className = "ring-handles";
  for (const [kind, icon, title] of [["move", "Кольца", "Переместить гроздь «Кольца»"]]) {
    const b = document.createElement("button"); b.type = "button"; b.className = "ring-" + kind; b.textContent = icon; b.title = title; b.setAttribute("aria-label", title);
    if (kind === "close") b.onclick = e => { e.stopPropagation(); Z.coneRingModesHidden = true; el.hidden = true; save(); };
    handles.appendChild(b);
  }
  el.appendChild(handles);
  const foot=document.createElement("button");foot.type="button";foot.className="ring-foot";foot.title="Тяни нижнюю ножку — переместить группу Кольца";foot.textContent="▴";el.appendChild(foot);
  el.addEventListener("click", (e) => {
    const tr = e.target.closest("button[data-v]"); if (!tr || tr.parentElement !== el) return; e.stopPropagation();
    if (el._skipClick) { el._skipClick = false; e.preventDefault(); return; }
    if (coneSlitRaw() === tr.dataset.v) return;
    const LS = LAS_SEG.find(s => s.id === "bConeSlits"), b = document.getElementById("bConeSlits");
    if (LS && b && b.onclick) { LS.pre(tr.dataset.v); b.onclick(); }   // внутренняя команда сохраняет общую смену режима и пересчёт света
    ringTblSync();
  });
  el.addEventListener("pointerdown", e => {
    if (e.button || !e.target.closest("button")) return; e.stopPropagation(); el._skipClick = false;
    if (e.target.closest(".ring-fill-column,.ring-close")) return;
    const cv = $("coneCv"), cr = cv.getBoundingClientRect(), r = el.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
    const target = e.target.closest("button"), id = e.pointerId; target.setPointerCapture(id); let moved = false;
    const move = ev => { if (ev.pointerId !== id) return; const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved && Math.hypot(dx, dy) < 4) return; moved = true; ev.preventDefault();
      const y = r.top + dy, floor = Math.min(el.parentElement.getBoundingClientRect().bottom,innerHeight) - r.height, ceiling = $("top").getBoundingClientRect().bottom;
      delete Z.coneRingModesPinX;
      Z.coneRingModesCeiling = Math.abs(y-ceiling)<=16;
      const headDistance=Math.abs(y+24-ringTblAxisY(cr)),footDistance=Math.abs(y+r.height-12-ringTblAxisY(cr));
      Z.coneRingModesAxisEdge=footDistance<headDistance?"foot":"head";
      Z.coneRingModesFloor = !Z.coneRingModesCeiling && Math.abs(y-floor)<=16;
      Z.coneRingModesAxis = !Z.coneRingModesCeiling && !Z.coneRingModesFloor && Math.min(headDistance,footDistance)<=12;
      Z.coneRingModesAx = [r.left - cr.left + dx, (Z.coneRingModesFloor ? floor : y) + r.height / 2 - ringTblAxisY(cr)]; delete Z.coneRingModesXY; ringTblPlace(el);   // v0.023: место — сдвиг середины от горизонтальной оси
    };
    const end = ev => { if (ev.pointerId !== id) return;
      target.removeEventListener("pointermove", move); target.removeEventListener("pointerup", end); target.removeEventListener("pointercancel", end);
      if (target.hasPointerCapture(id)) target.releasePointerCapture(id);
      el._skipClick = moved; if (moved) { save(); setTimeout(() => { el._skipClick = false; }, 0); }
    };
    target.addEventListener("pointermove", move); target.addEventListener("pointerup", end); target.addEventListener("pointercancel", end);
  });
  el.addEventListener("contextmenu", e => { e.preventDefault(); e.stopPropagation(); delete Z.coneRingModesXY; delete Z.coneRingModesAx; delete Z.coneRingModesFloor; delete Z.coneRingModesCeiling; delete Z.coneRingModesAxis; ringTblPlace(el); save(); });
  return el;
}

function ringTblAxisY(cr){ return coneAxisScr()?.y ?? cr.top + cr.height / 2; }

function ringTblPlace(el){
  const cv = $("coneCv"); if (!cv || !el) return;
  const cr = cv.getBoundingClientRect(), host = el.offsetParent || el.parentElement, hr = host.getBoundingClientRect();
  const ax = Array.isArray(Z.coneRingModesAx) ? Z.coneRingModesAx : [8, 0], cy = ringTblAxisY(cr) - cr.top;
  const A=coneAxisScr(),magnetic=Z.coneRingModesCeiling||Z.coneRingModesFloor||Z.coneRingModesAxis;
  if(magnetic&&A&&!Number.isFinite(Z.coneRingModesPinX))Z.coneRingModesPinX=(cr.left+ax[0]+el.offsetWidth/2-A.x)/Math.max(.00001,coneZoom);
  const x=magnetic&&A?A.x-cr.left+Z.coneRingModesPinX*coneZoom-el.offsetWidth/2:Math.max(0,Math.min(Math.max(0,cr.width-el.offsetWidth),ax[0]));
  const rawY=Z.coneRingModesCeiling?$("top").getBoundingClientRect().bottom-cr.top:Z.coneRingModesFloor?Math.min(el.parentElement.getBoundingClientRect().bottom,innerHeight)-cr.top-el.offsetHeight:Z.coneRingModesAxis?cy-(Z.coneRingModesAxisEdge==="foot"?el.offsetHeight-12:24):cy+ax[1]-el.offsetHeight/2;
  const y=magnetic?rawY:Math.max(0,Math.min(Math.max(0,cr.height-el.offsetHeight),rawY));
  el.style.left = (cr.left - hr.left - host.clientLeft + host.scrollLeft + x) + "px";
  el.style.top = (cr.top - hr.top - host.clientTop + host.scrollTop + y) + "px";
  if (el._reveal) {
    el.style.setProperty("left", el.style.left, "important"); el.style.setProperty("top", el.style.top, "important");
    const r = el.getBoundingClientRect(), left = Math.max(cr.left, 8), right = Math.min(cr.right, innerWidth - 8), top = Math.max(cr.top, $("top").getBoundingClientRect().bottom), bottom = Math.min(cr.bottom, innerHeight - 8);
    el.style.setProperty("left", (parseFloat(el.style.left) + Math.max(left, Math.min(right - r.width, r.left)) - r.left) + "px", "important");
    el.style.setProperty("top", (parseFloat(el.style.top) + Math.max(top, Math.min(bottom - r.height, r.top)) - r.top) + "px", "important");
  }
}

function ringTblSync(){
  const host = $("coneMain") && $("coneMain").parentElement; if (!host) return;
  const open = ringTblOpen();
  let el = document.getElementById("ringTbl");
  if (!open) { if (el && !el.hidden) el.hidden = true; return; }
  if (!el || el.parentElement !== host) { if (el) el.remove(); el = ringTblBuild(host); }
  // v0.049: заполнение ячеек — второй столбец рядом с видами колец, без дубля.
  const fill = document.querySelector('.lseg[data-seg="bCutPrev"]');
  if (fill && fill.parentElement !== el) {
    fill.classList.add("ring-fill-column"); fill.setAttribute("role", "group"); fill.setAttribute("aria-label", "Заполнение ячеек");
    for (const button of fill.children) { triOff(button); tzcClean(button); button.classList.remove("w2", "w4", "wm"); button.removeAttribute("data-w1"); }
    el.appendChild(fill);
  }
  const cur = coneSlitRaw(); el.querySelectorAll(":scope > button[data-v]").forEach((tr, i) => { tr.style.gridRow = String(i + 2); const on = tr.dataset.v === cur, a = on ? "true" : "false"; if (tr.classList.contains("on") !== on) tr.classList.toggle("on", on); if (tr.getAttribute("aria-pressed") !== a) tr.setAttribute("aria-pressed", a); });
  if (fill) for (const button of fill.children) button.setAttribute("aria-pressed", String(button.classList.contains("on")));
  sfzWeaveKick();
  el.classList.remove("off"); el.title = "Выбор режима колец действует независимо от включения солнца и лазера.";
  if (el.hidden) el.hidden = false; ringTblPlace(el);
}
