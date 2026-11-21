param(
    [string]$Python = '',
    [string]$OllamaExe = '',
    [string]$Models = $(if ($env:OLLAMA_MODELS) { $env:OLLAMA_MODELS } else { 'E:\OllamaModels\models' })
)
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'start.ps1') -Python $Python -OllamaExe $OllamaExe -Models $Models
Start-Process 'https://1001100.online/mayatnik/Zerkalius-mayatnik.html?assistant=1'
