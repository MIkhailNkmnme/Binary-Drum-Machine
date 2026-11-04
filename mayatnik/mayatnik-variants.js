/* One canonical binary variant family for UI searches and serializable workers. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikVariants=api;})(globalThis,function createVariants(){
  'use strict';
  function rowReverseMask(word){return Array.from(word,(bit,i)=>bit===word[word.length-1-i]?bit:' ').join('');}
  function matches(text,word,at=0){if(at<0||at+word.length>text.length)return false;for(let i=0;i<word.length;i++){const bit=text[at+i];if(word[i]===' '?bit!=='0'&&bit!=='1':bit!==word[i])return false;}return true;}
  let runText=null,runRanges=[];
  function indexOf(text,word,from=0){
    from=Math.max(0,Math.floor(Number(from)||0));if(!word.includes(' '))return text.indexOf(word,from);
    let anchor='',offset=0;for(const match of word.matchAll(/[01]+/g))if(match[0].length>anchor.length){anchor=match[0];offset=match.index;}
    if(!anchor){if(runText!==text){runText=text;runRanges=[];for(const run of text.matchAll(/[01]+/g))runRanges.push([run.index,run.index+run[0].length]);}let low=0,high=runRanges.length;while(low<high){const mid=(low+high)>>>1;if(runRanges[mid][1]<=from)low=mid+1;else high=mid;}for(let i=low;i<runRanges.length;i++){const start=Math.max(from,runRanges[i][0]);if(start+word.length<=runRanges[i][1])return start;}return -1;}
    for(let at=text.indexOf(anchor,from+offset);at>=0;at=text.indexOf(anchor,at+1)){const start=at-offset;if(start+word.length>text.length)return -1;if(matches(text,word,start))return start;}return -1;
  }
  function generate(word,{inverse=false,reverse=false,half=false,rowReverseMask:masked=false}={}){
    if(typeof word!=='string'||!/^[01]+$/.test(word))throw new RangeError('Варианты требуют непустую двоичную строку.');
    if(masked)word=rowReverseMask(word);
    const n=word.length,mid=Math.floor(n/2),odd=n%2===1,flip=(s,test)=>Array.from(s,(b,i)=>test(i)&&b!==' '?b==='0'?'1':'0':b).join(''),rev=s=>Array.from(s).reverse().join('');
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
      out.push({word:value,vn,label:title||'исходная',index:out.length,flags:{inverse:i,reverse:r,half:seed.halfMode!=='none',halfMode:seed.halfMode,...(masked?{rowReverseMask:true}:{})}});
    }
    return out;
  }
  return {generate,rowReverseMask,matches,indexOf,create:createVariants};
});
