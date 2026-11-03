'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Field=require('./mayatnik-xorrom-field.js');
const Music=require('./mayatnik-xorrom.js');
const Share=require('./mayatnik-share-link.js');
const Work=require('./mayatnik-work-file.js');
const html=fs.readFileSync(require.resolve('./Zerkalius-mayatnik.html'),'utf8');

function source(first,next){
  const start=html.indexOf('  '+first),end=html.indexOf('  '+next,start+1);
  assert.ok(start>=0&&end>start,'host function '+first);
  return html.slice(start,end);
}
function host(){
  const grid=[[0,1,-1],[1,0,0]],calls={acquire:0,release:0};
  const h={f:{val:new Int8Array(6)},geo:{},VW:3,VH:2,k:9,st:{view:'bits'},gpuBig:null,present:{},img:null,pxView:()=>({width:h.VW,height:h.VH,data:new Uint8ClampedArray(h.VW*h.VH*4)}),
    joinedOn:()=>false,rombP:()=>-1,document:{body:{classList:{contains:()=>false}}},
    rgbNeighbourFilters:()=>[],rgbNeighbourBWMode:()=>0,rgbNeighbourClasses:null,
    manualPaintRevision:0,templateMatchRevision:0,MayatnikXorromField:Field,window:{}};
  const semantic={width:3,height:2,current:()=>true,readBit:(x,y)=>grid[y][x],release(){calls.release++;}};
  h.window.mayVisibleSemantic={async acquire(options){
    assert.equal(options.lazy,true);assert.ok(!options.preserveTransport);calls.acquire++;return semantic;
  }};
  vm.runInNewContext(source('async function captureXorromField','window.mayXorrom='),h);
  return {h,grid,semantic,calls};
}

test('captures shown semantic bits with holes and preserves the stopped frame as a score',async()=>{
  const {h,grid,calls}=host(),score=await h.captureXorromField();
  grid[0][0]=1;assert.equal(score.frame,9);assert.equal(score.width,3);assert.equal(score.height,2);
  assert.deepEqual(score.rows.map(row=>[...row.bits]),[[0,1,-1],[1,0,0]]);
  assert.deepEqual(score.rows.map(row=>[row.ones,row.total]),[[1,2],[1,3]]);
  assert.deepEqual([...score.rows[0].colors],[0,1,0,0,1,0,0,0]);
  assert.deepEqual(calls,{acquire:1,release:1});
});

test('RGB uses displayed neighbour classes, original semantic bits, and selected colours in either B/W palette',async()=>{
  for(const bw of [0,1,2]){
    const {h}=host();h.st.view='rgbNeighbours';h.rgbNeighbourBWMode=()=>bw;
    h.rgbNeighbourClasses=Uint8Array.of(6,1,255,0,1,3);h.rgbNeighbourFilters=()=>[1,6];
    const {rows}=await h.captureXorromField();
    assert.deepEqual(rows.map(row=>[...row.bits]),[[0,1,-1],[-1,0,-1]]);
    assert.deepEqual([...rows[0].colors],[0,1,0,0,0,0,1,0]);
    assert.deepEqual([...rows[1].colors],[0,1,0,0,0,0,0,0]);
  }
});

test('180 degrees reverses both coordinates and keeps the RGB identity on each rotated cell',async()=>{
  const {h}=host();h.st.viewUpsideDown=true;h.st.view='rgbNeighbours';
  h.rgbNeighbourClasses=Uint8Array.of(1,2,255,3,4,5);
  const {rows}=await h.captureXorromField();
  assert.deepEqual(rows.map(row=>[...row.bits]),[[0,0,1],[-1,1,0]]);
  assert.deepEqual([...rows[0].colors],[0,0,0,1,1,1,0,0]);
  assert.deepEqual([...rows[1].colors],[0,1,1,0,0,0,0,0]);
});

