/* Map single-parity and dense rows to staggered squares on the half-bit raster. */
(function(root){
  'use strict';

  function halfWidth(width,stride=2,blocks=false){
    return blocks?2*Math.ceil(width/stride):stride===1?2*width+1:width+1;
  }

  function leftHalf(column,row,phase,stride=2,blocks=false){
    const parity=(phase+row)&1;
    if(blocks)return stride===1?2*column:column-parity;
    return stride===1?2*column+parity:column;
  }

  function column(x,row,phase,stride=2,blocks=false){
    const parity=(phase+row)&1;
    if(blocks)return Math.floor(x/2)*stride+(stride===2?parity:0);
    return stride===1?Math.floor((x-parity)/2):x-((x-parity)&1);
  }

  function sample(source,width,height,phase,step,x,y,empty,stride=2,blocks=false){
    const input=new Uint32Array(source.data.buffer,source.data.byteOffset,source.width*source.height);
    const data=new Uint8ClampedArray(width*height*4),output=new Uint32Array(data.buffer);
    const columns=new Int32Array(width),limit=halfWidth(source.width,stride,blocks);
    for(let i=0;i<width;i++)columns[i]=Math.floor((x+i+.5)/step);

    for(let j=0;j<height;j++){
      const row=Math.floor((y+j+.5)/(2*step)),start=j*width;
      if(row<0||row>=source.height)continue;
      for(let i=0;i<width;i++){
        const col=column(columns[i],row,phase,stride,blocks);
        if(columns[i]<0||columns[i]>=limit)continue;
        output[start+i]=col>=0&&col<source.width?input[row*source.width+col]:empty;
      }
    }
    return data;
  }

  const api={column,halfWidth,leftHalf,sample};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikStaggeredGrid=api;
})(globalThis);
