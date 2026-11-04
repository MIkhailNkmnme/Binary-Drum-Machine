'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Loop=require('./mayatnik-ochki-loop.js');
function fixture(text){return Loop.lines({width:text.length,height:1,val:Int8Array.from(text,c=>c==='?'?-2:+c)});}
test('cyclic helper scans each finite origin exactly once, including many laps',()=>{
 for(let n=1;n<=6;n++)for(let bits=0;bits<2**n;bits++){const ring=bits.toString(2).padStart(n,'0'),lines=fixture(ring);
  for(const size of [1,n,n+1,2*n+3,18]){const word=Array.from({length:size},(_,i)=>ring[(i+n-1)%n]).join('');Loop.prepare(lines,size);const used=new Set(),actual=[];for(;;){const hit=Loop.firstOccurrence(lines[0],word,n,x=>used.has(x));if(!hit)break;used.add(hit.at);actual.push(hit.at);}
   const expected=[];for(let start=0;start<n;start++)if(Array.from(word,(c,i)=>c===ring[(start+i)%n]).every(Boolean))expected.push(start);assert.deepEqual(actual,expected);assert.equal(lines[0].cells.length,n+size-1);
  }
 }
});
test('cyclic maximal runs agree with independent edge cuts for binary and unknown cells',()=>{
 for(let n=1;n<=6;n++)for(let code=0;code<3**n;code++){let k=code,ring='';for(let i=0;i<n;i++){ring+='01?'[k%3];k=Math.floor(k/3);}const lines=fixture(ring);
  for(const pattern of ['ones','zeros','alternating'])for(const inverse of [false,true]){
   const good=i=>ring[i]!=='?'&&(pattern==='alternating'||inverse||ring[i]===(pattern==='zeros'?'0':'1'));
   const edge=(a,b)=>good(a)&&good(b)&&(pattern==='alternating'?ring[a]!==ring[b]:ring[a]===ring[b]);const expected=[];
   for(let start=0;start<n;start++)if(good(start)&&!edge((start+n-1)%n,start)){const cells=[start];while(cells.length<n&&edge(cells.at(-1),(cells.at(-1)+1)%n))cells.push((cells.at(-1)+1)%n);expected.push(cells);}
   if(!expected.length&&good(0)&&Array.from({length:n},(_,i)=>edge(i,(i+1)%n)).every(Boolean))expected.push(Array.from({length:n},(_,i)=>i));
   const actual=Loop.runs(lines,{pattern,inverse,min:1}).map(L=>Array.from(L.cells));assert.deepEqual(actual,expected,JSON.stringify({ring,pattern,inverse}));
  }
 }
});
test('empty cells vanish and hidden cells are omitted before constructing one circuit',()=>{
 const lines=Loop.lines({width:4,height:2,val:Int8Array.from([1,-1,0,-2,-1,1,0,-1]),allowed:(r,c)=>r!==1||c!==2});assert.equal(lines.length,1);assert.equal(lines[0].ring,'10?1');assert.deepEqual(Array.from(lines[0].baseCells),[0,2,3,5]);assert.equal(Loop.lines({width:2,height:1,val:Int8Array.of(-1,-1)}).length,0);
});
