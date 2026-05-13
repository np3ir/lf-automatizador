const { ipcRenderer } = require('electron');
const fs = require('fs');
const { createEditorOutputRouter } = require('./editor_audio_output');
const { createMeteringAnalyser, startCueVuMeter } = require('./audio_metering');

const audioCtx = new AudioContext({ latencyHint: 'interactive' });
const { outputNode: editorOutputNode, applyRouting: applyEditorAudioRouting, ensurePreviewPlayback: ensureEditorPreviewPlayback } = createEditorOutputRouter(audioCtx);
const editorCueAnalyser = createMeteringAnalyser(audioCtx, editorOutputNode, 1024);
const stopEditorVuMeter = startCueVuMeter(ipcRenderer, editorCueAnalyser, 'transition-editor');
let bufferA = null;
let bufferB = null;
let trackData = null;
const waveformPeaksCache = new WeakMap();

applyEditorAudioRouting();
ipcRenderer.on('settings-updated', () => {
    applyEditorAudioRouting();
});

window.addEventListener('beforeunload', () => {
    stopEditorVuMeter();
});

function nodeBufferToArrayBuffer(buffer) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function decodeAudioFile(filePath) {
    const fileData = await fs.promises.readFile(filePath);
    return audioCtx.decodeAudioData(nodeBufferToArrayBuffer(fileData));
}

let pixelsPerSecond = 50;
let viewportWidth = 0;
let viewStartTime = -15; 
let mixPointA = -5; 

let sourceA = null;
let sourceB = null;
let isPlaying = false;
let playCursorTime = -15; 
let playStartTimeAbs = 0; 
let animFrameId = null;

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
        bufferA = await decodeAudioFile(data.trackA);
        bufferB = await decodeAudioFile(data.trackB);
        document.getElementById('loading').style.display = 'none';
        handleResize();
    } catch (err) { window.close(); }
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
    const peaks = getWaveformPeaks(buffer);
    const binsPerSecond = peaks.bins / buffer.duration;
    const binsPerPixel = binsPerSecond / pixelsPerSecond;
    const amp = ctx.canvas.height / 2;
    ctx.fillStyle = color;
    for (let x = 0; x < ctx.canvas.width; x++) {
        let actualX = x - startX;
        if (actualX < 0) continue;
        let startBin = Math.floor(actualX * binsPerPixel);
        if (startBin >= peaks.bins) break;
        let endBin = Math.max(startBin + 1, Math.ceil((actualX + 1) * binsPerPixel));
        let min = 1.0, max = -1.0;
        for (let j = startBin; j < endBin && j < peaks.bins; j++) {
            const binMin = peaks.min[j];
            const binMax = peaks.max[j];
            if (binMin < min) min = binMin;
            if (binMax > max) max = binMax;
        }
        ctx.fillRect(x, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }
}

function getWaveformPeaks(buffer) {
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
        let binMin = 1;
        let binMax = -1;
        for (let i = start; i < end; i++) {
            const datum = rawData[i];
            if (datum < binMin) binMin = datum;
            if (datum > binMax) binMax = datum;
        }
        min[bin] = binMin;
        max[bin] = binMax;
    }
    const peaks = { min, max, bins };
    waveformPeaksCache.set(buffer, peaks);
    return peaks;
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
    }
    isMouseDown = false;
    isDraggingTrack = false;
});

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
        if(sourceA) { try { sourceA.stop(); } catch(e){} sourceA.disconnect(); sourceA = null; }
        if(sourceB) { try { sourceB.stop(); } catch(e){} sourceB.disconnect(); sourceB = null; }
        cancelAnimationFrame(animFrameId);
        isPlaying = false;
    } else {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        ensureEditorPreviewPlayback();
        playStartTimeAbs = audioCtx.currentTime;
        let offsetA = bufferA.duration + playCursorTime;
        let offsetB = playCursorTime - mixPointA;
        sourceA = audioCtx.createBufferSource(); sourceA.buffer = bufferA; sourceA.connect(editorOutputNode);
        sourceB = audioCtx.createBufferSource(); sourceB.buffer = bufferB; sourceB.connect(editorOutputNode);
        if (offsetA >= 0 && offsetA < bufferA.duration) sourceA.start(0, offsetA);
        if (offsetB >= 0 && offsetB < bufferB.duration) sourceB.start(0, offsetB);
        else if (offsetB < 0) sourceB.start(audioCtx.currentTime + Math.abs(offsetB), 0);
        isPlaying = true;
        animLoop();
    }
    updatePlayBtnVisual();
}

function animLoop() {
    if (!isPlaying) return;
    let currentT = playCursorTime + (audioCtx.currentTime - playStartTimeAbs);
    let px = (currentT - viewStartTime) * pixelsPerSecond;
    cursorEl.style.left = `${px}px`;
    // Bug 3 fix: auto-scroll más suave cuando el cursor alcanza el 80% del viewport
    if (px > viewportWidth * 0.8) {
        viewStartTime += (viewportWidth * 0.5) / pixelsPerSecond;
        scrollSlider.value = viewStartTime;
        drawAll();
    }
    if (currentT > Math.max(0, mixPointA + bufferB.duration)) { togglePlay(); return; }
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

document.getElementById('btn-cancel').addEventListener('click', () => window.close());
document.getElementById('btn-save').addEventListener('click', () => {
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
