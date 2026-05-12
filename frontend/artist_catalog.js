const { ipcRenderer } = require('electron');

let artists = [];
let artistByKey = new Map();
let genres = [];
let statusCounts = { all: 0, curated: 0, pending: 0 };
let selectedGenre = 'all';
let selectedStatus = 'all';
let selectedKeys = new Set();
let autofillRunning = false;
let lastSelectedIndex = -1;
let viewMode = 'grid';
let filteredCache = [];
let renderedCount = 0;
let searchTimer = null;
let sortMode = 'name';

const INITIAL_RENDER_COUNT = 72;
const RENDER_CHUNK_SIZE = 48;

const $ = (id) => document.getElementById(id);

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function updateSelectionInfo() {
    const total = filteredCache.length || filteredArtists().length;
    $('selection-info').textContent = `${selectedKeys.size} seleccionado(s) de ${total}`;
    const hasSelection = selectedKeys.size > 0;
    $('btn-open-selected').disabled = !hasSelection;
    $('btn-clear-selection').disabled = !hasSelection;
    $('btn-merge-selected').disabled = selectedKeys.size < 2;
    $('quick-title').textContent = hasSelection ? `${selectedKeys.size} cedula(s) seleccionada(s)` : 'Gestion rapida';
}

function setBulkStatus(message = '') {
    const el = $('bulk-status');
    if (el) el.textContent = message;
}

function setBusy(isBusy) {
    autofillRunning = isBusy;
    ['btn-autofill', 'btn-refresh', 'btn-new', 'btn-view-toggle', 'sort-mode'].forEach(id => {
        const btn = $(id);
        if (btn) btn.disabled = isBusy;
    });
}

function makeFilter(label, count, active, onClick) {
    const item = document.createElement('div');
    item.className = `filter-item ${active ? 'active' : ''}`.trim();
    item.innerHTML = `<span>${label}</span><span class="count">${count}</span>`;
    item.addEventListener('click', onClick);
    return item;
}

function renderFilters() {
    const genreContainer = $('genre-filters');
    genreContainer.innerHTML = '';
    genreContainer.appendChild(makeFilter('Todos', statusCounts.all || artists.length, selectedGenre === 'all', () => {
        selectedGenre = 'all';
        render();
    }));
    genres.forEach(genre => {
        genreContainer.appendChild(makeFilter(genre.name, genre.count, selectedGenre === genre.name, () => {
            selectedGenre = genre.name;
            render();
        }));
    });

    const statusContainer = $('status-filters');
    statusContainer.innerHTML = '';
    [
        ['all', 'Todos', statusCounts.all],
        ['curated', 'Completos', statusCounts.curated],
        ['pending', 'Pendientes', statusCounts.pending]
    ].forEach(([key, label, count]) => {
        statusContainer.appendChild(makeFilter(label, count || 0, selectedStatus === key, () => {
            selectedStatus = key;
            render();
        }));
    });
}

function filteredArtists() {
    const query = normalizeText($('search-input').value);
    const filtered = artists.filter(artist => {
        if (selectedGenre !== 'all' && !artist.genreSet?.has(selectedGenre)) return false;
        if (selectedStatus === 'curated' && !artist.curated) return false;
        if (selectedStatus === 'pending' && artist.curated) return false;
        if (!query) return true;
        return artist.searchIndex.includes(query);
    });
    return sortArtists(filtered);
}

function sortArtists(list) {
    const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
    const sorted = [...list];
    sorted.sort((a, b) => {
        if (sortMode === 'tracks') return (b.trackCount || 0) - (a.trackCount || 0) || collator.compare(a.displayName || '', b.displayName || '');
        if (sortMode === 'pending') return Number(a.curated) - Number(b.curated) || collator.compare(a.displayName || '', b.displayName || '');
        if (sortMode === 'genre') return collator.compare(a.genreName || '', b.genreName || '') || collator.compare(a.displayName || '', b.displayName || '');
        return collator.compare(a.displayName || '', b.displayName || '');
    });
    return sorted;
}

