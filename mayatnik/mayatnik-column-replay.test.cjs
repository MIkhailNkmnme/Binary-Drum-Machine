const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Fill=require('./mayatnik-fill.js'),html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
function fixture(){
 const controls={fillInfo:{dataset:{}},fillColour:{value:'#aabbcc'},fillMirror:{checked:false},bFillClear:{},bFillUndo:{},bFillRedo:{},templateInfo:{},templateHeight:{value:100},templateDown:{value:0},templateAlpha:{value:50},templateProportional:{checked:false},templateTrail:{checked:false}};
 const c={manualPaintState:null,manualPaintRevision:0,manualPaintCurrent:()=>null,manualPaintEntryCurrent:()=>false,manualPaintSnapshot:()=>null,manualPaintRestore(){},manualPaintClear(){},manualPaintFrameSync(){},st:{view:'bits',fillArea:'sides'},f:{W:9,H:6,val:new Int8Array(54)},geo:{anchor:4},VX:2,VW:5,VH:6,RK:1,RG:0,k:0,autoVertical:1,colReplay:[],colReplayPaint:null,fillBits:null,templatePaintLayer:null,fillMask:null,fillKey:'0',fillField:null,fillHistory:[],fillRedo:[],fillHistoryBytes:0,playing:false,templateDragging:false,mirrorLive:false,mirrorApplying:false,templateMatchRevision:0,templateMatchLayer:null,faceLayer:null,templateItems:[],templatePickedIds:new Set(),templateLibrary:[],removedTemplateIds:new Set(),colourTemplate:null,templateMatchCache:null,paintBits:null,Uint32Array,Uint8Array,Int8Array,Map,Set,structuredClone,MayatnikFill:Fill,MayatnikPaintCache:{write:()=>Promise.resolve()},window:{},autoPaintIds:[],mirrorXor:false,templateOffsetX:0,templateReturn:null,templatePaintBit:0,templateVisible:false,fillMode:false,
  $:id=>controls[id],rgba:rgb=>(0xff000000|rgb[2]<<16|rgb[1]<<8|rgb[0])>>>0,paintToolColour:()=>controls.fillColour.value,fillSync(){},clearFillPreview(){},rememberTemplate(){},persistLibrary(){},selectTemplate(){},lockWipe(){},savePaint(){c.saves++;},saves:0,rombP:()=>-1,joinedOn:()=>false,parityVisible:()=>true,outShow:()=>false,
  displayCell:(x,y)=>({c:c.VX+Math.floor(x),r:Math.floor(y),p:-1,ox:0}),displayPoint:(col,row)=>({x:col-c.VX+.5,y:row+.5}),
  fillBit(x,y){const col=c.VX+Math.floor(x/c.RK),row=Math.floor(y/c.RK);return x<0||x>=c.img.width||y<0||y>=c.img.height||col>=c.f.W||row>=c.f.H?-1:c.f.val[row*c.f.W+col];},
  triangleMapRasterMask:()=>c.mapMask||null,cv:{getBoundingClientRect:()=>({left:0,top:0,width:c.img.width,height:c.img.height})}};
 c.draw=()=>{const px=new Uint32Array(c.img.data.buffer);px.fill(0xff010203);if(c.fillMask)for(let q=0;q<px.length;q++)if(c.fillMask[q])px[q]=c.fillMask[q];c.colReplayRun(px);};
 c.resize=(vx,width=9-vx)=>{c.VX=vx;c.VW=width;c.img={width:width*c.RK,height:c.VH*c.RK,data:new Uint8ClampedArray(width*c.RK*c.VH*c.RK*4)};c.fillBits=null;};c.resize(2,5);c.fillField=c.f;
 c.gpuBig=null;vm.createContext(c);
 for(const code of [section('  function templatePaintValidate(','  function templatePaintBuild('),section('  function fieldCellAt(','  // Final view mask'),section('  function cellPixels(','  function templateLimitRefusal('),section('  function columnSeed(','  // v0.310:'),section('  function fillAt(','  // v0.070:'),section('  function pushHistory(','  function sceneSnapshot('),section('  function sceneSnapshot(',"  $('bRegions').onclick"),section('  function paintSnapshot(','  function savePaint('),section('  function resetFillHistory(','  function clearFill(')])vm.runInContext(code,c);
 c.click=(col,row)=>c.fillAt((col-c.VX+.5)*c.RK,(row+.5)*c.RK);
 c.painted=()=>{const out=[];for(let q=0;q<(c.colReplayPaint?.length||0);q++)if(c.colReplayPaint[q])out.push({c:c.VX+q%c.img.width,r:Math.floor(q/c.img.width),colour:c.colReplayPaint[q]});return out;};
 return {c,controls};
}
const plain=v=>JSON.parse(JSON.stringify(v));

