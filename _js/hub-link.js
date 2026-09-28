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
    const up = depth > 0 && /\/(fold|fold-layers|oktaedr|zazerkalius|lively|oboi|issledovanie|rezultaty|sravnenie)\//.test(location.pathname) ? '../' : '';
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
                background: none; border: none; opacity: .8; line-height: 0;
                transition: opacity .2s, box-shadow .2s; }
            #zerkHubBtn > img { width: 100%; height: 100%; display: block; border-radius: 6px; }
            #zerkHubBtn:hover { opacity: 1; box-shadow: 0 0 10px rgba(124,212,255,.55); }
            #zerkHubBtn.zh-corner { position: fixed; left: 8px; top: 8px; z-index: 99999; }
            body.zen-mode #zerkHubBtn { opacity: .18; }`;
        document.head.appendChild(css);

        const a = document.createElement('a');
        a.id = 'zerkHubBtn'; a.href = href;
        const img = document.createElement('img'); img.src = logo; img.alt = '⌂'; img.draggable = false;
        a.appendChild(img);
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
