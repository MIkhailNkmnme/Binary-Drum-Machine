/* ===========================================================================
   СТРЕЛКИ У ПОЛЗУНКОВ — общий модуль для всех машин Зеркалиуса.
   Подключается одной строкой:  <script src="_js/slider-arrows.js"></script>

   К каждому ползунку добавляются кнопки ◂ и ▸: клик — шаг на единицу шкалы,
   удержание — повтор. Колесо и перетаскивание годятся для грубой настройки,
   а точное значение пальцем не поймать.

   Панели в некоторых машинах собираются уже во время работы, поэтому за
   появлением новых ползунков следим наблюдателем.
   =========================================================================== */
(function () {
    if (window.__zerkSliderArrows) return;
    window.__zerkSliderArrows = true;

    const style = document.createElement('style');
    style.textContent = `
        .zerk-range-wrap { display: inline-flex; align-items: center; gap: 2px; flex: 1 1 auto;
            min-width: 0; vertical-align: middle; }
        .zerk-range-wrap > input[type="range"] { flex: 1 1 auto; min-width: 0; }
        .zerk-arrow { flex: 0 0 auto; width: 14px; height: 14px; padding: 0; line-height: 12px;
            font-size: 9px; color: #888; background: #1a1a1a; border: 1px solid #333;
            border-radius: 2px; cursor: pointer; user-select: none; font-family: inherit; }
        .zerk-arrow:hover { color: #00ff66; border-color: #00ff66; }
        .zerk-arrow:active { background: #00ff66; color: #000; }`;

    const stepper = (el, dir) => () => {
        const st = parseFloat(el.step) || 1;
        const min = parseFloat(el.min), max = parseFloat(el.max);
        let v = parseFloat(el.value);
        if (isNaN(v)) v = isNaN(min) ? 0 : min;
        v += dir * st;
        if (!isNaN(min)) v = Math.max(min, v);
        if (!isNaN(max)) v = Math.min(max, v);
        const dec = (String(st).split('.')[1] || '').length;
        el.value = dec ? v.toFixed(dec) : v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    function makeArrow(el, text, dir) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'zerk-arrow'; b.textContent = text; b.tabIndex = -1;
        const step = stepper(el, dir);
        let hold = null, rep = null;
        const stop = () => { clearTimeout(hold); clearInterval(rep); hold = rep = null; };
        b.addEventListener('mousedown', e => { e.preventDefault(); step();
            hold = setTimeout(() => { rep = setInterval(step, 55); }, 380); });
        ['mouseup', 'mouseleave', 'blur'].forEach(t => b.addEventListener(t, stop));
        b.addEventListener('touchstart', e => { e.preventDefault(); step(); }, { passive: false });
        return b;
    }

    function wrap(el) {
        if (!el || el.dataset.zerkArrowed) return;
        if (el.closest('.zerk-range-wrap') || el.closest('.range-with-arrows')) return;  // уже обёрнут
        if (!el.parentNode) return;
        el.dataset.zerkArrowed = '1';
        const w = document.createElement('span');
        w.className = 'zerk-range-wrap';
        // Ползунок мог растягиваться по месту — сохраняем это поведение за обёрткой.
        const cs = getComputedStyle(el);
        if (cs.flex && cs.flex !== '0 1 auto') w.style.flex = cs.flex;
        if (cs.width && cs.width !== 'auto' && cs.position !== 'absolute') w.style.width = cs.width;
        el.parentNode.insertBefore(w, el);
        w.appendChild(makeArrow(el, '◂', -1));
        w.appendChild(el);
        w.appendChild(makeArrow(el, '▸', +1));
    }

    const wrapAll = root => (root || document).querySelectorAll('input[type="range"]').forEach(wrap);

    function build() {
        document.head.appendChild(style);
        wrapAll();
        // панели некоторых машин рождаются позже — ловим их появление
        new MutationObserver(muts => {
            for (const m of muts) for (const n of m.addedNodes) {
                if (n.nodeType !== 1) continue;
                if (n.matches && n.matches('input[type="range"]')) wrap(n);
                else if (n.querySelectorAll) wrapAll(n);
            }
        }).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
    else build();
})();
