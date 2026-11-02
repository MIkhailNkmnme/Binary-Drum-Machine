const test=require('node:test');
const assert=require('node:assert/strict');
const {capture,MAX_ROWS,MAX_CELLS}=require('./mayatnik-xorrom-field.js');

function field(grid,extra={}){
  return {width:grid[0].length,height:grid.length,readBit:(x,y)=>grid[y][x],...extra};
}

test('counts each of the eight R-centre G-left B-right neighbourhoods at its centre',async()=>{
  for(let code=0;code<8;code++){
    const a=(code>>1)&1,b=(code>>2)&1,c=code&1;
    const {rows}=await capture(field([[a,b,c]]));
    const expected=new Uint32Array(8);
    expected[4*a+b]++;expected[code]++;expected[4*c+2*b]++;
    assert.deepEqual(rows[0].colors,expected);
    assert.equal(rows[0].ones,a+b+c);assert.equal(rows[0].total,3);
  }
});

test('preserves holes, silent rows, and the bits from capture time',async()=>{
  const grid=[[1,-1,0],[-1,-1,-1],[0,0,0]];
  const {rows}=await capture(field(grid));grid[0][0]=0;
  assert.deepEqual([...rows[0].bits],[1,-1,0]);
  assert.deepEqual([...rows[0].colors],[1,0,0,0,1,0,0,0]);
  assert.deepEqual(rows.map(r=>[r.ones,r.total]),[[1,2],[0,0],[0,3]]);
  assert.deepEqual([...rows[1].colors],Array(8).fill(0));assert.equal(rows[2].colors[0],3);
});

test('uses host RGB classes, preserves changes to bit values and excludes filtered cells',async()=>{
  const codes=[1,4,255,-1,0];
  const {rows:[row]}=await capture(field([[1,0,1,0,1]],{readRGB:x=>codes[x]}));
  assert.deepEqual([...row.bits],[1,0,-1,-1,1]);assert.equal(row.ones,2);assert.equal(row.total,3);
  assert.deepEqual([...row.colors],[1,1,0,0,1,0,0,0]);
});

test('rejects invalid or oversized sources before reading a cell',async()=>{
  const readBit=()=>assert.fail('unexpected read');
  for(const [width,height] of [[0,1],[1,0],[1.5,2],[1,MAX_ROWS+1],[MAX_CELLS+1,1]]){
    await assert.rejects(capture({width,height,readBit}),/Хорром/);
  }
  await assert.rejects(capture(field([[2]])),/значение бита/);
  await assert.rejects(capture(field([[0]],{readRGB:()=>8})),/цвет RGB/);
});

test('cancels before reading or after a yield without returning a partial score',async()=>{
  await assert.rejects(capture(field([[1]]),{cancelled:()=>true}),{name:'AbortError'});
  let current=true,reads=0;
  const source={width:40000,height:1,readBit:()=>{reads++;return 0;},current:()=>current};
  await assert.rejects(capture(source,{yieldTask:async()=>{current=false;}}),{name:'AbortError'});
  assert.equal(reads,32768);
});
