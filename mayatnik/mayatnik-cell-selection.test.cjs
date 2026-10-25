'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {create}=require('./mayatnik-cell-selection.js');

test('reverse drags normalize and clip; row and column selections cover the whole other axis',()=>{
  const m=create({rows:8,cols:10});
  assert.equal(m.select({r0:6,r1:-2,c0:20,c1:3}),true);
  assert.deepEqual(m.selection,{r0:0,r1:6,c0:3,c1:9,mode:'cells'});
  m.select({r0:5,r1:2,mode:'rows'});
  assert.deepEqual(m.selection,{r0:2,r1:5,c0:0,c1:9,mode:'rows'});
  m.select({c0:7,c1:4,mode:'cols'});
  assert.deepEqual(m.selection,{r0:0,r1:7,c0:4,c1:7,mode:'cols'});
  m.select({r0:12,r1:15,c0:0,c1:1});
  assert.equal(m.selection,null,'entirely outside drag must not select a border cell');
});

test('overlap and adjacency form one reversible seam; disjoint gaps stay distinct',()=>{
  const m=create({rows:20,cols:4});
  m.hideRange('rows',4,6); m.hideRange('rows',10,12);
  m.hideRange('rows',5,8); m.hideRange('rows',9,9); m.hideRange('rows',17,18);
  assert.deepEqual(m.hiddenRows,[[4,12],[17,18]]);
  assert.deepEqual(m.seams('rows'),[{from:4,to:12,at:4,count:9},{from:17,to:18,at:8,count:2}]);
  assert.equal(m.visibleRows,9);
  assert.equal(m.hideRange('rows',6,11),false);
  assert.equal(m.revealSeam('rows',4),true);
  assert.deepEqual(m.hiddenRows,[[17,18]]);
  assert.deepEqual(m.seams('rows'),[{from:17,to:18,at:17,count:2}]);
  assert.equal(m.reveal('rows',18),true);
  assert.equal(m.visibleRows,20);
});

test('visible drag across a seam maps endpoints back to original rows and columns',()=>{
  const m=create({rows:10,cols:12});
  m.hideRange('rows',2,4); m.hideRange('cols',3,7);
  m.selectVisible({r0:1,r1:3,c0:2,c1:4});
  assert.deepEqual(m.selection,{r0:1,r1:6,c0:2,c1:9,mode:'cells'});
  assert.equal(m.hide('rows'),true);
  assert.equal(m.selection,null);
  assert.deepEqual(m.hiddenRows,[[1,6]]);
  assert.equal(m.originalToVisible('rows',7),1);
  m.selectVisible({r0:2,r1:1,mode:'rows'});
  assert.deepEqual(m.selection,{r0:7,r1:8,c0:0,c1:11,mode:'rows'});
});

test('edge seams and a completely collapsed axis can always be revealed',()=>{
  const m=create({rows:3,cols:4});
  m.hideRange('rows',0,0); m.hideRange('rows',2,2);
  assert.deepEqual(m.seams('rows').map(s=>s.at),[0,1]);
  m.hideRange('rows',1,1);
  assert.equal(m.visibleRows,0);
  assert.deepEqual(m.visibleRuns('rows'),[]);
  assert.equal(m.visibleToOriginal('rows',0),-1);
  assert.equal(m.originalToVisible('rows',0),-1);
  m.selectVisible({r0:0,r1:0,c0:0,c1:1});
  assert.equal(m.selection,null);
  assert.equal(m.revealSeam('rows',0),true);
  assert.equal(m.visibleRows,3);
  m.select({c0:0,c1:3,mode:'cols'}); m.hide('cols');
  assert.equal(m.visibleCols,0);
  assert.equal(m.revealAll(),true);
  assert.equal(m.visibleCols,4);
  assert.equal(m.revealAll(),false);
});

test('run products reconstruct the compact image without changing source data',()=>{
  const m=create({rows:7,cols:9});
  const source=Array.from({length:7},(_,r)=>Array.from({length:9},(_,c)=>r*100+c));
  const before=JSON.stringify(source);
  m.hideRange('rows',1,2); m.hideRange('rows',5,5);
  m.hideRange('cols',0,1); m.hideRange('cols',4,5); m.hideRange('cols',8,8);
  const compact=Array.from({length:m.visibleRows},()=>Array(m.visibleCols));
  for(const rr of m.visibleRuns('rows')) for(const cc of m.visibleRuns('cols')){
    for(let r=0;r<rr.length;r++) for(let c=0;c<cc.length;c++){
      compact[rr.visibleStart+r][cc.visibleStart+c]=source[rr.originalStart+r][cc.originalStart+c];
    }
  }
  assert.deepEqual(compact,[[2,3,6,7],[302,303,306,307],[402,403,406,407],[602,603,606,607]]);
  assert.equal(JSON.stringify(source),before);
});

test('snapshots implement undo/redo and JSON persistence with independent ownership',()=>{
  const m=create({rows:8,cols:9});
  m.select({r0:1,r1:4,mode:'rows'});
  const before=m.serialize();
  m.hide('rows'); m.hideRange('cols',3,5);
  const after=m.serialize();
  assert.equal(m.restore(before),true);
  assert.deepEqual(m.serialize(),before);
  assert.equal(m.restore(JSON.parse(JSON.stringify(after))),true);
  assert.deepEqual(m.serialize(),after);
  assert.equal(m.restore(after),false);
  after.hiddenRows[0][0]=7;
  assert.deepEqual(m.hiddenRows,[[1,4]]);
  const getter=m.hiddenRows; getter[0][1]=99;
  const runs=m.visibleRuns('rows'); runs[0].length=999;
  const seams=m.seams('rows'); seams[0].at=99;
  assert.deepEqual(m.hiddenRows,[[1,4]]);
  assert.equal(m.visibleRuns('rows')[0].length,1);
  assert.equal(m.seams('rows')[0].at,1);
});

