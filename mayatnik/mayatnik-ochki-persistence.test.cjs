const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
const source=html.slice(html.indexOf('  let ochki = null;'),html.indexOf('  function updWin()'));
function fixture({saved=[],sequence=['1011'],view='bits'}={}){
 let now=0,serial=0;const timers=new Map(),storage=new Map([['mayatnik_ochki_log',JSON.stringify(saved)]]),saves=[],events=[];
 const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:false,selectedOptions:[{textContent:'Начальная'}]});return elements.get(id);};
 const st={ochki:true,ochkiMode:'row',ochkiPattern:'initial',ochkiLength:3,view,mode:'pend',bg:'empty',parity:[true,true]},f={W:12,H:4,val:new Int8Array(48).fill(-1)};
 const context={st,f,k:1,VX:0,VW:12,VH:4,ZL:[],ZR:[],geo:{anchor:0},ovlSerial:0,playing:false,TextDecoder,structuredClone,parityVisible:()=>true,outZone:()=>false,performance:{now:()=>now},Date,console:{log(){},error(){}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},$,pairOn:()=>false,rombP:()=>st.view==='romb2'?2:-1,joinedOn:()=>false,clampInt:(x,a,b,d)=>Math.max(a,Math.min(b,+x||d)),sequences:{rows:sequence,revision:1,setMatches(){}},setTimeout(fn,delay){const id=++serial;timers.set(id,{at:now+delay,fn});return id;},clearTimeout:id=>timers.delete(id),window:{mayFrameLibrary:{save(name,captured){saves.push({name,captured});return new Promise(()=>{});}},dispatchEvent:e=>events.push(e)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},document:{createElement:()=>({style:{},remove(){}}),body:{append(){}}}};
 context.window.addEventListener=()=>{};
 Object.assign(context,{gpuBig:null,gpuDisplay:()=>false});vm.createContext(context);vm.runInContext(source+`;globalThis.api={get:ochkiGet,current:ochkiCurrent,save:ochkiSaveExactFrame,cancel:ochkiPauseCancel,log:()=>ochkiLog,keys:()=>ochkiFoundIdx.size,busy:()=>ochkiExactBusy};function stop(){ochkiPauseCancel();playing=false;}function play(){ochkiPauseCancel();playing=true;globalThis.resumes=(globalThis.resumes||0)+1;}function captureOchkiFrame(){return Promise.resolve({frame:k,field:Array.from(f.val),source:st.compareSource||''});}`,context);
 function bits(row=1,shift=0){f.val.fill(-1);for(const [i,v]of Array.from('1011').entries())f.val[row*f.W+shift+i*2]=+v;}
 const advance=ms=>{const end=now+ms;while(true){const next=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;timers.delete(next[0]);now=next[1].at;next[1].fn();}now=end;};
 bits();return {c:context,api:context.api,st,f,storage,saves,events,bits,advance,$};
}
test('reset findings preserves settings and saved log, clears accumulated rows, and suppresses only the current search key',()=>{
 const a=fixture(),c=a.c;let published,chosen='old';c.sequences.setMatches=v=>published=v;c.sequences.selectMatches=v=>chosen=v;
 a.api.get();const settings=JSON.stringify(a.st),log=JSON.stringify(a.api.log()),storage=a.storage.get('mayatnik_ochki_log'),keys=a.api.keys();
 c.resetOchkiFindings(false);assert.equal(JSON.stringify(a.st),settings);assert.equal(JSON.stringify(a.api.log()),log);assert.equal(a.storage.get('mayatnik_ochki_log'),storage);assert.equal(a.api.keys(),keys);
 assert.equal(chosen,null);assert.equal(published.count,0);assert.equal(published.enabled,true);assert.equal(a.api.get(),null);assert.equal(c.ochkiFor(),null);assert.equal(c.ochkiOverlayGet(),null);assert.equal(a.api.current(),null);
 assert.deepEqual(Array.from(vm.runInContext('[ochkiFoundRows.size,ochkiFoundUnion.size,ochkiFoundCount.size]',c)),[0,0,0]);
 a.advance(0);assert.equal(a.saves.length,0,'cleared pending capture cannot save the old highlights');
 a.f.val.fill(-1);c.k++;const empty=a.api.get();assert.equal(empty.found.length,0);assert.equal(empty.foundEver,0);assert.equal(empty.hl.some(Boolean),false);
 a.bits(2,1);c.k++;const next=a.api.get();assert.equal(next.found.length,1);assert.equal(next.foundEver,1);assert.equal(next.hl[12],0);assert.equal(JSON.stringify(a.api.log()),log,'log dedup remains intact');
});
test('reset findings cancels a pending automatic pause without changing the glasses controls',()=>{
 const a=fixture(),c=a.c;c.playing=true;a.api.get();assert.equal(c.playing,false);const settings=JSON.stringify(a.st);c.resetOchkiFindings(false);a.advance(3000);assert.equal(c.playing,false);assert.equal(c.resumes,undefined);assert.equal(JSON.stringify(a.st),settings);assert.equal(a.saves.length,0);
});
test('reset terminates the current snake worker and rejects late findings while the next frame may start a fresh search',()=>{
 const a=fixture({view:'romb2'}),c=a.c;let creates=0,terminated=0;const worker={postMessage(){},terminate(){terminated++;}};a.st.ochkiSnake=true;c.MayatnikSnake={createWorker(){creates++;return worker;}};c.draw=()=>{};
 c.ochkiSnakeFor();const late=worker.onmessage;c.resetOchkiFindings(false);assert.equal(terminated,1);assert.equal(a.st.ochkiSnake,true);assert.equal(c.ochkiSnakeWait(),false);assert.equal(creates,1);
 late({data:{result:{found:[{i:0,n:4,p:0,r:1,c:0,dir:'snake',cells:[12,14,16,18]}],total:1,complete:true}}});assert.equal(a.api.current(),null);assert.equal(a.api.log().length,0);
 c.k++;c.ochkiSnakeFor();assert.equal(creates,2);
});
test('changing bit display clears previous runtime findings and searches the new view without suppressing it',()=>{
 const a=fixture(),c=a.c;a.api.get();c.resetOchkiFindings(false);assert.equal(a.api.get(),null);a.st.view='col';const next=a.api.get();assert.equal(next.found.length,1);assert.equal(next.foundCount,1);assert.equal(c.ochkiFindingsSuppressed(),false);
 const maps=vm.runInContext('[ochkiFoundRows.size,ochkiFoundUnion.size,ochkiFoundCount.size]',c);assert.deepEqual(Array.from(maps),[1,1,1]);assert.equal(a.st.ochki,true);assert.equal(a.st.ochkiMode,'row');
 a.st.view='bits';assert.equal(a.api.get().found.length,1);assert.deepEqual(Array.from(vm.runInContext('[ochkiFoundRows.size,ochkiFoundUnion.size,ochkiFoundCount.size]',c)),[1,1,1]);
});
test('resetting findings releases an already-running test build from its terminated snake job without restarting playback',()=>{
 const a=fixture({view:'romb2'}),c=a.c;let resumed=0;a.st.ochkiSnake=true;c.playing=true;c.MayatnikSnake={createWorker:()=>({postMessage(){},terminate(){}})};c.ochkiSnakeFor();
 c.continueTestBuild=()=>{resumed++;assert.equal(c.ochkiSnakeWait(),false);};vm.runInContext('ochkiSnakeJob.buildContinue=continueTestBuild',c);
 c.resetOchkiFindings(false);assert.equal(resumed,1);assert.equal(c.playing,true);assert.equal(c.resumes,undefined);
});
test('the glasses reset command avoids the generic settings-reset and UI-rewrite path',()=>{
 const a=fixture(),c=a.c;a.api.get();let draws=0,events=0;Object.assign(c,{resetAllBusy:false,sessionReady:true,cacheRestoring:false,frameLibraryBusy:false,backupOperationBusy:()=>false,draw(){draws++;assert.equal(c.ochkiFor(),null);},queueDigits(){},dispatchEvent(){events++;},Event:class{},writeUI(){throw Error('reset findings must not rewrite controls');},savePaint(){throw Error('reset findings must not save paint');}});
 const start=html.indexOf('  function resetGroup(name){'),end=html.indexOf('  async function resetAll()',start);vm.runInContext(html.slice(start,end),c);const before=JSON.stringify(a.st);assert.equal(c.resetGroup('ochki'),true);assert.equal(JSON.stringify(a.st),before);assert.equal(draws,1);assert.equal(events,1);
});
test('a row found once is not searched or highlighted again in the same scope',()=>{
 const a=fixture();const first=a.api.get();assert.equal(first.found.length,1);const cells=Array.from(first.found[0].cells);assert.equal(a.api.log().length,1);
 a.c.k++;const second=a.api.get();assert.equal(second.found.length,0,'already found row is skipped');assert.equal(Array.from(second.hl).some(Boolean),false);assert.equal(a.api.log().length,1);assert.equal(a.api.current(),second);
 a.bits(2,1);a.c.k++;const moved=a.api.get();assert.equal(moved.found.length,0,'the same row is not searched at a new place');assert.equal(Array.from(moved.hl).some(Boolean),false);
 a.f.val.fill(-1);a.c.k++;assert.equal(a.api.get().found.length,0);assert.equal(Array.from(a.api.current().hl).some(Boolean),false);
});
test('stored legacy findings never exclude current matches; half-maятniks have independent findings',()=>{
 const a=fixture({saved:[{i:0,src:'',text:'1011'}],view:'romb2'});for(let i=0;i<4;i++)a.f.val[12+i*2+1]=+'1011'[i];const r=a.api.get();assert.equal(r.found.length,2);assert.equal(a.api.log().filter(x=>x.key).length,2);
 a.c.k++;assert.equal(a.api.get().found.length,0,'both halves already found');assert.equal(a.api.log().filter(x=>x.key).length,2);
});
test('source, mirror, mode, text and owner changes invalidate cache and scoped log dedup',()=>{
 const a=fixture();let r=a.api.get();for(const change of [()=>a.st.compareSource='field',()=>a.st.compareMirror=true,()=>a.st.mode='pendR',()=>{a.c.sequences.rows=['0100'];a.st.ochkiInv=true;a.c.sequences.revision++;}]){change();assert.equal(a.api.current(),null);const next=a.api.get();assert.equal(next.found.length,1);assert.notEqual(next,r);r=next;}
 assert.equal(a.api.log().length,5);a.c.f={...a.f,val:a.f.val.slice()};assert.equal(a.api.current(),null);assert.notEqual(a.api.get(),r);
});
test('full re-scan returns every current finding without mutating dedup/log or cached result',()=>{
 const a=fixture(),r=a.api.get(),n=a.api.log().length;const full=a.api.get(true);assert.equal(full.found.length,1);assert.equal(a.api.log().length,n);assert.equal(a.api.current(),r);
});
test('animation pauses exactly three seconds and resumes independently of unfinished storage',async()=>{
 const a=fixture();a.c.playing=true;const r=a.api.get();assert.equal(a.c.playing,false);assert.equal(a.api.current(),r);a.advance(0);assert.equal(a.saves.length,1);const capture=await a.saves[0].captured;assert.equal(capture.frame,1);a.advance(2999);assert.equal(a.c.playing,false);a.advance(1);assert.equal(a.c.playing,true);assert.equal(a.c.resumes,1);assert.equal(a.saves.length,1);
});
test('manual stop/play, disabled glasses and changed source/frame cannot auto-resume',()=>{
 for(const cancel of [a=>a.c.stop(),a=>a.c.play(),a=>a.st.ochki=false,a=>a.st.compareSource='field',a=>a.c.k++,a=>a.c.f={...a.f}]){const a=fixture();a.c.playing=true;a.api.get();a.advance(0);cancel(a);const n=a.c.resumes||0;a.advance(3000);assert.equal(a.c.resumes||0,n);}
});
test('navigation before pending capture never saves the replacement under the old frame name',()=>{
 const a=fixture();a.c.playing=true;a.api.get();a.c.k=2;a.advance(0);assert.equal(a.saves.length,0);assert.equal(a.api.busy(),false);a.advance(3000);assert.equal(a.c.playing,false);
});
test('initial search cannot join fragments across an empty source cell',()=>{
 const a=fixture();a.f.val.fill(-1);for(const [c,v]of [[0,1],[2,0],[6,1],[8,1]])a.f.val[12+c]=v;assert.equal(a.api.get().found.length,0);
});
test('viewing one romb never finds a sequence exclusively on the other lattice',()=>{
 const a=fixture();a.st.view='romb0';a.c.rombP=()=>0;assert.equal(a.api.get().found.length,0);a.c.rombP=()=>1;a.st.view='romb1';assert.equal(a.api.get().found.length,1);
});
test('save events include complete frame findings, exact source/settings/sequence and storage id',async()=>{
 const a=fixture({view:'romb2'});a.c.window.mayFrameLibrary.save=async()=> 'whole-frames:exact';for(let i=0;i<4;i++)a.f.val[12+i*2+1]=+'1011'[i];a.st.compareSource='p123';a.st.compareMirror=true;a.api.get();a.advance(0);await new Promise(setImmediate);
 const records=a.events.filter(e=>e.type==='may-ochki-log-record').map(e=>e.detail);assert.equal(records.length,2);assert.equal(records[0].status,'saving');assert.equal(records[1].status,'saved');assert.equal(records[1].savedId,'whole-frames:exact');assert.equal(records[1].finds.length,2);assert.equal(records[1].src,'p123');assert.equal(records[1].mirror,true);assert.deepEqual(Array.from(records[1].sequence),['1011']);a.c.sequences.rows[0]='00';assert.deepEqual(Array.from(records[1].sequence),['1011']);
});
test('a failed frame save remains visible as an error record and does not block timed resume',async()=>{
 const a=fixture();a.c.window.mayFrameLibrary.save=()=>Promise.reject(Error('quota'));a.c.playing=true;a.api.get();a.advance(0);await new Promise(setImmediate);const entry=a.events.filter(e=>e.type==='may-ochki-log-record').at(-1).detail;assert.equal(entry.status,'error');assert.match(entry.error,/quota/);a.advance(3000);assert.equal(a.c.playing,true);
});
test('row-by-row test build resumes after its paused row rather than rebuilding from the start',()=>{
 const timers=[],pictures=[],f={W:4,H:4,val:new Int8Array(16).fill(-1)},data=new Int8Array(16).fill(1),c={f,testPattern:{W:4,rows:4,data,kind:'carpet'},st:{speed:1,frameT:0},testXorInfo:null,bmGen:0,k:0,testBuildTimer:0,ochkiPause:null,playing:false,TEST_CYCLES:1,compareOn:()=>false,clearTimeout(){},setTimeout:fn=>(timers.push(fn),timers.length),$:()=>({value:'1',setAttribute(){}}),testNotify(){},save(){},testStatsUpdate(){},ochkiSnakeWait:()=>false};
 c.stop=()=>{c.playing=false;};c.draw=()=>{pictures.push(Array.from(f.val));if(pictures.length===1){c.playing=false;c.ochkiPause={};}};c.window={};vm.createContext(c);const start=html.indexOf('  window.mayTestBuild = () =>');vm.runInContext(html.slice(start,html.indexOf('  window.mayTestStop',start)),c);c.window.mayTestBuild();assert.equal(timers.length,0);assert.equal(c.bmGen,1);const resume=c.ochkiPause.resume;c.ochkiPause=null;resume();assert.equal(timers.length,1);timers.shift()();assert.equal(pictures.length,2);assert.equal(pictures[1].filter(x=>x===1).length,8);assert.equal(c.bmGen,2);
});
test('simple runs pause/save on a new series type, keep all highlights and do not save moved repeats',()=>{
 const a=fixture();a.st.ochkiPattern='ones';a.f.val.fill(-1);for(let i=0;i<3;i++)a.f.val[12+i*2]=1;a.c.playing=true;const first=a.api.get();assert.equal(first.count,1);assert.equal(a.c.playing,false);a.advance(0);assert.equal(a.saves.length,1);a.advance(3000);assert.equal(a.c.playing,true);
 a.f.val.fill(-1);for(let i=0;i<3;i++)a.f.val[12+2+i*2]=1;a.c.k++;const moved=a.api.get();assert.equal(moved.count,1);assert.equal(moved.hl[12],0);assert.equal(a.c.playing,true);a.advance(0);assert.equal(a.saves.length,1);
 a.f.val[20]=1;a.c.k++;assert.equal(a.api.get().longest,4);assert.equal(a.c.playing,false);a.advance(0);assert.equal(a.saves.length,2);
});
test('complete snake result alone pauses/logs its exact path; progress does not record straight-search substitutes',()=>{
 const a=fixture({view:'romb2'}),worker={postMessage(){},terminate(){}};a.st.ochkiSnake=true;a.c.MayatnikSnake={createWorker:()=>worker};a.c.draw=()=>{};a.c.playing=true;a.c.ochkiSnakeFor();
 worker.onmessage({data:{progress:{index:0,half:0,found:1,total:2,newFound:[{i:0,n:4,p:1,r:1,c:0,dir:'snake',cells:[12,14,16,18]}]}}});assert.equal(a.api.log().length,0);assert.equal(a.c.playing,true);assert.equal(a.saves.length,0);
 worker.onmessage({data:{result:{found:[{i:0,n:4,p:1,r:1,c:0,dir:'snake',cells:[12,14,16,18]}],total:2,halves:2,snake:true,complete:true}}});assert.equal(a.c.playing,false);a.advance(0);const event=a.events.find(e=>e.type==='may-ochki-log-record').detail;assert.equal(event.snake,true);assert.equal(event.count,1);assert.equal(event.finds[0].dir,'snake');a.advance(3000);assert.equal(a.c.playing,true);
});
test('snake animation gate remains closed through progress and opens on completion or explicit worker error',()=>{
 for(const error of [false,true]){const a=fixture({view:'romb2'}),worker={postMessage(){},terminate(){}};a.st.ochkiSnake=true;a.c.MayatnikSnake={createWorker:()=>worker};a.c.draw=()=>{};a.c.playing=true;assert.equal(a.c.ochkiSnakeWait(),true);assert.equal(a.c.k,1);
 worker.onmessage({data:{progress:{index:0,found:0,total:2}}});assert.equal(a.c.ochkiSnakeWait(),true);if(error)worker.onerror({message:'failed'});else worker.onmessage({data:{result:{found:[],total:2,halves:2,snake:true,complete:true}}});assert.equal(a.c.ochkiSnakeWait(),false);assert.equal(a.c.k,1);}
});
test('normal transport waits for snake and advances only one frame after completion even at high speed',()=>{
 const a=fixture(),c=a.c;let waiting=true,steps=0,scheduled=0;c.ochkiSnakeWait=()=>waiting;c.raf=0;c.timer=0;c.gpuBig=null;c.gpuManualCpu=()=>false;c.gpuPaintCpu=()=>false;c.fast=false;c.st.ochkiSnake=true;c.st.speed=20;c.third=null;c.lastShown=null;c.paintJumpFrom=null;c.target=100;c.advancePaintColour=()=>{};c.draw=()=>{};c.lastDraw=0;c.drawMs=0;c.t0=0;c.next=()=>scheduled++;c.more=()=>{steps++;c.k++;return true;};c.playing=true;
 const start=html.indexOf('  function tick() {',html.indexOf('  const more ='));vm.runInContext(html.slice(start,html.indexOf('  function play()',start)),c);c.tick();assert.equal(steps,0);assert.equal(scheduled,1);waiting=false;c.tick();assert.equal(steps,1);assert.equal(scheduled,2);
});
test('test build continuation waits for snake, transfers to three-second pause, and manual stop prevents resume',()=>{
 for(const manualStop of [false,true]){const timers=[],f={W:4,H:4,val:new Int8Array(16).fill(-1)},c={f,testPattern:{W:4,rows:4,data:new Int8Array(16).fill(1),kind:'carpet'},st:{speed:1,frameT:0},testXorInfo:null,bmGen:0,k:0,testBuildTimer:0,ochkiPause:null,ochkiSnakeJob:{},playing:false,TEST_CYCLES:1,compareOn:()=>false,clearTimeout(){},setTimeout:fn=>(timers.push(fn),timers.length),$:()=>({value:'1',setAttribute(){}}),testNotify(){},save(){},testStatsUpdate(){},draw(){},ochkiKey:()=>String(c.bmGen),ochkiSnakeWait:()=>!!c.ochkiSnakeJob};c.stop=()=>c.playing=false;c.window={};vm.createContext(c);const start=html.indexOf('  window.mayTestBuild = () =>');vm.runInContext(html.slice(start,html.indexOf('  window.mayTestStop',start)),c);c.window.mayTestBuild();assert.equal(timers.length,0);const continuation=c.ochkiSnakeJob.buildContinue;c.ochkiSnakeJob=null;if(manualStop)c.stop();else{c.playing=false;c.ochkiPause={};}continuation();if(manualStop){assert.equal(timers.length,0);assert.equal(c.playing,false);}else{assert.equal(typeof c.ochkiPause.resume,'function');const resume=c.ochkiPause.resume;c.ochkiPause=null;resume();assert.equal(timers.length,1);timers.shift()();assert.equal(c.bmGen,2);}}
});
test('growing the visible window does not make an already found sequence novel again',()=>{
 const a=fixture();a.api.get();assert.equal(a.api.log().length,1);a.c.VW=11;a.c.k++;assert.equal(a.api.get().found.length,0);assert.equal(a.api.log().length,1);
});

