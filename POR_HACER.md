# LF Automatizador v0.9.0 - Roadmap y Tareas Pendientes (TODO)

Este documento es nuestra hoja de ruta compartida. Aquí mantendremos un registro de todas las ideas, mejoras y correcciones pendientes para no olvidar nada mientras avanzamos en el desarrollo de la aplicación.

**Leyenda de Estados:**
- [ ] Pendiente
- [~] En Progreso
- [x] Completado / Listo

---

## PRIORIDAD MAXIMA - Plan Maestro de Saneamiento Arquitectonico

> **Objetivo:** convertir Electron en lo que siempre debio ser: un control remoto. El renderer pinta estado y envia intenciones; Node/Electron orquesta ventanas, IPC, archivos y procesos; Rust y los servicios especializados toman las decisiones de audio, tiempo, mezcla, encoder, analisis y planificacion.
>
> **Regla anti-parches:** antes de corregir un bug dentro de `frontend/render.js`, identificar si la responsabilidad ya pertenece a Rust, backend, worker, servicio o dependencia. Si pertenece afuera, corregir el contrato o el adaptador. Solo se permite parche local temporal si mantiene la radio operativa y queda documentado aqui con fecha de retiro.

### Diagnostico confirmado por auditoria
- [x] **`frontend/render.js` es el cuello de botella principal:** archivo activo de ~11.5k lineas, con UI, playlist, eventos, reloj, routing, WebAudio legacy, control plane Rust, encoder, cartwall, VU meters, diagnosticos y recuperacion de errores mezclados.
- [x] **Muchas funciones ya fueron delegadas, pero el renderer conserva coordinacion vieja:** editores, preview, peaks, cue, DSP, taps, encoder Rust y varios servicios ya existen fuera del renderer. El problema restante no es "falta de piezas", sino limpiar los puentes legacy, duplicaciones y decisiones que quedaron vivas en `render.js`.
- [x] **Web Audio API ya no debe ser fuente de verdad:** en modo `rustAudio`, el grafo WebAudio del renderer debe considerarse infraestructura inerte pendiente de eliminacion. Cualquier fallback WebAudio nuevo queda prohibido salvo aprobacion explicita.
- [x] **`main.js` y `backend/ipc/windows.js` tambien concentran estado global:** estan mejor que antes, pero todavia mezclan ventanas, encoder, estado compartido y contratos de motor. El saneamiento debe incluirlos despues de estabilizar el renderer.

### Inventario inicial verificado de `frontend/render.js`
- [~] **Lineas 1-330, arranque/config/helpers:** conservar de momento, pero mover lectura/escritura de JSON a backend cuando exista servicio de configuracion.
- [~] **Lineas 340-375, preanalisis de pistas:** mover a Rust/backend. Ya existe `getPeaks`; falta que `ensurePreanalysisForTrack` deje de decidir desde el renderer.
- [~] **Lineas 381-1250, tabs/playlist/sesion/incidencias:** separar UI pura de estado operativo. Mantener DOM aqui temporalmente; mover decisiones de playlist/sesion a contrato backend/Rust.
- [~] **Lineas 1250-1660, estado Rust virtual/mirror:** no borrar todavia. Es puente de compatibilidad hasta que Rust emita snapshot completo de playlist/transporte.
- [ ] **Lineas 5900-6020, tiempos proyectados:** mover `recalcEndTime` y `_calcTbodyHours` fuera del renderer.
- [ ] **Lineas 5985-6155, grafo WebAudio principal:** borrar cuando encoder master Rust quede como unica ruta y no haya fallback WebAudio aprobado.
- [~] **Lineas 6570-7225, diagnostico/rutas/FX Rust:** conservar como adaptador temporal; reducir cuando los contratos de ruta, FX y devices vivan en backend.
- [ ] **Lineas 7390-7665, routing WebAudio/Rust mezclado:** dividir. En modo Rust debe quedar solo UI + comando de ruta; taps WebAudio salen con el grafo legacy.
- [ ] **Lineas 7810-9565, transporte playlist:** mover reglas de reproduccion, mix, fade y siguiente al motor/servicio. El renderer solo debe pintar y enviar intenciones.
- [x] **Lineas 9718-10180, encoder:** retirado `startMasterPcmEncoderCapture` y camino `webAudioRenderer -> ffmpeg` para master. Queda por separar el bloque en modulo pequeno: Rust sync, microfono y estado visual del encoder.
- [~] **Lineas 10230-11340, cartwall:** UI y modales pueden vivir en modulo frontend separado; reproduccion runtime ya debe pertenecer a Rust/servicio.
- [~] **Lineas 11390-11478, listeners Rust finales:** conservar; son el camino correcto de push. Reducir cuando los handlers deleguen en modulos pequenos.

### Fase 0 - Congelamiento de deuda nueva
- [x] **Corte 2026-05-20 - polling/encoder fantasma eliminado:** retiradas constantes muertas de polling Rust en `render.js`, renombrado helper a intencion real (`shouldUseRustAudioEngine`), eliminado el armado cada 1s de `buildRustPcmEncoderLiveMixPlan()` y el handler IPC no-op `rust-pcm-encoder-sync`. El tap nativo Rust ya no depende de planes de players enviados desde el renderer.
- [ ] **No agregar logica pesada nueva a `frontend/render.js`:** toda funcion nueva debe justificarse como UI pura. Si calcula audio, tiempo, playlist, analisis, encoder, DB o reglas, debe ir a Rust/backend/worker/servicio.
- [ ] **Marcar cada parche temporal con fecha de retiro:** usar comentarios cortos del tipo `TEMP_RETIRO: mover a <modulo> cuando <condicion>`. No aceptar nuevos `FIX BUG version N` sin plan de salida.
- [ ] **Crear inventario de responsabilidades reales:** tabla con cada bloque grande de `render.js`, propietario deseado y estado: `UI`, `Node`, `Rust`, `worker`, `servicio existente`, `eliminar`.

### Fase 1 - Contratos, no parches
- [ ] **Definir contrato unico de estado de reproduccion:** Rust debe emitir un snapshot suficiente para pintar AIRE, siguiente, progreso, mezcla, fin, meters y estado de players. `render.js` no debe reconstruir el mundo con relojes paralelos.
- [ ] **Definir contrato unico de playlist:** el renderer envia comandos (`play`, `stop`, `next`, `seek`, `queue`, `move`, `delete`) y recibe estado pre-digerido. Calculos como `recalcEndTime`, proyecciones y saltos deben salir del renderer.
- [x] **Corte 2026-05-20 - contrato unico del encoder master:** el contrato ya no anuncia `webAudioRenderer` como owner/captureProvider del master. `backend/ipc/windows.js` intenta Rust PCM tap directamente para master, reporta silencio como diagnostico y no como fallback, y consola/cliente muestran `Rust PCM tap` en lugar de bridge/fallback.
- [ ] **Definir contrato unico de meters:** Rust emite meters por bus; backend retransmite; renderer/consola pintan. Cero amplitud WebAudio como dato funcional.

