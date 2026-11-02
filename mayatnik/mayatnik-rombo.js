/* Assemble the native central cone and two outer boundary cones, or exchange
 * the central diamond's quarters. One staircase mask drives draw and picking;
 * source bit addresses and work data remain in their native frame. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./mayatnik-triangle-assembly.js'));else root.MayatnikRombo=factory(root.MayatnikTriangleAssembly);})(typeof globalThis==='object'?globalThis:this,function(triangles){
 'use strict';
 const point=(m,p)=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]});
 function inverse(m,p){const d=m[0]*m[3]-m[1]*m[2],x=p.x-m[4],y=p.y-m[5];return {x:(m[3]*x-m[2]*y)/d,y:(-m[1]*x+m[0]*y)/d};}
 const choiceNames=['L','R','L↔','R↔'];
 const variants=[...[1,3,4,6,9,11,12,14].map(id=>({id,kind:'sides',choices:[Math.floor(id/4),id%4],label:[Math.floor(id/4),id%4].map(i=>choiceNames[i]).join(' | ')})),{id:16,kind:'central',label:'C → 180° вниз'},{id:17,kind:'quarters',label:'Четверти 1↔3, 2↔4'}];
 const normalise=id=>variants.some(v=>v.id===Number(id))?Number(id):16;
 const turnAngle=value=>((Math.round((Number(value)||0)/45)*45)%360+360)%360;
 function availability(id,g={},row=g.height){if(g.available===false)return {available:false,reason:g.reason||'Нужна плоская проекция исходного поля'};const anchor=g.anchor??((g.width-1)/2);if(anchor+row<=0||anchor-row+1>=g.width)return {available:false,reason:'Центральный треугольник выше оси находится вне видимого поля'};if(id<16&&!g.sides)return {available:false,reason:'Боковые треугольники доступны в плоском Перескоке'};return {available:true,reason:''};}
 // A row interval is also the exact cell-area mask. Only the vertical seam
 // splits a cell in half; diagonal borders follow whole-cell staircases.
 function shape(rows){
  const valid=rows.filter(r=>r.right>r.left),outline=[];
  if(valid.length){for(const r of valid)outline.push({x:r.left,y:r.y},{x:r.left,y:r.y+1});for(let i=valid.length-1;i>=0;i--){const r=valid[i];outline.push({x:r.right,y:r.y+1},{x:r.right,y:r.y});}}
  const left=valid.length?valid.reduce((a,r)=>Math.min(a,r.left),Infinity):0,right=valid.length?valid.reduce((a,r)=>Math.max(a,r.right),-Infinity):0,height=valid.length?valid[valid.length-1].y+1:0,map=new Map(valid.map(r=>[r.y,r]));
  return {rows:valid,outline,left,right,height,contains(x,y){const r=map.get(Math.floor(y));return !!r&&x>=r.left&&x<r.right;}};
 }
 function plan(width,height,state={},geometry={}){
  const W=Math.max(1,width),H=Math.max(1,height),A=Math.max(1,Math.min(H,Math.round(state.row??H))),angle=turnAngle(state.angle),id=normalise(state.assembly),status=availability(id,{width:W,height:H,...geometry},A),cx=(geometry.anchor??((W-1)/2))+.5,parts=[],colour={C:'#e5be68',L:'#78b8e8',R:'#d99bc9'};
  const mask=key=>shape(Array.from({length:A},(_,r)=>({y:r,left:Math.max(0,key==='C'?cx-r-.5:key==='L'?.5:W-r-1),right:Math.min(W,key==='C'?cx+r+.5:key==='L'?r+1:W-.5)})));
  const C=mask('C'),L=mask('L'),R=mask('R'),add=(key,matrix,id,label,source=key==='C'?C:key==='L'?L:R,extra={})=>{if(source.outline.length)parts.push({...source,id,label,sourceKey:key,color:colour[key],matrix,...extra});};
  if(status.available){
   if(id===17){
    const half=Math.max(cx-C.left,C.right-cx),base=[{matrix:[1,0,0,1,0,0],bottom:false},{matrix:[-1,0,0,-1,2*cx,2*A],bottom:true}];
    for(const b of base)for(const left of [true,false]){
     const sourceLeft=b.bottom?!left:left,source=shape(C.rows.map(r=>({...r,left:sourceLeft?r.left:Math.max(r.left,cx),right:sourceLeft?Math.min(r.right,cx):r.right}))),sourceQuarter=b.bottom?(left?4:3):(left?1:2),targetQuarter=({1:3,2:4,3:1,4:2})[sourceQuarter],m=b.matrix.slice();m[4]+=left?half:-half;m[5]+=b.bottom?-A:A;
     add('C',m,'quarter'+sourceQuarter,sourceQuarter+'→'+targetQuarter,source,{quadrant:sourceQuarter,sourceQuarter,targetQuarter});
    }
   }else{
    add('C',[1,0,0,1,0,0],'top','C: центральный треугольник');
    if(id===16)add('C',[-1,0,0,-1,2*cx,2*A],'lower','C: поворот 180° вниз');
    else for(let slot=0;slot<2;slot++){
     const choice=slot?id%4:Math.floor(id/4),key=choice%2?'R':'L',src=key==='L'?L:R,sourceMid=(src.left+src.right)/2,normal=key==='L'?[-1,0,0,-1,cx+.5,2*A]:[-1,0,0,-1,cx+W-.5,2*A];
     // Exchange complete pieces by translation; reflect each chosen piece
     // about its own centre, including its mask, without fitting its shape.
     normal[4]+=(slot===0?0:1)*(A-.5)-(key==='R'?A-.5:0);
     if(choice>=2){normal[4]+=normal[0]*2*sourceMid;normal[0]*=-1;}
     add(key,normal,'lower'+slot,(slot?'Низ справа: ':'Низ слева: ')+choiceNames[choice]);
    }
   }
  }
  return project({...status,mode:'fixed',width:W,height:H,row:A,angle,assembly:id,parts,axis:[{x:C.left,y:A},{x:C.right,y:A}]});
 }
 function customAvailability(layout,g){
  if(g.available===false)return {available:false,reason:g.reason||'Нужна плоская проекция исходного поля'};
  if(!layout?.pieces.length)return {available:false,reason:'Нет сохранённых треугольников для сборки'};
  if(layout.width!==g.width||layout.height!==g.height)return {available:false,reason:'Размер исходного поля изменился'};
  if(layout.scope!==g.scope)return {available:false,reason:'Сборка относится к другому исходному полю'};
  return {available:true,reason:''};
 }
 function buildCustom(layout,g,angle){
  const status=customAvailability(layout,g);
  const parts=status.available?layout.pieces.map((piece,index)=>{
   const outline=Object.freeze(piece.vertices.map(([x,y])=>Object.freeze({x,y})));
   const xs=outline.map(p=>p.x),ys=outline.map(p=>p.y);
   return {id:piece.id,sourceKey:piece.id,label:'Треугольник '+(index+1),color:'#78b8e8',outline,
    left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),height:Math.max(...ys),
    contains:(x,y)=>triangles.contains(piece.vertices,[x,y]),matrix:triangles.matrix(piece)};
  }):[];
  return project({...status,mode:'custom',width:g.width,height:g.height,angle:turnAngle(angle),assembly:null,axis:null,parts});
 }
 function customPlan(layout,geometry,angle=0){return buildCustom(triangles.normalize(layout),geometry,angle);}
 function project(config){
  const {angle,parts}=config;
  const radians=angle*Math.PI/180,c=Math.abs(Math.cos(radians))<1e-12?0:Math.cos(radians),s=Math.abs(Math.sin(radians))<1e-12?0:Math.sin(radians),rotation=[c,s,-s,c,0,0];let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const t of parts)for(const vertex of t.outline){const p=point(rotation,point(t.matrix,vertex));minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
  if(!parts.length){minX=minY=0;maxX=maxY=1;}rotation[4]=-minX;rotation[5]=-minY;
  const result={...config,rotation,outputWidth:maxX-minX,outputHeight:maxY-minY,forward:p=>point(rotation,p),unrotate:p=>inverse(rotation,p)};
  const snap=value=>Math.abs(value*2-Math.round(value*2))<1e-9?Math.round(value*2)/2:value;
  result.pick=p=>{const q=result.unrotate(p);for(let i=parts.length-1;i>=0;i--){const tile=parts[i],src=inverse(tile.matrix,q);src.x=snap(src.x);src.y=snap(src.y);if(tile.contains(src.x,src.y))return {...src,part:tile.id,sourceKey:tile.sourceKey};}return null;};return result;
 }
 function draw(ctx,source,p,ratio=1,smoothing=false){
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#000';ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.imageSmoothingEnabled=smoothing;if(smoothing)ctx.imageSmoothingQuality='high';
  const R=p.rotation;ctx.setTransform(R[0]*ratio,R[1]*ratio,R[2]*ratio,R[3]*ratio,R[4]*ratio,R[5]*ratio);
  const sx=source.width/p.width,sy=source.height/p.height;
  for(const tile of p.parts){ctx.save();ctx.transform(...tile.matrix);ctx.beginPath();tile.outline.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();
   if(p.mode==='custom'){
    const x=Math.max(0,Math.floor(tile.left*sx)),y=Math.max(0,Math.floor(tile.top*sy));
    const w=Math.min(source.width,Math.ceil(tile.right*sx))-x,h=Math.min(source.height,Math.ceil(tile.height*sy))-y;
    if(w>0&&h>0)ctx.drawImage(source,x,y,w,h,x/sx,y/sy,w/sx,h/sy);
   }else ctx.drawImage(source,0,0,source.width,source.height,0,0,p.width,p.height);
   ctx.restore();
  }
 }
 function exactSize(W,H,quality){
  const width=Math.max(1,Math.ceil(W*quality-1e-9)),height=Math.max(1,Math.ceil(H*quality-1e-9));
  if(!(quality>0&&Number.isFinite(quality))||width>16384||height>16384||width*height>16e6)throw new RangeError('Точный растр Ромбо превышает лимит 16 Мп или 16384 px. Уменьшите масштаб или число строк.');
  return {width,height,quality};
 }
 // Pixel centres are classified in native source coordinates. No Canvas
 // filtering, polygon antialiasing or per-pixel point objects enter this path.
 function rasterPixels(p,source,quality=1,{data,transparent=false}={}){
  if(!source||!Number.isInteger(source.width)||!Number.isInteger(source.height)||!source.data||source.data.length!==source.width*source.height*4)throw new TypeError('Для точного Ромбо нужен исходный массив RGBA.');
  const {width,height}=exactSize(p.outputWidth,p.outputHeight,quality);
  if(data&&(!(data instanceof Uint8ClampedArray)||data.length!==width*height*4))throw new TypeError('Неверный размер точного растра Ромбо.');
  data=data&&data!==source.data?data:new Uint8ClampedArray(width*height*4);
  const out=new Uint32Array(data.buffer,data.byteOffset,width*height),raw=source.data.byteOffset%4?new Uint8ClampedArray(source.data):source.data,src=new Uint32Array(raw.buffer,raw.byteOffset,source.width*source.height),black=new Uint32Array(new Uint8Array([0,0,0,255]).buffer)[0];out.fill(transparent?0:black);
  const R=p.rotation,sw=source.width,sh=source.height,sxScale=sw/p.width,syScale=sh/p.height;
  for(const tile of p.parts){
   const T=tile.matrix,a=R[0]*T[0]+R[2]*T[1],b=R[1]*T[0]+R[3]*T[1],c=R[0]*T[2]+R[2]*T[3],d=R[1]*T[2]+R[3]*T[3],e=R[0]*T[4]+R[2]*T[5]+R[4],f=R[1]*T[4]+R[3]*T[5]+R[5],det=a*d-b*c;
   const ia=d/det,ib=-b/det,ic=-c/det,id=a/det,ie=(c*f-d*e)/det,iff=(b*e-a*f)/det;
   let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
   for(const v of tile.outline){const x=(a*v.x+c*v.y+e)*quality,y=(b*v.x+d*v.y+f)*quality;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
   const x0=Math.max(0,Math.floor(minX)),x1=Math.min(width,Math.ceil(maxX)),y0=Math.max(0,Math.floor(minY)),y1=Math.min(height,Math.ceil(maxY)),stepX=ia/quality,stepY=ib/quality;
   const edges=tile.rows?null:tile.outline.map((v,i)=>{const w=tile.outline[(i+1)%tile.outline.length],dx=w.x-v.x,dy=w.y-v.y;return [-dy,dx,dy*v.x-dx*v.y,-1e-7*Math.hypot(dx,dy)];});
   const rows=tile.rows?new Map(tile.rows.map(row=>[row.y,row])):null;
   for(let y=y0;y<y1;y++){
    let sx=ia*(x0+.5)/quality+ic*(y+.5)/quality+ie,sy=ib*(x0+.5)/quality+id*(y+.5)/quality+iff;
    for(let x=x0;x<x1;x++,sx+=stepX,sy+=stepY){
     const hx=Math.round(sx*2)/2,hy=Math.round(sy*2)/2,px=Math.abs(sx-hx)<1e-9?hx:sx,py=Math.abs(sy-hy)<1e-9?hy:sy;
     if(rows){const row=rows.get(Math.floor(py));if(!row||px<row.left||px>=row.right)continue;}
     else {let inside=true;for(const edge of edges)if(edge[0]*px+edge[1]*py+edge[2]<edge[3]){inside=false;break;}if(!inside)continue;}
     const sourceX=Math.floor(px*sxScale),sourceY=Math.floor(py*syScale);if(sourceX>=0&&sourceX<sw&&sourceY>=0&&sourceY<sh)out[y*width+x]=src[sourceY*sw+sourceX];
    }
   }
  }
  return {width,height,data};
 }
 function rasterSize(W,H,wanted){
  let quality=Math.min(wanted,Math.sqrt(16e6/(W*H)),16384/W,16384/H);
  let width=Math.max(1,Math.min(16384,Math.ceil(W*quality))),height=Math.max(1,Math.min(16384,Math.ceil(H*quality)));
  if(width*height>16e6){quality=Math.min(quality,(width-1-1e-9)/W,(height-1-1e-9)/H);width=Math.max(1,Math.ceil(W*quality));height=Math.max(1,Math.ceil(H*quality));}
  return {quality,width,height};
 }
 function mount(o){
  const {host,source,box,canvas}=o,doc=host.ownerDocument,win=doc.defaultView,events=new WeakMap();let drag=null,suppressClick=false,current=null,unit=1,originalVisibility=source.style.visibility,raf=0,layoutKey='',stateKey='',precisionMessage='';
  let layoutRef,normalized=null,customKey='',custom=null,publishedLayout;
  const geometry=()=>o.geometry(),precision=()=>!!o.precision?.(),images=new WeakMap();
  function layout(){
   const raw=o.state().romboLayout;
   if(raw!==layoutRef){layoutRef=raw;normalized=triangles.normalize(raw);custom=null;}
   return normalized;
  }
  function get(g=geometry()){
   const s=o.state(),assembly=normalise(s.romboAssembly),row=Math.max(1,Math.min(g.height,Math.round(s.romboRow??g.height))),mode=s.romboMode==='custom'?'custom':'fixed';
   return {on:!!s.edgeRhombOn,row,maxRow:Math.max(1,Math.round(g.height)),angle:((Number(s.romboAngle)||0)%360+360)%360,assembly,mode,precisionError:precisionMessage,...(mode==='custom'?customAvailability(layout(),g):availability(assembly,g,row))};
  }
  let planKey='',plans=new Map();
  function makePlan(assembly,g=geometry(),s=get(g)){
   if(assembly===undefined&&s.mode==='custom'){
    const pieces=layout(),key=JSON.stringify([g.width,g.height,g.scope,s.angle,s.available,s.reason]);
    if(!custom||key!==customKey){customKey=key;custom=buildCustom(pieces,g,s.angle);}
    return custom;
   }
   const id=normalise(assembly??s.assembly),key=[g.width,g.height,g.anchor,g.available,g.reason,g.sides,s.row,s.angle].join(':');
   if(key!==planKey){planKey=key;plans.clear();}if(!plans.has(id))plans.set(id,plan(g.width,g.height,{...s,assembly:id},g));return plans.get(id);
  }
  // Direct state restore/reset and geometry changes also pass through render.
  // Publish only an effective change, so the legend/menu need no frame polling.
  function publish(g=geometry(),state=get(g)){const selected=state.mode==='custom'?layoutRef:null,key=[state.mode,state.on,state.row,state.maxRow,state.angle,state.assembly,state.available,state.reason,g.width,g.anchor,g.sides].join(':');if(key===stateKey&&publishedLayout===selected)return;stateKey=key;publishedLayout=selected;win.dispatchEvent(new win.Event('may-rombo-change'));}
  function notify(){o.changed?.();publish();}
  function render(layoutOnly=false){
   try{if(precision()){const p=o.precisionPolicy?.();if(p&&!p.ok)throw Error(p.reason);}renderFrame(layoutOnly);if(precision()&&!layoutOnly){canvas.style.display='';if(precisionMessage){precisionMessage='';o.onPrecisionError?.('');}}}
   catch(error){if(!precision())throw error;canvas.style.display='none';if(raf)win.cancelAnimationFrame(raf);raf=0;const message=error?.message||String(error);if(message!==precisionMessage){precisionMessage=message;o.onPrecisionError?.(message);}}
  }
  function renderFrame(layoutOnly=false){
   const g=geometry(),state=get(g);publish(g,state);doc.body.classList.toggle('may-rombo-active',state.on&&state.available);
   if(drag&&(!state.on||!state.available||state.mode==='custom')){if(canvas.hasPointerCapture?.(drag.id))canvas.releasePointerCapture(drag.id);drag=null;suppressClick=false;}
   if(!state.on||!state.available){if(raf)win.cancelAnimationFrame(raf);raf=0;layoutKey='';box.style.display='none';source.style.visibility=o.restoreVisibility?.()??originalVisibility;current=null;return;}
   if(!source.width||!source.height)return;current=makePlan(undefined,g,state);const r=source.getBoundingClientRect();unit=o.precision?.()&&o.scale?o.scale():r.width/current.width;if(!(unit>0))return;
   const dpr=Number(win.devicePixelRatio)>0?Number(win.devicePixelRatio):1,W=current.outputWidth,H=current.outputHeight;
   // Rasterize once at the physical display density. Ceil padding is clipped,
   // never stretched back into the exact geometric box by CSS.
   const {quality,width:cw,height:ch}=(precision()?exactSize:rasterSize)(W,H,unit*dpr);
   const cssWidth=cw*unit/quality,cssHeight=ch*unit/quality,rotation=win.mayViewRotation,turned=!!rotation?.enabled,pivot=turned?rotation.center:{x:0,y:0};
   const key=[r.left,r.top,r.width,r.height,current.row,current.angle,current.assembly,W,H,source.style.marginLeft,source.style.marginRight,dpr,quality,turned,pivot.x,pivot.y].join(':');
   if(key!==layoutKey){layoutKey=key;source.style.visibility='hidden';box.style.display='block';box.style.width=W*unit+'px';box.style.height=H*unit+'px';box.style.marginLeft=source.style.marginLeft||'auto';box.style.marginRight=source.style.marginRight||'auto';box.style.marginTop=-(r.height+(parseFloat(win.getComputedStyle(source).marginBottom)||0))+'px';box.style.transform='none';
    let left=r.left+(r.width-W*unit)/2,top=r.top;
    const px=turned?2*pivot.x-left-cssWidth:left,py=turned?2*pivot.y-top-cssHeight:top,sign=turned?-1:1;
    left+=sign*(Math.round(px*dpr)/dpr-px);top+=sign*(Math.round(py*dpr)/dpr-py);
    const br=box.getBoundingClientRect();box.style.transform=`translate(${left-br.left}px, ${top-br.top}px)`;canvas.style.width=cssWidth+'px';canvas.style.height=cssHeight+'px';canvas.style.transform='none';}
   if(!raf)raf=win.requestAnimationFrame(()=>{raf=0;render(false);});
   if(layoutOnly)return;
   if(canvas.width!==cw)canvas.width=cw;if(canvas.height!==ch)canvas.height=ch;
   const ctx=canvas.getContext('2d'),frame=precision()?o.captureBits?.():(o.capture?.()||source);paint(ctx,frame,current,quality,unit);
  }
  function paint(ctx,frame,p,quality,displayUnit){
   if(precision()){
    const size=exactSize(p.outputWidth,p.outputHeight,quality);let cache=images.get(ctx);
    if(!cache||cache.base.width!==size.width||cache.base.height!==size.height){cache={base:ctx.createImageData(size.width,size.height)};images.set(ctx,cache);}
    const revision=o.revision?.(),same=revision!==undefined&&cache.revision===revision&&cache.plan===p&&cache.quality===quality&&cache.source===frame?.data;
    if(!same){rasterPixels(p,frame,quality,{data:cache.base.data});cache.revision=revision;cache.plan=p;cache.quality=quality;cache.source=frame.data;cache.overlayReady=false;}
    ctx.setTransform(1,0,0,1,0,0);ctx.putImageData(cache.base,0,0);
    const overlay=o.captureOverlay?.();
    if(overlay){
     if(!cache.overlay){cache.overlay=ctx.createImageData(size.width,size.height);cache.canvas=doc.createElement('canvas');cache.canvas.width=size.width;cache.canvas.height=size.height;}
     let unchanged=cache.overlayReady&&cache.overlayWidth===overlay.width&&cache.overlayHeight===overlay.height&&cache.overlaySource?.length===overlay.data.length;
     if(unchanged){const old=cache.overlaySource,next=overlay.data;for(let i=0;i<next.length;i++)if(old[i]!==next[i]){unchanged=false;break;}}
     if(!unchanged){rasterPixels(p,overlay,quality,{data:cache.overlay.data,transparent:true});cache.canvas.getContext('2d').putImageData(cache.overlay,0,0);cache.overlaySource=overlay.data.slice();cache.overlayWidth=overlay.width;cache.overlayHeight=overlay.height;cache.overlayReady=true;}
     ctx.imageSmoothingEnabled=false;ctx.drawImage(cache.canvas,0,0);
    }
   }else draw(ctx,frame,p,quality,quality<Math.max(frame.width/p.width,frame.height/p.height));
   ctx.setTransform(quality,0,0,quality,0,0);o.paintOverlay?.(ctx,p,quality,displayUnit);
   if(p.axis){const a=p.forward(p.axis[0]),b=p.forward(p.axis[1]);ctx.strokeStyle='#ffd35b';ctx.lineWidth=1/Math.max(.02,displayUnit);ctx.setLineDash?.([5/displayUnit,3/displayUnit]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash?.([]);}
   o.paintCentres?.(ctx,p,quality,displayUnit);
  }
  function capture(){
   if(precision()){const policy=o.precisionPolicy?.();if(policy&&!policy.ok)throw Error(policy.reason);}
   const c=doc.createElement('canvas'),g=geometry(),state=get(g),frame=precision()?o.captureBits?.():(o.capture?.()||source);
   if(precision()&&!frame?.data)throw new TypeError('Для точного Ромбо нужен исходный массив RGBA.');
   if(!state.on||!state.available){c.width=frame.width;c.height=frame.height;if(precision()){const image=c.getContext('2d').createImageData(frame.width,frame.height);image.data.set(frame.data);c.getContext('2d').putImageData(image,0,0);}else c.getContext('2d').drawImage(frame,0,0);return c;}
   const p=makePlan(undefined,g,state),wanted=precision()&&o.exportScale?o.exportScale():Math.max(2,frame.width/p.width,frame.height/p.height);if(wanted===null)throw Error('Не удалось выбрать точный масштаб экспорта.');const raster=(precision()?exactSize:rasterSize)(p.outputWidth,p.outputHeight,wanted);
   c.width=raster.width;c.height=raster.height;paint(c.getContext('2d'),frame,p,raster.quality,o.precision?.()&&o.scale?o.scale():source.getBoundingClientRect().width/p.width||1);return c;
  }
  function input(event){
   // Zoom belongs to the whole field, including gaps between the triangles.
   // Preserve the navigation point already mapped by whole-view rotation;
   // only cell tools below need a source-triangle address.
   if(event.type==='wheel')return;
   if(!get().on||!current||events.has(event)||!(event.target===canvas||drag))return;
   if(event.type==='click'&&suppressClick){suppressClick=false;event.preventDefault();event.stopImmediatePropagation();return;}
   if(event.type==='pointerdown')suppressClick=false;
   const r=canvas.getBoundingClientRect(),p={x:(event.clientX-r.left)/unit,y:(event.clientY-r.top)/unit};let distance=Infinity;
   if(current.axis){const a=current.forward(current.axis[0]),b=current.forward(current.axis[1]),dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));distance=Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)*unit;}
   events.set(event,{x:event.clientX,y:event.clientY});
   if(event.type==='pointerdown'&&event.button===0&&distance<=7){drag={id:event.pointerId,x:event.clientX,y:event.clientY,row:get().row,unit,angle:get().angle*Math.PI/180};canvas.setPointerCapture?.(event.pointerId);event.preventDefault();event.stopImmediatePropagation();return;}
   if(drag&&event.pointerId===drag.id){if(event.type==='pointermove'){const delta=(-(event.clientX-drag.x)*Math.sin(drag.angle)+(event.clientY-drag.y)*Math.cos(drag.angle))/drag.unit;api.setRow(drag.row+delta);}if(event.type==='pointerup'||event.type==='pointercancel'){drag=null;suppressClick=true;}event.preventDefault();event.stopImmediatePropagation();return;}
   if(event.type==='pointermove')canvas.style.cursor=distance<=7?'ns-resize':'crosshair';
   const q=current.pick(p);if(!q){event.preventDefault();event.stopImmediatePropagation();return;}const sr=source.getBoundingClientRect();for(const [k,v]of Object.entries({clientX:sr.left+q.x*unit,clientY:sr.top+q.y*unit,x:sr.left+q.x*unit,y:sr.top+q.y*unit}))Object.defineProperty(event,k,{configurable:true,value:v});
  }
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','mousedown','mousemove','mouseup','click','dblclick','contextmenu','wheel'])win.addEventListener(type,input,{capture:true,passive:false});
  const permit=patch=>!o.allowState||o.allowState({...o.state(),...patch})!==false;
  const api={get,options:()=>variants.map(v=>{const item={...v,...availability(v.id,geometry(),get().row)},next={romboMode:'fixed',romboAssembly:v.id};if(item.available&&!permit(next)){item.available=false;item.reason=o.stateReason?.(next)||'Сборка несовместима с точной сеткой.';}return item;}),plan:makePlan,render,physicalPoint:event=>events.get(event),capture,setMode(value){const mode=value==='custom'?'custom':'fixed';if(!permit({romboMode:mode}))return;o.state().romboMode=mode;notify();},set(value){if(!permit({edgeRhombOn:!!value}))return;o.state().edgeRhombOn=!!value;notify();},setRow(value){const s=o.state(),n=Math.max(1,Math.min(get().maxRow,Math.round(Number(value)||1)));if(s.romboRow===n||!permit({romboRow:n}))return;s.romboRow=n;notify();},cycleAngle(dir=1){const angle=(get().angle+(dir<0?315:45))%360;if(!permit({romboAngle:angle}))return;o.state().romboAngle=angle;notify();},setAssembly(id){const n=normalise(id);if(!availability(n,geometry(),get().row).available||!permit({romboMode:'fixed',romboAssembly:n}))return;o.state().romboMode='fixed';o.state().romboAssembly=n;notify();}};return api;
 }
 return {plan,customPlan,point,inverse,draw,rasterPixels,mount,variants,normalise};
});
