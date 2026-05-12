const { ipcRenderer } = require('electron');

let catalog = [];
let selectedKeys = new Set();
let currentEditKey = null;
let activeFilterPadre = null;
let activeFilterSubgenero = null;
let draggedGenreKey = null;

// DOM Elements
const listPadres = document.getElementById('list-padres');
const listSubgeneros = document.getElementById('list-subgeneros');
const listSinIdentificar = document.getElementById('list-sin-identificar');

const countPadres = document.getElementById('count-padres');
const countSubgeneros = document.getElementById('count-subgeneros');
const countSinIdentificar = document.getElementById('count-sin-identificar');

const formName = document.getElementById('genre-name');
const formType = document.getElementById('genre-type');
const formParentGroup = document.getElementById('parent-selector-group');
const formParent = document.getElementById('genre-parent');
const btnSave = document.getElementById('btn-save');
const btnCancel = document.getElementById('btn-cancel');
const btnDelete = document.getElementById('btn-delete');
const formKeyHidden = document.getElementById('genre-key-hidden');
const panelTitle = document.getElementById('panel-title');

const unifyBar = document.getElementById('unify-bar');
const unifyText = document.getElementById('unify-text');
const btnUnifyTrigger = document.getElementById('btn-unify-trigger');

const unifyModal = document.getElementById('unify-modal');
const unifyTarget = document.getElementById('unify-target');
const unifyTargetType = document.getElementById('unify-target-type');
const btnCancelUnify = document.getElementById('btn-cancel-unify');
const btnConfirmUnify = document.getElementById('btn-confirm-unify');

const statusDisplay = document.getElementById('status');

// ─── Initialization ─────────────────────────────────────────────
async function init() {
    await loadCatalog();
    setupEventListeners();
    setupColumnDropZones();

    // Botón "Ver Todos" en el header de subgéneros
    const btnShowAll = document.getElementById('btn-show-all-subgenres');
    if (btnShowAll) {
        btnShowAll.addEventListener('click', (e) => {
            e.preventDefault();
            activeFilterPadre = null;
            activeFilterSubgenero = null;
            renderLists();
        });
    }
}

async function loadCatalog() {
    try {
        const result = await ipcRenderer.invoke('genre-editor-get-catalog');
        catalog = Array.isArray(result?.genres) ? result.genres : [];
        renderLists();
        updateParentDropdown();
    } catch (err) {
        console.error('Error loading catalog:', err);
        catalog = [];
    }
}

// ─── Rendering ──────────────────────────────────────────────────
function renderLists() {
    const padres = catalog.filter(g => g.tipo === 'padre');
    const subgeneros = catalog.filter(g => g.tipo === 'subgenero');
    const sinIdentificar = catalog.filter(g => g.tipo === 'sin_identificar');

    countPadres.textContent = padres.length;
    countSubgeneros.textContent = subgeneros.length;
    countSinIdentificar.textContent = sinIdentificar.length;

    // Filtro de subgéneros: todos por defecto, filtrados si hay padre activo
    let visibleSubgeneros = subgeneros;
    const filterLabel = document.getElementById('subgenre-filter-label');
    const btnShowAll = document.getElementById('btn-show-all-subgenres');

    if (activeFilterPadre) {
        visibleSubgeneros = subgeneros.filter(s => s.parentGenre === activeFilterPadre);
        const parentGenre = catalog.find(g => g.genreKey === activeFilterPadre);
        if (filterLabel) {
            filterLabel.textContent = `▸ ${parentGenre?.displayName || activeFilterPadre}`;
            filterLabel.style.display = 'inline';
        }
        if (btnShowAll) btnShowAll.style.display = 'inline';
    } else {
        if (filterLabel) filterLabel.style.display = 'none';
        if (btnShowAll) btnShowAll.style.display = 'none';
    }

    renderContainer(listPadres, padres);
    renderContainer(listSubgeneros, visibleSubgeneros);
    renderContainer(listSinIdentificar, sinIdentificar);
}

function renderContainer(container, items) {
    container.innerHTML = '';
    if (items.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'padding: 20px; text-align: center; color: #555; font-size: 12px; font-style: italic;';
        empty.textContent = 'Arrastra géneros aquí para reclasificar';
        container.appendChild(empty);
        return;
    }
    items.forEach(genre => {
        const div = document.createElement('div');
        div.className = 'genre-item';
        div.draggable = true;
        div.dataset.genreKey = genre.genreKey;

        if (selectedKeys.has(genre.genreKey)) div.classList.add('multi-selected');
        if (genre.isDuplicate) div.classList.add('duplicate');
        if (currentEditKey === genre.genreKey) div.classList.add('active');
        if (activeFilterPadre === genre.genreKey || activeFilterSubgenero === genre.genreKey) {
            div.style.borderLeft = '3px solid var(--accent)';
        }

        div.innerHTML = `
            <span>${genre.displayName}</span>
            <span style="font-size: 10px; color: var(--text-muted);">${genre.trackCount} ♫</span>
        `;

        // Click handler
        div.addEventListener('click', (e) => handleGenreClick(e, genre));

        // Drag start (solo para reclasificar entre columnas)
        div.addEventListener('dragstart', (e) => {
            draggedGenreKey = genre.genreKey;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', genre.genreKey);
            div.style.opacity = '0.4';
        });
        div.addEventListener('dragend', () => {
            draggedGenreKey = null;
            div.style.opacity = '1';
        });

        container.appendChild(div);
    });
}

