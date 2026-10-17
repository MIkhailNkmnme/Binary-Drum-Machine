/* Row wave: every target reads the already updated upper row. No rendering dependencies. */
(function(root){
  'use strict';
  function create(rows,rule='neighbors'){return {base:rows.slice(),expected:rows.join('\n'),rule,cursor:0,frame:0,last:[],history:[],unit:'row',speed:2,stopWatch:false};}
  function targets(rows){const ids=[];for(let r=0;r<rows.length;r++)if(rows[r].length)ids.push(r);return ids;}
  function changed(before,after){const out=[];for(let r=0;r<after.length;r++)for(let j=0;j<after[r].length;j++)if(before[r]?.[j]!==after[r][j])out.push({r,j,from:Number(before[r][j]),to:Number(after[r][j])});return out;}
  function waveRow(rows,a,b,rule){const A=rows[a],B=rows[b],shift=(B.length-A.length)/2;
    const bit=k=>Number.isInteger(k)&&k>=0&&k<A.length?Number(A[k]):0;
    let out='';for(let j=0;j<B.length;j++){const k=j-shift,upper=rule==='neighbors'?bit(k-1)^bit(k+1):bit(k);out+=String(Number(B[j])^upper);}rows[b]=out;
  }
  function step(rows,s,unit='row'){
    const ids=targets(rows);if(ids.length<2)return false;
    const before=rows.slice(),old={cursor:s.cursor,frame:s.frame};
    const remaining=ids.length-1-s.cursor,n=unit==='frame'?remaining:1;
    for(let i=0;i<n;i++){waveRow(rows,ids[s.cursor],ids[s.cursor+1],s.rule);if(++s.cursor===ids.length-1){s.cursor=0;s.frame++;}}
    const patch=[];for(let r=0;r<rows.length;r++)if(rows[r]!==before[r])patch.push([r,before[r]]);
    s.history.push({...old,patch});if(s.history.length>128)s.history.shift();s.last=changed(before,rows);s.expected=rows.join('\n');return true;
  }
  function back(rows,s){const old=s.history.pop();if(!old)return false;for(const [r,text] of old.patch)rows[r]=text;s.cursor=old.cursor;s.frame=old.frame;const prior=s.history.at(-1),before=rows.slice();if(prior)for(const [r,text] of prior.patch)before[r]=text;s.last=prior?changed(before,rows):[];s.expected=rows.join('\n');return true;}
  function reset(rows,s){rows.splice(0,rows.length,...s.base);return {...create(rows,s.rule),watch:s.watch,stopWatch:!!s.stopWatch,unit:s.unit||'row',speed:s.speed||2};}
  const api={create,targets,changed,waveRow,step,back,reset};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FoldAnimCore=api;
})(typeof window!=='undefined'?window:globalThis);
