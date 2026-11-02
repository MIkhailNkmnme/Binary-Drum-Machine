const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const menu=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8'),start=menu.indexOf('  function mountMeasureChoices('),end=menu.indexOf('  mountMeasureChoices(gAreas);',start);
class Node{
 constructor(doc){this.ownerDocument=doc;this.children=[];this.dataset={};this.style={removeProperty(k){delete this[k];}};this.className='';this.classList={add:(...xs)=>{this.className=[...new Set([...this.className.split(' '),...xs])].join(' ');},remove:(...xs)=>{this.className=this.className.split(' ').filter(c=>!xs.includes(c)).join(' ');},contains:x=>this.className.split(' ').includes(x),toggle:(x,on)=>{if(on===undefined)on=!this.classList.contains(x);on?this.classList.add(x):this.classList.remove(x);}};}
 append(...nodes){for(const n of nodes){n.remove();n.parentElement=this;this.children.push(n);}}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null;}
 before(node){const parent=this.parentElement;node.remove();node.parentElement=parent;parent.children.splice(parent.children.indexOf(this),0,node);}
 setAttribute(k,v){this[k]=v;}
 querySelector(selector){const id=selector.match(/data-n="([^"]+)"/)[1];return this.children.flatMap(n=>[n,...n.children]).find(n=>n.dataset.n===id);}
 click(event){if(!this.disabled)this.onclick?.(event||{stopPropagation(){}});}
}
function fixture(initial={sectors:false,areas:false,freeze:null}){
 const doc={createElement:()=>new Node(doc)},row=new Node(doc),state={...initial},calls={sectors:0,areas:0,add:0,clear:0},toolSync=[],storage=new Map([['mayatnik-control-mini-v464',JSON.stringify(['group:Площади:data:areas','group:Площади:data:areaFreeze'])]]),field=[1,0,1];
 const apis={maySectors:{get:()=>state.sectors,set:v=>{state.sectors=v;calls.sectors++;}},mayAreas:{get:()=>state.areas,set:v=>{state.areas=v;calls.areas++;}},mayAreaFreeze:{get:()=>state.freeze,add:()=>{calls.add++;state.freeze={ks:[1],tris:[[0,1,2]]};},clear:()=>{calls.clear++;state.freeze=null;}}};
 const nodes={};for(const id of ['sectors','areas','areaFreeze']){const n=doc.createElement();n.dataset.n=id;n.tagName='BUTTON';n.className='pt-b gz-hx';row.append(n);nodes[id]=n;}
 const placeTools=()=>toolSync.forEach(fn=>fn());nodes.sectors.onclick=()=>{apis.maySectors.set(!apis.maySectors.get());placeTools();};nodes.areas.onclick=()=>{apis.mayAreas.set(!apis.mayAreas.get());placeTools();};nodes.areaFreeze.onclick=()=>{apis.mayAreaFreeze.add();placeTools();};
 const context={window:apis,toolSync,placeTools,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};vm.createContext(context);vm.runInContext(menu.slice(start,end),context);const api=context.mountMeasureChoices(row,apis);return {row,nodes,state,calls,storage,field,api};
}
test('sector/area pair keeps old state on mount and makes user choices exclusive with active-click-off',()=>{
 const f=fixture({sectors:true,areas:true,freeze:null});assert.deepEqual(f.calls,{sectors:0,areas:0,add:0,clear:0});assert.equal(f.nodes.sectors.parentElement,f.nodes.areas.parentElement);assert.equal(f.nodes.sectors.parentElement.tagName,undefined);
 f.nodes.sectors.click();assert.equal(f.state.sectors,false);assert.equal(f.state.areas,false);f.nodes.areas.click();assert.equal(f.state.areas,true);assert.equal(f.nodes.areas['aria-pressed'],'true');f.nodes.sectors.click();assert.equal(f.state.sectors,true);assert.equal(f.state.areas,false);assert.equal(f.nodes.areas['aria-pressed'],'false');f.nodes.sectors.click();assert.equal(f.state.sectors,false);
});
test('freeze keeps both segments across reset and clear affects only accumulated boundaries',()=>{
 const f=fixture(),box=f.nodes.areaFreeze.parentElement,reset=box.children[1];assert.equal(box.classList.contains('is-active'),false);assert.equal(box.children.length,2);assert.equal(reset.disabled,true);const originalClass=box.className;
 for(let i=1;i<=3;i++){f.nodes.areaFreeze.click();assert.equal(f.calls.add,i);assert.equal(box.classList.contains('is-active'),true);assert.equal(box.children.length,2);assert.equal(box.children[1],reset);assert.equal(reset.dataset.n,'areaFreezeClear');assert.notEqual(reset.hidden,true);assert.equal(reset.disabled,false);let stopped=0;reset.click({stopPropagation:()=>stopped++});assert.equal(stopped,1);assert.equal(f.calls.clear,i);assert.equal(f.calls.add,i);assert.equal(f.state.freeze,null);assert.deepEqual(f.field,[1,0,1]);assert.equal(box.children.length,2);assert.equal(box.className,originalClass);assert.equal(reset.disabled,true);reset.click();assert.equal(f.calls.clear,i);}
});
test('moved compact preferences keep their old entries and aliases in the same storage key',()=>{
 const f=fixture(),saved=JSON.parse(f.storage.get('mayatnik-control-mini-v464'));for(const key of ['areas','areaFreeze','measureMode','areaFreezeControls'])assert.ok(saved.includes('group:Площади:data:'+key));
});
