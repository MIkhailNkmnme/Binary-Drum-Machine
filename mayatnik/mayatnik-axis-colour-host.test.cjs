const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Fill=require('./mayatnik-fill.js'),html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function fixture(mode){
 const W=17,H=15,pixels=Uint32Array.from({length:W*H},(_,q)=>[0xff112233,0xff445566,0xff778899][(q*7+Math.floor(q/W)*3)%3]),bits=Int8Array.from({length:W*H},(_,q)=>(q+Math.floor(q/W))%3?0:1);
 let allocations=0;class Counted extends Uint32Array{constructor(...args){super(...args);if(typeof args[0]==='number'&&args[0]===W*H)allocations++;}}
 const c={Uint32Array:Counted,MayatnikFill:Fill,st:{fillArea:mode},img:{width:W,height:H,data:new Uint8ClampedArray(pixels.buffer)},pxView:()=>c.img,autoVertical:1,fillBits:null,RK:1,VX:0,VW:W,VH:H,geo:{anchor:8},rgba:()=>0,EMPTY:[],joinedOn:()=>false,halfOf:x=>[-1,x],rombP:()=>-1,displayPoint:(c,r)=>({x:c+.5,y:r+.5}),fieldCellAt:(x,y)=>x>=0&&x<W&&y>=0&&y<H?{c:x,r:y,p:-1,ox:0}:null,fillBit:(x,y)=>x>=0&&x<W&&y>=0&&y<H?bits[y*W+x]:-1,rasterBit:(x,y)=>x>=0&&x<W&&y>=0&&y<H?bits[y*W+x]:-1,cellPixels:(cell,visit)=>visit(cell.r*W+cell.c),allocations:()=>allocations};
 vm.createContext(c);let start=html.indexOf('  function paintSelection(');vm.runInContext(html.slice(start,html.indexOf('  // v0.202:',start)),c);return c;
}
test('batch equals union on the immutable original image; manualOnly ignores active Columns',()=>{
 const seeds=Uint32Array.from([19,20,21,23,38,71,170,171,239]);
 for(const mode of ['sides','corners','diagonal','chess0','bit'])for(const mirror of [false,true]){
  const c=fixture(mode),before=Array.from(c.img.data),expected=new Set();
  for(const q of seeds)for(const p of c.paintSelection(q%c.img.width,Math.floor(q/c.img.width),mirror,true).indices)expected.add(p);
  const actual=c.paintSelection(0,0,mirror,true,seeds).indices;
  assert.deepEqual(Array.from(actual).sort((a,b)=>a-b),[...expected].sort((a,b)=>a-b),mode+' '+mirror);assert.deepEqual(Array.from(c.img.data),before);
 }
});
test('batch uses one scratch flood queue even for many differently coloured regions',()=>{
 const c=fixture('sides'),before=c.allocations(),queues=[];c.MayatnikFill={...Fill,fill(...args){queues.push(args[5]);return Fill.fill(...args);}};c.paintSelection(0,0,false,true,Uint32Array.from({length:255},(_,q)=>q));
 // Output, image copy, one scratch queue, and the final owned output.
 assert.equal(c.allocations()-before,4);assert.ok(queues.length>10);assert.ok(queues[0] instanceof Uint32Array);assert.ok(queues.every(q=>q===queues[0]));
});
test('scratch flood output matches legacy owned output for sides and corners',()=>{
 for(const diagonal of [false,true]){
  const original=Uint32Array.from([1,2,1,2,1,2,1,2,1]),a=original.slice(),b=original.slice(),scratch=new Uint32Array(a.length);
  assert.deepEqual([...Fill.fill(a,3,0,8,diagonal)],[...Fill.fill(b,3,0,8,diagonal,scratch)]);assert.deepEqual(a,b);
  assert.deepEqual([...Fill.fill(b,3,1,9,diagonal,scratch)],[1,3,5,7].filter(q=>diagonal||q===1));
 }
});

test('apply is one undoable paint-only transaction and repeating the colour is a no-op',async()=>{
 const c=fixture('bit'),controls={bAxesColour:{},fillInfo:{},fillColour:{value:'#123456'},fillMirror:{checked:true}},history=[];let draw=0,saves=0;
 Object.assign(c,{$:id=>controls[id],window:{},sessionReady:true,cacheRestoring:false,frameLibraryBusy:false,templateDragging:false,f:{},geo:{anchor:8},gpuBig:null,k:7,stop(){},navQuick:()=>false,fillMask:null,paintBits:Uint8Array.from([0,1,0]),pushHistory:entry=>history.push(entry),fillSync(){},draw(){draw++;},savePaint(){saves++;},rgba:rgb=>(0xff000000|rgb[2]<<16|rgb[1]<<8|rgb[0])>>>0,MayatnikNAxes:{normaliseSets:()=>[{row:0}]},dispH:()=>15});
 const start=html.indexOf('  let axesColourBusy=');vm.runInContext(html.slice(start,html.indexOf('  // v0.480:',start)),c);vm.runInContext('axesColourSeeds=()=>({indices:Uint32Array.from([19,20,21]),axes:2})',c);
 const before=Array.from(c.img.data),first=await c.window.mayAxesColour.apply();assert.equal(first.changed,3);assert.equal(history.length,1);assert.equal(draw,1);assert.equal(saves,1);assert.deepEqual(Array.from(c.paintBits),[0,1,0]);assert.deepEqual(Array.from(c.img.data),before);assert.ok(history[0].previous.every(v=>v===0));assert.ok(history[0].next.every(v=>v===0xff563412));
 const second=await c.window.mayAxesColour.apply();assert.equal(second.changed,0);assert.equal(history.length,1);assert.equal(draw,1);assert.equal(saves,1);
 for(let i=0;i<history[0].indices.length;i++)c.fillMask[history[0].indices[i]]=history[0].previous[i];assert.ok(c.fillMask.every(v=>v===0));
 c.gpuBig={fresh:true,k:7};c.rombP=()=>0;const denied=await c.window.mayAxesColour.apply();assert.match(denied.reason,/GPU/);assert.equal(history.length,1);assert.ok(c.fillMask.every(v=>v===0));
});
