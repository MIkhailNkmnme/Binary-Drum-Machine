"""Build the whole-figure atlas from the indexed 512-row Mayatnik GIF."""

import argparse
from base64 import b64decode
from hashlib import sha256
import json
from pathlib import Path
import re
from runpy import run_path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
GIF = ROOT / "issledovanie/central-axis-film/central-axis-source.gif"
INDEX = ROOT / "issledovanie/image-journal/recipes/totem-axis-catalog/frame-index.json"
BANK = ROOT / "mayatnik/mayatnik-axis-512-data.js"
OUTPUT = ROOT / "mayatnik/mayatnik-axis-512-atlas-data.js"
ROLES = {"#00008b": 1, "#ffe969": 2, "#ffd700": 2}


def read_palette(bank):
    match = re.search(r"(?m)^\s*palette: *(\[[^\r\n]+\]), *$",
                      bank.read_text(encoding="utf-8"))
    if match is None:
        raise ValueError("Cannot read the Mayatnik template bank palette")
    palette = json.loads(match[1])
    if (not palette or palette[0] != "#000000" or len(palette) > 8 or
            len(set(palette)) != len(palette) or not ROLES.keys() <= set(palette)):
        raise ValueError("The Mayatnik template bank palette is incompatible")
    return palette


def connected_masks(pixels, width, height):
    pending = bytearray(pixels)
    for seed in range(len(pending)):
        if not pending[seed]:
            continue
        pending[seed] = 0
        component = [seed]
        top, left = divmod(seed, width)
        bottom, right = top, left
        for offset in component:
            y, x = divmod(offset, width)
            top, left = min(top, y), min(left, x)
            bottom, right = max(bottom, y), max(right, x)
            for ny in range(max(0, y - 1), min(height, y + 2)):
                row = ny * width
                for nx in range(max(0, x - 1), min(width, x + 2)):
                    neighbor = row + nx
                    if pending[neighbor]:
                        pending[neighbor] = 0
                        component.append(neighbor)

        crop_width, crop_height = right - left + 1, bottom - top + 1
        crop = bytearray(crop_width * crop_height)
        for offset in component:
            y, x = divmod(offset, width)
            crop[(y - top) * crop_width + x - left] = pixels[offset]
        yield left, top, crop_width, crop_height, crop


def unpack(payload):
    result = bytearray()
    for run in b64decode(payload, validate=True):
        result.extend(bytes([run & 7]) * ((run >> 3) + 1))
    return result


def index_frames(gif, index):
    if (list(gif.size) != index["size"] or gif.n_frames != index["frame_count"]
            or gif.n_frames != len(index["frames"])):
        raise ValueError("The GIF dimensions or frame count differ from the journal index")
    first_frames = {}
    elapsed = 0
    for number, frame in enumerate(index["frames"]):
        gif.seek(number)
        image = gif.convert("RGB")
        digest = sha256(image.tobytes()).hexdigest()
        first = first_frames.setdefault(digest, number)
        duration = gif.info.get("duration")
        if (frame["frame"] != number or frame["sha256"] != digest
                or frame["same_as"] != (first if first != number else None)
                or frame["start_ms"] != elapsed or frame["duration_ms"] != duration):
            raise ValueError(f"Frame {number} does not match the journal index")
        elapsed += duration
        yield number, image

    if elapsed != index["duration_ms"] or len(first_frames) != index["unique_frame_count"]:
        raise ValueError("The GIF duration or unique frame count differ from the journal index")


def band_boundaries(index):
    boundaries = []
    row = 0
    for band in index["bands"]:
        start, stop = band["rows"]
        if start != row or stop <= start:
            raise ValueError("Indexed bands must cover the image in order")
        row = stop
        boundaries.append(row)
    if row != index["size"][1]:
        raise ValueError("Indexed bands do not cover the image")
    return boundaries[:-1]


def build(source, index, palette):
    source_sha = sha256(source.read_bytes()).hexdigest()
    if source_sha != index["source_sha256"]:
        raise ValueError("The GIF does not match the journal index")
    pack_rle = run_path(str(Path(__file__).with_name("build-axis-512-templates.py")))["pack_rle"]
    boundaries = band_boundaries(index)
    known_indices = {tuple(bytes.fromhex(colour[1:])): i
                     for i, colour in enumerate(palette) if colour in ROLES}
    role_table = bytes(ROLES.get(colour, 0) for colour in palette).ljust(256, b"\0")
    records = []
    by_mask = {}

    with Image.open(source) as gif:
        for number, image in index_frames(gif, index):
            bounds = image.getbbox()
            if bounds is None:
                continue
            crop = image.crop(bounds)
            flatten = getattr(crop, "get_flattened_data", crop.getdata)
            pixels = bytearray(known_indices.get(rgb, 0) for rgb in flatten())
            reconstructed = bytearray(len(pixels))
            components = sorted(connected_masks(pixels, *crop.size),
                                key=lambda shape: (shape[1], shape[0]))
            for x, y, width, height, preview in components:
                mask = bytes(preview.translate(role_table))
                signature = (width, height, mask)
                if signature not in by_mask:
                    payload = pack_rle(preview)
                    restored = unpack(payload)
                    if restored != preview:
                        raise ValueError(f"Packed preview differs in frame {number}")
                    record = [width, height, [mask.count(1), mask.count(2)], payload, []]
                    records.append(record)
                    by_mask[signature] = (record, restored.translate(role_table))

                record, restored = by_mask[signature]
                left, top = bounds[0] + x, bounds[1] + y
                crosses = any(top < boundary < top + height for boundary in boundaries)
                record[4].append([number, left, top, crosses])
                for offset, role in enumerate(restored):
                    if role:
                        dy, dx = divmod(offset, width)
                        position = (top - bounds[1] + dy) * crop.width + left - bounds[0] + dx
                        if reconstructed[position]:
                            raise ValueError(f"Two figures claim the same pixel in frame {number}")
                        reconstructed[position] = role

            if reconstructed != pixels.translate(role_table):
                raise ValueError(f"Atlas occurrences do not reproduce the bit roles in frame {number}")

    return source_sha, records


def write_package(destination, source_sha, palette, records):
    def encoded(value):
        return json.dumps(value, separators=(",", ":"))

    with destination.open("w", encoding="utf-8", newline="\n") as out:
        out.write("/* Generated by tools/mayatnik-journal/build-axis-512-atlas.py. */\n")
        out.write("window.MayatnikAxis512AtlasData = {\n  version: 1,\n")
        out.write(f"  sourceSha256: {encoded(source_sha)},\n")
        out.write(f"  palette: {encoded(palette)},\n  records: [\n")
        for record in records:
            out.write(f"    {encoded(record)},\n")
        out.write("  ]\n};\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=GIF)
    parser.add_argument("--index", type=Path, default=INDEX)
    parser.add_argument("--bank", type=Path, default=BANK)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    index = json.loads(args.index.read_text(encoding="utf-8"))
    palette = read_palette(args.bank)
    source_sha, records = build(args.source, index, palette)
    write_package(args.output, source_sha, palette, records)
    occurrences = sum(len(record[4]) for record in records)
    crossing = sum(count for record in records for _, _, _, count in record[4])
    print(f"{index['frame_count']} verified frames; {len(records)} figures; "
          f"{occurrences} occurrences; {crossing} crossing a band boundary; "
          f"{args.output.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
