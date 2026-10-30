const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Search=require('./mayatnik-button-search.js');
const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const read=n=>fs.readFileSync(__dirname+'/'+n,'utf8'),menuSource=read('mayatnik-menu.js');
function boot(late=true){
 const dom=new JSDOM('<header><div id="paintTools"><div class="pt-g" data-k="Вид"><button class="pt-l">Вид</button><div class="pt-r"><div class="pt-colv"></div></div></div><div id="mayCorner"><button id="mayAbout">old info</button><button id="mayHelp" aria-pressed="false">old help</button></div></div></header><dialog id="mayAboutDialog"></dialog>',{url:'http://test/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,doc=w.document,view=doc.querySelector('.pt-r'),about=doc.getElementById('mayAbout'),help=doc.getElementById('mayHelp');
 let opens=0,toggles=0;about.onclick=()=>opens++;help.onclick=()=>{toggles++;help.setAttribute('aria-pressed',String(help.getAttribute('aria-pressed')!=='true'));};
 w.eval(menuSource.slice(menuSource.indexOf('  function mountViewUtilities('),menuSource.indexOf('  mountViewUtilities(gView);'))+'window.mountUtilities=mountViewUtilities;');
 let api;if(!late)api=Search.create({document:doc,window:w});const row=w.mountUtilities(view);if(late)api=Search.create({document:doc,window:w});const launch=doc.getElementById('mayButtonSearchTrigger');w.mountUtilities(view);
 for(const name of ['mayatnik-button-standard.css','mayatnik-button-search.css','mayatnik-menu.css']){const style=doc.createElement('style');style.textContent=read(name);doc.head.append(style);}doc.body.classList.add('mayatnik-menu-ready');
 return{dom,w,doc,view,row,about,help,launch,api,get opens(){return opens;},get toggles(){return toggles;}};
}
test('early and late search use the same three original native buttons in View without duplicate handlers',()=>{
 for(const late of [false,true]){const a=boot(late);try{
  assert.equal(a.row.parentElement,a.view.querySelector('.pt-colv'));assert.deepEqual([...a.row.children].map(n=>n.id),['mayButtonSearchTrigger','mayAbout','mayHelp']);assert.equal(a.row.children[0],a.launch);assert.equal(a.row.children[1],a.about);assert.equal(a.row.children[2],a.help);assert.equal(a.doc.querySelectorAll('#mayInfoDiamond').length,1);
  for(let n=0;n<4;n++)a.w.mountUtilities(a.view);assert.equal(a.row.children.length,3);for(const b of a.row.children){assert.equal(b.tagName,'BUTTON');assert.equal(b.tabIndex,0);assert.equal(b.title,b.getAttribute('aria-label'));assert.ok(b.title);assert.equal(a.doc.querySelectorAll('#'+b.id).length,1);}
  a.about.click();assert.equal(a.opens,1);a.help.click();assert.equal(a.toggles,1);assert.equal(a.help.getAttribute('aria-pressed'),'true');a.about.click();assert.equal(a.help.getAttribute('aria-pressed'),'true');assert.equal(a.opens,2);
  a.launch.focus();a.launch.click();assert.equal(a.api.getState().open,true);assert.equal(a.launch.getAttribute('aria-expanded'),'true');assert.equal(a.doc.activeElement.type,'search');assert.equal(a.help.getAttribute('aria-pressed'),'true');a.doc.activeElement.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(a.api.getState().open,false);assert.equal(a.doc.activeElement,a.launch);
  a.w.dispatchEvent(new a.w.Event('resize'));assert.equal(a.launch.style.left,'');assert.equal(a.launch.style.top,'');
 }finally{a.api.destroy();a.dom.window.close();}}
});
test('three equal 40px parts retain the 120px standard on desktop and inside the mobile strip',()=>{
 const a=boot();try{for(const mobile of [false,true,false]){a.doc.body.classList.toggle('may-mobile-menu',mobile);let bar=a.doc.getElementById('mayMobileBar');if(mobile){bar=a.doc.createElement('div');bar.id='mayMobileBar';a.doc.querySelector('header').append(bar);bar.append(a.doc.getElementById('paintTools'));}else if(bar){a.doc.querySelector('header').append(a.doc.getElementById('paintTools'));bar.remove();}
  assert.equal(a.w.getComputedStyle(a.row).width,'120px');assert.equal(a.w.getComputedStyle(a.row).height,'24px');for(const b of a.row.children){const s=a.w.getComputedStyle(b);assert.equal(s.width,'40px');assert.equal(s.height,'24px');assert.equal(s.position,'relative');assert.equal(s.backgroundColor,'rgba(0, 0, 0, 0)');}assert.equal(a.launch.parentElement,a.row);a.w.dispatchEvent(new a.w.Event('resize'));assert.equal(a.launch.style.left,'');
  }const collector=menuSource.slice(menuSource.indexOf('  const collectLateMenu='),menuSource.indexOf('  window.mayMobileMenu='));assert.match(collector,/mountViewUtilities\(gView\)/);assert.doesNotMatch(collector,/mobileMenu\.add\(\[\$\('mayButtonSearchTrigger'\)/);
 }finally{a.api.destroy();a.dom.window.close();}
});
