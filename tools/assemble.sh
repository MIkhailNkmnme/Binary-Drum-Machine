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

# -shortest с filter_complex хвост не режет — берём длину звука и ставим -t явно
ADUR=$("$FF" -i "$TRACK" 2>&1 | sed -n 's/.*Duration: \([0-9:.]*\).*/\1/p' \
       | awk -F: '{printf "%.3f", $1*3600 + $2*60 + $3}')
FADE=$(awk -v d="$ADUR" 'BEGIN{printf "%.2f", d-5}')
echo "длина звука: $ADUR сек, затемнение с $FADE"

"$FF" -y -v error -i renders/_video.mp4 -i "$TRACK" -t "$ADUR" \
  -filter_complex "[0:v]fade=t=in:st=0:d=1.5,fade=t=out:st=$FADE:d=4[v];[1:a]afade=t=out:st=$FADE:d=4[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart "$OUT"
rm -f renders/_video.mp4 "$LIST"
echo "готово: $OUT"
