/* Wave controls for the current Fold chain; source, counters and history are exported with its tab. */
(() => {
  const bar=document.getElementById('rowInkBar'),C=window.FoldAnimCore;if(!bar||!C)return;
  const $=id=>document.getElementById(id),panel=document.createElement('section');panel.id='foldAnimPanel';
  panel.innerHTML=`<div class="ink-tools"><strong>🌊 Аниматрица</strong><button id="faRow" title="Пересчитать одну строку, используя уже обновлённую строку сверху">↓ Строка</button><button id="faFrame" title="Завершить текущий проход сверху вниз — один кадр">▣ Кадр</button><button id="faBack" title="Вернуть предыдущее действие: строку или кадр">↶ Назад</button><button id="faReset" title="Вернуть исходные строки до первой волны">⏮ Исходный</button><button id="faPlay" title="Запустить или приостановить Аниматрицу">▶ Пуск</button><select id="faUnit" aria-label="Режим воспроизведения"><option value="row">По строкам</option><option value="frame">По кадрам</option></select><label>Шаг/с <input id="faSpeed" type="number" min="0.2" max="20" step="0.2" value="2" aria-label="Скорость Аниматрицы"></label></div><div class="ink-tools"><select id="faRule" aria-label="Правило Аниматрицы"><option value="above">XOR с битом сверху</option><option value="neighbors">XOR с двумя верхними соседями</option></select><label><input id="faStop" type="checkbox"> Стоп при смене выбранной клетки</label><button id="faPick" title="Запомнить выбранную инструментом «Текст» клетку как датчик перехода">⌖ Ловить клетку</button><span id="faWatch">Клетка не выбрана</span></div><div id="faStatus" aria-live="polite"></div><small>Новый бит = свой бит ⊕ верхние соседи (или бит сверху). Волна сверху вниз, верхняя строка сохраняется. Золото: 0→1, голубой: 1→0. Это преобразование исходных строк, а не новые вершины маятника.</small>`;
  bar.append(panel);
  const button=document.createElement('button');button.id='bFoldAnim';button.textContent='🌊 Аниматрица';button.title='Построчная и покадровая волна с подсветкой переходов';$('bRowInk').after(button);
  let timer=0,playingTab=null,refreshPending=false;
  const tab=()=>st.tabs[st.activeTab];
  function state(){const t=tab();if(!t.rowAnim||t.rowAnim.expected!==st.rows.join('\n')){const rule=t.rowAnim?.rule||'neighbors';if(playingTab)stop();t.rowAnim=C.create(st.rows,rule);}return t.rowAnim;}
  function stop(){clearTimeout(timer);timer=0;playingTab=null;$('faPlay').textContent='▶ Пуск';}
  function status(){
    const s=state(),total=Math.max(0,C.targets(st.rows).length-1),ones=s.last.filter(c=>c.to===1).length,zeros=s.last.length-ones;
    $('faStatus').textContent=`Кадр ${s.frame} · строк обработано ${s.cursor}/${total} · изменений ${s.last.length}: 0→1 — ${ones}, 1→0 — ${zeros}`;
    $('faBack').disabled=!s.history.length;$('faRule').value=s.rule;$('faStop').checked=!!s.stopWatch;$('faUnit').value=s.unit||'row';$('faSpeed').value=s.speed||2;
    $('faWatch').textContent=s.watch?`Строка ${s.watch.r}, бит ${s.watch.j+1}`:'Клетка не выбрана';
    button.classList.toggle('on',!!playingTab);window.ZZRowInk?.refresh();
  }
  function renderWave(){render();saveCache();status();}
  function advance(unit){
    const s=state();if(!C.step(st.rows,s,unit)){stop();return false;}
    if(s.stopWatch&&s.watch&&s.last.some(c=>c.r===s.watch.r&&c.j===s.watch.j)){stop();say(`Переход: строка ${s.watch.r}, бит ${s.watch.j+1}.`);}
    renderWave();return true;
  }
  function tick(){if(playingTab!==tab().id){stop();return;}if(!advance($('faUnit').value))return;if(playingTab)timer=setTimeout(tick,1000/Math.max(.2,Math.min(20,Number($('faSpeed').value)||2)));}
  button.onclick=()=>{window.ZZRowInk.open();status();};
  $('faRow').onclick=()=>{stop();advance('row');};$('faFrame').onclick=()=>{stop();advance('frame');};
  $('faBack').onclick=()=>{stop();if(C.back(st.rows,state()))renderWave();};
  $('faReset').onclick=()=>{stop();const s=state();tab().rowAnim=C.reset(st.rows,s);renderWave();};
  $('faPlay').onclick=()=>{if(playingTab){stop();status();return;}state();playingTab=tab().id;$('faPlay').textContent='Ⅱ Пауза';tick();};
  $('faRule').onchange=()=>{stop();tab().rowAnim=C.create(st.rows,$('faRule').value);saveCache();status();};
  $('faPick').onclick=()=>{const c=window.ZZRowInk.selected();if(!c){say('Сначала выбери клетку инструментом «Текст».');return;}const s=state();s.watch={r:c.r,j:c.j};s.stopWatch=true;saveCache();status();};
  $('faStop').onchange=()=>{state().stopWatch=$('faStop').checked;saveCache();};
  $('faUnit').onchange=()=>{state().unit=$('faUnit').value;saveCache();};
  $('faSpeed').onchange=()=>{state().speed=Math.max(.2,Math.min(20,Number($('faSpeed').value)||2));saveCache();status();};
  // A cell selection remains available while pressing the wave controls.
  new MutationObserver(()=>{if(!refreshPending){refreshPending=true;requestAnimationFrame(()=>{refreshPending=false;if(playingTab&&playingTab!==tab().id)stop();status();});}}).observe($('rows'),{childList:true,subtree:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('pagehide',stop);status();
})();
