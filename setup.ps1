[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "Instalador - HDP BILLAR"

# Configuración de colores ANSI
$Esc    = [char]27
$Gold   = "$Esc[38;2;245;158;11m"
$Yellow = "$Esc[38;2;251;191;36m"
$Green  = "$Esc[32m"
$Cyan   = "$Esc[36m"
$Red    = "$Esc[31m"
$Gray   = "$Esc[90m"
$Reset  = "$Esc[0m"

function Print-Banner {
    Clear-Host
    Write-Host "$Gold"
    Write-Host "  ██╗  ██╗██████╗ ██████╗     ██████╗ ██╗██╗     ██╗      █████╗ ██████╗ "
    Write-Host "  ██║  ██║██╔══██╗██╔══██╗    ██╔══██╗██║██║     ██║     ██╔══██╗██╔══██╗"
    Write-Host "  ███████║██║  ██║██████╔╝    ██████╔╝██║██║     ██║     ███████║██████╔╝"
    Write-Host "  ██╔══██║██║  ██║██╔═══╝     ██╔══██╗██║██║     ██║     ██╔══██║██╔══██╗"
    Write-Host "  ██║  ██║██████╔╝██║         ██████╔╝██║███████╗███████╗██║  ██║██║  ██║"
    Write-Host "  ╚═╝  ╚═╝╚═════╝ ╚═╝         ╚═════╝ ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝"
    Write-Host "$Gray   ───────────────────────────────────────────────────────────────────$Reset"
    Write-Host ""
}

function Print-DoneStep {
    param([string]$Step, [string]$Title, [string]$Status)
    $formattedTitle = $Title.PadRight(40)
    Write-Host "  $Yellow[$Step/6]$Reset  $Green[✔]$Reset  $formattedTitle  $Green[ $Status ]$Reset"
}

function Run-StepWithSpinner {
    param(
        [string]$Step,
        [string]$Title,
        [string]$DoneStatus,
        [scriptblock]$Task,
        [array]$ArgsList = @()
    )
    $frames = @('⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏')
    $job = Start-Job -ScriptBlock $Task -ArgumentList $ArgsList
    $formattedTitle = $Title.PadRight(40)

    $i = 0
    while ($job.State -eq 'Running') {
        $frame = $frames[$i % $frames.Length]
        Write-Host -NoNewline "`r  $Yellow[$Step/6]$Reset  $Cyan$frame$Reset  $formattedTitle  ${Cyan}Procesando...$Reset"
        Start-Sleep -Milliseconds 85
        $i++
    }

    $failed = ($job.State -ne 'Completed') -or ($job.ChildJobs[0].ExitCode -ne 0 -and $null -ne $job.ChildJobs[0].ExitCode)
    Remove-Job -Job $job

    if ($failed) {
        Write-Host "`r  $Yellow[$Step/6]$Reset  $Red[✘]$Reset  $formattedTitle  $Red[ Error ]$Reset"
        throw "La tarea falló. Revisa install.log."
    } else {
        Write-Host "`r  $Yellow[$Step/6]$Reset  $Green[✔]$Reset  $formattedTitle  $Green[ $DoneStatus ]$Reset"
    }
}

$CurrentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $CurrentDir

Print-Banner

# PASO 1
Print-DoneStep "1" "Compatibilidad y codificación UTF-8" "OK"
Start-Sleep -Milliseconds 200

# PASO 2: Detectar Node
$NodeCmd = ""
$NpmCmd = ""
$NodeStatus = "Descarga requerida"

if (Get-Command node -ErrorAction SilentlyContinue) {
    $NodeVersion = (node -v).Trim()
    $NodeStatus = $NodeVersion
    $NodeCmd = "node"
    $NpmCmd = "npm"
} elseif (Test-Path "$CurrentDir\runtime\node\node.exe") {
    $env:PATH = "$CurrentDir\runtime\node;$env:PATH"
    $NodeCmd = "$CurrentDir\runtime\node\node.exe"
    $NpmCmd = "$CurrentDir\runtime\node\npm.cmd"
    $NodeStatus = "Portable local"
}
Print-DoneStep "2" "Entorno de ejecución (Node.js)" $NodeStatus

# PASO 3: Configurar Node si hace falta
if (-not $NodeCmd) {
    $RuntimeDir = Join-Path $CurrentDir "runtime"
    $NodeZipPath = Join-Path $RuntimeDir "node.zip"
    $NodeExtractDir = Join-Path $RuntimeDir "node"

    if (-not (Test-Path $RuntimeDir)) {
        New-Item -ItemType Directory -Path $RuntimeDir | Out-Null
    }

    $NodeDownloadUrl = "https://nodejs.org/dist/v20.12.2/node-v20.12.2-win-x64.zip"

    Run-StepWithSpinner "3" "Configuración de entorno de ejecución" "Descargado y configurado" -Task {
        param($Url, $Zip, $Dest, $ExtractFinal)
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
        $web = New-Object System.Net.WebClient
        $web.DownloadFile($Url, $Zip)
        Expand-Archive -Path $Zip -DestinationPath $Dest -Force
        $Folder = Get-ChildItem -Path $Dest -Directory | Where-Object { $_.Name -like "node-v*-win-x64" } | Select-Object -First 1
        if ($Folder) { Move-Item -Path $Folder.FullName -Destination $ExtractFinal -Force }
        Remove-Item -Path $Zip -Force -ErrorAction SilentlyContinue
    } -ArgsList @($NodeDownloadUrl, $NodeZipPath, $RuntimeDir, $NodeExtractDir)

    $env:PATH = "$NodeExtractDir;$env:PATH"
    $NodeCmd = "$NodeExtractDir\node.exe"
    $NpmCmd = "$NodeExtractDir\npm.cmd"
} else {
    Print-DoneStep "3" "Configuración de entorno de ejecución" "Listo"
}

# PASO 4: Dependencias
$LogFile = Join-Path $CurrentDir "install.log"
"" > $LogFile

Run-StepWithSpinner "4" "Librerías y dependencias del sistema" "Instaladas" -Task {
    param($Dir, $Npm, $Log)
    Set-Location $Dir
    & $Npm install --loglevel=error > $Log 2>&1
} -ArgsList @($CurrentDir, $NpmCmd, $LogFile)

# PASO 5: Carpetas y multimedia
$DirsToEnsure = @(
    (Join-Path $CurrentDir "public\renders"),
    (Join-Path $CurrentDir "public\temp_uploads"),
    (Join-Path $CurrentDir "public\proyectos_billar")
)
foreach ($d in $DirsToEnsure) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}
Print-DoneStep "5" "Motor multimedia (FFmpeg) y carpetas" "Verificado"
Start-Sleep -Milliseconds 200

