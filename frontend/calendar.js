// ====================================================================
// CALENDARIO SEMANAL Y PARRILLA DE PROGRAMACIÓN
// LF Automatizador v1.0 — calendar.js
// ====================================================================

const { ipcRenderer } = require('electron');

// ── State ──
let eventsDB = [];
let eventGroupsDB = [];
let scheduleDB = [];
let contextTarget = null;

// ── DOM refs ──
const chkParrilla = document.getElementById('chk-parrilla');
const chkEventos = document.getElementById('chk-eventos');
const dayContents = document.querySelectorAll('.day-content');
const programModal = document.getElementById('program-modal');
const ctxMenu = document.getElementById('ctx-menu');

// ── Style labels ──
const STYLE_LABELS = {
    musical: '🎵 Musical',
    informativo: '📰 Informativo',
    cultural: '🎭 Cultural',
    educativo: '📚 Educativo',
    opinion: '💬 Opinión',
    deportivo: '⚽ Deportivo',
    religioso: '🙏 Religioso',
    entretenimiento: '🎉 Entretenimiento',
    otro: '📌 Otro'
};

// Classify event source for visual styling
const EVENT_SOURCE_CLASSES = {
    file: 'musica',
    folder: 'musica',
    commercial: 'publi',
    lfplay: 'general'
};

// ====================================================================
// DATA LOADING
// ====================================================================

async function loadAllData() {
    try {
        [eventsDB, eventGroupsDB, scheduleDB] = await Promise.all([
            ipcRenderer.invoke('db-get-events'),
            ipcRenderer.invoke('db-get-groups'),
            ipcRenderer.invoke('db-get-schedule')
        ]);
    } catch (e) {
        console.error('Error loading data:', e);
        eventsDB = []; eventGroupsDB = []; scheduleDB = [];
    }
    renderCalendar();
}

// ====================================================================
// RENDERING
// ====================================================================

function getEventDays(ev) {
    if (!ev.dayMode || ev.dayMode === 'daily') return [0, 1, 2, 3, 4, 5, 6];
    if (ev.dayMode === 'specific' && Array.isArray(ev.specificDays)) return ev.specificDays;
    if (ev.dayMode === 'weekdays') return [1, 2, 3, 4, 5];
    if (ev.dayMode === 'weekend') return [0, 6];
    if (ev.dayMode === 'monthlyWeeks') {
        if (Array.isArray(ev.specificDays) && ev.specificDays.length > 0) return ev.specificDays;
        return [0, 1, 2, 3, 4, 5, 6]; // Show on all if no specific day for monthly
    }
    return [0, 1, 2, 3, 4, 5, 6];
}

function getProgramDays(prog) {
    if (!prog.dayMode || prog.dayMode === 'daily') return [0, 1, 2, 3, 4, 5, 6];
    if (prog.dayMode === 'specific' && Array.isArray(prog.specificDays)) return prog.specificDays;
    if (prog.dayMode === 'weekdays') return [1, 2, 3, 4, 5];
    if (prog.dayMode === 'weekend') return [0, 6];
    return [0, 1, 2, 3, 4, 5, 6];
}

function getEventClass(ev) {
    // Determine visual class based on event source or group
    if (ev.sourceType === 'commercial') return 'publi';
    const group = eventGroupsDB.find(g => g.id === ev.group);
    if (group) {
        const name = (group.name || '').toLowerCase();
        if (name.includes('jingle') || name.includes('pisador')) return 'jingle';
        if (name.includes('publi') || name.includes('comer')) return 'publi';
    }
    // Check file path hints
    const fp = (ev.filePath || '').toLowerCase();
    if (fp.includes('jingle') || fp.includes('pisador')) return 'jingle';
    if (fp.includes('publi') || fp.includes('comer')) return 'publi';
    return EVENT_SOURCE_CLASSES[ev.sourceType] || 'general';
}

