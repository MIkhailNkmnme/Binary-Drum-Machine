/* v0.138: perforated, rotating triangular bipyramid, same cadence as the Hub icon. */
(() => {
  'use strict';
  function geometry(time,size){
    const yaw=time*.0011,tilt=.32,r=size*.34;
    const project=([x,y,z])=>{const xx=x*Math.cos(yaw)-z*Math.sin(yaw),zz=x*Math.sin(yaw)+z*Math.cos(yaw),yy=y*Math.cos(tilt)-zz*Math.sin(tilt),depth=y*Math.sin(tilt)+zz*Math.cos(tilt),k=3.2/(3.2+depth);return [size/2+xx*r*k,size/2-yy*r*1.15*k,depth];};
    const vertices=[[0,1,0],[0,-1,0],...[0,1,2].map(i=>[Math.cos(i*2*Math.PI/3),0,Math.sin(i*2*Math.PI/3)])].map(project);
    const faces=[];
    for(let i=0;i<3;i++){const a=i+2,b=(i+1)%3+2;faces.push({ids:[0,a,b],uv:[[13,0],[0,13],[26,13]]},{ids:[1,b,a],uv:[[13,26],[26,13],[0,13]]});}
    for(const f of faces){f.points=f.ids.map(i=>vertices[i]);f.depth=f.points.reduce((s,p)=>s+p[2],0)/3;}
    faces.sort((a,b)=>b.depth-a.depth);return {vertices,faces};
  }
  function affine(src,dst){const [a,b,c]=src,[p,q,r]=dst,x=b[0]-a[0],y=b[1]-a[1],u=c[0]-a[0],v=c[1]-a[1],det=x*v-u*y;
    const aa=((q[0]-p[0])*v-(r[0]-p[0])*y)/det,cc=((r[0]-p[0])*x-(q[0]-p[0])*u)/det,bb=((q[1]-p[1])*v-(r[1]-p[1])*y)/det,dd=((r[1]-p[1])*x-(q[1]-p[1])*u)/det;
    return [aa,bb,cc,dd,p[0]-aa*a[0]-cc*a[1],p[1]-bb*a[0]-dd*a[1]];
  }
  if(typeof module!=='undefined'&&module.exports){module.exports={geometry,affine};return;}
  const cv=document.querySelector('canvas.may-logo'),pattern=window.MayatnikLogoPattern;if(!cv||!pattern)return;
  const texture=document.createElement('canvas');texture.width=texture.height=104;const tg=texture.getContext('2d');
  // Draw only solid pixels. Holes remain alpha=0 on every front and back face.
  for(let y=0;y<26;y++)for(let x=0;x<26;x++){const bit=pattern[y][x];if(bit===' ')continue;tg.fillStyle=bit==='a'?'#ff9a5a':bit==='b'?'#8fd3ff':'#1e2a32';tg.fillRect(x*4,y*4,4,4);}
  const back=document.createElement('canvas');back.width=back.height=104;const bg=back.getContext('2d');bg.drawImage(texture,0,0);bg.globalCompositeOperation='source-atop';bg.fillStyle='rgba(0,0,0,.45)';bg.fillRect(0,0,104,104);
  const g=cv.getContext('2d');let raf=0;
  function draw(t){
    raf=0;if(!cv.isConnected||document.hidden)return;
    const s=cv.clientWidth||26,d=Math.min(3,devicePixelRatio||1),pixels=Math.round(s*d);
    if(cv.width!==pixels){cv.width=cv.height=pixels;}
    g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,s,s);g.save();g.beginPath();g.arc(s/2,s/2,s/2,0,Math.PI*2);g.clip();
    const {faces}=geometry(t,s);g.imageSmoothingEnabled=false;
    for(const face of faces){const p=face.points;g.save();g.beginPath();g.moveTo(...p[0].slice(0,2));g.lineTo(...p[1].slice(0,2));g.lineTo(...p[2].slice(0,2));g.closePath();g.clip();
      g.transform(...affine(face.uv,p));g.drawImage(face.depth>.08?back:texture,0,0,26,26);g.restore();
    }
    // Thin rims reveal the volume without closing the cutouts.
    for(const face of faces){g.globalAlpha=face.depth>.08?.18:.6;g.strokeStyle=face.ids[0]===0?'#8fd3ff':'#ff9a5a';g.lineWidth=.4;g.beginPath();face.points.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.stroke();}
    g.restore();raf=requestAnimationFrame(draw);
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else if(!raf)raf=requestAnimationFrame(draw);});
  raf=requestAnimationFrame(draw);
})();
