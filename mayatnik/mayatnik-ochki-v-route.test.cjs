const test=require('node:test'),assert=require('node:assert/strict');
const route=require('./mayatnik-ochki-v-route.js');
const field=(width,height)=>({width,height,val:Int8Array.from({length:width*height},(_,q)=>(q*31+Math.floor(q/width))%2)});
const coords=(L,W)=>Array.from(L.cells,q=>[q%W,Math.floor(q/W)]);
test('V includes the exact integer meeting centre once and turns from down-right to up-right',()=>{
  const f=field(9,5),before=f.val.slice(),lines=route.lines({...f,points:[{x:4,y:4}]});
  assert.equal(lines.length,1);assert.deepEqual(coords(lines[0],9),[[0,0],[1,1],[2,2],[3,3],[4,4],[5,3],[6,2],[7,1],[8,0]]);
  assert.equal(lines[0].monotonic,false);assert.equal(lines[0].dir,'v');assert.equal(new Set(lines[0].cells).size,9);assert.deepEqual(f.val,before);
});
test('half-cell turn is exact, and single-lattice partition prevents an invisible bridge',()=>{
  const f=field(8,5),points=[{x:3.5,y:3.5}],flat=route.lines({...f,points});
  assert.deepEqual(coords(flat[0],8),[[0,0],[1,1],[2,2],[3,3],[4,3],[5,2],[6,1],[7,0]]);
  const split=route.lines({...f,points,partition:(r,c)=>(c-r)&1});assert.equal(split.length,0);
  for(const p of [0,1])assert.equal(route.lines({...f,points,allowed:(r,c)=>((c-r)&1)===p}).length,0);
  assert.equal(route.lines({...f,points:[{x:3,y:3}],partition:(r,c)=>(c-r)&1}).length,1,'integer meeting really connects both rays on one lattice');
});
test('holes, disallowed cells and an out-of-field turn split paths without joining separated bits',()=>{
  const f=field(9,4);f.val[2*9+2]=-1;
  const lines=route.lines({...f,points:[{x:4,y:4}],allowed:(r,c)=>c!==6});
  assert.equal(lines.length,0,'no bridge through a turn below the field');
  const surviving=route.lines({...field(9,5),points:[{x:4,y:4}],allowed:(r,c)=>c!==1});
  assert.equal(surviving.length,1);assert.deepEqual(coords(surviving[0],9),[[2,2],[3,3],[4,4],[5,3],[6,2],[7,1],[8,0]]);
});
test('duplicate crosses do not create duplicate occurrences',()=>{
  const f=field(9,5),lines=route.lines({...f,points:[{x:4,y:4},{x:4,y:4},{x:3,y:3}]});
  const paths=lines.map(L=>Array.from(L.cells).join(','));assert.equal(paths.length,2);assert.equal(paths.length,new Set(paths).size);
  assert.equal(lines.all,lines.map(L=>L.str+',').join(''));for(const L of lines)assert.equal(Buffer.from(lines.bytes.subarray(L.b,L.b+L.n)).toString(),L.str);
});
test('non-lattice axes never silently round to a different set of bits',()=>{
  const f=field(9,9);assert.equal(route.lines({...f,points:[{x:4,y:4.5}]}).length,0);assert.equal(route.lines({...f,points:[{x:4.2,y:4.2}]}).length,0);
});
test('ascending-arm occurrences are searched exhaustively and the highest start wins',()=>{
  const f=field(9,5),L=route.lines({...f,points:[{x:4,y:4}]})[0];L.str='101010101';
  assert.deepEqual(route.firstOccurrence(L,'101',9),{at:0,row:0});
  assert.deepEqual(route.firstOccurrence(L,'101',9,at=>at===0),{at:2,row:2});
  assert.deepEqual(route.firstOccurrence(L,'101',9,at=>at===0||at===2),{at:6,row:2});
  assert.equal(route.firstOccurrence(L,'111',9),null);
  assert.equal(route.firstOccurrence(L,'',9),null);
});
test('route cell sets equal an independent grid equation oracle for integer and half-cell intersections',()=>{
  for(let width=2;width<=14;width++)for(let height=2;height<=9;height++)for(const half of [0,.5]){
    const f=field(width,height),X=(width>>1)+half,Y=(height-1)+half,lines=route.lines({...f,points:[{x:X,y:Y}]}),actual=lines.flatMap(L=>Array.from(L.cells)).sort((a,b)=>a-b),expected=[];
    for(let r=0;r<height;r++)for(let c=0;c<width;c++)if(r<=Y&&(c<=X&&c-r===X-Y||c>=X&&c+r===X+Y))expected.push(r*width+c);
    if(!expected.some(q=>q%width<X)||!expected.some(q=>q%width>X))expected.length=0;
    assert.deepEqual(actual,expected);assert.ok(actual.every(q=>f.val[q]>=0));
  }
});
test('joined-display V crosses its base continuously and maps each highlight to the exact original bit',()=>{
  const joined=require('./mayatnik-joined-romb.js');
  for(const rotate of [false,true]){
    const mapper=joined.create({width:13,height:4,origin:2,anchor:3,fieldWidth:17,rotate}),values=Int8Array.from({length:17*4},(_,q)=>q%2),snapshot=mapper.snapshot({val:values});
    const lines=route.lines({...snapshot,points:[{x:6,y:5}]});assert.equal(lines.length,1);assert.equal(lines[0].cells.length,11);
    const source=Array.from(lines[0].cells,q=>mapper.fromDisplay(q));assert.ok(source.some(p=>p.p===0));assert.ok(source.some(p=>p.p===1));assert.equal(new Set(source.map(p=>p.q)).size,11);
    for(let i=0;i<source.length;i++){
      const x=lines[0].cells[i]%snapshot.width,y=Math.floor(lines[0].cells[i]/snapshot.width),r=y>=4?7-y:y,c=2+(y>=4&&rotate?12-x:x);
      assert.equal(source[i].q,r*17+c);assert.equal(lines[0].str[i],String(values[r*17+c]));
    }
  }
});
test('a long ascending arm is not truncated and finds patterns near its far end',()=>{
  const f={width:20001,height:10001,val:new Proxy({length:20001*10001},{get:(o,k)=>k==='length'?o.length:0})},points=[{x:10000,y:10000}],lines=route.lines({...f,points});assert.equal(lines.length,1);assert.equal(lines[0].cells.length,20001);
  const L=lines[0];L.str='0'.repeat(19968)+'1'.repeat(32)+'0';assert.deepEqual(route.firstOccurrence(L,'1'.repeat(32),f.width),{at:19968,row:32});
});
test('simple-run selection follows the actual V order through its turn, rather than a straight-line substitute',()=>{
  const f=field(9,5),lines=route.lines({...f,points:[{x:4,y:4}]});lines[0].str='001111100';
  const hit=route.recoverRuns(lines,4*9+4,{pattern:'ones',min:4});assert.equal(hit.length,1);assert.deepEqual(hit[0].cells,[20,30,40,32,24]);assert.equal(hit[0].text,'11111');
  assert.equal(route.recoverRuns(lines,40,{pattern:'zeros'}).length,0);assert.equal(route.recoverRuns(lines,40,{pattern:'zeros',inverse:true}).length,1);
  lines[0].str='010101010';const alt=route.recoverRuns(lines,40,{pattern:'alternating',min:9});assert.equal(alt[0].n,9);assert.equal(alt[0].dir,'v');assert.equal(route.recoverRuns(lines,40,{pattern:'alternating',min:10}).length,0);
});

