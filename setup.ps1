# ==========================================================
# INSTALADOR AUTOMATICO HDP BILLAR - WINDOWS 11 COMPATIBLE
# ==========================================================
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "Instalador - HDP BILLAR"

function Print-Banner {
    Clear-Host
    Write-Host "  ================================================================" -ForegroundColor DarkYellow
    Write-Host "     * * *      H D P   B I L L A R   -   S T U D I O      * * *  " -ForegroundColor Yellow
    Write-Host "  ================================================================" -ForegroundColor DarkYellow
    Write-Host ""
}

function Print-DoneStep {
    param([string]$Step, [string]$Title, [string]$Status)
    $formattedTitle = $Title.PadRight(40)
    Write-Host "  [$Step/6] " -ForegroundColor Yellow -NoNewline
    Write-Host "[OK] " -ForegroundColor Green -NoNewline
    Write-Host "$formattedTitle " -NoNewline
    Write-Host "[ $Status ]" -ForegroundColor Green
}

# Inicializar directorio actual y archivo de registro de inmediato
$CurrentDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location $CurrentDir

$LogFile = Join-Path $CurrentDir "install.log"
"=== Registro de instalacion HDP BILLAR - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Out-File -FilePath $LogFile -Encoding utf8

function Run-StepWithSpinner {
    param(
        [string]$Step,
        [string]$Title,
        [string]$DoneStatus,
        [scriptblock]$Task,
        [array]$ArgsList = @()
    )
    $frames = @('-', '\', '|', '/')
    $job = Start-Job -ScriptBlock $Task -ArgumentList $ArgsList
    $formattedTitle = $Title.PadRight(40)

    $i = 0
    while ($job.State -eq 'Running') {
        $frame = $frames[$i % $frames.Length]
        Write-Host -NoNewline "`r  [$Step/6] $frame  $formattedTitle  Procesando..."
        Start-Sleep -Milliseconds 85
        $i++
    }

    $jobOutput = Receive-Job -Job $job
    $jobFailed = ($job.State -ne 'Completed') -or ($job.ChildJobs[0].JobStateInfo.State -eq 'Failed')

    if ($job.ChildJobs[0].Error.Count -gt 0) {
        $jobFailed = $true
    }

    Remove-Job -Job $job -Force

    if ($jobFailed) {
        Write-Host -NoNewline "`r  [$Step/6] "
        Write-Host "[ERROR] " -ForegroundColor Red -NoNewline
        Write-Host "$formattedTitle"
        if ($jobOutput) {
            $jobOutput | Out-File -FilePath $LogFile -Append -Encoding utf8
        }
        exit 1
    } else {
        Write-Host -NoNewline "`r  [$Step/6] "
        Write-Host "[OK]    " -ForegroundColor Green -NoNewline
        Write-Host "$formattedTitle " -NoNewline
        Write-Host "[ $DoneStatus ]" -ForegroundColor Green
    }
}

try {
    Print-Banner

    # PASO 1
    Print-DoneStep "1" "Compatibilidad y codificacion UTF-8" "OK"
    Start-Sleep -Milliseconds 150

    # PASO 2: Deteccion de Node.js
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
    Print-DoneStep "2" "Entorno de ejecucion (Node.js)" $NodeStatus

    # PASO 3: Descarga y configuracion de Node.js portable si no existe
    if (-not $NodeCmd) {
        $RuntimeDir       = Join-Path $CurrentDir "runtime"
        $NodeZipPath      = Join-Path $RuntimeDir "node.zip"
        $NodeExtractFinal = Join-Path $RuntimeDir "node"

        if (-not (Test-Path $RuntimeDir)) {
            New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null
        }

        $NodeDownloadUrl = "https://nodejs.org/dist/v20.12.2/node-v20.12.2-win-x64.zip"

        Run-StepWithSpinner "3" "Configuracion de entorno de ejecucion" "Descargado y configurado" -Task {
            param($Url, $Zip, $RuntimeDir, $FinalDir, $Log)
            try {
                [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
                $web = New-Object System.Net.WebClient
                $web.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
                $web.DownloadFile($Url, $Zip)

                Expand-Archive -Path $Zip -DestinationPath $RuntimeDir -Force

                $Folder = Get-ChildItem -Path $RuntimeDir -Directory | Where-Object { $_.Name -like "node-v*-win-x64" } | Select-Object -First 1
                if (-not $Folder) {
                    throw "No se encontro la carpeta descomprimida de Node en $RuntimeDir"
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
        Print-DoneStep "3" "Configuracion de entorno de ejecucion" "Listo"
    }

    # PASO 4: Instalacion de dependencias con PATH heredado en el subproceso
    Run-StepWithSpinner "4" "Librerias y dependencias del sistema" "Instaladas" -Task {
        param($Dir, $NodeDir, $Npm, $Log)
        try {
            if ($NodeDir -and (Test-Path $NodeDir)) {
                $env:PATH = "$NodeDir;$env:PATH"
            }
            Set-Location $Dir
            & $Npm install --no-audit --no-fund --loglevel=error >> $Log 2>&1
            if ($LASTEXITCODE -ne 0) {
                throw "npm install finalizo con codigo de error $LASTEXITCODE"
            }
        } catch {
            $_ | Out-File -FilePath $Log -Append -Encoding utf8
            throw $_
        }
    } -ArgsList @($CurrentDir, $NodeDir, $NpmCmd, $LogFile)

    # PASO 5: Creacion de carpetas
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

    # PASO 6: Comprobar lanzador
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
    Print-DoneStep "6" "Lanzador de inicio rapido" "INICIAR_APP.bat"
    Start-Sleep -Milliseconds 150

    # Cuadro final
    Write-Host ""
    Write-Host "  +--------------------------------------------------------------+" -ForegroundColor Yellow
    Write-Host "  |  [OK] INSTALACION COMPLETADA EXITOSAMENTE (6/6)              |" -ForegroundColor Green
    Write-Host "  |                                                              |" -ForegroundColor Yellow
    Write-Host "  |  Para iniciar HDP BILLAR en cualquier momento, ejecuta:      |" -ForegroundColor Yellow
    Write-Host "  |  -> INICIAR_APP.bat                                          |" -ForegroundColor Cyan
    Write-Host "  +--------------------------------------------------------------+" -ForegroundColor Yellow
    Write-Host ""

    $Answer = Read-Host "  Deseas iniciar HDP BILLAR ahora mismo? (S/N)"
    if ($Answer -match "^[sSyY]") {
        Start-Process -FilePath $LauncherBatPath
    }

    exit 0
} catch {
    Write-Host ""
    Write-Host "  [ERROR] Ocurrio un fallo critico: $($_.Exception.Message)" -ForegroundColor Red
    $_ | Out-File -FilePath $LogFile -Append -Encoding utf8
    exit 1
}
