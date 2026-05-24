# 18 — Encoder / Emisor de Radio (Stream)
*Módulo: `encoder.html` + `encoder.js`*

> **¿Qué es este módulo?**
> Es el emisor de radio por internet: configura y controla la conexión del audio producido por LF Automatizador hacia un servidor de streaming (Icecast o Shoutcast) para que los oyentes puedan escuchar la emisora en vivo. Muestra el estado de la conexión, el tiempo acumulado en el aire, la velocidad de bits real, un medidor de nivel de entrada al encoder y un log de eventos cronológico. Incluye reconexión automática con backoff exponencial.

---

## 🪟 La Ventana

| Propiedad | Valor |
|---|---|
| **Título** | Emisor de Radio (Encoder) |
| **Modo** | Ventana flotante secundaria (no modal) |
| **Diseño** | Cabecera de estado + tabs de contenido + barra de botón fija al fondo |
| **Persistencia** | Configuración guardada en `config/encoder_prefs.json` |
| **Tabs** | 2: "Estado y Logs" (activo por defecto) / "Configuración" |

---

## 🧩 Elementos de la Interfaz

### 1. Cabecera del Encoder (`.enc-header`)

#### Badge de Estado (`#enc-status-badge`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Píldora de estado en la esquina superior izquierda |
| ⚡ **Qué** | Indica visualmente el estado de la conexión al servidor de streaming |
| ⏱️ **Cuándo** | Se actualiza al recibir eventos `encoder-status` del backend |
| 📍 **Dónde** | Siempre visible en la cabecera |
| 💡 **Por qué** | El operador sabe de un vistazo si está al aire, sin necesidad de ir a la pestaña de Estado |

**Estados visuales:**
| Estado | Clase CSS | Apariencia | Condición |
|---|---|---|---|
| Desconectado | `status-off` | Gris oscuro, texto gris | Sin conexión al servidor |
| En Vivo | `status-on` | Verde pulsante (animación blink), texto verde | Encoder conectado y transmitiendo |

#### Temporizador de Conexión (`#enc-timer`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Texto monoespaciado `HH:MM:SS` en blanco |
| ⚡ **Qué** | Cuenta el tiempo acumulado desde que el encoder se conectó exitosamente |
| ⏱️ **Cuándo** | Inicia al recibir estado `live`. Se detiene y resetea a `00:00:00` al desconectarse |
| 📍 **Dónde** | Cabecera junto al badge |
| 💡 **Por qué** | Control de tiempo de transmisión; importante para planificación de programas y facturación a anunciantes |

---

### 2. Tabs del Encoder (`.enc-tabs`)

#### Tab "Estado y Logs" (`#tab-btn-status`)
- Pestaña activa por defecto.
- Muestra el panel `#tab-status` con estadísticas en tiempo real y el log.

#### Tab "Configuración" (`#tab-btn-config`)
- Muestra el panel `#tab-config` con todos los parámetros de conexión y audio.
- Si hay un error de validación al conectar (IP/puerto/contraseña faltante), la ventana cambia automáticamente a esta pestaña.

---

### 3. Tab "Estado y Logs" (`#tab-status`)

#### Tarjetas de Estadísticas (`.enc-stats`)

**Tarjeta "Estado actual" (`#enc-status`):**
| Estado del texto | Descripción |
|---|---|
| `LISTO` | Encoder inicializado, sin conexión activa |
| `CONECTANDO...` | Intentando establecer conexión con el servidor |
| `EN VIVO (ON AIR)` | Transmisión activa y estable |
| `DESCONECTADO` | Conexión perdida o detenida |

**Tarjeta "Velocidad / Buffer" (`#enc-bitrate-real`):**
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Valor numérico en formato "XX.X kbps" |
| ⚡ **Qué** | Muestra el bitrate real medido por el motor FFmpeg |
| ⏱️ **Cuándo** | Se actualiza con cada evento `encoder-throughput` del backend. Muestra "--" cuando no hay datos |
| 📍 **Dónde** | Tarjeta derecha del panel de estadísticas |
| 💡 **Por qué** | Permite verificar que el stream está saliendo al bitrate configurado y no hay degradación |

