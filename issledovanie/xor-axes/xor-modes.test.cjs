'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright-core');
let browser,page;const errors=[];
before(async()=>{
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.context().route('http://xor.test/**',async route=>{
  const name=path.basename(new URL(route.request().url()).pathname);
  const file=name==='mayatnik-gif.js'?path.join(__dirname,'../../mayatnik/mayatnik-gif.js'):['xor-space.js','xor-space.css','xor-space-sequence.js','xor-space-sequence-worker.js','xor-space-player.js','xor-space-player.css','xor-space-export.js','xor-space-export.css'].includes(name)?path.join(__dirname,name):(process.env.XOR_TEST_HTML||path.join(__dirname,'index.html'));
  await route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(file)});
 });
 await page.addInitScript(()=>{window.__raf=new Map();let id=0;window.requestAnimationFrame=f=>{__raf.set(++id,f);return id;};window.cancelAnimationFrame=id=>__raf.delete(id);});
 await page.goto('http://xor.test/issledovanie/xor-axes/index.html');
});
after(async()=>{await browser?.close();assert.deepEqual(errors,[]);});
test('all 6144 unions preserve every occupied cell; screenshot layout has 75 black cells',async()=>{
 const result=await page.evaluate(()=>{
  for(let v=0;v<total;v++){
   const {turn}=unpack(v),expected=new Uint8Array(size*size);
   masks.forEach((rows,id)=>rows.forEach((row,y)=>[...row].forEach((bit,x)=>{
    if(bit!=='1'||y===0)return;let dx=x-pivots[id].x,dy=y;
    for(let t=0;t<turn[id];t++)[dx,dy]=[-dy,dx];
    expected[(center+dy)*size+center+dx]=1;
   })));
   expected[center*size+center]=2;
   const actual=fieldCells(v,0,0,'union');
   if(actual.some((bit,i)=>bit!==expected[i]))throw Error('Union mismatch '+v);
  }
  return {union:fieldCells(1576,0,0,'union').filter(x=>x===1).length,xor:fieldCells(1576,0,0,'xor').filter(x=>x===1).length};
 });assert.deepEqual(result,{union:75,xor:35});
});
test('Together thumbnails contain full masks; XOR thumbnails retain cancelled cells',async()=>{
 const result=await page.evaluate(()=>{
  state.variant=1576;state.mode='union';render();
  const full=tiles.every(tile=>tile.querySelector('.x-live').getAttribute('d')===tile.querySelector('.x-ghost').getAttribute('d'));
  state.mode='xor';render();
  const cancelled=tiles.some(tile=>tile.querySelector('.x-live').getAttribute('d')!==tile.querySelector('.x-ghost').getAttribute('d'));
  return {full,cancelled};
 });assert.deepEqual(result,{full:true,cancelled:true});
});
test('playback uses current field settings with no temporal XOR or duplicate effect',async()=>{
 assert.equal(await page.locator('[data-effect]').count(),0);
 const count=await page.evaluate(()=>{
  let count=0;
  for(const mode of ['xor','union','solo'])for(const motion of ['variants','spin','cross','unique','cross24']){
   if(mode==='solo'&&centredSequence(motion))continue;
   stopFilm();resetBoard();state.mode=mode;state.selected=mode==='solo'||motion==='spin'?2:null;filmMotion=motion;
   state.variant=centredSequence(motion)?sequenceVariant(7,motion):1576;state.radius=centredSequence(motion)?0:2;
   state.offsets=[{x:1,y:0},{x:-1,y:2},{x:0,y:-2},{x:1,y:1}];speed=4;render();
   const config=settings(),frames=plan(config),start=performance.now();playFilm();
   for(let i=0;i<4;i++){
    const cb=[...__raf.values()][0];__raf.clear();cb(start+5+i*260);
    const frame=lastFilmFrame;
    if(frame.mode!==mode)throw Error('Wrong operation');
    const cells=fieldCells(frame.variant,config.radius,config.selected,mode,config.offsets,config.points);let d='';
    cells.forEach((v,k)=>{if(v===1)d+=cellPath(k%size,Math.floor(k/size));});
    if($('bits').getAttribute('d')!==d)throw Error('Preview mismatch '+mode+'/'+motion);
    if(window.xorSpaceSnapshot.previous)throw Error('Temporal 3D snapshot');
    if(settings().variant!==frame.variant)throw Error('Export starts from stale frame');
    count++;
   }
  }
  stopFilm();resetBoard();return count;
 });assert.equal(count,48);
});
test('GIF encodes the current operation, offsets, masks, shadows and grid; no frame differences',async()=>{
 const count=await page.evaluate(async()=>{
  const original=MayatnikGif.encoder;let count=0;
  try{
   for(const mode of ['xor','union','solo'])for(const styled of [false,true]){
    stopFilm();resetBoard();state.mode=mode;state.selected=2;state.variant=1576;state.radius=2;
    state.offsets=[{x:1,y:0},{x:-1,y:2},{x:0,y:-2},{x:1,y:1}];state.grid=styled;state.shadows=styled;state.ghosts=styled;filmMotion='spin';speed=4;
    const config=settings(),frames=plan(config);let i=0;
    MayatnikGif.encoder=(...args)=>{
     const encoder=original(...args),add=encoder.add.bind(encoder);
     encoder.add=(rgba,delay)=>{
      const frame=frames[i++],cells=fieldCells(frame.variant,config.radius,config.selected,mode,config.offsets,config.points);
      for(let k=0;k<cells.length;k++){
       const at=((Math.floor(k/size)*cellPixels+4)*side+(k%size)*cellPixels+4)*4;
       const black=rgba[at]===0&&rgba[at+1]===0&&rgba[at+2]===0;
       if(black!==(cells[k]===1))throw Error('GIF '+mode+' frame '+i+' cell '+k);
      }
      if(styled&&rgba[0]===253)throw Error('Grid omitted');
      count++;return add(rgba,delay);
     };return encoder;
    };
    await $('makeGif').onclick();
    if(i!==frames.length||!$('gifStatus').textContent.startsWith('Готово'))throw Error('GIF failed '+$('gifStatus').textContent);
    if(!$('gifLink').download.startsWith('osi-'+mode+'-'))throw Error('Wrong filename mode');
   }
  }finally{MayatnikGif.encoder=original;state.ghosts=false;state.grid=false;state.shadows=true;resetBoard();}
  return count;
 });assert.equal(count,96);
});
test('variant traversal changes all figures independently of selection and visits all 6144 layouts',async()=>{
 const result=await page.evaluate(()=>{
  resetBoard();const base=settings();base.mode='union';base.speed=4;
  const reference=plan({...base,motion:'variants'}).map(f=>f.variant);
  for(const selected of [null,0,1,2,3])if(JSON.stringify(reference)!==JSON.stringify(plan({...base,motion:'variants',selected}).map(f=>f.variant)))throw Error('Selection leaked into variants');
  const cycle=new Set();for(let i=0;i<total;i++)cycle.add(layoutAtStep(base.variant,i));
  const turns=reference.map(v=>unpack(v).turn);
  const changed=turns[0].map((v,i)=>turns.some(t=>t[i]!==v));
  const images=new Set(reference.map(v=>Array.from(fieldCells(v,0,null,'union')).join('')));
  const spin=plan({...base,motion:'spin',selected:2}).map(f=>unpack(f.variant).turn);
  const isolated=spin.every(t=>t.every((v,i)=>i===2||v===spin[0][i]))&&spin.some(t=>t[2]!==spin[0][2]);
  return {cycle:cycle.size,loops:layoutAtStep(base.variant,total)===base.variant,changed,images:images.size,isolated};
 });assert.equal(result.cycle,6144);assert.equal(result.loops,true);assert.deepEqual(result.changed,[true,true,true,true]);assert.ok(result.images>4);assert.equal(result.isolated,true);
});
test('real clicks clear selection and leave Solo for Variants, including during playback',async()=>{
 await page.locator('#resetAll').click();
 const snapshot=()=>page.evaluate(()=>({selected:state.selected,mode:state.mode,motion:filmMotion,edit:state.edit,playing:!!animation,pressed:tiles.filter(t=>t.getAttribute('aria-pressed')==='true').length}));
 assert.deepEqual(await snapshot(),{selected:null,mode:'xor',motion:'variants',edit:null,playing:false,pressed:0});
 await page.locator('#tiles .tile').nth(1).click();assert.equal((await snapshot()).selected,1);
 await page.locator('[data-motion="spin"]').click();await page.locator('#union').click();assert.equal((await snapshot()).motion,'spin');
 await page.locator('#solo').click();assert.equal((await snapshot()).motion,'spin');
 await page.locator('#play').click();assert.equal((await snapshot()).playing,true);
 await page.locator('[data-motion="variants"]').click();assert.deepEqual(await snapshot(),{selected:null,mode:'union',motion:'variants',edit:null,playing:true,pressed:0});
 // Execute two actual animation callbacks and compare with their planned union frames.
 await page.evaluate(()=>{const frames=plan(settings()),start=performance.now();for(const at of [5,260]){const cb=[...__raf.values()][0];__raf.clear();cb(start+at);const frame=frames.find(f=>f.end>Math.floor(at/10));let path='';fieldCells(frame.variant,state.radius,null,frame.mode,state.offsets).forEach((v,i)=>{if(v===1)path+=cellPath(i%size,Math.floor(i/size));});if($('bits').getAttribute('d')!==path)throw Error('Wrong variants animation');}});
 // Preview must continue after the four-second export window, not repeat 16 layouts.
 await page.evaluate(()=>{stopFilm();state.variant=initialVariant;state.mode='union';filmMotion='variants';speed=4;const start=performance.now();playFilm();for(const at of [5,4010,8260]){const cb=[...__raf.values()][0];__raf.clear();cb(start+at);const expected=layoutAtStep(initialVariant,Math.floor(at/250));if(lastFilmFrame.variant!==expected)throw Error('Traversal restarted at four seconds');}});
 await page.locator('#play').click();
 await page.locator('#tiles .tile').nth(2).click();await page.locator('#tiles .tile').nth(2).click();assert.equal((await snapshot()).selected,null);
 await page.locator('#tiles .tile').nth(0).click();await page.keyboard.press('Escape');assert.equal((await snapshot()).selected,null);
 await page.locator('#tiles .tile').nth(3).click();await page.locator('#field').click({position:{x:4,y:4}});assert.equal((await snapshot()).selected,null);
 await page.locator('#tiles .tile').nth(1).click();await page.locator('#field').click({button:'right',position:{x:4,y:4}});assert.equal((await snapshot()).selected,null);
 assert.equal(await page.locator('[data-motion="spin"]').isDisabled(),true);assert.equal(await page.locator('#solo').isDisabled(),true);assert.equal(await page.locator('[data-motion="variants"]').isEnabled(),true);
});
test('Cross button joins centres and locks perpendicular orientation through playback and export plans',async()=>{
 await page.evaluate(()=>{stopFilm();state.variant=1576;state.radius=3;state.selected=1;state.mode='solo';state.offsets[0]={x:2,y:1};filmMotion='spin';speed=4;render();});
 await page.locator('#play').click();await page.locator('[data-motion="cross"]').click();
 const result=await page.evaluate(()=>{
  const {order,turn}=unpack(state.variant),original=state.variant;
  const check=()=>{if(state.radius!==0||state.offsets.some(o=>o.x||o.y)||state.selected!==null||state.mode!=='union'||filmMotion!=='cross')throw Error('Cross not aligned');};check();
  if(!order.every((id,ray)=>turn[id]===(ray+2)%4))throw Error('Wrong ray directions');
  let frames=0;
  for(const speed of [1,4,100,10000])for(const mode of ['xor','union']){
   const seq=plan({...settings(),speed,mode}),phases=new Set();
   for(const frame of seq){const v=unpack(frame.variant),delta=(v.turn[0]-turn[0]+4)%4;phases.add(delta);if(v.order.join()!==order.join()||!v.turn.every((t,id)=>(t-turn[id]+4)%4===delta))throw Error('Cross deformed');const cells=fieldCells(frame.variant,0,null,frame.mode);if(cells.filter(c=>c===2).length!==1)throw Error('Separated centres');frames++;}
   if(phases.size<(speed<=4?4:2))throw Error('Frozen cross at '+speed);
  }
  // No individual command may deform the enabled cross.
  turnFigure(order[0],1);stepRadius(1);stepFrame(1);advance(3);if(state.variant!==original)throw Error('Manual edit escaped cross');
  return {frames,playing:!!animation};
 });assert.ok(result.frames>800);assert.equal(result.playing,true);
 await page.locator('#play').click();await page.locator('#tiles .tile').nth(0).click();await page.keyboard.press('Escape');
 assert.equal(await page.locator('[data-motion="cross"]').getAttribute('aria-pressed'),'true');
 for(const id of ['radius','frame','random','solo','left','swap'])assert.equal(await page.locator('#'+id).isDisabled(),true,id);
 await page.locator('#allRight').click();assert.equal(await page.evaluate(()=>new Set(unpack(state.variant).turn).size),4);
 for(const width of [390,1100]){await page.setViewportSize({width,height:900});const box=await page.locator('[data-motion="cross"]').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width,'cross fits viewport');}
 await page.locator('[data-motion="variants"]').click();assert.equal(await page.locator('#radius').isEnabled(),true);
});
test('finite modes keep the centre distance: manual slider and automatic sweep',async()=>{
 const result=await page.evaluate(()=>{
  stopFilm();
  document.querySelector('[data-motion="unique"]').click();
  const enabled=!document.getElementById('radius').disabled,switchShown=!document.getElementById('radiusSwitch').hidden;
  const input=document.getElementById('radius');input.value='4';input.dispatchEvent(new Event('input'));
  const manual={radius:state.radius,pivots:[...fieldCells(state.variant,state.radius,state.selected,state.mode,state.offsets)].filter(v=>v===2).length,radii:[...new Set(plan(settings()).map(f=>f.radius))]};
  document.querySelector('[data-radius="auto"]').click();
  const auto={disabled:document.getElementById('radius').disabled,a:autoRadius(0,256),m:autoRadius(127,256),b:autoRadius(255,256),radii:[...new Set(plan(settings()).map(f=>f.radius))]};
  document.querySelector('[data-radius="manual"]').click();
  const back=!document.getElementById('radius').disabled;
  document.querySelector('[data-motion="cross24"]').click();
  const cross24={enabled:!document.getElementById('radius').disabled,switchShown:!document.getElementById('radiusSwitch').hidden,radii:[...new Set(plan(settings()).map(f=>f.radius))]};
  document.querySelector('[data-motion="variants"]').click();
  return {enabled,switchShown,manual,auto,back,cross24,variantsSwitch:!document.getElementById('radiusSwitch').hidden,radiusEnabled:!document.getElementById('radius').disabled};
 });
 assert.equal(result.enabled,true);
 assert.equal(result.switchShown,true);
 assert.deepEqual(result.manual,{radius:4,pivots:4,radii:[4]});
 assert.equal(result.auto.disabled,true);
 assert.deepEqual([result.auto.a,result.auto.m,result.auto.b],[-7,7,-7]);
 assert.ok(result.auto.radii.length>10);
 assert.equal(result.back,true);
 assert.equal(result.cross24.enabled,true);
 assert.equal(result.cross24.switchShown,true);
 assert.equal(result.cross24.radii.length,1);
 assert.equal(result.variantsSwitch,false);
 assert.equal(result.radiusEnabled,true);
});
test('one-centre arrangements have 256 results, or 24 crosses; global-rotation classes are 64 and 6',async()=>{
 const counts=await page.evaluate(()=>{
  const canonical=a=>{let data=Array.from(a),keys=[];for(let t=0;t<4;t++){keys.push(data.join(''));const next=[];for(let y=0;y<size;y++)for(let x=0;x<size;x++)next[x*size+size-1-y]=data[y*size+x];data=next;}return keys.sort()[0];};
  const count=angles=>Object.fromEntries(['xor','union'].map(mode=>{const exact=new Set(),rotated=new Set();for(const turn of angles){const cells=fieldCells(pack([0,1,2,3],turn),0,null,mode);exact.add(Array.from(cells).join(''));rotated.add(canonical(cells));}return [mode,[exact.size,rotated.size]];}));
  return {all:count(Array.from({length:256},(_,n)=>[0,1,2,3].map(i=>Math.floor(n/4**i)%4))),cross:count(orders)};
 });assert.deepEqual(counts,{all:{xor:[256,64],union:[256,64]},cross:{xor:[24,6],union:[24,6]}});
});
test('finite modes contain every 2D arrangement once and export their whole cycle',async()=>{
 const result=await page.evaluate(()=>{
  const totals={};
  for(const motion of ['unique','cross24'])for(const mode of ['union','xor'])for(const start of [0,7]){
   const config={...settings(),variant:sequenceVariant(start,motion),selected:null,mode,motion,speed:4,radius:0,offsets:Array.from({length:4},()=>({x:0,y:0}))},frames=plan(config),count=sequenceTotal(motion);
   if(frames.length!==count||frames.at(-1).end!==count*25)throw Error('Wrong full duration/count');
   const seen=new Set();for(let i=0;i<frames.length;i++){const f=frames[i],index=sequenceIndex(f.variant,motion);if(index!==(start+i)%count)throw Error('Wrong order');seen.add(f.variant);if(f.mode!==mode)throw Error('Wrong field mode');if(motion==='cross24'&&new Set(unpack(f.variant).turn).size!==4)throw Error('Not perpendicular');}
   if(seen.size!==count)throw Error('Repeated arrangement');totals[motion]=seen.size;
  }return totals;
 });assert.deepEqual(result,{unique:256,cross24:24});
});
test('finite controls and live counters visit every frame even after delayed callbacks',async()=>{
 for(const [motion,totalCount]of [['unique',256],['cross24',24]]){
  await page.locator('#resetAll').click();await page.locator('[data-motion="'+motion+'"]').click();
  assert.equal(await page.locator('#frameTotal').textContent(),String(totalCount));assert.equal(await page.locator('#frame').getAttribute('max'),String(totalCount));
  await page.locator('#frame').fill(String(totalCount));await page.locator('#frame').dispatchEvent('input');assert.equal(await page.locator('#frameNow').textContent(),String(totalCount));
  await page.locator('#frameDown').click();assert.equal(await page.locator('#frameNow').textContent(),String(totalCount-1));
  await page.locator('#frame').fill('1');await page.locator('#frame').dispatchEvent('input');
  const checked=await page.evaluate(({motion,totalCount})=>{
   setSpeed(10000);if(speed!==25)throw Error('Missing speed cap');playFilm();let now=performance.now(),seen=[];
   for(let i=0;i<totalCount;i++){now+=1000;const cb=[...__raf.values()][0];__raf.clear();cb(now);const n=Number($('frameNow').textContent);if(n!==i+1)throw Error('Skipped frame '+i+' => '+n);if($('frameTotal').textContent!==String(totalCount))throw Error('Wrong total');if(window.xorSpaceSnapshot.variant!==lastFilmFrame.variant)throw Error('3D stale frame');seen.push(lastFilmFrame.variant);}
   now+=1000;const cb=[...__raf.values()][0];__raf.clear();cb(now);if($('frameNow').textContent!=='1')throw Error('Cycle did not wrap');stopFilm();return new Set(seen).size;
  },{motion,totalCount});assert.equal(checked,totalCount);
 }
 await page.locator('#resetAll').click();assert.equal(await page.locator('#frameTotal').textContent(),'6144');assert.equal(await page.locator('#rate').getAttribute('max'),'1000');
});
test('integrated third axis, projections and camera follow the displayed sequence without pausing it',async()=>{
 await page.locator('#resetAll').click();const bits=await page.locator('#bits').getAttribute('d');
 await page.locator('.xs-figure select').nth(0).selectOption('+Z');await page.locator('.xs-figure select').nth(1).selectOption('-Z');
 let model=await page.evaluate(()=>window.xorSpaceView.getModel());assert.ok(model.cells.some(c=>c.p[2]>0));assert.ok(model.cells.some(c=>c.p[2]<0));assert.equal(await page.locator('#bits').getAttribute('d'),bits);
 for(const plane of ['XY','XZ','YZ'])assert.ok(Number(await page.locator('canvas[data-plane="'+plane+'"]').getAttribute('data-cells'))>0);
 await page.locator('[data-motion="cross24"]').click();await page.locator('#play').click();
 const before=await page.evaluate(()=>window.xorSpaceView.getState().camera);const canvas=page.locator('.xs-main');await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();
 await page.mouse.move(box.x+20,box.y+20);await page.mouse.down();await page.mouse.move(box.x+70,box.y+40);await page.mouse.up();await page.mouse.wheel(0,-120);
 const after=await page.evaluate(()=>({camera:window.xorSpaceView.getState().camera,playing:!!animation}));assert.notDeepEqual(after.camera,before);assert.equal(after.playing,true);
 await page.locator('#play').click();await page.locator('#frame').fill('3');await page.locator('#frame').dispatchEvent('input');assert.equal(await page.locator('#frameNow').textContent(),'3');
 assert.equal(await page.evaluate(()=>window.xorSpaceSnapshot.variant===state.variant),true);
 await page.setViewportSize({width:390,height:900});await page.locator('#spaceMount').scrollIntoViewIfNeeded();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.locator('#spaceMount').screenshot({path:process.env.XOR_SPACE_SCREENSHOT||path.join(require('node:os').tmpdir(),'xor-space-015-integrated.png')});
 await page.reload();assert.deepEqual(await page.evaluate(()=>window.xorSpaceView.getState().assignments.slice(0,2).map(a=>a.direction)),['+Z','-Z']);
 await page.locator('.xs-reset').click();model=await page.evaluate(()=>window.xorSpaceView.getModel());assert.ok(model.cells.every(c=>c.p[2]===0));await page.setViewportSize({width:1100,height:900});
});

