/* Codex — независимый исследователь Хоррориуса · 12.10.2026.
   One textured quad: nearest sampling and perspective rotation about its central vertical axis.
   Rotation and zoom do not modify or recompute the source bits. */
'use strict';
class HorroriusRenderer{
 constructor(canvas){
  this.canvas=canvas;this.gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true});this.textures=new Map();
  if(!this.gl){this.ctx=canvas.getContext('2d',{alpha:false});return;}
  const gl=this.gl;
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  const vs=shader(gl.VERTEX_SHADER,'attribute vec2 aUV;uniform vec2 uSize,uCenter,uViewport;uniform float uAngle,uEye;varying vec2 vUV;void main(){vec2 p=(aUV-.5)*uSize;float w=1.0-p.x*sin(uAngle)/uEye;vec2 center=(uCenter/uViewport)*vec2(2.0,-2.0)+vec2(-1.0,1.0);vec2 shift=vec2(2.0*p.x*cos(uAngle)/uViewport.x,-2.0*p.y/uViewport.y);gl_Position=vec4(center*w+shift,0.0,w);vUV=aUV;}');
  const fs=shader(gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D uImage;uniform float uAxis;varying vec2 vUV;void main(){gl_FragColor=uAxis>.5?vec4(.35,.8,.72,.7):texture2D(uImage,vUV);}');
  this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));gl.useProgram(this.program);
  this.uv=gl.getAttribLocation(this.program,'aUV');this.locations={};for(const n of ['uSize','uCenter','uViewport','uAngle','uEye','uImage','uAxis'])this.locations[n]=gl.getUniformLocation(this.program,n);
  this.quad=this.buffer([0,0,1,0,0,1,1,1]);this.axis=this.buffer([.5,0,.5,1]);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 }
 buffer(values){const gl=this.gl,b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(values),gl.STATIC_DRAW);return b;}
 release(bitmap){const t=this.textures.get(bitmap);if(t){this.gl.deleteTexture(t);this.textures.delete(bitmap);}}
 draw(bitmap,v){
  const W=bitmap.width*v.zoom,H=bitmap.height*v.zoom,x=v.x+W/2,y=v.y+H/2,angle=(v.angle||0)*Math.PI/180,c=this.canvas;
  if(!this.gl){const g=this.ctx;g.fillStyle='#020505';g.fillRect(0,0,c.width,c.height);g.save();g.translate(x,y);g.scale(Math.cos(angle),1);g.imageSmoothingEnabled=false;g.drawImage(bitmap,-W/2,-H/2,W,H);g.restore();if(v.angle%360){g.strokeStyle='#5bceb8';g.beginPath();g.moveTo(x,y-H/2);g.lineTo(x,y+H/2);g.stroke();}return;}
  const gl=this.gl,l=this.locations;gl.viewport(0,0,c.width,c.height);gl.clearColor(2/255,5/255,5/255,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(this.program);
  let texture=this.textures.get(bitmap);if(!texture){texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);this.textures.set(bitmap,texture);}
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(l.uImage,0);gl.uniform2f(l.uSize,W,H);gl.uniform2f(l.uCenter,x,y);gl.uniform2f(l.uViewport,c.width,c.height);gl.uniform1f(l.uAngle,angle);gl.uniform1f(l.uEye,2*Math.max(c.width,c.height,W));
  const vertices=buffer=>{gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(this.uv);gl.vertexAttribPointer(this.uv,2,gl.FLOAT,false,0,0);};
  gl.uniform1f(l.uAxis,0);vertices(this.quad);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  if(v.angle%360){gl.uniform1f(l.uAxis,1);vertices(this.axis);gl.drawArrays(gl.LINES,0,2);}
 }
}
window.HorroriusRenderer=HorroriusRenderer;
