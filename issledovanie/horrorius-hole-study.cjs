/* Codex — независимый исследователь Хоррориуса, 2026-10-12.
   Measure actual all-zero inverted triangles; do not assume a visual hole is solid. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../mayatnik/Zerkalius-mayatnik.html'),'utf8');
const ctx={module:{exports:{}}};vm.runInNewContext(html.match(/\/\* ==== ЯДРО[^]*?\*\/([^]*?)\/\* ==== \/ЯДРО/)[1],ctx);
const M=ctx.module.exports;
function triangles(f,anchor){
  const {W,H,val}=f;let prev=new Uint16Array(W),row=new Uint16Array(W);
  let best={height:0,row:0,column:0},central={height:0,row:0,column:0};
  for(let r=0;r<H;r++){
    row.fill(0);
    for(let c=0;c<W;c++)if(val[r*W+c]===0){
      const h=1+Math.min(c?prev[c-1]:0,prev[c],c+1<W?prev[c+1]:0);row[c]=h;
      if(h>best.height||(h===best.height&&Math.abs(c-anchor)<Math.abs(best.column)))best={height:h,row:r,column:c-anchor};
      if(Math.abs(c-anchor)<=2&&h>central.height)central={height:h,row:r,column:c-anchor};
    }
    [prev,row]=[row,prev];
  }
  for(const t of [best,central]){t.top=t.row-t.height+1;t.width=Math.max(0,2*t.height-1);}
  return {largest:best,axis:central};
}
function run(N){
  const P=2**Math.ceil(Math.log2(N)),last=Math.ceil(P/3)+40;
  const {W,anchor}=M.geometry('pend',last,N),f=M.field(W,N,'empty'),results=[];
  let predictedLastMacro=0;
  for(let p=4;p/2<N;p*=2)predictedLastMacro=Math.max(predictedLastMacro,Math.min(2*N-p-32,(p-32)/3));
  const begin=performance.now();
  for(let n=1;n<=last;n++){
    M.cone(f,anchor+M.offset('pend',n-1),N);
    if(n===2||n===8||n%16===0||Math.abs(n-predictedLastMacro)<=40||n===last){
      const measured=triangles(f,anchor);
      const top=P/2+n/2,tip=P-1-n;
      let largestEnvelope=0,largestEnvelopeSize=null;
      for(let p=4;p/2<N;p*=2){const height=Math.max(0,Math.min(N-1,p-1-n)-(p/2+n/2)+1);if(height>largestEnvelope){largestEnvelope=height;largestEnvelopeSize=p;}}
      results.push({vertices:n,...measured,envelopeHeight:Math.max(0,Math.min(N-1,tip)-top+1),largestEnvelope,largestEnvelopeSize});
    }
  }
  return {rows:N,containingDyadicSize:P,lastVertex:last,predictedLastWidth31:predictedLastMacro,elapsedSeconds:+((performance.now()-begin)/1000).toFixed(3),results};
}
if(require.main===module){
 const counts=(process.argv[2]||'256,384,512,600,640,768,1000,1024').split(',').map(Number);
 const out={author:'Codex — независимый исследователь Хоррориуса',date:'2026-10-12',definition:'largest completely zero inverted triangle, h=1+min(three parents); empty cells excluded',results:[]};
 for(const N of counts){const result=run(N);out.results.push(result);console.error(JSON.stringify({rows:N,seconds:result.elapsedSeconds,initial:result.results[0].largest,nearThird:result.results.filter(r=>r.vertices%32===0).map(r=>[r.vertices,r.largest.height,r.axis.height])}));if(global.gc)global.gc();}
 fs.writeFileSync(path.join(__dirname,'horrorius-hole-results.json'),JSON.stringify(out,null,2)+'\n');
}
module.exports={triangles,run};
