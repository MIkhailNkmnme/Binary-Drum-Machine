"""Pack the exact 1024-row atlas and make previews for its large figures."""

import argparse
from hashlib import sha256
import io
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZIP_STORED, ZipFile

from PIL import Image


SITE = Path(__file__).resolve().parents[2] / 'mayatnik/axis-1024'
TILE_WIDTH, TILE_HEIGHT, COLUMNS = 160, 96, 8


def publish(source, archive):
    index_path = source / 'index.json'
    index = json.loads(index_path.read_text(encoding='utf-8'))
    large = [item for item in index['figures'] if item['siteId'] is None]
    if len(large) != index['counts']['localFigures'] or len(index['figures']) != index['counts']['figures']:
        raise ValueError('The atlas index disagrees with its figure counts')

    rows = (len(large) + COLUMNS - 1) // COLUMNS
    sheet = Image.new('RGB', (TILE_WIDTH * COLUMNS, TILE_HEIGHT * rows))
    preview_slots = {item['id']: slot for slot, item in enumerate(large)}
    records = []

    with ZipFile(archive, 'x', compression=ZIP_STORED) as bundle:
        for record in (*index['frames'], *index['figures']):
            data = (source / record['file']).read_bytes()
            if sha256(data).hexdigest() != record['sha256']:
                raise ValueError(f"Incorrect SHA-256 for {record['file']}")
            bundle.writestr(record['file'], data)
            if record.get('id') not in preview_slots:
                continue

            slot = preview_slots[record['id']]
            position = (slot % COLUMNS * TILE_WIDTH, slot // COLUMNS * TILE_HEIGHT)
            background = '#e0e6eb' if record['counts'][0] else '#1d2732'
            tile = Image.new('RGB', (TILE_WIDTH, TILE_HEIGHT), background)
            with Image.open(io.BytesIO(data)) as source_image:
                image = source_image.convert('RGBA')
            image.thumbnail((TILE_WIDTH - 12, TILE_HEIGHT - 12), Image.Resampling.BOX)
            tile.paste(image, ((TILE_WIDTH - image.width) // 2, (TILE_HEIGHT - image.height) // 2), image)
            sheet.paste(tile, position)
            frame, x, y = record['occurrences'][0]
            records.append(dict(id=record['id'], frame=frame, x=x, y=y, width=record['width'],
                                height=record['height'], bits=sum(record['counts']), preview=position))

        for name in ('index.json', 'occurrences.csv'):
            bundle.write(source / name, name, compress_type=ZIP_DEFLATED)

    SITE.mkdir(parents=True, exist_ok=True)
    sheet.save(SITE / 'previews.webp', lossless=True, method=4)
    (SITE / 'large-figures.json').write_text(json.dumps(records, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f"{len(records)} previews; {index['counts']['figures']} exact figures and {index['counts']['frames']} frames in {archive}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('archive', type=Path)
    args = parser.parse_args()
    publish(args.source, args.archive)