test('clicked bit chooses one strict field column including the seed and skipping mismatching rows',()=>{
 for(const bit of [0,1]){const {c}=fixture();c.f.val.fill(1-bit);for(const r of [1,3,5])c.f.val[r*9+5]=bit;c.autoVertical=bit?2:1;c.click(5,1);
  assert.deepEqual(plain(c.colReplaySnapshot()),[{c:5,r:1,bit,colour:0xffccbbaa}]);assert.deepEqual(c.painted().map(p=>[p.c,p.r]),[[5,1],[5,3],[5,5]]);
  const preview=c.paintSelection(3,1,true);assert.deepEqual([...preview.indices],[8,18,28]);assert.equal(c.fillMask,null,'replay never bakes into ordinary paint');
 }
 const {c}=fixture();c.f.val.fill(1);c.click(4,2);assert.deepEqual(c.painted().map(p=>[p.c,p.r]),[[4,2],[4,3],[4,4],[4,5]],'a connected same-bit field cannot spill sideways or upward');
});

test('three frames with shifted VX and changed seed bit replay the original c/bit without stale paint',()=>{
 for(const bit of [0,1]){const {c}=fixture();c.f.val.fill(1-bit);c.f.val[1*9+5]=bit;c.f.val[3*9+5]=bit;c.click(5,1);const saved=plain(c.colReplaySnapshot());
  c.fillMask=new Uint32Array(30);c.fillMask[0]=0xff223344;
  for(const [frame,vx,rows]of [[1,1,[2,4]],[2,0,[1,5]],[3,2,[3]]]){c.k=frame;c.f.val.fill(1-bit);for(const row of rows)c.f.val[row*9+5]=bit;c.resize(vx);c.fillMask=new Uint32Array(c.img.width*6);c.fillMask[0]=0xff223344;c.draw();assert.deepEqual(c.painted().map(p=>[p.c,p.r]),rows.map(r=>[5,r]));assert.equal(new Uint32Array(c.img.data.buffer)[0],0xff223344);assert.deepEqual(plain(c.colReplaySnapshot()),saved);}
  c.autoVertical=0;c.draw();assert.deepEqual(c.painted().map(p=>[p.c,p.r]),[[5,3]],'leaving paint mode does not stop a committed stroke');c.autoVertical=1;c.draw();assert.deepEqual(c.painted().map(p=>[p.c,p.r]),[[5,3]]);
 }
});

test('new seed replaces the old stroke in its column; actual Undo/Redo survives raster history resets',()=>{
 const {c}=fixture();c.f.val.fill(1);c.click(5,1);c.f.val[3*9+5]=0;c.click(5,3);assert.deepEqual(plain(c.colReplaySnapshot()),[{c:5,r:3,bit:0,colour:0xffccbbaa}]);
 c.resize(1);c.resetFillHistory();assert.equal(c.fillHistory.length,2);c.historyStep(false);assert.equal(c.colReplay[0].r,1);assert.equal(c.colReplay[0].bit,1);c.historyStep(true);assert.equal(c.colReplay[0].r,3);assert.equal(c.colReplay[0].bit,0);
 c.click(5,3);assert.equal(c.colReplay.length,0,'clicking the same seed toggles its stroke off');c.historyStep(false);assert.equal(c.colReplay.length,1);assert.ok(c.saves>=5);
});

