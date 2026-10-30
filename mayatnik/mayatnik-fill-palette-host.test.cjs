const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8').replace(/\r\n/g,'\n'),moduleSource=fs.readFileSync(__dirname+'/mayatnik-fill-palette.js','utf8');
function section(a,b){const start=html.indexOf(a),end=html.indexOf(b,start+a.length);assert.ok(start>=0&&end>start,a);return html.slice(start,end);}
function fixture({fill=true,hidden=false,selection=false,template=false,axes=false,playing=false}={}){
 const dom=new JSDOM('<body><div id="wrap"><canvas id="cv"></canvas><button id="field-ui">UI</button></div><input id="fillColour" type="color" value="#ff0000"><button id="bFill"></button><button id="bFillUndo"></button><button id="bFillRedo"></button><button id="bFillClear"></button><input id="templateDown" value="0"><input id="templateHeight" value="100"></body>',{runScripts:'outside-only'}),w=dom.window,doc=w.document,wrap=doc.querySelector('#wrap'),canvas=doc.querySelector('#cv');
 const box={left:100,top:100,right:700,bottom:500,width:600,height:400};canvas.getBoundingClientRect=()=>box;wrap.getBoundingClientRect=()=>({left:0,top:0,right:900,bottom:700,width:900,height:700});wrap.setPointerCapture=()=>{};
 const counts={paint:[],colour:0,axis:0,cell:0,swallow:0,template:0,stops:0,preview:0};const item={id:'selected',parts:[{}]};
 const c={manualPaintCurrent:()=>null,window:w,document:doc,wrap,cv:canvas,$:id=>doc.getElementById(id),fillMode:fill,playing,k:8,target:10,RK:1,autoVertical:0,fillHistory:[],fillRedo:[],fillMask:null,paintBits:null,faceLayer:null,templateMatchLayer:null,colReplay:[],f:{},img:{width:6,height:4},lockAny:()=>false,
  clearFillPreview(){counts.preview++;},fillAt(...args){counts.paint.push(args);},stop(){counts.stops++;c.playing=false;},
  templateContextSkip:false,templateDragging:null,lineDrag:null,rulerMode:false,axisSelected:0,axisLineMode:false,axisLinePending:null,templatePickEnabled:true,templateDragEnabled:true,templateItems:template?[item]:[],templatePickedIds:new Set(['selected']),templateOffsetX:0,templateTransfer:false,templateCanvas:{hidden:false},st:{userLines:axes?[[0,0,1,1]]:[]},
  hitTemplate:()=>template?{item,part:item.parts[0],skipSelection:false}:null,templateItemAllowed:()=>true,selectTemplate(){counts.template++;},templateRect:()=>({x:0,y:0,width:2,height:2}),scale:()=>1,editSnapshot:()=>({}),
  takeColourAt(){counts.colour++;return true;},nearestUserLine:()=>0,axisSelOut(){counts.axis++;},axisSelTo(){counts.axis++;},axisLinesSync(){},queueDigits(){},
  cellSelectionView:{mode:selection?'cell':'off',pointerDown(){counts.cell++;return false;}},cellHidden:()=>hidden,cellSwallow(e){counts.swallow++;e.preventDefault();e.stopImmediatePropagation();}};
 w.eval(moduleSource);vm.createContext(c);
 vm.runInContext(section('  window.mayFillPalette=','  // v0.070:'),c);
 vm.runInContext(section('  function fillSync(){','  function resetFillHistory('),c);
 vm.runInContext(section("  wrap.addEventListener('contextmenu',e=>{\n    if(window.mayFillPalette",'  // v0.309:'),c);
 vm.runInContext(section("  wrap.addEventListener('pointerdown', e => {\n    if(fillMode&&e.button===2)","  wrap.addEventListener('pointermove', e => {"),c);
 vm.runInContext(section('  function cellPointerDown(','  function cellPointerMove('),c);wrap.addEventListener('pointerdown',e=>c.cellPointerDown(e),true);
 const capture=html.split('\n').find(line=>line.includes("wrap.addEventListener('contextmenu'")&&line.includes('cellHidden()'));assert.ok(capture);vm.runInContext(capture,c);c.fillSync();
 function mouse(type,target=canvas,props={}){const e=new w.MouseEvent(type,{button:2,clientX:300,clientY:200,bubbles:true,cancelable:true,...props});Object.defineProperty(e,'pointerId',{value:1});target.dispatchEvent(e);return e;}
 return {c,w,doc,counts,mouse,close(){w.mayFillPalette.destroy();dom.window.close();}};
}

