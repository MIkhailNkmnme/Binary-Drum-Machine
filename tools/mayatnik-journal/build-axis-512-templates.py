"""Build the native Mayatnik template bank from the indexed central-axis GIF."""

import argparse
from base64 import b64decode, b64encode
from hashlib import sha256
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
GIF = ROOT / "issledovanie/central-axis-film/central-axis-source.gif"
INDEX = ROOT / "issledovanie/image-journal/recipes/totem-axis-catalog/frame-index.json"
OUTPUT = ROOT / "mayatnik/mayatnik-axis-512-data.js"


def pack_rle(pixels):
    result = bytearray()
    colour = pixels[0]
    length = 0
    for index in pixels:
        if index != colour or length == 32:
            result.append(((length - 1) << 3) | colour)
            colour = index
            length = 0
        length += 1
    result.append(((length - 1) << 3) | colour)
    return b64encode(result).decode("ascii")


class Palette:
    def __init__(self):
        self.colours = [(0, 0, 0)]
        self.indices = {(0, 0, 0): 0}

    def encode(self, crop):
        pixels = bytearray()
        raw = crop.tobytes()
        for offset in range(0, len(raw), 3):
            colour = tuple(raw[offset:offset + 3])
            if colour not in self.indices:
                if len(self.colours) == 8:
                    raise ValueError("The packed GIF palette exceeds eight colours")
                self.indices[colour] = len(self.colours)
                self.colours.append(colour)
            pixels.append(self.indices[colour])
        return pack_rle(pixels)

    def decode(self, payload, size):
        colours = [bytes(colour) for colour in self.colours]
        result = bytearray()
        for run in b64decode(payload):
            result.extend(colours[run & 7] * ((run >> 3) + 1))
        return Image.frombytes("RGB", size, bytes(result))


def build(source, index):
    source_sha = sha256(source.read_bytes()).hexdigest()
    if source_sha != index["source_sha256"]:
        raise ValueError("The GIF does not match the journal index")

    palette = Palette()
    frames = []
    bands = []
    variants = {}
    restored = {}
    first_occurrences = {}
    elapsed = next_row = 0
    for band in index["bands"]:
        start, stop = band["rows"]
        if start != next_row or stop <= start:
            raise ValueError("Band rows must cover the image in order")
        next_row = stop
        bands.append({"number": band["number"], "title": band["title"],
                      "rows": band["rows"], "variants": []})
        for variant in band["variants"]:
            key = (band["number"], variant["number"])
            if key in variants:
                raise ValueError(f"Duplicate variant {key}")
            variants[key] = variant

    with Image.open(source) as gif:
        if (list(gif.size) != index["size"] or
                gif.n_frames != len(index["frames"]) or next_row != gif.height):
            raise ValueError("The indexed frames or bands do not match the GIF dimensions")

        for number, frame in enumerate(index["frames"]):
            gif.seek(number)
            image = gif.convert("RGB")
            frame_digest = sha256(image.tobytes()).hexdigest()
            first = first_occurrences.setdefault(frame_digest, number)
            duration = gif.info.get("duration")
            if (frame["frame"] != number or frame["sha256"] != frame_digest or
                    frame["same_as"] != (first if first != number else None) or
                    frame["start_ms"] != elapsed or frame["duration_ms"] != duration):
                raise ValueError(f"Frame {number} does not match the journal index")

            assembled = Image.new("RGB", gif.size)
            for band, variant_number in zip(bands, frame["bands"], strict=True):
                if variant_number is None:
                    continue
                key = (band["number"], variant_number)
                if key not in restored:
                    variant = variants[key]
                    top, bottom = band["rows"]
                    strip = image.crop((0, top, gif.width, bottom))
                    bounds = strip.getbbox()
                    if (bounds is None or variant["first_frame"] != number or
                            variant["sha256"] != sha256(strip.tobytes()).hexdigest() or
                            (variant["left"], variant["right"]) != (bounds[0], bounds[2])):
                        raise ValueError(f"Variant {key} does not match frame {number}")
                    left, first_row, right, last_row = bounds
                    crop = strip.crop(bounds)
                    payload = palette.encode(crop)
                    copy = palette.decode(payload, crop.size)
                    if copy.tobytes() != crop.tobytes():
                        raise ValueError(f"Packed pixels differ for variant {key}")
                    position = (left, top + first_row)
                    restored[key] = (copy, position)
                    counts = [0, 0]
                    for count, colour in crop.getcolors(8):
                        if colour == (0, 0, 139):
                            counts[0] += count
                        elif colour in ((255, 233, 105), (255, 215, 0)):
                            counts[1] += count
                    band["variants"].append([variant_number, number, *position,
                                             right - left, last_row - first_row, counts, payload])
                copy, position = restored[key]
                assembled.paste(copy, position)

            if assembled.tobytes() != image.tobytes():
                raise ValueError(f"The packed bands do not reconstruct frame {number}")
            frames.append([number, elapsed, duration, frame["same_as"], frame["bands"]])
            elapsed += duration

    if (len(frames) != index["frame_count"] or len(restored) != len(variants) or
            len(restored) != index["band_variant_count"] or elapsed != index["duration_ms"] or
            len(first_occurrences) != index["unique_frame_count"]):
        raise ValueError("The packed counts or duration do not match the journal index")
    return {
        "version": 1,
        "size": index["size"],
        "source": {"url": index["source_url"], "sha256": source_sha},
        "palette": ["#{:02x}{:02x}{:02x}".format(*colour) for colour in palette.colours],
        "bands": bands,
        "frames": frames,
    }


def write_package(destination, package):
    def encoded(value):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))

    with destination.open("w", encoding="utf-8", newline="\n") as out:
        out.write("/* Generated by tools/mayatnik-journal/build-axis-512-templates.py. */\n")
        out.write("window.MayatnikAxis512Data = {\n")
        for key in ("version", "size", "source", "palette"):
            out.write(f"  {key}: {encoded(package[key])},\n")
        out.write("  bands: [\n")
        for band in package["bands"]:
            out.write(f"    {{number: {band['number']}, title: {encoded(band['title'])}, "
                      f"rows: {encoded(band['rows'])}, variants: [\n")
            for variant in band["variants"]:
                out.write(f"      {encoded(variant)},\n")
            out.write("    ]},\n")
        out.write("  ],\n  frames: [\n")
        for frame in package["frames"]:
            out.write(f"    {encoded(frame)},\n")
        out.write("  ]\n};\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=GIF)
    parser.add_argument("--index", type=Path, default=INDEX)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    index = json.loads(args.index.read_text(encoding="utf-8"))
    package = build(args.source, index)
    write_package(args.output, package)
    count = sum(len(band["variants"]) for band in package["bands"])
    print(f"{len(package['frames'])} verified frames; {count} verified crops; "
          f"{args.output.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
