const { ipcRenderer } = require('electron');
const fs = require('fs');
// WEBAUDIO_DISABLED_BEGIN — VU meter y enrutamiento Web Audio del editor de pisador/jingle
// El audio ya sale por el motor Rust al bus cue. Este bloque puede borrarse tras pruebas.
// const { createEditorOutputRouter } = require('./editor_audio_output');
// const { createMeteringAnalyser, startCueVuMeter } = require('./audio_metering');
// const audioCtx = new AudioContext({ latencyHint: 'interactive' });
// const { outputNode: editorOutputNode, applyRouting: applyEditorAudioRouting, ensurePreviewPlayback: ensureEditorPreviewPlayback } = createEditorOutputRouter(audioCtx);
// const editorCueAnalyser = createMeteringAnalyser(audioCtx, editorOutputNode, 1024);
// const stopEditorVuMeter = startCueVuMeter(ipcRenderer, editorCueAnalyser, 'jingle-editor');
// applyEditorAudioRouting();
// ipcRenderer.on('settings-updated', () => { applyEditorAudioRouting(); });
// window.addEventListener('beforeunload', () => { stopEditorVuMeter(); });
// WEBAUDIO_DISABLED_END
// RUST_ENGINE: bufferA/J/B son ahora objetos mock { duration, _peaks } en vez de AudioBuffer
let bufferA, bufferJ, bufferB, trackData;
const waveformPeaksCache = new WeakMap();
let pixelsPerSecond = 50;
let viewportWidth = 0;
let viewStartTime = -15;
let mixPointA = -10;
let mixPointB_Abs = -5;

// Carpeta de caché de peaks (se obtiene del backend al arrancar)
let editorCacheDir = '';
ipcRenderer.invoke('get-cache-dir').then(r => { if (r?.success) editorCacheDir = r.cacheDir; }).catch(() => {});

// WEBAUDIO_DISABLED_BEGIN — callbacks Web Audio desconectados
// applyEditorAudioRouting();
// ipcRenderer.on('settings-updated', () => { applyEditorAudioRouting(); });
// window.addEventListener('beforeunload', () => { stopEditorVuMeter(); });
// WEBAUDIO_DISABLED_END

// WEBAUDIO_DISABLED: nodeBufferToArrayBuffer y decodeAudioFile ya no se usan.
// Las llamadas en load-data fueron reemplazadas por ipcRenderer.invoke('audio-engine-rust-command', { cmd: 'getPeaks' }).
// Se conservan como referencia hasta la limpieza definitiva.
// function nodeBufferToArrayBuffer(buffer) {
//     return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
// }
// async function decodeAudioFile(filePath) {
//     const fileData = await fs.promises.readFile(filePath);
//     return audioCtx.decodeAudioData(nodeBufferToArrayBuffer(fileData));
// }

let sourceA, sourceJ, sourceB, animFrameId;
let isPlaying = false;
let playCursorTime = -15;
let playStartTimeAbs = 0;       // WEBAUDIO_DISABLED: audioCtx.currentTime al play
let playStartMs = 0;            // RUST_ENGINE: performance.now() al play
let playStartCursorTime = -15;  // RUST_ENGINE: playCursorTime al momento de dar Play
let delayTimeouts = [];         // RUST_ENGINE: timeouts de inicio diferido de pistas

const canvasA = document.getElementById('canvas-a'); const ctxA = canvasA.getContext('2d');
const canvasJ = document.getElementById('canvas-j'); const ctxJ = canvasJ.getContext('2d');
const canvasB = document.getElementById('canvas-b'); const ctxB = canvasB.getContext('2d');
const viewport = document.getElementById('editor-viewport');
const cursorEl = document.getElementById('play-cursor');
const scrollSlider = document.getElementById('view-scroll');

