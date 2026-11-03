/* Defaults and live reset for button layout only; scene and library stores are excluded. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.MayatnikMenuDefaults=api;try{root.mayMenuDefaults=api.create({storage:root.localStorage,persist:!new URLSearchParams(root.location?.search||'').has('chisto'),apply:values=>{if(typeof root.mayMenuApplyButtonLayout!=='function')throw Error('Меню ещё не готово');return root.mayMenuApplyButtonLayout(values);},flush:()=>root.mayMenuFlush?.()});root.mayMenuDefaults.seed();}catch(error){root.console?.warn('Настройки кнопок: '+error.message);}}})(globalThis,function(){
 'use strict';
 const DEFAULTS=Object.freeze({
  "grozd:mayatnik": "{\"open\":null,\"pin\":[\"paint\",\"gifscale\",\"horr\",\"edge\",\"zoom\",\"ochki\"],\"shut\":[\"paint\",\"ochki\"],\"order\":[]}",
  "mayatnik-menu-dock-v509": "{\"Очистка\":{\"edge\":\"left\",\"index\":22},\"Оси\":{\"edge\":\"top\",\"index\":12},\"Точка Ось\":{\"edge\":\"left\",\"index\":10},\"Вид\":{\"edge\":\"top\",\"index\":13},\"Зеркала\":{\"edge\":\"left\",\"index\":12},\"Площади\":{\"edge\":\"bottom\",\"index\":12},\"Слои\":{\"edge\":\"left\",\"index\":15},\"Ручные оси\":{\"edge\":\"left\",\"index\":27},\"Шаблоны\":{\"edge\":\"top\",\"index\":10},\"ⓘ Сведения\":{\"edge\":\"bottom\",\"index\":12},\"Свёртки\":{\"edge\":\"left\",\"index\":11},\"Ячейки\":{\"edge\":\"left\",\"index\":17},\"gz:horr\":{\"edge\":\"top\",\"index\":0},\"gz:ochki\":{\"edge\":\"left\",\"index\":0},\"gz:zoom\":{\"edge\":\"bottom\",\"index\":0},\"gz:paint\":{\"edge\":\"top\",\"index\":11},\"gz:gifscale\":{\"edge\":\"bottom\",\"index\":2},\"gz:export\":{\"edge\":\"bottom\",\"index\":11},\"gz:edge\":{\"edge\":\"bottom\",\"index\":1},\"Режим поля\":{\"edge\":\"top\",\"index\":6},\"Виды поля\":{\"edge\":\"bottom\",\"index\":13},\"Наложение\":{\"edge\":\"left\",\"index\":14},\"gz:xorrom\":{\"edge\":\"top\",\"index\":9}}",
  "mayatnik-dd-grid": null,
  "mayatnik-dd-order": "[]",
  "mayatnik-dd-pins": "[\"Виды поля\",\"Очистка\",\"Вид\",\"Наложение\",\"Точка Ось\",\"Свёртки\",\"Зеркала\",\"Слои\",\"Ячейки\",\"Площади\",\"Ручные оси\"]",
  "mayatnik-dd-fold": "[\"Наложение\",\"Слои\",\"Ячейки\",\"Свёртки\",\"Площади\",\"Зеркала\",\"Ручные оси\",\"Точка Ось\"]",
  "mayatnik-dd-mini": "[]",
  "mayatnik-dd-open": "",
  "mayatnik-dd-up": "[\"horr\",\"ochki\",\"zoom\",\"paint\",\"gifscale\",\"export\",\"edge\",\"xorrom\"]",
  "mayatnik-bot": "[\"gz:horr\",\"Площади\"]",
  "mayatnik-botx": "{}",
  "mayatnik-rail-mini": null,
  "mayatnik-control-mini-v464": "[]",
  "mayatnik-pins": null,
  "mayatnik-horr-section-v1": "rombo",
  "mayatnik-horr-section-open-v1": "0"
} );
 const KEYS=Object.freeze(Object.keys(DEFAULTS)),MARKERS=Object.freeze(['mayatnik-template-rail-merge-v496','mayatnik-template-merge-v485','mayatnik-mirror-group-merge','mayatnik-horr-group-v441','mayatnik-areas-bottom-v427','mayatnik-dd-single-row-v461']);
 const ALL=Object.freeze([...KEYS,...MARKERS]);
 function validate(values){if(!values||typeof values!=='object'||Array.isArray(values))throw Error('Некорректная раскладка кнопок');for(const [key,value]of Object.entries(values)){if(!KEYS.includes(key)||value!==null&&typeof value!=='string')throw Error('Недопустимый ключ раскладки кнопок: '+key);}for(const key of KEYS)if(!Object.hasOwn(values,key))throw Error('Неполная раскладка кнопок');return Object.fromEntries(KEYS.map(key=>[key,values[key]]));}
 function create({storage,apply,flush,persist=true}={}){
  let busy=false;const capture=()=>Object.fromEntries(ALL.map(key=>[key,storage.getItem(key)]));
  function write(values){for(const key of ALL){const value=values[key]??null;if(value===null)storage.removeItem(key);else storage.setItem(key,value);}for(const key of ALL)if(storage.getItem(key)!==(values[key]??null))throw Error('Настройки кнопок записаны не полностью');}
  const wanted=()=>({...validate(DEFAULTS),...Object.fromEntries(MARKERS.map(key=>[key,'1']))});
  function seed(){if(!persist)return false;if(KEYS.some(key=>storage.getItem(key)!==null))return false;const previous=capture();try{write(wanted());return true;}catch(error){try{write(previous);}catch(rollback){throw new AggregateError([error,rollback],'Не удалось восстановить прежние настройки кнопок');}throw error;}}
  async function reset(){if(busy)throw Error('Дождитесь сброса кнопок');if(typeof apply!=='function')throw Error('Меню ещё не готово');busy=true;let previous;try{if(persist)flush?.();previous=capture();const values=wanted();if(persist)write(values);await apply({...DEFAULTS});if(persist)write(values);return true;}catch(error){if(previous){try{if(persist)write(previous);await apply(Object.fromEntries(KEYS.map(key=>[key,previous[key]])));if(persist)write(previous);}catch(rollback){throw new AggregateError([error,rollback],'Не удалось восстановить прежние настройки кнопок');}}throw error;}finally{busy=false;}}
  return {seed,reset,capture:()=>Object.fromEntries(KEYS.map(key=>[key,storage.getItem(key)])),isBusy:()=>busy};
 }
 return {create,validate,keys:KEYS,markers:MARKERS,defaults:DEFAULTS};
});