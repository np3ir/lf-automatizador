/**
 * genre_utils.js — Utilidades puras para géneros (CAPA 1)
 * Cero side-effects, cero acceso a BD.
 */

function normalizeSlug(value) {
    return String(value || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/&/g, '-y-')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-');
}

function toDisplayName(value) {
    const clean = String(value || '').trim();
    if (!clean) return '';
    return clean.split(/[\s-]+/).map(w => {
        if (/^\d+s?$/.test(w)) return w;
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');
}

function validateGenreName(value) {
    const raw = String(value || '').trim();
    if (!raw) return { valid: false, error: 'El nombre está vacío.' };
    if (raw.length < 2) return { valid: false, error: 'El nombre es muy corto.' };
    if (raw.length > 100) return { valid: false, error: 'El nombre es muy largo.' };
    const slug = normalizeSlug(raw);
    if (!slug) return { valid: false, error: 'El nombre no produce un identificador válido.' };
    const display = toDisplayName(raw);
    return { valid: true, slug, display, error: null };
}

function genreLabelToFileTag(value) {
    return String(value || '')
        .split(/\s*(?:\/|;|,)\s*/)
        .map(p => p.trim()).filter(Boolean)
        .join('; ');
}

function genreFileTagToLibraryLabel(value) {
    return String(value || '')
        .split(/\s*(?:;|,|\/)\s*/)
        .map(p => p.trim()).filter(Boolean)
        .join(' / ');
}

module.exports = {
    normalizeSlug,
    toDisplayName,
    validateGenreName,
    genreLabelToFileTag,
    genreFileTagToLibraryLabel
};
