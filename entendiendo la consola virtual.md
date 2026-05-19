# Auditoría Profesional: Arquitectura de la Consola Virtual (Web Audio API vs Rust)

Este documento describe el "ciclo de vida" del audio dentro del LF Automatizador, desde que se selecciona un archivo hasta que llega a los altavoces o al encoder. Para entender su funcionamiento, utilizaremos la analogía de una **Consola de Audio Física Profesional**.

---

## 1. Canales de Entrada y Buses de Agrupación 🎚️

Al igual que en una consola física, el audio entra por "canales" que se agrupan en **Buses de Mezcla** antes de llegar al procesamiento final.

*   **Buses de Playlist (PL 1 a 4):** Cuatro buses dedicados que reciben la señal de los reproductores principales (Decks A y B).
*   **Bus de Pisadores (Overlays):** Un bus independiente para jingles y locuciones horarias. Este bus tiene prioridad sobre la música (Ducking).
*   **Bus de Botonera (Cartwall):** Un bus flexible para efectos instantáneos, disparos de cartuchera y sonidos cortos.

> [!IMPORTANT]
> **Consistencia de la Señal:** Todos estos buses convergen en un punto de suma común antes de entrar a la cadena de efectos.

## 2. El Bus de Procesamiento (FX Bus) 🎛️

En nuestra consola virtual, los efectos (EQ, AGC, Limitador) no son "adornos", sino una etapa de inserción obligatoria en el flujo de señal.

*   **Procesamiento Siempre Activo:** Los procesadores de dinámica y ecualización están siempre "encendidos" y procesando señal, incluso si el usuario decide no escucharlos en el monitor. Esto garantiza que al hacer un cambio (de con efectos a sin efectos), no existan cortes, clics o baches auditivos.
*   **Transiciones Transparentes:** Al ser una cadena de procesamiento constante, el audio fluye sin interrupciones independientemente de los cambios de parámetros o de presets.

## 3. Puntos de Derivación (Tap Points) y Salidas 🔌

Aquí es donde la consola virtual emula la flexibilidad del hardware. El sistema utiliza una arquitectura de **"Tomas en Y"** para alimentar diferentes salidas sin afectarse entre sí.

### A. Salida Master (PGM)
Es la salida principal que va hacia los altavoces locales. 
*   **Ubicación:** Toma la señal **Post-FX**.
*   **Aislamiento:** Tiene su propio control de volumen final. Cambiar el volumen del Master **no afecta** al nivel del Encoder ni del Monitor.

### B. Salida de Monitoreo (Booth/Monitor)
Salida independiente para el operador.
*   **Flexibilidad:** Permite escuchar la señal **Pre-FX** (audio puro) o **Post-FX** (procesado) mediante un conmutador virtual.
*   **Independencia:** Su volumen y ruteo físico son totalmente ajenos a lo que sucede en el Master.

### C. Salida del Encoder (Webcast)
Es la señal que se envía al servidor de streaming (Icecast/Shoutcast).
*   **El Concepto de Oyente:** El Encoder no es un reproductor; es un **Sink (Sumidero)**. Simplemente "escucha" lo que sucede en el bus que tiene asignado (Pre o Post FX). 
*   **Aislamiento Total:** El Encoder toma su señal antes del fader del Master. Esto evita que si el operador baja el volumen de sus parlantes, la radio se quede en silencio en internet.

### D. Bus de Pre-escucha (CUE) 🎧
Un bus de monitoreo privado totalmente aislado del flujo de aire (PGM). A este bus se conectan:
*   El reproductor de escucha previa de la biblioteca.
*   El Editor de Pistas Avanzado.
*   Los editores multipista (2 y 3 pistas).
Esto permite realizar tareas de edición y auditoría mientras la emisora sigue al aire sin contaminación sonora.

---

## 4. Comparativa para el Motor Rust: El Modelo "Oyente" 🛡️

Para que la integración de Rust sea exitosa, debe abandonar cualquier lógica de "reproducción propia" para el encoder y adoptar el modelo de **Matriz de Conmutación**:

1.  **No más reproductores independientes:** El problema detectado donde el Encoder no suena igual que los parlantes se debe a que el Encoder está intentando "reconstruir" la mezcla en lugar de simplemente capturar la suma de los buses existentes.
2.  **Sincronización Sample-Accurate:** Rust debe recibir el flujo de datos exacto de los buses PL1-4, Jingles y Cartwall, sumarlos en el dominio PCM y entregar esa copia exacta al Encoder.
3.  **El Switch "Pre/Post":** Rust debe permitir que el punto de captura para el Encoder se mueva antes o después del bloque de DSP (FX) de manera instantánea y fluida.

---

