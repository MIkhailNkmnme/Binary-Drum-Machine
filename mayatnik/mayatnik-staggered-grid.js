/* Each source row uses one parity. Expand its cells into squares on the half-bit raster. */
(function(root){
  'use strict';

  function column(x,row,phase){
    const parity=(phase+row)&1;
    return x-((x-parity)&1);
  }

  function sample(source,width,height,phase,step,x,y,empty){
    const input=new Uint32Array(source.data.buffer,source.data.byteOffset,source.width*source.height);
    const data=new Uint8ClampedArray(width*height*4),output=new Uint32Array(data.buffer);
    const columns=new Int32Array(width);
    for(let i=0;i<width;i++)columns[i]=Math.floor((x+i+.5)/step);

    for(let j=0;j<height;j++){
      const row=Math.floor((y+j+.5)/(2*step)),start=j*width;
      if(row<0||row>=source.height)continue;
      for(let i=0;i<width;i++){
        const col=column(columns[i],row,phase);
        if(columns[i]<0||columns[i]>source.width)continue;
        output[start+i]=col>=0&&col<source.width?input[row*source.width+col]:empty;
      }
    }
    return data;
  }

  root.MayatnikStaggeredGrid={column,sample};
})(globalThis);
