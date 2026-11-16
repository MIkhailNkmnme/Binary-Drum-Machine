"""Package the generated live collection; original media archives are unchanged."""
from pathlib import Path
import json
import hashlib
import zipfile

ROOT = Path(__file__).resolve().parent
LIVE = ROOT / 'live'
manifest = json.loads((LIVE / 'manifest.json').read_text(encoding='utf-8'))
items = manifest['items']
labels = {'atlas-color': 'Атлас в цвете · 6 роликов', 'atlas-mono': 'Атлас ЧБ · 6 роликов', 'sierpinski': 'Серпинский · 3 ролика',
          'animatrix': 'Аниматрицы · 3 ролика', 'pendulums': 'Маятники · 3 ролика',
          'rhombi': 'Ромбы · 3 ролика', 'rgb': 'RGB · 3 ролика'}
archives = []
for category, label in labels.items():
    group = [item for item in items if (('atlas-' + item['variant']) if item['category'] == 'atlas' else item['category']) == category]
    if not group:
        continue
    target = LIVE / ('zerkalius-live-' + category + '.zip')
    with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_STORED) as archive:
        for item in group:
            for kind in ['video', 'audio', 'midi', 'score']:
                source = ROOT / item[kind]['path']
                archive.write(source, source.name)
        archive.writestr('README.txt', 'Зеркалиус — живые телефонные обои\n'
                         'MP4: рисунок и звук. MP3: звук отдельно. MIDI: ноты (битовые тембры не передаются).\n'
                         'JSON: последовательность кадров и партитура. Музыка создана из битов поля; ударные и лад заданы.\n'
                         'https://1001100.online/issledovanie/phone-theme/#live\n'
                         'Открыть рецепт в Маятнике: https://1001100.online/mayatnik/Zerkalius-mayatnik.html?phoneScene=ID\n'
                         'Проверки интерфейса, визуальная приёмка и прослушивание — пользователем.\n')
    content = target.read_bytes()
    archives.append({'category': category, 'label': label, 'path': 'live/' + target.name,
                     'count': len(group), 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()})
    print(target.name, len(content))
(LIVE / 'downloads.json').write_text(json.dumps({'archives': archives}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
