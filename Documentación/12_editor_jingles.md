# 12 — Editor de Jingles (Pisadores / Cruce Multipista)
*Módulo: `jingle_editor.html` + `jingle_editor.js` | IPC: canales `audio-engine-rust-command`, `save-jingle-transition`, `get-cache-dir`*

> **¿Qué es este módulo?**
> Es un editor visual de audio multipista especializado en el "pisador": la técnica de radio en la que un jingle se superpone a los últimos segundos de una canción saliente, mientras la canción entrante espera su turno. El operador puede arrastrar visualmente el pisador y la pista entrante sobre una línea de tiempo con forma de onda para ajustar con precisión los puntos de mezcla. El audio se escucha en tiempo real por el bus de pre-escucha (audífonos) sin interrumpir el aire.

---

## 🪟 La Ventana

| Propiedad | Valor |
|---|---|
| **Título** | Editor de Músicas y Pisadores |
| **Modo** | Flotante independiente (ventana secundaria) |
| **Subtítulo de contexto** | "Cruce Multipista (Pisadores)" — aparece en el header superior |
| **Comportamiento especial** | Al abrir, muestra un overlay "Decodificando audios..." mientras el motor Rust analiza las 3 pistas. Si ya hay datos guardados de una edición previa, restaura los puntos de mezcla y encuadra la vista para que el solapamiento sea visible de inmediato. Si el motor falla, muestra el error en el propio overlay (en rojo) sin cerrar silenciosamente. |
| **Al cerrar** | Detiene automáticamente los 3 players Rust (jingle-editor-a, jingle-editor-j, jingle-editor-b) para evitar que el audio quede sonando |

---

## 🧩 Elementos de la Interfaz

### 1. Header Superior

#### Etiqueta de pistas (`#lbl-tracks`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Span `#lbl-tracks` |
| ⚡ **Qué** | Muestra el nombre de las pistas involucradas en formato: `NombreA ➡️ [PISADOR] ➡️ NombreB` |
| ⏱️ **Cuándo** | Se actualiza cuando el backend envía el evento `load-data` con los datos de las pistas |
| 📍 **Dónde** | Header superior de la ventana |
| 💡 **Por qué** | Confirma al operador qué transición está editando, especialmente útil si tiene múltiples ventanas abiertas |

---

### 2. Área de Edición Visual (Canvas Multipista)

El área central contiene 3 filas de canvas superpuestas que representan la línea de tiempo de audio. El eje temporal es común a las 3 filas: `tiempo = 0` representa el punto exacto donde termina la Pista A.

#### Canvas Pista A — Pista Saliente (`#canvas-a`, etiqueta: "1. Pista Saliente (Fija)")
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Canvas `#canvas-a` en la fila `#row-a` |
| ⚡ **Qué** | Muestra la forma de onda de la pista que está sonando en el aire (la que va a terminar). Es **fija**: no se puede arrastrar |
| ⏱️ **Cuándo** | Se renderiza una vez que el motor Rust entrega los peaks de la pista A. Color: azul (`#00a8ff`) |
| 📍 **Dónde** | Fila superior del área de edición |
| 💡 **Por qué** | Referencia visual del audio que está sonando; permite al operador ver cuándo baja el volumen (fade out) para sincronizar el pisador |

#### Canvas Pisador / Jingle (`#canvas-j`, etiqueta: "2. Pisador (Arrastra)")
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Canvas `#canvas-j` en la fila `#row-j` |
| ⚡ **Qué** | Forma de onda del jingle/pisador. **Se puede arrastrar horizontalmente** para definir en qué momento (respecto al final de la Pista A) comienza a sonar el pisador |
| ⏱️ **Cuándo** | Solo es arrastrable cuando el cursor está sobre la fila central (el tercio del medio del viewport). Color: naranja (`#f39c12`) |
| 📍 **Dónde** | Fila central del área de edición |
| 💡 **Por qué** | El pisador es la identidad sonora de la estación; su entrada precisa sobre los últimos segundos de la canción crea la transición característica de la radio |

