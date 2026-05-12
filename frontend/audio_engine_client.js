const AUDIO_ENGINE_COMMANDS = Object.freeze([
    'load',
    'play',
    'pause',
    'stop',
    'seek',
    'fade',
    'setGain',
    'route',
    'nowPlaying',
    'transport',
    'cartwallPlay',
    'cartwallStop',
    'startEncoder',
    'stopEncoder'
]);

function normalizeEngineMode(mode) {
    return mode === 'rustAudio' ? 'rustAudio' : 'webAudio';
}

function createEmptyDiagnostics(mode = 'webAudio') {
    return {
        mode: normalizeEngineMode(mode),
        fallbackMode: 'webAudio',
        adapter: 'WebAudioEngineAdapter',
        rustAvailable: false,
        commandContract: AUDIO_ENGINE_COMMANDS,
        players: [],
        mix: {
            phase: 'idle',
            active: false,
            referencePlayer: '',
            fadingPlayer: '',
            direction: '',
            audibleCount: 0,
            driftReferencePlayer: '',
            shouldIgnoreDrift: false,
            players: []
        },
        overlays: {
            active: false,
            activePisadores: 0,
            overlayDrops: 0,
            timeLocutionActive: false,
            cartwallActive: false,
            cartwallCount: 0,
            cartwallMode: 'master',
            duckingGain: 1,
            lastTrigger: null
        },
        buses: [],
        devices: {},
        latency: {
            masterMs: 0,
            monitorMs: null,
            cueMs: null,
            note: ''
        },
            encoder: {
                active: false,
                source: 'renderer-pcm-ffmpeg',
                owner: 'webAudioRenderer',
                requestedOwner: 'webAudioRenderer',
                captureProvider: 'webAudioRenderer',
                encoderProvider: 'auto',
                rustPcmReady: false,
                pcmBridgeReady: false,
                pcmBridgeMode: 'planned',
                pcmBridgeReason: '',
                fallbackReason: '',
                captureFormat: 'pcm_s16le',
                sampleRate: 0,
            transport: 'ffmpeg'
        },
        warnings: [],
        updatedAt: Date.now()
    };
}

class WebAudioEngineAdapter {
    constructor({ getState, onCommand } = {}) {
        this.mode = 'webAudio';
        this.getState = typeof getState === 'function' ? getState : () => ({});
        this.onCommand = typeof onCommand === 'function' ? onCommand : null;
    }

    command(type, payload = {}) {
        if (!AUDIO_ENGINE_COMMANDS.includes(type)) {
            return { ok: false, error: `Comando de audio no soportado: ${type}` };
        }
        if (this.onCommand) return this.onCommand(type, payload);
        return { ok: true, handledBy: this.mode, type };
    }

    getDiagnostics() {
        return {
            ...createEmptyDiagnostics(this.mode),
            ...this.getState(),
            mode: this.mode,
            adapter: 'WebAudioEngineAdapter',
            rustAvailable: false,
            updatedAt: Date.now()
        };
    }
}

class RustAudioEngineAdapter {
    constructor({ ipcRenderer, getState, fallbackAdapter } = {}) {
        this.mode = 'rustAudio';
        this.ipcRenderer = ipcRenderer || null;
        this.getState = typeof getState === 'function' ? getState : () => ({});
        this.fallbackAdapter = fallbackAdapter || null;
        this.lastCommand = null;
        this.lastError = '';
    }

    command(type, payload = {}) {
        if (!AUDIO_ENGINE_COMMANDS.includes(type)) {
            return Promise.resolve({ ok: false, error: `Comando de audio no soportado: ${type}` });
        }
        if (!this.ipcRenderer?.invoke) {
            return Promise.resolve({ ok: false, error: 'IPC RustAudio no disponible.' });
        }

        const command = this.toRustCommand(type, payload);
        if (!command) {
            const fallbackResult = this.fallbackAdapter?.command(type, payload);
            return Promise.resolve(fallbackResult || { ok: false, error: `RustAudio aun no implementa ${type}` });
        }

        this.lastCommand = { type, command, at: Date.now() };
        return this.ipcRenderer.invoke('audio-engine-rust-command', command)
            .then(result => {
                if (result?.success !== true) {
                    this.lastError = result?.error || 'RustAudio no pudo ejecutar comando.';
                    return { ok: false, handledBy: this.mode, type, error: this.lastError, result };
                }
                this.lastError = '';
                return { ok: true, handledBy: this.mode, type, result };
            })
            .catch(err => {
                this.lastError = err.message || String(err);
                return { ok: false, handledBy: this.mode, type, error: this.lastError };
            });
    }