test('cancels a score on changed semantic frame, paints, templates, view, colour selection or explicit stop',async()=>{
  for(const mutate of [
    (h,s)=>s.current=()=>false,h=>h.manualPaintRevision++,h=>h.templateMatchRevision++,
    h=>h.st.view='col',h=>h.st.viewUpsideDown=true,h=>h.rgbNeighbourBWMode=()=>1,
    h=>h.rgbNeighbourFilters=()=>[2],h=>h.rgbNeighbourClasses=h.rgbNeighbourClasses.slice()
  ]){
    const {h,semantic,calls}=host();h.st.view='rgbNeighbours';h.rgbNeighbourClasses=new Uint8Array(6);
    const previous=semantic.readBit;
    semantic.readBit=(x,y)=>{if(!x&&!y)mutate(h,semantic);return previous(x,y);};
    await assert.rejects(h.captureXorromField(),{name:'AbortError'});assert.equal(calls.release,1);
  }
  const {h,calls}=host();
  await assert.rejects(h.captureXorromField({cancelled:()=>true}),{name:'AbortError'});
  assert.ok(calls.acquire===calls.release);
});

test('releases the semantic snapshot on a bad shape or unreadable bit',async()=>{
  const {h,semantic,calls}=host();semantic.width++;
  await assert.rejects(h.captureXorromField(),/плоский снимок/);
  semantic.width--;semantic.readBit=()=>{throw Error('ошибка чтения');};
  await assert.rejects(h.captureXorromField(),/ошибка чтения/);assert.deepEqual(calls,{acquire:2,release:2});
});

test('unbuilt, oversized, GPU, folded, joined and projected fields fail before acquisition',async()=>{
  for(const [change,reason] of [[h=>h.f=null,/постройте/],[h=>h.geo=null,/постройте/],
    [h=>h.VH=Field.MAX_ROWS+1,/большой/],[h=>h.VW=Field.MAX_CELLS,/большой/],[h=>h.gpuBig={},/CPU/],
    [h=>h.rombP=()=>0,/плоский/],[h=>h.joinedOn=()=>true,/плоский/],[h=>h.st.edgeRhombOn=true,/Ромбо/],
    [h=>h.document.body.classList.contains=name=>name==='may-fold-active',/плоский/]]){
    const {h,calls}=host();change(h);await assert.rejects(h.captureXorromField(),reason);
    assert.equal(calls.acquire,0);
  }
});

test('only cloned audio tracks are owned and stopped by the recorder',()=>{
  const {h}=host(),recorded=[],output={addTrack:track=>recorded.push(track)};
  const track=()=>({stopped:false,stop(){this.stopped=true;},clone(){return track();}});
  const originals=[track(),track()];
  assert.equal(h.addXorromRecordingAudio(output),false);
  h.window.mayXorrom={getStream:()=>({getAudioTracks:()=>[]})};assert.equal(h.addXorromRecordingAudio(output),false);
  h.window.mayXorrom.getStream=()=>({getAudioTracks:()=>originals});
  assert.equal(h.addXorromRecordingAudio(output),true);assert.equal(recorded.length,2);
  recorded.forEach(t=>t.stop());assert.ok(originals.every(t=>!t.stopped));
});

