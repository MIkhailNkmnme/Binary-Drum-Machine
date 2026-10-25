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
 return {gs,dock,store,event,body,rail,footer,flush(){frames.splice(0).forEach(fn=>fn());},resize(w){width=w;event('resize');}};
}
test('real controller snaps drag to right strip and persists slot, never raw pixels',()=>{
 const f=fixture();f.event('pointerdown',{target:f.gs[0].hd,clientX:68,clientY:74},true);f.event('pointermove',{clientX:936,clientY:270});f.event('pointerup',{clientX:936,clientY:270});
 const saved=JSON.parse(f.store.get('mayatnik-menu-dock-v509'));assert.equal(saved.g0.edge,'right');assert.equal(saved.g0.index,8);assert.deepEqual(Object.keys(saved.g0).sort(),['edge','index']);assert.equal(f.gs[0].style['--may-dock-x'],'876px');
 const restored=fixture({'mayatnik-menu-dock-v509':JSON.stringify(saved)});assert.equal(restored.gs[0].dataset.dockEdge,'right');assert.equal(restored.gs[0].style['--may-dock-y'],'266px');
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
 const bar=f.body.children.find(n=>n.dataset.edge==='left');assert.equal(bar.style.display,'block');bar.scrollTop=100;bar.events.scroll();f.flush();assert.equal(f.gs[1].style['--may-dock-y'],'764px');assert.equal(f.gs[0].style['--may-side-clip-top'],'100px');let stopped=false;f.event('wheel',{target:{closest:()=>f.gs[0]},deltaY:999,deltaMode:0,preventDefault(){stopped=true;}},true);f.flush();assert.equal(stopped,true);assert.equal(f.gs[1].style['--may-dock-y'],'726px');assert.equal(f.store.get('mayatnik-menu-dock-v509'),saved);
 f.gs[0].box.height=24;f.dock.refresh();assert.equal(bar.style.display,'none');assert.equal(bar.scrollTop,0);assert.equal(f.gs[1].style['--may-dock-y'],'84px');
});

test('low right groups get a scrollbar beside occupied slots, not through empty space above',()=>{
 const saved={g0:{edge:'right',index:18},g1:{edge:'right',index:19}},f=fixture({'mayatnik-menu-dock-v509':JSON.stringify(saved)}),before=f.store.get('mayatnik-menu-dock-v509');
 f.gs[0].box.height=400;f.dock.refresh();const bar=f.body.children.find(n=>n.dataset.edge==='right');
 assert.equal(bar.style.top,'526px');assert.equal(bar.style.height,'226px');assert.equal(bar.style.left,'860px','bar remains left of the 876px right column');
 assert.equal(bar.children[0].style.height,'442px');assert.equal(bar.style.display,'block');
 f.event('wheel',{target:{closest:()=>f.gs[0]},deltaY:1000,deltaMode:0},true);f.flush();
 assert.equal(bar.scrollTop,216);assert.equal(f.gs[0].style['--may-side-clip-top'],'216px');assert.equal(f.gs[1].style['--may-dock-y'],'726px');
 f.event('focusin',{target:{closest:()=>f.gs[0],getBoundingClientRect:()=>({top:510,bottom:534})}},true);f.flush();assert.equal(bar.scrollTop,200,'keyboard focus uses the same occupied viewport');
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
 f.footer.box.top=756;f.dock.refresh();const bar=f.body.children.find(n=>n.dataset.edge==='right');
 assert.equal(bar.style.top,'734px');assert.equal(bar.style.height,'22px');assert.equal(bar.children[0].style.height,'26px');
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
