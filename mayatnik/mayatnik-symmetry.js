/* Exact symmetry on the two checkerboard lattices. Independent of drawing/zoom.
   Bits are counted per side, excluding a bit on the axis. Rows are consecutive
   transverse slices (columns for horizontal axes, diagonals for diagonal axes).
   Upper bounds filter maximal runs/radii; zero means no upper bound. */
(function (root) {
  function createSymmetry() {
    const parity = n => ((n % 2) + 2) % 2;
    // Manacher radii; an unwritten cell is a boundary, never a matching bit.
    function radii(a) {
      const n = a.length, odd = new Int32Array(n), even = new Int32Array(n);
      let l = 0, r = -1;
      for (let i = 0; i < n; i++) {
        if (a[i] < 0) { l = i + 1; r = i; continue; }
        let k = i > r ? 1 : Math.min(odd[l + r - i], r - i + 1);
        while (i - k >= 0 && i + k < n && a[i-k] >= 0 && a[i-k] === a[i+k]) k++;
        odd[i] = k;
        if (i+k-1 > r) { l = i-k+1; r = i+k-1; }
      }
      l = 0; r = -1;
      for (let i = 0; i < n; i++) {
        let k = i > r ? 0 : Math.min(even[l+r-i+1], r-i+1);
        while (i-k-1 >= 0 && i+k < n && a[i-k-1] >= 0 && a[i-k-1] === a[i+k]) k++;
        even[i] = k;
        if (i+k-1 > r) { l = i-k; r = i+k-1; }
      }
      return {odd, even};
    }
    // A normal slice: origin, step, length, and its longitudinal coordinate t.
    function lines(W, H, anchor, dir, p, visit) {
      if (dir === 'v') for (let y=0;y<H;y++) {
        const x=parity(anchor+p+y); visit(x,y,2,0,Math.max(0,Math.ceil((W-x)/2)),y);
      }
      else if (dir === 'h') for (let x=0;x<W;x++) {
        const y=parity(x-anchor-p); visit(x,y,0,2,Math.max(0,Math.ceil((H-y)/2)),x);
      }
      else if (dir === 'd') for (let q=parity(anchor+p);q<W+H-1;q+=2) {
        const x=Math.max(0,q-H+1),y=q-x; visit(x,y,1,-1,Math.min(W-1,q)-x+1,q);
      }
      else for (let d=-(H-1);d<W;d++) {
        if(parity(d-anchor)!==p)continue;
        const x=Math.max(0,d),y=x-d;visit(x,y,1,1,Math.min(W-x,H-y),d);
      }
    }
    const axisOf = (dir,x,y) => dir==='v'?x:dir==='h'?y:dir==='d'?x-y:x+y;
    function point(dir,axis,t) {
      return dir==='v'?[axis,t]:dir==='h'?[t,axis]:dir==='d'?[(t+axis)/2,(t-axis)/2]:[(axis+t)/2,(axis-t)/2];
    }
    function colour(dir,axis,p) {
      const h=((axis*137.507764 + p*71 + ['v','h','d','u'].indexOf(dir)*43)%360+360)%360;
      const f=n=>{const k=(n+h/30)%12;return Math.round(255*(.62-.38*Math.max(-1,Math.min(k-3,9-k,1))));};
      return [f(0),f(8),f(4)];
    }
    function find(field, opts={}) {
      const {W,H,val}=field, anchor=opts.anchor||0;
      const minBits=Math.max(1,opts.minBits||2), maxBits=opts.maxBits||Infinity;
      const minRows=Math.max(1,opts.minRows||2), maxRows=opts.maxRows||Infinity;
      const segs=[];
      for(const dir of opts.directions||['v','h','d','u'])for(let p=0;p<2;p++) {
        const active=new Map();let seq=0;
        const finish=s=>{if(s.widths.length>=minRows&&s.widths.length<=maxRows){s.colour=colour(dir,s.axis,p);segs.push(s);}};
        lines(W,H,anchor,dir,p,(x,y,dx,dy,n,t)=>{
          const a=new Int8Array(n);for(let i=0;i<n;i++)a[i]=val[(y+i*dy)*W+x+i*dx];
          const {odd,even}=radii(a);
          const add=(i,bits)=>{
            if(bits<minBits||bits>maxBits)return;
            const axis=axisOf(dir,x+i*dx,y+i*dy),old=active.get(axis);
            let s=old;
            if(!old||old.last!==seq-1){if(old)finish(old);s={dir,p,axis,t0:t,t1:t,widths:[],last:seq};active.set(axis,s);}
            s.last=seq;s.t1=t;s.widths.push(bits);
          };
          for(let i=0;i<n;i++){add(i,odd[i]-1);add(i-.5,even[i]);}
          seq++;
        });
        for(const s of active.values())finish(s);
      }
      return segs;
    }
    function span(s,i,anchor) {
      const t=s.t0+i*(s.dir==='v'||s.dir==='h'?1:2),[x,y]=point(s.dir,s.axis,t);
      const dx=s.dir==='v'?2:s.dir==='h'?0:1,dy=s.dir==='v'?0:s.dir==='h'?2:s.dir==='d'?-1:1;
      const through=Number.isInteger(x)&&Number.isInteger(y)&&parity(x-y-anchor)===s.p;
      const d=s.widths[i]-(through?0:.5);
      return {x:x-d*dx,y:y-d*dy,dx,dy,n:2*s.widths[i]+(through?1:0)};
    }
    // Range additions on each normal slice avoid repainting every bit for every
    // overlapping axis. Overlaps blend their axis colours instead of hiding bits.
    function highlights(field,segs,anchor=0) {
      const {W,H}=field,N=W*H,outR=new Float32Array(N),outG=new Float32Array(N),outB=new Float32Array(N),outN=new Int32Array(N);
      const dr=new Float32Array(N),dg=new Float32Array(N),db=new Float32Array(N),dn=new Int32Array(N);
      for(const dir of ['v','h','d','u'])for(let p=0;p<2;p++) {
        dr.fill(0);dg.fill(0);db.fill(0);dn.fill(0);
        for(const s of segs){if(s.dir!==dir||s.p!==p)continue;const [r,g,b]=s.colour;
          for(let i=0;i<s.widths.length;i++){
            const a=span(s,i,anchor),q=a.y*W+a.x,ex=a.x+a.n*a.dx,ey=a.y+a.n*a.dy;
            dr[q]+=r;dg[q]+=g;db[q]+=b;dn[q]++;
            if(ex>=0&&ex<W&&ey>=0&&ey<H){const end=ey*W+ex;dr[end]-=r;dg[end]-=g;db[end]-=b;dn[end]--;}
          }
        }
        lines(W,H,anchor,dir,p,(x,y,dx,dy,n)=>{
          let r=0,g=0,b=0,c=0;
          for(let i=0;i<n;i++){const q=(y+i*dy)*W+x+i*dx;r+=dr[q];g+=dg[q];b+=db[q];c+=dn[q];if(c>0){outR[q]+=r;outG[q]+=g;outB[q]+=b;outN[q]+=c;}}
        });
      }
      const rgba=new Uint8ClampedArray(N*4);
      for(let q=0;q<N;q++)if(outN[q]){rgba[q*4]=outR[q]/outN[q];rgba[q*4+1]=outG[q]/outN[q];rgba[q*4+2]=outB[q]/outN[q];rgba[q*4+3]=255;}
      return rgba;
    }
    // Inscribed 45-degree cones, independently on each exact symmetry run.
    // Work in slice coordinates: one longitudinal step has the same length
    // as one unit of radius. Both orientations and nested axes are retained.
    // Packed vertices/rgb/lattice avoid millions of small canvas objects.
    function triangles(segs, anchor=0, minRows=16) {
      const packed=[];
      minRows=Math.max(2,Math.floor(minRows)||16);
      for(const sg of segs) {
        const n=sg.widths.length;if(n<minRows)continue;
        const radii=new Float64Array(n);
        for(let i=0;i<n;i++){
          const a=span(sg,i,anchor);
          radii[i]=(a.n-1)/2*(sg.dir==='v'||sg.dir==='h'?2:1);
        }
        for(const reverse of [false,true]) {
          let size=1;while(size<n)size*=2;
          const tree=new Float64Array(size*2).fill(-Infinity);
          for(let i=0;i<n;i++)tree[size+i]=i-radii[reverse?n-1-i:i];
          for(let i=size-1;i;i--)tree[i]=Math.max(tree[i*2],tree[i*2+1]);
          // First row whose mirror span is narrower than this cone.
          const first=(node,l,r,start,limit)=>{
            if(r<=start||tree[node]<=limit)return n;
            if(r-l===1)return l;
            const mid=(l+r)/2,left=first(node*2,l,mid,start,limit);
            return left<n?left:first(node*2+1,mid,r,start,limit);
          };
          const heights=new Int32Array(n);
          for(let i=0;i<n;i++)heights[i]=Math.min(n,first(1,0,size,i,i))-i;
          for(let start=0;start<n;){
            let stop=start+1;while(stop<n&&heights[stop]===heights[start])stop++;
            const i=Math.floor((start+stop-1)/2),height=heights[i];
            const peak=height>=(start?heights[start-1]:0)&&height>=(stop<n?heights[stop]:0);
            start=stop;
            // One representative per flat maximum, not a triangle at every
            // pixel of a uniform stripe. Separate peaks and nested axes remain.
            if(!peak||height<minRows)continue;
            const end=i+height-1;
            const ai=reverse?n-1-i:i,bi=reverse?n-1-end:end;
            const step=sg.dir==='v'||sg.dir==='h'?1:2;
            const a=point(sg.dir,sg.axis,sg.t0+ai*step),b=point(sg.dir,sg.axis,sg.t0+bi*step),h=end-i;
            const dx=sg.dir==='v'?h:sg.dir==='h'?0:h,dy=sg.dir==='v'?0:sg.dir==='h'?h:sg.dir==='d'?-h:h;
            const c=colour(sg.dir,sg.axis+ai*.381966+(reverse?19:0),sg.p);
            packed.push(a[0],a[1],b[0]-dx,b[1]-dy,b[0]+dx,b[1]+dy,...c,sg.p);
          }
        }
      }
      return new Float32Array(packed);
    }
    return {find,point,span,highlights,triangles};
  }
  const api=createSymmetry();
  api.createWorker=()=>{
    const code=`const api=(${createSymmetry.toString()})();onmessage=e=>{const {field,opts,bits,totems,minTriangleRows}=e.data;const segs=api.find(field,opts);const rgba=bits?api.highlights(field,segs,opts.anchor):null;const triangles=totems?api.triangles(segs,opts.anchor,minTriangleRows):null;postMessage({segs,rgba,triangles},[...(rgba?[rgba.buffer]:[]),...(triangles?[triangles.buffer]:[])]);};`;
    const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
    try{return new Worker(url);}finally{URL.revokeObjectURL(url);}
  };
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.MayatnikSymmetry=api;
})(typeof globalThis!=='undefined'?globalThis:this);
