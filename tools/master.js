// Мастер-рендер под музыку: кадр заполнен целиком, шаг движка привязан к долям такта.
//
//   node tools/master.js --recipe k1 --bpm 128 --beats 64 --fps 30 --font 22
//
// Шаг движка делается только на кадрах, попадающих на долю: между долями картинка
// стоит, на доле — щелчок. Поэтому сетка двигается строго в такт, без дрейфа.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i+1] : d; };
const BPM = +arg('bpm', 120), FPS = +arg('fps', 30), BEATS = +arg('beats', 16);
const FONT = +arg('font', 22), W = +arg('w', 1920), H = +arg('h', 1080);
const STEPS_PER_BEAT = +arg('stepsPerBeat', 1);
const RECIPE = arg('recipe', 'k1');
const REVERSE = process.argv.includes('--reverse');
const OUT = __dirname + '/../renders/masters';

const RECIPES = {
  k1:    { name:'CRT · кровь', scroll:true,
           set:{ sierpRule:'xorora', sierpSeed:'11011', sierpRows:220, presetSelect:'blood',
                 fontSelect:"'VT323', monospace", frameCheck:false, showRowNumbersCheck:false } },
  k2:    { name:'CRT · янтарь', scroll:true,
           set:{ sierpRule:'xorora', sierpSeed:'1101101', sierpRows:220, presetSelect:'amber',
                 fontSelect:"'VT323', monospace", frameCheck:false, showRowNumbersCheck:false } },
  ghost: { name:'Призрак', scroll:true,
           set:{ sierpRule:'shift', sierpSeed:'1011011', sierpRows:220, presetSelect:'bw',
                 fillXCheck:true, hideUnchangedCheck:true, trailCheck:true,
                 frameCheck:false, showRowNumbersCheck:false } },
  xray:  { name:'Рентген', scroll:true,
           set:{ sierpRule:'center', sierpSeed:'110110', sierpRows:220, presetSelect:'matrix',
                 fillXCheck:true, conglomerateCheck:true,
                 frameCheck:false, showRowNumbersCheck:false } },
  radar: { name:'Радар', scroll:false,
           set:{ sierpRule:'center', sierpSeed:'1101', sierpRows:200, presetSelect:'blood',
                 radarCheck:true, funnelCheck:true, radarRotateSnapInput:7,
                 frameCheck:false, showRowNumbersCheck:false } },
  gpu:   { name:'Радар-воронка на GPU', scroll:false, gl:true,
           set:{ sierpRule:'center', sierpSeed:'1101', sierpRows:200, presetSelect:'blood',
                 radarCheck:true, funnelCheck:true, radarRotateSnapInput:5,
                 frameCheck:false, showRowNumbersCheck:false } },
};

const virtualClock = () => {
  window.__vt = 0; window.__q = [];
  performance.now = () => window.__vt;
  window.requestAnimationFrame = cb => { window.__q.push(cb); return window.__q.length; };
  window.cancelAnimationFrame = () => {};
  window.__tick = ms => { window.__vt += ms; const q = window.__q; window.__q = []; q.forEach(cb => { try { cb(window.__vt); } catch(e){} }); };
};

(async () => {
  const r = RECIPES[RECIPE];
  if (!r) throw new Error('нет такого рецепта: ' + RECIPE);
  const framesPerStep = (FPS * 60 / BPM) / STEPS_PER_BEAT;
  const FRAMES = Math.round(BEATS * FPS * 60 / BPM);
  const dir = `${OUT}/${RECIPE}-frames`;
  fs.rmSync(dir, { recursive:true, force:true }); fs.mkdirSync(dir, { recursive:true });

  const browser = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport:{ width:W, height:H } });
  const page = await ctx.newPage();
  await page.route('**/pixi.js@7.4.2/dist/pixi.min.js', q =>
    q.fulfill({ status:200, contentType:'application/javascript', body: fs.readFileSync(__dirname + '/vendor/pixi-7.4.2.min.js','utf8') }));
  await page.goto('http://127.0.0.1:8080/Zerkalius-genezis.html', { waitUntil:'load' });
  await page.waitForTimeout(2500);
  await page.addStyleTag({ content:`#menuBar,.controls,.player-panel,#rightPanel,.frame-build-panel,
    .floating-toolbar-right,.floating-toolbar-left,#hotkeyIndicator,#minimizedRowNumbers,.float-circle-btn{display:none!important}
    body{overflow:hidden!important}` });
  await page.evaluate(() => { document.body.classList.add('zen-mode'); window.dispatchEvent(new Event('resize')); });
  await page.waitForTimeout(600);

  // Генерация, затем кадрирование: экран ровно на высоту кадра. Порядок важен —
  // «Сгенерировать» пересчитывает экран под себя и затирает выставленное до него.
  await page.evaluate(([set, font, rowsOnScreen, scroll]) => {
    const put = (id,v) => { const el=document.getElementById(id); if(!el) return;
      if (el.type==='checkbox'){ if(el.checked!==v) el.click(); }
      else { el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); } };
    for (const [k,v] of Object.entries(set)) put(k,v);
    document.getElementById('sierpBtn')?.click();
    put('fontSlider', font); put('lhSlider', 1); put('screenSlider', rowsOnScreen); put('speedSlider', 1000);
    if (scroll) document.getElementById('playerModeBtn')?.click();  // поле едет, а не стоит
  }, [r.set, FONT, Math.ceil(H / FONT) + 2, !!r.scroll]);

  // Движок ещё около полсекунды дотягивает сетку под пульт плеера — панели скрыты,
  // поэтому этот сдвиг только мешает. Обнуляем его последним действием перед съёмкой.
  if (r.gl) { await page.evaluate(() => { const c = document.getElementById('webglRenderCheck'); if (c && !c.checked) c.click(); }); await page.waitForTimeout(1500); }
  await page.waitForTimeout(1600);
  await page.evaluate(() => { STATE.offsetY = 0; STATE.autoOffsetY = 0; STATE.offsetX = 0; STATE.autoOffsetX = 0; render(); });
  await page.waitForTimeout(300);

  if (REVERSE) await page.evaluate(() => { STATE.isReverse = true; });   // ход назад
  await page.evaluate(virtualClock);
  await page.evaluate(() => document.getElementById('playBtn')?.click());
  let nextStep = 0;
  for (let f = 0; f < FRAMES; f++) {
    if (f >= nextStep) { await page.evaluate(() => window.__tick(16)); nextStep += framesPerStep; }
    await page.screenshot({ path: `${dir}/f${String(f).padStart(5,'0')}.png` });
  }
  await ctx.close(); await browser.close();

  const file = `${OUT}/${arg('out', `${RECIPE}-${BPM}bpm-${BEATS}beats`)}.mp4`;
  execFileSync(process.env.FFMPEG || 'ffmpeg', ['-y','-framerate',String(FPS),'-i',`${dir}/f%05d.png`,
    '-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p', file], { stdio:'ignore' });
  fs.rmSync(dir, { recursive:true, force:true });   // кадры больше не нужны: 1080p PNG съедают гигабайты
  console.log(`${r.name}: ${FRAMES} кадров, ${BPM} BPM, шаг каждые ${framesPerStep.toFixed(1)} кадра → ${file}`);
})();
