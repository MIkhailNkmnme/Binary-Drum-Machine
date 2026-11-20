# Convert the existing author recording, without running the model.
# Full 43.8-second input; no audio; original 5/3 fps; 640-pixel width.
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$sourcePath = Join-Path $repoRoot 'rezultaty/mayatnik-tochka-os-1.mp4'
$outputPath = Join-Path $PSScriptRoot 'tochka-os-1.gif'
ffmpeg -hide_banner -loglevel error -y -i $sourcePath -an -filter_complex '[0:v]scale=640:-2:flags=neighbor,split[a][b];[a]palettegen=max_colors=128:reserve_transparent=0[p];[b][p]paletteuse=dither=none' -loop 0 $outputPath

