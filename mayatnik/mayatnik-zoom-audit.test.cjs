const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8'),lines=html.split('\n');
function fn(name){const at=html.indexOf('  function '+name+'(');assert.ok(at>=0,name);let end=html.indexOf('{',at)+1,depth=1;for(;depth;end++){if(html[end]==='{')depth++;if(html[end]==='}')depth--;}return html.slice(at,end);}
function fixture(options={}){
 const buttons=new Map(),st={zoom:1,zsnap:true,zbase:2,zLimit:false,zLock:false,ztop:false,zBot:false,zMid:false,...options};
 const c={st,geo:{anchor:63},window:{devicePixelRatio:options.dpr||1},wrap:{clientWidth:800,clientHeight:800,scrollLeft:100,scrollTop:100,getBoundingClientRect:()=>({left:0,top:0,width:800,height:800})},cv:{style:{},getBoundingClientRect:()=>({left:0,top:0,width:127*c.scale(),height:128*c.scale(),bottom:128*c.scale()})},VTX_H:16,MAX_ZOOM:512,zWant:0,dispW:()=>127,dispH:()=>128,wrapPadX:()=>32,bothOn:()=>false,ovlLinked:()=>false,fitAxis:()=>false,save(){},layout(){},thick(){},zBotScroll(){},zTopScroll(){},zTopLine(){},present(){},imageStats(){},queueDigits(){},midScroll(){},fitHold(){},$:(id)=>{if(!buttons.has(id))buttons.set(id,{setAttribute(){}});return buttons.get(id);}};
 c.requestAnimationFrame=callback=>callback();c.wrap.classList={toggle(){}};c.wrap.style={setProperty(){}};c.document={body:{classList:{contains:()=>false}}};
 c.freePanScale=0;c.freePanInset=0;c.getComputedStyle=()=>({paddingLeft:'16px',paddingRight:'16px'});
 vm.createContext(c);
 const declarations=['DPR','zB','snap2','fitScale','fitHRow','fitHScale','baseMinScale','minScale','scale'].map(name=>lines.find(line=>line.trimStart().startsWith('const '+name+' ='))).join('\n');
 vm.runInContext(declarations+'\nthis.scale=scale;this.minimum=minScale;\n'+fn('panCenterX')+'\n'+fn('horizontalAxisPinned')+'\n'+fn('zoomTo'),c);
 return c;
}
test('actual zoomTo clamps after snapping for every base, DPR and field transport',()=>{
 for(const mode of [{},{edgeWrap:true},{edgeWrap:true,edgeBounce:true},{edgeWrap:true,edgeContinuous:true}])for(const zbase of [2,3,4,5,6,7,8,9,10])for(const dpr of [1,1.25,1.5,2])for(const zLimit of [false,true]){
  const c=fixture({...mode,zbase,dpr,zLimit});c.zoomTo(1e10);assert.ok(c.scale()<=512,JSON.stringify({mode,zbase,dpr,zLimit}));c.zoomTo(1e-10);assert.ok(c.scale()>=c.minimum());
 }
});
test('Down cannot change an explicitly locked numeric zoom',()=>{
 const c=fixture({zoom:1,zLock:true});vm.runInContext(html.split('\n').find(line=>line.includes("$('zFitH').onclick =")),c);c.$('zFitH').onclick();assert.equal(c.scale(),1);
});
test('layout cannot enlarge an explicitly locked zoom with Down active',()=>{
 const c=fixture({zoom:1,zLock:true,zBot:true});vm.runInContext(fn('cssLayout'),c);c.cssLayout();assert.equal(c.scale(),1);
});
test('restoring a snapped maximum never exceeds the interactive maximum',()=>{
 for(const zbase of [2,3,4,5,6,7,8,9,10])for(const dpr of [1,1.25,1.5,2]){
  const c=fixture({zoom:512,zbase,dpr});const startup=lines.find(line=>line.includes("if (st.zsnap && st.zoom !== 'fit' && st.zoom !== 'fitH')"))||lines.find(line=>line.trimStart().startsWith("if (st.zoom !== 'fit' && st.zoom !== 'fitH') st.zoom ="));assert.ok(startup);vm.runInContext(startup,c);assert.ok(c.scale()<=512,JSON.stringify({zbase,dpr,actual:c.scale()}));
 }
});
test('fit scale never exceeds available width across flat, paired diamonds and 180 degree dimensions',()=>{
 for(const [width,height]of [[127,128],[256,128],[256,256],[127,256]])for(const zbase of [2,3,5,10])for(const dpr of [1,1.25,1.5,2]){
  const c=fixture({zoom:'fit',zbase,dpr});c.dispW=()=>width;c.dispH=()=>height;assert.ok(c.scale()*width<=c.wrap.clientWidth-c.wrapPadX()+1e-8);
 }
});
test('free pinch retains the source point under the gesture at custom and maximum zoom',()=>{
 for(const wanted of [8,16,512]){
  const c=fixture({zoom:4,zsnap:false});c.cv.getBoundingClientRect=()=>({left:-c.wrap.scrollLeft,top:-c.wrap.scrollTop,width:127*c.scale(),height:128*c.scale(),bottom:128*c.scale()-c.wrap.scrollTop});
  const x=200,y=200,before=c.cv.getBoundingClientRect(),sourceX=(x-before.left)/c.scale(),sourceY=(y-before.top)/c.scale();c.zoomTo(wanted,x,y,true);const after=c.cv.getBoundingClientRect();assert.ok(Math.abs((x-after.left)/c.scale()-sourceX)<1e-9);assert.ok(Math.abs((y-after.top)/c.scale()-sourceY)<1e-9);
 }
});

