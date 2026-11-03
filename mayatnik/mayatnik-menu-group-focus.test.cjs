const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const Focus=require('../_js/menu-group-focus.js');
function geometry(){
 const dom=new JSDOM('<body><div class="pt-g pt-open" id="g"><div class="pt-l"></div><div class="pt-r"><button class="gz-hx"></button><svg class="may-standard-contours"><polygon points="12,-12 108,-12 120,0 122,12 120,24 108,36 12,36 0,24 -2,12 0,0"/></svg></div></div><div class="gz-group gz-open" id="other"><button class="gz-head"></button></div><canvas></canvas></body>'),d=dom.window.document,g=d.getElementById('g'),other=d.getElementById('other');
 const rect=(node,left,top,width,height)=>node.getBoundingClientRect=()=>({left,top,width,height,right:left+width,bottom:top+height});
 rect(g.querySelector('.pt-l'),110,160,120,24);rect(g.querySelector('.pt-r'),100,100,140,50);rect(g.querySelector('button'),110,100,120,24);rect(other.querySelector('button'),300,100,120,24);
 g.querySelector('svg').getScreenCTM=()=>({inverse:()=>({a:.5,b:0,c:0,d:.5,e:-50,f:-50})});
 return {dom,d,g,other,rect,groups:[g,other]};
}
test('outline hits transformed toothed polygon and cap, not its rectangular corner or unrelated far gaps',()=>{
 const f=geometry();try{
  assert.equal(Focus.outlineOwner(f.groups,200,80),f.g); // top cap, 2x screen transform
  assert.equal(Focus.outlineOwner(f.groups,99,124),f.g); // left tooth extends outside rows
  assert.equal(Focus.outlineOwner(f.groups,99,80),null); // outside sloping cap
  assert.equal(Focus.outlineOwner(f.groups,400,160),null);
  f.g.setAttribute('data-library-folded','');assert.equal(Focus.outlineOwner(f.groups,200,80),null);f.g.removeAttribute('data-library-folded');
  f.g.classList.remove('pt-open');assert.equal(Focus.outlineOwner(f.groups,200,80),null);
 }finally{f.dom.window.close();}
});
test('header bridge only spans nearest visible row, shared x and at most 24 vertical pixels',()=>{
 const f=geometry();try{
  f.g.querySelector('svg').remove();const head=f.g.querySelector('.pt-l'),row=f.g.querySelector('button');
  f.rect(head,110,140,120,24); // upward menu: 16px gap
  assert.equal(Focus.outlineOwner(f.groups,120,130),f.g);assert.equal(Focus.outlineOwner(f.groups,109,130),null);
  f.rect(head,110,149,120,24);assert.equal(Focus.outlineOwner(f.groups,120,130),null);
  f.rect(head,110,60,120,24);assert.equal(Focus.outlineOwner(f.groups,120,90),f.g); // downward menu
  row.style.display='none';assert.equal(Focus.outlineOwner(f.groups,120,90),null);
 }finally{f.dom.window.close();}
});
test('point fallback retains focus over canvas decoration, clears on same-target movement and yields to DOM controls',()=>{
 const f=geometry(),w=f.dom.window,canvas=f.d.querySelector('canvas'),changes=[];
 const api=Focus.mount({document:f.d,groups:()=>f.groups,ownerOf:target=>target.closest('.pt-g,.gz-group'),ownerAtPoint:(event,current)=>Focus.outlineOwner(f.groups,event.clientX,event.clientY,current),onChange:g=>changes.push(g?.id||null)});
 const fire=(type,target,x,y,relatedTarget=null,pointerType='mouse')=>{const e=new w.MouseEvent(type,{bubbles:true,clientX:x,clientY:y,relatedTarget,cancelable:true});Object.defineProperty(e,'pointerType',{value:pointerType});target.dispatchEvent(e);return e;};
 try{
  fire('pointerover',f.g.querySelector('button'),120,110);fire('pointerout',f.g.querySelector('button'),200,80,canvas);assert.equal(api.active(),f.g);
  fire('pointermove',canvas,200,80);assert.deepEqual(changes,['g']);fire('pointermove',canvas,500,500);assert.equal(api.active(),null);
  fire('pointermove',canvas,200,80,null,'touch');assert.equal(api.active(),null);
  fire('pointermove',canvas,200,80);assert.equal(api.active(),f.g);
  fire('pointerover',f.other.querySelector('button'),200,80);assert.equal(api.active(),f.other);
  assert.equal(fire('click',canvas,200,80).defaultPrevented,false);assert.equal(fire('wheel',canvas,200,80).defaultPrevented,false);
  w.dispatchEvent(new w.Event('blur'));assert.equal(api.active(),null);api.destroy();fire('pointermove',canvas,200,80);assert.equal(api.active(),null);
 }finally{api.destroy();f.dom.window.close();}
});
function setup(){const dom=new JSDOM('<body><header style="position:relative;z-index:10"><div id="tools"><div class="pt-g" id="a"><div class="pt-l">A</div><div class="pt-r" style="position:fixed;left:50px"><button class="gz-hx gz-pair"><span class="gz-hx" id="inner">Part</span></button></div></div></div></header><aside style="position:relative;z-index:8"><div class="gz-group" id="b"><button class="gz-head" style="filter:grayscale(0.2)">B</button><div class="may-rail-list" style="position:fixed;left:200px"><button class="gz-hx">Option</button></div></div></aside><div class="pt-g pt-btn" id="transport"></div><div id="portal"><button>Popup option</button></div></body>'),w=dom.window,d=w.document,all=[d.getElementById('a'),d.getElementById('b'),d.getElementById('transport')],changes=[];
 const api=Focus.mount({document:d,groups:()=>all,ownerOf:el=>d.getElementById('portal').contains(el)?all[0]:el.closest('.pt-g,.gz-group'),onChange:g=>changes.push(g?.id||null)});
 const fire=(type,target,relatedTarget=null,pointerType='mouse')=>{const e=new w.MouseEvent(type,{bubbles:true,relatedTarget});Object.defineProperty(e,'pointerType',{value:pointerType});target.dispatchEvent(e);};return{dom,w,d,all,api,changes,fire};}