test('site share and compressed work files round-trip music settings without a running transport',async()=>{
  const input={autoGeometry:true,geometrySource:'areas',geometryConnectivity:'chess0',source:'rhythm',bpm:12.375,restartOnFrame:true,division:16,tonic:3,octave:2,scale:'minor',
    gain:.18,timbre:'robot',chord:2,first:1,last:6,stride:2,loop:false,live:true,backing:'counter',backingGain:.22,backingTimbre:'softsquare',backingRows:7,
    envelopeOn:true,attack:.025,decay:.2,sustain:.4,release:.35,filterType:'bandpass',cutoff:730,resonance:2.1,
    lfoTarget:'pan',lfoRate:3.25,lfoDepth:.6,delayTime:.18,delayFeedback:.4,delayMix:.25,reverbMix:.15,reverbTime:.8,
    pan:-.3,arpMode:'down',arpGate:.65,swing:.2};
  const settings=Music.normalizeSettings(input);
  for(const [key,value] of Object.entries(input))assert.deepEqual(settings[key],value,'preserve '+key);
  const {h}=host();
  Object.assign(h,{st:{mode:'pend',rows:8,steps:8,bg:'empty',view:'bits',zOverview:true,zLimit:false,zoom:.125,xorrom:settings},k:1,
    f:{val:new Int8Array(8*15)},img:{width:15,height:8},structuredClone,rowBuild:null,testPattern:null,
    wrap:{scrollLeft:0,scrollTop:0},autoPaintIds:[],fillMode:false,autoVertical:0,axisPicking:false,axisLineMode:false,
    rulerMode:false,mirrorLine:false,templatePickEnabled:false,templatePickMode:'one',templateDragEnabled:false,
    $:()=>({value:'#ff8800',checked:false}),paintRepeatSeed:null,captureSharePaint:()=>null,
    MayatnikPaintRepeat:require('./mayatnik-paint-repeat.js'),MayatnikShareLink:Share,MayatnikXorrom:Music,
    MayatnikEdgeFlow:require('./mayatnik-edge-flow.js'),MayatnikConstruction:require('./mayatnik-construction.js'),
    animatrixOn:()=>false,edgeFlowOn:()=>false,rememberTemplate(){},manualPaintSnapshot:()=>null,colReplaySnapshot:()=>[],
    templateLibrary:[],removedTemplateIds:new Set(),mirrorLive:false,mirrorXor:false,templatePaintLayer:null,
    fillMask:null,paintBits:null,faceLayer:null,templateMatchLayer:null,colourTemplate:null,templatePickedIds:new Set(),
    templateItems:[],templateOffsetX:0,templateReturn:null,templatePaintBit:null,templateVisible:false});
  vm.runInContext([source('function captureSharePayload','async function buildShareUrl'),
    source('function validateShareState','function applyShareControls'),source('function paintSnapshot','function savePaint')].join('\n'),h);
  const encoded=await Share.encode(h.captureSharePayload());
  assert.ok(encoded.startsWith('1.'));
  const {state}=await Share.decode(encoded);
  assert.deepEqual(h.validateShareState(state).xorrom,settings);assert.equal(h.validateShareState(state).zOverview,true);assert.equal(h.validateShareState({...state,zLimit:true}).zOverview,false);assert.throws(()=>h.validateShareState({...state,zOverview:'true'}),/режим обзора/);
  assert.deepEqual(h.validateShareState({...state,xorrom:undefined}).xorrom,Music.normalizeSettings());
  assert.throws(()=>h.validateShareState({...state,xorrom:[]}),/настройки музыки/);
  const file=await Work.encode(h.paintSnapshot());
  assert.deepEqual([...new Uint8Array(await file.slice(0,2).arrayBuffer())],[31,139]);
  const restored=await Work.decode(file);
  assert.deepEqual(restored.data.st.xorrom,settings);assert.equal(restored.data.st.zOverview,true);assert.equal(restored.data.st.zoom,.125);assert.deepEqual(restored.data.field,h.f.val);
});


