/**
 * platform.js — Utilidades centralizadas de detección de plataforma.
 * 
 * Este módulo es el ÚNICO punto de verdad para saber en qué SO estamos.
 * Todos los archivos que necesiten lógica condicional por plataforma
 * deben importar desde aquí en lugar de escribir `process.platform` directamente.
 * 
 * REGLA DE ORO: El código de Windows y Linux convive en el mismo archivo.
 * Nada de carpetas separadas. Solo condicionales limpios.
 */

const os = require('os');
const path = require('path');

const isWindows = process.platform === 'win32';
const isLinux = process.platform === 'linux';
const isMac = process.platform === 'darwin';

/**
 * Extensión de ejecutables según plataforma.
 * Windows: '.exe', Linux/Mac: '' (sin extensión)
 */
const executableExtension = isWindows ? '.exe' : '';

/**
 * Adapta una ruta almacenada (en config o BD) al SO actual.
 * Si estamos en Linux y la ruta parece ser una ruta absoluta de Windows
 * que apunta dentro del proyecto, la convierte a ruta relativa resuelta
 * desde el directorio del proyecto.
 * 
 * En Windows, retorna la ruta sin cambios (pass-through).
 * 
 * @param {string} storedPath - La ruta guardada (puede ser de Windows o Linux)
 * @param {string} projectRoot - La raíz del proyecto actual (__dirname del main.js)
 * @returns {string} La ruta adaptada al SO actual
 * 
 * @example
 * // En Linux, con projectRoot = '/home/user/lf-automatizador':
 * adaptStoredPath('C:\\LF Automatizador v1.0\\Time', projectRoot)
 * // → '/home/user/lf-automatizador/Time'
 * 
 * // En Windows, retorna sin cambios:
 * adaptStoredPath('C:\\LF Automatizador v1.0\\Time', projectRoot)
 * // → 'C:\\LF Automatizador v1.0\\Time'
 */
function adaptStoredPath(storedPath, projectRoot) {
    if (!storedPath || isWindows) return storedPath;

    // Si es una ruta absoluta de Windows (empieza con letra de unidad)
    if (/^[A-Z]:\\/.test(storedPath)) {
        const normalized = storedPath.replace(/\\/g, '/');

        // Buscar si contiene una referencia al proyecto
        // Soporta: "LF Automatizador v1.0", "LF Automatizador", etc.
        const projectMarkers = ['LF Automatizador v1.0', 'LF Automatizador'];
        for (const marker of projectMarkers) {
            const markerIndex = normalized.indexOf(marker);
            if (markerIndex >= 0) {
                // Encontrar el separador después del marcador
                const afterMarkerStart = markerIndex + marker.length;
                const slashAfter = normalized.indexOf('/', afterMarkerStart);
                if (slashAfter >= 0) {
                    const relativePart = normalized.substring(slashAfter + 1);
                    return path.join(projectRoot, relativePart);
                }
                // Si no hay nada después del marcador, es la raíz del proyecto
                return projectRoot;
            }
        }

        // Si es una ruta Windows pero no del proyecto, no podemos adaptarla
        // (ej: "D:\Musica" → no tiene equivalente automático en Linux)
        return storedPath;
    }

    return storedPath;
}

/**
 * Genera opciones seguras para child_process.spawn() en ambas plataformas.
 * En Windows agrega `windowsHide: true` para no mostrar ventanas de consola.
 * En Linux no agrega nada extra (windowsHide es ignorado por Node pero lo omitimos por limpieza).
 * 
 * @param {Object} extraOptions - Opciones adicionales para spawn
 * @returns {Object} Opciones combinadas seguras para la plataforma actual
 */
function safeSpawnOptions(extraOptions = {}) {
    const base = { ...extraOptions };
    if (isWindows) {
        base.windowsHide = true;
    }
    return base;
}

module.exports = {
    isWindows,
    isLinux,
    isMac,
    executableExtension,
    adaptStoredPath,
    safeSpawnOptions
};