### Fase 2 - Retiro ordenado de Web Audio API del sistema principal
- [x] **Corte 2026-05-20 - fallback WebAudio del encoder master retirado:** eliminado `startMasterPcmEncoderCapture()`, el `ScriptProcessor` PCM del renderer, el armado manual de samples `s16le` y la ruta `webAudioRenderer -> ffmpeg` para master. Si el master no entra por Rust PCM tap, falla de forma explicita; el microfono conserva su captura `MediaRecorder`.
- [ ] **Eliminar nodos WebAudio de master/playlist/cartwall en `render.js`:** despues de retirar el fallback del encoder, borrar `AudioContext`, `createGain`, `createMediaElementSource`, `MediaStreamDestination`, `ScriptProcessor`, analyzers y buses WebAudio que ya no participen en salida real.
- [ ] **Reemplazar players HTML como fuente real:** `player-a`, `player-b` y `jingle-player` deben quedar solo como UI legacy o desaparecer. La reproduccion real debe vivir en Rust.
- [x] **Corte 2026-05-20 - proxy `renderer.js` eliminado:** `index.html` carga directo `render.js`; se borro el proxy de una linea que solo hacia `require('./render.js')`.

### Fase 3 - Reduccion de `render.js` por dominios
- [ ] **Extraer modulo UI playlist:** DOM, seleccion, drag/drop visual, menus y renderizado. Sin reglas de audio ni calculo de tiempos.
- [ ] **Extraer modulo UI cartwall:** grid, modales, colores y acciones de usuario. La reproduccion y estado runtime deben venir del motor/servicio.
- [ ] **Extraer modulo UI eventos:** lista, calendario, botones e indicadores. El reloj y disparo automatico deben pertenecer al backend/Rust.
- [ ] **Extraer modulo UI audio/FX/meters:** sliders, botones y pintura. El DSP, orden, niveles y rutas deben ser contratos Rust.
- [ ] **Extraer modulo sesion/estado visual:** autosave de layout, preferencias de UI y restauracion visual, sin tocar motor.

### Fase 4 - Backend/Electron como orquestador limpio
- [ ] **Separar ventanas de encoder en `backend/ipc/windows.js`:** mover logica de FFmpeg/encoder a un servicio dedicado; dejar en `windows.js` solo creacion y ciclo de vida de ventanas.
- [ ] **Reducir `sharedState` de `main.js`:** reemplazar el objeto gigante de getters/setters por servicios explicitos con dependencias pequenas.
- [ ] **Centralizar acceso a archivos/config:** evitar que renderers lean y escriban JSON directamente cuando el backend ya puede validar, normalizar y emitir eventos.
- [ ] **Centralizar escrituras SQLite:** mantener una sola autoridad de escritura para evitar bloqueos, carreras y diferencias entre renderer, workers y servicios.

### Fase 5 - Verificacion obligatoria por cada corte
- [ ] **Checklist funcional antes/despues:** Play, Stop, Next, Pause, Seek, Mix, FadeOut, locucion de hora, cartwall, preview, editor, encoder master, encoder mic, consola VU, cambio de tarjeta, cierre limpio.
- [ ] **Prueba de no-regresion de audio:** validar que en modo `rustAudio` no se activa WebAudio para master, playlist, cartwall ni encoder master.
- [ ] **Prueba de estabilidad de errores:** un fallo de Rust, FFmpeg o archivo inexistente debe producir estado claro, no cascada de parches ni timers compitiendo.
- [ ] **Medicion de progreso arquitectonico:** registrar lineas de `render.js`, numero de referencias WebAudio, numero de IPC directos y bloques eliminados por fase.

### Orden recomendado de ataque
1. Congelar deuda nueva y hacer inventario por bloques de `render.js`.
2. Cerrar encoder master Rust como unica ruta y retirar fallback WebAudio.
3. Retirar grafo WebAudio principal.
4. Extraer UI playlist/cartwall/eventos/meters por modulos.
5. Limpiar `main.js` y `backend/ipc/windows.js`.
6. Borrar proxies, legacy y comentarios historicos que ya no aporten.

---

## 🚨 0. SPRINT EN CURSO — Migración a Motor Rust como única fuente de verdad

> **Filosofía aplicada (regla de oro):** Electron es un humilde **control remoto**. El frontend NO procesa audio, NO calcula tiempos, NO lee la hora. Sólo manda comandos al motor Rust y dibuja lo que Rust le devuelve. Toda inteligencia y procesamiento viven en el motor nativo.

Las siguientes tareas surgieron de una auditoría cruzada (mayo 2026) que detectó **puntos donde sesiones de IA anteriores marcaron trabajo como hecho pero en el disco real estaba a medias o no aplicado**. Se documentan aquí para no volver a perder el contexto.

### ✅ Saneamiento previo (cerrado)
- [x] **Diagnóstico de arranque lento (5–10 s):** Instrumentación temporal aplicada y removida. Causa raíz identificada: `RUST_LIVE_METER_POLL_MS = 50` en `frontend/render.js` generaba ~20 IPC/s de `status` (sospechosos B y C descartados). Solución implementada: ver "Motor Rust modo PUSH" abajo.
- [ ] **Purga del log `audio_engine_report.jsonl`:** Sigue creciendo (~10 entradas/s ahora son del push de status). Pendiente rotación más agresiva o suppress de logging para los `message` rutinarios del push (similar al throttle de `command status`).

### ✅ Motor Rust en modo PUSH (filosofía "humilde control remoto")
- [x] **Bucle PushTick de 100 ms en Rust:** `audio-engine-rust/src/main.rs` ahora corre un selector `mpsc::channel<EngineEvent>` con tres variantes (`StdinLine`, `PushTick`, `StdinClosed`). El hilo timer emite `EngineEvent::PushTick` cada 100 ms → `emit_status(&state, "")` por stdout sin `requestId`. Constante `PUSH_TICK_MS = 100`.
- [x] **Reenvío de status spontáneos en Node:** `backend/audio_engine_process.js` detecta los `status` sin pending matching y los reenvía vía `onEngineEvent` por el canal `audio-engine-rust-event`.
- [x] **Frontend escucha y pinta:** `frontend/render.js` retira `scheduleRustAudioProbeStatusRefresh()`. El listener de `audio-engine-rust-event` recibe el push y llama `watchRustPlaylistOwnerHealth`, `reconcileRustCartwallRuntimeStatus`, `reconcileRustOverlayRuntimeStatus`. `ensureRustEngineEagerStart()` dispara el spawn una sola vez en init.
- [x] **Resultado medido:** `ready-to-show` pasó de **+1733 ms a +916 ms** (−47%). IPC roundtrips en 12 s pasaron de **~240 a 8** (−97%). Bucle push validado a 100.8 ms promedio (jitter ±1 ms).

### ✅ Bloqueo de telemetría Web Audio API (Mensaje 4 cerrado)
- [x] **Cortar entrada de niveles WebAudio en `backend/ipc/ui.js`:** Handlers `vu-levels` y `aux-vu-levels` reescritos. Cuando el motor Rust está corriendo, el handler `__stripWebAudioAmplitude()` pisa pgm/monitor/cue/jingle/cartwall/playlists/dbs/stereo/stereoDbs con ceros; sólo deja pasar `diagnostics` y `rustMeters`.
- [x] **Sistema de log de rechazos throttled por origen (30 s):** `__logWebAudioReject(origin)` en `backend/ipc/ui.js` registra `webaudio-rejected` en `audio_engine_report.jsonl` con throttle de 30 s por origen distinto (renderer principal, editores `preview`/`jingle`/`transition`/`audio`).
- [x] **Reemplazar estadísticas AudioContext por estado Rust en `frontend/consola.js`:** Eliminados `summarizeRustDrift()`, `shadowText`, y los bloques "Rust drift monitor"/"Sincronización Rust" del panel del operador. La línea `Motor Rust: en línea / disponible / no disponible` queda como única fuente.

