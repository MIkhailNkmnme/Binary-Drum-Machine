/* Hub v0.109: unlock the canvas, cursor-centred zoom and a full 360-degree view rotation. */
(() => {
  'use strict';
  const state={unlocked:false,zoom:1,angle:0,pan:[0,0],sourcePan:[0,0]},buffers=new WeakMap();let frame=null,revision=0,unlock,scaleText,angleText,minus,plus;
  try{const saved=JSON.parse(localStorage.getItem('zerk_hub_view')||'null');if(saved){state.unlocked=!!saved.unlocked;for(const key of ['zoom','angle'])if(Number.isFinite(saved[key]))state[key]=saved[key];if(Array.isArray(saved.pan)&&saved.pan.length===2&&saved.pan.every(Number.isFinite))state.pan=saved.pan;}}catch(_){}
  try{const saved=JSON.parse(localStorage.getItem('zerk_hub_view')||'null');if(Array.isArray(saved?.sourcePan)&&saved.sourcePan.length===2&&saved.sourcePan.every(Number.isFinite))state.sourcePan=saved.sourcePan;}catch(_){}
  state.zoom=Math.max(.2,Math.min(6,state.zoom));state.angle=((state.angle%360)+360)%360;
  const save=()=>{try{localStorage.setItem('zerk_hub_view',JSON.stringify(state));}catch(_){}};
  const center=()=>frame?[frame.left+frame.width/2,frame.height/2]:[innerWidth/2,innerHeight/2];
  function matrix(){const [x,y]=center(),a=state.angle*Math.PI/180,c=Math.cos(a)*state.zoom,s=Math.sin(a)*state.zoom;return [c,s,-s,c,x+state.pan[0]-c*x+s*y,y+state.pan[1]-s*x-c*y];}
  function inverse(x,y){const [a,b,c,d,e,f]=matrix(),det=a*d-b*c;return [(d*(x-e)-c*(y-f))/det,(-b*(x-e)+a*(y-f))/det];}
  const sourceShift=()=>frame?[state.sourcePan[0]*frame.width,state.sourcePan[1]*frame.height]:[0,0];
  function apply(el){if(!el)return;const [a,b,c,d,e,f]=matrix(),x=el.offsetLeft,y=el.offsetTop,[sx,sy]=el.id==='hubMirror'||el.dataset.note?.includes('-mirror')?[0,0]:sourceShift();el.style.transformOrigin='0 0';el.style.transform=`matrix(${a},${b},${c},${d},${e+a*(x+sx)+c*(y+sy)-x},${f+b*(x+sx)+d*(y+sy)-y})`;}
  function sync(){if(!unlock)return;unlock.textContent=state.unlocked?'🔓':'🔒';unlock.setAttribute('aria-pressed',String(state.unlocked));unlock.title=state.unlocked?'Холст разблокирован: колесо — масштаб, тянуть пустое место — сдвиг':'Разблокировать холст: масштаб колесом и перемещение';scaleText.textContent=Math.round(state.zoom*100)+'%';angleText.textContent=state.angle+'°';minus.disabled=!state.unlocked||state.zoom<=.2;plus.disabled=!state.unlocked||state.zoom>=6;document.body.classList.toggle('hubCanvasUnlocked',state.unlocked);}
  function changed(){revision++;sync();document.querySelectorAll('#hubMirror,#hubAll,.hubNoteCell,#hubFly').forEach(apply);save();window.dispatchEvent(new Event('hubview'));}
  function zoom(factor,x,y){if(!state.unlocked)return;const before=state.zoom,next=Math.max(.2,Math.min(6,before*factor)),ratio=next/before,[cx,cy]=center();state.pan=[x-cx-(x-cx-state.pan[0])*ratio,y-cy-(y-cy-state.pan[1])*ratio];state.zoom=next;changed();}
  function rotate(delta){if(!state.unlocked)return;state.angle=((state.angle+delta)%360+360)%360;changed();}
  window.HubView={get revision(){return revision;},get unlocked(){return state.unlocked;},inverse,apply,sourceShift,place(left,width,height){frame={left,width,height};document.querySelectorAll('#hubMirror,#hubAll,.hubNoteCell,#hubFly').forEach(apply);},source(canvas,view=null){
    const [x,y]=sourceShift();if(!x&&!y)return;let copy=buffers.get(canvas);if(!copy){copy=document.createElement('canvas');buffers.set(canvas,copy);}copy.width=canvas.width;copy.height=canvas.height;copy.getContext('2d').drawImage(canvas,0,0);const k=view?view.scale:canvas.width/innerWidth,g=canvas.getContext('2d');g.save();g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,canvas.width,canvas.height);g.drawImage(copy,x*k,y*k);g.restore();
  },paint(canvas,view=null){
    if(state.zoom===1&&state.angle===0&&state.pan.every(v=>v===0))return;
    let copy=buffers.get(canvas);if(!copy){copy=document.createElement('canvas');buffers.set(canvas,copy);}if(copy.width!==canvas.width||copy.height!==canvas.height){copy.width=canvas.width;copy.height=canvas.height;}
    const cg=copy.getContext('2d');cg.clearRect(0,0,copy.width,copy.height);cg.drawImage(canvas,0,0);const g=canvas.getContext('2d'),k=view?view.scale:canvas.width/innerWidth,left=view?view.left:0,[a,b,c,d,e,f]=matrix();
    g.save();g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,canvas.width,canvas.height);g.setTransform(a,b,c,d,(e+(a-1)*left)*k,(f+b*left)*k);g.drawImage(copy,0,0);g.restore();
  }};
  function init(){const settings=document.querySelector('.hubMirrorSettings');if(!settings)return;
    const button=(text,label,action)=>{const b=document.createElement('button');b.type='button';b.className='hubRhomb';b.textContent=text;b.title=label;b.setAttribute('aria-label',label);b.onclick=action;settings.append(b);return b;};
    unlock=button('🔒','Разблокировать холст',()=>{state.unlocked=!state.unlocked;changed();});
    button('↺','Повернуть поле на −15°',()=>rotate(-15));angleText=button('0°','Сбросить поворот поля в 0°',()=>{if(state.unlocked){state.angle=0;changed();}});button('↻','Повернуть поле на +15°',()=>rotate(15));
    const rotation=document.createElement('input');rotation.type='range';rotation.min=0;rotation.max=360;rotation.step=1;rotation.value=state.angle;rotation.setAttribute('aria-label','Поворот поля на 360 градусов');rotation.className='hubViewRotation';settings.append(rotation);rotation.oninput=()=>{if(state.unlocked){state.angle=Number(rotation.value)%360;changed();}else rotation.value=state.angle;};
    angleText.addEventListener('wheel',e=>{if(!state.unlocked)return;e.preventDefault();e.stopPropagation();rotate(Math.sign(e.deltaY)*5);rotation.value=state.angle;},{passive:false});
    const zoomBox=document.createElement('div');zoomBox.id='hubZoom';const [cx,cy]=center();
    minus=button('−','Уменьшить масштаб холста',()=>zoom(1/1.15,...center()));minus.classList.add('hub-zoom-minus');zoomBox.append(minus);
    scaleText=document.createElement('output');scaleText.setAttribute('aria-label','Масштаб холста');scaleText.title='Двойной щелчок — масштаб 100% и центр';zoomBox.append(scaleText);scaleText.ondblclick=()=>{if(state.unlocked){state.zoom=1;state.pan=[0,0];changed();}};
    plus=button('+','Увеличить масштаб холста',()=>zoom(1.15,...center()));plus.classList.add('hub-zoom-plus');zoomBox.append(plus);document.body.append(zoomBox);
    document.addEventListener('wheel',e=>{if(!state.unlocked||e.target.closest('.hub,#hubZoom,#hubRec,#hubPNG,#hubLogoCv,#hubLogoBox'))return;const y=e.clientY+(matchMedia('(max-width:1100px)').matches?scrollY:0);if(frame&&(e.clientX<frame.left||y>frame.height))return;e.preventDefault();zoom(Math.exp(-Math.max(-120,Math.min(120,e.deltaY))*.002),e.clientX,y);},{passive:false});
    const beginDrag=(e,requireHit=false)=>{if(!state.unlocked||e.button!==0||e.target.closest('.hub,input,select,summary,#hubLogoBox,#hubZoom,#hubRec,#hubPNG')||(e.target.closest('button')&&!e.target.closest('.hubNoteCell'))||(!requireHit&&e.target.closest('#hubMirror')))return false;const y=e.clientY+(matchMedia('(max-width:1100px)').matches?scrollY:0);if(frame&&(e.clientX<frame.left||y>frame.height))return false;const hit=window.HubMirror.hit(...inverse(e.clientX,y));if(requireHit&&!hit.source&&!hit.mirror)return false;e.stopPropagation();const start=state.pan.slice(),source=state.sourcePan.slice(),mirror=window.HubMirror.position(),x=e.clientX,sy=e.clientY,world=inverse(x,y);let moved=false;
      const move=ev=>{if(ev.pointerId!==e.pointerId)return;if(Math.hypot(ev.clientX-x,ev.clientY-sy)>3)moved=true;if(moved){const p=inverse(ev.clientX,ev.clientY+(matchMedia('(max-width:1100px)').matches?scrollY:0)),dx=p[0]-world[0],dy=p[1]-world[1];if(hit.source)state.sourcePan=[source[0]+dx/frame.width,source[1]+dy/frame.height];if(hit.mirror)window.HubMirror.moveFrom(mirror,dx,dy);if(!hit.source&&!hit.mirror)state.pan=[start[0]+ev.clientX-x,start[1]+ev.clientY-sy];changed();}};
      const end=ev=>{if(ev.pointerId!==e.pointerId)return;document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',end);document.removeEventListener('pointercancel',end);if(moved){document.addEventListener('click',swallow,{capture:true,once:true});}};
      const swallow=ev=>{ev.preventDefault();ev.stopImmediatePropagation();};document.addEventListener('pointermove',move);document.addEventListener('pointerup',end);document.addEventListener('pointercancel',end);
      return true;
    };window.HubView.grabBits=beginDrag;document.addEventListener('pointerdown',e=>beginDrag(e));
    window.addEventListener('hubview',()=>rotation.value=state.angle);sync();
  }
  document.addEventListener('DOMContentLoaded',init,{once:true});
})();
