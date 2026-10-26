/* Page-local input/copy dialog; never calls native prompt(). */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ZZInputDialog=api;})(globalThis,function(){
  'use strict';
  function integer(value,min,max){const text=String(value).trim(),n=Number(text);if(!/^\d+$/.test(text)||!Number.isSafeInteger(n)||n<min||n>max)throw Error('Укажи целое число от '+min+' до '+max+'.');return n;}
  function create(doc){let active=null,serial=0;
    function open({title,value='',type='text',min=1,max=256,maxLength,readOnly=false,decorate}={}){
      active?.cancel();const before=doc.activeElement,dialog=doc.createElement('dialog'),form=doc.createElement('form'),label=doc.createElement('label'),heading=doc.createElement('h2'),field=doc.createElement(readOnly?'textarea':'input'),notice=doc.createElement('output'),commands=doc.createElement('div'),id='zzInputDialog'+(++serial);
      dialog.id=id;dialog.className='sol-plate zz-input-dialog';dialog.setAttribute('aria-labelledby',id+'Title');form.noValidate=true;heading.id=id+'Title';heading.className='smh';heading.textContent=title||'Ввод';field.id=id+'Value';field.value=String(value);field.readOnly=readOnly;field.setAttribute('aria-label',title||'Значение');field.setAttribute('aria-describedby',id+'Error');
      if(!readOnly){field.type=type;field.autocomplete='off';if(type==='number'){field.min=String(min);field.max=String(max);field.step='1';field.inputMode='numeric';}if(maxLength)field.maxLength=maxLength;}else field.rows=6;
      label.textContent=readOnly?'Выдели и скопируй текст:':'Значение';label.append(field);notice.id=id+'Error';notice.setAttribute('role','alert');notice.className='zz-input-notice';commands.className='zz-input-commands';
      const button=(text,full,submit)=>{const b=doc.createElement('button');b.type=submit?'submit':'button';b.className='gz-hx zz-input-command';b.title=full;b.setAttribute('aria-label',full);const span=doc.createElement('span');span.textContent=text;b.append(span);commands.append(b);return b;};
      const accept=button(readOnly?'× Закрыть':'✓ Принять',readOnly?'Закрыть':'Применить значение',true),cancel=readOnly?null:button('× Отмена','Отменить ввод',false);form.append(heading,label,notice,commands);dialog.append(form);doc.body.append(dialog);
      let settled=false;
      return new Promise(resolve=>{
        // plateZig intentionally skips most mobile panels. Keep the same 24px
        // teeth for this temporary dialog when that shared decorator abstains.
        function decoratePanel(){decorate?.(dialog);if(dialog.classList.contains('pzg')&&!dialog.dataset.localZig)return;const W=dialog.offsetWidth,H=Math.ceil(dialog.offsetHeight/24)*24;if(!W||!H)return;dialog.style.minHeight=H+'px';const t=24/(2*Math.sqrt(3)),ys=[];for(let y=0;y<H;y+=12)ys.push(y);ys.push(H);const zig=y=>t*Math.abs(y%24-12)/12,pts=[...ys.map(y=>[t-zig(y),y]),...ys.slice().reverse().map(y=>[W-zig(y),y])],svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'"><polygon points="'+pts.map(([x,y])=>x+','+Math.min(H-.5,Math.max(.5,y))).join(' ')+'" fill="none" stroke="black" stroke-width="2"/></svg>';dialog.classList.add('pzg');dialog.dataset.localZig='1';dialog.style.setProperty('--gclip','polygon('+pts.map(([x,y])=>x+'px '+y+'px').join(',')+')');dialog.style.setProperty('--gmask','url("data:image/svg+xml,'+encodeURIComponent(svg)+'")');dialog.style.setProperty('--gfc','#f1c56d');}
        function finish(result){if(settled)return;settled=true;if(active?.element===dialog)active=null;doc.defaultView?.removeEventListener('resize',decoratePanel);dialog._pzRO?.disconnect();if(dialog._pzRaf)doc.defaultView?.cancelAnimationFrame(dialog._pzRaf);if(dialog.open&&typeof dialog.close==='function')dialog.close();dialog.remove();if(before?.isConnected)before.focus();resolve(result);}
        active={element:dialog,cancel:()=>finish(null)};
        form.addEventListener('submit',event=>{event.preventDefault();try{if(!readOnly&&type==='number')integer(field.value,min,max);finish(field.value);}catch(error){notice.textContent=error.message;field.setAttribute('aria-invalid','true');field.focus();decoratePanel();}});
        cancel?.addEventListener('click',()=>finish(null));dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});dialog.addEventListener('close',()=>finish(null));
        dialog.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();finish(null);}else if(event.key==='Enter'&&!readOnly){event.preventDefault();form.requestSubmit(accept);}});
        dialog.addEventListener('click',event=>event.stopPropagation());field.addEventListener('input',()=>{notice.textContent='';field.removeAttribute('aria-invalid');});
        if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');field.focus();field.select();decoratePanel();doc.defaultView?.addEventListener('resize',decoratePanel);
      });
    }
    return {open,cancel:()=>active?.cancel(),get active(){return active?.element||null;}};
  }
  let shared;return {integer,create,open(options){if(!shared)shared=create(document);return shared.open(options);}};
});
