/* A directed segment advances by parallel digital scanlines on the source cell grid. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./mayatnik-xorrom-field.js'));
  else root.MayatnikXorromAxis=factory(root.MayatnikXorromField);
})(globalThis,function(Field){
  'use strict';
  const pause=()=>globalThis.scheduler?.yield?.()||new Promise(resolve=>setTimeout(resolve,0));
  const mod=(a,n)=>((a%n)+n)%n;
  function numeric(value,fallback){
    return typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=Number.MAX_SAFE_INTEGER?value:fallback;
  }
  function normalize(spec={}){
    const x1=numeric(spec?.x1,0),y1=numeric(spec?.y1,0);
    return {x1,y1,x2:numeric(spec?.x2,x1),y2:numeric(spec?.y2,y1),fixed:spec?.fixed===true,
      reverse:spec?.reverse===true,offset:Math.round(numeric(spec?.offset,0))||0};
  }
  function normal(spec){
    const dx=spec.x2-spec.x1,dy=spec.y2-spec.y1,major=Math.max(Math.abs(dx),Math.abs(dy));
    return major?{x:-dy/major,y:dx/major}:{x:0,y:1};
  }
  function translate(raw,dx,dy){
    const spec=normalize(raw),n=normal(spec);
    return normalize({...spec,offset:spec.offset+Math.round(n.x*numeric(dx,0)+n.y*numeric(dy,0))});
  }

  function* plan(score,raw){
    const {width,height}=score,s=normalize(raw);
    if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||
       width*height>Field.MAX_CELLS)throw RangeError('Хорром: неверный размер исходного поля оси.');
    const n=normal(s),horizontal=Math.abs(n.y)>=Math.abs(n.x);
    // u is the major coordinate and v the minor one. Moving by one offset adds
    // exactly one minor cell to a digital line at *every* u. Thus parallel
    // passes do not double-read cells, including at 45 degrees.
    const u1=horizontal?s.x1:s.y1,v1=horizontal?s.y1:s.x1,u2=horizontal?s.x2:s.y2,v2=horizontal?s.y2:s.x2;
    const umax=(horizontal?width:height)-1,vmax=(horizontal?height:width)-1;
    const nu=horizontal?n.x:n.y,nv=horizontal?n.y:n.x,stepU=nu/(1+nu*nu);
    const slope=u1===u2?0:(v2-v1)/(u2-u1),base=u=>v1+slope*(u-u1);
    const lowU=Math.min(u1,u2),highU=Math.max(u1,u2),order=u2>=u1?1:-1;
    const point=(u,v)=>horizontal?{x:u,y:v}:{x:v,y:u};
    function ends(k){
      const shift=stepU*k,off=nv*k;
      let lo=Math.max(lowU+shift,-.5),hi=Math.min(highU+shift,umax+.5);
      if(slope){
        const a=u1+(-.5-off-v1)/slope,b=u1+(vmax+.5-off-v1)/slope;
        lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));
      }else if(v1+off<-.5||v1+off>=vmax+.5)return null;
      return lo<=hi?{lo,hi}:null;
    }
    function span(k){
      const endsAt=ends(k);
      if(!endsAt)return null;
      let lo=Math.max(0,Math.round(endsAt.lo)),hi=Math.min(umax,Math.round(endsAt.hi));
      const minor=u=>Math.round(base(u))+nv*k;
      while(lo<=hi&&(minor(lo)<0||minor(lo)>vmax))lo++;
      while(lo<=hi&&(minor(hi)<0||minor(hi)>vmax))hi--;
      return lo<=hi?{length:hi-lo+1,start:order===1?lo:hi,minor}:null;
    }
    const runs=[];let count=0,maxLength=0;
    function addRun(first,last){runs.push({first,last,start:count});count+=last-first+1;}
    if(s.fixed){addRun(s.offset,s.offset);maxLength=span(s.offset)?.length||0;}
    else{
      // Extremes occur at corners because the rounded minor coordinate is monotone.
      const a=nv*-Math.round(base(0)),b=nv*-Math.round(base(umax)),c=nv*vmax;
      const first=Math.min(a,b,a+c,b+c),last=Math.max(a,b,a+c,b+c);
      if(!Number.isSafeInteger(first)||!Number.isSafeInteger(last))throw RangeError('Хорром: смещение оси вне точности координат.');
      if(!slope){maxLength=span(first)?.length||0;if(maxLength)addRun(first,last);}
      else{
        let start=null;
        for(let k=first;k<=last;k++){
          if(k>first&&(k-first)%32768===0)yield;
          const line=span(k);
          if(line){maxLength=Math.max(maxLength,line.length);if(start===null)start=k;}
          else if(start!==null){addRun(start,k-1);start=null;}
        }
        if(start!==null)addRun(start,last);
      }
    }
    function find(value,byIndex){
      let lo=0,hi=runs.length-1;
      while(lo<hi){
        const mid=Math.floor((lo+hi)/2),r=runs[mid],end=byIndex?r.start+r.last-r.first:r.last;
        if(value<=end)hi=mid;else lo=mid+1;
      }
      return lo;
    }
    function ordinal(k){
      const i=find(k,false),r=runs[i],prev=runs[i-1];
      if(prev&&k<r.first&&k-prev.last<=r.first-k)return r.start-1;
      return r.start+Math.max(0,Math.min(r.last-r.first,k-r.first));
    }
    const initial=count?ordinal(s.offset):0,direction=s.reverse?-1:1;
    function offset(index){
      if(!Number.isInteger(index)||index<0||index>=count)return null;
      const at=mod(initial+direction*index,count),r=runs[find(at,true)];
      return r.first+(at-r.start);
    }
    function nearest(x,y){
      if(!count||!Number.isFinite(x)||!Number.isFinite(y))return -1;
      const u=horizontal?x:y,v=horizontal?y:x;
      const k=-nv*Math.round(base(u)-v);
      return mod((ordinal(k)-initial)*direction,count);
    }
    function segment(index){
      const k=offset(index);
      if(k===null||!span(k))return null;
      const {lo,hi}=ends(k),off=nv*k;
      const start=order===1?lo:hi,end=order===1?hi:lo;
      const p=point(start,base(start)+off),q=point(end,base(end)+off);
      return {x1:p.x,y1:p.y,x2:q.x,y2:q.y};
    }
    function address(u,v){return horizontal?v*width+u:u*width+v;}
    return {axis:{length:count,segment,nearest},maxLength,indexSpan:i=>span(offset(i)),address,order};
  }
  function geometry(score,spec){
    const scan=plan(score,spec);let step=scan.next();
    while(!step.done)step=scan.next();
    return step.value.axis;
  }

  async function project(score,spec,options={}){
    function check(){
      if(options.cancelled?.()){const error=Error('Чтение оси Хоррома отменено.');error.name='AbortError';throw error;}
    }
    check();
    const scan=plan(score,spec),yieldTask=options.yieldTask||pause;let step=scan.next();
    while(!step.done){await yieldTask();check();step=scan.next();}
    const p=step.value,axis=p.axis,source=score.rows,w=score.width;
    if(source?.length!==score.height)throw RangeError('Хорром: неполный снимок поля оси.');
    const rgbMode=!!source[0]?.rgb,analyzed=!!score.geometry||source.some(row=>row.geometry);
    function allocate(line){
      const length=line?.length||0;
      return {bits:new Int8Array(length),indices:new Int32Array(length),colors:new Uint32Array(8),
        red:source[0]?.red?new Uint8Array(length):null,rgb:rgbMode?new Int8Array(length):null,ones:0,total:0};
    }
    function sample(row,line,first,last){
      const {bits,indices,colors,rgb}=row,length=bits.length;
      // The first closest visible cell to the middle supplies the existing
      // source-row region descriptor even when a hidden cell splits the axis.
      for(let j=first;j<last;j++){
        const u=line.start+j*p.order,q=p.address(u,line.minor(u)),x=q%w,r=source[Math.floor(q/w)];
        indices[j]=q;
        let bit=r.bits?.[x];
        if(bit!==0&&bit!==1)bit=-1;
        if(rgb){
          const code=r.rgb?.[x];
          if(bit<0||!Number.isInteger(code)||code<0||code>7){bit=-1;rgb[j]=-1;}
          else{rgb[j]=code;colors[code]++;}
        }
        bits[j]=bit;if(row.red&&bit>=0)row.red[j]=r.red?.[x]||0;
        if(bit>=0){
          row.ones+=bit;row.total++;
          if(analyzed){
            const distance=Math.abs(2*j-length+1);
            if(row.distance===undefined||distance<row.distance){row.distance=distance;row.geometry=r.geometry;}
          }
        }
        if(!rgb&&bits[j-1]>=0)colors[4*bits[j-1]+(bits[j-2]===1?2:0)+(bit===1?1:0)]++;
      }
      if(last===length){
        delete row.distance;
        if(!rgb&&bits[length-1]>=0)colors[4*bits[length-1]+(bits[length-2]===1?2:0)]++;
      }
    }
    let rows=[];
    if(axis.length>Field.MAX_ROWS){
      // A legal one-row source can rotate into millions of one-cell rows.
      // Keep index/map/iteration semantics without millions of row objects.
      let recent=-1,cached;
      const at=i=>{
        if(i!==recent){const line=p.indexSpan(i);cached=allocate(line);sample(cached,line,0,cached.bits.length);recent=i;}
        return cached;
      };
      const index=key=>typeof key==='string'&&/^(0|[1-9]\d*)$/.test(key)?Number(key):-1;
      rows=new Proxy(new Array(axis.length),{
        get(target,key,receiver){const i=index(key);return i>=0&&i<target.length?at(i):Reflect.get(target,key,receiver);},
        has(target,key){const i=index(key);return i>=0&&i<target.length||Reflect.has(target,key);}
      });
    }else{
      let budget=32768;
      for(let i=0;i<axis.length;i++){
        const line=p.indexSpan(i),row=allocate(line),length=row.bits.length;
        for(let j=0;j<length;){
          if(!budget){await yieldTask();check();budget=32768;}
          const n=Math.min(budget,length-j);sample(row,line,j,j+n);j+=n;budget-=n;
        }
        rows.push(row);
      }
    }
    check();
    return {...score,axis,width:p.maxLength,height:rows.length,rows};
  }
  return {normalize,translate,geometry,project};
});
