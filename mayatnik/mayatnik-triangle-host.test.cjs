const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const Geo=require('./mayatnik-triangle-assembly.js');
const Share=require('./mayatnik-share-link.js');
const Work=require('./mayatnik-work-file.js');
const html=fs.readFileSync(require.resolve('./Zerkalius-mayatnik.html'),'utf8');
const between=(a,b)=>{
  const from=html.indexOf('  '+a), to=html.indexOf('  '+b,from+1);
  assert.ok(from>=0 && to>from,'host source '+a);
  return html.slice(from,to);
};
const source=[
  between('function axesColourGuides()', 'function axesColourStatus('),
  between('function zlFamilies()', 'function zlColour('),
  between('function manualPaintAxes()', 'function manualPaintOn()'),
  between('function triangleAssemblyScope()', 'window.mayRombo='),
  between('function captureSharePayload()', 'async function buildShareUrl('),
  between('function validateShareState(', 'function applyShareControls('),
  between('function paintSnapshot()', 'function savePaint()'),
  between('function validateFrameWork(', 'function frameCanvasData(')
].join('\n');
const plain=value=>JSON.parse(JSON.stringify(value));
const segment=(a,b)=>({a,b});
function makeHost(){
  const classes=new Set(),hist=[];
  const h={
    VX:17,VW:16,VH:8,k:3,f:{W:51,H:8,val:new Int8Array(408)},geo:{anchor:23},img:{width:16,height:8},cv:{width:160},
    st:{mode:'pend',rows:8,steps:16,bg:'empty',anchorAxis:false,view:'bits',fixLines:false,fixCross:false},
    gpuBig:null,cacheRestoring:false,frameLibraryBusy:false,templateDragging:null,playing:false,
    templateCanvas:{hidden:false},mirrorLine:false,mirrorLineY:0,mirror:{on:false},
    window:{},document:{body:{classList:{contains:name=>classes.has(name)}}},classes,hist,
    picOn:()=>true,dispW:()=>h.VW,dispH:()=>h.VH,rombP:()=>-1,joinedOn:()=>false,
    scale:()=>10,mirState:()=>h.mirror,zlList:()=>h.st.zl||[],parityValues:()=>h.f.val,
    fieldSourceKey:()=>'ordinary',templatePickedIds:new Set(),templateItems:[],templateAxisState:()=>null,
    colourTemplate:null,RK:1,
    MayatnikNAxes:require('./mayatnik-n-axes.js'),MayatnikSymmetry:require('./mayatnik-symmetry.js'),
    MayatnikAutoAxisGeometry:require('./mayatnik-auto-axis-geometry.js'),MayatnikManualLines:require('./mayatnik-manual-lines.js'),
    MayatnikTriangleAssembly:Geo,MayatnikFaceTransform:require('./mayatnik-face-transform.js'),
    MayatnikConstruction:require('./mayatnik-construction.js'),
    MayatnikShareLink:Share,MayatnikEdgeFlow:require('./mayatnik-edge-flow.js'),MayatnikXorrom:require('./mayatnik-xorrom.js'),
    fixLinesDraw(){},symGet:()=>({segs:[]}),autoAxesGet:()=>({segments:[]}),triangleMapGet:()=>({axes:[]}),
    save(){},edgeSync(){},draw(){},queueSession(){},pushHistory:entry=>hist.push(entry),
    templatePaintValidate(){},assertWorkEvolution(){},fieldFrames:()=>16,fieldGeometry:()=>({W:h.f.W}),
    animatrixOn:()=>false,gpuApi:null,Int8Array,Uint8Array,Uint32Array,structuredClone
  };
  vm.runInNewContext(source,h);
  h.snapshot=()=>plain(h.triangleAssemblySnapshot());
  return h;
}

