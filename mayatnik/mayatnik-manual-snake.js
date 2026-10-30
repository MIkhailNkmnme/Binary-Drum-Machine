/* Exact downward diamond path from one selected cell, independent of automatic findings. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikManualSnake=api;})(globalThis,function createManualSnake(){
  'use strict';
  function* findSteps({width:W,height:H,val,start,text,inverse=false,reverse=false,allowed,chunkOperations=32768,maxOperations=Infinity}){
    if(!Number.isSafeInteger(W)||!Number.isSafeInteger(H)||W<1||H<1||!Number.isSafeInteger(W*H)||!val||val.length<W*H||!Number.isSafeInteger(start)||start<0||start>=W*H||typeof text!=='string'||!/^[01]+$/.test(text))throw new RangeError('Некорректные данные ручного поиска змеи.');
    if(!(chunkOperations>0)||!(maxOperations>=0))throw new RangeError('Некорректный предел ручного поиска змеи.');
    let operations=0,chunk=0;const r=Math.floor(start/W),c=start%W,n=text.length;
    const empty=reason=>({found:false,complete:true,start,n,cells:[],variant:'',reason,operations});
    if(val[start]<0||allowed&&!allowed(start,r,c))return empty('Выбранная клетка пуста или скрыта.');
    if(n>H-r)return empty('Ниже выбранной клетки недостаточно строк.');
    const invert=s=>s.replace(/[01]/g,b=>b==='1'?'0':'1'),rev=s=>s.split('').reverse().join(''),variants=[[text,'']];
    if(inverse)variants.push([invert(text),'инв']);if(reverse)variants.push([rev(text),'рев']);if(inverse&&reverse)variants.push([rev(invert(text)),'инв+рев']);
    const left=Math.max(0,c-n+1),right=Math.min(W-1,c+n-1),span=right-left+1,seen=new Set();
    for(const [word,variant]of variants){
      if(seen.has(word))continue;seen.add(word);if(val[start]!==Number(word[0]))continue;
      const viable=new Uint8Array(span*n);
      for(let i=n-1;i>=0;i--){const row=r+i,bit=Number(word[i]),lo=Math.max(0,c-i),hi=Math.min(W-1,c+i);
        for(let col=lo+((lo-c-i)&1);col<=hi;col+=2){
          if(++operations>maxOperations)return {...empty('Достигнут предел ручного поиска; результат не завершён.'),complete:false};
          if(++chunk>=chunkOperations){chunk=0;yield {operations,remainingRows:i+1,variant};}
          const q=row*W+col,j=i*span+col-left;if(val[q]!==bit||allowed&&!allowed(q,row,col))continue;
          if(i===n-1||col>left&&viable[j+span-1]||col<right&&viable[j+span+1])viable[j]=1;
        }
      }
      if(!viable[c-left])continue;
      const cells=[start];let col=c;
      for(let i=1;i<n;i++){const j=i*span+col-left;col=col>left&&viable[j-1]?col-1:col+1;cells.push((r+i)*W+col);}
      return {found:true,complete:true,start,n,cells,variant,text:word,reason:'',operations};
    }
    return empty('От выбранного бита эта строка не найдена.');
  }
  function findFrom(options){const steps=findSteps(options);let result;do{result=steps.next();}while(!result.done);return result.value;}
  function* findGraphSteps({nodes,start,text,inverse=false,reverse=false,chunkOperations=32768,maxOperations=Infinity}){
    if(!Array.isArray(nodes)||!Number.isInteger(start)||start<0||start>=nodes.length||typeof text!=='string'||!/^[01]+$/.test(text)||!(chunkOperations>0)||!(maxOperations>=0))throw new RangeError('Некорректный граф ручного поиска змеи.');
    const inv=s=>s.replace(/[01]/g,b=>b==='1'?'0':'1'),rev=s=>s.split('').reverse().join(''),variants=[[text,'']];let operations=0,chunk=0;
    if(inverse)variants.push([inv(text),'инв']);if(reverse)variants.push([rev(text),'рев']);if(inverse&&reverse)variants.push([rev(inv(text)),'инв+рев']);
    const seen=new Set(),empty=reason=>({found:false,complete:true,start,n:text.length,cells:[],variant:'',reason,operations});
    for(const [word,variant]of variants){if(seen.has(word))continue;seen.add(word);const rejected=new Set(),stack=[{q:start,i:0,next:0,edges:null}];
      while(stack.length){
        if(++operations>maxOperations)return {...empty('Достигнут предел ручного поиска; результат не завершён.'),complete:false};
        if(++chunk>=chunkOperations){chunk=0;yield {operations,variant};}
        const current=stack.at(-1),key=current.i+':'+current.q,node=nodes[current.q];
        if(rejected.has(key)){stack.pop();continue;}
        if(!node||!Number.isFinite(node.x)||!Number.isFinite(node.y)||node.bit!==Number(word[current.i])){rejected.add(key);stack.pop();continue;}
        if(current.i+1===word.length)return {found:true,complete:true,start,n:word.length,cells:stack.map(s=>s.q),variant,text:word,reason:'',operations};
        if(!current.edges)current.edges=[...new Set(node.edges||[])].filter(q=>Number.isInteger(q)&&q>=0&&q<nodes.length&&nodes[q]?.y>node.y&&nodes[q]?.x!==node.x).sort((a,b)=>nodes[a].x-nodes[b].x||a-b);
        if(current.next===current.edges.length){rejected.add(key);stack.pop();continue;}
        stack.push({q:current.edges[current.next++],i:current.i+1,next:0,edges:null});
      }
    }
    return empty('От выбранного бита эта строка не найдена.');
  }
  function findGraph(options){const steps=findGraphSteps(options);let result;do{result=steps.next();}while(!result.done);return result.value;}
  async function coneGraph(snapshot,{x,y,bit,length,cancelled=()=>false}){
    const {width:W,height:H,scale:K}=snapshot;
    const readBit=typeof snapshot.readBit==='function'?(x,y)=>snapshot.readBit(x,y):(x,y)=>snapshot.bits[y*W+x];
    const isVisible=typeof snapshot.isVisible==='function'?(x,y)=>snapshot.isVisible(x,y):(x,y)=>!!snapshot.visibleMask[y*W+x];
    if(!Number.isInteger(length)||length<1||!Number.isFinite(x)||!Number.isFinite(y)||bit!==0&&bit!==1)throw Error('Некорректное начало ручной змеи.');
    const nodes=[{x,y,bit,edges:[]}],known=new Map([[x+':'+y,0]]),depths=[0];
    const current=()=>{if(cancelled()||!snapshot.current())throw Error('Видимое поле изменилось — ручной поиск отменён.');};
    function sample(x,y){
      for(const dy of [0,-.75,.75])for(const dx of [0,-.75,.75]){
        const xx=Math.max(0,Math.min(W-1,Math.floor((x+dx)*K))),yy=Math.max(0,Math.min(H-1,Math.floor((y+dy)*K))),q=yy*W+xx;
        if(!isVisible(xx,yy))continue;const bit=readBit(xx,yy);if(bit!==0&&bit!==1)continue;const p=snapshot.cellAt(xx,yy);if(p&&p.x===x&&p.y===y)return bit;
      }return -1;
    }
    for(let id=0;id<nodes.length;id++){
      const a=nodes[id],depth=depths[id];if(depth+1>=length)continue;
      for(const dx of [-1,1]){const x=a.x+dx,y=a.y+1,key=x+':'+y;let next=known.get(key);
        if(next===undefined){const bit=sample(x,y);if(bit<0){known.set(key,-1);continue;}if(nodes.length>=250000)throw Error('Конус выбранной строки превышает безопасный бюджет точного поиска.');next=nodes.length;known.set(key,next);nodes.push({x,y,bit,edges:[]});depths.push(depth+1);}
        if(next>=0)a.edges.push(next);
      }
      if(id%4096===0){await new Promise(r=>setTimeout(r,0));current();}
    }current();
    return {nodes,start:0,pixelsFor(cells){const pixels=new Set();for(const id of cells){const a=nodes[id];for(let yy=Math.max(0,Math.floor((a.y-1)*K));yy<Math.min(H,Math.ceil((a.y+1)*K));yy++)for(let xx=Math.max(0,Math.floor((a.x-1)*K));xx<Math.min(W,Math.ceil((a.x+1)*K));xx++){const q=yy*W+xx;if(!isVisible(xx,yy))continue;const p=snapshot.cellAt(xx,yy);if(p&&p.x===a.x&&p.y===a.y)pixels.add(q);}}return Uint32Array.from(pixels);}};
  }
  function createSession(){
    let state=null,serial=0;
    return {
      choose({owner,key,start,length}){
        if(!Number.isInteger(length)||length<0)throw new RangeError('Некорректное число строк ручного поиска.');
        const same=state&&state.owner===owner&&state.key===key&&state.start===start;
        const index=same?state.index+1:0,done=index>=length;
        state={owner,key,start,index:done?Math.max(0,length-1):index,length,done,token:++serial,pending:!done,result:done&&same?state.result:null};return {...state};
      },
      complete(token,result){if(!state||state.token!==token||!state.pending)return false;state={...state,pending:false,result};return true;},
      current(){return state?{...state}:null;},
      clear(){state=null;serial++;}
    };
  }
  function createWorker(){
    const source='const api=('+createManualSnake.toString()+')();onmessage=e=>{const {id,...options}=e.data;const steps=options.nodes?api.findGraphSteps(options):api.findSteps(options);const pump=()=>{try{const step=steps.next();if(step.done)postMessage({id,result:step.value});else{postMessage({id,progress:step.value});setTimeout(pump,0);}}catch(error){postMessage({id,error:error.message});}};pump();};';
    const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));try{return new Worker(url);}finally{URL.revokeObjectURL(url);}
  }
  return {findFrom,findSteps,findGraph,findGraphSteps,coneGraph,createWorker,createSession};
});
