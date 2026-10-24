// Real menu collector/hooks + real pure/DOM geometry helper, in an isolated DOM model. No page runtime.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const staircase=require('./mayatnik-menu-staircase.js'),read=name=>fs.readFileSync(path.join(__dirname,name),'utf8'),menu=read('mayatnik-menu.js'),standard=read('mayatnik-button-standard.js');
const collection=menu.slice(menu.indexOf('  function stairItems(host) {'),menu.indexOf('  // v0.054:'));
class Style {
  constructor(){this.map=new Map();}
  setProperty(k,v,p=''){this.map.set(k,[String(v),p]);}
  getPropertyValue(k){return this.map.get(k)?.[0]||this[k]||'';}
  getPropertyPriority(k){return this.map.get(k)?.[1]||'';}
  removeProperty(k){this.map.delete(k);delete this[k];}
}
class Element {
  constructor(doc,tag='div',cls='',width=120,height=24){this.ownerDocument=doc;this.nodeType=1;this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attrs={};this.style=new Style();this.natural={left:20,top:20,width,height};this.scrollLeft=this.scrollTop=0;this.className=cls;}
  set className(v){this.classes=new Set(v.split(/\s+/).filter(Boolean));}
  get className(){return [...this.classes].join(' ');}
  get classList(){return {add:(...a)=>a.forEach(c=>this.classes.add(c)),remove:(...a)=>a.forEach(c=>this.classes.delete(c)),contains:c=>this.classes.has(c),toggle:(c,on)=>{if(on??!this.classes.has(c))this.classes.add(c);else this.classes.delete(c);}};}
  append(...a){for(const n of a){n.remove();this.children.push(n);n.parentNode=n.parentElement=this;}}
  prepend(n){n.remove();this.children.unshift(n);n.parentNode=n.parentElement=this;}
  before(n){const parent=this.parentElement;n.remove();parent.children.splice(parent.children.indexOf(this),0,n);n.parentNode=n.parentElement=parent;}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentNode=this.parentElement=null;}
  replaceChildren(...a){for(const n of [...this.children])n.remove();this.append(...a);}
  setAttribute(k,v){this.attrs[k]=String(v);}
  getAttribute(k){return this.attrs[k]??null;}
  get lastElementChild(){return this.children.at(-1);}
  get isConnected(){return true;}
  matches(selector){return selector.split(',').some(s=>{s=s.trim();if(s[0]==='.')return this.classes.has(s.slice(1));if(s[0]==='#')return this.id===s.slice(1);if(s==='input[type="hidden"]')return this.tagName==='INPUT'&&this.type==='hidden';return this.tagName===s.toUpperCase();});}
  querySelector(selector){for(const s of selector.split(',')){const q=s.trim(),direct=q.startsWith(':scope > '),sel=direct?q.slice(9):q;for(const c of this.children){if(c.matches(sel))return c;if(!direct){const found=c.querySelector(sel);if(found)return found;}}}return null;}
  getBoundingClientRect(){
    const r={...this.natural};if(this.matches('.may-standard')){r.width=this.matches('.may-control-mini')?34:120;r.height=24;}
    if(this.matches('.template-record')&&this.children.length===2&&this.children[1].matches('.template-entry-actions')){r.width=120;r.height=24+this.children[1].children.length*26;}
    for(const key of ['width','height']){const n=parseFloat(this.style.getPropertyValue(key));if(Number.isFinite(n))r[key]=n;}
    for(const key of ['left','top']){const v=this.style.getPropertyValue(key),n=parseFloat(v);if(Number.isFinite(n))r[key]=n;}
    if(this.matches('.may-staircase-item')){let host=this.parentElement;while(host&&!host.matches('.may-staircase-host'))host=host.parentElement;const base=host.getBoundingClientRect();r.left=base.left+parseFloat(this.style.getPropertyValue('--may-stair-x'))-host.scrollLeft;r.top=base.top+parseFloat(this.style.getPropertyValue('--may-stair-y'))-host.scrollTop;}
    return {...r,right:r.left+r.width,bottom:r.top+r.height};
  }
}
function fixture(){
  const groups=[],ladders=[],doc={defaultView:{innerWidth:400,innerHeight:240},createElement:tag=>new Element(doc,tag),createElementNS:(ns,tag)=>new Element(doc,tag)};
  const make=(cls='',w=120,h=24)=>new Element(doc,'div',cls,w,h),create=(family,open=true)=>{
    const group=make('gz-group '+(open?'gz-open':'')),head=make('gz-head'),host=make('may-rail-list');if(family==='pt-r'){group.className='pt-g '+(open?'pt-open':'');head.className='pt-l';host.className='pt-r';}
    group.append(head,host);groups.push(group);return {group,head,host};};
  doc.querySelectorAll=selector=>selector==='.gz-ladder'?ladders:groups;
  const ctx=vm.createContext({document:doc,getComputedStyle:el=>({display:el.cssDisplay||''}),window:{mayStaircase:staircase}});
  vm.runInContext(collection,ctx);return {make,create,doc,groups,ladders,ctx,refresh:()=>ctx.window.mayStairRefresh(),apply:(h,a,up=false)=>ctx.stairApply(h,a,up),items:h=>ctx.stairItems(h)};
}

