@echo off
title Instalador de Dependencias - LF Automatizador 0.9.0
color 0A

cd /d "%~dp0"

echo ========================================================
echo   Instalando dependencias para LF Automatizador 0.9.0
echo ========================================================
echo.

echo Verificando instalacion de Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado o no esta en el PATH.
    echo Por favor, instala Node.js ^(v18 o superior^) e intenta nuevamente.
    pause
    exit /b 1
)

echo Verificando instalacion de Cargo ^(Rust^)...
cargo -V >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Cargo ^(Rust^) no esta instalado. Procediendo a instalarlo automaticamente...
    echo Descargando instalador de Rust...
    powershell -Command "Invoke-WebRequest -Uri 'https://win.rustup.rs/' -OutFile 'rustup-init.exe'"
    echo Instalando Rust ^(version GNU para no depender de Visual Studio^)...
    rustup-init.exe -y -q --default-host x86_64-pc-windows-gnu
    del rustup-init.exe
    echo Rust instalado correctamente.
    :: Añadir Rust al PATH temporalmente para que el script pueda continuar inmediatamente
    set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
) else (
    echo [INFO] Rust ya esta instalado. Configurando compatibilidad GNU...
    rustup default stable-gnu >nul 2>&1
)

echo.
echo [1/5] Instalando dependencias de Node.js...
echo Por favor espera, esto descargara paquetes y puede tardar varios minutos...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Fallo la instalacion de dependencias de Node.
    pause
    exit /b 1
)

echo.
echo [2/5] Reconstruyendo modulos nativos para Electron...
echo Este proceso puede demorar varios minutos mientras compila codigo fuente nativo...
call npx electron-rebuild
if %errorlevel% neq 0 (
    echo [ADVERTENCIA] electron-rebuild termino con errores.
)

echo.
echo [3/5] Compilando motor de audio en Rust...
echo Veras el progreso y descargas de paquetes a continuacion...
cd audio-engine-rust
call cargo build --release
if %errorlevel% neq 0 (
    echo [ERROR] Fallo la compilacion del motor de audio en Rust.
    cd ..
    pause
    exit /b 1
)

echo.
echo [4/5] Moviendo binario y limpiando archivos temporales de Rust...
if not exist "..\bin" mkdir "..\bin"
copy /Y target\release\lf-audio-engine.exe "..\bin\lf-audio-engine.exe" >nul
echo Limpiando temporales pesados de Rust para ahorrar espacio...
call cargo clean
cd ..

echo.
echo [5/5] Limpiando cache de Node.js...
call npm cache clean --force

echo.
echo ========================================================
echo   Instalacion y limpieza completadas con exito.
echo   Iniciando LF Automatizador 0.9.0...
echo ========================================================
timeout /t 3 >nul
start "" "Iniciar automatizador 0.9.0.bat"
