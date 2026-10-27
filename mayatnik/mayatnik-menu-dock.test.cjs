const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('./mayatnik-menu-dock.js'),H=require('./mayatnik-center-hover.js');
test('four strips use button dimensions and exact repeat intervals',()=>{
 const s=D.slots({left:8,right:1000,topX:160,topY:8,bottomY:760,sideY:62});
 assert.deepEqual([...new Set(s.map(p=>p.edge))],['top','bottom','left','right']);
 for(const edge of ['top','bottom','left','right']){const a=s.filter(p=>p.edge===edge);for(let i=1;i<a.length;i++)assert.equal(edge==='top'||edge==='bottom'?a[i].x-a[i-1].x:a[i].y-a[i-1].y,edge==='top'||edge==='bottom'?126:26);}
 assert.ok(s.every(p=>p.w===120&&p.h===24&&p.x>=8&&p.x+120<=1000&&p.y+24<=784));
});
test('magnet chooses nearest free slot, with exact shared edge collision handling',()=>{
 const a={edge:'left',index:0,x:8,y:62,w:120,h:24},b={...a,index:1,y:88};assert.equal(D.overlap(a,b),false);assert.equal(D.overlap(a,{...b,y:87}),true);
 assert.equal(D.nearest([a,b],68,99),b);assert.equal(D.nearest([],0,0),null);
});
test('side strips own lower corners and bottom slots stay between them at desktop widths',()=>{
 for(const right of [597,796,996,1436]){
  const s=D.slots({left:8,right,topX:160,topY:8,bottomY:756,sideY:58,sideBottom:796}),bottom=s.filter(p=>p.edge==='bottom'),sides=s.filter(p=>['left','right'].includes(p.edge));
  assert.ok(bottom.every(p=>p.x>=8+D.DX&&p.x+p.w<=right-D.DX));
  assert.ok(sides.every(p=>p.y+p.h+2<=796));assert.ok(sides.some(p=>p.y>756),'side strip reaches below the footer headers');
  for(const b of bottom)for(const side of sides)assert.equal(D.overlap(b,side),false);
 }
 const narrow=D.slots({left:200,right:500,topX:200,topY:8,bottomY:756,sideY:58,sideBottom:796});assert.equal(narrow.filter(p=>p.edge==='bottom').length,0);
});
test('saved coordinates accept only four strips and nonnegative integer slots',()=>{
 assert.deepEqual(D.read({a:{edge:'right',index:7},b:{edge:'free',index:3},c:{edge:'top',index:-1},d:{edge:'left',index:.5}}),{a:{edge:'right',index:7}});
});
function fixture(saved={},options={}){
 const events=new Map(),docEvents=new Map(),frames=[],store=new Map(Object.entries(saved));let width=1000;
 const listen=(map)=>(type,fn)=>{if(!map.has(type))map.set(type,[]);map.get(type).push(fn);};
 class El{constructor(box={left:0,top:0,width:120,height:24}){this.box=box;this.children=[];this.dataset={};this.attrs={};const set=new Set();this.classList={add:(...v)=>v.forEach(x=>set.add(x)),remove:(...v)=>v.forEach(x=>set.delete(x)),contains:x=>set.has(x),toggle:(x,on)=>on?set.add(x):set.delete(x)};this.style={getPropertyValue:k=>this.style[k]||'',setProperty:(k,v)=>this.style[k]=v};this.scrollTop=0;this.events={};this.offsetWidth=box.width;}
  addEventListener(t,fn){this.events[t]=fn;}
  getBoundingClientRect(){return {...this.box,right:this.box.left+this.box.width,bottom:this.box.top+this.box.height};}getClientRects(){return [this.box];}setAttribute(k,v){this.attrs[k]=v;}append(n){this.children.push(n);n.parentElement=this;}replaceChildren(){this.children=[];}querySelector(){return this.hd;}closest(s){return s.includes('.pt-l')?this:null;}}
 const body=new El(),rail=new El({left:8,top:60,width:120,height:650}),tools=new El({left:160,top:8,width:830,height:42}),header=new El({left:0,top:0,width:1000,height:50}),footer=new El({left:0,top:752,width:1000,height:32});
 const gs=[0,1].map(i=>{const g=new El();g.id='g'+i;g.hd=new El({left:8,top:62+i*26,width:120,height:24});g.parentElement=rail;return g;});
 const ctx={module:{exports:{}},globalThis:null,document:{body,createElement:()=>new El(),createElementNS:()=>new El(),addEventListener:listen(docEvents)},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},addEventListener:listen(events),requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},setTimeout:()=>0,get innerWidth(){return width;}};ctx.globalThis=ctx;
 vm.runInNewContext(fs.readFileSync(require.resolve('./mayatnik-menu-dock.js'),'utf8'),ctx);
 const dock=ctx.module.exports.mount({groups:()=>gs,idOf:g=>g.id,header,tools,footer,rail,rightEdge:()=>width,moveToTools:g=>tools.append(g),onLayout:()=>{},...options});frames.splice(0).forEach(fn=>fn());
 const event=(type,props={},doc=false)=>{const e={type,button:0,pointerId:1,preventDefault(){},stopImmediatePropagation(){},...props};for(const fn of (doc?docEvents:events).get(type)||[])fn(e);};
 return {gs,dock,store,event,body,rail,footer,flush(){frames.splice(0).forEach(fn=>fn());},resize(w,h){width=w;if(h!==undefined)ctx.innerHeight=h;event('resize');}};
}
test('saved bottom indexes stay bottom through shortened strip, resize and mobile restoration',()=>{
 const saved=JSON.stringify({g0:{edge:'bottom',index:7},g1:{edge:'right',index:26}}),f=fixture({'mayatnik-menu-dock-v509':saved});
 assert.equal(f.gs[0].dataset.dockEdge,'bottom');assert.equal(f.gs[0].style['--may-dock-x'],'638px');assert.equal(f.gs[1].style['--may-dock-y'],'734px');
 f.resize(800,900);assert.equal(f.gs[0].style['--may-dock-x'],'512px');assert.equal(f.gs[0].dataset.dockEdge,'bottom');
 f.gs[1].box.height=1000;f.dock.refresh();const bar=f.body.children.find(n=>n.dataset.edge==='right');assert.equal(parseFloat(bar.style.top)+parseFloat(bar.style.height),896,'side clipping follows viewport height independently of footer');
 f.resize(500);assert.equal(f.gs[0].classList.contains('may-docked'),false);f.resize(1000,784);assert.equal(f.gs[0].style['--may-dock-x'],'638px');assert.equal(f.store.get('mayatnik-menu-dock-v509'),saved,'temporary clamping preserves original saved indexes');
});
test('moving frame controls relocate overlapping headers without changing saved slots',()=>{
 let visible=true;const box={left:900,top:8,width:90,height:24},bar={getClientRects:()=>visible?[box]:[],getBoundingClientRect:()=>({...box,right:box.left+box.width,bottom:box.top+box.height})};
 const f=fixture({},{defaultEdge:'top',excluded:[bar],stackSides:false}),saved=f.store.get('mayatnik-menu-dock-v509'),original=f.gs.map(g=>g.style['--may-dock-x']);
 box.left=parseFloat(original[0])+60;box.width=242;f.dock.refresh();
 for(const g of f.gs){const r={x:parseFloat(g.style['--may-dock-x']),y:parseFloat(g.style['--may-dock-y']),w:120,h:24};assert.equal(D.overlap(r,{x:box.left,y:box.top,w:box.width,h:box.height}),false);}
 assert.equal(f.store.get('mayatnik-menu-dock-v509'),saved);assert.notEqual(f.gs[0].style['--may-dock-x'],original[0]);
 visible=false;f.dock.refresh();assert.deepEqual(f.gs.map(g=>g.style['--may-dock-x']),original);assert.equal(f.store.get('mayatnik-menu-dock-v509'),saved);
});
test('real controller snaps drag to right strip and persists slot, never raw pixels',()=>{
 const f=fixture();f.event('pointerdown',{target:f.gs[0].hd,clientX:68,clientY:74},true);f.event('pointermove',{clientX:936,clientY:270});f.event('pointerup',{clientX:936,clientY:270});
 const saved=JSON.parse(f.store.get('mayatnik-menu-dock-v509'));assert.equal(saved.g0.edge,'right');assert.equal(saved.g0.index,8);assert.deepEqual(Object.keys(saved.g0).sort(),['edge','index']);assert.equal(f.gs[0].style['--may-dock-x'],'876px');
 const restored=fixture({'mayatnik-menu-dock-v509':JSON.stringify(saved)});assert.equal(restored.gs[0].dataset.dockEdge,'right');assert.equal(restored.gs[0].style['--may-dock-y'],'266px');
});
test('dragging into a lower corner lands on the extended side strip',()=>{
 const f=fixture();f.resize(1000,800);
 f.event('pointerdown',{target:f.gs[0].hd,clientX:68,clientY:74},true);f.event('pointermove',{clientX:936,clientY:772});f.event('pointerup',{clientX:936,clientY:772});
 const saved=JSON.parse(f.store.get('mayatnik-menu-dock-v509'));assert.deepEqual(saved.g0,{edge:'right',index:27});assert.equal(f.gs[0].style['--may-dock-y'],'760px');
});
test('Escape and pointercancel restore last slot without changing storage',()=>{
 for(const cancel of ['keydown','pointercancel']){const f=fixture(),before=f.store.get('mayatnik-menu-dock-v509');f.event('pointerdown',{target:f.gs[0].hd,clientX:68,clientY:74},true);f.event('pointermove',{clientX:936,clientY:270});f.event(cancel,{key:'Escape'});assert.equal(f.store.get('mayatnik-menu-dock-v509'),before);assert.equal(f.gs[0].style['--may-dock-x'],'8px');}
});
test('resize relocates right slots while preserving stored preference and mobile disables fixed docking',()=>{
 const f=fixture({'mayatnik-menu-dock-v509':JSON.stringify({g0:{edge:'right',index:2}})});f.resize(800);assert.equal(f.gs[0].style['--may-dock-x'],'676px');f.resize(500);assert.equal(f.gs[0].classList.contains('may-docked'),false);f.resize(1000);assert.equal(f.gs[0].style['--may-dock-x'],'876px');
});
test('centre hover hits the point only, not every axis inside radius 20',()=>{
 assert.deepEqual(H.nearest([[100,100],[200,200]],106,100),[100,100]);assert.equal(H.nearest([[100,100]],109,100),null);
});
test('only incident axes highlight; radius stays 20 in screen space at different zooms',()=>{
 for(const scale of [.25,1,8]){const lines=[{a:[-1000*scale,0],b:[1000*scale,0]},{a:[0,-1000*scale],b:[0,1000*scale]},{a:[2,2],b:[30,2]}],out=H.incident(lines,[0,0]);assert.equal(out.length,2);for(const l of out)for(const p of [l.a,l.b])assert.ok(Math.abs(Math.hypot(...p)-20)<1e-8);}
 const diagonal=H.incident([{a:[-100,-100],b:[100,100]}],[0,0])[0];assert.ok(Math.abs(Math.hypot(...diagonal.b)-20)<1e-8);
});
test('actual three-choice geometry implements /Xr/, backslash-Xr-slash, and two backslashes',()=>{
 const src=fs.readFileSync(require.resolve('./mayatnik-button-standard.js'),'utf8'),code=src.slice(src.indexOf('  function choiceShape('),src.indexOf('  function parts(')),ctx={};vm.runInNewContext(code,ctx);
 assert.equal(ctx.choiceShape(3,1,0),'8,0 48,0 40,24 0,24');assert.equal(ctx.choiceShape(3,1,1),'0,0 48,0 40,24 8,24');assert.equal(ctx.choiceShape(3,1,2),'0,0 40,0 48,24 8,24');
 assert.notEqual(ctx.choiceShape(2,0,0),ctx.choiceShape(2,0,1));
});