function currentList() {
    return filteredCache.length ? filteredCache : filteredArtists();
}

function getArtistByKey(key) {
    return artistByKey.get(key) || null;
}

function openArtistCard(artist) {
    if (!artist) return;
    ipcRenderer.send('open-artist-card-by-key', {
        artistKey: artist.artistKey,
        displayName: artist.displayName
    });
}

function selectArtist(artistKey, event = {}) {
    const list = currentList();
    const index = list.findIndex(artist => artist.artistKey === artistKey);
    if (event.shiftKey && lastSelectedIndex >= 0 && index >= 0) {
        selectedKeys.clear();
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        list.slice(start, end + 1).forEach(artist => selectedKeys.add(artist.artistKey));
    } else if (event.ctrlKey || event.metaKey) {
        if (selectedKeys.has(artistKey)) selectedKeys.delete(artistKey);
        else selectedKeys.add(artistKey);
        lastSelectedIndex = index;
    } else {
        selectedKeys = new Set([artistKey]);
        lastSelectedIndex = index;
    }
    updateSelectionClasses();
    updateSelectionInfo();
}

function showContextMenu(x, y) {
    const menu = $('artist-context-menu');
    const canMerge = selectedKeys.size >= 2;
    const canGenre = selectedGenre !== 'all';
    $('ctx-set-main-genre').textContent = canGenre
        ? `Asignar "${selectedGenre}" como genero principal`
        : 'Asignar filtro como genero principal';
    $('ctx-merge').style.opacity = canMerge ? '1' : '.45';
    $('ctx-set-main-genre').style.opacity = canGenre ? '1' : '.45';
    menu.classList.add('show');
    const maxX = window.innerWidth - menu.offsetWidth - 8;
    const maxY = window.innerHeight - menu.offsetHeight - 8;
    menu.style.left = `${Math.max(8, Math.min(x, maxX))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, maxY))}px`;
}

function hideContextMenu() {
    $('artist-context-menu')?.classList.remove('show');
}

