function ampToPercent(amp) {
    if (amp <= 0.0001) return 0;
    const db = 20 * Math.log10(amp);
    if (db < -36) return 0;
    if (db > 3) return 100;
    return ((db + 36) / 39) * 100;
}

function ampToDb(amp) {
    if (!(amp > 0.0000001)) return Number.NEGATIVE_INFINITY;
    return 20 * Math.log10(amp);
}

const analyserBufferCache = new WeakMap();

function getPeak(analyser) {
    let dataArray = analyserBufferCache.get(analyser);
    if (!dataArray || dataArray.length !== analyser.fftSize) {
        dataArray = new Float32Array(analyser.fftSize);
        analyserBufferCache.set(analyser, dataArray);
    }
    analyser.getFloatTimeDomainData(dataArray);
    let max = 0;
    for (let i = 0; i < dataArray.length; i++) {
        const sample = Math.abs(dataArray[i]);
        if (sample > max) max = sample;
    }
    return max;
}

function createMeteringAnalyser(audioCtx, inputNode, fftSize = 1024) {
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = fftSize;
    const splitter = audioCtx.createChannelSplitter(2);
    const leftAnalyser = audioCtx.createAnalyser();
    const rightAnalyser = audioCtx.createAnalyser();
    leftAnalyser.fftSize = fftSize;
    rightAnalyser.fftSize = fftSize;

    const silentSink = audioCtx.createGain();
    silentSink.gain.value = 0;

    inputNode.connect(analyser);
    inputNode.connect(splitter);
    splitter.connect(leftAnalyser, 0);
    splitter.connect(rightAnalyser, 1);
    analyser.connect(silentSink);
    leftAnalyser.connect(silentSink);
    rightAnalyser.connect(silentSink);
    silentSink.connect(audioCtx.destination);

    return {
        analyser,
        leftAnalyser,
        rightAnalyser
    };
}

function getAnalyserNode(metering) {
    return metering?.analyser || metering || null;
}

function getStereoAnalysers(metering) {
    const primary = getAnalyserNode(metering);
    return {
        left: metering?.leftAnalyser || primary,
        right: metering?.rightAnalyser || primary
    };
}

function startCueVuMeter(ipcRenderer, metering, sourceKey, throttleMs = 100) {
    const analyser = getAnalyserNode(metering);
    if (!ipcRenderer || !analyser || !sourceKey) return () => {};
    const stereo = getStereoAnalysers(metering);

    let rafId = null;
    let lastSentAt = 0;

    const sendLevel = (level) => {
        const safeLevel = Math.max(0, Math.min(100, Math.round(level || 0)));
        ipcRenderer.send('aux-vu-levels', {
            source: sourceKey,
            cue: safeLevel,
            cueDb: safeLevel > 0 ? ((safeLevel / 100) * 39) - 36 : Number.NEGATIVE_INFINITY,
            cueStereo: {
                left: safeLevel,
                right: safeLevel
            },
            cueStereoDbs: {
                left: safeLevel > 0 ? ((safeLevel / 100) * 39) - 36 : Number.NEGATIVE_INFINITY,
                right: safeLevel > 0 ? ((safeLevel / 100) * 39) - 36 : Number.NEGATIVE_INFINITY
            }
        });
    };

    const tick = () => {
        const now = Date.now();
        if (now - lastSentAt >= throttleMs) {
            const peakLeft = getPeak(stereo.left);
            const peakRight = getPeak(stereo.right);
            const percentLeft = Math.max(0, Math.min(100, Math.round(ampToPercent(peakLeft) || 0)));
            const percentRight = Math.max(0, Math.min(100, Math.round(ampToPercent(peakRight) || 0)));
            ipcRenderer.send('aux-vu-levels', {
                source: sourceKey,
                cue: Math.max(percentLeft, percentRight),
                cueDb: Math.max(ampToDb(peakLeft), ampToDb(peakRight)),
                cueStereo: {
                    left: percentLeft,
                    right: percentRight
                },
                cueStereoDbs: {
                    left: ampToDb(peakLeft),
                    right: ampToDb(peakRight)
                }
            });
            lastSentAt = now;
        }
        rafId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        sendLevel(0);
    };
}

module.exports = {
    ampToDb,
    createMeteringAnalyser,
    startCueVuMeter
};
