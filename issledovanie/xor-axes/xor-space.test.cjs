'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {buildModel,project,orientation,cameraPoint,axisDragSteps,orientFigure,isEndVoxel,alignAnchors,symmetricAssignments}=require('./xor-space.js');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const masks=Function('return '+html.match(/const masks=(\[[\s\S]*?\n\]);/)[1])();
const points=masks.map(rows=>{const pivot=rows[0].indexOf('1');return rows.flatMap((row,y)=>[...row].flatMap((v,x)=>v==='1'?[[x-pivot,y]]:[]));});
const snapshot=(extra={})=>({points,order:[0,1,2,3],turn:[2,3,0,1],radius:0,offsets:Array.from({length:4},()=>({x:0,y:0})),mode:'xor',selected:null,...extra});
const keys=cells=>cells.map(c=>c.p.join(',')).sort();
function permutations(xs){return xs.length?xs.flatMap(x=>permutations(xs.filter(y=>x!==y)).map(t=>[x,...t])):[[]];}

test('all 6144 2D layouts retain original source XY parity and gray anchors',()=>{
 for(const order of permutations([0,1,2,3]))for(let turns=0;turns<256;turns++){
  const turn=[0,1,2,3].map(i=>(turns>>(i*2))&3),s=snapshot({order,turn,radius:turns%3-1});
  const hits=new Map(),neutral=new Set(),rays=[[0,-1],[1,0],[0,1],[-1,0]];
  order.forEach((id,slot)=>{
   const ax=rays[slot][0]*s.radius,ay=rays[slot][1]*s.radius;neutral.add([ax,-ay,0].join(','));
   for(let [x,y] of points[id]){if(x===0&&y===0)continue;for(let n=0;n<turn[id];n++)[x,y]=[-y,x];const k=[ax+x,-ay-y,0].join(',');hits.set(k,(hits.get(k)||0)+1);}
  });
  const expected=[...hits].filter(([k,n])=>n%2&&!neutral.has(k)).map(([k])=>k).sort();
  assert.deepEqual(keys(buildModel(s).cells),expected);
 }
});
test('all six directions and four rolls rigidly preserve every source mask',()=>{
 for(const direction of ['+X','-X','+Y','-Y','+Z','-Z'])for(let roll=0;roll<4;roll++){
  const b=orientation(direction,roll);assert.equal(b.right.reduce((n,v,i)=>n+v*b.down[i],0),0);
  const model=buildModel(snapshot({mode:'union'}),Array.from({length:4},()=>({direction,roll})));
  for(let id=0;id<4;id++){
   const source=points[id].filter(([x,y])=>x||y),target=model.figures[id].cells;
   assert.equal(source.length,target.length);
   for(let a=0;a<source.length;a++)for(let c=a+1;c<source.length;c++)assert.equal(source[a].reduce((n,v,i)=>n+(v-source[c][i])**2,0),target[a].reduce((n,v,i)=>n+(v-target[c][i])**2,0));
  }
 }
});
test('Z assignment moves actual voxels and radius pivot in depth; XY drag offsets remain',()=>{
 const s=snapshot({radius:3,offsets:[{x:2,y:1}],mode:'union'}),m=buildModel(s,[{direction:'+Z'}]);
 assert.deepEqual(m.figures[0].anchor,[2,-1,3]);assert(m.figures[0].cells.every(p=>p[2]>=4));
 assert.equal(m.figures.length,4);assert.deepEqual(s.points,points);
});
test('XOR removes only identical XYZ; two depths project by OR, not parity',()=>{
 const s=snapshot({points:[[[0,0],[0,1]],[[0,0],[0,1]],[],[]],turn:[0,0,0,0]});
 assert.equal(buildModel(s).cells.length,0);
 const m=buildModel(s,[{direction:'+Z'},{direction:'-Z'}]);assert.equal(m.cells.length,2);
 const xy=project(m,'XY');assert.equal(xy.cells.length,1);assert.equal(xy.cells[0].depth,2);
 for(const plane of ['XY','XZ','YZ']){
  const idx=plane==='XY'?[0,1]:plane==='XZ'?[0,2]:[1,2];
  assert.deepEqual(keys(project(m,plane).cells),[...new Set(m.cells.map(c=>idx.map(i=>c.p[i]).join(',')))].sort());
 }
});
test('mixed axes collide by true XOR and every gray pivot remains neutral',()=>{
 const s=snapshot({points:[[[0,0],[1,1],[0,1]],[[0,0],[1,1],[0,1]],[],[]],turn:[0,0,0,0]});
 const m=buildModel(s,[{direction:'+Z'},{direction:'+X',roll:1}]);
 const neutral=new Set(m.centres.map(c=>c.p.join(',')));assert(m.cells.every(c=>!neutral.has(c.p.join(','))));
 const union=buildModel({...s,mode:'union'},[{direction:'+Z'},{direction:'+X',roll:1}]);
 assert.equal(union.cells.length,3);assert.equal(m.cells.length,2);assert(!keys(m.cells).includes('1,0,1'));
 const cap=buildModel(snapshot({points:[[[0,0],[0,1]],[[0,0]],[],[]],turn:[0,0,0,0],offsets:[{}, {x:0,y:1}]}));
 assert.equal(cap.cells.length,0);assert(cap.centres.some(c=>c.p.join(',')==='0,-1,0'));
});
test('camera rotation is rigid; previous frames cannot change the selected spatial operation',()=>{
 const s=snapshot(),before=buildModel(s,[{direction:'+Z'}]),p=[3,4,5],q=cameraPoint(p,{yaw:.7,pitch:-.6,zoom:2});
 assert(Math.abs(q.reduce((n,v)=>n+v*v,0)-50)<1e-10);assert.deepEqual(buildModel(s,[{direction:'+Z'}]),before);
 assert.deepEqual(buildModel({...s,previous:s},[{direction:'+Z'}]),before);
 const next=snapshot({turn:[2,2,0,1],previous:s}),model=buildModel(next,[{direction:'+Z'}]);
 assert.deepEqual(model,buildModel({...next,previous:null},[{direction:'+Z'}]));
});

