#!/usr/bin/env bash
set -Eeuo pipefail

# LF Automatizador - instalador de dependencias para Linux.
# Instala desde package-lock.json y recompila modulos nativos para Electron.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOG_FILE="$SCRIPT_DIR/instalar_dependencias.log"
exec > >(tee -a "$LOG_FILE") 2>&1

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

STEP=0
TOTAL_STEPS=7

pause_if_interactive() {
    local status="$1"
    echo ""
    if [ "$status" -eq 0 ]; then
        echo -e "${GREEN}Instalacion finalizada. Log: $LOG_FILE${NC}"
    else
        echo -e "${RED}La instalacion fallo con codigo $status.${NC}"
        echo "Revisa el detalle arriba o en: $LOG_FILE"
    fi
    if [ -t 0 ]; then
        read -r -p "Presiona Enter para cerrar..." _ || true
    fi
}
trap 'pause_if_interactive $?' EXIT

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

node_is_supported() {
    command -v node >/dev/null 2>&1 && node -e "const [M,m]=process.versions.node.split('.').map(Number); process.exit(M>22 || (M===22 && m>=12) ? 0 : 1)"
}

install_node_22_linux() {
    if ! command -v apt-get >/dev/null 2>&1; then
        return 1
    fi
    need_cmd "curl" "Instala curl con tu gestor de paquetes y vuelve a ejecutar este instalador."
    echo "Instalando Node.js 22 LTS desde NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
    hash -r
}

echo ""
echo "============================================================"
echo "  LF Automatizador - instalador de dependencias"
echo "  Raiz del proyecto: $SCRIPT_DIR"
echo "  Log: $LOG_FILE"
echo "============================================================"

step "Verificando sistema Linux"
if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo -e "${GREEN}Sistema: ${NAME:-Linux} ${VERSION:-}${NC}"
else
    echo -e "${YELLOW}No se encontro /etc/os-release; continuo con verificaciones basicas.${NC}"
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
        echo "Paquetes a instalar: ${DEPS_NEEDED[*]}"
        read -r -p "Instalar ahora con apt-get? (S/n): " answer
        if [[ "$answer" != "n" && "$answer" != "N" ]]; then
            sudo apt-get update
            sudo apt-get install -y "${DEPS_NEEDED[@]}"
        else
            echo -e "${YELLOW}Se omitio la instalacion de paquetes del sistema.${NC}"
        fi
    else
        echo -e "${GREEN}Todas las dependencias del sistema estan presentes.${NC}"
    fi
else
    echo -e "${YELLOW}apt-get no esta disponible; no puedo instalar paquetes del sistema automaticamente.${NC}"
fi

step "Verificando Node.js 22 LTS y npm"
if node_is_supported; then
    echo -e "${GREEN}Node.js: $(node --version)${NC}"
else
    if command -v node >/dev/null 2>&1; then
        echo -e "${YELLOW}Node.js actual: $(node --version). Se requiere 22.12.0 o superior.${NC}"
    else
        echo -e "${YELLOW}Node.js no esta instalado.${NC}"
    fi
    if command -v apt-get >/dev/null 2>&1; then
        read -r -p "Instalar/actualizar Node.js 22 LTS ahora? (S/n): " answer
        if [[ "$answer" != "n" && "$answer" != "N" ]]; then
            install_node_22_linux
        fi
    fi
fi

if ! node_is_supported; then
    echo -e "${RED}ERROR: Node.js 22.12.0 o superior es requerido para instalar las herramientas nativas actuales.${NC}"
    echo "Instala Node.js 22 LTS y vuelve a ejecutar este instalador."
    exit 1
fi
need_cmd "npm" "npm se instala junto con Node.js."
echo -e "${GREEN}Node.js: $(node --version)${NC}"
echo -e "${GREEN}npm: $(npm --version)${NC}"

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
        echo -e "${GREEN}Rust instalado: $(rustc --version)${NC}"
    else
        echo -e "${YELLOW}Sin Rust no se podra compilar el motor de audio.${NC}"
    fi
fi

step "Instalando dependencias Node"
    echo "Ejecutando npm install..."
    npm install

step "Recompilando better-sqlite3 para Electron"
if [ ! -d "node_modules/better-sqlite3" ]; then
    echo -e "${RED}ERROR: better-sqlite3 no quedo instalado.${NC}"
    exit 1
fi
npx electron-rebuild -f -w better-sqlite3
ELECTRON_VERSION="$(node -p "require('./node_modules/electron/package.json').version")"
SQLITE_VERSION="$(node -p "require('./node_modules/better-sqlite3/package.json').version")"
BUILD_PLATFORM="$(node -p "process.platform + '-' + process.arch")"
mkdir -p .native-build
touch ".native-build/$BUILD_PLATFORM-electron-$ELECTRON_VERSION-better-sqlite3-$SQLITE_VERSION.ok"
echo -e "${GREEN}better-sqlite3 recompilado para Electron $ELECTRON_VERSION.${NC}"

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
        else
            echo -e "${RED}ERROR: no se encontro el binario despues de compilar.${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}No se compilo el motor: falta Cargo o audio-engine-rust/Cargo.toml.${NC}"
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
echo "  Instalacion completada."
echo "  Para iniciar: ./iniciar.sh"
echo "============================================================"
