/* Non-destructive grid filters. Coordinates are zero-based; row/column labels
   and nested survivor lists are one-based. First cell parity is checkerboard. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ZerkGridParity=api;})(globalThis,function(){
  'use strict';
  const axes={rows:'rowLevels',cells:'cellLevels',cols:'colLevels'},keys=Object.keys(axes).flatMap(axis=>[axis+'Even',axis+'Odd']);
  function normalize(value={}){
    const out=Object.fromEntries(keys.map(key=>[key,value?.[key]!==false]));
    for(const name of Object.values(axes))out[name]=Array.isArray(value?.[name])?value[name].map(level=>({even:level?.even!==false,odd:level?.odd!==false})):[];
    out.rowFill=['above','below'].includes(value?.rowFill)?value.rowFill:'none';return out;
  }
  // Each selective stage doubles the stride; preceding cells are never scanned.
  function progression(first,levels,zeroEven=false){
    let offset=0,stride=1,empty=false;
    for(const [i,level]of [first,...levels].entries()){
      if(!level.even&&!level.odd){empty=true;break;}
      if(level.even&&level.odd)continue;
      const pick=i===0&&zeroEven?(level.even?0:1):(level.odd?0:1);
      if(pick)offset+=stride;stride*=2;
      if(offset>Number.MAX_SAFE_INTEGER){empty=true;break;}
      if(stride>Number.MAX_SAFE_INTEGER)stride=Infinity;
    }
    return {offset,stride,empty};
  }
  const contains=(p,index)=>!p.empty&&index>=p.offset&&(index===p.offset||(index-p.offset)%p.stride===0);
  function compile(value={}){
    const settings=normalize(value),first=axis=>({even:settings[axis+'Even'],odd:settings[axis+'Odd']}),rows=progression(first('rows'),settings.rowLevels),cols=progression(first('cols'),settings.colLevels);
    const cells=[0,1].map(row=>progression(row?{even:settings.cellsOdd,odd:settings.cellsEven}:first('cells'),settings.cellLevels,true));
    function sourceRow(row,height=Infinity){
      if(!Number.isInteger(row)||row<0||row>=height||rows.empty||rows.offset>=height)return -1;
      if(contains(rows,row))return row;
      if(settings.rowFill==='none')return -1;
      if(!Number.isFinite(rows.stride))return rows.offset;
      const last=Number.isFinite(height)?rows.offset+Math.floor((height-1-rows.offset)/rows.stride)*rows.stride:Infinity;
      let source=rows.offset+(settings.rowFill==='above'?Math.floor:Math.ceil)((row-rows.offset)/rows.stride)*rows.stride;
      return Math.max(rows.offset,Math.min(last,source));
    }
    function visible(row,col,height=Infinity){
      if(!Number.isInteger(col)||col<0)return false;
      const source=sourceRow(row,height);return source>=0&&contains(cols,col)&&contains(cells[source%2],col);
    }
    function columns(row,height=Infinity){
      const source=sourceRow(row,height),cell=cells[source%2];
      if(source<0||cols.empty||cell.empty)return {offset:0,stride:1,empty:true};
      const a=cols.stride>=cell.stride?cols:cell,b=a===cols?cell:cols;
      return {offset:a.offset,stride:a.stride,empty:!contains(b,a.offset)};
    }
    const active=keys.some(key=>settings[key]===false)||Object.values(axes).some(name=>settings[name].some(level=>!level.even||!level.odd));
    function materialize(field,height=field.H){
      if(!active)return field.val;
      const result=new Int8Array(field.W*field.H).fill(-1);
      for(let row=0;row<Math.min(height,field.H);row++){
        const source=sourceRow(row,height),p=columns(row,height);if(source<0||p.empty)continue;
        for(let col=p.offset;col<field.W;col+=p.stride)result[row*field.W+col]=field.val[source*field.W+col];
      }return result;
    }
    // Clamp periods outside the finite field to signed WGSL parameter range.
    function gpu(width,height){
      const bound=(p,n)=>p.empty||p.offset>=n?[n+1,1]:[p.offset,Math.min(p.stride,n+1)];
      return [...bound(rows,height),...bound(cols,width),...bound(cells[0],width),...bound(cells[1],width),settings.rowFill==='above'?1:settings.rowFill==='below'?2:0];
    }
    return {settings,rows,cols,cells,sourceRow,visible,columns,active,materialize,gpu};
  }
  function update(value,axis,index,key,on){
    if(!axes[axis]||!Number.isInteger(index)||index<0||!['even','odd'].includes(key))return null;
    const out=normalize(value);if(index===0)out[axis+(key==='even'?'Even':'Odd')]=!!on;
    else {if(index>out[axes[axis]].length)return null;out[axes[axis]][index-1][key]=!!on;}return out;
  }
  // A row uses a periodic horizontal tile, so the exact mask costs O(height),
  // rather than one SVG element per cell on large fields or deep filters.
  function maskSvg(plan,{width,height,origin=0,anchor=0,displayWidth=width,displayHeight=height,panels=[{p:-1,ox:0}]}){
    const defs=[],groups=[],tiles=new Map();
    for(const [pi,panel]of panels.entries()){
      const parts=[],p=panel.p,diamond=p>=0;
      for(let row=0;row<height;row++){
        let {offset,stride,empty}=plan.columns(row,height);if(empty)continue;
        if(diamond){const parity=((anchor+row+p)%2+2)%2;if(stride===1){offset=parity;stride=2;}else if(offset%2!==parity)continue;}
        const first=Number.isFinite(stride)?offset+Math.max(0,Math.ceil((origin-offset)/stride))*stride:offset;if(first<origin||first>=origin+width)continue;
        const period=Math.min(stride,width+2),x=first-origin,y=diamond?row%2+.5:0,key=[diamond,x,period,y].join(':');let id=tiles.get(key);
        if(!id){id='t'+tiles.size;tiles.set(key,id);let shapes='';
          if(diamond)for(const cx of [0,period])for(const cy of [0,2])shapes+=`M${cx} ${cy-1}l1 1 -1 1 -1 -1Z`;
          defs.push(diamond?`<pattern id="${id}" width="${period}" height="2" patternUnits="userSpaceOnUse" patternTransform="translate(${x+.5} ${y})"><path d="${shapes}" fill="white"/></pattern>`:`<pattern id="${id}" width="${period}" height="1" patternUnits="userSpaceOnUse" patternTransform="translate(${x} 0)"><rect width="1" height="1" fill="white"/></pattern>`);
        }
        parts.push(`<rect x="0" y="${diamond?row-.5:row}" width="${width}" height="${diamond?2:1}" fill="url(#${id})"/>`);
      }
      const clip='c'+pi;defs.push(`<clipPath id="${clip}">${panel.outline?`<path d="${panel.outline}"/>`:`<rect width="${width}" height="${height}"/>`}</clipPath>`);
      groups.push(`<g transform="${panel.matrix?`matrix(${panel.matrix.join(' ')})`:`translate(${panel.ox||0} 0)`}" clip-path="url(#${clip})">${parts.join('')}</g>`);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${displayWidth}" height="${displayHeight}" viewBox="0 0 ${displayWidth} ${displayHeight}"><defs>${defs.join('')}</defs>${groups.join('')}</svg>`;
  }
  const extended=s=>s.rowFill==='above'||s.rowFill==='below'||s.rowLevels?.length||s.cellLevels?.length||s.colLevels?.length;
  function visible(row,col,settings={},height=Infinity){
    if(!Number.isInteger(row)||!Number.isInteger(col)||row<0||row>=height||col<0)return false;
    if(extended(settings))return compile(settings).visible(row,col,height);
    return settings[row%2?'rowsEven':'rowsOdd']!==false&&settings[(row+col)%2?'cellsOdd':'cellsEven']!==false&&settings[col%2?'colsEven':'colsOdd']!==false;
  }
  return {axes,keys,normalize,compile,update,maskSvg,visible,active:(settings={})=>keys.some(key=>settings[key]===false)||(extended(settings)?compile(settings).active:false)};
});
