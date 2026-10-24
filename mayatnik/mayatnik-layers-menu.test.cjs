// Isolated execution of the actual menu installer with a small DOM/registry model; no page or browser.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const menu=fs.readFileSync(path.join(__dirname,'mayatnik-menu.js'),'utf8');
const start=menu.indexOf('  function installLayersMenu(api) {'),end=menu.indexOf('  installLayersMenu(window.mayLayers);',start);
assert.ok(start>0&&end>start);const code=menu.slice(start,end);
class Element {
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attributes={};this.handlers={};this.value='';this.disabled=false;this.isConnected=true;this.style={setProperty(k,v){this[k]=v;}};this.className='';}
  set className(v){this.classes=new Set(v.split(/\s+/).filter(Boolean));}
  get className(){return [...this.classes].join(' ');}
  get classList(){const self=this;return {add(...a){a.forEach(x=>self.classes.add(x));},toggle(k,v){if(v??!self.classes.has(k))self.classes.add(k);else self.classes.delete(k);},contains:k=>self.classes.has(k)};}
  append(...nodes){for(const n of nodes){if(n.parentElement)n.parentElement.children=n.parentElement.children.filter(e=>e!==n);this.children.push(n);n.parentElement=this;}}
  replaceChildren(...nodes){this.children.forEach(n=>n.parentElement=null);this.children=[];this.append(...nodes);}
  querySelector(selector){return this.children.find(n=>selector==='i'?n.tagName==='I':n.classes.has(selector.slice(1)))||this.children.map(n=>n.querySelector(selector)).find(Boolean)||null;}
  setAttribute(k,v){this.attributes[k]=String(v);}
  getAttribute(k){return this.attributes[k]??null;}
  toggleAttribute(k,on){if(on)this.setAttribute(k,'');else delete this.attributes[k];}
  addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);}
  fire(type,event={}){for(const fn of this.handlers[type]||[])fn({target:this,...event});}
  click(){if(!this.disabled){this.onclick?.();this.fire('click');}}
  showPicker(){this.picked=true;}
  getBoundingClientRect(){return {left:20,top:50,right:140,bottom:74,width:120,height:24};}
}
function setup(){
  const calls=[],listeners=new Set(),events={},groups=[],timers=new Map(),layouts=[],document={activeElement:null,createElement:tag=>new Element(tag)};let tid=0;
  let layers=[{id:'original',name:'Оригинал',kind:'original',removable:false},{id:'overlay',name:'Наложение',kind:'overlay',removable:false},{id:'template:7',name:'Мой особенный шаблон',kind:'template',removable:false}].map((d,i)=>({...d,visible:true,opacity:100,tint:null,x:0,y:0,order:i})),selected='overlay';
  const emit=()=>[...listeners].forEach(fn=>fn());
  const api={list:()=>layers.map(d=>({...d})),selected:()=>selected,get:(id=selected)=>layers.find(d=>d.id===id)||null,
    select(id){calls.push(['select',id]);selected=id;emit();},
    set(id,patch){calls.push(['set',id,JSON.parse(JSON.stringify(patch))]);Object.assign(this.get(id),patch);emit();},
    move(id,delta){calls.push(['move',id,delta]);const i=layers.findIndex(d=>d.id===id),j=i+delta;if(j>=0&&j<layers.length)[layers[i],layers[j]]=[layers[j],layers[i]];emit();},
    center(id){calls.push(['center',id]);this.get(id).x=0;emit();},
    capture(id){calls.push(['capture',id]);layers.push({...this.get(id),id:'snapshot:1',name:'Фиксация 1',kind:'snapshot',removable:true});selected='snapshot:1';emit();},
    remove(id){calls.push(['remove',id]);layers=layers.filter(d=>d.id!==id);selected=layers[0]?.id;emit();},
    reset(id){calls.push(['reset',id]);Object.assign(this.get(id),{visible:true,opacity:100,tint:null,x:0,y:0});emit();},
    subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);}};
  const ctx=vm.createContext({document,window:{},ptNames:{},api,innerWidth:800,innerHeight:600,hideListUnder(list,owner){layouts.push([list,owner]);},stairApply(list,owner){layouts.push([list,owner]);},
    ptGroup(name){const group=new Element(),head=new Element('button'),row=new Element();head.textContent=name;group.append(head,row);groups.push(group);return row;},
    ptBtn(n,kind,src,onclick){const b=new Element('button');b.dataset.n=n;b.dataset.miIcon=kind;b.onclick=onclick;b.append(new Element('i'));return b;},
    ZerkGrozd:{listHover(owner,options){owner.gzList=options;}},addEventListener(type,fn){events[type]=fn;},setTimeout(fn,delay){timers.set(++tid,{fn,delay});return tid;},clearTimeout(id){timers.delete(id);}});
  vm.runInContext(code+'\ninstallLayersMenu(api);',ctx);
  const group=groups[0],all=()=>{const out=[];const visit=e=>{out.push(e);e.children.forEach(visit);};visit(group);return out;},button=n=>all().find(e=>e.dataset.n===n),input=key=>all().find(e=>e.id==='mayLayer-'+key);
  return {api,calls,emit,events,listeners,timers,layouts,group,all,button,input,document,ctx,tick(){const [id,t]=timers.entries().next().value;timers.delete(id);t.fn();return t.delay;}};
}

