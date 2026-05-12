const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const nodeID3 = require('node-id3');

let mm;
try { mm = require('music-metadata'); } catch (e) { console.error("Falta music-metadata"); }

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function dbToAmplitude(db) { return Math.pow(10, db / 20); }

function isMatchValid(searchArtist, searchTitle, resultArtist, resultTitle) {
    const clean = (str) => str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    const sA_words = clean(searchArtist);
    const sT_words = clean(searchTitle);
    const rA_words = clean(resultArtist);
    const rT_words = clean(resultTitle);
    if (sA_words.length === 0 && sT_words.length === 0) return true; 
    const artistMatch = sA_words.some(w => rA_words.includes(w)) || rA_words.some(w => sA_words.includes(w));
    const titleMatch = sT_words.some(w => rT_words.includes(w)) || rT_words.some(w => sT_words.includes(w));
    return artistMatch || titleMatch;
}

async function fetchMusicBrainz(title, artist) {
    try {
        const query = encodeURIComponent(`recording:${title} AND artist:${artist}`);
        const response = await fetch(`https://musicbrainz.org/ws/2/recording/?query=${query}&fmt=json`, {
            headers: { 'User-Agent': 'LF-Automatizador/1.0 ( luisfernando@peru.com )' }
        });
        const data = await response.json();
        if (data.recordings && data.recordings.length > 0) {
            let releases = [];
            data.recordings.forEach(rec => { if (rec.releases) rec.releases.forEach(rel => { if (rel.date) releases.push(rel); }); });
            if (releases.length > 0) {
                releases.sort((a, b) => a.date.localeCompare(b.date));
                const oldest = releases[0];
                let artistCredit = '';
                try { artistCredit = data.recordings[0]['artist-credit'].reduce((str, ac) => str + ac.name + (ac.joinphrase || ''), ''); }
                catch(e) { artistCredit = data.recordings[0]['artist-credit'][0].name; }
                return { title: data.recordings[0].title, artist: artistCredit, album: oldest.title, year: oldest.date.substring(0, 4), source: 'MusicBrainz' };
            }
        }
        return null;
    } catch (e) { return null; }
}

async function fetchiTunes(title, artist) {
    try {
        const term = encodeURIComponent(`${title} ${artist}`);
        const response = await fetch(`https://itunes.apple.com/search?term=${term}&resource=song&limit=5`);
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            data.results.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
            const best = data.results[0];
            return { title: best.trackName, artist: best.artistName, album: best.collectionName, year: best.releaseDate.substring(0, 4), source: 'iTunes' };
        }
        return null;
    } catch (e) { return null; }
}

ipcRenderer.on('start-analysis', async (e, task) => {
    try {
        let result = { filePath: task.filePath, success: true, db: null, bpm: null, inicio: null, fin: null, mix: null, title: null, artist: null, album: null, year: null, duration: 0, metaFound: null };
        const isMp3 = path.extname(task.filePath).toLowerCase() === '.mp3';

        if (task.mode === 'meta') {
            let meta = await fetchMusicBrainz(task.cleanTitle, task.cleanArtist);
            if (!meta) meta = await fetchiTunes(task.cleanTitle, task.cleanArtist);
            if (meta && isMatchValid(task.cleanArtist, task.cleanTitle, meta.artist, meta.title)) {
                result.title = meta.title; result.artist = meta.artist; result.album = meta.album; result.year = meta.year; result.metaFound = true;
            } else { result.metaFound = false; }
        }

        if (task.mode === 'local-meta') {
            if (mm) {
                const metadata = await mm.parseFile(task.filePath);
                result.title = metadata.common.title || task.filename.replace(/\.[^/.]+$/, "");
                result.artist = metadata.common.artist || "";
                result.album = metadata.common.album || "";
                result.year = metadata.common.year ? metadata.common.year.toString() : "";
                result.duration = Math.round(metadata.format.duration || 0);
            }
        }

        if (task.mode === 'audio') {
            const buffer = fs.readFileSync(task.filePath);
            const audioBuffer = await audioCtx.decodeAudioData(buffer.buffer);
            const channelData = audioBuffer.getChannelData(0);
            if (task.doGain) {
                let sumSquares = 0; for (let i = 0; i < channelData.length; i += 100) sumSquares += channelData[i] * channelData[i];
                let rms = Math.sqrt(sumSquares / (channelData.length / 100));
                result.db = (20 * Math.log10(rms || 0.0001)).toFixed(1);
            }
            if (task.doCues) {
                const ampStartEnd = dbToAmplitude(task.dbStartEnd);
                const ampMix = dbToAmplitude(task.dbMix);
                let startPoint = 0, endPoint = audioBuffer.duration, mixPoint = audioBuffer.duration;
                for (let i = 0; i < channelData.length; i++) if (Math.abs(channelData[i]) > ampStartEnd) { startPoint = i / audioBuffer.sampleRate; break; }
                for (let i = channelData.length - 1; i >= 0; i--) if (Math.abs(channelData[i]) > ampStartEnd) { endPoint = i / audioBuffer.sampleRate; break; }
                const endSample = Math.floor(endPoint * audioBuffer.sampleRate);
                for (let i = endSample; i >= 0; i--) if (Math.abs(channelData[i]) > ampMix) { mixPoint = i / audioBuffer.sampleRate; break; }
                result.inicio = startPoint.toFixed(3); result.fin = endPoint.toFixed(3); result.mix = mixPoint.toFixed(3);
            }
            if (task.doBpm) {
                let maxVolume = 0; for(let i=0; i<channelData.length; i+=500) if(Math.abs(channelData[i]) > maxVolume) maxVolume = Math.abs(channelData[i]);
                const dynamicThreshold = maxVolume * 0.5; const minSilence = audioBuffer.sampleRate * 0.25; 
                const peaks = []; let lastPeak = 0;
                for(let i=0; i<channelData.length; i++) if(Math.abs(channelData[i]) > dynamicThreshold) if(i - lastPeak > minSilence) { peaks.push(i); lastPeak = i; }
                let estimatedBpm = "N/A";
                if (peaks.length > 10) {
                    const intervals = {};
                    for(let i=1; i<peaks.length; i++) {
                        const dist = peaks[i] - peaks[i-1]; const bpmVal = Math.round(60 / (dist / audioBuffer.sampleRate));
                        if(bpmVal >= 40 && bpmVal <= 200) intervals[bpmVal] = (intervals[bpmVal] || 0) + 1;
                    }
                    let maxCount = 0; for(const b in intervals) if(intervals[b] > maxCount) { maxCount = intervals[b]; estimatedBpm = parseInt(b); }
                    if (estimatedBpm !== "N/A") { while (estimatedBpm < 75) estimatedBpm *= 2; while (estimatedBpm > 155) estimatedBpm = Math.round(estimatedBpm / 2); }
                }
                result.bpm = estimatedBpm;
            }
        }
        ipcRenderer.send('analysis-result', result);
    } catch (error) { ipcRenderer.send('analysis-result', { filePath: task.filePath, success: false }); }
});