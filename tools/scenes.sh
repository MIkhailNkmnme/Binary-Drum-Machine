#!/usr/bin/env bash
# Раскладка сцен под «Laniakea» (100.00 BPM, 201 такт). Такт = 4 доли = 2.4 сек.
# Аргументы сцены: имя  рецепт  доли  шагов_на_долю
set -u
cd "$(dirname "$0")/.."
FPS=30; BPM=100; FONT=22
run () {
  local out=$1 recipe=$2 beats=$3 spb=$4
  [ -f "renders/masters/$out.mp4" ] && { echo "$out — уже есть, пропускаю"; return; }
  node tools/master.js --recipe "$recipe" --bpm $BPM --beats "$beats" --fps $FPS \
       --font $FONT --stepsPerBeat "$spb" --out "$out"
}
#    имя файла                 рецепт  доли  шаг/долю   такты       что происходит
run s01-bars000-008-k1-slow     k1       32   0.25    # 0-8     интро: шаг раз в такт
run s02-bars008-032-k1          k1       96   1       # 8-32    основной ход
run s03-bars032-064-k1-fast     k1      128   2       # 32-64   вдвое чаще на полном ходу
run s04-bars064-072-ghost       ghost    32   0.5     # 64-72   первый брейк
run s05-bars072-096-xray        xray     96   1       # 72-96   цветной взрыв
run s06-bars096-104-radar       radar    32   1       # 96-104  второй брейк: плоскость в диск
run s07-bars104-132-k2          k2      112   1       # 104-132 янтарь
run s08-bars132-160-k1-fast     k1      112   2       # 132-160 возврат крови
run s09-bars160-168-ghost       ghost    32   0.5     # 160-168 третий брейк
run s10-bars168-192-gpu         gpu      96   1       # 168-192 кульминация на GPU
run s11-bars192-201-k1-slow     k1       40   0.25    # 192-201 затухание
echo "все сцены готовы"
