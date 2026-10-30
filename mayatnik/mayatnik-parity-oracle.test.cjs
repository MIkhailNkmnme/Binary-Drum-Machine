const test=require('node:test'),assert=require('node:assert/strict');
const parity=require('../_js/grid-parity.js');

// Independent finite-list oracle: filter actual arrays, then find a neighbour.
// It deliberately does not reproduce the implementation's stride arithmetic.
function expected(settings,W,H){
  const list=n=>Array.from({length:n},(_,i)=>i);
  const levels=(values,stages)=>stages.reduce((a,s)=>a.filter((_,i)=>s[(i+1)%2?'odd':'even']!==false),values);
  const base=(axis,n)=>list(n).filter(i=>settings[axis+((i+1)%2?'Odd':'Even')]!==false);
  const rows=levels(base('rows',H),settings.rowLevels||[]),cols=new Set(levels(base('cols',W),settings.colLevels||[]));
  const sourceRow=r=>{
    if(r<0||r>=H||!rows.length)return -1;
    if(rows.includes(r))return r;
    if(settings.rowFill==='above')return rows.filter(x=>x<r).at(-1)??rows[0];
    if(settings.rowFill==='below')return rows.find(x=>x>r)??rows.at(-1);
    return -1;
  };
  const cells=Array.from({length:H},(_,r)=>new Set(levels(list(W).filter(c=>settings[(r+c)%2?'cellsOdd':'cellsEven']!==false),settings.cellLevels||[])));
  return {sourceRow,visible:(r,c)=>{const src=sourceRow(r);return src>=0&&cols.has(c)&&cells[src].has(c);}};
}

test('nested filters and both fill directions match a finite survivor-list oracle',()=>{
  let seed=258;
  const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  const settings=[];
  for(let bits=0;bits<64;bits++)for(const rowFill of ['none','above','below'])settings.push({...Object.fromEntries(['rowsEven','rowsOdd','cellsEven','cellsOdd','colsEven','colsOdd'].map((k,i)=>[k,!!(bits&(1<<i))])),rowFill});
  for(let n=0;n<800;n++){
    const s={rowFill:['none','above','below'][next()%3]};
    for(const axis of ['rows','cols','cells']){s[axis+'Even']=!!(next()&4);s[axis+'Odd']=!!(next()&8);}
    for(const key of ['rowLevels','colLevels','cellLevels'])s[key]=Array.from({length:next()%5},()=>({even:!!(next()&16),odd:!!(next()&32)}));
    settings.push(s);
  }
  for(const s of settings){
    const W=19,H=13,oracle=expected(s,W,H),model=parity.compile(s),field={W,H,val:Int8Array.from({length:W*H},(_,i)=>i%7===0?-1:i%2)},before=field.val.slice(),bits=model.materialize(field);
    for(let r=0;r<H;r++){
      assert.equal(model.sourceRow(r,H),oracle.sourceRow(r),JSON.stringify(s));
      const p=model.columns(r,H),mapped=[];if(!p.empty)for(let c=p.offset;c<W;c+=p.stride)mapped.push(c);
      assert.deepEqual(mapped,Array.from({length:W},(_,c)=>c).filter(c=>oracle.visible(r,c)));
      for(let c=0;c<W;c++){
        const visible=oracle.visible(r,c);assert.equal(model.visible(r,c,H),visible);
        assert.equal(bits[r*W+c],visible?before[oracle.sourceRow(r)*W+c]:-1);
      }
    }
    assert.deepEqual(field.val,before,'view filtering must preserve source bits');
  }
});

test('two successive even row choices leave 4, 8, 12 and copied rows retain source checkerboard',()=>{
  const filter=parity.compile({rowsOdd:false,rowLevels:[{odd:false}],cellsOdd:false,rowFill:'above'});
  assert.deepEqual(Array.from({length:12},(_,r)=>filter.sourceRow(r,12)),[3,3,3,3,3,3,3,7,7,7,7,11]);
  for(let r=0;r<12;r++)for(let c=0;c<12;c++)assert.equal(filter.visible(r,c,12),(filter.sourceRow(r,12)+c)%2===0);
});

test('empty and deep nested selections never resurrect cells',()=>{
  for(const rowFill of ['none','above','below']){
    const levels=Array.from({length:70},()=>({even:false,odd:true}));levels.push({even:false,odd:false});
    const model=parity.compile({rowFill,rowLevels:levels});
    for(let r=0;r<10;r++)assert.equal(model.sourceRow(r,10),-1);
  }
});
