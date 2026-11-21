/* A compound keeps its ordered masks and the independent sources below overlaps. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikTemplateCompound=api;})(globalThis,function(){
  'use strict';
  const MAX_PIXELS=12e6,MAX_DEPTH=12;
  const path=part=>part.compoundPath||part.sourceOrigin?.compoundPath||[];
  const validTint=value=>value==null||/^#[0-9a-f]{6}$/i.test(value);
  function metadata(item){return item?.compound?.version===1?item.compound:null;}
  function snapshot(item){const value=metadata(item);return value?{version:1,members:structuredClone(value.members),paths:item.parts.map(p=>path(p).slice())}:null;}
  function attach(parts,compound){
    if(!compound)return parts;
    return parts.map((part,i)=>{const compoundPath=compound.paths[i].slice();return {...part,compoundPath,...(part.sourceOrigin?{sourceOrigin:{...part.sourceOrigin,compoundPath}}:{})};});
  }
  function validate(shape){
    let pixels=0;
    function mask(part,axis=false){
      if(!part||!Number.isInteger(part.width)||!Number.isInteger(part.height)||part.width<1||part.height<1||part.width>32768||part.height>32768||!Array.isArray(part.data)||part.data.length!==part.width*part.height||part.data.some(v=>!Number.isInteger(v)||v<0||v>0xffffffff))throw Error('Повреждена маска сборного шаблона');
      pixels+=part.data.length;if(pixels>MAX_PIXELS*4)throw Error('Сборный шаблон слишком большой');
      if(axis&&(![part.x,part.y,part.axis].every(Number.isFinite)||part.axisOriginY!=null&&!Number.isFinite(part.axisOriginY)))throw Error('Повреждено положение части сборного шаблона');
      if(part.bits!=null&&(!Array.isArray(part.bits)||part.bits.length!==part.data.length||part.bits.some(b=>![-1,0,1].includes(b))))throw Error('Повреждены биты сборного шаблона');
    }
    function visit(value,depth){
      if(depth>MAX_DEPTH||!value||!/^#[0-9a-f]{6}$/i.test(value.hex)||!Number.isFinite(value.rk)||value.rk<1||value.rk>8||!Array.isArray(value.parts)||!value.parts.length||value.parts.length>2)throw Error('Повреждён исходник сборного шаблона');
      value.parts.forEach(p=>mask(p));
      if(value.axisParts){if(!Array.isArray(value.axisParts)||!value.axisParts.length||value.axisParts.length>10000)throw Error('Повреждён состав шаблона');value.axisParts.forEach(p=>mask(p,true));}
      const compound=value.compound;if(!compound)return;
      if(value.alpha!=null&&(!Number.isFinite(value.alpha)||value.alpha<0||value.alpha>100))throw Error('Повреждена прозрачность сборного шаблона');
      if(compound.version!==1||!Array.isArray(compound.members)||!compound.members.length||compound.members.length>1000||!value.axisParts||!Array.isArray(compound.paths)||compound.paths.length!==value.axisParts.length)throw Error('Повреждён состав сборного шаблона');
      for(const member of compound.members){if(!member||typeof member.name!=='string'||member.name.length>200||!/^#[0-9a-f]{6}$/i.test(member.hex)||!validTint(member.tint)||member.opacity!=null&&(!Number.isFinite(member.opacity)||member.opacity<0||member.opacity>1)||member.visible!=null&&typeof member.visible!=='boolean')throw Error('Повреждён участник сборного шаблона');visit(member.source,depth+1);}
      for(const indices of compound.paths){if(!Array.isArray(indices)||!indices.length||indices.length>MAX_DEPTH)throw Error('Нет принадлежности части сборного шаблона');let group=compound;for(const index of indices){if(!group||!Number.isInteger(index)||index<0||index>=group.members.length)throw Error('Неверный участник сборного шаблона');group=group.members[index].source.compound;}if(group)throw Error('Неполная принадлежность вложенной части');}
    }
    visit(shape,0);return shape;
  }
  function build(items,{rk,anchor,rect,source,colours,layer}){
    const members=[],axisParts=[],paths=[];let pixels=0;
    for(const [memberIndex,item]of items.entries()){
      const offset=layer(item)||{x:0,y:0};
      const original=source(item);members.push({name:String(item.name||item.hex).slice(0,200),hex:item.hex,source:original,bits:structuredClone(item.bits||{one:0,zero:0,empty:0}),view:structuredClone(item.view||{}),opacity:offset.opacity??1,visible:offset.visible!==false,tint:offset.tint||null});
      for(const part of item.parts){
        const m=part.mask,r=rect(part,item),x=Math.floor(r.x+offset.x),y=Math.floor(r.y+offset.y),width=Math.max(1,Math.ceil(r.x+offset.x+r.width)-x),height=Math.max(1,Math.ceil(r.y+offset.y+r.height)-y);
        pixels+=width*height;if(!Number.isSafeInteger(width*height)||pixels>MAX_PIXELS)throw Error('Сборный шаблон слишком большой — уменьшите выбранные фигуры');
        const input=colours(part,item),data=new Array(width*height).fill(0),bits=part.bitsData?new Array(width*height).fill(-1):null;
        for(let yy=0;yy<height;yy++)for(let xx=0;xx<width;xx++){
          const u=(x+xx+.5-offset.x-r.x)/r.width,v=(y+yy+.5-offset.y-r.y)/r.height;if(u<0||v<0||u>=1||v>=1)continue;
          const q=Math.floor(v*m.height)*m.width+Math.floor(u*m.width),j=yy*width+xx;if(!m.data[q])continue;data[j]=input[q];if(bits)bits[j]=part.bitsData[q];
        }
        axisParts.push({x:x-anchor,y,width,height,axis:0,axisOriginY:0,data,...(bits?{bits}:{})});paths.push([memberIndex,...(metadata(item)?path(part):[])]);
      }
    }
    if(!axisParts.length||!axisParts.some(p=>p.data.some(Boolean)))throw Error('В выбранных шаблонах нет клеток');
    const left=Math.min(...axisParts.map(p=>p.x)),top=Math.min(...axisParts.map(p=>p.y)),right=Math.max(...axisParts.map(p=>p.x+p.width)),bottom=Math.max(...axisParts.map(p=>p.y+p.height));
    const width=right-left,height=bottom-top;if(width*height>MAX_PIXELS)throw Error('Между шаблонами слишком большое расстояние для одной сборки');
    const data=new Array(width*height).fill(0),center=(left+right)/2;
    for(const part of axisParts){part.axis=center;part.axisOriginY=top;for(let y=0;y<part.height;y++)for(let x=0;x<part.width;x++){const value=part.data[y*part.width+x];if(value)data[(part.y-top+y)*width+part.x-left+x]=value;}}
    return validate({hex:items.at(-1).hex,rk,height:100,down:0,x:0,proportional:false,parts:[{width,height,y:top,center:center/rk,data}],axisParts,compound:{version:1,members,paths}});
  }
  function groups(item){
    const compound=metadata(item);if(!compound)return [];
    return compound.members.map((member,index)=>({member,parts:item.parts.filter(p=>path(p)[0]===index).map(p=>{const compoundPath=path(p).slice(1);return {...p,compoundPath,...(p.sourceOrigin?{sourceOrigin:{...p.sourceOrigin,compoundPath}}:{})};})}));
  }
  function validateField(item){
    if(!item.compound)return;
    const compound=item.compound;
    if(compound.version!==1||!Array.isArray(compound.members)||!compound.members.length||compound.members.length>1000)throw Error('Повреждён сборный шаблон поля');
    for(const member of compound.members){if(!member||typeof member.name!=='string'||!/^#[0-9a-f]{6}$/i.test(member.hex)||!validTint(member.tint)||member.opacity!=null&&(!Number.isFinite(member.opacity)||member.opacity<0||member.opacity>1))throw Error('Повреждён участник сборного шаблона поля');validate(member.source);}
    for(const part of item.parts){const indices=path(part);if(!Array.isArray(indices)||!indices.length||indices.length>MAX_DEPTH)throw Error('Нет принадлежности части сборного шаблона поля');let group=compound;for(const index of indices){if(!group||!Number.isInteger(index)||index<0||index>=group.members.length)throw Error('Повреждена принадлежность части сборного шаблона поля');group=group.members[index].source.compound;}if(group)throw Error('Неполная принадлежность вложенной части');}
  }
  function raster(parts,rects,compound,canvasOf,doc){
    function draw(indices,group,depth){
      if(!indices.length)return null;
      const left=Math.floor(Math.min(...indices.map(i=>rects[i].x))),top=Math.floor(Math.min(...indices.map(i=>rects[i].y))),right=Math.ceil(Math.max(...indices.map(i=>rects[i].x+rects[i].width))),bottom=Math.ceil(Math.max(...indices.map(i=>rects[i].y+rects[i].height))),width=right-left,height=bottom-top;
      if(!(width>0&&height>0)||width*height>MAX_PIXELS)throw Error('Сборный шаблон слишком большой для отображения');
      const canvas=doc.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
      if(group){for(const [index,member]of group.members.entries()){
        if(member.visible===false)continue;const child=draw(indices.filter(i=>path(parts[i])[depth]===index),member.source.compound,depth+1);if(!child)continue;
        if(member.tint&&doc.defaultView?.MayatnikLayers){
          const paint=child.canvas.getContext('2d');
          const image=paint.getImageData(0,0,child.width,child.height);
          image.data.set(doc.defaultView.MayatnikLayers.tintPixels(image.data,member.tint));
          paint.putImageData(image,0,0);
        }
        ctx.globalAlpha=member.opacity??1;ctx.drawImage(child.canvas,child.x-left,child.y-top);
      }}else for(const i of indices){const r=rects[i];ctx.drawImage(canvasOf(parts[i]),r.x-left,r.y-top,r.width,r.height);}
      return {canvas,x:left,y:top,width,height};
    }
    return draw(parts.map((_,i)=>i),compound,0);
  }
  // Intersect occupied cell rectangles, including a line lying on a cell edge.
  function touches(part,r,x,top=-Infinity,bottom=Infinity){
    const m=part.mask;if(x<r.x||x>r.x+r.width)return false;const column=(x-r.x)/r.width*m.width;
    for(const c of new Set([Math.floor(column),Math.ceil(column)-1])){if(c<0||c>=m.width)continue;for(let y=0;y<m.height;y++)if(m.data[y*m.width+c]&&r.y+(y+1)/m.height*r.height>top&&r.y+y/m.height*r.height<bottom)return true;}return false;
  }
  return {metadata,snapshot,attach,validate,validateField,build,groups,raster,touches};
});
