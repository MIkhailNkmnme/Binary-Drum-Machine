'use strict';

const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const { crc32, deflateSync } = require('node:zlib');
const core = require('../../mayatnik/mayatnik-core.js');
const edgeFlow = require('../../mayatnik/mayatnik-edge-flow.js');

const rows = 64;
const width = 2 * rows - 1;
const routePeriod = 2 * width;
const photographed = 2096;
const referenceFrame = width;
const bound = rows * routePeriod;
const framesToCompare = [photographed - routePeriod, photographed, photographed + bound / 2];
const emptyByte = 255;

// Run the calculation from v0.003 (ab9d031a), without its DOM or transport.
const app = readFileSync(join(__dirname, '../../mayatnik/mayatnik-rhomb-pendulum.js'), 'utf8');
function appSection(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from);
  if (from < 0 || to <= from) throw new Error('Use the romb v0.003 source at ab9d031a for this experiment.');
  return app.slice(from, to);
}

const createModel = runInNewContext(
  '(function (rows, width) {\n' +
  '  const field = MAYATNIK.field(width, rows, "empty");\n' +
  '  const depth = rows / 2;\n' +
  '  const routeChanges = new Map([[0, true]]);\n' +
  '  let column, branches, routeWrap, frame;\n' +
  appSection('  function initializeMotion()', '  function changeRoute(') +
  appSection('  function separation()', '    if (checkpointLimit &&') +
  '  }\n' +
  '  initializeMotion();\n' +
  '  return {advance, val: field.val, route: () => [frame % 2, column, ...branches.map(branch => branch.column)]};\n' +
  '})',
  {MAYATNIK: core, MayatnikEdgeFlow: edgeFlow}
);

function capture(frame) {
  const simulation = createModel(rows, width);
  for (let at = 0; at < frame; at++) simulation.advance();
  return Buffer.from(simulation.val);
}

function differentCells(first, second) {
  let count = 0;
  for (let i = 0; i < first.length; i++) count += Number(first[i] !== second[i]);
  return count;
}

function fingerprint(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function analyze() {
  const simulation = createModel(rows, width);
  const current = Buffer.from(simulation.val.buffer, simulation.val.byteOffset, simulation.val.byteLength);
  const reference = capture(referenceFrame);
  const observed = capture(photographed);
  const rounds = [1, 2, 4, 8, 16, 32, 64];
  const atRound = new Map(rounds.map(round => [referenceFrame + round * routePeriod, round]));
  const earlierByDigest = new Map();
  const photographedMatches = [];
  const roundComparisons = [];
  const illustrations = new Map();
  let firstFullFrame, firstFieldRepeat, firstRouteRepeat, photographedRoute;

  for (let frame = 0; frame <= photographed + bound; frame++) {
    if (firstFullFrame === undefined && !current.includes(emptyByte)) firstFullFrame = frame;
    if (current.equals(observed)) photographedMatches.push(frame);
    if (atRound.has(frame)) {
      roundComparisons.push({rounds: atRound.get(frame), frame, differentFromReference: differentCells(current, reference)});
    }
    if (framesToCompare.includes(frame)) illustrations.set(frame, Buffer.from(current));
    if (frame === photographed) photographedRoute = simulation.route();
    if (!firstFieldRepeat || !firstRouteRepeat) {
      const digest = fingerprint(current);
      const earlier = earlierByDigest.get(digest) ?? [];
      for (const previous of earlier) {
        if (!current.equals(capture(previous))) continue;
        firstFieldRepeat ??= [previous, frame];
        if (previous >= 1 && (frame - previous) % routePeriod === 0) firstRouteRepeat ??= [previous, frame];
      }
      earlier.push(frame);
      earlierByDigest.set(digest, earlier);
    }
    simulation.advance();
  }

  const phases = framesToCompare.map(frame => ({
    frame, differsFrom2096: differentCells(illustrations.get(frame), observed),
    sha256: fingerprint(illustrations.get(frame))
  }));
  const report = {
    version: '0.003',
    revision: 'ab9d031a',
    settings: {rows, width, edge: 'wrap', initialField: 'empty', changesOfEdgeMode: 0},
    cells: rows * width,
    routePeriod,
    firstFullFrame,
    firstFieldRepeat,
    firstRouteRepeat,
    period: firstRouteRepeat[1] - firstRouteRepeat[0],
    upperBound: bound,
    checkedThrough: photographed + bound,
    roundComparisons,
    photographed: {
      frame: photographed,
      column: photographedRoute[1] + 1,
      branchColumns: photographedRoute.slice(2).map(column => column + 1),
      zeros: observed.reduce((sum, bit) => sum + Number(bit === 0), 0),
      ones: observed.reduce((sum, bit) => sum + Number(bit === 1), 0),
      matches: photographedMatches
    },
    phases
  };
  return {report, illustrations};
}

function pngChunk(type, contents) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), contents]);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(contents.length);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

function comparisonPng(illustrations) {
  const gap = 4;
  const imageWidth = (width + gap) * framesToCompare.length - gap;
  const stride = 1 + imageWidth;
  const pixels = Buffer.alloc(stride * rows);
  for (const [panel, frame] of framesToCompare.entries()) {
    const bits = illustrations.get(frame);
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < width; column++) {
        pixels[row * stride + 1 + panel * (width + gap) + column] = bits[row * width + column] + 1;
      }
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(imageWidth, 0);
  header.writeUInt32BE(rows, 4);
  header[8] = 8;
  header[9] = 3;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('PLTE', Buffer.from('0b111821627ee1f2ec', 'hex')),
    pngChunk('IDAT', deflateSync(pixels, {level: 9})),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function writeStudy(directory) {
  const {report, illustrations} = analyze();
  writeFileSync(join(directory, 'romb-period.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(join(directory, 'romb-period.png'), comparisonPng(illustrations));
  return report;
}

if (require.main === module) {
  if (typeof crc32 !== 'function') throw new Error('Use Node.js 22 or newer for PNG output.');
  const directory = process.argv[2] ?? join(__dirname, '../../issledovanie/wolfram-nks');
  console.log(JSON.stringify(writeStudy(directory), null, 2));
}

module.exports = {writeStudy};
