const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const menu=fs.readFileSync(path.join(__dirname,'mayatnik-menu.js'),'utf8');
class El{
 constructor(cls=''){this.children=[];this.dataset={};this.events={};this.style={setProperty(k,v){this[k]=v}};this.s=new Set(cls.split(' '));this.classList={contains:x=>this.s.has(x),add:x=>this.s.add(x)};}
 set className(s){this.s=new Set(s.split(' '))}append(x){this.children.push(x)}prepend(x){this.children.unshift(x)}setAttribute(k,v){this[k]=v}getAttribute(k){return this[k]}addEventListener(k,f){this.events[k]=f}dispatchEvent(e){this.events[e.type]?.(e)}querySelector(){return new El()}querySelectorAll(s){return this.children.filter(x=>x.s.has(s.includes('gz-hx')?'gz-hx':'may-view-swatch'))}
}
test('actual mode palettes select first, edit only selected mode, reuse pickers and preserve six colour sources',()=>{
 const ids=['lgOverOne','lgOverZero','lgBitZero','lgBitOne','digitZeroColour','digitOneColour'],sources=Object.fromEntries(ids.map((id,i)=>[id,Object.assign(new El(),{id,value:'#'+String(i+1).repeat(6),title:id})]));sources.lg=new El();sources.view=Object.assign(new El(),{value:'bits',options:['col','bits','digits','digitsOnly'].map(value=>({value}))});
 let changes=0,opens=[],created=0;sources.view.events.change=()=>changes++;const oldDigits=new El();const ctx={$:id=>sources[id],document:{createElement:()=>new El()},tools:{querySelector:()=>oldDigits},picker:src=>{created++;return()=>opens.push(src.id)},rail:{refresh(){}},placeTools(){},Event:class{constructor(type){this.type=type}}};vm.createContext(ctx);
 const a=menu.indexOf('  const viewPaletteSources='),b=menu.indexOf('  let activeList=null;',a);vm.runInContext(menu.slice(a,b),ctx);
 const list=new El(),owner={dataset:{n:'viewCycle'}};for(let i=0;i<4;i++)list.append(new El('gz-hx'));ctx.decorateViewPalette(list,owner);ctx.decorateViewPalette(list,owner);
 assert.equal(created,6);assert.equal(sources.lg.style.display,'none');assert.equal(oldDigits.style.display,'none');for(const row of list.children)assert.equal(row.querySelectorAll('.may-view-swatch').length,2);
 const click=dot=>dot.events.click({stopPropagation(){}}),col=list.children[0].querySelectorAll('.may-view-swatch');click(col[1]);assert.equal(sources.view.value,'col');assert.equal(changes,1);assert.equal(opens.length,0);click(col[1]);assert.deepEqual(opens,['lgOverZero']);
 const digits=list.children[2].querySelectorAll('.may-view-swatch');click(digits[0]);assert.equal(sources.view.value,'digits');assert.equal(opens.length,1);click(digits[1]);assert.equal(opens.at(-1),'digitOneColour');
 const before=ids.map(id=>sources[id].value);assert.deepEqual(before,ids.map((id,i)=>'#'+String(i+1).repeat(6)));sources.lgOverOne.value='#abcdef';ctx.decorateViewPalette(list,owner);assert.equal(col[0].style.backgroundColor,'#abcdef');assert.equal(created,6);
});
test('captions use Съ with lowercase hard sign and retain uppercase words elsewhere',()=>{
 const a=menu.indexOf('  const shortCaption ='),b=menu.indexOf('  const captionSources=',a),c={};vm.createContext(c);vm.runInContext(menu.slice(a,b)+';globalThis.short=shortCaption;',c);assert.equal(c.short('С нуля'),'Съ нля');assert.equal(c.short('С засечками'),'Съ зсчкми');assert.equal(c.short('ЦЕНТР'),'ЦЕНТРЪ');assert.equal(c.short('Съ нля'),'Съ нля');
});

test('combined centre uses independent live toggles and both retained colour inputs',()=>{
 class Item{constructor(){this.children=[];this.dataset={};this.handlers={};const set=new Set();this.classList={add:(...x)=>x.forEach(v=>set.add(v)),remove:(...x)=>x.forEach(v=>set.delete(v)),toggle:(x,on)=>on?set.add(x):set.delete(x)};this.style={setProperty(k,v){this[k]=v}};}append(n){this.children.push(n)}replaceChildren(){this.children=[]}setAttribute(k,v){this[k]=v}addEventListener(k,f){this.handlers[k]=f}click(){this.handlers.click?.({target:this,stopPropagation(){}})}}
 const one=new Item(),zero=new Item(),sources={midOneOn:{checked:true,click(){this.checked=!this.checked}},midZeroOn:{checked:false,click(){this.checked=!this.checked}},midOneColour:{value:'#ff7f27'},midZeroColour:{value:'#4f9bff'}};let picks=[];const sync=[];
 const c={railSourceButtons:new Map([['midOneOn',one],['midZeroOn',zero]]),$:id=>sources[id],document:{createElement:()=>new Item()},picker:source=>()=>picks.push(source),toolSync:sync,rail:{refresh(){}},placeTools:()=>sync.forEach(f=>f())};vm.createContext(c);const a=menu.indexOf('  // One centre control;'),b=menu.indexOf('  // v0.441: варианты',a);vm.runInContext(menu.slice(a,b),c);c.placeTools();
 assert.equal(zero.style.display,'none');assert.deepEqual(one.children.map(n=>n.textContent),['','0','Центр','1','']);one.children[1].click();assert.equal(sources.midZeroOn.checked,true);assert.equal(sources.midOneOn.checked,true);one.children[2].click();assert.equal(sources.midZeroOn.checked,false);assert.equal(sources.midOneOn.checked,false);one.children[3].click();assert.equal(sources.midOneOn.checked,true);assert.equal(sources.midZeroOn.checked,false);one.children[0].click();one.children[4].click();assert.deepEqual(picks,[sources.midZeroColour,sources.midOneColour]);assert.equal(sources.midZeroColour.value,'#4f9bff');
});

test('short words retain at least one original vowel; explicit fold caption has a space',()=>{
 const a=menu.indexOf('  const shortCaption ='),b=menu.indexOf('  const captionSources=',a),c={};vm.createContext(c);vm.runInContext(menu.slice(a,b)+';globalThis.short=shortCaption;',c);
 for(const [full,short] of [['Загиб Верт','Згибъ Верт'],['Цвет','Цветъ'],['Шрифт','Шрифтъ'],['Вниз','Внизъ'],['Пуск','Пускъ'],['Повтор','Пвторъ'],['Ширина','Шрна'],['Заливка','Злвка'],['ЦЕНТР','ЦЕНТРЪ']]){assert.equal(c.short(full),short);assert.equal(c.short(short),short);}
 for(const word of ['Слой','Центр','Ряд','Загиб','Выбор','Шрифт','Вверх','Сброс','Вниз','Сохранить','Отменить','Верт'])assert.match(c.short(word),/[аеёиоуыэюя]/iu);
 assert.match(menu,/fixFoldV:'Загиб Верт'/);assert.match(menu,/fold\('Загиб Верт', 2/);
});
