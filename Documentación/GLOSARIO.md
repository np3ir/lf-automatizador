# 📖 Glosario — LF Automatizador v1.0

> Definiciones de términos técnicos y de radio usados en toda la documentación.
> Esencial para que cualquier desarrollador de la v2.0 entienda el contexto sin experiencia previa en radio.

---

## A

**Automatizador**
Software que gestiona la programación y reproducción de audio en una estación de radio de forma automática o semi-automática, sin requerir que un operador esté presente de forma constante.

**Audio Engine (Motor de Audio)**
El componente central responsable de reproducir, pausar, mezclar y controlar todos los flujos de audio. En la v1.0 está implementado en Node.js (`audio_engine_process.js`). En la v2.0 migrará completamente a Rust.

---

## B

**BPM (Beats Per Minute)**
Medida del tempo de una canción. El sistema lo analiza automáticamente para facilitar transiciones musicales suaves.

---

## C

**Calendar / Calendario**
Módulo que permite programar eventos de radio con fecha y hora específicas (salidas al aire de comerciales, programas especiales, etc.).

**CartWall**
Panel de cartuchos de reproducción instantánea. Cada "cartucho" es un botón que reproduce un audio pregrabado (jingle, cortina, efecto de sonido) al instante con una sola pulsación o atajo de teclado.

**Clockwheel (Rueda de Reloj)**
Plantilla circular que define el orden y tipo de contenido que debe sonar en cada segmento de una hora de radio (X canciones, Y comerciales, Z jingles). El automatizador la usa para construir la programación.

**Comercial / Cuña**
Audio publicitario de corta duración que se emite en una tanda. Sinónimo de "spot".

**Consola**
La interfaz principal de operación del automatizador. Desde aquí el operador controla los reproductores, ve qué está al aire y gestiona la programación.

---

## D

**DB / Base de Datos**
Archivo SQLite (`lf_data.sqlite`) donde se almacena toda la información: canciones, artistas, géneros, comerciales, eventos, historial de reproducción, etc.

---

## E

**Encoder**
Módulo que toma la señal de audio generada por el automatizador y la codifica en un formato (MP3, AAC, OGG) para transmitirla por internet (streaming).

**Evento**
Acción programada en el calendario que el automatizador ejecuta automáticamente en un momento determinado (ej: reproducir una tanda de comerciales a las 12:00, activar una cortina de identificación cada hora).

---

## F

**FFmpeg**
Herramienta de software libre usada internamente para decodificar, analizar y convertir archivos de audio. El automatizador lo usa via `ffmpeg-static`.

**Forma de Onda (Waveform)**
Representación visual del audio de una canción. El sistema la genera y almacena para mostrarla en el editor de audio y facilitar la edición de puntos de entrada/salida.

**Fuse.js**
Librería de búsqueda fuzzy (aproximada) usada en la librería musical para encontrar canciones aunque el usuario escriba términos con errores o incompletos.

---

## G

**Género Musical**
Categoría musical (Pop, Rock, Salsa, Vallenato, etc.) asignada a cada canción. El clockwheel usa géneros para construir programaciones balanceadas.

**Género Explícito**
Subgénero o categoría que contiene contenido adulto. El sistema tiene un manejo especial para evitar que se emita en horarios no aptos.

---

## I

**IPC (Inter-Process Communication)**
Mecanismo de Electron que permite que el código de la interfaz (frontend/renderer) se comunique con el código del sistema (backend/main process). En la v1.0 se usa `ipcRenderer.send` e `ipcRenderer.invoke`. En la v2.0 estos se reemplazarán por **comandos de Tauri** (`invoke()` hacia Rust).

---

## J

**Jingle**
Pieza de audio corta, generalmente musical, que identifica a la emisora o a un segmento del programa (ej: cortina de noticias, identificador de estación).

---

## L

**Librería / Library**
La colección completa de archivos de audio indexados en el sistema. Incluye canciones, jingles, comerciales y cualquier otro audio catalogado.

---

## M

**Metadatos**
Información almacenada dentro de un archivo de audio: título, artista, álbum, año, género, portada (cover art), BPM, etc. El sistema los extrae con `node-id3` y `ffmpeg`.

**Modo Automático**
Estado del automatizador en que la reproducción avanza sola sin intervención del operador, siguiendo el clockwheel y la cola de reproducción.

**Modo Manual**
Estado en que el operador controla cada reproducción individualmente.

---

## N

**Node-ID3**
Librería de Node.js usada para leer y escribir metadatos ID3 de archivos MP3.

**Now Playing**
Información del tema actualmente al aire. El sistema la exporta al archivo `config/NowPlaying.txt` para integraciones externas (ej: página web de la emisora).

---

## O

**Operador**
La persona que trabaja frente al automatizador durante una transmisión en vivo.

---

## P

**Perfil de CartWall**
Configuración guardada del CartWall. Permite al operador cambiar entre distintos conjuntos de cartuchos según el programa o el horario.

**Preview**
Ventana secundaria para escuchar una canción antes de ponerla al aire, usando una salida de audio diferente a la principal.

**Proceso Principal (Main Process)**
En Electron, el proceso que tiene acceso al sistema operativo, al sistema de archivos y a todas las APIs nativas. En la v1.0 es `main.js`. En la v2.0 será el binario Rust.

**Proceso Renderer**
En Electron, el proceso que muestra la interfaz web (HTML/CSS/JS). En Tauri se mantiene igual como WebView.

**Punto de Entrada (Cue In)**
El momento exacto dentro de un archivo de audio donde la reproducción debe comenzar (para recortar silencios al inicio).

**Punto de Salida (Cue Out)**
El momento exacto donde la reproducción debe terminar antes de que el archivo acabe (para recortar silencios al final).

---

## R

**Renderer**
Ver *Proceso Renderer*.

**Rust**
Lenguaje de programación de sistemas, de alto rendimiento y seguro en memoria. Será el lenguaje del backend de la v2.0 en Tauri.

---

## S

**Session State**
El estado de la sesión actual guardado en `config/session_state.json`. Permite al programa recordar el estado de los reproductores, la cola de canciones y otras variables si se cierra y vuelve a abrir.

**SQLite**
Base de datos relacional embebida (sin servidor). Toda la información del automatizador vive en un único archivo `.sqlite`.

**Streaming / Encoder**
Proceso de transmitir la señal de audio por internet. El módulo Encoder del automatizador gestiona la conexión a un servidor Icecast/SHOUTcast.

---

## T

**Tanda Comercial**
Bloque de tiempo dedicado a la emisión de comerciales/cuñas. Interrumpe la música y reproduce los spots en secuencia.

**Tauri**
Framework para construir aplicaciones de escritorio usando tecnologías web (HTML/CSS/JS) para la interfaz y Rust para el backend nativo. Es el reemplazo de Electron en la v2.0.

**Transición**
Efecto de audio que se aplica entre dos canciones (fade out, fade in, crossfade, etc.). El editor de transiciones permite configurar el comportamiento de cada tipo de transición.

---

## V

**VU Meter (Medidor de Volumen)**
Indicador visual que muestra el nivel de la señal de audio en tiempo real. El sistema los muestra para cada reproductor activo.

---

## W

**Worker**
Proceso de Node.js que corre en segundo plano para tareas pesadas sin bloquear la interfaz: escaneo de archivos, análisis de audio, extracción de metadatos, etc.

**Waveform**
Ver *Forma de Onda*.

---

*Este glosario se amplía automáticamente a medida que la auditoría avanza.*
