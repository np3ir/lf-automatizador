const { ipcRenderer } = require('electron');
const fs = require('fs');
// WEBAUDIO_DISABLED_BEGIN — VU meter y enrutamiento Web Audio del editor de transiciones
// El audio ya sale por el motor Rust al bus cue. Este bloque puede borrarse tras pruebas.
// const { createEditorOutputRouter } = require('./editor_audio_output');
// const { createMeteringAnalyser, startCueVuMeter } = require('./audio_metering');
// const audioCtx = new AudioContext({ latencyHint: 'interactive' });
// const { outputNode: editorOutputNode, applyRouting: applyEditorAudioRouting, ensurePreviewPlayback: ensureEditorPreviewPlayback } = createEditorOutputRouter(audioCtx);
// const editorCueAnalyser = createMeteringAnalyser(audioCtx, editorOutputNode, 1024);
// const stopEditorVuMeter = startCueVuMeter(ipcRenderer, editorCueAnalyser, 'transition-editor');
// applyEditorAudioRouting();
// ipcRenderer.on('settings-updated', () => { applyEditorAudioRouting(); });
// window.addEventListener('beforeunload', () => { stopEditorVuMeter(); });
// WEBAUDIO_DISABLED_END
// RUST_ENGINE: bufferA/B son objetos mock { duration, _peaks } en vez de AudioBuffer
let bufferA = null;
let bufferB = null;
let trackData = null;
const waveformPeaksCache = new WeakMap();

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

let pixelsPerSecond = 50;
let viewportWidth = 0;
let viewStartTime = -15; 
let mixPointA = -5; 

let sourceA = null;
let sourceB = null;
let isPlaying = false;
let playCursorTime = -15;
let playStartTimeAbs = 0;   // WEBAUDIO_DISABLED: audioCtx.currentTime al play
let animFrameId = null;
let playStartMs = 0;            // RUST_ENGINE: performance.now() al play
let playStartCursorTime = -15;  // RUST_ENGINE: playCursorTime al momento de dar Play
let delayTimeouts = [];         // RUST_ENGINE: timeouts de inicio diferido de pistas
let playSession = 0;            // RUST_ENGINE: contador de sesión anti-carrera

const canvasA = document.getElementById('canvas-a');
const ctxA = canvasA.getContext('2d');
const canvasB = document.getElementById('canvas-b');
const ctxB = canvasB.getContext('2d');
const viewport = document.getElementById('editor-viewport');
const cursorEl = document.getElementById('play-cursor');
const overlapLbl = document.getElementById('lbl-overlap');
const scrollSlider = document.getElementById('view-scroll');

