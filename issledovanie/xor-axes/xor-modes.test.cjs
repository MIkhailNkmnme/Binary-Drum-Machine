'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright-core');
let browser,page;const errors=[];
before(async()=>{
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://xor.test/**',async route=>{
  const file=new URL(route.request().url()).pathname.endsWith('mayatnik-gif.js')?path.join(__dirname,'../../mayatnik/mayatnik-gif.js'):(process.env.XOR_TEST_HTML||path.join(__dirname,'index.html'));
  await route.fulfill({contentType:file.endsWith('.js')?'text/javascript':'text/html',body:fs.readFileSync(file)});
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
test('playback obeys effect for every field mode, including switching to Without XOR while playing',async()=>{
 const n=await page.evaluate(()=>{
  let checked=0;
  const checkFrame=(frame,config,previous)=>{
   const base=fieldCells(frame.variant,0,0,frame.mode);
   const expected=config.mode==='xor'&&config.effect==='xor'&&previous?xorCells(base,previous):base;
   let d='';expected.forEach((v,i)=>{if(v===1)d+=cellPath(i%size,Math.floor(i/size));});
   if($('bits').getAttribute('d')!==d)throw Error('Preview mismatch '+config.mode+'/'+config.effect);
   if(frame.mode!=='xor'&&!tiles.every(tile=>tile.querySelector('.x-live').getAttribute('d')===tile.querySelector('.x-ghost').getAttribute('d')))throw Error('Preview thumbnails');
   checked++;return base;
  };
  for(const mode of ['union','xor','solo'])for(const effect of ['union','xor','compare']){
   stopFilm();state.variant=1576;state.radius=0;state.selected=0;state.mode=mode;filmEffect=effect;filmMotion='spin';speed=4;render();
   const config=settings(),frames=plan(config),start=performance.now();playFilm();let prev=null;
   for(const at of (effect==='compare'&&mode!=='solo'?[5,130,260,390]:[5,260,510,760])){
    const cb=[...__raf.values()][0];__raf.clear();cb(start+at);
    const f=frames.find(f=>f.end>Math.floor(at/10));prev=checkFrame(f,config,prev);
   }
  }
  stopFilm();state.mode='xor';filmEffect='xor';playFilm();
  document.querySelector('[data-effect="union"]').click();
  const start=performance.now(),config=settings(),frames=plan(config);
  for(const at of [5,260]){const cb=[...__raf.values()][0];__raf.clear();cb(start+at);checkFrame(frames.find(f=>f.end>Math.floor(at/10)),config,null);}
  stopFilm();return checked;
 });assert.equal(n,38);
});
test('GIF encoder receives complete non-XOR frames and correct comparison pairs',async()=>{
 const count=await page.evaluate(async()=>{
  const original=MayatnikGif.encoder;let count=0;
  try{
   for(const mode of ['xor','union'])for(const effect of ['union','compare','xor']){
    state.mode=mode;state.variant=1576;filmEffect=effect;filmMotion='spin';speed=4;
    const config=settings(),frames=plan(config);let i=0,previous=null;
    MayatnikGif.encoder=(...args)=>{
     const encoder=original(...args),add=encoder.add.bind(encoder);
     encoder.add=(rgba,delay)=>{
      const frame=frames[i++],base=fieldCells(frame.variant,config.radius,config.selected,frame.mode,config.offsets);
      const cells=mode==='xor'&&effect==='xor'&&previous?xorCells(base,previous):base;
      // Sample the middle of each cell: independent of shadows and SVG styling.
      for(let k=0;k<cells.length;k++){
       const at=((Math.floor(k/size)*cellPixels+4)*side+(k%size)*cellPixels+4)*4;
       const black=rgba[at]===0&&rgba[at+1]===0&&rgba[at+2]===0;
       if(black!==(cells[k]===1))throw Error('GIF '+mode+'/'+effect+' frame '+i+' cell '+k);
      }
      previous=base;count++;return add(rgba,delay);
     };return encoder;
    };
    await $('makeGif').onclick();
    if(i!==frames.length||$('gifStatus').textContent.includes('Ошибка'))throw Error('GIF failed '+$('gifStatus').textContent);
   }
  }finally{MayatnikGif.encoder=original;}
  return count;
 });assert.equal(count,128);
});
test('variant traversal changes all figures independently of selection and visits all 6144 layouts',async()=>{
 const result=await page.evaluate(()=>{
  resetBoard();const base=settings();base.effect='union';base.speed=4;
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
 await page.evaluate(()=>{stopFilm();state.variant=initialVariant;state.mode='union';filmEffect='union';filmMotion='variants';speed=4;const start=performance.now();playFilm();for(const at of [5,4010,8260]){const cb=[...__raf.values()][0];__raf.clear();cb(start+at);const expected=layoutAtStep(initialVariant,Math.floor(at/250));if(lastFilmFrame.variant!==expected)throw Error('Traversal restarted at four seconds');}});
 await page.locator('#play').click();
 await page.locator('#tiles .tile').nth(2).click();await page.locator('#tiles .tile').nth(2).click();assert.equal((await snapshot()).selected,null);
 await page.locator('#tiles .tile').nth(0).click();await page.keyboard.press('Escape');assert.equal((await snapshot()).selected,null);
 await page.locator('#tiles .tile').nth(3).click();await page.locator('#field').click({position:{x:4,y:4}});assert.equal((await snapshot()).selected,null);
 await page.locator('#tiles .tile').nth(1).click();await page.locator('#field').click({button:'right',position:{x:4,y:4}});assert.equal((await snapshot()).selected,null);
 assert.equal(await page.locator('[data-motion="spin"]').isDisabled(),true);assert.equal(await page.locator('#solo').isDisabled(),true);assert.equal(await page.locator('[data-motion="variants"]').isEnabled(),true);
});
