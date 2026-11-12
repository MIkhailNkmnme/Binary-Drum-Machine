/* Visible status for the exact large-field search, independent of its hidden legacy list. */
(function(root){
  'use strict';
  const style=document.createElement('style');
  style.textContent=`
    #maySearchProgress{position:fixed;left:50%;bottom:8px;transform:translateX(-50%);width:min(512px,calc(100vw - 24px));box-sizing:border-box;padding:6px 8px;background:#111923;color:#ffe28a;border:1px solid #8b7438;z-index:2147483646;font:12px/16px system-ui,sans-serif;pointer-events:none;box-shadow:0 2px 12px #0009}
    #maySearchProgress[hidden]{display:none!important}
    #maySearchProgressText{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #maySearchProgress progress{display:block;width:100%;height:4px;margin-top:4px;accent-color:#ffd646}
  `;
  document.head.append(style);
  const box=document.createElement('div');box.id='maySearchProgress';box.hidden=true;
  const label=document.createElement('span');label.id='maySearchProgressText';
  const bar=document.createElement('progress');bar.max=100;bar.setAttribute('aria-labelledby',label.id);
  box.append(label,bar);document.body.append(box);
  let active=null,timer=0,hideTimer=0;
  function begin(frame){
    clearInterval(timer);clearTimeout(hideTimer);
    const job={frame,started:performance.now(),phase:'prepare',done:null,total:null};active=job;
    const names={prepare:'Подготовка поиска', 'gpu-search':'Поиск на GPU',read:'Чтение кадра',
      bands:'Границы поля',lines:'Маршруты поиска',frequency:'Индекс поиска',search:'Поиск на CPU',
      circuit:'Циклический маршрут',archive:'Сжатие снимка','archive-finish':'Завершение снимка',
      finish:'Завершение поиска',restore:'Восстановление кадра'};
    function paint(){
      if(active!==job)return;
      const measured=Number.isFinite(job.done)&&Number.isFinite(job.total)&&job.total>0;
      const percent=measured?Math.max(0,Math.min(100,Math.floor(100*job.done/job.total))):null;
      const text='Кадр '+frame+' · '+(job.message||names[job.phase]||'Поиск')+
        (percent===null?'':' · '+percent+'%')+' · '+((performance.now()-job.started)/1000).toFixed(1)+' с';
      label.textContent=text;box.title=text;
      if(percent===null)bar.removeAttribute('value');else bar.value=percent;
      box.dataset.phase=job.phase;box.hidden=false;
    }
    paint();timer=setInterval(paint,250);
    return {
      update(progress={}){
        if(active!==job)return;
        job.phase=progress.phase||'prepare';job.done=progress.done;job.total=progress.total;job.message=progress.message;
        paint();
      },
      end(message){
        if(active!==job)return;
        clearInterval(timer);timer=0;
        if(!message){active=null;box.hidden=true;return;}
        job.phase='finish';job.message=message;job.done=job.total=null;paint();
        active=null;
        hideTimer=setTimeout(()=>{if(!active)box.hidden=true;},3500);
      }
    };
  }
  root.MayatnikSearchProgress={begin};
  root.addEventListener('pagehide',()=>{clearInterval(timer);clearTimeout(hideTimer);active=null;box.hidden=true;});
})(globalThis);
