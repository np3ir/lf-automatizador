#!/bin/bash

# Salir inmediatamente si ocurre un error
set -e

# Obtener la ruta donde está el script y moverse a ella
cd "$(dirname "$0")"

echo "========================================================"
echo "  Instalando dependencias para LF Automatizador 0.9.0"
echo "========================================================"
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js no está instalado."
    echo "Por favor, instala Node.js (v18 o superior) e intenta nuevamente."
    exit 1
fi

# Verificar npm
if ! command -v npm &> /dev/null; then
    echo "[ERROR] npm no está instalado."
    exit 1
fi

# Verificar Cargo (Rust)
if ! command -v cargo &> /dev/null; then
    echo "[ERROR] Cargo (Rust) no está instalado."
    echo "Por favor, instala Rust e intenta nuevamente."
    exit 1
fi

echo "[1/5] Instalando dependencias de Node.js..."
echo "Por favor espera, esto descargará paquetes y puede tardar varios minutos..."
npm install

echo ""
echo "[2/5] Reconstruyendo módulos nativos para Electron..."
echo "Este proceso puede demorar varios minutos mientras compila código fuente nativo..."
npx electron-rebuild || echo "[ADVERTENCIA] electron-rebuild terminó con errores (puede no ser crítico si better-sqlite3 ya se compiló)."

echo ""
echo "[3/5] Compilando motor de audio en Rust..."
echo "Verás el progreso y las descargas de paquetes a continuación..."
cd audio-engine-rust
cargo build --release

echo ""
echo "[4/5] Moviendo binario y limpiando archivos temporales de Rust..."
mkdir -p ../bin
cp target/release/lf-audio-engine ../bin/lf-audio-engine
echo "Limpiando temporales pesados de Rust para ahorrar espacio..."
cargo clean
cd ..

echo ""
echo "[5/5] Limpiando caché de Node.js..."
npm cache clean --force

echo ""
echo "========================================================"
echo "  Instalación y limpieza completadas con éxito."
echo "  Iniciando LF Automatizador 0.9.0..."
echo "========================================================"
sleep 3
"./Iniciar automatizador 0.9.0.sh"
