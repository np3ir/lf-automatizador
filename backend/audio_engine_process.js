const fs = require('fs');
const path = require('path');
const readline = require('readline');

function resolveRustAudioEnginePath(rootDir) {
    const baseDir = path.resolve(rootDir);
    const candidates = [
        path.join(baseDir, 'audio-engine-rust', 'target', 'release', 'lf-audio-engine.exe'),
        path.join(baseDir, 'audio-engine-rust', 'target', 'debug', 'lf-audio-engine.exe')
    ];
    return candidates.find(candidate => fs.existsSync(candidate)) || candidates[0];
}

function isBenignRustStderr(message = '') {
    return String(message).includes('Dropping DeviceSink, audio playing through this sink will stop');
}

const SHADOW_DRIFT_WARN_MS = 750;
const SHADOW_DRIFT_SPIKE_MS = 250;
const SHADOW_DRIFT_LOG_INTERVAL_MS = 10000;
const SHADOW_DRIFT_EDGE_GUARD_MS = 3000;
const SHADOW_DRIFT_SHORT_ITEM_MS = 12000;
const SHADOW_DRIFT_PLAYER_SWITCH_GUARD_MS = 4000;
const SHADOW_DRIFT_STARTUP_GUARD_MS = 8000;
const SHADOW_DRIFT_ROUTE_GUARD_MS = 6000;
const SHADOW_DRIFT_PLAYBACK_COMMAND_GUARD_MS = 2500;
const SHADOW_DRIFT_LARGE_DESYNC_MS = 20000;
const REPORT_MAX_BYTES = 5 * 1024 * 1024;
const REPORT_KEEP_BYTES = 1024 * 1024;
const ROUTINE_STATUS_LOG_INTERVAL_MS = 30000;

class RustAudioEngineProbe {
    constructor({ rootDir, cp, writeLog } = {}) {
        this.rootDir = rootDir || path.join(__dirname, '..');
        this.cp = cp || require('child_process');
        this.writeLog = typeof writeLog === 'function' ? writeLog : () => {};
        this.exePath = resolveRustAudioEnginePath(this.rootDir);
        this.reportPath = path.join(this.rootDir, 'config', 'audio_engine_report.jsonl');
        this.process = null;
        this.readline = null;
        this.pending = [];
        this.pendingByRequestId = new Map();
        this.nextRequestId = 1;
        this.lastStatus = null;
        this.lastDevices = null;
        this.lastError = '';
        this.lastShadowDrift = null;
        this.lastShadowDriftIdentity = '';
        this.lastShadowDriftIdentityChangedAt = 0;
        this.lastShadowDriftRouteChangedAt = 0;
        this.lastShadowDriftPlaybackCommandAt = 0;
        this.shadowDriftStats = {
            startedAt: null,
            samples: 0,
            okSamples: 0,
            spikeSamples: 0,
            warnSamples: 0,
            ignoredSamples: 0,
            largeDesyncSamples: 0,
            maxAbsDriftMs: 0,
            avgAbsDriftMs: 0,
            lastWarnAt: null
        };
        this.lastShadowDriftLogAt = 0;
        this.lastRoutineStatusLogAt = 0;
        this.lastRoutineCommandLogAt = 0;
        this.startedAt = null;
        this.stopping = false;
        try { fs.mkdirSync(path.dirname(this.reportPath), { recursive: true }); } catch (err) {}
    }

    logEvent(type, data = {}) {
        if (type === 'command' && data.command?.cmd === 'encoder' && data.command?.action === 'status') {
            return;
        }
        if (type === 'command' && this.isRoutineCommand(data.command)) {
            const now = Date.now();
            if (now - this.lastRoutineCommandLogAt < ROUTINE_STATUS_LOG_INTERVAL_MS) return;
            this.lastRoutineCommandLogAt = now;
        }
        if (type === 'message' && this.isRoutineStatusMessage(data.message)) {
            const now = Date.now();
            if (now - this.lastRoutineStatusLogAt < ROUTINE_STATUS_LOG_INTERVAL_MS) return;
            this.lastRoutineStatusLogAt = now;
        }
        this.rotateReportIfNeeded();
        const entry = {
            at: new Date().toISOString(),
            type,
            engine: 'rustAudio',
            pid: this.process?.pid || null,
            ...data
        };
        try {
            fs.appendFileSync(this.reportPath, `${JSON.stringify(entry)}\n`, 'utf-8');
        } catch (err) {}
    }

