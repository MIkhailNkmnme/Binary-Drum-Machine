/* v0.1147: classic mirror move/turn handles, pure reflections, optional snapping, and old-angle reset with undo. */
/* v0.1144: editable and saved symmetry minimums starting at 1 row / 1 pair. */
/* v0.1143: exact local mirror axes and matching bit colours, enabled by default. */
/* v0.1142, «да, сделай магнит по сетке битов»: протяжка за линию магнитит сдвиг отражения так, чтобы его биты легли в узлы сетки неподвижных битов (строки и
   чужие зеркала того же набора) — край к краю без зазора и наезда. Порог — 10 px экрана, Alt — без магнита. */
/* v0.1141, «вдоль оси надо проехать отражение — не даёт» (выбор: «едет только рисунок»): протяжка за линию сдвигает только отражения этого зеркала
   вдоль оси (скользящее отражение: та же линия, сдвиг рисунка — figureOffset / copyOffsets); квадраты, линия и угол стоят, края поля не мешают — раньше
   точка 1 упиралась в 1–99 % поля, и отражение дальше не ехало. Магнит в этой протяжке не участвует (v0.1142 — магнит по сетке битов). */
/* v0.1138: линия скользит только вдоль себя с обоими квадратами и всеми своими отражениями. */
/* v0.1137: выключенное зеркало скрывает линию оси, обе точки и подпись. */
/* v0.1136: линия переносит ось и её рисунок без поворота; горизонт поля виден в зеркалах сразу. */
/* v0.1132: захват любой кнопки переносит целую гроздь с закреплением в шапке. */
/* v0.1131: ромбовые кнопки перетаскиваются отдельно; щелчок сохраняет действие. */
/* v0.1130: зеркальный маятник внутри Зеркалиуса, общие исходные биты, кадры и баланс. */
/* v0.1129: shared axis speed multiplier up to 1000 with logarithmic slider and reset. */
/* v0.1128: nearest valid magnetic target; digit toggle applies in both net views. */
/* v0.1127: free top/bottom docking, header axis toggles, shared transport, magnetic axes and tiled vector net bits. */
/* v0.1126: zoomed bits and nets render directly at output resolution; cached images remain for reduced views and picking. */
/* v0.1125: закрепление групп в верхней шапке, крупные номера, коралловое третье зеркало, затемнение вне пересечений и отмена ручных движений; поворот холста на 360°, захват всех фигур за биты без квадратных ручек; линия тянет зеркало, точки кручения поверх всех осей; v0.1124: только пересечения фигур, перенос пустого холста и осей, дзен колёсиком; v0.1123: читаемое меню тёмного зеркала, развёртки → Бирамида, только биты, шрифты, палитры и движение вдоль оси; v0.1122: магнит рядом с подписями без роста группы; v0.1121: магнит при ручном перемещении и повороте; v0.1120: заметные включённые ромбы, выбранные режимы и подписи зеркал/холстов; v0.1118: оси, наборы, циклы, управление в ромбах, PNG и отражения без обрезки; v0.1117: колесо и масштаб, прозрачные группы ромбов; v0.1116: Зеркалиус — рисунок хаба, свои строки, три передвижных цветных зеркала. */
(() => {
  'use strict';
  const win = document.getElementById('w-zerkalius');
  if (!win || ZZ_SOLO) return;
  const cv = document.getElementById('zerkCanvas'), stage = document.getElementById('zerkStage'), tools = document.getElementById('zerkTools');
  const status = document.getElementById('zerkStatus'), layer = document.getElementById('zerkMirrors');
  const pi = Math.PI, norm = a => ((a % pi) + pi) % pi, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ZOOM_MIN = .01, ZOOM_MAX = 6;
  const defaults = () => [
    {x:.52,y:.48,angle:pi/2,color:'#70e0d7',on:true,spin:false,speed:10,grip:null,turnGrip:null},
    {x:.68,y:.52,angle:pi/6,color:'#ffd166',on:true,spin:false,speed:-7,grip:null,turnGrip:null},
    {x:.61,y:.70,angle:5*pi/6,color:'#ff735c',on:true,spin:false,speed:5,grip:null,turnGrip:null}
  ];
  const state = Z.zerkalius ||= {};
  if (!['base','serp','field','own','pend'].includes(state.source)) state.source = 'field';
  state.followField = state.followField ?? ['base','serp','field'].includes(state.source);
  if(!state.liveField1136){if(state.source!=='pend'){state.source='field';state.followField=true;}state.liveField1136=true;}
  state.fieldAxes=Object.assign({on:true,x:.5,y:.5,angle:0},state.fieldAxes||{});
  if(!state.fieldAxesCentered1133){state.fieldAxes.x=state.fieldAxes.y=.5;state.fieldAxesCentered1133=true;}
  for(const key of ['x','y','angle'])if(!Number.isFinite(state.fieldAxes[key]))state.fieldAxes[key]=key==='angle'?0:.5;
  if(new URLSearchParams(location.search).get('mayatnik')==='1')state.source='pend';
  state.zero = Number.isFinite(state.zero) ? clamp(state.zero,-60,60) : 0;
  state.one = Number.isFinite(state.one) ? clamp(state.one,-60,60) : 0;
  state.tint = state.tint !== false;
  state.trace = !!state.trace;
  state.bitSymmetry = state.bitSymmetry !== false;
  state.labels = !!state.labels;
  state.magnet = state.magnet !== false;
  state.zoom=Number.isFinite(state.zoom)?clamp(state.zoom,ZOOM_MIN,ZOOM_MAX):1;
  state.viewAngle=Number.isFinite(state.viewAngle)?((state.viewAngle%360)+360)%360:0;
  state.sourceOffsets=Array.from({length:3},(_,i)=>{const p=state.sourceOffsets?.[i];return Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)?p:[0,0];});
  state.pan=Array.isArray(state.pan)&&state.pan.length===2&&state.pan.every(Number.isFinite)?state.pan:[0,0];
  if (!Array.isArray(state.rows)) state.rows = ZZ_INITIAL_ROWS.slice();
  const old = Array.isArray(state.mirrors) ? state.mirrors : [];
  state.mirrors = defaults().map((m,i) => {
    const v = old[i] || {};
    for (const k of ['x','y','angle','speed']) if (Number.isFinite(v[k])) m[k] = v[k];
    // Rotation about square 2 can legitimately put square 1 outside the viewport.
    m.angle=norm(m.angle);m.speed=clamp(m.speed,-90,90);
    if (/^#[0-9a-f]{6}$/i.test(v.color)) m.color=v.color;
    // Saved glide offsets and permanent pins do not belong to a pure mirror.
    m.grip=null;m.turnGrip=null;m.magnetPins=[false,false];m.figureOffset=[0,0];m.copyOffsets=Array.from({length:8},()=>[0,0]);
    m.gripAngle=m.angle;
    m.on=v.on!==false;m.spin=!!v.spin;m.along=false;m.mode=['direct','inv','reverse','both'].includes(v.mode)?v.mode:'direct';m.path=v.path&&typeof v.path==='object'?v.path:{kind:'ellipse',period:12,phase:0,ampX:.12,ampY:.08,orient:'fixed',swing:30,fx:'cos(tau*t)',fy:'sin(tau*t)',fa:'0',enabled:false,elapsed:0};return m;
  });
  if(!state.thirdColor1125){if(state.mirrors[2].color.toLowerCase()==='#ed8fea')state.mirrors[2].color='#ff735c';state.thirdColor1125=true;}
  const controls=[],handles=[],sceneMath=ZZMirrorScene, sourceCache=new Map(), pathFns=new Map();
  const g=cv.getContext('2d'),tintCanvas=document.createElement('canvas'),tintContext=tintCanvas.getContext('2d');
  state.layout=['single','quad','tri'].includes(state.layout)?state.layout:'single';
  state.build=state.build==='net'?'net':'axes';
  state.net=Object.assign({nb:3,preset:0,up:'#4dd4ff',down:'#e8b64a',labels:true,copy:0},state.net||{});
  state.net.nb=state.net.nb===4?4:3;state.net.preset=clamp(Number(state.net.preset)|0,0,5);state.net.copy=clamp(Number(state.net.copy)|0,0,7);
  for(const key of ['up','down'])if(!/^#[0-9a-f]{6}$/i.test(state.net[key]))state.net[key]=key==='up'?'#4dd4ff':'#e8b64a';
  const fonts=[...document.querySelectorAll('#fontSel option')].map(o=>[o.value,o.textContent]);
  for(const name of ['JetBrains Mono','Fira Code','Source Code Pro','IBM Plex Mono','Space Mono','VT323','Share Tech Mono','Press Start 2P','Major Mono Display','Orbitron'])if(!fonts.some(([v])=>v.includes(name)))fonts.push(['"'+name+'", monospace',name]);
  state.font=fonts.some(([v])=>v===state.font)?state.font:fonts[0][0];
  state.bitsOnly=!!state.bitsOnly;   // v0.1182: формы бита — ромб, квадрат, круг; каждая без цифры или с цифрой («…01»); «digits» — одни цифры. Прежние ромб / квадрат показывали цифру — переходят в «…01»
  {const SHAPES=['diamond','diamond01','square','square01','circle','circle01'];if(!state.bitShape1182){state.bitShape1182=true;if(state.bitShape==='diamond'||state.bitShape==='square'||!state.bitShape)state.bitShape=(state.bitShape||'diamond')+'01';}state.bitShape=state.bitsOnly?'digits':SHAPES.includes(state.bitShape)?state.bitShape:'diamond01';}state.netDigits=state.netDigits!==false;state.digitsMirror=state.digitsMirror!==false;
  state.overlapOnly=!!state.overlapOnly;
  state.bitColor=/^#[0-9a-f]{6}$/i.test(state.bitColor)?state.bitColor:'#9fffc8';
  state.mult=[1,2,3].includes(state.mult)?state.mult:1;
  state.sets=Array.from({length:3},(_,i)=>{const v=state.sets?.[i]||{};return {source:['shared','field','own','serp'].includes(v.source)?v.source:'shared',rows:Array.isArray(v.rows)?v.rows:ZZ_INITIAL_ROWS.slice(),color:/^#[0-9a-f]{6}$/i.test(v.color)?v.color:['#70e0d7','#ffd166','#ed8fea'][i]};});
  state.png=Object.assign({frame:'scene',width:2048,height:2048,transparent:true},state.png||{});
  function stopPath(m){m.path.enabled=false;delete m.path.anchorX;delete m.path.anchorY;delete m.path.anchorAngle;}
  function preparePath(m){try{pathFns.set(m,sceneMath.compile(m.path));}catch(e){m.path.enabled=false;pathFns.delete(m);}}
  function pathValue(m){const p=m.path,t=(((p.elapsed||0)/p.period+p.phase/360)%1+1)%1,f=pathFns.get(m);return f?f(t):[0,0,0];}
  function anchorPath(m){const p=m.path,v=pathValue(m),ax=p.ampX,ay=p.kind==='circle'?p.ampX*drawW/Math.max(1,drawH):p.ampY;p.anchorX=m.x-v[0]*ax;p.anchorY=m.y-v[1]*ay;p.anchorAngle=m.angle-v[2];}
  for(const m of state.mirrors){const p=m.path;p.period=clamp(Number(p.period)||12,.25,3600);p.phase=clamp(Number(p.phase)||0,0,360);p.ampX=Number.isFinite(p.ampX)?clamp(p.ampX,0,.45):.12;p.ampY=Number.isFinite(p.ampY)?clamp(p.ampY,0,.45):.08;p.elapsed=Number(p.elapsed)||0;preparePath(m);}

  let raf = 0, previous = 0, dirty = true, geometry = '', rowsKey = '', drawW = 0, drawH = 0, dpr = 1;
  let persistTimer = 0, notice = '', snapHint = '';
  const persist = () => { clearTimeout(persistTimer); persistTimer=setTimeout(save,200); };
  const visible = () => win.getClientRects().length && !win.classList.contains('collapsed') && !win.dataset.parked && !document.hidden;
  const serp = (() => { const rows=['1'];for(let r=1;r<64;r++){const p=rows[r-1];let s='';for(let j=0;j<=r;j++)s+=(Number(p[j-1]||0)^Number(p[j]||0));rows.push(s);}return rows; })();
  const pendSettings=state.pendulum ||= {depth:512,limit:512,frame:1,speed:8,colored:true};
  let pendulum=null,pendTarget=null,pendPlaying=false,pendClock=0;
  function pendEngine(){if(!pendulum){pendulum=new ZZMirrorPendulum(pendSettings.depth,pendSettings.limit);pendSettings.depth=pendulum.depth;pendSettings.limit=pendulum.limit;pendTarget=clamp(Number(pendSettings.frame)||0,0,pendulum.limit);}return pendulum;}
  const rows = () => state.source==='pend' ? pendEngine().rows() : state.source==='field' ? Z.rows : state.source==='own' ? state.rows : state.source==='base' ? ZZ_INITIAL_ROWS : serp;
  state.symmetryMinimums=ZZBitSymmetry.limits(rows(),state.symmetryMinimums);
  const button = (text, title, action, parent) => { const b=document.createElement('button');b.type='button';b.textContent=text;b.title=title;b.setAttribute('aria-label',title);b.onclick=action;parent.append(b);return b; };
  const changed = (redrawBase=false) => { notice='';if(redrawBase)dirty=true;persist();request(); };
  window.addEventListener('bitsymmetryready',()=>{if(!state.bitSymmetry)return;for(const [key,src] of sourceCache)if(src.symmetry===null)sourceCache.delete(key);request();});
  const notify = message => { notice=message;status.textContent=message; };
  const turnMirror=(m,delta)=>{m.angle=norm(m.angle+delta);};
  const motionSnap=which=>which.batch?{batch:which.batch.map(motionSnap)}:which.bitAngles?{bitAngles:{zero:state.zero,one:state.one}}:which.fieldAxes?{fieldAxes:{...state.fieldAxes}}:which.source!==undefined?{source:which.source,offset:state.sourceOffsets[which.source].slice()}:which.mirror!==undefined?{mirror:which.mirror,values:{...Object.fromEntries(['x','y','angle','grip','gripAngle','turnGrip'].map(key=>[key,state.mirrors[which.mirror][key]])),magnetPins:state.mirrors[which.mirror].magnetPins.slice(),figureOffset:state.mirrors[which.mirror].figureOffset.slice(),copyOffsets:state.mirrors[which.mirror].copyOffsets.map(p=>p.slice())}}:{camera:{pan:state.pan.slice(),zoom:state.zoom,angle:state.viewAngle}};
  function translateMirror(m,before,x,y){
    Object.assign(m,{x,y,angle:before.angle});
  }
  function reflectedCopies(){
    return sceneMath.copies(state.mirrors,(x,y,angle)=>ZZMirrorGeometry.matrix(x*drawW,y*drawH,angle));
  }
  window.zzZerkaliusSnap=motionSnap;
  window.zzZerkaliusApply=step=>{
    if(step.batch){step.batch.forEach(window.zzZerkaliusApply);return;}
    if(step.bitAngles){setBitAngles(step.bitAngles);changed(true);return;}
    if(step.fieldAxes){Object.assign(state.fieldAxes,step.fieldAxes);changed();return;}
    if(step.source!==undefined){state.sourceOffsets[step.source]=step.offset.slice();changed();return;}
    if(step.mirror!==undefined){const m=state.mirrors[step.mirror],c=controls[step.mirror];Object.assign(m,step.values);stopPath(m);m.spin=false;c.spin.textContent='▶';c.spin.setAttribute('aria-pressed','false');}
    else{state.pan=step.camera.pan.slice();state.zoom=step.camera.zoom;state.viewAngle=step.camera.angle||0;}
    changed();
  };
  let motionGroup=null;
  function pushMotion(before,group=null){
    if(JSON.stringify(before)===JSON.stringify(motionSnap(before)))return;
    const now=Date.now();if(group&&motionGroup?.key===group&&now-motionGroup.time<400&&undoStack.at(-1)===motionGroup.entry){motionGroup.time=now;return;}
    const entry={zerk:before};undoPush(entry);motionGroup=group?{key:group,time:now,entry}:null;
  }
  function motionStep(which,action,group=null){const before=motionSnap(which);action();pushMotion(before,group);}

  function placeTools(el) {
    const xy=Z.zerkToolsXY||[8,8];
    el.style.left=clamp(xy[0],0,Math.max(0,stage.clientWidth-el.offsetWidth))+'px';
    el.style.top=clamp(xy[1],0,Math.max(0,stage.clientHeight-el.offsetHeight))+'px';
  }
  // v0.1164: гроздь на холсте легла на другую (прямоугольники пересеклись больше чем на 6 px) — после отпускания она возвращается на прежнее место
  const zerkOverlaps=el=>{   // v0.1166: сравниваются сами ромбы (шапка и видимые ромбы тела), а не прямоугольники — группы можно ставить вплотную ромб к ромбу
    const pts=g=>[g.querySelector(':scope > .smh'),...g.querySelectorAll(':scope > .zerk-grape-body > *')].filter(n=>n&&n.getClientRects().length).map(n=>{const q=n.getBoundingClientRect();return [q.left+q.width/2,q.top+q.height/2,(q.width+q.height)/4];});
    const mine=pts(el);return [...stage.querySelectorAll(':scope > .zerk-grape')].some(g=>g!==el&&g.getClientRects().length&&pts(g).some(([x,y,h])=>mine.some(([a,b,k])=>Math.abs(x-a)+Math.abs(y-b)<h+k-8)));};
  /* v0.1167, «вот так тоже магнитить»: рядом с другой гроздью ромбы встают в её решётку — ромб в ромб. Центры всех ромбов грозди лежат на сетке 24 px
     со сдвигом шахматкой, поэтому верхний левый угол грозди ставится в точку чужой решётки (a·24, b·24) с чётной суммой a+b. */
  const zerkLatticeSnap=(el,x,y)=>{let best=null,bd=13;for(const g of stage.querySelectorAll(':scope > .zerk-grape')){if(g===el||!g.getClientRects().length)continue;const q=g.getBoundingClientRect();
      if(Math.abs(x-q.left)>200||Math.abs(y-q.top)>280)continue;const fa=(x-q.left)/24,fb=(y-q.top)/24;
      for(const a of [Math.floor(fa),Math.ceil(fa)])for(const b of [Math.floor(fb),Math.ceil(fb)]){if((a+b)&1)continue;const px=q.left+24*a,py=q.top+24*b,d=Math.hypot(px-x,py-y);if(d<bd){bd=d;best=[px,py];}}}
    return best||[x,y];};
  const plateSetup=el=>{
    const c=SOL_PLATES[el.id];
    const hd=el.querySelector('.smh');hd.title='Тяни гроздь правой кнопкой за любой ромб; шапку можно тянуть любой кнопкой. К верхней или нижней полосе — закрепить; обратно на холст — открепить; − / + — свернуть';
    el.querySelector('.pminbtn').onclick=e=>{e.stopPropagation();plateFoldToggle(el);};
    el.addEventListener('click',e=>{if(e.detail!==0&&performance.now()<(el._solDragUntil||0)){e.preventDefault();e.stopImmediatePropagation();}},true);
    el.addEventListener('pointerdown',e=>{
      const diamond=e.target.closest('.zerk-diamond,.zerk-header-number'),head=e.target.closest('.smh');   // номер зеркала в шапке — тоже ручка: щелчок без сдвига по-прежнему включает ось
      if(![0,2].includes(e.button)||(!diamond&&!head)||e.target.closest('input[type=range],input[type=number],select,textarea')||(!diamond&&e.target.closest('button,input,label')))return;
      el._solDragUntil=0;const handle=diamond||hd;e.stopPropagation();
      const start=[e.clientX,e.clientY],r0=el.getBoundingClientRect();let moved=false;const xy0=Array.isArray(Z[c.xy])?Z[c.xy].slice():null,wasDocked=!!Z[el.id+'Head'];
      const move=ev=>{if(ev.pointerId!==e.pointerId)return;if(!moved&&Math.hypot(ev.clientX-start[0],ev.clientY-start[1])<4)return;
        ev.preventDefault();ev.stopPropagation();el._solDragUntil=performance.now()+400;
        if(!moved){moved=true;handle.setPointerCapture(e.pointerId);if(el._zerkDock&&Z[el.id+'Head']){el._zerkDock(false);Z[c.xy]=[r0.left-stage.getBoundingClientRect().left,r0.top-stage.getBoundingClientRect().top];handle.setPointerCapture(e.pointerId);}el.classList.add('pdrag');document.body.classList.add('cgdrag');window.zzPanelDragStart?.(el,e.altKey);}
        const [x,y]=zerkLatticeSnap(el,...plateSnap(el,r0,ev.clientX-start[0],ev.clientY-start[1])),host=stage.getBoundingClientRect();
        /* v0.1141, «подтупливает при занесении в верхнюю полоску»: холст режет всё за своим краем, и гроздь, поднесённая к полосе, прижималась к его верху и
           стояла, пока не отпустишь. Теперь над полосой она сразу встаёт в неё и едет за указателем; ушёл с полосы — снова на холсте. */
        const target=el._zerkDock?dockTarget(ev):null;
        if(target){const dock=target==='bottom'?footerDock:headerDock;if(el.parentElement!==dock){dock.append(el);el.classList.add('zerk-docked');try{handle.setPointerCapture(e.pointerId);}catch(_){}}
          const d=dock.getBoundingClientRect();el.style.left=clamp(r0.left+ev.clientX-start[0]-d.left,24,Math.max(24,dock.clientWidth-el.offsetWidth-16))+'px';el.style.top='0px';}
        else{if(el._zerkDock&&el.parentElement!==stage){stage.append(el);el.classList.remove('zerk-docked');try{handle.setPointerCapture(e.pointerId);}catch(_){}}Z[c.xy]=[x-host.left,y-host.top];c.place(el);}
        window.zzPanelLinkSync?.();if(el._zerkDock){win.querySelector(':scope > .whead').classList.toggle('zerk-dock-target',target==='top');footerDock.classList.toggle('zerk-dock-target',target==='bottom');}};
      const end=ev=>{if(ev.pointerId!==e.pointerId)return;document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',end,true);document.removeEventListener('pointercancel',end,true);if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);
        if(moved){el._solDragUntil=performance.now()+400;el.classList.remove('pdrag');document.body.classList.remove('cgdrag');window.zzPanelDragEnd?.(el);zSnapGlow([]);if(el._zerkDock){const edge=ev.type==='pointerup'&&dockTarget(ev);if(edge){const target=edge==='bottom'?footerDock:headerDock;el._zerkDock(true,r0.left+ev.clientX-start[0]-target.getBoundingClientRect().left,edge);}else if(el.parentElement!==stage){stage.append(el);el.classList.remove('zerk-docked');c.place(el);}win.querySelector(':scope > .whead').classList.remove('zerk-dock-target');footerDock.classList.remove('zerk-dock-target');}if(moved&&el.parentElement===stage&&zerkOverlaps(el)){if(wasDocked)el._zerkDock(true);else{if(xy0)Z[c.xy]=xy0;else delete Z[c.xy];c.place(el);}}save();}};   // v0.1164, «не давай группы класть друг на друга — просто верни на старое место»
      document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',end,true);document.addEventListener('pointercancel',end,true);
    },true);
    el.addEventListener('contextmenu',e=>{if(e.target.closest('.zerk-diamond,.zerk-header-number,.smh')){e.preventDefault();e.stopPropagation();}},true);
  };
  SOL_PLATES.zerkTools={name:'Зеркалиус · три зеркала',min:'zerkToolsMin',xy:'zerkToolsXY',col:'#70e0d7',place:placeTools,init:plateSetup};
  plateInit(tools);
  const body=tools.querySelector('.zerk-controls');
  const sourceLabel=document.createElement('label'), source=document.createElement('select');source.id='zerkSource';source.setAttribute('aria-label','Источник строк Зеркалиуса');
  for(const [v,t] of [['serp','Серпинский'],['base','Исходный из хаба'],['field','Строки поля'],['own','Свои строки'],['pend','Зеркальный маятник']]){const o=document.createElement('option');o.value=v;o.textContent=t;source.append(o);}
  source.value=state.source;sourceLabel.append(document.createTextNode('Узор'),source);body.append(sourceLabel);
  const own=document.createElement('div');own.id='zerkOwn';own.hidden=state.source!=='own';
  const text=document.createElement('textarea');text.id='zerkText';text.setAttribute('aria-label','Свои битовые строки');text.placeholder='1\n11\n101\n1111';text.value=state.rows.join('\n');own.append(text);
  const file=document.createElement('input');file.type='file';file.accept='.txt,.json,text/plain,application/json';file.hidden=true;file.id='zerkRowsFile';own.append(file);
  const ownActions=document.createElement('div');ownActions.className='zerk-row';own.append(ownActions);
  function parseRows(raw){
    let value=raw.trim();if(!value)throw Error('Вставьте хотя бы одну строку из 0 и 1');
    if(value[0]==='['||value[0]==='{'){const data=JSON.parse(value);value=Array.isArray(data)?data:data.rows; if(!Array.isArray(value))throw Error('В JSON нужен массив строк или объект rows');}
    else value=value.split(/\r?\n/).map(s=>s.replace(/\s/g,'')).filter(Boolean);
    if(!value.length||value.length>2048)throw Error('Нужно от 1 до 2048 строк');
    if(value.some(s=>typeof s!=='string'||! /^[01]+$/.test(s)))throw Error('В строках допустимы только 0 и 1');
    if(value.reduce((n,s)=>n+s.length,0)>1000000)throw Error('Набор слишком большой: максимум 1 миллион бит');
    return value;
  }
  function useOwn(raw){try{pendPlaying=false;state.rows=parseRows(raw);state.source='own';source.value='own';own.hidden=false;text.value=state.rows.join('\n');changed(true);notify('Загружено '+state.rows.length+' строк');plateZig(tools,'#70e0d7');placeTools(tools);}catch(e){notify(e.message);}}
  button('Применить','Построить по своим строкам',()=>useOwn(text.value),ownActions);
  button('TXT / JSON','Загрузить свои строки из TXT или JSON',()=>file.click(),ownActions);
  file.onchange=async()=>{const f=file.files[0];if(!f)return;try{useOwn(await f.text());}catch(e){notify('Не удалось прочитать файл: '+e.message);}file.value='';};
  body.append(own);
  source.onchange=()=>{state.source=source.value;state.followField=state.source==='field';pendPlaying=false;pendClock=0;if(state.source==='pend'){pendEngine();state.build='axes';}own.hidden=state.source!=='own';changed(true);plateZig(tools,'#70e0d7');placeTools(tools);};
  const actions=document.createElement('div');actions.className='zerk-row';body.append(actions);
  button('Поле → свои','Скопировать текущие строки поля в свои строки',()=>useOwn(Z.rows.join('\n')),actions);
  button('В поле','Перенести исходные строки выбранного узора в поле; ↩ отменяет',()=>{
    if(state.source==='pend'){notify('Кадр маятника содержит пустые клетки. Сохраните его как PNG; бинарные строки поля не хранят пустоту.');return;}
    if(rowsLocked())return;
    const next=rows().slice();snapshot();Z.rows=next;Z.cur=0;rowSel.clear();syncLane();rowsOrigSet();renderAll();save();say('Зеркалиус: '+next.length+' строк перенесено в поле. ↩ вернёт.');
  },actions);
  button('PNG','Настроить выходной PNG',()=>{},actions);
  for(let i=0;i<3;i++){
    const m=state.mirrors[i], section=document.createElement('div');section.className='zerk-mirror-controls';section.dataset.mirror=String(i+1);section.style.setProperty('--mirror-color',m.color);
    const row=document.createElement('div');row.className='zerk-row';section.append(row);
    const on=document.createElement('input');on.type='checkbox';on.checked=m.on;on.setAttribute('aria-label','Зеркало '+(i+1)+' включено');
    const label=document.createElement('label');label.className='zerk-label';label.append(on,document.createTextNode('Зеркало '+(i+1)));row.append(label);
    const color=document.createElement('input');color.type='color';color.value=m.color;color.setAttribute('aria-label','Цвет зеркала '+(i+1));row.append(color);
    const spin=button(m.spin?'Ⅱ':'▶','Вращать зеркало '+(i+1),()=>{stopPath(m);m.spin=!m.spin;spin.textContent=m.spin?'Ⅱ':'▶';spin.setAttribute('aria-pressed',String(m.spin));changed();},row);spin.className='zerk-auto';spin.setAttribute('aria-pressed',String(m.spin));
    const speed=document.createElement('input');speed.type='number';speed.min='-90';speed.max='90';speed.step='1';speed.value=m.speed;speed.setAttribute('aria-label','Скорость зеркала '+(i+1)+' в градусах в секунду');row.append(speed,document.createTextNode('°/с'));
    const angleRow=document.createElement('label'), wrap=document.createElement('span');wrap.className='zerk-range range-with-arrows';
    const angle=document.createElement('input');angle.type='range';angle.min='0';angle.max='179';angle.step='1';angle.value=Math.round(m.angle*180/pi)%180;angle.setAttribute('aria-label','Угол зеркала '+(i+1));angle.dataset.noSlider='true';
    const output=document.createElement('output');output.className='zerk-angle';output.textContent=angle.value+'°';
    const pause=()=>{stopPath(m);m.spin=false;spin.textContent='▶';spin.setAttribute('aria-pressed','false');};
    const rotate=(delta,group=false)=>motionStep({mirror:i},()=>{pause();turnMirror(m,delta*pi/180);changed();},group?'turn'+i:null);
    button('◂','Повернуть зеркало '+(i+1)+' на −5°',()=>rotate(-5),wrap);wrap.append(angle);button('▸','Повернуть зеркало '+(i+1)+' на +5°',()=>rotate(5),wrap);
    angleRow.append(wrap,output);section.append(angleRow);body.append(section);
    on.onchange=()=>{const active=state.mirrors.some(v=>v.on&&(v.spin||v.path.enabled));m.on=on.checked;if(!m.on){m.spin=false;m.path.enabled=false;}else if(active)m.spin=true;changed();};color.oninput=()=>{m.color=color.value;state.palette='custom';section.style.setProperty('--mirror-color',m.color);changed();};
    speed.onchange=()=>{m.speed=clamp(Number(speed.value)||0,-90,90);speed.value=m.speed;changed();};
    angle.oninput=()=>{motionStep({mirror:i},()=>{pause();turnMirror(m,Number(angle.value)*pi/180-m.angle);changed();},'angle'+i);};
    controls.push({angle,output,spin,on,color,speed,section});
    const line=document.createElement('div');line.className='zerk-mirror';line.dataset.mirror=String(i+1);
    const center=document.createElement('button');center.type='button';center.className='zerk-center';center.textContent=i+1;center.setAttribute('aria-label','Переместить зеркало '+(i+1));
    const turn=document.createElement('button');turn.type='button';turn.className='zerk-turn';turn.textContent='↻';turn.setAttribute('aria-label','Повернуть зеркало '+(i+1));
    const axis=document.createElement('span');axis.className='zerk-axis';axis.tabIndex=0;axis.setAttribute('role','button');axis.setAttribute('aria-label','Переместить зеркало '+(i+1)+' за любое место оси');const deg=document.createElement('span');deg.className='zerk-deg';deg.setAttribute('aria-hidden','true');   // v0.1183, «рядом с осью, где кнопка кручения, покажи градусы текущего»
    line.append(center,turn,deg);layer.prepend(axis);layer.append(line);handles.push({line,center,turn,axis,deg});
    // v0.1172, «у осей кнопки скрывай за битами, но выведи вперёд при наведении на эту ось»: ромбы оси бледные, пока указатель не на её линии или ромбах
    for(const node of [axis,center,turn]){node.addEventListener('pointerenter',()=>line.classList.add('hot'));node.addEventListener('pointerleave',()=>line.classList.remove('hot'));}
    for(const [node,turning] of [[center,false],[axis,false],[turn,true]]){
      node.title=(turning?'Тяни малую ручку — повернуть зеркало вокруг большого ромба; колесо или стрелки — шаг 5°':'Тяни ромб или линию — перенести зеркало без поворота; щелчок по ромбу — +15°; стрелки — сдвиг')+'; магнит помогает совместить, Alt — без магнита; правый щелчок — включить / выключить';
      node.addEventListener('pointerdown',e=>{
        if(e.button!==0)return;e.preventDefault();e.stopPropagation();const before=motionSnap({mirror:i}),targets=turning?null:magnetBits(i);
        node.focus({preventScroll:true});line.classList.add('grabbing');node.setPointerCapture(e.pointerId);
        const r=stage.getBoundingClientRect(),sx=e.clientX,sy=e.clientY,x=m.x,y=m.y,a=m.angle,p=viewPoint(x,y),cx=r.left+p[0],cy=r.top+p[1],start=Math.atan2(sy-cy,sx-cx);let moved=false;
        const move=ev=>{if(ev.pointerId!==e.pointerId)return;if(!moved&&Math.hypot(ev.clientX-sx,ev.clientY-sy)<3)return;moved=true;pause();
          const magnetic=state.magnet&&!ev.altKey,others=state.mirrors.filter(other=>other!==m&&other.on);let snapped=false;snapHint='';
          if(turning){const raw=norm(a+Math.atan2(ev.clientY-cy,ev.clientX-cx)-start),result=magnetic?sceneMath.snapAngle(raw,others.concat(fieldAxisTargets())):{angle:raw};m.angle=result.angle;snapped=!!result.snapped;snapHint=snapped?result.label:'';}
          else{const [dx,dy]=worldDelta(ev.clientX-sx,ev.clientY-sy);let px=x*drawW+dx,py=y*drawH+dy;
            if(magnetic){const result=magneticPosition(px,py,others,state.zoom,targets);px=result.x/state.zoom;py=result.y/state.zoom;snapped=!!result.snapped;snapHint=snapped?result.label:'';}
            translateMirror(m,before.values,px/drawW,py/drawH);}
          line.classList.toggle('snapped',snapped);changed();};
        const end=ev=>{if(ev.pointerId!==e.pointerId)return;node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',end);if(node.hasPointerCapture(e.pointerId))node.releasePointerCapture(e.pointerId);line.classList.remove('snapped','grabbing');snapHint='';
          if(ev.type==='pointercancel'){Object.assign(m,before.values);changed();}else if(!moved&&node===center)rotate(15);else{if(moved)pushMotion(before);persist();request();}};
        node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);
      });
      node.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();m.on=!m.on;on.checked=m.on;changed();};
      node.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();
        if(turning)rotate(e.key==='ArrowLeft'||e.key==='ArrowDown'?-5:5);
        else motionStep({mirror:i},()=>{pause();const step=e.shiftKey?20:4,[dx,dy]=worldDelta(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0);m.x+=dx/drawW;m.y+=dy/drawH;changed();});};
      if(turning)node.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();rotate(Math.sign(e.deltaY)*5,true);},{passive:false});
    }
  }
  const bitAngleControls={};
  function setBitAngles(values){for(const key of ['zero','one']){state[key]=values[key];const {input,out}=bitAngleControls[key];input.value=state[key];out.textContent=state[key]+'°';}}
  for(const [key,caption] of [['zero','Наклон 0'],['one','Наклон 1']]){
    const label=document.createElement('label'), input=document.createElement('input'), out=document.createElement('output'),wrap=document.createElement('span');wrap.className='zerk-range range-with-arrows';input.type='range';input.min='-60';input.max='60';input.step='1';input.value=state[key];input.setAttribute('aria-label',caption);out.textContent=state[key]+'°';label.append(document.createTextNode(caption),wrap,out);body.append(label);
    bitAngleControls[key]={input,out};
    input.oninput=()=>{state[key]=Number(input.value);out.textContent=state[key]+'°';changed(true);};
    const step=delta=>{input.value=clamp(Number(input.value)+delta,-60,60);input.oninput();};
    button('◂',caption+': −1°',()=>step(-1),wrap);wrap.append(input);button('▸',caption+': +1°',()=>step(1),wrap);
  }
  for(const [key,caption] of [['tint','Цветные отражения'],['trace','Отрезки битов: 1 ↘, 0 ↗']]){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=state[key];input.setAttribute('aria-label',caption);input.title=key==='trace'?'Короткий отрезок внутри ячейки: 1 — наклон вправо вниз, 0 — вправо вверх':caption;label.append(input,document.createTextNode(caption));body.append(label);input.onchange=()=>{state[key]=input.checked;changed(key==='trace');};}
  button('Вернуть три зеркала','Вернуть начальные положения трёх зеркал',()=>{defaults().forEach((m,i)=>{stopPath(state.mirrors[i]);Object.assign(state.mirrors[i],m,{mode:'direct',figureOffset:[0,0],copyOffsets:Array.from({length:8},()=>[0,0]),magnetPins:[false,false]});});state.mirrors.forEach((m,i)=>{Object.assign(controls[i].on,{checked:m.on});controls[i].color.value=m.color;controls[i].speed.value=m.speed;controls[i].section.style.setProperty('--mirror-color',m.color);controls[i].spin.textContent='▶';controls[i].spin.setAttribute('aria-pressed','false');});changed();},body);
  const groups=[], compactUpdates=[];
  delete state.buttonPositions; // v0.1132: layout belongs to whole grapes.
  function resetGroups(){
    for(const group of groups){delete Z[group.id+'XY'];group._zerkDock(false);platePlace(group);}save();
  }
  const headerDock=document.createElement('div');headerDock.id='zerkHeaderDock';headerDock.setAttribute('aria-label','Закреплённые группы Зеркалиуса');
  const footerDock=document.createElement('div');footerDock.id='zerkFooterDock';footerDock.setAttribute('aria-label','Группы в нижней полосе Зеркалиуса');stage.append(footerDock);
  function dockTarget(e){if(e.altKey)return null;const h=win.querySelector(':scope > .whead').getBoundingClientRect(),s=stage.getBoundingClientRect();if(e.clientX>=h.left&&e.clientX<=h.right&&e.clientY>=h.top-24&&e.clientY<=h.bottom+24)return 'top';if(e.clientX>=s.left&&e.clientX<=s.right&&e.clientY>=s.bottom-32&&e.clientY<=s.bottom+24)return 'bottom';return null;}
  win.querySelector(':scope > .whead').insertBefore(headerDock,win.querySelector(':scope > .whead .wt').nextSibling);
  headerDock.addEventListener('pointerdown',e=>e.stopPropagation());headerDock.addEventListener('dblclick',e=>e.stopPropagation());
  footerDock.addEventListener('pointerdown',e=>e.stopPropagation());footerDock.addEventListener('dblclick',e=>e.stopPropagation());
  function grape(id,title,color,home){
    const el=document.createElement('aside');el.id=id;el.className='zerk-grape sol-plate';el.style.setProperty('--mirror-color',color);
    const hd=document.createElement('div');hd.className='smh zerk-grape-head';const caption=document.createElement('span');caption.textContent=title;hd.append(caption);
    const fold=button('−','Свернуть / раскрыть '+title,()=>{},hd);fold.className='pminbtn';el.append(hd);const wide=document.createElement('span');wide.className='zerk-head-wide';wide.title='Свернуть / раскрыть «'+title+'»';wide.addEventListener('pointerdown',e=>e.stopPropagation());wide.addEventListener('click',e=>{e.stopPropagation();(el._zerkHeaderAction||(()=>plateFoldToggle(el)))();});el.prepend(wide);   // «у раскрытой группы за первым ромбом — расширенный ромб»: щелчок по его краям сворачивает
    const content=document.createElement('div');content.className='zerk-grape-body';el.append(content);stage.append(el);
    el._zerkDock=(pinned,x,edge)=>{if(edge)Z[id+'HeadEdge']=edge;const dock=Z[id+'HeadEdge']==='bottom'?footerDock:headerDock;if(pinned){if(Number.isFinite(x)){Z[id+'HeadX']=x;Z[id+'HeadWidth']=dock.clientWidth;}else if(!Number.isFinite(Z[id+'HeadX']))Z[id+'HeadX']=Math.max(0,...[...dock.children].filter(n=>n!==el).map(n=>n.offsetLeft+n.offsetWidth));if(!Number.isFinite(Z[id+'HeadWidth']))Z[id+'HeadWidth']=dock.clientWidth;}Z[id+'Head']=pinned;el.classList.toggle('zerk-docked',pinned);(pinned?dock:stage).append(el);SOL_PLATES[id].place(el);};
    const place=node=>{if(Z[id+'Head']){const dock=Z[id+'HeadEdge']==='bottom'?footerDock:headerDock;const available=Math.max(0,dock.clientWidth-node.offsetWidth),savedWidth=Z[id+'HeadWidth']||dock.clientWidth,offset=Z[id+'HeadX']||0,x=dock.clientWidth<savedWidth?offset*available/Math.max(1,savedWidth-node.offsetWidth):offset;node.style.left=clamp(x,24,Math.max(24,available-16))+'px';node.style.top='0px';return;}const xy=Z[id+'XY']||(typeof home==='function'?home():home);node.style.left=clamp(xy[0],24,Math.max(24,stage.clientWidth-node.offsetWidth-16))+'px';node.style.top=clamp(xy[1],0,Math.max(0,stage.clientHeight-node.offsetHeight))+'px';};
    SOL_PLATES[id]={name:title,min:id+'Min',xy:id+'XY',col:color,place,init:plateSetup};plateInit(el);groups.push(el);
    hd.addEventListener('click',e=>{if(e.target.closest('button,input,select,textarea,label')||performance.now()<(el._solDragUntil||0))return;(el._zerkHeaderAction||(()=>plateFoldToggle(el)))();});
    hd.tabIndex=0;hd.setAttribute('role','button');hd.setAttribute('aria-label','Раскрыть / свернуть '+title);hd.onkeydown=e=>{if(e.target===hd&&(e.key==='Enter'||e.key===' ')){e.preventDefault();plateFoldToggle(el);}};
    el._zerkDock(!!Z[id+'Head']);
    return content;
  }
  function diamond(node,caption,parent){node.classList.add('zerk-diamond');if(node.tagName==='BUTTON')node.textContent=caption;node.style.left='0px';node.style.top='1e6px';parent.append(node);zerkStack(parent);return node;}
  /* v0.1165: ромбы группы — парами по обе стороны от верхнего, между парами один посередине; порядок — по прежним top/left.
     Ромбы выступают на 24 px левее и на 16 px правее грозди, поэтому гроздь не подходит к краю холста и полосы ближе. */
  function zerkStack(g){const wide=document.documentElement.classList.contains('mi-wide'),px=v=>parseFloat(v)||0,kids=[...g.children].sort((a,b)=>px(a.style.top)-px(b.style.top)||px(a.style.left)-px(b.style.left));let h=0;kids.forEach((n,k)=>{let r=Math.floor(k/3),j=k%3;if(j===0&&k===kids.length-1&&k)j=2;const t=48*r+(j>1?24:0);n.style.left=(wide?[-156,36,-60]:[-48,0,-24])[j]+'px';n.style.top=t+'px';h=Math.max(h,t+48);});g.style.setProperty('--grape-height',h+'px');}
  // «когда включены подсказки — расширять каждый ромб» (menu-icons v10): ромбы шириной 120, шаг решётки 96
  addEventListener('mi-wide',()=>{for(const g of new Set([...document.querySelectorAll('.zerk-diamond')].map(n=>n.parentElement)))if(g)zerkStack(g);});
  function editor(nodes){const el=document.createElement('div');el.className='zerk-editor';el.hidden=true;for(const n of nodes)el.append(n);body.append(el);return el;}
  function openEditor(el,caption,anchor){for(const v of body.children)v.hidden=v!==el;tools.hidden=false;tools.querySelector('.smh span').textContent=caption;
    Z.zerkToolsMin=false;plateFoldSync(tools);const close=tools.querySelector('.pminbtn');close.textContent='×';close.setAttribute('aria-label','Закрыть настройку');const r=anchor.getBoundingClientRect(),s=stage.getBoundingClientRect();Z.zerkToolsXY=[r.right-s.left+8,r.top-s.top];plateZig(tools,'#70e0d7');placeTools(tools);}
  function editDiamond(caption,title,el,parent){let b; b=button(caption,title,()=>openEditor(el,title,b),parent);return diamond(b,caption,parent);}
  // Controls remain the same inputs and handlers; diamonds open only the needed editor.
  const oldActions=[...actions.children], oldView=[...body.children].filter(n=>n!==sourceLabel&&n!==own&&n!==actions&&!n.classList.contains('zerk-mirror-controls'));
  const sourceEditor=editor([sourceLabel,own]), rowGroup=grape('zerkRowsG','Строки','#a3e635',[24,8]);
  /* v0.1168, «тут надо в ромбы всё перевести», «эти варианты пусть открываются, когда на неё нажать, на главную»: список «Узор» заменён ромбами.
     Главный ромб показывает текущий узор; нажатие раскрывает справа от грозди лесенку ромбов-вариантов, выбор или щелчок мимо — сворачивает. */
  /* Ромб-выбор: главный ромб показывает текущий вариант (его подпись), нажатие раскрывает справа от грозди лесенку ромбов-вариантов;
     выбор или щелчок мимо — сворачивает, включённый вариант светится. options: [[значение, подпись, подсказка]]. */
  function fanDiamond(parent,title,options,get,pick){
    const fan=document.createElement('div');fan.className='zerk-source-fan';fan.hidden=true;const items={};
    const close=()=>{fan.hidden=true;main.classList.remove('open');};
    const main=button(options[0][1],title,()=>{fan.hidden=!fan.hidden;main.classList.toggle('open',!fan.hidden);},parent);diamond(main,options[0][1],parent);
    for(const [v,caption,tip,icon] of options){items[v]=diamond(button(caption,tip,()=>{close();pick(v,main);},fan),caption,fan);if(icon)items[v].dataset.miIcon=icon;}
    parent.parentElement.append(fan);
    document.addEventListener('pointerdown',e=>{if(!fan.hidden&&!fan.contains(e.target)&&!main.contains(e.target))close();},true);
    compactUpdates.push(()=>{const cur=get(),host=main.parentElement?.parentElement;if(host&&fan.parentElement!==host)host.append(fan);   // ромб переложили в другую гроздь — лесенка за ним
      [...fan.children].forEach((n,k)=>{n.style.left=(48+(k%2?24:0))+'px';n.style.top=(parseFloat(main.style.top)+k*24)+'px';});
      const o=options.find(o=>o[0]===cur);if(o){main.textContent=o[1];if(o[3])main.dataset.miIcon=o[3];}for(const [v,d] of Object.entries(items)){const on=cur===v;d.classList.toggle('on',on);d.setAttribute('aria-pressed',String(on));}});
    return main;
  }
  sourceLabel.hidden=true;
  fanDiamond(rowGroup,'Узор: выбрать источник строк',[['serp','△\nСерп.','Узор: Серпинский'],['base','◇\nхаб','Узор: исходный из хаба'],['field','≡\nполе','Узор: строки поля'],['own','↥\nсвои','Узор: свои строки — вставить или загрузить TXT / JSON'],['pend','↔\nмаят.','Узор: зеркальный маятник']],()=>state.source,
    (v,main)=>{if(v==='own'){pendPlaying=false;source.value=state.source='own';own.hidden=false;changed(true);openEditor(sourceEditor,'Свои строки · TXT / JSON',main);return;}if(state.source!==v){source.value=v;source.onchange();}});
  for(const [i,caption] of ['≡\nкопия','↦\nв поле','▣\nPNG'].entries())if(i>1)diamond(oldActions[i],caption,rowGroup);actions.remove();   // v0.1158, «эту кнопку убери», «эту тоже»: «≡ копия» (строки поля — в свои) и «↦ в поле» (строки узора — в поле) в грозди не показываются
  buildSceneEditor(rowGroup);
  buildPngEditor(oldActions[2]);
  buildPendulumEditor(rowGroup);
  function splitDiamond(title,get,step,parent,opts){
    const node=document.createElement('div');node.className='zerk-split';const value=document.createElement('span');value.className='zerk-split-value';node.append(value);
    const minus=button('◂',title+': уменьшить',()=>step(-1),node),plus=button('▸',title+': увеличить',()=>step(1),node);minus.className='zerk-half zerk-half-minus';plus.className='zerk-half zerk-half-plus';diamond(node,'',parent);
    node.title=title+' · наведи и нажми левую или правую половину';compactUpdates.push(()=>value.textContent=get());
    if(opts){   // v0.1174, по снимку наклона: «между ромб узкий — 0 возвращает в 0, ширина 1/2 от обычного, та же высота; и к стрелкам двойную стрелку — прибавление по 5% от шкалы»
      node.classList.add('zerk-split-wide');const big=opts.big;
      const fast=[button('◂◂',title+': уменьшить на '+big,()=>step(-big),node),button('▸▸',title+': увеличить на '+big,()=>step(big),node)];fast[0].className='zerk-half zerk-half-minus2';fast[1].className='zerk-half zerk-half-plus2';
      const zero=button('',title+': вернуть в 0',opts.reset,node);zero.className='zerk-half zerk-split-zero';compactUpdates.push(()=>zero.textContent=get().replace(' ','\n'));}
    return node;
  }
  state.mirrors.forEach((m,i)=>{
    const c=controls[i],home=()=>stage.clientWidth>600?[168+136*i,8]:i===0?[168,8]:[24+(i-1)*144,248];
    const group=grape('zerkMirrorG'+(i+1),'Зеркало '+(i+1),m.color,home),head=group.parentElement.querySelector('.smh');group.parentElement.classList.add('zerk-speed-group');
    const caption=head.querySelector('span');caption.textContent='Зеркало';const number=button(String(i+1),'Включить / выключить ось '+(i+1),()=>{c.on.checked=!m.on;c.on.onchange();},head);number.className='zerk-header-number';
    c.on.closest('label').remove();head.querySelector('.pminbtn').remove();head.parentElement._zerkHeaderAction=()=>number.click();head.removeAttribute('role');head.removeAttribute('tabindex');
    compactUpdates.push(()=>{number.setAttribute('aria-pressed',String(m.on));number.title='Ось '+(i+1)+(m.on?' включена — выключить':' выключена — включить');plateFoldToggle(group.parentElement,!m.on,true);});
    const swatch=document.createElement('label');swatch.setAttribute('aria-label','Выбор цвета зеркала '+(i+1));swatch.title='Выбор цвета зеркала '+(i+1);const textColor=document.createElement('span');textColor.textContent='●\nцвет';swatch.append(c.color,textColor);diamond(swatch,'',group);
    const rotate=sign=>{motionStep({mirror:i},()=>{stopPath(m);m.spin=false;turnMirror(m,sign*pi/180);c.spin.textContent='▶';c.spin.setAttribute('aria-pressed','false');changed();});};
    splitDiamond('Угол зеркала '+(i+1),()=>Math.round(norm(m.angle)*180/pi)%180+'°',rotate,group,{big:9,reset:()=>motionStep({mirror:i},()=>{stopPath(m);m.spin=false;turnMirror(m,-m.angle);c.spin.textContent='▶';c.spin.setAttribute('aria-pressed','false');changed();})});   // v0.1186, «углы зеркала также — в 0 и двойные стрелки»: ◂◂ ▸▸ по 9° (5% шкалы 0–180°), узкий ромб — в 0°
    c.spin.remove();
    splitDiamond('Скорость зеркала '+(i+1),()=>m.speed+'\n°/с',sign=>{m.speed=clamp(m.speed+sign,-90,90);c.speed.value=m.speed;changed();},group);
    const speedWrap=document.createElement('span');speedWrap.className='zerk-header-speed range-with-arrows';
    const speedSlider=document.createElement('input');speedSlider.type='range';speedSlider.min=-90;speedSlider.max=90;speedSlider.step=1;speedSlider.value=m.speed;speedSlider.setAttribute('aria-label','Ползунок скорости зеркала '+(i+1));speedWrap.append(speedSlider);group.parentElement.append(speedWrap);   // v0.1141: бегунок — не в шапке, а вдоль граней шапки и первого ромба; при сворачивании остаётся
    speedSlider.oninput=()=>{m.speed=Number(speedSlider.value);c.speed.value=m.speed;changed();};speedSlider.addEventListener('pointerdown',e=>e.stopPropagation());speedSlider.addEventListener('click',e=>e.stopPropagation());
    const modes=['direct','inv','reverse','both'],captions=['→\nпрям','¬\nинв','⇄\nрев','¬⇄\nоба'];
    const modeNode=splitDiamond('Режим зеркала '+(i+1),()=>captions[modes.indexOf(m.mode)],sign=>{m.mode=modes[(modes.indexOf(m.mode)+sign+4)%4];changed();},group);
    modeNode.classList.add('is-selected');
    compactUpdates.push(()=>{modeNode.setAttribute('aria-label','Режим зеркала '+(i+1)+': '+({direct:'прямой',inv:'инверсия',reverse:'реверс',both:'инверсия и реверс'})[m.mode]);});
    buildPathEditor(m,i,group);c.section.remove();
    compactUpdates.push(()=>{group.parentElement.style.setProperty('--mirror-color',m.color);group.parentElement.style.setProperty('--control-color',sceneMath.controlColor(m.color));speedSlider.value=m.speed;c.spin.classList.toggle('on',m.spin);c.spin.textContent=m.spin?'Ⅱ':'▶';c.spin.setAttribute('aria-pressed',String(m.spin));});
  });
  const viewGroup=grape('zerkViewG','Вид','#c9a8ff',()=>stage.clientWidth>600?[24,248]:[stage.clientWidth-112,8]);
  for(const [i,n] of oldView.entries()){
    if(i<2){const key=['zero','one'][i],label=['Наклон 0','Наклон 1'][i];n.remove();splitDiamond(label,()=>i+' '+state[key]+'°',sign=>motionStep({bitAngles:true},()=>{const {input}=bitAngleControls[key];input.value=clamp(Number(input.value)+sign,-60,60);input.oninput();},'bitAngle'+i),viewGroup,{big:6,reset:()=>motionStep({bitAngles:true},()=>{const {input}=bitAngleControls[key];input.value=0;input.oninput();},'bitAngle'+i)});}   // v0.1170, «наклоны тоже стрелками»: ◂ ▸ прямо в ромбе
    else if(i<4){diamond(n,'',viewGroup);for(const t of [...n.childNodes])if(t.nodeType===3)t.textContent=i===2?'◈\nцвет':'╲ 1\n╱ 0';n.title=i===2?'Цветные отражения — каждая копия подкрашена цветом своего зеркала':'Отрезки битов — 1 ↘, 0 ↗ вместо ромбов';}
    else diamond(n,'↺\nсброс',viewGroup);
  }
  buildCycleEditor(viewGroup);
  const labelToggle=button('Аа\nподп.','Подписи зеркал и холстов',()=>{state.labels=!state.labels;changed();},viewGroup);diamond(labelToggle,'Аа\nподп.',viewGroup);
  compactUpdates.push(()=>{labelToggle.classList.toggle('on',state.labels);labelToggle.setAttribute('aria-pressed',String(state.labels));});
  const magnetToggle=button('🧲\nмагн.','Магнит зеркал: центры, середины и половины линий; углы 30°, 45°, 60°, 90°',()=>{state.magnet=!state.magnet;changed();},viewGroup);diamond(magnetToggle,'🧲\nмагн.',viewGroup);
  magnetToggle.style.left='48px';magnetToggle.style.top=labelToggle.style.top;viewGroup.style.setProperty('--grape-height',(Number.parseFloat(labelToggle.style.top)+48)+'px');viewGroup.parentElement.classList.add('zerk-view-group');
  compactUpdates.push(()=>{magnetToggle.classList.toggle('on',state.magnet);magnetToggle.setAttribute('aria-pressed',String(state.magnet));});
  /* v0.1169, «когда из строк берём биты, там тоже нужна возможность показа в ромбах, и добавь ещё квадрат-бит»: «01 биты» — ромб-выбор формы бита */
  const bitsToggle=fanDiamond(viewGroup,'Форма бита: ромб, квадрат или цифра',[['diamond','◇\nромб','Бит ромбом','shapeDiamond'],['diamond01','◇1\nромб 01','Бит ромбом с цифрой','shapeDiamond1'],['square','□\nквадр.','Бит квадратом','shapeSquare'],['square01','□1\nкв. 01','Бит квадратом с цифрой','shapeSquare1'],['circle','○\nкруг','Бит кругом','shapeCircle'],['circle01','○1\nкруг 01','Бит кругом с цифрой','shapeCircle1'],['digits','01\nбиты','Бит цифрой 0 / 1 без заливки','shapeDigits']],   // v0.1182, «форма нужна с цифрой и с ромбом, ещё с квадратом, и окружность добавь»
   ()=>state.bitShape,
    v=>{state.bitShape=v;state.bitsOnly=v==='digits';body.querySelector('input[aria-label="Только биты 0 / 1"]').checked=state.bitsOnly;changed(true);});
  const overlapToggle=button('⋂\nперес.','Пересечения фигур ярко, остальные биты сильно темнее',()=>{state.overlapOnly=!state.overlapOnly;changed();},viewGroup);diamond(overlapToggle,'⋂\nперес.',viewGroup);overlapToggle.style.left='48px';overlapToggle.style.top='96px';viewGroup.style.setProperty('--grape-height',(Number.parseFloat(labelToggle.style.top)+48)+'px');
  compactUpdates.push(()=>{overlapToggle.classList.toggle('on',state.overlapOnly);overlapToggle.setAttribute('aria-pressed',String(state.overlapOnly));});
  const symmetryToggle=button('│\nсим.','Зеркальные оси и парные биты',()=>{state.bitSymmetry=!state.bitSymmetry;body.querySelector('input[aria-label="Зеркальные оси и парные биты"]').checked=state.bitSymmetry;changed(true);},viewGroup);diamond(symmetryToggle,'│\nсим.',viewGroup);symmetryToggle.style.left='48px';symmetryToggle.style.top='216px';
  compactUpdates.push(()=>{symmetryToggle.classList.toggle('on',state.bitSymmetry);symmetryToggle.setAttribute('aria-pressed',String(state.bitSymmetry));});
  const zenExit=button('↙','Выйти из дзена Зеркалиуса',()=>window.zenSet?.(false),stage);zenExit.id='zerkZenExit';
  const canvasRotation=splitDiamond('Поворот холста',()=>Math.round(state.viewAngle)+'°',sign=>motionStep({},()=>{state.viewAngle=(state.viewAngle+sign+360)%360;changed();}),viewGroup,{big:18,reset:()=>motionStep({},()=>{state.viewAngle=0;changed();})});canvasRotation.style.left='0px';canvasRotation.style.top='216px';viewGroup.style.setProperty('--grape-height','264px');canvasRotation.oncontextmenu=e=>{e.preventDefault();motionStep({},()=>{state.viewAngle=0;changed();});};canvasRotation.title='Поворот всего холста 0–360°; ◂ ▸ — шаг 1°, ◂◂ ▸▸ — 18°, узкий ромб посередине или правый щелчок — 0°';
  canvasRotation.tabIndex=0;canvasRotation.setAttribute('role','slider');canvasRotation.setAttribute('aria-label','Поворот холста на 360 градусов');canvasRotation.setAttribute('aria-valuemin','0');canvasRotation.setAttribute('aria-valuemax','359');compactUpdates.push(()=>canvasRotation.setAttribute('aria-valuenow',String(state.viewAngle)));
  const turnCanvas=delta=>motionStep({},()=>{state.viewAngle=(state.viewAngle+delta+360)%360;changed();},'canvas-turn');
  canvasRotation.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();turnCanvas(Math.sign(e.deltaY)*5);},{passive:false});canvasRotation.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();if(e.key==='Home'||e.key==='End')motionStep({},()=>{state.viewAngle=e.key==='Home'?0:359;changed();});else turnCanvas((e.key==='ArrowLeft'?-1:1)*(e.shiftKey?15:1));};
  state.axisRotate=false;
  const annotations=document.createElement('div');annotations.className='zerk-annotations';annotations.hidden=!state.labels;stage.append(annotations);
  const annotationNodes=Array.from({length:6},()=>{const el=document.createElement('span');el.className='zerk-annotation';annotations.append(el);return el;});
  tools.hidden=true;tools.querySelector('.pminbtn').textContent='×';tools.querySelector('.pminbtn').setAttribute('aria-label','Закрыть настройку');tools.querySelector('.pminbtn').onclick=e=>{e.stopPropagation();tools.hidden=true;};
  document.addEventListener('pointerdown',e=>{if(!tools.hidden&&!tools.contains(e.target)&&!e.target.closest('.zerk-grape'))tools.hidden=true;});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')tools.hidden=true;});
  const zoomBox=document.createElement('div');zoomBox.id='zerkZoom';stage.append(zoomBox);
  const zoomOut=button('−','Уменьшить масштаб Зеркалиуса',()=>zoomBy(1/1.15),zoomBox);zoomOut.className='zerk-zoom-minus';
  const zoomValue=document.createElement('output');zoomValue.setAttribute('aria-label','Масштаб Зеркалиуса');zoomBox.append(zoomValue);
  const zoomIn=button('+','Увеличить масштаб Зеркалиуса',()=>zoomBy(1.15),zoomBox);zoomIn.className='zerk-zoom-plus';
  zoomValue.title='Двойной щелчок — вернуть 100%';zoomValue.ondblclick=()=>motionStep({},()=>{state.zoom=1;state.pan=[0,0];changed();});
  const worldDelta=(x,y)=>{const a=-state.viewAngle*pi/180,c=Math.cos(a)/state.zoom,s=Math.sin(a)/state.zoom;return [x*c-y*s,x*s+y*c];};
  const netDigitsToggle=button('01\nцифры','Биты в ячейках развёртки: включить / выключить',()=>{state.netDigits=!state.netDigits;changed(true);},viewGroup);diamond(netDigitsToggle,'01\nцифры',viewGroup);netDigitsToggle.style.left='24px';netDigitsToggle.style.top='192px';viewGroup.style.setProperty('--grape-height','264px');compactUpdates.push(()=>{netDigitsToggle.classList.toggle('on',state.netDigits);netDigitsToggle.setAttribute('aria-pressed',String(state.netDigits));});
  // v0.1176, «сделай это в настройках»: цифры битов в зеркале — отражаются вместе с копией (как в зеркале) или всегда стоят прямо
  const mirrorDigitsToggle=button('','Цифры битов в зеркальных копиях: отражать / ставить прямо',()=>{state.digitsMirror=!state.digitsMirror;changed(true);},viewGroup);diamond(mirrorDigitsToggle,'',viewGroup);compactUpdates.push(()=>{mirrorDigitsToggle.textContent=state.digitsMirror?'Ƨ1\nзеркал.':'01\nпрямо';mirrorDigitsToggle.dataset.miIcon=state.digitsMirror?'digitsMirror':'digitsStraight';mirrorDigitsToggle.classList.toggle('on',state.digitsMirror);mirrorDigitsToggle.setAttribute('aria-pressed',String(state.digitsMirror));mirrorDigitsToggle.title=state.digitsMirror?'Цифры битов отражаются в зеркале вместе с копией — щелчок: ставить прямо':'Цифры битов всегда стоят прямо — щелчок: отражать в зеркале';});
  const symmetryEditor=editor([]);symmetryFields(symmetryEditor);const symmetrySettings=editDiamond('↕\nмин.','Минимумы симметрии',symmetryEditor,viewGroup);symmetrySettings.style.left='24px';symmetrySettings.style.top='240px';viewGroup.style.setProperty('--grape-height','288px');
  function motionRateFromStep(step){return step<=0?0:.1*Math.pow(10,(clamp(step,1,401)-1)/100);}
  function motionRateStep(rate){return rate<=0?0:clamp(1+100*Math.log10(rate/.1),1,401);}
  state.motionRate=clamp(Number.isFinite(state.motionRate)?state.motionRate:1,0,1000);state.motionDir=state.motionDir===-1?-1:1;
  const MOTION_JUMPS=[0,15,22.5,30,36,45,60,72,90,120,180];if(!MOTION_JUMPS.includes(state.motionJump))state.motionJump=0;
  const transport=document.createElement('div');transport.id='zerkMotion';transport.setAttribute('aria-label','Общий пуск включённых осей');stage.append(transport);
  const motionRange=document.createElement('input');motionRange.type='range';motionRange.dataset.zerkArrowed='1';motionRange.min=0;motionRange.max=401;motionRange.value=Math.round(motionRateStep(state.motionRate));motionRange.setAttribute('aria-label','Множитель общей скорости включённых осей');transport.append(motionRange);
  const motionPlay=button('▶','Запустить / остановить все включённые оси',()=>{const active=state.mirrors.some(m=>m.on&&(m.spin||m.path.enabled));if(active){pausedMotion=state.mirrors.map(m=>({spin:m.on&&m.spin,path:m.on&&m.path.enabled}));state.mirrors.forEach(m=>{m.spin=false;m.path.enabled=false;});}else{state.mirrors.forEach((m,i)=>{if(!m.on)return;if(pausedMotion?.[i]?.path)m.path.enabled=true;else m.spin=true;});pausedMotion=null;}previous=0;changed();},transport);
  const motionValue=document.createElement('output');motionValue.setAttribute('aria-label','Общая скорость осей');transport.append(motionValue);
  motionRange.oninput=()=>{state.motionRate=motionRateFromStep(Number(motionRange.value));changed();};
  /* v0.1161, «эту ставь везде одинаково» (по снимку пульта темпа Синхрофазотрона): общий пуск — тот же пульт: шестигранник с ◀ ▶ на концах,
     треугольники сходятся к ромбу пуска, ромб едет по скорости, подпись скорости рядом с ним. ◀ ▶ — медленнее / быстрее на 10 шагов (×1,26) */
  /* v0.1171, «можно ли её одним скриптом тянуть»: вид пульта — общий _js/zz-pult.js / zz-pult.css (образец — Синхрофазотрон), здесь только кнопки и поведение */
  const motionTrack=()=>ZerkPult.trackWidth(transport);
  const motionNudge=d=>{state.motionRate=motionRateFromStep(clamp(Math.round(motionRateStep(state.motionRate))+d,1,401));changed();};
  // v0.1180, «кнопку обратного вращения: запоминать и подсвечивать последнюю нажатую стрелку» — как в Синхрофазотроне: ◀ ▶ — направление хода, горит выбранное
  const motionDirSet=d=>{state.motionDir=d;changed();};
  const motionBack=button('◀','Обратный ход: все оси крутятся и идут по кривым назад (горит — выбрано)',()=>motionDirSet(-1),transport);
  const motionFwd=button('▶','Прямой ход: все оси крутятся и идут по кривым вперёд (горит — выбрано)',()=>motionDirSet(1),transport);
  /* v0.1183, «рядом с плеером кнопку, чтобы крутила скачками через ровные градусы»: ромб справа от пульта. Щелчок — следующий шаг
     (выкл → 15 → 22,5 → 30 → 36 → 45 → 60 → 72 → 90 → 120 → 180), правый щелчок — назад. Оси с ▶ крутятся рывками и встают на кратные шагу углы */
  const motionJump=button('↻','Скачки — оси крутятся рывками на ровный шаг и встают на кратные ему углы; щелчок — следующий шаг, правый щелчок — предыдущий',()=>{state.motionJump=MOTION_JUMPS[(MOTION_JUMPS.indexOf(state.motionJump)+1)%MOTION_JUMPS.length];changed();},transport);
  motionJump.className='zerk-jump';motionJump.oncontextmenu=e=>{e.preventDefault();state.motionJump=MOTION_JUMPS[(MOTION_JUMPS.indexOf(state.motionJump)+MOTION_JUMPS.length-1)%MOTION_JUMPS.length];changed();};
  compactUpdates.push(()=>{const t=state.motionJump?String(state.motionJump).replace('.',',')+'°':'↻';if(motionJump.textContent!==t)motionJump.textContent=t;motionJump.classList.toggle('on',!!state.motionJump);motionJump.setAttribute('aria-pressed',String(!!state.motionJump));});
  transport.classList.add('zz-pult');motionRange.classList.add('zz-pult-range');motionBack.classList.add('zz-pult-back');motionFwd.classList.add('zz-pult-fwd');motionPlay.classList.add('zz-pult-play');motionValue.classList.add('zz-pult-value');
  function motionLayout(){ZerkPult.sync(transport,motionRateStep(state.motionRate)/401);}
  new ResizeObserver(()=>motionLayout()).observe(transport);
  motionValue.ondblclick=()=>{state.motionRate=1;changed();};
  const playAction=motionPlay.onclick;motionPlay.onclick=e=>{if(performance.now()<(motionPlay._dragUntil||0))return;playAction(e);};
  motionPlay.title='Щелчок — общий пуск / пауза; перетаскивание ромба — общая скорость';
  motionPlay.addEventListener('pointerdown',e=>{if(e.button)return;e.preventDefault();e.stopPropagation();motionPlay.setPointerCapture(e.pointerId);const sx=e.clientX,step=motionRateStep(state.motionRate);let moved=false;const move=ev=>{if(ev.pointerId!==e.pointerId)return;if(Math.abs(ev.clientX-sx)>3)moved=true;if(moved){state.motionRate=motionRateFromStep(clamp(step+(ev.clientX-sx)*401/motionTrack(),0,401));motionPlay._dragUntil=performance.now()+400;changed();}};const end=ev=>{if(ev.pointerId!==e.pointerId)return;motionPlay.removeEventListener('pointermove',move);motionPlay.removeEventListener('pointerup',end);motionPlay.removeEventListener('pointercancel',end);if(motionPlay.hasPointerCapture(e.pointerId))motionPlay.releasePointerCapture(e.pointerId);};motionPlay.addEventListener('pointermove',move);motionPlay.addEventListener('pointerup',end);motionPlay.addEventListener('pointercancel',end);});
  compactUpdates.push(()=>{const active=state.mirrors.some(m=>m.on&&(m.spin||m.path.enabled));motionPlay.textContent=active?'Ⅱ':'▶';motionBack.classList.toggle('on',state.motionDir<0);motionFwd.classList.toggle('on',state.motionDir>0);motionBack.setAttribute('aria-pressed',String(state.motionDir<0));motionFwd.setAttribute('aria-pressed',String(state.motionDir>0));motionPlay.setAttribute('aria-pressed',String(active));motionLayout();motionValue.textContent=ZerkPult.label(state.motionRate);{const tip='Скорость '+motionValue.textContent+' от обычной: все оси и кривые. Двойной щелчок — ×1';if(motionValue.title!==tip)motionValue.title=tip;}motionRange.value=Math.round(motionRateStep(state.motionRate));motionRange.setAttribute('aria-valuetext',motionValue.textContent);});
  let pausedMotion=null;
  stage.addEventListener('dblclick',e=>{if(e.target.closest('#zerkTools,.zerk-grape,#zerkZoom,#zerkMotion,.zerk-turn'))return;e.preventDefault();e.stopPropagation();if(pausedMotion){pausedMotion.forEach((v,i)=>{if(!state.mirrors[i].on)return;if(v.spin)state.mirrors[i].spin=true;if(v.path)state.mirrors[i].path.enabled=true;});pausedMotion=null;}else{const running=state.mirrors.map(m=>({spin:m.on&&m.spin,path:m.on&&m.path.enabled}));if(!running.some(v=>v.spin||v.path))return;pausedMotion=running;state.mirrors.forEach(m=>{m.spin=false;m.path.enabled=false;});}previous=0;controls.forEach((c,i)=>{c.spin.textContent=state.mirrors[i].spin?'Ⅱ':'▶';c.spin.setAttribute('aria-pressed',String(state.mirrors[i].spin));});changed();});
  const viewMatrix=()=>{const a=state.viewAngle*pi/180,c=Math.cos(a)*state.zoom,s=Math.sin(a)*state.zoom;return [c,s,-s,c,drawW*(.5+state.pan[0])-c*drawW/2+s*drawH/2,drawH*(.5+state.pan[1])-s*drawW/2-c*drawH/2];};
  const viewPoint=(x,y)=>sceneMath.point(viewMatrix(),x*drawW,y*drawH);
  const worldPoint=(x,y)=>{const p=worldDelta(x-drawW*(.5+state.pan[0]),y-drawH*(.5+state.pan[1]));return [p[0]+drawW/2,p[1]+drawH/2];};
  // Пунктирный крест и вращение за ось — из coneBalanceAxesPaint/Bind Синхрофазотрона.
  function fieldAxisTargets(){const f=state.fieldAxes;return f.on?[0,pi/2].map(a=>({x:f.x,y:f.y,angle:f.angle+a})):[];}
  const fieldAxesToggle=button('✛\nполе','Оси поля как в Синхрофазотроне: показать / скрыть',()=>{state.fieldAxes.on=!state.fieldAxes.on;changed();},viewGroup);
  diamond(fieldAxesToggle,'✛\nполе',viewGroup);fieldAxesToggle.style.left='48px';fieldAxesToggle.style.top='264px';viewGroup.style.setProperty('--grape-height','312px');
  const oldAngles=button('↺\nстарые','Старые углы: ромбы 0° / 60°, зеркало 1 — 45°; ↩ отменяет',()=>motionStep({batch:[{bitAngles:true},{mirror:0}]},()=>{
    setBitAngles({zero:0,one:60});const m=state.mirrors[0];stopPath(m);m.spin=false;m.angle=pi/4;m.gripAngle=m.angle;
    changed(true);notify('Старые углы: 0 = 0°, 1 = 60°, зеркало 1 = 45°. Угол можно менять вручную.');
  }),viewGroup);oldAngles.id='zerkOldAngles';diamond(oldAngles,'↺\nстарые',viewGroup);oldAngles.style.left='0px';oldAngles.style.top='264px';viewGroup.style.setProperty('--grape-height','312px');
  /* «дзен — отдельная кнопка, как везде» (◎ в шапке страницы), «расформируй в 2 группы, там всё намешано»: «Вид» — зеркала (наклоны, цвета, сброс, циклы, магнит, старые углы),
     «Холст» — что и как рисуется на холсте; ромбы каждой группы — обычной лесенкой по порядку */
  const canvasGroup=grape('zerkCanvasG','Холст','#ff8fc8',()=>stage.clientWidth>600?[160,248]:[stage.clientWidth-248,8]);canvasGroup.parentElement.classList.add('zerk-view-group');
  const restack=(g,items)=>{items.forEach((n,k)=>{g.append(n);n.style.left='0px';n.style.top=(k*24)+'px';});zerkStack(g);};
  restack(canvasGroup,[labelToggle,bitsToggle,netDigitsToggle,mirrorDigitsToggle,overlapToggle,symmetryToggle,symmetrySettings,fieldAxesToggle,canvasRotation]);
  restack(viewGroup,[...viewGroup.children]);
  compactUpdates.push(()=>{fieldAxesToggle.classList.toggle('on',state.fieldAxes.on);fieldAxesToggle.setAttribute('aria-pressed',String(state.fieldAxes.on));});
  const fieldAxisNodes=[0,1].map(i=>{const node=document.createElement('span');node.className='zerk-axis zerk-field-axis';node.tabIndex=0;node.setAttribute('role','button');node.setAttribute('aria-label',i?'Вертикальная ось поля':'Горизонтальная ось поля');node.title='Левая протяжка — повернуть крест; правая — перенести центр. Магнит к битам и осям зеркал; Alt — без магнита; двойной щелчок — начальные оси';layer.prepend(node);
    node.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();};node.ondblclick=e=>{e.preventDefault();e.stopPropagation();motionStep({fieldAxes:true},()=>{Object.assign(state.fieldAxes,{x:.5,y:.5,angle:0});changed();});};
    node.addEventListener('pointerdown',e=>{if(![0,2].includes(e.button))return;e.preventDefault();e.stopPropagation();const before=motionSnap({fieldAxes:true}),f=state.fieldAxes,sx=e.clientX,sy=e.clientY,p=viewPoint(f.x,f.y),r=stage.getBoundingClientRect(),cx=r.left+p[0],cy=r.top+p[1],start=Math.atan2(sy-cy,sx-cx),targets=magnetBits();let moved=false;node.setPointerCapture(e.pointerId);
      const move=ev=>{if(ev.pointerId!==e.pointerId)return;if(!moved&&Math.hypot(ev.clientX-sx,ev.clientY-sy)<3)return;moved=true;snapHint='';const b=before.fieldAxes;
        if(e.button===2){const [dx,dy]=worldDelta(ev.clientX-sx,ev.clientY-sy);let p=[b.x*drawW+dx,b.y*drawH+dy];if(state.magnet&&!ev.altKey){const result=magneticPosition(...p,state.mirrors.filter(m=>m.on),state.zoom,targets,null,false);p=[result.x/state.zoom,result.y/state.zoom];snapHint=result.snapped?result.label:'';}f.x=p[0]/drawW;f.y=p[1]/drawH;}
        else{const a=norm(b.angle+Math.atan2(ev.clientY-cy,ev.clientX-cx)-start),result=state.magnet&&!ev.altKey?sceneMath.snapAngle(a,state.mirrors.filter(m=>m.on)):{angle:a};f.angle=result.angle;snapHint=result.snapped?result.label:'';}changed();};
      const end=ev=>{if(ev.pointerId!==e.pointerId)return;node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',end);if(node.hasPointerCapture(e.pointerId))node.releasePointerCapture(e.pointerId);if(ev.type==='pointercancel')Object.assign(f,before.fieldAxes);else if(moved)pushMotion(before);snapHint='';changed();};
      node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);
    });return node;});
  function paintFieldAxes(ctx,camera){const f=state.fieldAxes;if(!f.on)return;ctx.save();ctx.setTransform(...camera);ctx.strokeStyle='#8a94a6';ctx.lineWidth=1/(state.zoom||1);ctx.globalAlpha=.7;ctx.setLineDash([6/state.zoom,4/state.zoom]);const radius=Math.hypot(drawW,drawH)*4/state.zoom;
    for(const a of [f.angle,f.angle+pi/2]){const x=f.x*drawW,y=f.y*drawH,dx=Math.cos(a)*radius,dy=Math.sin(a)*radius;ctx.beginPath();ctx.moveTo(x-dx,y-dy);ctx.lineTo(x+dx,y+dy);ctx.stroke();}ctx.restore();}
  function zoomBy(factor,x=drawW/2,y=drawH/2,group=false){if(!drawW||!drawH)return;const history=motionSnap({}),before=state.zoom,next=clamp(before*factor,ZOOM_MIN,ZOOM_MAX),ratio=next/before;
    state.pan=[(x-drawW/2-(x-drawW/2-state.pan[0]*drawW)*ratio)/drawW,(y-drawH/2-(y-drawH/2-state.pan[1]*drawH)*ratio)/drawH];state.zoom=next;changed();pushMotion(history,group?'zoom':null);}
  stage.addEventListener('wheel',e=>{if(e.target.closest('#zerkTools,.zerk-grape,#zerkZoom,#zerkMotion')||!e.deltaY)return;e.preventDefault();e.stopPropagation();const r=stage.getBoundingClientRect(),delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?drawH:1);zoomBy(Math.exp(-clamp(delta,-120,120)*.0015),e.clientX-r.left,e.clientY-r.top,true);},{passive:false});
  /* v0.1140, «пусть ось не прицепляется к битам своего зеркальных битов, только к чужим и строчным»: квадратики и линия зеркала own магнитятся к битам
     строк и к отражениям, в которых это зеркало не участвует (чужие зеркала); свои отражения едут вместе с осью — к ним не липнет. Без own (оси поля) —
     только биты строк, как прежде. */
  function magnetBits(own=-1){const data=scene(),points=data.labels.map(v=>v.point),skip=own<0?~0:1<<own;for(const item of data.items)if(!(item.mask&skip))for(const p of item.src.points||[])points.push(sceneMath.point(item.matrix,...p));return points;}
  function nearestBit(x,y,points,radius){let best=null;for(const p of points){const d=Math.hypot(x-p[0],y-p[1]);if(d<radius){radius=d;best=p;}}return best;}
  /* v0.1142: сетка битов набора в его собственных координатах — узел и два шага. Строки лежат треугольником (шаг dw вдоль строки, (dw/2, dw·√3/2) к следующей),
     если чётность длин строк это позволяет; иначе — общая сетка полушагов. */
  function rowsLattice(R,dw){
    const dh=dw*Math.sqrt(3),r0=R.findIndex(row=>row.length);if(r0<0)return null;
    const L0=R[r0].length,tri=R.every((row,r)=>!row.length||((row.length-L0+r-r0)%2+2)%2===0);
    return {o:[-(L0-1)*dw/2,r0*dh/2],e1:tri?[dw,0]:[dw/2,0],e2:tri?[dw/2,dh/2]:[0,dh/2]};
  }
  /* v0.1142: сдвиг t вдоль оси u подбирается так, чтобы узел отражённой сетки p + t·u лёг в узел неподвижной сетки b (o, e1, e2): ближайший к t0 в пределах
     radius, промах поперёк — не больше eps. Нет такого — null: ось не по направлению сетки или стоит между её рядами. */
  function glideSnap(pairs,u,t0,radius,eps){
    let best=null;
    for(const {p,b} of pairs){
      const det=b.e1[0]*b.e2[1]-b.e1[1]*b.e2[0];if(Math.abs(det)<1e-12)continue;
      const inv=v=>[(v[0]*b.e2[1]-v[1]*b.e2[0])/det,(b.e1[0]*v[1]-b.e1[1]*v[0])/det];
      const c=inv([p[0]+t0*u[0]-b.o[0],p[1]+t0*u[1]-b.o[1]]),w=inv(u),k=Math.abs(w[0])>=Math.abs(w[1])?0:1,o=1-k;
      if(Math.abs(w[k])<1e-12)continue;
      const span=Math.abs(w[k])*radius;
      for(let n=Math.ceil(c[k]-span);n<=Math.floor(c[k]+span);n++){
        const dt=(n-c[k])/w[k];if(Math.abs(dt)>radius||(best!==null&&Math.abs(dt)>=Math.abs(best)))continue;
        const rest=c[o]+dt*w[o];if(Math.abs(rest-Math.round(rest))*Math.hypot(...(o?b.e2:b.e1))<=eps)best=dt;
      }
    }
    return best===null?null:t0+best;
  }
  /* v0.1142: пары для glideSnap — узел сетки каждой прямой копии зеркала own и сетки всего, что при его протяжке стоит на месте (строки, чужие зеркала), того же набора. */
  function glideLattice(own){
    const data=scene(),bit=1<<own,pairs=[];
    const lat=item=>{const L=item.src.lattice,M=item.matrix;if(!L)return null;const lin=v=>[M[0]*v[0]+M[2]*v[1],M[1]*v[0]+M[3]*v[1]];return {o:sceneMath.point(M,...L.o),e1:lin(L.e1),e2:lin(L.e2)};};
    const still=data.items.filter(item=>!(item.mask&bit)).map(item=>({item,l:lat(item)})).filter(v=>v.l);
    for(const item of data.items)if(item.mask===bit){const l=lat(item);if(l)for(const v of still)if(v.item.source===item.source)pairs.push({p:l.o,b:v.l});}
    return pairs;
  }
  function magneticPosition(x,y,others,z,targets,along=null,includeField=true){
    if(includeField)others=others.concat(fieldAxisTargets());
    const permitted=p=>!along||Math.abs((p[0]-along.x)*Math.sin(along.angle)-(p[1]-along.y)*Math.cos(along.angle))<1e-6;
    let result=sceneMath.snapPosition(x*z,y*z,others.map(m=>({x:m.x*drawW*z,y:m.y*drawH*z,angle:m.angle})),drawW*z,drawH*z,10,[.01*drawW*z,.01*drawH*z,.99*drawW*z,.99*drawH*z],[drawW*z/2,drawH*z/2]);
    if(!permitted([result.x/z,result.y/z]))result={x:x*z,y:y*z,snapped:false,label:''};
    const bit=nearestBit(x,y,along?targets.filter(permitted):targets,10/z);
    if(bit&&(!result.snapped||Math.hypot(bit[0]-x,bit[1]-y)<Math.hypot(result.x/z-x,result.y/z-y)-1e-9))result={x:bit[0]*z,y:bit[1]*z,snapped:true,label:'центр бита'};
    return result;
  }
  function pickFigures(x,y){
    const mirrors=new Set(),sources=new Set();
    for(const item of scene().items){const [a,b,c,d,e,f]=item.matrix,det=a*d-b*c;if(Math.abs(det)<1e-12)continue;const px=(d*(x-e)-c*(y-f))/det,py=(-b*(x-e)+a*(y-f))/det,B=item.bounds,img=item.src.image;
      if(px<B[0]||px>=B[2]||py<B[1]||py>=B[3])continue;const ix=Math.floor((px-B[0])/(B[2]-B[0])*img.width),iy=Math.floor((py-B[1])/(B[3]-B[1])*img.height);
      if(img.getContext('2d').getImageData(ix,iy,1,1).data[3]<3)continue;
      if(item.mask)for(let j=0;j<3;j++){if(item.mask&(1<<j))mirrors.add(j);}else sources.add(item.source);
    }return {mirrors:[...mirrors],sources:[...sources]};
  }
  function beginStageDrag(e,requireHit=false){
    if(![0,1].includes(e.button)||e.target.closest('button,input,select,textarea,.zerk-grape .smh,.zerk-diamond,#zerkTools,#zerkZoom,#zerkMotion'))return false;
    const r=stage.getBoundingClientRect(),point=worldPoint(e.clientX-r.left,e.clientY-r.top),pick=e.button===0?pickFigures(...point):{mirrors:[],sources:[]},picked=pick.mirrors.length+pick.sources.length>0;
    if(requireHit&&!picked)return false;if(!requireHit&&e.button===0&&e.target.closest('.zerk-axis'))return false;
    e.preventDefault();e.stopPropagation();stage.classList.add('panning');stage.setPointerCapture(e.pointerId);
    const selectors=[...pick.mirrors.map(mirror=>({mirror})),...pick.sources.map(source=>({source}))],before=motionSnap(picked?{batch:selectors}:{}),sx=e.clientX,sy=e.clientY,start=state.pan.slice(),starts=selectors.map(motionSnap);let moved=false;
    const move=ev=>{if(ev.pointerId!==e.pointerId)return;if(Math.hypot(ev.clientX-sx,ev.clientY-sy)>4)moved=true;if(!moved)return;
      if(picked){const [dx,dy]=worldDelta(ev.clientX-sx,ev.clientY-sy);for(const step of starts){if(step.source!==undefined){state.sourceOffsets[step.source]=[step.offset[0]+dx/drawW,step.offset[1]+dy/drawH];continue;}const m=state.mirrors[step.mirror],v=step.values;stopPath(m);m.spin=false;controls[step.mirror].spin.textContent='▶';controls[step.mirror].spin.setAttribute('aria-pressed','false');m.x=v.x+dx/drawW;m.y=v.y+dy/drawH;}}
      else state.pan=[start[0]+(ev.clientX-sx)/drawW,start[1]+(ev.clientY-sy)/drawH];changed();
    };
    const end=ev=>{if(ev.pointerId!==e.pointerId)return;stage.removeEventListener('pointermove',move);stage.removeEventListener('pointerup',end);stage.removeEventListener('pointercancel',end);if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);stage.classList.remove('panning');if(moved)pushMotion(before);if(e.button===1&&!moved&&ev.type==='pointerup')window.zenSet?.(!document.body.classList.contains('zerk-zen'),'w-zerkalius');};
    stage.addEventListener('pointermove',move);stage.addEventListener('pointerup',end);stage.addEventListener('pointercancel',end);return true;
  }
  stage.addEventListener('pointerdown',e=>beginStageDrag(e));
  stage.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault();});
  stage.addEventListener('mousedown',e=>{if(e.button===1)e.preventDefault();});
  window.zzZerkaliusKey=e=>{if(e.ctrlKey||e.altKey||e.metaKey||e.target.closest('input,textarea,select,button'))return false;const step=40*(e.shiftKey?4:1),delta={ArrowLeft:[step,0],ArrowRight:[-step,0],ArrowUp:[0,step],ArrowDown:[0,-step]}[e.key],factor={'+':1.2,'=':1.2,'-':1/1.2,'_':1/1.2}[e.key];if(!delta&&!factor)return false;e.preventDefault();if(delta)motionStep({},()=>{state.pan=[state.pan[0]+delta[0]/drawW,state.pan[1]+delta[1]/drawH];changed();});else zoomBy(factor);return true;};
  function field(parent,title,type,value,choices){
    const label=document.createElement('label'),input=document.createElement(choices?'select':'input');label.append(document.createTextNode(title));
    if(choices)for(const [v,t] of choices){const o=document.createElement('option');o.value=v;o.textContent=t;input.append(o);}else input.type=type;
    input.value=value;if(type==='checkbox')input.checked=!!value;input.setAttribute('aria-label',title);label.append(input);parent.append(label);return input;
  }
  function numberField(parent,title,value,min,max,step=1){const el=field(parent,title,'number',value);Object.assign(el,{min,max,step});return el;}
  function textBlock(parent,text){const el=document.createElement('p');el.className='zerk-help';el.textContent=text;parent.append(el);return el;}

  function buildPendulumEditor(parent){
    const el=editor([]);el.id='zerkPendulumEditor';
    textBlock(el,'Зеркальный маятник: 0, −1, +1, −2, +2… Каждая вершина меняет исходный кадр; три зеркала отражают один и тот же кадр. Пустые клетки прозрачны.');
    const depth=numberField(el,'Строк маятника',pendSettings.depth,8,1024),limit=numberField(el,'Вершин маятника',pendSettings.limit,1,4096);
    depth.id='zerkPendDepth';limit.id='zerkPendLimit';
    const rate=numberField(el,'Кадров в секунду',pendSettings.speed||8,1,30);rate.onchange=()=>{pendSettings.speed=clamp(Number(rate.value)||8,1,30);rate.value=pendSettings.speed;persist();};
    const colored=field(el,'Цвета перекрытий','checkbox',pendSettings.colored!==false);colored.onchange=()=>{pendSettings.colored=colored.checked;changed(true);};
    const timeline=field(el,'Кадр маятника','range',pendSettings.frame);timeline.id='zerkPendFrame';timeline.min=0;timeline.max=pendSettings.limit;timeline.step=1;timeline.dataset.noSlider='true';
    const exact=numberField(el,'Номер кадра',pendSettings.frame,0,pendSettings.limit);exact.id='zerkPendNumber';
    const info=document.createElement('output');info.id='zerkPendInfo';info.className='zerk-help';el.append(info);
    function activate(){state.source=source.value='pend';state.build='axes';own.hidden=true;pendEngine();changed(true);}
    function seek(n){activate();pendPlaying=false;pendTarget=clamp(n,0,pendulum.limit);pendClock=0;request();}
    const apply=button('Построить заново','Начать маятник с новыми строками и числом вершин',()=>{
      pendPlaying=false;pendClock=0;pendulum=new ZZMirrorPendulum(depth.value,limit.value);Object.assign(pendSettings,{depth:pendulum.depth,limit:pendulum.limit,frame:0});depth.value=pendulum.depth;limit.value=pendulum.limit;timeline.max=pendulum.limit;pendTarget=1;activate();
    },el);apply.id='zerkPendApply';
    timeline.oninput=()=>seek(Number(timeline.value));exact.oninput=()=>seek(Number(exact.value));
    const group=grape('zerkPendG','Маятник','#4f9bff',()=>[24,Math.max(120,stage.clientHeight-220)]);
    let trigger;trigger=button('↔\nмаят.','Зеркальный маятник · выбрать узор и открыть настройки',()=>{activate();openEditor(el,'Зеркальный маятник',trigger);},parent);trigger.id='zerkPendOpen';trigger.remove();   // v0.1158, «так же»: «↔ маят.» из «Строк» убран — маятник открывает «↔ кадр» в своей группе, узор «Зеркальный маятник» — в «≡ поле»
    const settings=editDiamond('↔\nкадр','Зеркальный маятник',el,group);
    const play=button('▶','Запустить / остановить маятник',()=>{activate();if(pendulum.frame===pendulum.limit)pendTarget=0;pendPlaying=!pendPlaying;play.textContent=pendPlaying?'Ⅱ':'▶';play.setAttribute('aria-pressed',String(pendPlaying));pendClock=0;request();},group);play.id='zerkPendPlay';play.className='zerk-auto';diamond(play,'▶',group);
    const back=button('◂','Предыдущий кадр маятника',()=>seek((pendTarget??pendEngine().frame)-1),group);back.id='zerkPendBack';diamond(back,'◂',group);
    const next=button('▸','Следующий кадр маятника',()=>seek((pendTarget??pendEngine().frame)+1),group);next.id='zerkPendNext';diamond(next,'▸',group);
    const reset=button('⟲','Вернуть маятник к первой вершине',()=>seek(1),group);reset.id='zerkPendReset';diamond(reset,'⟲',group);
    compactUpdates.push(()=>{
      const active=state.source==='pend';group.parentElement.hidden=!active;trigger.setAttribute('aria-pressed',String(active));
      if(!active)return;const engine=pendEngine(),b=engine.balance();timeline.max=engine.limit;timeline.value=pendTarget??engine.frame;exact.max=engine.limit;exact.value=pendTarget??engine.frame;
      const c=engine.frame?MAYATNIK.offset('pend',engine.frame-1):null;
      settings.textContent='↔\n'+engine.frame;play.textContent=pendPlaying?'Ⅱ':'▶';play.setAttribute('aria-pressed',String(pendPlaying));back.disabled=engine.frame===0&&pendTarget===null;next.disabled=engine.frame===engine.limit&&pendTarget===null;
      info.textContent='Кадр '+engine.frame+' / '+engine.limit+' · вершина '+(c===null?'нет':c>0?'+'+c:c)+' · 0: '+b.zero.toLocaleString('ru-RU')+' · 1: '+b.one.toLocaleString('ru-RU')+' · 1: '+(b.one+b.zero?(100*b.one/(b.one+b.zero)).toFixed(2):'0')+'% (исходный кадр; пустые исключены)';
    });
    if(state.source==='pend'){pendEngine();state.build='axes';}
  }
  function advancePendulum(now){
    if(state.source!=='pend')return false;const engine=pendEngine(),before=engine.revision;
    if(pendTarget!==null){if(engine.seek(pendTarget,12))pendTarget=null;pendClock=now;}
    else if(pendPlaying&&(!pendClock||now-pendClock>=1000/(pendSettings.speed||8))){engine.step();pendClock=now;if(engine.frame===engine.limit)pendPlaying=false;}
    if(engine.revision!==before){pendSettings.frame=engine.frame;dirty=true;notice='';persist();}
    return pendPlaying||pendTarget!==null;
  }

  function symmetryFields(parent){
    for(const [key,title] of [['minRows','Минимум строк симметрии'],['minPairs','Минимум пар зеркальных битов']]){
      const input=field(parent,title,'number',state.symmetryMinimums[key]);input.min='1';input.step='1';input.inputMode='numeric';input.dataset.symmetryMinimum=key;
      if(key==='minPairs')input.title='Одна пара включает простые совпадения 00 и 11';
      input.onchange=()=>{if(Number.isFinite(input.valueAsNumber))state.symmetryMinimums[key]=Math.max(1,Math.round(input.valueAsNumber));body.querySelectorAll('input[data-symmetry-minimum]').forEach(el=>el.value=state.symmetryMinimums[el.dataset.symmetryMinimum]);changed(true);};
    }
  }
  function buildSceneEditor(parent){
    const el=editor([]),build=field(el,'Построение','',state.build,[['axes','Оси и треугольники'],['net','Развёртка']]);
    button('Грозди на места','Вернуть группы кнопок в исходную раскладку',resetGroups,el);
    const bitsOnly=field(el,'Только биты 0 / 1','checkbox',state.bitsOnly);bitsOnly.onchange=()=>{state.bitsOnly=bitsOnly.checked;state.bitShape=state.bitsOnly?'digits':'diamond01';changed(true);};
    const symmetry=field(el,'Зеркальные оси и парные биты','checkbox',state.bitSymmetry);symmetry.onchange=()=>{state.bitSymmetry=symmetry.checked;changed(true);};
    symmetryFields(el);
    const font=field(el,'Шрифт битов','',state.font,fonts);font.onchange=()=>{state.font=font.value;changed(true);document.fonts.load('12px '+state.font).then(()=>changed(true));};
    const bitColor=field(el,'Цвет исходных битов','color',state.bitColor);bitColor.oninput=()=>{state.bitColor=bitColor.value;state.palette='custom';changed(true);};
    const palette=field(el,'Цветовая заготовка','',state.palette||'custom',[['custom','Свои цвета'],['classic','Бирюза / золото / коралл'],['ice','Лёд / синий / сиреневый'],['fire','Пламя / оранжевый / фиолетовый'],['forest','Зелень / лайм / янтарь'],['mono','Светлые / серые']]);compactUpdates.push(()=>palette.value=state.palette||'custom');
    const palettes={classic:['#70e0d7','#ffd166','#ff735c','#9fffc8','#4dd4ff','#e8b64a'],ice:['#a1e9ff','#5da8ff','#bbadff','#e0f6ff','#a1e9ff','#5da8ff'],fire:['#ff6565','#ffae52','#d589ff','#ffcfaa','#ff6565','#ffae52'],forest:['#6be3a4','#b6de6b','#e8bd68','#caffac','#6be3a4','#e8bd68'],mono:['#eeeeee','#aaaaaa','#777777','#ffffff','#eeeeee','#aaaaaa']};
    const axes=document.createElement('div');el.append(axes);
    const layout=field(axes,'Начальные оси','',state.layout,[['single','Один треугольник'],['quad','Квадро · 2 оси / 90°'],['tri','Три · 3 оси / 60°']]);
    const mult=field(axes,'Кратность наборов','',state.mult,[[1,'1 копия'],[2,'2 копии / 180°'],[3,'3 копии / 120°']]);
    textBlock(axes,'Каждый набор растёт от общего центра вдоль своей оси. Общий набор берётся из ромба «узор». Кратность добавляет повёрнутые копии вокруг центра.');
    const sections=[];
    state.sets.forEach((set,i)=>{
      const part=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='Набор '+(i+1);part.append(legend);axes.append(part);sections.push(part);
      const src=field(part,'Источник набора '+(i+1),'',set.source,[['shared','Общий узор'],['field','Строки поля'],['own','Свои строки'],['serp','Серпинский']]);
      const color=field(part,'Цвет набора '+(i+1),'color',set.color);color.oninput=()=>{set.color=color.value;state.palette='custom';changed(true);};
      const box=document.createElement('div');box.className='zerk-own-set';part.append(box);const area=document.createElement('textarea');area.value=set.rows.join('\n');area.setAttribute('aria-label','Свои строки набора '+(i+1));box.append(area);
      const file=document.createElement('input');file.type='file';file.accept='.txt,.json,text/plain,application/json';file.hidden=true;box.append(file);
      const apply=raw=>{try{const next=parseRows(raw);set.rows=next;set.source='own';src.value='own';area.value=next.join('\n');box.hidden=false;changed(true);notify('Набор '+(i+1)+': '+next.length+' строк');plateZig(tools,'#70e0d7');}catch(e){notify(e.message);}};
      button('Применить','Применить строки набора '+(i+1),()=>apply(area.value),box);
      button('TXT / JSON','Загрузить файл набора '+(i+1),()=>file.click(),box);
      button('Из поля','Скопировать строки поля в набор '+(i+1),()=>apply(Z.rows.join('\n')),part);
      button('В поле','Перенести набор '+(i+1)+' в поле',()=>{if(rowsLocked())return;const next=setRows(i).slice();snapshot();Z.rows=next;Z.cur=0;rowSel.clear();syncLane();rowsOrigSet();renderAll();save();say('Набор '+(i+1)+' перенесён в поле. ↩ вернёт.');},part);
      file.onchange=async()=>{if(!file.files[0])return;try{apply(await file.files[0].text());}catch(e){notify(e.message);}file.value='';};
      const show=()=>{box.hidden=set.source!=='own';};src.onchange=()=>{set.source=src.value;show();changed(true);plateZig(tools,'#70e0d7');};show();
    });
    const update=()=>{const n=state.layout==='quad'?2:state.layout==='tri'?3:0;sections.forEach((node,i)=>node.hidden=i>=n);mult.disabled=!n;plateZig(tools,'#70e0d7');};
    layout.onchange=()=>{state.layout=layout.value;update();changed(true);};mult.onchange=()=>{state.mult=Number(mult.value);changed(true);};update();
    button('Зеркала по осям','Выставить зеркала по выбранным начальным осям',()=>{const count=state.layout==='quad'?2:3,cx=drawW>650?(250+(drawW-250)/2)/drawW:.5;
      state.mirrors.forEach((m,i)=>{stopPath(m);m.spin=false;m.x=cx;m.y=.52;m.angle=state.layout==='quad'?norm(i*pi/2):i*pi/3;m.on=i<count;m.magnetPins=[false,false];m.figureOffset=[0,0];m.copyOffsets=Array.from({length:8},()=>[0,0]);m.turnGrip=null;controls[i].on.checked=m.on;});changed();},axes);
    const net=document.createElement('div');net.className='zerk-net-editor';el.append(net);
    const nb=field(net,'Тело развёртки','',state.net.nb,[[3,'△ Бирамида · 6 граней'],[4,'◇ Октаэдр · 8 граней']]),thumbs=document.createElement('div');thumbs.className='zerk-net-presets';net.append(thumbs);
    const previews=[];for(let i=0;i<6;i++){const b=button('','Развёртка '+String.fromCharCode(1040+i),()=>{state.net.preset=i;refresh();changed(true);},thumbs),cv=document.createElement('canvas');cv.width=56;cv.height=48;b.append(cv);previews.push({b,cv});}
    const refresh=()=>{for(const [i,p] of previews.entries()){p.b.classList.toggle('on',state.net.preset===i);p.b.setAttribute('aria-pressed',String(state.net.preset===i));p.b.title=(state.net.nb===4?RAZV_NAME:RAZV_NAME3)[i];netPreview(p.cv,i);}};
    nb.onchange=()=>{state.net.nb=Number(nb.value);refresh();changed(true);};
    for(const [key,caption] of [['up','Цвет верхних граней'],['down','Цвет нижних граней']]){const color=field(net,caption,'color',state.net[key]);color.oninput=()=>{state.net[key]=color.value;state.palette='custom';refresh();changed(true);};}
    palette.onchange=()=>{state.palette=palette.value;const p=palettes[palette.value];if(!p){persist();return;}state.mirrors.forEach((m,i)=>{m.color=p[i];controls[i].color.value=m.color;});state.sets.forEach((s,i)=>s.color=p[i]);state.bitColor=p[3];bitColor.value=p[3];state.net.up=p[4];state.net.down=p[5];net.querySelectorAll('input[type=color]').forEach((n,i)=>n.value=p[4+i]);axes.querySelectorAll('input[type=color]').forEach((n,i)=>n.value=p[i]);refresh();changed(true);};
    const labels=field(net,'Подписи граней','checkbox',state.net.labels);labels.onchange=()=>{state.net.labels=labels.checked;changed(true);};
    textBlock(net,'Строки — из ромба «узор», до 160 рядов. Верх — исходные биты, низ — инверсия. Три зеркала отражают всю развёртку.');
    const copy=field(net,'В Бирамиду','',state.net.copy,Array.from({length:8},(_,mask)=>[mask,mask?'Отражение '+[1,2,3].filter(i=>mask&(1<<(i-1))).join(' + '):'Исходная развёртка']));copy.onchange=()=>{state.net.copy=Number(copy.value);persist();};
    button('◆ В Бирамиду','Перенести выбранную развёртку в Бирамиду',()=>transferNet(),net);
    textBlock(net,'Переносит биты и цвета U/D на 6 или 8 граней. Строки поля остаются прежними. «⇄ строки → грани» в Бирамиде вернёт связь с полем.');
    const show=()=>{axes.hidden=state.build==='net';net.hidden=state.build!=='net';refresh();plateZig(tools,'#70e0d7');placeTools(tools);};build.onchange=()=>{if(state.source==='pend'&&build.value==='net'){build.value='axes';notify('Маятник сохраняет полную решётку с пустыми клетками; здесь используйте зеркала и оси.');return;}state.build=build.value;show();changed(true);};show();
    const b=editDiamond('✣\nоси','Холст · оси, строки и развёртки',el,parent);compactUpdates.push(()=>b.textContent=state.build==='net'?'✦\n'+(state.net.preset+1):state.layout==='single'?'✣\nоси':(state.layout==='quad'?'2 · 90°':'3 · 60°')+'\n×'+state.mult);
  }
  function buildPngEditor(trigger){
    const el=editor([]),out=state.png;
    const frame=field(el,'Кадр PNG','',out.frame,[['scene','Всё построение'],['view','Видимый холст']]);
    const width=numberField(el,'Ширина PNG',out.width,64,8192),height=numberField(el,'Высота PNG',out.height,64,8192);
    const preset=field(el,'Размер PNG','',String(out.width),[['1024','1024 × 1024'],['2048','2048 × 2048'],['4096','4096 × 4096'],['custom','Свой размер']]);if(out.width!==out.height||![1024,2048,4096].includes(out.width))preset.value='custom';
    const clear=field(el,'Прозрачный фон PNG','checkbox','');clear.checked=out.transparent;
    const saveSettings=()=>{out.frame=frame.value;out.transparent=clear.checked;out.width=clamp(Math.round(Number(width.value)||2048),64,8192);out.height=clamp(Math.round(Number(height.value)||2048),64,8192);width.value=out.width;height.value=out.height;persist();};
    frame.onchange=clear.onchange=saveSettings;width.onchange=height.onchange=()=>{preset.value='custom';saveSettings();};
    preset.onchange=()=>{if(preset.value!=='custom'){width.value=height.value=preset.value;saveSettings();}};
    button('Пропорции холста','Установить пропорции видимого холста для PNG',()=>{height.value=Math.round(Number(width.value)*drawH/Math.max(1,drawW));preset.value='custom';saveSettings();},el);
    textBlock(el,'«Всё построение» включает отражения за краями экрана. Масштаб экрана не влияет на этот кадр. Направляющие и кнопки в PNG не попадают.');
    const download=button('Скачать PNG','Скачать PNG с заданными параметрами',()=>{
      saveSettings();if(out.width*out.height>32000000){notify('Максимум 32 миллиона пикселей. Уменьшите ширину или высоту.');return;}
      render();download.disabled=true;
      try{const initial=scene(),b=initial.bounds,pad=20,scale=out.frame==='scene'?Math.min((out.width-2*pad)/Math.max(1,b[2]-b[0]),(out.height-2*pad)/Math.max(1,b[3]-b[1])):out.width/drawW*state.zoom;
        let camera;if(out.frame==='scene'){const a=state.viewAngle*pi/180,c=Math.cos(a),s=Math.sin(a),rotation=[c,s,-s,c,0,0],corners=[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]].map(p=>sceneMath.point(rotation,...p)),xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]),box=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],k=Math.min((out.width-2*pad)/Math.max(1,box[2]-box[0]),(out.height-2*pad)/Math.max(1,box[3]-box[1]));camera=sceneMath.multiply([k,0,0,k,(out.width-(box[2]-box[0])*k)/2-box[0]*k,(out.height-(box[3]-box[1])*k)/2-box[1]*k],rotation);}
        else camera=sceneMath.multiply([out.width/drawW,0,0,out.height/drawH,0,0],viewMatrix());
        const output=document.createElement('canvas');output.width=out.width;output.height=out.height;const ctx=output.getContext('2d');if(!out.transparent){ctx.fillStyle='#050806';ctx.fillRect(0,0,output.width,output.height);}paint(ctx,scene(Math.max(dpr,Math.min(8,scale))),camera);
        output.toBlob(blob=>{download.disabled=false;sourceCache.clear();if(!blob){notify('Не удалось создать PNG');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='zerkalius-'+out.width+'x'+out.height+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('PNG: '+out.width+' × '+out.height+' · '+(out.transparent?'прозрачный фон':'тёмный фон'));},'image/png');
      }catch(e){download.disabled=false;sourceCache.clear();notify('PNG: '+e.message);}
    },el);
    trigger.title='Настроить выходной PNG';trigger.setAttribute('aria-label','Настроить выходной PNG');trigger.onclick=()=>openEditor(el,'Выходной PNG',trigger);
  }
  function buildPathEditor(m,i,parent){
    const el=editor([]),p=m.path,label=' зеркала '+(i+1),kind=field(el,'Кривая'+label,'',p.kind,[['circle','Круг'],['ellipse','Эллипс'],['eight','Восьмёрка'],['line','Маятник'],['custom','Своя формула']]);
    const period=numberField(el,'Период'+label+' в секундах',p.period,.25,3600,.25),phase=numberField(el,'Фаза'+label+' в градусах',p.phase,0,360);
    const ax=numberField(el,'Размах X'+label+' в процентах',p.ampX*100,0,45,.5),ay=numberField(el,'Размах Y'+label+' в процентах',p.ampY*100,0,45,.5);
    const orient=field(el,'Поворот на кривой'+label,'',p.orient,[['fixed','Сохранить угол'],['swing','Качать угол'],['turn','Полный оборот за цикл'],['custom','Угол по формуле']]);
    const swing=numberField(el,'Размах угла'+label,p.swing||30,0,180);
    const formulas=document.createElement('div');el.append(formulas);const fx=field(formulas,'x(t)'+label,'text',p.fx||'cos(tau*t)'),fy=field(formulas,'y(t)'+label,'text',p.fy||'sin(tau*t)'),fa=field(formulas,'Угол a(t)'+label,'text',p.fa||'0');
    textBlock(formulas,'t идёт от 0 до 1 за цикл; угол — в радианах. Доступны pi, tau, + − * / ^, sin, cos, tan, abs, sqrt. Кривая должна замыкаться.');
    const preview=document.createElement('canvas');preview.width=220;preview.height=100;preview.className='zerk-path-preview';preview.setAttribute('aria-label','Предпросмотр кривой'+label);el.append(preview);
    const read=()=>{const next={...p,kind:kind.value,period:clamp(Number(period.value)||12,.25,3600),phase:clamp(Number(phase.value)||0,0,360),ampX:clamp(Number(ax.value)||0,0,45)/100,ampY:clamp(Number(ay.value)||0,0,45)/100,orient:orient.value,swing:clamp(Number(swing.value)||0,0,180),fx:fx.value,fy:fy.value,fa:fa.value};return {next,fn:sceneMath.compile(next)};};
    const show=()=>{formulas.hidden=kind.value!=='custom'&&orient.value!=='custom';fx.closest('label').hidden=fy.closest('label').hidden=kind.value!=='custom';fa.closest('label').hidden=orient.value!=='custom';swing.closest('label').hidden=orient.value!=='swing';ay.disabled=kind.value==='circle';plateZig(tools,m.color);};kind.onchange=orient.onchange=show;show();
    const draw=fn=>{const ctx=preview.getContext('2d');ctx.clearRect(0,0,220,100);ctx.strokeStyle=m.color;ctx.lineWidth=1;ctx.beginPath();for(let j=0;j<=256;j++){const v=fn(j/256),x=110+v[0]*42,y=50+v[1]*35;j?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();};try{draw(sceneMath.compile(p));}catch(e){}
    button('Проверить кривую','Проверить кривую'+label,()=>{try{draw(read().fn);notify('Кривая замкнута · формулы проверены');}catch(e){notify(e.message);}},el);
    button('Применить и пуск','Запустить движение по кривой'+label,()=>{try{const {next,fn}=read();Object.assign(p,next);pathFns.set(m,fn);anchorPath(m);p.enabled=true;m.spin=false;draw(fn);changed();}catch(e){notify(e.message);}},el);
    const pause=button('Пауза / продолжить','Пауза или продолжение кривой'+label,()=>{if(p.enabled)p.enabled=false;else{try{const fn=sceneMath.compile(p);pathFns.set(m,fn);if(!Number.isFinite(p.anchorX))anchorPath(m);p.enabled=true;m.spin=false;}catch(e){notify(e.message);return;}}changed();},el);
    button('Начало цикла','Вернуть движение'+label+' к началу цикла',()=>{p.elapsed=0;const v=pathValue(m);if(Number.isFinite(p.anchorX)){m.x=p.anchorX+v[0]*p.ampX;m.y=p.anchorY+v[1]*(p.kind==='circle'?p.ampX*drawW/Math.max(1,drawH):p.ampY);m.angle=norm(p.anchorAngle+v[2]);}changed();},el);
    const b=editDiamond('∞\nкривая','Циклическое движение'+label,el,parent);b.onclick=()=>{kind.value=p.kind;period.value=p.period;phase.value=p.phase;ax.value=p.ampX*100;ay.value=p.ampY*100;orient.value=p.orient;swing.value=p.swing||30;fx.value=p.fx||'cos(tau*t)';fy.value=p.fy||'sin(tau*t)';fa.value=p.fa||'0';show();try{draw(sceneMath.compile(p));}catch(e){}openEditor(el,'Циклическое движение'+label,b);};compactUpdates.push(()=>{b.classList.toggle('on',p.enabled);b.textContent=p.enabled?'∞\n'+Math.floor((p.elapsed||0)/p.period):'∞\nкривая';pause.setAttribute('aria-pressed',String(p.enabled));});
  }
  function buildCycleEditor(parent){
    const el=editor([]),period=numberField(el,'Общий период трёх кривых в секундах',12,.25,3600,.25);
    textBlock(el,'Каждая линия получает свою кривую, фазу и поворот. Настройки отдельного зеркала — в его ромбе ∞. Ручное перемещение или изменение угла останавливает его кривую.');
    button('Три кривые · пуск','Запустить три зеркала по кругу, эллипсу и восьмёрке',()=>{state.mirrors.forEach((m,i)=>{const p=m.path;Object.assign(p,{kind:['circle','ellipse','eight'][i],period:clamp(Number(period.value)||12,.25,3600),phase:i*120,ampX:.1,ampY:.08,orient:'swing',swing:20,elapsed:0});pathFns.set(m,sceneMath.compile(p));anchorPath(m);p.enabled=true;m.spin=false;m.on=true;controls[i].on.checked=true;});changed();},el);
    button('Все · пауза','Остановить движения всех трёх зеркал',()=>{state.mirrors.forEach(m=>{m.path.enabled=false;m.spin=false;});changed();},el);
    button('Все · продолжить','Продолжить кривые всех трёх зеркал',()=>{state.mirrors.forEach(m=>{preparePath(m);if(pathFns.has(m)){if(!Number.isFinite(m.path.anchorX))anchorPath(m);m.path.enabled=true;m.spin=false;}});changed();},el);
    button('Синхронизировать периоды','Применить общий период к трём зеркалам',()=>{const t=clamp(Number(period.value)||12,.25,3600);state.mirrors.forEach(m=>{const p=m.path;p.elapsed=(p.elapsed||0)/p.period*t;p.period=t;});changed();},el);
    editDiamond('∞\nциклы','Три зеркала · циклы',el,parent);
  }
  function setRows(i){const set=state.sets[i];return set.source==='field'?Z.rows:set.source==='own'?set.rows:set.source==='serp'?serp:rows();}
  function fieldRowsExtent(){return Z.rows;}   // v0.1162, «горизонт поднимаю — и в зеркалах убирать нижние строки»: строки за чертой (hidRows) в Зеркалиус не идут
  function visibleWorld(ctx,pad=0){
    const t=ctx.getTransform(),det=t.a*t.d-t.b*t.c,points=[[0,0],[ctx.canvas.width,0],[ctx.canvas.width,ctx.canvas.height],[0,ctx.canvas.height]].map(([x,y])=>[(t.d*(x-t.e)-t.c*(y-t.f))/det,(-t.b*(x-t.e)+t.a*(y-t.f))/det]);
    return [Math.min(...points.map(p=>p[0]))-pad,Math.min(...points.map(p=>p[1]))-pad,Math.max(...points.map(p=>p[0]))+pad,Math.max(...points.map(p=>p[1]))+pad];
  }

  function pendulumImage(mode,dw){
    const engine=pendEngine(),{W,H,val}=engine.field,dy=dw,bounds=[-W*dw/2,-dy/2,W*dw/2,(H-.5)*dy],image=document.createElement('canvas');image.width=W;image.height=H;
    const ctx=image.getContext('2d'),data=ctx.createImageData(W,H),palette=new Map(),pairColors=new Map(),edges=[],symmetry=state.bitSymmetry?ZZBitSymmetry.request(engine.rows(),state.symmetryMinimums):null;
    const cellColor=(r,c)=>{const color=engine.color(r,c,mode,pendSettings.colored!==false);if(color===null)return null;const original=mode&2?W-1-c:c,match=ZZBitSymmetry.colorAt(symmetry,r,original);if(!match)return color;const bit=val[r*W+original]^(mode&1),key=match+bit;let paint=pairColors.get(key);if(!paint){const bright=bit?.85:.4;paint='#'+[1,3,5].map(i=>Math.round(parseInt(match.slice(i,i+2),16)*bright).toString(16).padStart(2,'0')).join('');pairColors.set(key,paint);}return paint;};
    for(let r=0;r<H;r++){let first=-1,last=-1;for(let c=0;c<W;c++){
      const color=cellColor(r,c);if(color===null)continue;
      if(first<0)first=c;last=c;
      let rgb=palette.get(color);if(!rgb){rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));palette.set(color,rgb);}const o=(r*W+c)*4;data.data.set(rgb,o);data.data[o+3]=255;
    }if(first>=0)edges.push([bounds[0]+first*dw,(r-.5)*dy],[bounds[0]+(last+1)*dw,(r+.5)*dy]);}
    ctx.putImageData(data,0,0);
    ZZBitSymmetry.drawAxes(ctx,symmetry,(x2,r)=>[(mode&2?-x2:x2)/2+W/2,r+.5],1);
    return {image,bounds,symmetry,pixelated:true,lattice:{o:[bounds[0]+dw/2,0],e1:[dw,0],e2:[0,dy]},polygons:edges.length?[figureHull(edges)]:[],points:{*[Symbol.iterator](){for(let r=0;r<H;r++)for(let c=0;c<W;c++)if(data.data[(r*W+c)*4+3])yield [bounds[0]+(c+.5)*dw,r*dy];}},
      draw(target,pixelScale=1,colorMap=c=>c){
        const view=visibleWorld(target,dw),c0=clamp(Math.floor((view[0]-bounds[0])/dw),0,W),c1=clamp(Math.ceil((view[2]-bounds[0])/dw),0,W),r0=clamp(Math.floor(view[1]/dy),0,H),r1=clamp(Math.ceil(view[3]/dy)+1,0,H);
        const digits=state.bitsOnly&&dw*pixelScale>=7;target.textAlign='center';target.textBaseline='middle';target.font='bold '+(dw*.72)+'px '+state.font;
        for(let r=r0;r<r1;r++)for(let c=c0;c<c1;c++){const color=cellColor(r,c);if(color===null)continue;target.fillStyle=colorMap(color);const x=bounds[0]+c*dw,y=(r-.5)*dy;
          if(digits){const original=mode&2?W-1-c:c;target.fillText(String(val[r*W+original]^(mode&1)),x+dw/2,r*dy);}else target.fillRect(x,y,dw,dy);
        }
        ZZBitSymmetry.drawAxes(target,symmetry,(x2,r)=>[(mode&2?-x2:x2)*dw/2,r*dy],Math.max(.7/pixelScale,dw*.12),colorMap);
      }};
  }

  function sourceImage(R,color,dw,ratio){
    const dh=dw*Math.sqrt(3), symmetry=state.bitSymmetry?ZZBitSymmetry.request(R,state.symmetryMinimums):null, shapes=[],vertices=[],bounds=[Infinity,Infinity,-Infinity,-Infinity];
    const include=(x,y)=>{vertices.push([x,y]);bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);};
    for(let r=0;r<R.length;r++)for(let j=0;j<R[r].length;j++){
      const bit=R[r][j],x=-(R[r].length-1)*dw/2+j*dw,y=r*dh/2,a=state[bit==='0'?'zero':'one']*pi/180,c=Math.cos(a),sn=Math.sin(a);
      shapes.push([bit,x,y,a,ZZBitSymmetry.colorAt(symmetry,r,j)]);for(const [u,v] of [[0,-dh*.5],[dw*.5,0],[0,dh*.5],[-dw*.5,0]])include(x+u*c-v*sn,y+u*sn+v*c);
    }
    bounds[0]-=2;bounds[1]-=2;bounds[2]+=2;bounds[3]+=2;
    const image=document.createElement('canvas'),w=bounds[2]-bounds[0],h=bounds[3]-bounds[1],safe=Math.min(ratio,8192/Math.max(w,h),Math.sqrt(16000000/(w*h)));
    image.width=Math.max(1,Math.ceil(w*safe));image.height=Math.max(1,Math.ceil(h*safe));const ctx=image.getContext('2d');ctx.setTransform(safe,0,0,safe,-bounds[0]*safe,-bounds[1]*safe);
    const draw=(target,pixelScale=1,colorMap=c=>c)=>{
      const alpha=target.globalAlpha,fs=state.bitsOnly?dw*.72:Math.max(5/Math.max(1,pixelScale),dw*.62),digits=state.bitsOnly||state.bitShape.endsWith('01')&&dw*pixelScale>=7,view=visibleWorld(target,Math.max(dh,fs));
      target.font='bold '+fs+'px '+state.font;target.textAlign='center';target.textBaseline='middle';
      for(const [bit,x,y,a,symColor] of shapes){if(x<view[0]||y<view[1]||x>view[2]||y>view[3])continue;
        target.save();target.translate(x,y);target.rotate(a);target.globalAlpha=alpha*(bit==='1'?(symColor?.68:.42):(symColor?.25:.11));target.fillStyle=colorMap(symColor||color);
        if(!state.bitsOnly){if(state.bitShape.startsWith('square')){const q=Math.min(dw,dh/2)*.9;target.fillRect(-q/2,-q/2,q,q);}else if(state.bitShape.startsWith('circle')){target.beginPath();target.arc(0,0,Math.min(dw,dh/2)*.47,0,2*pi);target.fill();}else{target.beginPath();target.moveTo(0,-dh*.5);target.lineTo(dw*.5,0);target.lineTo(0,dh*.5);target.lineTo(-dw*.5,0);target.closePath();target.fill();}}   // v0.1169: квадрат-бит
        if(!state.digitsMirror&&(state.bitsOnly||(!state.trace&&digits))){const m=target.getTransform(),k=Math.sqrt(Math.abs(m.a*m.d-m.b*m.c));target.setTransform(k,0,0,k,m.e,m.f);}   // v0.1176: «цифры прямо» — без наклона и отражения
        if(state.bitsOnly){target.globalAlpha=alpha*(bit==='1'?1:.6);target.fillStyle=colorMap(symColor||color);target.fillText(bit,0,fs*.06);}
        else if(state.trace){const sign=bit==='1'?1:-1;target.globalAlpha=alpha*(bit==='1'?.95:.55);target.strokeStyle=colorMap(symColor||color);target.lineWidth=Math.max(.65,dw*.08);target.beginPath();target.moveTo(-dw*.22,-sign*dh*.22);target.lineTo(dw*.22,sign*dh*.22);target.stroke();}
        else if(digits){target.globalAlpha=alpha*(bit==='1'?.9:.35);target.fillStyle=colorMap(bit==='1'?'#06150d':symColor||color);target.fillText(bit,0,fs*.06);}target.restore();
      }target.globalAlpha=alpha;
      ZZBitSymmetry.drawAxes(target,symmetry,(x2,r)=>[x2*dw/2,r*dh/2],Math.max(.7/pixelScale,dw*.12),colorMap);
    };
    draw(ctx,safe);return {image,bounds,symmetry,lattice:rowsLattice(R,dw),polygons:[figureHull(vertices)],points:shapes.map(v=>[v[1],v[2]]),draw};
  }

  function netGeometry(preset=state.net.preset){
    const [tree,C]=(state.net.nb===4?RAZV_V:RAZV_V3)[preset],{F,pos}=razvUnfold(tree,state.net.nb);
    const faces=Object.keys(pos).map(name=>({name,up:name[0]==='U',P:F[name].map(v=>pos[name][v])}));let center;
    if(C[0]==='v')center=pos[C[1]][C[2]];
    else{const points=C[0]==='e'?[pos[C[1]][C[2]],pos[C[1]][C[3]]]:Object.values(pos[C[1]]);center=[0,1].map(i=>points.reduce((n,p)=>n+p[i],0)/points.length);}
    const bounds=[Infinity,Infinity,-Infinity,-Infinity];for(const f of faces)for(const p of f.P){bounds[0]=Math.min(bounds[0],p[0]);bounds[1]=Math.min(bounds[1],p[1]);bounds[2]=Math.max(bounds[2],p[0]);bounds[3]=Math.max(bounds[3],p[1]);}return {faces,bounds,center};
  }
  // A lattice square becomes a rhombus; the last diagonal row is clipped to triangles.
  // Together these cells tile the face exactly, with no spacing or overlapping interiors.
  function netCell(f,r,k,R){
    const [A,L,B]=f.P,u=r-k,v=k,map=(a,b)=>[A[0]+a/R*(L[0]-A[0])+b/R*(B[0]-A[0]),A[1]+a/R*(L[1]-A[1])+b/R*(B[1]-A[1])];
    const edge=r===R-1,P=(edge?[[u,v],[u+1,v],[u,v+1]]:[[u,v],[u+1,v],[u+1,v+1],[u,v+1]]).map(([a,b])=>map(a,b));
    return {P,C:map(u+(edge?1/3:.5),v+(edge?1/3:.5))};
  }
  function netFaces(ctx,model,bits,scale,labels,preview=false,colorMap=c=>c,pixelScale=1){
    const symmetry=state.bitSymmetry&&!preview?ZZBitSymmetry.request(bits.map(row=>Array.from(row).join('')),state.symmetryMinimums):null;
    const alpha=ctx.globalAlpha,R=bits.length,cell=scale/Math.max(1,R),view=visibleWorld(ctx,2/Math.max(1,R));ctx.textAlign='center';ctx.textBaseline='middle';
    for(const f of model.faces){const col=f.up?state.net.up:state.net.down,[A,L,B]=f.P;ctx.fillStyle=colorMap(col);ctx.strokeStyle=colorMap(col);
      if(!state.bitsOnly||preview){ctx.beginPath();ctx.moveTo(...A);ctx.lineTo(...L);ctx.lineTo(...B);ctx.closePath();if(preview){ctx.globalAlpha=alpha*.1;ctx.fill();}ctx.globalAlpha=alpha;ctx.lineWidth=(preview?1:1.4)/scale;ctx.stroke();}
      if(!preview)for(let r=0;r<R;r++)for(let k=0;k<=r;k++){const bit=bits[r][k]^(f.up?0:1),symColor=ZZBitSymmetry.colorAt(symmetry,r,k),{P,C:[x,y]}=netCell(f,r,k,R);
        if(x<view[0]||y<view[1]||x>view[2]||y>view[3])continue;
        if(!state.bitsOnly){ctx.globalAlpha=alpha*(bit?(symColor?.68:.42):(symColor?.25:.11));ctx.fillStyle=colorMap(symColor||col);ctx.beginPath();ctx.moveTo(...P[0]);P.slice(1).forEach(p=>ctx.lineTo(...p));ctx.closePath();ctx.fill();}
        if(state.netDigits){ctx.save();ctx.globalAlpha=alpha*(state.bitsOnly?(bit?1:.7):(bit?1:.7));ctx.fillStyle=colorMap(state.bitsOnly||!bit?symColor||col:'#06150d');ctx.translate(x,y);ctx.scale(.6/R/16,.6/R/16);ctx.font='700 16px '+state.font;ctx.fillText(String(bit),0,0);ctx.restore();}}
      ctx.globalAlpha=alpha;ZZBitSymmetry.drawAxes(ctx,symmetry,(x2,r)=>{r=clamp(r,0,R-1);return netCell(f,r,(r+x2)/2,R).C;},Math.max(.7/pixelScale,.08*cell)/scale,colorMap);
      if(labels&&!preview&&!state.bitsOnly){const x=(A[0]+L[0]+B[0])/3,y=(A[1]+L[1]+B[1])/3;ctx.globalAlpha=alpha;ctx.font='700 '+(12/scale)+'px system-ui';ctx.lineWidth=3/scale;ctx.strokeStyle=colorMap('#000000');ctx.strokeText(f.name,x,y);ctx.fillStyle=colorMap('#ffffff');ctx.fillText(f.name,x,y);}
    }ctx.globalAlpha=alpha;
  }
  function netPreview(canvas,preset){const model=netGeometry(preset),b=model.bounds,scale=Math.min(48/(b[2]-b[0]),40/(b[3]-b[1])),ctx=canvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,56,48);ctx.setTransform(scale,0,0,scale,28-(b[0]+b[2])*scale/2,24-(b[1]+b[3])*scale/2);netFaces(ctx,model,[],scale,false,true);}
  function netImage(pattern,scale,ratio){const model=netGeometry(),b=model.bounds,pad=5/scale,bounds=[(b[0]-pad)*scale,(b[1]-pad)*scale,(b[2]+pad)*scale,(b[3]+pad)*scale],w=bounds[2]-bounds[0],h=bounds[3]-bounds[1],safe=Math.min(ratio,8192/Math.max(w,h),Math.sqrt(16000000/(w*h))),image=document.createElement('canvas');image.width=Math.max(1,Math.ceil(w*safe));image.height=Math.max(1,Math.ceil(h*safe));const ctx=image.getContext('2d');ctx.setTransform(scale*safe,0,0,scale*safe,-bounds[0]*safe,-bounds[1]*safe);netFaces(ctx,model,sceneMath.faceRows(pattern),scale,state.net.labels);const points=[];for(const f of model.faces){const [A,L,B]=f.P;for(let r=0;r<pattern.length;r++)for(let k=0;k<=r;k++){points.push(netCell(f,r,k,pattern.length).C.map(v=>v*scale));}}return {image,bounds,symmetry:state.bitSymmetry?ZZBitSymmetry.request(sceneMath.faceRows(pattern).map(row=>Array.from(row).join('')),state.symmetryMinimums):null,points,polygons:model.faces.map(f=>f.P.map(p=>p.map(v=>v*scale))),draw(target,pixelScale,colorMap){target.save();target.scale(scale,scale);netFaces(target,model,sceneMath.faceRows(pattern),scale,state.net.labels,false,colorMap,pixelScale);target.restore();}};}
  function reflectedMode(mask){return state.mirrors.reduce((v,m,j)=>v^((mask&(1<<j))?({direct:0,inv:1,reverse:2,both:3})[m.mode]:0),0);}
  function transferNet(){
    const mask=state.net.copy;if(state.mirrors.some((m,i)=>(mask&(1<<i))&&!m.on)){notify('Включите зеркала выбранного отражения или выберите исходную развёртку');return;}
    const R=sceneMath.transformRows(rows(),reflectedMode(mask)),list=sceneMath.facePairs(R,state.net.nb);
    const tint=color=>{let rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));if(state.tint)state.mirrors.forEach((m,i)=>{if(mask&(1<<i))rgb=rgb.map((v,j)=>v*.62+parseInt(m.color.slice(1+j*2,3+j*2),16)*.38);});return '#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');};
    Z.zerkBipy={revision:Date.now(),nb:state.net.nb,h:list[0].u.length-1,list,up:tint(state.net.up),down:tint(state.net.down)};Z.oktInput='zerk-net';Z.oktSync=false;oktSent=null;save();
    if(!winOpen('w-okt'))document.querySelector('#pinBar button[data-aw="w-okt"]')?.click();renderOkt();notify('Развёртка: '+(state.net.nb*2)+' граней перенесено в Бирамиду');
  }
  function scene(ratio=dpr){
    if(state.build==='net'){
      const model=netGeometry(),b=model.bounds,reserve=drawW>650&&!document.body.classList.contains('zerk-zen')?250:0,W=drawW-reserve,scale=Math.max(1,Math.min(W*.8/(b[2]-b[0]),drawH*.8/(b[3]-b[1]))),place=sceneMath.placement(reserve+W/2-(b[0]+b[2])*scale/2+state.sourceOffsets[0][0]*drawW,drawH/2-(b[1]+b[3])*scale/2+state.sourceOffsets[0][1]*drawH,0),items=[];
      const reflected=reflectedCopies();
      for(const c of reflected){const pattern=sceneMath.transformRows(rows(),reflectedMode(c.mask)),key=JSON.stringify(['net',pattern,state.net.nb,state.net.preset,state.net.up,state.net.down,state.net.labels,state.bitsOnly,state.bitShape,state.netDigits,state.digitsMirror,state.bitSymmetry,state.symmetryMinimums,state.font,scale,ratio]);let src=sourceCache.get(key);if(!src){src=netImage(pattern,scale,ratio);sourceCache.set(key,src);}items.push({src,bounds:src.bounds,matrix:sceneMath.multiply(c.matrix,place),mask:c.mask,source:0});}
      return {items,bounds:sceneMath.bounds(items),count:1,labels:[{point:sceneMath.point(place,...model.center.map(v=>v*scale)),text:'Холст · развёртка',color:state.net.up}]};
    }
    const reserve=drawW>650&&!document.body.classList.contains('zerk-zen')?250:0,W=drawW-reserve,cx=reserve+W/2,cy=drawH*.52,count=state.layout==='quad'?2:state.layout==='tri'?3:1,items=[],labels=[];
    const reflected=reflectedCopies();
    for(let i=0;i<count;i++){
      const R=count===1?rows():setRows(i),fromField=count===1?state.source==='field':state.sets[i].source==='field'||state.sets[i].source==='shared'&&state.source==='field',extent=fromField?fieldRowsExtent():R,N=Math.max(1,extent.length),max=Math.max(1,...extent.map(s=>s.length)),color=count===1?state.bitColor:state.sets[i].color;
      const isPend=state.source==='pend'&&(count===1||state.sets[i].source==='shared');
      const dw=count===1?Math.min(W*.92/max,(drawH-24)/((N+1)*(isPend?1:.866))):Math.min(W,drawH)*.39/Math.max(N*.866,max*.5);
      const variants=new Map();for(const c of reflected){const mode=state.mirrors.reduce((v,m,j)=>v^((c.mask&(1<<j))?({direct:0,inv:1,reverse:2,both:3})[m.mode]:0),0);if(!variants.has(mode)){
        const pattern=isPend?null:mode?sceneMath.transformRows(R,mode):R,key=JSON.stringify([isPend?['pend',pendEngine().revision,mode,pendSettings.colored]:pattern,color,dw,state.zero,state.one,state.trace,state.bitsOnly,state.bitShape,state.digitsMirror,state.bitSymmetry,state.symmetryMinimums,state.font,ratio]);let src=sourceCache.get(key);if(!src){src=isPend?pendulumImage(mode,dw):sourceImage(pattern,color,dw,ratio);sourceCache.set(key,src);}variants.set(mode,src);
      }}
      for(let k=0;k<(count===1?1:state.mult);k++){
        const angle=(state.layout==='quad'?i*pi/2:i*pi/3)-pi/2+k*2*pi/state.mult;
        const offset=state.sourceOffsets[i],place=count===1?sceneMath.placement(cx+offset[0]*drawW,12+dw*Math.sqrt(3)/2+offset[1]*drawH,0):sceneMath.placement(cx+offset[0]*drawW,cy+offset[1]*drawH,angle);
        if(k===0)labels.push({point:sceneMath.point(place,0,(N-1)*dw*Math.sqrt(3)*.3),text:count===1?'Холст':'Холст '+(i+1),color});
        for(const c of reflected){const mode=state.mirrors.reduce((v,m,j)=>v^((c.mask&(1<<j))?({direct:0,inv:1,reverse:2,both:3})[m.mode]:0),0),src=variants.get(mode);items.push({src,bounds:src.bounds,matrix:sceneMath.multiply(c.matrix,place),mask:c.mask,source:i});}
      }
    }
    return {items,bounds:sceneMath.bounds(items),count,labels};
  }
  function figureHull(points){
    const sorted=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    const half=list=>{const out=[];for(const p of list){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};
    if(sorted.length<3)return sorted;const lower=half(sorted),upper=half(sorted.slice().reverse());return lower.slice(0,-1).concat(upper.slice(0,-1));
  }
  function overlapPaths(items){
    return items.map(item=>{const path=new Path2D();for(const polygon of item.src.polygons){const points=polygon.map(p=>sceneMath.point(item.matrix,...p));
      // All subpaths share one winding, including reflected faces, so their union has no accidental holes.
      const area=points.reduce((a,p,i)=>{const q=points[(i+1)%points.length];return a+p[0]*q[1]-q[0]*p[1];},0);if(area<0)points.reverse();
      points.forEach((p,i)=>i?path.lineTo(...p):path.moveTo(...p));path.closePath();}return path;});
  }
  function paint(ctx,data,camera){
    const scratch=tintCanvas,sc=tintContext,paths=state.overlapOnly?overlapPaths(data.items):null,mappers=new Map();let lastSrc=null,lastMask=-1;
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    const tintMap=mask=>{if(!state.tint||!mask)return c=>c;if(mappers.has(mask))return mappers.get(mask);const cache=new Map(),map=color=>{if(cache.has(color))return cache.get(color);let rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));state.mirrors.forEach((m,i)=>{if(mask&(1<<i))rgb=rgb.map((v,j)=>v*.62+parseInt(m.color.slice(1+j*2,3+j*2),16)*.38);});const result='#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');cache.set(color,result);return result;};mappers.set(mask,map);return map;};
    for(const [index,item] of data.items.entries()){
      const b=item.bounds,transform=sceneMath.multiply(camera,item.matrix),pixelScale=Math.max(Math.hypot(transform[0],transform[1]),Math.hypot(transform[2],transform[3])),density=Math.min(item.src.image.width/(b[2]-b[0]),item.src.image.height/(b[3]-b[1])),vector=item.src.draw&&(pixelScale>density*1.05||!state.digitsMirror&&!item.src.pixelated);
      let image=item.src.image;if(!vector&&state.tint&&item.mask){
        if(lastSrc!==item.src||lastMask!==item.mask){scratch.width=image.width;scratch.height=image.height;sc.drawImage(image,0,0);sc.globalCompositeOperation='source-atop';for(let i=0;i<3;i++)if(item.mask&(1<<i)){sc.globalAlpha=.38;sc.fillStyle=state.mirrors[i].color;sc.fillRect(0,0,scratch.width,scratch.height);}sc.globalAlpha=1;sc.globalCompositeOperation='source-over';lastSrc=item.src;lastMask=item.mask;}image=scratch;
      }
      // v0.1177: «цифры прямо» — копии всегда рисуются вектором, иначе готовая картинка отражается целиком вместе с цифрами
      const draw=()=>vector?item.src.draw(ctx,pixelScale,tintMap(item.mask)):ctx.drawImage(image,b[0],b[1],b[2]-b[0],b[3]-b[1]);
      ctx.setTransform(...transform);ctx.imageSmoothingEnabled=!item.src.pixelated;ctx.globalAlpha=paths?.06:1;draw();ctx.globalAlpha=1;
      if(paths){const others=new Path2D();paths.forEach((path,j)=>{if(j!==index)others.addPath(path);});ctx.save();ctx.setTransform(...camera);ctx.clip(paths[index]);ctx.clip(others);ctx.setTransform(...transform);draw();ctx.restore();}
    }ctx.setTransform(1,0,0,1,0,0);
  }
  function render(){
    if(!visible())return;const r=stage.getBoundingClientRect();if(r.width<10||r.height<10)return;drawW=r.width;drawH=r.height;dpr=Math.min(2,devicePixelRatio||1);
    const key=Math.round(drawW*dpr)+'x'+Math.round(drawH*dpr),next=JSON.stringify([state.source==='pend'?['pend',pendEngine().revision]:rows(),state.sets.map((set,i)=>state.source==='pend'&&set.source==='shared'?null:setRows(i))]);
    if(key!==geometry){geometry=key;cv.width=Math.round(drawW*dpr);cv.height=Math.round(drawH*dpr);dirty=true;plateZig(tools,'#70e0d7');}
    if(next!==rowsKey){rowsKey=next;dirty=true;}if(dirty){sourceCache.clear();dirty=false;}
    const data=scene();g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,cv.width,cv.height);
    paint(g,data,sceneMath.multiply([dpr,0,0,dpr,0,0],viewMatrix()));
    paintFieldAxes(g,sceneMath.multiply([dpr,0,0,dpr,0,0],viewMatrix()));
    fieldAxisNodes.forEach((node,i)=>{const f=state.fieldAxes,p=viewPoint(f.x,f.y),length=(Math.hypot(drawW,drawH)+Math.hypot(...p))*2+40;node.hidden=!f.on;Object.assign(node.style,{width:length+'px',left:(p[0]-length/2)+'px',top:(p[1]-16)+'px',transform:'rotate('+(f.angle+i*pi/2+state.viewAngle*pi/180)+'rad)'});});
    state.mirrors.forEach((m,i)=>{const {line,center,turn,axis,deg:degEl}=handles[i],ctl=controls[i],p=viewPoint(m.x,m.y),screenAngle=m.angle+state.viewAngle*pi/180,length=Math.hypot(drawW,drawH)*2+40;
      line.hidden=axis.hidden=!m.on;
      line.classList.toggle('off',!m.on);line.style.setProperty('--mirror-color',m.color);line.style.setProperty('--control-color',sceneMath.controlColor(m.color));Object.assign(line.style,{width:length+'px',left:(p[0]-length/2)+'px',top:(p[1]-16)+'px',transform:'rotate('+screenAngle+'rad)'});
      Object.assign(axis.style,{width:length+'px',left:line.style.left,top:(p[1]-axis.offsetHeight/2)+'px',transform:line.style.transform});
      if(m.grip!==null&&Math.abs(m.angle-m.gripAngle)>pi/2)m.grip=-m.grip;m.gripAngle=m.angle;
      center.style.left=(length/2-center.offsetWidth/2)+'px';center.style.transform='rotate('+(-screenAngle)+'rad)';
      const arm=Math.max(48,Math.min(160,Math.min(drawW,drawH)*.18*state.zoom));turn.style.left=(length/2-turn.offsetWidth/2+arm)+'px';turn.style.transform='rotate('+(-screenAngle)+'rad)';
      const deg=Math.round(m.angle*180/pi)%180;ctl.angle.value=deg;ctl.output.textContent=deg+'°';
      {const t=String(Math.round(m.angle*1800/pi)%1800/10).replace('.',',')+'°';if(degEl.textContent!==t)degEl.textContent=t;degEl.style.left=(length/2+arm+turn.offsetWidth/2+4)+'px';degEl.style.transform='rotate('+(-screenAngle)+'rad)';}});
    annotations.hidden=!state.labels;
    if(state.labels){const distance=Math.min(drawW,drawH)*.18,names=state.mirrors.map((m,i)=>{const p=viewPoint(m.x,m.y),a=m.angle+state.viewAngle*pi/180;return {x:p[0]+Math.cos(a)*distance,y:p[1]+Math.sin(a)*distance+20,text:'Зеркало '+(i+1),color:m.color,off:!m.on};});
      for(const label of data.labels){const p=viewPoint(label.point[0]/drawW,label.point[1]/drawH);names.push({x:p[0],y:p[1],text:label.text,color:label.color});}
      const placed=[];annotationNodes.forEach((el,i)=>{const n=names[i];el.hidden=!n||!!n.off;if(!n||n.off)return;el.textContent=n.text;const w=el.offsetWidth,h=el.offsetHeight;
        if(i>=3){while(placed.some(p=>Math.abs(p.x-n.x)<(p.w+w)/2+3&&Math.abs(p.y-n.y)<h+3))n.y+=h+3;placed.push({x:n.x,y:n.y,w});}
        el.style.left=n.x+'px';el.style.top=n.y+'px';el.style.color=sceneMath.controlColor(n.color);el.classList.toggle('off',!!n.off);});}
    compactUpdates.forEach(update=>update());groups.forEach(el=>platePlace(el));zoomValue.textContent=Math.round(state.zoom*100)+'%';zoomOut.disabled=state.zoom<=ZOOM_MIN;zoomIn.disabled=state.zoom>=ZOOM_MAX;
    const moving=state.mirrors.filter(m=>m.on&&m.path.enabled).length,mirrorCount=state.mirrors.filter(m=>m.on).length,message=snapHint?'🧲 '+snapHint:notice||data.count+(data.count===1?' набор':' набора')+' · ×'+(data.count===1?1:state.mult)+' · '+mirrorCount+(mirrorCount===1?' зеркало':mirrorCount===0?' зеркал':' зеркала')+(state.overlapOnly?' · пересечения ярко':'')+(moving?' · '+moving+' по кривым':' · колесо — масштаб; нажатие — дзен');const symmetrySources=[...new Set(data.items.map(item=>item.src))],symmetryMessage=state.bitSymmetry?' · симметрия: '+(symmetrySources.some(src=>!src.symmetry)?'поиск…':symmetrySources.reduce((sum,src)=>sum+src.symmetry.segments.length,0)+' участков'):'';const finalMessage=state.source==='pend'?'Зеркальный маятник · кадр '+pendEngine().frame+' / '+pendEngine().limit+' · '+message+symmetryMessage:message+symmetryMessage;if(status.textContent!==finalMessage)status.textContent=finalMessage;platePlace(tools);
  }
  const jumpAcc=new WeakMap();
  function tick(now){raf=0;if(!visible()){previous=0;return;}const dt=previous?Math.max(0,(now-previous)/1000):0;previous=now;
    const spinning=state.mirrors.some(m=>m.on&&(m.spin||m.path.enabled));for(const m of state.mirrors)if(m.on){
      if(m.path.enabled){try{const p=m.path;if(!Number.isFinite(p.anchorX)||!Number.isFinite(p.anchorY)||!Number.isFinite(p.anchorAngle))anchorPath(m);p.elapsed+=dt*(state.motionRate??1)*state.motionDir;const v=pathValue(m),ay=p.kind==='circle'?p.ampX*drawW/Math.max(1,drawH):p.ampY;m.x=p.anchorX+v[0]*p.ampX;m.y=p.anchorY+v[1]*ay;m.angle=norm(p.anchorAngle+v[2]);}catch(e){stopPath(m);notify('Кривая остановлена: '+e.message);persist();}}
      else if(m.spin){const d=m.speed*pi/180*dt*(state.motionRate??1)*state.motionDir;
        if(state.motionJump){const st=state.motionJump*pi/180;let acc=(jumpAcc.get(m)||0)+d;while(Math.abs(acc)>=st){const sg=Math.sign(acc);turnMirror(m,Math.round((m.angle+sg*st)/st)*st-m.angle);acc-=sg*st;}jumpAcc.set(m,acc);}   // v0.1183: скачками — копим ход, шаг за шагом встаём на кратные углы
        else turnMirror(m,d);}
    }
    const beforePend=pendulum?.revision,pendMoving=advancePendulum(now);if(spinning||dirty||!pendMoving||beforePend!==pendulum?.revision)render();if(spinning||pendMoving)raf=requestAnimationFrame(tick);else previous=0;
  }
  function request(){if(!raf&&visible())raf=requestAnimationFrame(tick);}
  let fieldKey=JSON.stringify(fieldRowsExtent());
  let fieldVisibleKey=JSON.stringify(Z.rows);
  window.zzZerkaliusFieldChanged=()=>{
    const next=JSON.stringify(fieldRowsExtent()),visibleKey=JSON.stringify(Z.rows);if(next===fieldKey&&visibleKey===fieldVisibleKey)return;fieldKey=next;fieldVisibleKey=visibleKey;
    if(state.followField&&['base','serp'].includes(state.source)){state.source=source.value='field';own.hidden=true;persist();}
    if(state.source==='field'||state.sets.some(set=>set.source==='field')){dirty=true;request();}
  };
  window.zzZerkaliusRender=()=>{dirty=true;request();};
  new ResizeObserver(()=>{dirty=true;request();}).observe(stage);
  plateZig(tools,'#70e0d7');
  new MutationObserver(()=>{if(!visible())previous=0;request();}).observe(win,{attributes:true,attributeFilter:['class','style','data-parked']});
  document.addEventListener('visibilitychange',()=>{previous=0;if(document.hidden)save();else request();});
  window.addEventListener('pagehide',save);
  document.fonts?.ready.then(()=>{dirty=true;request();});
  if(location.hash==='#zerkalius')document.querySelector('#pinBar button[data-aw="w-zerkalius"]')?.click();
  request();
})();
