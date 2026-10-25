/* Own storage for standalone grids; legacy data is read, never rewritten. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SetkaState=api;})(globalThis,function(){
 'use strict';const KEY='zerklus_setka_v1',clone=v=>JSON.parse(JSON.stringify(v));
 const validRows=rows=>Array.isArray(rows)&&rows.length>0&&rows.length<=4096&&rows.every(row=>typeof row==='string'&&/^[01]{1,4096}$/.test(row));
 const read=(storage,key)=>{try{return JSON.parse(storage.getItem(key)||'null');}catch(_){return null;}};
 function source(storage){const main=read(storage,'zazerkalius_v1'),solo=read(storage,'zazerkalius_solo_rmb');return main||solo||{};}
 function load(storage){
  const saved=read(storage,KEY);if(saved&&validRows(saved.grids?.rows))return clone(saved);
  const old=source(storage),legacy=validRows(old.grids?.rows)?old:read(storage,'zazerkalius_solo_rmb')||{};
  return {grids:validRows(legacy.grids?.rows)?clone(legacy.grids):{rows:['0'],cur:0,align:'center',text:'',textBlocks:[],textWidth:null,colors:{},groups:{},dots:{},lines:{},scenes:[],tool:'',version:1},rmb:clone(legacy.rmb||{cell:'rmb',al:'zz',ln:'each',out:true}),triScenes:clone(old.triScenes||[]),triCells:clone(old.triCells||{}),triDots:clone(old.triDots||{}),triLines:clone(old.triLines||{})};
 }
 function rows(storage){const s=source(storage);return validRows(s.rows)?s.rows.slice():[];}
 function save(storage,state){storage.setItem(KEY,JSON.stringify({grids:state.grids,rmb:state.rmb,triScenes:state.triScenes,triCells:state.triCells,triDots:state.triDots,triLines:state.triLines}));}
 return {KEY,load,rows,save,validRows};
});
