const os = require('os');
const path = require('path');
const fs = require('fs');

const APP_NAME = 'LF Automatizador';

function isPackagedRuntime(anchorDir = __dirname) {
    const normalized = String(anchorDir || '').replace(/\\/g, '/');
    return normalized.includes('/app.asar') || normalized.includes('/app.asar.unpacked');
}

function getUserDataDir() {
    try {
        const electron = require('electron');
        if (electron?.app?.getPath) return electron.app.getPath('userData');
    } catch (err) {}

    const home = os.homedir();
    if (process.platform === 'win32') {
        return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), APP_NAME);
    }
    if (process.platform === 'darwin') {
        return path.join(home, 'Library', 'Application Support', APP_NAME);
    }
    return path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), APP_NAME);
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
}

function getConfigDir(devConfigDir, anchorDir = __dirname) {
    const configDir = isPackagedRuntime(anchorDir)
        ? path.join(getUserDataDir(), 'config')
        : devConfigDir;
    return ensureDir(configDir);
}

module.exports = {
    APP_NAME,
    getConfigDir,
    getUserDataDir,
    isPackagedRuntime,
    ensureDir
};
