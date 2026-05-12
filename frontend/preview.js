const { ipcRenderer } = require('electron');
const path = require('path');
const url = require('url');
const { createEditorOutputRouter } = require('./editor_audio_output');
const { createMeteringAnalyser, startCueVuMeter } = require('./audio_metering');

const audio = document.getElementById('preview-audio');
const titleEl = document.getElementById('preview-title');
const progressBg = document.getElementById('preview-progress-bg');
const progressFill = document.getElementById('preview-progress-fill');
const currentEl = document.getElementById('preview-current');
const totalEl = document.getElementById('preview-total');
const btnStop = document.getElementById('btn-preview-stop');
const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
const { outputNode: previewOutputNode, applyRouting: applyPreviewRouting, ensurePreviewPlayback } = createEditorOutputRouter(audioCtx);
const previewSource = audioCtx.createMediaElementSource(audio);
const previewAnalyser = createMeteringAnalyser(audioCtx, previewSource, 1024);
previewSource.connect(previewOutputNode);
const stopPreviewVuMeter = startCueVuMeter(ipcRenderer, previewAnalyser, 'preview');

applyPreviewRouting();

ipcRenderer.on('settings-updated', () => {
    applyPreviewRouting();
});

// 2. FORMATEADOR DE TIEMPO
function formatTime(seconds) {
    if (isNaN(seconds)) return "00:00";
    let m = Math.floor(seconds / 60).toString().padStart(2, '0');
    let s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// 3. RECIBIR EL ARCHIVO A REPRODUCIR DESDE EL PROGRAMA PRINCIPAL
ipcRenderer.on('load-preview-track', (e, filePath) => {
    
    // Si había algo sonando antes, lo detenemos y limpiamos la barra visualmente
    audio.pause();
    audio.currentTime = 0;
    progressFill.style.width = '0%';
    currentEl.innerText = "00:00";
    titleEl.style.color = "#ffffff";

    // Mostrar solo el nombre del archivo
    titleEl.innerText = path.basename(filePath);
    
    // Cargar y reproducir la nueva pista
    audio.src = url.pathToFileURL(filePath).href;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    ensurePreviewPlayback();
    audio.play().catch(err => {
        titleEl.innerText = "Error al reproducir formato.";
        titleEl.style.color = "#e74c3c";
    });
});

// 4. ANIMAR BARRA Y RELOJES
audio.addEventListener('timeupdate', () => {
    currentEl.innerText = formatTime(audio.currentTime);
    totalEl.innerText = formatTime(audio.duration);
    
    if (audio.duration) {
        let percent = (audio.currentTime / audio.duration) * 100;
        progressFill.style.width = `${percent}%`;
    }
});

// Cargar la duración total rápido
audio.addEventListener('loadedmetadata', () => {
    totalEl.innerText = formatTime(audio.duration);
});

// 5. CIERRE AUTOMÁTICO AL TERMINAR LA CANCIÓN
audio.addEventListener('ended', () => {
    window.close();
});

// 6. BOTÓN STOP: CIERRE MANUAL
btnStop.addEventListener('click', () => {
    audio.pause();
    window.close();
});

window.addEventListener('beforeunload', () => {
    stopPreviewVuMeter();
});

// 7. HACER CLIC EN LA BARRA PARA ADELANTAR/ATRASAR
progressBg.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const rect = progressBg.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, clickX / rect.width));
    
    audio.currentTime = percent * audio.duration;
});
