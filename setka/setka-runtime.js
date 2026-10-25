/* Minimal host for the extracted grid engine; no Zazerkalius application is loaded. */
'use strict';
const $=id=>document.getElementById(id);
let setkaStorage;try{setkaStorage=localStorage;}catch(_){setkaStorage={getItem(){return null;},setItem(){}};}
const Z=SetkaState.load(setkaStorage),undoStack=[],redoStack=[];
const coneCss=(name,fallback)=>getComputedStyle(document.documentElement).getPropertyValue(name).trim()||fallback;
const winOpen=id=>id==='w-rmb';
function say(text){$('setkaStatus').textContent=text;}
let setkaTemplate='base';
function setkaSourceRows(){
 const rows=ZZ_INITIAL_ROWS.filter((_,i)=>i!==1);
 if(setkaTemplate==='base')return rows;
 return rows.map((_,r)=>Array.from({length:r+1},(_,c)=>(c&~r)===0?'1':'0').join(''));
}
function save(){try{SetkaState.save(setkaStorage,Z);}catch(_){say('Не удалось сохранить поле: хранилище заполнено или недоступно.');}window.setkaMenuRefresh?.();}
function undoPush(entry){undoStack.push(entry);if(undoStack.length>80)undoStack.shift();redoStack.length=0;}
function undo(){if(!undoStack.length||gridsLocked())return;const item=undoStack.pop();redoStack.push({grids:gridsSnap()});gridsApply(item.grids);}
function redo(){if(!redoStack.length||gridsLocked())return;const item=redoStack.pop();undoStack.push({grids:gridsSnap()});gridsApply(item.grids);}