#### Medidor de Entrada al Encoder (`.enc-input-meter-container`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Barra de nivel VU horizontal con gradiente verde-amarillo-rojo (escala -36 dB a +3 dB) |
| ⚡ **Qué** | Muestra el nivel de audio que entra al encoder en tiempo real (Pico y RMS en dB) |
| ⏱️ **Cuándo** | Se actualiza con eventos `encoder-input-meter` (del motor FFmpeg) o `audio-engine-rust-event` (del motor Rust, con throttle de 20ms). Muestra "-- dB" cuando no hay señal |
| 📍 **Dónde** | Barra horizontal bajo las tarjetas de stats. El valor numérico "Pico: X dB | RMS: X dB | fuente" se muestra encima |
| 💡 **Por qué** | Permite detectar silencio, saturación o pérdida de señal antes de que los oyentes lo reporten |

**Comportamiento del medidor:**
| Condición | Visualización |
|---|---|
| Señal normal | Barra VU llena proporcionalmente |
| Silencio > 4 segundos | Contenedor marcado con clase `warn` + indicación "silencio Ns" |
| Sin datos del motor Rust | Cubre mostrando 100% (barra negra) |

**Escala de colores de la barra:**
- 0–79.5% → Verde (`#27ae60`)
- 79.5–89.7% → Amarillo/naranja (`#f39c12`)
- 89.7–100% → Rojo (`#e74c3c`)

#### Registro de Emisión / Log (`#enc-log`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Caja de texto tipo consola (fondo negro, fuente monoespaciada) |
| ⚡ **Qué** | Registra cronológicamente todos los eventos del encoder con timestamp |
| ⏱️ **Cuándo** | Siempre activo. Máximo 500 líneas (se eliminan las más antiguas automáticamente). Auto-scroll al fondo |
| 📍 **Dónde** | Parte inferior de la pestaña Estado |
| 💡 **Por qué** | Permite diagnosticar problemas de conexión: errores de autenticación, pérdidas de red, reintentos |

**Tipos de log y colores:**
| Tipo | Color | Ejemplos |
|---|---|---|
| `info` | Gris claro | "Encoder listo." |
| `success` | Verde `#2ecc71` | "Conectado correctamente." |
| `warn` | Amarillo `#f1c40f` | "Reconectando en 10 segundos... intento 2." / "Deteniendo emisión..." |
| `error` | Rojo `#e74c3c` | "Error: Connection refused" / "Faltan IP/host o el puerto no es válido." |

---

### 4. Tab "Configuración" (`#tab-config`)

#### Sección "Servidor de Streaming (Icecast / Shoutcast)"

| Campo | ID | Descripción | Notas |
|---|---|---|---|
| Tipo Servidor | `#enc-type` | Icecast (ZenoRadio, Listen2MyRadio) / Shoutcast (Clásico) | Al seleccionar Shoutcast, el campo "Punto de Montaje" se oculta |
| Motor de Audio | `#sel-encoder-provider` | Automático / Motor Rust | Define qué motor captura el audio para encodear |
| Punto de escucha | `#enc-tap-point` | Post-FX / procesado ↔ Pre-FX / limpio | Define si el stream recibe el audio ya procesado por efectos o la mezcla limpia. Cambio en **caliente** (sin reiniciar el encoder) |
| IP / Host | `#enc-ip` | Dirección del servidor de streaming | Ej: `cast.zenomedia.com` |
| Puerto | `#enc-port` | Puerto del servidor | Ej: `80`. Validado como entero 1–65535 |
| Contraseña | `#enc-pass` | Contraseña del servidor (Mountpass para Zeno) | Campo tipo `password` (oculto) |
| Punto de Montaje | `#enc-mount` | Solo para Icecast | Ej: `/stream`. Se oculta automáticamente si el tipo es Shoutcast |

**Validaciones antes de conectar:**
| Condición de error | Mensaje en log |
|---|---|
| IP o puerto vacíos / inválidos | "Faltan IP/host o el puerto no es válido." |
| Contraseña vacía | "Falta la contraseña del servidor." |
| Icecast sin punto de montaje | "Falta el punto de montaje para Icecast." |
| Origen mic sin dispositivo seleccionado | "Selecciona una entrada de audio externa." |

> En caso de error de validación, la ventana cambia automáticamente a la pestaña de Configuración.

#### Sección "Audio y Calidad"