// ─── Click Handling ─────────────────────────────────────────────
function handleGenreClick(e, genre) {
    if (e.ctrlKey || e.metaKey) {
        // Si hay un item en edición activa que no está en selectedKeys, inclúyelo
        if (currentEditKey && !selectedKeys.has(currentEditKey)) {
            selectedKeys.add(currentEditKey);
        }
        currentEditKey = null;

        if (selectedKeys.has(genre.genreKey)) {
            selectedKeys.delete(genre.genreKey);
        } else {
            selectedKeys.add(genre.genreKey);
        }
        updateUnifyBar();
        renderLists();
        return;
    }

    // Click normal: limpiar multi-selección, entrar en modo edición
    selectedKeys.clear();
    updateUnifyBar();

    if (genre.tipo === 'padre') {
        activeFilterPadre = activeFilterPadre === genre.genreKey ? null : genre.genreKey;
        activeFilterSubgenero = null;
    } else if (genre.tipo === 'subgenero') {
        activeFilterSubgenero = activeFilterSubgenero === genre.genreKey ? null : genre.genreKey;
        activeFilterPadre = genre.parentGenre;
    } else {
        activeFilterPadre = null;
        activeFilterSubgenero = null;
    }

    editGenre(genre);
    renderLists();
}

// ─── Edit Panel ─────────────────────────────────────────────────
function editGenre(genre) {
    currentEditKey = genre.genreKey;
    formKeyHidden.value = genre.genreKey;
    formName.value = genre.displayName;
    formType.value = genre.tipo || 'sin_identificar';

    if (genre.tipo === 'subgenero') {
        formParentGroup.style.display = 'block';
        formParent.value = genre.parentGenre || '';
    } else {
        formParentGroup.style.display = 'none';
        formParent.value = '';
    }

    panelTitle.textContent = `Editando: ${genre.displayName}`;
    btnCancel.style.display = 'block';
    btnDelete.style.display = 'block';
}

function resetForm() {
    currentEditKey = null;
    formKeyHidden.value = '';
    formName.value = '';
    formType.value = 'padre';
    formParentGroup.style.display = 'none';
    formParent.value = '';

    panelTitle.textContent = 'Crear Nuevo Género';
    btnCancel.style.display = 'none';
    btnDelete.style.display = 'none';

    activeFilterPadre = null;
    activeFilterSubgenero = null;
    renderLists();
}

function updateParentDropdown() {
    const padres = catalog.filter(g => g.tipo === 'padre');
    formParent.innerHTML = '<option value="">Seleccione un padre...</option>';
    padres.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.genreKey;
        opt.textContent = p.displayName;
        formParent.appendChild(opt);
    });
}

// ─── Drag & Drop: Column Drop Zones ─────────────────────────────
function setupColumnDropZones() {
    const zones = [
        { el: listPadres.parentElement, tipo: 'padre' },
        { el: listSubgeneros.parentElement, tipo: 'subgenero' },
        { el: listSinIdentificar.parentElement, tipo: 'sin_identificar' }
    ];

    zones.forEach(({ el, tipo }) => {
        el.addEventListener('dragover', (e) => {
            if (!draggedGenreKey) return;
            e.preventDefault();
            el.style.boxShadow = 'inset 0 0 0 2px var(--accent)';
        });
        el.addEventListener('dragleave', (e) => {
            // Solo reaccionamos si realmente salimos de la columna
            if (el.contains(e.relatedTarget)) return;
            el.style.boxShadow = '';
        });
        el.addEventListener('drop', (e) => {
            e.preventDefault();
            el.style.boxShadow = '';
            const sourceKey = e.dataTransfer.getData('text/plain');
            if (!sourceKey) return;
            handleDropOnColumn(sourceKey, tipo);
        });
    });
}

