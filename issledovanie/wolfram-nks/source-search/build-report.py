"""Build the static comparison article; requires Python-Markdown.
Does not execute the compared algorithms or any Mathematica code.
"""
from pathlib import Path
import markdown

root = Path(__file__).resolve().parent.parent
body = markdown.markdown((root / 'xor-pendulum-comparison.md').read_text(encoding='utf-8'), extensions=['tables', 'fenced_code'])
page = '''<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>XOR-маятник и книга Вольфрама · Сопоставление</title>
<style>
body{margin:0;background:#0b1118;color:#dae7ed;font:17px/1.7 system-ui,sans-serif}
main{max-width:1060px;margin:auto;padding:24px clamp(16px,4vw,48px) 64px}
a{color:#6ddded;text-underline-offset:3px}h1{font-size:clamp(28px,4vw,42px);line-height:1.2}
h2{margin-top:2em;color:#6ddded;font-size:25px}pre{padding:16px;background:#101b25;overflow:auto}
code{font-family:Consolas,monospace}table{width:100%;border-collapse:collapse;font-size:15px}
th,td{border:1px solid #2b414f;padding:12px;vertical-align:top;text-align:left;overflow-wrap:anywhere}
th{background:#101b25}li{margin:8px 0}nav{margin-bottom:28px}
@media(max-width:640px){table{font-size:12px}th,td{padding:6px}}
@media print{body{background:white;color:black;font-size:11pt}main{padding:0}a,h2{color:black}th{background:#eee}pre{white-space:pre-wrap;background:#f4f4f4}tr{break-inside:avoid}nav{display:none}}
</style></head><body><main><nav><a href="./">← Глава 2 и опыты</a> · <a href="../../index.html">Хаб</a></nav>'''+body+'</main></body></html>\n'
(root / 'xor-pendulum-comparison.html').write_text(page, encoding='utf-8')