test('snake excludes only the completed half, keeps golden indices, and stops reporting old rows as new',()=>{
 const a=fixture({view:'romb2',sequence:['101','111']}),c=a.c,Snake=require('./mayatnik-snake.js'),workers=[];a.st.ochkiSnake=true;a.f.val.fill(-1);c.draw=()=>{};
 const add=col=>{for(const [r,dx,v]of [[0,0,1],[1,1,0],[2,0,1]])a.f.val[r*12+col+dx]=v;};add(0);
 c.MayatnikSnake={createWorker(){const worker={terminate(){},postMessage(data){this.data=data;}};workers.push(worker);return worker;}};
 const finish=()=>{const worker=workers.at(-1),result=Snake.find(worker.data);worker.onmessage({data:{result}});return a.api.current();};
 c.ochkiSnakeFor();assert.deepEqual(JSON.parse(JSON.stringify(workers[0].data.skipIndices)),[[],[]]);let r=finish();assert.deepEqual(Array.from(r.found,h=>[h.i,h.p]),[[0,0]]);assert.equal(r.foundCount,1);assert.equal(r.total,4);a.advance(0);
 add(3);c.k++;c.ochkiSnakeFor();assert.deepEqual(JSON.parse(JSON.stringify(workers[1].data.skipIndices)),[[0],[]]);r=finish();assert.deepEqual(Array.from(r.found,h=>[h.i,h.p]),[[0,1]]);assert.equal(r.foundCount,2);assert.deepEqual(Array.from(r.foundIndices),[0]);a.advance(0);
 const records=a.events.filter(e=>e.detail.status==='saving').map(e=>e.detail);assert.equal(records.length,2);assert.deepEqual(Array.from(records[1].finds,h=>[h.i,h.p]),[[0,1]],'frame log contains the new right finding only');
 const logged=a.api.log().length;c.k++;c.ochkiSnakeFor();assert.deepEqual(JSON.parse(JSON.stringify(workers[2].data.skipIndices)),[[0],[0]]);r=finish();assert.equal(r.found.length,0);assert.equal(r.foundCount,2);assert.equal(r.hl.some(Boolean),false);assert.deepEqual(Array.from(r.foundIndices),[0]);assert.equal(a.api.log().length,logged);
 c.resetOchkiFindings(false,false);c.ochkiSnakeFor();assert.deepEqual(JSON.parse(JSON.stringify(workers.at(-1).data.skipIndices)),[[],[]]);assert.equal(finish().found.length,2);
 c.f={...c.f,val:c.f.val.slice()};c.ochkiSnakeFor();assert.deepEqual(JSON.parse(JSON.stringify(workers.at(-1).data.skipIndices)),[[],[]]);assert.equal(finish().found.length,2);
});

