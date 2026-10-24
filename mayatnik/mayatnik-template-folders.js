/* Template organisation stores references only; template pixels remain in PaintCache. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikTemplateFolders=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const KEY='mayatnik-template-folders-v1';
  function normalise(value){
    const result={version:1,nodes:[]},seen=new Set();
    for(const n of Array.isArray(value?.nodes)?value.nodes:[]){
      if(!n||!['folder','template'].includes(n.kind)||typeof n.id!=='string'||seen.has(n.kind+':'+n.id))continue;
      seen.add(n.kind+':'+n.id);result.nodes.push({kind:n.kind,id:n.id,parent:typeof n.parent==='string'?n.parent:'',...(n.kind==='folder'?{name:String(n.name||'Папка').slice(0,100)}:{})});
    }
    const folders=new Map(result.nodes.filter(n=>n.kind==='folder').map(n=>[n.id,n]));
    for(const n of result.nodes){
      const path=new Set(n.kind==='folder'?[n.id]:[]);let p=n.parent;
      while(p){if(path.has(p)||!folders.has(p)){n.parent='';break;}path.add(p);p=folders.get(p).parent;}
    }
    return result;
  }
  function create(storage){
    let value;try{value=JSON.parse(storage?.getItem(KEY)||'null');}catch(_){}
    let state=normalise(value),error=false,lastSaved=JSON.stringify(state);
    function save(){const text=JSON.stringify(state);if(text===lastSaved)return !error;try{if(!storage)throw Error('storage');storage.setItem(KEY,text);lastSaved=text;error=false;}catch(_){error=true;}return !error;}
    const api={
      snapshot:()=>structuredClone(state),
      restore(value){state=normalise(value);save();},
      get persistenceError(){return error;},
      children:parent=>state.nodes.filter(n=>n.parent===(parent||'')).map(n=>({...n})),
      reconcile(ids){const known=new Set(ids.map(String)),present=new Set();state.nodes=state.nodes.filter(n=>n.kind==='folder'||known.has(n.id));for(const n of state.nodes)if(n.kind==='template')present.add(n.id);for(const id of known)if(!present.has(id))state.nodes.push({kind:'template',id,parent:''});save();},
      addFolder(name,parent=''){
        name=String(name||'').trim().slice(0,100);if(!name||parent&&!state.nodes.some(n=>n.kind==='folder'&&n.id===parent))return null;
        const id='folder:'+Date.now().toString(36)+':'+Math.random().toString(36).slice(2,10);state.nodes.push({kind:'folder',id,parent,name});save();return id;
      },
      rename(id,name){const n=state.nodes.find(n=>n.kind==='folder'&&n.id===id);name=String(name||'').trim().slice(0,100);if(!n||!name)return false;n.name=name;save();return true;},
      removeFolder(id){const n=state.nodes.find(n=>n.kind==='folder'&&n.id===id);if(!n)return false;for(const c of state.nodes)if(c.parent===id)c.parent=n.parent;state.nodes=state.nodes.filter(c=>c!==n);save();return true;},
      move(kind,id,parent='',beforeId='',beforeKind=''){
        const n=state.nodes.find(n=>n.kind===kind&&n.id===id);if(!n||parent&&!state.nodes.some(n=>n.kind==='folder'&&n.id===parent))return false;
        let p=parent;while(p){if(kind==='folder'&&p===id)return false;p=state.nodes.find(n=>n.kind==='folder'&&n.id===p)?.parent||'';}
        const before=beforeId?state.nodes.find(c=>c.id===beforeId&&(!beforeKind||c.kind===beforeKind)&&c.parent===parent):null;if(before===n)return false;
        state.nodes=state.nodes.filter(c=>c!==n);n.parent=parent;const i=before?state.nodes.indexOf(before):-1;if(i<0)state.nodes.push(n);else state.nodes.splice(i,0,n);save();return true;
      }
    };return api;
  }
  return {KEY,normalise,create};
});