| Campo | ID | Opciones | Descripción |
|---|---|---|---|
| Origen de Audio | `#enc-source` | 💻 Mezcla Interna (Master PC) / 🎙 Entrada Externa (Consola/Mic) | Fuente del audio que se enviará al servidor |
| Tarjeta / Línea | `#enc-mic` | Lista de entradas de audio del sistema | Solo visible si el origen es "Entrada Externa". Se carga con permiso del SO al seleccionar |
| Formato (Codec) | `#enc-codec` | MP3 (Universal/Clásico) / AAC (Alta eficiencia, ZenoRadio) | Formato de compresión del stream |
| Calidad (Bitrate) | `#enc-bitrate` | 64 / 128 (defecto) / 192 / 320 kbps | Calidad del stream. Afecta la escala del medidor de throughput |

**Carga de micrófonos:**
Los dispositivos de entrada de audio se cargan **lazily** (solo cuando el operador selecciona "Entrada Externa"), solicitando permiso de acceso al micrófono al sistema operativo si es necesario.

---

### 5. Botón Principal de Conexión (`#btn-connect`)

| Estado del encoder | Texto del botón | Clase | Acción al pulsar |
|---|---|---|---|
| Desconectado | "📻 CONECTAR SERVIDOR" | `enc-btn` (azul) | Valida la configuración y envía `start-encoder` al backend |
| Conectando | "⏳ CANCELAR CONEXION..." | — | Envía `stop-encoder` + marca parada intencional |
| En vivo | "⏹ DESCONECTAR EMISIÓN" | `enc-btn stop` (rojo) | Envía `stop-encoder` + desactiva reconexión automática |

---

### 6. Reconexión Automática

El encoder intenta reconectarse automáticamente si la conexión se cae de forma inesperada (no por decisión del operador).

**Algoritmo de backoff exponencial:**
| Intento | Espera |
|---|---|
| 1 | 5 segundos |
| 2 | 10 segundos |
| 3 | 20 segundos |
| 4 | 40 segundos |
| 5+ | 60 segundos (máximo) |

- **Activado:** Cuando la conexión se establece exitosamente.
- **Desactivado:** Cuando el operador pulsa "Desconectar" manualmente.
- **Reiniciado:** Al reconectar exitosamente, el contador de intentos vuelve a 0.

---

### 7. Monitor de Salud del Encoder

Un intervalo de 5 segundos verifica si el motor FFmpeg dejó de reportar progreso mientras el encoder estaba en vivo:

| Condición | Acción |
|---|---|
| Último dato de throughput < 15 segundos | Normal — muestra "Stream estable. Último dato FFmpeg: HH:MM:SS" |
| Último dato de throughput ≥ 15 segundos | Muestra advertencia en naranja: "Aviso: FFmpeg no reporta progreso hace N s." |

---

## 📡 Mapa de Comunicación IPC

### Mensajes enviados al Backend (`ipcRenderer.send`)

| Canal | Cuándo | Datos |
|---|---|---|
| `start-encoder` | Al pulsar "Conectar" con validación exitosa | `{ serverType, type, ip, port, password, pass, mount, source, micId, mic, codec, bitrate, encoderProvider, tapPoint }` |
| `stop-encoder` | Al pulsar "Desconectar" o cancelar conexión | — |
| `encoder-tap-point-changed` | Al abrir la ventana (con el valor guardado) + al cambiar el selector en caliente | `{ tapPoint: 'postFx' | 'preFx' }` |

### Mensajes recibidos (`ipcRenderer.on`)

| Canal | Cuándo llega | Efecto en la UI |
|---|---|---|
| `encoder-status` | Cuando cambia el estado de la conexión | Actualiza badge, texto de estado, botón y temporizador. Inicia/detiene el timer. Programa reconexión si fue inesperada |
| `encoder-error` | Cuando ocurre un error en el encoder | Agrega una línea roja al log con el mensaje de error |
| `encoder-throughput` | Periódicamente mientras está en vivo | Actualiza la tarjeta de bitrate y el gráfico de throughput (si existe canvas) |
| `encoder-capture-health` | Periódicamente desde el monitor de captura | Actualiza la línea de salud: pausa entre bloques PCM (aviso naranja) o resumen minuto |
| `encoder-input-meter` | Frecuentemente mientras está en vivo | Actualiza la barra VU con Pico y RMS del audio capturado |
| `audio-engine-rust-event` | Frecuentemente desde el motor Rust (solo type=`status`) | Extrae los meters de los buses (master, pl1-4, jingle, cartwall) y actualiza la barra VU con throttle de 20ms |

