const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

const configDir = path.join(__dirname, '..', 'config');
if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
const encoderPrefsPath = path.join(configDir, 'encoder_prefs.json');

let encPrefs = {
    type: 'icecast', ip: '', port: '', pass: '', mount: '', 
    source: 'master', mic: '', codec: 'aac', bitrate: '128', encoderProvider: 'auto', tapPoint: 'postFx'
};

if (fs.existsSync(encoderPrefsPath)) {
    try { encPrefs = { ...encPrefs, ...JSON.parse(fs.readFileSync(encoderPrefsPath, 'utf-8')) }; } 
    catch(e) {}
}

function normalizeEncoderPrefs(raw = {}) {
    const serverType = raw.serverType || raw.type || 'icecast';
    const password = raw.password || raw.pass || '';
    const micId = raw.micId || raw.mic || '';
    const bitrate = String(raw.bitrate || '128').replace(/[^\d]/g, '') || '128';
    const providerLower = String(raw.encoderProvider || 'auto').trim().toLowerCase();
    const encoderProvider = providerLower === 'rust' || providerLower === 'rustaudio' || providerLower === 'rustaudioengine'
        ? 'rust'
        : 'auto';
    return {
        ...raw,
        type: serverType,
        serverType,
        pass: password,
        password,
        mic: micId,
        micId,
        ip: String(raw.ip || '').trim(),
        port: String(raw.port || '').trim(),
        mount: String(raw.mount || '').trim(),
        source: raw.source === 'mic' ? 'mic' : 'master',
        tapPoint: raw.tapPoint === 'preFx' ? 'preFx' : 'postFx',
        codec: raw.codec === 'mp3' ? 'mp3' : 'aac',
        encoderProvider,
        bitrate
    };
}

encPrefs = normalizeEncoderPrefs(encPrefs);

function saveEncoderPrefs() {
    try {
        encPrefs = normalizeEncoderPrefs(encPrefs);
        fs.writeFileSync(encoderPrefsPath, JSON.stringify(encPrefs, null, 2));
    } catch(e) {}
}

const statusEl = document.getElementById('enc-status');
const timerEl = document.getElementById('enc-timer');
const logBox = document.getElementById('enc-log');
const btnConnect = document.getElementById('btn-connect');
const throughputCanvas = document.getElementById('enc-throughput-canvas');
const throughputValuesEl = document.getElementById('enc-throughput-values');
const throughputScaleEl = document.getElementById('enc-throughput-scale');
const encoderHealthLineEl = document.getElementById('enc-health-line');
const inputMeterEl = document.getElementById('enc-input-meter');
const inputMeterValuesEl = document.getElementById('enc-input-meter-values');
const inputMeterFillEl = document.getElementById('enc-input-meter-fill');
const throughputCtx = throughputCanvas ? throughputCanvas.getContext('2d') : null;

const typeSel = document.getElementById('enc-type');
const mountRow = document.getElementById('row-mount');
const sourceSel = document.getElementById('enc-source');
const micRow = document.getElementById('row-mic');
const micSel = document.getElementById('enc-mic');
const codecSel = document.getElementById('enc-codec');
const bitrateSel = document.getElementById('enc-bitrate'); const encoderProviderSel = document.getElementById('sel-encoder-provider');
const tapPointSel = document.getElementById('enc-tap-point');

let isConnected = false;
let intentionalStop = false;
let timerInterval = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let startTime = 0;
let micDevicesLoaded = false;
let currentEncoderStatus = 'disconnected';
let autoReconnectEnabled = false;
let throughputSamples = [];
let throughputPeakKbps = 0;
let throughputCurrentKbps = 0;
let throughputScaleKbps = 128;
let lastThroughputAt = 0;
let lastInputMeterAt = 0;
const THROUGHPUT_SAMPLE_LIMIT = 120;

