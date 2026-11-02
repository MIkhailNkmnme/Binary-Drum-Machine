/* Assemble the native central cone and two outer boundary cones, or exchange
 * the central diamond's quarters. One staircase mask drives draw and picking;
 * source bit addresses and work data remain in their native frame. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikRombo=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const point=(m,p)=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]});
 function inverse(m,p){const d=m[0]*m[3]-m[1]*m[2],x=p.x-m[4],y=p.y-m[5];return {x:(m[3]*x-m[2]*y)/d,y:(-m[1]*x+m[0]*y)/d};}
 const choiceNames=['L','R','L↔','R↔'];
 const variants=[...[1,3,4,6,9,11,12,14].map(id=>({id,kind:'sides',choices:[Math.floor(id/4),id%4],label:[Math.floor(id/4),id%4].map(i=>choiceNames[i]).join(' | ')})),{id:16,kind:'central',label:'C → 180° вниз'},{id:17,kind:'quarters',label:'Четверти 1↔3, 2↔4'}];
 const normalise=id=>variants.some(v=>v.id===Number(id))?Number(id):16;
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
  const W=Math.max(1,width),H=Math.max(1,height),A=Math.max(1,Math.min(H,Math.round(state.row??H))),angle=((Math.round((Number(state.angle)||0)/45)*45)%360+360)%360,id=normalise(state.assembly),status=availability(id,{width:W,height:H,...geometry},A),cx=(geometry.anchor??((W-1)/2))+.5,parts=[],colour={C:'#e5be68',L:'#78b8e8',R:'#d99bc9'};
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
  const radians=angle*Math.PI/180,c=Math.abs(Math.cos(radians))<1e-12?0:Math.cos(radians),s=Math.abs(Math.sin(radians))<1e-12?0:Math.sin(radians),rotation=[c,s,-s,c,0,0];let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const t of parts)for(const vertex of t.outline){const p=point(rotation,point(t.matrix,vertex));minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
  if(!parts.length){minX=minY=0;maxX=maxY=1;}rotation[4]=-minX;rotation[5]=-minY;
  const result={...status,width:W,height:H,row:A,angle,assembly:id,parts,rotation,axis:[{x:C.left,y:A},{x:C.right,y:A}],outputWidth:maxX-minX,outputHeight:maxY-minY,forward:p=>point(rotation,p),unrotate:p=>inverse(rotation,p)};
  const snap=value=>Math.abs(value*2-Math.round(value*2))<1e-9?Math.round(value*2)/2:value;
  result.pick=p=>{const q=result.unrotate(p);for(let i=parts.length-1;i>=0;i--){const tile=parts[i],src=inverse(tile.matrix,q);src.x=snap(src.x);src.y=snap(src.y);if(tile.contains(src.x,src.y))return {...src,part:tile.id,sourceKey:tile.sourceKey};}return null;};return result;
 }
 function draw(ctx,source,p,ratio=1){
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#000';ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.imageSmoothingEnabled=false;
  const R=p.rotation;ctx.setTransform(R[0]*ratio,R[1]*ratio,R[2]*ratio,R[3]*ratio,R[4]*ratio,R[5]*ratio);
  for(const tile of p.parts){ctx.save();ctx.transform(...tile.matrix);ctx.beginPath();tile.outline.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();ctx.drawImage(source,0,0,source.width,source.height,0,0,p.width,p.height);ctx.restore();}
 }
 function mount(o){
  const {host,source,box,canvas}=o,doc=host.ownerDocument,win=doc.defaultView,events=new WeakMap();let drag=null,suppressClick=false,current=null,unit=1,originalVisibility=source.style.visibility,raf=0,layoutKey='',stateKey='';
  const geometry=()=>o.geometry(),get=()=>{const s=o.state(),g=geometry(),assembly=normalise(s.romboAssembly),row=Math.max(1,Math.min(g.height,Math.round(s.romboRow??g.height)));return {on:!!s.edgeRhombOn,row,maxRow:Math.max(1,Math.round(g.height)),angle:((Number(s.romboAngle)||0)%360+360)%360,assembly,...availability(assembly,g,row)};};
  let planKey='',plans=new Map();
  const makePlan=assembly=>{const g=geometry(),s=get(),id=normalise(assembly??s.assembly),key=[g.width,g.height,g.anchor,g.available,g.reason,g.sides,s.row,s.angle].join(':');if(key!==planKey){planKey=key;plans.clear();}if(!plans.has(id))plans.set(id,plan(g.width,g.height,{...s,assembly:id},g));return plans.get(id);};
  // Direct state restore/reset and geometry changes also pass through render.
  // Publish only an effective change, so the legend/menu need no frame polling.
  function publish(state=get()){const g=geometry(),key=[state.on,state.row,state.maxRow,state.angle,state.assembly,state.available,state.reason,g.width,g.anchor,g.sides].join(':');if(key===stateKey)return;stateKey=key;win.dispatchEvent(new win.Event('may-rombo-change'));}
  function notify(){o.changed?.();publish();}
  function render(layoutOnly=false){
   const state=get();publish(state);doc.body.classList.toggle('may-rombo-active',state.on&&state.available);
   if(!state.on||!state.available){if(raf)win.cancelAnimationFrame(raf);raf=0;layoutKey='';box.style.display='none';source.style.visibility=o.restoreVisibility?.()??originalVisibility;current=null;return;}
   if(!source.width||!source.height)return;current=makePlan();const r=source.getBoundingClientRect();unit=r.width/current.width;if(!(unit>0))return;
   const key=[r.left,r.top,r.width,r.height,current.row,current.angle,current.assembly,current.outputWidth,current.outputHeight,source.style.marginLeft,source.style.marginRight].join(':');
   if(key!==layoutKey){layoutKey=key;source.style.visibility='hidden';box.style.display='block';box.style.width=current.outputWidth*unit+'px';box.style.height=current.outputHeight*unit+'px';box.style.marginLeft=source.style.marginLeft||'auto';box.style.marginRight=source.style.marginRight||'auto';box.style.marginTop=-(r.height+(parseFloat(win.getComputedStyle(source).marginBottom)||0))+'px';box.style.transform='none';
    const br=box.getBoundingClientRect();box.style.transform=`translate(${r.left+(r.width-current.outputWidth*unit)/2-br.left}px, ${r.top-br.top}px)`;canvas.style.width=current.outputWidth*unit+'px';canvas.style.height=current.outputHeight*unit+'px';canvas.style.transform='none';}
   if(!raf)raf=win.requestAnimationFrame(()=>{raf=0;render(false);});
   if(layoutOnly)return;
   const quality=Math.min(Math.max(2,source.width/current.width),Math.sqrt(16e6/(current.outputWidth*current.outputHeight)),16384/current.outputWidth,16384/current.outputHeight),cw=Math.max(1,Math.ceil(current.outputWidth*quality)),ch=Math.max(1,Math.ceil(current.outputHeight*quality));if(canvas.width!==cw)canvas.width=cw;if(canvas.height!==ch)canvas.height=ch;
   const ctx=canvas.getContext('2d'),frame=o.capture?.()||source;draw(ctx,frame,current,quality);ctx.setTransform(quality,0,0,quality,0,0);
   const a=current.forward(current.axis[0]),b=current.forward(current.axis[1]);ctx.strokeStyle='#ffd35b';ctx.lineWidth=1/Math.max(.02,unit);ctx.setLineDash?.([5/unit,3/unit]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash?.([]);
   o.paintCentres?.(ctx,current,quality,unit);
  }
  function input(event){
   if(!get().on||!current||events.has(event)||!(event.target===canvas||drag))return;
   if(event.type==='click'&&suppressClick){suppressClick=false;event.preventDefault();event.stopImmediatePropagation();return;}
   if(event.type==='pointerdown')suppressClick=false;
   const r=canvas.getBoundingClientRect(),p={x:(event.clientX-r.left)/unit,y:(event.clientY-r.top)/unit},a=current.forward(current.axis[0]),b=current.forward(current.axis[1]),dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1))),distance=Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)*unit;
   events.set(event,{x:event.clientX,y:event.clientY});
   if(event.type==='pointerdown'&&event.button===0&&distance<=7){drag={id:event.pointerId,x:event.clientX,y:event.clientY,row:get().row,unit,angle:get().angle*Math.PI/180};canvas.setPointerCapture?.(event.pointerId);event.preventDefault();event.stopImmediatePropagation();return;}
   if(drag&&event.pointerId===drag.id){if(event.type==='pointermove'){const delta=(-(event.clientX-drag.x)*Math.sin(drag.angle)+(event.clientY-drag.y)*Math.cos(drag.angle))/drag.unit;api.setRow(drag.row+delta);}if(event.type==='pointerup'||event.type==='pointercancel'){drag=null;suppressClick=true;}event.preventDefault();event.stopImmediatePropagation();return;}
   if(event.type==='pointermove')canvas.style.cursor=distance<=7?'ns-resize':'crosshair';
   const q=current.pick(p);if(!q){event.preventDefault();event.stopImmediatePropagation();return;}const sr=source.getBoundingClientRect();for(const [k,v]of Object.entries({clientX:sr.left+q.x*unit,clientY:sr.top+q.y*unit,x:sr.left+q.x*unit,y:sr.top+q.y*unit}))Object.defineProperty(event,k,{configurable:true,value:v});
  }
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','mousedown','mousemove','mouseup','click','dblclick','contextmenu','wheel'])win.addEventListener(type,input,{capture:true,passive:false});
  const api={get,options:()=>variants.map(v=>({...v,...availability(v.id,geometry(),get().row)})),plan:makePlan,render,physicalPoint:event=>events.get(event),capture(){render(false);const c=doc.createElement('canvas'),frame=current?canvas:(o.capture?.()||source);c.width=frame.width;c.height=frame.height;c.getContext('2d').drawImage(frame,0,0);return c;},set(value){o.state().edgeRhombOn=!!value;notify();},setRow(value){const s=o.state(),n=Math.max(1,Math.min(get().maxRow,Math.round(Number(value)||1)));if(s.romboRow===n)return;s.romboRow=n;notify();},cycleAngle(dir=1){o.state().romboAngle=(get().angle+(dir<0?315:45))%360;notify();},setAssembly(id){const n=normalise(id);if(!availability(n,geometry(),get().row).available)return;o.state().romboAssembly=n;notify();}};return api;
 }
 return {plan,point,inverse,draw,mount,variants,normalise};
});
