/* v1 · Instruction diagrams use the production field and cross geometry. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),E=window.MayatnikGuideExample,X=window.MayatnikCrossMirrors;
  if(!E||!X||!window.ZZMirrorPendulum){$('exampleCaption').textContent='Не удалось загрузить схемы. Откройте страницу вместе с файлами инструкции.';return;}
  const engine=new ZZMirrorPendulum(E.rows,E.steps);engine.seek(E.frame,Infinity);
  const W=E.W,H=E.H,cross=E.cross,field=engine.field,valid=new Uint8Array(W*H),bits=new Int8Array(W*H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const q=y*W+x;bits[q]=field.val[y*field.W+x+E.VX];valid[q]=bits[q]>=0?1:0;}
  const box=[Math.floor(cross.left-43),-.5,Math.ceil(cross.right+43),63.5],width=box[2]-box[0],height=box[3]-box[1];
  const labels=X.labelAnchors(cross,box,(x,y)=>valid[Math.round(y)*W+Math.round(x)]===1);
  const names=Object.keys(X.LABELS),hues=['#d7bbff','#adaaff','#f5db94','#ffb99b','#a3c7ff','#c0d7ff','#9ce8c5','#71cfc3','#efb8db','#d1cf9e'];
  const source=Uint32Array.from(bits,(_,q)=>Math.max(0,names.indexOf(X.classify(cross,q%W,Math.floor(q/W))))+1);
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  function tone(hex,bit){const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));return '#'+rgb.map(n=>Math.round(n*(bit?1:.55)).toString(16).padStart(2,'0')).join('');}
  function svg(mapping,coloured,title){
    const paths=new Map();
    for(let y=0;y<=Math.min(H-1,Math.ceil(box[3]));y++)for(let x=Math.max(0,Math.floor(box[0]));x<Math.min(W,Math.ceil(box[2]));){
      const q=y*W+x,s=mapping?.[q]>=0?mapping[q]:q;if(!valid[q]){x++;continue;}
      const colour=coloured?tone(hues[source[s]-1],bits[s]):bits[s]?'#e8edf5':'#5b6475';let end=x+1;
      while(end<Math.min(W,Math.ceil(box[2]))){const qq=y*W+end,ss=mapping?.[qq]>=0?mapping[qq]:qq;if(!valid[qq]||(coloured?tone(hues[source[ss]-1],bits[ss]):bits[ss]?'#e8edf5':'#5b6475')!==colour)break;end++;}
      paths.set(colour,(paths.get(colour)||'')+`M${x-.5},${y-.5}h${end-x}v1h-${end-x}z`);x=end;
    }
    const C=cross,V=C.verticalX,D=C.diagX,Y=C.y,span=2*W;
    let lines=`M${box[0]},${Y}H${box[2]}M${V},${box[1]}V${box[3]}M${D-span},${Y-span}L${D+span},${Y+span}M${D-span},${Y+span}L${D+span},${Y-span}`;
    if(C.left!=null)lines+=`M${C.left},${Y}L${C.left+span},${Y+span}`;
    if(C.right!=null)lines+=`M${C.right},${Y}L${C.right-span},${Y+span}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box[0]} ${box[1]} ${width} ${height}" role="img" aria-label="${escape(title)}"><title>${escape(title)}</title><defs><clipPath id="fieldClip"><rect x="${box[0]}" y="${box[1]}" width="${width}" height="${height}"/></clipPath></defs><rect x="${box[0]}" y="${box[1]}" width="${width}" height="${height}" fill="#030507"/><g clip-path="url(#fieldClip)">${[...paths].map(([fill,d])=>`<path fill="${fill}" d="${d}" shape-rendering="crispEdges"/>`).join('')}<path d="${lines}" fill="none" stroke="#000" stroke-width=".38"/><path d="${lines}" fill="none" stroke="#b48cff" stroke-width=".38" stroke-dasharray="1.3 1.3"/>${labels.map(p=>`<g><rect x="${p.x-3.7}" y="${p.y-2.5}" width="7.4" height="5" rx=".6" fill="#edf1f8" stroke="#171c29" stroke-width=".15"/><text x="${p.x}" y="${p.y+.2}" dominant-baseline="middle" text-anchor="middle" fill="#111827" font-family="Segoe UI,sans-serif" font-size="3.2" font-weight="600">${escape(p.label)}</text></g>`).join('')}</g></svg>`;
  }
  $('sectorDiagram').innerHTML=svg(null,false,'Десять секторов креста: реальный Маятник, 128 строк, кадр36');
  $('exampleCaption').textContent=`Маятник: ${E.rows} строк, кадр ${E.frame}. Увеличенный верхний фрагмент; ${labels.length} обозначенных секторов.`;
  $('sourceSector').innerHTML=names.map(k=>`<option value="${k}">${escape(X.LABELS[k])}</option>`).join('');
  $('mirrorBefore').innerHTML=svg(null,true,'Исходные секторы перед зеркалом');
  const modes={lr:'Левая сторона отражена вправо.',rl:'Правая сторона отражена влево.',tb:'Верхняя сторона отражена вниз.',bt:'Нижняя сторона отражена вверх.'};
  function update(){const mode=$('mirrorMode').value,sector=$('sourceSector').value;$('sectorChoice').hidden=mode!=='sector';
    const mapping=X.mapping({W,H,crosses:[cross],mode,sector,valid});$('mirrorAfter').innerHTML=svg(mapping,true,'Результат зеркального преобразования');
    $('mirrorCaption').textContent=(modes[mode]||`Источник ${X.LABELS[sector]} отражён в доступные клетки остальных секторов.`)+' Линии границ сохранены.';
    window.MayatnikGuideProof={labels:labels.map(p=>({sector:p.sector,valid:X.classify(cross,p.x,p.y)===p.sector})),mode,sector,changed:Array.from(mapping).filter(q=>q>=0).length};
  }
  $('mirrorMode').addEventListener('change',update);$('sourceSector').addEventListener('change',update);update();
  $('downloadSectors').onclick=()=>{const blob=new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n'+$('sectorDiagram').innerHTML],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mayatnik-sectors-128-k36.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
})();