### ✅ Eliminación de infraestructura "Shadow" muerta (Mensaje 2 Fase 4 cerrada)
- [x] **Borrado total del sistema Shadow en `frontend/render.js`:** Eliminadas (no envueltas — borrado directo) `syncRustShadowPlayback()`, `rustShadowState`, `rustShadowBlockedPaths`. Renombrada `RUST_SHADOW_SEEK_INTERVAL_MS` → `RUST_MIRROR_SEEK_DEBOUNCE_MS` (sigue usándose en el mirror legítimo). Purgadas todas las propiedades `shadow:` de los call-sites (~48 ocurrencias en total).
- [x] **Limpieza shadow drift en `backend/audio_engine_process.js`:** Borradas 10 constantes `SHADOW_DRIFT_*`, 6 fields `lastShadowDrift*`, el objeto `shadowDriftStats`, y los métodos `updateShadowDrift()`/`getShadowDriftIgnoreReason()`/`markShadowDriftCommand()`. Eliminadas referencias en `status()` y `command()`.
- [x] **Limpieza shadow drift en `frontend/consola.js`:** Borradas las dos claves `shadowDrift`/`shadowDriftStats` de `getRustProbeFromStatus`, los bloques del report viewer (`entry.type === 'shadow-drift'`) y el botón "Sombra PCM" entero (era código muerto + `RustPcmBridgeShadowValidator` nunca estuvo definido). Eliminados los 4 handlers IPC `rust-pcm-shadow-*` en `backend/ipc/windows.js` y el botón `btn-rust-pcm-shadow` de `consola.html`.
- [x] **Adapter limpio:** Quitado `shadow: payload.shadow === true` de `loadAudio` y `seek` en `frontend/audio_engine_client.js`. Quitado warning textual "shadow playback" en `frontend/render.js`.

### ✅ Reloj único Rust (control remoto puro)
- [x] **Helper unificado YA existía:** `rustPlaylistVirtualClock` + `getPlayerClockTime(player)` + `getPlayerClockDuration(player)` + `isPlayerClockPaused(player)` + `isRustVirtualPlayer(player)` + `getRustVirtualCurrentTime()` en `frontend/render.js:1068-1188`. Funciona con drift compensation contra el push de status Rust.
- [x] **Funciones principales de transporte ya usan los helpers:** Indicador AIRE, Play/Pause, Seek, fade-out de mix-trigger, detección de fin.
- [ ] **Migración fina de lecturas residuales:** Quedan 11 lecturas directas de `activePlayer.paused`/`activePlayer.currentTime`/`fadingPlayer.paused`/`jingleElement.paused` en sitios secundarios. No bloquean — el flow principal va por el helper. Migrar uno a uno con verificación física por audio.

### ✅ Suma correcta de program buses en meter MASTER (Mensaje 5 cerrado)
- [x] **MASTER meter = master + jingle + cartwall + pl1+pl2+pl3+pl4 verificado en ambos lados:** En `frontend/consola.js:204-229` (función `paintRustMetersToStrips`) y en `frontend/render.js:7602-7622` (función `readRustProgramStereoPercent`). Ambos respetan el modo `playlistOutputMode === 'independent'` que excluye pl1-4 del master pero mantiene jingle/cartwall (pisadores siempre suman).

### 🟡 Cleanup final del grafo WebAudio inerte en `frontend/render.js`
- [ ] **Suspender `AudioContext` del renderer en modo `rustAudio`:** Sigue armado y procesando silencio en el renderer (32 referencias a `audioContext`/`createGain`/`createBiquadFilter`/`createDynamicsCompressor`). En modo `rustAudio` el `pgmStereoMeter`, `jingleStereoMeter`, `cartwallStereoMeter` etc. ya quedan pisados por los meters del push de Rust. **Acción:** coordinar este borrado con el siguiente bloque (bus FX en Rust) — cuando el motor Rust haga el DSP real, el grafo entero WebAudio del renderer se elimina de una pasada (no por partes, para no romper los `analyser` que aún alimentan los meters del header).

### 🔴 Bus FX intermedio en Rust — FASE D en ejecución (mayo 2026)

> **Filosofía broadcast aplicada:** consola física profesional, no laboratorio. El monitor sincronizado al sample con PGM (~3 ms drift máx por drenado activo del ring). El encoder es un Sink (sumidero) que NO reproduce: escucha el cable "Y" y emite a internet.

**Topología actual del audio:**
```
[pl1-4 + jingle + cartwall players]
   ↓
[program_mixer] (rodio::mixer::Mixer 0.22.2)
   ↓
[MultiTeeSource → monitor_tap + encoder_tap]  ← Pre-FX (hoy)
   ↓
[FaderSource Master]   ← único punto de aplicación del master_gain
   ↓
[MeteredSource master_bus_meter]
   ↓
sink físico PGM

[monitor_tap consumer]
   ↓
[TapConsumerSource con drenado anti-acumulación]
   ↓
[FaderSource Monitor]  ← fader monitor independiente
   ↓
[MeteredSource monitor_bus_meter]
   ↓
sink físico Booth

[encoder_tap consumer]
   ↓
emit_encoder_pcm_chunk en cada PushTick (100ms)
   ↓
stdout mensaje pcmChunk base64
   ↓
probe Node attachPcmConsumer
   ↓
stdin FFmpeg → Icecast/Shoutcast

[cue-player + editores avanzados]  ──→  sink CUE directo (INTOCABLE)
```

**Reglas de oro confirmadas en código:**
1. Master fader: ÚNICO punto de aplicación = `FaderSource` entre program_mixer y sink PGM. NO más `effective_gain_for` per-player.
2. Bypass DSP: nodos siempre activos procesando, switch UI = `wet_target` con rampa de ~5.8 ms hacia `wet_actual`. Cero clics.
3. CUE: completamente fuera del grafo, sin DSP, sin master, sin monitor. Como el jack de cue en consola física.
4. Encoder: NO reproduce, NO tiene fader propio. Es un Sink puro que escucha el bus elegido y entrega PCM al FFmpeg.

