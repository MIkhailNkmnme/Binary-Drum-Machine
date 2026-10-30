const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Администратор/AppData/Local/Temp/codex-horr-dom/node_modules/jsdom');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8'),menu=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8');
function fn(name){const at=html.indexOf('function '+name+'(');assert.ok(at>=0,name);let end=html.indexOf('{',at)+1,d=1;for(;d;end++){if(html[end]==='{')d++;if(html[end]==='}')d--;}return html.slice(at,end);}
const turn=()=>new Promise(r=>setImmediate(r));
function transport(){
 const dom=new JSDOM('<button id="bPlay" aria-pressed="false"></button><div id="mid"></div>',{runScripts:'outside-only'}),w=dom.window;
 Object.assign(w,{$:id=>w.document.getElementById(id),pl:w.document.createElement('button'),mid:w.document.getElementById('mid'),rail:{refresh(){}},k:270,f:{H:128,val:new Int8Array(3)},st:{view:'rombJoin180',speed:1},playing:false,fast:false,raf:0,timer:0,testBuildTimer:0,coneAutoRun:false,templateNavigationSerial:0,templateFollowQueue:Promise.resolve(),templateFollowTarget:null,templateFollow:{on:true},testPattern:null,testXorInfo:null,konus:null,gpuBig:null,paintJumpFrom:null,t0:0,lastDraw:0,drawMs:0,target:512,ochkiPauseCancel(){},testNotify(){},cancelAnimationFrame(){},next(){},total:()=>512,coneContinueAllowed:()=>false,foldSuspend(){},draw(){},advancePaintColour(){},gpuManualCpu:()=>false,gpuPaintCpu:()=>false,templateFollowActive:()=>true,templateFollowFrameWait:()=>true,ochkiFrameWait:()=>false});
 w.eval(['syncTransportPlayUI','cancelFrameNavigation','stop','play','goToImmediate','tick'].map(fn).join('\n'));
 w.$('bPlay').onclick=()=>{w.fast=false;w.t0=0;w.play();};
 const a=menu.indexOf("      const P = $('bPlay'), plSync"),b=menu.indexOf('      // подпись',a);w.eval(menu.slice(a,b));
 return {w,dom};
}
test('joined180 fast navigation and normal play expose immediate Pause, including pending exact search and GPU',async()=>{
 for(const gate of ['search','gpu']){
  const {w,dom}=transport();w.goToImmediate(300);await turn();assert.equal(w.playing,true);assert.equal(w.pl.textContent,'❚❚');assert.equal(w.pl.getAttribute('aria-label'),'Пауза');
  if(gate==='gpu'){w.gpuBig={snapshotPending:{}};w.gpuManualCpu=()=>true;}
  w.tick();assert.equal(w.k,270);w.pl.click();assert.equal(w.playing,false);assert.equal(w.fast,false);assert.equal(w.pl.getAttribute('aria-pressed'),'false');assert.equal(w.k,270);assert.equal(w.templateFollow.on,true);
  w.pl.click();assert.equal(w.playing,true);assert.equal(w.k,270);assert.equal(w.target,512);assert.equal(w.pl.getAttribute('aria-label'),'Пауза');w.pl.click();dom.window.close();
 }
});
test('explicit pause prevents pending manual navigation from restarting after exact search resolves',async()=>{
 const {w,dom}=transport();let resolve,moved=0;const pending=new Promise(r=>resolve=r);
 w.templateFollowWait=()=>pending;w.goToImmediate=()=>moved++;w.eval(fn('goTo'));const a=w.goTo(280),b=w.goTo(281);await turn();w.stop();resolve(true);await Promise.all([a,b]);assert.equal(moved,0);assert.equal(w.playing,false);assert.equal(w.templateFollow.on,true);assert.equal(w.templateFollowTarget,null);dom.window.close();
});
test('test-pattern playback uses the same source and visible pause state',async()=>{
 const {w,dom}=transport(),a=html.indexOf('    const playUI = on =>'),b=html.indexOf('\n',a);w.eval(html.slice(a,b)+'window.testPlayUI=playUI;');w.testPlayUI(true);await turn();assert.equal(w.pl.getAttribute('aria-label'),'Пауза');w.pl.click();assert.equal(w.playing,false);assert.equal(w.templateFollow.on,true);dom.window.close();
});
test('visible view cycle and palette skip legacy joined mode while saved legacy value remains intact',()=>{
 const select=html.match(/<select id="view"[\s\S]*?<\/select>/)[0],dom=new JSDOM(select,{runScripts:'outside-only'}),w=dom.window;
 Object.assign(w,{$:id=>w.document.getElementById(id),viewIcons:{},VIEW_SHORT:{},toolSync:[],gView:w.document.createElement('div'),ptBtn:(id,kind,probe,click)=>{probe.onclick=click;return probe;}});
 const a=menu.indexOf("  { const sel = $('view'), nameOf"),b=menu.indexOf('  // v0.103:',a);w.eval(menu.slice(a,b));const sel=w.$('view'),button=w.gView.firstChild;
 sel.value='romb2';button.click();assert.equal(sel.value,'col');button.dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true}));assert.equal(sel.value,'romb2');
 sel.value='rombJoin';assert.equal(sel.value,'rombJoin');assert.equal(sel.selectedOptions[0].hidden,true);assert.equal(sel.selectedOptions[0].disabled,true);
 const c=menu.indexOf('    const fromSelect ='),d=menu.indexOf('    const viewIcon =',c);w.eval(menu.slice(c,d)+'window.options=fromSelect($("view"))();');assert.equal(w.options.some(o=>o.key==='rombJoin'),false);assert.equal(w.options.some(o=>o.key==='rombJoin180'),false);dom.window.close();
});
test('legacy visible-row limit never crops regular CPU/GPU/search window; explicit row run still reveals rows',()=>{
 for(const compare of [false,true])for(const view of ['bits','rombJoin180']){
  const c=vm.createContext({st:{view,vrows:1,rows:128,noband:false,mode:'pend'},f:{W:512,H:128},rowRun:null,compareOn:()=>compare,testPattern:null,geo:{anchor:256},VX:0,VW:0,VH:0,k:270,pairOn:()=>false,MAYATNIK:{span:()=>[-10,10]},ZL:[],ZR:[]});
  vm.runInContext(fn('updWin'),c);c.updWin();assert.equal(c.VH,128);assert.equal(c.st.rows,128);assert.equal(c.st.vrows,1);c.rowRun={r:5};c.updWin();assert.equal(c.VH,5);c.rowRun=null;c.updWin();assert.equal(c.VH,128);
 }
 const dom=new JSDOM(html);assert.equal(dom.window.document.getElementById('vrows').closest('label').hidden,true);assert.doesNotMatch(menu,/num\('vrows'/);assert.match(fn('ochkiRecordFrame'),/visibleRows:typeof VH/);dom.window.close();
});
test('Search visible naming retains source IDs and saved layout keys',()=>{
 const dom=new JSDOM(html),b=dom.window.document.getElementById('bOchki');assert.match(b.textContent,/Поиск/);assert.doesNotMatch(b.title,/Очк/);assert.match(menu,/id: 'ochki', title: 'Очки'/);assert.match(menu,/if\(name==='👓 Очки'\)g.dataset.k=name/);assert.match(menu,/title:name==='👓 Очки'\?'👓 Поиск':name/);assert.match(fs.readFileSync(__dirname+'/../_js/menu-icons.js','utf8'),/"mayatnik:bOchki": "Поиск"/);dom.window.close();
});
test('button finder displays Search for legacy layout key and excludes retired row cap',()=>{
 const Search=require('./mayatnik-button-search.js'),dom=new JSDOM('<div id="paintTools"><div class="pt-g" data-k="👓 Очки"><button>Поиск</button></div><label hidden>Показ строк<input id="vrows"></label></div>'),records=Search.collect(dom.window.document);assert.equal(records[0].group,'👓 Поиск');assert.equal(Search.find(records,'Показ строк').length,0);assert.equal(dom.window.document.querySelector('.pt-g').dataset.k,'👓 Очки');dom.window.close();
});