    isRoutineCommand(command = {}) {
        if (!command || typeof command !== 'object') return false;
        if (command.cmd === 'transport' || command.cmd === 'status') return true;
        if (command.cmd === 'encoder' && command.action === 'status') return true;
        if (command.cmd === 'seek' && command.shadow === true) return true;
        return false;
    }

    isRoutineStatusMessage(message = {}) {
        return message?.type === 'status'
            && Array.isArray(message.players)
            && message.players.length > 0
            && message.players.every(player => player?.gain === 0 || player?.status === 'stopped');
    }

    rotateReportIfNeeded() {
        try {
            if (!fs.existsSync(this.reportPath)) return;
            const stat = fs.statSync(this.reportPath);
            if (stat.size <= REPORT_MAX_BYTES) return;
            const keepBytes = Math.min(REPORT_KEEP_BYTES, stat.size);
            const fd = fs.openSync(this.reportPath, 'r');
            const buffer = Buffer.alloc(keepBytes);
            fs.readSync(fd, buffer, 0, keepBytes, stat.size - keepBytes);
            fs.closeSync(fd);
            let tail = buffer.toString('utf-8');
            const firstNewline = tail.indexOf('\n');
            if (firstNewline >= 0) tail = tail.slice(firstNewline + 1);
            const marker = {
                at: new Date().toISOString(),
                type: 'report-rotated',
                engine: 'rustAudio',
                previousBytes: stat.size,
                keptBytes: Buffer.byteLength(tail, 'utf-8')
            };
            fs.writeFileSync(this.reportPath, `${JSON.stringify(marker)}\n${tail}`, 'utf-8');
        } catch (err) {}
    }

    isAvailable() {
        return fs.existsSync(this.exePath);
    }

    isRunning() {
        return !!(this.process && !this.process.killed && this.process.exitCode === null);
    }

