"""Export the journal's central-axis GIF as RGB frames and exact row-band variants."""

import argparse
import csv
from hashlib import sha256
import json
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image


RECIPE = Path(__file__).resolve().parent
SOURCE = RECIPE.parents[2] / 'central-axis-film' / 'central-axis-source.gif'


def prepare_bands(layout, height, destination):
    bands = []
    next_row = 0
    for item in layout['figures']:
        number = item['number']
        _, top, _, bottom = item['crop']
        if top != next_row or not top < bottom <= height:
            raise ValueError('Участки должны последовательно покрывать высоту GIF.')
        (destination / 'bands' / f'{number:02d}').mkdir(parents=True)
        bands.append(dict(number=number, title=item['title'], rows=[top, bottom], variants=[]))
        next_row = bottom
    if next_row != height:
        raise ValueError('Последний участок должен доходить до края GIF.')
    return bands


def export_band(image, band, variants, destination, frame_number):
    top, bottom = band['rows']
    crop = image.crop((0, top, image.width, bottom))
    bounds = crop.getbbox()
    if bounds is None:
        return None

    digest = sha256(crop.tobytes()).hexdigest()
    if digest in variants:
        return variants[digest]

    number = len(variants) + 1
    left, _, right, _ = bounds
    relative = f"bands/{band['number']:02d}/{number:03d}.png"
    crop.crop((left, 0, right, crop.height)).save(destination / relative)
    band['variants'].append(dict(number=number, image=relative, first_frame=frame_number,
                                 left=left, right=right, sha256=digest))
    variants[digest] = number
    return number


def export_frames(gif, layout, destination):
    (destination / 'frames').mkdir()
    bands = prepare_bands(layout, gif.height, destination)
    variants = [{} for _ in bands]
    seen_frames = {}
    frames = []
    elapsed = 0

    for index in range(gif.n_frames):
        gif.seek(index)
        image = gif.convert('RGB')
        relative = f'frames/{index:03d}.png'
        image.save(destination / relative)
        digest = sha256(image.tobytes()).hexdigest()
        same_as = seen_frames.get(digest)
        seen_frames.setdefault(digest, index)
        duration = gif.info['duration']
        parts = [export_band(image, band, known, destination, index)
                 for band, known in zip(bands, variants)]
        frames.append(dict(frame=index, start_ms=elapsed, duration_ms=duration, image=relative,
                           same_as=same_as, sha256=digest, bands=parts))
        elapsed += duration

    return dict(source_url=layout['source_url'], source_sha256=layout['source_sha256'],
                size=list(gif.size), frame_count=len(frames), unique_frame_count=len(seen_frames),
                duration_ms=elapsed, band_variant_count=sum(map(len, variants)),
                frame_indexing='zero-based', band_rows='top inclusive, bottom exclusive',
                band_hash='RGB pixels with the complete original frame width',
                frames=frames, bands=bands)


def write_indexes(index, destination):
    json_path = destination / 'frame-index.json'
    json_path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    with (destination / 'frame-index.csv').open('w', encoding='utf-8-sig', newline='') as handle:
        writer = csv.writer(handle, delimiter=';')
        writer.writerow(['Кадр GIF', 'Начало, мс', 'Длительность, мс', 'PNG', 'Повтор кадра']
                        + [f"Участок {b['number']:02d}" for b in index['bands']])
        for frame in index['frames']:
            writer.writerow([frame['frame'], frame['start_ms'], frame['duration_ms'],
                             frame['image'], frame['same_as'], *frame['bands']])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path, help='Новая папка для PNG и покадровых списков')
    parser.add_argument('--source', type=Path, default=SOURCE, help='Исходный GIF центральной оси')
    args = parser.parse_args()
    output = args.output.resolve()
    if output.exists():
        parser.error('Выберите имя для новой папки.')
    layout = json.loads((RECIPE / 'sources.json').read_text(encoding='utf-8'))
    if sha256(args.source.read_bytes()).hexdigest() != layout['source_sha256']:
        parser.error('SHA-256 исходника не совпадает с GIF Журнала картинок.')

    with Image.open(args.source) as gif, TemporaryDirectory(prefix='axis-frames-', dir=output.parent) as folder:
        destination = Path(folder) / 'ready'
        destination.mkdir()
        index = export_frames(gif, layout, destination)
        write_indexes(index, destination)
        destination.rename(output)
    print(f"{index['frame_count']} PNG, {index['unique_frame_count']} unique frames, "
          f"{index['band_variant_count']} band variants")


if __name__ == '__main__':
    main()