test('flat crop converts both symmetry lattices, both map lattices, and viewport-local auto axes',()=>{
  const h=makeHost();
  Object.assign(h.st,{sym:true,triangleMapAxes:true,autoAxes:true});
  h.symGet=()=>({segs:[
    {dir:'h',p:0,axis:2,t0:17,t1:22},{dir:'v',p:1,axis:24,t0:1,t1:6},
    {dir:'v',p:0,axis:16.5,t0:0,t1:7}
  ]});
  h.triangleMapGet=()=>({axes:[{p:1,a:[19,2],b:[25,6]},{p:0,a:[18,.25],b:[19,.5]}]});
  h.autoAxesGet=()=>({segments:[{x:3.5,y0:.25,y1:7.25}]});
  const out=h.snapshot();
  assert.ok(out.available);assert.equal(out.width,16);assert.equal(out.height,8);
  const rounded=out.segments.map(s=>[...s.a,...s.b].map(n=>+n.toFixed(3)));
  assert.deepEqual(rounded,[[.1,2.5,5.9,2.5],[7.5,1.1,7.5,6.9],[2,2,8,6],[1,.25,2,.5],[3.5,.25,3.5,7.25]]);
  h.st.symTriangles=true;assert.equal(h.snapshot().segments.length,3);
  h.st.symTriangles=false;h.playing=true;assert.equal(h.snapshot().segments.length,3);
});

test('capture fixed guides afresh, clip to actual field; the hidden-measure anchor respects occupied gaps',()=>{
  const h=makeHost();h.st.anchorAxis=true;h.st.lineMeasures=false;
  for(const row of [0,1,4,7]) h.f.val[row*h.f.W+h.geo.anchor]=-1;
  let reads=0;
  h.fixLinesDraw=(g,x,y,scale,unit,mode,mirror,capture)=>{
    assert.deepEqual([x,y,scale,unit,mode,mirror,capture],[0,0,1,1,0,false,true]);
    reads++;g.beginPath();g.moveTo(-10,h.k+.5);g.lineTo(25,h.k+.5);g.stroke();
  };
  const first=h.snapshot().segments;
  assert.deepEqual(first,[segment([0,3.5],[16,3.5]),segment([6.5,0],[6.5,2]),segment([6.5,4],[6.5,5]),segment([6.5,7],[6.5,8])]);
  h.k=5;h.st.lineMeasures=true;
  assert.deepEqual(h.snapshot().segments,[segment([0,5.5],[16,5.5]),segment([6.5,0],[6.5,8])]);
  assert.equal(reads,2);
});

test('manual families obey Zen and individual visibility; template-layer axes disappear with that canvas',()=>{
  const h=makeHost();
  Object.assign(h.st,{linesOn:true,lineFamilies:{h:true,v:true,d:false},ztopRow:3.25,ztlMain:false,
    zl:[{k:'v',axisNo:1,p:-1},{k:'d',axisNo:2,p:1},{k:'e',axisNo:3,p:3}],
    nAxisSets:[{id:'set',row:4,n:1,left:-2,center:0,right:1},{id:'below',row:8,n:1,left:2,center:3,right:4}],
    userLines:[[.25,.75,4.25,4.75]]});
  h.mirrorLine=true;h.mirrorLineY=2.5;
  const out=h.snapshot().segments;
  assert.deepEqual(out,[segment([5.5,0],[5.5,8]),segment([4.5,0],[4.5,8]),segment([6.5,0],[6.5,8]),
    segment([7.5,0],[7.5,8]),segment([.25,.75],[4.25,4.75]),segment([0,2.5],[16,2.5])]);
  h.classes.add('may-zen');assert.deepEqual(h.snapshot().segments,out.slice(1));
  h.templateCanvas.hidden=true;assert.deepEqual(h.snapshot().segments,[]);
  h.st.ztlZen=true;h.st.ztlMain=true;
  assert.deepEqual(h.snapshot().segments,[segment([0,3.5],[16,3.5]),out[0]]);
});