test('mini header remains centred in its existing slot after width change',()=>{
 const f=fixture();f.gs[0].hd.offsetWidth=48;f.dock.refresh();assert.equal(f.gs[0].style['--may-dock-x'],'44px');
 f.gs[0].hd.offsetWidth=120;f.dock.refresh();assert.equal(f.gs[0].style['--may-dock-x'],'8px');
});

test('production part adapter ignores interleaved labels, preserves independent states and has only straight edges',()=>{
 const src=fs.readFileSync(require.resolve('./mayatnik-button-standard.js'),'utf8'),code=src.slice(src.indexOf('  function choiceShape('),src.indexOf('  function keyboard('));
 class Node{constructor(cls=''){this.children=[];this.dataset={};this.attrs={};const c=new Set(cls.split(' '));this.classList={contains:k=>c.has(k),add:k=>c.add(k),toggle:(k,v)=>v?c.add(k):c.delete(k)};this.style={setProperty:(k,v)=>this.style[k]=v};}append(n){this.children.push(n)}replaceChildren(){this.children=[]}setAttribute(k,v){this.attrs[k]=v}querySelector(q){return this.children.find(n=>n.classList.contains(q.split('.').pop()))||null}querySelectorAll(){return this.children.filter(n=>n.classList.contains('gz-half'))}closest(){return null}}
 const ctx={svg:cls=>new Node(cls),shape:(s,kind,a)=>{const n=new Node(a.class||'');n.kind=kind;n.attrs=a;s.append(n);},set:(h,k,v)=>h.setAttribute(k,v),keyboard:()=>{}};vm.runInNewContext(code,ctx);
 for(const exclusive of [false,true]){const b=new Node(exclusive?'may-segments':'gz-split3'),hs=[0,1,2].map(i=>new Node('gz-half'+(i!==1?' gz-on':'')));b.append(new Node('gz-pm'));hs.forEach(h=>b.append(h));ctx.parts(b);
  assert.deepEqual(hs.map(h=>h.dataset.mayPart),['0','1','2']);assert.deepEqual(hs.map(h=>h.attrs['aria-pressed']),['true','false','true']);
  if(!exclusive){assert.equal(b.classList.contains('may-parts-multi'),true);for(const h of hs){assert.ok(!/[QCA]/.test(h.style['clip-path']));assert.equal(h.querySelector('.may-half-outline').children[0].kind,'path');}}
  else assert.deepEqual(hs.map(h=>h.querySelector('.may-half-outline').attrs.viewBox),['0 0 44 24','0 0 48 24','0 0 44 24']);
 }
});

