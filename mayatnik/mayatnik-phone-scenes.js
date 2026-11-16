/* Shared live sources for the phone gallery and the main Pendulum.
 * Frame numbers address the source evolution, never a bitmap or a camera move.
 * Each returned frame owns its arrays. RGB classes use R=4, G=2, B=1,
 * matching Xorrom; recipe files historically use the opposite R/B bit order.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./mayatnik-phone-catalog.js'):root.MayatnikPhoneCatalog,
    node?require('./mayatnik-synthesis-pendulums.js'):root.MayatnikSynthesisPendulums,
    node?require('./mayatnik-animatrix-source.js'):root.MayatnikAnimatrixSource);
  if(node)module.exports=api;else root.MayatnikPhoneScenes=api;
})(typeof globalThis==='object'?globalThis:this,function(Catalog,Pend,Anim){
  'use strict';
  function count(value,label){if(!Number.isSafeInteger(value)||value<0)throw Error('Invalid '+label);return value;}
  function pendulum(recipe,size){
    const width=size.width,height=size.height,baseFrame=recipe.tick;
    const model=Pend.create({width,height,anchor:recipe.anchor,options:recipe.options});
    return {width,height,baseFrame,maxFrames:baseFrame+128,frame(k){
      if(k<model.tick)model.reset();while(model.tick<k)model.step();
      return {width,height,values:model.output.slice(),a:model.a.slice(),b:model.b.slice(),
        age:model.age.slice(),changed:model.changed.slice()};
    }};
  }
  function rule90(recipe,size){
    const width=size.width,height=size.height,baseFrame=height-1;
    const seed=new Int8Array(width);
    for(const offset of recipe.seeds){const x=recipe.anchor+offset;if(x>=0&&x<width)seed[x]^=1;}
    const rows=[seed];
    function row(t){while(rows.length<=t){const previous=rows[rows.length-1],next=new Int8Array(width);
      for(let x=0;x<width;x++)next[x]=(x?previous[x-1]:0)^(x+1<width?previous[x+1]:0);rows.push(next);
    }return rows[t];}
    return {width,height,baseFrame,maxFrames:baseFrame+128,frame(k){
      // First grow the original triangle. After its base frame, show the next
      // computed generations in a fixed-height window, with zero boundaries.
      const shift=Math.max(0,k-baseFrame),values=new Int8Array(width*height).fill(-1);
      const changed=new Uint8Array(values.length);
      for(let y=0;y<height&&y<=k;y++){const current=row(y+shift);values.set(current,y*width);
        const before=shift?row(y+shift-1):null;
        for(let x=0;x<width;x++)changed[y*width+x]=before?Number(current[x]!==before[x]):Number(y===k&&current[x]===1);
      }
      return {width,height,values,changed};
    }};
  }
  function animatrix(recipe,size){
    const seed=recipe.seed;
    const state={...Anim.defaults(),...recipe.options,rows:seed.rows,animatrixOn:true,
      animatrixSource:Anim.demo(seed.rows,seed.type,seed.algorithm)};
    const engine=Anim.create(state),width=engine.width,height=engine.height;
    const values=()=>Int8Array.from(engine.bits,(bit,q)=>engine.present[q]?bit:-1);
    const initial=values(),baseFrame=recipe.sourceFrame;
    return {width,height,baseFrame,maxFrames:Math.max(baseFrame,Math.min(Anim.frames(state),baseFrame+128)),frame(k){
      const target=Math.min(k,Anim.frames(state));if(target<engine.sourceFrame)Anim.reset(engine);
      if(target>engine.sourceFrame)Anim.advance(engine,target-engine.sourceFrame);
      const current=values();
      return {width,height,values:current,initial:initial.slice(),sourceFrame:engine.sourceFrame,
        changed:Uint8Array.from(current,(bit,q)=>Number(bit!==initial[q]))};
    }};
  }
  function source(recipe,size){
    if(recipe.rule===90)return rule90(recipe,size);
    if(recipe.seed?.factory==='MayatnikAnimatrixSource.demo')return animatrix(recipe,size);
    if(Number.isSafeInteger(recipe.tick))return pendulum(recipe,size);
    throw Error('Unsupported wallpaper source');
  }
  function rgb(recipe){
    const width=recipe.grid.width,height=recipe.grid.height;
    const layers=recipe.layers.map(layer=>({...layer,engine:source(layer.source,layer.field)}));
    const baseFrame=Math.max(...layers.map(layer=>layer.engine.baseFrame));
    const maxFrames=Math.min(...layers.map(layer=>baseFrame+layer.engine.maxFrames-layer.engine.baseFrame));
    function compose(k){
      const rgbCodes=new Int8Array(width*height),channels=[];
      for(const layer of layers){const field=layer.engine.frame(Math.max(0,k-baseFrame+layer.engine.baseFrame));
        const mask=new Uint8Array(rgbCodes.length),flag={R:4,G:2,B:1}[layer.channel];
        for(const pose of layer.poses)for(let y=0;y<field.height;y++)for(let x=0;x<field.width;x++){
          if(field.values[y*field.width+x]!==1)continue;
          const sx=pose.flipX?field.width-1-x:x,sy=pose.flipY?field.height-1-y:y;
          const tx=pose.x+(pose.turn===1?field.height-1-sy:pose.turn===-1?sy:sx);
          const ty=pose.y+(pose.turn===1?sx:pose.turn===-1?field.width-1-sx:sy);
          if(tx>=0&&tx<width&&ty>=0&&ty<height)mask[ty*width+tx]=1;
        }
        for(let q=0;q<mask.length;q++)if(mask[q])rgbCodes[q]|=flag;
        channels.push({channel:layer.channel,mask,field});
      }
      return {width,height,values:Int8Array.from(rgbCodes,code=>Number(code!==0)),rgbCodes,channels};
    }
    return {width,height,baseFrame,maxFrames,frame:compose};
  }
  function create(id){
    const entry=Catalog.get(id);if(!entry)throw Error('Unknown wallpaper: '+id);
    const recipe=entry.recipe,engine=entry.category==='rgb'?rgb(recipe):source(recipe,recipe.field||recipe);
    const scene={id,title:entry.title,entry,recipe,width:engine.width,height:engine.height,
      baseFrame:engine.baseFrame,maxFrames:engine.maxFrames,
      frame(k=engine.baseFrame){count(k,'wallpaper frame');k=Math.min(k,engine.maxFrames);
        const data=engine.frame(k);
        return {...data,id,title:entry.title,k,baseFrame:engine.baseFrame,maxFrames:engine.maxFrames,
          rgbCodes:data.rgbCodes||null,art:entry};
      }};
    return Object.freeze(scene);
  }
  return Object.freeze({VERSION:1,list:Catalog.list,get:Catalog.get,create});
});
