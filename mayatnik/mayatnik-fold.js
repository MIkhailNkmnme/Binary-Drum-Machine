/* Горизонтальная XOR-свёртка: правая часть влево, левая вправо, к неподвижному центру. v1.
   v2: биты едут со своими цветами картинки (краска, «Цвета», «Очки», «Неизменные» — что было на поле при старте),
   colour / paint — Uint32 RGBA на клетку, 0 — нет. v3: золотой центральный столбец снят («как этот столб убрать?»).
   v4: «парой» — шаг сразу правой и левой частью (два хода модели за один, если они с разных сторон).
   v7: «не работает поле, ничего не выбирается, переписывать строки надо» — режим записи (data.write): свёртка не рисует свою картинку
   и не перехватывает мышь, а на каждом шаге отдаёт состояние странице (apply) — та переписывает строки поля, и все инструменты работают
   на свёрнутом поле. Слой свёртки рисует только подсветку центра. Без write (ромбы) — по-старому, картинкой поверх.
   v8: «центр» — общая кнопка страницы («сделай не только для свёртки, а вообще»), своя галка снята; в режиме записи центр рисует страница.
   v6: галка «центр» — подсветка центрального XOR-столбца золотом с рамкой (по умолчанию выкл., выбор помнится).
   v9: «СвёрткаВерт» — строки к центральной строке: та же модель на транспонированном поле (model({axis:'v'}), modelV); mount({axis:'v'}) — свой пульт.
   v10: два варианта — галка «застывшие» на пульте: только биты, которые построение уже не изменит, или все (capture({frozenOnly}));
   open(frame) — собрать заново и встать на тот же шаг: страница зовёт её на каждом шаге построения (свёртка пересчитывается).
   v5: щелчок без сдвига красит («при свёртке не даёт ничего красить») — страница красит исходный столбец клетки (tap), свёртка снимает цвета заново. */
