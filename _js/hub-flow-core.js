/* Screen-space light and conservative water on the same rasterized bit boundaries. */
(function(root){
  'use strict';
  class Field {
    constructor(width,height,solid=new Uint8Array(width*height)){
      this.width=width;this.height=height;this.solid=solid;
      this.water=new Float32Array(width*height);this.tick=0;this.drained=0;
    }
    blocked(x,y){x=Math.floor(x);y=Math.floor(y);return x>=0&&y>=0&&x<this.width&&y<this.height&&!!this.solid[y*this.width+x];}
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
        if(!this.blocked(px,py))continue;
        const d=Math.hypot(x-px,y-py);if(d>r+.5)continue;
        const weight=(r+1-d)/Math.max(.2,d);nx+=(x-px)*weight;ny+=(y-py)*weight;
      }
      const len=Math.hypot(nx,ny);if(len<1e-7)return [-vx,-vy];
      nx/=len;ny/=len;if(nx*vx+ny*vy>0){nx=-nx;ny=-ny;}return [nx,ny];
    }
    advanceRay(ray,distance){
      const path=[[ray.x,ray.y]];let remaining=Math.max(0,distance);
      if(this.blocked(ray.x,ray.y)){ray.dead=true;return path;}
      while(remaining>1e-7&&!ray.dead){
        const step=Math.min(.4,remaining),x=ray.x+ray.vx*step,y=ray.y+ray.vy*step;remaining-=step;
        if(x<0||y<0||x>=this.width||y>=this.height){ray.dead=true;break;}
        if(this.blocked(x,y)){
          path.push([ray.x,ray.y]);const [nx,ny]=this.normal(ray.x,ray.y,ray.vx,ray.vy),dot=ray.vx*nx+ray.vy*ny;
          ray.vx-=2*dot*nx;ray.vy-=2*dot*ny;ray.bounces=(ray.bounces||0)+1;
          // Retain the last free position. No jump across a thin neighbouring wall.
          if(ray.bounces>=12)ray.dead=true;
        }else{ray.x=x;ray.y=y;}
      }
      path.push([ray.x,ray.y]);return path;
    }
  }
  if(typeof module==='object'&&module.exports)module.exports={Field};else root.HubFlowCore={Field};
})(typeof window==='object'?window:globalThis);
