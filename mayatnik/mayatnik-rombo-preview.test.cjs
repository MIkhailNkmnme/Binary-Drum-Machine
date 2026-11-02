const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('./mayatnik-rombo-preview.js');

function host(){
 const listeners=new Map();let writes=0;
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.hidden=false;}
  append(el){this.children.push(el);el.parent=this;}
  setAttribute(key,value){this.attributes[key]=value;writes++;}
  set textContent(value){this.text=value;writes++;}
  get textContent(){return this.text;}
  remove(){this.parent.children=this.parent.children.filter(el=>el!==this);}
 }
 const win={addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type){listeners.delete(type);}};
 const doc={defaultView:win,body:new Element('body'),createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag)};
 let state=null;const preview=P.mount({document:doc,api:()=>state?{get:()=>state}:null});
 const fire=()=>listeners.get('may-rombo-change')?.();
 return {preview,doc,fire,set(value){state=value;fire();},writes:()=>writes};
}
const texts=el=>[...(el.tagName==='text'?[el.textContent]:[]),...el.children.flatMap(texts)];

test('all atlas assemblies retain slot order, duplicate parts, colours and independent flip markers',()=>{
 const expected=['L','R','L↔','R↔'],h=host();
 for(let id=0;id<16;id++){
  h.set({on:true,assembly:id,angle:0,row:512});
  const svg=h.preview.element.children[0],turned=svg.children[1],slots=[Math.floor(id/4),id%4];
  assert.equal(h.preview.element.hidden,false);
  assert.equal(texts(svg)[0],`Сборка ${id+1} · ${expected[slots[0]]} | ${expected[slots[1]]}`);
  assert.deepEqual(texts(turned),['C',...slots.map(i=>expected[i])]);
  assert.deepEqual(turned.children.filter(el=>el.tagName==='g').map(el=>el.attributes.transform),slots.map((slot,i)=>`translate(${i?18:-18} 25) scale(${slot>=2?-1:1} 1)`));
  assert.deepEqual(turned.children.filter(el=>el.tagName==='path').slice(0,3).map(el=>el.attributes.fill),['#e5be68',...slots.map(i=>i%2?'#d99bc9':'#78b8e8')]);
 }
});

test('angle matches the rendered Rombo plan, rotating the axis and orientation arrows together',()=>{
 const R=require('./mayatnik-rombo.js'),h=host();
 for(const angle of [-45,0,45,90,135,180,225,270,315,360,17,44]){
  h.set({on:true,assembly:6,angle,row:37});const actual=R.plan(9,100,{angle,row:37,assembly:6}).angle;
  const svg=h.preview.element.children[0];assert.equal(svg.children[1].attributes.transform,`translate(82 86) rotate(${actual})`);
  assert.equal(texts(svg).at(-1),`Ось 37 · ${actual}°`);
  assert.match(h.preview.element.attributes['aria-label'],new RegExp(`Поворот ${actual}°`));
 }
});

test('unavailable API, delayed load, disable, import/reset and unchanged events update without polling',()=>{
 const h=host();assert.equal(h.preview.element.hidden,true);
 h.set({on:true,assembly:15,angle:90,row:8});assert.equal(h.preview.element.hidden,false);
 const writes=h.writes();h.fire();assert.equal(h.writes(),writes);
 h.set({on:false,assembly:15,angle:90,row:8});assert.equal(h.preview.element.hidden,true);
 h.set({on:true,assembly:1,angle:0,row:512});assert.equal(h.preview.element.hidden,false);
 assert.equal(texts(h.preview.element).at(-1),'Ось 512 · 0°');
 h.set(null);assert.equal(h.preview.element.hidden,true);
 h.set({on:true,assembly:1,angle:0,row:512});assert.equal(h.preview.element.hidden,false);
 h.preview.destroy();assert.equal(h.doc.body.children.length,0);
});
