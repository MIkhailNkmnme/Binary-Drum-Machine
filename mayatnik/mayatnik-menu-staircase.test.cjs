const test=require('node:test');
const assert=require('node:assert/strict');
const stair=require('./mayatnik-menu-staircase.js');
const button={width:120,height:24};
test('every entry advances 110/14, including the first entry from its header',()=>{
  const p=stair.plan(Array.from({length:20},()=>button));
  p.items.forEach((r,i)=>assert.deepEqual(r,{x:110*i,y:14*i,...button}));
  assert.deepEqual([p.width,p.height],[2210,290]);
  const g=stair.place(p,{anchor:{left:18,top:7,...button},viewport:{left:0,top:0,width:250,height:57},pad:0});
  assert.equal(g.left+g.offsetX,128);assert.equal(g.top+g.offsetY,21);
  assert.equal(g.overflowX,true);assert.equal(g.overflowY,true);
});
test('a library record remains one tall item and clears its last pair before the next step',()=>{
  const p=stair.plan([button,{width:120,height:80},button,{width:34,height:24},button]);
  assert.deepEqual(p.items.map(r=>[r.x,r.y]),[[0,0],[110,14],[220,84],[330,98],[354,112]]);
  assert.equal(p.items[2].y-p.items[1].y,70);
  assert.equal(p.items.length,5);
});
test('narrow viewport clips and scrolls without resizing or wrapping any entry',()=>{
  const p=stair.plan(Array.from({length:100},()=>button)),before=JSON.stringify(p);
  const g=stair.place(p,{anchor:{left:210,top:250,...button},viewport:{left:4,top:4,width:92,height:200}});
  assert.equal(g.width,92);assert.ok(g.height<=200);assert.equal(g.left,4);
  assert.equal(g.contentWidth,p.width+28);assert.equal(g.contentHeight,p.height+28);
  assert.equal(JSON.stringify(p),before);assert.equal(p.items[99].x,10890);
});
test('bottom headers place the viewport above while entry order remains right/down',()=>{
  const p=stair.plan([button,button,button]);
  const g=stair.place(p,{anchor:{left:10,top:460,...button},viewport:{left:4,top:4,width:800,height:500},preferAbove:true});
  assert.ok(g.top+g.height<=460);assert.equal(g.contentHeight,80);
  assert.ok(p.items[2].x>p.items[1].x&&p.items[2].y>p.items[1].y);
});
class Style {
  constructor(){this.values=new Map();}
  getPropertyValue(k){return this.values.get(k)?.[0]||'';}
  getPropertyPriority(k){return this.values.get(k)?.[1]||'';}
  setProperty(k,v,p=''){this.values.set(k,[String(v),p]);}
  removeProperty(k){this.values.delete(k);}
}
class Element {
  constructor(doc,width=120,height=24){this.ownerDocument=doc;this.style=new Style();this.dataset={};this.classes=new Set();this.classList={add:(...a)=>a.forEach(x=>this.classes.add(x)),remove:(...a)=>a.forEach(x=>this.classes.delete(x)),contains:x=>this.classes.has(x)};this.children=[];this.attrs={};this.natural={left:18,top:7,width,height};this.scrollLeft=0;this.scrollTop=0;}
  getBoundingClientRect(){const r={...this.natural};if(this.classList.contains('may-standard'))r.width=this.classList.contains('may-control-mini')?34:120;for(const k of ['width','height']){const n=parseFloat(this.style.getPropertyValue(k));if(Number.isFinite(n))r[k]=n;}return r;}
  append(el){this.children.push(el);el.parentNode=this;}
  setAttribute(k,v){this.attrs[k]=v;}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this);this.parentNode=null;}
}
function fixture(){const doc={defaultView:{innerWidth:320,innerHeight:200},createElement:()=>new Element(doc)};const host=new Element(doc),anchor=new Element(doc);const items=Array.from({length:12},()=>new Element(doc));items.forEach(e=>host.append(e));return {doc,host,anchor,items};}
test('apply preserves DOM/handlers and repeated layout retains two-axis scroll; destroy restores styles',()=>{
  const {host,anchor,items}=fixture();const pick=()=>42;items[0].onclick=pick;host.style.setProperty('width','126px');items[0].style.setProperty('left','7px','important');
  const g=stair.apply(host,{items,anchor});assert.equal(host.children.length,13);assert.equal(g.items[0].element,items[0]);
  assert.equal(g.left+g.items[0].x,128);assert.equal(g.top+g.items[0].y,21);
  assert.equal(items[0].parentNode,host);assert.equal(items[0].onclick,pick);assert.equal(g.items.length,12);
  const spacer=host.children[12];assert.equal(spacer.dataset.mayStairIgnore,'1');assert.equal(spacer.attrs['aria-hidden'],'true');
  host.scrollLeft=100;host.scrollTop=10;stair.apply(host,{items,anchor});
  assert.equal(host.scrollLeft,100);assert.equal(host.scrollTop,10);assert.equal(host.children[12],spacer);
  stair.destroy(host);assert.equal(host.children.length,12);assert.equal(host.style.getPropertyValue('width'),'126px');
  assert.equal(items[0].style.getPropertyValue('left'),'7px');assert.equal(items[0].style.getPropertyPriority('left'),'important');assert.equal(host._mayStaircase,undefined);
});
test('live mini/record size changes are measured naturally, no old inline width locks them',()=>{
  const {host,anchor,items}=fixture();stair.apply(host,{items,anchor});
  items[0].natural.width=34;items[1].natural.height=80;
  const g=stair.apply(host,{items,anchor});
  assert.equal(g.items[0].width,34);assert.equal(g.items[1].x-g.items[0].x,24);
  assert.equal(g.items[2].y-g.items[1].y,70);
  assert.equal(items[0].style.getPropertyValue('width'),'34px');
});
test('removed/hidden controls and recreated option lists leave no stale steps or spacer',()=>{
  const {host,anchor,items}=fixture();stair.apply(host,{items,anchor});items[0].hidden=true;items[1].natural.width=0;
  const g=stair.apply(host,{items:items.slice(0,3),anchor});assert.equal(g.items.length,1);assert.equal(g.items[0].element,items[2]);
  assert.equal(items[0].style.getPropertyValue('position'),'');assert.equal(items[5].style.getPropertyValue('width'),'');
  host.children.at(-1).remove();stair.apply(host,{items:[items[2]],anchor});assert.equal(host.children.filter(e=>e.dataset.mayStairIgnore).length,1);
  stair.apply(host,{items:[],anchor});assert.equal(host.children.filter(e=>e.dataset.mayStairIgnore).length,0);assert.equal(host.dataset.mayStaircase,undefined);
});
test('a first visit to an inline mini can return to full then mini; original styles survive teardown',()=>{
  const {host,anchor,items}=fixture(),b=items[0];b.classList.add('may-standard','may-control-mini');b.style.setProperty('width','34px','important');b.style.setProperty('min-width','34px','important');
  assert.equal(stair.apply(host,{items,anchor}).items[0].width,34);
  b.classList.remove('may-control-mini');let g=stair.apply(host,{items,anchor});assert.equal(g.items[0].width,120);assert.equal(g.items[1].x-g.items[0].x,110);
  b.classList.add('may-control-mini');g=stair.apply(host,{items,anchor});assert.equal(g.items[0].width,34);assert.equal(g.items[1].x-g.items[0].x,24);
  stair.destroy(host);assert.equal(b.style.getPropertyValue('width'),'34px');assert.equal(b.style.getPropertyPriority('width'),'important');
});
