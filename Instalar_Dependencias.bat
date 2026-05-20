@echo off
chcp 65001 >nul
:: ╔══════════════════════════════════════════════════════════════════════╗
:: ║     LF Automatizador — Instalador de Dependencias para Windows       ║
:: ║                                                                      ║
:: ║  EJECUTAR UNA SOLA VEZ (o cuando falte algo en un PC nuevo).         ║
:: ╚══════════════════════════════════════════════════════════════════════╝

echo ====================================================================
echo      LF Automatizador - Instalador de Dependencias (Windows)
echo ====================================================================
echo.

cd /d "%~dp0"

echo [Paso 1/5] Verificando Node.js...
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js no esta instalado.
    echo Por favor descarga e instala Node.js LTS desde: https://nodejs.org/
    echo Asegurate de marcar la opcion "Automatically install the necessary tools" 
    echo durante la instalacion (esto instalara Python y Visual Studio Build Tools).
    pause
    exit /b 1
)
node -v

echo.
echo [Paso 2/5] Verificando Rust (Cargo)...
where cargo >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Rust no esta instalado.
    echo Por favor descarga e instala Rust desde: https://rustup.rs/
    echo ^(Descarga y ejecuta rustup-init.exe, presiona 1 para la instalacion por defecto^)
    pause
    exit /b 1
)
cargo --version

echo.
echo [Paso 3/5] Instalando modulos de Node (npm install)...
if not exist "node_modules\" (
    echo Ejecutando npm install... (puede tomar unos minutos)
    call npm install
) else (
    echo node_modules ya existe.
)

echo.
echo [Paso 4/5] Recompilando modulos nativos para Electron...
if not exist "node_modules\better-sqlite3\build\Release\" (
    echo Ejecutando electron-rebuild...
    call npx electron-rebuild
) else (
    echo better-sqlite3 ya esta compilado para Electron.
)

echo.
echo [Paso 5/5] Compilando motor de audio Rust nativo...
set "RUST_NEEDS_BUILD=0"
if not exist "bin\lf-audio-engine.exe" (
    set "RUST_NEEDS_BUILD=1"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$bin = Get-Item 'bin\lf-audio-engine.exe'; $src = Get-ChildItem 'audio-engine-rust\src','audio-engine-rust\Cargo.toml','audio-engine-rust\Cargo.lock' -Recurse -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if ($src -and $src.LastWriteTime -gt $bin.LastWriteTime) { exit 1 } else { exit 0 }" >nul 2>&1
    if errorlevel 1 set "RUST_NEEDS_BUILD=1"
)

if "%RUST_NEEDS_BUILD%"=="1" (
    echo Compilando lf-audio-engine... (primera vez puede tomar varios minutos)
    cd audio-engine-rust
    call cargo build --release
    cd ..
    if not exist "bin" mkdir bin
    copy /Y "audio-engine-rust\target\release\lf-audio-engine.exe" "bin\lf-audio-engine.exe" >nul
    echo.
    echo [OK] Motor compilado exitosamente.
) else (
    echo Motor de audio ya esta compilado y actualizado.
)

echo.
echo ====================================================================
echo [Limpieza] Liberando espacio de basura, cache y compilacion...
echo ====================================================================
echo.
echo Limpiando cache de npm...
call npm cache clean --force >nul 2>&1

echo Limpiando cache de compilacion de Rust (liberando ~1-2 GB)...
cd audio-engine-rust
call cargo clean >nul 2>&1
cd ..

echo.
echo ====================================================================
echo    Instalacion y limpieza completadas con exito.
echo    Puedes cerrar esta ventana y ejecutar "Iniciar_Automatizador.bat"
echo    para tu uso diario.
echo ====================================================================
pause
