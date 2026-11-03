const test=require('node:test'),assert=require('node:assert/strict');
const Host=require('./mayatnik-pixel-exact-host.js'),Grid=require('./mayatnik-pixel-grid.js');
test('host snaps to canonical angle lattice, preserves state and rejects incompatible 1:1',()=>{
 for(const dpr of [1,1.25,2])for(const angle of [0,45,90,135,180,225,270,315]){
  const state={zLimit:false,angle},messages=[],api=Host.create({getState:()=>state,getGeometry:s=>({width:100,height:60,angle:s.angle,dpr}),onError:s=>messages.push(s)});
  for(const base of [undefined,2,3,10])for(const wanted of [.001,.9,1,2.9,7.8,500,1e8])assert.ok(Grid.raster(api.snap(wanted,'nearest',base),api.policyFor()));
  assert.equal(state.angle,angle);assert.equal(state.zLimit,false);assert.equal(api.canState({zLimit:true}),angle%90===0);
  const scale=api.snap(api.policyFor().exactMinScale);assert.equal(api.format(scale),angle%90?'√2/1':'1/1');assert.ok(Grid.raster(api.exportScale()/dpr,api.policyFor()));
 }
});
test('failed policies report once and never pretend a lossy scale is exact',()=>{
 const state={bad:true},messages=[],api=Host.create({getState:()=>state,getGeometry:s=>s.bad?{reason:'unsupported'}:{width:3,height:2},onError:s=>messages.push(s)});
 assert.equal(api.snap(1),null);assert.equal(api.snap(2),null);assert.deepEqual(messages,['unsupported']);assert.equal(api.canState({bad:false}),true);state.bad=false;assert.equal(api.snap(1),1);assert.deepEqual(messages,['unsupported','']);
});
test('exact export can use the visible diagonal lattice when a double-density raster exceeds the cap',()=>{
 const api=Host.create({getState:()=>({}),getGeometry:()=>({width:2000,height:2000,angle:45})});assert.equal(api.policyFor().maxK,1);assert.equal(api.exportScale(),Math.SQRT2);
});

test('opt-in native export uses the exact minimum lattice without changing the default PNG density or screen zoom',()=>{
 for(const dpr of [1,1.25,2])for(const angle of [0,45,90,135])for(const halfCells of [false,true]){
  const state={zoom:.125,zLimit:false},api=Host.create({viewport:true,getState:()=>state,getGeometry:()=>({width:100,height:60,angle,dpr,halfCells})}),quantum=angle%90?Math.SQRT2:1,minimum=halfCells&&angle%90===0?2:quantum;
  assert.equal(api.exportScale(),angle%90?2*Math.SQRT2:2);assert.equal(api.exportScale(1),minimum);
  state.zoom=512;assert.equal(api.exportScale(1),minimum);assert.equal(api.exportScale(),angle%90?2*Math.SQRT2:2);assert.equal(state.zLimit,false);
 }
 const api=Host.create({getState:()=>({}),getGeometry:()=>({width:8,height:8})});for(const minimum of [0,-1,NaN,Infinity,'1'])assert.equal(api.exportScale(minimum),null);
});
test('nearest copy retains every logical bit when reducing repeated internal raster pixels',()=>{
 const width=17,height=9,RK=3,data=new Uint8ClampedArray(width*height*RK*RK*4);
 for(let y=0;y<height*RK;y++)for(let x=0;x<width*RK;x++){const q=(y*width*RK+x)*4,bit=Math.floor(y/RK)*width+Math.floor(x/RK);data.set([bit,255-bit,bit%7,255],q);}
 const source={width:width*RK,height:height*RK,data},before=data.slice(),copy=Host.resampleNearest(source,width,height);
 for(let i=0;i<width*height;i++)assert.deepEqual([...copy.data.slice(i*4,i*4+4)],[i,255-i,i%7,255]);assert.deepEqual(data,before);
 assert.throws(()=>Host.resampleNearest(source,20000,2),RangeError);
});


