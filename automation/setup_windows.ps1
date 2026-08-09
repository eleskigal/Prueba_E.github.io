$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Venv = Join-Path $Root '.venv'
$Python = Join-Path $Venv 'Scripts\python.exe'
$TaskName = 'DCD Visor - Actualizacion automatica'
$Watcher = Join-Path $Root 'scripts\watch_and_publish.py'
$Matrix = Join-Path $Root 'input\Matriz_Seguimiento_Reportes.xlsx'

Write-Host 'DCD · Configuracion de actualizacion automatica' -ForegroundColor Cyan
Write-Host "Repositorio: $Root"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git no esta instalado o no esta disponible en PATH.'
}
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw 'Python no esta instalado o no esta disponible en PATH.'
}

Push-Location $Root
try {
    $branch = (git branch --show-current).Trim()
    if ($branch -ne 'main') {
        throw "Ejecute la configuracion desde la rama main. Rama actual: $branch"
    }

    if (-not (Test-Path $Venv)) {
        Write-Host 'Creando entorno virtual...'
        python -m venv .venv
    }

    Write-Host 'Instalando dependencias Python...'
    & $Python -m pip install --upgrade pip
    & $Python -m pip install -r requirements.txt

    if (-not (Test-Path (Split-Path $Matrix -Parent))) {
        New-Item -ItemType Directory -Path (Split-Path $Matrix -Parent) | Out-Null
    }

    if (-not (Test-Path $Matrix)) {
        Write-Warning "Aun no existe $Matrix"
        Write-Warning 'Copie la matriz maestra con ese nombre antes de iniciar el monitor.'
    }

    Write-Host 'Probando pipeline y configuracion sin publicar...'
    & $Python -c "import pandas, openpyxl; print('Dependencias Python OK')"

    $Action = New-ScheduledTaskAction `
        -Execute $Python `
        -Argument "`"$Watcher`"" `
        -WorkingDirectory $Root

    $Trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $Settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -ExecutionTimeLimit ([TimeSpan]::Zero) `
        -MultipleInstances IgnoreNew

    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $Action `
        -Trigger $Trigger `
        -Settings $Settings `
        -Description 'Monitorea la matriz DCD y publica cambios validados en GitHub Pages.' `
        -Force | Out-Null

    Write-Host "Tarea programada creada: $TaskName" -ForegroundColor Green
    Write-Host 'Iniciando el monitor ahora...'
    Start-ScheduledTask -TaskName $TaskName

    Write-Host ''
    Write-Host 'CONFIGURACION COMPLETA' -ForegroundColor Green
    Write-Host 'Desde ahora, al guardar input\Matriz_Seguimiento_Reportes.xlsx:'
    Write-Host '  1. se espera a que Excel termine de guardar;'
    Write-Host '  2. se procesa la matriz;'
    Write-Host '  3. se validan datos y sintaxis;'
    Write-Host '  4. si hay cambios publicables, se hace commit y push a main.'
    Write-Host ''
    Write-Host 'Log: logs\automation.log'
    Write-Host "Para detener: Stop-ScheduledTask -TaskName '$TaskName'"
    Write-Host "Para eliminar: Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
}
finally {
    Pop-Location
}
