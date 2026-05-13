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
- [~] **Fuente PCM del Encoder desde Rust:** Ya existe contrato para distinguir fuente solicitada, fuente real y fallback. Estado actual: master usa `webAudioRenderer -> ffmpeg`; Rust queda preparado como proveedor futuro cuando el motor entregue PCM de master real.
- [ ] **Perfiles de Servidores Multiples:** Crear una pequeña base de datos para guardar perfiles de conexión (Ej: "Principal", "Backup", "Test") y poder intercambiar de emisora/servidor con un solo clic.

## 🎧 2. Ventanas y Experiencia de Usuario (UI/UX)
- [x] **Arrastre visual interactivo:** Implementado el salto en la línea de tiempo (seek) con clic derecho sostenido, permitiendo cancelar al salir del área o pulsar Escape.
- [x] **Unificación de Íconos Nativos:** Los íconos de las ventanas en la barra de tareas y el título principal ahora renderizan emojis como `.png` reales, dándole una apariencia 100% nativa de Windows sin la "X" genérica de Electron.
- [ ] **Rediseño del Menú Contextual (Problema Escucha Previa):** Evaluar más adelante la posibilidad de migrar los menús de clic derecho (que actualmente son de HTML) a **Menús Nativos de Windows vía Electron**.
- [ ] **Precargar ventanas secundarias:** Pre-crear las ventanas más usadas (Librería, Editor de Audio) con `show: false` al arrancar, y mostrarlas al instante cuando el usuario las abra.
- [ ] **Atajos de teclado globales:** Registrar hotkeys de Windows (Ctrl+F1 = Play/Pause, Ctrl+F2 = Next, etc.) para controlar la radio desde cualquier ventana abierta.
- [ ] **Indicador de salud del sistema:** Mostrar en la interfaz principal el estado de workers activos, conexión del encoder, uso de memoria y estado del WAL de SQLite.

## 🗃️ 3. Biblioteca, Metadatos y Archivos Físicos
- [ ] **Sincronización Bidireccional de Etiquetas (ID3 Tags):** Lograr que al modificar información desde el "Editor de Pistas" o el "Editor de Géneros", los cambios se escriban directamente en el archivo MP3 físico.
- [ ] **Integración Explorador / Editor de Géneros:** Mejorar la vista izquierda para poder alternar más fácilmente entre "Carpetas Físicas de la PC" y "Vista por Géneros de Biblioteca".
- [ ] **Búsqueda incremental (Fuse.js):** Usar `.add()` para agregar solo los nuevos tracks en vez de reconstruir el índice completo de Fuse.js cada vez que se importa música.

## ⚡ 4. Optimización de Rendimiento y Arquitectura "Divide y Vencerás" (Auditoría Integral)

> **Principio Fundamental: La Interfaz (Renderer) es un Control Remoto "Tonto".** 
> * **Cero Cálculos Futuros:** La interfaz gráfica (HTML/CSS/JS del frontend) NO debe tomar decisiones lógicas, NO debe precalcular tiempos futuros, ni procesar audio. 
> * **Datos Pre-digeridos:** El frontend solo debe encargarse de **dibujar** y recibir los datos ya preparados desde el backend (Node.js o Rust). Si hay que sumar tiempos, buscar bases de datos o mezclar audio, eso ocurre estrictamente en el backend.
> * **Separación Total:** `render.js` debe reducirse drásticamente. Su única misión es enviar la orden del usuario (ej. un clic en "Play") y mostrar la respuesta. El motor principal y toda la inteligencia debe vivir en Node.js o Rust, garantizando la independencia de los procesos.

### 🔴 Tareas Críticas de Delegación (Sacar de `render.js`)
- [ ] **Análisis de Ondas de Audio (Waveform Peaks):** Actualmente `buildMainWaveformPeaks()` lee búferes pesados y hace cálculos matemáticos intensivos en JavaScript. Esto bloquea el hilo principal y dispara el uso de RAM. **Acción:** Delegar al motor Rust para que decodifique y devuelva un array ligero de picos listos para pintar.
- [ ] **Preanálisis de Silencios y Fades (Auto-Cue):** Las funciones `ensurePreanalysisForTrack()` iteran millones de samples para detectar silencios. **Acción:** Delegar a Rust o un Worker C++. El render solo debe recibir la respuesta `{ intro: 0.5, outro: 210.0 }`.
- [ ] **Generador de Playlists (Clockwheel / Rotation):** Toda la inteligencia de armar listas de 60 minutos respetando reglas de separación (`buildRotationPlaylist`, etc.) vive en el cliente (~500 líneas). **Acción:** Mover este algoritmo matemático a un WebWorker dedicado o al Main Process. Debe ejecutarse en paralelo sin congelar la UI y solo devolver la lista resultante.
- [ ] **Gestor de Eventos y Timers (`checkEvents`):** El cliente tiene un bucle `setInterval` de 1000ms comprobando arrays masivos de horas para disparar acciones automáticas. **Acción:** Mover el reloj principal al backend. El Main Process o Rust debe llevar el control del tiempo exacto y simplemente enviar un IPC `[EVENT_TRIGGER]` al render cuando deba pintar o saltar.
- [ ] **Cálculos de Tiempo Proyectado (`recalcEndTime` y `_calcTbodyHours`):** Recalcular la hora en la que sonará la canción #45 de la playlist requiere iterar y sumar milisegundos constantemente en cada salto. **Acción:** Delegar esto al motor, que debe despachar un estado general de la playlist pre-calculado.