test('independent XYZ translations preserve every oriented mask and follow each projection',()=>{
 for(const direction of ['+X','-X','+Y','-Y','+Z','-Z'])for(let roll=0;roll<4;roll++)for(let id=0;id<4;id++){
  const assignments=Array.from({length:4},()=>({direction,roll})),s=snapshot({mode:'union',radius:3,offsets:[{x:2,y:4}]}),before=buildModel(s,assignments);
  assignments[id].offset=[-4,7,3];const after=buildModel(s,assignments);
  for(let f=0;f<4;f++){
   const delta=f===id?[-4,7,3]:[0,0,0];
   assert.deepEqual(after.figures[f].anchor,before.figures[f].anchor.map((v,i)=>v+delta[i]));
   assert.deepEqual(after.figures[f].cells,before.figures[f].cells.map(p=>p.map((v,i)=>v+delta[i])));
  }
  for(const plane of ['XY','XZ','YZ']){const idx=plane==='XY'?[0,1]:plane==='XZ'?[0,2]:[1,2];assert.deepEqual(keys(project(after,plane).cells),[...new Set(after.cells.map(c=>idx.map(i=>c.p[i]).join(',')))].sort());}
 }
 const s=snapshot({points:[[[0,0],[0,1]],[[0,0],[0,1]],[],[]],turn:[0,0,0,0]});
 assert.equal(buildModel(s).cells.length,0);assert.equal(buildModel(s,[{offset:[0,0,1]}]).cells.length,2);
 assert.deepEqual(buildModel(s,[{offset:[2.7,-4.2,NaN]}]).figures[0].anchor,[3,-4,0]);
 for(const v of [[8,0],[-3,7],[.2,-6]]){assert.equal(axisDragSteps(v.map(n=>n*4),v),4);assert.equal(axisDragSteps(v.map(n=>n*-3),v),-3);assert.equal(axisDragSteps([-v[1]*9,v[0]*9],v),0);}
 assert.equal(axisDragSteps([100,20],[0,0]),0);
});

test('own-axis roll, six-axis cycle and end-for-end flip preserve world pivots and rigid masks',()=>{
 const cycle=['+X','+Y','+Z','-X','-Y','-Z'];
 for(const direction of ['auto',...cycle])for(let roll=0;roll<4;roll++)for(let id=0;id<4;id++){
  const s=snapshot({mode:'union',radius:3,offsets:[{x:2,y:-3},{x:-1,y:2}],order:[3,1,0,2]}),settings=Array.from({length:4},()=>({direction,roll,offset:[3,-2,5]})),before=buildModel(s,settings);
  for(const action of ['roll','cycle','flip']){
   const next=orientFigure(s,settings,id,action),after=buildModel(s,next),a=before.figures[id],b=after.figures[id];
   assert.deepEqual(b.anchor,a.anchor,action+' keeps nonzero-radius pivot');for(let j=0;j<4;j++)if(j!==id)assert.deepEqual(after.figures[j],before.figures[j]);
   assert.equal(b.cells.length,a.cells.length);
   if(action==='cycle')assert.equal(b.direction,cycle[(cycle.indexOf(a.direction)+1)%6]);
   if(action==='flip'){
    const right=orientation(a.direction,a.roll).right;
    assert.deepEqual(b.cells,a.cells.map(p=>{const v=p.map((n,i)=>n-a.anchor[i]),dot=v.reduce((sum,n,i)=>sum+n*right[i],0);return v.map((n,i)=>a.anchor[i]+2*dot*right[i]-n);}));
    assert.deepEqual(buildModel(s,orientFigure(s,next,id,'flip')).figures[id].cells,a.cells);
   }
   if(action==='roll'){
    const down=orientation(a.direction,a.roll).down,cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    assert.deepEqual(b.cells,a.cells.map(p=>{const v=p.map((n,i)=>n-a.anchor[i]),dot=v.reduce((sum,n,i)=>sum+n*down[i],0),c=cross(down,v);return c.map((n,i)=>a.anchor[i]+n+dot*down[i]);}));
   }
   for(let i=0;i<a.cells.length;i++)assert.equal(a.cells[i].reduce((sum,n,k)=>sum+(n-a.anchor[k])**2,0),b.cells[i].reduce((sum,n,k)=>sum+(n-b.anchor[k])**2,0));
  }
  let next=settings;const visited=[];for(let i=0;i<6;i++){next=orientFigure(s,next,id,'cycle');visited.push(buildModel(s,next).figures[id].direction);}assert.equal(new Set(visited).size,6);assert.deepEqual(buildModel(s,next).figures[id].cells,before.figures[id].cells);
  const f=before.figures[id],ys=points[id].filter(([x,y])=>x||y).map(p=>p[1]),min=Math.min(0,...ys),max=Math.max(0,...ys);assert.equal(isEndVoxel(f,f.anchor),true);
  f.cells.forEach((p,i)=>assert.equal(isEndVoxel(f,p),ys[i]===min||ys[i]===max));
 }
});