test('Clear and its Undo/Redo restore commands, including after frame changes with mixed ordinary paint',()=>{
 for(const mixed of [false,true]){const {c,controls}=fixture();c.f.val.fill(1);c.click(5,1);if(mixed){c.fillMask=new Uint32Array(30);c.fillMask[0]=0xff123456;}controls.bFillClear.onclick();assert.equal(c.colReplay.length,0);assert.equal(c.colReplayPaint,null);
  c.historyStep(false);assert.equal(c.colReplay.length,1);assert.equal(c.colReplay[0].c,5);if(mixed)assert.equal(c.fillMask[0],0xff123456);c.historyStep(true);assert.equal(c.colReplay.length,0);
  c.resize(1);c.fillMask=null;c.resetFillHistory();c.historyStep(false);assert.equal(c.colReplay.length,1,'Undo must undo Clear, not an earlier stroke');assert.ok(c.painted().every(p=>p.c===5));assert.equal(c.fillMask,null,'old raster paint is not carried into the new frame');c.historyStep(true);assert.equal(c.colReplay.length,0);
 }
});

test('ordinary paint snapshot and reload retain semantic strokes while the fill snapshot stays clean',()=>{
 const a=fixture().c;a.f.val.fill(0);a.click(5,2);const snapshot=a.paintSnapshot();assert.equal(snapshot.fill,null);assert.deepEqual(plain(snapshot.columns),[{c:5,r:2,bit:0,colour:0xffccbbaa}]);
 const b=fixture().c;b.f.val.fill(1);b.f.val[4*9+5]=0;b.resize(0);b.colReplayRestore(JSON.parse(JSON.stringify(snapshot.columns)));b.draw();assert.deepEqual(b.painted().map(p=>[p.c,p.r]),[[5,4]]);assert.equal(b.fillMask,null);assert.ok(!Object.hasOwn(b.colReplay[0],'f'));
});

test('legacy raster coordinates migrate once in the restored view and saved v retains its bit',()=>{
 const {c}=fixture();c.f.val.fill(0);c.fillMask=new Uint32Array(30).fill(0xffccbbaa);c.colReplayRestore([{x:3,y:2,v:2,colour:0xffccbbaa,mirror:false}]);assert.deepEqual(plain(c.colReplaySnapshot()),[{c:5,r:2,bit:0,colour:0xffccbbaa}]);assert.ok(c.fillMask.every(v=>v===0xffccbbaa),'legacy paint has no ownership metadata and must remain intact');
 c.resize(1);c.colReplayRestore(c.colReplaySnapshot());c.draw();assert.ok(c.painted().every(p=>p.c===5&&p.r>=2));c.colReplayRestore([null,{c:-1,r:0,bit:0,colour:1},{c:5,r:2,bit:4,colour:1}]);assert.equal(c.colReplay.length,0);
});

test('explicit legacy-area selection keeps the unchanged Pass flood semantics',()=>{
 const {c}=fixture();c.f.val.fill(1);const strict=c.paintSelection(2,2,false),areas=c.paintSelection(2,2,false,false,null,true);assert.equal(strict.indices.length,4);assert.equal(areas.indices.length,30);assert.equal(Fill.down(new Uint8Array(25).fill(2),5,12,[2]).indices.length,25);
});

test('replay allocates no per-stroke full-field membership mask and hides clipped/masked cells',()=>{
 const {c}=fixture();c.f.val.fill(1);c.click(5,1);let allocations=0;c.Uint8Array=class extends Uint8Array{constructor(...args){super(...args);allocations++;}};c.resize(1);c.mapMask=new Uint8Array(c.img.width*6);c.st.triangleMapMask=true;c.mapMask[2*c.img.width+4]=1;c.draw();assert.equal(allocations,0);assert.ok(!c.painted().some(p=>p.r===2));c.resize(6,3);c.draw();assert.equal(c.painted().length,0);
});

