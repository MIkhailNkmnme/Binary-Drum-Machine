/* Isolated semantic bits: only a shared side joins cells. Colour is a separate transaction. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikIsolatedBits=api;})(globalThis,function(){
  'use strict';
  const has=(mask,q)=>!!(mask[q>>>3]&(1<<(q&7))),mark=(mask,q)=>{mask[q>>>3]|=1<<(q&7);};
  function abort(){const error=Error('Поле изменилось — поиск одиночных битов отменён');error.name='AbortError';return error;}
  function control(options){
    const cancelled=options.cancelled||(()=>false),now=options.now||(()=>performance.now()),yieldTask=options.yieldTask||(()=>new Promise(resolve=>setTimeout(resolve,0))),budget=options.budgetMs??8;
    let started=now(),steps=0,yields=0;
    const check=()=>{if(cancelled())throw abort();};
    return {check,get yields(){return yields;},due(){if(++steps<8192)return false;steps=0;check();return now()-started>=budget;},async pause(){await yieldTask();yields++;check();started=now();}};
  }
  function length(n){if(!Number.isSafeInteger(n)||n<0||n>0xffffffff)throw Error('Неверный размер полного снимка поля');return n;}
  function bitValue(bit){if(bit!==0&&bit!==1)throw Error('Нужно выбрать бит 0 или 1');}
  // data is the entire visible semantic field, not a viewport or an RGBA raster.
  async function findGrid({width:W,height:H,data},options={}){
    const bit=options.bit,topology=options.topology||'square';bitValue(bit);
    if(!Number.isSafeInteger(W)||!Number.isSafeInteger(H)||W<1||H<1)throw Error('Неверный размер полного снимка поля');
    const n=length(W*H);if(!data||data.length!==n)throw Error('Размер полного снимка поля не совпадает');
    if(topology!=='square'&&topology!=='diamond')throw Error('Неизвестное соседство клеток');
    const mask=new Uint8Array(Math.ceil(n/8)),c=control(options);let count=0;c.check();
    for(let q=0;q<n;q++){
      if(data[q]===bit){const x=q%W,y=Math.floor(q/W);let neighbour;
        if(topology==='square')neighbour=x>0&&data[q-1]===bit||x+1<W&&data[q+1]===bit||y>0&&data[q-W]===bit||y+1<H&&data[q+W]===bit;
        else neighbour=y>0&&(x>0&&data[q-W-1]===bit||x+1<W&&data[q-W+1]===bit)||y+1<H&&(x>0&&data[q+W-1]===bit||x+1<W&&data[q+W+1]===bit);
        if(!neighbour){mark(mask,q);count++;}
      }
      if(c.due())await c.pause();
    }
    c.check();return {kind:'grid',width:W,height:H,size:n,bit,topology,mask,count,scanned:n,yields:c.yields};
  }
  // Each node is one visible cell/fragment. Edges mean a nonzero shared side,
  // never mere corner contact. A side can be listed once or in both directions.
  async function findGraph({nodes},options={}){
    bitValue(options.bit);if(!Array.isArray(nodes))throw Error('Неверный граф видимых клеток');
    const n=length(nodes.length),blocked=new Uint8Array(Math.ceil(n/8)),mask=new Uint8Array(blocked.length),c=control(options);let edges=0,count=0;c.check();
    for(let q=0;q<n;q++){
      const node=nodes[q];if(node?.bit===options.bit)for(const other of node.edges||[]){
        if(!Number.isInteger(other)||other<0||other>=n)throw Error('Ребро выходит за граф видимых клеток');
        if(other!==q&&nodes[other]?.bit===options.bit){mark(blocked,q);mark(blocked,other);}edges++;
        if(c.due())await c.pause();
      }
      if(c.due())await c.pause();
    }
    for(let q=0;q<n;q++){if(nodes[q]?.bit===options.bit&&!has(blocked,q)){mark(mask,q);count++;}if(c.due())await c.pause();}
    c.check();return {kind:'graph',size:n,bit:options.bit,mask,count,scanned:n,edges,yields:c.yields};
  }
  // The host maps graph fragments to its colour domain before this call. No
  // bits, live paint or history are mutated; publish this result once after a
  // final snapshot/revision check, so a click produces exactly one undo entry.
  async function colourDelta(selection,paint,colour,options={}){
    const n=length(selection.size);if(!selection.mask||selection.mask.length!==Math.ceil(n/8)||!paint||paint.length!==n)throw Error('Размер маски и слоя краски не совпадает');
    if(!Number.isInteger(colour)||colour<0||colour>0xffffffff)throw Error('Неверный цвет краски');
    const c=control(options);let count=0;c.check();
    for(let q=0;q<n;q++){if(has(selection.mask,q)&&paint[q]!==colour)count++;if(c.due())await c.pause();}
    const indices=new Uint32Array(count),previous=new Uint32Array(count),next=new Uint32Array(count);let i=0;
    for(let q=0;q<n;q++){if(has(selection.mask,q)&&paint[q]!==colour){indices[i]=q;previous[i]=paint[q];next[i++]=colour;}if(c.due())await c.pause();}
    c.check();return {indices,previous,next,bytes:count*12,yields:c.yields};
  }
  return {findGrid,findGraph,colourDelta,has,abort};
});
