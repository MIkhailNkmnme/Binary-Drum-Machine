"""Build the YouTube versions of five GIFs from the picture journal."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
GIFS = ROOT / "issledovanie/image-journal/rhomb-collection/gifs"
GALLERY = "https://1001100.online/issledovanie/image-journal/rhomb-collection/gifs.html"
SOURCES = "https://github.com/MIkhailNkmnme/Binary-Drum-Machine/tree/main/issledovanie"
CHANNEL = "UClRqXH-ow5WtTR8WXqZwE6w"
WIDTH, HEIGHT, FPS = 2560, 1440, 25
ITEMS = (
    ("field-2-reverse-xor", "Разворот ромбов при касании · XOR | Зеркалиус"),
    ("field-2-wrap-and", "Перескок ромбов · накопление AND | Зеркалиус"),
    ("join-right", "Склейка ромбового поля вправо | Зеркалиус"),
    ("coin-overlay", "Ромб-монета · наложение двух ветвей | Зеркалиус"),
    ("hub-vertical-axes", "Ромбы вверх-вниз · цветные оси | Зеркалиус"),
)


def sha256(path):
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def build(ffmpeg, output, item, title):
    source = GIFS / item["file"]
    if sha256(source) != item["sha256"] or item["duration"] != 180000:
        raise ValueError(f"Исходный GIF не совпадает с рецептом {source.name}.")

    file = output / f'{item["id"]}.mp4'
    temp = file.with_suffix(".part.mp4")
    scale = min(WIDTH // item["width"], HEIGHT // item["height"])
    if scale < 1:
        raise ValueError(f"Исходное изображение не помещается в кадр {source.name}.")
    video_filter = (
        f"scale=iw*{scale}:ih*{scale}:flags=neighbor:out_color_matrix=bt709,"
        f"pad={WIDTH}:{HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=0x101317,"
        f"fps={FPS},format=yuv420p"
    )
    subprocess.run([
        ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-ignore_loop", "1",
        "-i", str(source), "-map", "0:v:0", "-an", "-filter_threads", "1", "-vf", video_filter,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-threads", "4",
        "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
        "-movflags", "+faststart", "-t", "180", str(temp),
    ], check=True)
    info = subprocess.run([ffmpeg, "-hide_banner", "-i", str(temp)], capture_output=True, text=True).stderr
    if ("Duration: 00:03:00.00" not in info or
            not re.search(rf"Video: h264[^\n]+{WIDTH}x{HEIGHT}[^\n]+{FPS} fps", info) or
            re.search(r"Stream #.+: Audio:", info)):
        raise ValueError(f"Метаданные MP4 не совпадают с рецептом {file.name}.")
    temp.replace(file)
    origin = GALLERY + "#" + item["id"]
    keys = ", ".join(str(key["frame"]) for key in item["keys"])
    description = (
        f'{item["name"]}. Ромбовый Маятник на поле в {item["rows"]} строк. '
        f'Опорные кадры {keys}, шаг внутри каждой фазы 4.\n\n'
        'Самостоятельная трёхминутная анимация из вычисленных кадров Зеркалиуса. '
        'Видео без звуковой дорожки.\n\n'
        f'Оригинальная GIF в Журнале картинок\n{origin}\n\n'
        f'Зеркалиус\nhttps://1001100.online/\n\nИсходники и исследования\n{SOURCES}'
    )
    print(f'{file.name} · 3:00 · {file.stat().st_size:,} байт', flush=True)
    return {
        "title": title, "description": description, "source": origin,
        "gif": item["file"], "gifSha256": item["sha256"], "keyFrames": [key["frame"] for key in item["keys"]],
        "file": file.name, "sha256": sha256(file), "bytes": file.stat().st_size,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    metadata = json.loads((GIFS / "index.json").read_text(encoding="utf-8"))
    by_id = {item["id"]: item for item in metadata["items"]}
    with ThreadPoolExecutor(max_workers=2) as pool:
        pending = [pool.submit(build, args.ffmpeg, args.output, by_id[slug], title) for slug, title in ITEMS]
        items = [job.result() for job in pending]
    manifest = {
        "channel": CHANNEL, "visibility": "public", "durationSeconds": 180,
        "width": WIDTH, "height": HEIGHT, "fps": FPS, "audio": False,
        "encoder": subprocess.check_output([args.ffmpeg, "-version"], text=True).splitlines()[0],
        "items": items,
    }
    (args.output / "youtube-ready.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
