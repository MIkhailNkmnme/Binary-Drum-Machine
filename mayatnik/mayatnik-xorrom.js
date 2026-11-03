/* Хорром. The visible field is captured by the host, independently of its animation. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MayatnikXorrom = api;
})(globalThis, function (root) {
  'use strict';

  const DEFAULTS = Object.freeze({
    source: 'rgb', bpm: 96, division: 8, tonic: 0, scale: 'major', octave: 4,
    timbre: 'triangle', gain: 0.25, chord: 3, first: 0, last: -1, stride: 1,
    loop: true, live: false, restartOnFrame: false, autoGeometry: false, geometrySource: 'all', geometryConnectivity: 'sides',
    backing: 'off', backingGain: 0.3, backingTimbre: 'sine', backingRows: 4,
    envelopeOn: false, attack: .005, decay: .08, sustain: .7, release: .12,
    filterType: 'off', cutoff: 8000, resonance: .7,
    lfoTarget: 'off', lfoRate: 2, lfoDepth: 0,
    delayTime: .25, delayFeedback: .25, delayMix: 0,
    reverbMix: 0, reverbTime: 1, pan: 0,
    arpMode: 'off', arpGate: .8, swing: 0
  });
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10],
    pentatonic: [0, 2, 4, 7, 9]
  };
  const ELECTRO_PRESET = Object.freeze({source:'rgb',bpm:112,division:16,tonic:0,scale:'minor',octave:3,timbre:'pulse',gain:.25,chord:1,autoGeometry:false});
  const ELECTRO_TIMBRES = ['bass','pulse','metal','robot'];
  const DRUMS = ['kick', 'snare', 'hat'];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const SYNTH_RANGES = {
    attack:[0,10], decay:[0,10], sustain:[0,1], release:[0,10], cutoff:[20,10000], resonance:[.1,20],
    lfoRate:[.01,40], lfoDepth:[0,1], delayTime:[0,2], delayFeedback:[0,.9], delayMix:[0,1],
    reverbMix:[0,1], reverbTime:[0,5], pan:[-1,1], arpGate:[.05,1], swing:[0,.75]
  };
  const ENUMS = {
    source:['melody','rgb','rhythm'], division:[4,8,16], scale:Object.keys(SCALES),
    timbre:['sine','triangle','pluck','softsquare',...ELECTRO_TIMBRES],
    geometrySource:['all','regions','areas','symmetry'], geometryConnectivity:['sides','corners','diagonal','chess0','bit'],
    backing:['off','pad','bass','counter'], backingTimbre:['sine','triangle','softsquare'],
    filterType:['off','lowpass','highpass','bandpass'], lfoTarget:['off','pitch','filter','gain','pan'], arpMode:['off','up','down','updown']
  };
  function validateSettings(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype,null].includes(Object.getPrototypeOf(input)))
      throw Error('Настройки должны быть объектом JSON.');
    for (const key of Object.keys(input)) if (!Object.hasOwn(DEFAULTS,key)) throw Error('Неизвестный параметр: '+key+'.');
    const ranges = {...SYNTH_RANGES, gain:[0,1], tonic:[0,11], octave:[1,7], chord:[1,4], first:[0,2147483647],
      last:[-1,2147483647], stride:[1,65536], backingGain:[0,1], backingRows:[1,16]};
    const integers = ['division','tonic','octave','chord','first','last','stride','backingRows'];
    for (const key of Object.keys(DEFAULTS)) {
      if (!Object.hasOwn(input,key)) throw Error('Отсутствует параметр: '+key+'.');
      const value = input[key];
      if (typeof value !== typeof DEFAULTS[key]) throw Error('Неверный тип параметра '+key+'.');
      if (typeof value === 'number' && (!Number.isFinite(value) || (integers.includes(key) && !Number.isInteger(value))))
        throw Error('Параметр '+key+' должен быть конечным '+(integers.includes(key)?'целым числом.':'числом.'));
      if (ENUMS[key] && !ENUMS[key].includes(value)) throw Error('Недопустимое значение '+key+': '+String(value)+'.');
      if (ranges[key] && (value < ranges[key][0] || value > ranges[key][1]))
        throw Error('Параметр '+key+' должен быть от '+ranges[key][0]+' до '+ranges[key][1]+'.');
      if (key === 'bpm' && value <= 0) throw Error('Темп bpm должен быть больше нуля.');
    }
    return normalizeSettings(input);
  }
  function normalizeSettings(input) {
    const raw = input || {};
    const pick = (key, values) => values.includes(raw[key]) ? raw[key] : DEFAULTS[key];
    function number(key, lo, hi, integer = true) {
      const value = raw[key];
      if ((typeof value !== 'number' && typeof value !== 'string') || value === '' || !Number.isFinite(+value)) return DEFAULTS[key];
      return clamp(integer ? Math.round(+value) : +value, lo, hi);
    }
    const flag = key => typeof raw[key] === 'boolean' ? raw[key] : DEFAULTS[key];
    const bpm=typeof raw.bpm==='number'||typeof raw.bpm==='string'?Number(raw.bpm):NaN;
    return {
      source: pick('source', ['melody', 'rgb', 'rhythm']), bpm:Number.isFinite(bpm)&&bpm>0?bpm:DEFAULTS.bpm,
      division: [4, 8, 16].includes(+raw.division) ? +raw.division : DEFAULTS.division,
      tonic: number('tonic', 0, 11), scale: pick('scale', Object.keys(SCALES)), octave: number('octave', 1, 7),
      timbre: pick('timbre', ['sine', 'triangle', 'pluck', 'softsquare', ...ELECTRO_TIMBRES]), gain: number('gain', 0, 1, false),
      chord: number('chord', 1, 4), first: number('first', 0, 2147483647), last: number('last', -1, 2147483647),
      stride: number('stride', 1, 65536), loop: flag('loop'), live: flag('live'), restartOnFrame: flag('restartOnFrame'),
      autoGeometry: flag('autoGeometry'), geometrySource: pick('geometrySource', ['all', 'regions', 'areas', 'symmetry']),
      geometryConnectivity: pick('geometryConnectivity', ['sides', 'corners', 'diagonal', 'chess0', 'bit']),
      backing: pick('backing', ['off', 'pad', 'bass', 'counter']), backingGain: number('backingGain', 0, 1, false),
      backingTimbre: pick('backingTimbre', ['sine', 'triangle', 'softsquare']), backingRows: number('backingRows', 1, 16),
      envelopeOn: flag('envelopeOn'), filterType: pick('filterType',ENUMS.filterType),
      lfoTarget: pick('lfoTarget',ENUMS.lfoTarget), arpMode: pick('arpMode',ENUMS.arpMode),
      ...Object.fromEntries(Object.entries(SYNTH_RANGES).map(([key,[lo,hi]]) => [key,number(key,lo,hi,false)]))
    };
  }

  function selectedRegion(row) {
    const {triangle, zero, one} = row?.geometry || {};
    if (triangle) return triangle;
    if (!zero || !one) return zero || one || null;
    if (zero.orientation === 'down' && zero.triangleScore >= 0.5) return zero;
    if (zero.exterior !== one.exterior) return zero.exterior ? one : zero;
    return zero.area >= one.area ? zero : one;
  }
  function volumeFactor(settings, region) {
    if (!region || !['all','areas'].includes(settings.geometrySource)) return 1;
    const density = clamp(region.area / (region.width * region.height), 0, 1);
    return 0.4 + 0.6 * density;
  }
  function modulate(base, region) {
    const s = {...base}, mode = s.geometrySource;
    if (!region) return s;
    if (mode === 'all' || mode === 'regions') {
      s.division = region.width >= 2 * region.height ? 4 : region.height >= 2 * region.width ? 16 : 8;
      const tier = clamp(Math.floor(Math.log2(region.perimeter / 4)), 0, 3);
      s.timbre = ['sine', 'triangle', 'pluck', 'softsquare'][tier];
    }
    if (mode === 'all' || mode === 'areas') {
      // Each doubling of the region's area moves one fifth away from the manual tonic.
      const tier = Math.floor(Math.log2(region.area));
      s.tonic = (base.tonic + 7 * tier) % 12;
      s.chord = clamp(1 + Math.floor(tier / 2), 1, 4);
      s.gain = base.gain * volumeFactor(base, region);
    }
    if (mode === 'all' || mode === 'symmetry') {
      const h = region.symmetryHeight;
      s.scale = h < 2 ? 'minor' : h < 4 ? 'pentatonic' : 'major';
      s.octave = clamp(base.octave + (h < 2 ? -1 : h >= 8 ? 1 : 0), 1, 7);
    }
    return s;
  }
  function effectiveSettings(settings, row) {
    const s = normalizeSettings(settings);
    return modulate(s, s.autoGeometry && selectedRegion(row));
  }
  function frequency(midi) { return 440 * 2 ** ((midi - 69) / 12); }
  function notesForRow(row, index, settings) {
    return notesAt(row, index, effectiveSettings(settings, row));
  }
  function notesAt(row, index, s) {
    if (!row || (s.autoGeometry && row.ones === 0)) return [];
    const scale = SCALES[s.scale];
    function pitch(degree, code) {
      const midi = 12 * (s.octave + 1 + Math.floor(degree / scale.length)) + s.tonic + scale[degree % scale.length];
      return { midi, frequency: frequency(midi), degree: degree + 1, code, velocity: 0.75 };
    }
    if (s.source === 'rgb') {
      const codes = [1, 2, 3, 4, 5, 6, 7].filter(code => row.colors && row.colors[code] > 0);
      return codes.sort((a, b) => row.colors[b] - row.colors[a] || a - b)
        .slice(0, s.chord).map(code => pitch(code - 1, code));
    }
    const ones = Math.max(0, Math.floor(+row.ones || 0));
    if (!ones) return [];
    if (s.source === 'melody') return [pitch(ones % 7, null)];

    // Columns repeat three percussion lanes. A lane with any set bit sounds once.
    const lanes = [false, false, false];
    if (row.bits && row.bits.length) {
      for (let x = 0; x < row.bits.length; x++) if (+row.bits[x] === 1) lanes[x % 3] = true;
    } else {
      lanes[(Math.max(0, Math.floor(index || 0)) + ones - 1) % 3] = true;
    }
    return lanes.flatMap((active, lane) => {
      if (!active) return [];
      const midi = [36, 50, 90][lane];
      return [{ midi, frequency: frequency(midi), degree: 0, code: null, drum: DRUMS[lane], velocity: 0.75 }];
    });
  }

  function stepSeconds(s) {
    const step=(240/s.division)/s.bpm;
    if(step*SAMPLE_RATE<1||!Number.isSafeInteger(Math.ceil(step*SAMPLE_RATE)))
      throw RangeError('Этот темп невозможно представить с точностью звукового отсчёта.');
    return step;
  }
  function rowStep(row, index, base, snapshot) {
    const geometry = base.autoGeometry ? selectedRegion(row) : null;
    const effective = modulate(base, geometry);
    return {row, index, geometry, effective, notes: notesAt(row, index, effective), step: scoreStep(snapshot,index,base),
      backing: backingFor(snapshot, index, base)};
  }
  function bounds(snapshot, s) {
    const end = (snapshot && snapshot.rows ? snapshot.rows.length : 0) - 1;
    const first = Math.min(s.first, end);
    return { first, last: s.last < 0 ? end : clamp(s.last, first, end) };
  }
  function scoreStep(snapshot,index,s) {
    const nominal = i => stepSeconds(modulate(s,s.autoGeometry && selectedRegion(snapshot?.rows[i])));
    if (!s.swing || !snapshot) return nominal(index);
    const range = bounds(snapshot,s), position = Math.floor((index-range.first)/s.stride);
    const first = index-(position%2)*s.stride, second=first+s.stride;
    if (second>range.last) return nominal(index);
    const a=nominal(first), b=nominal(second), transfer=Math.min(a,b)*s.swing;
    const step=position%2?b-transfer:a+transfer;
    if (step*SAMPLE_RATE<1) throw RangeError('Свинг при этом темпе короче одного звукового отсчёта.');
    return step;
  }

  // The second instrument holds one phrase across several selected rows. Its
  // addresses and duration belong to the score, never to screen pixels or timers.
  function backingFor(snapshot, index, s) {
    if (!snapshot || s.backing === 'off' || !s.backingGain) return null;
    const range = bounds(snapshot, s);
    const first = range.first + Math.floor((index - range.first) / (s.stride * s.backingRows)) * s.stride * s.backingRows;
    let duration = 0, elapsed = 0, anchor;
    for (let i = first, count = 0; i <= range.last && count < s.backingRows; i += s.stride, count++) {
      const row = snapshot.rows[i], effective = effectiveSettings(s, row), notes = notesAt(row, i, effective);
      if (!anchor && notes.length) anchor = {row, effective, notes};
      const step = scoreStep(snapshot,i,s);
      if (i < index) elapsed += step;
      duration += step;
    }
    // Entirely empty/filtered phrases are silent; an internal rest can sit over
    // the preceding held note, as it does in a two-instrument arrangement.
    if (!anchor) return null;
    if(!Number.isSafeInteger(Math.round(duration*SAMPLE_RATE)))
      throw RangeError('Длина фоновой фразы не представима с точностью звукового отсчёта.');
    const {effective, row} = anchor;
    const tonic = 12 * Math.max(2, effective.octave) + effective.tonic;
    let midis;
    if (s.backing === 'pad') midis = [tonic, tonic + 7];
    else {
      const notes = notesAt(row, first, {...effective, source: effective.source === 'rhythm' ? 'melody' : effective.source, chord: 4});
      const note = s.backing === 'counter' ? notes.at(-1) : notes[0];
      midis = [clamp((note?.midi ?? tonic + 12) - (s.backing === 'bass' ? 24 : 12), 24, 108)];
    }
    return {first, duration, elapsed, effective, geometry: s.autoGeometry ? selectedRegion(row) : null,
      notes: midis.map(midi => ({midi, frequency: frequency(midi), velocity: .75, backing: true}))};
  }

  // A single PCM synthesizer serves playback and WAV. Every voice starts and
  // finishes at zero. Harmonics above Nyquist are omitted at synthesis time.
  const SAMPLE_RATE = 22050;
  const PARTIALS = {
    sine: [[1, 1]],
    triangle: [[1, 1], [3, -1/9], [5, 1/25], [7, -1/49]],
    pluck: [[1, 0.75], [2, 0.4], [3, 0.15], [4, 0.1]],
    softsquare: [[1, 1], [3, 0.28], [5, 0.12], [7, 0.05]],
    kick: [[1, 1]],
    snare: [[1, 0.5], [2.73, 0.45], [4.1, 0.32], [9.37, 0.28], [18.6, 0.2]],
    hat: [[1.79, 0.4], [2.53, 0.55], [3.17, 0.36], [4.43, 0.45]]
  };
  function cacheTone(build) {
    const cache = new Map();
    return (note, step, timbre, rate) => {
      const key = [note.backing ? 'backing' : 'lead', note.drum || timbre, note.midi, step, rate,timbre==='robot'?((note.code||1)-1)%3:''].join('/');
      if (!cache.has(key)) {
        if (cache.size >= 48) cache.delete(cache.keys().next().value);
        cache.set(key, build(note, step, timbre, rate));
      }
      return cache.get(key);
    };
  }
  function synthesize(note, step, timbre, rate) {
    if (note.backing) return synthesizeBacking(note, step, timbre, rate);
    const kind = note.drum || timbre;
    if(ELECTRO_TIMBRES.includes(kind))return synthesizeElectro(note,step,kind,rate);
    const duration = Math.min(step * 0.86, ({kick: 0.22, snare: 0.14, hat: 0.065})[kind] || 2);
    const samples = new Float32Array(Math.max(2, Math.round(duration * rate)));
    const startHz = note.frequency * (kind === 'kick' ? 2.4 : 1);
    const endHz = note.frequency * (kind === 'kick' || kind === 'snare' ? 0.65 : 1);
    const partials = PARTIALS[kind].filter(([harmonic]) => harmonic * startHz < rate / 2);
    const amplitude = partials.reduce((sum, [,weight]) => sum + Math.abs(weight), 0) || 1;
    const pitchChange = (endHz / startHz) ** (1 / samples.length);
    let phase = 0, increment = 2 * Math.PI * startHz / rate;
    const attack = Math.max(1, Math.round(Math.min(duration * 0.12, 0.008) * rate));
    const decay = note.drum || kind === 'pluck' ? 5 : 1.5;
    for (let i = 0; i < samples.length - 1; i++) {
      const progress = i / (samples.length - 1);
      const level = Math.min(1, i / attack) * (1 - progress) ** decay;
      let value = 0;
      for (const [harmonic, weight] of partials) value += weight * Math.sin(phase * harmonic);
      samples[i] = value * level * 0.7 * note.velocity / amplitude;
      phase += increment;
      increment *= pitchChange;
    }
    return samples;
  }
  function synthesizeBacking(note, duration, timbre, rate, first=0, count=Infinity) {
    const total=Math.max(2,Math.round(duration*rate));
    if(!Number.isSafeInteger(total))throw RangeError('Длина фоновой фразы не представима с точностью звукового отсчёта.');
    const samples=new Float32Array(Math.min(count,total-first));
    const partials = PARTIALS[timbre].filter(([h]) => h * note.frequency < rate / 2);
    const normalizer = partials.reduce((sum, [,weight]) => sum + Math.abs(weight), 0) || 1;
    const fade = Math.max(1, Math.round(Math.min(.08, duration / 4) * rate));
    for (let i=Math.max(1,first);i<Math.min(total-1,first+samples.length);i++) {
      const edge = Math.min(1, i / fade, (total - 1 - i) / fade);
      const envelope = .5 - .5 * Math.cos(Math.PI * edge);
      let value = 0;
      for (const [h, weight] of partials) value += weight * Math.sin(2 * Math.PI * note.frequency * h * i / rate);
      samples[i-first] = value / normalizer * envelope * .7 * note.velocity;
    }
    return samples;
  }
  function synthesizeElectro(note,step,kind,rate){
    const duration=Math.min(step*({bass:.68,pulse:.76,metal:.88,robot:.82})[kind],kind==='metal'?1.4:1.2);
    const samples=new Float32Array(Math.max(2,Math.round(duration*rate))),hz=note.frequency;
    const partials=[];
    if(kind==='metal'){
      for(const [h,w]of [[1,1],[Math.SQRT2,.6],[2.71,.36],[4.07,.2]])if(h*hz<rate/2)partials.push([h,w]);
    }else{
      const formants=[[800,1150,2900],[400,1900,2600],[350,900,2200]][((note.code||1)-1)%3];
      for(let h=1;h<=32&&h*hz<rate/2;h++){
        let weight=1/h;
        if(kind==='pulse')weight=2*Math.sin(Math.PI*h*.3)/(Math.PI*h);
        if(kind==='robot')weight=(.12+formants.reduce((a,f,i)=>a+(i===0?2.4:1.4)*Math.exp(-.5*((h*hz-f)/(i===0?110:180))**2),0))/h;
        partials.push([h,weight]);
      }
    }
    const normalizer=partials.reduce((n,p)=>n+Math.abs(p[1]),0)||1,attack=Math.max(1,Math.round(.004*rate)),release=Math.max(1,Math.round(.012*rate));
    for(let i=1;i<samples.length-1;i++){
      const t=i/rate,progress=i/(samples.length-1),phase=2*Math.PI*hz*t;
      let value=0;const cutoff=kind==='bass'?180+2600*Math.exp(-t/.055):1;
      for(const [h,w]of partials){
        const filter=kind==='bass'?1/Math.sqrt(1+(h*hz/cutoff)**4):1;
        const ring=kind==='metal'?Math.exp(-t*h*5):1;
        value+=w*filter*ring*Math.sin(phase*h);
      }
      const gate=Math.min(1,i/attack,(samples.length-1-i)/release),decay=kind==='bass'?Math.exp(-t*7):kind==='metal'?1:(1-progress)**.65;
      samples[i]=value/normalizer*gate*decay*.7*note.velocity;
    }
    return samples;
  }
  // New synthesis stays in PCM, rather than a second Web Audio effect graph:
  // the exact same stereo samples feed speakers, capture and WAV. Old presets
  // retain their historical mono PCM when every new audible feature is off.
  function synthEnabled(s) {
    return s.envelopeOn || s.filterType !== 'off' || (s.lfoTarget !== 'off' && s.lfoDepth>0) ||
      (s.delayMix>0 && s.delayTime>0) || (s.reverbMix>0 && s.reverbTime>0) || s.pan!==0 || s.arpMode!=='off';
  }
  function effectTail(s) {
    const delay = s.delayMix && s.delayTime ? Math.min(8,s.delayTime*(s.delayFeedback ? Math.ceil(Math.log(.001)/Math.log(s.delayFeedback))+1 : 1)) : 0;
    const cutoff=clamp(s.cutoff/2**(s.lfoTarget==='filter'?4*s.lfoDepth:0),20,10000);
    const filter=s.filterType==='off'?0:Math.min(3,6*s.resonance/(Math.PI*cutoff));
    return filter + delay + (s.reverbMix && s.reverbTime ? s.reverbTime : 0);
  }
  function tailSeconds(s) { return synthEnabled(s) ? (s.envelopeOn?Math.max(.003,s.release):0)+effectTail(s) : 0; }
  function voicePartials(note,kind,rate) {
    const hz=note.frequency;
    if (PARTIALS[kind]) return PARTIALS[kind].filter(([h])=>h*hz*1.12<rate/2);
    if (kind==='metal') return [[1,1],[Math.SQRT2,.6],[2.71,.36],[4.07,.2]].filter(([h])=>h*hz*1.12<rate/2);
    const out=[], formants=[[800,1150,2900],[400,1900,2600],[350,900,2200]][((note.code||1)-1)%3];
    for(let h=1;h<=32&&h*hz*1.12<rate/2;h++) {
      let weight=1/h;
      if(kind==='pulse')weight=2*Math.sin(Math.PI*h*.3)/(Math.PI*h);
      if(kind==='robot')weight=(.12+formants.reduce((a,f,i)=>a+(i===0?2.4:1.4)*Math.exp(-.5*((h*hz-f)/(i===0?110:180))**2),0))/h;
      out.push([h,weight]);
    }
    return out;
  }
  function envelopeAt(t,gate,s) {
    function held(at) {
      if(s.attack>0 && at<s.attack)return at/s.attack;
      if(s.decay>0 && at<s.attack+s.decay)return 1-(1-s.sustain)*(at-s.attack)/s.decay;
      return s.sustain;
    }
    const release=Math.max(.003,s.release);
    return t<gate ? held(t)*Math.min(1,t/.003) : held(gate)*Math.max(0,1-(t-gate)/release);
  }
  function leadVoices(event,rate) {
    const s=event.effective, ordered=event.notes.slice().sort((a,b)=>a.midi-b.midi);
    let notes=event.notes, arpeggiated=s.arpMode!=='off';
    if(arpeggiated) {
      notes=s.arpMode==='down'?ordered.reverse():ordered;
      if(s.arpMode==='updown' && notes.length>2)notes=notes.concat(notes.slice(1,-1).reverse());
    }
    const slot=event.step/(arpeggiated?Math.max(1,notes.length):1), gate=slot*(arpeggiated?s.arpGate:.86);
    return notes.map((note,i)=>{
      const start=arpeggiated?i*slot:0,kind=note.drum||s.timbre;
      // Legacy non-ADSR envelopes keep their familiar duration and transient.
      const legacy=s.envelopeOn?null:synthesize(note,arpeggiated?slot*s.arpGate/.86:slot,s.timbre,rate);
      const duration=legacy?legacy.length/rate:gate+Math.max(.003,s.release),partials=voicePartials(note,kind,rate);
      return {note,start,gate,kind,legacy,duration,partials,normalizer:partials.reduce((n,[,w])=>n+Math.abs(w),0)||1,
        level:(arpeggiated?1:1/Math.max(1,notes.length))*(s.envelopeOn?gate/(gate+Math.max(.003,s.release)):1)};
    });
  }
  function makeStereoRenderer(event,rate,fromSeconds=0) {
    const s=event.effective, voices=leadVoices(event,rate), backing=event.backing;
    if((voices.length||backing)&&tailSeconds(s)/event.step>512)throw RangeError('Слишком много перекрывающихся хвостов синтезатора: уменьшите темп, Release или эффекты.');
    const end=Math.max(0,...voices.map(v=>v.start+v.duration),backing?event.step:0);
    const tail=effectTail(s), total=Math.max(2,Math.round((end+tail)*rate));
    if(!Number.isSafeInteger(total))throw RangeError('Длина звука не представима с точностью звукового отсчёта.');
    const delayLength=s.delayMix && s.delayTime?Math.max(1,Math.round(s.delayTime*rate)):0;
    const delay=delayLength?new Float32Array(delayLength):null;
    const combs=s.reverbMix && s.reverbTime ? [.0297,.0371,.0411,.0437].map(t=>({data:new Float32Array(Math.round(t*rate)),feedback:.001**(t/s.reverbTime)})) : [];
    let at=0, previous=0, dc=0, x1=0,x2=0,y1=0,y2=0, coefficients;
    const dcPole=Math.exp(-2*Math.PI*15/rate),ratio=backing?s.backingGain:0,share=1/(1+ratio);
    const backingPartials=backing?backing.notes.map(note=>({note,partials:PARTIALS[s.backingTimbre].filter(([h])=>h*note.frequency<rate/2)})):[];
    function sampleVoice(v,t) {
      t-=v.start;
      if(t<=0 || t>=v.duration)return 0;
      const lfo=s.lfoTarget==='pitch'?.12*s.lfoDepth:0;
      if(v.legacy && !lfo)return v.legacy[Math.min(v.legacy.length-1,Math.round(t*rate))]*v.level;
      // Integrated frequency gives continuous vibrato, even at chunk/seek boundaries.
      const phaseTime=t+lfo*(1-Math.cos(2*Math.PI*s.lfoRate*t))/(2*Math.PI*s.lfoRate);
      let value=0;
      for(const [h,w]of v.partials) {
        const bright=v.kind==='bass'?1/Math.sqrt(1+(h*v.note.frequency/(180+2600*Math.exp(-t/.055)))**4):1;
        const ring=v.kind==='metal'?Math.exp(-t*h*5):1;
        value+=w*bright*ring*Math.sin(2*Math.PI*v.note.frequency*h*phaseTime);
      }
      let envelope;
      if(s.envelopeOn)envelope=envelopeAt(t,v.gate,s);
      else {
        // Keep the original amplitude envelope while changing oscillator pitch.
        const progress=t/v.duration,attack=Math.min(v.duration*.12,.008);
        envelope=Math.min(1,t/Math.max(1/rate,attack))*(1-progress)**(v.note.drum||v.kind==='pluck'?5:1.5);
      }
      return value/v.normalizer*envelope*.7*v.note.velocity*v.level;
    }
    function next(count) {
      count=Math.max(0,Math.min(count,total-at));
      const left=new Float32Array(count),right=new Float32Array(count);
      for(let j=0;j<count;j++,at++) {
        const t=at/rate,wave=Math.sin(2*Math.PI*s.lfoRate*t);
        let input=voices.reduce((sum,v)=>sum+sampleVoice(v,t),0)*share;
        if(backing && t<event.step) {
          const absolute=t+backing.elapsed,fade=Math.min(.08,backing.duration/4),edge=Math.max(0,Math.min(1,absolute/fade,(backing.duration-absolute)/fade));
          let value=0;
          for(const {note,partials}of backingPartials) {
            const normalizer=partials.reduce((n,[,w])=>n+Math.abs(w),0)||1;
            for(const [h,w]of partials)value+=w*Math.sin(2*Math.PI*note.frequency*h*absolute)/normalizer;
          }
          input+=value*.7*.75*(.5-.5*Math.cos(Math.PI*edge))*ratio*share/backingPartials.length*(backing.effective.gain/(s.gain||1));
        }
        if(s.filterType!=='off') {
          if(!coefficients || at%32===0) {
            const cutoff=clamp(s.cutoff*2**(s.lfoTarget==='filter'?4*s.lfoDepth*wave:0),20,Math.min(10000,rate*.45));
            const w=2*Math.PI*cutoff/rate,c=Math.cos(w),a=Math.sin(w)/(2*s.resonance),a0=1+a;
            const b=s.filterType==='lowpass'?[(1-c)/2,1-c,(1-c)/2]:s.filterType==='highpass'?[(1+c)/2,-(1+c),(1+c)/2]:[a,0,-a];
            coefficients=[b[0]/a0,b[1]/a0,b[2]/a0,-2*c/a0,(1-a)/a0];
          }
          const [b0,b1,b2,a1,a2]=coefficients,x=input/Math.max(1,s.resonance);
          const y=b0*x+b1*x1+b2*x2-a1*y1-a2*y2;x2=x1;x1=x;y2=y1;y1=y;
          input=Math.tanh(y);
        }
        if(s.lfoTarget==='gain')input*=1-s.lfoDepth/2+s.lfoDepth*wave/2;
        // Remove any subsonic bias before feeding feedback networks.
        dc=input-previous+dcPole*dc;previous=input;input=dc;
        if(delay) {
          const index=at%delay.length,wet=delay[index];delay[index]=input+wet*s.delayFeedback;
          input=input*(1-s.delayMix)+wet*(1-s.delayFeedback)*s.delayMix;
        }
        const pan=clamp(s.pan+(s.lfoTarget==='pan'?s.lfoDepth*wave:0),-1,1),angle=(pan+1)*Math.PI/4;
        let l=input*Math.SQRT2*Math.cos(angle),r=input*Math.SQRT2*Math.sin(angle);
        if(combs.length) {
          let wetL=0,wetR=0;
          for(let k=0;k<combs.length;k++) {
            const comb=combs[k],index=at%comb.data.length,wet=comb.data[index];
            comb.data[index]=input+wet*comb.feedback;
            if(k%2)wetR+=wet*(1-comb.feedback)/2;else wetL+=wet*(1-comb.feedback)/2;
          }
          l=l*(1-s.reverbMix)+wetL*s.reverbMix;r=r*(1-s.reverbMix)+wetR*s.reverbMix;
        }
        // A fixed headroom reserve keeps release/effect overlaps below full scale.
        // All feedback paths are stable, and their wet gains have unit L1 bounds.
        const fade=Math.min(1,(total-1-at)/(rate*.008));
        left[j]=l*.5*fade;right[j]=r*.5*fade;
      }
      return [left,right];
    }
    // Seeking warms only the bounded effect memory, never an enormous slow beat.
    const from=Math.min(total,Math.max(0,Math.round(fromSeconds*rate)));
    at=Math.max(0,from-Math.ceil((tail+.5)*rate));
    while(at<from)next(Math.min(rate,from-at));
    return {next,total,position:()=>at};
  }
  function renderStereoWav(snapshot,s,options={}) {
    const range=bounds(snapshot,s);
    if(range.first<0)throw Error('В снимке нет строк для WAV.');
    const rate=options.sampleRate===44100?44100:SAMPLE_RATE;
    const maxSeconds=Number.isFinite(options.maxSeconds)?clamp(options.maxSeconds,1/rate,60):60;
    const limit=Math.max(1,Math.round(maxSeconds*rate)),left=new Float32Array(limit),right=new Float32Array(limit);
    let elapsed=0,index=range.first,end=0,steps=0;
    for(;index<=range.last&&Math.round(elapsed*rate)<limit;index+=s.stride) {
      const event=rowStep(snapshot.rows[index],index,s,snapshot),offset=Math.round(elapsed*rate);
      const renderer=makeStereoRenderer(event,rate);
      steps++;
      end=Math.max(end,offset+renderer.total);elapsed+=event.step;
      while(offset+renderer.position()<limit&&renderer.position()<renderer.total) {
        const first=renderer.position(),channels=renderer.next(Math.min(rate,limit-offset-first));
        for(let j=0;j<channels[0].length;j++) {
          left[offset+first+j]+=channels[0][j]*event.effective.gain;right[offset+first+j]+=channels[1][j]*event.effective.gain;
        }
      }
    }
    const frames=Math.round(elapsed*rate),needed=Math.max(frames,end),length=Math.min(needed,limit);
    const truncated=index<=range.last||needed>limit;
    const bytes=new Uint8Array(44+length*4),view=new DataView(bytes.buffer);
    function tag(offset,text){for(let i=0;i<text.length;i++)bytes[offset+i]=text.charCodeAt(i);}
    tag(0,'RIFF');view.setUint32(4,bytes.length-8,true);tag(8,'WAVE');tag(12,'fmt ');view.setUint32(16,16,true);
    view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,rate,true);view.setUint32(28,rate*4,true);
    view.setUint16(32,4,true);view.setUint16(34,16,true);tag(36,'data');view.setUint32(40,length*4,true);
    for(let i=0;i<length;i++) {
      const fade=truncated?Math.min(1,(length-1-i)/(rate*.008)):1;
      view.setInt16(44+i*4,Math.round(clamp(left[i]*fade,-1,1)*32767),true);
      view.setInt16(46+i*4,Math.round(clamp(right[i]*fade,-1,1)*32767),true);
    }
    return {bytes,duration:length/rate,steps,truncated,sampleRate:rate,channels:2};
  }
  function renderWav(snapshot, settings, options = {}) {
    const normalized=normalizeSettings(settings);
    if(synthEnabled(normalized))return renderStereoWav(snapshot,normalized,options);
    const s = normalizeSettings(settings), range = bounds(snapshot, s);
    if (range.first < 0) throw new Error('В снимке нет строк для WAV.');
    const sampleRate = options.sampleRate === 44100 ? 44100 : SAMPLE_RATE;
    const maxSeconds = Number.isFinite(options.maxSeconds) ? clamp(options.maxSeconds, 1/sampleRate, 60) : 60;
    const limit = Math.max(1, Math.round(maxSeconds * sampleRate)), timeline = [];
    let elapsed = 0, index = range.first;
    for (; index <= range.last && Math.round(elapsed * sampleRate) < limit; index += s.stride) {
      const event = rowStep(snapshot.rows[index], index, s, snapshot);
      timeline.push({...event, offset: Math.round(elapsed * sampleRate)});
      elapsed += event.step;
    }
    const framesNeeded = Math.round(elapsed * sampleRate);
    const length = Math.min(framesNeeded, limit);
    const truncated = index <= range.last || framesNeeded > limit;
    const bytes = new Uint8Array(44 + 2 * length), view = new DataView(bytes.buffer);
    function tag(offset, text) { for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i); }
    tag(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); tag(8, 'WAVE');
    tag(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); tag(36, 'data'); view.setUint32(40, length * 2, true);
    const toneFor = cacheTone(synthesize);
    if (s.backing !== 'off' && s.backingGain) {
      const mixed = new Float32Array(length);
      function add(notes, duration, timbre, offset, level) {
        for (const note of notes) {
          const tone = note.backing&&duration>16?synthesizeBacking(note,duration,timbre,sampleRate,0,length-offset):toneFor(note, duration, timbre, sampleRate);
          for (let i = 0; i < tone.length && offset + i < length; i++) mixed[offset + i] += tone[i] * level / notes.length;
        }
      }
      for (const {notes, step, effective, offset, backing} of timeline) {
        const ratio = backing ? s.backingGain : 0, share = 1 / (1 + ratio);
        add(notes, step, effective.timbre, offset, effective.gain * share);
        if (backing && !backing.elapsed) add(backing.notes, backing.duration, s.backingTimbre, offset, backing.effective.gain * ratio * share);
      }
      for (let i = 0; i < length; i++) {
        const fade = truncated ? Math.min(1, (length - 1 - i) / (sampleRate * .008)) : 1;
        view.setInt16(44 + 2 * i, Math.round(clamp(mixed[i] * fade, -1, 1) * 32767), true);
      }
      return {bytes, duration: length / sampleRate, steps: timeline.length, truncated, sampleRate};
    }
    for (const {notes, step, effective, offset} of timeline) {
      const tones = notes.map(note => toneFor(note, step, effective.timbre, sampleRate));
      const frames = Math.min(length - offset, Math.max(0, ...tones.map(tone => tone.length)));
      for (let i = 0; i < frames; i++) {
        let sample = 0;
        for (const tone of tones) sample += tone[i] || 0;
        const fade = truncated ? Math.min(1, (length - 1 - offset - i) / (sampleRate * 0.008)) : 1;
        view.setInt16(44 + 2 * (offset + i), Math.round(sample * effective.gain * fade * 32767 / tones.length), true);
      }
    }
    return {bytes, duration: length / sampleRate, steps: timeline.length, truncated, sampleRate};
  }

  function create(options = {}) {
    const timer = options.setTimeout || root.setTimeout.bind(root);
    const clear = options.clearTimeout || root.clearTimeout.bind(root);
    const doc = options.document || root.document;
    let settings = normalizeSettings(options.settings), state = 'stopped', sequence = 0;
    let ctx, master, streamNode, bus, snapshot, wake, nextTime, cursor = 0, disposed = false;
    let queued = [], refreshing = false, currentIndex = -1;
    let lastBeat = null, refreshBeat = null;
    let backingScheduled = null;
    const voices = new Map();
    const backingVoices = new Map();
    function makeBuffer(samples,rate){
      const channels=Array.isArray(samples)?samples:[samples];
      const buffer = ctx.createBuffer(channels.length, channels[0].length, rate);
      channels.forEach((data,index)=>buffer.getChannelData(index).set(data));
      return buffer;
    }
    const audioBuffer = cacheTone((note,step,timbre,rate)=>makeBuffer(synthesize(note,step,timbre,rate),rate));
    function changeState(next) {
      if (next === state) return;
      state = next;
      if (options.onState) options.onState(next);
    }
    function setSettings(patch) {
      const previous = settings;
      settings = normalizeSettings({...settings, ...patch});
      if (master) master.gain.setTargetAtTime(settings.gain, ctx.currentTime, 0.01);
      if (['backing','backingGain','backingTimbre','backingRows'].some(key => previous[key] !== settings[key])) {
        backingScheduled = null;
        if (ctx) for (const [source, gain] of backingVoices) {
          gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + .008);
          source.stop(ctx.currentTime + .009);
        }
        backingVoices.clear();
      }
      const synthesisKeys=['envelopeOn','filterType','lfoTarget','arpMode',...Object.keys(SYNTH_RANGES)];
      const changedSynthesis=synthesisKeys.some(key=>previous[key]!==settings[key]);
      if((previous.bpm!==settings.bpm||changedSynthesis||
          (synthEnabled(previous)&&['backing','backingGain','backingTimbre','backingRows'].some(key=>previous[key]!==settings[key])))&&snapshot&&state==='playing'){
        beginRefresh();
        try{replaceSnapshot(snapshot,{resume:true});}catch(error){reportError(error);}
      }
      return {...settings};
    }
    function halt(next, retainedBeat = null) {
      const run = ++sequence;
      refreshBeat = retainedBeat;
      lastBeat = null;
      backingScheduled = null;
      backingVoices.clear();
      clear(wake);
      if (next === 'paused' && queued.length) {
        const upcoming = queued.find(event => event.time > ctx.currentTime);
        if (upcoming) { cursor = upcoming.index; snapshot = upcoming.snapshot; }
      }
      queued = [];
      refreshing = false;
      if (bus) {
        const oldBus = bus, active = [...voices];
        const now = ctx.currentTime;
        oldBus.gain.setValueAtTime(1, now);
        oldBus.gain.linearRampToValueAtTime(0, now + 0.008);
        let remaining = active.length;
        if (!remaining) oldBus.disconnect();
        for (const [source, startTime] of active) {
          const ended = source.onended;
          source.onended = () => { ended(); if (--remaining === 0) oldBus.disconnect(); };
          source.stop(startTime > now || ctx.state !== 'running' ? now : now + 0.009);
        }
        voices.clear();
        bus = null;
      }
      if (next === 'stopped') { snapshot = null; cursor = 0; currentIndex = -1; }
      changeState(next);
      return run;
    }
    function stop() { halt('stopped'); }
    function pause() { halt(state === 'playing' ? 'paused' : state); }
    function beginRefresh() {
      if (!snapshot || disposed) return;
      let beat = refreshBeat;
      if (state === 'playing') {
        const now = ctx.currentTime;
        beat = lastBeat || queued[0] || {index:cursor, time:nextTime};
        for (const event of queued) if (event.time <= now) beat = event;
      }
      halt('paused', beat && {index:beat.index, time:beat.time, step:beat.step});
    }
    function contextStateChanged() {
      if (ctx.state !== 'running') pause();
    }
    function visibilityChanged() { if (doc && doc.hidden) pause(); }
    if (doc) doc.addEventListener('visibilitychange', visibilityChanged);

    function reportError(error) {
      stop();
      if (options.onError) options.onError(error);
    }
    function sound({notes, step, effective, geometry, backing}, time, offset = 0) {
      if (!bus) {
        bus = ctx.createGain();
        bus.connect(master);
      }
      function play(buffer, at, from, level, isBacking = false, refill) {
        if (from >= buffer.duration) return;
        const source = ctx.createBufferSource(), gain = ctx.createGain();
        source.buffer = buffer;
        gain.gain.value = level;
        if (from > 0) {
          gain.gain.setValueAtTime(0, at);
          gain.gain.linearRampToValueAtTime(level, at + 0.005);
        }
        source.connect(gain);
        gain.connect(bus);
        voices.set(source, at);
        if (isBacking) backingVoices.set(source, gain);
        source.onended = () => { voices.delete(source); backingVoices.delete(source); source.disconnect(); gain.disconnect();refill?.(); };
        source.start(at, from);
      }
      if(synthEnabled(effective)) {
        const renderer=makeStereoRenderer({notes,step,effective,geometry,backing},SAMPLE_RATE,offset),run=sequence;
        const start=time-offset;
        function refillStereo() {
          if(sequence!==run||disposed||!bus||doc?.hidden||ctx.state!=='running'||renderer.position()>=renderer.total)return;
          const first=renderer.position(),samples=renderer.next(SAMPLE_RATE);
          play(makeBuffer(samples,SAMPLE_RATE),Math.max(ctx.currentTime,start+first/SAMPLE_RATE),0,
            volumeFactor(effective,geometry),false,refillStereo);
        }
        refillStereo();refillStereo();
        return;
      }
      const ratio = backing ? effective.backingGain : 0, share = 1 / (1 + ratio);
      for (const note of notes) play(audioBuffer(note,step,effective.timbre,SAMPLE_RATE),time,offset,volumeFactor(effective, geometry) * share / notes.length);
      if (!backing) return;
      const start = time - offset - backing.elapsed;
      if (backingScheduled?.first === backing.first && Math.abs(backingScheduled.start - start) < .001) return;
      backingScheduled = {first:backing.first, start};
      const level = volumeFactor(backing.effective, backing.geometry) * ratio * share / backing.notes.length;
      const timbre=effective.backingTimbre,phrase=backingScheduled,from=backing.elapsed+offset;
      for(const note of backing.notes){
        if(backing.duration<=16){play(audioBuffer(note,backing.duration,timbre,SAMPLE_RATE),time,from,level,true);continue;}
        // Keep two seconds at most queued. Absolute sample indices preserve
        // the oscillator phase and the envelope through every buffer boundary.
        const total=Math.round(backing.duration*SAMPLE_RATE);
        let first=Math.floor(from*SAMPLE_RATE);
        function refill(){
          if(phrase!==backingScheduled||disposed||doc?.hidden||ctx.state!=='running')return;
          first=Math.max(first,Math.floor((ctx.currentTime-start)*SAMPLE_RATE));
          if(first>=total)return;
          const at=Math.max(time,start+first/SAMPLE_RATE);
          const samples=synthesizeBacking(note,backing.duration,timbre,SAMPLE_RATE,first,SAMPLE_RATE);
          first+=samples.length;
          play(makeBuffer(samples,SAMPLE_RATE),at,0,level,true,refill);
        }
        refill();refill();
      }
    }
    function tick(run) {
      if (sequence !== run || state !== 'playing') return;
      try {
        if (ctx.state !== 'running' || (doc && doc.hidden)) { pause(); return; }
        const now = ctx.currentTime;
        // A stalled UI can miss a wakeup. Publish only the most recent due step.
        let due;
        while (queued.length && queued[0].time <= now) due = queued.shift();
        if (due) { currentIndex = due.index; lastBeat = due; }
        if (due && now - due.time < 0.10 && options.onStep) {
          options.onStep({...due.event, time: due.time});
        }
        if (sequence !== run) return;
        const exhausted=!settings.loop&&cursor>bounds(snapshot,settings).last;
        if(nextTime<now&&!exhausted){
          const range=bounds(snapshot,settings);
          // A delayed wakeup can miss thousands of very short steps. Resume
          // on the next real boundary rather than enqueuing their old notes.
          if(range.first>=0&&!settings.live&&lastBeat?.step*64<now-nextTime){
            if(cursor>range.last&&!settings.loop){stop();return;}
            const pos=locateBeat({index:cursor>range.last?range.first:cursor,time:nextTime},range,now);
            if(!pos){stop();return;}
            cursor=pos.index;nextTime=pos.time;
            if(nextTime<now){
              nextTime+=scoreStep(snapshot,cursor,settings);
              cursor+=settings.stride;
            }
          }else nextTime=now;
        }
        const horizon = now + 0.10;
        for(let scheduled=0;nextTime<horizon&&scheduled<64;scheduled++){
          const range = bounds(snapshot, settings);
          if (cursor > range.last) {
            if (!settings.loop) {
              if (nextTime + tailSeconds(settings) <= now) { stop(); return; }
              break;
            }
            if (settings.live) {
              if (!refreshing) {
                refreshing = true;
                Promise.resolve(options.getSnapshot()).then(fresh => {
                  if (sequence !== run) return;
                  snapshot = fresh;
                  cursor = bounds(snapshot, settings).first;
                  refreshing = false;
                }).catch(error => { if (sequence === run) reportError(error); });
              }
              break;
            }
            cursor = range.first;
          }
          if (range.first < 0) { stop(); return; }
          cursor = Math.max(range.first, cursor);
          const event = rowStep(snapshot.rows[cursor], cursor, settings, snapshot);
          sound(event, nextTime);
          queued.push({index:cursor, time:nextTime, step:event.step, snapshot, event});
          cursor += settings.stride;
          nextTime += event.step;
        }
        const nextWake = queued.length ? Math.min(0.025, queued[0].time - ctx.currentTime) : 0.025;
        wake = timer(() => tick(run), Math.max(1, Math.ceil(nextWake * 1000)));
      } catch (error) { reportError(error); }
    }

    async function seek(index, {audition = true} = {}) {
      if (disposed || !snapshot?.rows.length || !Number.isFinite(index) || doc?.hidden) return false;
      const run = halt('paused');
      if (sequence !== run) return false;
      const range = bounds(snapshot, settings);
      currentIndex = cursor = clamp(Math.trunc(index), range.first, range.last);
      try {
        if (audition && ctx.state !== 'running') await ctx.resume();
        if (sequence !== run || doc?.hidden || (audition && ctx.state !== 'running')) return false;
        const event = rowStep(snapshot.rows[cursor], cursor, settings, snapshot);
        const time = ctx.currentTime;
        if (audition) sound(event, time);
        options.onStep?.({...event, time, manual: true});
        return true;
      } catch (error) {
        if (sequence !== run) return false;
        pause();
        throw error;
      }
    }
    // Preserve the fraction of the sounding beat when a replacement changes its
    // duration. Cross subsequent rows with their own durations. Skip full loops
    // arithmetically when capture was delayed for longer than a whole score.
    function locateBeat(beat, range, now) {
      let index = clamp(beat.index, range.first, range.last), time = beat.time;
      let cycleStart;
      for (;;) {
        const row = snapshot.rows[index];
        const step = scoreStep(snapshot,index,settings);
        const duration = beat?.step || step;
        if (now < time + duration) {
          if (now > time) time = now - (now - time) * step / duration;
          return {index, time};
        }
        time += duration;
        beat = null;
        index += settings.stride;
        if (index > range.last) {
          if (!settings.loop) return null;
          index = range.first;
          if (cycleStart !== undefined) {
            const cycle = time - cycleStart;
            time += Math.floor((now - time) / cycle) * cycle;
          }
          cycleStart = time;
        }
      }
    }
    function replaceSnapshot(fresh, {index = currentIndex, resume = false, restart = false} = {}) {
      if (disposed || !snapshot) return -1;
      const range = bounds(fresh, settings);
      if (range.first < 0) { stop(); return -1; }
      const beat = refreshBeat;
      const run = halt('paused');
      if (sequence !== run) return -1;
      snapshot = fresh;
      if (resume && (restart || beat) && ctx.state === 'running' && !doc?.hidden) {
        const now = ctx.currentTime, position = restart ? {index:range.first, time:now} : locateBeat(beat, range, now);
        if (!position) { stop(); return -1; }
        cursor = position.index;
        nextTime = position.time;
        const selected = cursor;
        changeState('playing');
        if (sequence !== run) return -1;
        // Carry both row and sample phase across a frame replacement, including
        // the rest at the end of a note.
        if (nextTime <= now) {
          const event = rowStep(snapshot.rows[cursor], cursor, settings, snapshot);
          sound(event, now, now - nextTime);
          lastBeat = {index:cursor, time:nextTime, step:event.step};
          currentIndex = cursor;
          cursor += settings.stride;
          nextTime += event.step;
          options.onStep?.({...event, time:now});
        }
        tick(run);
        return selected;
      }
      currentIndex = cursor = Number.isFinite(index) ? clamp(Math.trunc(index), range.first, range.last) : range.first;
      const event = rowStep(snapshot.rows[cursor], cursor, settings, snapshot);
      options.onStep?.({...event, time: ctx.currentTime, manual: true});
      return currentIndex;
    }
    async function start(patch) {
      if (disposed) return false;
      if (patch) setSettings(patch);
      if (state === 'playing') return true;
      if (doc && doc.hidden) return false;
      const run = halt(state);
      try {
        if (!ctx) {
          const Context = options.AudioContext || root.AudioContext || root.webkitAudioContext;
          if (!Context) throw new Error('Web Audio недоступно в этом браузере.');
          ctx = new Context();
          master = ctx.createGain();
          master.gain.value = settings.gain;
          master.connect(ctx.destination);
          ctx.addEventListener('statechange', contextStateChanged);
        }
        if (ctx.state !== 'running') await ctx.resume();
        if (sequence !== run) return false;
        if (ctx.state !== 'running' || (doc && doc.hidden)) return false;
        if (state !== 'paused') {
          const fresh = await options.getSnapshot();
          if (sequence !== run) return false;
          snapshot = fresh;
          cursor = bounds(snapshot, settings).first;
        }
        if (ctx.state !== 'running' || (doc && doc.hidden)) return false;
        if (bounds(snapshot, settings).first < 0) { stop(); return false; }
        nextTime = ctx.currentTime + 0.035;
        changeState('playing');
        tick(run);
        return state === 'playing';
      } catch (error) {
        if (sequence !== run) return false;
        stop();
        throw error;
      }
    }
    function getStream() {
      if (!master || !ctx.createMediaStreamDestination || disposed) return null;
      if (!streamNode) { streamNode = ctx.createMediaStreamDestination(); master.connect(streamNode); }
      return streamNode.stream;
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      if (doc) doc.removeEventListener('visibilitychange', visibilityChanged);
      if (streamNode) for (const track of streamNode.stream.getTracks()) track.stop();
      if (ctx) {
        ctx.removeEventListener('statechange', contextStateChanged);
        return ctx.close();
      }
    }
    return { start, pause, stop, seek, beginRefresh, replaceSnapshot, setSettings, getState: () => state, getStream, dispose };
  }

  return { DEFAULTS, ELECTRO_PRESET, normalizeSettings, validateSettings, effectiveSettings, geometryForRow: selectedRegion, frequency, notesForRow, renderWav, create };
});
