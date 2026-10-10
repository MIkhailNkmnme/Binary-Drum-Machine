/* HubRhombMusic v0.002: notes move up-right without turning.
   An encountered 1 is pushed down-right; the boundary closes the route. */
(() => {
  'use strict';
  const ids = ['r', 'c', 'mi', 'fa', 'sol', 'la', 'si'];
  const starts = [[0, 0], [1, 0], [2, 0], [2, 1], [3, 0], [3, 1], [3, 2]];
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
    const advance = walker => {
      const [r, j] = walker.pos;
      // Up-right follows one column of the triangular lattice. At its upper
      // edge the same line continues from its lowest cell, without reversing.
      let nr = r - 1;
      if (nr < 0 || j >= field[nr].length) {
        nr = field.length - 1;
        while (nr >= 0 && j >= field[nr].length) nr--;
      }
      if (nr < 0) return;
      const target = [nr, j], old = walker.pos;
      if (same(target, old) || occupied(target, walker)) return;
      const changes = new Map([[old.join(':'), { pos: old, bit: '0' }]]);
      const read = p => changes.get(p.join(':'))?.bit ?? field[p[0]][p[1]];
      const write = (pos, bit) => changes.set(pos.join(':'), { pos, bit });
      let p = target; const seen = new Set();
      while (read(p) === '1') {
        const key = p.join(':'); if (seen.has(key) || occupied(p, walker)) return; seen.add(key);
        const dr = p[0] + 1, dc = p[1] + (field[dr] && field[dr].length > field[p[0]].length ? 1 : 0);
        // A bit pushed past the lower edge fills the place vacated by the note:
        // the whole exchange is a closed cycle, conserving the number of 1s.
        const next = dr < field.length && dc < field[dr].length ? [dr, dc] : old;
        if (occupied(next, walker)) return;
        if (read(next) === '0') { write(next, '1'); break; }
        p = next;
      }
      write(target, walker.bit);
      for (const { pos, bit } of changes.values()) field[pos[0]][pos[1]] = bit;
      walker.pos = target;
    };
    const tick = () => {
      timer = 0; if (paused || !active.size) return;
      for (let q = 0; q < ids.length; q++) {
        cursor = (cursor + 1) % ids.length; const id = ids[cursor]; if (!active.has(id)) continue;
        const walker = walkers.get(id); advance(walker); tone(cursor, walker.pos); break;
      }
      publish(); timer = setTimeout(tick, 1000 / 6);
    };
    const run = () => { if (!timer && !paused && active.size) timer = setTimeout(tick, 1000 / 6); };
    const start = id => {
      const t = ids.indexOf(id); if (occupied(starts[t], walkers.get(id))) return;
      // A newly launched note is always its original coloured 1, even if an
      // earlier exchange has left a 0 at its starting place.
      field[starts[t][0]][starts[t][1]] = '1';
      active.add(id); walkers.set(id, { pos: starts[t].slice(), bit: '1' });
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
