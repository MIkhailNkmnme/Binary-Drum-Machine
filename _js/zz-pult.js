/* Общий пульт пуска / темпа: ◀ ▶ на концах, корпус с треугольниками, сходящимися к ромбу пуска, подпись скорости рядом с ромбом. v3 (ПЛ03 v17: ромб от основания до основания стрелки, нажатие в зазоре ромба и рядом с ним — ромбу).
   Подключается Синхрофазотроном, Синхроромбом и Зазеркалиусом. Вид задаёт только этот файл и zz-pult.css: правка здесь — правка везде.
   Страница сама создаёт кнопки и ползунок и вешает им классы:
     .zz-pult        — корпус (у Синхро — label темпа, у Зазеркалиуса — #zerkMotion);
     .zz-pult-back / .zz-pult-fwd — ◀ ▶; .zz-pult-play — ромб пуска; .zz-pult-value — подпись; .zz-pult-range — прозрачный ползунок.
   Каждый раз, когда меняется скорость или ширина, страница зовёт ZerkPult.sync(корпус, доля 0…1) — он рисует корпус и ставит ромб и подпись. */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const P = { H: 48, BODY: 36, CAP: 48, PLAY: 48, GAP: 30 };   // высота, высота корпуса, ширина ◀ ▶, ромб пуска, отступ подписи от ромба
  // Центр ромба пуска при доле f: ромб ходит между ◀ и ▶, не наезжая на них.
  // v3: ширина ромба пуска — data-play у пульта (хаб: 24, «ширину ромба бегунка в 2 раза сузь»), иначе P.PLAY; ромб доходит до ◀ ▶ вплотную
  const playW = host => +host?.dataset?.play || P.PLAY;
  // v4: низкий пульт — data-cap (ширина ◀ ▶) и data-body (высота стрелок) у пульта; иначе P.CAP / P.BODY
  const capW = host => +host?.dataset?.cap || P.CAP, bodyH = host => +host?.dataset?.body || P.BODY;
  // v3: центр ромба ходит от основания одной стрелки (x = CAP) до основания другой (x = W − CAP)
  const trackX = (W, f, pw = P.PLAY, cw = P.CAP) => cw + Math.min(1, Math.max(0, f)) * Math.max(1, W - 2 * cw);
  // Сколько пикселей корпуса приходится на всю шкалу (для перетаскивания ромба).
  const trackWidth = host => Math.max(1, (host.offsetWidth || 480) - 2 * capW(host));
  // v3: нажатие в зазоре раздвинутого ромба (оно приходит ползунку) и в 4 px от ромба на стрелке достаётся ромбу:
  // щелчок — пуск / пауза, протяжка — скорость (то, что делает ромб сам). Один обработчик на пульт, ставится при первой отрисовке.
  function bind(host) {
    if (host.__zzPultBound) return; host.__zzPultBound = true;
    host.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.__zzPult) return;
      const a = e.target.closest?.('.zz-pult-back, .zz-pult-fwd, .zz-pult-range'); if (!a || !host.contains(a)) return;
      const p = host.querySelector(':scope > .zz-pult-play'); if (!p) return;
      const r = p.getBoundingClientRect(), m = a.matches('.zz-pult-range') ? 0 : 4;
      if (e.clientX < r.left - m || e.clientX > r.right + m || e.clientY < r.top || e.clientY > r.bottom) return;
      e.preventDefault(); e.stopPropagation();
      const onClick = ev => { ev.preventDefault(); ev.stopImmediatePropagation(); p.click(); };
      document.addEventListener('click', onClick, { capture: true, once: true });
      document.addEventListener('pointerup', () => setTimeout(() => document.removeEventListener('click', onClick, true), 0), { once: true });
      const ne = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY, button: 0, buttons: e.buttons, pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: e.isPrimary });
      ne.__zzPult = true; p.dispatchEvent(ne);
    }, true);
  }
  function sync(host, f) {
    const W = host.offsetWidth; if (!W) return null;
    const BODY = bodyH(host), CAP = capW(host), H = host.offsetHeight || P.H, t = (H - BODY) / 2 + .5, b = H - (H - BODY) / 2 - .5, m = H / 2, L = CAP, R = W - CAP, tx = trackX(W, f, playW(host), CAP);
    let svg = host.querySelector(':scope > svg.zz-pult-shape');
    if (!svg) {
      svg = document.createElementNS(NS, 'svg'); svg.classList.add('zz-pult-shape'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
      for (const c of ['body', 'glass']) { const p = document.createElementNS(NS, 'path'); p.classList.add(c); svg.append(p); }
      host.prepend(svg);
    }
    const vb = `0 0 ${W} ${H}`; if (svg.getAttribute('viewBox') !== vb) svg.setAttribute('viewBox', vb);
    const set = (el, a, v) => { if (el.getAttribute(a) !== v) el.setAttribute(a, v); };
    set(svg.children[0], 'd', `M${L} ${t}H${R}V${b}H${L}Z`);
    // v3: «стекло» — только заливка; вертикальные края на x = CAP и W − CAP по высоте шевронов (0,6 высоты стрелок вокруг середины)
    const gt = (m - BODY * .3).toFixed(1), gb = (m + BODY * .3).toFixed(1);
    set(svg.children[1], 'd', `M${L} ${gt}L${tx} ${m}L${L} ${gb}ZM${R} ${gt}L${tx} ${m}L${R} ${gb}Z`);
    bind(host);
    const css = (k, v) => { if (host.style.getPropertyValue(k) !== v) host.style.setProperty(k, v); };
    css('--zz-tx', tx.toFixed(1) + 'px'); css('--zz-pw', playW(host) + 'px');
    const value = host.querySelector(':scope > .zz-pult-value');
    if (value) { const vw = value.offsetWidth, right = tx + P.GAP, vx = right + vw <= R - 6 ? right : tx - P.GAP - vw; css('--zz-vx', Math.max(L + 4, vx).toFixed(1) + 'px'); }
    return tx;
  }
  // v2, «сделай универсальным, чтобы менялся» (выбор на карточке: множитель ×N): подпись скорости везде одна — во сколько раз быстрее обычной.
  // Точное значение (обороты, °/с, шаги) страница кладёт в подсказку подписи.
  const label = x => '×' + (Number.isFinite(x) && x > 0 ? String(Number(x.toPrecision(x < 10 ? 2 : 3))).replace('.', ',') : '0');
  window.ZerkPult = { version: 3, P, sync, trackX, trackWidth, label };
})();
