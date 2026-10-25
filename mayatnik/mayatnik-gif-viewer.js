/* Reusable animated GIF preview. Keeps only the latest object URL. */
(function(root){
 'use strict';const doc=root.document;let dialog,picture,title,url='',name='animation.gif';
 function make(){if(dialog)return;dialog=doc.createElement('dialog');dialog.id='mayGifDialog';dialog.dataset.noMini='';dialog.setAttribute('aria-label','Просмотр GIF');
  const head=doc.createElement('div');head.className='may-gif-head';title=doc.createElement('strong');head.append(title);
  const button=(text,help,fn)=>{const b=doc.createElement('button');b.type='button';b.className='mtp-command';b.textContent=text;b.title=help;b.setAttribute('aria-label',help);b.onclick=fn;return b;};
  head.append(button('↓ Скачать','Скачать показанный GIF',()=>{const a=doc.createElement('a');a.href=url;a.download=name;a.click();}),button('× Закрыть','Закрыть просмотр GIF',()=>dialog.close()));
  picture=doc.createElement('img');picture.alt='Созданная GIF-анимация';dialog.append(head,picture);doc.body.append(dialog);
 }
 function open(){if(!url)return false;make();if(!dialog.open)dialog.showModal();return true;}
 function show(blob,info={}){if(!blob||blob.type!=='image/gif'||!blob.size)throw Error('Нет готового GIF для просмотра');make();const next=root.URL.createObjectURL(blob),old=url;url=next;name=String(info.name||'animation.gif');picture.src=url;title.textContent=name+(info.width&&info.height?' · '+info.width+' × '+info.height:'');if(old)root.URL.revokeObjectURL(old);open();root.dispatchEvent(new Event('may-gif-ready'));}
 root.MayatnikGifViewer={show,open,hasResult:()=>!!url};root.addEventListener('pagehide',()=>{if(url)root.URL.revokeObjectURL(url);url='';},{once:true});
})(window);
