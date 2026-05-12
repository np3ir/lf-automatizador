const { ipcRenderer } = require('electron');
const path = require('path');

let currentEventId = null;
let commercialBlocks = [];

async function loadCommercialBlocksIntoSelect(selectedId = '') {
    const sel = document.getElementById('ev-commercial-block');
    if (!sel) return;
    sel.innerHTML = '';
    try {
        commercialBlocks = await ipcRenderer.invoke('commercial-get-blocks');
    } catch (err) {
        commercialBlocks = [];
    }
    if (!Array.isArray(commercialBlocks) || commercialBlocks.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.innerText = 'No hay bloques comerciales';
        sel.appendChild(opt);
        return;
    }
    commercialBlocks.forEach(block => {
        const opt = document.createElement('option');
        opt.value = block.id;
        opt.innerText = `${block.primaryTime ? block.primaryTime.substring(0, 5) + ' - ' : ''}${block.name}`;
        sel.appendChild(opt);
    });
    if (selectedId && Array.from(sel.options).some(opt => opt.value === selectedId)) sel.value = selectedId;
    else if (sel.options.length > 0) sel.selectedIndex = 0;
}

function syncSourceTypeUi() {
    const sourceType = document.querySelector('input[name="ev-source-type"]:checked')?.value || 'file';
    const pathInput = document.getElementById('ev-filepath');
    const commercialSelect = document.getElementById('ev-commercial-block');
    const browseButton = document.getElementById('btn-browse');
    const isCommercial = sourceType === 'commercial';
    if (pathInput) pathInput.style.display = isCommercial ? 'none' : '';
    if (commercialSelect) commercialSelect.style.display = isCommercial ? '' : 'none';
    if (browseButton) browseButton.style.display = isCommercial ? 'none' : '';
    if (isCommercial) {
        if (!commercialBlocks.length) loadCommercialBlocksIntoSelect(pathInput.value);
        else if (commercialSelect && pathInput.value) commercialSelect.value = pathInput.value;
    }
}

async function loadGroupsIntoSelect() {
    const sel = document.getElementById('ev-group');
    const currentVal = sel.value;
    sel.innerHTML = '';
    
    try {
        // Pedimos los grupos a SQLite a través del Main
        const groups = await ipcRenderer.invoke('db-get-groups');
        if (groups && groups.length > 0) {
            groups.forEach(g => {
                if (g.name && g.name.trim() !== '') {
                    const opt = document.createElement('option');
                    opt.value = g.id;
                    opt.innerText = g.name;
                    sel.appendChild(opt);
                }
            });
        } else {
            const opt = document.createElement('option');
            opt.value = 'g_general';
            opt.innerText = 'General';
            sel.appendChild(opt);
        }
    } catch(e){
        console.error("Error cargando grupos:", e);
    }

    if (currentVal && Array.from(sel.options).some(o => o.value === currentVal)) {
        sel.value = currentVal;
    }
}
// Cargar al iniciar
loadGroupsIntoSelect();
loadCommercialBlocksIntoSelect();

// Escuchar actualizaciones en tiempo real si el usuario cambia los grupos
ipcRenderer.on('refresh-event-groups', loadGroupsIntoSelect);

document.getElementById('btn-edit-groups').addEventListener('click', (e) => {
    e.preventDefault();
    ipcRenderer.send('open-event-groups');
});

document.getElementById('btn-reset-ev-colors').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('ev-color-txt').value = '#ffffff'; 
    document.getElementById('ev-color-bg').value = '#1a1a1c';  
});

const hoursContainer = document.getElementById('other-hours-container');
for (let i = 0; i <= 23; i++) {
    const lbl = document.createElement('label');
    lbl.style.fontSize = '12px'; lbl.style.display = 'flex'; lbl.style.alignItems = 'center'; lbl.style.gap = '4px';
    lbl.innerHTML = `<input type="checkbox" class="chk-hour" value="${i}"> ${i.toString().padStart(2, '0')} hrs`;
    hoursContainer.appendChild(lbl);
}

document.getElementById('chk-other-hours').addEventListener('change', (e) => {
    hoursContainer.style.display = e.target.checked ? 'grid' : 'none';
});

