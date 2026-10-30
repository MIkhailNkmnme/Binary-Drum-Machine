const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),Joined=require('./mayatnik-joined-romb.js');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function fn(name){const start=html.indexOf('function '+name+'(');assert.ok(start>=0,name);let end=html.indexOf('{',start)+1,depth=1;for(;depth;end++){if(html[end]==='{')depth++;else if(html[end]==='}')depth--;}return html.slice(start,end);}
function fixture(width,height,rotate,rk=2){
 const origin=2,anchor=4,fieldWidth=width+4,jg=Joined.create({width,height,origin,anchor,fieldWidth,rotate}),val=Int8Array.from({length:fieldWidth*height},(_,q)=>(q+Math.floor(q/fieldWidth))%3-1);
 const c=vm.createContext({st:{view:rotate?'rombJoin180':'rombJoin',frozen:false},f:{W:fieldWidth,H:height,val},geo:{anchor},VX:origin,VW:width,VH:height,RK:rk,RG:0,
  img:{width:jg.width*rk,height:jg.height*rk},joinedOn:()=>true,joinedGeometry:()=>jg,halfOf:()=>[3,0],rombP:()=>3,parityVisible:()=>true,outShow:()=>false,outZone:()=>false,
  paintBits:null,templateMatchLayer:null,gpuBig:null,fillMask:null,faceCurrent:()=>false,gpuDisplay:()=>false,rgba:c=>(0xff000000|c[2]<<16|c[1]<<8|c[0])>>>0,Uint32Array,Int8Array,Float64Array});
 for(const name of ['displayPoint','displayCell','fieldCellAt','rasterBit','drawRomb'])vm.runInContext(fn(name),c);
 return {c,jg,val};
}
test('CPU raster, hit test and raster bit agree for both joined views at every raster scale',()=>{
 const colours=Uint32Array.of(0xff555555,0xff555555,0xff555555,0xffeeeeee,0xffeeeeee,0xffeeeeee),empty=0xff000000;
 for(const rotate of [false,true])for(const width of [4,5])for(const height of [3,4])for(const rk of [1,2,8]){
  const {c,jg,val}=fixture(width,height,rotate,rk),before=val.slice(),px=new Uint32Array(c.img.width*c.img.height);c.drawRomb(px,colours,empty,null);
  for(let y=0;y<c.img.height;y++)for(let x=0;x<c.img.width;x++){
   const hit=jg.hit((x+.5)/rk,(y+.5)/rk),v=hit?val[hit.q]:-1;
   assert.equal(px[y*c.img.width+x],v<0?empty:colours[v*3]);assert.equal(c.rasterBit(x,y),v);
   assert.equal(c.fieldCellAt(x,y)?.q??null,hit?.q??null);
  }
  assert.deepEqual(val,before);
 }
});
test('paint overrides and source parity masks refer to the correct lower-half source cell',()=>{
 for(const rotate of [false,true]){
  const {c,jg}=fixture(8,5,rotate),lower=jg.forward(3,4),x=Math.floor((lower.x+.5)*c.RK),y=Math.floor((lower.y+.5)*c.RK);
  assert.equal(lower.p,1);c.paintBits=new Int8Array(c.img.width*c.img.height).fill(-1);c.paintBits[y*c.img.width+x]=1;
  assert.equal(c.rasterBit(x,y),1);assert.equal(c.rasterBit(x,y,true),c.f.val[lower.q]);
  c.parityVisible=(r,col)=>r!==4;assert.equal(c.fieldCellAt(x,y),null);assert.equal(c.rasterBit(x,y),-1);
 }
});
test('GPU source capture maps into complete joined display extent without altering source pixels',()=>{
 for(const rotate of [false,true]){
  const {c,jg}=fixture(4,3,rotate,1),source={width:4,height:3,data:new Uint8ClampedArray(48)},input=new Uint32Array(source.data.buffer);input.set(Array.from({length:12},(_,i)=>0xff000000+i+1));
  c.gpuBig={};c.gpuDisplay=()=>true;c.pxView=()=>source;c.rgba=()=>0xff000000;c.EMPTY=[0,0,0];c.ImageData=class {constructor(w,h){this.width=w;this.height=h;this.data=new Uint8ClampedArray(w*h*4);}};
  vm.runInContext(fn('capturePicture'),c);const before=Array.from(input),out=c.capturePicture(),pixels=new Uint32Array(out.data.buffer);assert.equal(out.width,jg.width);assert.equal(out.height,jg.height);
  for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++){const q=jg.hit(x+.5,y+.5);assert.equal(pixels[y*out.width+x],q?input[q.r*4+q.c-c.VX]:0xff000000);}
  assert.deepEqual(Array.from(input),before);
 }
});
test('common 180 toggle is offered; legacy geometry remains loadable and full-height paths share display height',()=>{
 assert.match(html,/<option value="rombJoin" hidden disabled/);assert.match(html,/<option value="rombJoin180" hidden disabled/);
 for(const name of ['canvasSize','cssLayout','drawDigits','framePreviewBounds','wholeFrameThumbnail','captureScaleGifFrame','frameSnapshot','cellSource'])assert.match(fn(name),/dispH\(/,name);
 assert.match(fn('gpuRender'),/joined:joinedOn/);assert.match(fn('paintSymmetry'),/joinedGeometry\(\)\.parts/);
 for(const match of html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
});
