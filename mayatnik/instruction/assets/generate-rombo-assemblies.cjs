/* Rebuild the instruction atlas from the exact production source plan. */
const fs=require('node:fs'),path=require('node:path'),R=require('../../mayatnik-rombo.js'),P=require('../../mayatnik-rombo-preview.js');
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const cols=4,cardWidth=245,cardHeight=205,gap=12,width=1040,height=135+Math.ceil(R.variants.length/cols)*(cardHeight+gap)+30;
const out=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`,
`<title id="title">Ромбо: ${R.variants.length} сборок</title>`,
'<desc id="desc">Схемы построены из реальных исходных областей поля. C — центральный треугольник, L и R — внешние боковые треугольники Перескока. Номера показывают порядок вариантов; внутренние ID не совпадают с номерами. Отдельные варианты — поворот C на 180 градусов вниз и диагональный перенос четвертей 1↔3, 2↔4 без вращения каждой четверти.</desc>',
'<style>text{font-family:Arial,sans-serif;fill:#dfe6f5}.title{font-size:26px;font-weight:700}.note{font-size:15px}.card{fill:#10151d;stroke:#40516b}.head{font-size:15px;font-weight:700}.part{font-family:Arial,sans-serif;font-weight:700;fill:#10151d}</style>',
`<rect width="${width}" height="${height}" fill="#080b10"/>`,
`<text class="title" x="20" y="38">Ромбо · ${R.variants.length} сборок</text>`,
'<text class="note" x="20" y="67">C — центральная область; L/R — внешние боковые области Перескока; ↔ — отражение.</text>',
'<text class="note" x="20" y="90">Четверти: сверху 1, 2; снизу 4, 3. Перенос 1↔3 и 2↔4 сохраняет ориентацию каждой.</text>',
'<text class="note" x="20" y="113">Ось и общий поворот задаются отдельно. Номера обозначают порядок сборок в таблице.</text>'];
R.variants.forEach((v,index)=>{const plan=R.plan(81,40,{row:40,angle:0,assembly:v.id},{anchor:40,sides:true}),g=P.geometry(plan),x=15+index%cols*(cardWidth+gap),y=135+Math.floor(index/cols)*(cardHeight+gap);
 out.push(`<g id="assembly-${v.id}" transform="translate(${x} ${y})"><rect class="card" width="${cardWidth}" height="${cardHeight}"/><text class="head" x="10" y="25">${index+1} · ${esc(v.label)}</text><svg x="35" y="37" width="175" height="160" viewBox="${g.viewBox.join(' ')}">`);
 for(const part of g.parts){const cx=part.points.reduce((s,p)=>s+p.x,0)/part.points.length,cy=part.points.reduce((s,p)=>s+p.y,0)/part.points.length,label=part.quadrant?String(part.quadrant):part.sourceKey+(/↔/.test(part.label)?'↔':'');out.push(`<polygon points="${part.points.map(p=>p.x+','+p.y).join(' ')}" fill="${part.color}" stroke="#080b10" stroke-width="${g.fontSize*.045}"/><text class="part" x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="${g.fontSize}">${esc(label)}</text>`);}
 const axis=plan.axis.map(p=>R.point(plan.rotation,p));out.push(`<path d="M${axis[0].x} ${axis[0].y}L${axis[1].x} ${axis[1].y}" fill="none" stroke="#fff4b5" stroke-width="${g.fontSize*.05}" stroke-dasharray="${g.fontSize*.18} ${g.fontSize*.12}"/></svg></g>`);
});
out.push('</svg>');fs.writeFileSync(path.join(__dirname,'rombo-assemblies.svg'),out.join('\n')+'\n');