ipcRenderer.on('load-data', async (e, data) => {
    trackData = data;
    document.getElementById('lbl-tracks').innerText = `${data.nameA} ➡️ [PISADOR] ➡️ ${data.nameB}`;
    try {
        // RUST_ENGINE: Obtener peaks de las 3 pistas via motor Rust (sin decodeAudioData en JS)
        // WEBAUDIO_DISABLED: bufferA/J/B ya no son AudioBuffer; son objetos mock { duration, _peaks }
        // async function decodeAudioFile(filePath) {
        //     const fileData = await fs.promises.readFile(filePath);
        //     return audioCtx.decodeAudioData(nodeBufferToArrayBuffer(fileData));
        // }
        const [resA, resJ, resB] = await Promise.all([
            ipcRenderer.invoke('audio-engine-rust-command', { cmd: 'getPeaks', path: data.trackA, bins: 4096, cacheDir: editorCacheDir }),
            ipcRenderer.invoke('audio-engine-rust-command', { cmd: 'getPeaks', path: data.jingle,  bins: 4096, cacheDir: editorCacheDir }),
            ipcRenderer.invoke('audio-engine-rust-command', { cmd: 'getPeaks', path: data.trackB,  bins: 4096, cacheDir: editorCacheDir }),
        ]);
        if (!resA?.success || !resJ?.success || !resB?.success) throw new Error('getPeaks falló');

        // Crear objetos mock compatibles con drawWaveform / getWaveformPeaks
        bufferA = { duration: resA.message.durationMs / 1000, _peaks: { min: new Float32Array(resA.message.min), max: new Float32Array(resA.message.max), bins: resA.message.bins } };
        bufferJ = { duration: resJ.message.durationMs / 1000, _peaks: { min: new Float32Array(resJ.message.min), max: new Float32Array(resJ.message.max), bins: resJ.message.bins } };
        bufferB = { duration: resB.message.durationMs / 1000, _peaks: { min: new Float32Array(resB.message.min), max: new Float32Array(resB.message.max), bins: resB.message.bins } };

        // FIX BUG (visual no refleja edición previa): si la fila ya tenía
        // tiempos guardados (`customMix` de una edición anterior), los traemos
        // del data y los convertimos a las coordenadas internas del editor.
        //
        // Convención del editor: `playCursorTime = 0` es el fin de la pista A.
        //   mixPointA = savedMixPointA - bufferA.duration  (negativo)
        //   mixPointB_Abs = mixPointA + savedMixPointJ
        //
        // Fórmula inversa a la del btn-save:
        //   savedMixPointA = bufferA.duration + mixPointA
        //   savedMixPointJ = mixPointB_Abs - mixPointA
        if (typeof data.savedMixPointA === 'number' && Number.isFinite(data.savedMixPointA)) {
            mixPointA = data.savedMixPointA - bufferA.duration;
            if (typeof data.savedMixPointJ === 'number' && Number.isFinite(data.savedMixPointJ)) {
                mixPointB_Abs = mixPointA + data.savedMixPointJ;
            }
            // FIX v2: encuadrar el viewStartTime para que el inicio del
            // pisador (mixPointA) quede en el cuarto izquierdo del viewport.
            // Antes usábamos un centrado simétrico ±30s que dejaba el
            // mixPoint fuera de pantalla si la pista A era muy larga. Ahora
            // siempre se ve el solapamiento al abrir.
            viewStartTime = mixPointA - 5;
        }

        document.getElementById('loading').style.display = 'none';
        handleResize();
    } catch (err) {
        // FIX BUG (editor abre vacío sin feedback): si getPeaks falla, mantener
        // el overlay con un mensaje de error en vez de cerrar silenciosamente
        // la ventana — eso dejaba al operador sin pista de qué pasó.
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            const txt = loadingEl.querySelector('.loading-text');
            if (txt) { txt.style.color = '#e74c3c'; txt.innerText = `Error cargando audios: ${err.message || err}`; }
        }
    }
});

function handleResize() {
    viewportWidth = viewport.clientWidth;
    canvasA.width = viewportWidth; canvasA.height = document.getElementById('row-a').clientHeight;
    canvasJ.width = viewportWidth; canvasJ.height = document.getElementById('row-j').clientHeight;
    canvasB.width = viewportWidth; canvasB.height = document.getElementById('row-b').clientHeight;
    drawAll();
}
window.addEventListener('resize', handleResize);

