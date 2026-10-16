/* Layout only: one root on top, each nested level a row of up to five below. */
(function(root){
  'use strict';
  function layout(tree,{promoted=[],open=[],hidden=[],rows=5}={}){
    const index=new Map(),lifted=new Set(promoted),opened=new Set(open),invisible=new Set(hidden);
    const visit=n=>{index.set(n.id,n);n.children?.forEach(visit);};visit(tree);
    const available=n=>!invisible.has(n.id)&&(!n.children||n.action||n.children.some(c=>!lifted.has(c.id)&&available(c)));
    // Hub v0.207: уровни идут вниз рядами — сверху одна кнопка, под ней ряд до пяти, дальше следующий уровень.
    const top=available(tree)?[tree]:[],lift=promoted.map(id=>index.get(id)).filter(n=>n&&n!==tree&&available(n));
    const cells=[];let row=0,columns=1;
    const put=list=>{list.forEach((node,i)=>cells.push({id:node.id,column:i%rows,row:row+Math.floor(i/rows)}));if(list.length){row+=Math.ceil(list.length/rows);columns=Math.max(columns,Math.min(rows,list.length));}};
    // Hub v0.213: корень и закреплённые — пирамидой 1, 2, 3… ромбы гранями впритык (шаг полромба).
    // pyr = [dx, dy] в полуромбах от вершины; следующий уровень начинается под пирамидой.
    const apex=[...top,...lift];let pr=0,pj=0;
    apex.forEach((node,i)=>{cells.push({id:node.id,column:0,row:0,head:i===0,pyr:[2*pj-pr,pr]});if(++pj>pr){pr++;pj=0;}});
    if(apex.length){const rowsUsed=pj?pr+1:pr;row=Math.ceil((24*(rowsUsed-1)+52)/52);}
    let level=[...top,...lift];
    while(level.length){
      level=level.flatMap(n=>opened.has(n.id)?(n.children||[]).filter(c=>!lifted.has(c.id)&&available(c)):[]);
      put(level);
    }
    return {cells,columns};
  }
  if(typeof module!=='undefined')module.exports={layout};else root.HubMenuTree={layout};
})(typeof window!=='undefined'?window:globalThis);