test('real capture/context/pointerdown routes prioritize fill over selected templates, manual axes and cell capture',()=>{
 for(const options of [{template:true},{axes:true},{selection:true},{hidden:true},{template:true,axes:true,selection:true,hidden:true}]){const f=fixture(options);try{f.mouse('pointerdown');assert.equal(f.c.templateDragging,null);assert.equal(f.c.templateContextSkip,false);assert.equal(f.counts.cell,0,'hidden-cell panning cannot capture right pointerdown');assert.equal(f.counts.template,0);const event=f.mouse('contextmenu',undefined,{shiftKey:true});assert.equal(event.defaultPrevented,true);assert.equal(f.counts.paint.length,1);assert.deepEqual(f.counts.paint[0],[300,200,true,true]);assert.equal(f.doc.getElementById('fillColour').value,'#ff7f00');assert.equal(f.counts.colour,0);assert.equal(f.counts.axis,0);assert.equal(f.counts.swallow,0,'fill consumes before legacy cell context capture');
 }finally{f.close();}}
});

test('fill OFF retains template picking, axis selection and hidden-cell context/panning behavior',()=>{
 for(const [options,expected]of [[{},'colour'],[{template:true},'colour'],[{axes:true},'axis'],[{hidden:true},'swallow'],[{selection:true},'swallow']]){const f=fixture({fill:false,...options});try{f.mouse('contextmenu');assert.equal(f.counts.paint.length,0);assert.equal(f.doc.getElementById('fillColour').value,'#ff0000');assert.equal(f.counts[expected],1);assert.equal(f.w.mayFillPalette.panel.hidden,true);}finally{f.close();}}
 const t=fixture({fill:false,template:true});try{t.mouse('pointerdown');assert.ok(t.c.templateDragging);assert.equal(t.counts.template,1);}finally{t.close();}
 const h=fixture({fill:false,hidden:true});try{h.mouse('pointerdown');assert.ok(h.c.cellSelectionPan);assert.equal(h.counts.swallow,1);}finally{h.close();}
});

test('host force paint pauses playback at its current frame; normal UI right click does not change fill colour',()=>{
 const f=fixture({playing:true});try{f.mouse('contextmenu');assert.equal(f.counts.stops,1);assert.equal(f.c.target,8);assert.equal(f.counts.paint[0][3],true);assert.equal(f.c.playing,false);f.mouse('contextmenu',f.doc.querySelector('#field-ui'));assert.equal(f.counts.paint.length,1);assert.equal(f.doc.querySelector('#fillColour').value,'#ff7f00');}finally{f.close();}
});

test('fillSync distinguishes fill from Column and removes pencil/palette when fill stops',()=>{
 const f=fixture();try{assert.equal(f.w.mayFillPalette.panel.hidden,false);assert.equal(f.doc.body.classList.contains('may-fill-active'),true);f.c.fillMode=false;f.c.autoVertical=1;f.c.fillSync();assert.equal(f.w.mayFillPalette.panel.hidden,true);assert.equal(f.c.wrap.classList.contains('fill-mode'),true);assert.equal(f.c.wrap.classList.contains('may-fill-pencil'),false);assert.equal(f.doc.body.classList.contains('may-fill-active'),false);}finally{f.close();}
});

test('loader order, scoped pencil and seven canonical swatch outlines coexist with actual menu CSS',()=>{
 const loader=html.search(/src="mayatnik-fill-palette\.js(?:\?[^"\s]*)?"/);assert.ok(loader>=0&&loader<html.indexOf('  window.mayFillPalette='));assert.ok(/href="mayatnik-fill-palette\.css(?:\?[^"\s]*)?"/.test(html));
 const css=fs.readFileSync(__dirname+'/mayatnik-fill-palette.css','utf8');assert.match(css,/#wrap\.may-fill-pencil canvas/);assert.match(css,/body\.may-fill-active>\.may-layer-scene canvas/);assert.doesNotMatch(css,/may-fill-active\s+\*/);
 const f=fixture();try{const buttons=[...f.w.mayFillPalette.panel.querySelectorAll('[data-fill-colour]')];assert.equal(buttons.length,7);for(const b of buttons)assert.equal(b.querySelector('polygon').getAttribute('points'),'12,0 108,0 120,12 108,24 12,24 0,12');}finally{f.close();}
});
