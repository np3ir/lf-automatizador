@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title LF Automatizador - Instalar dependencias

cd /d "%~dp0"
set "LOG_FILE=%CD%\Instalar_Dependencias.log"

echo ============================================================ > "%LOG_FILE%"
echo LF Automatizador - instalador de dependencias para Windows >> "%LOG_FILE%"
echo Raiz del proyecto: %CD% >> "%LOG_FILE%"
echo ============================================================ >> "%LOG_FILE%"

echo ============================================================
echo   LF Automatizador - instalador de dependencias para Windows
echo   Raiz del proyecto: %CD%
echo   Log: %LOG_FILE%
echo ============================================================
echo.

echo [1/5] Verificando Node.js 22 LTS y npm...
where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js no esta instalado.
    echo Descarga Node.js 22 LTS desde https://nodejs.org/
    echo ERROR: Node.js no esta instalado. >> "%LOG_FILE%"
    pause
    exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
    echo ERROR: npm no esta disponible. Reinstala Node.js 22 LTS.
    echo ERROR: npm no esta disponible. >> "%LOG_FILE%"
    pause
    exit /b 1
)
node -v
npm -v
node -e "const [M,m]=process.versions.node.split('.').map(Number); process.exit(M>22 || (M===22 && m>=12) ? 0 : 1)"
if errorlevel 1 (
    echo ERROR: se requiere Node.js 22.12.0 o superior.
    echo Descarga Node.js 22 LTS desde https://nodejs.org/ y vuelve a intentar.
    echo ERROR: Node.js demasiado antiguo. >> "%LOG_FILE%"
    pause
    exit /b 1
)

echo.
echo [2/5] Instalando dependencias Node...
    echo Ejecutando npm install...
    call npm install >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    echo ERROR: fallo npm. Revisa: %LOG_FILE%
    pause
    exit /b 1
)

echo.
echo [3/5] Recompilando better-sqlite3 para Electron...
if not exist "node_modules\better-sqlite3\" (
    echo ERROR: better-sqlite3 no quedo instalado.
    echo ERROR: better-sqlite3 no quedo instalado. >> "%LOG_FILE%"
    pause
    exit /b 1
)
call npx electron-rebuild -f -w better-sqlite3 >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    echo ERROR: fallo electron-rebuild. Revisa: %LOG_FILE%
    echo Cierra cualquier instancia abierta de LF Automatizador/Electron y vuelve a intentar.
    pause
    exit /b 1
)
for /f "usebackq delims=" %%v in (`node -p "require('./node_modules/electron/package.json').version"`) do set "ELECTRON_VERSION=%%v"
for /f "usebackq delims=" %%v in (`node -p "require('./node_modules/better-sqlite3/package.json').version"`) do set "SQLITE_VERSION=%%v"
for /f "usebackq delims=" %%v in (`node -p "process.platform + '-' + process.arch"`) do set "BUILD_PLATFORM=%%v"
if not exist ".native-build" mkdir ".native-build"
echo ok > ".native-build\!BUILD_PLATFORM!-electron-!ELECTRON_VERSION!-better-sqlite3-!SQLITE_VERSION!.ok"
echo OK: better-sqlite3 recompilado para Electron !ELECTRON_VERSION!.

echo.
echo [4/5] Verificando Rust (Cargo)...
where cargo >nul 2>nul
if errorlevel 1 (
    echo ERROR: Rust no esta instalado.
    echo Instala Rust desde https://rustup.rs/ y vuelve a ejecutar este instalador.
    echo ERROR: Rust no esta instalado. >> "%LOG_FILE%"
    pause
    exit /b 1
)
cargo --version

echo.
echo [5/5] Compilando motor de audio Rust si hace falta...
set "RUST_NEEDS_BUILD=0"
if not exist "bin\lf-audio-engine.exe" (
    set "RUST_NEEDS_BUILD=1"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$bin = Get-Item 'bin\lf-audio-engine.exe'; $src = Get-ChildItem 'audio-engine-rust\src','audio-engine-rust\Cargo.toml','audio-engine-rust\Cargo.lock' -Recurse -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if ($src -and $src.LastWriteTime -gt $bin.LastWriteTime) { exit 1 } else { exit 0 }" >nul 2>&1
    if errorlevel 1 set "RUST_NEEDS_BUILD=1"
)

if "%RUST_NEEDS_BUILD%"=="1" (
    if not exist "audio-engine-rust\Cargo.toml" (
        echo ERROR: no se encontro audio-engine-rust\Cargo.toml.
        echo ERROR: no se encontro audio-engine-rust\Cargo.toml. >> "%LOG_FILE%"
        pause
        exit /b 1
    )
    pushd audio-engine-rust
    call cargo build --release >> "%LOG_FILE%" 2>&1
    if errorlevel 1 (
        popd
        echo ERROR: fallo la compilacion del motor Rust. Revisa: %LOG_FILE%
        pause
        exit /b 1
    )
    popd
    if not exist "bin" mkdir "bin"
    copy /Y "audio-engine-rust\target\release\lf-audio-engine.exe" "bin\lf-audio-engine.exe" >nul
    echo OK: motor compilado en bin\lf-audio-engine.exe
) else (
    echo OK: motor de audio ya estaba actualizado.
)

echo.
echo Limpiando caches temporales...
call npm cache verify >> "%LOG_FILE%" 2>&1
pushd audio-engine-rust
call cargo clean >> "%LOG_FILE%" 2>&1
popd

echo.
echo ============================================================
echo   Instalacion completada.
echo   Para iniciar en Windows: Iniciar.bat
echo ============================================================
pause
