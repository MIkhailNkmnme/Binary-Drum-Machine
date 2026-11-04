'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Frame=require('./mayatnik-gif-frame.js'),Source=require('./mayatnik-animatrix-source.js');
const Work=require('./mayatnik-work-file.js');
function fixture(presentation='pixels'){
 const variant={plan:{width:6,height:8},presentation},bits=Int8Array.of(0,1,-1,1,0,1),frame={rows:2,semantic:{width:3,height:2,bits,bounds:presentation==='scale'?{left:1,top:3,width:3,height:2}:{left:0,top:0,width:6,height:8}}};
 const pixels=Uint8ClampedArray.from({length:6*8*4},(_,i)=>i%4===3?255:(i*37)%256);return {variant,frame,pixels};
}
test('enlarged frame preserves semantic cells and actual GIF RGB through native encoding',async()=>{
 const {variant,frame,pixels}=fixture(),state={rows:512,heat:true,inverted:true,edgeRhombOn:true,joined180:true,prepareOpen:true,deliverOpen:true,parity:{rowsOdd:false},view:'romb0'},before=structuredClone(state);
 const work=Frame.work(variant,frame,pixels,state),seed=Source.decode(work.st.animatrixSource);
 assert.deepEqual(state,before);assert.equal(work.width,6);assert.equal(work.height,8);assert.equal(work.st.view,'bits');assert.equal(work.st.heat,false);assert.equal(work.st.inverted,false);assert.equal(work.st.prepareOpen,true);assert.equal(work.st.deliverOpen,true);assert.deepEqual(work.st.parity,{});Source.assertState(work.st);
 for(let y=0;y<8;y++)for(let x=0;x<6;x++){const q=y*6+x,bit=frame.semantic.bits[Math.floor(y/4)*3+Math.floor(x/2)];assert.equal(work.field[q],bit);assert.equal(seed.present[q]?seed.bits[q]:-1,bit);assert.equal(seed.fills[q],(pixels[q*4]<<16)|(pixels[q*4+1]<<8)|pixels[q*4+2]);}
 const blob=await Work.encode(work),restored=(await Work.decode(blob)).data;assert.deepEqual(restored.field,work.field);assert.deepEqual(Source.decode(restored.st.animatrixSource),seed);
});
test('generated work passes the native whole-frame validator and source restores frame zero',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8'),code=html.slice(html.indexOf('  function validateFrameWork('),html.indexOf('  function frameWorkOnly('));
 const deps={Int8Array,Uint8Array,Uint32Array,Uint8ClampedArray,MayatnikFaceTransform:{validate(){}},templatePaintValidate(){},assertWorkEvolution:Source.assertState,fieldFrames:Source.frames,fieldGeometry:Source.geometry,animatrixOn:Source.active};vm.createContext(deps);vm.runInContext(code,deps);
 const {variant,frame,pixels}=fixture(),work=Frame.work(variant,frame,pixels);assert.equal(deps.validateFrameWork({format:'mayatnik-work',version:2,data:work}),work);
 const engine=Source.create(work.st),restored=new Int8Array(work.field.length);Source.copyTo(engine,restored);assert.deepEqual(restored,work.field);
});
test('centred frame retains empty margins and exact one-to-one bit addresses',()=>{const {variant,frame,pixels}=fixture('scale'),work=Frame.work(variant,frame,pixels);for(let y=0;y<8;y++)for(let x=0;x<6;x++)assert.equal(work.field[y*6+x],x>=1&&x<4&&y>=3&&y<5?frame.semantic.bits[(y-3)*3+x-1]:-1);});
test('mixed bits, missing semantics, invalid bounds, oversized native field and transparent pixels reject',()=>{
 const {variant,frame,pixels}=fixture();frame.semantic.bits[0]=-2;assert.throws(()=>Frame.work(variant,frame,pixels),/смешанные/);frame.semantic.bits[0]=0;
 assert.throws(()=>Frame.validate(variant,{}),/карту битов/);assert.throws(()=>Frame.validate({plan:{width:4096,height:4096}},frame),/2 100 000/);
 frame.semantic.bounds.left=1;assert.throws(()=>Frame.validate(variant,frame),/границы/);frame.semantic.bounds.left=0;pixels[3]=0;assert.throws(()=>Frame.work(variant,frame,pixels),/Прозрачный/);
});
