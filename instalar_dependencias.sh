#!/usr/bin/env bash
set -Eeuo pipefail

# LF Automatizador - instalador de dependencias para Linux.
# Prepara una instalacion limpia usando el lockfile actual del proyecto.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

STEP=0
TOTAL_STEPS=7
CHANGED=false

step() {
    STEP=$((STEP + 1))
    echo ""
    echo -e "${BOLD}${BLUE}[$STEP/$TOTAL_STEPS] $1${NC}"
    echo "------------------------------------------------------------"
}

need_cmd() {
    local cmd="$1"
    local help="$2"
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo -e "${RED}ERROR: falta ${cmd}.${NC}"
        echo "$help"
        exit 1
    fi
}

echo ""
echo "============================================================"
echo "  LF Automatizador - instalador de dependencias"
echo "  Raiz del proyecto: $SCRIPT_DIR"
echo "============================================================"

step "Verificando sistema Linux"
if [ ! -f /etc/os-release ]; then
    echo -e "${YELLOW}No se encontro /etc/os-release; continuo con verificaciones basicas.${NC}"
else
    . /etc/os-release
    echo -e "${GREEN}Sistema: ${NAME:-Linux} ${VERSION:-}${NC}"
    if [[ "${ID:-}" != "debian" && "${ID:-}" != "ubuntu" && "${ID:-}" != "linuxmint" && "${ID_LIKE:-}" != *"debian"* && "${ID_LIKE:-}" != *"ubuntu"* ]]; then
        echo -e "${YELLOW}Aviso: este instalador esta probado principalmente en Debian, Ubuntu y Linux Mint.${NC}"
    fi
fi

step "Verificando paquetes del sistema"
if command -v apt-get >/dev/null 2>&1; then
    DEPS_NEEDED=()
    check_pkg() {
        local package="$1"
        local command_check="$2"
        if eval "$command_check" >/dev/null 2>&1; then
            echo -e "${GREEN}OK: $package${NC}"
        else
            DEPS_NEEDED+=("$package")
            echo -e "${YELLOW}Falta: $package${NC}"
        fi
    }

    check_pkg "build-essential" "dpkg -s build-essential"
    check_pkg "python3" "command -v python3"
    check_pkg "libasound2-dev" "dpkg -s libasound2-dev"
    check_pkg "pkg-config" "command -v pkg-config"
    check_pkg "ffmpeg" "command -v ffmpeg"
    check_pkg "curl" "command -v curl"

    if [ "${#DEPS_NEEDED[@]}" -gt 0 ]; then
        echo ""
        echo "Paquetes a instalar: ${DEPS_NEEDED[*]}"
        read -r -p "Instalar ahora con apt-get? (S/n): " answer
        if [[ "$answer" != "n" && "$answer" != "N" ]]; then
            sudo apt-get update
            sudo apt-get install -y "${DEPS_NEEDED[@]}"
            CHANGED=true
        else
            echo -e "${YELLOW}Se omitio la instalacion de paquetes del sistema.${NC}"
        fi
    else
        echo -e "${GREEN}Todas las dependencias del sistema estan presentes.${NC}"
    fi
else
    echo -e "${YELLOW}apt-get no esta disponible; se omite instalacion automatica de paquetes del sistema.${NC}"
fi

step "Verificando Node.js y npm"
need_cmd "node" "Instala Node.js LTS desde https://nodejs.org/ o con tu gestor de paquetes."
need_cmd "npm" "npm se instala junto con Node.js."
echo -e "${GREEN}Node.js: $(node --version)${NC}"
echo -e "${GREEN}npm: $(npm --version)${NC}"
if ! node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major > 22 || (major === 22 && minor >= 12) ? 0 : 1)"; then
    echo -e "${RED}ERROR: se requiere Node.js 22.12.0 o superior para las herramientas actuales de Electron.${NC}"
    echo "Instala Node.js LTS actual y vuelve a ejecutar este instalador."
    exit 1
fi