#### Canvas Pista B — Pista Entrante (`#canvas-b`, etiqueta: "3. Pista Entrante (Arrastra)")
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Canvas `#canvas-b` en la fila `#row-b` |
| ⚡ **Qué** | Forma de onda de la siguiente canción. **Se puede arrastrar** para definir en qué momento empieza a sonar la pista entrante (relativo al comienzo del pisador) |
| ⏱️ **Cuándo** | Solo es arrastrable cuando el cursor está sobre la fila inferior (el tercio inferior del viewport). Color: verde (`#2ecc71`) |
| 📍 **Dónde** | Fila inferior del área de edición |
| 💡 **Por qué** | Permite que la pista entrante arranque exactamente cuando el pisador termina (o con un pequeño solapamiento), creando una transición musical fluida y profesional |

#### Cursor de reproducción / Playhead (`#play-cursor`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Línea vertical roja de 1px con marcador triangular ▼ en la parte superior |
| ⚡ **Qué** | Indica la posición actual de reproducción en la línea de tiempo. Avanza en tiempo real durante la reproducción |
| ⏱️ **Cuándo** | Visible siempre; animado durante la reproducción mediante `requestAnimationFrame` |
| 📍 **Dónde** | Se extiende verticalmente a través de las 3 filas de canvas |
| 💡 **Por qué** | Permite al operador ver simultáneamente qué parte de cada pista está sonando en ese momento |

**Interacción de clic para saltar posición:**
- Un clic simple (sin arrastrar) en cualquier punto del área de canvas mueve el playhead a esa posición temporal.
- Si la reproducción estaba activa, se hace stop y play instantáneo desde la nueva posición.

**Auto-scroll durante reproducción:**
Cuando el cursor playhead supera el 80% del ancho del viewport, la vista se desplaza automáticamente medio viewport hacia adelante, manteniendo el playhead siempre visible.

---

### 3. Barra de Scroll / Navegación Temporal

#### Slider de desplazamiento (`#view-scroll`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<input type="range">` con rango -60 a +60 segundos |
| ⚡ **Qué** | Desplaza horizontalmente la vista de la línea de tiempo sin cambiar el zoom |
| ⏱️ **Cuándo** | Siempre disponible; también se actualiza automáticamente durante el auto-scroll de reproducción |
| 📍 **Dónde** | Barra entre el área de canvas y el footer |
| 💡 **Por qué** | Permite navegar a partes de la pista que están fuera del viewport actual (ej: ver el inicio o el final completo de la pista A) |

---

### 4. Footer — Información y Controles

#### Indicador de posición del Pisador (`#lbl-mix-a`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Etiqueta `#lbl-mix-a` en el footer izquierdo |
| ⚡ **Qué** | Muestra el valor numérico exacto en segundos del punto donde empieza el pisador, relativo al final de la Pista A (valor negativo = antes del fin) |
| ⏱️ **Cuándo** | Se actualiza en tiempo real mientras se arrastra el canvas del pisador |
| 📍 **Dónde** | Footer inferior, sección izquierda |
| 💡 **Por qué** | Dato de precisión: el operador puede establecer, por ejemplo, "-8.50 s" para que el pisador entre 8.5 segundos antes del final |

#### Indicador de posición de la Pista B (`#lbl-mix-b`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Etiqueta `#lbl-mix-b` en el footer izquierdo |
| ⚡ **Qué** | Muestra el offset en segundos de la Pista B respecto al inicio del pisador |
| ⏱️ **Cuándo** | Se actualiza en tiempo real mientras se arrastra el canvas de la Pista B |
| 📍 **Dónde** | Footer inferior, junto a `#lbl-mix-a` |
| 💡 **Por qué** | Confirma el solapamiento entre el final del pisador y el inicio de la siguiente canción |

