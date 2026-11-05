(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./xor-space.js'):root.XorAxesSpace);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.XorAxesSequence=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Space){
 'use strict';
 const directions=['+X','+Y','+Z','-X','-Y','-Z'];
 const orientations=directions.flatMap(direction=>Array.from({length:4},(_,roll)=>({direction,roll})));
 const encode=digits=>digits.reduce((code,n,i)=>code+n*24**i,0);
 const decode=code=>[0,1,2,3].map(i=>Math.floor(code/24**i)%24);
 const key=p=>p.join(',');
 function prepare(source,assignments){
  const input={...source,mode:'union',selected:null},base=Space.buildModel(input,assignments),anchors=base.figures.map(f=>f.anchor.slice());
  const choices=anchors.map((anchor,id)=>orientations.map(rotation=>{
   const trial=assignments.map(a=>({...a,offset:(a.offset||[0,0,0]).slice()}));trial[id]={...rotation,offset:[0,0,0]};
   const natural=Space.buildModel(input,trial).figures[id].anchor;
   trial[id].offset=anchor.map((v,i)=>v-natural[i]);
   const figure=Space.buildModel(input,trial).figures[id];
   return {assignment:trial[id],body:new Set(figure.cells.map(key)),centre:key(anchor)};
  }));
  const starts=base.figures.map(f=>orientations.findIndex(o=>o.direction===f.direction&&o.roll===f.roll));
  return {choices,anchors,starts};
 }
 function compatible(a,b,allowSharedCentres){
  if(!allowSharedCentres&&a.centre===b.centre)return false;
  if(a.body.has(b.centre)||b.body.has(a.centre))return false;
  for(const p of a.body)if(b.body.has(p))return false;
  return true;
 }
 function enumerate(source,assignments,{allowSharedCentres=false}={}){
  const prepared=prepare(source,assignments),{choices,starts}=prepared,pairs=Array.from({length:4},()=>[]);
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
   const table=new Uint8Array(576);for(let a=0;a<24;a++)for(let b=0;b<24;b++)table[a*24+b]=Number(compatible(choices[i][a],choices[j][b],allowSharedCentres));pairs[i][j]=table;
  }
  const result=[];
  for(let a0=0;a0<24;a0++){const a=(starts[0]+a0)%24;
   for(let b0=0;b0<24;b0++){const b=(starts[1]+b0)%24;if(!pairs[0][1][a*24+b])continue;
    for(let c0=0;c0<24;c0++){const c=(starts[2]+c0)%24;if(!pairs[0][2][a*24+c]||!pairs[1][2][b*24+c])continue;
     for(let d0=0;d0<24;d0++){const d=(starts[3]+d0)%24;if(pairs[0][3][a*24+d]&&pairs[1][3][b*24+d]&&pairs[2][3][c*24+d])result.push(encode([a,b,c,d]));}
    }
   }
  }
  return {codes:Uint32Array.from(result),total:24**4,allowSharedCentres,anchors:prepared.anchors};
 }
 function assignmentsAt(prepared,code){return decode(code).map((n,id)=>{const a=prepared.choices[id][n].assignment;return {...a,offset:a.offset.slice()};});}
 return {orientations,prepare,compatible,enumerate,assignmentsAt,encode,decode};
});
