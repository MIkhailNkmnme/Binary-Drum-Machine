const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let JSDOM;try{({JSDOM}=require('jsdom'));}catch(_){({JSDOM}=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom'));}
const source=fs.readFileSync(path.join(__dirname,'mayatnik-menu.js'),'utf8');
const installer=source.slice(source.indexOf('  function installParityMenu(parent){'),source.indexOf('  installParityMenu(gView);'));
function setup(initial={}){
  const dom=new JSDOM('<!doctype html><div class="pt-g"><div class="pt-r" id="view"></div></div>',{url:'https://example.test/',runScripts:'outside-only'}),w=dom.window,d=w.document,calls=[];
  const state={rowsEven:true,rowsOdd:true,cellsEven:true,cellsOdd:true,colsEven:true,colsOdd:true,rowLevels:[],cellLevels:[],colLevels:[],rowFill:'none',...initial};
  const key=axis=>({rows:'rowLevels',cells:'cellLevels',cols:'colLevels'})[axis];
  w.mayParity={get:()=>structuredClone(state),set(k,v){calls.push(['set',k,v]);state[k]=v;},setLevel(axis,index,k,v){calls.push(['level',axis,index,k,v]);state[key(axis)][index-1][k]=v;},addLevel(axis){calls.push(['add',axis]);state[key(axis)].push({even:true,odd:true});},removeLevel(axis,index){calls.push(['remove',axis,index]);state[key(axis)].splice(index-1,1);},cycle(axis,index=0){calls.push(['cycle',axis,index]);}};
  w.HTMLElement.prototype.getClientRects=function(){return [this.getBoundingClientRect()];};
  w.HTMLElement.prototype.getBoundingClientRect=function(){return {left:10,right:130,top:20,bottom:44,width:120,height:24};};
  w.eval(fs.readFileSync(path.join(__dirname,'../_js/grozd.js'),'utf8'));
  w.eval('var toolSync=[],rail={refresh(){toolSync.forEach(fn=>fn());}},placeTools=()=>{};'+installer+';installParityMenu(document.getElementById("view"));');
  const button=id=>d.querySelector('[data-n="'+id+'"]'),list=()=>d.querySelector('.gz-ladder'),action=id=>list()?.querySelector('[data-parity-action="'+id+'"]');
  return {w,d,dom,state,calls,button,list,action,sync:()=>w.eval('toolSync.forEach(fn=>fn())'),close:()=>w.close()};
}
test('three independent standard parity pairs forward exact keys and reflect restored values',()=>{
  const e=setup({colsOdd:false,rowsEven:false});try{
    for(const [id,keys]of [['parityCells',['cellsEven','cellsOdd']],['parityRows',['rowsEven','rowsOdd']],['parityCols',['colsEven','colsOdd']]]){
      const pair=e.button(id),parts=pair.querySelectorAll('.gz-half');assert.ok(pair.matches('.gz-hx.gz-pair.gz-split'));assert.equal(pair.getAttribute('role'),'group');assert.equal(pair.dataset.mayStandardKey,'1');
      for(const [i,part]of [...parts].entries()){const before=e.state[keys[i]],other=e.state[keys[1-i]];assert.equal(part.getAttribute('aria-pressed'),String(before));part.click();assert.deepEqual(e.calls.at(-1),['set',keys[i],!before]);assert.equal(e.state[keys[1-i]],other);assert.equal(part.getAttribute('aria-pressed'),String(!before));assert.match(part.title,/Исходные биты неизменны/);assert.equal(part.type,'button');}
    }
    assert.equal(e.calls.length,6);
  }finally{e.close();}
});
test('row fill cycles none/above/below/none with edge fallback help and no local settings',()=>{
  const e=setup();try{const b=e.button('parityRowFill');assert.equal(e.calls.length,0);assert.equal(e.state.rowFill,'none');
    for(const expected of ['above','below','none']){b.click();assert.deepEqual(e.calls.at(-1),['set','rowFill',expected]);assert.equal(b.getAttribute('aria-pressed'),String(expected!=='none'));}
    assert.match(b.title,/противоположной стороны/);assert.match(b.getAttribute('aria-label'),/Исходные биты неизменны/);
    e.state.rowFill='below';e.sync();assert.match(b.textContent,/снизу/);
  }finally{e.close();}
});
test('live shared hover ladder adds, independently edits and removes nested levels without reopening',()=>{
  const e=setup();try{const owner=e.button('parityRowsLevels');owner.click();const list=e.list();assert.ok(list);assert.equal(owner.getAttribute('aria-expanded'),'true');
    const add=e.action('add');add.focus();add.click();assert.equal(e.list(),list);assert.equal(list.querySelectorAll(':scope > .gz-hx').length,3);assert.equal(e.d.activeElement,e.action('add'));
    e.action('add').click();assert.equal(list.querySelectorAll(':scope > .gz-hx').length,5);assert.equal(e.state.rowLevels.length,2);assert.ok(e.state.rowLevels.every(v=>v.even&&v.odd));
    const even=e.action('level-2-0');even.focus();even.click();assert.deepEqual(e.calls.at(-1),['level','rows',2,'even',false]);assert.equal(e.d.activeElement,even);assert.equal(e.action('level-2-1').getAttribute('aria-pressed'),'true');assert.equal(e.state.rowsEven,true);
    e.action('remove-2').focus();e.action('remove-2').click();assert.deepEqual(e.calls.at(-1),['remove','rows',2]);assert.equal(e.list(),list);assert.equal(list.querySelectorAll(':scope > .gz-hx').length,3);assert.equal(e.d.activeElement,e.action('add'));
    e.state.rowLevels.push({even:false,odd:true});e.sync();assert.equal(list.querySelectorAll(':scope > .gz-hx').length,5);assert.equal(e.action('level-2-0').getAttribute('aria-pressed'),'false');
    assert.match(owner.title,/только оставшиеся/);assert.ok(!list.querySelector('[data-parity-action="remove-0"]'));
  }finally{e.close();}
});
test('cell levels use their own axis; ArrowDown opens and focuses the first native action',()=>{
  const e=setup({cellLevels:[{even:false,odd:true}],rowLevels:[{even:true,odd:false}]});try{
    const owner=e.button('parityCellsLevels');owner.dispatchEvent(new e.w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));
    assert.ok(e.list());assert.equal(e.d.activeElement,e.action('add'));assert.equal(e.action('level-1-0').getAttribute('aria-pressed'),'false');e.action('level-1-0').click();assert.deepEqual(e.calls.at(-1),['level','cells',1,'even',true]);assert.equal(e.state.rowLevels[0].odd,false);
    e.action('remove-1').click();assert.equal(e.state.cellLevels.length,0);assert.equal(e.state.rowLevels.length,1);
    e.button('parityRowsLevels').click();assert.equal(owner.getAttribute('aria-expanded'),'false');
  }finally{e.close();}
});
test('nested controls retain local dynamic rendering through the native portal adapter',()=>{
  assert.match(source,/placed:\(list,owner\)=>\{placed\?\.\(list,owner\);hideListUnder\(list,owner\);\}/);
  assert.match(source,/if\(!\/\^parity\(\?:Rows\|Cells\)Levels\$\/.test\(owner.dataset.n\)\)window.MayatnikMenuOptions.decorate/);
  for(const id of ['parityCols','parityRowFill','parityRowsLevels','parityCellsLevels'])assert.ok(source.slice(source.indexOf('const VIEW_COLS')).includes("'"+id+"'"));
});
test('half inversion keeps its semantic name, ID and original checkbox action',()=>{
  const line=source.split('\n').find(s=>s.includes('const name = e =>'));
  const expression=line.slice(line.indexOf('e =>'),line.indexOf(';'));
  const name=Function('ZerkMenuIcons','return ('+expression+');')({shortOf:()=> 'Действие'});
  assert.equal(name({id:'ochkiHalf'}),'Полуинверсия');assert.notEqual(name({id:'ochkiHalf'}),'Действие');assert.match(source,/check\('ochkiHalf', 'half'\)/);
});
test('central diamonds forward one atomic cycle per base/nested axis and preserve independent halves',()=>{
  const e=setup({rowLevels:[{even:true,odd:false}],cellLevels:[{even:false,odd:true}]});try{
    for(const [id,axis]of [['parityRows','rows'],['parityCells','cells'],['parityCols','cols']]){
      const cycle=e.button(id).querySelector('.may-parity-cycle'),before=e.calls.length;cycle.click();assert.equal(e.calls.length,before+1);assert.deepEqual(e.calls.at(-1),['cycle',axis,0]);assert.equal(cycle.type,'button');assert.match(cycle.title,/только чётные → только нечётные/);assert.match(cycle.getAttribute('aria-label'),/первое нажатие оставляет только чётные/);assert.equal(e.button(id).querySelectorAll('.gz-half').length,2);
    }
    for(const [id,axis]of [['parityRowsLevels','rows'],['parityCellsLevels','cells']]){e.button(id).click();const cycle=e.action('cycle-'+axis+'-1'),before=e.calls.length;cycle.click();assert.equal(e.calls.length,before+1);assert.deepEqual(e.calls.at(-1),['cycle',axis,1]);}
    const css=fs.readFileSync(path.join(__dirname,'mayatnik-menu.css'),'utf8');assert.match(css,/\.may-parity-cycle\{[^}]*position:absolute;left:50%;[^}]*width:18px;[^}]*height:24px/);
    for(const [half,direction]of [['0','right'],['1','left']])assert.match(css,new RegExp(':is\\(body\\.mayatnik-menu-ready,#paintTools\\) \\.may-standard\\.may-standard\\.may-parity-pair\\.may-independent-selector>\\.gz-h'+half+'\\{padding-'+direction+':10px!important'));
  }finally{e.close();}
});
test('central diamond text reservations outrank later common important padding rules',()=>{
  let Specificity;try{Specificity=require('@bramus/specificity').default;}catch(_){Specificity=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/@bramus/specificity/dist/index.cjs').default;}
  const css=fs.readFileSync(path.join(__dirname,'mayatnik-menu.css'),'utf8'),standard=fs.readFileSync(path.join(__dirname,'mayatnik-button-standard.css'),'utf8'),e=setup();
  try{e.d.body.classList.add('mayatnik-menu-ready');const pair=e.button('parityRows');pair.classList.add('may-standard','may-standard-pair');
    for(const [half,direction]of [['0','right'],['1','left']]){
      const part=pair.querySelector('.gz-h'+half),own=css.match(new RegExp('([^{}\\n]+>\\.gz-h'+half+')\\{padding-'+direction+':10px!important\\}'))[1].trim(),[weight]=Specificity.calculate(own);let compared=0;
      assert.ok(part.matches(own));
      for(const [,selector,declarations]of standard.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
        if(!new RegExp('(?:^|;)padding(?:-'+direction+')?:[^;]*!important').test(declarations))continue;
        let matches=false;try{matches=part.matches(selector.trim());}catch(_){}if(!matches)continue;
        for(const other of Specificity.calculate(selector.trim())){assert.ok(weight.isGreaterThan(other),own+' must beat '+selector);compared++;}
      }
      assert.ok(compared>=2,'checked real common pair and segment padding rules');
    }
  }finally{e.close();}
});
