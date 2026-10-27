@echo off
chcp 65001 >nul
title Instalador - HDP BILLAR
color 0E

:: Asegurar que se ejecuta en la carpeta del proyecto
cd /d "%~dp0"

:: Lanzar PowerShell con modo bypass y codificación UTF-8
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; & '%~dp0setup.ps1'; }"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ========================================================
    echo  [!] Ocurrió un inconveniente durante la instalación.
    echo      Revisa el archivo 'install.log' para más detalles.
    echo ========================================================
    pause
    exit /b %ERRORLEVEL%
)

exit /b 0