function scrollFixture(){
 const c=fixture({zoom:1,zsnap:false}),w=c.wrap,cv=c.cv,padding=16;
 let scroll=0,free=false,extent=0,panel=null;
 const px=v=>parseFloat(v)||0;
 w.classList.toggle=(name,value)=>{if(name==='may-free-pan')free=value;};
 w.style.setProperty=(name,value)=>{if(name==='--may-pan-width')extent=px(value);};
 Object.defineProperty(w,'scrollWidth',{get(){
  const inner=w.clientWidth-2*padding,canvas=px(cv.style.marginLeft)+px(cv.style.width)+px(cv.style.marginRight);
  return Math.max(inner,canvas,free?inner+extent:0)+2*padding;
 }});
 Object.defineProperty(w,'scrollLeft',{get:()=>scroll,set:v=>{scroll=Math.max(0,Math.min(v,w.scrollWidth-w.clientWidth));}});
 w.getBoundingClientRect=()=>({left:35,top:10,width:w.clientWidth,height:w.clientHeight});
 cv.getBoundingClientRect=()=>({left:35+padding+px(cv.style.marginLeft)-scroll,top:10,width:px(cv.style.width),height:px(cv.style.height)});
 c.window.MayatnikTemplatePanel={isOpen:()=>panel!==null};
 const regular=c.$;c.$=id=>id==='mayatnikTemplatePanel'?{getBoundingClientRect:()=>({left:35+panel})}:regular(id);
 c.fitAxis=()=>true;c.displayAnchorX=()=>42;c.fitCenterY=()=>{};
 vm.runInContext([fn('midScroll'),fn('fitHold'),fn('cssLayout')].join('\n'),c);
 c.layout=c.cssLayout;c.cssLayout();
 return {c,w,cv,setPanel(width){panel=width;},center:()=>35+(panel??w.clientWidth)/2};
}

