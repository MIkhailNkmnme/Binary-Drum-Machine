const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Host=require('./mayatnik-gif-live-host.js');
function fixture(){
 const snapshots=[],pushes=[],requests=[],jobs=[],results=[],states=[],reports=[];let frame=0,owner={},captureCount=0,busy=false,pending=false;
 const source={width:2,height:8,pixels:new Uint8ClampedArray(64),bits:new Int8Array(16)},selection={variant:{method:'canvas',plan:{width:2,height:8}},frame:{rows:4},delay:150};
 const stack={element:{hidden:true,offsetHeight:200},setEnabled(v){this.element.hidden=!v;},inspect:()=>({busy}),requestFrame(source,meta){requests.push({source,meta});},refreshLayout(){},destroy(){this.destroyed=true;}};
 const o={host:{},Stack:{create(options){snapshots.push(options);return stack;}},Record:{start(options){let resolve,reject;const job={promise:new Promise((a,b)=>{resolve=a;reject=b;}),canPush:true,pending:0,push(value,meta){pushes.push({value,meta});},stop(){job.stopped=true;return job.promise;},cancel(){reject(Object.assign(Error('cancelled'),{name:'AbortError'}));},finish(){resolve({method:'canvas',rows:4,frames:[{}]});},fail:reject,options};jobs.push(job);return job;}},capture(){captureCount++;if(pending)throw Error('read pending');return source;},sourcePending:()=>pending,state:()=>({owner,key:frame,frame}),background:()=>[0,0,0],layout:()=>({left:10,width:400}),ready:async()=>{},report:s=>reports.push(s),onState:s=>states.push(s),onResult:r=>results.push(r)};
 const api=Host.create(o);return {api,o,source,selection,stack,snapshots,pushes,requests,jobs,results,states,reports,captures:()=>captureCount,setFrame(v){frame=v;},newOwner(){owner={};},setBusy(v){busy=v;},setPending(v){pending=v;}};
}
test('recording captures actual new logical frames including backward/manual steps without a timer',async()=>{
 const f=fixture();assert.equal(f.snapshots[0].fillWidth,true);await assert.rejects(f.api.start(),/выберите/);assert.equal(f.captures(),0);
 await f.api.start(f.selection);assert.equal(f.pushes.length,1);assert.equal(f.jobs[0].options.rows,4);assert.equal(f.jobs[0].options.delay,150);f.api.presented();assert.equal(f.pushes.length,1);
 f.setFrame(1);f.api.presented();f.setFrame(0);f.api.presented();f.newOwner();f.api.presented();assert.deepEqual(f.pushes.map(p=>p.meta.frame),[0,1,0,0]);
 const completion=f.api.stop();assert.equal(f.jobs[0].stopped,true);f.jobs[0].finish();await completion;await Promise.resolve();assert.equal(f.results.length,1);assert.equal(f.api.inspect().recording,false);f.api.destroy();
});
test('one immutable capture feeds both recording and preview; busy preview requests lazy latest state',async()=>{
 const f=fixture();await f.api.start(f.selection);f.api.setStack(true);f.setFrame(1);const before=f.captures();f.api.presented();assert.equal(f.captures(),before+1);assert.equal(f.pushes.at(-1).value,f.requests.at(-1).source);
 f.setBusy(true);f.api.presented();assert.equal(f.captures(),before+1);assert.equal(f.requests.at(-1).source,undefined);assert.equal(f.api.space(),200);
 f.api.setStack(false);assert.equal(f.api.space(),0);f.api.destroy();await Promise.resolve();
});
test('queue pressure pauses advancement, recovers, and a drained hard limit finalizes instead of waiting forever',async()=>{
 const f=fixture();await f.api.start(f.selection);const job=f.jobs[0];job.canPush=false;job.pending=8;assert.equal(f.api.wait(),true);job.pending=2;job.canPush=true;assert.equal(f.api.wait(),false);job.canPush=false;job.pending=0;assert.equal(f.api.wait(),true);assert.equal(job.stopped,true);job.finish();await job.promise;await Promise.resolve();assert.equal(f.api.needsCpu(),false);f.api.destroy();
});
test('preview memory/capture failure disables the preview and recording failure clears its state',async()=>{
 const f=fixture();f.api.setStack(true);f.snapshots[0].onError(Error('memory'));assert.equal(f.api.inspect().stack,false);
 await f.api.start(f.selection);f.jobs[0].fail(Error('palette'));await Promise.resolve();assert.equal(f.api.inspect().recording,false);assert.match(f.reports.at(-1),/palette/);f.api.destroy();
});
test('startup errors and destroy during readiness leave no active recorder',async()=>{
 const f=fixture();f.o.ready=async()=>{throw Error('not ready');};await assert.rejects(f.api.start(f.selection),/not ready/);assert.equal(f.api.needsCpu(),false);
 let ready;f.o.ready=()=>new Promise(r=>ready=r);const started=f.api.start(f.selection);f.api.destroy();ready();await assert.rejects(started,/закрыта/);assert.equal(f.jobs.length,0);
});
test('actual CPU quick and full presentations each notify the live host once; queue pressure prevents autoplay advancement',()=>{
 const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8'),a=html.indexOf('  function present(quick)'),b=html.indexOf('\n  // v0.249:',a),present=html.slice(a,b);let notified=0;
 const noop=()=>{},context={window:{mayGifScalePresented(){notified++;}},snakePathRefresh:noop,requestAnimationFrame:noop,f:{},geo:{},gpuDisplay:()=>false,img:{},pxView:()=>({width:1,height:1}),DPR:()=>1,scale:()=>1,RK:1,cv:{width:1,height:1},g:{putImageData:noop},layerService:fn=>fn(),notifyXorromField:noop};
 for(const name of ['align','anchorDash','vtxLabelsDraw','midColLine','fixColLines','bothDraw','mirDraw','contourDraw','rowLabDraw','flashDraw','sectorDraw','axisLogTick','fixOvDraw','areaFreezeDraw','ovlDraw','queueLineMeasures','manualSnakeShown','rowBuildHighlightDraw'])context[name]=noop;
 vm.createContext(context);vm.runInContext(present,context);context.present(true);context.present(false);assert.equal(notified,2);
 let waiting=0,advanced=0;const tickStart=html.indexOf('  function tick()'),tickEnd=html.indexOf('  // v0.003:',tickStart),tick=html.slice(tickStart,tickEnd),c={window:{mayGifScaleFrameWait:()=>true},playing:true,next(){waiting++;},more(){advanced++;}};vm.createContext(c);vm.runInContext(tick,c);c.tick();assert.equal(waiting,1);assert.equal(advanced,0);
});

test('live preview preference persists independently in presets, links and reset defaults',async()=>{
 const S=require('./mayatnik-settings-library.js'),L=require('./mayatnik-share-link.js'),R=require('./mayatnik-reset-state.js');
 for(const flag of [false,true]){const state={rows:8,steps:8,mode:'pend',bg:'empty',gifScaleStack:flag},target={};S.applyState(target,S.pick(state));assert.equal(target.gifScaleStack,flag);assert.equal((await L.decode(await L.encode({v:1,k:0,state}))).state.gifScaleStack,flag);}
 const old=S.pick({});delete old.state.gifScaleStack;const restored={gifScaleStack:true};S.applyState(restored,old);assert.equal(restored.gifScaleStack,false);assert.equal(R.defaults().gifScaleStack,false);
});

test('approaching the encoded memory cap finishes the accepted recording instead of losing its frames',async()=>{
 const f=fixture();await f.api.start(f.selection);const job=f.jobs[0];job.options.onProgress({frames:100,pending:1,bytes:128*1024*1024-1000});assert.equal(job.stopped,true);job.finish();await job.promise;await Promise.resolve();assert.equal(f.results[0].limitReason,'предел памяти');f.api.destroy();
});
