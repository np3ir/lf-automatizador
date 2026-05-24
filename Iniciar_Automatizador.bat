@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title LF Automatizador v1.0

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js no esta instalado.
    echo Ejecuta primero Instalar_Dependencias.bat.
    pause
    exit /b 1
)
node -e "const [M,m]=process.versions.node.split('.').map(Number); process.exit(M>22 || (M===22 && m>=12) ? 0 : 1)"
if errorlevel 1 (
    echo ERROR: se requiere Node.js 22.12.0 o superior.
    echo Ejecuta primero Instalar_Dependencias.bat.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo ERROR: npm no esta disponible.
    echo Ejecuta primero Instalar_Dependencias.bat.
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo ERROR: node_modules no existe.
    echo Ejecuta primero Instalar_Dependencias.bat.
    pause
    exit /b 1
)

if not exist "node_modules\electron\" (
    echo ERROR: Electron no esta instalado.
    echo Ejecuta primero Instalar_Dependencias.bat.
    pause
    exit /b 1
)

for /f "usebackq delims=" %%v in (`node -p "require('./node_modules/electron/package.json').version"`) do set "ELECTRON_VERSION=%%v"
for /f "usebackq delims=" %%v in (`node -p "require('./node_modules/better-sqlite3/package.json').version"`) do set "SQLITE_VERSION=%%v"
for /f "usebackq delims=" %%v in (`node -p "process.platform + '-' + process.arch"`) do set "BUILD_PLATFORM=%%v"

set "BUILD_DIR=.native-build"
set "BUILD_MARKER=%BUILD_DIR%\%BUILD_PLATFORM%-electron-%ELECTRON_VERSION%-better-sqlite3-%SQLITE_VERSION%.ok"

if not exist "%BUILD_MARKER%" (
    echo Preparando modulos nativos para Electron %ELECTRON_VERSION%...
    if not exist "%BUILD_DIR%" mkdir "%BUILD_DIR%"
    call npx electron-rebuild -f -w better-sqlite3
    if errorlevel 1 (
        echo.
        echo ERROR: no se pudo recompilar better-sqlite3 para Electron.
        echo Cierra LF Automatizador/Electron si esta abierto y ejecuta Instalar_Dependencias.bat.
        pause
        exit /b 1
    )
    echo ok > "%BUILD_MARKER%"
)

echo Iniciando LF Automatizador...
call "node_modules\.bin\electron.cmd" .
if errorlevel 1 pause
