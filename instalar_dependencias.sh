#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════╗
# ║     LF Automatizador — Instalador de Dependencias para Linux        ║
# ║                                                                      ║
# ║  EJECUTAR UNA SOLA VEZ (o cuando falte algo).                        ║
# ║  Compatible con: Debian, Ubuntu, Linux Mint (distros Debian-based)   ║
# ║                                                                      ║
# ║  Uso: chmod +x instalar_dependencias.sh && ./instalar_dependencias.sh║
# ╚══════════════════════════════════════════════════════════════════════╝

set -e

# Colores para mensajes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Ir al directorio donde está este script (raíz del proyecto)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     LF Automatizador — Instalador de Dependencias           ║"
echo "║     Verificando qué falta y qué ya está listo...            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Contador de pasos
STEP=0
TOTAL_STEPS=8
INSTALLED_SOMETHING=false

step() {
    STEP=$((STEP + 1))
    echo ""
    echo -e "${BOLD}${BLUE}[$STEP/$TOTAL_STEPS] $1${NC}"
    echo "─────────────────────────────────────────────────"
}

# ───────────────────────────────────────────────────────
# PASO 1: Verificar que estamos en Debian-based
# ───────────────────────────────────────────────────────
step "Verificando sistema operativo..."

if [ ! -f /etc/os-release ]; then
    echo -e "${RED}[ERROR] No se pudo detectar el sistema operativo.${NC}"
    echo "Este instalador solo es compatible con distribuciones basadas en Debian."
    exit 1
fi

. /etc/os-release
echo -e "${GREEN}  ✓ Sistema: ${NAME} ${VERSION}${NC}"

if [[ "$ID" != "debian" && "$ID" != "ubuntu" && "$ID" != "linuxmint" && "$ID_LIKE" != *"debian"* && "$ID_LIKE" != *"ubuntu"* ]]; then
    echo -e "${YELLOW}[ADVERTENCIA] Este sistema no parece ser basado en Debian.${NC}"
    echo "Puede funcionar pero no está garantizado."
    read -p "¿Continuar? (s/N): " respuesta
    if [[ "$respuesta" != "s" && "$respuesta" != "S" ]]; then
        exit 0
    fi
fi

# ───────────────────────────────────────────────────────
# PASO 2: Dependencias del sistema (apt-get)
# ───────────────────────────────────────────────────────
step "Verificando dependencias del sistema..."

DEPS_NEEDED=()

# Verificar cada dependencia
check_dep() {
    local name="$1"
    local check_cmd="$2"
    local description="$3"

    if eval "$check_cmd" &> /dev/null; then
        echo -e "${GREEN}  ✓ ${name}${NC}"
    else
        DEPS_NEEDED+=("$name")
        echo -e "${YELLOW}  ○ ${name}: FALTA — ${description}${NC}"
    fi
}

check_dep "build-essential" "dpkg -s build-essential" "Compilador C/C++ para módulos nativos"
check_dep "python3" "command -v python3" "Necesario para node-gyp"
check_dep "libasound2-dev" "dpkg -s libasound2-dev" "Headers ALSA para compilar motor de audio"
check_dep "pkg-config" "command -v pkg-config" "Detección de librerías al compilar"
check_dep "ffmpeg" "command -v ffmpeg" "Análisis y procesamiento de audio"
check_dep "curl" "command -v curl" "Descargas (necesario para instalar Rust)"