document.querySelectorAll('input[name="ev-days"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const isSpecificDays = e.target.value === 'specific';
        const isMonthlyWeeks = e.target.value === 'monthlyWeeks';
        document.getElementById('specific-days-container').style.display = isSpecificDays ? 'flex' : 'none';
        document.getElementById('monthly-weeks-container').style.display = isMonthlyWeeks ? 'block' : 'none';
    });
});

const timeInput = document.getElementById('ev-time');
let lastPrimaryHour = -1; 

function syncPrimaryHour() {
    const timeVal = timeInput.value; 
    if (!timeVal) return;
    const primaryHour = parseInt(timeVal.split(':')[0], 10);
    
    document.querySelectorAll('.chk-hour').forEach(cb => {
        const cbHour = parseInt(cb.value, 10);
        if (cbHour === primaryHour) {
            cb.checked = true;
            cb.disabled = true; 
            cb.parentElement.style.opacity = '0.5'; 
            cb.parentElement.title = 'Hora principal (obligatoria)';
        } else {
            if (cbHour === lastPrimaryHour) {
                cb.checked = false; 
            }
            cb.disabled = false;
            cb.parentElement.style.opacity = '1';
            cb.parentElement.title = '';
        }
    });
    
    lastPrimaryHour = primaryHour; 
}

timeInput.addEventListener('input', syncPrimaryHour);

const chkValidity = document.getElementById('chk-validity');
const validityContainer = document.getElementById('validity-container');
const dateStart = document.getElementById('ev-date-start');
const dateEnd = document.getElementById('ev-date-end');

chkValidity.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    dateStart.disabled = !isChecked;
    dateEnd.disabled = !isChecked;
    validityContainer.style.opacity = isChecked ? '1' : '0.5';
});

function openPicker(inputEl) {
    if (!inputEl.disabled && typeof inputEl.showPicker === 'function') {
        try { inputEl.showPicker(); } catch (e) {}
    }
}

document.getElementById('icon-date-start').addEventListener('click', () => openPicker(dateStart));
document.getElementById('icon-date-end').addEventListener('click', () => openPicker(dateEnd));
dateStart.addEventListener('dblclick', () => openPicker(dateStart));
dateEnd.addEventListener('dblclick', () => openPicker(dateEnd));

const inputMaxDelayMinutes = document.getElementById('ev-max-delay-minutes');
const inputMaxDelaySeconds = document.getElementById('ev-max-delay-seconds');
const inputMaxDelayAction = document.getElementById('ev-max-delay-action');
const prioritySelect = document.getElementById('ev-priority');
const execRadios = document.querySelectorAll('input[name="ev-exec"]');
const actionRadios = document.querySelectorAll('input[name="ev-action"]');
const execInterrupt = document.querySelector('input[name="ev-exec"][value="interrupt"]');
const execWait = document.querySelector('input[name="ev-exec"][value="wait"]');
const execMaxDelay = document.querySelector('input[name="ev-exec"][value="max-delay"]');

function syncActionExecutionCompatibility() {
    const selectedAction = document.querySelector('input[name="ev-action"]:checked').value;
    const disableExecutionRules = selectedAction === 'append-end';
    execInterrupt.disabled = false;
    execWait.disabled = false;
    execMaxDelay.disabled = false;

    if (disableExecutionRules) {
        execWait.checked = true;
        execInterrupt.disabled = true;
        execWait.disabled = true;
        execMaxDelay.disabled = true;
    }
    syncExecutionModeUI();
}

function syncExecutionModeUI() {
    const selectedAction = document.querySelector('input[name="ev-action"]:checked').value;
    if (selectedAction === 'append-end') {
        inputMaxDelayMinutes.disabled = true;
        inputMaxDelaySeconds.disabled = true;
        inputMaxDelayAction.disabled = true;
        return;
    }
    const selectedExec = document.querySelector('input[name="ev-exec"]:checked').value;
    const useMaxDelay = selectedExec === 'max-delay';
    inputMaxDelayMinutes.disabled = !useMaxDelay;
    inputMaxDelaySeconds.disabled = !useMaxDelay;
    inputMaxDelayAction.disabled = !useMaxDelay;
}

