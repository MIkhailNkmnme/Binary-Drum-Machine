export const basketKey = 'zerkalius-axis-totem-basket-v1';

function validFigure(item) {
  return item && /^(128|256|512|1024|2048|4096):[1-9]\d{0,4}$/.test(item.id) &&
    [item.width, item.height].every(value => Number.isInteger(value) && value > 0 && value <= 4096);
}

export function readBasket() {
  try {
    const stored = JSON.parse(localStorage.getItem(basketKey));
    if (Array.isArray(stored)) {
      const figures = new Map(stored.filter(validFigure).map(item => [item.id, item]));
      return [...figures.values()];
    }
  } catch {
    // An unavailable or invalid store leaves the collection empty.
  }
  return [];
}

export function updateBasket(update) {
  const items = update(readBasket());
  try {
    localStorage.setItem(basketKey, JSON.stringify(items));
    return items;
  } catch {
    return null;
  }
}

export function figureDetails(id) {
  const [size, number] = id.split(':');
  const padded = number.padStart(size === '512' ? 3 : 4, '0');
  const path = size === '512'
    ? '../recipes/totem-axis-512/totem-' + padded + '.png'
    : size + '/figure-' + padded + '.png';
  return { label: size + ' · ' + padded, src: new URL(path, import.meta.url).href };
}