### 🟣 Auditoría de Librería y Editores Avanzados (Audio, Transiciones, Pisadores)
- [ ] **Decodificación de Audio Redundante en Editores:** Actualmente `audio_editor.js`, `jingle_editor.js` y `transition_editor.js` usan `AudioContext.decodeAudioData` independientemente. Cargar un track largo en múltiples ventanas consume cientos de megabytes de RAM porque cada uno decodifica el archivo completo a PCM puro en JavaScript. **Acción:** El motor Rust debe ser el único decodificador (Single Source of Truth). Los editores solo deben recibir la data PCM o los picos pre-renderizados.
- [ ] **Renderizado de Forma de Onda en Tiempo Real:** El `cursorLoop()` y `requestAnimationFrame` en los editores repintan el Canvas constantemente, disparando el uso de CPU/GPU. **Acción:** Optimizar el dibujado a un sistema de "Capas" (Capa estática para la onda, capa dinámica para la aguja) o delegar el renderizado a WebGL/Rust.
- [ ] **Filtros de Búsqueda Masiva en `libreria.js`:** `applyCurrentSearchAndRender()` filtra y ordena miles de pistas en memoria usando arreglos nativos de JavaScript (`Array.filter`). **Acción:** Mover estas búsquedas directamente a SQLite (`SELECT ... WHERE title LIKE %x%`). La BD está optimizada en C para esto; el Front-End solo debe pedir datos y mostrar resultados.
- [ ] **Inyección Masiva en DOM de Librería:** Cargar la biblioteca entera congela la UI al inyectar miles de nodos `<tr>`. **Acción:** Implementar "Virtual Scrolling" en `libreria.html` para pintar solo lo visible en pantalla, reduciendo el peso de la UI en más de un 90%.
- [ ] **Reproductores Paralelos (Web Audio API):** Cada editor y el "Pre-escucha" usan su propia instancia del motor de audio de JavaScript local. Compiten por la tarjeta de sonido. **Acción:** Electron debe actuar como un mando a distancia. Los editores solo deben enviar comandos (Play/Stop/Seek) al motor central de Rust en el backend.

### 🟡 Refactorización y Limpieza Estructural de `render.js`
- [ ] **Modularizar Front-End:** Dividir el monolito de 7,000 líneas en módulos independientes: `audio_engine_client.js` (comunicación con Rust), `ui_playlist.js` (DOM de la tabla), `ui_clockwheel.js` (Modal de generador), y `ui_waveform.js` (Canvas).
- [ ] **Virtualización de la Playlist (Virtual Scrolling):** Actualmente, cargar una playlist de 3000 canciones inyecta miles de `<tr>` al DOM. **Acción:** Implementar paginación o virtualización visual (renderizar solo las 30-40 filas visibles en pantalla en base al scroll) para que la RAM no colapse por culpa del DOM.
- [ ] **Eliminar consultas bloqueantes a SQLite desde `render.js`:** Evitar llamadas síncronas IPC `invokeSync` durante bucles de dibujado de la interfaz. Todo debe fluir mediante promesas asíncronas o eventos paralelos.

### 🟢 Mejoras Generales de Memoria
- [x] **Autodestrucción de Procesos (Ahorro de RAM):** Se implementó el apagado automático del Worker de la Librería tras 10s de inactividad, liberando ~70MB.
- [x] **Caché Inteligente de Sesión:** `mapTrackRowToClient()` usa BD para no golpear el disco duro con `fs.existsSync()` en cargas masivas.
- [ ] **Centralizar escrituras DB desde Workers:** Migrar a comunicación vía `parentPort.postMessage` para evitar bloqueos `SQLITE_BUSY` por accesos simultáneos.

## 🧹 5. Limpieza de Código y Backend
- [x] Extraer lógica de Artistas, Géneros y Utilidades de `main.js` a `backend/services/`. (Completado - Se aligeró el proceso principal en ~2,000 líneas).
- [ ] **Eliminar `migrateDataFromJSON()` en database.js:** Se ejecuta buscando archivos antiguos inexistentes.
- [ ] **Eliminar `renderer.js` proxy:** Es un archivo inútil de 1 sola línea (`require('./render.js')`). Apuntar directo a `render.js` desde `main.js`.

