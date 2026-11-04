const test=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const panel=require('./mayatnik-axes-panel.js'),frame=require('../_js/control-frame.js');
function boot(){
 const dom=new JSDOM('<div class="bar"></div><div class="pt-g" data-k="Оси" style="--c:#ff87cf"><div class="pt-r"></div></div>'),doc=dom.window.document,row=doc.querySelector('.pt-r'),sources={},events=[];
 const specs=[['symTriangleRows',2,16],['symRowsMin',2,2],['symRowsMax',0,''],['symBitsMin',2,2],['symBitsMax',0,0]];
 for(const [id,min,value]of specs){const label=doc.createElement('label'),input=doc.createElement('input');label.title='Полная подсказка '+id;input.id=id;input.type='number';input.min=min;input.max=16384;input.value=value;label.append(input);doc.querySelector('.bar').append(label);sources[id]=input;for(const type of ['input','change'])input.addEventListener(type,()=>events.push([id,type,input.value]));}
 const originals={};for(const id of ['triangleMapSource','axisPalette','crossLabels','triangleMapAxes','triangleMapMask','triangleMapMirror','autoAxes','sym','symV','symH','symD','symPlainV','symPlainH','symPlainD','symTriangles','bTriangleAxes','symBits','symTriangleRows','symRowsRange','symBitsRange','fixTri','fixAxis3','bFrameWindow','bRuler','clrAxes']){const b=doc.createElement('div');b.className='gz-hx';b.dataset.n=id;b.innerHTML='<i></i><span class="gz-nm">'+id+'</span>';b.addEventListener('click',()=>events.push([id,'click']));row.append(b);originals[id]=b;}
 const icons=[],api=panel.mount(row,{frame,short:t=>'short:'+t,icon:(node,kind)=>{icons.push([node.dataset.n,kind]);return 'url("'+kind+'.svg")';}});
 return {dom,doc,row,sources,events,originals,icons,api,input:id=>doc.querySelector('[data-axes-source="'+id+'"]'),box:id=>doc.querySelector('[data-n="'+id+'"]')};
}
test('four themes retain canonical command nodes, native callbacks, saved owner and meaningful icons',()=>{const f=boot();try{
 assert.deepEqual([...f.row.children].map(n=>n.dataset.axesSection),['map','symmetry','limits','actions']);assert.deepEqual([...f.row.querySelectorAll('[role=group]')].map(n=>n.getAttribute('aria-label')),['Карта','Симметрия','Пределы','Действия']);
 for(const [id,node]of Object.entries(f.originals)){assert.equal(f.box(id),node,id);assert.equal(node.closest('.pt-g').dataset.k,'Оси');}
 f.box('sym').click();assert.deepEqual(f.events,[['sym','click']]);assert.equal(f.box('triangleMapAxes').closest('[data-axes-section]').dataset.axesSection,'map');assert.equal(f.box('clrAxes').closest('[data-axes-section]').dataset.axesSection,'actions');
 const kinds=new Map(f.icons);assert.equal(kinds.get('axisPalette'),'colour');assert.equal(kinds.get('autoAxes'),'magnet');assert.equal(kinds.get('crossLabels'),'sector');assert.equal(kinds.get('sym'),'eye');for(const [id,kind]of [['symV','chessV'],['symH','chessH'],['symD','chessD'],['symPlainV','axisV'],['symPlainH','axisH'],['symPlainD','axisD']])assert.equal(kinds.get(id),kind);
 assert.equal(panel.mount(f.row,{frame}),null);assert.equal(f.row.querySelectorAll('[data-axes-section]').length,4);
 }finally{f.dom.window.close();}});
test('all five limits are real native ranges with shared X/value frame and separate accessible arrows',()=>{const f=boot();try{
 assert.equal(f.row.querySelectorAll('input[type=range]').length,5);assert.equal(f.row.querySelectorAll('.zcf-left').length,5);assert.equal(f.row.querySelectorAll('.zcf-right').length,5);
 for(const id of Object.keys(f.sources)){const input=f.input(id),box=input.closest('.zcf-control');assert.ok(box.classList.contains('may-axes-number'));assert.ok(box.querySelector('.zcf-thumb-outline'));for(const b of box.querySelectorAll('button')){assert.ok(b.getAttribute('aria-label'));assert.ok(b.querySelector('svg.may-control-chevron'));}assert.equal(input.getAttribute('aria-label').includes(id),false);assert.match(box.querySelector('output').textContent,/^(?:\d+|∞)$/,'only value travels inside thumb');assert.ok(f.box(id).querySelector('.may-axes-label').textContent.startsWith('short:'));}
 assert.deepEqual(f.events,[]);assert.equal(f.sources.symRowsMax.value,'');assert.equal(f.sources.symBitsMax.value,'0');
 }finally{f.dom.window.close();}});
test('range drag and arrow clicks dispatch native input/change once and read restored native state',()=>{const f=boot();try{
 const input=f.input('symTriangleRows');input.value='42';input.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));assert.equal(f.sources.symTriangleRows.value,'42');assert.deepEqual(f.events,[['symTriangleRows','input','42'],['symTriangleRows','change','42']]);
 f.box('symTriangleRows').querySelector('.zcf-right').click();assert.equal(f.sources.symTriangleRows.value,'43');f.box('symTriangleRows').querySelector('.zcf-left').click();assert.equal(f.sources.symTriangleRows.value,'42');
 f.sources.symTriangleRows.value='126';f.api.sync();assert.equal(input.value,'126');assert.match(input.getAttribute('aria-valuetext'),/126/);
 const key=new f.dom.window.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true});input.dispatchEvent(key);assert.equal(key.defaultPrevented,false,'native range keyboard default stays available');
 }finally{f.dom.window.close();}});
test('zero/blank infinity is stable, either upper range reaches infinity and left arrow returns to its current minimum',()=>{const f=boot();try{
 for(const [id,min]of [['symRowsMax','symRowsMin'],['symBitsMax','symBitsMin']]){const input=f.input(id),box=f.box(id);assert.match(input.getAttribute('aria-valuetext'),/∞/);f.sources[min].value='12';box.querySelector('.zcf-left').click();assert.equal(f.sources[id].value,'12');input.value=input.max;input.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));assert.equal(f.sources[id].value,'');assert.match(input.getAttribute('aria-valuetext'),/∞/);box.querySelector('.zcf-right').click();assert.equal(f.sources[id].value,'');}
 }finally{f.dom.window.close();}});
test('current native bounds, step and disabled state govern controls without changing sibling fields',()=>{const f=boot();try{
 const src=f.sources.symTriangleRows,box=f.box('symTriangleRows'),input=f.input('symTriangleRows');src.min='2';src.max='8';src.step='0.5';src.value='7.5';f.api.sync();box.querySelector('.zcf-right').click();assert.equal(src.value,'8');box.querySelector('.zcf-right').click();assert.equal(src.value,'8');box.querySelector('.zcf-left').click();assert.equal(src.value,'7.5');assert.equal(input.step,'0.5');assert.equal(input.max,'8');
 src.disabled=true;f.api.sync();assert.ok(input.disabled);assert.ok(box.querySelector('.zcf-left').disabled);const before=f.events.length;input.value='4';input.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));box.querySelector('.zcf-left').click();assert.equal(src.value,'7.5');assert.equal(f.events.length,before);assert.equal(f.sources.symRowsMin.value,'2');
 }finally{f.dom.window.close();}});
