/* v1: frozen whole-frame comparison, independent folds, no XOR. */
(()=>{
  'use strict';
  window.MayatnikFoldCompareUI={mount({button,capture}){
    const dialog=document.createElement('dialog');dialog.className='may-compare';dialog.setAttribute('aria-label','Сгиб маятника без XOR');
    dialog.innerHTML=`<header><strong>↦ Сгиб маятника</strong><span data-el="frame"></span><button data-act="close" aria-label="Закрыть сгиб">✕</button></header>
      <div class="mc-tools"><button data-act="start">⏮ Край</button><button data-act="prev">← ½</button><button data-act="play">▶ Пуск</button><button data-act="next">½ →</button><button data-act="center">↦ Центр</button><button data-act="fit">⊡ Вписать</button><button data-act="difference">⌖ Различие</button><label><input type="checkbox" data-el="stop" checked> Стоп при различии битов</label><label>Шагов/с <input type="number" data-el="speed" min="1" max="20" value="4"></label></div>
      <div class="mc-axis"><label>Ось от левого края, клеток <input data-el="axis" type="number" min="0" step="0.5" value="0"></label><input aria-label="Положение оси сгиба" data-el="slider" type="range" min="0" step="1" value="0"><output data-el="progress"></output></div>
      <div class="mc-stats" data-el="stats" aria-live="polite"></div><canvas aria-label="Исходный маятник и отражённая левая часть" tabindex="0"></canvas>
      <div class="mc-legend"><span style="color:#52ce9c">■ совпали</span><span style="color:#ff626e">■ 0 / 1 различаются</span><span style="color:#f5bf55">■ бит попал в пустоту</span><span style="color:#bd8cff">■ пустота попала на бит</span><span style="color:#ffe77c">│ ось</span></div>
      <output data-el="hover">Наведи на клетку — покажу оба исходных адреса и бита.</output><small>Каждая позиция — сгиб исходного снимка слева направо. Слева тускло остаётся исходная часть. Клетки на оси учитываются отдельно. Колесо: вверх уменьшить, вниз увеличить; перетаскивание — сдвиг. Значения битов не меняются.</small>`;
    document.body.append(dialog);
    const $=s=>dialog.querySelector(s),el=n=>$(`[data-el="${n}"]`),act=n=>$(`[data-act="${n}"]`),canvas=$('canvas'),ctx=canvas.getContext('2d',{alpha:false});
    let model=null,step=0,stats=null,zoom=1,panX=0,panY=0,timer=0,drag=null,raf=0;
    const colours={empty:0xff13100d,zero:0xff706253,one:0xffece4dc,ghost0:0xff2c2823,ghost1:0xff62564a,same:0xff9cce52,same0:0xff716c22,different:0xff6e62ff,overhang:0xff55bff5,missing:0xffff8cbd};
    function stop(){clearTimeout(timer);timer=0;act('play').textContent='▶ Пуск';}
    function sync(){
      el('axis').value=step/2;el('slider').value=step;el('progress').textContent=`${step} / ${model.max} полушагов`;
      act('difference').disabled=!stats.first;act('prev').disabled=step===0;act('next').disabled=step===model.max;act('play').disabled=step===model.max;
      const s=stats,verdict=!s.pairs?'Нет пар битов для сравнения':s.match?'Биты и контуры в наложенной части совпали':'Есть различия в наложенной части';
      el('stats').textContent=`${verdict}. Совпало: ${s.same.toLocaleString('ru-RU')} · различий 0/1: ${s.different.toLocaleString('ru-RU')} · бит → пустота: ${s.overhang.toLocaleString('ru-RU')} · пустота → бит: ${s.missing.toLocaleString('ru-RU')} · на оси: ${s.fixed.toLocaleString('ru-RU')}`;
      el('stats').dataset.different=s.different;el('stats').dataset.same=s.same;el('stats').dataset.fixed=s.fixed;el('stats').dataset.match=s.match;
    }
    function seek(n){step=Math.max(0,Math.min(model.max,Math.round(n)));stats=model.analyze(step);el('hover').textContent='Наведи на клетку — покажу оба исходных адреса и бита.';sync();schedule();}
    function fit(){
      const w=canvas.clientWidth,h=canvas.clientHeight;zoom=Math.max(.01,Math.min((w-32)/model.width,(h-32)/model.height));
      panX=(w-model.width*zoom)/2-model.left*zoom;panY=(h-model.height*zoom)/2-model.top*zoom;schedule();
    }
    function schedule(){if(!raf)raf=requestAnimationFrame(()=>{raf=0;draw();});}
    function draw(){
      if(!model||!dialog.open)return;
      const w=Math.max(1,Math.round(canvas.clientWidth)),h=Math.max(1,Math.round(canvas.clientHeight));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      const img=ctx.createImageData(w,h),pixels=new Uint32Array(img.data.buffer),axis=model.left+step/2,axis2=2*model.left+step;
      for(let py=0;py<h;py++){
        const y=Math.floor((py-panY)/zoom);
        for(let px=0;px<w;px++){
          const x=Math.floor((px-panX)/zoom);let colour=colours.empty;
          if(x>=model.left&&x<=model.right&&y>=model.top&&y<=model.bottom){
            const b=model.bit(x,y),sx=axis2-x-1;
            if(b>=0)colour=x+.5<axis?(b?colours.ghost1:colours.ghost0):(b?colours.one:colours.zero);
            if(sx>=model.left&&sx<x){const a=model.bit(sx,y);if(a>=0||b>=0)colour=a<0?colours.missing:b<0?colours.overhang:a===b?(b?colours.same:colours.same0):colours.different;}
          }
          pixels[py*w+px]=colour;
        }
      }
      ctx.putImageData(img,0,0);
      if(zoom>=12){
        const x0=Math.max(model.left,Math.floor(-panX/zoom)),x1=Math.min(model.right,Math.ceil((w-panX)/zoom)),y0=Math.max(model.top,Math.floor(-panY/zoom)),y1=Math.min(model.bottom,Math.ceil((h-panY)/zoom));
        ctx.font=`${Math.min(18,zoom*.55)}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';
        for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
          const b=model.bit(x,y),p=model.pair(x,y,step);if(b<0&&(!p||p.from<0))continue;
          const X=panX+x*zoom,Y=panY+y*zoom;ctx.strokeStyle='rgba(10,20,30,.35)';ctx.strokeRect(X,Y,zoom,zoom);ctx.fillStyle=x+.5<axis?'#a3a9ae':'#10151a';
          ctx.fillText(p&&p.sx!==x&&p.kind!=='empty'?(zoom>=25?`${p.from<0?'·':p.from}|${p.to<0?'·':p.to}`:p.from<0?'·':p.from):b<0?'·':b,X+zoom/2,Y+zoom/2);
        }
      }
      const X=panX+axis*zoom;ctx.beginPath();ctx.moveTo(X,0);ctx.lineTo(X,h);ctx.strokeStyle='#1b1b1b';ctx.lineWidth=4;ctx.stroke();ctx.strokeStyle='#ffe77c';ctx.lineWidth=2;ctx.stroke();
    }
    act('difference').onclick=()=>{if(!stats.first)return;stop();const p=stats.first;zoom=28;panX=canvas.clientWidth/2-(p.x+.5)*zoom;panY=canvas.clientHeight/2-(p.y+.5)*zoom;el('hover').textContent=`Первое различие: строка ${p.y+1}, столбец ${p.sx+1} (${p.from}) → столбец ${p.x+1} (${p.to}).`;schedule();};
    function tick(){
      seek(step+1);if(step===model.max||(el('stop').checked&&stats.different>0)){stop();return;}
      timer=setTimeout(tick,1000/Math.max(1,Math.min(20,+el('speed').value||4)));
    }
    act('play').onclick=()=>{if(timer){stop();return;}act('play').textContent='⏸ Пауза';timer=setTimeout(tick,0);};
    for(const [name,get]of [['start',()=>0],['prev',()=>step-1],['next',()=>step+1],['center',()=>model.max]])act(name).onclick=()=>{stop();seek(get());};
    el('slider').oninput=()=>{stop();seek(+el('slider').value);};el('axis').onchange=()=>{stop();seek(2*(+el('axis').value||0));};act('fit').onclick=fit;
    act('close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{stop();model=null;button.setAttribute('aria-pressed','false');});
    dialog.addEventListener('keydown',e=>e.stopPropagation());
    const pointer=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
    canvas.addEventListener('wheel',e=>{e.preventDefault();const p=pointer(e),old=zoom;zoom=Math.max(.01,Math.min(96,zoom*Math.exp(Math.max(-120,Math.min(120,e.deltaY))*.002)));panX=p.x-(p.x-panX)*zoom/old;panY=p.y-(p.y-panY)*zoom/old;schedule();},{passive:false});
    canvas.onpointerdown=e=>{if(e.button!==0)return;drag={...pointer(e),px:panX,py:panY};canvas.setPointerCapture(e.pointerId);};
    canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
    canvas.onpointermove=e=>{
      const p=pointer(e);if(drag){panX=drag.px+p.x-drag.x;panY=drag.py+p.y-drag.y;schedule();return;}
      const x=Math.floor((p.x-panX)/zoom),y=Math.floor((p.y-panY)/zoom),pair=model.pair(x,y,step),v=model.bit(x,y),b=n=>n<0?'пусто':String(n);
      el('hover').textContent=pair?pair.kind==='fixed'?`Строка ${y+1}, столбец ${x+1}: ${b(v)} — на оси, не сравнивается с собой.`:`Строка ${y+1}: левый столбец ${pair.sx+1} (${b(pair.from)}) → правый столбец ${x+1} (${b(pair.to)}).`:`Строка ${y+1}, столбец ${x+1}: ${b(v)}${x+.5<model.left+step/2?' — исходная левая часть':''}.`;
    };
    canvas.onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();stop();seek(step+(e.key==='ArrowRight'?1:-1));}};
    new ResizeObserver(()=>{if(dialog.open)schedule();}).observe(canvas);
    button.onclick=()=>{
      const field=capture();if(!field)return;model=MayatnikFoldCompare.create(field);if(model.empty){model=null;return;}
      stop();dialog.showModal();button.setAttribute('aria-pressed','true');el('frame').textContent=`Исходные биты · кадр ${model.frame} · ${model.width} × ${model.height}`;
      el('slider').max=model.max;el('axis').max=model.max/2;seek(0);fit();canvas.focus();
    };
  }};
})();
