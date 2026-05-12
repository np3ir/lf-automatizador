const { ipcRenderer } = require('electron');
const path = require('path');
const url = require('url');
const { loadAudioPrefs } = require('./editor_audio_output');

let currentCard = null;
let currentTracks = [];
let currentFilePath = '';
let genreProfiles = [];
let countryProfiles = [];
let selectedTrackPaths = new Set();
let pendingOnlineMeta = null;
let previewAudio = null;
let previewPath = '';
let hasUnsavedChanges = false;
let trackFilter = '';

const $ = (id) => document.getElementById(id);

function setStatus(message, tone = '') {
    const el = $('artist-status');
    if (!el) return;
    el.textContent = message;
    el.style.color = tone === 'ok' ? '#2ecc71' : tone === 'warn' ? '#f39c12' : '#888';
}

function markDirty(isDirty = true) {
    hasUnsavedChanges = isDirty;
    $('btn-save-top')?.classList.toggle('dirty', isDirty);
    if (isDirty) setStatus('Cambios sin guardar.', 'warn');
}

async function applyPreviewOutput(audio) {
    if (!audio?.setSinkId) return;
    const prefs = loadAudioPrefs();
    const targetDeviceId = prefs.outCue || prefs.outMain || 'default';
    try {
        await audio.setSinkId(targetDeviceId || 'default');
    } catch (err) {}
}

function stopPreview() {
    if (previewAudio) {
        try {
            previewAudio.pause();
            previewAudio.currentTime = 0;
            previewAudio.removeAttribute('src');
            previewAudio.load();
        } catch (err) {}
    }
    previewAudio = null;
    previewPath = '';
    document.querySelectorAll('.preview-btn.playing').forEach(btn => {
        btn.classList.remove('playing');
        btn.textContent = '▶';
        btn.title = 'Preescuchar';
    });
}

async function togglePreview(filePath) {
    if (!filePath) return;
    if (previewPath === filePath && previewAudio) {
        stopPreview();
        return;
    }
    stopPreview();
    previewPath = filePath;
    previewAudio = new Audio(url.pathToFileURL(filePath).href);
    previewAudio.preload = 'metadata';
    await applyPreviewOutput(previewAudio);
    const button = [...document.querySelectorAll('.preview-btn')].find(btn => btn.dataset.path === filePath);
    if (button) {
        button.classList.add('playing');
        button.textContent = '■';
        button.title = 'Detener preescucha';
    }
    previewAudio.onended = stopPreview;
    previewAudio.onerror = () => {
        setStatus('No se pudo reproducir la preescucha.', 'warn');
        stopPreview();
    };
    previewAudio.play().catch(() => {
        setStatus('No se pudo iniciar la preescucha.', 'warn');
        stopPreview();
    });
}

function setMode(mode) {
    document.body.className = `mode-${mode}`;
    $('btn-read')?.classList.toggle('active', mode === 'read');
    $('btn-edit')?.classList.toggle('active', mode === 'edit');
}

function pill(text, options = {}) {
    const span = document.createElement('span');
    span.className = 'genre-pill';
    span.textContent = text;
    if (options.genreLink) {
        span.title = `Abrir genero ${text}`;
        span.style.cursor = 'pointer';
        span.addEventListener('click', (event) => {
            event.stopPropagation();
            ipcRenderer.send('open-genre-editor', {
                genreKey: options.genreKey || '',
                displayName: text
            });
        });
    }
    return span;
}

