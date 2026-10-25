'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Model=require('./mayatnik-cell-selection.js');
const View=require('./mayatnik-cell-selection-view.js');
const html=fs.readFileSync(require.resolve('./Zerkalius-mayatnik.html'),'utf8');

// Compile candidate ends instead of counting braces: the real page functions
// contain comments, template literals and nested callbacks. No DOM or browser.
function pageFunction(name){
  const match=new RegExp('(?:async )?function '+name+'\\s*\\(').exec(html);
  assert.ok(match,'page function '+name+' exists');
  for(let end=html.indexOf('}',match.index);end!==-1;end=html.indexOf('}',end+1)){
    const source=html.slice(match.index,end+1);
    try{new vm.Script('('+source+')');return source;}catch(error){if(!(error instanceof SyntaxError))throw error;}
  }
  throw Error('Cannot extract '+name);
}
function node(width,height,rect){
  return {width,height,style:{},hidden:false,classes:new Set(),
    classList:{add(value){this.owner.classes.add(value);}},getBoundingClientRect(){return {...rect};}};
}
function canvas(width,height,rect){const result=node(width,height,rect);result.classList.owner=result;return result;}
function harness({rows=100,cols=10,gpu=false,entries}={}){
  const rect={left:0,top:0,width:cols*10,height:rows*10};
  const viewport={left:0,top:0,width:100,height:100};
  const cv=canvas(gpu?1:cols,gpu?1:rows,rect),original=canvas(100,100,viewport);
  const descriptors=entries||[{id:'original',kind:'original',visible:true,opacity:100,x:0,y:0,tint:null}];
  const controls=new Map(),calls={gpu:[],sync:0,queue:0,save:0};
  const context={console,structuredClone,Int8Array,Uint32Array,ImageData:class{},
    cellSelectionModel:Model.create({rows,cols}),cellSelectionView:null,cellGpuCanvas:null,cellGpuCtx:null,
    f:{val:new Int8Array(rows*cols)},geo:{anchor:0},img:gpu?null:{width:cols,height:rows},gpuBig:gpu?{fresh:false,fld:{render(ctx,options){calls.gpu.push({ctx,options});}}}:null,
    gpuCv:null,cv,wrap:{clientWidth:100,clientHeight:100,getBoundingClientRect:()=>({...viewport})},
    VH:rows,VW:cols,VX:7,RK:1,RG:0,EMPTY:[13,15,22],st:{rows,view:'bits',digitSize:80},
    dispW:()=>cols,scale:()=>10,DPR:()=>1,rombP:()=>-1,templateItems:[],playing:false,
    layerCpuService:null,layerDigitService:null,
    window:{mayLayers:{list:()=>descriptors,_entry:()=>({node:original,enabled:true})}},
    document:{querySelectorAll:()=>[],createElement:()=>canvas(1,1,viewport)},gpuApi:{attach:()=>({gpuContext:true})},
    cellSync(){calls.sync++;},queueDigits(){calls.queue++;},save(){calls.save++;},
    $(id){if(!controls.has(id))controls.set(id,{style:{},classList:{add(){}},value:'',checked:false});return controls.get(id);}
  };
  vm.createContext(context);
  vm.runInContext(['cellTileCoordinates','cellGpuTile','cellSource','cellHydrate','cellStore'].map(pageFunction).join('\n'),context);
  // setMode renders synchronously in the real view. Keep that ordering here:
  // hydration must happen after the new field dimensions are installed.
  context.cellSelectionView={mode:'off',setMode(value){this.mode=value;context.cellStore();context.cellSource();}};
  return {context,calls,rect,viewport,cv,original,descriptors};
}

test('CPU projection pulls newly visible rows from full cv, beyond the old viewport',()=>{
  const {context:c,viewport,cv,original}=harness();
  c.cellSelectionModel.hideRange('rows',0,9);
  const source=c.cellSource(),tiles=View.tiles(source,c.cellSelectionModel,View.geometry(source,c.cellSelectionModel,viewport));
  assert.equal(source.layers[0].canvas,cv,'the viewport-only layer must not be used as original source');
  assert.notEqual(source.layers[0].canvas,original);
  const pieces=View.layerTiles(source,tiles,source.layers[0]);
  assert.equal(pieces.length,1);
  assert.equal(pieces[0].sy,10);assert.equal(pieces[0].sh,10);
  assert.equal(pieces[0].dh,100);
});

