/* Four existing masks in integer XYZ space; camera never changes the model. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.XorAxesSpace=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const NAMES=['I','II','III','IV'],COLORS=['#efad62','#79c5e7','#bb9ce6','#95cf89'];
 const DIRECTIONS={'+X':[1,0,0],'-X':[-1,0,0],'+Y':[0,1,0],'-Y':[0,-1,0],'+Z':[0,0,1],'-Z':[0,0,-1]};
 const AUTO=['-Y','-X','+Y','+X'],RAYS=[[0,1,0],[1,0,0],[0,-1,0],[-1,0,0]];
 const DEFAULT_CAMERA={yaw:-.56,pitch:.38,zoom:1};
 const key=p=>p.join(','),add=(a,b)=>a.map((v,i)=>v+b[i]),scale=(a,s)=>a.map(v=>v*s);
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const int=n=>Number.isFinite(Number(n))?Math.round(Number(n)):0;
 const quarter=n=>((int(n)%4)+4)%4;
 function orientation(direction,roll=0){
  const down=DIRECTIONS[direction]||DIRECTIONS['-Y'];
  let right=direction==='+Y'?[-1,0,0]:direction==='-X'?[0,-1,0]:direction==='+X'?[0,1,0]:[1,0,0];
  for(let i=0;i<quarter(roll);i++)right=cross(down,right);
  return {right,down};
 }
 function buildModel(snapshot,assignments=[]){
  const source=snapshot||{},order=source.order||[0,1,2,3],turn=source.turn||[0,0,0,0];
  const hits=new Map(),centres=[],figures=[];
  const radius=int(source.radius),mode=source.mode||'xor';
  for(let id=0;id<4;id++){
   const setting=assignments[id]||{},explicit=Object.prototype.hasOwnProperty.call(DIRECTIONS,setting.direction);
   const direction=explicit?setting.direction:AUTO[quarter(turn[id])];
   const basis=orientation(direction,setting.roll),slot=Math.max(0,order.indexOf(id));
   const off=(source.offsets||[])[id]||{};
   const anchor=add(scale(explicit?DIRECTIONS[direction]:RAYS[slot],radius),[int(off.x),-int(off.y),0]);
   const cells=[],seen=new Set();
   const active=mode!=='solo'||id===source.selected;
   for(const point of (source.points||[])[id]||[]){
    const x=int(point[0]),y=int(point[1]);if(x===0&&y===0)continue;
    const p=add(anchor,add(scale(basis.right,x),scale(basis.down,y))),k=key(p);
    if(seen.has(k))continue;seen.add(k);cells.push(p);
    if(active){const hit=hits.get(k);if(hit)hit.members.push(id);else hits.set(k,{p,members:[id]});}
   }
   figures.push({id,direction,roll:quarter(setting.roll),anchor,cells,active});
   if(active)centres.push({p:anchor,id});
  }
  const neutral=new Set(centres.map(c=>key(c.p))),cells=[];
  for(const [k,hit] of hits)if(!neutral.has(k)&&(mode!=='xor'||hit.members.length%2))cells.push(hit);
  if(source.previous&&mode==='xor'){
   const previous=buildModel({...source.previous,previous:null},assignments),difference=new Map(cells.map(c=>[key(c.p),c]));
   for(const cell of previous.cells){const k=key(cell.p);if(neutral.has(k))continue;if(difference.has(k))difference.delete(k);else difference.set(k,cell);}
   return {cells:[...difference.values()],centres,figures,mode,selected:source.selected,temporal:true};
  }
  return {cells,centres,figures,mode,selected:source.selected,temporal:false};
 }
 function project(model,plane){
  const indices=plane==='XZ'?[0,2]:plane==='YZ'?[1,2]:[0,1],cells=new Map(),centres=new Map();
  for(const voxel of model.cells){
   const p=indices.map(i=>voxel.p[i]),k=key(p),old=cells.get(k);
   if(old){old.depth++;for(const id of voxel.members)if(!old.members.includes(id))old.members.push(id);}
   else cells.set(k,{p,members:voxel.members.slice(),depth:1});
  }
  for(const centre of model.centres){const p=indices.map(i=>centre.p[i]);centres.set(key(p),{p,id:centre.id});}
  return {cells:[...cells.values()],centres:[...centres.values()],axes:indices.map(i=>'XYZ'[i])};
 }
 function cameraPoint(p,camera){
  const cy=Math.cos(camera.yaw),sy=Math.sin(camera.yaw),cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch);
  const x=cy*p[0]+sy*p[2],z=-sy*p[0]+cy*p[2];
  return [x,cp*p[1]-sp*z,sp*p[1]+cp*z];
 }
 function mount(container,initialSnapshot){
  if(!container||!container.ownerDocument)throw new TypeError('A DOM container is required');
  const doc=container.ownerDocument;
  let assignments=Array.from({length:4},()=>({direction:'auto',roll:0}));
  try{const saved=JSON.parse(localStorage.getItem('zerk_xor_space')||'null');if(Array.isArray(saved)&&saved.length===4)assignments=saved.map(s=>({direction:s&&DIRECTIONS[s.direction]?s.direction:'auto',roll:quarter(s&&s.roll)}));}catch(_){}
  let snapshot=initialSnapshot||{},model=buildModel(snapshot,assignments),camera={...DEFAULT_CAMERA},drag=null,destroyed=false;
  const host=doc.createElement('div');host.className='xor-space';
  host.innerHTML='<div class="xs-heading"><h2>3D · ось Z</h2><div class="xs-actions"><button class="gz-hx xs-reset" type="button" title="Вернуть направления всех четырёх фигур в исходное 2D-состояние" aria-label="Вернуть все фигуры в 2D">↶ 2D</button><button class="gz-hx xs-camera" type="button" title="Сбросить только положение камеры" aria-label="Сбросить камеру">⊙ Видъ</button></div></div><p class="xs-explain">Те же четыре фигуры. +Z — к нам, −Z — за экран. Серые центры вне XOR. 2D следует поворотам; выбранная ось фиксирует направление. ↻ меняет плоскость.</p><div class="xs-controls" role="group" aria-label="Направления четырёх фигур"></div><p class="xs-status" role="status"></p><div class="xs-stage"><canvas class="xs-main" role="img" aria-label="Объём четырёх фигур: тяните для вращения камеры, колесо для масштаба" tabindex="0"></canvas><span class="xs-camera-note">Тянуть — вращать · колесо — масштаб · стрелки / + − с клавиатуры</span></div><div class="xs-projections"></div><p class="xs-explain xs-bottom">XOR считается в одинаковых (X, Y, Z). Проекции показывают занятые клетки по глубине, без повторного XOR. Режим наложения и рисунки берутся с основного поля.</p>';
  container.appendChild(host);
  const controls=host.querySelector('.xs-controls'),main=host.querySelector('.xs-main'),status=host.querySelector('.xs-status');
  const selects=[],rollButtons=[];
  for(let id=0;id<4;id++){
   const row=doc.createElement('div');row.className='xs-figure';row.style.setProperty('--xs-figure-color',COLORS[id]);
   const label=doc.createElement('label');label.textContent=NAMES[id]+' · ';
   const select=doc.createElement('select');select.setAttribute('aria-label','Ось фигуры '+NAMES[id]);select.dataset.figure=String(id);
   for(const [value,text] of [['auto','2D · автоматически'],['+X','+X · вправо'],['-X','−X · влево'],['+Y','+Y · вверх'],['-Y','−Y · вниз'],['+Z','+Z · к нам'],['-Z','−Z · за экран']]){const option=doc.createElement('option');option.value=value;option.textContent=text;select.appendChild(option);}
   select.value=assignments[id].direction;label.appendChild(select);row.appendChild(label);
   const roll=doc.createElement('button');roll.type='button';roll.className='gz-hx xs-roll';roll.setAttribute('aria-label','Повернуть плоскость фигуры '+NAMES[id]+' вокруг выбранной оси на 90 градусов');roll.title='Поворот плоскости вокруг продольной оси фигуры';row.appendChild(roll);controls.appendChild(row);
   select.addEventListener('change',()=>{assignments[id].direction=select.value;refresh(true);});
   roll.addEventListener('click',()=>{assignments[id].roll=(assignments[id].roll+1)%4;refresh(true);});
   selects.push(select);rollButtons.push(roll);
  }
  const projections=['XY','XZ','YZ'].map(plane=>{
   const figure=doc.createElement('figure');figure.className='xs-projection';
   const caption=doc.createElement('figcaption');caption.textContent=plane+' · '+plane[0]+' → / '+plane[1]+' ↑';
   const canvas=doc.createElement('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Ортографическая проекция '+plane);canvas.dataset.plane=plane;
   figure.append(caption,canvas);host.querySelector('.xs-projections').appendChild(figure);return {plane,canvas};
  });
  function prepare(canvas){
   const width=Math.max(1,Math.round(canvas.getBoundingClientRect().width)),height=canvas===main?Math.round(Math.min(560,Math.max(280,width*.58))):width;
   const dpr=Math.min(2,window.devicePixelRatio||1),w=Math.round(width*dpr),h=Math.round(height*dpr);
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
   const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.fillStyle='#131619';ctx.fillRect(0,0,width,height);
   return {ctx,width,height};
  }
  function extent(){let e=14;for(const f of model.figures)if(f.active)for(const p of [f.anchor,...f.cells])for(const v of p)e=Math.max(e,Math.abs(v)+1);return e;}
  function color(members){return members.length===1?COLORS[members[0]]:'#eee6d8';}
  const faceDefs=[{n:[1,0,0],v:[[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1]],shade:.78},{n:[-1,0,0],v:[[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,-1,-1]],shade:.7},{n:[0,1,0],v:[[-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1]],shade:1},{n:[0,-1,0],v:[[-1,-1,1],[-1,-1,-1],[1,-1,-1],[1,-1,1]],shade:.64},{n:[0,0,1],v:[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],shade:.9},{n:[0,0,-1],v:[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]],shade:.75}];
  function draw3D(){
   const {ctx,width,height}=prepare(main),unit=Math.min(width,height)/(extent()*3.1)*camera.zoom;
   const screen=p=>{const q=cameraPoint(p,camera);return [width/2+q[0]*unit,height/2-q[1]*unit,q[2]];};
   const origin=screen([0,0,0]),axisLength=Math.max(6,extent()*.95);
   ctx.lineWidth=1;ctx.font='12px ui-monospace, monospace';
   for(const [axis,vector,tint] of [['X',[1,0,0],'#dd8178'],['Y',[0,1,0],'#96bd79'],['Z',[0,0,1],'#80b4e8']]){
    const end=screen(scale(vector,axisLength)),back=screen(scale(vector,-axisLength));
    ctx.strokeStyle=tint;ctx.globalAlpha=.7;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(back[0],back[1]);ctx.lineTo(origin[0],origin[1]);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(origin[0],origin[1]);ctx.lineTo(end[0],end[1]);ctx.stroke();ctx.globalAlpha=1;ctx.fillStyle=tint;
    ctx.fillText('+'+axis+(axis==='Z'?' к нам':''),end[0]+5,end[1]-5);ctx.fillText('−'+axis+(axis==='Z'?' за экран':''),back[0]+5,back[1]-5);
   }
   const voxels=model.cells.map(v=>({p:v.p,color:color(v.members),selected:v.members.includes(snapshot.selected)}));
   const uniqueCentres=new Map(model.centres.map(c=>[key(c.p),c]));
   for(const c of uniqueCentres.values())voxels.push({p:c.p,color:'#858c8c',neutral:true});
   const occupied=new Set(voxels.map(v=>key(v.p))),faces=[];
   for(const voxel of voxels)for(const face of faceDefs){
    if(cameraPoint(face.n,camera)[2]<=0||occupied.has(key(add(voxel.p,face.n))))continue;
    const vertices=face.v.map(v=>screen(add(voxel.p,scale(v,.5))));
    faces.push({vertices,depth:vertices.reduce((n,v)=>n+v[2],0)/4,voxel,shade:face.shade});
   }
   faces.sort((a,b)=>a.depth-b.depth);
   for(const face of faces){
    ctx.beginPath();face.vertices.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=face.voxel.color;ctx.fill();ctx.fillStyle='rgba(0,0,0,'+(1-face.shade)+')';ctx.fill();ctx.strokeStyle=face.voxel.selected?'#fff6b0':'#121519';ctx.lineWidth=face.voxel.selected?1.1:.45;ctx.stroke();
   }
  }
  function drawProjection(canvas,plane){
   const {ctx,width,height}=prepare(canvas),projection=project(model,plane),e=extent(),unit=(width-28)/(e*2+1);
   const xy=p=>[width/2+p[0]*unit,height/2-p[1]*unit];
   ctx.strokeStyle='#343b42';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(14,height/2);ctx.lineTo(width-14,height/2);ctx.moveTo(width/2,14);ctx.lineTo(width/2,height-14);ctx.stroke();
   for(const cell of projection.cells){const p=xy(cell.p);ctx.fillStyle=color(cell.members);ctx.fillRect(p[0]-unit/2,p[1]-unit/2,Math.max(.7,unit-.25),Math.max(.7,unit-.25));}
   for(const centre of projection.centres){const p=xy(centre.p);ctx.fillStyle='#858c8c';ctx.fillRect(p[0]-unit/2,p[1]-unit/2,unit,unit);}
   ctx.font='11px ui-monospace, monospace';ctx.fillStyle='#b4bac0';ctx.fillText('+'+projection.axes[0],width-25,height/2-5);ctx.fillText('+'+projection.axes[1],width/2+5,14);
   canvas.dataset.cells=String(projection.cells.length);
  }
  function draw(){if(destroyed)return;draw3D();for(const p of projections)drawProjection(p.canvas,p.plane);}
  function refresh(save){
   model=buildModel(snapshot,assignments);
   for(let i=0;i<4;i++){selects[i].value=assignments[i].direction;rollButtons[i].textContent='↻ '+assignments[i].roll*90+'°';rollButtons[i].setAttribute('aria-pressed',String(assignments[i].roll!==0));}
   const mode=model.mode==='xor'?'XOR':model.mode==='solo'?'Одна':'Вместе';
   const depths=model.cells.map(c=>c.p[2]),min=depths.length?Math.min(...depths):0,max=depths.length?Math.max(...depths):0;
   status.textContent=mode+(model.temporal?' · Δ кадра':'')+' · '+model.cells.length+' клеток в XYZ · Z: '+min+' … '+max;
   host.dataset.cells=String(model.cells.length);host.dataset.depth=min+','+max;
   if(save)try{localStorage.setItem('zerk_xor_space',JSON.stringify(assignments));}catch(_){}
   draw();
  }
  host.querySelector('.xs-reset').addEventListener('click',()=>{assignments=Array.from({length:4},()=>({direction:'auto',roll:0}));refresh(true);});
  host.querySelector('.xs-camera').addEventListener('click',()=>{camera={...DEFAULT_CAMERA};draw();});
  main.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};main.setPointerCapture(e.pointerId);main.classList.add('xs-dragging');});
  main.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;camera.yaw+=(e.clientX-drag.x)*.009;camera.pitch=Math.max(-1.5,Math.min(1.5,camera.pitch+(e.clientY-drag.y)*.009));drag.x=e.clientX;drag.y=e.clientY;draw();});
  const endDrag=()=>{drag=null;main.classList.remove('xs-dragging');};
  main.addEventListener('pointerup',endDrag);main.addEventListener('pointercancel',endDrag);main.addEventListener('lostpointercapture',endDrag);
  main.addEventListener('wheel',e=>{e.preventDefault();camera.zoom=Math.max(.25,Math.min(4,camera.zoom*Math.exp(-e.deltaY*.001)));draw();},{passive:false});
  main.addEventListener('keydown',e=>{
   if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','0'].includes(e.key))return;e.preventDefault();
   if(e.key==='0')camera={...DEFAULT_CAMERA};else if(e.key==='ArrowLeft')camera.yaw-=.12;else if(e.key==='ArrowRight')camera.yaw+=.12;else if(e.key==='ArrowUp')camera.pitch=Math.max(-1.5,camera.pitch-.12);else if(e.key==='ArrowDown')camera.pitch=Math.min(1.5,camera.pitch+.12);else camera.zoom=Math.max(.25,Math.min(4,camera.zoom*(e.key==='-'?.9:1.1)));draw();
  });
  const resize=typeof ResizeObserver==='function'?new ResizeObserver(draw):null;if(resize)resize.observe(host);else window.addEventListener('resize',draw);
  refresh(false);
  return {update(next){snapshot=next||{};refresh(false);},getModel(){return buildModel(snapshot,assignments);},getState(){return {assignments:assignments.map(a=>({...a})),camera:{...camera}};},destroy(){destroyed=true;if(resize)resize.disconnect();else window.removeEventListener('resize',draw);host.remove();}};
 }
 return {mount,buildModel,project,orientation,cameraPoint};
});
