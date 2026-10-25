/* Shared backup dialog for the field and its detached library. */
(function(root){
 'use strict';const doc=root.document;let dialog,output,api,buttons=[],off,task=false;
 function make(){if(dialog)return;dialog=doc.createElement('dialog');dialog.id='mayBackupDialog';dialog.dataset.noMini='';dialog.setAttribute('aria-label','Полная копия Маятника');
  const heading=doc.createElement('h2');heading.textContent='ВСЁ В ОДИН ФАЙЛ';const description=doc.createElement('p');description.textContent='Все библиотеки, папки, слои, текущая работа, настройки и расположение меню. Восстановление заменяет данные Маятника и перезагружает страницу. Предыдущая копия остаётся в браузере для отката.';dialog.append(heading,description);
  const add=(label,title,run)=>{const b=doc.createElement('button');b.type='button';b.className='mtp-command';b.textContent=label;b.title=title;b.setAttribute('aria-label',title);b.onclick=()=>act(run);buttons.push(b);dialog.append(b);return b;};
  add('💾 Всё','Скачать полную резервную копию',save);
  const input=doc.createElement('input');input.type='file';input.accept='.mayatnik-backup,application/x-mayatnik-backup';input.hidden=true;input.onchange=()=>{const file=input.files[0];input.value='';if(file)act(()=>api.backup.restore(file,confirmation));};dialog.append(input);
  add('↑ Из файла','Восстановить всё из резервной копии',()=>input.click());
  add('↶ До импорта','Вернуть предыдущие данные после восстановления',async()=>{const previous=await api.support.read('recovery');if(!previous)throw Error('Предыдущей копии пока нет');return api.backup.restore(await api.codec.encode(previous),confirmation);});
  const recoveryDownload=add('↓ Копия отката','Скачать предыдущие данные отдельным файлом',async()=>{const previous=await api.support.read('recovery');if(!previous)throw Error('Копии отката пока нет');downloadBlob(await api.codec.encode(previous),'mayatnik-before-restore.mayatnik-backup');});recoveryDownload.dataset.backupRecovery='';
  const sub=doc.createElement('h3');sub.textContent='ФАЙЛ ОБЛАЧНОЙ ПАПКИ';dialog.append(sub);
  const help=doc.createElement('p');help.textContent='Выберите файл в папке Google Диска, OneDrive или другого установленного облачного приложения. Маятник читает и записывает файл, приложение облака переносит его между устройствами. Отправка и загрузка выполняются этими кнопками.';dialog.append(help);
  add('＋ Файл','Создать файл в облачной папке',async()=>{if(!root.showSaveFilePicker)throw Error('Выбор постоянного файла недоступен. Используйте «Всё» и «Из файла».');const handle=await root.showSaveFilePicker({suggestedName:'mayatnik-all.mayatnik-backup',types:[{description:'Копия Маятника',accept:{'application/octet-stream':['.mayatnik-backup']}}]});await api.file.connect(handle);return 'Файл подключён. Нажмите «В файл», чтобы записать копию.';});
  add('↔ Подключить','Подключить существующий файл облачной папки',async()=>{if(!root.showOpenFilePicker)throw Error('Выбор постоянного файла недоступен. Используйте «Всё» и «Из файла».');const [handle]=await root.showOpenFilePicker({multiple:false,types:[{description:'Копия Маятника',accept:{'application/octet-stream':['.mayatnik-backup']}}]});await api.file.connect(handle);return 'Файл подключён без перезаписи. Можно загрузить или отправить копию.';});
  add('↑ В файл','Записать все данные в подключённый файл',async()=>{const bytes=await api.file.push();return 'Файл записан · '+(bytes/1048576).toFixed(2)+' МиБ. Доставку в облако выполняет приложение синхронизации.';});
  add('↓ Из файла','Восстановить всё из подключённого файла',()=>api.file.pull(confirmation));
  add('× Отвязать','Забыть подключённый файл; сам файл остаётся',async()=>{await api.file.disconnect();return 'Файл отключён';});
  output=doc.createElement('output');output.setAttribute('role','status');dialog.append(output);
  const close=add('Закрыть','Закрыть окно резервной копии',()=>dialog.close());close.dataset.backupClose='';dialog.addEventListener('cancel',e=>{if(task||api?.backup.state().busy||api?.backup.state().terminal||api?.backup.state().restored)e.preventDefault();});
  doc.body.append(dialog);
 }
 function confirmation(snapshot){return root.confirm('Заменить все данные Маятника копией от '+(snapshot.createdAt?new Date(snapshot.createdAt).toLocaleString():'неизвестной даты')+'?\nПредыдущие данные будут сохранены для отката.');}
 function update(){if(!dialog)return;const busy=task||!!api?.backup.state().busy||!!api?.backup.state().terminal||!!api?.backup.state().restored||!!api?.file.state().busy;for(const b of buttons)b.disabled=busy||!api;if(api?.backup.state().terminal&&!task)dialog.querySelector('[data-backup-recovery]').disabled=false;dialog.setAttribute('aria-busy',String(busy));}
 function show(){make();if(!dialog.open)dialog.showModal();update();}
 function downloadBlob(blob,name){const url=root.URL.createObjectURL(blob),a=doc.createElement('a');a.href=url;a.download=name;a.click();root.setTimeout(()=>root.URL.revokeObjectURL(url),60000);}
 async function save(){downloadBlob(await api.backup.capture(),'mayatnik-all-'+new Date().toISOString().replace(/[:.]/g,'-')+'.mayatnik-backup');}
 async function act(run){if(task||!api||api.backup.state().busy||api.file.state().busy)return;task=true;update();try{const message=await run();if(typeof message==='string')output.textContent=message;}catch(e){output.textContent=e.name==='AbortError'?'Отменено':e.message||String(e);}finally{task=false;update();}}
 function bind(){const next=root.mayBackup;if(!next||next===api)return;off?.();api=next;off=api.backup.subscribe(s=>{make();if(s.busy)show();output.textContent=s.message;update();});api.file.ready().catch(e=>{make();output.textContent=e.message;});update();}
 root.MayatnikBackupUI={open(action){make();bind();show();if(!api){output.textContent='Маятник ещё загружается';return;}output.textContent=api.file.state().connected?'Подключён: '+api.file.state().name:'Файл облачной папки не подключён';if(action==='save')act(save);else if(action==='restore')dialog.querySelector('input[type=file]').click();}};
 root.addEventListener('may-backup-ready',bind);root.addEventListener('pagehide',()=>off?.(),{once:true});bind();
})(window);
