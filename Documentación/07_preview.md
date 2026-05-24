# 07 — Preview de Audio (Escucha Previa)
*Módulo: `preview.html` + `preview.js` | Sin IPC handler dedicado — usa el canal genérico `audio-engine-rust-command`*

> **¿Qué es este módulo?**
> Es una ventana flotante y compacta que permite al operador de radio escuchar una pista de forma privada —sin interrumpir el aire— antes de decidir si ponerla al aire. La reproducción se enruta exclusivamente por el bus de pre-escucha (`cue`), que corresponde a los audífonos del operador, completamente separado del bus de transmisión.

---

## 🪟 La Ventana

| Propiedad | Valor |
|---|---|
| **Título** | Escucha previa |
| **Modo** | Flotante, pequeña (overlay minimalista) |
| **Icono** | 🎧 |
| **Comportamiento especial** | Se cierra automáticamente cuando la pista termina de reproducirse; también se cierra al presionar el botón Stop. Se abre desde el menú contextual (clic derecho) de cualquier pista en la playlist principal. |
| **Estado inicial** | Muestra "Cargando pista..." hasta recibir el IPC `load-preview-track` |

---

## 🧩 Elementos de la Interfaz

### 1. Encabezado / Información de Pista

#### Ícono de auriculares + Nombre de pista (`#preview-title`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Etiqueta de texto `#preview-title` acompañada del emoji 🎧 |
| ⚡ **Qué** | Muestra el nombre del archivo (basename) de la pista que está siendo pre-escuchada |
| ⏱️ **Cuándo** | Se actualiza en el momento en que `reproducir()` es invocado, antes incluso de que el audio comience a sonar |
| 📍 **Dónde** | En la zona superior del panel, visible mientras dura la escucha |
| 💡 **Por qué** | Confirma visualmente al operador qué pista está sonando en sus audífonos, evitando confusiones cuando tiene varias ventanas abiertas |

**Estados visuales:**
| Estado | Color del texto | Texto |
|---|---|---|
| Normal / Reproduciendo | Blanco (`#ffffff`) | Nombre del archivo |
| Error de reproducción | Rojo (`#e74c3c`) | "Error al reproducir este formato." |
| Cargando | Gris predeterminado | "Cargando pista..." |

---

### 2. Línea de Tiempo / Barra de Progreso

#### Tiempo actual (`#preview-current`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Etiqueta `#preview-current` en formato `mm:ss` |
| ⚡ **Qué** | Muestra el tiempo transcurrido de la reproducción en tiempo real |
| ⏱️ **Cuándo** | Se actualiza cada 100 ms mientras hay reproducción activa (mediante `setInterval`) |
| 📍 **Dónde** | Lado izquierdo de la barra de progreso |
| 💡 **Por qué** | Permite al operador saber cuánto ha escuchado de la pista sin necesidad de mirar el contador principal |

#### Barra de progreso clickeable (`#preview-progress-bg` / `#preview-progress-fill`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Contenedor `#preview-progress-bg` con relleno animado `#preview-progress-fill` |
| ⚡ **Qué** | Visualiza el avance de la pista; al hacer clic en cualquier punto, salta a esa posición de tiempo |
| ⏱️ **Cuándo** | El salto de posición solo funciona si la duración total ya fue obtenida del motor Rust (puede tardar unos segundos si el archivo no está en caché de peaks) |
| 📍 **Dónde** | El relleno se expande horizontalmente; el salto afecta inmediatamente el audio en el bus cue y reajusta el temporizador visual |
| 💡 **Por qué** | Permite al operador ir directamente a la sección de la pista que le interesa (ej: verificar el fade out, el inicio instrumental) sin escuchar todo desde el comienzo |

> **Nota:** El elemento HTML tiene el `title` "Haz clic para adelantar/atrasar", confirmando su uso como scrubber.

#### Tiempo total (`#preview-total`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Etiqueta `#preview-total` |
| ⚡ **Qué** | Muestra la duración total de la pista en formato `mm:ss` |
| ⏱️ **Cuándo** | Aparece como `--:--` inicialmente y se actualiza cuando el motor Rust responde a `getPeaks` con `durationMs`; usa caché en disco si el archivo ya fue analizado antes |
| 📍 **Dónde** | Lado derecho de la barra de progreso |
| 💡 **Por qué** | Referencia rápida para saber si la pista cabe en el tiempo disponible antes del próximo bloque de publicidad |

---

### 3. Controles

