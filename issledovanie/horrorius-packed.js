/* Codex — независимый исследователь Хоррориуса, 2026-10-12.
   Independent bit-only pendulum for an empty field: 32 cells per machine word.
   Zero bits outside the cones represent empty cells; this is not a colour renderer. */
'use strict';
function offset(k){return k===0?0:k%2?-((k+1)>>1):k>>1;}
function create(rows,steps){
 if(!Number.isInteger(rows)||rows<2||!Number.isInteger(steps)||steps<1)throw new RangeError('positive integer dimensions required');
 const low=-Math.floor(steps/2),width=2*rows+steps-2,anchor=rows-1-low,stride=Math.ceil(width/32);
 const bits=new Uint32Array(stride*rows);let done=0;
 function next(){
  if(done===steps)return false;
  const a=anchor+offset(done++);
  bits[a>>>5]|=1<<(a&31);
  for(let r=1;r<rows;r++){
   const lo=a-r,hi=a+r,first=lo>>>5,last=hi>>>5,up=(r-1)*stride,base=r*stride;
   const parity=lo&1?0xaaaaaaaa:0x55555555;
   for(let w=first;w<=last;w++){
    const value=bits[up+w],left=w?bits[up+w-1]:0,right=w+1<stride?bits[up+w+1]:0;
    const parents=((value<<1)|(left>>>31))^((value>>>1)|(right<<31));
    const startMask=w===first?-1<<(lo&31):-1,endMask=w===last?-1>>>(31-(hi&31)):-1;
    bits[base+w]^=parents&parity&startMask&endMask;
   }
  }
  return true;
 }
 return {rows,width,anchor,stride,bits,next,get completed(){return done;},
  value(r,c){return r>=0&&r<rows&&c>=0&&c<width?(bits[r*stride+(c>>>5)]>>>(c&31))&1:0;}};
}
if(typeof module!=='undefined'&&module.exports)module.exports={create,offset};
