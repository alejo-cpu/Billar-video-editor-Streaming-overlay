@echo off
chcp 65001 >nul
title HDP BILLAR - Servidor Activo
color 0E

cd /d "%~dp0"

:: Si existe Node local portable, agregarlo a la sesion
if exist "%~dp0runtime\node\node.exe" (
    set "PATH=%~dp0runtime\node;%PATH%"
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
