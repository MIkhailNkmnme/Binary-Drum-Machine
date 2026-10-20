/* HubRhombMusic v0.007: play(t) — сыграть одну ноту (биты ↓ хаба, переход в другой треугольник).
   HubRhombMusic v0.006: переключение исходного поля и Серпинского; «пусть первая 1 будет, а вторая удали; первую оставь на месте; при нажатии на неё она падает вниз на 11 между ними
   и все смежные единицы вниз толкает (вернее окраску — биты на месте) с разными скоростями: 1, … клеток в секунду» → «вершина вместо нот»,
   «переключатель скорости». Треугольник не меняется. Нажатие на вершину пускает окраску: шаг — следующая строка, окрашиваются все её единицы,
   смежные с окрашенными строкой выше (вниз-влево и вниз-вправо, ряды по центру); прежняя строка гаснет. Каждая новая строка звучит нотой
   по кругу До…Си (строка 1 — До) и окрашена её цветом. Дальше единиц нет или низ — окраска кончилась. Скорость — 1, 2, 4 или 8 строк в секунду.
   Повторное нажатие на вершину во время стекания — стоп. Сообщения — те же, что у прежних нот: { zerkSndOn, zerkSndHeads, zerkHeads, zerkRows }. */
(() => {
  'use strict';
  const frequencies = [261.626, 293.665, 329.628, 349.228, 391.995, 440, 493.883];
  window.HubRhombMusic = (rows, notify) => {
    const field = rows.map(row => row.split(''));
    let ctx, output, destination, timer = 0, speed = 1, front = [], row = -1, paused = false;
    const audio = () => {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        output = ctx.createGain(); output.gain.value = 0.3; output.connect(ctx.destination);
        destination = ctx.createMediaStreamDestination(); output.connect(destination);
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    };
    const tone = t => {
      if (!ctx) return;
      const oscillator = ctx.createOscillator(), gain = ctx.createGain(), now = ctx.currentTime;
      oscillator.type = 'sine'; oscillator.frequency.value = frequencies[t];
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.55, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      oscillator.connect(gain); gain.connect(output); oscillator.start(now); oscillator.stop(now + 0.37);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    };
    const on = () => timer !== 0 || (front.length > 0 && paused);
    const publish = () => notify({
      zerkSndOn: on(), zerkSndPaused: paused, zerkSndHeads: on() ? ['flood'] : [], zerkFloodSpeed: speed,
      zerkRows: field.map(r => r.join('')),
      zerkHeads: front.map(([r, j]) => [r, j, r % 7, '1'])
    });
    // Соседи вниз: ряды по центру, поэтому колонка в ряду ниже — x ± ½ клетки (x = j − (длина − 1) / 2)
    const below = (r, j) => {
      const nr = r + 1; if (nr >= field.length) return [];
      const x = j - (field[r].length - 1) / 2, out = [];
      for (const dx of [-0.5, 0.5]) {
        const nj = x + dx + (field[nr].length - 1) / 2;
        if (Number.isInteger(nj) && nj >= 0 && nj < field[nr].length && field[nr][nj] === '1') out.push(nj);
      }
      return out;
    };
    const stop = () => { clearTimeout(timer); timer = 0; front = []; row = -1; paused = false; };
    const step = () => {
      timer = 0; if (paused) return;
      const next = new Set(); for (const [r, j] of front) for (const nj of below(r, j)) next.add(nj);
      if (!next.size) { stop(); publish(); return; }
      row++; front = [...next].sort((a, b) => a - b).map(j => [row, j]); tone(row % 7);
      timer = setTimeout(step, 1000 / speed); publish();
    };
    const start = () => { stop(); row = 0; front = [[0, 0]]; tone(0); timer = setTimeout(step, 1000 / speed); publish(); };
    return {
      snapshot:()=>({rows:field.map(r=>r.join('')),front:front.map(p=>p.slice()),row,speed,paused,running:on()}),
      restore(s){stop();field.splice(0,field.length,...s.rows.map(r=>r.split('')));speed=Math.max(1,Math.min(8,s.speed||1));row=Math.max(-1,Math.min(field.length-1,s.row|0));front=(s.front||[]).filter(p=>Array.isArray(p)&&Number.isInteger(p[0])&&Number.isInteger(p[1])&&field[p[0]]?.[p[1]]).map(p=>p.slice(0,2));paused=!!s.paused;if(s.running&&front.length&&!paused){audio();timer=setTimeout(step,1000/speed);}publish();},
      setRows(rows) { stop(); field.splice(0, field.length, ...rows.map(r => r.split(''))); publish(); },
      send(message) {
        audio();
        if (message.zerkFlood) { if (on()) stop(); else start(); }
        else if (message.zerkFloodSpeed) { speed = Math.max(1, Math.min(8, message.zerkFloodSpeed | 0)); }
        else if (message.zerkSndToggle && on()) { paused = !paused; if (!paused && !timer) timer = setTimeout(step, 1000 / speed); else if (paused) { clearTimeout(timer); timer = 0; } }
        else if (message.zerkSndReset || message.zerkSnd === false) stop();
        publish();
      },
      play(t) { audio(); tone(((t | 0) % 7 + 7) % 7); },   // v0.007: одна нота — для бегающих битов ↓ хаба
      // Hub v0.388, «видео пишет звук? надо»: звук заводился только с первой ноты — запись, начатая раньше, шла без звуковой дорожки;
      // теперь «Видео» само заводит звук (щелчок — жест пользователя, браузер разрешает), и ноты попадают в ролик всегда
      stream: () => { try { audio(); } catch (e) { return null; } return destination ? destination.stream : null; }
    };
  };
})();
