const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8'),menu=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8');
const a=html.indexOf('  function frameBuildType('),b=html.indexOf('  function status()',a),typeSource=html.slice(a,b);
function label(st={},testPattern=null){const c={st:{mode:'pend',view:'bits',...st},testPattern,pairOn:()=>!!c.st.pair&&c.st.mode==='pend'};vm.createContext(c);vm.runInContext(typeSource,c);return c.frameBuildType();}

test('flat display styles retain the actual construction type and all real rhomb views are named',()=>{
 for(const view of ['bits','col','digits','digitsOnly','bitContours'])assert.equal(label({view}),'Маятник');
 const names={romb0:'Чётные ромбы',romb1:'Нечётные ромбы',romb2:'Оба ромба рядом',rombJoin:'Соединённый ромб',rombJoin180:'Соединённый ромб 180°'};
 const views=[...html.matchAll(/<option value="(romb[^"]*)"/g)].map(m=>m[1]);assert.deepEqual(views.sort(),Object.keys(names).sort());
 for(const [view,name]of Object.entries(names))assert.equal(label({view}),name);
});

test('construction direction, paired vertices, simultaneous sides and actual test kinds remain distinguishable',()=>{
 for(const [mode,name]of Object.entries({pend:'Маятник',pendR:'Маятник право-лево',left:'Влево',right:'Вправо',one:'Одна вершина'}))assert.equal(label({mode}),name);
 assert.equal(label({pair:true}),'Маятник · Пара вершин');assert.equal(label({both:true}),'Маятник · Обе стороны рядом');assert.equal(label({both:true,view:'romb0'}),'Чётные ромбы');
 for(const [kind,name]of Object.entries({random:'Рандом',carpet:'Ковёр Серпинского',xor:'Тест XOR'}))assert.equal(label({}, {kind}),name);
});

test('all thirteen comparison sources, mirroring and overlay retain their real source/operation',()=>{
 const names={cone:'Конусы',field:'Поле',pair:'Обе стороны',p12:'Наложение 1–2 XOR',p23:'Наложение 2–3 XOR',p31:'Наложение 3–1 XOR',p123:'Наложение 1–2–3 XOR',a12:'Наложение 1–2 AND',a23:'Наложение 2–3 AND',a31:'Наложение 3–1 AND',a123:'Наложение 1–2–3 AND',xor:'Конусы XOR Поле',and:'Конусы AND Поле'};
 for(const [compareSource,name]of Object.entries(names)){assert.equal(label({compareSource}),name);assert.equal(label({compareSource,compareMirror:true}),name+' · Зеркально');}
 assert.equal(label({ovl:{n:2}}),'Наложение · Маятник');assert.equal(label({compareSource:'field',ovl:{n:1}}),'Наложение · Поле');assert.equal(label({compareSource:'p123',ovl:{n:1}}),'Наложение 1–2–3 XOR');assert.equal(label({compareSource:'field',view:'rombJoin180'}),'Поле · Соединённый ромб 180°');
});

test('status updates only type metadata and preserves the original current/total frame values',()=>{
 const nodes={stat:{},frame:{dataset:{}},frameV:{},frameWho:{}},c={st:{mode:'pend',view:'bits',rows:4096},testPattern:null,testXorInfo:null,k:66,target:66,geo:{W:100},gpuBig:null,total:()=>8191,pairOn:()=>false,compareOn:()=>!!c.st.compareSource,testStatsUpdate(){},coneContinueError:'',$:id=>nodes[id]};vm.createContext(c);const end=html.indexOf('  // v0.002: масштаб',b);vm.runInContext(html.slice(a,end),c);
 c.status();assert.equal(nodes.frame.dataset.buildType,'Маятник');assert.equal(nodes.frame.value,66);assert.equal(nodes.frame.dataset.rows,'4096');assert.equal(nodes.frameV.textContent,66);
 c.st.view='romb1';c.status();assert.equal(nodes.frame.dataset.buildType,'Нечётные ромбы');assert.equal(nodes.frame.value,66);assert.equal(nodes.frame.dataset.rows,'4096');
 c.st.compareSource='field';c.status();assert.equal(nodes.frame.dataset.buildType,'Поле · Нечётные ромбы');assert.equal(nodes.frame.dataset.rows,'8191');
 c.st.compareSource='';c.testPattern={kind:'xor'};c.testXorInfo={frame:12,max:999};c.status();assert.equal(nodes.frame.value,12);assert.equal(nodes.frame.dataset.rows,'999');assert.equal(nodes.frame.dataset.buildType,'Тест XOR · Нечётные ромбы');
});

