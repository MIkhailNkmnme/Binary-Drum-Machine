// Мастер-рендер для старой машины (Zerkalius-code.html): сцена «Код Матрицы»
// в топологическом радаре — исходник страницы, свёрнутый в кольца.
//
//   node tools/master-code.js --bpm 100 --beats 96 --fps 30 --out s10-code-radar
//
// Схема та же, что в master.js: виртуальные часы вместо браузерного таймера,
// шаг движка только на кадрах, попадающих на долю.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i+1] : d; };
const BPM = +arg('bpm', 100), FPS = +arg('fps', 30), BEATS = +arg('beats', 96);
const W = +arg('w', 1920), H = +arg('h', 1080);
const STEPS_PER_BEAT = +arg('stepsPerBeat', 1);
const SECONDS = arg('seconds', null);      // длительность напрямую, вместо долей
const STEPS_FILE = arg('steps', null);     // моменты ударов (tools/onsets.py) для музыки без ровной сетки
const FROM = +arg('from', 0);              // с какой секунды трека берётся кусок
const SCENE = arg('scene', 'sourcecode');
const FONT = +arg('font', 24);
const RAINBOW = process.argv.includes('--rainbow');
const SYNTAX = process.argv.includes('--syntax');
const REVERSE = process.argv.includes('--reverse');
const OUT = __dirname + '/../renders/masters';

const virtualClock = () => {
  window.__vt = 0; window.__q = [];
  performance.now = () => window.__vt;
  window.requestAnimationFrame = cb => { window.__q.push(cb); return window.__q.length; };
  window.cancelAnimationFrame = () => {};
  window.__tick = ms => { window.__vt += ms; const q = window.__q; window.__q = []; q.forEach(cb => { try { cb(window.__vt); } catch(e){} }); };
};

(async () => {
  const framesPerStep = (FPS * 60 / BPM) / STEPS_PER_BEAT;
  const FRAMES = SECONDS ? Math.round(+SECONDS * FPS) : Math.round(BEATS * FPS * 60 / BPM);
  // Шаг либо по сетке долей, либо по реальным ударам: для рваной музыки сетка
  // разъезжается уже на первом такте, а удары держат картинку на месте.
  let stepFrames = null;
  if (STEPS_FILE) {
    const j = JSON.parse(fs.readFileSync(STEPS_FILE, 'utf8'));
    stepFrames = new Set(j.times.filter(t => t >= FROM && t < FROM + FRAMES / FPS)
                                .map(t => Math.round((t - FROM) * FPS)));
  }
  const dir = `${OUT}/code-frames`;
  fs.rmSync(dir, { recursive:true, force:true }); fs.mkdirSync(dir, { recursive:true });

  const browser = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport:{ width:W, height:H } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8080/Zerkalius-code.html', { waitUntil:'load' });
  await page.waitForTimeout(3000);

  await page.evaluate(scene => {
    const sel = document.getElementById('sceneSelect');
    const i = [...sel.options].findIndex(o => o.value === scene);
    if (i >= 0) { sel.selectedIndex = i; sel.dispatchEvent(new Event('change', { bubbles:true })); }
  }, SCENE);
  await page.waitForTimeout(1800);

  // Сцены Карты Сокровищ несут собственный флаг радара: у «Hypnosis» он уже
  // включён, и слепой клик его выключал. Включаем только если выключен.
  await page.evaluate(() => { if (!MODULE_STATE.isRadarActive) document.getElementById('toggleRadarBtn')?.click(); });
  await page.waitForTimeout(1200);
  await page.evaluate(([font, rainbow, syntax]) => {
    const f = document.getElementById('fontSizeRange');
    if (f) { f.value = font; f.dispatchEvent(new Event('input', { bubbles:true })); }
    if (rainbow) { const rb = document.getElementById('rainbowTextCheck'); if (rb && !rb.checked) rb.click(); }
    if (syntax)  { const sx = document.getElementById('syntaxColorCheck'); if (sx && !sx.checked) sx.click(); }
    const s = document.getElementById('speedRange');
    if (s) { s.value = 1000; s.dispatchEvent(new Event('input', { bubbles:true })); }  // шаг на каждый тик
  }, [FONT, RAINBOW, SYNTAX]);

  // сцена сама запускает плеер через setTimeout — дожидаемся и убираем панели
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content:`#leftPanel,.controls,.float-btn,.align-btn,
    #hotkeyIndicator{display:none!important} body{overflow:hidden!important}` });
  await page.evaluate(() => { MODULE_STATE.offsetX = 0; MODULE_STATE.offsetY = 0; window.dispatchEvent(new Event('resize')); });
  await page.waitForTimeout(900);

  if (REVERSE) await page.evaluate(() => { MODULE_STATE.isReverse = true; });   // ход назад
  await page.evaluate(virtualClock);
  await page.evaluate(() => { if (!MODULE_STATE.isPlaying) document.getElementById('playBtn')?.click(); });
  let nextStep = 0;
  for (let f = 0; f < FRAMES; f++) {
    const doStep = stepFrames ? stepFrames.has(f) : (f >= nextStep);
    if (doStep) { await page.evaluate(() => window.__tick(16)); if (!stepFrames) nextStep += framesPerStep; }
    await page.screenshot({ path: `${dir}/f${String(f).padStart(5,'0')}.png` });
  }
  await ctx.close(); await browser.close();

  const file = `${OUT}/${arg('out', `code-${SCENE}-${BEATS}beats`)}.mp4`;
  execFileSync(process.env.FFMPEG || 'ffmpeg', ['-y','-framerate',String(FPS),'-i',`${dir}/f%05d.png`,
    '-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p', file], { stdio:'ignore' });
  fs.rmSync(dir, { recursive:true, force:true });
  console.log(`Код Матрицы в радаре: ${FRAMES} кадров, ${stepFrames ? `шагов по ударам: ${stepFrames.size}` : `шаг каждые ${framesPerStep.toFixed(1)} кадра`} → ${file}`);
})();
