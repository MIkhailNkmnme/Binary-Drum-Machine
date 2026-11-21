[CmdletBinding()]
param(
    [Parameter(Position=0, Mandatory=$true)]
    [ValidateSet('status','configure','list','upload','prepare-vk','configure-openai','generate-image')][string]$Command,
    [string]$File,
    [string]$Key,
    [string]$Prefix = '',
    [string]$Journal = (Join-Path $PSScriptRoot '../../issledovanie/image-journal/index.html'),
    [string]$OutputDirectory,
    [string]$PromptFile,
    [string]$Source,
    [string]$Model = 'gpt-image-2.5-sunburst',
    [string]$Size = '2048x1152',
    [ValidateSet('low','medium','high','auto')][string]$Quality = 'medium',
    [string]$JournalUrl = 'https://1001100.online/issledovanie/image-journal/'
)
$ErrorActionPreference = 'Stop'
$connectionDirectory = Join-Path $env:APPDATA 'Zerkalius\connections'
$credentialPath = Join-Path $connectionDirectory 'r2.credentials.xml'
$configPath = Join-Path $connectionDirectory 'r2.config.json'
$openAiCredentialPath = Join-Path $connectionDirectory 'openai.credentials.xml'
$pythonPath = Join-Path $env:LOCALAPPDATA 'Zerkalius\media-publish\venv\Scripts\python.exe'

function Assert-Endpoint([string]$Endpoint) {
    # Account ID (32 hexadecimal digits), default or jurisdiction endpoint only.
    if ($Endpoint -cnotmatch '^https://[a-f0-9]{32}(\.(eu|us|fedramp))?\.r2\.cloudflarestorage\.com$') {
        throw 'Нужен HTTPS endpoint Cloudflare R2: https://<32-hex-account-id>.r2.cloudflarestorage.com (либо .eu/.us/.fedramp). Без пути, порта и параметров.'
    }
}
function Protect-Path([string]$Path, [bool]$Directory = $false) {
    $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $systemSid = New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18')
    if ($Directory) { $acl = New-Object System.Security.AccessControl.DirectorySecurity }
    else { $acl = New-Object System.Security.AccessControl.FileSecurity }
    $acl.SetAccessRuleProtection($true, $false)
    $acl.SetOwner($sid)
    foreach ($identity in @($sid, $systemSid)) {
        if ($Directory) {
            $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
        } else {
            $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'Allow')
        }
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $Path -AclObject $acl
}
function Quote-Argument([string]$Value) {
    # Windows CommandLineToArgvW quoting, including trailing backslashes.
    return '"' + ([regex]::Replace(([regex]::Replace($Value, '(\\*)"', '$1$1\"')), '(\\+)$', '$1$1')) + '"'
}

