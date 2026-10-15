/* Горизонтальная XOR-свёртка: правая часть влево, левая вправо, к неподвижному центру. v1.
   v2: биты едут со своими цветами картинки (краска, «Цвета», «Очки», «Неизменные» — что было на поле при старте),
   colour / paint — Uint32 RGBA на клетку, 0 — нет. v3: золотой центральный столбец снят («как этот столб убрать?»).
   v4: «парой» — шаг сразу правой и левой частью (два хода модели за один, если они с разных сторон).
   v6: галка «центр» — подсветка центрального XOR-столбца золотом с рамкой (по умолчанию выкл., выбор помнится).
   v5: щелчок без сдвига красит («при свёртке не даёт ничего красить») — страница красит исходный столбец клетки (tap), свёртка снимает цвета заново. */
(() => {
  'use strict';
  function model({width,height,center,data,colour,paint}) {
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
    return {width,height,center,max:moves.length,get frame(){return frame;},
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
  function mount({button,wrap,canvas,capture,config,beforeStart,onClose,zoom,tap}) {
    const panel=document.createElement('section');panel.id='mayFoldPanel';panel.hidden=true;panel.setAttribute('aria-label','Пульт горизонтальной свёртки');
    panel.innerHTML='<div class="may-fold-steps"><button type="button" data-fold="back" title="Предыдущий шаг">−1</button><output aria-live="off"></output><label class="may-fold-pair" title="Шаг — правая и левая часть сразу"><input type="checkbox" data-fold="pair"> парой</label><label class="may-fold-pair" title="Подсветить центральный столбец, куда складывается XOR"><input type="checkbox" data-fold="mid"> центр</label><button type="button" data-fold="next" title="Следующий шаг">+1</button></div><input class="may-fold-frame" type="range" min="0" value="0" step="1" aria-label="Шаг горизонтальной свёртки"><div class="zz-pult"><input class="zz-pult-range" type="range" min="0" max="401" value="101" aria-label="Скорость свёртки"><button type="button" class="zz-pult-back" title="Обратный ход">◀</button><button type="button" class="zz-pult-fwd" title="Прямой ход">▶</button><button type="button" class="zz-pult-play" aria-label="Автоплей свёртки" aria-pressed="false">▶</button><output class="zz-pult-value"></output></div>';
    const layer=document.createElement('canvas');layer.id='mayFoldCanvas';layer.hidden=true;layer.setAttribute('aria-label','Поле горизонтальной свёртки');document.body.append(layer,panel);
    const ctx=layer.getContext('2d'),pult=panel.querySelector('.zz-pult'),play=pult.querySelector('.zz-pult-play'),speed=pult.querySelector('input'),value=pult.querySelector('output'),timeline=panel.querySelector('.may-fold-frame'),progress=panel.querySelector('.may-fold-steps output');
    let state=null,running=false,dir=1,rateStep=101,timer=0,last=0,credit=0,suppressClick=false,off=null,offImg=null;
    const rate=()=>rateStep<=0?0:.1*10**((rateStep-1)/100);
    try{const saved=localStorage.getItem('mayatnik-fold-rate'),n=Number(saved);if(saved!==null&&n>=0&&n<=401)rateStep=n;}catch(_){}
    // v4: «парой» — по умолчанию включено, выбор помнится
    const pairBox=panel.querySelector('[data-fold="pair"]'),pair=()=>pairBox.checked;
    const midBox=panel.querySelector('[data-fold="mid"]'),midOn=()=>midBox.checked;   // v6
    try{midBox.checked=localStorage.getItem('mayatnik-fold-mid')==='1';}catch(_){}
    const pairSaved=()=>{try{return localStorage.getItem('mayatnik-fold-pair')!=='0';}catch(_){return true;}};
    const adv=(f,d,n=1)=>{if(!pair())return f+d*n;for(let i=0;i<n;i++)f=state.pairStep(f,d);return f;};
    function sync(){
      button.setAttribute('aria-pressed',String(!!state));panel.hidden=layer.hidden=!state;
      document.body.classList.toggle('may-fold-active',!!state);
      if(!state)return;
      const two=pair()&&state.pairStep(state.frame,1)-state.frame===2;
      timeline.max=state.max;timeline.value=state.frame;progress.textContent=`СвёрткаГориз · ${state.frame}/${state.max} · ${two?'обе →←':state.nextSide()}`;
      panel.querySelector('[data-fold="back"]').textContent=pair()?'−2':'−1';panel.querySelector('[data-fold="next"]').textContent=pair()?'+2':'+1';
      panel.querySelector('[data-fold="back"]').disabled=state.frame===0;panel.querySelector('[data-fold="next"]').disabled=state.frame===state.max;
      play.textContent=running?'Ⅱ':'▶';play.setAttribute('aria-pressed',String(running));speed.value=rateStep;
      for(const [cls,d]of [['.zz-pult-back',-1],['.zz-pult-fwd',1]]){const b=pult.querySelector(cls);b.classList.toggle('on',dir===d);b.setAttribute('aria-pressed',String(dir===d));}
      value.textContent=ZerkPult.label(rate());value.title=`${Number(rate().toPrecision(3))} шагов/с · двойной щелчок — ×1`;
      ZerkPult.sync(pult,rateStep/401);
    }
    function render(){
      if(!state)return;const c=config();if(!c){close();return;}
      const host=wrap.getBoundingClientRect(),rect=canvas.getBoundingClientRect(),s=c.scale,dpr=Math.min(2,devicePixelRatio||1),w=wrap.clientWidth,h=wrap.clientHeight;
      layer.style.left=host.left+'px';layer.style.top=host.top+'px';layer.style.width=w+'px';layer.style.height=h+'px';
      const pw=Math.max(1,Math.round(w*dpr)),ph=Math.max(1,Math.round(h*dpr));if(layer.width!==pw)layer.width=pw;if(layer.height!==ph)layer.height=ph;
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);const x0=rect.left-host.left,y0=rect.top-host.top;
      const only=c.view==='digitsOnly',digits=only||c.view==='digits',rp=c.rp,mid=midOn(),css=new Map(),rgb=v=>{let t=css.get(v);if(!t){t=`rgb(${v&255},${v>>>8&255},${v>>>16&255})`;css.set(v,t);}return t;};
      ctx.font=`600 ${s*.8}px ${c.font}`;ctx.textAlign='center';ctx.textBaseline='middle';
      const halves=rp===2?[[0,0],[1,state.width+c.gap]]:[[rp,0]];
      for(const[p,ox]of halves){
        // v2: плоско и без цифр — одна картинка «пиксель = бит», увеличенная без сглаживания (по клетке было ~0,7 с на кадр 1534×512)
        if(p<0&&!only&&!(digits&&s>=4)){const W=state.width,H=state.height;
          if(!off||off.width!==W||off.height!==H){off=document.createElement('canvas');off.width=W;off.height=H;offImg=off.getContext('2d').createImageData(W,H);}
          const u=new Uint32Array(offImg.data.buffer);
          for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x,bit=state.bit(x,y);if(bit<0){u[i]=0;continue;}
            u[i]=mid&&x===state.center?(bit?0xff8ae0ff:0xff0b86b8):state.colourAt(x,y)||(bit?0xfff5ede8:0xff75645b);}
          off.getContext('2d').putImageData(offImg,0,0);ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(off,x0+ox*s,y0,W*s,H*s);
          if(mid){ctx.lineWidth=Math.max(1.5,Math.min(3,s*.2));ctx.strokeStyle='#ffd35b';ctx.strokeRect(x0+(state.center+ox)*s,y0,s,H*s);}ctx.restore();continue;}
        const xa=Math.max(0,Math.floor(-x0/s-ox)-1),xb=Math.min(state.width,Math.ceil((w-x0)/s-ox)+1),ya=Math.max(0,Math.floor(-y0/s)-1),yb=Math.min(state.height,Math.ceil((h-y0)/s)+1);
        for(let y=ya;y<yb;y++)for(let x=xa;x<xb;x++){
          if(p>=0&&((x+c.origin-c.anchor-p-y)%2+2)%2)continue;const bit=state.bit(x,y);if(bit<0)continue;
          const cx=x0+(x+ox+.5)*s,cy=y0+(y+.5)*s,back=only?state.paintAt(x,y):state.colourAt(x,y),gold=mid&&x===state.center;
          if(only&&(back||gold)){ctx.fillStyle=gold?(bit?'#7a5a10':'#4a3608'):rgb(back);ctx.fillRect(cx-s/2,cy-s/2,s,s);}
          if(!only){ctx.fillStyle=gold?(bit?'#ffe08a':'#b8860b'):back?rgb(back):bit?'#e8edf5':'#5b6475';if(p<0)ctx.fillRect(cx-s/2,cy-s/2,s,s);else{ctx.beginPath();ctx.moveTo(cx,cy-s);ctx.lineTo(cx+s,cy);ctx.lineTo(cx,cy+s);ctx.lineTo(cx-s,cy);ctx.closePath();ctx.fill();}}
          if((digits&&(only||s>=4))||(p>=0&&s>=14)){ctx.fillStyle=only?(gold?(bit?'#ffe08a':'#ffb020'):bit?c.one:c.zero):(bit?'#07111d':'#ffffff');ctx.fillText(String(bit),cx,cy);}
        }
        if(mid){ctx.save();ctx.lineWidth=Math.max(1.5,Math.min(3,s*.2));ctx.strokeStyle='#ffd35b';ctx.strokeRect(x0+(state.center+ox)*s,y0,s,state.height*s);ctx.restore();}
      }
      sync();
    }
    function pause(){running=false;cancelAnimationFrame(timer);timer=0;last=0;credit=0;sync();}
    function close(){pause();state=null;sync();onClose?.();}
    function seek(n){if(!state)return;state.seek(n);render();}
    function tick(now){if(!running||!state)return;if(last)credit+=Math.min(.25,(now-last)/1000)*rate();last=now;
      const n=Math.min(128,Math.floor(credit));if(n){credit-=n;seek(adv(state.frame,dir,n));}
      if((dir>0&&state.frame===state.max)||(dir<0&&state.frame===0)){pause();return;}
      timer=requestAnimationFrame(tick);
    }
    function togglePlay(){if(!state)return;if(running){pause();return;}if(dir>0&&state.frame===state.max)seek(0);if(dir<0&&state.frame===0)seek(state.max);running=true;last=0;credit=0;sync();timer=requestAnimationFrame(tick);}
    function setRate(n){rateStep=Math.max(0,Math.min(401,Math.round(n)));try{localStorage.setItem('mayatnik-fold-rate',String(rateStep));}catch(_){}sync();}
    button.onclick=()=>{if(state){close();return;}beforeStart();const data=capture();if(!data)return;state=model(data);sync();render();};
    play.onclick=()=>{if(suppressClick){suppressClick=false;return;}togglePlay();};
    speed.oninput=()=>setRate(Number(speed.value));value.ondblclick=()=>setRate(101);
    for(const [cls,d]of [['.zz-pult-back',-1],['.zz-pult-fwd',1]])pult.querySelector(cls).onclick=()=>{dir=d;last=0;credit=0;sync();};
    for(const [action,d]of [['back',-1],['next',1]])panel.querySelector(`[data-fold="${action}"]`).onclick=()=>{pause();seek(adv(state.frame,d));};
    midBox.onchange=()=>{try{localStorage.setItem('mayatnik-fold-mid',midBox.checked?'1':'0');}catch(_){}render();};
    pairBox.checked=pairSaved();pairBox.onchange=()=>{try{localStorage.setItem('mayatnik-fold-pair',pairBox.checked?'1':'0');}catch(_){}sync();};
    timeline.oninput=()=>{pause();seek(Number(timeline.value));};
    play.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();play.setPointerCapture(e.pointerId);suppressClick=false;const x=e.clientX,start=rateStep;
      const move=ev=>{if(ev.pointerId!==e.pointerId)return;if(Math.abs(ev.clientX-x)>3)suppressClick=true;if(suppressClick)setRate(start+(ev.clientX-x)*401/ZerkPult.trackWidth(pult));};
      const end=ev=>{if(ev.pointerId!==e.pointerId)return;play.removeEventListener('pointermove',move);play.removeEventListener('pointerup',end);play.removeEventListener('pointercancel',end);if(play.hasPointerCapture(e.pointerId))play.releasePointerCapture(e.pointerId);};
      play.addEventListener('pointermove',move);play.addEventListener('pointerup',end);play.addEventListener('pointercancel',end);
    });
    // Панорамирование остаётся доступным; исходная раскраска в просмотре не редактируется.
    let pan=null,pinch=null,down=null;const pointers=new Map();
    wrap.addEventListener('pointerdown',e=>{if(!state)return;e.stopImmediatePropagation();if(e.button!==0&&e.button!==1)return;
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});pan={id:e.pointerId,x:e.clientX,y:e.clientY,left:wrap.scrollLeft,top:wrap.scrollTop};
      down=pointers.size===1?{id:e.pointerId,x:e.clientX,y:e.clientY,button:e.button,moved:false}:null;
      if(pointers.size===2){const[a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),scale:config()?.scale||1};pan=null;}
      wrap.setPointerCapture(e.pointerId);e.preventDefault();},true);
    wrap.addEventListener('pointermove',e=>{if(!state)return;e.stopImmediatePropagation();if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(down?.id===e.pointerId&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>3)down.moved=true;
      if(pinch&&pointers.size===2){const[a,b]=[...pointers.values()];if(pinch.distance>0)zoom?.(pinch.scale*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance,(a.x+b.x)/2,(a.y+b.y)/2);}
      else if(pan?.id===e.pointerId){wrap.scrollLeft=pan.left+pan.x-e.clientX;wrap.scrollTop=pan.top+pan.y-e.clientY;}},true);
    for(const type of ['pointerup','pointercancel'])wrap.addEventListener(type,e=>{if(!state)return;e.stopImmediatePropagation();pointers.delete(e.pointerId);pan=null;if(pointers.size<2)pinch=null;if(wrap.hasPointerCapture(e.pointerId))wrap.releasePointerCapture(e.pointerId);
      // v5: щелчок левой без сдвига — покрасить исходный столбец клетки (плоский вид), затем снять цвета заново
      const d=down;down=null;if(type!=='pointerup'||!d||d.id!==e.pointerId||d.moved||d.button!==0||pointers.size||!tap)return;
      const c=config();if(!c||c.rp>=0)return;const r=canvas.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/c.scale),y=Math.floor((e.clientY-r.top)/c.scale),sx=state.srcAt(x);
      if(sx<0||y<0||y>=state.height||!tap(sx,y))return;const cap=capture();if(cap)state.recolour(cap.colour,cap.paint);render();},true);
    wrap.addEventListener('contextmenu',e=>{if(state){e.preventDefault();e.stopImmediatePropagation();}},true);
    addEventListener('keydown',e=>{if(!state||e.target.closest('input,select,button,textarea'))return;if(['Space','ArrowLeft','ArrowRight','Escape'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();if(e.code==='Escape')close();else if(e.code==='Space')togglePlay();else{pause();seek(adv(state.frame,e.code==='ArrowRight'?1:-1));}}},true);
    wrap.addEventListener('scroll',render,{passive:true});addEventListener('resize',render);
    return {get active(){return !!state;},close,render};
  }
  window.MayatnikFold={model,mount};
})();