### ✅ FASE D — Sub-pasos completados
- [x] **7.1 — `rtrb` + structs vacías:** `DspParams`, `EqBandAtomic`, `EncoderTapBuffer`, `BusGraph` declaradas.
- [x] **7.2 — API rodio 0.22.2 investigada:** bitácora en `main.rs:218-253`. Trampa del Zero perpetuo documentada.
- [x] **7.3 — `program_mixer` lazy:** `ensure_program_mixer` instancia el sub-mixer cuando `route_bus("master")` llega por primera vez.
- [x] **7.4 — Players de programa al sub-mixer:** `load_audio_player` y `start_time_locution` conectan a `program_mixer_input` cuando el bus es de programa. CUE sigue al sink directo.
- [x] **7.4-bis — Bug locución horaria en playlist:** fix de la guarda `!fadingPlayer.paused` → `!isPlayerClockPaused(fadingPlayer)`. Ahora respeta `fadeoutNext` del tipo SALIENTE (música/saytime/jingle/comercial). Mismo bug pattern arreglado también en `handleTimeUpdate` línea 7048.
- [x] **7.5 — `FaderSource` único:** `effective_gain_for()` ELIMINADA. Master fader vive como `FaderSource(Master)` entre `program_mixer` y sink. Handler `masterGain` escribe en `dsp_params.master_gain_bits` con `Ordering::Relaxed`.
- [x] **7.6 — TapSource post-fader:** `MeteredSource(master_bus_meter)` mide la señal real saliendo al sink. `emit_status` la emite como meter id="master" source="bus".
- [x] **8.1 — MonitorChain con tap del program_mixer:** `MultiTeeSource` bifurca cada sample del program_mixer a dos rings (monitor + encoder). `TapConsumerSource` con drenado activo a ~3 ms mantiene el monitor sincronizado con PGM. Ring monitor = 4 096 samples (46 ms máx). Meter id="monitor" expuesto.
- [x] **8.2 — Encoder tap directo a Rust:** comando IPC `encoderTap { enable: bool }` + `emit_encoder_pcm_chunk` en cada PushTick drena el ring y emite `pcmChunk` base64 s16le. `attachPcmConsumer`/`detachPcmConsumer`/`isPcmTapMode` implementados en el probe Node. Eliminado el código muerto `RustPcmBridgeEncoderSource` (referenciado pero nunca definido) en `backend/ipc/windows.js`.

### ✅ FASE D — Cadena DSP nativa completada
- [x] **9.1 — `PreAmpSource`:** multiplica cada sample por `10^(preamp_db/20)`. Clamp [-24, +24] dB. Sin wet/dry (a 0 dB es transparente). Lee atómico `preamp_db_bits`.
- [x] **9.2 — `PanSource`:** ley equal-power (cos/sin) sobre el ángulo `(pan+1)*π/4`. Estado de índice de sample para alternar L/R en stereo. Mono pass-through.
- [x] **9.3 — `MonoSource`:** suma L+R con `(l+r)*0.5` y mezcla wet/dry contra el dry original. Procesa por frames stereo con `pending_right` buffer. Rampa de 256 samples (~5.8 ms) entre wet_actual y wet_target — bypass sin clic (regla 2).
- [x] **10.1 — `LimiterSource`:** hard clip al `ceiling_db` (default -0.3 dBFS). Wet/dry rampa. Recálculo de ceiling lineal cada 1024 samples (amortiza powf). Versión sin lookahead — protege el sink físico.
- [x] **11.1 — `EqChainSource` (8 bandas peaking RBJ):** 8 biquads en cascada por canal (L y R con estado separado). Cookbook coefs recalculados cada 1024 samples. Wet/dry rampa global del chain. Defaults: frecuencias broadcast estándar (60/120/250/500/1k/2k/4k/8k Hz), Q=1.0, gain=0 dB → transparente al arranque. Pendiente: parser del array `bands` en el comando `fx` para que el frontend pueda mover bandas individuales.
- [x] **11.2 — `CompressorSource`:** envelope follower exponencial (one-pole) con attack/release coefs `1 - exp(-1/(t·fs))`. Gain computer hard knee en dominio lineal: `(threshold/envelope)^((ratio-1)/ratio)`. Cache de params cada 1024 samples. Wet/dry rampa. Defaults: threshold -18 dB, ratio 4:1, attack 5 ms, release 100 ms, makeup 0 dB.

**Topología DSP cableada en `ensure_program_mixer`:**
```
program_mixer
   ↓
MultiTeeSource (taps Pre-FX a monitor + encoder)
   ↓
PreAmpSource → PanSource → MonoSource → EqChainSource → CompressorSource → LimiterSource
   ↓
FaderSource Master (único punto del master_gain)
   ↓
MeteredSource master_bus_meter
   ↓
sink físico PGM
```

### ✅ FASE D — Sub-pasos finales completados
- [x] **11.1-bis — Parser del array `bands` + AGC↔Limiter mutex + alineación EQ defaults:** `json_get_f32_array` parsea el array `bands: [g0..g7]` que el frontend ya enviaba y escribe los 8 gains a los atómicos `dsp_params.eq_bands[i].gain_db_bits`. El `EqChainSource` recalcula coeficientes cada ~12 ms → respuesta perceptible en tiempo real. **Regla broadcast crítica**: si AGC y Limiter llegan ambos en `true` (caso edge donde el frontend tuviese un bug), el motor mantiene SÓLO el Limiter activo (es la última línea de defensa del sink físico contra overshoots). Frecuencias EQ defaults alineadas con UI: 63/125/250/500/1k/2k/4k/8k Hz.
- [x] **11.3 — Taps Pre-FX y Post-FX con selector atómico:** segundo `MultiTeeSource` después de toda la cadena DSP (entre Limiter y FaderMaster). 4 rings totales (monitor_pre, monitor_post, encoder_pre, encoder_post). `DualTapConsumerSource` para el monitor elige entre Pre y Post sample-por-sample según `monitor_tap_mode` atómico. `emit_encoder_pcm_chunk` elige entre los dos rings del encoder según `encoder_tap_mode`. Conmutación EN CALIENTE sin reconstruir el grafo. El ring inactivo se drena agresivamente para no acumular memoria. Handler `route` para bus `encoder` y `monitor` ahora propaga `sourceMode` al atómico.
- [x] **12.1 — Cleanup grafo WebAudio FX:** `audioCtx.resume()` (líneas 7901 y 8636) ahora guard-checked con `!isRustExclusiveAudioMode()` para no despertar el contexto inútilmente en modo Rust. Al arrancar, si `generalPrefs.audioEngineMode === 'rustAudio'`, se llama `audioCtx.suspend()` proactivamente — el grafo WebAudio queda inerte. `setFxParamValue`, `toggleFxNode` y `rebuildAudioRouting` ya tenían guards previos. **Nota**: el cleanup destructivo (eliminar TODOS los nodos WebAudio, `createBiquadFilter`/`createDynamicsCompressor`/etc.) queda agendado para una FASE futura cuando se confirme que el modo `webAudio` se elimina por completo. Hoy quedan inertes pero existentes (consumen mínimo CPU porque `audioCtx` está suspendido).

### ✅ FASE D — Orden dinámico de FX, encoder Pre-FX y corrección AGC (mayo 2026)
- [x] **Orden dinámico de FX (`DynamicDspSource`):** Se reemplazó la cascada fija de 6 adapters por `DynamicDspSource`, un único Source que lee `fx_order` (AtomicU32, 2 bits × 3 bloques = 6 bits; default 36 = EQ→Comp→Limiter) por cada par estéreo L/R. Los botones 🔼🔽 y el drag&drop de la UI propagan el nuevo orden al motor vía `syncRustFxContractDebounced()` en `moveFxModule()` y en el listener `dragend`. El procesamiento EQ→Comp→Limiter es reordenable en tiempo real sin reconstruir el grafo.
- [x] **Bug encoder Pre-FX — 3 causas simultáneas corregidas:** (1) Asignar `tapPointSel.value` al abrir `encoder.js` no dispara el evento `change` → se agregó `ipcRenderer.send('encoder-tap-point-changed', ...)` explícito al cargar preferencias. (2) `startRustPcmEncoderSync` no sincronizaba la ruta al iniciar → se agregó `syncRustRouteContract({force:true})`. (3) El handler Rust interpretaba `sourceMode:""` como postFx → ahora sólo reconoce `"preFx"`/`"postFx"` explícitamente; cualquier otro valor conserva el modo anterior.
- [x] **AGC — Corrección de makeup gain (+14 dB):** El compresor bajaba el volumen sistemáticamente: threshold -18 dB, música a -13 dB → siempre comprimiendo con makeup 0 dB → pérdida neta ~3.75 dB. Parámetros corregidos: ratio 3:1, attack 30 ms, release 800 ms, makeup +14 dB. Nivel de salida del bus PGM estable en torno a -1 dBFS.
- [x] **Faders Master y Monitor — sliders funcionales:** Corregidos por el operador (mayo 2026). Los sliders de volumen master y monitor producen cambio audible en tiempo real.

