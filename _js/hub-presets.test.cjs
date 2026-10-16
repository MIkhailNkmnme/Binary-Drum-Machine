const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('./hub-presets-core.js'),{WaterField}=require('./hub-flow-core.js');
test('portable grids preserve fractional mass, active rows, simulation parity and outflow',()=>{
 const source=new WaterField(5,4);source.water[0]=.125;source.water[4]=.7;source.water[11]=1;source.tick=13;source.drained=42.5;
 const saved=JSON.parse(JSON.stringify(C.pack(source))),target=new WaterField(5,4);C.restoreGrid(target,saved);
 assert.deepEqual(target.water,source.water);assert.deepEqual([...target.activeRows],[0,2]);assert.equal(target.tick,13);assert.equal(target.drained,42.5);
 const narrow=new WaterField(3,3);C.restoreGrid(narrow,saved);assert.equal(narrow.water[0],.125);assert.equal(narrow.water[7],1);assert.equal(narrow.water.reduce((a,b)=>a+b,0),1.125);
});
test('empty fields are compact and invalid allocation / runs are rejected',()=>{
 assert.equal(C.pack(new WaterField(1920,1080)).runs.length,0);
 for(const g of [{width:1e9,height:1e9,runs:[]},{width:2,height:2,runs:[[3,[1,1]]]},{width:2,height:2,runs:[[0,[NaN]]]},{width:2,height:2,runs:[[0,[1]],[0,[1]]]}])assert.throws(()=>C.unpack(g));
});
test('validation rejects unrelated files, prototype keys, foreign storage, bad rows and remote images',()=>{
 const base={format:'zerkalius-hub',version:1,name:'Зеркалиус-1',settings:{},state:{view:{state:{}},mirror:{state:{}},flow:{rays:[]},scene:{music:{rows:['1','01']}}}};
 assert.equal(C.validate(C.clone(base)).name,'Зеркалиус-1');
 for(const change of [s=>s.version=2,s=>s.settings.password='bad',s=>s.state.scene.music.rows=['<script>'],s=>s.state.image='https://example.com/a.png',s=>s.state.flow={waterGrid:{width:999999,height:99999,runs:[]}}]){const s=C.clone(base);change(s);assert.throws(()=>C.validate(s));}
 assert.throws(()=>C.validate(JSON.parse('{"__proto__":{}}')));
});
test('music snapshot restores all bit rows, current frontier, speed and pause',()=>{
 const window={};vm.runInNewContext(fs.readFileSync(__dirname+'/hub-rhomb-music.js','utf8'),{window,clearTimeout(){},setTimeout(){return 1;}});
 let published;const music=window.HubRhombMusic(['1'],v=>published=v);
 const input={rows:['1','01','101'],front:[[2,0],[2,2]],row:2,speed:4,paused:true,running:true};music.restore(input);
 assert.deepEqual(JSON.parse(JSON.stringify(music.snapshot())),input);assert.deepEqual(JSON.parse(JSON.stringify(published.zerkRows)),input.rows);assert.equal(published.zerkSndPaused,true);
});
