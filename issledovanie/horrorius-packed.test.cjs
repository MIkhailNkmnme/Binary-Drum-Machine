/* Codex — независимый исследователь Хоррориуса, 2026-10-12. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {create}=require('./horrorius-packed.cjs');
const html=fs.readFileSync(require('node:path').join(__dirname,'../mayatnik/Zerkalius-mayatnik.html'),'utf8');
const ctx={module:{exports:{}}};vm.runInNewContext(html.match(/\/\* ==== ЯДРО[^]*?\*\/([^]*?)\/\* ==== \/ЯДРО/)[1],ctx);
const M=ctx.module.exports;
for(const N of [8,17,32,63,128])test(`packed bits match page after every vertex, including word boundaries: ${N} rows`,()=>{
 const steps=37,{W,anchor}=M.geometry('pend',steps,N),f=M.field(W,N,'empty'),packed=create(N,steps);
 assert.equal(packed.width,W);assert.equal(packed.anchor,anchor);
 for(let k=0;k<steps;k++){
  M.cone(f,anchor+M.offset('pend',k),N);assert.equal(packed.next(),true);
  for(let r=0;r<N;r++)for(let c=0;c<W;c++)assert.equal(packed.value(r,c),Number(f.val[r*W+c]===1),`k=${k},r=${r},c=${c}`);
 }
 assert.equal(packed.next(),false);assert.equal(packed.completed,steps);
});
test('complete 1024-row state at 358 vertices agrees with the page kernel',()=>{
 const N=1024,steps=358,{W,anchor}=M.geometry('pend',steps,N),f=M.field(W,N,'empty'),packed=create(N,steps);
 for(let k=0;k<steps;k++){M.cone(f,anchor+M.offset('pend',k),N);packed.next();}
 for(let r=0;r<N;r++)for(let c=0;c<W;c++)assert.equal(packed.value(r,c),Number(f.val[r*W+c]===1));
});
