#!/usr/bin/env bash
set -Eeuo pipefail

# Copia una distribucion limpia de LF Automatizador al disco local de Linux.
# Incluye codigo fuente y recursos necesarios, pero no copia configuraciones
# locales, cache, node_modules, bases de datos, logs ni binarios de Windows.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESTINO="${LF_COPY_DEST:-$HOME/Documentos/LF_Automatizador}"

pause() {
    echo ""
    read -r -p "Presiona Enter para cerrar esta ventana..." _
}
trap pause EXIT

cd "$SCRIPT_DIR"

echo ""
echo "============================================================"
echo "  Copiando LF Automatizador"
echo "  Origen : $SCRIPT_DIR"
echo "  Destino: $DESTINO"
echo "============================================================"
echo ""

if ! command -v rsync >/dev/null 2>&1; then
    echo "ERROR: rsync no esta instalado."
    echo "Instalalo en Linux con: sudo apt install rsync"
    exit 1
fi

mkdir -p "$DESTINO"

copy_file() {
    local file="$1"
    if [ -f "$file" ]; then
        install -D -m 0644 "$file" "$DESTINO/$file"
        echo "  OK archivo: $file"
    fi
}

copy_script() {
    local file="$1"
    if [ -f "$file" ]; then
        install -D -m 0755 "$file" "$DESTINO/$file"
        echo "  OK script : $file"
    fi
}

sync_dir() {
    local dir="$1"
    if [ -d "$dir" ]; then
        mkdir -p "$DESTINO/$dir"
        rsync -a --delete "$dir/" "$DESTINO/$dir/"
        echo "  OK carpeta: $dir/"
    fi
}

echo "Sincronizando archivos de raiz..."
ROOT_FILES=(
    ".gitignore"
    "LICENSE"
    "POR_HACER.md"
    "README.md"
    "database.js"
    "hidden_analyzer.html"
    "hidden_analyzer.js"
    "main.js"
    "package.json"
    "package-lock.json"
    "entendiendo la consola virtual.md"
    "plan_reparacion_encoder.md"
    "Iniciar_Automatizador.bat"
    "Instalar_Dependencias.bat"
)
for file in "${ROOT_FILES[@]}"; do
    copy_file "$file"
done
copy_script "iniciar.sh"
copy_script "instalar_dependencias.sh"
copy_script "copiar.sh"

echo ""
echo "Sincronizando carpetas de codigo y recursos..."
sync_dir "frontend"
sync_dir "backend"
sync_dir "assets"

echo ""
echo "Sincronizando motor Rust sin target/..."
mkdir -p "$DESTINO/audio-engine-rust"
copy_file "audio-engine-rust/Cargo.toml"
copy_file "audio-engine-rust/Cargo.lock"
copy_file "audio-engine-rust/README.md"
mkdir -p "$DESTINO/audio-engine-rust/src"
rsync -a --delete "audio-engine-rust/src/" "$DESTINO/audio-engine-rust/src/"
echo "  OK carpeta: audio-engine-rust/src/"

echo ""
echo "Sincronizando ejemplos de config, sin ajustes locales..."
mkdir -p "$DESTINO/config"
if [ -f "config/metadata_sources.example.json" ]; then
    install -D -m 0644 "config/metadata_sources.example.json" "$DESTINO/config/metadata_sources.example.json"
    echo "  OK archivo: config/metadata_sources.example.json"
fi

echo ""
echo "Limpiando restos que no deben viajar..."
rm -rf "$DESTINO/cache"
rm -rf "$DESTINO/audio-engine-rust/target"
find "$DESTINO" -maxdepth 1 -type f \( -name "*.log" -o -name "ERROR_ANALYZER_LOG.txt" -o -name "events_db.json" -o -name "event_groups.json" -o -name "explicit_types.json" -o -name "manual_cues.json" -o -name "track_cache.json" \) -delete
find "$DESTINO/config" -maxdepth 1 -type f \( -name "*.sqlite" -o -name "*.sqlite-*" -o -name "*.json" ! -name "*.example.json" -o -name "*.txt" \) -delete

echo ""
echo "Actualizando binario Linux del motor Rust..."
mkdir -p "$DESTINO/bin"
rm -f "$DESTINO/bin/lf-audio-engine.exe" "$DESTINO/bin/lf-audio-engine-debug.exe"
if command -v cargo >/dev/null 2>&1; then
    (
        cd "$DESTINO/audio-engine-rust"
        cargo build --release
    )
    if [ -f "$DESTINO/audio-engine-rust/target/release/lf-audio-engine" ]; then
        cp "$DESTINO/audio-engine-rust/target/release/lf-audio-engine" "$DESTINO/bin/lf-audio-engine"
        chmod +x "$DESTINO/bin/lf-audio-engine"
        echo "  OK motor Rust Linux: bin/lf-audio-engine"
        (
            cd "$DESTINO/audio-engine-rust"
            cargo clean >/dev/null 2>&1 || true
        )
        echo "  OK limpieza Rust: audio-engine-rust/target eliminado"
    else
        echo "  AVISO: cargo termino, pero no encontre el binario esperado."
    fi
else
    rm -f "$DESTINO/bin/lf-audio-engine" "$DESTINO/bin/lf-audio-engine-debug"
    echo "  AVISO: cargo no esta instalado. Ejecuta ./instalar_dependencias.sh en destino para compilar Rust."
fi

chmod +x "$DESTINO/iniciar.sh" "$DESTINO/instalar_dependencias.sh" "$DESTINO/copiar.sh"

echo ""
echo "============================================================"
echo "  Copia completada."
echo ""
echo "  No se copiaron: node_modules, cache, configuraciones locales,"
echo "  bases de datos, logs, target/ ni binarios de Windows."
echo ""
echo "  Para usar en Linux:"
echo "    cd \"$DESTINO\""
echo "    ./instalar_dependencias.sh"
echo "    ./iniciar.sh"
echo "============================================================"
