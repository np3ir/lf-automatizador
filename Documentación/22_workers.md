# 22 — Workers de Backend (Hilos Secundarios)
*Módulo: `backend/*_worker.js` | Motor: `worker_threads` (Node.js)*

> **¿Qué es este módulo?**
> Para evitar que la interfaz de usuario se congele durante procesos pesados, el automatizador v1.0 delega el procesamiento intensivo a hilos secundarios usando `worker_threads` de Node.js.
> Los workers procesan audio con FFmpeg/Rust, leen/escriben tags ID3 y escanean carpetas masivamente.

---

## 🧵 Workers Disponibles

### 1. Worker de Análisis de Audio (`audio_analysis_worker.js`)
El worker de mayor carga de CPU. Analiza masivamente las canciones para encontrar sus puntos de corte y niveles de volumen.
- **Motor:** Dual. Intenta usar el ejecutable nativo Rust (`lf-audio-engine`) y si falla o no está disponible, cae a `FFmpeg`.
- **Concurrencia:** Máximo 5 hilos en paralelo (dependiendo de los núcleos del procesador).
- **Entrada:** Rutas de archivos y umbrales de detección en dB (Mix, Start, Fin).
- **Proceso (FFmpeg):** Usa `volumedetect` para hallar los niveles pico y RMS, y `silencedetect` para encontrar los puntos de Intro/Outro/Mix.
- **Proceso (Rust):** Envía comandos JSON `analyzeAudio` al motor nativo.
- **Salida:** Guarda directamente en la Base de Datos los valores de `inicio`, `fin`, `mix`, `db`, y `peak_db`.

### 2. Worker de Metadatos Locales (`metadata_worker.js`)
Encargado de leer y escribir etiquetas directamente dentro de los archivos de audio (MP3/FLAC).
- **Librería:** `node-id3`.
- **Modos:**
  - `read`: Lee las etiquetas del archivo físico y las guarda en la base de datos (título, artista, álbum, año, género). Reconoce artistas invitados (feat).
  - `write`: Toma los metadatos modificados en la Base de Datos y los incrusta permanentemente en el archivo físico. Solo usa 1 hilo para evitar corrupción de archivos concurrentes.

### 3. Worker de Metadatos de Red (`meta_net_worker.js`)
Busca información de canciones en internet cuando no tienen tags locales.
- **Fuentes:** MusicBrainz API y iTunes Search API.
- **Comportamiento:** Usa el nombre de archivo o título parcial para buscar el año de lanzamiento original y el álbum oficial.

### 4. Worker de la Librería (`library_worker.js`)
Escaneo hiper-rápido de directorios del disco duro.
- Recorre recursivamente las carpetas musicales.
- Detecta altas, bajas y modificaciones comparando con la Base de Datos.
- Envía los datos procesados al hilo principal.

### 5. Workers Menores (`waveform_worker.js`, `file_scan_worker.js`, `commercial_scan_worker.js`)
Workers auxiliares para tareas específicas de menor impacto, como detectar comerciales o procesar datos de la forma de onda.

---

## 🔄 Flujo de Trabajo Típico de un Worker

1. El hilo principal (`main.js`) recibe un comando IPC de la UI (ej. `lib-start-analyzer-ffmpeg`).
2. El hilo principal envía un mensaje `start` con la cola de tareas (array de rutas) al Worker usando `postMessage`.
3. El Worker encola las tareas y lanza una función de bombeo (`pump()`).
4. A medida que completa cada archivo, el Worker envía `postMessage({ type: 'result', payload: ... })`.
5. El hilo principal recibe el resultado y lo emite a la UI (ej. `analyzer-done`) para que la barra de progreso avance.
6. Al finalizar la cola, envía `postMessage({ type: 'finished' })`.

---

## 🔮 Implicaciones para la v2.0 (Tauri/Rust)

En Tauri v2.0, los `worker_threads` de Node.js **deben desaparecer**. En su lugar, el procesamiento paralelo es mucho más natural y eficiente en Rust usando hilos nativos (`std::thread`) o Tokio.

| Worker actual | Equivalente en Tauri/Rust |
|---|---|
| `audio_analysis_worker.js` | Funciones Rust que usen una pool de hilos (`rayon` o `tokio::task::spawn_blocking`). El código nativo de análisis del motor ya existe. |
| `metadata_worker.js` | Librerías Rust como `id3` o `lofty` ejecutadas en un hilo de Tokio. Es síncrono por defecto en estas librerías. |
| `meta_net_worker.js` | `reqwest` en funciones asíncronas de Tokio. |
| `library_worker.js` | `walkdir` o `jwalk` en Rust (mucho más rápidos que Node.js para I/O de archivos masivos). |
| Mensajería (`postMessage`) | Se reemplaza por `app_handle.emit_all()` desde el backend de Rust hacia el frontend JS. |

---

*Documentado mediante auditoría automática — LF Automatizador v1.0*
*Referencia para LF Automatizador v2.0 (Tauri + Rust)*
