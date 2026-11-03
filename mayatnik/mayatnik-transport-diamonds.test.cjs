'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const source=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8');
const start=source.indexOf('  // v0.790: ромбы x/t'),end=source.indexOf('  rail.el.querySele',start),script=source.slice(start,end);
function setup(options={}){
 const dom=new JSDOM('<body class="mayatnik-menu-ready"><input id="speed" min="1" max="64" step="1" value="1"><input id="frameT" min="0" max="40" step="1" value="0"><div id="mayBottomBar"><div class="gz-sl"></div></div></body>',{runScripts:'outside-only'}),w=dom.window,doc=w.document;
 const rects={sp:{left:350,top:10,width:30,height:24},ft:{left:550,top:10,width:30,height:24},...options.rects};
 let viewport={left:0,top:0,width:1000,height:700,...options.viewport},changes=0;
 const style=doc.createElement('style');style.textContent=fs.readFileSync(__dirname+'/mayatnik-menu.css','utf8');doc.head.append(style);
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLElement.prototype.getBoundingClientRect=function(){const key=this.closest('.may-transport-diamond')?.dataset.k,r=rects[key];return r?{...r,right:r.left+r.width,bottom:r.top+r.height}:{left:0,top:0,right:0,bottom:0,width:0,height:0};};
 Object.assign(w,{$:id=>doc.getElementById(id),mobileMenu:{matches:!!options.mobile},menuVisualViewport:()=>viewport,toolSync:[],rail:{refresh(){}},suppressPlayerTips(){},fire(input){changes++;input.dispatchEvent(new w.Event('input'));}});
 w.eval(script);
 const button=key=>doc.querySelector(`[data-k="${key}"] .may-transport-center`),open=key=>{button(key).click();return doc.querySelector('.may-transport-options');};
 return {dom,w,doc,button,open,rects,get changes(){return changes;},setViewport(next){viewport={...viewport,...next};w.dispatchEvent(new w.Event('resize'));},close(){dom.window.close();}};
}
test('both option diamonds are centered below their owner rather than anchored to its left edge',()=>{
 const f=setup();try{for(const key of ['sp','ft']){const popup=f.open(key),width=Number.parseFloat(popup.style.getPropertyValue('--transport-popup-width')),r=f.rects[key];assert.equal(+popup.style.left.replace('px','')+width/2,r.left+r.width/2);assert.equal(popup.style.top,r.top+r.height+2+'px');f.doc.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));}}finally{f.close();}
});
test('x retains all 64 values and t contains exactly all 41 seconds choices in a complete symmetric diamond',()=>{
 const f=setup();try{
  let popup=f.open('sp'),options=[...popup.querySelectorAll('[data-value]')];assert.equal(options.length,64);assert.deepEqual(options.map(b=>b.textContent),Array.from({length:64},(_,i)=>String(i+1)));assert.ok(options.every(b=>!b.textContent.includes('×')));
  popup=f.open('ft');options=[...popup.querySelectorAll('[data-value]')];assert.equal(options.length,41);assert.ok(popup.classList.contains('may-delay-options'));assert.equal(popup.querySelectorAll('.may-transport-option-row').length,0);
  assert.deepEqual(options.map(b=>+b.dataset.value),Array.from({length:41},(_,i)=>i));assert.equal(options[0].textContent,'0с');assert.equal(options.at(-1).textContent,'2с');assert.ok(options.every(b=>b.textContent.includes('с')));
  const counts=Array.from({length:9},(_,r)=>options.filter(b=>parseInt(b.style.top)===r*24).length);assert.deepEqual(counts,[1,3,5,7,9,7,5,3,1]);
  for(let r=0;r<9;r++){const cells=options.filter(b=>parseInt(b.style.top)===r*24),first=parseInt(cells[0].style.left),last=parseInt(cells.at(-1).style.left)+30;assert.equal((first+last)/2,135);}
  assert.ok(options.every(b=>parseInt(b.style.left)>=0&&parseInt(b.style.left)+30<=270&&parseInt(b.style.top)+24<=216));
 }finally{f.close();}
});
test('selected seconds, repeat-click cycling, arrows, keyboard choice and outside close retain their original inputs',()=>{
 const f=setup();try{
  let popup=f.open('ft');popup.querySelector('[data-value="40"]').click();assert.equal(f.doc.getElementById('frameT').value,'40');assert.equal(f.doc.querySelector('.may-transport-options'),null);
  popup=f.open('ft');assert.equal(popup.querySelector('[aria-checked="true"]').dataset.value,'40');f.button('ft').click();assert.equal(f.doc.getElementById('frameT').value,'0');
  const chosen=popup.querySelector('[data-value="17"]');chosen.focus();chosen.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));assert.equal(f.doc.getElementById('frameT').value,'17');
  f.doc.querySelector('[data-k="ft"] [data-direction="1"]').click();assert.equal(f.doc.getElementById('frameT').value,'18');assert.ok(f.changes>0);
  f.open('sp');f.doc.body.dispatchEvent(new f.w.Event('pointerdown',{bubbles:true}));assert.equal(f.doc.querySelector('.may-transport-options'),null);assert.equal(f.button('sp').getAttribute('aria-expanded'),'false');
 }finally{f.close();}
});
test('visual viewport clamps at either edge and short views scroll below the owner without hiding valid choices',()=>{
 const f=setup({mobile:true,viewport:{left:100,top:80,width:300,height:180},rects:{sp:{left:102,top:84,width:30,height:24},ft:{left:368,top:84,width:30,height:24}}});try{
  let popup=f.open('sp');assert.equal(popup.style.left,'104px');assert.equal(popup.style.top,'110px');assert.equal(popup.style.maxHeight,'146px');
  popup=f.open('ft');assert.equal(popup.style.left,'126px');assert.equal(popup.style.top,'110px');assert.equal(popup.style.maxHeight,'146px');assert.equal(popup.querySelectorAll('[data-value]').length,41);
  f.setViewport({width:200});assert.equal(popup.style.left,'104px');assert.equal(popup.style.getPropertyValue('--transport-popup-width'),'192px');
  assert.equal(popup.querySelector('.may-delay-diamond').children.length,41);
  f.setViewport({left:200,width:500,height:400});assert.equal(popup.style.left,'248px');assert.equal(popup.style.top,'110px');
 }finally{f.close();}
});
test('diamond list CSS keeps each seconds label inside a rhombus and supports horizontal overflow on narrow viewports',()=>{
 const css=fs.readFileSync(__dirname+'/mayatnik-menu.css','utf8');
 assert.match(css,/\.may-speed-diamond\{[^}]*clip-path:polygon\(50% 0,100% 50%,50% 100%,0 50%\)/);
 assert.match(css,/\.may-delay-diamond\{width:270px;height:216px\}/);
 assert.match(css,/\.may-speed-diamond\.may-delay-diamond>\.may-transport-option\{font-size:7px\}/);
 assert.match(css,/may-speed-options\{[^}]*overflow-x:auto!important/);
});