function drawAll() {
    if (!bufferA || !bufferJ || !bufferB) return;
    document.getElementById('lbl-mix-a').innerText = mixPointA.toFixed(2) + " s";
    document.getElementById('lbl-mix-b').innerText = mixPointB_Abs.toFixed(2) + " s";
    ctxA.clearRect(0,0,viewportWidth,canvasA.height); ctxJ.clearRect(0,0,viewportWidth,canvasJ.height); ctxB.clearRect(0,0,viewportWidth,canvasB.height);
    drawWaveform(ctxA, bufferA, ((-bufferA.duration)-viewStartTime)*pixelsPerSecond, '#00a8ff');
    drawWaveform(ctxJ, bufferJ, (mixPointA-viewStartTime)*pixelsPerSecond, '#f39c12');
    drawWaveform(ctxB, bufferB, (mixPointB_Abs-viewStartTime)*pixelsPerSecond, '#2ecc71');
    updateCursorVisual();
}

function drawWaveform(ctx, buffer, startX, color) {
    // FIX: envelope espejada con amplitud absoluta (estilo Adobe Audition).
    // Sustituye al render de "rectángulos verticales" que en música densa se
    // veía saturado como código de barras.
    const peaks = getWaveformPeaks(buffer);
    const binsPerSecond = peaks.bins / buffer.duration;
    const binsPerPixel = binsPerSecond / pixelsPerSecond;
    const amp = ctx.canvas.height / 2;
    // 1) Calcular peaks por pixel — solo en el rango visible.
    const peakPerPixel = new Float32Array(viewportWidth);
    const firstVisiblePx = Math.max(0, Math.floor(startX));
    const lastVisiblePx = Math.min(viewportWidth, Math.ceil(startX + (peaks.bins / binsPerPixel)));
    for (let x = firstVisiblePx; x < lastVisiblePx; x++) {
        const actualX = x - startX;
        if (actualX < 0) continue;
        const startBin = Math.floor(actualX * binsPerPixel);
        if (startBin >= peaks.bins) break;
        const endBin = Math.max(startBin + 1, Math.ceil((actualX + 1) * binsPerPixel));
        let absMax = 0;
        for (let j = startBin; j < endBin && j < peaks.bins; j++) {
            const a = Math.max(Math.abs(peaks.min[j]), Math.abs(peaks.max[j]));
            if (a > absMax) absMax = a;
        }
        peakPerPixel[x] = absMax;
    }
    // 2) Envelope rellena, simétrica arriba y abajo del eje central.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(firstVisiblePx, amp);
    for (let x = firstVisiblePx; x < lastVisiblePx; x++) {
        ctx.lineTo(x, amp - peakPerPixel[x] * amp);
    }
    for (let x = lastVisiblePx - 1; x >= firstVisiblePx; x--) {
        ctx.lineTo(x, amp + peakPerPixel[x] * amp);
    }
    ctx.closePath();
    ctx.fill();
}

function getWaveformPeaks(buffer) {
    // RUST_ENGINE: Si el buffer es un objeto mock (viene del motor Rust), devolver sus peaks directamente
    if (buffer._peaks) return buffer._peaks;

    // WEBAUDIO_DISABLED_BEGIN — cálculo JS en RAM (solo si audioBuffer real está disponible)
    const cached = waveformPeaksCache.get(buffer);
    if (cached) return cached;
    const rawData = buffer.getChannelData(0);
    const targetBins = Math.max(2048, Math.min(60000, Math.ceil(buffer.duration * 120)));
    const samplesPerBin = Math.max(1, Math.ceil(rawData.length / targetBins));
    const bins = Math.ceil(rawData.length / samplesPerBin);
    const min = new Float32Array(bins);
    const max = new Float32Array(bins);
    for (let bin = 0; bin < bins; bin++) {
        const start = bin * samplesPerBin;
        const end = Math.min(rawData.length, start + samplesPerBin);
        let binMin = 1; let binMax = -1;
        for (let i = start; i < end; i++) {
            const datum = rawData[i];
            if (datum < binMin) binMin = datum;
            if (datum > binMax) binMax = datum;
        }
        min[bin] = binMin; max[bin] = binMax;
    }
    const peaks = { min, max, bins };
    waveformPeaksCache.set(buffer, peaks);
    return peaks;
    // WEBAUDIO_DISABLED_END
}