test('restore rejects invalid snapshots atomically and normalizes valid saved ranges',()=>{
  const m=create({rows:5,cols:6});
  m.hideRange('rows',2,3);
  const before=m.serialize();
  for(const bad of [null,{}, {...before,version:2},{...before,rows:-1},
    {...before,cols:NaN},{...before,hiddenRows:[[1,Infinity]]},
    {...before,hiddenCols:'oops'},{...before,selection:{r0:1,r1:2,c0:NaN,c1:2}}]){
    assert.equal(m.restore(bad),false);
    assert.deepEqual(m.serialize(),before);
  }
  assert.equal(m.restore({...before,hiddenRows:[[10,20],[3,1],[-4,0],[4,4]]}),true);
  assert.deepEqual(m.hiddenRows,[[0,4]]);
  assert.equal(m.visibleRows,0);
});

test('resizing clips hidden ranges and selections; regrowth does not resurrect clipped cells',()=>{
  const m=create({rows:12,cols:10});
  m.hideRange('rows',3,8); m.hideRange('cols',8,9);
  m.select({r0:2,r1:10,mode:'rows'});
  assert.equal(m.setSize(5,6),true);
  assert.deepEqual(m.hiddenRows,[[3,4]]);
  assert.deepEqual(m.hiddenCols,[]);
  assert.deepEqual(m.selection,{r0:2,r1:4,c0:0,c1:5,mode:'rows'});
  m.setSize(12,10);
  assert.deepEqual(m.hiddenRows,[[3,4]]);
  assert.equal(m.selection.c1,9,'whole row selection follows the field width');
  m.setSize(0,0);
  assert.equal(m.selection,null);
  assert.deepEqual(m.visibleRuns('rows'),[]);
  assert.equal(m.restore(m.serialize()),false);
  assert.equal(m.setSize(0,0),false);
});

test('invalid coordinates never accidentally hide or reveal a border cell',()=>{
  const m=create({rows:5,cols:5});
  for(const axis of ['rows','cols']){
    for(const invalid of [-1,5,Infinity,NaN,0.5,'1',null]){
      assert.equal(m.originalToVisible(axis,invalid),-1);
      assert.equal(m.visibleToOriginal(axis,invalid),-1);
      assert.equal(m.reveal(axis,invalid),false);
    }
    assert.equal(m.hideRange(axis,-9,-1),false);
    assert.equal(m.hideRange(axis,5,20),false);
    assert.equal(m.hideRange(axis,1.5,2),false);
  }
  assert.throws(()=>m.hide('bad'),TypeError);
  assert.throws(()=>m.setSize(-1,5),RangeError);
  assert.throws(()=>create({rows:Infinity,cols:1}),RangeError);
  assert.equal(m.clear(),false);
  assert.equal(m.hide('rows'),false);
});

test('seeded mixed hide/reveal operations agree with an independent cell-mask oracle',()=>{
  let seed=0x629d;
  const random=n=>{ seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed%n; };
  for(let trial=0;trial<24;trial++){
    const count=1+random(60), m=create({rows:count,cols:count});
    const masks={rows:Array(count).fill(false),cols:Array(count).fill(false)};
    for(let action=0;action<80;action++){
      const axis=random(2)?'rows':'cols', mask=masks[axis];
      const a=random(count),b=random(count);
      if(random(3)){
        m.hideRange(axis,a,b);
        for(let i=Math.min(a,b);i<=Math.max(a,b);i++) mask[i]=true;
      }else{
        m.reveal(axis,a);
        if(mask[a]){
          let lo=a,hi=a; while(lo>0&&mask[lo-1]) lo--; while(hi<count-1&&mask[hi+1]) hi++;
          for(let i=lo;i<=hi;i++) mask[i]=false;
        }
      }
      for(const currentAxis of ['rows','cols']){
        const visible=Array.from({length:count},(_,i)=>i).filter(i=>!masks[currentAxis][i]);
        assert.equal(currentAxis==='rows'?m.visibleRows:m.visibleCols,visible.length);
        for(let i=0;i<count;i++) assert.equal(m.originalToVisible(currentAxis,i),visible.indexOf(i));
        visible.forEach((original,index)=>{
          assert.equal(m.visibleToOriginal(currentAxis,index),original);
          assert.equal(m.originalToVisible(currentAxis,m.visibleToOriginal(currentAxis,index)),index);
        });
        assert.equal(m.visibleToOriginal(currentAxis,visible.length),-1);
      }
    }
  }
});

test('large dimensions remain interval based and preserve exact coordinate arithmetic',()=>{
  const n=2**40, m=create({rows:n,cols:n});
  m.hideRange('rows',1,n-3);
  assert.equal(m.visibleRows,3);
  assert.equal(m.visibleToOriginal('rows',1),n-2);
  assert.equal(m.originalToVisible('rows',n-1),2);
  assert.deepEqual(m.visibleRuns('rows'),[{originalStart:0,visibleStart:0,length:1},{originalStart:n-2,visibleStart:1,length:2}]);
});

test('browser UMD entry exposes the same pure API without DOM dependencies',()=>{
  const context=vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('./mayatnik-cell-selection.js'),'utf8'),context);
  assert.equal(typeof context.MayatnikCellSelection.create,'function');
  const m=context.MayatnikCellSelection.create({rows:3,cols:4});
  m.hideRange('rows',1,1);
  assert.equal(m.visibleRows,2);
  assert.equal(m.visibleToOriginal('rows',1),2);
});
