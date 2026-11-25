#!/usr/bin/env python3
"""Build the silent Rhomb Pendulum film from the published axis-coloured GIFs."""

import argparse
from pathlib import Path
import subprocess


def main():
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ffmpeg', default='ffmpeg')
    parser.add_argument('--output', type=Path, default=root / 'rezultaty/romb-axes-720p.mp4')
    args = parser.parse_args()

    source = root / 'issledovanie/wolfram-nks/romb-gifs/axes'
    sizes = (8, 16, 32, 64, 128)
    clips = [source / f'{size}-{phase}.gif' for size in sizes for phase in ('before', 'cycle')]
    command = [args.ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-filter_complex_threads', '2']
    filters = []
    for i, clip in enumerate(clips):
        command.extend(('-ignore_loop', '1', '-i', str(clip)))
        filters.append(
            f'[{i}:v]fps=25,scale=1280:720:force_original_aspect_ratio=decrease:'
            f'force_divisible_by=2:flags=neighbor,pad=1280:720:(ow-iw)/2:(oh-ih)/2:'
            f'color=0x0b1620,setsar=1,format=yuv420p[v{i}]'
        )
    timeline = ''.join(f'[v{i}]' for i in range(len(clips)))
    filters.append(f'{timeline}concat=n={len(clips)}:v=1:a=0[film]')
    command.extend((
        '-filter_complex', ';'.join(filters), '-map', '[film]', '-an', '-c:v', 'libx264',
        '-preset', 'fast', '-crf', '19', '-threads', '4', '-movflags', '+faststart',
        str(args.output),
    ))
    subprocess.run(command, check=True)


if __name__ == '__main__':
    main()
