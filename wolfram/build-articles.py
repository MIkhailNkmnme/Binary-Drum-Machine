"""Build the two static Russian articles. Requires Python-Markdown.

Document formatting only: does not import or execute the application algorithms.
Run: python wolfram/build-articles.py
"""
from pathlib import Path
from html import escape
import markdown

ROOT = Path(__file__).resolve().parent
STYLE = """
:root{color-scheme:dark;background:#0b1219;color:#dbe7ec;font:17px/1.75 'Segoe UI',Arial,sans-serif}
*{box-sizing:border-box}body{margin:0}main{max-width:1020px;margin:auto;padding:28px clamp(16px,4vw,48px) 80px}
a{color:#72dce8;text-underline-offset:3px}a:focus-visible{outline:2px solid #72dce8;outline-offset:4px}
nav{display:flex;flex-wrap:wrap;gap:8px 22px;font-size:14px;margin-bottom:38px}h1{font-size:clamp(30px,5vw,46px);line-height:1.2;max-width:24ch}
h2{margin:2.2em 0 .6em;color:#72dce8;line-height:1.35;font-size:26px}h3{margin:1.5em 0 .4em;font-size:21px}
p{margin:.8em 0}strong{color:#fff}pre{background:#13212b;border:1px solid #2b4351;padding:18px;overflow:auto;font-size:14px;line-height:1.6}
code{font-family:Consolas,monospace;overflow-wrap:anywhere}table{display:block;overflow:auto;border-collapse:collapse;font-size:15px;margin:22px 0;max-width:100%}
th,td{text-align:left;border:1px solid #314653;padding:10px;vertical-align:top;min-width:100px}th{background:#172a35}
img{display:block;max-width:100%;height:auto;margin:30px auto 8px;background:#fff}p:has(>em:only-child){font-size:14px;color:#a9bdc8}
.toc{padding:16px 24px;background:#111e28;border-left:2px solid #72dce8;font-size:15px}.toc ul{padding-left:22px}.toc>ul{margin:0}
blockquote{border-left:3px solid #72dce8;margin-left:0;padding-left:20px}footer{border-top:1px solid #314653;margin-top:45px;padding-top:18px;font-size:14px;color:#a9bdc8}
@media print{:root{color-scheme:light;background:#fff;color:#111;font-size:11pt}main{max-width:none;padding:0}nav,.toc,footer{display:none}h1,h2,h3,strong{color:#111}h2,h3{break-after:avoid}img{max-height:230mm;object-fit:contain;break-inside:avoid}a{color:inherit}pre,th{background:#f4f4f4}pre{white-space:pre-wrap}table{display:table;font-size:9pt}th,td{min-width:0;padding:6px}p{orphans:3;widows:3}@page{size:A4;margin:18mm}}
"""

for stem in ("mayatnik", "animatrix"):
    source = (ROOT / f"{stem}.md").read_text(encoding="utf-8")
    title = source.splitlines()[0].removeprefix("# ")
    if "[TOC]" not in source:
        source = source.replace("\n## 1.", "\n[TOC]\n\n## 1.", 1)
    body = markdown.markdown(source, extensions=["tables", "fenced_code", "toc"],
                             extension_configs={"toc": {"toc_depth": "2-3"}})
    body = body.replace('<img ', '<img loading="lazy" decoding="async" ')
    page = f'''<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(title)} · Зеркалиус</title><style>{STYLE}</style></head>
<body><main><nav aria-label="Разделы"><a href="../index.html">Хаб</a><a href="./">Зеркалиус · Вольфрам</a><a href="mayatnik.html">Маятник</a><a href="animatrix.html">Аниматрица</a><a href="../issledovanie/wolfram-nks/">Книга</a></nav>
<article>{body}</article><footer>Зеркалиус · 18 ноября 2026 · <a href="{stem}.md">Исходник статьи</a> · <a href="README.md">Устройство раздела и происхождение</a>. Для печати используйте команду браузера.</footer></main></body></html>
'''
    (ROOT / f"{stem}.html").write_text(page, encoding="utf-8")
    print(f"Written {stem}.html")
