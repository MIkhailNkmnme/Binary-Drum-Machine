/* Layout only: one root, nested levels, five buttons down each column. */
(function(root){
  'use strict';
  function layout(tree,{promoted=[],open=[],hidden=[],rows=5}={}){
    const index=new Map(),lifted=new Set(promoted),opened=new Set(open),invisible=new Set(hidden);
    const visit=n=>{index.set(n.id,n);n.children?.forEach(visit);};visit(tree);
    const available=n=>!invisible.has(n.id)&&(!n.children||n.action||n.children.some(c=>!lifted.has(c.id)&&available(c)));
    let level=[...(available(tree)?[tree]:[]),...promoted.map(id=>index.get(id)).filter(n=>n&&n!==tree&&available(n))],column=0;
    const cells=[];
    while(level.length){
      level.forEach((node,i)=>cells.push({id:node.id,column:column+Math.floor(i/rows),row:i%rows}));
      column+=Math.ceil(level.length/rows);
      level=level.flatMap(n=>opened.has(n.id)?(n.children||[]).filter(c=>!lifted.has(c.id)&&available(c)):[]);
    }
    return {cells,columns:Math.max(1,column)};
  }
  if(typeof module!=='undefined')module.exports={layout};else root.HubMenuTree={layout};
})(typeof window!=='undefined'?window:globalThis);
