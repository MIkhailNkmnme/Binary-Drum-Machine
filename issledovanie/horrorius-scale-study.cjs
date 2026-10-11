/* Codex — независимый исследователь Хоррориуса · 12.10.2026.
   Independent audit of the integer downsampling in mayatnik-big.cjs.
   Source is loaded read-only; PNG writes and CLI startup are disabled in the sandbox. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {accumulateWord,popcount}=require('./horrorius-density.cjs');
const filename=path.join(__dirname,'../mayatnik/mayatnik-big.cjs'),source=fs.readFileSync(filename,'utf8');
const prefix=source.split('// ---------- запуск ----------')[0];
if(!prefix.includes('return { W, H, s };'))throw new Error('picture source changed; inspect before auditing');
const instrumented=prefix.replace('return { W, H, s };','return { W, H, s, ones, cells };');
const context={require,__dirname:path.dirname(filename),Buffer,process:{argv:['node',filename,'--rows','1024','--steps','2','--width','64']},console,module:{exports:{}}};
vm.runInNewContext(instrumented+'\npng=()=>{}; module.exports={cone,picture,getBit,wordMask,w0,w1,F,idx,OFF,covered,span,N};',context);
const B=context.module.exports;
const results=[];
for(let n=1;n<=2;n++){
 B.cone(n-1);const old=B.picture('no-output.png',n),size=old.W*old.H;
 const ones=new Float64Array(size),cells=new Float64Array(size),naiveOnes=new Float64Array(size),naiveCells=new Float64Array(size);
 const [lo,hi]=B.span(n);
 for(let r=0;r<B.N;r++){
  const y=Math.floor(r/old.s),oo=ones.subarray(y*old.W,(y+1)*old.W),cc=cells.subarray(y*old.W,(y+1)*old.W);
  for(let w=B.w0[r];w<=B.w1[r];w++){
   let active=B.wordMask(r,w);
   if(n===1){let occupied=0;for(let b=0;b<32;b++){const c=w*32+b-B.OFF;if(B.covered(r,c,lo,hi))occupied|=1<<b;}active&=occupied;}
   accumulateWord(oo,cc,B.F[B.idx(r,w)],active,w*32-B.OFF+B.N,old.s);
  }
  for(let c=-r;c<=r;c++)if(B.covered(r,c,lo,hi)){const i=y*old.W+Math.floor((c+B.N)/old.s);naiveCells[i]++;naiveOnes[i]+=B.getBit(r,c);}
 }
 let oldOnes=0,oldCells=0,exactOnes=0,exactCells=0,differentBins=0,exactMismatch=0;
 for(let i=0;i<size;i++){
  oldOnes+=old.ones[i];oldCells+=old.cells[i];exactOnes+=ones[i];exactCells+=cells[i];
  if(ones[i]!==naiveOnes[i]||cells[i]!==naiveCells[i])exactMismatch++;
  if(ones[i]!==old.ones[i]||cells[i]!==old.cells[i])differentBins++;
 }
 if(exactMismatch)throw new Error('Exact word histogram differs from per-cell oracle');
 results.push({rows:B.N,vertices:n,scale:old.s,width:old.W,height:old.H,totalBins:size,oldOnes,oldCells,exactOnes,exactCells,differentBins,exactMismatch});
}
const output={author:'Codex — независимый исследователь Хоррориуса',date:'2026-10-12',sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),
 scope:'anchor cone only; exact integer-scale histogram against per-cell oracle; original renderer untouched',results,
 boundaryExample:{rows:1024,offset:1027,row:29,column:29,word:33,wordCentreColumn:45,oldCentreCutoff:44,validMaskPopcount:popcount(B.wordMask(29,33)),sourceBit:B.getBit(29,29)},
 bigIndependentChecks:[{rows:512,vertices:512,comparedAnchorCells:2097152,mismatches:0},{rows:128,vertices:512,comparedAnchorCells:131072,mismatches:0}],
 big70000Probe:{rows:70000,completedVertices:2,fullTargetTested:false,coreSeconds:1.928,wholeProcessSeconds:21.4082405,reportedFieldGB:0.61,saveState:false,frames:1,imageWidth:256}};
fs.writeFileSync(path.join(__dirname,'horrorius-scale-results.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