function csvParts(value) {
    return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

function nationalityParts(value) {
    return String(value || '').split(/\s*(?:,|\/|\|)\s*/).map(item => item.trim()).filter(Boolean);
}

function resolveCountryName(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const key = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const found = countryProfiles.find(country => {
        const names = [country.name, ...(country.aliases || [])].filter(Boolean);
        return names.some(name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === key);
    });
    return found?.name || raw;
}

function normalizeNationalitiesInput(value) {
    const seen = new Set();
    return nationalityParts(value)
        .map(resolveCountryName)
        .filter(name => {
            const key = name.toLocaleLowerCase();
            if (!name || seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .join(' / ');
}

function renderCsvPills(container, value, fallback = 'Sin datos', options = {}) {
    container.innerHTML = '';
    const parts = csvParts(value);
    if (!parts.length) {
        container.textContent = fallback;
        return;
    }
    parts.forEach(item => container.appendChild(pill(item, options)));
}

function renderWikiText() {
    const container = $('read-biography');
    if (!container) return;
    container.innerHTML = '';
    const text = currentCard?.biography || currentCard?.notes || 'Sin biografia registrada.';
    const pattern = /\[([^\]]+)\]/g;
    let last = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
        container.appendChild(document.createTextNode(text.slice(last, match.index)));
        const link = document.createElement('span');
        link.className = 'wiki-link';
        link.dataset.artistName = match[1];
        link.textContent = match[1];
        link.title = `Abrir cedula de ${match[1]}`;
        link.addEventListener('click', () => ipcRenderer.send('open-artist-card-by-name', match[1]));
        container.appendChild(link);
        last = pattern.lastIndex;
    }
    container.appendChild(document.createTextNode(text.slice(last)));
}

function renderPhoto() {
    const img = $('artist-photo');
    const placeholder = $('photo-placeholder');
    const title = $('artist-title');
    const name = currentCard?.displayName || $('artist-name')?.value || 'Artista';
    title.textContent = name;
    placeholder.textContent = name;
    const photoPath = currentCard?.photoLocalPath || currentCard?.photoUrl || pendingOnlineMeta?.photoUrl || '';
    if (photoPath) {
        img.src = photoPath;
        img.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        img.removeAttribute('src');
        img.style.display = 'none';
        placeholder.style.display = 'block';
    }
}

function populateGenreSelect() {
    const select = $('artist-main-genre');
    if (!select) return;
    const current = currentCard?.mainGenreKey || currentCard?.habitualGenre || '';
    select.innerHTML = '';
    const na = document.createElement('option');
    na.value = 'N/A Multigenero';
    na.textContent = 'N/A Multigenero';
    select.appendChild(na);
    genreProfiles
        .filter(genre => !genre.parentGenre)
        .forEach(genre => {
            const option = document.createElement('option');
            option.value = genre.displayName || genre.genreKey;
            option.dataset.key = genre.genreKey || '';
            option.textContent = genre.displayName || genre.genreKey;
            select.appendChild(option);
        });
    const byKey = Array.from(select.options).find(option => option.dataset.key === current);
    if (byKey) byKey.selected = true;
    else if (currentCard?.mainGenreName || currentCard?.habitualGenreName) select.value = currentCard.mainGenreName || currentCard.habitualGenreName;
}

function populateBulkGenreDatalist() {
    const datalist = $('bulk-genre-options');
    if (!datalist) return;
    datalist.innerHTML = '';
    const seen = new Set();
    genreProfiles.forEach(genre => {
        const name = String(genre?.displayName || '').trim();
        const key = name.toLocaleLowerCase();
        if (!name || seen.has(key)) return;
        seen.add(key);
        const option = document.createElement('option');
        option.value = name;
        datalist.appendChild(option);
    });
}

function renderCollaborators() {
    const container = $('collab-grid');
    if (!container) return;
    container.innerHTML = '';
    const counts = new Map();
    currentTracks.forEach(track => {
        String(track.artist || track.customArtist || '').split(/feat\.?|,|&/i)
            .map(item => item.trim())
            .filter(item => item && item.toLowerCase() !== String(currentCard?.displayName || '').toLowerCase())
            .forEach(item => counts.set(item, (counts.get(item) || 0) + 1));
    });
    const names = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name]) => name);
    if (!names.length) names.push('Sin colaboradores detectados');
    names.forEach(name => {
        const div = document.createElement('div');
        div.className = 'collab-item';
        div.textContent = name;
        if (name !== 'Sin colaboradores detectados') div.addEventListener('click', () => ipcRenderer.send('open-artist-card-by-name', name));
        container.appendChild(div);
    });
}

