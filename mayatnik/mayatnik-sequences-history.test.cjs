const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Sequences=require('./mayatnik-sequences.js');
const make=()=>Sequences.create(null,{rows:16});
const hit=i=>({i,r:i,c:0,n:i+1,dir:1,p:0});
const result=(frame,found,extra={})=>({enabled:true,active:true,pattern:'initial',mode:'diag',frame,total:16,found,...extra});
test('manual prefix state is transient, never creates a full finding, and clears on sequence/frame changes',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},api=Sequences.create(storage,{rows:2});api.setText('001101\n1010');const saved=storage.getItem(Sequences.KEY),events=[];api.subscribe(kind=>events.push(kind));
 api.setManualMatch({i:0,frame:758,n:6,matched:3,partial:true,complete:true,variant:'инв+рев'});assert.equal(api.snapshot().manualMatch.enabled,true);assert.equal(api.snapshot().manualMatch.matched,3);assert.deepEqual(api.snapshot().firstFinds,[]);assert.deepEqual(api.snapshot().foundHistory,[]);assert.equal(storage.getItem(Sequences.KEY),saved);assert.equal(Sequences.create(storage).snapshot().manualMatch,null);assert.equal(events.at(-1),'manual-match');
 api.setMatches(result(759,[]));assert.equal(api.snapshot().manualMatch,null);api.setManualMatch({i:1,frame:759,matched:4,found:true});assert.equal(api.snapshot().manualMatch.found,true);api.setManualMatch(null);assert.equal(api.snapshot().manualMatch,null);api.setManualMatch({i:1,matched:2,complete:false});assert.equal(api.snapshot().manualMatch.matched,0);api.setText('1');assert.equal(api.snapshot().manualMatch,null);assert.throws(()=>api.setManualMatch({i:2,matched:1}),/строка/);
});
test('real table maps original/reversed/inverse manual prefixes without losing long words, drafts, gold history or errors',()=>{
 const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom'),dom=new JSDOM('<aside id="mayatnikTemplatePanel"><section></section></aside>'),w=dom.window,pane=w.document.querySelector('section'),api=Sequences.create(null,{rows:2}),word='001101'+ '10'.repeat(253);api.setText('1\n'+word);const view=Sequences.mount(pane,api);
 try{const style=w.document.createElement('style');style.textContent=fs.readFileSync(__dirname+'/mayatnik-template-panel.css','utf8');w.document.head.append(style);const row=pane.querySelector('[data-sequence-row="1"]'),code=row.querySelector('code'),editor=pane.querySelector('textarea');editor.value='draft';editor.dispatchEvent(new w.Event('input'));const originalEditor=editor;
  api.setMatches(result(758,[hit(0)]));for(const variant of ['', 'инв','рев','инв+рев']){api.setManualMatch({i:1,frame:758,n:word.length,matched:4,partial:true,complete:true,variant});const prefix=code.querySelector('.mtp-manual-prefix'),reverse=variant.includes('рев');assert.equal(prefix.textContent,reverse?word.slice(-4):word.slice(0,4));assert.equal(code.textContent,word);assert.ok(code.title.startsWith(word));assert.equal(code.getAttribute('aria-label'),code.title);assert.match(code.title,/совпало 4 из 512/);assert.ok(row.classList.contains('is-manual-partial'));assert.equal(w.getComputedStyle(code).overflow,'hidden');assert.equal(w.getComputedStyle(code).textOverflow,'ellipsis');assert.equal(w.getComputedStyle(prefix).color,'rgb(255, 64, 64)');assert.ok(pane.querySelector('[data-sequence-row="0"]').classList.contains('is-found'));assert.equal(api.snapshot().firstFinds.length,1);assert.equal(api.snapshot().foundHistory.length,1);}
  api.setManualMatch({i:1,frame:758,matched:word.length,found:true,complete:true,variant:'рев'});assert.ok(row.classList.contains('is-manual-found'));assert.equal(code.querySelector('.mtp-manual-prefix'),null);assert.equal(code.textContent,word);api.setManualMatch(null);assert.equal(row.classList.contains('is-manual-found'),false);assert.equal(code.title,word);assert.equal(pane.querySelector('textarea'),originalEditor);assert.equal(editor.value,'draft');
  assert.doesNotMatch(pane.textContent,/Строки для «Начальной»|Своя последовательность|Сохранено\. Поиск использует эти строки\.|Поиск выключен\./);assert.equal(editor.getAttribute('aria-label'),'Строки своей последовательности');editor.value='bad';pane.querySelector('[data-sequence-save]').click();assert.match(pane.querySelector('.mtp-sequence-notice').textContent,/допустимы только/);assert.equal(api.rows[1],word);editor.value='10';pane.querySelector('[data-sequence-save]').click();assert.equal(pane.querySelector('.mtp-sequence-notice').textContent,'');assert.deepEqual(api.rows,['10']);
 }finally{view.destroy();w.close();}
});
test('table keeps old gold rows when a later frame finds a new row; field matches stay current',()=>{
 const api=make();api.setMatches(result(8,Array.from({length:8},(_,i)=>hit(i)),{foundEver:8,foundIndices:[0,1,2,3,4,5,6,7]}));
 api.setMatches(result(15,[hit(14)],{foundEver:9,foundIndices:[0,1,2,3,4,5,6,7,14]}));const state=api.snapshot();
 assert.deepEqual(state.foundHistory.map(e=>e.i),[0,1,2,3,4,5,6,7,14]);assert.deepEqual(state.matches.found.map(e=>e.i),[14]);assert.equal(state.foundHistory[0].frame,8);
 api.setMatches(result(16,[],{active:false,reason:'searching',foundEver:9,foundIndices:[0,1,2,3,4,5,6,7,14]}));assert.equal(api.snapshot().foundHistory.length,9);
});

