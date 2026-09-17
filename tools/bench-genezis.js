// Замер отрисовки Genezis: время кадра и число посимвольных вызовов.
//   node tools/bench-genezis.js [--radar] [--webgl] [--frames 30]
const { chromium } = require('playwright');
const fs = require('fs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i+1] : d; };
const N = +arg('frames', 30), RADAR = process.argv.includes('--radar'), GL = process.argv.includes('--webgl');

(async () => {
  const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport:{ width:1920, height:1080 } });
  await page.route('**/pixi.js@7.4.2/dist/pixi.min.js', q =>
    q.fulfill({ status:200, contentType:'application/javascript', body: fs.readFileSync(__dirname + '/vendor/pixi-7.4.2.min.js','utf8') }));
  await page.goto('http://127.0.0.1:8080/Zerkalius-genezis.html', { waitUntil:'load' });
  await page.waitForTimeout(2500);

  await page.evaluate(([radar, gl]) => {
    const put = (id, v) => { const el = document.getElementById(id); if (!el) return;
      if (el.type === 'checkbox') { if (el.checked !== v) el.click(); }
      else { el.value = v; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); } };
    put('sierpRule', 'center'); put('sierpSeed', '1011011'); put('sierpRows', 220);
    document.getElementById('sierpBtn')?.click();
    put('fontSlider', 22); put('screenSlider', 60);
    if (radar) put('radarCheck', true);
    if (gl) put('webglRenderCheck', true);
  }, [RADAR, GL]);
  await page.waitForTimeout(2200);

  const stats = await page.evaluate(n => {
    const ctx = document.getElementById('screenCanvas').getContext('2d');
    let chars = 0;
    const orig = ctx.fillText.bind(ctx);
    ctx.fillText = function (...a) { chars++; return orig(...a); };
    render();
    ctx.fillText = orig;
    const t = [];
    for (let i = 0; i < n; i++) { const t0 = performance.now(); render(); t.push(performance.now() - t0); }
    t.sort((a, b) => a - b);
    return { chars, median: t[Math.floor(n/2)], min: t[0], max: t[n-1] };
  }, N);

  console.log(`${RADAR ? 'радар' : 'пирамида'}${GL ? ' + WebGL' : ''}: символов ${stats.chars}, ` +
              `кадр ${stats.median.toFixed(1)} мс (мин ${stats.min.toFixed(1)}, макс ${stats.max.toFixed(1)}) ` +
              `→ ${(1000/stats.median).toFixed(0)} кадр/сек`);
  await b.close();
})();
