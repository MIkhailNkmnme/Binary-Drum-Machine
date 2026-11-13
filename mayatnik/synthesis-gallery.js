(function(root) {
  'use strict';

  const works = Object.freeze([
    {id:'northern-current', recipe:'polyrhythm', title:'Северное течение', tick:51, palette:'nocturne', style:'strokes',
      pose:{transformB:'mirrorY',shiftX:22}, operation:'XOR · темпы 2:3 · отражение и сдвиг',
      caption:'Обычный A идёт в темпе 2, обратный B — в темпе 3. Отражённый и сдвинутый B пересекает A. XOR оставляет бирюзовые и медные несовпадения.'},
    {id:'red-canon', recipe:'canon', title:'Киноварный канон', tick:38, palette:'ember', style:'weave',
      pose:{transformB:'rotate180',shiftX:78,shiftY:-22}, operation:'XOR · фаза +16 · поворот и сдвиг',
      caption:'Оба маятника обычные. B опережает A на шестнадцать шагов, повёрнут на 180° и сдвинут. XOR оставляет два косых потока несовпадений.'},
    {id:'thin-ice', recipe:'weave', title:'Тонкий лёд', tick:63, palette:'polar', style:'bits',
      pose:{transformB:'mirrorY',shiftX:1}, operation:'AND · отражение и сдвиг на клетку',
      caption:'Обратный B отражён и сдвинут на одну клетку относительно обычного A. AND оставляет единицы там, где встретились единицы обоих.'},
    {id:'eight-winds', recipe:'trail', title:'Восемь ветров', tick:92, palette:'orchid', style:'strokes',
      pose:{transformB:'mirrorY',shiftX:45}, operation:'XOR · след 8 кадров · отражение и сдвиг',
      caption:'XOR обычного A и обратного B выявляет несовпадения после отражения и сдвига B. На поле остаются единицы последних восьми кадров. Чем старше след, тем он темнее.'},
    {id:'two-rivers', recipe:'counter', title:'Две реки', tick:38, palette:'vellum', style:'strokes',
      pose:{transformB:'mirrorY',shiftX:74,shiftY:29}, operation:'OR · встречный ход · отражение и сдвиг',
      caption:'A наращивает вершины влево, B вправо. После отражения и сдвига B их объединение OR оставляет на светлом листе оба плотных берега.'},
    {id:'copper-echo', recipe:'accumulate', title:'Медное эхо', tick:63, palette:'nocturne', style:'weave',
      pose:{transformB:'mirrorY',shiftX:-70}, operation:'Накопление XOR · отражение и сдвиг',
      caption:'A строится обычным маятником, B — парами вершин после отражения и сдвига. XOR каждого кадра переключает накопленные биты. Стежки проходят через оставшиеся единицы.'},
    {id:'shadow-of-cone', recipe:'cone', title:'Тень конуса', tick:78, palette:'ember', style:'bits',
      pose:{transformB:'rotate180',shiftY:60}, operation:'A \\ B · неподвижный B · поворот и сдвиг',
      caption:'Из растущего маятника вычитается повёрнутый неподвижный конус. По краям остаются прорези с чёткими ступенями.'}
  ].map(work => Object.freeze({...work,pose:Object.freeze(work.pose)})));
  const dimensions = Object.freeze({width:385,height:128,anchor:192});

  function engineFor(core, work, tick = work.tick) {
    const recipe = core.recipes.find(r => r.id === work.recipe);
    const model = core.create({...dimensions,options:{...recipe.options,depth:128,...work.pose}});
    for (let i = 0; i < tick; i++) model.step();
    return model;
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = Object.freeze({works,dimensions,engineFor});
    return;
  }

  const core = root.MayatnikSynthesisPendulums, art = root.MayatnikSynthesisArt;
  const music = root.MayatnikSynthesisMusic;
  const editor = 'Zerkalius-mayatnik-synthesis.html';
  const exportState = document.getElementById('export-state');
  const soundState = document.getElementById('sound-state');

  function command(caption, label, icon, action) {
    const el = document.createElement(typeof action === 'string' ? 'a' : 'button');
    if (typeof action === 'string') el.href = action;
    else {
      el.type = 'button';
      el.addEventListener('click',action);
    }
    el.className = 'gz-hx';
    el.title = label;
    el.setAttribute('aria-label',label);
    el.dataset.miIcon = icon;
    const pic = document.createElement('span');
    pic.className = 'gz-ic';
    pic.setAttribute('aria-hidden','true');
    const name = document.createElement('span');
    name.className = 'gz-nm';
    name.textContent = caption;
    el.append(pic,name);
    pic.style.setProperty('--atlas-icon',root.ZerkMenuIcons.iconFor(el));
    return el;
  }

  function save(blob, filename) {
    if (!blob) throw new Error('Не удалось создать изображение');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url),60_000);
    exportState.textContent = 'Файл ' + filename + ' передан браузеру.';
  }

  function exhibit(work) {
    const model = engineFor(core,work);
    const options = {recipe:work.recipe,palette:work.palette,style:work.style,title:work.title,scale:4};
    const palette = art.palettes.find(p => p.id === work.palette);
    const style = art.styles.find(s => s.id === work.style);
    const figure = document.createElement('figure');
    figure.className = 'work';
    const mount = document.createElement('div');
    mount.className = 'mount';
    mount.style.setProperty('--mount',palette.mount);
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role','img');
    canvas.setAttribute('aria-label',work.title + '. ' + work.caption);
    art.render(canvas,model,options);
    mount.append(canvas);
    const details = document.createElement('figcaption');
    details.className = 'work-info';
    const title = document.createElement('h2');
    title.textContent = work.title;
    const facts = document.createElement('span');
    facts.className = 'facts';
    facts.textContent = work.operation + ' · такт ' + work.tick + ' · ' + style.name;
    const caption = document.createElement('p');
    caption.textContent = work.caption;
    const controls = document.createElement('div');
    controls.className = 'controls';
    const print = {...options,poster:true,scale:8};
    const svg = command('SVG','Скачать «'+work.title+'» в SVG','save',() => {
      try { save(new Blob([art.svg(model,print)],{type:'image/svg+xml'}),work.id+'.svg'); }
      catch (error) { exportState.textContent = error.message; }
    });
    const png = command('PNG','Скачать «'+work.title+'» в PNG','image',() => {
      try {
        art.render(document.createElement('canvas'),model,print).toBlob(blob => {
          try { save(blob,work.id+'.png'); }
          catch (error) { exportState.textContent = error.message; }
        },'image/png');
      } catch (error) { exportState.textContent = error.message; }
    });
    const query = new URLSearchParams({synthRecipe:work.recipe,synthDepth:128,synthTick:work.tick,
      synthTransform:work.pose.transformB,synthShiftX:work.pose.shiftX || 0,synthShiftY:work.pose.shiftY || 0,synthPalette:work.palette,synthArtStyle:work.style});
    const open = command('Опыт','Открыть рецепт «'+work.title+'» в Синтезе','link',editor+'?'+query);
    controls.append(svg,png,open);
    const heading = document.createElement('div');
    heading.append(title,facts);
    const text = document.createElement('div');
    text.append(caption,controls);
    details.append(heading,text);
    figure.append(mount,details);
    return figure;
  }

  function transport() {
    const bar = document.getElementById('transport');
    const player = music.createPlayer();
    const buttons = new Map();
    let request = 0, timer = 0, current = '';

    function stop(message = '') {
      request++;
      clearTimeout(timer);
      player.disable();
      current = '';
      for (const btn of buttons.values()) {
        btn.classList.remove('gz-on');
        btn.setAttribute('aria-pressed','false');
      }
      soundState.textContent = message;
    }

    async function start(style,tempo) {
      if (current === style) return stop();
      stop();
      for(const audio of document.querySelectorAll('audio'))audio.pause();
      const sequence = ++request;
      current = style;
      try {
        if (!await player.enable({style,tempo,volume:.53,root:48,scale:'minor',density:3})) {
          if (sequence === request) stop('Браузер не запустил звук.');
          return;
        }
        if (sequence !== request) return;
        const model = engineFor(core,works[0],0), btn = buttons.get(style);
        btn.setAttribute('aria-pressed','true');
        btn.classList.add('gz-on');
        soundState.textContent = style === 'techno' ? 'Играет техно' : 'Играет камерная версия';
        function next() {
          if (sequence !== request) return;
          player.playFrame(model);
          if (model.tick >= 63) timer = setTimeout(() => stop('Фрагмент закончился.'),950);
          else {
            model.step();
            timer = setTimeout(next,15000/tempo);
          }
        }
        next();
      } catch {
        if (sequence === request) stop('Браузер не запустил звук.');
      }
    }

    for (const [style,title,tempo] of [['techno','Техно',120],['classic','Классика',90]]) {
      const button = command(title,title+' · пуск или остановка','play',() => start(style,tempo));
      button.setAttribute('aria-pressed','false');
      buttons.set(style,button);
      bar.append(button);
    }
    root.addEventListener('pagehide',() => stop());
    for(const audio of document.querySelectorAll('audio'))audio.addEventListener('play',()=>{stop();for(const other of document.querySelectorAll('audio'))if(other!==audio)other.pause();});
    document.addEventListener('visibilitychange',() => {if(document.hidden){stop('Пауза: вкладка скрыта.');for(const audio of document.querySelectorAll('audio'))audio.pause();}});
  }

  try {
    const navigation = document.getElementById('navigation');
    navigation.append(command('Синтез','Открыть Маятник · Синтез','link',editor));
    const exhibits = document.getElementById('exhibits');
    for (const work of works) exhibits.append(exhibit(work));
    transport();
  } catch (error) {
    exportState.textContent = 'Атлас не удалось загрузить. ' + error.message;
  }
})(typeof globalThis === 'object' ? globalThis : this);
