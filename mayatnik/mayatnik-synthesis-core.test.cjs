const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'mayatnik-synthesis-core.js'), 'utf8'), sandbox);
const create = sandbox.window.MayatnikSynthesisCore.create;
const plain = value => JSON.parse(JSON.stringify(value));
const offsets = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
const rules = {
  circuit: { c: 8, b: [1,2,3,4], s: [2,3,4,5] },
  fireworks: { c: 21, b: [1,3], s: [2] },
  replicator: { c: 2, b: [1,3,5,7], s: [1,3,5,7] },
  weighted: { c: 7, b: [5], s: [5,6] }
};
function field(rule, values, options = {}) {
  const engine = create({ width: 3, height: 3, rule, ...options });
  const saved = plain(engine.snapshot());
  saved.state = values.slice();
  return engine.restore(saved);
}
function reference(values, width, height, rule, wrap, sw, pw) {
  const r = rules[rule];
  return values.map((current, index) => {
    const x = index % width, y = Math.floor(index / width);
    const sum = offsets.reduce((total, [dx,dy], p) => {
      let nx = x + dx, ny = y + dy;
      if (wrap) { nx = (nx + width) % width; ny = (ny + height) % height; }
      const neighbour = nx < 0 || ny < 0 || nx >= width || ny >= height ? 0 : values[ny * width + nx];
      return total + (rule === 'weighted' ? sw[neighbour] * pw[p] : Number(neighbour === 1));
    }, 0);
    if (current === 0) return Number(r.b.includes(sum));
    if (current === 1 && r.s.includes(sum)) return 1;
    return (current + 1) % r.c;
  });
}

for (const [rule, spec] of Object.entries(rules)) {
  test(rule + ': all 512 binary neighbourhoods, both boundaries, four generations', () => {
    for (const wrap of [false, true]) for (let mask = 0; mask < 512; mask++) {
      let values = Array.from({ length: 9 }, (_, i) => (mask >> i) & 1);
      const engine = field(rule, values, { wrap });
      const options = engine.options;
      for (let generation = 1; generation <= 4; generation++) {
        values = reference(values, 3, 3, rule, wrap, options.stateWeights, options.positionWeights);
        engine.step();
        assert.deepEqual(Array.from(engine.state), values, `${rule} wrap=${wrap} mask=${mask} generation=${generation}`);
      }
      assert.equal(engine.generation, 4);
      assert.equal(spec.c, sandbox.window.MayatnikSynthesisCore.rules[rule].states);
    }
  });
}

test('Generations: all center stages and neighbour counts; refractory neighbours never count', () => {
  for (const rule of ['circuit', 'fireworks', 'replicator']) {
    const spec = rules[rule];
    for (let stage = 0; stage < spec.c; stage++) for (let count = 0; count <= 8; count++) {
      const values = new Array(9).fill(spec.c > 2 ? 2 : 0);
      values[4] = stage;
      offsets.forEach(([x,y], i) => { if (i < count) values[(y+1)*3+x+1] = 1; });
      const expected = stage === 0 ? Number(spec.b.includes(count)) : stage === 1 && spec.s.includes(count) ? 1 : (stage + 1) % spec.c;
      assert.equal(field(rule, values).step().state[4], expected, `${rule} stage=${stage} count=${count}`);
    }
  }
});

test('WG: every position and every state can contribute; refractory stages age despite survival sum', () => {
  for (let p = 0; p < 8; p++) for (let stage = 0; stage < 7; stage++) {
    const sw = new Array(7).fill(0), pw = new Array(8).fill(0), values = new Array(9).fill(stage === 0 ? 1 : 0);
    sw[stage] = 1; pw[p] = 5;
    const [x,y] = offsets[p]; values[(y+1)*3+x+1] = stage;
    values[4] = 0;
    const engine = field('weighted', values, { stateWeights: sw, positionWeights: pw });
    assert.equal(engine.step().state[4], 1, `position=${p} state=${stage}`);
    values[4] = 2;
    assert.equal(field('weighted', values, { stateWeights: sw, positionWeights: pw }).step().state[4], 3);
  }
  const values = [2,1,0,0,0,0,0,0,0];
  assert.equal(field('weighted', values).step().state[4], 1, 'default state2*NW2 + state1*N1 = 5');
});

test('WG: non-wrap outside neighbours are state zero with its configured weight', () => {
  const engine = create({ width: 1, height: 1, rule: 'weighted', stateWeights: [1,0,0,0,0,0,0], positionWeights: [5,0,0,0,0,0,0,0] });
  assert.equal(engine.step().state[0], 1);
});

test('Wrap: opposite corner influences edge only when enabled', () => {
  const values = [1,0,0,0,0,0,0,0,0];
  assert.equal(field('replicator', values).step().state[8], 0);
  assert.equal(field('replicator', values, { wrap: true }).step().state[8], 1);
});

test('Trail: initial/neutral cells produce no fake changes; redraw does not consume age', () => {
  const engine = create({ width: 3, height: 1, trailFrames: 2 });
  engine.reset([0,1,-1]);
  engine.observe([1,0,1], { advance: true });
  assert.deepEqual(Array.from(engine.changed), [1,1,0]);
  assert.deepEqual(Array.from(engine.direction), [1,0,0]);
  assert.deepEqual(Array.from(engine.trail), [2,2,0]);
  const before = plain(engine.snapshot());
  engine.observe([0,1,0], { advance: false });
  assert.deepEqual(plain(engine.snapshot()), before);
  engine.observe([1,0,1], { advance: true });
  assert.deepEqual(Array.from(engine.trail), [1,1,0]);
  engine.observe([1,0,1], { advance: true });
  assert.deepEqual(Array.from(engine.trail), [0,0,0]);
  engine.observe([-1,-1,-1], { advance: true });
  assert.deepEqual(Array.from(engine.recovered), [-1,-1,-1]);
});

