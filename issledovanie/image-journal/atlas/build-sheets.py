"""Publish exact atlas PNGs and nearest-neighbour contact sheets."""

import argparse
from hashlib import sha256
import json
from pathlib import Path
from shutil import copyfile

from PIL import Image, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
SELECTION = {
    128: (32, 73, 151, 140),
    256: (94, 199, 324, 321),
    1024: (1912, 1737, 2112, 2726),
    2048: (5477, 5330, 7570, 8023),
    4096: (17723, 18474, 19337, 19179),
}


def build_sheet(rows, atlas_dir, output):
    index = json.loads((atlas_dir / 'index.json').read_text(encoding='utf-8'))
    if index['source']['rows'] != rows:
        raise ValueError(f'Expected the atlas for {rows} rows')
    by_id = {figure['id']: figure for figure in index['figures']}
    output.mkdir(parents=True, exist_ok=True)

    sheet = Image.new('RGB', (960, 384), '#151920')
    draw = ImageDraw.Draw(sheet)
    label_font = ImageFont.load_default(size=18)
    figures = []

    for tile, figure_id in enumerate(SELECTION[rows]):
        figure = by_id[figure_id]
        source = atlas_dir / figure['file']
        if sha256(source.read_bytes()).hexdigest() != figure['sha256']:
            raise ValueError(f'Figure {figure_id} differs from the atlas PNG')
        png = source.name
        copyfile(source, output / png)
        frame, x, y = figure['occurrences'][0]
        figures.append(dict(figure=figure_id, frame=frame, x=x, y=y,
                            width=figure['width'], height=figure['height'],
                            counts=figure['counts'], file=png, sha256=figure['sha256']))

        with Image.open(source) as original:
            image = original.convert('RGBA')
        factor = min(16, 192 // image.width, 296 // image.height)
        preview = image.resize((image.width * factor, image.height * factor),
                               Image.Resampling.NEAREST)
        left = tile * 240
        # Navy cells need a lighter backdrop. The downloadable PNG is kept intact.
        if figure['counts'][0]:
            draw.rectangle((left + 12, 12, left + 227, 331), fill='#8b94a5')
        if tile:
            draw.line((left, 16, left, 367), fill='#343943')
        sheet.paste(preview, (left + (240 - preview.width) // 2,
                              12 + (320 - preview.height) // 2), preview)
        draw.text((left + 120, 358), f'{figure_id:04d}', font=label_font,
                  anchor='mm', fill='#c6ccd3')

    sheet.save(output / 'totems.png', optimize=True)
    provenance = dict(source=index['source'], size=index['size'], center=index['center'],
                      figures=figures)
    (output / 'sources.json').write_text(json.dumps(provenance, indent=2) + '\n',
                                         encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source_dir', type=Path, help='Directory containing the axis atlas folders')
    args = parser.parse_args()
    for size in SELECTION:
        build_sheet(size, args.source_dir / str(size), HERE / str(size))
