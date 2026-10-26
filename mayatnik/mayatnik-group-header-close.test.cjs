const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const menu=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8');
const block=(start,end)=>menu.slice(menu.indexOf(start),menu.indexOf(end,menu.indexOf(start)));
const nativeMini=block("    { const MINI = 'mayatnik-dd-mini'",'    grid.relayout();');
const importedMini=block("  { const MINI = 'mayatnik-rail-mini'",'  // v0.167:');
const headerView={parts:head=>({icon:head.querySelector('.ico')||head.appendChild(head.ownerDocument.createElement('i'))}),sync(head,state){for(const key of ['open','pinned','mini'])if(key in state)head.dataset[key]=String(state[key]);}};
function native({pinned=true,mini=false,folded=false}={}){
 const dom=new JSDOM('<div id="tools"><div class="pt-g" data-k="A"><button class="pt-l"><i class="ico"></i>A</button><div class="pt-r"></div></div><div class="pt-g pt-btn" data-k="Правка"><button class="pt-l"><i class="ico"></i>Правка</button></div></div>',{url:'https://example.test'}),w=dom.window,tools=w.document.getElementById('tools'),g=tools.firstElementChild,l=g.querySelector('.pt-l'),pins=new Set(pinned?['A']:[]),folds=new Set(folded?['A']:[]);
 w.localStorage.setItem('mayatnik-dd-mini',JSON.stringify(mini?['A']:[]));w.localStorage.setItem('mayatnik-menu-dock-v509','saved position');
 const c={tools,g,l,pins,folds,open:folded?null:g,narrow:{matches:false},keyOf:g=>g.dataset.k,localStorage:w.localStorage,ZerkGroupHeader:headerView,requestAnimationFrame:f=>f(),alignOpen(){},place(){},grid:{touch(){}},saveDd(){w.localStorage.setItem('mayatnik-dd-pins',JSON.stringify([...pins]));w.localStorage.setItem('mayatnik-dd-fold',JSON.stringify([...folds]));}};vm.createContext(c);
 for(const name of ['pinned','setOpen','pinsSync','shut','show']){const line=menu.split('\n').find(line=>line.trimStart().startsWith('const '+name+' ='));vm.runInContext(line,c);}
 vm.runInContext(block('      l.onclick = () => { if (pinned(g))','      // Header and pin keyboard'),c);
 vm.runInContext(menu.split('\n').find(line=>line.trimStart().startsWith('l.onpointerenter =')),c);
 vm.runInContext(nativeMini,c);if(!folded)g.classList.add('pt-open');
 return{dom,w,g,l,c,pins,folds,right(){l.dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,button:2,cancelable:true}));},hover(){l.onpointerenter({pointerType:'mouse'});},left(){l.click();},sync(){vm.runInContext('pinsSync()',c);}};
}
for(const pinned of [false,true])test(`native right-click closes, preserves pin/position and suppresses hover until left-click; pinned=${pinned}`,()=>{
 const a=native({pinned});try{a.right();assert.ok(!a.g.classList.contains('pt-open'));assert.ok(a.g.classList.contains('pt-mini'));assert.deepEqual(JSON.parse(a.w.localStorage.getItem('mayatnik-dd-mini')),['A']);assert.equal(a.pins.has('A'),pinned);assert.ok(a.folds.has('A'));
 a.right();a.hover();a.sync();assert.ok(!a.g.classList.contains('pt-open'));assert.ok(!a.g.classList.contains('pt-mini'));assert.equal(a.w.localStorage.getItem('mayatnik-menu-dock-v509'),'saved position');
 a.left();assert.ok(a.g.classList.contains('pt-open'));assert.ok(!a.folds.has('A'));a.right();assert.deepEqual(JSON.parse(a.w.localStorage.getItem('mayatnik-dd-fold')),['A']);
 }finally{a.dom.window.close();}
});
test('saved explicit closure blocks native startup restore as well as hover',()=>{
 const a=native({pinned:true,mini:false,folded:true});try{vm.runInContext('show(g);pinsSync()',a.c);a.hover();assert.ok(!a.g.classList.contains('pt-open'));assert.ok(a.pins.has('A'));a.left();assert.ok(a.g.classList.contains('pt-open'));}finally{a.dom.window.close();}
});
function imported(saved,mini=[]){
 const dom=new JSDOM('<div id="rail"></div>',{url:'https://example.test',runScripts:'outside-only'}),w=dom.window;
 if(saved)w.localStorage.setItem('grozd:close-test',JSON.stringify(saved));w.localStorage.setItem('mayatnik-rail-mini',JSON.stringify(mini));w.eval(fs.readFileSync(__dirname+'/../_js/grozd.js','utf8'));
 const rail=w.ZerkGrozd.rail(w.document.getElementById('rail'),{key:'close-test',groups:[{id:'zoom',title:'Масштаб',items:[]}]});w.rail=rail;w.ZerkGroupHeader=headerView;w.eval(importedMini);
 const g=rail.el.firstElementChild,h=g.querySelector('.gz-head');return{dom,w,g,h,rail,right(){h.dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,button:2,cancelable:true}));},saved(){return JSON.parse(w.localStorage.getItem('grozd:close-test'));}};
}
for(const pinned of [false,true])test(`imported close uses real grozd state and survives reload; pinned=${pinned}`,()=>{
 const a=imported({open:'zoom',pin:pinned?['zoom']:[],shut:[],order:['zoom']});let saved;try{a.right();assert.ok(a.g.classList.contains('gz-mini'));a.right();a.rail.refresh();assert.ok(!a.g.classList.contains('gz-open'));assert.ok(!a.g.classList.contains('gz-mini'));assert.equal(a.g.classList.contains('gz-pinned'),pinned);saved=a.saved();assert.deepEqual(saved.pin,pinned?['zoom']:[]);assert.equal(saved.open,null);assert.deepEqual(saved.order,['zoom']);if(pinned)assert.deepEqual(saved.shut,['zoom']);a.h.click();assert.ok(a.g.classList.contains('gz-open'));}finally{a.dom.window.close();}
 const b=imported(saved);try{assert.ok(!b.g.classList.contains('gz-open'));assert.equal(b.g.classList.contains('gz-pinned'),pinned);b.h.click();assert.ok(b.g.classList.contains('gz-open'));}finally{b.dom.window.close();}
});

