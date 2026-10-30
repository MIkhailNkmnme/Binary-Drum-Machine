const test=require('node:test'),assert=require('node:assert/strict'),Methods=require('./mayatnik-ochki-method.js');
const {create,KEY}=require('./mayatnik-ochki-log.js');
test('actual route labels cover directions, V, both snake modes and applied variants only',()=>{
 for(const [dir,name]of [[0,'горизонталь →'],[2,'вертикаль ↓'],[1,'диагональ ↘'],[-1,'диагональ ↙'],['v','V ↘↗'],['snake','змея ↙↘']]){
  for(const [vn,suffix]of [['',''],['инв',' · инверсия'],['рев',' · реверс'],['инв+рев',' · инверсия + реверс']])assert.equal(Methods.label({dir,vn}),name+suffix);
 }
 assert.equal(Methods.label({dir:'snake',manual:true,vn:'рев'}),'ручная змея ↙↘ · реверс');
 assert.equal(Methods.label({settings:{ochkiMode:'col',ochkiInv:true,ochkiRev:true}}),'способ не записан');
 assert.equal(Methods.label({dir:0,vn:'',ochkiInv:true,ochkiRev:true}),'горизонталь →');
});
test('serialized metadata retains first actual method and legacy unknown without inventing enabled settings',async()=>{
 let saved;const host={storage:async()=>({read:async()=>saved,write:async(value,key)=>{assert.equal(key,KEY);saved=structuredClone(value);}})};
 const log=create(host);await log.ready;const detail={id:'methods',status:'found',frame:19,halves:2,settings:{ochkiMode:'all',ochkiInv:true,ochkiRev:true},finds:[{i:0,p:0,dir:0,vn:''},{i:0,p:1,dir:'v',vn:'инв+рев'},{i:1,dir:'snake',vn:'рев',manual:true}]};
 await log.record(detail);detail.finds[0].dir=2;await log.record({id:'legacy',status:'saved',finds:[{i:2}],settings:{ochkiMode:'diag'}});
 const again=create(host);await again.ready;assert.deepEqual(again.list()[0].finds.map(Methods.label),['горизонталь →','V ↘↗ · инверсия + реверс','ручная змея ↙↘ · реверс']);assert.equal(Methods.label(again.list()[1].finds[0]),'способ не записан');
});
