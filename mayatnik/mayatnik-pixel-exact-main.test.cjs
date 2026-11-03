const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const html=fs.readFileSync(require.resolve('./Zerkalius-mayatnik.html'),'utf8'),lines=html.split('\n');
function fn(name){const start=html.indexOf('  function '+name+'(');assert.ok(start>=0,name);let end=html.indexOf('{',start)+1,depth=1;for(;depth;end++){if(html[end]==='{')depth++;if(html[end]==='}')depth--;}return html.slice(start,end);}
function fixture(dpr=1){
 const dom=new JSDOM('<div id="wrap"><canvas id="cv"></canvas></div><input id="frame"><button id="zLimit"></button>',{pretendToBeVisual:true}),win=dom.window,doc=win.document;win.devicePixelRatio=dpr;
 const wrap=doc.getElementById('wrap'),cv=doc.getElementById('cv');for(const [key,value]of Object.entries({clientWidth:800,clientHeight:600,scrollWidth:20000,scrollHeight:20000}))Object.defineProperty(wrap,key,{value,writable:true});
 const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});wrap.style.padding='16px';wrap.getBoundingClientRect=()=>rect(0,0,wrap.clientWidth,wrap.clientHeight);
 cv.style.width='31px';cv.style.height='8px';cv.getBoundingClientRect=()=>{const t=cv.style.translate.split(' ');return rect(17.3+(parseFloat(t[0])||0),18.7+(parseFloat(t[1])||0),parseFloat(cv.style.width),parseFloat(cv.style.height));};
 const c={window:win,document:doc,wrap,cv,st:{zoom:1,zsnap:true,zbase:2,zLimit:false,zLock:false,edgeRhombOn:false,romboAssembly:16,romboAngle:0,edgeWrap:true},geo:{anchor:15},f:{W:31,H:8},VX:0,VW:31,VH:8,gpuBig:null,
  MayatnikPixelGrid:require('./mayatnik-pixel-grid.js'),MayatnikPixelExactHost:require('./mayatnik-pixel-exact-host.js'),MayatnikRombo:require('./mayatnik-rombo.js'),MayatnikViewRotation:require('./mayatnik-view-rotation.js'),
  dispW:()=>c.VW,dispH:()=>c.VH,compareOn:()=>false,animatrixOn:()=>false,rombP:()=>-1,joinedOn:()=>false,bothOn:()=>false,ovlLinked:()=>false,fitAxis:()=>false,wrapPadX:()=>32,panCenterX:()=>wrap.clientWidth/2,
  freePanScale:0,freePanInset:0,zWant:0,VTX_H:16,save(){},present(){},imageStats(){},queueDigits(){},thick(){},fitHold(){},fitCenterY(){},midScroll(){},zBotScroll(){},zTopScroll(){},zTopLine(){},drawEdgeRhomb(){},getComputedStyle:win.getComputedStyle.bind(win),requestAnimationFrame:()=>1,
  viewRotation:{enabled:false,physicalRect:()=>cv.getBoundingClientRect(),isFieldEvent:()=>true},$:id=>{let n=doc.getElementById(id);if(!n){n=doc.createElement('span');n.id=id;doc.body.append(n);}return n;}};
 vm.createContext(c);const pixel=html.slice(html.indexOf('  function pixelGeometry('),html.indexOf('  // v0.201: «масштаб кратный 2, 3, 4, 5'));
 const decl=['DPR','zB','snap2','fitScale','fitHRow','fitHScale','MAX_ZOOM','baseMinScale','minScale','scale'].map(name=>lines.find(l=>l.trimStart().startsWith('const '+name+' =')));
 vm.runInContext(decl[0]+'\n'+pixel+'\n'+decl.slice(1).join('\n')+'\n'+[fn('horizontalAxisPinned'),fn('cssLayout'),fn('zoomTo')].join('\n')+'\nthis.currentScale=scale;',c);c.layout=c.cssLayout;
 return {c,close:()=>dom.window.close()};
}
test('production zoom, fit, limits and restored fractions always resolve to a legal physical lattice',()=>{
 for(const dpr of [1,1.25,2]){const {c,close}=fixture(dpr);
  for(const angle of [0,45,90,135,180,225,270,315]){c.st.edgeRhombOn=true;c.st.romboAngle=angle;
   for(const wanted of [.01,.875887,1,3.9,512,1e7]){c.zoomTo(wanted,100,100,true);const policy=c.window.mayPixelExact.policyFor();assert.ok(require('./mayatnik-pixel-grid.js').raster(c.currentScale(),policy));assert.equal(c.$('frame').dataset.zoomExact,c.window.mayPixelExact.format(c.currentScale()));}
  }close();
 }
});
test('production 1:1 button cannot enable an incompatible rotated grid or mutate the angle',()=>{
 const {c,close}=fixture(1.25);vm.runInContext(lines.find(l=>l.includes("$('zLimit').onclick =")),c);c.st.edgeRhombOn=true;c.st.romboAngle=45;c.$('zLimit').onclick();assert.equal(c.st.zLimit,false);assert.equal(c.st.romboAngle,45);
 c.st.romboAngle=0;c.$('zLimit').onclick();assert.equal(c.st.zLimit,true);assert.equal(c.currentScale()*1.25,1);assert.equal(c.window.mayPixelExact.canState({romboAngle:45}),false);c.$('zLimit').onclick();assert.equal(c.st.zLimit,false);close();
});
test('production wheel accumulates sub-step deltas even with power snapping disabled',()=>{
 const {c,close}=fixture();c.st.zsnap=false;c.st.zoom=1;c.cssLayout();const start=html.indexOf("  wrap.addEventListener('wheel', e => {"),end=html.indexOf('  }, { passive: false });',start)+'  }, { passive: false });'.length;vm.runInContext(html.slice(start,end),c);
 for(let i=0;i<12;i++)c.wrap.dispatchEvent(new c.window.WheelEvent('wheel',{deltaY:-30,clientX:100,clientY:100,bubbles:true,cancelable:true}));assert.ok(c.currentScale()>1);assert.equal(c.currentScale(),Math.round(c.currentScale()));close();
});
test('unsupported clipping is explicit and never silently selects another angle or lossy scale',()=>{
 const {c,close}=fixture();c.st.edgeRhombOn=true;c.st.romboMode='custom';const old={...c.st};assert.equal(c.window.mayPixelExact.canState({}),false);c.cssLayout();assert.ok(c.document.body.classList.contains('may-pixel-invalid'));assert.match(c.$('mayPixelExactError').textContent,/Готовые/);assert.deepEqual(c.st,old);close();
});


