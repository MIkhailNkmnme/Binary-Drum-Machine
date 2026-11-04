const {test}=require('node:test'),assert=require('node:assert/strict'),E=require('./mayatnik-media-edit.js');
const source=(id,duration=10)=>({id,duration,name:id+'.mp4',blob:{id},url:'blob:'+id,width:1280,height:720,hasAudio:true});
test('cut removes an arbitrary middle and joins the exact remaining source intervals',()=>{
 const p=E.create();p.add(source('a'));assert.equal(p.cut(2.125,7.875),true);
 assert.deepEqual(p.get().clips,[{sourceId:'a',start:0,end:2.125},{sourceId:'a',start:7.875,end:10}]);assert.equal(p.get().duration,4.25);
 const seam=p.locate(2.125);assert.equal(seam.index,1);assert.equal(seam.sourceTime,7.875);
 assert.equal(p.locate(4.25).sourceTime,10);assert.equal(p.locate(-1).sourceTime,0);
});
test('selection can cross several sources without adding gaps or modifying source blobs',()=>{
 const p=E.create(),a=source('a',4),b=source('b',5),c=source('c',3);p.add(a);p.add(b);p.add(c);p.cut(2,10);
 assert.deepEqual(p.get().clips,[{sourceId:'a',start:0,end:2},{sourceId:'c',start:1,end:3}]);assert.equal(p.get().duration,4);
 assert.equal(p.locate(2.5).source.blob,c.blob);assert.equal(p.locate(2.5).sourceTime,1.5);assert.equal(a.duration,4);assert.equal(b.duration,5);
 p.get().clips[0].end=100;assert.equal(p.get().clips[0].end,2);
});
test('cut at either boundary, keep, empty edits and undo/redo are complete transactions',()=>{
 const p=E.create();p.add(source('a'));p.cut(-10,2);assert.equal(p.get().clips[0].start,2);p.keep(1,4);assert.deepEqual(p.get().clips,[{sourceId:'a',start:3,end:6}]);
 p.cut(0,99);assert.equal(p.get().duration,0);assert.equal(p.locate(0),null);p.undo();assert.equal(p.get().duration,3);p.redo();assert.equal(p.get().duration,0);p.undo();p.split(1);assert.equal(p.get().canRedo,false);assert.equal(p.get().clips.length,2);
 assert.equal(p.cut(2,2),false);assert.equal(p.cut(3,2),false);
 const before=p.get();for(const [a,b]of [[2,2],[3,2],[-4,-1],[99,100]])assert.equal(p.keep(a,b),false);assert.deepEqual(p.get(),before);
});
test('clips can be split, reordered, removed and restored with the source data retained',()=>{
 const p=E.create();p.add(source('a',4));p.add(source('b',3));p.split(2);assert.deepEqual(p.get().clips.map(c=>[c.sourceId,c.start,c.end]),[['a',0,2],['a',2,4],['b',0,3]]);
 p.move(2,-1);assert.deepEqual(p.get().clips.map(c=>c.sourceId),['a','b','a']);p.remove(1);assert.equal(p.get().duration,4);p.undo();assert.equal(p.get().duration,7);
 assert.equal(p.split(0),false);assert.equal(p.move(0,-1),false);p.clear();assert.equal(p.get().sources.length,2);p.undo();assert.equal(p.get().clips.length,3);
});
test('nonfinite times and duplicate sources fail before changing the edit',()=>{
 const p=E.create();p.add(source('a'));const before=p.get();assert.throws(()=>p.add(source('a')));assert.throws(()=>p.add(source('b',NaN)));assert.throws(()=>p.cut(0,Infinity));assert.throws(()=>p.locate(NaN));assert.deepEqual(p.get(),before);
});
test('all short integer timelines agree with an independent per-time-unit cut oracle',()=>{
 for(let a=0;a<10;a++)for(let b=a;b<=10;b++){
  const clips=[{sourceId:'a',start:10,end:14},{sourceId:'b',start:20,end:26}],result=E.cut(clips,a,b),expected=[];
  for(let t=0;t<10;t++)if(t<a||t>=b)expected.push(t<4?'a:'+(10+t):'b:'+(20+t-4));
  const actual=[];for(let t=0;t<E.duration(result);t++){const q=E.locate(result,t+.5);actual.push(q.clip.sourceId+':'+Math.floor(q.sourceTime));}assert.deepEqual(actual,expected);
 }
});

test('spatial crops are per clip, undoable and retained through time edits without changing sources',()=>{
 const p=E.create(),a=source('a'),b=source('b'),rect={x:.25,y:.125,width:.5,height:.75};p.add(a);p.add(b);
 assert.equal(p.setCrop(0,rect),true);assert.equal(p.get().duration,20);assert.equal(p.get().clips[1].crop,undefined);
 rect.width=.1;assert.equal(p.get().clips[0].crop.width,.5);
 p.get().clips[0].crop.x=0;p.locate(1).clip.crop.height=.1;assert.deepEqual(p.get().clips[0].crop,{x:.25,y:.125,width:.5,height:.75});
 p.split(4);assert.deepEqual(p.get().clips.slice(0,2).map(c=>c.crop),Array(2).fill({x:.25,y:.125,width:.5,height:.75}));
 p.setCrop(1,null);assert.equal(p.get().clips[1].crop,undefined);assert.ok(p.get().clips[0].crop);p.undo();assert.ok(p.get().clips[1].crop);p.redo();assert.equal(p.get().clips[1].crop,undefined);
 p.cut(1,3);assert.deepEqual(p.get().clips.slice(0,2).map(c=>[c.start,c.end]),[[0,1],[3,4]]);assert.deepEqual(p.get().clips[0].crop,p.get().clips[1].crop);
 p.move(0,1);p.keep(0,2);assert.ok(p.get().clips.every(c=>c.crop));assert.equal(p.get().sources[0].blob,a.blob);assert.equal(a.crop,undefined);
});

test('invalid and subpixel crop rectangles leave history unchanged; full frame removes crop',()=>{
 const p=E.create();p.add(source('a'));const before=p.get();
 for(const rect of [{x:-.1,y:0,width:.5,height:1},{x:.8,y:0,width:.5,height:1},{x:0,y:0,width:0,height:1},{x:0,y:NaN,width:.5,height:.5},{x:0,y:0,width:1/2560,height:1}]){
  assert.throws(()=>p.setCrop(0,rect));assert.deepEqual(p.get(),before);
 }
 assert.equal(p.setCrop(-1,{x:0,y:0,width:1,height:1}),false);
 assert.equal(p.setCrop(0,{x:0,y:0,width:1,height:1}),false);
 assert.equal(p.setCrop(0,{x:0,y:0,width:1/1280,height:1/720}),true);
 assert.equal(p.setCrop(0,{x:0,y:0,width:1,height:1}),true);assert.equal(p.get().clips[0].crop,undefined);p.undo();assert.equal(p.get().clips[0].crop.width,1/1280);
});
