const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8'),Style=require('./mayatnik-axis-style.js'),Settings=require('./mayatnik-settings-library.js'),Reset=require('./mayatnik-reset-state.js');
function production(name){const at=html.indexOf('  function '+name+'('),start=html.indexOf('{',at);assert.ok(at>=0,name);let depth=1,i=start+1;for(;depth;i++){if(html[i]==='{')depth++;if(html[i]==='}')depth--;}return html.slice(at,i);}
const json=v=>JSON.parse(JSON.stringify(v));
function fixture(state={}){
 const drawn=[],elements=new Map(),nodes=[];let saved,draws=0;
 const context={setTransform(){},clearRect(){drawn.length=0;},beginPath(){},moveTo(){},lineTo(){},save(){this.saved={strokeStyle:this.strokeStyle,lineWidth:this.lineWidth};},restore(){Object.assign(this,this.saved);},setLineDash(v){this.dash=v;},stroke(){drawn.push({colour:this.strokeStyle,dash:[...this.dash]});}};
 function element(){const children=new Map(),handlers={};return {children,handlers,hidden:false,style:{setProperty(k,v){this[k]=v;}},classList:{toggle(){},add(){},remove(){}},setAttribute(k,v){this[k]=v;},querySelector(q){if(!children.has(q))children.set(q,element());return children.get(q);},addEventListener(k,v){handlers[k]=v;},removeEventListener(){},setPointerCapture(){this.captured=true;},getContext:()=>context,offsetWidth:16,offsetHeight:18};}
 const c={st:{rows:8,linesOn:false,ztopRow:4,ztlMain:true,ztMir:0,...state},f:{W:9,H:8,val:new Int8Array(72).fill(1)},geo:{anchor:4},VX:0,VW:9,VH:8,RK:1,img:{},devicePixelRatio:1,scale:()=>10,rombP:()=>-1,outShow:()=>false,guideHeight:()=>8,window:{},queueLineMeasures(){},mirPre(){},mirPut:(px,q,v)=>px[q]=v,save(){saved=json(c.st);},draw(){draws++;},$:id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);},document:{createElement(){const e=element();nodes.push(e);return e;},body:{append(){},classList:{contains:()=>false}}},ztl:element(),zlO:undefined};
 const rect={left:0,top:0,right:90,bottom:80,width:90,height:80};c.cv={getBoundingClientRect:()=>rect};c.wrap={clientWidth:90,clientHeight:80,getBoundingClientRect:()=>rect};c.axisStroke=(g,o)=>Style.stroke(g,{mode:c.st.axisPalette,...o});vm.createContext(c);
 c.dispW=()=>c.VW;c.MayatnikManualLines=require('./mayatnik-manual-lines.js');c.MayatnikManualLinesView={mount(options){c.manualCallbacks=options;return {render(snapshot){c.manualSnapshot=snapshot;}};}};c.manualLinesView=undefined;
 for(const name of ['zlFamilies','zlFamily','zlFamilyOn','zlColour','zlShowFamily','zlList','zlHalf','zlAdd','zlEnsure','zlNumbers','zlAxis','zlDraw','zTopLine','manualMirrorPlan','zlMirApply','gpuMirPasses'])vm.runInContext(production(name),c);
 const start=html.indexOf('  const zLinesSync = '),end=html.indexOf('  // v0.365:',start);vm.runInContext(html.slice(start,end),c);
 const mirrors=html.indexOf('  window.mayLineMirrors=');vm.runInContext(html.slice(mirrors,html.indexOf('  function zlHalf(',mirrors)),c);
 return {c,drawn,elements,click:id=>c.$(id).onclick(),saved:()=>saved,draws:()=>draws};
}
test('one family enables itself, creates only its initial axes and toggles without losing positions or mirrors',()=>{
 for(const [id,k,kinds]of [['zHoriz','h',[]],['zVert','v',['v']],['zDiag','d',['d','e']]]){
  const {c,click}=fixture();click(id);assert.equal(c.zlFamilyOn(k),true);assert.deepEqual(json(c.st.zl.map(z=>z.k)),kinds);for(const other of ['h','v','d'].filter(v=>v!==k))assert.equal(c.zlFamilyOn(other),false);
  c.st.ztopRow=3.5;c.st.ztMir=2;for(const z of c.st.zl){z.p+=2;z.m=2;}const before=json({zl:c.st.zl,row:c.st.ztopRow,mirror:c.st.ztMir});click(id);assert.equal(c.zlFamilyOn(k),false);click(id);assert.deepEqual(json({zl:c.st.zl,row:c.st.ztopRow,mirror:c.st.ztMir}),before);
 }
});
test('all eight family combinations render only their own main/additional guides and hidden handles cannot capture',()=>{
 for(let mask=0;mask<8;mask++){
  const {c,drawn}=fixture({linesOn:true,lineFamilies:{h:!!(mask&1),v:!!(mask&2),d:!!(mask&4)},zl:[{k:'h',p:2,m:0},{k:'v',p:1,m:0},{k:'d',p:0,m:0},{k:'e',p:0,m:0}]});c.zTopLine();assert.equal(c.manualSnapshot.axes[0].visible,!!(mask&1));
  for(const a of c.manualSnapshot.axes){assert.equal(a.visible,c.zlFamilyOn(a.kind));if(!a.visible)assert.equal(a.segment,null);else assert.equal(a.colour,c.zlColour(a.kind));}
  assert.deepEqual(drawn.filter((_,i)=>i%2).map(x=>x.colour),Array.from(c.manualSnapshot.axes.filter(a=>a.segment),a=>a.colour));
 }
});
test('master preserves flags; individual activation while master is off reveals only itself and preserves all collections',()=>{
 const {c,click}=fixture({linesOn:true,lineFamilies:{h:true,v:false,d:true},zl:[{k:'h',p:2,m:1},{k:'v',p:1,m:2},{k:'d',p:-1,m:1},{k:'e',p:1,m:2}]});c.zTopLine();const before=json(c.st.zl);click('zLines');click('zLines');assert.deepEqual(json(c.st.lineFamilies),{h:true,v:false,d:true});click('zLines');click('zVert');assert.deepEqual(json(c.st.lineFamilies),{h:false,v:true,d:false});assert.deepEqual(json(c.st.zl),before);
});
test('legacy state and JSON reload retain old display and new family choices',()=>{
 const old=fixture({linesOn:true});old.c.zTopLine();assert.deepEqual(json(old.c.st.lineFamilies),{h:true,v:true,d:true});assert.deepEqual(json(old.c.st.zl.map(z=>z.k)),['v','d','e']);old.click('zHoriz');const reload=fixture(old.saved());reload.c.zTopLine();assert.equal(reload.c.ztl.hidden,true);assert.equal(reload.c.zlFamilyOn('v'),true);assert.equal(reload.c.zlFamilyOn('d'),true);
});
test('add/remove and drag keep their family and preserve other axes',()=>{
 const {c,click}=fixture();click('zVert');const first=c.st.zl[0];first.m=2;c.zlAdd('v',first.p/2);assert.equal(c.st.zl.length,2);const id='v:'+c.st.zl[1].axisNo;c.manualCallbacks.onPosition(id,3);assert.equal(c.st.zl[1].p,3);c.manualCallbacks.onDelete(id);assert.equal(c.st.zl.length,1);assert.equal(c.st.zl[0].m,2);assert.equal(c.zlFamilyOn('h'),false);assert.equal(c.zlFamilyOn('d'),false);
});
test('CPU and GPU mirror paths apply only visible families, preserving modes through off/on',()=>{
 for(const k of ['main','h','v','d','e'])for(const mode of [1,2]){
  const family=k==='main'?'h':k==='e'?'d':k,state={linesOn:true,lineFamilies:{h:false,v:false,d:false},ztMir:k==='main'?mode:0,zl:k==='main'?[]:[{k,p:k==='h'?3:k==='v'?0:k==='d'?0:4,m:mode}]};state.lineFamilies[family]=true;
  const {c}=fixture(state),base=Uint32Array.from({length:72},(_,i)=>i+1),on=base.slice();c.zlMirApply(on);assert.notDeepEqual(on,base,k+' mode '+mode);assert.equal(c.gpuMirPasses().out.length,1,k);
  c.st.lineFamilies[family]=false;const off=base.slice();c.zlMirApply(off);assert.deepEqual(off,base);assert.equal(c.gpuMirPasses().out.length,0);c.st.lineFamilies[family]=true;const restored=base.slice();c.zlMirApply(restored);assert.deepEqual(restored,on);
 }
});
test('setting mirror mode wakes only its family, and disabling a mirror does not reveal hidden axes',()=>{
 const {c}=fixture({linesOn:false,zl:[{k:'v',p:0,m:0},{k:'d',p:0,m:0}]});c.window.mayLineMirrors.set(0,1);assert.deepEqual(json(c.st.lineFamilies),{h:false,v:true,d:false});c.st.linesOn=false;c.window.mayLineMirrors.set(0,0);assert.equal(c.st.linesOn,false);assert.equal(c.st.zl[0].m,0);
});
test('family preset validation, copying, legacy migration and clean reset preserve independent visibility',()=>{
 const source={linesOn:true,lineFamilies:{h:false,v:true,d:false}},preset=Settings.pick(source);source.lineFamilies.h=true;assert.equal(preset.state.lineFamilies.h,false);const target={};Settings.applyState(target,preset);assert.deepEqual(target.lineFamilies,{h:false,v:true,d:false});delete preset.state.lineFamilies;Settings.applyState(target,preset);assert.equal(target.lineFamilies,undefined);preset.state.lineFamilies={h:true,v:'no',d:false};assert.throws(()=>Settings.normalized(preset));assert.deepEqual(Reset.defaults().lineFamilies,{h:false,v:false,d:false});
});

