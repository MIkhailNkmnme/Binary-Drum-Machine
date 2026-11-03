/* Independent readers of a common field. One AudioContext and one recording output per rack. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./mayatnik-xorrom'),require('./mayatnik-xorrom-host'),()=>require('./mayatnik-xorrom-axis'),()=>require('./mayatnik-xorrom-template'));
  else root.MayatnikXorromRack=factory(root.MayatnikXorrom,root.MayatnikXorromHost,()=>root.MayatnikXorromAxis,()=>root.MayatnikXorromTemplate);
})(globalThis,function(Engine,Host,axisModule,templateModule){
  'use strict';
  const colors=['#a674ff','#20d9e8','#ff7355','#8cda54','#ffa5d4','#ffe55d','#72a7ff'];
  function colorFor(id){
    if(id<=colors.length)return colors[id-1];
    const hue=(id*.61803398875)%1;
    return '#'+[0,4,2].map(n=>{const k=(n+6*hue)%6;return Math.round(255*(.65-.35*Math.max(-1,Math.min(k-3,3-k,1)))).toString(16).padStart(2,'0');}).join('');
  }
  function normalize(value,legacy){
    let input=value?.version===1&&Array.isArray(value.tracks)&&value.tracks.length?value.tracks:[{id:1,settings:legacy}];
    let next=1;const used=new Set();
    const tracks=input.map(raw=>{
      const t=raw||{};let id=t.id;
      if(!(Number.isSafeInteger(id)&&id>0&&id<Number.MAX_SAFE_INTEGER&&!used.has(id))){while(used.has(next))next++;id=next++;}
      used.add(id);
      const ref=t.template,template=ref&&typeof ref.id==='string'&&ref.id&&ref.mask?{id:ref.id,name:String(ref.name||ref.id),fixed:ref.fixed===true,mask:templateModule().normalize(ref.mask)}:null;
      return {id,template,name:typeof t.name==='string'&&t.name.trim()?t.name.trim():'Дорожка '+id,color:/^#[0-9a-f]{6}$/i.test(t.color)?t.color:colorFor(id),
        axis:t.axis&&!template?axisModule().normalize(t.axis):null,axisName:typeof t.axisName==='string'?t.axisName:'',muted:t.muted===true,row:Number.isSafeInteger(t.row)&&t.row>=0?t.row:null,settings:Engine.normalizeSettings(t.settings)};
    });
    return {version:1,selected:used.has(value?.selected)?value.selected:tracks[0].id,tracks};
  }
  function createBus(win){
    let ctx,input,recorder,closed=false;
    function context(){
      if(closed)throw Error('Микшер Xorrom закрыт.');
      if(!ctx){const Context=win.AudioContext||win.webkitAudioContext;if(!Context)throw Error('Web Audio недоступно в этом браузере.');ctx=new Context();input=ctx.createGain();input.connect(ctx.destination);}
      return ctx;
    }
    return {context,input(){context();return input;},stream(){
      if(!ctx||closed||!ctx.createMediaStreamDestination)return null;
      if(!recorder){recorder=ctx.createMediaStreamDestination();input.connect(recorder);}return recorder.stream;
    },dispose(){if(closed)return;closed=true;recorder?.stream.getTracks().forEach(t=>t.stop());input?.disconnect();return ctx?.close();}};
  }
  // Accumulate a single pass at each track's own tempo. Mono is centered; keep
  // stereo effects and round/clamp only the final sum. Reuse buffers between tracks.
  async function mix(tracks,win){
    let left=new Float32Array(0),right=new Float32Array(0),rate=0,truncated=false,stereo=false;
    for(const t of tracks){
      const wav=await t.host.renderTrackWav(),v=new DataView(wav.bytes.buffer,wav.bytes.byteOffset,wav.bytes.byteLength);
      const channels=v.getUint16(22,true),hz=v.getUint32(24,true),n=v.getUint32(40,true)/(2*channels);
      if(rate&&rate!==hz)throw Error('Несовместимая частота WAV.');rate=hz;stereo||=channels===2;truncated||=wav.truncated;
      if(n>left.length){const l=new Float32Array(n),r=new Float32Array(n);l.set(left);r.set(right);left=l;right=r;}
      if(!t.data.muted)for(let i=0;i<n;i++){const p=44+i*channels*2;left[i]+=v.getInt16(p,true);right[i]+=v.getInt16(p+(channels===2?2:0),true);}
    }
    const channels=stereo?2:1,n=left.length,b=new Uint8Array(44+n*channels*2),v=new DataView(b.buffer);
    for(const [at,tag] of [[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']])for(let j=0;j<4;j++)b[at+j]=tag.charCodeAt(j);
    v.setUint32(4,b.length-8,true);v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);
    v.setUint32(24,rate,true);v.setUint32(28,rate*channels*2,true);v.setUint16(32,channels*2,true);v.setUint16(34,16,true);v.setUint32(40,b.length-44,true);
    const pcm=x=>Math.max(-32768,Math.min(32767,Math.round(x)));
    for(let i=0;i<n;i++){const p=44+i*channels*2;v.setInt16(p,pcm(left[i]),true);if(stereo)v.setInt16(p+2,pcm(right[i]),true);}
    return {name:'xorrom-mix.wav',blob:new win.Blob([b],{type:'audio/wav'}),note:'WAV: микс дорожек, '+(n/rate).toFixed(2)+' с.'+(truncated?' Проход обрезан до 60 секунд.':'')};
  }
  function mount(options){
    const win=options.window||globalThis,bus=options.audioBus||createBus(win),hostFactory=options.hostFactory||Host.mount;
    const slots=new Map(),listeners=new Set(),pending=new Map();let selected,changed=false,disposed=false,applied=null;
    const active=()=>slots.get(selected);
    const serialize=()=>({version:1,selected,tracks:[...slots.values()].map(({data})=>({...data,axis:data.axis?{...data.axis}:null,settings:{...data.settings}}))});
    function emit(){if(!changed&&!disposed)for(const f of listeners)f(active().host.getState());}
    function persist(){applied=serialize();options.setRack?.(applied,{...active().data.settings});emit();}
    function identify(){for(const {host,data} of slots.values())host.identify({...data,selected:data.id===selected,multiple:slots.size>1});}
    function select(id){if(!slots.has(id)||selected===id)return;selected=id;identify();persist();}
    function capture(req){
      const key=JSON.stringify([!!req.automatic,req.settings.autoGeometry?req.settings.geometryConnectivity:null]);
      let job=pending.get(key);
      if(!job||job.clients.every(f=>f())){job={clients:[]};pending.set(key,job);const current=job;
        job.result=Promise.resolve().then(()=>options.getSnapshot({...req,cancelled:()=>disposed||current.clients.every(f=>f())})).finally(()=>{if(pending.get(key)===current)pending.delete(key);});}
      job.clients.push(req.cancelled);return job.result;
    }
    function dimensions(){return options.getSize?.()||{width:1,height:options.getHeight?.()||1};}
    function axisFor(data,spec=data.axis){if(!spec)return null;const size=dimensions();if(!(size.width>0&&size.height>0))return null;return axisModule().geometry(size,spec);}
    function updateAxis(slot,spec,label=slot.data.axisName){
      slot.data.template=null;slot.templateKey=null;slot.data.axis=spec?axisModule().normalize(spec):null;slot.data.axisName=spec?label:'';slot.data.row=null;
      slot.host.sourceChanged();persist();
    }
    function updateTemplate(slot,force=false){
      const ref=slot.data.template;if(!ref||ref.fixed&&!force)return false;
      const place=options.getTemplatePlacement?.(ref.id);if(!place||slot.templateKey===place.key&&!force)return false;
      const mask=templateModule().build(place.parts,place.width,place.height);slot.templateKey=place.key;
      slot.data.template={...ref,mask};return true;
    }
    function templatesChanged(){
      let changed=false;for(const s of slots.values())if(updateTemplate(s)){s.host.sourceChanged();changed=true;}
      if(changed)persist();return changed;
    }
    function insert(data){
      const host=hostFactory({...options,ownsSnapshot:true,getTemplate:()=>data.template,getAxis:()=>data.axis,getAxisGeometry:spec=>axisFor(data,spec),getSize:dimensions,
        setAxis:spec=>updateAxis(slots.get(data.id),spec),translateAxis:(spec,dx,dy)=>axisModule().translate(spec,dx,dy),
        getHeight:()=>data.template?1:data.axis?axisFor(data)?.length:dimensions().height,
        async getSnapshot(req){const spec=data.axis,ref=data.template,source=await capture(req);if(ref)return templateModule().project(source,ref.mask,{cancelled:()=>req.cancelled()||data.template!==ref});if(!spec)return source;
          return axisModule().project(source,spec,{cancelled:()=>req.cancelled()||data.axis!==spec});},audioBus:bus,trackId:data.id,muted:data.muted,getCue:()=>data.row,setCue:row=>{if(data.row!==row){data.row=row;persist();}},
        getSettings:()=>data.settings,setSettings:s=>{data.settings=s;persist();},onSelect:()=>select(data.id)});
      const slot={host,data,templateKey:null};slots.set(data.id,slot);host.subscribe(emit);return slot;
    }
    function load(value){changed=true;try{for(const s of slots.values())s.host.dispose();slots.clear();pending.clear();selected=value.selected;value.tracks.forEach(insert);identify();}finally{changed=false;}emit();}
    function refresh(){
      const raw=options.getRack?.();if(raw&&raw===applied)return;
      const next=normalize(raw,options.getSettings?.());if(slots.size&&JSON.stringify(next)===JSON.stringify(serialize())){applied=raw;return;}
      applied=raw;load(next);
    }
    refresh();
    return {templatesChanged,getTemplate:()=>{const t=active().data.template;return t?{id:t.id,name:t.name,fixed:t.fixed}:null;},
      addTemplates(){
        const selectedTemplates=options.getSelectedTemplates?.()||[];if(!selectedTemplates.length)throw Error('Выделите один или несколько видимых шаблонов на поле.');
        const prepared=selectedTemplates.map(t=>{const place=options.getTemplatePlacement(t.id);if(!place)throw Error('Не найден шаблон '+t.name);
          return {t,place,mask:templateModule().build(place.parts,place.width,place.height)};});
        const settings=active().data.settings,ids=[];let id=1;
        for(const {t,place,mask} of prepared){while(slots.has(id))id++;const data=normalize({version:1,tracks:[{id,name:t.name,settings,template:{id:t.id,name:t.name,mask}}]}).tracks[0];const slot=insert(data);slot.templateKey=place.key;ids.push(id++);}
        selected=ids[0];identify();persist();return ids;
      },
      fixTemplate(value){const slot=active();if(!slot.data.template)return;slot.data.template={...slot.data.template,fixed:!!value};
        if(!value&&updateTemplate(slot,true))slot.host.sourceChanged();persist();},
      getAxis:()=>active().data.axis?{...active().data.axis}:null,getAxisName:()=>active().data.axisName,getSize:dimensions,getAxes:()=>options.getAxes?.()||[],
      setAxis(spec,label){updateAxis(active(),spec,label);},
      fixAxis(fixed){const slot=active(),spec=slot.data.axis;if(!spec||spec.fixed===fixed)return;
        const g=axisFor(slot.data),pos=slot.host.getState().index,at=Math.min(g.length-1,Math.max(0,pos>=0?pos:slot.data.row??slot.data.settings.first)),segment=g.segment(at);
        const moved=segment?axisModule().translate({...spec,offset:0},segment.x1-spec.x1,segment.y1-spec.y1):spec;
        updateAxis(slot,{...moved,fixed});},
      getSettings:()=>active().host.getSettings(),setSettings:v=>active().host.setSettings(v),getState:()=>active().host.getState(),
      start:()=>active().host.start(),pause:()=>active().host.pause(),stop:()=>active().host.stop(),seek:r=>active().host.seek(r),
      async startAll(){
        const all=[...slots.values()],waiting=new Set(all.filter(s=>{const v=s.host.getState();return v.state!=='playing'&&!v.updating;}));
        if(waiting.size<2)return Promise.all(all.map(s=>s.host.start()));
        // A slow projection must not make the first track start seconds ahead.
        // Failures and early cancellations release the other readers as well.
        let release,arrived=false;const clock=new Promise(r=>release=r);
        function settle(s){if(waiting.delete(s)&&!waiting.size)release(arrived?bus.context().currentTime+.035:0);}
        return Promise.all(all.map(s=>waiting.has(s)?s.host.start(()=>{arrived=true;settle(s);return clock;}).finally(()=>settle(s)):s.host.start()));
      },stopAll(){for(const s of slots.values())s.host.stop();},
      anyActive:()=>[...slots.values()].some(s=>{const v=s.host.getState();return v.state!=='stopped'||v.updating;}),getStream:()=>bus.stream(),getRack:serialize,getTrackList:()=>({selected,tracks:[...slots.values()].map(({data:{id,name,color,muted}})=>({id,name,color,muted}))}),select,
      add(){let id=1;while(slots.has(id))id++;const source=active().data;const d=normalize({version:1,tracks:[{id,settings:source.settings,row:source.row,axis:source.axis,axisName:source.axisName,template:source.template}]}).tracks[0];insert(d);selected=id;identify();persist();return id;},
      remove(){if(slots.size<=1)return false;const slot=active();slots.delete(selected);selected=slots.keys().next().value;slot.host.dispose();identify();persist();return true;},
      setMuted(v){const a=active();a.data.muted=!!v;a.host.setMuted(!!v);identify();persist();},
      rename(name){const s=active();s.data.name=String(name||'').trim()||'Дорожка '+s.data.id;identify();persist();},
      fieldChanged(stamp){pending.clear();let any=false;for(const s of slots.values())any=s.host.fieldChanged(stamp)||any;return any;},
      exportWav(){const a=[...slots.values()];return a.length===1&&!a[0].data.muted?a[0].host.exportWav():mix(a,win);},
      subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},refresh,serialize,
      dispose(){if(disposed)return;disposed=true;listeners.clear();for(const s of slots.values())s.host.dispose();slots.clear();pending.clear();return bus.dispose();}
    };
  }
  return {mount,normalize,createBus,mix};
});