test('all vertical apex positions are enumerated without moving the fixed axis or inventing off-lattice bridges',()=>{
 const W=11,H=7,val=Int8Array.from({length:W*H},(_,q)=>(q*7+Math.floor(q/W))&1),axes=[{x:5,y:1},{x:5,y:5},{x:4.5,y:3.5}],points=route.verticalPoints(axes,H);
 assert.equal(points.length,28);assert.deepEqual([...new Set(points.map(p=>p.x))],[4.5,5]);assert.deepEqual(points.filter(p=>p.x===5).map(p=>p.y),Array.from({length:14},(_,i)=>i/2));
 const actual=route.lines({width:W,height:H,val,points}),oracle=[];
 for(const X of [4.5,5])for(let Y=0;Y<H;Y+=.5){const cells=[];for(let x=0;x<W;x++)for(let y=0;y<H;y++)if(y+Math.abs(x-X)===Y)cells.push(y*W+x);if(cells.length&&cells[0]%W<X&&cells.at(-1)%W>X)oracle.push(cells.join(','));}
 assert.deepEqual(actual.map(l=>Array.from(l.cells).join(',')).sort(),oracle.sort());
 const phased=route.lines({width:W,height:H,val,points,partition:(r,c)=>(r+c)&1});assert.ok(phased.every(l=>Number.isInteger(l.meeting.x)&&Number.isInteger(l.meeting.y)));assert.ok(phased.some(l=>l.meeting.y===6));
});
