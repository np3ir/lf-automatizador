# 13 — Editor de Transiciones Musicales (Crossfade)
*Módulo: `transition_editor.html` + `transition_editor.js` | IPC: `audio-engine-rust-command`, `save-transition`, `get-cache-dir`*

> **¿Qué es este módulo?**
> Es un editor visual de audio de dos pistas para ajustar el punto exacto de crossfade entre dos canciones consecutivas: cuántos segundos antes del final de la Pista A debe comenzar a sonar la Pista B. El operador arrastra visualmente la pista entrante sobre la forma de onda de la pista saliente, escucha el resultado en tiempo real por el bus de pre-escucha (audífonos), y guarda el punto de mezcla para que el automatizador lo respete durante la emisión.

---

## 🪟 La Ventana

| Propiedad | Valor |
|---|---|
| **Título** | Editor de Transición Musical |
| **Modo** | Flotante independiente (ventana secundaria) |
| **Subtítulo de contexto** | "Transición Musical (Crossfade)" — aparece en el header |
| **Color de acento** | Azul (`#00a8ff`) — diferencia visualmente este editor del de Jingles (naranja) |
| **Comportamiento especial** | Al abrir, muestra overlay "Decodificando audio..." mientras el motor Rust analiza las 2 pistas. Si ya existe un punto de mezcla guardado, lo restaura y encuadra la vista para que el solapamiento sea visible de inmediato. |
| **Al cerrar** | Detiene automáticamente los 2 players Rust (`trans-editor-a`, `trans-editor-b`) vía `beforeunload` |

---

## 🧩 Elementos de la Interfaz

### 1. Header Superior

#### Etiqueta de pistas (`#lbl-tracks`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Span `#lbl-tracks` |
| ⚡ **Qué** | Muestra los nombres de las dos pistas en formato: `NombreA  ➡️  NombreB` |
| ⏱️ **Cuándo** | Se actualiza al recibir el evento `load-data` con los datos de la transición |
| 📍 **Dónde** | Header superior de la ventana |
| 💡 **Por qué** | Orienta al operador sobre qué par de canciones está ajustando, evitando confusiones en sesiones con múltiples transiciones abiertas |

---

### 2. Área de Edición Visual (Canvas Bitracks)

El área central contiene 2 filas de canvas. El eje temporal usa `tiempo = 0` como el punto donde termina la Pista A. Los valores negativos representan tiempo antes del fin de la Pista A.

#### Canvas Pista A — Pista Saliente (`#canvas-a`, etiqueta: "1. Pista Saliente (Fija)")
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Canvas `#canvas-a` en la fila `#row-a` |
| ⚡ **Qué** | Muestra la forma de onda de la canción que está terminando. Es **fija**: no se puede arrastrar. Incluye una línea vertical roja semitransparente en `tiempo = 0` marcando el punto exacto de fin de la pista |
| ⏱️ **Cuándo** | Se renderiza una vez obtenidos los peaks del motor Rust. Color: azul (`#00a8ff`) |
| 📍 **Dónde** | Fila superior del área de edición |
| 💡 **Por qué** | La referencia visual del audio que termina; permite ver el fade out natural y decidir cuánto antes debe entrar la siguiente canción |

**Marcador de fin de pista:**
Una línea vertical roja semitransparente en la posición `tiempo = 0` señala exactamente el momento donde termina la Pista A. Es una referencia fija crítica para calibrar el solapamiento.

#### Canvas Pista B — Pista Entrante (`#canvas-b`, etiqueta: "2. Pista Entrante (Arrastra)")
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Canvas `#canvas-b` en la fila `#row-b` |
| ⚡ **Qué** | Muestra la forma de onda de la canción que va a entrar. **Se puede arrastrar horizontalmente** para definir cuántos segundos antes del fin de la Pista A comienza la Pista B |
| ⏱️ **Cuándo** | Solo arrastrable cuando el cursor está en la mitad inferior del viewport (por debajo del 50% de altura). Tiene un límite: no puede colocarse más de 5 segundos después del fin de la Pista A (`mixPointA > 5` se trunca) |
| 📍 **Dónde** | Fila inferior del área de edición. Color: verde (`#2ecc71`) |
| 💡 **Por qué** | El crossfade perfecto logra que la transición entre canciones sea imperceptible o musicalmente intencional; ajustarlo visualmente y auditivamente garantiza una escucha profesional |

#### Cursor de reproducción / Playhead (`#play-cursor`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Línea vertical roja de 1px con marcador triangular ▼ (`::before`) |
| ⚡ **Qué** | Muestra la posición temporal actual durante la reproducción |
| ⏱️ **Cuándo** | Animado mediante `requestAnimationFrame` durante la reproducción. Auto-scroll cuando supera el 80% del viewport |
| 📍 **Dónde** | Se extiende sobre las 2 filas de canvas simultáneamente |
| 💡 **Por qué** | Referencia auditiva-visual sincronizada: el operador sabe exactamente qué sección del audio está escuchando |

