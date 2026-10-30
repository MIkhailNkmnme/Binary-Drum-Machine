const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Transient=require('./mayatnik-template-transient.js'),html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function canvas(){
  const calls=[],node={width:0,height:0,style:{},setAttribute(){},getContext:()=>ctx},ctx={calls,save(){},restore(){},setTransform(){calls.length=0;},fillRect(x,y,w,h){calls.push({x,y,w,h,colour:this.fillStyle});}};
  return {node,ctx};
}
function pixels(calls,width,height){const out=Array(width*height).fill(null);for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(const r of calls)if(x+.5>=r.x&&x+.5<r.x+r.w&&y+.5>=r.y&&y+.5<r.y+r.h)out[y*width+x]=r.colour;return out;}
function fixture(gpu=false){
  const output=canvas(),source=Int8Array.from({length:60},(_,q)=>q%2),paint=Uint32Array.from({length:60},(_,q)=>q+9),mask={width:3,height:2,data:Uint32Array.of(9,0,8,7,6,0)},item={id:'mirror',matchOrientation:'mirror',parts:[{mask,ox:0,rect:{x:2,y:2,width:3,height:2}}],view:{visible:true}},other={id:'placed',parts:[{mask:{width:1,height:1,data:Uint32Array.of(5)},ox:0,rect:{x:6,y:4,width:1,height:1}}],view:{visible:true}},items=[item,other],states=[];
  const c={MayatnikTemplateTransient:Transient,MayatnikJoinedRomb:require('./mayatnik-joined-romb.js'),window:{mayLayers:{get:id=>id==='template:placed'?{x:1,y:0,visible:true,opacity:100}:null}},document:{createElement:()=>output.node,body:{append:n=>states.push(n)}},f:{W:10,H:6,val:source},geo:{anchor:4},st:{view:'bits',joined180:false,parity:{}},k:7,VX:0,VW:10,VH:6,RG:0,RK:1,EMPTY:[0,0,0],gpuBig:gpu?{fresh:true,k:7}:null,img:gpu?null:{width:10,height:6,data:new Uint8ClampedArray(paint.buffer)},fillMask:paint,templateItems:items,templatePickedIds:new Set(items.map(t=>t.id)),colourTemplate:item,templateDragging:null,templateHover:{},DPR:()=>1,zoom:1,origin:{left:0,top:0},scale:()=>c.zoom,wrap:{clientWidth:30,clientHeight:30,getBoundingClientRect:()=>({left:0,top:0})},cv:{getBoundingClientRect:()=>c.origin},pickedTemplates:()=>items.filter(t=>c.templatePickedIds.has(t.id)),templateRect:part=>part.rect,joinedOn:()=>c.st.joined180,dispW:()=>10,dispH:()=>c.st.joined180?12:6,queueDigits(){},savePaint(){throw Error('temporary erasure cannot persist');},save(){throw Error('temporary erasure cannot persist');},pushHistory(){throw Error('temporary erasure cannot enter history');}};
  vm.createContext(c);const a=html.indexOf('  const templateTransient=');vm.runInContext(html.slice(a,html.indexOf('  function removeSelectedTemplate(',a)),c);
  return {c,output,items,source,paint,api:c.window.mayTemplateTransient};
}
test('logical silhouette snapshots holes, clipping, transforms and independent selected shapes exactly',()=>{
 const t=Transient.create(),owner={};t.sync({owner,key:'a'});const mask={width:3,height:2,data:Uint32Array.of(1,0,1,1,1,0)};
 t.hide([{mask,rect:{x:1,y:1,width:6,height:4},clip:{x:2,y:0,width:6,height:6}}],['a']);mask.data.fill(0);
 const out=canvas();t.draw(out.ctx,{scale:1});const actual=pixels(out.ctx.calls,9,7);
 for(let y=0;y<7;y++)for(let x=0;x<9;x++){const expected=y>=1&&y<3&&(x===2||x===5||x===6)||y>=3&&y<5&&x>=2&&x<5;assert.equal(actual[y*9+x]!==null,expected,`${x},${y}`);}
 assert.equal(t.contains(3.5,1.5),false);assert.equal(t.contains(5.5,1.5),true);assert.equal(t.has('a'),true);
});
test('Delete uses the same exact visual mask over CPU and GPU without touching source, paint, templates or saved selection',()=>{
 for(const gpu of [false,true]){const f=fixture(gpu),before={source:[...f.source],paint:[...f.paint],items:JSON.stringify(f.items),picked:[...f.c.templatePickedIds]};
  assert.equal(f.c.temporarilyHideSelectedTemplates(),true);const actual=pixels(f.output.ctx.calls,10,6),expected=[22,24,32,33,47];assert.deepEqual(actual.flatMap((v,q)=>v?[q]:[]),expected);
  assert.equal(f.api.hidden(f.items[0]),true);assert.equal(f.api.hidden(f.items[1]),true);assert.equal(f.c.temporarilyHideSelectedTemplates(),false);
  assert.deepEqual([...f.source],before.source);assert.deepEqual([...f.paint],before.paint);assert.equal(JSON.stringify(f.items),before.items);assert.deepEqual([...f.c.templatePickedIds],before.picked);
 }
});
test('pan and zoom keep logical holes while changing their screen position and size',()=>{
 const f=fixture();f.c.temporarilyHideSelectedTemplates();f.c.zoom=2;f.c.origin={left:3,top:4};f.api.draw();
 assert.equal(f.api.hidden(f.items[0]),true);const actual=pixels(f.output.ctx.calls,30,30);
 assert.equal(actual[8*30+7],'rgb(0,0,0)');assert.equal(actual[8*30+9],null);assert.equal(actual[8*30+11],'rgb(0,0,0)');
 assert.equal(f.output.node.style.visibility,'visible','quick navigation must not hide this service overlay');
});
test('frame, projection, parity and source changes discard the mask permanently, including a return to the original frame',()=>{
 for(const change of [c=>c.k++,c=>c.st.view='digits',c=>c.st.joined180=true,c=>c.st.viewUpsideDown=true,c=>c.st.parity.cellsOdd=false,c=>c.f={...c.f},c=>c.VX++]){
  const f=fixture(true);f.c.temporarilyHideSelectedTemplates();change(f.c);f.api.sync();assert.equal(f.output.node.style.display,'none');assert.equal(f.api.hidden(f.items[0]),false);
  f.c.k=7;f.api.draw();assert.equal(f.output.node.style.display,'none');assert.equal(f.api.contains(2.5,2.5),false);
 }
});
test('joined 180 erasure restores the actual top and bottom backgrounds, including a part crossing the join',()=>{
 const f=fixture(true);f.c.st.joined180=true;f.items[0].parts[0].rect.y=5;f.c.temporarilyHideSelectedTemplates();
 const colours=require('./mayatnik-joined-romb.js').backgrounds.map(u=>'rgb('+(u&255)+','+(u>>>8&255)+','+(u>>>16&255)+')'),actual=pixels(f.output.ctx.calls,10,12);
 assert.equal(actual[5*10+2],colours[0]);assert.equal(actual[6*10+2],colours[1]);assert.equal(actual[5*10+3],null);
});
test('fresh page state is visible; erasure is absent from work/cache/history serialization and does not disable persistent Find all',()=>{
 const first=fixture();first.c.temporarilyHideSelectedTemplates();const restored=fixture();assert.equal(restored.api.hidden(restored.items[0]),false);assert.equal(restored.api.contains(2.5,2.5),false);
 for(const [a,b]of [['  function paintSnapshot(', '  function savePaint('],['  function sceneSnapshot(', '  function ']]){const start=html.indexOf(a),end=html.indexOf(b,start+a.length);assert.ok(start>=0&&end>start);assert.doesNotMatch(html.slice(start,end),/templateTransient|temporarilyHide/);}
 const start=html.indexOf('  function temporarilyHideSelectedTemplates('),end=html.indexOf('  function removeSelectedTemplate(',start);assert.doesNotMatch(html.slice(start,end),/savePaint\(|pushHistory\(|templateFollow\.|\.view\s*=|fillMask\s*=|f\.val/);
});
test('render and hit paths suppress erased figures, their bounding boxes and axes without suppressing unrelated templates',()=>{
 const f=fixture();f.c.temporarilyHideSelectedTemplates();f.items.push({id:'visible',view:{visible:true},parts:[]});assert.equal(f.api.hidden(f.items[2]),false);
 for(const name of ['paintTemplate','drawTemplateDim','drawTemplateAxes','hitTemplate']){const start=html.indexOf('  function '+name+'('),end=html.indexOf('\n  function ',start+3);assert.match(html.slice(start,end),/mayTemplateTransient\?\.hidden/);}
 assert.match(html,/colourTemplate&&templateVisible&&!window\.mayTemplateTransient\?\.hidden\(colourTemplate\)/);
 assert.match(html,/function draw\(\) \{\s*try\{\s*window\.mayTemplateTransient\?\.sync\(\)/);
 assert.match(html,/parityOverlayMask\(\);cellSelectionView\?\.render\(\);window\.mayTemplateTransient\?\.draw\(\)/);
});
test('actual hit testing cannot select an erased source silhouette but still finds an unrelated visible copy',()=>{
 const f=fixture(),c=f.c;f.c.temporarilyHideSelectedTemplates();const visible={id:'visible',view:{visible:true},parts:[{mask:{width:1,height:1,data:Uint32Array.of(5)},ox:0,rect:{x:0,y:0,width:1,height:1}}]};f.items.push(visible);
 Object.assign(c,{rememberTemplate(){},MayatnikTemplate:require('./mayatnik-template.js'),templateSelectionSkipped:()=>false});
 const start=html.indexOf('  function hitTemplate('),end=html.indexOf('  // v0.037: курсор',start);vm.runInContext(html.slice(start,end),c);
 assert.equal(c.hitTemplate(2.5,2.5),null);assert.equal(c.hitTemplate(.5,.5).item,visible);c.k++;assert.equal(c.hitTemplate(2.5,2.5).item,f.items[0]);
});
test('cell-selection Delete capture takes priority over the template hotkey and text editing is protected',()=>{
 let capture,bubble,hides=0;const c={document:{addEventListener:(_,fn)=>capture=fn},addEventListener:(_,fn)=>bubble=fn,cellHidden:()=>false,cellSelectionView:{mode:'cells'},cellSwallow:e=>e.preventDefault(),colourTemplate:{id:'a'},templatePickedIds:new Set(['a']),templateDragging:null,axisSelected:0,temporarilyHideSelectedTemplates:()=>hides++,$:()=>({click(){throw Error('Delete cannot invoke persistent Remove');}})};vm.createContext(c);
 const a=html.indexOf("  document.addEventListener('keydown',e=>{if(/^(INPUT|TEXTAREA|SELECT)"),b=html.indexOf('  let resetAllBusy=',a);assert.ok(a>0);vm.runInContext(html.slice(a,b),c);
 const x=html.lastIndexOf("  addEventListener('keydown', e => {",html.indexOf('// v0.104: Delete')),y=html.indexOf("  cv.addEventListener('pointermove'",x);vm.runInContext(html.slice(x,y),c);
 const event=()=>({key:'Delete',target:{tagName:'DIV',closest:()=>false},preventDefault(){this.defaultPrevented=true;}});
 let e=event();capture(e);bubble(e);assert.equal(hides,0);c.cellSelectionView.mode='off';e=event();capture(e);bubble(e);assert.equal(hides,1);
 for(const tagName of ['INPUT','TEXTAREA','SELECT']){e=event();e.target={tagName,closest:()=>true};capture(e);bubble(e);assert.equal(hides,1);}
 e=event();e.target={tagName:'DIV',isContentEditable:true,closest:()=>true};capture(e);bubble(e);assert.equal(hides,1);
});
test('the overlay is registered by the existing rotated-field service selector',()=>{
 const Rotation=require('./mayatnik-view-rotation.js');assert.ok(Rotation.LAYERS.split(',').includes('.may-layer-service'));const f=fixture();f.c.st.viewUpsideDown=true;f.c.temporarilyHideSelectedTemplates();assert.equal(f.output.node.className,'may-layer-service');assert.equal(f.output.node.style.zIndex,'3');
});