async function handleDropOnColumn(sourceKey, targetTipo) {
    const genre = catalog.find(g => g.genreKey === sourceKey);
    if (!genre) return;
    if (genre.tipo === targetTipo) return; // Ya está en esa categoría

    // Para subgénero: si hay un padre activo en el filtro, lo asigna automáticamente.
    // Si no, lo deja suelto (sin padre). El padre es OPCIONAL.
    const parentKey = (targetTipo === 'subgenero' && activeFilterPadre) ? activeFilterPadre : '';

    statusDisplay.textContent = `Transfiriendo "${genre.displayName}"...`;
    try {
        const result = await ipcRenderer.invoke('genre-editor-reclassify', {
            genreKey: genre.genreKey,  // Key EXACTA del registro existente
            tipo: targetTipo,
            parentGenre: parentKey
        });
        if (!result.success) {
            statusDisplay.textContent = `Error: ${result.error}`;
            return;
        }
        const labels = { padre: 'Género Padre', subgenero: 'Subgénero', sin_identificar: 'Sin Identificar' };
        statusDisplay.textContent = `"${genre.displayName}" transferido a ${labels[targetTipo] || targetTipo}.`;
        await loadCatalog();
    } catch (err) {
        statusDisplay.textContent = 'Error al transferir.';
        console.error(err);
    }
}


// ─── Event Listeners ────────────────────────────────────────────
function setupEventListeners() {
    // Normalización en tiempo real del campo nombre
    formName.addEventListener('input', (e) => {
        let val = e.target.value;
        val = val.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        val = val.split(' ').map(part => {
            if (/^\d{2,4}s$/.test(part)) return `${part.slice(0, -1)}s`;
            if (/^\d{2,4}$/.test(part)) return part;
            return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        }).join(' ');
        e.target.value = val;
    });

    // Mostrar/ocultar selector de padre según tipo
    formType.addEventListener('change', () => {
        if (formType.value === 'subgenero') {
            formParentGroup.style.display = 'block';
            if (activeFilterPadre) formParent.value = activeFilterPadre;
        } else {
            formParentGroup.style.display = 'none';
            formParent.value = '';
        }
    });

    btnCancel.addEventListener('click', resetForm);

    // Eliminar
    btnDelete.addEventListener('click', async () => {
        if (!currentEditKey) return;
        if (!confirm('¿Eliminar este género de la curaduría?\nLas canciones NO se borran, solo la etiqueta.')) return;
        statusDisplay.textContent = 'Eliminando...';
        try {
            await ipcRenderer.invoke('genre-editor-delete', currentEditKey);
            statusDisplay.textContent = 'Eliminado exitosamente.';
            resetForm();
            await loadCatalog();
        } catch (err) {
            statusDisplay.textContent = 'Error al eliminar.';
            console.error(err);
        }
    });

    // Guardar (crear o editar)
    btnSave.addEventListener('click', async () => {
        const name = formName.value.trim();
        const tipo = formType.value;
        const parent = formParent.value;

        if (!name) return alert('El nombre no puede estar vacío.');

        statusDisplay.textContent = 'Guardando...';
        try {
            await ipcRenderer.invoke('genre-editor-save', {
                displayName: name,
                tipo: tipo,
                parentGenre: parent
            });
            statusDisplay.textContent = 'Guardado exitosamente.';
            resetForm();
            await loadCatalog();
        } catch (err) {
            statusDisplay.textContent = 'Error al guardar.';
            console.error(err);
        }
    });

    // ─── Unify via Ctrl+Click ───────────────────────────────────
    btnUnifyTrigger.addEventListener('click', () => {
        if (selectedKeys.size < 2) return;

        unifyTarget.innerHTML = '';
        const selectedGenres = catalog.filter(g => selectedKeys.has(g.genreKey));
        selectedGenres.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.genreKey;
            opt.textContent = `${g.displayName} (${g.trackCount} ♫)`;
            unifyTarget.appendChild(opt);
        });

        unifyTargetType.value = selectedGenres[0]?.tipo === 'subgenero' ? 'subgenero' : 'padre';
        unifyModal.classList.add('show');
    });

    btnCancelUnify.addEventListener('click', () => {
        unifyModal.classList.remove('show');
    });

    btnConfirmUnify.addEventListener('click', async () => {
        const targetKey = unifyTarget.value;
        const targetType = unifyTargetType.value;
        if (!targetKey) return;

        statusDisplay.textContent = 'Unificando...';
        btnConfirmUnify.disabled = true;

        try {
            await ipcRenderer.invoke('genre-editor-merge-genres', {
                targetGenreKey: targetKey,
                sourceGenreKeys: Array.from(selectedKeys),
                finalType: targetType
            });
            statusDisplay.textContent = 'Unificación completada.';
            unifyModal.classList.remove('show');
            selectedKeys.clear();
            updateUnifyBar();
            resetForm();
            await loadCatalog();
        } catch (err) {
            statusDisplay.textContent = 'Error al unificar.';
            console.error(err);
        } finally {
            btnConfirmUnify.disabled = false;
        }
    });
}

function updateUnifyBar() {
    if (selectedKeys.size >= 2) {
        unifyText.textContent = `${selectedKeys.size} géneros seleccionados para unificar`;
        unifyBar.classList.add('show');
    } else {
        unifyBar.classList.remove('show');
    }
}

// ─── External Events ────────────────────────────────────────────
ipcRenderer.on('genre-profiles-updated', () => {
    loadCatalog();
});

document.addEventListener('DOMContentLoaded', init);
