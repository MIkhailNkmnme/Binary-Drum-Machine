const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function source(name){const start=html.indexOf('  function '+name+'(');if(start<0)return null;const body=html.indexOf('{',start);let depth=1,end=body+1;for(;depth&&end<html.length;end++){if(html[end]==='{')depth++;if(html[end]==='}')depth--;}assert.equal(depth,0,name);return html.slice(start,end);}
const stage=html.slice(html.indexOf('    contourBegin(px);try{'),html.indexOf('    drawPost(px,',html.indexOf('    contourBegin(px);try{')));
function fixture(lines,{main=null,op='',colour=''}={}){
 const c={VW:17,VH:64,VX:0,RK:1,f:{},geo:{anchor:8},st:{rows:64,linesOn:true,lineFamilies:{h:true,v:true,d:true},ztlMain:main!==null,ztopRow:main?.p||0,ztMir:main?.m||0,zl:structuredClone(lines),mirOp:op,mirCol:colour},rombP:()=>-1,contourTagging:false,mirBitC:[0xff000000,0xffffffff],pxFam:v=>v&1?'w':'k',pxBit:v=>v&1,mirPre(){},contourBegin(){},contourEnd(){},fixMirrorApply(){},fixLowApply(){},triTopApply(){}};
 vm.createContext(c);for(const name of ['zlFamilies','zlFamily','zlFamilyOn','zlList','manualMirrorPlan','ztMirApply','zlMirApply','gpuMirPasses','mirPut']){const text=source(name);if(text)vm.runInContext(text,c);}
 return c;
}
const tagged=c=>Uint32Array.from({length:c.VW*c.VH},(_,q)=>(0xff000000|q)>>>0);
function cpu(c,base){c.px=base.slice();vm.runInContext(stage,c);return c.px;}
const decode=(pass,anchor)=>pass[0]===3?{k:'h',p:pass[3]+(pass[2]?.5:0),m:pass[1]}:pass[0]===4?{k:'v',p:pass[2]/2-anchor,m:pass[1]}:{k:pass[2]?'d':'e',p:pass[3],m:pass[1]};

// Independent destination-first oracle: reflect cell centres across a line in
// the plane. It does not reuse the production row-pair loops or its sort helper.
function oracle(c,base,ordered){
 let result=base.slice();
 for(const axis of ordered){const before=result.slice(),a=c.geo.anchor-c.VX;
  for(let r=0;r<c.VH;r++)for(let col=0;col<c.VW;col++){
   const x=col+.5,y=r+.5;let sx,sy,side;
   if(axis.k==='h'){side=y-axis.p;sx=x;sy=2*axis.p-y;}
   else if(axis.k==='v'){const line=a+axis.p+.5;side=x-line;sx=2*line-x;sy=y;}
   else if(axis.k==='d'){const line=a+axis.p;side=-(x-y-line);sx=y+line;sy=x-line;}
   else{const line=a+axis.p+1;side=-(x+y-line);sx=line-y;sy=line-x;}
   if(!side||(axis.m===1?side<0:side>0))continue;
   const sr=sy-.5,sc=sx-.5;if(!Number.isInteger(sr)||!Number.isInteger(sc)||sr<0||sr>=c.VH||sc<0||sc>=c.VW)continue;
   const q=r*c.VW+col,value=before[sr*c.VW+sc];if(c.st.mirCol&&(value&1?'w':'k')!==c.st.mirCol)continue;
   result[q]=c.st.mirOp?(c.st.mirOp==='xor'?(value&1)^(result[q]&1):(value&1)&(result[q]&1))?0xffffffff:0xff000000:value;
  }
 }
 return result;
}
function verify(c,order,base=tagged(c)){
 const expected=oracle(c,base,order),actual=cpu(c,base),passes=Array.from(c.gpuMirPasses().out,p=>decode(p,c.geo.anchor-c.VX));
 assert.equal(actual.findIndex((v,q)=>v!==expected[q]),-1,'first differing CPU pixel');assert.deepEqual(passes,order,'GPU pass order matches the independent order');assert.equal(oracle(c,base,passes).findIndex((v,q)=>v!==expected[q]),-1,'first differing GPU-plan pixel');
 return actual;
}
const permutations=values=>values.length?values.flatMap((v,i)=>permutations(values.filter((_,j)=>i!==j)).map(rest=>[v,...rest])):[[]];

test('screenshot G2 at 29 consumes later-created G3 at 13, rather than the original row',()=>{
 const upper={k:'h',p:13,m:1},lower={k:'h',p:29,m:1},c=fixture([lower,upper],{main:{p:5,m:0}}),result=verify(c,[upper,lower]);
 assert.equal(result[35*c.VW+4],tagged(c)[3*c.VW+4],'lower reflection uses row 3 already propagated into row 22');
});
test('both directions and half-row centres are invariant under horizontal creation order',()=>{
 for(const mode of [1,2])for(const half of [0,.5]){
  const order=[9,19,29].map(p=>({k:'h',p:p+half,m:mode}));if(mode===2)order.reverse();
  for(const created of permutations(order))verify(fixture(created),order);
  for(const main of order)for(const created of permutations(order.filter(z=>z!==main)))verify(fixture(created,{main}),order);
 }
});
test('vertical and diagonal passes retain their slots and contribute to the lower reflection',()=>{
 const upper={k:'h',p:13,m:1},lower={k:'h',p:29,m:1};
 for(const between of [{k:'v',p:0,m:1},{k:'d',p:-12,m:1},{k:'e',p:24,m:2}]){
  const c=fixture([lower,between,upper]),base=tagged(c),order=[upper,between,lower];verify(c,order,base);
  const without=oracle(c,base,[upper,lower]),withBetween=oracle(c,base,order);assert.ok(withBetween.some((v,q)=>q>=29*c.VW&&v!==without[q]),'lower reflection includes the non-horizontal change');
  if(between.k!=='v'){const moved=oracle(c,base,[upper,lower,between]);assert.ok(withBetween.some((v,q)=>v!==moved[q]),'moving diagonal passes out of their slots changes the picture');}
 }
});
test('mixed horizontal directions have a deterministic downward chain then upward chain in the existing slots',()=>{
 const downA={k:'h',p:9,m:1},downB={k:'h',p:23,m:1},upA={k:'h',p:11,m:2},upB={k:'h',p:31,m:2},v={k:'v',p:0,m:2};
 verify(fixture([upA,v,downB,upB,downA]),[downA,v,downB,upB,upA]);
});
test('duplicate axes retain independent passes and copy/XOR/AND/colour filters accumulate',()=>{
 const upper={k:'h',p:13,m:1},lower={k:'h',p:29,m:1};
 for(const op of ['','xor','and'])for(const colour of ['','w','k']){
  const c=fixture([lower,upper,{...upper}],{op,colour}),base=Uint32Array.from({length:c.VW*c.VH},(_,q)=>((q*17+Math.floor(q/c.VW)*3)%11)<5?0xffffffff:0xff000000);
  verify(c,[upper,upper,lower],base);
 }
});
test('hidden families and disabled main axis are absent; planning does not rewrite saved axes',()=>{
 const upper={k:'h',p:13,m:1},lower={k:'h',p:29,m:1},vertical={k:'v',p:0,m:1},c=fixture([lower,vertical,upper],{main:{p:5,m:1}});
 c.st.ztlMain=false;c.st.lineFamilies.v=false;const before=JSON.stringify(c.st);verify(c,[upper,lower]);assert.equal(JSON.stringify(c.st),before);
 c.st.lineFamilies.h=false;verify(c,[]);c.st.linesOn=false;verify(c,[]);
});
