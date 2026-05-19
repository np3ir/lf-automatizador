#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════╗
# ║              LF Automatizador — Iniciar (Linux)                     ║
# ║                                                                      ║
# ║  Acceso directo para ejecutar el programa.                           ║
# ║  Si es la primera vez, ejecuta antes: ./instalar_dependencias.sh     ║
# ╚══════════════════════════════════════════════════════════════════════╝

# Ir al directorio del proyecto (donde está este script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Advertencia si se detecta carpeta compartida de VirtualBox
if df -T "$SCRIPT_DIR" 2>/dev/null | grep -q "vboxsf" || [[ "$SCRIPT_DIR" == *"/media/sf_"* ]] || [[ "$SCRIPT_DIR" == *"/mnt/sf_"* ]]; then
    echo ""
    echo -e "\033[1;33m╔══════════════════════════════════════════════════════════════════════╗\033[0m"
    echo -e "\033[1;33m║  ⚠️  ADVERTENCIA: Carpeta compartida de VirtualBox detectada         ║\033[0m"
    echo -e "\033[1;33m╠══════════════════════════════════════════════════════════════════════╣\033[0m"
    echo -e "\033[1;33m║  Se ha detectado que está usando una máquina virtual con carpeta     ║\033[0m"
    echo -e "\033[1;33m║  compartida. Las dependencias se instalarán, pero NO se garantiza   ║\033[0m"
    echo -e "\033[1;33m║  el funcionamiento correcto del software en este entorno.            ║\033[0m"
    echo -e "\033[1;33m║                                                                      ║\033[0m"
    echo -e "\033[1;33m║  Para un funcionamiento óptimo, copie el proyecto directamente       ║\033[0m"
    echo -e "\033[1;33m║  al disco local de su máquina virtual Linux.                         ║\033[0m"
    echo -e "\033[1;33m╚══════════════════════════════════════════════════════════════════════╝\033[0m"
    echo ""
fi

# Cargar entorno de Rust si existe (por si se instaló con rustup)
[ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"

# Verificación rápida de lo mínimo necesario
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado."
    echo "   Ejecuta primero: ./instalar_dependencias.sh"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "❌ node_modules no encontrado."
    echo "   Ejecuta primero: ./instalar_dependencias.sh"
    exit 1
fi

# Arrancar Electron
echo "🚀 Iniciando LF Automatizador..."
if [ "$EUID" -eq 0 ] || [ "$(id -u)" -eq 0 ]; then
    echo "⚠️  Ejecutando como root — añadiendo --no-sandbox para Chromium."
    npx electron . --no-sandbox "$@"
else
    npx electron . "$@"
fi
