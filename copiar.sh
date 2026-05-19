#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════╗
# ║  Copiar distribución limpia de LF Automatizador                     ║
# ║  Destino: ~/Documentos/LF_Automatizador/                            ║
# ╚══════════════════════════════════════════════════════════════════════╝

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DESTINO="$HOME/Documentos/LF_Automatizador"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  📦 Copiando LF Automatizador (distribución limpia)         ║"
echo "║  Destino: $DESTINO"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Verificar que la carpeta destino existe
if [ ! -d "$DESTINO" ]; then
    echo "❌ La carpeta destino no existe: $DESTINO"
    echo "   Créala primero y vuelve a ejecutar este script."
    exit 1
fi

# ── Archivos de la raíz ──
echo "📄 Copiando archivos de la raíz..."
cp main.js "$DESTINO/"
cp database.js "$DESTINO/"
cp hidden_analyzer.html "$DESTINO/"
cp hidden_analyzer.js "$DESTINO/"
cp package.json "$DESTINO/"
cp package-lock.json "$DESTINO/"
cp event_groups.json "$DESTINO/"
cp explicit_types.json "$DESTINO/"
cp Iniciar_Automatizador.bat "$DESTINO/"
cp Instalar_Dependencias.bat "$DESTINO/"
cp iniciar.sh "$DESTINO/"
cp instalar_dependencias.sh "$DESTINO/"
cp README.md "$DESTINO/"
cp .gitignore "$DESTINO/"
echo "  ✓ 14 archivos copiados"

# ── Carpetas completas ──
echo "📁 Copiando frontend/..."
cp -r frontend "$DESTINO/"
echo "  ✓ frontend/ copiado"

echo "📁 Copiando backend/..."
cp -r backend "$DESTINO/"
echo "  ✓ backend/ copiado"

echo "📁 Copiando assets/..."
cp -r assets "$DESTINO/"
echo "  ✓ assets/ copiado"

# ── Audio Engine Rust (sin target/) ──
echo "📁 Copiando audio-engine-rust/ (sin target/)..."
mkdir -p "$DESTINO/audio-engine-rust"
cp audio-engine-rust/Cargo.toml "$DESTINO/audio-engine-rust/"
cp audio-engine-rust/Cargo.lock "$DESTINO/audio-engine-rust/"
cp audio-engine-rust/README.md "$DESTINO/audio-engine-rust/"
cp -r audio-engine-rust/src "$DESTINO/audio-engine-rust/"
echo "  ✓ audio-engine-rust/ copiado (sin target/)"

# ── Dar permisos de ejecución a los scripts ──
chmod +x "$DESTINO/iniciar.sh"
chmod +x "$DESTINO/instalar_dependencias.sh"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ✅ Copia completada con éxito.                              ║"
echo "║                                                              ║"
echo "║  Ahora ve a la carpeta destino y ejecuta:                   ║"
echo "║     cd ~/Documentos/LF_Automatizador                        ║"
echo "║     ./instalar_dependencias.sh                               ║"
echo "║     ./iniciar.sh                                             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
