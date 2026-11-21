/* ПОМ-002. Movable local assistant with pointer ownership over overlapping menus. */
(() => {
  'use strict';
  const init = async () => {
    if (document.getElementById('mayAssistantLauncher')) return;
    const endpoint = 'http://127.0.0.1:11435';
    const page='mayatnik',knowledgeVersion='page-actions-v2';
    const undoKey = 'zerk_may_assistant_undo_v1';
    const node = (tag, cls, text) => {
      const el = document.createElement(tag); if (cls) el.className = cls;
      if (text !== undefined) el.textContent = text; return el;
    };
    const button = (text, title) => {
      const el = node('button', 'ma-button'); el.type = 'button';
      el.title = title; el.setAttribute('aria-label', title);
      const frame = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      frame.setAttribute('viewBox', '0 0 28 28'); frame.setAttribute('aria-hidden', 'true');
      for (const [cls, d] of [['ma-face','M14 .7L27.3 14 14 27.3 .7 14Z'],['ma-sides','M7 7L.7 14 7 21M21 7L27.3 14 21 21']]) {
        const path = document.createElementNS(frame.namespaceURI, 'path');
        path.setAttribute('class', cls); path.setAttribute('d', d); frame.append(path);
      }
      el.append(frame, node('span', '', text)); return el;
    };
    const launcher = button('✧', 'Локальный помощник: объяснить кнопки и подобрать настройки');
    launcher.id = 'mayAssistantLauncher'; launcher.setAttribute('aria-expanded','false');
    launcher.setAttribute('aria-controls','mayAssistant');
    const panel = node('section'); panel.id = 'mayAssistant'; panel.hidden = true;
    panel.setAttribute('role','region'); panel.setAttribute('aria-labelledby','ma-title');
    const header = node('div','ma-header'), heading = node('h2','ma-sr','Помощник Маятника'); heading.id='ma-title';
    const close = button('×', 'Закрыть помощника'),gear=button('⚙','Подключение локального помощника');gear.setAttribute('aria-expanded','false');
    const status = node('p','ma-status'); status.hidden=true;status.setAttribute('role','status');
    const connection = node('div','ma-connection');connection.hidden=true;connection.id='ma-connection';gear.setAttribute('aria-controls',connection.id);
    function showConnection(value){connection.hidden=!value;gear.setAttribute('aria-expanded',String(value));}
    gear.addEventListener('click',()=>showConnection(connection.hidden));
    connection.append(node('p','','Для работы нужен запущенный локальный помощник. Если браузер спросит доступ к локальной сети, разреши его для Зеркалиуса.'));
    const local = node('a','','Открыть локальный Маятник'); local.href=endpoint+'/mayatnik/Zerkalius-mayatnik.html?assistant=1';
    local.target='_blank'; local.rel='noopener'; connection.append(local);
    connection.append(node('p','','В локальной странице отдельные настройки браузера. Сохранённый рисунок можно перенести обычным экспортом и открытием файла.'));
    const guide=node('a','','Инструкция запуска');guide.href='https://github.com/MIkhailNkmnme/Binary-Drum-Machine/blob/main/tools/local-assistant/README.md';guide.target='_blank';guide.rel='noopener';connection.append(guide);
    const retry=button('↻', 'Проверить подключение');connection.append(retry);
    const modes=node('div','ma-actions');modes.setAttribute('role','group');modes.setAttribute('aria-label','Режим помощника');
    const explain=button('?','Объяснить по документации'), settings=button('◇','Предложить настройки или разовое действие');modes.append(explain,settings);
    header.append(heading,node('span','ma-grip','⠿'),modes,gear,close);
    const history=node('div','ma-history');history.hidden=true;history.setAttribute('aria-live','polite');history.setAttribute('aria-relevant','additions');
    const proposal=node('div','ma-proposal');proposal.hidden=true;
    const undo=button('↶','Отменить последние настройки помощника');undo.hidden=true;
    const form=node('form','ma-form'),label=node('label','ma-sr','Вопрос помощнику');
    const input=node('textarea');input.id='ma-question';input.rows=2;input.maxLength=3000;
    input.placeholder='Спроси или опиши, что изменить…';label.htmlFor=input.id;
    const formActions=node('div','ma-actions'),send=button('↑','Отправить вопрос локальной модели'),cancel=button('■','Прекратить ожидание ответа');send.type='submit';cancel.hidden=true;formActions.append(send,cancel,undo);
    form.append(label,input,formActions);
    panel.append(header,status,connection,history,proposal,form);
    document.body.append(launcher,panel);
    // Preserve the surface from which a pointer entered the overlap. Raising a
    // hidden menu by outline geometry must not steal an in-progress interaction.
    const positionKey='zerk_may_assistant_position_v1';
    let position=null,front=false,heldPointer=null,drag=null;
    try{const saved=JSON.parse(localStorage.getItem(positionKey)||'null');if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y))position=saved;}catch(_){}
    const setFront=value=>{front=!!value&&!panel.hidden;panel.classList.toggle('ma-front',front);};
    const insidePanel=event=>{if(panel.hidden)return false;const r=panel.getBoundingClientRect();return r.width>0&&r.height>0&&event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom;};
    window.mayAssistantSurface={blocksPointer(event,target,currentMenu){
      if(panel.hidden){setFront(false);return false;}
      if(drag||heldPointer===event.pointerId){setFront(true);return true;}
      const inside=insidePanel(event);
      // Coming from a menu keeps that menu through its own outline gaps too.
      if(inside&&!front&&currentMenu&&window.ZerkMenuGroupFocus?.outlineOwner([currentMenu],event.clientX,event.clientY,currentMenu)===currentMenu)return false;
      if(inside&&(front||panel.contains(target))){setFront(true);return true;}
      setFront(false);return false;
    }};
    const viewport=()=>{const v=window.visualViewport;return {x:v?.offsetLeft||0,y:v?.offsetTop||0,width:v?.width||innerWidth,height:v?.height||innerHeight};};
    const persistPosition=()=>{try{if(position)localStorage.setItem(positionKey,JSON.stringify(position));else localStorage.removeItem(positionKey);}catch(_){}};
    function placeWindow(x,y,persist=false){
      if(panel.hidden)return;
      const v=viewport();panel.style.maxHeight=Math.max(64,Math.min(440,v.height-12))+'px';
      const r=panel.getBoundingClientRect(),left=Math.max(v.x+6,Math.min(x,v.x+v.width-r.width-6)),top=Math.max(v.y+6,Math.min(y,v.y+v.height-r.height-6));
      position={x:Math.round(left),y:Math.round(top)};
      panel.style.left=position.x+'px';panel.style.top=position.y+'px';panel.style.right='auto';panel.style.bottom='auto';
      if(persist)persistPosition();
    }
    function fitWindow(){if(panel.hidden)return;const v=viewport();panel.style.maxHeight=Math.max(64,Math.min(440,v.height-12))+'px';if(position)placeWindow(position.x,position.y);}
    function finishDrag(event){
      if(drag&&event?.pointerId!==undefined&&event.pointerId!==drag.id)return;
      const previous=drag;drag=null;heldPointer=null;header.classList.remove('ma-dragging');
      if(previous){try{if(header.hasPointerCapture(previous.id))header.releasePointerCapture(previous.id);}catch(_){}if(previous.moved)persistPosition();}
      setFront(!!event&&insidePanel(event));
    }
    header.tabIndex=0;header.setAttribute('role','group');
    header.setAttribute('aria-label','Перемещение помощника: перетащите заголовок или используйте стрелки; Home возвращает исходное место');
    header.title='Перетащите за заголовок. С клавиатуры: стрелки, Shift — точнее; Home — исходное место.';
    header.addEventListener('pointerdown',event=>{
      if(event.button!==0||event.isPrimary===false||event.target.closest('button,a,input,textarea,select'))return;
      const r=panel.getBoundingClientRect();drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:r.left,top:r.top,moved:false};
      heldPointer=event.pointerId;setFront(true);header.classList.add('ma-dragging');
      header.setPointerCapture(event.pointerId);event.preventDefault();event.stopPropagation();
    });
    header.addEventListener('pointermove',event=>{
      if(!drag||event.pointerId!==drag.id)return;
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      if(!drag.moved&&Math.hypot(dx,dy)<3)return;
      drag.moved=true;placeWindow(drag.left+dx,drag.top+dy);event.preventDefault();event.stopPropagation();
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])header.addEventListener(type,event=>{if(drag&&event.pointerId===drag.id)finishDrag(event);});
    header.addEventListener('keydown',event=>{
      if(event.target!==header)return;
      const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
      if(!delta&&event.key!=='Home')return;
      event.preventDefault();event.stopPropagation();setFront(true);
      if(event.key==='Home'){position=null;for(const key of ['left','top','right','bottom'])panel.style.removeProperty(key);persistPosition();fitWindow();return;}
      const r=panel.getBoundingClientRect(),step=event.shiftKey?1:10;placeWindow(r.left+delta[0]*step,r.top+delta[1]*step,true);
    });
    document.addEventListener('pointerdown',event=>{if(!panel.hidden&&panel.contains(event.target)){heldPointer=event.pointerId;setFront(true);}},true);
    for(const type of ['pointerup','pointercancel'])document.addEventListener(type,event=>{if(heldPointer===event.pointerId&&!drag){heldPointer=null;setFront(type==='pointerup'&&insidePanel(event));}},true);
    panel.addEventListener('focusin',()=>setFront(true));
    window.addEventListener('blur',()=>finishDrag());
    window.addEventListener('resize',fitWindow);window.visualViewport?.addEventListener('resize',fitWindow);window.visualViewport?.addEventListener('scroll',fitWindow);
    if(window.ResizeObserver)new ResizeObserver(fitWindow).observe(panel);
    let controls=[],byId=new Map(),actionById=new Map(),mode='explain',busy=false,controller=null,turns=[],undoRecord=null,available=false;
    try{undoRecord=JSON.parse(localStorage.getItem(undoKey)||'null');}catch(_){}
    const bridge=()=>window.mayAssistantControls;
    const valid=(rule,value)=>{
      if(!rule)return false;
      if(rule.type==='number')return typeof value==='number'&&Number.isFinite(value)&&value>=rule.min&&value<=rule.max&&Math.abs((value-rule.min)/(rule.step||1)-Math.round((value-rule.min)/(rule.step||1)))<1e-8;
      if(rule.type==='boolean')return typeof value==='boolean';
      if(rule.type==='color')return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
      return rule.type==='select'&&rule.options.some(option=>option.value===value);
    };
    const snapshot=()=>Object.fromEntries(Object.entries(bridge()?.snapshot()||{}).filter(([id,value])=>valid(byId.get(id),value)));
    const display=(rule,value)=>rule.type==='boolean'?(value?'включено':'выключено'):rule.id==='frameT'?`${(value*.05).toFixed(2)} с`:rule.type==='select'?(rule.options.find(o=>o.value===value)?.label||value):String(value);
    const rememberUndo=record=>{undoRecord=record;undo.hidden=!record;try{if(record)localStorage.setItem(undoKey,JSON.stringify(record));else localStorage.removeItem(undoKey);}catch(_){}};
    const say=(text,error=false,notice=false)=>{status.textContent=text;status.hidden=!error&&!notice;status.classList.toggle('ma-error',error);};
    const setBusy=(value,allowCancel=true)=>{busy=value;send.disabled=value||!controls.length;input.disabled=value;cancel.hidden=!value||!allowCancel;settings.disabled=explain.disabled=value;retry.disabled=value;undo.disabled=value;panel.setAttribute('aria-busy',String(value));send.setAttribute('aria-busy',String(value));};
    async function request(path,options={},timeout=8000){
      const abort=options.signal?null:new AbortController(),timer=abort?setTimeout(()=>abort.abort(),timeout):null;
      try{const response=await fetch(endpoint+path,{...options,signal:options.signal||abort.signal,credentials:'omit',cache:'no-store'});
        const data=await response.json();if(!response.ok)throw new Error(data.error||data.message||'Локальный сервис не смог ответить.');return data;
      }finally{if(timer)clearTimeout(timer);}
    }
    async function health(){
      say('Проверяю локальный помощник…');
      try{const data=await request('/api/health');available=data.available===true;
        if(data.knowledge_version!==knowledgeVersion){available=false;showConnection(true);say('Перезапустите локальный сервис помощника: требуется текущая версия.',true);return;}
        say(available?`На этом компьютере · ${data.model||'локальная модель'}`:(data.error||data.message||'Сервис работает, но модель пока недоступна.'),!available);
        if(!available)showConnection(true);
      }catch(_){available=false;showConnection(true);say('Нет связи с локальным помощником. Запусти «Помощник Зеркалиуса» на рабочем столе или открой инструкцию подключения.',true);}
    }
    function chooseMode(value){mode=value;explain.setAttribute('aria-pressed',String(mode==='explain'));settings.setAttribute('aria-pressed',String(mode==='settings'));}
    function open(){panel.hidden=false;fitWindow();setFront(true);launcher.setAttribute('aria-expanded','true');try{localStorage.setItem('zerk_may_assistant_open','1');}catch(_){}input.focus();health();}
    function hide(){finishDrag();panel.hidden=true;setFront(false);launcher.setAttribute('aria-expanded','false');try{localStorage.setItem('zerk_may_assistant_open','0');}catch(_){}launcher.focus();}
    launcher.addEventListener('click',()=>panel.hidden?open():hide());close.addEventListener('click',hide);
    explain.addEventListener('click',()=>chooseMode('explain'));settings.addEventListener('click',()=>chooseMode('settings'));retry.addEventListener('click',health);
    for(const type of ['pointerdown','pointerup','click','wheel','keyup'])panel.addEventListener(type,event=>event.stopPropagation());
    panel.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();hide();}if(event.target===input&&event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();form.requestSubmit();}});
    const addMessage=(who,text)=>{history.hidden=false;const article=node('article','ma-message');article.append(node('strong','ma-sr',who),node('p','',text));history.append(article);while(history.children.length>12)history.firstElementChild.remove();article.scrollIntoView({block:'nearest'});return article;};
    function sources(article,items){
      if(!Array.isArray(items))return;
      const list=node('div','ma-sources');
      for(const item of items.slice(0,8)){
        try{const url=new URL(item.url);if(url.origin!=='https://1001100.online'||url.pathname.includes('.local-secrets'))continue;
          const a=node('a','',String(item.title||'Документация'));a.href=url.href;a.target='_blank';a.rel='noopener';list.append(a);
        }catch(_){}
      }
      if(list.children.length)article.append(list);
    }
    function showProposal(items,baseline){
      proposal.replaceChildren();proposal.hidden=true;
      if(!Array.isArray(items)||!items.length)return;
      if(items.length>controls.length)throw new Error('Модель предложила слишком много изменений.');
      const seen=new Set(),changes=[];
      for(const item of items){
        if(!item||seen.has(item.id)||!valid(byId.get(item.id),item.value))throw new Error('Предложение не прошло проверку допустимых настроек. Ничего не изменено.');
        seen.add(item.id);if(baseline[item.id]!==item.value)changes.push({id:item.id,value:item.value,reason:String(item.reason||'')});
      }
      if(!changes.length){say('Предложенные настройки уже установлены.');return;}
      proposal.hidden=false;proposal.append(node('h3','','Предлагаемые изменения'));
      const list=node('ul');
      for(const change of changes){const rule=byId.get(change.id),li=node('li');li.append(node('strong','',rule.label+': '),node('span','',`${Object.hasOwn(baseline,change.id)?display(rule,baseline[change.id]):'специальный режим'} → ${display(rule,change.value)}`));if(change.reason)li.append(node('p','',change.reason));list.append(li);}
      const apply=button('✓','Применить показанные настройки'),dismiss=button('×','Скрыть предложение без изменений'),actions=node('div','ma-actions');actions.append(apply,dismiss);
      proposal.append(list,node('p','ma-note','Построение, очистка и запуск анимации не выполняются. Последнее применение можно отменить.'),actions);
      dismiss.addEventListener('click',()=>{proposal.hidden=true;proposal.replaceChildren();});
      apply.addEventListener('click',()=>{
        try{
          if(busy)throw new Error('Дождитесь окончания ответа.');
          const now=snapshot();for(const {id}of changes)if(!Object.hasOwn(baseline,id)||now[id]!==baseline[id])throw new Error('Эта настройка изменилась после запроса. Попросите новый подбор для текущего поля.');
          const result=bridge().apply(changes);rememberUndo({before:result.before,after:Object.fromEntries(changes.map(({id})=>[id,result.after[id]]))});
          proposal.hidden=true;proposal.replaceChildren();say('Настройки применены. ↶ — отменить.',false,true);
        }catch(error){say(error.message,true);}
      });
    }
    function showAction(action,token){
      proposal.replaceChildren();proposal.hidden=true;
      const rule=actionById.get(action?.id);
      if(!rule||action.id!=='paintAutoAxes'||typeof action.reason!=='string'||!action.reason.trim())throw new Error('Недоступное действие. Ничего не изменено.');
      if(typeof token!=='string'||!token||typeof bridge()?.runAction!=='function')throw new Error('Действие недоступно для текущего кадра. Обновите запрос.');
      proposal.hidden=false;proposal.append(node('h3','',rule.label),node('p','',action.reason),node('p','ma-note','Кадр остановится, автооси включатся. Текущий цвет «От осей», Область и Зеркально. Отмена — в Раскраске.'));
      const apply=button('✓','Подтвердить разовую раскраску от автоосей'),dismiss=button('×','Отказаться от раскраски'),row=node('div','ma-actions');row.append(apply,dismiss);proposal.append(row);
      dismiss.addEventListener('click',()=>{if(busy)return;proposal.hidden=true;proposal.replaceChildren();});
      apply.addEventListener('click',async()=>{
        if(busy)return;setBusy(true,false);apply.disabled=true;dismiss.disabled=true;say('');
        try{
          const result=await bridge().runAction(action.id,token);
          if(!result||!(typeof result.changed==='boolean'||(typeof result.changed==='number'&&Number.isFinite(result.changed)&&result.changed>=0)))throw new Error('Действие не вернуло результат. Проверьте текущий кадр.');
          proposal.hidden=true;proposal.replaceChildren();
          if(result.changed){rememberUndo(null);say(result.message||'Кадр раскрашен от автоосей. Отмена — в Раскраске.',false,true);}
          else say(result.message||result.reason||'Раскраска не изменилась.',false,true);
        }catch(error){proposal.hidden=true;proposal.replaceChildren();say(error.message||'Действие не завершено. Проверьте текущий кадр.',true);}
        finally{setBusy(false);apply.disabled=false;dismiss.disabled=false;}
      });
    }
    undo.addEventListener('click',()=>{
      try{
        if(busy||!undoRecord)return;
        const now=snapshot(),entries=Object.entries(undoRecord.before||{});
        if(!entries.length||entries.some(([id,value])=>!valid(byId.get(id),value)))throw new Error('Сохранённая отмена не подходит к этой версии.');
        if(entries.some(([id])=>now[id]!==undoRecord.after?.[id]))throw new Error('После применения эти настройки изменены вручную. Отмена остановлена, чтобы сохранить ваши изменения.');
        bridge().apply(entries.map(([id,value])=>({id,value})));rememberUndo(null);say('Предыдущие настройки восстановлены.',false,true);
      }catch(error){say(error.message,true);}
    });
    cancel.addEventListener('click',()=>controller?.abort());
    form.addEventListener('submit',async event=>{
      event.preventDefault();const message=input.value.trim();if(!message||busy||!controls.length)return;
      if(mode==='settings'&&!bridge()?.ready()){say('Дождитесь загрузки поля Маятника. Пока можно спросить в режиме «Объясни».',true);return;}
      const requestMode=mode,baseline=snapshot();let actionToken=null;
      try{if(requestMode==='settings')actionToken=bridge()?.actionContext?.()??null;}catch(error){say(error.message,true);return;}
      proposal.replaceChildren();proposal.hidden=true;
      addMessage('Ты',message);setBusy(true);say('Читаю документацию и готовлю ответ. Первый ответ может занять больше времени…');
      controller=new AbortController();const timer=setTimeout(()=>controller?.abort(),200000);
      try{
        const data=await request('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({page,history_page:page,knowledge_version:knowledgeVersion,message,mode:requestMode,state:baseline,history:turns.slice(-4).map(item=>({role:item.role,content:item.content.slice(-2000)}))})});
        if(data.page!==page||data.knowledge_version!==knowledgeVersion)throw new Error('Ответ относится к другой странице или прежней версии источников. Перезапустите локальный помощник.');
        if(typeof data.answer!=='string'||!data.answer.trim())throw new Error('Модель вернула пустой ответ.');
        const article=addMessage('Помощник',data.answer);sources(article,data.sources);
        turns.push({role:'user',content:message},{role:'assistant',content:data.answer.slice(0,4000)});turns=turns.slice(-6);
        say(`Ответ готов · ${data.model||'локальная модель'}. Настройки пока не изменены.`);
        if(requestMode==='settings'){
          if(!Array.isArray(data.changes)||!Array.isArray(data.actions)||data.actions.length>1||(data.actions.length&&data.changes.length))throw new Error('Ответ смешивает действия и настройки. Ничего не изменено.');
          if(data.actions.length)showAction(data.actions[0],actionToken);else showProposal(data.changes,baseline);
        }
        input.value='';available=true;
      }catch(error){
        say(error.name==='AbortError'?'Ожидание остановлено. Настройки не изменены. Модель может ещё завершать запрос.':(error.message==='Failed to fetch'?'Не удалось связаться с помощником. Проверь подключение или открой локальный Маятник.':error.message),true);
      }finally{clearTimeout(timer);controller=null;setBusy(false);if(!panel.hidden&&front&&heldPointer===null&&!drag)input.focus({preventScroll:true});}
    });
    chooseMode('explain');setBusy(false);
    try{const response=await fetch('assistant-controls.json?v=1054',{cache:'no-store'});if(!response.ok)throw new Error();const data=await response.json();if(data.version!==1||!Array.isArray(data.controls)||!data.controls.length||!Array.isArray(data.actions))throw new Error();controls=data.controls;byId=new Map(controls.map(rule=>[rule.id,rule]));actionById=new Map(data.actions.map(rule=>[rule.id,rule]));setBusy(false);if(undoRecord)undo.hidden=false;}
    catch(_){say('Не удалось загрузить список настроек. Обновите страницу.',true);send.disabled=true;}
    let restore=false;try{restore=localStorage.getItem('zerk_may_assistant_open')==='1';}catch(_){}
    if(restore||new URL(location.href).searchParams.get('assistant')==='1')open();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
