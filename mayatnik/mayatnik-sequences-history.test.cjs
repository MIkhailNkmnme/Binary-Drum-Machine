const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Sequences=require('./mayatnik-sequences.js');
const make=()=>Sequences.create(null,{rows:16});
const hit=i=>({i,r:i,c:0,n:i+1,dir:1,p:0});
const result=(frame,found,extra={})=>({enabled:true,active:true,pattern:'initial',mode:'diag',frame,total:16,found,...extra});
test('table retains rows 1 through 8 when the next frame finds row 15; field matches stay current',()=>{
 const api=make();api.setMatches(result(8,Array.from({length:8},(_,i)=>hit(i))));
 api.setMatches(result(15,[hit(14)]));const state=api.snapshot();
 assert.deepEqual(state.foundHistory.map(e=>e.i),[0,1,2,3,4,5,6,7,14]);
 assert.deepEqual(state.matches.found.map(e=>e.i),[14]);assert.equal(state.foundHistory[0].frame,8);
 api.setMatches(result(16,[],{active:false,reason:'searching'}));assert.equal(api.snapshot().foundHistory.length,9);
});
test('turning off or applying a different sequence clears table history without retaining stale indices',()=>{
 const api=make();api.setMatches(result(8,[hit(7)]));api.setMatches({enabled:false,active:false,found:[]});assert.equal(api.snapshot().foundHistory.length,0);
 api.setMatches(result(15,[hit(14)]));api.setText('0\n10');assert.equal(api.snapshot().foundHistory.length,0);assert.deepEqual(api.snapshot().matches.found,[]);
 api.setMatches(result(16,[hit(0),hit(0),hit(15)]));assert.deepEqual(api.snapshot().foundHistory.map(e=>e.i),[0]);
});
test('real table refresh preserves earlier gold rows and describes them as previous finds',()=>{
 const api=make(),source=fs.readFileSync(__dirname+'/mayatnik-sequences.js','utf8'),a=source.indexOf('  const directionLabel='),b=source.indexOf('\n',a),start=source.indexOf('    function refresh(){'),end=source.indexOf('    const unsubscribe=',start);
 const node=()=>({dataset:{},classes:new Set(),classList:{toggle(name,on){on?this.owner.classes.add(name):this.owner.classes.delete(name);}},title:'',getAttribute(){return 'false';},setAttribute(){}});
 const nodes=Array.from({length:16},()=>{const n=node();n.classList.owner=n;return n;});
 const context={pane:{closest:()=>null},api,rendered:0,dirty:false,listKey:'sequence:0',nodes,summary:{},scrolledSelection:0};
 vm.createContext(context);vm.runInContext(source.slice(a,b)+'\n'+source.slice(start,end),context);
 api.setMatches(result(8,Array.from({length:8},(_,i)=>hit(i))));vm.runInContext('refresh()',context);
 api.setMatches(result(15,[hit(14)]));vm.runInContext('refresh()',context);
 assert.equal(nodes.filter(n=>n.classes.has('is-found')).length,9);assert.equal(nodes[0].dataset.found,'true');assert.equal(nodes[14].dataset.found,'true');assert.match(nodes[0].title,/Ранее найдено · кадр 8/);assert.match(nodes[14].title,/Найдено на поле/);assert.match(context.summary.textContent,/Всего найдено 9 из 16 строк/);
 api.setMatches(result(16,[],{active:false}));vm.runInContext('refresh()',context);assert.equal(nodes.filter(n=>n.classes.has('is-found')).length,9);
 api.setMatches({enabled:false,active:false,found:[]});vm.runInContext('refresh()',context);assert.equal(nodes.filter(n=>n.classes.has('is-found')).length,0);
});