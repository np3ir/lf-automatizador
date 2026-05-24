# 03 — Motor de Audio (Backend)
*Módulo: `backend/audio_engine_process.js` + `frontend/audio_engine_client.js` (17 KB)*

> **¿Qué es este módulo?**
> El Motor de Audio es el sistema que convierte los comandos del operador (Play, Stop, Fade, etc.) en sonido real. No es una ventana — es el puente de comunicación entre la interfaz gráfica y el binario ejecutable Rust (`lf-audio-engine.exe` en Windows, `lf-audio-engine` en Linux) que realiza el procesamiento de audio a nivel nativo.
> Este módulo es el más crítico para la migración a Tauri v2.0 porque **el ejecutable Rust ya existe y ya funciona**. La v2.0 solo necesita integrar su lógica directamente en el proceso principal de Tauri en lugar de como un proceso hijo.

> [!IMPORTANT]
> **El motor Rust (`lf-audio-engine`) YA está en producción en la v1.0.** No es algo nuevo para la v2.0 — es el ejecutable en `bin/lf-audio-engine.exe` que corre en segundo plano. La v2.0 lo integrará como librería Rust nativa en lugar de proceso hijo.

---

## 🏗️ Arquitectura del Motor

```
[Consola Principal (render.js)]
         │
         ▼
[audio_engine_client.js] ←── Capa cliente en el Renderer
         │ ipcRenderer.invoke('audio-engine-rust-command', cmd)
         ▼
[main.js] ←── Proceso Principal Electron
         │
         ▼
[audio_engine_process.js (RustAudioEngineProbe)]
         │ stdin/stdout (JSON por líneas)
         ▼
[bin/lf-audio-engine.exe] ←── EL MOTOR RUST REAL
         │
         ▼
[Dispositivo de Audio del Sistema Operativo]
```

---

## ⚙️ Cómo funciona la comunicación con Rust

El motor Rust es un **proceso hijo** que se inicia automáticamente cuando arranca el automatizador. La comunicación es por **stdin/stdout usando JSON por líneas**:

1. La consola envía un comando JSON por `stdin`: `{"cmd": "play", "player": "player-a", "path": "/musica/cancion.mp3"}\n`
2. El motor Rust procesa el comando y responde por `stdout`: `{"type": "status", "players": [...]}\n`
3. Cada comando tiene un `requestId` único para emparejar respuesta con petición.

**Timeout por defecto:** 3 segundos (excepto `getPeaks` que es 20 segundos)

---

## 📋 Comandos que entiende el Motor Rust

### Reproducción de Playlists
| Comando (`cmd`) | Para qué sirve |
|---|---|
| `play` | Reproduce un archivo de audio en un player (`player-a`, `player-b`, `player-c`) |
| `stop` | Detiene un player específico |
| `pause` | Pausa un player |
| `resume` | Reanuda un player pausado |
| `seek` | Busca una posición específica en el audio (en segundos) |
| `fade` | Aplica una rampa de volumen (fade in/out) de `fromGain` a `toGain` en `durationMs` milisegundos |
| `setGain` | Establece el volumen de un player instantáneamente |
| `transport` | Consulta el estado de transporte de todos los players |

### Control de Playlist Inteligente
| Comando | Para qué sirve |
|---|---|
| `playlistSnapshot` | Sincroniza la lista completa de pistas con el motor (qué existe en la playlist) |
| `playlistMode` | Configura modos: bucle, eliminar al terminar, repetir canción |
| `playlistPlaybackContext` | Le dice a Rust qué pista está sonando ahora y cuál es la siguiente |
| `playlistFinished` | Notifica que una pista terminó — Rust decide qué reproducir a continuación |
| `playlistManualNext` | El operador presionó "Siguiente" — Rust lo gestiona |
| `nowPlaying` | Informa al motor qué pista está al aire (para NowPlaying.txt y streaming) |

### Efectos y Procesamiento
| Comando | Para qué sirve |
|---|---|
| `setFx` | Configura la cadena de efectos (EQ, compresor, limitador) |
| `getPeaks` | Analiza un archivo de audio y devuelve los peaks para dibujar la forma de onda |
| `setMonitor` | Configura el bus de monitores |
| `setCue` | Configura el bus de pre-escucha (auriculares) |

