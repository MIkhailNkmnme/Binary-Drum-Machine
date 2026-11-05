/* Shared masks and display palettes. Empty cells never become coloured bits. */
(function (root) {
  'use strict';
  const palettes = [
    {id:'cover',name:'Обложка · красный / чёрный',background:'#ff0000',bit:'#000000',pivot:'#747b78',light:'#f3f5ef',dark:'#292d32'},
    {id:'blue-white',name:'Синий / белый',background:'#0569c7',bit:'#f1f5f0',pivot:'#f1f5f0',light:'#ffffff',dark:'#27353b'},
    {id:'yellow-black',name:'Жёлтый / чёрный',background:'#f9ed01',bit:'#242a28',pivot:'#242a28',light:'#fffbc1',dark:'#666126'},
    {id:'dark-white',name:'Тёмный / белый',background:'#1d2527',bit:'#f2f5ef',pivot:'#f2f5ef',light:'#ffffff',dark:'#090e11'},
    {id:'red-black',name:'Красный / чёрный',background:'#e5221e',bit:'#242a28',pivot:'#242a28',light:'#f4f2e9',dark:'#672523'},
    {id:'green-black',name:'Зелёный / чёрный',background:'#24d52c',bit:'#242a28',pivot:'#242a28',light:'#e9ed26',dark:'#236a23'},
    {id:'grey-white',name:'Серый / белый · красный центр',background:'#576774',bit:'#f3f5ef',pivot:'#d6322e',light:'#ffffff',dark:'#293942'},
    {id:'white-black',name:'Белый / чёрный · красный центр',background:'#fdfdfb',bit:'#242a28',pivot:'#d6322e',light:'#ffffff',dark:'#717974'},
    {id:'blue-red',name:'Синий / красный',background:'#046ccb',bit:'#d62f29',pivot:'#d62f29',light:'#f4f3e9',dark:'#34434e'}
  ];
  let cached;
  const colour = hex => (0xff000000 | parseInt(hex.slice(5,7),16)<<16 | parseInt(hex.slice(3,5),16)<<8 | parseInt(hex.slice(1,3),16)) >>> 0;
  const rotate = (x,y,t) => [[x,y],[-y,x],[-x,-y],[y,-x]][t];
  function masks() {
    if(cached)return cached;
    const pack=root.MayatnikXorAxesTemplates;
    if(!pack)throw Error('Набор исходных масок ещё не загружен');
    const native=pack.entries();
    const basics=native.map((entry,index)=>{
      const part=entry.shape.parts[0],pivot=entry.source.pivot,points=[];
      part.data.forEach((value,q)=>{if(value)points.push([q%part.width-pivot.x,Math.floor(q/part.width)-pivot.y]);});
      return {id:entry.id.replace('xor-axes:',''),name:entry.name,type:index<4?'figure':'cross',points,pivotOccupied:index<4,source:entry.source};
    });
    const figures=basics.slice(0,4).map(mask=>mask.points.filter(([x,y])=>x||y));
    const combinations=Array.from({length:256},(_,index)=>{
      const turns=figures.map((_,i)=>Math.floor(index/4**i)%4),hits=new Map();
      figures.forEach((points,i)=>points.forEach(([x,y])=>{const p=rotate(x,y,turns[i]),key=p.join(',');if(hits.has(key))hits.delete(key);else hits.set(key,p);}));
      hits.delete('0,0');
      return {id:'combination:'+String(index+1).padStart(3,'0'),name:'Сочетание '+(index+1),type:'combination',points:[...hits.values()],pivotOccupied:false,source:{type:'combination256',turns,index}};
    });
    cached=[...basics,...combinations];return cached;
  }
  function palette(id){const value=palettes.find(p=>p.id===id);if(!value)throw Error('Палитра не найдена');return value;}
  function mask(id){const value=masks().find(m=>m.id===id);if(!value)throw Error('Маска не найдена');return value;}
  function entry(maskId,paletteId) {
    const m=mask(maskId),p=palette(paletteId),points=m.points;
    // A neutral centre is not inserted into crosses/combinations: mask semantics stay intact.
    const xs=points.map(q=>q[0]),ys=points.map(q=>q[1]);
    const x0=Math.min(...xs),y0=Math.min(...ys),width=Math.max(...xs)-x0+1,height=Math.max(...ys)-y0+1;
    const data=Array(width*height).fill(0);
    for(const [x,y]of points)data[(y-y0)*width+x-x0]=colour(m.pivotOccupied&&!x&&!y?p.pivot:p.bit);
    const id='kraftwerk:'+p.id+':'+m.id;
    return {id,name:m.name+' · '+p.name,folder:'Kraftwerk',source:{...m.source,page:'issledovanie/xor-bitglyphs/',collection:'Kraftwerk',maskId:m.id,paletteId:p.id},
      shape:{hex:p.bit,rk:1,parts:[{width,height,y:0,center:0,data}],height:100,down:0,x:0,proportional:false,
        palette:{...p,collection:'Kraftwerk',maskId:m.id,pivot:{x:-x0,y:-y0},pivotOccupied:m.pivotOccupied,source:'/sources/kraftwerk/3d-der-katalog-palettes.png'}}};
  }
  function svg(maskId,paletteId,cell=8) {
    const m=mask(maskId),p=palette(paletteId),s=Number(cell)||8;
    const xs=m.points.map(q=>q[0]),ys=m.points.map(q=>q[1]),x0=Math.min(...xs)-1,y0=Math.min(...ys)-1;
    const width=Math.max(...xs)-x0+2,height=Math.max(...ys)-y0+2;
    const path=m.points.map(([x,y])=>`M${x-x0} ${y-y0}h1v1h-1Z`).join('');
    const cap=m.pivotOccupied?`<rect x="${-x0}" y="${-y0}" width="1" height="1" fill="${p.pivot}"/>`:'';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width*s}" height="${height*s}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${m.name}; ${p.name}"><title>${m.name} · ${p.name}</title><rect width="100%" height="100%" fill="${p.background}"/><path d="${path}" fill="${p.light}" transform="translate(-.22,-.22)"/><path d="${path}" fill="${p.dark}" transform="translate(.28,.28)"/><path d="${path}" fill="${p.bit}"/>${cap}</svg>`;
  }
  function portable(entries){return {format:'mayatnik-templates',version:1,templates:entries};}
  root.ZerkKraftwerk={palettes,masks,palette,mask,entry,svg,portable};
})(window);
