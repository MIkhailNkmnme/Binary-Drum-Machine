const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Sequences=require('./mayatnik-sequences.js');
const make=()=>Sequences.create(null,{rows:16});
const hit=i=>({i,r:i,c:0,n:i+1,dir:1,p:0});
const result=(frame,found,extra={})=>({enabled:true,active:true,pattern:'initial',mode:'diag',frame,total:16,found,...extra});
test('table highlights only rows found in the current frame and keeps the cumulative count',()=>{
 const api=make();api.setMatches(result(8,Array.from({length:8},(_,i)=>hit(i)),{foundEver:8,foundIndices:[0,1,2,3,4,5,6,7]}));
 api.setMatches(result(15,[hit(14)],{foundEver:9,foundIndices:[0,1,2,3,4,5,6,7,14]}));const state=api.snapshot();
 assert.deepEqual(state.matches.found.map(e=>e.i),[14]);assert.equal(state.matches.foundEver,9);assert.equal('foundHistory' in state,false);
 api.setMatches(result(16,[],{active:false,reason:'searching',foundEver:9,foundIndices:[0,1,2,3,4,5,6,7,14]}));assert.deepEqual(api.snapshot().matches.found,[]);
});
test('turning off or applying a different sequence clears current matches and keeps no stale indices',()=>{
 const api=make();api.setMatches(result(8,[hit(7)],{foundEver:1,foundIndices:[7]}));api.setMatches({enabled:false,active:false,found:[]});assert.deepEqual(api.snapshot().matches.found,[]);
 api.setMatches(result(15,[hit(14)],{foundEver:1,foundIndices:[14]}));api.setText('0\n10');assert.deepEqual(api.snapshot().matches.found,[]);
 api.setMatches(result(16,[hit(0),hit(0),hit(15)],{foundEver:2,foundIndices:[0,15]}));assert.deepEqual(api.snapshot().matches.found.map(e=>e.i),[0,0,15]);
});
test('real table refresh marks only current finds and shows the cumulative count, never old gold rows',()=>{
 const api=make(),source=fs.readFileSync(__dirname+'/mayatnik-sequences.js','utf8'),a=source.indexOf('  const directionLabel='),b=source.indexOf('\n',a),start=source.indexOf('    function refresh(){'),end=source.indexOf('    const unsubscribe=',start);
 const node=()=>({dataset:{},classes:new Set(),classList:{toggle(name,on){on?this.owner.classes.add(name):this.owner.classes.delete(name);}},title:'',getAttribute(){return 'false';},setAttribute(){}});
 const nodes=Array.from({length:16},()=>{const n=node();n.classList.owner=n;return n;});
 const context={pane:{closest:()=>null},api,rendered:0,dirty:false,listKey:'sequence:0',nodes,summary:{},scrolledSelection:0};
 vm.createContext(context);vm.runInContext(source.slice(a,b)+'\n'+source.slice(start,end),context);
 api.setMatches(result(8,Array.from({length:8},(_,i)=>hit(i)),{foundEver:8,foundIndices:[0,1,2,3,4,5,6,7]}));vm.runInContext('refresh()',context);
 assert.equal(nodes.filter(n=>n.classes.has('is-found')).length,8);
 api.setMatches(result(15,[hit(14)],{foundEver:9,foundIndices:[0,1,2,3,4,5,6,7,14]}));vm.runInContext('refresh()',context);
 assert.equal(nodes.filter(n=>n.classes.has('is-found')).length,1);assert.equal(nodes[0].dataset.found,'false');assert.equal(nodes[14].dataset.found,'true');assert.match(nodes[14].title,/Найдено на поле/);assert.doesNotMatch(nodes[0].title,/Ранее найдено/);assert.match(context.summary.textContent,/Найдено 9 из 16 строк/);
 api.setMatches(result(16,[],{active:false,foundEver:9,foundIndices:[0,1,2,3,4,5,6,7,14]}));vm.runInContext('refresh()',context);assert.equal(nodes.filter(n=>n.classes.has('is-found')).length,0);
 api.setMatches({enabled:false,active:false,found:[]});vm.runInContext('refresh()',context);assert.equal(nodes.filter(n=>n.classes.has('is-found')).length,0);
});
