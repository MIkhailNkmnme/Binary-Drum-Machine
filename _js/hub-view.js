/* Hub v0.158: разрыв линии под прозрачным бегунком. */
/* Hub v0.157: ручка оси использует экранную плоскость, без обратного растяжения 3D. */
/* Hub v0.156: доступная вне панели мигающая кнопка пуска/паузы 3D. */
/* Hub v0.155: отдельные 3D-фазы оригинала и отражения, прямой угол и заморозка оригинала. */
/* Hub v0.154: при закреплённом центре пустота вращает поле, биты — фигуру относительно оси. */
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
  const locked=key=>window.HubLocks?.has(key)===true;
  const state={centerBitPin:'mass',unlocked:false,zoom:1,angle:0,flip:0,mirrorFlip:0,freezeOriginal:false,flipRate:1,pan:[0,0],sourcePan:[0,0],spinRate:.25,frameLocked:true,frameStep:.01,spinDirection:1},buffers=new WeakMap(),triTile=document.createElement('canvas');let frame=null,revision=0,centerBitPinButton,centerTriPinButton,scaleText,angleText,rotationValue,minus,plus,flipButton,flipQuick,flipQuickShown=false,perpendicularButton,freezeButton,flipRateRange,flipRateValue,flipRunning=false,flipRaf=0,flipTime=0;
  try{const saved=JSON.parse(localStorage.getItem('zerk_hub_view')||'null');if(saved){state.unlocked=!!saved.unlocked;state.centerBitPin=saved.centerBitPin===true||saved.centerBitPin==='mass'?'mass':saved.centerBitPin==='tri'?'tri':false;for(const key of ['zoom','angle','flipRate'])if(Number.isFinite(saved[key]))state[key]=saved[key];if(Array.isArray(saved.pan)&&saved.pan.length===2&&saved.pan.every(Number.isFinite))state.pan=saved.pan;}}catch(_){}
  try{const saved=JSON.parse(localStorage.getItem('zerk_hub_view')||'null');if(Array.isArray(saved?.sourcePan)&&saved.sourcePan.length===2&&saved.sourcePan.every(Number.isFinite))state.sourcePan=saved.sourcePan;}catch(_){}
  state.zoom=Math.max(.2,Math.min(6,state.zoom));state.angle=state.angle===360?360:((state.angle%360)+360)%360;
  state.flipRate=Math.max(.1,Math.min(1000,state.flipRate));
  state.zoomCycle='swing';state.zoomSeconds=8;
  try{const saved=JSON.parse(localStorage.getItem('zerk_hub_view')||'null');if(saved?.zoomCycle==='reset')state.zoomCycle='reset';if(Number.isFinite(saved?.zoomSeconds))state.zoomSeconds=Math.max(1,Math.min(60,saved.zoomSeconds));}catch(_){}
  try{const saved=JSON.parse(localStorage.getItem('zerk_hub_view')||'null');if(Number.isFinite(saved?.flip))state.flip=((saved.flip%360)+360)%360;state.mirrorFlip=Number.isFinite(saved?.mirrorFlip)?((saved.mirrorFlip%360)+360)%360:state.flip;state.freezeOriginal=!!saved?.freezeOriginal;}catch(_){}
  let lastScrollRotation=5,sourceCenter=null,autoRunning=false,autoRaf=0,autoTime=null,autoButton,autoRange,autoNumber,autoValue,autoTrack,autoHz,frameButton,turnLeft,turnRight,autoDrag=false,autoZero=true,resumeAuto=false,autoRemainder=0;
  try{const saved=JSON.parse(localStorage.getItem('zerk_hub_view')||'null');if(Number.isFinite(saved?.spinRate))state.spinRate=Math.max(.01,Math.min(10000,saved.spinRate));if(saved?.spinDirection===-1)state.spinDirection=-1;}catch(_){}
  try{const saved=JSON.parse(localStorage.getItem('zerk_hub_view')||'null');state.frameLocked=saved?.frameLocked!==false;if(Number.isFinite(saved?.frameStep)&&saved.frameStep>0)state.frameStep=Math.max(.000001,Math.min(10000,saved.frameStep));}catch(_){}
  const save=()=>{try{localStorage.setItem('zerk_hub_view',JSON.stringify(state));}catch(_){}};
  const center=()=>frame?[frame.left+frame.width/2,frame.height/2]:[innerWidth/2,innerHeight/2];
  function matrix(mirror=false,flat=false){const [x,y]=center(),a=state.angle*Math.PI/180,c=Math.cos(a)*state.zoom,s=Math.sin(a)*state.zoom,m=window.HubMirror?.state,axis=m?.angle??Math.PI/2,u=Math.cos(axis),v=Math.sin(axis),k=flat?1:Math.cos((mirror?state.mirrorFlip:state.flip)*Math.PI/180),aa=u*u+k*v*v,ab=(1-k)*u*v,bb=v*v+k*u*u,mx=frame?frame.left+frame.width*(m?.x??.5):x,my=frame?frame.height*(m?.y??.5):y,tx=mx-aa*mx-ab*my,ty=my-ab*mx-bb*my;return [c*aa-s*ab,s*aa+c*ab,c*ab-s*bb,s*ab+c*bb,x+state.pan[0]-c*x+s*y+c*tx-s*ty,y+state.pan[1]-s*x-c*y+s*tx+c*ty];}
  function inverseWith(m,x,y){const [a,b,c,d,e,f]=m,det=a*d-b*c;if(Math.abs(det)<1e-8)return [NaN,NaN];return [(d*(x-e)-c*(y-f))/det,(-b*(x-e)+a*(y-f))/det];}
  function inverse(x,y,mirror=false){return inverseWith(matrix(mirror),x,y);}
  function hitScreen(x,y){const original=inverse(x,y),reflected=inverse(x,y,true),hit=window.HubMirror.hit;return {source:original.every(Number.isFinite)&&hit.call(window.HubMirror,...original).source,mirror:reflected.every(Number.isFinite)&&hit.call(window.HubMirror,...reflected).mirror};}
  function bitScreen(x,y){const mirror=window.HubMirror;if(!mirror?.bitAt)return null;const reflected=inverse(x,y,true),source=inverse(x,y);return (reflected.every(Number.isFinite)?mirror.bitAt(...reflected,true):null)??(source.every(Number.isFinite)?mirror.bitAt(...source):null);}
  let centerHover=null;const centerMarkers=[];
  function updateCenterMarker(){
    const hide=()=>{for(const marker of centerMarkers)marker.node.hidden=true;};
    const mirror=window.HubMirror;if(!centerHover||!mirror?.pickBit||document.hidden){hide();return;}
    const scroll=matchMedia('(max-width:1100px)').matches?scrollY:0,[px,py]=centerHover,y=py+scroll;
    const reflected=inverse(px,y,true),source=inverse(px,y);
    const hit=(reflected.every(Number.isFinite)?mirror.pickBit(...reflected,true):null)??(source.every(Number.isFinite)?mirror.pickBit(...source):null),bit=hit&&mirror.centerBit();
    if(!bit){hide();return;}
    const points=[...new Map([bit,...(mirror.vertexBits?.()||[])].map(p=>[p.index,p])).values()],camera=matrix(false,true);let slot=0;
    for(const reflected of mirror.state.on?[false,true]:[false])for(const point of points){
      let marker=centerMarkers[slot++];
      if(!marker){const node=document.createElement('canvas');node.className='hubCenterBit';node.setAttribute('aria-hidden','true');document.body.append(node);marker={node,key:''};centerMarkers.push(marker);}
      const node=marker.node,side=Math.ceil(Math.max(point.width,point.height)*1.5+6),key=JSON.stringify([point,mirror.state.bitView,mirror.state.bitRhomb,mirror.state.packedBits,mirror.bitAngle(point.bit),mirror.digitVisible(point.bit),mirror.colors()]);
      if(key!==marker.key){marker.key=key;node.width=node.height=side*2;node.style.width=node.style.height=side+'px';const g=node.getContext('2d');g.setTransform(2,0,0,2,side,side);mirror.drawCenterBit(g,point);}
      const project=(x,y)=>{const p=window.HubView.projectBit(x,y,reflected);return [camera[0]*p[0]+camera[2]*p[1]+camera[4],camera[1]*p[0]+camera[3]*p[1]+camera[5]];};
      const p=project(point.x,point.y),x=project(point.x+1,point.y),q=project(point.x,point.y+1);
      node.style.transform=`matrix(${x[0]-p[0]},${x[1]-p[1]},${q[0]-p[0]},${q[1]-p[1]},${p[0]},${p[1]-scroll}) translate(-50%,-50%)`;
      node.dataset.layer=reflected?'mirror':'source';node.dataset.kind=point.index===bit.index?'center':'vertex';node.dataset.bitIndex=String(point.index);node.hidden=false;
    }
    for(;slot<centerMarkers.length;slot++)centerMarkers[slot].node.hidden=true;
  }
  function selectBitScreen(x,y,rays=false){   // v0.222: rays — лучи были видны, у нового бита показать сразу
    const mirror=window.HubMirror;if(!mirror?.pickBit)return;
    const reflected=inverse(x,y,true),source=inverse(x,y);
    mirror.selectRotationBit((reflected.every(Number.isFinite)?mirror.pickBit(...reflected,true):null)??(source.every(Number.isFinite)?mirror.pickBit(...source):null),rays);
  }
  function repeatScrollRotation(){stopAuto();rotate(lastScrollRotation,window.HubMirror.rotationCenter?.()||originalCenter(),true);}
  function centerTriangleAtAxis(x,y){
    if(locked('pan'))return false;
    const m=window.HubMirror,axis=m?.rotationCenter?.();if(!axis)return false;
    const reflected=inverse(x,y,true),source=inverse(x,y);
    const hit=(reflected.every(Number.isFinite)?m.pickBit(...reflected,true):null)??(source.every(Number.isFinite)?m.pickBit(...source):null);
    const bit=hit&&m.bitCenter?.(hit.index);if(!bit)return false;
    // A direct choice of another bit takes precedence over the central-bit lock.
    if(state.centerBitPin)setCenterBitPin(false);
    const sh=sourceShift();shiftSourceBy(axis[0]-bit.x-sh[0],axis[1]-bit.y-sh[1]);m.clearRotationBit?.();return true;
  }
  function enforceCenterBitPin(axis){
    if(locked('pan')||!state.centerBitPin||!frame||!axis?.every(Number.isFinite))return false;
    const bit=window.HubMirror?.centerPoint?.(state.centerBitPin);if(!bit)return false;
    const next=[(axis[0]-bit.x)/frame.width,(axis[1]-bit.y)/frame.height];
    if(Math.hypot((next[0]-state.sourcePan[0])*frame.width,(next[1]-state.sourcePan[1])*frame.height)<1e-8)return false;
    state.sourcePan=next;revision++;save();
    document.querySelectorAll('#hubMirror,#hubAll,.hubNoteCell,#hubFly').forEach(apply);
    window.dispatchEvent(new Event('hubview'));return true;
  }
  function setCenterBitPin(mode){state.centerBitPin=mode==='tri'?'tri':mode?'mass':false;centerBitPinButton?.setAttribute('aria-pressed',String(state.centerBitPin==='mass'));centerTriPinButton?.setAttribute('aria-pressed',String(state.centerBitPin==='tri'));changed();}
  // The axis anchor is unchanged by the 3D flip about itself, even edge-on.
  function screenCenterAnchor(){const [cx,cy]=center(),a=state.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=innerWidth/2-cx-state.pan[0],y=innerHeight/2+(matchMedia('(max-width:1100px)').matches?scrollY:0)-cy-state.pan[1];return [cx+(c*x+s*y)/state.zoom,cy+(-s*x+c*y)/state.zoom];}
  function axisInverse(x,y){return inverseWith(matrix(false,true),x,y);}
  function captureAxisInverse(){const m=matrix(false,true);return (x,y)=>inverseWith(m,x,y);}
  function captureInverse(){const m=matrix();return (x,y)=>inverseWith(m,x,y);}
  function rotateAround(delta,x,y,persist=true){if(locked('turn'))return;if(!Number.isFinite(delta))return;const before=matrix(),px=before[0]*x+before[2]*y+before[4],py=before[1]*x+before[3]*y+before[5];state.angle=((state.angle+delta*180/Math.PI)%360+360)%360;const after=matrix();state.pan[0]+=px-(after[0]*x+after[2]*y+after[4]);state.pan[1]+=py-(after[1]*x+after[3]*y+after[5]);changed(persist);}
  function shiftSourceBy(dx,dy){if(locked('pan'))return;if(!frame)return;state.sourcePan[0]+=dx/frame.width;state.sourcePan[1]+=dy/frame.height;changed();}
  const sourceShift=()=>frame?[state.sourcePan[0]*frame.width,state.sourcePan[1]*frame.height]:[0,0];
  function apply(el){if(!el)return;const [a,b,c,d,e,f]=matrix(!!el.dataset.note?.includes('-mirror')),x=el.offsetLeft,y=el.offsetTop,[sx,sy]=el.id==='hubMirror'||el.dataset.note?.includes('-mirror')?[0,0]:sourceShift();el.style.transformOrigin='0 0';el.style.transform=`matrix(${a},${b},${c},${d},${e+a*(x+sx)+c*(y+sy)-x},${f+b*(x+sx)+d*(y+sy)-y})`;}
  function sync(){if(!scaleText)return;scaleText.textContent=Math.round(state.zoom*100)+'%';angleText.textContent=Number(state.angle.toFixed(1))+'°';rotationValue.textContent=angleText.textContent;minus.disabled=state.zoom<=.2;plus.disabled=state.zoom>=6;document.body.classList.toggle('hubCanvasUnlocked',state.unlocked);syncAuto();}
  // v0.249: «тормозит вся страница при перемещении»: пока вид меняется, кадр собирается из готовой картинки битов (без перерисовки каждого ромба), через 200 мс после остановки — снова чётко ромбами.
  const nowMs=()=>typeof performance!=='undefined'?performance.now():Date.now();let movingUntil=0,settleT=0;const settle=()=>{settleT=0;if(nowMs()<movingUntil){settleT=setTimeout(settle,movingUntil-nowMs()+20);return;}revision++;window.dispatchEvent(new Event('hubview'));};
  function markMoving(){movingUntil=nowMs()+200;if(!settleT&&typeof setTimeout==='function')settleT=setTimeout(settle,220);}
  function changed(persist=true){window.HubMirror?.syncCenter?.();revision++;markMoving();sync();if(perpendicularButton)perpendicularButton.setAttribute('aria-pressed',String(Math.abs(Math.cos((state.mirrorFlip-state.flip)*Math.PI/180))<1e-8));if(freezeButton)freezeButton.setAttribute('aria-pressed',String(state.freezeOriginal));if(flipButton){flipButton.textContent='3D\n'+(flipRunning?'Ⅱ':'▶');flipButton.setAttribute('aria-pressed',String(flipRunning));flipButton.title='3D: оригинал '+Math.round(state.flip)+'°, зеркало '+Math.round(state.mirrorFlip)+'°. Щелчок — пуск / пауза, колесо — шаг 5°, двойной щелчок — 0°';}if(flipQuick){if(flipRunning||state.flip||state.mirrorFlip||state.freezeOriginal)flipQuickShown=true;flipQuick.hidden=!flipQuickShown;flipQuick.textContent='3D\n'+(flipRunning?'Ⅱ':'▶');flipQuick.setAttribute('aria-pressed',String(flipRunning));flipQuick.title=flipRunning?'Остановить 3D-вращение':'Продолжить 3D-вращение';}document.querySelectorAll('#hubMirror,#hubAll,.hubNoteCell,#hubFly').forEach(apply);if(persist)save();window.dispatchEvent(new Event('hubview'));}
  function flipTick(time){flipRaf=0;if(!flipRunning)return;if(flipTime&&!document.hidden)advanceFlip(Math.min(100,time-flipTime)*.03*state.flipRate);flipTime=time;changed(false);flipRaf=requestAnimationFrame(flipTick);}
  function resetFlip(){if(locked('depth'))return;flipQuickShown=false;stopFlip();resumeFlip=false;state.flip=state.mirrorFlip=0;state.freezeOriginal=false;changed();}
  function advanceFlip(delta){if(locked('depth'))return;if(!state.freezeOriginal)state.flip=(state.flip+delta+360)%360;state.mirrorFlip=(state.mirrorFlip+delta+360)%360;}
  function stopFlip(){flipRunning=false;flipTime=0;cancelAnimationFrame(flipRaf);flipRaf=0;}
  let fieldPaused=false,resumeFlip=false;
  let zoomRunning=false,zoomRaf=0,zoomTime=null,zoomPhase=0,resumeZoom=false,zoomPlay,zoomMode;
  function syncAutoZoom(){if(zoomPlay){zoomPlay.textContent='⊙\nЗум '+(zoomRunning?'Ⅱ':'▶');zoomPlay.setAttribute('aria-pressed',String(zoomRunning));}if(zoomMode){zoomMode.textContent=state.zoomCycle==='reset'?'↗\nСброс':'↔\nМаятник';zoomMode.dataset.zoomMode=state.zoomCycle;zoomMode.title=state.zoomCycle==='reset'?'Автозум: минимум → максимум → сброс к минимуму':'Автозум: минимум ↔ максимум';}}
  function syncZoomPhase(){const descending=zoomPhase>1,t=Math.max(0,Math.min(1,Math.log(state.zoom/.2)/Math.log(30)));const phase=Math.acos(1-2*t)/Math.PI;zoomPhase=state.zoomCycle==='reset'?t:descending?2-phase:phase;zoomTime=null;}
  function stopAutoZoom(){const wasRunning=zoomRunning;zoomRunning=false;zoomTime=null;cancelAnimationFrame(zoomRaf);zoomRaf=0;syncAutoZoom();if(wasRunning)save();}
  function autoZoomTick(time){
    zoomRaf=0;if(!zoomRunning)return;
    if(document.hidden||locked('zoom'))zoomTime=null;
    else{
      if(zoomTime!==null){zoomPhase=(zoomPhase+Math.max(0,time-zoomTime)/1000/state.zoomSeconds)%(state.zoomCycle==='reset'?1:2);const t=state.zoomCycle==='reset'?zoomPhase:(1-Math.cos(Math.PI*zoomPhase))/2,next=.2*30**t;zoom(next/state.zoom,innerWidth/2,innerHeight/2+(matchMedia('(max-width:1100px)').matches?scrollY:0),false);}
      zoomTime=time;
    }
    zoomRaf=requestAnimationFrame(autoZoomTick);
  }
  function startAutoZoom(){if(zoomRunning)return;zoomRunning=true;zoomTime=null;syncAutoZoom();zoomRaf=requestAnimationFrame(autoZoomTick);}
  function zoom(factor,x,y,persist=true){if(locked('zoom'))return;if(persist){resumeZoom=false;stopAutoZoom();}const before=state.zoom,next=Math.max(.2,Math.min(6,before*factor));if(next===before)return;if(window.HubMirror?.state.screenPin){x=innerWidth/2;y=innerHeight/2+(matchMedia('(max-width:1100px)').matches?scrollY:0);}const ratio=next/before,[cx,cy]=center();state.pan=[x-cx-(x-cx-state.pan[0])*ratio,y-cy-(y-cy-state.pan[1])*ratio];state.zoom=next;changed(persist);}
  function home(){flipQuickShown=false;autoZero=true;stopAuto();stopFlip();stopAutoZoom();fieldPaused=false;resumeZoom=resumeFlip=resumeAuto=false;if(!locked('zoom'))state.zoom=1;if(!locked('turn'))state.angle=0;if(!locked('depth'))Object.assign(state,{flip:0,mirrorFlip:0,freezeOriginal:false});if(!locked('pan'))Object.assign(state,{pan:[0,0],sourcePan:[0,0]});window.HubMirror.home();if(!locked('pan'))setCenterBitPin('mass');changed();}   /* ⌂ — и «Центр ◇», как в начале */
  function originalCenter(){const c=sourceCenter||center(),sh=sourceShift();return [c[0]+sh[0],c[1]+sh[1]];}
  const activeRate=()=>state.frameLocked?state.frameStep:state.spinRate;
  const ratePosition=rate=>rate>0?(state.frameLocked?1+60*(Math.log10(Math.max(.000001,rate))+6):1+100*(Math.log10(Math.max(.01,rate))+2)):0;
  const positionRate=pos=>pos<=0?0:Number((10**(state.frameLocked?(pos-1)/60-6:(pos-1)/100-2)).toPrecision(5));
  let frameHz=null,frameStamp=null,frameElapsed=0,frameCount=0,frameRaf=0,inputHz=null;
  function measureFrames(time){
    frameRaf=0;
    if(document.hidden){frameStamp=null;frameElapsed=frameCount=0;}
    else{
      if(frameStamp!==null){const dt=time-frameStamp;if(dt>0&&dt<250){frameElapsed+=dt;frameCount++;}else{frameElapsed=frameCount=0;}}
      frameStamp=time;
      if(frameCount>=24&&frameElapsed>=500){frameHz=Math.round(10000*frameCount/frameElapsed)/10;frameElapsed=frameCount=0;syncAuto();}
    }
    frameRaf=requestAnimationFrame(measureFrames);
  }
  function setFrameRate(value){if(!Number.isFinite(value))return;if(state.frameLocked)setAutoRate(value);else if(frameHz)setAutoRate(value*(inputHz||frameHz));}
  function readFrameInput(){if(Number.isFinite(autoNumber.valueAsNumber))return autoNumber.valueAsNumber;const parts=String(autoNumber.value).trim().replace(',','.').split('/');if(parts.length>2||parts.some(x=>!x.trim()))return NaN;return Number(parts[0])/(parts.length===2?Number(parts[1]):1);}
  function frameFraction(value,approximate=true){
    if(value===0)return '0';
    let x=value,p0=0,p1=1,q0=1,q1=0;
    for(let i=0;i<24;i++){
      const a=Math.floor(x),p=a*p1+p0,q=a*q1+q0;
      if(q>1000000)break;
      [p0,p1,q0,q1]=[p1,p,q1,q];
      if(Math.abs(value-p/q)<=(approximate?Math.max(1e-10,value*1e-4):Math.max(1e-14,value*1e-12))||x===a)break;
      x=1/(x-a);
    }
    const fraction=q1===1?String(p1):p1+'/'+q1;return approximate?'≈'+fraction:Math.abs(p1/q1-value)<=Math.max(1e-14,value*1e-12)?fraction:String(value);
  }
  function syncAuto(){document.body.classList.toggle('hubAutoTurning',autoRunning);if(!autoButton)return;const rate=autoZero?0:activeRate(),pos=ratePosition(rate),perFrame=state.frameLocked?rate:frameHz?rate/frameHz:null,labelRate=perFrame===null?'…':frameFraction(perFrame,!state.frameLocked),hzLabel=frameHz?'≈'+frameHz+' Гц кадров':'Измерение частоты кадров…';autoButton.textContent='';autoButton.setAttribute('aria-pressed',String(autoRunning));autoButton.title='Автокручение: '+labelRate+' об/кадр; '+hzLabel+'; '+(autoRunning?'вращается':'пауза')+'; тяни ромб, 0 — стоп и угол 0°; щелчок — пуск / пауза';const thumbX=(12+(78-24)*pos/601)+'px';autoButton.style.left=thumbX;autoTrack.style.setProperty?.('--thumb-x',thumbX);autoRange.value=pos;autoRange.setAttribute('aria-valuetext',labelRate+' об/кадр');autoNumber.disabled=!state.frameLocked&&!frameHz;if(perFrame!==null&&document.activeElement!==autoNumber)autoNumber.value=state.frameLocked?frameFraction(perFrame,false):Number(perFrame.toPrecision(8));if(frameButton){frameButton.setAttribute('aria-pressed',String(state.frameLocked));frameButton.title=state.frameLocked?'Точный шаг на кадр; магнит не округляет этот шаг':'Вращение по времени; об/кадр — измеренное среднее';}autoValue.textContent=labelRate+' об/кадр';autoValue.title=hzLabel;autoHz.textContent=hzLabel;for(const [b,d] of [[turnLeft,-1],[turnRight,1]]){if(!b)continue;const label=autoRunning?(d<0?'Уменьшить скорость вращения':'Увеличить скорость вращения'):(d<0?'Повернуть поле на −15°':'Повернуть поле на +15°');b.setAttribute('aria-label',label);b.title=autoRunning?label+' (×'+(d<0?'1/1,1':'1,1')+')':label;}}

  const magnetic=()=>window.HubMirror?.state.magnet===true;
  const snappedRotation=a=>{const offset=(window.HubMirror?.state.angle||0)*180/Math.PI;return Math.round((a+offset)/15)*15-offset;};
  function autoTick(time){autoRaf=0;if(!autoRunning)return;if(!locked('turn')&&!document.hidden&&(state.frameLocked||autoTime!==null)){const turns=(state.frameLocked?state.frameStep:Math.max(0,time-autoTime)/1000*state.spinRate)%1;let delta=state.spinDirection*turns*360;if(!state.frameLocked&&magnetic()){autoRemainder+=delta;delta=snappedRotation(state.angle+autoRemainder)-state.angle;autoRemainder-=delta;}else autoRemainder=0;if(Math.abs(delta)>1e-10)rotateAround(delta*Math.PI/180,...originalCenter(),false);}autoTime=time;autoRaf=requestAnimationFrame(autoTick);}
  function startAuto(){autoZero=false;if(autoRunning)return;autoRemainder=0;if(state.spinRate<=0)state.spinRate=.25;autoRunning=true;autoTime=null;autoRaf=requestAnimationFrame(autoTick);syncAuto();}
  function stopAuto(){autoRemainder=0;autoRunning=false;autoTime=null;cancelAnimationFrame(autoRaf);autoRaf=0;syncAuto();save();}
  function setAutoRate(value){if(!Number.isFinite(value))return;if(value<=0){autoZero=true;stopAuto();rotateAround(-state.angle*Math.PI/180,...originalCenter());return;}autoZero=false;if(state.frameLocked)state.frameStep=Math.max(.000001,Math.min(10000,value));else state.spinRate=Math.max(.01,Math.min(10000,value));autoRemainder=0;autoTime=null;startAuto();syncAuto();save();}
  function rotate(delta,pivot=originalCenter(),fixedAxis=false){if(locked('turn'))return;if(delta)state.spinDirection=Math.sign(delta);autoTime=null;autoRemainder=0;if(magnetic()&&delta){delta=Math.sign(delta)*Math.max(15,Math.round(Math.abs(delta)/15)*15);if(!fixedAxis)delta=snappedRotation(state.angle+delta)-state.angle;}const radians=delta*Math.PI/180;if(fixedAxis)window.HubMirror?.counterRotateView?.(radians);rotateAround(radians,...pivot);}
  window.HubView={get centerBitPinned(){return state.centerBitPin;},get moving(){return nowMs()<movingUntil;},markMoving,get flipOn(){return flipRunning||state.flip!==0||state.mirrorFlip!==0||state.freezeOriginal;},enforceCenterBitPin,setCenterBitPin,get revision(){return revision;},get scale(){return state.zoom;},get unlocked(){return state.unlocked;},rotateBy:rotate,repeatScrollRotation,rotateBitsBy:(delta,pivot)=>{lastScrollRotation=delta;rotate(delta,pivot,true);},inverse,axisInverse,captureAxisInverse,hitScreen,screenCenterAnchor,apply,sourceShift,captureInverse,rotateAround,shiftSourceBy,originalCenter,setSourceCenter(x,y){sourceCenter=Number.isFinite(x)&&Number.isFinite(y)?[x,y]:null;window.HubMirror?.syncCenter?.();},get rotation(){return state.angle*Math.PI/180;},
    // v0.142: рисовать поверх в координатах поля (со сдвигом рисунка, без зеркала), под камерой
    overlay(canvas,view,fn,mirror=false){const g=canvas.getContext('2d'),k=view?view.scale:canvas.width/innerWidth,left=view?view.left:0,[a,b,c,d,e,f]=matrix(mirror);g.save();g.setTransform(a,b,c,d,(e+(a-1)*left)*k,(f+b*left)*k);g.transform(k,0,0,k,-left*k,0);fn(g);g.restore();},place(left,width,height){frame={left,width,height};document.querySelectorAll('#hubMirror,#hubAll,.hubNoteCell,#hubFly').forEach(apply);},source(canvas,view=null){
    // Source displacement is applied together with the final camera, without clipping a temporary image.
  },projectBit(x,y,mirror=false){
    if(mirror){const p=window.HubMirror.point(x,y);if(!p)return null;[x,y]=p;}else{const sh=sourceShift();x+=sh[0];y+=sh[1];}
    const ms=window.HubMirror?.state,axis=ms?.angle??Math.PI/2,u=Math.cos(axis),v=Math.sin(axis),k=Math.cos((mirror?state.mirrorFlip:state.flip)*Math.PI/180),[cx,cy]=center(),mx=frame?frame.left+frame.width*(ms?.x??.5):cx,my=frame?frame.height*(ms?.y??.5):cy;
    const aa=u*u+k*v*v,ab=(1-k)*u*v,bb=v*v+k*u*u;return [mx+aa*(x-mx)+ab*(y-my),my+ab*(x-mx)+bb*(y-my)];
  },axisCamera:()=>matrix(),symmetryCamera:()=>matrix(false,true),paint(canvas,view=null,cached=null,vector=null){
    // vector: {base,draw} — redraw shapes under the final transform instead of resampling the bitmap (sharp mirror copy).
    let copy=cached||buffers.get(canvas);if(!copy){copy=document.createElement('canvas');buffers.set(canvas,copy);}
    if(!cached){if(copy.width!==canvas.width||copy.height!==canvas.height){copy.width=canvas.width;copy.height=canvas.height;}const cg=copy.getContext('2d');cg.clearRect(0,0,copy.width,copy.height);cg.drawImage(canvas,0,0);}
    const g=canvas.getContext('2d'),k=view?view.scale:canvas.width/innerWidth,left=view?view.left:0,[a,b,c,d,e,f]=matrix(),shift=sourceShift(),reflection=window.HubMirror?.matrix?.(canvas,view);
    g.save();g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,canvas.width,canvas.height);g.globalAlpha=1;g.shadowBlur=0;
    const fast=!view&&vector&&!vector.direct&&!!window.HubFastMove?.on&&nowMs()<movingUntil;   // v0.256: только при включённом «Быстро»
    const layer=(pass)=>{if(!vector){g.drawImage(copy,shift[0]*k,shift[1]*k);return;}
      if(fast){const c=vector.fastCopy||(vector.fastCopy={}),key=pass||'source';let mc=c[key];if(!mc||mc.width!==canvas.width||mc.height!==canvas.height){mc=c[key]=document.createElement('canvas');mc.width=canvas.width;mc.height=canvas.height;const mg=mc.getContext('2d');mg.setTransform(...vector.base);vector.draw(mg,pass);}g.drawImage(mc,shift[0]*k,shift[1]*k);return;}g.save();g.translate(shift[0]*k,shift[1]*k);g.transform(...vector.base);vector.draw(g,pass);g.restore();};   // v0.128: pass 'mirror' — своя палитра у отражения
    const tri=window.HubMirror?.triLayers?.(canvas,view);
    if(tri){   // «3 оси — треугольником»: исходник внутри треугольника зеркал — плиткой, её копии — всеми отражениями группы
      const [p0,p1,p2]=tri.tri,bx=Math.floor(Math.min(p0[0],p1[0],p2[0]))-2,by=Math.floor(Math.min(p0[1],p1[1],p2[1]))-2,bw=Math.ceil(Math.max(p0[0],p1[0],p2[0]))+2-bx,bh=Math.ceil(Math.max(p0[1],p1[1],p2[1]))+2-by;
      const tile=triTile.width===bw&&triTile.height===bh?triTile:Object.assign(triTile,{width:Math.max(1,bw),height:Math.max(1,bh)}),tg=tile.getContext('2d');
      tg.setTransform(1,0,0,1,0,0);tg.clearRect(0,0,tile.width,tile.height);tg.save();tg.translate(-bx,-by);tg.beginPath();tg.moveTo(...p0);tg.lineTo(...p1);tg.lineTo(...p2);tg.closePath();tg.clip();
      if(vector&&!vector.direct){tg.translate(shift[0]*k,shift[1]*k);tg.transform(...vector.base);vector.draw(tg);}else tg.drawImage(copy,shift[0]*k,shift[1]*k);tg.restore();
      for(const M of tri.mats){g.setTransform(a,b,c,d,(e+(a-1)*left)*k,(f+b*left)*k);g.transform(...M);g.drawImage(tile,bx,by);}
      g.setTransform(a,b,c,d,(e+(a-1)*left)*k,(f+b*left)*k);g.beginPath();g.moveTo(...p0);g.lineTo(...p1);g.lineTo(...p2);g.closePath();g.setLineDash([4*k,4*k]);g.lineWidth=k/Math.max(.05,state.zoom);
      g.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--hubAxisC').trim()||'#ffe600';g.globalAlpha=.75;g.stroke();g.setLineDash([]);g.globalAlpha=1;
    } else {
    g.setTransform(a,b,c,d,(e+(a-1)*left)*k,(f+b*left)*k);const tx=(e+(a-1)*left)*k+shift[0]*k,ty=(f+b*left)*k+shift[1]*k;if(!vector||(!vector.direct&&a===1&&b===0&&c===0&&d===1&&!shift[0]&&!shift[1]&&Math.abs(tx-Math.round(tx))<1e-6&&Math.abs(ty-Math.round(ty))<1e-6))g.drawImage(copy,shift[0]*k,shift[1]*k);else layer();   // v0.130: сдвинутый исходник — заново ромбами, иначе край экрана обрезал картинку
    if(reflection&&!window.HubMirror?.axis2Replaces1?.()){const [ma,mb,mc,md,me,mf]=matrix(true);g.setTransform(ma,mb,mc,md,(me+(ma-1)*left)*k,(mf+mb*left)*k);g.transform(...reflection);layer('mirror');}
    const L2=window.HubMirror?.axis2Layers?.(canvas,view)||[];
    for(const L of L2){const mir=L.pass==='mirror',[ma,mb,mc,md,me,mf]=matrix(mir);g.setTransform(ma,mb,mc,md,(me+(ma-1)*left)*k,(mf+mb*left)*k);g.transform(...L.m);layer(mir?'mirror':undefined);}   // «2 ось»: остальные копии калейдоскопа
    if(L2.star){const [sx0,sy0]=L2.star.c,R=Math.hypot(canvas.width,canvas.height)/Math.max(.05,state.zoom);g.setTransform(a,b,c,d,(e+(a-1)*left)*k,(f+b*left)*k);g.beginPath();   // ✳3 — пунктир трёх осей
      for(const t of L2.star.angles){g.moveTo(sx0-R*Math.cos(t),sy0-R*Math.sin(t));g.lineTo(sx0+R*Math.cos(t),sy0+R*Math.sin(t));}
      g.setLineDash([4*k,4*k]);g.lineWidth=k/Math.max(.05,state.zoom);g.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--hubAxisC').trim()||'#ffe600';g.globalAlpha=.7;g.stroke();g.setLineDash([]);g.globalAlpha=1;}
    }
    g.restore();
    // v0.127: vector.extra — слой поверх в координатах поля (после сдвига и зеркала), только под камерой: «заворот» внутрь треугольника
    if(vector?.extra){g.save();g.setTransform(a,b,c,d,(e+(a-1)*left)*k,(f+b*left)*k);g.transform(...vector.base);vector.extra(g);g.restore();}
    if(vector?.screen&&!fast){g.save();g.setTransform(k,0,0,k,-left*k,0);vector.screen(g);g.restore();}
    if(!view)updateCenterMarker();
    if(window.HubMirror?.drawRotationGuides)for(const mirror of window.HubMirror.state.on?[false,true]:[false]){
      const p=this.projectBit(0,0,mirror),x=this.projectBit(1,0,mirror),y=this.projectBit(0,1,mirror);if(!p)continue;
      g.save();g.setTransform(k,0,0,k,-left*k,0);g.transform(...this.symmetryCamera());g.transform(x[0]-p[0],x[1]-p[1],y[0]-p[0],y[1]-p[1],p[0],p[1]);window.HubMirror.drawRotationGuides(g,mirror);g.restore();
    }
  }};
  // The same local bit geometry is projected into the screen-space flow grid.
  let flowVector=null;
  const paintField=window.HubView.paint;
  window.HubView.paint=function(canvas,view=null,cached=null,vector=null){
    if(!view&&(canvas.id==='hubSier'||vector?.obstacles)){flowVector=vector;window.HubFlow?.invalidate();}
    return paintField.call(this,canvas,view,cached,vector);
  };
  window.HubView.drawFlowObstacles=function(g,bit=null){
    if(!flowVector?.obstacles||window.HubImage?.active)return false;
    for(const mirror of window.HubMirror.state.on?[false,true]:[false]){
      const p=this.projectBit(0,0,mirror),x=this.projectBit(1,0,mirror),y=this.projectBit(0,1,mirror);if(!p)continue;
      g.save();g.transform(...this.symmetryCamera());g.transform(x[0]-p[0],x[1]-p[1],y[0]-p[0],y[1]-p[1],p[0],p[1]);flowVector.obstacles(g,bit);g.restore();
    }
    if(flowVector.foldObstacles){g.save();g.transform(...matrix());flowVector.foldObstacles(g,bit);g.restore();}
    return true;
  };
  function init(){const settings=document.querySelector('.hubMirrorSettings');if(!settings)return;
    const button=(text,label,action)=>{const b=document.createElement('button');b.type='button';b.className='hubRhomb';b.textContent=text;b.title=label;b.setAttribute('aria-label',label);b.onclick=action;settings.append(b);return b;};
    centerBitPinButton=button('◇\nЦентр','Закрепить центр ромбов треугольника (центр масс) в центре оси',()=>setCenterBitPin(state.centerBitPin==='mass'?false:'mass'));centerBitPinButton.classList.add('hubCenterBitPin');centerBitPinButton.setAttribute('aria-pressed',String(state.centerBitPin==='mass'));
    centerTriPinButton=button('△\nЦентр','Закрепить центр контура треугольника в центре оси',()=>setCenterBitPin(state.centerBitPin==='tri'?false:'tri'));centerTriPinButton.classList.add('hubCenterBitPin');centerTriPinButton.setAttribute('aria-pressed',String(state.centerBitPin==='tri'));
    zoomPlay=button('⊙\nЗум ▶','Автозум от центра — пуск / пауза',()=>{resumeZoom=false;if(zoomRunning)stopAutoZoom();else{syncZoomPhase();startAutoZoom();}});zoomPlay.classList.add('hubAutoZoomControl');
    zoomMode=button('','Режим автозума: маятник или сброс',()=>{state.zoomCycle=state.zoomCycle==='reset'?'swing':'reset';syncZoomPhase();syncAutoZoom();save();});zoomMode.classList.add('hubAutoZoomControl');
    const zoomSpeed=document.createElement('details');zoomSpeed.className='hubTilt hubAutoZoomControl';const zoomSpeedHead=document.createElement('summary');zoomSpeedHead.textContent='◷\nЗум';zoomSpeedHead.title='Время одного хода автозума';zoomSpeedHead.setAttribute('aria-label',zoomSpeedHead.title);
    const zoomSpeedLabel=document.createElement('label');zoomSpeedLabel.append('От минимума до максимума');const zoomSpeedRange=document.createElement('input');zoomSpeedRange.type='range';zoomSpeedRange.min='1';zoomSpeedRange.max='60';zoomSpeedRange.step='1';zoomSpeedRange.value=state.zoomSeconds;zoomSpeedRange.setAttribute('aria-label','Время хода автозума, секунды');const zoomSpeedOutput=document.createElement('output');zoomSpeedOutput.textContent=state.zoomSeconds+' с';
    zoomSpeedRange.oninput=()=>{state.zoomSeconds=Number(zoomSpeedRange.value);zoomTime=null;zoomSpeedOutput.textContent=state.zoomSeconds+' с';save();};zoomSpeedLabel.append(zoomSpeedRange,zoomSpeedOutput);zoomSpeed.append(zoomSpeedHead,zoomSpeedLabel);settings.append(zoomSpeed);syncZoomPhase();syncAutoZoom();
    document.addEventListener('visibilitychange',()=>{zoomTime=null;});window.addEventListener('pagehide',stopAutoZoom);
    window.addEventListener('hubmotionpause',e=>{if(e.detail.paused){resumeZoom=zoomRunning;stopAutoZoom();}else{if(resumeZoom)startAutoZoom();resumeZoom=false;}});
    const rotL=turnLeft=button('↺','Повернуть поле на −15°',()=>autoRunning?setAutoRate(activeRate()/1.1):rotate(-15));angleText=button('0°','Сбросить поворот поля в 0°',()=>{stopAuto();rotateAround(-state.angle*Math.PI/180,...originalCenter());});const rotR=turnRight=button('↻','Повернуть поле на +15°',()=>autoRunning?setAutoRate(activeRate()*1.1):rotate(15));
    const rotationLabel=document.createElement('label');rotationLabel.className='hubViewRotationControl';const rotationHead=document.createElement('span');rotationHead.append(document.createTextNode('Поворот поля · '));rotationValue=document.createElement('output');rotationHead.append(rotationValue);rotationLabel.append(rotationHead);
    const rotation=document.createElement('input');rotation.type='range';rotation.min=0;rotation.max=360;rotation.step=1;rotation.value=state.angle;rotation.setAttribute('aria-label','Поворот поля на 360 градусов');rotation.className='hubViewRotation';rotationLabel.append(rotation);settings.append(rotationLabel);rotation.oninput=()=>{autoRemainder=0;autoTime=null;const a=Number(rotation.value);rotateAround(((magnetic()?snappedRotation(a):a)-state.angle)*Math.PI/180,...originalCenter(),false);};rotation.onchange=save;
    const toggleFlip=()=>{resumeFlip=false;if(flipRunning)stopFlip();else{flipRunning=true;flipTime=0;flipRaf=requestAnimationFrame(flipTick);}changed();};
    flipButton=button('3D\n▶','Переворот вокруг оси зеркала в 3D',toggleFlip);flipButton.classList.add('hubFlip');flipButton.setAttribute('aria-pressed','false');
    flipQuick=button('3D\n▶','Пуск / пауза 3D вне панели',toggleFlip);flipQuick.id='hub3DQuick';flipQuick.hidden=true;document.body.append(flipQuick);
    const flipControl=document.createElement('div');flipControl.className='hubFlipControl';flipControl.append(flipButton);
    const flipLabel=document.createElement('label'),flipHead=document.createElement('span');flipLabel.className='hubMirrorSpeedControl';flipHead.append(document.createTextNode('3D · '));flipRateValue=document.createElement('output');flipHead.append(flipRateValue);flipLabel.append(flipHead);
    flipRateRange=document.createElement('input');flipRateRange.type='range';flipRateRange.min=-100;flipRateRange.max=300;flipRateRange.step=1;flipRateRange.className='hubMirrorSpeed';flipRateRange.setAttribute('aria-label','Множитель скорости 3D-переворота');
    const syncRate=()=>{flipRateRange.value=Math.round(100*Math.log10(state.flipRate));flipRateValue.textContent='×'+Number(state.flipRate.toPrecision(3));flipRateRange.setAttribute('aria-valuetext',flipRateValue.textContent);};flipRateRange.oninput=()=>{state.flipRate=Math.pow(10,Number(flipRateRange.value)/100);syncRate();};flipRateRange.onchange=save;flipRateValue.title='Двойной щелчок — скорость ×1';flipRateValue.ondblclick=()=>{state.flipRate=1;syncRate();save();};syncRate();flipLabel.append(flipRateRange);flipControl.append(flipLabel);settings.append(flipControl);
    perpendicularButton=button('⊥\n90°','Оригинал и зеркало под прямым углом',()=>{if(locked('depth'))return;const perpendicular=Math.abs(Math.cos((state.mirrorFlip-state.flip)*Math.PI/180))<1e-8;state.mirrorFlip=(state.flip+(perpendicular?0:90))%360;changed();});
    freezeButton=button('❄\nориг.','Заморозить 3D-наклон оригинала; зеркало продолжает вращаться',()=>{state.freezeOriginal=!state.freezeOriginal;changed();});
    const planes=document.createElement('div');planes.className='hubFlipPlanes';const reset3d=button('3D\n0°','Сбросить только 3D: остановить, снять заморозку, вернуть обе плоскости',resetFlip);planes.append(perpendicularButton,freezeButton,reset3d);settings.append(planes);
    flipButton.ondblclick=e=>{e.preventDefault();resetFlip();};window.addEventListener('pagehide',()=>{stopFlip();save();});
    const zoomBox=document.createElement('div');zoomBox.id='hubZoom';const [cx,cy]=center();
    const homeButton=button('⌂','Вернуть весь рисунок в поле',home);homeButton.title='Вернуть рисунок и ось в центр: масштаб 100%, повороты 0°, остановить вращение';zoomBox.append(homeButton);
    minus=button('−','Уменьшить масштаб холста',()=>zoom(1/1.15,...center()));minus.classList.add('hub-zoom-minus');zoomBox.append(minus);
    scaleText=document.createElement('output');scaleText.setAttribute('aria-label','Масштаб холста');scaleText.title='Двойной щелчок — вернуть весь рисунок в поле';zoomBox.append(scaleText);scaleText.ondblclick=home;
    plus=button('+','Увеличить масштаб холста',()=>zoom(1.15,...center()));plus.classList.add('hub-zoom-plus');zoomBox.append(plus);
    angleText.className='hubAutoAngle';
    for(const [el,area] of [[homeButton,'home'],[plus,'plus'],[minus,'minus'],[scaleText,'scale']]){el.style.gridArea=area;zoomBox.append(el);}
    frameButton=button('▣\nкадр','Точный шаг вращения на каждый кадр',()=>{state.frameLocked=!state.frameLocked;inputHz=null;autoRemainder=0;autoTime=null;syncAuto();save();});frameButton.className='hub-frame-lock';frameButton.style.gridArea='frame';zoomBox.append(frameButton);
    const autoSpeed=document.createElement('div');autoSpeed.className='hubAutoSpeed';autoSpeed.style.gridArea='speed';autoSpeed.title='Скорость автокручения в оборотах за кадр браузера';
    autoTrack=document.createElement('div');autoTrack.className='hubAutoTrack';
    autoRange=document.createElement('input');autoRange.type='range';autoRange.min=0;autoRange.max=601;autoRange.step=1;autoRange.setAttribute('aria-label','Шкала скорости автокручения');autoRange.oninput=()=>setAutoRate(positionRate(Number(autoRange.value)));
    autoButton=button('','Автокручение треугольника',()=>{if(autoDrag){autoDrag=false;return;}if(autoRunning)stopAuto();else startAuto();});autoButton.className='hub-auto-turn';
    autoButton.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();const rect=autoTrack.getBoundingClientRect(),start=e.clientX;autoDrag=false;autoButton.setPointerCapture(e.pointerId);
      const move=ev=>{if(ev.pointerId!==e.pointerId)return;if(Math.abs(ev.clientX-start)>2)autoDrag=true;if(autoDrag)setAutoRate(positionRate(Math.max(0,Math.min(601,Math.round((ev.clientX-rect.left-12)/54*601)))));};
      const end=ev=>{if(ev.pointerId!==e.pointerId)return;autoButton.removeEventListener('pointermove',move);autoButton.removeEventListener('pointerup',end);autoButton.removeEventListener('pointercancel',end);if(autoButton.hasPointerCapture(e.pointerId))autoButton.releasePointerCapture(e.pointerId);setTimeout(()=>{autoDrag=false;},0);};
      autoButton.addEventListener('pointermove',move);autoButton.addEventListener('pointerup',end);autoButton.addEventListener('pointercancel',end);
    });
    const exact=document.createElement('details'),head=document.createElement('summary');exact.className='hubAutoExact';autoValue=document.createElement('output');head.append(autoValue);head.title='Точная скорость в оборотах за кадр';
    autoNumber=document.createElement('input');autoNumber.type='text';autoNumber.title='Обороты за кадр: дробь 1/2 или число 0.5';autoNumber.setAttribute('aria-label','Скорость автокручения в оборотах за кадр');autoNumber.onfocus=()=>{inputHz=frameHz;};autoNumber.onblur=()=>{inputHz=null;syncAuto();};autoNumber.oninput=()=>setFrameRate(readFrameInput());autoNumber.onchange=()=>{setFrameRate(readFrameInput());};autoHz=document.createElement('output');autoHz.className='hubFrameHz';autoHz.title='Измеренная частота кадров браузера; при нагрузке может быть ниже частоты монитора';exact.append(head,autoNumber,autoHz);
    autoTrack.append(autoRange,autoButton,exact,angleText);rotL.className='hub-turn-half hub-turn-left';rotR.className='hub-turn-half hub-turn-right';for(const b of [rotL,rotR])b.innerHTML='<svg viewBox="0 0 20 40" aria-hidden="true"><path class="hub-step-angle" d="M19 20L10 11 1 20 10 29"/><path class="hub-step-speed" d="M19 2L1 20 19 38"/></svg>';autoSpeed.append(rotL,autoTrack,rotR);zoomBox.append(autoSpeed);syncAuto();
    frameRaf=requestAnimationFrame(measureFrames);document.addEventListener('visibilitychange',()=>{frameStamp=null;frameElapsed=frameCount=0;});window.addEventListener('pagehide',()=>{stopAuto();cancelAnimationFrame(frameRaf);});window.addEventListener('pageshow',()=>{cancelAnimationFrame(frameRaf);frameStamp=null;frameRaf=requestAnimationFrame(measureFrames);});
    document.body.append(zoomBox);
    document.addEventListener('pointermove',e=>{
      centerHover=e.pointerType==='touch'||!e.target?.closest||e.target.closest('.hub,.hubMirrorSettings,.hubBitView,.hubColorEditor,input,select,summary,button:not(.hubNoteCell),#hubMirror,#hubZoom,#hubRec,#hubPNG,#hub3DQuick,#hubLogoBox')?null:[e.clientX,e.clientY];updateCenterMarker();
    },true);
    const clearCenterHover=()=>{centerHover=null;updateCenterMarker();};
    document.addEventListener('pointerout',e=>{if(!e.relatedTarget)clearCenterHover();},true);
    window.addEventListener('blur',clearCenterHover);window.addEventListener('scroll',updateCenterMarker,{passive:true});
    document.addEventListener('visibilitychange',clearCenterHover);
    // A click starts a new wheel interaction; moving geometry must not select another tool.
    let wheelAction=null,wheelBits=new Set(),bitClick=null;
    document.addEventListener('pointerdown',e=>{
      const previous=new Set(wheelBits),rays=!!window.HubMirror?.guidesShown?.();wheelAction=null;wheelBits.clear();bitClick=null;window.HubMirror?.clearRotationBit?.();
      if(e.button!==0||e.target.closest('.hub,.hubMirrorSettings,.hubBitView,.hubColorEditor,input,select,summary,button,#hubMirror,#hubZoom,#hubRec,#hubPNG,#hub3DQuick,#hubLogoBox'))return;
      const y=e.clientY+(matchMedia('(max-width:1100px)').matches?scrollY:0);
      if(frame&&(e.clientX<frame.left||y>frame.height))return;
      const bit=bitScreen(e.clientX,y);if(bit!==null)bitClick={bit,previous,rays,id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};
    },true);
    document.addEventListener('pointermove',e=>{if(bitClick&&bitClick.id===e.pointerId&&Math.hypot(e.clientX-bitClick.x,e.clientY-bitClick.y)>3)bitClick.moved=true;},true);
    document.addEventListener('pointerup',e=>{if(bitClick&&bitClick.id===e.pointerId){if(!bitClick.moved){wheelBits=bitClick.previous;wheelBits.delete(bitClick.bit);wheelBits.add(bitClick.bit);selectBitScreen(bitClick.x,bitClick.y+(matchMedia('(max-width:1100px)').matches?scrollY:0),bitClick.rays);}bitClick=null;}},true);
    document.addEventListener('pointercancel',()=>{bitClick=null;wheelBits.clear();},true);
    document.addEventListener('click',()=>{wheelAction=null;},true);
    document.addEventListener('wheel',e=>{
      if(!e.deltaY&&!(e.shiftKey&&e.deltaX))return;   // v0.214: Shift + колесо часто приходит как deltaX
      if(e.target.closest?.('#hubRail,.gz-ladder,.hubRombGrid'))return;   // v0.267: колесо над рейкой прокручивает её (и ползунки в ней), а не поле
      const y=e.clientY+(matchMedia('(max-width:1100px)').matches?scrollY:0),mirror=window.HubMirror;
      if(!wheelAction){
        if(e.target===angleText)wheelAction=ev=>{rotate(Math.sign(ev.deltaY)*5);rotation.value=state.angle;};
        else if(e.target===flipButton)wheelAction=ev=>{stopFlip();advanceFlip(Math.sign(ev.deltaY)*5);changed();};
        else{
          if(e.target.closest('.hub,.hubMirrorSettings,.hubBitView,.hubColorEditor,#hubZoom,#hubRec,#hubPNG,#hub3DQuick,#hubLogoCv,#hubLogoBox'))return;
          const zone=mirror?.wheelZoneAt?.(e.clientX,e.clientY);
          if(zone)wheelAction=ev=>mirror.wheelStep(zone,ev.deltaY);
          else if(e.target.closest('.hubMirrorLine')&&mirror?.wheelAlong)wheelAction=ev=>mirror.wheelAlong(ev.deltaY);
          else{const bit=bitScreen(e.clientX,y);
            if(bit!==null&&wheelBits.size){const selected=[...wheelBits];wheelAction=ev=>{const d=Math.sign(ev.deltaY||ev.deltaX);if(!d)return;for(const chosen of selected){if((ev.shiftKey||window.HubExactTilt?.on)&&mirror.tiltBitExact)mirror.tiltBitExact(chosen,d);else mirror.tiltBit(chosen,d*5);}};}
            else{if(frame&&(e.clientX<frame.left||y>frame.height))return;
              wheelAction=ev=>zoom(Math.exp(-Math.max(-120,Math.min(120,ev.deltaY))*.002),ev.clientX,ev.clientY+(matchMedia('(max-width:1100px)').matches?scrollY:0));}
          }
        }
      }
      e.preventDefault();e.stopPropagation?.();wheelAction(e);
    },{passive:false,capture:true});

    const beginDrag=(e,requireHit=false)=>{
      const pinned=window.HubMirror?.state.screenPin===true;
      if((requireHit&&e.button!==1&&!state.unlocked&&!pinned)||(e.button!==0&&e.button!==1)||e.target.closest('.hub,.hubMirrorSettings,.hubBitView,.hubColorEditor,input,select,summary,#hubLogoBox,#hubZoom,#hubRec,#hubPNG,#hub3DQuick,#hubRail,.gz-ladder,.hubRombGrid')||(e.target.closest('button')&&!e.target.closest('.hubNoteCell'))||(!requireHit&&e.target.closest('#hubMirror')))return false;
      const y=e.clientY+(matchMedia('(max-width:1100px)').matches?scrollY:0);if(frame&&(e.clientX<frame.left||y>frame.height))return false;
      const hit=hitScreen(e.clientX,y),selectedBit=e.button===1?bitScreen(e.clientX,y):null,onBits=hit.source||hit.mirror||selectedBit!==null;
      if(e.button===0&&!pinned&&!state.unlocked&&(onBits||e.target.closest('.hubNoteCell')))return false;if(requireHit&&!onBits)return false;
      if(!onBits&&e.button===0&&window.HubMirror?.grabAxis){stopAuto();return window.HubMirror.grabAxis(e);}
      if(e.button===1)e.preventDefault();
      e.stopPropagation();const start=state.pan.slice(),x=e.clientX,sy=e.clientY,cx=innerWidth/2,cy=innerHeight/2;
      let moved=false,lastAngle=Math.atan2(sy-cy,x-cx),travel=0,applied=0;
      // The reflection is painted above the original: in an overlap it receives the drag.
      const direction=pinned&&onBits&&hit.mirror?-1:1;
      const move=ev=>{if(ev.pointerId!==e.pointerId)return;if(locked(pinned&&e.button!==1?'turn':'pan'))return;
        if(!moved&&Math.hypot(ev.clientX-x,ev.clientY-sy)>3){moved=true;if(pinned){stopAuto();window.HubMirror.stopRotation?.();}}
        if(!moved)return;
        if(pinned&&e.button!==1){
          if(Math.hypot(ev.clientX-cx,ev.clientY-cy)<12)return;
          const angle=Math.atan2(ev.clientY-cy,ev.clientX-cx);let step=angle-lastAngle;
          if(step>Math.PI)step-=2*Math.PI;else if(step<-Math.PI)step+=2*Math.PI;
          lastAngle=angle;travel+=step;
          const wanted=direction*(magnetic()?Math.round(travel/(Math.PI/12))*(Math.PI/12):travel),delta=wanted-applied;
          if(Math.abs(delta)<1e-12)return;
          const pivot=screenCenterAnchor();
          if(onBits)window.HubMirror.counterRotateView(delta);
          rotateAround(delta,...pivot);applied=wanted;
        }else{state.pan=[start[0]+ev.clientX-x,start[1]+ev.clientY-sy];changed();}
      };
      const end=ev=>{if(ev.pointerId!==e.pointerId)return;document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',end);document.removeEventListener('pointercancel',end);if(!moved&&e.button===1&&ev.type==='pointerup'){if(selectedBit!==null){selectBitScreen(e.clientX,y);window.HubMirror.tiltBit(selectedBit);}else repeatScrollRotation();}if(moved){document.addEventListener('click',swallow,{capture:true,once:true});}};
      const swallow=ev=>{ev.preventDefault();ev.stopImmediatePropagation();};document.addEventListener('pointermove',move);document.addEventListener('pointerup',end);document.addEventListener('pointercancel',end);
      return true;
    };window.HubView.grabBits=beginDrag;document.addEventListener('pointerdown',e=>beginDrag(e));
    window.addEventListener('hubview',()=>rotation.value=state.angle);window.addEventListener('hubmirror',()=>{markMoving();if(state.flip||state.mirrorFlip)changed(false);});changed();
    document.addEventListener('dblclick',e=>{if(e.target.closest('.hub,.hubMirrorSettings,.hubBitView,.hubColorEditor,#hubZoom,#hubRec,#hubPNG,#hub3DQuick,#hubLogoBox,.hubMirrorTurn'))return;const y=e.clientY+(matchMedia('(max-width:1100px)').matches?scrollY:0);if(!frame||e.clientX<0||y>frame.height)return;if(centerTriangleAtAxis(e.clientX,y)){e.preventDefault();e.stopPropagation();return;}if(e.target.closest('.hubNoteCell'))return;e.preventDefault();e.stopPropagation();if(!fieldPaused){resumeFlip=flipRunning;resumeAuto=autoRunning;stopAuto();stopFlip();fieldPaused=true;}else{fieldPaused=false;if(resumeAuto)startAuto();resumeAuto=false;if(resumeFlip){flipRunning=true;flipTime=0;flipRaf=requestAnimationFrame(flipTick);}}window.dispatchEvent(new CustomEvent('hubmotionpause',{detail:{paused:fieldPaused}}));changed();});
  }
  window.HubView.snapshot=()=>({state:JSON.parse(JSON.stringify(state)),autoRunning,flipRunning,zoomRunning,zoomPhase,fieldPaused,resumeAuto,resumeFlip,resumeZoom,lastScrollRotation,autoRemainder,autoZero,flipQuickShown});
  window.HubView.restore=s=>{
    stopAuto();stopFlip();stopAutoZoom();window.HubPresetCore.applyKnown(state,s.state);
    fieldPaused=!!s.fieldPaused;resumeAuto=!!s.resumeAuto;resumeFlip=!!s.resumeFlip;resumeZoom=!!s.resumeZoom;
    zoomPhase=s.zoomPhase||0;lastScrollRotation=s.lastScrollRotation||5;autoZero=!!s.autoZero;flipQuickShown=!!s.flipQuickShown;
    if(s.autoRunning)startAuto();autoRemainder=s.autoRemainder||0;
    if(s.flipRunning){flipRunning=true;flipTime=0;flipRaf=requestAnimationFrame(flipTick);}
    if(s.zoomRunning)startAutoZoom();changed();
    // Other modules restore their own pause/resume flags; broadcasting a new
    // pause here would overwrite the saved intent to resume those animations.
  };
  document.addEventListener('DOMContentLoaded',init,{once:true});
})();
