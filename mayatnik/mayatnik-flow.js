/* МАЯ-686 · Flow adapter for Mayatnik. Physics/rendering derived from the project's hub-flow.js; HubFlowCore is reused unchanged. Screen particles never change source bits. */
(function(root){
  function mount(host){
  'use strict';
  let canvas,ctx,waterCanvas,waterCtx,liquidCanvas,liquidCtx,field,lightField,liquid,pixels,liquidPixels,cell=2,lightCell=1;
  let dirty=true,lastMask=-Infinity,lastTime=0,accumulator=0,snowAccumulator=0,raf=0,retry=0,paused=false,light=false,snow=false,water=false;
  let bounds=null,rays=[],emission=0,snowEmission=0,waterEmission=0,sample=0,statusMessage='',unavailable='',scene=null;
  let lightBits=false,lightSize=16,sun=false,sunRadius=40,sunCentre=null,rayColour=null;
  try{const colour=JSON.parse(localStorage.getItem('mayatnik-flow-v1')||'{}').rayColour;if(/^#[\da-f]{6}$/i.test(colour))rayColour=colour;}catch(_){}
  const materialColours={snow:'#ffffff',water:'#37afff'};
  try{const saved=JSON.parse(localStorage.getItem('mayatnik-flow-v1')||'{}').materialColours;for(const key of Object.keys(materialColours))if(/^#[\da-f]{6}$/i.test(saved?.[key]))materialColours[key]=saved[key];}catch(_){}
  const colourRGB=colour=>[1,3,5].map(start=>parseInt(colour.slice(start,start+2),16));
  let sunHandles,sunRing,sunMove,sunResize,sunDrag=null;
  try{const saved=JSON.parse(localStorage.getItem('mayatnik-flow-v1')||'{}');lightBits=saved.bits===true;sun=saved.sun===true;if(Number.isFinite(saved.radius))sunRadius=Math.max(0,Math.min(innerWidth,saved.radius));if(Number.isFinite(saved.size))lightSize=Math.max(4,Math.min(64,saved.size));}catch(_){}
  try{const p=JSON.parse(localStorage.getItem('mayatnik-flow-v1')||'{}').sunCentre;if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))sunCentre={x:Math.max(0,Math.min(1,p.x)),y:Math.max(0,Math.min(1,p.y))};}catch(_){}
  let dense=false,beams=null,beamDistance=0,waterCorners=true,waterCornersUp=false;
  try{dense=JSON.parse(localStorage.getItem('mayatnik-flow-v1')||'{}').dense===true;if(dense)sun=false;}catch(_){}
  try{const saved=JSON.parse(localStorage.getItem('mayatnik-flow-v1')||'{}');waterCorners=saved.waterCorners!==false;waterCornersUp=saved.waterCornersUp===true;}catch(_){}
  // v0.235: the simulation runs in a field frame; «От оси» turns it so that field-down follows the axis.
  let gridFlow=false,gridSources=[],gridKey=null,gridStep=0;
  let axisFlow=false,guide=null,frameW=0,frameH=0,ls=1,dirX=0,dirY=1,horizon=0,lastTurn=-Infinity;
  try{axisFlow=JSON.parse(localStorage.getItem('mayatnik-flow-v1')||'{}').axis===true;}catch(_){}   // v0.408: снова переключается, как до v0.406
  try{gridFlow=JSON.parse(localStorage.getItem('mayatnik-flow-v1')||'{}').grid===true;if(gridFlow){axisFlow=false;sun=false;}}catch(_){}
  const toField=(sx,sy)=>{const u=sx-innerWidth/2,v=sy-innerHeight/2;return [frameW/2+dirY*u-dirX*v,frameH/2+dirX*u+dirY*v];};
  const fieldMatrix=()=>{const cx=innerWidth/2,cy=innerHeight/2;return [dirY,-dirX,dirX,dirY,cx-dirY*frameW/2-dirX*frameH/2,cy+dirX*frameW/2-dirY*frameH/2];};
  // Offset (x, y) from the frame centre in the frame with down (ax, ay) -> the same screen point in the frame with down (bx, by).
  const turnPoint=(ax,ay,bx,by,x,y)=>{const sx=ay*x+ax*y,sy=-ax*x+ay*y;return [by*sx-bx*sy,bx*sx+by*sy];};
  const axisGuide=()=>host.axis();
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
        const p=turnPoint(dirX,dirY,nx,ny,ray.x*lightCell-hw,ray.y*lightCell-hh),v=turnPoint(dirX,dirY,nx,ny,ray.vx,ray.vy);ray.x=(p[0]+hw)/lightCell;ray.y=(p[1]+hh)/lightCell;ray.vx=v[0];ray.vy=v[1];
        for(const t of ray.trail||[]){const q=turnPoint(dirX,dirY,nx,ny,t[0]*lightCell-hw,t[1]*lightCell-hh);t[0]=(q[0]+hw)/lightCell;t[1]=(q[1]+hh)/lightCell;}
      }
      dirX=nx;dirY=ny;dirty=true;beams=null;
    }
    const row=Math.max(0,Math.min(frameH-1,toField(guide.x,guide.y)[1]));
    if(Math.abs(row-horizon)>.5){horizon=row;beams=null;if(bounds)bounds.y=horizon/cell;}
  }
  const speeds={light:1,snow:1,water:1};
  try{const saved=JSON.parse(localStorage.getItem('mayatnik-flow-v1')||'{}').speeds;for(const key of Object.keys(speeds))if(Number.isFinite(saved?.[key]))speeds[key]=Math.max(0,Math.min(4,saved[key]));}catch(_){}
  const lightRules=[{pass:1,reflect:2},{pass:2,reflect:1}];let reflectionLoss=true;
  try{const saved=JSON.parse(localStorage.getItem('mayatnik-flow-v1')||'{}');reflectionLoss=saved.reflectionLoss!==false;for(let bit=0;bit<2;bit++)for(const key of ['pass','reflect']){const value=saved.lightRules?.[bit]?.[key];if(Number.isInteger(value)&&value>=0&&value<=3)lightRules[bit][key]=value;}}catch(_){}
  const saveStyle=()=>{try{localStorage.setItem('mayatnik-flow-v1',JSON.stringify({light,snow,water,paused,grid:gridFlow,axis:axisFlow,bits:lightBits,size:lightSize,sun,radius:sunRadius,sunCentre,rayColour,materialColours,dense,waterCorners,waterCornersUp,speeds,lightRules,reflectionLoss}));}catch(_){}};
  function lightSprites(){
    return ['0','1'].map(bit=>{const c=document.createElement('canvas'),side=lightSize*2+6;c.width=c.height=side*2;
      const g=c.getContext('2d');g.setTransform(2,0,0,2,side,side);host.glyph(g,bit,lightSize);
      if(rayColour){g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-in';g.fillStyle=rayColour;g.fillRect(0,0,c.width,c.height);}return c;});
  }
  let spritesCache=null,spriteKey='';
  const invalidate=()=>{dirty=true;syncSun();if(canvas&&(light||snow||water||traces()))wake();};
  let tracesAt=-1e9,tracesHas=false;
  function reset(){if(!axisFlow){dirX=0;dirY=1;horizon=0;guide=null;}tracesAt=-1e9;rays=[];beams=null;beamDistance=0;emission=snowEmission=waterEmission=accumulator=snowAccumulator=0;lastTime=0;if(field){field.water.fill(0);field.drained=0;liquid.water.fill(0);liquid.activeRows.clear();liquid.drained=0;}ctx?.clearRect(0,0,canvas.width,canvas.height);}
  function sunSource(){
    const r=host.viewport();
    if(sunCentre)return {x:r.left+sunCentre.x*r.width,y:r.top+sunCentre.y*r.height,radius:sunRadius};
    if(axisFlow){const axis=axisGuide();if(axis)return {x:axis.x,y:axis.y,radius:sunRadius};}
    return {x:r.left+r.width*.25,y:r.top+Math.min(110,r.height*.2),radius:sunRadius};
  }
  function changeSun(centre,radius=sunRadius){
    sunCentre=centre;sunRadius=Math.max(0,Math.min(innerWidth,Math.round(radius)));
    rays=[];beams=null;beamDistance=0;saveStyle();syncSun();
    if(paused&&field&&scene&&!unavailable)draw(0);else wake();
    root.dispatchEvent(new Event('may-flow-state'));
  }
  function sunPoint(x,y,r=host.viewport()){
    const mx=Math.min(10,r.width/2),my=Math.min(10,r.height/2);
    return {x:Math.max(mx,Math.min(r.width-mx,x-r.left))/Math.max(1,r.width),y:Math.max(my,Math.min(r.height-my,y-r.top))/Math.max(1,r.height)};
  }
  function endSunDrag(cancel=false){
    const drag=sunDrag;if(!drag)return;sunDrag=null;
    if(drag.node.hasPointerCapture(drag.id))drag.node.releasePointerCapture(drag.id);
    if(cancel)changeSun(drag.centre,drag.radius);else saveStyle();
  }
  function syncSun(){
    if(!sunHandles)return;
    const visible=light&&sun&&!unavailable,r=host.viewport();
    if(sunDrag&&(!visible||sunDrag.viewport!==[r.left,r.top,r.width,r.height].join('|')))endSunDrag(true);
    sunHandles.hidden=!visible;if(!visible)return;
    const p=sunSource(),x=p.x-r.left,y=p.y-r.top;
    Object.assign(sunHandles.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
    sunHandles.style.setProperty('--sun-colour',host.palette().sym);
    Object.assign(sunRing.style,{left:(x-sunRadius)+'px',top:(y-sunRadius)+'px',width:(2*sunRadius)+'px',height:(2*sunRadius)+'px'});
    Object.assign(sunMove.style,{left:x+'px',top:y+'px'});
    // Keep the radius grip reachable even when the actual circle extends beyond the viewport.
    const directions=[[1,0,r.width-x-11],[-1,0,x-11],[0,1,r.height-y-11],[0,-1,y-11]].sort((a,b)=>b[2]-a[2]);
    const [dx,dy,room]=directions[0],distance=Math.min(Math.max(24,sunRadius),Math.max(0,room));
    Object.assign(sunResize.style,{left:(x+dx*distance)+'px',top:(y+dy*distance)+'px'});
    sunResize.setAttribute('aria-valuenow',String(Math.round(sunRadius)));sunResize.setAttribute('aria-valuemax',String(innerWidth));
    sunResize.title='Радиус Солнца: '+Math.round(sunRadius)+' px. Тяните от центра или к центру. Стрелки — 1 px, Shift — 10 px, Home — 40 px.'+(distance!==sunRadius?' Ручка сдвинута в видимую область.':'');
  }
  function mountSunHandles(){
    sunHandles=document.createElement('div');sunHandles.id='mayFlowSunHandles';sunHandles.dataset.noMini='';sunHandles.hidden=true;
    sunRing=document.createElement('div');sunRing.className='may-flow-sun-ring';sunRing.setAttribute('aria-hidden','true');
    const make=(kind,label,glyph)=>{const b=document.createElement('button');b.type='button';b.className='may-flow-sun-handle '+kind;b.setAttribute('aria-label',label);const mark=document.createElement('span');mark.textContent=glyph;mark.setAttribute('aria-hidden','true');b.append(mark);return b;};
    sunMove=make('may-flow-sun-move','Переместить центр Солнца','+');sunResize=make('may-flow-sun-radius','Радиус Солнца','↔');
    sunMove.title='Центр Солнца: перетаскивание или стрелки. Shift — 10 px. Home или двойной щелчок — исходное положение (при От оси — на ручке оси).';
    sunResize.setAttribute('role','slider');sunResize.setAttribute('aria-valuemin','0');
    sunHandles.append(sunRing,sunMove,sunResize);document.body.append(sunHandles);
    for(const node of [sunMove,sunResize]){
      node.addEventListener('pointerdown',event=>{
        if(event.button!==0||!light||!sun||unavailable||sunDrag)return;
        event.preventDefault();event.stopPropagation();node.focus({preventScroll:true});
        const source=sunSource(),r=host.viewport();
        sunDrag={id:event.pointerId,node,source,x:event.clientX,y:event.clientY,centre:sunCentre?{...sunCentre}:null,radius:sunRadius,viewport:[r.left,r.top,r.width,r.height].join('|')};
        node.setPointerCapture(event.pointerId);
      });
      node.addEventListener('pointermove',event=>{
        const drag=sunDrag;if(!drag||drag.node!==node||drag.id!==event.pointerId)return;
        event.preventDefault();event.stopPropagation();
        if(node===sunMove)changeSun(sunPoint(drag.source.x+event.clientX-drag.x,drag.source.y+event.clientY-drag.y));
        else changeSun(sunCentre,drag.radius+Math.hypot(event.clientX-drag.source.x,event.clientY-drag.source.y)-Math.hypot(drag.x-drag.source.x,drag.y-drag.source.y));
      });
      node.addEventListener('pointerup',event=>{if(sunDrag?.id===event.pointerId){event.preventDefault();event.stopPropagation();endSunDrag();}});
      node.addEventListener('pointercancel',event=>{if(sunDrag?.id===event.pointerId)endSunDrag(true);});
      node.addEventListener('lostpointercapture',event=>{if(sunDrag?.id===event.pointerId)endSunDrag(true);});
      for(const type of ['click','contextmenu'])node.addEventListener(type,event=>{event.preventDefault();event.stopPropagation();});
      node.addEventListener('dblclick',event=>{event.preventDefault();event.stopPropagation();changeSun(node===sunMove?null:sunCentre,node===sunResize?40:sunRadius);});
      node.addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','Escape','Enter',' '].includes(event.key))return;
        event.preventDefault();event.stopPropagation();
        if(event.key==='Escape'){endSunDrag(true);return;}
        if(event.key==='Home'){changeSun(node===sunMove?null:sunCentre,node===sunResize?40:sunRadius);return;}
        const d=event.shiftKey?10:1,p=sunSource();
        if(node===sunResize&&event.key.startsWith('Arrow'))changeSun(sunCentre,sunRadius+(['ArrowLeft','ArrowDown'].includes(event.key)?-d:d));
        else if(node===sunMove&&event.key.startsWith('Arrow'))changeSun(sunPoint(p.x+(event.key==='ArrowLeft'?-d:event.key==='ArrowRight'?d:0),p.y+(event.key==='ArrowUp'?-d:event.key==='ArrowDown'?d:0)));
      });
    }
    root.addEventListener('blur',()=>endSunDrag(true));
  }
  function size(){
    const w=innerWidth,h=innerHeight,W=axisFlow?Math.ceil(Math.hypot(w,h)):w,H=axisFlow?W:h,scale=axisFlow?Math.max(1,Math.sqrt(W*H/(w*h))):1;
    sunRadius=Math.min(sunRadius,w);
    cell=Math.max(1.5,Math.sqrt(W*H/320000));
    const cols=Math.ceil(W/cell),rows=Math.ceil(H/cell),lw=Math.ceil(W/scale),lh=Math.ceil(H/scale);
    if(field&&field.width===cols&&field.height===rows&&canvas.width===w&&canvas.height===h&&liquid.width===lw&&liquid.height===lh)return;
    frameW=W;frameH=H;ls=scale;lightCell=scale;if(!axisFlow){dirX=0;dirY=1;horizon=0;guide=null;}
    canvas.width=w;canvas.height=h;liquidCanvas.width=lw;liquidCanvas.height=lh;waterCanvas.width=cols;waterCanvas.height=rows;
    field=new HubFlowCore.Field(cols,rows);
    lightField=new HubFlowCore.Field(lw,lh);lightField.lightRules=lightRules;lightField.reflectionLoss=reflectionLoss;
    liquid=new HubFlowCore.WaterField(lw,lh);liquid.cornerPass=waterCorners;liquid.cornerUp=waterCornersUp;pixels=waterCtx.createImageData(cols,rows);liquidPixels=liquidCtx.createImageData(lw,lh);rays=[];dirty=true;
    beams=null;beamDistance=0;canvas.dataset.waterCell=String(ls);canvas.dataset.lightCell=String(lightCell);
  }
  function updateStatus(){
    const previous=statusMessage;
    statusMessage=unavailable?'Потоки приостановлены: '+unavailable:paused?'Потоки на паузе':!light&&!snow&&!water?'Потоки выключены':(gridFlow?'По сетке · '+gridSources.length+' столбцов · ':axisFlow?'От оси · ':'Сверху вниз · ')+(sun&&light?'Солнце · ':'')+(light?'свет ':'')+(snow?'снег ':'')+(water?'вода':'')+(gridFlow&&gridSources.length&&gridStep<Math.max(light?lightCell:0,snow?cell:0,water?ls:0)?' · Мелкий масштаб: соседние потоки могут сливаться':'');
    syncSun();canvas.dataset.status=statusMessage;canvas.dataset.unavailable=unavailable;
    if(previous!==statusMessage)root.dispatchEvent(new Event('may-flow-state'));
  }
  function rebuild(time){
    if(!dirty||time-lastMask<100)return;
    dirty=false;lastMask=time;scene=host.capture();const previous=unavailable;unavailable=scene.reason||'';
    if(gridFlow&&!unavailable){
      const grid=scene.grid();unavailable=grid.reason||'';
      if(!unavailable){
        if(gridKey!==grid.key){reset();emission=1;gridKey=grid.key;}
        gridSources=grid.xs;gridStep=grid.step;horizon=Math.max(0,scene.clip.top-cell-1);
      }
    }
    if(unavailable){ctx.clearRect(0,0,canvas.width,canvas.height);lastTime=0;if(previous!==unavailable)updateStatus();return;}
    const {width:w,height:h}=field,solid=new Uint8Array(w*h),liquidSolid=new Uint8Array(liquid.width*liquid.height),native=new Uint8Array(liquidSolid.length);
    const [a,b,c,d,e,f]=fieldMatrix(),clip=scene.clip;
    for(let y=0;y<liquid.height;y++)for(let x=0;x<liquid.width;x++){
      const fx=(x+.5)*ls,fy=(y+.5)*ls,sx=a*fx+c*fy+e,sy=b*fx+d*fy+f;
      if(sx<clip.left||sx>=clip.right||sy<clip.top||sy>=clip.bottom)continue;
      const i=y*liquid.width+x,type=scene.typeAt(sx,sy);native[i]=type;liquidSolid[i]=type?1:0;
    }
    let count=0,zero=0,one=0;
    // Snow keeps its conservative coarse mask. Light must not merge adjacent zero/one pixels.
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      let type=0;const x0=Math.floor(x*cell/ls),x1=Math.min(liquid.width,Math.ceil((x+1)*cell/ls)),y0=Math.floor(y*cell/ls),y1=Math.min(liquid.height,Math.ceil((y+1)*cell/ls));
      for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++)type|=native[yy*liquid.width+xx];
      const i=y*w+x;if(type){solid[i]=1;count++;}if(type&1)zero++;if(type&2)one++;
    }
    field.setMask(solid);liquid.setMask(liquidSolid);
    lightField.solid=liquidSolid;lightField.lightTypes=native;beams=null;
    bounds={minX:0,maxX:frameW/cell-1,y:horizon/cell};
    canvas.dataset.obstacles=String(count);canvas.dataset.zeroObstacles=String(zero);canvas.dataset.oneObstacles=String(one);
    updateStatus();
  }
  function emit(dt){
    if(!bounds&&!(light&&sun))return;
    if(gridFlow){
      // Emit complete rows: a cap on the old random emitter must not starve right-hand columns.
      if(light&&!dense&&speeds.light>0){
        emission+=dt*speeds.light;
        while(emission>=1){
          emission--;
          for(const sx of gridSources){
            const x=sx/lightCell,y=horizon/lightCell;
            if(!lightField.lightBlocked(x,y,1))rays.push({x,y,vx:0,vy:1,bounces:0,age:0,bit:String((++sample)%2)});
          }
        }
      }
      if(snow){
        snowEmission+=dt*speeds.snow*12;
        while(snowEmission>=1){snowEmission--;for(const sx of gridSources)field.addWater(sx/cell,horizon/cell,1);}
      }
      if(water&&!dense){
        waterEmission+=dt*speeds.water*12;
        while(waterEmission>=1){waterEmission--;for(const sx of gridSources)liquid.addWater(sx/ls,horizon/ls,1);}
      }
      return;
    }
    const span=bounds?bounds.maxX-bounds.minX+1:innerWidth/cell;
    const nextX=()=>bounds.minX+((++sample*.6180339887498949)%1)*span;
    if(light&&!dense){
      emission+=dt*speeds.light*(sun?100:Math.min(100,Math.max(24,span*cell/12)));
      while(emission>=1){
        emission--;let x,y=horizon/lightCell,vx=0,vy=1;
        if(sun){const origin=sunSource(),at=toField(origin.x,origin.y),angle=(++sample*.6180339887498949%1)*Math.PI*2;vx=Math.cos(angle);vy=Math.sin(angle);x=(at[0]+vx*origin.radius)/lightCell;y=(at[1]+vy*origin.radius)/lightCell;}
        else x=nextX()*cell/lightCell;
        if(x>=0&&x<lightField.width&&y>=0&&y<lightField.height&&!lightField.lightBlocked(x,y,vy)&&rays.length<350)rays.push({x,y,vx,vy,bounces:0,age:0,bit:String(sample%2)});
      }
    }
    if(snow&&bounds){snowEmission+=dt*speeds.snow*Math.min(1800,Math.max(160,span*2));while(snowEmission>=1){snowEmission--;field.addWater(nextX(),bounds.y,1);}}
    if(water&&bounds&&!dense){waterEmission+=dt*speeds.water*Math.min(1800,Math.max(160,span*2));while(waterEmission>=1){waterEmission--;liquid.addWater(nextX()*cell/ls,horizon/ls,1);}}
  }
  function draw(dt){
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.setTransform(...fieldMatrix());
    const palette=host.palette();
    const clip=scene?.clip||host.viewport();ctx.setTransform(1,0,0,1,0,0);ctx.save();ctx.beginPath();ctx.rect(clip.left,clip.top,clip.width,clip.height);ctx.clip();ctx.setTransform(...fieldMatrix());
    const data=pixels.data,snowRGB=colourRGB(materialColours.snow),waterRGB=colourRGB(materialColours.water);let snowVolume=0,volume=0;
    for(let i=0;i<field.water.length;i++){const mass=field.water[i];snowVolume+=mass;data[i*4]=snowRGB[0];data[i*4+1]=snowRGB[1];data[i*4+2]=snowRGB[2];data[i*4+3]=mass>.01?Math.round(Math.min(1,Math.sqrt(mass))*230):0;}
    waterCtx.putImageData(pixels,0,0);ctx.imageSmoothingEnabled=true;ctx.drawImage(waterCanvas,0,0,field.width*cell,field.height*cell);
    const wetPixels=liquidPixels.data;wetPixels.fill(0);
    for(const y of liquid.activeRows)for(let x=0;x<liquid.width;x++){
      const i=y*liquid.width+x,m=liquid.water[i];volume+=m;if(m<=.002)continue;
      wetPixels[i*4]=waterRGB[0];wetPixels[i*4+1]=waterRGB[1];wetPixels[i*4+2]=waterRGB[2];wetPixels[i*4+3]=Math.round(100+m*100);
    }
    liquidCtx.putImageData(liquidPixels,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(liquidCanvas,0,0,liquid.width*ls,liquid.height*ls);
    // The top of each liquid cell is a height, not a pile-shaped opacity gradient.
    ctx.save();ctx.scale(ls,ls);ctx.strokeStyle=materialColours.water;ctx.lineWidth=.8/ls;ctx.beginPath();
    for(const y of liquid.activeRows)for(let x=0;x<liquid.width;x++){
      const i=y*liquid.width+x,m=liquid.water[i];
      if(m>.002&&(y===0||liquid.water[i-liquid.width]<.002)&& (y===liquid.height-1||liquid.solid[i+liquid.width]||liquid.water[i+liquid.width]>.999)){
        const top=y+1-m;ctx.moveTo(x,top);ctx.lineTo(x+1,top);
      }
    }ctx.stroke();ctx.restore();
    syncSun();
    if(light&&dense){
      if(!beams)beams=lightField.topBeams(horizon/lightCell,gridFlow?gridSources.map(x=>x/lightCell):null);beamDistance+=dt*speeds.light*420/lightCell;
      ctx.save();ctx.strokeStyle=rayColour||palette.sym;ctx.lineWidth=gridFlow?Math.max(.6,Math.min(1.25,gridStep*.5)):lightCell;ctx.lineCap='butt';
      // Neighbouring dense strips meet at pixel edges without an extra overlapping pixel.
      // Grid sources remain individual lines; reflected segments retain their computed intensity.
      for(const segment of beams){
        const fraction=Math.min(1,(beamDistance-segment.start)/segment.length);if(fraction<=0)continue;
        const {a,b}=segment;ctx.globalAlpha=segment.alpha;ctx.beginPath();ctx.moveTo(a[0]*lightCell,a[1]*lightCell);
        ctx.lineTo((a[0]+(b[0]-a[0])*fraction)*lightCell,(a[1]+(b[1]-a[1])*fraction)*lightCell);ctx.stroke();
      }
      ctx.restore();
    }
    ctx.strokeStyle=rayColour||palette.sym;ctx.lineWidth=1.25;ctx.lineCap='round';ctx.shadowColor=rayColour||palette.sym;ctx.shadowBlur=5;
    const key=host.glyphKey()+'|'+lightSize+'|'+rayColour;if(lightBits&&spriteKey!==key){spriteKey=key;spritesCache=lightSprites();}const glyphs=lightBits?spritesCache||[]:[];
    const pending=rays.map(ray=>({ray,distance:dt*speeds.light*420/lightCell}));
    const rayLimit=gridFlow?Math.max(350,gridSources.length*12):350;
    for(let ri=0;ri<pending.length&&(gridFlow||ri<350);ri++){
      const {ray,distance}=pending[ri],forks=[];
      ray.age+=dt*speeds.light;const path=dt*speeds.light>0?lightField.advanceRay(ray,distance,forks):[];
      for(const fork of forks)if(rays.length<rayLimit){fork.ray.age=ray.age-dt*speeds.light;pending.push({ray:fork.ray,distance:fork.remaining});rays.push(fork.ray);}
      ray.trail=ray.trail||[];for(const p of path)ray.trail.push([p[0],p[1],ray.age,p[2]]);
      ray.trail=ray.trail.filter(p=>ray.age-p[2]<.32);
      if(lightBits&&glyphs.length){
        const glyph=glyphs[Number(ray.bit)],side=glyph.width/2;
        ctx.globalAlpha=lightField.rayAlpha(ray);ctx.shadowBlur=0;ctx.drawImage(glyph,ray.x*lightCell-side/2,ray.y*lightCell-side/2,side,side);
      }else{
        // Keep the incident segment bright; only the reflected segment loses half its light.
        const trail=ray.trail;ctx.shadowBlur=5;ctx.beginPath();let alpha=null;
        for(let i=1;i<trail.length;i++){const p=trail[i-1],q=trail[i];if(alpha!==p[3]){if(alpha!==null)ctx.stroke();alpha=p[3];ctx.globalAlpha=alpha;ctx.beginPath();ctx.moveTo(p[0]*lightCell,p[1]*lightCell);}ctx.lineTo(q[0]*lightCell,q[1]*lightCell);}
        ctx.stroke();
      }
    }
    rays=rays.filter(r=>!r.dead&&r.age<8);ctx.globalAlpha=1;ctx.shadowBlur=0;
    ctx.restore();
    for(const key of Object.keys(speeds))canvas.dataset[key+'Speed']=String(speeds[key]);
    canvas.dataset.gridFlow=String(gridFlow);canvas.dataset.gridSources=String(gridSources.length);canvas.dataset.gridStep=String(gridStep);
    canvas.dataset.lightRules=JSON.stringify(lightRules);canvas.dataset.reflectionLoss=String(reflectionLoss);
    canvas.dataset.snow=String(Math.round(snowVolume));canvas.dataset.water=String(Math.round(volume));canvas.dataset.rays=String(rays.length);canvas.dataset.waterCorners=String(waterCorners);canvas.dataset.waterCornersUp=String(waterCornersUp);canvas.dataset.dense=String(dense);canvas.dataset.lightStyle=dense?'continuous':lightBits?'bits':'rays';canvas.dataset.beams=String(beams?.length||0);canvas.dataset.lightSize=String(lightSize);canvas.dataset.sourceY=String(Math.round(horizon));canvas.dataset.axisFlow=String(axisFlow);canvas.dataset.lightSource=sun?'sun':'top';canvas.dataset.sunRadius=String(sunRadius);
  }
  function frame(time){
    raf=0;if(document.hidden||paused){lastTime=0;return;}
    size();followAxis(time);rebuild(time);if(unavailable){lastTime=0;if(dirty&&!retry)retry=setTimeout(()=>{retry=0;wake();},Math.max(1,101-(time-lastMask)));return;}const dt=lastTime?Math.min(.05,(time-lastTime)/1000):1/60;lastTime=time;
    emit(dt);accumulator=Math.min(accumulator+dt*speeds.water,.16);
    // Bound catch-up work so a dense one-pixel field cannot starve input and recording.
    const step=1/150,deadline=performance.now()+8;let steps=0;while(accumulator>=step&&steps++<24){if(water||Number(canvas.dataset.water)>0)liquid.stepWater();if(water&&dense){if(gridFlow){for(const sx of gridSources)liquid.addWater(sx/ls,horizon/ls,1);}else liquid.fillTop(horizon/ls);}accumulator-=step;if(performance.now()>=deadline)break;}
    snowAccumulator=Math.min(snowAccumulator+dt*speeds.snow,.16);steps=0;while(snowAccumulator>=cell/150&&steps++<24){if(snow||Number(canvas.dataset.snow)>0)field.stepWater();snowAccumulator-=cell/150;}
    draw(dt);
    if(light||snow||water||rays.length||Number(canvas.dataset.snow)>0||Number(canvas.dataset.water)>0)raf=requestAnimationFrame(frame);else lastTime=0;
  }
  function wake(){if(canvas&&!raf&&!document.hidden&&!paused)raf=requestAnimationFrame(frame);}
  function sync(){dirty=true;lastMask=-Infinity;saveStyle();updateStatus();wake();}
  function traces(){const time=performance.now();if(time-tracesAt>250){tracesAt=time;tracesHas=!!(rays.length||beamDistance||field?.water.some(v=>v>0)||liquid?.activeRows.size);}return tracesHas;}
  function setting(run,optical=false){run();if(optical){rays=[];beams=null;beamDistance=0;}saveStyle();dirty=true;wake();updateStatus();root.dispatchEvent(new Event('may-flow-state'));}
  const path={light:'M12 2v4 M12 18v4 M2 12h4 M18 12h4 M5 5l3 3 M16 16l3 3 M5 19l3-3 M16 8l3-3 M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0',snow:'M12 2v20 M3 7l18 10 M3 17L21 7',water:'M12 2Q2 12 5 18Q12 25 19 18Q22 12 12 2',axis:'M4 20L20 4 M4 14v6h6',reset:'M5 7a9 9 0 1 1-1 8 M5 2v6h6'};
  const toggle=(name,tip,get,set,icon=path.light)=>({type:'toggle',name,tip,icon,on:get,click:()=>setting(()=>set(!get()))});
  const slider=(name,tip,get,set,min,max,step,initial,format=String)=>({type:'value',name,tip,get:()=>format(get()),
    step:d=>setting(()=>set(Math.max(min,Math.min(typeof max==='function'?max():max,Number((get()+d*step).toFixed(4)))))),
    reset:()=>setting(()=>set(initial)),frac:()=>(get()-min)/((typeof max==='function'?max():max)-min),
    setFrac:f=>setting(()=>set(Number((min+Math.round(f*((typeof max==='function'?max():max)-min)/step)*step).toFixed(4))))});
  const stream=(key,name,get,set)=>toggle(name,name+': включить или выключить поток. Настройки сохраняются после F5.',get,value=>{set(value);beamDistance=0;},path[key]);
  const items=[stream('light','Свет',()=>light,v=>{light=v;}),stream('snow','Снег',()=>snow,v=>{snow=v;}),stream('water','Вода',()=>water,v=>{water=v;})];
  for(const [key,name]of [['light','света'],['snow','снега'],['water','воды']])items.push(slider('Скорость '+name,'Скорость '+name+' · 0 — пауза данного потока · двойной щелчок — ×1',()=>speeds[key],v=>{speeds[key]=v;if(key==='water')accumulator=0;if(key==='snow')snowAccumulator=0;},0,4,.1,1,v=>'×'+Number(v.toFixed(1))));
  for(let bit=0;bit<2;bit++)for(const [key,label]of [['pass','Пропуск'],['reflect','Отражение']])items.push({type:'list',name:bit+' '+label,icon:path.axis,
    tip:'Бит '+bit+' · '+label+'. Сверху и снизу — относительно направления потока. Пропускание и отражение вместе делят свет 50/50.',
    options:[{v:0,name:'Нет'},{v:1,name:'Сверху'},{v:2,name:'Снизу'},{v:3,name:'Обе стороны'}],get:()=>lightRules[bit][key],set:v=>setting(()=>{lightRules[bit][key]=Number(v);},true)});
  items.push(toggle('−50%','Ослаблять отражённый свет на 50% при каждом отражении',()=>reflectionLoss,v=>{reflectionLoss=v;if(lightField)lightField.reflectionLoss=v;rays=[];beams=null;beamDistance=0;}),
    toggle('Углы вниз','Вода: проход вниз через шахматные стыки',()=>waterCorners,v=>{waterCorners=v;if(liquid)liquid.cornerPass=v;},path.water),
    toggle('Углы вверх','Вода: подъём уровня через шахматные стыки',()=>waterCornersUp,v=>{waterCornersUp=v;if(liquid)liquid.cornerUp=v;},path.water),
    toggle('Плотно','Сплошной поток света и воды. Исключает круговой источник Солнце.',()=>dense,v=>{dense=v;if(v)sun=false;rays=[];beams=null;beamDistance=0;}),
    toggle('От оси','От конечной ручки зеркальной оси к её началу. Горизонт и исходный центр Солнца проходят через ручку; Солнце можно затем переместить отдельно. Положение и угол — в группе Зеркала; зеркало может быть выключено. Исключает По сетке.',()=>axisFlow,v=>{axisFlow=v;if(v){gridFlow=false;gridKey=null;sunCentre=null;}lastMask=-Infinity;reset();},path.axis),
    toggle('Свет 01','Свет в виде цифр 0 и 1, текущий шрифт Маятника. Цвета цифр исходные, пока не выбран общий цвет луча в кружке Солнца',()=>lightBits,v=>{lightBits=v;}),
    slider('Размер света','Размер цифр света в экранных пикселях',()=>lightSize,v=>{lightSize=v;},4,64,1,16,v=>v+' px'),
    toggle('Солнце','Круговой источник света. Центр и радиус можно тянуть прямо на холсте. Исключает сплошной поток и По сетке.',()=>sun,v=>{sun=v;if(v){dense=false;if(gridFlow){gridFlow=false;gridKey=null;lastMask=-Infinity;reset();}}rays=[];beams=null;beamDistance=0;}),
    slider('Радиус','Радиус Солнца в экранных пикселях',()=>sunRadius,v=>{sunRadius=v;},0,()=>innerWidth,1,40,v=>v+' px'),
    {type:'toggle',name:'Пауза',icon:'M8 4v16 M16 4v16',tip:'Пауза всех потоков; поле Маятника продолжает работать',on:()=>paused,click(){paused=!paused;lastTime=0;saveStyle();updateStatus();if(paused){cancelAnimationFrame(raf);raf=0;}else wake();}},
    {type:'action',name:'Сброс потоков',icon:path.reset,tip:'Удалить свет, снег и воду и выключить потоки. Остальные настройки сохраняются.',click(){light=snow=water=paused=false;reset();sync();}},
    {type:'action',name:'Состояние',pan:'flow-status',nameNow:()=>root.HubButtonText?.shortCaption(unavailable?'Недоступно':paused?'Пауза':'Состояние')||(unavailable?'Недоступно':paused?'Пауза':'Состояние'),icon:'M12 10v8 M12 5v1',tip:'Причина приостановки и границы режима. Потоки взаимодействуют с битовыми клетками и шаблонами; оси и надписи не являются стенками. Экспорт потоков не подключён.',click(){root.alert(statusMessage+'\n\nПрепятствия — клетки текущего поля и видимые шаблоны. Оси и надписи не препятствуют потоку. Частицы живут в экранных координатах; после F5 их накопления очищаются, настройки сохраняются. В PNG, GIF и видео слой потоков не добавлен.');}}
  );
  // Append with a stable id: existing flow-N layout keys must not move.
  items.push({...toggle('По сетке','Поток сверху по центрам битовых столбцов. Шаг следует масштабу и сдвигу поля; смещённые ряды используют оба семейства центров. Исключает От оси и Солнце. При смене геометрии следы очищаются.',()=>gridFlow,v=>{gridFlow=v;if(v){axisFlow=false;sun=false;}gridKey=null;lastMask=-Infinity;reset();},'M4 4h16v16H4z M4 12h16 M12 4v16'),pan:'flow-grid'});
  const dependencies=new Map([
    ['Скорость света',[()=>light,'Включите Свет']],['Скорость снега',[()=>snow,'Включите Снег']],['Скорость воды',[()=>water,'Включите Воду']],
    ['−50%',[()=>light,'Включите Свет']],['Углы вниз',[()=>water,'Включите Воду']],['Углы вверх',[()=>water,'Включите Воду']],
    ['Плотно',[()=>light||water,'Включите Свет или Воду']],['Свет 01',[()=>light&&!dense,'Включите Свет и выключите Плотно']],
    ['Размер света',[()=>light&&lightBits&&!dense,'Включите Свет 01 без Плотно']],['Солнце',[()=>light,'Включите Свет']],['Радиус',[()=>light&&sun,'Включите Свет и Солнце']]
  ]);
  for(const item of items){
    const dep=item.type==='list'?[()=>light,'Включите Свет']:dependencies.get(item.name);
    if(!dep)continue;
    item.disabled=()=>!!(light||snow||water)&&!dep[0]();item.disabledReason=()=>item.disabled()?dep[1]:'';
    // Guard the actions as well as the DOM: a slider drag or list may already be open.
    for(const key of ['click','step','reset','setFrac','set'])if(typeof item[key]==='function'){
      const action=item[key];item[key]=(...args)=>{if(!item.disabled())return action.apply(item,args);};
    }
  }
  items.forEach((item,index)=>{if(!item.pan)item.pan='flow-'+index;});
  canvas=document.createElement('canvas');canvas.id='mayFlow';canvas.setAttribute('aria-hidden','true');
  Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100vw',height:'100vh',pointerEvents:'none',zIndex:'6',background:'transparent'});document.body.append(canvas);ctx=canvas.getContext('2d');
  waterCanvas=document.createElement('canvas');waterCtx=waterCanvas.getContext('2d');liquidCanvas=document.createElement('canvas');liquidCtx=liquidCanvas.getContext('2d');
  try{const saved=JSON.parse(localStorage.getItem('mayatnik-flow-v1')||'{}');light=saved.light===true;snow=saved.snow===true;water=saved.water===true;paused=saved.paused===true;}catch(_){}
  // Sources only invalidate: no field readback, transport pause or calculation is requested here.
  for(const event of ['resize','scroll','may-layers-change','may-phone-change','may-reset-complete'])root.addEventListener(event,invalidate,{passive:true,capture:event==='scroll'});
  for(const event of ['input','change','click','pointerup'])document.addEventListener(event,invalidate,{passive:true});
  document.addEventListener('pointermove',e=>{if(e.buttons)invalidate();},{passive:true});
  document.addEventListener('visibilitychange',()=>{lastTime=0;if(!document.hidden&&(light||snow||water||traces()))wake();});
  root.addEventListener('pagehide',()=>{endSunDrag(true);cancelAnimationFrame(raf);clearTimeout(retry);retry=0;raf=0;lastTime=0;});
  root.addEventListener('pageshow',()=>{if(light||snow||water||traces())wake();});
  mountSunHandles();updateStatus();if(light||snow||water)wake();
  return {invalidate,group:()=>({id:'flow',title:'Потоки',color:'#76d4ff',items}),get rayColour(){return rayColour||host.palette().sym;},setRayColour(value){if(!/^#[\da-f]{6}$/i.test(value)||(snow||water)&&!light)return;setting(()=>{rayColour=value;});if(paused&&field&&scene&&!unavailable)draw(0);},materialColour:key=>materialColours[key],setMaterialColour(key,value){if(!Object.hasOwn(materialColours,key)||!/^#[\da-f]{6}$/i.test(value))return;setting(()=>{materialColours[key]=value;});if(paused&&field&&scene&&!unavailable)draw(0);},get playing(){return !paused&&!unavailable&&(light||snow||water);},get status(){return statusMessage;},get traces(){return traces();},reset(){light=snow=water=paused=false;reset();sync();}};
  }
  root.MayatnikFlow={mount};
})(window);
