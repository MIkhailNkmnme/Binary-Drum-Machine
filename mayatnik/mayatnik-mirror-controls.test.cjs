const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const code=fs.readFileSync(__dirname+'/mayatnik-mirror-controls.js','utf8');
function boot(seed={}){
  const dom=new JSDOM('<head></head><body><div class="pt-g" data-k="Шаблоны"><div class="pt-r" id="old"></div></div><div class="pt-g" data-k="Зеркала"><div class="pt-r" id="row"></div></div></body>',{url:'https://example.test',runScripts:'outside-only'}),w=dom.window;
  for(const [key,value]of Object.entries(seed))w.localStorage.setItem(key,value);
  w.eval(code);const nodes=new Map(),hits={},old=w.document.getElementById('old');
  for(const id of new Set(w.MayatnikMirrorControls.profiles.flatMap(p=>p.nodes))){const n=w.document.createElement('button');n.dataset.n=id;n.innerHTML='<span class="gz-nm">'+id+'</span>';n.onclick=()=>hits[id]=(hits[id]||0)+1;old.append(n);nodes.set(id,n);}
  const args=[],lineState=[{id:'main',kind:'h',position:5,mode:0},{id:0,kind:'v',position:2,mode:0},{id:1,kind:'d1',position:0,mode:2}];let op='',colour='',ensured=0;
  w.mayMir={op:()=>op,col:()=>colour,set:(k,v)=>{if(k==='op')op=v;else colour=v;}};
  w.mayTemplateMirror={canApply:axis=>axis!=='line',apply:arg=>args.push(arg)};
  w.mayLineMirrors={list:()=>lineState.map(l=>({...l})),set:(id,m)=>{lineState.find(l=>l.id===id).mode=m;},ensure:()=>ensured++};
  const row=w.document.getElementById('row'),menu=w.MayatnikMirrorControls.mount({row,take:id=>nodes.get(id),window:w});
  return{dom,w,row,menu,nodes,hits,args,lineState,get ensured(){return ensured},get op(){return op}};
}
test('source changes only menu visibility, retaining the exact source nodes and handlers',()=>{const a=boot();try{
  const original=new Map([...a.nodes].map(([id,n])=>[id,n.onclick]));for(const p of a.menu.profiles){a.menu.setSource(p.id);for(const [id,n]of a.nodes){assert.equal(n.onclick,original.get(id));assert.equal(n.isConnected,true);assert.equal(n.hidden,p.nodes.includes(id)&&!['templateMirrorPair','bMirrorByLine','mirOp','bMirrorLine','bAxisXor'].includes(id)?false:true);}}
  assert.deepEqual(a.hits,{});assert.equal(a.args.length,0);a.menu.setSource('fill');a.nodes.get('fillMirror').click();assert.equal(a.hits.fillMirror,1);
}finally{a.dom.window.close();}});
test('template axis, copy and side call the page API explicitly, and line copy requires the line',()=>{const a=boot();try{
  const [source,axis,side,op,result,apply]=a.menu.controls;
  apply.click();assert.equal(a.args[0].axis,'h');assert.equal(a.args[0].copy,false);
  a.menu.optionsFor(result).find(o=>o.name==='Копией за край').pick();a.menu.optionsFor(side).find(o=>o.name==='Влево').pick();apply.click();assert.equal(a.args[1].copy,true);assert.equal(a.args[1].side,'left');
  a.menu.optionsFor(axis).find(o=>o.name==='Сверху ↔ снизу').pick();apply.click();assert.equal(a.args[2].axis,'v');assert.equal(a.args[2].side,'bottom');
  a.menu.optionsFor(axis).find(o=>o.name==='Линия-зеркало').pick();assert.equal(apply.disabled,true);assert.equal(result.disabled,true);assert.equal(a.args.length,3);
}finally{a.dom.window.close();}});
test('all raster lines are individually selectable, including fresh list objects and diagonal line',()=>{const a=boot();try{
  a.menu.setSource('lines');const [,axis,side,,,apply]=a.menu.controls;
  const choices=a.menu.optionsFor(axis);assert.equal(choices.length,3);assert.equal(choices[0].on,true);choices[2].pick();assert.equal(a.menu.optionsFor(axis)[2].on,true);
  a.menu.optionsFor(side)[1].pick();assert.equal(a.lineState[2].mode,1);assert.equal(a.lineState[0].mode,0);apply.click();assert.equal(a.ensured,1);
}finally{a.dom.window.close();}});
test('operations are configurable only for compatible engines; triTop stays XOR and canvas stays a separate copy',()=>{const a=boot();try{
  const op=a.menu.controls[3];a.menu.setSource('upper');a.menu.optionsFor(op).find(o=>o.name==='AND').pick();assert.equal(a.op,'and');
  a.menu.setSource('tri');assert.equal(op.disabled,true);assert.match(op.textContent,/Только XOR/);assert.equal(a.op,'and');assert.equal(a.menu.nodes.get('mirOp').hidden,true);
  a.menu.setSource('canvas');assert.equal(op.disabled,true);assert.match(a.menu.controls[4].textContent,/Отдельный холст/);
}finally{a.dom.window.close();}});
test('half-cell diagonals expose their limitation and cannot silently enable unsupported raster reflection',()=>{const a=boot();try{
  a.lineState[2].position=.5;a.lineState[2].disabled=true;a.menu.setSource('lines');const [,axis,side]=a.menu.controls;a.menu.optionsFor(axis)[2].pick();assert.equal(side.disabled,true);assert.match(side.textContent,/целый сдвиг/);assert.equal(a.menu.optionsFor(side).length,0);
}finally{a.dom.window.close();}});
test('manual operation follows legacy forced XOR, changing it clears that override, and one action toggles the effective mode',()=>{const a=boot();try{
  let forced=true,value='',on=true;a.w.mayManualMirror={op:()=>forced?'xor':value,setOp:v=>{forced=false;value=v;},on:()=>on,setOn:v=>on=v};
  a.menu.setSource('manual');const op=a.menu.controls[3];assert.match(op.textContent,/XOR/);assert.equal(a.menu.optionsFor(op).find(o=>o.name==='XOR').on,true);assert.equal(a.nodes.get('bAxisXor').hidden,true);
  a.menu.optionsFor(op).find(o=>o.name==='AND').pick();assert.equal(forced,false);assert.equal(value,'and');assert.match(op.textContent,/AND/);
  const action=a.nodes.get('bAxisMirror');action.click();assert.equal(on,false);assert.equal(a.hits.bAxisMirror,undefined);action.click();assert.equal(on,true);assert.equal(value,'and');assert.equal(action.getAttribute('aria-pressed'),'true');
}finally{a.dom.window.close();}});
test('ordered stages and source-dependent settings keep axis before side, operation before result; refresh does not move DOM',()=>{const a=boot();try{
  assert.deepEqual(Array.from(a.menu.controls.slice(0,5),b=>b.dataset.listTitle),['Что отражать','Ось','Сторона','Операция','Результат']);
  a.menu.setSource('manual');const ids=[...a.row.children].map(n=>n.dataset.n);assert.ok(ids.indexOf('bAxisLine')<ids.indexOf('mirrorSide'));assert.ok(ids.indexOf('bAxisMirror')>ids.indexOf('mirrorOperation'));assert.ok(ids.indexOf('bAxisMirror')<ids.indexOf('mirrorResult'));
  const mutations=[];const observer=new a.w.MutationObserver(rs=>mutations.push(...rs));observer.observe(a.row,{childList:true,subtree:true});a.menu.sync();assert.equal(observer.takeRecords().filter(r=>r.type==='childList').length,0);observer.disconnect();
}finally{a.dom.window.close();}});
test('menu state survives F5; compact migration preserves old keys, dock placement and backups',()=>{const seed={'mayatnik-control-mini-v464':'["group:Шаблоны:data:bMirrorLine"]','mayatnik-dd-grid':'{"gz:mirrors":[7,3],"Зеркала":[2,1]}','mayatnik-dd-pins':'["gz:mirrors","Оси"]'};const a=boot(seed);let saved;try{
  assert.deepEqual(JSON.parse(a.w.localStorage.getItem('mayatnik-control-mini-v464')),['group:Шаблоны:data:bMirrorLine','group:Зеркала:data:bMirrorLine']);assert.equal(a.w.localStorage.getItem('mayatnik-mirror-menu-before'),seed['mayatnik-control-mini-v464']);
  assert.deepEqual(JSON.parse(a.w.localStorage.getItem('mayatnik-dd-grid')),{'Зеркала':[2,1]});assert.deepEqual(JSON.parse(a.w.localStorage.getItem('mayatnik-dd-pins')),['Зеркала','Оси']);
  a.menu.setSource('black');saved=Object.fromEntries(Object.keys(a.w.localStorage).map(k=>[k,a.w.localStorage.getItem(k)]));
}finally{a.dom.window.close();}const b=boot(saved);try{assert.equal(b.menu.state.source,'black');assert.deepEqual(Object.fromEntries(Object.keys(b.w.localStorage).map(k=>[k,b.w.localStorage.getItem(k)])),saved);}finally{b.dom.window.close();}});