try {
    if ($Command -eq 'status') {
        [ordered]@{
            credentialsExist = (Test-Path -LiteralPath $credentialPath -PathType Leaf)
            configExist = (Test-Path -LiteralPath $configPath -PathType Leaf)
            openAiConfigured = [bool]$env:OPENAI_API_KEY -or (Test-Path -LiteralPath $openAiCredentialPath -PathType Leaf)
            pythonExists = (Test-Path -LiteralPath $pythonPath -PathType Leaf)
            connectionDirectory = $connectionDirectory
            scope = 'DPAPI: текущая Windows-учётная запись на этом компьютере'
        } | ConvertTo-Json
        if (Test-Path -LiteralPath $configPath -PathType Leaf) {
            $metadata = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
            [ordered]@{ endpoint=$metadata.endpoint; bucket=$metadata.bucket; publicBase=$metadata.publicBase } | ConvertTo-Json
        }
        return
    }
    if ($Command -eq 'configure-openai') {
        if (Test-Path -LiteralPath $openAiCredentialPath) { throw 'Локальный профиль OpenAI уже настроен.' }
        $secret = Read-Host 'OpenAI API key (ввод скрыт)' -AsSecureString
        if ($secret.Length -eq 0) { throw 'Пустой ключ OpenAI.' }
        $null = New-Item -ItemType Directory -Path $connectionDirectory -Force
        Protect-Path $connectionDirectory $true
        $credential = New-Object System.Management.Automation.PSCredential('OpenAI', $secret)
        $credential | Export-Clixml -LiteralPath $openAiCredentialPath -NoClobber
        Protect-Path $openAiCredentialPath
        Write-Output 'Ключ OpenAI сохранён в локальном профиле Windows.'
        return
    }
    if ($Command -eq 'configure') {
        if ((Test-Path -LiteralPath $credentialPath) -or (Test-Path -LiteralPath $configPath)) {
            throw 'Профиль уже существует. configure не заменяет его. Для ротации сначала отдельно сохраните и уберите оба файла профиля из connections.'
        }
        $endpoint = (Read-Host 'Cloudflare R2 S3 API endpoint').Trim()
        Assert-Endpoint $endpoint
        $secureAccessId = Read-Host 'R2 Access Key ID (ввод скрыт)' -AsSecureString
        $temporaryCredential = New-Object System.Management.Automation.PSCredential('id', $secureAccessId)
        $accessId = $temporaryCredential.GetNetworkCredential().Password.Trim()
        if ($accessId -notmatch '^[A-Za-z0-9]{16,128}$') { throw 'Некорректный Access Key ID.' }
        $secret = Read-Host 'R2 Secret Access Key' -AsSecureString
        if ($secret.Length -eq 0) { throw 'Пустой Secret Access Key.' }
        $null = New-Item -ItemType Directory -Path $connectionDirectory -Force
        Protect-Path $connectionDirectory $true
        $credential = New-Object System.Management.Automation.PSCredential($accessId, $secret)
        $credential | Export-Clixml -LiteralPath $credentialPath
        Protect-Path $credentialPath
        [ordered]@{ endpoint=$endpoint; bucket='zerkalius-media'; publicBase='https://media.1001100.online' } |
            ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8
        Protect-Path $configPath
        $accessId = $null
        $secureAccessId = $null
        $temporaryCredential = $null
        $credential = $null
        $secret = $null
        Write-Output 'Настройка сохранена для текущего пользователя Windows. Сеть не проверялась; для чтения: media.ps1 list.'
        return
    }
    if (-not (Test-Path -LiteralPath $pythonPath -PathType Leaf)) {
        throw "Не найден частный Python: $pythonPath. Создайте venv и установите requirements.txt по README."
    }
    $childArgs = @((Join-Path $PSScriptRoot 'media.py'), $Command)
    if ($Command -eq 'generate-image') {
        if (-not $PromptFile -or -not $File) { throw 'Для generate-image обязательны -PromptFile и -File.' }
        $childArgs += @('--prompt-file', $PromptFile, '--file', $File, '--model', $Model, '--size', $Size, '--quality', $Quality)
        if ($Source) { $childArgs += @('--source', $Source) }
    } elseif ($Command -eq 'prepare-vk') {
        if (-not $OutputDirectory) { throw 'Укажите -OutputDirectory вне репозитория.' }
        $childArgs += @('--journal', $Journal, '--output-directory', $OutputDirectory, '--journal-url', $JournalUrl)
    } elseif ($Command -eq 'upload') {
        if (-not $File -or -not $Key) { throw 'Для upload обязательны -File и -Key. Перезапись запрещена.' }
        $childArgs += @('--file', $File, '--key', $Key)
    } else { $childArgs += @('--prefix', $Prefix) }
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = $pythonPath
    $info.Arguments = (($childArgs | ForEach-Object { Quote-Argument $_ }) -join ' ')
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.StandardOutputEncoding = [System.Text.Encoding]::UTF8
    $info.StandardErrorEncoding = [System.Text.Encoding]::UTF8
    $info.EnvironmentVariables['PYTHONUTF8'] = '1'
    if ($Command -eq 'generate-image' -and -not $env:OPENAI_API_KEY) {
        if (-not (Test-Path -LiteralPath $openAiCredentialPath -PathType Leaf)) { throw 'Сначала настройте ключ для текущего пользователя через configure-openai.' }
        try { $credential = Import-Clixml -LiteralPath $openAiCredentialPath }
        catch { throw 'Windows DPAPI не смог открыть ключ OpenAI.' }
        if ($credential -isnot [System.Management.Automation.PSCredential]) { throw 'Некорректный локальный профиль OpenAI.' }
        $info.EnvironmentVariables['OPENAI_API_KEY'] = $credential.GetNetworkCredential().Password
    }
    if ($Command -in @('list','upload')) {
        if (-not (Test-Path -LiteralPath $credentialPath) -or -not (Test-Path -LiteralPath $configPath)) { throw 'Сначала выполните configure.' }
        $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
        Assert-Endpoint $config.endpoint
        if ($config.bucket -cne 'zerkalius-media' -or $config.publicBase -cne 'https://media.1001100.online') { throw 'Неожиданный bucket/publicBase в конфигурации.' }
        try { $credential = Import-Clixml -LiteralPath $credentialPath }
        catch { throw 'DPAPI не смог открыть credentials. Выполните configure под текущим пользователем на этом компьютере.' }
        if ($credential -isnot [System.Management.Automation.PSCredential]) { throw 'Некорректный файл credentials.' }
        $info.EnvironmentVariables['ZERKALIUS_R2_ACCESS_ID'] = $credential.UserName
        $info.EnvironmentVariables['ZERKALIUS_R2_SECRET'] = $credential.GetNetworkCredential().Password
        $info.EnvironmentVariables['ZERKALIUS_R2_ENDPOINT'] = $config.endpoint
    }
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $info
    try {
        $null = $process.Start()
        $outputTask = $process.StandardOutput.ReadToEndAsync()
        $errorTask = $process.StandardError.ReadToEndAsync()
        $process.WaitForExit()
        $childOutput = $outputTask.GetAwaiter().GetResult()
        $childError = $errorTask.GetAwaiter().GetResult()
        if ($childOutput) { Write-Output $childOutput.TrimEnd() }
        if ($childError) { [Console]::Error.WriteLine($childError.TrimEnd()) }
        if ($process.ExitCode -ne 0) { throw 'Операция не завершена; см. безопасное сообщение Python выше.' }
    } finally {
        $info.EnvironmentVariables.Remove('ZERKALIUS_R2_ACCESS_ID')
        $info.EnvironmentVariables.Remove('ZERKALIUS_R2_SECRET')
        $info.EnvironmentVariables.Remove('OPENAI_API_KEY')
        $process.Dispose()
        $credential = $null
        $secret = $null
    }
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
