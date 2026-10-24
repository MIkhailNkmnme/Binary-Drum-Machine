const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8');
test('segmented selectors choose the source option and follow changes made elsewhere',()=>{
 let changes=0;const e={value:'initial',options:[['initial','Начальная'],['ones','111…'],['zeros','000…'],['alternating','1010…']].map(([value,textContent])=>({value,textContent})),dispatchEvent(){changes++;}};
 const c={$:()=>e,tip:()=> 'Последовательность',Event:class {}};vm.createContext(c);vm.runInContext(src.slice(src.indexOf('  const segments ='),src.indexOf('  const control ='))+';globalThis.make=selectSegments;',c);
 const button=c.make('ochkiPattern');assert.equal(button.parts.length,4);assert.equal(button.type,'pair');button.parts[2].click();assert.equal(e.value,'zeros');assert.equal(changes,1);assert.equal(button.parts[2].on(),true);assert.equal(button.parts[0].on(),false);e.value='ones';assert.equal(button.parts[1].on(),true);
});
test('ring segments select explicit modes and keep the shared source handler',()=>{
 const modes=['выкл','краска','всё'];let mode=0;const e={get textContent(){return 'Зеркало: '+modes[mode];},click(){mode=(mode+1)%3;}};const c={$:()=>e,tip:()=> 'Зеркало'};vm.createContext(c);vm.runInContext(src.slice(src.indexOf('  const segments ='),src.indexOf('  const control ='))+';globalThis.make=ringSegments;',c);const b=c.make('bBlackMirror',modes);b.parts[2].click();assert.equal(mode,2);assert.equal(b.parts[2].on(),true);b.parts[0].click();assert.equal(mode,0);
});
test('overlap shading covers only rectangle intersections',()=>{
 const c={};vm.createContext(c);vm.runInContext(src.slice(src.indexOf('  function overlapRegions('),src.indexOf('  function syncGroupOverlap()')),c);const a={left:0,top:0,right:120,bottom:24},b={left:100,top:10,right:220,bottom:34};assert.deepEqual(JSON.parse(JSON.stringify(c.overlapRegions([a],[b]))),[{left:100,top:10,width:20,height:14}]);assert.equal(c.overlapRegions([a],[{left:121,top:0,right:200,bottom:24}]).length,0);
});

test('lower mirror has Left / Both / Right and clicking the selected part turns it off',()=>{
 let mode=0,options;const c={window:{mayFixLowNames:['Выкл','Левая','Правая','Обе'],mayFixLow:{get:()=>mode,set:v=>mode=v}},tools:{querySelector:()=>({})},reg:(b,fn)=>options=fn};vm.createContext(c);const line=src.split('\n').find(l=>l.includes('mayFixLowNames[i]'));assert.ok(line);vm.runInContext(line,c);
 assert.deepEqual(Array.from(options(),o=>o.name),['Левая','Обе','Правая']);for(const [i,m]of [[0,1],[1,3],[2,2]]){options()[i].pick();assert.equal(mode,m);assert.equal(options()[i].on,true);options()[i].pick();assert.equal(mode,0);}assert.ok(src.includes('повторный щелчок по выбранной части — выключить'));
});
