/* Connects gesture-driven Xorrom audio to the current Mayatnik field. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(root,require('./mayatnik-xorrom.js'));
  else root.MayatnikXorromHost=factory(root,root.MayatnikXorrom);
})(globalThis,function(root,defaultEngine){
  'use strict';
  function mount(options={}){
    const win=options.window||root.window||root,doc=options.document||win.document;
    const engine=options.engine||defaultEngine;
    if(!doc||!engine||typeof options.getSnapshot!=='function')throw Error('Хорром: нужны документ, аудиоядро и источник поля.');
    let settings=engine.normalizeSettings(options.getSettings?.()),state='stopped',index=-1,notes=[],error='';
    let generation=0,disposed=false,lastSnapshot=null,frame=null;
    const listeners=new Set(),viewport=options.viewport;
    const marker=doc.createElement('div');marker.id='mayXorromRow';marker.setAttribute('aria-hidden','true');
    Object.assign(marker.style,{position:'fixed',display:'none',pointerEvents:'none',boxSizing:'border-box',zIndex:'15',border:'1px solid #a674ff',boxShadow:'inset 0 0 0 1px #65eaa6',background:'transparent'});
    doc.body.append(marker);
    function getState(){return {state,index,notes:notes.map(note=>({...note})),error};}
    function publish(){if(!disposed)for(const listener of listeners)listener(getState());}
    function showMarker(){
      frame=null;marker.style.display='none';
      if(disposed||doc.hidden||!lastSnapshot||index<0||!['playing','paused'].includes(state))return;
      const figure=typeof options.figure==='function'?options.figure():options.figure;
      if(!figure||!viewport||figure.isConnected===false||viewport.isConnected===false)return;
      if(win.getComputedStyle&&(win.getComputedStyle(figure).display==='none'||win.getComputedStyle(viewport).display==='none'||win.getComputedStyle(figure).visibility==='hidden'||win.getComputedStyle(viewport).visibility==='hidden'))return;
      const rect=figure.getBoundingClientRect(),clip=viewport.getBoundingClientRect(),height=lastSnapshot.height||lastSnapshot.rows.length;
      if(!(rect.width>0&&rect.height>0&&height>0)||index>=height)return;
      const rowHeight=rect.height/height,top=Math.max(0,clip.top,rect.top+index*rowHeight),bottom=Math.min(win.innerHeight||doc.documentElement.clientHeight,clip.bottom,rect.top+(index+1)*rowHeight);
      const left=Math.max(0,clip.left,rect.left),right=Math.min(win.innerWidth||doc.documentElement.clientWidth,clip.right,rect.right);
      if(!(bottom>top&&right>left))return;
      Object.assign(marker.style,{display:'block',left:left+'px',top:top+'px',width:(right-left)+'px',height:(bottom-top)+'px',opacity:state==='paused'?'.45':'1'});
    }
    function scheduleMarker(){if(disposed||frame!==null)return;if(win.requestAnimationFrame)frame=win.requestAnimationFrame(showMarker);else showMarker();}
    function abortError(){const reason=Error('Чтение Хоррома отменено.');reason.name='AbortError';return reason;}
    function freezeSnapshot(snapshot){
      if(!snapshot||!Array.isArray(snapshot.rows))throw Error('Хорром: источник не вернул строки поля.');
      const rows=snapshot.rows.map(row=>Object.freeze({...row,bits:row.bits?.slice(),colors:row.colors?.slice()}));
      return Object.freeze({...snapshot,rows:Object.freeze(rows)});
    }
    async function capture(remember){
      const run=generation,cancelled=()=>disposed||run!==generation;
      const snapshot=await options.getSnapshot({cancelled});
      if(cancelled())throw abortError();
      const frozen=freezeSnapshot(snapshot);
      if(remember)lastSnapshot=frozen;
      return frozen;
    }
    function fail(reason){error=reason?.message||String(reason);publish();}
    const core=engine.create({AudioContext:win.AudioContext||win.webkitAudioContext,document:doc,settings,
      getSnapshot:()=>capture(true),
      onStep:step=>{if(disposed||state!=='playing')return;index=step.index;notes=Array.isArray(step.notes)?step.notes.map(note=>({...note})):[];showMarker();publish();},
      onState:next=>{if(disposed)return;state=next;if(next!=='playing')generation++;if(next==='stopped'){index=-1;notes=[];lastSnapshot=null;}showMarker();publish();},
      onError:fail});
    function getSettings(){return {...settings};}
    function setSettings(patch){
      if(disposed)return getSettings();
      settings=engine.normalizeSettings({...settings,...patch});core.setSettings(settings);options.setSettings?.({...settings});publish();return getSettings();
    }
    async function start(){
      if(disposed)return false;
      if(state==='playing')return true;
      error='';publish();
      ++generation;
      try{return await core.start();}catch(reason){if(disposed||reason?.name==='AbortError')return false;fail(reason);throw reason;}
    }
    function pause(){if(disposed)return;generation++;core.pause();showMarker();publish();}
    function stop(){if(disposed)return;generation++;core.stop();state='stopped';index=-1;notes=[];lastSnapshot=null;showMarker();publish();}
    async function exportWav(){
      if(disposed)throw abortError();
      const run=generation,snapshot=['playing','paused'].includes(state)&&lastSnapshot?lastSnapshot:await capture(false);
      if(disposed||run!==generation)throw abortError();
      const rendered=engine.renderWav(snapshot,settings,{maxSeconds:60});
      return {blob:new (win.Blob||root.Blob)([rendered.bytes],{type:'audio/wav'}),name:'xorrom-field.wav',note:rendered.truncated?'WAV: '+rendered.duration.toFixed(2)+' с; проход обрезан до 60 секунд.':'WAV: полный проход, '+rendered.duration.toFixed(2)+' с.'};
    }
    function refresh(){if(disposed)return;settings=engine.normalizeSettings(options.getSettings?.()||settings);core.setSettings(settings);showMarker();publish();}
    const scrollOptions={capture:true,passive:true};
    win.addEventListener('scroll',scheduleMarker,scrollOptions);win.addEventListener('resize',scheduleMarker);
    doc.addEventListener('visibilitychange',scheduleMarker);
    win.visualViewport?.addEventListener('resize',scheduleMarker);win.visualViewport?.addEventListener('scroll',scheduleMarker);
    const observer=win.ResizeObserver?new win.ResizeObserver(scheduleMarker):null;
    if(viewport)observer?.observe(viewport);
    const initialFigure=typeof options.figure==='function'?options.figure():options.figure;if(initialFigure)observer?.observe(initialFigure);
    function dispose(){
      if(disposed)return;generation++;disposed=true;
      if(frame!==null)win.cancelAnimationFrame?.(frame);
      win.removeEventListener('scroll',scheduleMarker,scrollOptions);win.removeEventListener('resize',scheduleMarker);doc.removeEventListener('visibilitychange',scheduleMarker);
      win.visualViewport?.removeEventListener('resize',scheduleMarker);win.visualViewport?.removeEventListener('scroll',scheduleMarker);
      observer?.disconnect();marker.remove();listeners.clear();lastSnapshot=null;return core.dispose();
    }
    return {getSettings,setSettings,getState,start,pause,stop,exportWav,getStream:()=>disposed?null:core.getStream(),subscribe(fn){if(disposed)return ()=>{};listeners.add(fn);return ()=>listeners.delete(fn);},refresh,dispose};
  }
  return Object.freeze({mount});
});


