/* Xorrom transport, live field refresh and an interactive score-row marker. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(root,require('./mayatnik-xorrom.js'));
  else root.MayatnikXorromHost=factory(root,root.MayatnikXorrom);
})(globalThis,function(root,defaultEngine){
  'use strict';
  const labelGroups=new WeakMap();
  function edges(doc,win,id){
    let group=labelGroups.get(doc);if(!group){group=new Set();labelGroups.set(doc,group);}
    const labels=['left','right'].map(side=>{const el=doc.createElement('span');el.dataset.xorromEdge=side;el.hidden=true;el.setAttribute('aria-hidden','true');Object.assign(el.style,{position:'fixed',[side]:'0',zIndex:'2147483647',pointerEvents:'none',padding:'1px 4px',font:'bold 11px/13px system-ui',background:'#14141ce6',border:'1px solid currentColor',borderRadius:'2px',whiteSpace:'nowrap'});doc.body.append(el);return el;});
    const item={labels,y:null};group.add(item);
    function arrange(){
      const h=win.innerHeight||doc.documentElement.clientHeight||1;
      for(let side=0;side<2;side++){const active=[...group].filter(t=>t.y).sort((a,b)=>a.y[side]-b.y[side]);const step=Math.min(17,(h-16)/Math.max(1,active.length-1));
        const tops=[];for(let i=0;i<active.length;i++)tops.push(Math.max(i?tops[i-1]+step:0,Math.min(h-16,active[i].y[side]-8)));
        for(let i=tops.length-1;i>=0;i--){tops[i]=Math.min(tops[i],i===tops.length-1?h-16:tops[i+1]-step);active[i].labels[side].style.top=Math.max(0,tops[i])+'px';}
      }
    }
    function hide(){if(!item.y)return;item.y=null;labels.forEach(el=>el.hidden=true);arrange();}
    return {hide,show(left,right,value,name,color){if(![left,right].every(Number.isFinite)){hide();return;}
      item.y=[left,right];for(const el of labels){el.hidden=false;el.textContent=(id?'№'+id+' · ':'')+value;el.title=name;el.style.color=color;}arrange();},
      destroy(){group.delete(item);labels.forEach(el=>el.remove());arrange();}};
  }
  function mount(options={}){
    const win=options.window||root.window||root,doc=options.document||win.document,engine=options.engine||defaultEngine;
    if(!doc||!engine||typeof options.getSnapshot!=='function')throw Error('Хорром: нужны документ, аудиоядро и источник поля.');
    let settings=engine.normalizeSettings(options.getSettings?.()),state='stopped',index=-1,notes=[],backingNotes=[],error='',effective=null,geometry=null;
    let generation=0,disposed=false,lastSnapshot=null,frame=null,refreshFrame=null,updating=false,resumeAfterRefresh=false,fieldStamp=null;
    let multiple=false,identity={},angledDrag=null;
    let drag=null,manualGeneration=0,observer=null,observedFigure=null;
    const runCache=new WeakMap(),listeners=new Set(),viewport=options.viewport;
    const labels=edges(doc,win,options.trackId);
    const marker=doc.createElement('div');marker.id=options.trackId&&options.trackId!==1?'mayXorromRow-'+options.trackId:'mayXorromRow';marker.tabIndex=0;marker.setAttribute('role','slider');marker.setAttribute('aria-orientation','vertical');marker.setAttribute('aria-label','Линия чтения Xorrom');marker.title='Линия чтения: тяните вверх или вниз, чтобы повторить строку';
    Object.assign(marker.style,{position:'fixed',display:'none',pointerEvents:'none',boxSizing:'border-box',zIndex:'2147483645',background:'transparent'});
    const readingLine=doc.createElement('div');readingLine.dataset.xorromLine='';Object.assign(readingLine.style,{position:'absolute',left:'0',right:'0',height:'1px',background:'#a674ff',pointerEvents:'none'});
    const hit=doc.createElement('div');hit.dataset.xorromDrag='';hit.title='Тянуть вверх или вниз — снова сыграть выбранную строку';Object.assign(hit.style,{position:'absolute',left:'0',right:'0',top:'50%',height:'14px',transform:'translateY(-50%)',pointerEvents:'auto',cursor:'ns-resize',touchAction:'none'});marker.append(hit);doc.body.append(marker);
    marker.append(readingLine);
    const ns='http://www.w3.org/2000/svg',outline=doc.createElementNS(ns,'svg'),runs=doc.createElementNS(ns,'path');
    outline.setAttribute('aria-hidden','true');Object.assign(outline.style,{position:'absolute',left:'0',pointerEvents:'none',overflow:'hidden'});
    runs.setAttribute('fill','rgba(255,184,48,.28)');runs.setAttribute('stroke','#fff2a6');runs.setAttribute('stroke-width','1');runs.setAttribute('vector-effect','non-scaling-stroke');runs.setAttribute('shape-rendering','crispEdges');runs.style.filter='drop-shadow(0 0 3px #ffac28)';outline.append(runs);marker.append(outline);
    const sourceFigure=()=>typeof options.figure==='function'?options.figure():options.figure;
    const sourceRect=()=>options.figureRect?.()||sourceFigure()?.getBoundingClientRect();
    const overlay=options.axisMarker?.mount({window:win,document:doc,viewport,figureRect:sourceRect,onDragStart:axisDown,onDrag:axisMove,onDragEnd:axisUp,onKey:axisKey});
    function identify({muted=false,name='Xorrom',color='#a674ff',selected=false,multiple:many=false}={}){identity={name,color,selected,muted};multiple=many;readingLine.style.background=color;marker.setAttribute('aria-label','Линия чтения: '+name);hit.title=name+' — перетащить на другую строку';marker.style.zIndex=selected?'2147483646':'2147483645';scheduleMarker();}
    function getState(){return {state,index,notes:notes.map(note=>({...note})),backingNotes:backingNotes.map(note=>({...note})),error,updating,effective:effective?{...effective}:null,geometry:geometry?{...geometry}:null};}
    function publish(){if(!disposed)for(const listener of listeners)listener(getState());}
    function showRuns(bits,rect,left,right,top,visibleTop,visibleBottom,rowHeight){
      // Give the halo room above/below the row, but clip both ends to the
      // visible field. The viewBox keeps paths in the row's screen coordinates.
      outline.style.top=(visibleTop-top)+'px';outline.setAttribute('width',String(right-left));outline.setAttribute('height',String(visibleBottom-visibleTop));outline.setAttribute('viewBox','0 '+(visibleTop-top)+' '+(right-left)+' '+(visibleBottom-visibleTop));
      if(!bits?.length){runs.removeAttribute('d');return;}
      const pitch=rect.width/bits.length,first=Math.max(0,Math.floor((left-rect.left)/pitch)),end=Math.min(bits.length,Math.ceil((right-rect.left)/pitch));
      const y=rect.top+index*rowHeight-top,paths=[];
      for(let x=first;x<end;){
        if(bits[x]!==1){x++;continue;}
        let from=x++;while(x<end&&bits[x]===1)x++;
        // A clipped run continues past the viewport. Leave its outside edge
        // offscreen instead of drawing a new vertical border at the clip.
        if(from===first)while(from>0&&bits[from-1]===1)from--;
        let to=x;if(x===end)while(to<bits.length&&bits[to]===1)to++;
        paths.push('M'+(rect.left+from*pitch-left)+' '+y+'h'+((to-from)*pitch)+'v'+rowHeight+'h'+((from-to)*pitch)+'Z');
      }
      if(paths.length)runs.setAttribute('d',paths.join(' '));else runs.removeAttribute('d');
    }
    function showMarker(){
      labels.hide();frame=null;marker.style.display='none';runs.removeAttribute('d');
      const axis=options.getAxis?.(),template=options.getTemplate?.(),special=!!(axis||template);
      const parked=state==='stopped'&&(multiple||special);if(!special)overlay?.hide();
      if(disposed||doc.hidden||updating||options.isVisible?.()===false||!parked&&(!lastSnapshot||index<0||!['playing','paused'].includes(state))){if(!angledDrag)overlay?.hide();return;}
      const figure=sourceFigure();if(figure!==observedFigure){if(observedFigure&&observedFigure!==viewport)observer?.unobserve?.(observedFigure);observedFigure=figure;if(figure&&figure!==viewport)observer?.observe(figure);}if(!figure||!viewport||figure.isConnected===false||viewport.isConnected===false){overlay?.hide();return;}
      if(win.getComputedStyle&&(win.getComputedStyle(figure).display==='none'||win.getComputedStyle(viewport).display==='none'||win.getComputedStyle(viewport).visibility==='hidden')){overlay?.hide();return;}
      if(special&&overlay){
        const size=options.getSize(),row=parked?null:lastSnapshot?.rows[index];let onesRuns=row&&runCache.get(row);
        if(!onesRuns&&row?.indices){
          onesRuns=[];let prev=-2,run=null;for(let i=0;i<row.bits.length;i++)if(row.bits[i]===1){const q=row.indices[i],x=q%size.width,y=Math.floor(q/size.width);
            if(run&&y===run.y&&(q===prev+1||q===prev-1)){run.x=Math.min(run.x,x);run.length++;}else {run={x,y,length:1};onesRuns.push(run);}prev=q;}
          runCache.set(row,onesRuns);
        }
        const g=axis?(angledDrag?.next?options.getAxisGeometry(angledDrag.next):!parked&&lastSnapshot?.axis||options.getAxisGeometry(axis)):null;
        const seg=g?.segment(Math.min(g.length-1,Math.max(0,parked?options.getCue?.()??settings.first:index)));
        overlay.update({visible:!!(seg||onesRuns?.length),...identity,...size,a:seg?[seg.x1,seg.y1]:null,b:seg?[seg.x2,seg.y2]:null,onesRuns});
        const r=sourceRect(),y=row=>r.top+(row+.5)*r.height/size.height;
        if(seg&&!overlay.element.hidden){const forward=seg.x1<=seg.x2,step=parked?options.getCue?.()??settings.first:index;
          labels.show(y(forward?seg.y1:seg.y2),y(forward?seg.y2:seg.y1),'срез '+Math.max(0,Math.min(g.length-1,step)),identity.name,identity.color);}
        else if(template&&row?.indices?.length){const first=Math.floor(row.indices[0]/size.width),last=Math.floor(row.indices[row.indices.length-1]/size.width);
          const h=y((first+last)/2),clip=viewport.getBoundingClientRect();if(h>=clip.top&&h<=clip.bottom)labels.show(h,h,first===last?'строка '+first:'строки '+first+'–'+last,identity.name,identity.color);}
        return;
      }
      const rect=sourceRect(),clip=viewport.getBoundingClientRect(),height=parked?options.getHeight?.():lastSnapshot.height||lastSnapshot.rows.length;
      const at=parked?Math.min(height-1,Math.max(settings.first,Math.min(settings.last<0?height-1:settings.last,options.getCue?.()??settings.first))):index;
      if(!(rect?.width>0&&rect.height>0&&height>0)||at>=height)return;
      const rowHeight=rect.height/height,center=rect.top+(at+.5)*rowHeight,band=Math.max(2,rowHeight);
      const top=Math.max(0,clip.top,rect.top,center-band/2),bottom=Math.min(win.innerHeight||doc.documentElement.clientHeight,clip.bottom,rect.bottom,center+band/2);
      const left=Math.max(0,clip.left,rect.left),right=Math.min(win.innerWidth||doc.documentElement.clientWidth,clip.right,rect.right);if(!(bottom>top&&right>left))return;
      Object.assign(marker.style,{display:'block',left:left+'px',top:top+'px',width:(right-left)+'px',height:(bottom-top)+'px',opacity:parked&&!drag?'.65':state==='paused'&&!drag?'.45':'1'});
      labels.show(center,center,'строка '+at,identity.name||'Линия чтения',identity.color||'#a674ff');readingLine.style.top=(center-top-.5)+'px';
      readingLine.style.display=center>=top&&center<=bottom?'block':'none';
      showRuns(!parked&&lastSnapshot.rows[index]?.bits,rect,left,right,top,Math.max(0,clip.top,rect.top),Math.min(win.innerHeight||doc.documentElement.clientHeight,clip.bottom,rect.bottom),rowHeight);
      const first=Math.min(settings.first,height-1),last=settings.last<0?height-1:Math.max(first,Math.min(settings.last,height-1));marker.setAttribute('aria-valuemin',String(first));marker.setAttribute('aria-valuemax',String(last));marker.setAttribute('aria-valuenow',String(at));marker.setAttribute('aria-valuetext','Строка '+at);
    }
    function scheduleMarker(){if(disposed||frame!==null)return;if(win.requestAnimationFrame)frame=win.requestAnimationFrame(showMarker);else showMarker();}
    function abortError(){const reason=Error('Чтение Хоррома отменено.');reason.name='AbortError';return reason;}
    function freezeSnapshot(snapshot){
      if(!snapshot||!Array.isArray(snapshot.rows))throw Error('Хорром: источник не вернул строки поля.');
      const regions=new Map(),region=value=>{if(!value)return value;if(!regions.has(value))regions.set(value,Object.freeze({...value}));return regions.get(value);};
      const rows=snapshot.rows.map(row=>Object.freeze({...row,bits:row.bits?.slice(),colors:row.colors?.slice(),...(row.geometry?{geometry:Object.freeze({zero:region(row.geometry.zero),one:region(row.geometry.one),triangle:region(row.geometry.triangle)})}:{})}));return Object.freeze({...snapshot,rows:Object.freeze(rows)});
    }
    async function capture(remember,automatic=false){
      const run=generation,auto=settings.autoGeometry,links=settings.geometryConnectivity,cancelled=()=>disposed||run!==generation||auto!==settings.autoGeometry||auto&&links!==settings.geometryConnectivity;
      const snapshot=await options.getSnapshot({cancelled,automatic,settings:{...settings}});if(cancelled())throw abortError();const frozen=options.ownsSnapshot?snapshot:freezeSnapshot(snapshot);if(remember)lastSnapshot=frozen;return frozen;
    }
    function fail(reason){error=reason?.message||String(reason);publish();}
    const core=engine.create({audioBus:options.audioBus,muted:options.muted,getCue:options.getCue,AudioContext:win.AudioContext||win.webkitAudioContext,document:doc,settings,
      getSnapshot:()=>capture(true,state==='playing'),
      onStep:step=>{if(disposed||state!=='playing'&&!(step.manual&&state==='paused'))return;index=step.index;notes=Array.isArray(step.notes)?step.notes.map(note=>({...note})):[];backingNotes=settings.backing!=='off'&&settings.backingGain?step.backing?.notes?.map(note=>({...note}))||[]:[];effective=step.effective?{...step.effective}:null;geometry=step.geometry?{...step.geometry}:null;showMarker();publish();},
      onState:next=>{if(disposed)return;state=next;if(next!=='playing')generation++;if(next==='stopped'){index=-1;notes=[];backingNotes=[];effective=null;geometry=null;lastSnapshot=null;updating=false;resumeAfterRefresh=false;}showMarker();publish();},onError:fail});
    function getSettings(){return {...settings};}
    function applySettings(next){
      const analyze=settings.autoGeometry!==next.autoGeometry||next.autoGeometry&&settings.geometryConnectivity!==next.geometryConnectivity;settings=next;core.setSettings(settings);
      const row=lastSnapshot?.rows[index];effective=row&&engine.effectiveSettings?engine.effectiveSettings(settings,row):null;geometry=settings.autoGeometry&&row&&engine.geometryForRow?engine.geometryForRow(row):null;
      if(settings.backing==='off'||!settings.backingGain)backingNotes=[];if(analyze)invalidateScore();
    }
    function setSettings(patch){if(disposed)return getSettings();applySettings(engine.normalizeSettings({...settings,...patch}));options.setSettings?.({...settings});publish();return getSettings();}
    async function start(rendezvous){if(disposed)return false;error='';if(updating){resumeAfterRefresh=true;publish();return true;}if(state==='playing')return true;publish();++generation;try{return await core.start(undefined,rendezvous);}catch(reason){if(disposed||reason?.name==='AbortError')return false;fail(reason);throw reason;}}
    function pause(internal=false){if(disposed)return;if(!internal)cancelDrag();resumeAfterRefresh=false;if(!updating)generation++;core.pause();showMarker();publish();}
    function cancelDrag(){manualGeneration++;angledDrag=null;if(!drag)return;const previous=drag;drag=null;try{hit.releasePointerCapture?.(previous.id);}catch(_){}showMarker();}
    function stop(){if(disposed)return;cancelDrag();generation++;updating=false;resumeAfterRefresh=false;if(refreshFrame!==null)win.cancelAnimationFrame?.(refreshFrame);refreshFrame=null;core.stop();state='stopped';index=-1;notes=[];backingNotes=[];effective=null;geometry=null;lastSnapshot=null;showMarker();publish();}
    async function seek(row){if(disposed||updating||!lastSnapshot||typeof core.seek!=='function')return false;error='';try{const result=await core.seek(row,{audition:true});if(result!==false&&index>=0)options.setCue?.(index);return result;}catch(reason){if(reason?.name==='AbortError')return false;fail(reason);return false;}}
    function park(row){
      const height=options.getHeight?.();if(!(height>0))return;
      options.setCue?.(Math.min(height-1,Math.max(settings.first,Math.min(settings.last<0?height-1:settings.last,Math.round(row)))));showMarker();
    }
    function preview(row){if(!drag)return;if(drag.parked){park(row);return;}const next=Math.max(settings.first,Math.min(settings.last<0?lastSnapshot.rows.length-1:Math.min(settings.last,lastSnapshot.rows.length-1),Math.round(row)));if(drag.last===next)return;drag.last=next;drag.pending=seek(next);}
    function axisDown(point){
      const spec=options.getAxis?.();if(!spec||updating||disposed)return;options.onSelect?.();
      const wasPlaying=state==='playing';if(wasPlaying)pause(true);
      angledDrag={spec,start:point,wasPlaying,parked:state==='stopped',ticket:++manualGeneration,pending:Promise.resolve(),last:null};
    }
    function axisMove(point){
      const d=angledDrag;if(!d)return;
      if(d.spec.fixed){d.next=options.translateAxis(d.spec,point.dx,point.dy);showMarker();return;}
      const g=lastSnapshot?.axis||options.getAxisGeometry(d.spec),row=g?.nearest(point.x,point.y);
      if(!Number.isInteger(row)||row===d.last)return;d.last=row;if(d.parked)park(row);else d.pending=seek(row);
    }
    async function axisUp({cancelled}){
      const d=angledDrag;if(!d)return;angledDrag=null;
      if(cancelled||disposed){scheduleMarker();return;}if(d.next&&d.next.offset!==d.spec.offset)options.setAxis(d.next);
      await d.pending;if(d.wasPlaying&&d.ticket===manualGeneration&&!doc.hidden&&!disposed){if(updating)resumeAfterRefresh=true;else try{await start();}catch(_){}}
    }
    function axisKey(event){
      const s=options.getAxis?.();if(!s)return;options.onSelect?.();
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
        event.preventDefault();event.stopPropagation();const step=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1;
        if(s.fixed)options.setAxis({...s,offset:s.offset+step});else if(state==='stopped')park((options.getCue?.()??settings.first)+step);
        else {const was=state==='playing';pause();const ticket=manualGeneration;seek(index+step).then(()=>{if(was&&ticket===manualGeneration&&!disposed&&!doc.hidden)void start().catch(()=>{});});}
      }else void key(event);
    }
    function down(event){
      if(event.button===0&&multiple&&state==='stopped'&&!updating&&!disposed){
        const rect=sourceRect(),height=options.getHeight?.();if(!(height>0&&rect?.height>0))return;
        event.preventDefault();event.stopPropagation();options.onSelect?.();cancelDrag();
        drag={id:event.pointerId,y:event.clientY,row:Number(marker.getAttribute('aria-valuenow')),unit:rect.height/height,parked:true};hit.setPointerCapture?.(event.pointerId);marker.focus?.({preventScroll:true});return;
      }
      if(event.button!==0||disposed||updating||!lastSnapshot||index<0||!['playing','paused'].includes(state))return;
      event.preventDefault();event.stopPropagation();const rect=sourceRect();if(!(rect?.height>0))return;
      options.onSelect?.();const wasPlaying=state==='playing';cancelDrag();pause(true);drag={id:event.pointerId,y:event.clientY,pointerY:event.clientY,row:index,unit:rect.height/(lastSnapshot.height||lastSnapshot.rows.length),wasPlaying,ticket:++manualGeneration,last:null,pending:Promise.resolve()};
      hit.setPointerCapture?.(event.pointerId);marker.focus?.({preventScroll:true});preview(index);showMarker();
    }
    function move(event){if(!drag||event.pointerId!==drag.id)return;event.preventDefault();event.stopImmediatePropagation();drag.pointerY=event.clientY;preview(drag.row+(event.clientY-drag.y)/drag.unit);}
    async function up(event){
      if(!drag||event.pointerId!==drag.id)return;event.preventDefault();event.stopImmediatePropagation();const previous=drag;drag=null;try{hit.releasePointerCapture?.(event.pointerId);}catch(_){}showMarker();
      if(previous.parked)return;
      if(event.type==='pointercancel'){manualGeneration++;pause(true);return;}await previous.pending;if(!disposed&&previous.ticket===manualGeneration&&previous.wasPlaying&&!doc.hidden){if(updating)resumeAfterRefresh=true;else try{await start();}catch(_){}}
    }
    async function key(event){
      if(multiple&&state==='stopped'&&['ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();options.onSelect?.();const at=Number(marker.getAttribute('aria-valuenow'));park(event.key==='Home'?0:event.key==='End'?Infinity:at+(event.key==='ArrowUp'?-1:1));return;}
      if(event.key===' '&&lastSnapshot){event.preventDefault();event.stopPropagation();if(state==='playing')pause();else try{await start();}catch(_){}return;}
      if(!['ArrowUp','ArrowDown','Home','End','Enter'].includes(event.key)||!lastSnapshot||updating)return;event.preventDefault();event.stopPropagation();const wasPlaying=state==='playing',ticket=++manualGeneration;pause(true);
      const row=event.key==='Home'?settings.first:event.key==='End'?(settings.last<0?lastSnapshot.rows.length-1:settings.last):index+(event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:0);
      await seek(row);if(ticket===manualGeneration&&wasPlaying&&!disposed&&!updating&&!doc.hidden)try{await start();}catch(_){}
    }
    hit.addEventListener('pointerdown',down);hit.addEventListener('lostpointercapture',()=>{if(drag){cancelDrag();pause(true);}});marker.addEventListener('keydown',key);win.addEventListener('pointermove',move,{capture:true,passive:false});win.addEventListener('pointerup',up,true);win.addEventListener('pointercancel',up,true);
    function queueRefresh(){if(disposed||!updating||refreshFrame!==null)return;refreshFrame=win.requestAnimationFrame(()=>{refreshFrame=null;void refreshField();});}
    async function refreshField(){
      const run=generation;try{
        const snapshot=await capture(false,true);if(run!==generation||!updating)return;
        const previous=lastSnapshot?.frame;
        const restart=settings.restartOnFrame&&Number.isInteger(previous)&&Number.isInteger(snapshot.frame)&&snapshot.frame!==previous;
        const resume=resumeAfterRefresh&&!drag;
        lastSnapshot=snapshot;
        core.replaceSnapshot(snapshot,{index:restart?settings.first:Math.max(0,drag?.last??index),resume,restart});if(run!==generation||!updating)return;
        const shouldStart=resume&&resumeAfterRefresh;
        updating=false;resumeAfterRefresh=false;showMarker();publish();
        if(drag){drag.row=index;drag.y=drag.pointerY;drag.unit=sourceRect().height/(snapshot.height||snapshot.rows.length);drag.last=index;if(!restart)drag.pending=seek(index);}
        else if(shouldStart&&run===generation&&state!=='playing'&&!doc.hidden)await start();
      }catch(reason){if(disposed||run!==generation)return;if(reason?.name==='AbortError'){queueRefresh();return;}updating=false;resumeAfterRefresh=false;core.stop();fail(reason);}
    }
    function fieldChanged(stamp){
      if(disposed||!stamp)return false;if(fieldStamp?.owner===stamp.owner&&fieldStamp?.key===stamp.key)return false;fieldStamp=stamp;
      return invalidateScore();
    }
    function invalidateScore(){
      if(!lastSnapshot||state==='stopped'&&!updating){if(multiple||options.getAxis?.()||options.getTemplate?.())scheduleMarker();return false;}
      const resume=updating?resumeAfterRefresh:drag?drag.wasPlaying:state==='playing';if(core.beginRefresh)core.beginRefresh();else core.pause();generation++;updating=true;resumeAfterRefresh=resume;notes=[];backingNotes=[];effective=null;geometry=null;showMarker();publish();queueRefresh();return true;
    }
    async function renderTrackWav(){
      if(disposed)throw abortError();if(updating)throw Error('Дождитесь обновления музыкального кадра.');const run=generation,snapshot=['playing','paused'].includes(state)&&lastSnapshot?lastSnapshot:await capture(false);if(disposed||run!==generation)throw abortError();
      const cue=options.getCue?.(),range=Number.isInteger(cue)?{...settings,first:Math.max(settings.first,Math.min(settings.last<0?snapshot.rows.length-1:settings.last,cue))}:settings;return engine.renderWav(snapshot,range,{maxSeconds:60});
    }
    async function exportWav(){const rendered=await renderTrackWav();return {blob:new (win.Blob||root.Blob)([rendered.bytes],{type:'audio/wav'}),name:'xorrom-field.wav',note:rendered.truncated?'WAV: '+rendered.duration.toFixed(2)+' с; проход обрезан до 60 секунд.':'WAV: полный проход, '+rendered.duration.toFixed(2)+' с.'};
    }
    function refresh(){if(disposed)return;applySettings(engine.normalizeSettings(options.getSettings?.()||settings));showMarker();publish();}
    function visibilityChanged(){if(doc.hidden){cancelDrag();resumeAfterRefresh=false;}scheduleMarker();}
    const scrollOptions={capture:true,passive:true};win.addEventListener('scroll',scheduleMarker,scrollOptions);win.addEventListener('resize',scheduleMarker);doc.addEventListener('visibilitychange',visibilityChanged);
    win.visualViewport?.addEventListener('resize',scheduleMarker);win.visualViewport?.addEventListener('scroll',scheduleMarker);
    observer=win.ResizeObserver?new win.ResizeObserver(scheduleMarker):null;if(viewport)observer?.observe(viewport);observedFigure=sourceFigure();if(observedFigure&&observedFigure!==viewport)observer?.observe(observedFigure);
    function dispose(){
      if(disposed)return;stop();disposed=true;generation++;if(frame!==null)win.cancelAnimationFrame?.(frame);if(refreshFrame!==null)win.cancelAnimationFrame?.(refreshFrame);
      win.removeEventListener('pointermove',move,true);win.removeEventListener('pointerup',up,true);win.removeEventListener('pointercancel',up,true);win.removeEventListener('scroll',scheduleMarker,scrollOptions);win.removeEventListener('resize',scheduleMarker);doc.removeEventListener('visibilitychange',visibilityChanged);
      win.visualViewport?.removeEventListener('resize',scheduleMarker);win.visualViewport?.removeEventListener('scroll',scheduleMarker);observer?.disconnect();labels.destroy();overlay?.destroy();marker.remove();listeners.clear();lastSnapshot=null;return core.dispose();
    }
    return {getSettings,setSettings,getState,start,pause,stop,seek,identify,sourceChanged(){if(!invalidateScore())scheduleMarker();},setMuted:value=>core.setMuted?.(value),fieldChanged,renderTrackWav,exportWav,getStream:()=>disposed?null:core.getStream(),subscribe(fn){if(disposed)return ()=>{};listeners.add(fn);return ()=>listeners.delete(fn);},refresh,dispose};
  }
  return Object.freeze({mount});
});
