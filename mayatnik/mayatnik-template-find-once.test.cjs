const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Администратор/AppData/Local/Temp/codex-horr-dom/node_modules/jsdom');
const M=require('./mayatnik-template-matcher.js'),Follow=require('./mayatnik-template-follow.js');global.MayatnikTemplateMatcher=M;const Engine=require('./mayatnik-template-engine.js');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8'),menu=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8');
const tick=()=>new Promise(r=>setTimeout(r,5)),deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fn(name){const a=html.indexOf('function '+name+'('),b=html.indexOf('{',a);assert.ok(a>=0,name);let d=1,i=b+1;for(;d;i++){if(html[i]==='{')d++;if(html[i]==='}')d--;}return html.slice(a,i);}
function fixture(){
 const dom=new JSDOM('<body><button id="bTemplateFindAll" aria-pressed="false"></button><div id="paintCacheInfo"></div><div id="row"></div></body>'),w=dom.window,nodes=new Map();
 const $=id=>{let el=w.document.getElementById(id)||nodes.get(id);if(!el){el=w.document.createElement('input');nodes.set(id,el);}return el;};
 const A={rk:1,parts:[{width:1,height:1,data:[0xff112233]}]},B={rk:1,parts:[{width:2,height:1,data:[0xff223344,0xff556677]}]},original=Int8Array.from([1,1,0,1,1]),display=[],notices=[];
 const c={window:w,document:w.document,$,st:{},f:{val:original,W:5,H:1},k:1,target:1,frame:1,revision:0,colourTemplate:{shape:A},MayatnikTemplateFollow:Follow,MayatnikTemplateMatcher:M,setTimeout,clearTimeout,Promise,
  templateItemAllowed:()=>true,templateSnapshot:()=>structuredClone(c.colourTemplate.shape),templateMatchProjection:()=>({}),queueSession(){},draw(){c.templateSync();c.templateFollow.ensure();},save(){},stop(){},stopFrameTransports(){},
  templateFollowScope:()=>({owner:c.f,key:c.frame+'|'+c.revision}),templateFollow:null,rememberTemplate(){},fieldTemplateList(){},templatePaintSync(){},templateVisible:true,templateMove:false,templateTransfer:false,templateAxisUnlocked:false,mirrorLine:false,xorMax:()=>2};
 c.templateAxesChanged=()=>{};vm.createContext(c);vm.runInContext(fn('templateSync'),c);
 const start=html.indexOf('  let templateFindOnceRun='),end=html.indexOf('  window.mayTemplateLibrary=',start);vm.runInContext(html.slice(start,end),c);
 const actualNotice=c.templateFoundNotice;c.templateFoundNotice=n=>{notices.push(n);actualNotice(n);};
 const host={entries:()=>[],shapeInstances:()=>[],stop(){},redrawSelection(){c.templateSync();},current:field=>field.owner===c.f&&field.frame===c.frame&&field.revision===c.revision,
  async field(){const field={owner:c.f,frame:c.frame,revision:c.revision,width:5,height:1,data:original.slice()};if(host.gate){const gate=host.gate;host.gate=null;await gate.promise;}return field;},
  async materializeMatches(request,cancelled){if(host.commitGate){const gate=host.commitGate;host.commitGate=null;await gate.promise;}if(cancelled())throw M.abort();c.revision++;display.push(request.shape.parts[0].width);return {instances:request.matches.map((m,i)=>'found:'+i),completedScope:c.templateFollowScope()};}};
 w.mayTemplateLibrary=Engine.create(host);
 const toolSync=[],row=$('row'),ptNames={};c.row=row;c.ptNames=ptNames;c.toolSync=toolSync;c.placeTools=()=>toolSync.forEach(f=>f());c.ptBtn=(id,icon,source,onclick)=>{const b=w.document.createElement('button');b.innerHTML='<i></i>';b.onclick=onclick;return b;};
 const ma=menu.indexOf("    const source=$('bTemplateFindAll'),findAll="),mb=menu.indexOf('row.prepend(findAll);',ma)+'row.prepend(findAll);'.length;assert.ok(ma>0);vm.runInContext(menu.slice(ma,mb),c);
 return {c,w,host,A,B,display,notices,original,button:$('bTemplateFindAll'),visible:row.querySelector('button'),sync:c.placeTools,close:()=>dom.window.close()};
}
test('persistent ON(A), one-shot B stays visible through draw/ensure, then next frame searches A with source and button ON preserved',async()=>{
 const f=fixture();await f.button.onclick();await f.c.templateFollow.idle();f.sync();assert.equal(f.visible.getAttribute('aria-pressed'),'true');assert.equal(f.visible.classList.contains('on'),true);const saved=JSON.stringify(f.c.templateFollow.snapshot().source);assert.deepEqual(f.display,[1]);assert.deepEqual(f.notices,[1]);
 f.c.colourTemplate={shape:f.B};assert.equal(await f.c.findAllTemplateOnce(),true);assert.deepEqual(f.display,[1,2]);assert.deepEqual(f.notices,[1,2]);
 for(let i=0;i<4;i++){f.c.draw();await f.c.templateFollow.ensure();f.sync();}assert.deepEqual(f.display,[1,2]);assert.equal(JSON.stringify(f.c.templateFollow.snapshot().source),saved);assert.equal(f.visible.classList.contains('on'),true);assert.equal(f.visible.getAttribute('aria-pressed'),'true');
 f.c.frame++;await f.c.templateFollow.ensure();f.sync();assert.deepEqual(f.display,[1,2,1]);assert.deepEqual(f.notices,[1,2],'automatic frames never toast');assert.deepEqual([...f.c.f.val],[...f.original]);assert.equal(f.visible.classList.contains('on'),true);
 await f.button.onclick();f.sync();assert.equal(f.visible.classList.contains('on'),false);assert.equal(f.visible.getAttribute('aria-pressed'),'false');f.close();
});
test('one-shot with persistent OFF does not enable or replace the saved source',async()=>{
 const f=fixture();f.c.colourTemplate={shape:f.B};assert.equal(await f.c.findAllTemplateOnce(),true);assert.equal(f.c.templateFollow.on,false);assert.equal(f.c.templateFollow.snapshot().source,null);assert.deepEqual(f.display,[2]);assert.deepEqual(f.notices,[2]);f.close();
});
test('pending follow search is cancelled before one-shot commit, then acknowledged without replaying A',async()=>{
 const f=fixture(),gate=deferred();f.host.gate=gate;const enable=f.button.onclick();await tick();f.c.colourTemplate={shape:f.B};const once=f.c.findAllTemplateOnce();gate.resolve();await enable;assert.equal(await once,true);assert.deepEqual(f.display,[2]);await f.c.templateFollow.ensure();assert.deepEqual(f.display,[2]);assert.equal(f.c.templateFollow.on,true);assert.deepEqual(f.notices,[2]);f.close();
});
test('stale frame, explicit OFF and a newer one-shot cannot publish obsolete matches or notifications',async()=>{
 for(const action of ['frame','off','newer']){const f=fixture();await f.button.onclick();const gate=deferred();f.host.commitGate=gate;f.c.colourTemplate={shape:f.B};const pending=f.c.findAllTemplateOnce();await tick();let latest;
  if(action==='frame')f.c.frame++;else if(action==='off')await f.button.onclick();else {f.c.colourTemplate={shape:f.A};latest=f.c.findAllTemplateOnce();}
  gate.resolve();assert.equal(await pending,false);if(latest)assert.equal(await latest,true);assert.deepEqual(f.display,action==='newer'?[1,1]:[1]);assert.deepEqual(f.notices,action==='newer'?[1,1]:[1]);f.close();}
});
test('notification shows real count, survives its initiating click, dismisses the next click even when propagation is stopped',async()=>{
 const f=fixture(),button=f.w.document.createElement('button');f.w.document.body.append(button);button.onclick=()=>f.c.templateFoundNotice(17);button.click();let notice=f.w.document.getElementById('templateFoundNotice');assert.equal(notice.hidden,false);assert.equal(notice.textContent,'Найдено 17 шаблонов');await tick();
 const other=f.w.document.createElement('button');other.onclick=e=>e.stopPropagation();f.w.document.body.append(other);other.click();assert.equal(notice.hidden,true);
 f.c.templateFoundNotice(0);f.c.templateFoundNotice(4);await tick();assert.equal(notice.textContent,'Найдено 4 шаблонов');other.click();assert.equal(notice.hidden,true);f.close();
});
