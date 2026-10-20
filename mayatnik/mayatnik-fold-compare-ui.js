/* v2: frozen whole-frame comparison, independent folds, no XOR. v2: «◐ Ч/Б» — исходные биты; ось тянется мышью; ось по двум битам с любым наклоном. */
(()=>{
  'use strict';
  window.MayatnikFoldCompareUI={mount({button,capture}){
    const dialog=document.createElement('dialog');dialog.className='may-compare';dialog.setAttribute('aria-label','Сгиб маятника без XOR');
    dialog.innerHTML=`<header><strong>↦ Сгиб маятника</strong><span data-el="frame"></span><button data-act="close" aria-label="Закрыть сгиб">✕</button></header>
      <div class="mc-tools"><button data-act="start">⏮ Край</button><button data-act="prev">← ½</button><button data-act="play">▶ Пуск</button><button data-act="next">½ →</button><button data-act="center">↦ Центр</button><button data-act="fit">⊡ Вписать</button><button data-act="difference">⌖ Различие</button><button data-act="bw" aria-pressed="false" title="Показать исходные биты чёрно-белыми, без раскраски различий">◐ Ч/Б</button><button data-act="two" aria-pressed="false" title="Ось по двум битам: щёлкни два бита на поле — ось пройдёт через их центры, наклон любой">⟋ По 2 битам</button><button data-act="vert" hidden title="Вернуть отвесную ось">│ Отвесно</button><button data-act="flip" hidden title="Сгибать другую сторону оси">⇄ Сторона</button><label><input type="checkbox" data-el="stop" checked> Стоп при различии битов</label><label>Шагов/с <input type="number" data-el="speed" min="1" max="20" value="4"></label></div>
      <div class="mc-axis"><label data-el="axisBox">Ось от левого края, клеток <input data-el="axis" type="number" min="0" step="0.5" value="0"></label><input aria-label="Положение оси сгиба" data-el="slider" type="range" min="0" step="1" value="0"><output data-el="progress"></output></div>
      <div class="mc-stats" data-el="stats" aria-live="polite"></div><canvas aria-label="Исходный маятник и отражённая левая часть" tabindex="0"></canvas>
      <div class="mc-legend" data-el="legend"><span style="color:#52ce9c">■ совпали</span><span style="color:#ff626e">■ 0 / 1 различаются</span><span style="color:#f5bf55">■ бит попал в пустоту</span><span style="color:#bd8cff">■ пустота попала на бит</span><span style="color:#ffe77c">│ ось</span></div>
      <output data-el="hover">Наведи на клетку — покажу оба исходных адреса и бита.</output><small>Каждая позиция — сгиб исходного снимка слева направо. Слева тускло остаётся исходная часть. Клетки на оси учитываются отдельно. Ось тянется мышью прямо за линию; у оси по двум битам — ещё и за её точки (наклон). Колесо: вверх уменьшить, вниз увеличить; перетаскивание поля — сдвиг. Значения битов не меняются.</small>`;
    document.body.append(dialog);
    const $=s=>dialog.querySelector(s),el=n=>$(`[data-el="${n}"]`),act=n=>$(`[data-act="${n}"]`),canvas=$('canvas'),ctx=canvas.getContext('2d',{alpha:false});
    let model=null,step=0,stats=null,zoom=1,panX=0,panY=0,timer=0,drag=null,raf=0;
    // v2: mode 'v' — отвесная ось по полклетки; 'two' — ось через точки A и B (центр клетки = x + ½), line — её расчёт.
    let mode='v',A=null,B=null,flip=false,line=null,pick=null,bw=false;
    const colours={empty:0xff13100d,zero:0xff706253,one:0xffece4dc,ghost0:0xff2c2823,ghost1:0xff62564a,same:0xff9cce52,same0:0xff716c22,different:0xff6e62ff,overhang:0xff55bff5,missing:0xffff8cbd,
      bwEmpty:0xff4a3f36,bwZero:0xff000000,bwOne:0xffffffff};
    const HOVER='Наведи на клетку — покажу оба исходных адреса и бита.',num=n=>n.toLocaleString('ru-RU');
    function stop(){clearTimeout(timer);timer=0;act('play').textContent='▶ Пуск';}
    const pairAt=(x,y)=>mode==='two'?line.pair(x,y):model.pair(x,y,step);
    function sync(){
      const two=mode==='two';
      el('axisBox').hidden=el('slider').hidden=two;act('vert').hidden=act('flip').hidden=!two;
      act('start').disabled=act('center').disabled=two;act('two').setAttribute('aria-pressed',String(!!pick||two));act('two').textContent=pick?`⟋ Бит ${pick.length+1} из 2…`:'⟋ По 2 битам';
      act('bw').setAttribute('aria-pressed',String(bw));el('legend').hidden=bw;
      if(two){
        const deg=((Math.atan2(-(B.y-A.y),B.x-A.x)*180/Math.PI)%180+180)%180,c=p=>`стр. ${num(p.y+.5)}, столб. ${num(p.x+.5)}`;
        el('progress').textContent=`Ось через ${c(A)} и ${c(B)} · наклон ${num(Math.round(deg*10)/10)}°`;
        act('prev').disabled=stats.atStart;act('next').disabled=act('play').disabled=stats.atEnd;
      }else{
        el('axis').value=step/2;el('slider').value=step;el('progress').textContent=`${step} / ${model.max} полушагов`;
        act('prev').disabled=step===0;act('next').disabled=step===model.max;act('play').disabled=step===model.max;
      }
      act('difference').disabled=!stats.first;
      const s=stats,verdict=!s.pairs?'Нет пар битов для сравнения':s.match?'Биты и контуры в наложенной части совпали':'Есть различия в наложенной части';
      el('stats').textContent=`${verdict}. Совпало: ${num(s.same)} · различий 0/1: ${num(s.different)} · бит → пустота: ${num(s.overhang)} · пустота → бит: ${num(s.missing)} · на оси: ${num(s.fixed)}`;
      el('stats').dataset.different=s.different;el('stats').dataset.same=s.same;el('stats').dataset.fixed=s.fixed;el('stats').dataset.match=s.match;
    }
    function measure(){stats=mode==='two'?(line=model.line(A,B,flip)).analyze():model.analyze(step);sync();}
    function seek(n){step=Math.max(0,Math.min(model.max,Math.round(n)));measure();el('hover').textContent=HOVER;schedule();}
    // v2: ось по двум точкам сдвигается на ½ клетки к стороне, куда сгибаем: крутая — по столбцам, пологая — по строкам.
    function shift(dir){
      const dx=B.x-A.x,dy=B.y-A.y,g=flip?-1:1,nx=dy*g,ny=-dx*g;let ox=0,oy=0;
      if(Math.abs(dx)<=Math.abs(dy))ox=.5*Math.sign(nx)*dir;else oy=.5*Math.sign(ny)*dir;
      A={x:A.x+ox,y:A.y+oy};B={x:B.x+ox,y:B.y+oy};measure();el('hover').textContent=HOVER;schedule();
    }
    const move=d=>mode==='two'?shift(d):seek(step+d),atEnd=()=>mode==='two'?stats.atEnd:step===model.max;
    function setTwo(a,b){mode='two';A=a;B=b;pick=null;measure();schedule();el('hover').textContent=HOVER;}
    function setVert(){mode='v';pick=null;line=null;seek(step);}
    function fit(){
      const w=canvas.clientWidth,h=canvas.clientHeight;zoom=Math.max(.01,Math.min((w-32)/model.width,(h-32)/model.height));
      panX=(w-model.width*zoom)/2-model.left*zoom;panY=(h-model.height*zoom)/2-model.top*zoom;schedule();
    }
    function schedule(){if(!raf)raf=requestAnimationFrame(()=>{raf=0;draw();});}
    // Ось на экране: точка и единичное направление.
    function axisScreen(){
      if(mode==='two'){const L=Math.hypot(B.x-A.x,B.y-A.y);return {x:panX+A.x*zoom,y:panY+A.y*zoom,dx:(B.x-A.x)/L,dy:(B.y-A.y)/L};}
      return {x:panX+(model.left+step/2)*zoom,y:0,dx:0,dy:1};
    }
    function draw(){
      if(!model||!dialog.open)return;
      const w=Math.max(1,Math.round(canvas.clientWidth)),h=Math.max(1,Math.round(canvas.clientHeight));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      const img=ctx.createImageData(w,h),pixels=new Uint32Array(img.data.buffer),axis=model.left+step/2,axis2=2*model.left+step,two=mode==='two';
      for(let py=0;py<h;py++){
        const y=Math.floor((py-panY)/zoom);
        for(let px=0;px<w;px++){
          const x=Math.floor((px-panX)/zoom);let colour=bw?colours.bwEmpty:colours.empty;
          if(x>=model.left&&x<=model.right&&y>=model.top&&y<=model.bottom){
            const b=model.bit(x,y);
            if(bw){if(b>=0)colour=b?colours.bwOne:colours.bwZero;}
            else if(two){
              const s=line.side(x+.5,y+.5);
              if(b>=0)colour=s<0?(b?colours.ghost1:colours.ghost0):(b?colours.one:colours.zero);
              if(s>0){const [sx,sy]=line.mirror(x,y),a=model.bit(sx,sy);if(a>=0||b>=0)colour=a<0?colours.missing:b<0?colours.overhang:a===b?(b?colours.same:colours.same0):colours.different;}
            }else{
              const sx=axis2-x-1;
              if(b>=0)colour=x+.5<axis?(b?colours.ghost1:colours.ghost0):(b?colours.one:colours.zero);
              if(sx>=model.left&&sx<x){const a=model.bit(sx,y);if(a>=0||b>=0)colour=a<0?colours.missing:b<0?colours.overhang:a===b?(b?colours.same:colours.same0):colours.different;}
            }
          }
          pixels[py*w+px]=colour;
        }
      }
      ctx.putImageData(img,0,0);
      if(zoom>=12){
        const x0=Math.max(model.left,Math.floor(-panX/zoom)),x1=Math.min(model.right,Math.ceil((w-panX)/zoom)),y0=Math.max(model.top,Math.floor(-panY/zoom)),y1=Math.min(model.bottom,Math.ceil((h-panY)/zoom));
        ctx.font=`${Math.min(18,zoom*.55)}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';
        for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
          const b=model.bit(x,y),X=panX+x*zoom,Y=panY+y*zoom;
          if(bw){if(b<0)continue;ctx.strokeStyle='rgba(120,120,120,.5)';ctx.strokeRect(X,Y,zoom,zoom);ctx.fillStyle=b?'#000':'#fff';ctx.fillText(b,X+zoom/2,Y+zoom/2);continue;}
          const p=pairAt(x,y);if(b<0&&(!p||p.from<0))continue;
          const ghost=two?line.side(x+.5,y+.5)<0:x+.5<axis,moved=p&&(p.sx!==x||(p.sy??y)!==y)&&p.kind!=='empty';
          ctx.strokeStyle='rgba(10,20,30,.35)';ctx.strokeRect(X,Y,zoom,zoom);ctx.fillStyle=ghost?'#a3a9ae':'#10151a';
          ctx.fillText(moved?(zoom>=25?`${p.from<0?'·':p.from}|${p.to<0?'·':p.to}`:p.from<0?'·':p.from):b<0?'·':b,X+zoom/2,Y+zoom/2);
        }
      }
      const ax=axisScreen(),far=(w+h)*2;ctx.beginPath();ctx.moveTo(ax.x-ax.dx*far,ax.y-ax.dy*far);ctx.lineTo(ax.x+ax.dx*far,ax.y+ax.dy*far);
      ctx.strokeStyle='#1b1b1b';ctx.lineWidth=4;ctx.stroke();ctx.strokeStyle='#ffe77c';ctx.lineWidth=2;ctx.stroke();
      const dot=(p,c)=>{const X=panX+p.x*zoom,Y=panY+p.y*zoom;ctx.beginPath();ctx.arc(X,Y,6,0,7);ctx.fillStyle=c;ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#1b1b1b';ctx.stroke();};
      if(mode==='two'){dot(A,'#ffe77c');dot(B,'#ffe77c');}
      if(pick)for(const p of pick){dot(p,'#7cd4ff');}
    }
    act('difference').onclick=()=>{if(!stats.first)return;stop();const p=stats.first,sy=p.sy??p.y;zoom=28;panX=canvas.clientWidth/2-(p.x+.5)*zoom;panY=canvas.clientHeight/2-(p.y+.5)*zoom;
      el('hover').textContent=sy===p.y?`Первое различие: строка ${p.y+1}, столбец ${p.sx+1} (${p.from}) → столбец ${p.x+1} (${p.to}).`:`Первое различие: строка ${sy+1}, столбец ${p.sx+1} (${p.from}) → строка ${p.y+1}, столбец ${p.x+1} (${p.to}).`;schedule();};
    function tick(){
      move(1);if(atEnd()||(el('stop').checked&&stats.different>0)){stop();return;}
      timer=setTimeout(tick,1000/Math.max(1,Math.min(20,+el('speed').value||4)));
    }
    act('play').onclick=()=>{if(timer){stop();return;}act('play').textContent='⏸ Пауза';timer=setTimeout(tick,0);};
    for(const [name,get]of [['start',()=>0],['center',()=>model.max]])act(name).onclick=()=>{stop();seek(get());};
    act('prev').onclick=()=>{stop();move(-1);};act('next').onclick=()=>{stop();move(1);};
    act('bw').onclick=()=>{bw=!bw;sync();schedule();};
    act('two').onclick=()=>{stop();pick=pick?null:[];sync();schedule();el('hover').textContent=pick?'Щёлкни первый бит оси.':HOVER;};
    act('vert').onclick=()=>{stop();setVert();};
    act('flip').onclick=()=>{stop();flip=!flip;measure();schedule();};
    el('slider').oninput=()=>{stop();seek(+el('slider').value);};el('axis').onchange=()=>{stop();seek(2*(+el('axis').value||0));};act('fit').onclick=fit;
    act('close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{stop();model=null;line=null;pick=null;button.setAttribute('aria-pressed','false');});
    dialog.addEventListener('keydown',e=>{if(e.key==='Escape'&&pick){e.preventDefault();pick=null;sync();schedule();el('hover').textContent=HOVER;}e.stopPropagation();});
    const pointer=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
    const world=p=>({x:(p.x-panX)/zoom,y:(p.y-panY)/zoom});
    // Что под мышью: точка оси ('a' / 'b'), сама ось ('line') или поле (null).
    function hit(p){
      if(!model||pick)return null;
      if(mode==='two')for(const [k,q]of [['a',A],['b',B]])if(Math.hypot(panX+q.x*zoom-p.x,panY+q.y*zoom-p.y)<=9)return k;
      const ax=axisScreen();return Math.abs((p.x-ax.x)*ax.dy-(p.y-ax.y)*ax.dx)<=6?'line':null;
    }
    canvas.addEventListener('wheel',e=>{e.preventDefault();const p=pointer(e),old=zoom;zoom=Math.max(.01,Math.min(96,zoom*Math.exp(Math.max(-120,Math.min(120,e.deltaY))*.002)));panX=p.x-(p.x-panX)*zoom/old;panY=p.y-(p.y-panY)*zoom/old;schedule();},{passive:false});
    canvas.onpointerdown=e=>{
      if(e.button!==0)return;const p=pointer(e),k=hit(p);
      drag={...p,px:panX,py:panY,kind:k||'pan',w:world(p),A0:A&&{...A},B0:B&&{...B},moved:false};
      if(k)stop();canvas.setPointerCapture(e.pointerId);
    };
    canvas.onpointerup=canvas.onpointercancel=e=>{
      const d=drag;drag=null;
      if(d&&d.kind==='pan'&&!d.moved&&pick&&e.type==='pointerup'){
        const q=world(pointer(e)),c={x:Math.floor(q.x)+.5,y:Math.floor(q.y)+.5};
        if(pick.length&&pick[0].x===c.x&&pick[0].y===c.y)return;
        pick.push(c);if(pick.length===2)setTwo(pick[0],pick[1]);else{sync();schedule();el('hover').textContent='Щёлкни второй бит оси.';}
      }
    };
    canvas.onpointermove=e=>{
      const p=pointer(e);
      if(drag){
        if(Math.hypot(p.x-drag.x,p.y-drag.y)>3)drag.moved=true;
        const q=world(p);
        if(drag.kind==='line'&&mode==='v'){seek(2*(q.x-model.left));return;}
        if(drag.kind==='line'){const ox=Math.round((q.x-drag.w.x)*2)/2,oy=Math.round((q.y-drag.w.y)*2)/2,n={x:drag.A0.x+ox,y:drag.A0.y+oy};
          if(n.x!==A.x||n.y!==A.y){A=n;B={x:drag.B0.x+ox,y:drag.B0.y+oy};measure();schedule();}return;}
        if(drag.kind==='a'||drag.kind==='b'){const c={x:Math.floor(q.x)+.5,y:Math.floor(q.y)+.5},o=drag.kind==='a'?B:A,m=drag.kind==='a'?A:B;
          if((c.x!==o.x||c.y!==o.y)&&(c.x!==m.x||c.y!==m.y)){if(drag.kind==='a')A=c;else B=c;measure();schedule();}return;}
        panX=drag.px+p.x-drag.x;panY=drag.py+p.y-drag.y;schedule();return;
      }
      const k=hit(p);canvas.style.cursor=k==='line'?(mode==='v'?'ew-resize':'move'):k?'grab':pick?'cell':'';
      const x=Math.floor((p.x-panX)/zoom),y=Math.floor((p.y-panY)/zoom),pair=pairAt(x,y),v=model.bit(x,y),b=n=>n<0?'пусто':String(n);
      if(pick)return;
      el('hover').textContent=pair?pair.kind==='fixed'?`Строка ${y+1}, столбец ${x+1}: ${b(v)} — на оси, не сравнивается с собой.`
        :(pair.sy??y)!==y?`Строка ${pair.sy+1}, столбец ${pair.sx+1} (${b(pair.from)}) → строка ${y+1}, столбец ${x+1} (${b(pair.to)}).`
        :`Строка ${y+1}: левый столбец ${pair.sx+1} (${b(pair.from)}) → правый столбец ${x+1} (${b(pair.to)}).`
        :`Строка ${y+1}, столбец ${x+1}: ${b(v)}${(mode==='two'?line.side(x+.5,y+.5)<0:x+.5<model.left+step/2)?' — исходная часть':''}.`;
    };
    canvas.onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();stop();move(e.key==='ArrowRight'?1:-1);}};
    new ResizeObserver(()=>{if(dialog.open)schedule();}).observe(canvas);
    button.onclick=()=>{
      const field=capture();if(!field)return;model=MayatnikFoldCompare.create(field);if(model.empty){model=null;return;}
      stop();mode='v';pick=null;line=null;flip=false;dialog.showModal();button.setAttribute('aria-pressed','true');el('frame').textContent=`Исходные биты · кадр ${model.frame} · ${model.width} × ${model.height}`;
      el('slider').max=model.max;el('axis').max=model.max/2;seek(0);fit();canvas.focus();
    };
  }};
})();
