import { basketKey, figureDetails, readBasket, updateBasket } from '../basket-state.js?v=1';

const field = document.getElementById('composition-field');
const layers = document.getElementById('layers');
const raise = document.getElementById('raise-layer');
const lower = document.getElementById('lower-layer');
const remove = document.getElementById('remove-layer');
const status = document.getElementById('basket-status');
const work = document.getElementById('basket-work');
const empty = document.getElementById('basket-empty');
const gap = 10;
let figures = [];
let selected = '';
let drag = null;
let fieldButtons = new Map();
let layerButtons = new Map();

const fieldWidth = items => Math.max(448, ...items.map(item => item.width + 2 * gap));
const fieldHeight = items => Math.max(236, ...items.map(item => item.y + item.height + gap));
const bounded = (value, max) => Math.max(0, Math.min(Math.round(value), max));

function arrange(items) {
  const width = fieldWidth(items);
  const placed = new Map(items.filter(item => Number.isSafeInteger(item.x) && Number.isSafeInteger(item.y))
    .map(item => [item.id, { ...item, x: bounded(item.x, width - item.width), y: bounded(item.y, 100000) }]));
  for (const item of items) {
    if (placed.has(item.id)) continue;
    const others = [...placed.values()];
    const columns = [gap, ...others.map(figure => figure.x + figure.width + gap)].sort((a, b) => a - b);
    const rows = [gap, ...others.map(figure => figure.y + figure.height + gap)].sort((a, b) => a - b);
    const fits = (x, y) => x + item.width <= width - gap && others.every(figure =>
      x + item.width + gap <= figure.x || figure.x + figure.width + gap <= x ||
      y + item.height + gap <= figure.y || figure.y + figure.height + gap <= y);
    const y = rows.find(row => columns.some(x => fits(x, row)));
    const x = columns.find(column => fits(column, y));
    placed.set(item.id, { ...item, x, y });
  }
  return items.map(item => placed.get(item.id));
}

function select(id) {
  selected = id;
  for (const buttons of [fieldButtons, layerButtons]) {
    for (const [key, button] of buttons) button.setAttribute('aria-pressed', String(key === id));
  }
  const index = figures.findIndex(item => item.id === id);
  raise.disabled = index < 0 || index >= figures.length - 1;
  lower.disabled = index <= 0;
  remove.disabled = index < 0;
}

function figureButton(item, className) {
  const { label, src } = figureDetails(item.id);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.dataset.item = item.id;
  button.setAttribute('aria-label', label);
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.draggable = false;
  button.append(img);
  return { button, label };
}

function position(button, x, y) {
  button.style.setProperty('--x', x);
  button.style.setProperty('--y', y);
}

function render(items) {
  const focused = document.activeElement;
  const focusId = focused?.dataset?.item;
  const focusedInField = field.contains(focused);
  figures = arrange(items);
  const visible = figures.length > 0;
  work.hidden = !visible;
  empty.hidden = visible;
  field.style.setProperty('--field-width', fieldWidth(figures));
  field.style.setProperty('--field-height', fieldHeight(figures));
  fieldButtons = new Map();
  layerButtons = new Map();
  const nodes = figures.map(item => {
    const { button } = figureButton(item, 'basket-figure');
    button.style.setProperty('--width', item.width);
    button.style.setProperty('--height', item.height);
    position(button, item.x, item.y);
    fieldButtons.set(item.id, button);
    return button;
  });
  const listItems = [...figures].reverse().map(item => {
    const row = document.createElement('li');
    const { button, label } = figureButton(item, 'layer-button');
    button.append(label);
    row.append(button);
    layerButtons.set(item.id, button);
    return row;
  });
  field.replaceChildren(...nodes);
  layers.replaceChildren(...listItems);
  select(fieldButtons.has(selected) ? selected : figures.at(-1)?.id ?? '');
  const buttons = focusedInField ? fieldButtons : layerButtons;
  if (focusId) (buttons.get(focusId) ?? buttons.get(selected))?.focus({ preventScroll: true });
}

function commit(change) {
  const items = updateBasket(current => change(arrange(current)));
  status.textContent = items ? '' : 'Браузер не сохранил изменение корзины.';
  render(items ?? readBasket());
}

function move(id, x, y) {
  commit(items => {
    const width = fieldWidth(items);
    const height = fieldHeight(items);
    return items.map(item => item.id === id ? {
      ...item, x: bounded(x, width - item.width), y: bounded(y, height - item.height)
    } : item);
  });
}

function reorder(offset) {
  commit(items => {
    const from = items.findIndex(item => item.id === selected);
    const to = from + offset;
    if (from >= 0 && to >= 0 && to < items.length) [items[from], items[to]] = [items[to], items[from]];
    return items;
  });
}

raise.addEventListener('click', () => reorder(1));
lower.addEventListener('click', () => reorder(-1));
remove.addEventListener('click', () => commit(items => items.filter(item => item.id !== selected)));

work.addEventListener('click', event => {
  const id = event.target.closest('button[data-item]')?.dataset.item;
  if (id) select(id);
});

const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
work.addEventListener('keydown', event => {
  const direction = directions[event.key];
  const item = figures.find(figure => figure.id === event.target.dataset.item);
  if (!Array.isArray(direction) || !item) return;
  event.preventDefault();
  select(item.id);
  const step = event.shiftKey ? 10 : 1;
  move(item.id, item.x + direction[0] * step, item.y + direction[1] * step);
});

function pointInField(event) {
  const rect = field.getBoundingClientRect();
  const cell = rect.width / fieldWidth(figures);
  return [(event.clientX - rect.left) / cell, (event.clientY - rect.top) / cell];
}

field.addEventListener('pointerdown', event => {
  const button = event.target.closest('.basket-figure');
  if (!button || drag || event.button !== 0) return;
  const item = figures.find(figure => figure.id === button.dataset.item);
  const [x, y] = pointInField(event);
  select(item.id);
  button.focus({ preventScroll: true });
  button.setPointerCapture(event.pointerId);
  drag = { pointerId: event.pointerId, button, item, dx: x - item.x, dy: y - item.y, x: item.x, y: item.y };
});

field.addEventListener('pointermove', event => {
  if (event.pointerId !== drag?.pointerId) return;
  const [x, y] = pointInField(event);
  drag.x = bounded(x - drag.dx, fieldWidth(figures) - drag.item.width);
  drag.y = bounded(y - drag.dy, fieldHeight(figures) - drag.item.height);
  position(drag.button, drag.x, drag.y);
});

field.addEventListener('pointerup', event => {
  if (event.pointerId !== drag?.pointerId) return;
  const { item, x, y } = drag;
  drag = null;
  if (x !== item.x || y !== item.y) move(item.id, x, y);
  else render(readBasket());
});

function cancelDrag(event) {
  if (event.pointerId !== drag?.pointerId) return;
  drag = null;
  render(readBasket());
}

field.addEventListener('pointercancel', cancelDrag);
field.addEventListener('lostpointercapture', cancelDrag);

window.addEventListener('storage', event => {
  if (!drag && (event.key === basketKey || event.key === null)) render(readBasket());
});
window.addEventListener('pageshow', event => {
  if (event.persisted) render(readBasket());
});
render(readBasket());
