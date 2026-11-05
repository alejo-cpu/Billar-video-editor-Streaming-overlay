# ==========================================================
# INSTALADOR AUTOMÁTICO HDP BILLAR - WINDOWS 11 COMPATIBLE
# ==========================================================
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "Instalador - HDP BILLAR"

# Configuración de colores ANSI (Soportados nativamente en Windows 11)
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

# Inicializar directorio actual y archivo de registro de inmediato
$CurrentDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location $CurrentDir

$LogFile = Join-Path $CurrentDir "install.log"
"=== Registro de instalación HDP BILLAR - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Out-File -FilePath $LogFile -Encoding utf8

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
        Start-Sleep -Milliseconds 80
        $i++
    }

    $jobOutput = Receive-Job -Job $job
    $jobFailed = ($job.State -ne 'Completed') -or ($job.ChildJobs[0].JobStateInfo.State -eq 'Failed')

    if ($job.ChildJobs[0].Error.Count -gt 0) {
        $jobFailed = $true
    }

    Remove-Job -Job $job -Force

    if ($jobFailed) {
        Write-Host "`r  $Yellow[$Step/6]$Reset  $Red[✘]$Reset  $formattedTitle  $Red[ Error ]$Reset"
        if ($jobOutput) {
            $jobOutput | Out-File -FilePath $LogFile -Append -Encoding utf8
        }
        exit 1
    } else {
        Write-Host "`r  $Yellow[$Step/6]$Reset  $Green[✔]$Reset  $formattedTitle  $Green[ $DoneStatus ]$Reset"
    }
}