#### Botón Play/Pause (`#btn-play-pause`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón `#btn-play-pause` con icono ▶ / ⏸ |
| ⚡ **Qué** | Inicia o detiene la reproducción simultánea de las 3 pistas en el bus de pre-escucha |
| ⏱️ **Cuándo** | Solo funciona si las 3 pistas están cargadas (bufferA, bufferJ, bufferB disponibles). También responde al atajo `Espacio` |
| 📍 **Dónde** | Footer inferior, sección central. La reproducción sale por el bus `cue` (audífonos del operador) |
| 💡 **Por qué** | Permite al operador escuchar exactamente cómo sonará la transición antes de guardarla; fundamental para ajustar los tiempos con oído crítico |

**Comportamiento de reproducción inteligente por pista:**
| Situación | Comportamiento |
|---|---|
| Cursor antes de que empiece una pista | Esa pista arranca con delay automático (setTimeout) para sincronizarse en el momento correcto |
| Cursor dentro del rango de una pista | Arranca inmediatamente con seek a la posición exacta |
| Cursor después del final de una pista | Esa pista no se reproduce |

**Drag en caliente ("Hot Drag"):**
Si se arrastra el pisador o la Pista B mientras se está reproduciendo, el motor Rust recibe un seek inmediato sin microcortes para reflejar el nuevo punto de mezcla en tiempo real.

#### Control de Zoom (`#zoom-slider`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<input type="range">` rango 10-150 px/seg, con hint "(Ctrl + Rueda)" |
| ⚡ **Qué** | Ajusta la escala horizontal de la forma de onda: más zoom = más detalle por segundo |
| ⏱️ **Cuándo** | El slider centra el zoom en la posición del playhead; `Ctrl+Rueda` centra el zoom en la posición del mouse |
| 📍 **Dónde** | Footer inferior, sección derecha |
| 💡 **Por qué** | Para ajustes de precisión de milisegundos (ej: alinear el beat del pisador) se necesita máximo zoom; para ver el contexto general de la transición, zoom reducido |

**Zoom con rueda del mouse:**
`Ctrl + Rueda` sobre el área de canvas aplica zoom centrado exactamente en el punto temporal bajo el cursor del mouse (10 px/seg por paso).

#### Botón Cancelar (`#btn-cancel`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón `#btn-cancel` (gris oscuro) |
| ⚡ **Qué** | Detiene todos los players Rust y cierra la ventana sin guardar ningún cambio |
| ⏱️ **Cuándo** | Siempre disponible |
| 📍 **Dónde** | Footer inferior, sección derecha |
| 💡 **Por qué** | Salida de emergencia para el operador que abrió el editor por error o que decidió no modificar la transición |

#### Botón Aplicar y Guardar (`#btn-save`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón `#btn-save` (verde, con icono 💾) |
| ⚡ **Qué** | Detiene los players Rust, calcula los puntos de mezcla finales y los envía al backend para persistirlos en la base de datos |
| ⏱️ **Cuándo** | Solo tiene efecto si las 3 pistas están cargadas. Requiere que `bufferA` esté disponible para calcular el offset relativo correcto |
| 📍 **Dónde** | Footer inferior, extremo derecho |
| 💡 **Por qué** | Persiste la decisión editorial del operador: la próxima vez que el automatizador reproduzca esta transición, usará exactamente estos puntos de mezcla |

**Datos enviados al guardar:**
```json
{
  "trackA": "/ruta/cancion_saliente.mp3",
  "jingle": "/ruta/pisador.mp3",
  "mixPointA": "248.500",    // segundos desde el inicio de TrackA donde entra el pisador
  "mixPointJ": "15.200"      // duración del pisador activo (cuándo empieza TrackB)
}
```

---

## ⌨️ Atajos de Teclado

| Tecla | Acción |
|---|---|
| `Espacio` | Alterna Play/Pause de las 3 pistas simultáneamente |
| `Ctrl + Rueda` | Zoom centrado en la posición del cursor del mouse |
| `Shift + Rueda` | También activa el zoom (mismo comportamiento que Ctrl) |

---

## 🖱️ Interacciones de Arrastrar (Drag)

