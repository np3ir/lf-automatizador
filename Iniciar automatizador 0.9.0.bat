@echo off
title LF Automatizador 0.9.0
cd /d "%~dp0"

echo Iniciando LF Automatizador 0.9.0...

:: Arrancar en segundo plano y guardar salida en log
start /B cmd /c "npm start > error_log.txt 2>&1"

:: Esperar 4 segundos para ver si logra mantenerse abierto
timeout /t 4 >nul

:: Revisar si el proceso electron sigue vivo
tasklist /FI "IMAGENAME eq electron.exe" 2>NUL | find /I "electron.exe" >NUL
if %errorlevel% equ 0 (
    :: Todo bien, el programa esta abierto. Cerramos la ventana negra.
    exit
) else (
    :: El programa no inicio o crasheo. Mostramos el error.
    echo.
    echo [ERROR] El programa fallo al iniciar o se cerro inesperadamente.
    echo Revisa el registro de errores a continuacion:
    echo --------------------------------------------------------
    type error_log.txt
    echo --------------------------------------------------------
    echo.
    pause
    exit /b 1
)
