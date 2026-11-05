/* Перестройка активной цепочки в родные редактируемые строки 1, 3, 5… (v1.660). */
(() => {
  const button = document.getElementById('bRetriangle');
  if (!button) return;
  const clone = value => JSON.parse(JSON.stringify(value));
  const maps = [invFlagsMap, insertedFlagsMap, axisOffsetMap, axisBitShiftMap,
    axisBitDirMap, axisBitSeedGrpShift, rowRotOffMap, edgeOnesSideMap,
    mirrorsRowDone, maskChangedMap];
  // Родная история не включала выравнивание и клеточную разметку. Дополняем её,
  // чтобы та же Отмена/Повтор возвращала и данные, и их прежнюю геометрию.
  const capture = captureState, apply = applyState;
  captureState = function () {
    const state = capture();
    state.retriangle = {
      align: st.align, maps: maps.map(m => clone(Array.from(m))),
      rowInk: clone(st.tabs[st.activeTab].rowInk || {}),
      stash: clone(rowCountStash), countBase: rowCountBase,
      topBase: topBaseRows.slice()
    };
    return state;
  };
  applyState = function (state) {
    apply(state);
    const extra = state.retriangle;
    if (!extra) return;
    st.align = extra.align;
    maps.forEach((m, i) => { m.clear(); for (const [k, v] of extra.maps[i]) m.set(k, clone(v)); });
    st.tabs[st.activeTab].rowInk = clone(extra.rowInk);
    rowCountStash = clone(extra.stash); rowCountBase = extra.countBase;
    topBaseRows = extra.topBase.slice();
    if (typeof syncAlignBanned === 'function') syncAlignBanned();
    if (window.ZZRowInk) window.ZZRowInk.refresh();
  };

  button.onclick = () => {
    if (!window.ZerkRetriangle) { say('Не загружена перестройка в треугольник. Обновите страницу.'); return; }
    if (st.running) { say('Остановите плеер перед перестройкой в треугольник.'); return; }
    const source = st.rows.slice();
    function* bits() {
      for (const row of source) for (const ch of row || '') {
        if (ch === '0' || ch === '1') yield ch === '1' ? 1 : 0;
      }
    }
    let packed;
    try { packed = window.ZerkRetriangle.pack(bits(), { step: 2, maxCells: 16777216 }); }
    catch (error) { say('Перестройка в треугольник: ' + error.message); return; }
    if (!packed.count) { say('В текущей цепочке нет битов 0 или 1.'); return; }
    const rows = [''].concat(packed.rows.map(row => Array.from(row).join('')));
    const flags = [invFlagsMap, insertedFlagsMap, newBitsMap];
    const movedFlags = flags.map(() => new Map());
    const ink = st.tabs[st.activeTab].rowInk || {}, movedInk = {};
    let destRow = 1, destCol = 0;
    source.forEach((row, r) => {
      let ordinal = 0;
      for (let j = 0; j < (row || '').length; j++) {
        if (row[j] !== '0' && row[j] !== '1') continue;
        flags.forEach((m, i) => {
          const old = m.get(r);
          if (!old || !old[j]) return;
          let next = movedFlags[i].get(destRow);
          if (!next) movedFlags[i].set(destRow, next = new Array(rows[destRow].length).fill(false));
          next[destCol] = old[j];
        });
        const mark = ink['0:' + r + ':' + ordinal++];
        if (mark) movedInk['0:' + destRow + ':' + destCol] = clone(mark);
        if (++destCol === rows[destRow].length) { destRow++; destCol = 0; }
      }
    });
    snapshot();
    rowCountMarkInsert();
    st.rows = rows;
    st.used = rows.map(() => false);
    // Колонка паттернов самостоятельна: её тексты сохраняем, находки пересчитаются.
    st.pats = st.pats.map(p => p ? { ...p, found: false, kind: null, step: null } : p);
    st.topBuilt = 0; st.horizonRow = 0; topBaseCapture(); rowCountStashClear();
    st.rowGroups = []; rowGroupsTouch();
    st.rowDividers = new Set();
    // Полубитовый центр — родной режим: центрирует и чётный неполный хвост.
    st.align = 'halfcenter';
    maps.forEach(m => m.clear());
    newBitsMap.clear();
    flags.forEach((m, i) => { for (const [r, values] of movedFlags[i]) m.set(r, values); });
    st.tabs[st.activeTab].rowInk = movedInk;
    maskBaseRows = null;
    st.step = 0; st.passCount = 0; st.tailBuffer = ''; st.hit = null;
    st.aIdx = 0; st.bIdx = 1; st.goingUp = false;
    st.horizBitIdx = 0; st.lastXorBitA = null;
    st.selectedRows = new Set([1]);
    if (typeof syncAlignBanned === 'function') syncAlignBanned();
    logStep('Перестроить в треугольник', '', '', packed.count + ' бит → ' + packed.height + ' строк, шаг 2');
    render(); saveCache();
    if (window.ZZRowInk) window.ZZRowInk.refresh();
    const halfTail = packed.incomplete && packed.lastLength % 2 === 0;
    button.title = 'Перестроить в треугольник всю текущую цепочку: строки 1, 3, 5…; пустоты пропускаются. ' +
      'Родная Отмена возвращает прежнее поле.' +
      (halfTail ? ' Последний чётный хвост центрируется сдвигом на ½ бита: без вставки пустых клеток или нулей.' : '');
    say('Вся текущая цепочка: ' + packed.count + ' бит → ' + packed.height +
      ' строк 1, 3, 5…' + (packed.incomplete ? '; последняя — ' + packed.lastLength + ' бит, по центру' : '') +
      (halfTail ? ' (сдвиг ½ бита)' : '') +
      '. Пустоты пропущены. Отмена вернёт прежнее поле.');
  };
})();
