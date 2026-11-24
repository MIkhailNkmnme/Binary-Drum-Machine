import { basketKey, readBasket, updateBasket } from '../basket-state.js?v=1';
import { catalogueFrames, catalogueIndex, pngSource, readFigure } from './figure-data.js?v=1';

const PAGE_SIZE = 32;
const MIN_CELLS = 4;
const params = new URLSearchParams(location.search);
const sizeLinks = [...document.querySelectorAll('[data-size]')];
const requestedSize = params.get('size');
const size = Number(sizeLinks.some(link => link.dataset.size === requestedSize) ? requestedSize : 512);
const root = document.getElementById('catalogue-figures');
const status = document.getElementById('catalogue-status');
const feedback = document.getElementById('catalogue-feedback');
const frameSelect = document.getElementById('source-frame');
const lastFrame = document.getElementById('last-frame');
const search = document.getElementById('figure-search');
const numberInput = document.getElementById('figure-number');
const pager = document.getElementById('catalogue-pager');
const previousPage = document.getElementById('previous-page');
const nextPage = document.getElementById('next-page');
const pageNumber = document.getElementById('page-number');
const basketLink = document.getElementById('basket-link');
const view = document.getElementById('figure-view');
const viewTitle = document.getElementById('view-title');
const viewImage = document.getElementById('view-image');
const previousFigure = document.getElementById('previous-figure');
const nextFigure = document.getElementById('next-figure');
const download = document.getElementById('download-figure');
const pick = document.getElementById('pick-figure');
const displayNumber = new Intl.NumberFormat('ru-RU');
const frameLabel = frame => (size === 512 ? 'Кадр GIF ' : 'Кадр ') + frame;
const figureLabel = number => String(number).padStart(size === 512 ? 3 : 4, '0');

let index;
let allSlots;
let slots = [];
let page = 0;
let displayedFrame = '';
let renderSequence = 0;
let viewSequence = 0;
let viewPosition = -1;
let viewFigure = null;

for (const link of sizeLinks) {
  if (Number(link.dataset.size) === size) link.setAttribute('aria-current', 'page');
}
document.getElementById('atlas-link').href = '../#atlas-' + size;
document.getElementById('recording-link').href = '../../#central-axis-' + (size === 512 ? 'templates' : size);

function button(text) {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = text;
  return element;
}

function setPng(link, figure) {
  link.href = pngSource(figure);
  link.download = 'atlas-' + size + '-' + figureLabel(figure.number) + '.png';
}

function updateBasketControls() {
  const selected = new Set(readBasket().map(item => item.id));
  basketLink.textContent = 'Корзина (' + selected.size + ')';
  const buttons = [...root.querySelectorAll('[data-fig-pick]'), pick];
  for (const element of buttons) {
    const active = selected.has(element.dataset.figPick);
    element.setAttribute('aria-pressed', String(active));
    element.textContent = active ? 'В корзине' : 'В корзину';
  }
}

function togglePick(figure) {
  const id = size + ':' + figure.number;
  const { width, height } = figure;
  const result = updateBasket(items => items.some(item => item.id === id)
    ? items.filter(item => item.id !== id)
    : [...items, { id, width, height, catalogue: true }]);
  const message = result ? '' : 'Браузер не сохранил изменение корзины.';
  feedback.textContent = message;
  if (view.open && message) viewTitle.textContent = message;
  updateBasketControls();
}

function card(figure, [offset, x = figure.x, y = figure.y], position, frame) {
  const element = document.createElement('figure');
  element.className = 'catalogue-card';
  const label = 'Фигура ' + figureLabel(index.ids[offset]);
  const thumbnail = button('');
  thumbnail.className = 'catalogue-preview';
  thumbnail.setAttribute('aria-label', 'Открыть ' + label.toLowerCase());
  thumbnail.onclick = () => showFigure(position);
  const image = document.createElement('img');
  image.alt = '';
  image.decoding = 'async';
  image.src = pngSource(figure);
  const scale = Math.min(6, 112 / figure.height, 164 / figure.width);
  image.width = Math.max(1, Math.round(figure.width * scale));
  image.height = Math.max(1, Math.round(figure.height * scale));
  image.style.width = image.width + 'px';
  thumbnail.append(image);

  const caption = document.createElement('figcaption');
  const title = document.createElement('strong');
  title.textContent = label;
  const details = document.createElement('p');
  details.textContent = figure.width + ' × ' + figure.height + ' · ' + displayNumber.format(figure.cells) + ' кл.';
  if (frame !== null) details.textContent += ' · (' + x + ', ' + y + ')';
  const links = document.createElement('div');
  links.className = 'entry-links';
  const png = document.createElement('a');
  png.textContent = 'PNG';
  setPng(png, figure);
  const source = document.createElement('a');
  const sourceFrame = frame ?? figure.frame;
  source.textContent = frameLabel(sourceFrame);
  source.href = size === 512
    ? '?size=512&frame=' + sourceFrame
    : '../../../../mayatnik/Zerkalius-mayatnik.html?chisto&n=' + size + '&s=' + size + '&k=' + sourceFrame + '&mode=pend';
  links.append(png, source);
  if (figure.cells >= MIN_CELLS) {
    const add = button('В корзину');
    add.dataset.figPick = size + ':' + figure.number;
    add.onclick = () => togglePick(figure);
    links.append(add);
  }
  caption.append(title, details, links);
  element.append(thumbnail, caption);
  return element;
}

