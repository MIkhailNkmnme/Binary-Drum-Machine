'use strict';

const { spawn } = require('node:child_process');
const { mkdir, mkdtemp, rename, rm } = require('node:fs/promises');
const { join, resolve } = require('node:path');
const { createPackedRhomb } = require('../mayatnik-journal/rhomb-packed.cjs');
const { paintLabel, scheme } = require('../mayatnik-journal/build-rhomb-gifs.cjs');
const { sizes } = require('../../issledovanie/wolfram-nks/romb-contact.json');
const { createRhombCycleRenderer } = require('../../issledovanie/wolfram-nks/romb-cycle-4096-render.js');

const rows = 4096;
const fps = 10;
const steps = [2, 4];
const labelHeight = 24;
const { start, routePeriod } = sizes.find(size => size.rows === rows);

function openEncoder(ffmpeg, directory, step, width, height) {
  const file = `step-${step}.mp4`;
  const encoder = spawn(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo',
    '-pixel_format', 'rgba', '-video_size', `${width}x${height}`, '-framerate', String(fps),
    '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'superfast', '-threads', '2',
    '-pix_fmt', 'yuv420p', '-crf', '21', '-maxrate', '800k', '-bufsize', '2M',
    '-movflags', '+faststart', '-metadata', `title=Zerkalius: Rhomb 4096, step ${step}`,
    '-metadata', `comment=XOR reverse-at-contact; exact frames ${start} to ${start + routePeriod}; stride ${step}`,
    join(directory, file)
  ], { stdio: ['pipe', 'ignore', 'inherit'] });
  const completed = new Promise((resolve, reject) => {
    encoder.on('error', reject);
    encoder.stdin.on('error', reject);
    encoder.on('close', (code, signal) => {
      if (code === 0) resolve();
      else reject(Error(`FFmpeg · шаг ${step}: ${signal || code}`));
    });
  });
  // A failed encoder can close before the render loop reaches its final await.
  completed.catch(() => {});
  return { file, step, encoder, completed };
}

function appendFrame(encoder, pixels) {
  return new Promise((resolve, reject) => {
    encoder.stdin.write(pixels, error => error ? reject(error) : resolve());
  });
}

async function buildFilms(ffmpeg = 'ffmpeg', output = join(__dirname, '../../../outputs/romb-cycle-4096')) {
  const outputDirectory = resolve(output);
  await mkdir(outputDirectory, { recursive: true });
  const temporary = await mkdtemp(join(outputDirectory, '.encode-'));
  const encoders = [];
  try {
    const model = createPackedRhomb(rows, { reverseAtContact: true });
    const renderer = createRhombCycleRenderer();
    const { width, height } = renderer;
    const pixels = Buffer.alloc(width * (height + labelHeight) * 4);
    const image = new Uint8ClampedArray(pixels.buffer, pixels.byteOffset + width * labelHeight * 4,
      width * height * 4);
    const labelColor = scheme(rows).rgb[2];

    for (const step of steps) encoders.push(openEncoder(ffmpeg, temporary, step, width, height + labelHeight));
    for (let frame = start; frame <= start + routePeriod; frame += steps[0]) {
      while (model.frame < frame) model.advance();
      renderer.render(model, image);
      paintLabel(pixels, width, labelHeight, 4, `${rows}X${model.width} F${frame}`, labelColor);
      await Promise.all(encoders.filter(({ step }) => (frame - start) % step === 0)
        .map(({ encoder }) => appendFrame(encoder, pixels)));
      if ((frame - start) % 1024 === 0) console.log(`${frame} / ${start + routePeriod}`);
    }
    for (const { encoder } of encoders) encoder.stdin.end();
    await Promise.all(encoders.map(({ completed }) => completed));

    for (const { file, step } of encoders) {
      await rename(join(temporary, file), join(outputDirectory, file));
      console.log(`${join(outputDirectory, file)} · ${routePeriod / step + 1} кадров · ${fps} к/с`);
    }
  } finally {
    for (const { encoder } of encoders) {
      if (encoder.exitCode === null && encoder.signalCode === null) encoder.kill();
    }
    await Promise.allSettled(encoders.map(({ completed }) => completed));
    await rm(temporary, { recursive: true, force: true });
  }
}

buildFilms(process.argv[2], process.argv[3]).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
