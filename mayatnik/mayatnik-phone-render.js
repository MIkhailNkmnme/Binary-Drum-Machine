/* One vector description for Canvas2D playback and SVG/video export.
 * The formulae, cell shapes, poses, guides and backgrounds are the original
 * phone wallpaper artwork. Only the underlying algorithmic frame changes.
 */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikPhoneRender=api;})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';
  const W=720,H=1600;
  const RGB=['#000000','#0000ff','#00ff00','#00ffff','#ff0000','#ff00ff','#ffff00','#ffffff'];
  const round=(v,n=1000)=>Math.round(v*n)/n;
  const point=(p,n=1000)=>p.map(v=>round(v,n)).join(' ');
  const path=(points,n=1000)=>'M'+points.map(p=>point(p,n)).join('L')+'Z';
  const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  function mix(a,b,t){const end=rgb(b);return '#'+rgb(a).map((v,i)=>Math.round(v+t*(end[i]-v)).toString(16).padStart(2,'0')).join('');}
  const orbit=(cx,cy,a,rx,ry)=>[cx+Math.cos(a)*rx,cy+Math.sin(a)*ry];
  const projections={
    orbit:(u,v)=>orbit(360,965,(u-.25)*Math.PI*2,163+v*155,260+v*235),
    fault:(u,v,face)=>face===0?[735-825*u-66*v+88*Math.sin(u*Math.PI),405+1050*u+245*v]:[540-715*u+68*v+68*Math.sin(u*Math.PI),725+870*u+170*v],
    lens:(u,v,face)=>{const y=435+u*1020,aperture=315*Math.pow(Math.sin(Math.PI*u),1.06);return [360+(face?-1:1)*v*aperture,y+v*aperture*(face?-.22:.22)];},
    rosette:(u,v,face)=>{const angle=(face+(u-.5)*.96*(1-.29*v))*Math.PI/4-Math.PI/2,radius=47+280*v;return orbit(360,949,angle,radius,radius*1.65);},
    banks:(u,v,face)=>{const y=452+u*1200,center=340+177*Math.sin((u-.14)*Math.PI*1.57)-60*u,spread=15+28*Math.sin(u*Math.PI)+v*(85+120*Math.sin(u*Math.PI));return [center+(face?1:-1)*spread,y+(face?1:-1)*v*52];},
    monolith:(u,v,face)=>{const taper=Math.min(u*6,(1-u)*6,1);return [355+(face?1:-1)*(241+25*Math.sin(u*Math.PI))*v*taper,437+1045*u+(face?92:-110)*v*taper];}
  };
  function pushGroup(groups,key,mark){if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mark);}
  function artCells(frame){
    const recipe=frame.art.recipe,palette=recipe.palette,project=projections[recipe.projection],groups=new Map();
    const width=frame.width,height=frame.height,rosette=recipe.projection==='rosette';
    const faces=rosette?2:recipe.projection==='orbit'?1:2;
    let xmin=width,xmax=0;
    for(let q=0;q<frame.values.length;q++)if(frame.values[q]===1){xmin=Math.min(xmin,q%width);xmax=Math.max(xmax,q%width);}
    if(xmin>xmax)return [];
    const span=xmax-xmin+1,du=(rosette ? .97 : .93)/span,dv=.91/height;
    for(let face=0;face<faces;face++)for(let y=0;y<height;y++)for(let x=xmin;x<=xmax;x++){
      const q=y*width+x;if(frame.values[q]!==1)continue;
      const v=y/height,u=(x-xmin)/span,a=frame.a[q]===1,b=frame.b[q]===1;
      const layer=frame.age[q]?'echo':a?(b?'both':'a'):b?'b':'echo';
      const slot=face%2&&layer==='a'?'b':face%2&&layer==='b'?'a':layer;
      const lit=.5+.5*Math.cos((v*.83+u*.37+face*.15)*Math.PI*2);
      const strength=.24+.65*lit+(frame.changed[q]===1 ? .08 : 0),fill=mix(palette.ground,palette[slot],Math.round(strength*7)/7);
      pushGroup(groups,face+':'+fill,path([project(u,v,face),project(u+du,v,face),project(u+du,v+dv,face),project(u,v+dv,face)],10));
    }
    const out=[];
    const sectors=[[],[]];
    for(const [key,marks] of groups){const [face,fill]=key.split(':');sectors[face].push({tag:'path',fill,d:marks.join('')});}
    if(rosette){for(let target=0;target<8;target++)for(const command of sectors[target%2])out.push({...command,
      transform:'translate(360 949) scale(1 1.65) rotate('+((target-target%2)*45)+') scale(1 .606060606) translate(-360 -949)'});
    }else out.push(...sectors.flat());
    return out;
  }
  function mark(x,y,shape){
    if(shape==='triangle')return path([[x,y],[x-.98,y+.97],[x+.98,y+.97]]);
    if(shape==='diamond')return path([[x,y+.03],[x+.89,y+.5],[x,y+.97],[x-.89,y+.5]]);
    if(shape==='squares')return 'M'+(x+.06)+' '+(y+.06)+'h.88v.88h-.88Z';
    return 'M'+x+' '+y+'h1v1h-1Z';
  }
  function geometricCells(frame){
    const entry=frame.art,recipe=entry.recipe,groups=new Map(),out=[];
    if(entry.category==='rgb'){
      for(let q=0;q<frame.rgbCodes.length;q++){const code=frame.rgbCodes[q];if(code>0)pushGroup(groups,RGB[code],mark(q%frame.width,Math.floor(q/frame.width),'solid'));}
      const g=recipe.grid,transform='translate('+g.x+' '+g.y+') scale('+g.scale+')';
      for(const [fill,marks] of groups)out.push({tag:'path',fill,d:marks.join(''),transform});
      return out;
    }
    for(let face=0;face<recipe.transforms.length;face++){
      groups.clear();const colors=recipe.palette[face%recipe.palette.length];
      for(let y=0;y<frame.height;y++)for(let x=0;x<frame.width;x++){
        const q=y*frame.width+x,value=frame.values[q];let fill=null;
        if(entry.category==='animatrix'){
          const previous=frame.initial[q];
          fill=value===1?(previous!==1?colors[0]:colors[1]):previous===1?colors[2]:value===0?colors[3]:null;
        }else if(value===1){
          if(entry.category==='pendulums')fill=frame.age[q]?colors[4+Number(frame.age[q]>3)]:colors[frame.a[q]===1?(frame.b[q]===1?2:0):frame.b[q]===1?1:3];
          else fill=colors[Math.min(colors.length-1,Math.floor(y*colors.length/frame.height))];
        }
        if(fill)pushGroup(groups,fill,mark(x,y,recipe.cellShape));
      }
      for(const [fill,marks] of groups)out.push({tag:'path',fill,d:marks.join(''),transform:recipe.transforms[face]});
    }
    return out;
  }
  function describe(frame){
    if(!frame?.art?.recipe||!frame.values)throw Error('A phone scene frame is required');
    const recipe=frame.art.recipe,art=!!recipe.projection,palette=art?recipe.palette:recipe.background;
    return {background:{ground:palette.ground,halo:palette.halo,outer:mix(palette.ground,palette.halo,art ? .16 : .17),cy:art ? .59 : .61,r:art ? .66 : .64,stop:art ? .73 : .63,clock:art},
      guides:frame.art.guides,cells:art?artCells(frame):geometricCells(frame)};
  }
  const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  function element(command){const {tag,...attributes}=command;return '<'+tag+' '+Object.entries(attributes).map(([name,value])=>name+'="'+escape(value)+'"').join(' ')+'/>';}
  function svg(frame,{width=1440,height=3200}={}){
    const scene=describe(frame),b=scene.background;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 720 1600">'+
      '<metadata>'+escape(JSON.stringify({id:frame.id,frame:frame.k,baseFrame:frame.baseFrame,evolution:'mayatnik-phone-scenes-v1'}))+'</metadata>'+
      '<defs><radialGradient id="ambient" cx=".5" cy="'+b.cy+'" r="'+b.r+'"><stop stop-color="'+b.halo+'"/><stop offset="'+b.stop+'" stop-color="'+b.outer+'"/><stop offset="1" stop-color="'+b.ground+'"/></radialGradient>'+
      '<linearGradient id="clock" x2="0" y2="1"><stop offset=".12" stop-color="'+b.ground+'"/><stop offset=".96" stop-color="'+b.ground+'" stop-opacity="0"/></linearGradient></defs>'+
      '<rect width="720" height="1600" fill="url(#ambient)"/>'+(b.clock?'<rect width="720" height="440" fill="url(#clock)"/>':'')+
      '<g id="guides">'+scene.guides.map(element).join('')+'</g><g id="cells">'+scene.cells.map(element).join('')+'</g></svg>';
  }
  function transform(ctx,text){
    if(!text)return;
    for(const match of text.matchAll(/(translate|scale|rotate|matrix)\(([^)]*)\)/g)){
      const v=match[2].trim().split(/[\s,]+/).map(Number);
      if(match[1]==='translate')ctx.translate(v[0],v[1]||0);
      else if(match[1]==='scale')ctx.scale(v[0],v.length>1?v[1]:v[0]);
      else if(match[1]==='matrix')ctx.transform(...v);
      else {if(v.length>1)ctx.translate(v[1],v[2]);ctx.rotate(v[0]*Math.PI/180);if(v.length>1)ctx.translate(-v[1],-v[2]);}
    }
  }
  function drawCommand(ctx,command,Path){
    ctx.save();transform(ctx,command.transform);ctx.globalAlpha=Number(command.opacity??1);
    const p=new Path();
    if(command.tag==='path')p.addPath(new Path(command.d));
    else if(command.tag==='rect')p.rect(Number(command.x||0),Number(command.y||0),Number(command.width),Number(command.height));
    else if(command.tag==='ellipse')p.ellipse(Number(command.cx),Number(command.cy),Number(command.rx),Number(command.ry),0,0,Math.PI*2);
    const fill=command.fill??'black';if(fill!=='none'){ctx.fillStyle=fill;ctx.fill(p);}
    if(command.stroke&&command.stroke!=='none'){ctx.strokeStyle=command.stroke;ctx.lineWidth=Number(command['stroke-width']??1);ctx.stroke(p);}
    ctx.restore();
  }
  function draw(ctx,frame,{width=ctx.canvas.width,height=ctx.canvas.height}={}){
    const Path=ctx.canvas?.ownerDocument?.defaultView?.Path2D||root.Path2D;
    if(!Path)throw Error('Canvas Path2D is required for wallpaper playback');
    const scene=describe(frame),b=scene.background;
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,width,height);ctx.scale(width/W,height/H);
    // SVG objectBoundingBox gradients stretch with the full wallpaper rectangle.
    ctx.save();ctx.scale(W,H);const gradient=ctx.createRadialGradient(.5,b.cy,0,.5,b.cy,b.r);
    gradient.addColorStop(0,b.halo);gradient.addColorStop(b.stop,b.outer);gradient.addColorStop(1,b.ground);
    ctx.fillStyle=gradient;ctx.fillRect(0,0,1,1);ctx.restore();
    if(b.clock){const clock=ctx.createLinearGradient(0,0,0,440),c=rgb(b.ground);clock.addColorStop(.12,b.ground);clock.addColorStop(.96,'rgba('+c.join(',')+',0)');ctx.fillStyle=clock;ctx.fillRect(0,0,W,440);}
    for(const command of scene.guides)drawCommand(ctx,command,Path);
    for(const command of scene.cells)drawCommand(ctx,command,Path);
    ctx.restore();return ctx.canvas;
  }
  return Object.freeze({draw,svg,renderSVG:svg,describe,width:1440,height:3200});
});