test('search scope resets gold history, while frame changes and a later opposite-half find preserve it',()=>{
 const api=make();api.setMatches(result(8,[hit(2)],{halves:2,searchScope:'searchA',complete:true}));api.setMatches(result(9,[{...hit(2),p:1}],{halves:2,searchScope:'searchA',complete:true}));
 assert.deepEqual(api.snapshot().foundHistory[0].hits.map(h=>h.p),[0,1]);api.setMatches(result(10,[],{halves:2,searchScope:'searchA',complete:true}));assert.equal(api.snapshot().foundHistory.length,1);
 api.setMatches(result(11,[],{active:false,searchScope:'searchB'}));assert.equal(api.snapshot().foundHistory.length,0);
 api.setMatches(result(12,[hit(4)],{searchScope:'searchB',complete:false}));assert.equal(api.snapshot().foundHistory.length,0,'partial findings remain current-only');
 api.setMatches(result(12,[hit(4)],{searchScope:'searchB',complete:true}));assert.equal(api.snapshot().foundHistory.length,1);
});
test('turning off or applying a different sequence clears table history without retaining stale indices',()=>{
 const api=make();api.setMatches(result(8,[hit(7)],{foundEver:1,foundIndices:[7]}));api.setMatches({enabled:false,active:false,found:[]});assert.equal(api.snapshot().foundHistory.length,0);
 api.setMatches(result(15,[hit(14)],{foundEver:1,foundIndices:[14]}));api.setText('0\n10');assert.equal(api.snapshot().foundHistory.length,0);assert.deepEqual(api.snapshot().matches.found,[]);
 api.setMatches(result(16,[hit(0),hit(0),hit(15)],{foundEver:1,foundIndices:[0,15]}));assert.deepEqual(api.snapshot().foundHistory.map(e=>e.i),[0]);
});
test('real table refresh keeps earlier gold rows and describes them as previous finds',()=>{
 const api=make(),source=fs.readFileSync(__dirname+'/mayatnik-sequences.js','utf8'),a=source.indexOf('  const directionLabel='),b=source.indexOf('\n',a),start=source.indexOf('    function refresh(){'),end=source.indexOf('    const unsubscribe=',start);
 const node=()=>({dataset:{},classes:new Set(),classList:{toggle(name,on){on?this.owner.classes.add(name):this.owner.classes.delete(name);}},title:'',querySelector(){return {};},getAttribute(){return 'false';},setAttribute(){}});
 const nodes=Array.from({length:16},()=>{const n=node();n.classList.owner=n;return n;});
 const context={startLabel:Sequences.startLabel,methodLabel:require('./mayatnik-ochki-method.js').label,pane:{closest:()=>null},api,rendered:0,dirty:false,listKey:'sequence:0',nodes,summary:{},scrolledSelection:0};
 vm.createContext(context);vm.runInContext(source.slice(a,b)+'\n'+source.slice(start,end),context);
 api.setMatches(result(8,Array.from({length:8},(_,i)=>hit(i)),{foundEver:8,foundIndices:[0,1,2,3,4,5,6,7]}));vm.runInContext('refresh()',context);
 api.setMatches(result(15,[hit(14)],{foundEver:9,foundIndices:[0,1,2,3,4,5,6,7,14]}));vm.runInContext('refresh()',context);
 assert.equal(nodes.filter(n=>n.classes.has('is-found')).length,9);assert.equal(nodes[0].dataset.found,'true');assert.equal(nodes[14].dataset.found,'true');assert.match(nodes[0].title,/Ранее найдено · кадр 8/);assert.match(nodes[14].title,/Найдено на поле/);assert.equal(context.summary.textContent,'');
 api.setMatches(result(16,[],{active:false,foundEver:9,foundIndices:[0,1,2,3,4,5,6,7,14]}));vm.runInContext('refresh()',context);assert.equal(nodes.filter(n=>n.classes.has('is-found')).length,9);
 api.setMatches({enabled:false,active:false,found:[]});vm.runInContext('refresh()',context);assert.equal(nodes.filter(n=>n.classes.has('is-found')).length,0);
});

