/* ИСС-117 · external listening only: no field transport, recorder or audio routing. */
(() => {
  'use strict';
  const KEY='mayatnik-listening-open-v1';
  const URL='https://www.youtube.com/watch?v=f-dUVYPt1Pk';
  const TITLE='Elektronische Träume — 45-Min 1970s German Electronic Journey | Berlin School';
  let panel,screen,closeButton,launcher,opened=false;
  const save=()=>{try{localStorage.setItem(KEY,opened?'1':'0');}catch(_){}};
  function layout(){
    if(!panel||!opened)return;
    const view=window.visualViewport,left=view?.offsetLeft||0,top=view?.offsetTop||0;
    const width=view?.width||innerWidth,height=view?.height||innerHeight;
    const header=document.querySelector('header')?.getBoundingClientRect();
    const y=Math.min(top+height-40,Math.max(top+8,(header?.bottom||top)+8));
    const w=Math.max(0,Math.min(560,width-16));
    Object.assign(panel.style,{left:(left+Math.max(8,width-w-8))+'px',top:Math.max(top+8,y)+'px',width:w+'px',maxHeight:Math.max(24,top+height-Math.max(top+8,y)-8)+'px'});
  }
  function make(){
    if(panel)return;
    panel=document.createElement('section');panel.id='mayListeningPanel';panel.hidden=true;
    panel.setAttribute('role','region');panel.setAttribute('aria-labelledby','mayListeningTitle');
    const heading=document.createElement('div');heading.className='may-listening-heading';
    const title=document.createElement('strong');title.id='mayListeningTitle';title.textContent='Музыка · KOBTRAX';
    closeButton=document.createElement('button');closeButton.type='button';closeButton.className='gz-hx may-standard';
    closeButton.title='Закрыть плеер и остановить ролик';closeButton.setAttribute('aria-label',closeButton.title);
    closeButton.innerHTML='<span class="gz-ic" aria-hidden="true">×</span><span class="gz-nm"></span><svg class="may-standard-outline" viewBox="0 0 120 24" aria-hidden="true"><polygon points="12,0 108,0 120,12 108,24 12,24 0,12"/></svg>';
    closeButton.querySelector('.gz-nm').textContent=window.HubButtonText.shortCaption('Закрыть');
    closeButton.addEventListener('click',()=>setOpen(false));heading.append(title,closeButton);
    const caption=document.createElement('p');caption.textContent=TITLE;
    screen=document.createElement('div');screen.className='may-listening-screen';
    const note=document.createElement('p');note.textContent='Запустите ролик кнопкой YouTube. Музыка звучит отдельно от кадров поля и записи Зеркалиуса.';
    const fallback=document.createElement('p'),link=document.createElement('a');link.href=URL;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Открыть на YouTube';fallback.append('Если плеер недоступен: ',link);
    panel.append(heading,caption,screen,note,fallback);document.body.append(panel);
    panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);}event.stopPropagation();});
    for(const name of ['pointerdown','click','dblclick','wheel'])panel.addEventListener(name,event=>event.stopPropagation());
  }
  function setOpen(value,source){
    make();if(source)launcher=source;
    const next=!!value;if(next===opened)return;
    const restoreFocus=panel.contains(document.activeElement);
    opened=next;panel.hidden=!next;
    if(next){
      const frame=document.createElement('iframe');frame.title=TITLE+' · KOBTRAX · YouTube';
      frame.src='https://www.youtube-nocookie.com/embed/f-dUVYPt1Pk?autoplay=0&controls=1&playsinline=1';
      frame.allow='encrypted-media; fullscreen; picture-in-picture';frame.allowFullscreen=true;
      frame.referrerPolicy='strict-origin-when-cross-origin';screen.replaceChildren(frame);layout();
      if(source)closeButton.focus({preventScroll:true});
    }else{
      // Removing the browsing context stops playback, including while its controls have focus.
      screen.replaceChildren();if(restoreFocus)launcher?.focus({preventScroll:true});
    }
    save();dispatchEvent(new CustomEvent('may-listening-change',{detail:{open:opened}}));
  }
  window.MayatnikListening={toggle:source=>setOpen(!opened,source),open:source=>setOpen(true,source),close:()=>setOpen(false),isOpen:()=>opened};
  addEventListener('resize',layout);window.visualViewport?.addEventListener('resize',layout);window.visualViewport?.addEventListener('scroll',layout);
  addEventListener('pagehide',()=>{screen?.replaceChildren();});
  addEventListener('pageshow',event=>{if(event.persisted&&opened){opened=false;setOpen(true);}});
  // Restore visibility, never a playback position or an automatic start.
  try{if(localStorage.getItem(KEY)==='1')setOpen(true);}catch(_){}
})();
