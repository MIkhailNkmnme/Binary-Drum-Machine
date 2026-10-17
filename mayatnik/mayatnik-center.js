/* Geometric centroid of equally sized occupied cells. 0 and 1 have equal area. */
(function(root){
  function measure(f){
    let zero=0,one=0,sx=0,sy=0;
    for(let r=0;r<f.H;r++){
      let n=0,x=0;const start=r*f.W;
      for(let c=0;c<f.W;c++){
        const v=f.val[start+c];if(v!==0&&v!==1)continue;
        if(v)one++;else zero++;n++;x+=c;
      }
      sx+=x;sy+=n*r;
    }
    const count=zero+one;
    return {zero,one,empty:f.val.length-count,count,center:count?{x:sx/count+.5,y:sy/count+.5}:null};
  }
  const api={measure};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MayatnikCenter=api;
})(typeof window!=='undefined'?window:globalThis);
