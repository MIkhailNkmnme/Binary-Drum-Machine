const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return html.slice(a,b);}
function boot({byK=false,bound=true,cells=100,pointX=10}={}){
 const handlers={},steps=[],c={st:{rows:32,mode:'pend',fixDragK:byK,fixLines:bound,fixCross:true,fixDx:0,fixDy:0},k:5,f:{val:{length:cells}},geo:{anchor:10},VH:32,VW:21,VX:0,rulerMode:false,rulerDrag:null,third:null,stopped:0,focused:0,
  picOn:()=>true,rombP:()=>-1,fixShown:()=>true,document:{body:{classList:{contains:()=>false}}},cv:{getBoundingClientRect:()=>({left:0,top:0})},scale:()=>10,total:()=>64,compareOn:()=>false,pairOn:()=>false,coneContinueAllowed:()=>false,fixSegments:()=>[[0,0,pointX,3,0,0,3]],fixPts:()=>new Map([['p',[pointX,3,3,pointX,pointX]]]),fixBound:()=>c.st.fixLines,save(){},draw(){},stop(){c.stopped++;},actSet(){},
  wrap:{tabIndex:0,focus(){c.focused++;},classList:{add(){},remove(){},toggle(){}},setPointerCapture(){},addEventListener(type,fn){handlers[type]=fn;}},Event:class{constructor(type){this.type=type;}}};
 const fr={value:5,dispatchEvent(e){steps.push({type:e.type,k:+fr.value});if(e.type==='change'||cells<=2e6)c.k=+fr.value;}},label={textContent:5};c.$=id=>id==='frame'?fr:label;
 vm.createContext(c);vm.runInContext(section('  let fixDrag=null;','  // v0.214:')+section('  function fixMeetAt(','  window.mayFixAxis=')+section('  function fixDragFinishFrame(',"  wrap.addEventListener('dblclick',e=>{if(!fixNear"),c);
 const event=(type,x,y)=>handlers[type]({type,button:0,pointerId:7,pointerType:'mouse',clientX:x,clientY:y,preventDefault(){},stopImmediatePropagation(){}});
 return {c,fr,steps,event,near:(x,y)=>vm.runInContext(`fixNear(${x},${y})`,c)};
}
test('the actual meeting marker changes frames without the hidden frame-drag switch',()=>{
 for(const byK of [false,true])for(const bound of [false,true]){
  const {c,event,near}=boot({byK,bound});assert.equal(near(105,35),true);event('pointerdown',105,35);event('pointermove',105,55);assert.equal(c.k,9);event('pointermove',105,25);assert.equal(c.k,3);event('pointerup',105,25);assert.equal(c.st.fixDragK,byK);assert.equal(c.st.fixDx,0);assert.equal(c.st.fixDy,0);assert.equal(c.stopped,1);assert.equal(c.focused,1);
 }
});
test('locked axes only expose the marker while free axes can still move away from the marker',()=>{
 const locked=boot();assert.equal(locked.near(5,35),false);assert.equal(locked.near(105,43),true);assert.equal(locked.near(105,44),false);
 const free=boot({bound:false});assert.equal(free.near(5,35),true);free.event('pointerdown',5,35);free.event('pointermove',5,55);assert.equal(free.c.k,5);assert.equal(free.c.st.fixDy,2);
});
test('large fields commit the selected point-drag frame only on release, cancellation restores it',()=>{
 for(const end of ['pointerup','pointercancel']){
  const {c,event,fr,steps}=boot({cells:3e6});event('pointerdown',105,35);event('pointermove',105,55);assert.equal(c.k,5);assert.equal(+fr.value,9);event(end,105,55);assert.equal(c.k,end==='pointerup'?9:5);assert.equal(+fr.value,c.k);assert.equal(steps.filter(e=>e.type==='change').length,end==='pointerup'?1:0);
 }
});
test('marker hit follows the real crossing rather than the locked vertical axis',()=>{
 const {c,near}=boot({pointX:15});c.fixPts=()=>new Map([['p',[15,3,3,0,15]]]);assert.equal(near(155,35),true);assert.equal(near(5,35),false);c.picOn=()=>false;assert.equal(near(155,35),false);
});