test('CPU projection pulls newly visible columns from outside the old viewport',()=>{
  const {context:c,viewport}=harness({rows:10,cols:100});
  // Scrolled field: after collapse the right half enters the visible viewport.
  c.cv.getBoundingClientRect=()=>({left:-450,top:0,width:1000,height:100});
  c.cellSelectionModel.hideRange('cols',0,49);
  const source=c.cellSource(),tiles=View.tiles(source,c.cellSelectionModel,View.geometry(source,c.cellSelectionModel,viewport));
  const pieces=View.layerTiles(source,tiles,source.layers[0]);
  assert.equal(pieces.length,1);assert.equal(pieces[0].sx,70);assert.equal(pieces[0].sw,10);
});

test('GPU source survives img=null and renders requested original tiles rather than old viewport',()=>{
  const {context:c,calls,viewport}=harness({gpu:true});
  c.cellSelectionModel.hideRange('rows',0,9);
  const source=c.cellSource();assert.ok(source);assert.equal(c.img,null);
  const tiles=View.tiles(source,c.cellSelectionModel,View.geometry(source,c.cellSelectionModel,viewport));
  const draws=[];source.layers[0].drawTile({drawImage(...args){draws.push(args);}},tiles[0],source);
  assert.deepEqual({...calls.gpu[0].options},{x0:7,y0:10,step:.1});
  assert.equal(draws.length,1);assert.equal(draws[0][1],0);
  assert.equal(c.cellGpuCanvas.width,100);assert.equal(c.cellGpuCanvas.height,100);
});

test('GPU fresh frame refreshes the compact projection after rendering original',()=>{
  const {context:c}=harness({gpu:true});
  const order=[];c.gpuCv=canvas(100,100,{left:0,top:0,width:100,height:100});
  c.wrap.clientLeft=0;c.wrap.clientTop=0;c.gpuCtx={};
  c.gpuBig.fld.render=()=>order.push('gpu');c.layerOriginalBase=()=>order.push('base');
  c.videoGpuFrame=()=>order.push('video');c.cellSelectionView.render=()=>order.push('projection');
  vm.runInContext(pageFunction('gpuRender'),c);c.gpuRender();
  assert.deepEqual(order,['gpu','base','video','projection']);assert.equal(c.img,null);
});

test('original CPU layer offset already present in cv geometry is not applied twice',()=>{
  const d={id:'original',kind:'original',visible:true,opacity:60,x:20,y:30,tint:null};
  const {context:c}=harness({entries:[d]});
  const shifted={left:20,top:30,width:100,height:1000};c.cv.getBoundingClientRect=()=>({...shifted});
  const source=c.cellSource();
  assert.deepEqual({...source.layers[0].rect},shifted);
  assert.equal(source.layers[0].opacity,.6);
});

test('original GPU and digit tiles use field coordinates without subtracting its screen offset again',()=>{
  const d={id:'original',kind:'original',visible:true,opacity:100,x:20,y:30,tint:null};
  const {context:c,calls,viewport}=harness({gpu:true,entries:[d]});
  c.cv.getBoundingClientRect=()=>({left:20,top:30,width:100,height:1000});
  c.cellSelectionModel.hideRange('rows',0,9);
  let source=c.cellSource(),tile=View.tiles(source,c.cellSelectionModel,View.geometry(source,c.cellSelectionModel,viewport))[0];
  source.layers[0].drawTile({drawImage(){}},tile,source);
  assert.deepEqual({...calls.gpu[0].options},{x0:7,y0:10,step:.1});
  const digitCalls=[];c.gpuBig.fresh=true;c.st.view='digits';c.paintCellDigits=(...args)=>digitCalls.push(args);
  source=c.cellSource();tile=View.tiles(source,c.cellSelectionModel,View.geometry(source,c.cellSelectionModel,viewport))[0];
  source.layers[1].drawTile({},tile,source);
  assert.equal(digitCalls[0][1],0);assert.equal(digitCalls[0][2],-100);
});

