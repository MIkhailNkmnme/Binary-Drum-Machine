"""Read a local collection of official NKS chapter PDFs; never executes book code.

Usage: python search-nks.py INPUT_FOLDER OUTPUT_FOLDER
Full extracted text stays in the supplied local output folder. For publication use
only the page/term index, not the English text corpus.
"""
from pathlib import Path
import json
import re
import sys
import pymupdf

sys.stdout.reconfigure(encoding='utf-8')
folder, output = map(Path, sys.argv[1:3])
output.mkdir(parents=True, exist_ok=True)
terms = {
    'xor': r'exclusive[-\s]+or|\bXor\b',
    'additive': r'additiv\w*',
    'rule90': r'rule\s+90\b',
    'rule150': r'rule\s+150\b',
    'second-order': r'second[-\s]+order',
    'reversible': r'reversib\w*',
    'asynchronous': r'asynchron\w*|in[-\s]+place|sequential\s+updat\w*|order\s+of\s+updat\w*',
    'sweeps': r'sweep\w*|swept|zig[-\s]*zag|back\s+and\s+forth|alternat\w*\s+(?:left|right|direction)',
    'mobile': r'mobile\s+autom\w*',
    'memory': r'memor\w*|accumulat\w*',
    'pascal': r'Pascal|binomial\s+coefficients?',
    'superposition': r'superposition',
    'linear': r'linear\s+(?:cellular|rule|superposition)',
    'history': r'previous\s+two|two\s+previous|previous\s+state|previous\s+step',
}
corpus, manifest = [], []
for pdf in sorted(folder.glob('nks-ch*.pdf'), key=lambda p: int(re.search(r'ch(\d+)', p.stem)[1])):
    with pymupdf.open(pdf) as doc:
        manifest.append({'file':pdf.name, 'pdfPages':len(doc)})
        for n, page in enumerate(doc):
            text = page.get_text()
            header = text[:350]
            numbers = re.findall(r'(?m)^([1-9]\d{0,3})\s*$', header)
            printed = int(numbers[0]) if numbers and int(numbers[0]) <= 1197 else None
            normalized = re.sub(r'-\s*\n\s*', '', text)
            counts = {name:len(re.findall(pattern,normalized,re.I)) for name,pattern in terms.items()}
            corpus.append({'file':pdf.name,'pdfPage':n+1,'bookPage':printed,'terms':{k:v for k,v in counts.items() if v},'text':text})
(output/'corpus.json').write_text(json.dumps(corpus, ensure_ascii=False), encoding='utf-8')
index = {'files':manifest, 'pages':len(corpus), 'patterns':terms,
         'matches':[{k:v for k,v in row.items() if k!='text'} for row in corpus if row['terms']]}
(output/'term-index.json').write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'files':len(manifest), 'pages':len(corpus), 'matchingPages':len(index['matches']), 'counts':{name:sum(row['terms'].get(name,0) for row in corpus) for name in terms}}, ensure_ascii=False))
