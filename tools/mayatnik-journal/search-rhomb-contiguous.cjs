'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {parseArgs} = require('node:util');
const {isMainThread, parentPort, Worker, workerData} = require('node:worker_threads');
const {makeModel, matrix, verifyWitness} = require('./search-rhomb-routes.cjs');
const {patterns, scanGrid, steps} = require('./search-rhomb-sequences.cjs');

const root = path.resolve(__dirname, '../..');
const minLength = 30;
const checkpointInterval = 30_000;
const number = new Intl.NumberFormat('ru');
const directions = ['→', '↓', '↘', '↙'];

function buildJobs(maxSize, maxFrames) {
  return matrix()
    .filter(job => job.group === 'routes' && !job.route.startsWith('spiral') && job.n <= maxSize)
    .map(({id, n, x, y, route, halfX, halfY, width, height, edge, rule}) => {
      const joint = x !== 'off' && y !== 'off';
      const w = x === 'off' ? n - 1 : 2 * n - 1;
      const h = y === 'off' ? n : 2 * n - 1;
      const longest = Math.min(70, Math.max(Math.ceil(w / 2), Math.ceil(h / 2), Math.min(w, h)));
      const positions = x === 'off' ? n : w;
      const motion = x === 'off' ? y : x;
      const period = joint ? 16 * (n - 1) : 2 * (positions - 1) * (motion === 'pendulum' ? 2 : 1);
      return {id, n, x, y, route, halfX, halfY, width, height, edge, rule, longest, period,
        last: maxFrames === null ? period : Math.min(period, maxFrames)};
    })
    .filter(job => job.longest >= minLength)
    .sort((a, b) => a.n - b.n || a.id - b.id);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function atomicWrite(file, value) {
  const temporary = file + '.tmp';
  fs.writeFileSync(temporary, value);
  fs.renameSync(temporary, file);
}

function writeJson(file, value) {
  atomicWrite(file, JSON.stringify(value, null, 2) + '\n');
}

function removeIfPresent(file) {
  try {
    fs.unlinkSync(file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function sourceDigest() {
  const digest = createHash('sha256');
  for (const file of [
    '_js/initial-rows.js',
    'mayatnik/mayatnik-core.js',
    'mayatnik/mayatnik-edge-flow.js',
    'mayatnik/mayatnik-rhomb-pendulum.js',
    'tools/mayatnik-journal/search-rhomb-sequences.cjs',
    'tools/mayatnik-journal/search-rhomb-routes.cjs',
    'tools/mayatnik-journal/search-rhomb-contiguous.cjs',
  ]) digest.update(fs.readFileSync(path.join(root, file)));
  return digest.digest('hex');
}

function checkpointPath(directory, id) {
  return path.join(directory, 'checkpoint-' + id + '.bin');
}

function resultPath(directory, id) {
  return path.join(directory, 'result-' + id + '.json');
}

function readCheckpoint(file) {
  const data = fs.readFileSync(file);
  const headerLength = data.readUInt32LE();
  if (headerLength < 1 || headerLength > data.length - 4) throw Error('Повреждён заголовок ' + file);
  const header = JSON.parse(data.toString('utf8', 4, 4 + headerLength));
  return {...header, bits: data.subarray(4 + headerLength)};
}

function saveCheckpoint(file, model, matches) {
  const snapshot = model.snapshot();
  const header = Buffer.from(JSON.stringify({state: model.checkpoint(), matches}));
  const size = Buffer.alloc(4);
  size.writeUInt32LE(header.length);
  const bits = Buffer.from(snapshot.values.buffer, snapshot.values.byteOffset, snapshot.values.byteLength);
  atomicWrite(file, Buffer.concat([size, header, bits]));
}

function runJob(model, job, directory, control) {
  const resultFile = resultPath(directory, job.id);
  const checkpointFile = checkpointPath(directory, job.id);
  if (fs.existsSync(resultFile)) {
    removeIfPresent(checkpointFile);
    return null;
  }

  model.start(job);
  const matches = [];
  let checked = 0;
  if (fs.existsSync(checkpointFile)) {
    const {state, bits, matches: savedMatches} = readCheckpoint(checkpointFile);
    if (!Number.isSafeInteger(state.frame) || state.frame < 1 || state.frame > job.last || !Array.isArray(savedMatches)) {
      throw Error('Повреждены данные опорного кадра ' + checkpointFile);
    }
    model.resume(state, bits);
    checked = state.frame;
    matches.push(...savedMatches);
  }

  const remaining = new Uint8Array(patterns.length);
  remaining.fill(1, minLength - 5, job.longest - 4);
  for (const match of matches) remaining[match.length - 5] = 0;
  const goal = job.longest - minLength + 1;
  let checkpointAt = Date.now() + checkpointInterval;
  parentPort.postMessage({type: 'start', id: job.id, n: job.n, rule: job.rule, checked, last: job.last});

  while (checked < job.last && matches.length < goal && !Atomics.load(control, 1)) {
    if (checked > 0) model.advance();
    const snapshot = model.snapshot();
    for (const [length, [[direction, , row, column, endRow, endColumn]]] of
      scanGrid(snapshot.width, snapshot.height, snapshot, remaining)) {
      verifyWitness(snapshot, length, direction, row, column);
      matches.push({length, direction: directions[direction], frame: snapshot.frame, row, column, endRow, endColumn});
    }
    checked = snapshot.frame;
    if (Date.now() >= checkpointAt) {
      saveCheckpoint(checkpointFile, model, matches);
      parentPort.postMessage({type: 'progress', id: job.id, n: job.n, rule: job.rule, checked, last: job.last});
      checkpointAt = Date.now() + checkpointInterval;
    }
  }

  if (checked < job.last && matches.length < goal) {
    if (checked > 0) saveCheckpoint(checkpointFile, model, matches);
    return null;
  }

  const complete = {configuration: job, checked, allLengthsFound: matches.length === goal,
    matches: matches.sort((a, b) => a.length - b.length)};
  writeJson(resultFile, complete);
  removeIfPresent(checkpointFile);
  return complete;
}

function worker() {
  const {jobs, directory, shared} = workerData;
  const control = new Int32Array(shared);
  const model = makeModel();
  while (!Atomics.load(control, 1)) {
    const index = Atomics.add(control, 0, 1);
    if (index >= jobs.length) break;
    const result = runJob(model, jobs[index], directory, control);
    if (result) parentPort.postMessage({type: 'result', id: jobs[index].id, hits: result.matches.length});
  }
}

function startWorker(jobs, directory, shared, onMessage) {
  return new Promise((resolve, reject) => {
    const thread = new Worker(__filename, {workerData: {jobs, directory, shared}});
    const stopOnError = (error) => {
      Atomics.store(new Int32Array(shared), 1, 1);
      reject(error);
    };
    thread.on('message', onMessage);
    thread.on('error', stopOnError);
    thread.on('exit', code => {
      if (code === 0) resolve();
      else stopOnError(Error('Расчёт прервался в рабочем потоке (код ' + code + ').'));
    });
  });
}

function parseCommand() {
  const {values} = parseArgs({options: {
    help: {type: 'boolean', short: 'h'},
    plan: {type: 'boolean'},
    output: {type: 'string'},
    workers: {type: 'string'},
    'max-size': {type: 'string'},
    'max-frames': {type: 'string'},
  }});
  const maxSize = Number(values['max-size'] ?? 1024);
  if (![16, 32, 64, 128, 256, 512, 1024].includes(maxSize)) {
    throw Error('--max-size принимает одно из значений 16, 32, 64, 128, 256, 512, 1024.');
  }
  const maxFrames = values['max-frames'] === undefined ? null : Number(values['max-frames']);
  if (maxFrames !== null && (!Number.isSafeInteger(maxFrames) || maxFrames < 1)) {
    throw Error('--max-frames принимает целое положительное число.');
  }

  const cores = os.availableParallelism();
  const workers = Number(values.workers ?? Math.min(3, Math.max(1, cores - 1)));
  if (!Number.isSafeInteger(workers) || workers < 1 || workers > cores) {
    throw Error('--workers принимает число от 1 до ' + cores + '.');
  }
  const defaultDirectory = 'romb-search-' + maxSize + (maxFrames === null ? '' : '-frames-' + maxFrames);
  const directory = path.resolve(values.output ?? path.join(os.homedir(), defaultDirectory));
  return {help: values.help, plan: values.plan, directory, maxSize, maxFrames, workers};
}

async function main() {
  const {help, plan, directory, maxSize, maxFrames, workers} = parseCommand();
  if (help) {
    console.log(`node tools/mayatnik-journal/search-rhomb-contiguous.cjs [параметры]
Поиск строк 30–70 в каждом кадре одного периода движения.

  --plan             Показать объём без расчёта
  --max-size 1024    Верхняя высота ромба
  --max-frames N     Ограничить число кадров на вариант
  --workers 3        Число рабочих потоков
  --output PATH      Папка для опорных кадров и results.json

Ctrl+C сохраняет прогресс. Та же команда продолжает расчёт.`);
    return;
  }

  const jobs = buildJobs(maxSize, maxFrames);
  const plannedFrames = jobs.reduce((sum, job) => sum + job.last, 0);
  console.log(`${jobs.length} вариантов, до ${number.format(plannedFrames)} кадров, N ≤ ${maxSize}.`);
  if (plan) return;
  fs.mkdirSync(directory, {recursive: true});
  const lock = path.join(directory, 'run.lock');
  try {
    fs.writeFileSync(lock, String(process.pid) + '\n', {flag: 'wx'});
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw Error('Папка уже занята расчётом. Порядок восстановления после сбоя указан в инструкции. ' + lock);
  }

  const shared = new SharedArrayBuffer(2 * Int32Array.BYTES_PER_ELEMENT);
  const control = new Int32Array(shared);
  function interrupt() {
    if (!Atomics.exchange(control, 1, 1)) console.log('Останавливаю после текущих кадров и сохраняю опорные точки.');
  }
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  try {
    const manifest = {version: 1, source: sourceDigest(), mode: 'motion-period', maxSize, maxFrames,
      lengths: [minLength, 70], directions, steps};
    const manifestFile = path.join(directory, 'run.json');
    if (!fs.existsSync(manifestFile)) writeJson(manifestFile, manifest);
    else if (JSON.stringify(readJson(manifestFile)) !== JSON.stringify(manifest)) {
      throw Error('В папке остались данные от другой версии или параметров расчёта. Укажите другую папку через --output.');
    }

    const pending = jobs.filter(job => !fs.existsSync(resultPath(directory, job.id)));
    let completed = jobs.length - pending.length;
    console.log(`Папка ${directory}. Завершено ${completed}/${jobs.length}.`);
    const taskCount = Math.min(workers, pending.length);
    const onMessage = ({type, id, n, rule, checked, last, hits}) => {
      if (type === 'result') {
        completed++;
        console.log(`Вариант ${id} завершён (${completed}/${jobs.length}), найдено строк: ${hits}.`);
      } else {
        console.log(`Вариант ${id}, N = ${n}, ${rule}, кадр ${number.format(checked)} из ${number.format(last)}.`);
      }
    };
    const workersDone = await Promise.allSettled(Array.from({length: taskCount},
      () => startWorker(pending, directory, shared, onMessage)));
    const results = jobs
      .filter(job => fs.existsSync(resultPath(directory, job.id)))
      .map(job => readJson(resultPath(directory, job.id)));
    const resultFile = path.join(directory, 'results.json');
    writeJson(resultFile, {manifest, plannedFrames, plannedVariants: jobs.length,
      complete: results.length === jobs.length, results});
    console.log(`Итог ${results.length}/${jobs.length}. Результаты в ${resultFile}.`);
    const failed = workersDone.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
  } finally {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
    removeIfPresent(lock);
  }
}

if (isMainThread) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
} else worker();
