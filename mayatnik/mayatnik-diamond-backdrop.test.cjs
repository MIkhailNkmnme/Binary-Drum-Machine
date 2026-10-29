const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const src=fs.readFileSync(__dirname+'/mayatnik-button-standard.js','utf8'),a=src.indexOf('  function contour('),b=src.indexOf('  // v0.449:',a),code=src.slice(a,b);
function setup(count=3){
 const dom=new JSDOM('<div class="gz-ladder may-button-options"><div class="may-list-heading">Options</div></div>'),doc=dom.window.document,host=doc.querySelector('div');host.getBoundingClientRect=()=>({left:100,top:100,width:120,height:count*26+38});
 const cells=Array.from({length:count},(_,i)=>{const n=doc.createElement('button');n.className='gz-hx may-option-button';n.textContent='Option '+i;n.getBoundingClientRect=()=>({left:100,top:126+i*26-host.scrollTop,width:120,height:24});host.insertBefore(n,host.firstChild);return n;});
 const c=vm.createContext({gradN:0,svg:cls=>{const n=doc.createElementNS('http://www.w3.org/2000/svg','svg');n.setAttribute('class',cls);return n;}});vm.runInContext(code,c);return{dom,host,cells,draw:()=>c.contour(host,cells,true)};
}
test('option column uses the common toothed backing and complete top/bottom brackets',()=>{
 const f=setup();try{const parents=f.cells.map(c=>c.parentNode),order=[...f.host.children];f.draw();assert.equal(f.host.querySelectorAll('polygon').length,1);const points=f.host.querySelector('polygon').getAttribute('points');assert.match(points,/122.00,38.00/);assert.match(points,/-2.00,64.00/);assert.match(points,/116.00,51.00/);assert.deepEqual([...f.host.querySelectorAll('.cap')].map(n=>n.getAttribute('d')),['M0 26 L12 14 H108 L120 26','M0 102 L12 114 H108 L120 102']);assert.ok(114<f.host.getBoundingClientRect().height);assert.equal(f.host.querySelector('.may-list-heading').textContent,'Options');assert.deepEqual([...f.host.children].slice(0,-1),order);f.cells.forEach((c,i)=>assert.equal(c.parentNode,parents[i]));assert.equal(f.host.lastElementChild.tagName,'svg');
 }finally{f.dom.window.close();}
});
test('scrolling the standard option column keeps backing in stable content coordinates',()=>{
 const f=setup(25);try{f.draw();const polygon=f.host.querySelector('polygon'),points=polygon.getAttribute('points');f.host.scrollTop=185;f.draw();assert.equal(f.host.querySelector('polygon'),polygon);assert.equal(polygon.getAttribute('points'),points);assert.equal(f.host.querySelectorAll('.cap').length,2);assert.ok(!f.host.querySelector('.may-diamond-back'));
 }finally{f.dom.window.close();}
});
test('a single option keeps the standard 120x24 footprint and ordinary SVG outline',()=>{
 const f=setup(1);try{f.draw();assert.match(f.host.querySelector('polygon').getAttribute('points'),/122.00,38.00/);const outline=src.slice(src.indexOf('  function outline('),src.indexOf('  function roof(')),doc=f.dom.window.document,row=doc.createElement('button');row.className='may-option-button';const ctx={polygon:'12,0 108,0 120,12 108,24 12,24 0,12',set:(n,k,v)=>n.setAttribute(k,v),svg:cls=>{const n=doc.createElementNS('http://www.w3.org/2000/svg','svg');n.setAttribute('class',cls);return n;},shape:(s,tag,attrs)=>{const n=doc.createElementNS(s.namespaceURI,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);s.append(n);}};vm.runInNewContext(outline,ctx);ctx.outline(row);assert.equal(row.querySelector('svg').getAttribute('viewBox'),'0 0 120 24');assert.equal(row.querySelector('polygon').getAttribute('points'),ctx.polygon);
 }finally{f.dom.window.close();}
});
