'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {buildModel,project,orientation,cameraPoint,axisDragSteps}=require('./xor-space.js');
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
