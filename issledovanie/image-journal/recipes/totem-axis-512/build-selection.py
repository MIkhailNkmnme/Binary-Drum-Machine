"""Export exact crops and a journal contact sheet from Mayatnik's 512-row atlas."""

import argparse
from hashlib import sha256
import json
from pathlib import Path
from runpy import run_path

from PIL import Image, ImageColor, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
GIF = ROOT / 'issledovanie/central-axis-film/central-axis-source.gif'
ATLAS = ROOT / 'mayatnik/mayatnik-axis-512-atlas-data.js'
FIGURE_NUMBERS = (16, 28, 35, 36)


def build(output):
    tools = run_path(str(ROOT / 'tools/mayatnik-journal/build-axis-512-atlas.py'))
    lines = ATLAS.read_text(encoding='utf-8').splitlines()
    atlas_sha = next(line for line in lines if line.startswith('  sourceSha256: '))
    source_sha = sha256(GIF.read_bytes()).hexdigest()
    if json.loads(atlas_sha.removeprefix('  sourceSha256: ').rstrip(',')) != source_sha:
        raise ValueError('The atlas was built from a different GIF')

    palette_line = next(line for line in lines if line.startswith('  palette: '))
    palette = json.loads(palette_line.removeprefix('  palette: ').rstrip(','))
    colours = [(0, 0, 0, 0)] + [(*ImageColor.getrgb(colour), 255) for colour in palette[1:]]
    records = [json.loads(line.rstrip(',')) for line in lines if line.startswith('    [')]
    tile_width, sheet_height = 240, 384
    sheet = Image.new('RGB', (tile_width * len(FIGURE_NUMBERS), sheet_height), '#151920')
    draw = ImageDraw.Draw(sheet)
    label_font = ImageFont.load_default(size=18)
    figures = []

    output.mkdir(parents=True, exist_ok=True)
    with Image.open(GIF) as gif:
        for tile, number in enumerate(FIGURE_NUMBERS):
            width, height, _, payload, occurrences = records[number - 1]
            frame, x, y, crosses_band = occurrences[0]
            gif.seek(frame)
            original = gif.convert('RGB').crop((x, y, x + width, y + height))
            pixels = tools['unpack'](payload)
            flatten = getattr(original, 'get_flattened_data', original.getdata)
            if len(pixels) != width * height or any(
                index and colours[index][:3] != rgb
                for index, rgb in zip(pixels, flatten(), strict=True)
            ):
                raise ValueError(f'Figure {number:03d} does not match GIF frame {frame}')

            name = f'totem-{number:03d}.png'
            image = Image.frombytes('RGBA', original.size, b''.join(bytes(colours[i]) for i in pixels))
            image.save(output / name, optimize=True)
            figures.append(dict(figure=number, frame=frame, x=x, y=y, width=width, height=height,
                                crosses_band=crosses_band, file=name))

            scale = min(6, 192 // width, 320 // height)
            preview = image.resize((width * scale, height * scale), Image.Resampling.NEAREST)
            left = tile * tile_width
            if tile:
                draw.line((left, 16, left, 367), fill='#343943')
            sheet.paste(preview, (left + (tile_width - preview.width) // 2,
                                  16 + (320 - preview.height) // 2), preview)
            draw.text((left + tile_width // 2, 358), f'{number:03d}', font=label_font,
                      anchor='mm', fill='#c6ccd3')

    sheet.save(output / 'totems-512.png', optimize=True)
    provenance = dict(source=GIF.relative_to(ROOT).as_posix(), source_sha256=source_sha,
                      atlas=ATLAS.relative_to(ROOT).as_posix(), figures=figures)
    (output / 'sources.json').write_text(json.dumps(provenance, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=HERE)
    build(parser.parse_args().output_dir)
