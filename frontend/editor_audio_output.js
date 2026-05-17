const fs = require('fs');
const path = require('path');
const { normalizeAudioPrefs } = require('./audio_prefs');

const configDir = path.join(__dirname, '..', 'config');
const generalPrefsPath = path.join(configDir, 'general_settings.json');

function loadAudioPrefs() {
    try {
        if (fs.existsSync(generalPrefsPath)) {
            return normalizeAudioPrefs(JSON.parse(fs.readFileSync(generalPrefsPath, 'utf-8')));
        }
    } catch (err) {}
    return normalizeAudioPrefs({});
}

function createEditorOutputRouter(audioCtx) {
    const outputNode = audioCtx.createGain();
    const routeNode = audioCtx.createGain();
    const streamNode = audioCtx.createMediaStreamDestination();
    const previewEl = new Audio();
    let outputMode = null;

    outputNode.connect(routeNode);
    previewEl.srcObject = streamNode.stream;

    function setOutputMode(nextMode) {
        if (outputMode === nextMode) return;
        outputMode = nextMode;
        try { routeNode.disconnect(); } catch (err) {}
        if (nextMode === 'direct') {
            routeNode.connect(audioCtx.destination);
            try { previewEl.pause(); } catch (err) {}
        } else if (nextMode === 'muted') {
            try { previewEl.pause(); } catch (err) {}
        } else {
            routeNode.connect(streamNode);
        }
    }

    function ensurePreviewPlayback() {
        if (outputMode !== 'stream') return;
        previewEl.play().catch(() => {});
    }

    async function applyRouting() {
        const audioPrefs = loadAudioPrefs();
        if (audioPrefs.audioEngineMode === 'rustAudio') {
            setOutputMode('muted');
            return;
        }
        const targetDeviceId = audioPrefs.outCue || audioPrefs.outMain || 'default';
        const wantsDefaultSink = !targetDeviceId || targetDeviceId === 'default';

        if (audioCtx.setSinkId) {
            setOutputMode('direct');
            try {
                await audioCtx.setSinkId(wantsDefaultSink ? 'default' : targetDeviceId);
                return;
            } catch (err) {}
        }

        if (wantsDefaultSink) {
            setOutputMode('direct');
            return;
        }

        setOutputMode('stream');
        ensurePreviewPlayback();
        if (previewEl.setSinkId) {
            try { await previewEl.setSinkId(targetDeviceId); }
            catch (err) {}
        }
    }

    return {
        outputNode,
        applyRouting,
        ensurePreviewPlayback
    };
}

module.exports = {
    loadAudioPrefs,
    createEditorOutputRouter
};