step "Verificando Rust"
if command -v cargo >/dev/null 2>&1; then
    echo -e "${GREEN}Rust: $(rustc --version 2>/dev/null || cargo --version)${NC}"
else
    echo -e "${YELLOW}Rust no esta instalado. Es necesario para compilar el motor de audio.${NC}"
    read -r -p "Instalar Rust con rustup ahora? (S/n): " answer
    if [[ "$answer" != "n" && "$answer" != "N" ]]; then
        need_cmd "curl" "Instala curl para descargar rustup."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        [ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"
        CHANGED=true
        echo -e "${GREEN}Rust instalado: $(rustc --version)${NC}"
    else
        echo -e "${YELLOW}Sin Rust no se podra compilar el motor de audio.${NC}"
    fi
fi

step "Instalando dependencias Node desde lockfile"
if [ -f package-lock.json ]; then
    echo "Ejecutando npm ci para instalacion limpia y reproducible..."
    npm ci
else
    echo -e "${YELLOW}No existe package-lock.json; usando npm install.${NC}"
    npm install
fi
CHANGED=true

step "Recompilando modulos nativos para Electron"
if [ -d "node_modules/better-sqlite3" ]; then
    npx electron-rebuild -f -w better-sqlite3
    ELECTRON_VERSION="$(node -p "require('./node_modules/electron/package.json').version")"
    SQLITE_VERSION="$(node -p "require('./node_modules/better-sqlite3/package.json').version")"
    BUILD_PLATFORM="$(node -p "process.platform + '-' + process.arch")"
    mkdir -p .native-build
    touch ".native-build/$BUILD_PLATFORM-electron-$ELECTRON_VERSION-better-sqlite3-$SQLITE_VERSION.ok"
    echo -e "${GREEN}Modulos nativos recompilados.${NC}"
else
    echo -e "${YELLOW}better-sqlite3 no esta instalado; revisa npm ci/npm install.${NC}"
fi

step "Compilando motor de audio Rust"
RUST_BIN="bin/lf-audio-engine"
RUST_NEEDS_BUILD=false

if [ ! -f "$RUST_BIN" ]; then
    RUST_NEEDS_BUILD=true
elif [ -n "$(find audio-engine-rust/src audio-engine-rust/Cargo.toml audio-engine-rust/Cargo.lock -newer "$RUST_BIN" -print -quit 2>/dev/null)" ]; then
    RUST_NEEDS_BUILD=true
fi

if [ "$RUST_NEEDS_BUILD" = true ]; then
    if [ -f "audio-engine-rust/Cargo.toml" ] && command -v cargo >/dev/null 2>&1; then
        mkdir -p bin
        (
            cd audio-engine-rust
            cargo build --release
        )
        if [ -f "audio-engine-rust/target/release/lf-audio-engine" ]; then
            cp "audio-engine-rust/target/release/lf-audio-engine" "$RUST_BIN"
            chmod +x "$RUST_BIN"
            echo -e "${GREEN}Motor compilado: $RUST_BIN${NC}"
            CHANGED=true
        else
            echo -e "${RED}No se encontro el binario despues de compilar.${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}No se pudo compilar el motor: falta Cargo o audio-engine-rust/Cargo.toml.${NC}"
    fi
else
    chmod +x "$RUST_BIN"
    echo -e "${GREEN}Motor de audio ya estaba actualizado.${NC}"
fi

echo ""
echo "Limpiando caches temporales..."
npm cache verify >/dev/null 2>&1 || true
if [ -d "audio-engine-rust" ] && command -v cargo >/dev/null 2>&1; then
    (
        cd audio-engine-rust
        cargo clean >/dev/null 2>&1 || true
    )
fi

echo ""
echo "============================================================"
if [ "$CHANGED" = true ]; then
    echo "  Instalacion completada con dependencias actuales del lockfile."
else
    echo "  Todo estaba listo."
fi
echo "  Para iniciar: ./iniciar.sh"
echo "============================================================"
