/* Fold a displayed construction at a row, assemble its lower halves, then turn
 * the whole result. Source cells and work data remain in their native frame. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikRombo=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const point=(m,p)=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]});
 function inverse(m,p){const d=m[0]*m[3]-m[1]*m[2],x=p.x-m[4],y=p.y-m[5];return {x:(m[3]*x-m[2]*y)/d,y:(-m[1]*x+m[0]*y)/d};}
 function plan(width,height,state={}){
  const W=Math.max(1,width),H=Math.max(1,height),A=Math.max(1,Math.min(H,Math.round(state.row??H))),angle=((Math.round((Number(state.angle)||0)/45)*45)%360+360)%360,id=Math.max(0,Math.min(15,Math.trunc(state.assembly??1))),mid=Math.floor(W/2),parts=[{id:'top',label:'Верх',left:0,right:W,height:A,matrix:[1,0,0,1,0,0]}];
  for(let slot=0;slot<2;slot++){const choice=slot?id%4:Math.floor(id/4),right=choice%2===1,flip=choice>=2,left=right?mid:0,end=right?W:mid,sw=end-left,dest=slot?W-sw:0;if(!sw)continue;parts.push({id:'lower'+slot,label:(slot?'Низ справа: ':'Низ слева: ')+(right?'П':'Л')+(flip?' ↔':''),left,right:end,height:A,matrix:[flip?-1:1,0,0,-1,flip?dest+left+sw:dest-left,2*A]});}
  const radians=angle*Math.PI/180,c=Math.abs(Math.cos(radians))<1e-12?0:Math.cos(radians),s=Math.abs(Math.sin(radians))<1e-12?0:Math.sin(radians),cx=W/2,cy=A,rotation=[c,s,-s,c,cx-c*cx+s*cy,cy-s*cx-c*cy],corners=[[0,0],[W,0],[W,2*A],[0,2*A]].map(([x,y])=>point(rotation,{x,y})),minX=Math.min(...corners.map(p=>p.x)),minY=Math.min(...corners.map(p=>p.y)),maxX=Math.max(...corners.map(p=>p.x)),maxY=Math.max(...corners.map(p=>p.y));rotation[4]-=minX;rotation[5]-=minY;
  const result={width:W,height:H,row:A,angle,assembly:id,parts,rotation,outputWidth:maxX-minX,outputHeight:maxY-minY,forward:p=>point(rotation,p),unrotate:p=>inverse(rotation,p)};
  result.pick=p=>{const q=result.unrotate(p);for(let i=parts.length-1;i>=0;i--){const tile=parts[i],src=inverse(tile.matrix,q);if(src.x>=tile.left&&src.x<tile.right&&src.y>=0&&src.y<A)return {...src,part:tile.id};}return null;};return result;
 }
 function draw(ctx,source,p,ratio=1){
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#000';ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.imageSmoothingEnabled=false;
  const R=p.rotation;ctx.setTransform(R[0]*ratio,R[1]*ratio,R[2]*ratio,R[3]*ratio,R[4]*ratio,R[5]*ratio);
  for(const tile of p.parts){ctx.save();ctx.transform(...tile.matrix);ctx.beginPath();ctx.rect(tile.left,0,tile.right-tile.left,p.row);ctx.clip();ctx.drawImage(source,0,0,source.width,source.height,0,0,p.width,p.height);ctx.restore();}
 }
 function mount(o){
  const {host,source,box,canvas}=o,doc=host.ownerDocument,win=doc.defaultView,events=new WeakMap();let drag=null,suppressClick=false,current=null,unit=1,originalVisibility=source.style.visibility,raf=0,layoutKey='';
  const geometry=()=>o.geometry(),get=()=>{const s=o.state(),g=geometry();return {on:!!s.edgeRhombOn,row:Math.max(1,Math.min(g.height,Math.round(s.romboRow??g.height))),maxRow:Math.max(1,Math.round(g.height)),angle:((Number(s.romboAngle)||0)%360+360)%360,assembly:Math.max(0,Math.min(15,Math.trunc(s.romboAssembly??1)))};};
  const makePlan=()=>{const g=geometry();return plan(g.width,g.height,get());};
  function notify(){o.changed?.();win.dispatchEvent(new win.Event('may-rombo-change'));}
  function render(layoutOnly=false){
   const state=get();doc.body.classList.toggle('may-rombo-active',state.on);
   if(!state.on){if(raf)win.cancelAnimationFrame(raf);raf=0;layoutKey='';box.style.display='none';source.style.visibility=o.restoreVisibility?.()??originalVisibility;current=null;return;}
   if(!source.width||!source.height)return;current=makePlan();const r=source.getBoundingClientRect();unit=r.width/current.width;if(!(unit>0))return;
   const key=[r.left,r.top,r.width,r.height,current.row,current.angle,current.assembly,source.style.marginLeft,source.style.marginRight].join(':');
   if(key!==layoutKey){layoutKey=key;source.style.visibility='hidden';box.style.display='block';box.style.width=current.outputWidth*unit+'px';box.style.height=current.outputHeight*unit+'px';box.style.marginLeft=source.style.marginLeft||'auto';box.style.marginRight=source.style.marginRight||'auto';box.style.marginTop=-(r.height+(parseFloat(win.getComputedStyle(source).marginBottom)||0))+'px';box.style.transform='none';
    const br=box.getBoundingClientRect();box.style.transform=`translate(${r.left+(r.width-current.outputWidth*unit)/2-br.left}px, ${r.top-br.top}px)`;canvas.style.width=current.outputWidth*unit+'px';canvas.style.height=current.outputHeight*unit+'px';canvas.style.transform='none';}
   if(!raf)raf=win.requestAnimationFrame(()=>{raf=0;render(false);});
   if(layoutOnly)return;
   const quality=Math.min(source.width/current.width,Math.sqrt(16e6/(current.outputWidth*current.outputHeight)),16384/current.outputWidth,16384/current.outputHeight),cw=Math.max(1,Math.ceil(current.outputWidth*quality)),ch=Math.max(1,Math.ceil(current.outputHeight*quality));if(canvas.width!==cw)canvas.width=cw;if(canvas.height!==ch)canvas.height=ch;
   const ctx=canvas.getContext('2d'),frame=o.capture?.()||source;draw(ctx,frame,current,quality);ctx.setTransform(quality,0,0,quality,0,0);
   const a=current.forward({x:0,y:current.row}),b=current.forward({x:current.width,y:current.row});ctx.strokeStyle='#ffd35b';ctx.lineWidth=1/Math.max(.02,unit);ctx.setLineDash?.([5/unit,3/unit]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash?.([]);
   o.paintCentres?.(ctx,current,quality,unit);
  }
  function input(event){
   if(!get().on||!current||events.has(event)||!(event.target===canvas||drag))return;
   if(event.type==='click'&&suppressClick){suppressClick=false;event.preventDefault();event.stopImmediatePropagation();return;}
   if(event.type==='pointerdown')suppressClick=false;
   const r=canvas.getBoundingClientRect(),p={x:(event.clientX-r.left)/unit,y:(event.clientY-r.top)/unit},a=current.forward({x:0,y:current.row}),b=current.forward({x:current.width,y:current.row}),dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1))),distance=Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)*unit;
   events.set(event,{x:event.clientX,y:event.clientY});
   if(event.type==='pointerdown'&&event.button===0&&distance<=7){drag={id:event.pointerId,x:event.clientX,y:event.clientY,row:get().row,unit,angle:get().angle*Math.PI/180};canvas.setPointerCapture?.(event.pointerId);event.preventDefault();event.stopImmediatePropagation();return;}
   if(drag&&event.pointerId===drag.id){if(event.type==='pointermove'){const delta=(-(event.clientX-drag.x)*Math.sin(drag.angle)+(event.clientY-drag.y)*Math.cos(drag.angle))/drag.unit;api.setRow(drag.row+delta);}if(event.type==='pointerup'||event.type==='pointercancel'){drag=null;suppressClick=true;}event.preventDefault();event.stopImmediatePropagation();return;}
   if(event.type==='pointermove')canvas.style.cursor=distance<=7?'ns-resize':'crosshair';
   const q=current.pick(p);if(!q){event.preventDefault();event.stopImmediatePropagation();return;}const sr=source.getBoundingClientRect();for(const [k,v]of Object.entries({clientX:sr.left+q.x*unit,clientY:sr.top+q.y*unit,x:sr.left+q.x*unit,y:sr.top+q.y*unit}))Object.defineProperty(event,k,{configurable:true,value:v});
  }
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','mousedown','mousemove','mouseup','click','dblclick','contextmenu','wheel'])win.addEventListener(type,input,{capture:true,passive:false});
  const api={get,plan:makePlan,render,physicalPoint:event=>events.get(event),capture(){render(false);const c=doc.createElement('canvas');c.width=canvas.width;c.height=canvas.height;c.getContext('2d').drawImage(canvas,0,0);return c;},set(value){o.state().edgeRhombOn=!!value;notify();},setRow(value){const s=o.state(),n=Math.max(1,Math.min(get().maxRow,Math.round(Number(value)||1)));if(s.romboRow===n)return;s.romboRow=n;notify();},cycleAngle(dir=1){o.state().romboAngle=(get().angle+(dir<0?315:45))%360;notify();},setAssembly(id){o.state().romboAssembly=Math.max(0,Math.min(15,Math.trunc(Number(id)||0)));notify();}};return api;
 }
 return {plan,point,inverse,draw,mount};
});
