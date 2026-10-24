const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const menu=fs.readFileSync(path.join(__dirname,'mayatnik-menu.js'),'utf8'),start=menu.indexOf('  function removePaintClearDuplicates('),end=menu.indexOf('  removePaintClearDuplicates(railSourceButtons);',start),code=menu.slice(start,end);
function setup(saved=[]){
 const counts={},parent={className:'gz-soty',children:[]},group={dataset:{id:'paint'},querySelectorAll:()=>parent.children.slice()};
 const make=(id,p)=>({dataset:{},parentElement:p,onclick:()=>counts[id]=(counts[id]||0)+1,closest:s=>p===parent?group:null,remove(){p.children.splice(p.children.indexOf(this),1);this.parentElement=null;}});
 const ids=['bPaintNew','bFill','auto','mid','undo','bFillClear','regions','restore'],nodes=ids.map(id=>make(id,parent));parent.children.push(...nodes);
 const proxies={bPaintNew:make('bPaintNew',{}),bFillClear:make('bFillClear',{})};for(const [id,p]of Object.entries(proxies))p.dataset.n=id;
 const map=new Map(ids.map((id,i)=>[id,nodes[i]])),legacy=new Map(),storage=new Map([['mayatnik-control-mini-v464',JSON.stringify(saved)]]);
 const ctx={railButtons:map,manualLegacyCells:legacy,gEdit:{querySelector:s=>proxies[s.match(/"(.+)"/)[1]]},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}};vm.createContext(ctx);vm.runInContext(code+';removePaintClearDuplicates(railButtons)',ctx);
 const line=menu.split('\n').find(s=>s.includes('const cellOf ='));vm.runInContext(line+'\nglobalThis.cell=cellOf;',ctx);
 return{ctx,counts,ids,nodes,proxies,parent,map,legacy,storage};
}
test('actual installer removes only duplicate rail nodes and reuses native clear proxies',()=>{
 const e=setup(),keep=e.nodes.filter((_,i)=>![0,5].includes(i));assert.deepEqual(e.parent.children,keep);
 for(const id of ['bPaintNew','bFillClear']){assert.equal(e.map.get(id),e.proxies[id]);e.map.get(id).onclick();assert.equal(e.counts[id],1);}
 for(const node of keep)node.onclick();assert.equal(e.counts.bFill,1);assert.equal(e.counts.restore,1);
});
test('all old paint pin ordinals resolve unchanged commands; new pins use those same ordinals',()=>{
 const e=setup();for(let i=0;i<e.ids.length;i++){const expected=e.proxies[e.ids[i]]||e.nodes[i];assert.equal(e.ctx.cell('paint',i),expected);assert.equal(expected.dataset.mayPinGroup,'paint');assert.equal(expected.dataset.mayPinIndex,String(i));}
 // Repeated installation must leave the initial snapshot and source aliases intact.
 vm.runInContext('removePaintClearDuplicates(railButtons)',e.ctx);assert.equal(e.ctx.cell('paint',5),e.proxies.bFillClear);
});
test('F5 mini migration preserves old keys and copies cleared slots to existing Cleanup keys',()=>{
 const keys=['group:paint:parent:gz-soty:slot:0','group:paint:parent:gz-soty:slot:1','group:paint:parent:gz-soty:slot:5','group:unrelated:data:test'];
 const e=setup(keys),saved=JSON.parse(e.storage.get('mayatnik-control-mini-v464'));
 for(const key of [...keys,'group:Очистка:data:bPaintNew','group:Очистка:data:bFillClear','group:paint:data:paint-slot:1'])assert.ok(saved.includes(key));
 assert.equal(e.storage.get('mayatnik-paint-clear-mini-before-v496'),JSON.stringify(keys));
 const f5=setup(saved);assert.equal(f5.storage.get('mayatnik-control-mini-v464'),JSON.stringify(saved));assert.equal(f5.parent.children.length,6);
});

