"""Russian-only print edition of the user's PDF; no book code is executed.

Dependencies: pymupdf, reportlab. Run with Python 3. Fonts default to Windows.
All figures are clipped from the source PDF, never regenerated from its code.
"""
from pathlib import Path
import argparse, html, json, re, sys, hashlib, unicodedata
import pymupdf as fitz
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak, Image, Table, TableStyle, Flowable

sys.stdout.reconfigure(encoding='utf-8')
HERE=Path(__file__).resolve().parent
P=argparse.ArgumentParser()
P.add_argument('--source',type=Path,default=HERE.parent.parent/'nks-ch2.pdf')
P.add_argument('--translations',type=Path,default=HERE/'translations')
P.add_argument('--output',type=Path,default=HERE.parent/'Вольфрам - Глава 2 - Для печати на русском.pdf')
P.add_argument('--fonts',type=Path,default=Path('C:/Windows/Fonts'))
ARGS=P.parse_args()
FIG=HERE/'figures';FIG.mkdir(exist_ok=True)
for name,file in [('RU','arial.ttf'),('RUB','arialbd.ttf'),('Code','consola.ttf'),('Symbols','seguisym.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(ARGS.fonts/file)))
pdfmetrics.registerFontFamily('RU',normal='RU',bold='RUB',italic='RU',boldItalic='RUB')
WIDTH,HEIGHT=A4; MARGIN=42.52; BODY_W=WIDTH-2*MARGIN
STYLES={
 'paragraph':ParagraphStyle('p',fontName='RU',fontSize=10.7,leading=14.6,spaceAfter=8.3,allowWidows=0,allowOrphans=0),
 'caption':ParagraphStyle('caption',fontName='RU',fontSize=9.2,leading=12.1,spaceAfter=10),
 'labels':ParagraphStyle('labels',fontName='RU',fontSize=8.7,leading=11.4,spaceAfter=9),
 'heading':ParagraphStyle('h',fontName='RUB',fontSize=14.5,leading=18.7,spaceBefore=10,spaceAfter=12,keepWithNext=True),
 'code':ParagraphStyle('code',fontName='Code',fontSize=8.2,leading=11.2,spaceBefore=3,spaceAfter=10,splitLongWords=True),
 'title':ParagraphStyle('title',fontName='RUB',fontSize=26,leading=33,spaceAfter=18),
 'tile':ParagraphStyle('tile',fontName='RU',fontSize=7.8,leading=10.1,alignment=1,spaceAfter=5),
}
STYLES['formula']=STYLES['code']

def markup(text,font='RU'):
    text=unicodedata.normalize('NFC',text).replace('\u00ad','').replace('\u2011','-').replace('\u2010','-')
    glyphs=pdfmetrics.getFont(font).face.charToGlyph;fallback=pdfmetrics.getFont('Symbols').face.charToGlyph
    out=[]
    for ch in text:
        if ch=='\n':out.append('<br/>')
        elif ch.isspace() or ord(ch) in glyphs:out.append(html.escape(ch))
        elif ord(ch) in fallback:out.append('<font face="Symbols">'+html.escape(ch)+'</font>')
        else:raise ValueError('Unavailable glyph '+repr(ch))
    return ''.join(out)

def para(text,kind='paragraph'):
    st=STYLES.get(kind,STYLES['paragraph']);s=markup(text,st.fontName)
    if kind in ('code','formula'):s=s.replace('  ','&nbsp;&nbsp;')
    return Paragraph(s,st)

def actual(k):return k if k<=50 else k+814

# Each entry: id, source key, clip in PDF points (top-left origin), width in print points.
# All locations were read from the supplied pages. No original full page is embedded.
SPECS=[
 ('chapter-vignette',23,[82,0,185,122],82),
 ('steps-separate',24,[58,122,126,265],105),('steps-combined',24,[273,148,478,235],335),('rule-254',24,[168,384,362,405],310),
 ('rule-250-pattern',25,[82,81,292,184],330),('rule-250',25,[304,89,455,107],290),
 ('rule-90-pattern',25,[82,311,502,520],BODY_W),('rule-90',25,[82,537,233,555],290),
 ('rule-90-large',26,[60,261,478,472],BODY_W),
 ('rule-30-pattern',27,[82,229,483,429],BODY_W),('rule-30',27,[82,444,234,461],290),
 ('rule-30-500',29,[84,82,503,558],BODY_W),('rule-30-1500',30,[59,82,478,558],BODY_W),
 ('rule-110-pattern',32,[60,81,479,491],BODY_W),('rule-110',32,[60,512,213,530],290),
 ('rule-110-33',33,[84,82,503,600],BODY_W),('rule-110-34',34,[58,83,477,601],BODY_W),
 ('rule-110-35',35,[89,83,507,601],BODY_W),('rule-110-36',36,[54,83,473,601],BODY_W),
 ('rule-110-37',37,[89,83,507,601],BODY_W),('rule-110-38',38,[62,83,477,601],BODY_W),
 ('ca-program-output',51,[91,549,179,593],220),
 ('example-2',54,[76,221,144,256],205),('example-4',54,[76,330,127,365],155),
 ('example-5',54,[76,400,145,435],205),('example-6',54,[76,470,164,505],260),
 ('example-9',54,[293,101,429,137],400),('example-10',54,[293,166,345,201],155),
 ('example-11',54,[293,230,363,266],210),('example-12',54,[293,302,363,338],210),
 ('example-13',54,[280,380,474,418],BODY_W),
 ('cantor-mappings',55,[297,418,502,562],425),
 ('rule-90-alternate-initial',56,[59,540,263,591],BODY_W),
 ('rule-90-k-colors',56,[275,300,478,378],435),('integer-functions',56,[275,498,479,552],BODY_W),
 ('bitwise-squares',57,[81,172,287,241],BODY_W),('bitwise-surfaces',57,[81,246,287,318],BODY_W),
 ('munching-squares',57,[81,359,287,411],BODY_W),('bitwise-curves',57,[81,451,287,485],BODY_W),
 ('rule-30-boundary',57,[297,187,501,232],BODY_W),('rule-30-column',57,[296,400,502,493],BODY_W),
 ('labyrinths',59,[81,354,286,391],BODY_W),('celtic-circles',59,[81,540,287,584],BODY_W),
 ('roman-circles',59,[297,177,502,223],BODY_W),('cosmati-nesting',60,[58,106,263,145],BODY_W),
 ('kufic-calligraphy',60,[58,229,263,292],BODY_W),('rope-nesting',60,[274,525,479,594],BODY_W),
 ('publication-chart',64,[274,252,478,296],BODY_W),('code-10-small',68,[274,275,479,330],BODY_W),
 ('code-10-large',68,[276,335,479,458],BODY_W),
]
# Artwork tiles on page 43 have independent Russian labels, preserving visual order.
for row in range(4):
    for col in range(4):
        x=84.96+106.134*col;y=103.08+113.082*row
        SPECS.append((f'ornament-{row*4+col+1:02}',43,[x-.6,y-.6,x+96.6,y+96.6],113))

source=fitz.open(ARGS.source)
manifest=[]
english_removed=[]
def make_figure(spec):
    name,key,box,width=spec;clip=fitz.Rect(box)
    copy=fitz.open();copy.insert_pdf(source,from_page=key-22,to_page=key-22)
    page=copy[0];changes=[]
    for b in page.get_text('dict')['blocks']:
        if b['type']!=0:continue
        for line in b['lines']:
            rect=fitz.Rect(line['bbox'])
            if not rect.intersects(clip):continue
            text=''.join(s['text'] for s in line['spans']).strip()
            # Numerical ticks, mathematical variables, and function identifiers stay intact.
            m=re.fullmatch(r'(step|rule)\s*(\d+)\s*(:?)',text,re.I)
            if m:
                replacement=('шаг' if m[1].lower()=='step' else 'правило')+' '+m[2]+m[3]
                page.add_redact_annot(rect,fill=(1,1,1));changes.append((rect,replacement,text))
            elif re.search(r'\b[A-Za-z]{3,}\b',text) and not re.search(r'BitAnd|BitOr|BitXor|Binomial|Multinomial|StirlingS',text):
                page.add_redact_annot(rect,fill=(1,1,1));english_removed.append({'figure':name,'text':text})
    page.apply_redactions(images=0,graphics=0)
    if changes:
        page.insert_font(fontname='RULabel',fontfile=str(ARGS.fonts/'arial.ttf'))
        for rect,replacement,old in changes:
            size=4.0 if 'правило' in replacement else 4.7
            page.insert_text((rect.x0,rect.y1-.5),replacement,fontname='RULabel',fontsize=size,color=(0,0,0))
    path=FIG/(name+'.png')
    page.get_pixmap(dpi=360,clip=clip,colorspace=fitz.csGRAY,alpha=False).save(path)
    manifest.append({'id':name,'book_page':actual(key),'source_key':key,'source_pdf_page':key-21,
                     'clip_points':box,'file':str(path.relative_to(HERE)),'print_width_points':width,
                     'render_dpi':360,'colorspace':'gray','translated_labels':[{'original':v[2],'russian':v[1]} for v in changes],
                     'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    copy.close()

for spec in SPECS:make_figure(spec)
spec_lookup={s[0]:s for s in SPECS}
def pic(name):
    spec=spec_lookup[name];box=spec[2];w=spec[3];h=w*(box[3]-box[1])/(box[2]-box[0])
    if h>635:w*=635/h;h=635
    result=Image(str(FIG/(name+'.png')),width=w,height=h)
    result.hAlign='CENTER';result.spaceBefore=7;result.spaceAfter=10
    return result

records=[]
for filename in ['ru-23-37.json','ru-38-52.json','ru-53-68.json']:
    records.extend(json.loads((ARGS.translations/filename).read_text(encoding='utf-8')))
records.sort(key=lambda r:r['book_page'])
record_map={r['book_page']:r for r in records}

# Ordered content references: integer = exact translated block; string = figure.
ORDERS={
 23:['chapter-vignette',0,1,2,3],
 24:[0,'steps-panel',5,6,8,1,2,'rule-254',7,3,4],
 25:['rule-250-pattern','rule-250',2,0,1,'rule-90-pattern','rule-90',3],
 26:[0,1,'rule-90-large',3,2],27:[0,1,2,'rule-30-pattern','rule-30',4,3],
 29:['rule-30-500',0],30:['rule-30-1500',0],32:['rule-110-pattern','rule-110',0,1],
 33:['rule-110-33'],34:['rule-110-34'],35:['rule-110-35'],36:['rule-110-36'],37:['rule-110-37'],38:['rule-110-38'],
}
AFTER={
 51:{13:['ca-program-output']},
 54:{5:['example-2'],9:['example-4'],11:['example-5'],13:['example-6'],19:['example-9'],21:['example-10'],23:['example-11'],25:['example-12'],27:['example-13']},
 55:{22:['cantor-mappings']},56:{8:['rule-90-alternate-initial'],13:['rule-90-k-colors'],15:['integer-functions']},
 57:{1:['bitwise-squares','bitwise-surfaces'],3:['munching-squares'],4:['bitwise-curves'],7:['rule-30-boundary'],11:['rule-30-column']},
 59:{2:['labyrinths'],4:['celtic-circles'],5:['roman-circles']},
 60:{0:['cosmati-nesting'],1:['kufic-calligraphy'],8:['rope-nesting']},
 64:{3:['publication-chart']},68:{3:['code-10-small','code-10-large']},
}

class SourceMark(Flowable):
    def __init__(self,key):super().__init__();self.key=key;self.width=0;self.height=0
    def draw(self):self.canv.source_key=self.key

page_map=[]
def footer(c,doc):
    key=getattr(c,'source_key',None)
    c.saveState();c.setFillColorRGB(0,0,0)
    if key is not None:
        title='Глава 2 · Решающий эксперимент' if key<=50 else 'Примечания к главе 2'
        c.setFont('RU',8.5);c.drawString(MARGIN,HEIGHT-25,title)
        c.drawRightString(WIDTH-MARGIN,HEIGHT-25,f'Оригинал: с. {actual(key)}')
    c.setFont('RU',8);c.drawString(MARGIN,23,'Стивен Вольфрам · Новый вид науки')
    c.drawRightString(WIDTH-MARGIN,23,str(doc.page))
    c.restoreState()
    page_map.append({'output_page':doc.page,'source_key':key,'original_page':actual(key) if key else None})

story=[SourceMark(None),Spacer(1,65),para('Стивен Вольфрам','heading'),para('Новый вид науки','title'),
       Spacer(1,15),para('Глава 2\nРешающий эксперимент','title'),Spacer(1,25),
       para('Русский перевод для печати','heading'),para('Глава: страницы 23–50 оригинала.\nПримечания: страницы 865–882 оригинала.'),
       para('Включены полный подготовленный перевод и все иллюстрации главы и примечаний. Английские страницы и английские подписи не включены. Программные идентификаторы и математическая запись сохранены. Иллюстрации воспроизведены из предоставленного PDF в оттенках серого.'),
       para('Неофициальный перевод, подготовленный 18 ноября 2026 года. Исторические сведения и оценки переданы от лица автора. Номера исходных страниц указаны вверху каждого листа.'),
       Spacer(1,22),para('Оригинал: Stephen Wolfram, A New Kind of Science. Wolfram Media, 2002.\n© Stephen Wolfram, LLC. Исходный файл предоставлен пользователем.','labels')]
included=[]
for record in records:
    key=record['book_page'];story.extend([PageBreak(),SourceMark(key)])
    if record.get('heading'):story.append(para(record['heading'],'heading'))
    if key==43:
        labels=[v.strip() for line in record['blocks'][0]['text'].split('\n') for v in line.split('·')]
        cells=[]
        for i,label in enumerate(labels):cells.append([pic(f'ornament-{i+1:02}'),para(label,'tile')])
        table=Table([cells[i:i+4] for i in range(0,16,4)],colWidths=[BODY_W/4]*4)
        table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),3),('RIGHTPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),9)]))
        story.extend([table,para(record['blocks'][1]['text'],'caption')]);included.extend([(key,0),(key,1)]);continue
    order=ORDERS.get(key)
    if order is None:
        order=[]
        for i in range(len(record['blocks'])):order.extend([i]+AFTER.get(key,{}).get(i,[]))
    for pos,item in enumerate(order):
        if item=='steps-panel':
            table=Table([[pic('steps-separate'),pic('steps-combined')]],colWidths=[125,365])
            table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'MIDDLE'),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),10)]))
            story.append(table)
        elif isinstance(item,str):story.append(pic(item))
        else:
            block=record['blocks'][item];flow=para(block['text'],block.get('kind','paragraph'))
            if block.get('kind') in ('code','formula') and pos+1<len(order) and isinstance(order[pos+1],str):flow.keepWithNext=True
            if pos+2<len(order) and isinstance(order[pos+1],int) and isinstance(order[pos+2],str) and record['blocks'][order[pos+1]].get('kind')=='code':flow.keepWithNext=True
            story.append(flow);included.append((key,item))
    # Preserve any additional translation blocks in an illustration-only page.
    for i,block in enumerate(record['blocks']):
        if (key,i) not in included:story.append(para(block['text'],block.get('kind','paragraph')));included.append((key,i))

