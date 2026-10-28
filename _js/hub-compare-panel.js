/* v2. Exact per-frame/cycle statistics UI for three fields; area worker uses backpressure.
   v2: 5.7, 5.9 and 5.8 in the tables, all-three coincidences and areas. */
(() => {
  'use strict';
  const script = document.currentScript;
  const workerURL = new URL('hub-compare-worker.js?v=2', script ? script.src : location.href);
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => Number(n).toLocaleString('ru-RU');
  const yes = value => value ? '<strong class="hc-equal">да</strong>' : 'нет';
  const framesWord = n => { const ten = n % 10, hundred = n % 100; return ten === 1 && hundred !== 11 ? 'кадр' : ten >= 2 && ten <= 4 && (hundred < 10 || hundred >= 20) ? 'кадра' : 'кадров'; };
  const eventNames = {
    balanceLeft:'5.7: 1 = 0 в кадре', balanceMiddle:'5.9: 1 = 0 в кадре', balanceRight:'5.8: 1 = 0 в кадре',
    balanceBoth:'5.7 и 5.8: 1 = 0 одновременно', balanceAll:'Все три: 1 = 0 одновременно',
    countsEqual:'5.7 и 5.8: количество 1 и 0 одинаково', countsEqualAll:'Все три: количество 1 и 0 одинаково',
    fieldsEqual:'5.7 и 5.8: полное поле совпало прямо', fieldsEqualAll:'Все три: полное поле совпало прямо',
    fieldsMirrorEqual:'5.7 и 5.8: полное поле совпало зеркально', fieldsMirrorEqualAll:'Все три: полное поле совпало зеркально',
    cumulativeBalanceLeft:'5.7: сумма 1 = сумме 0 в цикле', cumulativeBalanceMiddle:'5.9: сумма 1 = сумме 0 в цикле',
    cumulativeBalanceRight:'5.8: сумма 1 = сумме 0 в цикле',
    cumulativeBalanceBoth:'5.7 и 5.8: баланс накопленных сумм', cumulativeBalanceAll:'Все три: баланс накопленных сумм',
    cumulativeCountsEqual:'5.7 и 5.8: накопленные количества равны', cumulativeCountsEqualAll:'Все три: накопленные количества равны',
    areasShared:'5.7 и 5.8: есть общие величины площадей', areasSharedAll:'Все три: есть общие величины площадей',
    areasEqual:'5.7 и 5.8: все площади и их количества совпали', areasEqualAll:'Все три: все площади и их количества совпали',
    namedAreasEqual:'5.7 и 5.8: совпали площади, виды и количества фигур', namedAreasEqualAll:'Все три: совпали площади, виды и количества фигур',
    areaSumsEqual:'5.7 и 5.8: суммы площадей фигур равны в кадре', areaSumsEqualAll:'Все три: суммы площадей фигур равны в кадре',
    repeatedAreasLeft:'5.7: есть равновеликие фигуры', repeatedAreasMiddle:'5.9: есть равновеликие фигуры', repeatedAreasRight:'5.8: есть равновеликие фигуры',
    cumulativeAreaSumsEqual:'5.7 и 5.8: накопленные суммы площадей равны', cumulativeAreaSumsEqualAll:'Все три: накопленные суммы площадей равны'
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
    function setSection(next){
      const wasActive=section!=='';
      section=next;
      // Пока панель закрыта, плеер не тратит время на статистику. При открытии
      // счёт начинается с текущего кадра, поэтому первый цикл может быть неполным.
      if(!wasActive&&section!==''){tracker.startFrom();try{if(typeof CustomEvent!=='undefined')document.dispatchEvent(new CustomEvent('hubStatsActivated'));}catch(_){}}
      sync();save();render();
    }
    for(const [name,b] of Object.entries(buttons))if(b)b.addEventListener('click',()=>setSection(section===name?'':name));
    $('hubCompareZen')?.addEventListener('click',()=>{zen=!zen;sync();save();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&zen){zen=false;sync();save();}});
    const table=(head,rows)=>'<table><thead><tr>'+head.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
    function countsTable(left,middle,right){
      const cell = side => side ? fmt(side.ones) : '—';
      const rows=[['Единицы',cell(left),cell(middle),cell(right)],['Нули',left?fmt(left.zeros):'—',middle?fmt(middle.zeros):'—',right?fmt(right.zeros):'—'],
        ['1 − 0',left?fmt(left.delta):'—',middle?fmt(middle.delta):'—',right?fmt(right.delta):'—'],
        ['Баланс 1 = 0',yes(left?.balanced),yes(middle?.balanced),yes(right?.balanced)],
        ['Пусто (−1)',left?fmt(left.empty):'—',middle?fmt(middle.empty):'—',right?fmt(right.empty):'—']];
      return table(['','5.7 · Конусы','5.9 · Обе стороны','5.8 · Всё поле'],rows);
    }
    function areaTotals(a){
      const figureCount = side => side ? fmt(side.figureCount) : '—';
      const sum = side => side ? fmt(side.sum) : '—';
      return table(['','5.7','5.9','5.8'],[
        ['Фигур',figureCount(a.left),figureCount(a.middle),figureCount(a.right)],
        ['Сумма площадей',sum(a.left),sum(a.middle),sum(a.right)]
      ]);
    }
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
        html+=countsTable(c.left,c.middle,c.right)+'<p>Количество 1 и 0 у всех трёх: '+yes(c.countsEqualAll)+'. Все три поля совпали прямо: '+yes(c.fieldsEqualAll)+', зеркально: '+yes(c.fieldsMirrorEqualAll)+'.</p>';
        html+='<h3>'+(cy.partial?'С момента открытия · '+fmt(cy.frames)+' '+framesWord(cy.frames):'За цикл · '+fmt(cy.frames)+' / '+fmt(W)+' кадров')+'</h3>'+countsTable(cy.totals.left,cy.totals.middle,cy.totals.right);
        html+='<p class="hc-note">'+(cy.partial?'Суммы с момента открытия панели. ':'Суммы по всем обработанным кадрам 0…'+(W-1)+', включая первые 0–7. ')+'Пустота не считается нулём. Полное совпадение учитывает и пустые клетки.</p>';
        if(s.previousCycle)html+='<h3>Завершённый цикл '+(s.previousCycle.id+1)+'</h3>'+countsTable(s.previousCycle.totals.left,s.previousCycle.totals.middle,s.previousCycle.totals.right);
      }else if(section==='areas'){
        const a=c.areas;
        html+='<p class="hc-note">Площадь — число клеток строго внутри фигуры. Общие оси сравнения; для 5.8 они не означают застывание. Только исходное поле '+W+' × '+H+'.</p>';
        if(a){
          html+=areaTotals(a)+'<p>Все площади и количества всех трёх совпали: '+yes(a.histogramEqualAll&&a.left.figureCount>0&&a.middle&&a.middle.figureCount>0&&a.right.figureCount>0)+'.</p>';
          html+='<h3>Равные площади у трёх</h3>'+table(['Площадь','Фигур 5.7','Фигур 5.9','Фигур 5.8'],(a.sharedAll||[]).map(x=>[fmt(x.n),fmt(x.left),fmt(x.middle),fmt(x.right)]));
          html+='<h3>5.7 · Конусы</h3>'+figures(a.left);
          if(a.middle)html+='<h3>5.9 · Обе стороны</h3>'+figures(a.middle);
          html+='<h3>5.8 · Всё поле</h3>'+figures(a.right);
          html+='<h3>'+(cy.partial?'Площади с момента открытия · '+fmt(cy.areas.frames)+' '+framesWord(cy.areas.frames):'За цикл · '+fmt(cy.areas.frames)+' кадров')+'</h3>'+areaTotals(cy.areas);
          html+='<p class="hc-note">Фигуры могут перекрываться: в сумме площадей пересечение учитывается у каждой фигуры. Равновеликие фигуры объединены в строки без потери количества.</p>';
          if(s.previousCycle)html+='<h3>Завершённый цикл '+(s.previousCycle.id+1)+'</h3>'+areaTotals(s.previousCycle.areas);
        }
      }else{
        html+='<p class="hc-note">'+(cy.partial?'Статистика считается, пока панель открыта; номера — с момента открытия. ':'')+'Каждый номер — завершённый кадр текущего цикла. Диапазон 8–12 означает все пять кадров, без пропусков.</p>'+events(cy);
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
      if(!section)return Promise.resolve(snapshot);
      if(busy)return Promise.reject(new Error('Предыдущий кадр ещё считается'));
      busy=true;
      if(progress)progress.textContent='Расчёт кадра '+input.frame+' · цикл '+(input.cycle+1);
      let task;
      if(worker){
        task=new Promise((resolve,reject)=>{
          const l=input.left.slice(),m=input.middle?input.middle.slice():null,r=input.right.slice(),id=++serial;
          pending={id,input,resolve,reject};
          const transfer=[l.buffer,r.buffer];if(m)transfer.push(m.buffer);
          try{worker.postMessage({id,left:l,middle:m,right:r,W,H,frame:input.frame},transfer);}catch(_){loseWorker();}
        });
      }else task=mainAreas(input);
      return task.then(areas=>{
        tracker.record({...input,areas});snapshot=tracker.snapshot({includeFrames:false});
        if(progress)progress.textContent='Кадр '+input.frame+' · цикл '+(input.cycle+1)+' · '+(snapshot.cycle.partial?'с момента открытия: '+snapshot.cycle.frames+' '+framesWord(snapshot.cycle.frames):snapshot.cycle.frames+' / '+W);
        render();return snapshot;
      }).catch(e=>{fail(e);throw e;}).finally(()=>{busy=false;});
    }
    sync();render();
    return {measure,error:fail,snapshot:()=>snapshot,active:()=>!!section&&!failure};
  }
  window.HubComparePanel={create};
})();