try {
    Print-Banner

    # PASO 1
    Print-DoneStep "1" "Compatibilidad y codificación UTF-8" "OK"
    Start-Sleep -Milliseconds 150

    # PASO 2: Detección inteligente de Node
    $NodeDir = ""
    $NodeCmd = ""
    $NpmCmd  = ""
    $NodeStatus = "Descarga requerida"

    $LocalNodeDir = Join-Path $CurrentDir "runtime\node"
    $LocalNodeExe = Join-Path $LocalNodeDir "node.exe"
    $LocalNpmCmd  = Join-Path $LocalNodeDir "npm.cmd"

    if (Test-Path $LocalNodeExe) {
        $NodeDir = $LocalNodeDir
        $env:PATH = "$NodeDir;$env:PATH"
        $NodeCmd = $LocalNodeExe
        $NpmCmd  = $LocalNpmCmd
        $NodeStatus = "Portable local"
    } elseif (Get-Command node -ErrorAction SilentlyContinue) {
        $NodeVersion = (node -v).Trim()
        $NodeStatus = "$NodeVersion (Global)"
        $NodeCmd = "node"
        $NpmCmd  = "npm"
        $NodeDir = Split-Path -Parent (Get-Command node).Source
    }
    Print-DoneStep "2" "Entorno de ejecución (Node.js)" $NodeStatus

    # PASO 3: Descarga y configuración de Node.js portable (si no existe)
    if (-not $NodeCmd) {
        $RuntimeDir       = Join-Path $CurrentDir "runtime"
        $NodeZipPath      = Join-Path $RuntimeDir "node.zip"
        $NodeExtractFinal = Join-Path $RuntimeDir "node"

        if (-not (Test-Path $RuntimeDir)) {
            New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null
        }

        $NodeDownloadUrl = "https://nodejs.org/dist/v20.12.2/node-v20.12.2-win-x64.zip"

        Run-StepWithSpinner "3" "Configuración de entorno de ejecución" "Descargado y configurado" -Task {
            param($Url, $Zip, $RuntimeDir, $FinalDir, $Log)
            try {
                # Forzar protocolos seguros TLS 1.2 / 1.3 de Windows 11
                [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
                $web = New-Object System.Net.WebClient
                $web.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
                $web.DownloadFile($Url, $Zip)

                # Descomprimir
                Expand-Archive -Path $Zip -DestinationPath $RuntimeDir -Force

                # Localizar carpeta descomprimida
                $Folder = Get-ChildItem -Path $RuntimeDir -Directory | Where-Object { $_.Name -like "node-v*-win-x64" } | Select-Object -First 1
                if (-not $Folder) {
                    throw "No se encontró la carpeta de Node descomprimida en $RuntimeDir"
                }

                if (Test-Path $FinalDir) {
                    Remove-Item -Path $FinalDir -Recurse -Force
                }

                Move-Item -Path $Folder.FullName -Destination $FinalDir -Force
                Remove-Item -Path $Zip -Force -ErrorAction SilentlyContinue
            } catch {
                $_ | Out-File -FilePath $Log -Append -Encoding utf8
                throw $_
            }
        } -ArgsList @($NodeDownloadUrl, $NodeZipPath, $RuntimeDir, $NodeExtractFinal, $LogFile)

        $NodeDir = $NodeExtractFinal
        $env:PATH = "$NodeDir;$env:PATH"
        $NodeCmd = Join-Path $NodeDir "node.exe"
        $NpmCmd  = Join-Path $NodeDir "npm.cmd"
    } else {
        Print-DoneStep "3" "Configuración de entorno de ejecución" "Listo"
    }

    # PASO 4: Instalación de dependencias (npm install)
    Run-StepWithSpinner "4" "Librerías y dependencias del sistema" "Instaladas" -Task {
        param($Dir, $NodeDir, $Npm, $Log)
        try {
            # Inyección crítica: el subproceso de Windows 11 debe tener node en su propio PATH
            if ($NodeDir -and (Test-Path $NodeDir)) {
                $env:PATH = "$NodeDir;$env:PATH"
            }
            Set-Location $Dir
            & $Npm install --no-audit --no-fund --loglevel=error >> $Log 2>&1
            if ($LASTEXITCODE -ne 0) {
                throw "npm install finalizó con código de error $LASTEXITCODE"
            }
        } catch {
            $_ | Out-File -FilePath $Log -Append -Encoding utf8
            throw $_
        }
    } -ArgsList @($CurrentDir, $NodeDir, $NpmCmd, $LogFile)

    # PASO 5: Carpetas necesarias
    $DirsToEnsure = @(
        (Join-Path $CurrentDir "public\renders"),
        (Join-Path $CurrentDir "public\temp_uploads"),
        (Join-Path $CurrentDir "public\proyectos_billar")
    )
    foreach ($d in $DirsToEnsure) {
        if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
    }
    Print-DoneStep "5" "Motor multimedia (FFmpeg) y carpetas" "Verificado"
    Start-Sleep -Milliseconds 150

    # PASO 6: Verificar lanzador INICIAR_APP.bat (no sobreescribir si ya existe)
    $LauncherBatPath = Join-Path $CurrentDir "INICIAR_APP.bat"
    if (-not (Test-Path $LauncherBatPath)) {
        $LauncherContent = @"
@echo off
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
echo    [*] INICIANDO HDP BILLAR...
echo ==========================================================
echo  El navegador se abrira automaticamente en segundos.
echo  Deja esta ventana abierta mientras utilices el sistema.
echo ==========================================================
echo.

node server.js

pause
exit /b 0

:NO_INSTALADO
echo.
echo ==========================================================
echo  [!] HDP BILLAR aun no ha sido configurado en este equipo.
echo      Faltan componentes necesarios para funcionar.
echo ==========================================================
echo.
set /p RESP="Deseas ejecutar INSTALAR.bat ahora mismo? (S/N): "
if /i "%RESP%"=="S" (
    call "%~dp0INSTALAR.bat"
)
exit /b 0
"@
        [System.IO.File]::WriteAllText($LauncherBatPath, $LauncherContent, [System.Text.Encoding]::ASCII)
    }
    Print-DoneStep "6" "Lanzador de inicio rápido" "INICIAR_APP.bat"
    Start-Sleep -Milliseconds 150

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

    exit 0
} catch {
    Write-Host ""
    Write-Host "  $Red[✘] Ocurrió un error: $($_.Exception.Message)$Reset"
    $_ | Out-File -FilePath $LogFile -Append -Encoding utf8
    exit 1
}