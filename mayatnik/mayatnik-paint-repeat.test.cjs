const test=require('node:test'),assert=require('node:assert/strict'),Repeat=require('./mayatnik-paint-repeat.js');
const capture=(paint,base,previous=null)=>Repeat.capture(previous,{scope:'field',width:4,height:1,base:Uint32Array.from(base),paint:Uint32Array.from(paint),address:i=>i});
test('colour matches all original RGB in one pass, with no chained substitutions',()=>{
 const seed=capture([0xff000002,0xff000003,0,0],[0xff000001,0xff000002,0xff000001,0xff000004]);
 const base=Uint32Array.of(0xff000001,0xff000002,0xff000001,0xff000004),px=base.slice();Repeat.apply(px,base,seed,{scope:'field',mode:'colour',address:i=>i});assert.deepEqual([...px],[0xff000002,0xff000003,0xff000002,0xff000004]);
});
test('the latest repainted native cell wins for a shared original RGB',()=>{
 let seed=capture([0xff000011,0xff000022,0,0],[7,7,7,7]);seed=capture([0xff000033,0xff000022,0,0],[7,7,7,7],seed);
 const px=new Uint32Array(4);Repeat.apply(px,Uint32Array.of(7,7,7,7),seed,{mode:'colour',scope:'field',address:i=>i});assert.deepEqual([...px],Array(4).fill(0xff000033));
});
test('cells use logical addresses even if bits, raster order and scale change; mask excludes current pixels',()=>{
 const seed=capture([0,0xff123456,0,0],[1,1,1,1]),px=new Uint32Array(8),base=new Uint32Array(8);Repeat.apply(px,base,seed,{mode:'cells',scope:'field',address:i=>Math.floor(i/2),blocked:Uint8Array.of(0,0,0,1)});assert.deepEqual([...px],[0,0,0xff123456,0,0,0,0,0]);
 const old=px.slice();Repeat.apply(px,base,seed,{mode:'off',scope:'field',address:i=>i});assert.deepEqual(px,old);
});
test('raster seeds refuse changed projection and other source fields',()=>{
 const seed={...capture([0xff000011,0,0,0],[1,1,1,1]),domain:'raster',geometry:'native'};
 for(const opts of [{scope:'other',geometry:'native'},{scope:'field',geometry:'other'}]){const px=new Uint32Array(4);Repeat.apply(px,new Uint32Array(4).fill(1),seed,{...opts,mode:'cells',address:i=>i});assert.equal(px.some(Boolean),false);}
});
test('erase clears RGB ownership or selected logical cells; normalization rejects malformed addresses',()=>{
 const seed=capture([0xff000011,0xff000022,0,0],[7,7,7,7]);assert.equal(Repeat.erase(seed,[0],{mode:'colour',base:[7],address:i=>i}),null);
 const erased=Repeat.erase(seed,[0],{mode:'cells',base:[7],address:i=>i});assert.deepEqual([...erased.entries],[1,7,0xff000022]);assert.throws(()=>Repeat.normalize({...seed,entries:[4,7,1]}));assert.throws(()=>Repeat.normalize({...seed,entries:[0,7,1,0,7,2]}));
 assert.deepEqual(Repeat.normalize(Repeat.json(seed)),seed);
});
test('binary work and compressed share links preserve sparse seed and mode',async()=>{
 const seed=capture([0xff123456,0,0,0],[1,1,1,1]),Work=require('./mayatnik-work-file.js'),Share=require('./mayatnik-share-link.js');
 const decoded=(await Work.decode(await Work.encode({paintRepeat:seed,st:{paintFrameMode:'cells'}}))).data;assert.deepEqual(decoded.paintRepeat,seed);assert.equal(decoded.st.paintFrameMode,'cells');
 const payload={v:1,k:1,state:{rows:8,steps:8,mode:'pend',bg:'empty',paintFrameMode:'colour'},paintRepeat:Repeat.json(seed)};
 const restored=await Share.decode(await Share.encode(payload));assert.deepEqual(Repeat.normalize(restored.paintRepeat),seed);assert.equal(restored.state.paintFrameMode,'colour');
});
