/* Screen-space light and conservative water on the same rasterized bit boundaries. */
(function(root){
  'use strict';
  class Field {
    constructor(width,height,solid=new Uint8Array(width*height)){
      this.width=width;this.height=height;this.solid=solid;this.lightTypes=null;
      this.water=new Float32Array(width*height);this.tick=0;this.drained=0;
    }
    blocked(x,y){x=Math.floor(x);y=Math.floor(y);return x>=0&&y>=0&&x<this.width&&y<this.height&&!!this.solid[y*this.width+x];}
    lightType(x,y){return this.blocked(x,y)?this.lightTypes?.[Math.floor(y)*this.width+Math.floor(x)]||4:0;}
    lightResponse(type,vy){
      if(!type)return {pass:true,reflect:false};
      if(type&4)return {pass:false,reflect:true};
      const side=vy>1e-9?1:vy< -1e-9?2:3,defaults=[{pass:1,reflect:2},{pass:2,reflect:1}];
      let pass=true,reflect=false;
      for(let bit=0;bit<2;bit++)if(type&(1<<bit)){
        const rule=this.lightRules?.[bit]||defaults[bit];
        pass=pass&&((rule.pass&side)===side);reflect=reflect||!!(rule.reflect&side);
      }
      return {pass,reflect};
    }
    lightBlocked(x,y,vy){return !this.lightResponse(this.lightType(x,y),vy).pass;}
    rayAlpha(ray){return Number.isFinite(ray.intensity)?ray.intensity:(this.reflectionLoss===false?1:2**-(ray.bounces||0));}
    addWater(x,y,amount=1){
      x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=this.width||y>=this.height)return 0;
      const i=y*this.width+x;if(this.solid[i])return 0;
      const added=Math.min(amount,1-this.water[i]);this.water[i]+=added;return added;
    }
    setMask(mask){
      this.solid=mask;
      // A moving wall displaces water upward into free space, rather than trapping it inside.
      for(let i=0;i<mask.length;i++)if(mask[i]&&this.water[i]>0){
        let mass=this.water[i];this.water[i]=0;
        for(let j=i-this.width;j>=0&&mass>1e-7;j-=this.width)if(!mask[j]){
          const flow=Math.min(mass,1-this.water[j]);this.water[j]+=flow;mass-=flow;
        }
        this.drained+=mass;
      }
    }
    stepWater(){
      const {width:w,height:h,solid:s,water:m}=this;const reverse=!!(this.tick++%2);
      const transfer=(i,j,amount)=>{if(amount<=0||s[j])return;const flow=Math.min(m[i],1-m[j],amount);if(flow>0){m[i]-=flow;m[j]+=flow;}};
      for(let y=h-1;y>=0;y--)for(let n=0;n<w;n++){
        const x=reverse?w-1-n:n,i=y*w+x;if(s[i]||m[i]<=0)continue;
        if(y===h-1){this.drained+=m[i];m[i]=0;continue;}
        const below=i+w;transfer(i,below,m[i]);
        // Corners stay watertight: diagonal motion requires the side cell to be free.
        for(const d of reverse?[1,-1]:[-1,1])if(x+d>=0&&x+d<w&&!s[i+d]){
          transfer(i,below+d,m[i]);
          transfer(i,i+d,(m[i]-m[i+d])*.5);
        }
        if(x===0||x===w-1){this.drained+=m[i];m[i]=0;}
      }
    }
    normal(x,y,vx,vy){
      let nx=0,ny=0;const r=3;
      for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
        const px=Math.floor(x)+dx+.5,py=Math.floor(y)+dy+.5;
        const response=this.lightResponse(this.lightType(px,py),vy);if(response.pass&&!response.reflect)continue;
        const d=Math.hypot(x-px,y-py);if(d>r+.5)continue;
        const weight=(r+1-d)/Math.max(.2,d);nx+=(x-px)*weight;ny+=(y-py)*weight;
      }
      const len=Math.hypot(nx,ny);if(len<1e-7)return [-vx,-vy];
      nx/=len;ny/=len;if(nx*vx+ny*vy>0){nx=-nx;ny=-ny;}return [nx,ny];
    }
    topBeams(y0=0){
      const beams=[],distance=12*Math.hypot(this.width,this.height);
      for(let x=0;x<this.width;x++){
        const pending=[{ray:{x:x+.5,y:y0,vx:0,vy:1,bounces:0},remaining:distance,start:0}];
        for(let n=0;n<pending.length&&n<32;n++){
          const current=pending[n],forks=[],path=this.advanceRay(current.ray,current.remaining,forks);let travelled=current.start;
          for(let i=1;i<path.length;i++){
            const a=path[i-1],b=path[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
            if(length>0)beams.push({a,b,alpha:a[2],start:travelled,length});
            travelled+=length;
          }
          for(const fork of forks)if(pending.length<32)pending.push({...fork,start:current.start+fork.travelled});
        }
      }
      return beams;
    }
    advanceRay(ray,distance,forks=[]){
      const path=[[ray.x,ray.y,this.rayAlpha(ray)]];let remaining=Math.max(0,distance);
      const initial=this.lightType(ray.x,ray.y);
      if(initial!==ray.medium&&this.lightBlocked(ray.x,ray.y,ray.vy)){ray.dead=true;return path;}
      while(remaining>1e-7&&!ray.dead){
        const step=Math.min(.4,remaining),x=ray.x+ray.vx*step,y=ray.y+ray.vy*step;remaining-=step;
        if(x<0||y<0||x>=this.width||y>=this.height){ray.dead=true;break;}
        const type=this.lightType(x,y),response=this.lightResponse(type&~(ray.medium||0),ray.vy);
        if(response.reflect||!response.pass){
          path.push([ray.x,ray.y,this.rayAlpha(ray)]);
          if(!response.reflect){ray.dead=true;break;}
          let alpha=this.rayAlpha(ray);
          if(response.pass){
            alpha*=.5;
            if(alpha>=.002&& (ray.splits||0)<12)forks.push({ray:{...ray,x,y,intensity:alpha,medium:type,splits:(ray.splits||0)+1,trail:[]},remaining,travelled:distance-remaining});
            ray.splits=(ray.splits||0)+1;
          }
          const [nx,ny]=this.normal(ray.x,ray.y,ray.vx,ray.vy),dot=ray.vx*nx+ray.vy*ny;
          ray.vx-=2*dot*nx;ray.vy-=2*dot*ny;ray.bounces=(ray.bounces||0)+1;
          ray.intensity=alpha*(this.reflectionLoss===false?1:.5);
          path.push([ray.x,ray.y,ray.intensity]);
          // Retain the last free position. No jump across a thin neighbouring wall.
          if(ray.bounces>=12||ray.intensity<.002)ray.dead=true;
        }else{ray.x=x;ray.y=y;ray.medium=type;}
      }
      path.push([ray.x,ray.y,this.rayAlpha(ray)]);return path;
    }
  }

  // Hydrostatic relaxation along each supported horizontal span. Unlike the local
  // snow-like solver, a pool levels across its full width before its next fall.
  class WaterField extends Field {
    constructor(...args){super(...args);this.activeRows=new Set();this.cornerPass=false;}
    addWater(x,y,amount=1){const added=super.addWater(x,y,amount);if(added>0)this.activeRows.add(Math.floor(y));return added;}
    fillTop(y=0){let added=0;for(let x=0;x<this.width;x++)added+=this.addWater(x,y);return added;}
    setMask(mask){
      this.solid=mask;
      // Moving bits may push liquid sideways or down, never lift it above its row.
      const {width:w,height:h,water:m}=this;
      for(const y of [...this.activeRows].sort((a,b)=>b-a))for(let x=0;x<w;x++){
        const i=y*w+x;if(!mask[i]||!m[i])continue;
        let mass=m[i];m[i]=0;
        for(const [dx,dy] of [[0,1],[-1,1],[1,1],[-1,0],[1,0]]){
          const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy>=h)continue;
          // A diagonal cannot squeeze through two touching solid corners.
          if(!this.cornerPass&&dx&&dy&&mask[i+dx]&&mask[i+w])continue;
          mass-=this.addWater(xx,yy,mass);if(mass<=0)break;
        }
        this.drained+=mass;
      }
    }
    stepWater(){
      const {width:w,height:h,solid:s,water:m}=this;
      const active=new Set(this.activeRows),reverse=!!(this.tick%2),directions=reverse?[1,-1]:[-1,1];
      const move=(i,j)=>{if(s[j])return;const q=Math.min(m[i],1-m[j]);if(q>0){m[i]-=q;m[j]+=q;active.add(Math.floor(j/w));}};
      for(const y of [...this.activeRows].sort((a,b)=>b-a)){
        // Translate an unobstructed row in bulk (dense sheets otherwise cost millions of transfers).
        if(y<h-1){
          const below=(y+1)*w;let clear=true;
          for(let i=below;i<below+w;i++)if(s[i]||m[i]){clear=false;break;}
          if(clear){m.copyWithin(below,y*w,below);m.fill(0,y*w,below);active.add(y+1);continue;}
        }
        for(let n=0;n<w;n++){
          const x=reverse?w-1-n:n;
          const i=y*w+x;if(!m[i]||s[i])continue;
          if(y===h-1){this.drained+=m[i];m[i]=0;}
          else{
            move(i,i+w);
            if(!m[i])continue;
            for(const dx of directions)if(x+dx>=0&&x+dx<w&&(this.cornerPass||!s[i+dx]))move(i,i+w+dx);
            if(x===0||x===w-1){this.drained+=m[i];m[i]=0;}
          }
        }
      }
      const supported=i=>!s[i]&&(s[i+w]||m[i+w]>=.99999);
      for(const y of [...active].sort((a,b)=>b-a)){
        if(y===h-1)continue;
        let full=true;for(let i=y*w;i<(y+1)*w;i++)if(!s[i]&&m[i]!==1){full=false;break;}
        if(full)continue;
        for(let x=0;x<w;){
          const start=x;if(!supported(y*w+x)){x++;continue;}
          let total=0;while(x<w&&supported(y*w+x)){total+=m[y*w+x];x++;}
          const end=x;if(total<=0)continue;
          // A span may spill only through its adjacent free ends, never through a wall.
          const outlets=[];
          for(const edge of [start-1,end])if(edge>=0&&edge<w&&!s[y*w+edge])outlets.push(y*w+edge);
          const share=outlets.length?Math.min(1,total/outlets.length):0;
          for(const i of outlets){const q=Math.min(share,1-m[i]);m[i]+=q;total-=q;}
          const level=total/(end-start);
          for(let xx=start;xx<end;xx++)m[y*w+xx]=level;
        }
      }
      if(this.tick%4===0)this.levelBodies(active);
      this.activeRows=new Set([...active].filter(y=>m.subarray(y*w,(y+1)*w).some(q=>q>0)));
      this.tick++;
    }
  }
  // v0.405: communicating vessels. Each resting body of water (cells that lie on a wall or on full water) is
  // refilled lowest-first over every free cell it can reach, so a pool rises evenly in all its branches —
  // a narrow shaft and the side channels joined to it fill to one level. A body that would reach the edge
  // of the field is left to the ordinary flow (it drains there anyway).
  WaterField.prototype.levelBodies=function(active){
    const {width:w,height:h,solid:s,water:m}=this,seen=new Uint8Array(w*h),rest=i=>m[i]>0&&!s[i]&&i+w<w*h&&(s[i+w]||m[i+w]>=.99999);
    const nb=(i,f)=>{const x=i%w;
      if(x>0&&!s[i-1])f(i-1);if(x<w-1&&!s[i+1])f(i+1);if(i>=w&&!s[i-w])f(i-w);if(i+w<w*h&&!s[i+w])f(i+w);
      for(const dx of [-1,1]){if(x+dx<0||x+dx>=w)continue;const side=!s[i+dx]||this.cornerPass;
        if(i+w<w*h&&!s[i+w+dx]&&(side||!s[i+w]))f(i+w+dx);if(i>=w&&!s[i-w+dx]&&(side||!s[i-w]))f(i-w+dx);}};
    for(const y0 of [...this.activeRows])for(let x0=0;x0<w;x0++){
      const i0=y0*w+x0;if(seen[i0]||!rest(i0))continue;
      const body=[i0];seen[i0]=1;let vol=0;
      for(let k=0;k<body.length;k++){const i=body[k];vol+=m[i];nb(i,j=>{if(!seen[j]&&rest(j)){seen[j]=1;body.push(j);}});}
      if(body.length<2||vol<1)continue;
      // Priority flood from the body's own cells, deepest row first.
      let left=vol;const inBody=new Set(body);
      // Water met on the way (a drop still falling) joins the body, so nothing is overwritten.
      const buckets=new Map(),mark=new Set(),push=j=>{if(mark.has(j))return;mark.add(j);if(m[j]>0&&!inBody.has(j)){inBody.add(j);body.push(j);left+=m[j];}const y=Math.floor(j/w);if(!buckets.has(y))buckets.set(y,[]);buckets.get(y).push(j);};
      body.slice().forEach(push);
      const fill=[];let edge=false,lastRow=-1,rowCells=[];
      while(left>1e-6){
        let y=-1;for(const [yy,list] of buckets)if(list.length&&yy>y)y=yy;if(y<0)break;
        const i=buckets.get(y).pop(),x=i%w;
        if(x===0||x===w-1||y===h-1){edge=true;break;}
        if(y!==lastRow){lastRow=y;rowCells=[];}
        rowCells.push(i);fill.push(i);left-=1;nb(i,push);
      }
      if(edge)continue;
      for(const i of body)m[i]=0;
      for(const i of fill){m[i]=1;active.add(Math.floor(i/w));}
      if(left<0){
        // The top row holds the fraction: spread it over every reachable cell of that row.
        const row=new Set(rowCells),q=[...(buckets.get(lastRow)||[])];for(const j of q)row.add(j);
        let extra=0;
        for(let k=0;k<q.length;k++)nb(q[k],j=>{if(Math.floor(j/w)===lastRow&&!row.has(j)&&!mark.has(j)){mark.add(j);row.add(j);q.push(j);if(m[j]>0&&!inBody.has(j)){extra+=m[j];m[j]=0;}}});
        const total=rowCells.length+left+extra;
        const level=Math.max(0,total/row.size);for(const j of row)m[j]=level;
      }
    }
  };
  if(typeof module==='object'&&module.exports)module.exports={Field,WaterField};else root.HubFlowCore={Field,WaterField};
})(typeof window==='object'?window:globalThis);