test('hover lifts whole branch across rail/header stacks without dimming peers',()=>{const a=setup();try{a.fire('pointerover',a.all[1].querySelector('button'));assert.equal(a.api.active(),a.all[1]);for(const el of [a.all[1],a.all[1].parentElement])assert.equal(el.style.getPropertyValue('z-index'),'2147483642');assert.equal(a.all[0].querySelector('.pt-l').style.filter,'');assert.equal(a.all[0].querySelector('.gz-pair').style.filter,'');assert.equal(a.d.getElementById('inner').style.filter,'');assert.equal(a.all[1].querySelector('.gz-head').style.filter,'grayscale(0.2)');assert.equal(a.all[0].style.filter,'');assert.equal(a.all[0].querySelector('.pt-r').style.filter,'');assert.equal(a.all[0].querySelector('.pt-r').style.left,'50px');assert.equal(a.all[0].querySelector('.pt-r').style.position,'fixed');assert.equal(a.all[0].style.opacity,'');}finally{a.api.destroy();a.dom.window.close();}});
test('moving across controls switches stacking while preserving peer filters',()=>{const a=setup();try{a.fire('pointerover',a.all[0]);a.fire('pointerover',a.all[0].querySelector('button'));assert.deepEqual(a.changes,['a']);assert.equal(a.all[1].querySelector('.gz-head').style.filter,'grayscale(0.2)');a.fire('pointerout',a.all[0],a.all[1]);assert.deepEqual(a.changes,['a','b']);assert.equal(a.all[1].querySelector('.gz-head').style.filter,'grayscale(0.2)');assert.equal(a.d.querySelector('header').style.zIndex,'10');assert.equal(a.all[0].querySelector('.pt-l').style.filter,'');}finally{a.api.destroy();a.dom.window.close();}});
test('popup portal retains owner focus; leaving for field restores every inline style and order',()=>{const a=setup(),before=a.d.body.innerHTML;try{const portal=a.d.getElementById('portal').firstElementChild;a.fire('pointerover',a.all[0]);a.fire('pointerout',a.all[0],portal);a.fire('pointerover',portal);assert.deepEqual(a.changes,['a']);a.fire('pointerout',portal,a.d.body);assert.equal(a.api.active(),null);assert.equal(a.all[1].querySelector('.gz-head').style.filter,'grayscale(0.2)');assert.equal(a.d.querySelector('header').style.zIndex,'10');assert.equal(a.all[0].parentElement.id,'tools');assert.equal(a.d.body.children[0].tagName,'HEADER');assert.ok(!a.all[0].classList.contains('may-menu-hover-front'));}finally{a.api.destroy();a.dom.window.close();}});
test('touch does not latch hover; cancel and window blur clear active focus; disabled controls remain disabled',()=>{const a=setup();try{const button=a.all[1].querySelector('.gz-head');button.disabled=true;a.fire('pointerover',button,null,'touch');assert.equal(a.api.active(),null);a.fire('pointerover',button);assert.ok(a.api.active());a.w.dispatchEvent(new a.w.Event('blur'));assert.equal(a.api.active(),null);a.fire('pointerover',a.all[0]);a.fire('pointercancel',a.all[0]);assert.equal(a.api.active(),null);assert.equal(button.disabled,true);}finally{a.api.destroy();a.dom.window.close();}});
test('destroy removes listeners and does not overwrite a newer external style',()=>{const a=setup();a.fire('pointerover',a.all[0]);a.all[1].querySelector('.gz-head').style.setProperty('filter','sepia(1)','important');a.api.destroy();assert.equal(a.all[1].querySelector('.gz-head').style.filter,'sepia(1)');a.fire('pointerover',a.all[1]);assert.equal(a.api.active(),null);a.dom.window.close();});
test('host keeps old overlap shade out of the active hover state and maps detached option lists to owner',()=>{const code=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8');assert.match(code,/if\(groupHover\?\.active\(\)\)\{document\.querySelectorAll\('\.may-overlap-shade'\)\.forEach\(shade=>shade\.remove\(\)\);return;/);assert.match(code,/ownerOf:target=>activeList\?\.list\.contains\(target\)\?activeList\.group/);});
