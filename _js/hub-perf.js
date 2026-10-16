/* Hub perf v0.001. Optional local rendering diagnostics: index.html?perf=1. */
(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('perf') !== '1') return;
  const draws = {}, frames = [], tasks = []; let last = 0;
  window.hubPerfMeasure = (name, run) => {
    const start = performance.now();
    try { return run(); } finally { const elapsed=performance.now()-start;(draws[name] ||= []).push(elapsed);if(elapsed>2)document.getElementById('hubPerf')?.setAttribute('data-last-'+name.toLowerCase(),elapsed.toFixed(2)); }
  };
  const tick = now => { if (last) frames.push(now-last); last=now; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  try { new PerformanceObserver(list => { for(const e of list.getEntries())tasks.push(e.duration); }).observe({type:'longtask',buffered:false}); } catch (_) {}
  const stats = values => { const sorted=values.slice().sort((a,b)=>a-b),sum=values.reduce((a,b)=>a+b,0);return {count:values.length,mean:+(sum/Math.max(1,values.length)).toFixed(2),p95:+(sorted[Math.floor(sorted.length*.95)]||0).toFixed(2),max:+(sorted.at(-1)||0).toFixed(2)}; };
  document.addEventListener('DOMContentLoaded',()=>{
    const output=document.createElement('output');output.id='hubPerf';output.hidden=true;document.body.append(output);
    setInterval(()=>{output.textContent=JSON.stringify({frames:stats(frames),slowFrames:frames.filter(v=>v>50).length,longTasks:stats(tasks),draws:Object.fromEntries(Object.entries(draws).map(([k,v])=>[k,stats(v)]))});frames.length=0;tasks.length=0;for(const v of Object.values(draws))v.length=0;},5000);
  },{once:true});
})();