function getConfiguredBitrateKbps() {
    const raw = bitrateSel ? bitrateSel.value : encPrefs.bitrate;
    const parsed = Number(String(raw || '').replace(/[^\d]/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 128;
}

function getThroughputScaleKbps() {
    const target = getConfiguredBitrateKbps();
    return Math.max(1, Math.ceil(Math.max(target, throughputPeakKbps, throughputCurrentKbps)));
}

function seedThroughputSamples() {
    throughputSamples = Array.from({ length: THROUGHPUT_SAMPLE_LIMIT }, () => 0);
}

function resetThroughputStats() {
    seedThroughputSamples();
    throughputPeakKbps = 0;
    throughputCurrentKbps = 0;
    throughputScaleKbps = getConfiguredBitrateKbps();
    lastThroughputAt = 0;
    if (throughputValuesEl) throughputValuesEl.textContent = 'Actual: -- kbps | Pico: -- kbps | Vel: --';
    if (throughputScaleEl) throughputScaleEl.textContent = `${formatKbps(throughputScaleKbps)} kbps`;
    if (encoderHealthLineEl) {
        encoderHealthLineEl.textContent = 'Esperando datos del encoder.';
        encoderHealthLineEl.classList.remove('warn');
    }
    drawThroughputGraph();
}

function resetInputMeter() {
    lastInputMeterAt = 0;
    if (inputMeterValuesEl) inputMeterValuesEl.textContent = 'Pico: -- dB | RMS: -- dB';
    if (inputMeterFillEl) inputMeterFillEl.style.width = '0%';
    if (inputMeterEl) inputMeterEl.classList.remove('warn');
}

function formatKbps(value) {
    if (!Number.isFinite(value) || value <= 0) return '--';
    return value >= 100 ? value.toFixed(0) : value.toFixed(1);
}

function drawThroughputGraph() {
    if (!throughputCtx || !throughputCanvas) return;
    const width = throughputCanvas.width;
    const height = throughputCanvas.height;
    const targetKbps = getConfiguredBitrateKbps();
    throughputScaleKbps = getThroughputScaleKbps();
    throughputCtx.clearRect(0, 0, width, height);
    throughputCtx.fillStyle = '#0b0d0f';
    throughputCtx.fillRect(0, 0, width, height);

    throughputCtx.strokeStyle = '#172531';
    throughputCtx.lineWidth = 1;
    for (let line = 1; line < 5; line++) {
        const y = Math.round((height / 5) * line) + 0.5;
        throughputCtx.beginPath();
        throughputCtx.moveTo(0, y);
        throughputCtx.lineTo(width, y);
        throughputCtx.stroke();
    }
    for (let line = 1; line < 8; line++) {
        const x = Math.round((width / 8) * line) + 0.5;
        throughputCtx.beginPath();
        throughputCtx.moveTo(x, 0);
        throughputCtx.lineTo(x, height);
        throughputCtx.stroke();
    }

    throughputCtx.strokeStyle = '#20394a';
    for (let line = 1; line < 4; line++) {
        const y = Math.round((height / 4) * line) + 0.5;
        throughputCtx.beginPath();
        throughputCtx.moveTo(0, y);
        throughputCtx.lineTo(width, y);
        throughputCtx.stroke();
    }

    const targetY = height - Math.min(1, targetKbps / throughputScaleKbps) * height;
    throughputCtx.strokeStyle = '#34495e';
    throughputCtx.setLineDash([4, 4]);
    throughputCtx.beginPath();
    throughputCtx.moveTo(0, targetY);
    throughputCtx.lineTo(width, targetY);
    throughputCtx.stroke();
    throughputCtx.setLineDash([]);

    throughputCtx.fillStyle = '#7f8c8d';
    throughputCtx.font = '9px Consolas, monospace';
    throughputCtx.textAlign = 'right';
    throughputCtx.fillText(`${formatKbps(targetKbps)} kbps`, width - 4, Math.max(10, targetY - 3));

    if (throughputSamples.length < 2) return;
    const step = width / Math.max(1, throughputSamples.length - 1);
    throughputCtx.strokeStyle = '#2ecc71';
    throughputCtx.lineWidth = 2;
    throughputCtx.beginPath();
    throughputSamples.forEach((sample, index) => {
        const x = index * step;
        const y = height - Math.min(1, sample / throughputScaleKbps) * height;
        if (index === 0) throughputCtx.moveTo(x, y);
        else throughputCtx.lineTo(x, y);
    });
    throughputCtx.stroke();

    const cursorX = width - 1.5;
    throughputCtx.strokeStyle = '#00a8ff';
    throughputCtx.globalAlpha = lastThroughputAt ? 0.65 : 0.25;
    throughputCtx.beginPath();
    throughputCtx.moveTo(cursorX, 0);
    throughputCtx.lineTo(cursorX, height);
    throughputCtx.stroke();
    throughputCtx.globalAlpha = 1;
}

function updateThroughputStats(report = {}) {
    const bitrateKbps = Number(report.bitrateKbps);
    if (!Number.isFinite(bitrateKbps) || bitrateKbps <= 0) return;
    lastThroughputAt = Date.now();
    throughputCurrentKbps = bitrateKbps;
    throughputPeakKbps = Math.max(throughputPeakKbps, bitrateKbps);
    throughputScaleKbps = getThroughputScaleKbps();
    throughputSamples.push(bitrateKbps);
    if (throughputSamples.length > THROUGHPUT_SAMPLE_LIMIT) throughputSamples.shift();

    const speedText = Number.isFinite(report.speed) ? `${report.speed.toFixed(2)}x` : '--';
    if (throughputValuesEl) {
        throughputValuesEl.textContent = `Actual: ${formatKbps(bitrateKbps)} kbps | Pico: ${formatKbps(throughputPeakKbps)} kbps | Vel: ${speedText}`;
    }
    if (throughputScaleEl) throughputScaleEl.textContent = `${formatKbps(throughputScaleKbps)} kbps`;
    if (encoderHealthLineEl) {
        encoderHealthLineEl.textContent = `Stream estable. Ultimo dato FFmpeg: ${report.ffmpegTime || '--'}`;
        encoderHealthLineEl.classList.remove('warn');
    }
    drawThroughputGraph();
}

function updateCaptureHealth(report = {}) {
    if (!encoderHealthLineEl) return;
    const reason = report.reason || 'estado';
    if (reason === 'chunk-gap') {
        encoderHealthLineEl.textContent = `Aviso captura: pausa ${Math.round(report.gapMs || 0)} ms entre bloques PCM.`;
        encoderHealthLineEl.classList.add('warn');
    } else if (reason === 'minute') {
        const maxGap = Number.isFinite(report.maxGapMs) ? `${Math.round(report.maxGapMs)} ms` : '--';
        encoderHealthLineEl.textContent = `Captura OK. Pausa maxima local: ${maxGap}.`;
        encoderHealthLineEl.classList.remove('warn');
    }
}

function formatDb(value) {
    const db = Number(value);
    if (!Number.isFinite(db) || db <= -119) return '-inf';
    return `${db.toFixed(1)} dB`;
}

function updateInputMeter(report = {}) {
    lastInputMeterAt = Date.now();
    const peakDb = Number(report.peakDb);
    const rmsDb = Number(report.rmsDb);
    const safePeakDb = Number.isFinite(peakDb) ? Math.max(-60, Math.min(0, peakDb)) : -60;
    const percent = Math.max(0, Math.min(100, ((safePeakDb + 60) / 60) * 100));
    const silentMs = Number(report.silentMs) || 0;
    const source = report.captureProvider || report.source || 'fuente';
    const silent = report.hasSignal === false && silentMs > 4000;

    if (inputMeterFillEl) inputMeterFillEl.style.width = `${percent.toFixed(1)}%`;
    if (inputMeterValuesEl) {
        const silentText = silent ? ` | silencio ${Math.round(silentMs / 1000)}s` : '';
        inputMeterValuesEl.textContent = `Pico: ${formatDb(peakDb)} | RMS: ${formatDb(rmsDb)} | ${source}${silentText}`;
    }
    if (inputMeterEl) inputMeterEl.classList.toggle('warn', silent);
}

function encLog(msg, type = 'info') {
    const d = new Date().toLocaleTimeString('es-PE', { hour12: false });
    let color = '#ccc';
    if (type === 'error') color = '#e74c3c';
    if (type === 'success') color = '#2ecc71';
    if (type === 'warn') color = '#f1c40f';
    
    const row = document.createElement('div');
    row.style.color = color;
    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = `[${d}]`;
    row.appendChild(time);
    row.appendChild(document.createTextNode(` ${msg}`));
    logBox.appendChild(row);
    while (logBox.children.length > 500) logBox.removeChild(logBox.firstChild);
    logBox.scrollTop = logBox.scrollHeight;
}

function clearReconnectTimer() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
}

function scheduleReconnect() {
    if (!autoReconnectEnabled || intentionalStop || reconnectTimer) return;
    reconnectAttempts++;
    const delaySec = Math.min(60, reconnectAttempts <= 1 ? 5 : 5 * Math.pow(2, Math.min(4, reconnectAttempts - 1)));
    encLog(`Reconectando en ${delaySec} segundos... intento ${reconnectAttempts}.`, "error");
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (autoReconnectEnabled && !intentionalStop) startConnection({ isRetry: true });
    }, delaySec * 1000);
}