test('native compact form survives reload independently of pin and folded state',()=>{
 const a=native({pinned:true});let compact;try{a.right();compact=JSON.parse(a.w.localStorage.getItem('mayatnik-dd-mini')).includes('A');assert.equal(compact,true);}finally{a.dom.window.close();}
 const b=native({pinned:true,mini:compact,folded:true});try{assert.ok(b.g.classList.contains('pt-mini'));assert.equal(b.l.dataset.mini,'true');b.left();assert.ok(b.g.classList.contains('pt-open'));assert.ok(b.g.classList.contains('pt-mini'));b.right();assert.ok(!b.g.classList.contains('pt-mini'));assert.ok(b.pins.has('A'));}finally{b.dom.window.close();}
});
test('compact group CSS and SVG use a 48 by 24 downward triangle, retaining ordinary control diamonds',()=>{
 const css=fs.readFileSync(__dirname+'/mayatnik-button-standard.css','utf8'),standard=fs.readFileSync(__dirname+'/mayatnik-button-standard.js','utf8');assert.match(css,/may-header-triangle\{[^}]*width:48px!important[^}]*clip-path:polygon\(0 0,100% 0,50% 100%\)/);assert.match(css,/may-header-triangle.zgh-head>.zgh-icon\{[^}]*top:3px!important[^}]*font:11px\/12px/);assert.match(standard,/triangle\?'0 0 48 24'/);assert.match(standard,/triangle\?'0,0 48,0 24,24'/);assert.match(standard,/triangle\?'M1 1 H47 L24 23 Z'/);assert.match(standard,/triangle\?\[\[x-2,y-1\],\[x\+w\+2,y-1\],\[x\+w\/2,y\+h\+1\]\]/);assert.match(css,/may-control-mini[^}]*clip-path:polygon\(50% 0,100% 50%,50% 100%,0 50%\)/);
});

test('imported compact form survives F5 and opening while retaining pin, then restores full width',()=>{
 const a=imported({open:'zoom',pin:['zoom'],shut:[],order:['zoom']});let saved,minis;try{a.right();saved=a.saved();minis=JSON.parse(a.w.localStorage.getItem('mayatnik-rail-mini'));assert.equal(minis.length,1);}finally{a.dom.window.close();}
 const b=imported(saved,minis);try{assert.ok(b.g.classList.contains('gz-mini'));assert.ok(b.g.classList.contains('gz-pinned'));b.h.click();assert.ok(b.g.classList.contains('gz-open'));assert.ok(b.g.classList.contains('gz-mini'));b.right();assert.ok(!b.g.classList.contains('gz-mini'));assert.ok(!b.g.classList.contains('gz-open'));assert.ok(b.g.classList.contains('gz-pinned'));}finally{b.dom.window.close();}
});
test('closed backing has real local SVG bounds for both triangle and restored full header',()=>{
 const dom=new JSDOM('<div id="g"><div id="h" class="may-standard-mini may-header-triangle"></div></div>',{runScripts:'outside-only'});try{
  const w=dom.window,g=w.document.getElementById('g'),head=w.document.getElementById('h'),source=fs.readFileSync(__dirname+'/mayatnik-button-standard.js','utf8');
  let screenY=200;g.getBoundingClientRect=()=>({left:100,top:screenY,width:120,height:24});let width=48;head.getBoundingClientRect=()=>({left:100,top:screenY,width,height:24});
  const helpers=source.slice(source.indexOf("  const NS="),source.indexOf('  function outline(')),start=source.indexOf('  function closedBack('),end=source.indexOf('  // Each backing tip',start);w.eval(helpers+'\nlet gradN=0;\n'+source.slice(start,end)+'\nwindow.testClosedBack=closedBack;');
  w.testClosedBack(g,head);let svg=g.querySelector('.may-closed-back');assert.equal(svg.style.left,'-2px');assert.equal(svg.style.top,'-1px');assert.equal(svg.style.width,'52px');assert.equal(svg.style.height,'26px');assert.equal(svg.getAttribute('viewBox'),'0 0 52 26');assert.equal(svg.querySelector('polygon').getAttribute('points'),'0,0 52,0 26,26');
  const beforeMove=svg;screenY=700;w.testClosedBack(g,head);svg=g.querySelector('.may-closed-back');assert.notEqual(svg,beforeMove);assert.equal(svg.style.top,'-1px');const stable=svg;w.testClosedBack(g,head);assert.equal(g.querySelector('.may-closed-back'),stable);
  head.classList.remove('may-standard-mini','may-header-triangle');width=120;w.testClosedBack(g,head);svg=g.querySelector('.may-closed-back');assert.equal(svg.style.width,'124px');assert.equal(svg.style.height,'26px');assert.equal(svg.getAttribute('viewBox'),'0 0 124 26');assert.equal(svg.querySelector('polygon').getAttribute('points'),'14,0 110,0 124,13 110,26 14,26 0,13');
 }finally{dom.window.close();}
});