    toRustCommand(type, payload = {}) {
        const player = payload.player || payload.playerId || payload.id || 'player-a';
        switch (type) {
            case 'route':
                return {
                    cmd: 'route',
                    bus: payload.bus || payload.id || 'master',
                    outputId: payload.outputId || payload.deviceId || 'default'
                };
            case 'nowPlaying':
                return {
                    cmd: 'nowPlaying',
                    title: payload.title || '',
                    artist: payload.artist || '',
                    path: payload.path || '',
                    player: payload.player || '',
                    source: payload.source || 'renderer'
                };
            case 'transport':
                return {
                    cmd: 'transport',
                    player: payload.player || '',
                    status: payload.status || 'unknown',
                    positionMs: payload.positionMs ?? 0,
                    durationMs: payload.durationMs ?? 0,
                    startCause: payload.startCause || '',
                    mixActive: payload.mixActive === true,
                    mixPhase: payload.mixPhase || '',
                    mixDirection: payload.mixDirection || '',
                    mixReferencePlayer: payload.mixReferencePlayer || payload.player || ''
                };
            case 'load':
                return {
                    cmd: payload.path ? 'loadAudio' : 'load',
                    player,
                    bus: payload.bus || '',
                    path: payload.path || '',
                    outputId: payload.outputId || payload.deviceId || 'default',
                    gain: payload.gain,
                    shadow: payload.shadow === true
                };
            case 'play':
            case 'pause':
            case 'stop':
                return { cmd: type, player };
            case 'seek':
                return { cmd: 'seek', player, positionMs: payload.positionMs ?? payload.ms ?? 0, shadow: payload.shadow === true };
            case 'setGain':
                return { cmd: 'setGain', player, gain: payload.gain ?? payload.value ?? 1 };
            case 'startEncoder':
                return {
                    cmd: 'encoder',
                    action: 'start',
                    source: payload.source || payload.sourceBus || 'master',
                    owner: payload.owner || 'webAudioRenderer',
                    requestedOwner: payload.requestedOwner || payload.owner || 'webAudioRenderer',
                    captureProvider: payload.captureProvider || payload.owner || 'webAudioRenderer',
                    encoderProvider: payload.encoderProvider || 'auto',
                    rustPcmReady: payload.rustPcmReady === true,
                    pcmBridgeReady: payload.pcmBridgeReady === true,
                    pcmBridgeMode: payload.pcmBridgeMode || 'planned',
                    pcmBridgeReason: payload.pcmBridgeReason || '',
                    fallbackReason: payload.fallbackReason || '',
                    captureFormat: payload.captureFormat || 'pcm_s16le',
                    sampleRate: payload.sampleRate || 0,
                    transport: payload.transport || 'ffmpeg'
                };
            case 'stopEncoder':
                return {
                    cmd: 'encoder',
                    action: 'stop',
                    source: payload.source || payload.sourceBus || 'master',
                    owner: payload.owner || 'webAudioRenderer',
                    requestedOwner: payload.requestedOwner || payload.owner || 'webAudioRenderer',
                    captureProvider: payload.captureProvider || payload.owner || 'webAudioRenderer',
                    encoderProvider: payload.encoderProvider || 'auto',
                    rustPcmReady: payload.rustPcmReady === true,
                    pcmBridgeReady: payload.pcmBridgeReady === true,
                    pcmBridgeMode: payload.pcmBridgeMode || 'planned',
                    pcmBridgeReason: payload.pcmBridgeReason || '',
                    fallbackReason: payload.fallbackReason || '',
                    captureFormat: payload.captureFormat || 'pcm_s16le',
                    sampleRate: payload.sampleRate || 0,
                    transport: payload.transport || 'ffmpeg'
                };
            default:
                return null;
        }
    }

    getDiagnostics() {
        return {
            ...createEmptyDiagnostics(this.mode),
            ...this.getState(),
            mode: this.mode,
            adapter: 'RustAudioEngineAdapter',
            rustAvailable: true,
            lastCommand: this.lastCommand,
            lastError: this.lastError,
            updatedAt: Date.now()
        };
    }
}

class AudioEngineClient {
    constructor({ mode = 'webAudio', adapter, fallbackAdapter } = {}) {
        this.requestedMode = normalizeEngineMode(mode);
        this.fallbackAdapter = fallbackAdapter || adapter || new WebAudioEngineAdapter();
        this.adapter = adapter || this.fallbackAdapter;
        this.adapters = { [this.adapter.mode || 'webAudio']: this.adapter };
        if (this.fallbackAdapter) this.adapters[this.fallbackAdapter.mode || 'webAudio'] = this.fallbackAdapter;
        this.applyRequestedMode();
    }

    setRequestedMode(mode) {
        this.requestedMode = normalizeEngineMode(mode);
        this.applyRequestedMode();
    }

    registerAdapter(mode, adapter) {
        if (!adapter) return;
        this.adapters[normalizeEngineMode(mode)] = adapter;
        this.applyRequestedMode();
    }

    applyRequestedMode() {
        this.adapter = this.adapters[this.requestedMode] || this.fallbackAdapter || this.adapter;
    }

    command(type, payload = {}) {
        return this.adapter.command(type, payload);
    }

    getDiagnostics() {
        const diagnostics = this.adapter.getDiagnostics();
        const warnings = Array.isArray(diagnostics.warnings) ? diagnostics.warnings : [];
        if (this.requestedMode === 'rustAudio' && diagnostics.mode !== 'rustAudio') {
            warnings.push('rustAudio solicitado, usando fallback webAudio hasta que el motor nativo este disponible.');
        }
        return {
            ...diagnostics,
            requestedMode: this.requestedMode,
            activeMode: diagnostics.mode || 'webAudio',
            fallbackMode: 'webAudio',
            warnings
        };
    }
}

module.exports = {
    AUDIO_ENGINE_COMMANDS,
    AudioEngineClient,
    WebAudioEngineAdapter,
    RustAudioEngineAdapter,
    createEmptyDiagnostics,
    normalizeEngineMode
};
