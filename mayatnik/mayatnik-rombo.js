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
 const seamMode=value=>value==='dedupe'?'dedupe':'between';
 const coneCenter=(width,anchor)=>Math.round(2*(anchor??((width-1)/2)))/2+.5;
 // Each side occupies its own full-width slot. Which native column faces the
 // join depends on both the source side and the reflection within the slot.
 function sidePiece(id,slot,W,A){
  const choice=slot?id%4:Math.floor(id/4),key=choice%2?'R':'L',width=Math.min(W,A);
  const start=key==='L'?0:W-width,end=start+width,sign=choice>=2?1:-1;
  const meetsAtEnd=slot===0?sign===1:sign===-1;
  const column=meetsAtEnd?end-1:start;
  return {choice,key,width,start,end,sign,column,firstRow:key==='L'?column:W-1-column};
 }
 function hasDuplicate(id,W,A,cx){
  if(id===17)return !Number.isInteger(cx)&&cx>0&&cx<W;
  if(id===16)return false;
  const left=sidePiece(id,0,W,A),right=sidePiece(id,1,W,A);
  return left.column===right.column&&left.firstRow===right.firstRow;
 }
 // Every row interval contains whole native cells. Drawing and picking share
 // the same masks, including the chosen owner of a duplicated source column.
 function shape(rows){
  const valid=rows.filter(r=>r.right>r.left),outline=[];
  if(valid.length){for(const r of valid)outline.push({x:r.left,y:r.y},{x:r.left,y:r.y+1});for(let i=valid.length-1;i>=0;i--){const r=valid[i];outline.push({x:r.right,y:r.y+1},{x:r.right,y:r.y});}}
  const left=valid.length?valid.reduce((a,r)=>Math.min(a,r.left),Infinity):0,right=valid.length?valid.reduce((a,r)=>Math.max(a,r.right),-Infinity):0,height=valid.length?valid[valid.length-1].y+1:0,map=new Map(valid.map(r=>[r.y,r]));
  return {rows:valid,outline,left,right,height,contains(x,y){const r=map.get(Math.floor(y));return !!r&&x>=r.left&&x<r.right;}};
 }
 function plan(width,height,state={},geometry={}){
  const W=Math.max(1,width),H=Math.max(1,height),A=Math.max(1,Math.min(H,Math.round(state.row??H))),angle=turnAngle(state.angle),id=normalise(state.assembly),status=availability(id,{width:W,height:H,...geometry},A),cx=coneCenter(W,geometry.anchor),seam=seamMode(state.seam??state.romboSeam),parts=[],colour={C:'#e5be68',L:'#78b8e8',R:'#d99bc9'};
  const dedupeAvailable=status.available&&hasDuplicate(id,W,A,cx),collapse=dedupeAvailable&&seam==='dedupe';
  const mask=key=>shape(Array.from({length:A},(_,r)=>({y:r,left:Math.max(0,key==='C'?Math.floor(cx-.5)-r:key==='L'?0:W-r-1),right:Math.min(W,key==='C'?Math.ceil(cx+.5)+r:key==='L'?r+1:W)})));
  const C=mask('C'),L=mask('L'),R=mask('R'),add=(key,matrix,id,label,source=key==='C'?C:key==='L'?L:R,extra={})=>{if(source.outline.length)parts.push({...source,id,label,sourceKey:key,color:colour[key],matrix,...extra});};
  if(status.available){
   if(id===17){
    // With an odd cone both halves receive the whole middle column. When
    // collapsing, only the native left half keeps it, before the exchange.
    const leftEnd=Math.ceil(cx),rightStart=collapse?leftEnd:Math.floor(cx);
    const left=shape(C.rows.map(r=>({...r,right:Math.min(r.right,leftEnd)})));
    const right=shape(C.rows.map(r=>({...r,left:Math.max(r.left,rightStart)})));
    for(const bottom of [false,true]){
     const halves=bottom?[right,left]:[left,right];
     let dest=bottom?2*cx-C.right:C.left;
     // The right quarter becomes the leftmost one; each translation uses
     // its actual width, including clipped or empty off-centre cones.
     for(const index of [1,0]){
      const source=halves[index],quarter=bottom?(index?3:4):(index?2:1),target=({1:3,2:4,3:1,4:2})[quarter];
      const matrix=bottom?[-1,0,0,-1,dest+source.right,A]:[1,0,0,1,dest-source.left,A];
      add('C',matrix,'quarter'+quarter,quarter+'→'+target,source,{quadrant:quarter,sourceQuarter:quarter,targetQuarter:target});
      dest+=source.right-source.left;
     }
    }
   }else{
    add('C',[1,0,0,1,0,0],'top','C: центральный треугольник');
    if(id===16)add('C',[-1,0,0,-1,2*cx,2*A],'lower','C: поворот 180° вниз');
    else for(let slot=0;slot<2;slot++){
     const side=sidePiece(id,slot,W,A),{key,choice,sign}=side;
     let src=key==='L'?L:R;
     let dest=Math.ceil(cx)+(slot?0:-side.width);
     if(slot&&collapse){
      src=shape(src.rows.map(r=>sign===1?{...r,left:Math.max(r.left,side.column+1)}:{...r,right:Math.min(r.right,side.column)}));
      dest--;
     }
     add(key,[sign,0,0,-1,dest+(sign===1?-side.start:side.end),2*A],'lower'+slot,(slot?'Низ справа: ':'Низ слева: ')+choiceNames[choice],src);
    }
   }
  }
  return project({...status,mode:'fixed',width:W,height:H,row:A,angle,assembly:id,seam,dedupeAvailable,halfCells:false,parts,axis:[{x:C.left,y:A},{x:C.right+(id===17&&dedupeAvailable&&!collapse?1:0),y:A}]});
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
 // On a grid line choose the cell on the positive side in assembly space.
 // Reflection reverses that choice in source space. Both sides of a join
 // must use this convention or diagonal sampling can leave a black pixel.
 function sampleCoordinate(value,reversed,tolerance=1e-9){
  const half=Math.round(value*2)/2;
  if(Math.abs(value-half)>=tolerance)return value;
  return reversed&&Number.isInteger(half)?half-1e-9:half;
 }
 function project(config){
  const {angle,parts}=config;
  const radians=angle*Math.PI/180,c=Math.abs(Math.cos(radians))<1e-12?0:Math.cos(radians),s=Math.abs(Math.sin(radians))<1e-12?0:Math.sin(radians),rotation=[c,s,-s,c,0,0];let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const t of parts)for(const vertex of t.outline){const p=point(rotation,point(t.matrix,vertex));minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
  if(!parts.length){minX=minY=0;maxX=maxY=1;}rotation[4]=-minX;rotation[5]=-minY;
  const result={...config,rotation,outputWidth:maxX-minX,outputHeight:maxY-minY,forward:p=>point(rotation,p),unrotate:p=>inverse(rotation,p)};

  result.pick=p=>{
   const q=result.unrotate(p);
   for(let i=parts.length-1;i>=0;i--){
    const tile=parts[i],src=inverse(tile.matrix,q),tolerance=tile.rows?1e-9:5e-10;
    src.x=sampleCoordinate(src.x,tile.rows&&tile.matrix[0]<0,tolerance);
    src.y=sampleCoordinate(src.y,tile.rows&&tile.matrix[3]<0,tolerance);
    if(tile.contains(src.x,src.y))return {...src,part:tile.id,sourceKey:tile.sourceKey};
   }
   return null;
  };
  return result;
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
 function rasterPixels(p,source,quality=1,{data,transparent=false,region=null}={}){
  if(!source||!Number.isInteger(source.width)||!Number.isInteger(source.height)||!source.data||source.data.length!==source.width*source.height*4)throw new TypeError('Для точного Ромбо нужен исходный массив RGBA.');
  const ox=region?.x||0,oy=region?.y||0;
  if(region&&(![ox,oy,region.width,region.height].every(Number.isSafeInteger)||ox<0||oy<0||region.width<1||region.height<1||!(quality>0&&Number.isFinite(quality))||ox+region.width>Math.ceil(p.outputWidth*quality-1e-9)||oy+region.height>Math.ceil(p.outputHeight*quality-1e-9)))throw new RangeError('Неверная область точного растра Ромбо.');
  const {width,height}=region?exactSize(region.width,region.height,1):exactSize(p.outputWidth,p.outputHeight,quality);
  if(data&&(!(data instanceof Uint8ClampedArray)||data.length!==width*height*4))throw new TypeError('Неверный размер точного растра Ромбо.');
  data=data&&data!==source.data?data:new Uint8ClampedArray(width*height*4);
  const out=new Uint32Array(data.buffer,data.byteOffset,width*height),raw=source.data.byteOffset%4?new Uint8ClampedArray(source.data):source.data,src=new Uint32Array(raw.buffer,raw.byteOffset,source.width*source.height),black=new Uint32Array(new Uint8Array([0,0,0,255]).buffer)[0];out.fill(transparent?0:black);
  const R=p.rotation,sw=source.width,sh=source.height,sxScale=sw/p.width,syScale=sh/p.height;
  for(const tile of p.parts){
   const T=tile.matrix,a=R[0]*T[0]+R[2]*T[1],b=R[1]*T[0]+R[3]*T[1],c=R[0]*T[2]+R[2]*T[3],d=R[1]*T[2]+R[3]*T[3],e=R[0]*T[4]+R[2]*T[5]+R[4],f=R[1]*T[4]+R[3]*T[5]+R[5],det=a*d-b*c;
   const ia=d/det,ib=-b/det,ic=-c/det,id=a/det,ie=(c*f-d*e)/det,iff=(b*e-a*f)/det;
   let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
   for(const v of tile.outline){const x=(a*v.x+c*v.y+e)*quality,y=(b*v.x+d*v.y+f)*quality;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
   const x0=Math.max(ox,Math.floor(minX)),x1=Math.min(ox+width,Math.ceil(maxX)),y0=Math.max(oy,Math.floor(minY)),y1=Math.min(oy+height,Math.ceil(maxY));
   const edges=tile.rows?null:tile.outline.map((v,i)=>{const w=tile.outline[(i+1)%tile.outline.length],dx=w.x-v.x,dy=w.y-v.y;return [-dy,dx,dy*v.x-dx*v.y,-1e-7*Math.hypot(dx,dy)];});
   const rows=tile.rows?new Map(tile.rows.map(row=>[row.y,row])):null;
   const reverseX=rows&&T[0]<0,reverseY=rows&&T[3]<0;
   for(let y=y0;y<y1;y++){
    const rowX=ic*(y+.5)/quality+ie,rowY=id*(y+.5)/quality+iff;
    for(let x=x0;x<x1;x++){
     const sx=ia*(x+.5)/quality+rowX,sy=ib*(x+.5)/quality+rowY;
     const px=sampleCoordinate(sx,reverseX),py=sampleCoordinate(sy,reverseY);
     if(rows){const row=rows.get(Math.floor(py));if(!row||px<row.left||px>=row.right)continue;}
     else {let inside=true;for(const edge of edges)if(edge[0]*px+edge[1]*py+edge[2]<edge[3]){inside=false;break;}if(!inside)continue;}
     const sourceX=Math.floor(px*sxScale),sourceY=Math.floor(py*syScale);if(sourceX>=0&&sourceX<sw&&sourceY>=0&&sourceY<sh)out[(y-oy)*width+x-ox]=src[sourceY*sw+sourceX];
    }
   }
  }
  return {width,height,data};
 }
 function viewportTiles(W,H,quality,rect,clip,tileSize=2048){
  if(![W,H,quality].every(v=>Number.isFinite(v)&&v>0)||!rect||!clip||![rect.left,rect.top,clip.left,clip.top,clip.right,clip.bottom].every(Number.isFinite))return [];
  const d=rect.dpr||1,w=Math.ceil(W*quality-1e-9),h=Math.ceil(H*quality-1e-9);
  const x0=Math.max(0,Math.floor((clip.left-rect.left)*d)),y0=Math.max(0,Math.floor((clip.top-rect.top)*d));
  const x1=Math.min(w,Math.ceil((clip.right-rect.left)*d)),y1=Math.min(h,Math.ceil((clip.bottom-rect.top)*d)),tiles=[];
  const side=Math.max(1,Math.min(2048,Math.floor(tileSize)||2048));
  for(let y=y0;y<y1;y+=side)for(let x=x0;x<x1;x+=side)tiles.push({x,y,width:Math.min(side,x1-x),height:Math.min(side,y1-y)});
  return tiles;
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
  const geometry=()=>o.geometry(),precision=()=>!!o.precision?.(),images=new WeakMap(),screen=[canvas];let visibleTiles=[],overlaySnapshot=null;
  const viewportMode=()=>precision()&&o.viewport===true;
  function captureOverlayFrame(){
   const overlay=o.captureOverlay?.();if(!overlay){overlaySnapshot=null;return null;}
   let same=overlaySnapshot?.width===overlay.width&&overlaySnapshot?.height===overlay.height&&overlaySnapshot.data.length===overlay.data.length;
   if(same)for(let i=0;i<overlay.data.length;i++)if(overlaySnapshot.data[i]!==overlay.data[i]){same=false;break;}
   if(!same)overlaySnapshot={width:overlay.width,height:overlay.height,data:overlay.data.slice()};
   return overlaySnapshot;
  }
  function layout(){
   const raw=o.state().romboLayout;
   if(raw!==layoutRef){layoutRef=raw;normalized=triangles.normalize(raw);custom=null;}
   return normalized;
  }
  function get(g=geometry()){
   const s=o.state(),assembly=normalise(s.romboAssembly),row=Math.max(1,Math.min(g.height,Math.round(s.romboRow??g.height))),mode=s.romboMode==='custom'?'custom':'fixed';
   const status=mode==='custom'?customAvailability(layout(),g):availability(assembly,g,row);
   const dedupeAvailable=mode==='fixed'&&status.available&&hasDuplicate(assembly,g.width,row,coneCenter(g.width,g.anchor));
   return {on:!!s.edgeRhombOn,row,maxRow:Math.max(1,Math.round(g.height)),angle:((Number(s.romboAngle)||0)%360+360)%360,
    assembly,mode,seam:seamMode(s.romboSeam),dedupeAvailable,precisionError:precisionMessage,...status};
  }
  let planKey='',plans=new Map();
  function makePlan(assembly,g=geometry(),s=get(g)){
   if(assembly===undefined&&s.mode==='custom'){
    const pieces=layout(),key=JSON.stringify([g.width,g.height,g.scope,s.angle,s.available,s.reason]);
    if(!custom||key!==customKey){customKey=key;custom=buildCustom(pieces,g,s.angle);}
    return custom;
   }
   const id=normalise(assembly??s.assembly),key=[g.width,g.height,g.anchor,g.available,g.reason,g.sides,s.row,s.angle,s.seam].join(':');
   if(key!==planKey){planKey=key;plans.clear();}if(!plans.has(id))plans.set(id,plan(g.width,g.height,{...s,assembly:id},g));return plans.get(id);
  }
  // Direct state restore/reset and geometry changes also pass through render.
  // Publish only an effective change, so the legend/menu need no frame polling.
  function publish(g=geometry(),state=get(g)){const selected=state.mode==='custom'?layoutRef:null,key=[state.mode,state.on,state.row,state.maxRow,state.angle,state.assembly,state.seam,state.dedupeAvailable,state.available,state.reason,g.width,g.anchor,g.sides].join(':');if(key===stateKey&&publishedLayout===selected)return;stateKey=key;publishedLayout=selected;win.dispatchEvent(new win.Event('may-rombo-change'));}
  function notify(){o.changed?.();publish();}
  function render(layoutOnly=false){
   try{if(precision()){const p=o.precisionPolicy?.();if(p&&!p.ok)throw Error(p.reason);}renderFrame(layoutOnly);if(precision()&&!layoutOnly){if(!viewportMode())canvas.style.display='';if(precisionMessage){precisionMessage='';o.onPrecisionError?.('');}}}
   catch(error){if(!precision())throw error;for(const tile of screen)tile.style.display='none';visibleTiles=[];if(raf)win.cancelAnimationFrame(raf);raf=0;const message=error?.message||String(error);if(message!==precisionMessage){precisionMessage=message;o.onPrecisionError?.(message);}}
  }
  function renderFrame(layoutOnly=false){
   const g=geometry(),state=get(g);publish(g,state);doc.body.classList.toggle('may-rombo-active',state.on&&state.available);
   if(drag&&(!state.on||!state.available||state.mode==='custom')){if(canvas.hasPointerCapture?.(drag.id))canvas.releasePointerCapture(drag.id);drag=null;suppressClick=false;}
   if(!state.on||!state.available){if(raf)win.cancelAnimationFrame(raf);raf=0;layoutKey='';box.style.display='none';visibleTiles=[];source.style.visibility=o.restoreVisibility?.()??originalVisibility;current=null;return;}
   if(!source.width||!source.height)return;current=makePlan(undefined,g,state);const r=source.getBoundingClientRect();unit=o.precision?.()&&o.scale?o.scale():r.width/current.width;if(!(unit>0))return;
   const dpr=Number(win.devicePixelRatio)>0?Number(win.devicePixelRatio):1,W=current.outputWidth,H=current.outputHeight;
   // Rasterize once at the physical display density. Ceil padding is clipped,
   // never stretched back into the exact geometric box by CSS.
   const viewport=viewportMode();
   const {quality,width:cw,height:ch}=viewport?{quality:unit*dpr,width:Math.ceil(W*unit*dpr-1e-9),height:Math.ceil(H*unit*dpr-1e-9)}:(precision()?exactSize:rasterSize)(W,H,unit*dpr);
   const cssWidth=cw*unit/quality,cssHeight=ch*unit/quality,rotation=win.mayViewRotation,turned=!!rotation?.enabled,pivot=turned?rotation.center:{x:0,y:0};
   const key=[r.left,r.top,r.width,r.height,current.row,current.angle,current.assembly,W,H,source.style.marginLeft,source.style.marginRight,dpr,quality,turned,pivot.x,pivot.y].join(':');
   if(key!==layoutKey){layoutKey=key;source.style.visibility='hidden';box.style.display='block';box.style.width=W*unit+'px';box.style.height=H*unit+'px';box.style.marginLeft=source.style.marginLeft||'auto';box.style.marginRight=source.style.marginRight||'auto';box.style.marginTop=-(r.height+(parseFloat(win.getComputedStyle(source).marginBottom)||0))+'px';box.style.transform='none';
    let left=r.left+(r.width-W*unit)/2,top=r.top;
    const px=turned?2*pivot.x-left-cssWidth:left,py=turned?2*pivot.y-top-cssHeight:top,sign=turned?-1:1;
    left+=sign*(Math.round(px*dpr)/dpr-px);top+=sign*(Math.round(py*dpr)/dpr-py);
    const br=box.getBoundingClientRect();box.style.transform=`translate(${left-br.left}px, ${top-br.top}px)`;if(!viewport){canvas.style.width=cssWidth+'px';canvas.style.height=cssHeight+'px';}canvas.style.transform='none';}
   if(!raf)raf=win.requestAnimationFrame(()=>{raf=0;render(false);});
   if(layoutOnly)return;
   if(viewport){
    const hr=rotation?.physicalRect?rotation.physicalRect(host):host.getBoundingClientRect(),br=box.getBoundingClientRect();
    let clip={left:Math.max(0,hr.left+(host.clientLeft||0)),top:Math.max(0,hr.top+(host.clientTop||0)),right:Math.min(win.innerWidth||Infinity,hr.left+(host.clientLeft||0)+host.clientWidth),bottom:Math.min(win.innerHeight||Infinity,hr.top+(host.clientTop||0)+host.clientHeight)};
    if(turned)clip={left:2*pivot.x-clip.right,top:2*pivot.y-clip.bottom,right:2*pivot.x-clip.left,bottom:2*pivot.y-clip.top};
    const regions=viewportTiles(W,H,quality,{left:br.left,top:br.top,dpr},clip),frame=regions.length?o.captureBits?.():null,overlay=regions.length?captureOverlayFrame():null;
    visibleTiles=[];
    for(let i=0;i<regions.length;i++){
     const region=regions[i];let tile=screen[i];
     if(!tile){tile=doc.createElement('canvas');tile.className='may-rombo-tile';tile.setAttribute('aria-hidden','true');box.append(tile);screen.push(tile);rotation?.register?.(tile);}
     Object.assign(tile.style,{display:'block',position:'absolute',margin:'0',left:region.x/dpr+'px',top:region.y/dpr+'px',width:region.width/dpr+'px',height:region.height/dpr+'px',pointerEvents:i?'none':'auto',imageRendering:'pixelated'});
     if(tile.width!==region.width)tile.width=region.width;if(tile.height!==region.height)tile.height=region.height;
     paint(tile.getContext('2d'),frame,current,quality,unit,region,overlay);visibleTiles.push(tile);
    }
    for(let i=regions.length;i<screen.length;i++){screen[i].style.display='none';if(screen[i].width!==1)screen[i].width=1;if(screen[i].height!==1)screen[i].height=1;images.delete(screen[i].getContext('2d'));}
    return;
   }
   visibleTiles=[canvas];
   if(canvas.width!==cw)canvas.width=cw;if(canvas.height!==ch)canvas.height=ch;
   const ctx=canvas.getContext('2d'),frame=precision()?o.captureBits?.():(o.capture?.()||source);paint(ctx,frame,current,quality,unit);
  }
  function paint(ctx,frame,p,quality,displayUnit,region=null,overlayFrame){
   if(precision()){
    const size=region?exactSize(region.width,region.height,1):exactSize(p.outputWidth,p.outputHeight,quality);let cache=images.get(ctx);
    if(!cache||cache.base.width!==size.width||cache.base.height!==size.height){cache={base:ctx.createImageData(size.width,size.height)};images.set(ctx,cache);}
    const revision=o.revision?.(),regionKey=region?[region.x,region.y].join(':'):'full',same=revision!==undefined&&cache.revision===revision&&cache.plan===p&&cache.quality===quality&&cache.source===frame?.data&&cache.regionKey===regionKey;
    if(!same){rasterPixels(p,frame,quality,{data:cache.base.data,region});cache.revision=revision;cache.plan=p;cache.quality=quality;cache.source=frame.data;cache.regionKey=regionKey;cache.overlayReady=false;}
    ctx.setTransform(1,0,0,1,0,0);ctx.putImageData(cache.base,0,0);
    const overlay=overlayFrame===undefined?captureOverlayFrame():overlayFrame;
    if(overlay){
     if(!cache.overlay){cache.overlay=ctx.createImageData(size.width,size.height);cache.canvas=doc.createElement('canvas');cache.canvas.width=size.width;cache.canvas.height=size.height;}
     const unchanged=cache.overlayReady&&cache.overlaySource===overlay;
     if(!unchanged){rasterPixels(p,overlay,quality,{data:cache.overlay.data,transparent:true,region});cache.canvas.getContext('2d').putImageData(cache.overlay,0,0);cache.overlaySource=overlay;cache.overlayReady=true;}
     ctx.imageSmoothingEnabled=false;ctx.drawImage(cache.canvas,0,0);
    }
   }else draw(ctx,frame,p,quality,quality<Math.max(frame.width/p.width,frame.height/p.height));
   const ox=region?.x||0,oy=region?.y||0;
   ctx.setTransform(quality,0,0,quality,-ox,-oy);o.paintOverlay?.(ctx,p,quality,displayUnit,region);
   if(p.axis){const a=p.forward(p.axis[0]),b=p.forward(p.axis[1]);ctx.strokeStyle='#ffd35b';ctx.lineWidth=1/Math.max(.02,displayUnit);ctx.setLineDash?.([5/displayUnit,3/displayUnit]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash?.([]);}
   o.paintCentres?.(ctx,p,quality,displayUnit,region);
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
   if(!get().on||!current||events.has(event)||!(event.target===canvas||viewportMode()&&event.target===box||drag))return;
   if(event.type==='click'&&suppressClick){suppressClick=false;event.preventDefault();event.stopImmediatePropagation();return;}
   if(event.type==='pointerdown')suppressClick=false;
   const r=(viewportMode()?box:canvas).getBoundingClientRect(),p={x:(event.clientX-r.left)/unit,y:(event.clientY-r.top)/unit};let distance=Infinity;
   if(current.axis){const a=current.forward(current.axis[0]),b=current.forward(current.axis[1]),dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));distance=Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)*unit;}
   events.set(event,{x:event.clientX,y:event.clientY});
   if(event.type==='pointerdown'&&event.button===0&&distance<=7){drag={id:event.pointerId,x:event.clientX,y:event.clientY,row:get().row,unit,angle:get().angle*Math.PI/180};canvas.setPointerCapture?.(event.pointerId);event.preventDefault();event.stopImmediatePropagation();return;}
   if(drag&&event.pointerId===drag.id){if(event.type==='pointermove'){const delta=(-(event.clientX-drag.x)*Math.sin(drag.angle)+(event.clientY-drag.y)*Math.cos(drag.angle))/drag.unit;api.setRow(drag.row+delta);}if(event.type==='pointerup'||event.type==='pointercancel'){drag=null;suppressClick=true;}event.preventDefault();event.stopImmediatePropagation();return;}
   if(event.type==='pointermove')canvas.style.cursor=distance<=7?'ns-resize':'crosshair';
   const q=current.pick(p);if(!q){event.preventDefault();event.stopImmediatePropagation();return;}const sr=source.getBoundingClientRect();for(const [k,v]of Object.entries({clientX:sr.left+q.x*unit,clientY:sr.top+q.y*unit,x:sr.left+q.x*unit,y:sr.top+q.y*unit}))Object.defineProperty(event,k,{configurable:true,value:v});
  }
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','mousedown','mousemove','mouseup','click','dblclick','contextmenu','wheel'])win.addEventListener(type,input,{capture:true,passive:false});
  const permit=patch=>!o.allowState||o.allowState({...o.state(),...patch})!==false;
  const api={get,options:()=>variants.map(v=>{const item={...v,...availability(v.id,geometry(),get().row)},next={romboMode:'fixed',romboAssembly:v.id};if(item.available&&!permit(next)){item.available=false;item.reason=o.stateReason?.(next)||'Сборка несовместима с точной сеткой.';}return item;}),plan:makePlan,render,screenTiles:()=>visibleTiles.slice(),physicalPoint:event=>events.get(event),capture,setSeam(value){const seam=seamMode(value);if(seam===get().seam||!permit({romboSeam:seam}))return;o.state().romboSeam=seam;notify();},setMode(value){const mode=value==='custom'?'custom':'fixed';if(!permit({romboMode:mode}))return;o.state().romboMode=mode;notify();},set(value){if(!permit({edgeRhombOn:!!value}))return;o.state().edgeRhombOn=!!value;notify();},setRow(value){const s=o.state(),n=Math.max(1,Math.min(get().maxRow,Math.round(Number(value)||1)));if(s.romboRow===n||!permit({romboRow:n}))return;s.romboRow=n;notify();},cycleAngle(dir=1){const angle=(get().angle+(dir<0?315:45))%360;if(!permit({romboAngle:angle}))return;o.state().romboAngle=angle;notify();},setAssembly(id){const n=normalise(id);if(!availability(n,geometry(),get().row).available||!permit({romboMode:'fixed',romboAssembly:n}))return;o.state().romboMode='fixed';o.state().romboAssembly=n;notify();}};return api;
 }
 return {plan,customPlan,point,inverse,draw,rasterPixels,viewportTiles,mount,variants,normalise};
});
