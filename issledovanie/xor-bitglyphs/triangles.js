/* Two separate experiments: catalogue placement and rule-90 evolution. */
(function () {
  'use strict';
  const host = document.getElementById('triangleExperiments');
  if (!host) return;
  const figures = window.MayatnikXorAxesTemplates.entries().slice(0, 4).map(entry => {
    const part = entry.shape.parts[0], pivot = entry.source.pivot, points = [];
    part.data.forEach((value, index) => {
      const x = index % part.width - pivot.x, y = Math.floor(index / part.width) - pivot.y;
      if (value && (x || y)) points.push([x, y]);
    });
    return points;
  });
  const rotate = (x, y, turn) => [[x, y], [-y, x], [-x, -y], [y, -x]][turn];
  const combinations = Array.from({length: 256}, (_, index) => {
    const turns = figures.map((_, i) => Math.floor(index / 4 ** i) % 4);
    const bits = new Set();
    figures.forEach((points, i) => points.forEach(([x, y]) => {
      const key = rotate(x, y, turns[i]).join(',');
      if (bits.has(key)) bits.delete(key); else bits.add(key);
    }));
    bits.delete('0,0');
    return {turns, points: Array.from(bits, key => key.split(',').map(Number))};
  });
  let selected = 0, positions = [], currentSVG = '';
  host.innerHTML = `
    <div class="triangle-controls" role="group" aria-label="Исходный вариант">
      <button type="button" id="triPrev" title="Предыдущее сочетание" aria-label="Предыдущее сочетание">‹</button>
      <label>Вариант <input id="triVariant" type="number" min="1" max="256" value="1"></label>
      <button type="button" id="triNext" title="Следующее сочетание" aria-label="Следующее сочетание">›</button>
      <output id="triTurns"></output>
    </div>
    <div class="triangle-pair">
      <article><h3>256 готовых сочетаний</h3>
        <div class="triangle-stage"><canvas id="triCatalogue" width="920" height="920" role="img" aria-label="256 сочетаний треугольником; выберите фигуру щелчком"></canvas></div>
        <p>Ряды 1…22: 253 сочетания; последний ряд: ещё 3. Пустые места не заполняются копиями. Нажмите на фигуру, чтобы взять её для маятника.</p>
        <div class="triangle-controls"><button type="button" id="triSaveCatalogue">SVG раскладки</button></div>
      </article>
      <article><h3>Маятник по правилу XOR</h3>
        <div class="triangle-controls">
          <label>Начало <select id="triMode"><option value="row">Строка битов</option><option value="glyph">Целый битглиф</option></select></label>
          <label id="triRowLabel">Строка Y <input id="triRow" type="number" min="-11" max="11" value="1"></label>
          <label>Высота <input id="triRows" type="number" min="8" max="512" value="256"></label>
          <label>Масштаб <select id="triZoom"><option value="1">×1</option><option value="2">×2</option><option value="4">×4</option><option value="8">×8</option></select></label>
          <label><input id="triFit" type="checkbox" checked>По ширине</label>
        </div>
        <div class="triangle-source"><canvas id="triSource" width="184" height="184" role="img" aria-label="Выбранное XOR-построение и исходная строка"></canvas><p id="triSeedInfo"></p></div>
        <div class="triangle-stage" id="triEvolutionStage" tabindex="0" aria-label="Маятник; область прокручивается"><div id="triEvolution"></div></div>
        <p id="triEvolutionInfo" role="status"></p>
        <div class="triangle-controls"><button type="button" id="triSaveEvolution">SVG маятника</button></div>
      </article>
    </div>`;
  const get = id => document.getElementById(id);
  function integer(input, low, high, fallback) {
    const value = Number(input.value);
    const bounded = Number.isFinite(value) ? Math.max(low, Math.min(high, Math.round(value))) : fallback;
    input.value = bounded;
    return bounded;
  }
  function download(svg, name) {
    const url = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
    const link = document.createElement('a'); link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  const openSVG = (width, height, title) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}"><title>${title}</title><rect width="100%" height="100%" fill="#080c12"/>`;
  const motif = points => points.map(([x, y]) => `<rect x="${x + 11}" y="${y + 11}" width="1" height="1"/>`).join('');
  function drawCatalogue() {
    const canvas = get('triCatalogue'), ctx = canvas.getContext('2d');
    ctx.fillStyle = '#080c12'; ctx.fillRect(0, 0, 920, 920);
    ctx.textAlign = 'center'; ctx.font = '10px monospace'; positions = [];
    let index = 0;
    for (let row = 1; row <= 23; row++) {
      const count = Math.min(row, 256 - index), left = (920 - count * 40) / 2;
      for (let col = 0; col < count; col++, index++) {
        const x = left + col * 40, y = (row - 1) * 40;
        positions.push({x, y, index});
        ctx.fillStyle = index === selected ? '#78c4ff' : '#e6edf7';
        combinations[index].points.forEach(([px, py]) => ctx.fillRect(x + px + 19, y + py + 12, 1, 1));
        ctx.fillText(String(index + 1), x + 20, y + 36);
        if (index === selected) { ctx.strokeStyle = '#ffd276'; ctx.strokeRect(x + .5, y + .5, 39, 39); }
      }
    }
  }
  function drawEvolution() {
    const combo = combinations[selected], glyphMode = get('triMode').value === 'glyph';
    const sourceY = integer(get('triRow'), -11, 11, 1), rows = integer(get('triRows'), 8, 512, 256);
    const zoom = Number(get('triZoom').value), fit = get('triFit').checked;
    get('triRowLabel').hidden = glyphMode;
    const source = get('triSource').getContext('2d');
    source.fillStyle = '#080c12'; source.fillRect(0, 0, 184, 184);
    if (!glyphMode) { source.fillStyle = '#284568'; source.fillRect(0, (sourceY + 11) * 8, 184, 8); }
    source.fillStyle = '#e6edf7'; combo.points.forEach(([x,y]) => source.fillRect((x+11)*8, (y+11)*8, 8, 8));
    // Neutral origin is shown only in this source preview, never used as an XOR bit.
    source.fillStyle = '#ff92d5'; source.fillRect(88, 88, 8, 8);
    let line = glyphMode ? new Set([0]) : new Set(combo.points.filter(p => p[1] === sourceY).map(p => p[0]));
    const initialCount = line.size, half = glyphMode ? rows - 1 : rows + 10;
    const step = glyphMode ? 24 : 1, width = (half * 2 + 1) * step, height = rows * step;
    const title = `Маятник XOR, вариант ${selected+1}, ${rows} строк, ${glyphMode ? 'целый битглиф' : 'строка Y='+sourceY}`;
    const parts = [openSVG(width, height, title)];
    if (glyphMode) parts.push(`<defs><g id="triMotif" fill="#b8dfff">${motif(combo.points)}</g></defs>`);
    else parts.push('<g fill="#b8dfff" shape-rendering="crispEdges">');
    let occupied = 0;
    for (let row = 0; row < rows; row++) {
      for (const x of line) {
        occupied++;
        if (glyphMode) parts.push(`<use xlink:href="#triMotif" x="${(x+half)*step}" y="${row*step}"/>`);
        else parts.push(`<rect x="${x+half}" y="${row}" width="1" height="1"/>`);
      }
      const next = new Set();
      for (const x of line) for (const nx of [x-1, x+1]) {
        if (next.has(nx)) next.delete(nx); else next.add(nx);
      }
      line = next;
    }
    if (!glyphMode) parts.push('</g>');
    parts.push('</svg>'); currentSVG = parts.join('');
    get('triEvolution').innerHTML = currentSVG;
    const svg = get('triEvolution').firstElementChild;
    svg.style.width = fit ? '100%' : `${width*zoom}px`; svg.style.height = 'auto';
    svg.style.maxWidth = 'none';
    get('triSeedInfo').textContent = `Вариант ${selected+1}: ${combo.points.length} единиц. Розовый центр — нейтральная клетка, не единица. ` + (glyphMode ? 'Одна ячейка маятника содержит весь выбранный рисунок.' : `Начальная строка Y=${sourceY}: ${initialCount} единиц.`);
    get('triEvolutionInfo').textContent = `${rows} строк · ширина поля ${half*2+1} ${glyphMode ? 'ячеек-битглифов' : 'битов'} · ${occupied} ${glyphMode ? 'занятых ячеек' : 'единиц'}` + (!initialCount ? ' · В исходной строке нет единиц: маятник пуст. Выберите другую строку.' : '');
  }
  function choose(index) {
    selected = Math.max(0, Math.min(255, index)); get('triVariant').value = selected + 1;
    get('triTurns').textContent = 'I…IV: ' + combinations[selected].turns.map(t => t*90+'°').join(' · ');
    drawCatalogue(); drawEvolution();
  }
  get('triCatalogue').addEventListener('click', event => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX-box.left)*920/box.width, y = (event.clientY-box.top)*920/box.height;
    const hit = positions.find(p => x>=p.x && x<p.x+40 && y>=p.y && y<p.y+40);
    if (hit) choose(hit.index);
  });
  get('triVariant').addEventListener('change', () => choose(integer(get('triVariant'), 1, 256, 1)-1));
  get('triPrev').addEventListener('click', () => choose((selected+255)%256));
  get('triNext').addEventListener('click', () => choose((selected+1)%256));
  for (const id of ['triMode','triRow','triRows','triFit']) get(id).addEventListener('change', drawEvolution);
  get('triZoom').addEventListener('change', () => { get('triFit').checked = false; drawEvolution(); });
  get('triSaveEvolution').addEventListener('click', () => download(currentSVG, `xor-pendulum-${selected+1}.svg`));
  get('triSaveCatalogue').addEventListener('click', () => {
    const parts = [openSVG(920, 920, '256 сочетаний поворотов четырёх битглифов')];
    for (const p of positions) {
      const combo = combinations[p.index];
      parts.push(`<g fill="#e6edf7" transform="translate(${p.x+8},${p.y+1})"><title>Вариант ${p.index+1}; повороты ${combo.turns.map(t=>t*90).join(', ')}</title>${motif(combo.points)}</g><text x="${p.x+20}" y="${p.y+36}" text-anchor="middle" font-size="10" font-family="monospace" fill="#e6edf7">${p.index+1}</text>`);
    }
    parts.push('</svg>'); download(parts.join(''), 'xor-256-triangle.svg');
  });
  choose(0);
})();