test('production Rombo decreases by minus and by wheel from large scales down to its overview minimum',()=>{
 for(const dpr of [1,1.25,2])for(const zsnap of [false,true])for(const angle of [0,45,90,135,180,225,270,315]){
  const {c,close}=fixture(dpr);c.VW=1534;c.VH=512;c.f.W=1534;c.f.H=512;c.st.edgeRhombOn=true;c.st.romboAngle=angle;c.st.zsnap=zsnap;
  vm.runInContext(lines.find(l=>l.includes('const zoomStep ='))+"\nthis.stepZoom=zoomStep;",c);
  c.zoomTo(512,100,100,true);const high=c.currentScale();c.stepZoom(-1);assert.ok(c.currentScale()<high);
  for(let i=0;i<60;i++)c.stepZoom(-1);const p=c.window.mayPixelExact.policyFor();assert.ok(Math.abs(c.currentScale()-p.minScale)<1e-9);
  c.zoomTo(512,100,100,true);const start=html.indexOf("  wrap.addEventListener('wheel', e => {"),end=html.indexOf('  }, { passive: false });',start)+'  }, { passive: false });'.length;vm.runInContext(html.slice(start,end),c);
  for(let i=0;i<60;i++)c.wrap.dispatchEvent(new c.window.WheelEvent('wheel',{deltaY:120,clientX:100,clientY:100,bubbles:true,cancelable:true}));
  assert.ok(Math.abs(c.currentScale()-p.minScale)<1e-9);close();
 }
});


