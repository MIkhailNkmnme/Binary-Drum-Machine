const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const menu=fs.readFileSync(path.join(__dirname,'mayatnik-menu.js'),'utf8'),a=menu.indexOf('  function mergeTemplateRail('),b=menu.indexOf('  // v0.124:',a),code=menu.slice(a,b);
function setup(seed={}){
 const storage=new Map(Object.entries(seed)),counts={},box={removed:false,remove(){this.removed=true}},soty={className:'gz-soty',children:[]},wide={className:'gz-wide',children:[]};
 const make=(id,p)=>({dataset:{},style:{left:'112px',top:'27px'},parentElement:p,children:[{id:'inner-'+id}],onclick:()=>counts[id]=(counts[id]||0)+1,closest:()=>box,remove(){this.parentElement.children.splice(this.parentElement.children.indexOf(this),1);this.parentElement=null;}});
 const ids=['bAutoTpl','bTemplateTake','pairFlip','bXor2','templateMask'],cells=ids.map(id=>make(id,soty));soty.children.push(...cells);const sliders=['xorStep','templateAlpha'].map(id=>make(id,wide));wide.children.push(...sliders);box.querySelectorAll=s=>s.startsWith('.gz-soty')?soty.children.slice():wide.children.slice();
 const library={dataset:{},name:'library'},xor=make('bXor2',null);xor.dataset.n='bXor2';const row={children:[xor,library],querySelector:s=>s.startsWith('.gz-control')?library:s.includes('bXor2')?xor:null,insertBefore(n,b){n.remove();const i=this.children.indexOf(b);this.children.splice(i<0?this.children.length:i,0,n);n.parentElement=this;}};
 const buttons=new Map(ids.filter(id=>id!=='pairFlip').map(id=>[id,cells[ids.indexOf(id)]])),legacy=new Map();
 const ctx={row,buttons,manualLegacyCells:legacy,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}};vm.createContext(ctx);vm.runInContext(code+';mergeTemplateRail(row,buttons)',ctx);return{ctx,storage,counts,box,cells,sliders,row,xor,library,buttons,legacy};
}
test('actual merge transfers whole live controls, deduplicates only same source and preserves pin ordinals',()=>{
 const e=setup();assert.ok(e.box.removed);assert.equal(e.row.children.at(-1),e.library);assert.equal(e.row.children.filter(n=>n===e.xor).length,1);assert.equal(e.cells[3].parentElement,null);
 for(const [i,n]of e.cells.entries()){const target=i===3?e.xor:n;assert.equal(e.legacy.get('template')[i],target);assert.equal(target.dataset.mayPinIndex,String(i));target.onclick();}
 for(const n of e.sliders){assert.ok(e.row.children.includes(n));assert.equal(n.children.length,1);assert.equal(n.style.left,'');n.onclick();}
 assert.equal(e.buttons.get('bXor2'),e.xor);assert.equal(e.counts.bXor2,1);assert.equal(e.counts.xorStep,1);
});
test('saved library placement wins; rail pin/mini and old control minis migrate with backup, F5 stays singular',()=>{
 const seed={'mayatnik-dd-grid':JSON.stringify({'Шаблоны':[2,0,4],'gz:template':[7,0,9]}),'mayatnik-dd-order':JSON.stringify(['Шаблоны','gz:template','Оси']),'mayatnik-dd-up':'["template","zoom"]','grozd:mayatnik':JSON.stringify({pin:['template'],shut:[],open:'template'}),'mayatnik-rail-mini':'["Шаблон"]','mayatnik-control-mini-v464':'["group:template:parent:gz-soty:slot:3","group:template:parent:gz-wide:slot:1"]'};
 const e=setup(seed),read=k=>JSON.parse(e.storage.get(k));assert.deepEqual(read('mayatnik-dd-grid'),{'Шаблоны':[2,0,4]});assert.deepEqual(read('mayatnik-dd-order'),['Шаблоны','Оси']);assert.deepEqual(read('mayatnik-dd-up'),['zoom']);assert.ok(read('mayatnik-dd-pins').includes('Шаблоны'));assert.ok(read('mayatnik-dd-mini').includes('Шаблоны'));
 const minis=read('mayatnik-control-mini-v464');assert.ok(minis.includes('group:Шаблоны:data:bXor2'));assert.ok(minis.includes('group:Шаблоны:data:template-wide:1'));assert.ok(e.storage.has('mayatnik-template-rail-merge-v496-before'));
 const f5=setup(Object.fromEntries(e.storage));assert.equal(f5.row.children.length,e.row.children.length);assert.equal(f5.storage.get('mayatnik-dd-grid'),e.storage.get('mayatnik-dd-grid'));
});
test('without a saved library place old rail placement is inherited once',()=>{
 const e=setup({'mayatnik-dd-grid':'{"gz:template":[7,0,9]}','mayatnik-dd-order':'["Оси","gz:template"]'});assert.deepEqual(JSON.parse(e.storage.get('mayatnik-dd-grid')),{'Шаблоны':[7,0,9]});assert.deepEqual(JSON.parse(e.storage.get('mayatnik-dd-order')),['Оси','Шаблоны']);
});
