#!/usr/bin/env bash
# Сборка финала: сцены по порядку + трек + затемнения на концах.
#
#   FFMPEG=/путь/к/ffmpeg bash tools/assemble.sh трек.mp3 renders/final.mp4
#
# Сцены склеиваются без перекодирования, затем один общий проход с фейдами
# и звуком. Видео чуть длиннее трека — лишнее обрезается по звуку (-shortest).
set -eu
cd "$(dirname "$0")/.."
FF=${FFMPEG:-ffmpeg}
TRACK=$1
OUT=${2:-renders/final.mp4}
LIST=$(mktemp)
for f in renders/masters/s*.mp4; do echo "file '$PWD/$f'" >> "$LIST"; done
echo "сцен в сборке: $(wc -l < "$LIST")"

"$FF" -y -v error -f concat -safe 0 -i "$LIST" -c copy renders/_video.mp4
DUR=$("$FF" -i renders/_video.mp4 2>&1 | sed -n 's/.*Duration: \([0-9:.]*\).*/\1/p')
echo "длина видеоряда: $DUR"

"$FF" -y -v error -i renders/_video.mp4 -i "$TRACK" \
  -filter_complex "[0:v]fade=t=in:st=0:d=1.5,fade=t=out:st=478:d=4[v];[1:a]afade=t=out:st=478:d=4[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart -shortest "$OUT"
rm -f renders/_video.mp4 "$LIST"
echo "готово: $OUT"
