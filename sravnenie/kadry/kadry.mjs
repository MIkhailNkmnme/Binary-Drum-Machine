import {compareFrames, gridFor, youtubeVideoId} from './diff.mjs?v=1';

const element = id => document.getElementById(id);
const frameCanvas = element('frame');
const image = frameCanvas.getContext('2d', {alpha: false, willReadFrequently: true});
const mapCanvas = element('heatmap');
const map = mapCanvas.getContext('2d', {alpha: false});
const gridInputs = ['cell-width', 'cell-height', 'threshold', 'pixels', 'four'];
const format = new Intl.NumberFormat('ru', {maximumFractionDigits: 3});
let selectedFile = null;
let captureStream = null;
let captureVideo = null;
let captureRequest = 0;
let dependency;
let job;

function status(text, error = false) {
  const output = element('status');
  output.textContent = text;
  output.toggleAttribute('data-error', error);
}

function controls() {
  const running = !!job?.running;
  const busy = !!job?.busy;
  const fileReady = job?.kind === 'file' && !job.done;
  element('next').disabled = !fileReady || running || busy;
  element('all').disabled = !fileReady || running || busy;
  element('pause').disabled = !running || job.kind === 'capture';
  element('restart').disabled = !selectedFile;
  element('csv').disabled = !job?.results.length;
  element('use-frame').disabled = !job?.index;
  element('stop-capture').disabled = !captureStream;
  for (const id of gridInputs) element(id).disabled = !job?.current || running;
}

function clearAnalysis() {
  job?.controller.abort();
  if (job?.iterator) void job.iterator.return().catch(() => {});
  job = null;
  element('results').replaceChildren();
  element('metrics').textContent = 'Для сравнения нужны два кадра.';
  element('cell-info').textContent = 'Нажмите на карту, чтобы посмотреть ячейку.';
  image.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
  map.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
  controls();
}

function createJob(kind, name, frames) {
  clearAnalysis();
  const controller = new AbortController();
  job = {kind, name, controller, iterator: frames(controller.signal), index: 0, results: []};
  controls();
  return job;
}

function loadVideoLibrary() {
  if (window.Mediabunny) return Promise.resolve(window.Mediabunny);
  dependency ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '../../mayatnik/vendor/mediabunny-1.65.0.min.js';
    script.onload = () => window.Mediabunny
      ? resolve(window.Mediabunny) : reject(new Error('Модуль видео не запустился.'));
    script.onerror = () => {
      script.remove();
      reject(new Error('Модуль видео не загрузился.'));
    };
    document.head.append(script);
  }).catch(error => {
    dependency = null;
    throw error;
  });
  return dependency;
}

async function* videoFrames(file, signal) {
  const {Input, ALL_FORMATS, BlobSource, VideoSampleSink} = await loadVideoLibrary();
  signal.throwIfAborted();
  const input = new Input({source: new BlobSource(file), formats: ALL_FORMATS});
  const dispose = () => input.dispose();
  signal.addEventListener('abort', dispose, {once: true});
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error('В файле нет видеодорожки.');
    if (!await track.canDecode()) throw new Error('Браузер не декодирует эту видеодорожку. Попробуйте MP4 (H.264) или WebM.');
    for await (const sample of new VideoSampleSink(track).samples()) {
      try {
        signal.throwIfAborted();
        yield {
          width: sample.displayWidth, height: sample.displayHeight,
          time: sample.timestamp, paint: ctx => sample.draw(ctx, 0, 0)
        };
      } finally {
        sample.close();
      }
    }
  } finally {
    signal.removeEventListener('abort', dispose);
    if (!signal.aborted) dispose();
  }
}

async function* gifFrames(file, signal) {
  if (!window.ImageDecoder || !await ImageDecoder.isTypeSupported('image/gif')) {
    throw new Error('Для покадрового чтения GIF откройте страницу в Chrome или Edge.');
  }
  signal.throwIfAborted();
  const decoder = new ImageDecoder({type: 'image/gif', data: file.stream(), preferAnimation: true});
  const dispose = () => decoder.close();
  signal.addEventListener('abort', dispose, {once: true});
  try {
    await decoder.tracks.ready;
    await decoder.completed;
    const track = decoder.tracks.selectedTrack;
    if (!track?.frameCount) throw new Error('В GIF нет кадров.');
    let elapsed = 0;
    for (let index = 0; index < track.frameCount; index++) {
      signal.throwIfAborted();
      const {image: sample} = await decoder.decode({frameIndex: index});
      try {
        yield {
          width: sample.displayWidth, height: sample.displayHeight, time: elapsed,
          paint: ctx => ctx.drawImage(sample, 0, 0)
        };
        elapsed += (sample.duration ?? 0) / 1e6;
      } finally {
        sample.close();
      }
    }
  } finally {
    signal.removeEventListener('abort', dispose);
    if (!signal.aborted) dispose();
  }
}

