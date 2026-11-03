const test=require('node:test'),assert=require('node:assert/strict'),I=require('./mayatnik-invert.js');
test('auto changes once per presented frame, including manual jumps, reverse and restored phase',()=>{
 const st={invertAuto:true,invertFrame:2,inverted:false};
 assert.equal(I.show(st,2),false);assert.equal(I.show(st,4),true);assert.equal(st.inverted,true);
 const saved=JSON.parse(JSON.stringify(st));assert.equal(I.show(saved,4),false);assert.equal(saved.inverted,true);
 assert.equal(I.show(saved,2),true);assert.equal(saved.inverted,false);
 saved.invertAuto=false;assert.equal(I.show(saved,3),false);
 const fresh={invertAuto:true};assert.equal(I.show(fresh,7),false);assert.equal(fresh.invertFrame,7);
});
test('invert flips present bits only, keeps source immutable and separates palette from semantics',()=>{
 const source=Int8Array.of(-1,0,1,-2),next=I.values(source);
 assert.deepEqual([...next],[-1,1,0,-2]);assert.deepEqual([...source],[-1,0,1,-2]);
 assert.equal(I.values(next,true),next);assert.deepEqual(next,source);
 for(const invertKind of ['bits','colour'])for(const inverted of [false,true]){
  const st={invertKind,inverted};assert.equal(I.bits(st),inverted&&invertKind==='bits');assert.equal(I.colour(st),inverted&&invertKind==='colour');
 }
});

const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require.resolve('./Zerkalius-mayatnik.html'),'utf8');
function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a,start);return html.slice(a,b);}
function host(){
 const noop=()=>{},source=Int8Array.of(0,1,-1,1,0,1);
 const c={st:{bitZeroColour:'#111a2c',bitOneColour:'#acdef0',overOneColour:'#ffaabb',overZeroColour:'#001122',view:'bits'},window:{},MayatnikInvert:I,
  f:{val:source,W:3,H:2},k:4,VX:0,VW:3,VH:2,RK:1,img:{width:3,height:2},gpuBig:null,
  fillBits:null,bmGen:0,Event:class{},dispatchEvent:noop,clearFillPreview:noop,save:noop,queueSession:noop,queueDigits:noop,cacheRestoring:false,
  PAL:{bits:[[],[]],col:[[],[]]},manualPaintKey:()=>'work',manualPatternGeometry:()=>'flat',rombP:()=>-1,faceCurrent:()=>false,contourBits:null,templateMatchLayer:null,
  paintBits:null,currentManualMirrorMap:null,manualPaintCellAt:noop,parityVisible:()=>true,outShow:()=>false,pxHidden:()=>false};
 const plan={active:false,sourceRow:r=>r,settings:{rowFill:'none'}};c.parityPlan=()=>plan;
 c.plan=plan;vm.createContext(c);
 vm.runInContext(section('  let invertTrackingReady=', '  function parityCommit(')+section('  const hexRGB=', '  const DIGIT_FONTS=')+
   section('  function visibleSemanticContext(', '  function visibleSemanticSnapshot(')+section('  function draw() {','    try{')+'}',c);
 vm.runInContext('invertTrackingReady=true;',c);return c;
}
test('live API keeps numeric, RGB and overlay paint reads distinct across toggles, seeks and restores',()=>{
 const c=host(),api=c.window.mayInvert,raw=c.f.val.slice(),values=()=>Array.from(c.parityValues()),colour=v=>Array.from(c.PAL.bits[v][0]);
 const source=values();c.paintBits=Int8Array.of(-1,0,-1,-1,-1,-1);
 const read=()=>{const semantic=c.visibleSemanticContext();return [0,1,2].map(x=>semantic.readBit(x,0));};
 assert.deepEqual(read(),[0,0,-1]);api.toggle();assert.deepEqual(values(),[1,0,-1,0,1,0]);assert.deepEqual(read(),[1,1,-1]);
 assert.equal(c.storedInk(0,0xff332211),0xff332211);assert.equal(c.storedInk(0,0xff000000),0xffffffff);
 assert.deepEqual(colour(1),[172,222,240]);api.setKind('colour');assert.deepEqual(values(),source);assert.deepEqual(read(),[0,0,-1]);
 assert.deepEqual(colour(1),[17,26,44]);assert.deepEqual(colour(0),[172,222,240]);assert.deepEqual(Array.from(c.PAL.col[0][1]),[255,170,187]);
 assert.equal(c.storedInk(0,0xff000000),0xff000000);
 api.setAuto(true);c.k=6;c.draw();assert.equal(api.get().inverted,false);c.draw();assert.equal(api.get().inverted,false);
 c.k=3;c.draw();assert.equal(api.get().inverted,true);const saved=JSON.stringify(c.st);
 const restored=host();Object.assign(restored.st,JSON.parse(saved));restored.k=3;restored.draw();assert.equal(restored.st.inverted,true);
 c.cacheRestoring=true;c.k=0;c.draw();c.k=3;c.draw();assert.equal(c.st.inverted,true);assert.deepEqual(c.f.val,raw);
});
test('row fill materializes before complement, preserving missing cells and construction history',()=>{
 const c=host();c.plan.active=true;c.plan.materialize=f=>Int8Array.from([...f.val.slice(0,3),...f.val.slice(0,3)]);
 c.window.mayInvert.toggle();assert.deepEqual(Array.from(c.parityValues()),[1,0,-1,1,0,-1]);
 assert.deepEqual(Array.from(c.f.val),[0,1,-1,1,0,1]);c.window.mayInvert.toggle();assert.deepEqual(Array.from(c.parityValues()),[0,1,-1,0,1,-1]);
});

