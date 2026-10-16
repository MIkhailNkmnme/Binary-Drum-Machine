/* Hub v0.139: each preset has its own colour for the axis-symmetry highlight (5th entry, was always gold). */
/* Hub v0.137: defaults ✦ on, 🧲 magnet off (applied once to saved settings, defaultsRevision 2). */
/* Hub v0.134: preset «Мята · всё одно» — bits, reflection and fold-in all one colour (last, so saved choices keep their index). */
/* Hub v0.133: reflection has the same colour as the bits in every preset. */
/* Hub v0.132: ⚙ opens the field tools panel (mirror, ✦, ⤵, 🎨 …) — it was hidden since v0.122, on phones too. */
/* Hub v0.128: 🎨 — ten colour presets: bits / reflection / fold-in. */
/* Hub v0.127: foldIn — mirror bits outside the original triangle are also reflected back inside across its sides (⤵). */
/* Hub v0.126: default axis tilted 110° through the middle of the triangle (autoCenter); right click / long press no longer switches the mirror off. */
/* Hub v0.125: gold — bits whose reflection across the axis lands on the same bit; ✦ toggles it. */
/* Hub v0.119: saved row and pair minimums, adjustable down to 1. */
/* Hub v0.118: local mirror axes and matching bits; enabled by default. */
/* Hub v0.116: complete source survives displacement and reflection before the camera. */
/* Hub v0.115: узор «Х» — кадр Хоррориуса (_js/horr-rows.js), по умолчанию. v0.114: recover the mirror axis along with the drawing. */
(() => {
  'use strict';
  const AX0 = 110 * Math.PI / 180;
  // v0.128: заготовки цвета — биты оригинала / отражения / заворота / (v0.139) подсветки симметрии по оси. v0.133: отражение — того же цвета, что оригинал, во всех заготовках
  const PALETTES = [
    ['Мята', '#9fffc8', '#9fffc8', '#c9a2ff', '#ffd166'], ['Мята · роза', '#9fffc8', '#9fffc8', '#ffd166', '#ff8fd0'], ['Лёд · огонь', '#8fd3ff', '#8fd3ff', '#c9a2ff', '#ff9a5a'],
    ['Золото · синь', '#ffd166', '#ffd166', '#ff6b9a', '#6aa8ff'], ['Лайм · фиалка', '#c6ff6b', '#c6ff6b', '#5ce1e6', '#b98cf0'], ['Белый · красный', '#f2f4f8', '#f2f4f8', '#ffd166', '#ff5a5a'],
    ['Бирюза · янтарь', '#5ce1e6', '#5ce1e6', '#ff8fd0', '#ffb347'], ['Коралл · мята', '#ff7f6b', '#ff7f6b', '#8fd3ff', '#73e4a5'], ['Сирень · лимон', '#c9a2ff', '#c9a2ff', '#6bffb8', '#fff36b'],
    ['Небо · трава', '#6ac8ff', '#6ac8ff', '#ff6bd5', '#8ee86b'], ['Чёрно-белая', '#ffffff', '#ffffff', '#cfcfcf', '#8a8a8a'],
    // v0.131: «цвета в стиле кибернейро» — неон на тёмном
    ['Кибер · неон', '#00f0ff', '#00f0ff', '#fff200', '#ff2bd6'], ['Кибер · синапс', '#39ff14', '#39ff14', '#00e5ff', '#b026ff'], ['Кибер · нейросеть', '#7df9ff', '#7df9ff', '#a0ff4a', '#ff3d7f'],
    ['Кибер · плазма', '#00ffa3', '#00ffa3', '#3d7bff', '#ff00e5'], ['Кибер · ультрафиолет', '#c77dff', '#c77dff', '#ff4d6d', '#00f5d4'], ['Кибер · закат', '#ff6ec7', '#ff6ec7', '#ffe066', '#3df5ff'],
    ['Мята · всё одно', '#9fffc8', '#9fffc8', '#9fffc8', '#ffd166']];   // v0.134: и заворот от границ — того же цвета   // v0.129: и чёрно-белая   // v0.126: начальный наклон оси — как на снимке пользователя
  const state = { on: true, angle: AX0, x: .5, y: .5, autoCenter: true, zero: 0, one: 0, trace: false, bitSymmetry: true, symmetryMinimums:{minPairs:2,minRows:4}, pattern: 'horr',horrDefaultRevision:1,magnet:false,axisRotate:false,spinSpeed:30,gold:true,foldIn:false,palette:0,defaultsRevision:2 }, clamp = v => Math.max(.01, Math.min(.99, v)), turnAngle = a => ((a % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI);
  try {
    const saved = JSON.parse(localStorage.getItem('zerk_hub_mirror') || 'null');
    if (saved) {
      state.autoCenter = saved.autoCenter === true;   // своё расположение — не трогать
      state.on = saved.on !== false;
      state.trace = saved.trace === true;
      state.bitSymmetry = saved.bitSymmetry !== false;
      for(const key of ['minRows','minPairs'])if(Number.isFinite(saved.symmetryMinimums?.[key]))state.symmetryMinimums[key]=Math.max(1,Math.round(saved.symmetryMinimums[key]));
      state.magnet=saved.magnet!==false;state.gold=saved.gold!==false;if(saved.defaultsRevision!==2){state.gold=true;state.magnet=false;}   // v0.137: один раз — ✦ вкл, 🧲 выкл, и у сохранённыхstate.foldIn=saved.foldIn===true;if(Number.isInteger(saved.palette)&&saved.palette>=0&&saved.palette<PALETTES.length)state.palette=saved.palette;state.axisRotate=!!saved.axisRotate;
      state.pattern = saved.horrDefaultRevision === 1 && ['base','serp','horr'].includes(saved.pattern) ? saved.pattern : 'horr'; // v0.116: migrate the old initial pattern once
      state.angle = typeof saved.angle === 'number' && Number.isFinite(saved.angle) ? turnAngle(saved.angle) : saved.axis === 'h' ? 0 : Math.PI / 2;
      if(Number.isFinite(saved.spinSpeed))state.spinSpeed=Math.max(3,Math.min(30000,saved.spinSpeed));
      for (const k of ['x', 'y']) if (typeof saved[k] === 'number' && Number.isFinite(saved[k])) state[k] = clamp(saved[k]);
      for (const k of ['zero', 'one']) if (typeof saved[k] === 'number' && Number.isFinite(saved[k])) state[k] = Math.max(-60, Math.min(60, saved[k]));
      localStorage.setItem('zerk_hub_mirror', JSON.stringify(state));
    }
  } catch (_) {}
  let frame = null, root = null, line = null, handle = null, turn = null, drag = null, revision = 0, enabled = null,bitCenters=[];
  let spinRunning=false,spinRaf=0,spinTime=0,spinButton,spinRange,spinValue,resumeSpin=false;
  function syncSpin(){
    if(!spinButton)return;
    spinButton.textContent='↻\n'+(spinRunning?'Ⅱ':'▶');
    spinButton.setAttribute('aria-pressed',String(spinRunning));spinButton.disabled=!state.on;
    spinRange.value=Math.round(100*Math.log10(state.spinSpeed/30));spinValue.textContent='×'+Number((state.spinSpeed/30).toPrecision(3));spinRange.setAttribute('aria-valuetext',spinValue.textContent);
  }
  function stopSpin(){spinRunning=false;spinTime=0;cancelAnimationFrame(spinRaf);spinRaf=0;syncSpin();}
  function spinTick(time){
    spinRaf=0;if(!spinRunning||!state.on){stopSpin();return;}
    if(spinTime&&!document.hidden){state.angle=turnAngle(state.angle+Math.min(100,time-spinTime)*state.spinSpeed*Math.PI/180/1000);changed();}
    spinTime=time;spinRaf=requestAnimationFrame(spinTick);
  }
  function startSpin(){if(!state.on||spinRunning)return;spinRunning=true;spinTime=0;spinRaf=requestAnimationFrame(spinTick);syncSpin();}
  function magneticPoint(x,y){let best=[x,y],distance=10/Math.max(.2,window.HubView?.scale||1);const shift=window.HubView?.sourceShift()||[0,0];for(const p of [[frame.left+frame.width/2,frame.height/2],...bitCenters.map(p=>[p[0]+shift[0],p[1]+shift[1]])]){const d=Math.hypot(x-p[0],y-p[1]);if(d<=distance){distance=d;best=p;}}return best;}
  const buffers = new WeakMap(),liveSources=new Set();
  const save = () => { try { localStorage.setItem('zerk_hub_mirror', JSON.stringify(state)); } catch (_) {} };
  const center = () => [frame.left + frame.width * state.x, frame.height * state.y];
  const update = () => {
    if (!root || !frame) return;
    const length = Math.hypot(frame.width, frame.height) * 2 + 40, mobile = matchMedia('(max-width: 1100px)').matches;
    root.classList.toggle('off', !state.on);
    if (enabled) enabled.checked = state.on;
    Object.assign(root.style, { position: mobile ? 'absolute' : 'fixed', left: frame.left + 'px', top: '0px', width: frame.width + 'px', height: frame.height + 'px' });
    Object.assign(line.style, { left: (frame.width * state.x - length / 2) + 'px', top: (frame.height * state.y - 10) + 'px', width: length + 'px', transform: 'rotate(' + state.angle + 'rad)' });
    handle.style.transform = 'translateX(-50%) rotate(' + (-state.angle) + 'rad)';
    turn.style.left = (length / 2 + Math.min(frame.width, frame.height) * .22) + 'px';
    window.HubView?.apply(root);handle.textContent = state.on ? '◇' : '×';
    handle.title = 'Зеркало: тяни за линию или отражённые биты; круглая точка — наклон; вкл / выкл — ромб ◇ над полем';
    handle.setAttribute('aria-label', 'Зеркало ' + (state.on ? 'включено' : 'выключено') + ', наклон ' + Math.round(state.angle * 180 / Math.PI) + ' градусов');
    turn.title = 'Повернуть зеркало: тяни ручку или крути колесо';
  };
  const changed = () => { revision++; update(); window.dispatchEvent(new Event('hubmirror')); };
  const rotate = delta => { resumeSpin=false;stopSpin();state.angle = turnAngle(state.angle + delta); changed(); save(); };
  function init() {
    root = document.createElement('div'); root.id = 'hubMirror';
    line = document.createElement('div'); line.className = 'hubMirrorLine';line.tabIndex=0;line.setAttribute('role','button');line.setAttribute('aria-label','Переместить зеркало за линию');
    handle = document.createElement('button'); handle.type = 'button'; handle.className = 'hubMirrorHandle';
    turn = document.createElement('button'); turn.type = 'button'; turn.className = 'hubMirrorTurn'; turn.setAttribute('aria-label', 'Повернуть зеркало');
    line.append(handle, turn); root.append(line); document.body.append(root);
    const settings = document.createElement('div'); settings.className = 'hubMirrorSettings'; settings.id = 'hubFieldTools';
    settings.setAttribute('role', 'toolbar'); settings.setAttribute('aria-label', 'Настройки поля');
    settings.addEventListener('click', e => e.stopPropagation());
    const patternLabel = document.createElement('label'), pattern = document.createElement('select');
    pattern.setAttribute('aria-label', 'Узор треугольника');
    for (const [value, title] of [['horr', 'Х'], ['base', 'П'], ['serp', 'С']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = title; pattern.append(option);
    }
    pattern.value = state.pattern; patternLabel.className='hubRhomb';patternLabel.title='Узор: Хоррориус (кадр маятника) / исходный / Серпинский';patternLabel.append(pattern); settings.append(patternLabel);
    pattern.addEventListener('change', () => { state.pattern = pattern.value; changed(); save(); window.dispatchEvent(new Event('hubpattern')); });
    const toggle = document.createElement('label');
    enabled = document.createElement('input'); enabled.type = 'checkbox'; enabled.checked = state.on;
    toggle.className='hubRhomb';toggle.title='Зеркало';enabled.setAttribute('aria-label','Зеркало');toggle.append(enabled, document.createTextNode('◇')); settings.append(toggle);
    enabled.addEventListener('change', () => { state.on = enabled.checked;if(!state.on){stopSpin();resumeSpin=false;}syncSpin();changed();save(); });
    const sym = document.createElement('button'); sym.type='button'; sym.className='hubRhomb hubBitSymmetry'; sym.textContent='│\nсим.';
    sym.title='Зеркальные оси и парные биты'; sym.setAttribute('aria-label',sym.title); sym.setAttribute('aria-pressed',String(state.bitSymmetry));
    sym.onclick=()=>{state.bitSymmetry=!state.bitSymmetry;sym.setAttribute('aria-pressed',String(state.bitSymmetry));changed();save();}; settings.append(sym);
    for(const [key,icon,title] of [['minRows','↕','Минимум строк симметрии'],['minPairs','↔','Минимум пар зеркальных битов']]){
      const box=document.createElement('details'),head=document.createElement('summary'),value=document.createElement('output'),label=document.createElement('label'),number=document.createElement('input');
      box.className='hubTilt hubSymmetryMinimum';head.title=title;head.append(document.createTextNode(icon),value);value.textContent=state.symmetryMinimums[key];
      number.type='number';number.min='1';number.step='1';number.inputMode='numeric';number.value=state.symmetryMinimums[key];number.setAttribute('aria-label',title);number.style.width='100%';
      if(key==='minPairs')number.title='Одна пара включает простые совпадения 00 и 11';
      number.onchange=()=>{const n=number.valueAsNumber;if(Number.isFinite(n))state.symmetryMinimums[key]=Math.max(1,Math.round(n));number.value=value.textContent=state.symmetryMinimums[key];changed();save();};
      label.append(document.createTextNode(title),number);box.append(head,label);settings.append(box);
    }
    const traceLabel = document.createElement('label'), trace = document.createElement('input');
    trace.type = 'checkbox'; trace.checked = state.trace;
    traceLabel.className='hubRhomb';trace.setAttribute('aria-label','След единиц');traceLabel.append(trace, document.createTextNode('↓')); settings.append(traceLabel);
    traceLabel.title = 'Две световые дорожки вниз через 0 и 1; исходные биты не меняются';
    trace.addEventListener('change', () => { state.trace = trace.checked; changed(); save(); });
    for (const [key, bit] of [['zero', '0'], ['one', '1']]) {
      const label = document.createElement('label'), range = document.createElement('input'), value = document.createElement('output');
      range.type = 'range'; range.min = '-60'; range.max = '60'; range.step = '1'; range.value = state[key];
      range.setAttribute('aria-label', 'Наклон ромбов ' + bit); value.textContent = state[key] + '°';
      const tilt=document.createElement('details'),summary=document.createElement('summary');tilt.className='hubTilt';summary.title='Наклон ромбов '+bit;summary.append(document.createTextNode(bit+' · '),value);label.append(range);tilt.append(summary,label);settings.append(tilt);
      range.addEventListener('input', () => { state[key] = Number(range.value); value.textContent = state[key] + '°'; changed(); });
      range.addEventListener('change', save);
    }
    { // v0.128: 🎨 — десять заготовок цвета: биты оригинала и отражённые (и заворот)
      const box=document.createElement('details'),head=document.createElement('summary'),panel=document.createElement('label');box.className='hubTilt hubPalette';head.title='Цвета: биты и отражение — заготовки';head.textContent='🎨';
      panel.className='hubPaletteList';const sw=(a,b)=>`linear-gradient(90deg,${a} 0 50%,${b} 50% 100%)`;
      PALETTES.forEach(([name,a,,,b],i)=>{const btn=document.createElement('button');btn.type='button';btn.title=name;btn.setAttribute('aria-label','Цвета: '+name);btn.style.background=sw(a,b);btn.setAttribute('aria-pressed',String(state.palette===i));
        btn.onclick=e=>{e.preventDefault();state.palette=i;panel.querySelectorAll('button').forEach((x,k)=>x.setAttribute('aria-pressed',String(k===i)));head.style.background=sw(a,b);changed();save();};panel.append(btn);});
      head.style.background=sw(PALETTES[state.palette][1],PALETTES[state.palette][4]);box.append(head,panel);settings.append(box);}
    const reset = document.createElement('button'); reset.type = 'button'; reset.className='hubRhomb';reset.textContent='↺';reset.title='Сброс наклона битов';reset.setAttribute('aria-label',reset.title); settings.append(reset);
    reset.addEventListener('click', () => {
      state.zero = 0; state.one = 0; settings.querySelectorAll('input[aria-label^="Наклон ромбов"]').forEach(el => { el.value = '0'; el.closest('.hubTilt').querySelector('output').textContent='0°'; }); changed(); save();
    });
    document.body.append(settings);
    { // v0.132: «не вижу кнопки управления зеркалом и цветами на мобильном» — панель поля открывается кнопкой ⚙ (у PNG), состояние помнится
      const open=document.createElement('button');open.type='button';open.id='hubTools';open.textContent='⚙';open.title='Кнопки поля: зеркало, золото, заворот, цвета…';open.setAttribute('aria-label',open.title);
      const set=on=>{settings.classList.toggle('open',on);open.setAttribute('aria-pressed',String(on));try{localStorage.setItem('zerk_hub_tools',on?'1':'0');}catch(_){}};
      let on=false;try{on=localStorage.getItem('zerk_hub_tools')==='1';}catch(_){}set(on);
      open.addEventListener('click',e=>{e.stopPropagation();set(!settings.classList.contains('open'));});document.body.append(open);}
    for(const [key,text,title] of [['gold','✦','Золото: области, симметричные относительно оси'],['foldIn','⤵','Заворот: части отражения вне треугольника — ещё и отражённые от его сторон внутрь (сами остаются)'],['magnet','🧲','Магнит оси: центр поля и центры битов'],['axisRotate','⟳','Вращать ось за линию вместо переноса']]){const b=document.createElement('button');b.type='button';b.className='hubRhomb';b.textContent=text;b.title=title;b.setAttribute('aria-label',title);b.setAttribute('aria-pressed',String(state[key]));b.onclick=()=>{state[key]=!state[key];b.setAttribute('aria-pressed',String(state[key]));changed();save();};settings.append(b);}
    const spinControl=document.createElement('div');spinControl.className='hubMirrorSpinControl';
    spinButton=document.createElement('button');spinButton.type='button';spinButton.className='hubRhomb hubMirrorSpin';spinButton.title='Вращать линию зеркала вокруг её центра: пуск / пауза';spinButton.setAttribute('aria-label','Вращать зеркало вокруг центра');spinButton.onclick=()=>{resumeSpin=false;if(spinRunning)stopSpin();else startSpin();save();};spinControl.append(spinButton);
    const spinLabel=document.createElement('label'),spinHead=document.createElement('span');spinLabel.className='hubMirrorSpeedControl';spinHead.append(document.createTextNode('Зеркало · '));spinValue=document.createElement('output');spinHead.append(spinValue);spinLabel.append(spinHead);
    spinValue.title='Двойной щелчок — скорость ×1';spinValue.ondblclick=()=>{state.spinSpeed=30;syncSpin();save();};
    spinRange=document.createElement('input');spinRange.type='range';spinRange.min=-100;spinRange.max=300;spinRange.step=1;spinRange.className='hubMirrorSpeed';spinRange.setAttribute('aria-label','Множитель скорости вращения зеркала');spinRange.oninput=()=>{state.spinSpeed=30*Math.pow(10,Number(spinRange.value)/100);syncSpin();};spinRange.onchange=save;spinLabel.append(spinRange);spinControl.append(spinLabel);settings.append(spinControl);syncSpin();
    window.addEventListener('hubmotionpause',e=>{if(e.detail.paused){resumeSpin=spinRunning;stopSpin();save();}else{if(resumeSpin)startSpin();resumeSpin=false;}});
    window.addEventListener('pagehide',()=>{stopSpin();save();});
    root.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !frame) return;
      e.preventDefault(); e.stopPropagation();
      const [mx,my]=window.HubView?window.HubView.inverse(e.clientX,e.clientY+(matchMedia('(max-width:1100px)').matches?scrollY:0)):[e.clientX,e.clientY];
      if(!Number.isFinite(mx)||!Number.isFinite(my))return;
      drag = { id: e.pointerId, x: mx, y: my, px: state.x, py: state.y, angle: state.angle,
        cx: frame.left + frame.width * state.x, cy: frame.height * state.y,
        moved: false, handle: e.target === handle, turn: e.target === turn||state.axisRotate };
      drag.startAngle = Math.atan2(my - drag.cy, mx - drag.cx);
      root.setPointerCapture(e.pointerId);
    });
    root.addEventListener('pointermove', e => {
      if (!drag || drag.id !== e.pointerId) return;
      e.preventDefault(); e.stopPropagation();
      const [mx,my]=window.HubView?window.HubView.inverse(e.clientX,e.clientY+(matchMedia('(max-width:1100px)').matches?scrollY:0)):[e.clientX,e.clientY],dx=mx-drag.x,dy=my-drag.y;
      if(!Number.isFinite(mx)||!Number.isFinite(my))return;
      if (!drag.moved && Math.hypot(dx, dy) < 3) return;
      drag.moved = true;
      if (drag.turn) {
        if (Math.hypot(mx - drag.cx, my - drag.cy) < 12) return;
        resumeSpin=false;stopSpin();state.angle = turnAngle(drag.angle + Math.atan2(my - drag.cy, mx - drag.cx) - drag.startAngle);
        if(state.magnet&&!e.altKey){const step=Math.PI/12,nearest=Math.round(state.angle/step)*step;if(Math.abs(nearest-state.angle)<=Math.PI/90)state.angle=turnAngle(nearest);}
      } else {let x=frame.left+drag.px*frame.width+dx,y=drag.py*frame.height+dy;if(state.magnet&&!e.altKey)[x,y]=magneticPoint(x,y);state.x=clamp((x-frame.left)/frame.width);state.y=clamp(y/frame.height);}
      changed();
    });
    const finish = e => {
      if (!drag || drag.id !== e.pointerId) return;
      const done = drag; drag = null;
      if (root.hasPointerCapture(e.pointerId)) root.releasePointerCapture(e.pointerId);
      if (e.type === 'pointerup' && !done.moved && (done.handle || done.turn)) rotate(Math.PI / 12); else save();
    };
    root.addEventListener('pointerup', finish); root.addEventListener('pointercancel', finish);
    root.addEventListener('lostpointercapture', () => { if (drag) { drag = null; save(); } });
    root.addEventListener('click', e => { e.stopPropagation(); if (e.detail === 0 && (e.target === handle || e.target === turn)) rotate(Math.PI / 12); });
    root.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); });   // v0.126: правая кнопка / долгое нажатие зеркало не выключают
    turn.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); rotate(Math.sign(e.deltaY) * Math.PI / 36); }, { passive: false });
    root.addEventListener('keydown', e => {
      if (!frame) return;
      const delta = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] })[e.key];
      if (!delta) return;
      e.preventDefault(); e.stopPropagation(); const step = e.shiftKey ? 20 : 4;
      state.x = clamp(state.x + delta[0] * step / frame.width); state.y = clamp(state.y + delta[1] * step / frame.height);
      changed(); save();
    });
    update();
  }
  window.HubMirror = {
    state, get revision() { return revision; },
    home(){stopSpin();resumeSpin=false;Object.assign(state,{x:.5,y:.5,angle:AX0,autoCenter:true});changed();save();},
    // v0.126: ось по умолчанию — через середину треугольника (зовёт отрисовка хаба, когда знает, где он)
    centerOn(x,y){if(!frame||!state.autoCenter)return;state.x=clamp((x-frame.left)/frame.width);state.y=clamp(y/frame.height);state.autoCenter=false;save();requestAnimationFrame(changed);},
    setBitCenters(points){bitCenters=points;},
    position(){return {x:state.x,y:state.y};},
    moveFrom(start,dx,dy){if(!frame)return;state.x=clamp(start.x+dx/frame.width);state.y=clamp(start.y+dy/frame.height);changed();save();},
    hit(x,y){let original=false,mirror=false;const read=(canvas,px,py)=>{const sx=canvas.width/(frame.left+frame.width),sy=canvas.height/frame.height,ix=Math.floor(px*sx),iy=Math.floor(py*sy);return ix>=0&&iy>=0&&ix<canvas.width&&iy<canvas.height&&canvas.getContext('2d').getImageData(ix,iy,1,1).data[3]>2;};if(!frame)return {source:false,mirror:false};const reflected=this.point(x,y,false),shift=window.HubView?.sourceShift()||[0,0];for(const canvas of liveSources){const image=buffers.get(canvas);if(!image)continue;original||=read(image,x-shift[0],y-shift[1]);if(reflected)mirror||=read(image,reflected[0]-shift[0],reflected[1]-shift[1]);}return {source:original,mirror};},
    colors(){const p=PALETTES[state.palette]||PALETTES[0];return {bit:p[1],mirror:p[2],fold:p[3],sym:p[4]||'#ffd166'};},
    bitAngle(bit) { return (bit === '0' ? state.zero : state.one) * Math.PI / 180; },
    place(left, width, height) { frame = { left, width, height }; window.HubView?.place(left,width,height); update(); },
    point(x, y,shift=true) {
      if (!frame || !state.on) return null;
      if(shift){const p=window.HubView?.sourceShift()||[0,0];x+=p[0];y+=p[1];}
      const [cx, cy] = center(), nx = -Math.sin(state.angle), ny = Math.cos(state.angle), distance = (x - cx) * nx + (y - cy) * ny;
      return [x - 2 * distance * nx, y - 2 * distance * ny];
    },
    contains(x, y, w, h) { return frame && x - w / 2 >= frame.left && x + w / 2 <= frame.left + frame.width && y - h / 2 >= 0 && y + h / 2 <= frame.height; },
    matrix(canvas,view=null){
      if(!frame||!state.on)return null;
      const offset=view?view.left:0,sx=view?view.scale:canvas.width/(frame.left+frame.width),sy=view?view.scale:canvas.height/frame.height;
      const [x,y]=center(),cx=(x-offset)*sx,cy=y*sy,a=Math.cos(2*state.angle),b=Math.sin(2*state.angle);
      return [a,b*sy/sx,b*sx/sy,-a,cx-a*cx-b*sx/sy*cy,cy-b*sy/sx*cx+a*cy];
    },
    reflect(canvas, view = null) {
      // Keep the complete source. Reflection is composed with the camera in HubView.paint.
      if(!frame||!canvas.width||!canvas.height||view)return;
      let source=buffers.get(canvas);if(!source){source=document.createElement('canvas');buffers.set(canvas,source);}
      if(source.width!==canvas.width||source.height!==canvas.height){source.width=canvas.width;source.height=canvas.height;}
      const copy=source.getContext('2d');copy.clearRect(0,0,source.width,source.height);copy.drawImage(canvas,0,0);liveSources.add(canvas);
    }

  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
