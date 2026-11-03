/* Exact shared-side graph for the known half-cell mirror lattice.
 * The caller certifies boundaries x/y in .5Z and x±y in .5Z. Each half-cell
 * square is split into four triangles; corner contact never creates an edge.
 * This is not an image-recognition or RGB-decoding fallback. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikVisibleCellGraph=api;})(globalThis,function(){
  'use strict';
  function fail(message){const e=Error(message+' Частичный граф не используется.');e.name='VisibleGeometryError';return e;}
  function abort(){const e=Error('Видимое поле изменилось — построение графа отменено');e.name='AbortError';return e;}
  async function build(snapshot,options={}){
    const {width:W,height:H,scale:K,bits,visibleMask,cellAt}=snapshot;
    if(options.geometry!=='half-grid'||snapshot.geometryExact!==true)throw fail('Нет подтверждённой геометрии границ клеток.');
    if(!Number.isInteger(K)||K<8||K%4)throw fail('Для точных зеркальных фрагментов нужен растр не меньше 8 пикселей на бит, кратный 4.');
    const side=K/2,n=W*H;
    if(!Number.isSafeInteger(W)||!Number.isSafeInteger(H)||W<1||H<1||W%side||H%side||!Number.isSafeInteger(n)||!bits||bits.length!==n||!visibleMask||visibleMask.length!==n||typeof cellAt!=='function')throw fail('Неполный снимок полуклеточной геометрии.');
    const cols=W/side,rows=H/side,atoms=cols*rows*4,maxPixels=options.maxPixels??16777216,maxNodes=options.maxNodes??250000,maxBytes=options.maxBytes??268435456;
    if(![maxPixels,maxNodes,maxBytes].every(v=>Number.isSafeInteger(v)&&v>0)||n>maxPixels||atoms>0x7ffffffe||4*n+12*atoms>maxBytes)throw fail('Точный граф превышает безопасный бюджет памяти.');
    const cancelled=options.cancelled||(()=>false),yieldTask=options.yieldTask||(()=>new Promise(r=>setTimeout(r,0))),now=options.now||(()=>performance.now()),budget=options.budgetMs??8;
    let steps=0,start=now(),yields=0;
    const check=()=>{if(cancelled()||snapshot.current&& !snapshot.current())throw abort();};
    const due=()=>{if(++steps<8192)return false;steps=0;check();return now()-start>=budget;};
    const pause=async()=>{await yieldTask();yields++;check();start=now();};check();
    const labels=[null],labelIds=new Map(),atomLabel=new Int32Array(atoms),parent=new Int32Array(atoms),owner=new Int32Array(n);owner.fill(-1);
    function labelAt(x,y,create){
      const q=y*W+x;if(!visibleMask[q]||bits[q]!==0&&bits[q]!==1)return 0;
      const p=cellAt(x,y);if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))throw fail('У видимого бита отсутствует точный центр.');
      const ix=Math.round(p.x*4),iy=Math.round(p.y*4);
      if(Math.abs(p.x*4-ix)>1e-7||Math.abs(p.y*4-iy)>1e-7)throw fail('Центр фрагмента вне подтверждённой решётки.');
      const key=ix+','+iy+','+bits[q];let id=labelIds.get(key);
      if(id==null&&create){if(labels.length>maxNodes||4*n+12*atoms+labels.length*512>maxBytes)throw fail('Точный граф превышает безопасный бюджет памяти.');id=labels.length;labels.push({x:ix/4,y:iy/4,bit:bits[q]});labelIds.set(key,id);}
      return id??-1;
    }
    // Strictly interior samples exist for every atom at K>=8, K%4===0.
    const samples=[[.5,1/6],[5/6,.5],[.5,5/6],[1/6,.5]];
    for(let ty=0;ty<rows;ty++)for(let tx=0;tx<cols;tx++)for(let t=0;t<4;t++){
      const a=(ty*cols+tx)*4+t;parent[a]=a;atomLabel[a]=labelAt(tx*side+Math.floor(samples[t][0]*side),ty*side+Math.floor(samples[t][1]*side),true);if(due())await pause();
    }
    // Verify every sampled pixel, including boundary ownership, before publishing.
    // A cut not on the certified lattice is rejected rather than rounded away.
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const q=y*W+x,label=labelAt(x,y,false),tx=Math.floor(x/side),ty=Math.floor(y/side),lx=x%side+.5,ly=y%side+.5,base=(ty*cols+tx)*4;
      const candidates=[];
      if(ly<=lx&&ly<=side-lx)candidates.push(base);
      if(lx>=ly&&lx>=side-ly)candidates.push(base+1);
      if(ly>=lx&&ly>=side-lx)candidates.push(base+2);
      if(lx<=ly&&lx<=side-ly)candidates.push(base+3);
      const a=candidates.find(a=>atomLabel[a]===label);
      if(a==null)throw fail('Граница или бит фрагмента не совпадает с точной решёткой.');
      if(label>0)owner[q]=a;if(due())await pause();
    }
    const root=a=>{let r=a;while(parent[r]!==r)r=parent[r];while(parent[a]!==a){const p=parent[a];parent[a]=r;a=p;}return r;};
    const union=(a,b)=>{if(atomLabel[a]&&atomLabel[a]===atomLabel[b]){a=root(a);b=root(b);if(a!==b)parent[Math.max(a,b)]=Math.min(a,b);}};
    function sides(tx,ty,visit){const a=(ty*cols+tx)*4;visit(a,a+1);visit(a+1,a+2);visit(a+2,a+3);visit(a+3,a);if(tx+1<cols)visit(a+1,a+7);if(ty+1<rows)visit(a+2,a+cols*4);}
    for(let ty=0;ty<rows;ty++)for(let tx=0;tx<cols;tx++){sides(tx,ty,union);if(due())await pause();}
    const nodeOf=new Int32Array(atoms);nodeOf.fill(-1);const nodes=[];
    for(let a=0;a<atoms;a++){if(atomLabel[a]){const r=root(a);if(nodeOf[r]<0){if(nodes.length>=maxNodes||4*n+12*atoms+nodes.length*512>maxBytes)throw fail('Точный граф превышает безопасный бюджет памяти.');nodeOf[r]=nodes.length;nodes.push({...labels[atomLabel[a]],edges:new Set()});}nodeOf[a]=nodeOf[r];}if(due())await pause();}
    const connect=(a,b)=>{const i=nodeOf[a],j=nodeOf[b];if(i>=0&&j>=0&&i!==j){nodes[i].edges.add(j);nodes[j].edges.add(i);}};
    for(let ty=0;ty<rows;ty++)for(let tx=0;tx<cols;tx++){sides(tx,ty,connect);if(due())await pause();}
    for(let q=0;q<n;q++){if(owner[q]>=0)owner[q]=nodeOf[owner[q]];if(due())await pause();}
    if(options.corners){
      if(4*n+12*atoms+nodes.length*512+64*atoms>maxBytes)throw fail('Точные угловые связи превышают безопасный бюджет памяти.');
      for(const node of nodes)node.corners=new Set();
      const contact=ids=>{const set=new Set(ids.filter(id=>id>=0));for(const a of set)for(const b of set)if(a!==b&&!nodes[a].edges.has(b))nodes[a].corners.add(b);};
      const at=(tx,ty,t)=>tx>=0&&tx<cols&&ty>=0&&ty<rows?nodeOf[(ty*cols+tx)*4+t]:-1;
      for(let ty=0;ty<=rows;ty++)for(let tx=0;tx<=cols;tx++){
        contact([at(tx-1,ty-1,1),at(tx-1,ty-1,2),at(tx,ty-1,2),at(tx,ty-1,3),at(tx-1,ty,0),at(tx-1,ty,1),at(tx,ty,0),at(tx,ty,3)]);
        if(tx<cols&&ty<rows)contact([0,1,2,3].map(t=>at(tx,ty,t)));
        if(due())await pause();
      }
      for(const node of nodes){node.corners=[...node.corners].sort((a,b)=>a-b);if(due())await pause();}
    }
    for(const node of nodes)node.edges=[...node.edges].sort((a,b)=>a-b);check();
    function trace(a,b,visit){
      if(!Array.isArray(a)||!Array.isArray(b)||![...a,...b].every(Number.isFinite))return;
      const original=a,delta=[b[0]-a[0],b[1]-a[1]];let lo=0,hi=1;
      for(let k=0;k<2;k++){if(Math.abs(delta[k])<1e-12){if(a[k]<0||a[k]>[W,H][k])return;continue;}const x=-a[k]/delta[k],y=([W,H][k]-a[k])/delta[k];lo=Math.max(lo,Math.min(x,y));hi=Math.min(hi,Math.max(x,y));}if(hi<=lo)return;
      a=original.map((v,k)=>v+delta[k]*lo);b=original.map((v,k)=>v+delta[k]*hi);
      const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(!len)return;
      const cuts=[0,1];
      for(const [from,to]of [[a[0],b[0]],[a[1],b[1]],[a[0]-a[1],b[0]-b[1]],[a[0]+a[1],b[0]+b[1]]]){
        if(Math.abs(to-from)<1e-9)continue;for(let v=Math.ceil(Math.min(from,to)/side);v<=Math.floor(Math.max(from,to)/side);v++){const t=(v*side-from)/(to-from);if(t>0&&t<1)cuts.push(t);}
      }
      cuts.sort((x,y)=>x-y);const seen=new Set(),epsilon=1e-7;
      const sample=(x,y)=>{if(x<0||y<0||x>=W||y>=H)return;const tx=Math.floor(x/side),ty=Math.floor(y/side),lx=x-tx*side,ly=y-ty*side,t=ly<=lx&&ly<=side-lx?0:lx>=ly&&lx>=side-ly?1:ly>=lx&&ly>=side-lx?2:3,id=nodeOf[(ty*cols+tx)*4+t];if(id>=0&&!seen.has(id)){seen.add(id);visit(id);}};
      for(let i=1;i<cuts.length;i++)if(cuts[i]-cuts[i-1]>1e-10){const t=(cuts[i]+cuts[i-1])/2,x=a[0]+dx*t,y=a[1]+dy*t;sample(x-dy/len*epsilon,y+dx/len*epsilon);sample(x+dy/len*epsilon,y-dx/len*epsilon);}
    }
    return {nodes,width:W,height:H,scale:K,rasterOwnerIds:owner,yields,trace,
      hit(x,y){return Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&y>=0&&x<W&&y<H?owner[Math.floor(y)*W+Math.floor(x)]:-1;}};
  }
  return {build,fail,abort};
});