function getMaxDelayTotalSeconds() {
    const minutes = Math.max(0, parseInt(inputMaxDelayMinutes.value || 0, 10) || 0);
    const rawSeconds = parseInt(inputMaxDelaySeconds.value || 0, 10) || 0;
    const seconds = Math.min(59, Math.max(0, rawSeconds));
    inputMaxDelaySeconds.value = seconds.toString();
    return (minutes * 60) + seconds;
}

execRadios.forEach(radio => {
    radio.addEventListener('change', syncExecutionModeUI);
});
actionRadios.forEach(radio => {
    radio.addEventListener('change', syncActionExecutionCompatibility);
});

const chkCyclic = document.getElementById('chk-cyclic-active');
const inputCyclicInterval = document.getElementById('ev-cyclic-interval');
const inputCyclicUnit = document.getElementById('ev-cyclic-unit');
const inputCyclicLimit = document.getElementById('ev-cyclic-limit');

chkCyclic.addEventListener('change', (e) => {
    inputCyclicInterval.disabled = !e.target.checked;
    inputCyclicUnit.disabled = !e.target.checked;
    inputCyclicLimit.disabled = !e.target.checked;
});

document.getElementById('btn-browse').addEventListener('click', async (e) => {
    e.preventDefault();
    
    const sourceType = document.querySelector('input[name="ev-source-type"]:checked').value;
    let filePath = null;

    // Lógica independiente para cada selección
    if (sourceType === 'folder') {
        filePath = await ipcRenderer.invoke('dialog:selectFolder');
    } else if (sourceType === 'playlist') {
        filePath = await ipcRenderer.invoke('dialog:openPlaylist');
    } else {
        filePath = await ipcRenderer.invoke('dialog:openFile');
    }
    
    if (filePath) {
        document.getElementById('ev-filepath').value = filePath;
        
        const nameField = document.getElementById('ev-name');
        if (!nameField.value || nameField.value.trim() === '' || nameField.value === 'undefined') {
            let baseName = require('path').basename(filePath);
            baseName = baseName.replace(/\.[^/.]+$/, ""); 
            if (sourceType === 'folder') {
                nameField.value = `[Carpeta] ${baseName}`;
            } else {
                nameField.value = baseName;
            }
        }
    }
});

document.querySelectorAll('input[name="ev-source-type"]').forEach(radio => {
    radio.addEventListener('change', () => {
        const sourceType = document.querySelector('input[name="ev-source-type"]:checked').value;
        const pathInput = document.getElementById('ev-filepath');
        if (sourceType === 'commercial') {
            syncSourceTypeUi();
            const sel = document.getElementById('ev-commercial-block');
            pathInput.value = sel?.value || '';
            const block = commercialBlocks.find(item => item.id === pathInput.value);
            if (block && !document.getElementById('ev-name').value.trim()) document.getElementById('ev-name').value = `[Comerciales] ${block.name}`;
        } else {
            pathInput.value = '';
            syncSourceTypeUi();
        }
    });
});

document.getElementById('ev-commercial-block').addEventListener('change', (e) => {
    const block = commercialBlocks.find(item => item.id === e.target.value);
    document.getElementById('ev-filepath').value = e.target.value || '';
    if (block && !document.getElementById('ev-name').value.trim()) document.getElementById('ev-name').value = `[Comerciales] ${block.name}`;
});

