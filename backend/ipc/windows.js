// FASE D · sub-paso 8.2 — Encoder ahora va por `engine.attachPcmConsumer`
// (modo tap nativo desde el motor Rust). Los antiguos `RustPcmBridgeEncoderSource`
// y `runRustPcmBridgeFfmpegSmokeTest` eran código muerto que nunca se llegó
// a implementar — eliminados de los imports.

module.exports = function(context) {
    const { ipcMain, dialog, screen, openCommercialManagerWindow, BrowserWindow, writeLog, path, configDir, fs, cp, ffmpegPath } = context;

    function setEncoderStatus(status) {
        context.encoderRuntimeStatus = status;
        if (context.encoderWindow && !context.encoderWindow.isDestroyed()) context.encoderWindow.webContents.send('encoder-status', status);
        if (context.mainWindow && !context.mainWindow.isDestroyed()) context.mainWindow.webContents.send('encoder-global-status', status);
    }

    function readAudioEngineMode() {
        try {
            const prefsPath = path.join(configDir, 'general_settings.json');
            const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf-8'));
            return prefs.audioEngineMode || 'webAudio';
        } catch (err) {
            return 'webAudio';
        }
    }

    function getRustPcmReadiness() {
        const encoder = context.rustAudioEngine?.lastStatus?.encoder || {};
        const ready = encoder.pcmBridgeReady === true
            || (encoder.rustPcmReady === true
                && (encoder.owner === 'rustAudioEngine' || encoder.captureProvider === 'rustAudioEngine'));
        return {
            ready,
            reason: ready ? '' : (encoder.pcmBridgeReason || encoder.fallbackReason || 'rust-master-pcm-pending'),
            bridgeMode: encoder.pcmBridgeMode || 'planned',
            captureFormat: encoder.captureFormat || 'pcm_s16le',
            sampleRate: Number(encoder.sampleRate) || 44100,
            transport: encoder.transport || 'ffmpeg'
        };
    }

    function resolveEncoderProvider(value, isMaster) {
        const normalized = String(value || 'auto').trim();
        const lower = normalized.toLowerCase();
        if (!isMaster) return 'mediaInputRenderer';
        if (readAudioEngineMode() === 'rustAudio') return 'rustAudioEngine';
        if (['rust', 'rustaudio', 'rustaudioengine'].includes(lower)) return 'rustAudioEngine';
        if (['webaudio', 'webaudiorenderer'].includes(lower)) return 'webAudioRenderer';
        if (lower === 'auto' && readAudioEngineMode() === 'rustAudio') return 'rustAudioEngine';
        return 'webAudioRenderer';
    }

    function buildEncoderSourceContract(config = {}, active = false) {
        const normalized = normalizeEncoderConfig(config || context.activeEncoderConfig || {});
        const isMaster = normalized.source !== 'mic';
        const requestedOwner = resolveEncoderProvider(normalized.encoderProvider, isMaster);
        const rustPcm = getRustPcmReadiness();
        const liveRustBridgeReady = requestedOwner === 'rustAudioEngine' && isMaster;
        const rustPcmReady = requestedOwner === 'rustAudioEngine' && (rustPcm.ready || liveRustBridgeReady);
        const owner = requestedOwner === 'rustAudioEngine' && !rustPcmReady
            ? 'webAudioRenderer'
            : requestedOwner;
        const fallbackReason = requestedOwner !== owner
            ? rustPcm.reason
            : '';
        const pcmBridgeMode = rustPcm.ready ? rustPcm.bridgeMode : (liveRustBridgeReady ? 'experimental-live-mix' : rustPcm.bridgeMode);
        const pcmBridgeReason = rustPcm.ready ? rustPcm.reason : (liveRustBridgeReady ? '' : rustPcm.reason);
        const transport = rustPcmReady
            ? (rustPcm.transport && rustPcm.transport !== 'ffmpeg' ? rustPcm.transport : 'ffmpeg-rust-pcm-bridge')
            : 'ffmpeg';
        return {
            active: !!active,
            source: isMaster ? 'master' : 'mic',
            owner,
            requestedOwner,
            captureProvider: owner,
            encoderProvider: normalized.encoderProvider,
            tapPoint: normalized.tapPoint,
            rustPcmReady,
            pcmBridgeReady: rustPcmReady,
            pcmBridgeMode,
            pcmBridgeReason,
            fallbackReason,
            captureFormat: config.captureFormat || context.encoderSourceContract?.captureFormat || (isMaster ? 'pcm_s16le' : 'webm-opus'),
            sampleRate: Number(config.sampleRate) || Number(context.encoderSourceContract?.sampleRate) || (isMaster ? rustPcm.sampleRate : 0),
            transport
        };
    }

    function notifyRustEncoder(action, config = {}) {
        const active = action === 'start';
        const contract = buildEncoderSourceContract(config, active);
        const health = {
            bitrateKbps: Number(config.bitrateKbps) || Number(context.encoderSourceContract?.bitrateKbps) || 0,
            speed: Number(config.speed) || Number(context.encoderSourceContract?.speed) || 0,
            ffmpegTime: config.ffmpegTime || context.encoderSourceContract?.ffmpegTime || '',
            maxGapMs: Number(config.maxGapMs) || Number(context.encoderSourceContract?.maxGapMs) || 0,
            gapWarnings: Number(config.gapWarnings) || Number(context.encoderSourceContract?.gapWarnings) || 0
        };
        const previous = context.encoderSourceContract || {};
        const signature = JSON.stringify({ action, ...contract, ...health });
        const healthOnly = action === 'health';
        const now = Date.now();
        if (action === 'start') context.lastRustEncoderStopAt = 0;
        if (action === 'stop') {
            if (context.lastRustEncoderStopAt && now - context.lastRustEncoderStopAt < 5000) return;
            context.lastRustEncoderStopAt = now;
        }
        if (previous.signature === signature) return;
        if (healthOnly && context.lastRustEncoderHealthAt && now - context.lastRustEncoderHealthAt < 15000) {
            context.encoderSourceContract = { ...previous, ...contract, ...health, active: previous.active === true, signature };
            return;
        }
        if (healthOnly) context.lastRustEncoderHealthAt = now;
        context.encoderSourceContract = { ...contract, ...health, active: healthOnly ? previous.active === true : contract.active, signature };
        if (!context.rustAudioEngine?.command) return;
        context.rustAudioEngine.command({
            cmd: 'encoder',
            action: healthOnly ? 'status' : action,
            source: contract.source,
            owner: contract.owner,
            requestedOwner: contract.requestedOwner,
            captureProvider: contract.captureProvider,
            encoderProvider: contract.encoderProvider,
            tapPoint: contract.tapPoint,
            rustPcmReady: contract.rustPcmReady,
            pcmBridgeReady: contract.pcmBridgeReady,
            pcmBridgeMode: contract.pcmBridgeMode,
            pcmBridgeReason: contract.pcmBridgeReason,
            fallbackReason: contract.fallbackReason,
            captureFormat: contract.captureFormat,
            sampleRate: contract.sampleRate,
            transport: contract.transport,
            bitrateKbps: health.bitrateKbps,
            speed: health.speed,
            ffmpegTime: health.ffmpegTime,
            maxGapMs: health.maxGapMs,
            gapWarnings: health.gapWarnings
        }).catch(err => writeLog(`RustAudio encoder ${action}: ${err.message || err}`));
    }

    function killFfmpegProcess(reason = '', options = {}) {
        const proc = context.ffmpegProcess;
        if (!proc) return;
        logEncoderWriteStats('stop');
        stopRustPcmEncoderSource();
        notifyRustEncoder('stop', context.encoderSourceContract || context.activeEncoderConfig || {});
        try {
            if (proc.stdin && !proc.stdin.destroyed) proc.stdin.destroy();
        } catch (err) {}
        try { proc.kill('SIGKILL'); } catch (err) {
            try { proc.kill(); } catch (innerErr) {}
        }
        context.ffmpegProcess = null;
        if (!options.suppressStatus) setEncoderStatus('disconnected');
        if (!options.suppressStopCapture && context.mainWindow && !context.mainWindow.isDestroyed()) context.mainWindow.webContents.send('stop-audio-capture');
        if (context.encoderWindow) {
            if (reason && !options.suppressError) context.encoderWindow.webContents.send('encoder-error', reason);
        }
    }

    function resetEncoderWriteStats() {
        const now = Date.now();
        context.encoderWriteStats = {
            startedAt: now,
            chunks: 0,
            bytes: 0,
            backpressure: 0,
            flowControlEvents: 0,
            drainEvents: 0,
            maxDrainMs: 0,
            slowDrainEvents: 0,
            waitingDrain: false,
            lastBackpressureAt: 0,
            lastSlowDrainLogAt: 0,
            errors: 0,
            lastSummaryAt: now,
            inputPeak: 0,
            inputRms: 0,
            inputPeakDb: -120,
            inputRmsDb: -120,
            lastInputMeterAt: 0,
            lastInputSignalAt: 0,
            inputSilentMs: 0,
            lastInputSilenceLogAt: 0
        };
    }

    function pcmLevelToDb(value) {
        const safe = Math.max(0, Math.min(1, Number(value) || 0));
        if (safe <= 0.000001) return -120;
        return Math.max(-120, 20 * Math.log10(safe));
    }

    function measurePcmS16leLevel(buffer) {
        if (!buffer || buffer.length < 2) {
            return { peak: 0, rms: 0, peakDb: -120, rmsDb: -120 };
        }
        const sampleCount = Math.floor(buffer.length / 2);
        let peak = 0;
        let sumSquares = 0;
        for (let offset = 0; offset + 1 < buffer.length; offset += 2) {
            const value = buffer.readInt16LE(offset) / 32768;
            const abs = Math.abs(value);
            if (abs > peak) peak = abs;
            sumSquares += value * value;
        }
        const rms = sampleCount ? Math.sqrt(sumSquares / sampleCount) : 0;
        return {
            peak,
            rms,
            peakDb: pcmLevelToDb(peak),
            rmsDb: pcmLevelToDb(rms)
        };
    }

    function updateEncoderInputMeter(buffer, source = 'renderer') {
        const stats = context.encoderWriteStats;
        if (!stats) return;
        const format = context.encoderSourceContract?.captureFormat || context.activeEncoderConfig?.captureFormat || '';
        if (format !== 'pcm_s16le') return;

        const now = Date.now();
        const level = measurePcmS16leLevel(buffer);
        const hasSignal = level.peak > 0.0008 || level.rms > 0.00025;
        if (hasSignal) {
            stats.lastInputSignalAt = now;
            stats.inputSilentMs = 0;
        } else {
            stats.inputSilentMs = stats.lastInputSignalAt ? now - stats.lastInputSignalAt : now - stats.startedAt;
        }
        stats.inputPeak = level.peak;
        stats.inputRms = level.rms;
        stats.inputPeakDb = level.peakDb;
        stats.inputRmsDb = level.rmsDb;

        if (context.encoderWindow && !context.encoderWindow.isDestroyed() && now - stats.lastInputMeterAt > 150) {
            stats.lastInputMeterAt = now;
            context.encoderWindow.webContents.send('encoder-input-meter', {
                source,
                captureProvider: context.encoderSourceContract?.captureProvider || context.activeEncoderConfig?.captureProvider || '',
                captureFormat: format,
                peak: level.peak,
                rms: level.rms,
                peakDb: level.peakDb,
                rmsDb: level.rmsDb,
                hasSignal,
                silentMs: stats.inputSilentMs,
                updatedAt: now
            });
        }

        if (!hasSignal && stats.inputSilentMs > 8000 && now - (stats.lastInputSilenceLogAt || 0) > 30000) {
            stats.lastInputSilenceLogAt = now;
            writeLog(`Encoder entrada PCM sin senal (${source}) por ${Math.round(stats.inputSilentMs / 1000)}s. FFmpeg sigue recibiendo datos.`);
        }
    }

    function logEncoderWriteStats(reason = 'summary') {
        const stats = context.encoderWriteStats;
        if (!stats || !stats.chunks) return;
        const elapsedSec = Math.max(0.001, (Date.now() - stats.startedAt) / 1000);
        const kbps = (stats.bytes * 8 / 1000 / elapsedSec).toFixed(1);
        const flowControlEvents = stats.flowControlEvents || stats.backpressure || 0;
        const drainEvents = stats.drainEvents || 0;
        const slowDrainEvents = stats.slowDrainEvents || 0;
        let estado = 'normal';
        if (stats.errors > 0) estado = 'error';
        else if (slowDrainEvents > 0) estado = 'observacion';
        else if (flowControlEvents > 0 && flowControlEvents === drainEvents) estado = 'normal-regulado';
        const peakText = Number.isFinite(stats.inputPeakDb) ? `${stats.inputPeakDb.toFixed(1)}dB` : '--';
        const rmsText = Number.isFinite(stats.inputRmsDb) ? `${stats.inputRmsDb.toFixed(1)}dB` : '--';
        writeLog(`Encoder PCM ${reason}: estado=${estado}, chunks=${stats.chunks}, MB=${(stats.bytes / 1048576).toFixed(2)}, pcm=${kbps} kbps, entradaPeak=${peakText}, entradaRms=${rmsText}, silencio=${Math.round((stats.inputSilentMs || 0) / 1000)}s, flujoControlado=${flowControlEvents}, drains=${drainEvents}, drainsLentos=${slowDrainEvents}, maxDrain=${Math.round(stats.maxDrainMs || 0)}ms, errores=${stats.errors}`);
        stats.lastSummaryAt = Date.now();
    }

    function normalizeEncoderConfig(config = {}) {
        const serverType = config.serverType || config.type || 'icecast';
        const password = config.password || config.pass || '';
        const bitrate = Math.min(320, Math.max(32, parseInt(config.bitrate, 10) || 128));
        const providerLower = String(config.encoderProvider || 'auto').trim().toLowerCase();
        const source = config.source === 'mic' ? 'mic' : 'master';
        const rustMaster = source === 'master' && readAudioEngineMode() === 'rustAudio';
        const rawEncoderProvider = rustMaster
            ? 'rust'
            : ['rust', 'rustaudio', 'rustaudioengine'].includes(providerLower)
            ? 'rust'
            : ['webaudio', 'webaudiorenderer'].includes(providerLower)
                ? 'webAudio'
                : 'auto';
        return {
            ...config,
            serverType,
            type: serverType,
            password,
            pass: password,
            ip: String(config.ip || '').trim(),
            port: String(config.port || '').trim(),
            mount: String(config.mount || '').trim(),
            source,
            tapPoint: config.tapPoint === 'preFx' ? 'preFx' : 'postFx',
            micId: config.micId || config.mic || '',
            codec: config.codec === 'mp3' ? 'mp3' : 'aac',
            encoderProvider: rawEncoderProvider,
            bitrate: String(bitrate)
        };
    }

    function normalizeMount(mount) {
        const mountStr = String(mount || '').trim();
        if (!mountStr) return '/';
        return mountStr.startsWith('/') ? mountStr : `/${mountStr}`;
    }

    function buildStreamUrl(config) {
        const safePassword = encodeURIComponent(String(config.password || ''));
        if (config.serverType === 'shoutcast') {
            return `icecast://source:${safePassword}@${config.ip}:${config.port}/1`;
        }
        let mountStr = normalizeMount(config.mount);
        if (mountStr === '/' || !mountStr) mountStr = '/stream';
        return `icecast://source:${safePassword}@${config.ip}:${config.port}${mountStr}`;
    }

    function buildCodecArgs(config) {
        const common = ['-vn', '-ac', '2', '-ar', '44100', '-af', 'aresample=async=1:first_pts=0'];
        if (config.codec === 'aac') return [...common, '-c:a', 'aac', '-b:a', `${config.bitrate}k`, '-f', 'adts', '-content_type', 'audio/aac'];
        return [...common, '-c:a', 'libmp3lame', '-b:a', `${config.bitrate}k`, '-minrate', `${config.bitrate}k`, '-maxrate', `${config.bitrate}k`, '-bufsize', `${parseInt(config.bitrate, 10) * 2}k`, '-f', 'mp3', '-content_type', 'audio/mpeg'];
    }

    function buildEncoderInputArgs(config) {
        if (config.captureFormat === 'pcm_s16le') {
            const sampleRate = Math.max(8000, Math.min(192000, parseInt(config.sampleRate, 10) || 44100));
            return ['-f', 's16le', '-ar', String(sampleRate), '-ac', '2', '-i', 'pipe:0'];
        }
        return ['-f', 'webm', '-c:a', 'opus', '-i', 'pipe:0'];
    }

    function writeEncoderAudioChunk(chunk, source = 'renderer') {
        if (!context.ffmpegProcess || !context.ffmpegProcess.stdin || context.ffmpegProcess.stdin.destroyed) return false;
        try {
            const buffer = Buffer.from(chunk);
            if (context.encoderWriteStats) {
                context.encoderWriteStats.chunks++;
                context.encoderWriteStats.bytes += buffer.length;
            }
            updateEncoderInputMeter(buffer, source);
            const accepted = context.ffmpegProcess.stdin.write(buffer);
            if (!accepted && context.encoderWriteStats && !context.encoderWriteStats.waitingDrain) {
                const stats = context.encoderWriteStats;
                stats.backpressure++;
                stats.flowControlEvents++;
                stats.waitingDrain = true;
                stats.lastBackpressureAt = Date.now();
                context.ffmpegProcess.stdin.once('drain', () => {
                    if (!context.encoderWriteStats) return;
                    const drainMs = Date.now() - (context.encoderWriteStats.lastBackpressureAt || Date.now());
                    context.encoderWriteStats.waitingDrain = false;
                    context.encoderWriteStats.drainEvents++;
                    context.encoderWriteStats.maxDrainMs = Math.max(context.encoderWriteStats.maxDrainMs || 0, drainMs);
                    if (drainMs > 1000) {
                        context.encoderWriteStats.slowDrainEvents++;
                        const now = Date.now();
                        if (!context.encoderWriteStats.lastSlowDrainLogAt || now - context.encoderWriteStats.lastSlowDrainLogAt > 30000) {
                            context.encoderWriteStats.lastSlowDrainLogAt = now;
                            writeLog(`Encoder PCM drain lento (${source}): ${Math.round(drainMs)}ms. FFmpeg recupero la escritura.`);
                        }
                    }
                });
            }
            if (context.encoderWriteStats && Date.now() - context.encoderWriteStats.lastSummaryAt > 60000) {
                logEncoderWriteStats('minute');
            }
            maybeFallbackRustPcmSilence(source);
            return true;
        } catch (err) {
            if (context.encoderWriteStats) context.encoderWriteStats.errors++;
            writeLog(`Error escribiendo audio al encoder (${source}): ${err.message || err}`);
            return false;
        }
    }

    function stopRustPcmEncoderSource() {
        if (context.rustPcmEncoderSource) {
            try { context.rustPcmEncoderSource.stop(); } catch (err) {
                writeLog(`Rust PCM encoder source stop: ${err.message || err}`);
            }
            context.rustPcmEncoderSource = null;
        }
        // Siempre desregistrar el consumer del engine principal (modo --pcm-tap)
        try { context.rustAudioEngine?.detachPcmConsumer?.(); } catch (err) { }
        if (context.mainWindow && !context.mainWindow.isDestroyed()) {
            context.mainWindow.webContents.send('stop-rust-pcm-encoder-sync');
        }
    }

    function startFfmpegProcess(rawConfig = {}) {
        const config = normalizeEncoderConfig(rawConfig);
        const localTesting = process.env.LOCAL_TESTING === 'true' || config?.localTesting === true;
        const streamUrl = buildStreamUrl(config);
        const codecArgs = buildCodecArgs(config);
        try {
            if (context.ffmpegProcess) killFfmpegProcess('');
            const inputArgs = buildEncoderInputArgs(config);
            const ffmpegArgs = localTesting ? ['-hide_banner', '-nostdin', ...inputArgs, '-f', 'null', '-'] : ['-hide_banner', '-nostdin', ...inputArgs, ...codecArgs, streamUrl];
            writeLog(`Encoder FFmpeg iniciado. Entrada: ${config.captureFormat || 'webm-opus'} ${config.sampleRate || ''}`.trim());
            resetEncoderWriteStats();
            notifyRustEncoder('start', config);
            context.ffmpegProcess = cp.spawn(ffmpegPath, ffmpegArgs, { windowsHide: true });
            setEncoderStatus('connecting');
            let isFfmpegLive = false;
            let ffmpegLastStderr = '';
            context.ffmpegProcess.stderr.on('data', (data) => {
                const out = data.toString();
                ffmpegLastStderr = (ffmpegLastStderr + out).slice(-2000);
                const bitrateMatch = out.match(/bitrate=\s*([\d.]+)\s*kbits\/s/i);
                const speedMatch = out.match(/speed=\s*([\d.]+)x/i);
                const timeMatch = out.match(/time=(\d+:\d+:\d+(?:\.\d+)?)/i);
                if (bitrateMatch && context.encoderWindow && !context.encoderWindow.isDestroyed()) {
                    const throughput = {
                        bitrateKbps: Number(bitrateMatch[1]),
                        speed: speedMatch ? Number(speedMatch[1]) : null,
                        ffmpegTime: timeMatch ? timeMatch[1] : ''
                    };
                    context.encoderWindow.webContents.send('encoder-throughput', throughput);
                    notifyRustEncoder('health', { ...config, ...throughput });
                }
                if (!isFfmpegLive && out.includes('time=') && out.includes('bitrate=')) {
                    isFfmpegLive = true;
                    setEncoderStatus('live');
                    if (context.mainWindow) {
                        setTimeout(() => { if (context.mainWindow && !context.mainWindow.isDestroyed()) context.mainWindow.webContents.send('force-metadata-update'); }, 3000);
                    }
                }
            });
            context.ffmpegProcess.stdin.on('error', (err) => {
                if (context.encoderWriteStats) context.encoderWriteStats.errors++;
                writeLog(`Encoder stdin: ${err.message}`);
            });
            context.ffmpegProcess.on('error', (err) => { killFfmpegProcess(`FFmpeg no pudo iniciar: ${err.message || err}`); });
            context.ffmpegProcess.on('close', (code) => {
                logEncoderWriteStats('close');
                stopRustPcmEncoderSource();
                notifyRustEncoder('stop', config);
                writeLog(`Encoder FFmpeg cerrado. Codigo: ${code}. Ultima salida: ${ffmpegLastStderr || 'sin salida'}`);
                if (context.ffmpegProcess) context.ffmpegProcess = null;
                if (context.suppressNextFfmpegCloseSideEffects && Date.now() < context.suppressNextFfmpegCloseSideEffects) {
                    context.suppressNextFfmpegCloseSideEffects = 0;
                    return;
                }
                if (code && code !== 0 && context.encoderWindow) {
                    const cleanErr = (ffmpegLastStderr || 'Error de conexion desconocido. Revisa la IP, puerto y clave.').replace(/\n/g, ' ').trim();
                    context.encoderWindow.webContents.send('encoder-error', `FFmpeg termino con codigo ${code}: ${cleanErr}`);
                }
                setEncoderStatus('disconnected');
                if (context.mainWindow) {
                    context.mainWindow.webContents.send('stop-audio-capture');
                }
            });
            return { success: true };
        } catch (err) {
            setEncoderStatus('disconnected');
            if (context.encoderWindow) context.encoderWindow.webContents.send('encoder-error', 'Error critico lanzando FFmpeg.');
            return { success: false, error: err.message || String(err) };
        }
    }

    function startRendererEncoderCapture(config) {
        context.activeEncoderConfig = config;
        if (context.mainWindow) context.mainWindow.webContents.send('start-audio-capture', config);
    }

    function startRustPcmEncoderCapture(config) {
        const sampleRate = Math.max(8000, Math.min(192000, parseInt(config.sampleRate, 10) || 44100));
        const engine = context.rustAudioEngine;
        if (!engine || !engine.isRunning?.() || typeof engine.attachPcmConsumer !== 'function') {
            return { success: false, error: 'Motor Rust no disponible para tap del encoder.' };
        }
        const resolved = {
            ...config,
            source: 'master',
            owner: 'rustAudioEngine',
            captureProvider: 'rustAudioEngine',
            tapPoint: config.tapPoint === 'preFx' ? 'preFx' : 'postFx',
            rustPcmReady: true,
            pcmBridgeReady: true,
            captureFormat: 'pcm_s16le',
            sampleRate,
            transport: 'ffmpeg-rust-pcm-tap'
        };
        context.activeEncoderConfig = resolved;
        context.encoderSourceContract = { ...(context.encoderSourceContract || {}), ...resolved, active: false };
        const ffmpegStarted = startFfmpegProcess(resolved);
        if (!ffmpegStarted.success) return ffmpegStarted;

        stopRustPcmEncoderSource(); // limpia consumer previo

        // FASE D · sub-paso 8.2 — Encoder 100% Rust nativo, sin WebAudio.
        // El motor escribe chunks PCM s16le base64 por stdout en cada PushTick
        // (100 ms). El probe Node los decodifica y se los entrega a este
        // callback, que los pipea al stdin de FFmpeg. Sin proceso bridge
        // adicional, sin WebAudio MediaStream, sin Renderer en el medio.
        engine.attachPcmConsumer(chunk => writeEncoderAudioChunk(chunk, 'rust-pcm'));
        context.rustPcmEncoderSource = {
            _tap: true,
            isRunning: () => !!engine.isRunning(),
            stop: () => { try { engine.detachPcmConsumer(); } catch (err) { } },
            status: () => ({ tap: true, running: engine.isRunning() })
        };
        writeLog(`Encoder en modo Rust PCM tap nativo (${resolved.tapPoint}).`);

        if (context.mainWindow && !context.mainWindow.isDestroyed()) {
            context.mainWindow.webContents.send('start-rust-pcm-encoder-sync', resolved);
        }
        return { success: true };
    }

    function buildWebAudioEncoderFallbackConfig(reason = 'rust-pcm-live-fallback') {
        return {
            ...(context.activeEncoderConfig || context.encoderSourceContract || {}),
            source: 'master',
            owner: 'webAudioRenderer',
            requestedOwner: 'rustAudioEngine',
            captureProvider: 'webAudioRenderer',
            rustPcmReady: false,
            pcmBridgeReady: false,
            fallbackReason: reason,
            captureFormat: 'pcm_s16le',
            transport: 'ffmpeg'
        };
    }

    function startWebAudioEncoderFallback(reason = 'rust-pcm-live-fallback', details = {}) {
        if (readAudioEngineMode() === 'rustAudio') {
            writeLog(`Rust PCM encoder fallback bloqueado por modo Rust exclusivo: ${reason}. Detalle=${JSON.stringify(details || {})}`);
            return { success: false, blocked: true, error: reason };
        }
        if (context.encoderSourceContract?.captureProvider === 'webAudioRenderer') return { success: true, alreadyFallback: true };
        const fallback = buildWebAudioEncoderFallbackConfig(reason);
        writeLog(`Rust PCM encoder fallback a WebAudio: ${reason}. Detalle=${JSON.stringify(details || {})}`);
        context.suppressNextFfmpegCloseSideEffects = Date.now() + 5000;
        killFfmpegProcess('', {
            suppressStatus: true,
            suppressStopCapture: true,
            suppressError: true
        });
        context.encoderSourceContract = { ...(context.encoderSourceContract || {}), ...fallback, active: false };
        setTimeout(() => {
            startRendererEncoderCapture(fallback);
        }, 150);
        return { success: true };
    }

    function maybeFallbackRustPcmSilence(source = '') {
        if (source !== 'rust-pcm') return;
        const stats = context.encoderWriteStats;
        const engine = context.rustAudioEngine;
        // En modo --pcm-tap la fuente PCM es el engine principal (no un proceso bridge)
        const tapActive = !!(engine?.isPcmTapMode?.() && engine?.isRunning?.());
        const bridgeActive = !tapActive && !!(context.rustPcmEncoderSource?.isRunning?.());
        if (!stats || (!tapActive && !bridgeActive)) return;
        if ((Date.now() - (stats.startedAt || Date.now())) < 12000) return;
        const silentMs = Number(stats.inputSilentMs) || 0;
        if (silentMs < 12000) return;
        if (context.lastRustPcmSilenceFallbackAt && Date.now() - context.lastRustPcmSilenceFallbackAt < 60000) return;
        context.lastRustPcmSilenceFallbackAt = Date.now();
        const rustStatus = tapActive
            ? { tap: true, running: engine.isRunning(), activePlayers: null }
            : (context.rustPcmEncoderSource?.status?.() || {});
        startWebAudioEncoderFallback(
            (Number(rustStatus.activePlayers) || 0) > 0
                ? 'rust-pcm-silent-with-active-players'
                : 'rust-pcm-silent-no-live-players',
            {
                silentMs,
                tapMode: tapActive,
                activePlayers: rustStatus.activePlayers,
                stdoutBytes: rustStatus.stdoutBytes,
                stdoutChunks: rustStatus.stdoutChunks,
                players: rustStatus.players
            }
        );
    }

    function startEncoderCapture(config) {
        if (config.captureProvider === 'rustAudioEngine' && config.pcmBridgeReady === true) {
            const started = startRustPcmEncoderCapture(config);
            if (started.success) return;
            if (readAudioEngineMode() === 'rustAudio') {
                writeLog(`Rust PCM encoder no inicio (${started.error || 'sin detalle'}). Modo Rust exclusivo: no se activa WebAudio.`);
                setEncoderStatus('disconnected');
                if (context.encoderWindow) context.encoderWindow.webContents.send('encoder-error', started.error || 'Rust PCM encoder no inicio.');
                return;
            }
            writeLog(`Rust PCM encoder no inicio (${started.error || 'sin detalle'}). Usando fallback WebAudio.`);
        }
        if ((config.source || 'master') === 'master' && readAudioEngineMode() === 'rustAudio') {
            writeLog('Encoder master bloqueado: WebAudio no participa en modo Rust.');
            setEncoderStatus('disconnected');
            if (context.encoderWindow) context.encoderWindow.webContents.send('encoder-error', 'El encoder master usa solo Rust en modo Rust.');
            return;
        }
        const fallback = config.captureProvider === 'rustAudioEngine'
            ? {
                ...config,
                owner: 'webAudioRenderer',
                captureProvider: 'webAudioRenderer',
                rustPcmReady: false,
                pcmBridgeReady: false,
                fallbackReason: config.fallbackReason || 'rust-pcm-live-fallback'
            }
            : config;
        context.encoderSourceContract = { ...(context.encoderSourceContract || {}), ...fallback, active: false };
        startRendererEncoderCapture(fallback);
    }

    ipcMain.handle('dialog:openFile', async (event) => { 
        const currentWin = BrowserWindow.fromWebContents(event.sender) || context.eventEditorWindow || context.mainWindow; 
        const res = await dialog.showOpenDialog(currentWin, { properties: ['openFile'], filters: [ { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac'] } ] });
        return (!res.canceled && res.filePaths.length > 0) ? res.filePaths[0] : null; 
    }); 
    
    ipcMain.handle('dialog:openPlaylist', async () => { 
        const currentWin = context.eventEditorWindow || context.mainWindow;
        const res = await dialog.showOpenDialog(currentWin, { title: 'Abrir Playlist', properties: ['openFile'], filters: [{ name: 'LFPlay Playlist', extensions: ['lfplay'] }] }); 
        return (!res.canceled && res.filePaths.length > 0) ? res.filePaths[0] : null; 
    }); 
    
    ipcMain.handle('dialog:savePlaylist', async (e, defName) => { const res = await dialog.showSaveDialog(context.mainWindow, { title: 'Guardar Playlist', defaultPath: defName || 'Mi_Playlist.LFPlay', filters: [{ name: 'LFPlay Playlist', extensions: ['lfplay'] }] }); return (!res.canceled && res.filePath) ? res.filePath : null; }); 
    
    ipcMain.handle('dialog:selectFolder', async (event) => { 
        const currentWin = BrowserWindow.fromWebContents(event.sender) || context.eventEditorWindow || context.libraryWindow || context.settingsWindow || context.mainWindow; 
        const res = await dialog.showOpenDialog(currentWin, { title: 'Seleccionar Carpeta', properties: ['openDirectory'] }); 
        return (!res.canceled && res.filePaths.length > 0) ? res.filePaths[0] : null; 
    }); 

    // ── Handler `rust-pcm-ffmpeg-test` ELIMINADO ──────────────────────────
    // Era un botón de smoke test que dependía de `runRustPcmBridgeFfmpegSmokeTest`
    // (función nunca implementada). El botón en consola.html se mantiene como
    // referencia visual pero su click handler ya falla controladamente.

    // FASE D · sub-paso 8.2 — En modo tap nativo, el motor Rust maneja su
    // propio mapa de players internamente. El antiguo `syncPlayers` del lado
    // JS era para el `RustPcmBridgeEncoderSource` muerto; ahora es noop.
    ipcMain.handle('rust-pcm-encoder-sync', async () => {
        if (!context.rustPcmEncoderSource) {
            return { success: false, running: false, error: 'Rust PCM encoder source no iniciado.' };
        }
        return {
            success: true,
            running: context.rustPcmEncoderSource.isRunning?.() === true,
            tap: true
        };
    });

    ipcMain.handle('rust-pcm-encoder-status', async () => {
        return context.rustPcmEncoderSource?.status?.() || { running: false };
    });
    
    ipcMain.handle('show-context-menu', (event, template) => {
        return new Promise((resolve) => {
            const { Menu } = require('electron');
            let resolved = false;
            const buildMenu = (items) => {
                return items.map(item => {
                    if (item.type === 'separator') return { type: 'separator' };
                    if (item.submenu) return { label: item.label, submenu: buildMenu(item.submenu) };
                    return {
                        label: item.label,
                        type: item.type || 'normal',
                        checked: item.checked,
                        enabled: item.enabled !== false,
                        click: () => { resolved = true; resolve(item.id); }
                    };
                });
            };
            const menu = Menu.buildFromTemplate(buildMenu(template));
            menu.once('menu-will-close', () => { setTimeout(() => { if (!resolved) resolve(null); }, 50); });
            menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
        });
    });

    
    function forwardSettingsUpdated(payload = {}) {
        if (context.mainWindow) context.mainWindow.webContents.send('settings-updated', payload);
        if (context.audioEditorWindow) context.audioEditorWindow.webContents.send('settings-updated', payload);
        if (context.transitionEditorWindow) context.transitionEditorWindow.webContents.send('settings-updated', payload);
        if (context.jingleEditorWindow) context.jingleEditorWindow.webContents.send('settings-updated', payload);
        if (context.libraryWindow) context.libraryWindow.webContents.send('settings-updated', payload);
        if (context.previewWindow) context.previewWindow.webContents.send('settings-updated', payload);
        if (context.consoleWindow) context.consoleWindow.webContents.send('settings-updated', payload);
    }

    ipcMain.on('open-commercial-manager', () => openCommercialManagerWindow());
    ipcMain.on('open-library', () => { if (context.libraryWindow) { context.libraryWindow.focus(); return; } context.libraryWindow = new BrowserWindow({ icon: require('electron').nativeImage.createFromPath(require('path').join(__dirname, '..', '..', 'assets', 'icons', 'library.png')),   width: 1150, height: 750, title: 'Biblioteca de Música', autoHideMenuBar: true, webPreferences: { nodeIntegration: true, contextIsolation: false } }); context.libraryWindow.loadFile('frontend/libreria.html'); context.libraryWindow.on('closed', () => { context.libraryWindow = null; }); }); ipcMain.on('open-settings', () => { if (context.settingsWindow) { context.settingsWindow.focus(); return; } context.settingsWindow = new BrowserWindow({ icon: require('electron').nativeImage.createFromPath(require('path').join(__dirname, '..', '..', 'assets', 'icons', 'settings.png')),   width: 980, height: 760, minWidth: 900, minHeight: 700, title: 'Ajustes Generales', autoHideMenuBar: true, webPreferences: { nodeIntegration: true, contextIsolation: false } }); context.settingsWindow.loadFile('frontend/settings.html'); context.settingsWindow.on('closed', () => { context.settingsWindow = null; }); }); ipcMain.on('settings-updated', (_e, payload) => { forwardSettingsUpdated(payload || {}); }); ipcMain.on('refresh-event-groups', () => { if (context.mainWindow) context.mainWindow.webContents.send('refresh-event-groups'); if (context.eventEditorWindow) context.eventEditorWindow.webContents.send('refresh-event-groups'); if (context.calendarWindow && !context.calendarWindow.isDestroyed()) context.calendarWindow.webContents.send('refresh-event-groups'); }); ipcMain.on('open-event-groups', () => { if (context.eventGroupsWindow) { context.eventGroupsWindow.focus(); return; } context.eventGroupsWindow = new BrowserWindow({ icon: require('electron').nativeImage.createFromPath(require('path').join(__dirname, '..', '..', 'assets', 'icons', 'groups.png')),   width: 650, height: 550, title: 'Grupos de Eventos', autoHideMenuBar: true, webPreferences: { nodeIntegration: true, contextIsolation: false } }); context.eventGroupsWindow.loadFile('frontend/event_groups.html'); context.eventGroupsWindow.on('closed', () => { context.eventGroupsWindow = null; if (context.mainWindow) context.mainWindow.webContents.send('refresh-event-groups'); if(context.eventEditorWindow) context.eventEditorWindow.webContents.send('refresh-event-groups'); }); }); ipcMain.on('open-event-editor', (e, eventData) => { const requestedKey = eventData && eventData.id ? `edit:${eventData.id}` : 'new'; if (context.eventEditorWindow && !context.eventEditorWindow.isDestroyed()) { if (context.eventEditorContextKey === requestedKey) { if (context.eventEditorWindow.isMinimized()) context.eventEditorWindow.restore(); context.eventEditorWindow.show(); context.eventEditorWindow.focus(); return; } context.eventEditorWindow.destroy(); context.eventEditorWindow = null; context.eventEditorContextKey = null; } context.eventEditorWindow = new BrowserWindow({ icon: require('electron').nativeImage.createFromPath(require('path').join(__dirname, '..', '..', 'assets', 'icons', 'events.png')),   width: 820, height: 760, title: 'Editor de Eventos', autoHideMenuBar: true, webPreferences: { nodeIntegration: true, contextIsolation: false } }); context.eventEditorContextKey = requestedKey; context.eventEditorWindow.loadFile('frontend/event_editor.html'); context.eventEditorWindow.webContents.on('did-finish-load', () => { context.eventEditorWindow.webContents.send('load-event-data', eventData); }); context.eventEditorWindow.on('closed', () => { context.eventEditorWindow = null; context.eventEditorContextKey = null; if (context.calendarWindow && !context.calendarWindow.isDestroyed()) context.calendarWindow.webContents.send('refresh-events'); }); });
    ipcMain.on('open-audio-editor', (e, filePath) => { if (context.mainWindow && e.sender.id === context.mainWindow.webContents.id) context.lastEditorSource = 'playlist'; if (context.libraryWindow && e.sender.id === context.libraryWindow.webContents.id) context.lastEditorSource = 'library'; if (context.audioEditorWindow) { context.audioEditorWindow.focus(); context.audioEditorWindow.webContents.send('load-audio-file', filePath); } else { context.audioEditorWindow = new BrowserWindow({ icon: require('electron').nativeImage.createFromPath(require('path').join(__dirname, '..', '..', 'assets', 'icons', 'editor.png')),   width: 1000, height: 600, title: 'Editor de Pistas Avanzado', autoHideMenuBar: true, webPreferences: { nodeIntegration: true, contextIsolation: false } }); context.audioEditorWindow.loadFile('frontend/audio_editor.html'); context.audioEditorWindow.webContents.on('did-finish-load', () => { context.audioEditorWindow.webContents.send('load-audio-file', filePath); }); context.audioEditorWindow.on('closed', () => { context.audioEditorWindow = null; if (context.mainWindow) context.mainWindow.webContents.send('refresh-manual-cues'); if(context.libraryWindow) context.libraryWindow.webContents.send('refresh-manual-cues'); }); } });

    ipcMain.on('open-calendar', () => {
        if (context.calendarWindow) { context.calendarWindow.focus(); return; }
        context.calendarWindow = new BrowserWindow({ icon: require('electron').nativeImage.createFromPath(require('path').join(__dirname, '..', '..', 'assets', 'icons', 'events.png')),  
            width: 1200, height: 750,
            minWidth: 1000, minHeight: 600,
            title: 'Calendario Semanal y Parrilla de Programación',
            autoHideMenuBar: true,
            webPreferences: { nodeIntegration: true, contextIsolation: false }
        });
        context.calendarWindow.loadFile('frontend/calendar.html');
        context.calendarWindow.on('closed', () => { context.calendarWindow = null; });
    });

    ipcMain.on('refresh-events-from-calendar', () => {
        if (context.mainWindow && !context.mainWindow.isDestroyed()) {
            context.mainWindow.webContents.send('refresh-events');
        }
    });

    
    ipcMain.on('open-transition-editor', (e, data) => { 
        if (context.transitionEditorWindow) { context.transitionEditorWindow.focus(); return; }
        context.transitionEditorWindow = new BrowserWindow({ icon: require('electron').nativeImage.createFromPath(require('path').join(__dirname, '..', '..', 'assets', 'icons', 'transition.png')),   width: 1000, height: 450, title: 'Editor de Transición Musical', autoHideMenuBar: true, webPreferences: { nodeIntegration: true, contextIsolation: false } });
        context.transitionEditorWindow.loadFile('frontend/transition_editor.html');
        context.transitionEditorWindow.webContents.on('did-finish-load', () => { context.transitionEditorWindow.webContents.send('load-data', data); });
        context.transitionEditorWindow.on('closed', () => { context.transitionEditorWindow = null; });
    });
    
    ipcMain.on('open-jingle-editor', (e, data) => { 
        if (context.jingleEditorWindow) { context.jingleEditorWindow.focus(); return; }
        context.jingleEditorWindow = new BrowserWindow({ icon: require('electron').nativeImage.createFromPath(require('path').join(__dirname, '..', '..', 'assets', 'icons', 'jingle.png')),   width: 1000, height: 600, title: 'Editor de Músicas y Pisadores', autoHideMenuBar: true, webPreferences: { nodeIntegration: true, contextIsolation: false } });
        context.jingleEditorWindow.loadFile('frontend/jingle_editor.html');
        context.jingleEditorWindow.webContents.on('did-finish-load', () => { context.jingleEditorWindow.webContents.send('load-data', data); });
        context.jingleEditorWindow.on('closed', () => { context.jingleEditorWindow = null; });
    });
    
    ipcMain.on('save-transition', (e, result) => { if(context.mainWindow) context.mainWindow.webContents.send('apply-transition', result); if(context.transitionEditorWindow) context.transitionEditorWindow.close(); });
    ipcMain.on('save-jingle-transition', (e, result) => { if(context.mainWindow) context.mainWindow.webContents.send('apply-jingle-transition', result); if(context.jingleEditorWindow) context.jingleEditorWindow.close(); });
    
    ipcMain.on('editor-request-track', (e, data) => { if (context.lastEditorSource === 'library' && context.libraryWindow) { context.libraryWindow.webContents.send('editor-handle-request-track', data); } else if (context.mainWindow) { context.mainWindow.webContents.send('editor-handle-request-track', data); } });
    ipcMain.on('open-preview', (e, filePath) => { if (context.previewWindow) { context.previewWindow.focus(); context.previewWindow.webContents.send('load-preview-track', filePath); } else { const { height } = screen.getPrimaryDisplay().workAreaSize; context.previewWindow = new BrowserWindow({ icon: require('electron').nativeImage.createFromPath(require('path').join(__dirname, '..', '..', 'assets', 'icons', 'editor.png')),   width: 480, height: 200, x: 20, y: height - 220, title: 'Escucha previa', autoHideMenuBar: true, resizable: false, alwaysOnTop: true, webPreferences: { nodeIntegration: true, contextIsolation: false } }); context.previewWindow.loadFile('frontend/preview.html'); context.previewWindow.webContents.on('did-finish-load', () => { context.previewWindow.webContents.send('load-preview-track', filePath); }); context.previewWindow.on('closed', () => { context.previewWindow = null; }); } });
    ipcMain.on('open-encoder', () => {
        if (context.encoderWindow) {
            context.encoderWindow.show();
            context.encoderWindow.focus();
            return;
        }
        context.encoderWindow = new BrowserWindow({ icon: require('electron').nativeImage.createFromPath(require('path').join(__dirname, '..', '..', 'assets', 'icons', 'encoder.png')),  
            width: 480,
            height: 760,
            minWidth: 460,
            minHeight: 680,
            title: 'Emisor de Radio (Encoder)',
            autoHideMenuBar: true,
            resizable: true,
            webPreferences: { nodeIntegration: true, contextIsolation: false }
        });
        context.encoderWindow.loadFile('frontend/encoder.html');
        context.encoderWindow.webContents.on('did-finish-load', () => {
            context.encoderWindow.webContents.send('encoder-status', context.encoderRuntimeStatus || (context.ffmpegProcess ? 'connecting' : 'disconnected'));
        });
        context.encoderWindow.on('close', (e) => {
            if (!context.isAppQuitting && context.ffmpegProcess) {
                e.preventDefault();
                context.encoderWindow.hide();
            }
        });
        context.encoderWindow.on('closed', () => { context.encoderWindow = null; });
    });
    ipcMain.on('start-encoder', (e, config) => {
        const normalized = normalizeEncoderConfig(config);
        const contract = buildEncoderSourceContract(normalized, false);
        const resolved = { ...normalized, ...contract };
        context.encoderSourceContract = { ...(context.encoderSourceContract || {}), ...contract, active: false };
        startEncoderCapture(resolved);
    });

    ipcMain.on('encoder-request-webaudio-fallback', (e, payload = {}) => {
        startWebAudioEncoderFallback(payload.reason || 'renderer-requested-rust-pcm-fallback', payload);
    });

    // FIX: el operador conmutó Pre-FX / Post-FX desde la ventana del encoder.
    // Lo reenviamos al renderer principal para que actualice el `route` del
    // bus encoder al motor Rust en caliente (sin reiniciar el encoder).
    ipcMain.on('encoder-tap-point-changed', (e, payload = {}) => {
        if (context.mainWindow && !context.mainWindow.isDestroyed()) {
            context.mainWindow.webContents.send('encoder-tap-point-changed', payload);
        }
    });
    
    ipcMain.on('update-metadata', async (e, metaText) => {
        try { const txtPath = path.join(configDir, 'NowPlaying.txt'); fs.writeFileSync(txtPath, metaText, 'utf-8'); } catch(err) { writeLog("Error escribiendo NowPlaying.txt: " + err); }
        if (context.ffmpegProcess && context.activeEncoderConfig) {
            try {
                const conf = normalizeEncoderConfig(context.activeEncoderConfig);
                const encodedMeta = encodeURIComponent(String(metaText || '').slice(0, 255));
                let metaUrl = '';
                let authHeader = '';
                if (conf.serverType === 'icecast') {
                    const mountStr = encodeURIComponent(normalizeMount(conf.mount));
                    metaUrl = `http://${conf.ip}:${conf.port}/admin/metadata?mount=${mountStr}&mode=updinfo&song=${encodedMeta}`;
                    authHeader = 'Basic ' + Buffer.from(`admin:${conf.password}`).toString('base64');
                } else if (conf.serverType === 'shoutcast') {
                    metaUrl = `http://${conf.ip}:${conf.port}/admin.cgi?pass=${encodeURIComponent(conf.password)}&mode=updinfo&song=${encodedMeta}`;
                }
                if (metaUrl) {
                    const headers = authHeader ? { 'Authorization': authHeader } : {};
                    fetch(metaUrl, { headers }).then((res) => {
                        if (!res.ok) writeLog(`Metadata remota respondio HTTP ${res.status}`);
                    }).catch(e => writeLog("Error actualizando metadata remota: " + e));
                }
            } catch(err) { writeLog("Error preparando metadata remote: " + err); }
        }
    });
    
    ipcMain.on('init-ffmpeg', (e, config) => {
        startFfmpegProcess(config);
    });
    ipcMain.on('encoder-health', (e, report = {}) => {
        const reason = report.reason || 'report';
        if (reason === 'minute' || reason === 'stop' || reason === 'chunk-gap') {
            const parts = [
                `Encoder captura ${reason}`,
                `chunks=${report.chunks || 0}`,
                `MB=${(((report.bytes || 0) / 1048576) || 0).toFixed(2)}`
            ];
            if (Number.isFinite(report.maxGapMs)) parts.push(`maxGap=${Math.round(report.maxGapMs)}ms`);
            if (Number.isFinite(report.gapMs)) parts.push(`gap=${Math.round(report.gapMs)}ms`);
            if (Number.isFinite(report.expectedGapMs)) parts.push(`esperado=${Math.round(report.expectedGapMs)}ms`);
            if (Number.isFinite(report.gapWarnings)) parts.push(`avisos=${report.gapWarnings}`);
            writeLog(parts.join(' | '));
            if (context.encoderWindow && !context.encoderWindow.isDestroyed()) {
                context.encoderWindow.webContents.send('encoder-capture-health', report);
            }
            notifyRustEncoder('health', {
                ...(context.activeEncoderConfig || {}),
                maxGapMs: report.maxGapMs,
                gapWarnings: report.gapWarnings
            });
        }
    });

    ipcMain.on('audio-chunk', (e, chunk) => {
        writeEncoderAudioChunk(chunk, 'renderer');
    });
    ipcMain.on('stop-encoder', () => {
        killFfmpegProcess('');
        context.activeEncoderConfig = null;
        if (context.mainWindow) {
            context.mainWindow.webContents.send('stop-audio-capture');
            setEncoderStatus('disconnected');
        }
    });
    ipcMain.on('emergency-stop-playback', () => {
        writeLog('Parada de reproduccion recibida. Encoder permanece activo.');
    });
};
