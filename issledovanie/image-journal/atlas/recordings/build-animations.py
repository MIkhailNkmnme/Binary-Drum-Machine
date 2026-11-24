"""Build native-pixel central-column GIFs from the indexed Mayatnik atlases."""

import argparse
from collections import defaultdict
from functools import lru_cache
from hashlib import file_digest, sha256
from io import BytesIO
import json
from pathlib import Path

from PIL import GifImagePlugin, Image, ImageChops


HERE = Path(__file__).resolve().parent
SIZES = (128, 256, 1024, 2048, 4096)
COLUMNS = 129
MIN_CELLS = 4
PALETTE = ('#000000', '#ffe969', '#00008b')
GIF_PALETTE = b''.join(bytes.fromhex(colour[1:]) for colour in PALETTE).ljust(768, b'\0')
OPAQUE_MASK = bytes([0] + [255] * 255)


def build(source, size, output):
    index_bytes = (source / 'index.json').read_bytes()
    index = json.loads(index_bytes)
    field_width, height = index['size']
    center = index['center']
    left = center - COLUMNS // 2
    right = left + COLUMNS
    if (height != size or index['source']['rows'] != size
            or tuple(index['palette'][:3]) != PALETTE or not 0 <= left < right <= field_width):
        raise ValueError(f'Invalid central-axis atlas for {size}')

    source_frames = [entry['frame'] for entry in index['frames']]
    frame_delay = min(950, round(184_000 / len(source_frames) / 10) * 10)
    by_id = {figure['id']: figure for figure in index['figures']}
    by_frame = defaultdict(list)
    for figure in index['figures']:
        if figure['siteId'] is None or sum(figure['counts']) < MIN_CELLS:
            continue
        for number, x, y in figure['occurrences']:
            by_frame[number].append((figure['id'], x, y))

    @lru_cache(maxsize=512)
    def section(figure_id, start, stop):
        figure = by_id[figure_id]
        data = (source / figure['file']).read_bytes()
        if sha256(data).hexdigest() != figure['sha256']:
            raise ValueError(f'PNG {figure_id} differs from atlas {size}')
        with Image.open(BytesIO(data)) as image:
            if image.mode != 'P' or image.getpalette()[:9] != list(GIF_PALETTE[:9]):
                raise ValueError(f'PNG {figure_id} has an unexpected palette')
            crop = image.crop((start, 0, stop, figure['height']))
        mask = Image.frombytes('L', crop.size, crop.tobytes().translate(OPAQUE_MASK))
        return crop, mask

    gif = output / f'central-axis-{size}.gif'
    with gif.open('wb') as stream:
        previous = None
        for number in source_frames:
            picture = Image.new('P', (COLUMNS, height))
            picture.putpalette(GIF_PALETTE)
            for figure_id, x, y in by_frame[number]:
                start = max(x, left)
                stop = min(x + by_id[figure_id]['width'], right)
                if start < stop:
                    shape, mask = section(figure_id, start - x, stop - x)
                    picture.paste(shape, (start - left, y), mask)

            indices = Image.frombytes('L', picture.size, picture.tobytes())
            if previous is None:
                header, _ = GifImagePlugin.getheader(picture, info={'loop': 0, 'background': 0})
                stream.writelines(header)
                bounds = (0, 0, COLUMNS, height)
            else:
                bounds = ImageChops.difference(previous, indices).getbbox() or (0, 0, 1, 1)
            # Each update writes opaque palette indices, including black erasures.
            stream.writelines(GifImagePlugin.getdata(picture.crop(bounds), offset=bounds[:2],
                                                   duration=frame_delay, disposal=1))
            previous = indices
        stream.write(b';')

    with gif.open('rb') as stream:
        checksum = file_digest(stream, 'sha256').hexdigest()
    return dict(
        rows=size, file=gif.name, width=COLUMNS, height=height, sourceColumn=center,
        sourceColumns=[left, right], sourceAtlasSha256=sha256(index_bytes).hexdigest(),
        sourceFrames=source_frames, frameDelayMs=frame_delay, minimumOccupiedCells=MIN_CELLS,
        maximumOccupiedCells=index['limits']['maxOccupiedBits'], sha256=checksum,
    )


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source_dir', type=Path, help='Directory containing the axis atlas folders')
    parser.add_argument('--output-dir', type=Path, default=HERE)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    records = []
    for size in SIZES:
        record = build(args.source_dir / str(size), size, args.output_dir)
        records.append(record)
        print(f"{size}: {len(record['sourceFrames'])} × {record['frameDelayMs']} ms", flush=True)
    manifest = dict(palette=PALETTE, sourceColumnRange='left inclusive, right exclusive', recordings=records)
    (args.output_dir / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
