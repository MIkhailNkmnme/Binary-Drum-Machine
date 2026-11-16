#!/usr/bin/env node
'use strict';

// Reproducibly render the research examples declared by
// mayatnik/mayatnik-synthesis-examples.js. Each render uses the same fractal
// models as the application and original music synthesized from the displayed
// model's evolving state. Reproduction requires Node.js, the sharp package,
// and ffmpeg/ffprobe available on PATH. Pass example IDs to render only those
// videos, e.g. `node render-examples.cjs chaos-triangle chaos-square`.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const vm = require('node:vm');
const sharp = require('sharp');

const HERE = __dirname;
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(HERE, 'examples');
const WIDTH = 1280, HEIGHT = 720, FPS = 30, DURATION = 12;
const GROW_SECONDS = 8.6;
const COLOURS = ['#67e8f9', '#fbbf24', '#c4b5fd', '#86efac', '#fb7185'];

function loadFractals() {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'mayatnik/mayatnik-synthesis-fractals.js'), 'utf8'), { window });
  return window.MayatnikSynthesisFractals;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]);
}

function buildModel(api, prefs) {
  switch (prefs.fractalKind) {
    case 'arrowhead': return api.arrowhead(prefs.fractalDepth);
    case 'rule90': return api.rule90(prefs.fractalDepth);
    case 'chaos': return api.chaos({
      vertices: prefs.chaosVertices, jump: prefs.chaosJump,
      noRepeat: !!prefs.chaosNoRepeat, seed: prefs.chaosSeed,
      batch: prefs.chaosBatch
    });
    case 'cellular': {
      const seed = Array.isArray(prefs.cellularSeed) ? prefs.cellularSeed.map(Number) :
        prefs.cellularSeed === 'captured' ? Array.from(String(prefs.cellularBits || ''), Number) :
          prefs.cellularSeed === 'pair' ? [1, 0, 1] : [1];
      return api.cellular({ depth: prefs.fractalDepth, seed, rule: prefs.cellularRule });
    }
    default: throw new Error(`Unknown fractalKind: ${prefs.fractalKind}`);
  }
}

function revealCount(model, time) {
  const phase = Math.max(0, Math.min(1, time / GROW_SECONDS));
  const eased = phase * phase * (3 - 2 * phase);
  return Math.min(model.length, Math.max(0, Math.floor(model.length * eased)));
}