function assembled(f,angle=0){
 const R=require('./mayatnik-rombo.js'),Grid=require('./mayatnik-pixel-grid.js'),h=f.h;h.st.edgeRhombOn=true;h.st.romboAssembly=16;h.MayatnikXorromProjection=require('./mayatnik-xorrom-projection.js');h.MayatnikXorromGeometry=require('./mayatnik-xorrom-geometry.js');let plan;
 const change=value=>{h.st.romboAngle=value;plan=R.plan(3,2,{assembly:16,angle:value},{sides:true});};change(angle);h.window.mayRombo={plan:()=>plan,get:()=>({available:true})};h.window.mayPixelExact={policyFor:()=>Grid.policy({width:plan.outputWidth,height:plan.outputHeight,angle:h.st.romboAngle,dpr:1.25})};return {change,plan:()=>plan};
}
test('production source captures assembled Rombo rows independently of viewport zoom and releases the native field',async()=>{
 for(const angle of [0,45,90,135,180,225,270,315]){
  const f=host(),a=assembled(f,angle),h=f.h,policy=h.window.mayPixelExact.policyFor(),ratio=policy.minScale*policy.dpr;
  const expected=await h.MayatnikXorromProjection.capture(a.plan(),{width:3,height:2,readBit:(x,y)=>f.grid[y][x],readRed:()=>false},{ratio});
  const score=await h.captureXorromField();assert.deepEqual(score.rows,expected.rows);assert.equal(score.projection.kind,'rombo');assert.equal(score.frame,9);h.st.zoom=500;const again=await h.captureXorromField();assert.deepEqual(again.rows,score.rows);assert.equal(f.calls.release,2);
 }
});
test('assembled RGB retains native colour categories and filters after rotation and whole-view half turn',async()=>{
 const f=host(),a=assembled(f,45),h=f.h;h.st.view='rgbNeighbours';h.st.viewUpsideDown=true;h.rgbNeighbourClasses=Uint8Array.of(1,2,255,3,4,5);h.rgbNeighbourFilters=()=>[1,3,5];const ratio=h.window.mayPixelExact.policyFor().minScale*1.25;
 const expected=await h.MayatnikXorromProjection.capture(a.plan(),{width:3,height:2,readBit:(x,y)=>f.grid[y][x],readRed:()=>false,readRGB:(x,y)=>[1,3,5].includes(h.rgbNeighbourClasses[y*3+x])?h.rgbNeighbourClasses[y*3+x]:-1},{ratio,flip:true,cellRGB:true});const score=await h.captureXorromField();assert.deepEqual(score.rows,expected.rows);assert.equal(score.projection.flip,true);
});
test('assembled auto geometry uses the actual projected areas; changing the plan cancels an old capture',async()=>{
 const f=host(),a=assembled(f),h=f.h;h.st.xorrom={autoGeometry:true,geometryConnectivity:'sides'};const score=await h.captureXorromField();assert.equal(score.geometry.connectivity,'sides');assert.ok(score.rows.some(row=>row.geometry.one));
 const read=f.semantic.readBit;let changed=false;f.semantic.readBit=(x,y)=>{if(!changed){changed=true;a.change(45);}return read(x,y);};await assert.rejects(h.captureXorromField(),{name:'AbortError'});assert.equal(f.calls.release,2);
});


test('automatic Rombo capture uses the coherent native-size hint even when projection expands beyond one million cells',async()=>{
 const f=host(),h=f.h,R=require('./mayatnik-rombo.js'),G=require('./mayatnik-pixel-grid.js');h.VW=1199;h.VH=600;h.st.edgeRhombOn=true;h.st.romboAssembly=16;h.st.romboAngle=45;const plan=R.plan(1199,600,{assembly:16,angle:45},{sides:true});h.window.mayRombo={plan:()=>plan,get:()=>({available:true})};h.window.mayPixelExact={policyFor:()=>G.policy({width:plan.outputWidth,height:plan.outputHeight,angle:45})};h.window.mayVisibleSemantic.acquire=async()=>({width:1199,height:600,current:()=>true,readBit:()=>1,release(){}});let options;h.MayatnikXorromProjection={async capture(_p,_s,o){options=o;return {rows:[]};}};await h.captureXorromField({automatic:true});assert.equal(typeof options.yieldTask,'function');assert.ok(Math.ceil(plan.outputWidth*Math.SQRT2)**2>1048576);
});


test('opening a music link stops the existing transport before replacing state and never starts it implicitly',()=>{
 const apply=source('async function applySharePayload','async function applyShareLink');
 assert.ok(apply.indexOf('window.mayXorrom?.stopAll()')>=0);assert.ok(apply.indexOf('window.mayXorrom?.stopAll()')<apply.indexOf('Object.assign(st,next)'));
 assert.doesNotMatch(apply,/mayXorrom\??\.start\(/);
});