test('open side groups push following headers by grid steps and collapsing restores base positions',()=>{
 const closed=D.stackPositions([{index:0,y:58,height:24},{index:1,y:84,height:24}],58,500);assert.deepEqual(closed.rows.map(r=>r.screenY),[58,84]);
 const open=D.stackPositions([{index:0,y:58,height:286},{index:1,y:84,height:132}],58,500);assert.deepEqual(open.rows.map(r=>r.screenY),[58,370]);assert.equal(open.maxScroll,4);assert.equal(D.stackPositions([{index:0,y:58,height:24},{index:1,y:84,height:24}],58,500,200).offset,0);
});
test('side column scroll exposes lower groups without changing saved grid slots; closed height resets scroll',()=>{
 const f=fixture({'mayatnik-menu-dock-v509':JSON.stringify({g0:{edge:'left',index:0},g1:{edge:'left',index:1}})}),saved=f.store.get('mayatnik-menu-dock-v509');f.gs[0].box.height=780;f.dock.refresh();assert.equal(f.gs[1].style['--may-dock-y'],'864px');
 const bar=f.body.children.find(n=>n.dataset.edge==='left');assert.equal(bar.style.display,'block');bar.scrollTop=100;bar.events.scroll();f.flush();assert.equal(f.gs[1].style['--may-dock-y'],'764px');assert.equal(f.gs[0].style['--may-side-clip-top'],'100px');let stopped=false;f.event('wheel',{target:{closest:()=>f.gs[0]},deltaY:999,deltaMode:0,preventDefault(){stopped=true;}},true);f.flush();assert.equal(stopped,true);assert.equal(f.gs[1].style['--may-dock-y'],'754px');assert.equal(f.store.get('mayatnik-menu-dock-v509'),saved);
 f.gs[0].box.height=24;f.dock.refresh();assert.equal(bar.style.display,'none');assert.equal(bar.scrollTop,0);assert.equal(f.gs[1].style['--may-dock-y'],'84px');
});
test('overflow wheel first reaches an edge then wraps on the next outward wheel',()=>{
 const f=fixture({'mayatnik-menu-dock-v509':JSON.stringify({g0:{edge:'left',index:0},g1:{edge:'left',index:1}})}),saved=f.store.get('mayatnik-menu-dock-v509');f.gs[0].box.height=780;f.dock.refresh();
 const bar=f.body.children.find(n=>n.dataset.edge==='left'),max=parseFloat(bar.children[0].style.height)-parseFloat(bar.style.height),target={closest:()=>f.gs[0]};
 const wheel=(delta,extra={})=>{f.event('wheel',{target,deltaY:delta,deltaMode:0,...extra},true);f.flush();};
 wheel(60);assert.equal(bar.scrollTop,60);wheel(1000);assert.equal(bar.scrollTop,max,'overshoot from the middle lands at the bottom');
 wheel(1);assert.equal(bar.scrollTop,0);wheel(-1);assert.equal(bar.scrollTop,max);wheel(-1000);assert.equal(bar.scrollTop,0);
 for(const extra of [{ctrlKey:true},{defaultPrevented:true}]){wheel(60,extra);assert.equal(bar.scrollTop,0);}
 assert.equal(f.store.get('mayatnik-menu-dock-v509'),saved);
});
test('side wheel leaves sliders, editable fields, cycle controls and nested scrolling lists alone',()=>{
 const f=fixture({'mayatnik-menu-dock-v509':JSON.stringify({g0:{edge:'left',index:0},g1:{edge:'left',index:1}})});f.gs[0].box.height=780;f.dock.refresh();const bar=f.body.children.find(n=>n.dataset.edge==='left');
 for(const selector of ['input','textarea','select','[role="slider"]','.gz-control','.gz-ladder','[data-n="fontCycle"]','[data-n="sizeCtl"]','[data-n="viewCycle"]']){
  const control={matches:selectors=>selectors.includes(selector)},target={closest:selectors=>selectors==='.may-dock-side'?f.gs[0]:control};let stopped=false;
  f.event('wheel',{target,deltaY:80,deltaMode:0,preventDefault(){stopped=true;}},true);f.flush();assert.equal(bar.scrollTop,0,selector);assert.equal(stopped,false,selector);
 }
});

