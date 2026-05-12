# LF Automatizador v0.9.0 - Roadmap y Tareas Pendientes (TODO)

Este documento es nuestra hoja de ruta compartida. Aquí mantendremos un registro de todas las ideas, mejoras y correcciones pendientes para no olvidar nada mientras avanzamos en el desarrollo de la aplicación.

**Leyenda de Estados:**
- [ ] Pendiente
- [~] En Progreso
- [x] Completado / Listo

---

## 📻 1. Mejoras del Encoder (Streaming por Internet)
- [ ] **Reconexión Automática (Auto-Reconnect):** Implementar un bucle que intente reconectar silenciosamente cada 5-10 segundos si se detecta un micro-corte de red, para no perder la transmisión permanentemente.
- [ ] **Estadísticas Reales de Red:** Mostrar en la interfaz del Encoder los megabytes subidos (`size=`) y la fluctuación exacta del bitrate en tiempo real extraídos directamente de FFmpeg.
- [ ] **Grabador Testigo Local (Logger):** Agregar un parámetro a FFmpeg para que, además de emitir por internet, grabe un respaldo del audio en MP3 en una carpeta local (ej. separando archivos por hora/día).
- [ ] **Perfiles de Servidores Multiples:** Crear una pequeña base de datos para guardar perfiles de conexión (Ej: "Principal", "Backup", "Test") y poder intercambiar de emisora/servidor con un solo clic.

## 🎧 2. Ventanas y Experiencia de Usuario (UI/UX)
- [ ] **Rediseño del Menú Contextual (Problema Escucha Previa):** Evaluar más adelante la posibilidad de migrar los menús de clic derecho (que actualmente son de HTML) a **Menús Nativos de Windows vía Electron**. Esto solucionará definitivamente el problema de que queden ocultos debajo de ventanas "Siempre Visibles" como el reproductor de *Escucha Previa*.

## 🗃️ 3. Biblioteca, Metadatos y Archivos Físicos
- [ ] **Sincronización Bidireccional de Etiquetas (ID3 Tags):** Lograr que al modificar información (Nombre, Género, Intro, Outro) desde el "Editor de Pistas" o el "Editor de Géneros", los cambios no se guarden solo en la base de datos de la app, sino que **se escriban directamente en el archivo MP3 físico**.
- [ ] **Integración Explorador / Editor de Géneros:** Mejorar la vista izquierda para poder alternar más fácilmente entre "Carpetas Físicas de la PC" y "Vista por Géneros de Biblioteca" para facilitar el etiquetado masivo.

## ⚙️ 4. Correcciones y Mantenimiento General
- [x] Bloquear selección de texto accidental al hacer Ctrl+A (Solucionado).
- [x] Corregir fondo naranja/amarillo del indicador "En Vivo" (pgm-dot) de la playlist (Solucionado).
- [x] Sincronizar actualización de la canción actual al encender el Encoder (Solucionado).

---
*Nota: Este archivo se irá actualizando a medida que salgan nuevas ideas o requerimientos operativos en la radio.*