test('incomplete and stale snake paths never exclude a sequence index from the next frame',()=>{
 const a=fixture({view:'romb2',sequence:['101']}),c=a.c,workers=[];a.st.ochkiSnake=true;c.draw=()=>{};c.MayatnikSnake={createWorker(){const worker={terminate(){},postMessage(data){this.data=data;}};workers.push(worker);return worker;}};
 const hit={i:0,p:0,r:0,c:0,n:3,cells:[0,13,24],dir:'snake'};c.ochkiSnakeFor();workers[0].onmessage({data:{progress:{index:0,half:0,found:1,total:2,newFound:[hit]}}});workers[0].onmessage({data:{result:{found:[hit],total:2,halves:2,complete:false}}});
 assert.equal(a.api.log().length,0);c.k++;c.ochkiSnakeFor();assert.deepEqual(JSON.parse(JSON.stringify(workers[1].data.skipIndices)),[[],[]]);const late=workers[1].onmessage;c.k++;late({data:{result:{found:[hit],complete:true}}});c.ochkiSnakeFor();assert.deepEqual(JSON.parse(JSON.stringify(workers[2].data.skipIndices)),[[],[]]);
});
test('separate row-run transport holds its visible row for three seconds and never starts normal playback',()=>{
 const a=fixture(),c=a.c;let interval;c.rowRun={prev:0,r:0,timer:0};c.total=()=>1;c.setInterval=fn=>(interval=fn,1);c.st.speed=1;c.draw=()=>{};c.rowRunEnd=()=>{c.rowRun=null;};const start=html.indexOf('    rowRun.timer = setInterval('),end=html.indexOf('}, 60);',start)+7;vm.runInContext(html.slice(start,end)+';globalThis.isPaused=()=>!!ochkiPause;',c);
 a.api.get();assert.equal(c.isPaused(),true);interval();assert.equal(c.rowRun.r,0);a.advance(2999);interval();assert.equal(c.rowRun.r,0);a.advance(1);assert.equal(c.isPaused(),false);interval();assert.equal(c.rowRun.r,1);assert.equal(c.playing,false);assert.equal(c.resumes,undefined);
});