test('unlocked plain and Rombo views always shrink even with a saved overview:false',()=>{
 for(const dpr of [1,1.25,2])for(const rombo of [false,true])for(const angle of [0,45,90,135,180,225,270,315]){
  const {c,close}=fixture(dpr);
  try{
   c.VW=c.f.W=2047;c.VH=c.f.H=512;c.st.edgeRhombOn=rombo;c.st.romboAngle=angle;c.st.zsnap=false;c.st.zOverview=false;
   c.zoomTo(.125/dpr,100,100,true);assert.ok(c.currentScale()<1/dpr);assert.equal(c.$('frame').dataset.zoomOverview,'true');assert.equal(c.$('frame').dataset.zoomLossy,'true');
  }finally{close();}
 }
});

test('physical 1:1 persists through zoom requests; release restores minification and preserves Block',()=>{
 for(const dpr of [1,1.25,2])for(const rombo of [false,true]){
  const {c,close}=fixture(dpr);
  try{
   c.st.edgeRhombOn=rombo;c.st.zsnap=false;c.st.zOverview=false;
   vm.runInContext(lines.find(l=>l.includes("$('zLimit').onclick =")),c);
   vm.runInContext(lines.find(l=>l.includes('const zoomStep ='))+"\nthis.stepZoom=zoomStep;",c);
   c.$('zLimit').onclick();assert.equal(c.st.zLimit,true);
   for(const wanted of [.01,512]){c.zoomTo(wanted,100,100,true);assert.equal(c.currentScale()*dpr,1);assert.equal(c.$('frame').dataset.zoomOverview,'false');}
   c.st.zLock=true;c.$('zLimit').onclick();assert.equal(c.st.zLimit,false);assert.equal(c.st.zLock,true);
   c.stepZoom(-1);assert.equal(c.currentScale()*dpr,1);assert.equal(c.$('frame').dataset.zoomOverview,'true');
   c.st.zLock=false;c.stepZoom(-1);assert.ok(c.currentScale()*dpr<1);
  }finally{close();}
 }
});

test('saved fit bindings survive minification and viewport resize without an overview switch',()=>{
 for(const mode of ['fit','fitH'])for(const rombo of [false,true]){
  const {c,close}=fixture();
  try{
   c.VW=c.f.W=2047;c.VH=c.f.H=2048;c.st.edgeRhombOn=rombo;c.st.zsnap=false;c.st.zOverview=false;c.st.zoom=mode;
   c.cssLayout();const before=c.currentScale();assert.ok(before<1);c.wrap.clientWidth=400;c.wrap.clientHeight=300;c.cssLayout();
   assert.equal(c.st.zoom,mode);assert.ok(c.currentScale()<before);assert.equal(c.$('frame').dataset.zoomOverview,'true');
  }finally{close();}
 }
});

test('overview has no DOM button, menu descriptor or public toggle API',()=>{
 const dom=new JSDOM(html);
 try{assert.equal(dom.window.document.getElementById('zOverview'),null);}finally{dom.window.close();}
 const menu=fs.readFileSync(require.resolve('./mayatnik-menu.js'),'utf8');
 assert.doesNotMatch(menu,/zOverview|mayOverview/);assert.doesNotMatch(html,/window\.mayOverview/);
});

test('overview present preserves the native source instead of allocating a whole minified intermediate',()=>{
 for(const [width,height,zoom]of [[3,2,2/3],[8191,4096,.9]]){
  const {c,close}=fixture();c.VW=width;c.VH=height;c.f.W=width;c.f.H=height;c.st.zoom=zoom;c.st.zsnap=false;c.st.zOverview=true;c.RK=1;c.img={};
  const pic={width,height,data:new Uint8ClampedArray(4)},puts=[];Object.assign(c,{g:{putImageData:(...args)=>puts.push(args)},layerCpuService:null,gpuDisplay:()=>false,pxView:()=>pic,
   snakePathRefresh(){},layerOriginalDigits(){},layerOriginalBase(){},align(){},anchorDash(){},vtxLabelsDraw(){},notifyXorromField(){}});c.window.mayLayers={};c.cssLayout();vm.runInContext(fn('present'),c);c.present(true);
  assert.equal(c.cv.width,width);assert.equal(c.cv.height,height);assert.equal(puts[0][0],pic);assert.equal(c.present.clean.pic,pic);assert.equal(parseFloat(c.cv.style.width),width*c.currentScale());close();
 }
});

