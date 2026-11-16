/* Main pendulum bridge. Recipes are field sources; artwork is a separate,
 * deliberately non-editable projection of that source. */
(function(root){
  'use strict';
  let cached=null;
  function scene(id){if(!cached||cached.id!==id)cached=root.MayatnikPhoneScenes.create(id);return cached;}
  function valid(id){return typeof id==='string'&&!!root.MayatnikPhoneScenes.get(id);}
  function validate(state){
    if(!state.phoneScene)return;
    if(!valid(state.phoneScene))throw Error('Неизвестный рецепт обоев');
    const model=scene(state.phoneScene);
    if(state.rows!==model.height||state.steps!==model.maxFrames)throw Error('Размер поля не совпадает с рецептом обоев');
    if(state.animatrixOn||state.sequenceSourceOn||state.compareSource||state.edgeWrap)throw Error('В работе указаны два источника поля');
    if(!['art','cells'].includes(state.phoneView))throw Error('Неизвестное представление обоев');
    if(!Number.isInteger(state.phoneTempo)||state.phoneTempo<60||state.phoneTempo>180)throw Error('Темп обоев должен быть от60 до180 BPM');
    if(state.phoneVoice!==undefined&&!['robot','bits'].includes(state.phoneVoice))throw Error('Неизвестный голос обоев');
  }
  function mount(host){
    const canvas=document.createElement('canvas');canvas.id='mayPhoneArtwork';canvas.hidden=true;
    canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Живая композиция обоев. Редактирование поля доступно в режиме «Клетки».');document.body.append(canvas);
    const music=root.MayatnikPhoneMusic.createPlayer();let lastSound='',wasActive=false,lastPaint=null,lastMenu='';
    const captures=new Map();
    const fixedControls=['rows','steps','mode','speed','frameT','third','bRowRun','bRetriangle','bThird','bFour'];
    const originalDisabled=new Map();
    const active=()=>!!host.state().phoneScene,art=()=>active()&&host.state().phoneView==='art';
    const notice=message=>{document.getElementById('fillInfo').textContent=message;};
    function capture(width=540,height=1200){
      const key=width+'x'+height,previous=captures.get(key);if(previous?.frame===host.frame())return previous.canvas;
      const target=document.createElement('canvas');target.width=width;target.height=height;
      root.MayatnikPhoneRender.draw(target.getContext('2d'),host.frame(),{width,height});captures.set(key,{frame:host.frame(),canvas:target});return target;
    }
    function sync(){
      const enabled=active(),project=art(),s=host.state();
      if(enabled!==wasActive){
        for(const id of fixedControls){const input=document.getElementById(id);if(!input)continue;if(enabled){originalDisabled.set(id,input.disabled);input.disabled=true;}else input.disabled=originalDisabled.get(id)||false;}
        wasActive=enabled;
      }
      document.body.classList.toggle('may-phone-art',project);canvas.hidden=!project;
      if(!enabled){music.disable();lastSound='';}
      if(project){
        const bounds=host.wrap.getBoundingClientRect(),h=Math.max(1,bounds.height-24),w=Math.max(1,Math.min(bounds.width-24,h*9/20));
        canvas.style.left=(bounds.left+(bounds.width-w)/2)+'px';canvas.style.top=(bounds.top+12)+'px';canvas.style.width=w+'px';canvas.style.height=(w*20/9)+'px';
        const scale=Math.min(2,devicePixelRatio||1),width=Math.max(1,Math.round(w*scale)),height=Math.max(1,Math.round(w*20/9*scale));
        if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;lastPaint=null;}
        if(host.frame()&&lastPaint!==host.frame()){root.MayatnikPhoneRender.draw(canvas.getContext('2d'),host.frame(),{width,height});lastPaint=host.frame();}
      }
      music.configure({tempo:s.phoneTempo||137,voice:s.phoneVoice||'robot'});
      const key=enabled?host.frame()?.id+':'+host.frame()?.k:'';
      if(enabled&&host.playing()&&key!==lastSound&&music.enabled){music.playFrame(host.frame());lastSound=key;}
      if(!host.playing())lastSound='';
      const menuKey=JSON.stringify([s.phoneScene,s.phoneView,s.phoneTempo,s.phoneVoice,music.enabled]);if(menuKey!==lastMenu){lastMenu=menuKey;dispatchEvent(new Event('may-phone-change'));}
    }
    function stop(){music.silence();lastSound='';}
    const api={scene,valid,validate,active,art,sync,stop,capture,canvas,
      get:()=>({id:host.state().phoneScene||'',view:host.state().phoneView||'art',tempo:host.state().phoneTempo||137,voice:host.state().phoneVoice||'robot',sound:music.enabled,frame:host.frame()?.k||0}),
      list:()=>root.MayatnikPhoneScenes.list(),
      select:id=>host.select(id).catch(error=>notice(error.message)),
      leave:()=>host.leave().catch(error=>notice(error.message)),
      view(value){if(!active()||!['art','cells'].includes(value))return;host.state().phoneView=value;host.changed();},
      tempo(value){host.state().phoneTempo=Math.max(60,Math.min(180,Math.round(Number(value)||137)));host.changed();},
      voice(value){if(!['robot','bits'].includes(value))return;music.silence();lastSound='';host.state().phoneVoice=value;host.changed();},
      async sound(){try{if(!active())return;if(music.enabled)music.disable();else{host.stopOtherSound();await music.enable({tempo:host.state().phoneTempo||137,voice:host.state().phoneVoice||'robot'});if(host.frame()){music.playFrame(host.frame());lastSound=host.frame().id+':'+host.frame().k;}}sync();}catch(error){notice('Звук не включён: '+error.message);}},
      getStream:()=>active()&&music.enabled?music.getStream():null,
      base(){if(active())host.seek(scene(host.state().phoneScene).baseFrame);},
      wav(){if(!active())return;try{const output=root.MayatnikPhoneMusic.renderWav(scene(host.state().phoneScene),{start:host.frame().k,tempo:host.state().phoneTempo,voice:host.state().phoneVoice||'robot',steps:128});host.download('oboi-'+host.state().phoneScene+'.wav',new Blob([output.bytes],{type:'audio/wav'}));}catch(error){notice('WAV не сохранён: '+error.message);}}
    };
    for(const type of ['pointerdown','pointerup','mousedown','mouseup','click','dblclick','wheel','contextmenu'])canvas.addEventListener(type,e=>{e.preventDefault();e.stopPropagation();},{passive:false});
    addEventListener('resize',sync);addEventListener('pagehide',()=>music.disable());
    return api;
  }
  root.MayatnikPhoneHost={scene,valid,validate,mount};
})(globalThis);
