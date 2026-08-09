$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Python = Join-Path $Root '.venv\Scripts\python.exe'
$Watcher = Join-Path $Root 'scripts\watch_and_publish.py'

if (-not (Test-Path $Python)) {
    throw 'No existe .venv. Ejecute primero automation\setup_windows.ps1.'
}

Push-Location $Root
try {
    & $Python $Watcher --once
}
finally {
    Pop-Location
}
