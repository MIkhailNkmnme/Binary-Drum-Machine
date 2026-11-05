(function(){
 'use strict';
 const scriptURL=document.currentScript.src;
 window.mountXorSpacePlayer=function(container,view){
  const panel=document.createElement('section');panel.className='xs-sequence';panel.setAttribute('aria-label','Перебор 3D без пересечений');
  panel.innerHTML='<h3>Перебор 3D / без пересечений</h3><div class="xs-sequence-controls"><button class="gz-hx" type="button" data-action="play">|> Перебор 3D</button><button class="gz-hx" type="button" data-action="prev" aria-label="Предыдущий допустимый вариант" disabled><|</button><button class="gz-hx" type="button" data-action="next" aria-label="Следующий допустимый вариант" disabled>|></button><label>Вариантов/с <input data-rate type="number" min="1" max="25" step="1" value="4"></label></div><label class="xs-centres"><input data-centres type="checkbox" checked> Разрешить общий серый центр</label><div class="xs-sequence-position"><span class="xs-rail" aria-hidden="true">[</span><input data-position type="range" min="1" max="1" value="1" disabled aria-label="Номер допустимого варианта"><span class="xs-rail" aria-hidden="true">]</span><output data-counter>0 / 0</output></div><p data-status role="status">Текущие центры фиксированы. Все 331 776 сочетаний поворотов четырёх фигур.</p>';
  const host=container.querySelector('.xor-space');host.querySelector('.xs-controls').after(panel);
  const explanation=document.createElement('details');explanation.className='xs-variant-explanation';
  explanation.innerHTML='<summary>Как считаются варианты</summary><p>Центры четырёх фигур остаются на текущих местах. Перебираются только повороты по решётке, с шагом 90o. «В центр» совмещает серые кубики и включает общий разнос R по зафиксированным текущим направлениям. Изменение R пересчитывает допустимые варианты; во время самого перебора R и центры неподвижны.</p><table><thead><tr><th>Что считаем</th><th>Количество</th></tr></thead><tbody><tr><td>Направление продольной оси одной фигуры</td><td>6: +-X, +-Y, +-Z</td></tr><tr><td>Поворот вокруг этой оси</td><td>4: 0o, 90o, 180o, 270o</td></tr><tr><td>Ориентации одной фигуры</td><td>6 x 4 = 24</td></tr><tr><td>Сочетания четырёх различимых фигур</td><td>24^4 = 331 776</td></tr></tbody></table><p>Затем исключаются совпадения кубиков разных фигур в одной координате (X,Y,Z), а также попадание тела фигуры в чужой серый центр. Флажок разрешает только совпадение серых центров друг с другом. Касание гранью, ребром или вершиной разрешено.</p><p data-variant-summary>После расчёта здесь появится число допустимых и исключённых сочетаний и длительность полного цикла.</p><p>Для исходных четырёх фигур с общим разрешённым серым центром остаётся <b>64 512</b> сочетаний, исключается <b>267 264</b>. При 4 вариантах/с полный цикл занимает <b>4 ч 28 мин 48 с</b>. После изменения рисунков или центров результат может быть другим. Если центры общие, а их совпадение запрещено, допустимых вариантов нет; если фигуры достаточно далеко друг от друга, могут подойти все 331 776.</p><p>Красная штриховка в проекциях - реальное совпадение XYZ; голубая рамка - разные глубины в одной клетке проекции, это не столкновение. Перебор проверяет исходные кубики до XOR: взаимное погашение не делает пересечение допустимым.</p><p>Одинаковый номер варианта в цикле не повторяется до его завершения. Здесь считаются ориентации, а не уникальные картинки: симметричные отредактированные фигуры могут выглядеть одинаково при разных поворотах. Общий поворот всей сцены считается отдельно. Переворот на 180o уже входит в 24 ориентации; отдельного множителя x2 нет.</p><p>Плоские режимы сверху считают другое: 256 = 4^4 независимых поворотов четырёх фигур в 2D; 24 креста = 4! расстановок на четырёх перпендикулярных направлениях. Эти числа не нужно умножать на число вариантов 3D.</p>';
  panel.appendChild(explanation);
  const variantSummary=explanation.querySelector('[data-variant-summary]');

  const play=panel.querySelector('[data-action=play]'),prev=panel.querySelector('[data-action=prev]'),next=panel.querySelector('[data-action=next]'),rate=panel.querySelector('[data-rate]'),allow=panel.querySelector('[data-centres]'),slider=panel.querySelector('[data-position]'),counter=panel.querySelector('[data-counter]'),status=panel.querySelector('[data-status]');
  try{const saved=localStorage.getItem('zerk_xor_space_allow_centres');if(saved!==null)allow.checked=saved==='true';}catch(_){}
  let worker=null,sequence=null,prepared=null,index=0,raf=0,nextDue=0,request=0,playing=false,busy=false;
  let calculation=null,resolveCalculation=null,rejectCalculation=null,sequenceSource=null,sequenceAssignments=null;
  const buttons=()=>{
   if(sequence){const seconds=sequence.codes.length/Math.max(1,Math.min(25,Number(rate.value)||4)),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60),rest=Math.round(seconds%60*100)/100;variantSummary.textContent='Текущие фигуры: '+sequence.codes.length.toLocaleString('ru-RU')+' допустимых, '+(sequence.total-sequence.codes.length).toLocaleString('ru-RU')+' исключённых. Полный цикл: '+hours+' ч '+minutes+' мин '+rest.toLocaleString('ru-RU')+' с.';}else variantSummary.textContent='После расчёта здесь появится число допустимых и исключённых сочетаний и длительность полного цикла.';
play.textContent=busy?'Отмена':playing?'|| Пауза':'|> Перебор';play.setAttribute('aria-pressed',String(playing));prev.disabled=next.disabled=slider.disabled=!sequence?.codes.length;slider.max=String(sequence?.codes.length||1);slider.value=String(index+1);counter.textContent=(sequence?.codes.length?index+1:0)+' / '+(sequence?.codes.length||0);};
  function pause(save=true){if(raf)cancelAnimationFrame(raf);raf=0;const wasPlaying=playing;playing=false;if(save&&wasPlaying)view.setAssignments(view.getState().assignments,{save:true});buttons();}
  function cancel(){request++;if(worker)worker.terminate();worker=null;busy=false;const reject=rejectCalculation;calculation=resolveCalculation=rejectCalculation=null;if(reject)reject(new DOMException('Расчёт отменён','AbortError'));pause();}
  function invalidate(message){cancel();sequence=prepared=sequenceSource=sequenceAssignments=null;index=0;status.textContent=message||'Настройки изменены. Перебор будет рассчитан для текущих центров и фигур.';buttons();}
  function show(at){if(!sequence?.codes.length)return;index=(at+sequence.codes.length)%sequence.codes.length;view.setAssignments(XorAxesSequence.assignmentsAt(prepared,sequence.codes[index]));buttons();}
  function tick(now){if(!playing)return;if(now>=nextDue){show(index+1);nextDue=now+1000/Math.max(1,Math.min(25,Number(rate.value)||4));}raf=requestAnimationFrame(tick);}
  function start(){if(!sequence?.codes.length)return;container.dispatchEvent(new CustomEvent('xor-space-play',{bubbles:true}));playing=true;nextDue=performance.now()+1000/(Number(rate.value)||4);buttons();raf=requestAnimationFrame(tick);}
  function calculate(autoplay=true){
   container.dispatchEvent(new CustomEvent('xor-space-play',{bubbles:true}));
   const source=view.getSnapshot();if(source.mode==='solo'){status.textContent='Для четырёх фигур выберите XOR или Вместе на основном поле.';return Promise.reject(new Error(status.textContent));}
   const assignments=view.getState().assignments,options={allowSharedCentres:allow.checked};
   cancel();sequence=null;index=0;busy=true;const token=++request;buttons();status.textContent='Проверка 331 776 сочетаний...';
   calculation=new Promise((resolve,reject)=>{resolveCalculation=resolve;rejectCalculation=reject;});const pending=calculation;
   try{worker=new Worker(new URL('xor-space-sequence-worker.js?v=017',scriptURL));}catch(error){busy=false;rejectCalculation(error);calculation=resolveCalculation=rejectCalculation=null;status.textContent='Не удалось запустить расчёт: '+error.message;buttons();return pending;}
   worker.onmessage=event=>{
    if(token!==request)return;worker.terminate();worker=null;busy=false;
    if(event.data.error){status.textContent='Не удалось рассчитать: '+event.data.error;rejectCalculation(new Error(event.data.error));calculation=resolveCalculation=rejectCalculation=null;buttons();return;}
    sequence=event.data;sequenceSource=source;sequenceAssignments=assignments;prepared=XorAxesSequence.prepare(source,assignments);index=0;
    status.textContent='Без пересечений: '+sequence.codes.length+' из '+sequence.total+'. '+(allow.checked?'Совпадение серых центров разрешено.':'Серые кубики также проверяются.')+(sequence.codes.length?'':' Разведите фигуры по осям или разрешите общий серый центр.');
    const resolve=resolveCalculation;calculation=resolveCalculation=rejectCalculation=null;
    if(sequence.codes.length&&autoplay){show(0);start();}else buttons();
    if(resolve)resolve(getExportSnapshot());
   };
   worker.onerror=event=>{if(token!==request)return;cancel();status.textContent='Не удалось рассчитать варианты: '+event.message;};
   worker.postMessage({source,assignments,options});return pending;
  }
  play.addEventListener('click',()=>{if(busy){cancel();status.textContent='Поиск отменён.';}else if(playing)pause();else if(sequence?.codes.length)start();else calculate().catch(()=>{});});
  for(const [button,delta]of [[prev,-1],[next,1]])button.addEventListener('click',()=>{pause();show(index+delta);view.setAssignments(view.getState().assignments,{save:true});});
  slider.addEventListener('input',()=>{const at=Number(slider.value)-1;pause();show(at);view.setAssignments(view.getState().assignments,{save:true});});
  allow.addEventListener('change',()=>{try{localStorage.setItem('zerk_xor_space_allow_centres',String(allow.checked));}catch(_){}invalidate();});
  rate.addEventListener('change',()=>{rate.value=String(Math.max(1,Math.min(25,Math.round(Number(rate.value)||4))));nextDue=performance.now()+1000/Number(rate.value);buttons();});
  container.addEventListener('xor-space-change',event=>{if(event.detail?.reason==='interaction')pause();else if(event.detail?.reason!=='sequence')invalidate();});
  function getExportSnapshot(){return {source:JSON.parse(JSON.stringify(sequenceSource||view.getSnapshot())),assignments:JSON.parse(JSON.stringify(sequenceAssignments||view.getState().assignments)),codes:sequence?sequence.codes.slice():null,index,count:sequence?.codes.length||0,rate:Math.max(1,Math.min(25,Number(rate.value)||4)),allowSharedCentres:allow.checked};}
  function ensureSequence(){if(sequence)return Promise.resolve(getExportSnapshot());if(calculation)return calculation;return calculate(false);}
  buttons();return {pause,invalidate,ensureSequence,cancelSequence:cancel,getExportSnapshot,getState:()=>({playing,busy,index,count:sequence?.codes.length||0,total:sequence?.total||331776}),destroy(){cancel();panel.remove();}};
 };
})();
