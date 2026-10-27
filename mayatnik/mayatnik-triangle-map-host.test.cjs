const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require.resolve('./Zerkalius-mayatnik.html'),'utf8'),Fill=require('./mayatnik-fill.js'),M=require('./mayatnik-triangle-map.js'),D=require('./mayatnik-triangle-map-data.js'),Core=require('./mayatnik-core.js');
function selection(mode){
  const W=13,H=11,pixels=new Uint32Array(W*H).fill(0xff123456),blocked=Uint8Array.from({length:W*H},(_,q)=>q%W===6?1:0),stored=new Uint32Array(W*H).fill(0xff223344);
  const c={MayatnikFill:Fill,st:{fillArea:mode,triangleMapMask:true},triangleMapRasterMask:()=>blocked,fillMask:stored,img:{width:W,height:H,data:new Uint8ClampedArray(pixels.buffer)},pxView:()=>c.img,autoVertical:0,fillBits:null,RK:1,VX:0,VW:W,VH:H,geo:{anchor:6},rgba:()=>0,EMPTY:[],joinedOn:()=>false,halfOf:x=>[-1,x],rombP:()=>-1,displayPoint:(c,r)=>({x:c+.5,y:r+.5}),fieldCellAt:(x,y)=>x>=0&&x<W&&y>=0&&y<H?{c:x,r:y,p:-1,ox:0}:null,fillBit:(x,y)=>x>=0&&x<W&&y>=0&&y<H?0:-1,rasterBit:(x,y)=>x>=0&&x<W&&y>=0&&y<H?0:-1,cellPixels:(cell,visit)=>visit(cell.r*W+cell.c)};
  vm.createContext(c);const start=html.indexOf('  function paintSelection(');vm.runInContext(html.slice(start,html.indexOf('  // v0.202:',start)),c);return {c,blocked,stored,pixels,W,H};
}
test('every selection mode treats the mask as traversal barrier and preserves old paint/bits',()=>{
  for(const mode of ['sides','corners','diagonal','chess0','bit']){
    const {c,stored,pixels,W}=selection(mode),beforePaint=stored.slice(),beforePixels=pixels.slice(),a=c.paintSelection(2,5,false,true).indices;
    assert.ok(a.length>0);assert.ok([...a].every(q=>q%W<6),mode+' leaked across wall');
    assert.equal(c.paintSelection(6,5,false,true).indices.length,0,mode+' accepted blocked seed');
    assert.deepEqual(stored,beforePaint);assert.deepEqual(pixels,beforePixels);
    c.st.triangleMapMask=false;const b=c.paintSelection(2,5,false,true).indices;if(mode!=='bit')assert.ok([...b].some(q=>q%W>6));
  }
});
test('vertical column fills also respect the barrier and mirrored blocked destinations',()=>{
  const {c,blocked,W}=selection('sides');c.autoVertical=2;
  const result=c.paintSelection(2,0,false).indices;assert.ok(result.length>0);assert.ok([...result].every(q=>q%W<6));
  blocked.fill(1);assert.equal(c.paintSelection(2,0,true).indices.length,0);
});
function host(){
  const g=Core.geometry('pend',512,512),f=Core.field(g.W,512,'empty',g.anchor);Core.cone(f,g.anchor,512);const nodes=new Map();
  const c={st:{rows:512,mode:'pend',bg:'empty',triangleMapSource:'static',triangleMapMask:true,view:'bits'},f,geo:g,k:1,bmGen:0,VX:g.anchor-10,VW:21,VH:24,RK:1,RG:0,img:{width:21,height:24},gpuBig:null,testPattern:null,foldBack:null,window:{},MayatnikTriangleMap:M,MayatnikTriangleMapData:D,compareOn:()=>false,pairOn:()=>false,$:id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',value:'',checked:false});return nodes.get(id);},fieldCellAt:(x,y)=>({c:x+c.VX,r:y,q:y*f.W+x+c.VX})};
  vm.createContext(c);vm.runInContext(html.slice(html.indexOf('  let triangleMapCache='),html.indexOf('  let autoAxesRevision=')),c);return {c,api:c.window.mayTriangleMap,nodes};
}
test('runtime refuses unsupported states explicitly and blocks mask writes',()=>{
  for(const change of [c=>c.st.rows=256,c=>c.st.mode='right',c=>c.st.bg='0',c=>c.pairOn=()=>true,c=>c.foldBack={},c=>c.testPattern={},c=>{c.st.triangleMapSource='time';c.k=501;}]){
    const {c,api}=host();change(c);assert.ok(api.get().error);assert.ok(api.mask().every(v=>v===1));
  }
});
test('time switch and empty tracked frames are current, atomic, and independent of steps',()=>{
  const {c,api}=host();assert.equal(api.get().triangles.length,1093);assert.strictEqual(api.get(),api.get());
  c.st.triangleMapSource='time';c.k=179;assert.equal(api.get().triangles.length,1);c.k=180;assert.equal(api.get().triangles.length,0);assert.ok(api.mask().every(v=>v===0));
  c.k=500;c.st.steps=500;assert.equal(api.get().triangles.length,0);c.k=501;assert.match(api.get().error,/1–500/);
});
test('raster mask equals exact logical ownership in the visible crop',()=>{
  const {c,api}=host(),data=api.get(),mask=api.mask();for(let y=0;y<c.img.height;y++)for(let x=0;x<c.img.width;x++)assert.equal(mask[y*c.img.width+x],data.blocked[y*c.f.W+x+c.VX]);
  const before=c.f.val.slice();c.st.triangleMapMask=false;assert.equal(api.mask(),null);assert.deepEqual(c.f.val,before);
});
