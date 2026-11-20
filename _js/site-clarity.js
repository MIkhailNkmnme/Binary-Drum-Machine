/* Microsoft Clarity · Zerkalius · project zgrdv8rmj3.
 * Shared by public pages; settings and installation notes: site-clarity.md.
 */
(function () {
    'use strict';

    // Do not record local copies, previews or embedded copies as separate visits.
    if (location.hostname !== '1001100.online' && location.hostname !== 'www.1001100.online') return;
    if (window.top !== window.self || window.__zerkaliusClarityLoaded) return;
    window.__zerkaliusClarityLoaded = true;

    // Official Clarity bootstrap. Keep the project's default masking and consent settings.
    (function (c, l, a, r, i, t, y) {
        c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
        t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
        y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', 'zgrdv8rmj3');
})();
