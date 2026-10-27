const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
test('free mirror hidden state overrides generic canvas display',()=>{assert.match(html,/\.may-mir\[hidden\]\{display:none\}/);});
function host(){const handlers={},state={ztopRow:18,ztMir:0};let captures=0,prevented=0;
const c={ztl:{addEventListener:(n,fn)=>handlers[n]=fn,setPointerCapture:()=>captures++,classList:{add(){}}},st:state,save(){},zTopScroll(){},zTopLine(){},f:null};vm.createContext(c);
const start=html.indexOf("  ztl.addEventListener('pointerdown'");vm.runInContext(html.slice(start,html.indexOf('  // v0.365:',start)),c);
return {handlers,state,event(button){return {button:0,pointerId:1,target:{closest:selector=>button&&selector==='button'?{}:null},preventDefault:()=>prevented++};},counts:()=>({captures,prevented})};}
test('horizontal axis buttons keep their own click and do not start parent dragging or reset the row on double click',()=>{for(const name of ['add','delete','pin','mirror']){const h=host(),e=h.event(name);h.handlers.pointerdown(e);h.handlers.dblclick(e);assert.deepEqual(h.counts(),{captures:0,prevented:0},name);assert.equal(h.state.ztopRow,18,name);}});
test('horizontal axis label still starts drag and double click still resets the row',()=>{const h=host(),e=h.event(false);h.handlers.pointerdown(e);assert.deepEqual(h.counts(),{captures:1,prevented:1});h.handlers.dblclick(e);assert.equal(h.state.ztopRow,0);});
test('manual axis Delete and Backspace accept button focus while preserving text input and composition',()=>{
 const line=html.split(/\r?\n/).find(l=>l.includes('&& removeSelectedAxes()'));
 for(const key of ['Delete','Backspace'])for(const target of ['button','canvas','input','select','textarea','contenteditable','textbox'])for(const composing of [false,true]){
  let removed=0,prevented=0;const editable=['input','select','textarea','contenteditable','textbox'].includes(target);
  const c={e:{key,defaultPrevented:false,isComposing:composing,target:{closest:()=>editable?{}:null},preventDefault:()=>prevented++},axisSelected:1,templateDragging:null,removeSelectedAxes:()=>{removed++;return true;}};vm.createContext(c);vm.runInContext('(function(){'+line+'})()',c);
  assert.equal(removed,editable||composing?0:1,key+'/'+target+'/'+composing);assert.equal(prevented,removed);
 }
});