document.getElementById('btn-save').addEventListener('click', (e) => {
    e.preventDefault();
    const sourceType = document.querySelector('input[name="ev-source-type"]:checked').value;
    if (sourceType === 'commercial') {
        const commercialSelect = document.getElementById('ev-commercial-block');
        document.getElementById('ev-filepath').value = commercialSelect ? commercialSelect.value : '';
    }
    const filePath = document.getElementById('ev-filepath').value;
    if (!filePath || filePath === 'undefined' || filePath.trim() === '') { 
        alert("Debes seleccionar una ruta válida en Origen del Audio."); 
        return; 
    }
    
    let name = document.getElementById('ev-name').value.trim();
    if (!name || name === 'undefined') {
        name = require('path').basename(filePath).replace(/\.[^/.]+$/, ""); 
    }

    let otherHours = [];
    if (document.getElementById('chk-other-hours').checked) {
        const primaryHour = parseInt(timeInput.value.split(':')[0], 10);
        document.querySelectorAll('.chk-hour:checked').forEach(cb => {
            const val = parseInt(cb.value);
            if (val !== primaryHour) {
                otherHours.push(val);
            }
        });
    }

    let specificDays = [];
    const dayMode = document.querySelector('input[name="ev-days"]:checked').value;
    if (dayMode === 'specific') {
        document.querySelectorAll('.chk-day:checked').forEach(cb => specificDays.push(parseInt(cb.value)));
    }

    let targetWeeks = [];
    if (dayMode === 'monthlyWeeks') {
        document.querySelectorAll('.chk-week:checked').forEach(cb => targetWeeks.push(parseInt(cb.value)));
        if (targetWeeks.length === 0) {
            alert("Debes seleccionar al menos una semana del mes.");
            return;
        }
    }

    const groupId = document.getElementById('ev-group').value || 'g_general';

    const selectedAction = document.querySelector('input[name="ev-action"]:checked').value;
    const selectedExecution = selectedAction === 'append-end'
        ? 'wait'
        : document.querySelector('input[name="ev-exec"]:checked').value;
    const maxDelayActive = selectedExecution === 'max-delay';
    const maxDelayTotalSeconds = maxDelayActive ? getMaxDelayTotalSeconds() : 0;

    if (maxDelayActive && maxDelayTotalSeconds < 1) {
            alert("Debes indicar un Tiempo Máx de Espera válido (mínimo 1 segundo).");
            return;
    }

    const newEvent = {
        id: currentEventId || 'ev_' + Date.now(),
        name: name,
        group: groupId,
        sourceType: sourceType,
        filePath: filePath,
        primaryTime: document.getElementById('ev-time').value,
        otherHours: otherHours,
        dayMode: dayMode, 
        specificDays: specificDays,
        targetWeeks: targetWeeks,
        validityStart: chkValidity.checked ? (dateStart.value || null) : null, 
        validityEnd: chkValidity.checked ? (dateEnd.value || null) : null,     
        action: selectedAction,
        execution: selectedExecution,
        priority: prioritySelect ? prioritySelect.value : 'normal',
        colorText: document.getElementById('ev-color-txt').value,
        colorBg: document.getElementById('ev-color-bg').value,
        lastFired: null,
        
        requirePlaying: document.getElementById('chk-require-playing').checked,
        maxDelayActive: maxDelayActive,
        maxDelayMinutes: maxDelayActive ? Math.floor(maxDelayTotalSeconds / 60) : 0,
        maxDelaySeconds: maxDelayActive ? (maxDelayTotalSeconds % 60) : 0,
        maxDelayTime: maxDelayActive ? Math.floor(maxDelayTotalSeconds / 60) : 0,
        maxDelayAction: maxDelayActive ? inputMaxDelayAction.value : 'omit',
        cyclicActive: chkCyclic.checked,
        cyclicInterval: chkCyclic.checked ? parseInt(inputCyclicInterval.value || 0) : 0,
        cyclicUnit: chkCyclic.checked ? inputCyclicUnit.value : 'minutes',
        cyclicLimit: chkCyclic.checked ? parseInt(inputCyclicLimit.value || 0) : 0
    };

    // Enviamos a guardar a SQLite vía main.js
    ipcRenderer.send('save-event', newEvent);
});

document.getElementById('btn-cancel').addEventListener('click', (e) => {
    e.preventDefault();
    window.close();
});

