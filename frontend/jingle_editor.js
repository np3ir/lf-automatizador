const { ipcRenderer } = require('electron');
const fs = require('fs');
const { createEditorOutputRouter } = require('./editor_audio_output');
const { createMeteringAnalyser, startCueVuMeter } = require('./audio_metering');

const audioCtx = new AudioContext({ latencyHint: 'interactive' });
const { outputNode: editorOutputNode, applyRouting: applyEditorAudioRouting, ensurePreviewPlayback: ensureEditorPreviewPlayback } = createEditorOutputRouter(audioCtx);
const editorCueAnalyser = createMeteringAnalyser(audioCtx, editorOutputNode, 1024);
const stopEditorVuMeter = startCueVuMeter(ipcRenderer, editorCueAnalyser, 'jingle-editor');
let bufferA, bufferJ, bufferB, trackData;
const waveformPeaksCache = new WeakMap();
let pixelsPerSecond = 50;
let viewportWidth = 0;
let viewStartTime = -15; 
let mixPointA = -10; 
let mixPointB_Abs = -5; 

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

let sourceA, sourceJ, sourceB, animFrameId;
let isPlaying = false;
let playCursorTime = -15;
let playStartTimeAbs = 0;

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
        bufferA = await decodeAudioFile(data.trackA);
        bufferJ = await decodeAudioFile(data.jingle);
        bufferB = await decodeAudioFile(data.trackB);
        document.getElementById('loading').style.display = 'none';
        handleResize();
    } catch (err) { window.close(); }
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
    const peaks = getWaveformPeaks(buffer);
    const binsPerSecond = peaks.bins / buffer.duration;
    const binsPerPixel = binsPerSecond / pixelsPerSecond;
    const amp = ctx.canvas.height / 2;
    ctx.fillStyle = color;
    for (let x = 0; x < viewportWidth; x++) {
        let actualX = x - startX; if (actualX < 0) continue;
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
    }
    isMouseDown = false; dragTarg = null;
});

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

function togglePlay() {
    if (isPlaying) {
        [sourceA, sourceJ, sourceB].forEach(s => { if(s){ try { s.stop(); } catch(e){} s.disconnect(); } });
        sourceA = null; sourceJ = null; sourceB = null;
        cancelAnimationFrame(animFrameId);
        isPlaying = false;
    } else {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        ensureEditorPreviewPlayback();
        playStartTimeAbs = audioCtx.currentTime;
        sourceA = audioCtx.createBufferSource(); sourceA.buffer = bufferA; sourceA.connect(editorOutputNode);
        sourceJ = audioCtx.createBufferSource(); sourceJ.buffer = bufferJ; sourceJ.connect(editorOutputNode);
        sourceB = audioCtx.createBufferSource(); sourceB.buffer = bufferB; sourceB.connect(editorOutputNode);
        let offA = bufferA.duration + playCursorTime; if (offA >= 0 && offA < bufferA.duration) sourceA.start(0, offA);
        let offJ = playCursorTime - mixPointA; if (offJ >= 0 && offJ < bufferJ.duration) sourceJ.start(0, offJ); else if (offJ < 0) sourceJ.start(audioCtx.currentTime + Math.abs(offJ), 0);
        let offB = playCursorTime - mixPointB_Abs; if (offB >= 0 && offB < bufferB.duration) sourceB.start(0, offB); else if (offB < 0) sourceB.start(audioCtx.currentTime + Math.abs(offB), 0);
        isPlaying = true; animLoop();
    }
    updatePlayBtnVisual();
}

function animLoop() {
    if (!isPlaying) return;
    playCursorTime += (audioCtx.currentTime - playStartTimeAbs); playStartTimeAbs = audioCtx.currentTime;
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

document.getElementById('btn-cancel').addEventListener('click', () => window.close());
document.getElementById('btn-save').addEventListener('click', () => {
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