### ✅ SPRINT NOCTURNO mayo 2026 — 4 fases + 1 extra cerradas
Trabajos ejecutados sin interrupción durante la madrugada con la regla operativa "modifico → compilo → arranco → audito stderr → si hay error corrijo en el acto → avanzo". Cada fase pasó el ciclo limpio.

#### FASE 1 — Bypass DSP agrupado (regla broadcast)
- [x] **PreAmp + Pan + Mono ahora pertenecen al módulo EQ:** los 3 Source adapters (`PreAmpSource`, `PanSource`, `MonoSource`) usan **`eq_wet_target_bits` compartido** con rampa común de 256 samples (~5.8 ms). Cuando el operador apaga el switch del EQ en la UI, **todo el grupo cae a bypass real** sin clic — el operador no escucha ni el preamp ni el pan ni la suma mono, aunque el motor sigue calculando samples (regla 2: DSP siempre encendido, lo que se ramea es la mezcla wet/dry).
- [x] **Helper `advance_eq_module_wet` centralizado:** los 3 adapters comparten el mismo motor de rampa para garantizar que su `wet_actual` esté perfectamente alineado al wet maestro del módulo.
- [x] **Mono específicamente compone:** `wet_target = eq_wet × mono_intent`. Cuando EQ off y mono on, no se aplica. Cuando EQ on y mono off, tampoco. Solo cuando ambos en 1.0 hace la suma mono.

#### FASE 2 — Editores avanzados (audio, jingle, transition)
- [x] **A) Cierre limpio:** los 3 editores ahora interceptan `beforeunload` (X de Windows) y los botones Cancelar/Guardar para mandar `stop` a los players Rust correspondientes ANTES de cerrar la ventana. Bug del audio sonando infinitamente en CUE quedó resuelto. `audio_editor.js` adicionalmente sobreescribe `window.close` para cubrir el `onclick` directo del HTML.
- [x] **B) Drag en caliente:** en `jingle_editor.js` y `transition_editor.js`, cuando el operador arrastra un mixPoint con audio reproduciéndose, al soltar se ejecuta `applyHotSeekAfterDrag()` que recalcula offsets y manda **`seek` inmediato** a los players Rust afectados — sin pausar/reanudar, sin microcorte. El cambio de posición se escucha en el acto.
- [x] **Limpieza:** auditoría completa de los 3 editores confirmó que toda referencia Web Audio API (audioCtx, createBufferSource, decodeAudioData, analysers) ya estaba comentada `//` desde fases anteriores. Cero infraestructura WebAudio activa en los editores.

#### FASE 3 — Tarjetas de audio deterministas
- [x] **Backend Rust — `reset_program_mixer`:** cuando el operador cambia la tarjeta del bus `master`, se detienen todos los players activos, se libera el sub-mixer entero (`program_mixer_input`, tap consumers Pre/Post-FX, sink monitor), `dsp_ready` cae a false, y `ensure_program_mixer` reconstruye todo apuntando al nuevo sink. Evita la duplicación que reportó el operador (audio sonando en 2 tarjetas a la vez).
- [x] **Backend Rust — `reset_monitor_chain`:** cuando cambia solo la tarjeta del monitor, se recicla el monitor (y arrastra al program_mixer porque los rings están enlazados). Aceptable: corte momentáneo en PGM, garantiza no duplicación.
- [x] **Backend Rust — `cleanup_unused_outputs`:** después de cualquier cambio de routing, escanea `state.outputs` y elimina los `MixerDeviceSink` que ya no están referenciados por ningún bus, ni por el program_mixer ni por el monitor. El drop del sink cierra el stream cpal y libera la tarjeta físicamente.
- [x] **Frontend `settings.js` — snapshot + restore:** captura inicial (con timeout de 1.5 s para que el SO termine de enumerar las tarjetas) de los 19 selectores/toggles más relevantes. Botón **Cancelar** restaura el snapshot a la UI antes de cerrar. Botón **Aplicar** persiste + dispara `settings-updated` PERO no cierra ventana + refresca snapshot. Botón **Aceptar y Cerrar** = Aplicar + close.
- [x] **Monitor — audio limpio verificado:** Corregido por el operador (mayo 2026). El audio del monitor ya no suena saturado/distorsionado.

#### EXTRA — Vúmetros consola virtual sin lag
- [x] **Push directo Rust → consola:** el callback `onEngineEvent` en `main.js` ahora reenvía cada mensaje status también a `consoleWindow`, no solo a `mainWindow`. La consola tiene un listener nuevo de `audio-engine-rust-event` (type='status') que pinta los meters al instante. Eliminados los ~150 ms de latencia que añadía el roundtrip por el renderer principal.
- [x] **Vúmetros — bug de corrupción al cambiar tarjeta (RESUELTO):** Causa raíz: `reset_program_mixer()` destruía el grafo pero no recreaba los `Arc<PlayerMeter>`. El `MeteredSource` viejo (aún vivo en el sink de rodio) y el nuevo creado por `ensure_program_mixer` escribían al mismo Arc simultáneamente → lecturas corruptas. Fix: recrear `master_bus_meter` y `monitor_bus_meter` con `Arc::new(PlayerMeter::default())` al inicio de `reset_program_mixer`.
- [x] **Botonera (Cartwall) — migrada al motor Rust:** El andamio JS ya existía. Se corrigieron 4 bugs simultáneos:
  - Bug crítico: `loadAudio` en Rust ignoraba `autoplay` (hardcodeado `paused=true`) → audio no salía. Fix: leer `autoplay` del JSON y pasar `!autoplay` como `paused`.
  - Routing por modo: nueva función `getRustCartwallBusAndOutput()` — `master→cartwall`, `cue→cue`, `device→cartwall-independent` (sale al device directo, sin DSP). Modo `monitor` mantiene Web Audio (arquitectura Rust no tiene bus-monitor independiente).
  - Progress bar: `reconcileRustCartwallRuntimeStatus` ahora actualiza `cw-progress-N` y `cw-timer-N` cada 100 ms desde `positionMs`/`durationMs` del push Rust.
  - `durationMs` por player: Rust lee `decoder.total_duration()` al cargar y lo emite en el status; antes era siempre 0 para players normales.

### ✅ DSP avanzado completado (mayo 2026)
- [x] **Soft knee para el Compressor:** implementado por el operador. Transición suave en el threshold.
- [x] **Lookahead para el Limiter:** implementado por el operador. Lookahead de 1-2 ms antes del pico.
- [x] **EQ con freq/Q controlables:** implementado por el operador. El frontend puede enviar `bands: [{freq, q, gainDb}, ...]`.

