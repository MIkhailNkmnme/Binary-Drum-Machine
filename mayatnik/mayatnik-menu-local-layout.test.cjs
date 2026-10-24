const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,n),'utf8'),menu=read('mayatnik-menu.js'),standard=read('mayatnik-button-standard.js');
class Classes{constructor(...x){this.s=new Set(x)}add(...x){x.forEach(y=>this.s.add(y))}remove(...x){x.forEach(y=>this.s.delete(y))}contains(x){return this.s.has(x)}toggle(x,v){v?this.add(x):this.remove(x)}}
test('actual popup owner switches and closes without changing covered nodes',()=>{
 const a={classList:new Classes()},b={classList:new Classes()},under={classList:new Classes(),inert:false,style:{visibility:'visible'}};
 const document={querySelectorAll:()=>[a,b].filter(x=>x.classList.contains('may-popup-owner'))};
 const code=menu.slice(menu.indexOf('  function popupOwner('),menu.indexOf('  const clearListUnder'));
 const ctx={document};vm.createContext(ctx);vm.runInContext(code,ctx);
 for(let i=0;i<5;i++)ctx.popupOwner(a);assert.ok(a.classList.contains('may-popup-owner'));
 ctx.popupOwner(b);assert.ok(!a.classList.contains('may-popup-owner'));assert.ok(b.classList.contains('may-popup-owner'));
 ctx.popupOwner(null);assert.ok(!b.classList.contains('may-popup-owner'));assert.equal(under.inert,false);assert.equal(under.style.visibility,'visible');
});
test('real mini glyph recognizes mask/background/text and rejects empty placeholders',()=>{
 const code=standard.slice(standard.indexOf('  function miniGlyph('),standard.indexOf('  function compactControl('));
 function run(icon){const glyph={textContent:''},b={classList:new Classes(),childNodes:[],querySelector:()=>glyph,querySelectorAll:()=>[icon],getAttribute:()=> 'Библиотека',title:''};
 vm.runInNewContext(code+';miniGlyph(b)',{b,getComputedStyle:i=>i.style});return b;}
 for(const style of [{backgroundImage:'url(icon)'},{maskImage:'url(icon)'},{webkitMaskImage:'url(icon)'}])assert.ok(run({style,textContent:'',querySelector:()=>null}).classList.contains('may-mini-has-icon'));
 assert.ok(run({style:{},textContent:'▶',querySelector:()=>null}).classList.contains('may-mini-has-icon'));
 const b=run({style:{backgroundImage:'none',maskImage:'none'},textContent:'',querySelector:()=>null});assert.ok(!b.classList.contains('may-mini-has-icon'));assert.equal(b.querySelector().textContent,'Б');
});
test('library offsets override actual grozd inline coordinates; rows remain in flow',()=>{
 const css=read('mayatnik-menu.css'),rule=css.match(/\.pt-lib \.pt-r>\.gz-hx\{([^}]*left:auto!important[^}]*)\}/)[1];
 // Inline normal wins ordinary CSS, but the local important reset must beat both honeycomb columns.
 const declarations=Object.fromEntries(rule.split(';').map(x=>x.split(':').map(x=>x.trim())).filter(x=>x.length===2));
 for(const key of ['left','top','right','bottom'])assert.equal(declarations[key],'auto!important');
 assert.match(menu,/row\.append\(\.\.\.lib\.querySelectorAll\('\.gz-soty > \.gz-hx'\)/);
});
test('popup layering leaves overlap disabling inactive and supplies opaque hit surface',()=>{
 const overlap=menu.slice(menu.indexOf('  function syncGroupOverlap()'),menu.indexOf('  const scheduleGroups'));
 assert.ok(overlap.indexOf('return;')<overlap.indexOf('const groups ='));
 const callback=menu.slice(menu.indexOf('  const hideListUnder'),menu.indexOf('  for (const b of document.querySelectorAll(\'.gz-lst\')'));
 assert.ok(!/want\.add|may-list-dim|inert\s*=|append\(/.test(callback));
 const css=read('mayatnik-menu.css');assert.match(css,/may-popup-owner\{z-index:1000!important/);assert.match(css,/\.gz-ladder\{background:#0e1116!important;pointer-events:auto!important/);
 const miniCss=read('mayatnik-button-standard.css');assert.match(miniCss,/may-mini-has-icon>[^\n]*font-size:13px!important/);assert.ok(!miniCss.includes(':has(>i,>.gz-ic)'));
 // The more specific standard rule must also be opaque; a body-only rule loses to its ID branch.
 assert.match(miniCss,/\.gz-ladder\.may-standard-list\{[^}]*background:#0e1116!important/);
 // Native groups lose .pt-grid at the mobile breakpoint, but still own their popup.
 assert.match(css,/:is\(#paintTools>\.pt-g,#paintTools>\.gz-group,\.gz-group,\.may-hp-pop\)\.may-popup-owner\{z-index:1000!important/);
 // The generic label-hiding selector has greater specificity than the icon's visible rule.
 // Exclude icon nodes from it so a real image/text icon cannot stay invisible in a rhombus.
 assert.match(miniCss,/\.may-control-mini>:not\(svg\):not\(i\):not\(\.gz-ic\)[^{]*\{visibility:hidden!important\}/);
 assert.match(miniCss,/\.may-control-mini :is\(\.gz-half,\.palette-half\)>:not\(i\):not\(\.gz-ic\)/);
 assert.match(miniCss,/\.may-control-mini :is\(\.gz-half,\.palette-half\)\.may-mini-has-icon>\.may-mini-glyph\{display:none!important\}/);
});
test('actual placement refresh is stable, keeps popup nodes/handlers and releases owner on close',()=>{
 const rect={left:20,right:140,top:50,bottom:74,width:120,height:24},group={classList:new Classes()},column={getBoundingClientRect:()=>rect};
 const owner={closest:s=>s.startsWith('.pt-g')?group:column,getBoundingClientRect:()=>rect};
 const pick=()=>42,option={onclick:()=>pick()},list={style:{setProperty(k,v){this[k]=v}},querySelectorAll:()=>[option],parentElement:group};
 let schedules=0;const document={querySelectorAll:s=>s==='.may-popup-owner'&&group.classList.contains('may-popup-owner')?[group]:[]};
 const a=menu.indexOf('  let activeList=null;'),b=menu.indexOf('  for (const b of document.querySelectorAll(\'.gz-lst\')',a);
 const context={document,innerHeight:600,innerWidth:800,scheduleGroups:()=>schedules++,list,owner};vm.createContext(context);
 vm.runInContext(menu.slice(a,b)+';globalThis.place=hideListUnder;globalThis.close=clearListUnder;',context);
 context.place(list,owner);const before=JSON.stringify(list.style);for(let i=0;i<5;i++)context.place(list,owner);
 assert.equal(JSON.stringify(list.style),before);assert.equal(list.parentElement,group);assert.equal(option.onclick(),42);assert.ok(group.classList.contains('may-popup-owner'));
 context.close();assert.ok(!group.classList.contains('may-popup-owner'));assert.equal(schedules,7);
});