test('export snapshot freezes masks and offsets while keeping the displayed starting frame',async()=>{
 const result=await page.evaluate(()=>{
  resetBoard();state.mode='xor';const config=settings(),frame=plan(config)[0],expected=Array.from(raster(config,frame)),saved=points[0];
  points[0]=[[0,0],[1,0]];state.offsets[0].x=4;state.mode='union';
  try{return JSON.stringify(Array.from(raster(config,frame)))===JSON.stringify(expected);}
  finally{points[0]=saved;resetBoard();}
 });assert.equal(result,true);
});
test('actual video recording uses the same current field frames as GIF, without temporal XOR',async()=>{
 const videoPage=await page.context().newPage();const videoErrors=[];videoPage.on('pageerror',e=>videoErrors.push(e.message));
 try{
  await videoPage.goto('http://xor.test/issledovanie/xor-axes/index.html');
  const results=await videoPage.evaluate(async()=>{
   const pcm=new Uint8Array(44+8000),view=new DataView(pcm.buffer),str=(at,s)=>[...s].forEach((c,i)=>pcm[at+i]=c.charCodeAt(0));
   str(0,'RIFF');view.setUint32(4,pcm.length-8,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,8000,true);view.setUint32(28,16000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,8000,true);
   audioUrl=URL.createObjectURL(new Blob([pcm],{type:'audio/wav'}));audioDuration=.5;const results=[];
   for(const mode of ['xor','union','solo']){
    resetBoard();state.mode=mode;state.selected=1;state.variant=1576;state.radius=1;state.offsets[2]={x:2,y:-1};state.ghosts=false;state.grid=false;filmMotion='spin';speed=1;
    const config=settings(),frames=plan(config),original=CanvasRenderingContext2D.prototype.putImageData;let checked=0;
    CanvasRenderingContext2D.prototype.putImageData=function(data,...args){
     if(data.width===side&&data.height===side){
      const matches=frames.some(frame=>{
       const cells=fieldCells(frame.variant,config.radius,config.selected,mode,config.offsets,config.points);
       return cells.every((v,k)=>{const at=((Math.floor(k/size)*cellPixels+4)*side+k%size*cellPixels+4)*4;return (data.data[at]===0&&data.data[at+1]===0&&data.data[at+2]===0)===(v===1);});
      });if(!matches)throw Error('Video contains changed/difference frame '+mode);checked++;
     }return original.call(this,data,...args);
    };
    try{await $('makeVideo').onclick();}finally{CanvasRenderingContext2D.prototype.putImageData=original;}
    if(!$('videoStatus').textContent.startsWith('Готово'))throw Error($('videoStatus').textContent);
    const blob=await (await fetch(videoUrl)).blob();results.push({mode,checked,bytes:blob.size,filename:$('videoLink').download});
   }return results;
  });
  for(const r of results){assert.ok(r.checked>=4,JSON.stringify(r));assert.ok(r.bytes>100);assert.ok(r.filename.startsWith('osi-'+r.mode+'-'));}
  assert.deepEqual(videoErrors,[]);
 }finally{await videoPage.close();}
});