test('the actual Column button is on/off and committed strokes survive stopping/restarting its input mode',()=>{
 const {c,controls}=fixture();controls.bAutoVertical={setAttribute(k,v){this[k]=v;}};controls.bAxisPick={setAttribute(){}};Object.assign(c,{wrap:{classList:{toggle(){}}},templateSync(){},stop(){c.playing=false;},clearKonus(){},queueDigits(){}});
 vm.runInContext(section('  function autoSync(){',"  $('fillMirror').onchange"),c);c.f.val.fill(1);c.click(5,1);
 c.autoVertical=2;controls.bAutoVertical.onclick();assert.equal(c.autoVertical,0);assert.equal(controls.bAutoVertical.textContent,'Столб выкл');controls.bAutoVertical.onclick();assert.equal(c.autoVertical,1);assert.equal(controls.bAutoVertical.textContent,'Столб вкл');controls.bAutoVertical.onclick();assert.equal(c.autoVertical,0);assert.equal(c.colReplay.length,1);
});

test('Start from zero captures the replay before clearing and supports Undo including mixed paint',()=>{
 for(const mixed of [false,true]){const {c,controls}=fixture();controls.bPaintNew={};controls.bAxisPick={setAttribute(){}};Object.assign(c,{cacheRestoring:false,stop(){},lockAny:()=>false,keepPaint(data){c.kept=data;},autoSync(){},clearKonus(){},templateSync(){}});
  vm.runInContext(section("  $('bPaintNew').onclick=", "  $('bPaintOpen').onclick"),c);c.f.val.fill(1);c.click(5,1);if(mixed){c.fillMask=new Uint32Array(30);c.fillMask[0]=0xff112233;}controls.bPaintNew.onclick();assert.equal(c.kept.columns.length,1);assert.equal(c.colReplay.length,0);assert.equal(c.colReplayPaint,null);assert.equal(c.fillMask,null);c.historyStep(false);assert.equal(c.colReplay[0].c,5);if(mixed)assert.equal(c.fillMask[0],0xff112233);c.historyStep(true);assert.equal(c.colReplay.length,0);
 }
});

test('actual restorePaint migrates legacy commands after reset/view geometry and passes normalized records to frameHost',async()=>{
 const {c,controls}=fixture(),events=[],seed=c.columnSeed,draw=c.draw,source={x:3,y:2,v:2,colour:0xffccbbaa};c.f.val.fill(0);const data=c.paintSnapshot();delete data.columns;data.frameHost={replay:[source],state:{},version:1};
 c.$=id=>controls[id]||(controls[id]={value:0,checked:false,dataset:{}});
 Object.assign(c,{cacheWrites:Promise.resolve(),gpuBig:null,cacheRestoring:false,chessLive:false,compareSource:'',MayatnikPaintGroups:{FIELDS:[],initialise(){}},MayatnikFaceTransform:{validate:()=>null},libraryReady:Promise.resolve(),validateFrameWork(){},mirrorLiveSet(){},writeUI(){},restoreFrameEffects(){events.push('effects');},reset(){events.push('reset');c.f={W:9,H:6,val:new Int8Array(54)};c.colReplay=[];},updWin(){events.push('view');c.VX=1;c.VW=5;},canvasSize(){events.push('canvas');c.resize(1,5);},draw(){events.push('draw');draw();},syncPaintToolColours(){},restorePaintGroupClocks(){},libraryList(){},axisLinesSync(){},triangleMapSync(){},crossMirrorSync(){},save(){},templateSync(){},layout(){},centerAnchor(){},cellHydrate(){},restoreFrameHost(host){assert.ok(host.replay.every(e=>Number.isInteger(e.c)&&!Object.hasOwn(e,'x')));events.push('host');c.colReplayRestore(host.replay);},columnSeed(x,y,bit){events.push('migrate:'+c.VX);return seed(x,y,bit);}});
 vm.runInContext(section('  async function restorePaint(',"  $('bPaintRestore').onclick"),c);assert.equal(await c.restorePaint(data),true);assert.deepEqual(events.filter(e=>e.startsWith('migrate')),['migrate:1']);assert.ok(events.indexOf('reset')<events.indexOf('view'));assert.ok(events.indexOf('canvas')<events.indexOf('migrate:1'));assert.ok(events.indexOf('migrate:1')<events.indexOf('host'));assert.deepEqual(plain(c.colReplaySnapshot()),[{c:4,r:2,bit:0,colour:0xffccbbaa}]);
});
