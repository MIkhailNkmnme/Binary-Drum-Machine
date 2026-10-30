const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Sequences=require('./mayatnik-sequences.js');
const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
function storage(){const values=new Map();return{getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,value),values};}
test('default matches the Hub compressed Pascal mod2 sequence and current row count up to512',()=>{
 const memory=storage(),api=Sequences.create(memory,{rows:6});assert.deepEqual(api.rows,['1','11','101','1111','10001','110011']);assert.equal(api.snapshot().source,'serp');assert.equal(Sequences.create(storage(),{rows:100000}).rows.length,512);
 const hub=fs.readFileSync((process.env.SETKA_REPO||__dirname+'/..')+'/index.html','utf8'),start=hub.indexOf("            const SERP_ROWS = ['1'];"),end=hub.indexOf('            const ROW_PATTERNS',start),context={HUB_ROWS:new Array(64)};vm.runInNewContext(hub.slice(start,end)+';globalThis.rows=SERP_ROWS;',context);assert.deepEqual(Sequences.sierpinski(64),Array.from(context.rows));
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
 api.setMatches({enabled:true,active:true,pattern:'initial',mode:'row',searchScope:'row',frame:12,found:[{i:1,r:7,vn:'инв'}]});assert.equal(pane.querySelector('textarea'),editor);assert.equal(editor.value,'010\n111');assert.equal(editor.selectionStart,2);assert.equal(editor.selectionEnd,4);assert.equal(pane.querySelectorAll('.is-found').length,1);assert.equal(pane.querySelector('.is-found').dataset.sequenceRow,'1');
 api.setMatches({enabled:true,active:true,pattern:'initial',mode:'diag',searchScope:'diag',frame:13,found:[{i:2,r:9}]});assert.equal(pane.querySelector('.is-found').dataset.sequenceRow,'2');assert.equal(editor.selectionStart,2);
 pane.querySelector('[data-sequence-save]').click();assert.deepEqual(api.rows,['010','111']);api.setMatches({enabled:false,active:false,found:[]});assert.equal(pane.querySelectorAll('.is-found').length,0);
 }finally{view.destroy();dom.window.close();}
});
test('generator replaces the editor intentionally and simple modes show their actual found runs',()=>{
 const dom=new JSDOM('<section></section>'),pane=dom.window.document.querySelector('section'),api=Sequences.create(storage(),{rows:3}),view=Sequences.mount(pane,api);try{
 const editor=pane.querySelector('textarea');editor.value='0';editor.dispatchEvent(new dom.window.Event('input'));pane.querySelector('[aria-label="Число строк генератора"]').value='2';pane.querySelector('[data-sequence-generate]').click();assert.equal(editor.value,'1\n11');assert.deepEqual(api.rows,['1','11','101']);
 api.setMatches({enabled:true,active:true,pattern:'zeros',mode:'row',frame:2,count:1,found:[{n:5,r:4,text:'00000'}]});assert.equal(pane.querySelector('.is-found code').textContent,'00000');assert.equal(editor.value,'1\n11');
 }finally{view.destroy();dom.window.close();}
});
test('two document views share the same store; closing one does not break the other',()=>{
 const api=Sequences.create(storage(),{rows:2}),a=new JSDOM('<section></section>'),b=new JSDOM('<section></section>'),av=Sequences.mount(a.window.document.querySelector('section'),api),bv=Sequences.mount(b.window.document.querySelector('section'),api);try{api.setText('101');assert.equal(a.window.document.querySelector('textarea').value,'101');assert.equal(b.window.document.querySelector('textarea').value,'101');bv.destroy();api.setText('0');assert.equal(a.window.document.querySelector('textarea').value,'0');}finally{av.destroy();a.window.close();b.window.close();}
});
test('sequence storage is automatically included in the complete backup',()=>{const codec=require('./mayatnik-backup-codec.js');assert.equal(codec.isLocalKey(Sequences.KEY),true);});
test('elementary rules have known Wolfram rows and mirror 60 into 102',()=>{
 const rows={30:['1','111','11001','1101111','110010001'],60:['1','011','00101','0001111','000010001'],90:['1','101','10001','1010101','100000001'],150:['1','111','10101','1101011','100010001']};
 for(const [rule,expected]of Object.entries(rows))assert.deepEqual(Sequences.elementary({rule,count:5}),expected);
 assert.deepEqual(Sequences.elementary({rule:102,count:5}),rows[60].map(row=>[...row].reverse().join('')));
 assert.deepEqual(Sequences.elementary({rule:90,count:64,compact:true}),Sequences.sierpinski(64));
});
test('all 256 rules use every three-cell neighbourhood with correct bit numbering',()=>{
 for(let rule=0;rule<256;rule++)for(let pattern=0;pattern<8;pattern++){
  const seed=pattern.toString(2).padStart(3,'0');assert.equal(Sequences.elementary({rule,seed,count:2})[1][2],String((rule>>pattern)&1));
 }
 assert.deepEqual(Sequences.elementary({rule:1,seed:'0',count:4}),['0','111','00000','1111111']);
 assert.deepEqual(Sequences.elementary({rule:90,seed:'0010',count:2}),['0010','001010']);
});
test('generator rejects invalid inputs and oversized expanded fields before replacing anything',()=>{
 for(const options of [{rule:''},{rule:'  '},{rule:-1},{rule:256},{rule:1.5},{seed:''},{seed:' 1'},{seed:'10x'},{count:0},{count:2049},{count:2.5},{count:2048},{seed:'1'.repeat(2100001),count:1},{rule:30,compact:true},{seed:'01',compact:true}])assert.throws(()=>Sequences.elementary(options));
 assert.equal(Sequences.elementary({count:2048,compact:true}).length,2048);
 assert.equal(Sequences.elementary({count:1449}).reduce((sum,row)=>sum+row.length,0),2099601);
 assert.throws(()=>Sequences.elementary({count:1450}),/2100000/);
});
test('UI inserts rule drafts and exact original sequence, preserving applied rows until Apply',()=>{
 const dom=new JSDOM('<section></section>'),pane=dom.window.document.querySelector('section'),initial=['1','1','11','111','1000','10101'],api=Sequences.create(storage(),{rows:3,initialRows:initial}),view=Sequences.mount(pane,api);
 try{
  const editor=pane.querySelector('textarea'),select=pane.querySelector('select'),count=pane.querySelector('[aria-label="Число строк генератора"]'),seed=pane.querySelector('[aria-label="Начальная строка генератора из 0 и 1"]'),compact=pane.querySelector('input[type=checkbox]');
  select.value='30';select.dispatchEvent(new dom.window.Event('change'));count.value='5';assert.equal(compact.disabled,true);pane.querySelector('[data-sequence-generate]').click();assert.equal(editor.value,'1\n111\n11001\n1101111\n110010001');assert.deepEqual(api.rows,['1','11','101']);
  pane.querySelector('[data-sequence-save]').click();assert.deepEqual(api.rows,Sequences.elementary({rule:30,count:5}));
  select.value='initial';select.dispatchEvent(new dom.window.Event('change'));pane.querySelector('[data-sequence-generate]').click();assert.equal(editor.value,initial.join('\n'));initial[0]='0';api.initialRows[0]='0';assert.equal(api.initialRows[0],'1');
  api.setMatches({enabled:true,active:true,pattern:'initial',found:[],frame:4});assert.equal(editor.value,'1\n1\n11\n111\n1000\n10101');
  select.value='custom';select.dispatchEvent(new dom.window.Event('change'));seed.value='x';pane.querySelector('[data-sequence-generate]').click();assert.equal(editor.value,'1\n1\n11\n111\n1000\n10101');assert.match(pane.querySelector('.mtp-sequence-notice').textContent,/Начальная строка/);
 }finally{view.destroy();dom.window.close();}
});
test('library match summary and row tooltip distinguish columns and the two diagonals without losing a draft',()=>{
 const dom=new JSDOM('<section></section>'),pane=dom.window.document.querySelector('section'),api=Sequences.create(storage(),{rows:2}),view=Sequences.mount(pane,api);
 try{
  const editor=pane.querySelector('textarea');editor.value='000';editor.dispatchEvent(new dom.window.Event('input'));
  for(const [mode,label]of [['diag','по диагоналям ↘'],['antidiag','по противодиагоналям ↙'],['row','по рядам →'],['col','по столбцам ↓']]){
   api.setMatches({enabled:true,active:true,mode,pattern:'initial',found:[{i:0,r:2,dir:{diag:1,antidiag:-1,row:0,col:2}[mode],vn:''}],frame:8});assert.equal(pane.querySelector('.mtp-sequence-summary').textContent,'');assert.ok(pane.querySelector('.is-found').title.includes(require('./mayatnik-ochki-method.js').label({dir:{diag:1,antidiag:-1,row:0,col:2}[mode]})));assert.equal(editor.value,'000');
  }
 }finally{view.destroy();dom.window.close();}
});
test('one library sequence row retains both independent half matches and counts occurrences',()=>{
 const dom=new JSDOM('<section></section>'),pane=dom.window.document.querySelector('section'),api=Sequences.create(storage(),{rows:2}),view=Sequences.mount(pane,api);
 try{
  api.setMatches({enabled:true,active:true,mode:'col',pattern:'initial',halves:2,total:4,found:[{i:0,r:2,p:0},{i:0,r:4,p:1}],frame:8});const row=pane.querySelector('.is-found');assert.equal(pane.querySelectorAll('.is-found').length,1);assert.match(row.title,/левый полумаятник · строка 3/);assert.match(row.title,/правый полумаятник · строка 5/);assert.equal(pane.querySelector('.mtp-sequence-summary').textContent,'');
 }finally{view.destroy();dom.window.close();}
});
test('joined match titles use the displayed rhombus row and preserve row selection',()=>{
 const dom=new JSDOM('<section></section>'),pane=dom.window.document.querySelector('section'),api=Sequences.create(storage(),{rows:2}),view=Sequences.mount(pane,api);
 try{api.setMatches({enabled:true,active:true,joined:true,halves:1,total:2,mode:'snake',pattern:'initial',found:[{i:0,r:6,p:null}],frame:4});api.selectMatches({rowIndices:[0],matchIndices:[0],key:'joined'});assert.match(pane.querySelector('.is-found').title,/строка ромба 7/);assert.doesNotMatch(pane.querySelector('.is-found').title,/полумаятник/);assert.equal(pane.querySelector('.mtp-sequence-summary').textContent,'');assert.equal(pane.querySelector('.is-selected').dataset.sequenceRow,'0');}finally{view.destroy();dom.window.close();}
});
