#!/usr/bin/env bash
# Раскладка под Venetian Snares — «galamb egyeduel» (1:37, ровной сетки нет).
# Шаг идёт по реальным ударам из renders/vsnares-steps.json, а не по долям:
# у трека разброс интервалов почти равен самому интервалу.
set -u
cd "$(dirname "$0")/.."
STEPS=renders/vsnares-steps.json
FPS=30; FONT=22
zerk () { local out=$1 recipe=$2 from=$3 secs=$4; shift 4
  [ -f "renders/masters/$out.mp4" ] && { echo "$out — уже есть"; return; }
  node tools/master.js --recipe "$recipe" --steps $STEPS --from "$from" --seconds "$secs" \
       --fps $FPS --font $FONT --out "$out" "$@"; }
code () { local out=$1 scene=$2 from=$3 secs=$4; shift 4
  [ -f "renders/masters/$out.mp4" ] && { echo "$out — уже есть"; return; }
  node tools/master-code.js --scene "$scene" --steps $STEPS --from "$from" --seconds "$secs" \
       --fps $FPS --out "$out" "$@"; }
#    имя                   рецепт/сцена  с сек  длина            что происходит
zerk vs1-000-015-ghost      ghost          0     15.3            # тихое вступление
zerk vs2-015-034-k1         k1            15.3   18.7            # вступает ритм
code vs3-034-050-code       sourcecode    34.0   15.7  --syntax  # кольца кода
code vs4-050-069-hypnosis   hypnosis      50.0   18.8  --syntax --reverse  # гипноз назад
code vs5-069-083-wormhole   wormhole      69.0   14.0  --syntax  # червоточина
zerk vs6-083-097-k1-rev     k1            83.0   13.9  --reverse # финал задом наперёд
echo "сцены Venetian Snares готовы"
