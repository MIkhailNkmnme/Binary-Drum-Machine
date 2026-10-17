/* Frozen scene: source pixels never depend on the pendulum clock. */
(()=>{'use strict';
  const $=id=>document.getElementById(id),status=$('status'),viewport=$('viewport');
  let snapshot=null,worker=null,generation=0,zoom=1,colourReady=false;
  const buttons=['save','png','totems','axes','clear'];
  function stop(){generation++;if(worker)worker.terminate();worker=null;$('cancel').disabled=true;}
  function zoomTo(z){if(!snapshot)return;zoom=Math.max(.02,Math.min(32,z));const {width:w,height:h}=snapshot.image;
    $('stage').style.transform=`scale(${zoom})`;$('stage').style.width=w+'px';$('stage').style.height=h+'px';$('space').style.width=Math.ceil(w*zoom)+'px';$('space').style.height=Math.ceil(h*zoom)+'px';$('zoom').textContent=Math.round(zoom*100)+'%';}
  function fit(){if(snapshot)zoomTo(Math.min(viewport.clientWidth/snapshot.image.width,viewport.clientHeight/snapshot.image.height));}
  function redrawLines(){if(!snapshot)return;const c=$('lines'),g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);g.strokeStyle='#ffd650';g.lineWidth=Math.max(1,snapshot.rasterScale*.35);
    for(const [a,b,x,y]of snapshot.axes||[]){g.beginPath();g.moveTo(a*snapshot.rasterScale,b*snapshot.rasterScale);g.lineTo(x*snapshot.rasterScale,y*snapshot.rasterScale);g.stroke();}}
  function load(s){if(!s?.image||!(s.image.pixels instanceof Uint8ClampedArray)||s.image.width*s.image.height*4!==s.image.pixels.length||!(s.field?.val instanceof Int8Array)||s.field.W*s.field.H!==s.field.val.length)throw Error('В файле нет полного снимка кадра');
    stop();snapshot=s;colourReady=false;for(const id of ['base','colours','lines']){$(id).width=s.image.width;$(id).height=s.image.height;}
    $('base').getContext('2d').putImageData(new ImageData(s.image.pixels,s.image.width,s.image.height),0,0);redrawLines();
    $('min').value=s.minRows||16;$('down').checked=s.down!==false;$('up').checked=s.up!==false;$('totems').classList.remove('on');buttons.forEach(id=>$(id).disabled=false);$('title').textContent=`Маятник · кадр ${s.frame}`;document.title=`Кадр ${s.frame} · Маятник`;
    status.textContent=`Кадр ${s.frame} · ${s.image.width} × ${s.image.height} · осей: ${(s.axes||[]).length} · анимация отсутствует`;fit();
  }
  function begin(kind){stop();const token=generation,min=Math.max(2,Math.min(4096,Number($('min').value)||16));snapshot.minRows=min;
    $('cancel').disabled=false;status.textContent=kind==='holes'?'Ищу чёрные треугольники…':'Ищу симметрию и треугольники…';
    const field={...snapshot.field,val:snapshot.field.val.slice()};
    try{worker=kind==='holes'?MayatnikTotems.createWorker():MayatnikSymmetry.createWorker();
      worker.onerror=()=>{stop();status.textContent='Не удалось выполнить расчёт. Можно сохранить кадр и повторить поиск.';};
      worker.onmessage=e=>{if(token!==generation)return;worker.terminate();worker=null;
        if(kind==='holes'){
          const lines=MayatnikTotems.edges(e.data,{width:field.W,height:field.H,lattice:snapshot.lattice,gap:snapshot.gap});
          const seen=new Set((snapshot.axes||[]).map(l=>l.join(',')));for(const l of lines)if(!seen.has(l.join(','))){seen.add(l.join(','));(snapshot.axes||=[]).push(l);}
          redrawLines();$('cancel').disabled=true;status.textContent=`Чёрных треугольников: ${e.data.length/5} · осей: ${snapshot.axes.length}`;
        }else paint(e.data.triangles,token);
      };
      const opts={anchor:snapshot.anchor,minRows:2,minBits:2,directions:kind==='holes'?[...($('down').checked?[1]:[]),...($('up').checked?[-1]:[])]:['v']};
      worker.postMessage({field,opts:{...opts,...(kind==='holes'?{minRows:min}:{})},totems:true,minTriangleRows:min,bits:false},[field.val.buffer]);
    }catch(e){stop();status.textContent='Расчёт не запущен: '+e.message;}
  }
  function paint(ts,token){const c=$('colours'),g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);let i=0;const scale=snapshot.rasterScale;
    const tick=()=>{if(token!==generation)return;const deadline=performance.now()+10;
      for(;i<ts.length&&performance.now()<deadline;i+=10){const p=ts[i+9],l=snapshot.lattice;
        if(l>=0&&l!==2&&l!==p)continue;
        const down=ts[i+1]<ts[i+3];if(down?!$('down').checked:!$('up').checked)continue;
        const ox=l===2&&p===1?snapshot.field.W+snapshot.gap:0;
        g.fillStyle=`rgba(${ts[i+6]},${ts[i+7]},${ts[i+8]},.10)`;g.beginPath();
        g.moveTo((ts[i]+ox+.5)*scale,(ts[i+1]+.5)*scale);g.lineTo((ts[i+2]+ox+.5)*scale,(ts[i+3]+.5)*scale);g.lineTo((ts[i+4]+ox+.5)*scale,(ts[i+5]+.5)*scale);g.closePath();g.fill();
      }
      if(i<ts.length){status.textContent=`Треугольники: ${Math.round(i/ts.length*100)}%`;requestAnimationFrame(tick);}
      else{colourReady=true;c.hidden=false;$('totems').classList.add('on');$('cancel').disabled=true;status.textContent=`Кадр ${snapshot.frame} · треугольников: ${ts.length/10} · слой готов, масштаб без пересчёта`;}
    };requestAnimationFrame(tick);
  }
  $('axes').onclick=()=>snapshot&&begin('holes');$('totems').onclick=()=>{if(!snapshot)return;if(colourReady){$('colours').hidden=!$('colours').hidden;$('totems').classList.toggle('on',!$('colours').hidden);}else begin('sym');};
  $('clear').onclick=()=>{stop();snapshot.axes=[];redrawLines();status.textContent='Оси убраны из этого кадра';};
  $('cancel').onclick=()=>{stop();colourReady=false;$('colours').getContext('2d').clearRect(0,0,$('colours').width,$('colours').height);$('totems').classList.remove('on');status.textContent='Расчёт отменён; кадр сохранён';};
  for(const id of ['min','up','down'])$(id).onchange=()=>{stop();if(snapshot){snapshot.minRows=Math.max(2,Number($('min').value)||16);snapshot.down=$('down').checked;snapshot.up=$('up').checked;}colourReady=false;$('colours').getContext('2d').clearRect(0,0,$('colours').width,$('colours').height);$('totems').classList.remove('on');};
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  $('save').onclick=async()=>{if(!snapshot)return;$('save').disabled=true;status.textContent='Сжимаю работу в фоне…';try{
    const {work,...view}=snapshot,data=structuredClone(work);if(!data)throw Error('Нет исходной работы');
    data.st.userLines=snapshot.axes.map(l=>l.slice());data.st.symTriangles=colourReady&&!$('colours').hidden;if(data.st.symTriangles){data.st.sym=true;data.st.symV=true;data.st.symH=false;data.st.symD=false;data.st.symTriangleRows=snapshot.minRows;}data.frameView={...view,overlay:colourReady?$('colours').getContext('2d').getImageData(0,0,$('colours').width,$('colours').height).data:null,overlayVisible:!$('colours').hidden};
    const file=await MayatnikWorkFile.run('encode',data);download(file,`mayatnik-kadr-${snapshot.frame}.mayatnik`);status.textContent=`Вся работа сохранена · ${(file.size/1048576).toFixed(2)} МиБ`;
  }catch(e){status.textContent='Не удалось сохранить: '+e.message;}finally{$('save').disabled=false;}};
  $('open').onclick=()=>$('file').click();$('file').onchange=async()=>{const file=$('file').files[0];if(!file)return;try{status.textContent='Открываю работу…';const {data}=await MayatnikWorkFile.run('decode',file);load({...data.frameView,work:data});
    if(data.frameView.overlay instanceof Uint8ClampedArray&&data.frameView.overlay.length===snapshot.image.pixels.length){$('colours').getContext('2d').putImageData(new ImageData(data.frameView.overlay,snapshot.image.width,snapshot.image.height),0,0);colourReady=true;$('colours').hidden=data.frameView.overlayVisible===false;$('totems').classList.toggle('on',!$('colours').hidden);}
  }catch(e){status.textContent='Файл не открыт: '+e.message;}finally{$('file').value='';}};
  $('png').onclick=()=>{const c=document.createElement('canvas');c.width=snapshot.image.width;c.height=snapshot.image.height;const g=c.getContext('2d');for(const id of ['base','colours','lines'])if(!$(id).hidden)g.drawImage($(id),0,0);c.toBlob(b=>b&&download(b,`mayatnik-kadr-${snapshot.frame}.png`));};
  $('plus').onclick=()=>zoomTo(zoom*2);$('minus').onclick=()=>zoomTo(zoom/2);$('fit').onclick=fit;
  viewport.addEventListener('wheel',e=>{if(!snapshot)return;e.preventDefault();const r=viewport.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,px=(viewport.scrollLeft+x)/zoom,py=(viewport.scrollTop+y)/zoom;zoomTo(zoom*(e.deltaY<0?1.25:.8));viewport.scrollLeft=px*zoom-x;viewport.scrollTop=py*zoom-y;},{passive:false});
  let drag=null;viewport.onpointerdown=e=>{if(e.button)return;drag={x:e.clientX,y:e.clientY,l:viewport.scrollLeft,t:viewport.scrollTop};viewport.setPointerCapture(e.pointerId);};viewport.onpointermove=e=>{if(drag){viewport.scrollLeft=drag.l+drag.x-e.clientX;viewport.scrollTop=drag.t+drag.y-e.clientY;}};viewport.onpointerup=viewport.onpointercancel=()=>drag=null;
  const id=location.hash.slice(1);addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==opener||e.data?.type!=='mayatnik-frame'||e.data.snapshot?.id!==id)return;try{load(e.data.snapshot);}catch(error){status.textContent=error.message;}});
  if(opener&&id)opener.postMessage({type:'mayatnik-frame-ready',id},location.origin);
})();
