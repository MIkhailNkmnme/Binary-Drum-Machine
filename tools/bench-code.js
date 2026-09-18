// Замер скорости отрисовки радара в Zerkalius-code.html: сколько миллисекунд
// уходит на кадр и сколько символов рисуется. Запускать при выключенном рендере,
// иначе фоновая нагрузка исказит цифры.
//
// Важно: canvas в Chromium растрирует отложенно — вызовы fillText лишь копятся в
// списке команд. Без принудительного сброса таймер ловит не отрисовку, а момент,
// когда очередь случайно сбросилась, и цифры скачут на два порядка. Поэтому после
// каждого кадра дёргаем getImageData: он ждёт, пока конвейер опустеет.
const { chromium } = require('playwright');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i+1] : d; };
const W = +arg('w', 1920), H = +arg('h', 1080), N = +arg('frames', 40);

(async () => {
  const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport:{ width:W, height:H } });
  await page.goto('http://127.0.0.1:8080/Zerkalius-code.html', { waitUntil:'load' });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const sel = document.getElementById('sceneSelect');
    const i = [...sel.options].findIndex(o => o.value === 'sourcecode');
    sel.selectedIndex = i; sel.dispatchEvent(new Event('change', { bubbles:true }));
  });
  await page.waitForTimeout(1800);
  await page.evaluate(() => document.getElementById('toggleRadarBtn')?.click());
  if (process.argv.includes('--neon')) await page.evaluate(() => { const n=document.getElementById('neonGlowCheck'); if(n&&!n.checked) n.click(); });
  if (process.argv.includes('--syntax')) await page.evaluate(() => document.getElementById('syntaxColorCheck')?.click());
  const FS = +arg('font', 0), SR = +arg('rows', 0);
  if (FS || SR) await page.evaluate(([f, r]) => {
    const put = (id, v) => { const el = document.getElementById(id); if (el && v) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); } };
    put('fontSizeRange', f); put('heightRange', r);
  }, [FS, SR]);
  await page.waitForTimeout(800);
  await page.waitForTimeout(1200);

  const stats = await page.evaluate(async n => {
    // считаем символы: перехватываем fillText на один кадр
    const ctx = UI.ctx;
    let chars = 0;
    const orig = ctx.fillText.bind(ctx);
    ctx.fillText = function (...a) { chars++; return orig(...a); };
    RENDERER.renderFrame();
    ctx.fillText = orig;

    const flush = () => ctx.getImageData(0, 0, 1, 1);
    const t = [];
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      RENDERER.renderFrame();
      flush();
      t.push(performance.now() - t0);
    }
    t.sort((a, b) => a - b);
    return { chars, median: t[Math.floor(n/2)], min: t[0], max: t[n-1],
             avg: t.reduce((s,x) => s+x, 0) / t.length };
  }, N);

  console.log(`символов за кадр: ${stats.chars}`);
  console.log(`время кадра: медиана ${stats.median.toFixed(1)} мс · среднее ${stats.avg.toFixed(1)} · мин ${stats.min.toFixed(1)} · макс ${stats.max.toFixed(1)}`);
  console.log(`это ${(1000/stats.median).toFixed(1)} кадр/сек при такой отрисовке`);
  await b.close();
})();