test('GPU shown samples and inverts only a present visible source cell after row remapping',()=>{
 const code=fs.readFileSync(require.resolve('./mayatnik-gpu.js'),'utf8'),a=code.indexOf('fn shown('),b=code.indexOf('fn semantic(',a);
 const shader=code.slice(a,b).replace(/^fn /,'function ').replace(/:\s*i32/g,'').replace(/\s*->\s*i32/g,'');
 const P=new Int32Array(41),raw=Int8Array.of(1,0,-1,0,1,0);
 const c={P,select:(a,b,on)=>on?b:a,raw:(r,x)=>raw[3*r+x],parityRow:()=>1,parityShown:(r,c)=>c<2,outZone:()=>false,triFill:()=>false};
 vm.createContext(c);vm.runInContext(shader,c);
 assert.deepEqual([0,1,2].map(x=>c.shown(0,x)),[0,1,-1]);P[10]=8;
 assert.deepEqual([0,1,2].map(x=>c.shown(0,x)),[1,0,-1]);c.parityRow=()=>0;c.parityShown=()=>true;assert.equal(c.shown(0,2),-1);
 assert.deepEqual([...raw],[1,0,-1,0,1,0]);assert.match(code,/o\.invertBits\?8:0/);
});

test('a mirrored visible one is stored in raw orientation and reads back as one while inverted',()=>{
 const c=host();Object.assign(c,{f:{W:1,H:2,val:Int8Array.of(0,1)},img:{width:1,height:2,data:new Uint8ClampedArray(8)},VW:1,VH:2,
  cv:{getBoundingClientRect:()=>({width:1,height:2})},scale:()=>1,fillMask:null,mirrorXor:false,rgba:rgb=>(0xff000000|rgb[0]|rgb[1]<<8|rgb[2]<<16)>>>0,$:()=>({})});
 c.st.userLines=[[0,1,1,1]];c.st.inverted=true;
 c.rasterBit=(x,y,original)=>original||c.paintBits?.[y]==null||c.paintBits[y]<0?c.parityValues()[y]:c.storedBit(c.paintBits[y]);
 vm.runInContext(section('  function mirrorDownAxis(', '  function mirrorApply('),c);
 assert.equal(c.mirrorDownAxis(),1);assert.equal(c.paintBits[1],0);assert.equal(c.rasterBit(0,1),1);
 assert.deepEqual([...c.f.val],[0,1]);c.window.mayInvert.toggle();assert.equal(c.rasterBit(0,1),0);
});