test('all opened pt-r/left rail/imported rail/ladders share one chain; wrappers, pairs, complete inputs and library records stay atomic',()=>{
  const f=fixture();for(const family of ['pt-r','left','imported']){
    const {host,head}=f.create(family),wr=f.make('pt-col'),sec=f.make('pt-sec'),pair=f.make('gz-hx gz-pair may-standard'),left=f.make('gz-half'),right=f.make('gz-half'),field=f.make('gz-hx gz-control may-layer-value may-standard');
    pair.append(left,right);field.append(new Element(f.doc,'input'));sec.append(pair,field);wr.append(sec);host.append(wr);
    const libwrap=f.make('gz-control'),choices=f.make();choices.id='templateLibraryChoices';const record=f.make('template-record',120,76);record.append(f.make('template-entry gz-hx'),f.make('template-actions-pair gz-hx gz-pair'),f.make('template-actions-pair gz-hx gz-pair'));choices.append(record);libwrap.append(choices);host.append(libwrap);
    const hidden=f.make('gz-hx');hidden.hidden=true;host.append(hidden,new Element(f.doc,'svg'));const parents=[pair.parentNode,field.parentNode,record.parentNode];
    f.apply(host,head);assert.deepEqual([...f.items(host)],[pair,field,record]);assert.equal(host._mayStaircase.items.length,3);
    assert.deepEqual(host._mayStaircase.plan.items.map(r=>[r.x,r.y]),[[0,0],[110,14],[220,28]]);assert.equal(host._mayStaircase.items[2].height,76);
    assert.deepEqual([pair.parentNode,field.parentNode,record.parentNode],parents);assert.equal(left.parentNode,pair);assert.equal(right.parentNode,pair);
  }
  const list=f.make('gz-ladder'),owner=f.groups[0].children[0];list.owner=owner;for(let i=0;i<12;i++)list.append(f.make('gz-hx may-standard'));f.ladders.push(list);f.refresh();
  assert.equal(list._mayStaircase.items.length,12);assert.equal(list._mayStaircase.items[11].x-list._mayStaircase.items[0].x,1210);
});

test('repeated menu/adapter ticks preserve mini sizes, tall-card clearance, scroll and callbacks; close restores styles without reparenting',()=>{
  const f=fixture(),{group,host,head}=f.create('pt-r'),first=f.make('gz-hx may-standard'),record=f.make('template-record',120,80),last=f.make('gz-hx may-standard');f.doc.defaultView.innerHeight=100;host.append(first,record,last);
  const click=()=>17;first.onclick=click;host.style.setProperty('width','120px');const parent=first.parentNode;f.apply(host,head);host.scrollLeft=70;host.scrollTop=12;
  for(let tick=0;tick<4;tick++){f.refresh();assert.equal(host.scrollLeft,70);assert.equal(host.scrollTop,12);assert.equal(first.onclick(),17);assert.equal(first.parentNode,parent);}
  let p=host._mayStaircase.plan;assert.equal(p.items[2].y-p.items[1].y,70);first.classList.add('may-control-mini');f.refresh();p=host._mayStaircase.plan;assert.equal(p.items[0].width,34);assert.equal(p.items[1].x-p.items[0].x,24);
  first.classList.remove('may-control-mini');f.refresh();assert.equal(host._mayStaircase.plan.items[1].x,110);assert.equal(host.children.filter(e=>e.dataset.mayStairIgnore).length,1);
  group.classList.remove('pt-open');f.refresh();assert.equal(host._mayStaircase,undefined);assert.equal(host.style.getPropertyValue('width'),'120px');assert.equal(host.children.length,3);assert.equal(first.parentNode,parent);assert.equal(first.onclick,click);
});

