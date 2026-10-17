/* Exact black triangles on each checkerboard lattice. O(W*H) time, O(W) memory.
   A hole has a complete zero base bounded by ones; missing cells are not zeros.
   Coordinates stay in the original field until conversion to visible axes. */
(function(root){
  'use strict';
  function create(){
    function holes(field,opts={}){
      const {W,H,val}=field,min=Math.max(2,Math.floor(opts.minRows)||8),out=[];
      for(const sign of opts.directions||[1,-1]){
        let prev=new Int32Array(W),next=new Int32Array(W);
        for(let row=0;row<H;row++){
          const y=sign===1?row:H-1-row,offset=y*W;
          for(let x=0;x<W;x++){
            const h=val[offset+x]===0?1+Math.min(x?prev[x-1]:0,x+1<W?prev[x+1]:0):0;next[x]=h;
            if(h<min)continue;
            const baseY=y-sign*(h-1),left=x-h+1,right=x+h-1;
            if(left<2||right+2>=W)continue;
            // The whole maximal base must be an interior zero run.
            if(val[baseY*W+left-2]!==1||val[baseY*W+right+2]!==1)continue;
            const outside=baseY-sign;if(outside<0||outside>=H)continue;
            // Noise around a hole need not be a solid white perimeter. The
            // centre of the outer cap distinguishes a real base from an
            // opposite cone arbitrarily inscribed inside the same zero hole.
            if(val[outside*W+x-1]!==1||val[outside*W+x+1]!==1)continue;
            out.push(x,y,h,sign,((x-y-(opts.anchor||0))%2+2)%2);
          }
          [prev,next]=[next,prev];
        }
      }
      // A smaller opposite cone inside the same black hole is not another
      // hole. Keep distinct holes on both lattices, indexed by coarse cells.
      const candidates=Array.from({length:out.length/5},(_,i)=>out.slice(i*5,i*5+5)).sort((a,b)=>b[2]-a[2]),kept=[],grid=new Map(),cell=64;
      const inside=(t,x,y)=>{const r=(t[1]-y)*t[3];return r>=0&&r<t[2]&&Math.abs(x-t[0])<=r;};
      for(const t of candidates){const [x,y,h,sign,p]=t,base=y-sign*(h-1),key=p+':'+Math.floor(x/cell)+':'+Math.floor(y/cell);
        if((grid.get(key)||[]).some(a=>inside(a,x,y)&&inside(a,x-h+1,base)&&inside(a,x+h-1,base)))continue;
        kept.push(...t);
        for(let yy=Math.floor(Math.min(y,base)/cell);yy<=Math.floor(Math.max(y,base)/cell);yy++)for(let xx=Math.floor((x-h+1)/cell);xx<=Math.floor((x+h-1)/cell);xx++){
          const k=p+':'+xx+':'+yy;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(t);
        }
      }
      return new Int32Array(kept);
    }
    function edges(triangles,{x0=0,width=Infinity,height=Infinity,lattice=-1,gap=0}={}){
      const out=[],seen=new Set(),add=l=>{const a=l.slice(0,2).join(','),b=l.slice(2).join(','),key=a<b?a+'|'+b:b+'|'+a;
        if(!seen.has(key)){seen.add(key);out.push(l);}};
      for(let i=0;i<triangles.length;i+=5){
        const [x,y,h,sign,p]=triangles.slice(i,i+5),baseY=y-sign*(h-1),left=x-h+1,right=x+h-1;
        if(left<x0||right>=x0+width||Math.min(y,baseY)<0||Math.max(y,baseY)>=height)continue;
        if(lattice>=0&&lattice!==2&&lattice!==p)continue;
        const ox=lattice===2&&p===1?width+gap:0;
        // Sides follow the outer half-cell boundary; the horizontal axis lies
        // exactly on the top (or bottom for ▲) edge, not through the first row.
        const by=baseY+(sign===1?0:1),ay=y+(sign===1?1:0),ax=x-x0+.5+ox;
        const bx=left-x0-.5+ox,cx=right-x0+1.5+ox;
        add([bx,by,cx,by]);add([bx,by,ax,ay]);add([cx,by,ax,ay]);
      }
      return out;
    }
    return {holes,edges};
  }
  const api=create();
  api.createWorker=()=>{
    const code=`const api=(${create.toString()})();onmessage=e=>{const triangles=api.holes(e.data.field,e.data.opts);postMessage(triangles,[triangles.buffer]);};`;
    const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
    try{return new Worker(url);}finally{URL.revokeObjectURL(url);}
  };
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikTotems=api;
})(typeof globalThis==='object'?globalThis:this);