function updateCursorVisual() { cursorEl.style.left = `${(playCursorTime-viewStartTime)*pixelsPerSecond}px`; }

let isMouseDown = false, dragTarg = null, initX = 0, initMP = 0;
viewport.addEventListener('mousedown', (e) => {
    isMouseDown = true; initX = e.clientX;
    const rect = viewport.getBoundingClientRect(); const y = e.clientY - rect.top; const h = rect.height / 3;
    if (y > h && y < h*2) { dragTarg = 'J'; initMP = mixPointA; }
    else if (y >= h*2) { dragTarg = 'B'; initMP = mixPointB_Abs; }
    else dragTarg = null;
});

window.addEventListener('mousemove', (e) => {
    if (!isMouseDown || !dragTarg) return;
    const dx = e.clientX - initX;
    if (Math.abs(dx) > 3) {
        if (dragTarg === 'J') mixPointA = initMP + (dx / pixelsPerSecond);
        if (dragTarg === 'B') mixPointB_Abs = initMP + (dx / pixelsPerSecond);
        drawAll();
    }
});

// Bug 1 fix: mouseup global con reset robusto
window.addEventListener('mouseup', (e) => {
    if (!isMouseDown) return;
    const dx = e.clientX - initX;
    // Bug 2 fix: clic para saltar - sincronizar cursor visual + audio
    if (Math.abs(dx) <= 3) {
        const rect = viewport.getBoundingClientRect();
        const x = Math.max(0, e.clientX - rect.left);
        playCursorTime = viewStartTime + (x / pixelsPerSecond);
        updateCursorVisual();
        if (isPlaying) {
            togglePlay(); // stop
            togglePlay(); // play desde nueva posición
        }
    } else if (dragTarg && isPlaying) {
        // FASE 2B: drag en caliente — el operador soltó después de mover
        // mixPointA o mixPointB_Abs. Recalculamos offsets y mandamos seek
        // inmediato al motor Rust para que la posición auditiva refleje
        // el nuevo punto de mezcla SIN pausar/reanudar (sin microcorte).
        applyHotSeekAfterDrag();
    }
    isMouseDown = false; dragTarg = null;
});

// FIX BUG (desfase al mover bloque) — versión 3: seek inteligente con
// timers por player. Antes los drags consecutivos sobre el mismo mixPoint
// acumulaban setTimeouts de arranque diferido — al disparar todos juntos
// la pista se "repetía y saltaba". Ahora mantenemos un timer activo por
// playerId y cancelamos el anterior antes de programar uno nuevo, o al
// pasar a estado playing/idle.
const __pendingStartTimers = {
    'jingle-editor-a': null,
    'jingle-editor-j': null,
    'jingle-editor-b': null
};

function cancelPendingStart(playerId) {
    if (__pendingStartTimers[playerId]) {
        clearTimeout(__pendingStartTimers[playerId]);
        __pendingStartTimers[playerId] = null;
    }
}

