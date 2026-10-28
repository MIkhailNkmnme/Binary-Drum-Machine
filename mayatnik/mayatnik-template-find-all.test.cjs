const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
global.MayatnikTemplateMatcher=require('./mayatnik-template-matcher.js');
const Engine=require('./mayatnik-template-engine.js'),html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function production(name){const at=html.indexOf('  function '+name+'('),start=html.indexOf('{',at);let depth=1,i=start+1;for(;depth;i++){if(html[i]==='{')depth++;if(html[i]==='}')depth--;}return html.slice(at,i);}
test('unsaved field shape uses the real matcher and existing all-match selection without choosing or inserting a library entry',async()=>{
  const field={width:4,height:2,data:Int8Array.from([1,0,1,0,0,1,0,1])},original=field.data.slice(),shape={rk:1,parts:[{width:2,height:2,data:[9,0,0,9]}]},entries=[];let chosen=0,stopped=0,focus,edited;
  const api=Engine.create({entries:()=>entries,field:async()=>field,current:f=>f===field,choose(){chosen++;},stop(){stopped++;},redrawSelection(){},shapeInstances:()=>['field:a','field:b'],focus:r=>focus=r,edit:async selection=>edited=selection});
  const state=await api.selectShape(shape);assert.equal(state.count,5);assert.equal(state.selectedId,null);assert.equal(state.busy,false);assert.equal(chosen,0);assert.equal(stopped,1);assert.equal(entries.length,0);
  assert.equal(api.getSelection().count,3);assert.deepEqual(api.getSelection().instances,['field:a','field:b']);assert.equal(api.getSelection().selectedCount,6);assert.deepEqual(field.data,original);assert.deepEqual(focus.instances,['field:a','field:b']);assert.equal(await api.colour('#123456'),true);assert.equal(edited.count,3);
});
test('temporary selection shares cancellation and area-limit protection with saved templates',async()=>{
  const shape={rk:1,parts:[{width:1,height:1,data:[9]}]},field={width:2,height:1,data:Int8Array.from([0,1])};let resolve,allowed=true;
  const api=Engine.create({entries:()=>[],selectionAllowed:()=>allowed,selectionMessage:()=> 'limit',field:()=>new Promise(r=>resolve=r),current:f=>f===field,stop(){},redrawSelection(){}});
  const pending=api.selectShape(shape);api.clear();resolve(field);await pending;assert.equal(api.getSelection(),null);assert.equal(api.getState().busy,false);
  allowed=false;const state=await api.selectShape(shape);assert.equal(state.message,'limit');assert.equal(api.getSelection(),null);
});
function rightClick(){
  let handler,taken=0,cleared=0,lines=0;const c={wrap:{addEventListener:(kind,fn)=>handler=fn},templateContextSkip:false,templateDragging:null,templatePickEnabled:false,img:{width:20,height:10},cv:{getBoundingClientRect:()=>({left:0,top:0,width:20,height:10})},hitTemplate:()=>null,f:{},st:{userLines:[]},nearestUserLine:()=>0,axisSelected:0,axisSelTo(){lines++;},axisSelOut(){lines++;},axisLinesSync(){},queueDigits(){},takeColourAt:()=>{taken++;return true;},window:{mayTemplateLibrary:{clear(){cleared++;}}}};
  vm.createContext(c);const at=html.indexOf("  wrap.addEventListener('contextmenu',e=>{"),end=html.indexOf('  // v0.309:',at);vm.runInContext(html.slice(at,end),c);
  return {c,click:()=>handler({clientX:2,clientY:3,preventDefault(){}}),get taken(){return taken;},get cleared(){return cleared;},get lines(){return lines;}};
}
test('right click extracts field areas with left-selection mode off, preserves placed-template priority and axis selection',()=>{
  const raw=rightClick();raw.click();assert.equal(raw.taken,1);assert.equal(raw.cleared,1);assert.equal(raw.c.templatePickEnabled,false);
  const placed=rightClick();placed.c.st.userLines=[[]];placed.c.hitTemplate=()=>({item:{}});placed.click();assert.equal(placed.taken,1);assert.equal(placed.lines,0);
  const axis=rightClick();axis.c.st.userLines=[[]];axis.click();assert.equal(axis.lines,1);assert.equal(axis.taken,0);
});
test('context menu during or immediately after dragging never selects a new area',()=>{
  const f=rightClick();f.c.templateDragging={moved:true};f.click();assert.equal(f.taken,0);f.c.templateDragging=null;f.c.templateContextSkip=true;f.click();assert.equal(f.taken,0);assert.equal(f.c.templateContextSkip,false);f.click();assert.equal(f.taken,1);
});
test('shape matching includes independent visible copies and respects hidden, skipped and oversized templates',()=>{
  const mask={width:2,height:2,data:[9,0,0,9]},item=id=>({id,view:{visible:true},parts:[{mask}]}),a=item('a'),b=item('b'),hidden=item('hidden'),skipped=item('skip'),large=item('large'),layer=item('layer');hidden.view.visible=false;
  const c={templateItems:[a,b,hidden,skipped,large,layer],RK:1,MayatnikTemplateMatcher:global.MayatnikTemplateMatcher,templateSelectionSkipped:t=>t===skipped,templateItemAllowed:t=>t!==large,window:{mayLayers:{get:id=>({visible:id!=='template:layer'})}}};vm.createContext(c);vm.runInContext(production('templateShapeInstances'),c);
  assert.deepEqual([...c.templateShapeInstances({rk:1,parts:[mask]})],['a','b']);
});
test('Find all is present in the main Templates group and uses the active snapshot without saving the library',async()=>{
  const menu=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8'),at=menu.indexOf("  { const row = ptGroup('Шаблоны')"),end=menu.indexOf('railR.style.setProperty',at);assert.match(menu.slice(at,end),/bTemplateFindAll/);assert.match(html,/id="bTemplateFindAll" disabled title="Найти и выделить все такие же шаблоны"/);
  const nodes={bTemplateFindAll:{},paintCacheInfo:{}},shape={parts:[]};let requested;
  const c={$:id=>nodes[id],colourTemplate:{},templateItemAllowed:()=>true,templateSnapshot:()=>shape,window:{mayTemplateLibrary:{selectShape:async value=>{requested=value;return{message:'Найдено: 3'};}}}};
  vm.createContext(c);const start=html.indexOf("  $('bTemplateFindAll').onclick="),stop=html.indexOf('  window.mayTemplateLibrary=',start);vm.runInContext(html.slice(start,stop),c);await nodes.bTemplateFindAll.onclick();assert.equal(requested,shape);assert.equal(nodes.paintCacheInfo.textContent,'Найдено: 3');
});