// ðŸ”¥ CARGAR MICRÃ“FONOS SOLO CUANDO SE NECESITA
async function loadMicrophones() {
    if (micDevicesLoaded) return;

    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });

        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter(d => d.kind === 'audioinput');

        micSel.innerHTML = '';

        mics.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.deviceId; 
            opt.text = m.label || `MicrÃ³fono ${m.deviceId.substring(0,5)}`;
            micSel.appendChild(opt);
        });

        if (encPrefs.mic && Array.from(micSel.options).some(o => o.value === encPrefs.mic)) {
            micSel.value = encPrefs.mic;
        }

        micDevicesLoaded = true;
        encLog("MicrÃ³fonos cargados correctamente.", "success");

    } catch (e) {
        encLog("Error al acceder a micrÃ³fonos.", "error");
    }
}

document.getElementById('tab-btn-status').addEventListener('click', (e) => {
    document.querySelectorAll('.enc-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.enc-pane').forEach(p => p.classList.remove('active'));
    e.target.classList.add('active');
    document.getElementById('tab-status').classList.add('active');
});

document.getElementById('tab-btn-config').addEventListener('click', (e) => {
    document.querySelectorAll('.enc-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.enc-pane').forEach(p => p.classList.remove('active'));
    e.target.classList.add('active');
    document.getElementById('tab-config').classList.add('active');
});

