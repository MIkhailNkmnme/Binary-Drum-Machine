(() => {
  'use strict';
  const query = new URLSearchParams(location.search);
  const rows = Number(query.get('preview'));
  if (![8192, 16384].includes(rows)) return;

  const batchSize = rows === 16384 ? 256 : 512;
  const $ = id => document.getElementById(id);
  const canvas = $('largeField'), range = $('largeRange'), build = $('largeBuild'), status = $('largeStatus');
  const overview = $('largeFit'), exact = $('largeExact');
  const mode = query.get('mode') === 'pendR' ? 'pendR' : 'pend';
  const pair = mode === 'pend' && query.get('pair') === '1';
  const vertexCounts = {n3: Math.ceil(rows / 3) + Math.ceil(rows / 64), n: rows, '4n': 4 * rows};
  const plans = new Map([...range.options].map(option => {
    const vertices = vertexCounts[option.value];
    const steps = pair ? Math.floor(vertices / 2) : vertices;
    const geometry = MAYATNIK.geometry(mode, pair ? 2 * steps + 1 : vertices, rows);
    return [option.value, {geometry, steps, bytes: MayatnikGPU.fieldBufferBytes(geometry.W, rows)}];
  }));
  range.value = ['n3', 'n', '4n'].includes(query.get('range')) ? query.get('range') : 'n';
  $('largeTitle').textContent = rows + ' строки на видеокарте';
  $('gpuDiagnostics').hidden = true;
  $('largePreview').hidden = false;
  build.disabled = overview.disabled = exact.disabled = true;

  let gpu, context, field, building = false, cancelled = false, deviceFailed = false;
  let centerX = 0, centerY = 0, zoom = 1, fitting = true, animation = 0;
  let drag;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const fittedZoom = () => Math.min(canvas.clientWidth / field.W, canvas.clientHeight / field.H);
  const physicalRatio = () => Math.min(devicePixelRatio || 1, 1920 / canvas.clientWidth, 1200 / canvas.clientHeight);

  function fail(message) {
    deviceFailed = true;
    cancelled = true;
    status.textContent = message;
    build.disabled = overview.disabled = exact.disabled = true;
  }

  function render() {
    animation = 0;
    if (!field || deviceFailed || !canvas.clientWidth || !canvas.clientHeight) return;
    const width = canvas.clientWidth, height = canvas.clientHeight, ratio = physicalRatio();
    const pixelsWide = Math.max(1, Math.round(width * ratio)), pixelsHigh = Math.max(1, Math.round(height * ratio));
    if (canvas.width !== pixelsWide) canvas.width = pixelsWide;
    if (canvas.height !== pixelsHigh) canvas.height = pixelsHigh;
    if (fitting) zoom = fittedZoom();
    const step = width / (pixelsWide * zoom);
    const x = centerX - width / (2 * zoom), y = centerY - height / (2 * zoom);
    field.renderPreview(context, {x: step <= 1 ? Math.round(x) : x, y: step <= 1 ? Math.round(y) : y, step});
  }

  function queueRender() {
    if (!animation && !deviceFailed) animation = requestAnimationFrame(() => {
      try { render(); } catch (error) { fail('Ошибка просмотра WebGPU. ' + error.message); }
    });
  }

  function fit() {
    if (!field) return;
    centerX = field.W / 2;
    centerY = field.H / 2;
    fitting = true;
    queueRender();
  }

  function changeZoom(value, x = 0, y = 0) {
    if (!field || deviceFailed) return;
    const previous = fitting ? fittedZoom() : zoom;
    const next = clamp(value, fittedZoom(), 64);
    centerX = clamp(centerX + x * (1 / previous - 1 / next), 0, field.W);
    centerY = clamp(centerY + y * (1 / previous - 1 / next), 0, field.H);
    fitting = false;
    zoom = next;
    queueRender();
  }

  async function buildField(fallbackNote = '') {
    if (!gpu || deviceFailed) return;
    if (building) {
      cancelled = true;
      build.disabled = true;
      status.textContent = 'Останавливаю после текущей пачки…';
      return;
    }
    building = true;
    cancelled = false;
    build.textContent = 'Стоп';
    range.disabled = true;
    status.textContent = 'Готовлю поле на видеокарте…';
    const rangeMode = range.value, rangeLabel = range.selectedOptions[0].textContent;
    const {geometry, steps} = plans.get(rangeMode);
    let done = 0;
    try {
      if (animation) cancelAnimationFrame(animation);
      animation = 0;
      field?.destroy();
      field = null;
      const device = gpu.device;
      device.pushErrorScope('validation');
      device.pushErrorScope('out-of-memory');
      try {
        field = gpu.field({...geometry, H: rows});
        centerX = geometry.W / 2;
        centerY = rows / 2;
        fitting = true;
        render();
      } finally {
        const errors = await Promise.all([device.popErrorScope(), device.popErrorScope()]);
        const error = errors.find(Boolean);
        if (error) throw Error(error.message);
      }
      overview.disabled = exact.disabled = false;
      const url = new URL(location.href);
      url.searchParams.set('range', rangeMode);
      history.replaceState(null, '', url);
      const apexes = MayatnikGPU.apexList(MAYATNIK, {mode, pair, anchor: geometry.anchor, steps});
      if (pair) field.run([[geometry.anchor, geometry.anchor]]);
      const progress = () => `${geometry.W} × ${rows} · ${rangeLabel} · ${pair ? 'пар' : 'вершин'} ${done} / ${steps}`;
      status.textContent = progress();
      while (done < steps && !cancelled && !deviceFailed) {
        const next = Math.min(done + batchSize, steps);
        field.run(apexes.slice(done, next));
        await field.done();
        done = next;
        if (deviceFailed) return;
        status.textContent = progress();
        queueRender();
        // Give the browser a turn for drawing and for the stop button.
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (!deviceFailed) status.textContent = progress() + (done === steps ? ' · готово' : ' · остановлено') + fallbackNote;
    } catch (error) {
      field?.destroy();
      field = null;
      overview.disabled = exact.disabled = true;
      if (!deviceFailed) status.textContent = 'Не удалось построить поле на видеокарте. ' + error.message;
    } finally {
      building = false;
      build.textContent = 'Построить';
      build.disabled = range.disabled = deviceFailed;
    }
  }

  build.onclick = () => buildField();
  overview.onclick = fit;
  exact.onclick = () => {
    const pixelsWide = Math.max(1, Math.round(canvas.clientWidth * physicalRatio()));
    changeZoom(canvas.clientWidth / pixelsWide);
  };
  canvas.addEventListener('wheel', event => {
    if (!field) return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const motion = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
    changeZoom(zoom * Math.exp(clamp(-motion / 300, -1, 1)), event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2);
  }, {passive: false});
  canvas.addEventListener('pointerdown', event => {
    if (!field || !event.isPrimary || event.button !== 0) return;
    drag = {id: event.pointerId, x: event.clientX, y: event.clientY};
    canvas.setPointerCapture(event.pointerId);
  });
  function pan(x, y) {
    centerX = clamp(centerX + x / zoom, 0, field.W);
    centerY = clamp(centerY + y / zoom, 0, field.H);
    queueRender();
  }
  canvas.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId || !field) return;
    pan(drag.x - event.clientX, drag.y - event.clientY);
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  canvas.addEventListener('lostpointercapture', () => { drag = null; });
  canvas.addEventListener('keydown', event => {
    if (!field || deviceFailed) return;
    const move = {ArrowLeft: [-64, 0], ArrowRight: [64, 0], ArrowUp: [0, -64], ArrowDown: [0, 64]}[event.key];
    if (move) pan(...move);
    else if (event.key === '+' || event.key === '=') changeZoom(zoom * 2);
    else if (event.key === '-') changeZoom(zoom / 2);
    else if (event.key === 'Home') fit();
    else return;
    event.preventDefault();
  });
  new ResizeObserver(queueRender).observe(canvas);

  (async () => {
    try {
      gpu = await MayatnikGPU.create();
      context = gpu.attach(canvas);
      gpu.device.lost.then(info => fail('Потеряно подключение к видеокарте. ' + (info.message || 'Перезагрузите страницу.')));
      gpu.device.addEventListener('uncapturederror', event => fail('Ошибка WebGPU. ' + event.error.message));
      const limit = gpu.fieldBufferLimit;
      const requested = range.selectedOptions[0];
      for (const option of range.options) {
        const {bytes} = plans.get(option.value);
        option.disabled = bytes > limit;
        if (option.disabled) {
          option.title = `На буфер нужно ${Math.ceil(bytes / 1048576)} МиБ, WebGPU даёт ${Math.floor(limit / 1048576)} МиБ`;
          option.textContent += ' · лимит WebGPU';
        }
      }
      const fallback = ['n', 'n3', '4n'].find(value => plans.get(value).bytes <= limit);
      if (!fallback) throw Error('Ни один режим не помещается в доступный буфер WebGPU.');
      if (requested.disabled) range.value = fallback;
      build.disabled = false;
      await buildField(requested.disabled ? ' · выбран доступный режим' : '');
    } catch (error) {
      fail('Поле ' + rows + '. ' + error.message);
    }
  })();
})();