### Estado de la Auditoría: Flujo de Señal *(actualizado mayo 2026 contra disco real)*

| Componente | Estado en Web Audio | Estado en Rust | Objetivo de Diseño |
| :--- | :--- | :--- | :--- |
| **Buses de Mezcla** | ✅ Físico-Virtuales | 🔄 Por player individual — falta sub-mixer común | Suma PCM de baja latencia con `rodio::mixer::Mixer` |
| **FX Chain** | ⚠️ Grafo armado pero inerte en modo Rust | ✅ `DynamicDspSource` — EQ-meta (PreAmp/Pan/Mono/8 bandas), Comp, Limiter en cadena real. Orden (EQ→Comp→Limiter) reordenable en tiempo real via `fx_order` AtomicU32. Wet/dry con rampa sin clic. | Sub-mixer + Pre-amp/Pan/Mono/Limiter/EQ8/Comp nativos en rodio |
| **Fader MASTER** | ✅ Aislado | 🟡 `FaderSource` único implementado entre `program_mixer` y sink PGM (`effective_gain_for` eliminado). El handler `masterGain` escribe en atómico. Sin embargo el slider UI no produce cambio audible — pendiente auditar el path IPC→atómico→FaderSource. | Fader único sobre el bus de programa, no por player |
| **Salida Master** | ✅ Post-FX | 🔄 En Espejo | Salida física con fader aislado |
| **Salida Monitor** | ✅ Pre/Post Seleccionable | ⚠️ Por Implementar — `monitor_gain` se almacena pero no rutea | Escucha independiente con sink dedicado |
| **Salida Encoder** | ⚠️ Captura de Renderer | 🟢 Rust PCM Bridge activo. Pre/Post FX conmuta vía `encoder_tap_mode` atómico — bug del `sourceMode` vacío corregido (mayo 2026). | Tap pre/post FX en el sub-mixer con conmutación en caliente |
| **Bus de CUE** | ✅ Aislado | ✅ Aislado en Rust — 6 players de editores + preview enrutados a `cue` por `default_bus_for_player()` | Bus privado para edición — INTOCABLE en la migración FX |
| **Telemetría WebAudio → Consola** | ⚠️ Sigue retransmitiéndose (`vu-levels`/`aux-vu-levels` no filtran) | ❌ Bloqueo no implementado en `backend/ipc/ui.js` | Descarte de amplitud + log de rechazos throttled por origen |
| **Reloj de Transporte** | ⚠️ El `<audio>` HTML aún se consulta para AIRE/Pause/Fade-out | 🔄 Reloj parcial — falta unificar todas las funciones a un único `getRustClock()` | Rust es la única fuente de verdad de posición/estado |
| **Infraestructura Shadow** | — | ⚠️ Sigue viva en `render.js` aunque Mensaje 2 Fase 4 la declaró eliminada | Eliminar envolviendo en `WEBAUDIO_DISABLED_BEGIN/END` |

---

### Notas de auditoría sobre los estados anteriores

* **FX Chain bajo Rust** estaba marcado como "🧪 Beta (Adapters)" y luego "❌ Placebo". Ambos estados están superados: la cadena DSP real está implementada y activa. La arquitectura actual usa `DynamicDspSource`, un Source único que reemplazó la cascada fija de 6 adapters. Internamente contiene tres bloques (EQ-meta, Comp, Limiter) y los procesa en el orden dictado por `fx_order` (AtomicU32). El orden es reordenable en tiempo real sin reconstruir el grafo — los botones 🔼🔽 y el drag&drop de la UI lo propagan al motor vía IPC.
* **Bus de CUE bajo Rust** estaba como "❌ Pendiente". La auditoría de disco confirma que los 6 players de los editores avanzados (`audio-editor`, `jingle-editor-a/j/b`, `trans-editor-a/b`) y el `cue-player` de la ventana de pre-escucha **ya están enrutados al bus `cue`** por `default_bus_for_player()` en el motor. El CUE permanece **intocable** durante toda la migración FX — saldrá por su tarjeta propia sin pasar por master, encoder, monitor ni efectos.
* **Telemetría Web Audio** estaba implícitamente declarada como "bloqueada en la capa IPC" en el Mensaje 4. La auditoría muestra que `backend/ipc/ui.js:161-174` sigue retransmitiendo niveles tal como vienen. Trabajo pendiente.

---
**Nota de Diseño:** Una consola virtual no debe ser solo una representación visual, sino un motor de ruteo determinista. El Encoder y el Monitor deben ser tratados como dispositivos que se "enchufan" a diferentes puntos de la cadena de audio ya existente. El frontend (Electron) es un **humilde control remoto**: no procesa audio, no calcula tiempos, no lee la hora. Sólo envía comandos al motor Rust y dibuja la respuesta.
