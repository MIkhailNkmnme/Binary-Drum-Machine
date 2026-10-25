const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const A=require('./mayatnik-n-axes.js');
const base={id:'row-axis-1',row:5,left:0,center:6,right:12,n:3};
test('N defaults to three, accepts numeric controls, rounds and clamps to 1–64',()=>{
 for(const value of [undefined,null,'',false,{},NaN,Infinity,'no'])assert.equal(A.normaliseN(value),3);
 for(const [value,n]of [[0,1],[-10,1],[1,1],['4',4],[2.6,3],[65,64],[999,64]])assert.equal(A.normaliseN(value),n);
});
test('N equally subdivides both sides including exact endpoints and central axis',()=>{
 const set=A.createSet(base);assert.deepEqual(A.positions(set),[0,2,4,6,8,10,12]);assert.notEqual(set,base);
 assert.deepEqual(A.lines(set,{top:-2,bottom:15}),[0,2,4,6,8,10,12].map(x=>({x,a:[x,-2],b:[x,15]})));
 assert.deepEqual(base,{id:'row-axis-1',row:5,left:0,center:6,right:12,n:3});
});
test('asymmetric intervals and fractional centres retain their own spacing',()=>{
 const set={...base,left:-2.5,center:.5,right:6.5};assert.deepEqual(A.positions(set),[-2.5,-1.5,-.5,.5,2.5,4.5,6.5]);
 assert.deepEqual(A.positions({...set,n:1}),[-2.5,.5,6.5]);
 const xs=A.positions({...base,left:.1,center:.2,right:.7,n:64});assert.equal(xs.length,129);assert.equal(xs[0],.1);assert.equal(xs[64],.2);assert.equal(xs.at(-1),.7);assert.ok(xs.every(Number.isFinite));
});
test('one-cell and collapsed halves have no duplicate axes, without dropping tiny real intervals',()=>{
 assert.deepEqual(A.positions({...base,left:7,center:7,right:7}),[7]);
 assert.deepEqual(A.positions({...base,left:6}),[6,8,10,12]);
 assert.deepEqual(A.positions({...base,right:6}),[0,2,4,6]);
 const xs=A.positions({...base,left:0,center:1e-12,right:2e-12});assert.equal(xs.length,7);
 assert.ok(A.positions({...base,left:-1e308,center:0,right:1e308}).every(Number.isFinite));
});
test('invalid persisted geometry is rejected without coercing coordinates or mutating input',()=>{
 for(const patch of [{left:NaN},{right:Infinity},{center:'6'},{left:7},{center:13},{row:-1},{row:.5},{id:''},{id:null}]){assert.equal(A.createSet({...base,...patch}),null);assert.deepEqual(A.positions({...base,...patch}),[]);}
 assert.equal(A.createSet(null),null);assert.equal(A.createSet({...base,id:0}).id,0);
 for(const bounds of [null,{top:Infinity,bottom:2},{top:3,bottom:2}])assert.deepEqual(A.lines(base,bounds),[]);
 assert.equal(A.lines(base,{top:2,bottom:2}).length,7);
});
test('independent sets survive JSON, accept rebuilt N, and never silently cap collection size',()=>{
 const input=Array.from({length:2049},(_,i)=>({...base,id:'set-'+i,row:i,n:i%64+1})),snapshot=JSON.stringify(input);
 const restored=A.normaliseSets(JSON.parse(snapshot));assert.equal(restored.length,input.length);assert.equal(JSON.stringify(restored),snapshot);
 const rebuilt=A.createSet({...restored[0],n:4});assert.equal(A.positions(rebuilt).length,9);assert.equal(restored[0].n,1);
 assert.equal(A.normaliseSets([base,{...base},null,{...base,left:99}]).length,2,'coincident sets remain independent');assert.deepEqual(A.normaliseSets({}),[]);
});
test('same pure API exports to a standalone browser script without DOM dependencies',()=>{
 const c=vm.createContext({});vm.runInContext(fs.readFileSync(__dirname+'/mayatnik-n-axes.js','utf8'),c);
 assert.equal(c.MayatnikNAxes.normaliseN(),3);assert.deepEqual(Array.from(c.MayatnikNAxes.positions(base)),A.positions(base));
});
