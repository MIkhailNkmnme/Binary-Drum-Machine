const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8'),menu=fs.readFileSync(path.join(__dirname,'mayatnik-menu.js'),'utf8');
function block(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a);return html.slice(a,b);}
test('host applies auto colours silently and keeps independent build/frame clocks',()=>{
 const calls=[],st={},c={st,sessionReady:true,window:{MayatnikColourAuto:{advance(...args){calls.push(args);return [{key:'verticalFillColour',color:'#123456'},{key:'fillColour',color:'#abcdef'}];}}},clearFillPreview(){c.cleared=(c.cleared||0)+1;},queueSession(){c.saved=(c.saved||0)+1;}};
 vm.createContext(c);vm.runInContext(block('  let paintBuildClock=','  function reset()'),c);
 c.advancePaintColour('build');c.advancePaintColour('frame',67);c.advancePaintColour('build');
 assert.deepEqual(calls,[['build',1,1],['frame',1,67],['build',2,1]]);assert.equal(st.verticalFillColour,'#123456');assert.equal(st.fillColour,undefined);assert.equal(c.saved,3);c.sessionReady=false;c.advancePaintColour('build');c.advancePaintColour('frame',10);assert.equal(calls.length,3,'restore must not advance phase');
});
test('actual tick advances by computed frames, while unchanged redraw does not advance',()=>{
 const calls=[],c={paintJumpFrom:null,raf:0,timer:0,playing:true,gpuBig:null,fast:false,st:{thirds:false,speed:3},k:10,target:100,performance:{now:()=>10},f:{val:{length:1}},lastDraw:0,drawMs:0,t0:0,rombP:()=>-1,stop(){c.playing=false;},more(){c.k++;return true;},draw(){},status(){},next(){},advancePaintColour:(...args)=>calls.push(args)};
 vm.createContext(c);vm.runInContext(block('  function tick() {','  function play() {'),c);c.tick();assert.deepEqual(calls,[['frame',3]]);
 c.more=()=>false;c.playing=true;c.tick();assert.equal(calls.length,1);
 assert.ok(!block('  function draw() {','  function drawPost(').includes('advancePaintColour'));
 assert.ok(block('  function reset() {','  // v0.014:').includes("advancePaintColour('build')"));
});
test('jump to a restored frame advances once; repeated same-frame request does not',()=>{
 const calls=[],c={paintJumpFrom:null,k:20,target:20,konus:null,f:{val:{set(){}}},gpuBig:null,snaps:new Map([[10,{val:[]}]]),navAt:0,performance:{now:()=>1},foldSuspend(){},stop(){},total:()=>100,draw(){},advancePaintColour:(...a)=>calls.push(a),next(){}};
 vm.createContext(c);vm.runInContext(block('  function goTo(t) {','  // v0.002: пиксель'),c);c.goTo(10);c.goTo(10);assert.deepEqual(calls,[['frame',10]]);
});
test('existing thumb label includes actual row count even with an unapplied rows input',()=>{
 const expr=menu.match(/num\('frame', \{ name: 'Кадр', fmt: (.*?), zero: 0/)[1],c={$:id=>id==='frame'?{dataset:{rows:'1024'}}:{value:'2048'}};
 vm.createContext(c);const format=vm.runInContext('('+expr+')',c);assert.equal(format(665),'665 \\ 1024');
 assert.match(html,/\$\('frame'\)\.dataset\.rows=String\(st\.rows\)/);
 assert.match(fs.readFileSync(path.join(__dirname,'mayatnik-button-standard.css'),'utf8'),/#mayFieldCaption\{display:none!important\}/);
});


test('backward jump counts the requested change, not replay from a cached snapshot',()=>{
 const calls=[],c={raf:0,timer:0,playing:true,gpuBig:null,fast:false,st:{thirds:false,speed:40},k:64,target:99,paintJumpFrom:100,performance:{now:()=>10},f:{val:{length:1}},lastDraw:0,drawMs:0,t0:0,rombP:()=>-1,stop(){c.playing=false;},more(){if(c.k>=c.target)return false;c.k++;return true;},draw(){},status(){},next(){},advancePaintColour:(...args)=>calls.push(args)};
 vm.createContext(c);vm.runInContext(block('  function tick() {','  function play() {'),c);c.tick();assert.deepEqual(calls,[['frame',1]]);assert.equal(c.paintJumpFrom,null);
});
