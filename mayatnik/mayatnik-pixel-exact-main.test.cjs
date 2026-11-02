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
  MayatnikPixelExactHost:require('./mayatnik-pixel-exact-host.js'),MayatnikRombo:require('./mayatnik-rombo.js'),MayatnikViewRotation:require('./mayatnik-view-rotation.js'),
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
