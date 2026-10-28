const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require(process.env.SETKA_JSDOM||'jsdom');
const menu=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8');
function fixture(){
 const dom=new JSDOM('<input id="rows" value="128"><button id="bBuild"></button><div id="popup"></div>',{runScripts:'outside-only'}),w=dom.window,d=w.document;
 let builds=0;d.getElementById('bBuild').onclick=()=>builds++;
 w.eval(`const $=id=>document.getElementById(id),cur=()=>$('rows').value,pop=$('popup'),section=node=>node;
 ${menu.slice(menu.indexOf('    let customInput = null'),menu.indexOf("    { const rb = document.createElement('button')"))}
 function sync(){customInput.value=cur();syncRowsThumb();} window.syncDraft=sync;`);
 const input=d.querySelector('.may-rows-line input'),thumb=d.querySelector('.may-rows-thumb'),line=d.querySelector('.may-rows-line');
 line.getBoundingClientRect=()=>({left:100,width:120});thumb.setPointerCapture=()=>{};thumb.hasPointerCapture=()=>false;
 const key=(key,shiftKey=false)=>thumb.dispatchEvent(new w.KeyboardEvent('keydown',{key,shiftKey,bubbles:true,cancelable:true}));
 const pointer=(type,clientX)=>{const ev=new w.MouseEvent(type,{clientX,button:0,bubbles:true,cancelable:true});Object.defineProperty(ev,'pointerId',{value:7});thumb.dispatchEvent(ev);};
 return{dom,w,d,input,thumb,key,pointer,get builds(){return builds},get actual(){return d.getElementById('rows').value}};
}
test('drag changes only draft, clamps both ends and Enter builds exactly once',()=>{
 const f=fixture();try{
  f.pointer('pointerdown',134);f.pointer('pointermove',160);assert.equal(f.input.value,'2052');assert.equal(f.thumb.getAttribute('aria-valuenow'),'2052');assert.equal(f.actual,'128');assert.equal(f.builds,0);
  f.pointer('pointermove',999);assert.equal(f.input.value,'4096');f.pointer('pointermove',0);assert.equal(f.input.value,'8');f.pointer('pointerup',0);
  f.pointer('pointermove',160);assert.equal(f.input.value,'8');f.key('Enter');assert.equal(f.actual,'8');assert.equal(f.builds,1);
 }finally{f.dom.window.close();}
});
test('number editing, arrows, slider keyboard and preset sync share the same draft',()=>{
 const f=fixture();try{
  f.input.value='150';f.input.dispatchEvent(new f.w.Event('input'));assert.equal(f.thumb.getAttribute('aria-valuenow'),'150');
  f.d.querySelector('[data-dir="right"]').click();assert.equal(f.input.value,'151');f.key('ArrowRight',true);assert.equal(f.input.value,'161');assert.equal(f.builds,0);
  f.key('End');assert.equal(f.input.value,'4096');f.key('Home');assert.equal(f.input.value,'8');
  f.d.getElementById('rows').value='512';f.w.syncDraft();assert.equal(f.input.value,'512');assert.equal(f.thumb.getAttribute('aria-valuenow'),'512');
  f.input.value='200';f.d.querySelector('.may-rows-custom>.gz-hx').click();assert.equal(f.actual,'200');assert.equal(f.builds,1);
 }finally{f.dom.window.close();}
});
