/* ПОМ-001. Local documentation assistant. Model text is never executable markup. */
(() => {
  'use strict';
  const init = async () => {
    if (document.getElementById('mayAssistantLauncher')) return;
    const endpoint = 'http://127.0.0.1:11435';
    const undoKey = 'zerk_may_assistant_undo_v1';
    const node = (tag, cls, text) => {
      const el = document.createElement(tag); if (cls) el.className = cls;
      if (text !== undefined) el.textContent = text; return el;
    };
    const button = (text, title) => {
      const el = node('button', 'ma-button'); el.type = 'button';
      el.title = title; el.setAttribute('aria-label', title);
      const frame = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      frame.setAttribute('viewBox', '0 0 120 24'); frame.setAttribute('aria-hidden', 'true');
      for (const [cls, d] of [['ma-face','M12 .5H108L119.3 12 108 23.5H12L.7 12Z'],['ma-sides','M12 .5L.7 12 12 23.5M108 .5L119.3 12 108 23.5']]) {
        const path = document.createElementNS(frame.namespaceURI, 'path');
        path.setAttribute('class', cls); path.setAttribute('d', d); frame.append(path);
      }
      el.append(frame, node('span', '', text)); return el;
    };
    const launcher = button('✧ Помощнкъ', 'Локальный помощник: объяснить кнопки и подобрать настройки');
    launcher.id = 'mayAssistantLauncher'; launcher.setAttribute('aria-expanded','false');
    launcher.setAttribute('aria-controls','mayAssistant');
    const panel = node('section'); panel.id = 'mayAssistant'; panel.hidden = true;
    panel.setAttribute('role','region'); panel.setAttribute('aria-labelledby','ma-title');
    const header = node('div','ma-header'), heading = node('h2','','Помощник Маятника'); heading.id='ma-title';
    const close = button('× Закрыть', 'Закрыть помощника'); header.append(heading,close);
    const intro = node('p','ma-intro','Спроси про кнопку или опиши желаемый вид. Изменения сначала покажу — применишь, когда захочешь.');
    const status = node('p','ma-status','Подключение проверяется при открытии.'); status.setAttribute('role','status');
    const connection = node('details','ma-connection'); connection.append(node('summary','','Подключение на этом компьютере'));
    connection.append(node('p','','Для работы нужен запущенный локальный помощник. Если браузер спросит доступ к локальной сети, разреши его для Зеркалиуса.'));
    const local = node('a','','Открыть локальный Маятник'); local.href=endpoint+'/mayatnik/Zerkalius-mayatnik.html?assistant=1';
    local.target='_blank'; local.rel='noopener'; connection.append(local);
    connection.append(node('p','','В локальной странице отдельные настройки браузера. Сохранённый рисунок можно перенести обычным экспортом и открытием файла.'));
    const guide=node('a','','Инструкция запуска');guide.href='https://github.com/MIkhailNkmnme/Binary-Drum-Machine/blob/main/tools/local-assistant/README.md';guide.target='_blank';guide.rel='noopener';connection.append(guide);
    const retry=button('↻ Связь', 'Проверить подключение');connection.append(retry);
    const modes=node('div','ma-actions');modes.setAttribute('role','group');modes.setAttribute('aria-label','Режим помощника');
    const explain=button('? Объясни','Объяснить по документации'), settings=button('◇ Подбери','Предложить настройки');modes.append(explain,settings);
    const examples=node('div','ma-examples');
    const history=node('div','ma-history');history.setAttribute('aria-live','polite');history.setAttribute('aria-relevant','additions');
    const proposal=node('div','ma-proposal');proposal.hidden=true;
    const undo=button('↶ Отмена','Отменить последние настройки помощника');undo.hidden=true;
    const form=node('form','ma-form'),label=node('label','','Что хочется сделать?');
    const input=node('textarea');input.id='ma-question';input.rows=3;input.maxLength=3000;
    input.placeholder='Например: хочу медленное движение, золотые единицы и тёмно-синие нули';label.htmlFor=input.id;
    const formActions=node('div','ma-actions'),send=button('✧ Спросить','Отправить вопрос локальной модели'),cancel=button('■ Стоп','Прекратить ожидание ответа');send.type='submit';cancel.hidden=true;formActions.append(send,cancel,undo);
    form.append(label,input,formActions);
    panel.append(header,intro,status,connection,modes,examples,history,proposal,form);
    document.body.append(launcher,panel);
    let controls=[],byId=new Map(),mode='explain',busy=false,controller=null,turns=[],undoRecord=null,available=false;
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
    const say=(text,error=false)=>{status.textContent=text;status.classList.toggle('ma-error',error);};
    const setBusy=value=>{busy=value;send.disabled=value||!controls.length;input.disabled=value;cancel.hidden=!value;settings.disabled=explain.disabled=value;retry.disabled=value;undo.disabled=value;panel.setAttribute('aria-busy',String(value));};
    async function request(path,options={},timeout=8000){
      const abort=options.signal?null:new AbortController(),timer=abort?setTimeout(()=>abort.abort(),timeout):null;
      try{const response=await fetch(endpoint+path,{...options,signal:options.signal||abort.signal,credentials:'omit',cache:'no-store'});
        const data=await response.json();if(!response.ok)throw new Error(data.error||data.message||'Локальный сервис не смог ответить.');return data;
      }finally{if(timer)clearTimeout(timer);}
    }
    async function health(){
      say('Проверяю локальный помощник…');
      try{const data=await request('/api/health');available=data.available===true;
        say(available?`На этом компьютере · ${data.model||'локальная модель'}`:(data.error||data.message||'Сервис работает, но модель пока недоступна.'),!available);
        if(!available)connection.open=true;
      }catch(_){available=false;connection.open=true;say('Нет связи с локальным помощником. Запусти «Помощник Зеркалиуса» на рабочем столе или открой инструкцию подключения.',true);}
    }
    function chooseMode(value){mode=value;explain.setAttribute('aria-pressed',String(mode==='explain'));settings.setAttribute('aria-pressed',String(mode==='settings'));examples.replaceChildren();
      const prompts=mode==='explain'?['Чем отличаются скорость × и время t?','Как найти нужную кнопку?','Как сохранить мой рисунок?']:['Сделай движение медленнее','Золотые единицы и тёмно-синие нули','Покажи геометрический центр'];
      for(const text of prompts){const b=node('button','ma-example',text);b.type='button';b.addEventListener('click',()=>{input.value=text;input.focus();});examples.append(b);}
    }
    function open(){panel.hidden=false;launcher.setAttribute('aria-expanded','true');try{localStorage.setItem('zerk_may_assistant_open','1');}catch(_){}input.focus();health();}
    function hide(){panel.hidden=true;launcher.setAttribute('aria-expanded','false');try{localStorage.setItem('zerk_may_assistant_open','0');}catch(_){}launcher.focus();}
    launcher.addEventListener('click',()=>panel.hidden?open():hide());close.addEventListener('click',hide);
    explain.addEventListener('click',()=>chooseMode('explain'));settings.addEventListener('click',()=>chooseMode('settings'));retry.addEventListener('click',health);
    for(const type of ['pointerdown','pointerup','click','wheel','keyup'])panel.addEventListener(type,event=>event.stopPropagation());
    panel.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();hide();}if(event.target===input&&event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();form.requestSubmit();}});
    const addMessage=(who,text)=>{const article=node('article','ma-message');article.append(node('strong','',who),node('p','',text));history.append(article);while(history.children.length>12)history.firstElementChild.remove();article.scrollIntoView({block:'nearest'});return article;};
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
      const apply=button('✓ Применить','Применить показанные настройки'),dismiss=button('× Отложить','Скрыть предложение без изменений'),actions=node('div','ma-actions');actions.append(apply,dismiss);
      proposal.append(list,node('p','ma-note','Построение, очистка и запуск анимации не выполняются. Последнее применение можно отменить.'),actions);
      dismiss.addEventListener('click',()=>{proposal.hidden=true;proposal.replaceChildren();});
      apply.addEventListener('click',()=>{
        try{
          if(busy)throw new Error('Дождитесь окончания ответа.');
          const now=snapshot();for(const {id}of changes)if(!Object.hasOwn(baseline,id)||now[id]!==baseline[id])throw new Error('Эта настройка изменилась после запроса. Попросите новый подбор для текущего поля.');
          const result=bridge().apply(changes);rememberUndo({before:result.before,after:Object.fromEntries(changes.map(({id})=>[id,result.after[id]]))});
          proposal.hidden=true;proposal.replaceChildren();say('Настройки применены. Можно отменить последнее применение.');
        }catch(error){say(error.message,true);}
      });
    }
    undo.addEventListener('click',()=>{
      try{
        if(busy||!undoRecord)return;
        const now=snapshot(),entries=Object.entries(undoRecord.before||{});
        if(!entries.length||entries.some(([id,value])=>!valid(byId.get(id),value)))throw new Error('Сохранённая отмена не подходит к этой версии.');
        if(entries.some(([id])=>now[id]!==undoRecord.after?.[id]))throw new Error('После применения эти настройки изменены вручную. Отмена остановлена, чтобы сохранить ваши изменения.');
        bridge().apply(entries.map(([id,value])=>({id,value})));rememberUndo(null);say('Предыдущие настройки восстановлены.');
      }catch(error){say(error.message,true);}
    });
    cancel.addEventListener('click',()=>controller?.abort());
    form.addEventListener('submit',async event=>{
      event.preventDefault();const message=input.value.trim();if(!message||busy||!controls.length)return;
      if(mode==='settings'&&!bridge()?.ready()){say('Дождитесь загрузки поля Маятника. Пока можно спросить в режиме «Объясни».',true);return;}
      const requestMode=mode,baseline=snapshot();proposal.replaceChildren();proposal.hidden=true;
      addMessage('Ты',message);setBusy(true);say('Читаю документацию и готовлю ответ. Первый ответ может занять больше времени…');
      controller=new AbortController();const timer=setTimeout(()=>controller?.abort(),200000);
      try{
        const data=await request('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({message,mode:requestMode,state:baseline,history:turns.slice(-4).map(item=>({role:item.role,content:item.content.slice(-2000)}))})});
        if(typeof data.answer!=='string'||!data.answer.trim())throw new Error('Модель вернула пустой ответ.');
        const article=addMessage('Помощник',data.answer);sources(article,data.sources);
        turns.push({role:'user',content:message},{role:'assistant',content:data.answer.slice(0,4000)});turns=turns.slice(-6);
        say(`Ответ готов · ${data.model||'локальная модель'}. Настройки пока не изменены.`);
        if(requestMode==='settings')showProposal(data.changes,baseline);
        input.value='';available=true;
      }catch(error){
        say(error.name==='AbortError'?'Ожидание остановлено. Настройки не изменены. Модель может ещё завершать запрос.':(error.message==='Failed to fetch'?'Не удалось связаться с помощником. Проверь подключение или открой локальный Маятник.':error.message),true);
      }finally{clearTimeout(timer);controller=null;setBusy(false);if(!panel.hidden)input.focus();}
    });
    chooseMode('explain');setBusy(false);
    try{const response=await fetch('assistant-controls.json?v=1051',{cache:'no-store'});if(!response.ok)throw new Error();const data=await response.json();if(data.version!==1||!Array.isArray(data.controls)||!data.controls.length)throw new Error();controls=data.controls;byId=new Map(controls.map(rule=>[rule.id,rule]));setBusy(false);if(undoRecord)undo.hidden=false;}
    catch(_){say('Не удалось загрузить список настроек. Обновите страницу.',true);send.disabled=true;}
    let restore=false;try{restore=localStorage.getItem('zerk_may_assistant_open')==='1';}catch(_){}
    if(restore||new URL(location.href).searchParams.get('assistant')==='1')open();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