function renderArt(model, steps, colour) {
  const x0 = 72, y0 = 126, side = 540, cx = x0 + side / 2, cy = y0 + side / 2;
  const out = [];
  if (model.kind === 'chaos') {
    const radius = side * .405;
    out.push(`<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#263747" stroke-width="1.5"/>`);
    const limit = Math.max(0, Math.min(model.points.length, steps * model.batch));
    const points = model.points.slice(0, limit);
    // A single SVG path is substantially smaller than thousands of point nodes.
    out.push(`<path d="${points.map(p => `M${(cx + radius * p.x).toFixed(2)} ${(cy + radius * p.y).toFixed(2)}h0.01`).join('')}" fill="none" stroke="${colour}" stroke-width="2.1" stroke-linecap="round" opacity=".78"/>`);
    const active = points.length ? points[points.length - 1].index : 0;
    model.corners.forEach((p, i) => {
      const px = cx + radius * p.x, py = cy + radius * p.y;
      out.push(`<circle cx="${px}" cy="${py}" r="${i === active ? 6 : 3.8}" fill="${i === active ? '#fff' : '#668295'}"/>`);
      if (model.corners.length <= 12) {
        const label = ['C','G','D','A','E','B','F♯','D♭','A♭','E♭','B♭','F'][Math.round(i * 12 / model.corners.length) % 12];
        const lx = cx + (radius + 24) * p.x, ly = cy + (radius + 24) * p.y + 5;
        out.push(`<text x="${lx}" y="${ly}" text-anchor="middle" class="note-label">${esc(label)}</text>`);
      }
    });
    if (points.length) {
      const p = points[points.length - 1];
      out.push(`<circle cx="${cx + radius * p.x}" cy="${cy + radius * p.y}" r="4.5" fill="#fff"/>`);
    }
  } else if (model.rows) {
    const visible = Math.min(model.length, steps);
    const unit = Math.min((side - 24) / model.width, (side - 24) / model.length);
    const gridW = model.width * unit, gridH = model.length * unit;
    const left = cx - gridW / 2, top = cy - gridH / 2;
    const cell = Math.max(1.2, unit * .76);
    for (let y = 0; y < visible; y++) {
      const row = model.rows[y];
      for (let x = 0; x < row.length; x++) {
        const value = row[x]; if (!value) continue;
        const fill = value === 1 ? colour : value === 2 ? '#5ce1e6' : '#cc92ef';
        out.push(`<rect x="${(left + x * unit).toFixed(2)}" y="${(top + y * unit).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" rx="${Math.min(2, cell * .18)}" fill="${fill}"/>`);
      }
    }
  } else {
    const visible = Math.min(model.length, steps);
    const scale = Math.min((side - 48) / model.spanX, (side - 48) / model.spanY);
    const x = i => cx - model.spanX * scale / 2 + (model.points[i][0] - model.minX) * scale;
    const y = i => cy - model.spanY * scale / 2 + (model.points[i][1] - model.minY) * scale;
    if (visible > 0) {
      let d = `M${x(0).toFixed(2)} ${y(0).toFixed(2)}`;
      for (let i = 1; i <= visible; i++) d += `L${x(i).toFixed(2)} ${y(i).toFixed(2)}`;
      out.push(`<path d="${d}" fill="none" stroke="${colour}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`);
      out.push(`<circle cx="${x(visible)}" cy="${y(visible)}" r="5" fill="#fff"/>`);
    }
  }
  return out.join('');
}