test('plus at zero creates independent numbered horizontal axes; dragging, mirrors and reload retain their identity',()=>{
 const {c,saved}=fixture({ztopRow:0,linesOn:true,lineFamilies:{h:true,v:false,d:false}});c.zTopLine();c.manualCallbacks.onAdd('main');
 assert.equal(c.st.zl.length,1);const id=c.manualSnapshot.axes[1].id;assert.equal(id,'h:2');assert.equal(c.st.zl[0].p,0);
 c.manualCallbacks.onPosition(id,3.5);assert.equal(c.st.ztopRow,0);assert.equal(c.st.zl[0].p,3.5);
 c.manualCallbacks.onMirror(id,2);assert.equal(c.st.ztMir,0);assert.equal(c.st.zl[0].m,2);
 c.manualCallbacks.onAdd('main');assert.deepEqual(Array.from(c.st.zl,z=>z.axisNo),[2,3]);assert.equal(c.st.zl[1].p,0);c.manualCallbacks.onCommit(id);
 const reload=fixture(saved());reload.c.zTopLine();assert.deepEqual(json(reload.c.st.zl),json(c.st.zl));
 c.manualCallbacks.onDelete('h:2');assert.equal(c.st.zl[0].axisNo,3,'surviving axes are not renumbered');
});

test('last-row centre and bottom boundary keep correct CPU/GPU mirror coordinates',()=>{
 for(const main of [true,false])for(const p of [7.5,8])for(const mode of [1,2]){
  const {c}=fixture({linesOn:true,lineFamilies:{h:true,v:false,d:false},ztopRow:p,ztMir:main?mode:0,zl:main?[]:[{k:'h',p,m:mode}]});
  const base=Uint32Array.from({length:72},(_,i)=>i+1),paint=base.slice();c.zlMirApply(paint);assert.deepEqual(paint,base,'no opposite-side row exists at '+p);
  assert.deepEqual(Array.from(c.gpuMirPasses().out[0].slice(0,4)),[3,mode,p%1?1:0,Math.floor(p)]);
 }
});
