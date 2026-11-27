'use strict';

const {readFileSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const MAYATNIK = require('../../mayatnik/mayatnik-core.js');
const MayatnikEdgeFlow = require('../../mayatnik/mayatnik-edge-flow.js');
const {patterns, scanGrid, steps} = require('./search-rhomb-sequences.cjs');

function makeModel() {
  const source = path.resolve(__dirname, '../../mayatnik/mayatnik-rhomb-pendulum.js');
  const code = readFileSync(source, 'utf8');
  const startup = '  const {zoomTo, zoomBy, fitView} = bindViewport(canvas, view, projectedBounds, fit);';
  const cut = code.indexOf(startup);
  if (cut < 0) throw Error('Точка запуска Ромбового Маятника изменилась.');
  const controls = new Map();
  const root = {
    querySelector(selector) {
      if (selector === '#romb-phase-page') return null;
      if (!controls.has(selector)) controls.set(selector, {getContext: () => ({})});
      return controls.get(selector);
    },
    hasAttribute: () => false,
  };
  // Use the page's reset and pass functions. Replace rendering and timeline
  // bookkeeping to keep absolute frame numbers, including after a repeat.
  return vm.runInNewContext(code.slice(0, cut) + `
    const noRender = () => {};
    stop = fit = fitCoin = syncTransport = syncEdgeButtons = announcePosition = redraw = configureCycle = noRender;
    advanceFrame = advancePass;
    let left, right;
    const draw = buildPass;
    buildPass = (upper, lower, ...rest) => {
      const origin = openFieldWidth ? (field.W - 1) / 2 : 0;
      left = Math.min(left, upper - origin - depth + 1, lower - origin - depth + 1);
      right = Math.max(right, upper - origin + depth - 1, lower - origin + depth - 1);
      draw(upper, lower, ...rest);
    };
    return {
      start(config) {
        size.value = String(config.n);
        width.value = String(config.width);
        heightFactor.value = String(config.height);
        horizontalMotion.value = config.x;
        verticalMotion.value = config.y;
        jointRoute.value = config.route;
        halves.x.value = config.halfX;
        halves.y.value = config.halfY;
        options.buildAnd = config.rule === 'AND';
        options.wrap = config.edge === 'wrap' && config.width !== 'unlimited';
        options.wrapY = config.edge === 'wrap';
        options.reverseAtContact = config.edge === 'contact';
        left = Infinity;
        right = -Infinity;
        // The published route searches use the original horizontal bounds.
        reset(undefined, true);
      },
      advance: advancePass,
      checkpoint() {
        return {frame, width: field.W, height: field.H, column, branches, jointPoints, spiral,
          routeWrap, routeWrapY, routeReverse, firstPaintedRow, endPaintedRow, left, right};
      },
      resume(saved, bits) {
        if (saved.width !== field.W || saved.height !== field.H || bits.length !== field.val.length) {
          throw Error('Размер опорного кадра не совпал с маршрутом.');
        }
        field.val.set(bits);
        ({frame, column, branches, jointPoints, spiral, routeWrap, routeWrapY, routeReverse,
          firstPaintedRow, endPaintedRow, left, right} = saved);
      },
      snapshot() {
        const origin = openFieldWidth ? (field.W - 1) / 2 : 0;
        const bounds = {left: Math.max(0, left + origin), right: Math.min(field.W - 1, right + origin),
          top: firstPaintedRow, bottom: endPaintedRow};
        const point = isJoint() && frame ? jointPoints[(frame - 1) % 2] : null;
        const apex = point ? [point.top + 1, point.center + 1] : null;
        return {frame, width: field.W, height: field.H, values: field.val, bounds, apex};
      }
    };
  })();`, {
    document: {getElementById: () => root, createElement: () => ({getContext: () => ({})})},
    location: {search: ''}, URLSearchParams, MAYATNIK, MayatnikEdgeFlow,
  }, {filename: source});
}

const halfStates = ['together', 'apart'];
const oneAxis = ['pendulum', 'sync', 'double', 'inward'];
const twoAxes = ['cw', 'ccw', 'cross', 'spiral-cw', 'spiral-ccw'];
const firstLength = 30;

function motions() {
  const list = [];
  for (const axis of ['x', 'y']) for (const mode of oneAxis) for (const half of halfStates) {
    list.push({x: 'off', y: 'off', halfX: 'together', halfY: 'together', route: 'cw',
      [axis]: mode, [axis === 'x' ? 'halfX' : 'halfY']: half});
  }
  for (const route of twoAxes) for (const halfX of halfStates) for (const halfY of halfStates) {
    list.push({x: 'pendulum', y: 'pendulum', halfX, halfY, route});
  }
  return list;
}

function schedule(n, group) {
  if (n <= 32) return {dense: 8 * n, last: 8 * n, step: 1};
  if (n === 64 && group === 'routes') return {dense: 8 * n, last: 8 * n, step: 1};
  if (n <= 256) return {dense: 32, last: 512, step: 8};
  if (n === 512) return {dense: 16, last: 256, step: 16};
  if (n === 1024) return {dense: 8, last: 64, step: 16};
  if (n === 2048) return {dense: 4, last: 16, step: 8};
  return {dense: 2, last: 4, step: 4};
}

function matrix() {
  const jobs = [];
  function add(motion, n, group, width, height, edge) {
    const frames = schedule(n, group);
    for (const rule of ['XOR', 'AND']) jobs.push({group, n, ...motion, width, height, edge, rule, frames});
  }
  for (const motion of motions()) {
    const horizontal = motion.x !== 'off';
    const vertical = motion.y !== 'off';
    for (const n of [8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096]) add(motion, n, 'routes', 2, 2, 'bounce');
    for (const n of [64]) {
      if (horizontal) for (const width of [4, 8, 'unlimited']) add(motion, n, 'geometry', width, 2, 'bounce');
      if (vertical) add(motion, n, 'geometry', 2, 4, 'bounce');
    }
    for (const n of [32]) {
      add(motion, n, 'edges', 2, 2, 'wrap');
      if (horizontal !== vertical && ((horizontal ? motion.x : motion.y) !== 'sync' ||
          (horizontal ? motion.halfX : motion.halfY) === 'apart')) add(motion, n, 'edges', 2, 2, 'contact');
    }
  }
  for (const route of twoAxes) for (const rule of ['XOR', 'AND']) {
    const frames = route === 'spiral-cw' ? {dense: 0, last: 24448, step: 256, extra: [24433]}
      : {dense: 0, last: 4096, step: 128};
    jobs.push({group: 'late', n: 256, x: 'pendulum', y: 'pendulum', halfX: 'together', halfY: 'together',
      route, width: 2, height: 2, edge: 'bounce', rule, frames});
  }
  return jobs.map((config, id) => ({id, ...config}));
}

function verifyWitness(snapshot, length, direction, row, column) {
  const [dx, dy] = steps[direction];
  const pattern = patterns[length - 5];
  for (let i = 0; i < length; i++) {
    const y = row - 1 + i * dy, x = column - 1 + i * dx;
    if (x < 0 || x >= snapshot.width || y < 0 || y >= snapshot.height ||
        snapshot.values[y * snapshot.width + x] !== Number(pattern[i])) {
      throw Error(`Кадр ${snapshot.frame}: неверная координата совпадения строки ${length}.`);
    }
  }
}

function search(model, config) {
  const {dense, last, step, extra = []} = config.frames;
  const matches = [];
  const explicitFrames = [];
  const scannedFrames = [];
  const remaining = new Uint8Array(patterns.length);
  model.start(config);
  const initial = model.snapshot();
  const maxWidth = config.width === 'unlimited' ? Infinity : initial.width;
  const maxLength = Math.max(Math.ceil(maxWidth / 2), Math.ceil(initial.height / 2), Math.min(maxWidth, initial.height));
  const start = firstLength - 5;
  const end = Math.min(patterns.length, maxLength - 4);
  let pending = Math.max(0, end - start);
  remaining.fill(1, start, end);
  let widthReached = 0;
  for (let frame = 1; frame <= last; frame++) {
    const requested = extra.includes(frame);
    if ((pending && (frame <= dense || frame % step === 0)) || requested) {
      const snapshot = model.snapshot();
      if (snapshot.frame !== frame) throw Error('Смещён отсчёт кадров.');
      const hits = scanGrid(snapshot.width, snapshot.height, snapshot, remaining);
      if (requested) {
        const hits = scanGrid(snapshot.width, snapshot.height, snapshot);
        explicitFrames.push({frame, width: snapshot.width, height: snapshot.height, apex: snapshot.apex, hits});
        for (const [length, directions] of hits) for (const [direction, , row, column] of directions) {
          verifyWitness(snapshot, length, direction, row, column);
        }
      }
      widthReached = Math.max(widthReached, snapshot.width);
      for (const [length, [[direction, , row, column, endRow, endColumn]]] of hits) {
        verifyWitness(snapshot, length, direction, row, column);
        matches.push({length, direction, witness: [frame, row, column, endRow, endColumn, snapshot.width]});
        pending--;
      }
      scannedFrames.push(frame);
    }
    if (!pending && !extra.some(sample => sample > frame)) break;
    if (frame < last) model.advance();
  }
  const details = explicitFrames.length ? {explicitFrames} : {};
  return {...config, scannedFrames, widthReached, matches: matches.sort((a, b) => a.length - b.length), ...details};
}

if (require.main === module) {
  const [shard = '0', shards = '1', group = 'all', skipFile] = process.argv.slice(2);
  const index = Number(shard), total = Number(shards);
  if (!Number.isInteger(index) || !Number.isInteger(total) || index < 0 || index >= total ||
      !['all', 'early', 'late'].includes(group)) {
    throw Error('Укажите номер участка с нуля, общее число участков и группу all, early или late.');
  }
  const skip = new Set(skipFile ? JSON.parse(readFileSync(skipFile, 'utf8')) : []);
  const model = makeModel();
  for (const job of matrix()) {
    const inGroup = group === 'all' || (job.group === 'late') === (group === 'late');
    if (inGroup && !skip.has(job.id) && job.id % total === index) {
      console.log(JSON.stringify(search(model, job)));
    }
  }
}

module.exports = {makeModel, matrix, search, verifyWitness};
