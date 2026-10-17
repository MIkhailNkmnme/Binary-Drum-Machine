/* Hub v0.231: кнопки страниц слева — вариант А витрины knopki/hub-stranicy.html («F вариант» = «А»): компактные полосы
   со значком и подписью, главные — по одной в ряд, разделы — в два столбца. Полное имя — в подсказке. */
(() => {
  'use strict';
  const P = {tri:'M12 4l8 15H4z',mirror:'M12 3v18M4 7l5 5-5 5zM20 7l-5 5 5 5z',load:'M5 8h6l2 3h7l-3 8H5zM12 3v9M9 9l3 3 3-3',image:'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.1',
    target:'M12 3v4M12 17v4M3 12h4M17 12h4M15 12a3 3 0 11-6 0 3 3 0 016 0',swap:'M4 9h14l-3-3M20 15H6l3 3',play:'M9 6l9 6-9 6z',eye:'M3 12q9-12 18 0-9 12-18 0M15 12a3 3 0 11-6 0 3 3 0 016 0',
    bars:'M6 18V10M12 18V6M18 18v-5',axes:'M12 3v18M3 12h18M9 6l3-3 3 3M18 9l3 3-3 3',spiral:'M12 12a2 2 0 012 2 4 4 0 01-4 4 6 6 0 01-6-6 8 8 0 018-8',bolt:'M13 3L5 14h6l-1 7 8-11h-6z',
    grid4:'M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z',cube:'M12 3l8 4v10l-8 4-8-4V7zM4 7l8 5 8-5M12 12v9',nest:'M12 4l8 8-8 8-8-8zM12 9l3 3-3 3-3-3z',dots:'M6 12h1M11.5 12h1M17 12h1',
    half:'M20 12a8 8 0 11-16 0 8 8 0 0116 0M12 4v16',sun:'M16 12a4 4 0 11-8 0 4 4 0 018 0M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',curve:'M4 12c3-7 6-7 8 0s5 7 8 0',
    steps:'M4 20v-5h5v-5h5V5h6',loop:'M7 16a4 4 0 010-8h10a4 4 0 010 8H7',wave:'M3 12q3-6 6 0t6 0 6 0',square:'M6 6h12v12H6z',star:'M12 3l2.6 6 6.4.5-4.9 4.2 1.5 6.3L12 16.6 6.4 20l1.5-6.3L3 9.5l6.4-.5z',page:'M6 3h9l3 3v15H6z'};
  // значок — по адресу страницы (первое совпадение)
  const ICON = [['treugolnik','tri'],['zazerkalius.html#','axes'],['zazerkalius','mirror'],['dnevnik','load'],['oboi','image'],['issledovanie','target'],['sravnenie','swap'],['rezultaty','play'],
    ['prosmotr','eye'],['code','bars'],['genezis','spiral'],['gpu','bolt'],['grid-module','grid4'],['kubits','cube'],['layers','nest'],['ascii','dots'],['oktaedr.html','half'],['lively','sun'],
    ['hub-konus','curve'],['piramida','steps'],['sinhrofazotron','loop'],['mayatnik','wave'],['matryoshki','square'],['sinhroromb','star']];
  // длинные имена — короче, полное — в подсказке
  const SHORT = {'Исследование':'Исследов.','Битмультфильмы':'Битмульт.','Просмотр GIF':'GIF','Ядро GPU + синт':'GPU + синт','Модуль сетки':'Сетка','Хаб с конусом':'Хаб-конус','Синхрофазотрон':'Синхрофаз.'};
  // подпись в свёрнутом меню — до 6 букв
  const MINI = {'Треугольник':'Треуг.','Зазеркалиус':'Зазерк.','Борт-журнал':'Журнал','Исследование':'Исслед.','Сравнение':'Сравн.','Битмультфильмы':'Мульт.','Просмотр GIF':'GIF',
    'Зеркалиус':'Зерк.','Генезис':'Генез.','Ядро GPU + синт':'GPU','Модуль сетки':'Сетка','Слои сгиба':'Слои','ASCII-арт':'ASCII','Бирамида':'Бирам.','Обои Lively':'Lively',
    'Хаб с конусом':'Конус','Пирамида':'Пирам.','Синхрофазотрон':'Синхр.','Маятник':'Маятн.','Матрёшки':'Матр.','Синхроромб':'Ромб'};
  const build = () => {
    document.querySelectorAll('.hub a.menu-btn').forEach(a => {
      if (a.firstElementChild?.classList.contains('hubPgIcon')) return;
      const href = a.getAttribute('href') || '', label = a.getAttribute('aria-label') || a.dataset.ru || a.textContent.trim();
      const k = (ICON.find(([s]) => href.includes(s)) || [, 'page'])[1];
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), path = document.createElementNS('http://www.w3.org/2000/svg', 'path'), t = document.createElement('span');
      svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.classList.add('hubPgIcon'); path.setAttribute('d', P[k]); svg.append(path);
      t.className = 'hubPgText'; t.textContent = SHORT[label] || label;
      const m = document.createElement('span'); m.className = 'hubPgMini'; m.textContent = MINI[label] || label;
      a.replaceChildren(svg, t, m); a.classList.add('hubPg', 'rmbOn'); a.setAttribute('aria-label', label); if (!a.title) a.title = label;
    });
    // v0.242: меню в 1,5 раза уже — не влезающее название берёт короткую подпись свёрнутого меню
    document.querySelectorAll('.hub a.menu-btn.hubPg .hubPgText').forEach(t => { const a = t.parentElement, label = a.getAttribute('aria-label'); t.textContent = SHORT[label] || label; if (t.clientWidth && t.scrollWidth > t.clientWidth && MINI[label]) t.textContent = MINI[label]; });
    // свёрнутое меню: ромбы ёлочкой — каждый второй сдвинут вправо на полромба, раздел начинается заново
    document.querySelectorAll('.hub .mainrow, .hub .panel').forEach(box => box.querySelectorAll('a.menu-btn.hubPg').forEach((a, i) => { a.classList.toggle('hubPgOdd', i % 2 === 1); a.classList.toggle('hubPgFirst', i === 0); }));
  };
  // index.html сам зовёт hubMenuGrid() (надписи ромбами) — после неё ставим свои полосы
  const grid = window.hubMenuGrid; window.hubMenuGrid = () => { grid?.(); build(); };
  window.hubPages = build;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
