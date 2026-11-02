/* Geometric centroid of equally sized occupied cells. 0 and 1 have equal area. */
(function(root){
  function measure(f){
    let zero=0,one=0,sx=0,sy=0;const val=f.val;
    for(let r=0;r<f.H;r++){
      let n=0,x=0;const start=r*f.W;
      for(let c=0;c<f.W;c++){
        const v=val[start+c];if(v===0||v===1){one+=v;n++;x+=c;}
      }
      sx+=x;sy+=n*r;zero+=n;
    }
    zero-=one;
    const count=zero+one;
    return {zero,one,empty:f.val.length-count,count,center:count?{x:sx/count+.5,y:sy/count+.5}:null};
  }
  // Union of displayed footprints. Transforms use canvas affine coordinates;
  // overlapping copies contribute once to the whole and once to each subcentre.
  function compose(parts){
    const views=parts.map((p,i)=>{const [a,b,c,d,e,f]=p.transform||[1,0,0,1,0,0],det=a*d-b*c;if(!det)return null;const l=p.left||0,r=p.right??p.width,points=[[l,0],[r,0],[l,p.height],[r,p.height]].map(([x,y])=>[a*x+c*y+e,b*x+d*y+f]);return {...p,id:p.id??i,a,b,c,d,e,f,det,left:l,right:r,x0:Math.floor(Math.min(...points.map(q=>q[0]))),x1:Math.ceil(Math.max(...points.map(q=>q[0]))),y0:Math.floor(Math.min(...points.map(q=>q[1]))),y1:Math.ceil(Math.max(...points.map(q=>q[1])))};}).filter(Boolean);
    if(!views.length)return {count:0,center:null,parts:[]};
    const step=views.some(p=>p.sampleStep===.5)?.5:1,weight=step*step,groups=new Map(),all={count:0,sx:0,sy:0},add=(s,x,y)=>{s.count+=weight;s.sx+=x*weight;s.sy+=y*weight;};
    const x0=Math.min(...views.map(p=>p.x0)),x1=Math.max(...views.map(p=>p.x1)),y0=Math.min(...views.map(p=>p.y0)),y1=Math.max(...views.map(p=>p.y1));
    for(let y=y0;y<y1;y+=step)for(let x=x0;x<x1;x+=step){
      const px=x+step/2,py=y+step/2;let occupied=false;
      for(const p of views){if(x<p.x0||x>=p.x1||y<p.y0||y>=p.y1)continue;const dx=px-p.e,dy=py-p.f,u=(p.d*dx-p.c*dy)/p.det,v=(-p.b*dx+p.a*dy)/p.det;if(u<p.left||u>=p.right||v<0||v>=p.height||p.contains&&!p.contains(u,v))continue;const group=p.read(Math.floor(u),Math.floor(v));if(group<0)continue;occupied=true;const id=p.id+':'+group;let s=groups.get(id);if(!s){s={id,label:p.label||'Часть',count:0,sx:0,sy:0};groups.set(id,s);}add(s,px,py);}
      if(occupied)add(all,px,py);
    }
    const result=s=>({count:s.count,center:s.count?{x:s.sx/s.count,y:s.sy/s.count}:null});
    return {...result(all),parts:[...groups.values()].map(s=>({...result(s),id:s.id,label:s.label}))};
  }
  const api={measure,compose};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MayatnikCenter=api;
})(typeof window!=='undefined'?window:globalThis);
