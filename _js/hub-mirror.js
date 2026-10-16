/* Hub v0.159: радиальный жест проходит через центр и разворачивает луч на 180°. */
/* Hub v0.158: в режиме центр линия переносит исходник и отражение зеркально, ручка вращает. */
/* Hub v0.157: прямое управление ручкой в экранной плоскости при любом 3D-наклоне. */
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
  const state = { on: true, angle: AX0, x: .5, y: .5, autoCenter: true, screenPin:false, orbitRadius:.22, bitView:'rhombs', packedBits:false, zero: 0, one: 0, trace: false, bitSymmetry: true, parallelSymmetry:false,hideZeroDigit:false,hideOneDigit:false, symmetryMinimums:{minPairs:2,minRows:4}, pattern: 'horr',horrDefaultRevision:1,magnet:false,axisRotate:false,spinSpeed:30,gold:true,foldIn:false,palette:2,defaultsRevision:2,symAlpha:.95,bitAlpha:1,foldAlpha:1,custom:null }, clamp = v => Math.max(.01, Math.min(.99, v)), turnAngle = a => ((a % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI);
  try {
    const saved = JSON.parse(localStorage.getItem('zerk_hub_mirror') || 'null');
    if (saved) {
      state.autoCenter = saved.autoCenter === true;   // своё расположение — не трогать
      state.on = saved.on !== false;state.screenPin=saved.screenPin===true;if(Number.isFinite(saved.orbitRadius))state.orbitRadius=Math.max(0,Math.min(4,saved.orbitRadius));if(['rhombs','digits','brackets','parentheses','stars'].includes(saved.bitView))state.bitView=saved.bitView;
      state.trace = saved.trace === true;state.packedBits=saved.packedBits===true;
      state.bitSymmetry = saved.bitSymmetry !== false;state.parallelSymmetry=saved.parallelSymmetry===true;state.hideZeroDigit=saved.hideZeroDigit===true;state.hideOneDigit=saved.hideOneDigit===true;
      for(const key of ['minRows','minPairs'])if(Number.isFinite(saved.symmetryMinimums?.[key]))state.symmetryMinimums[key]=Math.max(1,Math.round(saved.symmetryMinimums[key]));
      state.magnet=saved.magnet!==false;state.gold=saved.gold!==false;if(saved.defaultsRevision!==2){state.gold=true;state.magnet=false;}   // v0.137: один раз — ✦ вкл, 🧲 выкл, и у сохранённых
      state.foldIn=saved.foldIn===true;if(Number.isFinite(saved.symAlpha))state.symAlpha=Math.max(0,Math.min(1,saved.symAlpha));for(const k of ['bitAlpha','foldAlpha'])if(Number.isFinite(saved[k]))state[k]=Math.max(0,Math.min(1.3,saved[k]));
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
  let colorGroup = null, frame = null, root = null, viewport = null, line = null, tail = null, handle = null, turn = null, orbit = null, dragHint = null, drag = null, revision = 0, enabled = null,bitCenters=[],bitCell=null,rotationBit=null,rotationGuide=false;
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
      if(Math.abs(delta)>1e-12){turnField(delta);snapAxisPosition();changed();}}
    spinTime=time;spinRaf=requestAnimationFrame(spinTick);
  }
  function startSpin(){if(spinRunning)return;spinRemainder=0;spinRunning=true;spinTime=0;spinRaf=requestAnimationFrame(spinTick);syncSpin();}
  // Rows are projections in the direction of the current stroke. Snap to a
  // bit/row coordinate or halfway between its two neighbouring coordinates.
  function magneticPoint(x,y,direction=state.angle+Math.PI/2){
    const co=Math.cos(direction),si=Math.sin(direction),u=x*co+y*si,shift=window.HubView?.sourceShift()||[0,0];
    let lo=-Infinity,hi=Infinity;
    for(const [px,py,bit] of bitCenters){if(bit!=='0'&&bit!=='1')continue;const v=(px+shift[0])*co+(py+shift[1])*si;if(v<=u)lo=Math.max(lo,v);if(v>=u)hi=Math.min(hi,v);}
    let target=u,distance=10/Math.max(.2,window.HubView?.scale||1);
    for(const v of [lo,hi,(lo+hi)/2])if(Number.isFinite(v)&&Math.abs(v-u)<=distance){distance=Math.abs(v-u);target=v;}
    return [x+(target-u)*co,y+(target-u)*si];
  }
  function snapAxisPosition(){
    if(!state.magnet||!frame||!state.on)return;
    const c=center(),p=magneticPoint(...c);
    if(state.screenPin)window.HubView?.shiftSourceBy(c[0]-p[0],c[1]-p[1]);
    else moveAxis((p[0]-frame.left)/frame.width,p[1]/frame.height);
  }

  const buffers = new WeakMap(),liveSources=new Set(),glyphMetrics=new Map(),cutoutSprites=new Map(),lastBitScroll={0:5,1:5};
  function glyphOffset(g,text,size){
    const key=g.font+'|'+text;let offset=glyphMetrics.get(key);
    if(!offset){const m=g.measureText(text),l=m.actualBoundingBoxLeft||0,r=m.actualBoundingBoxRight??m.width,a=m.actualBoundingBoxAscent??size*.7,d=m.actualBoundingBoxDescent||0;offset=[(l-r)/2,(a-d)/2];if(glyphMetrics.size>=128)glyphMetrics.clear();glyphMetrics.set(key,offset);}return offset;
  }
  function packedScale(g,text,size,width,height){
    if(!state.packedBits||state.bitView==='rhombs')return [1,1];
    const key=g.font+'|'+text+'|ink';let bounds=glyphMetrics.get(key);
    if(!bounds){const m=g.measureText(text);bounds=[(m.actualBoundingBoxLeft||0)+(m.actualBoundingBoxRight??m.width),(m.actualBoundingBoxAscent??size*.7)+(m.actualBoundingBoxDescent||0)];if(glyphMetrics.size>=128)glyphMetrics.clear();glyphMetrics.set(key,bounds);}
    return [width/Math.max(.01,bounds[0]),height/Math.max(.01,bounds[1])];
  }
  const save = () => { try { localStorage.setItem('zerk_hub_mirror', JSON.stringify(state)); } catch (_) {} };
  const center = () => [frame.left + frame.width * state.x, frame.height * state.y];
  function lockCenter(){if(!frame)return;if(state.screenPin){const p=window.HubView?.screenCenterAnchor?.();if(p?.every(Number.isFinite)){state.x=(p[0]-frame.left)/frame.width;state.y=p[1]/frame.height;}return;}if(state.on)return;const p=window.HubView?.originalCenter?.()||[frame.left+frame.width/2,frame.height/2];state.x=(p[0]-frame.left)/frame.width;state.y=p[1]/frame.height;}
  function axisTailLength(){
    if(!frame||!bitCell?.width||!bitCell?.height||window.HubImage?.active)return 0;
    const [cx,cy]=center(),shift=window.HubView?.sourceShift()||[0,0],dx=-Math.cos(state.angle),dy=-Math.sin(state.angle),hw=bitCell.width/2,hh=bitCell.height/2;
    const rotations=[state.zero,state.one].map(a=>[Math.cos(a*Math.PI/180),Math.sin(a*Math.PI/180)]);
    let far=0;
    for(const [x,y,bit] of bitCenters){
      const [co,si]=rotations[bit==='0'?0:1],ox=cx-x-shift[0],oy=cy-y-shift[1],u=(ox*co+oy*si)/hw,v=(-ox*si+oy*co)/hh,du=(dx*co+dy*si)/hw,dv=(-dx*si+dy*co)/hh;
      let lo=0,hi=Infinity;
      for(const [a,b] of [[1,1],[1,-1],[-1,1],[-1,-1]]){
        const slope=a*du+b*dv,room=1-a*u-b*v;
        if(Math.abs(slope)<1e-12){if(room<0){hi=-1;break;}}
        else if(slope>0)hi=Math.min(hi,room/slope);else lo=Math.max(lo,room/slope);
        if(hi<lo)break;
      }
      if(hi>=lo&&Number.isFinite(hi))far=Math.max(far,hi);
    }
    return far;
  }
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
    if(tail){const extent=axisTailLength();tail.style.width=extent+'px';tail.style.left=-extent+'px';}
    handle.style.transform = 'translateX(-50%) rotate(' + (-state.angle) + 'rad)';
    turn.style.left = radius + 'px';
    Object.assign(orbit.style,{left:(px-radius)+'px',top:(py-radius)+'px',width:(2*radius)+'px',height:(2*radius)+'px'});
    orbit.querySelector('polygon').setAttribute('transform','rotate('+(-(window.HubView?.rotation||0)*180/Math.PI)+')');
    window.HubView?.apply(root);handle.textContent = state.on ? '◇' : '×';
    handle.title = state.screenPin?'Тяни линию — зеркальный перенос пары; круглую ручку — поворот оси':state.on?'Ось: тяни линию, чтобы переместить отражение; круглая ручка поворачивает зеркало':'Ось закреплена в центре оригинала: только поворот';
    line.setAttribute('aria-label',state.screenPin?'Сдвинуть оригинал и отражение зеркально относительно неподвижной оси':state.on?'Переместить зеркало относительно оригинала':'Повернуть оригинал вокруг центра');
    handle.setAttribute('aria-label', 'Зеркало ' + (state.on ? 'включено' : 'выключено') + ', наклон ' + Math.round(turnAngle(state.angle+(window.HubView?.rotation||0)) * 180 / Math.PI) + ' градусов');
    line.title='Колесо у точки — поворот оси; над линией — сдвиг битов вдоль оси';
    turn.title = state.screenPin?'Вдоль оси — радиус, через центр — разворот луча; поперёк — поворот. Новое направление переключает действие без отпускания':state.on?'Повернуть зеркало относительно оригинала: тяни ручку или крути колесо':'Повернуть оригинал вокруг центра: тяни ручку';
    turn.title+='; колесо рядом — вращать только биты вокруг конца оси; ось неподвижна';
  };
  const changed = () => { revision++; update(); window.dispatchEvent(new Event('hubmirror')); };
  const visibleAngle=()=>state.angle+(window.HubView?.rotation||0),snapAngle=a=>Math.round(a/(Math.PI/12))*(Math.PI/12);
  function turnField(delta){if(state.on){state.angle=turnAngle(state.angle+delta);return;}lockCenter();if(frame&&window.HubView?.rotateAround)window.HubView.rotateAround(delta,...center());else state.angle=turnAngle(state.angle+delta);}
  function moveAxis(x,y){if(state.screenPin||!state.on){lockCenter();return;}state.x=clamp(x);state.y=clamp(y);}
  const rotate = delta => { resumeSpin=false;stopSpin();if(state.magnet&&delta){delta=Math.sign(delta)*Math.max(Math.PI/12,Math.round(Math.abs(delta)/(Math.PI/12))*(Math.PI/12));delta=snapAngle(visibleAngle()+delta)-visibleAngle();}turnField(delta);snapAxisPosition();changed();save(); };
  function init() {
    viewport=document.createElement('div');viewport.id='hubMirrorViewport';
    root = document.createElement('div'); root.id = 'hubMirror';
    line = document.createElement('div'); line.className = 'hubMirrorLine';line.tabIndex=0;line.setAttribute('role','button');line.setAttribute('aria-label','Переместить зеркало относительно оригинала');
    tail=document.createElement('span');tail.className='hubMirrorTail';tail.setAttribute('aria-hidden','true');
    handle = document.createElement('button'); handle.type = 'button'; handle.className = 'hubMirrorHandle';
    turn = document.createElement('button'); turn.type = 'button'; turn.className = 'hubMirrorTurn'; turn.setAttribute('aria-label', 'Повернуть зеркало');
    orbit=document.createElement('div');orbit.className='hubMirrorOrbit';orbit.setAttribute('aria-hidden','true');
    const polygonPoints=(n,r)=>Array.from({length:n},(_,i)=>{const a=i*2*Math.PI/n;return (r*Math.cos(a)).toFixed(5)+','+(r*Math.sin(a)).toFixed(5);}).join(' ');
    orbit.innerHTML='<svg viewBox="-100 -100 200 200" aria-hidden="true"><circle r="100"/><polygon points="'+polygonPoints(24,100)+'"/></svg>';
    turn.innerHTML='<svg class="hubMirrorTurnMagnet" viewBox="-14 -14 28 28" aria-hidden="true"><polygon points="'+polygonPoints(6,11)+'"/><polygon points="'+polygonPoints(6,7)+'"/></svg>';
    line.append(tail,handle, turn); root.append(orbit,line);viewport.append(root);document.body.append(viewport);
    dragHint=document.createElement('div');dragHint.className='hubAxisDragHint';dragHint.hidden=true;dragHint.setAttribute('aria-hidden','true');dragHint.innerHTML='<svg viewBox="-32 -32 64 64"><g class="along"><path d="M-14 -14H14M9 -19L14 -14 9 -9"/><path d="M14 14H-14M-9 9L-14 14 -9 19"/></g><g class="across"><path d="M0 -4V-28M-5 -23L0 -28 5 -23"/><path d="M0 4V28M-5 23L0 28 5 23"/></g></svg>';document.body.append(dragHint);
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
    const viewBox=document.createElement('details'),viewHead=document.createElement('summary'),viewOptions=document.createElement('div'),viewArrows=document.createElement('span');
    viewBox.className='hubTilt hubBitView';viewHead.setAttribute('aria-label','Вид битов');viewOptions.className='hubBitViewOptions';viewOptions.setAttribute('role','group');viewOptions.setAttribute('aria-label','Варианты вида битов');viewArrows.className='hubBitViewArrows';viewArrows.setAttribute('aria-hidden','true');viewArrows.innerHTML='<svg viewBox="0 0 48 60"><path d="M2 29 L24 51 L46 29 M2 35 L24 57 L46 35"/></svg>';
    const views=[['rhombs','◇1','Ромбы с цифрами'],['digits','1','Только цифры'],['brackets',')','Скобки: 1 = ), 0 = ()'],['parentheses',')(','Скобки: 1 = ), 0 = ('],['stars','*','Звезда и точка']];
    const syncView=()=>{const selected=views.find(v=>v[0]===state.bitView);viewHead.textContent=selected[1];viewHead.title=selected[2]+' — варианты при наведении';let visible=0;viewOptions.querySelectorAll('button').forEach(b=>{const selected=b.dataset.view===state.bitView;b.hidden=selected;if(!selected)b.style.setProperty('--view-offset',(visible++%2===0?12:-12)+'px');b.setAttribute('aria-pressed',String(selected));});};
    for(const [value,text,label] of views){const button=document.createElement('button');button.type='button';button.className='hubRhomb';button.dataset.view=value;button.textContent=text;button.title=label;button.setAttribute('aria-label',label);button.onclick=()=>{state.bitView=value;syncView();viewBox.open=false;changed();save();viewHead.focus();};viewOptions.append(button);}
    viewHead.addEventListener('click',e=>{if(e.pointerType==='mouse'){e.preventDefault();viewBox.open=true;}});
    viewBox.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')viewBox.open=true;});viewBox.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch')viewBox.open=false;});
    viewBox.append(viewHead,viewArrows,viewOptions);document.body.append(viewBox);syncView();
    const packing=document.createElement('button');packing.id='hubBitPacking';packing.type='button';packing.textContent='↔\nвстык';packing.setAttribute('aria-label','Биты без отступов');packing.title='Увеличить знаки до соприкосновения, сохранив центры битов';
    const syncPacking=()=>packing.setAttribute('aria-pressed',String(!!state.packedBits));
    packing.onclick=()=>{state.packedBits=!state.packedBits;syncPacking();changed();save();};syncPacking();document.body.append(packing);
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
      const wrap=document.createElement('label'),input=document.createElement('input'),m=document.createElement('b');wrap.className='hubColorSlot hubColorAlpha';wrap.style.gridArea=area;wrap.title=title;
      input.type='color';input.setAttribute('aria-label',title);
      const edit=e=>{e.preventDefault();e.stopPropagation();const alphaKey={bit:'bitAlpha',mirror:'bitAlpha',fold:'foldAlpha',sym:'symAlpha'}[key];window.HubColorPicker.open({trigger:input,title,color:api.colors()[key],opacity:state[alphaKey],maxOpacity:key==='sym'?1:1.3,onChange:(color,opacity)=>{if(state.palette!==-1){state.custom={...api.colors()};state.palette=-1;}state.custom[key]=color;state[alphaKey]=opacity;syncColors();changed();save();}});};
      input.addEventListener('click',edit);input.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')edit(e);});m.textContent=mark;wrap.append(input,m);inputs[key]=input;
      input.addEventListener('input',()=>{if(state.palette!==-1){state.custom={...api.colors()};state.palette=-1;}state.custom[key]=input.value;syncColors();changed();});input.addEventListener('change',save);
      colorGroup.append(wrap);}
    for(const [key,bit,area] of [['hideZeroDigit','0','d0'],['hideOneDigit','1','d1']]){
      const b=document.createElement('button');b.type='button';b.className='hubRhomb hubDigitToggle';b.style.gridArea=area;b.textContent=bit;b.title='Прозрачный вырез '+bit+' в ромбах';b.setAttribute('aria-label','Прозрачные цифры '+bit);b.setAttribute('aria-pressed',String(state[key]));
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
    for(const [key,text,title] of [['gold','✦','Золото: области, симметричные относительно оси'],['foldIn','⤵','Заворот: части отражения вне треугольника — ещё и отражённые от его сторон внутрь (сами остаются)'],['magnet','🧲','Магнит оси: центры битов и рядов, середины промежутков'],['screenPin','◎\nцентр','Конец оси в центре экрана'],['axisRotate','⟳','Вращать ось за линию вместо переноса']]){const b=document.createElement('button');b.type='button';b.className='hubRhomb';b.textContent=text;if(key==='screenPin')b.classList.add('hubAxisScreenPin');b.title=title;b.setAttribute('aria-label',title);b.setAttribute('aria-pressed',String(state[key]));b.onclick=()=>{state[key]=!state[key];if(key==='magnet'){spinRemainder=0;if(state.magnet){turnField(snapAngle(visibleAngle())-visibleAngle());snapAxisPosition();}}b.setAttribute('aria-pressed',String(state[key]));changed();save();};settings.append(b);}
    { const g=settings.querySelector('[aria-label^="Золото"]');if(g&&colorGroup){g.style.gridArea='gold';colorGroup.append(g);} }   // v0.141: ✦ — в группе «Цвета»
    const spinControl=document.createElement('div');spinControl.className='hubMirrorSpinControl';
    spinButton=document.createElement('button');spinButton.type='button';spinButton.className='hubRhomb hubMirrorSpin';spinButton.title='Вращать зеркало; без зеркала — оригинал вокруг центра: пуск / пауза';spinButton.setAttribute('aria-label','Вращать ось: зеркало или оригинал');spinButton.onclick=()=>{resumeSpin=false;if(spinRunning)stopSpin();else startSpin();save();};spinControl.append(spinButton);
    const spinLabel=document.createElement('label'),spinHead=document.createElement('span');spinLabel.className='hubMirrorSpeedControl';spinHead.append(document.createTextNode('Зеркало · '));spinValue=document.createElement('output');spinHead.append(spinValue);spinLabel.append(spinHead);
    spinValue.title='Двойной щелчок — скорость ×1';spinValue.ondblclick=()=>{state.spinSpeed=30;syncSpin();save();};
    spinRange=document.createElement('input');spinRange.type='range';spinRange.min=-100;spinRange.max=300;spinRange.step=1;spinRange.className='hubMirrorSpeed';spinRange.setAttribute('aria-label','Множитель скорости вращения зеркала');spinRange.oninput=()=>{state.spinSpeed=30*Math.pow(10,Number(spinRange.value)/100);syncSpin();};spinRange.onchange=save;spinLabel.append(spinRange);spinControl.append(spinLabel);settings.append(spinControl);syncSpin();
    window.addEventListener('hubmotionpause',e=>{if(e.detail.paused){resumeSpin=spinRunning;stopSpin();save();}else{if(resumeSpin)startSpin();resumeSpin=false;}});
    window.addEventListener('pagehide',()=>{stopSpin();save();});
    function showAxisHint(e,motion='all'){
      if(!dragHint)return;
      const a=state.angle+(window.HubView?.rotation||0),co=Math.cos(a),si=Math.sin(a),r=turn.getBoundingClientRect(),cx=r.x+r.width/2,cy=r.y+r.height/2,t=(e.target===turn||drag?.turn)?0:(e.clientX-cx)*co+(e.clientY-cy)*si;
      dragHint.hidden=false;dragHint.dataset.motion=motion;
      Object.assign(dragHint.style,{left:(cx+t*co)+'px',top:(cy+t*si)+'px',transform:'translate(-50%,-50%) rotate('+a+'rad)'});
    }
    const hoverAxisHint=e=>{if(drag)return;if((e.target===line||e.target===tail||e.target===turn)&&e.pointerType!=='touch')showAxisHint(e);else if(dragHint)dragHint.hidden=true;};
    root.addEventListener('pointerover',hoverAxisHint);
    root.addEventListener('pointerleave',()=>{if(!drag&&dragHint)dragHint.hidden=true;});
    const beginAxisDrag = (e,fromBackground=false) => {
      if(e.button===1&&e.target===turn){e.preventDefault();e.stopPropagation();return false;}
      if (e.button !== 0 || !frame) return false;
      const target=fromBackground?line:e.target;
      e.preventDefault(); e.stopPropagation();
      const source=state.screenPin&&target!==turn,ey=e.clientY+(matchMedia('(max-width:1100px)').matches?scrollY:0);
      let inverse=(source?window.HubView?.captureInverse?.():window.HubView?.captureAxisInverse?.())||window.HubView?.captureInverse?.(),p=inverse?inverse(e.clientX,ey):[e.clientX,ey];
      if(!p.every(Number.isFinite)){inverse=window.HubView?.captureAxisInverse?.();p=inverse?inverse(e.clientX,ey):p;}
      const [mx,my]=p;if(!Number.isFinite(mx)||!Number.isFinite(my))return;
      drag = { id: e.pointerId, x: mx, y: my, px: state.x, py: state.y, angle: state.angle,
        cx: frame.left + frame.width * state.x, cy: frame.height * state.y,
        moved:false,knob:target===turn,source,sourceX:0,sourceY:0,mode:null,radius0:Math.min(frame.width,frame.height)*state.orbitRadius,radius:state.screenPin&&target===turn,handle:target===handle,turn:!source&&(!state.on||target===turn||state.axisRotate) };
      drag.lastX=mx;drag.lastY=my;drag.captureRotation=window.HubView?.rotation||0;drag.axisAngle=state.angle;drag.startAngle=drag.angle;drag.inverse=inverse;drag.applied=0;drag.visibleAngle=state.angle+(window.HubView?.rotation||0);
      resumeSpin=false;stopSpin();root.setPointerCapture(e.pointerId);update();return true;
    };
    window.HubMirror.grabAxis=e=>beginAxisDrag(e,true);
    root.addEventListener('pointerdown',e=>beginAxisDrag(e));
    root.addEventListener('pointermove', e => {
      if(!drag){hoverAxisHint(e);return;}
      if(drag.id !== e.pointerId)return;
      e.preventDefault(); e.stopPropagation();
      let [mx,my]=drag.inverse?drag.inverse(e.clientX,e.clientY+(matchMedia('(max-width:1100px)').matches?scrollY:0)):[e.clientX,e.clientY],dx=mx-drag.x,dy=my-drag.y;
      if(!Number.isFinite(mx)||!Number.isFinite(my))return;
      if (!drag.moved && Math.hypot(dx, dy)*(window.HubView?.scale||1) < 3) return;
      drag.moved = true;
      if(drag.radius||drag.source||!drag.turn){
        const angle=state.angle+(drag.source?0:(window.HubView?.rotation||0)-drag.captureRotation),co=Math.cos(angle),si=Math.sin(angle);
        const sx=mx-drag.lastX,sy=my-drag.lastY,along=sx*co+sy*si,across=-sx*si+sy*co;
        const next=Math.abs(along)>Math.abs(across)*1.5?'radius':Math.abs(across)>Math.abs(along)*1.5?'angle':null;
        if(drag.mode&&next&&next!==drag.mode){
          if(drag.candidate!==next){drag.candidate=next;drag.candidateX=drag.lastX;drag.candidateY=drag.lastY;}
          const distance=Math.hypot(mx-drag.candidateX,my-drag.candidateY)*(window.HubView?.scale||1);
          if(distance>=6){
            drag.mode=next;drag.x=drag.candidateX;drag.y=drag.candidateY;drag.angle=angle;drag.axisAngle=state.angle;
            drag.radius0=Math.min(frame.width,frame.height)*state.orbitRadius;drag.startAngle=angle;drag.visibleAngle=state.angle+(window.HubView?.rotation||0);drag.applied=0;drag.sourceX=drag.sourceY=0;drag.px=state.x;drag.py=state.y;drag.candidate=null;
          }
        }else if(!next||next===drag.mode)drag.candidate=null;
        drag.lastX=mx;drag.lastY=my;
        if(!drag.mode)drag.mode=next||(Math.abs(along)>Math.abs(across)?'radius':'angle');
      }
      const segmentX=mx-drag.x,segmentY=my-drag.y;
      if(drag.radius){const radial=segmentX*Math.cos(drag.angle)+segmentY*Math.sin(drag.angle),tangent=-segmentX*Math.sin(drag.angle)+segmentY*Math.cos(drag.angle);
        if(!drag.mode)drag.mode=drag.radius0<12||Math.abs(radial)>Math.abs(tangent)?'radius':'angle';
        if(drag.mode==='radius'){const signed=drag.radius0+radial;state.orbitRadius=Math.min(4,Math.abs(signed)/Math.min(frame.width,frame.height));state.angle=turnAngle(drag.axisAngle+(signed<0?Math.PI:0));changed();showAxisHint(e,'along');return;}
      }
      if(drag.source){const a=drag.angle+(drag.mode==='angle'?Math.PI/2:0),co=Math.cos(a),si=Math.sin(a),distance=segmentX*co+segmentY*si;let dx=distance*co-drag.sourceX,dy=distance*si-drag.sourceY;
        if(state.magnet&&!e.altKey){const c=center(),p=magneticPoint(c[0]-dx,c[1]-dy,a);dx=c[0]-p[0];dy=c[1]-p[1];}
        window.HubView?.shiftSourceBy(dx,dy);drag.sourceX+=dx;drag.sourceY+=dy;}
      else if (drag.turn) {
        if (Math.hypot(mx - drag.cx, my - drag.cy) < 12) return;
        let delta=Math.atan2(my-drag.cy,mx-drag.cx)-drag.startAngle;
        if(state.magnet&&!e.altKey)delta=snapAngle(drag.visibleAngle+delta)-drag.visibleAngle;
        turnField(delta-drag.applied);drag.applied=delta;if(!e.altKey)snapAxisPosition();
      } else {const a=drag.angle+(drag.mode==='angle'?Math.PI/2:0),co=Math.cos(a),si=Math.sin(a),distance=segmentX*co+segmentY*si;let x=frame.left+drag.px*frame.width+distance*co,y=drag.py*frame.height+distance*si;if(state.magnet&&!e.altKey)[x,y]=magneticPoint(x,y,a);moveAxis((x-frame.left)/frame.width,y/frame.height);}
      changed();
      if(drag.mode||drag.turn)showAxisHint(e,drag.mode==='radius'?'along':'across');
    });
    const finish = e => {
      if (!drag || drag.id !== e.pointerId) return;
      const done = drag; drag = null;if(dragHint)dragHint.hidden=true;update();if(e.type==='pointerup'&&[line,tail,turn].includes(document.elementFromPoint?.(e.clientX,e.clientY)))showAxisHint(e);
      if (root.hasPointerCapture(e.pointerId)) root.releasePointerCapture(e.pointerId);
      if(e.type==='pointerup'&&!done.moved&&done.knob)window.HubView?.repeatScrollRotation?.();
      else if (e.type === 'pointerup' && !done.source && !done.moved && (done.handle || done.turn)) rotate(Math.PI / 12); else save();
    };
    root.addEventListener('pointerup', finish); root.addEventListener('pointercancel', finish);
    root.addEventListener('lostpointercapture', () => { if (drag) { drag = null;if(dragHint)dragHint.hidden=true; update(); save(); } });
    root.addEventListener('click', e => { e.stopPropagation(); if(e.detail===0&&e.target===turn)window.HubView?.repeatScrollRotation?.();else if(e.detail===0&&e.target===handle)rotate(Math.PI/12); });
    root.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); });   // v0.126: правая кнопка / долгое нажатие зеркало не выключают
    turn.addEventListener('auxclick',e=>{if(e.button===1){e.preventDefault();e.stopPropagation();window.HubView?.repeatScrollRotation?.();}});
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
    state, syncCenter:update, rotateBy:rotate,axisTailLength,
    wheelAlong(delta){if(!frame||!window.HubView?.shiftSourceBy)return false;const step=Math.sign(delta)*24/(window.HubView.scale||1);window.HubView.shiftSourceBy(step*Math.cos(state.angle),step*Math.sin(state.angle));return true;},
    wheelZoneAt(x,y){
      if(!frame||!handle||document.body.classList.contains('hubAutoTurning')||document.body.classList.contains('hubMirrorSpinning'))return false;
      const near=el=>{const r=el.getBoundingClientRect();return r.width&&Math.hypot(x-r.x-r.width/2,y-r.y-r.height/2)<=42;};
      const p=window.HubView?.axisInverse?.(x,y+(matchMedia('(max-width:1100px)').matches?scrollY:0)),c=center();
      if(near(turn))return 'bits';
      if(p&&Math.hypot(p[0]-c[0],p[1]-c[1])*(window.HubView.scale||1)<=28)return 'axis';
      return false;
    },
    wheelStep(zone,delta){if(zone==='axis'){rotate(Math.sign(delta)*Math.PI/36);return true;}if(zone==='bits'){window.HubView?.rotateBitsBy?.(Math.sign(delta)*5,center());return true;}return false;},
    wheelAt(x,y,delta){return this.wheelStep(this.wheelZoneAt(x,y),delta);}, stopRotation:stopSpin, counterRotateView(delta){state.angle=turnAngle(state.angle-delta);save();}, get revision() { return revision; },
    home(){stopSpin();resumeSpin=false;Object.assign(state,{x:.5,y:.5,orbitRadius:.22,angle:state.magnet?snapAngle(AX0):AX0,autoCenter:true});changed();save();},
    // v0.126: ось по умолчанию — через середину треугольника (зовёт отрисовка хаба, когда знает, где он)
    centerOn(x,y){if(!frame||!state.autoCenter||state.screenPin)return;state.x=clamp((x-frame.left)/frame.width);state.y=clamp(y/frame.height);state.autoCenter=false;save();requestAnimationFrame(changed);},
    setBitCenters(points,cell=null){bitCenters=points;bitCell=cell;if(tail){const extent=axisTailLength();tail.style.width=extent+'px';tail.style.left=-extent+'px';}},
    position(){return {x:state.x,y:state.y};},
    moveFrom(start,dx,dy){if(!frame)return;moveAxis(start.x+dx/frame.width,start.y+dy/frame.height);changed();save();},
    bitAt(x,y,mirror=false){return this.pickBit(x,y,mirror)?.bit??null;},
    pickBit(x,y,mirror=false){
      if(!frame||!bitCell||window.HubImage?.active)return null;
      if(mirror){if(!state.on)return null;const p=this.point(x,y,false);if(!p)return null;[x,y]=p;}
      const shift=window.HubView?.sourceShift()||[0,0];x-=shift[0];y-=shift[1];
      for(let i=bitCenters.length-1;i>=0;i--){const [cx,cy,bit]=bitCenters[i];if(bit!=='0'&&bit!=='1')continue;const angle=this.symbolsOnly()?0:this.bitAngle(bit),co=Math.cos(angle),si=Math.sin(angle),dx=x-cx,dy=y-cy;if(Math.abs(dx*co+dy*si)/(bitCell.width/2)+Math.abs(-dx*si+dy*co)/(bitCell.height/2)<=1+1e-9)return {bit,index:i,mirror};}
      return null;
    },
    centerBit(){
      if(!bitCell||window.HubImage?.active)return null;
      const c=window.HubView?.originalCenter?.();if(!c)return null;
      const sh=window.HubView?.sourceShift()||[0,0],x=c[0]-sh[0],y=c[1]-sh[1];let best=null,distance=Infinity;
      for(const [px,py,bit] of bitCenters){if(bit!=='0'&&bit!=='1')continue;const d=(px-x)**2+(py-y)**2;if(d<distance){distance=d;best={x:px,y:py,bit,width:bitCell.width,height:bitCell.height};}}
      return best;
    },
    drawCenterBit(g,p){
      const size=Math.min(p.width,p.height)*.62,a=p.width*(state.packedBits?.5:.45),b=p.height*(state.packedBits?.5:.45);
      g.fillStyle=this.colors().sym;g.globalAlpha=1;
      if(!this.symbolsOnly()&&!this.fillCutoutRhomb(g,p.bit,0,0,a,b,size)){g.save();g.rotate(this.bitAngle(p.bit));g.beginPath();g.moveTo(0,-b);g.lineTo(a,0);g.lineTo(0,b);g.lineTo(-a,0);g.closePath();g.fill();g.restore();}
      if(this.symbolsOnly()||p.width>=7){if(!this.symbolsOnly())g.fillStyle='#06150d';this.drawSymbol(g,p.bit,0,0,size,p.width,p.height);}
    },
    selectRotationBit(hit){rotationBit=hit;rotationGuide=false;},
    clearRotationBit(){const visible=rotationGuide;rotationBit=null;rotationGuide=false;if(visible)changed();},
    drawRotationGuides(g,mirror=false){
      if(!rotationGuide||!rotationBit||!bitCell)return;
      const arcs=state.bitView==='brackets'||state.bitView==='parentheses';
      if(!arcs&&rotationBit.mirror!==mirror)return;
      const chosen=rotationBit.bit,points=arcs?bitCenters.filter(p=>p[2]===chosen):[bitCenters[rotationBit.index]];
      const a=bitCell.width*(state.packedBits?.5:.45),b=bitCell.height*(state.packedBits?.5:.45),size=state.packedBits&&state.bitView==='stars'?bitCell.width:Math.min(bitCell.width,bitCell.height)*.62,length=Math.max(a,b)*6;
      g.save();g.strokeStyle=this.colors()[mirror?'mirror':'bit'];g.globalAlpha=.3;g.shadowBlur=0;g.lineWidth=.7/Math.max(.2,window.HubView?.scale||1);
      for(const p of points){if(!p||p[2]!==chosen)continue;g.save();g.translate(p[0],p[1]);g.rotate(this.bitAngle(chosen));g.beginPath();
        if(arcs){if(state.packedBits){const text=state.bitView==='brackets'&&chosen==='0'?'()':chosen==='1'?')':'(';g.font=`bold ${size}px monospace`;g.scale(...packedScale(g,text,size,bitCell.width,bitCell.height));}const offsets=state.bitView==='brackets'&&chosen==='0'?[-.17,.17]:[chosen==='1'?-.37:.37];for(const offset of offsets){g.moveTo((offset+.55)*size,0);g.arc(offset*size,0,size*.55,0,2*Math.PI);}}
        else if(state.bitView==='stars'){for(let i=0;i<6;i++){const angle=i*Math.PI/3,x=Math.cos(angle),y=Math.sin(angle);g.moveTo(x*size*.45,y*size*.45);g.lineTo(x*length,y*length);}}
        else{const vertices=[[0,-b],[a,0],[0,b],[-a,0]];for(let i=0;i<4;i++){const p=vertices[i],q=vertices[(i+1)%4],d=Math.hypot(q[0]-p[0],q[1]-p[1]),x=(q[0]-p[0])/d*length,y=(q[1]-p[1])/d*length;g.moveTo(...p);g.lineTo(p[0]-x,p[1]-y);g.moveTo(...q);g.lineTo(q[0]+x,q[1]+y);}}
        g.stroke();g.restore();
      }g.restore();
    },
    tiltBit(bit,delta=null){
      if(bit!=='0'&&bit!=='1')return false;rotationGuide=rotationBit?.bit===bit;if(delta!==null&&delta!==0)lastBitScroll[bit]=delta;
      const key=bit==='0'?'zero':'one';state[key]=Math.max(-60,Math.min(60,state[key]+lastBitScroll[bit]));
      const range=document.querySelector?.('input[aria-label="Наклон ромбов '+bit+'"]');if(range){range.value=state[key];range.closest('.hubTilt').querySelector('output').textContent=state[key]+'°';}changed();save();return true;
    },
    hit(x,y){
      if(!frame)return {source:false,mirror:false};
      const reflected=this.point(x,y,false),shift=window.HubView?.sourceShift()||[0,0];
      // Glyph gaps belong to the logical bit cell, regardless of ink or bit rotation.
      if(this.symbolsOnly()&&!window.HubImage?.active&&bitCell?.width>0&&bitCell?.height>0){
        const cellHit=(px,py)=>bitCenters.some(([cx,cy])=>Math.abs(px-shift[0]-cx)/(bitCell.width/2)+Math.abs(py-shift[1]-cy)/(bitCell.height/2)<=1+1e-9);
        return {source:cellHit(x,y),mirror:!!reflected&&cellHit(...reflected)};
      }
      let original=false,mirror=false;
      const read=(canvas,px,py)=>{const sx=canvas.width/(frame.left+frame.width),sy=canvas.height/frame.height,ix=Math.floor(px*sx),iy=Math.floor(py*sy);return ix>=0&&iy>=0&&ix<canvas.width&&iy<canvas.height&&canvas.getContext('2d').getImageData(ix,iy,1,1).data[3]>2;};
      for(const canvas of liveSources){const image=buffers.get(canvas);if(!image)continue;original||=read(image,x-shift[0],y-shift[1]);if(reflected)mirror||=read(image,reflected[0]-shift[0],reflected[1]-shift[1]);}
      return {source:original,mirror};
    },
    rotationCenter(){return frame?center():null;},
    colors(){if(state.palette===-1&&state.custom)return {...state.custom};const p=PALETTES[state.palette]||PALETTES[2];return {bit:p[1],mirror:p[2],fold:p[3],sym:p[4]||'#ffd166'};},
    symbolsOnly(){return state.bitView!=='rhombs';},
    fillCutoutRhomb(g,bit,x,y,a,b,size,angle=this.bitAngle(bit)){
      if(this.symbolsOnly()||this.digitVisible(bit)||size<=0)return false;
      const m=g.getTransform(),scale=Math.max(2,Math.min(8,Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d))));
      const key=[bit,a,b,size,g.fillStyle,scale].join('|');let sprite=cutoutSprites.get(key);
      if(!sprite){
        const canvas=document.createElement('canvas'),w=Math.ceil(a*2*scale)+4,h=Math.ceil(b*2*scale)+4;canvas.width=w;canvas.height=h;
        const c=canvas.getContext('2d');c.setTransform(scale,0,0,scale,w/2,h/2);c.fillStyle=g.fillStyle;
        c.beginPath();c.moveTo(0,-b);c.lineTo(a,0);c.lineTo(0,b);c.lineTo(-a,0);c.closePath();c.fill();
        // Cut only this tile; destination layers remain untouched through the glyph.
        c.globalCompositeOperation='destination-out';c.fillStyle='#000';c.font=`bold ${size}px monospace`;c.textAlign='left';c.textBaseline='alphabetic';c.fillText(bit,...glyphOffset(c,bit,size));
        sprite={canvas,w:w/scale,h:h/scale};if(cutoutSprites.size>=96)cutoutSprites.clear();cutoutSprites.set(key,sprite);
      }
      g.save();g.translate(x,y);g.rotate(angle);g.shadowBlur=0;g.drawImage(sprite.canvas,-sprite.w/2,-sprite.h/2,sprite.w,sprite.h);g.restore();return true;
    },
    drawSymbol(g,bit,x,y,size,width=size/.62,height=width*Math.sqrt(3)){
      if(!this.digitVisible(bit))return;
      g.save();g.translate(x,y);g.rotate(this.bitAngle(bit));
      if(state.bitView==='stars'){
        if(state.packedBits)size=width;
        if(bit==='0'){g.beginPath();g.arc(0,0,state.packedBits?width/2:Math.max(.35,size*.12),0,2*Math.PI);g.fill();}
        else{g.strokeStyle=g.fillStyle;g.lineWidth=Math.max(.35,size*.1);g.lineCap='round';g.beginPath();for(let i=0;i<3;i++){const a=i*Math.PI/3,dx=Math.cos(a)*size*.45,dy=Math.sin(a)*size*.45;g.moveTo(-dx,-dy);g.lineTo(dx,dy);}g.stroke();}
      }else{
        const text=state.bitView==='brackets'?(bit==='1'?')':'()'):state.bitView==='parentheses'?(bit==='1'?')':'('):bit;
        g.font=`bold ${size}px monospace`;g.textAlign='left';g.textBaseline='alphabetic';
        const offset=glyphOffset(g,text,size);
        if(state.packedBits&&this.symbolsOnly())g.scale(...packedScale(g,text,size,width,height));
        g.fillText(text,...offset);
      }
      g.restore();
    },
    drawSymbolBatch(g,bit,points,size,color,alpha,width=size/.62,height=width*Math.sqrt(3)){
      if(!this.digitVisible(bit)||!points.length)return;
      const angle=this.bitAngle(bit),co=Math.cos(angle),si=Math.sin(angle),text=state.bitView==='brackets'?(bit==='1'?')':'()'):state.bitView==='parentheses'?(bit==='1'?')':'('):bit;
      g.save();g.rotate(angle);g.font=`bold ${size}px monospace`;g.textAlign='left';g.textBaseline='alphabetic';g.fillStyle=color;g.globalAlpha=alpha;
      const [ox,oy]=glyphOffset(g,text,size);
      const [sx,sy]=packedScale(g,text,size,width,height);if(state.packedBits&&this.symbolsOnly())g.scale(sx,sy);
      for(const [x,y] of points)g.fillText(text,(x*co+y*si)/sx+ox,(-x*si+y*co)/sy+oy);
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
