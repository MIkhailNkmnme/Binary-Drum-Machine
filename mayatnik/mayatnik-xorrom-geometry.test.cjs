const test=require('node:test');
const assert=require('node:assert/strict');
const {analyze}=require('./mayatnik-xorrom-geometry');
const mayatnik=require('./mayatnik-core');
const cellArea=require('./mayatnik-cell-area');

function score(lines){
  const rows=lines.map(line=>{
    const bits=Int8Array.from(line,c=>c==='.'?-1:Number(c));
    return {bits,ones:bits.filter(b=>b===1).length,total:bits.filter(b=>b>=0).length};
  });
  return {width:rows[0]?.bits.length||0,height:rows.length,rows};
}

// Pascal XOR in a centered triangular lattice. Join adjacent occupied
// lattice points on each row to rasterize it as an ordinary square bitmap.
function pascal(size){
  return Array.from({length:size},(_,y)=>{
    let line='.'.repeat(size-y-1);
    for(let x=0;x<=2*y;x++){
      const k=x>>1;
      line+=Number((k&y)===k&&(x%2===0||((k+1)&y)===k+1));
    }
    return line+'.'.repeat(size-y-1);
  });
}

test('the large zero triangle wins all fifteen rows of a 32-row XOR field',async()=>{
  const raw=score(pascal(32)),field=await analyze(raw),triangle=field.rows[16].geometry.zero;
  assert.equal(triangle.area,255);assert.equal(triangle.height,15);assert.equal(triangle.width,31);
  assert.equal(triangle.symmetryHeight,15);assert.equal(triangle.orientation,'down');
  assert.ok(triangle.triangleScore>.85);assert.equal(triangle.exterior,false);
  for(let y=16;y<=30;y++)assert.equal(field.rows[y].geometry.zero,triangle);
  assert.equal(field.rows[31].geometry.zero,null);
  assert.equal(field.rows[8].geometry.zero.area,63);
  assert.equal(field.rows[16].bits,raw.rows[16].bits);
  assert.equal(raw.rows[16].geometry,undefined);
  assert.equal(await analyze(field),field);
});

test('the real Mayatnik cone retains its centered hole on both empty and explicitly zero backgrounds',async()=>{
  for(const bg of ['empty','0']){
    const f=mayatnik.field(65,32,bg);
    mayatnik.cone(f,32,32);
    const rows=Array.from({length:32},(_,i)=>({bits:f.val.subarray(i*65,(i+1)*65)}));
    const field=await analyze({width:65,height:32,rows});
    assert.equal(field.geometry.topology,bg==='empty'?'diamond':'square');
    const chosen=r=>r.geometry.triangle||r.geometry.zero;
    const region=chosen(field.rows[16]);
    assert.equal(region.width,29);assert.equal(region.height,15);assert.equal(region.symmetryHeight,15);
    assert.equal(region.area,120);assert.equal(region.perimeter,60);
    assert.equal(region.orientation,'down');assert.equal(region.triangleScore,1);
    for(let y=16;y<=30;y++)assert.equal(chosen(field.rows[y]),region);
    assert.notEqual(chosen(field.rows[15]),region);assert.notEqual(chosen(field.rows[31]),region);
  }
});

test('an exterior background yields to a smaller enclosed hole only across its span',async()=>{
  const field=await analyze(score(['000000000','001111100','001000100','001010100','001000100','001111100','000000000']));
  const bg=field.rows[0].geometry.zero,hole=field.rows[2].geometry.zero;
  assert.ok(bg.exterior&&!hole.exterior&&bg.area>hole.area);
  assert.equal(hole.area,8);assert.equal(hole.perimeter,16);
  for(let y=2;y<=4;y++)assert.equal(field.rows[y].geometry.zero,hole);
  assert.equal(field.rows[5].geometry.zero,bg);
});

test('a row with the same counts can belong to different regions; translation and reflection preserve shape',async()=>{
  const shape=['1111111','1000001','1100011','1110111','1111111','1000001'];
  const get=async lines=>(await analyze(score(lines))).rows.map(r=>r.geometry.zero);
  const plain=await get(shape),moved=await get(shape.map(s=>'...'+s+'.'));
  const reflected=await get(shape.map(s=>s.split('').reverse().join('')));
  assert.equal(plain[1].area,9);assert.equal(plain[5].area,5);
  for(const other of [moved,reflected]){
    for(const k of ['area','perimeter','height','width','orientation','triangleScore','symmetryHeight'])
      assert.equal(other[1][k],plain[1][k]);
  }
  const asymmetric=(await get(['00000','01000','10001','11011']))[0];
  assert.equal(asymmetric.symmetryHeight,2);
});

