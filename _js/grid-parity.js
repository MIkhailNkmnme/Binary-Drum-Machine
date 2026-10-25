/* Shared, non-destructive grid visibility. Indices are zero-based; row labels are one-based. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ZerkGridParity=api;})(globalThis,function(){
  'use strict';
  const keys=['cellsEven','cellsOdd','rowsEven','rowsOdd'];
  function visible(row,col,settings={}){
    if(!Number.isInteger(row)||!Number.isInteger(col)||row<0||col<0)return false;
    return settings[((row+1)%2)?'rowsOdd':'rowsEven']!==false&&settings[((row+col)%2)?'cellsOdd':'cellsEven']!==false;
  }
  return {visible,active:(settings={})=>keys.some(key=>settings[key]===false)};
});
