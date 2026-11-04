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
test('x lists 64 choices and t packs 21 even ticks edge-to-edge with powers centered',()=>{
 const f=setup();try{
  let popup=f.open('sp'),options=[...popup.querySelectorAll('[data-value]')];assert.equal(options.length,64);assert.deepEqual(options.map(b=>b.textContent),Array.from({length:64},(_,i)=>String(i+1)));
  popup=f.open('ft');options=[...popup.querySelectorAll('[data-value]')];assert.equal(options.length,21);
  assert.deepEqual(options.map(b=>+b.dataset.value),Array.from({length:21},(_,i)=>i*2));assert.equal(options[0].textContent,'0');assert.equal(options.at(-1).textContent,'2');
  const middle=options.filter(b=>parseInt(b.style.left)===60).sort((a,b)=>parseInt(a.style.top)-parseInt(b.style.top));
  assert.deepEqual(middle.map(b=>+b.dataset.value),[2,4,8,16,32]);
  for(const b of options){const x=parseInt(b.style.left),y=parseInt(b.style.top);
    for(const [vx,vy]of [[x+15,y],[x+30,y+12],[x+15,y+24],[x,y+12]])assert.ok(Math.abs(vx-75)/75+Math.abs(vy-60)/60<=1+1e-9);
    assert.ok(options.some(other=>{if(other===b)return false;const dx=Math.abs(x-parseInt(other.style.left)),dy=Math.abs(y-parseInt(other.style.top));return dx===15&&dy===12;}),'each option shares an edge with another');
  }
  for(let i=0;i<options.length;i++)for(let j=i+1;j<options.length;j++){
    const dx=Math.abs(parseInt(options[i].style.left)-parseInt(options[j].style.left)),dy=Math.abs(parseInt(options[i].style.top)-parseInt(options[j].style.top));assert.ok(dx/30+dy/24>=1-1e-9);
  }
 }finally{f.close();}
});

test('selected seconds, repeat-click cycling, arrows, keyboard choice and outside close retain their original inputs',()=>{
 const f=setup();try{
  let popup=f.open('ft');popup.querySelector('[data-value="40"]').click();assert.equal(f.doc.getElementById('frameT').value,'40');assert.equal(f.doc.querySelector('.may-transport-options'),null);
  popup=f.open('ft');assert.equal(popup.querySelector('[aria-checked="true"]').dataset.value,'40');f.button('ft').click();assert.equal(f.doc.getElementById('frameT').value,'0');
  const chosen=popup.querySelector('[data-value="18"]');chosen.focus();chosen.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));assert.equal(f.doc.getElementById('frameT').value,'18');
  f.doc.querySelector('[data-k="ft"] [data-direction="1"]').click();assert.equal(f.doc.getElementById('frameT').value,'19');assert.ok(f.changes>0);
  f.open('sp');f.doc.body.dispatchEvent(new f.w.Event('pointerdown',{bubbles:true}));assert.equal(f.doc.querySelector('.may-transport-options'),null);assert.equal(f.button('sp').getAttribute('aria-expanded'),'false');
 }finally{f.close();}
});
test('visual viewport clamps at either edge and short views scroll below the owner without hiding valid choices',()=>{
 const f=setup({mobile:true,viewport:{left:100,top:80,width:300,height:180},rects:{sp:{left:102,top:84,width:30,height:24},ft:{left:368,top:84,width:30,height:24}}});try{
  let popup=f.open('sp');assert.equal(popup.style.left,'104px');assert.equal(popup.style.top,'110px');assert.equal(popup.style.maxHeight,'146px');
  popup=f.open('ft');assert.equal(popup.style.left,'246px');assert.equal(popup.style.top,'110px');assert.equal(popup.style.maxHeight,'146px');assert.equal(popup.querySelectorAll('[data-value]').length,21);
  f.setViewport({width:200});assert.equal(popup.style.left,'146px');assert.equal(popup.style.getPropertyValue('--transport-popup-width'),'150px');
  assert.equal(popup.querySelector('.may-delay-diamond').children.length,21);
  f.setViewport({left:200,width:500,height:400});assert.equal(popup.style.left,'308px');assert.equal(popup.style.top,'110px');
 }finally{f.close();}
});
test('diamond list CSS keeps each seconds label inside a rhombus and supports horizontal overflow on narrow viewports',()=>{
 const css=fs.readFileSync(__dirname+'/mayatnik-menu.css','utf8');
 assert.match(css,/\.may-speed-diamond\{[^}]*clip-path:polygon\(50% 0,100% 50%,50% 100%,0 50%\)/);
 assert.match(css,/\.may-delay-diamond\{width:150px;height:120px\}/);
 assert.match(css,/\.may-speed-diamond\.may-delay-diamond>\.may-transport-option\{font-size:7px\}/);
 assert.match(css,/may-speed-options\{[^}]*overflow-x:auto!important/);
});

