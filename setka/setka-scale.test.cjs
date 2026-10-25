const test=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const Scale=require('./setka-scale.js');
const Frame=require('../_js/control-frame.js');
function fixture(cell='square'){
  const dom=new JSDOM('<div id="toolbar"></div><canvas></canvas>'),doc=dom.window.document,canvas=doc.querySelector('canvas');
  Object.defineProperties(canvas,{clientWidth:{value:600},clientHeight:{value:400}});
  const view={cell,s:8,ox:150,oy:50},rows=['101','10'];let saved=0,rendered=0,layouts=0;
  const scale=Scale.mount({canvas,view:()=>view,rows:()=>rows,layout:()=>{layouts++;return {hs:[-3,-2]};},save:()=>saved++,render:()=>rendered++,fit:()=>{if(!scale.locked())view.s=4;},dpr:()=>1.5});
  return {dom,doc,canvas,view,scale,rows,count:()=>({saved,rendered,layouts})};
}
test('axis centers the grid origin without resizing or walking the field',()=>{for(const cell of ['tri','rmb','square','ring']){const {view,scale,count}=fixture(cell);scale.hold();assert.equal(count().layouts,0);scale.set('axis',true);assert.equal(view.ox,300);assert.equal(view.s,8);assert.equal(count().layouts,0);}});
test('top and bottom anchor actual bounds independently in every shape',()=>{for(const cell of ['tri','rmb','square','ring']){const {view,scale,rows}=fixture(cell);const b=Scale.bounds(rows,{hs:[-3,-2]},cell);scale.set('top',true);assert.equal(view.oy+b.minY*view.s,10);scale.set('top',false);scale.set('bottom',true);assert.equal(view.oy+b.maxY*view.s,390);scale.zoom(12,100,100);assert.equal(view.oy+b.maxY*view.s,390);}});
test('both edges and the explicit block freeze wheel/zoom and expose a fit guard',()=>{for(const both of [false,true]){const {view,scale}=fixture();if(both){scale.set('top',true);scale.set('bottom',true);}else scale.set('lock',true);const old={...view};assert.equal(scale.locked(),true);assert.equal(scale.zoom(60,50,50),false);let prevented=false;scale.wheel({preventDefault(){prevented=true;},deltaY:-500,offsetX:5,offsetY:5});assert.equal(prevented,true);assert.equal(view.s,old.s);assert.equal(view.ox,old.ox);assert.equal(view.oy,old.oy);}});
test('quantized scale uses monitor pixels and powers 2 through 10; 1 is smooth',()=>{assert.equal(Scale.quantize(7.3,1,1.5),7.3);for(let base=2;base<=10;base++){const n=Scale.quantize(7.3,base,1.5);assert.ok(n>=2&&n<=160);assert.ok(Math.abs(Math.log(n*1.5)/Math.log(base)-Math.round(Math.log(n*1.5)/Math.log(base)))<1e-9);}});
test('small wheel events accumulate across quantization plateaus',()=>{const {view,scale}=fixture();scale.set('base',2);const start=view.s;for(let i=0;i<40;i++)scale.wheel({preventDefault(){},deltaY:-5,offsetX:100,offsetY:100});assert.ok(view.s>start);});
test('pinch uses the selected base and keeps the world point beneath the moving midpoint',()=>{
 for(let base=1;base<=10;base++){const {view,scale}=fixture();scale.set('base',base);const initial={s:view.s,ox:37,oy:49},start={x:100,y:120,distance:80};
  for(const current of [{x:130,y:145,distance:100},{x:150,y:160,distance:130},{x:200,y:200,distance:200}]){
   scale.gesture({start,current,view:initial});assert.equal(view.s,Scale.quantize(initial.s*current.distance/start.distance,base,1.5));
   assert.ok(Math.abs((current.x-view.ox)/view.s-(start.x-initial.ox)/initial.s)<1e-9);assert.ok(Math.abs((current.y-view.oy)/view.s-(start.y-initial.oy)/initial.s)<1e-9);
  }
 }
});
test('pinch obeys edge anchors, explicit block and the joint edge lock',()=>{
 const {view,scale}=fixture('ring'),g={start:{x:100,y:100,distance:40},current:{x:150,y:160,distance:120},view:{s:8,ox:20,oy:30}};
 scale.set('top',true);scale.gesture(g);assert.equal(view.oy-2*view.s,10);scale.set('bottom',true);const before={s:view.s,ox:view.ox,oy:view.oy};assert.equal(scale.gesture(g),false);assert.deepEqual({s:view.s,ox:view.ox,oy:view.oy},before);
 scale.set('top',false);scale.set('bottom',false);scale.set('lock',true);assert.equal(scale.gesture(g),false);
});
test('smooth wheel preserves the pixel under its pointer with no anchored edges',()=>{const {view,scale}=fixture();scale.set('base',1);const x=80,y=90,px=(x-view.ox)/view.s,py=(y-view.oy)/view.s;scale.wheel({preventDefault(){},deltaY:-20,offsetX:x,offsetY:y});assert.ok(Math.abs((x-view.ox)/view.s-px)<1e-9);assert.ok(Math.abs((y-view.oy)/view.s-py)<1e-9);});
test('source/menu controls use shared pair diamond and the existing Mayatnik multiplicity parts',()=>{const f=fixture(),{doc,scale,dom}=f;dom.window.ZerkControlFrame=Frame;scale.sourceControls(doc.querySelector('#toolbar'));
  assert.equal(doc.querySelectorAll('#setkaScaleSources button').length,5);let index=0;const items=scale.menuItems(e=>({pan:'p'+index++,source:e}));assert.equal(items.length,4);assert.equal(index,4);assert.equal(items[1].type,'pair');
  const rail=doc.createElement('div');rail.innerHTML='<div class="setka-scale-edges"><span class="gz-h0"></span><span class="gz-h1"></span></div><div data-source="setkaScaleBase"></div>';doc.body.append(rail);scale.decorate({el:rail});
  rail.querySelector('.zcf-pair-switch').click();assert.equal(scale.read().top,true);assert.equal(scale.read().bottom,true);assert.equal(rail.querySelector('.zcf-pair-switch').getAttribute('aria-pressed'),'true');rail.querySelector('.zcf-pair-switch').click();assert.equal(scale.read().top,false);
  const parts=rail.querySelectorAll('.may-snap-part');assert.equal(parts.length,4);parts[3].click();assert.equal(scale.read().base,3);parts[1].click();assert.equal(scale.read().base,1);
});