function formatTime(timeStr) {
    if (!timeStr) return '--:--';
    const parts = timeStr.split(':');
    return parts[0] + ':' + parts[1];
}

function getEventDescription(ev) {
    const group = eventGroupsDB.find(g => g.id === ev.group);
    let parts = [];
    if (ev.sourceType === 'folder') parts.push('Carpeta');
    else if (ev.sourceType === 'commercial') parts.push('Bloque comercial');
    else if (ev.sourceType === 'lfplay') parts.push('Lista LFPlay');
    else parts.push('Archivo');
    if (ev.action === 'clear') parts.push('(Limpia lista)');
    else if (ev.action === 'temp') parts.push('(Temporal)');
    else if (ev.action === 'append-end') parts.push('(Al final)');
    if (group && group.name !== 'General') parts.push('· ' + group.name);
    return parts.join(' ');
}

function createEventCard(ev) {
    const div = document.createElement('div');
    const evClass = getEventClass(ev);
    div.className = `item evento ${evClass}`;
    div.dataset.type = 'evento';
    div.dataset.eventId = ev.id;

    const timeStr = formatTime(ev.primaryTime);
    const desc = getEventDescription(ev);

    // Get actual colors from event or its group
    const group = eventGroupsDB.find(g => g.id === ev.group);
    const colorBg = ev.colorBg || (group ? group.colorBg : null);
    const colorText = ev.colorText || (group ? group.colorText : null);

    if (colorBg) {
        div.style.backgroundColor = hexToRGBA(colorBg, 0.25);
        div.style.borderLeftColor = colorBg;
        div.style.borderColor = hexToRGBA(colorBg, 0.4);
        div.style.borderLeftWidth = '4px';
    }

    const badgeStyle = colorBg ? `style="background: ${hexToRGBA(colorBg, 0.4)}; color: ${colorText || '#fff'};"` : '';

    div.innerHTML = `
        <span class="item-badge" ${badgeStyle}>EVENTO</span>
        <div class="time" ${colorText ? `style="color: ${colorText}"` : ''}>${timeStr}</div>
        <div class="item-title" ${colorText ? `style="color: ${colorText}"` : ''}>${ev.name || 'Sin nombre'}</div>
        <div class="desc">${desc}</div>
    `;

    // Double click opens event editor
    div.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        ipcRenderer.send('open-event-editor', ev);
    });

    // Right click context
    div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e.pageX, e.pageY, { type: 'evento', data: ev, element: div });
    });

    return div;
}

function createProgramCard(prog) {
    const div = document.createElement('div');
    div.className = 'item parrilla';
    div.dataset.type = 'parrilla';
    div.dataset.programId = prog.id;
    div.draggable = true;

    const startStr = formatTime(prog.startTime);
    const endStr = formatTime(prog.endTime);
    const styleLabel = STYLE_LABELS[prog.style] || prog.style;
    let descParts = [];
    if (prog.host) descParts.push('Locutor: ' + prog.host);
    descParts.push('Estilo: ' + styleLabel);

    // Apply custom colors
    if (prog.colorBg) {
        div.style.backgroundColor = hexToRGBA(prog.colorBg, 0.25);
        div.style.borderLeftColor = prog.colorBg;
        div.style.borderColor = hexToRGBA(prog.colorBg, 0.4);
        div.style.borderLeftWidth = '4px';
    }

    div.innerHTML = `
        <span class="item-badge" style="background: ${hexToRGBA(prog.colorBg || '#34495e', 0.4)}; color: ${prog.colorText || '#fff'};">PROGRAMA</span>
        <div class="time">${startStr} - ${endStr}</div>
        <div class="item-title">${prog.name}</div>
        <div class="desc">${descParts.join('<br>')}</div>
    `;

    // Double click opens editor modal
    div.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        openProgramModal(prog);
    });

    // Right click context
    div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e.pageX, e.pageY, { type: 'parrilla', data: prog, element: div });
    });

    // Drag events
    div.addEventListener('dragstart', (e) => {
        div.classList.add('dragging');
        e.dataTransfer.setData('text/plain', prog.id);
        e.dataTransfer.effectAllowed = 'move';
    });

    div.addEventListener('dragend', () => {
        div.classList.remove('dragging');
    });

    return div;
}