test('first findings are immutable per half across frames and manual searches do not consume automatic history',()=>{
 const api=make(),scope='same';api.setMatches(result(4,[],{enabled:false,active:false,searchScope:scope}));
 api.recordFirstFind({...hit(0),p:1,dir:'snake',manual:true,vn:'рев'},{frame:4,halves:2,searchScope:scope});
 assert.equal(api.snapshot().foundHistory.length,0);assert.equal(api.snapshot().matches.found.length,0);
 api.setMatches(result(5,[],{enabled:false,active:false,searchScope:scope}));assert.equal(api.snapshot().firstFinds.length,1,'paused automatic search must not discard manual result');
 api.setMatches(result(6,[{...hit(0),p:1,dir:0,vn:'инв'}],{halves:2,searchScope:scope}));
 api.setMatches(result(9,[{...hit(0),p:0,dir:'v',vn:'инв+рев'}],{halves:2,searchScope:scope}));
 api.setMatches(result(10,[{...hit(0),p:0,dir:2,vn:''}],{halves:2,searchScope:scope}));
 const first=api.snapshot().firstFinds;assert.deepEqual(first.map(({p,frame,dir,vn})=>({p,frame,dir,vn})),[{p:1,frame:4,dir:'snake',vn:'рев'},{p:0,frame:9,dir:'v',vn:'инв+рев'}]);
 assert.equal(api.snapshot().foundHistory[0].hits.length,2);assert.deepEqual(api.snapshot().foundHistory[0].hits.map(h=>h.frame),[6,9]);
 api.setMatches(result(11,[],{searchScope:'new-view'}));assert.equal(api.snapshot().firstFinds.length,0);assert.equal(api.snapshot().foundHistory.length,0);
 api.recordFirstFind(hit(0),{frame:11,searchScope:'new-view'});api.setText('1');assert.equal(api.snapshot().firstFinds.length,0);
});

test('visible table shows sequence, first frames and methods separately per half without changing gold or editor',()=>{
 const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom'),dom=new JSDOM('<section></section>'),pane=dom.window.document.querySelector('section'),api=make(),view=Sequences.mount(pane,api);
 try{
  assert.deepEqual([...pane.querySelectorAll('thead th')].map(n=>n.textContent),['№','Послед-ть','Кадр','Начало','Конец','Поиск']);
  const row=pane.querySelector('[data-sequence-row="0"]');assert.equal(row.querySelector('[data-column=sequence]').textContent,'1');assert.equal(row.querySelector('[data-column=frame]').textContent,'—');
  api.recordFirstFind({...hit(0),p:0,dir:'snake',manual:true,vn:'инв'},{frame:7,halves:2,searchScope:'a'});
  assert.equal(pane.querySelectorAll('.is-found').length,0);assert.equal(row.querySelector('[data-column=frame]').textContent,'Левый: 7');assert.match(row.querySelector('[data-column=method]').textContent,/ручная змея.*инверсия/);
  api.setMatches(result(10,[{...hit(0),p:0,dir:2,vn:''},{...hit(0),p:1,dir:-1,vn:'рев'}],{halves:2,searchScope:'a'}));
  assert.equal(row.querySelector('[data-column=frame]').textContent,'Левый: 7\nПравый: 10');assert.match(row.querySelector('[data-column=method]').textContent,/Правый: диагональ ↙ · реверс/);
  api.setMatches(result(12,[],{halves:2,searchScope:'a'}));assert.equal(row.querySelector('[data-column=frame]').textContent,'Левый: 7\nПравый: 10');
  api.setMatches(result(12,[],{active:false,searchScope:'reset'}));assert.equal(row.querySelector('[data-column=frame]').textContent,'—');assert.equal(row.querySelector('[data-column=method]').textContent,'—');
 }finally{view.destroy();dom.window.close();}
});
