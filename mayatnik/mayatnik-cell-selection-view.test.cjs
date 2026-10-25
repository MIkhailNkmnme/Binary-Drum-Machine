'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Model=require('./mayatnik-cell-selection.js');
const View=require('./mayatnik-cell-selection-view.js');
test('selection overlay overrides the global black canvas background',()=>{
  const fs=require('node:fs');
  const css=fs.readFileSync(require.resolve('./mayatnik-cell-selection-view.css'),'utf8');
  const rule=/\.mcsv-canvas\s*\{([^}]+)\}/.exec(css);
  assert.ok(rule,'overlay has its own canvas rule');
  assert.match(rule[1],/background\s*:\s*transparent\s*[;}]/,
    'selection-only pixels must compose over CPU and GPU originals');
  assert.match(rule[1],/margin\s*:\s*0\s*(?:;|$)/,
    'the global canvas auto margin must not offset a fixed overlay');
});
function source(cols=10,rows=10){return {cols,rows,canvas:{width:cols*4,height:rows*4},rect:{left:10,top:20,width:cols*10,height:rows*10},clipRect:{left:0,top:0,width:500,height:500}};}
const viewport={left:0,top:0,width:500,height:500};
test('unhidden field keeps exact source rectangle and original coordinates',()=>{
  const model=Model.create({rows:10,cols:10}),src=source(),g=View.geometry(src,model,viewport);
  assert.deepEqual(g.field,src.rect);
  assert.deepEqual(View.hit(g,model,35,62),{col:2,row:4,visibleCol:2,visibleRow:4});
  assert.equal(View.hit(g,model,110,70),null);
});
test('collapse closes both gaps and centers columns without moving first row',()=>{
  const model=Model.create({rows:10,cols:10}),src=source();
  model.hideRange('cols',3,5);model.hideRange('rows',2,3);
  const g=View.geometry(src,model,viewport);
  assert.deepEqual(g.field,{left:25,top:20,width:70,height:80});
  assert.deepEqual(View.hit(g,model,56,41),{col:6,row:4,visibleCol:3,visibleRow:2});
  const ts=View.tiles(src,model,g);assert.equal(ts.length,4);
  assert.equal(ts.reduce((n,t)=>n+t.dw*t.dh,0),5600);
  assert.equal(ts[3].sx,24);assert.equal(ts[3].sy,16);
});
test('viewport clipping trims source rectangles and never allocates field-sized geometry',()=>{
  const model=Model.create({rows:1000000,cols:1000000}),src=source(1000000,1000000);
  src.rect.left=-12345;src.rect.top=-54321;src.clipRect={left:0,top:0,width:300,height:200};
  const g=View.geometry(src,model,viewport),ts=View.tiles(src,model,g);
  assert.deepEqual(g.clip,{left:0,top:0,width:300,height:200});assert.equal(ts.length,1);
  assert.equal(ts[0].dw,300);assert.equal(ts[0].dh,200);
  assert.equal(ts[0].sx,4938);assert.equal(ts[0].sy,21728.4);
});
test('fractional clipping keeps pixel scale at a seam',()=>{
  const runs=[{originalStart:0,visibleStart:0,length:2},{originalStart:6,visibleStart:2,length:4}];
  assert.deepEqual(View.clipRuns(runs,0,10,15,20),[
    {originalStart:1.5,visibleStart:1.5,length:.5},
    {originalStart:6,visibleStart:2,length:1.5}]);
});
test('layer canvas offsets are clipped in original coordinates, then projected',()=>{
  const model=Model.create({rows:10,cols:10}),src=source();model.hideRange('cols',3,5);
  const ts=View.tiles(src,model,View.geometry(src,model,viewport));
  const result=View.layerTiles(src,ts,{canvas:{width:40,height:60},rect:{left:70,top:40,width:20,height:30}});
  assert.deepEqual(result,[{sx:0,sy:0,sw:40,sh:60,dx:30,dy:20,dw:20,dh:30}]);
});
test('selection span omits hidden cells and rejects wholly hidden selection',()=>{
  const model=Model.create({rows:10,cols:10});model.hideRange('cols',3,5);
  assert.deepEqual(View.selectedSpan(model.visibleRuns('cols'),2,7),[2,5]);
  assert.equal(View.selectedSpan(model.visibleRuns('cols'),3,5),null);
});
test('all-hidden field has no invalid draw tiles or coordinate hits',()=>{
  const model=Model.create({rows:10,cols:10}),src=source();model.hideRange('rows',0,9);
  const g=View.geometry(src,model,viewport);
  assert.deepEqual(View.tiles(src,model,g),[]);assert.equal(View.hit(g,model,10,20,true),null);
  assert.equal(model.seams('rows')[0].at,0);
});
function mockContext(){
  const calls=[];return {calls,save(){calls.push(['save']);},restore(){calls.push(['restore']);},
    beginPath(){calls.push(['beginPath']);},rect(...args){calls.push(['rect',...args]);},clip(){calls.push(['clip']);},
    drawImage(...args){calls.push(['drawImage',...args]);},setTransform(...args){calls.push(['setTransform',...args]);},
    clearRect(...args){calls.push(['clearRect',...args]);},getImageData(x,y,w,h){calls.push(['getImageData',x,y,w,h]);return {data:new Uint8ClampedArray([255,255,255,127])};},
    putImageData(...args){calls.push(['putImageData',...args]);}};
}
function mountedView(src,model){
  const ctx=mockContext();ctx.fillRect=(...args)=>ctx.calls.push(['fillRect',...args]);
  ctx.strokeRect=(...args)=>ctx.calls.push(['strokeRect',...args]);
  const nodes=[];
  function element(){return {style:{},classList:{toggle(){},remove(){}},setAttribute(){},addEventListener(){},removeEventListener(){},
    appendChild(){},remove(){},getContext(){return ctx;}};}
  const win={innerWidth:500,innerHeight:500,devicePixelRatio:1,addEventListener(){},removeEventListener(){}};
  const doc={defaultView:win,body:{appendChild(n){nodes.push(n);}},createElement:element,addEventListener(){},removeEventListener(){}};
  const host=element();host.ownerDocument=doc;
  return {view:View.mount({host,model,getSource:()=>src}),ctx,overlay:nodes[0]};
}
for(const gpu of [false,true])test((gpu?'GPU adapter':'CPU canvas')+' stays under a selection-only overlay and paints after collapse',()=>{
  const src=source(),model=Model.create({rows:10,cols:10});
  const gpuCalls=[];src.baseVisible=false;
  src.layers=[gpu?{drawTile(ctx,t){gpuCalls.push(t);ctx.drawImage('GPU tile',t.dx,t.dy,t.dw,t.dh);}}:{canvas:src.canvas,rect:src.rect}];
  const {view,ctx,overlay}=mountedView(src,model);
  assert.equal(overlay.hidden,true);
  view.setMode('rows');assert.equal(overlay.hidden,true,'activating mode does not cover originals');
  view.pointerDown({button:0,pointerId:1,clientX:30,clientY:45});
  view.pointerUp({pointerId:1,clientX:30,clientY:65});
  assert.equal(overlay.hidden,false);
  assert.equal(ctx.calls.filter(c=>c[0]==='drawImage').length,0,'selection does not replace CPU or GPU originals');
  assert.equal(ctx.calls.filter(c=>c[0]==='strokeRect').length>0,true);
  assert.deepEqual(model.hiddenRows,[],'selection alone never hides rows');
  ctx.calls.length=0;
  assert.equal(view.hide('rows'),true);
  assert.ok(ctx.calls.some(c=>c[0]==='drawImage'),'collapsed projection paints the original source');
  if(gpu)assert.ok(gpuCalls.length,'collapsed GPU source is routed through its tile painter');
  assert.deepEqual(model.hiddenRows,[[2,4]]);
  view.revealAll();model.clear();view.render();
  assert.equal(overlay.hidden,true,'revealing and clearing returns to originals');
  view.destroy();
});
test('custom tile painter is clipped to every destination piece with layer opacity',()=>{
  const ctx=mockContext(),src=source(),pieces=[{dx:1,dy:2,dw:3,dh:4},{dx:8,dy:9,dw:2,dh:6}],seen=[];
  View.drawLayer(ctx,src,pieces,{opacity:.4,drawTile(c,t,s){seen.push([c.globalAlpha,t,s]);assert.equal(c.calls.at(-1)[0],'clip');}});
  assert.equal(seen.length,2);assert.equal(seen[0][0],.4);assert.equal(seen[0][1],pieces[0]);assert.equal(seen[1][2],src);
  assert.deepEqual(ctx.calls.filter(c=>c[0]==='rect'),[['rect',1,2,3,4],['rect',8,9,2,6]]);
});
test('tinted custom painter uses viewport scratch dimensions and applies opacity at composition',()=>{
  const ctx=mockContext(),sg=mockContext(),scratch={width:0,height:0,getContext(){return sg;}},src=source(1000000,1000000);
  let alpha;
  View.drawLayer(ctx,src,[{dx:0,dy:0,dw:100,dh:80}],{opacity:.25,tint:'#ff0000',drawTile(c){alpha=c.globalAlpha;}},
    {scratch,width:100,height:80,dpr:2});
  assert.equal(scratch.width,200);assert.equal(scratch.height,160);assert.equal(alpha,1);assert.equal(ctx.globalAlpha,.25);
  const pixels=sg.calls.find(c=>c[0]==='putImageData')[1].data;assert.deepEqual([...pixels],[255,0,0,127]);
  assert.deepEqual(ctx.calls.find(c=>c[0]==='drawImage').slice(2),[0,0,200,160,0,0,100,80]);
});
test('local tint preserves luminance and alpha exactly like the layers service',()=>{
  const layers=require('./mayatnik-layers.js'),bytes=new Uint8ClampedArray([255,255,255,255,200,60,10,128,90,70,30,0]);
  assert.deepEqual(View.tintPixels(bytes,'#34abef'),layers.tintPixels(bytes,'#34abef'));
  assert.deepEqual([...bytes],[255,255,255,255,200,60,10,128,90,70,30,0]);
});
