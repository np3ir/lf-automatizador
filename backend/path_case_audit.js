/**
 * path_case_audit.js — Auditoría de Mayúsculas/Minúsculas en Rutas de Archivos.
 * 
 * Propósito: En Linux, "Bachata.mp3" y "bachata.mp3" son archivos DIFERENTES.
 * Si la base de datos guarda una ruta con mayúsculas distintas al archivo real,
 * el programa no lo encontrará en Linux.
 * 
 * Esta función revisa todos los file_path de la tabla 'tracks' y detecta
 * discrepancias de casing entre lo que dice la BD y lo que existe en disco.
 * 
 * SEGURIDAD:
 * - En Windows: NUNCA modifica nada (Windows ignora mayúsculas/minúsculas).
 * - En Linux: Solo corrige si encuentra el archivo real con distinto casing.
 * - Modo diagnóstico por defecto: reporta SIN tocar nada.
 * - Modo reparación: solo si se pasa { autoFix: true }.
 * 
 * Cross-Platform: Windows y Linux conviven en el mismo código.
 */

const fs = require('fs');
const path = require('path');

/**
 * Busca un archivo en un directorio ignorando mayúsculas/minúsculas.
 * Retorna la ruta correcta (con el casing real del disco) o null.
 */
function findFileIgnoringCase(filePath) {
    try {
        const dir = path.dirname(filePath);
        const targetName = path.basename(filePath);

        if (!fs.existsSync(dir)) return null;

        const entries = fs.readdirSync(dir);
        const match = entries.find(entry => entry.toLowerCase() === targetName.toLowerCase());

        if (match && match !== targetName) {
            return path.join(dir, match);
        }
    } catch (err) {
        // Directorio inaccesible o error de lectura — ignorar
    }
    return null;
}

/**
 * Ejecuta la auditoría de rutas en la base de datos.
 * 
 * @param {Database} db - Instancia de better-sqlite3
 * @param {Object} options
 * @param {boolean} options.autoFix - Si true, corrige automáticamente los registros (default: false)
 * @param {Function} options.writeLog - Función para escribir logs (opcional)
 * @returns {Object} Reporte con: total, valid, missing, fixable, fixed, details[]
 */
function runPathCaseAudit(db, options = {}) {
    const autoFix = options.autoFix === true;
    const writeLog = options.writeLog || (() => {});
    const isLinux = process.platform === 'linux';

    const report = {
        platform: process.platform,
        timestamp: new Date().toISOString(),
        total: 0,
        valid: 0,
        missing: 0,
        caseIssues: 0,
        fixed: 0,
        skipped: 0,
        details: []
    };

    // En Windows esto es informativo solamente — el SO no distingue mayúsculas.
    // Pero reportamos igualmente por si el usuario quiere ver el estado antes de migrar a Linux.

    let rows;
    try {
        rows = db.prepare("SELECT file_path FROM tracks").all();
    } catch (err) {
        writeLog("[PATH AUDIT] Error leyendo la BD: " + err.message);
        return { ...report, error: err.message };
    }

    report.total = rows.length;

    // Preparar statements para las correcciones (si se necesitan)
    const updatePathStmt = autoFix ? db.prepare(
        "UPDATE tracks SET file_path = ? WHERE file_path = ?"
    ) : null;
    const updateArtistLinksStmt = autoFix ? db.prepare(
        "UPDATE track_artist_links SET file_path = ? WHERE file_path = ?"
    ) : null;
    const updateGenreLinksStmt = autoFix ? db.prepare(
        "UPDATE track_genre_links SET file_path = ? WHERE file_path = ?"
    ) : null;

    for (const row of rows) {
        const filePath = row.file_path;

        // Paso 1: ¿El archivo existe tal cual dice la BD?
        if (fs.existsSync(filePath)) {
            report.valid++;
            continue;
        }

        // Paso 2: El archivo NO existe con esa ruta exacta.
        // Intentar buscarlo con distinto casing en la misma carpeta.
        const correctedPath = findFileIgnoringCase(filePath);

        if (correctedPath) {
            // Encontramos el archivo pero con distinto casing
            report.caseIssues++;

            if (autoFix) {
                try {
                    // Cross-Platform: Actualizar la ruta en la tabla principal y en las tablas enlazadas
                    db.transaction(() => {
                        updatePathStmt.run(correctedPath, filePath);
                        updateArtistLinksStmt.run(correctedPath, filePath);
                        updateGenreLinksStmt.run(correctedPath, filePath);
                    })();
                    report.fixed++;
                    report.details.push({
                        status: 'fixed',
                        original: filePath,
                        corrected: correctedPath
                    });
                } catch (err) {
                    report.skipped++;
                    report.details.push({
                        status: 'error',
                        original: filePath,
                        corrected: correctedPath,
                        error: err.message
                    });
                }
            } else {
                // Solo modo diagnóstico — reportar sin tocar
                report.details.push({
                    status: 'fixable',
                    original: filePath,
                    corrected: correctedPath
                });
            }
        } else {
            // El archivo simplemente no existe (ni con otro casing)
            report.missing++;
            // Solo reportar los primeros 100 archivos faltantes para no saturar
            if (report.details.length < 100) {
                report.details.push({
                    status: 'missing',
                    original: filePath
                });
            }
        }
    }

    // Log final
    const summary = `[PATH AUDIT] Resultado: ${report.total} pistas, ${report.valid} válidas, ${report.caseIssues} con problema de casing${autoFix ? ` (${report.fixed} corregidas)` : ''}, ${report.missing} archivos no encontrados.`;
    writeLog(summary);

    return report;
}

module.exports = { runPathCaseAudit, findFileIgnoringCase };