    start() {
        if (this.isRunning()) return { success: true, alreadyRunning: true };
        if (!this.isAvailable()) {
            this.lastError = `No existe ${this.exePath}`;
            return { success: false, error: this.lastError };
        }

        try {
            this.process = this.cp.spawn(this.exePath, [], {
                cwd: path.dirname(this.exePath),
                windowsHide: true,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            this.startedAt = Date.now();
            this.lastShadowDriftRouteChangedAt = this.startedAt;
            this.lastShadowDriftPlaybackCommandAt = 0;
            this.lastError = '';
            this.stopping = false;
            this.logEvent('start', { exePath: this.exePath });

            this.readline = readline.createInterface({ input: this.process.stdout });
            this.readline.on('line', line => this.handleLine(line));
            this.process.stderr.on('data', chunk => {
                const stderrText = String(chunk || '').trim();
                if (!stderrText) return;
                if (isBenignRustStderr(stderrText)) {
                    this.logEvent('stderr-info', { message: stderrText });
                    return;
                }
                this.lastError = stderrText;
                this.writeLog(`[RustAudio] ${this.lastError}`);
                this.logEvent('stderr', { error: this.lastError });
            });
            this.process.on('error', err => {
                this.lastError = err.message || String(err);
                this.logEvent('process-error', { error: this.lastError });
                this.rejectPending(this.lastError);
            });
            this.process.on('close', code => {
                this.lastError = (code === 0 || this.stopping) ? '' : `Proceso RustAudio cerrado con codigo ${code}`;
                this.logEvent('close', { code, error: this.lastError });
                this.rejectPending(this.lastError || 'Proceso RustAudio cerrado.');
                this.process = null;
                this.readline = null;
            });
            return { success: true, started: true };
        } catch (err) {
            this.lastError = err.message || String(err);
            this.process = null;
            return { success: false, error: this.lastError };
        }
    }

    stop() {
        if (!this.process) return { success: true, stopped: false };
        try {
            this.stopping = true;
            this.process.kill();
        } catch (err) {}
        this.logEvent('stop');
        this.process = null;
        this.readline = null;
        this.rejectPending('Proceso RustAudio detenido.');
        return { success: true, stopped: true };
    }

    handleLine(line) {
        let message = null;
        try {
            message = JSON.parse(line);
        } catch (err) {
            this.lastError = `Respuesta RustAudio invalida: ${line}`;
            this.logEvent('parse-error', { line });
            return;
        }
        const pending = message.type === 'ready' ? null : this.takePendingForMessage(message);
        const isShadowCommand = pending?.command?.shadow === true || pending?.command?.player === 'shadow-active';
        if (message.type === 'status' || message.type === 'ready') {
            this.lastStatus = message;
            this.lastError = '';
            if (message.type === 'status') this.updateShadowDrift(message);
        } else if (message.type === 'devices') {
            this.lastDevices = message;
            this.lastError = '';
        } else if (message.type === 'error') {
            if (isShadowCommand) {
                this.logEvent('shadow-error', { command: pending.command, error: message.message || 'RustAudio reporto error.' });
            } else {
                this.lastError = message.message || 'RustAudio reporto error.';
            }
        }
        this.logEvent('message', { message });
        if (message.type === 'ready') return;
        if (pending) {
            clearTimeout(pending.timeout);
            if (message.type === 'error') {
                pending.resolve({ success: false, error: message.message || 'RustAudio reporto error.', message, status: this.lastStatus });
            } else {
                pending.resolve({ success: true, message, status: this.lastStatus });
            }
        }
    }

    updateShadowDrift(status = {}) {
        const transport = status.transport || null;
        const players = Array.isArray(status.players) ? status.players : [];
        const transportPlayerId = transport?.player || '';
        const shadow = players.find(player => player?.id === transportPlayerId)
            || players.find(player => player?.id === 'shadow-active');
        if (!transport || !shadow || !Number.isFinite(Number(transport.positionMs))) {
            this.lastShadowDrift = null;
            return;
        }
        const transportPositionMs = Number(transport.positionMs) || 0;
        const durationMs = Number(transport.durationMs) || 0;
        const shadowPositionMs = Number(shadow.positionMs) || 0;
        const driftMs = Math.round(shadowPositionMs - transportPositionMs);
        const absDriftMs = Math.abs(driftMs);
        const remainingMs = durationMs > 0 ? Math.max(0, durationMs - transportPositionMs) : null;
        const now = Date.now();
        const identity = [
            transport?.player || '',
            transport?.mixReferencePlayer || '',
            status.nowPlaying?.path || '',
            status.nowPlaying?.player || '',
            shadow.path || ''
        ].join('|');
        if (identity !== this.lastShadowDriftIdentity) {
            this.lastShadowDriftIdentity = identity;
            this.lastShadowDriftIdentityChangedAt = now;
        }
        const ignoreReason = this.getShadowDriftIgnoreReason({
            transport,
            shadow,
            transportPositionMs,
            durationMs,
            remainingMs,
            absDriftMs,
            now,
            identityAgeMs: this.lastShadowDriftIdentityChangedAt ? now - this.lastShadowDriftIdentityChangedAt : 0,
            nowPlaying: status.nowPlaying || null
        });
        const severity = ignoreReason
            ? 'ignored'
            : absDriftMs > SHADOW_DRIFT_WARN_MS
            ? 'warn'
            : absDriftMs > SHADOW_DRIFT_SPIKE_MS
                ? 'spike'
                : 'ok';
        if (!this.shadowDriftStats.startedAt) this.shadowDriftStats.startedAt = new Date().toISOString();
        if (ignoreReason) {
            this.shadowDriftStats.ignoredSamples += 1;
            if (ignoreReason === 'large-shadow-desync') this.shadowDriftStats.largeDesyncSamples += 1;
        } else {
            this.shadowDriftStats.samples += 1;
        }
        if (severity === 'warn') {
            this.shadowDriftStats.warnSamples += 1;
            this.shadowDriftStats.lastWarnAt = new Date().toISOString();
        } else if (severity === 'spike') {
            this.shadowDriftStats.spikeSamples += 1;
            this.shadowDriftStats.okSamples += 1;
        } else if (severity === 'ok') {
            this.shadowDriftStats.okSamples += 1;
        }
        if (!ignoreReason) {
            this.shadowDriftStats.maxAbsDriftMs = Math.max(this.shadowDriftStats.maxAbsDriftMs, absDriftMs);
            this.shadowDriftStats.avgAbsDriftMs = Math.round(
                (((this.shadowDriftStats.avgAbsDriftMs || 0) * (this.shadowDriftStats.samples - 1)) + absDriftMs)
                    / this.shadowDriftStats.samples
            );
        }
        this.lastShadowDrift = {
            at: new Date().toISOString(),
            player: shadow.id || '',
            status: shadow.status || '',
            audioReady: !!shadow.audioReady,
            transportStatus: transport.status || '',
            startCause: transport.startCause || '',
            mixActive: transport.mixActive === true,
            mixPhase: transport.mixPhase || '',
            mixDirection: transport.mixDirection || '',
            mixReferencePlayer: transport.mixReferencePlayer || '',
            transportPositionMs,
            durationMs,
            remainingMs,
            shadowPositionMs,
            driftMs,
            absDriftMs,
            thresholdMs: SHADOW_DRIFT_WARN_MS,
            spikeThresholdMs: SHADOW_DRIFT_SPIKE_MS,
            severity,
            ignoreReason
        };
        if (severity === 'warn' && now - this.lastShadowDriftLogAt > SHADOW_DRIFT_LOG_INTERVAL_MS) {
            this.lastShadowDriftLogAt = now;
            this.logEvent('shadow-drift', { drift: this.lastShadowDrift });
        }
    }

    getShadowDriftIgnoreReason({ transport, shadow, transportPositionMs, durationMs, remainingMs, absDriftMs, now, identityAgeMs, nowPlaying } = {}) {
        if (transport?.status !== 'playing') return 'transport-idle';
        if (shadow?.status !== 'playing') return 'shadow-idle';
        if (!shadow?.audioReady) return 'shadow-not-ready';
        if (this.startedAt && Number.isFinite(now) && now - this.startedAt < SHADOW_DRIFT_STARTUP_GUARD_MS) return 'rust-startup';
        if (this.lastShadowDriftRouteChangedAt && Number.isFinite(now) && now - this.lastShadowDriftRouteChangedAt < SHADOW_DRIFT_ROUTE_GUARD_MS) return 'routing-change';
        if (this.lastShadowDriftPlaybackCommandAt && Number.isFinite(now) && now - this.lastShadowDriftPlaybackCommandAt < SHADOW_DRIFT_PLAYBACK_COMMAND_GUARD_MS) return 'playback-command';
        if (transport?.startCause === 'manual-jump' && Number.isFinite(identityAgeMs) && identityAgeMs < SHADOW_DRIFT_PLAYER_SWITCH_GUARD_MS + 2000) return 'manual-jump';
        if (transport?.mixActive === true) return 'mix-active';
        if (transport?.mixPhase === 'cola-fade') return 'fade-tail';
        if (Number.isFinite(identityAgeMs) && identityAgeMs < SHADOW_DRIFT_PLAYER_SWITCH_GUARD_MS) return 'player-switch';
        if (nowPlaying?.player && transport?.player && nowPlaying.player !== transport.player) return 'player-mismatch';
        if (transport?.mixReferencePlayer && transport.mixReferencePlayer !== transport.player) return 'mix-reference';
        if (durationMs > 0 && durationMs <= SHADOW_DRIFT_SHORT_ITEM_MS) return 'short-item';
        if (transportPositionMs < SHADOW_DRIFT_EDGE_GUARD_MS) return 'track-start';
        if (Number.isFinite(remainingMs) && remainingMs < SHADOW_DRIFT_EDGE_GUARD_MS) return 'track-end';
        if (Number.isFinite(absDriftMs) && absDriftMs >= SHADOW_DRIFT_LARGE_DESYNC_MS) return 'large-shadow-desync';
        return '';
    }

    markShadowDriftCommand(command = {}) {
        const cmd = command?.cmd || '';
        const now = Date.now();
        if (cmd === 'route' || cmd === 'devices') {
            this.lastShadowDriftRouteChangedAt = now;
            return;
        }
        if (['loadAudio', 'play', 'stop', 'seek', 'nowPlaying'].includes(cmd)) {
            this.lastShadowDriftPlaybackCommandAt = now;
        }
    }

    takePendingForMessage(message = {}) {
        const requestId = message.requestId || '';
        if (requestId && this.pendingByRequestId.has(requestId)) {
            const pending = this.pendingByRequestId.get(requestId);
            this.pendingByRequestId.delete(requestId);
            this.pending = this.pending.filter(item => item !== pending);
            return pending;
        }
        if (requestId) return null;
        const pending = this.pending.shift();
        if (pending?.requestId) this.pendingByRequestId.delete(pending.requestId);
        return pending || null;
    }

    rejectPending(error) {
        const pendingItems = this.pending.splice(0);
        this.pendingByRequestId.clear();
        pendingItems.forEach(pending => {
            clearTimeout(pending.timeout);
            pending.resolve({ success: false, error });
        });
    }

    command(command = {}) {
        const started = this.start();
        if (!started.success) return Promise.resolve(started);
        return new Promise(resolve => {
            const requestId = command.requestId || `rust-${Date.now()}-${this.nextRequestId++}`;
            const commandWithRequestId = { ...command, requestId };
            const timeout = setTimeout(() => {
                this.pending = this.pending.filter(item => item.resolve !== resolve);
                this.pendingByRequestId.delete(requestId);
                resolve({ success: false, error: 'Timeout esperando respuesta RustAudio.' });
            }, 3000);
            const pending = { resolve, timeout, command: commandWithRequestId, requestId };
            this.pending.push(pending);
            this.pendingByRequestId.set(requestId, pending);
            try {
                this.markShadowDriftCommand(commandWithRequestId);
                this.logEvent('command', { command: commandWithRequestId });
                this.process.stdin.write(`${JSON.stringify(commandWithRequestId)}\n`);
            } catch (err) {
                clearTimeout(timeout);
                this.pending = this.pending.filter(item => item.resolve !== resolve);
                this.pendingByRequestId.delete(requestId);
                this.logEvent('command-error', { command: commandWithRequestId, error: err.message || String(err) });
                resolve({ success: false, error: err.message || String(err) });
            }
        });
    }

    readReportTail(maxLines = 30) {
        const limit = Math.max(1, Math.min(200, Number(maxLines) || 30));
        try {
            if (!fs.existsSync(this.reportPath)) {
                return { success: true, reportPath: this.reportPath, entries: [] };
            }
            const lines = fs.readFileSync(this.reportPath, 'utf-8')
                .split(/\r?\n/)
                .filter(Boolean)
                .slice(-limit);
            const entries = lines.map(line => {
                try { return JSON.parse(line); } catch (err) { return { raw: line }; }
            });
            return { success: true, reportPath: this.reportPath, entries };
        } catch (err) {
            return { success: false, reportPath: this.reportPath, error: err.message || String(err), entries: [] };
        }
    }

    writeDiagnosticsSnapshot(extra = {}) {
        const snapshotPath = path.join(this.rootDir, 'config', 'audio_engine_snapshot.json');
        const snapshot = {
            at: new Date().toISOString(),
            engine: 'rustAudio',
            available: this.isAvailable(),
            running: this.isRunning(),
            exePath: this.exePath,
            reportPath: this.reportPath,
            lastStatus: this.lastStatus,
            lastDevices: this.lastDevices,
            lastError: this.lastError,
            shadowDrift: this.lastShadowDrift,
            shadowDriftStats: this.shadowDriftStats,
            ...extra
        };
        try {
            fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
            this.logEvent('snapshot', { snapshotPath });
            return { success: true, snapshotPath, snapshot };
        } catch (err) {
            return { success: false, snapshotPath, error: err.message || String(err), snapshot };
        }
    }

    status() {
        return {
            available: this.isAvailable(),
            running: this.isRunning(),
            exePath: this.exePath,
            startedAt: this.startedAt,
            lastStatus: this.lastStatus,
            lastDevices: this.lastDevices,
            lastError: this.lastError,
            shadowDrift: this.lastShadowDrift,
            shadowDriftStats: this.shadowDriftStats,
            reportPath: this.reportPath,
            snapshotPath: path.join(this.rootDir, 'config', 'audio_engine_snapshot.json')
        };
    }
}

module.exports = {
    RustAudioEngineProbe,
    resolveRustAudioEnginePath
};
