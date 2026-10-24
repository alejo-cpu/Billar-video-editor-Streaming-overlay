@echo off
title Billiard Broadcast System
color 0E

echo =======================================================
echo    SISTEMA DE TRANSMISION Y ESTUDIO DE BILLAR
echo =======================================================
echo.

:: 1. Comprobar si Node.js esta instalado en Windows
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] No se encontro Node.js en esta computadora.
    echo Por favor instala Node.js (version LTS) desde:
    echo https://nodejs.org/
    echo.
    pause
    exit /b
)

:: 2. Si no tiene node_modules instalado, instalar automaticamente
if not exist node_modules (
    echo [INFO] Primera ejecucion detectada. Instalando librerias...
    call npm install
    echo.
)

:: 3. Iniciar el servidor
echo [OK] Iniciando el sistema...
echo Abriendo Panel de Control en el navegador...

:: Abrir navegador automaticamente
start http://localhost:5173/?view=control

:: Ejecutar el servidor
call node server.js

pause
