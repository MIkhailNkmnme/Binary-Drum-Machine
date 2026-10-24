# Общий заголовок группы

`group-header.js` строит одну разметку заголовка, названия, закрепа, значка компактного режима и скрытого служебного указателя. `group-header.css` задаёт единые размеры, центрирование и цвет закрепа через `--c`. Исходные классы нужны только старым контроллерам. Внешний вид от происхождения группы не зависит.

Подключение к другой HTML-странице:

```html
<link rel="stylesheet" href="_js/group-header.css?v=1">
<script src="_js/group-header.js?v=1"></script>
```

Для `ZerkGrozd.rail` передайте фабрику. Страницы без этого параметра сохраняют прежнюю разметку:

```js
ZerkGrozd.rail(host, {
  key: 'page-name', groups,
  headerFactory: group => ZerkGroupHeader.create({
    title: group.title, className: 'gz-hx gz-head',
    titleClass: 'gz-nm', pinClass: 'gz-pin',
    iconClass: 'gz-mico', arrowClass: 'gz-ar'
  })
});
```

Для собственного контроллера:

```js
const view = ZerkGroupHeader.create({
  title: 'Группа',
  onToggle: () => controller.toggleOpen(),
  onPin: () => controller.togglePin()
});
host.append(view.head);
ZerkGroupHeader.sync(view.head, {open: true, pinned: true, mini: false});
```

Закреп поддерживает мышь, Enter и пробел; его события не запускают открытие или перенос заголовка. Контроллер владеет состоянием и сохранением; `sync` лишь отражает состояние, не создаёт новые элементы и не меняет пользовательское название. Не добавляйте вторую обработку клавиш заголовка. `parts(head)` возвращает уже созданные элементы, например `parts(head).icon` для компактного значка.

В Маятнике обе ветки — исходные группы полосы и бывшие боковые группы — используют эту фабрику. Контур открытой группы и размещение по сетке остаются в существующих модулях страницы; подключение компонента к другим HTML выполняется явно.