### 🟡 Mejoras opcionales agendadas (no bloqueantes)
- [ ] **Eliminación destructiva del grafo WebAudio:** quedan ~69 referencias a nodos WebAudio en `frontend/render.js` (preAmpNode, panNode, monoNode, fxEqNodes[], compDry/Wet, limDry/Wet, pgmBus, pgmStereoMeter). Todas inertes en modo `rustAudio` (audioCtx suspendido). Cuando se confirme que el modo `webAudio` no se necesita ni como fallback, borrar las ~300-500 líneas. Por ahora coexisten sin afectar al motor Rust.
- [ ] **Cambio de tarjeta master sin corte de audio:** hoy `reset_program_mixer` detiene todos los players. Una versión pro futura implementaría un crossover seamless con dos sub-mixers en paralelo durante un breve período de transición.

### 🟢 Verificación física obligatoria
- [ ] **Banco de pruebas con los 4 audios de la raíz:** `PARA_PRUEBAS1.mp3`, `PARA_PRUEBAS2.mp3`, `PARA_PRUEBAS3.wav`, `PARA_PRUEBAS4.flac`. Cada paso del plan se valida con audio real por el camino que toca (playlist, editor, cartwall, encoder, locución horaria desde playlist).

### 🟡 Bugs visuales anotados (no urgentes — agendar tras el bus FX)
- [ ] **Forma de onda `.peaks` se ve mal visualmente:** Los peaks que pinta el motor Rust no calzan visualmente con el audio real (se ven "horribles"). Pendiente revisar: (a) cantidad de bins solicitada vs. ancho del canvas; (b) si la compresión min/max está aplastando picos; (c) si el desfase visual viene del descarte automático de silencios de cabeza/cola (`silenceStart`/`silenceEnd`) que mueve el cero. Reproducible con cualquier pista del editor avanzado.

---

## 📻 1. Mejoras del Encoder (Streaming por Internet)
- [ ] **Reconexión Automática (Auto-Reconnect):** Implementar un bucle que intente reconectar silenciosamente cada 5-10 segundos si se detecta un micro-corte de red, para no perder la transmisión permanentemente.
- [ ] **Monitoreo del encoder en tiempo real:** Panel de estado visible en la consola principal cuando el encoder está activo: megabytes subidos (parsear `size=` de la salida de FFmpeg), bitrate efectivo, tiempo de emisión, estado de conexión (verde/rojo/amarillo), y alerta ante corte o pérdida de paquetes. Rust puede incluir estas métricas en el push de 100 ms como campo `encoderStats` cuando `encoder_tap_active` es true.
- [ ] **Estadísticas Reales de Red:** Mostrar en la interfaz del Encoder los megabytes subidos (`size=`) y la fluctuación exacta del bitrate en tiempo real extraídos directamente de FFmpeg.
- [ ] **Grabador Testigo Local (Logger):** Agregar un parámetro a FFmpeg para que, además de emitir por internet, grabe un respaldo del audio en MP3 en una carpeta local (ej. separando archivos por hora/día).
- [x] **Fuente PCM del Encoder desde Rust:** El master ya no usa `webAudioRenderer -> ffmpeg`; ahora requiere Rust PCM tap. El fallback WebAudio del master queda retirado y el microfono conserva `MediaRecorder`.
- [ ] **Perfiles de Servidores Multiples:** Crear una pequeña base de datos para guardar perfiles de conexión (Ej: "Principal", "Backup", "Test") y poder intercambiar de emisora/servidor con un solo clic.

## 🎧 2. Ventanas y Experiencia de Usuario (UI/UX)
- [x] **Arrastre visual interactivo:** Implementado el salto en la línea de tiempo (seek) con clic derecho sostenido, permitiendo cancelar al salir del área o pulsar Escape.
- [x] **Unificación de Íconos Nativos:** Los íconos de las ventanas en la barra de tareas y el título principal ahora renderizan emojis como `.png` reales, dándole una apariencia 100% nativa de Windows sin la "X" genérica de Electron.
- [x] **Panel Lateral Redimensionable:** Implementado un separador interactivo (resizer) para ajustar dinámicamente el ancho del panel izquierdo con restricciones y persistencia local.
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
- [~] **Análisis de Ondas de Audio (Waveform Peaks):** `buildMainWaveformPeaks()` de la playlist principal sigue en JS. **Completado para editores:** `audio_editor`, `jingle_editor` y `transition_editor` ya delegan al motor Rust vía comando `getPeaks` con caché en disco. **Pendiente:** Delegar también `buildMainWaveformPeaks()` de la playlist principal al motor Rust.
- [~] **Preanálisis de Silencios y Fades (Auto-Cue):** **Completado para el editor de audio:** la función `autoDetectSilence()` del editor fue eliminada del renderer; ahora el motor Rust detecta inicio y fin del audio real (`silenceStart`, `silenceEnd`) como parte del comando `getPeaks`. **Pendiente:** Aplicar el mismo patrón al análisis de la playlist principal (`ensurePreanalysisForTrack`).
- [ ] **Generador de Playlists (Clockwheel / Rotation):** Toda la inteligencia de armar listas de 60 minutos respetando reglas de separación (`buildRotationPlaylist`, etc.) vive en el cliente (~500 líneas). **Acción:** Mover este algoritmo matemático a un WebWorker dedicado o al Main Process. Debe ejecutarse en paralelo sin congelar la UI y solo devolver la lista resultante.
- [ ] **Gestor de Eventos y Timers (`checkEvents`):** El cliente tiene un bucle `setInterval` de 1000ms comprobando arrays masivos de horas para disparar acciones automáticas. **Acción:** Mover el reloj principal al backend. El Main Process o Rust debe llevar el control del tiempo exacto y simplemente enviar un IPC `[EVENT_TRIGGER]` al render cuando deba pintar o saltar.
- [ ] **Cálculos de Tiempo Proyectado (`recalcEndTime` y `_calcTbodyHours`):** Recalcular la hora en la que sonará la canción #45 de la playlist requiere iterar y sumar milisegundos constantemente en cada salto. **Acción:** Delegar esto al motor, que debe despachar un estado general de la playlist pre-calculado.


