/* Four existing masks in integer XYZ space; camera never changes the model. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.XorAxesSpace=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const NAMES=['I','II','III','IV'],COLORS=['#efad62','#79c5e7','#bb9ce6','#95cf89'];
 const DIRECTIONS={'+X':[1,0,0],'-X':[-1,0,0],'+Y':[0,1,0],'-Y':[0,-1,0],'+Z':[0,0,1],'-Z':[0,0,-1]};
 const AXIS_CYCLE=['+X','+Y','+Z','-X','-Y','-Z'];
 const AUTO=['-Y','-X','+Y','+X'],RAYS=[[0,1,0],[1,0,0],[0,-1,0],[-1,0,0]];
 const DEFAULT_CAMERA={yaw:-.56,pitch:.38,zoom:1};
 const AXIS_COLORS=['#dd8178','#96bd79','#80b4e8'];
 const key=p=>p.join(','),add=(a,b)=>a.map((v,i)=>v+b[i]),scale=(a,s)=>a.map(v=>v*s);
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const int=n=>Number.isFinite(Number(n))?Math.round(Number(n)):0;
 const quarter=n=>((int(n)%4)+4)%4;
 const offsetOf=s=>[0,1,2].map(i=>int(s&&s.offset&&s.offset[i]));
 const defaultAssignments=()=>Array.from({length:4},()=>({direction:'auto',roll:0,offset:[0,0,0]}));
 const normalizeAssignments=values=>Array.from({length:4},(_,i)=>{const s=values&&values[i];return {direction:s&&Object.prototype.hasOwnProperty.call(DIRECTIONS,s.direction)?s.direction:'auto',roll:quarter(s&&s.roll),offset:offsetOf(s)};});
 const normalizeSymmetry=value=>({enabled:!!(value&&value.enabled),distance:Math.max(0,int(value&&value.distance)),rays:Array.from({length:4},(_,i)=>value&&value.rays&&Object.prototype.hasOwnProperty.call(DIRECTIONS,value.rays[i])?value.rays[i]:AUTO[i])});
 function axisDragSteps(delta,vector){const n=vector[0]**2+vector[1]**2;return n>.01?int((delta[0]*vector[0]+delta[1]*vector[1])/n):0;}
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
   const anchor=add(add(scale(explicit?DIRECTIONS[direction]:RAYS[slot],radius),[int(off.x),-int(off.y),0]),offsetOf(setting));
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
  const occupancy=[...hits.values()],overlaps=occupancy.filter(v=>v.members.length>1);
  return {cells,centres,figures,occupancy,overlaps,mode,selected:source.selected,temporal:false};
 }
 function orientFigure(snapshot,assignments,id,action){
  const next=Array.from({length:4},(_,i)=>({...assignments[i],offset:offsetOf(assignments[i])}));
  const before=buildModel(snapshot,assignments).figures[id],setting=next[id];
  if(action==='roll')setting.roll=quarter(before.roll+1);
  else if(action==='cycle')setting.direction=AXIS_CYCLE[(AXIS_CYCLE.indexOf(before.direction)+1)%6];
  else if(action==='flip'){
   const right=orientation(before.direction,before.roll).right;setting.direction=(before.direction[0]==='+'?'-':'+')+before.direction[1];
   setting.roll=[0,1,2,3].find(roll=>key(orientation(setting.direction,roll).right)===key(right));
  }else if(action==='auto'||DIRECTIONS[action])setting.direction=action;
  const after=buildModel(snapshot,next).figures[id];
  setting.offset=setting.offset.map((v,i)=>v+before.anchor[i]-after.anchor[i]);
  return next;
 }
 function alignAnchors(snapshot,assignments,anchors){
  const next=normalizeAssignments(assignments),model=buildModel(snapshot,next);
  for(let id=0;id<4;id++)next[id].offset=next[id].offset.map((v,i)=>v+int(anchors[id][i])-model.figures[id].anchor[i]);
  return next;
 }
 function symmetricAssignments(snapshot,assignments,symmetry){
  const state=normalizeSymmetry(symmetry);
  return state.enabled?alignAnchors(snapshot,assignments,state.rays.map(ray=>scale(DIRECTIONS[ray],state.distance))):normalizeAssignments(assignments);
 }
 function isEndVoxel(figure,p){
  const down=DIRECTIONS[figure.direction],along=q=>q.reduce((sum,v,i)=>sum+(v-figure.anchor[i])*down[i],0);
  const values=[0,...figure.cells.map(along)],value=along(p);
  return value===Math.min(...values)||value===Math.max(...values);
 }
 function project(model,plane){
  const indices=plane==='XZ'?[0,2]:plane==='YZ'?[1,2]:[0,1],cells=new Map(),centres=new Map(),columns=new Map();
  for(const voxel of model.cells){
   const p=indices.map(i=>voxel.p[i]),k=key(p),old=cells.get(k);
   if(old){old.depth++;for(const id of voxel.members)if(!old.members.includes(id))old.members.push(id);}
   else cells.set(k,{p,members:voxel.members.slice(),depth:1});
  }
  for(const centre of model.centres){const p=indices.map(i=>centre.p[i]);centres.set(key(p),{p,id:centre.id});}
  for(const voxel of model.occupancy||model.cells){
   const p=indices.map(i=>voxel.p[i]),k=key(p);let column=columns.get(k);
   if(!column){column={p,depth:0,voxelCount:0,collisionCount:0,maxMultiplicity:0,members:[]};columns.set(k,column);}
   column.depth++;column.voxelCount+=voxel.members.length;column.maxMultiplicity=Math.max(column.maxMultiplicity,voxel.members.length);if(voxel.members.length>1)column.collisionCount++;
   for(const id of voxel.members)if(!column.members.includes(id))column.members.push(id);
  }
  return {cells:[...cells.values()],centres:[...centres.values()],overlaps:[...columns.values()].filter(c=>c.collisionCount||c.depth>1),axes:indices.map(i=>'XYZ'[i])};
 }
 function cameraPoint(p,camera){
  const cy=Math.cos(camera.yaw),sy=Math.sin(camera.yaw),cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch);
  const x=cy*p[0]+sy*p[2],z=-sy*p[0]+cy*p[2];
  return [x,cp*p[1]-sp*z,sp*p[1]+cp*z];
 }
 function mount(container,initialSnapshot,options={}){
  if(!container||!container.ownerDocument)throw new TypeError('A DOM container is required');
  const doc=container.ownerDocument;
  let assignments=defaultAssignments();
  if(options.assignments)assignments=normalizeAssignments(options.assignments);
  else try{const saved=JSON.parse(localStorage.getItem('zerk_xor_space')||'null');if(Array.isArray(saved)&&saved.length===4)assignments=normalizeAssignments(saved);}catch(_){}
  let symmetry=normalizeSymmetry(options.symmetry);
  if(!options.capture&&!options.symmetry)try{symmetry=normalizeSymmetry(JSON.parse(localStorage.getItem('zerk_xor_space_symmetry')||'null'));}catch(_){}
  let snapshot=initialSnapshot||{},model=buildModel(snapshot,assignments),camera={...DEFAULT_CAMERA,...options.camera},drag=null,destroyed=false,selected=Number.isInteger(options.selected)?options.selected:0;
  let hitFaces=[],handles=[],view=null,bodyClick=null;
  const host=doc.createElement('div');host.className='xor-space';
  host.innerHTML='<div class="xs-heading"><h2>3D / ось Z</h2><div class="xs-actions"><button class="gz-hx xs-reset" type="button" title="Сбросить направления и сдвиги всех четырёх фигур в исходное 2D-состояние" aria-label="Вернуть все фигуры в 2D">< 2D</button><button class="gz-hx xs-camera" type="button" title="Сбросить только положение камеры" aria-label="Сбросить камеру">+ Видъ</button></div></div><p class="xs-explain">Те же четыре фигуры. +Z - к нам, -Z - за экран. Выберите фигуру на поле или кнопкой I-IV, затем тяните её стрелку X, Y или Z. Числа - сдвиг в клетках от положения на основном поле. R меняет плоскость.</p><div class="xs-controls" role="group" aria-label="Направления и сдвиги четырёх фигур"></div><p class="xs-status" role="status"></p><div class="xs-stage"><canvas class="xs-main" role="img" aria-label="Объём четырёх фигур: выберите фигуру, тяните стрелку оси для перемещения; пустое место вращает камеру" tabindex="0"></canvas><span class="xs-camera-note">Стрелка оси - сдвиг / пустое место - камера / колесо - масштаб / Shift + <- -> / ^ v / PageUp PageDown - X / Y / Z</span></div><div class="xs-projections"></div><p class="xs-explain xs-bottom">XOR считается в одинаковых (X, Y, Z). Серые центры вне XOR. Проекции показывают занятые клетки по глубине, без повторного XOR. Режим наложения и рисунки берутся с основного поля.</p>';
  container.appendChild(host);
  host.querySelector('.xs-camera-note').append(' / 2x по фигуре - 90o вокруг своей оси; 2x по крайнему кубику - переворот 180o; ПКМ - +X -> +Y -> +Z -> -X -> -Y -> -Z');
  const overlapNote=doc.createElement('p');overlapNote.className='xs-explain xs-overlap-note';overlapNote.innerHTML='<span class="xs-collision-key"># XYZ</span> - кубики разных фигур в одном месте, даже если XOR их убрал; <span class="xs-depth-key">o Глубина</span> - кубики на разных глубинах одной клетки проекции. Число в крупной клетке - всего исходных кубиков.';host.querySelector('.xs-projections').after(overlapNote);
  const controls=host.querySelector('.xs-controls'),main=host.querySelector('.xs-main'),status=host.querySelector('.xs-status');
  const symmetryControls=doc.createElement('div');symmetryControls.className='xs-symmetry';symmetryControls.setAttribute('role','group');symmetryControls.setAttribute('aria-label','Общий центр и симметричное перемещение');
  symmetryControls.innerHTML='<button class="gz-hx xs-center" type="button" title="Совместить четыре серых центра в начале координат и включить симметричное перемещение">+ В центръ</button><button class="gz-hx xs-symmetric" type="button" title="Включить симметричный разнос от центра или снять ограничение, сохранив положения"><> Симметр</button><label class="xs-distance-label">R <input class="xs-distance" type="number" min="0" step="1" value="0" aria-label="Общий разнос серых центров в клетках"></label><span class="xs-symmetry-rays"></span>';
  controls.before(symmetryControls);
  const distanceInput=symmetryControls.querySelector('.xs-distance'),symmetryButton=symmetryControls.querySelector('.xs-symmetric'),raysLabel=symmetryControls.querySelector('.xs-symmetry-rays');
  function centreFigures(){symmetry={enabled:true,distance:0,rays:model.figures.map(f=>f.direction)};bodyClick=null;refresh(true,'symmetry');}
  function setDistance(value,save=true){if(!symmetry.enabled)return;symmetry.distance=Math.max(0,int(value));refresh(save,'translation');}
  symmetryControls.querySelector('.xs-center').addEventListener('click',centreFigures);
  symmetryButton.addEventListener('click',()=>{if(symmetry.enabled){symmetry.enabled=false;refresh(true,'symmetry');}else centreFigures();});
  distanceInput.addEventListener('input',()=>{if(distanceInput.value!==''&&Number.isFinite(distanceInput.valueAsNumber))setDistance(distanceInput.valueAsNumber);});distanceInput.addEventListener('change',()=>{distanceInput.value=String(symmetry.distance);});
  const selects=[],rollButtons=[],pickButtons=[],offsetInputs=[];
  for(let id=0;id<4;id++){
   const row=doc.createElement('div');row.className='xs-figure';row.style.setProperty('--xs-figure-color',COLORS[id]);
   const label=doc.createElement('label');label.textContent=NAMES[id]+' / ';
   const select=doc.createElement('select');select.setAttribute('aria-label','Ось фигуры '+NAMES[id]);select.dataset.figure=String(id);
   for(const [value,text] of [['auto','2D авто'],['+X','+X вправо'],['-X','-X влево'],['+Y','+Y вверх'],['-Y','-Y вниз'],['+Z','+Z к нам'],['-Z','-Z за экран']]){const option=doc.createElement('option');option.value=value;option.textContent=text;select.appendChild(option);}
   select.value=assignments[id].direction;label.appendChild(select);row.appendChild(label);
   const roll=doc.createElement('button');roll.type='button';roll.className='gz-hx xs-roll';roll.setAttribute('aria-label','Повернуть плоскость фигуры '+NAMES[id]+' вокруг выбранной оси на 90 градусов');roll.title='Поворот плоскости вокруг продольной оси фигуры';row.appendChild(roll);controls.appendChild(row);
   const shift=doc.createElement('div');shift.className='xs-shift';row.appendChild(shift);
   const pick=doc.createElement('button');pick.type='button';pick.className='gz-hx xs-pick';pick.textContent='> '+NAMES[id];pick.setAttribute('aria-label','Выбрать фигуру '+NAMES[id]+' для перемещения');pick.title='Выбрать фигуру '+NAMES[id]+' и перемещать её стрелками X, Y, Z';pick.addEventListener('click',()=>choose(id));shift.appendChild(pick);pickButtons.push(pick);
   const inputs=[];
   for(let axis=0;axis<3;axis++){
    const label=doc.createElement('label');label.className='xs-offset-label';label.textContent='XYZ'[axis];label.style.color=AXIS_COLORS[axis];
    const input=doc.createElement('input');input.type='number';input.step='1';input.value=String(assignments[id].offset[axis]);input.dataset.figure=String(id);input.dataset.axis='XYZ'[axis];input.setAttribute('aria-label','Сдвиг фигуры '+NAMES[id]+' по '+ 'XYZ'[axis]+' в клетках');
    input.addEventListener('focus',()=>choose(id));input.addEventListener('input',()=>{if(!symmetry.enabled&&input.value!==''&&Number.isFinite(input.valueAsNumber)){assignments[id].offset[axis]=int(input.valueAsNumber);refresh(true);}});input.addEventListener('change',()=>{input.value=String(assignments[id].offset[axis]);});label.appendChild(input);shift.appendChild(label);inputs.push(input);
   }
   offsetInputs.push(inputs);
   select.addEventListener('change',()=>reorient(id,select.value));
   roll.addEventListener('click',()=>reorient(id,'roll'));
   selects.push(select);rollButtons.push(roll);
  }
  const projections=['XY','XZ','YZ'].map(plane=>{
   const figure=doc.createElement('figure');figure.className='xs-projection';
   const caption=doc.createElement('figcaption');caption.textContent=plane+' / '+plane[0]+' -> / '+plane[1]+' ^';
   const canvas=doc.createElement('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Ортографическая проекция '+plane);canvas.dataset.plane=plane;
   figure.append(caption,canvas);host.querySelector('.xs-projections').appendChild(figure);return {plane,canvas};
  });
  function prepare(canvas){
   const width=Math.max(1,Math.round(canvas.getBoundingClientRect().width)),height=canvas===main?Math.round(Math.min(560,Math.max(280,width*.58))):width;
   const dpr=Math.min(2,window.devicePixelRatio||1),w=Math.round(width*dpr),h=Math.round(height*dpr);
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
   const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.fillStyle='#131619';ctx.fillRect(0,0,width,height);
   return {ctx,width,height};
  }
  function extent(){let e=14;for(const f of model.figures)if(f.active)for(const p of [f.anchor,...f.cells])for(const v of p)e=Math.max(e,Math.abs(v)+1);return e;}
  function color(members){return members.length===1?COLORS[members[0]]:'#eee6d8';}
  const faceDefs=[{n:[1,0,0],v:[[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1]],shade:.78},{n:[-1,0,0],v:[[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,-1,-1]],shade:.7},{n:[0,1,0],v:[[-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1]],shade:1},{n:[0,-1,0],v:[[-1,-1,1],[-1,-1,-1],[1,-1,-1],[1,-1,1]],shade:.64},{n:[0,0,1],v:[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],shade:.9},{n:[0,0,-1],v:[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]],shade:.75}];
  function draw3D(){
   const {ctx,width,height}=prepare(main),unit=drag&&drag.kind==='axis'?drag.unit:Math.min(width,height)/(extent()*3.1)*camera.zoom;
   const screen=p=>{const q=cameraPoint(p,camera);return [width/2+q[0]*unit,height/2-q[1]*unit,q[2]];};
   view={unit,screen};
   const origin=screen([0,0,0]),axisLength=Math.max(6,extent()*.95);
   ctx.lineWidth=1;ctx.font='12px "AzBuk Thin", monospace';
   for(const [axis,vector,tint] of [['X',[1,0,0],'#dd8178'],['Y',[0,1,0],'#96bd79'],['Z',[0,0,1],'#80b4e8']]){
    const end=screen(scale(vector,axisLength)),back=screen(scale(vector,-axisLength));
    ctx.strokeStyle=tint;ctx.globalAlpha=.7;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(back[0],back[1]);ctx.lineTo(origin[0],origin[1]);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(origin[0],origin[1]);ctx.lineTo(end[0],end[1]);ctx.stroke();ctx.globalAlpha=1;ctx.fillStyle=tint;
    ctx.fillText('+'+axis+(axis==='Z'?' к нам':''),end[0]+5,end[1]-5);ctx.fillText('-'+axis+(axis==='Z'?' за экран':''),back[0]+5,back[1]-5);
   }
   const voxels=model.cells.map(v=>({p:v.p,color:color(v.members),members:v.members,selected:v.members.includes(selected)}));
   const uniqueCentres=new Map(model.centres.map(c=>[key(c.p),c]));
   for(const c of uniqueCentres.values())voxels.push({p:c.p,color:'#858c8c',neutral:true,members:model.centres.filter(other=>key(other.p)===key(c.p)).map(other=>other.id)});
   const occupied=new Set(voxels.map(v=>key(v.p))),faces=[];
   for(const voxel of voxels)for(const face of faceDefs){
    if(cameraPoint(face.n,camera)[2]<=0||occupied.has(key(add(voxel.p,face.n))))continue;
    const vertices=face.v.map(v=>screen(add(voxel.p,scale(v,.5))));
    faces.push({vertices,depth:vertices.reduce((n,v)=>n+v[2],0)/4,voxel,shade:face.shade});
   }
   faces.sort((a,b)=>a.depth-b.depth);
   hitFaces=faces;
   for(const face of faces){
    ctx.beginPath();face.vertices.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=face.voxel.color;ctx.fill();ctx.fillStyle='rgba(0,0,0,'+(1-face.shade)+')';ctx.fill();ctx.strokeStyle=face.voxel.selected?'#fff6b0':'#121519';ctx.lineWidth=face.voxel.selected?1.1:.45;ctx.stroke();
   }
   drawHandles(ctx,screen,unit,width,height);
  }
  function drawHandles(ctx,screen,unit,width,height){
   handles=[];const figure=model.figures[selected];if(!figure||!figure.active)return;
   const origin=screen(figure.anchor);ctx.font='12px "AzBuk Thin", monospace';ctx.lineWidth=2;
   ctx.fillStyle=COLORS[selected];ctx.fillText(NAMES[selected],origin[0]+7,origin[1]+17);
   for(let axis=0;axis<3;axis++){
    const ray=symmetry.enabled?DIRECTIONS[symmetry.rays[selected]]:null;if(ray&&!ray[axis])continue;
    const basis=[0,0,0];basis[axis]=ray?ray[axis]:1;const p=screen(add(figure.anchor,basis)),vector=[p[0]-origin[0],p[1]-origin[1]],length=Math.hypot(...vector);
    if(length<unit*.12)continue; // Looking directly down this axis: numeric/keyboard movement stays available.
    const u=vector.map(v=>v/length),limits=u.map((v,i)=>Math.abs(v)<.001?72:((v>0?(i===0?width:height)-18:18)-origin[i])/v),handleLength=Math.max(24,Math.min(72,...limits));
    const end=[origin[0]+u[0]*handleLength,origin[1]+u[1]*handleLength];
    handles.push({axis,origin:origin.slice(0,2),end,vector,symmetric:!!ray});
    ctx.strokeStyle='#131619';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(origin[0],origin[1]);ctx.lineTo(...end);ctx.stroke();
    ctx.strokeStyle=AXIS_COLORS[axis];ctx.lineWidth=2;ctx.stroke();ctx.fillStyle=AXIS_COLORS[axis];ctx.beginPath();ctx.moveTo(...end);ctx.lineTo(end[0]-u[0]*11-u[1]*5,end[1]-u[1]*11+u[0]*5);ctx.lineTo(end[0]-u[0]*11+u[1]*5,end[1]-u[1]*11-u[0]*5);ctx.closePath();ctx.fill();ctx.fillText(ray?'R':'XYZ'[axis],end[0]+u[0]*12-4,end[1]+u[1]*12+4);
   }
  }
  function choose(id){selected=id;refresh(false);}
  function reorient(id,action){selected=id;assignments=orientFigure(snapshot,assignments,id,action);bodyClick=null;refresh(true,'orientation');}
  function pointInFace(p,vertices){let inside=false;for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){const a=vertices[i],b=vertices[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
  function hitHandle(p){
   let best=null,distance=12;
   for(const h of handles){const dx=h.end[0]-h.origin[0],dy=h.end[1]-h.origin[1],t=((p[0]-h.origin[0])*dx+(p[1]-h.origin[1])*dy)/(dx*dx+dy*dy);if(t<.2||t>1.16)continue;const d=Math.hypot(p[0]-h.origin[0]-dx*Math.min(1,t),p[1]-h.origin[1]-dy*Math.min(1,t));if(d<distance){distance=d;best=h;}}
   return best;
  }
  function hitVoxel(p){for(let i=hitFaces.length-1;i>=0;i--)if(pointInFace(p,hitFaces[i].vertices)){const voxel=hitFaces[i].voxel,ids=voxel.members;return {id:ids.includes(selected)?selected:ids[0],p:voxel.p.slice()};}return null;}
  function hitFigure(p){const hit=hitVoxel(p);return hit?hit.id:null;}
  function drawProjection(canvas,plane){
   const {ctx,width,height}=prepare(canvas),projection=project(model,plane),e=extent(),unit=(width-28)/(e*2+1);
   const xy=p=>[width/2+p[0]*unit,height/2-p[1]*unit];
   ctx.strokeStyle='#343b42';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(14,height/2);ctx.lineTo(width-14,height/2);ctx.moveTo(width/2,14);ctx.lineTo(width/2,height-14);ctx.stroke();
   for(const cell of projection.cells){const p=xy(cell.p);ctx.fillStyle=color(cell.members);ctx.fillRect(p[0]-unit/2,p[1]-unit/2,Math.max(.7,unit-.25),Math.max(.7,unit-.25));}
   for(const centre of projection.centres){const p=xy(centre.p);ctx.fillStyle='#858c8c';ctx.fillRect(p[0]-unit/2,p[1]-unit/2,unit,unit);}
   for(const overlap of projection.overlaps){
    const p=xy(overlap.p),size=Math.max(1,unit-.25),left=p[0]-unit/2,top=p[1]-unit/2;
    if(overlap.collisionCount){ctx.fillStyle='rgba(255,102,87,.68)';ctx.fillRect(left,top,size,size);ctx.strokeStyle='#ffb5a3';ctx.lineWidth=Math.min(1.3,unit/4);ctx.beginPath();ctx.moveTo(left,top+size);ctx.lineTo(left+size,top);ctx.stroke();}
    if(overlap.depth>1){ctx.strokeStyle='#66dcff';ctx.lineWidth=Math.min(1.5,unit/3);ctx.strokeRect(left+.3,top+.3,Math.max(.4,size-.6),Math.max(.4,size-.6));}
    if(unit>=12){ctx.fillStyle='#fff';ctx.font=Math.min(12,Math.floor(unit*.7))+'px "AzBuk Thin",monospace';ctx.textAlign='center';ctx.fillText(String(overlap.voxelCount),p[0],p[1]+Math.min(4,unit*.25));ctx.textAlign='left';}
   }
   ctx.font='12px "AzBuk Thin", monospace';ctx.fillStyle='#b4bac0';ctx.fillText('+'+projection.axes[0],width-25,height/2-5);ctx.fillText('+'+projection.axes[1],width/2+5,14);
   canvas.dataset.cells=String(projection.cells.length);
   const collisions=projection.overlaps.filter(c=>c.collisionCount).length,depths=projection.overlaps.filter(c=>c.depth>1).length;
   canvas.dataset.collisions=String(collisions);canvas.dataset.depthOverlaps=String(depths);
   canvas.previousElementSibling.textContent=plane+' / '+plane[0]+' -> / '+plane[1]+' ^ / XYZ: '+collisions+' / глубина: '+depths;
  }
  function draw(){if(destroyed)return;draw3D();for(const p of projections)drawProjection(p.canvas,p.plane);}
  function refresh(save,reason='translation'){
   if(symmetry.enabled)assignments=symmetricAssignments(snapshot,assignments,symmetry);
   model=buildModel(snapshot,assignments);
   for(let i=0;i<4;i++){selects[i].value=assignments[i].direction;rollButtons[i].textContent='R '+assignments[i].roll*90+'o';rollButtons[i].setAttribute('aria-pressed',String(assignments[i].roll!==0));pickButtons[i].setAttribute('aria-pressed',String(i===selected));for(let axis=0;axis<3;axis++){offsetInputs[i][axis].disabled=symmetry.enabled;if(doc.activeElement!==offsetInputs[i][axis])offsetInputs[i][axis].value=String(assignments[i].offset[axis]);}}
   symmetryButton.setAttribute('aria-pressed',String(symmetry.enabled));distanceInput.disabled=!symmetry.enabled;if(doc.activeElement!==distanceInput)distanceInput.value=String(symmetry.distance);raysLabel.textContent=symmetry.enabled?'Общий разнос / '+symmetry.rays.map((ray,i)=>NAMES[i]+': '+ray).join(' / '):'В центр - совместить серые кубики. Симметр - снять ограничение.';
   const mode=model.mode==='xor'?'XOR':model.mode==='solo'?'Одна':'Вместе';
   const depths=model.cells.map(c=>c.p[2]),min=depths.length?Math.min(...depths):0,max=depths.length?Math.max(...depths):0;
   status.textContent=mode+' / '+model.cells.length+' клеток в XYZ / Z: '+min+' ... '+max+' / '+(symmetry.enabled?'Общий разнос R: '+symmetry.distance:NAMES[selected]+': сдвиг '+assignments[selected].offset.join(', '));
   host.dataset.cells=String(model.cells.length);host.dataset.depth=min+','+max;
   if(save&&!options.capture)try{localStorage.setItem('zerk_xor_space',JSON.stringify(assignments));localStorage.setItem('zerk_xor_space_symmetry',JSON.stringify(symmetry));}catch(_){}
   draw();
   if(save)host.dispatchEvent(new CustomEvent('xor-space-change',{bubbles:true,detail:{reason}}));
  }
  host.querySelector('.xs-reset').addEventListener('click',()=>{assignments=defaultAssignments();symmetry=normalizeSymmetry(null);refresh(true,'reset');});
  host.querySelector('.xs-camera').addEventListener('click',()=>{camera={...DEFAULT_CAMERA};draw();});
  const local=e=>{const rect=main.getBoundingClientRect();return [e.clientX-rect.left,e.clientY-rect.top];};
  main.addEventListener('pointerdown',e=>{
   if(e.button!==0)return;e.preventDefault();main.focus({preventScroll:true});const p=local(e),h=hitHandle(p),hit=hitVoxel(p);
   if(h||hit)host.dispatchEvent(new CustomEvent('xor-space-change',{bubbles:true,detail:{reason:'interaction'}}));
   const repeat=bodyClick&&hit&&bodyClick.id===hit.id&&e.timeStamp-bodyClick.time<600&&Math.hypot(p[0]-bodyClick.point[0],p[1]-bodyClick.point[1])<6;
   if(hit&&(!h||repeat)){bodyClick={id:hit.id,point:p,time:e.timeStamp};choose(hit.id);return;}
   bodyClick=null;
   if(h)drag={kind:'axis',id:e.pointerId,x:e.clientX,y:e.clientY,figure:selected,axis:h.axis,vector:h.vector.slice(),offset:assignments[selected].offset.slice(),unit:view.unit,symmetric:h.symmetric,distance:symmetry.distance};
   else drag={kind:'camera',id:e.pointerId,x:e.clientX,y:e.clientY};
   main.setPointerCapture(e.pointerId);main.classList.add('xs-dragging');
  });
  main.addEventListener('dblclick',e=>{
   if(e.button!==0||drag||!bodyClick)return;const p=local(e),hit=hitVoxel(p);
   if(!hit||hit.id!==bodyClick.id||e.timeStamp-bodyClick.time>600||Math.hypot(p[0]-bodyClick.point[0],p[1]-bodyClick.point[1])>=6)return;
   e.preventDefault();reorient(hit.id,isEndVoxel(model.figures[hit.id],hit.p)?'flip':'roll');
  });
  main.addEventListener('contextmenu',e=>{e.preventDefault();if(drag)return;const hit=hitVoxel(local(e));if(hit)reorient(hit.id,'cycle');});
  main.addEventListener('pointermove',e=>{
   if(!drag){const p=local(e);main.style.cursor=hitHandle(p)?'move':hitFigure(p)!==null?'pointer':'';return;}if(drag.id!==e.pointerId)return;
   if(drag.kind==='axis'){const delta=axisDragSteps([e.clientX-drag.x,e.clientY-drag.y],drag.vector);if(drag.symmetric){const next=Math.max(0,drag.distance+delta);if(next!==symmetry.distance)setDistance(next,false);}else{const next=drag.offset[drag.axis]+delta;if(next!==assignments[drag.figure].offset[drag.axis]){assignments[drag.figure].offset[drag.axis]=next;refresh(false);}}return;}
   camera.yaw+=(e.clientX-drag.x)*.009;camera.pitch=Math.max(-1.5,Math.min(1.5,camera.pitch+(e.clientY-drag.y)*.009));drag.x=e.clientX;drag.y=e.clientY;draw();
  });
  const endDrag=e=>{if(!drag||e&&e.pointerId!==drag.id)return;const moved=drag.kind==='axis';drag=null;main.classList.remove('xs-dragging');if(moved)refresh(true);};
  main.addEventListener('pointerup',endDrag);main.addEventListener('pointercancel',endDrag);main.addEventListener('lostpointercapture',endDrag);
  main.addEventListener('wheel',e=>{e.preventDefault();if(drag)return;camera.zoom=Math.max(.25,Math.min(4,camera.zoom*Math.exp(-e.deltaY*.001)));draw();},{passive:false});
  main.addEventListener('keydown',e=>{
   if(e.shiftKey&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','PageUp','PageDown'].includes(e.key)){e.preventDefault();const axis=e.key.startsWith('Page')?2:['ArrowLeft','ArrowRight'].includes(e.key)?0:1,step=['ArrowRight','ArrowUp','PageUp'].includes(e.key)?1:-1;if(symmetry.enabled)setDistance(symmetry.distance+step);else{assignments[selected].offset[axis]+=step;refresh(true);}return;}
   if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','0'].includes(e.key))return;e.preventDefault();
   if(e.key==='0')camera={...DEFAULT_CAMERA};else if(e.key==='ArrowLeft')camera.yaw-=.12;else if(e.key==='ArrowRight')camera.yaw+=.12;else if(e.key==='ArrowUp')camera.pitch=Math.max(-1.5,camera.pitch-.12);else if(e.key==='ArrowDown')camera.pitch=Math.min(1.5,camera.pitch+.12);else camera.zoom=Math.max(.25,Math.min(4,camera.zoom*(e.key==='-'?.9:1.1)));draw();
  });
  const resize=!options.capture&&typeof ResizeObserver==='function'?new ResizeObserver(draw):null;if(resize)resize.observe(host);else if(!options.capture)window.addEventListener('resize',draw);
  function createCapture(captureOptions={}){
   const frozen=JSON.parse(JSON.stringify(captureOptions.source||snapshot));
   const layoutWidth=host.getBoundingClientRect().width,width=Math.max(1,Math.round(layoutWidth));
   const box=doc.createElement('div');box.setAttribute('aria-hidden','true');box.style.cssText='position:fixed;left:-100000px;top:0;pointer-events:none;width:'+layoutWidth+'px;';doc.body.appendChild(box);
   const captureView=mount(box,frozen,{capture:true,assignments:JSON.parse(JSON.stringify(assignments)),camera:{...camera},selected,symmetry:JSON.parse(JSON.stringify(symmetry))});
   const captureHost=box.querySelector('.xor-space');captureHost.style.margin='0';captureHost.style.padding='0';captureHost.style.border='0';
   const mainCanvas=box.querySelector('.xs-main'),projectionCanvases=[...box.querySelectorAll('.xs-projection canvas')];
   // Use the same canvas renderers, current width and camera; controls are not in the movie.
   captureView.setAssignments(assignments);
   const mainHeight=Math.round(mainCanvas.getBoundingClientRect().height),gap=12,caption=40,header=32,footer=38;
   const projectionTop=header+mainHeight+gap+caption,projectHeight=Math.max(...projectionCanvases.map(c=>Math.round(c.getBoundingClientRect().height)));
   const height=projectionTop+projectHeight+footer,output=doc.createElement('canvas');output.width=width;output.height=height;
   const mainRect=mainCanvas.getBoundingClientRect(),hostRect=captureHost.getBoundingClientRect();
   const parts=[{name:'3D',x:Math.round(mainRect.left-hostRect.left),y:header,width:Math.round(mainRect.width),height:mainHeight},...projectionCanvases.map(c=>{const r=c.getBoundingClientRect(),h=captureHost.getBoundingClientRect();return {name:c.dataset.plane,x:Math.round(r.left-h.left),y:projectionTop,width:Math.round(r.width),height:Math.round(r.height)};})];
   let disposed=false;
   function render(next,label=''){
    if(disposed)throw new Error('Capture renderer is closed');captureView.setAssignments(next);
    const ctx=output.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#131619';ctx.fillRect(0,0,width,height);ctx.fillStyle='#eee6d8';ctx.font='bold 12px ui-monospace,monospace';ctx.textBaseline='top';ctx.fillText('3D / XY / XZ / YZ',8,8);
    ctx.textAlign='right';ctx.fillText(String(label),width-8,8);ctx.textAlign='left';
    const canvases=[mainCanvas,...projectionCanvases];for(let i=0;i<parts.length;i++){const p=parts[i];ctx.drawImage(canvases[i],p.x,p.y,p.width,p.height);}
    for(let i=0;i<projectionCanvases.length;i++){
     const c=projectionCanvases[i],p=parts[i+1];ctx.font='12px "AzBuk Thin", monospace';ctx.fillStyle='#b4bac0';ctx.fillText(p.name,p.x+3,projectionTop-caption+3);ctx.font='12px "AzBuk Thin", monospace';
     ctx.fillText('XYZ: '+c.dataset.collisions,p.x+3,projectionTop-caption+17);ctx.fillText('Глубина: '+c.dataset.depthOverlaps,p.x+3,projectionTop-caption+28);
    }
    ctx.font='12px "AzBuk Thin", monospace';ctx.fillStyle='#ffb5a3';ctx.fillText('# XYZ - совпадение кубиков',8,height-footer+7);ctx.fillStyle='#66dcff';ctx.fillText('o Глубина - перекрытие в проекции',8,height-footer+21);
    return output;
   }
   return {width,height,parts:parts.map(p=>({...p})),render,destroy(){if(disposed)return;disposed=true;captureView.destroy();box.remove();}};
  }
  refresh(false);
  return {createCapture,update(next){snapshot=next||{};refresh(false);host.dispatchEvent(new CustomEvent('xor-space-change',{bubbles:true,detail:{reason:'source'}}));},getSnapshot(){return JSON.parse(JSON.stringify(snapshot));},setAssignments(next,{save=false}={}){assignments=normalizeAssignments(next);refresh(save,'sequence');},getModel(){return buildModel(snapshot,assignments);},getState(){return {assignments:assignments.map(a=>({...a,offset:a.offset.slice()})),camera:{...camera},selected,symmetry:JSON.parse(JSON.stringify(symmetry))};},destroy(){destroyed=true;if(resize)resize.disconnect();else window.removeEventListener('resize',draw);host.remove();}};
 }
 return {mount,buildModel,project,orientation,cameraPoint,axisDragSteps,orientFigure,isEndVoxel,alignAnchors,symmetricAssignments};
});