test('real installer creates one ordinary group and nested list; selection preserves user template labels and follows structure changes',()=>{
  const e=setup(),choose=e.button('layerSelect');assert.equal(e.group.dataset.k,'Слои');assert.equal(e.group.children[0].textContent,'Слои');
  assert.equal(choose.getAttribute('aria-haspopup'),'true');const list=new Element();choose.gzList.placed(list,choose);
  assert.equal(list.children.length,3);assert.equal(e.layouts[0][0],list);assert.equal(e.layouts[0][1],choose,'layer list delegates to the common staircase placement');
  const template=list.children.find(b=>b.dataset.layerId==='template:7');assert.equal(template.querySelector('.gz-nm').textContent,'Мой особенный шаблон');assert.equal(template.querySelector('.gz-nm').getAttribute('data-user-label'),'');template.click();
  assert.equal(e.api.selected(),'template:7');assert.equal(choose.querySelector('.gz-nm').textContent,'Мой особенный шаблон');assert.equal(choose.querySelector('.gz-nm').getAttribute('data-user-label'),'');
  e.button('layerCapture').click();assert.equal(list.children.length,4);assert.equal(e.api.selected(),'snapshot:1');assert.equal(list.children.filter(b=>b.classList.contains('gz-on')).length,1);
  e.button('layerRemove').click();assert.equal(list.children.length,3);assert.equal(choose.getAttribute('aria-expanded'),'true');choose.gzList.closed();assert.equal(choose.getAttribute('aria-expanded'),'false');
});

test('native range/input/arrows forward exact settings solely to registry, including opacity0 and signed fractional CSS coordinates',()=>{
  const e=setup(),opacity=e.input('opacity'),x=e.input('x'),y=e.input('y');
  for(const n of [0,25,50,75,100]){opacity.value=String(n);opacity.fire('input');assert.equal(e.api.get().opacity,n);const output=opacity.parentElement.children.find(n=>n.tagName==='OUTPUT');assert.equal(output.textContent,n+'%');}
  x.value='-12.5';x.fire('change');y.value='8.25';y.fire('change');assert.equal(e.api.get().x,-12.5);assert.equal(e.api.get().y,8.25);
  e.button('layer-x').children[0].click();e.button('layer-y').children[2].click();assert.equal(e.api.get().x,-13.5);assert.equal(e.api.get().y,9.25);
  const before=e.calls.length;x.value='';x.fire('change');x.value='bad';x.fire('change');assert.equal(e.calls.length,before);
  e.button('layerVisible').click();assert.equal(e.api.get().visible,false);assert.equal(e.button('layerVisible').getAttribute('aria-pressed'),'false');
  assert.ok(e.calls.every(c=>c[0]==='set'));assert.ok(e.calls.every(c=>c[1]==='overlay'));
});

test('color/native/reset and copy/remove/order target selected layer; unsupported actions are really disabled',()=>{
  const e=setup();assert.equal(e.button('layerRemove').disabled,true);e.button('layerRemove').click();assert.equal(e.calls.length,0);
  e.button('layerTint').click();const colour=e.all().find(n=>n.type==='color');assert.equal(colour.picked,true);colour.value='#a1b2c3';colour.fire('input');assert.equal(e.api.get().tint,'#a1b2c3');assert.equal(e.button('layerTint').getAttribute('aria-pressed'),'true');
  e.button('layerNative').click();assert.equal(e.api.get().tint,null);e.button('layerBack').click();assert.equal(e.calls.at(-1)[0],'move');assert.equal(e.calls.at(-1)[2],-1);assert.equal(e.button('layerBack').disabled,true);
  e.button('layerFront').click();assert.equal(e.calls.at(-1)[2],1);e.button('layerCapture').click();assert.equal(e.button('layerRemove').disabled,false);assert.equal(e.button('layerFront').disabled,true);
  e.api.set(e.api.selected(),{visible:false,opacity:0,tint:'#abcdef',x:-7,y:21});e.button('layerReset').click();assert.deepEqual(JSON.parse(JSON.stringify(e.api.get())),{id:'snapshot:1',name:'Фиксация 1',kind:'snapshot',removable:true,visible:true,opacity:100,tint:null,x:0,y:0,order:1});
  e.button('layerRemove').click();assert.equal(e.calls.at(-1)[0],'remove');assert.equal(e.api.get('snapshot:1'),null);
});

