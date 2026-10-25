/* Хаб: правила видимых подписей. Исходные контролы и ключи меню не меняются. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else{root.HubButtonText=api;const start=()=>{if(document.body.dataset.miScope!=='mayatnik')api.observe(document);};if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});}
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const controls='button,[role="button"],a.menu-btn,.gz-hx,.gz-half,.gz-vh,.gz-vt,summary,label.hubRhomb,.panel-title';
  const excluded='script,style,noscript,textarea,select,input,svg,canvas,.gz-ic,.hubIcG,.hubPgIcon,.gz-mico,.zgh-icon,.zgh-arrow,.hubPresetName,[data-user-label],[contenteditable],#hubFieldTools,#hubMenuSources,#hubZoom';
  const vowel=/[аеёиоуыэюя]/iu,consonant=/[бвгджзйклмнпрстфхцчшщ]/iu;
  // Exact project vocabulary, with * immediately before its retained root vowel.
  // Unknown roots are kept intact rather than guessed from their position.
  const roots=new Map(`ш*ирина ш*ирине ш*ирину ш*ирины ш*ириной зал*ивка
    з*еркала з*еркало з*еркал з*еркально з*еркальный з*еркальных
    ш*аблон ш*аблоны ш*аблона ш*аблонов ш*аблоном
    раскр*аска окр*аска кр*аски кр*асные перекр*асить
    т*очка т*очки т*очку т*очкой т*очкаось пр*авка оч*истка оч*истить
    заг*иб сг*иб св*ёртка разм*ер разм*еры разм*еров
    шк*ала пол*оса пол*осы пол*ос пол*осами
    стр*ока стр*оки стр*оках стр*ок дл*ина дл*ительность выс*ота выс*оты
    ст*олбы ст*олба ст*олбов ст*олбец ст*олбцы прох*од
    цв*ета цв*етов цв*етом ц*ифра ц*ифры кл*етка кл*етки кл*етку
    б*иты б*итов б*итами в*иды в*ида в*идом гр*ани
    зап*ись зап*исать отм*ена отм*енить повт*ор повт*орить
    сохр*анить сохр*анение загр*узить откр*ыть закр*ыть ск*ачать
    убр*ать уд*алить отд*алить прибл*изить дв*игать выбр*ать
    выб*ор наз*ад впер*ёд отв*ес отр*азить
    в*ерхний в*ерхние в*ерхнего в*ерхней в*ерхнем св*ерху
    н*ижний н*ижние сн*изу в*ыше н*иже н*уля зас*ечками ф*айла
    п*уск п*ауза п*амяти р*еверс инв*ерт к*онтур
    нал*ожение сдв*ига заст*ыло пок*аз отд*ельно
    зам*ок зам*орозка фикс*ировать р*амка обв*одка л*астик
    с*ектор с*екторы пл*ощади пл*ощадь ур*овень
    в*олна в*олны сл*ева спр*ава вн*утри нар*ужу
    ср*азу вм*есте н*овый н*овая п*апка п*апки к*опия
    т*екст подп*иси с*етка сп*исок сп*иске сл*ои сл*оя сл*оями
    ч*ёрный ч*ёрные б*елый б*елые ж*ёлтый ж*ёлтые с*иний
    св*ободная св*ободный осн*овной р*омб р*омбы пр*осмотр
    больш*инство ср*едний п*иксель проп*уск настр*ойки ист*очник
    верт*икаль горизонт*аль гориз*онт т*отемы п*устот
    в*ершин в*ершина в*ершины ч*етыре числ*о числ*а`.split(/\s+/).filter(Boolean).map(marked=>[marked.replace('*',''),marked.indexOf('*')]));
  const phraseExceptions=new Map([['Шрна по Оси','Шрна по Оси'],['С нуля','Съ нля'],['С засечками','Съ зсчкми']]);
  const shortWord=word=>{
    if(phraseExceptions.has(word))return phraseExceptions.get(word);
    if(word==='Верт'||!/^([а-яё]+)$/iu.test(word))return word;
    const letters=[...word],positions=[];
    for(let i=0;i<letters.length;i++)if(vowel.test(letters[i]))positions.push(i);
    let keep=new Set(positions.filter(i=>!(consonant.test(letters[i-1]||'')&&consonant.test(letters[i+1]||''))));
    if(keep.size<=1&&positions.length){
      if(positions.length===1)keep=new Set(positions);
      else {
        const root=roots.get(word.toLocaleLowerCase('ru'));
        keep=new Set(root===undefined?positions:[root]);
      }
    }
    const compact=letters.filter((letter,i)=>!vowel.test(letter)||keep.has(i)).join('');
    const removedEnding=vowel.test(letters.at(-1)||'')&&!keep.has(letters.length-1);
    return !removedEnding&&consonant.test(compact.at(-1)||'')?compact+(word!=='С'&&word===word.toLocaleUpperCase('ru')?'Ъ':'ъ'):compact;
  };
  const shortCaption=text=>text.replace(/https?:\/\/\S+|[\p{L}\p{N}_-]+\.[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)?|Шрна по Оси|С засечками|С нуля|(?<![\p{L}\p{N}_])[а-яё]+(?![\p{L}\p{N}_])/giu,shortWord);
  function observe(doc){
    const sources=new WeakMap(),managedAria=new WeakMap(),managedTitle=new WeakMap();
    const ownerOf=node=>{const p=node.parentElement;return p&&!p.closest(excluded)?p.closest(controls):null;};
    function describe(owner){
      if(!owner.isConnected)return;
      const parts=[],walker=doc.createTreeWalker(owner,NodeFilter.SHOW_TEXT);
      while(walker.nextNode()){const node=walker.currentNode;if(ownerOf(node))parts.push(sources.get(node)?.full||node.data);}
      const full=parts.join('').trim();if(!full)return;
      // hub-tips temporarily owns title while hovered. Restoring it here would
      // make its observer remove it again forever and freeze pointer input.
      const hoveredTip=owner.dataset.hubTip;
      if(hoveredTip==null&&(!owner.title||owner.title===managedTitle.get(owner))){
        if(owner.title!==full)owner.title=full;managedTitle.set(owner,full);
      }
      const aria=owner.getAttribute('aria-label');
      if(aria===null||aria===managedAria.get(owner)){
        // У копируемых кнопок title также служит устойчивым ключом ромбосетки.
        const label=owner.title||hoveredTip||full;if(aria!==label)owner.setAttribute('aria-label',label);managedAria.set(owner,label);
      }
    }
    function apply(root){
      const owners=new Set();
      const visit=node=>{
        const owner=ownerOf(node);if(!owner)return;
        const old=sources.get(node),full=old&&node.data===old.short?old.full:node.data,short=shortCaption(full);
        sources.set(node,{full,short});if(node.data!==short)node.data=short;owners.add(owner);
      };
      if(root.nodeType===Node.TEXT_NODE)visit(root);
      else if(root.nodeType===Node.ELEMENT_NODE&&!root.matches(excluded)){
        const walker=doc.createTreeWalker(root,NodeFilter.SHOW_TEXT);while(walker.nextNode())visit(walker.currentNode);
      }
      for(const owner of owners)describe(owner);
    }
    apply(doc.body);
    const observer=new MutationObserver(records=>{
      for(const record of records){
        if(record.type==='characterData')apply(record.target);
        else if(record.type==='childList')for(const node of record.addedNodes)apply(node);
        else if(record.target.matches(controls)&&!record.target.closest(excluded))describe(record.target);
      }
    });
    observer.observe(doc.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title']});
    return {disconnect:()=>observer.disconnect(),apply};
  }
  return {shortCaption,observe};
});
