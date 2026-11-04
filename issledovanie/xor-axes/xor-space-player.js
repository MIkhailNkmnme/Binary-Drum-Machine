(function(){
 'use strict';
 const scriptURL=document.currentScript.src;
 window.mountXorSpacePlayer=function(container,view){
  const panel=document.createElement('section');panel.className='xs-sequence';panel.setAttribute('aria-label','Перебор 3D без пересечений');
  panel.innerHTML='<h3>Перебор 3D · без пересечений</h3><div class="xs-sequence-controls"><button class="gz-hx" type="button" data-action="play">▶ Перебор 3D</button><button class="gz-hx" type="button" data-action="prev" aria-label="Предыдущий допустимый вариант" disabled>◀</button><button class="gz-hx" type="button" data-action="next" aria-label="Следующий допустимый вариант" disabled>▶</button><label>Вариантов/с <input data-rate type="number" min="1" max="25" step="1" value="4"></label></div><label class="xs-centres"><input data-centres type="checkbox" checked> Разрешить общий серый центр</label><div class="xs-sequence-position"><input data-position type="range" min="1" max="1" value="1" disabled aria-label="Номер допустимого варианта"><output data-counter>0 / 0</output></div><p data-status role="status">Текущие центры фиксированы. Все 331 776 сочетаний поворотов четырёх фигур.</p>';
  const host=container.querySelector('.xor-space');host.querySelector('.xs-controls').after(panel);
  const play=panel.querySelector('[data-action=play]'),prev=panel.querySelector('[data-action=prev]'),next=panel.querySelector('[data-action=next]'),rate=panel.querySelector('[data-rate]'),allow=panel.querySelector('[data-centres]'),slider=panel.querySelector('[data-position]'),counter=panel.querySelector('[data-counter]'),status=panel.querySelector('[data-status]');
  try{const saved=localStorage.getItem('zerk_xor_space_allow_centres');if(saved!==null)allow.checked=saved==='true';}catch(_){}
  let worker=null,sequence=null,prepared=null,index=0,raf=0,nextDue=0,request=0,playing=false,busy=false;
  const buttons=()=>{play.textContent=busy?'Отменить поиск':playing?'Ⅱ Пауза 3D':'▶ Перебор 3D';play.setAttribute('aria-pressed',String(playing));prev.disabled=next.disabled=slider.disabled=!sequence?.codes.length;slider.max=String(sequence?.codes.length||1);slider.value=String(index+1);counter.textContent=(sequence?.codes.length?index+1:0)+' / '+(sequence?.codes.length||0);};
  function pause(save=true){if(raf)cancelAnimationFrame(raf);raf=0;const wasPlaying=playing;playing=false;if(save&&wasPlaying)view.setAssignments(view.getState().assignments,{save:true});buttons();}
  function cancel(){request++;if(worker)worker.terminate();worker=null;busy=false;pause();}
  function invalidate(message){cancel();sequence=prepared=null;index=0;status.textContent=message||'Настройки изменены. Перебор будет рассчитан для текущих центров и фигур.';buttons();}
  function show(at){if(!sequence?.codes.length)return;index=(at+sequence.codes.length)%sequence.codes.length;view.setAssignments(XorAxesSequence.assignmentsAt(prepared,sequence.codes[index]));buttons();}
  function tick(now){if(!playing)return;if(now>=nextDue){show(index+1);nextDue=now+1000/Math.max(1,Math.min(25,Number(rate.value)||4));}raf=requestAnimationFrame(tick);}
  function start(){if(!sequence?.codes.length)return;container.dispatchEvent(new CustomEvent('xor-space-play',{bubbles:true}));playing=true;nextDue=performance.now()+1000/(Number(rate.value)||4);buttons();raf=requestAnimationFrame(tick);}
  function calculate(){
   container.dispatchEvent(new CustomEvent('xor-space-play',{bubbles:true}));
   const source=view.getSnapshot();if(source.mode==='solo'){status.textContent='Для четырёх фигур выберите XOR или Вместе на основном поле.';return;}
   const assignments=view.getState().assignments,options={allowSharedCentres:allow.checked};
   cancel();sequence=null;index=0;busy=true;const token=++request;buttons();status.textContent='Проверка 331 776 сочетаний…';
   worker=new Worker(new URL('xor-space-sequence-worker.js?v=016',scriptURL));
   worker.onmessage=event=>{
    if(token!==request)return;worker.terminate();worker=null;busy=false;
    if(event.data.error){status.textContent='Не удалось рассчитать: '+event.data.error;buttons();return;}
    sequence=event.data;prepared=XorAxesSequence.prepare(source,assignments);index=0;
    status.textContent='Без пересечений: '+sequence.codes.length+' из '+sequence.total+'. '+(allow.checked?'Совпадение серых центров разрешено.':'Серые кубики также проверяются.')+(sequence.codes.length?'':' Разведите фигуры по осям или разрешите общий серый центр.');
    if(sequence.codes.length){show(0);start();}else buttons();
   };
   worker.onerror=event=>{if(token!==request)return;cancel();status.textContent='Не удалось рассчитать варианты: '+event.message;};
   worker.postMessage({source,assignments,options});
  }
  play.addEventListener('click',()=>{if(busy){cancel();status.textContent='Поиск отменён.';}else if(playing)pause();else if(sequence?.codes.length)start();else calculate();});
  for(const [button,delta]of [[prev,-1],[next,1]])button.addEventListener('click',()=>{pause();show(index+delta);view.setAssignments(view.getState().assignments,{save:true});});
  slider.addEventListener('input',()=>{const at=Number(slider.value)-1;pause();show(at);view.setAssignments(view.getState().assignments,{save:true});});
  allow.addEventListener('change',()=>{try{localStorage.setItem('zerk_xor_space_allow_centres',String(allow.checked));}catch(_){}invalidate();});
  rate.addEventListener('change',()=>{rate.value=String(Math.max(1,Math.min(25,Math.round(Number(rate.value)||4))));nextDue=performance.now()+1000/Number(rate.value);});
  container.addEventListener('xor-space-change',event=>{if(event.detail?.reason==='interaction')pause();else if(event.detail?.reason!=='sequence')invalidate();});
  buttons();return {pause,invalidate,getState:()=>({playing,busy,index,count:sequence?.codes.length||0,total:sequence?.total||331776}),destroy(){cancel();panel.remove();}};
 };
})();