function domFixture({barLeft=100,thumbLeft=220,width=1000}={}){
 const dom=new JSDOM('<body><div id="mayBottomBar"><div id="cell"><div id="mid"><span class="gz-vl">66 \\ 4096</span></div></div></div><input id="frame"></body>'),w=dom.window,d=w.document,mid=d.getElementById('mid'),cell=d.getElementById('cell'),bar=cell.parentElement,vl=mid.querySelector('.gz-vl');
 Object.defineProperty(vl,'offsetWidth',{value:60});bar.getBoundingClientRect=()=>({left:barLeft,top:40,width:240,height:24});const th={getBoundingClientRect:()=>({left:thumbLeft,width:2,bottom:64})};
 const context={document:d,mid,cell,th,innerWidth:width,innerHeight:800,MutationObserver:w.MutationObserver,ResizeObserver:class{observe(){}},addEventListener(){},playPlace(){},$:id=>d.getElementById(id)};vm.createContext(context);
 const start=menu.indexOf("      const vl = mid.querySelector('.gz-vl'),buildLabel="),end=menu.indexOf('  // v0.332:',start),fragment=menu.slice(start,end).trim().replace(/\}\s*\}\s*$/,'');assert.ok(start>0&&end>start);vm.runInContext(fragment+';globalThis.updateType=side;globalThis.disposeType=()=>valueObserver.disconnect();',context);
 return {dom,w,d,vl,context,label:bar.querySelector('.may-frame-type'),close(){context.disposeType();dom.window.close();}};
}

test('real menu label stays left of the unchanged counter and changes at the same frame',async()=>{
 const f=domFixture();try{assert.equal(f.vl.textContent,'66 \\ 4096');assert.equal(f.vl.style.left,'121px');assert.equal(f.label.style.left,'85px');assert.equal(f.label.textContent,'Маятник');
  f.d.getElementById('frame').dataset.buildType='Чётные ромбы';await new Promise(resolve=>setImmediate(resolve));assert.equal(f.label.textContent,'Чётные ромбы');assert.equal(f.vl.textContent,'66 \\ 4096');assert.equal(f.vl.style.left,'121px');assert.equal(f.d.querySelectorAll('.may-frame-type').length,1);
 }finally{f.close();}
});

test('at a narrow left edge the full type wraps below without pushing or shortening the counter',()=>{
 const f=domFixture({barLeft:0,thumbLeft:12,width:390});try{const value='Наложение 1–2–3 AND · Соединённый ромб 180° · Зеркально';f.d.getElementById('frame').dataset.buildType=value;f.context.updateType();assert.equal(f.label.textContent,value);assert.equal(f.label.style.left,'4px');assert.equal(f.label.style.transform,'none');assert.equal(f.label.style.maxWidth,'300px');assert.equal(f.label.style.top,'38px');assert.equal(f.vl.style.left,'13px');assert.equal(f.vl.textContent,'66 \\ 4096');const css=fs.readFileSync(__dirname+'/mayatnik-menu.css','utf8');assert.match(css,/\.may-frame-type\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/);assert.doesNotMatch(css.match(/\.may-frame-type\{[^}]*\}/)[0],/ellipsis/);
 }finally{f.close();}
});

test('overlay redraw synchronizes type without relying on frame advancement or changing the shared player',()=>{
 assert.match(html,/function ovlDraw\(\) \{ frameBuildTypeSync\(\)/);const expr=menu.match(/num\('frame', \{ name: 'Кадр', fmt: (.*?), zero: 0/)[1],format=vm.runInNewContext('('+expr+')',{$:()=>({dataset:{rows:'4096',buildType:'Маятник'}})});assert.equal(format(66),'66 \\ 4096');
});
