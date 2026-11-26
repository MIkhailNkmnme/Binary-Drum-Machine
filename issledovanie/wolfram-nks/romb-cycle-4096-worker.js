'use strict';

importScripts('../../mayatnik/mayatnik-rhomb-packed.js', 'romb-cycle-4096-render.js');

const model = createPackedRhomb(4096, {reverseAtContact: true});
const renderer = createRhombCycleRenderer();
const first = model.start;
const period = model.routePeriod * model.height / 2;
const last = first + period;
const bufferSize = renderer.width * renderer.height * 4;

while (model.frame < first) {
  model.advance();
  if (model.frame % 512 === 0) postMessage({type: 'preparing', frame: model.frame, first});
}
const reference = model.snapshot();

function display(buffer) {
  const pixels = new Uint8ClampedArray(buffer ?? new ArrayBuffer(bufferSize));
  renderer.render(model, pixels);
  postMessage({
    type: 'frame', buffer: pixels.buffer, frame: model.frame, first, last,
    width: renderer.width, height: renderer.height
  }, [pixels.buffer]);
}

function moveTo(target) {
  while (model.frame < target) model.advance();
  while (model.frame > target) model.retreat();
}

self.onmessage = ({data: {action, step, buffer}}) => {
  if (action === 'first') {
    model.skipToReturn(reference, 0);
  } else if (action === 'last') {
    model.skipToReturn(reference, period);
  } else if (action === 'next') {
    if (model.frame === last) model.skipToReturn(reference, 0);
    const offset = model.frame - first;
    moveTo(first + (Math.floor(offset / step) + 1) * step);
  } else if (action === 'previous') {
    if (model.frame === first) model.skipToReturn(reference, period);
    const offset = model.frame - first;
    moveTo(first + (Math.ceil(offset / step) - 1) * step);
  }
  display(buffer);
};

display();
