/* HubRhombMusic v0.004: notes walk the triangle without changing it — on 1 down-right, on 0 up-right; past the edge going up a note jumps to
   the leftmost 1 of the row above (a loop); past the bottom it vanishes. Starts form a «tie» near the apex. */
(() => {
  'use strict';
  const ids = ['r', 'c', 'mi', 'fa', 'sol', 'la', 'si'];
  // v0.004, «цветными сделай галстук: по вертикали 4 отдельные единицы, и ещё одна справа от них, и ещё там найди для 5 и 6»: До–Фа — средняя
  // вертикаль (строки 2, 4, 6, 8 — через строку, отдельно), Соль — справа на строке 8, Ля — острие на строке 10, Си — справа выше, строка 6
  const starts = [[1, 0], [3, 1], [5, 2], [7, 3], [7, 4], [9, 4], [5, 4]];
  const frequencies = [261.626, 293.665, 329.628, 349.228, 391.995, 440, 493.883];
  window.HubRhombMusic = (rows, notify) => {
    const field = rows.map(row => row.split(''));
    const active = new Set(), walkers = new Map();
    let ctx, output, destination, timer = 0, paused = false, cursor = -1;
    const audio = () => {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        output = ctx.createGain(); output.gain.value = 0.3; output.connect(ctx.destination);
        destination = ctx.createMediaStreamDestination(); output.connect(destination);
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    };
    const publish = () => notify({
      zerkSndOn: active.size > 0, zerkSndPaused: paused, zerkSndHeads: [...active],
      zerkRows: field.map(row => row.join('')),
      zerkHeads: ids.flatMap((id, t) => active.has(id) ? [[...walkers.get(id).pos, t, walkers.get(id).bit]] : [])
    });
    const tone = (t, pos) => {
      if (!ctx) return;
      const oscillator = ctx.createOscillator(), gain = ctx.createGain(), now = ctx.currentTime;
      oscillator.type = 'sine'; oscillator.frequency.value = frequencies[t];
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.55, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      oscillator.connect(gain); gain.connect(output); oscillator.start(now); oscillator.stop(now + 0.16);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    };
    const same = (a, b) => a[0] === b[0] && a[1] === b[1];
    const occupied = (pos, moving) => [...walkers.values()].some(w => w !== moving && same(w.pos, pos));
    /* v0.003, «звук и ноты пусть двигаются, не изменяя треугольник: на 1 — вниз-вправо следующий ход, на 0 — вверх-вправо; когда уходит за
       треугольник — просто пропадает; всегда можно запускать единицы»: поле не меняется. Нота смотрит на бит под собой: 1 — шаг вниз-вправо,
       0 — вверх-вправо. Соседний ряд — со своей длиной (ряды по центру), поэтому колонка пересчитывается по геометрии: на полклетки правее;
       попала ровно между двумя (соседние ряды одной длины) — правая, а нет правой — левая. Шаг за любой край треугольника — нота пропадает (её звук выключается), её ячейка на старте
       снова зажигается, и её можно запустить заново. Занятая другой нотой клетка — ждёт ход */
    const advance = (walker, id) => {
      const [r, j] = walker.pos, dir = field[r][j] === '1' ? 1 : -1, nr = r + dir;
      const gone = () => { active.delete(id); walkers.delete(id); return false; };
      /* v0.004, «нота, падая на крайний 0, поднимается на левую 1 выше её строки — и так по кругу»: шаг вверх-вправо за край — не пропадает,
         а встаёт на самую левую 1 строки выше (занята — ждёт); шаг вниз за низ треугольника — пропадает, как прежде */
      const up = () => { const ar = r - 1, row = ar >= 0 ? field[ar] : null, aj = row ? row.indexOf('1') : -1; if (aj < 0) return gone();
        const t = [ar, aj]; if (occupied(t, walker)) return true; walker.pos = t; walker.bit = field[ar][aj]; return true; };
      if (nr < 0) return dir < 0 ? up() : gone();
      if (nr >= field.length) return gone();
      const x = j + 0.5 + (field[nr].length - field[r].length) / 2, half = Math.abs(x - Math.round(x)) > 0.25;
      const ok = c => c >= 0 && c < field[nr].length, nj = half ? [Math.ceil(x), Math.floor(x)].find(ok) : Math.round(x);
      if (nj === undefined || !ok(nj)) return dir < 0 ? up() : gone();   // между двумя клетками — правая, нет её — левая; за край вверх — на левую 1 выше, вниз — пропала
      const target = [nr, nj]; if (occupied(target, walker)) return true;
      walker.pos = target; walker.bit = field[nr][nj]; return true;
    };
    const tick = () => {
      timer = 0; if (paused || !active.size) return;
      for (let q = 0; q < ids.length; q++) {
        cursor = (cursor + 1) % ids.length; const id = ids[cursor]; if (!active.has(id)) continue;
        const walker = walkers.get(id); if (advance(walker, id)) tone(cursor, walker.pos); break;
      }
      publish(); timer = setTimeout(tick, 1000 / 6);
    };
    const run = () => { if (!timer && !paused && active.size) timer = setTimeout(tick, 1000 / 6); };
    const start = id => {
      const t = ids.indexOf(id); if (occupied(starts[t], walkers.get(id))) return;
      active.add(id); walkers.set(id, { pos: starts[t].slice(), bit: field[starts[t][0]][starts[t][1]] });   // v0.003: поле не трогаем
    };
    return {
      send(message) {
        audio();
        if (message.zerkSndHead && ids.includes(message.zerkSndHead)) {
          if (message.on) start(message.zerkSndHead); else { active.delete(message.zerkSndHead); walkers.delete(message.zerkSndHead); }
        } else if (message.zerkSndToggle && active.size) paused = !paused;
        else if (message.zerkSndReset || message.zerkSnd === true) {
          active.clear(); walkers.clear(); cursor = -1; paused = false;
          rows.forEach((row, r) => { field[r] = row.split(''); }); ids.forEach(start);
        } else if (message.zerkSnd === false) { active.clear(); walkers.clear(); paused = false; }
        if (paused || !active.size) { clearTimeout(timer); timer = 0; }
        publish(); run();
      },
      stream: () => destination ? destination.stream : null
    };
  };
})();
