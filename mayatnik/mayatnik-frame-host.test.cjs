const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8'),Work=require('./mayatnik-work-file.js'),M=require('./mayatnik-core.js');
function fn(name){const start=html.indexOf('function '+name+'(');assert.ok(start>=0,name);const brace=html.indexOf('{',start);let depth=1,i=brace+1;for(;depth&&i<html.length;i++){if(html[i]==='{')depth++;else if(html[i]==='}')depth--;}return html.slice(start,i);}
function work(){const st={rows:8,steps:1,mode:'one',bg:'empty',userLines:[[0,0,3,3]],nAxisSets:[{n:5}]};return {schema:2,st,k:1,field:new Int8Array(M.geometry('one',1,8).W*8).fill(0),width:15,height:8,fill:new Uint32Array(120),paintBits:new Int8Array(120).fill(-1),colour:'#abcdef',templates:[],library:[{id:'old'}],libraryHidden:['hidden']};}
function fixture(){let current=work(),restoreCalls=[],writes=[],stops=0,restoredHosts=[];const nodes=new Map(),canvas=()=>({width:1,height:1,getContext:()=>({putImageData(){},drawImage(){}}),toDataURL:()=> 'data:image/png;base64,test'});
 const c=vm.createContext({Int8Array,Uint32Array,Uint8Array,Uint8ClampedArray,structuredClone,Math,Number,Error,Set,Object,Array,document:{createElement:()=>canvas()},wrap:{clientWidth:600,clientHeight:400},MAYATNIK:M,MayatnikWorkFile:Work,MayatnikPaintCache:{write:async d=>writes.push(d)},gpuApi:null,GPU_URL:null,GPU_BIG:13e6,gpuBig:null,gpuReady:Promise.resolve(),cacheRestoring:false,templateDragging:null,frameLibraryBusy:false,f:{},img:{},k:1,target:1,st:current.st,cacheWrites:Promise.resolve(),libraryReady:Promise.resolve(),fillHistory:['undo'],fillRedo:['redo'],fillHistoryBytes:55,
  paintSnapshot:()=>structuredClone(current),frameHostSnapshot:()=>({version:1,controls:{},layers:[],state:{mirrorLine:true}}),restoreFrameHost:d=>restoredHosts.push(d),restorePaint:async d=>{restoreCalls.push(d);current=structuredClone(d);restoredHosts.push(d.frameHost);return true;},keepPaint:d=>writes.push(d),savePaint:()=>{},queueSession:()=>{},fillSync:()=>{},stop:()=>stops++,autoStop:()=>{},rowRunEnd:()=>{},stolbTransport:null,drawDigits:()=>{},drawTemplate:()=>{},gifViewFrame:c=>c,$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);}});
 for(const name of ['validateFrameWork','frameWorkOnly','frameLibraryGuard','stopFrameTransports'])vm.runInContext(fn(name),c);
 // async keyword is outside the function extraction prefix.
 for(const name of ['captureLibraryFrame','restoreLibraryFrame'])vm.runInContext('async '+fn(name),c);
 return {c,restoreCalls,writes,restoredHosts,get stops(){return stops;},get current(){return current;},setRestore:fn=>c.restorePaint=async d=>{restoreCalls.push(d);return fn(d);}};
}
test('whole frame capture encodes editable arrays, axes and view settings independently of template catalogue',async()=>{
 const f=fixture(),saved=await f.c.captureLibraryFrame(),parsed=await Work.decode(saved.blob);assert.equal(parsed.format,'mayatnik-work');assert.equal(saved.frame,1);assert.equal(saved.rows,8);assert.match(saved.thumbnail,/^data:image\/png/);
 assert.equal(parsed.data.library,undefined);assert.equal(parsed.data.libraryHidden,undefined);assert.deepEqual(parsed.data.st.userLines,[[0,0,3,3]]);assert.deepEqual(parsed.data.st.nAxisSets,[{n:5}]);assert.ok(parsed.data.field instanceof Int8Array);assert.ok(parsed.data.fill instanceof Uint32Array);assert.equal(parsed.data.frameHost.state.mirrorLine,true);
});
test('open strips an embedded old template catalogue and preserves backup, controls and undo before replacement',async()=>{
 const f=fixture(),data=work();data.k=0;data.frameHost={version:1,controls:{},state:{mirrorLine:true},layers:[]};await f.c.restoreLibraryFrame(await Work.encode(data));
 assert.equal(f.restoreCalls.length,1);assert.equal(f.restoreCalls[0].library,undefined);assert.equal(f.restoreCalls[0].libraryHidden,undefined);assert.equal(f.restoreCalls[0].k,0);assert.equal(f.writes.length,2);assert.equal(f.writes[0].k,1);assert.equal(f.writes[1].k,0);assert.equal(f.writes[1].frameHost.state.mirrorLine,true);assert.equal(f.restoredHosts[0].state.mirrorLine,true);
});
test('failed restoration rolls back cloned work and undo stacks',async()=>{
 const f=fixture();let calls=0;f.setRestore(()=>++calls>1);await assert.rejects(f.c.restoreLibraryFrame(await Work.encode(work())),/восстановить кадр/);assert.equal(f.restoreCalls.length,2);assert.equal(f.restoreCalls[1].k,1);assert.deepEqual(Array.from(f.c.fillHistory),['undo']);assert.deepEqual(Array.from(f.c.fillRedo),['redo']);assert.equal(f.c.fillHistoryBytes,55);assert.equal(f.c.frameLibraryBusy,false);
});
test('corrupt encoded work rejects before stop, replacement or backup writes',async()=>{
 for(const change of [d=>d.field=new Int8Array(3),d=>d.paintBits=new Int8Array(1),d=>d.k=99,d=>d.templates=[{view:{},parts:[{mask:{width:2,height:2,x:0,y:0,data:new Uint32Array(3)}}]}],d=>d.frameHost={version:1,controls:{},state:{},layers:[{id:'bad'}]}]){
  const f=fixture(),d=work();change(d);await assert.rejects(f.c.restoreLibraryFrame(await Work.encode(d)));assert.equal(f.stops,0);assert.equal(f.restoreCalls.length,0);assert.equal(f.writes.length,0);
 }
});
test('invalid bytes reject without changing the current editable frame',async()=>{
 const f=fixture();await assert.rejects(f.c.restoreLibraryFrame(new Blob(['broken'])));assert.equal(f.stops,0);assert.equal(f.restoreCalls.length,0);assert.equal(f.current.k,1);
});
test('GPU capture/open refuse clearly before any field or paint mutation',async()=>{
 const f=fixture();f.c.gpuBig={};await assert.rejects(f.c.captureLibraryFrame(),/пока доступна в режиме процессора/);await assert.rejects(f.c.restoreLibraryFrame(await Work.encode(work())),/GPU-кадр не изменён/);assert.equal(f.stops,0);assert.equal(f.restoreCalls.length,0);
 const g=fixture();g.c.gpuApi={};g.c.GPU_URL='1';await assert.rejects(g.c.restoreLibraryFrame(await Work.encode(work())),/требует видеокарту/);assert.equal(g.stops,0);assert.equal(g.restoreCalls.length,0);
});
test('frame host validates layer pixels before attempting restore',async()=>{
 const f=fixture(),d=work();d.frameHost={version:1,state:{},controls:{},layers:[{id:'snapshot:1',kind:'snapshot',order:1,opacity:100,x:0,y:0,rect:{left:0,top:0,width:2,height:2},source:{width:2,height:2,pixels:new Uint8ClampedArray(3)}}]};await assert.rejects(f.c.restoreLibraryFrame(await Work.encode(d)),/изображение слоя/);assert.equal(f.stops,0);
});
test('engine and ready event are wired on window; restore suppresses automatic colour steps',()=>{
 assert.match(html,/src="mayatnik-frame-library\.js\?v=\d+"/);assert.match(html,/window\.mayFrameLibrary=MayatnikFrameLibrary\.create/);assert.match(html,/window\.dispatchEvent\(new CustomEvent\('may-frame-library-ready'/);assert.match(html,/if\(!sessionReady\|\|cacheRestoring\)return/);
 for(const match of html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
 assert.match(fn('frameHostSnapshot'),/frameCanvasData\(e\.source\)/);assert.match(fn('restoreFrameHost'),/A\._frame\(id/);assert.match(fn('frameHostSnapshot'),/frozen:ovlFrozen/);
});
test('same-geometry frames replace locked paint and chess colours rather than inheriting current caches',()=>{
 const c=vm.createContext({structuredClone,clearTimeout:()=>{},f:{val:new Int8Array(16)},templateLocks:{paint:{1:[99,0]}},lockSaveT:1,lockMir:{stale:true},lockLast:{stale:true},lockVer:0,lockSave:()=>{},chessRetry:1,chessLive:false,chessLayer:null,chessPrev:null,chessNext:0,chessSpare:[],k:2,st:{view:'bits'},VX:0,VW:4,VH:4,RK:1,RG:0,geo:{anchor:2},paintBits:null,fillHistory:[],fillRedo:[]});vm.runInContext(fn('restoreFrameEffects'),c);
 const a={locks:{sig:'same',items:{},paint:{1:[0xff001122,0]},masks:{}},state:{chessLive:true},chess:{layer:{of:new Uint32Array([0,0xff987654])},previous:{colour:new Uint8Array([255,7])},next:8}},b=structuredClone(a);b.locks.paint[1][0]=0xffaabbcc;b.chess.layer.of[1]=0xff123456;b.chess.next=11;
 c.restoreFrameEffects(a);assert.equal(c.templateLocks.paint[1][0],0xff001122);assert.equal(c.chessLayer.of[1],0xff987654);assert.equal(c.chessNext,8);assert.equal(c.chessLive,true);assert.equal(c.lockMir,null);assert.equal(c.lockLast,null);
 c.restoreFrameEffects(b);assert.equal(c.templateLocks.paint[1][0],0xffaabbcc);assert.equal(c.chessLayer.of[1],0xff123456);c.restoreFrameEffects(a);assert.equal(c.templateLocks.paint[1][0],0xff001122);assert.equal(c.chessLayer.of[1],0xff987654);assert.equal(c.chessNext,8);assert.equal(a.chess.layer.key,undefined,'source backup is not mutated');
 a.replay=[{x:2,y:3,v:1,mirror:true}];c.restoreFrameEffects(a);assert.equal(c.colReplay.length,1);assert.equal(c.colReplay[0].f,c.f);assert.equal(c.colReplay[0].x,2);assert.equal(c.colReplay[0].mirror,true);
 for(const part of [1,2]){a.third={k:2,part,prev:{px:new Uint32Array([0xff010203])}};a.lastShown={k:2,px:new Uint32Array([0xff040506])};c.restoreFrameEffects(a);assert.equal(c.third.part,part);assert.equal(c.third.prev.px[0],0xff010203);assert.equal(c.lastShown.px[0],0xff040506);}
});