test('square fill modes, including chess zero bridges and single-cell boundaries',async()=>{
  const field=score(['0011','0101']);
  const region=async(mode,bit)=>(await analyze(field,{connectivity:mode})).rows[0].geometry[bit];
  assert.equal((await region('sides','zero')).area,3);
  assert.equal((await region('corners','zero')).area,4);
  assert.equal((await region('diagonal','zero')).area,3);
  assert.equal((await region('chess0','zero')).area,3);
  assert.equal((await region('bit','zero')).perimeter,4);
  const bridges=score(['000','000']);
  assert.equal((await analyze(bridges,{connectivity:'diagonal'})).rows[0].geometry.zero.area,3);
  assert.equal((await analyze(bridges,{connectivity:'chess0'})).rows[0].geometry.zero.area,6);
  assert.equal((await analyze(score(['111','111']),{connectivity:'chess0'})).rows[0].geometry.one.area,3);
});

test('row winners agree with the existing logical fill operation on both lattices',async()=>{
  for(const diamond of [false,true]){
    const lines=['110001','011111','110010','000011','101010'];
    const raw=score(lines.map((line,y)=>[...line].map((c,x)=>diamond&&(x+y)%2?'.':c).join('')));
    const sides=diamond?[[-1,-1],[1,-1],[-1,1],[1,1]]:[[-1,0],[1,0],[0,-1],[0,1]];
    for(const mode of ['sides','corners','diagonal','chess0','bit']){
      const actual=await analyze(raw,{connectivity:mode});
      const best=raw.rows.map(()=>[null,null]);
      for(let y=0;y<raw.height;y++)for(let x=0;x<raw.width;x++){
        const bit=raw.rows[y].bits[x];
        if(bit<0)continue;
        const cells=cellArea.select({
          seed:{p:diamond?0:-1,c:x,r:y},mode,bit,topology:diamond?'diamond':'square',
          move:({p,c,r},dx,dy)=>({p,c:c+dx,r:r+dy}),
          match:({r,c})=>raw.rows[r]?.bits[c]===bit
        });
        const exterior=cells.some(({c,r})=>sides.some(([dx,dy])=>!(raw.rows[r+dy]?.bits[c+dx]>=0)));
        const id=y*raw.width+x+1,area=cells.length;
        for(const {r} of cells){
          const old=best[r][bit];
          if(old&&(bit===0&&old.exterior!==exterior?!old.exterior:old.area>=area))continue;
          best[r][bit]={id,area,exterior};
        }
      }
      for(let y=0;y<raw.height;y++){
        for(const [bit,key] of ['zero','one'].entries()){
          const g=actual.rows[y].geometry[key],expected=best[y][bit];
          assert.deepEqual(g&&{id:g.id,area:g.area,exterior:g.exterior},expected,`${diamond} ${mode} ${y} ${key}`);
        }
      }
    }
  }
});

test('missing cells, one-bit-only rows, and completely empty scores',async()=>{
  const f=await analyze(score(['..','11','..','00']));
  assert.deepEqual(f.rows[0].geometry,{zero:null,one:null});
  assert.equal(f.rows[1].geometry.zero,null);assert.equal(f.rows[3].geometry.one,null);
  assert.equal(f.rows[3].geometry.zero.area,2);
  assert.deepEqual((await analyze(score([]))).rows,[]);
});

test('reject malformed/oversized scores before allocation and abort mid-component on yield',async()=>{
  await assert.rejects(analyze({width:2048,height:16384,rows:[]}),RangeError);
  await assert.rejects(analyze({width:2,height:1,rows:[{bits:[0]}]}),RangeError);
  let abort=false,yields=0;
  const raw=score(['1'.repeat(40000)]);
  await assert.rejects(analyze(raw,{cancelled:()=>abort,yieldTask:()=>{yields++;abort=true;}}),{name:'AbortError'});
  assert.equal(yields,1);assert.equal(raw.rows[0].geometry,undefined);
});