test('projection overlap diagnostics retain XOR-cancelled cubes and distinguish real collision from depth',()=>{
 const s=snapshot({points:Array.from({length:4},()=>[[0,0],[0,1]]),turn:[0,0,0,0]});
 const cancelled=buildModel(s);assert.equal(cancelled.cells.length,0);assert.equal(cancelled.occupancy.length,1);assert.equal(cancelled.overlaps.length,1);
 for(const plane of ['XY','XZ','YZ']){const p=project(cancelled,plane);assert.equal(p.overlaps.length,1);assert.equal(p.overlaps[0].collisionCount,1);assert.equal(p.overlaps[0].depth,1);assert.equal(p.overlaps[0].voxelCount,4);}
 const mixed=buildModel(s,[{}, {}, {offset:[0,0,2]}, {offset:[3,0,0]}]),xy=project(mixed,'XY').overlaps[0];assert.equal(xy.collisionCount,1);assert.equal(xy.depth,2);assert.equal(xy.voxelCount,3);assert.equal(xy.maxMultiplicity,2);
 const layers=buildModel(s,[{}, {offset:[0,0,2]}, {offset:[0,0,4]}, {offset:[0,0,6]}]);assert.equal(layers.overlaps.length,0);assert.equal(project(layers,'XY').overlaps[0].depth,4);assert.equal(project(layers,'XY').overlaps[0].collisionCount,0);
 assert.equal(project(buildModel({...s,mode:'solo',selected:2}),'XY').overlaps.length,0);
});

test('common centre and symmetric distance preserve masks, source data and fixed reference rays',()=>{
 const s=snapshot({radius:5,mode:'union',offsets:[{x:4,y:2},{x:-3,y:6},{x:1,y:-7},{x:3,y:5}]}),sourceCopy=structuredClone(s),settings=[{direction:'+X',roll:1,offset:[3,8,-2]},{direction:'-X',roll:2,offset:[-3,2,7]},{direction:'+Z',roll:3,offset:[4,-1,-5]},{direction:'-Z',roll:0,offset:[2,3,6]}],before=buildModel(s,settings),symmetry={enabled:true,distance:0,rays:before.figures.map(f=>f.direction)};
 assert.deepEqual(buildModel(s,alignAnchors(s,settings,Array.from({length:4},()=>[0,0,0]))).figures.map(f=>f.anchor),Array.from({length:4},()=>[0,0,0]));
 for(const distance of [0,1,7,30]){
  symmetry.distance=distance;const aligned=symmetricAssignments(s,settings,symmetry),model=buildModel(s,aligned);
  for(let id=0;id<4;id++){const anchor=orientation(symmetry.rays[id]).down.map(n=>(n*distance||0));assert.deepEqual(model.figures[id].anchor,anchor);assert.deepEqual(model.figures[id].cells,before.figures[id].cells.map(p=>p.map((n,k)=>n-before.figures[id].anchor[k]+anchor[k])));}
  const oriented=orientFigure(s,aligned,0,'cycle');assert.deepEqual(buildModel(s,symmetricAssignments(s,oriented,symmetry)).figures.map(f=>f.anchor),model.figures.map(f=>f.anchor));
  const movedSource={...s,radius:-4,order:[3,2,1,0],offsets:[{x:9,y:8},{x:-7,y:6}]};assert.deepEqual(buildModel(movedSource,symmetricAssignments(movedSource,oriented,symmetry)).figures.map(f=>f.anchor),model.figures.map(f=>f.anchor));
 }
 assert.deepEqual(s,sourceCopy);assert.deepEqual(settings[0].offset,[3,8,-2]);
});
test('browser: four assignments, updated masks, drag, zoom, reset, projections and mobile fit',async()=>{
 const {chromium}=require('playwright-core'),browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1100,height:900}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://space.test/**',route=>{
   const file=new URL(route.request().url()).pathname;
   if(file==='/xor-space.js'||file==='/xor-space.css')return route.fulfill({contentType:file.endsWith('js')?'text/javascript':'text/css',body:fs.readFileSync(path.join(__dirname,file.slice(1)))});
   return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:18px;background:#171513}main{max-width:960px;margin:auto}</style><link rel="stylesheet" href="/xor-space.css"><main id="mount"></main><script src="/xor-space.js"></script>'});
  });
  await page.goto('http://space.test/');await page.evaluate(s=>{window.source=s;window.instance=XorAxesSpace.mount(document.getElementById('mount'),s);},snapshot({mode:'union'}));
  assert.equal(await page.locator('.xs-figure select').count(),4);
  assert.equal(await page.locator('.xor-space').getAttribute('data-depth'),'0,0');
  await page.locator('select[data-figure="0"]').selectOption('+Z');
  assert.equal(await page.evaluate(()=>instance.getModel().figures[0].cells.some(p=>p[2]!==0)),true);
  const before=await page.evaluate(()=>({cells:instance.getModel().cells,camera:instance.getState().camera,image:document.querySelector('.xs-main').toDataURL()}));
  const bounds=await page.locator('.xs-main').boundingBox();await page.mouse.move(bounds.x+30,bounds.y+30);await page.mouse.down();await page.mouse.move(bounds.x+100,bounds.y+60);await page.mouse.up();await page.mouse.wheel(0,-200);
  const after=await page.evaluate(()=>({cells:instance.getModel().cells,camera:instance.getState().camera,image:document.querySelector('.xs-main').toDataURL()}));
  assert.deepEqual(after.cells,before.cells);assert.notDeepEqual(after.camera,before.camera);assert.notEqual(after.image,before.image);
  const count=await page.evaluate(()=>instance.getModel().figures[0].cells.length);
  await page.evaluate(()=>{source.points[0].push([8,12]);instance.update(source);});assert.equal(await page.evaluate(()=>instance.getModel().figures[0].cells.length),count+1);
  assert.equal(await page.locator('.xs-projection canvas').count(),3);
  for(const canvas of await page.locator('.xor-space canvas').all())assert(await canvas.evaluate(c=>{const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=0;i<p.length;i+=4)if(p[i]>100&&p[i+1]>100)return true;return false;}));
  await page.locator('.xs-reset').click();assert.equal(await page.locator('.xor-space').getAttribute('data-depth'),'0,0');
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=390),true);
  for(const item of await page.locator('.xs-figure select,.xs-figure button,.xs-projection canvas').all()){const b=await item.boundingBox();assert(b.x>=0&&b.x+b.width<=390);}
  assert.deepEqual(errors,[]);
  if(process.env.XOR_SPACE_SCREENSHOT)await page.screenshot({path:process.env.XOR_SPACE_SCREENSHOT,fullPage:true});
 }finally{await browser.close();}
});

