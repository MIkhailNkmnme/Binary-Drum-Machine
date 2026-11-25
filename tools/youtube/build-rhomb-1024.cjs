'use strict';

const {spawn} = require('node:child_process');
const {once} = require('node:events');
const {join} = require('node:path');
const {createPackedRhomb} = require('../mayatnik-journal/rhomb-packed.cjs');
const {colourCentralAxes} = require('../mayatnik-journal/build-rhomb-atlas.cjs');
const {scheme, framesBetween, paint, paintLabel} = require('../mayatnik-journal/build-rhomb-gifs.cjs');
const {guaranteedSizes} = require('../../issledovanie/wolfram-nks/romb-period.json');

async function buildFilm(ffmpeg = 'ffmpeg', output = join(__dirname, '../../rezultaty/romb-1024-1440p.mp4')) {
  const {rows, width, routePeriod, referenceFrame, returnInterval, returnFrame} = guaranteedSizes.find(
    size => size.rows === 1024 && size.factor === 2 && size.edge === 'wrap'
  );
  const band = 52;
  const pixels = Buffer.alloc(width * (rows + band) * 4);
  const val = new Int8Array(width * rows);
  const marks = new Uint8Array(val.length);
  const queue = new Int32Array(val.length);
  const palette = scheme(rows).rgb;
  const model = createPackedRhomb(rows);
  const field = {W: width, H: rows, val};
  const source = {field, route: () => [model.frame % 2, 0, ...model.centers]};
  const before = framesBetween(0, referenceFrame - 1, 68);
  const after = framesBetween(referenceFrame, referenceFrame + routePeriod, 126);
  const tail = framesBetween(returnFrame - 180, returnFrame, 12);
  const encoder = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo',
    '-pixel_format', 'rgba', '-video_size', `${width}x${rows + band}`, '-framerate', '10', '-i', '-',
    '-an', '-vf', 'format=rgb24,pad=2560:1440:(ow-iw)/2:(oh-ih)/2:color=0x0b1620,fps=30,format=yuv420p',
    '-c:v', 'libx264', '-threads', '3', '-preset', 'fast', '-crf', '21', '-maxrate', '16M',
    '-bufsize', '24M', '-movflags', '+faststart', output], {stdio: ['pipe', 'inherit', 'inherit']});
  const completed = once(encoder, 'close');
  completed.catch(() => {});

  async function addFrame(phase, hold = 1) {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < width; col++) val[row * width + col] = model.cell(row, col);
    }
    if (model.frame) colourCentralAxes(source, marks, queue);
    paint(val, width, rows, 1, pixels, palette, band, marks);
    paintLabel(pixels, width, band, 7, `${rows}X${width} F${model.frame} C${phase}`, palette[2]);
    for (let count = 0; count < hold; count++) {
      await new Promise((resolve, reject) => encoder.stdin.write(pixels, error => error ? reject(error) : resolve()));
    }
  }

  try {
    let reference;
    for (const frame of [...before, ...after]) {
      while (model.frame < frame) model.advance();
      if (frame === referenceFrame) reference = model.snapshot();
      await addFrame(Number(frame >= referenceFrame), frame === referenceFrame ? 8 : 1);
    }
    model.skipToReturn(reference, returnInterval);
    while (model.frame > tail[0]) model.retreat();
    for (const frame of tail) {
      while (model.frame < frame) model.advance();
      await addFrame(frame === returnFrame ? 2 : 1, frame === returnFrame ? 20 : 1);
    }
    encoder.stdin.end();
    const [code] = await completed;
    if (code !== 0) throw Error('FFmpeg завершился с кодом ' + code);
    console.log(output);
  } catch (error) {
    encoder.stdin.destroy();
    encoder.kill();
    throw error;
  }
}

buildFilm(process.argv[2], process.argv[3]).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