### Locución de Hora
| Comando | Para qué sirve |
|---|---|
| `timeLocution` | Reproduce el audio de locución de hora desde una carpeta — el motor busca el archivo que corresponde a la hora actual |

### Encoder / Streaming
| Comando | Para qué sirve |
|---|---|
| `encoder` | Control del encoder: `start`, `stop`, `status` |
| `encoderTap` | Activa/desactiva el envío de chunks PCM por stdout para el encoder (20ms por chunk) |

### Diagnóstico
| Comando | Para qué sirve |
|---|---|
| `status` | Solicita el estado completo de todos los players y buses |
| `devices` | Lista los dispositivos de audio disponibles en el sistema |
| `snapshot` | Genera un snapshot completo del estado del motor para diagnóstico |

---

## 📡 Eventos Asíncronos que EMITE el Motor Rust (sin que se los pidan)

| Tipo de mensaje | Cuándo llega | Qué hace el sistema |
|---|---|---|
| `status` (push) | Cada 100ms — el motor los envía por su cuenta | Actualiza el estado de todos los players en tiempo real |
| `timeLocutionStarted` | Cuando arranca una locución de hora | El frontend actualiza la UI para mostrar que está sonando la locución |
| `timeLocutionEnded` | Cuando termina una locución de hora | El frontend avanza la playlist |
| `playlistAction` | Cuando el motor Rust decide qué reproducir a continuación | El frontend ejecuta la acción (`playRow`, `removeRow`, `stop`, `resolveRandom`) |
| `playlistModeChanged` | Cuando el motor cambia un modo de reproducción automáticamente | La UI actualiza los botones de modo (ej: desactiva Repetir después de N veces) |
| `pcmChunk` | Cada 20ms cuando el encoder está activo | Los datos PCM se envían al proceso de FFmpeg para streaming |

---

## 📂 Archivos del Motor Rust

| Archivo | Descripción |
|---|---|
| `bin/lf-audio-engine.exe` | El ejecutable Rust para Windows |
| `bin/lf-audio-engine` | El ejecutable Rust para Linux |
| `audio-engine-rust/` | El código fuente Rust del motor (proyecto Cargo) |
| `config/audio_engine_report.jsonl` | Log de todas las comunicaciones con el motor (rotación automática a 5 MB, conserva último 1 MB) |

---

## 🛡️ Sistema de Resiliencia (Guardia de Aire)

El motor tiene un sistema de recuperación automática (`rustPlaylistOwnerHealth` en `render.js`) que:
1. **Detecta si Rust se colgó** — si la posición del audio no avanza en 9 segundos, asume un stall
2. **Intenta recuperar** — envía un comando de reset al motor
3. **Registra el incidente** en el Centro de Incidencias con categoría "guard"
4. **Fallback temporal** — si el motor Rust falla, puede volver al modo Web Audio API por un tiempo

---

## 🔮 Implicaciones para la v2.0 (Tauri/Rust)

| Elemento actual | Qué cambia en v2.0 |
|---|---|
| `audio_engine_process.js` (proceso hijo) | **Se elimina** — el código Rust del motor se compila DENTRO del binario Tauri |
| `audio_engine_client.js` (cliente IPC) | **Se reemplaza** por llamadas directas a comandos Tauri (`invoke()`) |
| Comunicación JSON por stdin/stdout | **Se reemplaza** por llamadas de función directas entre Rust y el frontend |
| `bin/lf-audio-engine.exe` | Su código fuente (`audio-engine-rust/`) se integra como librería en el proyecto Tauri |
| `config/audio_engine_report.jsonl` | Puede mantenerse como log — Tauri puede escribirlo desde Rust |

> [!IMPORTANT]
> El código Rust del motor (`audio-engine-rust/`) es el activo más valioso para la migración. Ya implementa reproducción, fades, EQ, compresión, limitación, buses de audio, streaming PCM y locución de hora. En la v2.0 no se reescribe — se integra.

---

*Documentado mediante auditoría automática — LF Automatizador v1.0*
*Referencia para LF Automatizador v2.0 (Tauri + Rust)*
