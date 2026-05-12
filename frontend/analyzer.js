const { ipcRenderer } = require('electron');

// Función asíncrona por si el frontend la pide con 'await'
async function analyzeTrackBackground(filePath, audioCtx, targetDb) {
    // Si la piden en vivo, retornamos valores nulos para no bloquear y que se reproduzca
    // (El análisis real ahora se hace masivamente en la librería con FFmpeg)
    return { targetDb: targetDb, mixDuration: 0, duration: 0 };
}

// Obtener datos síncronos desde SQLite
function getTrackAnalysis(filePath) {
    try {
        const track = ipcRenderer.sendSync('get-track-analysis-sync', filePath);
        if (track) {
            return { targetDb: track.targetDb, mixDuration: track.mixDuration, duration: track.duration };
        }
        return null;
    } catch(e) {
        return null;
    }
}

module.exports = { analyzeTrackBackground, getTrackAnalysis };