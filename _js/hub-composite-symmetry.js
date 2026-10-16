/* Hub v0.182: symmetry of the union of source and mirror bit centres. */
(() => {
  'use strict';
  const palette=['#ffc76d','#6fd9ff','#c5a0ff','#ff96b4','#a9ed79','#ffab79'];
  const apply=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
  function scene(rows,{origin,dw,dh,transforms,axis,parallel=false}){
    const points=[],angles=parallel?[axis]:[axis];
    for(const [layer,m] of transforms.entries()){
      if(Math.abs(m[0]*m[3]-m[1]*m[2])<1e-8)continue; // An edge-on plane has no 2D motifs.
      for(let r=0;r<rows.length;r++)for(let j=0;j<rows[r].length;j++){
        const bit=rows[r][j];if(bit!=='0'&&bit!=='1')continue;
        points.push([...apply(m,origin[0]+(j-(rows[r].length-1)/2)*dw,origin[1]+r*dh/2),bit,{layer,r,j}]);
      }
      if(!parallel)for(const a of [Math.PI/6,Math.PI/2,5*Math.PI/6]){
        const x=Math.cos(a),y=Math.sin(a);angles.push(Math.atan2(m[1]*x+m[3]*y,m[0]*x+m[2]*y));
      }
    }
    return {points,angles};
  }
  function analyze(points,{angles=[Math.PI/2],minPairs=2,minRows=4,unit=1}={}){
    const eps=Math.max(1e-8,unit*1e-6),cells=[],grid=new Map(),segments=[],matched=new Map();
    // Coincident bits form a multiset: 00, 01 and 11 are different. Never XOR or discard a layer.
    for(const [x,y,bit,ref] of points){
      const ix=Math.round(x/eps),iy=Math.round(y/eps);let p;
      for(let dx=-1;dx<=1&&!p;dx++)for(let dy=-1;dy<=1&&!p;dy++)p=grid.get((ix+dx)+','+(iy+dy))?.find(q=>Math.hypot(q.x-x,q.y-y)<=eps);
      if(!p){p={x,y,zero:0,one:0,refs:[],id:cells.length};cells.push(p);const key=ix+','+iy;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(p);}
      p[bit==='1'?'one':'zero']++;if(ref)p.refs.push(ref);
    }
    for(const p of cells)p.token=p.zero+':'+p.one;
    const unique=[];
    for(let a of angles){a=((a%Math.PI)+Math.PI)%Math.PI;if(!unique.some(b=>Math.abs(Math.sin(a-b))<1e-8))unique.push(a);}
    for(const angle of unique){
      const tx=Math.cos(angle),ty=Math.sin(angle),nx=-ty,ny=tx,ordered=cells.map(p=>({...p,u:p.x*tx+p.y*ty,v:p.x*nx+p.y*ny})).sort((a,b)=>a.u-b.u||a.v-b.v),stripes=[];
      for(const p of ordered){let s=stripes.at(-1);if(!s||p.u-s.u>eps){s={u:p.u,cells:[]};stripes.push(s);}s.cells.push(p);}
      const active=new Map();
      const finish=s=>{if(s.rows>=minRows){const pad=unit*.18,color=palette[unique.indexOf(angle)%palette.length];for(const id of s.members)matched.set(id,color);segments.push({from:[tx*(s.u0-pad)+nx*s.v,ty*(s.u0-pad)+ny*s.v],to:[tx*(s.u1+pad)+nx*s.v,ty*(s.u1+pad)+ny*s.v],angle,v:s.v,rows:s.rows,pairs:s.pairs,color});}};
      for(const stripe of stripes){const arr=stripe.cells.sort((a,b)=>a.v-b.v),seen=new Set();
        for(let c=0;c<arr.length*2-1;c++){
          const odd=c%2===0,i=Math.floor(c/2),v=odd?arr[i].v:(arr[i].v+arr[i+1].v)/2;
          let l=odd?i-1:i,r=i+1,pairs=0,zeros=false,ones=false;
          while(l>=0&&r<arr.length){const a=arr[l],b=arr[r];if(a.token!==b.token||Math.abs(a.v+b.v-2*v)>eps*2)break;pairs++;zeros||=a.zero>0;ones||=a.one>0;l--;r++;}
          if(pairs<minPairs||(minPairs>1&&!(zeros&&ones)))continue;
          const bin=Math.round(v/(eps*4));let id=bin;
          for(const k of [bin-1,bin,bin+1])if(active.has(k)&&Math.abs(active.get(k).v-v)<eps*2){id=k;break;}
          let s=active.get(id);if(!s){s={v,u0:stripe.u,u1:stripe.u,rows:0,pairs:0,radius:0,members:new Set()};active.set(id,s);}
          if(!seen.has(id)){s.u1=stripe.u;s.rows++;s.pairs+=pairs;s.radius=Math.max(s.radius,Math.abs(arr[r-1].v-v));for(let k=l+1;k<r;k++)s.members.add(arr[k].id);seen.add(id);}
        }
        for(const [id,s] of active)if(!seen.has(id)&&arr.some(p=>Math.abs(p.v-s.v)<=s.radius+eps)){
          // Only rows crossing this motif interrupt it. Projected rows belonging
          // to a distant part of either grid must not reset its row count.
          finish(s);active.delete(id);
        }
      }
      for(const s of active.values())finish(s);
    }
    return {segments,cells:cells.length,matched:[...matched].map(([id,color])=>({...cells[id],color}))};
  }
  function compute(rows,geometry,options){
    const {points,angles}=scene(rows,geometry);
    const unit=geometry.dw*Math.max(...geometry.transforms.map(m=>Math.max(Math.hypot(m[0],m[1]),Math.hypot(m[2],m[3]))));
    const result=analyze(points,{...options,angles,unit}),colors=geometry.transforms.map(()=>rows.map(row=>Array(row.length).fill(null)));
    for(const cell of result.matched)for(const {layer,r,j} of cell.refs)colors[layer][r][j]=cell.color;
    return {segments:result.segments,cells:result.cells,colors,matched:result.matched.length};
  }
  const cache=new Map();let worker=null,running=null,pending=null,failed=false;
  const script=typeof document!=='undefined'?document.currentScript?.src:null;
  const remember=(key,result)=>{cache.set(key,result);while(cache.size>4)cache.delete(cache.keys().next().value);};
  function send(){if(running||!pending)return;running=pending;pending=null;worker.postMessage(running);}
  function request(key,rows,geometry,options,sync=false){
    if(cache.has(key))return cache.get(key);
    if(sync||failed||!script||typeof Worker==='undefined'){const result=compute(rows,geometry,options);remember(key,result);return result;}
    if(!worker){try{worker=new Worker(new URL('hub-composite-symmetry-worker.js?v=182',script));
      worker.onmessage=e=>{remember(e.data.key,e.data.result);running=null;window.dispatchEvent(new Event('hubcompositeready'));send();};
      worker.onerror=()=>{failed=true;worker.terminate();worker=null;running=pending=null;window.dispatchEvent(new Event('hubcompositeready'));};
    }catch(_){failed=true;return request(key,rows,geometry,options,true);}}
    if(running?.key!==key){pending={key,rows,geometry,options};send();}else pending=null;
    return null; // Never draw axes computed for an earlier orientation.
  }
  const api={scene,analyze,compute,request};if(typeof module!=='undefined'&&module.exports)module.exports=api;else globalThis.HubCompositeSymmetry=api;
})();