ipcRenderer.on('load-event-data', (e, data) => {
    if(!data) {
        syncPrimaryHour(); 
        syncActionExecutionCompatibility();
        syncSourceTypeUi();
        return;
    }
    currentEventId = data.id;
    
    let sourceType = data.sourceType || 'file';
    
    // Retrocompatibilidad: Si era "file" pero la ruta es ".lfplay", actualizar a "playlist" para que el UI cuadre
    if (sourceType === 'file' && data.filePath && data.filePath.toLowerCase().endsWith('.lfplay')) {
        sourceType = 'playlist';
    }

    const sourceRadio = document.querySelector(`input[name="ev-source-type"][value="${sourceType}"]`);
    if(sourceRadio) sourceRadio.checked = true;

    document.getElementById('ev-filepath').value = (data.filePath && data.filePath !== 'undefined') ? data.filePath : '';
    if (sourceType === 'commercial') loadCommercialBlocksIntoSelect(data.filePath || '').then(syncSourceTypeUi);
    else syncSourceTypeUi();
    document.getElementById('ev-name').value = (data.name && data.name !== 'undefined') ? data.name : '';
    
    if (data.group) {
        document.getElementById('ev-group').value = data.group;
    }
    
    document.getElementById('ev-time').value = data.primaryTime;
    document.getElementById('ev-color-txt').value = data.colorText || '#ffffff';
    document.getElementById('ev-color-bg').value = data.colorBg || '#1a1a1c';
    if (prioritySelect) prioritySelect.value = data.priority || 'normal';

    if (data.otherHours && data.otherHours.length > 0) {
        document.getElementById('chk-other-hours').checked = true;
        hoursContainer.style.display = 'grid';
        document.querySelectorAll('.chk-hour').forEach(cb => {
            if (data.otherHours.includes(parseInt(cb.value))) cb.checked = true;
        });
    }

    const dayModeRadio = document.querySelector(`input[name="ev-days"][value="${data.dayMode}"]`);
    if(dayModeRadio) dayModeRadio.checked = true;

    if (data.dayMode === 'specific') {
        document.getElementById('specific-days-container').style.display = 'flex';
        document.querySelectorAll('.chk-day').forEach(cb => {
            if (data.specificDays && data.specificDays.includes(parseInt(cb.value))) cb.checked = true;
        });
    }

    if (data.dayMode === 'monthlyWeeks') {
        document.getElementById('monthly-weeks-container').style.display = 'block';
    }

    if (data.targetWeeks && Array.isArray(data.targetWeeks)) {
        document.querySelectorAll('.chk-week').forEach(cb => {
            cb.checked = data.targetWeeks.includes(parseInt(cb.value));
        });
    }

    if (data.validityStart || data.validityEnd) {
        chkValidity.checked = true;
        validityContainer.style.opacity = '1';
        dateStart.disabled = false;
        dateEnd.disabled = false;
        if (data.validityStart) dateStart.value = data.validityStart;
        if (data.validityEnd) dateEnd.value = data.validityEnd;
    }

    const actionRadio = document.querySelector(`input[name="ev-action"][value="${data.action}"]`);
    if(actionRadio) actionRadio.checked = true;

    const execValue = (data.maxDelayActive && (data.execution === 'wait' || data.execution === 'max-delay')) ? 'max-delay' : (data.execution || 'interrupt');
    const execRadio = document.querySelector(`input[name="ev-exec"][value="${execValue}"]`);
    if(execRadio) execRadio.checked = true;

    document.getElementById('chk-require-playing').checked = data.requirePlaying || false;

    if (data.maxDelayActive) {
        const savedMinutes = parseInt(data.maxDelayMinutes, 10);
        const savedSeconds = parseInt(data.maxDelaySeconds, 10);
        if (Number.isFinite(savedMinutes) || Number.isFinite(savedSeconds)) {
            inputMaxDelayMinutes.value = Number.isFinite(savedMinutes) ? Math.max(0, savedMinutes) : 0;
            inputMaxDelaySeconds.value = Number.isFinite(savedSeconds) ? Math.min(59, Math.max(0, savedSeconds)) : 0;
        } else {
            inputMaxDelayMinutes.value = parseInt(data.maxDelayTime || 0, 10) || 0;
            inputMaxDelaySeconds.value = 0;
        }
        inputMaxDelayAction.value = data.maxDelayAction || 'omit';
    }

    if (data.cyclicActive) {
        chkCyclic.checked = true;
        inputCyclicInterval.disabled = false;
        inputCyclicUnit.disabled = false;
        inputCyclicLimit.disabled = false;
        inputCyclicInterval.value = data.cyclicInterval || '';
        inputCyclicUnit.value = data.cyclicUnit || 'minutes';
        inputCyclicLimit.value = data.cyclicLimit || '';
    }

    syncPrimaryHour();
    syncActionExecutionCompatibility();
});