const viewModeSelect = document.getElementById('view-mode');
viewModeSelect.addEventListener('change', renderCalendar);

function renderCalendar() {
    const showParrilla = chkParrilla.checked;
    const showEventos = chkEventos.checked;
    const viewMode = viewModeSelect.value;
    const today = new Date().getDay(); // 0=Dom, 1=Lun...

    // Mark today's header
    document.querySelectorAll('.day-header').forEach(h => {
        h.classList.toggle('today', parseInt(h.dataset.day) === today);
    });

    // Grid mode management
    const grid = document.getElementById('calendar-grid');
    grid.classList.toggle('list-mode', viewMode === 'list');

    // Manage Time Column (only in hours mode)
    let timeColumn = document.querySelector('.time-column');
    if (viewMode === 'hours') {
        if (!timeColumn) {
            timeColumn = document.createElement('div');
            timeColumn.className = 'time-column';
            timeColumn.innerHTML = `
                <div class="day-header">HORA</div>
                <div class="time-labels-container"></div>
            `;
            grid.prepend(timeColumn);
        }
        const container = timeColumn.querySelector('.time-labels-container');
        container.innerHTML = '';
        for (let h = 0; h < 24; h++) {
            const lbl = document.createElement('div');
            lbl.className = 'time-label';
            lbl.dataset.hour = h;
            lbl.textContent = `${h.toString().padStart(2, '0')}:00`;
            container.appendChild(lbl);
        }
        timeColumn.style.display = 'flex';
    } else {
        if (timeColumn) timeColumn.style.display = 'none';
    }

    // Clear all day columns
    dayContents.forEach(dc => { dc.innerHTML = ''; });

    // Collect items per day: { dayNumber: [ {sortKey, element, hour, obj} ] }
    const dayItems = {};
    for (let d = 0; d <= 6; d++) dayItems[d] = [];

    // Add schedule programs
    if (showParrilla) {
        scheduleDB.forEach(prog => {
            if (!prog.enabled) return;
            const days = getProgramDays(prog);
            days.forEach(d => {
                dayItems[d].push({
                    sortKey: prog.startTime || '00:00',
                    hour: parseInt((prog.startTime || '00:00').split(':')[0]),
                    element: createProgramCard(prog),
                    obj: prog,
                    type: 'parrilla'
                });
            });
        });
    }

    // Add events
    if (showEventos) {
        eventsDB.forEach(ev => {
            if (!ev.primaryTime) return;
            const days = getEventDays(ev);
            days.forEach(d => {
                dayItems[d].push({
                    sortKey: ev.primaryTime,
                    hour: parseInt(ev.primaryTime.split(':')[0]),
                    element: createEventCard(ev),
                    obj: ev,
                    type: 'evento'
                });
            });
        });
    }

    // Sort and render
    dayContents.forEach(dc => {
        const day = parseInt(dc.dataset.day);
        const items = dayItems[day] || [];
        items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

        if (viewMode === 'list') {
            dc.style.gap = '6px';
            if (items.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'day-empty';
                empty.textContent = 'Sin programación';
                dc.appendChild(empty);
            } else {
                items.forEach(item => dc.appendChild(item.element));
            }
        } else if (viewMode === 'hours') {
            dc.style.gap = '0';
            for (let h = 0; h < 24; h++) {
                const slot = document.createElement('div');
                slot.className = 'hour-slot';
                slot.dataset.day = day;
                slot.dataset.hour = h;
                
                // Highlight row on hover
                slot.addEventListener('mouseenter', () => {
                    document.querySelectorAll(`.hour-slot[data-hour="${h}"]`).forEach(s => s.classList.add('row-highlight'));
                    document.querySelectorAll(`.time-label[data-hour="${h}"]`).forEach(l => l.classList.add('row-highlight'));
                });
                slot.addEventListener('mouseleave', () => {
                    document.querySelectorAll(`.hour-slot[data-hour="${h}"]`).forEach(s => s.classList.remove('row-highlight'));
                    document.querySelectorAll(`.time-label[data-hour="${h}"]`).forEach(l => l.classList.remove('row-highlight'));
                });

                // Add items starting in this hour
                const hourItems = items.filter(i => i.hour === h);

                hourItems.forEach(item => {
                    const el = (item.type === 'parrilla') ? createProgramCard(item.obj) : item.element;
                    
                    if (item.type === 'parrilla') {
                        const [sH, sM] = item.obj.startTime.split(':').map(Number);
                        const [eH, eM] = (item.obj.endTime || '00:00').split(':').map(Number);
                        
                        let startTotal = sH * 60 + (sM || 0);
                        let endTotal = eH * 60 + (eM || 0);
                        if (endTotal <= startTotal) endTotal += 24 * 60;
                        
                        const duration = endTotal - startTotal;
                        const topOffset = sM || 0;
                        
                        el.classList.add('spanning-item');
                        el.style.position = 'absolute';
                        el.style.top = topOffset + 'px';
                        el.style.height = (duration - 2) + 'px';
                        el.style.zIndex = '20';
                        el.style.width = 'calc(100% - 8px)';
                        el.style.left = '4px';
                        el.style.margin = '0';
                    } else if (item.type === 'evento') {
                        const [sH, sM] = item.obj.primaryTime.split(':').map(Number);
                        const topOffset = sM || 0;
                        
                        el.style.position = 'absolute';
                        el.style.top = topOffset + 'px';
                        el.style.zIndex = '30'; // Encima de los programas
                        el.style.width = 'calc(100% - 12px)';
                        el.style.left = '6px';
                        el.style.margin = '0';
                    }
                    
                    slot.appendChild(el);
                });

                // Right click on slot
                slot.addEventListener('contextmenu', (e) => {
                    if (e.target.closest('.item')) return; // let the item handle its own context menu
                    e.preventDefault();
                    e.stopPropagation();
                    showSlotContextMenu(e.pageX, e.pageY, day, h);
                });

                // Drop logic for hour slot (update time when dropping parrilla item)
                slot.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    slot.classList.add('drag-over');
                });
            
                slot.addEventListener('dragleave', () => {
                    slot.classList.remove('drag-over');
                });
            
                slot.addEventListener('drop', (e) => {
                    e.preventDefault();
                    slot.classList.remove('drag-over');
                    const programId = e.dataTransfer.getData('text/plain');
                    if (!programId) return;
            
                    const targetDay = parseInt(slot.dataset.day);
                    const targetHour = parseInt(slot.dataset.hour);
                    const prog = scheduleDB.find(p => p.id === programId);
                    if (!prog) return;
            
                    const sourceElement = document.querySelector(`.item[data-program-id="${programId}"].dragging`);
                    if (!sourceElement) return;
                    
                    let sourceDay = -1;
                    const parentContent = sourceElement.closest('.day-content');
                    if (parentContent) sourceDay = parseInt(parentContent.dataset.day);

                    // Update time and day
                    const oldTime = prog.startTime || '00:00';
                    const newTime = `${targetHour.toString().padStart(2, '0')}:${oldTime.split(':')[1] || '00'}`;
                    prog.startTime = newTime;

                    if (sourceDay !== -1 && sourceDay !== targetDay) {
                        let days = Array.isArray(prog.specificDays) ? [...prog.specificDays] : [];
                        if (prog.dayMode === 'daily' || days.length === 0) days = [0, 1, 2, 3, 4, 5, 6];
                        days = days.filter(d => d !== sourceDay);
                        if (!days.includes(targetDay)) days.push(targetDay);
                        prog.specificDays = days;
                        prog.dayMode = 'specific';
                    }

                    ipcRenderer.send('db-save-schedule-item', prog);
                    scheduleDB = scheduleDB.map(p => p.id === prog.id ? prog : p);
                    renderCalendar();
                });

                dc.appendChild(slot);
            }
        }
    });
}