## ⚙️ 6. Correcciones y Mantenimiento General
- [x] Atajos `Ctrl+C/X/V` nativos integrados para copiado entre playlists manteniendo toda la metadata intacta.
- [x] Clima Inteligente sin API: `settings.js` ahora maneja autocompletado y obtiene la ubicación asíncrona persistiendo en disco local para lecturas en segundo plano sin bloquear el hilo principal de `render.js`.
- [x] Eventos automáticos no deben limpiar todas las playlists: Corregido para afectar solo su respectiva área de emisión.
- [ ] **Modo Linea/Auxiliar para playlists:** Renombrar en consola las playlists como `Linea/Auxiliar` para rutear salidas exclusivas de audio.
- [ ] **FX como parte formal del motor:** Documentar el flujo del Master FX (EQ, Compresor) para el nuevo motor Rust.
- [x] Limpieza de BD de artistas y Cédula de Artista reparadas.

## 🐧 7. Preparación para Compatibilidad con Linux (Cross-Platform)

Esta sección define la hoja de ruta para lograr que el Automatizador funcione en Linux, **sin abandonar Windows**. Ambos ecosistemas convivirán pacíficamente en este mismo proyecto. El objetivo es lograr "Cero Dependencias" en Linux (instalar y ejecutar, igual que en Windows).

> **Regla de Oro: Código Base Único (Convivencia Windows/Linux).** 
> ⚠️ **ATENCIÓN PARA DESARROLLADORES E IAs:** NO se debe eliminar ni destruir el código existente de Windows. La lógica de Windows y Linux debe convivir en los mismos archivos. 
> NO se crearán carpetas separadas. Se usará exactamente el mismo código base para ambos sistemas. Cuando un proceso sea diferente según el sistema operativo (ej. invocar un motor `.exe` vs un binario de Linux), se debe utilizar un condicional (`if (process.platform === 'win32') { ... } else if (process.platform === 'linux') { ... }`). La compatibilidad con Linux se **suma** al código actual de Windows, no lo reemplaza.

### 🟢 Nivel 1: Cambios Seguros (Hacer ahora desde Windows)
- [x] **Estandarizar Rutas de Archivos:** Corregido. Se eliminaron barras invertidas hardcodeadas (`\\`) en `render.js` (explorador de archivos), `libreria.js` (defaults de drives y labels) y `audio_engine_process.js` (resolución multiplataforma del binario Rust con `.exe` para Windows y sin extensión para Linux). Ahora se usa `path.join()`, `path.sep` y `process.platform` donde es necesario.
- [x] **Rutas de Datos de Usuario:** Auditado. Todas las rutas de BD y configuración ya usan `path.join(__dirname, 'config')` (relativas al ejecutable), lo cual es portable por naturaleza entre Windows y Linux. No se encontraron referencias absolutas a discos. Se eliminó `frontend/restore.js` (script temporal de depuración con rutas absolutas hardcodeadas que no formaba parte del programa).
- [x] **Scripts de Arranque:** Creado `iniciar.sh` para Linux con verificación de dependencias y ruta relativa automática. También se corrigió `Iniciar_Automatizador.bat` reemplazando la ruta absoluta `C:\LF Automatizador v1.0` por `%~dp0` (directorio del .bat), haciéndolo portable.

### 🟡 Nivel 2: Cuidado con el Sistema Operativo (Case Sensitivity)
- [x] **Auditoría de Mayúsculas/Minúsculas:** Implementado. Se creó `backend/path_case_audit.js` (módulo de auditoría) y se conectó via IPC en `backend/ipc/ui.js` como `db-maintenance-path-audit`. Funciona en dos modos: **diagnóstico** (por defecto, solo reporta sin tocar nada) y **reparación** (con `autoFix: true`, corrige los registros en la BD para que coincidan con el casing real del disco). En Windows no modifica nada porque el SO ya ignora mayúsculas; en Linux corrige rutas tipo `Bachata.mp3` → `bachata.mp3` automáticamente. Actualiza `tracks`, `track_artist_links` y `track_genre_links` en una transacción atómica.

### 🔴 Nivel 3: El Motor y Empaquetado (Hacer cuando el motor Rust esté listo)
- [ ] **Eliminación Total de Web Audio API:** Confirmar que el motor JavaScript haya sido erradicado antes de intentar compilar para Linux, evitando arrastrar código híbrido.
- [ ] **Compilación Cruzada de Rust:** Configurar Cargo para compilar el motor de audio en binarios nativos para Linux, asegurando la comunicación con ALSA/PulseAudio mediante librerías multiplataforma.
- [ ] **Permisos de Ejecución (FFmpeg y Rust):** Garantizar que al empaquetar para Linux, los binarios de FFmpeg nativo y el motor de Rust adquieran permisos de ejecución (`chmod +x`), de lo contrario el SO los bloqueará.
- [ ] **Exportación Cero Dependencias:** Configurar `electron-builder` en el `package.json` para generar los instaladores `.deb` (Debian/Ubuntu/Mint) y `.AppImage` (Portable Universal), los cuales llevarán incrustados Node, el navegador, FFmpeg y el Motor de Audio sin requerir instalaciones externas.

---
*Nota: Este archivo se irá actualizando a medida que deleguemos la arquitectura de "render.js masivo" al concepto de "Divide y Vencerás". El objetivo principal para esta fase es transformar a Electron en un control remoto puro.*
