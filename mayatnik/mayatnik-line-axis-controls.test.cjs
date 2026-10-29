const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
test('free mirror hidden state overrides generic canvas display',()=>{assert.match(html,/\.may-mir\[hidden\]\{display:none\}/);});
// Shared main/additional pointer and button regressions live in manual-lines-view.test.cjs.
test('manual axis Delete and Backspace accept button focus while preserving text input and composition',()=>{
 const line=html.split(/\r?\n/).find(l=>l.includes('&& removeSelectedAxes()'));
 for(const key of ['Delete','Backspace'])for(const target of ['button','canvas','input','select','textarea','contenteditable','textbox'])for(const composing of [false,true]){
  let removed=0,prevented=0;const editable=['input','select','textarea','contenteditable','textbox'].includes(target);
  const c={e:{key,defaultPrevented:false,isComposing:composing,target:{closest:()=>editable?{}:null},preventDefault:()=>prevented++},axisSelected:1,templateDragging:null,removeSelectedAxes:()=>{removed++;return true;}};vm.createContext(c);vm.runInContext('(function(){'+line+'})()',c);
  assert.equal(removed,editable||composing?0:1,key+'/'+target+'/'+composing);assert.equal(prevented,removed);
 }
});