// ====================================================================
// FILTERS
// ====================================================================

chkParrilla.addEventListener('change', renderCalendar);
chkEventos.addEventListener('change', renderCalendar);

// ====================================================================
// DRAG & DROP (only for parrilla programs)
// ====================================================================

dayContents.forEach(zone => {
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
        zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const programId = e.dataTransfer.getData('text/plain');
        if (!programId) return;

        const targetDay = parseInt(zone.dataset.day);
        const prog = scheduleDB.find(p => p.id === programId);
        if (!prog) return;

        // Find current source day from the dragged element's original zone
        const sourceElement = document.querySelector(`.item[data-program-id="${programId}"].dragging`);
        if (!sourceElement) return;
        const sourceDay = parseInt(sourceElement.closest('.day-content').dataset.day);

        if (sourceDay === targetDay) return; // Same day, nothing to do

        // Update the program's specificDays: add targetDay, remove sourceDay
        let days = Array.isArray(prog.specificDays) ? [...prog.specificDays] : [];
        
        // If was daily, convert to specific with all days minus source plus target
        if (prog.dayMode === 'daily' || days.length === 0) {
            days = [0, 1, 2, 3, 4, 5, 6];
        }

        // Remove source, add target
        days = days.filter(d => d !== sourceDay);
        if (!days.includes(targetDay)) days.push(targetDay);

        prog.specificDays = days;
        prog.dayMode = 'specific';

        // Save and re-render
        ipcRenderer.send('db-save-schedule-item', prog);
        scheduleDB = scheduleDB.map(p => p.id === prog.id ? prog : p);
        renderCalendar();
    });
});

