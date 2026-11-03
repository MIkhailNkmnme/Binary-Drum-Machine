/* Main Maятник groups: reveal physical rows, letting normal layout grow with them. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.MayatnikMenuAccordion = api;
    const start = () => { root.mayMenuAccordion = api.mount({ document: root.document }); };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }
})(globalThis, function () {
  'use strict';
  const GROUPS = '#paintTools > .pt-g:not(.pt-btn),#paintTools > .gz-group,#mayatnikRail .gz-group,#mayatnikRailR .gz-group';
  const CONTENT = ':scope > .pt-r,:scope > .may-rail-list,:scope > .gz-soty,:scope > .gz-wide';
  const ATOM = '.gz-hx,.gz-control,.pt-b,.may-rows-line,label.may-slide,.zerk-range-wrap,button,input,select,textarea,#templateLibraryChoices';
  const PENDING = 'data-may-accordion-pending';
  const IGNORE = 'svg,script,style,.may-standard-contours,.may-group-backdrop,.may-overlap-shade';

  // Descend through layout wrappers, but never split a paired control into labels/icons.
  function rowsOf(group, win) {
    const cells = [];
    function walk(parent) {
      for (const node of parent.children) {
        if (node.matches(IGNORE) || node.hidden || win.getComputedStyle(node).display === 'none') continue;
        if (node.matches(ATOM)) {
          const rect = node.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) cells.push({ node, rect });
        } else walk(node);
      }
    }
    for (const host of group.querySelectorAll(CONTENT)) walk(host);
    cells.sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);
    const rows = [];
    for (const cell of cells) {
      const previous = rows[rows.length - 1];
      if (previous && Math.abs(previous.top - cell.rect.top) <= 2) previous.nodes.push(cell.node);
      else rows.push({ top: cell.rect.top, nodes: [cell.node] });
    }
    return rows;
  }

  function mount(options = {}) {
    const doc = options.document || globalThis.document, win = doc.defaultView;
    const selector = options.groups || GROUPS;
    const duration = Math.min(1200, Math.max(0, options.duration == null ? 720 : options.duration));
    const media = win.matchMedia?.('(prefers-reduced-motion: reduce)');
    const states = new WeakMap(), jobs = new Map();
    const style = doc.createElement('style');
    style.dataset.mayAccordionStyle = '';
    style.textContent = '[' + PENDING + ']{display:none!important}';
    (doc.head || doc.documentElement).append(style);
    let disconnected = false;
    const groups = () => [...doc.querySelectorAll(selector)];
    const open = group => group.matches('.gz-open,.pt-open') && !group.hasAttribute('data-library-folded');
    const layout = () => (options.onLayout || win.mayButtonStandardRefresh)?.();
    const now = () => win.performance.now();

    function finish(group, refresh = true) {
      const job = jobs.get(group); if (!job) return;
      jobs.delete(group); win.cancelAnimationFrame(job.frame);
      for (const node of job.hidden) node.removeAttribute(PENDING);
      if (refresh) layout();
    }
    function prefix(job, count) {
      for (const row of job.rows.slice(job.shown, count)) for (const node of row.nodes) {
        for (let parent = node; parent && parent !== job.group; parent = parent.parentElement) {
          if (job.hidden.delete(parent)) parent.removeAttribute(PENDING);
        }
      }
      job.shown = count;
    }
    function reveal(group) {
      finish(group, false);
      if (disconnected || media?.matches || !duration) return;
      const rows = rowsOf(group, win); if (rows.length < 2) return;
      const job = { group, rows, shown: 0, hidden: new Set(), start: now(), frame: 0 };
      // Empty columns/sections must collapse too, otherwise their gaps remain in flow.
      const containers = new Set();
      for (const row of rows) for (const node of row.nodes) {
        job.hidden.add(node);
        for (let p = node.parentElement; p && p !== group; p = p.parentElement) containers.add(p);
      }
      for (const parent of containers) {
        const hasOtherContent = [...parent.children].some(child => !child.matches(IGNORE) &&
          !job.hidden.has(child) && !containers.has(child) && !child.hidden && win.getComputedStyle(child).display !== 'none');
        if (!hasOtherContent) job.hidden.add(parent);
      }
      jobs.set(group, job);
      for (const node of job.hidden) node.setAttribute(PENDING, '');
      const focused = rows.findIndex(row => row.nodes.some(node => node.contains(doc.activeElement)));
      prefix(job, Math.max(1, focused + 1)); layout();
      function tick() {
        if (!jobs.has(group)) return;
        if (!group.isConnected || !open(group) || media?.matches) { finish(group); return; }
        const count = Math.min(rows.length, 1 + Math.floor((now() - job.start) / duration * (rows.length - 1)));
        if (count > job.shown) { prefix(job, count); layout(); }
        if (count === rows.length) finish(group, false);
        else job.frame = win.requestAnimationFrame(tick);
      }
      job.frame = win.requestAnimationFrame(tick);
    }
    function sync(records = []) {
      if (disconnected) return;
      const current = new Set(groups());
      for (const group of current) {
        const on = open(group), before = states.get(group);
        const reopened = before === true && on && records.some(record => record.target === group && record.attributeName === 'class' && !/\b(?:gz-open|pt-open)\b/.test(record.oldValue || ''));
        states.set(group, on);
        if (before === false && on || reopened) reveal(group);
        else if (!on || jobs.has(group) && jobs.get(group).rows.some(row => row.nodes.some(node => !group.contains(node)))) finish(group);
      }
      for (const group of jobs.keys()) if (!current.has(group)) finish(group);
    }
    // Restored groups and groups inserted already open establish a completed baseline.
    for (const group of groups()) states.set(group, open(group));
    const observer = new win.MutationObserver(sync);
    observer.observe(doc.documentElement, { subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ['class', 'data-library-folded'] });
    function focus(event) {
      for (const [group, job] of jobs) {
        const row = job.rows.findIndex(row => row.nodes.some(node => node.contains(event.target)));
        if (row >= job.shown) { prefix(job, row + 1); layout(); }
      }
    }
    // Expose rows before native Tab or menu arrow handlers attempt to focus them.
    function keyboard(event) { if (['Tab', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) for (const group of [...jobs.keys()]) if (group.contains(event.target)) finish(group); }
    const reduce = () => { if (media.matches) for (const group of [...jobs.keys()]) finish(group); };
    doc.addEventListener('focusin', focus, true); doc.addEventListener('keydown', keyboard, true);
    media?.addEventListener?.('change', reduce);
    function disconnect() {
      if (disconnected) return;
      disconnected = true; observer.disconnect();
      for (const group of [...jobs.keys()]) finish(group);
      doc.removeEventListener('focusin', focus, true); doc.removeEventListener('keydown', keyboard, true);
      media?.removeEventListener?.('change', reduce); win.removeEventListener('pagehide', disconnect); style.remove();
    }
    win.addEventListener('pagehide', disconnect, { once: true });
    return { sync, disconnect, finish: group => finish(group), get activeCount() { return jobs.size; } };
  }
  return { mount, rowsOf };
});
