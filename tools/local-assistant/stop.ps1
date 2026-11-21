param([switch]$WithOllama)
$ErrorActionPreference = 'Stop'
$pidFile = Join-Path $env:LOCALAPPDATA 'Zerkalius\assistant\service.json'
if (-not (Test-Path -LiteralPath $pidFile -PathType Leaf)) { Write-Output 'Нет записи о запуске помощника.'; return }
$record = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json

function Get-RecordedUtcTicks($Value) {
    if ($Value -is [DateTime]) { return $Value.ToUniversalTime().Ticks }
    if ($Value -is [DateTimeOffset]) { return $Value.UtcDateTime.Ticks }
    return [DateTimeOffset]::Parse([string]$Value, [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::None).UtcDateTime.Ticks
}

function Stop-OwnedProcess($ProcessId, $Started, $Executable, $ScriptPath) {
    if (-not $ProcessId -or -not $Started -or -not $Executable) { return }
    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (-not $process) { return }
    $actualStart = $process.StartTime.ToUniversalTime().Ticks
    if ($actualStart -ne (Get-RecordedUtcTicks $Started) -or $process.Path -ne $Executable) {
        throw 'PID уже принадлежит другому процессу. Он не остановлен.'
    }
    if ($ScriptPath) {
        $details = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId"
        if (-not $details.CommandLine -or -not $details.CommandLine.Contains($ScriptPath)) {
            throw 'Командная строка процесса не соответствует помощнику. Он не остановлен.'
        }
    }
    Stop-Process -Id $ProcessId
}
Stop-OwnedProcess $record.pid $record.started $record.python $record.server
if ($WithOllama) { Stop-OwnedProcess $record.ollamaPid $record.ollamaStarted $record.ollamaExe $null }
# Preserve Ollama ownership so a later -WithOllama still works after a regular stop.
$record.pid = $null
$record | ConvertTo-Json | Set-Content -LiteralPath $pidFile -Encoding UTF8
Write-Output 'Локальный помощник остановлен.'