// ====================================================================
// PROGRAM MODAL (Create / Edit)
// ====================================================================

function generateId() {
    return 'sp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
}

function openProgramModal(existing = null) {
    const isEdit = !!existing;
    document.getElementById('program-modal-title').textContent = isEdit ? '✏️ Editar Programa' : '📻 Nuevo Programa';
    document.getElementById('pm-id').value = isEdit ? existing.id : generateId();
    document.getElementById('pm-name').value = isEdit ? existing.name : '';
    document.getElementById('pm-host').value = isEdit ? (existing.host || '') : '';
    document.getElementById('pm-style').value = isEdit ? (existing.style || 'musical') : 'musical';
    document.getElementById('pm-start').value = isEdit ? (existing.startTime || '06:00') : '06:00';
    document.getElementById('pm-end').value = isEdit ? (existing.endTime || '09:00') : '09:00';
    document.getElementById('pm-color-bg').value = isEdit ? (existing.colorBg || '#34495e') : '#34495e';
    document.getElementById('pm-color-text').value = isEdit ? (existing.colorText || '#ffffff') : '#ffffff';
    document.getElementById('pm-notes').value = isEdit ? (existing.notes || '') : '';

    // Days
    const days = isEdit && Array.isArray(existing.specificDays) ? existing.specificDays : [1, 2, 3, 4, 5];
    const isDailyOrEmpty = !isEdit || existing.dayMode === 'daily';
    document.querySelectorAll('#pm-days input[type="checkbox"]').forEach(chk => {
        const d = parseInt(chk.dataset.day);
        chk.checked = isDailyOrEmpty ? true : days.includes(d);
    });

    // Show delete button only in edit mode
    document.getElementById('pm-delete').style.display = isEdit ? 'inline-block' : 'none';

    programModal.style.display = 'flex';
    setTimeout(() => document.getElementById('pm-name').focus(), 100);
}

function closeProgramModal() {
    programModal.style.display = 'none';
}