function nextCapturedFrame(video, signal) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const id = video.requestVideoFrameCallback((_, metadata) => {
      signal.removeEventListener('abort', cancel);
      resolve(metadata);
    });
    function cancel() {
      video.cancelVideoFrameCallback(id);
      reject(signal.reason);
    }
    signal.addEventListener('abort', cancel, {once: true});
  });
}

async function* capturedFrames(video, signal) {
  let firstTime = null;
  while (!signal.aborted) {
    const {mediaTime} = await nextCapturedFrame(video, signal);
    firstTime ??= mediaTime;
    yield {
      width: video.videoWidth, height: video.videoHeight, time: mediaTime - firstTime,
      paint: ctx => ctx.drawImage(video, 0, 0)
    };
  }
}

function resizeGrid(current) {
  const w = element('cell-width'), h = element('cell-height');
  w.max = Math.ceil(current.width / 2);
  h.max = Math.ceil(current.height / 2);
  const grid = gridFor(current.width, current.height, Number(w.value), Number(h.value));
  w.value = grid.width;
  h.value = grid.height;
  return grid;
}

function compare(currentJob) {
  const {previous, current, index, time} = currentJob;
  const grid = resizeGrid(current);
  const input = element('threshold');
  const threshold = Math.min(100, Math.max(0, Number(input.value) || 0));
  input.value = threshold;
  const result = compareFrames(previous, current, grid, threshold);
  currentJob.comparison = {grid, result};
  const row = {index, time, columns: grid.columns, rows: grid.rows, threshold,
    cellWidth: grid.width, cellHeight: grid.height,
    count: grid.columns * grid.rows, changed: result.hasPrevious ? result.changed : null,
    average: result.hasPrevious ? result.average : null, maximum: result.hasPrevious ? result.maximum : null};
  currentJob.results[index - 1] = row;
}

function renderMap({grid, result}) {
  if (mapCanvas.width !== grid.columns) mapCanvas.width = grid.columns;
  if (mapCanvas.height !== grid.rows) mapCanvas.height = grid.rows;
  const colors = map.createImageData(grid.columns, grid.rows);
  for (let i = 0; i < result.scores.length; i++) {
    const score = Math.sqrt(result.scores[i] / 100), q = i * 4;
    colors.data[q] = 11 + 244 * score * score;
    colors.data[q + 1] = 16 + 224 * score;
    colors.data[q + 2] = 26 + 136 * score;
    colors.data[q + 3] = 255;
  }
  map.putImageData(colors, 0, 0);
}

function render(currentJob) {
  if (!currentJob.current) return;
  const {grid, result} = currentJob.comparison;
  renderMap(currentJob.comparison);
  const size = currentJob.current.width + ' × ' + currentJob.current.height + ' px';
  const frame = 'Кадр ' + currentJob.index + ' · ' + format.format(currentJob.time) + ' с · ' + size;
  const cells = grid.columns * grid.rows;
  element('metrics').textContent = frame + ' · ' + grid.columns + ' × ' + grid.rows + ' ячеек' +
    (result.hasPrevious ? ' · изменилось ' + format.format(result.changed) + ' из ' + format.format(cells) +
     ' · средняя разница ' + format.format(result.average) + ' %' : ' · начало сравнения');
  const rows = document.createDocumentFragment();
  for (const item of currentJob.results.slice(-80).reverse()) {
    const tr = document.createElement('tr');
    const values = [item.index, format.format(item.time), item.columns + ' × ' + item.rows, format.format(item.threshold),
      item.changed ?? '—', item.average === null ? '—' : format.format(item.average),
      item.maximum === null ? '—' : format.format(item.maximum)];
    for (const value of values) {
      const td = document.createElement('td');
      td.textContent = value;
      tr.append(td);
    }
    rows.append(tr);
  }
  element('results').replaceChildren(rows);
  element('cell-info').textContent = 'Нажмите на карту, чтобы посмотреть ячейку.';
}