test('subscription updates external selection/settings, preserves active number editing, and unsubscribes on pagehide',()=>{
  const e=setup();assert.equal(e.listeners.size,1);e.api.select('original');assert.equal(e.button('layerBack').disabled,true);assert.match(e.button('layerSelect').title,/Оригинал/);
  const x=e.input('x');e.document.activeElement=x;x.value='-1.25';e.api.set('original',{opacity:0,x:70});assert.equal(x.value,'-1.25');assert.equal(e.input('opacity').value,'0');
  e.document.activeElement=null;e.emit();assert.equal(x.value,'70');e.events.pagehide();assert.equal(e.listeners.size,0);
  for(const b of e.all().filter(n=>n.tagName==='BUTTON'&&n.dataset.n))assert.equal(b.getAttribute('aria-label'),b.title,'full accessible descriptions stay intact');
  assert.ok(!code.includes('setInterval'));assert.ok(!code.includes('toolSync.push'));assert.ok(!code.includes('draw('));assert.ok(!code.includes('rebuild'));
});

test('arrow hold repeats through registry and stops on release; absent raster disables capture, absent selection disables editing',()=>{
  const e=setup(),arrow=e.button('layer-x').children[0];arrow.fire('pointerdown',{button:0});assert.equal(e.tick(),350);assert.equal(e.tick(),80);assert.equal(e.api.get().x,-2);
  e.events.pointerup();assert.equal(e.timers.size,0);arrow.onclick({detail:1});assert.equal(e.api.get().x,-2,'release click does not add another step');arrow.onclick({detail:1});assert.equal(e.api.get().x,-3);
  Object.assign(e.api.get(),{capturable:false});e.emit();assert.equal(e.button('layerCapture').disabled,true);const count=e.calls.length;e.button('layerCapture').click();assert.equal(e.calls.length,count);
  e.api.select('missing');assert.equal(e.button('layerSelect').disabled,false,'existing layers remain selectable');assert.equal(e.input('x').disabled,true);assert.equal(e.button('layerVisible').disabled,true);assert.equal(e.button('layerReset').disabled,true);
});

test('По оси uses selected layer registry capability; does not edit Y/opacity or operate on incompatible layers',()=>{
  const e=setup(),button=e.button('layerCenter');assert.equal(button.disabled,true);const before=e.calls.length;button.click();assert.equal(e.calls.length,before);
  e.api.set('overlay',{centerable:true,x:19,y:-7,opacity:0,visible:false});button.click();assert.deepEqual(e.calls.at(-1),['center','overlay']);assert.equal(e.api.get().x,0);assert.equal(e.api.get().y,-7);assert.equal(e.api.get().opacity,0);assert.equal(e.api.get().visible,false);
  assert.equal(button.getAttribute('aria-label'),button.title);assert.match(button.title,/оси оригинала/);
  e.api.select('original');assert.equal(button.disabled,true);e.api.select('template:7');assert.equal(button.disabled,true);e.api.select('overlay');e.button('layerCapture').click();assert.equal(button.disabled,false);button.click();assert.deepEqual(e.calls.at(-1),['center','snapshot:1']);
});

test('real Площади button По оси is inserted, migrated and calls mayOvl.center only when capability allows',()=>{
  const buttons={},inserted=[],areas=[],sync=[];let centers=0,layouts=0,centerable=false;
  const e=vm.createContext({document:{createElement:()=>({})},window:{mayOvl:{get:()=>({n:1,h0:8,pos:'G',alpha:50,centerable}),center(){centers++;}}},placeTools(){layouts++;},toolSync:sync,
    ptBtn(n,kind,src,onclick){return buttons[n]={dataset:{n},onclick,classList:{toggle(){}},querySelector:()=>null,setAttribute(k,v){this[k]=v;}};},
    gView:{querySelector:()=>({after(...nodes){inserted.push(...nodes);}})},tools:{querySelector:s=>inserted.find(b=>s==='[data-n='+b.dataset.n+']')},gAreas:{append:b=>areas.push(b)}});
  const placement=menu.match(/gView\.querySelector\('\[data-n="fixMirror"\]'\)\.after\([^;]+;/)[0],migration=menu.split('\n').find(line=>line.includes("for (const n of ['sawFull'")&&line.includes("'ovlCenter'"));
  const block=menu.slice(menu.indexOf('    const ovp ='),menu.indexOf('    // v0.270:'));
  for(const name of placement.slice(placement.indexOf('.after(')+7,-2).split(',').map(x=>x.trim()))e[name]={dataset:{n:name}};
  vm.runInContext(block+'\n'+placement+'\n'+migration,e);const button=areas.find(b=>b.dataset.n==='ovlCenter');assert.ok(button);sync[0]();assert.equal(button.disabled,true);button.onclick();assert.equal(centers,0);
  centerable=true;sync[0]();assert.equal(button.disabled,false);button.onclick();assert.equal(centers,1);assert.equal(layouts,2);assert.equal(button['aria-label'],button.title);
});