**Interacción de clic:**
Un clic en el viewport (sin arrastrar, desplazamiento < 3px) mueve el playhead a esa posición. Si estaba reproduciendo, hace stop+play desde la nueva posición.

**Auto-scroll:**
Cuando el playhead supera el 80% del ancho de pantalla, la vista avanza automáticamente medio viewport manteniendo el playhead visible.

---

### 3. Barra de Scroll / Navegación Temporal

#### Slider de desplazamiento (`#view-scroll`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<input type="range">` con rango -60 a +60 segundos |
| ⚡ **Qué** | Navega horizontalmente por la línea de tiempo sin cambiar el zoom |
| ⏱️ **Cuándo** | Siempre disponible; se actualiza automáticamente durante el auto-scroll |
| 📍 **Dónde** | Separador entre el área de canvas y el footer |
| 💡 **Por qué** | Permite ver el contexto completo de las pistas cuando son largas |

---

### 4. Footer — Información y Controles

#### Indicador de solapamiento (`#lbl-overlap`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Etiqueta `#lbl-overlap` en el footer izquierdo |
| ⚡ **Qué** | Muestra el valor numérico exacto del solapamiento en segundos (siempre positivo, es `Math.abs(mixPointA)`) |
| ⏱️ **Cuándo** | Se actualiza en tiempo real al arrastrar la Pista B |
| 📍 **Dónde** | Footer inferior, etiquetado como "Solapamiento (Overlap):" |
| 💡 **Por qué** | El dato clave de la transición: "esta canción entra 5.30 segundos antes de que termine la anterior". Permite replicar tiempos estándar de la emisora |

#### Botón Play/Pause (`#btn-play-pause`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón `#btn-play-pause` con icono ▶ / ⏸ |
| ⚡ **Qué** | Inicia o detiene la reproducción sincronizada de las 2 pistas en el bus de pre-escucha |
| ⏱️ **Cuándo** | Solo funciona si ambas pistas están cargadas. También responde al atajo `Espacio` |
| 📍 **Dónde** | Footer inferior, sección central |
| 💡 **Por qué** | La pre-escucha de la transición completa antes de guardar es fundamental: permite detectar problemas de tempo, tonalidad o nivel de volumen |

**Comportamiento por pista:**
| Situación | Comportamiento |
|---|---|
| Cursor antes del inicio de Pista B | Pista B espera con setTimeout; Pista A reproduce desde su posición |
| Cursor en zona de solapamiento | Ambas pistas suenan simultáneamente |
| Cursor solo dentro de Pista B | Solo suena Pista B |
| Cursor antes del inicio de Pista A | Solo Pista A (no hay solapamiento visible) |

**Drag en caliente:**
Si se arrastra la Pista B mientras se está reproduciendo, el motor Rust recibe un seek inmediato sin interrupción audible. Los timeouts de arranque diferido se gestionan con un sistema de "un solo timer activo por player" que evita que arrastres repetidos acumulen arranques fantasma.

#### Control de Zoom (`#zoom-slider`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<input type="range">` rango 10-150 px/seg, con hint "(Ctrl + Rueda)" |
| ⚡ **Qué** | Ajusta la escala horizontal de visualización |
| ⏱️ **Cuándo** | El slider centra el zoom en el playhead; `Ctrl+Rueda` centra el zoom en el mouse |
| 📍 **Dónde** | Footer inferior, sección derecha |
| 💡 **Por qué** | Vista panorámica (zoom bajo) para ver el contexto general; vista de detalle (zoom alto) para ajustes de precisión al inicio de cada pista |

#### Botón Cancelar (`#btn-cancel`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón `#btn-cancel` (gris oscuro) |
| ⚡ **Qué** | Para los 2 players Rust y cierra la ventana sin guardar |
| ⏱️ **Cuándo** | Siempre disponible |
| 📍 **Dónde** | Footer inferior derecho |
| 💡 **Por qué** | Permite al operador descartar la edición actual si no está satisfecho |

#### Botón Aplicar y Guardar (`#btn-save`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón `#btn-save` (verde, con icono 💾) |
| ⚡ **Qué** | Para los players Rust, calcula el punto de mezcla absoluto y lo envía al backend |
| ⏱️ **Cuándo** | Requiere que `bufferA` y `bufferB` estén cargados |
| 📍 **Dónde** | Footer inferior derecho |
| 💡 **Por qué** | Persiste la decisión del operador; el automatizador usará este punto de mezcla exacto en cada reproducción futura de esta transición |

**Datos enviados al guardar:**
```json
{
  "trackA": "/ruta/cancion_saliente.mp3",
  "mixPoint": "243.700"  // segundos desde el inicio de TrackA donde comienza TrackB
}
```
El valor `mixPoint` se calcula como `bufferA.duration + mixPointA` donde `mixPointA` es negativo (representa cuántos segundos antes del fin de A entra B).

