const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const source=fs.readFileSync(path.join(__dirname,'mayatnik-menu.js'),'utf8'),a=source.indexOf('  function reconcileAxisMenus('),b=source.indexOf('  reconcileAxisMenus(',a+1),code=source.slice(a,b);
const keys=['mayMirAxis','mayContour','sym','symV','symH','symD','symBits','symTriangles','bTriangleAxes','symTriangleRows','symRowsRange','symBitsRange','bAxisLine','bAxisMirror','bAxisXor','bAxisLinesClear'];
function boot(){const dom=new JSDOM('<div id="sources"></div><div id="rail"><div class="gz-group" data-id="mirrors"><div class="gz-soty"></div><div class="gz-wide"></div></div></div><div id="axis"></div><div id="manual"></div>'),doc=dom.window.document,axis=doc.getElementById('axis'),manual=doc.getElementById('manual'),narrow=[],wide=[],original=new Map(),counts={};
 const definitions=[{id:'mirrors',items:keys.map((id,i)=>({type:i>=9&&i<=11?(i===9?'value':'vpair'):'toggle'}))}];
 keys.forEach((id,i)=>{const source=doc.createElement('input');source.id=id;source.hidden=true;doc.getElementById('sources').append(source);const n=doc.createElement('button');n.className='gz-hx';n.textContent=id;n.onclick=()=>counts[id]=(counts[id]||0)+1;
 if(i>=9&&i<=11){wide.push(n);if(i>9)n.innerHTML='<span class="part">min</span><span class="part">max</span>';doc.querySelector('.gz-wide').append(n);}else{narrow.push(n);doc.querySelector('.gz-soty').append(n);}original.set(id,n);
 if(['sym','symV','symH','symD','symTriangles','bTriangleAxes','bAxisLine','bAxisMirror','bAxisXor','bAxisLinesClear'].includes(id)){const copy=n.cloneNode(true);copy.dataset.n=id;copy.onclick=n.onclick;axis.append(copy);}
 if(i>=12){n.dataset.n=id;manual.append(n);}
 });
 const storage=new Map([['mayatnik-control-mini-v464',JSON.stringify(['group:mirrors:parent:gz-soty:slot:2','group:mirrors:parent:gz-wide:slot:1','group:Оси:data:bAxisLine'])]]),legacy=new Map([['mirrors',narrow]]),ctx={manualLegacyCells:legacy,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}};vm.createContext(ctx);vm.runInContext(code,ctx);ctx.reconcileAxisMenus({el:doc.getElementById('rail')},definitions,axis,manual);
 return{dom,doc,axis,manual,original,narrow,legacy,storage,counts,ctx};}
test('one canonical control per axis function; unique mirrors remain and hidden sources are never removed',()=>{const f=boot();try{
 assert.deepEqual([...f.doc.querySelectorAll('.gz-group[data-id=mirrors] .gz-hx')].map(n=>n.textContent),['mayMirAxis','mayContour']);
 for(const id of keys.slice(2)){assert.equal(f.doc.querySelectorAll('[data-n="'+id+'"]').length,1,id);assert.ok(f.doc.getElementById(id).hidden);const node=f.doc.querySelector('[data-n="'+id+'"]');node.click();assert.equal(f.counts[id],1,id);assert.equal(node.parentElement,id.startsWith('bAxis')?f.manual:f.axis);}
 for(const id of ['symRowsRange','symBitsRange'])assert.equal(f.doc.querySelector('[data-n='+id+']').querySelectorAll('.part').length,2);
 }finally{f.dom.window.close();}});
test('old rail pin ordinals point at live canonical nodes; micro keys migrate additively with a backup',()=>{const f=boot();try{
 for(const [i,node]of f.legacy.get('mirrors').entries()){assert.ok(node.isConnected);if(i>=2){assert.equal(node.dataset.mayPinGroup,'mirrors');assert.equal(node.dataset.mayPinIndex,String(i));}}
 const mini=JSON.parse(f.storage.get('mayatnik-control-mini-v464'));for(const key of ['group:Оси:data:sym','group:Оси:data:symRowsRange','group:Ручные оси:data:bAxisLine'])assert.ok(mini.includes(key),key);assert.ok(f.storage.has('mayatnik-axes-mini-before-v042'));
 }finally{f.dom.window.close();}});
test('canonical symmetry adapter refreshes aria and retains the hide-all callback semantics',()=>{
 const start=source.indexOf("  for (const [id, kind] of [['bPaintMeet'"),end=source.indexOf('  // v0.176:',start),dom=new JSDOM('<div id="row"></div>'),doc=dom.window.document,row=doc.getElementById('row'),groupOf={},sync=[];let hides=0;
 const ids=[...source.slice(start,end).matchAll(/\['([^']+)'\s*,\s*'[^']+'\]/g)].map(m=>m[1]);for(const id of ids){if(doc.getElementById(id))continue;const n=doc.createElement(id.startsWith('sym')?'input':'button');n.id=id;if(id.startsWith('sym'))n.type='checkbox';doc.body.append(n);groupOf[id]=row;}
 const hide=doc.createElement('button');hide.id='mayHideAxes';hide.hidden=true;hide.onclick=()=>{hides++;hide.hidden=true;doc.getElementById('sym').checked=false;};doc.body.append(hide);
 const ctx={document:doc,$:id=>doc.getElementById(id),icon:()=>'',tip:()=>'',groupOf,toolSync:sync};vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);const button=row.querySelector('[data-n=sym]'),input=doc.getElementById('sym');
 button.click();for(const fn of sync)fn();assert.equal(input.checked,true);assert.equal(button.getAttribute('aria-pressed'),'true');hide.hidden=false;button.click();for(const fn of sync)fn();assert.equal(hides,1);assert.equal(input.checked,false);assert.equal(button.getAttribute('aria-pressed'),'false');dom.window.close();
});
test('legacy mirror pin follows canonical on/off, aria and disabled state after a refresh',()=>{const f=boot();try{const src=f.legacy.get('mirrors')[2],el=src.cloneNode(true),pins=[{src,el,x:10,y:20}];f.doc.body.append(el);const start=source.indexOf('  function placePins()'),end=source.indexOf('  pins = pins.filter',start);
 const c={pins,$:()=>({getBoundingClientRect:()=>({left:100,top:200})})};vm.createContext(c);vm.runInContext(source.slice(start,end),c);
 for(const on of [true,false,true]){src.classList.toggle('on',on);src.setAttribute('aria-pressed',String(on));c.placePins();assert.equal(el.classList.contains('gz-on'),on);assert.equal(el.classList.contains('on'),on);assert.equal(el.getAttribute('aria-pressed'),String(on));}
 src.disabled=true;c.placePins();assert.equal(el.disabled,true);assert.equal(el.getAttribute('aria-disabled'),'true');src.disabled=false;c.placePins();assert.equal(el.disabled,false);
 assert.equal(el.style.left,'110px');assert.equal(el.style.top,'220px');
 }finally{f.dom.window.close();}});