doc=BaseDocTemplate(str(ARGS.output),pagesize=A4,leftMargin=MARGIN,rightMargin=MARGIN,topMargin=44,bottomMargin=41,
                      title='Новый вид науки. Глава 2. Решающий эксперимент — русский перевод',author='Стивен Вольфрам',
                      pageCompression=1)
frame=Frame(MARGIN,41,BODY_W,HEIGHT-85,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)
doc.addPageTemplates(PageTemplate(id='Russian',frames=[frame],onPageEnd=footer))
doc.build(story)
manifest_data={'source':str(ARGS.source),'source_sha256':hashlib.sha256(ARGS.source.read_bytes()).hexdigest(),
               'translation_sources':{filename:hashlib.sha256((ARGS.translations/filename).read_bytes()).hexdigest() for filename in ['ru-23-37.json','ru-38-52.json','ru-53-68.json']},
               'method':'Manually mapped original PDF clips; 360 dpi grayscale; Russian replacements for step/rule; translated ornament labels.',
               'figures':manifest,'removed_text_at_clip_edges':english_removed,'orders':ORDERS,'insert_after_blocks':AFTER,
               'translated_blocks_included':len(included),'source_translation_blocks':sum(len(r['blocks']) for r in records),
               'page_map':page_map,'output':str(ARGS.output),'output_sha256':hashlib.sha256(ARGS.output.read_bytes()).hexdigest()}
(HERE/'figure-manifest.json').write_text(json.dumps(manifest_data,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'pdf':str(ARGS.output),'pages':len(page_map),'figure_clips':len(manifest),'translation_blocks':len(included),'edge_text_removed':english_removed},ensure_ascii=False))
