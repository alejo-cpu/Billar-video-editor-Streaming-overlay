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