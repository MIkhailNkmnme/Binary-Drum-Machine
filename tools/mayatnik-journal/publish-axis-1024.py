"""Pack an exact axis atlas and make previews for its large figures."""

import argparse
from hashlib import sha256
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZIP_DEFLATED, ZIP_STORED, ZipFile

from PIL import Image


SITE_ROOT = Path(__file__).resolve().parents[2] / 'mayatnik'
TILE_WIDTH, TILE_HEIGHT, COLUMNS = 160, 96, 8


def package(source, archive, index):
    with TemporaryDirectory(dir=archive.parent) as directory:
        pending = Path(directory) / archive.name
        with ZipFile(pending, 'x', compression=ZIP_STORED) as bundle:
            for record in (*index['frames'], *index['figures']):
                data = (source / record['file']).read_bytes()
                if sha256(data).hexdigest() != record['sha256']:
                    raise ValueError(f"Incorrect SHA-256 for {record['file']}")
                bundle.writestr(record['file'], data)
            for name in ('index.json', 'occurrences.csv'):
                bundle.write(source / name, name, compress_type=ZIP_DEFLATED)
        archive.hardlink_to(pending)


def previews(source, site, large, split):
    per_sheet = 16 * COLUMNS if split else max(COLUMNS, len(large))
    records = []
    site.mkdir(parents=True, exist_ok=True)
    for first in range(0, len(large), per_sheet):
        group = large[first:first + per_sheet]
        height = ((len(group) + COLUMNS - 1) // COLUMNS) * TILE_HEIGHT
        sheet = Image.new('RGB', (TILE_WIDTH * COLUMNS, height))
        name = f'previews-{first // per_sheet + 1:02d}.webp' if split else 'previews.webp'
        for slot, record in enumerate(group):
            position = (slot % COLUMNS * TILE_WIDTH, slot // COLUMNS * TILE_HEIGHT)
            background = '#e0e6eb' if record['counts'][0] else '#1d2732'
            tile = Image.new('RGB', (TILE_WIDTH, TILE_HEIGHT), background)
            with Image.open(source / record['file']) as source_image:
                image = source_image.convert('RGBA')
            image.thumbnail((TILE_WIDTH - 12, TILE_HEIGHT - 12), Image.Resampling.BOX)
            tile.paste(image, ((TILE_WIDTH - image.width) // 2, (TILE_HEIGHT - image.height) // 2), image)
            sheet.paste(tile, position)
            frame, x, y = record['occurrences'][0]
            card = dict(id=record['id'], frame=frame, x=x, y=y, width=record['width'],
                        height=record['height'], bits=sum(record['counts']), preview=position)
            if split:
                card['previewFile'] = name
            records.append(card)
        sheet.save(site / name, lossless=True, method=4)
        print(f'Saved {len(records)}/{len(large)} previews', flush=True)
    (site / 'large-figures.json').write_text(json.dumps(records, separators=(',', ':')) + '\n', encoding='utf-8')


def publish(source, archive):
    index = json.loads((source / 'index.json').read_text(encoding='utf-8'))
    rows = index['source']['rows']
    if rows not in (1024, 2048):
        raise ValueError('Unsupported axis atlas size')
    large = [item for item in index['figures'] if item['siteId'] is None]
    if len(large) != index['counts']['localFigures'] or len(index['figures']) != index['counts']['figures']:
        raise ValueError('The atlas index disagrees with its figure counts')

    package(source, archive, index)
    print(f"{index['counts']['figures']} exact figures and {index['counts']['frames']} frames in {archive}", flush=True)
    previews(source, SITE_ROOT / f'axis-{rows}', large, split=rows == 2048)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('archive', type=Path)
    args = parser.parse_args()
    publish(args.source, args.archive)
