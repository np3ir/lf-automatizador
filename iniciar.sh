#!/bin/bash
# ============================================================
# LF Automatizador v1.0 — Script de arranque para Linux
# Equivalente a Iniciar_Automatizador.bat de Windows.
# ============================================================

# Moverse al directorio donde vive este script (raíz del proyecto)
cd "$(dirname "$0")"

# Verificar que node_modules exista
if [ ! -d "node_modules" ]; then
    echo "[ERROR] No se encontró node_modules/. Ejecuta 'npm install' primero."
    exit 1
fi

# Verificar que Electron esté instalado
ELECTRON_BIN="node_modules/.bin/electron"
if [ ! -f "$ELECTRON_BIN" ]; then
    echo "[ERROR] Electron no está instalado. Ejecuta 'npm install' primero."
    exit 1
fi

echo "Iniciando LF Automatizador..."
"$ELECTRON_BIN" . &