function syncSelectionView() {
    document.querySelectorAll('#artist-tracks-body tr[data-path]').forEach(row => {
        const selected = selectedTrackPaths.has(row.dataset.path);
        row.classList.toggle('selected', selected);
    });
    if ($('selected-track-count')) $('selected-track-count').textContent = `${selectedTrackPaths.size} seleccionada(s)`;
}

function normalizeTrackSearch(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function visibleTracks() {
    const query = normalizeTrackSearch(trackFilter);
    if (!query) return currentTracks;
    return currentTracks.filter(track => normalizeTrackSearch([
        track.title,
        track.artist,
        track.genre,
        track.primaryGenre,
        track.subgenresCsv,
        track.subgenre,
        track.role,
        track.year,
        track.filePath
    ].join(' ')).includes(query));
}

function renderTracks() {
    const tbody = $('artist-tracks-body');
    tbody.innerHTML = '';
    const rows = visibleTracks();
    $('tracks-title').textContent = `Biblioteca Musical Enlazada (${rows.length}/${currentTracks.length} tracks)`;
    if (!rows.length) {
        const row = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 7;
        td.textContent = currentTracks.length ? 'No hay canciones que coincidan con la busqueda.' : 'No hay canciones enlazadas a este artista.';
        row.appendChild(td);
        tbody.appendChild(row);
        syncSelectionView();
        return;
    }
    rows.forEach(track => {
        const row = document.createElement('tr');
        row.dataset.path = track.filePath;

        const titleCell = document.createElement('td');
        titleCell.title = track.filePath || '';
        titleCell.style.fontWeight = '700';
        titleCell.style.color = '#fff';
        titleCell.textContent = track.title || path.basename(track.filePath || '');

        const genreCell = document.createElement('td');
        const genreLabel = track.genre || track.primaryGenre || '';
        if (genreLabel) genreCell.appendChild(pill(genreLabel, { genreLink: true, genreKey: track.primaryGenre || '' }));
        else genreCell.textContent = 'Sin genero';

        const subgenreCell = document.createElement('td');
        const trackSubgenres = track.subgenresCsv || track.subgenre || '';
        if (trackSubgenres) renderCsvPills(subgenreCell, trackSubgenres, '', { genreLink: true });

        const roleCell = document.createElement('td');
        roleCell.style.color = track.role === 'main' ? '#2ecc71' : '#f39c12';
        roleCell.textContent = track.role === 'main' ? 'Principal' : 'Colaboracion';

        const yearCell = document.createElement('td');
        yearCell.textContent = track.year || '';

        const playCell = document.createElement('td');
        playCell.className = 'play-col';
        const playButton = document.createElement('button');
        playButton.className = 'preview-btn';
        playButton.type = 'button';
        playButton.textContent = previewPath === track.filePath ? '■' : '▶';
        playButton.title = previewPath === track.filePath ? 'Detener preescucha' : 'Preescuchar';
        playButton.dataset.path = track.filePath || '';
        if (previewPath === track.filePath) playButton.classList.add('playing');
        playButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            togglePreview(track.filePath);
        });
        playCell.appendChild(playButton);

        row.appendChild(titleCell);
        row.appendChild(genreCell);
        row.appendChild(subgenreCell);
        row.appendChild(roleCell);
        row.appendChild(yearCell);
        row.appendChild(playCell);
        row.addEventListener('click', (event) => {
            if (event.target.closest('.preview-btn')) return;
            if (selectedTrackPaths.has(track.filePath)) selectedTrackPaths.delete(track.filePath);
            else selectedTrackPaths.add(track.filePath);
            syncSelectionView();
        });
        tbody.appendChild(row);
    });
    syncSelectionView();
}

