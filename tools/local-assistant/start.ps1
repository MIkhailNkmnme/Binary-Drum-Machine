param(
    [int]$Port = 11435,
    [string]$Python = '',
    [string]$OllamaExe = '',
    [string]$Models = $(if ($env:OLLAMA_MODELS) { $env:OLLAMA_MODELS } else { 'E:\OllamaModels\models' })
)
$ErrorActionPreference = 'Stop'
if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Недопустимый порт.' }
$runtime = Join-Path $env:LOCALAPPDATA 'Zerkalius\assistant'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$pidFile = Join-Path $runtime 'service.json'
$server = Join-Path $PSScriptRoot 'server.py'

function Get-LocalHealth([string]$Url) {
    try { return Invoke-RestMethod -Uri $Url -TimeoutSec 3 -ErrorAction Stop } catch { return $null }
}

function Get-RecordedUtcTicks($Value) {
    if ($Value -is [DateTime]) { return $Value.ToUniversalTime().Ticks }
    if ($Value -is [DateTimeOffset]) { return $Value.UtcDateTime.Ticks }
    return [DateTimeOffset]::Parse([string]$Value, [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::None).UtcDateTime.Ticks
}

$healthUrl = "http://127.0.0.1:$Port/api/health"
$existing = Get-LocalHealth $healthUrl
if ($existing -and $existing.local -eq $true -and $existing.model -eq 'gpt-oss:20b') {
    Write-Output "Помощник уже запущен: http://127.0.0.1:$Port/mayatnik/Zerkalius-mayatnik.html"
    return
}
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    throw "Порт $Port уже занят. Выберите другой -Port (и измените адрес в панели помощника)."
}
if (-not $Python) {
    $candidates = @('C:\Python313\python.exe', 'C:\Python312\python.exe')
    $Python = $candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
    if (-not $Python) {
        $command = Get-Command python.exe -ErrorAction SilentlyContinue
        if ($command -and $command.Source -notlike '*\WindowsApps\*') { $Python = $command.Source }
    }
}
if (-not $Python -or -not (Test-Path -LiteralPath $Python -PathType Leaf)) {
    throw 'Python 3.10+ не найден. Укажите -Python полный\путь\python.exe.'
}
$Python = (Resolve-Path -LiteralPath $Python).Path
$ollamaPid = $null
$ollamaStarted = $null
# Retain ownership across a regular stop/start, but never adopt another Ollama instance.
if (Test-Path -LiteralPath $pidFile -PathType Leaf) {
    try {
        $previousRecord = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
        if ($previousRecord.ollamaPid) {
            $previousProcess = Get-Process -Id $previousRecord.ollamaPid -ErrorAction SilentlyContinue
            if ($previousProcess -and $previousProcess.Path -eq $previousRecord.ollamaExe -and
                $previousProcess.StartTime.ToUniversalTime().Ticks -eq (Get-RecordedUtcTicks $previousRecord.ollamaStarted)) {
                $ollamaPid = $previousRecord.ollamaPid
                $ollamaStarted = $previousRecord.ollamaStarted
                $OllamaExe = $previousRecord.ollamaExe
            }
        }
    } catch { Write-Warning 'Старая запись о запуске не прочитана; чужие процессы не будут остановлены.' }
}
if (-not (Get-LocalHealth 'http://127.0.0.1:11434/api/tags')) {
    if (-not $OllamaExe) { $OllamaExe = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe' }
    if (-not (Test-Path -LiteralPath $OllamaExe -PathType Leaf)) {
        throw 'Ollama не найдена. Укажите -OllamaExe путь к ollama.exe. Загрузок скрипт не выполняет.'
    }
    $OllamaExe = (Resolve-Path -LiteralPath $OllamaExe).Path
    if (-not (Test-Path -LiteralPath $Models -PathType Container)) { throw "Нет каталога моделей: $Models" }
    $previousModels = $env:OLLAMA_MODELS
    $previousHost = $env:OLLAMA_HOST
    try {
        $env:OLLAMA_MODELS = $Models
        $env:OLLAMA_HOST = '127.0.0.1:11434'
        $ollamaProcess = Start-Process -FilePath $OllamaExe -ArgumentList 'serve' -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $runtime 'ollama.stdout.log') `
            -RedirectStandardError (Join-Path $runtime 'ollama.stderr.log')
        $ollamaPid = $ollamaProcess.Id
        $ollamaStarted = $ollamaProcess.StartTime.ToUniversalTime().ToString('o')
    } finally {
        $env:OLLAMA_MODELS = $previousModels
        $env:OLLAMA_HOST = $previousHost
    }
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if (Get-LocalHealth 'http://127.0.0.1:11434/api/tags') { $ready = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) {
        # Record ownership even when startup failed, so stop.ps1 can stop only our child.
        @{ pid = $null; ollamaPid = $ollamaPid; ollamaStarted = $ollamaStarted; ollamaExe = $OllamaExe } |
            ConvertTo-Json | Set-Content -LiteralPath $pidFile -Encoding UTF8
        throw "Ollama не отвечает. Журналы запуска: $runtime"
    }
}
# Quote only the script path; parameters are a validated integer. No shell or generated command code.
$serviceProcess = Start-Process -FilePath $Python -ArgumentList @('-u', ('"' + $server + '"'), '--port', $Port) `
    -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $runtime 'service.stdout.log') `
    -RedirectStandardError (Join-Path $runtime 'service.stderr.log')
@{
    pid = $serviceProcess.Id
    started = $serviceProcess.StartTime.ToUniversalTime().ToString('o')
    python = $Python
    server = $server
    port = $Port
    ollamaPid = $ollamaPid
    ollamaStarted = $ollamaStarted
    ollamaExe = $OllamaExe
} | ConvertTo-Json | Set-Content -LiteralPath $pidFile -Encoding UTF8
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    $health = Get-LocalHealth $healthUrl
    if ($health -and $health.local -eq $true) {
        Write-Output "Помощник: http://127.0.0.1:$Port/mayatnik/Zerkalius-mayatnik.html"
        if (-not $health.available) { Write-Warning $health.error }
        return
    }
    Start-Sleep -Milliseconds 500
}
throw "Помощник не отвечает. Журналы запуска: $runtime"
