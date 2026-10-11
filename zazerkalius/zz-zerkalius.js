/* v0.1124: только пересечения фигур, перенос пустого холста и осей, дзен колёсиком; v0.1123: читаемое меню тёмного зеркала, развёртки → Бирамида, только биты, шрифты, палитры и движение вдоль оси; v0.1122: магнит рядом с подписями без роста группы; v0.1121: магнит при ручном перемещении и повороте; v0.1120: заметные включённые ромбы, выбранные режимы и подписи зеркал/холстов; v0.1118: оси, наборы, циклы, управление в ромбах, PNG и отражения без обрезки; v0.1117: колесо и масштаб, прозрачные группы ромбов; v0.1116: Зеркалиус — рисунок хаба, свои строки, три передвижных цветных зеркала. */
(() => {
  'use strict';
  const win = document.getElementById('w-zerkalius');
  if (!win || ZZ_SOLO) return;
  const cv = document.getElementById('zerkCanvas'), stage = document.getElementById('zerkStage'), tools = document.getElementById('zerkTools');
  const status = document.getElementById('zerkStatus'), layer = document.getElementById('zerkMirrors');
  const pi = Math.PI, norm = a => ((a % pi) + pi) % pi, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const defaults = () => [
    {x:.52,y:.48,angle:pi/2,color:'#70e0d7',on:true,spin:false,speed:10},
    {x:.68,y:.52,angle:pi/6,color:'#ffd166',on:true,spin:false,speed:-7},
    {x:.61,y:.70,angle:5*pi/6,color:'#ed8fea',on:true,spin:false,speed:5}
  ];
  const state = Z.zerkalius ||= {};
  if (!['base','serp','field','own'].includes(state.source)) state.source = 'serp';
  state.zero = Number.isFinite(state.zero) ? clamp(state.zero,-60,60) : 0;
  state.one = Number.isFinite(state.one) ? clamp(state.one,-60,60) : 0;
  state.tint = state.tint !== false;
  state.trace = !!state.trace;
  state.labels = !!state.labels;
  state.magnet = state.magnet !== false;
  state.zoom=Number.isFinite(state.zoom)?clamp(state.zoom,.2,6):1;
  state.pan=Array.isArray(state.pan)&&state.pan.length===2&&state.pan.every(Number.isFinite)?state.pan:[0,0];
  if (!Array.isArray(state.rows)) state.rows = ZZ_INITIAL_ROWS.slice();
  const old = Array.isArray(state.mirrors) ? state.mirrors : [];
  state.mirrors = defaults().map((m,i) => {
    const v = old[i] || {};
    for (const k of ['x','y','angle','speed']) if (Number.isFinite(v[k])) m[k] = v[k];
    m.x=clamp(m.x,.01,.99);m.y=clamp(m.y,.01,.99);m.angle=norm(m.angle);m.speed=clamp(m.speed,-90,90);
    if (/^#[0-9a-f]{6}$/i.test(v.color)) m.color=v.color;
    m.on=v.on!==false;m.spin=!!v.spin;m.along=!!v.along;m.mode=['direct','inv','reverse','both'].includes(v.mode)?v.mode:'direct';m.path=v.path&&typeof v.path==='object'?v.path:{kind:'ellipse',period:12,phase:0,ampX:.12,ampY:.08,orient:'fixed',swing:30,fx:'cos(tau*t)',fy:'sin(tau*t)',fa:'0',enabled:false,elapsed:0};return m;
  });
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
  state.bitsOnly=!!state.bitsOnly;
  state.overlapOnly=!!state.overlapOnly;
  state.bitColor=/^#[0-9a-f]{6}$/i.test(state.bitColor)?state.bitColor:'#9fffc8';
  state.mult=[1,2,3].includes(state.mult)?state.mult:1;
  state.sets=Array.from({length:3},(_,i)=>{const v=state.sets?.[i]||{};return {source:['shared','field','own','serp'].includes(v.source)?v.source:'shared',rows:Array.isArray(v.rows)?v.rows:ZZ_INITIAL_ROWS.slice(),color:/^#[0-9a-f]{6}$/i.test(v.color)?v.color:['#70e0d7','#ffd166','#ed8fea'][i]};});
  state.png=Object.assign({frame:'scene',width:2048,height:2048,transparent:true},state.png||{});
  function stopPath(m){m.path.enabled=false;delete m.path.anchorX;delete m.path.anchorY;delete m.path.anchorAngle;}
  function preparePath(m){try{pathFns.set(m,sceneMath.compile(m.path));}catch(e){m.path.enabled=false;pathFns.delete(m);}}
  function pathValue(m){const p=m.path,t=((p.elapsed||0)/p.period+p.phase/360)%1,f=pathFns.get(m);return f?f(t):[0,0,0];}
  function anchorPath(m){const p=m.path,v=pathValue(m),ax=p.ampX,ay=p.kind==='circle'?p.ampX*drawW/Math.max(1,drawH):p.ampY;p.anchorX=m.x-v[0]*ax;p.anchorY=m.y-v[1]*ay;p.anchorAngle=m.angle-v[2];}
  for(const m of state.mirrors){const p=m.path;p.period=clamp(Number(p.period)||12,.25,3600);p.phase=clamp(Number(p.phase)||0,0,360);p.ampX=Number.isFinite(p.ampX)?clamp(p.ampX,0,.45):.12;p.ampY=Number.isFinite(p.ampY)?clamp(p.ampY,0,.45):.08;p.elapsed=Math.max(0,Number(p.elapsed)||0);preparePath(m);}

  let raf = 0, previous = 0, dirty = true, geometry = '', rowsKey = '', drawW = 0, drawH = 0, dpr = 1;
  let persistTimer = 0, notice = '', snapHint = '';
  const persist = () => { clearTimeout(persistTimer); persistTimer=setTimeout(save,200); };
  const visible = () => win.getClientRects().length && !win.classList.contains('collapsed') && !win.dataset.parked && !document.hidden;
  const serp = (() => { const rows=['1'];for(let r=1;r<64;r++){const p=rows[r-1];let s='';for(let j=0;j<=r;j++)s+=(Number(p[j-1]||0)^Number(p[j]||0));rows.push(s);}return rows; })();
  const rows = () => state.source==='field' ? Z.rows : state.source==='own' ? state.rows : state.source==='base' ? ZZ_INITIAL_ROWS : serp;
  const button = (text, title, action, parent) => { const b=document.createElement('button');b.type='button';b.textContent=text;b.title=title;b.setAttribute('aria-label',title);b.onclick=action;parent.append(b);return b; };
  const changed = (redrawBase=false) => { notice='';if(redrawBase)dirty=true;persist();request(); };
  const notify = message => { notice=message;status.textContent=message; };
  function placeTools(el) {
    const xy=Z.zerkToolsXY||[8,8];
    el.style.left=clamp(xy[0],0,Math.max(0,stage.clientWidth-el.offsetWidth))+'px';
    el.style.top=clamp(xy[1],0,Math.max(0,stage.clientHeight-el.offsetHeight))+'px';
  }
  const plateSetup=el=>{
    const c=SOL_PLATES[el.id];
    const hd=el.querySelector('.smh');hd.title='Тяни шапку — переместить панель; − / + — свернуть или открыть';
    el.querySelector('.pminbtn').onclick=e=>{e.stopPropagation();plateFoldToggle(el);};
    hd.addEventListener('pointerdown',e=>{
      if(e.button!==0||e.target.closest('button,input,select,textarea,label'))return;e.preventDefault();e.stopPropagation();hd.setPointerCapture(e.pointerId);
      const start=[e.clientX,e.clientY],r0=el.getBoundingClientRect();let moved=false;
      const move=ev=>{if(ev.pointerId!==e.pointerId)return;if(!moved&&Math.hypot(ev.clientX-start[0],ev.clientY-start[1])<4)return;
        el._solDragUntil=performance.now()+400;
        if(!moved){moved=true;el.classList.add('pdrag');document.body.classList.add('cgdrag');window.zzPanelDragStart?.(el,e.altKey);}
        const [x,y]=plateSnap(el,r0,ev.clientX-start[0],ev.clientY-start[1]),host=stage.getBoundingClientRect();
        Z[c.xy]=[x-host.left,y-host.top];c.place(el);window.zzPanelLinkSync?.();};
      const end=ev=>{if(ev.pointerId!==e.pointerId)return;hd.removeEventListener('pointermove',move);hd.removeEventListener('pointerup',end);hd.removeEventListener('pointercancel',end);if(hd.hasPointerCapture(e.pointerId))hd.releasePointerCapture(e.pointerId);
        if(moved){el._solDragUntil=performance.now()+400;el.classList.remove('pdrag');document.body.classList.remove('cgdrag');window.zzPanelDragEnd?.(el);zSnapGlow([]);save();}};
      hd.addEventListener('pointermove',move);hd.addEventListener('pointerup',end);hd.addEventListener('pointercancel',end);
    });
  };
  SOL_PLATES.zerkTools={name:'Зеркалиус · три зеркала',min:'zerkToolsMin',xy:'zerkToolsXY',col:'#70e0d7',place:placeTools,init:plateSetup};
  plateInit(tools);
  const body=tools.querySelector('.zerk-controls');
  const sourceLabel=document.createElement('label'), source=document.createElement('select');source.id='zerkSource';source.setAttribute('aria-label','Источник строк Зеркалиуса');
  for(const [v,t] of [['serp','Серпинский'],['base','Исходный из хаба'],['field','Строки поля'],['own','Свои строки']]){const o=document.createElement('option');o.value=v;o.textContent=t;source.append(o);}
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
  function useOwn(raw){try{state.rows=parseRows(raw);state.source='own';source.value='own';own.hidden=false;text.value=state.rows.join('\n');changed(true);notify('Загружено '+state.rows.length+' строк');plateZig(tools,'#70e0d7');placeTools(tools);}catch(e){notify(e.message);}}
  button('Применить','Построить по своим строкам',()=>useOwn(text.value),ownActions);
  button('TXT / JSON','Загрузить свои строки из TXT или JSON',()=>file.click(),ownActions);
  file.onchange=async()=>{const f=file.files[0];if(!f)return;try{useOwn(await f.text());}catch(e){notify('Не удалось прочитать файл: '+e.message);}file.value='';};
  body.append(own);
  source.onchange=()=>{state.source=source.value;own.hidden=state.source!=='own';changed(true);plateZig(tools,'#70e0d7');placeTools(tools);};
  const actions=document.createElement('div');actions.className='zerk-row';body.append(actions);
  button('Поле → свои','Скопировать текущие строки поля в свои строки',()=>useOwn(Z.rows.join('\n')),actions);
  button('В поле','Перенести исходные строки выбранного узора в поле; ↩ отменяет',()=>{
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
    const rotate=delta=>{pause();m.angle=norm(m.angle+delta*pi/180);changed();};
    button('◂','Повернуть зеркало '+(i+1)+' на −5°',()=>rotate(-5),wrap);wrap.append(angle);button('▸','Повернуть зеркало '+(i+1)+' на +5°',()=>rotate(5),wrap);
    angleRow.append(wrap,output);section.append(angleRow);body.append(section);
    on.onchange=()=>{m.on=on.checked;changed();};color.oninput=()=>{m.color=color.value;state.palette='custom';section.style.setProperty('--mirror-color',m.color);changed();};
    speed.onchange=()=>{m.speed=clamp(Number(speed.value)||0,-90,90);speed.value=m.speed;changed();};
    angle.oninput=()=>{pause();m.angle=Number(angle.value)*pi/180;changed();};
    controls.push({angle,output,spin,on,color,speed,section});
    const line=document.createElement('div');line.className='zerk-mirror';line.dataset.mirror=String(i+1);
    const center=document.createElement('button');center.type='button';center.className='zerk-center';center.textContent=i+1;center.setAttribute('aria-label','Переместить зеркало '+(i+1));
    const turn=document.createElement('button');turn.type='button';turn.className='zerk-turn';turn.textContent='↻';turn.setAttribute('aria-label','Повернуть зеркало '+(i+1)+' в поле');const axis=document.createElement('span');axis.className='zerk-axis';axis.tabIndex=0;axis.setAttribute('role','button');axis.setAttribute('aria-label','Переместить зеркало '+(i+1)+' за ось');line.append(axis,center,turn);layer.append(line);handles.push({line,center,turn});
    for(const [node,rotateMode] of [[center,false],[turn,true],[axis,false]]){
      node.title=(rotateMode?'Тяни ручку — поворот; колесо или ← → — шаг 5°':'Тяни ромб или ось — перенести зеркало; стрелки — сдвиг; правый щелчок — включить / выключить')+'; Alt — временно без магнита';
      node.addEventListener('pointerdown',e=>{
        if(e.button!==0)return;e.preventDefault();e.stopPropagation();node.setPointerCapture(e.pointerId);
        const r=stage.getBoundingClientRect(), sx=e.clientX,sy=e.clientY,x=m.x,y=m.y,a=m.angle,cx=r.left+viewX(x),cy=r.top+viewY(y),start=Math.atan2(sy-cy,sx-cx);let moved=false;
        const move=ev=>{if(ev.pointerId!==e.pointerId)return;if(!moved&&Math.hypot(ev.clientX-sx,ev.clientY-sy)<3)return;moved=true;stopPath(m);
          const magnetic=state.magnet&&!ev.altKey,others=state.mirrors.filter(other=>other!==m&&other.on);let snapped=false;snapHint='';
          if(rotateMode){const raw=norm(a+Math.atan2(ev.clientY-cy,ev.clientX-cx)-start),result=magnetic?sceneMath.snapAngle(raw,others):{angle:raw};m.angle=result.angle;snapped=!!result.snapped;snapHint=snapped?result.label:'';m.spin=false;controls[i].spin.textContent='▶';controls[i].spin.setAttribute('aria-pressed','false');}
          else{if(m.along){m.spin=false;m.angle=a;}m.x=clamp(x+(ev.clientX-sx)/(drawW*state.zoom),.01,.99);m.y=clamp(y+(ev.clientY-sy)/(drawH*state.zoom),.01,.99);
            if(m.along){const p=sceneMath.axisMove(x*drawW,y*drawH,(ev.clientX-sx)/state.zoom,(ev.clientY-sy)/state.zoom,a,drawW,drawH);m.x=p[0]/drawW;m.y=p[1]/drawH;}
            if(magnetic){const result=sceneMath.snapPosition(viewX(m.x),viewY(m.y),others.map(other=>({x:viewX(other.x),y:viewY(other.y),angle:other.angle})),drawW,drawH,10,[viewX(.01),viewY(.01),viewX(.99),viewY(.99)],[viewX(.5),viewY(.5)]);
              if(!m.along||Math.abs((result.x-viewX(x))*Math.sin(a)-(result.y-viewY(y))*Math.cos(a))<1e-6){m.x=(result.x/drawW-.5-state.pan[0])/state.zoom+.5;m.y=(result.y/drawH-.5-state.pan[1])/state.zoom+.5;snapped=result.snapped;snapHint=snapped?result.label:'';}}}
          line.classList.toggle('snapped',snapped);changed();};
        const end=ev=>{if(ev.pointerId!==e.pointerId)return;node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',end);if(node.hasPointerCapture(e.pointerId))node.releasePointerCapture(e.pointerId);line.classList.remove('snapped');snapHint='';if(!moved&&rotateMode&&ev.type==='pointerup')rotate(15);else{persist();request();}};
        node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);
      });
      node.oncontextmenu=e=>{e.preventDefault();m.on=!m.on;on.checked=m.on;changed();};
      node.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();
        if(rotateMode)rotate(e.key==='ArrowLeft'||e.key==='ArrowDown'?-5:5);
        else{stopPath(m);const step=e.shiftKey?20:4,dx=(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0)/state.zoom,dy=(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0)/state.zoom;
          if(m.along){const p=sceneMath.axisMove(m.x*drawW,m.y*drawH,dx,dy,m.angle,drawW,drawH);m.x=p[0]/drawW;m.y=p[1]/drawH;}else{m.x=clamp(m.x+dx/drawW,.01,.99);m.y=clamp(m.y+dy/drawH,.01,.99);}changed();}};
      if(rotateMode)node.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();rotate(Math.sign(e.deltaY)*5);},{passive:false});
    }
  }
  for(const [key,caption] of [['zero','Наклон 0'],['one','Наклон 1']]){
    const label=document.createElement('label'), input=document.createElement('input'), out=document.createElement('output'),wrap=document.createElement('span');wrap.className='zerk-range range-with-arrows';input.type='range';input.min='-60';input.max='60';input.step='1';input.value=state[key];input.setAttribute('aria-label',caption);out.textContent=state[key]+'°';label.append(document.createTextNode(caption),wrap,out);body.append(label);
    input.oninput=()=>{state[key]=Number(input.value);out.textContent=state[key]+'°';changed(true);};
    const step=delta=>{input.value=clamp(Number(input.value)+delta,-60,60);input.oninput();};
    button('◂',caption+': −1°',()=>step(-1),wrap);wrap.append(input);button('▸',caption+': +1°',()=>step(1),wrap);
  }
  for(const [key,caption] of [['tint','Цветные отражения'],['trace','Отрезки битов: 1 ↘, 0 ↗']]){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=state[key];input.setAttribute('aria-label',caption);input.title=key==='trace'?'Короткий отрезок внутри ячейки: 1 — наклон вправо вниз, 0 — вправо вверх':caption;label.append(input,document.createTextNode(caption));body.append(label);input.onchange=()=>{state[key]=input.checked;changed(key==='trace');};}
  button('Вернуть три зеркала','Вернуть начальные положения трёх зеркал',()=>{defaults().forEach((m,i)=>{stopPath(state.mirrors[i]);Object.assign(state.mirrors[i],m,{mode:'direct'});});state.mirrors.forEach((m,i)=>{Object.assign(controls[i].on,{checked:m.on});controls[i].color.value=m.color;controls[i].speed.value=m.speed;controls[i].section.style.setProperty('--mirror-color',m.color);controls[i].spin.textContent='▶';controls[i].spin.setAttribute('aria-pressed','false');});changed();},body);
  const groups=[], compactUpdates=[];
  function grape(id,title,color,home){
    const el=document.createElement('aside');el.id=id;el.className='zerk-grape sol-plate';el.style.setProperty('--mirror-color',color);
    const hd=document.createElement('div');hd.className='smh zerk-grape-head';const caption=document.createElement('span');caption.textContent=title;hd.append(caption);
    const fold=button('−','Свернуть / раскрыть '+title,()=>{},hd);fold.className='pminbtn';el.append(hd);
    const content=document.createElement('div');content.className='zerk-grape-body';el.append(content);stage.append(el);
    const place=node=>{const xy=Z[id+'XY']||(typeof home==='function'?home():home);node.style.left=clamp(xy[0],0,Math.max(0,stage.clientWidth-node.offsetWidth))+'px';node.style.top=clamp(xy[1],0,Math.max(0,stage.clientHeight-node.offsetHeight))+'px';};
    SOL_PLATES[id]={name:title,min:id+'Min',xy:id+'XY',col:color,place,init:plateSetup};plateInit(el);groups.push(el);
    hd.addEventListener('click',e=>{if(e.target.closest('button,input,select,textarea,label')||performance.now()<(el._solDragUntil||0))return;plateFoldToggle(el);});
    hd.tabIndex=0;hd.setAttribute('role','button');hd.setAttribute('aria-label','Раскрыть / свернуть '+title);hd.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();plateFoldToggle(el);}};
    return content;
  }
  function diamond(node,caption,parent){node.classList.add('zerk-diamond');if(node.tagName==='BUTTON')node.textContent=caption;const i=[...parent.children].filter(n=>n!==node).length;node.style.left=(i%2?24:0)+'px';node.style.top=(i*24)+'px';parent.append(node);parent.style.setProperty('--grape-height',(i*24+48)+'px');return node;}
  function editor(nodes){const el=document.createElement('div');el.className='zerk-editor';el.hidden=true;for(const n of nodes)el.append(n);body.append(el);return el;}
  function openEditor(el,caption,anchor){for(const v of body.children)v.hidden=v!==el;tools.hidden=false;tools.querySelector('.smh span').textContent=caption;
    Z.zerkToolsMin=false;plateFoldSync(tools);const close=tools.querySelector('.pminbtn');close.textContent='×';close.setAttribute('aria-label','Закрыть настройку');const r=anchor.getBoundingClientRect(),s=stage.getBoundingClientRect();Z.zerkToolsXY=[r.right-s.left+8,r.top-s.top];plateZig(tools,'#70e0d7');placeTools(tools);}
  function editDiamond(caption,title,el,parent){let b; b=button(caption,title,()=>openEditor(el,title,b),parent);return diamond(b,caption,parent);}
  // Controls remain the same inputs and handlers; diamonds open only the needed editor.
  const oldActions=[...actions.children], oldView=[...body.children].filter(n=>n!==sourceLabel&&n!==own&&n!==actions&&!n.classList.contains('zerk-mirror-controls'));
  const sourceEditor=editor([sourceLabel,own]), rowGroup=grape('zerkRowsG','Строки','#70e0d7',[8,8]);
  const sourceDiamond=editDiamond('△\nузор','Выбрать источник строк',sourceEditor,rowGroup);
  compactUpdates.push(()=>{sourceDiamond.textContent=({serp:'△\nСерп.',base:'◇\nхаб',field:'≡\nполе',own:'↥\nсвои'})[state.source];});
  let ownDiamond;ownDiamond=button('↥\nсвои','Вставить или загрузить свои строки',()=>{source.value=state.source='own';own.hidden=false;changed(true);openEditor(sourceEditor,'Свои строки · TXT / JSON',ownDiamond);},rowGroup);diamond(ownDiamond,'↥\nсвои',rowGroup);
  for(const [i,caption] of ['≡\nкопия','↦\nв поле','▣\nPNG'].entries())diamond(oldActions[i],caption,rowGroup);actions.remove();
  buildSceneEditor(rowGroup);
  buildPngEditor(oldActions[2]);
  function splitDiamond(title,get,step,parent){
    const node=document.createElement('div');node.className='zerk-split';const value=document.createElement('span');value.className='zerk-split-value';node.append(value);
    const minus=button('◂',title+': уменьшить',()=>step(-1),node),plus=button('▸',title+': увеличить',()=>step(1),node);minus.className='zerk-half zerk-half-minus';plus.className='zerk-half zerk-half-plus';diamond(node,'',parent);
    node.title=title+' · наведи и нажми левую или правую половину';compactUpdates.push(()=>value.textContent=get());return node;
  }
  state.mirrors.forEach((m,i)=>{
    const c=controls[i],home=()=>stage.clientWidth>600?[100+136*i,8]:i===0?[100,8]:[8+(i-1)*144,248];
    const group=grape('zerkMirrorG'+(i+1),'Зеркало '+(i+1),m.color,home),head=group.parentElement.querySelector('.smh');group.parentElement.classList.add('zerk-speed-group');
    const enabled=c.on.closest('label');diamond(enabled,(i+1)+'',group);for(const n of [...enabled.childNodes])if(n.nodeType===3)n.textContent='◇\n'+(i+1);
    const swatch=document.createElement('label');swatch.setAttribute('aria-label','Выбор цвета зеркала '+(i+1));const textColor=document.createElement('span');textColor.textContent='●\nцвет';swatch.append(c.color,textColor);diamond(swatch,'',group);
    const rotate=sign=>{stopPath(m);m.spin=false;m.angle=norm(m.angle+sign*pi/180);c.spin.textContent='▶';c.spin.setAttribute('aria-pressed','false');changed();};
    splitDiamond('Угол зеркала '+(i+1),()=>Math.round(norm(m.angle)*180/pi)%180+'°',rotate,group);
    diamond(c.spin,m.spin?'Ⅱ':'▶',group);
    splitDiamond('Скорость зеркала '+(i+1),()=>m.speed+'\n°/с',sign=>{m.speed=clamp(m.speed+sign,-90,90);c.speed.value=m.speed;changed();},group);
    const speedWrap=document.createElement('span');speedWrap.className='zerk-header-speed range-with-arrows';
    const speedSlider=document.createElement('input');speedSlider.type='range';speedSlider.min=-90;speedSlider.max=90;speedSlider.step=1;speedSlider.value=m.speed;speedSlider.setAttribute('aria-label','Ползунок скорости зеркала '+(i+1));speedWrap.append(speedSlider);head.append(speedWrap);
    speedSlider.oninput=()=>{m.speed=Number(speedSlider.value);c.speed.value=m.speed;changed();};speedSlider.addEventListener('pointerdown',e=>e.stopPropagation());speedSlider.addEventListener('click',e=>e.stopPropagation());
    const modes=['direct','inv','reverse','both'],captions=['→\nпрям','¬\nинв','⇄\nрев','¬⇄\nоба'];
    const modeNode=splitDiamond('Режим зеркала '+(i+1),()=>captions[modes.indexOf(m.mode)],sign=>{m.mode=modes[(modes.indexOf(m.mode)+sign+4)%4];changed();},group);
    modeNode.classList.add('is-selected');
    compactUpdates.push(()=>{modeNode.setAttribute('aria-label','Режим зеркала '+(i+1)+': '+({direct:'прямой',inv:'инверсия',reverse:'реверс',both:'инверсия и реверс'})[m.mode]);});
    buildPathEditor(m,i,group);c.section.remove();
    let along;along=button('↔\nось','Перетаскивать зеркало '+(i+1)+' только вдоль его оси',()=>{m.along=!m.along;changed();},group);diamond(along,'↔\nось',group);along.style.left='48px';along.style.top='144px';group.style.setProperty('--grape-height','192px');
    compactUpdates.push(()=>{along.classList.toggle('on',!!m.along);along.setAttribute('aria-pressed',String(!!m.along));});
    compactUpdates.push(()=>{group.parentElement.style.setProperty('--mirror-color',m.color);group.parentElement.style.setProperty('--control-color',sceneMath.controlColor(m.color));speedSlider.value=m.speed;c.spin.classList.toggle('on',m.spin);c.spin.textContent=m.spin?'Ⅱ':'▶';c.spin.setAttribute('aria-pressed',String(m.spin));});
  });
  const viewGroup=grape('zerkViewG','Вид','#c9a8ff',()=>stage.clientWidth>600?[8,248]:[stage.clientWidth-104,8]);
  for(const [i,n] of oldView.entries()){
    if(i<2){const label=['Наклон 0','Наклон 1'][i],el=editor([n]);editDiamond('↶\n'+i,label,el,viewGroup);}
    else if(i<4){diamond(n,'',viewGroup);for(const t of [...n.childNodes])if(t.nodeType===3)t.textContent=i===2?'◈\nцвет':'╲ 1\n╱ 0';}
    else diamond(n,'↺\nсброс',viewGroup);
  }
  buildCycleEditor(viewGroup);
  const labelToggle=button('Аа\nподп.','Подписи зеркал и холстов',()=>{state.labels=!state.labels;changed();},viewGroup);diamond(labelToggle,'Аа\nподп.',viewGroup);
  compactUpdates.push(()=>{labelToggle.classList.toggle('on',state.labels);labelToggle.setAttribute('aria-pressed',String(state.labels));});
  const magnetToggle=button('🧲\nмагн.','Магнит зеркал: центры, середины и половины линий; углы 30°, 45°, 60°, 90°',()=>{state.magnet=!state.magnet;changed();},viewGroup);diamond(magnetToggle,'🧲\nмагн.',viewGroup);
  magnetToggle.style.left='48px';magnetToggle.style.top=labelToggle.style.top;viewGroup.style.setProperty('--grape-height',(Number.parseFloat(labelToggle.style.top)+48)+'px');viewGroup.parentElement.classList.add('zerk-view-group');
  compactUpdates.push(()=>{magnetToggle.classList.toggle('on',state.magnet);magnetToggle.setAttribute('aria-pressed',String(state.magnet));});
  const bitsToggle=button('01\nбиты','Только цифры 0 и 1 без ромбов и заливки',()=>{state.bitsOnly=!state.bitsOnly;body.querySelector('input[aria-label="Только биты 0 / 1"]').checked=state.bitsOnly;changed(true);},viewGroup);diamond(bitsToggle,'01\nбиты',viewGroup);bitsToggle.style.left='48px';bitsToggle.style.top='0px';viewGroup.style.setProperty('--grape-height',(Number.parseFloat(labelToggle.style.top)+48)+'px');
  compactUpdates.push(()=>{bitsToggle.classList.toggle('on',state.bitsOnly);bitsToggle.setAttribute('aria-pressed',String(state.bitsOnly));});
  const zenToggle=button('◎\nдзен','Дзен: Зеркалиус на весь экран',()=>window.zenSet?.(true,'w-zerkalius'),viewGroup);diamond(zenToggle,'◎\nдзен',viewGroup);zenToggle.style.left='48px';zenToggle.style.top='48px';viewGroup.style.setProperty('--grape-height',(Number.parseFloat(labelToggle.style.top)+48)+'px');
  const overlapToggle=button('⋂\nперес.','Только пересечения фигур: скрыть участки без наложения',()=>{state.overlapOnly=!state.overlapOnly;changed();},viewGroup);diamond(overlapToggle,'⋂\nперес.',viewGroup);overlapToggle.style.left='48px';overlapToggle.style.top='96px';viewGroup.style.setProperty('--grape-height',(Number.parseFloat(labelToggle.style.top)+48)+'px');
  compactUpdates.push(()=>{overlapToggle.classList.toggle('on',state.overlapOnly);overlapToggle.setAttribute('aria-pressed',String(state.overlapOnly));});
  const zenExit=button('↙','Выйти из дзена Зеркалиуса',()=>window.zenSet?.(false),stage);zenExit.id='zerkZenExit';
  const annotations=document.createElement('div');annotations.className='zerk-annotations';annotations.hidden=!state.labels;stage.append(annotations);
  const annotationNodes=Array.from({length:6},()=>{const el=document.createElement('span');el.className='zerk-annotation';annotations.append(el);return el;});
  tools.hidden=true;tools.querySelector('.pminbtn').textContent='×';tools.querySelector('.pminbtn').setAttribute('aria-label','Закрыть настройку');tools.querySelector('.pminbtn').onclick=e=>{e.stopPropagation();tools.hidden=true;};
  document.addEventListener('pointerdown',e=>{if(!tools.hidden&&!tools.contains(e.target)&&!e.target.closest('.zerk-grape'))tools.hidden=true;});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')tools.hidden=true;});
  const zoomBox=document.createElement('div');zoomBox.id='zerkZoom';stage.append(zoomBox);
  const zoomOut=button('−','Уменьшить масштаб Зеркалиуса',()=>zoomBy(1/1.15),zoomBox);zoomOut.className='zerk-zoom-minus';
  const zoomValue=document.createElement('output');zoomValue.setAttribute('aria-label','Масштаб Зеркалиуса');zoomBox.append(zoomValue);
  const zoomIn=button('+','Увеличить масштаб Зеркалиуса',()=>zoomBy(1.15),zoomBox);zoomIn.className='zerk-zoom-plus';
  zoomValue.title='Двойной щелчок — вернуть 100%';zoomValue.ondblclick=()=>{state.zoom=1;state.pan=[0,0];changed();};
  const viewX=x=>drawW*(.5+state.pan[0]+(x-.5)*state.zoom),viewY=y=>drawH*(.5+state.pan[1]+(y-.5)*state.zoom);
  function zoomBy(factor,x=drawW/2,y=drawH/2){if(!drawW||!drawH)return;const before=state.zoom,next=clamp(before*factor,.2,6),ratio=next/before;
    state.pan=[(x-drawW/2-(x-drawW/2-state.pan[0]*drawW)*ratio)/drawW,(y-drawH/2-(y-drawH/2-state.pan[1]*drawH)*ratio)/drawH];state.zoom=next;changed();}
  stage.addEventListener('wheel',e=>{if(e.target.closest('#zerkTools,.zerk-grape,#zerkZoom')||!e.deltaY)return;e.preventDefault();e.stopPropagation();const r=stage.getBoundingClientRect(),delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?drawH:1);zoomBy(Math.exp(-clamp(delta,-120,120)*.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
  stage.addEventListener('pointerdown',e=>{
    if(![0,1].includes(e.button)||e.target.closest('button,input,select,textarea,.zerk-axis,.zerk-grape .smh,.zerk-diamond,#zerkTools'))return;e.preventDefault();e.stopPropagation();stage.classList.add('panning');stage.setPointerCapture(e.pointerId);
    const sx=e.clientX,sy=e.clientY,start=state.pan.slice();let moved=false;
    const move=ev=>{if(ev.pointerId!==e.pointerId)return;if(Math.hypot(ev.clientX-sx,ev.clientY-sy)>4)moved=true;if(moved){state.pan=[start[0]+(ev.clientX-sx)/drawW,start[1]+(ev.clientY-sy)/drawH];changed();}};
    const end=ev=>{if(ev.pointerId!==e.pointerId)return;stage.removeEventListener('pointermove',move);stage.removeEventListener('pointerup',end);stage.removeEventListener('pointercancel',end);if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);stage.classList.remove('panning');if(e.button===1&&!moved&&ev.type==='pointerup')window.zenSet?.(!document.body.classList.contains('zerk-zen'),'w-zerkalius');};
    stage.addEventListener('pointermove',move);stage.addEventListener('pointerup',end);stage.addEventListener('pointercancel',end);
  });
  stage.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault();});
  stage.addEventListener('mousedown',e=>{if(e.button===1)e.preventDefault();});
  window.zzZerkaliusKey=e=>{if(e.ctrlKey||e.altKey||e.metaKey||e.target.closest('input,textarea,select,button'))return false;const step=40*(e.shiftKey?4:1),delta={ArrowLeft:[step,0],ArrowRight:[-step,0],ArrowUp:[0,step],ArrowDown:[0,-step]}[e.key],factor={'+':1.2,'=':1.2,'-':1/1.2,'_':1/1.2}[e.key];if(!delta&&!factor)return false;e.preventDefault();if(delta){state.pan=[state.pan[0]+delta[0]/drawW,state.pan[1]+delta[1]/drawH];changed();}else zoomBy(factor);return true;};
  function field(parent,title,type,value,choices){
    const label=document.createElement('label'),input=document.createElement(choices?'select':'input');label.append(document.createTextNode(title));
    if(choices)for(const [v,t] of choices){const o=document.createElement('option');o.value=v;o.textContent=t;input.append(o);}else input.type=type;
    input.value=value;if(type==='checkbox')input.checked=!!value;input.setAttribute('aria-label',title);label.append(input);parent.append(label);return input;
  }
  function numberField(parent,title,value,min,max,step=1){const el=field(parent,title,'number',value);Object.assign(el,{min,max,step});return el;}
  function textBlock(parent,text){const el=document.createElement('p');el.className='zerk-help';el.textContent=text;parent.append(el);return el;}
  function buildSceneEditor(parent){
    const el=editor([]),build=field(el,'Построение','',state.build,[['axes','Оси и треугольники'],['net','Развёртка']]);
    const bitsOnly=field(el,'Только биты 0 / 1','checkbox',state.bitsOnly);bitsOnly.onchange=()=>{state.bitsOnly=bitsOnly.checked;changed(true);};
    const font=field(el,'Шрифт битов','',state.font,fonts);font.onchange=()=>{state.font=font.value;changed(true);document.fonts.load('12px '+state.font).then(()=>changed(true));};
    const bitColor=field(el,'Цвет исходных битов','color',state.bitColor);bitColor.oninput=()=>{state.bitColor=bitColor.value;state.palette='custom';changed(true);};
    const palette=field(el,'Цветовая заготовка','',state.palette||'custom',[['custom','Свои цвета'],['classic','Бирюза / золото / розовый'],['ice','Лёд / синий / сиреневый'],['fire','Пламя / оранжевый / фиолетовый'],['forest','Зелень / лайм / янтарь'],['mono','Светлые / серые']]);compactUpdates.push(()=>palette.value=state.palette||'custom');
    const palettes={classic:['#70e0d7','#ffd166','#ed8fea','#9fffc8','#4dd4ff','#e8b64a'],ice:['#a1e9ff','#5da8ff','#bbadff','#e0f6ff','#a1e9ff','#5da8ff'],fire:['#ff6565','#ffae52','#d589ff','#ffcfaa','#ff6565','#ffae52'],forest:['#6be3a4','#b6de6b','#e8bd68','#caffac','#6be3a4','#e8bd68'],mono:['#eeeeee','#aaaaaa','#777777','#ffffff','#eeeeee','#aaaaaa']};
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
      state.mirrors.forEach((m,i)=>{stopPath(m);m.spin=false;m.x=cx;m.y=.52;m.angle=state.layout==='quad'?norm(i*pi/2):i*pi/3;m.on=i<count;controls[i].on.checked=m.on;});changed();},axes);
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
    const show=()=>{axes.hidden=state.build==='net';net.hidden=state.build!=='net';refresh();plateZig(tools,'#70e0d7');placeTools(tools);};build.onchange=()=>{state.build=build.value;show();changed(true);};show();
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
        const camera=out.frame==='scene'?[scale,0,0,scale,(out.width-(b[2]-b[0])*scale)/2-b[0]*scale,(out.height-(b[3]-b[1])*scale)/2-b[1]*scale]:[out.width/drawW*state.zoom,0,0,out.height/drawH*state.zoom,out.width*(.5+state.pan[0]-.5*state.zoom),out.height*(.5+state.pan[1]-.5*state.zoom)];
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
  function sourceImage(R,color,dw,ratio){
    const dh=dw*Math.sqrt(3), shapes=[],vertices=[],bounds=[Infinity,Infinity,-Infinity,-Infinity];
    const include=(x,y)=>{vertices.push([x,y]);bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);};
    for(let r=0;r<R.length;r++)for(let j=0;j<R[r].length;j++){
      const bit=R[r][j],x=-(R[r].length-1)*dw/2+j*dw,y=r*dh/2,a=state[bit==='0'?'zero':'one']*pi/180,c=Math.cos(a),sn=Math.sin(a);
      shapes.push([bit,x,y,a]);for(const [u,v] of [[0,-dh*.45],[dw*.45,0],[0,dh*.45],[-dw*.45,0]])include(x+u*c-v*sn,y+u*sn+v*c);
    }
    bounds[0]-=2;bounds[1]-=2;bounds[2]+=2;bounds[3]+=2;
    const image=document.createElement('canvas'),w=bounds[2]-bounds[0],h=bounds[3]-bounds[1],safe=Math.min(ratio,8192/Math.max(w,h),Math.sqrt(16000000/(w*h)));
    image.width=Math.max(1,Math.ceil(w*safe));image.height=Math.max(1,Math.ceil(h*safe));const ctx=image.getContext('2d');ctx.setTransform(safe,0,0,safe,-bounds[0]*safe,-bounds[1]*safe);
    const fs=state.bitsOnly?dw*.72:Math.max(5,dw*.62),digits=state.bitsOnly||dw*safe>=7;ctx.font='bold '+fs+'px '+state.font;ctx.textAlign='center';ctx.textBaseline='middle';
    for(const [bit,x,y,a] of shapes){ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.globalAlpha=bit==='1'?.42:.11;ctx.fillStyle=color;if(!state.bitsOnly){ctx.beginPath();ctx.moveTo(0,-dh*.45);ctx.lineTo(dw*.45,0);ctx.lineTo(0,dh*.45);ctx.lineTo(-dw*.45,0);ctx.closePath();ctx.fill();}
      if(state.bitsOnly){ctx.globalAlpha=bit==='1'?1:.6;ctx.fillStyle=color;ctx.fillText(bit,0,fs*.06);}
      else if(state.trace){const sign=bit==='1'?1:-1;ctx.globalAlpha=bit==='1'?.95:.55;ctx.strokeStyle=color;ctx.lineWidth=Math.max(.65,dw*.08);ctx.beginPath();ctx.moveTo(-dw*.22,-sign*dh*.22);ctx.lineTo(dw*.22,sign*dh*.22);ctx.stroke();}
      else if(digits){ctx.globalAlpha=bit==='1'?.9:.35;ctx.fillStyle=bit==='1'?'#06150d':color;ctx.fillText(bit,0,fs*.06);}ctx.restore();}
    return {image,bounds,polygons:[figureHull(vertices)]};
  }
  function netGeometry(preset=state.net.preset){
    const [tree,C]=(state.net.nb===4?RAZV_V:RAZV_V3)[preset],{F,pos}=razvUnfold(tree,state.net.nb);
    const faces=Object.keys(pos).map(name=>({name,up:name[0]==='U',P:F[name].map(v=>pos[name][v])}));let center;
    if(C[0]==='v')center=pos[C[1]][C[2]];
    else{const points=C[0]==='e'?[pos[C[1]][C[2]],pos[C[1]][C[3]]]:Object.values(pos[C[1]]);center=[0,1].map(i=>points.reduce((n,p)=>n+p[i],0)/points.length);}
    const bounds=[Infinity,Infinity,-Infinity,-Infinity];for(const f of faces)for(const p of f.P){bounds[0]=Math.min(bounds[0],p[0]);bounds[1]=Math.min(bounds[1],p[1]);bounds[2]=Math.max(bounds[2],p[0]);bounds[3]=Math.max(bounds[3],p[1]);}return {faces,bounds,center};
  }
  function netFaces(ctx,model,bits,scale,labels,preview=false){
    const R=bits.length,cell=scale/R;ctx.textAlign='center';ctx.textBaseline='middle';
    for(const f of model.faces){const col=f.up?state.net.up:state.net.down,[A,L,B]=f.P;ctx.fillStyle=col;ctx.strokeStyle=col;
      if(!state.bitsOnly||preview){ctx.beginPath();ctx.moveTo(...A);ctx.lineTo(...L);ctx.lineTo(...B);ctx.closePath();ctx.globalAlpha=.1;ctx.fill();ctx.globalAlpha=1;ctx.lineWidth=(preview?1:1.4)/scale;ctx.stroke();}
      if(!preview)for(let r=0;r<R;r++)for(let k=0;k<=r;k++){const bit=bits[r][k]^(f.up?0:1),a=(r-k+1/3)/R,b=(k+1/3)/R,x=A[0]+a*(L[0]-A[0])+b*(B[0]-A[0]),y=A[1]+a*(L[1]-A[1])+b*(B[1]-A[1]);
        ctx.globalAlpha=bit?1:.45;ctx.fillStyle=col;
        if(state.bitsOnly){ctx.font='700 '+(.72/R)+'px '+state.font;ctx.fillText(String(bit),x,y);}
        else{const rad=(bit?Math.max(.7,cell*.3):cell*.12)/scale;if(!bit&&rad*scale<.8)continue;ctx.beginPath();ctx.arc(x,y,rad,0,2*pi);ctx.fill();}}
      if(labels&&!preview&&!state.bitsOnly){const x=(A[0]+L[0]+B[0])/3,y=(A[1]+L[1]+B[1])/3;ctx.globalAlpha=1;ctx.font='700 '+(12/scale)+'px system-ui';ctx.lineWidth=3/scale;ctx.strokeStyle='#000';ctx.strokeText(f.name,x,y);ctx.fillStyle='#fff';ctx.fillText(f.name,x,y);}
    }ctx.globalAlpha=1;
  }
  function netPreview(canvas,preset){const model=netGeometry(preset),b=model.bounds,scale=Math.min(48/(b[2]-b[0]),40/(b[3]-b[1])),ctx=canvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,56,48);ctx.setTransform(scale,0,0,scale,28-(b[0]+b[2])*scale/2,24-(b[1]+b[3])*scale/2);netFaces(ctx,model,[],scale,false,true);}
  function netImage(pattern,scale,ratio){const model=netGeometry(),b=model.bounds,pad=5/scale,bounds=[(b[0]-pad)*scale,(b[1]-pad)*scale,(b[2]+pad)*scale,(b[3]+pad)*scale],w=bounds[2]-bounds[0],h=bounds[3]-bounds[1],safe=Math.min(ratio,8192/Math.max(w,h),Math.sqrt(16000000/(w*h))),image=document.createElement('canvas');image.width=Math.max(1,Math.ceil(w*safe));image.height=Math.max(1,Math.ceil(h*safe));const ctx=image.getContext('2d');ctx.setTransform(scale*safe,0,0,scale*safe,-bounds[0]*safe,-bounds[1]*safe);netFaces(ctx,model,sceneMath.faceRows(pattern),scale,state.net.labels);return {image,bounds,polygons:model.faces.map(f=>f.P.map(p=>p.map(v=>v*scale)))};}
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
      const model=netGeometry(),b=model.bounds,reserve=drawW>650&&!document.body.classList.contains('zerk-zen')?250:0,W=drawW-reserve,scale=Math.max(1,Math.min(W*.8/(b[2]-b[0]),drawH*.8/(b[3]-b[1]))),place=sceneMath.placement(reserve+W/2-(b[0]+b[2])*scale/2,drawH/2-(b[1]+b[3])*scale/2,0),items=[];
      const reflected=sceneMath.copies(state.mirrors.map(m=>({...m,x:m.x*drawW,y:m.y*drawH})),ZZMirrorGeometry.matrix);
      for(const c of reflected){const pattern=sceneMath.transformRows(rows(),reflectedMode(c.mask)),key=JSON.stringify(['net',pattern,state.net.nb,state.net.preset,state.net.up,state.net.down,state.net.labels,state.bitsOnly,state.font,scale,ratio]);let src=sourceCache.get(key);if(!src){src=netImage(pattern,scale,ratio);sourceCache.set(key,src);}items.push({src,bounds:src.bounds,matrix:sceneMath.multiply(c.matrix,place),mask:c.mask});}
      return {items,bounds:sceneMath.bounds(items),count:1,labels:[{point:sceneMath.point(place,...model.center.map(v=>v*scale)),text:'Холст · развёртка',color:state.net.up}]};
    }
    const reserve=drawW>650&&!document.body.classList.contains('zerk-zen')?250:0,W=drawW-reserve,cx=reserve+W/2,cy=drawH*.52,count=state.layout==='quad'?2:state.layout==='tri'?3:1,items=[],labels=[];
    const reflected=sceneMath.copies(state.mirrors.map(m=>({...m,x:m.x*drawW,y:m.y*drawH})),ZZMirrorGeometry.matrix);
    for(let i=0;i<count;i++){
      const R=count===1?rows():setRows(i),N=Math.max(1,R.length),max=Math.max(1,...R.map(s=>s.length)),color=count===1?state.bitColor:state.sets[i].color;
      const dw=count===1?Math.min(W*.92/max,(drawH-24)/((N+1)*.866)):Math.min(W,drawH)*.39/Math.max(N*.866,max*.5);
      const variants=new Map();for(const c of reflected){const mode=state.mirrors.reduce((v,m,j)=>v^((c.mask&(1<<j))?({direct:0,inv:1,reverse:2,both:3})[m.mode]:0),0);if(!variants.has(mode)){
        const pattern=mode?sceneMath.transformRows(R,mode):R,key=JSON.stringify([pattern,color,dw,state.zero,state.one,state.trace,state.bitsOnly,state.font,ratio]);let src=sourceCache.get(key);if(!src){src=sourceImage(pattern,color,dw,ratio);sourceCache.set(key,src);}variants.set(mode,src);
      }}
      for(let k=0;k<(count===1?1:state.mult);k++){
        const angle=(state.layout==='quad'?i*pi/2:i*pi/3)-pi/2+k*2*pi/state.mult;
        const place=count===1?sceneMath.placement(cx,12+dw*Math.sqrt(3)/2,0):sceneMath.placement(cx,cy,angle);
        if(k===0)labels.push({point:sceneMath.point(place,0,(N-1)*dw*Math.sqrt(3)*.3),text:count===1?'Холст':'Холст '+(i+1),color});
        for(const c of reflected){const mode=state.mirrors.reduce((v,m,j)=>v^((c.mask&(1<<j))?({direct:0,inv:1,reverse:2,both:3})[m.mode]:0),0),src=variants.get(mode);items.push({src,bounds:src.bounds,matrix:sceneMath.multiply(c.matrix,place),mask:c.mask});}
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
    const scratch=tintCanvas,sc=tintContext,paths=state.overlapOnly?overlapPaths(data.items):null;let lastSrc=null,lastMask=-1;
    for(const [index,item] of data.items.entries()){
      if(paths){const others=new Path2D();paths.forEach((path,j)=>{if(j!==index)others.addPath(path);});ctx.save();ctx.setTransform(...camera);ctx.clip(paths[index]);ctx.clip(others);}
      let image=item.src.image;if(state.tint&&item.mask){
      if(lastSrc!==item.src||lastMask!==item.mask){scratch.width=image.width;scratch.height=image.height;sc.drawImage(image,0,0);sc.globalCompositeOperation='source-atop';for(let i=0;i<3;i++)if(item.mask&(1<<i)){sc.globalAlpha=.38;sc.fillStyle=state.mirrors[i].color;sc.fillRect(0,0,scratch.width,scratch.height);}sc.globalAlpha=1;sc.globalCompositeOperation='source-over';lastSrc=item.src;lastMask=item.mask;}image=scratch;
      }
      const b=item.bounds;ctx.setTransform(...sceneMath.multiply(camera,item.matrix));ctx.drawImage(image,b[0],b[1],b[2]-b[0],b[3]-b[1]);if(paths)ctx.restore();
    }ctx.setTransform(1,0,0,1,0,0);
  }
  function render(){
    if(!visible())return;const r=stage.getBoundingClientRect();if(r.width<10||r.height<10)return;drawW=r.width;drawH=r.height;dpr=Math.min(2,devicePixelRatio||1);
    const key=Math.round(drawW*dpr)+'x'+Math.round(drawH*dpr),next=JSON.stringify([rows(),state.sets.map((_,i)=>setRows(i))]);
    if(key!==geometry){geometry=key;cv.width=Math.round(drawW*dpr);cv.height=Math.round(drawH*dpr);dirty=true;plateZig(tools,'#70e0d7');}
    if(next!==rowsKey){rowsKey=next;dirty=true;}if(dirty){sourceCache.clear();dirty=false;}
    const data=scene();g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,cv.width,cv.height);
    paint(g,data,[dpr*state.zoom,0,0,dpr*state.zoom,dpr*drawW*(.5+state.pan[0]-.5*state.zoom),dpr*drawH*(.5+state.pan[1]-.5*state.zoom)]);
    state.mirrors.forEach((m,i)=>{const {line,center,turn}=handles[i],ctl=controls[i],length=Math.hypot(drawW,drawH)*2+40;
      line.classList.toggle('off',!m.on);line.style.setProperty('--mirror-color',m.color);line.style.setProperty('--control-color',sceneMath.controlColor(m.color));Object.assign(line.style,{width:length+'px',left:(viewX(m.x)-length/2)+'px',top:(viewY(m.y)-16)+'px',transform:'rotate('+m.angle+'rad)'});
      center.style.left=(length/2-center.offsetWidth/2+(i-1)*40)+'px';center.style.transform='rotate('+(-m.angle)+'rad)';turn.style.left=(length/2+Math.min(drawW,drawH)*.18)+'px';turn.style.transform='rotate('+(-m.angle)+'rad)';const deg=Math.round(m.angle*180/pi)%180;ctl.angle.value=deg;ctl.output.textContent=deg+'°';});
    annotations.hidden=!state.labels;
    if(state.labels){const distance=Math.min(drawW,drawH)*.18,names=state.mirrors.map((m,i)=>({x:viewX(m.x)+Math.cos(m.angle)*distance,y:viewY(m.y)+Math.sin(m.angle)*distance+20,text:'Зеркало '+(i+1),color:m.color,off:!m.on}));
      for(const label of data.labels)names.push({x:viewX(label.point[0]/drawW),y:viewY(label.point[1]/drawH),text:label.text,color:label.color});
      const placed=[];annotationNodes.forEach((el,i)=>{const n=names[i];el.hidden=!n;if(!n)return;el.textContent=n.text;const w=el.offsetWidth,h=el.offsetHeight;
        if(i>=3){while(placed.some(p=>Math.abs(p.x-n.x)<(p.w+w)/2+3&&Math.abs(p.y-n.y)<h+3))n.y+=h+3;placed.push({x:n.x,y:n.y,w});}
        el.style.left=n.x+'px';el.style.top=n.y+'px';el.style.color=sceneMath.controlColor(n.color);el.classList.toggle('off',!!n.off);});}
    compactUpdates.forEach(update=>update());groups.forEach(el=>platePlace(el));zoomValue.textContent=Math.round(state.zoom*100)+'%';zoomOut.disabled=state.zoom<=.2;zoomIn.disabled=state.zoom>=6;
    const moving=state.mirrors.filter(m=>m.on&&m.path.enabled).length,mirrorCount=state.mirrors.filter(m=>m.on).length,message=snapHint?'🧲 '+snapHint:notice||data.count+(data.count===1?' набор':' набора')+' · ×'+(data.count===1?1:state.mult)+' · '+mirrorCount+(mirrorCount===1?' зеркало':mirrorCount===0?' зеркал':' зеркала')+(state.overlapOnly?' · только пересечения':'')+(moving?' · '+moving+' по кривым':' · колесо — масштаб; нажатие — дзен');if(status.textContent!==message)status.textContent=message;platePlace(tools);
  }
  function tick(now){raf=0;if(!visible()){previous=0;return;}const dt=previous?Math.max(0,(now-previous)/1000):0;previous=now;
    const spinning=state.mirrors.some(m=>m.on&&(m.spin||m.path.enabled));for(const m of state.mirrors)if(m.on){
      if(m.path.enabled){try{const p=m.path;if(!Number.isFinite(p.anchorX)||!Number.isFinite(p.anchorY)||!Number.isFinite(p.anchorAngle))anchorPath(m);p.elapsed+=dt;const v=pathValue(m),ay=p.kind==='circle'?p.ampX*drawW/Math.max(1,drawH):p.ampY;m.x=p.anchorX+v[0]*p.ampX;m.y=p.anchorY+v[1]*ay;m.angle=norm(p.anchorAngle+v[2]);}catch(e){stopPath(m);notify('Кривая остановлена: '+e.message);persist();}}
      else if(m.spin)m.angle=norm(m.angle+m.speed*pi/180*dt);
    }
    render();if(spinning)raf=requestAnimationFrame(tick);else previous=0;
  }
  function request(){if(!raf&&visible())raf=requestAnimationFrame(tick);}
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
