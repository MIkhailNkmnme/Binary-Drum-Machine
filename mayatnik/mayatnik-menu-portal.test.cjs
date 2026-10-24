const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const menu=fs.readFileSync(path.join(__dirname,'mayatnik-menu.js'),'utf8'),grozd=fs.readFileSync(path.join(__dirname,'../_js/grozd.js'),'utf8');
const standard=fs.readFileSync(path.join(__dirname,'mayatnik-button-standard.js'),'utf8');
class Classes{
 constructor(){this.s=new Set()} add(...xs){xs.forEach(x=>this.s.add(x))} remove(...xs){xs.forEach(x=>this.s.delete(x))}
 contains(x){return this.s.has(x)} toggle(x,v){if(v===undefined)v=!this.contains(x);v?this.add(x):this.remove(x)}
}
class Node{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.classList=new Classes();this.listeners={};this.style={setProperty(k,v,p){this[k]=v;this[k+'Priority']=p||''},getPropertyValue(k){return this[k]||''}};this.rect={left:20,right:140,top:50,bottom:74,width:120,height:24};this.hover=false;this.hidden=false;this.appends=0;}
 set className(s){this.classList=new Classes();this.classList.add(...s.split(' '))}
 get parentElement(){return this.parentNode} get isConnected(){return !!(this.root||this.parentNode?.isConnected)}
 append(...xs){for(const x of xs){x.remove();x.parentNode=this;this.children.push(x);this.appends++}}
 remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(x=>x!==this);this.parentNode=null}}
 addEventListener(t,f){(this.listeners[t]??=[]).push(f)}
 emit(t,e={}){e={target:this,pointerType:'mouse',button:0,stopPropagation(){},...e};for(const f of this.listeners[t]||[])f(e)}
 matches(s){if(s===':hover')return this.hover;return s.split(',').some(q=>q.trim().startsWith('.')&&this.classList.contains(q.trim().slice(1)))}
 closest(s){return this.matches(s)?this:this.parentNode?.closest(s)||null}
 contains(x){return x===this||this.children.some(c=>c.contains(x))}
 querySelectorAll(s){if(s===':scope > .gz-hx')return this.children.filter(x=>x.matches('.gz-hx'));return this.children.flatMap(x=>[...(x.matches(s)?[x]:[]),...x.querySelectorAll(s)])}
 getBoundingClientRect(){return this.rect} getClientRects(){return this.hidden||this.closest('.test-hidden')?[]:[this.rect]}
 get offsetWidth(){return parseFloat(this.style.width)||120} get offsetHeight(){return this.children.length*26}
 setAttribute(k,v){this[k]=v}
}
function fixture(){
 const body=new Node('body');body.root=true;const doc=new Node();doc.body=body;doc.documentElement=new Node();doc.createElement=t=>new Node(t);doc.querySelectorAll=s=>body.querySelectorAll(s);
 let now=0,id=0;const timers=new Map(),win=new Node();
 const ctx={document:doc,window:{},innerWidth:800,innerHeight:600,getComputedStyle:b=>({font:'12px Consolas',getPropertyValue:k=>b.style.getPropertyValue(k)}),
  setTimeout(f,ms){timers.set(++id,{at:now+ms,f});return id},clearTimeout(i){timers.delete(i)},addEventListener:win.addEventListener.bind(win),removeEventListener(){},scheduleGroups(){},decorateViewPalette(){},performance:{now:()=>now}};
 vm.createContext(ctx);
 // Execute only the real shared list controller, not rail/adopt or any page application.
 const start=grozd.indexOf("  const NS ="),end=grozd.indexOf('  const PIN =');
 vm.runInContext(grozd.slice(start,end)+';window.ZerkGrozd={listHover};globalThis.sync=ladderSync;globalThis.sharedClose=closeLadder;',ctx);
 const a=menu.indexOf('  let activeList=null;'),b=menu.indexOf("  for (const b of document.querySelectorAll('.gz-lst')",a);
 vm.runInContext(menu.slice(a,b)+';globalThis.place=hideListUnder;globalThis.closed=clearListUnder;globalThis.containsPopup=popupContains;',ctx);
 const group=new Node();group.className='pt-g';body.append(group);const column=new Node();column.className='pt-r';group.append(column);
 const owner=new Node('button');column.append(owner);owner.style.setProperty('--gz-bg','#123');owner.style.setProperty('--gz-n','12px');
 let picks=0,open=group,shuts=0;
 Object.assign(ctx,{g:group,stay:()=>false,shut:()=>{shuts++;open=null;group.classList.add('test-hidden')}});
 Object.defineProperty(ctx,'open',{get:()=>open,set:v=>{open=v}});
 const na=menu.indexOf('      g._popupLeave ='),nb=menu.indexOf('      toolSync.push',na);
 vm.runInContext(menu.slice(na,nb),ctx);
 const outside=menu.match(/    addEventListener\('pointerdown', e => \{ if \(open && !open\.contains\(e\.target\)[^\n]+/)[0];vm.runInContext(outside,ctx);
 function bind(button=owner,extra={}){ctx.window.ZerkGrozd.listHover(button,{options:()=>[{name:'Consolas',pick:()=>picks++},{name:'Mono',pick:()=>picks++}],host:()=>group,color:()=>'#abc',placement:'right',placed:ctx.place,closed:ctx.closed,...extra})}
 bind();
 return {body,doc,win,ctx,group,column,owner,bind,get picks(){return picks},get shuts(){return shuts},get list(){return body.children.find(x=>x.matches('.gz-ladder'))},
  tick(ms){const end=now+ms;for(;;){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].f()}now=end},
  reopen(){group.classList.remove('test-hidden');open=group;owner.emit('pointerenter')}};
}
test('real grozd opens a body portal once; refresh, mini size and option handlers survive',()=>{
 const f=fixture();f.owner.emit('pointerenter');const list=f.list,option=list.children[0],appends=f.body.appends;
 assert.equal(list.owner,f.owner);assert.equal(list.parentNode,f.body);assert.equal(list.style['--c'],'#abc');assert.equal(list.style.font,'12px Consolas');
 assert.equal(list.style['--gz-bg'],'#123');assert.equal(f.group.classList.contains('may-popup-owner'),false);
 for(let i=0;i<5;i++){f.tick(400);f.ctx.sync()}assert.equal(f.list,list);assert.equal(f.body.appends,appends);assert.equal(list.children[0],option);
 f.owner.rect={...f.owner.rect,width:34,right:54};f.ctx.sync();assert.equal(f.list,list);assert.equal(list.style.width,'120px');
 f.win.emit('pointerdown',{target:option});f.doc.emit('pointerdown',{target:option});option.emit('click');assert.equal(f.picks,1);assert.equal(f.shuts,0);
 f.ctx.sharedClose();assert.equal(f.list,undefined);assert.equal(f.ctx.containsPopup(f.group),false);f.reopen();assert.notEqual(f.list,list);
});
test('native group -> portal longer than350ms -> outside closes both without click-through',()=>{
 const f=fixture();f.reopen();const list=f.list;f.group.emit('pointerleave');f.owner.emit('pointerleave');list.hover=true;list.emit('pointerenter');
 f.tick(600);assert.equal(f.shuts,0);assert.ok(f.list);
 list.hover=false;list.emit('pointerleave');f.tick(650);assert.equal(f.list,undefined);assert.equal(f.shuts,1);
 f.reopen();const target=new Node();f.body.append(target);f.win.emit('pointerdown',{target});f.doc.emit('pointerdown',{target});assert.equal(f.list,undefined);assert.equal(f.shuts,2);
});
test('switching, Escape and hidden source use shared lifecycle without closing a hovered new popup',()=>{
 const f=fixture();f.reopen();const first=f.list,second=new Node('button');f.column.append(second);f.bind(second);
 second.emit('pointerenter');f.tick(280);assert.notEqual(f.list,first);const next=f.list;next.hover=true;next.emit('pointerenter');f.tick(700);assert.equal(f.shuts,0);
 f.win.emit('keydown',{key:'Escape'});assert.equal(f.list,undefined);
 f.reopen();f.owner.hidden=true;f.ctx.sync();assert.equal(f.list,undefined);assert.equal(f.ctx.containsPopup(f.group),false);
});
test('layer chooser keeps custom placed/closed callbacks and live options after portal refresh',()=>{
 const f=fixture();let closed=0,placed=0;
 f.bind(f.owner,{placement:'below',placed(list,owner){placed++;list.classList.add('may-layer-options');f.ctx.place(list,owner);list.style.width='120px'},closed(){closed++;f.ctx.closed()}});
 f.reopen();const list=f.list,initialPlaced=placed;for(let i=0;i<3;i++){f.tick(400);f.ctx.sync()}
 assert.equal(f.list,list);assert.equal(list.parentNode,f.body);assert.equal(placed,initialPlaced+3);list.children[1].emit('click');assert.equal(f.picks,1);
 f.doc.emit('pointerdown',{target:f.body});assert.equal(closed,1);assert.equal(f.list,undefined);
});

test('production SVG contour cannot shift any selected option during real shared list synchronization',()=>{
 const f=fixture();let selected=2;f.bind(f.owner,{options:()=>['Выкл','Левая','Правая','Обе'].map((name,i)=>({name,on:i===selected,pick:()=>selected=i}))});f.reopen();const list=f.list;
 list.querySelector=s=>list.children.find(n=>n.classList.contains('may-standard-contours'))||null;
 list.prepend=n=>{n.remove();n.parentNode=list;list.children.unshift(n)};
 list.scrollLeft=list.scrollTop=0;
 const c={getComputedStyle:()=>({overflowY:'visible'}),gradN:0,svg(cls){const n=new Node('svg');n.className=cls;n.dataset={};n.replaceChildren=()=>{n.children=[]};return n;},list,cells:list.querySelectorAll(':scope > .gz-hx')};vm.createContext(c);
 const a=standard.indexOf('  function contour('),b=standard.indexOf('  // v0.449: подложка закрытой',a);vm.runInContext(standard.slice(a,b)+';contour(list,cells,true);',c);
 assert.equal(list.children.at(-1).tagName,'svg');
 for(let i=0;i<4;i++){selected=i;f.ctx.sync();assert.deepEqual(list.querySelectorAll(':scope > .gz-hx').map(n=>n.classList.contains('gz-on')),[0,1,2,3].map(j=>i===j));}
 list.children[1].emit('click');assert.equal(selected,1);assert.equal(list.children[1].classList.contains('gz-on'),true);
});
