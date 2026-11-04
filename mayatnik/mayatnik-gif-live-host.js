/* One actual presentation feeds recording and optional live scale previews. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports={create:factory};else root.MayatnikGifLiveHost={create:factory};})(globalThis,function(o){
 'use strict';
 let job=null,starting=false,finishing=false,enabled=false,destroyed=false,serial=0,lastSource=null,lastOwner,lastKey,hasRecorded=false;
 const state=()=>o.state(),report=text=>o.report?.(text);
 function sync(){o.onState?.({recording:!!job||starting||finishing,starting,finishing,stack:enabled,pending:job?.pending||0});}
 function source(){try{const captured=o.capture();lastSource=captured;return captured;}catch(error){if(o.sourcePending?.()&&lastSource)return lastSource;throw error;}}
 const stack=o.Stack.create({host:o.host,fillWidth:true,heightMode:o.heightMode,onHeightMode:o.onHeightMode,method:o.method,onMethod:o.onMethod,reduce:o.reduce,mode:o.mode,base:o.base,onSequence:o.onSequence,onExport:o.onExport,stepRows:o.stepRows,onStepRows:o.onStepRows,captureSource:source,onError:error=>{enabled=false;stack.setEnabled(false);if(!job)lastSource=null;o.onStackError?.(error);report(error.message||String(error));sync();},onPaint:o.onPaint});
 function layout(){if(o.layout)stack.refreshLayout(o.layout());}
 function setStack(value){enabled=!!value;stack.setEnabled(enabled);if(!enabled&&!job)lastSource=null;layout();sync();if(enabled)o.redraw?.();return enabled;}
 function failed(error,current=job){
  if(current&&job!==current)return;
  job=null;starting=finishing=false;hasRecorded=false;if(!enabled)lastSource=null;report('Запись масштаба: '+(error?.message||String(error)));sync();o.redraw?.();
 }
 async function start(selection){
  if(destroyed)throw Error('Запись закрыта');if(job||starting||finishing)return stop();
  if(!selection?.variant?.plan||!selection?.frame)throw Error('Сначала выберите уровень в ленте Гиф-Масштаба');
  starting=true;sync();
  try{
   await o.ready?.();if(destroyed)throw Error('Запись закрыта');
   const initial=source(),s=state(),v=selection.variant;let limitReason='';
   const current=o.Record.start({width:v.plan.width,height:v.plan.height,rows:selection.frame.rows,method:v.method,delay:selection.delay||v.delay,background:o.background?.(),onProgress:info=>{
    if(job!==current)return;report('Запись масштаба: '+info.frames+' кадров · очередь '+info.pending);sync();
    if(!current.canPush&&current.pending===0){limitReason='предел кадров';stop();}else if(Number.isFinite(info.bytes)&&info.bytes+(current.pending+1)*(v.plan.width*v.plan.height*4+4096)>=128*1024*1024){limitReason='предел памяти';stop();}
   }});
   job=current;starting=false;lastOwner=s.owner;lastKey=s.key;hasRecorded=true;
   current.promise.then(result=>{
    if(job!==current)return;job=null;finishing=false;hasRecorded=false;if(!enabled)lastSource=null;
    if(limitReason)result.limitReason=limitReason;result.name='mayatnik-frames-'+result.method+'-'+result.rows+'rows.gif';o.onResult?.(result);report('Записано '+result.frames.length+' кадров · '+result.rows+' строк'+(limitReason?' · '+limitReason:'')+' · сохранение в окне GIF');sync();o.redraw?.();
   },error=>failed(error,current));
   current.push(initial,{key:s.key,frame:s.frame});report('Запись кадров на масштабе '+selection.frame.rows+' строк');sync();return true;
  }catch(error){starting=false;sync();report(error.message||String(error));throw error;}
 }
 function stop(){if(!job)return Promise.resolve(false);finishing=true;sync();report('Завершаю запись масштаба…');return job.stop();}
 function presented(){
  if(destroyed||(!enabled&&!job))return;layout();
  const s=state(),needed=job&&!finishing&&(!hasRecorded||s.owner!==lastOwner||!Object.is(s.key,lastKey));
  try{
   let captured;
   if(needed){captured=source();job.push(captured,{frame:s.frame});lastOwner=s.owner;lastKey=s.key;hasRecorded=true;}
   if(enabled){if(!captured&&!stack.inspect().busy)captured=source();stack.requestFrame(captured,{key:++serial});}
  }catch(error){if(needed){const current=job;current?.cancel();failed(error,current);}else report(error.message||String(error));}
 }
 function wait(){
  if(starting)return true;
  if(job&&!finishing&&(!job.canPush||lastSource&&job.capacity&&!job.capacity(lastSource))){if(job.pending===0)stop();return true;}
  return false;
 }
 function destroy(){destroyed=true;job?.cancel();job=null;starting=finishing=false;lastSource=null;stack.destroy();sync();}
 return {setStackZoom:value=>stack.setZoom?.(value),stackZoom:()=>stack.getZoom?.()||1,start,stop,presented,setStack,wait,layout,destroy,element:stack.element,space:()=>enabled&&!stack.element.hidden?stack.element.offsetHeight:0,needsCpu:()=>enabled||!!job||starting,inspect:()=>({recording:!!job||starting||finishing,starting,finishing,stack:enabled,pending:job?.pending||0,preview:stack.inspect()})};
});