### 🟣 Auditoría de Librería y Editores Avanzados (Audio, Transiciones, Pisadores)
- [x] **Decodificación de Audio Redundante en Editores:** `audio_editor.js`, `jingle_editor.js` y `transition_editor.js` ya no usan `AudioContext.decodeAudioData`. El motor Rust es ahora el único decodificador (Single Source of Truth): los editores invocan el comando `getPeaks` vía IPC y reciben picos pre-calculados listos para pintar. La RAM del renderer ya no sube por decodificación de audio.
- [x] **Caché de Peaks en Disco (`.peaks`):** El motor Rust genera y lee archivos de caché en `cache/peaks/` (raíz del programa). Formato texto v1 con hash FNV-1a del path + mtime para invalidación automática si cambia el archivo. Primera apertura: Rust decodifica en streaming y escribe el caché. Aperturas siguientes: lectura directa sin decodificar. **TODO futuro (Fase UI):** Permitir al usuario elegir la carpeta de caché desde Configuración con diálogo de selección.
- [~] **Preview en Tiempo Real en Editores de Transición/Pisador:** Re-seek automático ya funciona al hacer clic en el viewport (stop+play transparente usando los players Rust). **Pendiente (largo plazo):** Ajuste de offsets en tiempo real sin reconstruir players (requiere API de seek en caliente en el motor Rust).
- [~] **Renderizado de Forma de Onda en Tiempo Real:** El `cursorLoop()` sigue usando `requestAnimationFrame` para la aguja (capa dinámica ligera). La capa pesada (waveform estática) ya no se recalcula desde RAM: los peaks vienen pre-procesados de Rust. **Pendiente:** Separación en dos Canvas superpuestos (capa estática + capa cursor) para eliminar repintados innecesarios.
- [ ] **Filtros de Búsqueda Masiva en `libreria.js`:** `applyCurrentSearchAndRender()` filtra y ordena miles de pistas en memoria usando arreglos nativos de JavaScript (`Array.filter`). **Acción:** Mover estas búsquedas directamente a SQLite (`SELECT ... WHERE title LIKE %x%`). La BD está optimizada en C para esto; el Front-End solo debe pedir datos y mostrar resultados.
- [ ] **Inyección Masiva en DOM de Librería:** Cargar la biblioteca entera congela la UI al inyectar miles de nodos `<tr>`. **Acción:** Implementar "Virtual Scrolling" en `libreria.html` para pintar solo lo visible en pantalla, reduciendo el peso de la UI en más de un 90%.
- [x] **Reproductores Paralelos (Web Audio API):** Los tres editores ya no usan `BufferSourceNode` de WebAudio para reproducción. Envían comandos `loadAudio / seek / play / stop` al motor Rust con player IDs dedicados (`audio-editor`, `jingle-editor-a/j/b`, `trans-editor-a/b`). El motor Rust gestiona la salida de audio exclusivamente.
- [x] **Ruteo de Editores al Bus de Pre-Escucha (Cue):** Los 6 players de los editores avanzados (`audio-editor`, `jingle-editor-a/j/b`, `trans-editor-a/b`) están ahora conectados **exclusivamente al bus `cue`** (pre-escucha). Esto se aplica tanto en el motor Rust (`default_bus_for_player()`) como en cada comando `loadAudio` (`bus: 'cue'`). El audio de los editores es 100% independiente del master, encoder, monitor y efectos — igual que enchufar al jack de cue en una consola real.
- [x] **Escucha Previa (Clic Derecho) migrada a Rust:** `preview.js` reescrito completamente. Ya no usa `AudioContext`, `new Audio()` ni `createEditorOutputRouter`. El player `cue-player` carga y reproduce vía motor Rust (`loadAudio + play`) saliendo directamente por el bus cue. La barra de progreso se anima con `performance.now()` y la duración se obtiene del comando `getPeaks` (bins=128, usa caché en disco si ya se analizó). El seek por clic en la barra también va por Rust (`seek`).
- [x] **AudioContext desconectado en los tres editores:** Los bloques `createEditorOutputRouter / createMeteringAnalyser / startCueVuMeter` de `audio_editor.js`, `jingle_editor.js` y `transition_editor.js` están envueltos en `WEBAUDIO_DISABLED_BEGIN...END`. Ningún `AudioContext` activo en los editores avanzados ni en la ventana de pre-escucha. **Pendiente (futuro):** Migrar también el VU meter de editores al sistema de metering del motor Rust para eliminar el bloque por completo.

### 🟡 Refactorización y Limpieza Estructural de `render.js`
- [ ] **Modularizar Front-End:** Dividir el monolito de 7,000 líneas en módulos independientes: `audio_engine_client.js` (comunicación con Rust), `ui_playlist.js` (DOM de la tabla), `ui_clockwheel.js` (Modal de generador), y `ui_waveform.js` (Canvas).
- [ ] **Virtualización de la Playlist (Virtual Scrolling):** Actualmente, cargar una playlist de 3000 canciones inyecta miles de `<tr>` al DOM. **Acción:** Implementar paginación o virtualización visual (renderizar solo las 30-40 filas visibles en pantalla en base al scroll) para que la RAM no colapse por culpa del DOM.
- [ ] **Eliminar consultas bloqueantes a SQLite desde `render.js`:** Evitar llamadas síncronas IPC `invokeSync` durante bucles de dibujado de la interfaz. Todo debe fluir mediante promesas asíncronas o eventos paralelos.

### 🟢 Mejoras Generales de Memoria
- [x] **Autodestrucción de Procesos (Ahorro de RAM):** Se implementó el apagado automático del Worker de la Librería tras 10s de inactividad, liberando ~70MB.
- [x] **Caché Inteligente de Sesión:** `mapTrackRowToClient()` usa BD para no golpear el disco duro con `fs.existsSync()` en cargas masivas.
- [ ] **Centralizar escrituras DB desde Workers:** Migrar a comunicación vía `parentPort.postMessage` para evitar bloqueos `SQLITE_BUSY` por accesos simultáneos.
- [ ] **Liberación Agresiva de AudioBuffers:** Al cerrar un editor, forzar `audioBuffer = null` y desconectar todos los nodos de Web Audio para que el Garbage Collector libere la memoria inmediatamente. Actualmente los buffers (~50MB por canción) persisten en RAM hasta que Electron decide limpiarlos.
- [ ] **Decodificación Mono para Peaks:** Los editores decodifican en estéreo completo solo para calcular picos. Cambiar a decodificación mono (1 canal) reduce el consumo de RAM a la mitad durante la generación de waveforms. El worker `waveform_worker.js` ya lo hace con FFmpeg (`-ac 1`), pero los editores no lo aprovechan.

## 🧹 5. Limpieza de Código y Backend
- [x] Extraer lógica de Artistas, Géneros y Utilidades de `main.js` a `backend/services/`. (Completado - Se aligeró el proceso principal en ~2,000 líneas).
- [ ] **Eliminar `migrateDataFromJSON()` en database.js:** Se ejecuta buscando archivos antiguos inexistentes.
- [x] **Eliminar `renderer.js` proxy:** completado. `index.html` carga directo `render.js` y el proxy de una linea fue borrado.

## ⚙️ 6. Correcciones y Mantenimiento General
- [x] Atajos `Ctrl+C/X/V` nativos integrados para copiado entre playlists manteniendo toda la metadata intacta.
- [x] Clima Inteligente sin API: `settings.js` ahora maneja autocompletado y obtiene la ubicación asíncrona persistiendo en disco local para lecturas en segundo plano sin bloquear el hilo principal de `render.js`.
- [x] Eventos automáticos no deben limpiar todas las playlists: Corregido para afectar solo su respectiva área de emisión.
- [x] **Control Granular de Fade Out:** Separados los ajustes de atenuación de salida para interrupción manual (Siguiente) y detención (Stop), configurables de forma independiente y con actualización en tiempo real en la pista activa.
- [ ] **Modo Linea/Auxiliar para playlists:** Renombrar en consola las playlists como `Linea/Auxiliar` para rutear salidas exclusivas de audio.
- [ ] **FX como parte formal del motor:** Implementación REAL del Master FX en Rust (no documentación). Hoy `state.fx` en main.rs sólo almacena parámetros — el DSP corre todavía en WebAudio del renderer y por eso en modo `rustAudio` el "boost de efectos" es un placebo audible. Detalle exhaustivo en la sección 🚨 0 al inicio de este archivo.
- [x] Limpieza de BD de artistas y Cédula de Artista reparadas.

## 🐧 7. Implementación Multiplataforma (Windows + Linux)

