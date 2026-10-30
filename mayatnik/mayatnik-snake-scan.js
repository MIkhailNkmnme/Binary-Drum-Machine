/* Sequential finite-frame scan. Hosts own geometry/transport; the journal owns persistence. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./mayatnik-snake-catalog.js'):root.MayatnikSnakeCatalog);if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikSnakeScan=api;})(globalThis,function(Catalog){
  'use strict';const clone=value=>structuredClone(value),yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
  function create(host,log){
    let job=null,busy=false,preparing=false,cancel=false,worker=null;const listeners=new Set();
    const publicJob=()=>{if(!job)return null;const {source,variants,...visible}=job;return clone(visible);};
    const emit=progress=>{for(const fn of listeners)try{fn({job:publicJob(),busy:busy||preparing,progress});}catch(_){}};
    const covered=(saved,frame,state)=>!!saved?.snapshot?.blob&&saved.catalog?.complete===true&&saved.catalog.frame===frame&&saved.catalog.rows?.length===state.sequence.length&&saved.catalog.rows.every((row,i)=>row.i===i&&row.text===state.sequence[i]&&typeof row.count==='string'&&/^(0|[1-9][0-9]*)$/.test(row.count));
    async function calculate(options,current){
      if(host.worker!==false&&typeof Worker!=='undefined')return new Promise((resolve,reject)=>{
        const instance=worker=Catalog.createWorker();const finish=(error,result)=>{instance.terminate();if(worker===instance)worker=null;error?reject(error):resolve(result);};
        instance.onerror=event=>finish(Error(event.message||'Ошибка Worker'));instance.onmessage=event=>{if(cancel||!current())return finish(Error('Поиск отменён или поле изменилось'));if(event.data.error)finish(Error(event.data.error));else if(event.data.result)finish(null,event.data.result);else emit(event.data.progress);};instance.postMessage({id:job.id,options});
      });
      const steps=Catalog.compileSteps({...options,cancelled:()=>cancel||!current()});let step;do{step=steps.next();if(!step.done){emit(step.value);await yieldUI();}}while(!step.done);return step.value;
    }
    async function run(){
      if(busy)throw Error('Прогон уже выполняется');busy=true;cancel=false;job.status='running';job.error='';emit();let begun=false;
      try{
        await log.putScanJob(job);begun=true;await host.begin?.(clone(job));
        while(job.next<job.total){
          if(cancel)break;const frame=job.next;let acquired;
          try{
            acquired=await host.acquire(frame,clone(job));const current=()=>acquired.current?.()!==false;
            if(cancel||!current())throw Error('Поиск отменён или поле изменилось');
            const catalog=await calculate({nodes:acquired.nodes,sequence:job.sequence,variants:job.variants,settings:job.settings,frame,geometry:acquired.geometry||'',chunkOperations:32768},current);
            if(cancel||!current()||catalog.complete!==true)throw Error('Кадр не проверен полностью');
            if(!acquired.frameSnapshot?.blob)throw Error('Нет точного сохранённого кадра');
            // The durable frame acknowledgement precedes advancing contiguous coverage.
            await log.commitScanFrame(job,catalog,acquired.frameSnapshot);
            job.next=frame+1;job.updated=Date.now();await log.putScanJob(job);emit();
          }finally{await acquired?.release?.();}
          await yieldUI();
        }
        job.status=job.next===job.total?'complete':'paused';job.complete=job.next===job.total;
      }catch(error){job.status=cancel?'paused':'error';job.complete=false;job.error=error?.message||String(error);}
      finally{
        worker?.terminate();worker=null;if(begun)try{await host.end?.(clone(job));}catch(error){job.status='error';job.complete=false;job.error=error?.message||String(error);}
        try{await log.putScanJob(job);}catch(error){job.status='error';job.complete=false;job.error='Не удалось сохранить прогресс: '+(error?.message||String(error));}busy=false;emit();
      }return clone(job);
    }
    return {
      async start(){if(busy||preparing)throw Error('Прогон уже выполняется');preparing=true;cancel=false;emit();try{const input=clone(await host.captureRun());if(!Number.isSafeInteger(input.total)||input.total<0)throw Error('Неизвестен конечный диапазон кадров');Catalog.prepare(input.sequence,input.variants);
        job={...input,version:1,id:'snake-scan:'+Date.now()+':'+Math.random().toString(36).slice(2),next:0,status:'paused',complete:false,created:Date.now()};await log.putScanJob(job);}finally{preparing=false;emit();}if(cancel){job.status='paused';job.complete=false;await log.putScanJob(job);return clone(job);}return run();},
      async resume(id){if(busy||preparing)throw Error('Прогон уже выполняется');preparing=true;cancel=false;emit();try{job=await log.getScanJob(id);if(!job||job.version!==1||!Number.isSafeInteger(job.total)||job.total<0||!Number.isSafeInteger(job.next)||job.next<0||job.next>job.total)throw Error('Некорректный сохранённый прогон');Catalog.prepare(job.sequence,job.variants);
        // A checkpoint alone is not proof: verify every preceding acknowledged frame.
        for(let frame=0;frame<job.next;frame++){const saved=await log.readScanFrame(job.id,frame);if(!covered(saved,frame,job)){job.next=frame;job.complete=false;break;}if(frame%32===0)await yieldUI();}
        }finally{preparing=false;emit();}if(cancel){job.status='paused';job.complete=false;await log.putScanJob(job);return clone(job);}return run();},
      pause(){cancel=true;emit();},get:()=>({job:publicJob(),busy:busy||preparing}),subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
      async earliest(id,row){const saved=await log.getScanJob(id);if(!saved||!Number.isSafeInteger(row)||row<0||row>=saved.sequence.length)throw Error('Нет прогона или строки');for(let frame=0;frame<saved.total;frame++){if(frame>=saved.next)return {proven:false,frame:null,reason:'Есть непроверенные кадры'};const item=await log.readScanFrame(id,frame);if(!covered(item,frame,saved))return {proven:false,frame:null,reason:'Есть непроверенные кадры'};if(item.catalog.rows[row].count!=='0')return {proven:true,frame,count:item.catalog.rows[row].count};}return {proven:true,frame:null,count:'0'};}
    };
  }
  return {create};
});