test('hydration restores independent intervals and mode, and clears them for a legacy work',()=>{
  const {context:c}=harness();const saved=Model.create({rows:100,cols:10});
  saved.hideRange('rows',30,40);saved.hideRange('cols',3,5);
  c.cellSelectionModel.hideRange('rows',1,2);
  c.st.cellSelection={model:saved.serialize(),mode:'rows'};c.cellHydrate();
  assert.deepEqual(c.cellSelectionModel.hiddenRows,[[30,40]]);
  assert.deepEqual(c.cellSelectionModel.hiddenCols,[[3,5]]);
  assert.equal(c.cellSelectionView.mode,'rows');
  delete c.st.cellSelection;c.cellHydrate();
  assert.deepEqual(c.cellSelectionModel.hiddenRows,[]);assert.deepEqual(c.cellSelectionModel.hiddenCols,[]);
  assert.equal(c.cellSelectionView.mode,'off');
});

test('restorePaint installs larger field geometry before hydration can clip saved intervals',async()=>{
  const {context:c}=harness({rows:10,cols:10});const saved=Model.create({rows:100,cols:10});saved.hideRange('rows',50,60);
  const noop=()=>{};
  Object.assign(c,{cacheWrites:Promise.resolve(),cacheRestoring:false,mirrorLive:false,
    MayatnikPaintCache:{read:async()=>null},
    mirrorLiveSet:noop,validateFrameWork:noop,restoreFrameEffects:noop,writeUI:noop,updWin:noop,canvasSize:noop,draw:noop,
    selectTemplate:noop,axisLinesSync:noop,fillSync:noop,templateSync:noop,layout:noop,centerAnchor:noop,restoreFrameHost:noop,
    templateDragging:null,templateLocks:null,fillHistory:[],fillRedo:[],fillHistoryBytes:0,
    reset(){c.VH=c.st.rows;c.f={val:new Int8Array(c.VH*10)};c.img={width:10,height:c.VH};}
  });
  vm.runInContext(pageFunction('restorePaint'),c);
  const result=await c.restorePaint({schema:2,st:{rows:100,view:'bits',cellSelection:{model:saved.serialize(),mode:'rows'}},
    field:new Int8Array(1000),width:10,height:100,k:0,fill:null,templates:[],colour:'#ffffff'});
  assert.equal(result,true,c.$('paintCacheInfo').textContent);
  assert.equal(c.cellSelectionModel.rows,100);
  assert.deepEqual(c.cellSelectionModel.hiddenRows,[[50,60]],'saved rows beyond the old field must survive the live view render');
  assert.equal(c.cellSelectionView.mode,'rows');
});

test('template adapter paints original offscreen pixels at the mapped position with one opacity application',()=>{
  const d={id:'template:test',kind:'template',visible:true,opacity:35,x:20,y:0,tint:null};
  const {context:c,viewport}=harness({entries:[d]});
  const image={id:'template-pixels'};
  const item={id:'test',view:{visible:true,alpha:70},parts:[{ox:0,canvas:image,bitsData:null,mask:{width:2,height:2}}]};
  c.templateItems=[item];c.rememberTemplate=()=>{};c.colourTemplate=null;
  c.templateRect=()=>({x:1,y:12,width:2,height:2});
  vm.runInContext(pageFunction('paintTemplate'),c);
  c.cellSelectionModel.hideRange('rows',0,9);
  const source=c.cellSource(),tiles=View.tiles(source,c.cellSelectionModel,View.geometry(source,c.cellSelectionModel,viewport));
  const calls=[],stack=[];const ctx={globalAlpha:1,save(){stack.push(this.globalAlpha);},restore(){this.globalAlpha=stack.pop();},
    beginPath(){},rect(){},clip(){},drawImage(...args){calls.push({args,alpha:this.globalAlpha});}};
  View.drawLayer(ctx,source,tiles,source.layers[0]);
  assert.equal(calls.length,1);assert.equal(calls[0].args[0],image);
  assert.deepEqual(calls[0].args.slice(1),[30,20,20,20]);
  assert.equal(calls[0].alpha,.35);assert.equal(ctx.globalAlpha,1);
  assert.equal(item.parts[0].canvas,image,'template source pixels are not rewritten');
  const own={id:'own-bit-pixels'};item.parts[0].bitsData=new Int8Array([0,1,1,0]);item.parts[0].bitCanvas=own;
  calls.length=0;View.drawLayer(ctx,source,tiles,source.layers[0]);
  assert.equal(calls[0].args[0],own);assert.equal(calls[0].alpha,.35);
});
