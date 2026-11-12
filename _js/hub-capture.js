/* Compose the live XOR scene and shared canvas overlays for recording. */
(() => {
  'use strict';
  function compare(g,width,height){
    const root=document.getElementById('hubXorBackground');
    if(!root||getComputedStyle(root).visibility==='hidden')return false;
    const viewport=root.getBoundingClientRect();
    if(!viewport.width||!viewport.height)return false;
    const scale=Math.min(width/viewport.width,height/viewport.height);
    g.save();
    g.translate((width-viewport.width*scale)/2,(height-viewport.height*scale)/2);
    g.scale(scale,scale);
    g.beginPath();g.rect(0,0,viewport.width,viewport.height);g.clip();
    g.translate(-viewport.left,-viewport.top);
    g.imageSmoothingEnabled=false;
    let drawn=false;
    for(const pane of root.querySelectorAll('.hubXorPane')){
      const canvas=pane.querySelector('canvas');
      const p=pane.getBoundingClientRect(),r=canvas.getBoundingClientRect();
      if(!p.width||!p.height||!r.width||!r.height||!canvas.width||!canvas.height)continue;
      const style=getComputedStyle(canvas);
      if(style.visibility==='hidden'||style.display==='none')continue;
      const fit=Math.min(r.width/canvas.width,r.height/canvas.height);
      const w=canvas.width*fit,h=canvas.height*fit;
      const [alignX,alignY]=style.objectPosition.split(/\s+/);
      const align=v=>({left:0,top:0,right:1,bottom:1,center:.5})[v]??(v?.endsWith('%')?parseFloat(v)/100:.5);
      const flipY=style.transform!=='none'&&new DOMMatrixReadOnly(style.transform).d<0;
      const x=r.left+(r.width-w)*align(alignX),y=r.top+(r.height-h)*(flipY?1-align(alignY):align(alignY));
      g.save();
      g.beginPath();
      if(pane.classList.contains('hubXorSplit')){
        const down=pane.classList.contains('hubXorDown');
        const edge=down?p.top:p.bottom;
        g.moveTo(p.left,edge);g.lineTo(p.right,edge);
        g.lineTo(p.left+p.width/2,down?p.bottom:p.top);g.closePath();
      }else g.rect(p.left,p.top,p.width,p.height);
      g.clip();
      g.globalAlpha=Number(getComputedStyle(pane).opacity)*Number(style.opacity);
      g.translate(x,flipY?y+h:y);if(flipY)g.scale(1,-1);
      g.drawImage(canvas,0,0,w,h);
      drawn=true;
      g.restore();
    }
    if(drawn)window.HubCapture.overlays(g);
    g.restore();
    return drawn;
  }
  window.HubCapture={compare,overlays(g,scale=1,left=0,top=0){
    g.save();g.translate(left,top);g.scale(scale,scale);
    // These canvases are fixed at viewport (0,0); marker transforms include their position.
    for(const node of document.querySelectorAll('#hubFlow,.hubCenterBit')){
      const style=getComputedStyle(node);
      if(node.hidden||!node.width||!node.height||style.display==='none'||style.visibility==='hidden')continue;
      g.save();g.globalAlpha=Number(style.opacity);g.shadowBlur=0;
      if(style.transform!=='none'){
        const m=new DOMMatrix(style.transform);g.transform(m.a,m.b,m.c,m.d,m.e,m.f);
      }
      g.imageSmoothingEnabled=!node.matches('#hubFlow');
      g.drawImage(node,0,0,parseFloat(style.width)||node.width,parseFloat(style.height)||node.height);
      g.restore();
    }
    g.restore();
  }};
})();
