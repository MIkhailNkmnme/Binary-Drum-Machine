/* ===========================================================================
   ЗНАЧОК «В ХАБ» — один и тот же во всех машинах Зеркалиуса.
   Подключается одной строкой:  <script src="_js/hub-link.js"></script>

   Путь до хаба вычисляется сам, поэтому модуль одинаково работает и в корне,
   и во вложенных папках вроде fold-layers/.

   2026-09-28, слово пользователя: «oktaedr — лого на сайт, и на значок „в Хаб“ на
   всех; поменяй расположение кнопки хаб, как тут сделал» (Zazerkalius v0.321 — в
   шапке перед заголовком). Теперь:
   - на значке — знак Zerkalius (oktaedr/zerkalius-mark.svg) вместо ⌂;
   - значок стоит в шапке, перед заголовком страницы (#appTitle или первый h1),
     в строку с ним; заголовка нет или он спрятан — в левом верхнем углу;
     window.zerkHubSlot = 'селектор' (ДО подключения) — поставить перед другим местом;
   - тот же знак — значком вкладки (favicon), если своего у страницы нет.
   =========================================================================== */
(function () {
    if (window.__zerkHubLink) return;
    window.__zerkHubLink = true;

    const depth = location.pathname.replace(/\/[^/]*$/, '').split('/').filter(Boolean).length;
    // На GitHub Pages проект лежит в корне домена, поэтому считаем от текущей папки:
    // в корне это index.html, во вложенной папке — на уровень выше.
    const up = depth > 0 && /\/(fold|fold-layers|oktaedr|zazerkalius|lively|oboi|issledovanie|rezultaty|sravnenie|prosmotr)\//.test(location.pathname) ? '../' : '';
    const href = up + 'index.html', logo = up + 'oktaedr/zerkalius-mark.svg';

    function favicon() {
        const old = document.querySelector('link[rel~="icon"]');
        if (old && old.getAttribute('href') && old.getAttribute('href') !== 'data:,') return;   // свой значок у страницы — не трогаем
        const l = old || document.createElement('link');
        l.rel = 'icon'; l.type = 'image/svg+xml'; l.href = logo;
        if (!old) document.head.appendChild(l);
    }

    function slot() {
        const sel = window.zerkHubSlot || '#appTitle, h1';
        let el = null;
        try { el = document.querySelector(sel); } catch (e) { el = null; }
        if (!el) return null;
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        // спрятанный заголовок (для программ чтения, как в хабе) или ушедший вниз страницы — не место для значка
        if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 20 || r.height < 8 || r.top > 200) return null;
        return el;
    }

    function build() {
        if (document.getElementById('zerkHubBtn')) return;
        favicon();
        const css = document.createElement('style');
        css.textContent = `
            #zerkHubBtn { display: inline-flex; align-items: center; justify-content: center;
                width: 26px; height: 26px; padding: 0; margin: 0 8px 0 0; vertical-align: middle;
                border-radius: 6px; cursor: pointer; text-decoration: none; flex: 0 0 auto;
                background: #12141a; border: none; opacity: .92; line-height: 0; overflow: hidden;
                transition: opacity .2s, box-shadow .2s; }
            #zerkHubBtn > canvas { width: 100%; height: 100%; display: block; }
            #zerkHubBtn:hover { opacity: 1; box-shadow: 0 0 10px rgba(124,212,255,.55); }
            #zerkHubBtn.zh-corner { position: fixed; left: 8px; top: 8px; z-index: 99999; }
            body.zen-mode #zerkHubBtn { opacity: .18; }`;
        document.head.appendChild(css);

        const a = document.createElement('a');
        a.id = 'zerkHubBtn'; a.href = href;
        /* 2026-09-28, «кнопка хаба должна быть как в лого, но 3D, и крутящаяся, светящаяся»: знак Zerkalius (песочные часы: верх голубой,
           низ золотой, пояс светлый) — объёмным телом на холсте (с 2026-09-29 — Зеркалидус, треугольная бипирамида; прежде октаэдр): крутится вокруг оси, светится, свечение дышит. Ближние рёбра ярче
           дальних. Вкладка скрыта — не рисуется (requestAnimationFrame стоит сам) */
        const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); a.appendChild(cv);
        const draw = (t) => {
            if (!cv.isConnected) return;
            if (!a.getClientRects().length) { setTimeout(() => requestAnimationFrame(draw), 500); return; }   // спрятан (дзен, фон хаба) — не рисовать
            const s =Math.round(a.clientWidth || 26), d = window.devicePixelRatio || 1;
            if (cv.width !== Math.round(s * d)) { cv.width = cv.height = Math.round(s * d); }
            const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, s, s);
            const yaw = t / 1000 * 1.1, tilt = 0.32, R = s * 0.34, cx = s / 2, cy = s / 2;
            const P = (x, y, z) => {
                const x1 = x * Math.cos(yaw) - z * Math.sin(yaw), z1 = x * Math.sin(yaw) + z * Math.cos(yaw);
                const y1 = y * Math.cos(tilt) - z1 * Math.sin(tilt), z2 = y * Math.sin(tilt) + z1 * Math.cos(tilt), k = 3.2 / (3.2 + z2);
                return [cx + x1 * R * k, cy - y1 * R * 1.15 * k, z2];
            };
            // 2026-09-29, «Зеркалидус — это Три, переделай знак»: экватор — три вершины (треугольная пирамида и её зеркало), прежде — четыре (октаэдр)
            const top = P(0, 1, 0), bot = P(0, -1, 0), eq = [0, 1, 2].map(i => P(Math.cos(i * 2 * Math.PI / 3), 0, Math.sin(i * 2 * Math.PI / 3)));
            const glow = 4 + 2.5 * Math.sin(t / 1000 * 2.2);
            g.lineWidth = 1.7; g.lineCap = 'round';
            const edge = (p, q, col) => { const z = (p[2] + q[2]) / 2; g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = z > 0.15 ? 0 : glow;
                g.globalAlpha = z > 0.15 ? 0.32 : 1; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); };
            eq.forEach((e, i) => { edge(top, e, '#7cd4ff'); edge(bot, e, '#ffcf6b'); edge(e, eq[(i + 1) % eq.length], '#d8dce6'); });
            g.globalAlpha = 1; g.shadowBlur = 0;
            if (!document.hidden) requestAnimationFrame(draw); else document.addEventListener('visibilitychange', () => requestAnimationFrame(draw), { once: true });
        };
        requestAnimationFrame(draw);
        // window.zerkHubNoKey = true (ставится ДО подключения модуля) — у страницы своя клавиша H, например
        // методичка Октаэдра; тогда в Хаб ведёт только значок.
        a.title = window.zerkHubNoKey ? 'В Хаб' : 'В Хаб (H)';
        // щелчок по значку — только в Хаб: у заголовка бывает свой щелчок (в Code — перезагрузка)
        a.addEventListener('click', e => e.stopPropagation());
        const t = slot();
        if (t) t.insertBefore(a, t.firstChild);
        else { a.classList.add('zh-corner'); document.body.appendChild(a); }

        if (!window.zerkHubNoKey) document.addEventListener('keydown', e => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (!['h', 'H', 'р', 'Р'].includes(e.key)) return;
            const tg = e.target.tagName;
            if (tg === 'INPUT' || tg === 'TEXTAREA' || e.target.isContentEditable) return;
            location.href = href;
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
    else build();
})();
