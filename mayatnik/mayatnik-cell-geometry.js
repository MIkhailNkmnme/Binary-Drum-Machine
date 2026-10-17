(function(root){
  function snap(x,y,width,height,has,radius=.5){
    const valid=(a,b)=>{
      if(a<0||b<0||a>width||b>height)return false;
      const xs=Number.isInteger(a)?[a-1,a]:[Math.floor(a)],ys=Number.isInteger(b)?[b-1,b]:[Math.floor(b)];
      return xs.some(c=>ys.some(r=>c>=0&&r>=0&&c<width&&r<height&&has(c,r)));
    };
    let best=null,dist=Infinity;
    const consider=(a,b)=>{const d=(a-x)**2+(b-y)**2;if(d<dist&&valid(a,b)){dist=d;best={x:a,y:b,kind:Number.isInteger(a)&&Number.isInteger(b)?'угол / граница':!Number.isInteger(a)&&!Number.isInteger(b)?'центр бита':'середина грани'};}};
    const a=Math.round(x*2)/2,b=Math.round(y*2)/2;consider(a,b);if(best)return best;
    // Near the silhouette, also allow a point just outside the occupied cells.
    const reach=Math.min(16,Math.max(.5,radius));
    for(let j=Math.max(0,Math.ceil((y-reach)*2));j<=Math.min(height*2,Math.floor((y+reach)*2));j++)for(let i=Math.max(0,Math.ceil((x-reach)*2));i<=Math.min(width*2,Math.floor((x+reach)*2));i++)consider(i/2,j/2);
    return dist<=reach*reach?best:null;
  }
  function distance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
  const api={snap,distance};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MayatnikCellGeometry=api;
})(typeof window!=='undefined'?window:globalThis);