function applyHotSeekAfterDrag() {
    if (!isPlaying) return;
    const offA = bufferA.duration + playCursorTime;
    const offJ = playCursorTime - mixPointA;
    const offB = playCursorTime - mixPointB_Abs;
    const rustCmd = (p) => ipcRenderer.invoke('audio-engine-rust-command', p).catch(() => {});

    const smartUpdate = (playerId, offset, duration, path) => {
        if (offset >= 0 && offset < duration) {
            // Estado nuevo: PLAYING. Cancelar timer pendiente de arranque
            // diferido (si existía de un drag anterior) — el player debe
            // sonar AHORA, no en el futuro.
            cancelPendingStart(playerId);
            rustCmd({ cmd: 'seek', player: playerId, positionMs: Math.round(offset * 1000) });
            rustCmd({ cmd: 'play', player: playerId });
        } else if (offset < 0 && offset > -60) {
            // Estado nuevo: PENDING. Cancelar timer previo y stop limpio
            // antes de programar el nuevo arranque diferido. Solo UN timer
            // activo por player en cualquier momento.
            cancelPendingStart(playerId);
            rustCmd({ cmd: 'stop', player: playerId });
            const delayMs = Math.abs(offset) * 1000;
            const startSession = playSession;
            const t = setTimeout(() => {
                __pendingStartTimers[playerId] = null;
                if (!isPlaying || playSession !== startSession) return;
                rustCmd({ cmd: 'loadAudio', player: playerId, path, gain: 1.0, bus: 'cue' })
                    .then(() => rustCmd({ cmd: 'play', player: playerId }));
            }, delayMs);
            __pendingStartTimers[playerId] = t;
            delayTimeouts.push(t);
        } else {
            // Estado nuevo: IDLE (offset fuera del rango). Cancelar timer
            // pendiente y stop limpio.
            cancelPendingStart(playerId);
            rustCmd({ cmd: 'stop', player: playerId });
        }
    };

    smartUpdate('jingle-editor-a', offA, bufferA.duration, trackData.trackA);
    smartUpdate('jingle-editor-j', offJ, bufferJ.duration, trackData.jingle);
    smartUpdate('jingle-editor-b', offB, bufferB.duration, trackData.trackB);
}

// FASE 2A — detener TODOS los players Rust del editor antes de cerrar la
// ventana. Esto se llama desde el botón Cancelar, el botón Guardar Y el
// cierre nativo de Electron (beforeunload). Evita el bug de "música suena
// infinitamente en CUE" después de cerrar el editor.
function stopAllRustPlayersOnExit() {
    try {
        ['jingle-editor-a', 'jingle-editor-j', 'jingle-editor-b'].forEach(pid => {
            ipcRenderer.invoke('audio-engine-rust-command', { cmd: 'stop', player: pid }).catch(() => {});
        });
    } catch (err) {}
}
window.addEventListener('beforeunload', stopAllRustPlayersOnExit);

// Bug 1 fix: mouseleave en viewport para soltar el drag
viewport.addEventListener('mouseleave', () => {
    if (dragTarg) {
        dragTarg = null;
    }
});

// Bug 1 fix: blur como respaldo final
window.addEventListener('blur', () => {
    isMouseDown = false;
    dragTarg = null;
});

scrollSlider.addEventListener('input', (e) => { viewStartTime = parseFloat(e.target.value); drawAll(); });

// Bug 4 fix: función para actualizar el estado visual del botón Play
function updatePlayBtnVisual() {
    const btn = document.getElementById('btn-play-pause');
    if (btn) btn.innerText = isPlaying ? '⏸' : '▶';
}

// RUST_ENGINE: contador de sesión de reproducción (evita que timeouts diferidos
// disparen play en una sesión ya cancelada)
let playSession = 0;

