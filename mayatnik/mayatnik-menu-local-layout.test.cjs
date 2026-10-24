const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,n),'utf8'),menu=read('mayatnik-menu.js'),standard=read('mayatnik-button-standard.js');
class Classes{constructor(...x){this.s=new Set(x)}add(...x){x.forEach(y=>this.s.add(y))}remove(...x){x.forEach(y=>this.s.delete(y))}contains(x){return this.s.has(x)}toggle(x,v){v?this.add(x):this.remove(x)}}
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
 assert.ok(!/want\.add|may-list-dim|inert\s*=/.test(callback));
 const css=read('mayatnik-menu.css');assert.ok(!css.includes('may-popup-owner'));assert.match(css,/\.gz-ladder\.may-popup-portal\{position:fixed!important;z-index:2147483645!important;background:#0e1116!important;pointer-events:auto!important/);
 const miniCss=read('mayatnik-button-standard.css');assert.match(miniCss,/may-mini-has-icon>[^\n]*font-size:13px!important/);assert.ok(!miniCss.includes(':has(>i,>.gz-ic)'));
 // The more specific standard rule must also be opaque; a body-only rule loses to its ID branch.
 assert.match(miniCss,/\.gz-ladder\.may-standard-list\{[^}]*background:#0e1116!important/);
 // The generic label-hiding selector has greater specificity than the icon's visible rule.
 // Exclude icon nodes from it so a real image/text icon cannot stay invisible in a rhombus.
 assert.match(miniCss,/\.may-control-mini>:not\(svg\):not\(i\):not\(\.gz-ic\)[^{]*\{visibility:hidden!important\}/);
 assert.match(miniCss,/\.may-control-mini :is\(\.gz-half,\.palette-half\)>:not\(i\):not\(\.gz-ic\)/);
 assert.match(miniCss,/\.may-control-mini :is\(\.gz-half,\.palette-half\)\.may-mini-has-icon>\.may-mini-glyph\{display:none!important\}/);
});