function saveProgramFromModal() {
    const name = document.getElementById('pm-name').value.trim();
    if (!name) {
        document.getElementById('pm-name').style.borderColor = '#e74c3c';
        document.getElementById('pm-name').focus();
        return;
    }

    const specificDays = [];
    document.querySelectorAll('#pm-days input[type="checkbox"]').forEach(chk => {
        if (chk.checked) specificDays.push(parseInt(chk.dataset.day));
    });

    if (specificDays.length === 0) {
        alert('Debes seleccionar al menos un día de emisión.');
        return;
    }

    const item = {
        id: document.getElementById('pm-id').value,
        name: name,
        host: document.getElementById('pm-host').value.trim(),
        style: document.getElementById('pm-style').value,
        dayMode: specificDays.length === 7 ? 'daily' : 'specific',
        specificDays: specificDays,
        startTime: document.getElementById('pm-start').value || '06:00',
        endTime: document.getElementById('pm-end').value || '09:00',
        colorBg: document.getElementById('pm-color-bg').value,
        colorText: document.getElementById('pm-color-text').value,
        notes: document.getElementById('pm-notes').value.trim(),
        enabled: true,
        sortOrder: 0
    };

    ipcRenderer.send('db-save-schedule-item', item);

    // Update local state
    const idx = scheduleDB.findIndex(p => p.id === item.id);
    if (idx >= 0) scheduleDB[idx] = item;
    else scheduleDB.push(item);

    closeProgramModal();
    renderCalendar();
}

async function deleteProgramFromModal() {
    const id = document.getElementById('pm-id').value;
    if (!id) return;
    const name = document.getElementById('pm-name').value || 'este programa';
    const confirmed = await ipcRenderer.invoke('dialog:confirm', `¿Eliminar "${name}" de la parrilla?\nEsta acción no se puede deshacer.`);
    if (!confirmed) return;

    await ipcRenderer.invoke('db-delete-schedule-item', id);
    scheduleDB = scheduleDB.filter(p => p.id !== id);
    closeProgramModal();
    renderCalendar();
}

// Modal button listeners
document.getElementById('btn-add-program').addEventListener('click', () => openProgramModal(null));
document.getElementById('btn-add-event').addEventListener('click', () => ipcRenderer.send('open-event-editor', null));
document.getElementById('pm-cancel').addEventListener('click', closeProgramModal);
document.getElementById('pm-save').addEventListener('click', saveProgramFromModal);
document.getElementById('pm-delete').addEventListener('click', deleteProgramFromModal);
document.getElementById('pm-name').addEventListener('input', function() {
    this.style.borderColor = '#444';
});

// Close modal on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (programModal.style.display !== 'none') closeProgramModal();
        hideContextMenu();
    }
});

// Close modal on overlay click
programModal.addEventListener('click', (e) => {
    if (e.target === programModal) closeProgramModal();
});

// ====================================================================
// CONTEXT MENU
// ====================================================================

let contextSlot = null;

function showContextMenu(x, y, target) {
    contextTarget = target;
    contextSlot = null;
    
    document.getElementById('ctx-item-actions').style.display = 'block';
    document.getElementById('ctx-slot-actions').style.display = 'none';

    const ctxEdit = document.getElementById('ctx-edit');
    const ctxDelete = document.getElementById('ctx-delete');

    if (target.type === 'evento') {
        ctxEdit.textContent = '✏️ Editar Evento';
        ctxDelete.textContent = '🗑️ Eliminar Evento';
    } else {
        ctxEdit.textContent = '✏️ Editar Programa';
        ctxDelete.textContent = '🗑️ Eliminar Programa';
    }

    positionMenu(x, y);
}

