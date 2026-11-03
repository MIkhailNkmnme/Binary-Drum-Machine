/* Xorrom transport, live field refresh and an interactive score-row marker. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(root,require('./mayatnik-xorrom.js'));
  else root.MayatnikXorromHost=factory(root,root.MayatnikXorrom);
})(globalThis,function(root,defaultEngine){
  'use strict';
  function mount(options={}){
    const win=options.window||root.window||root,doc=options.document||win.document,engine=options.engine||defaultEngine;
    if(!doc||!engine||typeof options.getSnapshot!=='function')throw Error('Хорром: нужны документ, аудиоядро и источник поля.');
    let settings=engine.normalizeSettings(options.getSettings?.()),state='stopped',index=-1,notes=[],backingNotes=[],error='',effective=null,geometry=null;
    let generation=0,disposed=false,lastSnapshot=null,frame=null,refreshFrame=null,updating=false,resumeAfterRefresh=false,fieldStamp=null;
    let drag=null,manualGeneration=0,observer=null,observedFigure=null;
    const listeners=new Set(),viewport=options.viewport;
    const marker=doc.createElement('div');marker.id='mayXorromRow';marker.tabIndex=0;marker.setAttribute('role','slider');marker.setAttribute('aria-orientation','vertical');marker.setAttribute('aria-label','Звучащая строка Xorrom: тянуть вверх или вниз для повторного прослушивания');
    Object.assign(marker.style,{position:'fixed',display:'none',pointerEvents:'none',boxSizing:'border-box',zIndex:'15',border:'1px solid #a674ff',boxShadow:'inset 0 0 0 1px #65eaa6',background:'rgba(101,234,166,.18)'});
    const hit=doc.createElement('div');hit.dataset.xorromDrag='';hit.title='Тянуть вверх или вниз — снова сыграть выбранную строку';Object.assign(hit.style,{position:'absolute',left:'0',right:'0',top:'50%',height:'14px',transform:'translateY(-50%)',pointerEvents:'auto',cursor:'ns-resize',touchAction:'none'});marker.append(hit);doc.body.append(marker);
    const sourceFigure=()=>typeof options.figure==='function'?options.figure():options.figure;
    const sourceRect=()=>options.figureRect?.()||sourceFigure()?.getBoundingClientRect();
    function getState(){return {state,index,notes:notes.map(note=>({...note})),backingNotes:backingNotes.map(note=>({...note})),error,updating,effective:effective?{...effective}:null,geometry:geometry?{...geometry}:null};}
    function publish(){if(!disposed)for(const listener of listeners)listener(getState());}
    function showMarker(){
      frame=null;marker.style.display='none';
      if(disposed||doc.hidden||updating||options.isVisible?.()===false||!lastSnapshot||index<0||!['playing','paused'].includes(state))return;
      const figure=sourceFigure();if(figure!==observedFigure){if(observedFigure&&observedFigure!==viewport)observer?.unobserve?.(observedFigure);observedFigure=figure;if(figure&&figure!==viewport)observer?.observe(figure);}if(!figure||!viewport||figure.isConnected===false||viewport.isConnected===false)return;
      if(win.getComputedStyle&&(win.getComputedStyle(figure).display==='none'||win.getComputedStyle(viewport).display==='none'||win.getComputedStyle(viewport).visibility==='hidden'))return;
      const rect=sourceRect(),clip=viewport.getBoundingClientRect(),height=lastSnapshot.height||lastSnapshot.rows.length;
      if(!(rect?.width>0&&rect.height>0&&height>0)||index>=height)return;
      const rowHeight=rect.height/height,center=rect.top+(index+.5)*rowHeight,band=Math.max(2,rowHeight);
      const top=Math.max(0,clip.top,rect.top,center-band/2),bottom=Math.min(win.innerHeight||doc.documentElement.clientHeight,clip.bottom,rect.bottom,center+band/2);
      const left=Math.max(0,clip.left,rect.left),right=Math.min(win.innerWidth||doc.documentElement.clientWidth,clip.right,rect.right);if(!(bottom>top&&right>left))return;
      Object.assign(marker.style,{display:'block',left:left+'px',top:top+'px',width:(right-left)+'px',height:(bottom-top)+'px',opacity:state==='paused'&&!drag?'.45':'1'});
      const first=Math.min(settings.first,height-1),last=settings.last<0?height-1:Math.max(first,Math.min(settings.last,height-1));marker.setAttribute('aria-valuemin',String(first));marker.setAttribute('aria-valuemax',String(last));marker.setAttribute('aria-valuenow',String(index));marker.setAttribute('aria-valuetext','Строка '+index);
    }
    function scheduleMarker(){if(disposed||frame!==null)return;if(win.requestAnimationFrame)frame=win.requestAnimationFrame(showMarker);else showMarker();}
    function abortError(){const reason=Error('Чтение Хоррома отменено.');reason.name='AbortError';return reason;}
    function freezeSnapshot(snapshot){
      if(!snapshot||!Array.isArray(snapshot.rows))throw Error('Хорром: источник не вернул строки поля.');
      const regions=new Map(),region=value=>{if(!value)return value;if(!regions.has(value))regions.set(value,Object.freeze({...value}));return regions.get(value);};
      const rows=snapshot.rows.map(row=>Object.freeze({...row,bits:row.bits?.slice(),colors:row.colors?.slice(),...(row.geometry?{geometry:Object.freeze({zero:region(row.geometry.zero),one:region(row.geometry.one),triangle:region(row.geometry.triangle)})}:{})}));return Object.freeze({...snapshot,rows:Object.freeze(rows)});
    }
    async function capture(remember,automatic=false){
      const run=generation,cancelled=()=>disposed||run!==generation;
      const snapshot=await options.getSnapshot({cancelled,automatic});if(cancelled())throw abortError();const frozen=freezeSnapshot(snapshot);if(remember)lastSnapshot=frozen;return frozen;
    }
    function fail(reason){error=reason?.message||String(reason);publish();}
    const core=engine.create({AudioContext:win.AudioContext||win.webkitAudioContext,document:doc,settings,
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
    async function start(){if(disposed)return false;error='';if(updating){resumeAfterRefresh=true;publish();return true;}if(state==='playing')return true;publish();++generation;try{return await core.start();}catch(reason){if(disposed||reason?.name==='AbortError')return false;fail(reason);throw reason;}}
    function pause(internal=false){if(disposed)return;if(!internal)cancelDrag();resumeAfterRefresh=false;if(!updating)generation++;core.pause();showMarker();publish();}
    function cancelDrag(){manualGeneration++;if(!drag)return;const previous=drag;drag=null;try{hit.releasePointerCapture?.(previous.id);}catch(_){}showMarker();}
    function stop(){if(disposed)return;cancelDrag();generation++;updating=false;resumeAfterRefresh=false;if(refreshFrame!==null)win.cancelAnimationFrame?.(refreshFrame);refreshFrame=null;core.stop();state='stopped';index=-1;notes=[];backingNotes=[];effective=null;geometry=null;lastSnapshot=null;showMarker();publish();}
    async function seek(row){if(disposed||updating||!lastSnapshot||typeof core.seek!=='function')return false;error='';try{return await core.seek(row,{audition:true});}catch(reason){if(reason?.name==='AbortError')return false;fail(reason);return false;}}
    function preview(row){if(!drag)return;const next=Math.max(settings.first,Math.min(settings.last<0?lastSnapshot.rows.length-1:Math.min(settings.last,lastSnapshot.rows.length-1),Math.round(row)));if(drag.last===next)return;drag.last=next;drag.pending=seek(next);}
    function down(event){
      if(event.button!==0||disposed||updating||!lastSnapshot||index<0||!['playing','paused'].includes(state))return;
      event.preventDefault();event.stopPropagation();const rect=sourceRect();if(!(rect?.height>0))return;
      const wasPlaying=state==='playing';cancelDrag();pause(true);drag={id:event.pointerId,y:event.clientY,pointerY:event.clientY,row:index,unit:rect.height/(lastSnapshot.height||lastSnapshot.rows.length),wasPlaying,ticket:++manualGeneration,last:null,pending:Promise.resolve()};
      hit.setPointerCapture?.(event.pointerId);marker.focus?.({preventScroll:true});preview(index);showMarker();
    }
    function move(event){if(!drag||event.pointerId!==drag.id)return;event.preventDefault();event.stopImmediatePropagation();drag.pointerY=event.clientY;preview(drag.row+(event.clientY-drag.y)/drag.unit);}
    async function up(event){
      if(!drag||event.pointerId!==drag.id)return;event.preventDefault();event.stopImmediatePropagation();const previous=drag;drag=null;try{hit.releasePointerCapture?.(event.pointerId);}catch(_){}showMarker();
      if(event.type==='pointercancel'){manualGeneration++;pause(true);return;}await previous.pending;if(!disposed&&previous.ticket===manualGeneration&&previous.wasPlaying&&!doc.hidden){if(updating)resumeAfterRefresh=true;else try{await start();}catch(_){}}
    }
    async function key(event){
      if(event.key===' '&&lastSnapshot){event.preventDefault();event.stopPropagation();if(state==='playing')pause();else try{await start();}catch(_){}return;}
      if(!['ArrowUp','ArrowDown','Home','End','Enter'].includes(event.key)||!lastSnapshot||updating)return;event.preventDefault();event.stopPropagation();const wasPlaying=state==='playing',ticket=++manualGeneration;pause(true);
      const row=event.key==='Home'?settings.first:event.key==='End'?(settings.last<0?lastSnapshot.rows.length-1:settings.last):index+(event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:0);
      await seek(row);if(ticket===manualGeneration&&wasPlaying&&!disposed&&!updating&&!doc.hidden)try{await start();}catch(_){}
    }
    hit.addEventListener('pointerdown',down);hit.addEventListener('lostpointercapture',()=>{if(drag){cancelDrag();pause(true);}});marker.addEventListener('keydown',key);win.addEventListener('pointermove',move,{capture:true,passive:false});win.addEventListener('pointerup',up,true);win.addEventListener('pointercancel',up,true);
    function queueRefresh(){if(disposed||!updating||refreshFrame!==null)return;refreshFrame=win.requestAnimationFrame(()=>{refreshFrame=null;void refreshField();});}
    async function refreshField(){
      const run=generation;try{
        const snapshot=await capture(true,true);if(run!==generation||!updating)return;
        const resume=resumeAfterRefresh&&!drag;core.replaceSnapshot(snapshot,{index:Math.max(0,drag?.last??index),resume});if(run!==generation||!updating)return;
        updating=false;resumeAfterRefresh=false;showMarker();publish();
        if(drag){drag.row=index;drag.y=drag.pointerY;drag.unit=sourceRect().height/(snapshot.height||snapshot.rows.length);drag.last=index;drag.pending=seek(index);}
        else if(resume&&state!=='playing'&&!doc.hidden)await start();
      }catch(reason){if(disposed||run!==generation)return;if(reason?.name==='AbortError'){queueRefresh();return;}updating=false;resumeAfterRefresh=false;core.stop();fail(reason);}
    }
    function fieldChanged(stamp){
      if(disposed||!stamp)return false;if(fieldStamp?.owner===stamp.owner&&fieldStamp?.key===stamp.key)return false;fieldStamp=stamp;
      return invalidateScore();
    }
    function invalidateScore(){
      if(!lastSnapshot||state==='stopped'&&!updating)return false;
      const resume=updating?resumeAfterRefresh:drag?drag.wasPlaying:state==='playing';if(core.beginRefresh)core.beginRefresh();else core.pause();generation++;updating=true;resumeAfterRefresh=resume;notes=[];backingNotes=[];effective=null;geometry=null;showMarker();publish();queueRefresh();return true;
    }
    async function exportWav(){
      if(disposed)throw abortError();if(updating)throw Error('Дождитесь обновления музыкального кадра.');const run=generation,snapshot=['playing','paused'].includes(state)&&lastSnapshot?lastSnapshot:await capture(false);if(disposed||run!==generation)throw abortError();
      const rendered=engine.renderWav(snapshot,settings,{maxSeconds:60});return {blob:new (win.Blob||root.Blob)([rendered.bytes],{type:'audio/wav'}),name:'xorrom-field.wav',note:rendered.truncated?'WAV: '+rendered.duration.toFixed(2)+' с; проход обрезан до 60 секунд.':'WAV: полный проход, '+rendered.duration.toFixed(2)+' с.'};
    }
    function refresh(){if(disposed)return;applySettings(engine.normalizeSettings(options.getSettings?.()||settings));showMarker();publish();}
    function visibilityChanged(){if(doc.hidden){cancelDrag();resumeAfterRefresh=false;}scheduleMarker();}
    const scrollOptions={capture:true,passive:true};win.addEventListener('scroll',scheduleMarker,scrollOptions);win.addEventListener('resize',scheduleMarker);doc.addEventListener('visibilitychange',visibilityChanged);
    win.visualViewport?.addEventListener('resize',scheduleMarker);win.visualViewport?.addEventListener('scroll',scheduleMarker);
    observer=win.ResizeObserver?new win.ResizeObserver(scheduleMarker):null;if(viewport)observer?.observe(viewport);observedFigure=sourceFigure();if(observedFigure&&observedFigure!==viewport)observer?.observe(observedFigure);
    function dispose(){
      if(disposed)return;stop();disposed=true;generation++;if(frame!==null)win.cancelAnimationFrame?.(frame);if(refreshFrame!==null)win.cancelAnimationFrame?.(refreshFrame);
      win.removeEventListener('pointermove',move,true);win.removeEventListener('pointerup',up,true);win.removeEventListener('pointercancel',up,true);win.removeEventListener('scroll',scheduleMarker,scrollOptions);win.removeEventListener('resize',scheduleMarker);doc.removeEventListener('visibilitychange',visibilityChanged);
      win.visualViewport?.removeEventListener('resize',scheduleMarker);win.visualViewport?.removeEventListener('scroll',scheduleMarker);observer?.disconnect();marker.remove();listeners.clear();lastSnapshot=null;return core.dispose();
    }
    return {getSettings,setSettings,getState,start,pause,stop,seek,fieldChanged,exportWav,getStream:()=>disposed?null:core.getStream(),subscribe(fn){if(disposed)return ()=>{};listeners.add(fn);return ()=>listeners.delete(fn);},refresh,dispose};
  }
  return Object.freeze({mount});
});
