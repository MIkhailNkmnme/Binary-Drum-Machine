/* Map single-parity and dense rows to staggered squares on the half-bit raster. */
(function(root){
  'use strict';

  function halfWidth(width,stride=2,blocks=false){
    return stride===2?width+1:2*width+(blocks?0:1);
  }

  function leftHalf(column,row,phase,stride=2,blocks=false){
    if(stride===2)return column;
    return 2*column+(blocks?0:(phase+row)&1);
  }

  function column(x,row,phase,stride=2,blocks=false){
    const parity=(phase+row)&1;
    if(stride===2)return x-((x-parity)&1);
    return Math.floor((x-(blocks?0:parity))/2);
  }

  function sample(source,width,height,phase,step,x,y,empty,stride=2,blocks=false,copy=false){
    const input=new Uint32Array(source.data.buffer,source.data.byteOffset,source.width*source.height);
    const data=new Uint8ClampedArray(width*height*4),output=new Uint32Array(data.buffer);
    const columns=new Int32Array(width),limit=halfWidth(source.width,stride,blocks);
    for(let i=0;i<width;i++)columns[i]=Math.floor((x+i+.5)/step);

    for(let j=0;j<height;j++){
      const displayRow=Math.floor((y+j+.5)/(2*step)),lower=copy&&displayRow>=source.height;
      const row=lower?2*source.height-1-displayRow:displayRow,start=j*width;
      if(row<0||row>=source.height)continue;
      for(let i=0;i<width;i++){
        const x=lower?limit-1-columns[i]:columns[i];
        if(x<0||x>=limit)continue;
        const col=column(x,row,phase,stride,blocks);
        output[start+i]=col>=0&&col<source.width?input[row*source.width+col]:empty;
      }
    }
    return data;
  }

  const api={column,halfWidth,leftHalf,sample};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikStaggeredGrid=api;
})(globalThis);
