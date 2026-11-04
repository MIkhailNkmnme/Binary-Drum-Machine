const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const source=section('  let ochki = null;','  window.mayCurrentSnakePaths=')+section('  function publishOchki(result,','  function updWin()');
function fixture({every=true,sequence=['1011'],code=false,view='bits'}={}){
  const state={view,ochki:true,ochkiMode:'row',ochkiPattern:'initial',ochkiEveryFrame:every,ochkiCode:code,ochkiLength:3},events=[],elements=new Map();
  const f={W:24,H:4,val:new Int8Array(96).fill(-1)};
  const c={st:state,f,k:1,ZL:[],ZR:[],VX:0,VW:24,VH:4,geo:{anchor:0},ovlSerial:0,playing:false,TextDecoder,structuredClone,CustomEvent,performance,setTimeout,clearTimeout,console:{log(){},error(){}},localStorage:{getItem:()=>null,setItem(){}},sequences:{rows:sequence,revision:1,setMatches:value=>c.matches=value},MayatnikVariants:require('./mayatnik-variants.js'),MayatnikOchkiLoop:require('./mayatnik-ochki-loop.js'),MayatnikOchkiVRoute:require('./mayatnik-ochki-v-route.js'),fieldSourceKey:()=>'',pairOn:()=>false,rombP:()=>state.view==='romb2'?2:-1,joinedOn:()=>false,joinedWhole:()=>false,parityVisible:()=>true,parityRow:r=>r,parityValues:()=>f.val,parityField:()=>f,parityActive:()=>false,parityPlan:()=>({settings:{rowFill:'none'}}),outZone:()=>false,ochkiSearchValues:value=>value,rgbNeighbourFilters:()=>[],rgbNeighbourBWMode:()=>false,gpuBig:null,gpuDisplay:()=>false,displayPoint:(c,r)=>({x:c+.5,y:r+.5}),clampInt:(x,a,b,d)=>Math.max(a,Math.min(b,Number(x)||d)),$:id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:false,selectedOptions:[{textContent:'Р СњР В°РЎвЂЎР В°Р В»РЎРЉР Р…Р В°РЎРЏ'}]});return elements.get(id);},window:new EventTarget(),ovlDraw(){}};
  c.window.addEventListener('may-ochki-log-record',event=>events.push(event.detail));
  vm.createContext(c);vm.runInContext(source+';globalThis.result=()=>{const result=ochkiGet();publishOchki(result);return result;};globalThis.clearCache=()=>{ochki=null;};globalThis.log=()=>ochkiLog;',c);
  const bits=(text='1011',row=1,shift=0)=>{f.val.fill(-1);for(let i=0;i<text.length;i++)f.val[row*f.W+shift+2*i]=+text[i];};bits();
  return {c,state,f,bits,events,result:()=>c.result()};
}
test('every-frame search revisits all rows, displays only current findings and deduplicates revisits',()=>{
  const a=fixture(),first=a.result();assert.equal(first.found.length,1);assert.equal(a.result(),first);assert.equal(a.events.length,1);assert.equal(a.c.matches.searchOptions.everyFrame,true);
  a.c.k++;const second=a.result();assert.equal(second.found.length,1);assert.equal(second.foundCount,1);assert.equal(a.events.length,2);
  a.c.k=1;a.bits('1011',2,1);const revisited=a.result();assert.equal(revisited.found[0].r,2);assert.equal(a.events.length,2);a.c.clearCache();assert.equal(a.result().found.length,1);assert.equal(a.events.length,2);
  a.c.k=3;a.f.val.fill(-1);const empty=a.result();assert.equal(empty.found.length,0);assert.equal(empty.foundCount,0);assert.equal(empty.foundEver,0);assert.equal(empty.hl.some(Boolean),false);
});
test('turning repeat off retains the previous find-once behavior',()=>{
  const a=fixture({every:false});assert.equal(a.result().found.length,1);a.c.k++;const next=a.result();assert.equal(next.found.length,0);assert.equal(next.foundCount,1);assert.equal(a.events.length,1);
});
test('Code searches later rows after a missing code and respects the selected starting index',()=>{
  const a=fixture({code:true,sequence:['0','1','1']});a.bits('1');const first=a.result();assert.deepEqual(Array.from(first.found,h=>h.i),[2]);assert.equal(first.foundCount,1);assert.equal(first.total,2);assert.equal(first.codeNext,-1);assert.equal(a.result(),first);
  a.c.k++;assert.deepEqual(Array.from(a.result().found,h=>h.i),[2]);assert.equal(a.events.length,2);
  a.state.ochkiCodeStart=2;a.c.k++;assert.equal(a.result().total,1);assert.equal(a.result().found[0].i,2);
  const off=fixture({code:true,every:false,sequence:['0','1','1']});off.bits('1');assert.equal(off.result().found.length,0);
});
test('separate halves retain independent current matches and repeat without cumulative counts',()=>{
  const a=fixture({view:'romb2'});for(let i=0;i<4;i++)a.f.val[24+2*i+1]=+'1011'[i];assert.equal(a.result().foundCount,2);a.c.k++;const r=a.result();assert.equal(r.foundCount,2);assert.deepEqual(Array.from(r.foundByHalf,x=>Array.from(x)),[[0],[0]]);assert.equal(a.c.log().length,4);
});
test('overlay repeat uses its captured frame, survives re-render and avoids serial-based duplicates',()=>{
  const a=fixture(),c=a.c;a.state.ochkiOverlay=true;c.ovlSource={bits:{W:8,H:1,anchor:0,val:Int8Array.from([1,-1,0,-1,1,-1,1,-1]),frame:5}};c.ovlFrozen=null;
  const first=c.ochkiOverlayGet();assert.equal(first.found.length,1);assert.equal(c.ochkiOverlayGet(),first);assert.equal(a.events[0].frame,5);assert.equal(c.log()[0].frame,5);
  c.k=90;c.ovlSerial++;assert.equal(c.ochkiOverlayGet().found.length,1);assert.equal(a.events.length,1);
  c.ovlSource.bits={...c.ovlSource.bits,frame:6};c.ovlSerial++;assert.equal(c.ochkiOverlayGet().found.length,1);assert.equal(a.events.length,2);assert.equal(a.events[1].frame,6);
});
test('current snake summary does not retain rows absent from a later frame',()=>{
  const a=fixture();assert.equal(a.c.ochkiSnakeSummary([{i:0,p:0}], 'scope',true).foundCount,1);const empty=a.c.ochkiSnakeSummary([], 'scope',true);assert.equal(empty.foundCount,0);assert.deepEqual(Array.from(empty.foundIndices),[]);
});
