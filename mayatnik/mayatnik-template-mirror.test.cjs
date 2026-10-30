const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'Zerkalius-mayatnik.html'),'utf8');
const code=html.slice(html.indexOf('  function flipParts('),html.indexOf('  // v0.039: горизонтальная линия-зеркало'));
const context={Uint32Array,Int8Array,Uint8ClampedArray,ImageData:class{},document:{createElement:()=>({getContext:()=>({putImageData(){}})})},MayatnikTemplate:{symmetry:()=>({})}};
vm.createContext(context);vm.runInContext(code,context);
for(const horizontal of [true,false])test('template '+(horizontal?'horizontal':'vertical')+' flip mirrors mask and own 0/1/empty bits together',()=>{
  const mask=new Uint32Array([7,0,8,9,10,0]),bits=new Int8Array([1,-1,0,0,1,-1]),source=new Uint32Array([31,32,33,34,35,36]);
  const item={parts:[{mask:{width:3,height:2,data:mask},bitsData:bits,sourceData:source,bitCanvas:{stale:true},edges:{stale:true}}]};
  context.flipParts(item,horizontal);let p=item.parts[0];
  assert.deepEqual([...p.mask.data],horizontal?[8,0,7,0,10,9]:[9,10,0,7,0,8]);
  assert.deepEqual([...p.bitsData],horizontal?[0,-1,1,-1,1,0]:[0,1,-1,1,-1,0]);
  assert.equal(p.bitCanvas,null);assert.equal(p.edges,null);assert.equal(p.sourceData,source);
  assert.deepEqual([...mask],[7,0,8,9,10,0]);assert.deepEqual([...bits],[1,-1,0,0,1,-1]);
  context.flipParts(item,horizontal);p=item.parts[0];assert.deepEqual([...p.mask.data],[...mask]);assert.deepEqual([...p.bitsData],[...bits]);assert.equal(p.sourceData,source);
});
test('ordinary mask flip preserves original source for lifting and does not invent own bits',()=>{
  const data=new Uint32Array([1,0,3]),item={parts:[{mask:{width:3,height:1,data}}]};
  context.flipParts(item,true);assert.deepEqual([...item.parts[0].mask.data],[3,0,1]);assert.equal(item.parts[0].sourceData,data);assert.equal(item.parts[0].bitsData,undefined);
});
test('manual reflections preserve only a geometrically valid source-orientation label',()=>{
 const make=(data,width,orientation)=>({matchOrientation:orientation,parts:[{mask:{width,height:data.length/width,data:Uint32Array.from(data)}}]});
 const asymmetric=make([1,1,1,1,0,0],3,'direct');context.flipParts(asymmetric,true);assert.equal(asymmetric.matchOrientation,'mirror');context.flipParts(asymmetric,true);assert.equal(asymmetric.matchOrientation,'direct');context.flipParts(asymmetric,false);assert.equal(asymmetric.matchOrientation,undefined);
 const symmetric=make([1,1,1,0,1,0],3,'symmetric');context.flipParts(symmetric,true);assert.equal(symmetric.matchOrientation,'symmetric');
 const unchangedVertical=make([1,1,0,1,1,0],3,'mirror');context.flipParts(unchangedVertical,false);assert.equal(unchangedVertical.matchOrientation,'mirror');
 const verticalEqualsHorizontal=make([1,0,0,1],2,'direct');context.flipParts(verticalEqualsHorizontal,false);assert.equal(verticalEqualsHorizontal.matchOrientation,'mirror');context.flipParts(verticalEqualsHorizontal,false);assert.equal(verticalEqualsHorizontal.matchOrientation,'direct');
});