---

## ⌨️ Atajos de Teclado

| Tecla | Acción |
|---|---|
| `Espacio` | Alterna Play/Pause de las 2 pistas |
| `Ctrl + Rueda` | Zoom centrado en la posición del cursor del mouse |
| `Shift + Rueda` | También activa zoom (mismo comportamiento que Ctrl) |

---

## 🖱️ Interacciones de Arrastrar (Drag)

| Elemento | Zona de detección | Efecto | Límite |
|---|---|---|---|
| Pista B (Entrante) | Mitad inferior del viewport (>50% de altura) | Mueve `mixPointA` horizontalmente | No puede ir más de 5s después del fin de Pista A |
| Clic sin drag (<3px) | Cualquier zona | Mueve el playhead; si reproduciendo: stop+play | — |

**Eventos de cancelación de drag:**
- `mouseleave` en el viewport: cancela drag
- `blur` de ventana: cancela drag y resetea todos los flags de estado

---

## 📡 Mapa de Comunicación IPC

### Mensajes invocados (`ipcRenderer.invoke`)
| Canal | Cuándo | Retorna |
|---|---|---|
| `get-cache-dir` | Al arrancar el editor | `{ success, cacheDir }` |
| `audio-engine-rust-command` (cmd: `getPeaks`) | Al recibir `load-data`, para las 2 pistas en paralelo (4096 bins) | `{ success, message: { durationMs, min[], max[], bins } }` |
| `audio-engine-rust-command` (cmd: `loadAudio`, bus: `cue`) | Al iniciar reproducción (player: `trans-editor-a` o `trans-editor-b`) | — |
| `audio-engine-rust-command` (cmd: `seek`) | Al saltar posición (clic) o drag en caliente | — |
| `audio-engine-rust-command` (cmd: `play`) | Después de loadAudio o seek, si sesión sigue activa | — |
| `audio-engine-rust-command` (cmd: `stop`) | Al pausar, cancelar, guardar, o `beforeunload` | — |

### Mensajes enviados al Backend (`ipcRenderer.send`)
| Canal | Cuándo | Datos |
|---|---|---|
| `save-transition` | Al presionar "Aplicar y Guardar" | `{ trackA: string, mixPoint: string }` |

### Mensajes recibidos (`ipcRenderer.on`)
| Canal | Cuándo llega | Efecto en la UI |
|---|---|---|
| `load-data` | Al abrir el editor | Carga ambas formas de onda, restaura `mixPoint` previo si existe, oculta overlay |

---

## 🔄 Diferencias clave respecto al Editor de Jingles (Módulo 12)

| Aspecto | Editor de Transiciones (este módulo) | Editor de Jingles (Módulo 12) |
|---|---|---|
| Pistas | 2 (A y B) | 3 (A, Jingle/J, B) |
| Parámetros guardados | 1 (`mixPoint`) | 2 (`mixPointA`, `mixPointJ`) |
| Players Rust | `trans-editor-a`, `trans-editor-b` | `jingle-editor-a`, `jingle-editor-j`, `jingle-editor-b` |
| Canal IPC de guardado | `save-transition` | `save-jingle-transition` |
| Color de acento | Azul (`#00a8ff`) | Naranja (`#f39c12`) |
| Complejidad técnica | Media | Alta (3 pistas sincronizadas con delays) |

---

## 🔮 Implicaciones para la v2.0 (Tauri/Rust)

| Elemento v1.0 | Equivalente Tauri/Rust |
|---|---|
| `ipcRenderer.invoke('audio-engine-rust-command', {cmd:'getPeaks', bins:4096})` | `tauri::command audio_engine::get_peaks(path, bins, cache_dir)` — 2 llamadas en paralelo |
| `ipcRenderer.invoke('audio-engine-rust-command', {cmd:'loadAudio', bus:'cue'})` | `audio_engine::load_cue(player_id, path, gain)` |
| `ipcRenderer.invoke('audio-engine-rust-command', {cmd:'seek'})` | `audio_engine::seek_player(player_id, position_ms)` |
| `ipcRenderer.invoke('audio-engine-rust-command', {cmd:'stop'})` | `audio_engine::stop_player(player_id)` |
| `ipcRenderer.send('save-transition', {trackA, mixPoint})` | `tauri::command save_transition(track_a: String, mix_point: f64)` |
| `ipcRenderer.on('load-data')` | Evento Tauri: `emit_to("transition-editor", "load-data", payload)` |
| `setTimeout` para Pista B diferida | Puede mantenerse en JS o reemplazarse con `tokio::time::sleep` en Rust |
| Canvas 2D HTML | Mantener en WebView de Tauri (sin cambios) |
| `requestAnimationFrame` animLoop | Mantener en JS o reemplazar con evento Rust cada ~16ms |

---
*Documentado mediante auditoría automática — LF Automatizador v1.0*
