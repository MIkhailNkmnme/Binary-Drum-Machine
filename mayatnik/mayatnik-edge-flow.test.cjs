const test = require('node:test');
const assert = require('node:assert/strict');
const edge = require('./mayatnik-edge-flow.js');
const core = require('./mayatnik-core.js');

// Walk one column at a time so the reference does not use the modulo mapping.
function walk(raw, width, bounce) {
  let col = (width - 1) / 2;
  let dir = Math.sign(raw - col);
  const distance = Math.abs(raw - col);
  if (width === 1) return 0;
  for (let n = 0; n < distance; n++) {
    if (col + dir >= 0 && col + dir < width) col += dir;
    else if (bounce) { dir = -dir; col += dir; }
    else col = dir > 0 ? 0 : width - 1;
  }
  return col;
}

test('columns wrap or reflect at both physical ends, including repeated crossings', () => {
  for (const width of [1, 3, 15, 31, 47, 63]) {
    for (const bounce of [false, true]) {
      for (let raw = -4 * width; raw <= 5 * width; raw++) {
        assert.equal(edge.mapColumn(raw, width, bounce), walk(raw, width, bounce));
      }
    }
  }
});

test('transport totals match individual off-field vertices for every direction', () => {
  for (const width of [3, 15, 31]) {
    for (const bounce of [false, true]) {
      const period = bounce ? 2 * (width - 1) : width;
      for (const mode of ['pend', 'pendR', 'right', 'left', 'one']) {
        for (const pair of [false, true]) {
          const state = { mode, pair, edgeBounce: bounce };
          const paired = mode === 'pend' && pair;
          const alternating = !paired && ['pend', 'pendR'].includes(mode);
          const cycle = alternating ? 2 * period : period;
          const anchor = (width - 1) / 2;
          let jumps = 0, laps = 0;
          for (let at = 0; at <= 3 * cycle; at++) {
            if (at) {
              const index = at - 1;
              const offsets = paired ? [-at, at] : [core.offset(mode, index)];
              for (const offset of offsets) {
                if (anchor + offset < 0 || anchor + offset >= width) jumps++;
              }
              if (mode !== 'one' && at % cycle === 0) laps++;
            }
            assert.deepEqual(edge.counts(state, at, width), { jumps, laps });
          }
        }
      }
    }
  }
});

// Scan the whole row to identify the union of cones independently of conePairRows.
function referencePair(field, apexes) {
  const { W, H, val } = field;
  const saved = new Map();
  for (const c of new Set(apexes)) {
    saved.set(c, val[c] < 0 ? 1 : val[c]);
    val[c] = 1;
  }
  for (let r = 1; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (!apexes.some(a => Math.abs(c - a) <= r && (c - a - r) % 2 === 0)) continue;
      const q = r * W + c;
      const left = c > 0 && val[q - W - 1] === 1;
      const right = c + 1 < W && val[q - W + 1] === 1;
      val[q] = (val[q] === 1) ^ left ^ right;
    }
  }
  for (const [c, value] of saved) val[c] = value;
}

test('CPU pair matches a row-by-row union through repeated endpoint and centre collisions', () => {
  const width = 15, height = 8, anchor = 7;
  for (const bg of ['empty', '0', '1', 'chess']) {
    for (const bounce of [false, true]) {
      const actual = core.field(width, height, bg, anchor);
      const expected = core.field(width, height, bg, anchor);
      for (let n = 0; n <= 4 * width; n++) {
        const pair = [-n, n].map(offset => edge.mapColumn(anchor + offset, width, bounce));
        core.conePair(actual, pair[0], pair[1], height);
        referencePair(expected, [-n, n].map(offset => walk(anchor + offset, width, bounce)));
        assert.deepEqual(actual.val, expected.val, `field at step ${n}, bounce=${bounce}, bg=${bg}`);
      }
    }
  }
});

test('coincident pair yields exactly the same cells, changes and marks as one apex at each row', () => {
  const run = pair => {
    const f = core.field(15, 8, '0'), changes = new Int32Array(120), marks = new Uint8Array(120);
    const rows = pair ? core.conePairRows(f, 7, 7, 8, changes, 3, marks, 1)
      : core.coneRows(f, 7, 8, changes, 3, marks, 1);
    return Array.from(rows, row => ({ row, val: f.val.slice(), changes: changes.slice(), marks: marks.slice() }));
  };
  assert.deepEqual(run(true), run(false));
});
