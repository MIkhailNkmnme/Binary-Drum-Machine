const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8');
const menu=fs.readFileSync(path.join(__dirname,'mayatnik-menu.js'),'utf8');
const registry=html.slice(html.indexOf('  const cleanupActions=new Map();'),html.indexOf('  window.mayCellSelection='));
function scene(){
  const noop=()=>{},state={geomCenter:true,areas:true,cellInk:{},parity:require('./mayatnik-reset-state.js').defaults().parity};
  const context={window:{mayClear:{mirrors:()=>false},mayManualSnake:{get:()=>null},mayLayers:{list:()=>[]}},st:state,f:{},resetAllBusy:false,sessionReady:true,cacheRestoring:false,frameLibraryBusy:false,templateDragging:null,
    backupOperationBusy:()=>false,axesPresent:()=>false,clearAllAxes:noop,clearTemplateSelection:noop,cellHidden:()=>false,foldCloseAll:noop,digitsOn:()=>false,contoursOn:()=>false,
    manualPaintCurrent:()=>null,fillMask:null,templatePaintLayer:null,paintBits:null,fillBits:null,faceLayer:null,templateMatchLayer:null,lockAny:()=>false,zlList:()=>[],fillMode:false,autoVertical:0,chessLive:false,autoRun:false,colReplay:[],templateItems:[],colourTemplate:null,templatePickedIds:new Set(),templateFindOnceRunning:false,templateFollow:null,
    cellSelectionModel:{selection:null},afNorm:()=>null,rulerA:null,rulerB:null,rulerMode:false,areaSel:'',ochki:null,ochkiSelected:null,ochkiFoundRows:new Set(),ochkiFoundUnion:new Set(),ochkiSnakeJob:null,ochkiReplay:null,snakePathEntries:[],ovlState:()=>({n:0}),ovlFrozen:null,foldTransport:null,foldTransportV:null,rowBuildHighlight:null,pxHide:new Set(),MayatnikResetState:require('./mayatnik-reset-state.js'),
    $:id=>({type:'checkbox',checked:state[id],dispatchEvent(){state[id]=this.checked;}}),Event:class{},dispatchEvent:noop,writeUI:noop,cellSync:noop,save:noop,savePaint:noop,queueSession:noop,draw:noop,queueDigits:noop};
  vm.createContext(context);vm.runInContext(registry,context);return context;
}
test('registry clears a single overlay, retains other material and supports extensions',async()=>{
  const c=scene(),api=c.window.mayCleanup;
  assert(api.present().some(a=>a.id==='geomCenter'));
  assert.equal(await api.run('geomCenter'),true);
  assert.equal(c.st.geomCenter,false);assert.equal(c.st.areas,true);
  assert(!api.present().some(a=>a.id==='geomCenter'));
  let on=true;api.register({id:'extension',label:'Extra',present:()=>on,clear:()=>{on=false;}});
  assert(api.present().some(a=>a.id==='extension'));await api.run('extension');assert(!api.present().some(a=>a.id==='extension'));
  c.f=null;assert.equal(api.present().length,0);
});
test('cleanup guard preserves material while session is restoring',async()=>{
  const c=scene();c.cacheRestoring=true;assert.equal(await c.window.mayCleanup.run('geomCenter'),false);assert.equal(c.st.geomCenter,true);
});
test('menu adds and removes live commands without accumulating duplicates; global action remains',async()=>{
  const source=menu.slice(menu.indexOf('  function mountCleanupActions('),menu.indexOf('  function mountViewActions('));
  const c={};vm.createContext(c);vm.runInContext(source,c);
  const all={id:'all'},row={children:[all]},actions=new Map(),runs=[];
  const api={present:()=>[...actions.values()],async run(id){runs.push(id);actions.delete(id);}};
  const make=(host,id,label,help,run)=>{const b={id,label,run,dataset:{},remove(){host.children=host.children.filter(n=>n!==b);}};host.children.push(b);return b;};
  const mounted=c.mountCleanupActions(row,()=>api,make);mounted.sync();assert.equal(row.children.length,1);
  actions.set('paint',{id:'paint',label:'Paint'});mounted.sync();mounted.sync();assert.equal(row.children.length,2);
  await row.children[1].run();assert.deepEqual(runs,['paint']);assert.deepEqual(row.children,[all]);
  actions.set('axis',{id:'axis',label:'Axis'});mounted.sync();actions.clear();mounted.sync();assert.deepEqual(row.children,[all]);
});
