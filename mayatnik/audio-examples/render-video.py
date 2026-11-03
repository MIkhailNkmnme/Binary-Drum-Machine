"""Rasterize the shared JS renderer's commands, then encode real WAV + video.

Called by build-video.cjs. No note scheduling or bit generation happens here.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, math, subprocess, sys


def paint(image, commands):
    draw = ImageDraw.Draw(image)
    for kind, colour, x, y, width, height, *extra in commands:
        if kind == 'fill':
            if width > 0 and height > 0:
                draw.rectangle((math.floor(x), math.floor(y), math.ceil(x + width) - 1,
                                math.ceil(y + height) - 1), fill=colour)
        else:
            # JS uses half-pixel paths for one-pixel, axis-aligned strokes.
            draw.rectangle((math.floor(x), math.floor(y), math.floor(x + width),
                            math.floor(y + height)), outline=colour, width=int(extra[0]))


def note_name(note):
    if note.get('drum'):
        return {'kick': 'Бочка', 'snare': 'Малый', 'hat': 'Хэт'}.get(note['drum'], note['drum'])
    midi = note.get('midi')
    if midi is None:
        return ''
    names = ['До', 'До♯', 'Ре', 'Ре♯', 'Ми', 'Фа', 'Фа♯', 'Соль', 'Соль♯', 'Ля', 'Ля♯', 'Си']
    return names[midi % 12] + str(midi // 12 - 1)


def main():
    config = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    width, height, fps = config['width'], config['height'], config['fps']
    base = Image.new('RGB', (width, height), '#000000')
    paint(base, config['base'])
    font_path = Path('C:/Windows/Fonts/arial.ttf')
    heading = ImageFont.truetype(str(font_path), 30)
    body = ImageFont.truetype(str(font_path), 20)
    small = ImageFont.truetype(str(font_path), 17)
    common = ImageDraw.Draw(base)
    common.text((40, 20), 'Музыкальный ковёр · ' + config['name'], fill='#e8edf5', font=heading)
    common.text((40, 65), 'Xorrom · Маятник · кадр 31 · 128 строк · точные биты, чтение сверху вниз',
                fill='#91a5bd', font=small)
    common.text((40, 685), 'Светлая клетка = 1 · серая = 0 · подсветка чтения — реальные серии единиц',
                fill='#91a5bd', font=small)
    images, steps = {}, {step['index']: step for step in config['steps']}
    # One RGB buffer per score row, not one allocation for every video frame.
    for index in set(config['frames']):
        image = base.copy()
        step = steps.get(index)
        if step:
            paint(image, step['overlay'])
            notes = ' · '.join(filter(None, (note_name(note) for note in step['notes']))) or 'пауза'
            caption = 'Строка ' + str(index) + ' / ' + str(config['source']['height'] - 1) + '     Ноты: ' + notes
        else:
            caption = 'Затухание · новых читаемых строк нет'
        ImageDraw.Draw(image).text((40, 640), caption, fill='#e8edf5', font=body)
        images[index] = image.tobytes()
    output, ffmpeg = config['output'], config['ffmpeg']
    log = Path(config['work']) / (config['id'] + '-ffmpeg.txt')
    args = [ffmpeg, '-hide_banner', '-loglevel', 'warning', '-y',
            '-f', 'rawvideo', '-pixel_format', 'rgb24', '-video_size', f'{width}x{height}',
            '-framerate', str(fps), '-i', 'pipe:0', '-i', config['audio'],
            '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'veryfast',
            '-crf', '12', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k',
            '-movflags', '+faststart', '-t', str(config['duration']), output]
    with log.open('wb') as errors:
        process = subprocess.Popen(args, stdin=subprocess.PIPE, stderr=errors)
        try:
            for index in config['frames']:
                process.stdin.write(images[index])
            process.stdin.close()
            code = process.wait()
        except BaseException:
            process.kill()
            process.wait()
            raise
    if code:
        raise RuntimeError(log.read_text(encoding='utf-8', errors='replace'))
    print(json.dumps({'id': config['id'], 'frames': len(config['frames']),
                      'duration': config['duration'], 'bytes': Path(output).stat().st_size}))


if __name__ == '__main__':
    main()