test('wheel over field gaps routes the entire occupied side column before the canvas handler',()=>{
 for(const edge of ['left','right']){const f=fixture({'mayatnik-menu-dock-v509':JSON.stringify({g0:{edge,index:0},g1:{edge,index:1}})});f.gs[0].box.height=780;f.dock.refresh();
  const bar=f.body.children.find(n=>n.dataset.edge===edge),x=edge==='left'?68:936,wrap={id:'wrap',scrollHeight:2000,clientHeight:700,closest:s=>s==='#wrap'?wrap:null};let stopped=false;
  f.event('wheel',{target:wrap,clientX:x,clientY:200,deltaY:60,deltaMode:0,preventDefault(){stopped=true;}},true);f.flush();assert.equal(bar.scrollTop,60);assert.equal(stopped,true);
  for(const [clientX,clientY]of [[x,57],[x,781],[edge==='left'?131:873,200]]){stopped=false;f.event('wheel',{target:wrap,clientX,clientY,deltaY:10,deltaMode:0,preventDefault(){stopped=true;}},true);f.flush();assert.equal(bar.scrollTop,60);assert.equal(stopped,false,'outside column stays with canvas');}
  f.resize(500);f.event('wheel',{target:wrap,clientX:x,clientY:200,deltaY:60,deltaMode:0},true);f.flush();assert.equal(bar.scrollTop,60,'mobile never uses fixed column gap routing');
 }
});

