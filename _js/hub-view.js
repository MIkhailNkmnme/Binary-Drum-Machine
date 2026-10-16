/* Hub v0.153: координата неподвижного экранного центра для тестовой оси. */
/* Hub v0.151: дискретное вращение с магнитом без потери дробной фазы. */
/* Hub v0.149: угол под скоростью; пауза сохраняет бегунок, ноль сбрасывает угол. */
/* Hub v0.148: ромб-бегунок, нулевая скорость, узкая линия и полуромбы по краям. */
/* Hub v0.146: центр оригинала закрепляет ось без зеркала; на автокручении ось скрыта. */
/* Hub v0.145: ось переносит исходник и поворачивает поле вокруг своей точки. */
/* Hub v0.142: overlay() — draw over the field in field coordinates under the camera only. */
/* Hub v0.138: ↺ 0° ↻ moved next to + and − — a cross at the right edge. */
/* Hub v0.130: a displaced source is always redrawn as vector — the cached bitmap had lost what was off-screen. */
/* Hub v0.116: compose displacement, mirror and camera before clipping to the viewport. */
/* Hub v0.114: always available zoom and one-click recovery of the whole drawing. */
(() => {
  'use strict';
  const state={unlocked:false,zoom:1,angle:0,flip:0,flipRate:1,pan:[0,0],sourcePan:[0,0],spinRate:.25,spinDirection:1},buffers=new WeakMap();let frame=null,revision=0,unlock,scaleText,angleText,rotationValue,minus,plus,flipButton,flipRateRange,flipRateValue,flipRunning=false,flipRaf=0,flipTime=0;
  try{const saved=JSON.parse(localStorage.getItem('zerk_hub_view')||'null');if(saved){state.unlocked=!!saved.unlocked;for(const key of ['zoom','angle','flipRate'])if(Number.isFinite(saved[key]))state[key]=saved[key];if(Array.isArray(saved.pan)&&saved.pan.length===2&&saved.pan.every(Number.isFinite))state.pan=saved.pan;}}catch(_){}
  try{const saved=JSON.parse(localStorage.getItem('zerk_hub_view')||'null');if(Array.isArray(saved?.sourcePan)&&saved.sourcePan.length===2&&saved.sourcePan.every(Number.isFinite))state.sourcePan=saved.sourcePan;}catch(_){}
  state.zoom=Math.max(.2,Math.min(6,state.zoom));state.angle=state.angle===360?360:((state.angle%360)+360)%360;
  state.flipRate=Math.max(.1,Math.min(1000,state.flipRate));
  try{const saved=JSON.parse(localStorage.getItem('zerk_hub_view')||'null');if(Number.isFinite(saved?.flip))state.flip=((saved.flip%360)+360)%360;}catch(_){}
  let sourceCenter=null,autoRunning=false,autoRaf=0,autoTime=null,autoButton,autoRange,autoNumber,autoValue,autoTrack,turnLeft,turnRight,autoDrag=false,autoZero=true,resumeAuto=false,autoRemainder=0;
  try{const saved=JSON.parse(localStorage.getItem('zerk_hub_view')||'null');if(Number.isFinite(saved?.spinRate))state.spinRate=Math.max(.01,Math.min(10000,saved.spinRate));if(saved?.spinDirection===-1)state.spinDirection=-1;}catch(_){}
  const save=()=>{try{localStorage.setItem('zerk_hub_view',JSON.stringify(state));}catch(_){}};
  const center=()=>frame?[frame.left+frame.width/2,frame.height/2]:[innerWidth/2,innerHeight/2];
  function matrix(){const [x,y]=center(),a=state.angle*Math.PI/180,c=Math.cos(a)*state.zoom,s=Math.sin(a)*state.zoom,m=window.HubMirror?.state,axis=m?.angle??Math.PI/2,u=Math.cos(axis),v=Math.sin(axis),k=Math.cos(state.flip*Math.PI/180),aa=u*u+k*v*v,ab=(1-k)*u*v,bb=v*v+k*u*u,mx=frame?frame.left+frame.width*(m?.x??.5):x,my=frame?frame.height*(m?.y??.5):y,tx=mx-aa*mx-ab*my,ty=my-ab*mx-bb*my;return [c*aa-s*ab,s*aa+c*ab,c*ab-s*bb,s*ab+c*bb,x+state.pan[0]-c*x+s*y+c*tx-s*ty,y+state.pan[1]-s*x-c*y+s*tx+c*ty];}
  function inverseWith(m,x,y){const [a,b,c,d,e,f]=m,det=a*d-b*c;if(Math.abs(det)<1e-8)return [NaN,NaN];return [(d*(x-e)-c*(y-f))/det,(-b*(x-e)+a*(y-f))/det];}
  function inverse(x,y){return inverseWith(matrix(),x,y);}
  // The axis anchor is unchanged by the 3D flip about itself, even edge-on.
  function screenCenterAnchor(){const [cx,cy]=center(),a=state.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=innerWidth/2-cx-state.pan[0],y=innerHeight/2+(matchMedia('(max-width:1100px)').matches?scrollY:0)-cy-state.pan[1];return [cx+(c*x+s*y)/state.zoom,cy+(-s*x+c*y)/state.zoom];}
  function captureInverse(){const m=matrix();return (x,y)=>inverseWith(m,x,y);}
  function rotateAround(delta,x,y,persist=true){if(!Number.isFinite(delta))return;const before=matrix(),px=before[0]*x+before[2]*y+before[4],py=before[1]*x+before[3]*y+before[5];state.angle=((state.angle+delta*180/Math.PI)%360+360)%360;const after=matrix();state.pan[0]+=px-(after[0]*x+after[2]*y+after[4]);state.pan[1]+=py-(after[1]*x+after[3]*y+after[5]);changed(persist);}
  function shiftSourceBy(dx,dy){if(!frame)return;state.sourcePan[0]+=dx/frame.width;state.sourcePan[1]+=dy/frame.height;changed();}
  const sourceShift=()=>frame?[state.sourcePan[0]*frame.width,state.sourcePan[1]*frame.height]:[0,0];
  function apply(el){if(!el)return;const [a,b,c,d,e,f]=matrix(),x=el.offsetLeft,y=el.offsetTop,[sx,sy]=el.id==='hubMirror'||el.dataset.note?.includes('-mirror')?[0,0]:sourceShift();el.style.transformOrigin='0 0';el.style.transform=`matrix(${a},${b},${c},${d},${e+a*(x+sx)+c*(y+sy)-x},${f+b*(x+sx)+d*(y+sy)-y})`;}
  function sync(){if(!unlock)return;unlock.textContent=state.unlocked?'🔓':'🔒';unlock.setAttribute('aria-pressed',String(state.unlocked));unlock.title=state.unlocked?'За биты перемещается весь рисунок вместе с осью. Колесо и +/− меняют масштаб всегда':'Разрешить перенос всего рисунка вместе с осью за биты. За пустое место всё поле тянется всегда';scaleText.textContent=Math.round(state.zoom*100)+'%';angleText.textContent=Number(state.angle.toFixed(1))+'°';rotationValue.textContent=angleText.textContent;minus.disabled=state.zoom<=.2;plus.disabled=state.zoom>=6;document.body.classList.toggle('hubCanvasUnlocked',state.unlocked);syncAuto();}
  function changed(persist=true){window.HubMirror?.syncCenter?.();revision++;sync();if(flipButton){flipButton.textContent='3D\n'+(flipRunning?'Ⅱ':'▶');flipButton.setAttribute('aria-pressed',String(flipRunning));flipButton.title='Переворот вокруг оси зеркала: '+Math.round(state.flip)+'°. Щелчок — пуск / пауза, колесо — шаг 5°, двойной щелчок — 0°';}document.querySelectorAll('#hubMirror,#hubAll,.hubNoteCell,#hubFly').forEach(apply);if(persist)save();window.dispatchEvent(new Event('hubview'));}
  function flipTick(time){flipRaf=0;if(!flipRunning)return;if(flipTime&&!document.hidden)state.flip=(state.flip+Math.min(100,time-flipTime)*.03*state.flipRate)%360;flipTime=time;changed(false);flipRaf=requestAnimationFrame(flipTick);}
  function stopFlip(){flipRunning=false;flipTime=0;cancelAnimationFrame(flipRaf);flipRaf=0;}
  let fieldPaused=false,resumeFlip=false;
  function zoom(factor,x,y){const before=state.zoom,next=Math.max(.2,Math.min(6,before*factor)),ratio=next/before,[cx,cy]=center();state.pan=[x-cx-(x-cx-state.pan[0])*ratio,y-cy-(y-cy-state.pan[1])*ratio];state.zoom=next;changed();}
  function home(){autoZero=true;stopAuto();stopFlip();fieldPaused=false;resumeFlip=resumeAuto=false;Object.assign(state,{zoom:1,angle:0,flip:0,pan:[0,0],sourcePan:[0,0]});window.HubMirror.home();changed();}
  function originalCenter(){const c=sourceCenter||center(),sh=sourceShift();return [c[0]+sh[0],c[1]+sh[1]];}
  const ratePosition=rate=>rate>0?1+100*(Math.log10(Math.max(.01,rate))+2):0;
  const positionRate=pos=>pos<=0?0:Number((10**((pos-1)/100-2)).toPrecision(5));
  function syncAuto(){document.body.classList.toggle('hubAutoTurning',autoRunning);if(!autoButton)return;const rate=autoZero?0:state.spinRate,pos=ratePosition(rate);autoButton.textContent='';autoButton.setAttribute('aria-pressed',String(autoRunning));autoButton.title='Автокручение: '+rate+' об/с; '+(autoRunning?'вращается':'пауза')+'; тяни ромб, 0 — стоп и угол 0°; щелчок — пуск / пауза';autoButton.style.left=(12+(78-24)*pos/601)+'px';autoRange.value=pos;autoRange.setAttribute('aria-valuetext',rate+' об/с');if(document.activeElement!==autoNumber)autoNumber.value=rate;autoValue.textContent=rate+' об/с';for(const [b,d] of [[turnLeft,-1],[turnRight,1]]){if(!b)continue;const label=autoRunning?(d<0?'Уменьшить скорость вращения':'Увеличить скорость вращения'):(d<0?'Повернуть поле на −15°':'Повернуть поле на +15°');b.setAttribute('aria-label',label);b.title=autoRunning?label+' (×'+(d<0?'1/1,1':'1,1')+')':label;}}

  const magnetic=()=>window.HubMirror?.state.magnet===true;
  const snappedRotation=a=>{const offset=(window.HubMirror?.state.angle||0)*180/Math.PI;return Math.round((a+offset)/15)*15-offset;};
  function autoTick(time){autoRaf=0;if(!autoRunning)return;if(autoTime!==null&&!document.hidden){const turns=(Math.max(0,time-autoTime)/1000*state.spinRate)%1;let delta=state.spinDirection*turns*360;if(magnetic()){autoRemainder+=delta;delta=snappedRotation(state.angle+autoRemainder)-state.angle;autoRemainder-=delta;}else autoRemainder=0;if(Math.abs(delta)>1e-10)rotateAround(delta*Math.PI/180,...originalCenter(),false);}autoTime=time;autoRaf=requestAnimationFrame(autoTick);}
  function startAuto(){autoZero=false;if(autoRunning)return;autoRemainder=0;if(state.spinRate<=0)state.spinRate=.25;autoRunning=true;autoTime=null;autoRaf=requestAnimationFrame(autoTick);syncAuto();}
  function stopAuto(){autoRemainder=0;autoRunning=false;autoTime=null;cancelAnimationFrame(autoRaf);autoRaf=0;syncAuto();save();}
  function setAutoRate(value){if(!Number.isFinite(value))return;if(value<=0){autoZero=true;stopAuto();rotateAround(-state.angle*Math.PI/180,...originalCenter());return;}autoZero=false;state.spinRate=Math.max(.01,Math.min(10000,value));autoRemainder=0;autoTime=null;startAuto();syncAuto();save();}
  function rotate(delta){if(delta)state.spinDirection=Math.sign(delta);autoTime=null;autoRemainder=0;if(magnetic()&&delta){delta=Math.sign(delta)*Math.max(15,Math.round(Math.abs(delta)/15)*15);delta=snappedRotation(state.angle+delta)-state.angle;}rotateAround(delta*Math.PI/180,...originalCenter());}
  window.HubView={get revision(){return revision;},get scale(){return state.zoom;},get unlocked(){return state.unlocked;},inverse,screenCenterAnchor,apply,sourceShift,captureInverse,rotateAround,shiftSourceBy,originalCenter,setSourceCenter(x,y){sourceCenter=Number.isFinite(x)&&Number.isFinite(y)?[x,y]:null;window.HubMirror?.syncCenter?.();},get rotation(){return state.angle*Math.PI/180;},
    // v0.142: рисовать поверх в координатах поля (со сдвигом рисунка, без зеркала), под камерой
    overlay(canvas,view,fn){const g=canvas.getContext('2d'),k=view?view.scale:canvas.width/innerWidth,left=view?view.left:0,[a,b,c,d,e,f]=matrix();g.save();g.setTransform(a,b,c,d,(e+(a-1)*left)*k,(f+b*left)*k);g.transform(k,0,0,k,-left*k,0);fn(g);g.restore();},place(left,width,height){frame={left,width,height};document.querySelectorAll('#hubMirror,#hubAll,.hubNoteCell,#hubFly').forEach(apply);},source(canvas,view=null){
    // Source displacement is applied together with the final camera, without clipping a temporary image.
  },paint(canvas,view=null,cached=null,vector=null){
    // vector: {base,draw} — redraw shapes under the final transform instead of resampling the bitmap (sharp mirror copy).
    let copy=cached||buffers.get(canvas);if(!copy){copy=document.createElement('canvas');buffers.set(canvas,copy);}
    if(!cached){if(copy.width!==canvas.width||copy.height!==canvas.height){copy.width=canvas.width;copy.height=canvas.height;}const cg=copy.getContext('2d');cg.clearRect(0,0,copy.width,copy.height);cg.drawImage(canvas,0,0);}
    const g=canvas.getContext('2d'),k=view?view.scale:canvas.width/innerWidth,left=view?view.left:0,[a,b,c,d,e,f]=matrix(),shift=sourceShift(),reflection=window.HubMirror?.matrix?.(canvas,view);
    g.save();g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,canvas.width,canvas.height);g.globalAlpha=1;g.shadowBlur=0;
    const layer=(pass)=>{if(!vector){g.drawImage(copy,shift[0]*k,shift[1]*k);return;}g.save();g.translate(shift[0]*k,shift[1]*k);g.transform(...vector.base);vector.draw(g,pass);g.restore();};   // v0.128: pass 'mirror' — своя палитра у отражения
    g.setTransform(a,b,c,d,(e+(a-1)*left)*k,(f+b*left)*k);const tx=(e+(a-1)*left)*k+shift[0]*k,ty=(f+b*left)*k+shift[1]*k;if(!vector||(a===1&&b===0&&c===0&&d===1&&!shift[0]&&!shift[1]&&Math.abs(tx-Math.round(tx))<1e-6&&Math.abs(ty-Math.round(ty))<1e-6))g.drawImage(copy,shift[0]*k,shift[1]*k);else layer();   // v0.130: сдвинутый исходник — заново ромбами, иначе край экрана обрезал картинку
    if(reflection){g.transform(...reflection);layer('mirror');}g.restore();
    // v0.127: vector.extra — слой поверх в координатах поля (после сдвига и зеркала), только под камерой: «заворот» внутрь треугольника
    if(vector?.extra){g.save();g.setTransform(a,b,c,d,(e+(a-1)*left)*k,(f+b*left)*k);g.transform(...vector.base);vector.extra(g);g.restore();}
  }};
  function init(){const settings=document.querySelector('.hubMirrorSettings');if(!settings)return;
    const button=(text,label,action)=>{const b=document.createElement('button');b.type='button';b.className='hubRhomb';b.textContent=text;b.title=label;b.setAttribute('aria-label',label);b.onclick=action;settings.append(b);return b;};
    unlock=button('🔒','Разрешить перетаскивание холста',()=>{state.unlocked=!state.unlocked;changed();});
    const rotL=turnLeft=button('↺','Повернуть поле на −15°',()=>autoRunning?setAutoRate(state.spinRate/1.1):rotate(-15));angleText=button('0°','Сбросить поворот поля в 0°',()=>{stopAuto();rotateAround(-state.angle*Math.PI/180,...originalCenter());});const rotR=turnRight=button('↻','Повернуть поле на +15°',()=>autoRunning?setAutoRate(state.spinRate*1.1):rotate(15));
    const rotationLabel=document.createElement('label');rotationLabel.className='hubViewRotationControl';const rotationHead=document.createElement('span');rotationHead.append(document.createTextNode('Поворот поля · '));rotationValue=document.createElement('output');rotationHead.append(rotationValue);rotationLabel.append(rotationHead);
    const rotation=document.createElement('input');rotation.type='range';rotation.min=0;rotation.max=360;rotation.step=1;rotation.value=state.angle;rotation.setAttribute('aria-label','Поворот поля на 360 градусов');rotation.className='hubViewRotation';rotationLabel.append(rotation);settings.append(rotationLabel);rotation.oninput=()=>{autoRemainder=0;autoTime=null;const a=Number(rotation.value);rotateAround(((magnetic()?snappedRotation(a):a)-state.angle)*Math.PI/180,...originalCenter(),false);};rotation.onchange=save;
    flipButton=button('3D\n▶','Переворот вокруг оси зеркала в 3D',()=>{if(flipRunning)stopFlip();else{flipRunning=true;flipTime=0;flipRaf=requestAnimationFrame(flipTick);}changed();});flipButton.classList.add('hubFlip');flipButton.setAttribute('aria-pressed','false');
    const flipControl=document.createElement('div');flipControl.className='hubFlipControl';flipControl.append(flipButton);
    const flipLabel=document.createElement('label'),flipHead=document.createElement('span');flipLabel.className='hubMirrorSpeedControl';flipHead.append(document.createTextNode('3D · '));flipRateValue=document.createElement('output');flipHead.append(flipRateValue);flipLabel.append(flipHead);
    flipRateRange=document.createElement('input');flipRateRange.type='range';flipRateRange.min=-100;flipRateRange.max=300;flipRateRange.step=1;flipRateRange.className='hubMirrorSpeed';flipRateRange.setAttribute('aria-label','Множитель скорости 3D-переворота');
    const syncRate=()=>{flipRateRange.value=Math.round(100*Math.log10(state.flipRate));flipRateValue.textContent='×'+Number(state.flipRate.toPrecision(3));flipRateRange.setAttribute('aria-valuetext',flipRateValue.textContent);};flipRateRange.oninput=()=>{state.flipRate=Math.pow(10,Number(flipRateRange.value)/100);syncRate();};flipRateRange.onchange=save;flipRateValue.title='Двойной щелчок — скорость ×1';flipRateValue.ondblclick=()=>{state.flipRate=1;syncRate();save();};syncRate();flipLabel.append(flipRateRange);flipControl.append(flipLabel);settings.append(flipControl);
    flipButton.ondblclick=e=>{e.preventDefault();stopFlip();state.flip=0;changed();};flipButton.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();stopFlip();state.flip=(state.flip+Math.sign(e.deltaY)*5+360)%360;changed();},{passive:false});window.addEventListener('pagehide',()=>{stopFlip();save();});
    angleText.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();rotate(Math.sign(e.deltaY)*5);rotation.value=state.angle;},{passive:false});
    const zoomBox=document.createElement('div');zoomBox.id='hubZoom';const [cx,cy]=center();
    const homeButton=button('⌂','Вернуть весь рисунок в поле',home);homeButton.title='Вернуть рисунок и ось в центр: масштаб 100%, повороты 0°, остановить вращение';zoomBox.append(homeButton);
    minus=button('−','Уменьшить масштаб холста',()=>zoom(1/1.15,...center()));minus.classList.add('hub-zoom-minus');zoomBox.append(minus);
    scaleText=document.createElement('output');scaleText.setAttribute('aria-label','Масштаб холста');scaleText.title='Двойной щелчок — вернуть весь рисунок в поле';zoomBox.append(scaleText);scaleText.ondblclick=home;
    plus=button('+','Увеличить масштаб холста',()=>zoom(1.15,...center()));plus.classList.add('hub-zoom-plus');zoomBox.append(plus);
    angleText.className='hubAutoAngle';
    for(const [el,area] of [[homeButton,'home'],[plus,'plus'],[minus,'minus'],[scaleText,'scale']]){el.style.gridArea=area;zoomBox.append(el);}
    const autoSpeed=document.createElement('div');autoSpeed.className='hubAutoSpeed';autoSpeed.style.gridArea='speed';autoSpeed.title='Скорость автокручения: 0–10000 оборотов в секунду';
    autoTrack=document.createElement('div');autoTrack.className='hubAutoTrack';
    autoRange=document.createElement('input');autoRange.type='range';autoRange.min=0;autoRange.max=601;autoRange.step=1;autoRange.setAttribute('aria-label','Шкала скорости автокручения');autoRange.oninput=()=>setAutoRate(positionRate(Number(autoRange.value)));
    autoButton=button('','Автокручение треугольника',()=>{if(autoDrag){autoDrag=false;return;}if(autoRunning)stopAuto();else startAuto();});autoButton.className='hub-auto-turn';
    autoButton.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();const rect=autoTrack.getBoundingClientRect(),start=e.clientX;autoDrag=false;autoButton.setPointerCapture(e.pointerId);
      const move=ev=>{if(ev.pointerId!==e.pointerId)return;if(Math.abs(ev.clientX-start)>2)autoDrag=true;if(autoDrag)setAutoRate(positionRate(Math.max(0,Math.min(601,Math.round((ev.clientX-rect.left-12)/54*601)))));};
      const end=ev=>{if(ev.pointerId!==e.pointerId)return;autoButton.removeEventListener('pointermove',move);autoButton.removeEventListener('pointerup',end);autoButton.removeEventListener('pointercancel',end);if(autoButton.hasPointerCapture(e.pointerId))autoButton.releasePointerCapture(e.pointerId);setTimeout(()=>{autoDrag=false;},0);};
      autoButton.addEventListener('pointermove',move);autoButton.addEventListener('pointerup',end);autoButton.addEventListener('pointercancel',end);
    });
    const exact=document.createElement('details'),head=document.createElement('summary');exact.className='hubAutoExact';autoValue=document.createElement('output');head.append(autoValue);head.title='Точная скорость в оборотах в секунду';
    autoNumber=document.createElement('input');autoNumber.type='number';autoNumber.min='0';autoNumber.max='10000';autoNumber.step='.01';autoNumber.setAttribute('aria-label','Скорость автокручения в оборотах в секунду');autoNumber.oninput=()=>setAutoRate(autoNumber.valueAsNumber);autoNumber.onchange=()=>{setAutoRate(autoNumber.valueAsNumber);autoNumber.value=autoZero?0:state.spinRate;};exact.append(head,autoNumber);
    autoTrack.append(autoRange,autoButton,exact,angleText);rotL.className='hub-turn-half hub-turn-left';rotR.className='hub-turn-half hub-turn-right';autoSpeed.append(rotL,autoTrack,rotR);zoomBox.append(autoSpeed);syncAuto();
    window.addEventListener('pagehide',stopAuto);
    document.body.append(zoomBox);
    document.addEventListener('wheel',e=>{if(e.target.closest('.hub,.hubMirrorSettings,#hubZoom,#hubRec,#hubPNG,#hubLogoCv,#hubLogoBox'))return;const y=e.clientY+(matchMedia('(max-width:1100px)').matches?scrollY:0);if(frame&&(e.clientX<frame.left||y>frame.height))return;e.preventDefault();zoom(Math.exp(-Math.max(-120,Math.min(120,e.deltaY))*.002),e.clientX,y);},{passive:false});
    const beginDrag=(e,requireHit=false)=>{if((requireHit&&!state.unlocked)||e.button!==0||e.target.closest('.hub,.hubMirrorSettings,input,select,summary,#hubLogoBox,#hubZoom,#hubRec,#hubPNG')||(e.target.closest('button')&&!e.target.closest('.hubNoteCell'))||(!requireHit&&e.target.closest('#hubMirror')))return false;const y=e.clientY+(matchMedia('(max-width:1100px)').matches?scrollY:0);if(frame&&(e.clientX<frame.left||y>frame.height))return false;const cursor=inverse(e.clientX,y);if(!cursor.every(Number.isFinite))return false;const hit=window.HubMirror.hit(...cursor);if(!state.unlocked&&(hit.source||hit.mirror||e.target.closest('.hubNoteCell')))return false;if(requireHit&&!hit.source&&!hit.mirror)return false;e.stopPropagation();const start=state.pan.slice(),x=e.clientX,sy=e.clientY;let moved=false;
      const move=ev=>{if(ev.pointerId!==e.pointerId)return;if(Math.hypot(ev.clientX-x,ev.clientY-sy)>3)moved=true;if(moved){state.pan=[start[0]+ev.clientX-x,start[1]+ev.clientY-sy];changed();}};
      const end=ev=>{if(ev.pointerId!==e.pointerId)return;document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',end);document.removeEventListener('pointercancel',end);if(moved){document.addEventListener('click',swallow,{capture:true,once:true});}};
      const swallow=ev=>{ev.preventDefault();ev.stopImmediatePropagation();};document.addEventListener('pointermove',move);document.addEventListener('pointerup',end);document.addEventListener('pointercancel',end);
      return true;
    };window.HubView.grabBits=beginDrag;document.addEventListener('pointerdown',e=>beginDrag(e));
    window.addEventListener('hubview',()=>rotation.value=state.angle);window.addEventListener('hubmirror',()=>{if(state.flip)changed(false);});changed();
    document.addEventListener('dblclick',e=>{if(e.target.closest('.hub,.hubMirrorSettings,#hubZoom,#hubRec,#hubPNG,#hubLogoBox,.hubNoteCell,.hubMirrorTurn'))return;const y=e.clientY+(matchMedia('(max-width:1100px)').matches?scrollY:0);if(!frame||e.clientX<frame.left||y>frame.height)return;e.preventDefault();e.stopPropagation();if(!fieldPaused){resumeFlip=flipRunning;resumeAuto=autoRunning;stopAuto();stopFlip();fieldPaused=true;}else{fieldPaused=false;if(resumeAuto)startAuto();resumeAuto=false;if(resumeFlip){flipRunning=true;flipTime=0;flipRaf=requestAnimationFrame(flipTick);}}window.dispatchEvent(new CustomEvent('hubmotionpause',{detail:{paused:fieldPaused}}));changed();});
  }
  document.addEventListener('DOMContentLoaded',init,{once:true});
})();
