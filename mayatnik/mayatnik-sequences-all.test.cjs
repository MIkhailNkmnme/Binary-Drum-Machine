const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('five direction segments select all with existing split5 geometry',()=>{
  const source=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8'),start=source.indexOf('  const segments ='),end=source.indexOf('  const ringSegments',start),events=[];
  const select={value:'diag',options:['diag','antidiag','row','col','all'].map(value=>({value,textContent:value})),dispatchEvent:e=>events.push(e.type)};
  const context={$:()=>select,tip:()=>'',Event};vm.runInNewContext(source.slice(start,end)+";globalThis.control=selectSegments('ochkiMode',{diag:'↘',antidiag:'↙',row:'→',col:'↓',all:'Все'});",context);
  assert.equal(context.control.parts.length,5);assert.match(context.control.cls,/gz-split5/);assert.equal(context.control.parts[4].label,'Все');context.control.parts[4].click();assert.equal(select.value,'all');assert.deepEqual(events,['change']);assert.equal(context.control.parts[4].on(),true);
});
test('live sequence refresh counts unique rows separately from directional hits and labels each direction',()=>{
  const source=fs.readFileSync(__dirname+'/mayatnik-sequences.js','utf8'),labelStart=source.indexOf('  const directionLabel='),labelEnd=source.indexOf('\n',labelStart),start=source.indexOf('    function refresh(){'),end=source.indexOf('    const unsubscribe=',start);
  for(const halves of [1,2]){
    const node=()=>({dataset:{},classList:{toggle(){}},title:'',getAttribute(){return 'false';},setAttribute(){}}),nodes=[node(),node(),node()],summary={};
    const found=Array.from({length:4*halves},(_,i)=>({i:0,dir:[1,-1,0,2][i%4],p:i>=4?1:0,r:5}));found.push({i:2,dir:0,r:7});
    const state={revision:1,rows:['1','11','101'],matches:{enabled:true,active:true,pattern:'initial',mode:'all',frame:42,halves,total:12*halves,found}};
    const context={pane:{closest:()=>null},api:{snapshot:()=>state},rendered:1,dirty:false,listKey:'sequence:1',nodes,summary,scrolledSelection:0};
    vm.runInNewContext(source.slice(labelStart,labelEnd)+'\n'+source.slice(start,end)+'\nrefresh();',context);
    assert.match(summary.textContent,/Всего найдено 2 из 3 строк/);assert.match(summary.textContent,new RegExp(found.length+' из '+12*halves+' совпадений'));assert.match(summary.textContent,/во всех 4 направлениях/);
    for(const arrow of ['↘','↙','→','↓'])assert.ok(nodes[0].title.includes(arrow));assert.ok(!nodes[0].title.includes('во всех'));assert.equal(nodes[1].title,'');
  }
});