test('browser on actual page: each figure drags on every axis, picking, keyboard, persistence and projection redraw',async()=>{
 const http=require('node:http'),root=path.resolve(__dirname,'../..');
 const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(error,body)=>{if(error){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(body);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const {chromium}=require('playwright-core'),browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url='http://127.0.0.1:'+server.address().port+'/issledovanie/xor-axes/index.html';await page.goto(url);await page.waitForFunction(()=>window.xorSpaceView);
  const canvas=page.locator('.xs-main');
  async function screenGeometry(id,axis){
   await canvas.scrollIntoViewIfNeeded();return page.evaluate(({id,axis})=>{
    const model=xorSpaceView.getModel(),camera=xorSpaceView.getState().camera,canvas=document.querySelector('.xs-main'),r=canvas.getBoundingClientRect();
    let extent=14;for(const f of model.figures)if(f.active)for(const p of [f.anchor,...f.cells])for(const v of p)extent=Math.max(extent,Math.abs(v)+1);
    const width=Math.round(r.width),height=Math.round(Math.min(560,Math.max(280,width*.58))),unit=Math.min(width,height)/(extent*3.1)*camera.zoom;
    const p=XorAxesSpace.cameraPoint(model.figures[id].anchor,camera),basis=[0,0,0];basis[axis]=1;const q=XorAxesSpace.cameraPoint(basis,camera),v=[q[0]*unit,-q[1]*unit],length=Math.hypot(...v),origin=[r.x+width/2+p[0]*unit,r.y+height/2-p[1]*unit];
    return {origin,vector:v,handle:[origin[0]+v[0]/length*60,origin[1]+v[1]/length*60]};
   },{id,axis});
  }
  for(let id=0;id<4;id++)for(let axis=0;axis<3;axis++){
   await page.locator('.xs-pick').nth(id).click();const before=await page.evaluate(()=>({model:xorSpaceView.getModel(),state:xorSpaceView.getState(),projections:[...document.querySelectorAll('.xs-projection canvas')].map(c=>c.toDataURL())}));
   const {handle,vector}=await screenGeometry(id,axis),steps=axis===1?-3:4;
   await page.mouse.move(...handle);await page.mouse.down();await page.mouse.move(handle[0]+vector[0]*steps,handle[1]+vector[1]*steps,{steps:5});await page.mouse.up();
   const after=await page.evaluate(()=>({model:xorSpaceView.getModel(),state:xorSpaceView.getState(),projections:[...document.querySelectorAll('.xs-projection canvas')].map(c=>c.toDataURL())}));
   assert.deepEqual(after.state.camera,before.state.camera,'axis drag must not rotate camera');
   for(let f=0;f<4;f++){const expected=before.state.assignments[f].offset.slice();if(f===id)expected[axis]+=steps;assert.deepEqual(after.state.assignments[f].offset,expected,'figure '+id+' axis '+axis+' affecting '+f);const delta=[0,0,0];if(f===id)delta[axis]=steps;assert.deepEqual(after.model.figures[f].cells,before.model.figures[f].cells.map(p=>p.map((v,i)=>v+delta[i])));}
   assert(after.projections.some((p,i)=>p!==before.projections[i]),'projection redraw follows movement');
  }
  const field=page.locator('input[data-figure="2"][data-axis="X"]');await field.fill('32');await field.press('Tab');
  await page.locator('.xs-pick').nth(0).click();const {origin}=await screenGeometry(2,0);await page.mouse.click(...origin);assert.equal(await page.evaluate(()=>xorSpaceView.getState().selected),2,'visible figure can be selected on canvas');
  const old=await page.evaluate(()=>xorSpaceView.getState());await canvas.press('Shift+PageDown');await canvas.press('Shift+ArrowUp');await canvas.press('Shift+ArrowLeft');const moved=await page.evaluate(()=>xorSpaceView.getState());assert.deepEqual(moved.assignments[2].offset,[31,old.assignments[2].offset[1]+1,old.assignments[2].offset[2]-1]);assert.deepEqual(moved.camera,old.camera);
  await page.reload();await page.waitForFunction(()=>window.xorSpaceView);assert.deepEqual(await page.evaluate(()=>xorSpaceView.getState().assignments),moved.assignments,'all offsets survive F5');
  if(process.env.XOR_SPACE_DESKTOP_SCREENSHOT)await page.locator('.xor-space').screenshot({path:process.env.XOR_SPACE_DESKTOP_SCREENSHOT});
  await page.setViewportSize({width:390,height:844});await canvas.scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=390),true);
  for(const item of await page.locator('.xs-figure input,.xs-figure button').all()){const b=await item.boundingBox();assert(b.x>=0&&b.x+b.width<=390,'mobile controls fit');}
  await page.locator('.xs-pick').nth(3).click();const mobileBefore=await page.evaluate(()=>xorSpaceView.getState());
  const mobile=await screenGeometry(3,2);await page.mouse.move(...mobile.handle);await page.mouse.down();await page.mouse.move(mobile.handle[0]-mobile.vector[0]*7,mobile.handle[1]-mobile.vector[1]*7,{steps:5});await page.mouse.up();
  const mobileAfter=await page.evaluate(()=>xorSpaceView.getState());assert.deepEqual(mobileAfter.assignments[3].offset,[4,-3,-3],'negative Z crosses the origin on mobile');assert.deepEqual(mobileAfter.camera,mobileBefore.camera);
  if(process.env.XOR_SPACE_PAGE_SCREENSHOT)await page.locator('.xor-space').screenshot({path:process.env.XOR_SPACE_PAGE_SCREENSHOT});
  await page.locator('.xs-reset').click();assert.deepEqual(await page.evaluate(()=>xorSpaceView.getState().assignments.map(a=>a.offset)),Array.from({length:4},()=>[0,0,0]));assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('browser: body double click rolls, extreme double click flips, right click cycles and overlaps remain visible',async()=>{
 const {chromium}=require('playwright-core'),browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://gesture.test/**',route=>{const file=new URL(route.request().url()).pathname;if(file==='/xor-space.js'||file==='/xor-space.css')return route.fulfill({contentType:file.endsWith('js')?'text/javascript':'text/css',body:fs.readFileSync(path.join(__dirname,file.slice(1)))});return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><style>body{margin:18px;background:#171513}main{max-width:960px;margin:auto}</style><link rel="stylesheet" href="/xor-space.css"><main id="mount"></main><script src="/xor-space.js"></script>'});});
  await page.goto('http://gesture.test/');await page.evaluate(s=>{window.source=s;window.instance=XorAxesSpace.mount(document.getElementById('mount'),s);window.events=[];document.addEventListener('xor-space-change',e=>events.push(e.detail.reason));},snapshot({mode:'solo',selected:0,radius:3}));
  const canvas=page.locator('.xs-main');
  async function target(kind){
   await canvas.scrollIntoViewIfNeeded();
   const candidates=await page.evaluate(kind=>{
    const model=instance.getModel(),camera=instance.getState().camera,id=model.selected,f=model.figures[id],r=document.querySelector('.xs-main').getBoundingClientRect();let e=14;for(const p of [f.anchor,...f.cells])for(const v of p)e=Math.max(e,Math.abs(v)+1);
    const width=Math.round(r.width),height=Math.round(Math.min(560,Math.max(280,width*.58))),unit=Math.min(width,height)/(e*3.1)*camera.zoom,screen=p=>{const q=XorAxesSpace.cameraPoint(p,camera);return [r.x+width/2+q[0]*unit,r.y+height/2-q[1]*unit,q[2]];};
    const voxels=[...f.cells,f.anchor],occupied=new Set(voxels.map(p=>p.join(','))),faces=[];
    for(const p of voxels)for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
     const n=[0,0,0];n[axis]=sign;if(XorAxesSpace.cameraPoint(n,camera)[2]<=0||occupied.has(p.map((v,i)=>v+n[i]).join(',')))continue;
     const other=[0,1,2].filter(i=>i!==axis),vertices=[[-1,-1],[1,-1],[1,1],[-1,1]].map(s=>{const q=p.slice();q[axis]+=sign*.5;q[other[0]]+=s[0]*.5;q[other[1]]+=s[1]*.5;return screen(q);});
     const center=vertices[0].map((_,i)=>vertices.reduce((sum,v)=>sum+v[i],0)/4);faces.push({p,vertices,center});
    }
    faces.sort((a,b)=>b.center[2]-a.center[2]);
    const contains=(p,v)=>{let inside=false;for(let i=0,j=v.length-1;i<v.length;j=i++){if((v[i][1]>p[1])!==(v[j][1]>p[1])&&p[0]<(v[j][0]-v[i][0])*(p[1]-v[i][1])/(v[j][1]-v[i][1])+v[i][0])inside=!inside;}return inside;};
    return faces.filter(face=>{const endpoint=XorAxesSpace.isEndVoxel(f,face.p);if(kind==='body'&&endpoint||kind==='end'&&!endpoint)return false;const visible=faces.find(other=>contains(face.center,other.vertices));return visible===face;}).map(face=>face.center.slice(0,2));
   },kind);
   for(const p of candidates){await page.mouse.move(...p);if(await canvas.evaluate(c=>c.style.cursor)==='pointer')return p;}
   throw new Error('no unobscured '+kind+' voxel outside gizmo');
  }
  async function state(){return page.evaluate(()=>({state:instance.getState(),model:instance.getModel(),images:[...document.querySelectorAll('.xs-projection canvas')].map(c=>c.toDataURL())}));}
  async function gesture(kind,button){const p=await target(kind);if(button==='right')await page.mouse.click(...p,{button:'right'});else await page.mouse.dblclick(...p,{delay:60});}
  function unchanged(before,after,id){assert.deepEqual(after.state.camera,before.state.camera);assert.deepEqual(after.model.figures[id].anchor,before.model.figures[id].anchor);for(let j=0;j<4;j++)if(j!==id)assert.deepEqual(after.model.figures[j],before.model.figures[j]);}
  const autoBefore=await state();await gesture('body','right');const autoAfter=await state();assert.equal(autoAfter.model.figures[0].direction,'+Z','auto +Y cycles directly to +Z');unchanged(autoBefore,autoAfter,0);
  for(let id=0;id<4;id++){
   await page.evaluate(id=>{source.selected=id;instance.update(source);instance.setAssignments(Array.from({length:4},()=>({direction:'-Y',roll:0,offset:[2,1,0]})));},id);await page.locator('.xs-pick').nth(id).click();
   let before=await state();await gesture('body');let after=await state();assert.equal(after.state.assignments[id].roll,1);assert.equal(after.model.figures[id].direction,'-Y');unchanged(before,after,id);assert(after.images.some((v,i)=>v!==before.images[i]));
   for(let flip=0;flip<2;flip++){before=await state();await gesture('end');after=await state();assert.equal(after.model.figures[id].direction,flip===0?'+Y':'-Y');unchanged(before,after,id);const expected=buildModel(await page.evaluate(()=>instance.getSnapshot()),orientFigure(await page.evaluate(()=>instance.getSnapshot()),before.state.assignments,id,'flip'));assert.deepEqual(after.model.figures[id].cells,expected.figures[id].cells);}
   const seen=[];for(let i=0;i<6;i++){before=await state();await gesture('body','right');after=await state();seen.push(after.model.figures[id].direction);unchanged(before,after,id);}assert.deepEqual(seen,['-Z','+X','+Y','+Z','-X','-Y']);
  }
  // Empty background and the visible X arrow must not turn a figure.
  await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox(),before=await state();await page.mouse.dblclick(b.x+20,b.y+20,{delay:60});assert.deepEqual((await state()).state,before.state);await page.mouse.click(b.x+20,b.y+20,{button:'right'});assert.deepEqual((await state()).state,before.state);
  const arrow=await page.evaluate(()=>{const m=instance.getModel(),camera=instance.getState().camera,f=m.figures[instance.getState().selected],r=document.querySelector('.xs-main').getBoundingClientRect();let e=14;for(const p of [f.anchor,...f.cells])for(const v of p)e=Math.max(e,Math.abs(v)+1);const width=Math.round(r.width),height=Math.round(Math.min(560,Math.max(280,width*.58))),unit=Math.min(width,height)/(e*3.1)*camera.zoom,p=XorAxesSpace.cameraPoint(f.anchor,camera),v=XorAxesSpace.cameraPoint([1,0,0],camera),length=Math.hypot(v[0],v[1]);return [r.x+width/2+p[0]*unit+v[0]/length*60,r.y+height/2-p[1]*unit-v[1]/length*60];});await page.mouse.dblclick(...arrow,{delay:60});assert.deepEqual((await state()).state,before.state,'double-clicking gizmo cannot rotate a voxel underneath');
  const saved=await page.evaluate(()=>instance.getState().assignments);await page.evaluate(()=>{instance.destroy();instance=XorAxesSpace.mount(document.getElementById('mount'),source);});assert.deepEqual(await page.evaluate(()=>instance.getState().assignments),saved);
  await page.evaluate(()=>{source={points:Array.from({length:4},()=>[[0,0],[0,1]]),order:[0,1,2,3],turn:[0,0,0,0],radius:0,mode:'xor',selected:null};instance.update(source);instance.setAssignments([]);});
  assert.equal(await page.evaluate(()=>instance.getModel().cells.length),0);
  for(const c of await page.locator('.xs-projection canvas').all())assert.equal(await c.getAttribute('data-collisions'),'1');
  assert.equal(await page.locator('.xs-overlap-note').isVisible(),true);
  const pixels=await page.locator('[data-plane="XY"]').evaluate(c=>{const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let red=0,blue=0;for(let i=0;i<p.length;i+=4){if(p[i]>100&&p[i]>p[i+1]*1.3)red++;if(p[i+2]>150&&p[i+2]>p[i]*1.3)blue++;}return {red,blue};});assert(pixels.red>0,'XOR-cancelled overlap is visibly marked');
  await page.evaluate(()=>instance.setAssignments(Array.from({length:4},(_,i)=>({offset:[0,0,i*2]}))));assert.equal(await page.locator('[data-plane="XY"]').getAttribute('data-collisions'),'0');assert.equal(await page.locator('[data-plane="XY"]').getAttribute('data-depth-overlaps'),'1');
  const blue=await page.locator('[data-plane="XY"]').evaluate(c=>{const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<p.length;i+=4)if(p[i+2]>150&&p[i+2]>p[i]*1.3)n++;return n;});assert(blue>0,'different depths visibly marked');
  const eventCount=await page.evaluate(()=>events.length);await page.evaluate(()=>{const s=instance.getSnapshot();s.points[0].push([8,8]);instance.setAssignments([{direction:'invalid',roll:5,offset:[1.8,2.1,Infinity]}]);});assert.equal(await page.evaluate(()=>events.length),eventCount,'programmatic sequence cannot trigger its own stop');assert.equal(await page.evaluate(()=>instance.getSnapshot().points[0].length),2,'snapshot API is detached');assert.deepEqual(await page.evaluate(()=>instance.getState().assignments[0]),{direction:'auto',roll:1,offset:[2,2,0]});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=390),true);for(const item of await page.locator('.xs-projection').all()){const bounds=await item.boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=390);}
  assert((await page.evaluate(()=>events)).includes('orientation'));assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

