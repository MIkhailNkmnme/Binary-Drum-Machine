/* Hub v0.155: ромбическая палитра; закрытие всплывающих окон по клику снаружи. */
/* Hub v0.154: ромбы, цифры, скобки и центрированные звёздочки/точки. */
/* Hub v0.153: тестовая фиксация конца оси в центре экрана. */
/* Hub v0.152: палитра поля задаёт цвета кнопок; по умолчанию Лёд · огонь. */
/* Hub v0.151: магнит ограничивает ручное и автоматическое вращение шагами 15°. */
/* Hub v0.150: независимые переключатели прозрачных цифр 0 и 1. */
/* Hub v0.149: ось-луч от опорной точки; пунктирная орбита при ручном повороте. */
/* Hub v0.147: включённая ось меняет отражение независимо от оригинала. */
/* Hub v0.146: без отражения ось закреплена в центре оригинала; автокручение скрывает ось. */
/* Hub v0.145: ось управляет оригиналом и при отключённом отражении. */
/* Hub v0.144: the colour rhombus moves under the zoom cross, equilateral, colour buttons are filled rhombs. */
/* Hub v0.141: own preset (★) with four colours, alphas for bits / fold / symmetry; colour controls grouped in a translucent rhombus. */
/* Hub v0.140: opacity of the axis-symmetry highlight (symAlpha, slider next to ✦). */
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
  const state = { on: true, angle: AX0, x: .5, y: .5, autoCenter: true, screenPin:false, orbitRadius:.22, bitView:'rhombs', zero: 0, one: 0, trace: false, bitSymmetry: true, parallelSymmetry:false,hideZeroDigit:false,hideOneDigit:false, symmetryMinimums:{minPairs:2,minRows:4}, pattern: 'horr',horrDefaultRevision:1,magnet:false,axisRotate:false,spinSpeed:30,gold:true,foldIn:false,palette:2,defaultsRevision:2,symAlpha:.95,bitAlpha:1,foldAlpha:1,custom:null }, clamp = v => Math.max(.01, Math.min(.99, v)), turnAngle = a => ((a % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI);
  try {
    const saved = JSON.parse(localStorage.getItem('zerk_hub_mirror') || 'null');
    if (saved) {
      state.autoCenter = saved.autoCenter === true;   // своё расположение — не трогать
      state.on = saved.on !== false;state.screenPin=saved.screenPin===true;if(Number.isFinite(saved.orbitRadius))state.orbitRadius=Math.max(.02,Math.min(4,saved.orbitRadius));if(['rhombs','digits','brackets','stars'].includes(saved.bitView))state.bitView=saved.bitView;
      state.trace = saved.trace === true;
      state.bitSymmetry = saved.bitSymmetry !== false;state.parallelSymmetry=saved.parallelSymmetry===true;state.hideZeroDigit=saved.hideZeroDigit===true;state.hideOneDigit=saved.hideOneDigit===true;
      for(const key of ['minRows','minPairs'])if(Number.isFinite(saved.symmetryMinimums?.[key]))state.symmetryMinimums[key]=Math.max(1,Math.round(saved.symmetryMinimums[key]));
      state.magnet=saved.magnet!==false;state.gold=saved.gold!==false;if(saved.defaultsRevision!==2){state.gold=true;state.magnet=false;}   // v0.137: один раз — ✦ вкл, 🧲 выкл, и у сохранённыхstate.foldIn=saved.foldIn===true;if(Number.isFinite(saved.symAlpha))state.symAlpha=Math.max(.1,Math.min(1,saved.symAlpha));for(const k of ['bitAlpha','foldAlpha'])if(Number.isFinite(saved[k]))state[k]=Math.max(.1,Math.min(1.3,saved[k]));
      if(saved.custom&&typeof saved.custom==='object'){const c={};for(const k of ['bit','mirror','fold','sym'])if(/^#[0-9a-f]{6}$/i.test(saved.custom[k]||''))c[k]=saved.custom[k];if(Object.keys(c).length===4)state.custom=c;}
      if(saved.palette===-1&&state.custom)state.palette=-1;if(Number.isInteger(saved.palette)&&saved.palette>=0&&saved.palette<PALETTES.length)state.palette=saved.palette;state.axisRotate=!!saved.axisRotate;
      state.pattern = saved.horrDefaultRevision === 1 && ['base','serp','horr'].includes(saved.pattern) ? saved.pattern : 'horr'; // v0.116: migrate the old initial pattern once
      state.angle = typeof saved.angle === 'number' && Number.isFinite(saved.angle) ? turnAngle(saved.angle) : saved.axis === 'h' ? 0 : Math.PI / 2;
      if(Number.isFinite(saved.spinSpeed))state.spinSpeed=Math.max(3,Math.min(30000,saved.spinSpeed));
      for (const k of ['x', 'y']) if (typeof saved[k] === 'number' && Number.isFinite(saved[k])) state[k] = clamp(saved[k]);
      for (const k of ['zero', 'one']) if (typeof saved[k] === 'number' && Number.isFinite(saved[k])) state[k] = Math.max(-60, Math.min(60, saved[k]));
      localStorage.setItem('zerk_hub_mirror', JSON.stringify(state));
    }
  } catch (_) {}
  let colorGroup = null, frame = null, root = null, viewport = null, line = null, handle = null, turn = null, orbit = null, drag = null, revision = 0, enabled = null,bitCenters=[];
  let spinRunning=false,spinRaf=0,spinTime=0,spinButton,spinRange,spinValue,resumeSpin=false,spinRemainder=0;
  function syncSpin(){
    document.body?.classList.toggle('hubMirrorSpinning',spinRunning);
    if(!spinButton)return;
    spinButton.textContent='↻\n'+(spinRunning?'Ⅱ':'▶');
    spinButton.setAttribute('aria-pressed',String(spinRunning));spinButton.disabled=false;
    spinRange.value=Math.round(100*Math.log10(state.spinSpeed/30));spinValue.textContent='×'+Number((state.spinSpeed/30).toPrecision(3));spinRange.setAttribute('aria-valuetext',spinValue.textContent);
  }
  function stopSpin(){spinRemainder=0;spinRunning=false;spinTime=0;cancelAnimationFrame(spinRaf);spinRaf=0;syncSpin();}
  function spinTick(time){
    spinRaf=0;if(!spinRunning){stopSpin();return;}
    if(spinTime&&!document.hidden){let delta=Math.max(0,time-spinTime)*state.spinSpeed*Math.PI/180/1000;
      if(state.magnet){const a=visibleAngle();spinRemainder+=delta;delta=snapAngle(a+spinRemainder)-a;spinRemainder-=delta;}else spinRemainder=0;
      if(Math.abs(delta)>1e-12){turnField(delta);changed();}}
    spinTime=time;spinRaf=requestAnimationFrame(spinTick);
  }
  function startSpin(){if(spinRunning)return;spinRemainder=0;spinRunning=true;spinTime=0;spinRaf=requestAnimationFrame(spinTick);syncSpin();}
  function magneticPoint(x,y){let best=[x,y],distance=10/Math.max(.2,window.HubView?.scale||1);const shift=window.HubView?.sourceShift()||[0,0];for(const p of [[frame.left+frame.width/2,frame.height/2],...bitCenters.map(p=>[p[0]+shift[0],p[1]+shift[1]])]){const d=Math.hypot(x-p[0],y-p[1]);if(d<=distance){distance=d;best=p;}}return best;}
  const buffers = new WeakMap(),liveSources=new Set();
  const save = () => { try { localStorage.setItem('zerk_hub_mirror', JSON.stringify(state)); } catch (_) {} };
  const center = () => [frame.left + frame.width * state.x, frame.height * state.y];
  function lockCenter(){if(!frame)return;if(state.screenPin){const p=window.HubView?.screenCenterAnchor?.();if(p?.every(Number.isFinite)){state.x=(p[0]-frame.left)/frame.width;state.y=p[1]/frame.height;}return;}if(state.on)return;const p=window.HubView?.originalCenter?.()||[frame.left+frame.width/2,frame.height/2];state.x=(p[0]-frame.left)/frame.width;state.y=p[1]/frame.height;}
  const update = () => {
    lockCenter();
    if (!root || !frame) return;
    const px=frame.width*state.x, py=frame.height*state.y, radius=Math.min(frame.width,frame.height)*state.orbitRadius;
    const mobile = matchMedia('(max-width: 1100px)').matches;
    const corners=[[0,0],[frame.left+frame.width,0],[0,frame.height],[frame.left+frame.width,frame.height]].map(p=>window.HubView?.inverse(...p)||p).filter(p=>p.every(Number.isFinite));
    const length=Math.max(Math.hypot(frame.width,frame.height),...corners.map(p=>Math.hypot(p[0]-frame.left-px,p[1]-py)))+40;
    Object.assign(viewport.style,{position:mobile?'absolute':'fixed',height:(state.screenPin&&mobile?Math.max(frame.height,scrollY+innerHeight):frame.height)+'px'});
    root.classList.toggle('off', !state.on);
    root.classList.toggle('turning', !!drag?.turn);
    root.classList.toggle('magnetic',state.magnet);
    root.style.setProperty('--hubAxisMarkerScale',String(1/(window.HubView?.scale||1)));
    if (enabled) enabled.checked = state.on;
    Object.assign(root.style, { position: mobile ? 'absolute' : 'fixed', left: frame.left + 'px', top: '0px', width: frame.width + 'px', height: frame.height + 'px' });
    Object.assign(line.style, { left: px + 'px', top: (py - 10) + 'px', width: length + 'px', transform: 'rotate(' + state.angle + 'rad)' });
    handle.style.transform = 'translateX(-50%) rotate(' + (-state.angle) + 'rad)';
    turn.style.left = radius + 'px';
    Object.assign(orbit.style,{left:(px-radius)+'px',top:(py-radius)+'px',width:(2*radius)+'px',height:(2*radius)+'px'});
    orbit.querySelector('polygon').setAttribute('transform','rotate('+(-(window.HubView?.rotation||0)*180/Math.PI)+')');
    window.HubView?.apply(root);handle.textContent = state.on ? '◇' : '×';
    handle.title = state.on?'Ось: тяни линию, чтобы переместить отражение; круглая ручка поворачивает зеркало':'Ось закреплена в центре оригинала: только поворот';
    line.setAttribute('aria-label',state.screenPin?'Повернуть ось вокруг центра экрана':state.on?'Переместить зеркало относительно оригинала':'Повернуть оригинал вокруг центра');
    handle.setAttribute('aria-label', 'Зеркало ' + (state.on ? 'включено' : 'выключено') + ', наклон ' + Math.round(turnAngle(state.angle+(window.HubView?.rotation||0)) * 180 / Math.PI) + ' градусов');
    turn.title = state.screenPin?'Тяни вокруг центра — поворот оси; к центру или от него — радиус ручки':state.on?'Повернуть зеркало относительно оригинала: тяни ручку или крути колесо':'Повернуть оригинал вокруг центра: тяни ручку или крути колесо';
  };
  const changed = () => { revision++; update(); window.dispatchEvent(new Event('hubmirror')); };
  const visibleAngle=()=>state.angle+(window.HubView?.rotation||0),snapAngle=a=>Math.round(a/(Math.PI/12))*(Math.PI/12);
  function turnField(delta){if(state.on){state.angle=turnAngle(state.angle+delta);return;}lockCenter();if(frame&&window.HubView?.rotateAround)window.HubView.rotateAround(delta,...center());else state.angle=turnAngle(state.angle+delta);}
  function moveAxis(x,y){if(state.screenPin||!state.on){lockCenter();return;}state.x=clamp(x);state.y=clamp(y);}
  const rotate = delta => { resumeSpin=false;stopSpin();if(state.magnet&&delta){delta=Math.sign(delta)*Math.max(Math.PI/12,Math.round(Math.abs(delta)/(Math.PI/12))*(Math.PI/12));delta=snapAngle(visibleAngle()+delta)-visibleAngle();}turnField(delta);changed();save(); };
  function init() {
    viewport=document.createElement('div');viewport.id='hubMirrorViewport';
    root = document.createElement('div'); root.id = 'hubMirror';
    line = document.createElement('div'); line.className = 'hubMirrorLine';line.tabIndex=0;line.setAttribute('role','button');line.setAttribute('aria-label','Переместить зеркало относительно оригинала');
    handle = document.createElement('button'); handle.type = 'button'; handle.className = 'hubMirrorHandle';
    turn = document.createElement('button'); turn.type = 'button'; turn.className = 'hubMirrorTurn'; turn.setAttribute('aria-label', 'Повернуть зеркало');
    orbit=document.createElement('div');orbit.className='hubMirrorOrbit';orbit.setAttribute('aria-hidden','true');
    const polygonPoints=(n,r)=>Array.from({length:n},(_,i)=>{const a=i*2*Math.PI/n;return (r*Math.cos(a)).toFixed(5)+','+(r*Math.sin(a)).toFixed(5);}).join(' ');
    orbit.innerHTML='<svg viewBox="-100 -100 200 200" aria-hidden="true"><circle r="100"/><polygon points="'+polygonPoints(24,100)+'"/></svg>';
    turn.innerHTML='<svg class="hubMirrorTurnMagnet" viewBox="-14 -14 28 28" aria-hidden="true"><polygon points="'+polygonPoints(6,11)+'"/><polygon points="'+polygonPoints(6,7)+'"/></svg>';
    line.append(handle, turn); root.append(orbit,line);viewport.append(root);document.body.append(viewport);
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
    const viewLabel=document.createElement('label'),bitView=document.createElement('select');viewLabel.className='hubRhomb hubBitView';viewLabel.title='Вид битов: ромбы с цифрами / только цифры / скобки / звёздочки и точки';bitView.setAttribute('aria-label','Вид битов');
    for(const [value,text] of [['rhombs','◇01'],['digits','01'],['brackets',')()'],['stars','*·']]){const option=document.createElement('option');option.value=value;option.textContent=text;bitView.append(option);}
    bitView.value=state.bitView;bitView.onchange=()=>{state.bitView=bitView.value;changed();save();};viewLabel.append(bitView);settings.append(viewLabel);
    const toggle = document.createElement('label');
    enabled = document.createElement('input'); enabled.type = 'checkbox'; enabled.checked = state.on;
    toggle.className='hubRhomb';toggle.title='Зеркало';enabled.setAttribute('aria-label','Зеркало');toggle.append(enabled, document.createTextNode('◇')); settings.append(toggle);
    enabled.addEventListener('change', () => { state.on = enabled.checked;syncSpin();changed();save(); });
    const sym = document.createElement('button'); sym.type='button'; sym.className='hubRhomb hubBitSymmetry'; sym.textContent='│\nсим.';
    sym.title='Зеркальные оси и парные биты'; sym.setAttribute('aria-label',sym.title); sym.setAttribute('aria-pressed',String(state.bitSymmetry));
    const parallel=document.createElement('button');parallel.type='button';parallel.className='hubRhomb';parallel.textContent='∥';parallel.title='Искать симметричные пары параллельно ручной оси (точное совпадение центров битов)';parallel.setAttribute('aria-label','Симметрия параллельно ручной оси');
    const syncSymmetry=()=>{sym.setAttribute('aria-pressed',String(state.bitSymmetry));parallel.hidden=!state.bitSymmetry;parallel.setAttribute('aria-pressed',String(state.parallelSymmetry));};
    sym.onclick=()=>{state.bitSymmetry=!state.bitSymmetry;syncSymmetry();changed();save();};parallel.onclick=()=>{state.parallelSymmetry=!state.parallelSymmetry;syncSymmetry();changed();save();};settings.append(sym,parallel);syncSymmetry();
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
    traceLabel.className='hubRhomb';trace.setAttribute('aria-label','Семь световых дорожек — До Ре Ми Фа Соль Ля Си');traceLabel.append(trace, document.createTextNode('♪')); settings.append(traceLabel);
    traceLabel.title = 'Семь световых дорожек: исходные ноты До, Ре, Ми, Фа, Соль, Ля, Си; включить / выключить';
    trace.addEventListener('change', () => { state.trace = trace.checked; changed(); save(); });
    for (const [key, bit] of [['zero', '0'], ['one', '1']]) {
      const label = document.createElement('label'), range = document.createElement('input'), value = document.createElement('output');
      range.type = 'range'; range.min = '-60'; range.max = '60'; range.step = '1'; range.value = state[key];
      range.setAttribute('aria-label', 'Наклон ромбов ' + bit); value.textContent = state[key] + '°';
      const tilt=document.createElement('details'),summary=document.createElement('summary');tilt.className='hubTilt';summary.title='Наклон ромбов '+bit;summary.append(document.createTextNode(bit+' · '),value);label.append(range);tilt.append(summary,label);settings.append(tilt);
      range.addEventListener('input', () => { state[key] = Number(range.value); value.textContent = state[key] + '°'; changed(); });
      range.addEventListener('change', save);
    }
    // v0.141: «свой пресет — цвета, прозрачности и все настройки цвета; кнопки в группу, в общем полупрозрачном ромбе».
    // Группа «Цвета»: 🎨 заготовки (последний образец ★ — свой), 4 цвета (биты, отражение, заворот, симметрия), ✦ вкл / выкл и прозрачности
    // (биты, заворот, симметрия). Любой цвет поменял — выбран «★ свой» (копия текущей заготовки + правка), он помнится.
    colorGroup=document.createElement('div');colorGroup.className='hubColorGroup';colorGroup.setAttribute('role','group');colorGroup.setAttribute('aria-label','Цвета');
    const sw=(a,b)=>`linear-gradient(90deg,${a} 0 50%,${b} 50% 100%)`,palBox=document.createElement('details'),palHead=document.createElement('summary'),palList=document.createElement('div');
    palBox.className='hubTilt hubPalette';palBox.style.gridArea='pal';palHead.title='Цвета: заготовки; ★ — свой';palHead.textContent='🎨';palList.className='hubPaletteList';palList.setAttribute('role','group');palList.setAttribute('aria-label','Пресеты цветов');
    const inputs={};
    const syncColors=()=>{const c=api.colors();
      document.documentElement.style.setProperty('--hub-theme-bit',c.bit);document.documentElement.style.setProperty('--hub-theme-accent',c.sym);
      palHead.style.background=sw(c.bit,c.sym);palList.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(Number(x.dataset.i)===state.palette)));
      for(const k in inputs){if(document.activeElement!==inputs[k])inputs[k].value=c[k];inputs[k].parentElement.style.setProperty('--slot',c[k]);}};
    [...PALETTES.map((p,i)=>[i,p[0],p[1],p[4]]),[-1,'★ Свой',null,null]].forEach(([i,name,a,b])=>{const btn=document.createElement('button');btn.type='button';btn.dataset.i=i;const slot=i<0?PALETTES.length:i;const row=Math.floor(slot/5),col=slot%5;btn.style.left=(90+(col-row-.5)*20)+'px';btn.style.top=(90+(col+row-3.5)*20)+'px';btn.title=name;btn.setAttribute('aria-label','Цвета: '+name);
      if(i>=0)btn.style.background=sw(a,b);else{btn.textContent='★';btn.className='hubPaletteOwn';}
      btn.onclick=e=>{e.preventDefault();if(i===-1&&!state.custom)state.custom={...api.colors()};state.palette=i;syncColors();changed();save();palBox.open=false;};palList.append(btn);});
    palBox.append(palHead,palList);colorGroup.append(palBox);
    for(const [key,area,mark,title] of [['bit','cb','1','Цвет битов оригинала'],['mirror','cm','◇','Цвет отражённых битов'],['fold','cf','⤵','Цвет заворота'],['sym','cs','✦','Цвет подсветки симметрии по оси']]){
      const wrap=document.createElement('label'),input=document.createElement('input'),m=document.createElement('b');wrap.className='hubColorSlot';wrap.style.gridArea=area;wrap.title=title;
      input.type='color';input.setAttribute('aria-label',title);m.textContent=mark;wrap.append(input,m);inputs[key]=input;
      input.addEventListener('input',()=>{if(state.palette!==-1){state.custom={...api.colors()};state.palette=-1;}state.custom[key]=input.value;syncColors();changed();});input.addEventListener('change',save);
      colorGroup.append(wrap);}
    for(const [key,area,mark,title,min,max] of [['symAlpha','sa','✦','Прозрачность подсветки симметрии по оси',10,100],['bitAlpha','ab','1','Прозрачность битов оригинала и отражения',10,130],['foldAlpha','af','⤵','Прозрачность заворота',10,130]]){
      const box=document.createElement('details'),head=document.createElement('summary'),value=document.createElement('output'),label=document.createElement('label'),range=document.createElement('input');
      box.className='hubTilt hubAlpha';box.style.gridArea=area;head.title=title;head.append(document.createTextNode(mark+' '),value);
      range.type='range';range.min=String(min);range.max=String(max);range.step='5';range.value=Math.round(state[key]*100);range.setAttribute('aria-label',title);value.textContent=range.value+'%';
      range.addEventListener('input',()=>{state[key]=Number(range.value)/100;value.textContent=range.value+'%';changed();});range.addEventListener('change',save);
      label.append(range);box.append(head,label);colorGroup.append(box);}
    for(const [key,bit,area] of [['hideZeroDigit','0','d0'],['hideOneDigit','1','d1']]){
      const b=document.createElement('button');b.type='button';b.className='hubRhomb hubDigitToggle';b.style.gridArea=area;b.textContent=bit;b.title='Прозрачные цифры '+bit+' — ромбы остаются';b.setAttribute('aria-label','Прозрачные цифры '+bit);b.setAttribute('aria-pressed',String(state[key]));
      b.onclick=()=>{state[key]=!state[key];b.setAttribute('aria-pressed',String(state[key]));changed();save();};colorGroup.append(b);
    }
    syncColors();settings.append(colorGroup);
    document.addEventListener('pointerdown',e=>{document.querySelectorAll('.hubTilt[open]').forEach(box=>{if(!box.contains(e.target))box.open=false;});},true);
    document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.hubTilt[open]').forEach(box=>box.open=false);});
    // v0.144: «этот ромб под кнопки масштаба, равносторонний» — переезжает в #hubZoom (его строит hub-view.js чуть позже)
    { let tries=0;const move=()=>{const z=document.getElementById('hubZoom');if(z){z.append(colorGroup);return;}if(++tries<40)setTimeout(move,100);};setTimeout(move,0); }
    const reset = document.createElement('button'); reset.type = 'button'; reset.className='hubRhomb';reset.textContent='↺';reset.title='Сброс наклона битов';reset.setAttribute('aria-label',reset.title); settings.append(reset);
    reset.addEventListener('click', () => {
      state.zero = 0; state.one = 0; settings.querySelectorAll('input[aria-label^="Наклон ромбов"]').forEach(el => { el.value = '0'; el.closest('.hubTilt').querySelector('output').textContent='0°'; }); changed(); save();
    });
    document.body.append(settings);
    { // v0.132: «не вижу кнопки управления зеркалом и цветами на мобильном» — панель поля открывается кнопкой ⚙ (у PNG), состояние помнится
      const open=document.createElement('button');open.type='button';open.id='hubTools';open.textContent='⚙';open.title='Кнопки поля: зеркало, золото, заворот, цвета…';open.setAttribute('aria-label',open.title);
      const set=on=>{settings.classList.toggle('open',on);open.setAttribute('aria-pressed',String(on));try{localStorage.setItem('zerk_hub_tools',on?'1':'0');}catch(_){}};
      let on=false;try{on=localStorage.getItem('zerk_hub_tools')==='1';}catch(_){}set(on);
      document.addEventListener('pointerdown',e=>{if(!settings.contains(e.target)&&!open.contains(e.target))set(false);},true);
      open.addEventListener('click',e=>{e.stopPropagation();set(!settings.classList.contains('open'));});document.body.append(open);}
    for(const [key,text,title] of [['gold','✦','Золото: области, симметричные относительно оси'],['foldIn','⤵','Заворот: части отражения вне треугольника — ещё и отражённые от его сторон внутрь (сами остаются)'],['magnet','🧲','Магнит оси: центр поля и центры битов'],['screenPin','◎\nцентр','Конец оси в центре экрана'],['axisRotate','⟳','Вращать ось за линию вместо переноса']]){const b=document.createElement('button');b.type='button';b.className='hubRhomb';b.textContent=text;if(key==='screenPin')b.classList.add('hubAxisScreenPin');b.title=title;b.setAttribute('aria-label',title);b.setAttribute('aria-pressed',String(state[key]));b.onclick=()=>{state[key]=!state[key];if(key==='magnet'){spinRemainder=0;if(state.magnet)turnField(snapAngle(visibleAngle())-visibleAngle());}b.setAttribute('aria-pressed',String(state[key]));changed();save();};settings.append(b);}
    { const g=settings.querySelector('[aria-label^="Золото"]');if(g&&colorGroup){g.style.gridArea='gold';colorGroup.append(g);} }   // v0.141: ✦ — в группе «Цвета»
    const spinControl=document.createElement('div');spinControl.className='hubMirrorSpinControl';
    spinButton=document.createElement('button');spinButton.type='button';spinButton.className='hubRhomb hubMirrorSpin';spinButton.title='Вращать зеркало; без зеркала — оригинал вокруг центра: пуск / пауза';spinButton.setAttribute('aria-label','Вращать ось: зеркало или оригинал');spinButton.onclick=()=>{resumeSpin=false;if(spinRunning)stopSpin();else startSpin();save();};spinControl.append(spinButton);
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
        moved: false, radius:state.screenPin&&e.target===turn, handle: e.target === handle, turn: state.screenPin||!state.on||e.target === turn||state.axisRotate };
      drag.startAngle = Math.atan2(my - drag.cy, mx - drag.cx);drag.inverse=window.HubView?.captureInverse?.();drag.applied=0;drag.visibleAngle=state.angle+(window.HubView?.rotation||0);
      root.setPointerCapture(e.pointerId);update();
    });
    root.addEventListener('pointermove', e => {
      if (!drag || drag.id !== e.pointerId) return;
      e.preventDefault(); e.stopPropagation();
      const [mx,my]=drag.inverse?drag.inverse(e.clientX,e.clientY+(matchMedia('(max-width:1100px)').matches?scrollY:0)):[e.clientX,e.clientY],dx=mx-drag.x,dy=my-drag.y;
      if(!Number.isFinite(mx)||!Number.isFinite(my))return;
      if (!drag.moved && Math.hypot(dx, dy) < 3) return;
      drag.moved = true;
      if(drag.radius)state.orbitRadius=Math.max(.02,Math.min(4,Math.hypot(mx-drag.cx,my-drag.cy)/Math.min(frame.width,frame.height)));
      if (drag.turn) {
        if (Math.hypot(mx - drag.cx, my - drag.cy) < 12) return;
        resumeSpin=false;stopSpin();let delta=Math.atan2(my-drag.cy,mx-drag.cx)-drag.startAngle;
        if(state.magnet)delta=snapAngle(drag.visibleAngle+delta)-drag.visibleAngle;
        turnField(delta-drag.applied);drag.applied=delta;
      } else {let x=frame.left+drag.px*frame.width+dx,y=drag.py*frame.height+dy;if(state.magnet&&!e.altKey)[x,y]=magneticPoint(x,y);moveAxis((x-frame.left)/frame.width,y/frame.height);}
      changed();
    });
    const finish = e => {
      if (!drag || drag.id !== e.pointerId) return;
      const done = drag; drag = null;update();
      if (root.hasPointerCapture(e.pointerId)) root.releasePointerCapture(e.pointerId);
      if (e.type === 'pointerup' && !done.moved && (done.handle || done.turn)) rotate(Math.PI / 12); else save();
    };
    root.addEventListener('pointerup', finish); root.addEventListener('pointercancel', finish);
    root.addEventListener('lostpointercapture', () => { if (drag) { drag = null; update(); save(); } });
    root.addEventListener('click', e => { e.stopPropagation(); if (e.detail === 0 && (e.target === handle || e.target === turn)) rotate(Math.PI / 12); });
    root.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); });   // v0.126: правая кнопка / долгое нажатие зеркало не выключают
    turn.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); rotate(Math.sign(e.deltaY) * Math.PI / 36); }, { passive: false });
    root.addEventListener('keydown', e => {
      if (!frame) return;
      const delta = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] })[e.key];
      if (!delta) return;
      e.preventDefault(); e.stopPropagation(); const step = e.shiftKey ? 20 : 4;
      if(!state.on){rotate((delta[0]||delta[1])*(e.shiftKey?15:5)*Math.PI/180);return;}
      moveAxis(state.x+delta[0]*step/frame.width,state.y+delta[1]*step/frame.height);
      changed(); save();
    });
    window.addEventListener('resize',()=>{if(state.screenPin)changed();});
    window.addEventListener('scroll',()=>{if(state.screenPin&&matchMedia('(max-width:1100px)').matches)changed();},{passive:true});
    update();
  }
  const api = window.HubMirror = {
    state, syncCenter:update, rotateBy:rotate, stopRotation:stopSpin, counterRotateView(delta){state.angle=turnAngle(state.angle-delta);save();}, get revision() { return revision; },
    home(){stopSpin();resumeSpin=false;Object.assign(state,{x:.5,y:.5,orbitRadius:.22,angle:state.magnet?snapAngle(AX0):AX0,autoCenter:true});changed();save();},
    // v0.126: ось по умолчанию — через середину треугольника (зовёт отрисовка хаба, когда знает, где он)
    centerOn(x,y){if(!frame||!state.autoCenter||state.screenPin)return;state.x=clamp((x-frame.left)/frame.width);state.y=clamp(y/frame.height);state.autoCenter=false;save();requestAnimationFrame(changed);},
    setBitCenters(points){bitCenters=points;},
    position(){return {x:state.x,y:state.y};},
    moveFrom(start,dx,dy){if(!frame)return;moveAxis(start.x+dx/frame.width,start.y+dy/frame.height);changed();save();},
    hit(x,y){let original=false,mirror=false;const read=(canvas,px,py)=>{const sx=canvas.width/(frame.left+frame.width),sy=canvas.height/frame.height,ix=Math.floor(px*sx),iy=Math.floor(py*sy);return ix>=0&&iy>=0&&ix<canvas.width&&iy<canvas.height&&canvas.getContext('2d').getImageData(ix,iy,1,1).data[3]>2;};if(!frame)return {source:false,mirror:false};const reflected=this.point(x,y,false),shift=window.HubView?.sourceShift()||[0,0];for(const canvas of liveSources){const image=buffers.get(canvas);if(!image)continue;original||=read(image,x-shift[0],y-shift[1]);if(reflected)mirror||=read(image,reflected[0]-shift[0],reflected[1]-shift[1]);}return {source:original,mirror};},
    colors(){if(state.palette===-1&&state.custom)return {...state.custom};const p=PALETTES[state.palette]||PALETTES[2];return {bit:p[1],mirror:p[2],fold:p[3],sym:p[4]||'#ffd166'};},
    symbolsOnly(){return state.bitView!=='rhombs';},
    drawSymbol(g,bit,x,y,size){
      if(!this.digitVisible(bit))return;
      g.save();g.translate(x,y);g.rotate(this.bitAngle(bit));
      if(state.bitView==='stars'){
        if(bit==='0'){g.beginPath();g.arc(0,0,Math.max(.35,size*.12),0,2*Math.PI);g.fill();}
        else{g.strokeStyle=g.fillStyle;g.lineWidth=Math.max(.35,size*.1);g.lineCap='round';g.beginPath();for(let i=0;i<3;i++){const a=i*Math.PI/3,dx=Math.cos(a)*size*.45,dy=Math.sin(a)*size*.45;g.moveTo(-dx,-dy);g.lineTo(dx,dy);}g.stroke();}
      }else{
        const text=state.bitView==='brackets'?(bit==='1'?')':'()'):bit;
        g.font=`bold ${size}px monospace`;g.textAlign='left';g.textBaseline='alphabetic';
        const m=g.measureText(text),l=m.actualBoundingBoxLeft||0,r=m.actualBoundingBoxRight??m.width,a=m.actualBoundingBoxAscent??size*.7,d=m.actualBoundingBoxDescent||0;
        g.fillText(text,(l-r)/2,(a-d)/2);
      }
      g.restore();
    },
    digitVisible(bit){return !(bit==='0'?state.hideZeroDigit:state.hideOneDigit);},
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
