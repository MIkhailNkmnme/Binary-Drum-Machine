/* Page startup and local keyboard scope. */
(() => {
 const original=renderRmb;renderRmb=function(){original();window.setkaMenuRefresh?.();$('pageUndo').disabled=!undoStack.length;$('pageRedo').disabled=!redoStack.length;};
 $('pageUndo').onclick=undo;$('pageRedo').onclick=redo;
 const help=$('w-rmb').querySelector('.whint'),helpButton=$('pageHelp');
 help.id='setkaHelpPanel';help.setAttribute('role','dialog');help.setAttribute('aria-label','Справка по Сеткам');
 helpButton.setAttribute('aria-controls',help.id);
 const showHelp=open=>{$('w-rmb').classList.toggle('setka-help',open);helpButton.setAttribute('aria-expanded',String(open));help.setAttribute('aria-hidden',String(!open));};
 showHelp(false);helpButton.onclick=()=>showHelp(!$('w-rmb').classList.contains('setka-help'));
 document.addEventListener('click',e=>{if(!help.contains(e.target)&&!helpButton.contains(e.target))showHelp(false);},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')showHelp(false);},true);
 document.addEventListener('keydown',e=>{if(e.defaultPrevented||e.isComposing||e.target.closest('input,textarea,select,[contenteditable]'))return;if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'){e.preventDefault();e.shiftKey?redo():undo();}else if((e.ctrlKey||e.metaKey)&&e.code==='KeyY'){e.preventDefault();redo();}});
 renderRmb();window.setkaMenuInit?.();save();
 for(const [id,kind] of [['gridsTemplateBase','base'],['gridsTemplateSerp','serp']])$(id).onclick=()=>{setkaTemplate=kind;$('gridsRowsImport').click();if(!gridsState().locked)say('Шаблон «'+(kind==='base'?'Последовательность':'Серпинский')+'» загружен. Отмена вернёт прежнее поле.');};
 window.addEventListener('resize',()=>renderRmb());
})();
