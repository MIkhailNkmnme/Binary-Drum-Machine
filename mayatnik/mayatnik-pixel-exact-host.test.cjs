const test=require('node:test'),assert=require('node:assert/strict');
const Host=require('./mayatnik-pixel-exact-host.js'),Grid=require('./mayatnik-pixel-grid.js');
test('host snaps to canonical angle lattice, preserves state and rejects incompatible 1:1',()=>{
 for(const dpr of [1,1.25,2])for(const angle of [0,45,90,135,180,225,270,315]){
  const state={zLimit:false,angle},messages=[],api=Host.create({getState:()=>state,getGeometry:s=>({width:100,height:60,angle:s.angle,dpr}),onError:s=>messages.push(s)});
  for(const base of [undefined,2,3,10])for(const wanted of [.001,.9,1,2.9,7.8,500,1e8])assert.ok(Grid.raster(api.snap(wanted,'nearest',base),api.policyFor()));
  assert.equal(state.angle,angle);assert.equal(state.zLimit,false);assert.equal(api.canState({zLimit:true}),angle%90===0);
  const scale=api.snap(.01);assert.equal(api.format(scale),angle%90?'√2/1':'1/1');assert.ok(Grid.raster(api.exportScale()/dpr,api.policyFor()));
 }
});
test('failed policies report once and never pretend a lossy scale is exact',()=>{
 const state={bad:true},messages=[],api=Host.create({getState:()=>state,getGeometry:s=>s.bad?{reason:'unsupported'}:{width:3,height:2},onError:s=>messages.push(s)});
 assert.equal(api.snap(1),null);assert.equal(api.snap(2),null);assert.deepEqual(messages,['unsupported']);assert.equal(api.canState({bad:false}),true);state.bad=false;assert.equal(api.snap(1),1);assert.deepEqual(messages,['unsupported','']);
});
test('exact export can use the visible diagonal lattice when a double-density raster exceeds the cap',()=>{
 const api=Host.create({getState:()=>({}),getGeometry:()=>({width:2000,height:2000,angle:45})});assert.equal(api.policyFor().maxK,1);assert.equal(api.exportScale(),Math.SQRT2);
});
test('nearest copy retains every logical bit when reducing repeated internal raster pixels',()=>{
 const width=17,height=9,RK=3,data=new Uint8ClampedArray(width*height*RK*RK*4);
 for(let y=0;y<height*RK;y++)for(let x=0;x<width*RK;x++){const q=(y*width*RK+x)*4,bit=Math.floor(y/RK)*width+Math.floor(x/RK);data.set([bit,255-bit,bit%7,255],q);}
 const source={width:width*RK,height:height*RK,data},before=data.slice(),copy=Host.resampleNearest(source,width,height);
 for(let i=0;i<width*height;i++)assert.deepEqual([...copy.data.slice(i*4,i*4+4)],[i,255-i,i%7,255]);assert.deepEqual(data,before);
 assert.throws(()=>Host.resampleNearest(source,20000,2),RangeError);
});
