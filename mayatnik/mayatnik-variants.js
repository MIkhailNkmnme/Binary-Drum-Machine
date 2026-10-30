/* One canonical binary variant family for UI searches and serializable workers. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikVariants=api;})(globalThis,function createVariants(){
  'use strict';
  function generate(word,{inverse=false,reverse=false,half=false}={}){
    if(typeof word!=='string'||!/^[01]+$/.test(word))throw new RangeError('Варианты требуют непустую двоичную строку.');
    const n=word.length,mid=Math.floor(n/2),odd=n%2===1,flip=(s,test)=>Array.from(s,(b,i)=>test(i)?b==='0'?'1':'0':b).join(''),rev=s=>Array.from(s).reverse().join('');
    const seeds=[{word,halfMode:'none',name:'',title:''}];
    if(half){
      seeds.push({word:flip(word,i=>i>=Math.ceil(n/2)),halfMode:'right',name:'полу:право',title:'полуинверсия правой половины'+(odd?' без среднего бита':'')});
      if(odd){
        seeds.push({word:flip(word,i=>i>=mid),halfMode:'rightWithMiddle',name:'полу:право+центр',title:'полуинверсия правой половины со средним битом'});
        seeds.push({word:flip(word,i=>i!==mid),halfMode:'exceptMiddle',name:'полу:кроме центра',title:'инверсия всех битов, кроме среднего'});
        seeds.push({word:flip(word,i=>i===mid),halfMode:'middleOnly',name:'полу:центр',title:'инверсия только среднего бита'});
      }
    }
    const transforms=[[false,false]];if(inverse)transforms.push([true,false]);if(reverse)transforms.push([false,true]);if(inverse&&reverse)transforms.push([true,true]);
    const out=[],seen=new Set();
    for(const seed of seeds)for(const [i,r]of transforms){let value=i?flip(seed.word,()=>true):seed.word;if(r)value=rev(value);if(seen.has(value))continue;seen.add(value);
      const suffix=[i?'инв':'',r?'рев':''].filter(Boolean).join('+'),vn=[seed.name,suffix].filter(Boolean).join(' · '),title=[seed.title,i?'полная инверсия':'',r?'реверс':''].filter(Boolean).join(' + ');
      out.push({word:value,vn,label:title||'исходная',index:out.length,flags:{inverse:i,reverse:r,half:seed.halfMode!=='none',halfMode:seed.halfMode}});
    }
    return out;
  }
  return {generate,create:createVariants};
});
