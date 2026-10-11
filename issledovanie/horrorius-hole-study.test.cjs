/* Codex — независимый исследователь Хоррориуса, 2026-10-12. */
const test=require('node:test'),assert=require('node:assert/strict'),{triangles}=require('./horrorius-hole-study.cjs');
function exhaustive(f){
 let best=0;
 for(let r=0;r<f.H;r++)for(let c=0;c<f.W;c++)for(let h=1;h<=r+1;h++){
  let valid=true;
  for(let y=r-h+1;y<=r&&valid;y++)for(let x=c-(r-y);x<=c+(r-y);x++)if(x<0||x>=f.W||f.val[y*f.W+x]!==0){valid=false;break;}
  if(valid)best=Math.max(best,h);
 }
 return best;
}
test('largest zero-triangle metric agrees with exhaustive search, excluding empty cells',()=>{
 let seed=71;
 for(let k=0;k<30;k++){
  const f={W:9,H:6,val:new Int8Array(54)};
  for(let i=0;i<f.val.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;f.val[i]=(seed%3)-1;}
  assert.equal(triangles(f,4).largest.height,exhaustive(f));
 }
});
test('a complete triangle touching the field borders is counted; a one-bit cut breaks it',()=>{
 const f={W:9,H:5,val:new Int8Array(45).fill(1)};
 for(let r=0;r<5;r++)for(let c=r;c<9-r;c++)f.val[r*9+c]=0;
 assert.equal(triangles(f,4).largest.height,5);
 f.val[2*9+4]=1;assert.ok(triangles(f,4).largest.height<5);
});
