/* Hub v0.235 — «От оси»: потоки идут от ручки к началу оси, горизонт — через ручку, поле поворачивается вживую.
   Hub v0.205 — snapshots, directional optics and independent stream speeds. */
(() => {
  'use strict';
  let canvas,ctx,maskCanvas,maskCtx,waterCanvas,waterCtx,liquidCanvas,liquidCtx,field,liquid,pixels,liquidPixels,cell=2;
  let dirty=true,lastMask=-Infinity,lastTime=0,accumulator=0,snowAccumulator=0,raf=0,paused=false,light=false,snow=false,water=false;
  let bounds=null,rays=[],emission=0,snowEmission=0,waterEmission=0,sample=0,lightButton,snowButton,waterButton,status;
  let lightBits=false,lightSize=16,shapeButton,sizeOutput,sun=false,sunRadius=40,sunButton,radiusRange,radiusOutput;
  try{const saved=JSON.parse(localStorage.getItem('zerk_hub_flow')||'{}');lightBits=saved.bits===true;sun=saved.sun===true;if(Number.isFinite(saved.radius))sunRadius=Math.max(0,Math.min(innerWidth,saved.radius));if(Number.isFinite(saved.size))lightSize=Math.max(4,Math.min(64,saved.size));}catch(_){}
  let dense=false,denseButton,beams=null,beamDistance=0,waterCorners=true,cornersButton;
  try{dense=JSON.parse(localStorage.getItem('zerk_hub_flow')||'{}').dense===true;if(dense)sun=false;}catch(_){}
  try{waterCorners=JSON.parse(localStorage.getItem('zerk_hub_flow')||'{}').waterCorners!==false;}catch(_){}
  // v0.235: the simulation runs in a field frame; «От оси» turns it so that field-down follows the axis.
  let axisFlow=false,axisButton,guide=null,frameW=0,frameH=0,ls=1,dirX=0,dirY=1,horizon=0,lastTurn=-Infinity;
  try{axisFlow=JSON.parse(localStorage.getItem('zerk_hub_flow')||'{}').axis===true;}catch(_){}
  const toField=(sx,sy)=>{const u=sx-innerWidth/2,v=sy-innerHeight/2;return [frameW/2+dirY*u-dirX*v,frameH/2+dirX*u+dirY*v];};
  const fieldMatrix=()=>{const cx=innerWidth/2,cy=innerHeight/2;return [dirY,-dirX,dirX,dirY,cx-dirY*frameW/2-dirX*frameH/2,cy+dirX*frameW/2-dirY*frameH/2];};
  const maskMatrix=()=>{const cx=innerWidth/2,cy=innerHeight/2;return [dirY/ls,dirX/ls,-dirX/ls,dirY/ls,(frameW/2-dirY*cx+dirX*cy)/ls,(frameH/2-dirX*cx-dirY*cy)/ls];};
  // Offset (x, y) from the frame centre in the frame with down (ax, ay) -> the same screen point in the frame with down (bx, by).
  const turnPoint=(ax,ay,bx,by,x,y)=>{const sx=ay*x+ax*y,sy=-ax*x+ay*y;return [by*sx-bx*sy,bx*sx+by*sy];};
  function axisGuide(){
    const a=document.querySelector?.('.hubMirrorHandle'),b=document.querySelector?.('.hubMirrorTurn');if(!a||!b)return null;
    const p=a.getBoundingClientRect(),q=b.getBoundingClientRect();if(!q.width)return null;
    // The ◇ at the start of the axis is hidden while the mirror is off; then the axis angle gives the direction.
    const x=q.x+q.width/2,y=q.y+q.height/2;let dx=p.x+p.width/2-x,dy=p.y+p.height/2-y,len=p.width?Math.hypot(dx,dy):0;
    if(len<1){const angle=(window.HubMirror?.state?.angle||0)+(window.HubView?.rotation||0);dx=-Math.cos(angle);dy=-Math.sin(angle);len=1;}
    return {dx:dx/len,dy:dy/len,x,y};
  }
  function regrid(grid,k,ox,oy,nx,ny){
    const w=grid.width,h=grid.height,src=grid.water;if(!src.some(m=>m>0))return;
    const dst=new Float32Array(src.length),hw=frameW/2,hh=frameH/2;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const p=turnPoint(nx,ny,ox,oy,(x+.5)*k-hw,(y+.5)*k-hh),ix=Math.floor((p[0]+hw)/k),iy=Math.floor((p[1]+hh)/k);
      if(ix>=0&&iy>=0&&ix<w&&iy<h)dst[y*w+x]=src[iy*w+ix];
    }
    grid.water=dst;if(grid.activeRows){grid.activeRows.clear();for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(dst[y*w+x]>0){grid.activeRows.add(y);break;}}
  }
  function followAxis(time){
    if(!axisFlow||!field)return;guide=axisGuide();if(!guide)return;
    const nx=guide.dx,ny=guide.dy;
    if((Math.abs(nx*dirY-ny*dirX)>.002||nx*dirX+ny*dirY<0)&&time-lastTurn>=50){
      // Settled snow and water stay where they are on screen; new gravity takes over from there.
      lastTurn=time;const hw=frameW/2,hh=frameH/2;regrid(field,cell,dirX,dirY,nx,ny);regrid(liquid,ls,dirX,dirY,nx,ny);
      for(const ray of rays){
        const p=turnPoint(dirX,dirY,nx,ny,ray.x*cell-hw,ray.y*cell-hh),v=turnPoint(dirX,dirY,nx,ny,ray.vx,ray.vy);ray.x=(p[0]+hw)/cell;ray.y=(p[1]+hh)/cell;ray.vx=v[0];ray.vy=v[1];
        for(const t of ray.trail||[]){const q=turnPoint(dirX,dirY,nx,ny,t[0]*cell-hw,t[1]*cell-hh);t[0]=(q[0]+hw)/cell;t[1]=(q[1]+hh)/cell;}
      }
      dirX=nx;dirY=ny;dirty=true;beams=null;
    }
    const row=Math.max(0,Math.min(frameH-1,toField(guide.x,guide.y)[1]));
    if(Math.abs(row-horizon)>.5){horizon=row;beams=null;if(bounds)bounds.y=horizon/cell;}
  }
  const speeds={light:1,snow:1,water:1};
  try{const saved=JSON.parse(localStorage.getItem('zerk_hub_flow')||'{}').speeds;for(const key of Object.keys(speeds))if(Number.isFinite(saved?.[key]))speeds[key]=Math.max(0,Math.min(4,saved[key]));}catch(_){}
  const lightRules=[{pass:1,reflect:2},{pass:2,reflect:1}];let reflectionLoss=true;
  try{const saved=JSON.parse(localStorage.getItem('zerk_hub_flow')||'{}');reflectionLoss=saved.reflectionLoss!==false;for(let bit=0;bit<2;bit++)for(const key of ['pass','reflect']){const value=saved.lightRules?.[bit]?.[key];if(Number.isInteger(value)&&value>=0&&value<=3)lightRules[bit][key]=value;}}catch(_){}
  const saveStyle=()=>{try{localStorage.setItem('zerk_hub_flow',JSON.stringify({axis:axisFlow,bits:lightBits,size:lightSize,sun,radius:sunRadius,dense,waterCorners,speeds,lightRules,reflectionLoss}));}catch(_){}};
  let spriteKey='',sprites=[];
  function lightSprites(){
    const mirror=window.HubMirror;if(!mirror)return [];
    const st=mirror.state,key=JSON.stringify([lightSize,st.bitView,st.packedBits,st.zero,st.one,st.hideZeroDigit,st.hideOneDigit,mirror.colors().sym]);
    if(key!==spriteKey){spriteKey=key;sprites=['0','1'].map(bit=>{const c=document.createElement('canvas'),side=Math.ceil(lightSize*2+6);c.width=c.height=side*2;const g=c.getContext('2d');g.setTransform(2,0,0,2,side,side);mirror.drawCenterBit(g,{bit,width:lightSize,height:lightSize*Math.sqrt(3)});return c;});}
    return sprites;
  }
  const invalidate=()=>{dirty=true;if(light||snow||water)wake();};
  function reset(){rays=[];beams=null;beamDistance=0;emission=snowEmission=waterEmission=accumulator=snowAccumulator=0;if(field){field.water.fill(0);field.drained=0;liquid.water.fill(0);liquid.activeRows.clear();liquid.drained=0;}ctx?.clearRect(0,0,canvas.width,canvas.height);}
  function sunSource(){if(axisFlow&&guide)return {x:guide.x,y:guide.y,radius:Math.min(sunRadius,innerWidth)};const left=matchMedia('(max-width:1100px)').matches?0:(window.HUB_MENU_W||300);return {x:left+(innerWidth-left)*.25,y:Math.min(110,innerHeight*.2),radius:Math.min(sunRadius,innerWidth)};}
  function size(){
    const w=innerWidth,h=innerHeight,W=axisFlow?Math.ceil(Math.hypot(w,h)):w,H=axisFlow?W:h,scale=axisFlow?Math.max(1,Math.sqrt(W*H/(w*h))):1;
    if(radiusRange){radiusRange.max=String(w);sunRadius=Math.min(sunRadius,w);radiusRange.value=String(sunRadius);radiusOutput.textContent=sunRadius+'px';}
    cell=Math.max(1.5,Math.sqrt(W*H/320000));
    const cols=Math.ceil(W/cell),rows=Math.ceil(H/cell),lw=Math.ceil(W/scale),lh=Math.ceil(H/scale);
    if(field&&field.width===cols&&field.height===rows&&canvas.width===w&&canvas.height===h&&liquid.width===lw&&liquid.height===lh)return;
    frameW=W;frameH=H;ls=scale;if(!axisFlow){dirX=0;dirY=1;horizon=0;guide=null;}
    canvas.width=w;canvas.height=h;maskCanvas.width=liquidCanvas.width=lw;maskCanvas.height=liquidCanvas.height=lh;waterCanvas.width=cols;waterCanvas.height=rows;
    field=new HubFlowCore.Field(cols,rows);field.lightRules=lightRules;field.reflectionLoss=reflectionLoss;liquid=new HubFlowCore.WaterField(lw,lh);liquid.cornerPass=waterCorners;pixels=waterCtx.createImageData(cols,rows);liquidPixels=liquidCtx.createImageData(lw,lh);rays=[];dirty=true;
    beams=null;canvas.dataset.waterCell='1';
  }
  function rebuild(time){
    if(!dirty||time-lastMask<100)return;
    dirty=false;lastMask=time;
    const {width:w,height:h}=field,solid=new Uint8Array(w*h),types=new Uint8Array(w*h),liquidSolid=new Uint8Array(liquid.width*liquid.height);
    let count=0,zero=0,one=0;
    // Keep both types at an overlap: either reflecting layer must still stop the ray.
    for(const bit of ['0','1']){
      maskCtx.setTransform(1,0,0,1,0,0);maskCtx.clearRect(0,0,liquid.width,liquid.height);
      maskCtx.save();maskCtx.setTransform(...maskMatrix());maskCtx.translate(0,-(matchMedia('(max-width:1100px)').matches?scrollY:0));
      const ready=window.HubView?.drawFlowObstacles?.(maskCtx,bit);maskCtx.restore();
      const native=maskCtx.getImageData(0,0,liquid.width,liquid.height).data;
      for(let i=0;i<liquidSolid.length;i++)if(ready&&native[i*4+3]>=32)liquidSolid[i]=1;
      waterCtx.clearRect(0,0,w,h);waterCtx.drawImage(maskCanvas,0,0,w,h);
      const rgba=waterCtx.getImageData(0,0,w,h).data;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const i=y*w+x;if(ready&&rgba[i*4+3]>=32){if(!solid[i])count++;solid[i]=1;types[i]|=bit==='0'?1:2;if(bit==='0')zero++;else one++;}
      }
    }
    field.setMask(solid);field.lightTypes=types;liquid.setMask(liquidSolid);beams=null;bounds={minX:0,maxX:frameW/cell-1,y:horizon/cell};
    canvas.dataset.sourceLeft='0';canvas.dataset.sourceRight=String(canvas.width);
    canvas.dataset.zeroObstacles=String(zero);canvas.dataset.oneObstacles=String(one);
    status.textContent=!light&&!snow&&!water?'Потоки выключены':window.HubImage?.active?'Выберите биты вместо картинки':bounds||sun&&light?(axisFlow?'От оси · ':'')+(sun&&light?'Солнце · ':axisFlow?'':'Сверху вниз · ')+(light?'свет ':'')+(snow?'снег ':'')+(water?'вода':''):'Биты за пределами поля';
    canvas.dataset.obstacles=String(count);
  }
  function emit(dt){
    if(!bounds&&!(light&&sun))return;
    const span=bounds?bounds.maxX-bounds.minX+1:innerWidth/cell;
    const nextX=()=>bounds.minX+((++sample*.6180339887498949)%1)*span;
    if(light&&!dense){
      emission+=dt*speeds.light*(sun?100:Math.min(100,Math.max(24,span*cell/12)));
      while(emission>=1){
        emission--;let x,y=horizon/cell,vx=0,vy=1;
        if(sun){const origin=sunSource(),at=toField(origin.x,origin.y),angle=(++sample*.6180339887498949%1)*Math.PI*2;vx=Math.cos(angle);vy=Math.sin(angle);x=(at[0]+vx*origin.radius)/cell;y=(at[1]+vy*origin.radius)/cell;}
        else x=nextX();
        if(x>=0&&x<field.width&&y>=0&&y<field.height&&!field.lightBlocked(x,y,vy)&&rays.length<350)rays.push({x,y,vx,vy,bounces:0,age:0,bit:String(sample%2)});
      }
    }
    if(snow&&bounds){snowEmission+=dt*speeds.snow*Math.min(1800,Math.max(160,span*2));while(snowEmission>=1){snowEmission--;field.addWater(nextX(),bounds.y,1);}}
    if(water&&bounds&&!dense){waterEmission+=dt*speeds.water*Math.min(1800,Math.max(160,span*2));while(waterEmission>=1){waterEmission--;liquid.addWater(nextX()*cell/ls,horizon/ls,1);}}
  }
  function draw(dt){
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.setTransform(...fieldMatrix());
    const palette=window.HubMirror?.colors?.()||{bit:'#8fd3ff',sym:'#ff9a5a'};
    const data=pixels.data;let snowVolume=0,volume=0;
    for(let i=0;i<field.water.length;i++){const mass=field.water[i];snowVolume+=mass;data[i*4]=data[i*4+1]=data[i*4+2]=255;data[i*4+3]=mass>.01?Math.round(Math.min(1,Math.sqrt(mass))*230):0;}
    waterCtx.putImageData(pixels,0,0);ctx.imageSmoothingEnabled=true;ctx.drawImage(waterCanvas,0,0,field.width*cell,field.height*cell);
    const wetPixels=liquidPixels.data;wetPixels.fill(0);
    for(const y of liquid.activeRows)for(let x=0;x<liquid.width;x++){
      const i=y*liquid.width+x,m=liquid.water[i];volume+=m;if(m<=.002)continue;
      wetPixels[i*4]=55;wetPixels[i*4+1]=175;wetPixels[i*4+2]=255;wetPixels[i*4+3]=Math.round(100+m*100);
    }
    liquidCtx.putImageData(liquidPixels,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(liquidCanvas,0,0,liquid.width*ls,liquid.height*ls);
    // The top of each liquid cell is a height, not a pile-shaped opacity gradient.
    ctx.save();ctx.scale(ls,ls);ctx.strokeStyle='#37afff';ctx.lineWidth=.8/ls;ctx.beginPath();
    for(const y of liquid.activeRows)for(let x=0;x<liquid.width;x++){
      const i=y*liquid.width+x,m=liquid.water[i];
      if(m>.002&&(y===0||liquid.water[i-liquid.width]<.002)&& (y===liquid.height-1||liquid.solid[i+liquid.width]||liquid.water[i+liquid.width]>.999)){
        const top=y+1-m;ctx.moveTo(x,top);ctx.lineTo(x+1,top);
      }
    }ctx.stroke();ctx.restore();
    if(sun&&light){const origin=sunSource(),at=toField(origin.x,origin.y);ctx.save();ctx.strokeStyle=ctx.fillStyle=palette.sym;ctx.lineWidth=1;ctx.beginPath();ctx.arc(at[0],at[1],Math.max(1,origin.radius),0,Math.PI*2);ctx.globalAlpha=.8;ctx.stroke();   /* v0.246: без заливки */ctx.restore();}
    if(light&&dense){
      if(!beams)beams=field.topBeams(horizon/cell);beamDistance+=dt*speeds.light*420/cell;
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
    const pending=rays.map(ray=>({ray,distance:dt*speeds.light*420/cell}));
    for(let ri=0;ri<pending.length&&ri<350;ri++){
      const {ray,distance}=pending[ri],forks=[];
      ray.age+=dt*speeds.light;const path=dt*speeds.light>0?field.advanceRay(ray,distance,forks):[];
      for(const fork of forks)if(rays.length<350){fork.ray.age=ray.age-dt*speeds.light;pending.push({ray:fork.ray,distance:fork.remaining});rays.push(fork.ray);}
      ray.trail=ray.trail||[];for(const p of path)ray.trail.push([p[0],p[1],ray.age,p[2]]);
      ray.trail=ray.trail.filter(p=>ray.age-p[2]<.32);
      if(lightBits&&glyphs.length){
        const glyph=glyphs[Number(ray.bit)],side=glyph.width/2;
        ctx.globalAlpha=field.rayAlpha(ray);ctx.shadowBlur=0;ctx.drawImage(glyph,ray.x*cell-side/2,ray.y*cell-side/2,side,side);
      }else{
        // Keep the incident segment bright; only the reflected segment loses half its light.
        const trail=ray.trail;ctx.shadowBlur=5;ctx.beginPath();let alpha=null;
        for(let i=1;i<trail.length;i++){const p=trail[i-1],q=trail[i];if(alpha!==p[3]){if(alpha!==null)ctx.stroke();alpha=p[3];ctx.globalAlpha=alpha;ctx.beginPath();ctx.moveTo(p[0]*cell,p[1]*cell);}ctx.lineTo(q[0]*cell,q[1]*cell);}
        ctx.stroke();
      }
    }
    rays=rays.filter(r=>!r.dead&&r.age<8);ctx.globalAlpha=1;ctx.shadowBlur=0;
    for(const key of Object.keys(speeds))canvas.dataset[key+'Speed']=String(speeds[key]);
    canvas.dataset.lightRules=JSON.stringify(lightRules);canvas.dataset.reflectionLoss=String(reflectionLoss);
    canvas.dataset.snow=String(Math.round(snowVolume));canvas.dataset.water=String(Math.round(volume));canvas.dataset.rays=String(rays.length);canvas.dataset.waterCorners=String(waterCorners);canvas.dataset.dense=String(dense);canvas.dataset.lightStyle=dense?'continuous':lightBits?'bits':'rays';canvas.dataset.beams=String(beams?.length||0);canvas.dataset.lightSize=String(lightSize);canvas.dataset.sourceY=String(Math.round(horizon));canvas.dataset.axisFlow=String(axisFlow);canvas.dataset.lightSource=sun?'sun':'top';canvas.dataset.sunRadius=String(sunRadius);
  }
  function frame(time){
    raf=0;if(document.hidden||paused){lastTime=0;return;}
    size();followAxis(time);rebuild(time);const dt=lastTime?Math.min(.05,(time-lastTime)/1000):1/60;lastTime=time;
    emit(dt);accumulator=Math.min(accumulator+dt*speeds.water,.16);
    // Bound catch-up work so a dense one-pixel field cannot starve input and recording.
    const step=1/150,deadline=performance.now()+8;let steps=0;while(accumulator>=step&&steps++<24){if(water||Number(canvas.dataset.water)>0)liquid.stepWater();if(water&&dense)liquid.fillTop(horizon/ls);accumulator-=step;if(performance.now()>=deadline)break;}
    snowAccumulator=Math.min(snowAccumulator+dt*speeds.snow,.16);steps=0;while(snowAccumulator>=cell/150&&steps++<24){if(snow||Number(canvas.dataset.snow)>0)field.stepWater();snowAccumulator-=cell/150;}
    draw(dt);
    if(light||snow||water||rays.length||Number(canvas.dataset.snow)>0||Number(canvas.dataset.water)>0)raf=requestAnimationFrame(frame);else lastTime=0;
  }
  function wake(){if(!raf&&!document.hidden&&!paused)raf=requestAnimationFrame(frame);}
  function sync(){lightButton.setAttribute('aria-pressed',String(light));snowButton.setAttribute('aria-pressed',String(snow));waterButton.setAttribute('aria-pressed',String(water));dirty=true;lastMask=-Infinity;wake();window.dispatchEvent?.(new Event('hubflowstate'));}
  function init(){
    const tools=document.getElementById('hubFieldTools');if(!tools)return;
    const wrap=document.createElement('div');wrap.className='hubFlowControls';
    const button=(text,label,fn)=>{const b=document.createElement('button');b.type='button';b.className='hubRhomb';b.textContent=text;b.title=label;b.setAttribute('aria-label',label);b.onclick=fn;wrap.append(b);return b;};
    lightButton=button('А\nСвет','А — свет: включить / выключить',()=>{light=!light;beamDistance=0;sync();});
    snowButton=button('Б\nСнег','Б — мокрый снег сверху: включить / выключить',()=>{snow=!snow;sync();});
    waterButton=button('В\nВода','В — вода: горизонтальный уровень и сток',()=>{water=!water;sync();});
    for(const [key,name,short] of [['light','света','А'],['snow','снега','Б'],['water','воды','В']]){
      const control=document.createElement('details');control.className='hubTilt';
      const head=document.createElement('summary');head.setAttribute('aria-label','Скорость '+name);head.title='Скорость '+name+' · 0 — пауза';
      const label=document.createElement('label');label.append('Скорость '+name);
      const range=document.createElement('input');range.type='range';range.min='0';range.max='4';range.step='.1';range.value=String(speeds[key]);range.setAttribute('aria-label','Множитель скорости '+name);
      const output=document.createElement('output');
      const update=()=>{const text='×'+Number(speeds[key].toFixed(1));output.textContent=text;head.textContent=short+'\n'+text;range.setAttribute('aria-valuetext',speeds[key]===0?'Пауза':text);};
      range.oninput=()=>{speeds[key]=Number(range.value);if(key==='water')accumulator=0;if(key==='snow')snowAccumulator=0;update();saveStyle();wake();};
      update();label.append(range,output);control.append(head,label);wrap.append(control);
    }
    const opticalChange=()=>{rays=[];beams=null;beamDistance=0;if(field){field.lightRules=lightRules;field.reflectionLoss=reflectionLoss;}saveStyle();wake();};
    const sides=['Нет','Сверху','Снизу','Обе'],marks=['×','↓','↑','↕'];
    for(let bit=0;bit<2;bit++)for(const [key,name,short] of [['pass','пропускание','Пропуск'],['reflect','отражение','Отраж.']]){
      const b=button('','Свет '+bit+': '+name,()=>{lightRules[bit][key]=(lightRules[bit][key]+1)%4;update();opticalChange();});b.id='hubLightRule-'+bit+'-'+key;
      const update=()=>{const v=lightRules[bit][key];b.textContent=marks[v]+'\n'+short;b.title='Бит '+bit+' · '+name+': '+sides[v]+' · Клик: нет → сверху → снизу → обе стороны. Стороны относительно экрана; оба действия — разделение 50/50.';b.setAttribute('aria-pressed',String(v!==0));b.setAttribute('aria-description',sides[v]);};update();
    }
    const loss=button('−50%\nОтраж.','Ослаблять отражённый свет на 50%',()=>{reflectionLoss=!reflectionLoss;loss.setAttribute('aria-pressed',String(reflectionLoss));opticalChange();});loss.id='hubLightLoss';loss.setAttribute('aria-pressed',String(reflectionLoss));
    cornersButton=button('↘\nУглы','Вода: стороны и углы — проход через шахматные стыки',()=>{waterCorners=!waterCorners;if(liquid)liquid.cornerPass=waterCorners;cornersButton.setAttribute('aria-pressed',String(waterCorners));saveStyle();wake();});cornersButton.setAttribute('aria-pressed',String(waterCorners));
    button('↺\nСброс','Очистить свет, снег и воду, остановить потоки',()=>{light=snow=water=false;reset();sync();});
    denseButton=button('▤\nПлотно','Сплошной поток света и воды сверху',()=>{dense=!dense;if(dense)sun=false;sunButton.setAttribute('aria-pressed',String(sun));denseButton.setAttribute('aria-pressed',String(dense));rays=[];beams=null;beamDistance=0;saveStyle();sync();});
    denseButton.setAttribute('aria-pressed',String(dense));
    axisButton=button('↗\nОт оси','Потоки от оси: свет, снег и вода идут от круглой ручки к началу оси, горизонт — поперёк оси через ручку, солнце — на ручке; тяни ось — всё меняется вживую',()=>{axisFlow=!axisFlow;axisButton.setAttribute('aria-pressed',String(axisFlow));saveStyle();sync();});
    axisButton.id='hubFlowAxis';axisButton.setAttribute('aria-pressed',String(axisFlow));
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
  window.HubFlow={invalidate,
    get playing(){return !paused&&(light||snow||water);},
    togglePause(){paused=!paused;lastTime=0;if(!paused)wake();window.dispatchEvent?.(new Event('hubflowstate'));},
    snapshot(){return {axis:axisFlow,dirX,dirY,light,snow,water,paused,rays:JSON.parse(JSON.stringify(rays)),emission,snowEmission,waterEmission,sample,beamDistance,accumulator,snowAccumulator,snowGrid:window.HubPresetCore.pack(field),waterGrid:window.HubPresetCore.pack(liquid)};},
    restore(s){
      if(typeof s.axis==='boolean'){axisFlow=s.axis;axisButton?.setAttribute('aria-pressed',String(axisFlow));if(axisFlow&&Number.isFinite(s.dirX)&&Number.isFinite(s.dirY)){dirX=s.dirX;dirY=s.dirY;}}
      size();reset();light=!!s.light;snow=!!s.snow;water=!!s.water;paused=!!s.paused;
      dirty=true;lastMask=-Infinity;rebuild(performance.now());
      window.HubPresetCore.restoreGrid(field,s.snowGrid);window.HubPresetCore.restoreGrid(liquid,s.waterGrid);
      rays=s.rays||[];emission=s.emission||0;snowEmission=s.snowEmission||0;waterEmission=s.waterEmission||0;sample=s.sample||0;beamDistance=s.beamDistance||0;accumulator=s.accumulator||0;snowAccumulator=s.snowAccumulator||0;
      sync();draw(0);lastTime=0;wake();
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