test('gap routing protects short columns while leaving overlays and hidden menus alone',()=>{
 const f=fixture({'mayatnik-menu-dock-v509':JSON.stringify({g0:{edge:'left',index:0},g1:{edge:'left',index:1}})}),bar=f.body.children.find(n=>n.dataset.edge==='left'),wrap={id:'wrap',closest:s=>s==='#wrap'?wrap:null};
 let stopped=false;const wheel=(target,clientY=200)=>f.event('wheel',{target,clientX:68,clientY,deltaY:60,deltaMode:0,preventDefault(){stopped=true;}},true);
 wheel(wrap,83);f.flush();assert.equal(stopped,true);assert.equal(bar.scrollTop,0);stopped=false;
 wheel(wrap);assert.equal(stopped,false,'free field below a short column keeps zoom');
 f.gs[0].box.height=780;f.dock.refresh();wheel({closest:()=>null});f.flush();assert.equal(stopped,false);assert.equal(bar.scrollTop,0,'library/popup over the column keeps its wheel');
 for(const g of f.gs)g.hd.getClientRects=()=>[];wheel(wrap);f.flush();assert.equal(stopped,false);assert.equal(bar.scrollTop,0,'hidden menu, including Zen, leaves canvas wheel alone');
});

test('wheel ownership covers disabled controls, fixed popup backings and side clipping',()=>{
 const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
 const dom=new JSDOM('<body><div id="wrap"></div><header style="height:42px;overflow:hidden"><div id="paintTools"><div class="pt-g"><button disabled></button><div class="pt-r" style="position:fixed"><svg class="may-standard-contours"><polygon/></svg></div></div></div></header></body>');
 const doc=dom.window.document,poly=doc.querySelector('polygon'),group=doc.querySelector('.pt-g'),wrap=doc.querySelector('#wrap'),popup=doc.querySelector('.pt-r');
 const box=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
 poly.getBoundingClientRect=()=>box(200,100,120,200);popup.getBoundingClientRect=()=>box(200,100,120,200);group.getBoundingClientRect=()=>box(200,5,120,24);
 const ctx={module:{exports:{}},document:doc,getComputedStyle:dom.window.getComputedStyle};ctx.globalThis=ctx;vm.runInNewContext(fs.readFileSync(require.resolve('./mayatnik-menu-dock.js'),'utf8'),ctx);const owns=ctx.module.exports.ownsWheel;
 assert.equal(owns({target:doc.querySelector('button')}),true,'disabled control still owns wheel');
 assert.equal(owns({target:wrap,clientX:260,clientY:150}),true,'fixed popup escapes header overflow');
 assert.equal(owns({target:wrap,clientX:500,clientY:150}),false,'unoccupied field remains free');
 let cancelled=false;assert.equal(ctx.module.exports.guardWheel({target:doc.querySelector('button'),preventDefault(){cancelled=true;}}),true);assert.equal(cancelled,true,'unhandled menu DOM cannot scroll its surrounding field');
 const list=doc.createElement('div');list.className='gz-ladder';list.style.overflowY='auto';Object.defineProperties(list,{scrollHeight:{value:420},clientHeight:{value:90}});wrap.append(list);cancelled=false;
 assert.equal(ctx.module.exports.guardWheel({target:list,preventDefault(){cancelled=true;}}),true);assert.equal(cancelled,false,'native nested menu scrolling stays available');
 group.classList.add('may-dock-side');group.style.setProperty('--may-side-clip-top','120px');group.getBoundingClientRect=()=>box(200,0,120,300);
 assert.equal(owns({target:wrap,clientX:260,clientY:110}),false,'clipped backing cannot shield invisible field');
 assert.equal(owns({target:wrap,clientX:260,clientY:150}),true);
 group.style.visibility='hidden';assert.equal(owns({target:wrap,clientX:260,clientY:150}),false);dom.window.close();
});

