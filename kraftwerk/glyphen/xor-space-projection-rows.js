/* Text rows use the same orthographic cells as the 3D projection renderer. */
(function(root,factory){
 'use strict';
 const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./xor-space.js'):root.XorAxesSpace,node?require('./xor-space-sequence.js'):root.XorAxesSequence);
 if(node)module.exports=api;else root.XorProjectionRows=api;
})(globalThis,function(Space,Sequence){
 'use strict';
 const planes=['XY','XZ','YZ'];
 function prepare(snapshot){
  const {choices,anchors}=Sequence.prepare(snapshot.source,snapshot.assignments);
  const centres=anchors.map((p,id)=>({p,id}));
  return planes.map(plane=>{
   const neutral=Space.project({cells:[],centres},plane).centres.map(({p})=>p);
   const figures=choices.map((rotations,id)=>rotations.map(({body})=>{
    const cells=Array.from(body,key=>({p:key.split(',').map(Number),members:[id]}));
    return Space.project({cells,centres:[]},plane).cells.map(({p})=>p);
   }));
   return {plane,neutral,figures};
  });
 }
 function project(prepared,code){
  const digits=Sequence.decode(code);
  return prepared.map(({plane,neutral,figures})=>{
   let xMin=Infinity,xMax=-Infinity,yMin=Infinity,yMax=-Infinity;
   const rows=new Map();
   function place([x,y],bit){
    let row=rows.get(y);
    if(!row){row=new Map();rows.set(y,row);}
    row.set(x,bit);
    xMin=Math.min(xMin,x);xMax=Math.max(xMax,x);yMin=Math.min(yMin,y);yMax=Math.max(yMax,y);
   }
   // The player has already excluded body/body and body/centre collisions in XYZ.
   // The projected footprint is the union through depth. A grey centre wins at its screen cell.
   for(let id=0;id<4;id++)for(const p of figures[id][digits[id]])place(p,'1');
   for(const p of neutral)place(p,'C');
   const width=xMax-xMin+1,height=yMax-yMin+1;
   if(![xMin,xMax,yMin,yMax,width,height].every(Number.isSafeInteger))throw Error('Координаты проекции выходят за пределы точной целочисленной сетки.');
   return {plane,rows,xMin,xMax,yMin,yMax,width,height};
  });
 }
 function rowText(row,xMin,xMax){
  if(!row)return '0'.repeat(xMax-xMin+1);
  let text='',x=xMin;
  for(const col of [...row.keys()].sort((a,b)=>a-b)){
   text+='0'.repeat(col-x)+row.get(col);x=col+1;
  }
  return text+'0'.repeat(xMax-x+1);
 }
 function parsePattern(value){
  const pattern=value.trim().toUpperCase().replaceAll('С','C');
  if(!/^[01C]+$/.test(pattern))throw Error('Введите строку из 0, 1 и C.');
  return pattern;
 }
 function find(projection,pattern,limit){
  const {rows,xMin,xMax,yMin,yMax,width}=projection,last=xMax-pattern.length+1;
  if(last<xMin)return {count:0n,matches:[]};
  const pivot=pattern.search(/[1C]/),matches=[];
  let count=0n;
  const occupied=[...rows.keys()].sort((a,b)=>b-a);
  if(pivot>=0){
   let found=0;
   for(const y of occupied){
    const row=rows.get(y),starts=[];
    for(const [col,bit]of row){
     const x=col-pivot;
     if(bit!==pattern[pivot]||x<xMin||x>last)continue;
     let j=0;
     while(j<pattern.length&&(row.get(x+j)||'0')===pattern[j])j++;
     if(j===pattern.length){found++;if(matches.length<limit)starts.push(x);}
    }
    starts.sort((a,b)=>a-b);
    for(const x of starts){if(matches.length>=limit)break;matches.push({x,y});}
   }
   return {count:BigInt(found),matches};
  }
  function emptyRows(top,bottom){
   if(top<bottom)return;
   count+=BigInt(top-bottom+1)*BigInt(width-pattern.length+1);
   for(let y=top;y>=bottom&&matches.length<limit;y--){
    for(let x=xMin;x<=last&&matches.length<limit;x++)matches.push({x,y});
   }
  }
  let top=yMax;
  for(const y of occupied){
   if(top>y)emptyRows(top,y+1);
   let x=xMin;
   const gap=end=>{
    const n=end-x-pattern.length+1;
    if(n<=0)return;
    count+=BigInt(n);
    for(let col=x;col<x+n&&matches.length<limit;col++)matches.push({x:col,y});
   };
   for(const col of [...rows.get(y).keys()].sort((a,b)=>a-b)){gap(col);x=col+1;}
   gap(xMax+1);top=y-1;
  }
  emptyRows(top,yMin);
  return {count,matches};
 }
 return {prepare,project,rowText,parsePattern,find,planes};
});
