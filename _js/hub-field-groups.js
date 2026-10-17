/* Hub v0.205: sidebar, zen mode and nested field menus. */
(() => {
  'use strict';
  function initSidebar() {
    const menu=document.querySelector('.hub'),logo=document.getElementById('hubLogo');if(!menu||document.getElementById('hubSidebarToggle'))return;
    menu.id=menu.id||'hubSidebarMenu';
    let collapsed=false;try{collapsed=localStorage.getItem('zerk_hub_sidebar_collapsed')==='true';}catch(_){}
    const desktop=matchMedia('(min-width:1101px)'),toggle=document.createElement('button');
    toggle.id='hubSidebarToggle';toggle.type='button';toggle.setAttribute('aria-controls',menu.id);document.body.append(toggle);
    const sync=()=>{
      const hidden=desktop.matches&&collapsed;document.body.classList.toggle('hubSidebarCollapsed',hidden);
      if(logo){logo.inert=hidden;logo.setAttribute('aria-hidden',String(hidden));}
      toggle.textContent=hidden?'»':'«';toggle.setAttribute('aria-expanded',String(!hidden));
      toggle.title=hidden?'Развернуть левое меню':'Свернуть левое меню в ромбы';toggle.setAttribute('aria-label',toggle.title);
    };
    // Hub v0.249: в раскрытом меню ромб «« — внизу, под кнопками страниц, у самого края
    const place=()=>{if(!desktop.matches||collapsed){toggle.style.top='';return;}const last=[...menu.querySelectorAll('a.menu-btn')].pop(),b=last?last.getBoundingClientRect().bottom:0;toggle.style.top=Math.round(Math.min(innerHeight-48,Math.max(60,b+8)))+'px';};
    addEventListener('resize',place);setTimeout(place,300);setTimeout(place,1500);menu.addEventListener('scroll',place);
    toggle.onclick=()=>{collapsed=!collapsed;try{localStorage.setItem('zerk_hub_sidebar_collapsed',String(collapsed));}catch(_){}sync();place();};
    desktop.addEventListener('change',()=>{sync();place();});sync();
  }
  function initZen() {
    if(document.getElementById('hubZenToggle'))return;
    const toggle=document.createElement('button');toggle.id='hubZenToggle';toggle.type='button';toggle.className='hubRhomb';toggle.textContent='Q\nДзен';toggle.setAttribute('aria-keyshortcuts','Q');toggle.setAttribute('aria-pressed','false');toggle.setAttribute('aria-label','Дзен-режим — Q');toggle.title='Дзен-режим — Q';document.body.append(toggle);
    let zen=false,previousScroll=0;
    const set=on=>{zen=on;document.body.classList.toggle('hubZen',zen);toggle.setAttribute('aria-pressed',String(zen));toggle.textContent=zen?'Q\nМеню':'Q\nДзен';toggle.title=zen?'Вернуть меню — Q или Escape':'Дзен-режим — Q';toggle.setAttribute('aria-label',toggle.title);if(zen){previousScroll=scrollY;if(matchMedia('(max-width:1100px)').matches)window.scrollTo(0,0);}else if(matchMedia('(max-width:1100px)').matches)window.scrollTo(0,previousScroll);toggle.focus({preventScroll:true});};
    toggle.onclick=()=>set(!zen);
    window.HubZen={snapshot:()=>({zen,previousScroll}),restore:s=>{set(!!s.zen);previousScroll=s.previousScroll||0;}};
    document.addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select,[contenteditable]:not([contenteditable=false])'))return;if(e.code==='KeyQ'||e.key.toLowerCase()==='q'){e.preventDefault();set(!zen);}else if(zen&&e.key==='Escape'){e.preventDefault();set(false);}});
  }
  function init() { initSidebar();initZen();window.HubNestedGroups.init(); }
  // Existing modules populate the toolbar during DOMContentLoaded.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0), { once: true });
  else setTimeout(init, 0);
})();
