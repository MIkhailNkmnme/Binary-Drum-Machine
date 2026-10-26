/* v1. Exact per-frame/cycle statistics UI; area worker uses backpressure. */
(() => {
  'use strict';
  const script = document.currentScript;
  const workerURL = new URL('hub-compare-worker.js?v=1', script ? script.src : location.href);
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => Number(n).toLocaleString('ru-RU');
  const yes = value => value ? '<strong class="hc-equal">да</strong>' : 'нет';
  const eventNames = {
    balanceLeft:'5.7: 1 = 0 в кадре', balanceRight:'5.8: 1 = 0 в кадре', balanceBoth:'1 = 0 в обоих одновременно',
    countsEqual:'Количество 1 и 0 одинаково у двух', fieldsEqual:'Полное поле совпало прямо', fieldsMirrorEqual:'Полное поле совпало зеркально',
    cumulativeBalanceLeft:'5.7: сумма 1 = сумме 0 в цикле', cumulativeBalanceRight:'5.8: сумма 1 = сумме 0 в цикле',
    cumulativeBalanceBoth:'Баланс накопленных сумм у обоих', cumulativeCountsEqual:'Накопленные количества двух равны',
    areasShared:'Есть общие величины площадей', areasEqual:'Все площади и их количества совпали',
    namedAreasEqual:'Совпали площади, виды и количества фигур', areaSumsEqual:'Суммы площадей фигур равны в кадре',
    repeatedAreasLeft:'5.7: есть равновеликие фигуры', repeatedAreasRight:'5.8: есть равновеликие фигуры',
    cumulativeAreaSumsEqual:'Накопленные суммы площадей равны'
  };
  function create({W,H}) {
    const tracker = HubCompareStats.createTracker({W,H});
    const analyzer = HubCompareAreas.createAnalyzer();
    const panel = $('hubComparePanel'), content = $('hubComparePanelContent'), progress = $('hubCompareProgress');
    const buttons = {counts:$('hubCompareCounts'),areas:$('hubCompareAreas'),events:$('hubCompareEvents')};
    const key = 'zerk_hub_compare_panels_v1';
    let section = '', zen = false, snapshot = null, failure = '', pending = null, worker = null, serial = 0, busy = false;
    try { const saved=JSON.parse(localStorage.getItem(key)); if(saved){if(Object.hasOwn(buttons,saved.section))section=saved.section;zen=saved.zen===true;} } catch (_) {}
    function save(){try{localStorage.setItem(key,JSON.stringify({section,zen}));}catch(_){}}
    function sync(){
      document.body.classList.toggle('hubCompareZen',zen);
      if(panel)panel.hidden=!section&&!failure;
      for(const [name,b] of Object.entries(buttons))if(b){b.classList.toggle('gz-on',section===name);b.setAttribute('aria-pressed',String(section===name));}
      const z=$('hubCompareZen');if(z){z.classList.toggle('gz-on',zen);z.setAttribute('aria-pressed',String(zen));z.setAttribute('aria-label',zen?'Выйти из дзена':'Включить дзен');}
      const label=$('hubCompareZenLabel');if(label)label.textContent=zen?'Меню':'Дзен';
    }
    for(const [name,b] of Object.entries(buttons))if(b)b.addEventListener('click',()=>{section=section===name?'':name;sync();save();render();});
    $('hubCompareZen')?.addEventListener('click',()=>{zen=!zen;sync();save();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&zen){zen=false;sync();save();}});
    const table=(head,rows)=>'<table><thead><tr>'+head.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
    function countsTable(left,right){
      const rows=[['Единицы',fmt(left.ones),fmt(right.ones)],['Нули',fmt(left.zeros),fmt(right.zeros)],['1 − 0',fmt(left.delta),fmt(right.delta)],['Баланс 1 = 0',yes(left.balanced),yes(right.balanced)],['Пусто (−1)',fmt(left.empty),fmt(right.empty)]];
      return table(['','5.7 · Конусы','5.8 · Всё поле'],rows);
    }
    function areaTotals(a){return table(['','5.7','5.8'],[['Фигур',fmt(a.left.figureCount),fmt(a.right.figureCount)],['Сумма площадей',fmt(a.left.sum),fmt(a.right.sum)]]);}
    function figures(side){return table(['Фигура','Площадь','Сколько'],side.figures.map(f=>[esc(f.name),fmt(f.n),fmt(f.count)]));}
    function events(cycle){
      return table(['Совпадение','Кадров','Номера кадров'],Object.entries(eventNames).map(([key,label])=>{
        const ev=cycle.events[key], ranges=ev.ranges.map(([a,b])=>a===b?String(a):a+'–'+b).join(', ');
        return [esc(label),fmt(ev.count),ranges||'—'];
      }));
    }
    function render(){
      if(!content||(!section&&!failure))return;
      const scroll=panel.scrollTop;
      if(failure){content.innerHTML='<h3>Расчёт остановлен</h3><p>'+esc(failure)+'</p>';sync();return;}
      if(!snapshot?.current){content.textContent='Подготовка первого кадра…';return;}
      const s=snapshot,c=s.current,cy=s.cycle;
      let html='<h3>Кадр '+c.frame+' · цикл '+(c.cycle+1)+'</h3>';
      if(section==='counts'){
        html+=countsTable(c.left,c.right)+'<p>Количество 1 и 0 у двух: '+yes(c.countsEqual)+'. Полное совпадение: '+yes(c.fieldsEqual)+', зеркально: '+yes(c.fieldsMirrorEqual)+'.</p>';
        html+='<h3>За цикл · '+fmt(cy.frames)+' / '+fmt(W)+' кадров</h3>'+countsTable(cy.totals.left,cy.totals.right);
        html+='<p class="hc-note">Суммы по всем обработанным кадрам 0…'+(W-1)+', включая первые 0–7. Пустота не считается нулём. Полное совпадение учитывает и пустые клетки.</p>';
        if(s.previousCycle)html+='<h3>Завершённый цикл '+(s.previousCycle.id+1)+'</h3>'+countsTable(s.previousCycle.totals.left,s.previousCycle.totals.right);
      }else if(section==='areas'){
        const a=c.areas;
        html+='<p class="hc-note">Площадь — число клеток строго внутри фигуры. Общие оси сравнения; для 5.8 они не означают застывание. Только исходное поле '+W+' × '+H+'.</p>';
        if(a){
          html+=areaTotals(a)+'<p>Все площади с количествами совпали: '+yes(a.histogramEqual&&a.left.figureCount>0&&a.right.figureCount>0)+'.</p>';
          html+='<h3>Равные площади у двух</h3>'+table(['Площадь','Фигур 5.7','Фигур 5.8'],a.shared.map(x=>[fmt(x.n),fmt(x.left),fmt(x.right)]));
          html+='<h3>5.7 · Конусы</h3>'+figures(a.left)+'<h3>5.8 · Всё поле</h3>'+figures(a.right);
          html+='<h3>За цикл · '+fmt(cy.areas.frames)+' кадров</h3>'+areaTotals(cy.areas);
          html+='<p class="hc-note">Фигуры могут перекрываться: в сумме площадей пересечение учитывается у каждой фигуры. Равновеликие фигуры объединены в строки без потери количества.</p>';
          if(s.previousCycle)html+='<h3>Завершённый цикл '+(s.previousCycle.id+1)+'</h3>'+areaTotals(s.previousCycle.areas);
        }
      }else{
        html+='<p class="hc-note">Каждый номер — завершённый кадр текущего цикла. Диапазон 8–12 означает все пять кадров, без пропусков.</p>'+events(cy);
        if(s.previousCycle)html+='<h3>Завершённый цикл '+(s.previousCycle.id+1)+'</h3>'+events(s.previousCycle);
      }
      content.innerHTML=html;panel.scrollTop=scroll;
    }
    function fail(error){failure=error?.message||String(error);zen=false;sync();render();}
    function mainAreas(input){return new Promise((resolve,reject)=>setTimeout(()=>{try{resolve(analyzer.analyzeAreas({...input,W,H}));}catch(e){reject(e);}},0));}
    function loseWorker(){
      if(worker){worker.terminate();worker=null;}
      const job=pending;pending=null;
      if(job)mainAreas(job.input).then(job.resolve,job.reject);
    }
    try{
      if(typeof Worker!=='undefined'){
        worker=new Worker(workerURL);
        worker.onmessage=e=>{
          const job=pending;if(!job||e.data.id!==job.id)return;
          if(e.data.error){loseWorker();return;}
          pending=null;job.resolve(e.data.areas);
        };
        worker.onerror=e=>{e.preventDefault?.();loseWorker();};
        worker.onmessageerror=loseWorker;
      }
    }catch(_){worker=null;}
    function measure(input){
      if(busy)return Promise.reject(new Error('Предыдущий кадр ещё считается'));
      busy=true;
      if(progress)progress.textContent='Расчёт кадра '+input.frame+' · цикл '+(input.cycle+1);
      let task;
      if(worker){
        task=new Promise((resolve,reject)=>{
          const l=input.left.slice(),r=input.right.slice(),id=++serial;
          pending={id,input,resolve,reject};
          try{worker.postMessage({id,left:l,right:r,W,H,frame:input.frame},[l.buffer,r.buffer]);}catch(_){loseWorker();}
        });
      }else task=mainAreas(input);
      return task.then(areas=>{
        tracker.record({...input,areas});snapshot=tracker.snapshot({includeFrames:false});
        if(progress)progress.textContent='Кадр '+input.frame+' · цикл '+(input.cycle+1)+' · '+snapshot.cycle.frames+' / '+W;
        render();return snapshot;
      }).catch(e=>{fail(e);throw e;}).finally(()=>{busy=false;});
    }
    sync();render();
    return {measure,error:fail,snapshot:()=>snapshot};
  }
  window.HubComparePanel={create};
})();
