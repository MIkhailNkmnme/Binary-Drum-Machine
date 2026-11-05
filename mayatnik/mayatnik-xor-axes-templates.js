/* Native-cell library pack traced from issledovanie/xor-axes/index.html.
 * Catalogue identities are retained even when two rasters differ only by rotation.
 */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.MayatnikXorAxesTemplates=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const folder='Оси XOR',black=0xff000000>>>0,grey=0xff777771>>>0;
  const masks=[
    ['00010000','01010000','01111000','00111100','00011010','11111111','00011000','00011000','00011000','00011000','00011000','00010000'],
    ['00010000','00010000','00111000','00111000','00011100','11111111','00011000','00011000','00011000','00011000','00010000','00001000'],
    ['00001000','00001000','00011100','00011100','00101000','11111111','00011000','00011000','00011000','00011000','00001000','00011000'],
    ['00001000','00001000','00011100','00011100','00011000','11111111','00011000','00011000','00011000','00011000','00010000','00001000']
  ];
  function permutations(left){return left.length?left.flatMap(i=>permutations(left.filter(j=>j!==i)).map(tail=>[i,...tail])):[[]];}
  const orders=permutations([0,1,2,3]);
  const points=masks.map(rows=>{const pivot=rows[0].indexOf('1');return rows.flatMap((row,y)=>Array.from(row,(v,x)=>v==='1'?[x-pivot,y]:null).filter(Boolean));});
  function rotate(x,y,t){return [[x,y],[-y,x],[-x,-y],[y,-x]][t];}
  function raster(cells){
    const xs=cells.map(p=>p[0]),ys=cells.map(p=>p[1]),x0=Math.min(...xs),y0=Math.min(...ys);
    const width=Math.max(...xs)-x0+1,height=Math.max(...ys)-y0+1,data=Array(width*height).fill(0);
    for(const [x,y,colour]of cells)data[(y-y0)*width+x-x0]=colour;
    return {part:{width,height,y:0,center:0,data},pivot:{x:-x0,y:-y0}};
  }
  function entry(id,name,cells,source){
    const {part,pivot}=raster(cells);
    return {id,name,folder,source:{page:'issledovanie/xor-axes/',...source,pivot},shape:{hex:'#000000',rk:1,parts:[part],height:100,down:0,x:0,proportional:false}};
  }
  function entries(){
    const result=points.map((list,i)=>entry('xor-axes:figure:'+(i+1),'Фигура '+['I','II','III','IV'][i],list.map(([x,y])=>[x,y,x===0&&y===0?grey:black]),{type:'figure',figure:i,turn:0,neutralPivot:'occupied'}));
    orders.forEach((turns,index)=>{
      const hits=new Map();
      points.forEach((list,i)=>{for(const [x,y]of list){
        if(x===0&&y===0)continue;
        const [rx,ry]=rotate(x,y,turns[i]),key=rx+','+ry;
        if(hits.has(key))hits.delete(key);else hits.set(key,[rx,ry,black]);
      }});
      // fieldCells() reserves the shared neutral pivot (value 2), not an XOR bit.
      hits.delete('0,0');
      const number=String(index+1).padStart(2,'0'),variant=24*turns.reduce((n,t,i)=>n+t*4**i,0);
      result.push(entry('xor-axes:cross:'+number,'Крест '+number,[...hits.values()],{type:'cross24',index,order:[0,1,2,3],turns:turns.slice(),variant,radius:0,mode:'xor',neutralPivot:'removed'}));
    });
    return result;
  }
  return {folder,entries};
});
