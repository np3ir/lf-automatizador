#!/usr/bin/env bash
set -Eeuo pipefail

# LF Automatizador - iniciar en Linux.
# Si los modulos nativos no coinciden con Electron, los recompila antes de abrir.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if df -T "$SCRIPT_DIR" 2>/dev/null | grep -q "vboxsf" || [[ "$SCRIPT_DIR" == *"/media/sf_"* ]] || [[ "$SCRIPT_DIR" == *"/mnt/sf_"* ]]; then
    echo ""
    echo "AVISO: carpeta compartida de VirtualBox detectada."
    echo "Para mejor rendimiento, copia el proyecto al disco local de Linux."
    echo ""
fi

[ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"

if ! command -v node >/dev/null 2>&1; then
    echo "ERROR: Node.js no esta instalado."
    echo "Ejecuta primero: ./instalar_dependencias.sh"
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo "ERROR: npm no esta disponible."
    echo "Ejecuta primero: ./instalar_dependencias.sh"
    exit 1
fi

if [ ! -d "node_modules" ] || [ ! -d "node_modules/electron" ]; then
    echo "ERROR: faltan dependencias Node."
    echo "Ejecuta primero: ./instalar_dependencias.sh"
    exit 1
fi

ELECTRON_VERSION="$(node -p "require('./node_modules/electron/package.json').version")"
SQLITE_VERSION="$(node -p "require('./node_modules/better-sqlite3/package.json').version")"
BUILD_PLATFORM="$(node -p "process.platform + '-' + process.arch")"
BUILD_DIR=".native-build"
BUILD_MARKER="$BUILD_DIR/$BUILD_PLATFORM-electron-$ELECTRON_VERSION-better-sqlite3-$SQLITE_VERSION.ok"

if [ ! -f "$BUILD_MARKER" ]; then
    echo "Preparando modulos nativos para Electron $ELECTRON_VERSION..."
    mkdir -p "$BUILD_DIR"
    npx electron-rebuild -f -w better-sqlite3
    touch "$BUILD_MARKER"
fi

echo "Iniciando LF Automatizador..."
if [ "${EUID:-$(id -u)}" -eq 0 ]; then
    echo "AVISO: ejecutando como root; se agrega --no-sandbox para Chromium."
    npx electron . --no-sandbox "$@"
else
    npx electron . "$@"
fi
