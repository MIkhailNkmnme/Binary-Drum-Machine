"""Publish small indexed batches of exact PNG masks and source-frame occurrences."""

import argparse
from base64 import b64decode, b64encode
from collections import defaultdict
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path

from PIL import Image


HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
SIZES = (128, 256, 512, 1024, 2048, 4096)
CHUNK_SIZE = 192
MIN_CELLS = 4


def write_json(path, value):
    path.write_text(json.dumps(value, separators=(',', ':')) + '\n', encoding='utf-8')


def recorded_figures():
    bank = REPO / 'mayatnik/mayatnik-axis-512-atlas-data.js'
    lines = bank.read_text(encoding='utf-8').splitlines()
    palette_line = next(line for line in lines if line.startswith('  palette: '))
    palette = json.loads(palette_line.removeprefix('  palette: ').rstrip(','))
    colours = b''.join(bytes.fromhex(colour[1:]) for colour in palette)
    rows = (json.loads(line.rstrip(',')) for line in lines if line.startswith('    ['))
    for number, (width, height, counts, payload, occurrences) in enumerate(rows, 1):
        raster = b''.join(bytes((run & 7,)) * ((run >> 3) + 1)
                          for run in b64decode(payload, validate=True))
        if len(raster) != width * height or len(raster) - raster.count(0) != sum(counts):
            raise ValueError(f'Wrong pixel count for 512 figure {number}')
        image = Image.frombytes('P', (width, height), raster)
        image.putpalette(colours)
        png = BytesIO()
        image.save(png, format='PNG', transparency=0, optimize=True)
        yield number, width, height, sum(counts), png.getvalue(), occurrences


def calculated_figures(source, index):
    for figure in index['figures']:
        cells = sum(figure['counts'])
        if figure['siteId'] is None or cells < MIN_CELLS:
            continue
        png = (source / figure['file']).read_bytes()
        if sha256(png).hexdigest() != figure['sha256']:
            raise ValueError(f"Wrong SHA-256 for {source.name}/{figure['file']}")
        yield figure['id'], figure['width'], figure['height'], cells, png, figure['occurrences']


def build(size, source, destination):
    if size == 512:
        records = recorded_figures()
        frame_index = REPO / 'issledovanie/image-journal/recipes/totem-axis-catalog/frame-index.json'
        frame_count = json.loads(frame_index.read_text(encoding='utf-8'))['frame_count']
        frames = list(range(frame_count))
    else:
        index = json.loads((source / 'index.json').read_text(encoding='utf-8'))
        if index['source']['rows'] != size:
            raise ValueError(f'Atlas directory must contain {size} rows')
        records = calculated_figures(source, index)
        frames = [entry['frame'] for entry in index['frames']]

    destination.mkdir(parents=True, exist_ok=True)
    ids = []
    by_frame = defaultdict(list)
    chunk = []
    for offset, (number, width, height, cells, png, occurrences) in enumerate(records):
        ids.append(number)
        for frame, x, y, *_ in occurrences:
            by_frame[frame].append((offset, x, y))
        frame, x, y, *orientation = occurrences[0]
        chunk.append([number, width, height, cells, frame, x, y, b64encode(png).decode('ascii'), *orientation])
        if len(chunk) == CHUNK_SIZE:
            write_json(destination / f'chunk-{offset // CHUNK_SIZE}.json', chunk)
            chunk = []
    if chunk:
        write_json(destination / f'chunk-{len(ids) // CHUNK_SIZE}.json', chunk)
    if not ids or set(by_frame) - set(frames):
        raise ValueError(f'Invalid frame index for {size}')
    write_json(destination / 'index.json', dict(ids=ids, frames=frames, chunkSize=CHUNK_SIZE))
    write_json(destination / 'frames.json', {
        frame: sorted(by_frame[frame], key=lambda item: (item[2], item[1], item[0]))
        for frame in frames
    })
    print(f'{size}: {len(ids)} figures, {sum(map(len, by_frame.values()))} occurrences', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source_dir', type=Path)
    parser.add_argument('--output-dir', type=Path, default=HERE / 'data')
    args = parser.parse_args()
    for size in SIZES:
        build(size, args.source_dir / str(size), args.output_dir / str(size))
