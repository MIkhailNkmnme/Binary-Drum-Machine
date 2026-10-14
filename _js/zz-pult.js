/* Общий пульт пуска / темпа: ◀ ▶ на концах, корпус с треугольниками, сходящимися к ромбу пуска, подпись скорости рядом с ромбом. v1.
   Подключается Синхрофазотроном, Синхроромбом и Зазеркалиусом. Вид задаёт только этот файл и zz-pult.css: правка здесь — правка везде.
   Страница сама создаёт кнопки и ползунок и вешает им классы:
     .zz-pult        — корпус (у Синхро — label темпа, у Зазеркалиуса — #zerkMotion);
     .zz-pult-back / .zz-pult-fwd — ◀ ▶; .zz-pult-play — ромб пуска; .zz-pult-value — подпись; .zz-pult-range — прозрачный ползунок.
   Каждый раз, когда меняется скорость или ширина, страница зовёт ZerkPult.sync(корпус, доля 0…1) — он рисует корпус и ставит ромб и подпись. */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const P = { H: 48, BODY: 36, CAP: 48, PLAY: 48, GAP: 30 };   // высота, высота корпуса, ширина ◀ ▶, ромб пуска, отступ подписи от ромба
  // Центр ромба пуска при доле f: ромб ходит между ◀ и ▶, не наезжая на них.
  const trackX = (W, f) => P.CAP + P.PLAY / 2 + Math.min(1, Math.max(0, f)) * Math.max(1, W - 2 * P.CAP - P.PLAY);
  // Сколько пикселей корпуса приходится на всю шкалу (для перетаскивания ромба).
  const trackWidth = host => Math.max(1, (host.offsetWidth || 480) - 2 * P.CAP - P.PLAY);
  function sync(host, f) {
    const W = host.offsetWidth; if (!W) return null;
    const H = host.offsetHeight || P.H, t = (H - P.BODY) / 2 + .5, b = H - (H - P.BODY) / 2 - .5, m = H / 2, L = P.CAP, R = W - P.CAP, tx = trackX(W, f);
    let svg = host.querySelector(':scope > svg.zz-pult-shape');
    if (!svg) {
      svg = document.createElementNS(NS, 'svg'); svg.classList.add('zz-pult-shape'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
      for (const c of ['body', 'glass']) { const p = document.createElementNS(NS, 'path'); p.classList.add(c); svg.append(p); }
      host.prepend(svg);
    }
    const vb = `0 0 ${W} ${H}`; if (svg.getAttribute('viewBox') !== vb) svg.setAttribute('viewBox', vb);
    const set = (el, a, v) => { if (el.getAttribute(a) !== v) el.setAttribute(a, v); };
    set(svg.children[0], 'd', `M${L} ${t}H${R}V${b}H${L}Z`);
    set(svg.children[1], 'd', `M${L} ${t}L${tx} ${m}L${L} ${b}ZM${R} ${t}L${tx} ${m}L${R} ${b}Z`);
    const css = (k, v) => { if (host.style.getPropertyValue(k) !== v) host.style.setProperty(k, v); };
    css('--zz-tx', tx.toFixed(1) + 'px');
    const value = host.querySelector(':scope > .zz-pult-value');
    if (value) { const vw = value.offsetWidth, right = tx + P.GAP, vx = right + vw <= R - 6 ? right : tx - P.GAP - vw; css('--zz-vx', Math.max(L + 4, vx).toFixed(1) + 'px'); }
    return tx;
  }
  window.ZerkPult = { version: 1, P, sync, trackX, trackWidth };
})();
