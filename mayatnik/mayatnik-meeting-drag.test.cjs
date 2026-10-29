const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Core=require('./mayatnik-core.js'),html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return html.slice(a,b);}
function boot({rows=8,visible=rows,steps=rows*4,mode='pend',pair=false,compare=false,cells=100,frame=4}={}){
  const handlers={},events=[],calls=[],classes=new Set(),c={st:{rows,steps,mode,pair,fixLines:true,fixCross:true,fixDragK:true},k:frame,
    VX:0,VW:1000,VH:visible,geo:{anchor:500},f:{H:rows,W:1000,val:{length:cells}},MAYATNIK:Core,
    compareOn:()=>compare,pairOn:()=>pair&&mode==='pend',rombP:()=>-1,coneContinueAllowed:()=>false,Event:class{constructor(type){this.type=type;}},
    actSet(){},save(){},wrap:{classList:{remove:x=>classes.delete(x)},addEventListener(type,fn){handlers[type]=fn;}}};
  const fr={value:frame,addEventListener(type,fn){handlers['frame:'+type]=fn;},dispatchEvent(e){events.push({type:e.type,frame:+fr.value});handlers['frame:'+e.type]?.(e);}},label={textContent:frame};
  c.$=id=>id==='frame'?fr:label;c.goTo=t=>{calls.push(t);c.k=t;};vm.createContext(c);
  vm.runInContext(section('  function compareLimit(','  function compareConfig(')+section('  function compareSpan(','  function compareMaterialize(')+
    section('  function total()','  function snap(')+section('  function fixApexes(','  // v0.127:')+
    section('  function fixSegments(','  // v0.203:')+section('  function fixMeetAt(','  window.mayFixAxis='),c);
  c.fr=fr;c.events=events;c.calls=calls;c.label=label;c.handlers=handlers;
  return c;
}
// Independent oracle: use the actual ray construction, including open rays, terminal extras and nearest-X choice.
function oldDepth(c,n,x){const old=c.k;c.k=n;let best=null;try{for(const s of c.fixSegments(true)){if(s[3]<=0)continue;const d=Math.abs(s[2]-x);if(!best||d<best[0])best=[d,s[3]];}}finally{c.k=old;}return best?.[1]??null;}
function oldFrame(c,y,x){let best=c.k,dist=Infinity;for(let n=1;n<=c.total();n++){const depth=oldDepth(c,n,x);if(depth===null)continue;const d=Math.abs(depth-y)*1e4+Math.abs(n-c.k);if(d<dist){dist=d;best=n;}}return best;}

test('constant-cost depth matches ray construction in every legacy mode, pair state, crop and boundary frame',()=>{
  for(const mode of ['pend','pendR','left','right','one','both'])for(const pair of [false,true])for(const visible of [1,2,8])for(const steps of [1,2,3,4,7,8,15,16,31,32]){
    const c=boot({mode,pair,visible,steps,frame:1});
    for(let n=1;n<=c.total();n++)for(const x of [-100,500,1100])assert.equal(c.fixMeetAt(n,x),oldDepth(c,n,x),JSON.stringify({mode,pair,visible,steps,n,x}));
  }
});

test('nearest-frame selection preserves the old score, quarter-row ties, open ray and terminal behavior',()=>{
  for(const compare of [false,true])for(const mode of ['pend','pendR','left','right','one'])for(const pair of [false,true])for(const visible of [1,8]){
    const c=boot({compare,mode,pair,visible,steps:16});
    for(const k of [...new Set([1,Math.floor(c.total()/2),c.total()-1,c.total()].filter(n=>n>=0))])for(const y of [-1,1,1.25,2.25,6.75,7,7.25,7.75,8,8.25,9,100]){
      c.k=k;c.fr.value=k;const expected=oldFrame(c,y,500);c.fixDragFrame(y,500);assert.equal(+c.fr.value,expected,JSON.stringify({compare,mode,pair,visible,k,y}));assert.equal(c.k,k);
    }
  }
});

test('large legacy candidate search never enumerates apex history or mutates source state',()=>{
  for(const rows of [512,1024,4096])for(const pair of [false,true]){
    const c=boot({rows,pair,frame:16});let reads=0;c.MAYATNIK={...Core,offset(){reads++;throw Error('candidate search enumerated an apex');}};
    c.fixApexes=()=>{throw Error('candidate search rebuilt geometry');};const original=c.f;
    c.fixDragFrame(rows*.75,500);assert.equal(reads,0);assert.equal(c.k,16);assert.equal(c.f,original);
    assert.equal(+c.fr.value,pair?rows*.75-1:rows*1.5-1);
  }
});

function wire(c){
  vm.runInContext(section("  $('frame').addEventListener('input'", "  $('frame').addEventListener('change'")+section("  $('frame').addEventListener('change'",'\n',),c);
  vm.runInContext('let fixDrag={id:7,byK:true};'+section('  function fixDragFinishFrame(','  wrap.addEventListener(\'dblclick\',e=>{if(!fixNear'),c);
  return type=>c.handlers[type]({type,pointerId:7,stopImmediatePropagation(){}});
}
test('large-field point drag applies exactly the selected frame on pointerup through the normal change handler',()=>{
  const c=boot({compare:true,rows:1024,cells:2047*1024,frame:16}),end=wire(c);
  c.fixDragFrame(48.5,500);assert.equal(+c.fr.value,96);assert.equal(c.k,16);assert.deepEqual(c.calls,[]);
  end('pointerup');assert.equal(c.k,96);assert.deepEqual(c.calls,[96]);assert.deepEqual(c.events.map(e=>e.type),['input','change']);
  end('pointerup');assert.deepEqual(c.calls,[96],'duplicate release does not replay');
});
test('returning to the original frame replaces the pending large-field selection and does not commit a stale target',()=>{
  const c=boot({compare:true,rows:1024,cells:2047*1024,frame:16}),end=wire(c);
  c.fixDragFrame(48.5,500);c.fixDragFrame(8.5,500);assert.equal(+c.fr.value,16);
  end('pointerup');assert.deepEqual(c.calls,[]);assert.equal(c.k,16);assert.equal(+c.label.textContent,16);
});
test('cancel restores actual frame label and slider without calculating the pending field',()=>{
  const c=boot({compare:true,rows:1024,cells:2047*1024,frame:16}),end=wire(c);
  c.fixDragFrame(48.5,500);end('pointercancel');assert.equal(+c.fr.value,16);assert.equal(+c.label.textContent,16);assert.equal(c.k,16);assert.deepEqual(c.calls,[]);
});
test('small-field point drag remains live and release does not calculate the frame twice',()=>{
  const c=boot({compare:true,rows:128,cells:255*128,frame:16}),end=wire(c);
  c.fixDragFrame(48.5,500);assert.equal(c.k,96);end('pointerup');assert.deepEqual(c.calls,[96]);assert.deepEqual(c.events.map(e=>e.type),['input']);
});
