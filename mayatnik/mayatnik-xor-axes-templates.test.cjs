'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const pack=require('./mayatnik-xor-axes-templates.js');
const html=fs.readFileSync(path.join(__dirname,'../kraftwerk/glyphen/index.html'),'utf8');
// Use the research page itself as the oracle, including its real variant codec,
// cross24 enumeration, rotation direction and neutral-pivot sentinel.
function declaration(name){
  const start=html.indexOf('function '+name+'(');assert.ok(start>=0,name);
  const body=html.indexOf('{',start);let depth=1,end=body+1;
  for(;depth;end++){if(html[end]==='{')depth++;else if(html[end]==='}')depth--;}
  return html.slice(start,end);
}
const setup=html.slice(html.indexOf('const masks='),html.indexOf('const names='));
const context=vm.createContext({});
vm.runInContext(setup+'\nconst size=29,center=14,total=6144,state={variant:0,selected:null};\n'+['unpack','pack','rotate','fieldCells','sequenceTotal','sequenceVariant'].map(declaration).join('\n')+'\nglobalThis.oracle={masks,points,orders,fieldCells,sequenceVariant};',context);
const oracle=context.oracle;
function crop(cells){
  const x0=Math.min(...cells.map(p=>p[0])),y0=Math.min(...cells.map(p=>p[1]));
  const width=Math.max(...cells.map(p=>p[0]))-x0+1,height=Math.max(...cells.map(p=>p[1]))-y0+1;
  const data=Array(width*height).fill(0);for(const[x,y,c]of cells)data[(y-y0)*width+x-x0]=c;
  return {width,height,data,pivot:{x:-x0,y:-y0}};
}
function assertRaster(entry,expected){
  const part=entry.shape.parts[0];
  assert.equal(entry.shape.rk,1);assert.equal(part.width,expected.width);assert.equal(part.height,expected.height);
  assert.deepEqual(part.data,expected.data);assert.deepEqual(entry.source.pivot,expected.pivot);
  assert.equal(part.y,0);assert.equal(part.center,0);
  assert.ok(part.data.every(v=>Number.isInteger(v)&&v>=0&&v<=0xffffffff));
}
test('four source figures match every source mask cell including the grey cap',()=>{
  pack.entries().slice(0,4).forEach((entry,i)=>{
    const cells=Array.from(oracle.points[i],([x,y])=>[x,y,x===0&&y===0?0xff777771:0xff000000]);
    assertRaster(entry,crop(cells));assert.equal(entry.source.neutralPivot,'occupied');
  });
});
test('all 24 cross identities match the actual cross24 page sequence at radius zero',()=>{
  const entries=pack.entries().slice(4),counts=[];
  entries.forEach((entry,i)=>{
    const variant=oracle.sequenceVariant(i,'cross24',0,null);
    const bits=oracle.fieldCells(variant,0,null,'xor',[],oracle.points,false,{width:29,height:29,cx:14,cy:14},null),cells=[];
    for(let q=0;q<bits.length;q++)if(bits[q]===1)cells.push([q%29-14,Math.floor(q/29)-14,0xff000000]);
    assert.equal(entry.source.variant,variant);assert.deepEqual(entry.source.turns,Array.from(oracle.orders[i]));
    assertRaster(entry,crop(cells));assert.equal(entry.source.neutralPivot,'removed');
    const p=entry.shape.parts[0],pivot=entry.source.pivot;assert.equal(p.data[pivot.y*p.width+pivot.x],0);
    counts.push(cells.length);
  });
  assert.deepEqual(counts,[113,113,113,113,113,113,113,113,113,113,113,113,113,113,113,113,113,113,113,113,113,113,113,113]);
});
test('stable catalogue ids retain 28 identities and every call returns isolated data',()=>{
  const first=pack.entries(),second=pack.entries();
  assert.equal(first.length,28);assert.equal(new Set(first.map(t=>t.id)).size,28);
  assert.deepEqual(first.map(t=>t.id),[...Array.from({length:4},(_,i)=>'xor-axes:figure:'+(i+1)),...Array.from({length:24},(_,i)=>'xor-axes:cross:'+String(i+1).padStart(2,'0'))]);
  assert.ok(first.every(t=>t.folder===pack.folder&&t.folder==='Оси XOR'));assert.deepEqual(first,second);
  first[0].shape.parts[0].data.fill(123);first[4].source.turns.reverse();first[0].source.pivot.x=999;
  assert.deepEqual(pack.entries(),second);
});
test('browser UMD exposes the same API without requiring any DOM',()=>{
  const browser=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'mayatnik-xor-axes-templates.js'),'utf8'),browser);
  assert.equal(browser.MayatnikXorAxesTemplates.entries().length,28);assert.equal(browser.MayatnikXorAxesTemplates.folder,pack.folder);
});

