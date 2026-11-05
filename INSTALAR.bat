@echo off
title Instalador - HDP BILLAR
color 0E

cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ========================================================
    echo  [!] Ocurrio un inconveniente durante la instalacion.
    echo      Revisa el archivo 'install.log' para mas detalles.
    echo ========================================================
    pause
    exit /b %ERRORLEVEL%
)

exit /b 0