#### Botón Stop (`#btn-preview-stop`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón `#btn-preview-stop` con símbolo ⏹ |
| ⚡ **Qué** | Detiene inmediatamente la reproducción en el bus cue y cierra la ventana de preview |
| ⏱️ **Cuándo** | Siempre disponible mientras la ventana esté abierta |
| 📍 **Dónde** | Envía el comando `stop` al player `cue-player` vía motor Rust; luego ejecuta `window.close()` |
| 💡 **Por qué** | Cierre rápido y limpio; evitar que el audio de pre-escucha quede sonando si el operador ya tomó su decisión o si hay una emergencia en el aire |

**Comportamiento adicional al cerrar (evento `beforeunload`):**
Independientemente de cómo se cierre la ventana (botón Stop, Alt+F4, clic en X), se envía automáticamente el comando `stop` al motor Rust para garantizar que el bus cue quede silencioso.

---

## ⌨️ Atajos de Teclado

Este módulo **no tiene** atajos de teclado configurados explícitamente. El cierre puede hacerse con los atajos nativos del sistema operativo (Alt+F4, etc.).

---

## 📡 Mapa de Comunicación IPC

### Mensajes invocados (`ipcRenderer.invoke`)
| Canal | Cuándo | Retorna |
|---|---|---|
| `get-cache-dir` | Al arrancar la ventana | `{ success: true, cacheDir: string }` — ruta de la carpeta de caché de peaks en disco |
| `audio-engine-rust-command` (cmd: `stop`) | Antes de cargar nueva pista, al presionar Stop, y en `beforeunload` | — |
| `audio-engine-rust-command` (cmd: `loadAudio`) | Al iniciar reproducción de una pista, usando `bus: 'cue'` y `player: 'cue-player'` | — |
| `audio-engine-rust-command` (cmd: `play`) | Inmediatamente después de `loadAudio` | — |
| `audio-engine-rust-command` (cmd: `getPeaks`) | En paralelo tras iniciar la reproducción, para obtener la duración total | `{ type: 'peaks', durationMs: number }` |
| `audio-engine-rust-command` (cmd: `seek`) | Al hacer clic en la barra de progreso | — |

### Mensajes recibidos (`ipcRenderer.on`)
| Canal | Cuándo llega | Efecto en la UI |
|---|---|---|
| `load-preview-track` | Enviado por el proceso principal cuando el operador elige "Escucha previa" en el menú contextual | Inicia la función `reproducir(rutaArchivo)`: actualiza el título, resetea la barra, para cualquier audio previo y comienza la reproducción por el bus cue |

---

## 🔄 Flujo de Reproducción Completo

```
1. Operador hace clic derecho en una pista → "Escucha previa"
2. Backend abre esta ventana y envía `load-preview-track` con la ruta del archivo
3. preview.js recibe el evento → llama reproducir(rutaArchivo)
4. Se muestra el nombre del archivo en #preview-title (color blanco)
5. Se para cualquier audio previo (cmd: stop, cue-player)
6. Se carga y reproduce el audio en el bus cue (loadAudio → play)
7. En PARALELO: se solicita getPeaks para obtener durationMs
8. Cada 100ms: tickProgreso() actualiza #preview-current y la barra
9. Cuando getPeaks responde: #preview-total muestra la duración real
10. Al llegar al final: detener() + window.close() automático
```

---

## 🔮 Implicaciones para la v2.0 (Tauri/Rust)

| Elemento v1.0 (Electron/IPC) | Equivalente en Tauri/Rust |
|---|---|
| `ipcRenderer.invoke('audio-engine-rust-command', {cmd:'loadAudio', bus:'cue'})` | Comando Tauri directo al motor de audio: `audio_engine::load_cue(path, gain)` |
| `ipcRenderer.invoke('audio-engine-rust-command', {cmd:'play'})` | `audio_engine::play_cue()` |
| `ipcRenderer.invoke('audio-engine-rust-command', {cmd:'stop'})` | `audio_engine::stop_cue()` |
| `ipcRenderer.invoke('audio-engine-rust-command', {cmd:'seek', positionMs})` | `audio_engine::seek_cue(position_ms)` |
| `ipcRenderer.invoke('audio-engine-rust-command', {cmd:'getPeaks'})` | `audio_engine::get_peaks(path, bins, cache_dir)` — ya Rust nativo |
| `ipcRenderer.invoke('get-cache-dir')` | `tauri::path::app_cache_dir()` accesible directamente desde Rust |
| `ipcRenderer.on('load-preview-track')` | Evento Tauri: `tauri::event::emit_to("preview", "load-preview-track", payload)` |
| `window.addEventListener('beforeunload')` → stop | Hook `on_window_event(WindowEvent::CloseRequested)` → `audio_engine::stop_cue()` |
| `setInterval(tickProgreso, 100)` | El progreso puede alimentarse desde Rust vía evento periódico, o calcularse en frontend con `Date.now()` igual que ahora |

---
*Documentado mediante auditoría automática — LF Automatizador v1.0*
