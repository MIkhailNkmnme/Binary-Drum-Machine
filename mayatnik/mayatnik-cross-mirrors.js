/* Meeting-cross sectors and exact inverse mirrors. All coordinates refer to
 * logical CELL CENTRES (the canvas adds .5). verticalX and diagX are distinct. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikCrossMirrors=api;})(globalThis,function(){
  'use strict';
  const EPS=1e-9;
  const LABELS={A1:'А1',A2:'А2',B1:'Б1',B2:'Б2',a1:'а1',a2:'а2',b1:'б1',b2:'б2',C1:'С1',C2:'С2'};
  const IDS=Object.keys(LABELS);
  // Display only. A sector keeps its colour across crosses and frames.
  const COLOURS=Object.freeze({A1:'#58b9ff',A2:'#ad88ff',B1:'#ffb34f',B2:'#ff718e',a1:'#43d5be',a2:'#7cce56',b1:'#e9cf49',b2:'#ee8fe0',C1:'#738bff',C2:'#ed976b'});
  const FILL_ALPHA=.2;
  function orderedCrosses(input){return input.slice().sort((a,b)=>a.y-b.y||a.verticalX-b.verticalX||a.diagX-b.diagX||(a.left??0)-(b.left??0)||(a.right??0)-(b.right??0)).filter((c,i,a)=>!i||JSON.stringify(c)!==JSON.stringify(a[i-1]));}
  function ownerIndex(ordered,x,y){
    let index=-1,best=Infinity;for(let i=0;i<ordered.length;i++){const c=ordered[i],d=(x-c.diagX)**2+(y-c.y)**2;if(d<best-EPS){best=d;index=i;}}return index;
  }
  function sectorRaster({W,H,crosses:input,valid=null}){
    const ordered=orderedCrosses(input),codes=new Uint8Array(W*H),owners=new Int32Array(W*H).fill(-1);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const q=y*W+x;if(valid!=null&&!(typeof valid==='function'?valid(q):valid[q]))continue;
      const i=ownerIndex(ordered,x,y);if(i<0)continue;owners[q]=i;codes[q]=classifyCode(ordered[i],x,y);
    }
    return {codes,owners,crosses:ordered};
  }
  // Voronoi cells keep labels in the same cross's region as the raster. Use the
  // diagonal meeting point, not the independently lockable vertical axis.
  function ownerRegions(input,box){
    const ordered=orderedCrosses(input),result=[];
    for(let i=0;i<ordered.length;i++){
      const c=ordered[i];let points=[[box[0],box[1]],[box[2],box[1]],[box[2],box[3]],[box[0],box[3]]];
      for(let j=0;j<ordered.length&&points.length;j++){if(i===j)continue;const o=ordered[j],a=2*(c.diagX-o.diagX),b=2*(c.y-o.y),d=o.diagX**2+o.y**2-c.diagX**2-c.y**2;
        if(Math.abs(a)+Math.abs(b)<EPS){if(j<i)points=[];}else points=clip(points,[a,b,d]);
      }
      if(points.length&&centroid(points))result.push({cross:c,index:i,points});
    }return result;
  }
  function classifyCode(cross,x,y){
    const {verticalX:V,diagX:D,y:Y,left:L,right:R}=cross,dy=y-Y,dx=x-D;
    if(Math.abs(x-V)<EPS||Math.abs(dy)<EPS||Math.abs(Math.abs(dx)-Math.abs(dy))<EPS)return 0;
    const side=x<V?1:2;
    if(dy>0){
      if(Number.isFinite(L)&&Math.abs(x-(L+dy))<EPS||Number.isFinite(R)&&Math.abs(x-(R-dy))<EPS)return 0;
      if(side===1&&Number.isFinite(L)&&x<L+dy)return 9;
      if(side===2&&Number.isFinite(R)&&x>R-dy)return 10;
      return (Math.abs(dx)<dy?4:6)+side;
    }
    return (Math.abs(dx)<-dy?0:2)+side;
  }
  function classify(cross,x,y){return IDS[classifyCode(cross,x,y)-1]||null;}
  function crosses(field,points,{x0=0,width=field.W,height=field.H}={}){
    const out=[],seen=new Set();
    for(const q of points){const Y=q[2],V=q[3],D=q[4];if(![Y,V,D].every(Number.isFinite))continue;
      const key=[Y,V,D].join(':');if(seen.has(key))continue;seen.add(key);
      const row=Math.max(0,Math.min(height-1,field.H-1,Math.round(Y)));let lo=-1,hi=-1;
      for(let c=0;c<width;c++)if(field.val[row*field.W+x0+c]>=0){if(lo<0)lo=c;hi=c;}
      const found=lo>=0;if(found&&Y>row){lo-=Y-row;hi+=Y-row;}
      out.push({verticalX:V,diagX:D,y:Y,left:found?lo-.5:null,right:found?hi+.5:null});
    }
    return out;
  }
  function candidates(cross,x,y,mode){
    const {verticalX:V,diagX:D,y:Y}=cross;
    if(mode==='lr')return x>V?[[2*V-x,y]]:[];
    if(mode==='rl')return x<V?[[2*V-x,y]]:[];
    if(mode==='tb')return y>Y?[[x,2*Y-y]]:[];
    if(mode==='bt')return y<Y?[[x,2*Y-y]]:[];
    if(mode!=='sector')throw Error('Unknown cross mirror mode');
    const dx=x-D,dy=y-Y;
    return [[dx,dy],[-dx,dy],[dx,-dy],[-dx,-dy],[dy,dx],[-dy,dx],[dy,-dx],[-dy,-dx]].map(([a,b])=>[D+a,Y+b]);
  }
  function mapping({W,H,crosses:input,mode='lr',sector='A1',valid=null}){
    if(!Number.isInteger(W)||!Number.isInteger(H)||W<0||H<0)throw Error('Invalid field dimensions');
    if(!['lr','rl','tb','bt','sector'].includes(mode)||mode==='sector'&&!LABELS[sector])throw Error('Invalid cross mirror mode or sector');
    const map=new Int32Array(W*H).fill(-1),sectorCode=IDS.indexOf(sector)+1,ordered=input.slice().sort((a,b)=>a.y-b.y||a.verticalX-b.verticalX||a.diagX-b.diagX||(a.left??0)-(b.left??0)||(a.right??0)-(b.right??0));
    const good=q=>valid==null?true:typeof valid==='function'?valid(q):!!valid[q];
    for(const cross of ordered){
    const codes=new Uint8Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const q=y*W+x;if(good(q))codes[q]=classifyCode(cross,x,y);}
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const q=y*W+x,target=codes[q];if(map[q]>=0||!target||mode==='sector'&&target===sectorCode)continue;
      if(mode==='lr'&&x<=cross.verticalX||mode==='rl'&&x>=cross.verticalX||mode==='tb'&&y<=cross.y||mode==='bt'&&y>=cross.y)continue;
      const dx=x-cross.diagX,dy=y-cross.y;
      // Avoid allocating eight point arrays for every raster cell.
      for(let i=0;i<(mode==='sector'?8:1);i++){
        let sx=x,sy=y;
        if(mode==='lr'||mode==='rl')sx=2*cross.verticalX-x;
        else if(mode==='tb'||mode==='bt')sy=2*cross.y-y;
        else{const a=i<4?dx:dy,b=i<4?dy:dx;sx=cross.diagX+(i&1?-a:a);sy=cross.y+(i&2?-b:b);}
        // Half-cell sources are unsupported. Rounding would silently pick a
        // different bit and break the parity and locked-axis geometry.
        if(!Number.isInteger(sx)||!Number.isInteger(sy)||sx<0||sy<0||sx>=W||sy>=H)continue;
        const from=sy*W+sx,source=codes[from];if(!source||mode==='sector'&&source!==sectorCode)continue;
        map[q]=from;break;
      }
    }}
    return map;
  }
  function apply(pixels,options){const source=pixels.slice(),map=mapping(options);let count=0;for(let q=0;q<map.length;q++)if(map[q]>=0){pixels[q]=source[map[q]];count++;}return {count,mapping:map};}
  function clip(polygon,[a,b,c],positive=true){
    const out=[],sign=positive?1:-1,value=p=>sign*(a*p[0]+b*p[1]+c);
    for(let i=0;i<polygon.length;i++){
      const p=polygon[i],q=polygon[(i+1)%polygon.length],u=value(p),v=value(q),inside=u>=-EPS,next=v>=-EPS;
      if(inside)out.push(p);if(inside!==next){const t=u/(u-v);out.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}
    }
    return out;
  }
  function centroid(points){
    let area=0,x=0,y=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],cross=a[0]*b[1]-b[0]*a[1];area+=cross;x+=(a[0]+b[0])*cross;y+=(a[1]+b[1])*cross;}
    return Math.abs(area)>EPS?{area:Math.abs(area/2),point:[x/(3*area),y/(3*area)]}:null;
  }
  function sectorPolygons(cross,box){
    const {verticalX:V,diagX:D,y:Y,left:L,right:R}=cross;
    const bounds=Array.isArray(box[0])?box:[[box[0],box[1]],[box[2],box[1]],[box[2],box[3]],[box[0],box[3]]];
    const lines=[[1,0,-V],[0,1,-Y],[1,1,-D-Y],[1,-1,Y-D]];
    if(Number.isFinite(L))lines.push([1,-1,Y-L]);if(Number.isFinite(R))lines.push([1,1,-R-Y]);
    let polygons=[bounds];for(const line of lines){const next=[];for(const p of polygons)for(const positive of [true,false]){const q=clip(p,line,positive),c=centroid(q);if(c&&c.area>EPS)next.push(q);}polygons=next;}
    const out=[];for(const points of polygons){const c=centroid(points),sector=classify(cross,...c.point);if(sector)out.push({sector,label:LABELS[sector],points,area:c.area,centroid:c.point});}return out;
  }
  function labelAnchors(cross,box,valid=null){
    const result=[],polygons=sectorPolygons(cross,box);for(const sector of Object.keys(LABELS)){
      const parts=polygons.filter(p=>p.sector===sector).sort((a,b)=>b.area-a.area);let chosen=null;
      for(const part of parts){
        const candidates=[part.centroid,...part.points.map(p=>[part.centroid[0]*.7+p[0]*.3,part.centroid[1]*.7+p[1]*.3])];
        const point=candidates.find(p=>classify(cross,...p)===sector&&(!valid||valid(...p)));if(point){chosen={sector,label:LABELS[sector],x:point[0],y:point[1],area:part.area};break;}
      }
      if(chosen)result.push(chosen);
    }
    return result;
  }
  return {LABELS,COLOURS,FILL_ALPHA,classify,crosses,candidates,mapping,apply,sectorPolygons,labelAnchors,sectorRaster,ownerRegions};
});
