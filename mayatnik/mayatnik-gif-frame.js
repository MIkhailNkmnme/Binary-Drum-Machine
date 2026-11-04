/* A selected GIF raster becomes an independent native editable frame. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./mayatnik-animatrix-source.js'):root.MayatnikAnimatrixSource);if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikGifFrame=api;})(globalThis,function(Source){
  'use strict';
  function validate(variant,frame){
    const {width,height}=variant?.plan||{},s=frame?.semantic,b=s?.bounds;
    if(!Number.isSafeInteger(width)||width<1||!Number.isSafeInteger(height)||height<8||height>4096||width*height>2100000)throw Error('Редактируемый кадр: от 8 до 4096 строк и не более 2 100 000 клеток');
    if(!s||!Number.isSafeInteger(s.width)||s.width<1||!Number.isSafeInteger(s.height)||s.height<1||Object.prototype.toString.call(s.bits)!=='[object Int8Array]'||s.bits.length!==s.width*s.height)throw Error('Кадр не содержит точную карту битов');
    if(!b||!['left','top','width','height'].every(k=>Number.isSafeInteger(b[k]))||b.left<0||b.top<0||b.width<1||b.height<1||b.left+b.width>width||b.top+b.height>height)throw Error('Повреждены границы кадра');
    for(const bit of s.bits)if(![-1,0,1].includes(bit))throw Error('Кадр содержит смешанные ячейки без точного бита 0/1. Выберите другой кадр или способ уменьшения.');
    return {width,height,semantic:s,bounds:b};
  }
  function work(variant,frame,pixels,currentState={}){
    const {width,height,semantic:s,bounds:b}=validate(variant,frame),n=width*height;
    if(pixels?.length!==n*4)throw Error('Размер изображения GIF не совпадает с кадром');
    const field=new Int8Array(n).fill(-1),colours=new Uint32Array(n),filled=new Uint8Array(n).fill(1);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const q=y*width+x;if(pixels[q*4+3]!==255)throw Error('Прозрачный GIF нельзя точно перенести в поле');
      colours[q]=(pixels[q*4]<<16)|(pixels[q*4+1]<<8)|pixels[q*4+2];
      if(x>=b.left&&x<b.left+b.width&&y>=b.top&&y<b.top+b.height){const sx=Math.min(s.width-1,Math.floor((x-b.left+.5)*s.width/b.width)),sy=Math.min(s.height-1,Math.floor((y-b.top+.5)*s.height/b.height));field[q]=s.bits[sy*s.width+sx];}
    }
    const source=Source.encode({width,height,bits:field,colours,fills:colours,filled});
    // The saved raster already includes every visual effect. Start its native
    // field with effects off, while retaining ordinary numeric UI preferences.
    const state=structuredClone(currentState);for(const key of Object.keys(state))if(typeof state[key]==='boolean'&&!key.endsWith('Open'))state[key]=false;
    Object.assign(state,Source.defaults(),{animatrixOn:true,animatrixSource:source,rows:height,steps:1,mode:'one',bg:'empty',view:'bits',zoom:'fit',zOverview:true,vrows:0,noband:false,compareSource:'',sequenceSource:null,parity:{},cellSelection:null,lineFamilies:null,templateFocusMargins:null,romboLayout:null,invertFrame:null,paintFrameMode:'off'});
    return {schema:2,st:state,k:0,field,width,height,fill:null,paintBits:null,colour:'#ff7f27',templates:[],pickedTemplates:[],columns:[],colourAuto:{},mirrors:{live:false,xor:false,base:null},mirror:false,visible:false,libraryKind:'frame',frameBounds:{left:0,top:0,width,height},
      frameHost:{version:1,controls:{},state:{},layers:[{id:'original',kind:'original',order:0,opacity:100,x:0,y:0,visible:true,tint:null,enabled:true}],overlay:null,frozen:null,locks:null,third:null,lastShown:null,chess:null,replay:[],viewport:{left:0,top:0}}};
  }
  return {validate,work};
});
