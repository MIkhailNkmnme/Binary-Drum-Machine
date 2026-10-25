const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function fixture(state={}){
 const handlers=[],calls={bits:0,capture:0},classes=new Set();
 const st={rows:10,fixLines:false,fixCross:false,fixMirror:1,fixDragK:false,...state};
 const wrap={classList:{add:c=>classes.add(c)},addEventListener(type,fn,capture){handlers.push({type,fn,capture});},setPointerCapture(){calls.capture++;}};
 const context={st,wrap,f:{},k:5,VH:10,VW:30,rulerMode:false,picOn:()=>true,
 document:{body:{classList:{contains:c=>classes.has(c)}}},cv:{getBoundingClientRect:()=>({left:100,top:50})},scale:()=>10,
 fixShown:()=>st.fixLines!==false||st.fixCross!==false,fixBound:()=>st.fixLines!==false,
 fixSegments:()=>[[0,0,4,4,9,9,4]],fixPts:()=>new Map([['4:4',[4,4,4,4,4]]]),
 fixReal(){},fixMeetAt:()=>4,save(){},draw(){}};
 vm.createContext(context);
 const a=html.indexOf('  let fixDrag=null;'),b=html.indexOf('  const fixAt=',a);
 vm.runInContext(html.slice(a,b),context);
 vm.runInContext(html.slice(b,html.indexOf('\n',b)),context);
 const start=html.indexOf("  wrap.addEventListener('pointerdown',e=>{if(e.button!==0||rulerMode||!fixNear",b),end=html.indexOf('},true);',start)+9;
 vm.runInContext(html.slice(start,end),context);
 return {context,st,calls,classes,near:(x,y)=>vm.runInContext(`fixNear(${x},${y})`,context),down(x,y){const e={button:0,pointerId:1,clientX:x,clientY:y,preventDefault(){},stopImmediatePropagation(){this.stopped=true;}};for(const h of handlers)h.fn(e);if(!e.stopped)calls.bits++;return e;}};
}
test('hidden meeting axes let bit gestures through even while mirror and frame drag stay enabled',()=>{
 for(const fixLines of [false,true]){const f=fixture({fixLines,fixCross:false,fixDragK:true});
 for(const p of [[145,120],[200,95],[145,95]]){assert.equal(f.near(...p),false);f.down(...p);}
 assert.equal(f.calls.bits,3);assert.equal(f.calls.capture,0);assert.equal(f.st.fixMirror,1);}
});
test('visible meeting axes still capture pointerdown; bound axes still require frame dragging',()=>{
 for(const fixLines of [false,true]){const f=fixture({fixLines,fixCross:true,fixDragK:true});assert.equal(f.near(145,120),true);assert.equal(f.near(200,95),true);f.down(145,120);assert.equal(f.calls.capture,1);assert.equal(f.calls.bits,0);}
 assert.equal(fixture({fixLines:true,fixCross:true}).near(145,120),false);
});
test('folded or missing field cannot capture a hidden meeting axis',()=>{
 const f=fixture({fixCross:true});f.classes.add('may-fold-active');assert.equal(f.near(145,120),false);
 f.classes.clear();f.context.picOn=()=>false;assert.equal(f.near(145,120),false);
});
test('visible meeting marker below the field remains draggable without a phantom vertical',()=>{
 const f=fixture({fixLines:true,fixDragK:true});f.context.fixSegments=()=>[[0,0,9,9,9,9,15]];
 assert.equal(f.near(255,205),true);assert.equal(f.near(255,160),false);
});
test('hidden manual and mirror guide canvas cannot claim line hits',()=>{
 const context={templateCanvas:{hidden:true},st:{userLines:[[0,0,10,0]]},mirrorLine:true,f:{},mirrorLineY:0,cv:{getBoundingClientRect:()=>({left:0,top:0})},scale:()=>10};
 vm.createContext(context);
 const a=html.indexOf('  function nearestUserLine('),b=html.indexOf('\n  for(',a);
 vm.runInContext(html.slice(a,b),context);
 const c=html.indexOf('  const nearLine=');vm.runInContext(html.slice(c,html.indexOf('\n',c)),context);
 assert.equal(vm.runInContext('nearestUserLine(40,0)',context),-1);assert.equal(vm.runInContext('nearLine(0)',context),false);
 context.templateCanvas.hidden=false;assert.equal(vm.runInContext('nearestUserLine(40,0)',context),0);assert.equal(vm.runInContext('nearLine(0)',context),true);
});
