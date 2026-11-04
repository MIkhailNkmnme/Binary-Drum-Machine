'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {buildModel,project,orientation,cameraPoint}=require('./xor-space.js');
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
test('camera rotation is rigid and cannot change geometry; temporal XOR precedes projection',()=>{
 const s=snapshot(),before=buildModel(s,[{direction:'+Z'}]),p=[3,4,5],q=cameraPoint(p,{yaw:.7,pitch:-.6,zoom:2});
 assert(Math.abs(q.reduce((n,v)=>n+v*v,0)-50)<1e-10);assert.deepEqual(buildModel(s,[{direction:'+Z'}]),before);
 assert.equal(buildModel({...s,previous:s},[{direction:'+Z'}]).cells.length,0);
 const next=snapshot({turn:[2,2,0,1],previous:s}),model=buildModel(next,[{direction:'+Z'}]);
 const expected=new Set(keys(buildModel({...next,previous:null},[{direction:'+Z'}]).cells));
 for(const k of keys(before.cells))expected.has(k)?expected.delete(k):expected.add(k);
 for(const c of model.centres)expected.delete(c.p.join(','));assert.deepEqual(keys(model.cells),[...expected].sort());
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
  await page.locator('[data-figure="0"]').selectOption('+Z');
  assert.equal(await page.evaluate(()=>instance.getModel().figures[0].cells.some(p=>p[2]!==0)),true);
  const before=await page.evaluate(()=>({cells:instance.getModel().cells,camera:instance.getState().camera,image:document.querySelector('.xs-main').toDataURL()}));
  const bounds=await page.locator('.xs-main').boundingBox();await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width/2+70,bounds.y+bounds.height/2+30);await page.mouse.up();await page.mouse.wheel(0,-200);
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
