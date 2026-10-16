/* Portable Hub snapshots. No DOM, storage or executable content in the format. */
(function(root){
  'use strict';
  const keys=['zerk_hub_mirror','zerk_hub_view','zerk_hub_flow','zerk_hub_pins','zerk_hub_visible_rows','zerk_hub_sidebar_collapsed','zerk_hub_all7','zerk_hub_locks'];
  const clone=x=>JSON.parse(JSON.stringify(x));
  function checkTree(value,depth=0){
    if(depth>24)throw Error('Слишком глубокая структура файла');
    if(typeof value==='number'&&(!Number.isFinite(value)||Math.abs(value)>1e12))throw Error('Некорректное число');
    if(typeof value==='string'&&value.length>90000000)throw Error('Слишком большой элемент');
    if(value&&typeof value==='object')for(const k of Object.keys(value)){
      if(['__proto__','prototype','constructor'].includes(k))throw Error('Недопустимый ключ');
      checkTree(value[k],depth+1);
    }
  }
  function validate(s){
    checkTree(s);
    if(s?.format!=='zerkalius-hub'||s.version!==1||!s.state||!s.settings)throw Error('Это не файл состояния Зеркалиуса');
    for(const k of Object.keys(s.settings))if(!keys.includes(k)||!(s.settings[k]===null||typeof s.settings[k]==='string'))throw Error('Неизвестная настройка');
    for(const k of keys.filter(k=>['mirror','view','flow','pins','locks'].some(n=>k.endsWith('_'+n))))if(s.settings[k])checkTree(JSON.parse(s.settings[k]));
    const rows=s.state.scene?.music?.rows;
    if(!Array.isArray(rows)||!rows.length||rows.length>4096||rows.some(r=>typeof r!=='string'||r.length>8192||!/^[01]+$/.test(r)))throw Error('Некорректные биты');
    for(const name of ['snowGrid','waterGrid'])if(s.state.flow?.[name])unpack(s.state.flow[name]);
    if(s.state.image&&!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s.state.image))throw Error('Некорректная картинка');
    if(typeof s.name!=='string'||s.name.length>160)throw Error('Некорректное название');
    if(!s.state.view?.state||!s.state.mirror?.state)throw Error('Нет положения поля или зеркала');
    const vector=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(Number.isFinite);
    const view=s.state.view.state;
    for(const key of ['pan','sourcePan'])if(key in view&&!vector(view[key],2))throw Error('Некорректное положение поля');
    if('zoom' in view&&(!Number.isFinite(view.zoom)||view.zoom<.2||view.zoom>6))throw Error('Некорректный масштаб');
    const flow=s.state.flow;
    if(!flow||typeof flow!=='object')throw Error('Нет состояния потоков');
    if(flow){
      if(!Array.isArray(flow.rays)||flow.rays.length>350)throw Error('Некорректные лучи');
      for(const r of flow.rays)if(!['x','y','vx','vy','age','bounces'].every(k=>Number.isFinite(r[k]))||r.trail&&(!Array.isArray(r.trail)||r.trail.length>20000||r.trail.some(p=>!vector(p,4))))throw Error('Некорректный путь луча');
    }
    const trace=s.state.scene.trace?.balls;
    if(trace&&(!Array.isArray(trace)||trace.length>7||trace.some(b=>!['x','y','vx','vy','t','tri'].every(k=>Number.isFinite(b[k]))||Math.abs(b.vx)>1e6||Math.abs(b.vy)>1e6||!Array.isArray(b.trail)||b.trail.length>8)))throw Error('Некорректные дорожки битов');
    if(s.state.ui?.scroll&&!vector(s.state.ui.scroll,2))throw Error('Некорректное положение меню');
    for(const opened of [s.state.ui?.open,s.state.ui?.menu?.open])if(opened&&(!Array.isArray(opened)||opened.some(v=>typeof v!=='string')))throw Error('Некорректная структура меню');
    const pins=JSON.parse(s.settings.zerk_hub_pins||'{}');
    for(const key of ['groups','controls'])if(pins[key]&&(!Array.isArray(pins[key])||pins[key].length>250||pins[key].some(v=>typeof v!=='string')))throw Error('Некорректные закрепы');
    const mirror=s.state.mirror.state;
    if(mirror.bitView&&!['rhombs','digits','brackets','parentheses','slashes','angles','stars'].includes(mirror.bitView)||mirror.pattern&&!['base','serp','horr'].includes(mirror.pattern))throw Error('Неизвестный вид битов');
    if(mirror.custom&&['bit','mirror','fold','sym'].some(k=>!/^#[0-9a-f]{6}$/i.test(mirror.custom[k]||'')))throw Error('Некорректный цвет');
    // The live angles/positions are authoritative, including frames not yet
    // flushed to the ordinary settings store by an animation.
    s.settings.zerk_hub_view=JSON.stringify(view);s.settings.zerk_hub_mirror=JSON.stringify(mirror);
    return s;
  }
  function pack(field){
    if(!field)return null;
    // Runs of occupied cells avoid allocating millions of JSON numbers for empty fields.
    const runs=[];let start=-1,values=[];
    for(let i=0;i<=field.water.length;i++){
      if(i<field.water.length&&field.water[i]!==0){if(start<0)start=i;values.push(field.water[i]);}
      else if(start>=0){runs.push([start,values]);start=-1;values=[];}
    }
    return {width:field.width,height:field.height,tick:field.tick,drained:field.drained,runs};
  }
  function unpack(g){
    if(!Number.isInteger(g.width)||!Number.isInteger(g.height)||g.width<1||g.height<1||g.width*g.height>16777216||!Array.isArray(g.runs))throw Error('Некорректный размер потока');
    const data=new Float32Array(g.width*g.height);let end=0;
    for(const run of g.runs){
      if(!Array.isArray(run)||run.length!==2)throw Error('Некорректный поток');
      const [start,values]=run;
      if(!Number.isInteger(start)||start<end||!Array.isArray(values)||start+values.length>data.length||values.some(v=>!Number.isFinite(v)||v<0||v>1))throw Error('Некорректное заполнение');
      data.set(values,start);end=start+values.length;
    }
    return data;
  }
  function restoreGrid(field,g){
    if(!g)return;const data=unpack(g);
    // Preserve native pixel positions on another screen; crop only outside its bounds.
    for(let y=0;y<Math.min(field.height,g.height);y++)field.water.set(data.subarray(y*g.width,y*g.width+Math.min(field.width,g.width)),y*field.width);
    field.tick=g.tick||0;field.drained=g.drained||0;
    if(field.activeRows){field.activeRows.clear();for(let y=0;y<field.height;y++)if(field.water.subarray(y*field.width,(y+1)*field.width).some(v=>v>0))field.activeRows.add(y);}
  }
  function applyKnown(target,source){for(const key of Object.keys(target))if(Object.hasOwn(source||{},key)&&((target[key]===null)||(typeof target[key]===typeof source[key])))target[key]=clone(source[key]);}
  const api={keys,clone,validate,pack,unpack,restoreGrid,applyKnown};
  if(typeof module!=='undefined')module.exports=api;else root.HubPresetCore=api;
})(typeof window!=='undefined'?window:globalThis);
