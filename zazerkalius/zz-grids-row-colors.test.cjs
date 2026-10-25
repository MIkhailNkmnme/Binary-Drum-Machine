const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const G=require('./zz-grids.js'),clone=x=>JSON.parse(JSON.stringify(x));
const state=()=>({rows:['1010','0101'],cur:0,colors:{},groups:{},dots:{},lines:{},scenes:[],text:'',textBlocks:[]});
test('baseline initializes once before mutation and changed bits include erased ones',()=>{
 const s=state(),base=G.baseline(s);assert.notEqual(base,s.rows);G.write(s,0,0,null);G.write(s,0,1,'#123456');
 assert.equal(G.baseline(s),base);assert.deepEqual(base,['1010','0101']);
 assert.deepEqual(G.rowBits(s,0),[{bit:'0',changed:true,color:''},{bit:'1',changed:true,color:'#123456'},{bit:'1',changed:false,color:''},{bit:'0',changed:false,color:''}]);
 G.reconcile(s,['1010','0101']);assert.ok(G.rowBits(s,0).every(b=>!b.changed));
});
test('row insertion, copy and deletion shift baseline with cells; scene and undo copies retain it',()=>{
 const s=state();G.write(s,1,0,'#ff0000');const snapshot=G.scene(s);
 G.shiftRows(s,0,0,['0000']);assert.deepEqual(s.rowsBase,['0000','1010','0101']);assert.equal(G.rowBits(s,2)[0].changed,true);
 G.shiftRows(s,3,0,[s.rows[2]],[s.rowsBase[2]]);assert.deepEqual(G.rowBits(s,3).map(b=>b.changed),[true,false,false,false]);
 G.shiftRows(s,1,1,[]);assert.deepEqual(s.rowsBase,['0000','0101','0101']);
 Object.assign(s,clone(snapshot));assert.deepEqual(s.rowsBase,['1010','0101']);assert.equal(G.rowBits(s,1)[0].changed,true);
 G.shiftRows(s,0,99,[]);assert.deepEqual(s.rowsBase,['0']);assert.deepEqual(s.rows,['0']);
});
function domFixture(){
 let JSDOM;for(const p of ['jsdom',process.env.SETKA_JSDOM,path.join(process.env.TEMP||'/tmp','codex-setka-dom/node_modules/jsdom')].filter(Boolean))try{({JSDOM}=require(p));break;}catch{}
 if(!JSDOM)throw new Error('Set SETKA_JSDOM to the installed jsdom package; no browser is used.');
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../setka/Zerkalius-setka.html'),'utf8'),{url:'http://test.local/',runScripts:'outside-only'}),w=dom.window;
 w.matchMedia=()=>({matches:false});w.eval(fs.readFileSync(path.join(__dirname,'zz-grids.js'),'utf8'));
 const api=w.ZZGrids,s=state(),snapshots=[],source=['010','101'],view={axes:[]},doc=w.document;
 const cfg={state:()=>s,view:()=>view,geometry:()=>({}),hit:()=>null,polygon:()=>[],snapshot:before=>snapshots.push(clone(before||s)),locked:()=>false,redraw:()=>api.sync(),save(){},message(){},stop(){},fit(){},importRows:()=>source,editor:()=>({selection:()=>[],clear(){}}),axis:()=>({cancel(){}}),legacy:()=>({scenes:[]})};
 api.mount(doc.getElementById('rmbCv'),cfg);
 return {dom,w,doc,api,s,source,snapshots,input:r=>doc.querySelector('input[data-row="'+r+'"]'),bits:r=>[...doc.querySelector('.grids-row[data-row="'+r+'"] .grids-row-bits').children]};
}
test('real row DOM colors individual bits, reacts to recoloring and keeps unchanged rows stable',()=>{
 const f=domFixture();try{
  const initial=f.input(0);f.api.sync();assert.equal(f.input(0),initial);
  f.api.write(f.s,0,0,null);f.api.write(f.s,0,1,'#123456');f.api.sync();
  let bits=f.bits(0);assert.equal(bits.length,4);assert.equal(bits[0].textContent,'0');assert.ok(bits[0].classList.contains('grids-bit-changed'));assert.equal(bits[0].style.color,'');assert.equal(bits[1].style.color,'rgb(18, 52, 86)');assert.equal(bits[2].className,'');
  const oldInput=f.input(0);f.s.colors['0,1']='#abcdef';f.api.sync();assert.notEqual(f.input(0),oldInput);assert.equal(f.bits(0)[1].style.color,'rgb(171, 205, 239)');
  const stable=f.input(0);f.api.sync();assert.equal(f.input(0),stable);
 }finally{f.dom.window.close();}
});
test('native input focus, edits and horizontal scroll remain separate from the colored overlay',()=>{
 const f=domFixture();try{
  const input=f.input(0);input.scrollLeft=38;input.dispatchEvent(new f.w.Event('scroll'));assert.equal(input.parentElement.querySelector('.grids-row-bits').style.transform,'translateX(-38px)');
  f.api.write(f.s,0,1,'#ff0000');f.api.sync();assert.equal(f.input(0).scrollLeft,38);
  const editing=f.input(0);editing.focus();editing.value='0000';f.api.sync();assert.equal(f.input(0),editing);assert.equal(editing.value,'0000');
  editing.dispatchEvent(new f.w.Event('change',{bubbles:true}));assert.equal(f.s.rows[0],'0000');assert.deepEqual(clone(f.s.rowsBase),['1010','0101']);
  editing.blur();f.api.sync();assert.deepEqual(f.bits(0).map(b=>b.classList.contains('grids-bit-changed')),[true,false,true,false]);
  const css=fs.readFileSync(path.join(__dirname,'zz-grids.css'),'utf8');assert.match(css,/:focus-within \.grids-row-ink\{visibility:hidden\}/);assert.match(css,/input:focus\{color:var\(--txt\);-webkit-text-fill-color:var\(--txt\)\}/);
 }finally{f.dom.window.close();}
});
test('replacement import establishes fresh independent baseline; scenes without baseline migrate independently',()=>{
 const f=domFixture();try{
  f.api.write(f.s,0,0,null);f.doc.getElementById('gridsRowsImport').click();assert.deepEqual(clone(f.s.rowsBase),f.source);assert.notEqual(f.s.rowsBase,f.s.rows);assert.notEqual(f.s.rowsBase,f.source);assert.ok(f.api.rowBits(f.s,0).every(b=>!b.changed));
  f.api.write(f.s,0,0,'#ff0000');f.doc.getElementById('gridsSceneNew').click();assert.deepEqual(clone(f.s.scenes[0].data.rowsBase),f.source);
  const legacy={name:'Old',data:{...clone(f.s.scenes[0].data),rows:['111']}};delete legacy.data.rowsBase;f.s.scenes.push(legacy);f.api.sync();
  const select=f.doc.getElementById('gridsScenes');select.value='1';select.dispatchEvent(new f.w.Event('change',{bubbles:true}));assert.deepEqual(clone(f.s.rowsBase),['111']);
  select.value='0';select.dispatchEvent(new f.w.Event('change',{bubbles:true}));assert.deepEqual(clone(f.s.rowsBase),f.source);assert.equal(f.api.rowBits(f.s,0)[0].changed,true);assert.deepEqual(f.source,['010','101']);
 }finally{f.dom.window.close();}
});
