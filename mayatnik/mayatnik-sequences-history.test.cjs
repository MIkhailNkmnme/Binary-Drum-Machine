const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Sequences=require('./mayatnik-sequences.js');
const make=()=>Sequences.create(null,{rows:16});
const hit=i=>({i,r:i,c:0,n:i+1,dir:1,p:0});
const result=(frame,found,extra={})=>({enabled:true,active:true,pattern:'initial',mode:'diag',frame,total:16,found,...extra});
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
 const context={methodLabel:require('./mayatnik-ochki-method.js').label,pane:{closest:()=>null},api,rendered:0,dirty:false,listKey:'sequence:0',nodes,summary:{},scrolledSelection:0};
 vm.createContext(context);vm.runInContext(source.slice(a,b)+'\n'+source.slice(start,end),context);
 api.setMatches(result(8,Array.from({length:8},(_,i)=>hit(i)),{foundEver:8,foundIndices:[0,1,2,3,4,5,6,7]}));vm.runInContext('refresh()',context);
 api.setMatches(result(15,[hit(14)],{foundEver:9,foundIndices:[0,1,2,3,4,5,6,7,14]}));vm.runInContext('refresh()',context);
 assert.equal(nodes.filter(n=>n.classes.has('is-found')).length,9);assert.equal(nodes[0].dataset.found,'true');assert.equal(nodes[14].dataset.found,'true');assert.match(nodes[0].title,/Ранее найдено · кадр 8/);assert.match(nodes[14].title,/Найдено на поле/);assert.match(context.summary.textContent,/Всего найдено 9 из 16 строк/);
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
  assert.deepEqual([...pane.querySelectorAll('thead th')].map(n=>n.textContent),['№','Последовательность','Первый кадр','Способ поиска']);
  const row=pane.querySelector('[data-sequence-row="0"]');assert.equal(row.querySelector('[data-column=sequence]').textContent,'1');assert.equal(row.querySelector('[data-column=frame]').textContent,'—');
  api.recordFirstFind({...hit(0),p:0,dir:'snake',manual:true,vn:'инв'},{frame:7,halves:2,searchScope:'a'});
  assert.equal(pane.querySelectorAll('.is-found').length,0);assert.equal(row.querySelector('[data-column=frame]').textContent,'Левый: 7');assert.match(row.querySelector('[data-column=method]').textContent,/ручная змея.*инверсия/);
  api.setMatches(result(10,[{...hit(0),p:0,dir:2,vn:''},{...hit(0),p:1,dir:-1,vn:'рев'}],{halves:2,searchScope:'a'}));
  assert.equal(row.querySelector('[data-column=frame]').textContent,'Левый: 7\nПравый: 10');assert.match(row.querySelector('[data-column=method]').textContent,/Правый: диагональ ↙ · реверс/);
  api.setMatches(result(12,[],{halves:2,searchScope:'a'}));assert.equal(row.querySelector('[data-column=frame]').textContent,'Левый: 7\nПравый: 10');
  api.setMatches(result(12,[],{active:false,searchScope:'reset'}));assert.equal(row.querySelector('[data-column=frame]').textContent,'—');assert.equal(row.querySelector('[data-column=method]').textContent,'—');
 }finally{view.destroy();dom.window.close();}
});