test('production field wheel ignores menu-owned and already handled events, preserving ordinary zoom',()=>{
 const html=fs.readFileSync(require.resolve('./Zerkalius-mayatnik.html'),'utf8'),start=html.indexOf("  wrap.addEventListener('wheel', e => {"),handlers={};let owned=false,zooms=0;
 const ctx={viewRotation:{isFieldEvent:()=>false},wrap:{addEventListener:(name,fn)=>handlers[name]=fn},geo:{},window:{MayatnikMenuDock:{guardWheel:()=>owned}},st:{},ovlLinked:()=>false,scale:()=>1,zoomTo:()=>{zooms++;},zWant:0};
 vm.runInNewContext(html.slice(start,html.indexOf('  // Тянуть',start)),ctx);
 const event={deltaY:50,deltaMode:0,clientX:500,clientY:500,preventDefault(){}};
 owned=true;handlers.wheel(event);assert.equal(zooms,0);owned=false;handlers.wheel({...event,defaultPrevented:true});assert.equal(zooms,0);handlers.wheel(event);assert.equal(zooms,1);
});

test('low right groups get a scrollbar beside occupied slots, not through empty space above',()=>{
 const saved={g0:{edge:'right',index:18},g1:{edge:'right',index:19}},f=fixture({'mayatnik-menu-dock-v509':JSON.stringify(saved)}),before=f.store.get('mayatnik-menu-dock-v509');
 f.gs[0].box.height=400;f.dock.refresh();const bar=f.body.children.find(n=>n.dataset.edge==='right');
 assert.equal(bar.style.top,'526px');assert.equal(bar.style.height,'254px');assert.equal(bar.style.left,'860px','bar remains left of the 876px right column');
 assert.equal(bar.children[0].style.height,'442px');assert.equal(bar.style.display,'block');
 f.event('wheel',{target:{closest:()=>f.gs[0]},deltaY:1000,deltaMode:0},true);f.flush();
 assert.equal(bar.scrollTop,188);assert.equal(f.gs[0].style['--may-side-clip-top'],'188px');assert.equal(f.gs[1].style['--may-dock-y'],'754px');
 f.event('focusin',{target:{closest:()=>f.gs[0],getBoundingClientRect:()=>({top:510,bottom:534})}},true);f.flush();assert.equal(bar.scrollTop,172,'keyboard focus uses the same occupied viewport');
 assert.equal(f.store.get('mayatnik-menu-dock-v509'),before);
 f.gs[0].box.height=24;f.dock.refresh();assert.equal(bar.style.display,'none');assert.equal(bar.scrollTop,0);assert.equal(f.gs[0].style['--may-dock-y'],'526px');assert.equal(f.gs[1].style['--may-dock-y'],'552px');
});

