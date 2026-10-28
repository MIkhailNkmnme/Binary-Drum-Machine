'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const menu = fs.readFileSync(path.join(__dirname, 'hub-compare-menu.js'), 'utf8');
const has = (hay, needle, why) => assert.ok(hay.includes(needle), why || `не найдено: ${needle.slice(0, 90)}`);

test('левый треугольник — меню страниц, правый — сравнение', () => {
  has(html, '<div class="hubCompareDrawer" id="hubMenuDrawer">');
  has(html, 'id="hubMenuHandle"');
  has(html, 'aria-label="Меню страниц"');
  has(html, 'aria-controls="hubSidebarMenu"');
  has(html, '<div class="hub" id="hubSidebarMenu">');
  const start = html.indexOf('id="hubMenuDrawer"');
  const left = html.slice(start, html.indexOf('</div>', start));
  assert.ok(!left.includes('hubCompareDrawerBody'), 'у левого треугольника нет своего выпадающего тела');
});

test('вид и статистика живут в одном правом столбце', () => {
  const body = html.slice(html.indexOf('id="hubCompareViewMenu"'), html.indexOf('id="hubCompareZen"'));
  for (const id of ['hubCompareMode', 'hubCompareMirror', 'hubComparePairs', 'hubComparePalette', 'hubCompareCounts', 'hubCompareAreas', 'hubCompareEvents']) {
    assert.ok(body.includes(`id="${id}"`), `${id} внутри правого столбца`);
  }
});

test('на компьютере меню скрыто, пока не открыто', () => {
  has(html, 'body:not(.hubMenuOpen) #hubSidebarMenu>.mainrow,body:not(.hubMenuOpen) #hubSidebarMenu>.panel{display:none!important}');
  has(html, 'body:not(.hubMenuOpen) .hub{pointer-events:none}');
  has(html, 'body.hubMenuOpen #hubSidebarMenu>.mainrow,body.hubMenuOpen #hubSidebarMenu>.panel{animation:hubMenuIn');
});

test('палитра раскрывается влево, столбец прокручивается', () => {
  has(html, '#hubCompareViewMenu #hubComparePaletteMenu{top:0;right:calc(100% + 6px)}');
  has(html, '#hubCompareViewMenu{max-height:calc(100dvh - 96px);overflow-y:auto');
});

test('модуль меню: задержка наведения, закреп щелчком, Esc, узкий экран', () => {
  has(html, '<script src="_js/hub-compare-menu.js?v=2"></script>');
  has(menu, "const menuEl = () => document.getElementById('hubSidebarMenu')", 'меню ищется по требованию: оно ниже в разметке');
  has(menu, 'setTimeout(openMenu, 110)');
  has(menu, 'if (!pinned) closeMenu(); }, 260)');
  has(menu, "if (event.key !== 'Escape') return;");
  has(menu, 'if (narrow()) { event.preventDefault(); menuEl()?.scrollIntoView');
  has(menu, 'function wireMenu(menu = menuEl())');
  has(menu, "filter(drawer => drawer.querySelector('.hubCompareDrawerBody'))", 'левый треугольник без тела не ломает модуль');
});

test('наложение полей 1, 2, 3: отдельные кнопки и общая логика XOR/AND', () => {
  const bg = fs.readFileSync(path.join(__dirname, 'hub-xor-background.js'), 'utf8');
  for (const field of [1, 2, 3]) {
    has(html, `data-hub-field="${field}"`, `кнопка поля ${field}`);
    has(html, `<span class="gz-nm">${field}</span>`, `подпись поля ${field}`);
  }
  assert.ok(!html.includes('data-hub-pair'), 'прежних парных кнопок нет');
  has(html, 'aria-label="Какие поля накладывать: 1 — конусы 5.7, 2 — обе стороны 5.9, 3 — всё поле 5.8"');
  has(bg, 'const FIELDS = [1, 2, 3]');
  has(bg, 'function selectedFields()');
  has(bg, 'ones % 2', 'XOR — нечётное число единиц');
  has(bg, 'all ? 1 : 0', 'AND — единица во всех включённых полях');
  has(bg, "field.key !== 'left'", 'зеркально читаются поля 2 и 3, поле 1 — прямое');
  has(bg, 'view.fields.length === 1', 'последнее включённое поле не выключается');
});
