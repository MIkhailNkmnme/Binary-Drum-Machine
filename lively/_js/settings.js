// Панель настройки страницы обоев. Компактная: подпись, ползунок, число и «А» (авто) — в одну строку;
// группы сворачиваются щелчком по заголовку. Значения помнит браузер (localStorage);
// «в Lively» выгружает LivelyProperties.json для самих обоев.
(function(){
  var KEY='zerk-lively:';
  var src=window.LIVELY_PROPS||{};
  var panel=document.getElementById('panel'), body=document.getElementById('panelBody');
  var cur={}, ctrls={}, autoBoxes={};

  // строка 4 — название трека и свой цвет дождя: только на сайте, в Lively не выгружаются
  var props={};
  Object.keys(src).forEach(function(k){
    props[k]=src[k];
    if(k==='t3Space'){
      props.trackLine={text:'Строка 4 — показывать (трек или своё)',type:'checkbox',value:false,pageOnly:true};
      props.title4={text:'Строка 4 (пусто — название трека)',type:'textbox',value:'',pageOnly:true};
      props.trkSize={text:'строка 4: размер, %',type:'slider',min:20,max:300,value:60,pageOnly:true};
      props.trkFont={text:'строка 4: шрифт',type:'dropdown',value:0,items:(src.t1Font&&src.t1Font.items)||['Consolas'],pageOnly:true};
      props.trkSpace={text:'строка 4: интервал, %',type:'slider',min:-10,max:100,value:0,pageOnly:true};
    }
    if(k==='rainGapY'){
      props.rainOwn={text:'Свой цвет дождя (иначе — общий / радуга)',type:'checkbox',value:false,pageOnly:true};
      props.rainColor={text:'цвет дождя',type:'color',value:'#00ff6e',pageOnly:true};
    }
  });
  window.LIVELY_PROPS=props;

  function saved(name,def){
    try{ var v=localStorage.getItem(KEY+name); if(v===null) return def; return JSON.parse(v); }catch(e){ return def; }
  }
  function store(name,val){ try{ localStorage.setItem(KEY+name,JSON.stringify(val)); }catch(e){} }
  function apply(name,val){ if(typeof livelyPropertyListener==='function') livelyPropertyListener(name,val); }
  function set(name,val,silent){
    cur[name]=val; store(name,val);
    if(ctrls[name]) ctrls[name](val);
    if(!silent) apply(name,val);
  }
  function el(tag,cls,txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!==undefined) e.textContent=txt; return e; }

  // ---------- группы ----------
  var SCENE_OF={'ХОЛМ':0,'СЕРПИНСКИЙ':1,'РАДАР':2,'ВОРОНКА':3};
  var sections=[], box=body;
  function updSections(){
    sections.forEach(function(s){
      var sc=s.getAttribute('data-scene');
      s.style.display=(sc===null || +sc===+cur.scene) ? '' : 'none';
    });
  }
  function group(title){
    var sec=el('div','sec'); sections.push(sec);
    if(title in SCENE_OF) sec.setAttribute('data-scene',SCENE_OF[title]);
    var hd=el('div','grp',title); sec.appendChild(hd);
    box=el('div','gbody'); sec.appendChild(box);
    var gk='grp:'+title;
    if(saved(gk,false)) sec.classList.add('closed');
    hd.onclick=function(){ sec.classList.toggle('closed'); store(gk,sec.classList.contains('closed')); };
    body.appendChild(sec);
  }
  // подписи без «строка N:» — номер строки стоит подзаголовком над её настройками
  function shortLabel(t){ return String(t||'').replace(/^\s+/,'').replace(/^строка\s*\d+\s*:\s*/i,''); }
  var SUB={title:'Строка 1',title2:'Строка 2',title3:'Строка 3',trackLine:'Строка 4 — трек или своё',titleSize:'Вся надпись',clock:'Часы'};
  var LBL={title:'текст',title2:'текст (пусто — нет)',title3:'текст (пусто — нет)',trackLine:'показывать',title4:'текст (пусто — название трека)'};

  // ---------- строки ----------
  function row(name,p){
    if(p.type==='label'){ group((p.value||p.text||'').replace(/^■\s*/,'')); return; }
    if(SUB[name]) box.appendChild(el('div','sub',SUB[name]));
    var val=saved(name,p.value); cur[name]=val;
    var txt=LBL[name]||shortLabel(p.text||name);

    if(p.type==='checkbox'){
      var r=el('label','r c'), cb=el('input'); cb.type='checkbox'; cb.checked=!!val;
      cb.onchange=function(){ var v=cb.checked; cur[name]=v; store(name,v); apply(name,v); };
      r.appendChild(cb); r.appendChild(document.createTextNode(txt)); r.title=txt;
      ctrls[name]=function(v){ cb.checked=!!v; };
      box.appendChild(r); return;
    }

    var w=el('div', p.type==='slider'?'r s':'r o');
    var lb=el('span','lb',txt); lb.title=txt; w.appendChild(lb);
    var input;
    if(p.type==='slider'){
      input=el('input'); input.type='range'; input.min=p.min; input.max=p.max; input.step=1; input.value=val;
      var num=el('span','num',val);
      input.oninput=function(){ var v=+input.value; num.textContent=v; cur[name]=v; store(name,v); apply(name,v); };
      w.appendChild(input); w.appendChild(num);
      ctrls[name]=function(v){ input.value=v; num.textContent=v; };
      if(name!=='autoAmp'){                           // «А» — значение само плавно гуляет около выставленного
        var an='auto_'+name;
        var aw=el('label','au'); aw.title='авто: значение плавно гуляет около выставленного (размах — в группе «Авторазброс»)';
        var ab=el('input'); ab.type='checkbox'; ab.checked=!!saved(an,props[an]?props[an].value:false);
        cur[an]=ab.checked;
        ab.onchange=function(){ var v=ab.checked; cur[an]=v; store(an,v); apply(an,v); };
        ctrls[an]=function(v){ ab.checked=!!v; };
        autoBoxes[an]=ab;
        aw.appendChild(ab); aw.appendChild(document.createTextNode('А'));
        w.appendChild(aw);
        apply(an,ab.checked);
      }
    } else if(p.type==='dropdown'){
      input=el('select');
      (p.items||[]).forEach(function(it,i){ var o=el('option',null,it); o.value=i; input.appendChild(o); });
      input.value=val;
      input.onchange=function(){
        var v=+input.value; cur[name]=v; store(name,v); apply(name,v);
        if(name==='preset' && v>0) afterPreset(v-1);
        if(name==='scene' || name==='preset') updSections();
      };
      w.appendChild(input);
      ctrls[name]=function(v){ input.value=v; };
    } else if(p.type==='color'){
      input=el('input'); input.type='color'; input.value=val;
      input.oninput=function(){ var v=input.value; cur[name]=v; store(name,v); apply(name,v); };
      w.appendChild(input);
      ctrls[name]=function(v){ input.value=v; };
    } else {
      input=el('input'); input.type='text'; input.value=val;
      input.oninput=function(){ var v=input.value; cur[name]=v; store(name,v); apply(name,v); };
      w.appendChild(input);
      ctrls[name]=function(v){ input.value=v; };
    }
    box.appendChild(w);
  }

  // после готового набора подтянуть ползунки панели под его значения
  function afterPreset(i){
    var ids=window.ZERK_PRESET_IDS; var pr=(window.ZERK_PRESETS||[])[ids?ids[i]:i]; if(!pr) return;
    for(var k in pr.vals) set(k,pr.vals[k],true);
  }

  // ---------- мои наборы: в браузере и в файл ----------
  // Хранятся под своим ключом, не под KEY: «сбросить» чистит настройки, но не наборы.
  var PK='zerk-lively-presets';
  function loadMy(){ try{ var a=JSON.parse(localStorage.getItem(PK)||'[]'); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
  function saveMy(a){ try{ localStorage.setItem(PK,JSON.stringify(a)); return true; }catch(e){ alert('Не удалось сохранить в браузере: '+e); return false; } }
  function snapshot(){ var o={}; for(var k in cur){ if(k!=='preset') o[k]=cur[k]; } return o; }
  function applySnap(v){
    if('scene' in v) set('scene',v.scene);
    for(var k in v){ if(k==='scene' || k==='preset' || !ctrls[k]) continue; set(k,v[k]); }
    set('preset',0,true); updSections();
  }
  group('МОИ НАБОРЫ');
  var myRow=el('div','r o'); myRow.appendChild(el('span','lb','набор'));
  var mySel=el('select'); myRow.appendChild(mySel); box.appendChild(myRow);
  function refill(pick){
    var a=loadMy(); mySel.innerHTML='';
    if(!a.length){ var o0=el('option',null,'— пока нет —'); o0.value=''; mySel.appendChild(o0); }
    a.forEach(function(p,i){ var o=el('option',null,p.name); o.value=i; mySel.appendChild(o); });
    if(pick!==undefined) mySel.value=pick;
  }
  function btnRow(list){
    var r=el('div','btnrow');
    list.forEach(function(b){ var x=el('button',null,b[0]); x.title=b[1]; x.onclick=b[2]; r.appendChild(x); });
    box.appendChild(r);
  }
  btnRow([
    ['загрузить','Применить выбранный набор',function(){
      var a=loadMy(), p=a[+mySel.value]; if(mySel.value!=='' && p) applySnap(p.vals); }],
    ['сохранить','Сохранить текущие настройки как набор (то же имя — перезапишет)',function(){
      var a=loadMy(), cn=mySel.value!==''&&a[+mySel.value]?a[+mySel.value].name:'Набор '+(a.length+1);
      var name=prompt('Имя набора:',cn); if(!name) return; name=name.trim(); if(!name) return;
      var i=a.findIndex(function(p){ return p.name===name; });
      if(i>=0 && !confirm('Набор «'+name+'» уже есть. Перезаписать?')) return;
      var rec={name:name,vals:snapshot(),at:Date.now()};
      if(i>=0) a[i]=rec; else { a.push(rec); i=a.length-1; }
      if(saveMy(a)) refill(i); }],
    ['удалить','Удалить выбранный набор',function(){
      var a=loadMy(), i=+mySel.value; if(mySel.value==='' || !a[i]) return;
      if(!confirm('Удалить набор «'+a[i].name+'»?')) return;
      a.splice(i,1); if(saveMy(a)) refill(); }]
  ]);
  var fileIn=el('input'); fileIn.type='file'; fileIn.accept='.json,application/json'; fileIn.style.display='none'; box.appendChild(fileIn);
  fileIn.onchange=function(){
    var f=fileIn.files[0]; fileIn.value=''; if(!f) return;
    f.text().then(function(t){
      var d=JSON.parse(t), list=Array.isArray(d)?d:(d&&d.presets);
      if(!Array.isArray(list)) throw new Error('в файле нет наборов');
      var a=loadMy(), n=0;
      list.forEach(function(p){
        if(!p || !p.name || !p.vals) return;
        var i=a.findIndex(function(q){ return q.name===p.name; });
        if(i>=0) a[i]=p; else a.push(p); n++;
      });
      if(saveMy(a)){ refill(); alert('Загружено наборов: '+n+' (с тем же именем — заменены).'); }
    }).catch(function(e){ alert('Не удалось прочитать файл: '+e.message); });
  };
  btnRow([
    ['в файл','Скачать все свои наборы одним файлом',function(){
      var a=loadMy(); if(!a.length){ alert('Своих наборов пока нет.'); return; }
      var blob=new Blob([JSON.stringify({type:'zerkalius-lively-presets',version:1,presets:a},null,2)],{type:'application/json'});
      var d=new Date(), pad=function(x){ return (x<10?'0':'')+x; };
      var l=document.createElement('a'); l.href=URL.createObjectURL(blob);
      l.download='zerkalius-lively-nabory-'+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'.json';
      document.body.appendChild(l); l.click(); l.remove(); setTimeout(function(){ URL.revokeObjectURL(l.href); },30000); }],
    ['из файла','Загрузить наборы из файла (добавятся к своим)',function(){ fileIn.click(); }]
  ]);
  refill();

  Object.keys(props).forEach(function(n){ if(n.indexOf('auto_')!==0) row(n,props[n]); });

  // в «Авторазбросе» — снять все «А» разом
  var off=el('button','small','снять все «А»');
  off.onclick=function(){ for(var an in autoBoxes){ if(autoBoxes[an].checked) set(an,false); } };
  box.appendChild(off);

  Object.keys(props).forEach(function(n){ if(n.indexOf('auto_')!==0 && n!=='preset' && props[n].type!=='label') apply(n,cur[n]); });
  if(cur.preset>0) { apply('preset',cur.preset); afterPreset(cur.preset-1); }
  updSections();

  // ---------- кнопки шапки ----------
  function exportJson(){
    var out={};
    Object.keys(src).forEach(function(n){
      var p=JSON.parse(JSON.stringify(src[n]));
      if(n in cur) p.value=cur[n];
      out[n]=p;
    });
    return JSON.stringify(out,null,2);
  }
  document.getElementById('btnSave').onclick=function(){
    var blob=new Blob([exportJson()],{type:'application/json'});
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='LivelyProperties.json';
    document.body.appendChild(a); a.click(); a.remove();
  };
  document.getElementById('btnCopy').onclick=function(){
    var t=exportJson();
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t);
    else { var ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
    var b=document.getElementById('btnCopy'), old=b.textContent; b.textContent='скопировано'; setTimeout(function(){ b.textContent=old; },1200);
  };
  document.getElementById('btnReset').onclick=function(){
    try{ Object.keys(localStorage).forEach(function(k){ if(k.indexOf(KEY)===0) localStorage.removeItem(k); }); }catch(e){}
    location.reload();
  };
  document.getElementById('btnHide').onclick=function(){ panel.classList.toggle('hidden'); };

  // колесо над обоями (не над самой панелью — там оно листает список): вниз — спрятать, вверх — показать;
  // нажатие колеса — переключить
  window.addEventListener('wheel',function(e){
    if(panel.contains(e.target)) return;
    if(e.deltaY>0) panel.classList.add('hidden'); else if(e.deltaY<0) panel.classList.remove('hidden');
  },{passive:true});
  window.addEventListener('mousedown',function(e){
    if(e.button!==1 || panel.contains(e.target)) return;
    e.preventDefault(); panel.classList.toggle('hidden');
  });
  // H занята значком «в Хаб», поэтому панель — на P
  window.addEventListener('keydown',function(e){
    if(e.ctrlKey||e.metaKey||e.altKey) return;
    var t=e.target.tagName; if(t==='INPUT'&&e.target.type==='text'||t==='TEXTAREA'||t==='SELECT') return;
    if(e.key==='p'||e.key==='P'||e.key==='з'||e.key==='З') panel.classList.toggle('hidden');
  });
})();