test('standalone key isolates persistence and default edge only affects unplaced groups',()=>{
 const old=JSON.stringify({g0:{edge:'left',index:4}}),key='setka-menu-dock-v1';
 const f=fixture({'mayatnik-menu-dock-v509':old},{storageKey:key,defaultEdge:'top',stackSides:false});
 assert.ok(f.gs.every(g=>g.dataset.dockEdge==='top'));assert.equal(f.store.get('mayatnik-menu-dock-v509'),old);
 f.event('pointerdown',{target:f.gs[0].hd,clientX:68,clientY:74},true);f.event('pointermove',{clientX:936,clientY:270});f.event('pointerup',{clientX:936,clientY:270});
 const saved=f.store.get(key);assert.equal(JSON.parse(saved).g0.edge,'right');assert.equal(f.store.get('mayatnik-menu-dock-v509'),old);
 const restored=fixture({[key]:saved},{storageKey:key,defaultEdge:'top',stackSides:false});assert.equal(restored.gs[0].dataset.dockEdge,'right');
});

test('all four default edges are accepted; invalid options retain Mayatnik defaults',()=>{
 for(const edge of ['top','bottom','left','right'])assert.equal(fixture({},{defaultEdge:edge}).gs[0].dataset.dockEdge,edge);
 for(const storageKey of ['', '  ', 12, null]){
  const f=fixture({},{storageKey,defaultEdge:'floating',stackSides:'false'});assert.equal(f.gs[0].dataset.dockEdge,'left');assert.ok(f.store.has('mayatnik-menu-dock-v509'));assert.equal(f.body.children.filter(n=>n.dataset.edge).length,2);
 }
});

test('stackSides false keeps side slots fixed and adds no clipping or side scroll controls',()=>{
 const key='setka-menu-dock-v1',saved=JSON.stringify({g0:{edge:'left',index:0},g1:{edge:'left',index:1}});
 const f=fixture({[key]:saved},{storageKey:key,defaultEdge:'top',stackSides:false}),before=f.gs.map(g=>g.style['--may-dock-y']);
 f.gs[0].box.height=780;f.gs[1].box.height=300;f.dock.refresh();f.flush();assert.deepEqual(f.gs.map(g=>g.style['--may-dock-y']),before);
 assert.equal(f.body.children.filter(n=>n.dataset.edge).length,0);
 for(const g of f.gs){assert.equal(g.style['--may-side-clip-top'],undefined);assert.equal(g.style['--may-side-clip-bottom'],undefined);}
 let stopped=false;f.event('wheel',{target:{closest:()=>f.gs[0]},deltaY:999,deltaMode:0,preventDefault(){stopped=true;}},true);f.event('focusin',{target:{closest:()=>f.gs[1]}},true);f.flush();
 assert.equal(stopped,false);assert.deepEqual(f.gs.map(g=>g.style['--may-dock-y']),before);assert.equal(f.store.get(key),saved);
 f.resize(800);assert.deepEqual(f.gs.map(g=>g.style['--may-dock-y']),before);
});

test('leftEdge keeps the left dock at the viewport edge when the rail starts after the title',()=>{
 const f=fixture({},{leftEdge:()=>4,defaultEdge:'left',stackSides:false});f.rail.box.left=280;f.dock.refresh();
 assert.equal(f.gs[0].style['--may-dock-x'],'4px');assert.equal(f.gs[1].style['--may-dock-x'],'4px');
 const previous=fixture();previous.rail.box.left=280;previous.dock.refresh();assert.equal(previous.gs[0].style['--may-dock-x'],'280px');
 for(const leftEdge of [()=>NaN,()=>Infinity,null,4]){const g=fixture({},{leftEdge});assert.equal(g.gs[0].style['--may-dock-x'],'8px');}
 assert.equal(fixture({},{leftEdge:()=>-10}).gs[0].style['--may-dock-x'],'4px');
});


test('last side slot keeps native scrollbar extent equal to computed range',()=>{
 const f=fixture({'mayatnik-menu-dock-v509':JSON.stringify({g0:{edge:'right',index:26},g1:{edge:'left',index:0}})});
 f.footer.box.top=756;f.gs[0].box.height=52;f.dock.refresh();const bar=f.body.children.find(n=>n.dataset.edge==='right');
 assert.equal(bar.style.top,'734px');assert.equal(bar.style.height,'50px');assert.equal(bar.children[0].style.height,'54px');
 f.event('wheel',{target:{closest:()=>f.gs[0]},deltaY:1000,deltaMode:0},true);f.flush();
 assert.equal(bar.scrollTop,parseFloat(bar.children[0].style.height)-parseFloat(bar.style.height));assert.equal(bar.scrollTop,4);
});

