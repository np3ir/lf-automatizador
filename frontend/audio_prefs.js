const AUDIO_PREFS_DEFAULTS = {
    outMain: 'default',
    outMonitor: 'default',
    outCue: 'default',
    outCartwall: 'default',
    outEditor: 'default',
    monitorVolume: 100,
    monitorEnabled: false,
    monitorSourceMode: 'postFx',
    monitorVolumeUiEnabled: true,
    monitorVolumeUiMode: 'inline',
    playlistOutputMode: 'disabled',
    playlistSharedDevice: 'default',
    playlistOutputs: ['default', 'default', 'default', 'default'],
    cartwallOutputMode: 'master',
    audioEngineMode: 'webAudio',
    eventPreHoldActive: true,
    eventPreHoldSeconds: 20
};

function normalizePlaylistOutputs(rawOutputs, fallbackDevice) {
    const outputs = Array.isArray(rawOutputs) ? rawOutputs : [];
    return Array.from({ length: 4 }, (_, idx) => outputs[idx] || fallbackDevice || 'default');
}

function normalizeAudioPrefs(prefs = {}) {
    const mainDevice = prefs.outMain || AUDIO_PREFS_DEFAULTS.outMain;
    const monitorDevice = prefs.outMonitor || mainDevice;
    const cueDevice = prefs.outCue || mainDevice;
    const sharedPlaylistDevice = prefs.playlistSharedDevice || monitorDevice || mainDevice;
    const playlistMode = ['disabled', 'shared', 'independent'].includes(prefs.playlistOutputMode)
        ? prefs.playlistOutputMode
        : AUDIO_PREFS_DEFAULTS.playlistOutputMode;
    const cartwallMode = ['master', 'monitor', 'cue', 'device'].includes(prefs.cartwallOutputMode)
        ? prefs.cartwallOutputMode
        : AUDIO_PREFS_DEFAULTS.cartwallOutputMode;
    const audioEngineMode = prefs.audioEngineMode === 'rustAudio' ? 'rustAudio' : AUDIO_PREFS_DEFAULTS.audioEngineMode;
    const monitorVolumeUiMode = ['inline', 'icon'].includes(prefs.monitorVolumeUiMode)
        ? prefs.monitorVolumeUiMode
        : AUDIO_PREFS_DEFAULTS.monitorVolumeUiMode;
    const monitorSourceMode = ['postFx', 'preFx'].includes(prefs.monitorSourceMode)
        ? prefs.monitorSourceMode
        : AUDIO_PREFS_DEFAULTS.monitorSourceMode;

    return {
        ...prefs,
        outMain: mainDevice,
        outMonitor: monitorDevice,
        outCue: cueDevice,
        outCartwall: prefs.outCartwall || mainDevice,
        outEditor: cueDevice,
        monitorVolume: Math.max(0, Math.min(100, parseInt(prefs.monitorVolume, 10) || AUDIO_PREFS_DEFAULTS.monitorVolume)),
        monitorEnabled: prefs.monitorEnabled === true,
        monitorSourceMode,
        monitorVolumeUiEnabled: prefs.monitorVolumeUiEnabled !== false,
        monitorVolumeUiMode,
        playlistOutputMode: playlistMode,
        playlistSharedDevice: sharedPlaylistDevice,
        playlistOutputs: normalizePlaylistOutputs(prefs.playlistOutputs, sharedPlaylistDevice || mainDevice),
        cartwallOutputMode: cartwallMode,
        audioEngineMode,
        eventPreHoldActive: prefs.eventPreHoldActive !== false,
        eventPreHoldSeconds: Math.max(1, Math.min(120, parseInt(prefs.eventPreHoldSeconds, 10) || AUDIO_PREFS_DEFAULTS.eventPreHoldSeconds))
    };
}

module.exports = {
    AUDIO_PREFS_DEFAULTS,
    normalizeAudioPrefs
};
