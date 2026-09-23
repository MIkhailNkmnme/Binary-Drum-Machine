// Звук и запись для общей страницы обоев.
// Звук: трек с диска или системный звук ПК (захват вкладки/экрана с галочкой «звук»).
// Спектр раскладывается на 32 полосы и отдаётся в livelyAudioListener — ровно как это делает Lively,
// поэтому все реакции обоев на музыку работают без изменений движка.
// Запись: общий модуль ../_js/recorder.js, но кадр сводит эта страница сама — у обоев пять
// холстов, а часы, прозрачность дождя, контраст и полосы экрана сделаны через CSS, и
// обычное сведение холстов их бы потеряло.
(function(){
  var $=function(id){ return document.getElementById(id); };
  var audioEl=$('bgAudio');

  var A=window.AUDIO_VISUALIZER={
    audioCtx:null, analyser:null, data:null, source:null, isInit:false,
    elSource:null, stream:null, mode:'',
    initCore:function(){
      if(this.isInit) return;
      this.audioCtx=new (window.AudioContext||window.webkitAudioContext)();
      this.analyser=this.audioCtx.createAnalyser();
      this.analyser.fftSize=256; this.analyser.smoothingTimeConstant=0.55;
      this.data=new Uint8Array(this.analyser.frequencyBinCount);
      this.isInit=true;
    },
    attach:function(src,toSpeakers){
      if(this.source){ try{ this.source.disconnect(); }catch(e){} }
      this.source=src;
      src.connect(this.analyser);
      if(toSpeakers) src.connect(this.audioCtx.destination);
      // запись уже идёт или шла — новый источник тоже в неё
      var R=window.__zerkRecorder; if(R && R._dest) src.connect(R._dest);
    },
    stopStream:function(){
      if(this.stream){ this.stream.getTracks().forEach(function(t){ t.stop(); }); this.stream=null; }
    },
    initFile:function(file){
      this.initCore(); this.stopStream();
      audioEl.src=URL.createObjectURL(file);
      if(!this.elSource) this.elSource=this.audioCtx.createMediaElementSource(audioEl);
      this.attach(this.elSource,true); this.mode='file';
      if(this.audioCtx.state==='suspended') this.audioCtx.resume();
      audioEl.play().catch(function(){});
      $('trackName').textContent=file.name;
      if(window.zerkSetTrack) zerkSetTrack(file.name.replace(/\.[^.]+$/,'').replace(/_+/g,' ').trim());
      ui();
    },
    initSystem:async function(){
      this.initCore();
      var stream;
      try{ stream=await navigator.mediaDevices.getDisplayMedia({audio:true,video:true}); }
      catch(err){ note('Захват отменён'); return; }
      var at=stream.getAudioTracks();
      if(!at.length){
        stream.getTracks().forEach(function(t){ t.stop(); });
        alert('Звук не выбран. В окне выбора поставьте галочку «Предоставить доступ к аудио системы» (для вкладки — «звук вкладки»).');
        return;
      }
      this.stopStream(); audioEl.pause();
      this.stream=stream;
      this.attach(this.audioCtx.createMediaStreamSource(new MediaStream([at[0]])),false); this.mode='system';
      if(this.audioCtx.state==='suspended') this.audioCtx.resume();
      var self=this;
      at[0].addEventListener('ended',function(){ if(self.stream===stream){ self.stream=null; self.mode=''; ui(); note('Захват звука остановлен'); } });
      // название вкладки/окна, откуда звук. Браузер не всегда его отдаёт: вместо имени бывает
      // служебный код («window:123:0», «web-contents-media-stream://…») — такой не показываем
      var vt=stream.getVideoTracks()[0], lbl=vt?String(vt.label||'').trim():'';
      if(/^(screen|window|tab):|:\/\/|^[\w-]+:\d+(:\d+)?$/i.test(lbl)) lbl='';
      $('trackName').textContent='звук ПК'+(lbl?' — '+lbl:'');
      if(window.zerkSetTrack) zerkSetTrack(lbl);
      ui();
    },
    active:function(){
      if(!this.isInit) return false;
      if(this.mode==='system') return !!this.stream;
      if(this.mode==='file') return !audioEl.paused;
      return false;
    }
  };

  // ---------- кнопки ----------
  function note(t){ var el=$('audioNote'); el.textContent=t; clearTimeout(note.to); note.to=setTimeout(function(){ el.textContent=''; },2500); }
  function ui(){
    $('btnSys').textContent = A.mode==='system' ? '🔊 идёт захват' : '🎤 Звук ПК';
    $('btnSys').classList.toggle('on',A.mode==='system');
    $('btnPlay').disabled = !audioEl.src;
    $('btnPlay').textContent = (A.mode==='file' && !audioEl.paused) ? '⏸' : '▶';
    if(A.mode!=='file' && A.mode!=='system') $('trackName').textContent='звук не подключён';
  }
  function togglePlay(){
    if(!audioEl.src) return;
    if(A.mode!=='file'){ A.stopStream(); A.attach(A.elSource,true); A.mode='file'; }
    if(A.audioCtx.state==='suspended') A.audioCtx.resume();
    if(audioEl.paused) audioEl.play().catch(function(){}); else audioEl.pause();
  }
  $('btnTrack').onclick=function(){ $('audioLoader').click(); };
  $('audioLoader').onchange=function(e){ var f=e.target.files[0]; if(f) A.initFile(f); e.target.value=''; };
  $('btnSys').onclick=function(){
    if(A.mode==='system'){ A.stopStream(); A.mode=''; ui(); return; }
    A.initSystem();
  };
  $('btnPlay').onclick=togglePlay;
  $('vol').oninput=function(){ audioEl.volume=this.value/100; };
  $('loop').onchange=function(){ audioEl.loop=this.checked; };
  audioEl.loop=$('loop').checked; audioEl.volume=$('vol').value/100;
  ['play','pause','ended'].forEach(function(ev){ audioEl.addEventListener(ev,ui); });
  window.addEventListener('keydown',function(e){
    if(e.code!=='Space' || e.ctrlKey||e.metaKey||e.altKey) return;
    var t=e.target.tagName; if(t==='INPUT'||t==='TEXTAREA'||t==='SELECT'||t==='BUTTON') return;
    e.preventDefault(); togglePlay();
  });
  ui();

  // ---------- кадр: весь экран или телефон 9:16 ----------
  // В режиме телефона сцена целиком перестраивается под вертикальную рамку по центру (надпись и часы
  // укладываются в её ширину), а не вырезается из широкого кадра — иначе надпись обрезало бы по краям.
  // Запись пишет холсты, поэтому в этом режиме в видео попадает ровно рамка.
  var FK='zerk-lively:frameMode';
  function setPW(){ document.body.style.setProperty('--pw', (typeof stageW==='function'?stageW():innerWidth)+'px'); }
  function setFrame(phone){
    window.ZERK_PHONE=!!phone;
    document.body.classList.toggle('phone',!!phone);
    setPW();
    if(typeof layout==='function') layout();
  }
  var fm=$('frameMode');
  try{ fm.value=localStorage.getItem(FK)==='1'?'1':'0'; }catch(e){}
  fm.onchange=function(){
    var R0=window.__zerkRecorder;
    if(R0 && R0.rec){ fm.value=window.ZERK_PHONE?'1':'0'; note('Сначала остановите запись'); return; }
    try{ localStorage.setItem(FK,fm.value); }catch(e){}
    setFrame(fm.value==='1');
  };
  window.addEventListener('resize',setPW);
  if(fm.value==='1') setFrame(true);

  // ---------- спектр → 32 полосы, как у Lively ----------
  var BANDS=32, bands=new Array(BANDS), idle=0;
  (function feed(){
    requestAnimationFrame(feed);
    if(!A.isInit || typeof livelyAudioListener!=='function') return;
    if(A.active()){
      idle=0;
      A.analyser.getByteFrequencyData(A.data);
      var n=96/BANDS;                               // верхние бины почти всегда пустые
      for(var b=0;b<BANDS;b++){
        var s=0; for(var i=0;i<n;i++) s+=A.data[b*n+i];
        bands[b]=Math.min(1,s/n/255*1.15);
      }
      livelyAudioListener(bands);
    } else if(idle<60){                           // тишина: даём уровням плавно опасть
      idle++; for(var k=0;k<BANDS;k++) bands[k]=0; livelyAudioListener(bands);
    }
  })();

  // ---------- сведение кадра для записи ----------
  var R=window.__zerkRecorder;
  if(R) R.makeSource=function(fps){
    var rc=$('rain'), gl=$('hill'), halo=$('halo'), tc=$('title'), ck=$('clock');
    var W=rc.width, H=rc.height;
    if(W<16||H<16) return null;
    var mix=document.createElement('canvas'); mix.width=W; mix.height=H;
    var ctx=mix.getContext('2d');

    // полосы развёртки и затемнение к краям — те же, что #scan в CSS
    var scan=document.createElement('canvas'); scan.width=W; scan.height=H;
    var sx=scan.getContext('2d');
    sx.fillStyle='rgba(0,0,0,.33)';
    for(var y=0;y<H;y+=3) sx.fillRect(0,y+2,W,1);
    sx.save(); sx.translate(W/2,H/2); sx.scale(1,H/W);
    var r=W/2*Math.SQRT2, g=sx.createRadialGradient(0,0,0,0,0,r);
    g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(0.55,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,.75)');
    sx.fillStyle=g; sx.fillRect(-W/2,-W/2,W,W); sx.restore();

    var tick=0;
    function drawClock(){
      if(ck.style.display==='none') return;
      var cs=getComputedStyle(ck), sp=ck.querySelector('span');
      var txt=ck.textContent.replace(/ /g,' ');
      if(sp && sp.style.visibility==='hidden') txt=txt.replace(':',' ');
      ctx.save();
      ctx.font=cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;
      try{ ctx.letterSpacing=cs.letterSpacing; }catch(e){}
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle=cs.color;
      var m=/rgba?\([^)]*\)/.exec(ck.style.textShadow||'');
      if(m){ ctx.shadowColor=m[0]; ctx.shadowBlur=12; }
      ctx.fillText(txt, W/2, ck.offsetTop+ck.offsetHeight/2);
      ctx.restore();
    }
    function draw(){
      ctx.filter=document.body.style.filter||'none';        // контраст и насыщенность
      ctx.globalAlpha=1; ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
      var ra=parseFloat(rc.style.opacity); ctx.globalAlpha=isNaN(ra)?1:ra;
      try{ ctx.drawImage(rc,0,0,W,H); }catch(e){}
      ctx.globalAlpha=1;
      [gl,halo,tc].forEach(function(c){ try{ ctx.drawImage(c,0,0,W,H); }catch(e){} });
      drawClock();
      ctx.filter='none';
      ctx.drawImage(scan,0,0);
      // браузер отдаёт кадр, только когда холст изменился — меняем один пиксель
      tick=(tick+1)%2; ctx.fillStyle='rgba(0,0,0,'+(0.004+tick*0.002)+')'; ctx.fillRect(0,0,1,1);
    }
    // Кадр снимается сразу после отрисовки WebGL, пока буфер ещё не отдан экрану, —
    // так не нужен preserveDrawingBuffer, который тормозил страницу и без записи.
    onFrame=draw;
    return { stream:mix.captureStream(fps), stop:function(){ onFrame=null; } };
  };
  var onFrame=null;
  if(window.renderer){
    var render0=renderer.render;
    renderer.render=function(){ var r=render0.apply(this,arguments); if(onFrame) onFrame(); return r; };
  }
})();
