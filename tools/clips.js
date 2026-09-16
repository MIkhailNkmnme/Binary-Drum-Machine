const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const all = require('./recipes');
const BASE = __dirname;
const PIXI_LOCAL = BASE + '/vendor/pixi-7.4.2.min.js';
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const OUT = BASE + '/../renders/clips';
const PICK = ['r04','r07','r15','r16','r03','g03'];
const FPS = 24, FRAMES = 120;            // 5 секунд
const W = 1280, H = 720;

const virtualClock = () => {             // один логический шаг = один кадр, без дрожания таймера
  window.__vt = 0; window.__q = [];
  const realNow = performance.now.bind(performance);
  window.__realNow = realNow;
  performance.now = () => window.__vt;
  window.requestAnimationFrame = cb => { window.__q.push(cb); return window.__q.length; };
  window.cancelAnimationFrame = () => {};
  window.__tick = (ms) => { window.__vt += ms; const q = window.__q; window.__q = []; q.forEach(cb => { try { cb(window.__vt); } catch (e) {} }); };
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--force-device-scale-factor=1']
  });

  for (const id of PICK) {
    const r = all.find(x => x.id === id);
    const dir = `${OUT}/${id}-frames`;
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: W, height: H } });
    const page = await ctx.newPage();
    await page.route('**/pixi.js@7.4.2/dist/pixi.min.js', q =>
      q.fulfill({ status:200, contentType:'application/javascript', body: fs.readFileSync(PIXI_LOCAL,'utf8') }));
    await page.goto('http://127.0.0.1:8080/Zerkalius-genezis.html', { waitUntil:'load' });
    await page.waitForTimeout(2500);

    await page.evaluate(set => {
      for (const [k, v] of Object.entries(set)) {
        const el = document.getElementById(k); if (!el) continue;
        if (el.type === 'checkbox') { if (el.checked !== v) el.click(); }
        else { el.value = v; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); }
      }
    }, r.set);
    await page.evaluate(ids => ids.forEach(i => document.getElementById(i)?.click()), r.click || []);
    await page.waitForTimeout(1200);
    if (r.gl) { await page.evaluate(() => { const c=document.getElementById('webglRenderCheck'); if(c&&!c.checked) c.click(); }); await page.waitForTimeout(1800); }

    // чистый кадр: панели, верхнее меню, плашки уведомлений и плавающие кнопки — прочь
    await page.addStyleTag({ content: `
      #menuBar, .controls, .player-panel, #rightPanel, .frame-build-panel,
      .floating-toolbar-right, .floating-toolbar-left, #hotkeyIndicator,
      #minimizedRowNumbers, .float-circle-btn { display: none !important; }
      body { overflow: hidden !important; }` });
    await page.evaluate(() => { document.body.classList.add('zen-mode'); window.dispatchEvent(new Event('resize')); });
    await page.waitForTimeout(900);

    await page.evaluate(virtualClock);
    await page.evaluate(() => { const s=document.getElementById('speedSlider'); if(s){ s.value=1000; s.dispatchEvent(new Event('input',{bubbles:true})); } });
    await page.evaluate(() => document.getElementById('playBtn')?.click());   // старт: loop() уходит в наш rAF

    for (let f = 0; f < FRAMES; f++) {
      await page.evaluate(() => window.__tick(16));
      await page.screenshot({ path: `${dir}/f${String(f).padStart(4,'0')}.png` });
    }
    await ctx.close();

    execFileSync(FFMPEG, ['-y','-framerate',String(FPS),'-i',`${dir}/f%04d.png`,
      '-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p',
      `${OUT}/${id}-${r.name.replace(/[^\wА-Яа-яЁё]+/g,'_')}.mp4`], { stdio:'ignore' });
    const mp4 = fs.readdirSync(OUT).find(f => f.startsWith(id + '-') && f.endsWith('.mp4'));
    console.log(id, r.name, '→', mp4, (fs.statSync(`${OUT}/${mp4}`).size/1024).toFixed(0) + ' КБ');
    fs.rmSync(dir, { recursive: true, force: true });
  }
  await browser.close();
})();