typeSel.addEventListener('change', () => { 
    mountRow.style.display = typeSel.value === 'icecast' ? 'flex' : 'none'; 
});

sourceSel.addEventListener('change', async () => { 
    const isMic = sourceSel.value === 'mic';
    micRow.style.display = isMic ? 'flex' : 'none';

    if (isMic) {
        await loadMicrophones(); // ðŸ”¥ SOLO AQUÃ
    }
});

if (bitrateSel) {
    bitrateSel.addEventListener('change', () => {
        if (!isConnected) resetThroughputStats();
        else drawThroughputGraph();
    });
}

// Poblar inputs
document.getElementById('enc-ip').value = encPrefs.ip;
document.getElementById('enc-port').value = encPrefs.port;
document.getElementById('enc-pass').value = encPrefs.pass;
document.getElementById('enc-mount').value = encPrefs.mount;
typeSel.value = encPrefs.type;
sourceSel.value = encPrefs.source;
codecSel.value = encPrefs.codec;
bitrateSel.value = encPrefs.bitrate; if (encoderProviderSel) encoderProviderSel.value = encPrefs.encoderProvider || 'auto';
if (tapPointSel) tapPointSel.value = encPrefs.tapPoint || 'postFx';

// FIX BUG ENCODER PRE-FX: notificar al renderer principal del tapPoint guardado
// en cuanto se abre la ventana del encoder. Setear `tapPointSel.value` no
// dispara el evento `change`, así que el motor Rust se quedaba con el default
// postFx aunque la UI mostrara "Pre-FX". Este send arranca el listener
// `encoder-tap-point-changed` del renderer y propaga el valor real al motor.
ipcRenderer.send('encoder-tap-point-changed', { tapPoint: encPrefs.tapPoint || 'postFx' });

// FIX: cambio de Pre-FX/Post-FX en caliente. Cuando el operador conmuta el
// selector tapPoint, persistimos la preferencia Y notificamos al renderer
// principal para que reenvíe el `route` al motor Rust con el nuevo sourceMode.
// El motor cambia el atómico `encoder_tap_mode` sample-by-sample y el chunk
// PCM siguiente sale del ring del modo nuevo — sin reiniciar el encoder.
if (tapPointSel) {
    tapPointSel.addEventListener('change', () => {
        encPrefs.tapPoint = tapPointSel.value === 'preFx' ? 'preFx' : 'postFx';
        saveEncoderPrefs();
        // Notifica al renderer principal vía IPC que la preferencia cambió.
        // El renderer recibe 'encoder-tap-point-changed' y re-emite el route.
        ipcRenderer.send('encoder-tap-point-changed', { tapPoint: encPrefs.tapPoint });
    });
}

typeSel.dispatchEvent(new Event('change'));
sourceSel.dispatchEvent(new Event('change'));

function updateTimer() {
    const now = Date.now();
    const diffMs = now - startTime;
    const totalSecs = Math.floor(diffMs / 1000);
    const h = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSecs % 60).toString().padStart(2, '0');
    timerEl.innerText = `${h}:${m}:${s}`;
}

