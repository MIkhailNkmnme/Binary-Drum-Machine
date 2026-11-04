/* Straight search lines with empty cells removed and source addresses preserved. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikCompactLines=api;})(globalThis,function(){
  'use strict';
  const directions={row:[1,0,0],col:[0,1,2],diag:[1,1,1],antidiag:[-1,1,-1]};
  function bit(value){
    if(value===0||value==='0')return 0;
    if(value===1||value==='1')return 1;
    if(value===-1||value==='-1'||value==null||typeof value==='string'&&value.trim()==='')return -1;
    return -2;
  }
  function lines({width,height,val,mode='row',allowed=()=>true,parity=null}){
    const size=width*height;
    if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||!Number.isSafeInteger(size)||size>0x7fffffff||!val||!Number.isSafeInteger(val.length)||val.length<size)throw new RangeError('Incomplete compact-search field');
    if(mode!=='all'&&!Object.prototype.hasOwnProperty.call(directions,mode))throw new RangeError('Invalid compact-search direction');
    if(typeof allowed!=='function')throw new TypeError('Compact-search allowed must be a function');
    const out=[];
    for(const family of mode==='all'?['row','col','diag','antidiag']:[mode]){
      const [dx,dy,dir]=directions[family];
      const walk=(startR,startC)=>{
        let cells=[],bits=[];
        const emit=()=>{if(cells.length)out.push({p:parity,dir,cells:Int32Array.from(cells),str:bits.join(''),n:cells.length,monotonic:true});cells=[];bits=[];};
        for(let r=startR,c=startC;r<height&&c>=0&&c<width;r+=dy,c+=dx){
          const q=r*width+c,v=bit(val[q]);
          // An unknown remains a barrier even when outside the visibility mask.
          if(v===-2){emit();continue;}
          if(v===-1||!allowed(r,c,q))continue;
          cells.push(q);bits.push(v===0?'0':'1');
        }
        emit();
      };
      if(family==='row')for(let r=0;r<height;r++)walk(r,0);
      else if(family==='col')for(let c=0;c<width;c++)walk(0,c);
      else {
        for(let c=0;c<width;c++)walk(0,c);
        for(let r=1;r<height;r++)walk(r,dx===1?0:width-1);
      }
    }
    out.sort((a,b)=>a.cells[0]-b.cells[0]);
    let offset=0;
    for(const line of out){line.b=offset;offset+=line.n+1;}
    out.all=out.map(line=>line.str+',').join('');
    out.bytes=Uint8Array.from(out.all,ch=>ch.charCodeAt(0));
    out.width=width;
    return out;
  }
  return {lines};
});
