/* Offline XLSX export of the slicing event log. Exact fractions remain text;
   adjacent numeric cells let Excel filter and sort by value. */
(() => {
  "use strict";
  const Q = ZZExact.from;
  const xml = value => String(value).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const column = index => { let text = ""; for (let n=index+1;n;n=Math.floor((n-1)/26)) text=String.fromCharCode(65+(n-1)%26)+text; return text; };
  function numeric(q){
    if (!q.sign()) return 0;
    const n=q.n.toString().replace("-",""), d=q.d.toString(), size=15;
    const value=q.sign()*Number(n.slice(0,size))/Number(d.slice(0,size))*10**(Math.max(0,n.length-size)-Math.max(0,d.length-size));
    return Number.isFinite(value) && value !== 0 ? value : null;
  }
  function fraction(value,angle=false,absolute=false){
    if (value === undefined || value === null) return [null,null];
    let q=Q(value); if (absolute) q=q.add(Q(1,4)).mod(); if (angle) q=q.mul(360);
    return [numeric(q),q.text()];
  }
  function eventSheet(run){
    const headers=["Событие","Кольцо","Вырез","Попадание","Результат","Части до","Части после","Изменение частей","Причина","Кольцо источника","Вырез источника","Путь вырезов","Зеркало"];
    const fields=[
      ["Время, об. К1",r=>fraction(r.at)],
      ["Вырез в кольце, градусы",r=>fraction(r.angle,true,true)],
      ["Встреча, градусы",r=>fraction(r.meetingRay ?? r.worldAngle,true,true)],
      ["Предыдущее направление, градусы",r=>fraction(r.previousRay,true,true)],
      ["Поворот источника, градусы",r=>fraction(r.sourceTravel,true)],
      ["Отражение, градусы",r=>fraction(r.reflection,true)],
      ["Луч после, градусы",r=>fraction(r.outgoingRay,true,true)],
      ...Array.from({length:run.count},(_,i)=>["Скорость К"+(i+1)+", градусы/с",r=>fraction(r.speeds?.[i])])
    ];
    for (const [name] of fields) headers.push(name,name+" (точно)");
    const rows=run.records.map(r=>{
      const fresh=r.newCut ?? (r.hit || 1)===1;
      const row=[r.event ?? null,r.ring,r.number ?? null,r.hit || 1,
        r.result || (r.ring===1 && r.at==="0" ? "Старт" : fresh ? "Новый вырез" : "Повтор"),
        r.partsBefore ?? null,r.partsAfter ?? null,r.partsBefore===undefined || r.partsAfter===undefined ? null : r.partsAfter-r.partsBefore,
        r.cause ?? null,r.sourceRing===undefined ? null : r.sourceRing+1,r.sourceCut ?? null,
        (r.sources || []).map(s=>"К"+(s.k+1)+" №"+s.number).join(" → ") || (r.ring===1 ? "Центр" : null),
        r.mirror===undefined ? null : r.mirror ? "Вкл." : "Выкл."];
      for (const [,read] of fields) row.push(...read(r));
      return row;
    });
    return {name:run.name,rows:[headers,...rows],filter:true};
  }
  const ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  function worksheet(sheet){
    const {rows}=sheet, width=rows[0].length;
    if (rows.length>1048576 || width>16384) throw new Error("История превышает размер одного листа Excel.");
    const range="A1:"+column(width-1)+rows.length;
    const cols=rows[0].map((name,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+(i<4 ? 12 : String(name).includes("Путь") ? 42 : 25)+'" customWidth="1"/>').join("");
    const data=rows.map((row,r)=>'<row r="'+(r+1)+'"'+(!r?' ht="46" customHeight="1"':"")+'>'+row.map((value,c)=>{
      if (value===null || value===undefined) return "";
      const ref=column(c)+(r+1);
      if (typeof value==="number" && Number.isFinite(value)) return '<c r="'+ref+'" s="'+(Number.isInteger(value)?0:2)+'"><v>'+value+'</v></c>';
      const text=String(value); if (text.length>32767) throw new Error("Точная дробь слишком длинная для ячейки Excel (более 32767 символов).");
      return '<c r="'+ref+'" s="'+(!r?1:0)+'" t="inlineStr"><is><t xml:space="preserve">'+xml(text)+'</t></is></c>';
    }).join("")+'</row>').join("");
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="'+ns+'"><dimension ref="'+range+'"/>'
      +'<sheetViews><sheetView workbookViewId="0"><pane xSplit="3" ySplit="1" topLeftCell="D2" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="D2" sqref="D2"/></sheetView></sheetViews>'
      +'<sheetFormatPr defaultRowHeight="18"/><cols>'+cols+'</cols><sheetData>'+data+'</sheetData>'
      +(sheet.filter?'<autoFilter ref="'+range+'"/>':"")+'</worksheet>';
  }
  // Stored ZIP entries keep this export self-contained, including file:// use.
  const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++) n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
  function zip(files){
    const enc=new TextEncoder(), parts=[], central=[]; let offset=0, centralSize=0;
    for (const [path,source] of files) {
      const name=enc.encode(path), data=enc.encode(source); let crc=0xffffffff;
      for (const byte of data) crc=crcTable[(crc^byte)&255]^(crc>>>8); crc=(crc^0xffffffff)>>>0;
      const local=new Uint8Array(30+name.length), l=new DataView(local.buffer);
      l.setUint32(0,0x04034b50,true); l.setUint16(4,20,true); l.setUint16(6,0x800,true); l.setUint16(12,33,true);
      l.setUint32(14,crc,true); l.setUint32(18,data.length,true); l.setUint32(22,data.length,true); l.setUint16(26,name.length,true); local.set(name,30);
      const dir=new Uint8Array(46+name.length), d=new DataView(dir.buffer);
      d.setUint32(0,0x02014b50,true); d.setUint16(4,20,true); d.setUint16(6,20,true); d.setUint16(8,0x800,true); d.setUint16(14,33,true);
      d.setUint32(16,crc,true); d.setUint32(20,data.length,true); d.setUint32(24,data.length,true); d.setUint16(28,name.length,true); d.setUint32(42,offset,true); dir.set(name,46);
      parts.push(local,data); central.push(dir); offset+=local.length+data.length; centralSize+=dir.length;
      if (offset+centralSize>0xffffffff) throw new Error("История слишком велика для выгрузки одним файлом.");
    }
    const end=new Uint8Array(22), e=new DataView(end.buffer);
    e.setUint32(0,0x06054b50,true); e.setUint16(8,files.length,true); e.setUint16(10,files.length,true); e.setUint32(12,centralSize,true); e.setUint32(16,offset,true);
    return new Blob([...parts,...central,end],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  }
  function workbook(sheets){
    const rel="http://schemas.openxmlformats.org/officeDocument/2006/relationships/";
    const relationships=items=>'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+items+'</Relationships>';
    const files=[
      ["[Content_Types].xml",'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("")+'</Types>'],
      ["_rels/.rels",relationships('<Relationship Id="rId1" Type="'+rel+'officeDocument" Target="xl/workbook.xml"/>')],
      ["xl/workbook.xml",'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="'+ns+'" xmlns:r="'+rel.slice(0,-1)+'"><bookViews><workbookView/></bookViews><sheets>'+sheets.map((s,i)=>'<sheet name="'+xml(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join("")+'</sheets></workbook>'],
      ["xl/_rels/workbook.xml.rels",relationships(sheets.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="'+rel+'worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join("")+'<Relationship Id="rIdStyles" Type="'+rel+'styles" Target="styles.xml"/>')],
      ["xl/styles.xml",'<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="'+ns+'"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.###############"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF25394B"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
      ...sheets.map((s,i)=>["xl/worksheets/sheet"+(i+1)+".xml",worksheet(s)])
    ];
    return zip(files);
  }
  window.zzSliceExportExcel = () => {
    const runs=window.zzBallSliceExportData?.() || [];
    if (!runs.some(run=>run.records.length)) throw new Error("Сначала запусти нарезку: пока нет событий для Excel.");
    const sheets=runs.map(eventSheet);
    sheets.push({name:"Описание",filter:false,rows:[
      ["Поле","Пояснение"],
      ["Источник","Zazerkalius: история текущего опыта Нарезки"],
      ["Выгружено",new Date().toISOString()],
      ["Сортировка","Столбцы без пометки (точно) содержат числа; используйте фильтры в заголовках."],
      ["Точные дроби","Столбцы (точно) содержат исходные дроби текстом и сохраняют все цифры."],
      ["Точность Excel","Числовые столбцы приближённые: близкие дроби могут стать равными в точности Excel. Для точного сравнения сохраняются дроби рядом."],
      ["Пустые ячейки","Данные не записаны, не применимы либо число вне диапазона Excel; это не ноль."],
      ["Время","Обороты К1 от запуска опыта."],
      ["Углы","0° сверху, по часовой. Поворот источника и отражение сохраняют знак и полные обороты."],
      ["Скорости","Градусы в секунду на момент события: плюс по часовой, минус против часовой."],
      ["Части","Число секторов до и после попадания. Первый разрез ещё не увеличивает число частей."],
      ["Снимок","Файл содержит события на момент нажатия Excel и не обновляется автоматически."]
    ]});
    const blob=workbook(sheets), url=URL.createObjectURL(blob), link=document.createElement("a");
    const stamp=new Date().toISOString().replace(/[:.]/g,"-");
    link.href=url; link.download="Zazerkalius-narezka-"+stamp+".xlsx"; document.body.append(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    return runs.reduce((sum,run)=>sum+run.records.length,0);
  };
  document.addEventListener("click",event=>{
    if (!event.target.closest?.("#bSliceExcel")) return;
    try { const count=window.zzSliceExportExcel(); if(typeof say==="function") say("Excel: выгружено событий — "+count+". Фильтры включены, точные дроби сохранены."); }
    catch(error){ (typeof say==="function"?say:alert)("Excel: "+error.message); }
  });
})();