test('actual nested-list placement callback overrides shared legacy grid every tick, with no seven-item wrap',()=>{
  const f=fixture(),{host,head}=f.create('pt-r'),owner=f.make('gz-hx may-standard');host.append(owner);f.apply(host,head);const list=f.make('gz-ladder');list.owner=owner;for(let i=0;i<25;i++)list.append(f.make('gz-hx may-standard'));
  // Execute production hideListUnder; the preexisting dim logic is inert in this isolated model.
  const begin=menu.indexOf('  const hideListUnder = (list, owner) => {'),finish=menu.indexOf("  for (const b of document.querySelectorAll('.gz-lst'))",begin);
  f.ctx.document.querySelectorAll=()=>[];owner.closest=()=>null;Object.assign(f.ctx,{activeList:null,scheduleGroups(){},list,owner});vm.runInContext(menu.slice(begin,finish),f.ctx);
  for(let tick=0;tick<3;tick++){list.style.setProperty('width','246px');list.style.setProperty('overflow-x','hidden');vm.runInContext('hideListUnder(list,owner);',f.ctx);assert.equal(list._mayStaircase.items.length,25);assert.equal(list._mayStaircase.plan.items[24].x,2640);assert.equal(list.style.getPropertyValue('overflow-x'),'auto');}
});

test('stair contour walks upper side then lower in reverse, includes a whole tall record, and keeps direct option indices intact',()=>{
  const f=fixture(),{host,head}=f.create('pt-r');host.append(f.make('gz-hx may-standard'),f.make('template-record',120,80),f.make('gz-hx may-standard'));f.apply(host,head);
  const prefix=standard.slice(standard.indexOf("  const NS="),standard.indexOf('  // v0.449: подложка закрытой группы'));
  Object.assign(f.ctx,{host});vm.runInContext(prefix+'\ncontour(host,[],true);',f.ctx);const svg=host.children.find(e=>e.classList.contains('may-standard-contours'));
  assert.equal(host.lastElementChild,svg);const poly=svg.children.find(e=>e.tagName==='POLYGON'),points=poly.attrs.points.split(' ').map(p=>p.split(',').map(Number)),rows=host._mayStaircase.items;
  const last=rows.at(-1),lower=points[rows.length*4];assert.deepEqual(lower,[last.x+last.width-12,last.y+last.height+2]);assert.equal(svg.children.filter(e=>e.tagName==='PATH').length,2,'caps only at both ends, without old per-column frames');
  assert.deepEqual(points.slice(rows.length*4,rows.length*4+4),[[last.x+last.width-12,last.y+last.height+2],[last.x+12,last.y+last.height+2],[last.x-2,last.y+last.height-12],[last.x-2,last.y+12]]);
  f.refresh();vm.runInContext('contour(host,[],true);',f.ctx);assert.equal(host.children.filter(e=>e.classList.contains('may-standard-contours')).length,1);assert.equal(host.children[0],rows[0].element);
});

test('real library normalizer changes raw entry into one record; repeated layout cleans former atomic children and preserves action handlers',()=>{
  const f=fixture(),{host,head}=f.create('pt-r'),wrap=f.make('gz-control'),choices=f.make(),card=f.make('gz-hx template-entry may-standard'),label=f.make('gz-nm'),actions=f.make('template-entry-actions');choices.id='templateLibraryChoices';label.textContent='Моё имя';card.append(label,actions);choices.append(card);wrap.append(choices);host.append(wrap);
  const callbacks=Array.from({length:4},(_,i)=>()=>i);callbacks.forEach(fn=>{const b=new Element(f.doc,'button');b.onclick=fn;actions.append(b);});const originalButtons=[...actions.children];f.apply(host,head);assert.equal(host._mayStaircase.items[0].element,card);
  f.doc.querySelectorAll=selector=>selector==='#templateLibraryChoices > .template-entry'?choices.children.filter(n=>n.matches('.template-entry')):f.groups;
  const normalizer=standard.slice(standard.indexOf('  function libraryRows(){'),standard.indexOf('  function refresh(){'));vm.runInContext(normalizer+'\nlibraryRows();',f.ctx);
  const record=choices.children[0];f.apply(host,head);assert.equal(host._mayStaircase.items.length,1);assert.equal(host._mayStaircase.items[0].element,record);assert.equal(host._mayStaircase.items[0].height,76);
  assert.equal(card.classList.contains('may-staircase-item'),false);assert.equal(card.style.getPropertyValue('position'),'');assert.equal(record.children[1].children.length,2);assert.equal(label.textContent,'Моё имя');
  assert.deepEqual(actions.children.flatMap(pair=>pair.children),originalButtons);originalButtons.forEach((b,i)=>assert.equal(b.onclick,callbacks[i]));
  vm.runInContext('libraryRows();',f.ctx);f.apply(host,head);assert.equal(choices.children.length,1);assert.equal(host.children.filter(n=>n.dataset.mayStairIgnore).length,1);
});