| Elemento | Zona de detección | Efecto |
|---|---|---|
| Pisador (Jingle) | Tercio central del viewport (entre 33% y 66% de altura) | Mueve horizontalmente el punto de inicio del pisador (`mixPointA`) |
| Pista Entrante (B) | Tercio inferior del viewport (>66% de altura) | Mueve horizontalmente el punto de inicio de la pista B (`mixPointB_Abs`) |
| Clic sin arrastrar (<3px de desplazamiento) | Cualquier zona del viewport | Mueve el playhead a esa posición temporal; si estaba reproduciendo, hace stop+play desde ahí |

**Cancelación de drag:**
- Si el cursor sale del área del viewport (`mouseleave`): el drag se cancela
- Si la ventana pierde el foco (`blur`): el drag se cancela
- En ambos casos, el estado visual se restaura correctamente

---

## 📡 Mapa de Comunicación IPC

### Mensajes invocados (`ipcRenderer.invoke`)
| Canal | Cuándo | Retorna |
|---|---|---|
| `get-cache-dir` | Al arrancar el editor | `{ success, cacheDir }` |
| `audio-engine-rust-command` (cmd: `getPeaks`) | Al recibir `load-data`, para las 3 pistas en paralelo (4096 bins) | `{ success, message: { durationMs, min[], max[], bins } }` |
| `audio-engine-rust-command` (cmd: `loadAudio`, bus: `cue`) | Al iniciar reproducción de cada una de las 3 pistas | — |
| `audio-engine-rust-command` (cmd: `seek`) | Al saltar posición (clic en canvas) o drag en caliente | — |
| `audio-engine-rust-command` (cmd: `play`) | Después de loadAudio o seek, si la sesión sigue activa | — |
| `audio-engine-rust-command` (cmd: `stop`) | Al pausar, cancelar, guardar o cerrar ventana | — |

### Mensajes enviados al Backend (`ipcRenderer.send`)
| Canal | Cuándo | Datos |
|---|---|---|
| `save-jingle-transition` | Al presionar "Aplicar y Guardar" | `{ trackA, jingle, mixPointA (segundos), mixPointJ (segundos) }` |

### Mensajes recibidos (`ipcRenderer.on`)
| Canal | Cuándo llega | Efecto en la UI |
|---|---|---|
| `load-data` | Al abrir el editor (backend envía los datos de las pistas) | Carga las 3 formas de onda, restaura puntos de mezcla previos, oculta overlay de carga |

---

## 🔮 Implicaciones para la v2.0 (Tauri/Rust)

| Elemento v1.0 | Equivalente Tauri/Rust |
|---|---|
| `ipcRenderer.invoke('audio-engine-rust-command', {cmd:'getPeaks', bins:4096})` | `tauri::command audio_engine::get_peaks(path, bins, cache_dir)` — 3 llamadas en paralelo |
| `ipcRenderer.invoke('audio-engine-rust-command', {cmd:'loadAudio', bus:'cue'})` | `audio_engine::load_cue(player_id, path, gain)` con IDs `jingle-editor-a/j/b` |
| `ipcRenderer.invoke('audio-engine-rust-command', {cmd:'seek'})` | `audio_engine::seek_player(player_id, position_ms)` |
| `ipcRenderer.invoke('audio-engine-rust-command', {cmd:'stop'})` | `audio_engine::stop_player(player_id)` |
| `ipcRenderer.send('save-jingle-transition', {...})` | `tauri::command save_jingle_transition(track_a, jingle, mix_point_a, mix_point_j)` |
| `ipcRenderer.on('load-data')` | Evento Tauri emitido al abrir la ventana del editor: `emit_to("jingle-editor", "load-data", payload)` |
| Canvas 2D para forma de onda | Mantener canvas HTML/JS en la WebView de Tauri (misma lógica, mismo rendimiento) |
| `requestAnimationFrame` para el playhead | Igual en WebView Tauri; o timer Rust con `emit` cada ~16ms |
| `setTimeout` para arranques diferidos de pistas | Puede mantenerse en JS o pasar a `tokio::time::sleep` en Rust |

---
*Documentado mediante auditoría automática — LF Automatizador v1.0*