(() => {
  'use strict';
  function modelH({width,height,center,data,colour,paint}) {
    const moves=[],left=[0],right=[0];let l=0,r=0,side=1;
    while(l<center||r<width-center-1){
      if((side===1&&r<width-center-1)||l===center){r++;moves.push(center+r);}
      else{l++;moves.push(center-l);}
      left.push(l);right.push(r);side=-side;
    }
    const parity=new Uint8Array(height),count=new Uint32Array(height);
    for(let y=0;y<height;y++){const v=data[y*width+center];if(v>=0){parity[y]=v;count[y]=1;}}
    let frame=0;
    const bounds=[0];for(let f=0;f<moves.length;){const side=i=>moves[i]>center;f+=f+1<moves.length&&side(f)!==side(f+1)?2:1;bounds.push(f);}   // v4: концы шагов «парой»
    return {width,height,center,max:moves.length,get frame(){return frame;},isMid(x){return x===center;},
      seek(value){const target=Math.max(0,Math.min(moves.length,Math.round(value)));
        while(frame!==target){const forward=frame<target,col=moves[forward?frame:frame-1];
          for(let y=0;y<height;y++){const v=data[y*width+col];if(v>=0){parity[y]^=v;count[y]+=forward?1:-1;}}
          frame+=forward?1:-1;
        }
      },
      bit(x,y){if(x===center)return count[y]?parity[y]:-1;
        const sx=x<center?x-left[frame]:x+right[frame];return sx<0||sx>=width?-1:data[y*width+sx];},
      // v2: откуда пришла клетка — её цвет на картинке при старте (центр — свой, золотой)
      colourAt(x,y){if(x===center||!colour)return 0;const sx=x<center?x-left[frame]:x+right[frame];return sx<0||sx>=width?0:colour[y*width+sx];},
      srcAt(x){if(x===center)return -1;const sx=x<center?x-left[frame]:x+right[frame];return sx<0||sx>=width?-1:sx;},   // v5: исходный столбец клетки; центр (XOR) — -1
      recolour(c,p){colour=c;paint=p;},
      paintAt(x,y){if(x===center||!paint)return 0;const sx=x<center?x-left[frame]:x+right[frame];return sx<0||sx>=width?0:paint[y*width+sx];},
      nextSide(){return frame<moves.length?(moves[frame]>center?'правая ←':'левая →'):'свёрнуто';},
      // v4: ход парой из кадра f в сторону d: два соседних хода с разных сторон — за один шаг; сторона кончилась — по одному
      // границы пар считаются один раз от начала — назад идём по тем же парам, что и вперёд
      pairStep(f,d){if(d>0){for(const b of bounds)if(b>f)return b;return moves.length;}for(let i=bounds.length-1;i>=0;i--)if(bounds[i]<f)return bounds[i];return 0;}
    };
  }
  // v9: вертикальная — строки сверху и снизу едут к центральной строке; снаружи координаты прежние (x — столбец, y — строка), srcAt(y) — исходная строка
  const flip=(a,W,H)=>{if(!a)return a;const t=new a.constructor(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++)t[x*H+y]=a[y*W+x];return t;};
  function modelV({width,height,center,data,colour,paint}) {
    const m=modelH({width:height,height:width,center,data:flip(data,width,height),colour:flip(colour,width,height),paint:flip(paint,width,height)});
    const side={'правая ←':'нижняя ↑','левая →':'верхняя ↓'};
    return {axis:'v',width,height,center,max:m.max,get frame(){return m.frame;},isMid:(x,y)=>y===center,seek:v=>m.seek(v),
      bit:(x,y)=>m.bit(y,x),colourAt:(x,y)=>m.colourAt(y,x),paintAt:(x,y)=>m.paintAt(y,x),srcAt:y=>m.srcAt(y),
      recolour:(c,p)=>m.recolour(flip(c,width,height),flip(p,width,height)),nextSide:()=>side[m.nextSide()]||m.nextSide(),pairStep:(f,d)=>m.pairStep(f,d)};
  }
  const model=o=>o.axis==='v'?modelV(o):modelH(o);
  // v11: «свёртки в отдельных построениях показать» — свёртка рисуется в своём окне рядом с полем, поле не трогается.
  // Окна ↔ и ↕ открываются вместе; заголовок — перетащить, правый нижний угол — размер, место и размер помнятся.
  // capture() даёт снимок поля; open(frame) собирает заново на том же шаге (страница зовёт на каждом шаге построения).
  function mount({button,capture,config,beforeStart,onClose,axis='h',canvas}) {
    const V=axis==='v',NAME=V?'СвёрткаВерт':'СвёрткаГориз',WORD=V?'вертикальной':'горизонтальной',KEY='mayatnik-fold-win2-'+axis;   // v13: прежние места у правого края забыты
    const win=document.createElement('section');win.className='may-fold-win';win.id=V?'mayFoldWinV':'mayFoldWin';win.hidden=true;win.setAttribute('aria-label','Окно '+WORD+' свёртки');
    win.innerHTML=`<header class="may-fold-head"><b>${V?'Свёртка ↕':'Свёртка ↔'}</b><button type="button" class="may-fold-x" title="Закрыть свёртку">×</button></header><canvas class="may-fold-view"></canvas>`;
    const panel=document.createElement('div');panel.className='may-fold-panel';
    panel.innerHTML=`<div class="may-fold-steps"><button type="button" data-fold="back" title="Предыдущий шаг">−1</button><output aria-live="off"></output><label class="may-fold-pair" title="Только застывшие биты — те, что оставшиеся вершины уже не изменят; выкл — все биты, свёртка пересчитывается на каждом шаге построения"><input type="checkbox" data-fold="frozen"> застывшие</label><label class="may-fold-pair" title="${V?'Шаг — нижняя и верхняя часть сразу':'Шаг — правая и левая часть сразу'}"><input type="checkbox" data-fold="pair"> парой</label><button type="button" data-fold="next" title="Следующий шаг">+1</button></div><input class="may-fold-frame" type="range" min="0" value="0" step="1" aria-label="Шаг ${WORD} свёртки"><div class="zz-pult"><input class="zz-pult-range" type="range" min="0" max="401" value="101" aria-label="Скорость свёртки"><button type="button" class="zz-pult-back" title="Обратный ход">◀</button><button type="button" class="zz-pult-fwd" title="Прямой ход">▶</button><button type="button" class="zz-pult-play" aria-label="Автоплей свёртки" aria-pressed="false">▶</button><output class="zz-pult-value"></output></div>`;
    win.append(panel);document.body.append(win);
    const view=win.querySelector('canvas'),ctx=view.getContext('2d'),pult=panel.querySelector('.zz-pult'),play=pult.querySelector('.zz-pult-play'),speed=pult.querySelector('input'),value=pult.querySelector('output'),timeline=panel.querySelector('.may-fold-frame'),progress=panel.querySelector('.may-fold-steps output');
    let state=null,running=false,dir=1,rateStep=101,timer=0,last=0,credit=0,suppressClick=false,off=null,offImg=null;
    const rate=()=>rateStep<=0?0:.1*10**((rateStep-1)/100);
    try{const saved=localStorage.getItem('mayatnik-fold-rate'),n=Number(saved);if(saved!==null&&n>=0&&n<=401)rateStep=n;}catch(_){}
    const pairBox=panel.querySelector('[data-fold="pair"]'),pair=()=>pairBox.checked,frozenBox=panel.querySelector('[data-fold="frozen"]');
    const midOn=()=>!!config?.()?.mid;
    const adv=(f,d,n=1)=>{if(!pair())return f+d*n;for(let i=0;i<n;i++)f=state.pairStep(f,d);return f;};
    // место окна: по умолчанию у правого края, ↔ сверху, ↕ под ним
    // v13: «свёртки лучше переместить вниз, под друг за другом» — по умолчанию окна стоят под полем шириной с поле: ↔ сразу под ним,
    // ↕ под ↔; пока окно не трогали руками, оно идёт за полем (масштаб, сдвиг). Перетащил или растянул — стоит, где поставил;
    // двойной щелчок по заголовку — снова под поле.
    let saved=null,lastSet=null;try{saved=JSON.parse(localStorage.getItem(KEY)||'null');}catch(_){}
    const setBox=(x,y,w,h)=>{x=Math.round(x);y=Math.round(y);w=Math.round(w);h=Math.round(h);lastSet={w,h};
      if(win.style.left!==x+'px')win.style.left=x+'px';if(win.style.top!==y+'px')win.style.top=y+'px';
      if(win.style.width!==w+'px')win.style.width=w+'px';if(win.style.height!==h+'px')win.style.height=h+'px';};
    function dock(){if(!state||!canvas)return;const r=canvas.getBoundingClientRect(),w=Math.max(240,Math.min(innerWidth-8,r.width));
      const tot=Math.max(180,(win.querySelector('.may-fold-head').offsetHeight||24)+(panel.offsetHeight||96)+Math.round(w*state.height/state.width)+2);
      const x=Math.max(4,Math.min(innerWidth-w-4,r.left)),y=r.bottom+8+(V?tot+8:0);setBox(x,Math.min(Math.max(0,innerHeight-60),y),w,tot);}
    const place=()=>{if(saved)setBox(Math.max(0,Math.min(innerWidth-60,saved.x)),Math.max(0,Math.min(innerHeight-40,saved.y)),Math.min(innerWidth-16,saved.w),Math.min(innerHeight-16,saved.h));else dock();};
    const keep=()=>{saved={x:win.offsetLeft,y:win.offsetTop,w:win.offsetWidth,h:win.offsetHeight};try{localStorage.setItem(KEY,JSON.stringify(saved));}catch(_){}};
    function sync(){
      button.setAttribute('aria-pressed',String(!!state));win.hidden=!state;if(!state)return;
      const two=pair()&&state.pairStep(state.frame,1)-state.frame===2;
      timeline.max=state.max;timeline.value=state.frame;progress.textContent=`${state.frame}/${state.max} · ${two?(V?'обе ↓↑':'обе →←'):state.nextSide()}`;
      panel.querySelector('[data-fold="back"]').textContent=pair()?'−2':'−1';panel.querySelector('[data-fold="next"]').textContent=pair()?'+2':'+1';
      panel.querySelector('[data-fold="back"]').disabled=state.frame===0;panel.querySelector('[data-fold="next"]').disabled=state.frame===state.max;
      play.textContent=running?'Ⅱ':'▶';play.setAttribute('aria-pressed',String(running));speed.value=rateStep;
      for(const [cls,d]of [['.zz-pult-back',-1],['.zz-pult-fwd',1]]){const b=pult.querySelector(cls);b.classList.toggle('on',dir===d);b.setAttribute('aria-pressed',String(dir===d));}
      value.textContent=ZerkPult.label(rate());value.title=`${Number(rate().toPrecision(3))} шагов/с · двойной щелчок — ×1`;
      ZerkPult.sync(pult,rateStep/401);
    }
    // картинка «пиксель = бит» на весь холст окна, без сглаживания; бит везёт свой цвет с поля, центр — золотом
    function render(){
      if(!state)return;if(!saved)dock();const W=state.width,H=state.height,mid=midOn(),mp=V?0:config?.()?.midPaint||0;   // v12: «Центр краской» — XOR-столбец ↔ цветом заливки
      if(!off||off.width!==W||off.height!==H){off=document.createElement('canvas');off.width=W;off.height=H;offImg=off.getContext('2d').createImageData(W,H);}
      const u=new Uint32Array(offImg.data.buffer);
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x,bit=state.bit(x,y);if(bit<0){u[i]=0;continue;}
        u[i]=mp&&state.isMid(x,y)?mp:mid&&state.isMid(x,y)?(bit?0xff8ae0ff:0xff0b86b8):state.colourAt(x,y)||(bit?0xfff5ede8:0xff75645b);}
      off.getContext('2d').putImageData(offImg,0,0);
      const dpr=Math.min(2,devicePixelRatio||1),cw=Math.max(1,view.clientWidth),ch=Math.max(1,view.clientHeight),pw=Math.round(cw*dpr),ph=Math.round(ch*dpr);
      if(view.width!==pw)view.width=pw;if(view.height!==ph)view.height=ph;
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cw,ch);
      let s=Math.min(cw/W,ch/H);if(s>=1)s=Math.floor(s);const dw=W*s,dh=H*s,x0=Math.round((cw-dw)/2),y0=Math.round((ch-dh)/2);
      ctx.imageSmoothingEnabled=false;ctx.drawImage(off,x0,y0,dw,dh);
      if(mid){ctx.lineWidth=1;ctx.strokeStyle='#ffd35b';if(V)ctx.strokeRect(x0,y0+state.center*s,dw,s);else ctx.strokeRect(x0+state.center*s,y0,s,dh);}
      sync();
    }
    function pause(){running=false;cancelAnimationFrame(timer);timer=0;last=0;credit=0;sync();}
    function close(){pause();if(!state)return;state=null;sync();onClose?.();}
    function seek(n){if(!state)return;state.seek(n);render();}
    function tick(now){if(!running||!state)return;if(last)credit+=Math.min(.25,(now-last)/1000)*rate();last=now;
      const n=Math.min(128,Math.floor(credit));if(n){credit-=n;seek(adv(state.frame,dir,n));}
      if((dir>0&&state.frame===state.max)||(dir<0&&state.frame===0)){pause();return;}
      timer=requestAnimationFrame(tick);}
    function togglePlay(){if(!state)return;if(running){pause();return;}if(dir>0&&state.frame===state.max)seek(0);if(dir<0&&state.frame===0)seek(state.max);running=true;last=0;credit=0;sync();timer=requestAnimationFrame(tick);}
    function setRate(n){rateStep=Math.max(0,Math.min(401,Math.round(n)));try{localStorage.setItem('mayatnik-fold-rate',String(rateStep));}catch(_){}sync();}
    try{frozenBox.checked=localStorage.getItem('mayatnik-fold-frozen')!=='0';}catch(_){frozenBox.checked=true;}
    try{pairBox.checked=localStorage.getItem('mayatnik-fold-pair')!=='0';}catch(_){pairBox.checked=true;}
    function open(frame=0){const was=!!state,data=capture({frozenOnly:frozenBox.checked});if(!data)return false;
      state=model({...data,axis});if(frame)state.seek(Math.min(frame,state.max));if(!was)place();sync();render();return true;}
    button.onclick=()=>{if(state){close();return;}beforeStart?.();open();};
    win.querySelector('.may-fold-x').onclick=close;
    frozenBox.onchange=()=>{try{localStorage.setItem('mayatnik-fold-frozen',frozenBox.checked?'1':'0');}catch(_){}if(state)open(state.frame);};
    pairBox.onchange=()=>{try{localStorage.setItem('mayatnik-fold-pair',pairBox.checked?'1':'0');}catch(_){}sync();};
    play.onclick=()=>{if(suppressClick){suppressClick=false;return;}togglePlay();};
    speed.oninput=()=>setRate(Number(speed.value));value.ondblclick=()=>setRate(101);
    for(const [cls,d]of [['.zz-pult-back',-1],['.zz-pult-fwd',1]])pult.querySelector(cls).onclick=()=>{dir=d;last=0;credit=0;sync();};
    for(const [action,d]of [['back',-1],['next',1]])panel.querySelector(`[data-fold="${action}"]`).onclick=()=>{pause();seek(adv(state.frame,d));};
    timeline.oninput=()=>{pause();seek(Number(timeline.value));};
    play.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();play.setPointerCapture(e.pointerId);suppressClick=false;const x=e.clientX,start=rateStep;
      const move=ev=>{if(ev.pointerId!==e.pointerId)return;if(Math.abs(ev.clientX-x)>3)suppressClick=true;if(suppressClick)setRate(start+(ev.clientX-x)*401/ZerkPult.trackWidth(pult));};
      const end=ev=>{if(ev.pointerId!==e.pointerId)return;play.removeEventListener('pointermove',move);play.removeEventListener('pointerup',end);play.removeEventListener('pointercancel',end);if(play.hasPointerCapture(e.pointerId))play.releasePointerCapture(e.pointerId);};
      play.addEventListener('pointermove',move);play.addEventListener('pointerup',end);play.addEventListener('pointercancel',end);});
    // перетаскивание за заголовок
    const head=win.querySelector('.may-fold-head');
    head.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button'))return;e.preventDefault();head.setPointerCapture(e.pointerId);
      const x=e.clientX-win.offsetLeft,y=e.clientY-win.offsetTop,x0=e.clientX,y0=e.clientY;let moved=false;
      const move=ev=>{if(!moved&&Math.hypot(ev.clientX-x0,ev.clientY-y0)<4)return;moved=true;win.style.left=Math.max(0,Math.min(innerWidth-60,ev.clientX-x))+'px';win.style.top=Math.max(0,Math.min(innerHeight-30,ev.clientY-y))+'px';};
      const end=()=>{head.removeEventListener('pointermove',move);head.removeEventListener('pointerup',end);if(moved)keep();};
      head.addEventListener('pointermove',move);head.addEventListener('pointerup',end);});
    // размер — за угол (CSS resize); холст перерисовывается
    head.addEventListener('dblclick',e=>{if(e.target.closest('button'))return;saved=null;try{localStorage.removeItem(KEY);}catch(_){}render();});
    // растянул за угол сам (размер не тот, что ставили) — окно остаётся там, где есть
    if(typeof ResizeObserver==='function')new ResizeObserver(()=>{if(!state)return;if(lastSet&&(Math.abs(win.offsetWidth-lastSet.w)>2||Math.abs(win.offsetHeight-lastSet.h)>2))keep();render();}).observe(win);
    addEventListener('resize',()=>{if(state)render();});addEventListener('scroll',()=>{if(state&&!saved)dock();},true);
    // клавиши — только когда мышь над окном или фокус в нём
    addEventListener('keydown',e=>{if(!state||e.target.closest?.('input,select,button,textarea'))return;if(!win.matches(':hover')&&!win.contains(document.activeElement))return;
      if(['Space','ArrowLeft','ArrowRight','Escape'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();if(e.code==='Escape')close();else if(e.code==='Space')togglePlay();else{pause();seek(adv(state.frame,e.code==='ArrowRight'?1:-1));}}},true);
    return {get active(){return !!state;},get frame(){return state?state.frame:0;},close,render,open};
  }
  window.MayatnikFold={model,mount};
})();
