/* v0.1116: Зеркалиус — рисунок хаба, свои строки, три передвижных цветных зеркала. */
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
  if (!Array.isArray(state.rows)) state.rows = ZZ_INITIAL_ROWS.slice();
  const old = Array.isArray(state.mirrors) ? state.mirrors : [];
  state.mirrors = defaults().map((m,i) => {
    const v = old[i] || {};
    for (const k of ['x','y','angle','speed']) if (Number.isFinite(v[k])) m[k] = v[k];
    m.x=clamp(m.x,.01,.99);m.y=clamp(m.y,.01,.99);m.angle=norm(m.angle);m.speed=clamp(m.speed,-90,90);
    if (/^#[0-9a-f]{6}$/i.test(v.color)) m.color=v.color;
    m.on=v.on!==false;m.spin=!!v.spin;return m;
  });
  const base = document.createElement('canvas'), copy = document.createElement('canvas'), controls = [], handles = [];
  const g = cv.getContext('2d'), bg = base.getContext('2d'), cg = copy.getContext('2d');
  let raf = 0, previous = 0, dirty = true, geometry = '', rowsKey = '', drawW = 0, drawH = 0, dpr = 1;
  let persistTimer = 0, notice = '';
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
  SOL_PLATES.zerkTools={name:'Зеркалиус · три зеркала',min:'zerkToolsMin',xy:'zerkToolsXY',col:'#70e0d7',place:placeTools,init:el=>{
    const hd=el.querySelector('.smh');hd.title='Тяни шапку — переместить панель; − / + — свернуть или открыть';
    el.querySelector('.pminbtn').onclick=e=>{e.stopPropagation();plateFoldToggle(el);};
    hd.addEventListener('pointerdown',e=>{
      if(e.button!==0||e.target.closest('button'))return;e.preventDefault();e.stopPropagation();hd.setPointerCapture(e.pointerId);
      const start=[e.clientX,e.clientY],r0=el.getBoundingClientRect();let moved=false;
      const move=ev=>{if(ev.pointerId!==e.pointerId)return;if(!moved&&Math.hypot(ev.clientX-start[0],ev.clientY-start[1])<4)return;
        if(!moved){moved=true;el.classList.add('pdrag');document.body.classList.add('cgdrag');window.zzPanelDragStart?.(el,e.altKey);}
        const [x,y]=plateSnap(el,r0,ev.clientX-start[0],ev.clientY-start[1]),host=stage.getBoundingClientRect();
        Z.zerkToolsXY=[x-host.left,y-host.top];placeTools(el);window.zzPanelLinkSync?.();};
      const end=ev=>{if(ev.pointerId!==e.pointerId)return;hd.removeEventListener('pointermove',move);hd.removeEventListener('pointerup',end);hd.removeEventListener('pointercancel',end);if(hd.hasPointerCapture(e.pointerId))hd.releasePointerCapture(e.pointerId);
        if(moved){el.classList.remove('pdrag');document.body.classList.remove('cgdrag');window.zzPanelDragEnd?.(el);zSnapGlow([]);save();}};
      hd.addEventListener('pointermove',move);hd.addEventListener('pointerup',end);hd.addEventListener('pointercancel',end);
    });
  }};
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
  button('PNG','Сохранить зеркальное построение в PNG',()=>{render();cv.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='zerkalius-three-mirrors.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});},actions);
  for(let i=0;i<3;i++){
    const m=state.mirrors[i], section=document.createElement('div');section.className='zerk-mirror-controls';section.dataset.mirror=String(i+1);section.style.setProperty('--mirror-color',m.color);
    const row=document.createElement('div');row.className='zerk-row';section.append(row);
    const on=document.createElement('input');on.type='checkbox';on.checked=m.on;on.setAttribute('aria-label','Зеркало '+(i+1)+' включено');
    const label=document.createElement('label');label.className='zerk-label';label.append(on,document.createTextNode('Зеркало '+(i+1)));row.append(label);
    const color=document.createElement('input');color.type='color';color.value=m.color;color.setAttribute('aria-label','Цвет зеркала '+(i+1));row.append(color);
    const spin=button(m.spin?'Ⅱ':'▶','Вращать зеркало '+(i+1),()=>{m.spin=!m.spin;spin.textContent=m.spin?'Ⅱ':'▶';spin.setAttribute('aria-pressed',String(m.spin));changed();},row);spin.className='zerk-auto';spin.setAttribute('aria-pressed',String(m.spin));
    const speed=document.createElement('input');speed.type='number';speed.min='-90';speed.max='90';speed.step='1';speed.value=m.speed;speed.setAttribute('aria-label','Скорость зеркала '+(i+1)+' в градусах в секунду');row.append(speed,document.createTextNode('°/с'));
    const angleRow=document.createElement('label'), wrap=document.createElement('span');wrap.className='zerk-range range-with-arrows';
    const angle=document.createElement('input');angle.type='range';angle.min='0';angle.max='179';angle.step='1';angle.value=Math.round(m.angle*180/pi)%180;angle.setAttribute('aria-label','Угол зеркала '+(i+1));angle.dataset.noSlider='true';
    const output=document.createElement('output');output.className='zerk-angle';output.textContent=angle.value+'°';
    const pause=()=>{m.spin=false;spin.textContent='▶';spin.setAttribute('aria-pressed','false');};
    const rotate=delta=>{pause();m.angle=norm(m.angle+delta*pi/180);changed();};
    button('◂','Повернуть зеркало '+(i+1)+' на −5°',()=>rotate(-5),wrap);wrap.append(angle);button('▸','Повернуть зеркало '+(i+1)+' на +5°',()=>rotate(5),wrap);
    angleRow.append(wrap,output);section.append(angleRow);body.append(section);
    on.onchange=()=>{m.on=on.checked;changed();};color.oninput=()=>{m.color=color.value;section.style.setProperty('--mirror-color',m.color);changed();};
    speed.onchange=()=>{m.speed=clamp(Number(speed.value)||0,-90,90);speed.value=m.speed;changed();};
    angle.oninput=()=>{pause();m.angle=Number(angle.value)*pi/180;changed();};
    controls.push({angle,output,spin,on,color,speed,section});
    const line=document.createElement('div');line.className='zerk-mirror';line.dataset.mirror=String(i+1);
    const center=document.createElement('button');center.type='button';center.className='zerk-center';center.textContent=i+1;center.setAttribute('aria-label','Переместить зеркало '+(i+1));
    const turn=document.createElement('button');turn.type='button';turn.className='zerk-turn';turn.textContent='↻';turn.setAttribute('aria-label','Повернуть зеркало '+(i+1)+' в поле');line.append(center,turn);layer.append(line);handles.push({line,center,turn});
    for(const [node,rotateMode] of [[center,false],[turn,true]]){
      node.title=rotateMode?'Тяни ручку — поворот; колесо или ← → — шаг 5°':'Тяни ромб — перенести зеркало; стрелки — сдвиг; правый щелчок — включить / выключить';
      node.addEventListener('pointerdown',e=>{
        if(e.button!==0)return;e.preventDefault();e.stopPropagation();node.setPointerCapture(e.pointerId);
        const r=stage.getBoundingClientRect(), sx=e.clientX,sy=e.clientY,x=m.x,y=m.y,a=m.angle,cx=r.left+x*drawW,cy=r.top+y*drawH,start=Math.atan2(sy-cy,sx-cx);let moved=false;
        const move=ev=>{if(ev.pointerId!==e.pointerId)return;if(!moved&&Math.hypot(ev.clientX-sx,ev.clientY-sy)<3)return;moved=true;
          if(rotateMode){m.angle=norm(a+Math.atan2(ev.clientY-cy,ev.clientX-cx)-start);m.spin=false;controls[i].spin.textContent='▶';controls[i].spin.setAttribute('aria-pressed','false');}
          else{m.x=clamp(x+(ev.clientX-sx)/drawW,.01,.99);m.y=clamp(y+(ev.clientY-sy)/drawH,.01,.99);}changed();};
        const end=ev=>{if(ev.pointerId!==e.pointerId)return;node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',end);if(node.hasPointerCapture(e.pointerId))node.releasePointerCapture(e.pointerId);if(!moved&&rotateMode&&ev.type==='pointerup')rotate(15);else persist();};
        node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);
      });
      node.oncontextmenu=e=>{e.preventDefault();m.on=!m.on;on.checked=m.on;changed();};
      node.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();
        if(rotateMode)rotate(e.key==='ArrowLeft'||e.key==='ArrowDown'?-5:5);
        else{const step=e.shiftKey?20:4;m.x=clamp(m.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0)/drawW,.01,.99);m.y=clamp(m.y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0)/drawH,.01,.99);changed();}};
      if(rotateMode)node.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();rotate(Math.sign(e.deltaY)*5);},{passive:false});
    }
  }
  for(const [key,caption] of [['zero','Наклон 0'],['one','Наклон 1']]){
    const label=document.createElement('label'), input=document.createElement('input'), out=document.createElement('output'),wrap=document.createElement('span');wrap.className='zerk-range range-with-arrows';input.type='range';input.min='-60';input.max='60';input.step='1';input.value=state[key];input.setAttribute('aria-label',caption);out.textContent=state[key]+'°';label.append(document.createTextNode(caption),wrap,out);body.append(label);
    input.oninput=()=>{state[key]=Number(input.value);out.textContent=state[key]+'°';changed(true);};
    const step=delta=>{input.value=clamp(Number(input.value)+delta,-60,60);input.oninput();};
    button('◂',caption+': −1°',()=>step(-1),wrap);wrap.append(input);button('▸',caption+': +1°',()=>step(1),wrap);
  }
  for(const [key,caption] of [['tint','Цветные отражения'],['trace','След единиц']]){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=state[key];input.setAttribute('aria-label',caption);label.append(input,document.createTextNode(caption));body.append(label);input.onchange=()=>{state[key]=input.checked;changed(key==='trace');};}
  button('Вернуть три зеркала','Вернуть начальные положения трёх зеркал',()=>{defaults().forEach((m,i)=>Object.assign(state.mirrors[i],m));state.mirrors.forEach((m,i)=>{Object.assign(controls[i].on,{checked:m.on});controls[i].color.value=m.color;controls[i].speed.value=m.speed;controls[i].section.style.setProperty('--mirror-color',m.color);controls[i].spin.textContent='▶';controls[i].spin.setAttribute('aria-pressed','false');});changed();},body);
  function drawBase(R){
    bg.setTransform(dpr,0,0,dpr,0,0);bg.clearRect(0,0,drawW,drawH);
    const reserve=drawW>650?250:0, W=drawW-reserve, N=Math.max(1,R.length), max=Math.max(1,...R.map(s=>s.length));
    const dw=Math.min(W*.92/max,(drawH-24)/((N+1)*.866)), dh=dw*Math.sqrt(3), cx=reserve+W/2, y0=12+dh/2;
    const fs=Math.max(5,dw*.62), digits=dw*dpr>=7;bg.font='bold '+fs+'px system-ui,sans-serif';bg.textAlign='center';bg.textBaseline='middle';
    for(let r=0;r<R.length;r++)for(let j=0;j<R[r].length;j++){
      const bit=R[r][j],x=cx-(R[r].length-1)*dw/2+j*dw,y=y0+r*dh/2,angle=state[bit==='0'?'zero':'one']*pi/180;
      bg.save();bg.translate(x,y);bg.rotate(angle);bg.globalAlpha=bit==='1'?.42:.11;bg.fillStyle='#9fffc8';bg.beginPath();bg.moveTo(0,-dh*.45);bg.lineTo(dw*.45,0);bg.lineTo(0,dh*.45);bg.lineTo(-dw*.45,0);bg.closePath();bg.fill();
      if(digits){bg.globalAlpha=bit==='1'?.9:.35;bg.fillStyle=bit==='1'?'#06150d':'#9fffc8';bg.fillText(bit,0,fs*.06);}bg.restore();
      if(state.trace&&bit==='1'){bg.save();bg.globalAlpha=.12;bg.strokeStyle='#70e0d7';bg.lineWidth=Math.max(1,dw*.05);for(const sign of [-1,1]){bg.beginPath();bg.moveTo(x,y);bg.lineTo(x+sign*(drawH-y)/Math.sqrt(3),drawH);bg.stroke();}bg.restore();}
    }
  }
  function render(){
    if(!visible())return;
    const r=stage.getBoundingClientRect();if(r.width<10||r.height<10)return;
    drawW=r.width;drawH=r.height;dpr=Math.min(2,devicePixelRatio||1);
    const key=Math.round(drawW*dpr)+'x'+Math.round(drawH*dpr);
    if(key!==geometry){geometry=key;for(const c of [cv,base,copy]){c.width=Math.round(drawW*dpr);c.height=Math.round(drawH*dpr);}dirty=true;plateZig(tools,'#70e0d7');}
    const R=rows(), next=R.join('|');if(next!==rowsKey){rowsKey=next;dirty=true;}
    if(dirty){drawBase(R);dirty=false;}
    g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,cv.width,cv.height);g.drawImage(base,0,0);
    state.mirrors.forEach((m,i)=>{
      const {line,center,turn}=handles[i],ctl=controls[i],length=Math.hypot(drawW,drawH)*2+40;
      line.classList.toggle('off',!m.on);line.style.setProperty('--mirror-color',m.color);
      Object.assign(line.style,{width:length+'px',left:(drawW*m.x-length/2)+'px',top:(drawH*m.y-16)+'px',transform:'rotate('+m.angle+'rad)'});
      center.style.transform='rotate('+(-m.angle)+'rad)';turn.style.left=(length/2+Math.min(drawW,drawH)*.18)+'px';turn.style.transform='rotate('+(-m.angle)+'rad)';
      const deg=Math.round(m.angle*180/pi)%180;ctl.angle.value=deg;ctl.output.textContent=deg+'°';
      if(!m.on)return;
      cg.setTransform(1,0,0,1,0,0);cg.clearRect(0,0,copy.width,copy.height);cg.drawImage(cv,0,0);
      if(state.tint){cg.save();cg.globalCompositeOperation='source-atop';cg.globalAlpha=.38;cg.fillStyle=m.color;cg.fillRect(0,0,copy.width,copy.height);cg.restore();}
      g.save();g.setTransform(...ZZMirrorGeometry.matrix(m.x*cv.width,m.y*cv.height,m.angle));g.drawImage(copy,0,0);g.restore();
    });
    const message=notice||R.length+' строк · '+state.mirrors.filter(m=>m.on).length+' зеркала · ромб — перенос, ↻ — поворот';
    if(status.textContent!==message)status.textContent=message;
    platePlace(tools);
  }
  function tick(now){raf=0;if(!visible()){previous=0;return;}const dt=previous?Math.min(.05,(now-previous)/1000):0;previous=now;
    const spinning=state.mirrors.some(m=>m.on&&m.spin);for(const m of state.mirrors)if(m.on&&m.spin)m.angle=norm(m.angle+m.speed*pi/180*dt);
    render();if(spinning)raf=requestAnimationFrame(tick);else previous=0;
  }
  function request(){if(!raf&&visible())raf=requestAnimationFrame(tick);}
  window.zzZerkaliusRender=()=>{dirty=true;request();};
  new ResizeObserver(()=>{dirty=true;request();}).observe(stage);
  plateZig(tools,'#70e0d7');
  new MutationObserver(request).observe(win,{attributes:true,attributeFilter:['class','style','data-parked']});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)save();else request();});
  window.addEventListener('pagehide',save);
  if(location.hash==='#zerkalius')document.querySelector('#pinBar button[data-aw="w-zerkalius"]')?.click();
  request();
})();
