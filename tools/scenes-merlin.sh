#!/usr/bin/env bash
# Раскладка под Lee Van Dowski — «Waiting For Merlin» (6:43, 126 BPM).
# Доля 0.476 сек, такт 1.905 сек. Границы сцен поставлены по карте секций:
# минутное вступление, провал 2:55-3:33 и сплошной разгон с 4:57 до конца.
set -u
cd "$(dirname "$0")/.."
FPS=30; BPM=126; FONT=22
zerk () { local out=$1 recipe=$2 beats=$3 spb=$4; shift 4
  [ -f "renders/masters/$out.mp4" ] && { echo "$out — уже есть"; return; }
  node tools/master.js --recipe "$recipe" --bpm $BPM --beats "$beats" --fps $FPS \
       --font $FONT --stepsPerBeat "$spb" --out "$out" "$@"; }
code () { local out=$1 scene=$2 beats=$3 spb=$4; shift 4
  [ -f "renders/masters/$out.mp4" ] && { echo "$out — уже есть"; return; }
  node tools/master-code.js --scene "$scene" --bpm $BPM --beats "$beats" --fps $FPS \
       --stepsPerBeat "$spb" --out "$out" "$@"; }
#    имя                      рецепт/сцена  доли  шаг   флаги               время      что происходит
zerk m01-000-061-ghost         ghost         128  0.25            # 0:00-1:01 долгое вступление
zerk m02-061-091-k1            k1             64  1               # 1:01-1:31 вступает ритм
code m03-091-122-code          sourcecode     64  0.5   --syntax  # 1:31-2:02 провал: кольца кода
zerk m04-122-175-k1-fast       k1            112  2               # 2:02-2:55 разгон
zerk m05-175-213-ghost         ghost          80  0.5             # 2:55-3:33 большой брейк
zerk m06-213-270-xray          xray          120  1               # 3:33-4:30 цветной блок
code m07-270-297-wormhole      wormhole       56  1     --syntax  # 4:30-4:57 червоточина
code m08-297-340-hypnosis      hypnosis       90  2     --syntax --reverse  # 4:57-5:40 гипноз назад
zerk m09-340-375-k2            k2             74  1               # 5:40-6:15 янтарь
code m10-375-404-code-final    sourcecode     61  1     --syntax  # 6:15-6:44 финал в кольцах кода
echo "сцены Merlin готовы"