async function process(currentJob, all) {
  if (!currentJob || currentJob.busy || currentJob.done) return;
  currentJob.busy = true;
  currentJob.running = all;
  controls();
  let painted = 0;
  try {
    do {
      const next = await currentJob.iterator.next();
      if (job !== currentJob || currentJob.controller.signal.aborted) return;
      if (next.done) {
        currentJob.done = true;
        status(currentJob.index ? 'Готово. Кадров: ' + format.format(currentJob.index) + '.' : 'Кадров нет.', !currentJob.index);
        break;
      }
      const frame = next.value;
      if (!(frame.width > 0 && frame.height > 0)) continue;
      if (frameCanvas.width !== frame.width) frameCanvas.width = frame.width;
      if (frameCanvas.height !== frame.height) frameCanvas.height = frame.height;
      image.clearRect(0, 0, frame.width, frame.height);
      frame.paint(image);
      currentJob.previous = currentJob.current;
      currentJob.current = image.getImageData(0, 0, frame.width, frame.height);
      currentJob.index++;
      if (currentJob.index === 1) ensurePendulum();
      currentJob.time = frame.time;
      compare(currentJob);
      if (performance.now() - painted >= 140) {
        render(currentJob);
        painted = performance.now();
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    } while (job === currentJob && currentJob.running);
  } catch (error) {
    if (job === currentJob && !currentJob.controller.signal.aborted) {
      currentJob.done = true;
      if (currentJob.kind === 'capture') endCapture();
      status(error?.message || 'Не удалось прочитать кадр.', true);
    }
  } finally {
    if (job === currentJob) {
      currentJob.busy = currentJob.running = false;
      render(currentJob);
      if (currentJob.kind === 'file' && currentJob.index && !currentJob.done) status(currentJob.name);
      controls();
    }
  }
}

function displayCanvas() {
  element('youtube-player').hidden = true;
  element('youtube-player').removeAttribute('src');
  frameCanvas.hidden = false;
  element('video-heading').textContent = 'Текущий кадр';
}

function endCapture(message) {
  captureRequest++;
  if (captureStream) {
    captureStream.getTracks().forEach(track => track.stop());
    captureStream = null;
  }
  if (captureVideo) {
    captureVideo.pause();
    captureVideo.srcObject = null;
    captureVideo.remove();
    captureVideo = null;
  }
  if (job?.kind === 'capture' && !job.done) {
    job.done = true;
    job.controller.abort();
    if (message) status(message + ' Кадров: ' + job.index + '.');
  }
  controls();
}

function openFile(file) {
  endCapture();
  displayCanvas();
  element('youtube-actions').hidden = true;
  selectedFile = file;
  const decode = /\.gif$/i.test(file.name) || file.type === 'image/gif' ? gifFrames : videoFrames;
  const next = createJob('file', file.name, signal => decode(file, signal));
  status('Читаю ' + file.name + '…');
  void process(next, false);
}

const captureAvailable = !!navigator.mediaDevices?.getDisplayMedia &&
  typeof HTMLVideoElement.prototype.requestVideoFrameCallback === 'function';
element('capture').disabled = !captureAvailable;
if (!captureAvailable) {
  element('capture-help').textContent = 'Захват вкладки доступен в настольном Chrome или Edge. Для анализа на этом устройстве откройте локальный файл.';
}
element('file').addEventListener('change', event => {
  const file = event.currentTarget.files[0];
  if (file) openFile(file);
});
element('youtube-form').addEventListener('submit', event => {
  event.preventDefault();
  const id = youtubeVideoId(element('youtube').value);
  if (!id) {
    status('Вставьте ссылку на ролик YouTube, включая youtu.be или Shorts.', true);
    return;
  }
  endCapture();
  clearAnalysis();
  selectedFile = null;
  element('file').value = '';
  const player = element('youtube-player');
  player.src = 'https://www.youtube-nocookie.com/embed/' + id;
  player.hidden = false;
  frameCanvas.hidden = true;
  element('video-heading').textContent = 'Видео YouTube';
  element('youtube-watch').href = 'https://www.youtube.com/watch?v=' + id;
  element('youtube-actions').hidden = false;
  ensurePendulum();
  status('Ролик подключён. Для анализа выберите его вкладку.');
  controls();
});

element('capture').addEventListener('click', async () => {
  endCapture();
  const request = captureRequest;
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {frameRate: {ideal: 15, max: 30}}, audio: false,
      selfBrowserSurface: 'exclude', monitorTypeSurfaces: 'exclude'
    });
    if (request !== captureRequest) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    const track = stream.getVideoTracks()[0];
    captureStream = stream;
    if (!track) throw new Error('У выбранного источника нет видеодорожки.');
    const surface = track.getSettings().displaySurface;
    if (surface && surface !== 'browser') throw new Error('Выберите вкладку браузера с видео.');
    const video = Object.assign(document.createElement('video'), {muted: true, playsInline: true, srcObject: stream});
    captureVideo = video;
    video.className = 'capture-video';
    video.setAttribute('aria-hidden', 'true');
    document.body.append(video);
    track.addEventListener('ended', () => {
      if (captureStream === stream) endCapture('Захват завершён.');
    }, {once: true});
    await video.play();
    if (request !== captureRequest) return;
    displayCanvas();
    const next = createJob('capture', 'Захват вкладки', signal => capturedFrames(video, signal));
    status('Захватываю видимые кадры. Время отсчитывается от начала захвата.');
    void process(next, true);
  } catch (error) {
    if (request !== captureRequest) return;
    endCapture();
    status(error.name === 'NotAllowedError' ? 'Захват не начат.' : error.message, true);
  }
});
element('stop-capture').addEventListener('click', () => endCapture('Захват остановлен.'));
element('next').addEventListener('click', () => void process(job, false));
element('all').addEventListener('click', () => void process(job, true));
element('pause').addEventListener('click', () => { if (job) job.running = false; });
element('restart').addEventListener('click', () => { if (selectedFile) openFile(selectedFile); });
addEventListener('pagehide', () => {
  endCapture();
  job?.controller.abort();
});

