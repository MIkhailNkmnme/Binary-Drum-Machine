/* Display-only colour for an empty cell enclosed by four equal visible cells.
 * Geometry and semantic presence come from the host, never from RGB black.
 * The input pixels and bits remain untouched; new colour is never a neighbour. */
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikEmptyColours=api;
})(globalThis,function(){
  'use strict';
  function derive({pixels,width,height,columns,rows,cellAt,bitAt,protectedAt}){
    // 0: no footprint, 1: empty, 2: uniformly coloured visible bit, 3: protected/mixed.
    const state=new Uint8Array(columns*rows),colours=new Uint32Array(state.length);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const cell=cellAt(x,y);if(cell<0||state[cell]===3)continue;
      const q=y*width+x,bit=bitAt(q),colour=pixels[q];
      if(bit!==0&&bit!==1){
        if(bit!==-1||protectedAt(q)||state[cell]===2)state[cell]=3;
        else if(!state[cell])state[cell]=1;
      }else if(state[cell]===1||state[cell]===2&&colours[cell]!==colour)state[cell]=3;
      else{state[cell]=2;colours[cell]=colour;}
    }
    const fill=new Uint8Array(state.length);let count=0;
    for(let y=1;y<rows-1;y++)for(let x=1;x<columns-1;x++){
      const q=y*columns+x;if(state[q]!==1)continue;
      const n=q-columns,e=q+1,s=q+columns,w=q-1;
      if(state[n]!==2||state[e]!==2||state[s]!==2||state[w]!==2)continue;
      const colour=colours[n];if(colours[e]!==colour||colours[s]!==colour||colours[w]!==colour)continue;
      fill[q]=1;colours[q]=colour;count++;
    }
    if(!count)return null;
    const output=pixels.slice();
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const cell=cellAt(x,y);if(cell>=0&&fill[cell])output[y*width+x]=colours[cell];
    }
    return {pixels:output,filled:fill};
  }
  return {derive};
});