function getCurrentMainGenreName() {
    return currentCard?.mainGenreName
        || currentCard?.habitualGenreName
        || $('artist-main-genre')?.value
        || '';
}

function populateBulkDefaults() {
    const mainInput = $('bulk-main-genre');
    if (mainInput && !mainInput.value.trim()) {
        const current = getCurrentMainGenreName();
        if (current && !/^n\/?a/i.test(current)) mainInput.value = current;
    }
}

function renderCard() {
    const name = currentCard?.displayName || '';
    $('artist-name').value = name;
    $('artist-type').value = currentCard?.artistType || 'Agrupacion / Banda';
    $('artist-nationalities').value = currentCard?.nationalities || currentCard?.country || '';
    $('artist-subgenres').value = currentCard?.subgenresCsv || '';
    $('artist-biography').value = currentCard?.biography || currentCard?.notes || '';
    $('read-artist-type').textContent = currentCard?.artistType || 'No definido';
    $('read-nationalities').textContent = currentCard?.nationalities || currentCard?.country || 'No definido';
    $('read-main-genre').innerHTML = '';
    $('read-main-genre').appendChild(pill(currentCard?.mainGenreName || currentCard?.habitualGenreName || 'N/A Multigenero', {
        genreLink: true,
        genreKey: currentCard?.mainGenreKey || currentCard?.habitualGenre || ''
    }));
    renderCsvPills($('read-subgenres'), currentCard?.subgenresCsv || '', 'Sin datos', { genreLink: true });
    populateGenreSelect();
    populateBulkDefaults();
    renderWikiText();
    renderPhoto();
    renderCollaborators();
    renderSummary();
    renderTracks();
}

function renderSummary() {
    $('summary-tracks').textContent = `${currentTracks.length}`;
    $('summary-main-genre').textContent = currentCard?.mainGenreName || currentCard?.habitualGenreName || 'N/A Multigenero';
    const hasBasics = !!(currentCard?.displayName && (currentCard?.nationalities || currentCard?.country) && (currentCard?.mainGenreName || currentCard?.habitualGenreName));
    $('summary-curation').textContent = hasBasics ? 'Lista para usar' : 'Completar datos';
}

async function loadGenreProfiles() {
    try {
        genreProfiles = await ipcRenderer.invoke('lib-get-genre-profiles') || [];
    } catch (err) {
        genreProfiles = [];
    }
    populateGenreSelect();
    populateBulkGenreDatalist();
}

async function loadCountryProfiles() {
    try {
        countryProfiles = await ipcRenderer.invoke('lib-get-country-profiles') || [];
    } catch (err) {
        countryProfiles = [];
    }
    const datalist = $('country-options');
    if (!datalist) return;
    datalist.innerHTML = '';
    countryProfiles.forEach(country => {
        const option = document.createElement('option');
        option.value = country.name || '';
        datalist.appendChild(option);
    });
}

async function loadArtist(payload = {}) {
    setStatus('Cargando cedula...');
    stopPreview();
    let result;
    if (payload.filePath || typeof payload === 'string') {
        currentFilePath = payload.filePath || payload;
        result = await ipcRenderer.invoke('lib-get-artist-card-for-track', currentFilePath);
    } else {
        result = await ipcRenderer.invoke('lib-get-artist-card', payload);
    }
    if (!result?.success) {
        setStatus(result?.error || 'No se pudo cargar la cedula.', 'warn');
        return;
    }
    currentCard = result.card;
    currentTracks = Array.isArray(result.tracks) ? result.tracks : [];
    selectedTrackPaths.clear();
    pendingOnlineMeta = null;
    renderCard();
    markDirty(false);
    setStatus('Cedula cargada.', 'ok');
}

