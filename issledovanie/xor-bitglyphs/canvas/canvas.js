(function(){
  'use strict';
  const $=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d'),pack=window.ZerkKraftwerk;
  const STORE='zerk-bitglyph-canvas-v1:'+location.search,NS='http://www.w3.org/2000/svg';
  const camera={x:0,y:0,zoom:1};
  let project=null,buckets=new Map(),geometry=new Map(),undo=[],redo=[],stroke=null,pointer=null,space=false,dirty=false,scheduled=false,saveTimer=0,ready=false;
  const colour=value=>{if(typeof value!=='string'||!/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value))return null;return (value.length===4?'#'+[...value.slice(1)].map(c=>c+c).join(''):value).toLowerCase();};
  const finite=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1000000;
  function say(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
  function fail(error){say(error?.message||String(error),true);}
  function displayStatus(){say(project.placements.length+' фигур · '+project.width+' × '+project.height+' · '+Math.round(camera.zoom*100)+'%'+(dirty?' · изменено':''));}
  function points(p){
    if(p.points)return p.points;
    if(!geometry.has(p.maskId)){const m=pack.mask(p.maskId),pal=pack.palette(project.paletteId);geometry.set(p.maskId,m.points.map(([x,y])=>[x+11,y+11,m.pivotOccupied&&!x&&!y?pal.pivot:pal.bit]));}
    return geometry.get(p.maskId);
  }
  function cells(i){const p=project.placements[i],result=new Map(points(p).map(([x,y,c])=>[String(y*23+x),c]));for(const [key,value]of Object.entries(project.edits[String(i)]||{})){if(value===null)result.delete(key);else result.set(key,value);}return result;}
  function buildIndex(){buckets=new Map();geometry=new Map();project.placements.forEach((p,i)=>{for(let y=Math.floor(p.y/64);y<=Math.floor((p.y+23)/64);y++)for(let x=Math.floor(p.x/64);x<=Math.floor((p.x+23)/64);x++){const key=x+','+y;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);}});}
  function candidates(x0,y0,x1,y1){const indices=new Set();for(let y=Math.floor(y0/64);y<=Math.floor(y1/64);y++)for(let x=Math.floor(x0/64);x<=Math.floor(x1/64);x++)for(const i of buckets.get(x+','+y)||[])indices.add(i);return [...indices].sort((a,b)=>a-b);}
  function invalidate(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;draw();});}
  function draw(){if(!project)return;const dpr=Math.min(devicePixelRatio||1,2),w=canvas.clientWidth,h=canvas.clientHeight;
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#080c12';ctx.fillRect(0,0,w,h);ctx.translate(camera.x,camera.y);ctx.scale(camera.zoom,camera.zoom);ctx.imageSmoothingEnabled=false;
    ctx.fillStyle=project.background;ctx.fillRect(0,0,project.width,project.height);
    const x0=-camera.x/camera.zoom,y0=-camera.y/camera.zoom,x1=x0+w/camera.zoom,y1=y0+h/camera.zoom;
    for(const i of candidates(x0,y0,x1,y1)){const p=project.placements[i];if(p.x>x1||p.y>y1||p.x+23<x0||p.y+23<y0)continue;for(const [key,c]of cells(i)){const q=Number(key);ctx.fillStyle=c;ctx.fillRect(p.x+q%23,p.y+Math.floor(q/23),1,1);}}
    ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.font='10px monospace';
    for(const a of project.showNumbers===false?[]:project.annotations){if(a.x<x0-32||a.x>x1+32||a.y<y0-16||a.y>y1+16)continue;ctx.fillStyle=a.colour;ctx.font=a.size+'px monospace';ctx.fillText(a.text,a.x,a.y);}
  }
  function fit(){if(!project)return;camera.zoom=Math.max(.02,Math.min(64,Math.min((canvas.clientWidth-32)/project.width,(canvas.clientHeight-32)/project.height)));camera.x=(canvas.clientWidth-project.width*camera.zoom)/2;camera.y=(canvas.clientHeight-project.height*camera.zoom)/2;invalidate();displayStatus();}
  function world(event){const r=canvas.getBoundingClientRect();return {x:(event.clientX-r.left-camera.x)/camera.zoom,y:(event.clientY-r.top-camera.y)/camera.zoom};}
  function zoomAt(x,y,factor){const wx=(x-camera.x)/camera.zoom,wy=(y-camera.y)/camera.zoom;camera.zoom=Math.max(.02,Math.min(256,camera.zoom*factor));camera.x=x-wx*camera.zoom;camera.y=y-wy*camera.zoom;invalidate();displayStatus();}
  function locate(x,y){for(const i of candidates(x,y,x,y).reverse()){const p=project.placements[i],lx=Math.floor(x-p.x),ly=Math.floor(y-p.y);if(lx>=0&&ly>=0&&lx<23&&ly<23)return {i,key:String(ly*23+lx)};}return null;}
  function patch(i,key,value){const edit=project.edits[String(i)]||{},before=Object.hasOwn(edit,key)?edit[key]:undefined;if(before===value)return;
    const token=i+':'+key;if(!stroke.has(token))stroke.set(token,{i,key,before,after:value});else stroke.get(token).after=value;
    if(!project.edits[String(i)])project.edits[String(i)]={};project.edits[String(i)][key]=value;
  }
  function paint(x,y){const hit=locate(x,y);if(!hit)return;const tool=$('tool').value,current=cells(hit.i);
    if(tool==='fill'){if(pointer?.filled===hit.i)return;pointer.filled=hit.i;for(const key of current.keys())patch(hit.i,key,$('colour').value);}
    else if(tool==='erase'){if(current.has(hit.key))patch(hit.i,hit.key,null);}
    else if(tool==='brush'){if(current.has(hit.key))patch(hit.i,hit.key,$('colour').value);}
    else if(tool==='add'&&!(hit.key==='264'&&/^(cross|combination):/.test(project.placements[hit.i].maskId||'')))patch(hit.i,hit.key,$('colour').value);
    invalidate();
  }
  function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(STORE,JSON.stringify(project));}catch(_){say('Автосохранение недоступно. Скачайте JSON проекта.',true);}},500);}
  function mark(){dirty=true;$('undo').disabled=!undo.length;$('redo').disabled=!redo.length;displayStatus();persist();}
  function finish(){if(stroke?.size){undo.push({patches:[...stroke.values()]});if(undo.length>100)undo.shift();redo=[];mark();}stroke=null;pointer=null;canvas.classList.remove('dragging');}
  function apply(command,forward){if(command.projects){project=structuredClone(command.projects[forward?1:0]);buildIndex();$('background').value=project.background;$('showNumbers').checked=project.showNumbers!==false;fit();mark();return;}if(command.showNumbers){project.showNumbers=command.showNumbers[forward?1:0];$('showNumbers').checked=project.showNumbers;}else if(command.background){project.background=command.background[forward?1:0];$('background').value=project.background;}else for(const p of command.patches){const value=forward?p.after:p.before;if(!project.edits[String(p.i)])project.edits[String(p.i)]={};if(value===undefined)delete project.edits[String(p.i)][p.key];else project.edits[String(p.i)][p.key]=value;}invalidate();mark();}
  function setProject(next){finish();project=next;ready=true;project.edits||={};project.annotations||=[];$('showNumbers').checked=project.showNumbers!==false;if([256,6144].includes(project.placements.length))$('count').value=String(project.placements.length);if(project.arrangement)$('arrangement').value=project.arrangement;buildIndex();undo=[];redo=[];dirty=false;$('undo').disabled=true;$('redo').disabled=true;$('background').value=project.background;$('colour').value=pack.palette(project.paletteId).bit;fit();persist();}
  function replaceAllowed(){return !dirty||confirm('На холсте есть изменения. Заменить их? Скачайте JSON или сохраните проект в Битотеку, чтобы оставить копию.');}
  function generate(){const count=Number($('count').value),arrangement=$('arrangement').value,layout=pack.layout({count,arrangement,paletteId:'cover'}),pal=pack.palette('cover');
    setProject({format:'zerk-bitglyph-canvas',version:1,width:layout.width,height:layout.height,background:layout.background||pal.background,paletteId:layout.paletteId||'cover',count,arrangement,placements:layout.placements.map(p=>({...p})),edits:{},annotations:layout.placements.map(p=>({x:p.x+11.5,y:p.y+35,text:String(p.index+1),size:10,colour:pal.bit}))});
  }
  function validate(value){
    if(!value||value.format!=='zerk-bitglyph-canvas'||value.version!==1||!finite(value.width)||!finite(value.height)||value.width<=0||value.height<=0||!colour(value.background)||!Array.isArray(value.placements)||value.placements.length>10000)throw Error('Неизвестный или слишком большой проект JSON');
    pack.palette(value.paletteId);
    let total=0;const placements=value.placements.map((p,index)=>{if(!p||!finite(p.x)||!finite(p.y))throw Error('Некорректная позиция фигуры');const out={index,x:p.x,y:p.y};
      if(p.points){if(!Array.isArray(p.points)||p.points.length>529)throw Error('Некорректная маска');out.points=p.points.map(q=>{if(!Array.isArray(q)||!Number.isInteger(q[0])||!Number.isInteger(q[1])||q[0]<0||q[0]>22||q[1]<0||q[1]>22||!colour(q[2]))throw Error('Некорректный бит маски');return [q[0],q[1],colour(q[2])];});}
      else{pack.mask(p.maskId);out.maskId=p.maskId;}if(Array.isArray(p.order)&&p.order.length===4)out.order=p.order.slice();if(Array.isArray(p.turns)&&p.turns.length===4)out.turns=p.turns.slice();return out;});
    const edits={};for(const [i,changes]of Object.entries(value.edits||{})){if(!/^\d+$/.test(i)||Number(i)>=placements.length||!changes||typeof changes!=='object')throw Error('Некорректные правки');edits[i]={};for(const [key,c]of Object.entries(changes)){if(!/^\d+$/.test(key)||Number(key)>528||!(c===null||colour(c)))throw Error('Некорректный цвет правки');edits[i][key]=c;if(++total>5290000)throw Error('Слишком много правок');}}
    const annotations=(value.annotations||[]).map(a=>{if(!finite(a.x)||!finite(a.y)||!finite(a.size)||a.size<1||a.size>32||!colour(a.colour)||!/^\d{1,6}$/.test(a.text))throw Error('Некорректная подпись');return {x:a.x,y:a.y,size:a.size,colour:a.colour,text:a.text};});if(annotations.length>10000)throw Error('Слишком много подписей');
    return {format:value.format,version:1,width:value.width,height:value.height,background:colour(value.background),paletteId:value.paletteId,arrangement:value.arrangement==='grid'?'grid':'triangle',showNumbers:value.showNumbers!==false,placements,edits,annotations};
  }
  function importSvg(text){
    if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('SVG с объявлениями сущностей не поддерживается');
    const doc=new DOMParser().parseFromString(text,'image/svg+xml'),svg=doc.documentElement;
    if(doc.querySelector('parsererror')||svg.localName!=='svg'||svg.namespaceURI!==NS)throw Error('Не удалось разобрать SVG');
    const allowed={svg:['xmlns','xmlns:xlink','width','height','viewBox','role','aria-label'],title:[],g:['fill','transform'],rect:['x','y','width','height','fill'],text:['x','y','text-anchor','font-size','font-family','fill']};
    for(const el of doc.querySelectorAll('*')){if(el.namespaceURI!==NS||!allowed[el.localName])throw Error('Неподдерживаемый элемент SVG: '+el.localName);for(const attr of el.attributes)if(!allowed[el.localName].includes(attr.name))throw Error('Неподдерживаемый атрибут SVG: '+attr.name);}
    const number=(el,key,fallback)=>{const raw=el.getAttribute(key);if(raw===null&&fallback!==undefined)return fallback;if(raw===null||!/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(raw.trim()))throw Error('Некорректная координата SVG: '+key);const n=Number(raw);if(!finite(n))throw Error('Слишком большая координата SVG');return n;};
    const w=number(svg,'width'),h=number(svg,'height'),vb=svg.getAttribute('viewBox');if(w<=0||h<=0||vb&&!/^\s*0[ ,]+0[ ,]+[\d.]+[ ,]+[\d.]+\s*$/.test(vb))throw Error('Поддерживается SVG с началом 0,0');if(vb){const box=vb.trim().split(/[ ,]+/).map(Number);if(box[2]!==w||box[3]!==h)throw Error('Размер SVG должен совпадать с viewBox');}
    const next={format:'zerk-bitglyph-canvas',version:1,width:w,height:h,background:'#080c12',paletteId:'cover',placements:[],edits:{},annotations:[]};let hasBackground=false;
    for(const el of svg.children){if(el.localName==='title'){if(el.children.length)throw Error('Сложный title не поддерживается');continue;}
      if(el.localName==='rect'){if(hasBackground||next.placements.length||el.children.length||number(el,'x',0)!==0||number(el,'y',0)!==0||!['100%',String(w)].includes(el.getAttribute('width'))||!['100%',String(h)].includes(el.getAttribute('height'))||!colour(el.getAttribute('fill')))throw Error('Поддерживается только сплошной фон SVG');next.background=colour(el.getAttribute('fill'));hasBackground=true;}
      else if(el.localName==='g'){
        const translate=/^translate\(\s*([-+]?[\d.]+)[ ,]+([-+]?[\d.]+)\s*\)$/.exec(el.getAttribute('transform')||'');if(!translate||!finite(Number(translate[1]))||!finite(Number(translate[2]))||!colour(el.getAttribute('fill')))throw Error('Поддерживаются только группы с цветом и translate(x,y)');
        const p={index:next.placements.length,x:Number(translate[1]),y:Number(translate[2]),points:[]};
        for(const bit of el.children){if(bit.localName==='title'&&!bit.children.length)continue;if(bit.localName!=='rect'||bit.children.length||number(bit,'width')!==1||number(bit,'height')!==1)throw Error('Поддерживаются только единичные rect внутри группы');const x=number(bit,'x',0),y=number(bit,'y',0),c=colour(bit.getAttribute('fill')||el.getAttribute('fill'));if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>22||y>22||!c)throw Error('Биты SVG должны лежать в квадрате 23 × 23');p.points.push([x,y,c]);}
        next.placements.push(p);
      }else if(el.localName==='text'){
        if(el.children.length||!/^\d{1,6}$/.test(el.textContent)||el.getAttribute('text-anchor')!=='middle'||!colour(el.getAttribute('fill')))throw Error('Поддерживаются только числовые подписи SVG');next.annotations.push({x:number(el,'x'),y:number(el,'y'),text:el.textContent,size:number(el,'font-size'),colour:colour(el.getAttribute('fill'))});
      }else throw Error('Неподдерживаемая структура SVG');
    }
    if(!next.placements.length)throw Error('В SVG нет фигур');return validate(next);
  }
  function svgText(){const chunks=['<svg xmlns="'+NS+'" width="'+project.width+'" height="'+project.height+'" viewBox="0 0 '+project.width+' '+project.height+'"><title>Холст битглифов</title><rect width="100%" height="100%" fill="'+project.background+'"/>'];
    project.placements.forEach((p,i)=>{chunks.push('<g fill="'+pack.palette(project.paletteId).bit+'" transform="translate('+p.x+','+p.y+')">');for(const [key,c]of cells(i)){const q=Number(key);chunks.push('<rect x="'+q%23+'" y="'+Math.floor(q/23)+'" width="1" height="1" fill="'+c+'"/>');}chunks.push('</g>');});
    for(const a of project.showNumbers===false?[]:project.annotations)chunks.push('<text x="'+a.x+'" y="'+a.y+'" text-anchor="middle" font-size="'+a.size+'" font-family="monospace" fill="'+a.colour+'">'+a.text+'</text>');chunks.push('</svg>');return chunks.join('');
  }
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  function jsonBlob(){return new Blob([JSON.stringify(project)],{type:'application/json'});}
  canvas.addEventListener('wheel',event=>{event.preventDefault();const r=canvas.getBoundingClientRect();zoomAt(event.clientX-r.left,event.clientY-r.top,Math.exp(-event.deltaY*.001));},{passive:false});
  canvas.addEventListener('contextmenu',event=>event.preventDefault());
  canvas.addEventListener('pointerdown',event=>{if(!ready||pointer||![0,1].includes(event.button))return;event.preventDefault();canvas.focus();const pan=event.button===1||space||$('tool').value==='pan';pointer={id:event.pointerId,pan,x:event.clientX,y:event.clientY,last:world(event),filled:null};canvas.setPointerCapture(event.pointerId);if(pan)canvas.classList.add('dragging');else{stroke=new Map();paint(pointer.last.x,pointer.last.y);}});
  canvas.addEventListener('pointermove',event=>{if(!pointer||pointer.id!==event.pointerId)return;if(pointer.pan){camera.x+=event.clientX-pointer.x;camera.y+=event.clientY-pointer.y;invalidate();}else{const next=world(event),dx=next.x-pointer.last.x,dy=next.y-pointer.last.y,steps=Math.min(4096,Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))*2)));for(let n=1;n<=steps;n++)paint(pointer.last.x+dx*n/steps,pointer.last.y+dy*n/steps);pointer.last=next;}pointer.x=event.clientX;pointer.y=event.clientY;});
  canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);canvas.addEventListener('lostpointercapture',finish);
  document.addEventListener('keydown',event=>{if(/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)||document.querySelector('dialog[open]'))return;if(event.code==='Space'){space=true;event.preventDefault();}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();(event.shiftKey?$('redo'):$('undo')).click();}});document.addEventListener('keyup',event=>{if(event.code==='Space')space=false;});window.addEventListener('blur',()=>{space=false;finish();});
  $('tool').onchange=()=>canvas.dataset.tool=$('tool').value;$('fit').onclick=fit;$('actual').onclick=()=>zoomAt(canvas.clientWidth/2,canvas.clientHeight/2,1/camera.zoom);
  $('undo').onclick=()=>{finish();const command=undo.pop();if(command){redo.push(command);apply(command,false);}};$('redo').onclick=()=>{finish();const command=redo.pop();if(command){undo.push(command);apply(command,true);}};
  $('background').onchange=()=>{finish();const next=$('background').value;if(next!==project.background){const command={background:[project.background,next]};undo.push(command);redo=[];apply(command,true);}};
  $('zoomOut').onclick=()=>zoomAt(canvas.clientWidth/2,canvas.clientHeight/2,.5);$('zoomIn').onclick=()=>zoomAt(canvas.clientWidth/2,canvas.clientHeight/2,2);
  $('showNumbers').onchange=()=>{finish();const command={showNumbers:[project.showNumbers!==false,$('showNumbers').checked]};undo.push(command);redo=[];apply(command,true);};
  $('generate').onclick=()=>{try{if(replaceAllowed())generate();}catch(error){fail(error);}};
  $('open').onclick=()=>$('file').click();$('file').onchange=async()=>{const file=$('file').files[0];$('file').value='';if(!file||!replaceAllowed())return;try{if(file.size>100000000)throw Error('Файл больше 100 МБ');const text=await file.text();setProject(/\.svg$/i.test(file.name)||text.trimStart().startsWith('<')?importSvg(text):validate(JSON.parse(text)));say('Открыто: '+file.name+' · '+project.placements.length+' фигур');}catch(error){fail(error);}};
  $('svg').onclick=()=>{try{finish();download(new Blob([svgText()],{type:'image/svg+xml'}),'bitglyph-canvas.svg');say('Скачан SVG всего холста. Для продолжения редактирования сохраните JSON.');}catch(error){fail(error);}};
  $('json').onclick=()=>{finish();download(jsonBlob(),'bitglyph-canvas.json');dirty=false;displayStatus();};
  $('library').onclick=async()=>{finish();const button=$('library');button.disabled=true;try{const id='bitglyph-canvas:'+crypto.randomUUID(),url=new URL(location.href);url.hash='bitoteka='+encodeURIComponent(id);await ZerkBitoteka.save({id,kind:'work',name:'Холст · '+project.placements.length+' фигур',filename:'bitglyph-canvas.json',blob:jsonBlob(),source:{name:'Холст битглифов',page:location.pathname},meta:{folder:'Kraftwerk',collection:'Kraftwerk',openUrl:url.href}});dirty=false;history.replaceState(null,'',url);say('Проект сохранён в Битотеку.');}catch(error){fail(error);}finally{button.disabled=false;}};
  new ResizeObserver(()=>invalidate()).observe($('viewport'));
  async function start(){try{if(!pack?.layout)throw Error('Модуль раскладок не загружен. Обновите страницу.');const query=new URLSearchParams(location.search);$('count').value=query.get('count')==='6144'?'6144':'256';$('arrangement').value=query.get('arrangement')==='grid'?'grid':'triangle';const id=new URLSearchParams(location.hash.slice(1)).get('bitoteka');let saved=null;
      if(id){const item=await ZerkBitoteka.get(id);if(!item?.blob)throw Error('Проект не найден в Битотеке');saved=validate(JSON.parse(await item.blob.text()));}
      else {try{const raw=localStorage.getItem(STORE);if(raw)saved=validate(JSON.parse(raw));}catch(_){say('Локальная копия недоступна; открыта новая раскладка.',true);}}
      if(saved){setProject(saved);dirty=true;displayStatus();}else if(query.get('source')==='original'){const response=await fetch('../assets/xor-256-triangle.svg');if(!response.ok)throw Error('Исходный SVG недоступен: HTTP '+response.status);setProject(importSvg(await response.text()));}else generate();ready=true;canvas.dataset.tool=$('tool').value;window.dispatchEvent(new CustomEvent('zerk-glyph-canvas-ready',{detail:api}));
    }catch(error){fail(error);}}
  const api={
    getProject(){if(!project)throw Error('Холст ещё не открыт');finish();return validate(structuredClone(project));},
    replaceProject(value,options={}){const next=validate(structuredClone(value));if(options.confirm&&!replaceAllowed())return false;finish();if(!project){setProject(next);return true;}const command={projects:[structuredClone(project),next]};undo.push(command);if(undo.length>100)undo.shift();redo=[];apply(command,true);return true;},
    getCells(){if(!project)throw Error('Холст ещё не открыт');const bits=[];project.placements.forEach((p,i)=>{for(const [key,c]of cells(i)){const q=Number(key);bits.push([p.x+q%23,p.y+Math.floor(q/23),c]);}});return {width:project.width,height:project.height,background:project.background,bits};},
    addAction({id,label,title,onClick,width=64}){if(typeof id!=='string'||!/^[a-z][a-z0-9-]*$/i.test(id)||document.getElementById('glyph-action-'+id)||typeof onClick!=='function')throw Error('Некорректная команда холста');const button=document.createElement('button');button.id='glyph-action-'+id;button.textContent=String(label||id);button.title=String(title||label||id);button.style.width=button.style.minWidth=([16,32,64,128].includes(width)?width:64)+'px';button.onclick=async()=>{button.disabled=true;try{await onClick(api);}catch(error){fail(error);}finally{button.disabled=false;}};document.querySelector('header').insertBefore(button,$('file'));return {button,remove:()=>button.remove()};},
    fit,showStatus:say
  };
  window.ZerkGlyphCanvas=Object.freeze(api);
  start();
})();