function frameSvg(record, model, second, colour, api) {
  const steps = revealCount(model, second);
  const progress = Math.max(0, Math.min(1, steps / Math.max(1, model.length)));
  const rule = record.settings || (record.prefs.fractalKind === 'cellular' ? `Правило ${record.prefs.cellularRule}` :
    record.prefs.fractalKind === 'chaos' ? `${record.prefs.chaosVertices} вершин · r=${record.prefs.chaosJump}` :
    record.prefs.fractalKind === 'rule90' ? 'Правило 90' : 'Стрелка Серпинского');
  const caption = record.label || record.id;
  const metric = model.kind === 'chaos' ? `${Math.min(model.points.length, steps * model.batch).toLocaleString('ru-RU')} точек` : `${steps.toLocaleString('ru-RU')} из ${model.length.toLocaleString('ru-RU')} шагов`;
  const chaosNote = model.kind === 'chaos' && steps > 0 ? api.chaosNote(model, Math.min(model.length, steps))?.label : null;
  const graphic = renderArt(model, steps, colour);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#0b1320"/><stop offset="1" stop-color="#080a10"/></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <path d="M0 92H1280" stroke="#1d2a39"/>
    <text x="72" y="56" class="title">${esc(caption)}</text><text x="1208" y="52" text-anchor="end" class="brand">МАЯТНИК · СИНТЕЗ</text>
    <text x="72" y="101" class="sub">${esc(rule)}</text><text x="1208" y="101" text-anchor="end" class="sub">Воспроизводимый опыт · музыка по рисунку</text>
    <rect x="60" y="114" width="564" height="564" rx="26" fill="#0a0e14" stroke="#263747" stroke-width="2"/>
    ${graphic}
    <rect x="666" y="126" width="542" height="310" rx="24" fill="#0c131d" stroke="#263747"/>
    <text x="704" y="176" class="eyebrow">ОПЫТ</text><text x="704" y="226" class="metric">${esc(metric)}</text>
    <text x="704" y="280" class="body">${esc(rule)}</text><text x="704" y="318" class="body">${record.prefs.fractalKind === 'chaos' ? `Начальное число ${esc(record.prefs.chaosSeed)} · серия ${esc(record.prefs.chaosBatch)}` : 'Рисунок растёт от начального состояния'}</text>
    <text x="704" y="382" class="small">${chaosNote ? `Последняя вершина: ${esc(chaosNote)}` : 'Графика и музыка созданы по параметрам этого примера'}</text>
    <rect x="666" y="458" width="542" height="220" rx="24" fill="#0c131d" stroke="#263747"/>
    <text x="704" y="505" class="eyebrow">ПРОГРЕСС</text><rect x="704" y="535" width="466" height="8" rx="4" fill="#253444"/><rect x="704" y="535" width="${(466 * progress).toFixed(1)}" height="8" rx="4" fill="${colour}"/>
    <text x="704" y="588" class="body">${progress >= 1 ? 'Финальный рисунок' : 'Построение рисунка'}</text><text x="704" y="628" class="small">${progress >= 1 ? 'Результат остаётся на экране' : 'Каждый шаг добавляет часть структуры'}</text>
    <style>text{font-family:Arial,"Segoe UI",sans-serif;fill:#e9f1f8}.title{font-size:30px;font-weight:700}.brand{font-size:15px;letter-spacing:2px;fill:#9bb1c2}.sub{font-size:16px;fill:#9bb1c2}.eyebrow{font-size:13px;letter-spacing:2.5px;fill:#8fa7ba;font-weight:700}.metric{font-size:40px;font-weight:700}.body{font-size:19px;fill:#c6d4df}.small{font-size:14px;fill:#91a5b5}.note-label{font-size:12px;fill:#d5e3ec}</style>
  </svg>`;
}

function musicalEvents(record, model, tempo, api) {
  // The notes encode each example's own visual structure, while the rhythm
  // remains repeatable and each example keeps a recognizable pulse.
  const scale = [0, 3, 5, 7, 10];
  const events = [];
  const beats = Math.ceil(DURATION * tempo / 60);
  const rowFor = beat => Math.min(model.length - 1, Math.floor(beat / beats * model.length));
  const activeStats = index => {
    if (model.kind === 'chaos') {
      const p = model.points[Math.min(model.points.length - 1, index * model.batch)];
      const note = api.chaosNote(model, index + 1);
      return { density: p ? (p.x + 1) / 2 : .5, degree: p?.index ?? 0, midi: note?.midi, pan: note?.pan };
    }
    if (model.rows) {
      const row = model.rows[index];
      let active = 0, weighted = 0;
      for (let i = 0; i < row.length; i++) if (row[i]) { active++; weighted += row[i] * (i + 1); }
      return { density: active / Math.max(1, row.length), degree: Math.round(weighted) };
    }
    const point = model.points[Math.min(model.points.length - 1, index)];
    return { density: point ? (point[0] - model.minX) / Math.max(.001, model.spanX) : .5,
      degree: point ? Math.round((point[1] - model.minY) * 5) : 0 };
  };
  for (let beat = 0; beat < beats; beat++) {
    const { density, degree, midi: selectedMidi, pan: selectedPan } = activeStats(rowFor(beat));
    const midi = selectedMidi ?? (60 + scale[((degree % scale.length) + scale.length) % scale.length] + (density > .66 ? 12 : 0));
    const velocity = .34 + Math.min(.4, density * .4);
    events.push({ beat, duration: .72, midi, velocity, voice: 'piano', pan: selectedPan ?? Math.max(-.65, Math.min(.65, (density - .5) * 1.3)) });
    if (beat % 4 === 0) events.push({ beat, duration: .4, midi: 36 + (density > .5 ? 2 : 0), velocity: .45, voice: 'kick' });
    if (beat % 2 === 1 && density > .27) events.push({ beat, duration: .12, midi: 42, velocity: .22, voice: 'hat', pan: .25 });
  }
  return events;
}

function writePipe(stream, chunk) {
  return new Promise((resolve, reject) => {
    if (stream.destroyed) return reject(new Error('ffmpeg input closed'));
    if (stream.write(chunk)) return resolve();
    const cleanup = () => { stream.removeListener('drain', onDrain); stream.removeListener('error', onError); };
    const onDrain = () => { cleanup(); resolve(); };
    const onError = error => { cleanup(); reject(error); };
    stream.once('drain', onDrain); stream.once('error', onError);
  });
}

async function renderOne(record, api, music) {
  const model = buildModel(api, record.prefs);
  if (record.id === 'chaos-fifths-notes') {
    model.points = model.points.slice(0, 22);
    model.length = model.points.length;
  }
  const colour = record.prefs.fractalKind === 'cellular'
    && (record.prefs.cellularRule === 'sum3' || /^[1-3]{6}$/.test(String(record.prefs.cellularRule)))
    ? '#fbbf24' : COLOURS[record.index % COLOURS.length];
  const settings = record.settings || {};
  const tempo = Number(settings.tempo) || 108;
  const musicOptions = { style: 'classic', tempo, volume: .72, root: 48, scale: 'pentatonic', density: 3,
    ...(settings && typeof settings === 'object' ? settings : {}) };
  const wav = music.renderWav(musicalEvents(record, model, tempo, api), musicOptions, { durationSeconds: DURATION, sampleRate: 44100 });
  const wavPath = path.join(OUT, `.${record.id}.wav`);
  const output = path.join(OUT, `${record.id}.mp4`);
  fs.writeFileSync(wavPath, wav);
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-vcodec', 'png', '-framerate', String(FPS), '-i', 'pipe:0', '-i', wavPath,
    '-t', String(DURATION), '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-shortest', output];
  const ffmpeg = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let errorText = '';
  const pngCache = new Map();
  ffmpeg.stderr.setEncoding('utf8'); ffmpeg.stderr.on('data', chunk => { errorText += chunk; });
  try {
    const frames = DURATION * FPS;
    for (let frame = 0; frame < frames; frame++) {
      const second = frame / FPS;
      const steps = revealCount(model, second);
      let png = pngCache.get(steps);
      if (!png) {
        const svg = Buffer.from(frameSvg(record, model, second, colour, api));
        png = await sharp(svg).png({ compressionLevel: 2 }).toBuffer();
        pngCache.set(steps, png);
      }
      await writePipe(ffmpeg.stdin, png);
    }
    ffmpeg.stdin.end();
    const code = await new Promise((resolve, reject) => {
      ffmpeg.once('error', reject); ffmpeg.once('close', resolve);
    });
    if (code !== 0) throw new Error(errorText || `ffmpeg exited ${code}`);
  } catch (error) {
    ffmpeg.stdin.destroy(); ffmpeg.kill(); throw error;
  } finally {
    fs.rmSync(wavPath, { force: true });
  }
  console.log(`Rendered ${record.id}: ${output}`);
}

async function main() {
  const recordsPath = path.join(ROOT, 'mayatnik/mayatnik-synthesis-examples.js');
  if (!fs.existsSync(recordsPath)) throw new Error(`Missing example records: ${recordsPath}`);
  const records = require(recordsPath);
  if (!Array.isArray(records) || records.length !== 19) throw new Error(`Expected 19 example records, found ${records?.length}`);
  fs.mkdirSync(OUT, { recursive: true });
  const api = loadFractals();
  const music = require(path.join(ROOT, 'mayatnik/mayatnik-synthesis-music.js'));
  const requested = new Set(process.argv.slice(2));
  const selected = requested.size ? records.filter(record => requested.has(record.id)) : records;
  if (requested.size && selected.length !== requested.size) {
    const unknown = [...requested].filter(id => !records.some(record => record.id === id));
    throw new Error(`Unknown example IDs: ${unknown.join(', ')}`);
  }
  for (let i = 0; i < selected.length; i++) {
    const record = { ...selected[i], index: records.indexOf(selected[i]) };
    if (!record.id || !record.prefs) throw new Error(`Example ${i + 1} lacks id/prefs`);
    await renderOne(record, api, music);
  }
  console.log(`Rendered ${selected.length} videos at ${FPS} fps, ${DURATION}s each; final pattern holds for ${DURATION - GROW_SECONDS}s.`);
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
