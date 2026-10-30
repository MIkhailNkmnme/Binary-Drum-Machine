const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const D=require('./mayatnik-menu-dock.js');
test('one mobile predicate covers narrow portraits and coarse phone landscape, preserving desktop',()=>{
 for(const width of [320,360,390,430,600])assert.equal(D.isMobile({width,height:844,coarse:false}),true);
 assert.equal(D.isMobile({width:844,height:390,coarse:true}),true);
 for(const p of [{width:844,height:390,coarse:false},{width:1280,height:720,coarse:true},{width:960,height:720,coarse:true},{width:1024,height:600,coarse:true}])assert.equal(D.isMobile(p),false);
});
function fixture(width=1280,height=720,coarse=false){
 const dom=new JSDOM('<header><button id="brand"></button><div id="paintTools"><button class="pt-l">Undo</button></div><span id="end"></span></header><aside id="side"><nav id="rail"><button class="gz-head">Build</button></nav></aside><button id="library">Library</button>',{url:'https://local.test'}),w=dom.window,doc=w.document;
 const mediaEvents=[];w.matchMedia=()=>({matches:coarse,addEventListener:(t,fn)=>mediaEvents.push(fn)});
 Object.defineProperties(w,{innerWidth:{get:()=>width},innerHeight:{get:()=>height}});
 const ctx={module:{exports:{}},document:doc,innerWidth:width,innerHeight:height,matchMedia:w.matchMedia,CustomEvent:w.CustomEvent,dispatchEvent:w.dispatchEvent.bind(w),addEventListener:w.addEventListener.bind(w),localStorage:{getItem(){throw Error('mobile controller may not access preferences');},setItem(){throw Error('mobile controller may not persist temporary layout');}}};ctx.globalThis=ctx;
 vm.runInNewContext(fs.readFileSync(require.resolve('./mayatnik-menu-dock.js'),'utf8'),ctx);
 const menu=ctx.module.exports.mobileStrip(),header=doc.querySelector('header'),tools=doc.getElementById('paintTools'),side=doc.getElementById('side'),library=doc.getElementById('library');
 const bar=menu.connect(header,[tools,side,doc.getElementById('rail'),library]);
 return{dom,w,doc,menu,bar,header,tools,side,library,resize(x,y,c=coarse){width=x;height=y;coarse=c;ctx.innerWidth=x;ctx.innerHeight=y;w.dispatchEvent(new w.Event('resize'));}};
}
test('temporary single strip preserves live controls and restores exact desktop DOM across resize/F5-sized entry',()=>{
 for(const initial of [1280,390]){const f=fixture(initial);try{
 const originalButton=f.tools.firstElementChild;let clicks=0;originalButton.addEventListener('click',()=>clicks++);
 f.resize(390,844,true);assert.equal(f.menu.matches,true);assert.ok(f.doc.body.classList.contains('may-mobile-menu'));assert.equal(f.header.querySelector('#mayMobileBar'),f.bar);
 assert.deepEqual([...f.bar.children].map(n=>n.id),['paintTools','side','library']);assert.equal(f.doc.getElementById('rail').parentElement,f.side,'nested containers are never duplicated');originalButton.click();assert.equal(clicks,1);
 f.resize(844,390,true);assert.equal(f.bar.children.length,3);f.resize(1280,720,false);
 assert.equal(f.menu.matches,false);assert.equal(f.doc.getElementById('mayMobileBar'),null);assert.deepEqual([...f.header.children].map(n=>n.id),['brand','paintTools','end']);assert.equal(f.side.parentElement,f.doc.body);assert.equal(f.library.parentElement,f.doc.body);assert.equal(f.tools.firstElementChild,originalButton);originalButton.click();assert.equal(clicks,2);
 }finally{f.dom.window.close();}}
});
test('mobile strip clamps horizontal wheel at both ends and leaves popup and pinch input alone',()=>{
 const f=fixture(390,844,true);try{
 Object.defineProperties(f.bar,{scrollWidth:{value:2000},clientWidth:{value:390}});
 const wheel=(target,deltaY,extra={})=>{const e=new f.w.WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY,...extra});target.dispatchEvent(e);return e;};
 wheel(f.bar,99999);assert.equal(f.bar.scrollLeft,1610);wheel(f.bar,99);assert.equal(f.bar.scrollLeft,1610);wheel(f.bar,-99999);assert.equal(f.bar.scrollLeft,0);
 assert.equal(wheel(f.bar,500,{ctrlKey:true}).defaultPrevented,false);assert.equal(f.bar.scrollLeft,0);
 const list=f.doc.createElement('div');list.className='pt-r';f.tools.append(list);assert.equal(wheel(list,500).defaultPrevented,false);assert.equal(f.bar.scrollLeft,0);
 }finally{f.dom.window.close();}
});
test('keyboard focus reveals a clipped header in the same strip without cyclic scrolling',()=>{
 const f=fixture(390,844,true);try{const h=f.tools.firstElementChild;f.bar.getBoundingClientRect=()=>({left:0,right:390});h.getBoundingClientRect=()=>({left:700,right:820});h.dispatchEvent(new f.w.FocusEvent('focusin',{bubbles:true}));assert.equal(f.bar.scrollLeft,430);h.getBoundingClientRect=()=>({left:-80,right:40});h.dispatchEvent(new f.w.FocusEvent('focusin',{bubbles:true}));assert.equal(f.bar.scrollLeft,350);}finally{f.dom.window.close();}
});
test('mobile header pointer gestures cannot invoke legacy reorder or alter desktop preferences',()=>{
 const f=fixture(390,844,true);try{const h=f.tools.firstElementChild;let reorder=0;h.addEventListener('pointerdown',()=>reorder++);const e=new f.w.Event('pointerdown',{bubbles:true,cancelable:true});h.dispatchEvent(e);assert.equal(reorder,0);assert.equal(e.defaultPrevented,false,'native touch panning remains available');f.resize(1280,720,false);h.dispatchEvent(new f.w.Event('pointerdown',{bubbles:true}));assert.equal(reorder,1);}finally{f.dom.window.close();}
});
test('late search/home controls join the strip once and return to their exact desktop homes',()=>{
 const f=fixture(390,844,true);try{const late=f.doc.createElement('button');late.id='lateSearch';f.doc.body.append(late);let used=0;late.onclick=()=>used++;f.menu.add([late]);f.menu.add([late]);assert.equal([...f.bar.children].filter(n=>n===late).length,1);late.click();assert.equal(used,1);f.resize(1280,720,false);assert.equal(late.parentElement,f.doc.body);assert.equal(f.doc.body.lastElementChild,late);f.resize(430,932,true);assert.equal(late.parentElement,f.bar);}finally{f.dom.window.close();}
});