function refreshGrid() {
  if (!job?.current || job.running) return;
  compare(job);
  render(job);
}

for (const id of gridInputs.slice(0, 3)) element(id).addEventListener('change', refreshGrid);
element('pixels').addEventListener('click', () => {
  element('cell-width').value = element('cell-height').value = '1';
  refreshGrid();
});
element('four').addEventListener('click', () => {
  if (!job?.current) return;
  element('cell-width').value = Math.ceil(job.current.width / 2);
  element('cell-height').value = Math.ceil(job.current.height / 2);
  refreshGrid();
});

mapCanvas.addEventListener('click', event => {
  if (!job?.comparison?.result.hasPrevious) return;
  const {grid, result} = job.comparison;
  const rect = mapCanvas.getBoundingClientRect();
  const indexIn = (position, start, size, count) => Math.max(0, Math.min(count - 1, Math.floor((position - start) / size * count)));
  const c = indexIn(event.clientX, rect.left, rect.width, grid.columns), r = indexIn(event.clientY, rect.top, rect.height, grid.rows);
  const x = c * grid.width, y = r * grid.height;
  const w = Math.min(grid.width, job.current.width - x), h = Math.min(grid.height, job.current.height - y);
  element('cell-info').textContent = 'Столбец ' + (c + 1) + ', строка ' + (r + 1) + ' · x=' + x +
    ', y=' + y + ' · ' + w + ' × ' + h + ' px · разница ' + format.format(result.scores[r * grid.columns + c]) + ' %';
});

element('csv').addEventListener('click', () => {
  if (!job?.results.length) return;
  const header = 'frame,time_s,columns,rows,cell_width_px,cell_height_px,threshold_percent,cells,changed_cells,mean_rgb_percent,max_cell_percent';
  const values = [header, ...job.results.map(row => [row.index, row.time.toFixed(6), row.columns, row.rows,
    row.cellWidth, row.cellHeight, row.threshold, row.count, row.changed ?? '',
    row.average?.toFixed(6) ?? '', row.maximum?.toFixed(6) ?? ''].join(','))];
  const url = URL.createObjectURL(new Blob([values.join('\r\n') + '\r\n'], {type: 'text/csv;charset=utf-8'}));
  const link = Object.assign(document.createElement('a'), {href: url, download: 'zerkalius-raznitsa-kadrov.csv'});
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

function ensurePendulum() {
  if (element('pendulum-view').hidden && element('pendulum-form').checkValidity()) showPendulum();
}

function showPendulum() {
  const rows = Number(element('pendulum-rows').value);
  const frame = Number(element('pendulum-frame').value);
  const normalUrl = new URL('../../mayatnik/Zerkalius-mayatnik.html', location.href);
  normalUrl.search = new URLSearchParams({
    chisto: '1', mode: element('pendulum-mode').value, gpu: '0',
    n: rows, s: Math.max(rows, frame), k: frame
  });
  element('open-pendulum').href = normalUrl.href;
  element('open-pendulum').hidden = false;
  normalUrl.searchParams.set('embed', '1');
  const view = element('pendulum-view');
  view.hidden = false;
  if (view.src !== normalUrl.href) view.src = normalUrl.href;
}

element('pendulum-form').addEventListener('submit', event => {
  event.preventDefault();
  showPendulum();
});
element('pendulum-size').addEventListener('change', event => {
  element('pendulum-view').style.width = event.target.value + '%';
});
element('use-frame').addEventListener('click', () => {
  if (!job?.index) return;
  element('pendulum-frame').value = Math.min(job.index, Number(element('pendulum-frame').max));
  if (element('pendulum-form').reportValidity()) showPendulum();
});
