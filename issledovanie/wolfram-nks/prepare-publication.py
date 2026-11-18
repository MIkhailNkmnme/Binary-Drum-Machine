"""Package the completed local translation; does not translate or run book code.

Usage: python prepare-publication.py PATH_TO_NKS-ch2-ru
The input directory contains the completed HTML/PDF and work/ru-*.json.
"""
from pathlib import Path
import base64
import hashlib
import json
import re
import shutil
import sys

source = Path(sys.argv[1]).resolve()
target = Path(__file__).resolve().parent
(target / 'images').mkdir(exist_ok=True)
(target / 'translation').mkdir(exist_ok=True)
html_path = source / 'Вольфрам - Глава 2 - Русский перевод.html'
pdf_path = source / 'Вольфрам - Глава 2 - Русский перевод с оригиналом.pdf'
reader = html_path.read_text(encoding='utf-8')
images = []

def extract_image(match):
    name = f'images/original-{len(images):02d}.png'
    data = base64.b64decode(match.group(1), validate=True)
    (target / name).write_bytes(data)
    images.append({'file': name, 'sha256': hashlib.sha256(data).hexdigest()})
    return f'src="{name}"'

reader = re.sub(r'src="data:image/png;base64,([A-Za-z0-9+/=\s]+)"', extract_image, reader)
reader = reader.replace('<header>', '<header><p><a href="./">← Лаборатория Вольфрама</a> · <a href="../../index.html">Хаб</a> · <a href="chapter-2-ru.pdf">Скачать PDF</a></p>', 1)
reader = reader.replace('</header>', '<p>Оригинал: Stephen Wolfram, <i>A New Kind of Science</i>, © 2002 Stephen Wolfram. <a href="https://www.wolframscience.com/nks/">Официальное издание</a> · <a href="https://files.wolframcdn.com/pub/www.wolframscience.com/nks/nks-ch2.pdf">Глава на английском</a>. Перевод подготовлен в Зеркалиусе; не является официальным переводом автора или издателя.</p></header>', 1)
(target / 'reader.html').write_text(reader, encoding='utf-8')
shutil.copyfile(pdf_path, target / 'chapter-2-ru.pdf')
for name in ['ru-23-37.json', 'ru-38-52.json', 'ru-53-68.json']:
    shutil.copyfile(source / 'work' / name, target / 'translation' / name)
report = json.loads((source / 'work' / 'layout-report.json').read_text(encoding='utf-8'))
provenance = {
    'date': '2026-11-18',
    'author': 'Stephen Wolfram',
    'book': 'A New Kind of Science (2002)',
    'chapter': '2. The Crucial Experiment',
    'status': 'Unofficial Russian translation from the PDF supplied by the user',
    'sourceUrl': 'https://files.wolframcdn.com/pub/www.wolframscience.com/nks/nks-ch2.pdf',
    'sourceSha256': report['sourceSha256'],
    'sourcePdfPages': report['sourcePdfPages'],
    'sourceBookPages': report['sourceBookPages'],
    'pdfPages': report['outputPdfPages'],
    'pdfSha256': hashlib.sha256(pdf_path.read_bytes()).hexdigest(),
    'readerSha256': hashlib.sha256((target / 'reader.html').read_bytes()).hexdigest(),
    'translationBlocks': report['translationBlocks'],
    'jsonPageMapping': 'keys 23..50 = printed 23..50; keys 51..68 = printed 865..882 (add 814)',
    'images': images,
    'priorArtifactReview': 'Local PDF: text preservation checked on 46 pages; layout reviewed before web packaging. Book code was not executed.',
    'webReview': 'Application tests, syntax checks and browser acceptance reserved for the user.',
}
(target / 'translation' / 'provenance.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Packaged reader, PDF, three translation files and {len(images)} original-page images.')