test('browser: shared grey centre, symmetric drag, fixed rays, persistence, exit and isolated capture',async()=>{
 const {chromium}=require('playwright-core'),browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://symmetry.test/**',route=>{const file=new URL(route.request().url()).pathname;if(file==='/xor-space.js'||file==='/xor-space.css')return route.fulfill({contentType:file.endsWith('js')?'text/javascript':'text/css',body:fs.readFileSync(path.join(__dirname,file.slice(1)))});return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><style>body{margin:18px;background:#171513}main{max-width:960px;margin:auto}</style><link rel="stylesheet" href="/xor-space.css"><main id="mount"></main><script src="/xor-space.js"></script>'});});
  await page.goto('http://symmetry.test/');const fixture=snapshot({mode:'union',radius:5,offsets:[{x:4,y:2},{x:-3,y:6},{x:1,y:-7},{x:3,y:5}]});
  await page.evaluate(s=>{window.source=s;window.instance=XorAxesSpace.mount(document.getElementById('mount'),s);instance.setAssignments(['+X','-X','+Z','-Z'].map((direction,i)=>({direction,roll:i,offset:[4,-2,7]})));},fixture);
  const canvas=page.locator('.xs-main'),distance=page.locator('.xs-distance'),vectors=[[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];
  const anchors=()=>page.evaluate(()=>instance.getModel().figures.map(f=>f.anchor)),check=async n=>assert.deepEqual(await anchors(),vectors.map(v=>v.map(x=>(x*n||0))));
  const initialSource=await page.evaluate(()=>instance.getSnapshot());await page.locator('.xs-center').click();await check(0);assert.equal(await page.locator('.xs-offset-label input:disabled').count(),12);assert.equal(await page.locator('.xs-symmetric').getAttribute('aria-pressed'),'true');assert.deepEqual(await page.evaluate(()=>instance.getSnapshot()),initialSource);
  await distance.fill('3');await distance.press('Tab');await check(3);await page.locator('select[data-figure="0"]').selectOption('+Y');await check(3);assert.deepEqual(await page.evaluate(()=>instance.getState().symmetry.rays),['+X','-X','+Z','-Z']);
  await page.evaluate(()=>{instance.setAssignments(['-Z','+Y','-X','+X'].map(direction=>({direction,roll:2,offset:[99,98,97]})));source.radius=-4;source.order=[3,2,1,0];source.offsets=[{x:9,y:8},{x:-7,y:6}];instance.update(source);});await check(3);
  await page.locator('.xs-pick').nth(0).click();
  async function radialDrag(steps){
   await canvas.scrollIntoViewIfNeeded();const point=await page.evaluate(()=>{const m=instance.getModel(),s=instance.getState(),f=m.figures[s.selected],r=document.querySelector('.xs-main').getBoundingClientRect();let e=14;for(const figure of m.figures)if(figure.active)for(const p of [figure.anchor,...figure.cells])for(const n of p)e=Math.max(e,Math.abs(n)+1);const width=Math.round(r.width),height=Math.round(Math.min(560,Math.max(280,width*.58))),unit=Math.min(width,height)/(e*3.1)*s.camera.zoom,p=XorAxesSpace.cameraPoint(f.anchor,s.camera),q=XorAxesSpace.cameraPoint(XorAxesSpace.orientation(s.symmetry.rays[s.selected]).down,s.camera),v=[q[0]*unit,-q[1]*unit],length=Math.hypot(...v);return {at:[r.x+width/2+p[0]*unit+v[0]/length*60,r.y+height/2-p[1]*unit+v[1]/length*60],v};});const camera=await page.evaluate(()=>instance.getState().camera);await page.mouse.move(...point.at);await page.mouse.down();await page.mouse.move(point.at[0]+point.v[0]*steps,point.at[1]+point.v[1]*steps,{steps:6});await page.mouse.up();assert.deepEqual(await page.evaluate(()=>instance.getState().camera),camera);
  }
  await radialDrag(4);await check(7);await radialDrag(-20);await check(0);await distance.fill('3');await distance.press('Tab');await canvas.press('Shift+ArrowUp');await check(4);
  const beforeCamera=await anchors();await canvas.scrollIntoViewIfNeeded();const bounds=await canvas.boundingBox();await page.mouse.move(bounds.x+20,bounds.y+20);await page.mouse.down();await page.mouse.move(bounds.x+80,bounds.y+40);await page.mouse.up();assert.deepEqual(await anchors(),beforeCamera);
  const saved=await page.evaluate(()=>instance.getState().symmetry);await page.reload();await page.evaluate(s=>{window.source=s;window.instance=XorAxesSpace.mount(document.getElementById('mount'),s);},fixture);await check(4);assert.deepEqual(await page.evaluate(()=>instance.getState().symmetry),saved);
  const capture=await page.evaluate(()=>{
   const initial=JSON.stringify(instance.getState()),settings=instance.getState().assignments,capture=instance.createCapture(),out=capture.render(settings,'fixed'),before=out.toDataURL(),liveCanvases=[document.querySelector('.xs-main'),...document.querySelectorAll('#mount .xs-projection canvas')],parity=[];
   for(let i=0;i<4;i++){const part=capture.parts[i],normalized=document.createElement('canvas');normalized.width=part.width;normalized.height=part.height;const ctx=normalized.getContext('2d',{willReadFrequently:true});ctx.drawImage(liveCanvases[i],0,0,part.width,part.height);const a=ctx.getImageData(0,0,part.width,part.height).data,b=out.getContext('2d',{willReadFrequently:true}).getImageData(part.x,part.y,part.width,part.height).data;let differences=0;for(let j=0;j<a.length;j++)if(a[j]!==b[j])differences++;parity.push(differences);}
   const unchanged=initial===JSON.stringify(instance.getState());const input=document.querySelector('#mount .xs-distance');input.value='9';input.dispatchEvent(new Event('input',{bubbles:true}));const liveAfter=JSON.stringify(instance.getState()),sameFrozenImage=before===capture.render(settings,'fixed').toDataURL();capture.destroy();
   const box=document.createElement('div');box.style.width='960px';document.body.appendChild(box);const isolated=XorAxesSpace.mount(box,source,{capture:true,assignments:settings});const isolatedState=isolated.getState(),isolatedAnchors=isolated.getModel().figures.map(f=>f.anchor);isolated.destroy();box.remove();
   return {parity,unchanged,sameFrozenImage,afterDestroy:liveAfter===JSON.stringify(instance.getState()),hidden:document.querySelectorAll('[aria-hidden=true] .xor-space').length,isolatedEnabled:isolatedState.symmetry.enabled,isolatedAnchors};
  });assert.deepEqual(capture.parity,[0,0,0,0],'capture matches live 3D and every projection');assert.equal(capture.unchanged,true);assert.equal(capture.sameFrozenImage,true);assert.equal(capture.afterDestroy,true);assert.equal(capture.hidden,0);assert.equal(capture.isolatedEnabled,false);assert.deepEqual(capture.isolatedAnchors,vectors.map(v=>v.map(n=>n*4)));await check(9);
  const beforeExit=await page.evaluate(()=>instance.getModel());await page.locator('.xs-symmetric').click();assert.deepEqual(await page.evaluate(()=>instance.getModel()),beforeExit);assert.equal(await page.locator('.xs-offset-label input:disabled').count(),0);
  const old=await anchors();await page.locator('input[data-figure="0"][data-axis="X"]').fill('1');assert.deepEqual((await anchors()).slice(1),old.slice(1));assert.notDeepEqual((await anchors())[0],old[0]);
  await page.locator('.xs-center').click();await check(0);await distance.fill('2');await distance.press('Tab');await page.locator('.xs-center').click();await check(0);
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=390),true);for(const item of await page.locator('.xs-symmetry button,.xs-distance').all()){const r=await item.boundingBox();assert(r.x>=0&&r.x+r.width<=390);}
  if(process.env.XOR_SYMMETRY_SCREENSHOT)await page.locator('.xor-space').screenshot({path:process.env.XOR_SYMMETRY_SCREENSHOT});assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
