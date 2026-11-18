#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Produce robot WAVs, the requested legacy origin comparison, and a source ZIP.
Run from repository/archive root: python voice/robot/build.py --node node
No NumPy, audio-input files, playback, browser or additional tests are used.
"""
import argparse
import hashlib
import json
from pathlib import Path
import platform
import subprocess
import sys
import zipfile

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--node', default='node')
    args = parser.parse_args()
    subprocess.run([args.node, str(HERE / 'build.cjs')], cwd=ROOT, check=True)
    manifest_file = HERE / 'manifest.json'
    manifest = json.loads(manifest_file.read_text(encoding='utf-8'))
    manifest['pythonPackager'] = platform.python_version()
    manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    files = [ROOT / entry['file'] for entry in manifest['sourceFiles']]
    files += [ROOT / 'ЗВУК.md', HERE / 'README.md', HERE / 'catalog.json', manifest_file, HERE / 'origin-comparison.json',
              ROOT / 'audit/reports/2026-11-18-robot-origin.json', ROOT / 'music/voices/phone-helper.cjs']
    files += [HERE / item['file'] for item in manifest['items'] + manifest['sequences']]
    archive = HERE / 'zerkalius-robot-russian.zip'
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as output:
        for file in files:
            info = zipfile.ZipInfo(file.relative_to(ROOT).as_posix(), (2026, 11, 18, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            output.writestr(info, file.read_bytes())
    receipt = {'file': archive.name, 'bytes': archive.stat().st_size,
               'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
               'content': '43 freshly computed WAVs, complete recipes, source, provenance and the authorized origin comparison.'}
    (HERE / 'archive.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'ZIP: {receipt["bytes"]} bytes; SHA256 {receipt["sha256"]}')


if __name__ == '__main__':
    main()
