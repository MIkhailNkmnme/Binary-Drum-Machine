/* Pure cell selection and collapsed-axis geometry. All indices are zero based;
 * ranges and hidden intervals include both ends. No field data is stored here. */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports) module.exports=factory();
  else root.MayatnikCellSelection=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function integer(value){ return Number.isSafeInteger(value); }
  function size(value){ return integer(value)&&value>=0; }
  function same(a,b){ return JSON.stringify(a)===JSON.stringify(b); }
  function copyIntervals(list){ return list.map(function(pair){ return pair.slice(); }); }
  function range(a,b,count){
    if(!integer(a)||!integer(b)||!count) return null;
    var lo=Math.max(0,Math.min(a,b)), hi=Math.min(count-1,Math.max(a,b));
    return lo<=hi?[lo,hi]:null;
  }
  function normalizeIntervals(list,count){
    var sorted=list.map(function(pair){ return range(pair[0],pair[1],count); })
      .filter(Boolean).sort(function(a,b){ return a[0]-b[0]||a[1]-b[1]; });
    var result=[];
    sorted.forEach(function(pair){
      var last=result[result.length-1];
      if(last&&pair[0]<=last[1]+1) last[1]=Math.max(last[1],pair[1]);
      else result.push(pair);
    });
    return result;
  }
  function selection(value,rows,cols){
    if(!value||!rows||!cols) return null;
    var mode=value.mode===undefined?'cells':value.mode;
    if(mode!=='cells'&&mode!=='rows'&&mode!=='cols') return null;
    var rr=mode==='cols'?[0,rows-1]:range(value.r0,value.r1,rows);
    var cc=mode==='rows'?[0,cols-1]:range(value.c0,value.c1,cols);
    return rr&&cc?{r0:rr[0],c0:cc[0],r1:rr[1],c1:cc[1],mode:mode}:null;
  }
  function axisState(count,hidden){
    var runs=[], seams=[], prefix=[], original=0, visible=0, removed=0;
    hidden.forEach(function(pair){
      if(pair[0]>original){
        runs.push({originalStart:original,visibleStart:visible,length:pair[0]-original});
        visible+=pair[0]-original;
      }
      var length=pair[1]-pair[0]+1;
      seams.push({from:pair[0],to:pair[1],at:visible,count:length});
      removed+=length; prefix.push(removed); original=pair[1]+1;
    });
    if(original<count){
      runs.push({originalStart:original,visibleStart:visible,length:count-original});
      visible+=count-original;
    }
    return {count:count,hidden:hidden,runs:runs,seams:seams,prefix:prefix,visible:visible};
  }
  function validIntervals(value){
    return Array.isArray(value)&&value.every(function(pair){
      return Array.isArray(pair)&&pair.length===2&&integer(pair[0])&&integer(pair[1]);
    });
  }

  function create(options){
    options=options||{};
    var rows=options.rows===undefined?0:options.rows, cols=options.cols===undefined?0:options.cols;
    if(!size(rows)||!size(cols)) throw new RangeError('Cell dimensions must be nonnegative safe integers');
    var selected=null, rowState=axisState(rows,[]), colState=axisState(cols,[]);
    function axis(name){
      if(name==='rows') return rowState;
      if(name==='cols') return colState;
      throw new TypeError('Cell axis must be rows or cols');
    }
    function replace(name,hidden){
      var current=axis(name), next=normalizeIntervals(hidden,current.count);
      if(same(current.hidden,next)) return false;
      if(name==='rows') rowState=axisState(rows,next);
      else colState=axisState(cols,next);
      return true;
    }
    var api={
      select:function(value){
        var next=selection(value,rows,cols), changed=!same(next,selected);
        selected=next; return changed;
      },
      selectVisible:function(value){
        var next=selection(value,rowState.visible,colState.visible);
        if(!next) return api.clear();
        return api.select({
          r0:api.visibleToOriginal('rows',next.r0),r1:api.visibleToOriginal('rows',next.r1),
          c0:api.visibleToOriginal('cols',next.c0),c1:api.visibleToOriginal('cols',next.c1),mode:next.mode
        });
      },
      clear:function(){ var changed=selected!==null; selected=null; return changed; },
      hideRange:function(name,from,to){
        var current=axis(name), next=range(from,to,current.count);
        return next?replace(name,current.hidden.concat([next])):false;
      },
      // Successful hide clears the selection; a no-op leaves it available.
      hide:function(name){
        axis(name);
        if(!selected) return false;
        var changed=name==='rows'?api.hideRange(name,selected.r0,selected.r1):api.hideRange(name,selected.c0,selected.c1);
        if(changed) selected=null;
        return changed;
      },
      reveal:function(name,originalIndex){
        var current=axis(name);
        if(!integer(originalIndex)||originalIndex<0||originalIndex>=current.count) return false;
        return replace(name,current.hidden.filter(function(pair){ return originalIndex<pair[0]||originalIndex>pair[1]; }));
      },
      revealSeam:function(name,visibleBoundary){
        var current=axis(name);
        if(!integer(visibleBoundary)) return false;
        var seam=current.seams.find(function(item){ return item.at===visibleBoundary; });
        return seam?api.reveal(name,seam.from):false;
      },
      revealAll:function(name){
        if(name!==undefined) return replace(name,[]);
        var changed=replace('rows',[]);
        return replace('cols',[])||changed;
      },
      originalToVisible:function(name,index){
        var current=axis(name);
        if(!integer(index)||index<0||index>=current.count) return -1;
        var lo=0,hi=current.hidden.length;
        // First hidden interval ending at or after index.
        while(lo<hi){ var mid=Math.floor((lo+hi)/2); if(current.hidden[mid][1]<index) lo=mid+1; else hi=mid; }
        if(lo<current.hidden.length&&current.hidden[lo][0]<=index) return -1;
        return index-(lo?current.prefix[lo-1]:0);
      },
      visibleToOriginal:function(name,index){
        var current=axis(name);
        if(!integer(index)||index<0||index>=current.visible) return -1;
        var lo=0,hi=current.runs.length;
        while(lo<hi){ var mid=Math.floor((lo+hi)/2); if(current.runs[mid].visibleStart<=index) lo=mid+1; else hi=mid; }
        var run=current.runs[lo-1];
        return run.originalStart+index-run.visibleStart;
      },
      visibleRuns:function(name){ return axis(name).runs.map(function(run){ return Object.assign({},run); }); },
      seams:function(name){ return axis(name).seams.map(function(seam){ return Object.assign({},seam); }); },
      setSize:function(nextRows,nextCols){
        if(!size(nextRows)||!size(nextCols)) throw new RangeError('Cell dimensions must be nonnegative safe integers');
        if(rows===nextRows&&cols===nextCols) return false;
        rows=nextRows; cols=nextCols;
        rowState=axisState(rows,normalizeIntervals(rowState.hidden,rows));
        colState=axisState(cols,normalizeIntervals(colState.hidden,cols));
        selected=selection(selected,rows,cols); return true;
      },
      serialize:function(){
        return {version:1,rows:rows,cols:cols,hiddenRows:copyIntervals(rowState.hidden),hiddenCols:copyIntervals(colState.hidden),selection:selected?Object.assign({},selected):null};
      },
      // Invalid snapshots are rejected atomically. Valid intervals are clipped,
      // sorted and merged, making older out-of-bounds saved ranges harmless.
      restore:function(snapshot){
        if(!snapshot||snapshot.version!==1||!size(snapshot.rows)||!size(snapshot.cols)||
          !validIntervals(snapshot.hiddenRows)||!validIntervals(snapshot.hiddenCols)) return false;
        var nextSelection=selection(snapshot.selection,snapshot.rows,snapshot.cols);
        if(snapshot.selection!==null&&snapshot.selection!==undefined&&!nextSelection) return false;
        var next={version:1,rows:snapshot.rows,cols:snapshot.cols,
          hiddenRows:normalizeIntervals(snapshot.hiddenRows,snapshot.rows),hiddenCols:normalizeIntervals(snapshot.hiddenCols,snapshot.cols),selection:nextSelection};
        if(same(api.serialize(),next)) return false;
        rows=next.rows; cols=next.cols; selected=next.selection;
        rowState=axisState(rows,next.hiddenRows); colState=axisState(cols,next.hiddenCols); return true;
      }
    };
    Object.defineProperties(api,{
      rows:{get:function(){ return rows; }},cols:{get:function(){ return cols; }},
      visibleRows:{get:function(){ return rowState.visible; }},visibleCols:{get:function(){ return colState.visible; }},
      selection:{get:function(){ return selected?Object.assign({},selected):null; }},
      hiddenRows:{get:function(){ return copyIntervals(rowState.hidden); }},
      hiddenCols:{get:function(){ return copyIntervals(colState.hidden); }}
    });
    return api;
  }
  return {create:create};
});
