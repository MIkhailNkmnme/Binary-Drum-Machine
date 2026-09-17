#!/usr/bin/env bash
# Раскладка сцен под «Laniakea» (100.00 BPM, 201 такт). Такт = 4 доли = 2.4 сек.
# Скорость и направление меняются по ходу: от шага раз в такт на интро
# до двойного шага на полном ходу, с ходом назад на двух блоках.
set -u
cd "$(dirname "$0")/.."
FPS=30; BPM=100; FONT=22
zerk () {   # сцены Genezis: имя рецепт доли шаг/долю [доп. флаги]
  local out=$1 recipe=$2 beats=$3 spb=$4; shift 4
  [ -f "renders/masters/$out.mp4" ] && { echo "$out — уже есть"; return; }
  node tools/master.js --recipe "$recipe" --bpm $BPM --beats "$beats" --fps $FPS \
       --font $FONT --stepsPerBeat "$spb" --out "$out" "$@"
}
code () {   # сцены кодовой машины: имя сцена доли шаг/долю [доп. флаги]
  local out=$1 scene=$2 beats=$3 spb=$4; shift 4
  [ -f "renders/masters/$out.mp4" ] && { echo "$out — уже есть"; return; }
  node tools/master-code.js --scene "$scene" --bpm $BPM --beats "$beats" --fps $FPS \
       --stepsPerBeat "$spb" --out "$out" "$@"
}
#     имя файла                  рецепт/сцена  доли  шаг   флаги          такты    что происходит
zerk s01-bars000-008-k1-slow      k1            32   0.25           # 0-8     интро: шаг раз в такт
zerk s02-bars008-032-k1           k1            96   1              # 8-32    основной ход
zerk s03-bars032-064-k1-fast      k1           128   2              # 32-64   вдвое чаще
zerk s04-bars064-072-ghost        ghost         32   0.5            # 64-72   первый брейк
zerk s05-bars072-096-xray         xray          96   1              # 72-96   цветной взрыв
code s06-bars096-104-code         sourcecode    32   0.5  --syntax  # 96-104  второй брейк: кольца кода
code s07-bars104-118-wormhole     wormhole      56   1    --syntax  # 104-118 червоточина
code s08-bars118-132-hypnosis     hypnosis      56   2    --syntax --reverse  # 118-132 туннель назад
zerk s09-bars132-160-k1-rev       k1           112   2    --reverse # 132-160 кровь задом наперёд
zerk s10-bars160-168-ghost        ghost         32   0.5            # 160-168 третий брейк
code s11-bars168-192-code-syntax  sourcecode    96   1    --syntax  # 168-192 кульминация: цвет как код
zerk s12-bars192-201-k1-slow      k1            40   0.25           # 192-201 затухание
echo "все сцены готовы"
