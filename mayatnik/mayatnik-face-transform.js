/* A permutation of an existing rectangular cell selection. Both operations
 * are involutions; only indices inside the selected bounds are returned. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikFaceTransform=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  function bounds(selection,width,height,scale=1){
    if(!selection||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||!(scale>0))return null;
    const values=[selection.c0,selection.r0,selection.c1,selection.r1];if(!values.every(Number.isInteger))return null;
    const x0=Math.max(0,Math.floor(Math.min(selection.c0,selection.c1)*scale)),y0=Math.max(0,Math.floor(Math.min(selection.r0,selection.r1)*scale));
    const x1=Math.min(width,Math.floor((Math.max(selection.c0,selection.c1)+1)*scale)),y1=Math.min(height,Math.floor((Math.max(selection.r0,selection.r1)+1)*scale));
    return x1>x0&&y1>y0?{x0,y0,x1,y1,width:x1-x0,height:y1-y0}:null;
  }
  function permutation(selection,width,height,mode,scale=1){
    if(mode!=='rotate180'&&mode!=='flipY')throw new RangeError('Unknown face transform');
    const b=bounds(selection,width,height,scale);if(!b)return null;
    const size=b.width*b.height,indices=new Uint32Array(size),source=new Uint32Array(size);
    for(let y=b.y0,n=0;y<b.y1;y++)for(let x=b.x0;x<b.x1;x++,n++){indices[n]=y*width+x;source[n]=(b.y0+b.y1-1-y)*width+(mode==='rotate180'?b.x0+b.x1-1-x:x);}
    return {bounds:b,indices,source};
  }
  function snapshot(mapping,readColour,readBit){
    if(!mapping)return null;
    const colours=Uint32Array.from(mapping.source,readColour),bits=Int8Array.from(mapping.source,readBit);
    return {indices:mapping.indices,colours,bits,bounds:mapping.bounds};
  }
  function find(layer,q){if(!layer)return -1;let lo=0,hi=layer.indices.length-1;while(lo<=hi){const mid=(lo+hi)>>>1,value=layer.indices[mid];if(value===q)return mid;if(value<q)lo=mid+1;else hi=mid-1;}return -1;}
  function merge(previous,next,width,height,readPaint,readOverride){
    if(!next)return previous;
    const old=previous&&previous.width===width&&previous.height===height?previous:null;
    let a=0,b=0,count=0;while(a<(old?.indices.length||0)||b<next.indices.length){const x=old?.indices[a]??Infinity,y=next.indices[b]??Infinity;if(x<=y)a++;if(y<=x)b++;count++;}
    const layer={width,height,indices:new Uint32Array(count),colours:new Uint32Array(count),bits:new Int8Array(count),paint:new Uint32Array(count),bitsBefore:new Int8Array(count)};
    a=b=0;for(let n=0;n<count;n++){const x=old?.indices[a]??Infinity,y=next.indices[b]??Infinity,q=Math.min(x,y),fresh=y<=x;layer.indices[n]=q;
      if(fresh){layer.colours[n]=next.colours[b];layer.bits[n]=next.bits[b];layer.paint[n]=readPaint(q)||0;layer.bitsBefore[n]=readOverride(q)??-1;}
      else for(const key of ['colours','bits','paint','bitsBefore'])layer[key][n]=old[key][a];
      if(x<=y)a++;if(y<=x)b++;
    }return layer;
  }
  function validate(layer,width,height){
    if(layer==null)return null;
    if(layer.width!==width||layer.height!==height||!(layer.indices instanceof Uint32Array))throw Error('Повреждены размеры перевёрнутого фрагмента');
    const n=layer.indices.length;for(const [key,Type]of [['colours',Uint32Array],['bits',Int8Array],['paint',Uint32Array],['bitsBefore',Int8Array]])if(!(layer[key] instanceof Type)||layer[key].length!==n)throw Error('Повреждён перевёрнутый фрагмент');
    for(let i=0;i<n;i++)if(layer.indices[i]>=width*height||(i&&layer.indices[i]<=layer.indices[i-1])||layer.bits[i]<-1||layer.bits[i]>1||layer.bitsBefore[i]<-1||layer.bitsBefore[i]>1)throw Error('Повреждены биты перевёрнутого фрагмента');
    return layer;
  }
  return {bounds,permutation,snapshot,find,merge,validate};
});
