(function(root){
  'use strict';
  const doc=root.document;
  let panel,closeButton,figureList,includedLabel,empty,name,library,saveButton,openButton,play,stop,drag,palette,split,status,swatches;
  let editButtons=[],rows=new Map(),included=new Set(),known=new Set(),libraryKey='',pending=false,refreshFrame=0,returnFocus=null;

  function node(tag,className,text){
    const element=doc.createElement(tag);
    if(className)element.className=className;
    if(text)element.textContent=text;
    return element;
  }
  function button(label,title,click,style='gz-hx',icon){
    const control=node('button',style);
    control.type='button';control.title=title;control.setAttribute('aria-label',title);
    if(icon&&root.ZerkMenuIcons){
      control.dataset.miIcon=icon;
      const image=node('span','may-compose-icon');
      image.style.maskImage=root.ZerkMenuIcons.iconFor(control);
      image.setAttribute('aria-hidden','true');control.append(image);
    }
    const caption=root.HubButtonText?.shortCaption(label)||label;
    control.append(node('span','may-compose-caption',caption));
    control.addEventListener('click',click);
    return control;
  }
  function pair(left,right){
    const group=node('div','gz-hx gz-pair gz-split');
    group.append(left,right);return group;
  }
  function hasPanel(){return panel&&!panel.hidden;}
  function tell(message){status.textContent=message;}
  function pressed(button,on){
    button.classList.toggle('gz-on',on);
    button.setAttribute('aria-pressed',String(on));
  }
  function close(){
    if(!hasPanel())return;
    panel.hidden=true;
    if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
  }
  function selectedIds(){return [...included];}
  async function run(action,onSuccess){
    if(pending)return;
    const focus=doc.activeElement;
    pending=true;tell('');refresh();
    try{
      const result=await action(root.mayCompositionHost);
      if(!result)tell('Действие сейчас недоступно. Проверьте поле и выделение.');
      else onSuccess?.(result);
    }catch(error){tell(error?.message||String(error));}
    finally{
      pending=false;
      if(hasPanel()){
        render();
        if(doc.activeElement===doc.body&&focus?.isConnected&&!focus.disabled)focus.focus({preventScroll:true});
      }
    }
  }
  function currentAction(command){
    const id=root.mayCompositionHost.snapshot().active;
    if(id)run(host=>host.action(id,command));
  }
  function operation(label,title,command,half,icon){
    const control=button(label,title,()=>currentAction(command),half?'gz-half '+half:undefined,icon);
    editButtons.push(control);return control;
  }
  function addRow(id){
    const li=node('li','may-compose-row'),check=node('input'),choose=button('', 'Выбрать фигуру',()=>run(host=>host.select(id)));
    const label=choose.querySelector('.may-compose-caption');
    label.dataset.userLabel='';
    check.type='checkbox';
    check.addEventListener('change',()=>{
      if(check.checked)included.add(id);else included.delete(id);
      render();
    });
    li.append(check,choose);
    return {li,check,choose,label};
  }
  function inputRow(label,control,action){
    const row=node('div','may-compose-input-row'),caption=node('label','may-compose-field');
    caption.append(node('span','',label),control);row.append(caption,action);
    return row;
  }
  function make(){
    if(panel)return;
    panel=node('section','may-compose-editor');panel.hidden=true;
    panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','mayComposeTitle');panel.setAttribute('aria-modal','false');
    const head=node('div','may-compose-head'),title=node('h2','','Редактор композиций');
    title.id='mayComposeTitle';
    closeButton=button('Закрыть','Закрыть редактор композиций',close,undefined,'cross');
    head.append(title,closeButton);
    includedLabel=node('p','may-compose-count');
    figureList=node('ul','may-compose-figures');figureList.setAttribute('aria-label','Фигуры на поле');
    empty=node('p','may-compose-empty','Добавьте фигуры на поле из Битотеки.');
    const toolset=node('div','may-compose-controls');
    const vertical=pair(operation('↑','Сместить выбранную фигуру вверх','up','gz-h0'),operation('↓','Сместить выбранную фигуру вниз','down','gz-h1'));
    const horizontal=pair(operation('←','Сместить выбранную фигуру влево','shiftLeft','gz-h0'),operation('→','Сместить выбранную фигуру вправо','shiftRight','gz-h1'));
    const flips=pair(operation('↔','Отразить выбранную фигуру слева направо','flipH','gz-h0'),operation('↕','Отразить выбранную фигуру сверху вниз','flipV','gz-h1'));
    const turns=pair(operation('↶ 90°','Повернуть выбранную фигуру на 90° против часовой стрелки','quarterLeft','gz-h0'),operation('90° ↷','Повернуть выбранную фигуру на 90° по часовой стрелке','quarterRight','gz-h1'));
    drag=button('Двигать','Переключить перетаскивание шаблонов на поле',()=>run(host=>host.toggleDrag()),undefined,'axes');
    palette=button('0 / 1','Изменить цвета битов 0 и 1 выбранной фигуры',()=>currentAction('axis512Palette'));
    swatches=['0','1'].map(bit=>{
      const swatch=node('span','may-compose-swatch');
      swatch.setAttribute('aria-hidden','true');swatch.title='Бит '+bit;palette.append(swatch);return swatch;
    });
    split=button('Разобрать','Разобрать выбранный сборный шаблон на фигуры',()=>currentAction('split'),undefined,'slit');
    toolset.append(vertical,horizontal,flips,turns,drag,palette,split);
    name=node('input');name.type='text';name.maxLength=100;
    name.addEventListener('input',()=>render());
    const save=()=>run(host=>host.save(selectedIds(),name.value.trim()),result=>{
      library.value=result.id;
      tell(result.message);
      render(result.id);
    });
    saveButton=button('Сохранить','Сохранить отмеченные фигуры как сборку в Битотеке',save,undefined,'save');
    name.addEventListener('keydown',event=>{if(event.key==='Enter'&&!saveButton.disabled){event.preventDefault();save();}});
    library=node('select');
    library.addEventListener('change',()=>render());
    openButton=button('На поле','Добавить копию сохранённой сборки на поле',()=>{
      run(host=>host.reopen(library.value),result=>{
        included=new Set(result.ids);
        known=new Set(root.mayCompositionHost.snapshot().items.map(item=>item.id));
        name.value=result.name;tell('Сборка добавлена на поле · фигур '+result.ids.length);
      });
    },undefined,'load');
    play=button('Плей','Запустить анимацию Маятника с отмеченными фигурами',()=>run(host=>host.play(selectedIds())),'gz-half gz-h0','play');
    stop=button('Стоп','Остановить анимацию Маятника',()=>run(host=>host.stop()),'gz-half gz-h1','pause');
    status=node('output','may-compose-status');status.setAttribute('role','status');
    panel.append(head,includedLabel,figureList,empty,toolset,inputRow('Имя сборки',name,saveButton),
      inputRow('Сохранённые сборки',library,openButton),pair(play,stop),status);
    panel.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();close();}
      event.stopPropagation();
    });
    doc.body.append(panel);
  }
  function render(libraryId=library.value){
    if(!hasPanel())return;
    const snapshot=root.mayCompositionHost.snapshot(),active=snapshot.items.find(item=>item.id===snapshot.active);
    const ids=new Set(snapshot.items.map(item=>item.id)),locked=pending||snapshot.busy||!snapshot.ready;
    for(const id of included)if(!ids.has(id))included.delete(id);
    for(const [id,row] of rows)if(!ids.has(id)){row.li.remove();rows.delete(id);}
    for(const [i,item] of snapshot.items.entries()){
      if(!known.has(item.id))included.add(item.id);
      if(!rows.has(item.id))rows.set(item.id,addRow(item.id));
      const row=rows.get(item.id),label='Выбрать фигуру '+item.name;
      row.check.checked=included.has(item.id);row.check.disabled=locked;row.check.setAttribute('aria-label','Включить в сборку фигуру '+item.name);
      row.choose.disabled=locked;
      if(row.choose.title!==label){
        row.choose.title=label;row.choose.setAttribute('aria-label',label);row.label.textContent=item.name;
      }
      pressed(row.choose,item===active);
      if(figureList.children[i]!==row.li)figureList.insertBefore(row.li,figureList.children[i]||null);
    }
    known=ids;
    figureList.hidden=!rows.size;empty.hidden=!!rows.size;
    const count='В сборке '+included.size+' из '+rows.size;
    if(includedLabel.textContent!==count)includedLabel.textContent=count;
    for(const control of editButtons)control.disabled=locked||!active;
    palette.disabled=locked||!active?.palette;
    for(const [i,swatch] of swatches.entries())swatch.style.backgroundColor=active?.palette?.[i?'one':'zero']||'transparent';
    split.disabled=locked||!active?.compound;
    drag.disabled=locked;pressed(drag,snapshot.dragging);
    const key=JSON.stringify(snapshot.library);
    if(key!==libraryKey){
      libraryKey=key;
      const options=[new Option(snapshot.library.length?'Выбрать сборку':'Сборок пока нет','')];
      for(const entry of snapshot.library)options.push(new Option(entry.name,entry.id));
      library.replaceChildren(...options);
      if(snapshot.library.some(entry=>entry.id===libraryId))library.value=libraryId;
    }
    library.disabled=locked||!snapshot.library.length;openButton.disabled=library.disabled||!library.value;
    saveButton.disabled=locked||!included.size||!name.value.trim();
    play.disabled=locked||!included.size;stop.disabled=pending||!snapshot.playing;
  }
  function refresh(){
    if(hasPanel()&&!refreshFrame)refreshFrame=root.requestAnimationFrame(()=>{
      refreshFrame=0;render();
    });
  }
  doc.getElementById('bTemplateDrag')?.addEventListener('click',refresh);
  root.mayCompositionEditor={
    open(){
      if(!root.mayCompositionHost)return false;
      make();
      if(!hasPanel())returnFocus=doc.activeElement;
      panel.hidden=false;render();closeButton.focus({preventScroll:true});
      return true;
    },
    close,refresh
  };
})(window);
