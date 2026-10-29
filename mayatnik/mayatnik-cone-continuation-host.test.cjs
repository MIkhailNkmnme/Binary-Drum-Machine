const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Core=require('./mayatnik-core.js'),Compare=require('./mayatnik-compare.js'),Continuation=require('./mayatnik-cone-continuation.js');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return html.slice(a,b);}
function boot(saved={}){
 const nodes=new Map(),c={st:{rows:8,steps:8,mode:'pend',pair:false,compareSource:'cone',fixLines:true,...saved},k:0,target:0,
   MAYATNIK:Core,MayatnikCompare:Compare,MayatnikConeContinuation:Continuation,window:{},Event:class{constructor(type){this.type=type;}},
   playing:false,fast:false,compareFreezeService:{cancel(){}},events:[],saved:[],draws:0,scheduled:0,paintJumpFrom:null,navAt:0,
   performance:{now:()=>0},testPattern:null,gpuBig:null,konus:null,t0:0,foldSuspend(){},clearKonus(){},advancePaintColour(){},
   queueSession(){},dispatchEvent(e){c.events.push(e.type);},save(){c.saved.push(JSON.parse(JSON.stringify(c.st)));},
   stop(){c.playing=false;c.fast=false;c.coneAutoRun=false;},draw(){c.draws++;},next(){c.scheduled++;},rombP:()=>-1,
   pairOn:()=>!!c.st.pair&&c.st.mode==='pend',ochkiPauseCancel(){},snap(){}};
 c.$=id=>{if(!nodes.has(id))nodes.set(id,{value:0,max:0,textContent:'',setAttribute(){},dispatchEvent(e){if(e.type==='input'||e.type==='change')c.goTo(+this.value);}});return nodes.get(id);};
 c.f=Core.field(2*c.st.rows-1,c.st.rows,'empty',c.st.rows-1);c.geo={anchor:c.st.rows-1,W:c.f.W};c.VX=0;c.VW=c.f.W;c.VH=c.f.H;
 c.snaps=new Map([[0,{val:c.f.val.slice()}]]);vm.createContext(c);
 vm.runInContext(section('  var compareEngine=null','  st.templateMaxArea=')+section('  function total()','  function snap(')+
   section('  function addOne()','  const coneSpan =')+section('  function goTo(','  // v0.002: пиксель')+
   section('  function fixSegments(','  // v0.203:')+section('  function fixShown()','  // v0.205:')+
   section('  function fixMeetAt(','  window.mayFixAxis=')+section('  function coneAutoExtend()','  function tick()')+
   section('  function play()','  // v0.003: быстрое построение'),c);
 c.pump=()=>{let n=0;while(c.k<c.target){assert.ok(n++<1000);assert.equal(c.addOne(),true);}c.playing=false;c.fast=false;c.draw();};
 c.points=()=>[...c.fixPts(c.fixSegments(true),c.VH).values()];
 assert.equal(c.compareMaterialize(0),true);return c;
}
test('opt-in drag constructs new cone frames beyond the finite cap and keeps the visible crop',()=>{
 const c=boot();c.goTo(15);c.pump();const prefix=c.f.val.slice(),shape=[c.f.W,c.f.H,c.geo.anchor];
 assert.equal(c.window.mayConeContinue.get(),false);assert.equal(c.total(),15);
 c.window.mayConeContinue.set(true);c.fixDragFrame(12,7);assert.equal(c.target,23);assert.ok(c.total()>=23);c.pump();
 assert.equal(c.k,23);assert.equal(c.points()[0][2],12);assert.deepEqual([c.f.W,c.f.H,c.geo.anchor],shape);assert.notDeepEqual(c.f.val,prefix);
 assert.deepEqual(c.f.val,Continuation.create({rows:8}).seek(23).left);
 c.goTo(6);c.pump();assert.deepEqual(c.f.val,Compare.create({rows:8}).seek(6).left,'rewind does not replay the prefix on wider boundaries');
});
test('OFF keeps the already opened horizon and current frame; unrelated sources stay finite',()=>{
 const c=boot();c.window.mayConeContinue.set(true);c.goTo(23);c.pump();const max=c.total(),field=c.f.val.slice();
 c.window.mayConeContinue.set(false);assert.equal(c.k,23);assert.equal(c.total(),max);assert.deepEqual(c.f.val,field);
 c.fixDragFrame(100,7);assert.equal(c.total(),max);assert.equal(c.target,max);
 c.st.compareSource='field';assert.equal(c.total(),15);assert.equal(c.window.mayConeContinue.set(true),false);assert.equal(c.window.mayConeContinue.status().supported,false);
});
test('saved ON state and extended horizon restore exact continued and old frames',()=>{
 const c=boot({mode:'pendR'});c.window.mayConeContinue.set(true);c.goTo(27);c.pump();const field=c.f.val.slice(),saved=JSON.parse(JSON.stringify(c.st));
 const restored=boot(saved);assert.equal(restored.window.mayConeContinue.get(),true);assert.equal(restored.total(),c.total());restored.goTo(27);restored.pump();assert.deepEqual(restored.f.val,field);
 restored.goTo(15);restored.pump();assert.deepEqual(restored.f.val,Compare.create({rows:8,direction:'pendR'}).seek(15).left);
 const changed=boot({...saved,rows:16});assert.equal(changed.total(),31,'saved horizon belongs to its rows/direction/pair only');
});
test('N/3 and pair modes extend when explicitly enabled instead of preserving their old cap',()=>{
 for(const pair of [false,true]){
  const c=boot({vmode:'n3',steps:3,pair});const before=c.total();c.window.mayConeContinue.set(true);c.fixDragFrame(12,7);c.pump();
  assert.ok(c.k>before);assert.equal(c.k,pair?12:23);assert.equal(c.points()[0][2],12);
  assert.deepEqual(c.f.val,Continuation.create({rows:8,pair}).seek(c.k).left);
 }
});
test('normal Play at the end opens new real frames; automatic playback extends again without replaying frame zero',()=>{
 const c=boot();c.goTo(15);c.pump();c.window.mayConeContinue.set(true);const before=c.f.val.slice();c.play();
 assert.equal(c.k,15);assert.deepEqual(c.f.val,before);assert.equal(c.playing,true);assert.equal(c.coneAutoRun,true);const first=c.total();assert.ok(first>15);
 while(c.k<first)assert.equal(vm.runInContext('more()',c),true);
 assert.equal(vm.runInContext('more()',c),true);assert.equal(c.k,first+1);assert.ok(c.total()>first);
 assert.deepEqual(c.f.val,Continuation.create({rows:8}).seek(first+1).left);
});
test('a manual seek to the opened horizon does not enable endless auto playback',()=>{
 const c=boot();c.window.mayConeContinue.set(true);c.goTo(31);c.pump();assert.equal(c.coneAutoRun,false);const max=c.total();assert.equal(c.coneAutoExtend(),false);assert.equal(c.total(),max);
});
test('allocation failure stops continuation without changing the published field or actual frame',()=>{
 const c=boot();c.goTo(15);c.pump();c.window.mayConeContinue.set(true);const old=c.f.val.slice();
 c.MayatnikConeContinuation={create(){throw new RangeError('allocation failed');}};c.playing=true;c.target=99;
 assert.equal(c.coneContinueExtend(20),false);assert.equal(c.playing,false);assert.equal(c.k,15);assert.equal(c.target,15);assert.deepEqual(c.f.val,old);assert.equal(+c.$('frame').value,15);assert.match(c.window.mayConeContinue.status().error,/allocation failed/);
 assert.equal(c.coneContinueAllowed(),false);c.MayatnikConeContinuation=Continuation;c.window.mayConeContinue.set(true);assert.equal(c.coneContinueAllowed(),true);
});
test('continuation never invokes the finite freeze analyzer or claims cells frozen',()=>{
 const c=boot({coneContinue:true});c.MayatnikCompareAnalysis={createFrozenAnalyzer(){throw Error('finite analyzer used for continuation');}};
 vm.runInContext(section('  function compareFrozen()','  function freezeCalc()')+section('  function fixFrozen()','  function fixSegments(')+section('  function cellFreezeFrame(','  function templateLockCheck('),c);
 assert.equal(c.compareFrozen(),null);assert.equal(c.fixFrozen()(0,0),false);assert.equal(c.cellFreezeFrame(0,0),Infinity);
});
