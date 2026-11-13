(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else model.mount(root.document);
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  // Frame state 06, slot 3, analysis.json. The last point closes the route.
  const route = [
    '5,0','6,0','6,1','6,2','7,2','7,3','7,4','6,4','6,5','7,5','7,4','8,4',
    '8,5','9,5','9,6','8,6','7,6','6,6','6,7','6,8','6,9','6,10','6,11','5,11',
    '5,12','4,12','4,11','4,10','4,9','4,8','4,7','4,6','3,6','2,6','1,6','1,5',
    '2,5','2,4','3,4','4,4','4,5','3,5','3,4','3,3','4,3','4,2','5,2','5,1','5,0'
  ];
  const crossings = ['3,4', '7,4'];
  const length = route.length - 1;

  function prefix(passed) {
    const edges = Array(length).fill(0);
    const departures = new Map();
    for (let index = 0; index < passed; index++) {
      const edge = index % length;
      edges[edge]++;
      const departure = route[edge];
      departures.set(departure, (departures.get(departure) ?? 0) + 1);
    }
    return { edges, departures, whiteEdges: edges.filter(count => count % 2).length };
  }

  function mount(document) {
    const lookup = id => document.getElementById(id);
    const svg = lookup('drawing');
    const ns = 'http://www.w3.org/2000/svg';
    function element(tag, attributes) {
      const result = document.createElementNS(ns, tag);
      for (const [key, value] of Object.entries(attributes)) result.setAttribute(key, value);
      svg.append(result);
      return result;
    }
    const points = route.map(point => point.split(',').map(Number));
    const edgeNodes = points.slice(0, -1).map(([x, y], index) =>
      element('line', { x1: x, y1: y, x2: points[index + 1][0], y2: points[index + 1][1],
        stroke: '#fff', 'stroke-width': '.19', 'stroke-linecap': 'round' }));
    svg.setAttribute('viewBox', '0 -1 10 14');
    const dots = new Map();
    for (const id of new Set(route)) {
      const [cx, cy] = id.split(',').map(Number);
      dots.set(id, element('circle', { cx, cy, r: crossings.includes(id) ? '.19' : '.13', fill: '#000' }));
    }
    const laps = lookup('laps');
    const slider = lookup('position');
    const play = lookup('play');
    const progress = lookup('progress');
    const white = lookup('white');
    const statuses = [lookup('first-crossing'), lookup('second-crossing')];
    let timer = null;

    function render() {
      const passed = Number(slider.value);
      const current = prefix(passed);
      current.edges.forEach((count, index) => {
        edgeNodes[index].style.visibility = count % 2 ? 'visible' : 'hidden';
      });
      for (const [id, dot] of dots) {
        const count = current.departures.get(id) ?? 0;
        dot.style.visibility = count && count % 2 === 0 ? 'visible' : 'hidden';
      }
      progress.textContent = passed + ' / ' + slider.max;
      white.textContent = current.whiteEdges;
      crossings.forEach((id, index) => {
        const count = current.departures.get(id) ?? 0;
        statuses[index].textContent = count + ' · ' + (count % 2 ? 'белая' : 'чёрная');
      });
    }

    function pause() {
      if (timer !== null) clearInterval(timer);
      timer = null;
      play.textContent = 'Пуск';
    }

    laps.addEventListener('change', () => {
      pause();
      slider.max = length * Number(laps.value);
      slider.value = slider.max;
      render();
    });
    slider.addEventListener('input', () => { pause(); render(); });
    lookup('reset').addEventListener('click', () => { pause(); slider.value = 0; render(); });
    play.addEventListener('click', () => {
      if (timer !== null) { pause(); return; }
      if (slider.value === slider.max) { slider.value = 0; render(); }
      play.textContent = 'Пауза';
      timer = setInterval(() => {
        slider.value = Number(slider.value) + 1;
        render();
        if (slider.value === slider.max) pause();
      }, 70);
    });
    render();
  }

  return { route, crossings, prefix, mount };
});