test('side scrollbar chrome is hidden without disabling the native scrolling region',()=>{
 const css=fs.readFileSync(require.resolve('./mayatnik-button-standard.css'),'utf8'),rule=css.match(/\.may-menu-side-scroll\{([^}]+)\}/)[1];
 assert.match(rule,/overflow-y:auto/);assert.match(rule,/scrollbar-width:none/);assert.doesNotMatch(rule,/scrollbar-width:thin|scrollbar-color/);assert.match(css,/\.may-menu-side-scroll::-webkit-scrollbar\{display:none;width:0;height:0\}/);
 for(const edge of ['left','right']){const saved={g0:{edge,index:0},g1:{edge,index:1}},f=fixture({'mayatnik-menu-dock-v509':JSON.stringify(saved)});f.gs[0].box.height=780;f.dock.refresh();const bar=f.body.children.find(n=>n.dataset.edge===edge),before=f.gs[1].style['--may-dock-y'];
  f.event('wheel',{target:{closest:()=>f.gs[0]},deltaY:80,deltaMode:0},true);f.flush();assert.equal(bar.scrollTop,80);assert.notEqual(f.gs[1].style['--may-dock-y'],before);
 }
});

test('side group bottom bracket and its stroke fit inside reserved layout height',()=>{
 const {JSDOM}=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom'),dom=new JSDOM('<div id="host"><button></button><button></button></div>'),doc=dom.window.document,host=doc.getElementById('host'),cells=[...host.querySelectorAll('button')];
 const src=fs.readFileSync(require.resolve('./mayatnik-button-standard.js'),'utf8'),code=src.slice(src.indexOf('  let gradN='),src.indexOf('  // v0.449: подложка закрытой'));
 const top=100,lastBottom=50,padding=14;host.getBoundingClientRect=()=>({left:10,top,width:120,height:lastBottom+padding});host.scrollTop=host.scrollLeft=0;
 cells.forEach((b,i)=>b.getBoundingClientRect=()=>({left:10,top:top+i*26,width:120,height:24}));
 const ctx={svg:cls=>{const n=doc.createElementNS('http://www.w3.org/2000/svg','svg');n.setAttribute('class',cls);return n;},getComputedStyle:()=>({overflowY:'visible'})};vm.runInNewContext(code,ctx);ctx.contour(host,cells,false,null,false);
 const caps=[...host.querySelectorAll('.cap')],bottom=caps.at(-1).getAttribute('d').match(/L12 ([\d.]+)/);assert.equal(+bottom[1],lastBottom+12);assert.ok(+bottom[1]+1<host.getBoundingClientRect().height,'2px stroke stays inside padded host');
 const css=fs.readFileSync(require.resolve('./mayatnik-button-standard.css'),'utf8');assert.match(css,/\.may-menu-side-stack\.may-dock-side>[^}]+padding-bottom:14px!important;box-sizing:content-box!important/);
 const stack=D.stackPositions([{index:0,y:58,height:24+lastBottom+padding}],58,110,1000),row=stack.rows[0];assert.ok(row.screenY+24+lastBottom+12+1<=110,'scroll to bottom exposes the complete bracket');dom.window.close();
});

test('standard adapter delegates side scroll to dock and preserves ordinary top list scrolling',()=>{
 const src=fs.readFileSync(require.resolve('./mayatnik-button-standard.js'),'utf8'),start=src.indexOf("        if(host.classList.contains('pt-r'))"),code=src.slice(start,src.indexOf('        // may-rail-list',start));
 for(const sideStack of [true,false]){const styles={};const host={classList:{contains:()=>true},style:{removeProperty:k=>delete styles[k],setProperty:(k,v)=>styles[k]=v},getBoundingClientRect:()=>({top:100}),scrollHeight:1000};
  const g={matches:()=>sideStack,classList:{contains:()=>false}},ctx={host,g,head:{getBoundingClientRect:()=>({top:80})},innerWidth:1000,innerHeight:700};vm.runInNewContext(code,ctx);
  assert.equal(host.style.maxHeight,sideStack?'none':'586px');assert.equal(host.style.overflowY,sideStack?'visible':'auto');assert.equal(styles['padding-bottom'],sideStack?undefined:'14px');
 }
});
