/* Hub v0.149: exact bit-centre symmetries parallel to the manual axis. */
(() => {
  'use strict';
  const palette=['#ffc76d','#6fd9ff','#c5a0ff','#ff96b4','#a9ed79','#ffab79'],EPS=1e-7,cache=new Map();
  function analyze(rows,{angle,minPairs=2,minRows=4,pitch=Math.sqrt(3)/2}={}) {
    angle=((angle%Math.PI)+Math.PI)%Math.PI;
    minPairs=Math.max(1,Math.round(minPairs));minRows=Math.max(1,Math.round(minRows));
    const key=[angle,pitch,minPairs,minRows,rows.join('\n')].join('|');
    if(cache.has(key))return cache.get(key);
    const tx=Math.cos(angle),ty=Math.sin(angle),nx=-ty,ny=tx,points=[],stripes=[];
    rows.forEach((row,r)=>{for(let j=0;j<row.length;j++){
      const x=j-(row.length-1)/2,y=r*pitch;
      points.push({r,j,bit:row[j],u:x*tx+y*ty,v:x*nx+y*ny});
    }});
    points.sort((a,b)=>a.u-b.u||a.v-b.v);
    for(const p of points){let stripe=stripes[stripes.length-1];if(!stripe||p.u-stripe.u>EPS){stripe={u:p.u,cells:[]};stripes.push(stripe);}stripe.cells.push(p);}
    let step=Infinity;
    for(const s of stripes){s.cells.sort((a,b)=>a.v-b.v);for(let i=1;i<s.cells.length;i++){const d=s.cells[i].v-s.cells[i-1].v;if(d>EPS)step=Math.min(step,d);}}
    const segments=[],active=new Map(),finish=s=>{if(s.rows.length>=minRows)segments.push(s);};
    for(const stripe of stripes){const cells=stripe.cells,seen=new Set();
      for(let c=0;c<cells.length*2-1;c++){
        const odd=c%2===0,i=Math.floor(c/2);if(odd&&!/^[01]$/.test(cells[i].bit))continue;
        let l=odd?i-1:i,r=i+1;const v=odd?cells[i].v:(cells[i].v+cells[i+1].v)/2,pairs=[],kinds=new Set();
        while(l>=0&&r<cells.length){const a=cells[l],b=cells[r];
          if(!/^[01]$/.test(a.bit)||a.bit!==b.bit||Math.abs(a.v+b.v-2*v)>EPS)break;
          // Missing lattice cells interrupt a motif, just as empty bits do.
          if(Math.abs(cells[l+1].v-a.v-step)>EPS||Math.abs(b.v-cells[r-1].v-step)>EPS)break;
          pairs.push([[a.r,a.j],[b.r,b.j]]);kinds.add(a.bit);l--;r++;
        }
        if(pairs.length<minPairs||(minPairs>1&&kinds.size<2))continue;
        const id=Math.round(v/EPS);let s=active.get(id);
        if(!s){s={v,u0:stripe.u,u1:stripe.u,rows:[]};active.set(id,s);}
        s.u1=stripe.u;s.rows.push({u:stripe.u,pairs,center:odd?[cells[i].r,cells[i].j]:null});seen.add(id);
      }
      for(const [id,s] of active)if(!seen.has(id)){finish(s);active.delete(id);}
    }
    for(const s of active.values())finish(s);
    const owners=rows.map(row=>new Int32Array(row.length)),parents=segments.map((_,i)=>i);
    const root=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
    const visit=(s,fn)=>s.rows.forEach(row=>{row.pairs.forEach(pair=>pair.forEach(fn));if(row.center)fn(row.center);});
    segments.forEach((s,i)=>visit(s,([r,j])=>{const prev=owners[r][j]-1;if(prev>=0){const a=root(i),b=root(prev);parents[Math.max(a,b)]=Math.min(a,b);}owners[r][j]=i+1;}));
    const colors=owners.map(row=>Uint8Array.from(row,owner=>owner?root(owner-1)%palette.length+1:0));
    for(let i=0;i<segments.length;i++){const s=segments[i],pad=step===Infinity?0:Math.min(pitch,step)*.2;
      const point=u=>[2*(tx*u+nx*s.v),(ty*u+ny*s.v)/pitch];
      s.from=point(s.u0-pad);s.to=point(s.u1+pad);s.color=palette[root(i)%palette.length];
    }
    let matched=0;for(const row of colors)for(const c of row)if(c)matched++;
    const result={segments,colors,matched,minPairs,minRows,angle};cache.set(key,result);while(cache.size>4)cache.delete(cache.keys().next().value);
    return result;
  }
  const api={analyze};if(typeof module!=='undefined'&&module.exports)module.exports=api;else globalThis.HubParallelSymmetry=api;
})();
