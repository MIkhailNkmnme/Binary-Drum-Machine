"""Decode every encoded frame in the five on-site GIF collections."""

import hashlib
import json
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[2] / "issledovanie/wolfram-nks/romb-gifs"


def records():
    variants = []
    for series in ("draft", "axes", "diamonds", "sizes", "contact"):
        folder = ROOT if series == "draft" else ROOT / series
        for entry in json.loads((folder / "index.json").read_text(encoding="utf-8")):
            for phase in ("before", "cycle") if "before" in entry else ("full",):
                clip = entry if phase == "full" else entry[phase]
                variants.append((entry["rows"], series, phase, folder, entry, clip))
    return sorted(variants, key=lambda variant: variant[0])


def scan(variant, ffmpeg):
    rows, series, phase, folder, entry, clip = variant
    file = folder / clip["file"]
    width, height = entry["gifWidth"], entry["gifHeight"]
    overview = entry.get("overview", False)
    block = entry.get("block", 1)
    band = entry.get("band", 0)
    if phase == "full":
        band = height - (rows // block if overview else rows * max(1, 96 // rows))
    indices = clip["frames"]
    if isinstance(indices, int):
        indices = list(range(clip["from"], clip["to"] + 1))
    counts = dict(frames=0, blank=0, repeated=0, vertical=0, horizontal=0, halfTurn=0)
    examples = {}
    seen = {}
    stride = 4 * width
    command = [
        ffmpeg, "-v", "error", "-ignore_loop", "1", "-i", str(file),
        "-an", "-vsync", "0", "-threads", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "-",
    ]
    with subprocess.Popen(command, stdout=subprocess.PIPE) as process:
        while frame := process.stdout.read(stride * height):
            index = counts["frames"]
            if len(frame) != stride * height or index >= len(indices):
                raise ValueError(f"Некорректный кадр {index} в {file}")
            counts["frames"] += 1
            raster = frame[band * stride:]
            key = hashlib.sha256(raster).digest()
            if raster == raster[:4] * (len(raster) // 4):
                counts["blank"] += 1
                continue
            if key in seen:
                counts["repeated"] += 1
                examples.setdefault("repeat", [seen[key], indices[index]])
            seen.setdefault(key, indices[index])
            bands = [raster[i:i + stride] for i in range(0, len(raster), stride)]
            if bands == bands[::-1]:
                counts["horizontal"] += 1
                examples.setdefault("horizontal", indices[index])

            def mirror(row):
                flipped = bytearray(stride)
                for channel in range(4):
                    flipped[channel::4] = row[channel::4][::-1]
                return flipped

            if all(row == mirror(row) for row in bands):
                counts["vertical"] += 1
                examples.setdefault("vertical", indices[index])
            if all(row == mirror(other) for row, other in zip(bands, reversed(bands))):
                counts["halfTurn"] += 1
                examples.setdefault("halfTurn", indices[index])
        if process.wait():
            raise RuntimeError(f"FFmpeg не прочитал {file}")
    if counts["frames"] != len(indices):
        raise ValueError(f"{file}: считано {counts['frames']}, ожидалось {len(indices)}")
    return dict(rows=rows, width=entry["width"], series=series, phase=phase,
                path=str(file.relative_to(ROOT)), overview=overview, block=block,
                band=band, pixels=[width, height], **counts, examples=examples)


if __name__ == "__main__":
    for record in records():
        print(json.dumps(scan(record, sys.argv[1] if len(sys.argv) > 1 else "ffmpeg")), flush=True)