test('Recovery: holds for exactly N complete future ticks, then accepts current input', () => {
  const engine = create({ width: 1, height: 1, recoveryFrames: 2 }).reset([0]);
  engine.observe([1], { advance: true }); assert.equal(engine.recovered[0], 1);
  engine.observe([0], { advance: true }); assert.equal(engine.recovered[0], 1);
  engine.observe([0], { advance: true }); assert.equal(engine.recovered[0], 1);
  engine.observe([0], { advance: true }); assert.equal(engine.recovered[0], 0);
  const instant = create({ width: 1, height: 1, recoveryFrames: 0 }).reset([0]);
  for (const bit of [1,0,1,0]) { instant.observe([bit], { advance: true }); assert.equal(instant.recovered[0], bit); }
});

test('Injection: ready changes seed once, manual CA ticks never reuse stale changes', () => {
  const engine = create({ width: 5, height: 5, rule: 'replicator' });
  const bits = new Array(25).fill(0); engine.reset(bits); bits[12] = 1;
  engine.step({ bits, injectChanges: true });
  assert.equal(Array.from(engine.state).filter(Boolean).length, 8);
  const expected = reference(Array.from(engine.state), 5, 5, 'replicator', false);
  engine.step({ injectChanges: true });
  assert.deepEqual(Array.from(engine.state), expected);
  assert.equal(engine.changed[12], 1);
  assert.equal(engine.snapshot().pending[12], 0);
});

test('Snapshot: JSON round trip resumes every layer and pending injection identically', () => {
  const engine = create({ width: 3, height: 3, rule: 'weighted', recoveryFrames: 3 }).reset(new Array(9).fill(0));
  const bits = [0,1,0,1,1,0,0,0,0]; engine.observe(bits, { advance: true });
  const restored = create({ width: 1, height: 1 }).restore(plain(engine.snapshot()));
  assert.deepEqual(plain(restored.snapshot()), plain(engine.snapshot()));
  for (let i = 0; i < 5; i++) {
    engine.step({ injectChanges: true }); restored.step({ injectChanges: true });
    engine.observe(bits, { advance: true }); restored.observe(bits, { advance: true });
    assert.deepEqual(plain(restored.snapshot()), plain(engine.snapshot()));
  }
  const legacy = plain(engine.snapshot()); delete legacy.options.stateWeights; delete legacy.options.positionWeights;
  restored.restore(legacy);
  assert.deepEqual(plain(restored.options.stateWeights), [0,1,2,1,0,0,1]);
});

test('Validation: malformed restores reject atomically, and option arrays cannot alias state', () => {
  const engine = create({ width: 3, height: 3, rule: 'weighted' });
  const baseline = plain(engine.snapshot());
  const corruptions = [
    s => { s.width = 513; }, s => { s.height = -1; }, s => { s.state.pop(); },
    s => { s.state[0] = 7; }, s => { s.trail[0] = -1; }, s => { s.direction[0] = 2; },
    s => { s.previous[0] = 2; }, s => { s.cooldown[0] = 65536; }, s => { s.changed[0] = 2; },
    s => { s.pending[0] = NaN; }, s => { s.generation = -1; }, s => { s.options.rule = 'unknown'; },
    s => { delete s.options.wrap; }, s => { s.options.stateWeights = [0]; },
    s => { s.options.positionWeights[0] = 11; }
  ];
  for (const corrupt of corruptions) {
    const bad = structuredClone(baseline); corrupt(bad);
    assert.throws(() => engine.restore(bad));
    assert.deepEqual(plain(engine.snapshot()), baseline);
  }
  const weights = [0,1,2,1,0,0,1]; engine.configure({ stateWeights: weights }); weights[1] = 9;
  assert.equal(engine.options.stateWeights[1], 1);
  const options = engine.options; options.stateWeights[1] = 8;
  const snapshot = engine.snapshot(); snapshot.options.stateWeights[1] = 7;
  assert.equal(engine.options.stateWeights[1], 1);
  assert.throws(() => engine.configure({ positionWeights: [1,2] }));
  assert.deepEqual(plain(engine.snapshot()), baseline);
});

test('Limits and seed: bounded fields, neutral input is empty CA, configure preserves source history', () => {
  assert.throws(() => create({ width: 0, height: 1 }));
  assert.throws(() => create({ width: 513, height: 1 }));
  const engine = create({ width: 512, height: 512 });
  const bits = new Int8Array(512 * 512).fill(-1); bits[0] = 1;
  engine.reset(bits).seed(bits);
  assert.equal(engine.state[0], 1);
  assert.equal(Array.from(engine.state).filter(Boolean).length, 1);
  assert.equal(engine.generation, 0);
  engine.configure({ wrap: true, trailFrames: 64 });
  assert.equal(engine.recovered[0], 1);
  assert.equal(engine.recovered[1], -1);
  assert.equal(engine.state[0], 1);
});