if [ ${#DEPS_NEEDED[@]} -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}  Paquetes a instalar: ${DEPS_NEEDED[*]}${NC}"
    read -p "  ¿Instalar ahora con apt-get? (S/n): " respuesta
    if [[ "$respuesta" != "n" && "$respuesta" != "N" ]]; then
        sudo apt-get update -qq
        sudo apt-get install -y "${DEPS_NEEDED[@]}"
        INSTALLED_SOMETHING=true
        echo -e "${GREEN}  ✓ Dependencias del sistema instaladas${NC}"
    else
        echo -e "${YELLOW}  Saltando instalación de dependencias del sistema.${NC}"
    fi
else
    echo -e "${GREEN}  ✓ Todas las dependencias del sistema están presentes${NC}"
fi

# ───────────────────────────────────────────────────────
# PASO 3: Node.js y npm
# ───────────────────────────────────────────────────────
step "Verificando Node.js..."

if command -v node &> /dev/null; then
    NODE_VER=$(node --version)
    echo -e "${GREEN}  ✓ Node.js: ${NODE_VER}${NC}"
else
    echo -e "${RED}  ✗ Node.js NO está instalado.${NC}"
    echo ""
    echo "  Opciones para instalar Node.js:"
    echo ""
    echo "  Opción 1 (NodeSource — recomendada):"
    echo "    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -"
    echo "    sudo apt-get install -y nodejs"
    echo ""
    echo "  Opción 2 (nvm — para desarrollo):"
    echo "    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash"
    echo "    source ~/.bashrc"
    echo "    nvm install --lts"
    echo ""
    echo -e "${RED}  Instala Node.js y vuelve a ejecutar este script.${NC}"
    exit 1
fi

if command -v npm &> /dev/null; then
    NPM_VER=$(npm --version)
    echo -e "${GREEN}  ✓ npm: ${NPM_VER}${NC}"
else
    echo -e "${RED}  ✗ npm no encontrado. Se instala junto con Node.js.${NC}"
    exit 1
fi

# ───────────────────────────────────────────────────────
# PASO 4: Rust (para compilar el motor de audio)
# ───────────────────────────────────────────────────────
step "Verificando Rust..."

if command -v cargo &> /dev/null; then
    RUST_VER=$(rustc --version 2>/dev/null || echo 'instalado')
    echo -e "${GREEN}  ✓ Rust: ${RUST_VER}${NC}"
else
    echo -e "${YELLOW}  ○ Rust no está instalado.${NC}"
    echo "  Se necesita para compilar el motor de audio nativo."
    read -p "  ¿Instalar Rust ahora? (S/n): " respuesta
    if [[ "$respuesta" != "n" && "$respuesta" != "N" ]]; then
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source "$HOME/.cargo/env"
        INSTALLED_SOMETHING=true
        echo -e "${GREEN}  ✓ Rust instalado: $(rustc --version)${NC}"
    else
        echo -e "${YELLOW}  Saltando. El motor de audio no se podrá compilar sin Rust.${NC}"
    fi
fi

# ───────────────────────────────────────────────────────
# PASO 5: Módulos de Node.js (npm install)
# ───────────────────────────────────────────────────────
step "Verificando node_modules..."

if [ -d "node_modules" ] && [ -d "node_modules/electron" ]; then
    echo -e "${GREEN}  ✓ node_modules ya existe con Electron${NC}"
else
    echo -e "${YELLOW}  ○ node_modules no encontrado o incompleto.${NC}"
    read -p "  ¿Ejecutar npm install? (S/n): " respuesta
    if [[ "$respuesta" != "n" && "$respuesta" != "N" ]]; then
        echo "  Instalando... (puede tomar unos minutos)"
        npm install
        INSTALLED_SOMETHING=true
        echo -e "${GREEN}  ✓ npm install completado${NC}"
    fi
fi

# ───────────────────────────────────────────────────────
# PASO 6: Recompilar módulos nativos para Electron
# ───────────────────────────────────────────────────────
step "Verificando módulos nativos (better-sqlite3)..."

if [ -d "node_modules/better-sqlite3/build/Release" ]; then
    echo -e "${GREEN}  ✓ better-sqlite3 ya está compilado${NC}"
else
    if [ -d "node_modules/better-sqlite3" ]; then
        echo -e "${YELLOW}  ○ better-sqlite3 necesita recompilarse para Electron.${NC}"
        read -p "  ¿Ejecutar electron-rebuild? (S/n): " respuesta
        if [[ "$respuesta" != "n" && "$respuesta" != "N" ]]; then
            npx electron-rebuild
            INSTALLED_SOMETHING=true
            echo -e "${GREEN}  ✓ Módulos nativos recompilados${NC}"
        fi
    else
        echo -e "${YELLOW}  ○ better-sqlite3 no encontrado. Ejecuta npm install primero.${NC}"
    fi
fi

# ───────────────────────────────────────────────────────
# PASO 7: Compilar motor de audio Rust
# ───────────────────────────────────────────────────────
step "Verificando motor de audio Rust..."

RUST_BIN="bin/lf-audio-engine"
RUST_NEEDS_BUILD=false

if [ ! -f "$RUST_BIN" ]; then
    RUST_NEEDS_BUILD=true
elif [ -n "$(find audio-engine-rust/src audio-engine-rust/Cargo.toml audio-engine-rust/Cargo.lock -newer "$RUST_BIN" -print -quit 2>/dev/null)" ]; then
    RUST_NEEDS_BUILD=true
fi

if [ "$RUST_NEEDS_BUILD" = false ]; then
    echo -e "${GREEN}  OK: el binario Linux esta actualizado.${NC}"
    echo -e "${GREEN}  ✓ Motor de audio: binario Linux presente${NC}"
    chmod +x "$RUST_BIN"
else
    if [ -f "audio-engine-rust/Cargo.toml" ] && command -v cargo &> /dev/null; then
        if [ -f "$RUST_BIN" ]; then
            echo -e "${YELLOW}  AVISO: el codigo Rust es mas nuevo que el binario; se recomienda recompilar.${NC}"
        fi
        echo -e "${YELLOW}  ○ El binario del motor de audio no existe.${NC}"
        read -p "  ¿Compilar ahora? Puede tomar 3-5 minutos (S/n): " respuesta
        if [[ "$respuesta" != "n" && "$respuesta" != "N" ]]; then
            # Cargar entorno de Rust si se acaba de instalar
            [ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"
            echo "  Compilando... (primera vez toma más tiempo)"
            cd audio-engine-rust
            cargo build --release 2>&1
            cd "$SCRIPT_DIR"
            mkdir -p bin
            if [ -f "audio-engine-rust/target/release/lf-audio-engine" ]; then
                cp audio-engine-rust/target/release/lf-audio-engine "$RUST_BIN"
                chmod +x "$RUST_BIN"
                INSTALLED_SOMETHING=true
                echo -e "${GREEN}  ✓ Motor de audio compilado: ${RUST_BIN}${NC}"
            else
                echo -e "${RED}  ✗ Error: no se encontró el binario después de compilar.${NC}"
            fi
        fi
    elif [ ! -f "audio-engine-rust/Cargo.toml" ]; then
        echo -e "${YELLOW}  ○ No se encontró el código fuente del motor Rust.${NC}"
    else
        echo -e "${YELLOW}  ○ Rust no está instalado — no se puede compilar.${NC}"
    fi
fi

# ───────────────────────────────────────────────────────
# PASO 8: Limpieza de basura (Cleanup)
# ───────────────────────────────────────────────────────
step "Limpiando archivos temporales y cachés..."

echo "  Liberando espacio de caché de npm..."
npm cache clean --force 2>/dev/null || true

if [ -d "audio-engine-rust" ] && command -v cargo &> /dev/null; then
    echo "  Liberando caché de compilación de Rust (~1-2 GB)..."
    cd audio-engine-rust
    cargo clean 2>/dev/null || true
    cd "$SCRIPT_DIR"
fi

if [ "$INSTALLED_SOMETHING" = true ]; then
    echo "  Limpiando caché de paquetes del sistema (apt)..."
    sudo apt-get clean 2>/dev/null || true
    sudo apt-get autoremove -y 2>/dev/null || true
fi

echo -e "${GREEN}  ✓ Limpieza completada${NC}"

# ───────────────────────────────────────────────────────
# RESUMEN FINAL
# ───────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
if [ "$INSTALLED_SOMETHING" = true ]; then
    echo -e "${CYAN}║  ✅ Instalación completada con éxito.                        ║${NC}"
else
    echo -e "${CYAN}║  ✅ Todo ya estaba instalado. No se necesitaron cambios.      ║${NC}"
fi
echo -e "${CYAN}║                                                              ║${NC}"
echo -e "${CYAN}║  Para iniciar el programa ejecuta:                           ║${NC}"
echo -e "${CYAN}║     ./iniciar.sh                                             ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