---

## 🔄 Flujo Completo de Conexión

```
Operador pulsa "Conectar"
  → Validación local (IP, puerto, contraseña, mount si Icecast)
  → Si falla: log rojo + cambio a tab Configuración
  → Si ok: guardar prefs en encoder_prefs.json
             ipcRenderer.send('start-encoder', config)
             UI: "CONECTANDO..." / botón cambia a "CANCELAR"
  
Backend recibe 'start-encoder'
  → Inicia FFmpeg con la configuración
  → Emite 'encoder-status' → 'connecting' / 'live' / 'disconnected'
  → Emite 'encoder-throughput' cada segundo (bitrate, speed, ffmpegTime)
  → Emite 'encoder-input-meter' (peakDb, rmsDb, hasSignal)
  → Emite 'encoder-capture-health' (chunk-gap, minute)

UI recibe 'encoder-status' = 'live'
  → Badge verde pulsante
  → Timer inicia
  → Botón cambia a "DESCONECTAR"
  → Log: "Conectado correctamente."

Desconexión inesperada → scheduleReconnect() con backoff
Desconexión manual → intentionalStop = true, autoReconnect = false
```

---

## 🔮 Implicaciones para la v2.0 (Tauri/Rust)

| IPC / Función actual | Equivalente en Tauri/Rust |
|---|---|
| `start-encoder` (send) | Comando Tauri `start_encoder` → lanza proceso FFmpeg o encoder nativo Rust con `tokio::process` |
| `stop-encoder` (send) | Comando Tauri `stop_encoder` → señal SIGTERM al proceso FFmpeg |
| `encoder-tap-point-changed` (send) | Comando Tauri `set_encoder_tap_point` → actualiza atómico en el motor Rust sin reiniciar el encoder |
| `encoder-status` (on) | Evento Tauri `emit_to` 'encoder-status' → emitido desde Rust cuando el estado del proceso FFmpeg cambia |
| `encoder-error` (on) | Evento Tauri `emit_to` 'encoder-error' → stderr del proceso FFmpeg |
| `encoder-throughput` (on) | Evento Tauri `emit_to` 'encoder-throughput' → parseado del stderr FFmpeg (líneas `size=`, `bitrate=`) |
| `encoder-capture-health` (on) | Evento Tauri `emit_to` 'encoder-capture-health' → monitor de salud del ring buffer PCM en Rust |
| `encoder-input-meter` (on) | Evento Tauri `emit_to` 'encoder-input-meter' → medidor de nivel del bus de captura |
| `audio-engine-rust-event` (on) | Evento Tauri `emit_to` 'audio-engine-rust-event' → ya es Rust; mantener mismo esquema |
| Reconexión automática (setTimeout JS) | Se puede mantener en el frontend Tauri o mover la lógica de backoff al backend Rust |
| Lectura/escritura de `encoder_prefs.json` (fs directo) | Comandos Tauri `get_encoder_prefs` / `save_encoder_prefs` → acceso al sistema de archivos en el proceso Rust |
| Carga de micrófonos (`navigator.mediaDevices`) | Se mantiene en JS dentro del WebView; o bien, comando Tauri `get_audio_inputs` usando WASAPI/CoreAudio |
| Gráfico de throughput (Canvas 2D) | Se mantiene en JS/Canvas dentro del WebView (UI pura) |

---

## ⚠️ Notas Operativas Importantes

> [!IMPORTANT]
> El encoder opera **sin interrumpir el audio principal**. La conexión se establece en segundo plano mientras el motor Rust sigue enviando audio al aire. Conectar o desconectar el stream no genera silencio en la emisión.

> [!WARNING]
> El cambio de "Punto de escucha" (Pre-FX / Post-FX) se aplica en caliente sin reiniciar el encoder, pero el cambio tarda exactamente un chunk PCM (milisegundos) en propagarse al stream. Si se cambia durante una locución procesada por FX, los oyentes pueden escuchar un pequeño cambio de timbre.

> [!NOTE]
> La configuración guardada en `encoder_prefs.json` se carga automáticamente cada vez que se abre la ventana del encoder. El operador no necesita reconfigurar el servidor en cada sesión.

---
*Documentado mediante auditoría automática — LF Automatizador v1.0*