ipcRenderer.on('load-data', async (e, data) => {
    trackData = data;
    document.getElementById('lbl-tracks').innerText = `${data.nameA}  ➡️  ${data.nameB}`;
    try {
        // RUST_ENGINE: Obtener peaks de las 2 pistas via motor Rust (sin decodeAudioData en JS)
        // WEBAUDIO_DISABLED: bufferA/B ya no son AudioBuffer; son objetos mock { duration, _peaks }
        // bufferA = await decodeAudioFile(data.trackA);
        // bufferB = await decodeAudioFile(data.trackB);
        const [resA, resB] = await Promise.all([
            ipcRenderer.invoke('audio-engine-rust-command', { cmd: 'getPeaks', path: data.trackA, bins: 4096, cacheDir: editorCacheDir }),
            ipcRenderer.invoke('audio-engine-rust-command', { cmd: 'getPeaks', path: data.trackB, bins: 4096, cacheDir: editorCacheDir }),
        ]);
        if (!resA?.success || !resB?.success) throw new Error('getPeaks falló');

        bufferA = { duration: resA.message.durationMs / 1000, _peaks: { min: new Float32Array(resA.message.min), max: new Float32Array(resA.message.max), bins: resA.message.bins } };
        bufferB = { duration: resB.message.durationMs / 1000, _peaks: { min: new Float32Array(resB.message.min), max: new Float32Array(resB.message.max), bins: resB.message.bins } };

        // FIX BUG (visual no refleja edición previa): aplicar el mixPoint
        // guardado si la fila ya fue editada antes. Inverso del btn-save:
        //   savedMixPoint = bufferA.duration + mixPointA
        if (typeof data.savedMixPoint === 'number' && Number.isFinite(data.savedMixPoint)) {
            mixPointA = data.savedMixPoint - bufferA.duration;
            // FIX v2: encuadrar para que el solapamiento quede a la izquierda
            // del viewport. Antes el "-15" podía dejar el mixPoint fuera de
            // pantalla con pistas largas.
            viewStartTime = mixPointA - 5;
        }

        document.getElementById('loading').style.display = 'none';
        handleResize();
    } catch (err) {
        // FIX BUG (editor abre vacío sin feedback): mostrar error en overlay
        // en lugar de cerrar la ventana silenciosamente.
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
    canvasB.width = viewportWidth; canvasB.height = document.getElementById('row-b').clientHeight;
    drawAll();
}
window.addEventListener('resize', handleResize);

function drawAll() {
    if (!bufferA || !bufferB) return;
    overlapLbl.innerText = Math.abs(mixPointA).toFixed(2) + " s";
    ctxA.clearRect(0, 0, canvasA.width, canvasA.height);
    ctxB.clearRect(0, 0, canvasB.width, canvasB.height);
    let startXA = ( (-bufferA.duration) - viewStartTime ) * pixelsPerSecond;
    drawWaveform(ctxA, bufferA, startXA, '#00a8ff');
    let endA_X = (0 - viewStartTime) * pixelsPerSecond;
    if (endA_X >= 0 && endA_X <= viewportWidth) { ctxA.fillStyle = 'rgba(255,0,0,0.5)'; ctxA.fillRect(endA_X, 0, 1, canvasA.height); }
    let startXB = (mixPointA - viewStartTime) * pixelsPerSecond;
    drawWaveform(ctxB, bufferB, startXB, '#2ecc71');
    updateCursorVisual();
}

function drawWaveform(ctx, buffer, startX, color) {
    // FIX: envelope espejada con amplitud absoluta (estilo Audition). Reemplaza
    // los rectángulos verticales que en música densa se veían saturados.
    const peaks = getWaveformPeaks(buffer);
    const binsPerSecond = peaks.bins / buffer.duration;
    const binsPerPixel = binsPerSecond / pixelsPerSecond;
    const amp = ctx.canvas.height / 2;
    const width = ctx.canvas.width;
    const peakPerPixel = new Float32Array(width);
    const firstVisiblePx = Math.max(0, Math.floor(startX));
    const lastVisiblePx = Math.min(width, Math.ceil(startX + (peaks.bins / binsPerPixel)));
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

function updateCursorVisual() {
    let px = (playCursorTime - viewStartTime) * pixelsPerSecond;
    cursorEl.style.left = `${px}px`;
}

let isMouseDown = false;
let isDraggingTrack = false;
let initialMouseX = 0;
let initialMixPoint = 0;

viewport.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    initialMouseX = e.clientX;
    const rect = viewport.getBoundingClientRect();
    if ((e.clientY - rect.top) > rect.height / 2) {
        isDraggingTrack = true;
        initialMixPoint = mixPointA;
    }
});

window.addEventListener('mousemove', (e) => {
    if (!isMouseDown) return;
    const dx = e.clientX - initialMouseX;
    if (isDraggingTrack && Math.abs(dx) > 3) {
        mixPointA = initialMixPoint + (dx / pixelsPerSecond);
        if (mixPointA > 5) mixPointA = 5;
        drawAll();
    }
});

// Bug 1 fix: mouseup global con reset robusto
window.addEventListener('mouseup', (e) => {
    if (!isMouseDown) return;
    const dx = e.clientX - initialMouseX;
    // Bug 2 fix: clic para saltar - sincronizar cursor visual + audio
    if (Math.abs(dx) <= 3) {
        const rect = viewport.getBoundingClientRect();
        const x = Math.max(0, e.clientX - rect.left);
        const newTime = viewStartTime + (x / pixelsPerSecond);
        playCursorTime = newTime;
        updateCursorVisual();
        // Si está reproduciendo, reiniciar desde la nueva posición
        if (isPlaying) {
            togglePlay(); // stop
            togglePlay(); // play desde playCursorTime
        }
    } else if (isDraggingTrack && isPlaying) {
        // FASE 2B — drag en caliente: el operador soltó después de mover
        // mixPointA. Seek inmediato sin pausar para que el cambio se
        // refleje en los audífonos al instante.
        applyHotSeekAfterDrag();
    }
    isMouseDown = false;
    isDraggingTrack = false;
});

// FIX BUG (desfase) — versión 3: seek inteligente con timers por player.
// Drags repetidos acumulaban setTimeouts de arranque diferido y al disparar
// todos juntos la pista se "repetía". Ahora UN timer máximo por playerId.
const __pendingStartTimers = {
    'trans-editor-a': null,
    'trans-editor-b': null
};
function cancelPendingStart(playerId) {
    if (__pendingStartTimers[playerId]) {
        clearTimeout(__pendingStartTimers[playerId]);
        __pendingStartTimers[playerId] = null;
    }
}

function applyHotSeekAfterDrag() {
    if (!isPlaying) return;
    const offsetA = bufferA.duration + playCursorTime;
    const offsetB = playCursorTime - mixPointA;
    const rustCmd = (p) => ipcRenderer.invoke('audio-engine-rust-command', p).catch(() => {});

    const smartUpdate = (playerId, offset, duration, path) => {
        if (offset >= 0 && offset < duration) {
            // PLAYING — cancelar timer pendiente, seek + play inmediato.
            cancelPendingStart(playerId);
            rustCmd({ cmd: 'seek', player: playerId, positionMs: Math.round(offset * 1000) });
            rustCmd({ cmd: 'play', player: playerId });
        } else if (offset < 0 && offset > -60) {
            // PENDING — cancelar timer previo antes de programar uno nuevo.
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
            // IDLE — cancelar timer y stop.
            cancelPendingStart(playerId);
            rustCmd({ cmd: 'stop', player: playerId });
        }
    };

    smartUpdate('trans-editor-a', offsetA, bufferA.duration, trackData.trackA);
    smartUpdate('trans-editor-b', offsetB, bufferB.duration, trackData.trackB);
}

// FASE 2A — detener los 2 players Rust antes de cerrar la ventana.
function stopAllRustPlayersOnExit() {
    try {
        ['trans-editor-a', 'trans-editor-b'].forEach(pid => {
            ipcRenderer.invoke('audio-engine-rust-command', { cmd: 'stop', player: pid }).catch(() => {});
        });
    } catch (err) {}
}
window.addEventListener('beforeunload', stopAllRustPlayersOnExit);

// Bug 1 fix: mouseleave en viewport para soltar el drag
viewport.addEventListener('mouseleave', () => {
    if (isDraggingTrack) {
        isDraggingTrack = false;
    }
});

// Bug 1 fix: blur como respaldo final
window.addEventListener('blur', () => {
    isMouseDown = false;
    isDraggingTrack = false;
});

scrollSlider.addEventListener('input', (e) => {
    viewStartTime = parseFloat(e.target.value);
    drawAll();
});

// Bug 4 fix: función para actualizar el estado visual del botón Play
function updatePlayBtnVisual() {
    const btn = document.getElementById('btn-play-pause');
    if (btn) btn.innerText = isPlaying ? '⏸' : '▶';
}

function togglePlay() {
    if (isPlaying) {
        // WEBAUDIO_DISABLED_BEGIN
        // if(sourceA) { try { sourceA.stop(); } catch(e){} sourceA.disconnect(); sourceA = null; }
        // if(sourceB) { try { sourceB.stop(); } catch(e){} sourceB.disconnect(); sourceB = null; }
        // WEBAUDIO_DISABLED_END

        // RUST_ENGINE: Detener los 2 players de la transición
        delayTimeouts.forEach(t => clearTimeout(t));
        delayTimeouts = [];
        // FIX BUG: limpiar también los timers individuales por player que
        // mantenga applyHotSeekAfterDrag — sin esto quedaban timers vivos
        // tras un stop manual.
        if (typeof __pendingStartTimers !== 'undefined') {
            Object.keys(__pendingStartTimers).forEach(pid => {
                if (__pendingStartTimers[pid]) {
                    clearTimeout(__pendingStartTimers[pid]);
                    __pendingStartTimers[pid] = null;
                }
            });
        }
        ['trans-editor-a', 'trans-editor-b'].forEach(pid => {
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
        // sourceA = audioCtx.createBufferSource(); ...
        // WEBAUDIO_DISABLED_END

        // RUST_ENGINE: Reproducir Track A y Track B sincronizados
        const offsetA = bufferA.duration + playCursorTime;
        const offsetB = playCursorTime - mixPointA;
        const startSession = ++playSession;

        const rustCmd = (payload) =>
            ipcRenderer.invoke('audio-engine-rust-command', payload).catch(() => {});

        // Track A
        if (offsetA >= 0 && offsetA < bufferA.duration) {
            rustCmd({ cmd: 'loadAudio', player: 'trans-editor-a', path: trackData.trackA, gain: 1.0, bus: 'cue' })
                .then(() => rustCmd({ cmd: 'seek', player: 'trans-editor-a', positionMs: Math.round(offsetA * 1000) }))
                .then(() => { if (isPlaying && playSession === startSession) rustCmd({ cmd: 'play', player: 'trans-editor-a' }); });
        }

        // Track B
        if (offsetB >= 0 && offsetB < bufferB.duration) {
            rustCmd({ cmd: 'loadAudio', player: 'trans-editor-b', path: trackData.trackB, gain: 1.0, bus: 'cue' })
                .then(() => rustCmd({ cmd: 'seek', player: 'trans-editor-b', positionMs: Math.round(offsetB * 1000) }))
                .then(() => { if (isPlaying && playSession === startSession) rustCmd({ cmd: 'play', player: 'trans-editor-b' }); });
        } else if (offsetB < 0) {
            const delayMs = Math.abs(offsetB) * 1000;
            rustCmd({ cmd: 'loadAudio', player: 'trans-editor-b', path: trackData.trackB, gain: 1.0, bus: 'cue' });
            const t = setTimeout(() => {
                if (isPlaying && playSession === startSession) rustCmd({ cmd: 'play', player: 'trans-editor-b' });
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
    // FIX BUG (drag en caliente saltaba al lugar del play original): el cursor
    // visual avanzaba con una variable local `currentT` pero la global
    // `playCursorTime` NUNCA se actualizaba — quedaba congelada en el valor
    // del momento de dar play. Cuando `applyHotSeekAfterDrag()` recalculaba
    // los offsets usaba ese valor viejo → seek al lugar inicial.
    // Solución: actualizar la global, igual que jingle_editor (que funciona).
    playCursorTime = playStartCursorTime + (performance.now() - playStartMs) / 1000;
    let px = (playCursorTime - viewStartTime) * pixelsPerSecond;
    cursorEl.style.left = `${px}px`;
    // Bug 3 fix: auto-scroll más suave cuando el cursor alcanza el 80% del viewport
    if (px > viewportWidth * 0.8) {
        viewStartTime += (viewportWidth * 0.5) / pixelsPerSecond;
        scrollSlider.value = viewStartTime;
        drawAll();
    }
    if (playCursorTime > Math.max(0, mixPointA + bufferB.duration)) { togglePlay(); return; }
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

// FASE 2A — Cancelar: stop a los 2 players Rust antes de cerrar.
document.getElementById('btn-cancel').addEventListener('click', () => {
    stopAllRustPlayersOnExit();
    window.close();
});
// FASE 2A — Guardar: stop a los players + IPC de guardado.
document.getElementById('btn-save').addEventListener('click', () => {
    stopAllRustPlayersOnExit();
    ipcRenderer.send('save-transition', { trackA: trackData.trackA, mixPoint: (bufferA.duration + mixPointA).toFixed(3) });
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