function startConnection(options = {}) {
    clearReconnectTimer();
    const password = document.getElementById('enc-pass').value.trim();
    const bitrate = bitrateSel.value.replace(/[^\d]/g, ''); const encoderProvider = encoderProviderSel ? encoderProviderSel.value : 'auto';
    const config = {
        serverType: typeSel.value,
        type: typeSel.value,
        ip: document.getElementById('enc-ip').value.trim(),
        port: document.getElementById('enc-port').value.trim(),
        password,
        pass: password,
        mount: document.getElementById('enc-mount').value.trim(),
        source: sourceSel.value,
        micId: micSel.value,
        mic: micSel.value,
        codec: codecSel.value,
        bitrate,
        encoderProvider,
        tapPoint: tapPointSel?.value === 'preFx' ? 'preFx' : 'postFx'
    };

    const portNum = Number(config.port);
    if (!config.ip || !Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
        encLog("Faltan IP/host o el puerto no es valido.", "error");
        document.getElementById('tab-btn-config').click(); 
        return;
    }
    if (!config.password) {
        encLog("Falta la contrasena del servidor.", "error");
        document.getElementById('tab-btn-config').click();
        return;
    }
    if (config.serverType === 'icecast' && !config.mount) {
        encLog("Falta el punto de montaje para Icecast.", "error");
        document.getElementById('tab-btn-config').click();
        return;
    }
    if (config.source === 'mic' && !config.micId) {
        encLog("Selecciona una entrada de audio externa.", "error");
        document.getElementById('tab-btn-config').click();
        return;
    }

    encPrefs = normalizeEncoderPrefs({ ...encPrefs, ...config });
    saveEncoderPrefs();
    autoReconnectEnabled = true;
    intentionalStop = false;
    if (!options.isRetry) {
        reconnectAttempts = 0;
        resetThroughputStats();
    }

    ipcRenderer.send('start-encoder', config);

    statusEl.innerText = 'CONECTANDO...';
    statusEl.className = 'enc-status connecting';
    btnConnect.innerText = '\u23f3 CANCELAR CONEXION...';
    isConnected = true;

    encLog(options.isRetry ? "Reintentando conexion del encoder..." : "Iniciando encoder sin interrumpir audio principal...", "warn");
}

btnConnect.addEventListener('click', () => {
    if (isConnected) {
        intentionalStop = true;
        autoReconnectEnabled = false;
        clearReconnectTimer();
        ipcRenderer.send('stop-encoder');
        encLog("Deteniendo emisiÃ³n...", "warn");
    } else {
        autoReconnectEnabled = true;
        intentionalStop = false;
        startConnection();
    }
});

ipcRenderer.on('encoder-status', (e, status) => {
    currentEncoderStatus = status;
    if (status === 'live') {
        statusEl.innerText = 'EN VIVO (ON AIR)';
        statusEl.className = 'enc-status live';
        btnConnect.innerText = '\u23f9 DESCONECTAR EMISI\u00d3N';
        btnConnect.className = 'enc-btn stop';

        isConnected = true;
        autoReconnectEnabled = true;
        intentionalStop = false;
        reconnectAttempts = 0;
        clearReconnectTimer();
        encLog("Conectado correctamente.", "success");

        if (!timerInterval) {
            startTime = Date.now();
            timerInterval = setInterval(updateTimer, 1000);
        }

    } else if (status === 'connecting') {
        statusEl.innerText = 'CONECTANDO...';
        statusEl.className = 'enc-status connecting';
        btnConnect.innerText = 'CANCELAR CONEXION...';
        isConnected = true;
    } else if (status === 'disconnected') {
        statusEl.innerText = 'DESCONECTADO';
        statusEl.className = 'enc-status';
        btnConnect.innerText = '\u{1f4fb} CONECTAR SERVIDOR';
        btnConnect.className = 'enc-btn';

        isConnected = false;
        clearInterval(timerInterval);
        timerInterval = null;
        timerEl.innerText = '00:00:00';
        if (intentionalStop || !autoReconnectEnabled) {
            resetThroughputStats();
            resetInputMeter();
        }

        if (autoReconnectEnabled && !intentionalStop) scheduleReconnect();
    }
});

ipcRenderer.on('encoder-error', (e, msg) => {
    encLog(`Error: ${msg}`, "error");
});

setInterval(() => {
    if (currentEncoderStatus !== 'live' || !lastThroughputAt || !encoderHealthLineEl) return;
    const staleMs = Date.now() - lastThroughputAt;
    if (staleMs > 15000) {
        encoderHealthLineEl.textContent = `Aviso: FFmpeg no reporta progreso hace ${Math.round(staleMs / 1000)} s.`;
        encoderHealthLineEl.classList.add('warn');
    }
}, 5000);

ipcRenderer.on('encoder-throughput', (e, report) => {
    updateThroughputStats(report);
});

ipcRenderer.on('encoder-capture-health', (e, report) => {
    updateCaptureHealth(report);
});

ipcRenderer.on('encoder-input-meter', (e, report) => {
    updateInputMeter(report);
});

resetThroughputStats();
resetInputMeter();
encLog("Encoder listo.", "info");