test('finite mirror handle uses radians and actual draw length',()=>{
  const h=makeHost();h.mirror={on:true,ax:.25,ang:-Math.PI/2,len:.25};
  const [s]=h.snapshot().segments;
  assert.deepEqual(s.a,[4,8]);assert.ok(Math.abs(s.b[0]-4)<1e-8);assert.equal(s.b[1],4);
});
test('pending and failed active searches are explicit before any result can replace the layout',()=>{
  for(const [flag,get] of [['sym','symGet'],['autoAxes','autoAxesGet'],['triangleMapAxes','triangleMapGet']]){
    const h=makeHost();h.st[flag]=true;h[get]=()=>null;
    assert.equal(h.snapshot().available,false);assert.match(h.snapshot().reason,/Дождитесь/);
    h[get]=()=>({error:'ошибка расчёта'});assert.equal(h.snapshot().reason,'ошибка расчёта');
    h.st[flag]=false;assert.ok(h.snapshot().available);
  }
  const h=makeHost();h.classes.add('may-fold-active');assert.equal(h.snapshot().available,false);
  h.classes.clear();h.rombP=()=>0;assert.equal(h.snapshot().available,false);
  h.rombP=()=>-1;h.gpuBig={};assert.equal(h.snapshot().available,false);
});
test('scope tracks crop and source geometry while frame, paint and zoom may change',()=>{
  const h=makeHost(),s=h.snapshot();
  h.k++;h.st.zoom=4;h.st.bitOneColour='#ffffff';h.scale=()=>4;
  assert.equal(h.snapshot().scope,s.scope);assert.equal(h.snapshot().sourceFrame,s.sourceFrame+1);
  for(const prop of ['VX','VW','VH']) {h[prop]++;assert.notEqual(h.snapshot().scope,s.scope);h[prop]--;}
  h.f.W++;assert.notEqual(h.snapshot().scope,s.scope);h.f.W--;
  h.geo.anchor++;assert.notEqual(h.snapshot().scope,s.scope);h.geo.anchor--;
  h.st.edgeWrap=true;assert.notEqual(h.snapshot().scope,s.scope);h.st.edgeWrap=false;
  h.st.edgeBounce=true;assert.notEqual(h.snapshot().scope,s.scope);h.st.edgeBounce=false;
  h.fieldSourceKey=()=>'another-source';assert.notEqual(h.snapshot().scope,s.scope);
});
test('commit, undo/redo, share-code decode and compressed work-file validation preserve source and transforms',async()=>{
  const h=makeHost();h.st.romboAssembly=12;h.st.romboSeam='dedupe';
  h.st.userLines=[[0,0,16,8]];const shot=h.snapshot(),parts=Geo.find(shot);
  assert.equal(parts.length,2);
  const input={...shot,pieces:parts.map(p=>({...p,pose:{x:-2.5,y:1.25,turn:3,flip:true}}))};
  h.triangleAssemblyCommit(input);const expected=plain(h.triangleAssemblyState());
  assert.equal(expected.mode,'custom');assert.ok(expected.on);assert.equal(h.hist.length,1);
  const undo=h.hist[0].external;undo.apply(undo.before);
  assert.deepEqual(plain(h.triangleAssemblyState()),{mode:'fixed',on:false,layout:null});
  assert.equal(h.st.romboAssembly,12);undo.apply(undo.after);
  assert.deepEqual(plain(h.triangleAssemblyState()),expected);
  Object.assign(h,{rowBuild:null,testPattern:null,edgeFlowOn:()=>false,wrap:{scrollTop:0,scrollLeft:0},
    fillMode:false,autoVertical:0,axisPicking:false,axisLineMode:false,rulerMode:false,templatePickEnabled:false,
    templatePickMode:'one',templateDragEnabled:false,autoPaintIds:[],MayatnikPaintRepeat:require('./mayatnik-paint-repeat.js'),
    paintRepeatSeed:null,captureSharePaint:()=>null,$:()=>({value:'#ffc577',checked:false}),rememberTemplate(){},
    templatePaintLayer:null,manualPaintSnapshot:()=>null,colReplaySnapshot:()=>null,templateLibrary:[],removedTemplateIds:new Set(),
    mirrorLive:false,mirrorXor:false,fillMask:null,paintBits:null,faceLayer:null,templateMatchLayer:null,templateOffsetX:0,
    templateReturn:null,templatePaintBit:null,templateVisible:false});
  const share=await Share.decode(await Share.encode(h.captureSharePayload()));
  assert.equal(h.validateShareState(share.state).romboSeam,'dedupe');
  assert.throws(()=>h.validateShareState({...share.state,romboSeam:'half'}),/шов/);
  assert.deepEqual(plain(h.validateShareState(share.state).romboLayout),expected.layout);
  assert.throws(()=>h.validateShareState({...share.state,romboLayout:{pieces:[null]}}),/сборка/);
  const file=await Work.encode(h.paintSnapshot());
  const restored=h.frameWorkOnly(h.validateFrameWork(await Work.decode(file)));
  assert.equal(restored.st.romboSeam,'dedupe');
  assert.deepEqual(restored.st.romboLayout,expected.layout);assert.deepEqual(restored.field,h.f.val);
  const previous=plain(h.triangleAssemblyState());
  assert.throws(()=>h.triangleAssemblyCommit({pieces:[]}),/Некорректная сборка/);
  assert.deepEqual(plain(h.triangleAssemblyState()),previous);assert.equal(h.hist.length,1);
});
