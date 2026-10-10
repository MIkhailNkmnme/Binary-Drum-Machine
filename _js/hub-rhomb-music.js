/* HubRhombMusic v0.001: seven starting bits (1 / 1 / 11 / 111).
   Each turn moves one note to an adjacent row: down into 1, up into 0. */
(() => {
  'use strict';
  const ids = ['r', 'c', 'mi', 'fa', 'sol', 'la', 'si'];
  const starts = [[0, 0], [1, 0], [2, 0], [2, 1], [3, 0], [3, 1], [3, 2]];
  const frequencies = [261.626, 293.665, 329.628, 349.228, 391.995, 440, 493.883];
  window.HubRhombMusic = (rows, notify) => {
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
      zerkHeads: ids.flatMap((id, t) => active.has(id) ? [[...walkers.get(id).pos, t]] : [])
    });
    const tone = (t, pos) => {
      if (!ctx || rows[pos[0]][pos[1]] !== '1') return;
      const oscillator = ctx.createOscillator(), gain = ctx.createGain(), now = ctx.currentTime;
      oscillator.type = 'sine'; oscillator.frequency.value = frequencies[t];
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.55, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      oscillator.connect(gain); gain.connect(output); oscillator.start(now); oscillator.stop(now + 0.16);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    };
    const advance = walker => {
      const [r, j] = walker.pos, x = j - (rows[r].length - 1) / 2, choices = [];
      for (const [nr, bit] of [[r + 1, '1'], [r - 1, '0']]) {
        const row = rows[nr]; if (!row) continue;
        const centre = x + (row.length - 1) / 2;
        for (const nj of new Set([Math.floor(centre), Math.ceil(centre)])) {
          if (nj >= 0 && nj < row.length && Math.abs(nj - centre) <= 0.5 && row[nj] === bit) choices.push([nr, nj]);
        }
      }
      const forward = choices.filter(p => !walker.previous || p[0] !== walker.previous[0] || p[1] !== walker.previous[1]);
      const allowed = forward.length ? forward : choices;
      if (allowed.length) { walker.previous = walker.pos; walker.pos = allowed[Math.floor(Math.random() * allowed.length)]; }
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
      active.add(id); const t = ids.indexOf(id);
      walkers.set(id, { pos: starts[t].slice(), previous: null });
    };
    return {
      send(message) {
        audio();
        if (message.zerkSndHead && ids.includes(message.zerkSndHead)) {
          if (message.on) start(message.zerkSndHead); else { active.delete(message.zerkSndHead); walkers.delete(message.zerkSndHead); }
        } else if (message.zerkSndToggle && active.size) paused = !paused;
        else if (message.zerkSndReset || message.zerkSnd === true) {
          active.clear(); walkers.clear(); cursor = -1; paused = false; ids.forEach(start);
        } else if (message.zerkSnd === false) { active.clear(); walkers.clear(); paused = false; }
        if (paused || !active.size) { clearTimeout(timer); timer = 0; }
        publish(); run();
      },
      stream: () => destination ? destination.stream : null
    };
  };
})();