test('at each zoom either canvas boundary can reach the visible midpoint, including an open library',()=>{
 assert.match(html,/#wrap\.may-free-pan::after\{[^}]*width:calc\(100% \+ var\(--may-pan-width\)\)/);
 for(const zoom of [1/127,1,'fit','fitH',16,512])for(const visibleWidth of [null,440]){
  const {c,w,cv,setPanel,center}=scrollFixture();c.st.zoom=zoom;setPanel(visibleWidth);c.cssLayout();
  const width=cv.getBoundingClientRect().width;
  w.scrollLeft=0;c.cssLayout();c.fitHold();c.midScroll();
  assert.ok(Math.abs(cv.getBoundingClientRect().left-center())<1);
  w.scrollLeft=Infinity;c.cssLayout();c.fitHold();c.midScroll();
  assert.ok(Math.abs(cv.getBoundingClientRect().left+width-center())<1);
  assert.ok(Math.abs(w.scrollLeft-width)<1);
 }
});
test('free repositioning survives layout, resize, leaving the axis pin, and cursor zoom',()=>{
 const {c,w,cv,setPanel,center}=scrollFixture();
 const cellAt=x=>(x-cv.getBoundingClientRect().left)/c.scale();
 w.scrollLeft=31;setPanel(440);c.cssLayout();w.clientWidth=1100;c.cssLayout();
 assert.equal(cellAt(center()),31);
 c.st.zMid=true;c.cssLayout();const before=cellAt(center());c.st.zMid=false;c.cssLayout();
 // A pinned short field can place the library midpoint outside the field; the reachable
 // free centre in that case is the nearest edge.
 assert.ok(Math.abs(cellAt(center())-Math.max(0,Math.min(127,before)))<1);
 w.scrollLeft=52;const cursor=center()+14,cell=cellAt(cursor);c.zoomTo(8,cursor,50,true);
 assert.ok(Math.abs(cellAt(cursor)-cell)<1e-6);
});

test('physical 1:1 overrides fit, snap bases, pins and resizing until explicitly switched off',()=>{
 for(const dpr of [1,1.25,1.5,2,3])for(const zoom of [1/128,64,'fit','fitH'])for(const zLock of [false,true]){
  const c=fixture({zoom,zLimit:true,zLock,dpr,zbase:3,zBot:true});vm.runInContext(fn('cssLayout')+'\n'+fn('fit'),c);
  c.cssLayout();assert.equal(c.scale()*dpr,1);assert.equal(c.st.zoom,1/dpr);assert.equal(c.st.zLock,zLock);
  for(const wanted of [1e-8,512]){c.zoomTo(wanted,200,200,true);assert.equal(c.scale()*dpr,1);}
  c.fit();assert.equal(c.st.zoom,1/dpr);c.wrap.clientHeight=1200;c.cssLayout();assert.equal(c.scale()*dpr,1);
  vm.runInContext(lines.find(line=>line.includes("$('zFitH').onclick =")),c);c.$('zFitH').onclick();assert.equal(c.scale()*dpr,1);
 }
});
test('1:1 toggle establishes and retains exact scale without overwriting independent zoom lock',()=>{
 for(const dpr of [1,1.25,1.5,2])for(const zLock of [false,true]){
  const c=fixture({zoom:64,zLock,dpr,zBot:false});vm.runInContext(lines.find(line=>line.includes("$('zLimit').onclick =")),c);
  c.$('zLimit').onclick();assert.equal(c.st.zLimit,true);assert.equal(c.st.zoom,1/dpr);assert.equal(c.scale()*dpr,1);assert.equal(c.st.zLock,zLock);
  c.$('zLimit').onclick();assert.equal(c.st.zLimit,false);assert.equal(c.st.zoom,1/dpr);assert.equal(c.st.zLock,zLock);
  c.zoomTo(8/dpr);assert.equal(c.scale(),zLock?1/dpr:8/dpr);
 }
});
test('restored 1:1 follows current monitor DPR and normalizes stored numeric zoom',()=>{
 const c=fixture({zoom:64,zLimit:true,dpr:1.25});vm.runInContext(fn('cssLayout'),c);c.cssLayout();assert.equal(c.st.zoom,.8);c.window.devicePixelRatio=2;c.cssLayout();assert.equal(c.st.zoom,.5);assert.equal(c.scale()*2,1);
});

test('wheel and two-finger pinch hold exact physical scale while allowing gesture translation',()=>{
 for(const dpr of [1,1.25,1.5,2,3])for(const zLock of [false,true]){
  const c=fixture({zoom:1/dpr,zLimit:true,dpr,zLock});
  c.viewRotation={isFieldEvent:()=>true};c.drawEdgeRhomb=()=>{};
  c.wrap.addEventListener=(type,handler)=>{if(type==='wheel')c.wheel=handler;};
  const start=html.indexOf("  wrap.addEventListener('wheel', e => {"),end=html.indexOf('\n  // Тянуть',start);
  vm.runInContext(html.slice(start,end)+'\n'+fn('movePinch'),c);
  for(const deltaY of [-300,300,-20,20])c.wheel({deltaY,deltaMode:0,clientX:300,clientY:250,preventDefault(){}});
  assert.equal(c.scale()*dpr,1);assert.equal(c.st.zLock,zLock);
  c.pinch={d:100,s:c.scale(),x:200,y:200};
  c.movePinch(new Map([[1,{x:110,y:180}],[2,{x:310,y:180}]]));
  assert.equal(c.scale()*dpr,1);assert.equal(c.wrap.scrollLeft,90);assert.equal(c.wrap.scrollTop,120);
  assert.equal(c.pinch.d,200);assert.equal(c.pinch.s,1/dpr);
 }
});

test('Down pins position without changing an unlocked numeric zoom or 1:1 after release',()=>{
 for(const dpr of [1,1.25,1.5,2]){const c=fixture({zoom:1/dpr,zLimit:false,zBot:true,dpr});vm.runInContext(fn('cssLayout')+'\n'+lines.find(line=>line.includes("$('zFitH').onclick =")),c);c.cssLayout();assert.equal(c.st.zoom,1/dpr);c.$('zFitH').onclick();c.$('zFitH').onclick();assert.equal(c.st.zoom,1/dpr);c.zoomTo(2/dpr);assert.equal(c.scale(),2/dpr);}
});


test('axis pin permits horizontal overflow pan and restores centring when the field fits',()=>{
 for(const visibleWidth of [null,440]){
  const {c,w,cv,setPanel,center}=scrollFixture();setPanel(visibleWidth);c.st.zMid=true;c.cssLayout();
  assert.equal(c.horizontalAxisPinned(),true);
  assert.ok(Math.abs(cv.getBoundingClientRect().left+c.displayAnchorX()*c.scale()-center())<1);
  const cellAt=x=>(x-cv.getBoundingClientRect().left)/c.scale();
  c.zoomTo(16,center(),50,true);
  assert.equal(c.st.zMid,true);assert.equal(c.horizontalAxisPinned(),false);
  // Crossing into overflow retains the source point previously at the axis.
  assert.ok(Math.abs(cellAt(center())-c.displayAnchorX())<1e-6);
  w.scrollLeft=700;const before=cellAt(center());
  for(let frame=0;frame<3;frame++){c.cssLayout();c.fitHold();c.midScroll();assert.ok(Math.abs(cellAt(center())-before)<1e-6);}
  vm.runInContext(fn('centerAnchor'),c);c.centerAnchor();assert.ok(Math.abs(cellAt(center())-before)<1e-6);
  w.clientWidth=1000;c.cssLayout();assert.ok(Math.abs(cellAt(center())-before)<1e-6);
  c.zoomTo(1,center(),50,true);assert.equal(c.horizontalAxisPinned(),true);
  assert.ok(Math.abs(cv.getBoundingClientRect().left+c.displayAnchorX()*c.scale()-center())<1);
 }
});
test('an open library releases the axis pin as soon as actual field width overflows its viewport',()=>{
 const {c,w,cv,setPanel,center}=scrollFixture();c.st.zMid=true;c.st.zoom=4;c.cssLayout();
 assert.equal(c.horizontalAxisPinned(),true);
 setPanel(440);c.cssLayout();assert.equal(c.horizontalAxisPinned(),false);
 const before=(center()-cv.getBoundingClientRect().left)/c.scale();
 w.scrollLeft+=50;c.fitHold();c.cssLayout();assert.ok(Math.abs((center()-cv.getBoundingClientRect().left)/c.scale()-before-12.5)<1e-6);
 setPanel(null);c.cssLayout();assert.equal(c.horizontalAxisPinned(),true);
 assert.ok(Math.abs(cv.getBoundingClientRect().left+c.displayAnchorX()*c.scale()-center())<1);
});


test('axis overflow leaves physical 1:1, independent zoom lock and vertical pins intact',()=>{
 for(const dpr of [1,1.25,2])for(const zLock of [false,true]){
  const {c,w,cv}=scrollFixture();c.window.devicePixelRatio=dpr;c.dispW=()=>2048;
  Object.assign(c.st,{zMid:true,zLimit:true,zLock,ztop:true,zoom:32});
  let topPins=0;c.zTopScroll=()=>topPins++;c.cssLayout();
  assert.equal(c.horizontalAxisPinned(),false);assert.equal(c.scale()*dpr,1);assert.equal(c.st.zLock,zLock);assert.ok(topPins>0);
  w.scrollLeft=400;c.cssLayout();c.fitHold();c.midScroll();assert.equal(w.scrollLeft,400);
  const left=cv.getBoundingClientRect().left;c.zoomTo(512,200,200,true);
  assert.equal(c.scale()*dpr,1);assert.equal(cv.getBoundingClientRect().left,left);assert.equal(c.st.zMid,true);assert.equal(c.st.ztop,true);
 }
});
