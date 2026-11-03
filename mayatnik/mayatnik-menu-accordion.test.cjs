const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { mount, rowsOf } = require('./mayatnik-menu-accordion.js');

function fixture(open = false, reduced = false) {
  const dom = new JSDOM(`<div id="mayatnikRail"><div class="gz-group ${open ? 'gz-open' : ''}" data-id="edge"><button class="gz-head">Край</button><div class="may-rail-list"><div class="gz-soty"><button class="gz-hx gz-pair" data-y="26"><span>left</span><span>right</span></button><button class="gz-hx" data-y="52"></button></div><div class="gz-wide"><div class="pt-r"><button class="gz-hx" data-y="78"></button><button class="gz-hx" data-y="78"></button></div><button class="gz-hx" data-y="104" style="color:red"></button></div></div></div><div class="gz-group" id="neighbor"></div></div>`);
  const { window: win } = dom, doc = win.document;
  let time = 0, sequence = 0, refreshes = 0; const frames = new Map(), changes = new Set();
  const media = { matches: reduced, addEventListener: (_, fn) => changes.add(fn), removeEventListener: (_, fn) => changes.delete(fn) };
  win.matchMedia = () => media;
  win.requestAnimationFrame = fn => { frames.set(++sequence, fn); return sequence; };
  win.cancelAnimationFrame = id => frames.delete(id);
  Object.defineProperty(win.performance, 'now', { value: () => time });
  win.HTMLElement.prototype.getBoundingClientRect = function () {
    const visible = !this.closest('[data-may-accordion-pending],[hidden]');
    return { top: +(this.dataset.y || 0), left: 0, bottom: +(this.dataset.y || 0) + 24, width: visible ? 120 : 0, height: visible ? 24 : 0 };
  };
  const group = doc.querySelector('.gz-group');
  const api = mount({ document: doc, onLayout: () => { refreshes++; } });
  const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
  async function step(ms) { time += ms; const current = [...frames.values()]; frames.clear(); for (const fn of current) fn(time); await flush(); }
  const cells = () => [...group.querySelectorAll('[data-y]')];
  const shown = () => cells().filter(node => !node.closest('[data-may-accordion-pending]'));
  return { dom, win, doc, group, api, step, flush, frames, media, changes, cells, shown, refreshes: () => refreshes };
}

test('physical rows preserve paired controls and same-Y nested controls', () => {
  const f = fixture();
  assert.deepEqual(rowsOf(f.group, f.win).map(row => row.nodes.length), [1, 1, 2, 1]);
  f.api.disconnect(); f.dom.window.close();
});

test('new opening grows row by row, collapses wrappers and restores exact identity/styles', async () => {
  const f = fixture(), nodes = f.cells(), original = f.group.innerHTML;
  f.group.classList.add('gz-open'); await f.flush();
  assert.equal(f.api.activeCount, 1); assert.equal(f.shown().length, 1);
  assert.ok(f.group.querySelector('.gz-wide').hasAttribute('data-may-accordion-pending'));
  assert.equal(f.doc.querySelector('#neighbor').hasAttribute('data-may-accordion-pending'), false);
  await f.step(240); assert.equal(f.shown().length, 2);
  await f.step(240); assert.equal(f.shown().length, 4);
  await f.step(240); assert.equal(f.shown().length, 5);
  assert.equal(f.api.activeCount, 0); assert.equal(f.frames.size, 0);
  assert.equal(f.group.innerHTML, original); assert.deepEqual(f.cells(), nodes);
  assert.ok(f.refreshes() >= 4);
  f.api.disconnect(); f.dom.window.close();
});

test('restored open and reduced motion groups appear complete', async () => {
  for (const [open, reduced] of [[true, false], [false, true]]) {
    const f = fixture(open, reduced); f.group.classList.add('gz-open'); await f.flush();
    assert.equal(f.api.activeCount, 0); assert.equal(f.shown().length, 5); assert.equal(f.frames.size, 0);
    f.api.disconnect(); f.dom.window.close();
  }
});

test('fast close and same-turn close/reopen cancel old frames', async () => {
  const f = fixture(); f.group.classList.add('gz-open'); await f.flush();
  await f.step(300); f.group.classList.remove('gz-open'); await f.flush();
  assert.equal(f.frames.size, 0); assert.equal(f.doc.querySelectorAll('[data-may-accordion-pending]').length, 0);
  f.group.classList.add('gz-open'); await f.flush(); await f.step(240);
  f.group.classList.remove('gz-open'); f.group.classList.add('gz-open'); await f.flush();
  assert.equal(f.shown().length, 1); assert.equal(f.frames.size, 1);
  f.api.disconnect(); assert.equal(f.frames.size, 0); assert.equal(f.doc.querySelectorAll('[data-may-accordion-pending]').length, 0);
  f.dom.window.close();
});

test('Tab exposes reachable controls; focusin reveals a requested pending prefix', async () => {
  const f = fixture(); f.group.classList.add('gz-open'); await f.flush();
  f.cells()[3].dispatchEvent(new f.win.FocusEvent('focusin', { bubbles: true }));
  assert.equal(f.shown().length, 4);
  const event = new f.win.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  f.cells()[0].dispatchEvent(event);
  assert.equal(event.defaultPrevented, false); assert.equal(f.shown().length, 5); assert.equal(f.frames.size, 0);
  f.api.disconnect(); f.dom.window.close();
});

test('dynamic groups, removal and runtime reduced motion clean every pending attribute', async () => {
  const f = fixture(), dynamic = f.group.cloneNode(true); dynamic.id = 'dynamic'; f.group.after(dynamic); await f.flush();
  dynamic.classList.add('gz-open'); await f.flush(); assert.equal(f.api.activeCount, 1);
  dynamic.remove(); await f.flush(); assert.equal(f.api.activeCount, 0); assert.equal(dynamic.querySelectorAll('[data-may-accordion-pending]').length, 0);
  f.group.classList.add('gz-open'); await f.flush(); f.media.matches = true; for (const fn of f.changes) fn();
  assert.equal(f.frames.size, 0); assert.equal(f.shown().length, 5);
  f.api.disconnect(); assert.equal(f.changes.size, 0); assert.equal(f.doc.querySelector('[data-may-accordion-style]'), null); f.dom.window.close();
});

test('a delayed animation frame completes immediately at the total time cap', async () => {
  const f = fixture(); f.group.classList.add('gz-open'); await f.flush(); await f.step(1200);
  assert.equal(f.api.activeCount, 0); assert.equal(f.shown().length, 5); assert.equal(f.frames.size, 0);
  f.api.disconnect(); f.dom.window.close();
});
