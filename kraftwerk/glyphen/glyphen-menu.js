/* Readable presentation only: original controls, numeric text and mathematical state stay intact. */
(function () {
 'use strict';
 window.GlyphenMenu = {mount() {
  const compactNames = {
   'Случайный порядок':'Вразброс','Исходные позиции':'Исходные','Синяя палитра':'Палитры',
   'Нули под единицами':'Нули под 1','Верхняя клетка':'Верхняя 1','Только выбранная':'Выбранная',
   'Поиск в кадре':'В кадре','По всем кадрам':'Все кадры','Сквозные линии':'Сквозные','Очистить найденное':'Очистить',
   'Вписать по ширине':'Вписать','Сбросить цвета':'Сброс цветов','Сохранить GIF':'GIF','Сохранить видео':'Видео',
   'Общий центр':'Центр','Вернуть на лучи':'На лучи','Вернуть в 2D':'В 2D','Сброс камеры':'Камера',
   'В общий центр':'В центр','Фрагмент плеера':'Фрагмент','Текущий кадр':'Текущий','С текущего кадра':'С текущего',
   'Сохранить GIF 3D':'GIF 3D','Сохранить видео 3D':'Видео 3D','Отмена экспорта':'Отмена',
   'Перебор 6144':'Все 6144','256 поворотов':'Повороты 256','Нули в пустых':'Пустые 0',
   'Анимация и сохранение':'Пуск / запись','Поле и цифры':'Поле / цифры',
   'Обложка · красный / чёрный':'Обложка','Серый / белый · красный центр':'Серый / белый',
   'Белый / чёрный · красный центр':'Белый / чёрный'
  };
  const compactName = text => compactNames[text] || text;
  const controls = document.querySelector('.controls'), sections = [...controls.children];
  const [row, figures, position, overlay, search, digits, field, colors, film] = sections;
  const view = document.createElement('section');
  view.innerHTML = '<h2>Вид</h2><div class="group role"></div>';
  for (const id of ['ghostToggle','gridToggle','digitsToggle','emptyZerosToggle','shadowToggle','zerosToggle','topToggle']) {
   const button = document.getElementById(id), previous = button.parentElement;
   view.querySelector('.group').append(button);
   if (!previous.children.length) previous.remove();
  }
  controls.insertBefore(view, position);
  const positionHeading = document.createElement('h2'); positionHeading.textContent = 'Положение'; position.prepend(positionHeading);
  const digitHeading = document.createElement('h3'); digitHeading.textContent = 'Размер цифр'; field.append(digitHeading);
  for (const node of [...digits.childNodes]) if (node.nodeName !== 'H2') field.append(node);
  digits.remove();
  const definitions = [
   [row,'layout','Расстановка','Общий центр или четыре фигуры в ряд; сдвиг и скорость каждой фигуры.'],
   [figures,'figures','Фигуры','Выберите I–IV под полем, затем поверните, обменяйте или верните фигуры.'],
   [view,'view','Вид','Силуэты, сетка, цифры и тени на основном поле.'],
   [position,'position','Положение','Расстояние фигур от общего центра в клетках.'],
   [overlay,'overlay','Наложение','XOR гасит совпавшие биты; объединение сохраняет все занятые клетки.'],
   [search,'search','Поиск','Введите строки из 0 и 1; ищите в текущей раскладке или во всех кадрах.'],
   [field,'field','Поле и цифры','Размер поля, масштаб клетки и размер цифр.'],
   [colors,'colors','Цвета','Цвета поля, фигур, цифр, силуэтов и осей.'],
   [film,'film','Анимация и сохранение','Выберите движение и скорость, запустите плеер или сохраните GIF / видео.']
  ];
  let opened = 'figures';
  const menuKey = 'glyphen-readable-menu-v1';
  try { const saved = localStorage.getItem(menuKey); if (saved === '' || definitions.some(([,key]) => key === saved)) opened = saved; } catch {}
  const panels = [];
  for (const [section,key,title,description] of definitions) {
   section.dataset.menuGroup = key;
   const heading = section.querySelector('h2');
   heading.textContent = '';
   const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'menu-heading';
   toggle.dataset.menuNavigation = ''; toggle.textContent = compactName(title);
   toggle.title = description; toggle.setAttribute('aria-label', title);
   toggle.setAttribute('aria-controls', 'glyphen-menu-' + key);
   toggle.setAttribute('aria-expanded', String(opened === key)); heading.append(toggle);
   const body = document.createElement('div'); body.id = 'glyphen-menu-' + key; body.className = 'menu-body';
   for (const node of [...section.childNodes]) if (node !== heading) body.append(node);
   const note = document.createElement('p'); note.className = 'menu-summary'; note.textContent = description; body.prepend(note);
   const hints = [...body.querySelectorAll(':scope > p.hint:not([id])')];
   if (hints.length) {
    const details = document.createElement('details'), summary = document.createElement('summary');
    summary.textContent = 'Подробнее'; summary.dataset.menuNavigation = ''; details.append(summary);
    hints.forEach(node => details.append(node)); body.append(details);
   }
   body.hidden = opened !== key; section.append(body); panels.push({key,toggle,body});
   toggle.addEventListener('click', () => {
    opened = body.hidden ? key : '';
    for (const panel of panels) { panel.body.hidden = panel.key !== opened; panel.toggle.setAttribute('aria-expanded', String(panel.key === opened)); }
    try { localStorage.setItem(menuKey, opened); } catch {}
   });
  }
  document.querySelector('.layout > figure').dataset.menuGroup = 'figures';
  document.getElementById('spaceMount').dataset.menuGroup = 'space';
  document.querySelector('header').dataset.menuGroup = 'library';
  const palette = colors.querySelector('.color-grid');
  for (const [title, ids] of [
   ['Поле и фигуры', ['colorFieldBg','colorBit','colorGhost','colorPivot']],
   ['Цифры и линии', ['colorDigitOne','colorDigitZero','colorAxes']],
   ['Контур и тень', ['colorShadowLight','colorShadowDark']]
  ]) {
   const group = document.createElement('fieldset'); group.className = 'menu-color-family';
   const legend = document.createElement('legend'); legend.textContent = title; group.append(legend);
   for (const id of ids) group.append(document.getElementById(id).closest('label'));
   palette.append(group);
  }
  // Keep film controls inside #film: its event delegation and animation guards depend on it.
  const exportBar = document.getElementById('exportScope').previousElementSibling;
  const playback = document.createElement('div'); playback.className = 'group role';
  playback.append(document.getElementById('play')); exportBar.before(playback);
  const saveHeading = document.createElement('h3'); saveHeading.textContent = 'Сохранить GIF / видео'; exportBar.before(saveHeading);
  const videoHeading = film.querySelector('.video-export h3'); if (videoHeading) videoHeading.textContent = 'Сохранить видео с музыкой';
  for (const note of document.querySelectorAll('.xs-explain')) note.textContent = note.textContent.replace('R меняет плоскость.', '«Поворот 90» меняет плоскость.');
  const distance = document.querySelector('.xs-distance-label');
  if (distance) for (const node of distance.childNodes) if (node.nodeType === 3) node.textContent = 'Разнос ';
  const guide = document.querySelector('.field-help');
  const help = document.createElement('details'), helpTitle = document.createElement('summary');
  helpTitle.textContent = 'Как пользоваться полем'; helpTitle.dataset.menuNavigation = ''; help.append(helpTitle);
  const originalHeading = guide.querySelector('h2'); originalHeading?.remove();
  for (const node of [...guide.childNodes]) if (node.id !== 'symInfo') help.append(node);
  guide.prepend(help);
  const labels = {
   openBitoteka:'Битотека',random:'Случайный порядок',resetAll:'Сброс',ghostToggle:'Силуэты',allVariants:'Все 6144',allVariantsShift:'Перебор + сдвиг',
   gridToggle:'Сетка',shadowToggle:'Тени',zerosToggle:'Нули под единицами',topToggle:'Верхняя клетка',left:'Влево 90',right:'Вправо 90',swap:'Обмен',
   allLeft:'Все влево',allRight:'Все вправо',resetPositions:'Вернуть на лучи',xor:'XOR',union:'Объединить',solo:'Только выбранная',
   searchRun:'Поиск в кадре',searchAll:'По всем кадрам',searchClear:'Очистить',searchAxes:'По осям',searchLoops:'Сквозные линии',searchFoundClear:'Очистить найденное',
   cellAuto:'Вписать по ширине',resetColors:'Сбросить цвета',makeGif:'Сохранить GIF',cancelGif:'Отмена GIF',makeVideo:'Сохранить видео',cancelVideo:'Отмена видео',
   layoutCenter:'Общий центр',layoutRow:'В ряд',rowOriginal:'Исходные позиции',rowPalette:'Палитры',fitFieldTop:'Вписать',fieldZoomOut:'−',fieldZoomIn:'+'
  };
  const plain = button => {
   const copy = button.cloneNode(true); copy.querySelectorAll('.ico').forEach(icon => icon.remove());
   return copy.textContent.trim().replace(/\s+/g,' ');
  };
  const originalNames = new WeakMap();
  function readable(button) {
   if (button.classList.contains('tile') || button.classList.contains('found-chip') || button.classList.contains('search-pattern') || button.hasAttribute('data-menu-navigation')) return;
   if (!originalNames.has(button)) originalNames.set(button, button.getAttribute('aria-label') || button.title || '');
   const full = plain(button), id = button.id;
   let label = labels[id];
   if (id === 'digitsToggle') label = 'Цифры XOR';
   if (id === 'emptyZerosToggle') label = 'Нули в пустых';
   if (id === 'play' || id === 'thumbPlay') label = button.getAttribute('aria-pressed') === 'true' ? 'Пауза' : 'Пуск';
   if (button.dataset.motion) label = ({variants:'Перебор 6144',spin:'Поворот',cross:'Крест 90',unique:'256 поворотов',cross24:'24 креста'})[button.dataset.motion];
   if (button.dataset.radius) label = button.dataset.radius === 'auto' ? 'Авто-сдвиг' : 'Вручную';
   if (button.hasAttribute('data-edit')) label = 'Правка';
   if (button.dataset.fieldSize) label = button.dataset.fieldSize + '×' + button.dataset.fieldSize;
   if (button.dataset.exportScope) label = ({player:'Фрагмент плеера',current:'Текущий кадр',unique:'Все 256',all:'Все 6144',cross24:'Все 24 креста'})[button.dataset.exportScope];
   if (button.dataset.kraftPalette) label = window.ZerkKraftwerk.palette(button.dataset.kraftPalette).name;
   if (/^rowAuto\d+$/.test(id)) label = 'Автодвижение';
   if (button.classList.contains('xs-reset')) label = 'Вернуть в 2D';
   if (button.classList.contains('xs-camera')) label = 'Сброс камеры';
   if (button.classList.contains('xs-center')) label = 'В общий центр';
   if (button.classList.contains('xs-symmetric')) label = 'Симметрично';
   if (button.classList.contains('xs-roll')) label = 'Поворот 90';
   if (button.classList.contains('xs-pick')) label = 'Фигура ' + full.replace(/^>\s*/, '');
   if (button.dataset.action === 'play') label = full.includes('Отмена') ? 'Отмена расчёта' : button.getAttribute('aria-pressed') === 'true' ? 'Пауза 3D' : 'Перебор 3D';
   if (button.dataset.action === 'prev') label = 'Предыдущий';
   if (button.dataset.action === 'next') label = 'Следующий';
   for (const [attribute,caption] of [['data-export-current','С текущего кадра'],['data-export-all','Весь цикл'],['data-export-gif','Сохранить GIF 3D'],['data-export-video','Сохранить видео 3D'],['data-export-cancel','Отмена экспорта']]) if (button.hasAttribute(attribute)) label = caption;
   if (label === undefined) label = full || button.getAttribute('aria-label') || button.title;
   if (!label) return;
   const fullLabel = label; label = compactName(label);
   // The source text remains untouched (e.g. #rates reads Number(event.target.textContent)).
   if (button.dataset.compact !== label) button.dataset.compact = label;
   const dynamic = ['digitsToggle','play','thumbPlay'].includes(id) || button.dataset.action === 'play';
   const accessible = button.hasAttribute('data-edit') ? 'Правка клеток фигуры ' + ['I','II','III','IV'][Number(button.dataset.edit)] : dynamic ? fullLabel : originalNames.get(button) || fullLabel;
   if (button.getAttribute('aria-label') !== accessible) button.setAttribute('aria-label', accessible);
   if (!button.title) button.title = fullLabel;
   const mini = button.hasAttribute('data-edit') || (button.closest('#rates') && full.length <= 3);
   const arrow = button.classList.contains('step') || ['fieldZoomOut','fieldZoomIn'].includes(id) || (button.closest('.row-track') && ['−','+'].includes(full));
   const width = arrow ? 'arrow' : mini ? 'mini' : label.length > 10 ? 'wide' : 'normal';
   if (button.dataset.menuWidth !== width) button.dataset.menuWidth = width;
  }
  const preview = document.getElementById('tiles'), editRow = document.querySelector('.edit-row');
  if (preview && editRow) {
   [...preview.children].forEach((tile,id) => {
    const pair = document.createElement('div'); pair.className = 'figure-pair';
    preview.insertBefore(pair,tile); pair.append(tile,editRow.querySelector('[data-edit="'+id+'"]'));
   });
   editRow.remove();
  }
  function arrangeButtons(parent) {
   if (!parent?.matches('.group,.search-actions,.xs-actions,.xs-sequence-controls,.xs-export-actions,.xs-symmetry')) return;
   const children = [...parent.children];
   if (children.length && children.every(child => child.tagName === 'BUTTON')) parent.classList.add('menu-button-grid');
  }
  document.querySelectorAll('main button').forEach(button => { readable(button); arrangeButtons(button.parentElement); });
  document.querySelector('main').addEventListener('click', event => {
   const button = event.target.closest('button');
   if (!button || button.disabled || button.hasAttribute('data-hover-off')) return;
   if (button.getAttribute('aria-pressed') === 'false' || button.getAttribute('aria-expanded') === 'false') {
    button.dataset.hoverOff = '';
    button.addEventListener('pointerleave', () => delete button.dataset.hoverOff, {once:true});
   }
  });
  const observer = new MutationObserver(records => {
   const buttons = new Set();
   for (const record of records) {
    const element = record.target.nodeType === 1 ? record.target : record.target.parentElement;
    const button = element?.closest('button'); if (button) buttons.add(button);
    for (const node of record.addedNodes) if (node.nodeType === 1) {
     if (node.matches('button')) buttons.add(node);
     node.querySelectorAll('button').forEach(button => buttons.add(button));
    }
   }
   buttons.forEach(button => { readable(button); arrangeButtons(button.parentElement); });
  });
  observer.observe(document.querySelector('main'), {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-pressed']});
 }};
})();
