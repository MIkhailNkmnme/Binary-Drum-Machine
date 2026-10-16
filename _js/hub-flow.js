/* Hub v0.202 — continuous full-width light and one-pixel water sources. */
(() => {
  'use strict';
  let canvas,ctx,maskCanvas,maskCtx,waterCanvas,waterCtx,liquidCanvas,liquidCtx,field,liquid,pixels,liquidPixels,cell=2;
  let dirty=true,lastMask=-Infinity,lastTime=0,accumulator=0,snowAccumulator=0,raf=0,paused=false,light=false,snow=false,water=false;
  let bounds=null,rays=[],emission=0,snowEmission=0,waterEmission=0,sample=0,lightButton,snowButton,waterButton,status;
  let lightBits=false,lightSize=16,shapeButton,sizeOutput,sun=false,sunRadius=40,sunButton,radiusRange,radiusOutput;
  try{const saved=JSON.parse(localStorage.getItem('zerk_hub_flow')||'{}');lightBits=saved.bits===true;sun=saved.sun===true;if(Number.isFinite(saved.radius))sunRadius=Math.max(0,Math.min(innerWidth,saved.radius));if(Number.isFinite(saved.size))lightSize=Math.max(4,Math.min(64,saved.size));}catch(_){}
  let dense=false,denseButton,beams=null,beamDistance=0;
  try{dense=JSON.parse(localStorage.getItem('zerk_hub_flow')||'{}').dense===true;if(dense)sun=false;}catch(_){}
  const saveStyle=()=>{try{localStorage.setItem('zerk_hub_flow',JSON.stringify({bits:lightBits,size:lightSize,sun,radius:sunRadius,dense}));}catch(_){}};
  let spriteKey='',sprites=[];
  function lightSprites(){
    const mirror=window.HubMirror;if(!mirror)return [];
    const st=mirror.state,key=JSON.stringify([lightSize,st.bitView,st.packedBits,st.zero,st.one,st.hideZeroDigit,st.hideOneDigit,mirror.colors().sym]);
    if(key!==spriteKey){spriteKey=key;sprites=['0','1'].map(bit=>{const c=document.createElement('canvas'),side=Math.ceil(lightSize*2+6);c.width=c.height=side*2;const g=c.getContext('2d');g.setTransform(2,0,0,2,side,side);mirror.drawCenterBit(g,{bit,width:lightSize,height:lightSize*Math.sqrt(3)});return c;});}
    return sprites;
  }
  const invalidate=()=>{dirty=true;if(light||snow||water)wake();};
  function reset(){rays=[];beams=null;beamDistance=0;emission=snowEmission=waterEmission=accumulator=snowAccumulator=0;if(field){field.water.fill(0);field.drained=0;liquid.water.fill(0);liquid.activeRows.clear();liquid.drained=0;}ctx?.clearRect(0,0,canvas.width,canvas.height);}
  function sunSource(){const left=matchMedia('(max-width:1100px)').matches?0:300;return {x:left+(innerWidth-left)*.25,y:Math.min(110,innerHeight*.2),radius:Math.min(sunRadius,innerWidth)};}
  function size(){
    const w=innerWidth,h=innerHeight;
    if(radiusRange){radiusRange.max=String(w);sunRadius=Math.min(sunRadius,w);radiusRange.value=String(sunRadius);radiusOutput.textContent=sunRadius+'px';}
    cell=Math.max(1.5,Math.sqrt(w*h/320000));
    const cols=Math.ceil(w/cell),rows=Math.ceil(h/cell);
    if(field&&field.width===cols&&field.height===rows&&canvas.width===w&&canvas.height===h)return;
    canvas.width=maskCanvas.width=liquidCanvas.width=w;canvas.height=maskCanvas.height=liquidCanvas.height=h;waterCanvas.width=cols;waterCanvas.height=rows;
    field=new HubFlowCore.Field(cols,rows);liquid=new HubFlowCore.WaterField(w,h);pixels=waterCtx.createImageData(cols,rows);liquidPixels=liquidCtx.createImageData(w,h);rays=[];dirty=true;
    beams=null;canvas.dataset.waterCell='1';
  }
  function rebuild(time){
    if(!dirty||time-lastMask<100)return;
    dirty=false;lastMask=time;
    const {width:w,height:h}=field,solid=new Uint8Array(w*h),types=new Uint8Array(w*h),liquidSolid=new Uint8Array(canvas.width*canvas.height);
    let count=0,zero=0,one=0;
    // Keep both types at an overlap: either reflecting layer must still stop the ray.
    for(const bit of ['0','1']){
      maskCtx.setTransform(1,0,0,1,0,0);maskCtx.clearRect(0,0,canvas.width,canvas.height);
      maskCtx.save();maskCtx.translate(0,-(matchMedia('(max-width:1100px)').matches?scrollY:0));
      const ready=window.HubView?.drawFlowObstacles?.(maskCtx,bit);maskCtx.restore();
      const native=maskCtx.getImageData(0,0,canvas.width,canvas.height).data;
      for(let i=0;i<liquidSolid.length;i++)if(ready&&native[i*4+3]>=32)liquidSolid[i]=1;
      waterCtx.clearRect(0,0,w,h);waterCtx.drawImage(maskCanvas,0,0,w,h);
      const rgba=waterCtx.getImageData(0,0,w,h).data;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const i=y*w+x;if(ready&&rgba[i*4+3]>=32){if(!solid[i])count++;solid[i]=1;types[i]|=bit==='0'?1:2;if(bit==='0')zero++;else one++;}
      }
    }
    field.setMask(solid);field.lightTypes=types;liquid.setMask(liquidSolid);beams=null;bounds={minX:0,maxX:canvas.width/cell-1,y:0};
    canvas.dataset.sourceLeft='0';canvas.dataset.sourceRight=String(canvas.width);
    canvas.dataset.zeroObstacles=String(zero);canvas.dataset.oneObstacles=String(one);
    status.textContent=!light&&!snow&&!water?'Потоки выключены':window.HubImage?.active?'Выберите биты вместо картинки':bounds||sun&&light?(sun&&light?'Солнце · ':'Сверху вниз · ')+(light?'свет ':'')+(snow?'снег ':'')+(water?'вода':''):'Биты за пределами поля';
    canvas.dataset.obstacles=String(count);
  }
  function emit(dt){
    if(!bounds&&!(light&&sun))return;
    const span=bounds?bounds.maxX-bounds.minX+1:innerWidth/cell;
    const nextX=()=>bounds.minX+((++sample*.6180339887498949)%1)*span;
    if(light&&!dense){
      emission+=dt*(sun?100:Math.min(100,Math.max(24,span*cell/12)));
      while(emission>=1){
        emission--;let x,y=0,vx=0,vy=1;
        if(sun){const origin=sunSource(),angle=(++sample*.6180339887498949%1)*Math.PI*2;vx=Math.cos(angle);vy=Math.sin(angle);x=(origin.x+vx*origin.radius)/cell;y=(origin.y+vy*origin.radius)/cell;}
        else x=nextX();
        if(x>=0&&x<field.width&&y>=0&&y<field.height&&!field.lightBlocked(x,y,vy)&&rays.length<350)rays.push({x,y,vx,vy,bounces:0,age:0,bit:String(sample%2)});
      }
    }
    if(snow&&bounds){snowEmission+=dt*Math.min(1800,Math.max(160,span*2));while(snowEmission>=1){snowEmission--;field.addWater(nextX(),bounds.y,1);}}
    if(water&&bounds&&!dense){waterEmission+=dt*Math.min(1800,Math.max(160,span*2));while(waterEmission>=1){waterEmission--;liquid.addWater(nextX()*cell,0,1);}}
  }
  function draw(dt){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const palette=window.HubMirror?.colors?.()||{bit:'#8fd3ff',sym:'#ff9a5a'};
    const data=pixels.data;let snowVolume=0,volume=0;
    for(let i=0;i<field.water.length;i++){const mass=field.water[i];snowVolume+=mass;data[i*4]=data[i*4+1]=data[i*4+2]=255;data[i*4+3]=mass>.01?Math.round(Math.min(1,Math.sqrt(mass))*230):0;}
    waterCtx.putImageData(pixels,0,0);ctx.imageSmoothingEnabled=true;ctx.drawImage(waterCanvas,0,0,field.width*cell,field.height*cell);
    const wetPixels=liquidPixels.data;wetPixels.fill(0);
    for(const y of liquid.activeRows)for(let x=0;x<liquid.width;x++){
      const i=y*liquid.width+x,m=liquid.water[i];volume+=m;if(m<=.002)continue;
      wetPixels[i*4]=55;wetPixels[i*4+1]=175;wetPixels[i*4+2]=255;wetPixels[i*4+3]=Math.round(100+m*100);
    }
    liquidCtx.putImageData(liquidPixels,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(liquidCanvas,0,0);
    // The top of each liquid cell is a height, not a pile-shaped opacity gradient.
    ctx.strokeStyle='#37afff';ctx.lineWidth=.8;ctx.beginPath();
    for(const y of liquid.activeRows)for(let x=0;x<liquid.width;x++){
      const i=y*liquid.width+x,m=liquid.water[i];
      if(m>.002&&(y===0||liquid.water[i-liquid.width]<.002)&& (y===liquid.height-1||liquid.solid[i+liquid.width]||liquid.water[i+liquid.width]>.999)){
        const top=y+1-m;ctx.moveTo(x,top);ctx.lineTo(x+1,top);
      }
    }ctx.stroke();
    if(sun&&light){const origin=sunSource();ctx.save();ctx.strokeStyle=ctx.fillStyle=palette.sym;ctx.lineWidth=1;ctx.globalAlpha=.22;ctx.beginPath();ctx.arc(origin.x,origin.y,Math.max(1,origin.radius),0,Math.PI*2);ctx.fill();ctx.globalAlpha=.8;ctx.stroke();ctx.restore();}
    if(light&&dense){
      if(!beams)beams=field.topBeams();beamDistance+=dt*420/cell;
      ctx.save();ctx.strokeStyle=palette.sym;ctx.lineWidth=cell+1;ctx.lineCap='butt';
      // Adjacent strips meet without gaps; each reflected segment loses half its light.
      for(const segment of beams){
        const fraction=Math.min(1,(beamDistance-segment.start)/segment.length);if(fraction<=0)continue;
        const {a,b}=segment;ctx.globalAlpha=segment.alpha;ctx.beginPath();ctx.moveTo(a[0]*cell,a[1]*cell);
        ctx.lineTo((a[0]+(b[0]-a[0])*fraction)*cell,(a[1]+(b[1]-a[1])*fraction)*cell);ctx.stroke();
      }
      ctx.restore();
    }
    ctx.strokeStyle=palette.sym;ctx.lineWidth=1.25;ctx.lineCap='round';ctx.shadowColor=palette.sym;ctx.shadowBlur=5;
    const glyphs=lightBits?lightSprites():[];
    for(const ray of rays){
      ray.age+=dt;const path=field.advanceRay(ray,dt*420/cell);
      ray.trail=ray.trail||[];for(const p of path)ray.trail.push([p[0],p[1],ray.age,p[2]]);
      ray.trail=ray.trail.filter(p=>ray.age-p[2]<.32);
      if(lightBits&&glyphs.length){
        const glyph=glyphs[Number(ray.bit)],side=glyph.width/2;
        ctx.globalAlpha=2**-ray.bounces;ctx.shadowBlur=0;ctx.drawImage(glyph,ray.x*cell-side/2,ray.y*cell-side/2,side,side);
      }else{
        // Keep the incident segment bright; only the reflected segment loses half its light.
        const trail=ray.trail;ctx.shadowBlur=5;ctx.beginPath();let alpha=null;
        for(let i=1;i<trail.length;i++){const p=trail[i-1],q=trail[i];if(alpha!==p[3]){if(alpha!==null)ctx.stroke();alpha=p[3];ctx.globalAlpha=alpha;ctx.beginPath();ctx.moveTo(p[0]*cell,p[1]*cell);}ctx.lineTo(q[0]*cell,q[1]*cell);}
        ctx.stroke();
      }
    }
    rays=rays.filter(r=>!r.dead&&r.age<8);ctx.globalAlpha=1;ctx.shadowBlur=0;
    canvas.dataset.snow=String(Math.round(snowVolume));canvas.dataset.water=String(Math.round(volume));canvas.dataset.rays=String(rays.length);canvas.dataset.dense=String(dense);canvas.dataset.lightStyle=dense?'continuous':lightBits?'bits':'rays';canvas.dataset.beams=String(beams?.length||0);canvas.dataset.lightSize=String(lightSize);canvas.dataset.sourceY='0';canvas.dataset.lightSource=sun?'sun':'top';canvas.dataset.sunRadius=String(sunRadius);
  }
  function frame(time){
    raf=0;if(document.hidden||paused){lastTime=0;return;}
    size();rebuild(time);const dt=lastTime?Math.min(.05,(time-lastTime)/1000):1/60;lastTime=time;
    emit(dt);accumulator=Math.min(accumulator+dt,.04);
    // Bound catch-up work so a dense one-pixel field cannot starve input and recording.
    const step=1/150,deadline=performance.now()+8;let steps=0;while(accumulator>=step&&steps++<6){if(water||Number(canvas.dataset.water)>0)liquid.stepWater();if(water&&dense)liquid.fillTop();accumulator-=step;if(performance.now()>=deadline)break;}
    snowAccumulator+=dt;steps=0;while(snowAccumulator>=cell/150&&steps++<6){if(snow||Number(canvas.dataset.snow)>0)field.stepWater();snowAccumulator-=cell/150;}
    draw(dt);
    if(light||snow||water||rays.length||Number(canvas.dataset.snow)>0||Number(canvas.dataset.water)>0)raf=requestAnimationFrame(frame);else lastTime=0;
  }
  function wake(){if(!raf&&!document.hidden&&!paused)raf=requestAnimationFrame(frame);}
  function sync(){lightButton.setAttribute('aria-pressed',String(light));snowButton.setAttribute('aria-pressed',String(snow));waterButton.setAttribute('aria-pressed',String(water));dirty=true;lastMask=-Infinity;wake();}
  function init(){
    const tools=document.getElementById('hubFieldTools');if(!tools)return;
    const wrap=document.createElement('div');wrap.className='hubFlowControls';
    const button=(text,label,fn)=>{const b=document.createElement('button');b.type='button';b.className='hubRhomb';b.textContent=text;b.title=label;b.setAttribute('aria-label',label);b.onclick=fn;wrap.append(b);return b;};
    lightButton=button('А\nСвет','А — свет: включить / выключить',()=>{light=!light;beamDistance=0;sync();});
    snowButton=button('Б\nСнег','Б — мокрый снег сверху: включить / выключить',()=>{snow=!snow;sync();});
    waterButton=button('В\nВода','В — вода: горизонтальный уровень и сток',()=>{water=!water;sync();});
    button('↺\nСброс','Очистить свет, снег и воду, остановить потоки',()=>{light=snow=water=false;reset();sync();});
    denseButton=button('▤\nПлотно','Сплошной поток света и воды сверху',()=>{dense=!dense;if(dense)sun=false;sunButton.setAttribute('aria-pressed',String(sun));denseButton.setAttribute('aria-pressed',String(dense));rays=[];beams=null;beamDistance=0;saveStyle();sync();});
    denseButton.setAttribute('aria-pressed',String(dense));
    shapeButton=button('01\nСвет','Свет в виде выбранных битов 0 и 1',()=>{lightBits=!lightBits;shapeButton.setAttribute('aria-pressed',String(lightBits));saveStyle();wake();});
    shapeButton.setAttribute('aria-pressed',String(lightBits));
    const sizeControl=document.createElement('details');sizeControl.className='hubTilt';
    const sizeHead=document.createElement('summary');sizeHead.textContent='↔\nСвет';sizeHead.title='Размер битов света';sizeHead.setAttribute('aria-label','Размер битов света');
    const label=document.createElement('label');label.append('Размер света');
    const range=document.createElement('input');range.type='range';range.min='4';range.max='64';range.step='1';range.value=lightSize;range.setAttribute('aria-label','Размер битов света, пиксели');
    sizeOutput=document.createElement('output');sizeOutput.textContent=lightSize+'px';range.oninput=()=>{lightSize=Number(range.value);sizeOutput.textContent=lightSize+'px';saveStyle();wake();};
    label.append(range,sizeOutput);sizeControl.append(sizeHead,label);wrap.append(sizeControl);
    sunButton=button('☀\nСолнце','Свет из солнца: круговой источник',()=>{sun=!sun;if(sun){dense=false;denseButton.setAttribute('aria-pressed','false');}sunButton.setAttribute('aria-pressed',String(sun));rays=[];saveStyle();sync();});sunButton.setAttribute('aria-pressed',String(sun));
    const radiusControl=document.createElement('details');radiusControl.className='hubTilt';
    const radiusHead=document.createElement('summary');radiusHead.textContent='☀\nРадиус';radiusHead.title='Радиус солнца';radiusHead.setAttribute('aria-label','Радиус солнца');
    const radiusLabel=document.createElement('label');radiusLabel.append('Радиус солнца');
    radiusRange=document.createElement('input');radiusRange.type='range';radiusRange.min='0';radiusRange.max=String(innerWidth);radiusRange.step='1';radiusRange.value=sunRadius;radiusRange.setAttribute('aria-label','Радиус солнца, пиксели');
    radiusOutput=document.createElement('output');radiusOutput.textContent=sunRadius+'px';radiusRange.oninput=()=>{sunRadius=Number(radiusRange.value);radiusOutput.textContent=sunRadius+'px';saveStyle();wake();};
    radiusLabel.append(radiusRange,radiusOutput);radiusControl.append(radiusHead,radiusLabel);wrap.append(radiusControl);
    status=document.createElement('small');status.className='hubFlowStatus';status.textContent='Свет · мокрый снег · вода с ровным уровнем';wrap.append(status);tools.append(wrap);
    canvas=document.createElement('canvas');canvas.id='hubFlow';canvas.setAttribute('aria-hidden','true');document.body.append(canvas);ctx=canvas.getContext('2d');
    maskCanvas=document.createElement('canvas');maskCtx=maskCanvas.getContext('2d',{willReadFrequently:true});waterCanvas=document.createElement('canvas');waterCtx=waterCanvas.getContext('2d');
    liquidCanvas=document.createElement('canvas');liquidCtx=liquidCanvas.getContext('2d');
    lightButton.setAttribute('aria-pressed','false');snowButton.setAttribute('aria-pressed','false');waterButton.setAttribute('aria-pressed','false');
    for(const event of ['hubview','hubmirror','hubimage','resize','scroll'])window.addEventListener(event,invalidate,{passive:true});
    document.addEventListener('visibilitychange',()=>{lastTime=0;if(!document.hidden&&(light||snow||water))wake();});
    window.addEventListener('hubmotionpause',e=>{paused=!!e.detail.paused;lastTime=0;if(!paused)wake();});
    window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);raf=0;lastTime=0;});
    window.addEventListener('pageshow',()=>{if(light||snow||water)wake();});
  }
  window.HubFlow={invalidate};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
