/* ВЛФ-009: таблица трёх верхних битов выбирает цвет существующей клетки.
   Ни поле, ни состояние клеточного автомата этот модуль не изменяет. */
(function(root){
  'use strict';
  const DEFAULTS=Object.freeze({enabled:false,rule:90,zero:'#ffffff',one:'#000000'});
  function normalize(value){
    const s=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    const number=typeof s.rule==='number'?s.rule:typeof s.rule==='string'&&s.rule.trim()?Number(s.rule):NaN;
    const colour=(v,fallback)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v.toLowerCase():fallback;
    return {enabled:s.enabled===true,rule:Number.isFinite(number)?Math.max(0,Math.min(255,Math.trunc(number))):90,
      zero:colour(s.zero,DEFAULTS.zero),one:colour(s.one,DEFAULTS.one)};
  }
  function rgba(hex){
    const n=parseInt(hex.slice(1),16);
    return (0xff000000|((n&255)<<16)|(n&0xff00)|(n>>>16))>>>0;
  }
  function prepare(field,window,settings){
    const s=normalize(settings);
    if(!s.enabled||!field?.val)return null;
    const {W,H,val}=field;
    const left=Math.max(0,window.left-1),right=Math.min(W,window.left+window.width+1);
    const height=Math.min(H,window.height),width=right-left;
    if(width<=0||height<=0)return null;
    // Один снимок видимых строк с боковым запасом по клетке. Даже сосед за
    // краем окна читается из поля. Цвета предыдущих клеток никогда не читаются.
    const bits=new Int8Array(width*height);
    for(let r=0;r<height;r++)bits.set(val.subarray(r*W+left,r*W+right),r*width);
    const colours=[rgba(s.zero),rgba(s.one)];
    return (r,c)=>{
      if(r<=0||r>=height||c<left||c>=right||bits[r*width+c-left]<0)return null;
      const up=(r-1)*width,local=c-left;
      const L=local>0&&bits[up+local-1]===1?1:0;
      const C=bits[up+local]===1?1:0;
      const R=local+1<width&&bits[up+local+1]===1?1:0;
      return colours[(s.rule>>((L<<2)|(C<<1)|R))&1];
    };
  }

  function mount({host,api,after=()=>{}}){
    const doc=host.ownerDocument,win=doc.defaultView||root;
    const controls=doc.createElement('div');controls.className='may-wolfram-controls';host.append(controls);
    const service=()=>typeof api==='function'?api():api;
    const read=()=>service()?.get?.()||{...DEFAULTS,available:false,active:false,reason:'Поле ещё не готово.'};
    const describe=(node,title)=>{node.title=title;node.setAttribute('aria-label',title);};
    const selected=(node,on)=>{node.classList.toggle('gz-on',!!on);node.classList.toggle('on',!!on);node.setAttribute('aria-pressed',String(!!on));};
    const change=patch=>{service()?.set?.(patch);sync();after();};
    function command(id,caption,title,action){
      const b=doc.createElement('button');b.type='button';b.className='gz-hx';b.dataset.n='wolfram:'+id;
      const name=doc.createElement('span');name.className='gz-nm';name.textContent=caption;b.append(name);
      describe(b,title);b.addEventListener('click',action);controls.append(b);return b;
    }
    const enable=command('enabled','Раскраска','Включить раскраску Вольфрама: три бита верхнего ряда выбирают один из двух цветов. Биты поля не меняются.',()=>change({enabled:!read().enabled}));
    const notice=doc.createElement('output');notice.className='may-wolfram-notice';notice.setAttribute('aria-live','polite');notice.hidden=true;controls.append(notice);

    const numberRow=doc.createElement('label');numberRow.className='gz-hx may-wolfram-number';numberRow.dataset.n='wolfram:rule';numberRow.dataset.noMini='';
    const numberName=doc.createElement('span');numberName.textContent='Правило';numberRow.append(numberName);
    const number=doc.createElement('input');number.type='number';number.min='0';number.max='255';number.step='1';number.value='90';
    describe(number,'Номер таблицы Вольфрама от 0 до 255. Изменяет только цвет клеток.');numberRow.append(number);controls.append(numberRow);
    number.addEventListener('change',()=>{if(number.value.trim()&&Number.isFinite(Number(number.value)))change({rule:Number(number.value)});else sync();});
    number.addEventListener('blur',sync);
    number.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();number.dispatchEvent(new Event('change'));number.blur();}});

    const presets=[254,250,90,30,110].map(rule=>({rule,button:command('preset:'+rule,String(rule),'Выбрать таблицу правила '+rule,()=>change({rule}))}));
    const transitions=[];
    for(let code=7;code>=0;code--){
      const triple=code.toString(2).padStart(3,'0');
      const button=command('transition:'+code,triple+' → 0','Верхний ряд '+triple+': переключить выходной цвет 0 / 1.',()=>change({rule:read().rule^(1<<code)}));
      button.classList.add('may-wolfram-transition');transitions.push({button,code,triple,label:button.firstChild});
    }
    const pickers=['zero','one'].map((key,bit)=>{
      const row=doc.createElement('label');row.className='gz-hx may-wolfram-colour';row.dataset.n='wolfram:colour:'+bit;row.dataset.noMini='';
      const label=doc.createElement('span');label.textContent='Цвет '+bit;row.append(label);
      const input=doc.createElement('input');input.type='color';input.value=DEFAULTS[key];describe(input,'Цвет выхода '+bit+' в раскраске Вольфрама');row.append(input);controls.append(row);
      input.addEventListener('input',()=>change({[key]:input.value}));return {key,input};
    });
    command('reset','Сброс','Сбросить только раскраску Вольфрама: выключить, правило 90, выход 0 белый, выход 1 чёрный.',()=>{service()?.reset?.();sync();after();});
    let previousNotice='';
    function sync(){
      const s=read();selected(enable,s.active);enable.disabled=!s.available&&!s.enabled;
      describe(enable,s.available?'Включить или выключить раскраску Вольфрама. Три верхних бита выбирают цвет; биты поля не меняются.':(s.enabled?'Выключить сохранённый режим. ':'')+s.reason);
      const message=!s.available?(s.enabled?'Раскраска не применяется. ':'')+s.reason:'';
      notice.hidden=!message;if(message!==previousNotice){notice.textContent=message;previousNotice=message;}
      if(doc.activeElement!==number&&number.value!==String(s.rule))number.value=String(s.rule);
      for(const {rule,button} of presets)selected(button,s.rule===rule);
      for(const {button,code,triple,label} of transitions){
        const bit=(s.rule>>code)&1,text=triple+' → '+bit;
        if(label.textContent!==text)label.textContent=text;selected(button,bit===1);
        describe(button,'Верхний ряд '+triple+' → выход '+bit+'. Нажмите, чтобы заменить его на '+(1-bit)+'.');
      }
      for(const {key,input} of pickers)if(doc.activeElement!==input&&input.value!==s[key])input.value=s[key];
    }
    win.addEventListener('may-wolfram-change',sync);
    sync();return {sync};
  }
  root.MayatnikWolfram={DEFAULTS,normalize,prepare,mount};
})(window);
