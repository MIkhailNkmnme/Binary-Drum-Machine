/* Hub v0.191 — А: reflected light; Б: water flowing around the visible bit shapes. */
(() => {
  'use strict';
  let canvas,ctx,maskCanvas,maskCtx,waterCanvas,waterCtx,field,pixels,cell=2;
  let dirty=true,lastMask=-Infinity,lastTime=0,accumulator=0,raf=0,paused=false,light=false,water=false;
  let bounds=null,rays=[],emission=0,waterEmission=0,sample=0,lightButton,waterButton,status;
  const invalidate=()=>{dirty=true;if(light||water)wake();};
  function reset(){rays=[];emission=waterEmission=accumulator=0;if(field){field.water.fill(0);field.drained=0;}ctx?.clearRect(0,0,canvas.width,canvas.height);}
  function size(){
    const w=innerWidth,h=innerHeight;
    cell=Math.max(1.5,Math.sqrt(w*h/320000));
    const cols=Math.ceil(w/cell),rows=Math.ceil(h/cell);
    if(field&&field.width===cols&&field.height===rows&&canvas.width===w&&canvas.height===h)return;
    canvas.width=w;canvas.height=h;maskCanvas.width=waterCanvas.width=cols;maskCanvas.height=waterCanvas.height=rows;
    field=new HubFlowCore.Field(cols,rows);pixels=waterCtx.createImageData(cols,rows);rays=[];dirty=true;
  }
  function rebuild(time){
    if(!dirty||time-lastMask<100)return;
    dirty=false;lastMask=time;maskCtx.setTransform(1/cell,0,0,1/cell,0,0);maskCtx.clearRect(0,0,canvas.width,canvas.height);
    maskCtx.save();maskCtx.translate(0,-(matchMedia('(max-width:1100px)').matches?scrollY:0));
    const ready=window.HubView?.drawFlowObstacles?.(maskCtx);maskCtx.restore();
    const {width:w,height:h}=field,rgba=maskCtx.getImageData(0,0,w,h).data,solid=new Uint8Array(w*h);
    const left=matchMedia('(max-width:1100px)').matches?0:300;
    let minX=w,maxX=0,minY=h,count=0;
    for(let y=0;y<h;y++)for(let x=Math.ceil(left/cell);x<w;x++){
      const i=y*w+x;if(ready&&rgba[i*4+3]>=32){solid[i]=1;count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);}
    }
    field.setMask(solid);bounds=count?{minX,maxX,y:Math.max(0,minY-Math.ceil(55/cell))}:null;
    status.textContent=!light&&!water?'Потоки выключены':window.HubImage?.active?'Выберите биты вместо картинки':bounds?'Сверху вниз · '+(light?'свет ':'')+(water?'вода':''):'Биты за пределами поля';
    canvas.dataset.obstacles=String(count);
  }
  function emit(dt){
    if(!bounds)return;
    const span=bounds.maxX-bounds.minX+1;
    const nextX=()=>bounds.minX+((++sample*.6180339887498949)%1)*span;
    if(light){emission+=dt*Math.min(100,Math.max(24,span*cell/12));while(emission>=1){emission--;const x=nextX();if(!field.blocked(x,bounds.y)&&rays.length<350)rays.push({x,y:bounds.y,vx:0,vy:1,bounces:0,age:0});}}
    if(water){waterEmission+=dt*Math.min(1800,Math.max(160,span*2));while(waterEmission>=1){waterEmission--;field.addWater(nextX(),bounds.y,1);}}
  }
  function draw(dt){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const palette=window.HubMirror?.colors?.()||{bit:'#8fd3ff',sym:'#ff9a5a'};
    // Canvas normalizes all supported CSS colours for the low-resolution water image.
    ctx.fillStyle=palette.bit;ctx.fillRect(0,0,1,1);const rgb=ctx.getImageData(0,0,1,1).data;ctx.clearRect(0,0,1,1);
    const data=pixels.data;let volume=0;
    for(let i=0;i<field.water.length;i++){const mass=field.water[i];volume+=mass;data[i*4]=rgb[0];data[i*4+1]=rgb[1];data[i*4+2]=rgb[2];data[i*4+3]=mass>.01?Math.round(Math.min(1,Math.sqrt(mass))*210):0;}
    waterCtx.putImageData(pixels,0,0);ctx.imageSmoothingEnabled=true;ctx.drawImage(waterCanvas,0,0,field.width*cell,field.height*cell);
    ctx.strokeStyle=palette.sym;ctx.lineWidth=1.25;ctx.lineCap='round';ctx.shadowColor=palette.sym;ctx.shadowBlur=5;
    for(const ray of rays){
      ray.age+=dt;const path=field.advanceRay(ray,dt*420/cell);
      ray.trail=ray.trail||[];for(const p of path)ray.trail.push([...p,ray.age]);
      ray.trail=ray.trail.filter(p=>ray.age-p[2]<.32);
      ctx.globalAlpha=Math.max(.25,1-ray.bounces*.065);ctx.beginPath();ray.trail.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](p[0]*cell,p[1]*cell));ctx.stroke();
    }
    rays=rays.filter(r=>!r.dead&&r.age<8);ctx.globalAlpha=1;ctx.shadowBlur=0;
    canvas.dataset.water=String(Math.round(volume));canvas.dataset.rays=String(rays.length);
  }
  function frame(time){
    raf=0;if(document.hidden||paused){lastTime=0;return;}
    size();rebuild(time);const dt=lastTime?Math.min(.05,(time-lastTime)/1000):1/60;lastTime=time;
    emit(dt);accumulator+=dt;
    // Fixed physical step independent of display refresh rate; at most six steps after a stall.
    const step=cell/150;let steps=0;while(accumulator>=step&&steps++<6){if(water||Number(canvas.dataset.water)>0)field.stepWater();accumulator-=step;}
    draw(dt);
    if(light||water||rays.length||Number(canvas.dataset.water)>0)raf=requestAnimationFrame(frame);else lastTime=0;
  }
  function wake(){if(!raf&&!document.hidden&&!paused)raf=requestAnimationFrame(frame);}
  function sync(){lightButton.setAttribute('aria-pressed',String(light));waterButton.setAttribute('aria-pressed',String(water));dirty=true;lastMask=-Infinity;wake();}
  function init(){
    const tools=document.getElementById('hubFieldTools');if(!tools)return;
    const wrap=document.createElement('div');wrap.className='hubFlowControls';
    const button=(text,label,fn)=>{const b=document.createElement('button');b.type='button';b.className='hubRhomb';b.textContent=text;b.title=label;b.setAttribute('aria-label',label);b.onclick=fn;wrap.append(b);return b;};
    lightButton=button('А\nСвет','А — свет сверху: включить / выключить',()=>{light=!light;sync();});
    waterButton=button('Б\nВода','Б — вода сверху: включить / выключить',()=>{water=!water;sync();});
    button('↺\nСброс','Очистить свет и воду, остановить потоки',()=>{light=water=false;reset();sync();});
    status=document.createElement('small');status.className='hubFlowStatus';status.textContent='Свет отражается · вода стекает и копится';wrap.append(status);tools.append(wrap);
    canvas=document.createElement('canvas');canvas.id='hubFlow';canvas.setAttribute('aria-hidden','true');document.body.append(canvas);ctx=canvas.getContext('2d');
    maskCanvas=document.createElement('canvas');maskCtx=maskCanvas.getContext('2d',{willReadFrequently:true});waterCanvas=document.createElement('canvas');waterCtx=waterCanvas.getContext('2d');
    lightButton.setAttribute('aria-pressed','false');waterButton.setAttribute('aria-pressed','false');
    for(const event of ['hubview','hubmirror','hubimage','resize','scroll'])window.addEventListener(event,invalidate,{passive:true});
    document.addEventListener('visibilitychange',()=>{lastTime=0;if(!document.hidden&&(light||water))wake();});
    window.addEventListener('hubmotionpause',e=>{paused=!!e.detail.paused;lastTime=0;if(!paused)wake();});
    window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);raf=0;lastTime=0;});
    window.addEventListener('pageshow',()=>{if(light||water)wake();});
  }
  window.HubFlow={invalidate};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
