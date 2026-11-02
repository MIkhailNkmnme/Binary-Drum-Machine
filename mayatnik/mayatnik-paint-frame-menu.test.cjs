const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8');
test('frame paint control selects one of three modes through the native change handler',()=>{
 const calls=[],input={value:'off',title:'На кадры',options:['off','colour','cells'].map(value=>({value,textContent:value})),dispatchEvent(e){calls.push([e.type,this.value]);}};
 const c={$:id=>{assert.equal(id,'paintFrameMode');return input;},tip:e=>e.title,Event:class{constructor(type){this.type=type;}}};
 const line=name=>source.split('\n').find(line=>line.startsWith('  const '+name+' ='));
 vm.createContext(c);vm.runInContext(line('segments')+'\n'+line('selectSegments')+"\nthis.control=selectSegments('paintFrameMode',{off:'Выкл',colour:'Цвет',cells:'Биты'});",c);
 const parts=c.control.parts;assert.deepEqual(Array.from(parts,p=>p.label),['Выкл','Цвет','Биты']);
 for(let i=0;i<3;i++){parts[i].click();assert.deepEqual(Array.from(parts,p=>p.on()),[0,1,2].map(n=>n===i));}
 assert.deepEqual(calls,[['change','off'],['change','colour'],['change','cells']]);
 input.disabled=true;parts[0].click();assert.equal(input.value,'cells');assert.equal(calls.length,3);
});
