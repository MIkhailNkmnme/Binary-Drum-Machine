/* The scan visits frames only in an isolated, non-persistent copy of the page. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikSnakeScanHost=api;})(globalThis,function(){
  'use strict';
  async function wholeGraph(snapshot,{cells,cancelled=()=>false,yieldTask=()=>new Promise(r=>setTimeout(r,0))}={}){
    const nodes=[],known=new Map();let count=0;
    for(const cell of cells){
      if(cancelled()||!snapshot.current())throw Error('Поле изменилось — каталог отменён');
      const xx=Math.floor(cell.x*snapshot.scale),yy=Math.floor(cell.y*snapshot.scale);
      if(xx<0||yy<0||xx>=snapshot.width||yy>=snapshot.height)continue;
      const bit=snapshot.readBit?snapshot.readBit(xx,yy):snapshot.bits[yy*snapshot.width+xx],point=bit>=0?snapshot.cellAt(xx,yy):null;
      if(point&&point.x===cell.x&&point.y===cell.y&&(bit===0||bit===1)){
        const key=cell.x+':'+cell.y;if(known.has(key))throw Error('Две исходные клетки занимают один центр');known.set(key,nodes.length);nodes.push({...cell,bit,edges:[]});
      }
      if(++count%4096===0)await yieldTask();
    }
    for(let q=0;q<nodes.length;q++){const node=nodes[q];for(const dx of [-1,1]){const next=known.get((node.x+dx)+':'+(node.y+1));if(next!==undefined)node.edges.push(next);}if(q%4096===0){await yieldTask();if(cancelled()||!snapshot.current())throw Error('Поле изменилось — каталог отменён');}}
    return nodes;
  }
  const downward=nodes=>nodes.map((node,id)=>({...node,fragment:node.fragment??id,edges:(node.edges||[]).filter(q=>nodes[q].y>node.y&&nodes[q].x!==node.x)}));
  function prepareOpen(root=window){
    const token=Array.from(root.crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16)).join('-'),url=new URL(root.location.href);url.search='?chisto=1&gpu=0&snakeSandbox=1&n=8&k=0&snakeOpen='+token;url.hash='';
    const opened=root.open(url.href,'_blank');if(!opened)throw Error('Браузер заблокировал окно кадра. Разрешите всплывающие окна и нажмите «Открыть кадр» ещё раз.');return {window:opened,token,origin:url.origin};
  }
  async function deliverOpen(ticket,entry,stored,{root=window,timeout=120000}={}){
    if(!ticket?.window)throw Error('Для большого кадра нажмите «Открыть кадр» в журнале');const opened=ticket.window,deadline=Date.now()+timeout;let starting=false,outcome=null;
    while(true){if(opened.closed)throw Error('Окно кадра закрыто');if(opened.location.href!=='about:blank'&&opened.location.origin!==ticket.origin)throw Error('Адрес окна кадра изменился');
      // Keep polling in the opener while decode/restore runs in the child.
      // Closing the child can permanently abandon its openSaved Promise.
      if(!starting&&opened.maySnakeScanLocal?.ready()){starting=true;Promise.resolve().then(()=>opened.maySnakeScanLocal.openSaved(ticket.token,entry,stored,root)).then(()=>{outcome={ok:true};},error=>{outcome={error};});}
      if(outcome){if(outcome.error)throw outcome.error;return true;}
      if(Date.now()>deadline)throw Error(starting?'Окно кадра не завершило открытие':'Окно кадра не загрузилось');await new Promise(r=>root.setTimeout(r,20));
    }
  }
  function create(local,{root=window}={}){
    let child=null,cancelled=false;const pending=new Set();
    const remove=()=>{child?.remove();child=null;};
    // Child timers/workers stop when its browsing context is removed. Race in
    // the parent realm so cancellation also settles an abandoned child Promise.
    function cancellable(frame,task){
      return new Promise((resolve,reject)=>{
        let settled=false;const current=()=>!cancelled&&child===frame;
        const abort=()=>{if(settled)return;settled=true;pending.delete(abort);reject(Error('Прогон отменён'));};
        pending.add(abort);if(!current()){abort();return;}
        Promise.resolve().then(()=>{if(!current())throw Error('Прогон отменён');return task();}).then(value=>{
          if(settled){try{value?.release?.();}catch(_){}return;}
          if(!current()){try{value?.release?.();}catch(_){}abort();return;}
          settled=true;pending.delete(abort);resolve(value);
        },error=>{if(settled)return;settled=true;pending.delete(abort);reject(error);});
      });
    }
    return {
      captureRun:()=>local.captureRun(),
      async begin(job){
        remove();cancelled=false;const url=new URL(root.location.href);url.search='?chisto=1&gpu=0&snakeSandbox=1';url.hash='';
        const frame=root.document.createElement('iframe');frame.title='Изолированный расчёт кадров';frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');Object.assign(frame.style,{position:'fixed',left:'-100000px',top:'0',width:Math.max(1,root.innerWidth)+'px',height:Math.max(1,root.innerHeight)+'px',visibility:'hidden',pointerEvents:'none',border:'0'});child=frame;frame.src=url.href;root.document.body.append(frame);
        try{const deadline=Date.now()+120000;while(!frame.contentWindow?.maySnakeScanLocal?.ready()){if(cancelled||child!==frame)throw Error('Прогон отменён');if(Date.now()>deadline)throw Error('Не загрузилась изолированная страница');await new Promise(r=>root.setTimeout(r,20));}await cancellable(frame,()=>frame.contentWindow.maySnakeScanLocal.load(job));}
        catch(error){remove();throw error;}
      },
      async acquire(frame,job){if(cancelled||!child)throw Error('Прогон отменён');const owner=child,localChild=owner.contentWindow.maySnakeScanLocal;return cancellable(owner,()=>localChild.acquire(frame,job,()=>cancelled||child!==owner));},
      async end(){remove();},cancel(){cancelled=true;for(const abort of [...pending])abort();remove();}
    };
  }
  return {wholeGraph,downward,create,prepareOpen,deliverOpen};
});
