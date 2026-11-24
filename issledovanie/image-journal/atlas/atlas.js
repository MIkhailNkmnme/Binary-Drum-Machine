import { basketKey, readBasket, updateBasket } from './basket-state.js?v=1';

(() => {
  const list = document.querySelector('.atlas-tabs');
  const tabs = [...list.querySelectorAll('a')];
  const panels = tabs.map(tab => document.getElementById(tab.hash.slice(1)));
  const defaultTab = document.getElementById('tab-512');

  list.setAttribute('role', 'tablist');
  tabs.forEach((tab, index) => {
    const panel = panels[index];
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.tabIndex = 0;
  });

  function select(tab) {
    tabs.forEach((item, index) => {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
      panels[index].hidden = !active;
    });
  }

  function selectFromHash() {
    select(tabs.find(tab => tab.hash === location.hash) ?? defaultTab);
  }

  function activate(tab) {
    if (tab.hash !== location.hash) history.pushState(null, '', tab.hash);
    select(tab);
  }

  list.addEventListener('click', event => {
    const tab = event.target.closest('a[role="tab"]');
    if (!tab || event.button !== 0 || event.ctrlKey || event.metaKey ||
        event.shiftKey || event.altKey) return;
    event.preventDefault();
    activate(tab);
  });

  list.addEventListener('keydown', event => {
    const index = tabs.indexOf(event.target);
    if (index < 0) return;
    const destinations = {
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      ArrowRight: (index + 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
      ' ': index
    };
    const next = tabs[destinations[event.key]];
    if (!next) return;
    event.preventDefault();
    activate(next);
    next.focus();
  });

  window.addEventListener('hashchange', selectFromHash);
  window.addEventListener('popstate', selectFromHash);
  selectFromHash();
})();

const picks = [...document.querySelectorAll('.atlas-pick')];
const count = document.getElementById('basket-count');
const basketStatus = document.getElementById('basket-status');

function showBasket(items) {
  const selected = new Set(items.map(item => item.id));
  count.textContent = '(' + selected.size + ')';
  count.hidden = false;
  for (const pick of picks) {
    pick.setAttribute('aria-pressed', String(selected.has(pick.dataset.figure)));
  }
}

for (const pick of picks) {
  pick.addEventListener('click', () => {
    const { figure: id, width, height } = pick.dataset;
    const items = updateBasket(current => current.some(item => item.id === id)
      ? current.filter(item => item.id !== id)
      : [...current, { id, width: Number(width), height: Number(height) }]);
    basketStatus.hidden = Boolean(items);
    basketStatus.textContent = items ? '' : 'Браузер не сохранил выбор в корзине.';
    if (items) showBasket(items);
  });
}

window.addEventListener('storage', event => {
  if (event.key === basketKey || event.key === null) showBasket(readBasket());
});
window.addEventListener('pageshow', () => showBasket(readBasket()));
showBasket(readBasket());