function togglePlay() {
    if (isPlaying) {
        // WEBAUDIO_DISABLED_BEGIN
        // [sourceA, sourceJ, sourceB].forEach(s => { if(s){ try { s.stop(); } catch(e){} s.disconnect(); } });
        // sourceA = null; sourceJ = null; sourceB = null;
        // WEBAUDIO_DISABLED_END

        // RUST_ENGINE: Detener los 3 players del pisador
        delayTimeouts.forEach(t => clearTimeout(t));
        delayTimeouts = [];
        // FIX BUG: también limpiar los timers individuales por player (registro
        // separado del que usa applyHotSeekAfterDrag para evitar acumulación
        // entre drags). Sin esta limpieza quedaban timers huérfanos que
        // disparaban audio después de un stop manual.
        if (typeof __pendingStartTimers !== 'undefined') {
            Object.keys(__pendingStartTimers).forEach(pid => {
                if (__pendingStartTimers[pid]) {
                    clearTimeout(__pendingStartTimers[pid]);
                    __pendingStartTimers[pid] = null;
                }
            });
        }
        ['jingle-editor-a', 'jingle-editor-j', 'jingle-editor-b'].forEach(pid => {
            ipcRenderer.invoke('audio-engine-rust-command', { cmd: 'stop', player: pid }).catch(() => {});
        });
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
        isPlaying = false;
    } else {
        // WEBAUDIO_DISABLED_BEGIN
        // if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
        // ensureEditorPreviewPlayback();
        // playStartTimeAbs = audioCtx.currentTime;
        // sourceA = audioCtx.createBufferSource(); sourceA.buffer = bufferA; sourceA.connect(editorOutputNode);
        // ...
        // WEBAUDIO_DISABLED_END

        // RUST_ENGINE: Reproducir 3 pistas sincronizadas con sus offsets
        // offA = posición dentro de Track A (tiempo absoluto negativo = antes del fin de A)
        // offJ = posición dentro del Jingle (relativo a mixPointA)
        // offB = posición dentro de Track B (relativo a mixPointB_Abs)
        const offA = bufferA.duration + playCursorTime;
        const offJ = playCursorTime - mixPointA;
        const offB = playCursorTime - mixPointB_Abs;

        const rustCmd = (cmd, extra = {}) =>
            ipcRenderer.invoke('audio-engine-rust-command', { ...cmd, ...extra }).catch(() => {});

        const startSession = ++playSession;

        // Track A
        if (offA >= 0 && offA < bufferA.duration) {
            rustCmd({ cmd: 'loadAudio', player: 'jingle-editor-a', path: trackData.trackA, gain: 1.0, bus: 'cue' })
                .then(() => rustCmd({ cmd: 'seek', player: 'jingle-editor-a', positionMs: Math.round(offA * 1000) }))
                .then(() => { if (isPlaying && playSession === startSession) rustCmd({ cmd: 'play', player: 'jingle-editor-a' }); });
        }

        // Jingle
        if (offJ >= 0 && offJ < bufferJ.duration) {
            rustCmd({ cmd: 'loadAudio', player: 'jingle-editor-j', path: trackData.jingle, gain: 1.0, bus: 'cue' })
                .then(() => rustCmd({ cmd: 'seek', player: 'jingle-editor-j', positionMs: Math.round(offJ * 1000) }))
                .then(() => { if (isPlaying && playSession === startSession) rustCmd({ cmd: 'play', player: 'jingle-editor-j' }); });
        } else if (offJ < 0) {
            const delayMs = Math.abs(offJ) * 1000;
            rustCmd({ cmd: 'loadAudio', player: 'jingle-editor-j', path: trackData.jingle, gain: 1.0, bus: 'cue' });
            const t = setTimeout(() => {
                if (isPlaying && playSession === startSession) rustCmd({ cmd: 'play', player: 'jingle-editor-j' });
            }, delayMs);
            delayTimeouts.push(t);
        }

        // Track B
        if (offB >= 0 && offB < bufferB.duration) {
            rustCmd({ cmd: 'loadAudio', player: 'jingle-editor-b', path: trackData.trackB, gain: 1.0, bus: 'cue' })
                .then(() => rustCmd({ cmd: 'seek', player: 'jingle-editor-b', positionMs: Math.round(offB * 1000) }))
                .then(() => { if (isPlaying && playSession === startSession) rustCmd({ cmd: 'play', player: 'jingle-editor-b' }); });
        } else if (offB < 0) {
            const delayMs = Math.abs(offB) * 1000;
            rustCmd({ cmd: 'loadAudio', player: 'jingle-editor-b', path: trackData.trackB, gain: 1.0, bus: 'cue' });
            const t = setTimeout(() => {
                if (isPlaying && playSession === startSession) rustCmd({ cmd: 'play', player: 'jingle-editor-b' });
            }, delayMs);
            delayTimeouts.push(t);
        }

        playStartMs = performance.now();
        playStartCursorTime = playCursorTime;
        isPlaying = true;
        animLoop();
    }
    updatePlayBtnVisual();
}

function animLoop() {
    if (!isPlaying) return;
    // RUST_ENGINE: Usamos performance.now() en lugar de audioCtx.currentTime
    playCursorTime = playStartCursorTime + (performance.now() - playStartMs) / 1000;
    // WEBAUDIO_DISABLED: playCursorTime += (audioCtx.currentTime - playStartTimeAbs); playStartTimeAbs = audioCtx.currentTime;
    updateCursorVisual();
    // Bug 3 fix: auto-scroll más suave cuando el cursor alcanza el 80% del viewport
    const cursorPx = (playCursorTime - viewStartTime) * pixelsPerSecond;
    if (cursorPx > viewportWidth * 0.8) {
        viewStartTime += (viewportWidth * 0.5) / pixelsPerSecond;
        scrollSlider.value = viewStartTime;
        drawAll();
    }
    if (playCursorTime > Math.max(0, mixPointB_Abs + bufferB.duration)) { togglePlay(); return; }
    animFrameId = requestAnimationFrame(animLoop);
}

