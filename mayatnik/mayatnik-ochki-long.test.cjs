const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
const start=html.indexOf('  function ochkiLong('),end=html.indexOf('  const ochkiKey =',start);
assert.ok(start>=0&&end>start,'production long-pattern scanner boundaries');
const threshold=Number(html.match(/const OCHKI_LONG\s*=\s*(\d+)/)[1]);
const makeScanner=width=>new Function('f','OCHKI_LONG',html.slice(start,end)+';return ochkiLong;')({W:width},threshold);

// Each descriptor is already a contiguous search-line segment. A comma separates
// its bytes from the next segment; cells can ascend or descend along a V route.
function lines(descriptors,{width=128,omitWidth=false}={}){
 let offset=0;const out=descriptors.map((descriptor,li)=>{
  const data=typeof descriptor==='string'?{str:descriptor}:descriptor,str=data.str;
  const L={str,n:str.length,b:offset,cells:Int32Array.from(str,(_,at)=>(data.rows?data.rows[at]:at)*width+li)};
  offset+=str.length+1;return L;
 });
 out.all=out.map(L=>L.str+',').join('');out.bytes=Uint8Array.from(Buffer.from(out.all));if(!omitWidth)out.width=width;return out;
}
function variants(text){const inverse=text.replace(/[01]/g,bit=>bit==='1'?'0':'1');return [[text,''],[inverse,'инв'],[text.split('').reverse().join(''),'рев'],[inverse.split('').reverse().join(''),'инв+рев']];}
// Independent oracle: enumerate complete substrings, then rank all occurrences.
// It does not use the production hash, candidate rejection or insertion logic.
function oracle(L,vsets,fallbackWidth=128){
 const out=new Map(),W=L.width||fallbackWidth;
 for(const vars of vsets)for(const text of new Set(vars.map(v=>v[0])))if(text.length>=threshold){if(out.has(text))out.get(text).need++;else out.set(text,{need:1,next:0,list:[]});}
 for(const [text,o]of out){
  const all=[];for(let li=0;li<L.length;li++)for(let at=0;at+text.length<=L[li].n;at++)if(L[li].str.slice(at,at+text.length)===text)all.push({li,at,row:Math.floor(L[li].cells[at]/W)});
  all.sort((a,b)=>a.row-b.row||a.li-b.li||a.at-b.at);o.list=all.slice(0,o.need);
 }
 return out;
}
const normalized=map=>Array.from(map,([text,o])=>({text,need:o.need,next:o.next,list:Array.from(o.list,({li,at,row})=>({li,at,row}))}));
function check(L,vsets,{fallbackWidth=128,label=''}={}){const actual=makeScanner(fallbackWidth)(L,vsets),expected=oracle(L,vsets,fallbackWidth);assert.deepEqual(normalized(actual),normalized(expected),label);return actual;}

test('long scanner includes length 16, excludes 15 and keeps first/last exact boundaries',()=>{
 const a='1011011100101101',b=a+'0',L=lines([a,'00'+b]);
 const out=check(L,[[[a.slice(1),'']],[[a,'']],[[b,'']]]);assert.equal(out.has(a.slice(1)),false);assert.equal(out.get(a).list[0].at,0);assert.equal(out.get(b).list[0].at,2);
});
test('identical variants count once per index; duplicate indices consume distinct overlapping starts',()=>{
 const text='1'.repeat(16),L=lines(['1'.repeat(20)]),sets=Array.from({length:8},()=>[[text,''],[text,'рев']]);
 const out=check(L,sets).get(text);assert.equal(out.need,8);assert.deepEqual(out.list.map(hit=>hit.at),[0,1,2,3,4]);assert.equal(out.next,0);
});
test('inversion and reversal keep independent occurrence lists with exact absent results',()=>{
 const text='10111001000011010',v=variants(text),L=lines(v.map(([word])=>'00'+word+'11'));
 check(L,[v,v,variants('0'.repeat(48))]);
});
test('equal rows rank by original line then occurrence, even if line order differs from column order',()=>{
 const text='1'.repeat(16),L=lines([{str:'1'.repeat(19),rows:Array(19).fill(7)},{str:'1'.repeat(20),rows:Array(20).fill(7)}]);
 const out=check(L,Array.from({length:6},()=>[[text,'']])).get(text);
 assert.deepEqual(out.list.map(({li,at})=>[li,at]),[[0,0],[0,1],[0,2],[0,3],[1,0],[1,1]]);
});
test('split holes and line boundaries cannot supply a cross-segment match',()=>{
 const text='1011011100101101',L=lines([text.slice(0,8),text.slice(8),'1'.repeat(40),'0'.repeat(40)]);
 assert.equal(check(L,[[[text,'']],[['1'.repeat(8)+'0'.repeat(8),'']]]).get(text).list.length,0);
});
test('V routes revisit earlier rows and replace later candidates without sorting cells',()=>{
 const str='1'.repeat(50),L=lines([{str,rows:Array.from(str,(_,at)=>Math.abs(25-at))},{str,rows:Array.from(str,(_,at)=>Math.abs(30-at))}]);
 const out=check(L,Array.from({length:7},()=>[['1'.repeat(16),'']])).get('1'.repeat(16));assert.equal(out.list[0].row,0);assert.equal(out.list[0].at,25);
});
test('explicit display width takes priority; omitted width falls back to the source field',()=>{
 const text='1011011100101101',descriptors=[text,'00'+text];check(lines(descriptors,{width:64}),[[[text,'']]],{fallbackWidth:128});check(lines(descriptors,{width:128,omitWidth:true}),[[[text,'']]],{fallbackWidth:128});
});
test('empty sequences, no long variants, empty lines and patterns longer than every line are exact',()=>{
 check(lines([]),[]);check(lines(['','101']),[[['1','']]]);check(lines(['1'.repeat(20)]),[[['1'.repeat(40),'']]]);
});
test('256 deterministic corpora match an exhaustive oracle across variants, repeats and nonmonotonic rows',()=>{
 let seed=123983;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;};
 for(let fixture=0;fixture<256;fixture++){
  const kind=fixture%5,descriptors=Array.from({length:1+random()%9},()=>{
   const str=Array.from({length:24+random()%70},(_,at)=>kind===0?'1':kind===1?String(at%2):kind===2?String(Math.floor(at/8)%2):kind===3?String(random()%5!==0?1:0):String(random()%2)).join('');
   return {str,rows:Array.from(str,(_,at)=>fixture%3===0?Math.abs(Math.floor(str.length/2)-at):fixture%3===1?Math.floor(at/3):at)};
  });
  const sets=Array.from({length:1+random()%30},()=>{const str=descriptors[random()%descriptors.length].str,at=random()%Math.max(1,str.length-16);return variants(str.slice(at,at+16+random()%30));});
  check(lines(descriptors,{omitWidth:fixture%2===0}),sets,{label:'fixture '+fixture});
 }
});
