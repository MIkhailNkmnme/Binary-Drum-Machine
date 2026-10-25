/* Page startup and local keyboard scope. */
(() => {
 const original=renderRmb;renderRmb=function(){original();window.setkaMenuRefresh?.();$('pageUndo').disabled=!undoStack.length;$('pageRedo').disabled=!redoStack.length;};
 $('pageUndo').onclick=undo;$('pageRedo').onclick=redo;
 $('pageHelp').onclick=()=>{$('w-rmb').classList.toggle('setka-help');};
 document.addEventListener('keydown',e=>{if(e.defaultPrevented||e.isComposing||e.target.closest('input,textarea,select,[contenteditable]'))return;if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'){e.preventDefault();e.shiftKey?redo():undo();}else if((e.ctrlKey||e.metaKey)&&e.code==='KeyY'){e.preventDefault();redo();}});
 renderRmb();window.setkaMenuInit?.();save();
 for(const [id,kind] of [['gridsTemplateBase','base'],['gridsTemplateSerp','serp']])$(id).onclick=()=>{setkaTemplate=kind;$('gridsRowsImport').click();if(!gridsState().locked)say('Шаблон «'+(kind==='base'?'Последовательность':'Серпинский')+'» загружен. Отмена вернёт прежнее поле.');};
 window.addEventListener('resize',()=>renderRmb());
})();
