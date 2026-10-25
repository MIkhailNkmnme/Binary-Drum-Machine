const test=require('node:test'),assert=require('node:assert/strict'),P=require('./grid-parity.js');
test('all sixteen visibility combinations use checkerboard cells and one-based row parity',()=>{
 const keys=['cellsEven','cellsOdd','rowsEven','rowsOdd'];
 for(let mask=0;mask<16;mask++){
  const s=Object.fromEntries(keys.map((k,i)=>[k,!!(mask&(1<<i))]));
  for(let r=0;r<4;r++)for(let c=0;c<5;c++)assert.equal(P.visible(r,c,s),s[(r+c)%2?'cellsOdd':'cellsEven']&&s[r%2?'rowsEven':'rowsOdd']);
  assert.equal(P.active(s),mask!==15);
 }
 assert.equal(P.visible(0,0),true);assert.equal(P.active(),false);assert.equal(P.visible(0,0,{rowsOdd:false}),false);assert.equal(P.visible(1,1,{rowsOdd:false}),true);
 assert.equal(P.visible(-1,0),false);assert.equal(P.visible(0,.5),false);
});