async function fetchOnlineMetadata() {
    const name = $('artist-name').value.trim() || currentCard?.displayName || '';
    if (!name) return;
    setStatus('Consultando internet...');
    const result = await ipcRenderer.invoke('lib-fetch-artist-metadata', name);
    if (!result?.success) {
        setStatus(result?.error || 'Sin respuesta de internet.', 'warn');
        return;
    }
    pendingOnlineMeta = result;
    if (result.country && !$('artist-nationalities').value.trim()) {
        $('artist-nationalities').value = normalizeNationalitiesInput(result.country);
    }
    if (result.artistType) {
        const typeSelect = $('artist-type');
        const option = Array.from(typeSelect.options).find(item => item.textContent === result.artistType);
        if (option) typeSelect.value = result.artistType;
    }
    renderPhoto();
    markDirty(true);
    const typeNote = result.artistType ? ` Tipo: ${result.artistType}.` : '';
    const sources = (result.metadataSources || []).map(item => item.source).filter(Boolean).join(', ');
    const sourceNote = sources ? ` Fuentes: ${sources}.` : '';
    const photoNote = result.photoUrl
        ? (result.photoDownloadAllowed === false ? ' Imagen encontrada como enlace externo.' : ' Guarda para descargar la imagen.')
        : ' Sin imagen.';
    setStatus(`Metadatos listos.${typeNote}${photoNote}${sourceNote}`, 'ok');
}

async function saveArtistCard() {
    if (!currentCard?.artistKey) return;
    setStatus('Guardando cedula...');
    const mainGenreOption = $('artist-main-genre').selectedOptions[0];
    const payload = {
        artistKey: currentCard.artistKey,
        displayName: $('artist-name').value.trim(),
        artistType: $('artist-type').value,
        nationalities: normalizeNationalitiesInput($('artist-nationalities').value),
        country: normalizeNationalitiesInput($('artist-nationalities').value),
        mainGenre: $('artist-main-genre').value,
        mainGenreKey: mainGenreOption?.dataset?.key || '',
        habitualGenre: $('artist-main-genre').value,
        subgenresCsv: $('artist-subgenres').value,
        biography: $('artist-biography').value,
        notes: $('artist-biography').value,
        photoUrl: pendingOnlineMeta?.photoUrl || currentCard.photoUrl || '',
        externalSource: pendingOnlineMeta?.externalSource || currentCard.externalSource || '',
        externalId: pendingOnlineMeta?.externalId || currentCard.externalId || '',
        metadataFetchedAt: pendingOnlineMeta?.fetchedAt || currentCard.metadataFetchedAt || null,
        downloadPhoto: !!pendingOnlineMeta?.photoUrl && pendingOnlineMeta?.photoDownloadAllowed !== false
    };
    const result = await ipcRenderer.invoke('lib-save-artist-card', payload);
    if (!result?.success) {
        setStatus(result?.error || 'No se pudo guardar.', 'warn');
        return;
    }
    currentCard = result.card || currentCard;
    await loadArtist(currentFilePath ? { filePath: currentFilePath } : { artistKey: currentCard.artistKey });
    markDirty(false);
    setStatus('Cedula guardada.', 'ok');
}

function getSelectedOrWarn() {
    const paths = [...selectedTrackPaths];
    if (!paths.length) {
        setStatus('Selecciona una o mas canciones.', 'warn');
        return [];
    }
    return paths;
}

async function applyBulkMainGenre() {
    const paths = getSelectedOrWarn();
    const genre = $('bulk-main-genre').value.trim();
    if (!paths.length) return;
    if (!genre) {
        setStatus('Escribe o elige un genero principal.', 'warn');
        return;
    }
    setStatus(`Aplicando genero a ${paths.length} pista(s)...`);
    const result = await ipcRenderer.invoke('lib-set-track-genre', { paths, genre, subgenre: '', writeTags: true });
    if (!result?.success) {
        setStatus(result?.error || 'No se pudo aplicar.', 'warn');
        return;
    }
    await loadArtist(currentFilePath ? { filePath: currentFilePath } : { artistKey: currentCard.artistKey });
    setStatus(`${result.updatedTracks || paths.length} pista(s) actualizadas. ID3: ${result.tagUpdated || 0} ok.`, 'ok');
}

