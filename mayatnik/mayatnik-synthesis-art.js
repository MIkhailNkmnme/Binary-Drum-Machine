/* Deterministic colour and line work from the two-pendulum output. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MayatnikSynthesisArt = api;
})(typeof globalThis === 'object' ? globalThis : this, function() {
  'use strict';

  const palettes = Object.freeze([
    {id:'nocturne', name:'Ноктюрн', ground:'#091221', zero:'#0e1b31', a:'#54c9d1', b:'#e6a45e',
      both:'#ffe0a2', now:'#fff5d5', echo:'#4b65ae', ink:'#f7e6c9', mount:'#0b1728'},
    {id:'ember', name:'Киноварь', ground:'#210e19', zero:'#301422', a:'#ef795e', b:'#b67bdd',
      both:'#ffb574', now:'#fff0b3', echo:'#873c67', ink:'#fce0bf', mount:'#1a101b'},
    {id:'vellum', name:'Пергамент', ground:'#eae0c7', zero:'#e2d4b8', a:'#205f69', b:'#a64431',
      both:'#5d3934', now:'#263647', echo:'#98875d', ink:'#352d2e', mount:'#f5eed9'},
    {id:'polar', name:'Полярная ночь', ground:'#061b23', zero:'#0b2731', a:'#42c5be', b:'#849ee8',
      both:'#c5edc8', now:'#f4ffe1', echo:'#346386', ink:'#dcf2e9', mount:'#081e25'},
    {id:'orchid', name:'Ультрамарин', ground:'#141329', zero:'#211c36', a:'#a59af8', b:'#e6819e',
      both:'#f5b6cd', now:'#fff0cf', echo:'#65588f', ink:'#f6dddb', mount:'#19172d'}
  ].map(Object.freeze));
  const styles = Object.freeze([
    {id:'bits', name:'Биты'}, {id:'weave', name:'Ткачество'}, {id:'strokes', name:'Мазки'}
  ].map(Object.freeze));
  const LIMIT = 4096;
  const FONT = 'Georgia, Times New Roman, serif';
  const MONO = 'Consolas, Courier New, monospace';
  const escapeXML = s => String(s).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\ud800-\udfff\ufffe\uffff]/gu,'\ufffd')
    .replace(/[<>&"']/g,c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
  const round = n => Math.round(n * 100) / 100;
  const rgb = hex => [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
  function mix(a,b,t) {
    const end = rgb(b);
    return '#' + rgb(a).map((n,i) => Math.round(n+(end[i]-n)*t).toString(16).padStart(2,'0')).join('');
  }

  function prepare(frame, options) {
    const {width,height,output} = frame;
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
        width < 1 || height < 1 || width > 2048 || height > 512 || output?.length !== width*height)
      throw new RangeError('Неверный размер кадра Синтеза');
    const palette = palettes.find(p => p.id === options.palette) || palettes[0];
    const style = styles.find(s => s.id === options.style) || styles[0];
    const title = String(options.title || '').slice(0,128);
    const margin = options.poster ? Math.max(2,Math.round(Math.min(width,height)*.1)) : 0;
    const footer = options.poster ? Math.max(margin,Math.round(width*.047)) : 0;
    const printWidth = width + margin*2;
    const printHeight = height + margin*2 + footer;
    const maxScale = Math.max(1,Math.floor(Math.min(LIMIT/printWidth,LIMIT/printHeight,
      Math.sqrt(8_388_608/(printWidth*printHeight)))));
    const scale = Number.isFinite(options.scale) ? Math.max(1,Math.min(maxScale,Math.floor(options.scale))) : 1;
    return {width,height,printWidth,printHeight,scale,margin,footer,palette,style:style.id,title,
      transparent:Boolean(options.transparent),poster:Boolean(options.poster),
      signature:'МАЯТНИКОВЫЙ АТЛАС  /  ' + width + ' × ' + height + '  /  t' + (Number.isSafeInteger(frame.tick) ? frame.tick : 0)};
  }

  function colours(palette) {
    const colours = [palette.zero];
    for (const hue of [palette.a,palette.b,palette.both,palette.echo]) {
      colours.push(mix(palette.ground,hue,.42),hue,mix(hue,palette.now,.57));
    }
    for (const strength of [.64,.47,.32,.23]) colours.push(mix(palette.ground,palette.echo,strength));
    return colours;
  }

  function tint(frame, i) {
    const age = frame.age?.[i] || 0;
    if (age) return 13 + Math.min(3,Math.floor(Math.log2(age)));
    const mask = Number(frame.a?.[i] === 1) + 2*Number(frame.b?.[i] === 1);
    const base = mask ? mask-1 : 3;
    return 2 + 3*base + Number(frame.changed?.[i] === 1);
  }

  function bitRuns(frame, {width,height}, rect) {
    for (let y = 0; y < height; y++) {
      let last = -1, start = 0;
      for (let x = 0; x <= width; x++) {
        const i = y*width+x;
        const bit = x < width ? frame.output[i] : -1;
        const fill = bit === 1 ? tint(frame,i) : bit === 0 ? 0 : -1;
        if (fill !== last) {
          if (last >= 0) rect(last,start,y,x-start);
          start = x;
          last = fill;
        }
      }
    }
  }

  function texture(frame, {width,height,style}, add) {
    const weave = style === 'weave';
    const stride = Math.max(1,Math.ceil(Math.sqrt(width*height/130_000)));
    const time = (frame.tick || 0) % 128;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y*width+x;
      if (frame.output[i] !== 1) continue;
      const seed = Math.imul(i+1,0x9e3779b1) ^ Math.imul(i^time,0x3cb97e39);
      if ((seed >>> 0) % (stride*stride)) continue;
      const noise = ((seed >>> 12) & 255) / 255;
      const col = tint(frame,i), warm = frame.b?.[i] === 1;
      if (weave) {
        const over = (x+y)%2 === 0, run = over ? .76 : .54;
        const angle = warm !== over ? .68 : -.68;
        const dx = Math.cos(angle)*run, dy = Math.sin(angle)*run;
        add(col,0,x+.5-dx,y+.5-dy,x+.5,y+.5,x+.5+dx,y+.5+dy);
        if (over && noise > .65)
          add(col,1,x+.48-dx*.51,y+.31-dy*.51,x+.48,y+.31,x+.48+dx*.51,y+.31+dy*.51);
      } else {
        // The curve through each occupied cell follows a pair of counter-rotating flows.
        const cx = width*(warm ? .64 : .36), cy = height*(warm ? .61 : .42);
        const angle = Math.atan2((y-cy)*1.6,x-cx) + (warm ? 1.9 : 1.27) +
          .82*Math.sin(x*.072-y*.09+time*.051);
        const reach = .6 + 1.04*noise;
        const dx = Math.cos(angle)*reach, dy = Math.sin(angle)*reach;
        const twist = (noise-.5)*.88;
        add(col,0,x+.5-dx,y+.5-dy,x+.5-dy*twist,y+.5+dx*twist,x+.5+dx,y+.5+dy);
        if (noise > .5)
          add(col,1,x+.48-dx*.57,y+.24-dy*.57,x+.48,y+.24,x+.48+dx*.57,y+.24+dy*.57);
      }
    }
  }

  function brush(c, accent) {
    const highlight = accent ? (c < 13 ? .38 : .14) : 0;
    return {width:accent ? .13 : c < 13 ? .61 : .49, highlight};
  }

  function render(canvas, frame, options = {}) {
    const p = prepare(frame,options), {scale,printWidth,printHeight,margin,width,height,palette,title,poster} = p;
    const pixelWidth = printWidth*scale, pixelHeight = printHeight*scale;
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Браузер не может рисовать на холсте');
    ctx.save();
    ctx.setTransform(scale,0,0,scale,0,0);
    ctx.clearRect(0,0,printWidth,printHeight);
    if (poster) {
      ctx.fillStyle = palette.mount;
      ctx.fillRect(0,0,printWidth,printHeight);
    }
    const swatches = colours(palette);
    ctx.save();
    ctx.translate(margin,margin);
    if (!p.transparent || poster) {
      ctx.fillStyle = palette.ground;
      ctx.fillRect(0,0,width,height);
    }
    if (p.style === 'bits') {
      bitRuns(frame,p,(c,x,y,w) => {ctx.fillStyle = swatches[c];ctx.fillRect(x,y,w,1);});
    } else {
      ctx.beginPath();
      ctx.rect(0,0,width,height);
      ctx.clip();
      const paths = swatches.map(() => [new Path2D(),new Path2D()]);
      texture(frame,p,(c,s,x,y,mx,my,ex,ey) => {
        paths[c][s].moveTo(x,y);
        paths[c][s].quadraticCurveTo(mx,my,ex,ey);
      });
      ctx.lineCap = 'round';
      for (let s = 0; s < 2; s++) for (let c = 1; c < swatches.length; c++) {
        const b = brush(c,s);
        ctx.lineWidth = b.width;
        ctx.strokeStyle = s ? mix(swatches[c],palette.now,b.highlight) : swatches[c];
        ctx.stroke(paths[c][s]);
      }
    }
    ctx.restore();
    if (poster) {
      ctx.fillStyle = palette.ink;
      const baseline = height+margin*2;
      ctx.font = width*.043 + 'px ' + FONT;
      ctx.fillText(title,margin,baseline,width*.69);
      ctx.font = width*.022 + 'px ' + MONO;
      ctx.fillText(p.signature,margin,baseline+p.footer*.66,width);
    }
    ctx.restore();
    return canvas;
  }

  function svg(frame, options = {}) {
    const p = prepare(frame,options), {scale,printWidth,printHeight,margin,width,height,palette,title,poster} = p;
    const swatches = colours(palette);
    const marks = [];
    if (!p.transparent || poster) marks.push('<rect width="'+width+'" height="'+height+'" fill="'+palette.ground+'"/>');
    if (p.style === 'bits') {
      const paths = swatches.map(() => []);
      bitRuns(frame,p,(c,x,y,w) => paths[c].push('M'+x+' '+y+'h'+w+'v1h-'+w+'z'));
      for (let c = 0; c < paths.length; c++) if (paths[c].length)
        marks.push('<path fill="'+swatches[c]+'" shape-rendering="crispEdges" d="'+paths[c].join('')+'"/>');
    } else {
      const paths = swatches.map(() => [[],[]]);
      texture(frame,p,(c,s,x,y,mx,my,ex,ey) => {
        paths[c][s].push('M'+round(x)+' '+round(y)+'Q'+round(mx)+' '+round(my)+' '+round(ex)+' '+round(ey));
      });
      for (let s = 0; s < 2; s++) for (let c = 1; c < swatches.length; c++) if (paths[c][s].length) {
        const b = brush(c,s), stroke = s ? mix(swatches[c],palette.now,b.highlight) : swatches[c];
        marks.push('<path fill="none" stroke="'+stroke+'" stroke-linecap="round" stroke-width="'+b.width+
          '" d="'+paths[c][s].join('')+'"/>');
      }
    }
    let output = '<svg xmlns="http://www.w3.org/2000/svg" width="'+printWidth*scale+'" height="'+printHeight*scale+
      '" viewBox="0 0 '+printWidth+' '+printHeight+'" role="img"><title>'+escapeXML(title || 'Маятник · Синтез')+
      '</title><desc>'+escapeXML(p.signature)+'</desc>';
    if (frame.options) {
      const metadata = {width,height,anchor:frame.anchor,tick:frame.tick,recipe:options.recipe,
        options:frame.options,palette:palette.id,style:p.style};
      output += '<metadata>'+escapeXML(JSON.stringify(metadata))+'</metadata>';
    }
    if (poster) output += '<rect width="100%" height="100%" fill="'+palette.mount+'"/>';
    output += '<svg x="'+margin+'" y="'+margin+'" width="'+width+'" height="'+height+'" overflow="hidden">'+marks.join('')+'</svg>';
    if (poster) {
      const baseline = height+margin*2;
      output += '<g fill="'+palette.ink+'"><text x="'+margin+'" y="'+baseline+'" font-family="'+FONT+
        '" font-size="'+round(width*.043)+'">'+escapeXML(title)+'</text><text x="'+margin+'" y="'+round(baseline+p.footer*.66)+
        '" font-family="'+MONO+'" font-size="'+round(width*.022)+'">'+escapeXML(p.signature)+'</text></g>';
    }
    return output+'</svg>';
  }

  return Object.freeze({palettes,styles,render,svg});
});
