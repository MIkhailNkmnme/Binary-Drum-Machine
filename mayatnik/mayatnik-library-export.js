/* Read-only library export. Native folders and ZIP contain the same files. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikLibraryExport=api;})(globalThis,function(){
 'use strict';
 const enc=new TextEncoder(),MAX32=0xffffffff;
 const safeName=value=>{let s=String(value||'Элемент').normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'').trim().slice(0,80);if(!s||/^\.+$/.test(s))s='Элемент';if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s))s='_'+s;return s;};
 function token(id){let n=2166136261;for(const b of enc.encode(String(id))){n^=b;n=Math.imul(n,16777619);}return (n>>>0).toString(16).padStart(8,'0');}
 const json=value=>new Blob([JSON.stringify(value,null,2)],{type:'application/json'});
 function validatePaths(files){const seen=new Set();for(const f of files){if(typeof f.path!=='string'||f.path.split('/').some(p=>!p||p==='.'||p==='..'||/[\\<>:"|?*\x00-\x1f]/.test(p))||seen.has(f.path.toLowerCase()))throw Error('Некорректный или повторяющийся путь экспорта');seen.add(f.path.toLowerCase());}}
 const table=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
 async function crc(blob){let n=MAX32;const reader=blob.stream().getReader();try{for(;;){const {done,value}=await reader.read();if(done)break;for(const b of value)n=table[(n^b)&255]^(n>>>8);}}finally{reader.releaseLock();}return (n^MAX32)>>>0;}
 function header(size){const a=new Uint8Array(size),v=new DataView(a.buffer);return {a,u16:(o,n)=>v.setUint16(o,n,true),u32:(o,n)=>v.setUint32(o,n,true)};}
 async function zip(files){
  validatePaths(files);
  if(files.length>65535)throw Error('Слишком много файлов для ZIP; выберите папку или меньший набор');
  if(22+files.reduce((n,f)=>n+76+2*enc.encode(f.path).length+f.blob.size,0)>MAX32)throw Error('ZIP превышает 4 ГиБ; выберите папку или меньший набор');
  const parts=[],central=[];let offset=0,size=0;
  for(const f of files){const name=enc.encode(f.path);if(name.length>65535||f.blob.size>MAX32||offset+30+name.length+f.blob.size>MAX32)throw Error('ZIP превышает 4 ГиБ; выберите папку или меньший набор');
   const sum=await crc(f.blob),l=header(30);l.u32(0,0x04034b50);l.u16(4,20);l.u16(6,0x800);l.u16(12,33);l.u32(14,sum);l.u32(18,f.blob.size);l.u32(22,f.blob.size);l.u16(26,name.length);parts.push(l.a,name,f.blob);
   const c=header(46);c.u32(0,0x02014b50);c.u16(4,20);c.u16(6,20);c.u16(8,0x800);c.u16(14,33);c.u32(16,sum);c.u32(20,f.blob.size);c.u32(24,f.blob.size);c.u16(28,name.length);c.u32(42,offset);central.push(c.a,name);size+=46+name.length;offset+=30+name.length+f.blob.size;
  }
  if(offset+size+22>MAX32)throw Error('ZIP превышает 4 ГиБ; выберите папку или меньший набор');
  const end=header(22);end.u32(0,0x06054b50);end.u16(8,files.length);end.u16(10,files.length);end.u32(12,size);end.u32(16,offset);return new Blob([...parts,...central,end.a],{type:'application/zip'});
 }
 function create(sources){
  const categories=()=>sources().filter(s=>s.api).map(s=>({...s,items:s.list?s.list():(s.api.exportList?.()||s.api.list())}));
  async function prepare(selection){
   const available=categories(),files=[],entries=[],seen=new Set();
   const requests=[];
   for(const {category,id}of selection){const key=category+'\0'+id;if(seen.has(key))continue;seen.add(key);const source=available.find(s=>s.key===category),entry=source?.items.find(i=>i.id===id);if(!entry)throw Error('Элемент библиотеки больше не доступен: '+id);if(!/^[a-z][a-z0-9-]*$/.test(category))throw Error('Некорректный раздел библиотеки');requests.push({category,id,source,name:entry.name});}
   // Start every capture before awaiting any encoding or storage read. Live layer
   // rasters and sequences therefore belong to one synchronous start of export.
   const captured=await Promise.all(requests.map(q=>{try{return Promise.resolve(q.source.api.exportItem(q.id));}catch(e){return Promise.reject(e);}}));
   for(let i=0;i<requests.length;i++){const {category,id,source,name}=requests[i],item=captured[i],stem=safeName(name)+'--'+token(id),paths=[];
    for(const f of item.files){if(!/^\.[a-z0-9.]+$/i.test(f.extension)||!f.blob||typeof f.blob.arrayBuffer!=='function')throw Error('Некорректный файл экспорта: '+item.name);let base=source.key+'/'+stem,path=base+f.extension,n=2;while(files.some(x=>x.path.toLowerCase()===path.toLowerCase()))path=base+'-'+(n++)+f.extension;files.push({path,blob:f.blob});paths.push(path);}
    entries.push({category,id,name,files:paths});
   }
   if(!entries.length)throw Error('Выберите хотя бы один элемент');
   files.push({path:'manifest.json',blob:json({format:'mayatnik-library-export',version:1,entries})});return {files,entries};
  }
  return {categories,prepare};
 }
 async function writeFolder(directory,files,base='Маятник-библиотека'){
  validatePaths(files);
  let child,name=safeName(base),n=1;
  for(;;){try{await directory.getDirectoryHandle(name);}catch(e){if(e.name==='NotFoundError'){child=await directory.getDirectoryHandle(name,{create:true});break;}if(e.name!=='TypeMismatchError')throw e;}name=safeName(base)+' ('+(++n)+')';}
  let written=0;
  try{for(const f of files){const segments=f.path.split('/');let dir=child;for(const part of segments.slice(0,-1))dir=await dir.getDirectoryHandle(part,{create:true});const h=await dir.getFileHandle(segments.at(-1),{create:true});let stream;try{stream=await h.createWritable();await stream.write(f.blob);await stream.close();written++;}catch(e){try{await stream?.abort();}catch(_){}throw e;}}}
  catch(e){throw Error('Записано '+written+' из '+files.length+' файлов в «'+name+'». '+(e.message||e),{cause:e});}return {name,written};
 }
 function sources(root){return [
  {key:'templates',title:'Шаблоны',api:root.mayTemplateLibrary},
  {key:'layers',title:'Слои',api:root.mayLayers},
  {key:'frames',title:'Кадры',api:root.mayFrameLibrary},
  {key:'settings',title:'Настройки',api:root.maySettingsLibrary},
  {key:'sequences',title:'Последовательности',api:root.maySequences&&{list:()=>[{id:'current',name:'Текущая последовательность'}],exportItem(){const s=root.maySequences.snapshot(),rows=s.rows.slice();return {id:'current',name:'Текущая последовательность',files:[{extension:'.txt',blob:new Blob([rows.join('\n')],{type:'text/plain;charset=utf-8'})},{extension:'.sequence.json',blob:json({format:'mayatnik-sequence',version:1,rows,source:s.source,count:s.count})}]};}}}
 ];}
 function mount(root,{parent,tab=()=> 'templates'}={}){
  const doc=root.document,model=create(()=>sources(root));let dialog,notice,list,busy=false;
  const checked=()=>[...list.querySelectorAll('input:checked')].map(e=>({category:e.dataset.category,id:e.dataset.id}));
  function download(blob,name){const url=root.URL.createObjectURL(blob),a=doc.createElement('a');a.href=url;a.download=name;a.click();root.setTimeout(()=>root.URL.revokeObjectURL(url),60000);}
  const message=text=>notice.textContent=text;
  async function run(kind){if(busy)return;const selected=checked();if(!selected.length){message('Отметьте хотя бы один элемент.');return;}busy=true;for(const b of dialog.querySelectorAll('button,input'))b.disabled=true;
   try{let dir=null,fallback=kind==='folder'&&typeof root.showDirectoryPicker!=='function';
    // This call must remain before the first await: native picker needs the click.
    if(kind==='folder'&&!fallback)dir=await root.showDirectoryPicker({mode:'readwrite'});
    message('Подготавливаю '+selected.length+' элементов…');const data=await model.prepare(selected);
    if(dir){const r=await writeFolder(dir,data.files);message('Сохранено '+r.written+' файлов в папку «'+r.name+'».');}
    else{const blob=await zip(data.files);download(blob,'mayatnik-library.zip');message((fallback?'Выбор папки не поддерживается; ':'')+'ZIP передан браузеру: '+data.entries.length+' элементов, '+data.files.length+' файлов.');}
   }catch(e){message(e.name==='AbortError'?'Экспорт отменён.':'Экспорт не завершён: '+(e.message||e)+'. Можно повторить или выбрать ZIP.');}
   finally{busy=false;for(const b of dialog.querySelectorAll('button,input'))b.disabled=false;}
  }
  function button(text,title,fn){const b=doc.createElement('button');b.type='button';b.className='mtp-command';b.textContent=text;b.title=title;b.setAttribute('aria-label',title);b.onclick=fn;return b;}
  async function open(){
   if(!dialog){dialog=doc.createElement('dialog');dialog.id='mayLibraryExport';dialog.setAttribute('aria-label','Скачать элементы библиотеки');const title=doc.createElement('h3');title.textContent='Скачать из библиотеки';const info=doc.createElement('p');info.textContent='Отметьте один или несколько элементов. «Раздел» отмечает весь текущий раздел, включая скрытые поиском элементы. Каждый экспорт создаёт отдельную папку или ZIP; исходная библиотека сохраняется.';const commands=doc.createElement('div');commands.className='mtp-export-commands';
    commands.append(button('✓ Раздел','Отметить все элементы текущего раздела',()=>{for(const e of list.querySelectorAll('input'))e.checked=e.dataset.category===tab();}),button('✓ Всё','Отметить всю библиотеку',()=>{for(const e of list.querySelectorAll('input'))e.checked=true;}),button('Снять','Снять все отметки',()=>{for(const e of list.querySelectorAll('input'))e.checked=false;}));
    list=doc.createElement('div');list.className='mtp-export-list';notice=doc.createElement('output');notice.setAttribute('role','status');notice.className='mtp-status';const actions=doc.createElement('div');actions.className='mtp-export-commands';actions.append(button('↓ В папку','Сохранить отмеченные элементы в выбранную папку; если выбор папки недоступен — скачать ZIP',()=>run('folder')),button('↓ ZIP','Скачать отмеченные элементы одним ZIP',()=>run('zip')),button('Закрыть','Закрыть экспорт',()=>dialog.close()));dialog.append(title,info,commands,list,notice,actions);dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});(parent||doc.body).append(dialog);
   }
   if(dialog.open)return;dialog.showModal();message('Загружаю список…');list.replaceChildren();
   try{await Promise.all(sources(root).filter(s=>s.api).map(s=>Promise.resolve(s.api.ready).then(()=>s.api.idle?.())));const fragment=doc.createDocumentFragment();for(const cat of model.categories()){const heading=doc.createElement('h4');heading.textContent=cat.title+' · '+cat.items.length;fragment.append(heading);const activeId=cat.api.getState?.().selectedId||cat.api.selected?.();for(const item of cat.items){const label=doc.createElement('label'),input=doc.createElement('input'),text=doc.createElement('span');input.type='checkbox';input.dataset.category=cat.key;input.dataset.id=item.id;input.checked=cat.key===tab()&&(item.id===activeId||cat.key==='sequences');text.textContent=item.name;label.append(input,text);fragment.append(label);}}list.replaceChildren(fragment);message('Выберите элементы и способ сохранения.');}
   catch(e){message('Список недоступен: '+(e.message||e));}
  }
  return {open,model};
 }
 return {safeName,token,crc,zip,create,writeFolder,sources,mount};
});