async function showPage(requestedPage, scroll = false) {
  const revision = ++renderSequence;
  const frame = frameSelect.value === '' ? null : Number(frameSelect.value);
  root.inert = pager.inert = search.inert = true;
  root.setAttribute('aria-busy', 'true');
  status.textContent = 'Загружаются фигуры…';
  feedback.textContent = '';
  try {
    const nextSlots = frame === null ? allSlots : ((await catalogueFrames(size))[frame] ?? []);
    const pages = Math.max(1, Math.ceil(nextSlots.length / PAGE_SIZE));
    const nextPageIndex = Math.max(0, Math.min(requestedPage, pages - 1));
    const start = nextPageIndex * PAGE_SIZE;
    const visible = nextSlots.slice(start, start + PAGE_SIZE);
    const figures = await Promise.all(visible.map(([offset]) => readFigure(size, offset, index)));
    if (revision !== renderSequence) return;

    slots = nextSlots;
    page = nextPageIndex;
    displayedFrame = frame === null ? '' : String(frame);
    root.replaceChildren(...figures.map((figure, i) => card(figure, visible[i], start + i, frame)));
    updateBasketControls();
    const heading = frame === null ? 'Все кадры' : frameLabel(frame);
    status.textContent = slots.length
      ? heading + ' · ' + displayNumber.format(start + 1) + '–' + displayNumber.format(start + figures.length) +
        ' из ' + displayNumber.format(slots.length)
      : heading + ' · фигур нет';
    pager.hidden = pages <= 1;
    previousPage.disabled = page === 0;
    nextPage.disabled = page >= pages - 1;
    pageNumber.textContent = 'Страница ' + (page + 1) + ' из ' + pages;

    const target = new URL(location.href);
    target.search = new URLSearchParams({ size });
    if (frame !== null) target.searchParams.set('frame', frame);
    if (page) target.searchParams.set('page', page + 1);
    history.replaceState(null, '', target);
    if (scroll) status.scrollIntoView({ block: 'start' });
    return true;
  } catch (error) {
    if (revision !== renderSequence) return;
    frameSelect.value = displayedFrame;
    status.textContent = error.message;
  } finally {
    if (revision === renderSequence) {
      root.inert = pager.inert = search.inert = false;
      root.removeAttribute('aria-busy');
    }
  }
}

async function showFigure(position) {
  const slot = slots[position];
  if (!slot) return;
  const revision = ++viewSequence;
  viewPosition = position;
  viewFigure = null;
  viewTitle.textContent = 'Загружается фигура…';
  viewImage.replaceChildren();
  download.hidden = true;
  pick.hidden = true;
  previousFigure.disabled = position === 0;
  nextFigure.disabled = position >= slots.length - 1;
  if (!view.open) view.showModal();
  try {
    const figure = await readFigure(size, slot[0], index);
    if (revision !== viewSequence || !view.open) return;
    viewFigure = figure;
    viewTitle.textContent = 'Фигура ' + figureLabel(figure.number) + ' · ' + figure.width + ' × ' + figure.height;
    const image = document.createElement('img');
    image.src = pngSource(figure);
    image.alt = 'Фигура ' + figureLabel(figure.number);
    image.width = figure.width;
    image.height = figure.height;
    viewImage.replaceChildren(image);
    viewImage.scrollTo(0, 0);
    setPng(download, figure);
    download.hidden = false;
    pick.dataset.figPick = size + ':' + figure.number;
    pick.hidden = figure.cells < MIN_CELLS;
    updateBasketControls();
  } catch (error) {
    if (revision === viewSequence) viewTitle.textContent = error.message;
  }
}

frameSelect.onchange = () => showPage(0);
lastFrame.onclick = () => {
  frameSelect.value = String(index.frames.at(-1));
  showPage(0);
};
previousPage.onclick = () => showPage(page - 1, true);
nextPage.onclick = () => showPage(page + 1, true);
previousFigure.onclick = () => showFigure(viewPosition - 1);
nextFigure.onclick = () => showFigure(viewPosition + 1);
pick.onclick = () => { if (viewFigure) togglePick(viewFigure); };
search.onsubmit = async event => {
  event.preventDefault();
  const number = Number(numberInput.value);
  const position = slots.findIndex(([offset]) => index.ids[offset] === number);
  if (position < 0) {
    feedback.textContent = frameSelect.value === '' ? 'Фигуры с таким номером нет.' : 'В этом кадре такой фигуры нет.';
    return;
  }
  if (await showPage(Math.floor(position / PAGE_SIZE))) showFigure(position);
};
window.addEventListener('storage', event => {
  if (event.key === basketKey || event.key === null) updateBasketControls();
});
window.addEventListener('pageshow', updateBasketControls);

try {
  index = await catalogueIndex(size);
  allSlots = index.ids.map((_, offset) => [offset]);
  for (const frame of index.frames) frameSelect.add(new Option(frameLabel(frame), String(frame)));
  const requestedFrame = Number(params.get('frame'));
  if (index.frames.includes(requestedFrame)) frameSelect.value = String(requestedFrame);
  frameSelect.disabled = false;
  lastFrame.disabled = false;
  numberInput.disabled = false;
  document.getElementById('find-figure').disabled = false;
  await showPage(Math.max(0, Math.floor(Number(params.get('page')) || 1) - 1));
} catch (error) {
  status.textContent = error.message;
}
