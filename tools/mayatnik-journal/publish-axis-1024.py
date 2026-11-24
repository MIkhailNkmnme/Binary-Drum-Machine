"""Pack an exact axis atlas and make previews for its large figures."""

import argparse
from hashlib import file_digest, sha256
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZIP_DEFLATED, ZIP_STORED, ZipFile

from PIL import Image


SITE_ROOT = Path(__file__).resolve().parents[2] / 'mayatnik'
TILE_WIDTH, TILE_HEIGHT, COLUMNS = 160, 96, 8
ZIP_PART_BUDGET = 1_480_000_000


def file_group(source, records):
    group = []
    total = 0
    for record in records:
        size = (source / record['file']).stat().st_size + 256
        if group and total + size > ZIP_PART_BUDGET:
            yield group
            group, total = [], 0
        group.append(record)
        total += size
    if group:
        yield group


def verify_package(source, archive, records):
    with ZipFile(archive) as bundle:
        names = [record['file'] for record in records] + ['index.json', 'occurrences.csv']
        if bundle.namelist() != names:
            raise ValueError(f'Unexpected files in {archive}')
        for record in records:
            with bundle.open(record['file']) as stream:
                if file_digest(stream, 'sha256').hexdigest() != record['sha256']:
                    raise ValueError(f"Incorrect archived SHA-256 for {record['file']}")
        for name in ('index.json', 'occurrences.csv'):
            if bundle.read(name) != (source / name).read_bytes():
                raise ValueError(f'Incorrect archived {name} in {archive}')


def package(source, archive, records):
    if archive.exists():
        verify_package(source, archive, records)
        return
    with TemporaryDirectory(dir=archive.parent) as directory:
        pending = Path(directory) / archive.name
        with ZipFile(pending, 'x', compression=ZIP_STORED) as bundle:
            for record in records:
                data = (source / record['file']).read_bytes()
                if sha256(data).hexdigest() != record['sha256']:
                    raise ValueError(f"Incorrect SHA-256 for {record['file']}")
                bundle.writestr(record['file'], data)
            for name in ('index.json', 'occurrences.csv'):
                bundle.write(source / name, name, compress_type=ZIP_DEFLATED)
        verify_package(source, pending, records)
        archive.hardlink_to(pending)


def previews(source, site, large, split, nearest=False):
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
                if nearest:
                    source_image.thumbnail((TILE_WIDTH - 12, TILE_HEIGHT - 12), Image.Resampling.NEAREST)
                image = source_image.convert('RGBA')
            if not nearest:
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
    if rows not in (1024, 2048, 4096):
        raise ValueError('Unsupported axis atlas size')
    large = [item for item in index['figures'] if item['siteId'] is None]
    if len(large) != index['counts']['localFigures'] or len(index['figures']) != index['counts']['figures']:
        raise ValueError('The atlas index disagrees with its figure counts')

    site = SITE_ROOT / f'axis-{rows}'
    records = [*index['frames'], *index['figures']]
    if rows == 4096:
        parts = []
        for number, group in enumerate(file_group(source, records), 1):
            part = archive.with_name(f'{archive.stem}-{number:02d}{archive.suffix}')
            package(source, part, group)
            with part.open('rb') as stream:
                digest = file_digest(stream, 'sha256').hexdigest()
            frames = [record['frame'] for record in group if 'frame' in record]
            figures = [record['id'] for record in group if 'id' in record]
            parts.append(dict(file=part.name, bytes=part.stat().st_size, sha256=digest,
                              frames=len(frames), figures=len(figures),
                              frameRange=[frames[0], frames[-1]] if frames else None,
                              figureRange=[figures[0], figures[-1]] if figures else None))
            print(f'Saved {part.name} ({parts[-1]["bytes"]:,} bytes)', flush=True)
        manifest = json.dumps(parts, indent=2) + '\n'
        (archive.parent / 'archive-parts.json').write_text(manifest, encoding='utf-8')
        site.mkdir(parents=True, exist_ok=True)
        (site / 'archive-parts.json').write_text(manifest, encoding='utf-8')
    else:
        package(source, archive, records)
        print(f"{index['counts']['figures']} exact figures and {index['counts']['frames']} frames in {archive}", flush=True)
    previews(source, site, large, split=rows != 1024, nearest=rows == 4096)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('archive', type=Path)
    args = parser.parse_args()
    publish(args.source, args.archive)