// Bug 4 fix: vincular el botón Play con addEventListener explícito
const btnPlayPause = document.getElementById('btn-play-pause');
if (btnPlayPause) {
    btnPlayPause.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePlay();
    });
}
window.addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); togglePlay(); } });

// === ZOOM INTELIGENTE ===
const zoomSlider = document.getElementById('zoom-slider');

// Zoom centrado en un punto temporal (slider → centra en el playhead)
function applyZoomOnTime(newPPS, centerTime) {
    pixelsPerSecond = Math.max(10, Math.min(150, newPPS));
    if (zoomSlider) zoomSlider.value = pixelsPerSecond;
    viewStartTime = centerTime - (viewportWidth / 2) / pixelsPerSecond;
    if (scrollSlider) scrollSlider.value = viewStartTime;
    handleResize();
}

// Zoom centrado en una posición X del viewport (Ctrl+Rueda → centra en el mouse)
function applyZoomOnPixel(newPPS, viewportX) {
    const timeAtPixel = viewStartTime + viewportX / pixelsPerSecond;
    pixelsPerSecond = Math.max(10, Math.min(150, newPPS));
    if (zoomSlider) zoomSlider.value = pixelsPerSecond;
    viewStartTime = timeAtPixel - viewportX / pixelsPerSecond;
    if (scrollSlider) scrollSlider.value = viewStartTime;
    handleResize();
}

// Ctrl+Rueda: zoom centrado en la posición del mouse
viewport.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.shiftKey) {
        e.preventDefault();
        const rect = viewport.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const step = 10;
        const newPPS = e.deltaY < 0 ? pixelsPerSecond + step : pixelsPerSecond - step;
        applyZoomOnPixel(newPPS, mouseX);
    }
}, { passive: false });

// Slider: zoom centrado en el playhead (línea roja)
if (zoomSlider) {
    zoomSlider.addEventListener('input', (e) => {
        applyZoomOnTime(parseFloat(e.target.value), playCursorTime);
    });
}

// FASE 2A — Cancelar: stop a los 3 players Rust + cerrar.
document.getElementById('btn-cancel').addEventListener('click', () => {
    stopAllRustPlayersOnExit();
    window.close();
});
// FASE 2A — Guardar: stop a los players, mandar IPC de guardado y cerrar.
// (El backend cierra la ventana automáticamente al recibir 'save-jingle-transition'
// pero igual paramos los players acá por si la respuesta del backend demora.)
document.getElementById('btn-save').addEventListener('click', () => {
    stopAllRustPlayersOnExit();
    ipcRenderer.send('save-jingle-transition', { trackA: trackData.trackA, jingle: trackData.jingle, mixPointA: (bufferA.duration + mixPointA).toFixed(3), mixPointJ: (mixPointB_Abs - mixPointA).toFixed(3) });
});


// Control de Scroll para inputs numéricos (Global)
document.addEventListener('wheel', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
        e.preventDefault();
        const input = e.target;
        if (input.disabled || input.readOnly) return;
        
        const step = parseFloat(input.getAttribute('step')) || 1;
        let val = parseFloat(input.value) || 0;
        
        if (e.deltaY < 0) val += step;
        else val -= step;
        
        const min = input.getAttribute('min');
        if (min !== null && val < parseFloat(min)) val = parseFloat(min);
        const max = input.getAttribute('max');
        if (max !== null && val > parseFloat(max)) val = parseFloat(max);
        
        const stepStr = step.toString();
        const decimalPlaces = stepStr.includes('.') ? stepStr.split('.')[1].length : 0;
        input.value = val.toFixed(decimalPlaces);
        
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
}, { passive: false });
