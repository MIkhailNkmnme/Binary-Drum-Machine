const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const BASE = __dirname, OUT = BASE + '/../renders/clips';
const FPS = 24, FRAMES = 120, W = 1280, H = 720;

// postClicks жмутся уже после скрытия панелей: режим плеера и подгонка кадра по высоте
const LIST = [
 { id:'h01', name:'Хоррор · Красный тотем',
   set:{ sierpRule:'xorora', sierpSeed:'11011', sierpRows:56, fontSlider:18, presetSelect:'blood',
         fontSelect:"'VT323', monospace", trailCheck:true, neonCheck:true, speedSlider:970, frameCheck:false, showRowNumbersCheck:false },
   click:['sierpBtn'], postClicks:['playerModeBtn','floatingCenterBtn'] },

 { id:'h02', name:'Хоррор · Призрак',
   set:{ sierpRule:'shift', sierpSeed:'1011011', sierpRows:90, fontSlider:14, presetSelect:'bw',
         fillXCheck:true, hideUnchangedCheck:true, trailCheck:true, speedSlider:975, frameCheck:false, showRowNumbersCheck:false },
   click:['sierpBtn'], postClicks:['playerModeBtn','floatingCenterBtn'] },

 // XorRora без модификаторов стоит на месте: в режиме симуляции кадры выходят
 // байт-в-байт одинаковые. Движение даёт переключение плеера в скроллинг.
 { id:'r03b', name:'XorRora (исправлен)',
   set:{ sierpRule:'xorora', sierpSeed:'110101', sierpRows:96, fontSlider:11, speedSlider:990, frameCheck:false, showRowNumbersCheck:false },
   click:['sierpBtn'], postClicks:['playerModeBtn','floatingCenterBtn'] },
];

const virtualClock = () => {
  window.__vt = 0; window.__q = [];
  performance.now = () => window.__vt;
  window.requestAnimationFrame = cb => { window.__q.push(cb); return window.__q.length; };
  window.cancelAnimationFrame = () => {};
  window.__tick = ms => { window.__vt += ms; const q = window.__q; window.__q = []; q.forEach(cb => { try { cb(window.__vt); } catch(e){} }); };
};

(async () => {
  const browser = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  for (const r of LIST) {
    const dir = `${OUT}/${r.id}-frames`;
    fs.rmSync(dir, { recursive:true, force:true }); fs.mkdirSync(dir, { recursive:true });
    const ctx = await browser.newContext({ viewport:{ width:W, height:H } });
    const page = await ctx.newPage();
    await page.route('**/pixi.js@7.4.2/dist/pixi.min.js', q =>
      q.fulfill({ status:200, contentType:'application/javascript', body: fs.readFileSync(BASE+'/vendor/pixi-7.4.2.min.js','utf8') }));
    await page.goto('http://127.0.0.1:8080/Zerkalius-genezis.html', { waitUntil:'load' });
    await page.waitForTimeout(2500);
    await page.evaluate(set => { for (const [k,v] of Object.entries(set)) { const el=document.getElementById(k); if(!el) continue;
      if (el.type==='checkbox'){ if(el.checked!==v) el.click(); } else { el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); } } }, r.set);
    await page.evaluate(ids => ids.forEach(i => document.getElementById(i)?.click()), r.click);
    await page.waitForTimeout(1200);
    await page.addStyleTag({ content:`#menuBar,.controls,.player-panel,#rightPanel,.frame-build-panel,
      .floating-toolbar-right,.floating-toolbar-left,#hotkeyIndicator,#minimizedRowNumbers,.float-circle-btn{display:none!important}
      body{overflow:hidden!important}` });
    await page.evaluate(() => { document.body.classList.add('zen-mode'); window.dispatchEvent(new Event('resize')); });
    await page.waitForTimeout(600);
    await page.evaluate(ids => ids.forEach(i => document.getElementById(i)?.click()), r.postClicks || []);
    await page.waitForTimeout(900);

    await page.evaluate(virtualClock);
    await page.evaluate(() => document.getElementById('playBtn')?.click());
    for (let f = 0; f < FRAMES; f++) { await page.evaluate(() => window.__tick(16)); await page.screenshot({ path:`${dir}/f${String(f).padStart(4,'0')}.png` }); }
    await ctx.close();

    const md5 = p => crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex');
    const moving = md5(`${dir}/f0000.png`) !== md5(`${dir}/f0060.png`) && md5(`${dir}/f0060.png`) !== md5(`${dir}/f0119.png`);
    const file = `${OUT}/${r.id}-${r.name.replace(/[^\wА-Яа-яЁё]+/g,'_')}.mp4`;
    execFileSync((process.env.FFMPEG || 'ffmpeg'), ['-y','-framerate',String(FPS),'-i',`${dir}/f%04d.png`,'-c:v','libx264','-preset','slow','-crf','20','-pix_fmt','yuv420p',file], { stdio:'ignore' });
    console.log(r.id, r.name, moving ? 'ДВИЖЕТСЯ' : '!!! СТАТИКА', (fs.statSync(file).size/1024).toFixed(0)+' КБ');
    fs.rmSync(dir, { recursive:true, force:true });
  }
  await browser.close();
})();
