/* ===========================================================================
   ЗНАЧОК «В ХАБ» — один и тот же во всех машинах Зеркалиуса.
   Подключается одной строкой:  <script src="_js/hub-link.js"></script>

   Путь до хаба вычисляется сам, поэтому модуль одинаково работает и в корне,
   и во вложенных папках вроде fold-layers/. Кнопка стоит в левом нижнем углу —
   напротив кнопки записи, чтобы они не спорили за место.
   =========================================================================== */
(function () {
    if (window.__zerkHubLink) return;
    window.__zerkHubLink = true;

    const depth = location.pathname.replace(/\/[^/]*$/, '').split('/').filter(Boolean).length;
    // На GitHub Pages проект лежит в корне домена, поэтому считаем от текущей папки:
    // в корне это index.html, во вложенной папке — на уровень выше.
    const href = depth > 0 && /\/(fold|fold-layers|oktaedr)\//.test(location.pathname)
        ? '../index.html' : 'index.html';

    function build() {
        if (document.getElementById('zerkHubBtn')) return;
        const css = document.createElement('style');
        css.textContent = `
            #zerkHubBtn { position: fixed; left: 10px; bottom: 10px; z-index: 99999;
                width: 38px; height: 38px; border-radius: 50%; cursor: pointer;
                background: #0a0a0a; color: #00ff66; border: 1px solid #1d3a2a;
                font-size: 17px; line-height: 1; display: flex; align-items: center;
                justify-content: center; text-decoration: none; opacity: .5;
                transition: opacity .2s, background .2s, box-shadow .2s; }
            #zerkHubBtn:hover { opacity: 1; background: #06170f; box-shadow: 0 0 12px rgba(0,255,102,.45); }
            body.zen-mode #zerkHubBtn { opacity: .18; }`;
        document.head.appendChild(css);

        const a = document.createElement('a');
        a.id = 'zerkHubBtn'; a.href = href; a.textContent = '⌂';
        a.title = 'В Хаб (H)';
        document.body.appendChild(a);

        document.addEventListener('keydown', e => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (!['h', 'H', 'р', 'Р'].includes(e.key)) return;
            const t = e.target.tagName;
            if (t === 'INPUT' || t === 'TEXTAREA' || e.target.isContentEditable) return;
            location.href = href;
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
    else build();
})();
