const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const Header=require('./group-header.js');
class Node{
 constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.dataset={};this.listeners={};this.style={setProperty(k,v){this[k]=v}};const s=new Set();this.classList={add:(...x)=>x.forEach(v=>s.add(v)),remove:(...x)=>x.forEach(v=>s.delete(v)),contains:x=>s.has(x),toggle:(x,on)=>{if(on===undefined)on=!s.has(x);on?s.add(x):s.delete(x)}};}
 set className(s){this._class=s;this.classList.add(...s.split(' ').filter(Boolean));}get className(){return this._class;}
 append(...xs){for(const x of xs){x.remove();x.parentNode=this;this.children.push(x);}}
 remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}}
 setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k]??null;}
 addEventListener(t,f){(this.listeners[t]??=[]).push(f);}
 emit(t,data={}){const e={target:this,button:0,repeat:false,stopPropagation(){this.stopped=true},preventDefault(){this.prevented=true},...data};let n=this;while(n){for(const f of n.listeners[t]||[])f(e);n['on'+t]?.(e);if(e.stopped)break;n=n.parentNode;}return e;}
 click(){this.emit('click');}
}
const doc={createElement:t=>new Node(t),createElementNS:(ns,t)=>Object.assign(new Node(t),{namespaceURI:ns})};
function view(kind='native',extra={}){return Header.create({document:doc,title:'Раскраска',className:kind==='rail'?'gz-hx gz-head':'pt-l',titleClass:kind==='rail'?'gz-nm':'may-group-title',pinClass:kind==='rail'?'gz-pin':'pt-pin',iconClass:kind==='rail'?'gz-mico':'pt-ico',...extra});}
test('native and former side headers have one identical structure, icon and state API',()=>{
 const a=view(),b=view('rail');for(const v of [a,b]){assert.equal(v.head.children.length,4);assert.deepEqual(v.head.children.map(n=>n.className.split(' ')[0]),['zgh-title','zgh-pin','zgh-icon','zgh-arrow']);assert.equal(v.pin.parentNode,v.head);assert.equal(v.arrow.hidden,true);assert.equal(v.head.getAttribute('role'),'button');assert.equal(v.pin.getAttribute('aria-pressed'),'false');}
 assert.equal(a.pin.children[0].children[0].getAttribute('d'),b.pin.children[0].children[0].getAttribute('d'));const old=a.head.children.slice();a.sync({open:true,pinned:true,mini:true});assert.equal(a.pin.getAttribute('aria-pressed'),'true');assert.equal(a.head.getAttribute('aria-expanded'),'true');assert.equal(a.pin.tabIndex,-1);a.sync({open:false,mini:false});assert.equal(a.pin.getAttribute('aria-pressed'),'true');assert.equal(a.pin.tabIndex,0);assert.deepEqual(a.head.children,old);
});
test('pin mouse and keyboard never toggle or drag the parent; holding key does not repeat',()=>{
 let toggles=0,pins=0,drags=0;const v=view('native',{onToggle:()=>toggles++,onPin:()=>pins++});v.head.addEventListener('pointerdown',()=>drags++);v.pin.emit('pointerdown');v.pin.click();v.pin.emit('keydown',{key:'Enter'});v.pin.emit('keydown',{key:' ',repeat:true});v.pin.emit('keydown',{key:' '});assert.equal(pins,3);assert.equal(toggles,0);assert.equal(drags,0);v.head.emit('keydown',{key:'Enter'});assert.equal(toggles,1);v.head.onkeydown=()=>toggles++;v.head.emit('keydown',{key:'Enter'});assert.equal(toggles,2);
});
function railFixture(shared=true,saved={}){
 const store={value:saved,get(){return this.value},set(k,v){this.value=v}},ctx={store,PIN:'legacy-pin',el:(tag,cls,text)=>{const n=new Node(tag);n.className=cls;n.textContent=text||'';return n;},getComputedStyle:()=>({getPropertyValue:()=>''}),pressMark(){},closeLadder(){},ladderSync(){},withTip(){},tipHide(){}};vm.createContext(ctx);
 const source=fs.readFileSync(path.join(__dirname,'grozd.js'),'utf8');vm.runInContext(source.slice(source.indexOf('  function rail('),source.indexOf('  /* Перевод готовой страницы'))+';globalThis.rail=rail;',ctx);
 const views=[],host=new Node('div'),groups=[{id:'paint',title:'Раскраска',items:[]},{id:'view',title:'Вид',items:[]}],cfg={key:'test',groups};if(shared)cfg.headerFactory=g=>{const v=view('rail',{title:g.title});views.push(v);return v;};const rail=ctx.rail(host,cfg);return {rail,views,store};
}
test('real grozd controller uses shared pins, preserves saved pin/fold state and independent header collapse',()=>{
 const f=railFixture(true,{pin:['paint'],shut:['paint'],order:['view','paint']});const paint=f.views[1];assert.equal(paint.pin.getAttribute('aria-pressed'),'true');assert.equal(paint.head.getAttribute('aria-expanded'),'false');paint.head.click();assert.equal(paint.head.getAttribute('aria-expanded'),'true');paint.head.click();assert.equal(paint.head.getAttribute('aria-expanded'),'false');assert.equal(paint.pin.getAttribute('aria-pressed'),'true');paint.pin.click();assert.equal(paint.pin.getAttribute('aria-pressed'),'false');paint.pin.emit('keydown',{key:' '});assert.equal(paint.pin.getAttribute('aria-pressed'),'true');assert.equal(paint.head.getAttribute('aria-expanded'),'true');assert.deepEqual(Array.from(f.store.value.pin),['paint']);const restored=railFixture(true,f.store.value);assert.equal(restored.views[1].pin.getAttribute('aria-pressed'),'true');assert.equal(restored.views[1].head.getAttribute('aria-expanded'),'true');
});
test('other HTML pages without the shared factory retain the old header DOM',()=>{const f=railFixture(false),head=f.rail.el.children[0].children[0];assert.equal(head.tagName,'button');assert.equal(head.children.length,2);assert.equal(head.children[1].className,'gz-hr');});