function artistPhoto(artist) {
    return artist.photoLocalPath || artist.photoUrl || '';
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function renderArtistCard(artist) {
    const card = document.createElement('article');
    card.className = `artist-card ${selectedKeys.has(artist.artistKey) ? 'selected' : ''}`.trim();
    card.dataset.artistKey = artist.artistKey;

    const photo = artistPhoto(artist);
    const statusClass = artist.curated ? 'status-curated' : 'status-curated status-pending';
    card.innerHTML = `
        <div class="${statusClass}" title="${artist.curated ? 'Cedula completa' : 'Pendiente por revisar'}">${artist.curated ? 'OK' : '!'}</div>
        <div class="genre-pill" style="color:${artist.genreColor || '#00a8ff'};border-color:${artist.genreColor || '#00a8ff'};">${escapeHtml(artist.genreName || 'N/A')}</div>
        <div class="card-photo">
            ${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(artist.displayName)}" loading="lazy" decoding="async">` : `<div class="photo-fallback">${escapeHtml(artist.displayName)}</div>`}
        </div>
        <div class="card-info">
            <div class="card-name" title="${escapeHtml(artist.displayName)}">${escapeHtml(artist.displayName)}</div>
            <div class="card-meta">
                <span>${escapeHtml(artist.nationalities || artist.country || 'Sin nacionalidad')}</span>
                <span>${artist.trackCount || 0} cancion(es)</span>
            </div>
        </div>
        <div class="card-actions">
            <button class="card-open" type="button">Abrir cedula</button>
        </div>
    `;

    card.addEventListener('click', (event) => {
        if (event.target.closest('.card-open')) return;
        selectArtist(artist.artistKey, event);
    });
    card.addEventListener('dblclick', () => {
        openArtistCard(artist);
    });
    card.querySelector('.card-open')?.addEventListener('click', (event) => {
        event.stopPropagation();
        openArtistCard(artist);
    });
    card.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        if (!selectedKeys.has(artist.artistKey)) {
            selectedKeys = new Set([artist.artistKey]);
            lastSelectedIndex = currentList().findIndex(item => item.artistKey === artist.artistKey);
            updateSelectionClasses();
            updateSelectionInfo();
        }
        showContextMenu(event.clientX, event.clientY);
    });
    return card;
}

function updateSelectionClasses() {
    document.querySelectorAll('.artist-card').forEach(card => {
        const selected = selectedKeys.has(card.dataset.artistKey);
        card.classList.toggle('selected', selected);
    });
}

function appendVisibleArtists() {
    const grid = $('artist-grid');
    const nextItems = filteredCache.slice(renderedCount, renderedCount + RENDER_CHUNK_SIZE);
    if (!nextItems.length) return;
    const fragment = document.createDocumentFragment();
    nextItems.forEach(artist => fragment.appendChild(renderArtistCard(artist)));
    grid.appendChild(fragment);
    renderedCount += nextItems.length;
    updateSelectionInfo();
}

function fillViewportIfNeeded() {
    const scroller = $('gallery-content');
    let guard = 0;
    while (renderedCount < filteredCache.length && scroller.scrollHeight <= scroller.clientHeight + 120 && guard < 8) {
        appendVisibleArtists();
        guard++;
    }
}

function renderGrid() {
    const grid = $('artist-grid');
    filteredCache = filteredArtists();
    renderedCount = 0;
    grid.innerHTML = '';
    $('gallery-content').scrollTop = 0;
    grid.classList.toggle('list-mode', viewMode === 'list');
    $('section-title').textContent = selectedStatus === 'pending' ? 'Cedulas Pendientes' : 'Artistas Curados';
    if (!filteredCache.length) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = 'No hay artistas que coincidan con los filtros.';
        grid.appendChild(empty);
        updateSelectionInfo();
        return;
    }
    const firstItems = filteredCache.slice(0, INITIAL_RENDER_COUNT);
    const fragment = document.createDocumentFragment();
    firstItems.forEach(artist => fragment.appendChild(renderArtistCard(artist)));
    grid.appendChild(fragment);
    renderedCount = firstItems.length;
    updateSelectionInfo();
    requestAnimationFrame(fillViewportIfNeeded);
}

function render() {
    renderFilters();
    renderGrid();
}

async function loadCatalog() {
    const result = await ipcRenderer.invoke('artist-catalog-get-data');
    if (!result?.success) {
        artists = [];
        artistByKey = new Map();
        genres = [];
        statusCounts = { all: 0, curated: 0, pending: 0 };
        render();
        return;
    }
    artists = (result.artists || []).map(artist => {
        const artistGenres = Array.isArray(artist.genreNames) && artist.genreNames.length ? artist.genreNames : [artist.genreName];
        return {
            ...artist,
            genreSet: new Set(artistGenres),
            searchIndex: normalizeText([
                artist.displayName,
                artist.genreName,
                ...(artistGenres || []),
                artist.nationalities,
                artist.country,
                artist.subgenresCsv,
                artist.artistType
            ].join(' '))
        };
    });
    artistByKey = new Map(artists.map(artist => [artist.artistKey, artist]));
    genres = result.genres || [];
    statusCounts = result.status || { all: artists.length, curated: 0, pending: 0 };
    selectedKeys = new Set([...selectedKeys].filter(key => artists.some(artist => artist.artistKey === key)));
    render();
}

async function deleteSelected() {
    hideContextMenu();
    const keys = [...selectedKeys];
    if (!keys.length) return;
    const ok = confirm(`Eliminar ${keys.length} cedula(s)? No elimina canciones, solo la ficha y sus enlaces.`);
    if (!ok) return;
    const result = await ipcRenderer.invoke('artist-catalog-delete', keys);
    if (!result?.success) {
        alert(result?.error || 'No se pudo eliminar.');
        return;
    }
    selectedKeys.clear();
    await loadCatalog();
}

async function mergeSelected() {
    hideContextMenu();
    const keys = [...selectedKeys];
    if (keys.length < 2) {
        alert('Selecciona al menos dos artistas. El primero elegido sera el destino.');
        return;
    }
    openMergeModal(keys);
}

function openMergeModal(keys) {
    const select = $('merge-target');
    select.innerHTML = '';
    keys.map(getArtistByKey).filter(Boolean).forEach(artist => {
        const option = document.createElement('option');
        option.value = artist.artistKey;
        option.textContent = `${artist.displayName} (${artist.trackCount || 0})`;
        select.appendChild(option);
    });
    const first = getArtistByKey(keys[0]);
    $('merge-name').value = first?.displayName || '';
    $('merge-summary').textContent = `Se unificaran ${keys.length} fichas. Revisa el nombre antes de confirmar.`;
    $('merge-modal').classList.add('show');
}

function closeMergeModal() {
    $('merge-modal')?.classList.remove('show');
}

async function confirmMergeSelected() {
    const keys = [...selectedKeys];
    const targetKey = $('merge-target').value || keys[0];
    const targetName = $('merge-name').value.trim();
    if (keys.length < 2 || !targetKey || !targetName) return;
    closeMergeModal();
    const result = await ipcRenderer.invoke('artist-catalog-merge', {
        targetKey,
        targetDisplayName: targetName,
        sourceKeys: keys.filter(key => key !== targetKey)
    });
    if (!result?.success) {
        alert(result?.error || 'No se pudo fusionar.');
        return;
    }
    selectedKeys = new Set([targetKey]);
    await loadCatalog();
}

async function setMainGenreForSelected() {
    hideContextMenu();
    const keys = [...selectedKeys];
    if (!keys.length) return;
    if (selectedGenre === 'all') {
        alert('Primero filtra por un genero especifico.');
        return;
    }
    const ok = confirm(`Marcar "${selectedGenre}" como genero principal para ${keys.length} artista(s)?`);
    if (!ok) return;
    const result = await ipcRenderer.invoke('artist-catalog-set-main-genre', {
        artistKeys: keys,
        genreName: selectedGenre
    });
    if (!result?.success) {
        alert(result?.error || 'No se pudo asignar el genero.');
        return;
    }
    await loadCatalog();
}

function openSelectedArtist() {
    hideContextMenu();
    const first = getArtistByKey([...selectedKeys][0]);
    openArtistCard(first);
}

function toggleViewMode() {
    viewMode = viewMode === 'grid' ? 'list' : 'grid';
    $('btn-view-toggle').textContent = viewMode === 'grid' ? 'Vista lista' : 'Vista tarjetas';
    renderGrid();
}

function clearSelection() {
    selectedKeys.clear();
    lastSelectedIndex = -1;
    updateSelectionClasses();
    updateSelectionInfo();
}

function getGridColumnCount() {
    if (viewMode === 'list') return 1;
    const grid = $('artist-grid');
    const columns = window.getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean);
    return Math.max(1, columns.length || 1);
}

function moveSelection(delta, event = {}) {
    const list = currentList();
    if (!list.length) return;
    const keys = [...selectedKeys];
    const activeKey = keys[keys.length - 1];
    const currentIndex = Math.max(0, list.findIndex(artist => artist.artistKey === activeKey));
    const nextIndex = Math.max(0, Math.min(list.length - 1, currentIndex + delta));
    while (renderedCount <= nextIndex && renderedCount < filteredCache.length) appendVisibleArtists();
    selectArtist(list[nextIndex].artistKey, { shiftKey: event.shiftKey });
    const card = document.querySelector(`[data-artist-key="${list[nextIndex].artistKey}"]`);
    card?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

async function autofillArtists() {
    if (autofillRunning) return;
    const keys = [...selectedKeys];
    const pending = artists.filter(artist => !artist.curated).map(artist => artist.artistKey);
    const targetKeys = keys.length ? keys : pending;
    if (!targetKeys.length) {
        alert('No hay artistas seleccionados ni cedulas pendientes para completar.');
        return;
    }
    const modeText = keys.length ? `${keys.length} seleccionado(s)` : `${targetKeys.length} pendiente(s)`;
    const ok = confirm(`Auto-completar ${modeText} con fuentes externas?\n\nSe rellenaran huecos de foto, nacionalidad y tipo sin borrar tu curaduria manual.`);
    if (!ok) return;
    setBusy(true);
    setBulkStatus('Iniciando autocompletado...');
    const result = await ipcRenderer.invoke('artist-catalog-autofill', {
        artistKeys: targetKeys,
        onlyMissing: true
    });
    setBusy(false);
    if (!result?.success) {
        setBulkStatus('');
        alert(result?.error || 'No se pudo auto-completar.');
        return;
    }
    setBulkStatus(`Listo: ${result.updated || 0} actualizados, ${result.withPhoto || 0} con foto, ${result.failed || 0} fallidos.`);
    await loadCatalog();
}

$('search-input').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderGrid, 120);
});
$('btn-refresh').addEventListener('click', loadCatalog);
$('btn-autofill').addEventListener('click', autofillArtists);
$('btn-view-toggle').addEventListener('click', toggleViewMode);
$('sort-mode').addEventListener('change', (event) => {
    sortMode = event.target.value || 'name';
    renderGrid();
});
$('btn-open-selected').addEventListener('click', openSelectedArtist);
$('btn-merge-selected').addEventListener('click', mergeSelected);
$('btn-clear-selection').addEventListener('click', clearSelection);
$('btn-new').addEventListener('click', () => {
    const name = prompt('Nombre del artista nuevo:');
    if (name && name.trim()) ipcRenderer.send('open-artist-card-by-name', name.trim());
});
$('ctx-open').addEventListener('click', openSelectedArtist);
$('ctx-merge').addEventListener('click', () => {
    if (selectedKeys.size >= 2) mergeSelected();
});
$('ctx-set-main-genre').addEventListener('click', () => {
    if (selectedGenre !== 'all') setMainGenreForSelected();
});
$('ctx-delete').addEventListener('click', deleteSelected);
$('btn-cancel-merge').addEventListener('click', closeMergeModal);
$('btn-confirm-merge').addEventListener('click', confirmMergeSelected);
$('merge-target').addEventListener('change', (event) => {
    const artist = getArtistByKey(event.target.value);
    if (artist) $('merge-name').value = artist.displayName;
});
document.addEventListener('click', (event) => {
    if (!event.target.closest('#artist-context-menu')) hideContextMenu();
});
document.addEventListener('keydown', (event) => {
    if (event.target.closest('input, select, textarea')) return;
    if (event.key === 'Escape') {
        const modalOpen = $('merge-modal')?.classList.contains('show');
        hideContextMenu();
        closeMergeModal();
        if (!modalOpen) clearSelection();
    }
    if (event.key === 'Enter' && selectedKeys.size > 0) openSelectedArtist();
    if (event.key === 'Delete' && selectedKeys.size > 0) deleteSelected();
    if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveSelection(-1, event);
    }
    if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveSelection(1, event);
    }
    if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveSelection(-getGridColumnCount(), event);
    }
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveSelection(getGridColumnCount(), event);
    }
});
$('gallery-content').addEventListener('scroll', () => {
    const scroller = $('gallery-content');
    if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 700) {
        appendVisibleArtists();
    }
}, { passive: true });
$('btn-init-curation').addEventListener('click', () => {
    alert('Usa Herramientas > Inicializar curaduria desde carpeta raiz para poblar la base manualmente.');
});

ipcRenderer.on('artist-catalog-updated', loadCatalog);
ipcRenderer.on('artist-catalog-autofill-progress', (event, payload = {}) => {
    const total = payload.total || 0;
    const index = payload.index || 0;
    const name = payload.displayName || '';
    setBulkStatus(total ? `${index}/${total}: ${name}` : name);
});

loadCatalog();
