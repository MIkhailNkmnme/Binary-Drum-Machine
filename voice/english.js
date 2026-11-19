/* ГОЛ-009. Our handwritten word recipes and approximate spelling rules.
   No recorded input, external lexicon, TTS, learned weights or measured voice.
   Formant goals below are our engineering choices, not a reference speaker.
   Textual background: British Council, Teaching the schwa (unstressed vowels).
   General speech knowledge does not establish the intelligibility of this DSP. */
(function(root){
  'use strict';
  const version='english-recipes-v1.0.0',copy=value=>JSON.parse(JSON.stringify(value));
  const example='9876543210 Hello World! Julia and Jack walk beside a quiet river as the morning sun lights the valley. A young fox jumps over a box, while busy bees circle yellow flowers. Zoe brings fresh bread, warm milk and sweet jam to the village square. The friends watch a zebra, hear a joyful bird and follow the winding path through the woods. Max plays soft music on a small xylophone, and Lucy draws a bright blue sky. They share their food, ask curious questions and laugh together. At night, everyone feels happy and wishes the world a peaceful rest.';
  const vowel=(f,b,w)=>({kind:'vowel',formants:f,bandwidths:b,weights:w,voice:1,noise:.012});
  const dental=(voice,noise)=>({kind:'fricative',formants:[900,2300,4500,6800],bandwidths:[800,1200,1700,2000],weights:[.2,.3,.35,.2],voice,noise});
  const nasal=(f)=>({kind:'sonorant',formants:[260,f,2450,3400],bandwidths:[80,190,280,350],weights:[1,.2,.12,.05],voice:.8,noise:.015});
  const targets={
    bank:{
      en_ih:vowel([400,1950,2700,3500],[90,140,190,250],[1,1.1,.45,.15]),
      en_eh:vowel([560,1800,2600,3500],[100,140,190,250],[1,1.05,.45,.15]),
      en_uh:vowel([430,1050,2400,3400],[90,120,190,250],[1,.8,.3,.12]),
      en_ah:vowel([650,1250,2550,3500],[100,140,190,250],[1,.85,.35,.13]),
      en_aw:vowel([570,900,2450,3450],[95,120,190,250],[1,.9,.35,.12]),
      en_th:dental(0,.65),en_dh:dental(.48,.38),en_ng:nasal(1750)
    },
    robot:{
      en_ih:vowel([410,1900,2650,3450],[95,150,210,270],[1,1,.4,.14]),
      en_eh:vowel([550,1750,2550,3450],[100,150,210,270],[1,1,.4,.14]),
      en_uh:vowel([440,1050,2350,3350],[95,130,210,270],[1,.8,.3,.12]),
      en_ah:vowel([640,1200,2500,3450],[105,150,210,270],[1,.85,.35,.13]),
      en_aw:vowel([580,900,2400,3400],[100,130,210,270],[1,.85,.3,.12]),
      en_th:dental(0,.6),en_dh:dental(.45,.35),en_ng:nasal(1700)
    },
    dsh:{
      en_ih:vowel([400,1920,2700,3500],[90,145,200,260],[1,1.1,.5,0]),
      en_eh:vowel([560,1780,2600,3500],[100,145,200,260],[1,1.05,.5,0]),
      en_uh:vowel([430,1030,2400,3400],[90,125,200,260],[1,.85,.35,0]),
      en_ah:vowel([650,1230,2550,3500],[100,145,200,260],[1,.9,.4,0]),
      en_aw:vowel([570,880,2450,3450],[95,125,200,260],[1,.95,.4,0]),
      en_th:dental(0,.65),en_dh:dental(.48,.38),en_ng:nasal(1750)
    }
  };
  const phoneLabels={en_ih:'EN · KIT [ɪ]',en_eh:'EN · DRESS [ɛ]',en_uh:'EN · FOOT [ʊ]',en_ah:'EN · STRUT [ʌ]',en_aw:'EN · THOUGHT [ɔ]',en_th:'EN · th глухое [θ]',en_dh:'EN · th звонкое [ð]',en_ng:'EN · ng [ŋ]'};
  function getPhone(engineId,id){return Object.hasOwn(targets,engineId)&&Object.hasOwn(targets[engineId],id)?copy(targets[engineId][id]):undefined;}
  function resolve(engine,overrides,score){
    if(!Object.hasOwn(targets,engine.engineId))throw Error('Нет английского профиля движка '+engine.engineId+'.');
    const out={};for(const token of score)if(Object.hasOwn(targets[engine.engineId],token.id))out[token.id]=getPhone(engine.engineId,token.id);
    for(const [id,phone]of Object.entries(overrides||{}))Object.defineProperty(out,id,{value:copy(phone),enumerable:true,writable:true,configurable:true});
    if(Object.keys(out).length>engine.limits.maxPhones)throw Error('Английские цели и пользовательские фонемы превышают лимит '+engine.limits.maxPhones+'. Удалите ненужные замены.');
    return out;
  }
  const vowelIds=new Set(['a','e','i','o','u','ax','ae','en_ih','en_eh','en_uh','en_ah','en_aw']);
  const stops=new Set(['p','b','t','d','k','g']),fricatives=new Set(['s','z','sh','zh','f','v','h','en_th','en_dh']);
  const duration=id=>vowelIds.has(id) ? .22 : stops.has(id) ? .085 : fricatives.has(id) ? .13 : ['ch','dzh'].includes(id) ? .14 : .10;
  // A token ends in its zero-based source-letter index: both vowels of a
  // diphthong carry the same source. Silent letters intentionally have no token.
  // These explicit origins preserve + / combining stress marks after expansion.
  const rows=[
    ['hello',4,'h0 ax1 l2 o4 u4'],['world',1,'w0 ax1 rr1 l3 d4'],
    ['julia',1,'dzh0 u1 l2 i3 ax4'],['and',null,'ax0 n1 d2'],['jack',1,'dzh0 ae1 k2'],
    ['walk',1,'w0 en_aw1 k3'],['beside',3,'b0 en_ih1 s2 a3 en_ih3 d4'],['a',null,'ax0'],
    ['quiet',2,'k0 w1 a2 en_ih2 ax3 t4'],['river',1,'rr0 en_ih1 v2 ax3 rr3'],['as',null,'ae0 z1'],
    ['the',null,'en_dh0 ax2'],['morning',1,'m0 en_aw1 rr1 n3 en_ih4 en_ng5'],['sun',1,'s0 en_ah1 n2'],
    ['lights',1,'l0 a1 en_ih1 t4 s5'],['valley',1,'v0 ae1 l2 i4'],['young',1,'j0 en_ah1 en_ng3'],
    ['fox',1,'f0 a1 k2 s2'],['jumps',1,'dzh0 en_ah1 m2 p3 s4'],['over',0,'o0 u0 v1 ax2 rr2'],
    ['box',1,'b0 a1 k2 s2'],['while',2,'w0 a2 en_ih2 l3'],['busy',1,'b0 en_ih1 z2 i3'],
    ['bees',1,'b0 i1 z3'],['circle',1,'s0 ax1 rr1 k3 ax4 l4'],['yellow',1,'j0 en_eh1 l2 o4 u4'],
    ['flowers',2,'f0 l1 a2 en_uh2 ax4 rr4 z6'],['zoe',1,'z0 o1 u1 i2'],
    ['brings',2,'b0 rr1 en_ih2 en_ng3 z5'],['fresh',2,'f0 rr1 en_eh2 sh3'],['bread',2,'b0 rr1 en_eh2 d4'],
    ['warm',1,'w0 en_aw1 rr1 m3'],['milk',1,'m0 en_ih1 l2 k3'],['sweet',2,'s0 w1 i2 t4'],
    ['jam',1,'dzh0 ae1 m2'],['to',null,'t0 ax1'],['village',1,'v0 en_ih1 l2 en_ih4 dzh5'],
    ['square',3,'s0 k1 w2 en_eh3 rr4'],['friends',3,'f0 rr1 en_eh3 n4 d5 z6'],
    ['watch',1,'w0 a1 ch2'],['zebra',1,'z0 i1 b2 rr3 ax4'],['hear',1,'h0 i1 rr3'],
    ['joyful',1,'dzh0 en_aw1 en_ih1 f3 en_uh4 l5'],['bird',1,'b0 ax1 rr1 d3'],
    ['follow',1,'f0 a1 l2 o4 u4'],['winding',1,'w0 a1 en_ih1 n2 d3 en_ih4 en_ng5'],
    ['path',1,'p0 ae1 en_th2'],['through',3,'en_th0 rr2 u3'],['woods',1,'w0 en_uh1 d3 z4'],
    ['max',1,'m0 ae1 k2 s2'],['plays',2,'p0 l1 e2 en_ih2 z4'],['soft',1,'s0 a1 f2 t3'],
    ['music',1,'m0 j1 u1 z2 en_ih3 k4'],['on',null,'a0 n1'],['small',2,'s0 m1 en_aw2 l3'],
    ['xylophone',1,'z0 a1 en_ih1 l2 ax3 f4 o6 u6 n7'],['lucy',1,'l0 u1 s2 i3'],
    ['draws',2,'d0 rr1 en_aw2 z4'],['bright',2,'b0 rr1 a2 en_ih2 t5'],['blue',2,'b0 l1 u2'],
    ['sky',2,'s0 k1 a2 en_ih2'],['they',2,'en_dh0 e2 en_ih2'],['share',2,'sh0 en_eh2 rr3'],
    ['their',null,'en_dh0 en_eh2 rr4'],['food',1,'f0 u1 d3'],['ask',0,'ae0 s1 k2'],
    ['curious',1,'k0 j1 en_uh1 rr2 i3 ax4 s6'],['questions',2,'k0 w1 en_eh2 s3 ch4 ax6 n7 z8'],
    ['laugh',1,'l0 ae1 f3'],['together',3,'t0 ax1 g2 en_eh3 en_dh4 ax6 rr6'],
    ['at',0,'ae0 t1'],['night',1,'n0 a1 en_ih1 t4'],['everyone',0,'en_eh0 v1 rr3 i4 w5 en_ah5 n6'],
    ['feels',1,'f0 i1 l3 z4'],['happy',1,'h0 ae1 p2 i4'],['wishes',1,'w0 en_ih1 sh2 en_ih4 z5'],
    ['peaceful',1,'p0 i1 s3 f5 ax6 l7'],['rest',1,'rr0 en_eh1 s2 t3'],
    ['zero',1,'z0 i1 rr2 o3 u3'],['one',0,'w0 en_ah0 n1'],['two',2,'t0 u2'],
    ['three',3,'en_th0 rr2 i3'],['four',1,'f0 en_aw1 rr3'],['five',1,'f0 a1 en_ih1 v2'],
    ['six',1,'s0 en_ih1 k2 s2'],['seven',1,'s0 en_eh1 v2 ax3 n4'],['eight',0,'e0 en_ih0 t4'],['nine',1,'n0 a1 en_ih1 n2']
  ];
  function recipe(word,stressIndex,text,source='dictionary'){
    const tokens=text.split(' ').map(token=>{const match=/^(.+?)(\d+)$/.exec(token);return {id:match[1],letter:Number(match[2])};});
    return {word,length:word.length,source,stressIndex,score:tokens.map(t=>({id:t.id,duration:duration(t.id)})),tokenLetters:tokens.map(t=>t.letter),stressTokens:tokens.flatMap((t,i)=>t.letter===stressIndex&&vowelIds.has(t.id)?[i]:[])};
  }
  const dictionary=new Map(rows.map(([word,stress,text])=>[word,recipe(word,stress,text)]));
  const digitNames=['zero','one','two','three','four','five','six','seven','eight','nine'];
  const letter=c=>!!c&&/^[a-z]$/i.test(c),vowel=c=>!!c&&/^[aeiouy]$/i.test(c);
  function fallback(word){
    const score=[],tokenLetters=[],push=(ids,at)=>{for(const id of ids.split(' ')){score.push({id,duration:duration(id)});tokenLetters.push(at);}};
    for(let i=0;i<word.length;i++){
      const c=word[i],next=word[i+1],rest=word.slice(i),atStart=i===0;
      if(c==='y'&&atStart&&vowel(next)){push('j',i);continue;}
      if(atStart&&/^(kn|gn|ps)/.test(rest))continue;
      if(atStart&&rest.startsWith('wr'))continue;
      if(rest.startsWith('tion')||rest.startsWith('sion')){push(rest.startsWith('tion')?'sh':'zh',i);push('ax',i+2);push('n',i+3);i+=3;continue;}
      const pair=rest.slice(0,2),pairs={sh:'sh',ch:'ch',th:'en_th',ph:'f',ng:'en_ng',ck:'k',qu:'k w',wh:'w',ee:'i',ea:'i',ai:'e en_ih',ay:'e en_ih',oa:'o u',ow:'o u',oo:'u',ou:'a en_uh',oi:'en_aw en_ih',oy:'en_aw en_ih',au:'en_aw',aw:'en_aw',ar:'a rr',or:'en_aw rr',er:'ax rr',ir:'ax rr',ur:'ax rr'};
      if(Object.hasOwn(pairs,pair)){push(pairs[pair],i);i++;continue;}
      if(c===next&&!vowel(c))continue;
      if(c==='e'&&i===word.length-1&&word.length>2&&!vowel(word[i-1]))continue;
      if(c==='e'&&rest==='ed'&&i>1){const previous=word[i-1];if(previous==='t'||previous==='d')push('en_ih d',i);else push(/[pkfs]/.test(previous)?'t':'d',i+1);i++;continue;}
      const long=word[i+2]==='e'&&i+3===word.length&&!vowel(next),longs={a:'e en_ih',e:'i',i:'a en_ih',o:'o u',u:'j u'};
      if(vowel(c)){
        const short={a:'ae',e:'en_eh',i:'en_ih',o:'a',u:'en_ah',y:i===word.length-1&&word.length>2?'i':'en_ih'};
        push(long&&longs[c]?longs[c]:short[c],i);continue;
      }
      if(c==='c'){push(/[eiy]/.test(next||'')?'s':'k',i);continue;}
      if(c==='g'){push(/[eiy]/.test(next||'')?'dzh':'g',i);continue;}
      if(c==='x'){push('k s',i);continue;}
      if(c==='j'){push('dzh',i);continue;}
      if(c==='r'){push('rr',i);continue;}
      if(c==='s'&&i===word.length-1){push(/[aeiouybdgvlmnr]/.test(word[i-1]||'')?'z':'s',i);continue;}
      push(c==='q'?'k':c,i);
    }
    return {length:word.length,word,score,tokenLetters,stressTokens:[],stressIndex:null,source:'rules'};
  }
  function take(chars,index){
    const c=chars[index];
    if(/^[0-9]$/.test(c||'')){
      const result=copy(dictionary.get(digitNames[Number(c)]));
      return {...result,length:1,source:'digit',stressIndex:0,tokenLetters:result.score.map(()=>0)};
    }
    if(!letter(c))return null;
    let end=index+1;while(letter(chars[end]))end++;
    const word=chars.slice(index,end).join('').toLowerCase();
    return dictionary.has(word)?copy(dictionary.get(word)):fallback(word);
  }
  root.VoiceEnglish=Object.freeze({version,example,phoneIds:Object.freeze(Object.keys(phoneLabels)),phoneLabels:Object.freeze(phoneLabels),getPhone,resolve,take});
})(globalThis);