test('overview layer copies physical pixel centres directly and never rescales an intermediate bitmap',()=>{
 const image={width:3,height:2,data:Uint8ClampedArray.from({length:24},(_,i)=>i)},owner={},cv={getBoundingClientRect:()=>({left:0,top:0,width:2,height:4/3})};let shown;
 const G={setTransform(){},putImageData(value){shown=value;},drawImage(){throw Error('intermediate rescale forbidden');}},canvas={getContext:()=>G};
 const c={window:{mayLayers:{},mayPixelExact:{policyFor:()=>({overview:true})}},DPR:()=>1,RK:1,cv,img:owner,present:{romboNative:{owner,pic:image}},layerBase:null,layerViewport:()=>({left:0,top:0,width:2,height:1}),
  scale:()=>2/3,layerCanvas:(old,width,height)=>Object.assign(canvas,{width,height}),layerOriginalCompose(){},MayatnikPixelExactHost:require('./mayatnik-pixel-exact-host.js'),ImageData:class{constructor(data,width,height){Object.assign(this,{data,width,height});}}};
 vm.runInNewContext(fn('layerOriginalBase'),c);c.layerOriginalBase(cv);assert.deepEqual(Array.from(shown.data),[...image.data.subarray(0,4),...image.data.subarray(8,12)]);
});


test('overview overlay bits reuse physical nearest pixels without large canvases or colour averaging',()=>{
 const pic={width:3,height:2,data:Uint8ClampedArray.from([255,255,255,255,100,100,100,255,255,255,255,255,100,100,100,255,255,255,255,255,100,100,100,255])};
 const c={VW:3,VH:2,VX:0,RK:1,f:{W:3},geo:{anchor:1},st:{zOverview:true},k:1,ovlSerial:0,scale:()=>2/3,DPR:()=>1,present:{clean:{pic}},cv:{getBoundingClientRect:()=>({left:0,top:0})},layerViewport:()=>({left:0,top:0}),
  PAL:{bits:[[[100,100,100]],[[255,255,255]]]},rgba:rgb=>((255<<24)|(rgb[2]<<16)|(rgb[1]<<8)|rgb[0])>>>0,parityVisible:()=>true,outShow:()=>false,ochkiMeetingPoints:()=>[],document:{createElement(){throw Error('full-frame allocation forbidden');}}};
 vm.runInNewContext(fn('ovlBitsNow'),c);const result=c.ovlBitsNow();assert.ok(result);assert.deepEqual(Array.from(result.val),[1,1,1,-1,-1,-1]);assert.equal(c.ovlSerial,1);
});


test('production accuracy follows physical exact lattice across overview, DPR and diagonal turns',()=>{
 for(const dpr of [1,1.25,2]){
  const {c,close}=fixture(dpr);
  try{
   c.st.zOverview=true;c.st.zsnap=false;c.f.W=c.VW=3068;c.f.H=c.VH=512;
   for(const angle of [0,45,90,135,180,225,270,315]){
    c.st.edgeRhombOn=true;c.st.romboAngle=angle;
    const policy=c.window.mayPixelExact.policyFor();
    c.zoomTo(policy.exactMinScale*.85,100,100,true);
    assert.equal(c.$('frame').dataset.zoomLossy,'true');assert.equal(c.$('frame').dataset.zoomOverview,'true');
    c.zoomTo(policy.exactMinScale,100,100,true);
    assert.equal(c.$('frame').dataset.zoomLossy,'false');
    c.st.zOverview=false;c.zoomTo(policy.exactMinScale*.5,100,100,true);
    assert.equal(c.$('frame').dataset.zoomLossy,'true');assert.equal(c.$('frame').dataset.zoomOverview,'true');c.st.zOverview=true;
   }
   c.st.edgeRhombOn=false;c.zoomTo((2615/3068)/dpr,100,100,true);
   assert.equal(c.$('frame').dataset.zoomExact,'2615/3068');assert.equal(c.$('frame').dataset.zoomLossy,'true');
  }finally{close();}
 }
});