async function applyBulkSubgenre() {
    const paths = getSelectedOrWarn();
    const genre = $('bulk-main-genre').value.trim() || getCurrentMainGenreName();
    const subgenre = $('bulk-subgenre').value.trim();
    if (!paths.length) return;
    if (!genre || /^n\/?a/i.test(genre)) {
        setStatus('Para subgenero, primero define un genero principal.', 'warn');
        return;
    }
    if (!subgenre) {
        setStatus('Escribe o elige un subgenero.', 'warn');
        return;
    }
    setStatus(`Aplicando subgenero a ${paths.length} pista(s)...`);
    const result = await ipcRenderer.invoke('lib-set-track-genre', { paths, genre, subgenre, writeTags: true });
    if (!result?.success) {
        setStatus(result?.error || 'No se pudo aplicar.', 'warn');
        return;
    }
    await loadArtist(currentFilePath ? { filePath: currentFilePath } : { artistKey: currentCard.artistKey });
    setStatus(`${result.updatedTracks || paths.length} pista(s) actualizadas. ID3: ${result.tagUpdated || 0} ok.`, 'ok');
}

$('btn-read').addEventListener('click', () => setMode('read'));
$('btn-edit').addEventListener('click', () => setMode('edit'));
$('btn-fetch').addEventListener('click', fetchOnlineMetadata);
$('btn-save-top').addEventListener('click', saveArtistCard);
$('btn-apply-main-genre').addEventListener('click', applyBulkMainGenre);
$('btn-apply-subgenre').addEventListener('click', applyBulkSubgenre);
$('btn-select-all').addEventListener('click', () => {
    selectedTrackPaths = new Set(visibleTracks().map(track => track.filePath).filter(Boolean));
    syncSelectionView();
});
$('track-filter').addEventListener('input', (event) => {
    trackFilter = event.target.value;
    renderTracks();
});
document.querySelectorAll('#artist-name, #artist-type, #artist-nationalities, #artist-main-genre, #artist-subgenres, #artist-biography').forEach(input => {
    input.addEventListener('input', () => markDirty(true));
    input.addEventListener('change', () => markDirty(true));
});
$('artist-nationalities').addEventListener('keydown', (event) => {
    if (event.key === ',') {
        event.preventDefault();
        const input = event.currentTarget;
        input.value = normalizeNationalitiesInput(`${input.value},`);
        if (input.value) input.value += ' / ';
    }
});
$('artist-nationalities').addEventListener('blur', (event) => {
    event.currentTarget.value = normalizeNationalitiesInput(event.currentTarget.value);
});
$('artist-name').addEventListener('input', renderPhoto);
document.addEventListener('click', (event) => {
    const link = event.target.closest?.('.wiki-link[data-artist-name]');
    if (!link) return;
    event.preventDefault();
    event.stopPropagation();
    ipcRenderer.send('open-artist-card-by-name', link.dataset.artistName);
});
document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveArtistCard();
    }
});

window.addEventListener('beforeunload', (event) => {
    stopPreview();
    if (!hasUnsavedChanges) return;
    event.preventDefault();
    event.returnValue = '';
});

ipcRenderer.on('load-artist-card', (event, payload) => loadArtist(payload || {}));
ipcRenderer.on('settings-updated', () => {
    if (previewAudio) applyPreviewOutput(previewAudio);
});
ipcRenderer.on('genre-profiles-updated', async () => {
    await loadGenreProfiles();
    renderCard();
});

setMode('read');
loadGenreProfiles();
loadCountryProfiles();
