'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a);return html.slice(a,b);}
function fixture(axes=[{k:'v',p:0,axisNo:1,paint:0}],extra={}){
 const W=9,H=6,bits=Int8Array.from({length:W*H},(_,q)=>q%W<5?0:1),pixels=Uint32Array.from(bits,v=>v?0xffeeeeee:0xff222222),nodes={bAxesColour:{},fillInfo:{},fillMirror:{checked:false}},history=[],st={rows:H,view:'bits',linesOn:true,lineFamilies:{h:true,v:true,d:true},ztlMain:false,ztPaint:0,zl:axes,anchorAxis:false,fixLines:false,fixCross:false,fillArea:'sides',...extra};let zen=false;
 const c={st,f:{W,H,val:bits},geo:{anchor:4},img:{width:W,height:H,data:new Uint8ClampedArray(pixels.buffer)},VX:0,VW:W,VH:H,RK:1,RG:0,dispW:()=>W,dispH:()=>H,parityVisible:()=>true,outShow:()=>false,parityValues:()=>bits,rombP:()=>-1,joinedOn:()=>false,joinedDiamond:()=>false,joinedSquare:()=>false,joinedWhole:()=>false,displayCell:(x,y)=>{const col=Math.floor(x),r=Math.floor(y);return col>=0&&col<W&&r>=0&&r<H?{c:col,r,p:-1,q:r*W+col}:null;},displayPoint:(col,r)=>({x:col+.5,y:r+.5}),document:{body:{classList:{contains:()=>zen}}},picOn:()=>true,
  MayatnikManualLines:require('./mayatnik-manual-lines'),MayatnikAxisColour:require('./mayatnik-axis-colour'),MayatnikAutoAxisGeometry:require('./mayatnik-auto-axis-geometry'),MayatnikNAxes:{normaliseSets:()=>[]},MayatnikCellArea:require('./mayatnik-cell-area'),MayatnikFill:require('./mayatnik-fill'),fixLinesDraw(){},zlList:()=>st.zl,zlFamilyOn:kind=>st.linesOn&&st.lineFamilies[kind==='e'?'d':kind]!==false,
  sessionReady:true,cacheRestoring:false,frameLibraryBusy:false,templateDragging:false,gpuBig:null,bmGen:0,k:3,window:{},performance,setTimeout,symPending:false,autoAxesPending:false,navQuick:()=>false,fillMask:null,autoVertical:1,fillBits:null,pxView:()=>c.img,paintToolColour:()=>'#123456',rgba:()=>0xff563412,stopFrameTransports(){},$:id=>nodes[id],pushHistory:entry=>history.push(entry),fillSync(){},draw(){c.draws++;},draws:0,savePaint(){},EMPTY:[],halfOf:x=>[-1,x],fieldCellAt:(x,y)=>c.displayCell(x+.5,y+.5),cellPixels:(cell,visit)=>visit(cell.r*W+cell.c)};
 c.fillBit=c.rasterBit=c.toolBitAt=(x,y)=>x>=0&&x<W&&y>=0&&y<H?bits[Math.floor(y)*W+Math.floor(x)]:-1;
 vm.createContext(c);vm.runInContext(section('  function manualPaintAxes(){','  function manualPaintOn(){')+section('  function paintSelection(','  // v0.202:')+section('  let axesColourBusy=','  // v0.480:'),c);return {c,st,bits,pixels,history,nodes,setZen:value=>{zen=value;}};
}
const sorted=value=>Array.from(value).sort((a,b)=>a-b);
test('manual vertical alone enables From axes and traces its exact centres regardless of continuous paint flags',()=>{
 for(const paint of [0,1,2,3]){const {c,bits}=fixture([{k:'v',p:0,axisNo:1,paint}]),before=bits.slice();assert.equal(c.axesColourStatus().ready,true);const found=c.axesColourSeeds();assert.equal(found.axes,1);assert.deepEqual(sorted(found.indices),[4,13,22,31,40,49]);assert.deepEqual(bits,before);}
});
test('manual vertical boundary seeds both neighbouring columns; horizontal boundary seeds both neighbouring rows',()=>{
 const vertical=fixture([{k:'v',p:.5,axisNo:1,paint:0}]).c;assert.deepEqual(sorted(vertical.axesColourSeeds().indices),Array.from({length:6},(_,r)=>[r*9+4,r*9+5]).flat());
 const horizontal=fixture([{k:'h',p:2,axisNo:2,paint:0}]).c;assert.deepEqual(sorted(horizontal.axesColourSeeds().indices),Array.from({length:18},(_,i)=>9+i));
});
test('hidden families, disabled lines, off-field axes and unpinned Zen controls contribute no manual seeds',()=>{
 for(const configure of [f=>f.st.linesOn=false,f=>f.st.lineFamilies.v=false,f=>f.st.zl[0].p=100,f=>f.setZen(true)]){const f=fixture();configure(f);assert.equal(f.c.axesColourManualGuides().length,0);assert.equal(f.c.axesColourStatus().ready,false);}
 const pinned=fixture();pinned.setZen(true);pinned.st.ztlZen=true;assert.equal(pinned.c.axesColourStatus().ready,true);assert.equal(pinned.c.axesColourSeeds().indices.length,6);
});
test('manual one-shot From axes uses connected-area fill, one undo transaction, and leaves original bits and pixels unchanged',async()=>{
 const {c,bits,pixels,history}=fixture([{k:'v',p:.5,axisNo:1,paint:0}]),beforeBits=bits.slice(),beforePixels=pixels.slice();const result=await c.window.mayAxesColour.apply();assert.equal(result.axes,1);assert.equal(result.changed,54);assert.equal(history.length,1);assert.equal(c.draws,1);assert.ok(c.fillMask.every(value=>value===0xff563412));assert.deepEqual(bits,beforeBits);assert.deepEqual(pixels,beforePixels);
 const repeated=await c.window.mayAxesColour.apply();assert.equal(repeated.changed,0);assert.equal(history.length,1);for(let i=0;i<history[0].indices.length;i++)c.fillMask[history[0].indices[i]]=history[0].previous[i];assert.ok(c.fillMask.every(value=>value===0));assert.deepEqual(bits,beforeBits);
});