test('side arrows are closed rotated squares meeting the wide centre while its total footprint remains 80 by 24',()=>{const f=setup();try{for(const key of ['sp','ft']){const box=f.doc.querySelector('[data-k="'+key+'"]'),style=f.w.getComputedStyle(box),surface=box.querySelector('.may-transport-surface');assert.equal(style.width,'80px');assert.equal(style.height,'24px');assert.equal(f.w.getComputedStyle(surface).gap,'0px');assert.equal(f.w.getComputedStyle(surface).justifyContent,'center');const centre=box.querySelector('.may-transport-center .may-transport-outline');assert.equal(centre.getAttribute('viewBox'),'0 0 40 24');for(const node of box.querySelectorAll('.may-transport-nudge .may-transport-outline')){assert.equal(node.getAttribute('viewBox'),'0 0 18 24');const path=node.firstElementChild.getAttribute('d');assert.ok(path.endsWith('Z'));const xy=path.match(/-?\d+(?:\.\d+)?/g).map(Number),points=[];for(let i=0;i<xy.length;i+=2)points.push([xy[i],xy[i+1]]);assert.equal(points.length,4);const distances=points.map((p,i)=>Math.hypot(p[0]-points[(i+1)%4][0],p[1]-points[(i+1)%4][1]));assert.ok(distances.every(d=>Math.abs(d-distances[0])<1e-9));assert.deepEqual(points[1],[18,12]);assert.deepEqual(points[3],[0,12]);}const original=f.doc.getElementById(key==='sp'?'speed':'frameT'),before=Number(original.value);box.querySelector('[data-direction="1"]').click();assert.equal(Number(original.value),before+1);}}finally{f.close();}});

test('all speeds remain selectable with one at the top, even values right and odd values left',()=>{
 const f=setup();try{const popup=f.open('sp'),nodes=[...popup.querySelectorAll('[data-value]')],one=popup.querySelector('[data-value="1"]');
 assert.equal(nodes.length,64);assert.equal(one.style.left,'120px');assert.equal(one.style.top,'0px');
 for(const b of nodes){const value=Number(b.dataset.value),x=parseInt(b.style.left),y=parseInt(b.style.top);if(value>1)assert.ok(value%2?x<120:x>120);
  for(const [vx,vy]of [[x+15,y],[x+30,y+12],[x+15,y+24],[x,y+12]])assert.ok(Math.abs(vx-135)/135+Math.abs(vy-108)/108<=1+1e-9);
 }
 for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const dx=Math.abs(parseInt(nodes[i].style.left)-parseInt(nodes[j].style.left)),dy=Math.abs(parseInt(nodes[i].style.top)-parseInt(nodes[j].style.top));assert.ok(dx/30+dy/24>=1-1e-9);}
 popup.querySelector('[data-value="3"]').click();assert.equal(f.doc.getElementById('speed').value,'3');f.open('sp');assert.equal(f.doc.querySelector('[aria-checked="true"]').dataset.value,'3');f.button('sp').click();assert.equal(f.doc.getElementById('speed').value,'4');
 const input=f.doc.getElementById('speed');input.value='64';input.dispatchEvent(new f.w.Event('input'));f.button('sp').click();assert.equal(input.value,'1');
 }finally{f.close();}
});

test('compact delay choices preserve an odd stored tick and the fine arrow step',()=>{
 const f=setup();try{const input=f.doc.getElementById('frameT');input.value='17';input.dispatchEvent(new f.w.Event('input'));const popup=f.open('ft');assert.equal(input.value,'17');assert.equal(popup.querySelector('[aria-checked="true"]'),null);
 f.doc.querySelector('[data-k="ft"] [data-direction="1"]').click();assert.equal(input.value,'18');
 f.doc.querySelector('[data-k="ft"] [data-direction="-1"]').click();assert.equal(input.value,'17');
 f.button('ft').click();assert.equal(input.value,'18');assert.equal(popup.querySelector('[aria-checked="true"]').dataset.value,'18');
 }finally{f.close();}
});
