const test=require('node:test'),assert=require('node:assert/strict'),View=require('./mayatnik-manual-lines-view.js');
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.listeners=new Map();this.hidden=false;this.offsetWidth=220;this.offsetHeight=24;this.style={setProperty(k,v){this[k]=v;}};this.classList={add(){},remove(){}};}
 append(child){child.parentElement=this;this.children.push(child);}
 remove(){this.parentElement.children=this.parentElement.children.filter(e=>e!==this);}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(type,fn,capture=false){const a=this.listeners.get(type)||[];a.push({fn,capture});this.listeners.set(type,a);}
 removeEventListener(type,fn,capture=false){this.listeners.set(type,(this.listeners.get(type)||[]).filter(e=>e.fn!==fn||e.capture!==capture));}
 setPointerCapture(id){this.capture=id;}hasPointerCapture(id){return this.capture===id;}releasePointerCapture(){this.capture=null;}
 closest(){return this.tagName==='button'?this:null;}
 fire(type,values={}){const e={type,target:this,button:0,pointerType:'mouse',pointerId:1,clientX:0,clientY:0,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;},...values};for(const {fn}of [...(this.listeners.get(type)||[])].sort((a,b)=>Number(b.capture)-Number(a.capture))){fn(e);if(e.stopped)break;}return e;}
}
function fixture(){
 const document={createElement:tag=>new Element(tag),body:new Element()},host=new Element();host.ownerDocument=document;
 const axes=[{id:'main',kind:'h',number:1,p:10,mode:0,colour:'#7cbcff',canDelete:false,resettable:true,pin:false},{id:'h:2',kind:'h',number:2,p:20,mode:0,colour:'#7cbcff',canDelete:true}];
 const snapshot={axes,viewport:{left:0,top:0,right:1000,bottom:600},scale:10,anchor:30,rows:60};let commits=0,pick=true;
 const render=()=>{for(const a of axes)a.segment=[0,a.p*10,1000,a.p*10];view.render(snapshot);};
 const view=View.mount({host,onPosition(id,p){axes.find(a=>a.id===id).p=p;render();},onReset(id){axes.find(a=>a.id===id).p=0;render();},onCommit(){commits++;},onMirror(id,mode){axes.find(a=>a.id===id).mode=mode;render();},canPick:()=>pick});render();
 const panel=id=>document.body.children.find(p=>p.dataset.axisId===id),button=(id,key)=>panel(id).children.find(b=>b.className==='may-manual-axis-'+key);
 return {view,host,axes,snapshot,render,panel,button,commits:()=>commits,pick(value){pick=value;}};
}
test('dragging the extra horizontal line far from its panel moves only that axis',()=>{
 const f=fixture(),down=f.host.fire('pointerdown',{clientX:850,clientY:200});assert.ok(down.defaultPrevented);assert.equal(f.host.capture,1);
 f.host.fire('pointermove',{clientX:850,clientY:235});f.host.fire('pointerup',{clientX:850,clientY:235});
 assert.equal(f.axes[1].p,23.5);assert.equal(f.axes[0].p,10);assert.equal(f.commits(),1);assert.equal(f.host.capture,null);
});
test('direct label drag selects its own coincident axis while panels remain separate',()=>{
 const f=fixture();f.axes[1].p=10;f.render();assert.notEqual(f.panel('main').style.left,f.panel('h:2').style.left);
 const n=f.button('h:2','label');n.fire('pointerdown',{clientX:100,clientY:100});n.fire('pointermove',{clientX:100,clientY:120});n.fire('pointerup',{clientX:100,clientY:120});
 assert.equal(f.axes[1].p,12);assert.equal(f.axes[0].p,10);assert.equal(f.commits(),1);
});
test('coincident first-row axes keep separate panels inside the top edge',()=>{
 const f=fixture();f.axes[0].p=f.axes[1].p=0;f.render();assert.notEqual(f.panel('main').style.left,f.panel('h:2').style.left);
 assert.ok(parseFloat(f.panel('main').style.top)>=0);assert.ok(parseFloat(f.panel('h:2').style.top)>=0);
 const n=f.button('h:2','label');n.fire('pointerdown',{clientX:100,clientY:12});n.fire('pointermove',{clientX:100,clientY:52});n.fire('pointerup',{clientX:100,clientY:52});assert.equal(f.axes[1].p,4);assert.equal(f.axes[0].p,0);
});
test('right mouse, empty field, hidden family and other active tool are not intercepted',()=>{
 const f=fixture();assert.equal(f.host.fire('pointerdown',{button:2,clientX:850,clientY:200}).defaultPrevented,false);
 assert.equal(f.host.fire('pointerdown',{clientX:850,clientY:400}).defaultPrevented,false);
 f.axes[1].visible=false;f.render();assert.equal(f.panel('h:2').hidden,true);assert.equal(f.host.fire('pointerdown',{clientX:850,clientY:200}).defaultPrevented,false);
 f.button('h:2','label').fire('pointerdown',{clientX:100,clientY:200});assert.equal(f.button('h:2','label').capture,undefined);
 f.pick(false);assert.equal(f.host.fire('pointerdown',{clientX:850,clientY:100}).defaultPrevented,false);
});
test('two mirror buttons have explicit direction, toggle independently and never start drag',()=>{
 const f=fixture();const click=mode=>{const b=f.button('h:2','mirror'+mode),e={preventDefault(){},stopImmediatePropagation(){}};b.onclick(e);};
 assert.equal(f.button('h:2','mirror1').textContent,'↓');assert.equal(f.button('h:2','mirror2').textContent,'↑');
 click(1);assert.equal(f.axes[1].mode,1);click(2);assert.equal(f.axes[1].mode,2);click(2);assert.equal(f.axes[1].mode,0);assert.equal(f.axes[1].p,20);
 assert.equal(f.host.fire('pointerdown',{target:f.button('h:2','mirror1'),clientX:850,clientY:200}).defaultPrevented,false);
});
test('destroy releases capture and removes line and panel listeners',()=>{
 const f=fixture();f.host.fire('pointerdown',{clientX:850,clientY:200});f.view.destroy();assert.equal(f.host.capture,null);
 assert.equal(f.host.fire('pointerdown',{clientX:850,clientY:200}).defaultPrevented,false);
});
test('main-line double click still resets its row, while command buttons do not',()=>{
 const f=fixture();for(const key of ['add','remove','pin','mirror1','mirror2']){f.host.fire('dblclick',{clientX:850,clientY:100,target:f.button('main',key)});assert.equal(f.axes[0].p,10);}
 f.host.fire('dblclick',{clientX:850,clientY:100});assert.equal(f.axes[0].p,0);assert.equal(f.axes[1].p,20);
});
test('coordinate labels opt out of command shortening and expose the full changing value',()=>{
 const f=fixture(),label=f.button('main','label');assert.equal(label.dataset.userLabel,'');
 f.axes[0].p=0;f.render();assert.equal(label.textContent,'Г1 · перед 1');assert.equal(label.attributes['aria-label'],label.textContent);assert.ok(label.title.startsWith(label.textContent+' · '));
 f.axes[0].p=45.5;f.render();assert.equal(label.textContent,'Г1 · строка 46');assert.equal(label.attributes['aria-label'],label.textContent);assert.ok(label.title.startsWith(label.textContent+' · '));
 assert.equal(f.button('main','add').dataset.userLabel,undefined,'commands retain the common text rules');
});
