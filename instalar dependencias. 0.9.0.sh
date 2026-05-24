#!/bin/bash

cd "$(dirname "$0")"

# Colores para la terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function pause_exit {
    echo ""
    read -p "Presiona Enter para salir..."
    exit 1
}

echo -e "${CYAN}===============================================================================${NC}"
echo -e "${CYAN}           LF AUTOMATIZADOR 0.9.0 - INSTALADOR DE DEPENDENCIAS${NC}"
echo -e "${CYAN}===============================================================================${NC}"
echo ""
echo "Este asistente preparará tu sistema para poder usar el programa."
echo "Por favor, NO CIERRES ESTA VENTANA. Algunos procesos pueden tardar"
echo "varios minutos en completarse y parecer que no avanzan. Es normal."
echo ""
echo -e "${CYAN}===============================================================================${NC}"
echo ""

# 1. Verificando Node.js
echo "[1/6] Verificando instalación de Node.js..."
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo -e "${RED}[ERROR CRÍTICO] Node.js o npm no están instalados en tu sistema.${NC}"
    echo "El programa requiere Node.js para funcionar."
    echo "Por favor, instálalo usando el gestor de paquetes de tu distribución."
    echo "Ejemplo (Ubuntu/Debian): sudo apt install nodejs npm"
    pause_exit
else
    NODE_VER=$(node -v)
    echo -e "${GREEN}[OK] Node.js $NODE_VER detectado correctamente.${NC}"
fi
echo ""

# 2. Verificando/Instalando Rust
echo "[2/6] Verificando entorno de compilación Rust..."
if ! command -v cargo &> /dev/null; then
    echo "[INFO] Rust no está instalado. Se procederá con la descarga e instalación automática."
    echo "[INFO] Descargando instalador de Rust..."
    if command -v curl &> /dev/null; then
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
        
        # Cargar variables de entorno de Rust en esta sesión
        if [ -f "$HOME/.cargo/env" ]; then
            source "$HOME/.cargo/env"
        fi
        
        if ! command -v cargo &> /dev/null; then
            echo -e "${RED}[ERROR] La instalación de Rust falló o no se configuró el PATH.${NC}"
            pause_exit
        fi
    else
        echo -e "${RED}[ERROR] Se requiere el programa 'curl' para instalar Rust automáticamente.${NC}"
        echo "Por favor, instálalo (ej. sudo apt install curl) e intenta de nuevo."
        pause_exit
    fi
fi
echo -e "${GREEN}[OK] Rust detectado correctamente.${NC}"
echo ""

# 3. Preparando compilador C/C++ (Linux suele traer gcc, si no falla el build de rust)
echo "[3/6] Preparando entorno C/C++ para dependencias nativas..."
if ! command -v gcc &> /dev/null && ! command -v clang &> /dev/null; then
    echo -e "${YELLOW}[ADVERTENCIA] No se detectó un compilador C (gcc/clang). La compilación de Rust podría fallar.${NC}"
    echo "Si falla más adelante, instala build-essential (ej. sudo apt install build-essential)."
else
    echo -e "${GREEN}[OK] Compilador C/C++ detectado.${NC}"
fi
echo ""

# 4. Instalando dependencias de Node.js
echo "[4/6] Instalando dependencias del entorno Node.js..."

# Solución preventiva: Reparar permisos rotos de npm y electron (Error EACCES)
if [ -d "$HOME/.cache/electron" ] && [ ! -w "$HOME/.cache/electron" ]; then
    echo "[INFO] Permisos bloqueados en la caché de Electron. Solicitando acceso para reparar..."
    sudo chown -R "$USER:$USER" "$HOME/.cache/electron"
fi
if [ -d "$HOME/.npm" ] && [ ! -w "$HOME/.npm" ]; then
    echo "[INFO] Permisos bloqueados en la caché de NPM. Solicitando acceso para reparar..."
    sudo chown -R "$USER:$USER" "$HOME/.npm"
fi

echo "[INFO] Descargando e instalando paquetes..."
echo "[INFO] Por favor, ten paciencia, puede tomar varios minutos. No te preocupes por las advertencias (WARN)."
if ! npm install; then
    echo -e "${RED}[ERROR] Falló la instalación de dependencias de Node.js.${NC}"
    pause_exit
fi

echo ""
echo "[INFO] Preparando librerías nativas de Node... ESTO PUEDE TOMAR BASTANTE TIEMPO."
npx electron-rebuild || echo -e "${YELLOW}[ADVERTENCIA] electron-rebuild reportó un error, pero podría ser no crítico.${NC}"
echo -e "${GREEN}[OK] Dependencias de Node.js listas.${NC}"
echo ""

# 5. Compilando motor de audio en Rust
echo "[5/6] Compilando el Motor de Audio interno..."
echo "[INFO] Se están descargando componentes y compilando el código en Rust."
echo "[INFO] Este es el paso que más tiempo consume. Dependiendo de tu PC puede tardar de 1 a 5 minutos."

if ! cd audio-engine-rust; then
    echo -e "${RED}[ERROR] No se encuentra la carpeta audio-engine-rust.${NC}"
    pause_exit
fi

if ! cargo build --release; then
    echo ""
    echo -e "${RED}[ERROR CRÍTICO] Falló la compilación del motor de audio en Rust.${NC}"
    echo "Revisa si hay errores más arriba. El programa necesita este motor."
    cd ..
    pause_exit
fi

echo -e "${GREEN}[OK] Compilación finalizada correctamente.${NC}"
echo "[INFO] Guardando el ejecutable optimizado..."
mkdir -p ../bin
cp target/release/lf-audio-engine ../bin/lf-audio-engine

echo "[INFO] Limpiando archivos temporales pesados para ahorrar espacio en disco..."
cargo clean > /dev/null 2>&1
cd ..
echo ""

# 6. Limpieza final
echo "[6/6] Tareas finales de limpieza y optimización..."
npm cache clean --force > /dev/null 2>&1
echo -e "${GREEN}[OK] Optimización terminada.${NC}"
echo ""

echo -e "${GREEN}===============================================================================${NC}"
echo -e "${GREEN}            INSTALACIÓN COMPLETADA CON ÉXITO${NC}"
echo -e "${GREEN}===============================================================================${NC}"
echo ""
echo "Todas las dependencias han sido instaladas correctamente."
echo "Ya puedes disfrutar de LF Automatizador."
echo "Para abrir el programa, haz doble clic en el archivo:"
echo "\"Iniciar automatizador 0.9.0.sh\""
echo ""
read -p "Presiona Enter para salir..."
exit 0
