/* Template masks select coordinates; only the current field supplies their sound. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MayatnikXorromTemplate=factory();})(globalThis,function(){
 'use strict';
 const MAX=16777216,pause=()=>globalThis.scheduler?.yield?.()||new Promise(resolve=>setTimeout(resolve,0));
 function dimensions(width,height){if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width*height>MAX)throw RangeError('Хорром: неверный размер маски шаблона.');}
 function normalize(mask){
  dimensions(mask?.width,mask?.height);const {width,height}=mask,rows=new Map();
  const add=(y,x0,x1)=>{if(![y,x0,x1].every(Number.isSafeInteger)||y<0||y>=height||x0<0||x1>width||x1<=x0)return;if(!rows.has(y))rows.set(y,[]);rows.get(y).push([x0,x1]);};
  if(mask.runs){for(let i=0;i+2<mask.runs.length;i+=3)add(mask.runs[i],mask.runs[i+1],mask.runs[i+2]);}
  else if(mask.indices){for(const q of mask.indices)if(Number.isSafeInteger(q)&&q>=0&&q<width*height)add(Math.floor(q/width),q%width,q%width+1);}
  const runs=[];for(const [y,spans]of [...rows].sort((a,b)=>a[0]-b[0])){spans.sort((a,b)=>a[0]-b[0]);let a=-1,b=-1;for(const [x0,x1]of spans){if(a<0){a=x0;b=x1;}else if(x0<=b)b=Math.max(b,x1);else{runs.push(y,a,b);a=x0;b=x1;}}if(a>=0)runs.push(y,a,b);}
  return {width,height,runs};
 }
 function build(parts,width,height){
  dimensions(width,height);const runs=[];
  for(const part of parts||[]){const m=part?.mask,r=part?.rect,c=part?.clip||{left:0,top:0,right:width,bottom:height};
   if(!m?.data||!Number.isSafeInteger(m.width)||!Number.isSafeInteger(m.height)||m.width<1||m.height<1||m.width*m.height>MAX||m.data.length<m.width*m.height||!r||![r.x,r.y,r.width,r.height,c.left,c.top,c.right,c.bottom].every(Number.isFinite)||r.width<=0||r.height<=0)continue;
   const x0=Math.max(0,Math.ceil(Math.max(r.x,c.left)-.5)),x1=Math.min(width,Math.ceil(Math.min(r.x+r.width,c.right)-.5)),y0=Math.max(0,Math.ceil(Math.max(r.y,c.top)-.5)),y1=Math.min(height,Math.ceil(Math.min(r.y+r.height,c.bottom)-.5));
   for(let y=y0;y<y1;y++){const my=Math.floor((y+.5-r.y)/r.height*m.height);let start=-1;for(let x=x0;x<=x1;x++){const mx=Math.floor((x+.5-r.x)/r.width*m.width),occupied=x<x1&&mx>=0&&mx<m.width&&my>=0&&my<m.height&&!!m.data[my*m.width+mx];if(occupied&&start<0)start=x;if(!occupied&&start>=0){runs.push(y,start,x);start=-1;}}}
  }
  return normalize({width,height,runs});
 }
 async function project(score,raw,options={}){
  dimensions(score?.width,score?.height);if(score.rows?.length!==score.height)throw RangeError('Хорром: неполный текущий кадр шаблона.');
  const mask=normalize(raw),check=()=>{if(options.cancelled?.()||score.current&&!score.current()){const e=Error('Чтение шаблона Хоррома отменено.');e.name='AbortError';throw e;}};check();
  const rows=new Map();for(let i=0;i<mask.runs.length;i+=3){const y=mask.runs[i];if(!rows.has(y))rows.set(y,[]);rows.get(y).push([mask.runs[i+1],mask.runs[i+2]]);}
  const contains=(x,y)=>{const spans=rows.get(y);if(!spans)return false;let lo=0,hi=spans.length-1;while(lo<=hi){const mid=(lo+hi)>>>1,s=spans[mid];if(x<s[0])hi=mid-1;else if(x>=s[1])lo=mid+1;else return true;}return false;};
  const indices=[],w=score.width,h=score.height,yieldTask=options.yieldTask||pause;let budget=32768;

  if(typeof score.nativeAt==='function'){
   const nw=score.nativeWidth;if(!Number.isSafeInteger(nw)||nw<1)throw RangeError('Хорром: нет ширины исходного поля шаблона.');
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(--budget===0){await yieldTask();check();budget=32768;}const q=score.nativeAt(x,y);if(Number.isSafeInteger(q)&&q>=0&&contains(q%nw,Math.floor(q/nw)))indices.push(y*w+x);}
  }else for(let i=0;i<mask.runs.length;i+=3){const y=mask.runs[i];if(y>=h)continue;for(let x=mask.runs[i+1];x<Math.min(w,mask.runs[i+2]);x++){if(--budget===0){await yieldTask();check();budget=32768;}indices.push(y*w+x);}}
  const bits=new Int8Array(indices.length),rgb=new Int8Array(indices.length).fill(-1),colors=new Uint32Array(8);let ones=0,total=0,representative=-1;
  for(let j=0;j<indices.length;j++){if(--budget===0){await yieldTask();check();budget=32768;}const q=indices[j],x=q%w,row=score.rows[Math.floor(q/w)];let bit=row.bits?.[x];if(bit!==0&&bit!==1)bit=-1;
   let code=-1;if(bit>=0){if(row.rgb){code=row.rgb[x];if(!Number.isInteger(code)||code<0||code>7){bit=-1;code=-1;}}else code=4*bit+(row.bits[x-1]===1?2:0)+(row.bits[x+1]===1?1:0);}
   bits[j]=bit;rgb[j]=code;if(bit>=0){ones+=bit;total++;colors[code]++;if(representative<0||Math.abs(2*j-indices.length+1)<Math.abs(2*representative-indices.length+1))representative=j;}
  }
  check();const geometry=representative>=0&&score.rows[Math.floor(indices[representative]/w)].geometry,row={bits,indices:Uint32Array.from(indices),rgb,ones,total,colors,...(geometry?{geometry}:{})};
  return {...score,width:bits.length,height:1,rows:[row],template:true};
 }
 return {normalize,build,project};
});
