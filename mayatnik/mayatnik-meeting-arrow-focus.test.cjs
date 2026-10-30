const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function section(start,end,from=0){const a=html.indexOf(start,from),b=html.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return html.slice(a,b);}
function fixture(byK=false){
 const dom=new JSDOM('<button id="prior">Prior command</button><input id="frame" value="4"><span id="frameV"></span><div id="wrap"></div>',{pretendToBeVisual:true}),w=dom.window,document=w.document,wrap=document.getElementById('wrap'),calls=[];
 wrap.setPointerCapture=()=>{};
 const c=vm.createContext({document,wrap,window:w,Event:w.Event,$:id=>document.getElementById(id),addEventListener:w.addEventListener.bind(w),st:{rows:100,fixDx:0,fixDy:0,fixDragK:byK},k:4,VH:100,VW:100,f:{val:{length:100}},lastAct:null,rulerMode:false,rulerDrag:null,hit:true,
 fixNear:()=>c.hit,fixBound:()=>false,fixAt:e=>[e.clientX,e.clientY],fixSegments:()=>[],fixPts:()=>new Map([[0,[20,20,20+c.st.fixDy,0,20+c.st.fixDx]]]),fixMeetAt:()=>20,fixDragFrame:y=>{c.k=Math.round(y);},fixReal(){},stop(){},draw:()=>calls.push('draw'),save(){},actSet:kind=>c.lastAct=kind?{kind}:null,
 templateFollowStep:d=>{calls.push(['step',d]);c.k+=d;},goTo:n=>{calls.push(['direct',n]);c.k=n;},ochkiSelectionCurrent:()=>null,colourTemplate:null,templateDragging:null,axisSelected:0,rulerA:null,rulerB:null,axisLinePending:null});
 vm.runInContext('let fixDrag=null;'+section("  wrap.addEventListener('pointerdown',e=>{if(e.button!==0||rulerMode||!fixNear",'  // v0.214:')+section('  function actArrow(','  // Большие поля,')+section('  function fixDragFinishFrame(',"  wrap.addEventListener('dblclick',e=>{if(!fixNear"),c);
 const up=html.indexOf('  const up = e => {');vm.runInContext(section("  addEventListener('keydown', e => {","  cv.addEventListener('pointermove', e => {",up),c);
 const pointer=(type,extra={})=>{const e=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{button:0,pointerId:7,pointerType:'mouse',clientX:20,clientY:20,...extra});wrap.dispatchEvent(e);return e;};
 const key=name=>{const e=new w.KeyboardEvent('keydown',{key:name,code:name,bubbles:true,cancelable:true});document.activeElement.dispatchEvent(e);return e;};
 return{c,document,wrap,calls,pointer,key,close:()=>w.close()};
}
test('meeting drag takes field focus from a button or frame input and routes Up and Down to the selected action',()=>{
 for(const byK of [false,true])for(const previous of ['prior','frame']){const f=fixture(byK);try{f.document.getElementById(previous).focus();assert.equal(f.document.activeElement.id,previous);f.pointer('pointerdown');assert.equal(f.document.activeElement,f.wrap);f.pointer('pointermove',{clientY:23});f.pointer('pointerup',{clientY:23});assert.equal(f.c.lastAct.kind,byK?'fixK':'fix');const before=byK?f.c.k:f.c.st.fixDy;
  assert.equal(f.key('ArrowDown').defaultPrevented,true);assert.equal(byK?f.c.k:f.c.st.fixDy,before+1);assert.equal(f.key('ArrowUp').defaultPrevented,true);assert.equal(byK?f.c.k:f.c.st.fixDy,before);
  if(byK){assert.deepEqual(f.calls.filter(x=>Array.isArray(x)),[['step',1],['step',-1]]);assert.equal(f.calls.some(x=>Array.isArray(x)&&x[0]==='direct'),false);}
 }finally{f.close();}}
});
test('editing the frame input still prevents action arrows from handling the key',()=>{for(const byK of [false,true]){const f=fixture(byK);try{f.pointer('pointerdown');f.pointer('pointerup');f.document.getElementById('frame').focus();const before=[f.c.k,f.c.st.fixDy],n=f.calls.length;assert.equal(f.key('ArrowDown').defaultPrevented,false);assert.equal(f.key('ArrowUp').defaultPrevented,false);assert.deepEqual([f.c.k,f.c.st.fixDy],before);assert.equal(f.calls.length,n);}finally{f.close();}}});
test('a missed hit, other button, ruler gesture or cancellation without a grab does not steal focus',()=>{
 for(const reason of ['miss','button','ruler','cancel']){const f=fixture();try{f.document.getElementById('prior').focus();if(reason==='miss')f.c.hit=false;if(reason==='ruler')f.c.rulerMode=true;if(reason==='cancel')f.pointer('pointercancel');else f.pointer('pointerdown',reason==='button'?{button:2}:{});assert.equal(f.document.activeElement.id,'prior');assert.equal(f.c.lastAct,null);}finally{f.close();}}
});
