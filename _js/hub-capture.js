/* Shared foreground composition for PNG and every video frame. */
(() => {
  'use strict';
  window.HubCapture={overlays(g,scale=1,left=0,top=0){
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
