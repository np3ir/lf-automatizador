# 00 — Arquitectura General del Sistema
*LF Automatizador v1.0*

> **Propósito:** Comprender a vista de pájaro cómo se conectan las distintas piezas del software para emitir audio y gestionar la radio de forma automatizada.

---

## 🏗️ Los Tres Pilares de la v1.0

LF Automatizador v1.0 no es un monolito, sino un sistema distribuido localmente que funciona sobre tres pilares fundamentales que se comunican constantemente.

### 1. El Frontend (Electron Renderer)
Es "la cara" del programa. Toda la interfaz visual, escrita en HTML, CSS y Vanilla JavaScript.
- **Ubicación:** `frontend/*`
- **Responsabilidad:** Dibujar la consola, botones, listas virtuales (renderizado masivo) y capturar las interacciones del operador (clics, atajos de teclado).
- **Limitación:** No puede leer discos, ni hablar con la base de datos de forma directa. Todo se lo pide al Backend mediante IPC.

### 2. El Backend (Node.js / Electron Main)
El "cerebro logístico". Es el proceso principal que tiene acceso absoluto al sistema operativo.
- **Ubicación:** `backend/*` y `main.js`
- **Responsabilidad:** 
  - Consultar y escribir en la base de datos **SQLite** (`better-sqlite3`).
  - Abrir y gestionar las ventanas del Frontend.
  - Lanzar **Workers** (`worker_threads`) para tareas pesadas como análisis FFmpeg o escaneo de discos.
  - Funcionar como "puente" de comunicación (IPC) entre la Interfaz y el Motor de Audio.

### 3. El Motor de Audio (Rust Audio Engine)
El "músculo bruto". Es un ejecutable binario independiente (`lf-audio-engine.exe`), escrito totalmente en Rust. Node.js lo lanza como un proceso secundario (Child Process) al arrancar.
- **Ubicación:** Carpeta `audio-engine-rust/` (código fuente Rust).
- **Responsabilidad:** 
  - Decodificar los MP3/FLAC.
  - Aplicar fades, volúmenes y transiciones exactas al milisegundo.
  - Enviar el sonido directamente a la tarjeta de audio (WASAPI/ASIO) sin latencia.
  - Informar de vuelta a Node.js sobre los niveles de volumen (VU Meters).

---

## 📡 El Flujo de la Información

¿Cómo ocurre la magia cuando el operador le da a "Play" en la consola principal?

1. **Frontend:** El operador hace clic en "Play" en el `Reproductor 1`. El JS de la vista dispara un evento IPC hacia el Backend.
2. **Backend (Node):** Recibe el evento. Busca en la Base de Datos la información de la canción, sus puntos de corte (`cue in`, `cue out`) y se asegura de que el archivo exista.
3. **Node → Rust:** El backend envía un comando en formato JSON a través del canal `stdin` (entrada estándar) al proceso de Rust: `{"cmd": "play", "bus": "pl1", "file": "C:/musica/track.mp3"}`.
4. **Rust:** Recibe el JSON, carga el audio en memoria, lo decodifica y comienza a enviarlo a la tarjeta de sonido. 
5. **Rust → Node:** A medida que suena, Rust escupe JSONs por `stdout` 60 veces por segundo diciendo: `{"type": "vu-meter", "bus": "pl1", "peak": 0.85}`.
6. **Node → Frontend:** Node.js toma ese JSON y lo retransmite por IPC a la interfaz gráfica.
7. **Frontend:** Recibe el nivel de VU Meter y dibuja la barra verde moviéndose en la pantalla.

---

## 🚨 El Gran Cuello de Botella (Por qué la v2.0 existe)

La arquitectura de la v1.0, aunque muy robusta en el audio (gracias a Rust), sufre de un grave problema de rendimiento y recursos (RAM y CPU) en su capa logística:

- **Doble Puente IPC:** Los medidores de volumen y el reloj deben saltar de **Rust** -> **Node.js** -> **Frontend**. Este doble salto genera un uso altísimo de CPU en Chromium (Electron) solo para dibujar las barras de volumen.
- **Workers Pesados:** Node.js no es ideal para múltiples hilos. Levantar un worker en Node cuesta memoria y tiempo.

### La Solución en la v2.0 (Tauri)
En la versión 2.0, **desaparece Node.js por completo**.
El "Motor de Audio" y el "Backend" se fusionan en un solo gran backend nativo escrito en Rust.
La comunicación ahora es un salto directo: **Rust ↔ Frontend**.
- La base de datos se lee con `rusqlite` a la velocidad de la luz.
- Los workers son hilos nativos (`std::thread` o Tokio) sin sobrecarga.
- Los VU Meters se envían directamente al frontend mediante Eventos de Tauri.

---

*Documentado mediante auditoría automática — LF Automatizador v1.0*
