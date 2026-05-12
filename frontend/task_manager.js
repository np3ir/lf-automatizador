const { ipcRenderer } = require('electron');

const processBody = document.getElementById('process-body');
const workerBody = document.getElementById('worker-body');
const totalCpuEl = document.getElementById('total-cpu');
const totalMemoryEl = document.getElementById('total-memory');
const peakMemoryEl = document.getElementById('peak-memory');
let peakMemoryKb = 0;

function formatMemory(kb) {
    const mb = (Number(kb) || 0) / 1024;
    return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}

function formatCpu(value) {
    return `${(Number(value) || 0).toFixed(1)}%`;
}

function processLabel(type) {
    const labels = {
        Browser: 'Principal',
        Tab: 'Renderer',
        GPU: 'GPU',
        Utility: 'Utilidad',
        Zygote: 'Zygote',
        Sandbox_helper: 'Sandbox'
    };
    return labels[type] || type || 'Desconocido';
}

function renderProcesses(metrics = []) {
    if (!processBody) return;
    processBody.innerHTML = metrics.map(item => `
        <tr>
            <td>${item.pid}</td>
            <td>${processLabel(item.type)}${item.diagnostic ? ' *' : ''}</td>
            <td>${item.label || '-'}</td>
            <td class="num">${formatCpu(item.cpu)}</td>
            <td class="num">${formatMemory(item.memoryKb)}</td>
            <td class="num">${formatMemory(item.privateKb)}</td>
            <td class="num">N/D</td>
        </tr>
    `).join('');
}

function renderWorkers(workers = []) {
    if (!workerBody) return;
    workerBody.innerHTML = workers.map(worker => `
        <tr>
            <td>${worker.name}</td>
            <td class="${worker.active ? 'active' : 'idle'}">${worker.active ? 'Activo' : 'Inactivo'}</td>
            <td>${worker.detail || ''}</td>
        </tr>
    `).join('');
}

async function refresh() {
    try {
        const snapshot = await ipcRenderer.invoke('task-manager-snapshot');
        if (totalCpuEl) totalCpuEl.innerText = formatCpu(snapshot?.totals?.cpu);
        if (totalMemoryEl) totalMemoryEl.innerText = formatMemory(snapshot?.totals?.memoryKb);
        peakMemoryKb = Math.max(peakMemoryKb, Number(snapshot?.totals?.memoryKb) || 0);
        if (peakMemoryEl) peakMemoryEl.innerText = formatMemory(peakMemoryKb);
        renderProcesses(snapshot?.metrics || []);
        renderWorkers(snapshot?.workers || []);
    } catch (err) {}
}

refresh();
setInterval(refresh, 1000);