Esta sección es la **guía maestra** de la migración multiplataforma. Se actualiza con cada avance para no perder el hilo.

> **Regla de Oro: Código Base Único (Convivencia Windows/Linux).**
> ⚠️ **ATENCIÓN PARA DESARROLLADORES E IAs:** NO se debe eliminar ni destruir el código existente de Windows. La lógica de Windows y Linux debe convivir en los mismos archivos.
> NO se crearán carpetas separadas. Se usará exactamente el mismo código base para ambos sistemas. Cuando un proceso sea diferente según el sistema operativo, se debe utilizar un condicional (`if (process.platform === 'win32') { ... } else if (process.platform === 'linux') { ... }`). La compatibilidad con Linux se **suma** al código actual de Windows, no lo reemplaza.

### 📋 Decisiones Confirmadas
| Decisión | Resolución |
|---|---|
| **Motor de audio en Linux** | Solo motor Rust — Web Audio API NO existirá en Linux |
| **Distribuciones target** | Basadas en Debian: **Linux Mint**, Ubuntu, Debian. También Flatpak |
| **Compilación Rust** | Directa en máquina Linux (VM VirtualBox con Linux Mint) |
| **node_modules** | Separados por plataforma (Windows y Linux tienen sus propios node_modules) |
| **Entorno de desarrollo** | Carpeta compartida VirtualBox entre Windows y Linux |
| **Explorador de archivos Linux** | Sin Escritorio — solo Descargas, Música, Inicio. Discos USB si hay montados |

### 📝 Nota Técnica: Backends de Audio en Linux
> El motor Rust usa `cpal` como abstracción de audio. En Linux existen **3 backends principales**:
> - **ALSA** (Advanced Linux Sound Architecture): Capa de bajo nivel, siempre presente. Es lo que `cpal` usa por defecto.
> - **PulseAudio**: Servidor de audio de nivel medio. Fue el estándar durante años en Ubuntu/Mint. Corre encima de ALSA.
> - **PipeWire**: El **reemplazo moderno** de PulseAudio (y de JACK). Linux Mint 22+ y Ubuntu 24+ lo incluyen por defecto. Es compatible hacia atrás con ALSA y PulseAudio, así que aplicaciones que usen ALSA (como `cpal`) funcionan automáticamente a través de PipeWire.
>
> **Conclusión práctica:** Al compilar con `cpal` usando ALSA (comportamiento por defecto), el audio funcionará en las 3 configuraciones porque PipeWire y PulseAudio son transparentes para aplicaciones ALSA. No necesitamos features adicionales en `Cargo.toml` por ahora.

---

### ✅ Fase Histórica: Cambios Seguros Ya Completados
- [x] **Estandarizar Rutas de Archivos:** Se eliminaron barras invertidas hardcodeadas. Ahora se usa `path.join()`, `path.sep` y `process.platform` donde es necesario.
- [x] **Rutas de Datos de Usuario:** Todas usan `path.join(__dirname, 'config')` — portables entre Windows y Linux.
- [x] **Scripts de Arranque base:** Creado `iniciar.sh` para Linux y corregido `Iniciar_Automatizador.bat` con `%~dp0`.
- [x] **Auditoría Case Sensitivity:** `backend/path_case_audit.js` con modo diagnóstico y reparación automática.
- [x] **Motor Rust cross-platform base:** `audio_engine_process.js` ya resuelve `.exe` vs sin extensión. `main.rs` ya tiene `#[cfg(windows)]`/`#[cfg(not(windows))]`.
- [x] **Explorador de unidades:** `library.js` → `get-system-drives` ya retorna `['/']` en Linux.

### ✅ Fase 1: Asistentes de Instalación (Windows y Linux)
- [x] **`instalar_dependencias.sh` (Linux)** — Setup inicial interactivo. Verifica e instala dependencias (`apt`), Node.js, Rust, ejecuta `npm install`, compila motor Rust, y **limpia la basura al final** (`npm cache clean`, `cargo clean`, `apt autoremove`).
- [x] **`Instalar_Dependencias.bat` (Windows)** — Setup equivalente para PCs nuevos con Windows. Verifica dependencias, compila y **limpia la basura al final** para ahorrar GB de disco.
- [x] **`iniciar.sh` (Linux)** y **`Iniciar_Automatizador.bat` (Windows)** — Launchers ligeros y rápidos para el uso del día a día (accesos directos).

### ✅ Fase 2: Explorador de Archivos Inteligente por Plataforma
- [x] **`backend/ipc/library.js`** — Modificar `get-default-paths`: excluir `desktop` en Linux, agregar `home`
- [x] **`backend/ipc/library.js`** — Modificar `get-system-drives`: en Linux detectar discos USB montados en `/media/$USER/`
- [x] **`frontend/render.js`** — Modificar `loadDrives()`: en Linux no mostrar Escritorio, agregar 🏠 Inicio
- [x] **`frontend/render.js`** — Modificar `renderTree()`: iconos inteligentes por plataforma (🏠 para Home, 💿 para USB montados)
- [x] **`frontend/libreria.js`** — Adaptar defaults de `defaultPaths` y `systemDrives` según plataforma

### ✅ Fase 3: Compatibilidad de Rutas y Configuraciones
- [x] **Crear `backend/utils/platform.js`** — Módulo centralizado: `isWindows`, `isLinux`, `adaptStoredPath()`, `safeSpawnOptions()`
- [x] **Adaptar lectura de `timeFolder`** — Usar `adaptStoredPath()` para traducir rutas Windows absolutas a rutas relativas en Linux
- [x] **Verificar `ffmpeg-static`** — Ya tiene fallback a `ffmpeg` del sistema en los 3 archivos que lo usan (`main.js`, `audio_analysis_worker.js`, `waveform_worker.js`)

### 🔴 Fase 4: Motor de Audio Rust en Linux (en la VM)
- [ ] Configurar VirtualBox con carpeta compartida `C:\LF Automatizador v1.0` ↔ `/media/sf_lf-automatizador/`
- [ ] Instalar dependencias del sistema en Linux Mint (`libasound2-dev`, `pkg-config`, `curl`)
- [ ] Instalar Rust en la VM (`rustup`)
- [ ] Compilar `lf-audio-engine` con `cargo build --release` en Linux
- [ ] Copiar binario a `bin/lf-audio-engine` (sin extensión)
- [ ] Verificar enumeración de dispositivos ALSA/PipeWire desde el motor
- [ ] Verificar apertura de streams stereo 44100/48000 Hz
- [ ] Validar ring buffer monitor y encoder tap sin glitches
- [ ] Test de nombres de dispositivos (diferencias Windows vs Linux)

### 🔴 Fase 5: Empaquetado y Distribución
- [ ] Permisos de ejecución (`chmod +x`) para binarios FFmpeg y motor Rust
- [ ] Configurar `electron-builder` para generar `.deb` (Debian/Ubuntu/Mint) y `.AppImage` (portable)
- [ ] Test de instalación limpia en Linux Mint fresco (sin dependencias previas)
- [ ] Documentar proceso de compilación en README.md
- [ ] Verificar compatibilidad Flatpak (bonus)

---
*Nota: Este archivo se actualiza con cada avance. Las fases se ejecutan en orden pero algunas tareas pueden hacerse en paralelo. El objetivo es que NINGÚN cambio rompa el funcionamiento existente en Windows.*