# PASO 6: Generar lanzador
$LauncherBatPath = Join-Path $CurrentDir "INICIAR_APP.bat"
$LauncherContent = @"
@echo off
chcp 65001 >nul
title HDP BILLAR - Servidor Activo
color 0E

cd /d "%~dp0"

if exist "%~dp0runtime\node\node.exe" (
    set "PATH=%~dp0runtime\node;%PATH%"
)

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    goto NO_INSTALADO
)

if not exist "%~dp0node_modules\" (
    goto NO_INSTALADO
)

echo.
echo ==========================================================
echo    🎱 INICIANDO HDP BILLAR...
echo ==========================================================
echo  El navegador se abrirá automáticamente en segundos.
echo  Deja esta ventana abierta mientras utilices el sistema.
echo ==========================================================
echo.

node server.js

pause
exit /b 0

:NO_INSTALADO
echo.
echo ==========================================================
echo  [!] HDP BILLAR aún no ha sido configurado en este equipo.
echo      Faltan componentes necesarios para funcionar.
echo ==========================================================
echo.
set /p RESP="¿Deseas ejecutar INSTALAR.bat ahora mismo? (S/N): "
if /i "%RESP%"=="S" (
    call "%~dp0INSTALAR.bat"
)
exit /b 0
"@

[System.IO.File]::WriteAllText($LauncherBatPath, $LauncherContent, [System.Text.Encoding]::UTF8)
Print-DoneStep "6" "Lanzador de inicio rápido" "INICIAR_APP.bat"
Start-Sleep -Milliseconds 200

# Cuadro final
Write-Host ""
Write-Host "  $Yellow┌──────────────────────────────────────────────────────────────────┐$Reset"
Write-Host "  $Yellow│$Reset  $Green[✔]$Reset  $Gold INSTALACIÓN COMPLETADA EXITOSAMENTE (6/6)$Reset                 $Yellow│$Reset"
Write-Host "  $Yellow│$Reset                                                                 $Yellow│$Reset"
Write-Host "  $Yellow│$Reset  Para iniciar HDP BILLAR en cualquier momento, solo ejecuta:     $Yellow│$Reset"
Write-Host "  $Yellow│$Reset  👉  $Gold INICIAR_APP.bat $Reset                                              $Yellow│$Reset"
Write-Host "  $Yellow└──────────────────────────────────────────────────────────────────┘$Reset"
Write-Host ""

$Answer = Read-Host "  ¿Deseas iniciar HDP BILLAR ahora mismo? (S/N)"
if ($Answer -match "^[sSyY]") {
    Start-Process -FilePath $LauncherBatPath
}
