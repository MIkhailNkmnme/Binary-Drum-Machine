/* Codex — независимый исследователь Хоррориуса, 2026-10-12.
   Reproduce the edge measurements with the same kernel as the live Mayatnik page.
   node issledovanie/horrorius-edge-study.cjs [height] [comma-separated vertex counts] */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const M=require('../mayatnik/mayatnik-core.js');

function study(n,N,D=24){
  const offsets=Array.from({length:n},(_,k)=>M.offset('pend',k));
  const lo=Math.min(...offsets),width=D-lo+1,R=Math.ceil((D-lo)/2)+2;
  assert.ok(N>R+8,'height must leave rows for comparison');
  const {W,anchor}=M.geometry('pend',n,N),f=M.field(W,N,'empty');
  const initial=Array.from({length:n+1},()=>new Uint8Array(width));
  for(let k=0;k<n;k++){
    M.cone(f,anchor+offsets[k],N);
    for(let d=lo;d<=D;d++)initial[k+1][d-lo]=Number(f.val[R*W+anchor-R+d]===1);
  }
  const advance=previous=>{
    const current=Array.from({length:n+1},()=>new Uint8Array(width));
    for(let j=1;j<=n;j++)for(let d=lo;d<=D;d++){
      const i=d-lo,a=offsets[j-1];
      current[j][i]=current[j-1][i];
      if(d>=a&&(d-a)%2===0)current[j][i]^=previous[j][i]^(i>=2?previous[j][i-2]:0);
    }
    return current;
  };
  let profile=initial,checked=0;
  for(let r=R+1;r<N;r++){
    profile=advance(profile);
    for(let d=lo;d<=D;d++){
      const got=profile[n][d-lo],want=Number(f.val[r*W+anchor-r+d]===1);
      assert.equal(got,want,`strip recurrence: n=${n}, r=${r}, d=${d}`);checked++;
    }
  }
  const edge=[];
  for(let r=0;r<N;r++){
    let distance=null;
    for(let c=-r;c<=r;c++)if(f.val[r*W+anchor+c]===0){distance=c+r;break;}
    edge.push(distance);
  }
  const from=Math.max(R,2*n),span=N-from;
  let period=null;
  for(let p=1;p<=Math.floor(span/3);p++){
    if(edge.slice(from,N-p).every((d,i)=>d===edge[from+i+p])){period=p;break;}
  }
  const halfMatches=n%2===0&&edge.slice(from,N-n/2).every((d,i)=>d===edge[from+i+n/2]);
  // One independent variable for each eligible (cone stage, diagonal).
  let variables=0;
  for(const a of offsets)for(let d=lo;d<=D;d++)if(d>=a&&(d-a)%2===0)variables++;
  const bound=2**Math.ceil(Math.log2(variables));
  profile=initial;
  const edgeCycle=[];
  for(let r=0;r<bound;r++){
    let first=null;
    for(let d=0;d<=D;d++)if(profile[n][d-lo]===0){first=d;break;}
    edgeCycle.push(first);profile=advance(profile);
  }
  for(let j=0;j<=n;j++)assert.deepEqual(profile[j],initial[j],`power-of-two period bound: n=${n}, j=${j}`);
  let exactPeriod=null;
  if(edgeCycle.every(d=>d!==null)){
    exactPeriod=bound;
    while(exactPeriod>1&&edgeCycle.every((d,i)=>d===edgeCycle[(i+exactPeriod/2)%bound]))exactPeriod/=2;
  }
  const firstHalfMismatch=n%2===0?edge.findIndex((d,r)=>r>=from&&r<N-n/2&&d!==edge[r+n/2]):-1;
  return {vertices:n,height:N,edgeFromRow:from,measuredEdgePeriod:period,nOver2Matches:halfMatches,
    halfCounterexample:firstHalfMismatch<0?null:{row:firstHalfMismatch,distance:edge[firstHalfMismatch],shiftedRow:firstHalfMismatch+n/2,shiftedDistance:edge[firstHalfMismatch+n/2]},
    provenEventualEdgePeriod:exactPeriod,edgeMaximum:exactPeriod===null?null:Math.max(...edgeCycle),
    edgeMotif:exactPeriod===null?null:edgeCycle.slice(0,exactPeriod),
    strip:{maxDistance:D,firstRow:R,variables,provenPeriodBound:bound,comparedBits:checked},
    example:edge.slice(from,from+16)};
}
if(require.main===module){
  const N=Number(process.argv[2]||1024),counts=(process.argv[3]||'8,10,12,16,24,32,40,48,64,80,96,128').split(',').map(Number);
  console.log(JSON.stringify({author:'Codex — независимый исследователь Хоррориуса',date:'2026-10-12',rule:'live MAYATNIK.cone; empty background; pendulum',results:counts.map(n=>study(n,N))},null,2));
}
module.exports={study};
