const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Follow=require('./mayatnik-template-follow.js'),M=require('./mayatnik-template-matcher.js'),Settings=require('./mayatnik-settings-library.js');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
const source=Follow.pack({rk:1,parts:[{width:2,height:2,data:[7,0,7,7]}]},M.compile);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const turn=()=>new Promise(r=>setImmediate(r));
function fn(name){const at=html.indexOf('function '+name+'('),start=html.indexOf('{',at);assert.ok(at>=0,name);let d=1,i=start+1;for(;d;i++){if(html[i]==='{')d++;if(html[i]==='}')d--;}return html.slice(at,i);}
test('saved source is compact, immutable, validated and survives JSON/F5 and named presets',()=>{
 const shape={rk:1,parts:[{width:2,height:2,data:[7,0,7,7]}]},packed=Follow.pack(shape,M.compile);shape.parts[0].data.fill(0);
 assert.deepEqual(Follow.unpack(packed).parts[0].data,[1,0,1,1]);assert.equal(packed.parts[0].bits,'d');
 const state={templateFindAll:{on:true,source:packed}},preset=Settings.normalized(Settings.pick(state));packed.parts[0].bits='f';assert.equal(preset.state.templateFindAll.source.parts[0].bits,'d');
 const restored={};Settings.applyState(restored,JSON.parse(JSON.stringify(preset)));assert.deepEqual(Follow.normalize(restored.templateFindAll),preset.state.templateFindAll);
 assert.equal(Settings.normalized(Settings.pick({})).state.templateFindAll,null);
 assert.throws(()=>Follow.normalize({on:true,source:null}));assert.throws(()=>Follow.normalize({on:true,source:{version:1,parts:[{width:2,height:2,bits:'x'}]}}));
 const p=Settings.pick({});p.state.templateFindAll={on:true,source:null};assert.throws(()=>Settings.normalized(p));
});
test('ON persists across empty frames and OFF cancels late work without deleting committed figures',async()=>{
 const owner={},hits=[],jobs=[];let frame=1;
 const api=Follow.create({capture:()=>({owner,key:frame}),search:async(shape,cancelled)=>{const job=deferred();jobs.push(job);await job.promise;if(!cancelled())hits.push(frame);return {message:'done'};}},{on:true,source});
 const first=api.ensure();await turn();assert.equal(api.busy,true);assert.equal(api.ensure(),first);jobs[0].resolve();await first;assert.equal(api.complete,true);
 frame=2;const second=api.ensure();await turn();assert.equal(api.on,true);api.off();jobs[1].resolve();await second;assert.deepEqual(hits,[1]);assert.equal(api.on,false);assert.equal(api.busy,false);
});
test('external stale frames and newer sources never publish and exact errors block their scope',async()=>{
 const owner={},published=[],errors=[],jobs=[];let key=1;
 const api=Follow.create({capture:()=>({owner,key}),search:()=>{const d=deferred();jobs.push(d);return d.promise;},result:r=>published.push(r),error:e=>errors.push(e.message)},{on:true,source});
 const first=api.ensure();await turn();key=2;jobs[0].resolve('stale');await first;assert.deepEqual(published,[]);assert.equal(api.complete,false);
 const second=api.ensure();await turn();jobs[1].reject(Error('allocation'));await second;assert.equal(api.blocked,true);assert.equal(api.complete,false);await api.ensure();assert.equal(jobs.length,2);assert.deepEqual(errors,['allocation']);
 key=3;const third=api.ensure();await turn();api.enable(source);jobs[2].resolve('old source');await third;assert.deepEqual(published,[]);assert.equal(api.blocked,false);
});
test('acknowledged own publication revision completes once, while a change after publication cannot acknowledge another frame',async()=>{
 const owner={};let revision=0,runs=0;
 const api=Follow.create({capture:()=>({owner,key:revision}),search:async()=>{runs++;revision++;return {completedScope:{owner,key:revision}};}},{on:true,source});
 await api.ensure();assert.equal(api.complete,true);await api.ensure();assert.equal(runs,1);
 const d=deferred();api.invalidate();const bad=Follow.create({capture:()=>({owner,key:revision}),search:()=>d.promise},{on:true,source});const job=bad.ensure();await turn();const completedScope={owner,key:++revision};revision++;d.resolve({completedScope});await job;assert.equal(bad.complete,false);
});
test('production autoplay and fast build visit and finish every frame even at speed 13',async()=>{
 for(const fast of [false,true]){
  const jobs=[],searched=[],drawn=[],c={k:0,target:4,playing:true,fast,raf:0,timer:0,st:{speed:13},gpuBig:null,paintJumpFrom:null,t0:0,lastDraw:0,drawMs:0,f:{val:new Int8Array(3)},performance,document:{hidden:false},gpuManualCpu:()=>false,gpuPaintCpu:()=>false,ochkiFrameWait:()=>false,templateFollowActive:()=>true,coneAutoExtend(){},advancePaintColour(){},status(){},next(){},stop(){c.playing=false;c.fast=false;},more(){if(c.k>=c.target)return false;c.k++;return true;}};
  c.templateFollow=Follow.create({capture:()=>({owner:c.f,key:c.k}),search:async()=>{const k=c.k,d=deferred();jobs.push(d);await d.promise;searched.push(k);}},{on:true,source});
  c.templateFollowFrameWait=()=>{if(c.templateFollow.complete)return false;c.templateFollow.ensure();return true;};c.draw=()=>{drawn.push(c.k);c.templateFollow.ensure();};vm.createContext(c);vm.runInContext(fn('tick'),c);
  for(let k=0;k<4;k++){c.tick();await turn();assert.equal(c.k,k,'pending search holds frame');jobs.at(-1).resolve();await c.templateFollow.idle();c.tick();assert.equal(c.k,k+1);await turn();}
  jobs.at(-1).resolve();await c.templateFollow.idle();assert.deepEqual(searched,[0,1,2,3,4]);assert.deepEqual(drawn,[1,2,3,4]);assert.equal(c.playing,false);assert.equal(c.templateFollow.on,true);
 }
});
test('production manual requests queue distinct frames and wait for each complete search',async()=>{
 const searched=[],jobs=[],c={k:4,f:{},playing:false,templateFollowReady:true,templateFollowQueue:Promise.resolve(),templateFollowTarget:null,templateNavigationSerial:0,gpuBig:null,templateFollowScope:()=>({}),setTimeout,Promise,$:()=>({}),goToImmediate(k){c.k=k;c.templateFollow.ensure();}};
 c.templateFollow=Follow.create({capture:()=>({owner:c.f,key:c.k}),search:async()=>{const frame=c.k,d=deferred();jobs.push(d);await d.promise;searched.push(frame);}},{on:true,source});
 vm.createContext(c);vm.runInContext(['templateFollowActive','templateFollowStep','templateFollowWait','goTo'].map(fn).join('\n'),c);
 const a=c.templateFollowStep(1),b=c.templateFollowStep(1);await turn();assert.equal(c.k,4);jobs[0].resolve();await turn();assert.equal(c.k,5);jobs[1].resolve();await turn();assert.equal(c.k,6);jobs[2].resolve();await Promise.all([a,b]);assert.deepEqual(searched,[4,5,6]);assert.equal(c.templateFollowTarget,null);
});
test('retired picker cannot reappear in menus or restore left selection, while source ID remains compatible',()=>{
 const menu=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8');assert.match(html,/<button id="bTemplatePick" hidden style="display:none!important"/);assert.doesNotMatch(menu,/button\('bTemplatePick'|\['bTemplatePick'/);
 assert.match(html,/templatePickEnabled=false;templatePickMode=s\.templatePickMode/);assert.match(html,/templatePickEnabled=false;templatePickMode=q\.templatePickMode/);
 assert.match(html,/if\(\(e\.button===2\|\|templateDragEnabled&&e\.button===0&&e\.pointerType!=='touch'\)/);
});
test('older pages without the optional follow runtime still normalize legacy presets',()=>{
 const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/mayatnik-settings-library.js','utf8'),c);
 const old=c.MayatnikSettingsLibrary.pick({outline:true});delete old.state.templateFindAll;
 const restored=c.MayatnikSettingsLibrary.normalized(old);assert.equal(restored.state.outline,true);assert.equal(restored.state.templateFindAll,null);
 old.state.templateFindAll={on:true,source};assert.throws(()=>c.MayatnikSettingsLibrary.normalized(old),/недоступен/);
});
test('manual frame change waits for pending GPU readback and search before advancing',async()=>{
 const search=deferred(),calls=[],c={f:{},gpuBig:{snapshotPending:{}},templateFollowReady:true,setTimeout,Promise,templateFollowScope:()=>ready?{}:null,stopFrameTransports:()=>calls.push('stop'),draw:()=>calls.push('draw')};let ready=false,complete=false;
 c.templateFollow={on:true,blocked:false,get complete(){return complete;},ensure:async()=>{calls.push('search');await search.promise;complete=true;}};
 vm.createContext(c);vm.runInContext(fn('templateFollowActive')+'\n'+fn('templateFollowWait'),c);let settled=false;const wait=c.templateFollowWait(c.f).then(v=>{settled=v;});await turn();assert.equal(settled,false);assert.deepEqual(calls,[]);
 ready=true;c.gpuBig.snapshotPending=null;await new Promise(r=>setTimeout(r,20));assert.deepEqual(calls,['search']);assert.equal(settled,false);search.resolve();await wait;assert.equal(settled,true);assert.equal(calls.includes('stop'),false);
});
test('row playback waits for exact completion and reveals only one next row at speed 13',()=>{
 let interval;const nodes=new Map(),c={rowRun:null,k:4,f:{H:10},st:{vrows:2,speed:13},playing:false,ochkiPause:null,templateFollowActive:()=>true,templateFollowFrameWait:()=>waiting,ochkiFrameWait:()=>false,total:()=>4,draw(){draws++;},$:id=>{if(!nodes.has(id))nodes.set(id,{value:0,setAttribute(){}});return nodes.get(id);},setInterval:fn=>{interval=fn;return 1;}};let waiting=true,draws=0;
 const a=html.indexOf("  $('bRowRun').onclick ="),b=html.indexOf("  $('bStep').onclick",a);vm.createContext(c);vm.runInContext(html.slice(a,b),c);c.$('bRowRun').onclick();interval();assert.equal(c.rowRun.r,0);assert.equal(draws,0);waiting=false;interval();assert.equal(c.rowRun.r,1);assert.equal(draws,1);waiting=true;interval();assert.equal(c.rowRun.r,1);
});
test('engine propagates exact follow failures and external cancellation instead of reporting success',async()=>{
 global.MayatnikTemplateMatcher=M;const Engine=require('./mayatnik-template-engine.js'),field={width:1,height:1,data:Int8Array.of(1)},shape={rk:1,parts:[{width:1,height:1,data:[1]}]};let cancelled=false,stops=0;
 const host={entries:()=>[],field:async()=>field,current:()=>true,shapeInstances:()=>[],stop:()=>stops++,redrawSelection(){},materializeMatches:async()=>{throw Error('allocation');}};
 const engine=Engine.create(host);await assert.rejects(engine.selectShape(shape,{follow:true,materialize:true}),/allocation/);assert.equal(engine.getState().busy,false);assert.equal(stops,0);
 const d=deferred();host.field=()=>d.promise;const pending=engine.selectShape(shape,{follow:true,materialize:true,cancelled:()=>cancelled});cancelled=true;d.resolve(field);await assert.rejects(pending,{name:'AbortError'});assert.equal(engine.getState().busy,false);
});
