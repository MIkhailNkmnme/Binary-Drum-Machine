const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Sequences=require('./mayatnik-sequences.js');
const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
function storage(){const values=new Map();return{getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,value),values};}
test('default matches the Hub compressed Pascal mod2 sequence and current row count up to512',()=>{
 const memory=storage(),api=Sequences.create(memory,{rows:6});assert.deepEqual(api.rows,['1','11','101','1111','10001','110011']);assert.equal(api.snapshot().source,'serp');assert.equal(Sequences.create(storage(),{rows:100000}).rows.length,512);
 const hub=fs.readFileSync(__dirname+'/../index.html','utf8'),start=hub.indexOf("            const SERP_ROWS = ['1'];"),end=hub.indexOf('            const ROW_PATTERNS',start),context={HUB_ROWS:new Array(64)};vm.runInNewContext(hub.slice(start,end)+';globalThis.rows=SERP_ROWS;',context);assert.deepEqual(Sequences.sierpinski(64),Array.from(context.rows));
});
test('saved user rows and explicit empty sequence survive recreation without regeneration',()=>{
 const memory=storage(),api=Sequences.create(memory,{rows:4});api.setText('001\n110\n1');assert.deepEqual(Sequences.create(memory,{rows:200}).rows,['001','110','1']);api.setText('');const again=Sequences.create(memory,{rows:200});assert.deepEqual(again.rows,[]);assert.equal(again.snapshot().source,'user');
});
test('invalid input and limits report errors without truncating or changing saved rows',()=>{
 const memory=storage(),api=Sequences.create(memory,{rows:4}),saved=memory.getItem(Sequences.KEY);for(const text of ['010\n10x','01 10','1\n\n0','<script>','1'.repeat(2100001)]){assert.throws(()=>api.setText(text));assert.equal(memory.getItem(Sequences.KEY),saved);}for(const n of [0,2049,3.5])assert.throws(()=>api.generate(n));
});
test('storage failure leaves last accepted sequence and lets an editor retain the draft',()=>{
 const memory=storage(),api=Sequences.create(memory,{rows:3});memory.setItem=()=>{throw Error('quota');};assert.throws(()=>api.setText('0'),/сохранить/);assert.deepEqual(api.rows,['1','11','101']);
});
test('corrupt saved data stays intact until explicit user replacement',()=>{
 const memory=storage();memory.setItem(Sequences.KEY,'broken');const api=Sequences.create(memory);assert.ok(api.snapshot().error);assert.equal(memory.getItem(Sequences.KEY),'broken');api.setText('01');assert.deepEqual(api.rows,['01']);assert.equal(api.snapshot().error,'');
});
test('frame matches update readonly highlights while preserving editor identity, draft and caret',()=>{
 const dom=new JSDOM('<section></section>'),pane=dom.window.document.querySelector('section'),api=Sequences.create(storage(),{rows:3}),view=Sequences.mount(pane,api);try{
 const editor=pane.querySelector('textarea');editor.value='010\n111';editor.dispatchEvent(new dom.window.Event('input'));editor.focus();editor.setSelectionRange(2,4);
 api.setMatches({enabled:true,active:true,pattern:'initial',mode:'row',frame:12,found:[{i:1,r:7,vn:'инв'}]});assert.equal(pane.querySelector('textarea'),editor);assert.equal(editor.value,'010\n111');assert.equal(editor.selectionStart,2);assert.equal(editor.selectionEnd,4);assert.equal(pane.querySelectorAll('.is-found').length,1);assert.equal(pane.querySelector('.is-found').dataset.sequenceRow,'1');
 api.setMatches({enabled:true,active:true,pattern:'initial',mode:'diag',frame:13,found:[{i:2,r:9}]});assert.equal(pane.querySelector('.is-found').dataset.sequenceRow,'2');assert.equal(editor.selectionStart,2);
 pane.querySelector('[data-sequence-save]').click();assert.deepEqual(api.rows,['010','111']);api.setMatches({enabled:false,active:false,found:[]});assert.equal(pane.querySelectorAll('.is-found').length,0);
 }finally{view.destroy();dom.window.close();}
});
test('generator replaces the editor intentionally and simple modes show their actual found runs',()=>{
 const dom=new JSDOM('<section></section>'),pane=dom.window.document.querySelector('section'),api=Sequences.create(storage(),{rows:3}),view=Sequences.mount(pane,api);try{
 const editor=pane.querySelector('textarea');editor.value='0';editor.dispatchEvent(new dom.window.Event('input'));pane.querySelector('input[type=number]').value='2';[...pane.querySelectorAll('button')].find(b=>b.textContent==='Серпинский 90').click();assert.equal(editor.value,'1\n11');
 api.setMatches({enabled:true,active:true,pattern:'zeros',mode:'row',frame:2,count:1,found:[{n:5,r:4,text:'00000'}]});assert.equal(pane.querySelector('.is-found code').textContent,'00000');assert.equal(editor.value,'1\n11');
 }finally{view.destroy();dom.window.close();}
});
test('two document views share the same store; closing one does not break the other',()=>{
 const api=Sequences.create(storage(),{rows:2}),a=new JSDOM('<section></section>'),b=new JSDOM('<section></section>'),av=Sequences.mount(a.window.document.querySelector('section'),api),bv=Sequences.mount(b.window.document.querySelector('section'),api);try{api.setText('101');assert.equal(a.window.document.querySelector('textarea').value,'101');assert.equal(b.window.document.querySelector('textarea').value,'101');bv.destroy();api.setText('0');assert.equal(a.window.document.querySelector('textarea').value,'0');}finally{av.destroy();a.window.close();b.window.close();}
});
test('sequence storage is automatically included in the complete backup',()=>{const codec=require('./mayatnik-backup-codec.js');assert.equal(codec.isLocalKey(Sequences.KEY),true);});
