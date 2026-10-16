const test = require('node:test'), assert = require('node:assert/strict');
const { createRunner, createClient } = require('./matryoshki-runtime.js');
const { Engine } = require('./matryoshki-core.js');
function expected(rows, frame) { const e = new Engine(rows); e.advance(frame); return e.snapshot(); }
async function result(options, afterPost = () => {}) {
  let client;
  try {
    return await new Promise((resolve, reject) => {
      client = createClient({ ...options, onmessage({ data }) { if (data.error) reject(Error(data.error)); if (data.snapshot) resolve(data.snapshot); } });
      client.postMessage({ id: 1, rows: 32, frame: 65 }); afterPost();
    });
  } finally { client?.terminate(); }
}
test('file opening builds the same bits without attempting a Worker', { timeout: 2000 }, async () => {
  let called = false;
  const actual = await result({ protocol: 'file:', makeWorker() { called = true; throw Error('blocked'); } });
  assert.equal(called, false); assert.deepEqual(actual, expected(32, 65));
});
test('synchronous Worker rejection falls back without losing the request', { timeout: 2000 }, async () => {
  assert.deepEqual(await result({ protocol: 'https:', makeWorker() { throw Error('SecurityError'); } }), expected(32, 65));
});
test('asynchronous Worker failure replays the latest pending request locally', { timeout: 2000 }, async () => {
  let terminated = false, prevented = false;
  const fake = { postMessage() {}, terminate() { terminated = true; } };
  const actual = await result({ protocol: 'https:', makeWorker: () => fake }, () => fake.onerror({ preventDefault() { prevented = true; } }));
  assert.equal(terminated, true); assert.equal(prevented, true); assert.deepEqual(actual, expected(32, 65));
});
test('local chunks yield, replace stale requests, rewind and preserve depth extension', () => {
  const queue = [], messages = []; let time = 0;
  const runner = createRunner({ schedule: fn => queue.push(fn), now: () => time += 20 });
  runner.onmessage = ({ data }) => messages.push(data);
  runner.postMessage({ id: 1, rows: 32, frame: 128 });
  assert.equal(messages.length, 0); queue.shift()(); assert.ok(messages[0].progress < 128);
  runner.postMessage({ id: 2, rows: 32, frame: 17 });
  while (queue.length) queue.shift()();
  assert.deepEqual(messages.at(-1).snapshot, expected(32, 17));
  assert.equal(messages.filter(m => m.id === 1 && m.snapshot).length, 0);
  runner.postMessage({ id: 3, rows: 64, frame: 17 }); while (queue.length) queue.shift()();
  assert.deepEqual(messages.at(-1).snapshot, expected(64, 17));
  runner.postMessage({ id: 4, rows: 64, frame: 1 }); while (queue.length) queue.shift()();
  assert.deepEqual(messages.at(-1).snapshot, expected(64, 1));
  const count = messages.length; runner.postMessage({ id: 5, rows: 64, frame: 32 }); runner.terminate();
  while (queue.length) queue.shift()(); assert.equal(messages.length, count);
});
