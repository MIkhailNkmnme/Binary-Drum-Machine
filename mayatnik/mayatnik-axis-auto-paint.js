/* Semantic connected regions touching manual axes. No pixels, field or history are changed. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikAxisAutoPaint=api;})(globalThis,function(){
 'use strict';
 const has=(mask,q)=>!!(mask[q>>>3]&(1<<(q&7))),mark=(mask,q)=>{mask[q>>>3]|=1<<(q&7);};
 function abort(){const e=Error('Кадр или ось изменились — автоматическая заливка отменена');e.name='AbortError';return e;}
 async function select({size,bitAt,sides,corners,seeds,bit,mode='sides'},options={}){
  if(bit!==0&&bit!==1||!Number.isSafeInteger(size)||size<0||size>0xffffffff)throw Error('Некорректная область оси');
  if(!['sides','corners','diagonal','chess0','bit'].includes(mode))throw Error('Некорректное соседство заливки');
  const mask=new Uint8Array(Math.ceil(size/8)),seen=new Uint8Array(mask.length),queue=new Uint32Array(size),cancelled=options.cancelled||(()=>false),now=options.now||(()=>performance.now()),yieldTask=options.yieldTask||(()=>new Promise(r=>setTimeout(r,0))),budget=options.budgetMs??8;
  let head=0,tail=0,steps=0,start=now(),yields=0;const check=()=>{if(cancelled())throw abort();};
  const put=q=>{if(Number.isInteger(q)&&q>=0&&q<size&&!has(seen,q)){mark(seen,q);if(bitAt(q)===bit){mark(mask,q);queue[tail++]=q;}}};
  const chain=q=>{let yes=false;corners(q,j=>{if(bitAt(j)===bit)yes=true;});return yes;};check();
  for(const seed of seeds||[]){put(seed);if(++steps>=8192){steps=0;check();if(now()-start>=budget){await yieldTask();yields++;check();start=now();}}}
  while(head<tail){const q=queue[head++];if(mode!=='bit'){
    if(mode==='sides'||mode==='corners')sides(q,put);
    if(mode!=='sides')corners(q,put);
    if(mode==='chess0'&&bit===0&&chain(q))sides(q,j=>{if(chain(j))put(j);});
   }
   if(++steps>=8192){steps=0;check();if(now()-start>=budget){await yieldTask();yields++;check();start=now();}}
  }
  check();return {mask,count:tail,size,bit,yields};
 }
 function grid(field,options={}){
  const {width:w,height:h,data}=field,n=w*h;if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1||!data||data.length!==n)throw Error('Неверный размер клеток оси');
  const diamond=options.topology==='diamond',sides=diamond?[[-1,-1],[1,-1],[-1,1],[1,1]]:[[-1,0],[1,0],[0,-1],[0,1]],corners=diamond?[[-2,0],[2,0],[0,-2],[0,2]]:[[-1,-1],[1,-1],[-1,1],[1,1]];
  const neighbours=steps=>(q,visit)=>{const x=q%w,y=Math.floor(q/w);for(const [dx,dy]of steps){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<h)visit(yy*w+xx);}};
  return select({size:n,bitAt:q=>data[q],sides:neighbours(sides),corners:neighbours(corners),...options},options);
 }
 function graph(graph,options={}){
  if(!Array.isArray(graph.nodes))throw Error('Нет точного графа клеток оси');
  return select({size:graph.nodes.length,bitAt:q=>graph.nodes[q]?.bit,sides:(q,visit)=>{for(const j of graph.nodes[q].edges||[])visit(j);},corners:(q,visit)=>{for(const j of graph.nodes[q].corners||[])visit(j);},...options},options);
 }
 return {grid,graph,has,abort};
});