test('viewport host display limits and exact full export budgets stay independent',()=>{
 const h=Host.create({viewport:true,getState:()=>({}),getGeometry:()=>({width:2000,height:2000,angle:45})});assert.ok(h.snap(512)>500);assert.equal(h.exportScale(),Math.SQRT2);assert.equal(h.policyFor().viewport,true);
});

test('viewport export retains an explicitly locked physical one-to-one scale',()=>{
 const h=Host.create({viewport:true,getState:()=>({zLimit:true}),getGeometry:()=>({width:100,height:50,dpr:2})});assert.equal(h.exportScale(),1);assert.equal(h.snap(512),.5);
});


test('display minification ignores legacy overview flags while exports and physical 1:1 stay strict',()=>{
 for(const dpr of [1,1.25,2])for(const angle of [0,45,90,135,180,225,270,315])for(const legacy of [undefined,false,true]){
  const state={zOverview:legacy},api=Host.create({viewport:true,getState:()=>state,getGeometry:()=>({width:1024,height:512,angle,dpr})});
  const before={...state},small=api.snap(.125/dpr),policy=api.policyFor();
  assert.ok(small>0&&small<policy.exactMinScale);assert.equal(policy.overview,true);assert.ok(api.format(small));assert.deepEqual(state,before);
  assert.equal(api.exportScale(),angle%90?2*Math.SQRT2:2);
  if(angle%90===0){state.zLimit=true;assert.equal(api.policyFor().overview,false);assert.equal(api.snap(.125),1/dpr);assert.equal(api.snap(512),1/dpr);assert.equal(api.exportScale(),1);state.zLimit=false;assert.ok(api.snap(.125/dpr)<1/dpr);}
 }
});
test('overview samples the physical centre at 2/3 pitch without refitting the short axis',()=>{
 const data=Uint8ClampedArray.from([1,2,3,4,5,6].flatMap(v=>[v,10+v,250-v,200+v]));
 const src={width:3,height:2,data},view=Host.sampleViewport(src,2,2,{scale:2/3});
 assert.deepEqual([...view.data],[1,11,249,201,3,13,247,203,0,0,0,0,0,0,0,0]);
 const shifted=Host.sampleViewport(src,2,1,{scale:2/3,y:.5});
 assert.deepEqual([...shifted.data],[4,14,246,204,6,16,244,206]);
});
test('a small viewport addresses a large source by its global offset and preserves its RGBA palette',()=>{
 const w=8000,h=2200,data=new Uint8ClampedArray(w*h*4),src={width:w,height:h,data};
 const scale=.75,x=5997.25,y=1648.25,expected=[];
 for(let Y=0;Y<3;Y++)for(let X=0;X<4;X++){
   const sx=Math.floor((x+X+.5)/scale),sy=Math.floor((y+Y+.5)/scale);
   if(sx>=w||sy>=h){expected.push(0,0,0,0);continue;}
   const pixel=[sx%251,sy%239,60+X,130+Y];data.set(pixel,4*(sy*w+sx));expected.push(...pixel);
 }
 const out=Host.sampleViewport(src,4,3,{scale,x,y});
 assert.equal(out.data.length,48);assert.deepEqual([...out.data],expected);
});
test('negative viewport offsets and unaligned source views leave only the outside pixels transparent',()=>{
 const data=new Uint8ClampedArray(new ArrayBuffer(9),1,8);data.set([10,20,30,40,91,92,93,94]);
 const src={width:2,height:1,data},sample=Host.sampleViewport(src,4,2,{scale:1,x:-1.25,y:-1});
 assert.deepEqual([...sample.data],[...Array(16).fill(0),0,0,0,0,10,20,30,40,91,92,93,94,0,0,0,0]);
 for(const options of [{scale:0},{scale:Infinity},{scale:1,x:NaN}])assert.throws(()=>Host.sampleViewport(src,1,1,options),RangeError);
 assert.throws(()=>Host.sampleViewport(src,16385,1,{scale:1}),RangeError);
 assert.throws(()=>Host.sampleViewport({...src,width:3},1,1,{scale:1}),RangeError);
});
