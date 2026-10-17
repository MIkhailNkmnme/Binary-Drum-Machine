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
  function upward(a,b,box){
    if(a.y===b.y)return null;
    const p=a.y<b.y?a:b,q=a.y<b.y?b:a,dx=(p.x-q.x)/(q.y-p.y),dy=-1;
    let lo=0,hi=Infinity;
    for(const [pos,dir,min,max]of [[p.x,dx,box.left,box.right],[p.y,dy,box.top,box.bottom]]){
      if(!dir){if(pos<min||pos>max)return null;continue;}
      const t1=(min-pos)/dir,t2=(max-pos)/dir;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));
    }
    return hi>=lo?{a:{x:p.x+lo*dx,y:p.y-lo},b:{x:p.x+hi*dx,y:p.y-hi}}:null;
  }
  const api={snap,distance,upward};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MayatnikCellGeometry=api;
})(typeof window!=='undefined'?window:globalThis);
