const test=require('node:test'),assert=require('node:assert/strict');
const V=require('./mayatnik-variants.js'),Snake=require('./mayatnik-snake.js'),Manual=require('./mayatnik-manual-snake.js'),Gif=require('./mayatnik-gif-search.js'),Loop=require('./mayatnik-ochki-loop.js'),Route=require('./mayatnik-ochki-v-route.js'),Catalog=require('./mayatnik-snake-catalog.js'),Sequences=require('./mayatnik-sequences.js');
test('mask compares each original row to its reverse and preserves wildcard positions through every variant',()=>{
 assert.equal(V.rowReverseMask('1011'),'1  1');assert.equal(V.rowReverseMask('1100'),'    ');assert.equal(V.rowReverseMask('101'),'101');
 for(let flags=0;flags<8;flags++){const opts={inverse:!!(flags&1),reverse:!!(flags&2),half:!!(flags&4),rowReverseMask:true};for(const item of V.generate('1011',opts)){assert.equal(item.word.length,4);assert.equal(item.word.slice(1,3),'  ');assert.equal(item.flags.rowReverseMask,true);}}
 assert.equal(V.generate('1011')[0].word,'1011');assert.equal(V.create().rowReverseMask('1011'),'1  1');
});
test('wildcard index search equals brute force, honours starting offset and never crosses unknowns or line separators',()=>{
 for(let n=1;n<=7;n++)for(let bits=0;bits<2**n;bits++){const word=V.rowReverseMask(bits.toString(2).padStart(n,'0')),text='01,1101001101?10101';for(let from=0;from<=text.length;from++){let expected=-1;for(let at=from;at+word.length<=text.length;at++){if([...word].every((c,i)=>c===' '?/[01]/.test(text[at+i]):text[at+i]===c)){expected=at;break;}}assert.equal(V.indexOf(text,word,from),expected);}}
 assert.equal(V.indexOf('0'.repeat(100000),' '.repeat(10000)),0);assert.equal(V.indexOf('111,111','    '),-1);
});
test('cycle and V paths accept masks while keeping earliest-row semantics',()=>{
 const lines=Loop.lines({width:4,height:1,val:Int8Array.from([1,0,0,1])});Loop.prepare(lines,4);assert.equal(Loop.firstOccurrence(lines[0],'1  1',4).at,0);
 const L={str:'1001',cells:Int32Array.from([9,7,5,3]),n:4};assert.equal(Route.firstOccurrence(L,'1  1',4).at,0);
});
test('automatic and manual snake plus lossless catalogue accept all-wildcard rows on either bit',()=>{
 const nodes=[{x:0,y:0,bit:0,edges:[1,2]},{x:-1,y:1,bit:0,edges:[]},{x:1,y:1,bit:1,edges:[]}];
 const manual=Manual.findGraph({nodes,start:0,text:'10',rowReverseMask:true});assert.equal(manual.found,true);assert.equal(manual.matchedText||manual.text,'  ');
 const val=Int8Array.from([0,-1,-1,-1,1,-1,-1,-1,-1]);const automatic=Snake.find({width:3,height:3,val,anchor:0,sequence:['10'],rowReverseMask:true});assert.equal(automatic.found.length,1);assert.equal(automatic.found[0].text,'  ');
 const iterator=Catalog.compileSteps({nodes,sequence:['10'],variants:[V.generate('10',{rowReverseMask:true})]});let result;do{result=iterator.next();}while(!result.done);assert.equal(result.value.rows[0].count,'2');
});
test('GIF directions and four cyclic families match wildcard 0/1 and reject mixed cells',async()=>{
 const grid={width:4,height:1,bits:Int8Array.from([1,0,0,1])};const plain=await Gif.search(grid,{patterns:['1011']});assert.equal(plain.count,0);const masked=await Gif.search(grid,{patterns:['1011'],rowReverseMask:true});assert.equal(masked.count,1);assert.equal(masked.hits[0].text,'1  1');assert.deepEqual([...masked.mask],[1,1,1,1]);
 const loops=await Gif.search(grid,{patterns:['10'],rowReverseMask:true,direction:'loops'});assert.equal(loops.count,16);
 const blocked=await Gif.search({...grid,bits:Int8Array.from([1,-2,0,1])},{patterns:['1011'],rowReverseMask:true,direction:'loop'});assert.equal(blocked.count,0);
});
test('table display substitutes real spaces without changing stored source text',()=>{assert.equal(Sequences.searchDisplayWord('1011',{rowReverseMask:true}),'1  1');assert.equal(Sequences.searchDisplayWord('1011',{}),'1011');});

test('all-wildcard GIF keeps exact count and highlight with bounded saved routes and cancellable loops',async()=>{
 const width=10000,grid={width,height:1,bits:new Int8Array(width)},word='1'.repeat(500)+'0'.repeat(500);const result=await Gif.search(grid,{patterns:[word],rowReverseMask:true,maxSavedCells:2000});assert.equal(result.count,9001);assert.equal(result.hits.length,2);assert.equal(result.mask.reduce((a,b)=>a+b,0),width);
 let cancelled=false;await assert.rejects(Gif.search(grid,{patterns:[word],rowReverseMask:true,direction:'loop',maxSavedCells:0,budgetMs:0,now:()=>1,yieldTask:async()=>{cancelled=true;},cancelled:()=>cancelled}),e=>e.name==='AbortError');
});