function showSlotContextMenu(x, y, day, hour) {
    contextTarget = null;
    contextSlot = { day, hour };

    document.getElementById('ctx-item-actions').style.display = 'none';
    document.getElementById('ctx-slot-actions').style.display = 'block';

    const hStr = hour.toString().padStart(2, '0');
    document.getElementById('ctx-slot-hour').textContent = hStr;
    document.getElementById('ctx-slot-hour-ev').textContent = hStr;

    positionMenu(x, y);
}

function positionMenu(x, y) {
    const menuW = 200;
    const menuH = 100;
    if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 10;
    if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 10;

    ctxMenu.style.left = x + 'px';
    ctxMenu.style.top = y + 'px';
    ctxMenu.style.display = 'block';
}

function hideContextMenu() {
    ctxMenu.style.display = 'none';
    contextTarget = null;
    contextSlot = null;
}

document.getElementById('ctx-edit').addEventListener('click', () => {
    if (!contextTarget) return;
    if (contextTarget.type === 'evento') {
        ipcRenderer.send('open-event-editor', contextTarget.data);
    } else {
        openProgramModal(contextTarget.data);
    }
    hideContextMenu();
});

document.getElementById('ctx-delete').addEventListener('click', async () => {
    if (!contextTarget) return;
    if (contextTarget.type === 'parrilla') {
        const confirmed = await ipcRenderer.invoke('dialog:confirm', `¿Eliminar "${contextTarget.data.name}" de la parrilla?`);
        if (confirmed) {
            await ipcRenderer.invoke('db-delete-schedule-item', contextTarget.data.id);
            scheduleDB = scheduleDB.filter(p => p.id !== contextTarget.data.id);
            renderCalendar();
        }
    } else {
        // For events, use the existing event deletion mechanism
        const confirmed = await ipcRenderer.invoke('dialog:confirm', `¿Eliminar el evento "${contextTarget.data.name}"?\nEsta acción no se puede deshacer.`);
        if (confirmed) {
            eventsDB = eventsDB.filter(e => e.id !== contextTarget.data.id);
            ipcRenderer.send('db-save-events-full', eventsDB);
            // Notify main window to refresh
            ipcRenderer.send('refresh-events-from-calendar');
            renderCalendar();
        }
    }
    hideContextMenu();
});

document.getElementById('ctx-add-program').addEventListener('click', () => {
    if (!contextSlot) return;
    const timeStr = `${contextSlot.hour.toString().padStart(2, '0')}:00`;
    const endHourStr = `${((contextSlot.hour + 2) % 24).toString().padStart(2, '0')}:00`;
    openProgramModal({ dayMode: 'specific', specificDays: [contextSlot.day], startTime: timeStr, endTime: endHourStr });
    hideContextMenu();
});

document.getElementById('ctx-add-event').addEventListener('click', () => {
    if (!contextSlot) return;
    const timeStr = `${contextSlot.hour.toString().padStart(2, '0')}:00`;
    ipcRenderer.send('open-event-editor', { dayMode: 'specific', specificDays: [contextSlot.day], primaryTime: timeStr });
    hideContextMenu();
});

// Close context menu on any click
document.addEventListener('click', () => hideContextMenu());

// ====================================================================
// IPC LISTENERS
// ====================================================================

// Refresh when events are modified externally
ipcRenderer.on('refresh-events', async () => {
    eventsDB = await ipcRenderer.invoke('db-get-events');
    eventGroupsDB = await ipcRenderer.invoke('db-get-groups');
    renderCalendar();
});

// Refresh when schedule is modified externally
ipcRenderer.on('refresh-schedule', async () => {
    scheduleDB = await ipcRenderer.invoke('db-get-schedule');
    renderCalendar();
});

ipcRenderer.on('refresh-event-groups', async () => {
    eventGroupsDB = await ipcRenderer.invoke('db-get-groups');
    renderCalendar();
});

// ====================================================================
// UTILITIES
// ====================================================================

function hexToRGBA(hex, alpha) {
    if (!hex || hex.length < 7) return `rgba(52, 73, 94, ${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ====================================================================
// INIT
// ====================================================================

loadAllData();
